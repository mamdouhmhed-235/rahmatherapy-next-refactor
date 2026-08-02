"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile } from "@/lib/auth/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendRecurringSeriesCreatedEmail } from "@/lib/email/notifications";
import { canManageAllBookings } from "./access";
import { getTodayIsoDate } from "./_helpers";

/**
 * C-02 Phase C — recurring/standing bookings. Kept in their own module rather
 * than folded into `actions.ts` (1700 lines already) so the series lifecycle
 * reads as one thing; the file follows `actions.ts`'s idiom exactly — actions
 * return result objects instead of throwing, RBAC runs on the request-scoped
 * client before the admin client is ever constructed, and cache invalidation is
 * `updateTag` + `revalidatePath`.
 */

const recurringSchema = z.object({
  client_id: z.string().uuid(),
  // C-02 Phase C — `booking_participants.participant_gender`,
  // `.required_therapist_gender` and `booking_assignments.
  // required_therapist_gender` are all NOT NULL on `staff_gender_type`, an enum
  // with exactly two members and no "any". The horizon cron materialises
  // occurrences months later, so the value is snapshot on the template row and
  // must be supplied here. Rejected at the schema, not left to the DB's NOT
  // NULL — the same posture `getParticipantGenders` takes for single bookings.
  participant_gender: z.enum(["male", "female"]),
  service_slug: z.string().trim().min(1),
  first_occurrence_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  anchor_start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  cadence: z.enum(["weekly", "fortnightly", "monthly"]),
  end_type: z.enum(["until_cancelled", "after_count", "until_date"]),
  end_count: z.coerce.number().int().min(1).max(520).optional(), // hard cap 10 years weekly
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bound_therapist_id: z.string().uuid().optional(),
  open_to_any_therapist: z.boolean(),
  service_address_line1: z.string().trim().optional(),
  service_postcode: z.string().trim().optional(),
  service_city: z.string().trim().optional(),
  service_area: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export interface RecurringActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  templateId?: string;
  occurrenceCount?: number;
}

export interface CancelRecurringSeriesState {
  ok: boolean;
  cancelledOccurrenceCount?: number;
  error?: string;
}

/** The jsonb `create_recurring_booking_series` returns — camelCase, as spelled. */
interface CreateRecurringSeriesResult {
  templateId: string;
  occurrenceCount: number;
  skippedCount: number;
  horizonThrough: string;
  firstOccurrenceDate: string;
  serviceName: string;
}

export async function createRecurringSeries(
  _previousState: RecurringActionState,
  formData: FormData
): Promise<RecurringActionState> {
  const supabase = await createSupabaseServerClient();
  const actor = await getStaffProfile(supabase);
  if (!actor || !actor.active || !canManageAllBookings(actor)) {
    return { error: "Insufficient permissions." };
  }

  const parsed = recurringSchema.safeParse({
    client_id: formData.get("client_id"),
    participant_gender: formData.get("participant_gender"),
    service_slug: formData.get("service_slug"),
    first_occurrence_date: formData.get("first_occurrence_date"),
    anchor_start_time: formData.get("anchor_start_time"),
    cadence: formData.get("cadence"),
    end_type: formData.get("end_type"),
    end_count: formData.get("end_count") || undefined,
    end_date: formData.get("end_date") || undefined,
    bound_therapist_id: formData.get("bound_therapist_id") || undefined,
    open_to_any_therapist: formData.get("open_to_any_therapist") === "on",
    service_address_line1: formData.get("service_address_line1") || undefined,
    service_postcode: formData.get("service_postcode") || undefined,
    service_city: formData.get("service_city") || undefined,
    service_area: formData.get("service_area") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return {
      error: "Check the recurring booking details.",
      fieldErrors: Object.fromEntries(
        Object.entries(z.flattenError(parsed.error).fieldErrors).map(
          ([key, value]) => [key, value?.[0] ?? "Invalid value."]
        )
      ),
    };
  }

  const adminClient = createSupabaseAdminClient();

  // Service-level opt-out. The RPC refuses too, but a PostgREST error message
  // is not something to put in front of an admin.
  const { data: service } = await adminClient
    .from("services")
    .select("id, allow_recurrence, name")
    .eq("slug", parsed.data.service_slug)
    .single();

  if (!service?.allow_recurrence) {
    return { error: `Recurring not available for ${service?.name ?? "this service"}.` };
  }

  // Monthly cadence + first-date day-of-month check. `anchor_day_of_month` is
  // CHECKed to 1..28 on the template, so day 29-31 would abort inside the RPC.
  if (parsed.data.cadence === "monthly") {
    const dayOfMonth = parseInt(parsed.data.first_occurrence_date.slice(8, 10), 10);
    if (dayOfMonth > 28) {
      return {
        error: "Monthly recurrence requires a day between 1 and 28.",
        fieldErrors: {
          first_occurrence_date:
            "Monthly recurrence requires a day between 1 and 28 to avoid month-end ambiguity.",
        },
      };
    }
  }

  const { data: rpcResult, error: rpcError } = await adminClient.rpc(
    "create_recurring_booking_series",
    {
      p_client_id: parsed.data.client_id,
      p_service_slug: parsed.data.service_slug,
      p_first_occurrence_date: parsed.data.first_occurrence_date,
      p_anchor_start_time: parsed.data.anchor_start_time,
      p_cadence: parsed.data.cadence,
      p_end_type: parsed.data.end_type,
      // Both gender columns take the participant's own gender, exactly as
      // `create_booking_request` does today (it writes one value into both).
      // `open_to_any_therapist` is orthogonal — it governs WHICH therapist,
      // never WHAT gender.
      p_participant_gender: parsed.data.participant_gender,
      p_required_therapist_gender: parsed.data.participant_gender,
      p_actor_staff_id: actor.id,
      p_bound_therapist_id: parsed.data.bound_therapist_id ?? null,
      p_open_to_any_therapist: parsed.data.open_to_any_therapist,
      p_end_count: parsed.data.end_count ?? null,
      p_end_date: parsed.data.end_date ?? null,
      p_service_address_line1: parsed.data.service_address_line1 ?? null,
      p_service_postcode: parsed.data.service_postcode ?? null,
      p_service_city: parsed.data.service_city ?? null,
      p_service_area: parsed.data.service_area ?? null,
      p_notes: parsed.data.notes ?? null,
      p_horizon_weeks: 12,
    }
  );

  if (rpcError) return { error: rpcError.message };

  const result = rpcResult as CreateRecurringSeriesResult;

  // No audit insert here: the RPC writes its own `recurring_series_created` row
  // against the template id, with a far richer after_state than this action
  // could assemble. A second row would double-count the event.

  // C-02 Phase D — fire-and-forget with .catch(), matching createManualBooking's
  // posture (actions.ts): a failed send must never roll back a series that was
  // already created successfully.
  await sendRecurringSeriesCreatedEmail(result.templateId, adminClient).catch((error) => {
    console.error("Unable to send recurring series created email.", error);
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");
  revalidatePath(`/admin/clients/${parsed.data.client_id}`);

  redirect(`/admin/bookings/series/${result.templateId}?created=1`);
}

export async function cancelRecurringSeries(
  _previousState: CancelRecurringSeriesState | null,
  formData: FormData
): Promise<CancelRecurringSeriesState> {
  const supabase = await createSupabaseServerClient();
  const actor = await getStaffProfile(supabase);
  if (!actor || !actor.active || !canManageAllBookings(actor)) {
    return { ok: false, error: "Insufficient permissions." };
  }

  const templateId = String(formData.get("template_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!templateId) return { ok: false, error: "Template ID is required." };

  const adminClient = createSupabaseAdminClient();
  const cancelledAt = new Date().toISOString();

  // 1. Mark the template cancelled. `.is("cancelled_at", null)` makes this the
  //    idempotency gate — a second submit updates no row and reports back.
  const { data: template, error: tmplErr } = await adminClient
    .from("recurring_booking_templates")
    .update({
      cancelled_at: cancelledAt,
      cancelled_by: actor.id,
      cancelled_reason: reason || null,
    })
    .eq("id", templateId)
    .is("cancelled_at", null)
    .select("id, client_id")
    .maybeSingle();

  if (tmplErr || !template) {
    return { ok: false, error: tmplErr?.message ?? "Template not found or already cancelled." };
  }

  // 2. Cascade-cancel future occurrences (today onwards).
  // S7 coordination (2026-07-16, C-04a amendment): stamp cancelled_at so the
  // cascaded visits honour the 28-day restore window like any other cancellation.
  const today = getTodayIsoDate();
  const { data: cancelledRows, error: cancelErr } = await adminClient
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: cancelledAt })
    .eq("recurring_template_id", templateId)
    .in("status", ["pending", "confirmed"])
    .gte("booking_date", today)
    .select("id");

  if (cancelErr) return { ok: false, error: cancelErr.message };

  // 3. Audit log. Unlike the create path there is no RPC here, so the row is
  //    this action's to write.
  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "recurring_series_cancelled",
    target_type: "recurring_booking_templates",
    target_id: templateId,
    after_state: {
      cancelled_at: cancelledAt,
      reason: reason || null,
      cascaded_occurrence_count: cancelledRows?.length ?? 0,
    },
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/series/${templateId}`);
  revalidatePath("/admin/calendar");
  revalidatePath(`/admin/clients/${template.client_id}`);

  return { ok: true, cancelledOccurrenceCount: cancelledRows?.length ?? 0 };
}
