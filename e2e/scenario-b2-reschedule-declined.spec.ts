// ⛔ GATE 08 — P3, FAMILY B, SCENARIO B2: THE RESCHEDULE I CAN'T DO.
//
//   ⛔ The Owner's question: "Does declining leave the original booking exactly
//    as it was?"
//
// A customer asks to move to a day the clinic cannot cover. The front desk says
// no. ⛔ The appointment they already have must survive that untouched — same
// day, same time, same therapist, same price, still confirmed. A "no" to a
// change request must never become a "no" to the booking.
//
// ── ⛔ WHY THIS IS NOT JUST B1 WITH A DIFFERENT BUTTON ───────────────────
//
// It is the MIRROR CASE, and mirror cases are where this codebase has hurt
// itself before: three fixes in session H were each correct for the case they
// targeted and broke the opposite one. `respondToCustomerReschedule` takes a
// `decision` of `reviewed` or `declined` through the SAME code path, so a guard
// or a write that is right for accept and wrong for decline would be invisible
// to B1 alone.
//
// ⛔ The strongest assertion here is the NEGATIVE one: a full before/after
// comparison of every field that matters, so a decline that quietly cancelled,
// unassigned, re-priced or moved the booking cannot pass.
//
// ── ⛔ EMAIL COST: ONE message to the real business inbox ────────────────
// The customer's request. ✅ Declining has no email path — asserted, which also
// means the customer is NOT told they were declined. Somebody has to ring them.

import { expect, test } from "@playwright/test";
import {
  auditActions,
  awaitAction,
  destroyScenarioFixtures,
  emailEvents,
  gotoAdmin,
  isoDaysFromToday,
  mintManageUrl,
  pageAs,
  readAssignments,
  readBooking,
  REAL_OWNER_INBOX,
  requestRescheduleAsCustomer,
  seedWebsiteBooking,
  serviceClient,
  THERAPIST_A_STAFF_ID,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const PREFERRED = {
  date: isoDaysFromToday(46),
  time: "18:30",
  note: "ZZTEST — could we do the evening instead?",
};

/** ⛔ Every field a decline must leave alone. */
const MUST_NOT_CHANGE = [
  "booking_date",
  "start_time",
  "end_time",
  "status",
  "assignment_status",
  "payment_status",
  "amount_paid",
  "amount_due",
  "total_price",
  "total_duration_mins",
  "client_id",
  "contact_email",
  "cancelled_at",
  "customer_cancelled_at",
] as const;

let booking: SeededBooking;
let snapshot: Record<string, unknown> = {};

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (!booking?.clientId) return;
  await destroyScenarioFixtures(serviceClient(), [booking.clientId]);
});

test.describe("B2 — the reschedule I can't do: does saying no leave the booking alone?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — a customer asks for a day the clinic cannot do", async ({ page }) => {
    const db = serviceClient();

    booking = await seedWebsiteBooking(db, "B2", {
      dayOffset: 31,
      status: "confirmed",
      assignTo: THERAPIST_A_STAFF_ID,
    });
    const manageUrl = await mintManageUrl(db, booking.bookingId, booking.date);

    // ⛔ Snapshot BEFORE the customer touches anything, so the comparison at the
    // end covers the request as well as the decline.
    snapshot = await readBooking(db, booking.bookingId);

    await requestRescheduleAsCustomer(page, manageUrl, PREFERRED);

    const after = await readBooking(db, booking.bookingId);
    expect(after.reschedule_status, "the request must reach the clinic").toBe("requested");

    // ⛔ Even ASKING must not disturb the booking. A request is a question, not
    // an edit — and it arrives from an unauthenticated page.
    for (const field of MUST_NOT_CHANGE) {
      expect(
        after[field],
        `⛔ merely ASKING to reschedule changed "${field}". A customer's question must never edit their booking.`,
      ).toEqual(snapshot[field]);
    }
  });

  test("step 2 — the front desk declines it", async ({ browser }) => {
    expect(booking?.bookingId).toBeTruthy();
    const db = serviceClient();

    const { context, page } = await pageAs(browser, "admin");
    await gotoAdmin(page, `/admin/bookings/${booking.bookingId}/`, "the booking detail page");
    await expect(page.locator("#booking-status-form")).toBeVisible({ timeout: 30_000 });

    await awaitAction(page, async () => {
      await page.getByRole("button", { name: /^Decline request$/ }).click();
    });
    await context.close();

    const after = await readBooking(db, booking.bookingId);

    expect(
      after.reschedule_status,
      "⛔ the request must be closed off, or it sits in the attention queue for ever",
    ).toBe("declined");

    expect(
      await auditActions(db, booking.bookingId),
      "⛔ saying no to a customer is a decision, and it must be on the record",
    ).toContain("booking_reschedule_declined");
  });

  test("step 3 — and the appointment they already have is untouched", async () => {
    expect(booking?.bookingId).toBeTruthy();
    const db = serviceClient();
    const after = await readBooking(db, booking.bookingId);

    // ── ⛔ THE WHOLE POINT OF B2 ────────────────────────────────────────
    for (const field of MUST_NOT_CHANGE) {
      expect(
        after[field],
        `⛔ declining the reschedule changed "${field}" from ${JSON.stringify(snapshot[field])} to ${JSON.stringify(after[field])}. ` +
          `Saying no to a CHANGE must never change the booking itself — the customer still has an appointment and would turn up to it.`,
      ).toEqual(snapshot[field]);
    }

    // Belt and braces on the two that would hurt most, in plain terms.
    expect(after.status, "the customer still has their appointment").toBe("confirmed");
    expect(after.booking_date, "on the day they originally booked").toBe(booking.date);

    const assignments = await readAssignments(db, booking.bookingId);
    expect(assignments, "one participant, one assignment").toHaveLength(1);
    expect(
      assignments[0].assigned_staff_id,
      "⛔ and the therapist who was going to do it is still on it",
    ).toBe(THERAPIST_A_STAFF_ID);
    expect(assignments[0].status).toBe("assigned");

    // ── Email ──────────────────────────────────────────────────────────
    const events = await emailEvents(db, booking.bookingId);
    const toOwner = events.filter((e) => (e.recipient_email ?? e.to_email) === REAL_OWNER_INBOX);
    expect(
      toOwner.length,
      `⛔ exactly the ONE request alert should have reached the business inbox. It holds ${toOwner.length}: ${toOwner.map((e) => e.event_type).join(", ")}`,
    ).toBe(1);

    expect(
      events.some((e) => e.recipient_role === "customer" && /reschedul|declin/i.test(e.event_type)),
      "⛔ MEASURED: declining tells the customer NOTHING. They asked to move, heard nothing back, " +
        "and still have the original appointment. Whoever declines has to ring them.",
    ).toBe(false);

    console.log(
      `\n[B2] COMPLETE. declined; booking untouched on ${after.booking_date}; ` +
        `${events.length} emails, ${toOwner.length} to ${REAL_OWNER_INBOX}\n`,
    );
  });
});
