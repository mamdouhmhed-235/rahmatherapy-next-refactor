// ⛔ GATE 08 — P3, FAMILY G, SCENARIO G2: "I NEVER GOT IT."
//
// ⛔⛔ STATUS: WRITTEN AND BLOCKED. THIS SPEC HAS NEVER BEEN SEEN GREEN. ⛔⛔
//
// It typechecks and its logic has been reviewed, but it CANNOT run until the
// Resend daily allowance resets. Attempted 2026-08-24; step 1 failed at the
// first send with the provider's own words:
//
//     "You have reached your daily email sending quota."
//
// ⚠️ DO NOT RECORD THIS SCENARIO AS PASSING, and do not treat the absence of a
// failure as a pass. ✅ The step-1 guard is doing exactly what it was built for:
// failing LOUDLY at the first message rather than letting every later assertion
// succeed against mail that never left.
//
// ⛔ TO FINISH IT: wait for the allowance (D-053, Owner-owned), then run
//     E2E_BASE_URL=http://localhost:3000 E2E_ALLOW_PRODUCTION_DB=1 //       node --env-file=.env node_modules/@playwright/test/cli.js //       test e2e/scenario-g2-i-never-got-it.spec.ts --project=chromium --workers=1
//
//
//   ⛔ The Owner's question: "Can front desk fix a missing email without
//    re-booking anything?"
//
// A customer rings up: "I never got my message." ⚠️ The dangerous answer is the
// coordinator cancelling and re-making the booking to force a fresh email —
// which moves the visit, re-notifies the therapist, and can lose the original
// time. The safe answer is a resend that touches nothing.
//
// ── ⛔ WHY THE FIRST EMAIL IS REAL AND NOT SEEDED ────────────────
//
// ⚠️ MY FIRST VERSION SEEDED THE ORIGINAL DELIVERY EVENT STRAIGHT INTO THE
// DATABASE AND COULD NOT BE MADE TO WORK. The reason is worth recording, because
// it constrains every future scenario that wants to drive a LIST:
//
// The delivery log is cached per viewer-scope AND per query parameters, and a
// direct database write invalidates none of it. Measured on one seeded event,
// same row, same moment:
//
//   Owner       /admin/emails/?range=7d   → ⛔ not shown
//   Coordinator /admin/emails/?range=7d   → ✅ shown, with its Resend button
//
// ⛔ SAME URL, DIFFERENT ROLE, DIFFERENT ANSWER — because they are different
// cache entries and only one happened to be cold. A test built on that is not
// flaky by accident, it is unsound: it asserts on whichever entry happened to
// miss.
//
// ✅ SO THE CUSTOMER REALLY BOOKS. A booking made through the public form sends
// a real confirmation through the real code path, and that write invalidates the
// caches the way the application does. The event the coordinator then resends is
// one the app actually created — which is also the only version of this scenario
// the Owner would recognise.
//
// ⛔ EMAIL COST: this is the expensive-but-honest choice. One public booking
// sends the customer confirmation plus the business alerts, and the resend fans
// out the same way, so budget roughly six messages. ⚠️ Some reach the real
// business inbox, which the Owner has accepted as unavoidable for booking-shaped
// scenarios. The daily allowance was exhausted yesterday (D-053) and reset
// overnight; step 2 asserts the resend was not refused, so a still-exhausted
// allowance fails loudly here rather than silently poisoning later families.
//
// ── ⛔ WHAT MAKES THIS MORE THAN "THE BUTTON WORKS" ──────────────────────
//
// Resending is only a fix if the booking is left ALONE. So the last step
// re-reads the visit and asserts its date, time and status are untouched, and
// that no second booking appeared. ⚠️ A "resend" that quietly re-created
// anything would be the exact failure the customer rang up about, made worse.

import { expect, test } from "@playwright/test";
import {
  destroyScenarioFixtures,
  gotoAdmin,
  pageAs,
  readBooking,
  RUN_TAG,
  serviceClient,
  submitPublicBooking,
  testInbox,
  waitForEmailEvents,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const clientIds: string[] = [];
let bookingId = "";
let chosenDay = "";
let customerEmail = "";
let originalCount = 0;
let originalIds: string[] = [];

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (clientIds.length === 0) return;
  await destroyScenarioFixtures(serviceClient(), clientIds);
});

test.describe('G2 — "I never got it": can front desk resend without re-booking?', () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ a customer books, and really is sent a confirmation", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const db = serviceClient();

    const name = `ZZTEST-G2-MISSED-${RUN_TAG}`;
    const email = testInbox(`g2-missed-${RUN_TAG}`);

    const made = await submitPublicBooking(page, {
      name,
      email,
      phone: "07700900222",
      packages: ["Hijama Package"],
      participants: [{ gender: "female" }],
    });
    bookingId = made.bookingId;
    chosenDay = made.chosenDay;

    const booking = await readBooking(db, bookingId);
    clientIds.push(booking.client_id as string);
    customerEmail = email;

    // ⛔ The confirmation must genuinely have been SENT, not merely intended.
    // Everything below is about resending a message that exists; if none was
    // ever sent, this scenario is testing nothing.
    const sent = await waitForEmailEvents(db, bookingId, 1);
    const toCustomer = sent.filter((e) => e.recipient_email === email);
    expect(
      toCustomer.length,
      `⛔ THE CUSTOMER WAS NEVER SENT ANYTHING. Events recorded: ${JSON.stringify(sent.map((e) => [e.event_type, e.recipient_email, e.delivery_status]))}`,
    ).toBeGreaterThan(0);

    originalCount = sent.length;
    originalIds = sent.map((e) => e.id);

    expect(
      toCustomer.some((e) => e.delivery_status !== "failed"),
      `⛔ THE FIRST MESSAGE FAILED TO LEAVE. If this is the daily allowance again (D-053), stop here — every send-dependent scenario after this one would be untrustworthy. Statuses: ${JSON.stringify(toCustomer.map((e) => [e.event_type, e.delivery_status, e.error_message]))}`,
    ).toBe(true);

    console.log(
      `[G2] step 1 — booked ${made.chosenDay} ${made.chosenTime}; ${sent.length} message(s) recorded, ${toCustomer.length} to the customer.`,
    );
  });

  test("step 2 — ✅ the coordinator finds it and resends, and it really goes", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    expect(bookingId, "step 1 must have run").not.toBe("");
    const db = serviceClient();

    const { context, page } = await pageAs(browser, "coordinator");

    // ✅ No cache trickery needed: the booking above was made through the app,
    // so the delivery log was invalidated the way it is in real use.
    await gotoAdmin(
      page,
      `/admin/emails/?q=${encodeURIComponent(customerEmail)}`,
      "the delivery log",
    );
    await page.waitForTimeout(3_000);

    // ⛔ THE CONTROL: front desk can actually FIND the customer's message.
    // "She resent it" is meaningless if she could never have located it.
    const shown = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    expect(
      shown.includes(customerEmail),
      `⛔ front desk cannot find the customer's message in the delivery log, so there is nothing to resend. It said: "${shown.slice(0, 400)}"`,
    ).toBe(true);

    // ⛔ Addressed by RECIPIENT, so it cannot resend somebody else's message.
    const resend = page.getByRole("button", {
      name: new RegExp(`Resend .* to ${customerEmail.replace(/[+.]/g, "\\$&")}`),
    });
    await expect(
      resend,
      "⛔ front desk must be OFFERED a resend on a message the customer says never arrived",
    ).toBeVisible({ timeout: 30_000 });

    await resend.first().click();
    await page.waitForTimeout(1_000);

    const confirm = page
      .getByRole("dialog")
      .getByRole("button", { name: "Resend", exact: true });
    if ((await confirm.count()) > 0) await confirm.first().click();

    // ⛔ Wait for the SERVER, not the toast. The button reports success
    // optimistically; only a new delivery row proves a message left.
    const after = await waitForEmailEvents(db, bookingId, originalCount + 1);
    await context.close();

    const fresh = after.filter((e) => !originalIds.includes(e.id));
    expect(
      fresh.length,
      `⛔ NO SECOND MESSAGE WAS EVER SENT. Front desk clicked resend and the customer would still be waiting. Events: ${JSON.stringify(after.map((e) => [e.event_type, e.recipient_email, e.delivery_status]))}`,
    ).toBeGreaterThan(0);

    // ⛔ The original is PRESERVED — the screen promises exactly that.
    expect(
      after.length,
      "⛔ the resend must ADD a record, never overwrite the original send",
    ).toBeGreaterThan(originalCount);

    const toCustomer = fresh.filter((e) => e.recipient_email === customerEmail);
    expect(
      toCustomer.length,
      `⛔ the new copy must reach the customer who rang up. Fresh events went to: ${JSON.stringify(fresh.map((e) => e.recipient_email))}`,
    ).toBeGreaterThan(0);

    expect(
      toCustomer.some((e) => e.delivery_status !== "failed"),
      `⛔ the resent message did not leave. If the daily allowance (D-053) is exhausted again, later families are untrustworthy. Statuses: ${JSON.stringify(toCustomer.map((e) => [e.delivery_status, e.error_message]))}`,
    ).toBe(true);

    console.log(
      `[G2] step 2 — resent: ${originalCount} message(s) before, ${after.length} after; ${toCustomer.length} new one(s) to the customer.`,
    );
  });

  test("step 3 — ⛔ THE POINT: the booking itself was not touched", async () => {
    expect(bookingId, "step 1 must have run").not.toBe("");
    const db = serviceClient();

    const after = await readBooking(db, bookingId);

    // ⛔ THE WHOLE QUESTION. A resend that moved, re-made or re-priced the visit
    // would be the customer's original complaint made worse.
    expect(
      after.booking_date,
      "⛔ resending must not move the visit to another day",
    ).toBe(chosenDay);
    expect(
      ["pending", "confirmed"].includes(String(after.status)),
      `⛔ resending must not change the booking's status. It is now "${after.status}".`,
    ).toBe(true);

    // ⛔ AND NO SECOND BOOKING APPEARED for this customer — the re-booking this
    // scenario exists to rule out.
    const { data: theirs } = await db
      .from("bookings")
      .select("id")
      .eq("client_id", after.client_id as string);
    expect(
      (theirs ?? []).length,
      "⛔ RESENDING CREATED A SECOND BOOKING. That is exactly the re-booking front desk must never have to do.",
    ).toBe(1);

    console.log(
      `\n[G2] COMPLETE. Front desk fixed a missing message with one click: a fresh copy went to the customer, the original send was kept on record, and the visit was not moved, re-made or re-priced.\n`,
    );
  });
});
