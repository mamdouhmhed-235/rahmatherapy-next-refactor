// ⛔ GATE 08 — P4, FAMILY F, SCENARIO F4: THE PRICE RISE.
//
//   ⛔ The Owner's question: "If I put a price up, does a customer who already
//    booked keep the price I quoted them?"
//
// ── ⛔ WHY THIS IS A REAL-MONEY SCENARIO EVEN WITHOUT A PAYMENT SYSTEM ───
//
// Nothing here can move money — this clinic takes cash in person and the system
// only RECORDS it (D8, verified: no payment provider exists in the codebase).
// ⚠️ That does not make a wrong price harmless. It makes it a **wrong number on
// a real doorstep**: the therapist arrives, the customer was quoted £40, and the
// system says to collect £47.50. Nobody can undo that conversation. The risk
// moved from "money moves wrongly" to "the clinic is told the wrong figure",
// which is exactly as damaging to a two-person business.
//
// ── ⛔ WHAT PROTECTS THE ALREADY-BOOKED CUSTOMER ────────────────────────
//
// `booking_items.service_price_snapshot` — the price is COPIED onto the booking
// when it is made, and `bookings.total_price` / `amount_due` are computed from
// the services table at that moment. So a later edit to `services.price` should
// reach new bookings and nothing else. This file proves that, in both
// directions, and proves the restore.
//
// ── ⛔ THE CONTROL THAT MAKES STEP 3 MEAN ANYTHING ──────────────────────
//
// "The old booking still says £40" is ALSO true if the price rise silently did
// nothing at all. ⛔ So step 4 makes a NEW booking and requires it to cost the
// NEW price. Without it this scenario would pass against a Services screen whose
// Save button was broken, and would report that as customer protection.
//
// ── ⚠️ A KNOWN, OWNER-ACCEPTED HAZARD THIS SCENARIO WALKS THROUGH ───────
//
// D-044: prices live in TWO independent places. The public website quotes a
// HAND-WRITTEN figure in code; a booking is priced from the DATABASE. So while
// this test holds the database price at £47.50, the website still advertises
// £40 — a real customer would be quoted £40 and billed £47.50.
//
// ⛔ THAT IS NOT A NEW FINDING AND MUST NOT BE REPORTED AS ONE. The Owner was
// offered "make the website read from the database" and chose "add a safety
// check" instead — `pnpm verify:prices`, which exists precisely to catch this
// drift. ⚠️ What it does mean for this file: the drift window must be **as short
// as possible and always closed**, because `verify:prices` will legitimately
// FAIL for as long as the price is raised. Step 5 closes it, and `afterAll`
// closes it again whatever happened.
//
// ── ⛔ CHOSEN DELIBERATELY ───────────────────────────────────────────────
//
// **Fire Package** (`fire-package`, £40), because every other scenario in this
// suite prices against `hijama-package` — so a stray failure here cannot make
// another scenario look broken, and vice versa. The new price **£47.50** is
// deliberately not a round number: it would catch a rounding or integer-pence
// error that £50 would hide.
//
// Bookings are created by calling `create_booking_request` DIRECTLY rather than
// through `/api/bookings/`. ⛔ That is the same function the public form and the
// admin form both price through — it computes `sum(price) from public.services`
// — so it is the real pricing path, and it sends **no email**. `booking_source:
// 'phone'` keeps the notice/booking-window rules (E4's subject) out of the way
// of a scenario about money.
//
// ── ⛔ CLEANING UP ───────────────────────────────────────────────────────
//
// ⚠️ This EDITS A ROW THE CLINIC TRADES ON — E3's lesson. The whole `services`
// row is snapshotted with `.select("*")` first and restored in `afterAll`
// **unconditionally**, then re-read; the run refuses to pass if the price is not
// exactly back. Each save also writes a `service_updated` audit row, swept by
// recording which existed beforehand (G13).
// ⚠️ `verify-system-integrity.mjs` asserts **services = 5**, so a leak fails loudly.
//
// ⛔ EMAIL COST: ZERO.

import { expect, test } from "@playwright/test";
import {
  RUN_TAG,
  destroyScenarioFixtures,
  gotoAdmin,
  isoDaysFromToday,
  pageAs,
  serviceClient,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

function weekdayOf(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

const SERVICE_SLUG = "fire-package";
const SERVICE_NAME = "Fire Package";
/** ⛔ Not a round number — a rounding bug would hide behind £50. */
const RAISED_PRICE = "47.50";

const DAY_OFFSET = weekdayOf(isoDaysFromToday(5)) === 0 ? 6 : 5;
const VISIT_DATE = isoDaysFromToday(DAY_OFFSET);

const clientIds: string[] = [];
let auditIdsBefore = new Set<string>();

/** ⛔ The restore value: the WHOLE row, read before anything is touched. */
let serviceBefore: Record<string, unknown> = {};
let oldPrice = 0;

let earlyBookingId = "";
let earlyBookingBefore: Record<string, unknown> = {};

type Money = { total: number; due: number; snapshot: number };

test.describe.configure({ mode: "serial" });

async function readServiceRow() {
  const db = serviceClient();
  // ⛔ `.select("*")` — a named list that misses a column returns NO ROWS rather
  // than an error, which here would read as "the service does not exist" (G4).
  const { data, error } = await db.from("services").select("*").eq("slug", SERVICE_SLUG).single();
  if (error || !data) throw new Error(`could not read ${SERVICE_SLUG}: ${error?.message}`);
  return data as Record<string, unknown>;
}

/**
 * Read one CSV row back as fields, by booking id.
 *
 * ⛔ NEVER SUBSTRING-MATCH A PRICE IN THE OUTPUT. ⚠️ MEASURED: the first version
 * of step 3 asserted `csv.includes("40.00")` and failed — because the export
 * writes the raw value, which is `40`. The app was completely correct and the
 * report was showing exactly the right price; the test was matching a FORMAT
 * rather than reading a VALUE. That is G12's lesson (never rebuild a rendered
 * string) arriving from the other side, and it would have been reported as
 * "the clinic's report shows the wrong price" — a false alarm about money.
 *
 * ⛔ So the column is parsed out and compared as a NUMBER. `40`, `40.00` and
 * `40.0` are then all the same answer, which is what "the price is right" means.
 */
function csvRowFor(csv: string, bookingId: string): Record<string, string> | null {
  const lines = csv.split("\n").filter((line) => line.trim() !== "");
  if (lines.length < 2) return null;

  // Minimal RFC-4180 split: `escapeCsv` only quotes fields containing a comma,
  // quote or newline, but a customer's address legitimately can.
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
  for (const line of lines.slice(1)) {
    const cells = split(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    if (row.booking_id === bookingId) return row;
  }
  return null;
}

/** What the system actually decided to charge for one booking. */
async function moneyFor(bookingId: string): Promise<Money> {
  const db = serviceClient();
  const { data: booking, error } = await db
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();
  if (error || !booking) throw new Error(`could not read booking ${bookingId}: ${error?.message}`);
  const { data: items } = await db
    .from("booking_items")
    .select("*")
    .eq("booking_id", bookingId);
  const rows = (items ?? []) as { service_price_snapshot: number | string }[];
  return {
    total: Number((booking as { total_price: number }).total_price),
    due: Number((booking as { amount_due: number }).amount_due),
    snapshot: Number(rows[0]?.service_price_snapshot ?? NaN),
  };
}

/**
 * Make a booking through the REAL pricing path, without spending email.
 *
 * ⛔ `create_booking_request` is what both the public form and the admin form
 * price through; the emails are sent by the API route above it, not here.
 */
async function bookAt(label: string, startTime: string) {
  const db = serviceClient();
  const name = `ZZTEST-${label}-${RUN_TAG}`;
  const { data, error } = await db.rpc("create_booking_request", {
    p_service_slugs: [SERVICE_SLUG],
    p_contact_full_name: name,
    p_contact_email: `zztest-${label.toLowerCase()}-${RUN_TAG}@probe.invalid`,
    p_contact_phone: `076${String((Number(RUN_TAG) + label.length) % 1_000_000).padStart(6, "0")}`,
    p_customer_notes: "",
    p_health_notes: "",
    p_consent_acknowledged: true,
    p_service_address_line1: "1 ZZTEST Street",
    p_service_city: "Luton",
    p_service_postcode: "LU1 1AA",
    p_access_notes: "",
    p_booking_date: VISIT_DATE,
    p_start_time: startTime,
    p_participant_genders: ["female"],
    // ⛔ Not 'website': that path also enforces the notice window and the
    // booking window, which belong to E4 and would only add noise here.
    p_booking_source: "phone",
    p_override_availability: false,
  });

  // ⛔ Read the error (G5). A silent failure here would leave every money
  // assertion below comparing against nothing.
  if (error) throw new Error(`could not create the ${label} booking: ${error.message}`);
  const bookingId = (data as { bookingId?: string })?.bookingId;
  if (!bookingId) throw new Error(`the RPC returned no booking id for ${label}`);

  const { data: client } = await db
    .from("clients")
    .select("id")
    .eq("full_name", name)
    .maybeSingle();
  if (client) clientIds.push((client as { id: string }).id);

  return bookingId;
}

/** Set the service's price through the Owner's own screen. */
async function setPriceOnScreen(page: import("@playwright/test").Page, price: string) {
  await gotoAdmin(page, "/admin/services/", "the Owner's services screen");

  const edit = page.getByRole("button", { name: `Edit ${SERVICE_NAME}` });
  await expect(
    edit,
    `⛔ the Owner must be able to find the edit control for ${SERVICE_NAME}`,
  ).toHaveCount(1, { timeout: 30_000 });
  expect(
    await edit.first().isEnabled(),
    "⛔ the edit control must be usable, not merely present (G3)",
  ).toBe(true);
  await edit.first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog, "the service editor should open").toBeVisible({ timeout: 20_000 });

  const priceField = dialog.locator('input[name="price"]');
  await expect(priceField, "the price field should be there").toBeVisible({ timeout: 15_000 });
  await priceField.fill(price);

  const save = dialog.getByRole("button", { name: /^Save changes$/ });
  expect(
    await save.first().isEnabled(),
    "⛔ the Save button must be usable, not merely present (G3)",
  ).toBe(true);

  const answered = page.waitForResponse(
    (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
    { timeout: 60_000 },
  );
  await save.first().click();
  await answered;
  await page.waitForTimeout(1_500);
}

/** ⛔ Bounded poll on the database — the screen's toast is not the truth. */
async function waitForPrice(expected: number) {
  await expect
    .poll(async () => Number((await readServiceRow()).price), {
      timeout: 30_000,
      message: `⛔ ${SERVICE_NAME} never became £${expected.toFixed(2)} in the database`,
    })
    .toBe(expected);
}

test.afterAll(async () => {
  test.setTimeout(300_000);
  const db = serviceClient();
  const problems: string[] = [];

  // ⛔ RESTORE FIRST AND UNCONDITIONALLY. ⚠️ While the price is raised, the
  // website still advertises the old figure (D-044) and `pnpm verify:prices`
  // legitimately FAILS. Leaving it raised would mean the clinic quietly
  // charging more than it advertises.
  if (Object.keys(serviceBefore).length > 0) {
    const { error } = await db
      .from("services")
      .update({
        price: serviceBefore.price,
        duration_mins: serviceBefore.duration_mins,
        name: serviceBefore.name,
        is_active: serviceBefore.is_active,
      })
      .eq("slug", SERVICE_SLUG);
    if (error) problems.push(`could not restore the price: ${error.message}`);

    // ⛔ RE-READ. Do not trust the restore.
    const now = await readServiceRow().catch(() => null);
    if (!now) {
      problems.push("could not re-read the service after restoring it");
    } else if (Number(now.price) !== Number(serviceBefore.price)) {
      problems.push(
        `⛔ ${SERVICE_NAME} IS STILL PRICED WRONG: expected £${Number(serviceBefore.price).toFixed(2)}, ` +
          `found £${Number(now.price).toFixed(2)}. The clinic is charging a price it never chose, and ` +
          `the website is advertising a different one. Fix this by hand before anything else.`,
      );
    }
  }

  const { count } = await db.from("services").select("id", { count: "exact", head: true });
  if (count !== 5) problems.push(`⛔ services holds ${count} rows, not 5`);

  // ⛔ TWO audit trails, not one. Each price save writes `service_updated` —
  // ⚠️ and step 3's report download writes `report_exported`, which the first
  // version of this teardown forgot. MEASURED: two `report_exported` rows
  // survived two runs and had to be removed by hand, leaving `audit_logs` at
  // 286 against a baseline of 284.
  //
  // ⛔ The lesson is general: sweep for EVERY action the scenario triggers, not
  // just the one it is named after. Reading a report is a write.
  if (auditIdsBefore.size > 0) {
    const { data: now } = await db
      .from("audit_logs")
      .select("id, action_type")
      .in("action_type", ["service_updated", "report_exported"]);
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

  // ⛔ UNCONDITIONAL (G19).
  try {
    await destroyScenarioFixtures(db, clientIds);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  if (problems.length > 0) {
    throw new Error(`⛔ F4 TEARDOWN LEFT PRODUCTION DIRTY:\n  - ${problems.join("\n  - ")}`);
  }
});

test.describe("F4 — the price rise: does an already-booked customer keep the price they were quoted?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ the control: a customer books at today's price", async () => {
    const db = serviceClient();

    expect(weekdayOf(VISIT_DATE), `⛔ ${VISIT_DATE} is a Sunday`).not.toBe(0);

    serviceBefore = await readServiceRow();
    oldPrice = Number(serviceBefore.price);
    expect(oldPrice, `⛔ ${SERVICE_NAME} must have a real price to raise`).toBeGreaterThan(0);
    expect(
      oldPrice,
      `⛔ ${SERVICE_NAME} is already £${RAISED_PRICE}; pick a different raised price or this ` +
        `scenario cannot tell a change from no change`,
    ).not.toBe(Number(RAISED_PRICE));
    expect(serviceBefore.is_active, "the service must be on sale to begin with").toBe(true);

    const { data: auditRows, error: auditError } = await db
      .from("audit_logs")
      .select("id")
      .in("action_type", ["service_updated", "report_exported"]);
    expect(auditError?.message ?? "", "could not read the audit trail").toBe("");
    auditIdsBefore = new Set(((auditRows ?? []) as { id: string }[]).map((r) => r.id));

    earlyBookingId = await bookAt("F4EARLY", "10:00:00");
    const money = await moneyFor(earlyBookingId);

    // ⛔ ASSERT THE FIXTURE APPLIED (G5) — and that it was priced from the
    // services table, not from anything this test supplied.
    expect(
      money.total,
      `⛔ THE CONTROL FAILED. The booking was priced £${money.total} when ${SERVICE_NAME} costs ` +
        `£${oldPrice}, so this scenario is not measuring the real pricing path.`,
    ).toBe(oldPrice);
    expect(money.due, "the amount owed must match the price quoted").toBe(oldPrice);
    expect(
      money.snapshot,
      "⛔ the price must be SNAPSHOTTED onto the booking — that snapshot is the customer's protection",
    ).toBe(oldPrice);

    earlyBookingBefore = (await db
      .from("bookings")
      .select("*")
      .eq("id", earlyBookingId)
      .single()).data as Record<string, unknown>;

    console.log(
      `[F4] step 1 — control: ${SERVICE_NAME} is £${oldPrice.toFixed(2)}, and a booking made now on ` +
        `${VISIT_DATE} is priced £${money.total.toFixed(2)} with the price snapshotted onto it.`,
    );
  });

  test("step 2 — ✅ the Owner puts the price up", async ({ browser }) => {
    expect(oldPrice, "step 1 must have run").toBeGreaterThan(0);

    const { context, page } = await pageAs(browser, "owner");
    await setPriceOnScreen(page, RAISED_PRICE);
    await context.close();

    await waitForPrice(Number(RAISED_PRICE));

    const db = serviceClient();
    const { count } = await db.from("services").select("id", { count: "exact", head: true });
    expect(count, "⛔ changing a price must not add or remove a service").toBe(5);

    console.log(
      `[F4] step 2 — raised: ${SERVICE_NAME} is now £${RAISED_PRICE} in the database, still 5 services. ` +
        `⚠️ The website still advertises £${oldPrice.toFixed(2)} — the known D-044 split, which is why ` +
        `step 5 must put this back.`,
    );
  });

  test("step 3 — ⛔ THE QUESTION: the customer who already booked is untouched", async ({
    browser,
  }) => {
    expect(earlyBookingId, "step 1 must have run").not.toBe("");
    const db = serviceClient();

    const money = await moneyFor(earlyBookingId);
    expect(
      money.snapshot,
      `⛔ A PRICE RISE RE-PRICED A BOOKING THAT WAS ALREADY MADE. The customer was quoted ` +
        `£${oldPrice.toFixed(2)} and the snapshot now says £${money.snapshot.toFixed(2)}. A therapist ` +
        `would arrive and ask for more than the customer agreed.`,
    ).toBe(oldPrice);
    expect(
      money.total,
      `⛔ the booking's total was rewritten by the price rise: £${money.total.toFixed(2)}`,
    ).toBe(oldPrice);
    expect(
      money.due,
      `⛔ the amount owed was rewritten by the price rise: £${money.due.toFixed(2)}`,
    ).toBe(oldPrice);

    // ⛔ THE WHOLE ROW, COMPARED WHOLE — `updated_at` moving at all would mean
    // the booking was written to.
    const after = (await db.from("bookings").select("*").eq("id", earlyBookingId).single())
      .data as Record<string, unknown>;
    expect(
      after,
      "⛔ the price rise wrote to a booking that was already made",
    ).toEqual(earlyBookingBefore);

    // ⛔ AND THE CLINIC MUST NOT BE TOLD TO COLLECT THE NEW FIGURE. The report
    // is what a therapist actually reads on the day.
    const owner = await pageAs(browser, "owner");
    const response = await owner.context.request.get(
      `/admin/reports/export?report=booking_list&range=custom&from=${VISIT_DATE}&to=${VISIT_DATE}`,
      { timeout: 120_000 },
    );
    const csv = await response.text();
    await owner.context.close();

    expect(response.status(), "the Owner's export should work").toBe(200);

    const row = csvRowFor(csv, earlyBookingId);
    expect(
      row,
      `⛔ the booking is missing from the Owner's own report for ${VISIT_DATE} entirely, so the ` +
        `clinic would not know to turn up. It said: ${csv.slice(0, 400)}`,
    ).not.toBeNull();
    expect(
      Number(row!.total_price),
      `⛔ THE CLINIC'S OWN REPORT SHOWS THE WRONG PRICE for a visit booked at £${oldPrice.toFixed(2)}. ` +
        `The therapist reads this on the day and would collect £${row!.total_price} at the door.`,
    ).toBe(oldPrice);
    expect(
      Number(row!.total_price),
      `⛔ THE CLINIC'S REPORT IS SHOWING THE NEW PRICE for a visit booked at the old one.`,
    ).not.toBe(Number(RAISED_PRICE));

    console.log(
      `[F4] step 3 — protected: the earlier booking is byte-for-byte unchanged, still £` +
        `${oldPrice.toFixed(2)} on the row AND on the snapshot, and the Owner's report for ` +
        `${VISIT_DATE} still shows £${oldPrice.toFixed(2)} rather than £${RAISED_PRICE}.`,
    );
  });

  test("step 4 — ⛔ AND THE RISE REALLY HAPPENED: a new booking costs the new price", async () => {
    expect(earlyBookingId, "step 1 must have run").not.toBe("");

    // ⛔ THE CONTROL FOR STEP 3. Without this, a Save button that did nothing
    // would leave the old booking untouched too — and this scenario would
    // report that as customer protection.
    const laterBookingId = await bookAt("F4LATER", "14:00:00");
    const money = await moneyFor(laterBookingId);

    expect(
      money.total,
      `⛔ THE PRICE RISE NEVER REACHED NEW BOOKINGS. A booking made after the rise still costs ` +
        `£${money.total.toFixed(2)}, so the Owner cannot actually change their prices — and step 3 ` +
        `proved nothing.`,
    ).toBe(Number(RAISED_PRICE));
    expect(money.due, "the new booking must owe the new price").toBe(Number(RAISED_PRICE));
    expect(
      money.snapshot,
      "the new booking must snapshot the new price",
    ).toBe(Number(RAISED_PRICE));

    // ⛔ And the earlier one STILL has not moved.
    expect(
      (await moneyFor(earlyBookingId)).snapshot,
      "⛔ making a second booking disturbed the first one's price",
    ).toBe(oldPrice);

    console.log(
      `[F4] step 4 — the rise is real: a booking made after it costs £${RAISED_PRICE}, while the ` +
        `earlier one is still £${oldPrice.toFixed(2)}. Two customers, two prices, each the one they ` +
        `were quoted.`,
    );
  });

  test("step 5 — ⛔ AND THE OLD PRICE COMES BACK, EXACTLY", async ({ browser }) => {
    expect(oldPrice, "step 1 must have run").toBeGreaterThan(0);

    const { context, page } = await pageAs(browser, "owner");
    await setPriceOnScreen(page, oldPrice.toFixed(2));
    await context.close();

    await waitForPrice(oldPrice);

    // ⛔ THE WHOLE ROW, not just the price — a restore that quietly changed the
    // duration or took the service off sale would be worse than the rise.
    const now = await readServiceRow();
    for (const key of ["price", "duration_mins", "name", "is_active", "slug"] as const) {
      expect(
        String(now[key]),
        `⛔ restoring the price changed ${key}: was ${String(serviceBefore[key])}, now ${String(now[key])}`,
      ).toBe(String(serviceBefore[key]));
    }

    // ⛔ AND THE ROW BEING RIGHT IS NOT THE SAME AS THE CLINIC SELLING AT IT.
    const restoredBookingId = await bookAt("F4BACK", "16:00:00");
    expect(
      (await moneyFor(restoredBookingId)).total,
      `⛔ the price is back in the database but a new booking is still being charged the raised ` +
        `figure — the clinic would keep overcharging.`,
    ).toBe(oldPrice);

    // ⛔ And the original customer, after the whole round trip, is still exactly
    // where they started.
    expect(
      (await moneyFor(earlyBookingId)).snapshot,
      "⛔ the round trip disturbed the very booking this scenario exists to protect",
    ).toBe(oldPrice);

    console.log(
      `\n[F4] COMPLETE. ${SERVICE_NAME}: £${oldPrice.toFixed(2)} -> £${RAISED_PRICE} -> ` +
        `£${oldPrice.toFixed(2)}. The customer who booked first kept the price they were quoted ` +
        `throughout — on the booking, on the snapshot and in the Owner's report — while a booking ` +
        `made during the rise correctly cost £${RAISED_PRICE}, and new bookings are back to ` +
        `£${oldPrice.toFixed(2)}.\n`,
    );
  });
});
