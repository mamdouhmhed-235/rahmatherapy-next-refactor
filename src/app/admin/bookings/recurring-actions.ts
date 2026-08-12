"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStaffProfile } from "@/lib/auth/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  sendRecurringSeriesCancelledEmail,
  sendRecurringSeriesCreatedEmail,
} from "@/lib/email/notifications";
import { canManageAllBookings } from "./access";
import { getTodayIsoDate } from "./_helpers";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import {
  applyTravelFeeDelta,
  parseTravelFee,
  toPence,
} from "@/lib/booking/travel-fee";

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
  // C-02 Phase E (Owner decision 2026-08-02) — the RPC defaults
  // `p_consent_acknowledged` to true, so without this gate a 12-visit series
  // would be created on weaker consent than the single booking
  // `createManualBooking` refuses without an explicit tick. Rejected here, and
  // the value is then passed to the RPC explicitly rather than defaulted.
  consent_acknowledged: z.literal(true, {
    error: "Confirm the consent box before creating repeat visits.",
  }),
  // Email-defect fix (2026-08-09) — the shared "Send confirmation email to
  // client" checkbox (ManualBookingForm.tsx step 4) already posts this field
  // on both submit paths, because the single-booking fields and
  // RecurringSection sit in one <form> with only the action swapped. This
  // schema simply never read it, so a series was emailed unconditionally
  // regardless of the operator's tick. Mirrors manualBookingSchema's
  // `sendConfirmationEmail` in ./actions.ts — same wire name ("on"/""), same
  // truthiness gate below.
  send_confirmation_email: z.boolean(),
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
    // The form emits "on"/"" from the same consent checkbox the single-booking
    // path uses — there is no second tick to keep in sync.
    consent_acknowledged: formData.get("consent_acknowledged") === "on",
    // Same for the confirmation-email checkbox — one tick, shared form.
    send_confirmation_email: formData.get("send_confirmation_email") === "on",
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
      p_consent_acknowledged: parsed.data.consent_acknowledged,
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
  //
  // Email-defect fix (2026-08-09) — gated on the operator's tick, mirroring
  // createManualBooking's `sendConfirmationEmail && details.email.trim()`
  // check (actions.ts ~:1689). There's no email string in this schema to
  // double-check against a hand-crafted post the way that path does — the
  // client's email lives in the DB, not in recurringSchema — so
  // sendRecurringSeriesCreatedEmail's own "client has no email address" guard
  // (it throws; caught below, same as any other send failure) plays that
  // role instead.
  if (parsed.data.send_confirmation_email) {
    await sendRecurringSeriesCreatedEmail(result.templateId, adminClient).catch((error) => {
      console.error("Unable to send recurring series created email.", error);
    });
  }

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.CLIENTS);
  updateTag(TAGS.AUDIT);
  updateTag(TAGS.EMAILS);
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

  // C-02 Phase Fb — fire-and-forget with .catch(), matching
  // createRecurringSeries's posture above: a failed send must never roll back
  // a cancellation that already succeeded.
  await sendRecurringSeriesCancelledEmail(
    templateId,
    cancelledRows?.length ?? 0,
    adminClient
  ).catch((error) => {
    console.error("Unable to send recurring series cancelled email.", error);
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.AUDIT);
  updateTag(TAGS.EMAILS);
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/series/${templateId}`);
  revalidatePath("/admin/calendar");
  revalidatePath(`/admin/clients/${template.client_id}`);

  return { ok: true, cancelledOccurrenceCount: cancelledRows?.length ?? 0 };
}

// ─── Item 8 Phase 4 — the series-level travel charge ─────────────────────────

export interface SetSeriesTravelFeeState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Future occurrences whose totals were adjusted. */
  updated?: number;
  /** Future occurrences left alone because they are already fully paid. */
  skipped?: number;
}

/**
 * Set the standing travel charge on a series.
 *
 * Deliberately NOT an extension of the disabled "Edit series" button, whose own
 * copy scopes it to cadence, address and therapist — price is a different
 * concern with a different safety story.
 *
 * Three things this has to get right:
 *
 *  1. **The fully-paid skip cannot be expressed as one PostgREST filter.**
 *     PostgREST compares a column to a LITERAL, never to another column, so
 *     there is no `.filter("amount_paid", "lt", "amount_due")` that works. The
 *     candidates are fetched, partitioned in application code, and only the
 *     unpaid ones updated.
 *  2. **Past, completed and cancelled occurrences are never touched.** They are
 *     financial history. Only `pending`/`confirmed` visits dated today onwards
 *     move.
 *  3. **Each occurrence's delta is computed from ITS OWN current fee**, not
 *     from the template's old one. A visit carrying a per-booking override has
 *     a different starting point, and using the template's figure would corrupt
 *     its total.
 */
export async function setSeriesTravelFee(
  _previousState: SetSeriesTravelFeeState | null,
  formData: FormData
): Promise<SetSeriesTravelFeeState> {
  const supabase = await createSupabaseServerClient();
  const actor = await getStaffProfile(supabase);
  if (!actor || !actor.active || !canManageAllBookings(actor)) {
    return { ok: false, error: "Insufficient permissions." };
  }

  const templateId = String(formData.get("template_id") ?? "").trim();
  if (!templateId) return { ok: false, error: "Template ID is required." };

  const nextFee = parseTravelFee(String(formData.get("travel_fee") ?? ""));
  if (nextFee === null) {
    return {
      ok: false,
      fieldErrors: {
        travel_fee: "Enter a travel charge of 0 or more, to the penny.",
      },
    };
  }

  const adminClient = createSupabaseAdminClient();

  const { data: template, error: templateError } = await adminClient
    .from("recurring_booking_templates")
    .select("id, client_id, travel_fee, cancelled_at")
    .eq("id", templateId)
    .maybeSingle();

  if (templateError || !template) {
    return { ok: false, error: templateError?.message ?? "Series not found." };
  }
  if (template.cancelled_at) {
    return { ok: false, error: "This series is cancelled." };
  }

  const previousFee = Number(template.travel_fee ?? 0);
  if (toPence(previousFee) === toPence(nextFee)) {
    return { ok: true, updated: 0, skipped: 0 };
  }

  const { error: writeError } = await adminClient
    .from("recurring_booking_templates")
    .update({ travel_fee: nextFee })
    .eq("id", templateId);

  if (writeError) return { ok: false, error: writeError.message };

  // Step 1 of the two-step: fetch the candidates.
  const today = getTodayIsoDate();
  const { data: candidateRows, error: candidateError } = await adminClient
    .from("bookings")
    .select("id, total_price, amount_due, amount_paid, travel_fee")
    .eq("recurring_template_id", templateId)
    .in("status", ["pending", "confirmed"])
    .gte("booking_date", today);

  if (candidateError) return { ok: false, error: candidateError.message };

  // Step 2: partition here, because the database cannot.
  const candidates = candidateRows ?? [];
  const toUpdate = candidates.filter((booking) => {
    const due = Number(booking.amount_due ?? booking.total_price ?? 0);
    const paid = Number(booking.amount_paid ?? 0);
    return !(due > 0 && paid >= due);
  });

  // Step 3: each occurrence moves by its own delta.
  for (const booking of toUpdate) {
    const folded = applyTravelFeeDelta({
      totalPrice: booking.total_price,
      amountDue: booking.amount_due,
      previousTravelFee: booking.travel_fee,
      nextTravelFee: nextFee,
    });

    const { error: occurrenceError } = await adminClient
      .from("bookings")
      .update({
        travel_fee: nextFee,
        total_price: folded.totalPrice,
        amount_due: folded.amountDue,
      })
      .eq("id", booking.id);

    if (occurrenceError) return { ok: false, error: occurrenceError.message };
  }

  const updated = toUpdate.length;
  const skipped = candidates.length - updated;

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "recurring_series_travel_fee_updated",
    target_type: "recurring_booking_templates",
    target_id: templateId,
    before_state: { travel_fee: previousFee },
    after_state: {
      travel_fee: nextFee,
      updated_occurrence_count: updated,
      skipped_occurrence_count: skipped,
    },
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/series/${templateId}`);
  revalidatePath("/admin/calendar");
  revalidatePath(`/admin/clients/${template.client_id}`);

  return { ok: true, updated, skipped };
}
