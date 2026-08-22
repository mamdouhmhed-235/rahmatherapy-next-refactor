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
import {
  ServiceNotBookableError,
  assertServicesBookable,
} from "@/lib/booking/bookable-services";
import { checkSeriesSlots } from "@/lib/booking/availability";

/** ⛔ The RPC is called with  below; the availability
 *  pre-check derives its horizon from this same constant so the two cannot
 *  drift apart. */
const RECURRING_HORIZON_WEEKS = 12;

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
  // ⛔ D-042 FOLLOW-UP — THE OPERATOR'S OWN OVERRIDE, which this schema used to
  // drop on the floor.
  //
  // ⚠️ Found by independent review (D-035) immediately after the availability
  // check shipped, and it is the one refusal with no workaround inside the
  // feature. `ManualBookingForm.tsx:1274-1276` emits `override_availability`
  // from the SHARED hidden-input block — the single <form> that both actions
  // post, with only the action swapped — and `createManualBooking` reads it
  // (`actions.ts:1602`) and passes it to `create_booking_request`'s
  // `p_override_availability`.
  //
  // So before this line: "Mrs X, every Tuesday 8pm, the therapist has agreed to
  // stay late" could be booked as twelve separate visits with the override
  // ticked, and NOT as a series — the tick was in the FormData, silently
  // ignored, and the operator was told to pick a different time. ⛔ For a
  // two-therapist clinic that runs on late finishes and favours, that is the
  // change most likely to produce a "the system won't let me" call.
  override_availability: z.boolean(),
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
    // Same wire name and same truthiness gate as actions.ts:1602.
    override_availability: formData.get("override_availability") === "on",
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

  // ⛔ D-033 — A HIDDEN SERVICE MAY NOT START A NEW STANDING BOOKING.
  //
  // ⚠️ This was MISSED on the first pass and found by an independent review.
  // The one-off booking path was guarded inside `createBookingTransaction`, but
  // a recurring series does not go through it: it calls
  // `create_recurring_booking_series` directly, and that RPC filters services on
  // `is_active` alone — exactly the same half-filter as PR-011. So hiding a
  // service stopped one-off bookings and left standing ones wide open, which is
  // the opposite of "once its hidden then it should stay actually hidden".
  //
  // ⚠️ Deliberately placed on CREATION only. The nightly horizon cron that
  // extends an EXISTING series is left alone on purpose — hiding a service must
  // not silently cancel appointments a client already has in their diary.
  // Hiding stops new commitments; it does not break old ones.
  try {
    await assertServicesBookable([parsed.data.service_slug], adminClient);
  } catch (bookableError) {
    if (bookableError instanceof ServiceNotBookableError) {
      return {
        error: `${service.name} is hidden and cannot be booked. Make it visible again first.`,
      };
    }
    throw bookableError;
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

  // ⛔ D-042 — DO NOT PROMISE A SLOT THE CLINIC CANNOT COVER.
  //
  // Owner ruling D-042 (2026-08-22), chosen from three options: "fix it
  // properly". Until now a standing booking was placed BLIND: measured against
  // the live function body, `create_recurring_booking_series` contains zero
  // occurrences of `availability_rules`, `booking_status_enabled` or
  // `p_override_availability`. Its only test was "does this same client already
  // hold a booking at this date and time".
  //
  // ⛔ THE DATES ARE ASKED FOR, NOT GUESSED. `compute_occurrence_dates` is the
  // very function the create RPC uses to lay the series out, and it is
  // EXECUTE-granted to service_role — so the answer here is the same list the
  // RPC will materialise, by construction. Re-deriving the cadence walk in
  // TypeScript would have been a second date engine, and this repo has already
  // been bitten by two engines disagreeing (fix-list B5 / G-05-06).
  //
  // Both this horizon and the RPC argument come from RECURRING_HORIZON_WEEKS,
  // so the dates checked here are exactly the dates the RPC will lay out.
  const horizonThrough = new Date(`${parsed.data.first_occurrence_date}T00:00:00Z`);
  horizonThrough.setUTCDate(horizonThrough.getUTCDate() + RECURRING_HORIZON_WEEKS * 7 - 1);

  const { data: occurrenceDates, error: datesError } = await adminClient.rpc(
    "compute_occurrence_dates",
    {
      p_first_date: parsed.data.first_occurrence_date,
      p_cadence: parsed.data.cadence,
      p_horizon_end: horizonThrough.toISOString().slice(0, 10),
      p_end_type: parsed.data.end_type,
      p_end_count: parsed.data.end_count ?? null,
      p_end_date: parsed.data.end_date ?? null,
    }
  );

  if (datesError) return { error: datesError.message };

  const dates = (occurrenceDates as string[] | null) ?? [];
  if (dates.length === 0) {
    return { error: "That cadence and end condition produce no visits." };
  }

  const availability = await checkSeriesSlots(
    {
      dates,
      startTime: parsed.data.anchor_start_time,
      serviceIds: [parsed.data.service_slug],
      participantGenders: [parsed.data.participant_gender],
      // The engine keeps `city` on its input type but does not gate on it
      // (item 8 Phase 2 — a city outside the free-travel areas still gets
      // slots; the travel charge is an admin decision afterwards).
      city: parsed.data.service_city ?? "",
      boundStaffId: parsed.data.bound_therapist_id ?? null,
    },
    adminClient
  );

  // ⛔ THE FIRST VISIT IS THE FATAL ONE, AND THE REST DELIBERATELY ARE NOT.
  //
  // If the anchor cannot be covered, the whole ARRANGEMENT is wrong — nobody
  // works Tuesdays at 2pm, or the therapist the series is locked to does not.
  // Refusing is the only useful answer, and it is the systematic error worth
  // catching.
  //
  // ⚠️ A LATER date failing is a different thing: one bank holiday, or one
  // clash in week seven, must NOT throw away an arrangement the client wants
  // for the rest of the year. Those occurrences are created `pending` and
  // `unassigned`, which is exactly the state the bookings list's "attention"
  // view exists to surface, and the nightly horizon cron now refuses to
  // materialise uncoverable dates at all (D-042, same ruling).
  // ⛔ STATED PLAINLY SO NOBODY MISTAKES THIS FOR FULL COVERAGE: creating a
  // series still writes visits on later dates the clinic may not be able to
  // staff. They are visible and unassigned, not hidden.
  // ⛔ BOTH halves are fatal here, and for different reasons: no capacity at
  // all, OR the therapist this series was deliberately locked to being busy.
  // The cron treats the second case differently — see SeriesSlotVerdict.
  const anchorVerdict = availability.verdicts[0];
  const anchorBlocked =
    !anchorVerdict ||
    !anchorVerdict.available ||
    anchorVerdict.boundStaffFree === false;

  // ⛔ FAILS CLOSED: a MISSING verdict blocks too. `verdicts` is always the same
  // length as `dates` today — both the failure path and the normal path map over
  // `input.dates` — but the previous shape treated "no verdict" as "go ahead",
  // which is the wrong default for a check whose whole job is to refuse.
  //
  // ⚠️ …UNLESS the operator explicitly overrode availability. That tick is a
  // human saying "I know, the therapist has agreed" — the same authority
  // `createManualBooking` already grants it for a one-off booking. Refusing it
  // here would make the series path stricter than the path staff already use,
  // for no safety gain: nothing is auto-assigned at creation
  // (`assigned_staff_id` is NULL on every occurrence), so an overridden series
  // creates work a human must still pick up, exactly like an overridden
  // one-off.
  if (anchorBlocked && !parsed.data.override_availability) {
    // ⛔ OPTIONAL CHAINING, not `anchorVerdict.reason`. With no verdict at all
    // that member access THROWS — and ⛔ Next.js REDACTS a thrown server-action
    // message in production, so the operator would meet an opaque digest instead
    // of a refusal. Caught by the missing-verdict case in this action's own
    // suite, which failed on the crash rather than the message.
    const reason = anchorVerdict?.reason ?? "That time is not available.";
    return {
      error: `${reason} Pick a different day or time for the repeat visits.`,
      fieldErrors: { anchor_start_time: reason },
    };
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
      p_horizon_weeks: RECURRING_HORIZON_WEEKS,
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
 * The one place a series repricing is written to the audit log.
 *
 * ⛔ D-043 — extracted so the SUCCESS path and both FAILURE paths cannot drift
 * apart. Before this, only the success path wrote a row at all, which is how a
 * half-repriced series came to leave no trace whatsoever.
 *
 * ⛔ Deliberately keeps the EXISTING `recurring_series_travel_fee_updated`
 * action type rather than inventing a second one. `audit_logs.action_type` has
 * no CHECK constraint (measured), so a new value would have been accepted — and
 * been invisible to every report and query that already filters on this name. A
 * `partial_failure` key inside `after_state` says what happened without hiding
 * the event from the readers that exist.
 */
async function recordTravelFeeAudit(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  input: {
    actorStaffId: string;
    templateId: string;
    previousFee: number;
    nextFee: number;
    updated: number;
    skipped: number;
    attempted: number;
    partialFailure?: string;
  }
) {
  await adminClient.from("audit_logs").insert({
    actor_staff_id: input.actorStaffId,
    action_type: "recurring_series_travel_fee_updated",
    target_type: "recurring_booking_templates",
    target_id: input.templateId,
    before_state: { travel_fee: input.previousFee },
    after_state: {
      travel_fee: input.nextFee,
      updated_occurrence_count: input.updated,
      skipped_occurrence_count: input.skipped,
      ...(input.partialFailure
        ? {
            partial_failure: input.partialFailure,
            attempted_occurrence_count: input.attempted,
            // ⛔ States plainly, in the log, that the series-level figure did not
            // move — otherwise a reader would assume `travel_fee` above is what
            // the template now holds.
            template_fee_applied: false,
          }
        : { template_fee_applied: true }),
    },
  });
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

  // ⛔ D-043 — THE TEMPLATE'S OWN FEE IS WRITTEN LAST, NOT FIRST.
  //
  // It used to be written here, before the occurrence loop, and that turned an
  // ordinary mid-loop database failure into a state the operator could not get
  // out of. Found by independent review (D-035) and confirmed by reading the
  // control flow, not assumed:
  //
  //   1. the template's fee was committed up front;
  //   2. an occurrence update failed, and the `return` inside the loop below
  //      exits BEFORE the audit insert — so ⛔ NO audit row was written at all,
  //      and half the visits carried the new charge while half did not;
  //   3. the operator saw an error and retried with the same number;
  //   4. `previousFee` was now the NEW fee, so the no-op guard above matched and
  //      returned `{ ok: true, updated: 0 }`, and the screen said
  //      ⛔ "Travel charge saved. 0 upcoming visits updated."
  //
  // The half-priced visits could never be corrected through the UI. That is a
  // money defect the person at the desk cannot see, and cannot undo.
  //
  // ⛔ WHY MOVING THE WRITE FIXES IT, rather than merely hiding it. With the
  // template untouched until the end, a failed run leaves `previousFee` as it
  // was, so the retry does NOT hit the no-op guard — it re-runs and finishes the
  // job. And the retry is safe to repeat because `applyTravelFeeDelta` computes
  // each occurrence's delta from ITS OWN current fee: a visit already moved to
  // the new figure yields a delta of zero and is rewritten to the same values.
  // ⛔ The operation is idempotent, so "run it again" is now the correct and
  // sufficient recovery.
  //
  // ⚠️ The cost of this ordering, stated rather than glossed: if the loop
  // succeeds and the template write then fails, every occurrence carries the new
  // charge while the template still shows the old one — and the nightly
  // extend-recurring-horizons cron would create FUTURE visits at the old figure.
  // That is why the template write is checked below and reported as a failure
  // with an audit row, instead of being allowed to fall through quietly.

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

  // ⛔ THE UNCHANGED-FEE SHORT-CIRCUIT, AND WHY IT NOW LOOKS AT THE VISITS.
  //
  // It used to sit above the fetch and compare the template's fee alone. ⚠️ An
  // independent review (D-035) caught that moving the template write last —
  // the D-043 fix — had turned that guard into a NEW version of the very defect
  // D-043 removed, reached from the other side:
  //
  //   template £0 → operator sets £5 → visit 1 moves, visit 2 FAILS → the
  //   template is still £0 (that is the D-043 fix working) → the operator
  //   decides to UNDO rather than retry and types 0 → previousFee 0 === nextFee
  //   0 → "saved", nothing done → ⛔ VISIT 1 IS STILL CARRYING £5, invisibly,
  //   and typing the number that should clear it is the one number that cannot.
  //
  // ⛔ Measured, not reasoned about: `setSeriesTravelFee.test.ts` covers this
  // exact sequence and it FAILS against the guard's previous position.
  //
  // The template's figure alone was never a safe proxy for "the work is done".
  // The visits are. The short-circuit now fires only when the series fee is
  // unchanged AND every future visit already carries it — which is the real
  // question, and which also still costs nothing in the ordinary no-op case.
  const toUpdate = candidates.filter((booking) => {
    const due = Number(booking.amount_due ?? booking.total_price ?? 0);
    const paid = Number(booking.amount_paid ?? 0);
    return !(due > 0 && paid >= due);
  });

  // ⛔ THE PARTITION COMES FIRST, AND THE GUARD ASKS ABOUT `toUpdate`, NOT
  // `candidates`.
  //
  // ⚠️ A second D-035 pass caught this within the hour, and it was mine: the
  // first version tested `candidates.every(...)`, which INCLUDES fully-paid
  // visits. Those are deliberately never repriced, so they keep the old fee for
  // ever — meaning that for any series holding one fully-paid future visit the
  // short-circuit could never fire again. Every no-op re-save would then fall
  // through, rewrite the unpaid visits to the values they already had, rewrite
  // the template to its own value, and insert an audit row whose `before_state`
  // and `after_state` are identical. ⛔ AN AUDIT ROW RECORDING A CHANGE THAT DID
  // NOT HAPPEN is worse than no row: it is the log lying.
  //
  // `toUpdate` is the set the action would actually move, so "is the work
  // already done?" is exactly the question it answers.
  const feeUnchanged = toPence(previousFee) === toPence(nextFee);
  const everyTargetAlreadyAtFee = toUpdate.every(
    (booking) => toPence(Number(booking.travel_fee ?? 0)) === toPence(nextFee)
  );
  if (feeUnchanged && everyTargetAlreadyAtFee) {
    return { ok: true, updated: 0, skipped: 0 };
  }

  // Step 3: each occurrence moves by its own delta.
  //
  // ⛔ D-043 — a failure part-way through must leave a TRACE. The bare `return`
  // that used to sit here exited before the audit insert, so a half-repriced
  // series had no record of the repricing at all.
  const movedIds: string[] = [];
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

    if (occurrenceError) {
      await recordTravelFeeAudit(adminClient, {
        actorStaffId: actor.id,
        templateId,
        previousFee,
        nextFee,
        updated: movedIds.length,
        skipped: candidates.length - toUpdate.length,
        // ⛔ The template still holds `previousFee` at this point, so the series
        // is NOT half-changed at the template level and re-running finishes the
        // job. Recorded so a human reading the log knows the run stopped early
        // and how far it got.
        partialFailure: occurrenceError.message,
        attempted: toUpdate.length,
      });
      updateTag(TAGS.AUDIT);
      return {
        ok: false,
        error:
          `${occurrenceError.message} — ${movedIds.length} of ${toUpdate.length} visits were ` +
          `updated. Save the same amount again to finish the rest.`,
      };
    }
    movedIds.push(booking.id as string);
  }

  const updated = movedIds.length;
  const skipped = candidates.length - toUpdate.length;

  // ⛔ THE TEMPLATE'S FEE, LAST. See the note above the candidate fetch.
  const { error: writeError } = await adminClient
    .from("recurring_booking_templates")
    .update({ travel_fee: nextFee })
    .eq("id", templateId);

  if (writeError) {
    await recordTravelFeeAudit(adminClient, {
      actorStaffId: actor.id,
      templateId,
      previousFee,
      nextFee,
      updated,
      skipped,
      partialFailure: `occurrences updated but the series itself was not: ${writeError.message}`,
      attempted: toUpdate.length,
    });
    updateTag(TAGS.AUDIT);
    return {
      ok: false,
      error:
        `${writeError.message} — the ${updated} upcoming visit(s) were updated, but the series ` +
        `itself still carries the old charge. Save the same amount again.`,
    };
  }

  await recordTravelFeeAudit(adminClient, {
    actorStaffId: actor.id,
    templateId,
    previousFee,
    nextFee,
    updated,
    skipped,
    attempted: toUpdate.length,
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
