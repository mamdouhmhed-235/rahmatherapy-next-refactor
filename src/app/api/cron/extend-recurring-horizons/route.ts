// Cron handler — rolls the materialisation horizon of every active recurring
// series forward, creating the bookings that fall into the newly-covered window
// (C-02 Phase G).
//
// Invoked daily at 03:00 UTC by the Cloudflare scheduled() trigger via the
// WORKER_SELF_REFERENCE service binding (see worker-entrypoint.ts). Also
// reachable via curl during local development for smoke testing.
//
// Transport mirrors /api/cron/scheduled-emails and /api/cron/review-emails
// exactly — POST + X-Cron-Secret, Sentry on every error path, a JSON summary
// body the Worker logs verbatim.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE WALK STARTS AT THE SERIES ANCHOR. NEVER AT horizon_through_date.
// ─────────────────────────────────────────────────────────────────────────────
// Both the plan (Step 19) and the brief (§2.5) sketch resuming the occurrence
// walk from `horizon_through_date`. That is wrong, and wrong silently:
//
//   horizon_through_date = first_occurrence + (12 * 7) - 1 = anchor + 83 days.
//   83 mod 7 = 6 and 83 mod 14 = 13 — so the stored horizon always sits exactly
//   one cadence step MINUS ONE DAY past the last real occurrence.
//
// A weekly series anchored Fri 2026-09-04 has horizon 2026-11-26 and a last
// materialised visit of 2026-11-20. Resuming the walk from the horizon yields
// 2026-11-26 — a Thursday. Walking from the anchor yields 2026-11-27, the
// correct Friday. Every extended visit would land on the wrong weekday, for the
// life of the series, and the duplicate check keyed on (client, date, time)
// cannot catch it because the dates genuinely differ. No error is raised
// anywhere. Monthly drifts the same way off its day-of-month.
// Proven numerically in redesign/evidence/C-02/phase-b-rpc-verification.md §3.
//
// So: this handler replays the WHOLE occurrence sequence from the series anchor
// (the earliest booking_date carrying the template id) out to the new horizon,
// using the same deployed `compute_occurrence_dates` the create RPC uses, and
// then subtracts the dates that already exist. Replaying rather than resuming
// also means the end conditions need no separate bookkeeping:
//
//   • after_count — compute is given the series' TOTAL count and walks from the
//     anchor, so it can never return more than `end_count` dates; the already-
//     created ones are then filtered out. The series total cannot exceed the
//     count by construction, not by a counter this route maintains.
//   • until_date — compute clamps its own end to LEAST(end_date, horizon), so
//     nothing past the end date is ever a candidate.
//   • cancelled templates — excluded by the query's `cancelled_at IS NULL`.
//
// And it makes the route idempotent: a re-run creates nothing, and a template
// whose inserts partially failed is picked up and completed by the next run
// rather than being skipped forever.
//
// Concurrency: the plan asks for a per-template advisory lock. No advisory-lock
// primitive is reachable through PostgREST without a new SQL function, and a new
// function is a migration (Zone-2). The idempotent existence filter above is
// what stands in for it — two overlapping runs would both have to pass the same
// date through the filter in the same instant to duplicate anything, and this
// cron fires once a day. Logged for the progress file, deliberately not built.

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTodayIsoDate } from "@/app/admin/bookings/_helpers";

/**
 * Weeks of visibility every active series should carry. Matches
 * `create_recurring_booking_series`'s `p_horizon_weeks` default, including its
 * `- 1`: a horizon of `anchor + 12*7 - 1` is what yields the 12 weekly visits
 * the form promises. Keeping both conventions identical is what lets this route
 * hand a series back and forth with the create RPC without a seam.
 */
const HORIZON_WEEKS = 12;

/** One tick's worth of templates, oldest horizon first. */
const TEMPLATE_LIMIT = 100;

/**
 * Cap on the occurrence rows read back per series. A weekly `until_cancelled`
 * series reaches ~52/year, so 1000 is ~19 years. A series that actually hits the
 * cap is reported as a failure rather than extended: a truncated "already
 * exists" set would let this route recreate visits it cannot see.
 */
const SERIES_BOOKING_LIMIT = 1000;

interface ExtendSummary {
  /** Templates whose `horizon_through_date` was advanced this run. */
  templatesExtended: number;
  /** Bookings created across all templates. */
  occurrencesCreated: number;
  /**
   * Occurrence dates that were computed but NOT created — already materialised
   * for this series (including cancelled ones, which are never recreated), in
   * the past, or colliding with another booking the client already holds at that
   * date and time.
   */
  skipped: number;
}

function emptySummary(): ExtendSummary {
  return { templatesExtended: 0, occurrencesCreated: 0, skipped: 0 };
}

interface TemplateRow {
  id: string;
  client_id: string;
  service_id: string;
  bound_therapist_id: string | null;
  anchor_start_time: string;
  cadence: string;
  end_type: string;
  end_count: number | null;
  end_date: string | null;
  participant_gender: string;
  required_therapist_gender: string;
  service_address_line1: string | null;
  service_city: string | null;
  service_postcode: string | null;
  horizon_through_date: string;
}

interface TemplateOutcome {
  extended: boolean;
  created: number;
  skipped: number;
  failures: string[];
}

/** Pure UTC date arithmetic — no timezone can shift a plain calendar date here. */
function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * `HH:MM[:SS]` + minutes → `HH:MM:SS`, or null if it would cross midnight.
 * Mirrors the create RPC's `Booking must finish on the same day` guard: a
 * wrapped end_time would sort before its own start_time everywhere in the app.
 */
function addMinutesToTime(time: string, minutes: number): string | null {
  const [hours, mins] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  const total = hours * 60 + mins + minutes;
  if (total <= hours * 60 + mins || total >= 24 * 60) return null;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export async function POST(request: Request): Promise<Response> {
  // Auth gate — X-Cron-Secret must match CRON_SECRET env var. Same defense-in-
  // depth reasoning as booking-reminders: the Worker self-fetches and forwards
  // the secret, so the only way in from outside is to know it too.
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    const err = new Error("CRON_SECRET not configured.");
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Server misconfigured.", ...emptySummary(), failures: [] },
      { status: 500 }
    );
  }
  const headerSecret = request.headers.get("X-Cron-Secret");
  if (headerSecret !== expectedSecret) {
    return NextResponse.json(
      { error: "Unauthorized.", ...emptySummary(), failures: [] },
      { status: 401 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const today = getTodayIsoDate();
  const newHorizonThrough = addDaysIso(today, HORIZON_WEEKS * 7 - 1);

  // Due templates: still active, and not already covered out to the new horizon.
  const { data: templates, error: templatesError } = await supabase
    .from("recurring_booking_templates")
    .select(
      "id, client_id, service_id, bound_therapist_id, anchor_start_time, cadence, end_type, end_count, end_date, participant_gender, required_therapist_gender, service_address_line1, service_city, service_postcode, horizon_through_date"
    )
    .is("cancelled_at", null)
    .lt("horizon_through_date", newHorizonThrough)
    .order("horizon_through_date", { ascending: true })
    .limit(TEMPLATE_LIMIT);

  if (templatesError) {
    Sentry.captureException(templatesError);
    return NextResponse.json(
      { error: templatesError.message, ...emptySummary(), failures: [] },
      { status: 500 }
    );
  }

  const summary = emptySummary();
  // Every DB error below lands here rather than being swallowed. C-04a's cron
  // answered 200 {sent: 0} for a whole day while service_role held no UPDATE
  // grant and not one email left — a body indistinguishable from a healthy run.
  // A summary of three zeroes has exactly that failure mode, so the reasons
  // travel with it.
  const failures: string[] = [];

  for (const template of (templates ?? []) as TemplateRow[]) {
    const outcome = await extendTemplate(
      supabase,
      template,
      today,
      newHorizonThrough
    );
    if (outcome.extended) summary.templatesExtended++;
    summary.occurrencesCreated += outcome.created;
    summary.skipped += outcome.skipped;
    failures.push(...outcome.failures);
  }

  return NextResponse.json({ ...summary, failures }, { status: 200 });
}

async function extendTemplate(
  supabase: AdminClient,
  template: TemplateRow,
  today: string,
  newHorizonThrough: string
): Promise<TemplateOutcome> {
  const outcome: TemplateOutcome = {
    extended: false,
    created: 0,
    skipped: 0,
    failures: [],
  };
  const fail = (reason: string, error?: unknown) => {
    if (error) Sentry.captureException(error);
    outcome.failures.push(`${template.id}: ${reason}`);
    return outcome;
  };

  // 1. The series' own history. `booking_date` ascending gives the anchor as its
  //    first row, and the full set is what "already exists" means — cancelled
  //    occurrences included, so a visit the client cancelled is never recreated.
  const { data: seriesBookings, error: seriesError } = await supabase
    .from("bookings")
    .select("booking_date, consent_acknowledged")
    .eq("recurring_template_id", template.id)
    .order("booking_date", { ascending: true })
    .limit(SERIES_BOOKING_LIMIT);

  if (seriesError) return fail(`series read failed: ${seriesError.message}`, seriesError);
  if (!seriesBookings?.length) {
    // Nothing to walk from. The create RPC refuses to build a series with zero
    // visits, so this is a corrupted template rather than a normal state —
    // reported, and the horizon deliberately left alone.
    return fail("series has no materialised occurrences to derive its anchor from");
  }
  if (seriesBookings.length >= SERIES_BOOKING_LIMIT) {
    return fail(
      `series has ${seriesBookings.length}+ occurrences, above the ${SERIES_BOOKING_LIMIT} read cap — extending on a truncated history could duplicate visits`
    );
  }

  const rows = seriesBookings as {
    booking_date: string;
    consent_acknowledged: boolean | null;
  }[];
  const anchorDate = rows[0].booking_date;
  // Carried from the series' own first visit rather than assumed: the template
  // does not store consent, and inventing `true` here would give the extended
  // visits a stronger claim than the series was created under.
  const consentAcknowledged = rows[0].consent_acknowledged === true;
  const existingDates = new Set(rows.map((row) => row.booking_date));

  // 2. Replay the sequence from the ANCHOR — see this file's header. Calling the
  //    deployed function rather than re-implementing the walk in TypeScript is
  //    deliberate: monthly cadence clamps month-ends inside Postgres and an
  //    independent TS copy would be free to drift from it.
  const { data: computed, error: computeError } = await supabase.rpc(
    "compute_occurrence_dates",
    {
      p_first_date: anchorDate,
      p_cadence: template.cadence,
      p_horizon_end: newHorizonThrough,
      p_end_type: template.end_type,
      p_end_count: template.end_count,
      p_end_date: template.end_date,
    }
  );

  if (computeError) {
    return fail(`occurrence computation failed: ${computeError.message}`, computeError);
  }

  const computedDates = (computed ?? []) as string[];
  // ISO dates compare lexicographically, so `>= today` is a plain string test.
  // Past gaps are never backfilled — a missing date behind us is history, not
  // work.
  let candidates = computedDates.filter(
    (date) => date >= today && !existingDates.has(date)
  );
  outcome.skipped += computedDates.length - candidates.length;

  if (candidates.length === 0) {
    // Nothing to add: an exhausted after_count/until_date series, or one already
    // materialised out to the new horizon. Still advance the horizon — coverage
    // through that date is complete — but write no audit row, because nothing
    // happened.
    const advanced = await advanceHorizon(supabase, template.id, newHorizonThrough);
    if (advanced.error) {
      return fail(`horizon update failed: ${advanced.error}`, advanced.raw);
    }
    outcome.extended = advanced.matched;
    return outcome;
  }

  // 3. Everything the inserts need. Read fresh rather than copied off the last
  //    occurrence, so a corrected phone number or a re-priced service reaches
  //    the new visits.
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("full_name, email, phone")
    .eq("id", template.client_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (clientError) return fail(`client read failed: ${clientError.message}`, clientError);
  if (!client) return fail("client is missing or soft-deleted");

  const contactName = (client.full_name ?? "").trim() || null;
  const contactPhone = (client.phone ?? "").trim() || null;
  const contactEmail = (client.email ?? "").trim().toLowerCase() || null;
  // Both columns are NOT NULL on `bookings`. Without these two guards the insert
  // fails with a bare 23502 per occurrence, every night, forever.
  if (!contactName) return fail("client record has no name");
  if (!contactPhone) return fail("client record has no phone number");

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, name, price, duration_mins")
    .eq("id", template.service_id)
    .maybeSingle();

  if (serviceError) return fail(`service read failed: ${serviceError.message}`, serviceError);
  if (!service) return fail("service row is missing");

  const endTime = addMinutesToTime(template.anchor_start_time, service.duration_mins);
  if (!endTime) {
    return fail("booking would not finish on the same day it starts");
  }

  // 4. Bound therapist. Pre-assigned only if still active, still taking
  //    bookings, and still gender-eligible — the same three conditions the
  //    create RPC validates. Otherwise the visit is created unassigned, which is
  //    the documented degradation (brief §5.5), never a refusal to create it.
  let assignedStaffId: string | null = null;
  if (template.bound_therapist_id) {
    const { data: therapist, error: therapistError } = await supabase
      .from("staff_profiles")
      .select("id, active, can_take_bookings, gender")
      .eq("id", template.bound_therapist_id)
      .maybeSingle();

    if (therapistError) {
      // Not knowing is not the same as being ineligible: silently unassigning a
      // bound series because a read failed would look exactly like a therapist
      // going inactive.
      return fail(
        `bound therapist read failed: ${therapistError.message}`,
        therapistError
      );
    }
    if (
      therapist?.active &&
      therapist.can_take_bookings &&
      therapist.gender === template.required_therapist_gender
    ) {
      assignedStaffId = therapist.id;
    }
  }

  // 5. Same-client collision check, mirroring the create RPC's skip predicate:
  //    a date the client already holds at this time under some OTHER booking is
  //    skipped rather than double-booked. Cancelled and no-show bookings do not
  //    block, and neither do soft-deleted ones.
  const { data: conflicts, error: conflictError } = await supabase
    .from("bookings")
    .select("booking_date")
    .eq("client_id", template.client_id)
    .eq("start_time", template.anchor_start_time)
    .in("booking_date", candidates)
    .not("status", "in", "(cancelled,no_show)")
    .is("deleted_at", null);

  if (conflictError) {
    return fail(`conflict check failed: ${conflictError.message}`, conflictError);
  }

  if (conflicts?.length) {
    const conflicting = new Set(
      (conflicts as { booking_date: string }[]).map((row) => row.booking_date)
    );
    const before = candidates.length;
    candidates = candidates.filter((date) => !conflicting.has(date));
    outcome.skipped += before - candidates.length;
  }

  // 6. Materialise. Column lists mirror `create_recurring_booking_series`'s own
  //    inserts exactly, so an occurrence created tonight is indistinguishable
  //    from one created by the form.
  const createdDates: string[] = [];
  for (const date of candidates) {
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        client_id: template.client_id,
        contact_full_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        booking_source: "recurring",
        booking_date: date,
        start_time: template.anchor_start_time,
        end_time: endTime,
        total_duration_mins: service.duration_mins,
        total_price: service.price,
        amount_due: service.price,
        amount_paid: 0,
        payment_status: "unpaid",
        status: "pending",
        assignment_status: assignedStaffId ? "fully_assigned" : "unassigned",
        group_booking: false,
        consent_acknowledged: consentAcknowledged,
        service_address_line1: template.service_address_line1,
        service_city: template.service_city,
        service_postcode: template.service_postcode,
        recurring_template_id: template.id,
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      fail(`${date}: booking insert failed: ${bookingError?.message ?? "no row"}`, bookingError);
      continue;
    }

    const { data: participant, error: participantError } = await supabase
      .from("booking_participants")
      .insert({
        booking_id: booking.id,
        participant_gender: template.participant_gender,
        required_therapist_gender: template.required_therapist_gender,
        is_main_contact: true,
        display_name: contactName,
        consent_acknowledged: consentAcknowledged,
      })
      .select("id")
      .single();

    if (participantError || !participant) {
      // A booking with no participant, item or assignment reads as a real
      // appointment with no service on it and no one to send. Undo it rather
      // than leave that behind; the next run recreates the date cleanly.
      await rollbackOccurrence(supabase, booking.id);
      fail(
        `${date}: participant insert failed: ${participantError?.message ?? "no row"}`,
        participantError
      );
      continue;
    }

    const { error: itemError } = await supabase.from("booking_items").insert({
      booking_id: booking.id,
      booking_participant_id: participant.id,
      service_id: service.id,
      service_name_snapshot: service.name,
      service_price_snapshot: service.price,
      service_duration_snapshot: service.duration_mins,
    });

    if (itemError) {
      await rollbackOccurrence(supabase, booking.id);
      fail(`${date}: booking item insert failed: ${itemError.message}`, itemError);
      continue;
    }

    const { error: assignmentError } = await supabase
      .from("booking_assignments")
      .insert({
        booking_id: booking.id,
        participant_id: participant.id,
        assigned_staff_id: assignedStaffId,
        required_therapist_gender: template.required_therapist_gender,
        status: assignedStaffId ? "assigned" : "unassigned",
      });

    if (assignmentError) {
      await rollbackOccurrence(supabase, booking.id);
      fail(`${date}: assignment insert failed: ${assignmentError.message}`, assignmentError);
      continue;
    }

    createdDates.push(date);
    outcome.created++;
  }

  // 7. Advance the horizon even when some inserts failed: the walk starts at the
  //    anchor, so a date this run could not create is simply still missing next
  //    run and gets retried. What the horizon records is how far the series has
  //    been RECONCILED, not how many rows this particular run wrote.
  const advanced = await advanceHorizon(supabase, template.id, newHorizonThrough);
  if (advanced.error) {
    fail(`horizon update failed: ${advanced.error}`, advanced.raw);
    return outcome;
  }
  outcome.extended = advanced.matched;

  if (createdDates.length > 0) {
    const auditResult = await supabase.from("audit_logs").insert({
      action_type: "recurring_series_extended",
      target_type: "recurring_booking_templates",
      target_id: template.id,
      after_state: {
        template_id: template.id,
        series_anchor_date: anchorDate,
        cadence: template.cadence,
        end_type: template.end_type,
        occurrence_count: outcome.created,
        skipped_count: outcome.skipped,
        first_new_date: createdDates[0] ?? null,
        last_new_date: createdDates[createdDates.length - 1] ?? null,
        previous_horizon_through: template.horizon_through_date,
        horizon_through: newHorizonThrough,
        automated: true,
        cron_trigger: "extend-recurring-horizons-daily",
      },
    });
    if (auditResult.error) {
      Sentry.captureException(auditResult.error);
      outcome.failures.push(
        `${template.id}: audit insert failed: ${auditResult.error.message}`
      );
    }
  }

  return outcome;
}

/**
 * `.is("cancelled_at", null)` repeats the query's own filter so a series
 * cancelled while this run was mid-flight does not get its horizon pushed
 * forward underneath the cancellation. `matched` distinguishes that from a write
 * that was refused outright — the distinction C-04a collapsed.
 */
async function advanceHorizon(
  supabase: AdminClient,
  templateId: string,
  newHorizonThrough: string
): Promise<{ matched: boolean; error?: string; raw?: unknown }> {
  const { data, error } = await supabase
    .from("recurring_booking_templates")
    .update({ horizon_through_date: newHorizonThrough })
    .eq("id", templateId)
    .is("cancelled_at", null)
    .select("id");

  if (error) return { matched: false, error: error.message, raw: error };
  return { matched: Boolean(data?.length) };
}

/** Best-effort undo of a half-written occurrence. Children first, then the row. */
async function rollbackOccurrence(
  supabase: AdminClient,
  bookingId: string
): Promise<void> {
  await supabase.from("booking_assignments").delete().eq("booking_id", bookingId);
  await supabase.from("booking_items").delete().eq("booking_id", bookingId);
  await supabase.from("booking_participants").delete().eq("booking_id", bookingId);
  const { error } = await supabase.from("bookings").delete().eq("id", bookingId);
  if (error) Sentry.captureException(error);
}
