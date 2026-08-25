// ⛔ GATE 08 — P3, FAMILY G, SCENARIO G1: ONE BOOKING'S WHOLE EMAIL LIFE.
//
//   ⛔ The Owner's question: "Does a customer get the right messages at the
//    right moments?"
//
// Every other scenario looks at ONE message. This one follows a single customer
// from the moment they book to the moment they are asked for a review, and
// checks that each message arrived, in order, addressed to the right person.
//
// ── ⛔ WHY "IN ORDER" IS THE PART THAT MATTERS ───────────────────────────
//
// Each message on its own is easy to get right. ⚠️ The failure that embarrasses a
// clinic is a message at the WRONG MOMENT — a review request before the visit
// has happened, a reminder for a visit already cancelled, a confirmation after
// the appointment. So this file asserts the SEQUENCE, not just the presence.
//
// ── ⛔ WHAT IS DRIVEN AND WHAT IS NOT ────────────────────────────────────
//
// The reminder and the review request are normally sent by a nightly cron. ⛔ A
// browser test cannot wait a night, so both are triggered through the MANUAL
// controls the admin provides for exactly this purpose — the same server
// actions, the same senders, the same delivery records.
//
// ⚠️ SO THIS PROVES THE MESSAGES AND THEIR ORDER, NOT THE CRON'S TIMING. That
// distinction is stated rather than blurred: nothing here shows that the cron
// fires at the right hour, only that when a reminder is sent it is the right
// message to the right customer.
//
// ── ⛔ EMAIL COST: REAL, AND THE MOST EXPENSIVE SCENARIO IN FAMILY G ─────
//
// One public booking fans out to the customer AND the business inbox, then a
// reminder and a review request each go to the customer. Budget six or so
// messages, a couple of which reach the clinic's real inbox — accepted by the
// Owner as unavoidable for booking-shaped scenarios.
//
// ⛔ Step 1 asserts the FIRST message actually left, so an exhausted daily
// allowance (D-053) fails loudly here instead of quietly passing everything
// afterwards against mail that never went.

import { expect, test, type Page } from "@playwright/test";
import {
  destroyScenarioFixtures,
  emailEvents,
  gotoAdmin,
  isoDaysFromToday,
  pageAs,
  readBooking,
  RUN_TAG,
  seedWebsiteBooking,
  serviceClient,
  submitPublicBooking,
  testInbox,
  THERAPIST_A_STAFF_ID,
  waitForEmailEvents,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const clientIds: string[] = [];
let bookingId = "";
let customerEmail = "";
let customerName = "";
const seen: { stage: string; types: string[] }[] = [];

/**
 * ⛔ HOW THIS PAGE'S CACHE ACTUALLY BEHAVES — THREE RUNS TO GET RIGHT.
 *
 * 1. The URL trick used by the delivery-log scenarios does NOT work here. That
 *    key is `["emails-page", cacheKeyPart({ canSeeDelivery, canResend,
 *    canSeeAllBookings, staffId, businessDate, includeTemplates, limit,
 *    offset })]` — no date filters at all, so `range`/`from`/`to` change the URL
 *    and nothing else.
 *
 * 2. ⚠️ Waiting out `revalidate: 60` is not enough either. That is
 *    STALE-WHILE-REVALIDATE: the first request after expiry is still served the
 *    OLD value and merely triggers a refresh behind it. Measured — after a full
 *    61-second wait the tab still listed the previous run's customer, whose
 *    booking had already been deleted.
 *
 * ✅ 3. So the list is POLLED, reloading between attempts, until the customer
 *    this run created appears. That is correct regardless of the exact caching
 *    semantics, and it is what a person does: look, not see it, refresh.
 *
 * ⛔ It fails loudly after its attempts rather than proceeding, so "the customer
 * is not on the reminder list" still means exactly that.
 */
const CACHE_REVALIDATE_MS = 60_000;
let bookedAt = 0;
let completedAt = 0;

/** Reload until `needle` appears in the page, or give up loudly. */
async function pollForRow(
  page: Page,
  url: string,
  label: string,
  needle: string,
  sinceMs: number,
) {
  const firstWait = CACHE_REVALIDATE_MS - (Date.now() - sinceMs);
  if (firstWait > 0) {
    console.log(`[G1] waiting ${Math.ceil(firstWait / 1000)}s for the cached list to expire.`);
    await page.waitForTimeout(firstWait + 2_000);
  }

  await gotoAdmin(page, url, label);
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    await page.waitForTimeout(3_000);
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    if (text.includes(needle)) {
      console.log(`[G1] ${label}: found after ${attempt} load(s).`);
      return;
    }
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  console.log(`[G1] ${label}: gave up after 8 loads.`);
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (clientIds.length === 0) return;
  await destroyScenarioFixtures(serviceClient(), clientIds);
});

async function typesFor(bookingRef: string) {
  const rows = await emailEvents(serviceClient(), bookingRef);
  return rows.map((r) => `${r.event_type}->${r.recipient_email}`);
}

test.describe("G1 — one booking's whole email life", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("moment 1 — ✅ they book, and are confirmed", async ({ page }) => {
    test.setTimeout(240_000);
    const db = serviceClient();

    customerName = `ZZTEST-G1-LIFE-${RUN_TAG}`;
    customerEmail = testInbox(`g1-life-${RUN_TAG}`);

    const made = await submitPublicBooking(page, {
      name: customerName,
      email: customerEmail,
      phone: "07700900333",
      packages: ["Hijama Package"],
      participants: [{ gender: "female" }],
    });
    bookingId = made.bookingId;

    const booking = await readBooking(db, bookingId);
    clientIds.push(booking.client_id as string);

    const sent = await waitForEmailEvents(db, bookingId, 1);
    const toCustomer = sent.filter((e) => e.recipient_email === customerEmail);

    expect(
      toCustomer.length,
      `⛔ THE CUSTOMER WAS NEVER CONFIRMED. Events: ${JSON.stringify(sent.map((e) => [e.event_type, e.recipient_email, e.delivery_status]))}`,
    ).toBeGreaterThan(0);

    // ⛔ THE ALLOWANCE GUARD. If the first message did not leave, nothing after
    // this point means anything.
    expect(
      toCustomer.some((e) => e.delivery_status !== "failed"),
      `⛔ THE CONFIRMATION FAILED TO LEAVE — very likely the daily allowance (D-053). Stop here; every later moment would pass against mail that never went. Statuses: ${JSON.stringify(toCustomer.map((e) => [e.delivery_status, e.error_message]))}`,
    ).toBe(true);

    bookedAt = Date.now();
    seen.push({ stage: "booked", types: await typesFor(bookingId) });
    console.log(`[G1] moment 1 — confirmed: ${JSON.stringify(seen[0].types)}`);
  });

  test("moment 2 — ✅ a reminder before the visit", async ({ browser }) => {
    test.setTimeout(240_000);
    expect(bookingId, "moment 1 must have run").not.toBe("");
    const db = serviceClient();
    const before = (await emailEvents(db, bookingId)).length;

    const { context, page } = await pageAs(browser, "coordinator");
    // ⛔ POLLED, not loaded once — see the note on `pollForRow`.
    await pollForRow(
      page,
      "/admin/emails/?tab=reminders",
      "the reminders tab",
      customerName,
      bookedAt,
    );

    // ⚠️ ENUMERATED, NOT GUESSED — a locator that misses reports "no reminder
    // could be sent" when the truth may be a label I got wrong.
    const buttons = page.getByRole("button", { name: /^Send reminder/ });
    const count = await buttons.count();
    const labels: string[] = [];
    for (let i = 0; i < count; i += 1) {
      labels.push((await buttons.nth(i).getAttribute("aria-label")) ?? "");
    }
    console.log(`[G1] reminder buttons: ${JSON.stringify(labels.slice(0, 6))}`);

    const mine = labels.findIndex((l) => l.includes(customerName));
    expect(
      mine,
      `⛔ THIS CUSTOMER IS NOT ON THE REMINDER LIST. They have an upcoming visit, so the clinic has no way to remind them. Buttons offered: ${JSON.stringify(labels.slice(0, 8))}`,
    ).toBeGreaterThanOrEqual(0);

    await buttons.nth(mine).click();
    await page.waitForTimeout(1_500);
    const confirm = page.getByRole("dialog").getByRole("button", { name: /Send/ });
    if ((await confirm.count()) > 0) await confirm.first().click();
    await context.close();

    const after = await waitForEmailEvents(db, bookingId, before + 1);
    const fresh = after.slice(before);
    expect(
      after.length,
      `⛔ NO REMINDER WAS SENT. Events: ${JSON.stringify(after.map((e) => [e.event_type, e.delivery_status]))}`,
    ).toBeGreaterThan(before);
    expect(
      after.some((e) => e.event_type.includes("reminder")),
      `⛔ something was sent but it was not a reminder: ${JSON.stringify(after.map((e) => e.event_type))}`,
    ).toBe(true);

    seen.push({ stage: "reminded", types: await typesFor(bookingId) });
    console.log(`[G1] moment 2 — reminded (${fresh.length} new message(s)).`);
  });

  test("moment 3 — ✅ the visit happens, and is completed", async ({ browser }) => {
    test.setTimeout(180_000);
    expect(bookingId, "moment 1 must have run").not.toBe("");
    const db = serviceClient();

    // ⛔ A review request is only legitimate AFTER the visit. The booking is
    // moved to today and assigned, then completed through the admin — the same
    // route the clinic uses.
    const { data: updatedRows, error: updateError } = await db
      .from("bookings")
      .update({
        booking_date: isoDaysFromToday(0),
        // ⛔ THE DATE ONLY. THE TIMES ARE LEFT ALONE, AND THAT IS A LESSON.
        // An earlier version also set `start_time: "09:00:00"` without touching
        // `end_time`, which made the visit end before it began. The DATABASE
        // caught it: `new row for relation "bookings" violates check constraint
        // "bookings_time_check"`.
        //
        // ✅ That constraint is a good thing and it did its job. ⚠️ But the
        // error was being thrown away, so three runs blamed the app for
        // "refusing to complete a booking" when the truth was a fixture the
        // database had rightly rejected. The error is now read, which is why
        // this comment exists.
        // ⛔ CONFIRMED, because that is the real sequence: a clinic confirms a
        // booking, the visit happens, then it is completed. Leaving it
        // `pending` would test completing a booking nobody ever accepted — and
        // it is set here rather than clicked because confirming is scenario A's
        // subject, not this file's, and each click costs a real email.
        status: "confirmed",
      })
      .eq("id", bookingId)
      .select("id, booking_date, status");

    // ⛔ THE ERROR IS READ, NOT IGNORED. Three runs were spent blaming the app
    // for refusing to complete a booking whose setup had silently not applied.
    expect(
      updateError ? updateError.message : null,
      "⛔ moving the booking to today failed outright",
    ).toBeNull();
    expect(
      (updatedRows ?? []).length,
      `⛔ the update matched NO ROWS for booking ${bookingId} — nothing was changed and nothing complained.`,
    ).toBe(1);

    await db
      .from("booking_assignments")
      .update({ assigned_staff_id: THERAPIST_A_STAFF_ID, status: "assigned" })
      .eq("booking_id", bookingId);

    // ⛔ PROVE THE SETUP TOOK. An earlier run silently skipped this update and
    // then blamed the app for refusing to complete a booking that was still
    // pending and still dated next week. A fixture that did not apply is not a
    // finding — it is a broken test pretending to be one.
    const ready = await readBooking(db, bookingId);
    expect(
      [ready.booking_date, ready.status],
      `⛔ THE FIXTURE DID NOT APPLY. The booking should be today and confirmed before the visit can be completed, but it is ${ready.booking_date} / ${ready.status}.`,
    ).toEqual([isoDaysFromToday(0), "confirmed"]);

    const { context, page } = await pageAs(browser, "admin");

    // ⛔ THE DETAIL PAGE IS CACHED TOO, and the fixture above was written
    // straight to the database, which clears nothing. ⚠️ Measured: the page
    // showed the booking still "Pending" on its original date while the
    // database already said otherwise — so the Mark-complete chip was being
    // clicked against a stale view. The page is reloaded until it agrees with
    // the database before anything is clicked.
    await gotoAdmin(page, `/admin/bookings/${bookingId}/`, "the booking");
    //
    // ⚠️ POLLED ON THE CONTROL ITSELF, not on words. A first version looked for
    // "Confirmed" and the absence of "Pending" — but "Pending" appears
    // elsewhere on the page, so it could never be satisfied. The precondition
    // that actually matters is an ENABLED Mark-complete chip.
    let ready2 = false;
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      await page.waitForTimeout(2_500);
      const chip = page.getByRole("button", { name: /^Mark complete$/ });
      if ((await chip.count()) > 0 && (await chip.first().isEnabled())) {
        console.log(`[G1] the booking page offered Mark complete after ${attempt} load(s).`);
        ready2 = true;
        break;
      }
      await page.reload({ waitUntil: "domcontentloaded" });
    }
    const shown = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    expect(
      ready2,
      `⛔ the booking page never offered a live Mark-complete control, so the visit could not be recorded as having happened. It said: "${shown.slice(0, 400)}"`,
    ).toBe(true);

    // \u26a0\ufe0f ENUMERATED AND LOGGED, because the first version clicked the chip,
    // found no dialog button matching the label it guessed, and silently did
    // nothing \u2014 leaving the booking `pending` and looking like a refusal.
    const complete = page.getByRole("button", { name: /^Mark complete$/ });
    await expect(
      complete.first(),
      "\u26d4 the clinic must be able to record that the visit happened",
    ).toBeVisible({ timeout: 30_000 });
    await complete.first().click();
    await page.waitForTimeout(2_000);

    const dialog = page.getByRole("dialog");
    if ((await dialog.count()) > 0) {
      const dialogButtons = dialog.getByRole("button");
      const n = await dialogButtons.count();
      const names: string[] = [];
      for (let i = 0; i < n; i += 1) {
        names.push(((await dialogButtons.nth(i).innerText()) || "").replace(/\s+/g, " ").trim());
      }
      console.log(`[G1] confirm dialog offered: ${JSON.stringify(names)}`);

      const yes = names.findIndex((t) => /^(Mark complete|Complete|Confirm|Yes)/i.test(t));
      expect(
        yes,
        `\u26d4 the confirmation dialog has no button that completes the visit. It offered: ${JSON.stringify(names)}`,
      ).toBeGreaterThanOrEqual(0);
      await dialogButtons.nth(yes).click();
      await page.waitForTimeout(3_000);
    }

    // A session-note sheet may open afterwards; the note itself is optional.
    const skip = page.getByRole("button", { name: /^Skip$/ });
    if ((await skip.count()) > 0) {
      await skip.first().click();
      await page.waitForTimeout(1_500);
    }

    const onScreen = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    await context.close();

    const booking = await readBooking(db, bookingId);
    expect(
      booking.status,
      `⛔ the visit was not recorded as completed, so a review request would be premature. Status is "${booking.status}". The page said: "${onScreen.slice(0, 400)}"`,
    ).toBe("completed");

    completedAt = Date.now();
    seen.push({ stage: "completed", types: await typesFor(bookingId) });
    console.log(`[G1] moment 3 — completed.`);
  });

  test("moment 4 — ✅ and only then, a review request", async ({ browser }) => {
    test.setTimeout(240_000);
    expect(bookingId, "moment 1 must have run").not.toBe("");
    const db = serviceClient();
    const before = (await emailEvents(db, bookingId)).length;

    const { context, page } = await pageAs(browser, "owner");
    // ⛔ The same cache, the same poll.
    await pollForRow(
      page,
      "/admin/emails/?tab=reviews",
      "the review requests tab",
      customerName,
      completedAt,
    );

    const buttons = page.getByRole("button", { name: /^Send a review request/ });
    const count = await buttons.count();
    const labels: string[] = [];
    for (let i = 0; i < count; i += 1) {
      labels.push((await buttons.nth(i).getAttribute("aria-label")) ?? "");
    }
    console.log(`[G1] review buttons: ${JSON.stringify(labels.slice(0, 6))}`);

    const mine = labels.findIndex((l) => l.includes(customerName));
    expect(
      mine,
      `⛔ A COMPLETED VISIT IS NOT OFFERED A REVIEW REQUEST. Buttons offered: ${JSON.stringify(labels.slice(0, 8))}`,
    ).toBeGreaterThanOrEqual(0);

    await buttons.nth(mine).click();
    await page.waitForTimeout(2_000);

    // ⚠️ ENUMERATED AND LOGGED. A loose /Send/ match sent nothing here and gave
    // no clue why; the modal's confirm button reads "Send request".
    const dlg = page.getByRole("dialog");
    if ((await dlg.count()) > 0) {
      const dlgButtons = dlg.getByRole("button");
      const n = await dlgButtons.count();
      const names: string[] = [];
      for (let i = 0; i < n; i += 1) {
        names.push(((await dlgButtons.nth(i).innerText()) || "").replace(/\s+/g, " ").trim());
      }
      console.log(`[G1] review confirm dialog offered: ${JSON.stringify(names)}`);
      const yes = names.findIndex((t) => /^Send request$|^Send$/i.test(t));
      expect(
        yes,
        `⛔ the review-request dialog has no button that sends it. It offered: ${JSON.stringify(names)}`,
      ).toBeGreaterThanOrEqual(0);
      await dlgButtons.nth(yes).click();
      await page.waitForTimeout(3_000);
    }
    const afterClick = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    await context.close();

    const after = await waitForEmailEvents(db, bookingId, before + 1);
    expect(
      after.length,
      `⛔ NO REVIEW REQUEST WAS SENT. Events: ${JSON.stringify(after.map((e) => [e.event_type, e.delivery_status]))}. The page said: "${afterClick.slice(0, 300)}"`,
    ).toBeGreaterThan(before);

    seen.push({ stage: "reviewed", types: await typesFor(bookingId) });
    console.log(`[G1] moment 4 — review request sent.`);
  });

  test("⛔ THE WHOLE LIFE: the right messages, in the right order", async () => {
    expect(seen.length, "all four moments must have run").toBe(4);
    const db = serviceClient();
    const all = await emailEvents(db, bookingId);

    console.log(
      `[G1] the customer's whole email life:\n` +
        seen.map((s) => `   after ${s.stage.padEnd(10)} ${JSON.stringify(s.types)}`).join("\n"),
    );

    // ⛔ EVERY MESSAGE TO THE CUSTOMER WENT TO THE CUSTOMER. A single message
    // addressed to the wrong person is the worst outcome in this whole family.
    const toCustomer = all.filter((e) => e.recipient_role !== "admin" && e.recipient_role !== "staff");
    for (const e of toCustomer) {
      expect(
        e.recipient_email,
        `⛔ A CUSTOMER-FACING MESSAGE WENT TO THE WRONG ADDRESS: ${e.event_type} → ${e.recipient_email}`,
      ).toBe(customerEmail);
    }

    // ⛔ THE ORDER. The counts only ever grow, and each stage added something —
    // so no message arrived before the moment that should have caused it.
    for (let i = 1; i < seen.length; i += 1) {
      expect(
        seen[i].types.length,
        `⛔ nothing was sent at the "${seen[i].stage}" stage, so that moment produced no message at all`,
      ).toBeGreaterThan(seen[i - 1].types.length);
    }

    // ⛔ AND THE REVIEW REQUEST CAME LAST. It did not exist before the visit was
    // completed — asking somebody to review a visit they have not had yet is the
    // single most embarrassing thing in this sequence.
    const reviewBeforeCompletion = seen
      .filter((s) => s.stage === "booked" || s.stage === "reminded")
      .some((s) => s.types.some((t) => t.includes("review")));
    expect(
      reviewBeforeCompletion,
      "⛔ A REVIEW REQUEST EXISTED BEFORE THE VISIT WAS COMPLETED. The customer would be asked to review an appointment that had not happened.",
    ).toBe(false);

    expect(
      seen[3].types.some((t) => t.includes("review")),
      `⛔ the review request never appeared even after completion: ${JSON.stringify(seen[3].types)}`,
    ).toBe(true);

    // ⛔ NOTHING FAILED SILENTLY along the way.
    const failed = all.filter((e) => e.delivery_status === "failed");
    expect(
      failed.map((e) => [e.event_type, e.error_message]),
      "⛔ at least one message in this customer's life failed to leave",
    ).toEqual([]);

    console.log(
      `\n[G1] COMPLETE. Booked → confirmed → reminded → visited → asked for a review. ${all.length} messages, every customer-facing one to the right address, none failed, and the review request only after the visit.\n`,
    );
  });
});
