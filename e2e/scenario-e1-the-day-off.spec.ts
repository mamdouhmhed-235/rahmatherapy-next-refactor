// ⛔ GATE 08 — P4, FAMILY E, SCENARIO E1: THE DAY OFF.
//
//   ⛔ The Owner's question: "If I close the clinic for a day, does the website
//    really stop taking bookings for it — and do the visits I have ALREADY
//    accepted survive?"
//
// ── ⛔ WHY BOTH HALVES, AND WHY THE SECOND ONE IS THE DANGEROUS ONE ──────
//
// Closing a day is the everyday case: Eid, a training day, a funeral. It has two
// obligations that pull in opposite directions, and getting either one wrong is
// a real-world harm to this clinic:
//
//  1. ⛔ THE DOOR MUST SHUT. If the public form keeps offering that date, a
//     customer books a home visit for a day nobody is working. Nobody finds out
//     until a therapist does not arrive.
//
//  2. ⛔ AND THE BOOKINGS ALREADY IN THE DIARY MUST NOT MOVE. The app's own
//     confirmation promises this in as many words — "Existing bookings on that
//     day stay put." ⚠️ If closing a day silently cancelled, moved or unassigned
//     the visits already on it, the Owner would be told nothing, the customers
//     would be told nothing, and the clinic would simply not turn up. That is a
//     worse outcome than the door staying open, because it is invisible.
//
// ⛔ So a passing "the date disappeared" on its own proves HALF the feature and
// hides the half that hurts. Both are asserted here, on the same date, in the
// same run.
//
// ── ⛔ AND THEN IT MUST COME BACK ────────────────────────────────────────
//
// Same shape as D6: change it, prove it, put it back, prove it went back. A
// closure that cannot be lifted is a day the clinic can never sell again, and
// nobody reports a date quietly missing from a calendar. Step 5 is the step that
// catches that.
//
// ── ⛔ WHAT "DISAPPEARS" ACTUALLY MEANS ON THIS FORM ─────────────────────
//
// Measured, not assumed. `calculateAvailableSlots` returns [] for EVERY staff
// member the moment `globalBlocked` is true (availability.ts:306), so the month
// sweep reports `hasSlots: false` for that date, and `DatePickerField` puts the
// date in its `fullDates` matcher. react-day-picker then renders the day cell
// DISABLED — the button is still in the page, it just cannot be chosen.
//
// ⛔ SO `count()` WOULD PASS IN BOTH DIRECTIONS AND PROVE NOTHING (G3). The
// signal is `isEnabled()`, checked on the very same button before and after.
//
// ── ⛔ TWO LAYERS, BECAUSE EITHER ONE ALONE COULD LIE ────────────────────
//
//   • THE FORM (the layer the Owner's question is about). Driven for real,
//     through the same four steps a customer walks.
//   • THE ENGINE (`POST /api/availability/`), which is what the form asks per
//     day-pick. ⚠️ `ScheduleStep` holds a per-mount `monthCacheRef` of month
//     summaries, so a form assertion alone could in principle be reading a
//     client-side copy. The engine call has no cache in front of it at all.
//
// Each page walk is a FRESH `page.goto`, which drops that in-memory cache, and
// the engine answer must agree with the form both times. If the two ever
// disagree, THAT is the finding.
//
// ── ⛔ CHOSEN DELIBERATELY, NOT BY OFFSET (G9) ───────────────────────────
//
// The clinic works Mon–Sat 08:00–20:00 and is CLOSED ON SUNDAY, so an offset
// that happened to land on a Sunday would produce a date with no times before
// anything was blocked — and this scenario would "pass" having proved nothing.
// The target date is nudged off Sunday and then ASSERTED not to be one.
// The booking window is 29 days and the minimum notice 4 hours, so +7 is
// comfortably inside both.
//
// The seeded visit is assigned to `Test Therapist` — ⛔ never `Test Therapist
// Fresh`, which has `availability_mode: custom` with no rules and is never
// bookable, and ⛔ never the real Owner, whose address is the live business
// inbox.
//
// ── ⛔ THE CACHE THIS SCENARIO HAS TO LIVE WITH (G1) ─────────────────────
//
// `/admin/availability` reads `bookingsByDate` through the cached page. A
// booking seeded straight into the database may or may not be in that copy yet,
// and that decides whether the Owner is shown the "this day already has
// bookings" confirmation. ⛔ BOTH PATHS ARE CORRECT BEHAVIOUR, so the helper
// below handles either and never waits on a dialog that was right not to open.
//
// The admin bookings list is warmed by polling in step 1 — BEFORE anything is
// blocked — so that step 4's "the clinic can still see it" check is measuring
// the blocking, not the cache.
//
// ── ⛔ CLEANING UP ───────────────────────────────────────────────────────
//
// ⚠️ `destroyScenarioFixtures` knows nothing about `blocked_dates` — it sweeps
// clients and what hangs off them. A leaked row here would CLOSE A REAL DAY OF
// TRADING for ever, so `afterAll` deletes the closure and its two audit rows
// itself, re-reads, and reports both its own failures and the fixture sweep's.
//
// ── ⛔ EMAIL COST: ZERO ──────────────────────────────────────────────────
// Blocking a date sends nothing, and the public form is walked to the time step
// but NEVER submitted, so no booking is created and no message is sent.

import { expect, test, type Locator, type Page } from "@playwright/test";
import { format, parseISO } from "date-fns";
import {
  RUN_TAG,
  THERAPIST_A_STAFF_ID,
  auditActions,
  bookingsListForDay,
  destroyScenarioFixtures,
  expectOwnerNeverAssigned,
  gotoAdmin,
  isoDaysFromToday,
  pageAs,
  pollUntil,
  readAssignments,
  readBooking,
  seedWebsiteBooking,
  serviceClient,
  testInbox,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

/**
 * Day of the week for an ISO date, 0 = Sunday.
 *
 * ⛔ Built from the date PARTS, not from `new Date(iso)`. A bare ISO date string
 * is parsed as UTC midnight, which in British Summer Time is the previous
 * evening here — so the naive version reads the wrong weekday for half the year,
 * and would do it silently.
 */
function weekdayOf(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

/**
 * ⛔ The day this scenario closes. +7 is inside the 29-day booking window and
 * far outside the 4-hour minimum notice; the nudge takes it off Sunday, when the
 * clinic is shut anyway and the whole scenario would prove nothing.
 */
const TARGET_OFFSET = weekdayOf(isoDaysFromToday(7)) === 0 ? 8 : 7;
const TARGET_DATE = isoDaysFromToday(TARGET_OFFSET);
const CLOSURE_REASON = `ZZTEST E1 closed day ${RUN_TAG}`;

const clientIds: string[] = [];
/** Every `blocked_dates` id this run created — audit rows are keyed on these. */
const blockedDateIds: string[] = [];

/** Snapshots taken in step 1, compared in step 4. */
let bookingId = "";
let bookingName = "";
let bookingBefore: Record<string, unknown> = {};
let assignmentsBefore = "";
let auditBefore = "";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  const db = serviceClient();
  const problems: string[] = [];

  // ⛔ THE CLOSURE FIRST, AND BY DATE AS WELL AS BY ID. A run that died between
  // creating the row and capturing its id would otherwise leave a real day of
  // trading shut with nothing pointing at it.
  const { data: strays, error: strayError } = await db
    .from("blocked_dates")
    .select("*")
    .eq("blocked_date", TARGET_DATE);
  if (strayError) problems.push(`could not sweep for stray closures: ${strayError.message}`);

  const ids = [
    ...new Set([...blockedDateIds, ...((strays ?? []) as { id: string }[]).map((r) => r.id)]),
  ].filter(Boolean);

  const { error: closureError } = await db
    .from("blocked_dates")
    .delete()
    .eq("blocked_date", TARGET_DATE);
  if (closureError) problems.push(`could not remove the closure: ${closureError.message}`);

  // ⛔ AND ITS AUDIT ROWS. `blocked_date_created` / `blocked_date_deleted` are
  // keyed on the CLOSURE's id, not on any booking or client, so nothing in
  // `destroyScenarioFixtures` would ever find them (G11).
  if (ids.length > 0) {
    const { error: auditError } = await db.from("audit_logs").delete().in("target_id", ids);
    if (auditError) problems.push(`could not remove the closure's audit rows: ${auditError.message}`);
  }

  // ⛔ RE-READ. Do not trust the deletes.
  const { data: survivingClosures } = await db
    .from("blocked_dates")
    .select("*")
    .eq("blocked_date", TARGET_DATE);
  if ((survivingClosures ?? []).length) {
    problems.push(
      `${(survivingClosures ?? []).length} closure row(s) survived on ${TARGET_DATE} — ` +
        `a real day of trading would stay shut for ever`,
    );
  }
  if (ids.length > 0) {
    const { data: survivingAudit } = await db
      .from("audit_logs")
      .select("id")
      .in("target_id", ids);
    if ((survivingAudit ?? []).length) {
      problems.push(`${(survivingAudit ?? []).length} closure audit rows survived`);
    }
  }

  // ⛔ Run the fixture sweep WHATEVER happened above, and carry its complaint
  // instead of letting it replace mine. Either alone leaves production dirty.
  if (clientIds.length > 0) {
    try {
      await destroyScenarioFixtures(db, clientIds);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (problems.length > 0) {
    throw new Error(`⛔ E1 TEARDOWN LEFT PRODUCTION DIRTY:\n  - ${problems.join("\n  - ")}`);
  }
});

/**
 * Ask the booking engine directly what it would offer on a date.
 *
 * ⛔ Nothing caches this route, so it is the answer with no client-side copy in
 * between — the control on the form assertions, not a substitute for them.
 * `hijama-package` is the SLUG the public form posts, not the service uuid.
 */
async function offeredTimes(date: string): Promise<string[]> {
  const response = await fetch(`${process.env.E2E_BASE_URL}/api/availability/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      date,
      serviceIds: ["hijama-package"],
      participantGenders: ["female"],
      city: "Luton",
    }),
  });
  // ⛔ A native fetch Response — `status` is a property. And it is READ, not
  // assumed: a 429 from the shared rate limiter would otherwise arrive as an
  // empty slot list and read exactly like a closed day (G5's lesson, applied to
  // an HTTP call instead of a database write).
  expect(
    response.status,
    `⛔ the availability endpoint refused a plain question about ${date}`,
  ).toBe(200);
  const payload = (await response.json()) as { slots?: { time: string }[] };
  return (payload.slots ?? []).map((slot) => slot.time);
}

/**
 * Walk the real public booking dialog as far as its calendar and STOP.
 *
 * ⛔ Never submits. The scenario's question is about what the form OFFERS, and
 * submitting would create a booking and spend three emails to learn nothing.
 * ⚠️ The single female participant and the Luton address mirror the seeded
 * visit, so the two are asking the clinic the same question.
 */
async function openPublicCalendar(page: Page) {
  await page.goto("/home/?booking=1", { waitUntil: "domcontentloaded" });
  const dialog = page.getByRole("dialog");
  await expect(dialog, "the public booking dialog should open").toBeVisible({ timeout: 30_000 });

  await dialog.getByRole("button", { name: /Hijama Package/i }).first().click();
  await dialog.getByRole("button", { name: /^Continue$/ }).click();

  await expect(
    dialog.getByRole("heading", { name: /^About you$/i }).first(),
    "the dialog should reach its About you step",
  ).toBeVisible({ timeout: 20_000 });

  await dialog.getByRole("button", { name: /^For myself/ }).click();
  await dialog.getByLabel(/Main contact name/i).fill(`ZZTEST-E1-LOOKING-${RUN_TAG}`);
  await dialog.getByLabel(/Phone \/ WhatsApp number/i).fill("07700900301");
  await dialog.getByLabel(/Email address/i).fill(testInbox("e1looking"));
  await dialog.getByRole("button", { name: /^Female$/ }).first().click();
  await dialog.getByRole("button", { name: /^Luton$/ }).click();
  await dialog.getByLabel(/Area \/ County/i).fill("Bedfordshire");
  await dialog.getByLabel(/Postcode/i).fill("LU1 1AA");
  await dialog.getByLabel(/Home visit address/i).fill("1 ZZTEST Street");
  await dialog.getByRole("button", { name: /^Continue$/ }).click();

  await expect(
    dialog.getByRole("heading", { name: /Choose a matched time/i }),
    "the dialog should reach its Time step",
  ).toBeVisible({ timeout: 30_000 });

  return dialog;
}

/**
 * Find the target date's cell in the calendar, hopping months if it is not on
 * the page yet.
 *
 * ⛔ The label is built with the SAME formatter react-day-picker used to write
 * it (`format(date, "PPPP")` — DayButton.js), so this cannot drift into
 * matching nothing and silently reporting a missing date. A `*=` match, not an
 * exact one, because the library decorates the label with "Today, " and
 * ", selected" as the state changes.
 *
 * ⛔ A blocked date is DISABLED, not removed, so this finds the cell in both
 * directions — which is exactly what makes the enabled/disabled comparison
 * below meaningful.
 */
async function findDayCell(page: Page, dialog: Locator, date: string): Promise<Locator> {
  const label = format(parseISO(date), "PPPP");
  const cell = dialog.locator(`button[aria-label*="${label}"]`);

  // ⛔ BOUNDED (G3). Three hops covers the 29-day window from any day of any
  // month; a fourth would mean the calendar cannot reach a date the booking
  // window says is bookable, and that is a finding, not something to wait out.
  for (let hop = 0; hop < 3; hop += 1) {
    if ((await cell.count()) > 0) return cell.first();

    const next = dialog.getByRole("button", { name: /Go to the Next Month/i });
    if ((await next.count()) === 0 || !(await next.first().isEnabled())) break;
    await next.first().click();
    await page.waitForTimeout(3_000);
  }

  expect(
    await cell.count(),
    `⛔ the public calendar never showed ${date} at all, within ${TARGET_OFFSET} days of today — ` +
      `the booking window says it should be reachable`,
  ).toBeGreaterThan(0);
  return cell.first();
}

/** Close the clinic for a date, through the Owner's own screen. */
async function blockTheDate(page: Page) {
  await gotoAdmin(page, "/admin/availability/", "the Owner's availability screen");

  // ⛔ Addressed by form field name, not by its "Date" label: the Adjustments
  // panel on the same screen has a date field too, and a label match would be
  // ambiguous in a way that fails as "found nothing".
  const form = page.locator('form:has(input[name="blocked_date"])');
  await expect(
    form,
    "⛔ the Owner must be able to find the closed-dates form",
  ).toBeVisible({ timeout: 30_000 });
  await form.scrollIntoViewIfNeeded();

  await form.locator('input[name="blocked_date"]').fill(TARGET_DATE);
  await form.locator('input[name="reason"]').fill(CLOSURE_REASON);

  const submit = form.getByRole("button", { name: /^Add closed date$/ });
  expect(
    await submit.isEnabled(),
    "⛔ the Add closed date button must be usable, not merely present (G3)",
  ).toBe(true);

  // ⛔ Armed BEFORE the click, because the click may not be what fires the
  // action. If the cached page already knows there are bookings on this date,
  // the first click only opens a confirmation and the server action fires from
  // "Block anyway" instead. One promise covers both routes.
  const answered = page.waitForResponse(
    (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
    { timeout: 60_000 },
  );
  await submit.click();

  // ⚠️ EITHER OUTCOME IS CORRECT (G1). Whether this dialog appears depends on
  // whether the cached page has seen the seeded booking yet, so its absence is
  // never treated as a failure — and it is waited for briefly, never
  // indefinitely.
  const blockAnyway = page.getByRole("button", { name: /^Block anyway$/ });
  let warned = false;
  try {
    await blockAnyway.waitFor({ state: "visible", timeout: 5_000 });
    warned = true;
    await blockAnyway.click();
  } catch {
    warned = false;
  }

  await answered;
  await page.waitForTimeout(1_500);
  return warned;
}

/** Re-open the clinic for the date, through the Owner's own screen. */
async function unblockTheDate(page: Page) {
  await gotoAdmin(page, "/admin/availability/", "the Owner's availability screen");

  // ⛔ FOUND BY THE REASON THIS RUN WROTE, NOT BY A REBUILT DATE STRING.
  //
  // ⚠️ MEASURED, first run: the button's name comes from
  // `toLocaleDateString("en-GB", { month: "short" })`, and Chromium renders
  // September as "Sept" — four letters. Every date library writes "Sep". So a
  // locator that rebuilds the label matches NOTHING for one month of the year,
  // and reports it as "the Owner cannot lift the closure" — a defect in the app
  // that does not exist.
  //
  // ⛔ And the reason string is the safer anchor anyway: it carries this run's
  // tag, so this can only ever remove THIS scenario's closure and never a real
  // day the clinic meant to shut.
  const row = page.getByRole("listitem").filter({ hasText: CLOSURE_REASON });
  await expect(
    row,
    `⛔ the Owner must be able to find the closure for ${TARGET_DATE} in order to lift it`,
  ).toHaveCount(1, { timeout: 30_000 });

  const remove = row.getByRole("button", { name: /^Remove closed date/ });
  await expect(
    remove,
    "⛔ the closure must offer exactly one way to lift it",
  ).toHaveCount(1, { timeout: 15_000 });
  await remove.first().scrollIntoViewIfNeeded();
  expect(
    await remove.first().isEnabled(),
    "⛔ the remove control must be usable, not merely present (G3)",
  ).toBe(true);

  // Kept for the evidence line — this is the date the clinic is being told it
  // is re-opening, in the clinic's own words.
  const removedLabel = (await remove.first().getAttribute("aria-label")) ?? "";
  await remove.first().click();

  const confirm = page.getByRole("dialog").getByRole("button", { name: /^Remove$/, exact: true });
  await expect(
    confirm,
    "⛔ removing a closure asks for confirmation; that dialog must appear",
  ).toBeVisible({ timeout: 15_000 });

  const answered = page.waitForResponse(
    (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
    { timeout: 60_000 },
  );
  await confirm.first().click();
  await answered;
  await page.waitForTimeout(1_500);
  return removedLabel;
}

async function closuresOn(date: string) {
  const db = serviceClient();
  // ⛔ `.select("*")` — a named column list that misses returns NO ROWS rather
  // than an error, which would read here as "the closure was never made" (G4).
  const { data, error } = await db.from("blocked_dates").select("*").eq("blocked_date", date);
  if (error) throw new Error(`could not read blocked_dates for ${date}: ${error.message}`);
  return (data ?? []) as { id: string; blocked_date: string; reason: string | null }[];
}

test.describe("E1 — the day off: does closing a date shut the door without disturbing the diary?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ the control: the date is OPEN, and a real visit is already on it", async ({
    browser,
  }) => {
    const db = serviceClient();

    // ⛔ A date the clinic never works would make every assertion below pass
    // while proving nothing (G9).
    expect(
      weekdayOf(TARGET_DATE),
      `⛔ ${TARGET_DATE} is a Sunday. The clinic is closed on Sundays, so it has no times to lose.`,
    ).not.toBe(0);

    // ⛔ Start from a known state. A closure left behind by an earlier run would
    // make step 1 fail for entirely the wrong reason.
    const leftovers = await closuresOn(TARGET_DATE);
    if (leftovers.length > 0) {
      const { error } = await db.from("blocked_dates").delete().eq("blocked_date", TARGET_DATE);
      expect(error?.message ?? "", "could not clear a leftover closure").toBe("");
    }
    expect(
      (await closuresOn(TARGET_DATE)).length,
      `⛔ ${TARGET_DATE} must start OPEN`,
    ).toBe(0);

    // ── The visit that must survive being closed around ──────────────────
    const seeded = await seedWebsiteBooking(db, "E1", {
      dayOffset: TARGET_OFFSET,
      startTime: "11:00:00",
      status: "confirmed",
      assignTo: THERAPIST_A_STAFF_ID,
    });
    clientIds.push(seeded.clientId);
    bookingId = seeded.bookingId;
    bookingName = seeded.name;

    // ⛔ ASSERT THE FIXTURE ACTUALLY APPLIED before drawing a conclusion from
    // anything downstream of it (G5).
    bookingBefore = await readBooking(db, bookingId);
    expect(
      bookingBefore.booking_date,
      "⛔ the fixture must really be on the date this scenario closes",
    ).toBe(TARGET_DATE);
    expect(bookingBefore.status, "⛔ and it must really be a confirmed visit").toBe("confirmed");
    await expectOwnerNeverAssigned(db, bookingId);

    assignmentsBefore = JSON.stringify(
      (await readAssignments(db, bookingId)).sort((a, b) => a.id.localeCompare(b.id)),
    );
    auditBefore = JSON.stringify((await auditActions(db, bookingId)).sort());

    // ── The door is open: the ENGINE ─────────────────────────────────────
    const timesBefore = await offeredTimes(TARGET_DATE);
    expect(
      timesBefore.length,
      `⛔ THE CONTROL FAILED. ${TARGET_DATE} offered no appointment times BEFORE anything was ` +
        `closed, so this scenario could not tell a closure from an ordinary quiet day.`,
    ).toBeGreaterThan(0);

    // ── The door is open: the FORM ───────────────────────────────────────
    const context = await browser.newContext();
    const page = await context.newPage();
    const dialog = await openPublicCalendar(page);
    const cell = await findDayCell(page, dialog, TARGET_DATE);
    const openToCustomers = await cell.isEnabled();
    await context.close();

    expect(
      openToCustomers,
      `⛔ THE CONTROL FAILED. ${TARGET_DATE} was already unbookable on the public form before ` +
        `anything was closed. Nothing below would mean anything.`,
    ).toBe(true);

    // ⛔ Warm the admin list NOW, while nothing has been blocked. A row written
    // straight to the database does not appear on a cached admin list until the
    // window turns over (G1) — doing this here means step 4's check is
    // measuring the closure, not the cache.
    const owner = await pageAs(browser, "owner");
    const attempts = await pollUntil(
      owner.page,
      bookingsListForDay(TARGET_DATE),
      "the bookings list for the day about to be closed",
      async () => (await owner.page.getByText(bookingName, { exact: false }).count()) > 0,
      { attempts: 10, waitMs: 8_000 },
    );
    await owner.context.close();

    console.log(
      `[E1] step 1 — control: ${TARGET_DATE} is open (${timesBefore.length} times offered, the ` +
        `calendar cell is clickable) and carries one confirmed visit, visible to the clinic ` +
        `after ${attempts} reload(s).`,
    );
  });

  test("step 2 — ✅ the Owner closes the clinic for that date", async ({ browser }) => {
    expect(bookingId, "step 1 must have run").not.toBe("");

    const { context, page } = await pageAs(browser, "owner");
    const warned = await blockTheDate(page);
    await context.close();

    // ⛔ The database is the truth, not the toast.
    const closures = await closuresOn(TARGET_DATE);
    expect(
      closures.length,
      `⛔ the closure must be RECORDED against ${TARGET_DATE}, not just shown on screen`,
    ).toBe(1);
    expect(closures[0].reason, "the Owner's reason must be kept with it").toBe(CLOSURE_REASON);
    blockedDateIds.push(closures[0].id);

    // ⛔ And the clinic must be able to see WHO shut the day. A closure with no
    // trail is one nobody can explain later.
    const trail = await auditActions(serviceClient(), closures[0].id);
    expect(
      trail,
      "⛔ closing a day must leave an audit trail",
    ).toContain("blocked_date_created");

    console.log(
      `[E1] step 2 — closed: one blocked_dates row for ${TARGET_DATE}, reason kept, audited. ` +
        `The "this day already has bookings" confirmation ${warned ? "was shown" : "was not shown — the cached page had not seen the seeded visit yet, which is expected (G1)"}.`,
    );
  });

  test("step 3 — ⛔ THE DOOR SHUTS: the date is gone from the PUBLIC booking form", async ({
    browser,
  }) => {
    expect(blockedDateIds.length, "step 2 must have run").toBeGreaterThan(0);

    // ── The engine ───────────────────────────────────────────────────────
    const timesAfter = await offeredTimes(TARGET_DATE);
    expect(
      timesAfter,
      `⛔ THE CLINIC IS CLOSED ON ${TARGET_DATE} AND THE BOOKING ENGINE IS STILL OFFERING ` +
        `${timesAfter.length} TIME(S) ON IT: ${timesAfter.slice(0, 5).join(", ")}. A customer could ` +
        `book a home visit for a day nobody is working.`,
    ).toEqual([]);

    // ── The form ─────────────────────────────────────────────────────────
    // ⛔ A FRESH PAGE, so the dialog's in-memory month cache starts empty and
    // this is a real answer rather than a remembered one.
    const context = await browser.newContext();
    const page = await context.newPage();
    const dialog = await openPublicCalendar(page);
    const cell = await findDayCell(page, dialog, TARGET_DATE);
    const stillBookable = await cell.isEnabled();

    // ⛔ AND THE REST OF THE CALENDAR MUST SURVIVE. Closing one day must not
    // close the shop: if every cell went dark, the "fix" would be far worse
    // than the fault, and an assertion on the target date alone would applaud
    // it.
    const cells = dialog.locator('button[aria-label*="day,"]');
    const total = await cells.count();
    let otherDaysStillOpen = 0;
    for (let index = 0; index < total; index += 1) {
      if (await cells.nth(index).isEnabled()) otherDaysStillOpen += 1;
    }
    await context.close();

    expect(
      stillBookable,
      `⛔ THE DOOR DID NOT SHUT. ${TARGET_DATE} is closed, and the public booking form still ` +
        `lets a customer pick it.`,
    ).toBe(false);
    expect(
      otherDaysStillOpen,
      `⛔ closing ONE day emptied the whole calendar — no other date in the visible month can be ` +
        `booked either. The clinic would take no bookings at all.`,
    ).toBeGreaterThan(0);

    console.log(
      `[E1] step 3 — shut: the engine offers 0 times on ${TARGET_DATE}, the calendar cell is ` +
        `disabled, and ${otherDaysStillOpen} other day(s) in the visible month are still bookable.`,
    );
  });

  test("step 4 — ⛔ THE HALF THAT HURTS: the visit already in the diary is untouched", async () => {
    expect(bookingId, "step 1 must have run").not.toBe("");
    const db = serviceClient();

    // ⛔ THE WHOLE ROW, COMPARED WHOLE. Naming the columns I expected to change
    // is how a run misses the one it did not think of — and `updated_at` moving
    // at all would itself mean the booking was written to.
    const after = await readBooking(db, bookingId);
    expect(
      after,
      `⛔ CLOSING THE DAY CHANGED A BOOKING THAT WAS ALREADY ON IT. The app promises "Existing ` +
        `bookings on that day stay put". Before: ${JSON.stringify(bookingBefore)} — after: ` +
        `${JSON.stringify(after)}`,
    ).toEqual(bookingBefore);

    // ⛔ AND THE THERAPIST IS STILL ON IT. A visit that survives as a row but
    // loses its assignment is a visit nobody is going to.
    const assignmentsAfter = JSON.stringify(
      (await readAssignments(db, bookingId)).sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(
      assignmentsAfter,
      `⛔ closing the day changed who is going to the existing visit. Before: ${assignmentsBefore}`,
    ).toBe(assignmentsBefore);
    await expectOwnerNeverAssigned(db, bookingId);

    // ⛔ AND NOTHING HAPPENED TO IT QUIETLY. A new audit action against this
    // booking would mean the closure acted on it without telling anyone.
    const auditAfter = JSON.stringify((await auditActions(db, bookingId)).sort());
    expect(
      auditAfter,
      `⛔ closing the day performed an action ON the existing booking. Before: ${auditBefore} — ` +
        `after: ${auditAfter}`,
    ).toBe(auditBefore);

    console.log(
      `[E1] step 4 — untouched: the whole booking row, its assignment and its audit trail are ` +
        `byte-for-byte what they were before the day was closed.`,
    );
  });

  test("step 5 — ⛔ AND IT COMES BACK: lifting the closure re-opens the date", async ({
    browser,
  }) => {
    expect(blockedDateIds.length, "step 2 must have run").toBeGreaterThan(0);
    const db = serviceClient();

    const { context, page } = await pageAs(browser, "owner");
    const removedLabel = await unblockTheDate(page);
    await context.close();

    expect(
      (await closuresOn(TARGET_DATE)).length,
      `⛔ lifting the closure must DELETE the row, not leave it behind`,
    ).toBe(0);

    const trail = await auditActions(db, blockedDateIds[0]);
    expect(
      trail,
      "⛔ re-opening a day must be audited too — otherwise nobody can explain why it changed",
    ).toContain("blocked_date_deleted");

    // ⛔ THE ROW BEING GONE IS NOT THE SAME AS THE DAY BEING BACK. Nobody
    // reports a date quietly missing from a calendar, so this is checked in the
    // same two places, the same way round, as step 3.
    const timesBack = await offeredTimes(TARGET_DATE);
    expect(
      timesBack.length,
      `⛔ THE DAY DID NOT COME BACK. The closure on ${TARGET_DATE} was lifted and the booking ` +
        `engine still offers no times — that day can never be sold again.`,
    ).toBeGreaterThan(0);

    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    const dialog = await openPublicCalendar(publicPage);
    const cell = await findDayCell(publicPage, dialog, TARGET_DATE);
    const bookableAgain = await cell.isEnabled();
    await publicContext.close();

    expect(
      bookableAgain,
      `⛔ THE DAY DID NOT COME BACK ON THE FORM. The closure is gone from the database and the ` +
        `public calendar still will not let a customer pick ${TARGET_DATE}.`,
    ).toBe(true);

    // ⛔ And the visit is STILL untouched, after the whole round trip.
    const after = await readBooking(db, bookingId);
    expect(
      after,
      "⛔ re-opening the day changed the booking that had been sitting on it",
    ).toEqual(bookingBefore);

    console.log(
      `\n[E1] COMPLETE. ${TARGET_DATE}: open -> closed (0 times, cell disabled) -> open again ` +
        `(${timesBack.length} times, cell clickable), with the confirmed visit on that date ` +
        `unchanged throughout. Lifted via "${removedLabel}".\n`,
    );
  });
});
