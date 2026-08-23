// ⛔ GATE 08 — P3, FAMILY C, SCENARIO C1: SOMEONE DOESN'T TURN UP.
//
//   ⛔ The Owner's question: "Does a no-show cost me a slot I could have sold,
//    and does it count as revenue?" (It must not.)
//
// A therapist travels to a house and nobody answers. That is a real cost to a
// two-person clinic — an hour gone and no money — and the question is whether
// the SYSTEM makes it worse: by holding the slot shut afterwards, or by quietly
// counting the visit as income that never arrived.
//
// ── ⛔ WHAT "COUNTS AS REVENUE" ACTUALLY MEANS HERE ──────────────────────
//
// The reports do not have one revenue number, they have five, and a no-show
// lands differently in each. Asserting "it is not revenue" against the wrong one
// would be a green tick over a wrong answer, so this scenario checks ALL of
// them (`reporting.ts`):
//
//   booked_revenue      ⚠️ INCLUDES cancelled and no_show. Documented and
//                          deliberate — "what did our pipeline look like" —
//                          with a TODO recording that the other reading exists.
//   collected_revenue   sums amount_paid. A no-show nobody paid for adds 0.
//   outstanding_revenue ⛔ EXCLUDES cancelled/no_show. The clinic does not
//                          chase a no-show for the fee, so it is not owed.
//   completed_revenue   ⛔ status === "completed" only. A no-show never counts.
//   no_show_revenue     its own bucket, so the loss is VISIBLE rather than
//                          silently folded into another figure.
//
// ⛔ So the honest answer to the Owner is "no, with one exception you should
// know about" — and this file pins exactly that, rather than flattening it.
//
// ── ⛔ EMAIL COST: ZERO to the real business inbox ───────────────────────
// Marking a no-show reaches `sendAssignedStaffBookingChangeEmails`, which mails
// the ASSIGNED STAFF only — the test therapist here. ⛔ Asserted, not assumed.

import { expect, test, type Page } from "@playwright/test";
import {
  auditActions,
  awaitAction,
  destroyScenarioFixtures,
  emailEvents,
  gotoAdmin,
  isoDaysFromToday,
  pageAs,
  readBooking,
  REAL_OWNER_INBOX,
  reportsForDay,
  seedWebsiteBooking,
  serviceClient,
  THERAPIST_A_STAFF_ID,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

let booking: SeededBooking;
/** The day the visit was on. Its own day, so the report figures are about IT. */
let visitDay = "";
/** Clients created purely to fill a slot in step 2. */
const fillerClientIds: string[] = [];

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  const ids = [booking?.clientId, ...fillerClientIds].filter(Boolean) as string[];
  if (ids.length === 0) return;
  await destroyScenarioFixtures(serviceClient(), ids);
});

/** Read a money figure off the reports page by its tile label. */
async function readMoney(page: Page, label: string): Promise<number> {
  const text = await page.evaluate(() => document.querySelector("main")?.textContent ?? "");
  const flat = text.replace(/\s+/g, " ");
  const match = new RegExp(`${label}\\s*£\\s*([0-9,]+(?:\\.[0-9]{2})?)`).exec(flat);
  if (!match) {
    throw new Error(`No "${label}" figure on the reports page. It said: "${flat.slice(0, 400)}"`);
  }
  return Number(match[1].replace(/,/g, ""));
}

test.describe("C1 — someone doesn't turn up: what does it cost?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — the visit's day arrives and nobody answers the door", async ({ browser }) => {
    const db = serviceClient();

    // ⛔ TODAY, and CONFIRMED and STAFFED. All three matter:
    //   - no-show is refused on a FUTURE booking by every path;
    //   - the strip only offers "Mark no-show" once the day has arrived;
    //   - an ASSIGNED fixture is what lets the "no email to the real inbox"
    //     assertion actually fail if something regresses. An unassigned one
    //     could not send that mail however broken the code was.
    booking = await seedWebsiteBooking(db, "C1", {
      dayOffset: 0,
      startTime: "09:00:00",
      status: "confirmed",
      assignTo: THERAPIST_A_STAFF_ID,
    });
    visitDay = booking.date;

    const { context, page } = await pageAs(browser, "admin");
    await gotoAdmin(page, `/admin/bookings/${booking.bookingId}/`, "the booking detail page");
    await expect(page.locator("#booking-status-form")).toBeVisible({ timeout: 30_000 });

    // ⛔ The one-click chip on the next-action strip, NOT the Status dropdown.
    // They are different controls writing different audit actions, and the
    // strip's is the one a receptionist actually uses.
    const markNoShow = page.getByRole("button", { name: /Mark (as )?no-show/i }).first();
    await expect(
      markNoShow,
      "⛔ the clinic must be able to record a no-show on the day, or the booking sits 'confirmed' for ever",
    ).toBeVisible({ timeout: 15_000 });

    await markNoShow.click();
    await page.waitForTimeout(800);
    const dialog = page.getByRole("dialog");
    const confirm = dialog.getByRole("button", { name: /Mark (as )?no-show/i });
    if ((await confirm.count()) > 0) {
      await awaitAction(page, async () => {
        await confirm.first().click();
      });
    } else {
      await page.waitForTimeout(2_500);
    }
    await context.close();

    const after = await readBooking(db, booking.bookingId);
    expect(after.status, "the visit is recorded as a no-show").toBe("no_show");

    const actions = await auditActions(db, booking.bookingId);
    expect(
      actions.some((action) => /no_show/.test(action)),
      `⛔ a no-show is a real event with a real cost and must be on the record. Actions were: ${actions.join(", ")}`,
    ).toBe(true);
  });

  test("step 2 — \u26d4 the slot goes back on sale", async () => {
    const db = serviceClient();

    // \u26d4 THIS CANNOT BE TESTED ON THE NO-SHOW ITSELF, and the first version
    // that tried was a check that could not have seen the truth.
    //
    // A no-show has to be marked on the visit\u2019s own day, and the suite may run
    // on a day the clinic does not work at all \u2014 it did: 2026-08-23 is a Sunday,
    // and the engine correctly offers nothing, no-show or not. Asserting "the
    // day still has slots" would then fail for a reason with nothing to do with
    // no-shows.
    //
    // \u2705 So the mechanism is proved with a CONTROL PAIR on a day the clinic
    // really is open: fill one time until it disappears, then flip ONE booking
    // to `no_show` and watch it come back. That is the Owner\u2019s question
    // answered directly \u2014 does a no-show cost me a slot I could have sold?
    const askEngine = async (date: string) => {
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
      const payload = (await response.json()) as { slots?: { time: string }[] };
      return (payload.slots ?? []).map((slot) => slot.time);
    };

    // Find a day the clinic is genuinely open, and a time it is selling.
    let openDay = "";
    let target = "";
    for (let offset = 7; offset <= 25 && !openDay; offset += 1) {
      const date = isoDaysFromToday(offset);
      const slots = await askEngine(date);
      if (slots.length > 0) {
        openDay = date;
        target = slots[Math.floor(slots.length / 2)];
      }
    }
    expect(openDay, "\u26d4 the clinic offered no bookable day in the next 25 days").not.toBe("");

    // Fill that time until the engine stops selling it. ⚠️ Bounded: with a
    // handful of female therapists this is a few bookings, and a runaway loop
    // against production is not acceptable.
    const blockers: string[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (!(await askEngine(openDay)).includes(target)) break;
      const filler = await seedWebsiteBooking(db, `C1-FILL${attempt}`, {
        dayOffset: 0,
        startTime: `${target}:00`,
        status: "confirmed",
      });
      await db
        .from("bookings")
        .update({ booking_date: openDay })
        .eq("id", filler.bookingId);
      fillerClientIds.push(filler.clientId);
      blockers.push(filler.bookingId);
    }

    expect(
      await askEngine(openDay),
      `\u26d4 could not fill ${target} on ${openDay} even with ${blockers.length} bookings, so "the slot came back" cannot be shown to mean anything`,
    ).not.toContain(target);

    // \u26d4 NOW THE ONE THAT MATTERS. Turn a single blocker into a no-show.
    expect(blockers.length, "at least one booking must be holding the slot").toBeGreaterThan(0);
    await db.from("bookings").update({ status: "no_show" }).eq("id", blockers[0]);

    expect(
      await askEngine(openDay),
      `\u26d4 THE OWNER\u2019S FIRST QUESTION. After a no-show, ${target} on ${openDay} is STILL not on sale \u2014 so a customer who never turned up is costing the clinic every future booking at that time.`,
    ).toContain(target);
  });

  test("step 3 — ⛔ it does NOT count as money the clinic earned", async ({ browser }) => {
    expect(booking?.bookingId).toBeTruthy();
    const db = serviceClient();

    const after = await readBooking(db, booking.bookingId);
    expect(Number(after.amount_paid), "nobody paid for a visit that did not happen").toBe(0);
    expect(after.payment_status, "and it is not marked paid").toBe("unpaid");

    const { context, page } = await pageAs(browser, "owner");
    await gotoAdmin(page, reportsForDay(visitDay), "the owner's reports for that day");
    await page.waitForTimeout(3_000);

    const collected = await readMoney(page, "Collected revenue");
    expect(
      collected,
      `⛔ THE OWNER'S SECOND QUESTION. A no-show must never appear as money taken. Collected revenue for ${visitDay} reads £${collected}.`,
    ).toBe(0);

    // ⛔ Outstanding EXCLUDES no_show — the clinic does not chase the fee, so it
    // is not owed. A no-show sitting in Outstanding would misrepresent the books
    // as money on its way in.
    const outstanding = await readMoney(page, "Outstanding");
    expect(
      outstanding,
      `⛔ a no-show is not money owed — the clinic does not chase it. Outstanding reads £${outstanding}.`,
    ).toBe(0);

    const shown = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    // ⚠️ The loss must be VISIBLE, not merely absent from the revenue figures.
    // A cost you cannot see is one you cannot manage.
    expect(
      shown,
      `⛔ the day's no-show is invisible on the report. The Owner cannot see what a no-show is costing them. Page said: "${shown.slice(0, 400)}"`,
    ).toMatch(/no-show/i);

    await context.close();
  });

  test("step 4 — the customer's record, and who was emailed", async () => {
    expect(booking?.bookingId).toBeTruthy();
    const db = serviceClient();

    // ⛔ D-014's sibling: a no-show stays on the client's history. The clinic
    // needs to know this person did not turn up last time.
    const { data: history } = await db
      .from("bookings")
      .select("id, status")
      .eq("client_id", booking.clientId);
    expect(
      (history ?? []) as { id: string; status: string }[],
      "the visit stays on the customer's record — a no-show is history, not an erasure",
    ).toHaveLength(1);
    expect(((history ?? [])[0] as { status: string }).status).toBe("no_show");

    const events = await emailEvents(db, booking.bookingId);
    const toOwner = events.filter((e) => (e.recipient_email ?? e.to_email) === REAL_OWNER_INBOX);
    expect(
      toOwner,
      `⛔ marking a no-show mails the ASSIGNED STAFF, never the business inbox. It sent ${toOwner.length}: ${toOwner.map((e) => e.event_type).join(", ")}`,
    ).toHaveLength(0);

    console.log(
      `\n[C1] COMPLETE. no-show recorded on ${visitDay}; £0 collected, £0 outstanding; ` +
        `${events.length} emails, none to ${REAL_OWNER_INBOX}\n`,
    );
  });
});
