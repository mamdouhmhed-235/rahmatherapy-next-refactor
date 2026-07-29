import { getBusinessDate, toBusinessDateTime } from "@/lib/time/london";
import type { BookingStatus } from "./types";

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
 * C-04a Phase H — an admin cancellation parks the customer's email in
 * `email_delivery_events` as `queued` with `scheduled_for = now + this`, instead
 * of sending it. That gap is the undo window: a restore inside it sweeps the row
 * to `cancelled_by_restore` and the client never hears about a booking that is
 * still on.
 *
 * One binding for the two servers (`delaySeconds` on both admin cancel paths)
 * and the two clients (the cancel toast's `duration`). It lives here rather than
 * in `actions.ts` for a hard reason: that module is `"use server"`, so every
 * export has to be an async function — a plain number cannot be exported from it.
 */
export const CANCELLATION_UNDO_DELAY_SECONDS = 10;

/**
 * How long the cancel toast — and therefore its Undo — stays on screen.
 *
 * Deliberately SHORTER than the delay, not equal to it. The delay is measured on
 * the server when the queued row is written; the toast's clock starts later, once
 * the action has returned and React has rendered. Equal values therefore leave
 * the Undo on screen past the instant the cron may claim the row, and the admin
 * who takes it gets a restore that races a cancellation already going out. The
 * margin buys back the round trip.
 */
export const CANCELLATION_UNDO_TOAST_MS =
  CANCELLATION_UNDO_DELAY_SECONDS * 1000 - 500;

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
 * unified admin+customer stamp: added by Phase F's migration, written by both
 * admin cancel paths since Phase H. `customer_cancelled_at` is the older
 * customer-flow column, kept as the fallback for rows cancelled before that.
 *
 * INVARIANT — load-bearing, not tidiness. `cancelled_at` is REQUIRED on
 * `BookingRecord` (./types.ts) and named in all four projections that build one:
 * `BOOKING_SELECT` and `CLAIMABLE_BOOKING_SELECT` in `bookings/page.tsx`, and
 * `BOOKING_DETAIL_SELECT` and `CLAIMABLE_BOOKING_DETAIL_SELECT` in
 * `bookings/[bookingId]/page.tsx`. Those rows arrive through unchecked
 * `.returns<BookingRecord[]>()` / `.single<BookingRecord>()` casts against an
 * untyped admin client, so the type cannot police the column strings: drop
 * `cancelled_at` from any ONE of the four and it reads `undefined` at runtime
 * with tsc, lint and vitest all green. `isRestoreWindowExpired` below then fails
 * closed, and every cancelled booking renders "the 28-day restore window has
 * passed" — silently removing Restore for whichever role that projection serves.
 * The RBAC pair matters as much as the type: the two `CLAIMABLE_*` strings serve
 * the therapist scope, the other two the full scope.
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
] as const satisfies readonly BookingStatus[];

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

/**
 * C-05 Phase C — lifted from `bookings/page.tsx` (was private there) so the
 * detail page's `isBookingActive` derivation and the list page's claimable
 * queries read "today" the same way. `page.tsx` re-exports this name so any
 * existing import of it from that module keeps working.
 */
export function getTodayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * C-05 Phase D (Edit Point 9, brief §2.8/§4.6) — shared between the bookings
 * list row card (`page.tsx`) and the client detail page's `BookingHistoryCard`
 * (`clients/[clientId]/page.tsx`). Both row shapes converged on the same two
 * classes, so the derivation is lifted here rather than duplicated. `today`
 * is the caller's responsibility (from `getTodayIsoDate()`), not recomputed
 * per row.
 */
export function inertRowClassNames(
  booking: { status: string; booking_date: string },
  today: string
) {
  const isInert =
    ["cancelled", "no_show"].includes(booking.status) ||
    booking.booking_date < today;
  return {
    isInert,
    rowClass: isInert ? "opacity-75" : undefined,
    titleClass: isInert
      ? "line-through decoration-[var(--admin-text-muted)] decoration-1"
      : undefined,
  };
}
