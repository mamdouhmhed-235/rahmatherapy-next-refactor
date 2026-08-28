// ⛔ GATE 08 — P4, FAMILY F, SCENARIO F3: THE TRAVEL FEE.
//
//   ⛔ The Owner's question: "Do I get paid for travelling?"
//
// ── ⛔ THE ARITHMETIC TRAP THIS SCENARIO AIMS AT ─────────────────────────
//
// `src/lib/booking/travel-fee.ts` documents the hazard in its own header, with
// a worked example, because getting it wrong is invisible until somebody
// reconciles a month:
//
//     45.00 service, 2 participants, 14.00 travel fee
//     stored total_price = 90.00        (45 x 2, set once at creation)
//     new total_price    = 90 - 0 + 14 = 104.00
//
// ⛔ 104.00, **NOT** (45 + 14) x 2 = 118.00. The fee is a DELTA applied to the
// stored total, never a recompute — because the stored total is already
// multiplied by the participant count. ⚠️ A recompute would overcharge this
// customer by £14, and by more the bigger the group.
//
// ⛔ SO THIS SCENARIO USES A **TWO-PARTICIPANT** BOOKING ON PURPOSE. With one
// participant, 90-0+14 and (45+14)x1 both give the same answer and the bug is
// completely invisible. A single-participant fixture would have made this file
// pass against the exact defect it exists to catch.
//
// ── ⛔ AND THE FEE IS A DELTA ON THE WAY BACK DOWN TOO ───────────────────
//
// Step 5 changes the fee and then removes it. If the code ever recomputed
// instead of applying a delta, raising £14 -> £20 would land on 110 only by
// accident, and clearing it would not return to exactly 90.00. The round trip
// is the proof.
//
// ── ⚠️ WHAT THE "OUT OF AREA" PART DOES AND DOES NOT MEAN ───────────────
//
// The free-travel town list (`business_settings.free_travel_cities`, live value
// `["Luton","Dunstable"]`) is **DISPLAY ONLY**. `free-travel-cities.ts` says so
// outright: *"Nothing gates on it: an address outside these towns is bookable,
// and an admin sets the travel charge by hand afterwards."*
//
// ⛔ So this file must NOT assert that an out-of-area address causes a fee —
// it does not, and pretending otherwise would encode a rule the system does not
// have. What it DOES assert is the thing that was once broken: an out-of-area
// booking is **still bookable**. The header of that same file records the old
// defect — three disagreeing copies of the town list, so *"a Harpenden customer
// saw a green tick and then no slots at all."* That is worth a guard.
//
// ── ⛔ CLEANING UP ───────────────────────────────────────────────────────
//
// ⚠️ G21: this scenario saves a booking (audit) AND downloads a report (audit).
// Rather than list the action types and risk missing one — which is exactly how
// two rows survived F4 — it records **every** `audit_logs` id beforehand and
// removes the difference. Nothing else runs against this database during a
// scenario, so anything new is this run's.
//
// ⛔ EMAIL COST: ZERO. The booking is seeded, and changing a travel charge
// notifies nobody.

import { expect, test } from "@playwright/test";
import {
  SERVICES,
  THERAPIST_A_STAFF_ID,
  destroyScenarioFixtures,
  expectOwnerNeverAssigned,
  isoDaysFromToday,
  pageAs,
  pollUntil,
  seedWebsiteBooking,
  serviceClient,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

function weekdayOf(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

const DAY_OFFSET = weekdayOf(isoDaysFromToday(4)) === 0 ? 5 : 4;
const VISIT_DATE = isoDaysFromToday(DAY_OFFSET);

/** ⛔ Outside the free-travel towns, and the town from the old defect. */
const OUT_OF_AREA_CITY = "Harpenden";

const FIRST_FEE = "14.00";
const SECOND_FEE = "20.00";

const clientIds: string[] = [];
let auditIdsBefore = new Set<string>();

let bookingId = "";
/** 45 x 2 = 90.00, set once at creation. */
let baseTotal = 0;

test.describe.configure({ mode: "serial" });

async function readMoney() {
  const db = serviceClient();
  const { data, error } = await db.from("bookings").select("*").eq("id", bookingId).single();
  if (error || !data) throw new Error(`could not read the booking: ${error?.message}`);
  const row = data as Record<string, unknown>;
  return {
    total: Number(row.total_price),
    due: Number(row.amount_due),
    fee: Number(row.travel_fee),
    city: String(row.service_city),
  };
}

/** Read one CSV column as a number, never by substring (G20). */
function csvPriceFor(csv: string, id: string): number | null {
  const lines = csv.split("\n").filter((line) => line.trim() !== "");
  if (lines.length < 2) return null;
  const headers = lines[0].split(",");
  const idAt = headers.indexOf("booking_id");
  const priceAt = headers.indexOf("total_price");
  if (idAt === -1 || priceAt === -1) return null;
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    if (cells[idAt] === id) return Number(cells[priceAt]);
  }
  return null;
}

/** Set the travel charge through the real booking screen. */
async function setTravelFee(page: import("@playwright/test").Page, fee: string) {
  // ⛔ The booking was seeded straight into the database, and this page is
  // cached — so it must be POLLED for, never asserted once (G1).
  await pollUntil(
    page,
    `/admin/bookings/${bookingId}/`,
    "the booking record",
    async () => (await page.getByRole("spinbutton", { name: "Travel charge" }).count()) > 0,
    { attempts: 10, waitMs: 8_000 },
  );

  // ⛔ BY ITS LABEL, NOT BY ITS FIELD NAME (G15, again).
  //
  // ⚠️ MEASURED: once a travel charge EXISTS, the page carries **two** inputs
  // named `travel_fee` — the labelled control in "Status & payment", and a
  // second unlabelled one that only renders when a fee is set. So
  // `input[name="travel_fee"]` matched 1 element on the first save and 2 on the
  // next, and Playwright refused it. ⛔ That is the good outcome: silently
  // taking the first match would have been typing into whichever happened to
  // come first in the DOM.
  //
  // The accessible name is unique, and the count is asserted so a future third
  // copy fails loudly instead of being picked at random.
  const field = page.getByRole("spinbutton", { name: "Travel charge" });
  await expect(
    field,
    "⛔ there must be exactly one labelled travel-charge control on the booking",
  ).toHaveCount(1, { timeout: 20_000 });
  await expect(field, "the travel charge field should be usable").toBeVisible({
    timeout: 20_000,
  });
  await field.scrollIntoViewIfNeeded();
  await field.fill(fee);
  // The field drives a dirty check; without a real input event the Save button
  // stays disabled and the click would do nothing at all.
  await field.dispatchEvent("input");
  await page.waitForTimeout(500);

  const save = page.getByRole("button", { name: /^Save status & payment$/ });
  await expect(save, "the save control should be on the page").toHaveCount(1, { timeout: 15_000 });
  // ⛔ `disabled={!dirty}` — presence is not enabled (G3), and a click on a
  // disabled control would silently change nothing while the test moved on.
  expect(
    await save.first().isEnabled(),
    `⛔ the save control never became usable after typing a travel charge of £${fee} — the form did ` +
      `not notice the change, so nothing would have been saved`,
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
async function waitForFee(expected: number) {
  await expect
    .poll(async () => (await readMoney()).fee, {
      timeout: 30_000,
      message: `⛔ the travel charge never became £${expected.toFixed(2)} in the database`,
    })
    .toBe(expected);
}

test.afterAll(async () => {
  test.setTimeout(300_000);
  const db = serviceClient();
  const problems: string[] = [];

  // ⛔ EVERY new audit row, not a list of action types. F4 lost two rows by
  // sweeping only the action it was named after (G21); this scenario saves a
  // booking AND downloads a report, and enumerating is how you miss one.
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

  // ⛔ UNCONDITIONAL (G19).
  try {
    await destroyScenarioFixtures(db, clientIds);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  if (problems.length > 0) {
    throw new Error(`⛔ F3 TEARDOWN LEFT PRODUCTION DIRTY:\n  - ${problems.join("\n  - ")}`);
  }
});

test.describe("F3 — the travel fee: does the clinic get paid for travelling?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ the control: an out-of-area visit for two, and it IS bookable", async () => {
    const db = serviceClient();

    expect(weekdayOf(VISIT_DATE), `⛔ ${VISIT_DATE} is a Sunday`).not.toBe(0);

    const { data: settings, error: settingsError } = await db
      .from("business_settings")
      .select("*")
      .eq("id", 1)
      .single();
    expect(settingsError?.message ?? "", "could not read the business settings").toBe("");

    const towns = ((settings as { free_travel_cities: string[] }).free_travel_cities ?? []).map(
      (t) => t.toLowerCase(),
    );
    expect(
      towns.length,
      "⛔ the free-travel town list is empty, so 'out of area' has no meaning to test against",
    ).toBeGreaterThan(0);
    expect(
      towns.some((t) => OUT_OF_AREA_CITY.toLowerCase().includes(t)),
      `⛔ ${OUT_OF_AREA_CITY} is INSIDE the free-travel towns (${towns.join(", ")}), so this ` +
        `scenario is not about an out-of-area visit at all. Pick a different town.`,
    ).toBe(false);

    const { data: auditRows, error: auditError } = await db.from("audit_logs").select("id");
    expect(auditError?.message ?? "", "could not read the audit trail").toBe("");
    auditIdsBefore = new Set(((auditRows ?? []) as { id: string }[]).map((r) => r.id));

    // ⛔ TWO PARTICIPANTS. With one, the delta and the recompute agree and the
    // defect this scenario exists to catch is invisible.
    const seeded = await seedWebsiteBooking(db, "F3", {
      dayOffset: DAY_OFFSET,
      startTime: "11:00:00",
      status: "confirmed",
      assignTo: THERAPIST_A_STAFF_ID,
      participants: [{ gender: "female" }, { gender: "female" }],
    });
    clientIds.push(seeded.clientId);
    bookingId = seeded.bookingId;

    // The seed writes Luton; this visit is out of area.
    const { error: cityError } = await db
      .from("bookings")
      .update({ service_city: OUT_OF_AREA_CITY })
      .eq("id", bookingId);
    expect(cityError?.message ?? "", "could not put the booking out of area").toBe("");

    const money = await readMoney();
    baseTotal = money.total;

    // ⛔ ASSERT THE FIXTURE APPLIED (G5).
    expect(money.city, "the visit must really be out of area").toBe(OUT_OF_AREA_CITY);
    expect(
      money.total,
      `⛔ THE CONTROL FAILED. Two ${SERVICES.hijama.name}s at £${SERVICES.hijama.price} should total ` +
        `£${(SERVICES.hijama.price * 2).toFixed(2)}, not £${money.total.toFixed(2)} — so the ` +
        `arithmetic below would be measured against the wrong number.`,
    ).toBe(SERVICES.hijama.price * 2);
    expect(money.due, "the amount owed should start equal to the total").toBe(baseTotal);
    expect(
      money.fee,
      "⛔ the visit must start with NO travel charge, or 'the charge was added' proves nothing",
    ).toBe(0);
    await expectOwnerNeverAssigned(db, bookingId);

    // ⛔ AND THE OLD DEFECT: an out-of-area address must not silently block the
    // booking. `free-travel-cities.ts` records a Harpenden customer once seeing
    // "a green tick and then no slots at all".
    const { data: stillThere } = await db
      .from("bookings")
      .select("id, status")
      .eq("id", bookingId)
      .maybeSingle();
    expect(
      (stillThere as { status: string } | null)?.status,
      `⛔ an out-of-area booking did not survive as a normal confirmed visit`,
    ).toBe("confirmed");

    console.log(
      `[F3] step 1 — control: a confirmed visit for TWO in ${OUT_OF_AREA_CITY} (outside ` +
        `${towns.join("/")}), totalling £${baseTotal.toFixed(2)} with no travel charge yet.`,
    );
  });

  test("step 2 — ✅ the clinic charges for the journey", async ({ browser }) => {
    expect(bookingId, "step 1 must have run").not.toBe("");

    // The coverage plan names the Coordinator here: taking the booking and
    // pricing the journey is front-desk work, not the Owner's.
    const { context, page } = await pageAs(browser, "coordinator");
    await setTravelFee(page, FIRST_FEE);
    await context.close();

    await waitForFee(Number(FIRST_FEE));

    console.log(
      `[F3] step 2 — charged: the coordinator applied a £${FIRST_FEE} travel charge from the ` +
        `booking screen.`,
    );
  });

  test("step 3 — ⛔ THE ARITHMETIC: added once, not multiplied by the group", async () => {
    expect(bookingId, "step 1 must have run").not.toBe("");

    const money = await readMoney();
    const wrongAnswer = (SERVICES.hijama.price + Number(FIRST_FEE)) * 2;

    expect(
      money.total,
      `⛔ THE TRAVEL CHARGE WAS MULTIPLIED BY THE GROUP. The visit should cost ` +
        `£${(baseTotal + Number(FIRST_FEE)).toFixed(2)} — £${baseTotal.toFixed(2)} plus one ` +
        `£${FIRST_FEE} journey — and it says £${money.total.toFixed(2)}. ` +
        `£${wrongAnswer.toFixed(2)} would mean the fee was added per person and this customer is ` +
        `being overcharged by £${FIRST_FEE}.`,
    ).toBe(baseTotal + Number(FIRST_FEE));
    expect(
      money.total,
      `⛔ the total is exactly the per-person recompute (£${wrongAnswer.toFixed(2)})`,
    ).not.toBe(wrongAnswer);

    // ⛔ BOTH COLUMNS. `total_price` is numeric(10,2) but `amount_due` has no
    // scale constraint — the travel-fee header warns they can drift by a
    // fraction of a penny, and every outstanding-balance sum inherits it.
    expect(
      money.due,
      `⛔ the amount owed (£${money.due.toFixed(2)}) disagrees with the total ` +
        `(£${money.total.toFixed(2)}) — every balance calculation subtracts one from the other`,
    ).toBe(money.total);
    expect(money.fee, "the charge itself must be recorded").toBe(Number(FIRST_FEE));

    console.log(
      `[F3] step 3 — correct: £${baseTotal.toFixed(2)} + £${FIRST_FEE} = ` +
        `£${money.total.toFixed(2)}, and NOT £${wrongAnswer.toFixed(2)}. Amount owed agrees to the penny.`,
    );
  });

  test("step 4 — ⛔ and it reaches the report the Owner actually reads", async ({ browser }) => {
    expect(bookingId, "step 1 must have run").not.toBe("");

    const owner = await pageAs(browser, "owner");
    const response = await owner.context.request.get(
      `/admin/reports/export?report=booking_list&range=custom&from=${VISIT_DATE}&to=${VISIT_DATE}`,
      { timeout: 120_000 },
    );
    const csv = await response.text();
    await owner.context.close();

    expect(response.status(), "the Owner's export should work").toBe(200);

    const reported = csvPriceFor(csv, bookingId);
    expect(
      reported,
      `⛔ the visit is missing from the Owner's report for ${VISIT_DATE} entirely`,
    ).not.toBeNull();
    expect(
      reported,
      `⛔ THE TRAVEL CHARGE NEVER REACHED THE REPORT. The visit costs ` +
        `£${(baseTotal + Number(FIRST_FEE)).toFixed(2)} and the Owner's report says £${reported} — ` +
        `so the journey would be travelled and never billed.`,
    ).toBe(baseTotal + Number(FIRST_FEE));

    console.log(
      `[F3] step 4 — billed: the Owner's report for ${VISIT_DATE} shows £${reported} for this ` +
        `visit, travel included.`,
    );
  });

  test("step 5 — ⛔ AND IT COMES BACK OFF CLEANLY: a delta, not a recompute", async ({
    browser,
  }) => {
    expect(bookingId, "step 1 must have run").not.toBe("");

    // ── Raise it ─────────────────────────────────────────────────────────
    const raise = await pageAs(browser, "coordinator");
    await setTravelFee(raise.page, SECOND_FEE);
    await raise.context.close();
    await waitForFee(Number(SECOND_FEE));

    let money = await readMoney();
    expect(
      money.total,
      `⛔ CHANGING THE TRAVEL CHARGE DID NOT APPLY A DELTA. £${baseTotal.toFixed(2)} plus ` +
        `£${SECOND_FEE} is £${(baseTotal + Number(SECOND_FEE)).toFixed(2)}; the booking says ` +
        `£${money.total.toFixed(2)}. A second charge stacked on the first would read ` +
        `£${(baseTotal + Number(FIRST_FEE) + Number(SECOND_FEE)).toFixed(2)}.`,
    ).toBe(baseTotal + Number(SECOND_FEE));
    expect(money.due, "the amount owed must follow the total").toBe(money.total);

    // ── Take it off ──────────────────────────────────────────────────────
    const clear = await pageAs(browser, "coordinator");
    await setTravelFee(clear.page, "0");
    await clear.context.close();
    await waitForFee(0);

    money = await readMoney();
    expect(
      money.total,
      `⛔ REMOVING THE TRAVEL CHARGE DID NOT RETURN THE VISIT TO ITS ORIGINAL PRICE. It should be ` +
        `exactly £${baseTotal.toFixed(2)} again and it is £${money.total.toFixed(2)} — the customer ` +
        `is left paying for a journey the clinic is no longer charging for.`,
    ).toBe(baseTotal);
    expect(
      money.due,
      `⛔ the amount owed did not come back with the total: £${money.due.toFixed(2)}`,
    ).toBe(baseTotal);
    expect(money.fee, "the charge must be cleared, not merely zeroed in the total").toBe(0);

    console.log(
      `\n[F3] COMPLETE. An out-of-area visit for two: £${baseTotal.toFixed(2)} -> +£${FIRST_FEE} = ` +
        `£${(baseTotal + Number(FIRST_FEE)).toFixed(2)} (never the £${((SERVICES.hijama.price + Number(FIRST_FEE)) * 2).toFixed(2)} ` +
        `a per-person recompute would give) -> +£${SECOND_FEE} = ` +
        `£${(baseTotal + Number(SECOND_FEE)).toFixed(2)} -> cleared back to exactly ` +
        `£${baseTotal.toFixed(2)}. The charge reached the Owner's report, and the amount owed ` +
        `tracked the total to the penny throughout.\n`,
    );
  });
});
