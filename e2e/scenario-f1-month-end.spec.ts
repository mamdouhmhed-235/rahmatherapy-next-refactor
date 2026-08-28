// ⛔ GATE 08 — P4, FAMILY F, SCENARIO F1: MONTH END.
//
//   ⛔ The Owner's question: "Can I close a month with what's here?"
//
// ── ⛔ WHAT "RECONCILED" HAS TO MEAN ─────────────────────────────────────
//
// Every other report scenario asks whether the right PEOPLE see the right
// ROWS. This one asks the only question that matters at month end: **do the
// totals add up?** A report that lists the correct bookings and then sums them
// wrongly is worse than no report, because it will be believed and copied into
// a tax return.
//
// ⛔ So the expected figures here are COMPUTED FROM THE FIXTURES, in this file,
// by the same rules `summarizeReports` states — never copied from what the
// report happened to say. A test that reads the answer off the thing it is
// testing proves only that the number is stable.
//
// ── ⛔ WHY THE WINDOW MUST BE EMPTY FIRST ────────────────────────────────
//
// Exact reconciliation is only possible if the period contains nothing but this
// run's fixtures. Measured: every pre-existing booking in this database is on or
// before 2026-08-11, so a window a week or two ahead is empty — and step 1
// ASSERTS that rather than trusting it. ⚠️ If somebody later seeds a booking in
// that range, this scenario must fail loudly rather than quietly reconcile
// against a total that includes a stranger.
//
// ── ⛔ THE FOURTH BOOKING, OUTSIDE THE WINDOW ───────────────────────────
//
// A date filter that silently did nothing would still produce a report whose
// totals matched its own rows. ⛔ So one fixture is deliberately placed OUTSIDE
// the period: it must appear nowhere. Without it, "the range was applied" is
// untested.
//
// ── ⚠️ ONE THING THE OWNER SHOULD KNOW, AND IT IS NOT A BUG ─────────────
//
// `reporting.ts` carries an explicit, undecided policy note: **`bookedRevenue`
// sums every booking in range, INCLUDING cancelled and no-show ones.** The code
// spells out both readings — "revenue committed at time of booking" versus
// "revenue from currently-valid bookings" — and defers the choice.
//
// ⛔ This file therefore asserts the CURRENT documented behaviour rather than
// the behaviour I would prefer, and step 5 states the consequence in plain
// numbers so the Owner can decide with a real example in front of them. ⚠️ If
// that policy is ever settled, this test must be updated deliberately — it is
// not a defect to be "fixed" by making the assertion pass again.
//
// ── ⛔ CLEANING UP ───────────────────────────────────────────────────────
// G21: every export writes an audit row, so every new `audit_logs` id is swept.
//
// ⛔ EMAIL COST: ZERO. All four bookings are seeded; reports are read-only.

import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  SERVICES,
  THERAPIST_A_STAFF_ID,
  destroyScenarioFixtures,
  isoDaysFromToday,
  pageAs,
  seedWebsiteBooking,
  serviceClient,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

/**
 * ⛔ Offsets 9–12 and 24 are chosen to sit clear of every other scenario's
 * fixture dates (E1 +7, E2 +14, E3 +21/22, E4 +29/30, F3 +4, F4 +5, F5 +3), so
 * a future full-suite run cannot make two scenarios reconcile against each
 * other's bookings.
 */
const FROM = isoDaysFromToday(9);
const TO = isoDaysFromToday(12);
const OUTSIDE = isoDaysFromToday(24);

const PRICE = SERVICES.hijama.price;

const clientIds: string[] = [];
let auditIdsBefore = new Set<string>();

type Seeded = { id: string; name: string; total: number; paid: number; status: string };
const inWindow: Seeded[] = [];
let outsideId = "";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  test.setTimeout(300_000);
  const db = serviceClient();
  const problems: string[] = [];

  if (auditIdsBefore.size > 0) {
    const { data: now } = await db.from("audit_logs").select("id");
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

  try {
    await destroyScenarioFixtures(db, clientIds);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  if (problems.length > 0) {
    throw new Error(`⛔ F1 TEARDOWN LEFT PRODUCTION DIRTY:\n  - ${problems.join("\n  - ")}`);
  }
});

async function exportCsv(request: APIRequestContext, report: string, from = FROM, to = TO) {
  const response = await request.get(
    `/admin/reports/export?report=${encodeURIComponent(report)}&range=custom&from=${from}&to=${to}`,
    { timeout: 120_000 },
  );
  return { status: response.status(), body: await response.text() };
}

/** Split a CSV into objects. Quote-aware: an address can contain a comma. */
function parseCsv(csv: string): Record<string, string>[] {
  const lines = csv.split("\n").filter((line) => line.trim() !== "");
  if (lines.length < 2) return [];
  const split = (line: string) => {
    const out: string[] = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { field += '"'; i += 1; }
        else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") { out.push(field); field = ""; }
      else field += ch;
    }
    out.push(field);
    return out;
  };
  const headers = split(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = split(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });
}

/**
 * ⛔ Money out of a report cell, as a NUMBER (G20).
 *
 * `formatMoney` may render "£45.00", "45.00" or "45" depending on the branch,
 * and asserting on any one of those spellings tests the formatter rather than
 * the arithmetic.
 */
function money(value: string): number {
  return Number(String(value).replace(/[^0-9.-]/g, ""));
}

test.describe("F1 — month end: can the Owner close a month with what's here?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ the control: an EMPTY period, then four known bookings", async () => {
    const db = serviceClient();

    // ⛔ THE PERIOD MUST BE EMPTY FIRST. Reconciliation against a window that
    // already contains somebody else's booking proves nothing, and would fail
    // in a way that looks like an arithmetic bug.
    const { data: preexisting, error: preError } = await db
      .from("bookings")
      .select("id, booking_date")
      .gte("booking_date", FROM)
      .lte("booking_date", TO);
    expect(preError?.message ?? "", "could not check the period").toBe("");
    expect(
      (preexisting ?? []).length,
      `⛔ ${FROM}..${TO} already contains ${(preexisting ?? []).length} booking(s), so the totals ` +
        `below cannot be reconciled exactly. Move the window.`,
    ).toBe(0);

    const { data: auditRows } = await db.from("audit_logs").select("id");
    auditIdsBefore = new Set(((auditRows ?? []) as { id: string }[]).map((r) => r.id));

    // Three bookings with deliberately DIFFERENT shapes, so each summary line
    // has something distinct to get wrong.
    const a = await seedWebsiteBooking(db, "F1A", {
      dayOffset: 9,
      startTime: "09:00:00",
      status: "confirmed",
      assignTo: THERAPIST_A_STAFF_ID,
    });
    const b = await seedWebsiteBooking(db, "F1B", {
      dayOffset: 10,
      startTime: "10:00:00",
      status: "completed",
      paid: true,
      source: "phone",
      participants: [{ gender: "female" }, { gender: "female" }],
      assignTo: THERAPIST_A_STAFF_ID,
    });
    const c = await seedWebsiteBooking(db, "F1C", {
      dayOffset: 11,
      startTime: "11:00:00",
      status: "cancelled",
      assignTo: THERAPIST_A_STAFF_ID,
    });
    const outside = await seedWebsiteBooking(db, "F1OUT", {
      dayOffset: 24,
      startTime: "12:00:00",
      status: "confirmed",
      assignTo: THERAPIST_A_STAFF_ID,
    });

    for (const s of [a, b, c, outside]) clientIds.push(s.clientId);
    outsideId = outside.bookingId;

    inWindow.push(
      { id: a.bookingId, name: a.name, total: PRICE, paid: 0, status: "confirmed" },
      { id: b.bookingId, name: b.name, total: PRICE * 2, paid: PRICE * 2, status: "completed" },
      { id: c.bookingId, name: c.name, total: PRICE, paid: 0, status: "cancelled" },
    );

    // ⛔ ASSERT THE FIXTURES APPLIED (G5) — every figure below is derived from
    // these, so a wrong seed would produce a confident wrong reconciliation.
    for (const seeded of inWindow) {
      const { data } = await db.from("bookings").select("*").eq("id", seeded.id).single();
      const row = data as Record<string, unknown>;
      expect(Number(row.total_price), `${seeded.name} should total £${seeded.total}`).toBe(
        seeded.total,
      );
      expect(Number(row.amount_paid), `${seeded.name} paid`).toBe(seeded.paid);
      expect(String(row.status), `${seeded.name} status`).toBe(seeded.status);
      expect(String(row.booking_date) >= FROM && String(row.booking_date) <= TO).toBe(true);
    }
    const { data: outRow } = await db.from("bookings").select("booking_date").eq("id", outsideId).single();
    expect(
      String((outRow as { booking_date: string }).booking_date),
      "⛔ the fourth booking must really be OUTSIDE the period, or the date filter is untested",
    ).toBe(OUTSIDE);

    console.log(
      `[F1] step 1 — control: ${FROM}..${TO} was empty and now holds exactly three known bookings ` +
        `(£${PRICE} confirmed unpaid, £${PRICE * 2} completed paid, £${PRICE} cancelled), with a ` +
        `fourth on ${OUTSIDE} deliberately outside the period.`,
    );
  });

  test("step 2 — ⛔ the period is a period: the booking outside it is nowhere", async ({
    browser,
  }) => {
    expect(inWindow.length, "step 1 must have run").toBe(3);

    const owner = await pageAs(browser, "owner");
    const list = await exportCsv(owner.context.request, "booking_list");
    const payments = await exportCsv(owner.context.request, "payment_report");
    await owner.context.close();

    expect(list.status, "the Owner's export should work").toBe(200);

    const rows = parseCsv(list.body);
    const ids = rows.map((r) => r.booking_id).sort();
    expect(
      ids,
      `⛔ THE DATE RANGE DID NOT APPLY AS ASKED. Expected exactly this run's three bookings for ` +
        `${FROM}..${TO}; got ${rows.length} rows.`,
    ).toEqual(inWindow.map((s) => s.id).sort());

    expect(
      list.body.includes(outsideId),
      `⛔ A BOOKING FROM OUTSIDE THE PERIOD (${OUTSIDE}) IS IN THE MONTH'S REPORT. Every total ` +
        `below it would be overstated.`,
    ).toBe(false);
    expect(
      payments.body.includes(outsideId),
      `⛔ the out-of-period booking leaked into the payment report too`,
    ).toBe(false);

    console.log(
      `[F1] step 2 — bounded: booking_list for ${FROM}..${TO} contains exactly the three bookings ` +
        `in the period, and the one on ${OUTSIDE} appears in neither the booking list nor the ` +
        `payment report.`,
    );
  });

  test("step 3 — ⛔ THE QUESTION: do the totals add up?", async ({ browser }) => {
    expect(inWindow.length, "step 1 must have run").toBe(3);

    // ⛔ COMPUTED HERE, from the fixtures, by the rules `summarizeReports`
    // states — not read off the report.
    const live = inWindow.filter((s) => !["cancelled", "no_show"].includes(s.status));
    const expected = {
      // ⚠️ Documented policy: every booking in range, cancelled included.
      booked_revenue: inWindow.reduce((sum, s) => sum + s.total, 0),
      collected_revenue: inWindow.reduce((sum, s) => sum + s.paid, 0),
      outstanding_revenue: live.reduce((sum, s) => sum + Math.max(s.total - s.paid, 0), 0),
      completed_revenue: inWindow
        .filter((s) => s.status === "completed")
        .reduce((sum, s) => sum + s.paid, 0),
    };

    const owner = await pageAs(browser, "owner");
    const revenue = await exportCsv(owner.context.request, "revenue_summary");
    await owner.context.close();

    expect(revenue.status, "the revenue summary should export").toBe(200);
    const reported = new Map(
      parseCsv(revenue.body).map((row) => [row.metric, money(row.value)]),
    );

    for (const [metric, value] of Object.entries(expected)) {
      expect(
        reported.get(metric),
        `⛔ THE MONTH'S "${metric}" DOES NOT ADD UP. Adding the bookings in the period by hand ` +
          `gives £${value.toFixed(2)}; the report says £${reported.get(metric)}. The Owner would ` +
          `close the month on the wrong number.`,
      ).toBe(value);
    }

    console.log(
      `[F1] step 3 — reconciled: booked £${expected.booked_revenue.toFixed(2)}, collected ` +
        `£${expected.collected_revenue.toFixed(2)}, outstanding ` +
        `£${expected.outstanding_revenue.toFixed(2)}, completed ` +
        `£${expected.completed_revenue.toFixed(2)} — every figure matches adding the three ` +
        `bookings up by hand.`,
    );
  });

  test("step 4 — ⛔ and the supporting reports agree with the same bookings", async ({
    browser,
  }) => {
    expect(inWindow.length, "step 1 must have run").toBe(3);

    const owner = await pageAs(browser, "owner");
    const payments = parseCsv((await exportCsv(owner.context.request, "payment_report")).body);
    const sources = parseCsv((await exportCsv(owner.context.request, "source_channel_report")).body);
    const clients = parseCsv((await exportCsv(owner.context.request, "client_summary")).body);
    await owner.context.close();

    // ⛔ The payment report must owe what the bookings owe — the figure a
    // therapist collects at the door.
    for (const seeded of inWindow) {
      const row = payments.find((r) => r.booking_id === seeded.id);
      expect(row, `⛔ ${seeded.name} is missing from the payment report`).toBeTruthy();
      expect(
        money(row!.amount_due),
        `⛔ ${seeded.name} owes £${seeded.total} and the payment report says £${row!.amount_due}`,
      ).toBe(seeded.total);
      expect(
        money(row!.amount_paid),
        `⛔ ${seeded.name} has paid £${seeded.paid} and the payment report says £${row!.amount_paid}`,
      ).toBe(seeded.paid);
    }

    // ⛔ The channel counts must total the period's bookings exactly — two
    // website, one phone.
    const counted = sources.reduce((sum, row) => sum + Number(row.bookings), 0);
    expect(
      counted,
      `⛔ the channel report counts ${counted} bookings for a period containing ` +
        `${inWindow.length}. Rows: ${JSON.stringify(sources)}`,
    ).toBe(inWindow.length);
    expect(
      Number(sources.find((r) => r.source === "phone")?.bookings ?? 0),
      "⛔ the one phone booking is not counted as a phone booking",
    ).toBe(1);
    expect(
      Number(sources.find((r) => r.source === "website")?.bookings ?? 0),
      "⛔ the two website bookings are not counted as website bookings",
    ).toBe(2);

    // Every client behind those bookings must be in the client list.
    for (const seeded of inWindow) {
      expect(
        clients.some((row) => row.full_name === seeded.name),
        `⛔ ${seeded.name} took a booking in this period but is missing from the client summary`,
      ).toBe(true);
    }

    console.log(
      `[F1] step 4 — consistent: the payment report owes and shows exactly what the three bookings ` +
        `do, the channel report counts ${counted} (2 website + 1 phone), and every client behind ` +
        `them is listed.`,
    );
  });

  test("step 5 — ⚠️ the one thing to tell the Owner: cancellations are in 'booked revenue'", async ({
    browser,
  }) => {
    expect(inWindow.length, "step 1 must have run").toBe(3);

    const cancelled = inWindow.find((s) => s.status === "cancelled")!;
    const owner = await pageAs(browser, "owner");
    const revenue = new Map(
      parseCsv((await exportCsv(owner.context.request, "revenue_summary")).body).map((r) => [
        r.metric,
        money(r.value),
      ]),
    );
    await owner.context.close();

    const booked = revenue.get("booked_revenue")!;
    const outstanding = revenue.get("outstanding_revenue")!;
    const withoutCancelled = inWindow
      .filter((s) => s.status !== "cancelled")
      .reduce((sum, s) => sum + s.total, 0);

    // ⛔ ASSERTING THE DOCUMENTED BEHAVIOUR, NOT A PREFERENCE. `reporting.ts`
    // states this is interpretation (a), "revenue committed at time of
    // booking", and defers the choice between it and (b). If that decision is
    // ever taken, this assertion must be changed deliberately.
    expect(
      booked,
      `⛔ 'booked_revenue' no longer matches the documented policy. It should include the ` +
        `cancelled booking (£${withoutCancelled + cancelled.total}) rather than exclude it ` +
        `(£${withoutCancelled}).`,
    ).toBe(withoutCancelled + cancelled.total);

    // ⛔ AND THE COUNTERWEIGHT: the money the clinic can still collect must NOT
    // include it. If both figures counted a cancellation, nothing in the report
    // would tell the Owner the difference.
    expect(
      outstanding,
      `⛔ a CANCELLED booking is being counted as money still owed. The clinic charges no ` +
        `cancellation fee, so £${cancelled.total} would be chased that nobody owes.`,
    ).toBe(inWindow.filter((s) => s.status !== "cancelled").reduce((sum, s) => sum + (s.total - s.paid), 0));

    console.log(
      `\n[F1] COMPLETE. The month reconciles: every figure in the revenue summary equals adding ` +
        `the period's bookings up by hand, the supporting reports agree, and a booking one day ` +
        `outside the period appears nowhere.\n` +
        `⚠️ ONE THING FOR THE OWNER: "booked revenue" is £${booked.toFixed(2)}, which INCLUDES the ` +
        `£${cancelled.total.toFixed(2)} cancelled booking; without it the figure would be ` +
        `£${withoutCancelled.toFixed(2)}. That is the documented, deliberate reading ("revenue ` +
        `committed at time of booking") and the code defers the choice. "Outstanding" correctly ` +
        `excludes it (£${outstanding.toFixed(2)}), so the two figures together do tell the truth — ` +
        `but a month closed on "booked revenue" alone would overstate takings by the value of ` +
        `every cancellation.\n`,
    );
  });
});
