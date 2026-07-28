"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  sendBookingCreatedEmails,
  sendAssignedStaffBookingChangeEmails,
  sendBookingCancellationEmails,
  sendBookingRestoredClientEmail,
  sendStaffAssignmentEmail,
} from "@/lib/email/notifications";
import { ensureBookingManageUrl } from "@/lib/booking/manage-token";
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
} from "./access";
import {
  getClaimAssignmentEligibility,
  getStaffAssignmentPreviews,
} from "./assignment-eligibility";
import {
  COMPLETED_REVERSAL_MIN_REASON_LENGTH,
  TERMINAL_BOOKING_STATUS_FILTER,
  isBookingDateFutureLondon,
  isBookingMomentPastLondon,
  isCompletedReversal,
  isRestoreWindowExpired,
  isTerminalBookingStatus,
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
 * `bookings.cancelled_at` arrives with C-04a's Phase F migration. Until then
 * the restore payload cannot clear it: PostgREST rejects an unknown column with
 * PGRST204, raw Postgres with 42703. Same fallback shape as C-06's cascade in
 * `clients/actions.ts`.
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

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();

  if (!beforeState) return { error: "Booking not found." };

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

  const payload = {
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
  };

  const { data, error } = await adminClient
    .from("bookings")
    .update(payload)
    .eq("id", bookingId)
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "booking_management_updated",
    target_type: "bookings",
    target_id: bookingId,
    before_state: beforeState,
    // The reopen reason only exists once the guard above has accepted it, so
    // folding it into `after_state` is what makes the audit row explain itself.
    after_state: completedReversalReason
      ? { ...data, completed_reversal_reason: completedReversalReason }
      : data,
  });

  if (beforeState.status !== "cancelled" && data.status === "cancelled") {
    await sendBookingCancellationEmails(bookingId, adminClient, {
      initiatedBy: "admin",
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

  updateTag("report-data");
  updateTag("dashboard-data");
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

  const { data: booking } = await adminClient
    .from("bookings")
    .select("id, booking_date, start_time, end_time")
    .eq("id", assignment.booking_id)
    .single();

  if (!booking) return { error: "Booking not found." };

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

  updateTag("report-data");
  updateTag("dashboard-data");
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
          ? { status: "cancelled" as BookingStatus }
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

  updateTag("report-data");
  updateTag("dashboard-data");
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
      // TODO(C-04a Phase F/G): `cancelled_at` is created by Phase F's
      // migration. Attempt it first so the clear joins the convention the
      // moment the column is live, and fall back while it is absent.
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

  // Cancel any cancellation email still sitting in the undo window. Inert until
  // Phase F adds `scheduled_for` and the `queued` delivery status — the filter
  // matches nothing until then, so the count stays 0 and nothing is suppressed.
  const { count: cancelledQueuedCount } = await adminClient
    .from("email_delivery_events")
    .update({ delivery_status: "cancelled_by_restore" }, { count: "exact" })
    .eq("booking_id", bookingId)
    .eq("event_type", "booking_cancellation_customer")
    .eq("delivery_status", "queued")
    .gt("scheduled_for", new Date().toISOString());

  const suppressRestoreEmail = (cancelledQueuedCount ?? 0) > 0;

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
      cancelled_queued_email: suppressRestoreEmail,
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

  const { data: booking } = await adminClient
    .from("bookings")
    .select("id, booking_date, start_time, end_time")
    .eq("id", assignment.booking_id)
    .single();

  if (!booking) return { error: "Booking not found." };

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

  updateTag("report-data");
  updateTag("dashboard-data");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${assignment.booking_id}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");

  return { success: true };
}

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

export async function respondToCustomerReschedule(formData: FormData): Promise<void> {
  const actor = await requireBookingManager();
  if (!actor || !canManageAllBookings(actor)) return;

  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const decisionRaw = String(formData.get("decision") ?? "") as RescheduleDecision;
  if (!bookingId || !RESCHEDULE_DECISIONS.includes(decisionRaw)) return;

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("bookings")
    .select(
      "id, reschedule_status, reschedule_requested_at, reschedule_preferred_date, reschedule_preferred_time, reschedule_note"
    )
    .eq("id", bookingId)
    .single();
  if (!beforeState || beforeState.reschedule_status !== "requested") return;

  const { data: updated, error } = await adminClient
    .from("bookings")
    .update({ reschedule_status: decisionRaw })
    .eq("id", bookingId)
    .select("id, reschedule_status")
    .single();
  if (error) return;

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
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");
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

    if (enquiryId) {
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
      revalidatePath("/admin/enquiries");
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
    revalidatePath("/admin/bookings");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/calendar");
    redirect(`/admin/bookings/${result.bookingId}`);
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
