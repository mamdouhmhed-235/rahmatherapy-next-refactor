// ⛔ GATE 08 — P3, FAMILY A, SCENARIO A5: TWO SERVICES ON ONE BOOKING.
//
//   ⛔ The Owner's question: "Is the price and the length right when someone
//    books more than one thing?"
//
// ── ⛔ WHAT THE FORM ACTUALLY ALLOWS — measured, and I had it wrong first ──
//
// My first reading of the booking form was that a customer can pick only ONE
// package: choosing Fire Package after Hijama Package replaced it, and the
// running total went £45 → £40 rather than £85. ⛔ That conclusion was WRONG,
// and reporting it would have told the Owner their website was less capable
// than it is.
//
// `togglePackage` (`src/features/booking/store/booking-store.ts:44`) drops any
// selection sharing the new package's `group`, then adds the new one. Hijama
// and Fire are BOTH "Hijama & cupping", so one replaces the other — correctly,
// since nobody has two cupping treatments in one visit. A massage is a
// different group, so it ADDS.
//
// ⛔ So the rule is ONE PER CATEGORY, not one in total. Measured live:
//     Hijama £45                      -> £45
//     + Fire £40   (same category)    -> £40   (replaced)
//     + 1-Hour Massage £60 (different) -> £100
//     back to Hijama £45 + Massage £60 -> £105
//
// ── ⛔ WHY THE PRICE IS ASSERTED IN THE DATABASE, NOT ON THE SCREEN ───────
//
// The £105 on the customer's screen is a convenience. What the clinic charges
// comes from `create_booking_request`, which reads each service's own row and
// snapshots it onto `booking_items`. ⛔ A test that only read the total off the
// page would pass even if the server billed something else entirely, which is
// the failure that actually costs money.
//
// ── ⛔ EMAIL COST: 3 messages, ONE of them to the real business inbox ─────

import { expect, test } from "@playwright/test";
import {
  destroyScenarioFixtures,
  readBooking,
  readBookingItems,
  readParticipants,
  REAL_OWNER_INBOX,
  RUN_TAG,
  serviceClient,
  submitPublicBooking,
  testInbox,
  waitForEmailEvents,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

/** ⛔ Measured against the live `services` table by `pnpm verify:prices`. */
const HIJAMA = { label: "Hijama Package", price: 45, mins: 60 };
const MASSAGE = { label: "1-Hour Massage Therapy", price: 60, mins: 60 };
const EXPECTED_TOTAL = HIJAMA.price + MASSAGE.price; // £105
const EXPECTED_MINUTES = HIJAMA.mins + MASSAGE.mins; // 120

let clientId = "";

test.afterAll(async () => {
  if (!clientId) return;
  await destroyScenarioFixtures(serviceClient(), [clientId]);
});

test.describe("A5 — two services on one booking: is the price and the length right?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("a customer books cupping AND a massage, and the clinic charges for both", async ({ page }) => {
    const db = serviceClient();

    const { bookingId, chosenTime } = await submitPublicBooking(page, {
      name: `ZZTEST-A5-${RUN_TAG}`,
      email: testInbox("a5"),
      phone: "07700900105",
      // ⛔ Two DIFFERENT categories — the only combination the form allows.
      packages: [HIJAMA.label, MASSAGE.label],
      participants: [{ gender: "female" }],
    });

    const booking = await readBooking(db, bookingId);
    clientId = String(booking.client_id);

    expect(
      Number(booking.total_price),
      `⛔ two services must be charged as £${HIJAMA.price} + £${MASSAGE.price}. If this reads £${HIJAMA.price} or £${MASSAGE.price}, the clinic is doing one of them for free.`,
    ).toBe(EXPECTED_TOTAL);

    expect(
      Number(booking.amount_due),
      "what the customer owes must match what they were quoted",
    ).toBe(EXPECTED_TOTAL);

    expect(
      Number((booking as Record<string, unknown>).total_duration_mins),
      `⛔ the therapist needs ${EXPECTED_MINUTES} minutes booked out, not ${HIJAMA.mins}. Too short and the next customer is booked on top of this one.`,
    ).toBe(EXPECTED_MINUTES);

    // ⛔ The slot must be blocked for the FULL length, or the double-booking is
    // real rather than theoretical.
    const [startHour, startMinute] = String(booking.start_time).split(":").map(Number);
    const endMinutes = startHour * 60 + startMinute + EXPECTED_MINUTES;
    const expectedEnd = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
    expect(
      String((booking as Record<string, unknown>).end_time ?? "").slice(0, 5),
      `a ${EXPECTED_MINUTES}-minute visit starting at ${chosenTime} must end at ${expectedEnd}`,
    ).toBe(expectedEnd);

    // ── ⛔ ONE PERSON, TWO TREATMENTS — not two people ──────────────────
    const participants = await readParticipants(db, bookingId);
    expect(
      participants,
      "⛔ booking two services is ONE person having two treatments, not a group of two",
    ).toHaveLength(1);
    expect(booking.assignment_status, "one person still needs only one therapist").toBe("unassigned");

    // ── The line items the clinic will actually work from ──────────────
    const items = await readBookingItems(db, bookingId);
    expect(items, "each treatment must appear as its own line").toHaveLength(2);

    const byName = Object.fromEntries(items.map((i) => [i.service_name_snapshot, i]));
    for (const service of [HIJAMA, MASSAGE]) {
      const line = byName[service.label];
      expect(line, `⛔ "${service.label}" is missing from the booking entirely`).toBeTruthy();
      // ⛔ SNAPSHOTS. These are what protect an already-booked customer from a
      // later price change (scenario F4's subject), so they must be the real
      // figures and not zero-filled placeholders.
      expect(
        Number(line.service_price_snapshot),
        `"${service.label}" was recorded at the wrong price`,
      ).toBe(service.price);
      expect(
        Number(line.service_duration_snapshot),
        `"${service.label}" was recorded at the wrong length`,
      ).toBe(service.mins);
    }

    // ── The clinic is told, once ───────────────────────────────────────
    const events = await waitForEmailEvents(db, bookingId, 3);
    expect(events).toHaveLength(3);
    expect(
      events.filter((e) => (e.recipient_email ?? e.to_email) === REAL_OWNER_INBOX),
      "exactly one message reaches the real business inbox",
    ).toHaveLength(1);

    console.log(
      `\n[A5] ${HIJAMA.label} + ${MASSAGE.label} = £${booking.total_price} over ` +
        `${(booking as Record<string, unknown>).total_duration_mins} mins, 2 line items. ` +
        `3 emails, 1 to ${REAL_OWNER_INBOX}\n`,
    );
  });
});
