// ⛔ GATE 08 — P4, FAMILY F, SCENARIO F5: THE CLIENT LIST DOWNLOAD.
//
//   ⛔ The Owner's question: "Can a therapist download the whole clinic's
//    client list?"
//
// ⛔ THE COVERAGE PLAN SINGLES THIS ONE OUT — "This route has leaked it once."
// It is the highest-stakes scenario left in the programme: every customer's
// name, email address, phone number, town and postcode, in one file, handed to
// whoever asks for it.
//
// ── ⛔ THE LEAK WAS REAL, AND THE FIX IS WHAT THIS FILE GUARDS ───────────
//
// `src/app/admin/reports/export/route.ts` carries the confession in its own
// comment: `getReportData` scopes BOOKINGS to the caller, but returns
// `clients`, `staff`, `enquiries`, `emailEvents` and `operationalEvents` as the
// FULL clinic-wide tables for every profile. Sixteen call sites in
// `reports/page.tsx` narrow afterwards. ⛔ THIS ROUTE DID NOT — and
// `report=client_summary` mapped `data.clients` straight into a downloadable
// CSV of every full name in the clinic.
//
// The fix is one line — `filterReportDataToStaff(data, profile.id)` for anyone
// without universal scope. ⚠️ A one-line fix on a route nobody watches is
// exactly the kind that gets refactored away. This file is the watch.
//
// ── ⛔ WHY THE PERMISSION GATE IS NOT THE PROTECTION ─────────────────────
//
// Measured against the live database, the `Therapist` role holds:
//   view_reports_own · export_reports_own · view_clients_assigned ·
//   view_client_contact_details · view_client_health_notes_assigned ·
//   create_client_session_notes
// ⛔ So a therapist PASSES the route's gate — it only asks for `canOpenReports`
// plus either export permission. The gate was never what stopped the leak, and
// a test that merely checked "she is allowed in" would prove nothing.
//
// ⚠️ AND `report` IS AN UNVALIDATED QUERY PARAMETER. Any permitted caller can
// ask for any shape, so every shape is tested here — including one that does
// not exist, because an unrecognised value falls through to the DEFAULT branch,
// which is the most sensitive of the lot: contact_name, contact_email,
// contact_phone, city and postcode for every booking in range.
//
// ── ⛔ THE TRAP THIS FILE MUST NOT FALL INTO ─────────────────────────────
//
// ⛔ AN EMPTY FILE PASSES EVERY "MUST NOT CONTAIN" ASSERTION. If the export
// broke, returned 403, or simply produced nothing, a test written only as
// "the other client's name is absent" would go green and report the strongest
// possible safety — while proving the exact opposite of what it claims.
//
// So every shape is checked in BOTH directions:
//   • the other therapist's client must be ABSENT, and
//   • ⛔ her OWN client must be PRESENT, so the absence means scoping rather
//     than emptiness.
// And the Owner runs the same request as the control (G2): the data really is
// there to leak, and a legitimate export is not damaged by the narrowing.
//
// ── ⛔ CLEANING UP ───────────────────────────────────────────────────────
//
// ⚠️ Every single export writes an `audit_logs` row (`report_exported`) — and
// this file performs a lot of them. They are keyed on `target_id: null`, so
// nothing in `destroyScenarioFixtures` could ever find them. The run records
// which existed beforehand and removes exactly the difference, the technique
// E3 and E4 established (G13).
//
// ⛔ EMAIL COST: ZERO. Reports are read-only and no booking is created through
// the app.

import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  THERAPIST_A_STAFF_ID,
  THERAPIST_B_STAFF_ID,
  destroyScenarioFixtures,
  expectOwnerNeverAssigned,
  isoDaysFromToday,
  pageAs,
  readAssignments,
  seedWebsiteBooking,
  serviceClient,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

function weekdayOf(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

/** A working day soon enough to sit comfortably inside a report range. */
const DAY_OFFSET = weekdayOf(isoDaysFromToday(3)) === 0 ? 4 : 3;
const REPORT_DATE = isoDaysFromToday(DAY_OFFSET);

/**
 * ⛔ Every shape the route accepts, plus one that does not exist.
 *
 * The bogus value is not padding: an unrecognised `report` falls through to the
 * DEFAULT branch, which returns contact name, email, phone, city and postcode
 * for every booking in range. That is the most sensitive output of the route and
 * it is what a typo — or a probe — actually gets.
 */
const REPORT_SHAPES = [
  "booking_list",
  "client_summary",
  "payment_report",
  "revenue_summary",
  "staff_workload_report",
  "staff_revenue_attribution_report",
  "service_performance_report",
  "source_channel_report",
  "zz_not_a_real_report",
] as const;

/** Shapes that are supposed to carry client-identifying rows at all. */
const CLIENT_BEARING = new Set(["booking_list", "client_summary", "zz_not_a_real_report"]);

const clientIds: string[] = [];
let auditIdsBefore = new Set<string>();

/** MINE — assigned to the therapist doing the downloading. */
let mine = { name: "", email: "", phone: "", bookingId: "" };
/** THEIRS — assigned to a different therapist. Must never appear. */
let theirs = { name: "", email: "", phone: "", bookingId: "" };

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  test.setTimeout(300_000);
  const db = serviceClient();
  const problems: string[] = [];

  // ⛔ One `report_exported` row per export, keyed on `target_id: null` — no
  // sweep in `destroyScenarioFixtures` can reach them (G13).
  if (auditIdsBefore.size > 0) {
    const { data: now } = await db
      .from("audit_logs")
      .select("id")
      .eq("action_type", "report_exported");
    const ours = ((now ?? []) as { id: string }[])
      .map((r) => r.id)
      .filter((id) => !auditIdsBefore.has(id));
    if (ours.length > 0) {
      const { error } = await db.from("audit_logs").delete().in("id", ours);
      if (error) problems.push(`could not remove this run's audit rows: ${error.message}`);
      const { data: left } = await db.from("audit_logs").select("id").in("id", ours);
      if ((left ?? []).length) problems.push(`${(left ?? []).length} audit rows survived`);
    }
  }

  // ⛔ UNCONDITIONAL (G19) — it sweeps strays by the run-tagged name, which is
  // the only thing that can find a fixture whose id was never captured.
  try {
    await destroyScenarioFixtures(db, clientIds);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  if (problems.length > 0) {
    throw new Error(`⛔ F5 TEARDOWN LEFT PRODUCTION DIRTY:\n  - ${problems.join("\n  - ")}`);
  }
});

/** Download one report shape as whoever this request context is signed in as. */
async function exportCsv(request: APIRequestContext, report: string) {
  const url =
    `/admin/reports/export?report=${encodeURIComponent(report)}` +
    `&range=custom&from=${REPORT_DATE}&to=${REPORT_DATE}`;
  const response = await request.get(url, { timeout: 120_000 });
  return { status: response.status(), body: await response.text() };
}

/** Count data rows in a CSV, ignoring the header and any trailing blank. */
function csvRowCount(body: string) {
  const lines = body.split("\n").filter((line) => line.trim() !== "");
  return Math.max(0, lines.length - 1);
}

test.describe("F5 — the client list download: can a therapist take the whole clinic's clients?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ the control: two clients exist, and the Owner's export really does contain both", async ({
    browser,
  }) => {
    const db = serviceClient();

    expect(
      weekdayOf(REPORT_DATE),
      `⛔ ${REPORT_DATE} is a Sunday; pick a working day so both fixtures are ordinary bookings`,
    ).not.toBe(0);

    const { data: auditRows, error: auditError } = await db
      .from("audit_logs")
      .select("id")
      .eq("action_type", "report_exported");
    expect(auditError?.message ?? "", "could not read the audit trail").toBe("");
    auditIdsBefore = new Set(((auditRows ?? []) as { id: string }[]).map((r) => r.id));

    // ── The two visits: one hers, one somebody else's ────────────────────
    const seededMine = await seedWebsiteBooking(db, "F5MINE", {
      dayOffset: DAY_OFFSET,
      startTime: "09:00:00",
      status: "confirmed",
      assignTo: THERAPIST_A_STAFF_ID,
    });
    clientIds.push(seededMine.clientId);
    mine = {
      name: seededMine.name,
      email: seededMine.email,
      phone: seededMine.phone,
      bookingId: seededMine.bookingId,
    };

    const seededTheirs = await seedWebsiteBooking(db, "F5THEIRS", {
      dayOffset: DAY_OFFSET,
      startTime: "13:00:00",
      status: "confirmed",
      assignTo: THERAPIST_B_STAFF_ID,
    });
    clientIds.push(seededTheirs.clientId);
    theirs = {
      name: seededTheirs.name,
      email: seededTheirs.email,
      phone: seededTheirs.phone,
      bookingId: seededTheirs.bookingId,
    };

    // ⛔ ASSERT THE FIXTURES APPLIED before concluding anything (G5). If both
    // landed on the same therapist, "no leak" would be trivially true.
    const mineAssignments = await readAssignments(db, mine.bookingId);
    const theirsAssignments = await readAssignments(db, theirs.bookingId);
    expect(
      mineAssignments.every((a) => a.assigned_staff_id === THERAPIST_A_STAFF_ID),
      "⛔ the first visit must really belong to the downloading therapist",
    ).toBe(true);
    expect(
      theirsAssignments.every((a) => a.assigned_staff_id === THERAPIST_B_STAFF_ID),
      "⛔ the second visit must really belong to a DIFFERENT therapist, or there is nothing to leak",
    ).toBe(true);
    expect(mine.name).not.toBe(theirs.name);
    await expectOwnerNeverAssigned(db, mine.bookingId);
    await expectOwnerNeverAssigned(db, theirs.bookingId);

    // ── ⛔ THE CONTROL (G2). The Owner SHOULD see both. ───────────────────
    // Without this, every "she cannot see it" result below would also be
    // produced by an export that was simply broken.
    const owner = await pageAs(browser, "owner");
    const ownerCsv = await exportCsv(owner.context.request, "client_summary");
    await owner.context.close();

    expect(
      ownerCsv.status,
      `⛔ THE CONTROL FAILED. The Owner's own export did not work, so nothing below can be trusted.`,
    ).toBe(200);
    expect(
      ownerCsv.body,
      `⛔ THE CONTROL FAILED. The Owner's export does not contain the first client, so the data ` +
        `is not there to leak and this scenario proves nothing.`,
    ).toContain(mine.name);
    expect(
      ownerCsv.body,
      `⛔ THE CONTROL FAILED. The Owner's export does not contain the second client either.`,
    ).toContain(theirs.name);

    console.log(
      `[F5] step 1 — control: two confirmed visits on ${REPORT_DATE}, one for each therapist, and ` +
        `the Owner's client_summary export contains BOTH clients (${csvRowCount(ownerCsv.body)} rows). ` +
        `The data is genuinely there to leak.`,
    );
  });

  test("step 2 — ⛔ THE QUESTION: every export shape, as the therapist", async ({ browser }) => {
    expect(mine.name, "step 1 must have run").not.toBe("");

    const therapist = await pageAs(browser, "therapist_a");
    const results: string[] = [];
    const leaks: string[] = [];

    for (const report of REPORT_SHAPES) {
      const csv = await exportCsv(therapist.context.request, report);

      // ⛔ She is ALLOWED in — the Therapist role holds export_reports_own. A
      // 403 here would make every "no leak" result below meaningless, so it is
      // asserted rather than quietly accepted as safety.
      expect(
        csv.status,
        `⛔ the therapist was refused the "${report}" export entirely (${csv.status}). That is not ` +
          `this scenario passing — it means the leak question was never asked. Body: ` +
          `${csv.body.slice(0, 200)}`,
      ).toBe(200);

      // ⛔ THE LEAK CHECK — name, email AND phone, because a shape might carry
      // one without the others.
      for (const [label, value] of [
        ["name", theirs.name],
        ["email", theirs.email],
        ["phone", theirs.phone],
      ] as const) {
        if (csv.body.includes(value)) {
          leaks.push(`${report}: leaked the other therapist's client ${label} (${value})`);
        }
      }

      // ⛔ AND THE NON-VACUOUS HALF. An empty CSV passes every check above.
      if (CLIENT_BEARING.has(report)) {
        expect(
          csv.body,
          `⛔ the "${report}" export does not contain the therapist's OWN client either, so the ` +
            `absence of the other client proves nothing — the file may simply be empty. Got ` +
            `${csvRowCount(csv.body)} rows: ${csv.body.slice(0, 300)}`,
        ).toContain(mine.name);
      }

      results.push(`${report}=${csvRowCount(csv.body)}r`);
    }

    await therapist.context.close();

    expect(
      leaks,
      `⛔ A THERAPIST CAN DOWNLOAD ANOTHER THERAPIST'S CLIENT DETAILS.\n  - ${leaks.join("\n  - ")}`,
    ).toEqual([]);

    console.log(
      `[F5] step 2 — scoped: all ${REPORT_SHAPES.length} export shapes returned 200 to the ` +
        `therapist, every one contained HER OWN client where clients appear, and NONE contained ` +
        `the other therapist's client name, email or phone. Rows: ${results.join(" ")}`,
    );
  });

  test("step 3 — ⛔ the counts are scoped too, not just the names", async ({ browser }) => {
    expect(mine.name, "step 1 must have run").not.toBe("");

    // ⛔ A NAME CAN BE ABSENT WHILE THE NUMBER BEHIND IT IS NOT. An aggregate
    // that counted both bookings would tell a therapist exactly how much work
    // the rest of the clinic did that day, without printing anybody's name.
    const therapist = await pageAs(browser, "therapist_a");
    const therapistSource = await exportCsv(therapist.context.request, "source_channel_report");
    const therapistList = await exportCsv(therapist.context.request, "booking_list");
    await therapist.context.close();

    const owner = await pageAs(browser, "owner");
    const ownerSource = await exportCsv(owner.context.request, "source_channel_report");
    const ownerList = await exportCsv(owner.context.request, "booking_list");
    await owner.context.close();

    // Both fixtures are `website` bookings on the same day, so the therapist's
    // count for that channel must be strictly smaller than the Owner's.
    const therapistRows = csvRowCount(therapistList.body);
    const ownerRows = csvRowCount(ownerList.body);

    expect(
      therapistRows,
      `⛔ the therapist's booking_list export is empty, so nothing here is measurable`,
    ).toBeGreaterThan(0);
    expect(
      therapistRows,
      `⛔ THE THERAPIST'S EXPORT IS NOT NARROWED. She got ${therapistRows} booking rows and the ` +
        `Owner got ${ownerRows} — she is seeing the whole clinic's day.`,
    ).toBeLessThan(ownerRows);

    expect(
      therapistSource.body,
      `⛔ the therapist's source_channel_report is empty; nothing to compare`,
    ).not.toBe("");
    expect(
      therapistSource.body === ownerSource.body,
      `⛔ THE AGGREGATE COUNTS ARE NOT SCOPED. The therapist's source_channel_report is ` +
        `byte-identical to the Owner's, so she is being told how much work the whole clinic did.\n` +
        `Therapist: ${therapistSource.body}\nOwner: ${ownerSource.body}`,
    ).toBe(false);

    console.log(
      `[F5] step 3 — counts scoped: the therapist's booking_list has ${therapistRows} rows against ` +
        `the Owner's ${ownerRows}, and her channel totals differ from the Owner's rather than ` +
        `matching them.`,
    );
  });

  test("step 4 — ⛔ and the Owner's own export is UNDAMAGED by the narrowing", async ({
    browser,
  }) => {
    expect(mine.name, "step 1 must have run").not.toBe("");

    // ⛔ A fix that protects customers by breaking the Owner's reports is not a
    // fix. The Owner has universal scope and must be untouched by any of it.
    const owner = await pageAs(browser, "owner");
    const missing: string[] = [];
    for (const report of REPORT_SHAPES) {
      const csv = await exportCsv(owner.context.request, report);
      expect(
        csv.status,
        `⛔ the Owner's "${report}" export failed (${csv.status})`,
      ).toBe(200);
      if (CLIENT_BEARING.has(report)) {
        if (!csv.body.includes(mine.name)) missing.push(`${report}: missing ${mine.name}`);
        if (!csv.body.includes(theirs.name)) missing.push(`${report}: missing ${theirs.name}`);
      }
    }
    await owner.context.close();

    expect(
      missing,
      `⛔ THE OWNER CAN NO LONGER SEE HER OWN CLINIC'S CLIENTS in some exports:\n  - ` +
        `${missing.join("\n  - ")}`,
    ).toEqual([]);

    console.log(
      `\n[F5] COMPLETE. A therapist CANNOT download the clinic's client list: all ` +
        `${REPORT_SHAPES.length} export shapes — including an unrecognised one, which falls through ` +
        `to the most sensitive branch — returned 200 to her, carried her own client, and carried ` +
        `nothing of the other therapist's client. Counts are narrowed too, and the Owner's own ` +
        `exports still contain every client.\n`,
    );
  });
});
