"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  sendBookingCreatedEmails,
  sendAssignedStaffBookingChangeEmails,
  sendBookingCancellationEmails,
  sendBookingConfirmedClientEmail,
  sendBookingMovedClientEmail,
  sendBookingRestoredClientEmail,
  sendClaimNotificationEmail,
  sendClientAssignedTherapistEmail,
  sendStaffAssignmentEmail,
  sendStaffUnassignmentEmail,
} from "@/lib/email/notifications";
import {
  ensureBookingManageUrl,
  // D-051 - the manage link's expiry is derived from the booking date, so
  // moving a booking has to move the expiry with it.
  getManageTokenExpiry,
} from "@/lib/booking/manage-token";
// D-051 - the SAME availability engine the recurring-series path uses, so the
// two cannot give different answers about the same slot.
import { checkSeriesSlots } from "@/lib/booking/availability";
import { addMinutesToTime } from "@/lib/time/london";
import {
  applyTravelFeeDelta,
  parseTravelFee,
  toPence,
} from "@/lib/booking/travel-fee";
import { canAssignBookings, getStaffProfile } from "@/lib/auth/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  BookingCreationError,
  DuplicateClientError,
  createBookingTransaction,
  type BookingSource,
} from "@/app/api/bookings/createBookingTransaction";
import {
  canClaimAssignments,
  canManageAllBookings,
  canManageBookings,
  ensureBookingActive,
} from "./access";
import {
  getClaimAssignmentEligibility,
  getStaffAssignmentPreviews,
} from "./assignment-eligibility";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import {
  CANCELLATION_UNDO_DELAY_SECONDS,
  COMPLETED_REVERSAL_MIN_REASON_LENGTH,
  TERMINAL_BOOKING_STATUS_FILTER,
  isBookingDateFutureLondon,
  isBookingMomentPastLondon,
  isCompletedReversal,
  isRestoreWindowExpired,
  isTerminalBookingStatus,
  getTodayIsoDate,
} from "./_helpers";
import type { AssignmentStatus, BookingStatus, PaymentMethod, PaymentStatus } from "./types";

export interface BookingUpdateState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

const BOOKING_STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];
const PAYMENT_STATUSES: PaymentStatus[] = ["paid", "unpaid"];
const PAYMENT_METHODS: PaymentMethod[] = ["cash", "card"];
const BOOKING_SOURCES: BookingSource[] = [
  "phone",
  "whatsapp",
  "facebook",
  "instagram",
  "referral",
  "admin",
  "other",
];
const OWN_ASSIGNMENT_STATUSES: AssignmentStatus[] = ["completed", "no_show"];
const RESTORE_TARGET_STATUSES = ["confirmed", "pending"] as const;
type RestoreTargetStatus = (typeof RESTORE_TARGET_STATUSES)[number];

/**
 * ⚠️ `bookings.cancelled_at` HAS ARRIVED — `20260728073903_c04a_scheduled_emails
 * .sql`. This comment used to read "arrives with C-04a's Phase F migration.
 * Until then the restore payload cannot clear it", which stopped being true the
 * day that migration shipped and stayed on the page for months (ITEM I.2).
 *
 * The retry below is KEPT ON PURPOSE and is not dead. It is what makes this
 * action survive a deploy against a database that has not been migrated yet —
 * app code and DDL ship on separate cadences here — so it degrades instead of
 * throwing. PostgREST rejects an unknown column with PGRST204, raw Postgres
 * with 42703. Same fallback shape as C-06's cascade in `clients/actions.ts`.
 */
const MISSING_COLUMN_CODES = new Set(["PGRST204", "42703"]);

function hasErrorCode(error: unknown, codes: Set<string>) {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && codes.has(code);
}

/**
 * The `restoreBooking` pre-image. The embedded `clients(deleted_at)` is the
 * whole point of naming the relation in the select — see the note there.
 */
interface RestoreBookingRecord {
  status: BookingStatus;
  booking_date: string;
  start_time: string;
  cancelled_at?: string | null;
  customer_cancelled_at: string | null;
  clients: { deleted_at: string | null } | null;
  [key: string]: unknown;
}

interface AssignmentClaimRecord {
  id: string;
  booking_id: string;
  assigned_staff_id: string | null;
  required_therapist_gender: "male" | "female";
  status: AssignmentStatus;
}

interface BookingAssignmentStatusRecord {
  assigned_staff_id: string | null;
  status: string;
}

async function requireBookingManager() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active || !canManageBookings(profile)) {
    return null;
  }

  return profile;
}

function canReassignBookings(profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>) {
  return canManageAllBookings(profile) && canAssignBookings(profile);
}

async function recomputeBookingAssignmentStatus(
  bookingId: string,
  adminClient: ReturnType<typeof createSupabaseAdminClient>
) {
  const { data: assignments, error } = await adminClient
    .from("booking_assignments")
    .select("assigned_staff_id, status")
    .eq("booking_id", bookingId)
    .returns<BookingAssignmentStatusRecord[]>();

  if (error || !assignments) {
    return { error: "Unable to update booking assignment status." };
  }

  const assignedCount = assignments.filter(
    (item) => item.assigned_staff_id && item.status !== "unassigned"
  ).length;
  const nextStatus =
    assignedCount === 0
      ? "unassigned"
      : assignedCount === assignments.length
        ? "fully_assigned"
        : "partially_assigned";

  const { error: bookingError } = await adminClient
    .from("bookings")
    .update({ assignment_status: nextStatus })
    .eq("id", bookingId);

  return bookingError ? { error: bookingError.message } : { status: nextStatus };
}

/**
 * C-04a Change 6 — once every assignment on a booking has reached a terminal
 * state AND at least one of them was actually completed, the visit is over and
 * the booking-level status should stop lagging behind it (B-168).
 * Capability-keyed, not role-keyed (brief §2.4): whoever finishes the last
 * assignment triggers this, therapist or not.
 *
 * Only ever promotes a booking that is neither already terminal nor still in
 * the future. `no_show` counts as terminal — see `TERMINAL_BOOKING_STATUSES`.
 * Both the predicate and the UPDATE's race guard read that one list.
 */
async function autoPromoteBookingFromAssignments(
  bookingId: string,
  triggeringActorStaffId: string,
  adminClient: ReturnType<typeof createSupabaseAdminClient>
): Promise<{ promoted: boolean; error?: string }> {
  const [{ data: assignments }, { data: bookingNow }] = await Promise.all([
    adminClient
      .from("booking_assignments")
      .select("assigned_staff_id, status")
      .eq("booking_id", bookingId)
      .returns<BookingAssignmentStatusRecord[]>(),
    adminClient
      .from("bookings")
      .select("status, booking_date")
      .eq("id", bookingId)
      .single<{ status: BookingStatus; booking_date: string | null }>(),
  ]);

  if (!assignments || !bookingNow) return { promoted: false };

  const allTerminal =
    assignments.length > 0 &&
    assignments.every(
      (assignment) =>
        assignment.assigned_staff_id &&
        (assignment.status === "completed" || assignment.status === "no_show")
    );
  // The status this promotes to is `completed`, so something has to have been
  // completed. A mix still promotes — one practitioner stood up, another seen,
  // and the visit happened (brief §2.4). But a booking where EVERY assignment
  // was a no-show is a visit nobody attended: recording it as `completed` would
  // put a visit that never happened into the client's history and the revenue
  // reports. Left in place for a human to classify.
  const anyCompleted = assignments.some(
    (assignment) => assignment.status === "completed"
  );
  if (!allTerminal || !anyCompleted) return { promoted: false };

  // Two preconditions on the booking itself, refused the same way: silently,
  // because the assignment write that got us here is legitimate and has already
  // landed. Terminal — leaving `completed`, `cancelled` or `no_show` owes an
  // audit action, a reason or a client email. Future-dated — W03-E-2, an
  // outcome cannot be recorded before the day it happens on. Neither
  // `updateOwnAssignmentStatus` nor the practitioner's own-work check looks at
  // the date, so without this a practitioner finishing next week's last
  // assignment today would complete the booking through a door
  // `quickUpdateBooking`'s `complete` chip holds shut. Same predicate as that
  // chip and the detail page's Mark-no-show button, deliberately.
  if (isTerminalBookingStatus(bookingNow.status)) return { promoted: false };
  if (isBookingDateFutureLondon(bookingNow)) return { promoted: false };

  // The WHERE guard is what makes two practitioners finishing at the same
  // moment safe: the second UPDATE matches 0 rows, so only one audit row and
  // one staff email follow (brief §5.4).
  //
  // `maybeSingle`, not `single`: 0 rows is the designed outcome of that guard,
  // and `single` reports it as a PGRST116 error, which would put the normal
  // race path into the caller's `console.error` and from there into Sentry.
  // `maybeSingle` leaves `error` null and `data` null, so the two cases below
  // stay distinguishable and only a genuine failure is reported.
  const { data: promoted, error } = await adminClient
    .from("bookings")
    .update({ status: "completed" })
    .eq("id", bookingId)
    .not("status", "in", TERMINAL_BOOKING_STATUS_FILTER)
    .select("status")
    .maybeSingle<{ status: BookingStatus }>();

  if (error) return { promoted: false, error: error.message };
  // The race guard matched nothing — handled, not a failure.
  if (!promoted) return { promoted: false };

  // `before_state.status` is the status read a round trip earlier, not the one
  // the UPDATE actually replaced. If someone confirms the booking in that gap,
  // this records `pending` where the truth was `confirmed`. Left as-is:
  // PostgREST cannot return an UPDATE's pre-image (no RETURNING OLD), re-reading
  // after the write only ever yields `completed`, and tightening the guard to
  // `.eq("status", bookingNow.status)` would trade the inaccuracy for a lost
  // promotion — the booking would stay `confirmed` with every assignment closed
  // and nothing left to re-trigger this. The concurrent writer's own
  // `booking_management_updated` row carries the true transition with an earlier
  // timestamp, so the log as a whole stays reconstructable.
  await adminClient.from("audit_logs").insert({
    actor_staff_id: triggeringActorStaffId,
    action_type: "booking_auto_promoted_completed",
    target_type: "bookings",
    target_id: bookingId,
    before_state: { status: bookingNow.status },
    after_state: {
      status: "completed",
      trigger: "all_assignments_terminal",
      assignment_statuses: assignments.map((assignment) => assignment.status),
    },
  });

  // Staff awareness only — auto-promote follows a real visit, so the client
  // already knows how it went (brief §2.4).
  await sendAssignedStaffBookingChangeEmails(
    bookingId,
    adminClient,
    "Booking auto-completed — all assignments are complete."
  ).catch((emailError) => {
    console.error("Unable to send auto-promote staff email.", emailError);
  });

  return { promoted: true };
}

export async function updateBookingManagement(
  _previousState: BookingUpdateState,
  formData: FormData
): Promise<BookingUpdateState> {
  const actor = await requireBookingManager();
  if (!actor) return { error: "Insufficient permissions." };
  if (!canManageAllBookings(actor)) return { error: "Insufficient permissions." };

  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const status = String(formData.get("status") ?? "") as BookingStatus;
  const paymentStatus = String(
    formData.get("payment_status") ?? ""
  ) as PaymentStatus;
  const paymentMethodValue = String(formData.get("payment_method") ?? "");
  const paymentMethod = paymentMethodValue as PaymentMethod;
  const adminNotes = String(formData.get("admin_notes") ?? "").trim();
  const treatmentNotes = String(formData.get("treatment_notes") ?? "").trim();
  const customerManageNotes = String(
    formData.get("customer_manage_notes") ?? ""
  ).trim();
  const amountPaidValue = String(formData.get("amount_paid") ?? "").trim();
  const paymentNote = String(formData.get("payment_note") ?? "").trim();
  const fieldErrors: Record<string, string> = {};
  const amountPaid = amountPaidValue ? Number(amountPaidValue) : 0;
  // Item 8 Phase 3. Absent (not empty) means the form never carried the field —
  // the notes forms re-post a subset — so only a submitted value can change the
  // fee. An empty submitted field means "no charge", which is 0, not an error.
  const travelFeeRaw = formData.get("travel_fee");
  const travelFeeSubmitted = travelFeeRaw !== null;
  const travelFeeInput = travelFeeSubmitted
    ? parseTravelFee(String(travelFeeRaw))
    : null;

  if (!bookingId) fieldErrors.booking_id = "Booking is required.";
  if (!BOOKING_STATUSES.includes(status)) {
    fieldErrors.status = "Choose a valid booking status.";
  }
  if (!PAYMENT_STATUSES.includes(paymentStatus)) {
    fieldErrors.payment_status = "Choose a valid payment status.";
  }
  if (
    paymentStatus === "paid" &&
    !PAYMENT_METHODS.includes(paymentMethod)
  ) {
    fieldErrors.payment_method = "Choose cash or card for paid bookings.";
  }
  if (
    paymentMethodValue &&
    !PAYMENT_METHODS.includes(paymentMethod)
  ) {
    fieldErrors.payment_method = "Choose a valid payment method.";
  }
  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    fieldErrors.amount_paid = "Enter a valid amount paid.";
  }
  if (travelFeeSubmitted && travelFeeInput === null) {
    fieldErrors.travel_fee =
      "Enter a travel charge of 0 or more, to the penny.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();

  if (!beforeState) return { error: "Booking not found." };

  // ── Item 8 Phase 3 — the travel charge ────────────────────────────────────
  // Evaluated against the booking as it stands BEFORE this submit, so setting
  // the fee and marking the visit paid in the same save still works. Only a
  // CHANGED fee is gated: an unchanged one re-posted alongside a note edit on a
  // completed booking must still go through. Cancelled is deliberately NOT
  // locked — a cancelled booking is not financial history.
  const previousTravelFee = Number(beforeState.travel_fee ?? 0);
  const travelFeeChanged =
    travelFeeInput !== null &&
    toPence(travelFeeInput) !== toPence(previousTravelFee);

  if (travelFeeChanged) {
    // Falls back to total_price, mirroring quickUpdateBooking's own idiom.
    // amount_due is independently nullable: a booking with total_price 90 and
    // amount_paid 90 but a null amount_due IS fully paid, and a bare `?? 0`
    // would compute 0 > 0 === false and let the fee change through.
    const previousAmountDue = Number(
      beforeState.amount_due ?? beforeState.total_price ?? 0
    );
    const previousAmountPaid = Number(beforeState.amount_paid ?? 0);
    const wasFullyPaid =
      previousAmountDue > 0 && previousAmountPaid >= previousAmountDue;

    if (beforeState.status === "completed") {
      return {
        fieldErrors: {
          travel_fee:
            "This booking is completed — the travel charge can no longer be changed.",
        },
      };
    }
    if (wasFullyPaid) {
      return {
        fieldErrors: {
          travel_fee:
            "This booking is fully paid — the travel charge can no longer be changed.",
        },
      };
    }
  }

  // The fee is folded INTO the stored totals as a delta, never summed by a
  // reader and never re-derived from service price x participants. See
  // src/lib/booking/travel-fee.ts for why this is integer pence.
  const travelFeeUpdate =
    travelFeeChanged && travelFeeInput !== null
      ? (() => {
          const folded = applyTravelFeeDelta({
            totalPrice: beforeState.total_price,
            amountDue: beforeState.amount_due,
            previousTravelFee,
            nextTravelFee: travelFeeInput,
          });
          return {
            travel_fee: travelFeeInput,
            total_price: folded.totalPrice,
            amount_due: folded.amountDue,
          };
        })()
      : {};

  // State-machine guard (C-04a Phase B): leaving `completed` is a
  // mistake-correction path, not a routine status edit, so it needs the Status
  // form's confirm modal to send an explicit force flag plus a reason. Every
  // other transition — including the notes forms, which re-post the booking's
  // own status unchanged — passes straight through.
  const completedReversalReason = String(
    formData.get("completed_reversal_reason") ?? ""
  ).trim();

  if (isCompletedReversal(beforeState.status, status)) {
    if (formData.get("force_completed_reversal") !== "on") {
      return {
        error: "Reopening a completed booking requires confirmation.",
        fieldErrors: {
          status: "Use Restore on the next-action strip — or confirm via the modal.",
        },
      };
    }
    if (completedReversalReason.length < COMPLETED_REVERSAL_MIN_REASON_LENGTH) {
      return {
        error: "Reopening a completed booking requires a reason.",
        fieldErrors: {
          completed_reversal_reason: `Provide a reason (min ${COMPLETED_REVERSAL_MIN_REASON_LENGTH} chars).`,
        },
      };
    }
  }

  // W03-E-2 (C-04a) — an outcome cannot be recorded before the day it happens
  // on. The Status dropdown offers `completed` and `no_show` on every booking,
  // so without this the form is the way round a refusal `quickUpdateBooking`'s
  // chips and the auto-promoter both carry: same predicate, same words, so the
  // three paths cannot drift. Keyed on the status being written, not on the
  // transition — `pending`, `confirmed` and `cancelled` stay settable on a
  // future-dated booking, and cancelling one ahead of time (the ordinary case)
  // still emails the client. The Notes forms re-post the booking's own status,
  // but a future-dated booking cannot be sitting at `completed` or `no_show`
  // for them to re-post: nothing creates one there and, with this guard, no
  // write path can move one there either.
  if (
    (status === "completed" || status === "no_show") &&
    isBookingDateFutureLondon(beforeState)
  ) {
    return {
      error:
        "This booking is in the future. Mark complete or no-show after the appointment time.",
    };
  }

  // C-04a Phase H — one predicate for the two things that must never disagree:
  // the `cancelled_at` stamp the S7 restore window is measured from, and the
  // delayed customer email the admin's Undo cancels. Read from the status being
  // written, not from the returned row, so the stamp and the send are decided
  // by the same expression. Only the way IN to `cancelled` counts: both Notes
  // forms re-post the booking's own status through `HiddenStatusPayload`, and a
  // notes save on an already-cancelled booking must not restart the window.
  const isCancellationTransition =
    beforeState.status !== "cancelled" && status === "cancelled";

  // The mirror image, and the one this form was missing. The Status dropdown is
  // a second way OUT of `cancelled`, and until now it left without touching the
  // email the cancellation queued: admin cancels here, the toast expires after
  // its undo window, admin changes their mind and drives the same dropdown back
  // to Confirmed — and the queued row survives, so the cron sends the client a
  // cancellation for a booking that is live again.
  //
  // Deliberately NOT gated on S6 (past appointment moment) or S7 (28-day
  // window), and deliberately not delegated to `restoreBooking`. Either would
  // remove the Status form as the admin's escape hatch out of a terminal status,
  // which is a separate decision the Owner has not made. This closes the email
  // hole only.
  const isCancellationExit =
    beforeState.status === "cancelled" && status !== "cancelled";

  const payload = {
    ...travelFeeUpdate,
    status,
    payment_status: paymentStatus,
    payment_method:
      paymentStatus === "paid" && paymentMethodValue ? paymentMethod : null,
    amount_paid: amountPaid,
    paid_at:
      paymentStatus === "paid" && beforeState.payment_status !== "paid"
        ? new Date().toISOString()
        : paymentStatus === "paid"
          ? beforeState.paid_at
          : null,
    payment_note: paymentNote || null,
    admin_notes: adminNotes || null,
    treatment_notes: treatmentNotes || null,
    customer_manage_notes: customerManageNotes || null,
    // S7 — stamped in the SAME UPDATE that writes `status = 'cancelled'`. A
    // second round trip could leave a cancelled booking with no cancellation
    // moment, and `isRestoreWindowExpired` fails closed on that: the Restore
    // affordance would vanish from a booking cancelled seconds ago. Cancelling
    // again after a restore re-stamps, which restarts the 28 days.
    ...(isCancellationTransition
      ? { cancelled_at: new Date().toISOString() }
      : {}),
    // …and cleared on the way back out, mirroring `restoreBooking`'s payload
    // builder field for field: all three cancellation columns are stale the
    // moment the booking stops being cancelled, and a live booking still
    // carrying a cancellation moment is what `getCancellationMoment` reads. No
    // PGRST204 fallback here, unlike `restoreBooking`: this function already
    // writes `cancelled_at` unconditionally on the way IN, so the column is a
    // hard requirement of this path either way.
    ...(isCancellationExit
      ? {
          cancelled_at: null,
          customer_cancelled_at: null,
          customer_cancellation_note: null,
        }
      : {}),
  };

  const { data, error } = await adminClient
    .from("bookings")
    .update(payload)
    .eq("id", bookingId)
    .select()
    .single();

  if (error) return { error: error.message };

  // Kill any cancellation email still sitting in the undo window. Identical
  // filters to `restoreBooking`'s sweep, and identically free of a
  // `scheduled_for` condition: `delivery_status = 'queued'` is the whole test
  // for "not yet sent", because the cron claims a row out of `queued` before it
  // dispatches. Adding the timestamp back would miss every row that is already
  // due but not yet drained — up to a minute's worth — which is exactly the
  // window this sweep exists for.
  let cancelledQueuedEmail = false;
  let cancelledQueuedEmailSweepError: string | undefined;

  if (isCancellationExit) {
    const { count, error: sweepError } = await adminClient
      .from("email_delivery_events")
      .update({ delivery_status: "cancelled_by_restore" }, { count: "exact" })
      .eq("booking_id", bookingId)
      .eq("event_type", "booking_cancellation_customer")
      .eq("delivery_status", "queued");

    if (sweepError) {
      // Fails closed the only way this path can. `restoreBooking` fails closed
      // by suppressing its client email; there is no client email on this path
      // to suppress, so the anomaly is recorded as itself — in the audit row
      // below, which is the durable record, plus this Cloudflare log line. An
      // errored sweep says nothing about whether the cancellation is still
      // queued, so it must never be read as "nothing was queued".
      console.error(
        "Unable to sweep queued cancellation emails while leaving cancelled.",
        sweepError
      );
      cancelledQueuedEmailSweepError = sweepError.message;
    }
    cancelledQueuedEmail = (count ?? 0) > 0;
  }

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "booking_management_updated",
    target_type: "bookings",
    target_id: bookingId,
    before_state: beforeState,
    // The reopen reason only exists once the guard above has accepted it, so
    // folding it into `after_state` is what makes the audit row explain itself.
    after_state: {
      ...data,
      ...(completedReversalReason
        ? { completed_reversal_reason: completedReversalReason }
        : {}),
      // Same two keys `restoreBooking` writes, so the two paths that can suppress
      // a client's cancellation are queryable as one. Only attached when the
      // sweep actually ran: on every other save these keys would be noise.
      ...(isCancellationExit
        ? {
            cancelled_queued_email: cancelledQueuedEmail,
            // Carried verbatim, never coerced: an error whose message is ""
            // must still record that the sweep failed, rather than serialising
            // to a row byte-identical to the healthy "nothing was queued" case.
            cancelled_queued_email_sweep_error: cancelledQueuedEmailSweepError,
          }
        : {}),
    },
  });

  if (isCancellationTransition) {
    await sendBookingCancellationEmails(bookingId, adminClient, {
      initiatedBy: "admin",
      // C-08 Phase D — skip-self: the cancelling admin doesn't get a
      // business alert about their own cancellation.
      actorStaffId: actor.id,
      // Change 14 — the customer leg is parked in `email_delivery_events` as
      // `queued` for this many seconds instead of being sent now; the admin and
      // assigned-staff legs still go immediately. That gap is exactly the window
      // the Undo toast lives in, and a restore inside it sweeps the queued row
      // to `cancelled_by_restore` so the client never hears about a booking that
      // is still on. The toast's `duration` in BookingRowActions.tsx and
      // BookingManagementForm.tsx is derived from this same constant.
      //
      // The queued row is only drained by the scheduled-emails cron, so a
      // cancellation email now depends on that cron running — and the cron is
      // minute-granular, so the real delay is this plus up to another minute.
      // No user-facing string may name a number of seconds because of it.
      delaySeconds: CANCELLATION_UNDO_DELAY_SECONDS,
    }).catch((error) => {
      console.error("Unable to send booking cancellation emails.", error);
    });
  } else if (beforeState.status !== data.status) {
    await sendAssignedStaffBookingChangeEmails(
      bookingId,
      adminClient,
      `Booking status changed from ${beforeState.status} to ${data.status}.`
    ).catch((error) => {
      console.error("Unable to send assigned staff change emails.", error);
    });
  }

  // C-08: booking_confirmed_client on pending → confirmed
  if (beforeState.status === "pending" && data.status === "confirmed") {
    await sendBookingConfirmedClientEmail(bookingId, adminClient).catch((error) => {
      console.error("Unable to send booking_confirmed_client email.", error);
    });
  }

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.AUDIT);
  updateTag(TAGS.EMAILS);
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");

  return { success: true };
}

export async function claimBookingAssignment(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const actor = await getStaffProfile(supabase);

  if (!actor || !canClaimAssignments(actor)) {
    return { error: "Insufficient permissions." };
  }

  const assignmentId = String(formData.get("assignment_id") ?? "").trim();
  if (!assignmentId) return { error: "Assignment is required." };

  const adminClient = createSupabaseAdminClient();
  const { data: assignment, error: assignmentError } = await adminClient
    .from("booking_assignments")
    .select("id, booking_id, assigned_staff_id, required_therapist_gender, status")
    .eq("id", assignmentId)
    .single<AssignmentClaimRecord>();

  if (assignmentError || !assignment) {
    return { error: "Assignment not found." };
  }

  if (assignment.status !== "unassigned" || assignment.assigned_staff_id) {
    return { error: "This assignment has already been claimed." };
  }

  if (assignment.required_therapist_gender !== actor.gender) {
    return { error: "You cannot claim an assignment for another therapist gender." };
  }

  // C-05 Phase B, Step 4 — cancelled / no_show / past-dated bookings are inert;
  // this replaces the old status-blind SELECT with the shared active-booking gate.
  const activityCheck = await ensureBookingActive(assignment.booking_id, adminClient);
  if (!activityCheck.active) {
    return { error: activityCheck.message };
  }
  const booking = activityCheck.booking;

  const eligibility = await getClaimAssignmentEligibility({
    actor,
    assignment,
    booking,
    supabase: adminClient,
  });

  if (!eligibility.eligible) {
    return { error: eligibility.reason };
  }

  const { data: claimedAssignment, error: claimError } = await adminClient
    .from("booking_assignments")
    .update({
      assigned_staff_id: actor.id,
      status: "assigned",
    })
    .eq("id", assignmentId)
    .eq("status", "unassigned")
    .is("assigned_staff_id", null)
    .select("id, booking_id, assigned_staff_id, required_therapist_gender, status")
    .single<AssignmentClaimRecord>();

  if (claimError || !claimedAssignment) {
    return { error: "This assignment has already been claimed." };
  }

  const { data: bookingAssignments, error: bookingAssignmentsError } =
    await adminClient
      .from("booking_assignments")
      .select("assigned_staff_id, status")
      .eq("booking_id", claimedAssignment.booking_id)
      .returns<BookingAssignmentStatusRecord[]>();

  if (bookingAssignmentsError || !bookingAssignments) {
    return { error: "Unable to update booking assignment status." };
  }

  const assignedCount = bookingAssignments.filter(
    (item) => item.assigned_staff_id && item.status !== "unassigned"
  ).length;
  const nextBookingAssignmentStatus =
    assignedCount === 0
      ? "unassigned"
      : assignedCount === bookingAssignments.length
        ? "fully_assigned"
        : "partially_assigned";

  const { data: updatedBooking, error: bookingError } = await adminClient
    .from("bookings")
    .update({ assignment_status: nextBookingAssignmentStatus })
    .eq("id", claimedAssignment.booking_id)
    .select()
    .single();

  if (bookingError) {
    return { error: bookingError.message };
  }

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "booking_assignment_claimed",
    target_type: "booking_assignments",
    target_id: assignmentId,
    before_state: assignment,
    after_state: {
      assignment: claimedAssignment,
      booking: updatedBooking,
    },
  });

  await sendStaffAssignmentEmail(
    claimedAssignment.booking_id,
    actor.email,
    adminClient,
    actor.id
  ).catch((error) => {
    console.error("Unable to send staff assignment email.", error);
  });

  // C-08: claim notification to the admin recipient (Phase-A interim — see
  // sendClaimNotificationEmail in notifications.ts for the Phase D reroute).
  await sendClaimNotificationEmail(
    claimedAssignment.booking_id,
    actor.id,
    adminClient
  ).catch((error) => {
    console.error("Unable to send claim notification email.", error);
  });

  // C-08: client_assigned_therapist — a claim IS a new assignment, so the
  // client is told who they got.
  await sendClientAssignedTherapistEmail(
    claimedAssignment.booking_id,
    actor.id,
    adminClient
  ).catch((error) => {
    console.error("Unable to send client_assigned_therapist email.", error);
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.STAFF);
  updateTag(TAGS.AUDIT);
  updateTag(TAGS.EMAILS);
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${claimedAssignment.booking_id}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");

  return { success: true };
}

export async function quickUpdateBooking(formData: FormData) {
  const actor = await requireBookingManager();
  if (!actor || !canManageAllBookings(actor)) {
    return { error: "Insufficient permissions." };
  }

  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();

  // C-04a Phase G (Change 11) — `restore` is not a chip-shaped status write.
  // It owns the S6 past-moment and S7 window guards, the deleted-client refusal,
  // the `booking_restored` audit action, the queued-cancellation-email sweep and
  // the "your booking is back on" client email. Delegating rather than adding a
  // branch to the payload switch below is what stops the row menu from becoming
  // a second, weaker way out of a terminal status — the exact hole the four
  // terminal-state guards were added to close.
  if (action === "restore") return restoreBooking(formData);

  if (!bookingId) return { error: "Booking is required." };

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();

  if (!beforeState) return { error: "Booking not found." };

  // W03-E-2 — an outcome cannot be recorded before the day it happens on.
  const isFutureDated = isBookingDateFutureLondon(beforeState);

  const amountDue = Number(beforeState.amount_due ?? beforeState.total_price ?? 0);
  // S7 (C-04a Phase H) — the cancellation moment the 28-day restore window is
  // measured from, written in the same UPDATE as the status so a cancelled
  // booking can never exist without one (`isRestoreWindowExpired` fails closed
  // on a missing stamp, which would hide Restore on a booking cancelled a moment
  // ago). Empty when the booking is already cancelled: a second `cancel` post
  // must not silently extend the window. Cancelling again after a restore does
  // re-stamp, which is the intended restart.
  const cancelledAtStamp: { cancelled_at?: string } =
    beforeState.status === "cancelled"
      ? {}
      : { cancelled_at: new Date().toISOString() };
  const payload =
    action === "confirm"
      ? { status: "confirmed" as BookingStatus }
      : action === "mark_paid"
        ? {
            payment_status: "paid" as PaymentStatus,
            payment_method: beforeState.payment_method ?? ("cash" as PaymentMethod),
            amount_paid: amountDue,
            paid_at: beforeState.paid_at ?? new Date().toISOString(),
          }
        : action === "cancel"
          ? { status: "cancelled" as BookingStatus, ...cancelledAtStamp }
          : action === "complete"
            ? isFutureDated
              ? null
              : { status: "completed" as BookingStatus }
            : action === "no_show"
              ? isFutureDated
                ? null
                : { status: "no_show" as BookingStatus }
              : null;

  if (!payload) {
    if (isFutureDated && (action === "complete" || action === "no_show")) {
      return {
        error:
          "This booking is in the future. Mark complete or no-show after the appointment time.",
      };
    }
    return { error: "Unsupported booking action." };
  }

  // `completed`, `cancelled` and `no_show` are terminal for the one-click
  // chips: leaving any of them is a mistake-correction that owes an
  // explanation, and a chip has nowhere to capture one — Phase B put reopening
  // a completed booking behind the Status form's force flag plus a reason, and
  // the same form is the way back out of the two inert statuses. The guard
  // reads the status the write would set rather than the action name, so it
  // cannot drift from the payload above; `mark_paid` sets no status and is
  // therefore untouched.
  //
  // Three branches rather than one expression because the rules genuinely
  // differ: `completed` and `no_show` refuse every move out of themselves —
  // `restoreBooking`, not a chip, owns the way back to `confirmed` — while
  // `cancelled` is closed here only against `completed`. Each refusal names its
  // own source status.
  //
  // Owner-approved 2026-07-28 as a deviation from plan §2's UNCHANGED list:
  // `cancel` on a completed booking was one click from a real customer
  // cancellation email, `complete` on a cancelled one bypassed restore,
  // `cancel` on a no-show booking fired that customer email too, and `confirm`
  // on a no-show booking silently un-did it — skipping restore's past-moment
  // guard, its `booking_restored` audit action and its client email.
  const nextStatus = "status" in payload ? payload.status : null;

  if (nextStatus && isCompletedReversal(beforeState.status, nextStatus)) {
    return {
      error:
        "This booking is completed. Reopen it from the Status & payment form, which records a reason.",
    };
  }

  if (nextStatus === "completed" && beforeState.status === "cancelled") {
    return {
      error:
        "This booking is cancelled. Reopen it from the Status & payment form before marking it complete.",
    };
  }

  if (nextStatus && beforeState.status === "no_show" && nextStatus !== "no_show") {
    return {
      error:
        "This booking is marked no-show. Use Restore on the next-action strip to put it back, or the Status & payment form to change it any other way.",
    };
  }

  const { data: updatedBooking, error } = await adminClient
    .from("bookings")
    .update(payload)
    .eq("id", bookingId)
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: `booking_quick_${action}`,
    target_type: "bookings",
    target_id: bookingId,
    before_state: beforeState,
    after_state: updatedBooking,
  });

  if (beforeState.status !== "cancelled" && updatedBooking.status === "cancelled") {
    await sendBookingCancellationEmails(bookingId, adminClient, {
      initiatedBy: "admin",
      // C-08 Phase D — skip-self, see the matching call in
      // `updateBookingManagement`.
      actorStaffId: actor.id,
      // Change 14 — see the matching call in `updateBookingManagement`. The
      // customer leg queues so the row menu's Undo can kill it; the internal
      // legs still go immediately.
      delaySeconds: CANCELLATION_UNDO_DELAY_SECONDS,
    }).catch((error) => {
      console.error("Unable to send booking cancellation emails.", error);
    });
  } else if (beforeState.status !== updatedBooking.status) {
    await sendAssignedStaffBookingChangeEmails(
      bookingId,
      adminClient,
      `Booking status changed from ${beforeState.status} to ${updatedBooking.status}.`
    ).catch((error) => {
      console.error("Unable to send assigned staff change emails.", error);
    });
  }

  // C-08: booking_confirmed_client on pending → confirmed
  if (beforeState.status === "pending" && updatedBooking.status === "confirmed") {
    await sendBookingConfirmedClientEmail(bookingId, adminClient).catch((error) => {
      console.error("Unable to send booking_confirmed_client email.", error);
    });
  }

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.AUDIT);
  updateTag(TAGS.EMAILS);
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");

  return { success: true };
}

/**
 * C-04a — the restore primitive. Kept separate from `updateBookingManagement`'s
 * status dropdown so restore carries its own audit action, its own client email
 * and its own guards, rather than being an undocumented side effect of editing
 * a form field (B-121).
 */
export async function restoreBooking(
  formData: FormData
): Promise<BookingUpdateState> {
  const actor = await requireBookingManager();
  if (!actor || !canManageAllBookings(actor)) {
    return { error: "Insufficient permissions." };
  }

  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const targetStatusValue = String(formData.get("target_status") ?? "confirmed");
  const forceCompleted = formData.get("force_completed_reversal") === "on";
  const reason = String(formData.get("reason") ?? "").trim();

  if (!bookingId) return { error: "Booking is required." };
  if (!RESTORE_TARGET_STATUSES.includes(targetStatusValue as RestoreTargetStatus)) {
    return { fieldErrors: { target_status: "Choose a valid restore target." } };
  }
  const targetStatus = targetStatusValue as RestoreTargetStatus;

  const adminClient = createSupabaseAdminClient();
  // `clients(deleted_at)` is named deliberately: PostgREST never embeds a
  // relation unless the select asks for it, so a bare `select("*")` would leave
  // the deleted-client guard below reading `undefined` forever — and the admin
  // client is untyped, so tsc would not catch it.
  const { data: beforeState } = await adminClient
    .from("bookings")
    .select("*, clients(deleted_at)")
    .eq("id", bookingId)
    .single<RestoreBookingRecord>();

  if (!beforeState) return { error: "Booking not found." };

  const { clients: bookingClient, ...bookingBeforeState } = beforeState;

  // Restore semantics: only valid for inert statuses (cancelled, no_show) OR
  // a completed reopen with explicit force flag.
  const isInertSource =
    beforeState.status === "cancelled" || beforeState.status === "no_show";
  const isCompletedReopen = beforeState.status === "completed";

  if (!isInertSource && !isCompletedReopen) {
    return { error: "Only cancelled, no-show, or completed bookings can be restored." };
  }

  // S6 — past-datetime guard. Stricter than C-05's date-only lockdown; the UI
  // hides the button too, but the server is the authority. Brief §5.8.
  if (isInertSource && isBookingMomentPastLondon(beforeState)) {
    return {
      error: "This booking's appointment time has already passed and cannot be restored.",
    };
  }

  // S7 — 28-day restore window, keyed to the cancellation moment (S6 is keyed
  // to the appointment moment; both must pass). `no_show` sources skip this:
  // they are already dead via S6. Brief §5.12.
  if (beforeState.status === "cancelled" && isRestoreWindowExpired(beforeState)) {
    return {
      error: "This booking was cancelled more than 28 days ago and can no longer be restored.",
    };
  }

  if (isCompletedReopen && (!forceCompleted || reason.length < 5)) {
    return {
      error: "Reopening a completed booking requires confirmation and a reason.",
      fieldErrors: forceCompleted
        ? { reason: "Provide a reason (min 5 chars)." }
        : { force_completed_reversal: "Confirm via the modal." },
    };
  }

  // C-06 soft-deleted the client. There is no un-delete affordance anywhere in
  // the product, so the refusal states the outcome instead of offering a step
  // the admin cannot take.
  if (bookingClient?.deleted_at) {
    return {
      error: "This booking's client has been deleted, so it can no longer be restored.",
    };
  }

  const clearsCancellation = beforeState.status === "cancelled";
  const buildPayload = (includeCancelledAt: boolean) => {
    const payload: Record<string, unknown> = { status: targetStatus };
    // Clear stale cancellation fields on the way out of cancelled (W04 B-125).
    if (clearsCancellation) {
      payload.customer_cancelled_at = null;
      payload.customer_cancellation_note = null;
      // `cancelled_at` is live (20260728073903), so this clear normally runs.
      // The flag stays because the caller degrades gracefully against an
      // un-migrated database — see MISSING_COLUMN_CODES above. Not a TODO:
      // there is nothing left to do here (ITEM I.2).
      if (includeCancelledAt) payload.cancelled_at = null;
    }
    return payload;
  };

  const applyRestore = (payload: Record<string, unknown>) =>
    adminClient.from("bookings").update(payload).eq("id", bookingId).select().single();

  let restored = await applyRestore(buildPayload(true));
  if (restored.error && hasErrorCode(restored.error, MISSING_COLUMN_CODES)) {
    restored = await applyRestore(buildPayload(false));
  }
  if (restored.error) return { error: restored.error.message };
  const updatedBooking = restored.data;

  // Cancel any cancellation email still sitting in the undo window.
  //
  // `delivery_status = 'queued'` is the whole test: a row still in `queued` has
  // not been sent, whatever its `scheduled_for`. The cron claims each row by
  // flipping it out of `queued` before it dispatches, so anything this sweep
  // still finds queued is genuinely unsent. Filtering on `scheduled_for` as well
  // would be a false negative for every row that is already due but not yet
  // drained — the cron only fires on the minute boundary, so that gap is up to
  // 60 seconds wide, and a restore landing inside it would send "restored" while
  // the cron went on to send the cancellation anyway.
  const { count: cancelledQueuedCount, error: sweepError } = await adminClient
    .from("email_delivery_events")
    .update({ delivery_status: "cancelled_by_restore" }, { count: "exact" })
    .eq("booking_id", bookingId)
    .eq("event_type", "booking_cancellation_customer")
    .eq("delivery_status", "queued");

  if (sweepError) {
    // No Sentry issue comes out of this line. The server and edge Sentry
    // configs register no console-capture integration, and the default console
    // integration only records a breadcrumb — which needs a captured event in
    // the same scope to surface, while this path returns `{success:true}`
    // without throwing. So the durable, queryable record of a failed sweep is
    // `after_state.cancelled_queued_email_sweep_error` on the audit row below;
    // this is the matching Cloudflare log line, not an alert.
    console.error(
      "Unable to sweep queued cancellation emails during restore.",
      sweepError
    );
  }

  const cancelledQueuedEmail = (cancelledQueuedCount ?? 0) > 0;
  // Fail closed. A sweep that errored says nothing about whether a cancellation
  // email is still sitting in `queued`, and reading that silence as "nothing was
  // queued" is the exact shape of the failure this window exists to prevent: the
  // client gets "your booking is restored" at T, the queued row survives, and the
  // cron sends the cancellation at T+<=60s — a cancellation for a booking that is
  // live. A "restored" email that never arrives is something a human can fix.
  const suppressRestoreEmail = Boolean(sweepError) || cancelledQueuedEmail;

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "booking_restored",
    target_type: "bookings",
    target_id: bookingId,
    before_state: bookingBeforeState,
    after_state: {
      ...updatedBooking,
      restore_from_status: beforeState.status,
      restore_target_status: targetStatus,
      force_completed: forceCompleted || undefined,
      reason: reason || undefined,
      // Only ever true when the sweep actually cancelled something. The
      // suppression can also be triggered by the sweep failing, and that is a
      // different fact about the world, recorded as itself.
      cancelled_queued_email: cancelledQueuedEmail,
      // `??`, not the `|| undefined` omit-when-absent idiom above: an error
      // whose message is "" must still record that the sweep failed. Collapsing
      // it to `undefined` would write a row byte-identical to the healthy
      // "nothing queued, restore email sent" case, when the restore email was
      // in fact suppressed.
      cancelled_queued_email_sweep_error: sweepError?.message ?? undefined,
    },
  });

  // The client never saw a cancellation that was killed inside its undo window,
  // so a "restored" email would be the first they hear of the round trip.
  if (!suppressRestoreEmail) {
    await sendBookingRestoredClientEmail(bookingId, adminClient, {
      fromStatus: beforeState.status,
    }).catch((emailError) => {
      console.error("Unable to send booking restore email to client.", emailError);
    });
  }

  await sendAssignedStaffBookingChangeEmails(
    bookingId,
    adminClient,
    `Booking restored from ${beforeState.status} to ${targetStatus}.`
  ).catch((emailError) => {
    console.error("Unable to send assigned staff restore emails.", emailError);
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.AUDIT);
  updateTag(TAGS.EMAILS);
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");

  return { success: true };
}

export async function updateBookingAssignment(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const actor = await getStaffProfile(supabase);

  if (!actor || !actor.active || !canReassignBookings(actor)) {
    return { error: "Insufficient permissions." };
  }

  const assignmentId = String(formData.get("assignment_id") ?? "").trim();
  const staffId = String(formData.get("staff_id") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();
  if (!assignmentId) return { error: "Assignment is required." };

  const adminClient = createSupabaseAdminClient();
  const { data: assignment } = await adminClient
    .from("booking_assignments")
    .select("id, booking_id, participant_id, assigned_staff_id, required_therapist_gender, status")
    .eq("id", assignmentId)
    .single<AssignmentClaimRecord>();

  if (!assignment) return { error: "Assignment not found." };

  // C-05 Phase B, Step 5 — same active-booking gate as claimBookingAssignment,
  // before any UPDATE runs (assign or unassign).
  const activityCheck = await ensureBookingActive(assignment.booking_id, adminClient);
  if (!activityCheck.active) {
    return { error: activityCheck.message };
  }
  const booking = activityCheck.booking;

  const beforeState = assignment;
  let nextPayload: {
    assigned_staff_id: string | null;
    status: AssignmentStatus;
  };

  if (action === "unassign") {
    nextPayload = {
      assigned_staff_id: null,
      status: "unassigned",
    };
  } else {
    if (!staffId) return { error: "Choose an eligible staff member." };

    const previews = await getStaffAssignmentPreviews({
      booking,
      requiredGender: assignment.required_therapist_gender as "male" | "female",
      supabase: adminClient,
    });
    const selected = previews.find((preview) => preview.staff.id === staffId);

    if (!selected) return { error: "Staff member not found." };
    if (!selected.eligible) return { error: selected.reason };

    nextPayload = {
      assigned_staff_id: staffId,
      status: "assigned",
    };
  }

  const { data: updatedAssignment, error } = await adminClient
    .from("booking_assignments")
    .update(nextPayload)
    .eq("id", assignmentId)
    .select("id, booking_id, assigned_staff_id, required_therapist_gender, status")
    .single<AssignmentClaimRecord>();

  if (error || !updatedAssignment) {
    return { error: error?.message ?? "Unable to update assignment." };
  }

  const assignmentStatusResult = await recomputeBookingAssignmentStatus(
    assignment.booking_id,
    adminClient
  );
  if (assignmentStatusResult.error) return assignmentStatusResult;

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: action === "unassign" ? "booking_assignment_unassigned" : "booking_assignment_reassigned",
    target_type: "booking_assignments",
    target_id: assignmentId,
    before_state: beforeState,
    after_state: updatedAssignment,
  });

  if (updatedAssignment.assigned_staff_id) {
    const { data: staff } = await adminClient
      .from("staff_profiles")
      .select("email")
      .eq("id", updatedAssignment.assigned_staff_id)
      .single<{ email: string }>();

    if (staff?.email) {
      await sendStaffAssignmentEmail(
        updatedAssignment.booking_id,
        staff.email,
        adminClient,
        updatedAssignment.assigned_staff_id
      ).catch((error) => {
        console.error("Unable to send staff assignment email.", error);
      });
    }
  }

  // C-08: staff_unassignment when the previously assigned therapist was
  // removed or reassigned away (unassign, or assign to someone different).
  // `beforeState` is the pre-UPDATE assignment row captured above.
  const previousStaffId = beforeState.assigned_staff_id;
  if (previousStaffId && previousStaffId !== updatedAssignment.assigned_staff_id) {
    await sendStaffUnassignmentEmail(
      updatedAssignment.booking_id,
      previousStaffId,
      adminClient
    ).catch((error) => {
      console.error("Unable to send staff_unassignment email.", error);
    });
  }

  // C-08: client_assigned_therapist on a new assignment (initial assign, or
  // reassign to a different therapist than before).
  if (
    updatedAssignment.assigned_staff_id &&
    updatedAssignment.assigned_staff_id !== previousStaffId
  ) {
    await sendClientAssignedTherapistEmail(
      updatedAssignment.booking_id,
      updatedAssignment.assigned_staff_id,
      adminClient
    ).catch((error) => {
      console.error("Unable to send client_assigned_therapist email.", error);
    });
  }

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.STAFF);
  updateTag(TAGS.AUDIT);
  updateTag(TAGS.EMAILS);
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${assignment.booking_id}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");

  return { success: true };
}

// C-05 design: this server action is INTENTIONALLY NOT gated by ensureBookingActive.
// Practitioners can mark their own assignment complete/no_show on a cancelled
// booking — forensic edge case (visit happened before cancellation propagated).
// Auto-promote (C-04a's autoPromoteBookingFromAssignments) is conditional on
// booking.status NOT IN ('cancelled', 'completed', 'no_show'), so the parent
// booking stays cancelled. See brief §5.1.
export async function updateOwnAssignmentStatus(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const actor = await getStaffProfile(supabase);

  if (!actor || !actor.active || !canManageBookings(actor)) {
    return { error: "Insufficient permissions." };
  }

  const assignmentId = String(formData.get("assignment_id") ?? "").trim();
  const status = String(formData.get("status") ?? "") as AssignmentStatus;
  if (!assignmentId) return { error: "Assignment is required." };
  if (!OWN_ASSIGNMENT_STATUSES.includes(status)) {
    return { error: "Choose a valid assignment status." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("booking_assignments")
    .select("id, booking_id, assigned_staff_id, required_therapist_gender, status")
    .eq("id", assignmentId)
    .single<AssignmentClaimRecord>();

  if (!beforeState || beforeState.assigned_staff_id !== actor.id) {
    return { error: "You can only update your own assigned work." };
  }

  const { data: updatedAssignment, error } = await adminClient
    .from("booking_assignments")
    .update({ status })
    .eq("id", assignmentId)
    .eq("assigned_staff_id", actor.id)
    .select("id, booking_id, assigned_staff_id, required_therapist_gender, status")
    .single<AssignmentClaimRecord>();

  if (error || !updatedAssignment) {
    return { error: error?.message ?? "Unable to update assignment." };
  }

  const assignmentStatusResult = await recomputeBookingAssignmentStatus(
    updatedAssignment.booking_id,
    adminClient
  );
  if (assignmentStatusResult.error) return assignmentStatusResult;

  // C-04a Change 6 — this write may have terminalised the last open assignment.
  // The condition restates `OWN_ASSIGNMENT_STATUSES`, which today makes it
  // always true; it stays so the hook keeps its own scope if that list ever
  // grows a non-terminal member. Failure is non-fatal: the assignment update
  // has already succeeded and is what the practitioner asked for.
  if (status === "completed" || status === "no_show") {
    const autoPromoteResult = await autoPromoteBookingFromAssignments(
      updatedAssignment.booking_id,
      actor.id,
      adminClient
    );
    if (autoPromoteResult.error) {
      console.error("Auto-promote failed.", autoPromoteResult.error);
    }
  }

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: `booking_assignment_${status}`,
    target_type: "booking_assignments",
    target_id: assignmentId,
    before_state: beforeState,
    after_state: updatedAssignment,
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.STAFF);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${updatedAssignment.booking_id}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");

  return { success: true };
}

// ─── H4 — reschedule response ───────────────────────────────────────────────
// Give admin a way to acknowledge a customer reschedule request so
// `reschedule_status` doesn't hang on "requested" forever (the cause of
// permanent attention inflation flagged by Agent 1). Decision is recorded
// on the booking row + audit trail; the actual move-of-booking-date is
// handled out-of-band per the existing operator workflow (no admin path
// currently edits booking_date, and adding one is a separate feature).
//
// Schema vocabulary: the `bookings.reschedule_status` CHECK constraint
// allows ['none','requested','reviewed','declined','completed']. "Accept"
// maps to 'reviewed' (admin has reviewed the request; the actual booking
// move is out-of-band). "Decline" maps to 'declined'. UI labels stay
// operator-friendly ("Accept request" / "Decline request") but the stored
// values match the schema's allowed vocabulary.
const RESCHEDULE_DECISIONS = ["reviewed", "declined"] as const;
type RescheduleDecision = (typeof RESCHEDULE_DECISIONS)[number];

/**
 * ⛔ G-08-02 — THIS USED TO RETURN `void` AND SWALLOW EVERY FAILURE.
 *
 * All five refusal paths below were bare `return`s, so `RescheduleResponseButtons`
 * — which fires `toast.success("Reschedule request accepted.")` the moment the
 * promise resolves — told staff it had worked when nothing had been written. No
 * audit row, no operational event, and the customer's request sat unanswered
 * forever with nobody aware. The component's error `catch` was unreachable.
 *
 * ⛔ It now returns a RESULT rather than throwing, which is deliberate and not
 * stylistic: Next.js redacts thrown server-action messages in production, so a
 * throw would reach staff as an opaque digest. Returning `{ error }` is also the
 * idiom `quickUpdateBooking` and `restoreBooking` already use in this file, so
 * the caller shape is the familiar one.
 *
 * ⚠️ "Already answered" is deliberately its own message: two coordinators
 * answering the same request is an ordinary race, not a fault, and telling them
 * to "try again" would be wrong.
 */
export async function respondToCustomerReschedule(
  formData: FormData
): Promise<{ success?: true; error?: string }> {
  const actor = await requireBookingManager();
  if (!actor || !canManageAllBookings(actor)) {
    return { error: "Insufficient permissions." };
  }

  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const decisionRaw = String(formData.get("decision") ?? "") as RescheduleDecision;
  if (!bookingId || !RESCHEDULE_DECISIONS.includes(decisionRaw)) {
    return { error: "Choose accept or decline." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("bookings")
    .select(
      "id, reschedule_status, reschedule_requested_at, reschedule_preferred_date, reschedule_preferred_time, reschedule_note"
    )
    .eq("id", bookingId)
    .single();
  if (!beforeState) return { error: "Booking not found." };
  if (beforeState.reschedule_status !== "requested") {
    return {
      error: "This reschedule request has already been answered. Refresh to see the latest.",
    };
  }

  const { data: updated, error } = await adminClient
    .from("bookings")
    .update({ reschedule_status: decisionRaw })
    .eq("id", bookingId)
    .select("id, reschedule_status")
    .single();
  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type:
      decisionRaw === "reviewed"
        ? "booking_reschedule_reviewed"
        : "booking_reschedule_declined",
    target_type: "bookings",
    target_id: bookingId,
    before_state: beforeState,
    after_state: updated,
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");

  return { success: true };
}

export interface ManualBookingState {
  error?: string;
  fieldErrors?: Record<string, string>;
  duplicateWarning?: string;
}

const manualBookingSchema = z.object({
  selectedPackageIds: z.array(z.string().trim().min(1)).min(1, "Choose at least one service."),
  bookingSource: z.enum(BOOKING_SOURCES),
  sendConfirmationEmail: z.boolean(),
  overrideAvailability: z.boolean().default(false),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a booking date."),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a booking time."),
  details: z.object({
    bookingFor: z.enum(["self", "someone_else", "group"]),
    fullName: z.string().trim().min(1, "Contact name is required."),
    phone: z.string().trim().min(1, "Phone is required."),
    // Admin flow only: an empty email is allowed and reaches the RPC as "",
    // which it stores as NULL. The public flow keeps its own `z.email()` in
    // `api/bookings/route.ts`. Phone stays required.
    // Trimmed before the union so whitespace-only input lands on the ""
    // branch instead of matching neither member and dead-ending the admin.
    email: z
      .string()
      .trim()
      .pipe(z.union([z.email("Email needs an @. For example, sara@example.com."), z.literal("")]))
      .default(""),
    notes: z.string(),
    healthNotes: z.string(),
    clientGender: z.enum(["male", "female", ""]),
    numberOfPeople: z.coerce.number().int().min(1).max(10),
    participantGenders: z.array(z.enum(["male", "female", ""])),
    participantNames: z.array(z.string()),
    participantNotes: z.array(z.string()),
    consentAcknowledged: z.boolean(),
    paymentAcknowledged: z.literal(true),
    manageAcknowledged: z.literal(true),
    postcode: z.string().trim().min(3, "Postcode is required."),
    address: z.string().trim().min(5, "Address is required."),
    city: z.string().trim().min(2, "City is required."),
    area: z.string(),
    accessNotes: z.string(),
    parkingNotes: z.string(),
  }),
});

export async function createManualBooking(
  _previousState: ManualBookingState,
  formData: FormData
): Promise<ManualBookingState> {
  const actor = await requireBookingManager();
  if (!actor || !canManageAllBookings(actor)) {
    return { error: "Insufficient permissions." };
  }

  const numberOfPeople = Number(formData.get("number_of_people") ?? 1);
  const participantIndexes = Array.from(
    { length: Number.isFinite(numberOfPeople) ? numberOfPeople : 1 },
    (_, index) => index
  );
  const selectedPackageIds = formData.getAll("service_slugs").map(String);
  const enquiryId = String(formData.get("enquiry_id") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim() || null;
  const confirmDuplicate = formData.get("confirm_duplicate") === "on";
  const overrideAvailability = formData.get("override_availability") === "on";
  const participantServiceSlugs: string[][] = participantIndexes.map((index) =>
    formData.getAll(`participant_services_${index}[]`).map(String).filter(Boolean)
  );
  const parsed = manualBookingSchema.safeParse({
    selectedPackageIds,
    bookingSource: String(formData.get("booking_source") ?? ""),
    sendConfirmationEmail: formData.get("send_confirmation_email") === "on",
    overrideAvailability,
    preferredDate: String(formData.get("booking_date") ?? ""),
    preferredTime: String(formData.get("start_time") ?? ""),
    details: {
      bookingFor:
        numberOfPeople > 1
          ? "group"
          : String(formData.get("booking_for") ?? "self"),
      fullName: String(formData.get("full_name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      notes: String(formData.get("customer_notes") ?? ""),
      healthNotes: String(formData.get("health_notes") ?? ""),
      clientGender: String(formData.get("participant_gender_0") ?? ""),
      numberOfPeople,
      participantGenders: participantIndexes.map((index) =>
        String(formData.get(`participant_gender_${index}`) ?? "")
      ),
      participantNames: participantIndexes.map((index) =>
        String(formData.get(`participant_name_${index}`) ?? "")
      ),
      participantNotes: participantIndexes.map((index) =>
        String(formData.get(`participant_note_${index}`) ?? "")
      ),
      consentAcknowledged: formData.get("consent_acknowledged") === "on",
      paymentAcknowledged: true,
      manageAcknowledged: true,
      postcode: String(formData.get("postcode") ?? ""),
      address: String(formData.get("address") ?? ""),
      city: String(formData.get("city") ?? ""),
      area: String(formData.get("area") ?? ""),
      accessNotes: String(formData.get("access_notes") ?? ""),
      parkingNotes: String(formData.get("parking_notes") ?? ""),
    },
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted booking details.",
      fieldErrors: Object.fromEntries(
        Object.entries(z.flattenError(parsed.error).fieldErrors).map(
          ([key, value]) => [key, value?.[0] ?? "Invalid value."]
        )
      ),
    };
  }

  if (!parsed.data.details.consentAcknowledged) {
    return {
      error: "Record consent acknowledgement before creating the booking.",
      fieldErrors: { consentAcknowledged: "Consent acknowledgement is required." },
    };
  }

  const adminClient = createSupabaseAdminClient();

  try {
    const result = await createBookingTransaction(
      {
        selectedPackageIds: parsed.data.selectedPackageIds,
        details: parsed.data.details,
        preferredDate: parsed.data.preferredDate,
        preferredTime: parsed.data.preferredTime,
        bookingSource: parsed.data.bookingSource,
        overrideAvailability: parsed.data.overrideAvailability,
        participantServiceSlugs: participantServiceSlugs.some((s) => s.length > 0)
          ? participantServiceSlugs
          : undefined,
        clientId,
        confirmDuplicate,
        // Admin-only: surface the duplicate warning so staff decide consciously.
        // The public route omits this and links returning customers silently.
        raiseOnDuplicate: true,
      },
      adminClient
    );

    await adminClient.from("audit_logs").insert({
      actor_staff_id: actor.id,
      action_type: "manual_admin_booking_created",
      target_type: "bookings",
      target_id: result.bookingId,
      after_state: {
        bookingSource: parsed.data.bookingSource,
        participantCount: result.participantCount,
        itemCount: result.itemCount,
        assignmentCount: result.assignmentCount,
      },
    });

    // Inline assignment — apply therapist selections from step 4 if present
    try {
      const therapistAssignments = participantIndexes.map((i) =>
        String(formData.get(`therapist_assignment_${i}`) ?? "").trim()
      );
      const hasAnyAssignment = therapistAssignments.some((id) => id.length > 0);

      if (hasAnyAssignment) {
        const { data: participants } = await adminClient
          .from("booking_participants")
          .select("id")
          .eq("booking_id", result.bookingId)
          .order("created_at", { ascending: true });

        if (participants && participants.length > 0) {
          let appliedCount = 0;

          for (let i = 0; i < therapistAssignments.length; i++) {
            const staffId = therapistAssignments[i];
            if (!staffId || !participants[i]) continue;

            const { data: assignment } = await adminClient
              .from("booking_assignments")
              .select("id")
              .eq("participant_id", participants[i].id)
              .single();

            if (!assignment) continue;

            await adminClient
              .from("booking_assignments")
              .update({ assigned_staff_id: staffId, status: "assigned" })
              .eq("id", assignment.id);

            await adminClient.from("audit_logs").insert({
              actor_staff_id: actor.id,
              action_type: "booking_assignment_reassigned",
              target_type: "booking_assignments",
              target_id: assignment.id,
              after_state: { assigned_staff_id: staffId },
            });

            appliedCount++;
          }

          if (appliedCount > 0) {
            const newStatus =
              appliedCount >= result.participantCount
                ? "fully_assigned"
                : "partially_assigned";

            await adminClient
              .from("bookings")
              .update({ assignment_status: newStatus })
              .eq("id", result.bookingId);
          }
        }
      }
    } catch (assignmentError) {
      console.error("Inline assignment failed (booking was created):", assignmentError);
    }

    // C-03 B-107: graceful catch — if the enquiry-update fails, the booking
    // still succeeds; the redirect below proceeds regardless. Admin must mark
    // the enquiry converted manually in that case.
    if (enquiryId) {
      try {
        const { data: beforeEnquiry } = await adminClient
          .from("enquiries")
          .select("*")
          .eq("id", enquiryId)
          .single();

        const { data: updatedEnquiry } = await adminClient
          .from("enquiries")
          .update({
            status: "booked",
            converted_booking_id: result.bookingId,
          })
          .eq("id", enquiryId)
          .select()
          .single();

        await adminClient.from("audit_logs").insert({
          actor_staff_id: actor.id,
          action_type: "enquiry_converted_to_booking",
          target_type: "enquiries",
          target_id: enquiryId,
          before_state: beforeEnquiry,
          after_state: updatedEnquiry,
        });

        updateTag("report-data");
        updateTag("dashboard-data");
        updateTag(TAGS.ENQUIRIES);
        revalidatePath("/admin/enquiries");
      } catch (enquiryUpdateError) {
        console.error(
          `[createManualBooking] Booking ${result.bookingId} created but enquiry ${enquiryId} update failed. Admin must mark manually.`,
          enquiryUpdateError
        );
        // Continue — booking is already created; redirect proceeds.
      }
    }

    // The form hides the checkbox when there is no email, so this is the
    // second gate rather than the first — it also covers a hand-crafted post.
    if (parsed.data.sendConfirmationEmail && parsed.data.details.email.trim()) {
      const manageUrl = await ensureBookingManageUrl(
        {
          id: result.bookingId,
          booking_date: parsed.data.preferredDate,
        },
        adminClient
      ).catch((error) => {
        console.error("Unable to create booking manage link.", error);
        return null;
      });

      await sendBookingCreatedEmails(result.bookingId, adminClient, {
        manageUrl: manageUrl ?? undefined,
      }).catch((error) => {
        console.error("Unable to send manual booking emails.", error);
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
    // C-03 Step 6: source-aware redirect — carry the enquiry origin forward
    // so the booking detail page can show the just-converted toast + Origin
    // panel (Phase D). Source-of-truth linkage stays enquiries.converted_booking_id.
    // C-07 Step 4 (W02-V-2): extend the same source-aware pattern to the
    // non-enquiry paths — `?just_created=1` (+ `client_id` when prefilled)
    // drives BookingCreatedToast's "Booking created." toast.
    const redirectPath = enquiryId
      ? `/admin/bookings/${result.bookingId}?just_converted=1&enquiry_id=${enquiryId}`
      : clientId
        ? `/admin/bookings/${result.bookingId}?just_created=1&client_id=${clientId}`
        : `/admin/bookings/${result.bookingId}?just_created=1`;
    redirect(redirectPath);
  } catch (error) {
    // Checked before BookingCreationError — DuplicateClientError extends it.
    if (error instanceof DuplicateClientError) {
      const { data: match } = error.matchedClientId
        ? await adminClient
            .from("clients")
            .select("full_name, email, phone")
            .eq("id", error.matchedClientId)
            .maybeSingle()
        : { data: null };

      return {
        duplicateWarning: match
          ? `${match.full_name} (${match.email ?? match.phone ?? "no contact"})`
          : (error.matchedClientName ?? "An existing client already uses these contact details."),
      };
    }

    if (error instanceof BookingCreationError) {
      return { error: error.message };
    }

    throw error;
  }
}

// ─── D-051 — move a booking to a new date and time ──────────────────────────
//
// ⛔ OWNER RULING, 2026-08-23: *"its an important feature and one i thought we
// already had, so we will have to build this. go ahead and do so surgically
// without effecting or conflicting with anything else."*
//
// Until now NOTHING in this application could change `booking_date`. It was
// written once at creation and read everywhere else, so "accept the customer's
// reschedule request" recorded an answer and moved nothing — the front desk's
// only route to an actually-moved appointment was cancel-and-rebook, which
// emails the customer a cancellation and starts a new booking reference.
//
// ── ⛔ WHAT THIS DELIBERATELY DOES NOT DO ────────────────────────────────
//
// It changes the DATE and TIME, and nothing else. Not the service, not the
// participants, not the price, not the therapist. ⛔ Every one of those has its
// own established path, and widening this action to touch them would make it a
// second, competing booking editor. `end_time` is the one derived value it
// recomputes, because leaving it stale would under-book the diary and let the
// next customer be booked on top of this one.
//
// ── ⛔ THE FAILURE MODE THIS ACTION'S OWN FIX HAD TO AVOID ───────────────
//
// A booking being moved ALREADY OCCUPIES A SLOT. Checking the new slot naively
// makes the booking block itself the moment the new window overlaps the old —
// nudging 10:00 to 10:30 would be refused as "no capacity", and the reason
// shown would name a conflict that is the booking itself. ⛔ Hence
// `excludeBookingId`, threaded into the availability engine as an OPTIONAL
// parameter that no existing caller passes.

/**
 * D-051 - the columns `rescheduleBooking` reads and writes back.
 *
 * Deliberately loose: the action SELECTs `*` so the audit trail records the
 * whole row before and after, and a narrowed type here would only invite the
 * "column not selected reads as undefined" mistake in the opposite direction.
 */
type BookingRescheduleRecord = {
  id: string;
  status: string;
  booking_date: string;
  start_time: string | null;
  end_time: string | null;
  total_duration_mins: number | null;
  reschedule_status: string | null;
  manage_token_hash: string | null;
  service_city: string | null;
  recurring_template_id: string | null;
} & Record<string, unknown>;

const RESCHEDULE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RESCHEDULE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function rescheduleBooking(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const actor = await getStaffProfile(supabase);

  // ⛔ Same gate as the Status & payment form: moving somebody's appointment is
  // a whole-booking decision. A therapist managing their OWN assignment must
  // not be able to move the visit out from under a colleague.
  if (!actor || !actor.active || !canManageAllBookings(actor)) {
    return { error: "Insufficient permissions." };
  }

  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const nextDate = String(formData.get("booking_date") ?? "").trim();
  const nextTime = String(formData.get("start_time") ?? "")
    .trim()
    .slice(0, 5);
  const overrideAvailability = formData.get("override_availability") === "on";

  if (!bookingId) return { error: "Booking is required." };
  if (!RESCHEDULE_DATE_PATTERN.test(nextDate)) {
    return { fieldErrors: { booking_date: "Choose a date." } };
  }
  if (!RESCHEDULE_TIME_PATTERN.test(nextTime)) {
    return { fieldErrors: { start_time: "Choose a start time." } };
  }

  const adminClient = createSupabaseAdminClient();

  const { data: beforeState } = await adminClient
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle<BookingRescheduleRecord>();

  if (!beforeState) return { error: "Booking not found." };

  // ⛔ A finished or cancelled visit is not moved, it is re-created. Same
  // predicate the complete/no-show chips and the auto-promoter read, so the
  // three cannot drift.
  if (isTerminalBookingStatus(beforeState.status)) {
    return {
      error:
        "This booking is " +
        String(beforeState.status).replace("_", "-") +
        " and cannot be moved. Restore it first if it should be live again.",
    };
  }

  // ⛔ W03-E-2's sibling: an appointment cannot be moved into the past. Date
  // only, matching every other guard in this file — a visit can still be moved
  // to earlier TODAY, which is the ordinary "they are coming this afternoon
  // instead" case.
  if (nextDate < getTodayIsoDate()) {
    return {
      fieldErrors: { booking_date: "Pick today or a date in the future." },
    };
  }

  // ⛔ AND NOT A TIME THAT HAS ALREADY GONE. The date check alone let an
  // operator move a booking to 09:00 at four in the afternoon, and email the
  // customer a time that was already past. ⚠️ Same-day moves stay allowed and
  // are the ordinary case ("they are coming this afternoon instead") - it is
  // the MOMENT that must be in the future, not the day.
  if (isBookingMomentPastLondon({ booking_date: nextDate, start_time: nextTime })) {
    return {
      fieldErrors: { start_time: "That time has already passed. Pick a later one." },
    };
  }

  // ⛔ BLOCKER A, found by independent review. A SERIES OCCURRENCE MUST NOT
  // BE MOVED HERE.
  //
  // There is no occurrence table: "does this visit exist" IS its
  // booking_date. extend-recurring-horizons builds its existingDates set from
  // the visits' dates and re-creates any cadence date it does not find - so
  // moving a visit off date A makes tonight's cron insert a BRAND NEW visit on
  // A. The client ends up with the appointment they asked to move off, plus
  // the one it was moved to.
  //
  // ⛔ Worse: that cron takes its anchor from the EARLIEST visit. Move the
  // first occurrence of a Friday series to a Wednesday and every future date
  // is recomputed on Wednesdays, none of them match, and it materialises a
  // whole parallel series alongside the live one. Silently - the dates
  // genuinely differ, so its duplicate guard cannot see it.
  //
  // ⚠️ Measured: zero recurring bookings exist in production today, so this
  // is latent rather than live. Refused outright rather than patched around,
  // because making that cron move-aware is a real change to a job that
  // already has no transaction - and that is not this feature.
  if (beforeState.recurring_template_id) {
    return {
      error:
        "This visit is part of a repeat booking, so it cannot be moved on its own. " +
        "Cancel this visit and add a one-off booking for the new time instead.",
    };
  }

  const currentTime = String(beforeState.start_time ?? "").slice(0, 5);
  if (beforeState.booking_date === nextDate && currentTime === nextTime) {
    return {
      error: "That is already when this booking is. Pick a different date or time.",
    };
  }

  // ⛔ THE LENGTH OF THE VISIT, read BEFORE the availability check so the
  // window that gets VERIFIED is the window that gets WRITTEN. See
  // `durationMinsOverride`.
  const durationMins = Number(beforeState.total_duration_mins ?? 0);

  // ⛔ FAIL CLOSED on a booking whose length is unknown. Skipping the
  // end_time write would leave the OLD end against the new start - either a
  // wrong diary window, or an end_time <= start_time that Postgres rejects as
  // a raw driver error in the operator's face.
  if (!Number.isFinite(durationMins) || durationMins <= 0) {
    return {
      error:
        "This booking has no recorded length, so it cannot be moved safely. " +
        "Check the booking’s service first.",
    };
  }

  // ── ⛔ CAN THE CLINIC ACTUALLY COVER THE NEW SLOT? ──────────────────────
  //
  // Reuses the SAME engine the recurring-series path uses (D-042), rather than
  // a second opinion written for this action. `excludeBookingId` keeps the
  // booking from blocking itself.
  if (!overrideAvailability) {
    const { data: itemRows } = await adminClient
      .from("booking_items")
      .select("services(slug)")
      .eq("booking_id", bookingId);

    const serviceSlugs = [
      ...new Set(
        ((itemRows ?? []) as unknown as { services: { slug: string } | null }[])
          .map((row) => row.services?.slug)
          .filter((slug): slug is string => Boolean(slug))
      ),
    ];

    const { data: participantRows } = await adminClient
      .from("booking_participants")
      .select("required_therapist_gender")
      .eq("booking_id", bookingId);

    const participantGenders = (
      (participantRows ?? []) as { required_therapist_gender: string | null }[]
    )
      .map((row) => row.required_therapist_gender)
      .filter((gender): gender is "male" | "female" => gender === "male" || gender === "female");

    // ⛔ Fail CLOSED. Not being able to describe the booking is not the same as
    // the slot being free — and an empty `participantGenders` would make the
    // engine ask for nobody, which every slot satisfies.
    if (serviceSlugs.length === 0 || participantGenders.length === 0) {
      return {
        error:
          "Could not read what this booking needs, so its new time cannot be checked. Try again.",
      };
    }

    // The therapist already on the job, if there is one. Moving a booking on
    // top of their own other work is the collision an operator would least
    // expect the system to allow.
    // ⛔ EVERY therapist on the job, not just the first one found.
    //
    // The first version took [0] of an unordered result, so on a GROUP booking
    // with two therapists only ONE diary was checked - capacity could pass on
    // the strength of a THIRD free therapist who is not on this booking at
    // all, and the unchecked colleague was double-booked.
    //
    // ⚠️ Filtered to live assignment statuses too: a cancelled row can retain
    // a stale assigned_staff_id, and refusing a move because of a therapist
    // who is no longer on the job is its own kind of wrong.
    const { data: assignmentRows } = await adminClient
      .from("booking_assignments")
      .select("assigned_staff_id, status")
      .eq("booking_id", bookingId)
      .in("status", ["unassigned", "assigned"])
      .not("assigned_staff_id", "is", null);
    const boundStaffIds = [
      ...new Set(
        ((assignmentRows ?? []) as { assigned_staff_id: string | null }[])
          .map((row) => row.assigned_staff_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const runCheck = (boundStaffId: string | null) =>
      checkSeriesSlots(
        {
          dates: [nextDate],
          startTime: nextTime,
          serviceIds: serviceSlugs,
          participantGenders,
          city: String(beforeState.service_city ?? "Luton"),
          boundStaffId,
          // ⛔ THE LINE THAT STOPS THE BOOKING BLOCKING ITSELF.
          excludeBookingId: bookingId,
          // ⛔ And check the length this visit is ACTUALLY scheduled for, not
          // the sum of the services' current durations. The two diverge once a
          // service's duration is edited after a booking is taken.
          durationMinsOverride: durationMins,
        },
        adminClient,
        // ⛔ D-033's principle: hiding a service from the website must not
        // strand a booking a client already has. Moving an existing visit is
        // exactly that case, so a hidden service must not make it immovable.
        { includeHiddenServices: true }
      );

    const check = await runCheck(boundStaffIds[0] ?? null);

    const verdict = check.verdicts[0];
    if (!verdict || !verdict.available) {
      return {
        fieldErrors: {
          start_time:
            verdict?.reason ??
            check.reason ??
            "Nobody is free then. Pick another time, or tick the override.",
        },
      };
    }
    if (boundStaffIds[0] && verdict.boundStaffFree === false) {
      return {
        fieldErrors: {
          start_time:
            "The therapist on this booking is already busy then. Pick another time, reassign them, or tick the override.",
        },
      };
    }

    // Any FURTHER therapists on a group booking, each asked about their own
    // diary. One extra call per extra therapist, and none at all for the
    // ordinary single-therapist booking - correctness beats a round trip.
    for (const staffId of boundStaffIds.slice(1)) {
      const extra = await runCheck(staffId);
      if (extra.verdicts[0]?.boundStaffFree === false) {
        return {
          fieldErrors: {
            start_time:
              "One of the therapists on this booking is already busy then. Pick another time, reassign them, or tick the override.",
          },
        };
      }
    }
  }

  // ── The write ──────────────────────────────────────────────────────────
  const nextEndTime = addMinutesToTime(nextTime, durationMins);

  // ⛔ A visit has to finish on the day it starts. addMinutesToTime does NOT
  // guard midnight - 23:00 + 90 gives "24:30", which Postgres refuses for a
  // time column. The create RPC carries the same rule, and the horizon cron
  // keeps its own guarded copy of this helper for exactly this reason.
  // ⚠️ Only reachable with the override ticked, because availability refuses
  // out-of-hours otherwise - and the override path has no other backstop,
  // which is precisely why it needs one.
  const [nextEndHour] = nextEndTime.split(":").map(Number);
  if (nextEndHour >= 24) {
    return {
      fieldErrors: {
        start_time: "A visit has to finish on the same day it starts. Pick an earlier time.",
      },
    };
  }

  const updatePayload: Record<string, unknown> = {
    booking_date: nextDate,
    start_time: nextTime + ":00",
    end_time: nextEndTime + ":00",
  };

  // ⛔ If this move answers a customer's outstanding request, close the request
  // too — otherwise it sits "requested" for ever and the booking keeps showing
  // in the attention queue after the very thing it asked for has happened.
  // ⚠️ reviewed as well as requested: pressing "Accept request" first sets the
  // status to reviewed, and the natural flow is accept-then-move. Without this
  // the request would sit at reviewed for ever, never reaching completed,
  // after the very move it asked for had happened.
  if (
    beforeState.reschedule_status === "requested" ||
    beforeState.reschedule_status === "reviewed"
  ) {
    updatePayload.reschedule_status = "completed";
  }

  // ⛔ THE MANAGE LINK'S EXPIRY IS DERIVED FROM THE BOOKING DATE.
  // `getManageTokenExpiry` sets it to <booking_date>T23:59:59Z, so moving a
  // booking LATER would leave the customer's existing link expiring against the
  // OLD date — their "manage my booking" link would die before the appointment
  // it belongs to. ⚠️ Only the EXPIRY is touched: re-minting the token would
  // invalidate the link already sitting in their inbox.
  if (beforeState.manage_token_hash) {
    updatePayload.manage_token_expires_at = getManageTokenExpiry(nextDate);
  }

  const { data: updated, error } = await adminClient
    .from("bookings")
    .update(updatePayload)
    .eq("id", bookingId)
    // ⛔ Race guard: refuse if somebody cancelled or completed the booking
    // between the check above and this write.
    .not("status", "in", TERMINAL_BOOKING_STATUS_FILTER)
    .select("*")
    .maybeSingle<BookingRescheduleRecord>();

  if (error) return { error: error.message };
  if (!updated) {
    return {
      error: "This booking changed while you were moving it. Reload and try again.",
    };
  }

  // ⛔ BLOCKER B, found by independent review. THE OLD REMINDER MUST STOP
  // COUNTING.
  //
  // booking-reminders dedupes on (booking_id, event_type) with NO date
  // component. So: booking on Tuesday, reminder goes out Monday, the customer
  // rings Monday afternoon and is moved to Thursday - Wednesday night the cron
  // finds the Thursday booking, finds Monday's reminder row, and SKIPS. The
  // customer got a reminder naming Tuesday and gets nothing for Thursday.
  // Silent: it just increments skipped_already_sent.
  //
  // ⚠️ The rows are MARKED, not deleted. /admin/emails is the clinic's record
  // of what it actually sent, and a reminder that really did go out must stay
  // visible. cancelled_manual is an existing allowed delivery_status, and the
  // cron now ignores rows carrying it.
  const { error: reminderSweepError } = await adminClient
    .from("email_delivery_events")
    .update({ delivery_status: "cancelled_manual" })
    .eq("booking_id", bookingId)
    .eq("event_type", "booking_reminder")
    .in("delivery_status", ["accepted", "sent", "queued", "failed"]);
  if (reminderSweepError) {
    // Non-fatal: the move has already happened. ⛔ But LOUD - the consequence
    // is a customer who never gets a reminder for their new time.
    console.error(
      "[D-051] moved a booking but could not clear its old reminder. The customer may not get a reminder for the new time.",
      { bookingId, reminderSweepError }
    );
  }

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "booking_rescheduled",
    target_type: "bookings",
    target_id: bookingId,
    before_state: beforeState,
    after_state: updated,
  });

  // ⛔ TELL THE CUSTOMER. The gap the Owner described was that a customer asks
  // to move and hears nothing back.
  //
  // ⚠️ It has its OWN email rather than a reused `booking_confirmed_client`.
  // That one's <h1> is hard-coded "Your booking is confirmed" and everywhere
  // else it fires only on pending -> confirmed, so reusing it would have told
  // a customer with a still-pending booking that it was confirmed. An
  // independent review caught that before it shipped.
  //
  // Failure is non-fatal and LOGGED: the move has already happened and is what
  // the operator asked for. ⛔ `console.error` rather than relying on Sentry —
  // its free tier is rate-limited and drops events (D-018).
  const emailOutcome = await sendBookingMovedClientEmail(bookingId, adminClient).catch(
    (emailError) => {
      console.error("[D-051] booking moved but the customer could not be told.", {
        bookingId,
        emailError,
      });
      return { sent: false };
    }
  );

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.AUDIT);
  // This action sends an email, so /admin/emails and the nav failure counter
  // go stale without this. Every other email-sending action here does it.
  updateTag(TAGS.EMAILS);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/bookings/" + bookingId);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");

  return {
    success: true as const,
    bookingDate: nextDate,
    startTime: nextTime,
    // ⛔ Reported so the UI does not CLAIM the client was emailed when they
    // were not. A phone-only booking has no address to write to, which is a
    // legitimate state - but the operator has to know to ring them.
    emailed: emailOutcome.sent,
  };
}
