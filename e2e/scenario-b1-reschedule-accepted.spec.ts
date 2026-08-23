// ⛔ GATE 08 — P3, FAMILY B, SCENARIO B1: THE CHANGE OF PLAN.
//
//   ⛔ The Owner's question: "Can I move an appointment without losing the slot
//    or the customer?"
//
// ── ⛔ THE ANSWER IS NOT THE ONE THE PLAN ASSUMED, AND THAT IS THE POINT ──
//
// `WORKFLOW-COVERAGE.md` describes B1 as *"customer requests a reschedule →
// admin accepts → old slot frees, new one fills"*. ⛔ **The old slot does NOT
// free and the new one does NOT fill, because accepting a reschedule does not
// move the booking — and NOTHING in the admin can move it.**
//
// Measured, two ways:
//   1. ⛔ `booking_date` is never UPDATEd anywhere in `src/`. It is written at
//      creation by `create_booking_request` and by the manual-booking action,
//      and read everywhere else. There is no booking edit page — the only
//      routes under `/admin/bookings` are `new`, `series/[templateId]` and
//      `[bookingId]`.
//   2. ✅ Driven live: accepting a request for 2026-10-20 14:00 left the
//      booking sitting at 2026-09-25 10:00 and moved `reschedule_status`
//      `requested` → `reviewed`. Nothing else changed.
//
// ⚠️ **This is DISCLOSED, not hidden.** The panel says, in the product's own
// words: *"Accepting or declining records the response in the audit trail. Move
// the booking to a new date / time separately if you've agreed one with the
// customer."*
//
// ⛔ UPDATE — D-051, LATER THE SAME DAY. When this was reported, the Owner's
// answer was: *"its an important feature and one i thought we already had, so
// we will have to build this."* **There is now a "Move appointment" panel** on
// the booking detail page (`MoveBookingPanel`, action `rescheduleBooking`,
// covered by `e2e/booking-move.spec.ts` and
// `src/app/admin/bookings/__tests__/rescheduleBooking.test.ts`).
//
// ⛔ WHAT B1 ASSERTS IS STILL TRUE, AND STILL WORTH ASSERTING: **accepting a
// request is not the same as moving the booking.** "Accept" records the
// answer; moving is a separate, deliberate act with its own availability
// check. Those are two decisions and the product keeps them apart — an
// operator can agree a change in principle and move it when they have
// arranged cover.
//
// ⚠️ So this spec is no longer recording a gap. It is pinning the BOUNDARY
// between the two actions. If accepting ever silently started moving the
// booking, this goes red — and it should, because the availability check
// lives in the move, not in the accept.
//
// ── ⛔ EMAIL COST: ONE message to the real business inbox ────────────────
// The customer's request goes through `resolveBusinessNotificationRecipients`
// (`sendBookingRescheduleRequestEmails`), and a customer-initiated request has
// no actor to exclude the Owner with. ✅ The admin's ACCEPT has no email path at
// all — asserted at the end rather than assumed.

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
  date: isoDaysFromToday(45),
  time: "14:00",
  note: "ZZTEST — work meeting moved, can we do the afternoon instead?",
};

let booking: SeededBooking;
let manageUrl = "";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (!booking?.clientId) return;
  await destroyScenarioFixtures(serviceClient(), [booking.clientId]);
});

test.describe("B1 — the change of plan: can I move an appointment?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — the customer asks to move their appointment", async ({ page }) => {
    const db = serviceClient();

    // A live, staffed booking. Seeded: B1 is about what happens NEXT, and the
    // booking paths are already proven by family A.
    booking = await seedWebsiteBooking(db, "B1", {
      dayOffset: 30,
      status: "confirmed",
      assignTo: THERAPIST_A_STAFF_ID,
    });
    manageUrl = await mintManageUrl(db, booking.bookingId, booking.date);

    // ⛔ NO admin session — this is the customer on their own phone.
    await requestRescheduleAsCustomer(page, manageUrl, PREFERRED);

    const after = await readBooking(db, booking.bookingId);
    expect(
      (after as Record<string, unknown>).reschedule_status,
      "⛔ the clinic must know the customer wants to move — otherwise the request is lost and they are left waiting",
    ).toBe("requested");
    expect(
      String((after as Record<string, unknown>).reschedule_preferred_date ?? ""),
      "the date they asked for must be recorded, or the clinic has to ring them back to ask again",
    ).toBe(PREFERRED.date);
    expect(
      String((after as Record<string, unknown>).reschedule_preferred_time ?? "").slice(0, 5),
    ).toBe(PREFERRED.time);
    expect(
      String((after as Record<string, unknown>).reschedule_note ?? ""),
      "and so must what they said about it",
    ).toContain("work meeting moved");

    // ⛔ Asking is not moving. The appointment is still on.
    expect(after.status, "the booking stays live while the request is considered").toBe("confirmed");
    expect(after.booking_date, "and stays on its original day until somebody acts").toBe(booking.date);

    const events = await emailEvents(db, booking.bookingId);
    const toOwner = events.filter((e) => (e.recipient_email ?? e.to_email) === REAL_OWNER_INBOX);
    expect(
      toOwner.length,
      "⛔ a customer asking to move their appointment must reach the business inbox — nobody would see it otherwise",
    ).toBe(1);
  });

  test("step 2 — the front desk sees the request waiting for an answer", async ({ browser }) => {
    expect(booking?.bookingId).toBeTruthy();
    const { context, page } = await pageAs(browser, "admin");

    await gotoAdmin(page, `/admin/bookings/${booking.bookingId}/`, "the booking detail page");
    await expect(page.locator("#booking-status-form")).toBeVisible({ timeout: 30_000 });

    const shown = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(
      shown,
      `⛔ the reschedule request must be visible on the booking. The page said: "${shown.slice(0, 400)}"`,
    ).toMatch(/Customer reschedule request/i);
    expect(shown, "with the date the customer asked for").toContain(PREFERRED.date);
    expect(shown, "and their reason").toContain("work meeting moved");
    expect(shown, "and marked as still needing an answer").toMatch(/Awaiting response/i);

    await expect(
      page.getByRole("button", { name: /^Accept request$/ }),
      "the admin must be able to say yes",
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Decline request$/ }),
      "and to say no",
    ).toBeVisible();

    await context.close();
  });

  test("step 3 — the admin accepts, and the booking does NOT move", async ({ browser }) => {
    expect(booking?.bookingId).toBeTruthy();
    const db = serviceClient();
    const before = await readBooking(db, booking.bookingId);

    const { context, page } = await pageAs(browser, "admin");
    await gotoAdmin(page, `/admin/bookings/${booking.bookingId}/`, "the booking detail page");
    await awaitAction(page, async () => {
      await page.getByRole("button", { name: /^Accept request$/ }).click();
    });
    await context.close();

    const after = await readBooking(db, booking.bookingId);

    expect(
      (after as Record<string, unknown>).reschedule_status,
      "the request has been answered and is no longer waiting",
    ).toBe("reviewed");
    expect(
      await auditActions(db, booking.bookingId),
      "and the answer is on the record",
    ).toContain("booking_reschedule_reviewed");

    // ── ⛔ THE ASSERTION THAT DOCUMENTS THE REAL BEHAVIOUR ──────────────
    //
    // ⛔ Accepting records the answer. It does NOT move the appointment — that
    // is the separate "Move appointment" panel (D-051), which runs its own
    // availability check. Keeping them apart is deliberate: agreeing to a
    // change and having somebody free to cover it are different questions.
    expect(
      after.booking_date,
      `⛔ accepting a reschedule does NOT move the booking. It is still on ${before.booking_date}, ` +
        `not the ${PREFERRED.date} the customer asked for. The clinic must cancel and re-book to move it.`,
    ).toBe(before.booking_date);
    expect(
      String(after.start_time).slice(0, 5),
      "and the time is unchanged too",
    ).toBe(String(before.start_time).slice(0, 5));

    // ⛔ Everything else about the booking must be untouched — accepting is a
    // note-to-self, not an edit.
    expect(after.status, "the visit is still on").toBe("confirmed");
    expect(after.assignment_status, "the therapist is still on it").toBe("fully_assigned");
    expect(Number(after.total_price), "and it still costs the same").toBe(booking.totalPrice);

    const assignments = await readAssignments(db, booking.bookingId);
    expect(
      assignments[0].assigned_staff_id,
      "⛔ the same therapist keeps the job — answering a reschedule must not quietly unassign anyone",
    ).toBe(THERAPIST_A_STAFF_ID);
  });

  test("step 4 — answering the request, on its own, emailed nobody", async () => {
    expect(booking?.bookingId).toBeTruthy();
    const db = serviceClient();

    const events = await emailEvents(db, booking.bookingId);
    const toOwner = events.filter((e) => (e.recipient_email ?? e.to_email) === REAL_OWNER_INBOX);

    // ⛔ Still ONE — the customer's request. `respondToCustomerReschedule` has
    // no email path at all, which is worth pinning: the customer is NOT told
    // their request was accepted, so somebody has to ring them.
    expect(
      toOwner.length,
      `⛔ the business inbox should still hold exactly the ONE request alert. It has ${toOwner.length}: ${toOwner.map((e) => e.event_type).join(", ")}`,
    ).toBe(1);

    const toCustomer = events.filter((e) => e.recipient_role === "customer");
    expect(
      toCustomer.some((e) => /reschedul/i.test(e.event_type)),
      "⚠️ MEASURED: ACCEPTING on its own sends the customer nothing. ✅ Since D-051 the " +
        "MOVE does email them (`booking_moved_client`), so the customer is told once the " +
        "appointment actually changes — which is the moment that matters to them.",
    ).toBe(false);

    console.log(
      `\n[B1] COMPLETE. request recorded and accepted; booking did NOT move; ` +
        `${events.length} emails, ${toOwner.length} to ${REAL_OWNER_INBOX}\n`,
    );
  });
});
