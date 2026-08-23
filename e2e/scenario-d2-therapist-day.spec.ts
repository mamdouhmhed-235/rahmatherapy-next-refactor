// ⛔ GATE 08 — P3, FAMILY D, SCENARIO D2: A THERAPIST'S WORKING DAY.
//
//   ⛔ The Owner's question: "Is the day-to-day tool usable by the person who
//    uses it most?"
//
// A therapist's whole working relationship with this system is four things: see
// what I have on, open one, write down what happened, mark it done. ⚠️ If any of
// those is awkward the clinic's records quietly stop matching reality, because
// the person doing the work stops keeping them.
//
// ── ⛔ THE REAL RULE HIDING IN THIS JOURNEY ──────────────────────────────
//
// When a therapist marks her own assignment done, the BOOKING can auto-complete
// — but only if every assignment on it is finished AND the visit is not in the
// future. ⛔ `autoPromoteBookingFromAssignments` refuses a future-dated booking
// deliberately: an outcome cannot be recorded before the day it happens on.
//
// ⚠️ Without that guard a therapist tidying up next week's list today would mark
// visits complete that have not happened, and the clinic's revenue and history
// would both be wrong. Step 4 is that rule, driven in a browser.
//
// ── ⚠️ A CACHING TRAP I DECIDED TO MEASURE RATHER THAN ASSUME ────────────
//
// Admin pages are cached (`unstable_cache`) and invalidated by server actions.
// ⛔ These fixtures are written STRAIGHT INTO THE DATABASE, which invalidates
// nothing — so a fixed URL like the dashboard can legitimately show a stale
// list, through no fault of the app.
//
// So step 1 asserts only what is safe to assert: that her dashboard LOADS and is
// the practitioner view. Whether the fresh fixture appears on it is RECORDED,
// not asserted. ⚠️ Reporting "the therapist cannot see her own work" off the back
// of my own seeding method would be a false alarm, and this run has already
// produced four of those.
//
// ── ⛔ EMAIL COST: ZERO ──────────────────────────────────────────────────
// `updateOwnAssignmentStatus` sends nothing — it updates the row and clears
// caches. Verified in the action itself, not assumed.

import { expect, test, type Page } from "@playwright/test";
import {
  destroyScenarioFixtures,
  gotoAdmin,
  pageAs,
  readAssignments,
  readBooking,
  seedWebsiteBooking,
  serviceClient,
  THERAPIST_A_STAFF_ID,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const clientIds: string[] = [];
let todayJob: SeededBooking;
let futureJob: SeededBooking;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (clientIds.length === 0) return;
  await destroyScenarioFixtures(serviceClient(), clientIds);
});

/**
 * Click "Mark complete" and, if the session-note sheet opens, write the note.
 *
 * ⛔ The assignment completes on the CLICK — the sheet is opened afterwards by
 * `onSuccess`. So the note is genuinely optional, and a test that waited for the
 * sheet before believing the work was done would be testing the wrong thing.
 */
async function markCompleteAndNote(page: Page, note: string | null) {
  const button = page.getByRole("button", { name: /^Mark complete$/ });
  await expect(
    button,
    "⛔ a therapist must be able to mark her OWN work complete",
  ).toBeVisible({ timeout: 30_000 });
  await button.first().click();
  await page.waitForTimeout(3_000);

  const textarea = page.getByPlaceholder("What happened in this session?");
  const sheetOpened = (await textarea.count()) > 0;

  if (sheetOpened && note) {
    await textarea.first().fill(note);
    await page.getByRole("button", { name: /^Save note$/ }).first().click();
    await page.waitForTimeout(3_000);
  } else if (sheetOpened) {
    const skip = page.getByRole("button", { name: /^Skip$/ });
    if ((await skip.count()) > 0) await skip.first().click();
    await page.waitForTimeout(1_500);
  }

  return { sheetOpened };
}

test.describe("D2 — a therapist's working day: is the tool usable by the person who uses it most?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ she can see her day", async ({ browser }) => {
    const db = serviceClient();

    // ⛔ Early in the morning, so "now" is comfortably past the start time and
    // no temporal guard on the Mark-complete control can confuse the result.
    todayJob = await seedWebsiteBooking(db, "D2-TODAY", {
      dayOffset: 0,
      startTime: "09:00:00",
      status: "confirmed",
      participants: [{ gender: "female", requiredGender: "female" }],
      assignTo: THERAPIST_A_STAFF_ID,
    });
    clientIds.push(todayJob.clientId);

    const seeded = await readAssignments(db, todayJob.bookingId);
    expect(
      seeded[0].assigned_staff_id,
      "⛔ the fixture must actually be HER work, or nothing below is her day",
    ).toBe(THERAPIST_A_STAFF_ID);

    const { context, page } = await pageAs(browser, "therapist_a");
    await gotoAdmin(page, "/admin/dashboard/", "the therapist dashboard");
    await page.waitForTimeout(2_500);
    const dash = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    await context.close();

    // ⛔ ASSERTED: her dashboard works and is the practitioner's view.
    expect(
      dash.length,
      "⛔ the dashboard must actually render something for a therapist",
    ).toBeGreaterThan(200);
    expect(
      /visit|today|booking/i.test(dash),
      `⛔ a therapist's dashboard must be about her visits. It said: "${dash.slice(0, 300)}"`,
    ).toBe(true);

    // ⚠️ RECORDED, NOT ASSERTED — see the note at the top of this file. The
    // fixture is written straight to the database, which clears no caches.
    console.log(
      `[D2] step 1 — dashboard loaded. Fresh fixture visible on it: ${dash.includes(todayJob.name)} (recorded only; direct DB seeding invalidates no cache).`,
    );
  });

  test("step 2 — ⛔ she opens her own booking and can see the customer", async ({
    browser,
  }) => {
    expect(todayJob?.bookingId, "step 1 must have run").toBeTruthy();

    const { context, page } = await pageAs(browser, "therapist_a");
    await gotoAdmin(page, `/admin/bookings/${todayJob.bookingId}/`, "her booking");
    await page.waitForTimeout(1_500);
    const seen = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    await context.close();

    expect(
      seen,
      `⛔ a therapist must see WHO she is treating on her own booking. It said: "${seen.slice(0, 300)}"`,
    ).toContain(todayJob.name);

    console.log(`[D2] step 2 — her booking opens with the customer's details on it.`);
  });

  test("step 3 — ✅ she writes up the visit and marks it done", async ({ browser }) => {
    expect(todayJob?.bookingId, "step 1 must have run").toBeTruthy();
    const db = serviceClient();

    const note = `ZZTEST D2 session note ${todayJob.name}`;
    const { context, page } = await pageAs(browser, "therapist_a");
    await gotoAdmin(page, `/admin/bookings/${todayJob.bookingId}/`, "her booking");
    await page.waitForTimeout(1_500);
    const { sheetOpened } = await markCompleteAndNote(page, note);
    await context.close();

    // ⛔ HER OWN WORK IS DONE.
    const assignments = await readAssignments(db, todayJob.bookingId);
    expect(
      assignments[0].status,
      "⛔ marking her own assignment complete must actually record it",
    ).toBe("completed");

    // ⛔ AND THE BOOKING FOLLOWED, because every assignment on it is finished
    // and the visit is TODAY, not in the future.
    const booking = await readBooking(db, todayJob.bookingId);
    expect(
      booking.status,
      "⛔ when the last assignment on a booking is finished and the day has come, the booking itself should be complete",
    ).toBe("completed");

    // ✅ The write-up reached the client's record, where the team can find it.
    //
    // ⚠️ SELECT *, AND THAT IS NOT LAZINESS. My first version asked for a
    // column called `content`; the column is `note`. A hand-written column list
    // that names a column which does not exist comes back as NO ROWS, not as an
    // error — so the test reported "she wrote a note and it vanished" when the
    // note was sitting in the table all along. This repo has now been bitten by
    // that exact shape four times.
    const { data: notes } = await db
      .from("client_notes")
      .select("*")
      .eq("client_id", todayJob.clientId);
    const saved = (notes ?? []) as { id: string; note: string | null }[];

    expect(
      sheetOpened,
      "⛔ a therapist with permission to write session notes must be OFFERED the note after finishing",
    ).toBe(true);
    expect(
      saved.some((n) => (n.note ?? "").includes("ZZTEST D2 session note")),
      `⛔ the note she typed must be saved on the client's record. Found ${saved.length} note(s): ${JSON.stringify(saved).slice(0, 300)}`,
    ).toBe(true);

    console.log(
      `[D2] step 3 — marked complete, booking auto-completed, and the session note is on the client's record.`,
    );
  });

  test("step 4 — ⛔ THE RULE: finishing NEXT WEEK's work must not complete next week's booking", async ({
    browser,
  }) => {
    const db = serviceClient();

    // ⛔ Identical to step 3's booking in every respect except the DATE.
    futureJob = await seedWebsiteBooking(db, "D2-FUTURE", {
      dayOffset: 12,
      startTime: "09:00:00",
      status: "confirmed",
      participants: [{ gender: "female", requiredGender: "female" }],
      assignTo: THERAPIST_A_STAFF_ID,
    });
    clientIds.push(futureJob.clientId);

    const { context, page } = await pageAs(browser, "therapist_a");
    await gotoAdmin(page, `/admin/bookings/${futureJob.bookingId}/`, "next week's booking");
    await page.waitForTimeout(1_500);
    await markCompleteAndNote(page, null);
    await context.close();

    // ⛔ Her own line CAN be finished — the app does not stop her tidying up.
    const assignments = await readAssignments(db, futureJob.bookingId);
    expect(
      assignments[0].status,
      "⛔ THE CONTROL FOR THIS STEP. If her assignment did not complete either, then 'the booking stayed open' proves nothing — it would just mean the button failed.",
    ).toBe("completed");

    // ⛔ BUT THE VISIT HAS NOT HAPPENED YET.
    const booking = await readBooking(db, futureJob.bookingId);
    expect(
      booking.status,
      "⛔ A VISIT WAS MARKED AS HAVING HAPPENED BEFORE ITS DATE. An outcome cannot be recorded before the day it falls on — this would put money and history in the wrong week.",
    ).not.toBe("completed");
    expect(booking.status, "and it should simply be left as it was").toBe("confirmed");

    console.log(
      `\n[D2] COMPLETE. She sees her day, opens her booking, writes it up, marks it done — and next week's visit stayed open, because it has not happened yet.\n`,
    );
  });
});
