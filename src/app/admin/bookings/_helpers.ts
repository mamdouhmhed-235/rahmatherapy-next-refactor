import { getBusinessDate, toBusinessDateTime } from "@/lib/time/london";

/**
 * Shared booking predicates. Deliberately free of server-only imports so the
 * server action, the detail page and (from C-04a Phase G) the list row menu all
 * read the same rules. C-05 and C-13 extend this module — do not rename an
 * export without checking those plans.
 */

/**
 * S7 (C-04a) — a cancelled booking stays restorable for 28 days from the
 * cancellation moment. Tunable code constant; brief §5.12.
 */
export const RESTORE_WINDOW_DAYS = 28;

const RESTORE_WINDOW_MS = RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * The appointment moment as a real instant. `booking_date` is "YYYY-MM-DD" and
 * `start_time` is "HH:MM[:SS]", both stored as Europe/London wall-clock values,
 * so the BST/GMT offset has to be resolved before they mean anything.
 */
export function computeBookingMomentLondon(bookingDate: string, startTime: string) {
  return toBusinessDateTime(bookingDate, startTime);
}

/**
 * S6 (C-04a) — restore is refused once the appointment moment itself has gone.
 * Stricter than C-05's date-only lockdown on purpose: a booking whose moment
 * has passed should not be resurrected. Brief §5.8.
 */
export function isBookingMomentPastLondon(booking: {
  booking_date: string;
  start_time: string;
}): boolean {
  return (
    Date.now() >
    computeBookingMomentLondon(booking.booking_date, booking.start_time).getTime()
  );
}

/**
 * C-04a Phase C (W03-E-2) — `complete` and `no_show` record what happened, so
 * they only make sense once the booking's DAY has arrived. Date-only on
 * purpose, looser than S6's moment check: an admin must be able to mark today's
 * 18:00 visit a no-show at 17:55 when the therapist rings in. London's date,
 * not UTC's — `getBusinessDate` is the same source the availability and
 * reporting date guards use. The server action and the detail-page button read
 * this one predicate so the button can never offer what the action refuses.
 *
 * `now` is injectable for one reason: the London-vs-UTC difference only shows
 * up between 00:00 and 01:00 London during BST, so a spec has to name that
 * instant to pin the fix. No caller passes it.
 */
export function isBookingDateFutureLondon(
  booking: {
    booking_date: string | null;
  },
  now = new Date()
): boolean {
  return String(booking.booking_date ?? "").slice(0, 10) > getBusinessDate(now);
}

/**
 * The cancellation moment the S7 window is keyed to. `cancelled_at` is the
 * unified admin+customer stamp added by this plan's Phase F migration;
 * `customer_cancelled_at` is the customer-flow column that already exists.
 *
 * TODO(C-04a Phase F/G): `cancelled_at` is optional here only because the
 * column, `BookingRecord` and the `.select(...)` column strings all gain it
 * later. Until Phase G adds it to `BOOKING_SELECT` (`bookings/page.tsx`) and
 * `BOOKING_DETAIL_SELECT` (`bookings/[bookingId]/page.tsx`) *in the same change
 * as `types.ts`*, this reads `undefined` on every UI surface and the window
 * falls back to `customer_cancelled_at`.
 */
export function getCancellationMoment(booking: {
  cancelled_at?: string | null;
  customer_cancelled_at?: string | null;
}): string | null {
  return booking.cancelled_at ?? booking.customer_cancelled_at ?? null;
}

/**
 * S7 (C-04a) — expired once the cancellation is more than RESTORE_WINDOW_DAYS
 * old. An unknown or unparseable cancellation moment counts as expired: if the
 * stamping ever regresses, old cancellations lock rather than staying
 * restorable forever. Brief §5.12.
 */
export function isRestoreWindowExpired(booking: {
  cancelled_at?: string | null;
  customer_cancelled_at?: string | null;
}): boolean {
  const raw = getCancellationMoment(booking);
  if (!raw) return true;
  const cancelledAt = new Date(raw).getTime();
  if (Number.isNaN(cancelledAt)) return true;
  return Date.now() - cancelledAt > RESTORE_WINDOW_MS;
}

/**
 * C-04a Phase B — the reason accompanying a completed reopen has to be at least
 * this long. Lives here so the Status form's confirm modal and
 * `updateBookingManagement`'s server guard cannot drift apart.
 */
export const COMPLETED_REVERSAL_MIN_REASON_LENGTH = 5;

/**
 * The one status transition that is a mistake-correction rather than a routine
 * edit: leaving `completed`. Deliberately NOT S7-windowed — the force flag plus
 * a reason is the friction. Brief §5.12.
 */
export function isCompletedReversal(
  fromStatus: string,
  toStatus: string
): boolean {
  return fromStatus === "completed" && toStatus !== "completed";
}

/**
 * C-04a Phase D — the three statuses that record a finished outcome. Leaving
 * any of them is a mistake-correction that owes an audit action, a reason or a
 * client email, so nothing automatic may do it: `restoreBooking` and the Status
 * form are the only ways back out.
 *
 * `no_show` belongs here as much as `completed` and `cancelled` do. Nothing
 * cascades a booking-level cancel or no-show down to `booking_assignments`, so
 * a no-show booking keeps its assignments at `assigned` and the practitioner's
 * "Mark complete" stays live on it — without this list the auto-promoter would
 * flip that booking to `completed` and silently un-do the no-show.
 *
 * `quickUpdateBooking`'s three chip guards enumerate the same statuses but
 * deliberately do NOT read this list: each names its own source status so its
 * refusal can point at the right way back, and `cancelled` is closed there only
 * against `completed`. A set-membership test cannot say any of that.
 */
export const TERMINAL_BOOKING_STATUSES = [
  "completed",
  "cancelled",
  "no_show",
] as const;

export function isTerminalBookingStatus(status: string): boolean {
  return (TERMINAL_BOOKING_STATUSES as readonly string[]).includes(status);
}

/**
 * The same list as a PostgREST `in` value, for the race-guarded
 * `.not("status", "in", …)` on the auto-promote UPDATE. Derived rather than
 * written out again so the SQL-side filter and the predicate above cannot
 * disagree about what "terminal" means.
 */
export const TERMINAL_BOOKING_STATUS_FILTER = `("${TERMINAL_BOOKING_STATUSES.join(
  '","'
)}")`;
