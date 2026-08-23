// ⛔ GATE 08 — P3, FAMILY B, SCENARIO B4: THE ACCIDENTAL CANCELLATION.
//
//   ⛔ The Owner's question: "If a member of staff makes a mistake, can it be
//    undone cleanly?"
//
// Someone cancels the wrong booking. They notice straight away and put it back.
// ⛔ The test of "cleanly" is not that the row comes back — it is that THE
// CUSTOMER NEVER HEARS ABOUT IT. A cancellation email that goes out and is then
// followed by "actually, ignore that" is worse than the mistake.
//
// ── ⛔ THE MECHANISM, AND WHY THIS SCENARIO EXISTS ───────────────────────
//
// Cancelling is deliberately asymmetric, and it is the only send in the product
// that works this way:
//   - the BUSINESS recipients are told IMMEDIATELY — internal staff want real
//     time notice;
//   - the CUSTOMER's message is PARKED in `email_delivery_events` as
//     `delivery_status = 'queued'` with a `scheduled_for` a few seconds out,
//     for the `scheduled-emails` cron to drain.
// ⛔ That gap IS the Undo window. `restoreBooking` sweeps the queued row before
// the cron can claim it — `delivery_status = 'queued'` is the whole test for
// "not yet sent", because the cron flips a row OUT of `queued` before it
// dispatches.
//
// ⚠️ `booking-restore-guards.spec.ts` already covers the restore GUARDS (the
// 28-day window, the expired case, the refusals). ⛔ What it does not do is
// follow one booking through mistake → notice → undo and check the customer was
// never told. That is this file.
//
// ── ⛔ EMAIL COST: ONE message to the real business inbox ────────────────
// The cancellation alert, which is sent immediately and CANNOT be recalled —
// so the Owner does get told about a mistake that was undone. ⚠️ That is worth
// knowing and is asserted, not hidden.

import { expect, test } from "@playwright/test";
import {
  auditActions,
  awaitAction,
  destroyScenarioFixtures,
  emailEvents,
  gotoAdmin,
  pageAs,
  readAssignments,
  readBooking,
  REAL_OWNER_INBOX,
  seedWebsiteBooking,
  serviceClient,
  THERAPIST_A_STAFF_ID,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

let booking: SeededBooking;
let snapshot: Record<string, unknown> = {};

const MUST_SURVIVE = [
  "booking_date",
  "start_time",
  "end_time",
  "total_price",
  "amount_due",
  "total_duration_mins",
  "client_id",
  "contact_email",
  "assignment_status",
] as const;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (!booking?.clientId) return;
  await destroyScenarioFixtures(serviceClient(), [booking.clientId]);
});

/**
 * ⛔ A menu item and its confirmation button share an accessible name here
 * (Cancel, Restore, Mark no-show). Click the control, then confirm INSIDE the
 * dialog if one opens — scoping to the dialog is what stops the second click
 * landing back on the trigger.
 */
async function clickAndConfirm(page: import("@playwright/test").Page, name: RegExp) {
  await page.getByRole("button", { name }).first().click();
  await page.waitForTimeout(800);

  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name });
  if ((await confirm.count()) > 0) {
    await awaitAction(page, async () => {
      await confirm.first().click();
    });
    return;
  }
  // No modal — the first click was the action itself.
  await page.waitForTimeout(2_000);
}

test.describe("B4 — the accidental cancellation: can a mistake be undone cleanly?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — an admin cancels the wrong booking", async ({ browser }) => {
    const db = serviceClient();

    booking = await seedWebsiteBooking(db, "B4", {
      dayOffset: 35,
      status: "confirmed",
      assignTo: THERAPIST_A_STAFF_ID,
    });
    snapshot = await readBooking(db, booking.bookingId);

    const { context, page } = await pageAs(browser, "admin");
    await gotoAdmin(page, `/admin/bookings/${booking.bookingId}/`, "the booking detail page");
    await expect(page.locator("#booking-status-form")).toBeVisible({ timeout: 30_000 });

    await clickAndConfirm(page, /^Cancel booking$/);
    await context.close();

    const after = await readBooking(db, booking.bookingId);
    expect(
      after.status,
      "the cancellation must actually take effect — otherwise there is no mistake to undo",
    ).toBe("cancelled");
    expect(
      after.cancelled_at,
      "⛔ the moment of cancellation must be stamped — the undo window is measured from it",
    ).not.toBeNull();

    expect(
      await auditActions(db, booking.bookingId),
      "⛔ a cancellation is a real action on a real customer and must be on the record",
    ).toContain("booking_quick_cancel");
  });

  test("step 2 — the customer has NOT been told yet, but the clinic has", async () => {
    expect(booking?.bookingId).toBeTruthy();
    const db = serviceClient();
    const events = await emailEvents(db, booking.bookingId);

    // ⛔ THE UNDO WINDOW, VISIBLE IN THE DATA.
    const customerLeg = events.filter((e) => e.recipient_role === "customer");
    expect(
      customerLeg.length,
      "the customer's cancellation message should have been prepared",
    ).toBeGreaterThan(0);
    expect(
      customerLeg.every((e) => e.delivery_status === "queued"),
      `⛔ the customer's cancellation must be PARKED, not sent — that gap is the only chance to undo a mistake before they read it. Statuses were: ${customerLeg.map((e) => `${e.event_type}=${e.delivery_status}`).join(", ")}`,
    ).toBe(true);

    // ⚠️ The business leg is immediate and CANNOT be recalled.
    const toOwner = events.filter((e) => (e.recipient_email ?? e.to_email) === REAL_OWNER_INBOX);
    expect(
      toOwner.length,
      "⛔ the clinic is told at once — staff want real-time notice even of a mistake",
    ).toBe(1);
    expect(
      toOwner[0].delivery_status,
      "⚠️ and that one has already gone: the Owner WILL see a cancellation alert for a booking that was put straight back",
    ).toBe("accepted");
  });

  test("step 3 — they notice, and put it back", async ({ browser }) => {
    expect(booking?.bookingId).toBeTruthy();
    const db = serviceClient();

    const { context, page } = await pageAs(browser, "admin");
    await gotoAdmin(page, `/admin/bookings/${booking.bookingId}/`, "the cancelled booking");
    await clickAndConfirm(page, /^Restore booking$/);
    await context.close();

    const after = await readBooking(db, booking.bookingId);
    expect(
      after.status,
      "⛔ the booking must come back live, or the customer turns up to nothing",
    ).toBe("confirmed");

    expect(
      await auditActions(db, booking.bookingId),
      "⛔ BOTH actions belong on the record — the mistake and the correction. A restore that hid the cancellation would make the trail a lie",
    ).toEqual(expect.arrayContaining(["booking_quick_cancel", "booking_restored"]));
  });

  test("step 4 — the customer never heard about it, and nothing else moved", async () => {
    expect(booking?.bookingId).toBeTruthy();
    const db = serviceClient();
    const events = await emailEvents(db, booking.bookingId);

    // ── ⛔ THE POINT OF THE WHOLE SCENARIO ─────────────────────────────
    const cancellationsToCustomer = events.filter(
      (e) => e.recipient_role === "customer" && /cancel/i.test(e.event_type),
    );
    expect(
      cancellationsToCustomer.filter((e) => e.delivery_status === "accepted"),
      `⛔ THE CUSTOMER WAS TOLD their booking was cancelled, and it wasn't. Restoring inside the undo window must sweep the queued message before the cron sends it. Rows: ${cancellationsToCustomer.map((e) => `${e.event_type}=${e.delivery_status}`).join(", ")}`,
    ).toHaveLength(0);
    expect(
      cancellationsToCustomer.filter((e) => e.delivery_status === "queued"),
      "⛔ and it must not still be sitting queued either — the cron would send it later, out of the blue",
    ).toHaveLength(0);

    // ── The booking itself came back whole ─────────────────────────────
    const after = await readBooking(db, booking.bookingId);
    for (const field of MUST_SURVIVE) {
      expect(
        after[field],
        `⛔ restoring changed "${field}" from ${JSON.stringify(snapshot[field])} to ${JSON.stringify(after[field])}. An undo must put the booking back as it was, not approximately back.`,
      ).toEqual(snapshot[field]);
    }

    const assignments = await readAssignments(db, booking.bookingId);
    expect(
      assignments[0].assigned_staff_id,
      "⛔ and the therapist who was going to do it is still on it — otherwise the visit is unstaffed and nobody knows",
    ).toBe(THERAPIST_A_STAFF_ID);

    const toOwner = events.filter((e) => (e.recipient_email ?? e.to_email) === REAL_OWNER_INBOX);
    console.log(
      `\n[B4] COMPLETE. cancelled then restored; customer never told; ` +
        `${events.length} emails, ${toOwner.length} to ${REAL_OWNER_INBOX}\n`,
    );
  });
});
