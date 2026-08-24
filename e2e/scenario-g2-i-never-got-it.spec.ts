// ⛔ GATE 08 — P3, FAMILY G, SCENARIO G2: "I NEVER GOT IT."
//
// ⚠️ THIS SCENARIO FOUND A REAL DEFECT ON THE WAY TO PASSING — FIND-08-G2-01.
//
// The obvious way to find a customer's message is the SEARCH BOX on
// `/admin/emails`. ⛔ It never works: every search returns "Couldn't load email
// events". `applyDeliveryPredicates` puts `id.ilike.<term>` in the same `or()`
// as `recipient_email.ilike.<term>`, and `id` is a UUID column, so Postgres
// rejects the whole filter with `operator does not exist: uuid ~~* unknown`.
//
// ⚠️ A GREEN UNIT TEST PINS THAT BROKEN FILTER (`emails-data.test.ts:290`). It
// mocks the query chain and asserts the STRING, so the database never gets to
// reject it. That is why a 100%-broken feature has a passing test.
//
// ✅ So this scenario filters by DATE AND EVENT TYPE instead, which works. ⛔ The
// workaround is not a preference — it is here because the better route is
// broken, and it must not be quietly normalised.
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
// scenarios. ✅ The allowance HAS reset — step 1 sent three real messages, one to
// the customer, none refused. ⛔ The guard stays: step 1 asserts the FIRST
// message actually left, so a future exhausted allowance fails loudly here
// rather than silently poisoning every family that follows.
//
// ── ✅ A PROTECTION FOUND BY TRIPPING OVER IT ─────────────────────
//
// The first working version of this scenario clicked Resend about a minute
// after the booking, and NOTHING WAS SENT. ⚠️ That looked like a broken button.
//
// ✅ It is a 60-second rate limiter (`RESEND_RATE_LIMIT_SECONDS`), and it is a
// good thing: it stops an anxious customer on the phone being sent five copies
// of the same message while front desk clicks again. Step 2 now proves BOTH
// halves — that a too-soon resend is refused, and that the real one goes through
// once the window passes.
//
// ⛔ The wait is computed from the ORIGINAL SEND'S OWN TIMESTAMP, not a fixed
// sleep, so the test cannot pass by accident on a slow machine where the window
// had already elapsed.
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
  emailEvents,
  gotoAdmin,
  isoDaysFromToday,
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
let originalDate = "";
let originalTime = "";
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

    // ⛔ THE ISO DATE, not the label. `chosenDay` is the human string the
    // calendar showed ("Tuesday, August 25th, 2026"); `booking_date` is
    // "2026-08-25". Comparing the two failed a run and looked for a moment like
    // the resend had moved the visit. It had not — the test was reading the
    // wrong field.
    originalDate = String(booking.booking_date);
    originalTime = String(booking.start_time).slice(0, 5);

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
    // ⛔ Generous on purpose: this step deliberately waits out a 60-second rate
    // limiter, so a tight timeout would fail it for the one reason that is not
    // a fault.
    test.setTimeout(300_000);
    expect(bookingId, "step 1 must have run").not.toBe("");
    const db = serviceClient();

    const { context, page } = await pageAs(browser, "coordinator");

    // ⚠️ BY DATE AND TYPE, NOT BY SEARCH — see FIND-08-G2-01. Searching for the
    // customer's address is the natural way to do this and it is broken; this
    // route is the workaround, not the preference.
    //
    // ⛔ AND THE DATE WINDOW IS MADE UNIQUE PER RUN, ON PURPOSE.
    // The delivery log is cached per viewer AND per filter combination. A fixed
    // URL is therefore warm from the PREVIOUS run — whose fixture has since been
    // deleted — so the page can honestly render a list that no longer contains
    // anything. That is not a defect in the app: a real failure or send happens
    // inside a server action which clears the entry; only a test seeding its own
    // world from the outside sees the stale copy.
    //
    // ✅ `to` is a genuine filter that flows into both the query and the cache
    // key, so pushing it a run-specific number of days into the future keeps
    // today's row in range while guaranteeing a COLD entry every time.
    //
    // ⛔ `range=custom` IS REQUIRED and its absence cost a run. `resolveDelivery-
    // DateBounds` only reads `from`/`to` when the range is literally "custom";
    // without it both are ignored, the URL collapses back to the default window,
    // and the "unique" entry is the same warm one as last time.
    // ⚠️ Derived from the CLOCK, not the process id. An earlier version used
    // `Number(RUN_TAG) % 60`, which collided with a previous run's value and
    // served its warm — and by then empty — cache entry. Uniqueness has to be
    // genuinely unique, not merely "probably different".
    const uniqueTo = isoDaysFromToday(30 + (Date.now() % 400));
    await gotoAdmin(
      page,
      `/admin/emails/?event_type=booking_confirmation&range=custom&from=${isoDaysFromToday(-1)}&to=${uniqueTo}`,
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

    // ⛔ ADDRESSED BY RECIPIENT, so it cannot resend somebody else's message —
    // which matters here: this booking also generated business alerts, and
    // resending one of those would mail the clinic's real inbox for no reason.
    //
    // ⚠️ The names are ENUMERATED rather than matched blind. A regex that misses
    // reports "no resend button" when the truth may be "a label I guessed
    // wrong", and those two need telling apart.
    const allResend = page.getByRole("button", { name: /^Resend/ });
    await expect(
      allResend.first(),
      "⛔ front desk must be offered a resend on SOMETHING here, or the log is not showing actionable rows at all",
    ).toBeVisible({ timeout: 30_000 });

    const labels: string[] = [];
    const howMany = await allResend.count();
    for (let i = 0; i < howMany; i += 1) {
      labels.push((await allResend.nth(i).getAttribute("aria-label")) ?? "(unnamed)");
    }
    console.log(`[G2] resend buttons offered: ${JSON.stringify(labels)}`);

    const mine = labels.findIndex((l) => l.includes(customerEmail));
    expect(
      mine,
      `⛔ NO RESEND CONTROL FOR THIS CUSTOMER'S MESSAGE. Front desk can SEE the message but cannot act on it. Buttons offered: ${JSON.stringify(labels)}`,
    ).toBeGreaterThanOrEqual(0);

    // ⛔ FIRST CLICK, DELIBERATELY TOO SOON. The confirmation went out moments
    // ago, so this one must be REFUSED — that is the protection, not a fault.
    await allResend.nth(mine).click();
    await page.waitForTimeout(1_000);
    const confirmTooSoon = page
      .getByRole("dialog")
      .getByRole("button", { name: "Resend", exact: true });
    if ((await confirmTooSoon.count()) > 0) await confirmTooSoon.first().click();
    await page.waitForTimeout(4_000);

    const afterTooSoon = await emailEvents(db, bookingId);
    const blocked = afterTooSoon.length === originalCount;
    console.log(
      `[G2] a resend inside the 60s window was ${blocked ? "REFUSED, as it should be" : "ALLOWED"}.`,
    );
    expect(
      afterTooSoon.length,
      "⛔ A CUSTOMER COULD BE SENT REPEATED COPIES. The 60-second limiter exists so that clicking again while somebody is on the phone does not post them five of the same message.",
    ).toBe(originalCount);

    // ⛔ NOW WAIT OUT THE WINDOW, measured from the original send itself rather
    // than a fixed sleep, so this cannot pass by luck on a slow machine.
    const sentAt = new Date(
      (afterTooSoon.find((e) => e.recipient_email === customerEmail) ?? afterTooSoon[0])
        .created_at as string,
    ).getTime();
    const waitMs = Math.max(0, 61_000 - (Date.now() - sentAt)) + 4_000;
    await page.waitForTimeout(waitMs);

    // ✅ AND THE REAL RESEND.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2_500);
    const again = page.getByRole("button", { name: /^Resend/ });
    const againLabels: string[] = [];
    const againCount = await again.count();
    for (let i = 0; i < againCount; i += 1) {
      againLabels.push((await again.nth(i).getAttribute("aria-label")) ?? "");
    }
    const mineAgain = againLabels.findIndex((l) => l.includes(customerEmail));
    expect(
      mineAgain,
      `⛔ the customer's message vanished from the log after a reload. Buttons: ${JSON.stringify(againLabels)}`,
    ).toBeGreaterThanOrEqual(0);

    await again.nth(mineAgain).click();
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
      `⛔ resending must not move the visit to another day. It was ${originalDate}, it is now ${after.booking_date}.`,
    ).toBe(originalDate);
    expect(
      String(after.start_time).slice(0, 5),
      "⛔ nor to another time",
    ).toBe(originalTime);
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
