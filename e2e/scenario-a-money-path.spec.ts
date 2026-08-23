// ⛔ GATE 08 — PHASE P3, FAMILY A: THE CORE MONEY PATH.
// `WORKFLOW-COVERAGE.md` §4, family A. Owner-approved by D-015 and D-048.
//
// A *case* proves a button works. A *scenario* proves the clinic works. This
// file answers the Owner's own question for the path that pays for everything:
//
//   ⛔ A1 — "Does money a customer pays actually reach my reports?"
//
// One booking is followed from the customer's phone to the revenue figure, by
// four different people in turn: the customer (not logged in), the coordinator
// who sees it arrive, the admin who staffs and confirms it, the therapist who
// does the work, and the owner who reads the money back out.
//
// ── ⛔ THIS IS THE FIRST TEST IN THE REPO TO SUBMIT THE PUBLIC BOOKING FORM ──
//
// Measured 2026-08-23: `e2e/booking-public.spec.ts` walks two steps of the
// dialog and stops, and it is on the never-run list. `booking-create.spec.ts`
// drives the ADMIN wizard. ⛔ So until this file, the single most important
// journey in the business — a customer booking on the website — had never been
// executed end to end by anything.
//
// ── ⛔ WHAT THIS COSTS IN REAL EMAIL ─────────────────────────────────────
//
// Submitting the public form sends THREE real messages through Resend:
//   1. `booking_confirmation` → the customer, i.e. the Owner's test inbox;
//   2. + 3. `admin_booking_notification` → every active opted-in Owner/Admin.
//      Measured: exactly TWO such rows exist — `phase10.owner@example.test`
//      and ⛔ the REAL business inbox `rahmatherapy@outlook.com`.
//
// ⛔ There is no actor to exclude the real Owner from a CUSTOMER-initiated
// booking, so that one message is unavoidable and is asserted rather than
// wished away. Owner instruction 2026-08-23: *"the other email rahma is the
// owners emails and those will just be sent without actively trying but any and
// all emails should be sent to thefoolmarketing@outlook.com for testing."*
//
// ⚠️ Every LATER step is deliberately email-free to the real inbox: assignment,
// confirmation and completion reach `sendAssignedStaffBookingChangeEmails`,
// which mails the ASSIGNED STAFF only — and the therapist here is the test
// therapist. Payment sends nothing at all. ⛔ Asserted in step 8, not assumed.
//
// ── ⛔ THE ONE PLACE THIS SCENARIO BENDS REALITY, STATED OPENLY ──────────
//
// The public form can only ever produce a FUTURE date (there is a minimum-notice
// window), and `complete` is refused on a future booking. A scenario that
// stopped there could never reach the money. ⛔ So step 5 moves the booking's
// date to today with a direct database write, and says so loudly. Nothing else
// about the booking is touched, and no app rule is bypassed — the same guards
// then run against a booking whose day has genuinely arrived.

import { expect, test, type Page } from "@playwright/test";
import {
  auditActions,
  awaitAction,
  bookingsListForDay,
  destroyScenarioFixtures,
  emailEvents,
  gotoAdmin,
  isoDaysFromToday,
  pageAs,
  pollUntil,
  readAssignments,
  readBooking,
  REAL_OWNER_INBOX,
  reportsForDay,
  serviceClient,
  testInbox,
  THERAPIST_A_STAFF_ID,
  RUN_TAG,
  waitForEmailEvents,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const CUSTOMER_NAME = `ZZTEST-A1-${RUN_TAG}`;
/** ⛔ Plus-addressed so this scenario owns a FRESH client row: the public path
 *  dedups clients on EMAIL, and reusing the bare inbox would link this booking
 *  to whatever client row already holds that address. Still lands in the
 *  Owner's test inbox. */
const CUSTOMER_EMAIL = testInbox("a1");
const CUSTOMER_PHONE = "07700900101";
const PACKAGE = { label: "Hijama Package", price: 45, mins: 60 };

let bookingId = "";
let clientId = "";
/** The owner's collected-revenue figure for today, read before the payment. */
let collectedBefore = 0;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (!clientId) return;
  await destroyScenarioFixtures(serviceClient(), [clientId]);
});

/** Read a money figure out of the reports page by its tile label. */
async function readMoneyTile(page: Page, label: string): Promise<number> {
  const text = await page.evaluate(() => document.querySelector("main")?.textContent ?? "");
  const match = new RegExp(`${label}\\s*£\\s*([0-9,]+(?:\\.[0-9]{2})?)`).exec(text.replace(/\s+/g, " "));
  if (!match) {
    throw new Error(
      `Could not find a "${label}" figure on the reports page. It said: "${text.replace(/\s+/g, " ").slice(0, 400)}"`,
    );
  }
  return Number(match[1].replace(/,/g, ""));
}

test.describe("A1 — a normal week: does money a customer pays reach the reports?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — a customer books on the website, and the clinic is told", async ({ page }) => {
    const db = serviceClient();

    await page.goto("/home/", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: /book an appointment/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog, "the booking dialog should open from the homepage").toBeVisible({
      timeout: 30_000,
    });

    // Step 1 of 4 — service.
    await dialog.getByRole("button", { name: new RegExp(PACKAGE.label, "i") }).first().click();
    // ⛔ Two elements carry the running total (the summary panel and the
    // collapsed "Show booking summary" button), so scope to the summary region.
    await expect(
      dialog
        .getByLabel("Booking request summary")
        .getByText(`Estimated total£${PACKAGE.price}`, { exact: false }),
      "the running total should show the package price once it is picked",
    ).toBeVisible();
    await dialog.getByRole("button", { name: /^Continue$/ }).click();

    // Step 2 of 4 — about you.
    await dialog.getByRole("button", { name: /^For myself/ }).click();
    await dialog.getByRole("button", { name: /^Female$/ }).click();
    await dialog.getByLabel(/Main contact name/i).fill(CUSTOMER_NAME);
    await dialog.getByLabel(/Phone \/ WhatsApp number/i).fill(CUSTOMER_PHONE);
    await dialog.getByLabel(/Email address/i).fill(CUSTOMER_EMAIL);
    await dialog.getByRole("button", { name: /^Luton$/ }).click();
    await dialog.getByLabel(/Area \/ County/i).fill("Bedfordshire");
    await dialog.getByLabel(/Postcode/i).fill("LU1 1AA");
    await dialog.getByLabel(/Home visit address/i).fill("1 ZZTEST Street");
    await expect(
      dialog.getByLabel(/City \/ Town/i),
      "the Luton chip should fill the city field",
    ).toHaveValue(/Luton/i);
    await dialog.getByRole("button", { name: /^Continue$/ }).click();

    // Step 3 of 4 — time. ⛔ Take the first day the CLINIC offers; the calendar
    // already reflects therapist availability, notice period and blocked dates,
    // so choosing for it would be testing my own arithmetic instead of theirs.
    // ⛔ G-13 — "nothing matches" is not terminal, and this step is the one
    // place in the form that waits on the network.
    await expect(
      dialog.getByRole("heading", { name: /Choose a matched time/i }),
      "the booking dialog should reach its Time step",
    ).toBeVisible({ timeout: 30_000 });

    // ⚠️ MEASURED, and it caught me out: the calendar PRE-SELECTS the first
    // bookable day and loads its times, and which days are enabled CHANGES as
    // the availability response lands (today was briefly enabled, then
    // disabled). Waiting for the time slots is how you know availability has
    // settled — choosing a day before that can land on one the clinic then
    // withdraws.
    const slots = dialog.getByRole("button", { name: /^([01]\d|2[0-3]):[0-5]\d$/ });
    await expect(
      slots.first(),
      "⛔ the clinic offered NO appointment times at all — the website would be selling nothing",
    ).toBeVisible({ timeout: 30_000 });

    // ⛔ The day cells' ACCESSIBLE NAME is the full date ("Monday, August 24th,
    // 2026"), not the digit — `getByRole(name: /^\d{1,2}$/)` matches none of
    // them. Every day carries a weekday in its label; nothing else in the
    // dialog does.
    const days = dialog.locator('button[aria-label*="day,"]');
    const dayCount = await days.count();
    let chosenDay = "";
    for (let i = 0; i < dayCount; i += 1) {
      if (await days.nth(i).isEnabled()) {
        chosenDay = (await days.nth(i).getAttribute("aria-label")) ?? "";
        await days.nth(i).click();
        break;
      }
    }
    expect(
      chosenDay,
      "⛔ the calendar offered NO bookable day at all — the website would be selling nothing",
    ).not.toBe("");

    // The times reload for the day just chosen.
    await expect(
      slots.first(),
      `no appointment times were offered on ${chosenDay}`,
    ).toBeVisible({ timeout: 30_000 });
    const chosenTime = ((await slots.first().textContent()) ?? "").trim();
    expect(chosenTime, "a time slot should carry its own time").toMatch(/^\d{2}:\d{2}$/);
    await slots.first().click();
    await dialog.getByRole("button", { name: /^Continue$/ }).click();

    // Step 4 of 4 — confirm.
    await expect(dialog.getByRole("heading", { name: /Review your request/i })).toBeVisible();
    await dialog.getByLabel(/I consent to treatment/i).check();
    await dialog.getByLabel(/I understand payment is taken in person/i).check();
    await dialog.getByLabel(/I understand this is a booking request/i).check();

    const created = page.waitForResponse(
      (r) => r.url().includes("/api/bookings") && r.request().method() === "POST",
      { timeout: 60_000 },
    );
    await dialog.getByRole("button", { name: /Submit booking request/i }).click();
    const response = await created;

    expect(
      response.status(),
      "the customer's booking request should be accepted by the server",
    ).toBe(200);
    const body = (await response.json()) as { bookingId?: string; error?: string };
    expect(body.error, `the server refused the booking: ${body.error}`).toBeUndefined();
    expect(body.bookingId, "the server should return the new booking's id").toBeTruthy();
    bookingId = body.bookingId!;

    // ⛔ G-27 — report what the page said, but assert what the DATABASE did.
    const booking = await readBooking(db, bookingId);
    clientId = String(booking.client_id);

    expect(booking.booking_source, "a website booking must be recorded as such").toBe("website");
    expect(booking.status, "a new website booking starts pending").toBe("pending");
    expect(
      booking.assignment_status,
      "⛔ every website booking arrives with nobody assigned — that is the whole point of the triage queue",
    ).toBe("unassigned");
    expect(Number(booking.total_price), `the ${PACKAGE.label} is £${PACKAGE.price}`).toBe(PACKAGE.price);
    expect(
      Number(booking.amount_paid),
      "nothing has been paid yet — the clinic takes payment in person",
    ).toBe(0);
    expect(booking.contact_email).toBe(CUSTOMER_EMAIL);
    expect(String(booking.booking_date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(String(booking.start_time).slice(0, 5)).toBe(chosenTime);

    // ⛔ The assignment row must exist and be EMPTY. `deriveNextAction` reads
    // `.some()` over this array, and `.some()` on an empty array is false — a
    // booking with no assignment rows at all would be described to the operator
    // as "Therapist is assigned".
    const assignments = await readAssignments(db, bookingId);
    expect(assignments, "the RPC writes one assignment row per participant").toHaveLength(1);
    expect(assignments[0].assigned_staff_id, "and it starts with nobody in it").toBeNull();
    expect(assignments[0].status).toBe("unassigned");

    // ── ⛔ THE EMAIL, ASSERTED RATHER THAN ASSUMED ──────────────────────
    const events = await waitForEmailEvents(db, bookingId, 3);

    const customerLeg = events.filter((e) => e.event_type === "booking_confirmation");
    expect(customerLeg, "the customer must be sent exactly one confirmation").toHaveLength(1);
    expect(
      customerLeg[0].recipient_email ?? customerLeg[0].to_email,
      "the confirmation goes to the person who booked",
    ).toBe(CUSTOMER_EMAIL);
    // ⛔ Success is `accepted`, NOT `sent`. `failed` and `skipped` live in the
    // same table, so assert the STATUS, never the row's existence.
    expect(
      customerLeg[0].delivery_status,
      "⛔ a confirmation row that is `failed` or `skipped` means the customer heard nothing",
    ).toBe("accepted");

    const businessLeg = events.filter((e) => e.event_type === "admin_booking_notification");
    expect(
      businessLeg,
      "the clinic must be told, once per opted-in owner/admin — measured as two",
    ).toHaveLength(2);
    for (const leg of businessLeg) {
      expect(leg.delivery_status, "a business alert that failed means nobody knows a booking came in").toBe(
        "accepted",
      );
    }
    expect(
      businessLeg.some((e) => (e.recipient_email ?? e.to_email) === REAL_OWNER_INBOX),
      `⛔ the real business inbox ${REAL_OWNER_INBOX} must be among the recipients — this is how the Owner learns a customer has booked`,
    ).toBe(true);

    expect(events, "exactly three messages leave for a new website booking").toHaveLength(3);

    console.log(
      `\n[A1] booking ${bookingId} on ${booking.booking_date} at ${chosenTime} — ` +
        `3 emails sent, 1 of them to ${REAL_OWNER_INBOX}\n`,
    );
  });

  test("step 2 — the coordinator sees it arrive, and sees it needs a therapist", async ({ browser }) => {
    expect(bookingId, "step 1 must have created a booking").toBeTruthy();
    const db = serviceClient();
    const booking = await readBooking(db, bookingId);
    const date = String(booking.booking_date);

    const { context, page } = await pageAs(browser, "coordinator");
    // ⛔ POLL. The bookings list is `unstable_cache`(revalidate: 60) and the
    // PUBLIC booking API invalidates NOTHING — measured: there is no
    // `updateTag` anywhere under `src/app/api/`. So a booking a customer just
    // made can take up to a minute to appear on the clinic's screen.
    const attempts = await pollUntil(
      page,
      bookingsListForDay(date),
      "the bookings list for the booking's own day",
      async () => (await page.locator(`a[href*="${bookingId}"]`).count()) > 0,
    );
    console.log(`\n[A1] the website booking appeared on the bookings list after ${attempts} reload(s)\n`);

    // ⛔ G-12 — any search surface echoes the query. Assert the LINK, never text.
    const row = page.locator(`a[href*="${bookingId}"]`).first();
    await expect(row).toBeVisible();

    const listText = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(
      listText,
      "the front desk must be able to see at a glance that nobody is on this job yet",
    ).toContain("Unassigned");

    await context.close();
  });

  test("step 3 — the admin puts a therapist on it", async ({ browser }) => {
    expect(bookingId).toBeTruthy();
    const db = serviceClient();
    const { context, page } = await pageAs(browser, "admin");

    await gotoAdmin(page, `/admin/bookings/${bookingId}/`, "the booking detail page");
    await expect(page.locator("#booking-status-form")).toBeVisible({ timeout: 30_000 });

    await expect(
      page.getByText(/Assign a therapist, then confirm with the client/i),
      "⛔ the page must tell the operator a therapist is still needed",
    ).toBeVisible();

    await page.getByRole("button", { name: /^Assign therapist$/i }).click();
    const chooser = page.getByRole("dialog");
    await expect(chooser.getByText(/Assign a therapist/i)).toBeVisible({ timeout: 15_000 });

    // ⛔ Filter on TEXT, not on the accessible name. Each candidate button
    // wraps an avatar, so its accessible name comes out as "TT Test Therapist
    // Eligible" while its textContent is "TTTest TherapistEligible" — anchoring
    // on either shape alone is fragile. The negative lookahead keeps
    // "Test Therapist Fresh" out; the count assertion makes an ambiguous match
    // fail loudly instead of clicking the wrong person.
    const candidate = chooser.getByRole("button").filter({ hasText: /Test Therapist(?! Fresh)/ });
    await expect(
      candidate,
      "exactly one 'Test Therapist' should be offered for this booking's gender requirement",
    ).toHaveCount(1);

    await awaitAction(page, async () => {
      await candidate.click();
    });

    const assignments = await readAssignments(db, bookingId);
    expect(assignments).toHaveLength(1);
    expect(
      assignments[0].assigned_staff_id,
      "the therapist the admin picked must actually be on the job",
    ).toBe(THERAPIST_A_STAFF_ID);
    expect(assignments[0].status).toBe("assigned");

    const booking = await readBooking(db, bookingId);
    expect(
      booking.assignment_status,
      "a single-participant booking with its one therapist in place is fully staffed",
    ).toBe("fully_assigned");
    expect(booking.status, "assigning does not confirm — those are two decisions").toBe("pending");

    await context.close();
  });

  test("step 4 — the admin confirms it with the client", async ({ browser }) => {
    expect(bookingId).toBeTruthy();
    const db = serviceClient();
    const { context, page } = await pageAs(browser, "admin");

    await gotoAdmin(page, `/admin/bookings/${bookingId}/`, "the booking detail page");
    await expect(page.locator("#booking-status-form")).toBeVisible({ timeout: 30_000 });

    await awaitAction(page, async () => {
      await page.getByRole("button", { name: /^Confirm booking$/i }).click();
    });

    const booking = await readBooking(db, bookingId);
    expect(booking.status, "the booking is now confirmed with the client").toBe("confirmed");

    const actions = await auditActions(db, bookingId);
    expect(
      actions,
      "⛔ the audit action depends on WHICH control was pressed — the chip writes booking_quick_confirm",
    ).toContain("booking_quick_confirm");

    await context.close();
  });

  test("step 5 — the day arrives (⛔ simulated by moving the date, and only the date)", async () => {
    expect(bookingId).toBeTruthy();
    const db = serviceClient();
    const today = isoDaysFromToday(0);

    const { error } = await db.from("bookings").update({ booking_date: today }).eq("id", bookingId);
    expect(error, `could not move the booking to today: ${error?.message}`).toBeNull();

    const booking = await readBooking(db, bookingId);
    expect(booking.booking_date).toBe(today);
    // ⛔ Nothing else moved. If this ever fails, the "simulation" has become a
    // second, hidden mutation and the steps after it stop meaning what they say.
    expect(booking.status).toBe("confirmed");
    expect(booking.assignment_status).toBe("fully_assigned");
    expect(Number(booking.amount_paid)).toBe(0);

    console.log(`\n[A1] booking moved to ${today} — the visit's day has arrived\n`);
  });

  test("step 6 — the therapist finishes the visit, and the booking completes itself", async ({
    browser,
  }) => {
    expect(bookingId).toBeTruthy();
    const db = serviceClient();
    const { context, page } = await pageAs(browser, "therapist_a");

    await gotoAdmin(page, `/admin/bookings/${bookingId}/`, "the therapist's view of their booking");
    await expect(
      page.getByRole("button", { name: /^Mark complete$/i }),
      "the therapist must be able to close off their own work",
    ).toBeVisible({ timeout: 30_000 });

    await awaitAction(page, async () => {
      await page.getByRole("button", { name: /^Mark complete$/i }).click();
    });

    // The app then offers to save a session note. Skipping is a supported
    // choice, and this scenario is about the money, not the notes.
    const noteDialog = page.getByRole("dialog");
    if (await noteDialog.getByRole("button", { name: /^Skip$/ }).isVisible().catch(() => false)) {
      await noteDialog.getByRole("button", { name: /^Skip$/ }).click();
      await page.waitForTimeout(1_000);
    }

    const assignments = await readAssignments(db, bookingId);
    expect(assignments[0].status, "the therapist's own work is done").toBe("completed");

    const booking = await readBooking(db, bookingId);
    // ⛔ THIS IS THE CONTROL FOR THE FUTURE-DATED CASE. Auto-promotion fires
    // only from `updateOwnAssignmentStatus`, and only when the booking's day has
    // arrived. On the day it MUST promote — if this assertion ever goes green
    // while the booking stays `confirmed`, the visit will never reach the
    // completed-revenue figure at all.
    expect(
      booking.status,
      "⛔ the last therapist finishing their work completes the visit itself",
    ).toBe("completed");

    await context.close();
  });

  test("step 7 — the admin records the payment the customer handed over", async ({ browser }) => {
    expect(bookingId).toBeTruthy();
    const db = serviceClient();

    // ⛔ Read the money BEFORE, so step 8 can assert a DELTA. The reports page
    // runs over live production data; an absolute figure would be asserting
    // about every other booking in the window as well as this one.
    const owner = await pageAs(browser, "owner");
    const today = isoDaysFromToday(0);
    await gotoAdmin(owner.page, reportsForDay(today), "the reports page");
    await owner.page.waitForTimeout(3_000);
    collectedBefore = await readMoneyTile(owner.page, "Collected revenue");
    await owner.context.close();

    const { context, page } = await pageAs(browser, "admin");
    await gotoAdmin(page, `/admin/bookings/${bookingId}/`, "the booking detail page");
    const form = page.locator("#booking-status-form");
    await expect(form).toBeVisible({ timeout: 30_000 });

    await form.getByRole("button", { name: /Match total/i }).click();
    await form.getByLabel(/Payment status\*?/i).selectOption("paid");
    await form.getByLabel(/Payment method/i).selectOption("cash");

    await awaitAction(page, async () => {
      await form.getByRole("button", { name: /Save status & payment/i }).click();
    });

    const booking = await readBooking(db, bookingId);
    expect(booking.payment_status, "the visit is paid for").toBe("paid");
    expect(Number(booking.amount_paid), "and for the right amount").toBe(PACKAGE.price);
    expect(booking.payment_method).toBe("cash");
    expect(booking.status, "recording money must not disturb the visit's own status").toBe("completed");

    await context.close();
  });

  test("step 8 — the owner sees the money, and nobody was emailed who should not have been", async ({
    browser,
  }) => {
    expect(bookingId).toBeTruthy();
    const db = serviceClient();
    const today = isoDaysFromToday(0);

    const { context, page } = await pageAs(browser, "owner");

    let collectedAfter = collectedBefore;
    await pollUntil(
      page,
      reportsForDay(today),
      "the owner's reports page",
      async () => {
        await page.waitForTimeout(2_000);
        collectedAfter = await readMoneyTile(page, "Collected revenue");
        return collectedAfter >= collectedBefore + PACKAGE.price;
      },
      { attempts: 6, waitMs: 12_000 },
    );

    expect(
      collectedAfter - collectedBefore,
      `⛔ the £${PACKAGE.price} the customer paid must show up in the owner's collected revenue for today`,
    ).toBe(PACKAGE.price);

    await context.close();

    // ── ⛔ THE EMAIL LEDGER FOR THE WHOLE JOURNEY ────────────────────────
    const events = await emailEvents(db, bookingId);
    const toRealOwner = events.filter((e) => (e.recipient_email ?? e.to_email) === REAL_OWNER_INBOX);
    expect(
      toRealOwner,
      `⛔ across the whole journey the real business inbox should receive exactly ONE message — the new-booking alert. It received ${toRealOwner.length}: ${toRealOwner.map((e) => e.event_type).join(", ")}`,
    ).toHaveLength(1);
    expect(toRealOwner[0].event_type).toBe("admin_booking_notification");

    console.log(
      `\n[A1] COMPLETE. Emails for this booking: ${events
        .map((e) => `${e.event_type}->${e.recipient_email ?? e.to_email}(${e.delivery_status})`)
        .join(", ")}\n`,
    );
  });
});
