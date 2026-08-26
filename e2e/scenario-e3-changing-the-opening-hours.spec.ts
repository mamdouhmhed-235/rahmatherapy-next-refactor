// ⛔ GATE 08 — P4, FAMILY E, SCENARIO E3: CHANGING THE OPENING HOURS.
//
//   ⛔ The Owner's question: "Do my new hours actually reach the booking form?"
//
// ── ⛔ WHY THIS ONE IS THE DANGEROUS ONE ─────────────────────────────────
//
// E1 and E2 each ADDED a row and deleted it again. ⛔ E3 EDITS A ROW THE CLINIC
// ALREADY TRADES ON. Getting the restore wrong does not leave litter a sweep can
// find — it leaves the clinic **permanently open at the wrong hours**, selling
// visits nobody is there for, and nobody is told. Everything below is arranged
// around that.
//
// ── ⛔ WHAT ONE CLICK OF "SAVE HOURS" ACTUALLY DOES — MEASURED ───────────
//
// Three facts, none of them obvious from the screen, all of which change how
// this file has to be written:
//
//  1. ⛔ IT SAVES ALL SEVEN DAYS, NOT THE ONE YOU EDITED.
//     `AvailabilityRulesManager.performSave` maps over `orderedDays` and calls
//     `saveAvailabilityDay` for every one of them, in parallel. ⚠️ So a single
//     click rewrites the whole week from the browser's in-memory copy — which
//     is exactly why step 4 exists: if that copy were ever wrong, editing
//     Wednesday would silently rewrite Thursday and nothing on screen would say
//     so.
//
//  2. ⛔ THE ROWS ARE DELETED AND RE-INSERTED, SO THE IDS CHANGE EVERY SAVE.
//     `save_availability_day` (the database function) does
//     `DELETE … WHERE day_of_week = p_day_of_week` then `INSERT … RETURNING *`.
//     ⚠️ THEREFORE "restored byte-for-byte" CANNOT mean the same `id`, and any
//     assertion that demanded it would fail for ever on a system that is
//     working perfectly. What must come back identical is the CONTENT —
//     `day_of_week`, `start_time`, `end_time`, `is_working_day` — for all seven
//     days. That is what this file compares, and it says so out loud rather
//     than quietly dropping the id.
//
//  3. ⛔ ONE CLICK WRITES SEVEN AUDIT ROWS, one per day. Two clicks (change and
//     restore) leave fourteen. They are keyed on an `availability_rules` id
//     that fact 2 has already destroyed, so nothing else can ever find them —
//     this file records which audit rows existed BEFORE it started and removes
//     exactly the difference.
//
// ⚠️ Fact 1 also breaks the usual "wait for the server action" trick: seven
// actions fire at once, so the first response back says nothing about the other
// six. The save is therefore confirmed by POLLING THE DATABASE until the change
// is really there, bounded (G3), never by a fixed sleep.
//
// ── ⛔ THE SHAPE OF THE PROOF ────────────────────────────────────────────
//
// Narrow one weekday from 08:00–20:00 to 10:00–14:00, then show:
//   • the PUBLIC booking form's offered times move to match — nothing before
//     10:00, nothing after the last start that still fits inside 14:00;
//   • ⛔ the SAME weekday next door does NOT move (fact 1's safety net);
//   • ⛔ a visit already booked at 16:00 — now outside the new hours — is
//     untouched. This is the Owner's real fear when shortening a day: "did my
//     4pm client just get cancelled?" The answer must be no, and silently
//     cancelling would be far worse than the hours not applying at all;
//   • and then the old hours come back, exactly.
//
// ⛔ Two layers again, because either alone could lie: the real booking dialog
// (what a customer sees) and `POST /api/availability/` (uncached, no
// client-side copy in between). They must agree.
//
// ── ⛔ CHOSEN DELIBERATELY (G9) ──────────────────────────────────────────
//
// +21 days, and the day after it as the control — nudged until NEITHER is a
// Sunday, when the clinic is shut and no change to its hours could show. Both
// are inside the 29-day booking window. The dates are a different week again
// from E1's +7 and E2's +14, so the three scenarios can never collide.
//
// ── ⛔ EMAIL COST: ZERO ──────────────────────────────────────────────────

import { expect, test, type Locator, type Page } from "@playwright/test";
import { format, parseISO } from "date-fns";
import {
  RUN_TAG,
  THERAPIST_A_STAFF_ID,
  auditActions,
  destroyScenarioFixtures,
  expectOwnerNeverAssigned,
  gotoAdmin,
  isoDaysFromToday,
  pageAs,
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
 * ⛔ Built from the date PARTS. `new Date(iso)` reads a bare ISO date as UTC
 * midnight, which in British Summer Time is the previous evening here.
 */
function weekdayOf(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

/**
 * ⛔ +21, nudged until the edited day AND its control are both working days.
 * A Sunday on either side would make this scenario pass having proved nothing.
 */
function pickOffset() {
  for (let offset = 21; offset <= 26; offset += 1) {
    if (weekdayOf(isoDaysFromToday(offset)) !== 0 && weekdayOf(isoDaysFromToday(offset + 1)) !== 0) {
      return offset;
    }
  }
  return 21;
}

const EDIT_OFFSET = pickOffset();
const EDIT_DATE = isoDaysFromToday(EDIT_OFFSET);
const CONTROL_DATE = isoDaysFromToday(EDIT_OFFSET + 1);
const EDIT_WEEKDAY = weekdayOf(EDIT_DATE);
const CONTROL_WEEKDAY = weekdayOf(CONTROL_DATE);

const DAY_NAMES: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

const NEW_OPEN = "10:00";
const NEW_CLOSE = "14:00";

/** ⛔ Deliberately AFTER the new closing time. */
const VISIT_TIME = "16:00:00";

type RuleContent = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working_day: boolean;
};

const clientIds: string[] = [];

/** ⛔ The restore value. The WHOLE week, read with `.select("*")`. */
let ruleSnapshot: RuleContent[] = [];
/** Audit rows that existed before this run — anything new is ours to remove. */
let auditIdsBefore = new Set<string>();

let editTimesBefore: string[] = [];
let controlTimesBefore: string[] = [];

let visitId = "";
let visitBefore: Record<string, unknown> = {};
let visitAssignmentsBefore = "";
let visitAuditBefore = "";

test.describe.configure({ mode: "serial" });

/**
 * Read the clinic's whole weekly schedule as CONTENT, ids deliberately dropped.
 *
 * ⛔ `.select("*")` — a named column list that misses a column returns NO ROWS
 * rather than an error, which would read here as "the clinic has no hours at
 * all" (G4). The id is dropped only AFTER the whole row is in hand, and only
 * because `save_availability_day` re-creates it on every write.
 */
async function readWeek(): Promise<RuleContent[]> {
  const db = serviceClient();
  const { data, error } = await db.from("availability_rules").select("*");
  if (error) throw new Error(`could not read availability_rules: ${error.message}`);
  return ((data ?? []) as RuleContent[])
    .map((row) => ({
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      is_working_day: row.is_working_day,
    }))
    .sort(
      (a, b) =>
        a.day_of_week - b.day_of_week ||
        a.start_time.localeCompare(b.start_time) ||
        a.end_time.localeCompare(b.end_time),
    );
}

/**
 * Put the clinic's hours back exactly, through the same database function the
 * app uses.
 *
 * ⛔ NOT a raw delete-and-insert. `save_availability_day` takes the per-day
 * advisory lock and runs `assert_availability_day_segments`, so a restore
 * cannot write a shape the app itself would refuse — which is the last thing
 * anyone wants a test's emergency path to do to a live clinic.
 */
async function restoreWeek(snapshot: RuleContent[]) {
  const db = serviceClient();
  const problems: string[] = [];

  for (let day = 0; day <= 6; day += 1) {
    const segments = snapshot
      .filter((rule) => rule.day_of_week === day)
      .map((rule) => ({
        start_time: rule.start_time,
        end_time: rule.end_time,
        is_working_day: rule.is_working_day,
      }));
    if (segments.length === 0) continue;

    const { error } = await db.rpc("save_availability_day", {
      p_day_of_week: day,
      p_segments: segments,
    });
    if (error) problems.push(`${DAY_NAMES[day]}: ${error.message}`);
  }
  return problems;
}

test.afterAll(async () => {
  const db = serviceClient();
  const problems: string[] = [];

  // ⛔ RESTORE FIRST AND UNCONDITIONALLY. Whatever went wrong above, the clinic
  // must not be left trading hours it never chose. This runs even when step 5
  // already restored them — putting the same values back twice is harmless,
  // and skipping it on the assumption step 5 ran is not.
  if (ruleSnapshot.length > 0) {
    problems.push(...(await restoreWeek(ruleSnapshot)).map((p) => `restore failed — ${p}`));

    // ⛔ RE-READ. Do not trust the restore.
    const now = await readWeek();
    if (JSON.stringify(now) !== JSON.stringify(ruleSnapshot)) {
      problems.push(
        `⛔ THE CLINIC'S OPENING HOURS ARE NOT WHAT THEY WERE. Expected ` +
          `${JSON.stringify(ruleSnapshot)} but the database holds ${JSON.stringify(now)}. ` +
          `Fix this by hand before anything else — the clinic is trading the wrong hours.`,
      );
    }
    if (now.length !== 7) {
      problems.push(`⛔ availability_rules holds ${now.length} rows, not 7`);
    }
  }

  // ⛔ The audit rows this run's saves wrote. They are keyed on
  // `availability_rules` ids that the next save destroys, so nothing else could
  // ever find them (G13).
  if (auditIdsBefore.size > 0) {
    const { data: auditNow } = await db
      .from("audit_logs")
      .select("id")
      .eq("action_type", "availability_rule_updated");
    const ours = ((auditNow ?? []) as { id: string }[])
      .map((r) => r.id)
      .filter((id) => !auditIdsBefore.has(id));
    if (ours.length > 0) {
      const { error } = await db.from("audit_logs").delete().in("id", ours);
      if (error) problems.push(`could not remove this run's audit rows: ${error.message}`);
      const { data: left } = await db.from("audit_logs").select("id").in("id", ours);
      if ((left ?? []).length) problems.push(`${(left ?? []).length} audit rows survived`);
    }
  }

  if (clientIds.length > 0) {
    try {
      await destroyScenarioFixtures(db, clientIds);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (problems.length > 0) {
    throw new Error(`⛔ E3 TEARDOWN LEFT PRODUCTION DIRTY:\n  - ${problems.join("\n  - ")}`);
  }
});

/** What the public booking engine would offer on a date. Uncached. */
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
  // ⛔ `status` is a property on a native fetch Response, and it is READ: a 429
  // from the shared rate limiter would arrive as an empty list and read exactly
  // like "the clinic is closed".
  expect(
    response.status,
    `⛔ the availability endpoint refused a plain question about ${date}`,
  ).toBe(200);
  const payload = (await response.json()) as { slots?: { time: string }[] };
  return (payload.slots ?? []).map((slot) => slot.time).sort();
}

/**
 * Walk the real public booking dialog as far as its calendar and STOP.
 * ⛔ Never submits — no booking is created and no email is sent.
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
  await dialog.getByLabel(/Main contact name/i).fill(`ZZTEST-E3-LOOKING-${RUN_TAG}`);
  await dialog.getByLabel(/Phone \/ WhatsApp number/i).fill("07700900302");
  await dialog.getByLabel(/Email address/i).fill(testInbox("e3looking"));
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
 * ⛔ The label is built with the SAME formatter react-day-picker used to write
 * it (`format(date, "PPPP")`), so this cannot drift into matching nothing and
 * being reported as a missing date. A `*=` match, because the library decorates
 * the label with "Today, " and ", selected".
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
    `⛔ the public calendar never showed ${date} at all, within ${EDIT_OFFSET + 1} days of today`,
  ).toBeGreaterThan(0);
  return cell.first();
}

/**
 * The times a CUSTOMER is actually offered on one day of the real form.
 *
 * ⛔ `expect.poll`, not a sleep: choosing a day refetches its times, and the
 * list is briefly the previous day's. Bounded, so a day that never settles
 * becomes a finding rather than a hang.
 */
async function timesOnFormFor(page: Page, date: string, expectedFirst: string) {
  const dialog = await openPublicCalendar(page);
  const cell = await findDayCell(page, dialog, date);
  expect(
    await cell.isEnabled(),
    `⛔ ${date} is not selectable on the public form at all`,
  ).toBe(true);
  await cell.click();

  const slots = dialog.getByRole("button", { name: /^([01]\d|2[0-3]):[0-5]\d$/ });
  await expect
    .poll(
      async () => {
        const times = (await slots.allInnerTexts()).map((t) => t.trim()).sort();
        return times[0] ?? "";
      },
      {
        timeout: 30_000,
        message: `⛔ the public form never settled on ${date}'s times (expected the first to be ${expectedFirst})`,
      },
    )
    .toBe(expectedFirst);

  return (await slots.allInnerTexts()).map((t) => t.trim()).sort();
}

/** Set one weekday's opening and closing times, through the Owner's own screen. */
async function setHours(page: Page, weekday: number, opens: string, closes: string) {
  await gotoAdmin(page, "/admin/availability/", "the Owner's availability screen");

  const dayName = DAY_NAMES[weekday];
  // ⛔ Scoped to ONE day's row. There are seven "Opens" fields on this screen —
  // one per weekday — so an unscoped label match is ambiguous, and this screen
  // has already proved (G15) that similar controls repeat on it.
  const row = page
    .locator('[role="listitem"]')
    .filter({ has: page.locator(`[aria-label="${dayName}, open"]`) });
  await expect(
    row,
    `⛔ the Owner must be able to find ${dayName}'s row in the working-hours editor`,
  ).toHaveCount(1, { timeout: 30_000 });
  await row.scrollIntoViewIfNeeded();

  const opensField = row.getByLabel(/^Opens$/);
  const closesField = row.getByLabel(/^Closes$/);
  expect(
    await opensField.isEnabled(),
    `⛔ ${dayName}'s opening time must be editable, not merely present (G3)`,
  ).toBe(true);

  await opensField.fill(opens);
  await closesField.fill(closes);

  const save = page.getByRole("button", { name: /^Save hours$/ });
  await expect(save, "there must be exactly one Save hours button").toHaveCount(1, {
    timeout: 15_000,
  });
  expect(
    await save.first().isEnabled(),
    "⛔ the Save hours button must be usable, not merely present (G3)",
  ).toBe(true);
  await save.first().click();

  // ⛔ NOT `waitForResponse`. One click fires SEVEN server actions in parallel,
  // so the first response back says nothing about the other six. The clinic's
  // own success signal is the toast; the database is the truth, and step 2
  // polls it.
  await expect(
    page.getByText("Working hours saved.", { exact: false }).first(),
    "⛔ the Owner must be told the hours saved",
  ).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000);
}

/** ⛔ Bounded poll on the database — the save is seven parallel writes. */
async function waitForWeekday(weekday: number, opens: string, closes: string) {
  await expect
    .poll(
      async () => {
        const week = await readWeek();
        const rows = week.filter((r) => r.day_of_week === weekday);
        return rows.map((r) => `${r.start_time}-${r.end_time}`).join(",");
      },
      {
        timeout: 30_000,
        message: `⛔ ${DAY_NAMES[weekday]} never became ${opens}–${closes} in the database`,
      },
    )
    .toBe(`${opens}:00-${closes}:00`);
}

test.describe("E3 — changing the opening hours: do the new hours reach the booking form?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ the control: today's hours, today's times, and a visit at 16:00", async () => {
    const db = serviceClient();

    // ⛔ Neither date may be a Sunday, or a change to the clinic's hours could
    // not show on it (G9).
    expect(weekdayOf(EDIT_DATE), `⛔ ${EDIT_DATE} is a Sunday`).not.toBe(0);
    expect(weekdayOf(CONTROL_DATE), `⛔ ${CONTROL_DATE} is a Sunday`).not.toBe(0);
    expect(
      CONTROL_WEEKDAY,
      "⛔ the control must be a DIFFERENT weekday, or it would move with the edit",
    ).not.toBe(EDIT_WEEKDAY);

    // ── ⛔ THE RESTORE VALUE. Taken before anything is touched. ───────────
    ruleSnapshot = await readWeek();
    expect(
      ruleSnapshot.length,
      `⛔ the clinic must have exactly 7 weekly rules before this starts; it has ${ruleSnapshot.length}`,
    ).toBe(7);

    const editRule = ruleSnapshot.filter((r) => r.day_of_week === EDIT_WEEKDAY);
    expect(editRule.length, `⛔ ${DAY_NAMES[EDIT_WEEKDAY]} must have exactly one rule`).toBe(1);
    expect(
      editRule[0].is_working_day,
      `⛔ ${DAY_NAMES[EDIT_WEEKDAY]} must already be a working day, or narrowing its hours proves nothing`,
    ).toBe(true);

    // Everything the run's own saves will add is the difference from this.
    const { data: auditRows, error: auditError } = await db
      .from("audit_logs")
      .select("id")
      .eq("action_type", "availability_rule_updated");
    expect(auditError?.message ?? "", "could not read the audit trail").toBe("");
    auditIdsBefore = new Set(((auditRows ?? []) as { id: string }[]).map((r) => r.id));

    // ── ⛔ The visit that must survive the day being shortened around it ──
    const visit = await seedWebsiteBooking(db, "E3", {
      dayOffset: EDIT_OFFSET,
      startTime: VISIT_TIME,
      status: "confirmed",
      assignTo: THERAPIST_A_STAFF_ID,
    });
    clientIds.push(visit.clientId);
    visitId = visit.bookingId;

    // ⛔ ASSERT THE FIXTURE APPLIED before concluding anything from it (G5).
    visitBefore = await readBooking(db, visitId);
    expect(visitBefore.booking_date, "the visit must be on the edited date").toBe(EDIT_DATE);
    expect(
      String(visitBefore.start_time),
      `⛔ the visit must start AFTER the new closing time (${NEW_CLOSE}), or "it survived" proves nothing`,
    ).toBe(VISIT_TIME);
    await expectOwnerNeverAssigned(db, visitId);

    visitAssignmentsBefore = JSON.stringify(
      (await readAssignments(db, visitId)).sort((a, b) => a.id.localeCompare(b.id)),
    );
    visitAuditBefore = JSON.stringify((await auditActions(db, visitId)).sort());

    // ── The times on offer, before ───────────────────────────────────────
    editTimesBefore = await offeredTimes(EDIT_DATE);
    controlTimesBefore = await offeredTimes(CONTROL_DATE);

    expect(
      editTimesBefore.length,
      `⛔ THE CONTROL FAILED. ${EDIT_DATE} offers no times at all before the hours change.`,
    ).toBeGreaterThan(0);
    expect(
      controlTimesBefore.length,
      `⛔ THE CONTROL FAILED. The control day ${CONTROL_DATE} offers no times to compare.`,
    ).toBeGreaterThan(0);

    // ⛔ AND THE NEW WINDOW MUST ACTUALLY BE NARROWER. If nothing currently on
    // offer falls outside 10:00–14:00, this scenario would "pass" without the
    // hours change having removed a single time.
    expect(
      editTimesBefore.filter((t) => t < NEW_OPEN).length,
      `⛔ THE CONTROL FAILED. Nothing is offered before ${NEW_OPEN} on ${EDIT_DATE}, so narrowing ` +
        `the morning would remove nothing. Times: ${editTimesBefore.join(", ")}`,
    ).toBeGreaterThan(0);
    expect(
      editTimesBefore.filter((t) => t > NEW_CLOSE).length,
      `⛔ THE CONTROL FAILED. Nothing is offered after ${NEW_CLOSE} on ${EDIT_DATE}, so narrowing ` +
        `the afternoon would remove nothing.`,
    ).toBeGreaterThan(0);

    console.log(
      `[E3] step 1 — control: ${DAY_NAMES[EDIT_WEEKDAY]} is ${editRule[0].start_time}–` +
        `${editRule[0].end_time}; ${EDIT_DATE} offers ${editTimesBefore.length} times ` +
        `(${editTimesBefore[0]}–${editTimesBefore[editTimesBefore.length - 1]}); the control ` +
        `${CONTROL_DATE} offers ${controlTimesBefore.length}; one confirmed visit sits at ` +
        `${VISIT_TIME}, after the new closing time.`,
    );
  });

  test("step 2 — ✅ the Owner shortens that weekday", async ({ browser }) => {
    expect(ruleSnapshot.length, "step 1 must have run").toBe(7);

    const { context, page } = await pageAs(browser, "owner");
    await setHours(page, EDIT_WEEKDAY, NEW_OPEN, NEW_CLOSE);
    await context.close();

    // ⛔ The database is the truth, not the toast.
    await waitForWeekday(EDIT_WEEKDAY, NEW_OPEN, NEW_CLOSE);

    const week = await readWeek();
    expect(
      week.length,
      `⛔ the clinic must still have exactly 7 weekly rules; it has ${week.length}`,
    ).toBe(7);

    // ⛔ AND EVERY OTHER DAY MUST STILL SAY WHAT IT SAID. One click rewrites all
    // seven from the browser's copy of them, so this is where a wrong copy
    // would show.
    const others = week.filter((r) => r.day_of_week !== EDIT_WEEKDAY);
    const othersBefore = ruleSnapshot.filter((r) => r.day_of_week !== EDIT_WEEKDAY);
    expect(
      others,
      `⛔ SAVING ONE DAY'S HOURS REWROTE THE OTHER DAYS. Before: ` +
        `${JSON.stringify(othersBefore)} — after: ${JSON.stringify(others)}`,
    ).toEqual(othersBefore);

    console.log(
      `[E3] step 2 — changed: ${DAY_NAMES[EDIT_WEEKDAY]} is now ${NEW_OPEN}–${NEW_CLOSE}, still 7 ` +
        `rules, and the other six days are unchanged.`,
    );
  });

  test("step 3 — ⛔ THE NEW HOURS REACH THE PUBLIC BOOKING FORM", async ({ browser }) => {
    expect(ruleSnapshot.length, "step 1 must have run").toBe(7);

    // ── The engine ───────────────────────────────────────────────────────
    const timesAfter = await offeredTimes(EDIT_DATE);
    expect(
      timesAfter.length,
      `⛔ shortening ${DAY_NAMES[EDIT_WEEKDAY]} took ${EDIT_DATE} off sale entirely — the clinic ` +
        `is open ${NEW_OPEN}–${NEW_CLOSE} and nothing at all is offered.`,
    ).toBeGreaterThan(0);

    const tooEarly = timesAfter.filter((t) => t < NEW_OPEN);
    const tooLate = timesAfter.filter((t) => t >= NEW_CLOSE);
    expect(
      tooEarly,
      `⛔ THE NEW OPENING TIME DID NOT REACH THE BOOKING ENGINE. The clinic now opens at ` +
        `${NEW_OPEN} and these times are still on sale: ${tooEarly.join(", ")}`,
    ).toEqual([]);
    expect(
      tooLate,
      `⛔ THE NEW CLOSING TIME DID NOT REACH THE BOOKING ENGINE. The clinic now closes at ` +
        `${NEW_CLOSE} and these start times are still on sale: ${tooLate.join(", ")}`,
    ).toEqual([]);
    expect(
      timesAfter[0],
      `⛔ the first time on offer should be the new opening time`,
    ).toBe(NEW_OPEN);

    // ── The form a customer actually uses ────────────────────────────────
    const context = await browser.newContext();
    const page = await context.newPage();
    const onForm = await timesOnFormFor(page, EDIT_DATE, NEW_OPEN);
    await context.close();

    expect(
      onForm.filter((t) => t < NEW_OPEN || t >= NEW_CLOSE),
      `⛔ THE PUBLIC FORM IS STILL OFFERING TIMES OUTSIDE THE NEW HOURS: ${onForm.join(", ")}`,
    ).toEqual([]);
    expect(
      onForm,
      `⛔ the form and the engine disagree about ${EDIT_DATE}. Form: ${onForm.join(", ")} — ` +
        `engine: ${timesAfter.join(", ")}`,
    ).toEqual(timesAfter);

    console.log(
      `[E3] step 3 — reached: ${EDIT_DATE} now offers ${timesAfter.length} times, ` +
        `${timesAfter[0]}–${timesAfter[timesAfter.length - 1]}, on the engine AND on the real ` +
        `booking form, with nothing outside ${NEW_OPEN}–${NEW_CLOSE}.`,
    );
  });

  test("step 4 — ⛔ AND NOTHING ELSE MOVED: the other day, and the 16:00 visit", async () => {
    expect(visitId, "step 1 must have run").not.toBe("");
    const db = serviceClient();

    // ⛔ THE OTHER WEEKDAY. One click saved all seven days, so this is the
    // assertion that catches an edit leaking sideways — and it is checked where
    // the customer would feel it, not just in the rules table.
    const controlNow = await offeredTimes(CONTROL_DATE);
    expect(
      controlNow,
      `⛔ CHANGING ${DAY_NAMES[EDIT_WEEKDAY]}'S HOURS ALSO CHANGED ` +
        `${DAY_NAMES[CONTROL_WEEKDAY]}. ${CONTROL_DATE} offered ${controlTimesBefore.length} ` +
        `times and now offers ${controlNow.length}.`,
    ).toEqual(controlTimesBefore);

    // ⛔ AND THE VISIT ALREADY BOOKED AT 16:00, now outside the new hours. The
    // whole row, compared whole — `updated_at` moving at all would mean the
    // booking was written to.
    const after = await readBooking(db, visitId);
    expect(
      after,
      `⛔ SHORTENING THE DAY CHANGED A VISIT ALREADY BOOKED ON IT. It sits at ${VISIT_TIME}, ` +
        `after the new ${NEW_CLOSE} closing time, and closing early must never cancel or move a ` +
        `customer silently. Before: ${JSON.stringify(visitBefore)} — after: ${JSON.stringify(after)}`,
    ).toEqual(visitBefore);

    expect(
      JSON.stringify(
        (await readAssignments(db, visitId)).sort((a, b) => a.id.localeCompare(b.id)),
      ),
      "⛔ shortening the day unassigned the therapist from a visit outside the new hours",
    ).toBe(visitAssignmentsBefore);
    expect(
      JSON.stringify((await auditActions(db, visitId)).sort()),
      `⛔ shortening the day performed an action ON the existing visit. Before: ${visitAuditBefore}`,
    ).toBe(visitAuditBefore);

    console.log(
      `[E3] step 4 — contained: ${CONTROL_DATE} offers exactly the ${controlNow.length} times it ` +
        `did before, and the ${VISIT_TIME} visit is byte-for-byte unchanged.`,
    );
  });

  test("step 5 — ⛔ AND THE OLD HOURS COME BACK, EXACTLY", async ({ browser }) => {
    expect(ruleSnapshot.length, "step 1 must have run").toBe(7);

    const original = ruleSnapshot.find((r) => r.day_of_week === EDIT_WEEKDAY)!;
    const opens = original.start_time.slice(0, 5);
    const closes = original.end_time.slice(0, 5);

    const { context, page } = await pageAs(browser, "owner");
    await setHours(page, EDIT_WEEKDAY, opens, closes);
    await context.close();

    await waitForWeekday(EDIT_WEEKDAY, opens, closes);

    // ⛔ THE WHOLE WEEK, COMPARED AS CONTENT. ⚠️ NOT by id: every save deletes
    // and re-inserts the day's rows, so the ids are new by design and an
    // id-based comparison would fail on a system working perfectly.
    const week = await readWeek();
    expect(
      week,
      `⛔ THE CLINIC'S HOURS DID NOT COME BACK. Expected ${JSON.stringify(ruleSnapshot)} but the ` +
        `database holds ${JSON.stringify(week)}.`,
    ).toEqual(ruleSnapshot);

    // ⛔ AND THE ROW BEING RIGHT IS NOT THE SAME AS THE SHOP BEING OPEN AGAIN.
    // Nobody reports times quietly missing from a booking form.
    const timesBack = await offeredTimes(EDIT_DATE);
    expect(
      timesBack,
      `⛔ THE HOURS ARE BACK IN THE DATABASE BUT THE TIMES ARE NOT BACK ON SALE. ${EDIT_DATE} ` +
        `offered ${editTimesBefore.length} times and now offers ${timesBack.length}.`,
    ).toEqual(editTimesBefore);

    const backContext = await browser.newContext();
    const backPage = await backContext.newPage();
    const onForm = await timesOnFormFor(backPage, EDIT_DATE, editTimesBefore[0]);
    await backContext.close();
    expect(
      onForm,
      `⛔ the public form did not get the restored hours. Form: ${onForm.join(", ")}`,
    ).toEqual(editTimesBefore);

    // ⛔ And the visit is STILL untouched, after the whole round trip.
    expect(
      await readBooking(serviceClient(), visitId),
      "⛔ restoring the hours changed the visit that had been sitting on that day",
    ).toEqual(visitBefore);

    console.log(
      `\n[E3] COMPLETE. ${DAY_NAMES[EDIT_WEEKDAY]}: ${opens}–${closes} -> ${NEW_OPEN}–` +
        `${NEW_CLOSE} -> ${opens}–${closes} again. ${EDIT_DATE} followed it on the engine AND on ` +
        `the real booking form, back to all ${timesBack.length} times; ` +
        `${DAY_NAMES[CONTROL_WEEKDAY]} never moved; the ${VISIT_TIME} visit was unchanged ` +
        `throughout.\n`,
    );
  });
});
