// ⛔ GATE 08 — P4, FAMILY E, SCENARIO E2: ONE THERAPIST'S DAY OFF.
//
//   ⛔ The Owner's question: "Can one person be away without closing the whole
//    clinic?"
//
// ── ⛔ WHY THIS IS NOT JUST E1 WITH A SMALLER SCOPE ──────────────────────
//
// E1 closed the whole clinic and the proof was easy: the date stopped being
// offered. ⛔ HERE THE DATE MUST **KEEP** BEING OFFERED. One therapist of
// several going away is supposed to leave the day on sale — that is the entire
// point of having a per-person closure instead of a clinic-wide one.
//
// ⛔ SO THE E1-SHAPED ASSERTION WOULD PASS WITHOUT PROVING ANYTHING. "The day is
// still bookable" is true before AND after, and a test that checked only that
// would be green even if the closure had done absolutely nothing. The signal has
// to be at the level of **which therapist**, not **whether the date**.
//
// Two places say that out loud, and both are checked:
//
//  1. ⛔ THE CLINIC'S OWN SCREEN. `getStaffAssignmentPreviews` returns
//     `{eligible: false, reason: "Blocked date"}` for a staff member with a row
//     in `staff_blocked_dates` (assignment-eligibility.ts:305). The booking
//     screen then drops them out of the pick-list and renders them DISABLED
//     behind "Show all staff". ⚠️ This surface is deliberately NOT cached
//     (booking-detail-data.ts:25), so it is a live answer.
//
//  2. ⛔ THE PUBLIC BOOKING ENGINE, which reports `availableStaffByGender` per
//     time — a COUNT, not a list of names. So the public-side signal is that the
//     female count falls by EXACTLY ONE and the day survives. Both halves
//     matter: a fall of one proves the closure landed, and "never more than one"
//     proves it did not take anybody else down with it.
//
// ── ⛔ THE TRAP IN THE OBVIOUS DESIGN, AND WHY THERE ARE TWO FIXTURES ────
//
// ⚠️ The tempting shape is one booking, assigned to the therapist who is going
// away, used for both proofs. ⛔ IT WOULD BE WORTHLESS. `AssignmentManager`
// disables the CURRENTLY ASSIGNED therapist's button unconditionally
// (`disabled={isPending || !candidate.eligible || isCurrent}`), so that button
// reads "disabled" before the closure exists. The test would pass on day one and
// would go on passing if per-staff closures were deleted from the codebase.
// That is G3's lesson — presence is not enabled, and neither is disabled —
// arriving from the other direction.
//
// ⛔ So there are two fixtures, each with exactly one job:
//   • VISIT A — UNASSIGNED. The therapist is a real, clickable candidate on it,
//     so "enabled -> disabled" measures the closure and nothing else.
//   • VISIT B — ASSIGNED to the therapist who is going away. This is the one
//     that must survive untouched: marking somebody away must never quietly
//     unassign or cancel the visits already in their diary. ⚠️ The app's own
//     confirmation promises exactly this — "will stay scheduled".
//
// ── ⛔ CHOSEN DELIBERATELY (G9) ──────────────────────────────────────────
//
// `Test Therapist` goes away — female, `use_global`, genuinely bookable.
// ⛔ NEVER `Test Therapist Fresh`, who has no availability rules and is never
// available, so "removing" her would change nothing and this scenario would pass
// on a corpse. ⛔ NEVER the real Owner. The names are not trusted as constants
// either: step 1 reads them back from `staff_profiles` and fails loudly if the
// ids have drifted.
//
// ⚠️ `Test Therapist` is a PREFIX of `Test Therapist Fresh`, so no locator here
// may use a substring match on a staff name. Candidates are read out of the
// sheet and matched on the WHOLE name.
//
// The date is +14 — deliberately a different week from E1's +7, so the two
// scenarios can never collide over the same day — nudged off Sunday, when the
// clinic is shut and nobody's absence would show.
//
// ── ⛔ CLEANING UP (G13) ─────────────────────────────────────────────────
//
// `destroyScenarioFixtures` sweeps no settings-shaped table, so this file
// removes its own `staff_blocked_dates` row and the audit rows keyed on it, by
// value as well as by captured id, then re-reads. ⚠️ A leak here silently
// removes a therapist from everything the clinic can sell.
//
// ── ⛔ EMAIL COST: ZERO ──────────────────────────────────────────────────

import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  RUN_TAG,
  THERAPIST_A_STAFF_ID,
  THERAPIST_B_STAFF_ID,
  auditActions,
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
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

/**
 * Day of the week for an ISO date, 0 = Sunday.
 *
 * ⛔ Built from the date PARTS. `new Date(iso)` parses a bare ISO date as UTC
 * midnight, which in British Summer Time is the previous evening here — so the
 * naive version reads the wrong weekday for half the year, silently.
 */
function weekdayOf(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

/** ⛔ +14, a different week from E1's +7, so the two can never collide. */
const TARGET_OFFSET = weekdayOf(isoDaysFromToday(14)) === 0 ? 15 : 14;
const TARGET_DATE = isoDaysFromToday(TARGET_OFFSET);

/** ⛔ Away from both fixtures' hours, so the therapist is plainly free here. */
const PROBE_TIME = "09:00";
const CLOSURE_REASON = `ZZTEST E2 away day ${RUN_TAG}`;

const clientIds: string[] = [];
/** Every `staff_blocked_dates` id this run created — audit rows key on these. */
const closureIds: string[] = [];

/** Read back in step 1 rather than trusted as constants. */
let awayName = "";
let coverName = "";

/** VISIT A — unassigned. The eligibility probe. */
let visitAId = "";
let visitABefore: Record<string, unknown> = {};
let visitAAssignmentsBefore = "";
let visitAAuditBefore = "";

/** VISIT B — assigned to the therapist going away. The one that must survive. */
let visitBId = "";
let visitBBefore: Record<string, unknown> = {};
let visitBAssignmentsBefore = "";
let visitBAuditBefore = "";

/** time -> how many female therapists were free, before anyone was marked away. */
let femaleBefore: Record<string, number> = {};

type Slot = {
  time: string;
  availableStaffByGender: { male: number; female: number };
};

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  const db = serviceClient();
  const problems: string[] = [];

  // ⛔ BY THE DATE AS WELL AS BY THE CAPTURED IDS. A run that died between
  // creating the closure and reading its id back would otherwise leave a real
  // therapist marked unavailable with nothing pointing at the row.
  const { data: strays, error: strayError } = await db
    .from("staff_blocked_dates")
    .select("*")
    .eq("blocked_date", TARGET_DATE)
    .eq("staff_id", THERAPIST_A_STAFF_ID);
  if (strayError) problems.push(`could not sweep for stray closures: ${strayError.message}`);

  const ids = [
    ...new Set([...closureIds, ...((strays ?? []) as { id: string }[]).map((r) => r.id)]),
  ].filter(Boolean);

  const { error: closureError } = await db
    .from("staff_blocked_dates")
    .delete()
    .eq("blocked_date", TARGET_DATE)
    .eq("staff_id", THERAPIST_A_STAFF_ID);
  if (closureError) problems.push(`could not remove the closure: ${closureError.message}`);

  // ⛔ Audit rows are keyed on the CLOSURE's id, so nothing in
  // `destroyScenarioFixtures` would ever find them (G11, G13).
  if (ids.length > 0) {
    const { error: auditError } = await db.from("audit_logs").delete().in("target_id", ids);
    if (auditError) problems.push(`could not remove the closure's audit rows: ${auditError.message}`);
  }

  // ⛔ RE-READ. Do not trust the deletes.
  const { data: surviving } = await db
    .from("staff_blocked_dates")
    .select("*")
    .eq("blocked_date", TARGET_DATE)
    .eq("staff_id", THERAPIST_A_STAFF_ID);
  if ((surviving ?? []).length) {
    problems.push(
      `${(surviving ?? []).length} per-staff closure row(s) survived on ${TARGET_DATE} — ` +
        `a real therapist would stay unavailable, and nobody is told`,
    );
  }
  if (ids.length > 0) {
    const { data: survivingAudit } = await db.from("audit_logs").select("id").in("target_id", ids);
    if ((survivingAudit ?? []).length) {
      problems.push(`${(survivingAudit ?? []).length} closure audit rows survived`);
    }
  }

  // ⛔ Run the fixture sweep WHATEVER happened above, and carry its complaint
  // rather than letting it replace mine.
  if (clientIds.length > 0) {
    try {
      await destroyScenarioFixtures(db, clientIds);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (problems.length > 0) {
    throw new Error(`⛔ E2 TEARDOWN LEFT PRODUCTION DIRTY:\n  - ${problems.join("\n  - ")}`);
  }
});

/**
 * What the public booking engine would offer on a date, WITH its per-gender
 * staff counts — the only place the public side says anything about how many
 * therapists are behind a time.
 *
 * ⛔ Nothing caches this route, so it is an answer with no client-side copy in
 * between.
 */
async function offeredSlots(date: string): Promise<Slot[]> {
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
  // from the shared rate limiter would arrive as an empty slot list and read
  // exactly like "nobody is available".
  expect(
    response.status,
    `⛔ the availability endpoint refused a plain question about ${date}`,
  ).toBe(200);
  const payload = (await response.json()) as { slots?: Slot[] };
  return payload.slots ?? [];
}

function femaleCountsByTime(slots: Slot[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const slot of slots) out[slot.time] = slot.availableStaffByGender?.female ?? 0;
  return out;
}

type CandidateRow = { lines: string[]; enabled: boolean };
type Candidate = { name: string; reason: string; enabled: boolean };

/**
 * Read the therapist pick-list out of the assignment sheet, as raw lines.
 *
 * ⛔ NOTHING IS READ BY POSITION. ⚠️ MEASURED, first run: the candidate button
 * opens with `StaffAvatar`, whose INITIALS are its own line of text — so the
 * button reads "TT / Test Therapist / Eligible" and a parser that took the
 * first line got "TT". The failure message then said *"Test Therapist is not
 * even offered"*, which is exactly what a real defect would look like. And the
 * shape is not even stable: a staff member with a profile photo renders no
 * initials at all, so the name would move line.
 *
 * ⛔ So the lines are kept whole and the NAME is matched by exact line equality
 * in `findCandidate`. That also solves the other trap here: "Test Therapist" is
 * a PREFIX of "Test Therapist Fresh", and any substring match would return the
 * therapist who is never available anyway — making this scenario pass while
 * proving the opposite of what it claims.
 *
 * ⛔ `isEnabled()` is recorded for every row, never `count()` (G3). On this
 * control the two say completely different things: an ineligible therapist is
 * still rendered, just disabled and behind "Show all staff".
 */
async function candidateRows(sheet: Locator): Promise<CandidateRow[]> {
  const buttons = sheet.locator("button");
  const total = await buttons.count();
  const out: CandidateRow[] = [];

  for (let index = 0; index < total; index += 1) {
    const button = buttons.nth(index);
    const lines = (await button.innerText())
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    // A candidate always carries at least a name and a reason. "Show all
    // staff" and the sheet's own close control are single-line and drop out.
    if (lines.length < 2) continue;
    out.push({ lines, enabled: await button.isEnabled() });
  }
  return out;
}

/** Everything the sheet showed, for failure messages. */
function describeRows(rows: CandidateRow[]) {
  return rows.map((row) => row.lines.join(" · ")).join(" | ") || "(nobody)";
}

/**
 * Open a booking's assignment sheet and read the pick-list, both as the clinic
 * first sees it and with every ineligible therapist revealed.
 */
async function readPickList(page: Page, id: string) {
  // ⛔ The detail page's own data IS cached (60s), even though the eligibility
  // previews inside it are not — so a seeded booking has to be POLLED for (G1).
  await pollUntil(
    page,
    `/admin/bookings/${id}/`,
    "the booking detail screen",
    async () =>
      (await page.getByRole("button", { name: /^Assign therapist$|^Reassign$/ }).count()) > 0,
    { attempts: 10, waitMs: 8_000 },
  );

  const trigger = page.getByRole("button", { name: /^Assign therapist$|^Reassign$/ });
  expect(
    await trigger.first().isEnabled(),
    "⛔ the assignment control must be usable, not merely present (G3)",
  ).toBe(true);
  await trigger.first().click();

  const sheet = page.getByRole("dialog");
  await expect(sheet, "the assignment sheet should open").toBeVisible({ timeout: 20_000 });
  await expect(
    sheet.getByRole("button").first(),
    "the assignment sheet should render its pick-list",
  ).toBeVisible({ timeout: 15_000 });

  const offered = await candidateRows(sheet);

  // ⛔ AND THEN THE HIDDEN ONES. The clinic sees only eligible therapists by
  // default; an ineligible one is one click away, disabled, carrying its reason.
  // Both views are needed: "gone from the default list" and "present but
  // refused, and here is why" are different claims.
  const showAll = sheet.getByRole("button", { name: /^Show all staff$/ });
  let all = offered;
  if ((await showAll.count()) > 0 && (await showAll.first().isEnabled())) {
    await showAll.first().click();
    await page.waitForTimeout(500);
    all = await candidateRows(sheet);
  }

  return { offered, all };
}

/**
 * ⛔ EXACT LINE EQUALITY on the name, for the two reasons in `candidateRows`'
 * header: the name is not at a fixed line, and one fixture's name is a prefix
 * of another's.
 */
function findCandidate(rows: CandidateRow[], name: string): Candidate | undefined {
  const row = rows.find((candidate) =>
    candidate.lines.some(
      (line) => line.replace(/\s*currently assigned$/i, "").trim() === name,
    ),
  );
  if (!row) return undefined;
  return { name, reason: row.lines[row.lines.length - 1], enabled: row.enabled };
}

/** Mark one therapist away for a date, through the Owner's own screen. */
async function markAway(page: Page) {
  await gotoAdmin(
    page,
    `/admin/staff/${THERAPIST_A_STAFF_ID}/availability/`,
    "the therapist's availability screen",
  );

  // ⛔ ANCHORED ON THE SUBMIT BUTTON, NOT ON THE FIELD NAMES.
  //
  // ⚠️ MEASURED, second run: this screen stacks three managers, and TWO of their
  // forms carry `input[name="date"]` AND `input[name="reason"]` — the blocked
  // dates form and the hours-override form. `form:has(input[name="date"])`
  // resolved to 2 elements and Playwright refused it. ⛔ Had it silently taken
  // the first, this scenario would have been editing the wrong feature while
  // reporting on this one.
  //
  // "Add closure" is exact and belongs to one form only, and it is the control
  // this function actually needs.
  const form = page.locator('form:has(button:text-is("Add closure"))');
  await expect(
    form,
    "⛔ the Owner must be able to find the blocked-dates form on a therapist's record",
  ).toHaveCount(1, { timeout: 30_000 });
  await form.scrollIntoViewIfNeeded();

  await form.locator('input[name="date"]').fill(TARGET_DATE);
  await form.locator('input[name="reason"]').fill(CLOSURE_REASON);

  const submit = form.getByRole("button", { name: /^Add closure$/ });
  expect(
    await submit.isEnabled(),
    "⛔ the Add closure button must be usable, not merely present (G3)",
  ).toBe(true);

  // ⛔ Armed BEFORE the click: if the cached page already knows there are
  // bookings that day, the first click only opens the guard and the server
  // action fires from "Block anyway" instead. One promise covers both routes.
  const answered = page.waitForResponse(
    (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
    { timeout: 60_000 },
  );
  await submit.click();

  // ⚠️ EITHER OUTCOME IS CORRECT (G1) — whether the guard appears depends on
  // whether the cached page has seen the seeded visits yet. Waited for briefly,
  // never indefinitely.
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

/** Bring the therapist back, through the Owner's own screen. */
async function bringBack(page: Page) {
  await gotoAdmin(
    page,
    `/admin/staff/${THERAPIST_A_STAFF_ID}/availability/`,
    "the therapist's availability screen",
  );

  // ⛔ FOUND BY THE REASON THIS RUN WROTE, NOT BY A REBUILT DATE STRING (G12).
  // Chromium renders September as "Sept" while every date library writes "Sep",
  // so a locator that rebuilds the button's label matches nothing for one month
  // of the year and reports it as a defect that does not exist. The run-tagged
  // reason is also the safer anchor: this can only ever lift THIS scenario's
  // closure, never a real absence the clinic meant to keep.
  const row = page.getByRole("listitem").filter({ hasText: CLOSURE_REASON });
  await expect(
    row,
    `⛔ the Owner must be able to find the closure for ${TARGET_DATE} in order to lift it`,
  ).toHaveCount(1, { timeout: 30_000 });

  const remove = row.getByRole("button", { name: /^Remove closure for/ });
  await expect(
    remove,
    "⛔ the closure must offer exactly one way to lift it",
  ).toHaveCount(1, { timeout: 15_000 });
  await remove.first().scrollIntoViewIfNeeded();
  expect(
    await remove.first().isEnabled(),
    "⛔ the remove control must be usable, not merely present (G3)",
  ).toBe(true);

  const removedLabel = (await remove.first().getAttribute("aria-label")) ?? "";
  await remove.first().click();

  const confirm = page.getByRole("dialog").getByRole("button", { name: /^Remove$/, exact: true });
  await expect(
    confirm,
    "⛔ lifting a closure asks for confirmation; that dialog must appear",
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

async function closuresForAway() {
  const db = serviceClient();
  // ⛔ `.select("*")` — a named column list that misses a column returns NO
  // ROWS rather than an error, which would read here as "the closure was never
  // made" (G4).
  const { data, error } = await db
    .from("staff_blocked_dates")
    .select("*")
    .eq("blocked_date", TARGET_DATE)
    .eq("staff_id", THERAPIST_A_STAFF_ID);
  if (error) throw new Error(`could not read staff_blocked_dates: ${error.message}`);
  return (data ?? []) as { id: string; blocked_date: string; reason: string | null }[];
}

test.describe("E2 — one therapist's day off: can one person be away without closing the clinic?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ the control: she is offered, somebody else is too, and two visits exist", async ({
    browser,
  }) => {
    const db = serviceClient();

    // ⛔ A day the clinic never works would make every assertion below pass
    // while proving nothing (G9).
    expect(
      weekdayOf(TARGET_DATE),
      `⛔ ${TARGET_DATE} is a Sunday. The clinic is shut, so nobody's absence would show.`,
    ).not.toBe(0);

    // ⛔ THE IDS ARE NOT TRUSTED. If a fixture were renamed or re-seeded, a
    // hard-coded name would quietly match nobody and every "she is gone from the
    // list" assertion below would pass for the wrong reason.
    const { data: staffRows, error: staffError } = await db
      .from("staff_profiles")
      .select("*")
      .in("id", [THERAPIST_A_STAFF_ID, THERAPIST_B_STAFF_ID]);
    expect(staffError?.message ?? "", "could not read the therapists back").toBe("");

    const rows = (staffRows ?? []) as {
      id: string;
      name: string;
      active: boolean;
      can_take_bookings: boolean;
      availability_mode: string;
    }[];
    const away = rows.find((r) => r.id === THERAPIST_A_STAFF_ID);
    const cover = rows.find((r) => r.id === THERAPIST_B_STAFF_ID);
    expect(away, "the therapist who goes away must exist").toBeTruthy();
    expect(cover, "a second therapist must exist to prove the clinic stays open").toBeTruthy();

    // ⛔ Marking somebody away only means something if they were available in
    // the first place — the "Test Therapist Fresh" trap (G9).
    expect(away!.active && away!.can_take_bookings, "she must be bookable to begin with").toBe(true);
    expect(
      away!.availability_mode,
      `⛔ ${away!.name} must follow the clinic's hours; a therapist with no rules is never ` +
        `available and removing her would change nothing`,
    ).toBe("use_global");
    expect(cover!.active && cover!.can_take_bookings, "the cover must be bookable too").toBe(true);

    awayName = away!.name;
    coverName = cover!.name;

    // ⛔ Start from a known state.
    if ((await closuresForAway()).length > 0) {
      const { error } = await db
        .from("staff_blocked_dates")
        .delete()
        .eq("blocked_date", TARGET_DATE)
        .eq("staff_id", THERAPIST_A_STAFF_ID);
      expect(error?.message ?? "", "could not clear a leftover closure").toBe("");
    }
    expect(
      (await closuresForAway()).length,
      `⛔ ${awayName} must start AVAILABLE on ${TARGET_DATE}`,
    ).toBe(0);

    // ── VISIT A — unassigned. She must be a real, clickable option on it. ──
    const visitA = await seedWebsiteBooking(db, "E2A", {
      dayOffset: TARGET_OFFSET,
      startTime: "12:00:00",
      status: "confirmed",
    });
    clientIds.push(visitA.clientId);
    visitAId = visitA.bookingId;

    // ── VISIT B — hers. This is the one that must survive her absence. ────
    const visitB = await seedWebsiteBooking(db, "E2B", {
      dayOffset: TARGET_OFFSET,
      startTime: "15:00:00",
      status: "confirmed",
      assignTo: THERAPIST_A_STAFF_ID,
    });
    clientIds.push(visitB.clientId);
    visitBId = visitB.bookingId;

    // ⛔ ASSERT THE FIXTURES ACTUALLY APPLIED before drawing a conclusion from
    // anything downstream of them (G5).
    visitABefore = await readBooking(db, visitAId);
    visitBBefore = await readBooking(db, visitBId);
    expect(visitABefore.booking_date, "visit A must be on the target date").toBe(TARGET_DATE);
    expect(visitBBefore.booking_date, "visit B must be on the target date").toBe(TARGET_DATE);

    const bAssignments = await readAssignments(db, visitBId);
    expect(
      bAssignments.every((a) => a.assigned_staff_id === THERAPIST_A_STAFF_ID),
      `⛔ visit B must really be ${awayName}'s, or "her diary survived" proves nothing`,
    ).toBe(true);
    await expectOwnerNeverAssigned(db, visitAId);
    await expectOwnerNeverAssigned(db, visitBId);

    visitAAssignmentsBefore = JSON.stringify(
      (await readAssignments(db, visitAId)).sort((a, b) => a.id.localeCompare(b.id)),
    );
    visitBAssignmentsBefore = JSON.stringify(
      bAssignments.sort((a, b) => a.id.localeCompare(b.id)),
    );
    visitAAuditBefore = JSON.stringify((await auditActions(db, visitAId)).sort());
    visitBAuditBefore = JSON.stringify((await auditActions(db, visitBId)).sort());

    // ── The engine, before ───────────────────────────────────────────────
    const slotsBefore = await offeredSlots(TARGET_DATE);
    femaleBefore = femaleCountsByTime(slotsBefore);

    expect(
      slotsBefore.length,
      `⛔ THE CONTROL FAILED. ${TARGET_DATE} offered no times at all before anyone was marked ` +
        `away, so this scenario could not tell an absence from an ordinary quiet day.`,
    ).toBeGreaterThan(0);
    expect(
      femaleBefore[PROBE_TIME],
      `⛔ THE CONTROL FAILED. ${PROBE_TIME} is not on offer on ${TARGET_DATE}, so it cannot be ` +
        `used to measure one therapist disappearing. Times offered: ` +
        `${Object.keys(femaleBefore).slice(0, 8).join(", ")}`,
    ).toBeGreaterThanOrEqual(2);

    // ── The clinic's screen, before ──────────────────────────────────────
    const owner = await pageAs(browser, "owner");
    const { offered } = await readPickList(owner.page, visitAId);
    await owner.context.close();

    const awayCandidate = findCandidate(offered, awayName);
    const coverCandidate = findCandidate(offered, coverName);

    expect(
      awayCandidate,
      `⛔ THE CONTROL FAILED. ${awayName} is not even offered for visit A before she is marked ` +
        `away. Offered: ${describeRows(offered)}`,
    ).toBeTruthy();
    expect(
      awayCandidate!.enabled,
      `⛔ THE CONTROL FAILED. ${awayName} is listed but not clickable before anything changed, ` +
        `so "she became unclickable" would prove nothing. Reason shown: "${awayCandidate!.reason}"`,
    ).toBe(true);
    expect(
      coverCandidate?.enabled,
      `⛔ THE CONTROL FAILED. ${coverName} must be bookable too, or "somebody else can still ` +
        `cover" cannot be tested.`,
    ).toBe(true);

    console.log(
      `[E2] step 1 — control: ${TARGET_DATE} offers ${slotsBefore.length} times ` +
        `(${femaleBefore[PROBE_TIME]} female therapists free at ${PROBE_TIME}); ${awayName} and ` +
        `${coverName} are both clickable for visit A; ${awayName} holds visit B.`,
    );
  });

  test("step 2 — ✅ the Owner marks ONE therapist away for that date", async ({ browser }) => {
    expect(visitAId, "step 1 must have run").not.toBe("");

    const { context, page } = await pageAs(browser, "owner");
    const warned = await markAway(page);
    await context.close();

    // ⛔ The database is the truth, not the toast.
    const closures = await closuresForAway();
    expect(
      closures.length,
      `⛔ the absence must be RECORDED against ${awayName} on ${TARGET_DATE}`,
    ).toBe(1);
    expect(closures[0].reason, "the Owner's reason must be kept with it").toBe(CLOSURE_REASON);
    closureIds.push(closures[0].id);

    // ⛔ AND IT MUST BE THE PER-STAFF TABLE, NOT THE CLINIC-WIDE ONE. If this
    // wrote to `blocked_dates` the whole clinic would shut, which is E1's
    // behaviour and the exact failure this scenario exists to rule out.
    const db = serviceClient();
    const { data: clinicWide } = await db
      .from("blocked_dates")
      .select("*")
      .eq("blocked_date", TARGET_DATE);
    expect(
      (clinicWide ?? []).length,
      `⛔ marking ONE therapist away must not close the whole clinic — a row appeared in ` +
        `blocked_dates for ${TARGET_DATE}`,
    ).toBe(0);

    const trail = await auditActions(db, closures[0].id);
    expect(trail, "⛔ marking somebody away must leave an audit trail").toContain(
      "blocked_date_created",
    );

    console.log(
      `[E2] step 2 — away: one staff_blocked_dates row for ${awayName} on ${TARGET_DATE}, ` +
        `reason kept, audited, and blocked_dates untouched. The "bookings exist" guard ` +
        `${warned ? "was shown" : "was not shown — the cached page had not seen the seeded visits yet, which is expected (G1)"}.`,
    );
  });

  test("step 3 — ⛔ SHE goes, and ONLY she goes", async ({ browser }) => {
    expect(closureIds.length, "step 2 must have run").toBeGreaterThan(0);

    // ── The clinic's screen ──────────────────────────────────────────────
    const owner = await pageAs(browser, "owner");
    const { offered, all } = await readPickList(owner.page, visitAId);
    await owner.context.close();

    const stillOffered = findCandidate(offered, awayName);
    const revealed = findCandidate(all, awayName);
    const cover = findCandidate(offered, coverName);

    expect(
      stillOffered,
      `⛔ ${awayName} IS AWAY AND THE BOOKING SCREEN STILL OFFERS HER. Front desk would book a ` +
        `visit to somebody who is not working. Reason shown: "${stillOffered?.reason ?? ""}"`,
    ).toBeFalsy();

    // ⛔ GONE FROM THE LIST IS NOT ENOUGH ON ITS OWN — the clinic must be able
    // to see WHY, or an absence is indistinguishable from a therapist who has
    // vanished from the system.
    expect(
      revealed,
      `⛔ ${awayName} disappeared from the screen entirely instead of being shown as ` +
        `unavailable. Nobody could tell whether she is away or deleted. Shown behind ` +
        `"Show all staff": ${describeRows(all)}`,
    ).toBeTruthy();
    expect(
      revealed!.enabled,
      `⛔ ${awayName} is shown as away and is STILL CLICKABLE — the refusal is cosmetic.`,
    ).toBe(false);
    expect(
      revealed!.reason,
      `⛔ the clinic must be told she is away because the day is blocked for her. It said: ` +
        `"${revealed!.reason}"`,
    ).toBe("Blocked date");

    // ⛔ AND THE POINT OF THE WHOLE SCENARIO: somebody else can still cover.
    expect(
      cover?.enabled,
      `⛔ ONE THERAPIST'S DAY OFF CLOSED THE CLINIC. ${coverName} is no longer bookable for ` +
        `visit A either. Offered: ${describeRows(offered)}`,
    ).toBe(true);

    // ── The public engine ────────────────────────────────────────────────
    const slotsAfter = await offeredSlots(TARGET_DATE);
    const femaleAfter = femaleCountsByTime(slotsAfter);

    expect(
      slotsAfter.length,
      `⛔ ONE THERAPIST'S DAY OFF TOOK THE WHOLE DATE OFF SALE. ${TARGET_DATE} now offers no ` +
        `times at all to the public, when ${coverName} is still working it.`,
    ).toBeGreaterThan(0);
    expect(
      femaleAfter[PROBE_TIME],
      `⛔ the public engine did not lose exactly one female therapist at ${PROBE_TIME}: it had ` +
        `${femaleBefore[PROBE_TIME]} and now reports ${femaleAfter[PROBE_TIME]}.`,
    ).toBe(femaleBefore[PROBE_TIME] - 1);

    // ⛔ AND NOBODY ELSE MOVED. Checked across every time both answers share:
    // never more than before (the closure cannot add capacity) and never more
    // than one fewer (it must not take a second person down with it).
    const shared = Object.keys(femaleAfter).filter((time) => time in femaleBefore);
    expect(shared.length, "the two answers must overlap enough to compare").toBeGreaterThan(0);

    const overCount = shared.filter((t) => femaleAfter[t] > femaleBefore[t]);
    const lostTooMany = shared.filter((t) => femaleAfter[t] < femaleBefore[t] - 1);
    expect(
      overCount,
      `⛔ marking a therapist away INCREASED the number available at ${overCount.join(", ")}`,
    ).toEqual([]);
    expect(
      lostTooMany,
      `⛔ marking ONE therapist away removed more than one from the count at ` +
        `${lostTooMany.map((t) => `${t} (${femaleBefore[t]} -> ${femaleAfter[t]})`).join(", ")}`,
    ).toEqual([]);

    console.log(
      `[E2] step 3 — exactly one person gone: ${awayName} is refused with "Blocked date" and ` +
        `unclickable, ${coverName} is still bookable, the date still offers ` +
        `${slotsAfter.length} times, and the female count fell by exactly one at ${PROBE_TIME} ` +
        `(${femaleBefore[PROBE_TIME]} -> ${femaleAfter[PROBE_TIME]}) with no other time moved.`,
    );
  });

  test("step 4 — ⛔ THE HALF THAT HURTS: the visits already in her diary are untouched", async () => {
    expect(visitBId, "step 1 must have run").not.toBe("");
    const db = serviceClient();

    // ⛔ THE WHOLE ROW, COMPARED WHOLE. Naming the columns I expected to change
    // is how a run misses the one it did not think of — and `updated_at` moving
    // at all would itself mean the booking was written to.
    const bAfter = await readBooking(db, visitBId);
    expect(
      bAfter,
      `⛔ MARKING ${awayName} AWAY CHANGED THE VISIT ALREADY IN HER DIARY. The app promises it ` +
        `"will stay scheduled". Before: ${JSON.stringify(visitBBefore)} — after: ` +
        `${JSON.stringify(bAfter)}`,
    ).toEqual(visitBBefore);

    // ⛔ AND SHE IS STILL ON IT. A visit that survives as a row but loses its
    // therapist is a visit nobody is going to, and nobody is told.
    const bAssignments = JSON.stringify(
      (await readAssignments(db, visitBId)).sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(
      bAssignments,
      `⛔ marking ${awayName} away silently unassigned her from a visit she had already ` +
        `accepted. Before: ${visitBAssignmentsBefore}`,
    ).toBe(visitBAssignmentsBefore);

    // ⛔ AND NOTHING HAPPENED TO IT QUIETLY.
    expect(
      JSON.stringify((await auditActions(db, visitBId)).sort()),
      `⛔ marking her away performed an action ON the booking. Before: ${visitBAuditBefore}`,
    ).toBe(visitBAuditBefore);

    // The unassigned visit must be equally undisturbed.
    expect(
      await readBooking(db, visitAId),
      "⛔ marking a therapist away changed an unrelated booking on the same date",
    ).toEqual(visitABefore);
    expect(
      JSON.stringify(
        (await readAssignments(db, visitAId)).sort((a, b) => a.id.localeCompare(b.id)),
      ),
      "⛔ marking a therapist away changed the unassigned booking's assignment row",
    ).toBe(visitAAssignmentsBefore);
    expect(
      JSON.stringify((await auditActions(db, visitAId)).sort()),
      "⛔ marking a therapist away performed an action on the unassigned booking",
    ).toBe(visitAAuditBefore);

    console.log(
      `[E2] step 4 — untouched: both visits, their assignments and their audit trails are ` +
        `byte-for-byte what they were. ${awayName} is still down for visit B.`,
    );
  });

  test("step 5 — ⛔ AND SHE COMES BACK", async ({ browser }) => {
    expect(closureIds.length, "step 2 must have run").toBeGreaterThan(0);
    const db = serviceClient();

    const owner = await pageAs(browser, "owner");
    const removedLabel = await bringBack(owner.page);
    await owner.context.close();

    expect(
      (await closuresForAway()).length,
      "⛔ lifting the closure must DELETE the row, not leave it behind",
    ).toBe(0);
    expect(
      await auditActions(db, closureIds[0]),
      "⛔ bringing somebody back must be audited too — otherwise nobody can explain the change",
    ).toContain("blocked_date_deleted");

    // ⛔ THE ROW BEING GONE IS NOT THE SAME AS THE THERAPIST BEING BACK. Nobody
    // reports being able to book somebody again, so this is checked in the same
    // two places, the same way round, as step 3.
    const femaleBack = femaleCountsByTime(await offeredSlots(TARGET_DATE));
    expect(
      femaleBack[PROBE_TIME],
      `⛔ ${awayName} DID NOT COME BACK. Her closure is gone and the public engine still counts ` +
        `${femaleBack[PROBE_TIME]} female therapists at ${PROBE_TIME}, not ` +
        `${femaleBefore[PROBE_TIME]} — she would never be sold again.`,
    ).toBe(femaleBefore[PROBE_TIME]);

    const backOnScreen = await pageAs(browser, "owner");
    const { offered } = await readPickList(backOnScreen.page, visitAId);
    await backOnScreen.context.close();

    const restored = findCandidate(offered, awayName);
    expect(
      restored,
      `⛔ ${awayName} IS STILL MISSING from the booking screen after her closure was lifted. ` +
        `Offered: ${describeRows(offered)}`,
    ).toBeTruthy();
    expect(
      restored!.enabled,
      `⛔ ${awayName} is listed again but still cannot be chosen. Reason shown: ` +
        `"${restored!.reason}"`,
    ).toBe(true);

    // ⛔ And her diary is STILL untouched, after the whole round trip.
    expect(
      await readBooking(db, visitBId),
      "⛔ bringing her back changed the visit that had been sitting in her diary",
    ).toEqual(visitBBefore);

    console.log(
      `\n[E2] COMPLETE. ${awayName} on ${TARGET_DATE}: bookable -> away ("Blocked date", ` +
        `unclickable, one fewer therapist on the public count) -> bookable again, while ` +
        `${coverName} stayed available throughout and both visits were untouched. Lifted via ` +
        `"${removedLabel}".\n`,
    );
  });
});
