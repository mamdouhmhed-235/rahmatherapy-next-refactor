// F3 (2026-08-17) — health notes must not reach a viewer without the permission.
//
// THE DEFECT THIS GUARDS
// `page.tsx` rendered `participant.health_notes` with no permission check of any
// kind — the only condition was `!claimableOnly`. Anyone who could open a
// booking read the client's health notes. The permission already existed
// (`canManageSensitiveClientNotes`) and simply was not applied on this surface.
//
// WHY THE REDACTION LIVES IN THE DATA LAYER
// Filtering in JSX would leave the value in the RSC payload sent to the browser,
// where it is readable regardless of what renders. These assertions therefore
// run against the data, which is the only place the fix is real.
//
// ⛔ THE CACHE KEY IS PART OF THIS FIX AND IS NOT TESTED HERE.
// `getBookingDetailData` caches for 60s and keys on explicit RBAC booleans.
// `canViewHealthNotes` was added to that key — without it, an entitled viewer's
// record would be cached and served to an unentitled one, which is worse than
// the original defect. That wiring is verified by reading the key construction
// in booking-detail-data.ts; it cannot be asserted from a pure-function test.
// If you ever remove it, this test will still pass. Do not remove it.

import { describe, expect, it } from "vitest";
import { redactHealthNotes } from "../booking-detail-data";

type Booking = Parameters<typeof redactHealthNotes>[0];

function makeBooking(): NonNullable<Booking> {
  return {
    id: "booking-1",
    health_notes: "Type 2 diabetic. Anticoagulants.",
    booking_participants: [
      { id: "p1", health_notes: "Recent shoulder surgery." },
      { id: "p2", health_notes: "Pregnant, second trimester." },
    ],
  } as unknown as NonNullable<Booking>;
}

describe("F3 — redactHealthNotes", () => {
  it("strips booking-level and participant-level notes when not entitled", () => {
    const result = redactHealthNotes(makeBooking(), false);

    expect(result?.health_notes).toBeNull();
    for (const participant of result?.booking_participants ?? []) {
      expect(participant.health_notes).toBeNull();
    }
  });

  it("leaves the record untouched when entitled", () => {
    const booking = makeBooking();
    const result = redactHealthNotes(booking, true);

    expect(result?.health_notes).toBe("Type 2 diabetic. Anticoagulants.");
    expect(result?.booking_participants?.[1]?.health_notes).toBe(
      "Pregnant, second trimester."
    );
  });

  it("does not mutate the input", () => {
    // The fetcher's result is cached. Mutating in place would poison the cached
    // object for every subsequent reader, entitled or not.
    const booking = makeBooking();
    redactHealthNotes(booking, false);

    expect(booking.health_notes).toBe("Type 2 diabetic. Anticoagulants.");
    expect(booking.booking_participants?.[0]?.health_notes).toBe(
      "Recent shoulder surgery."
    );
  });

  it("redacts EVERY participant, not just the first", () => {
    // A loop that returned early, or only handled the main contact, would still
    // pass a naive single-participant test.
    const result = redactHealthNotes(makeBooking(), false);
    const remaining = (result?.booking_participants ?? []).filter(
      (p) => p.health_notes !== null
    );
    expect(remaining).toHaveLength(0);
  });

  it("handles a null booking and an absent participant list", () => {
    expect(redactHealthNotes(null, false)).toBeNull();

    const noParticipants = { id: "b", health_notes: "x" } as unknown as NonNullable<Booking>;
    const result = redactHealthNotes(noParticipants, false);
    expect(result?.health_notes).toBeNull();
    expect(result?.booking_participants).toEqual([]);
  });
});
