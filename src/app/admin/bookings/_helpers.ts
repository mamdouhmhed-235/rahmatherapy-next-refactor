import { toBusinessDateTime } from "@/lib/time/london";

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
