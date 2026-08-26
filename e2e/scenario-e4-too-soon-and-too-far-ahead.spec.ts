// ⛔ GATE 08 — P4, FAMILY E, SCENARIO E4: TOO SOON, AND TOO FAR AHEAD.
//   ⛔ THE LAST SCENARIO IN FAMILY E.
//
//   ⛔ The Owner's question: "Do my notice period and my how-far-ahead setting
//    actually hold?"
//
// ── ⛔ WHY THE BACK DOOR IS THE HALF THAT MATTERS ────────────────────────
//
// A greyed-out cell in a calendar proves the SCREEN behaves. It proves nothing
// about the RULE. A customer who bookmarks a link, an old tab, a script, or a
// bot posts straight to `/api/bookings/` and never sees the calendar at all —
// and the clinic would find out by somebody turning up.
//
// ⛔ THIS RUN HAS ALREADY BEEN BITTEN BY EXACTLY THAT. The comment inside
// `create_booking_request` says so in as many words: `booking_status_enabled`
// and `minimum_notice_hours` "were honoured by the read engine … but had ZERO
// references here, so a hand-crafted POST bypassed both" (fixed 2026-08-17,
// run ref F2). ⚠️ So this scenario is not hypothetical caution — it is a
// regression guard on a hole that was really open.
//
// Both rules are therefore checked at BOTH layers:
//   • the read layer — what the engine offers and what the calendar lets a
//     customer click;
//   • ⛔ the write layer — what `POST /api/bookings/` actually accepts.
//
// ── ⛔ WHY A REFUSAL IS WORTHLESS WITHOUT AN ACCEPTANCE ──────────────────
//
// Every "it was refused" assertion here would also pass against a booking
// endpoint that was simply broken, or rate-limited, or pointed at a dead
// database. ⛔ So step 4 spends REAL EMAIL to prove the opposite case: the last
// day the window allows is genuinely SELLABLE. Without that, steps 2 and 3
// prove nothing at all.
//
// ⛔ EMAIL COST: THREE REAL SENDS, ONCE, in step 4 — and the Owner approved
// them explicitly before this file was run. They are:
//     1. the customer confirmation  -> thefoolmarketing@outlook.com (the test inbox)
//     2. the business notification  -> rahmatherapy@outlook.com  ⚠️ THE REAL INBOX
//     3. the business notification  -> phase10.owner@example.test (undeliverable)
// ⚠️ Number 2 is unavoidable for any booking-shaped scenario: `Minhaj rahman`
// is a real Owner with business notifications switched on, and suppressing him
// would mean editing the live clinic's notification settings to run a test.
//
// ── ⛔ TWO THINGS THAT WOULD MAKE A REFUSAL LIE ──────────────────────────
//
//  1. ⛔ THE RATE LIMITER. `/api/bookings/` allows 5 posts per 10 minutes and 10
//     per day. This file posts THREE. A 429 is ALSO a non-200 with an `error`,
//     so a status-only assertion would read "the booking was refused" and be
//     completely wrong. ⛔ Every refusal here is matched on the EXACT message,
//     and a 429 is caught first and reported as "wait ten minutes and re-run",
//     never as a result. ⚠️ Re-running this file inside 10 minutes WILL trip it.
//
//  2. ⛔ THE WRONG REASON. A date can be refused for being beyond the window, or
//     for being a Sunday, or for having no therapist free. Reading only "it was
//     refused" would credit the window rule for a closure. ⛔ The messages the
//     database raises are distinct and are asserted verbatim:
//       'Booking date exceeds the booking window'
//       'This time is inside the minimum notice window.'
//     ⚠️ Both of those checks run BEFORE any availability check in
//     `create_booking_request`, which is what makes the reason unambiguous even
//     when the moment is also outside opening hours.
//
// ── ⛔ THE NOTICE EDGE IS CLOCK-DEPENDENT, AND THIS FILE SAYS SO ─────────
//
// The notice window only ever covers the next few hours, so how tightly the
// READ layer can be pinned depends on what time the run happens:
//   • run in the working day  -> today still has sellable times, and the engine
//     can be seen drawing the line exactly at now + notice;
//   • run in the evening      -> the clinic is already shut, so there is nothing
//     left today for the notice to remove, and the read-layer check is true but
//     loose.
// ⛔ Either way the WRITE layer carries the proof, and step 5 REPORTS WHICH ONE
// IT GOT rather than quietly passing a weaker test as a stronger one.
//
// ── ⛔ CLEANING UP ───────────────────────────────────────────────────────
//
// ⚠️ A REFUSED booking still writes something: `route.ts` records a
// `failed_booking_creation` operational event, and it passes NO booking id — so
// the row lands with `booking_id` NULL and NOTHING in `destroyScenarioFixtures`
// could ever find it (G11's exact trap, in a new place). This file therefore
// records which `operational_events` existed before it started and removes
// exactly the difference, the same technique E3 used for audit rows.
//
// ⛔ EMAIL COST: THREE, in step 4 only. Steps 1, 2, 3 and 5 spend nothing.

import { expect, test, type Locator, type Page } from "@playwright/test";
import { format, parseISO } from "date-fns";
import {
  RUN_TAG,
  destroyScenarioFixtures,
  expectOwnerNeverAssigned,
  readBooking,
  serviceClient,
  testInbox,
  waitForEmailEvents,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

/**
 * A date N days from today, in LONDON terms.
 *
 * ⛔ Written here rather than reused, deliberately. `isoDaysFromToday` builds
 * its answer with `toISOString()`, which is UTC — so between 23:00 and midnight
 * British Summer Time it returns TOMORROW'S date. Everywhere else in the suite
 * that is harmless; here the whole scenario is an argument about an exact day
 * boundary, and being one day out would make it test the wrong edge and pass.
 */
function businessDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekdayOf(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const clientIds: string[] = [];
/** Operational-event ids that existed before this run — the rest are ours. */
let opsIdsBefore = new Set<string>();

let windowDays = 0;
let noticeHours = 0;
let lastDay = "";
let beyondWindow = "";
let sellableTime = "";
let acceptedBookingId = "";
/** What step 5 was actually able to pin down, reported not assumed. */
let noticeReadLayer = "";

type BookingReply = { status: number; body: Record<string, unknown> };

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  const db = serviceClient();
  const problems: string[] = [];

  // ⛔ THE REFUSALS' DEBRIS. A rejected booking writes a
  // `failed_booking_creation` operational event with a NULL booking id, so it
  // is unreachable by every sweep in `destroyScenarioFixtures`. Left behind, it
  // sits on the Owner's operations page as a permanent unexplained error.
  if (opsIdsBefore.size > 0) {
    const { data: opsNow } = await db.from("operational_events").select("id");
    const ours = ((opsNow ?? []) as { id: string }[])
      .map((r) => r.id)
      .filter((id) => !opsIdsBefore.has(id));
    if (ours.length > 0) {
      const { error } = await db.from("operational_events").delete().in("id", ours);
      if (error) problems.push(`could not remove this run's operational events: ${error.message}`);
      const { data: left } = await db.from("operational_events").select("id").in("id", ours);
      if ((left ?? []).length) {
        problems.push(
          `${(left ?? []).length} operational_events rows survived — they would sit on the ` +
            `Owner's operations page as permanent errors about bookings that never existed`,
        );
      }
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
    throw new Error(`⛔ E4 TEARDOWN LEFT PRODUCTION DIRTY:\n  - ${problems.join("\n  - ")}`);
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
  expect(
    response.status,
    `⛔ the availability endpoint refused a plain question about ${date}`,
  ).toBe(200);
  const payload = (await response.json()) as { slots?: { time: string }[] };
  return (payload.slots ?? []).map((slot) => slot.time).sort();
}

/**
 * Post a booking exactly as the public website does.
 *
 * ⛔ `email` decides whether this costs anything. An `@probe.invalid` address is
 * undeliverable, so a REFUSED post spends nothing; the one post that is meant
 * to succeed uses the real test inbox.
 */
async function postBooking(opts: {
  date: string;
  time: string;
  label: string;
  email: string;
}): Promise<BookingReply> {
  const response = await fetch(`${process.env.E2E_BASE_URL}/api/bookings/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedPackageIds: ["hijama-package"],
      preferredDate: opts.date,
      preferredTime: opts.time,
      details: {
        bookingFor: "self",
        fullName: opts.label,
        phone: "07700900303",
        email: opts.email,
        notes: "",
        healthNotes: "",
        clientGender: "female",
        numberOfPeople: 1,
        participantGenders: ["female"],
        participantNames: [],
        participantNotes: [],
        consentAcknowledged: true,
        paymentAcknowledged: true,
        manageAcknowledged: true,
        postcode: "LU1 1AA",
        address: "1 ZZTEST Street",
        city: "Luton",
        area: "Bedfordshire",
        accessNotes: "",
        parkingNotes: "",
      },
    }),
  });

  const body = (await response.json()) as Record<string, unknown>;

  // ⛔ CAUGHT FIRST, ALWAYS. A 429 is a non-200 carrying an `error`, exactly
  // like a rule refusal — and it means this file learned NOTHING, not that the
  // rule held. Reported as an instruction, never as a result.
  const message = typeof body.error === "string" ? body.error : "";
  if (response.status === 429 || /Too many booking attempts/i.test(message)) {
    throw new Error(
      `⛔ THE BOOKING RATE LIMITER STOPPED THIS RUN, so nothing below was tested. ` +
        `/api/bookings/ allows 5 posts per 10 minutes and this file uses 3. ` +
        `Wait ten minutes and run it again. It said: "${message}"`,
    );
  }

  return { status: response.status, body };
}

/**
 * Walk the real public booking dialog as far as its calendar and STOP.
 * ⛔ Never submits — the calendar is all this needs, and submitting here would
 * spend email the Owner did not approve.
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
  await dialog.getByLabel(/Main contact name/i).fill(`ZZTEST-E4-LOOKING-${RUN_TAG}`);
  await dialog.getByLabel(/Phone \/ WhatsApp number/i).fill("07700900304");
  await dialog.getByLabel(/Email address/i).fill(testInbox("e4looking"));
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
 * ⛔ Built with the SAME formatter react-day-picker used to write the label
 * (`format(date, "PPPP")`), so it cannot drift into matching nothing and being
 * reported as a missing date (G12). Returns null when the calendar genuinely
 * cannot reach the date — which, for a date beyond the window, is a PASS.
 */
async function findDayCell(page: Page, dialog: Locator, date: string): Promise<Locator | null> {
  const label = format(parseISO(date), "PPPP");
  const cell = dialog.locator(`button[aria-label*="${label}"]`);

  // ⛔ BOUNDED (G3). Three hops covers the whole 29-day window from any day of
  // any month.
  for (let hop = 0; hop < 3; hop += 1) {
    if ((await cell.count()) > 0) return cell.first();
    const next = dialog.getByRole("button", { name: /Go to the Next Month/i });
    if ((await next.count()) === 0 || !(await next.first().isEnabled())) break;
    await next.first().click();
    await page.waitForTimeout(3_000);
  }
  return (await cell.count()) > 0 ? cell.first() : null;
}

test.describe("E4 — too soon and too far ahead: do the notice period and the booking window hold?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ the control: the last allowed day is on sale, the day after is not", async () => {
    const db = serviceClient();

    // ⛔ THE SETTINGS ARE READ, NEVER ASSUMED. Hard-coding 4 and 29 would make
    // this scenario silently test the wrong edge the day the Owner changes them.
    const { data: settings, error: settingsError } = await db
      .from("business_settings")
      .select("*")
      .eq("id", 1)
      .single();
    expect(settingsError?.message ?? "", "could not read the business settings").toBe("");

    const row = settings as { booking_window_days: number; minimum_notice_hours: number };
    windowDays = row.booking_window_days;
    noticeHours = row.minimum_notice_hours;
    expect(windowDays, "the booking window must be a real number of days").toBeGreaterThan(0);
    expect(noticeHours, "the minimum notice must be a real number of hours").toBeGreaterThan(0);

    lastDay = businessDate(windowDays);
    beyondWindow = businessDate(windowDays + 1);

    // Everything new in this table afterwards is this run's debris.
    const { data: opsRows, error: opsError } = await db.from("operational_events").select("id");
    expect(opsError?.message ?? "", "could not read the operations log").toBe("");
    opsIdsBefore = new Set(((opsRows ?? []) as { id: string }[]).map((r) => r.id));

    // ⛔ THE BOUNDARY DAY MUST BE A WORKING DAY. If it lands on a Sunday there
    // is no acceptance to prove and the whole scenario would rest on refusals,
    // which prove nothing on their own. Told plainly rather than worked around.
    expect(
      weekdayOf(lastDay),
      `⛔ the last day inside the booking window (${lastDay}) is a SUNDAY, when the clinic is ` +
        `shut, so it cannot be used as the "this one IS allowed" control. Re-run this scenario ` +
        `on a different day of the week.`,
    ).not.toBe(0);

    const lastDayTimes = await offeredTimes(lastDay);
    expect(
      lastDayTimes.length,
      `⛔ THE CONTROL FAILED. ${lastDay} is the LAST day the ${windowDays}-day booking window ` +
        `allows and the clinic offers nothing on it, so a refusal one day later would prove ` +
        `nothing about the window.`,
    ).toBeGreaterThan(0);
    sellableTime = lastDayTimes[0];

    const beyondTimes = await offeredTimes(beyondWindow);
    expect(
      beyondTimes,
      `⛔ THE BOOKING WINDOW IS NOT HELD BY THE ENGINE. ${beyondWindow} is ${windowDays + 1} days ` +
        `away, past a ${windowDays}-day window, and these times are on sale: ${beyondTimes.join(", ")}`,
    ).toEqual([]);

    console.log(
      `[E4] step 1 — control: window ${windowDays} days, notice ${noticeHours}h. ${lastDay} (the ` +
        `last allowed day) offers ${lastDayTimes.length} times from ${sellableTime}; ` +
        `${beyondWindow} offers none.`,
    );
  });

  test("step 2 — ⛔ the CALENDAR draws the line in the same place", async ({ browser }) => {
    expect(lastDay, "step 1 must have run").not.toBe("");

    const context = await browser.newContext();
    const page = await context.newPage();
    const dialog = await openPublicCalendar(page);

    const lastCell = await findDayCell(page, dialog, lastDay);
    const lastEnabled = lastCell ? await lastCell.isEnabled() : false;
    const beyondCell = await findDayCell(page, dialog, beyondWindow);
    // ⛔ A date beyond the window may be absent OR present-and-disabled — both
    // are correct, and both are unbookable. What must never be true is
    // present-and-clickable (G3: presence is not enabled).
    const beyondEnabled = beyondCell ? await beyondCell.isEnabled() : false;
    await context.close();

    expect(
      lastCell,
      `⛔ ${lastDay} is inside the ${windowDays}-day window and the calendar cannot even reach it`,
    ).not.toBeNull();
    expect(
      lastEnabled,
      `⛔ THE CALENDAR AND THE ENGINE DISAGREE. ${lastDay} is the last day the window allows and ` +
        `the engine sells times on it, but a customer cannot click it.`,
    ).toBe(true);
    expect(
      beyondEnabled,
      `⛔ THE CALENDAR LETS A CUSTOMER PICK ${beyondWindow}, which is past the ${windowDays}-day ` +
        `booking window.`,
    ).toBe(false);

    console.log(
      `[E4] step 2 — the calendar agrees: ${lastDay} is clickable, ${beyondWindow} is ` +
        `${beyondCell ? "shown but disabled" : "not reachable at all"}.`,
    );
  });

  test("step 3 — ⛔ THE BACK DOOR: both rules refuse, each for its OWN reason", async () => {
    expect(lastDay, "step 1 must have run").not.toBe("");
    const db = serviceClient();

    const { count: bookingsBefore } = await db
      .from("bookings")
      .select("id", { count: "exact", head: true });

    // ── Too far ahead ────────────────────────────────────────────────────
    const farAhead = await postBooking({
      date: beyondWindow,
      time: sellableTime,
      label: `ZZTEST-E4-FAR-${RUN_TAG}`,
      // ⛔ Undeliverable on purpose: this post is MEANT to fail, and must cost
      // nothing even if it unexpectedly succeeds.
      email: `zztest-e4-far-${RUN_TAG}@probe.invalid`,
    });

    expect(
      farAhead.status,
      `⛔ THE BOOKING WINDOW DOES NOT HOLD AT THE BACK DOOR. A plain POST booked ` +
        `${beyondWindow}, ${windowDays + 1} days away. The calendar refuses it and the server ` +
        `does not — which is the exact hole this run already found and closed once. It replied: ` +
        `${JSON.stringify(farAhead.body)}`,
    ).not.toBe(200);
    expect(
      String(farAhead.body.error ?? ""),
      `⛔ ${beyondWindow} was refused, but NOT for being outside the booking window — so the ` +
        `window rule is still unproven and something else stopped it.`,
    ).toContain("exceeds the booking window");

    // ── Too soon ─────────────────────────────────────────────────────────
    // ⛔ One hour from now, whatever day that falls on. The notice check runs
    // BEFORE any availability check in `create_booking_request`, so the reason
    // is unambiguous even when this moment is also outside opening hours.
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    const soonDate = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(soon.getDate()).padStart(2, "0")}`;
    const tooSoon = await postBooking({
      date: soonDate,
      time: hhmm(soon),
      label: `ZZTEST-E4-SOON-${RUN_TAG}`,
      email: `zztest-e4-soon-${RUN_TAG}@probe.invalid`,
    });

    expect(
      tooSoon.status,
      `⛔ THE MINIMUM NOTICE DOES NOT HOLD AT THE BACK DOOR. A plain POST booked ` +
        `${soonDate} ${hhmm(soon)}, one hour away, against a ${noticeHours}-hour notice period. ` +
        `It replied: ${JSON.stringify(tooSoon.body)}`,
    ).not.toBe(200);
    expect(
      String(tooSoon.body.error ?? ""),
      `⛔ that time was refused, but NOT for being inside the minimum notice window — so the ` +
        `notice rule is still unproven.`,
    ).toContain("inside the minimum notice window");

    // ⛔ AND NEITHER REFUSAL MAY HAVE WRITTEN A BOOKING. A rule that rejects the
    // request but leaves a half-made row behind would put a visit in the diary
    // that the customer was told did not happen.
    const { count: bookingsAfter } = await db
      .from("bookings")
      .select("id", { count: "exact", head: true });
    expect(
      bookingsAfter,
      `⛔ a REFUSED booking still created a row: ${bookingsBefore} bookings before, ` +
        `${bookingsAfter} after.`,
    ).toBe(bookingsBefore);

    console.log(
      `[E4] step 3 — the back door holds: ${beyondWindow} refused with "${farAhead.body.error}"; ` +
        `${soonDate} ${hhmm(soon)} refused with "${tooSoon.body.error}"; no booking row written.`,
    );
  });

  test("step 4 — ✅ THE CONTROL THAT COSTS: the last allowed day really is sellable", async () => {
    expect(sellableTime, "step 1 must have run").not.toBe("");
    const db = serviceClient();

    // ⛔ THE ONE POST IN THIS FILE THAT IS MEANT TO SUCCEED, and the only one
    // that spends anything: three real sends, approved by the Owner. Without
    // it, every refusal above would also pass against a booking endpoint that
    // simply did not work.
    const accepted = await postBooking({
      date: lastDay,
      time: sellableTime,
      label: `ZZTEST-E4-EDGE-${RUN_TAG}`,
      email: testInbox("e4edge"),
    });

    expect(
      accepted.status,
      `⛔ THE LAST DAY INSIDE THE WINDOW WAS REFUSED. ${lastDay} is exactly ${windowDays} days ` +
        `away and the setting allows ${windowDays}, so the clinic is losing its last bookable ` +
        `day — an off-by-one at the boundary. It replied: ${JSON.stringify(accepted.body)}`,
    ).toBe(200);

    acceptedBookingId = String(accepted.body.bookingId ?? "");
    expect(acceptedBookingId, "the server should return the new booking's reference").toBeTruthy();

    const booking = await readBooking(db, acceptedBookingId);
    clientIds.push(String(booking.client_id));

    expect(booking.booking_date, "the booking must land on the day that was asked for").toBe(lastDay);
    expect(booking.booking_source, "it must be recorded as a website booking").toBe("website");
    expect(booking.status, "a website booking arrives as a request, not a confirmation").toBe(
      "pending",
    );
    await expectOwnerNeverAssigned(db, acceptedBookingId);

    console.log(
      `[E4] step 4 — sellable: ${lastDay} ${sellableTime} was ACCEPTED (booking ` +
        `${acceptedBookingId.slice(0, 8)}…), so the refusals in step 3 were about the rules and ` +
        `not about a broken front door.`,
    );
  });

  test("step 5 — ⛔ the three emails really went, and the notice line at the read layer", async () => {
    expect(acceptedBookingId, "step 4 must have run").not.toBe("");
    const db = serviceClient();

    // ⛔ SPENDING THE EMAIL IS NOT THE SAME AS SENDING IT. The Owner paid for
    // three messages; this is where they are shown to have left the building.
    // ⚠️ Success is `accepted`, NOT `sent` — `failed` and `skipped` live in the
    // same table, so the STATUS is asserted, never the row's existence.
    const events = await waitForEmailEvents(db, acceptedBookingId, 3);
    const byType = events.map((e) => `${e.event_type}:${e.delivery_status}`).sort();

    expect(
      events.length,
      `⛔ the booking was accepted but did not produce the three expected messages. Got: ` +
        `${byType.join(", ") || "(none)"}`,
    ).toBeGreaterThanOrEqual(3);
    expect(
      events.filter((e) => e.delivery_status === "failed"),
      `⛔ a booking-creation email FAILED: ${events
        .filter((e) => e.delivery_status === "failed")
        .map((e) => `${e.event_type} -> ${e.to_email}: ${e.error_message}`)
        .join(" | ")}`,
    ).toEqual([]);
    expect(
      events.some(
        (e) => e.event_type === "booking_confirmation" && e.delivery_status === "accepted",
      ),
      `⛔ the CUSTOMER's confirmation did not go. That is the message whose absence makes people ` +
        `not turn up. Got: ${byType.join(", ")}`,
    ).toBe(true);
    expect(
      events.some(
        (e) => e.event_type === "admin_booking_notification" && e.delivery_status === "accepted",
      ),
      `⛔ the CLINIC was never told about the booking. Got: ${byType.join(", ")}`,
    ).toBe(true);

    // ── ⛔ The notice line, at the read layer, as tightly as the clock allows ──
    //
    // The notice window only ever covers the next few hours, so whether there
    // is anything left for it to remove depends on the time of day. Both
    // outcomes are reported honestly rather than one passing as the other.
    const now = new Date();
    const earliestAllowed = new Date(now.getTime() + noticeHours * 60 * 60 * 1000);
    const offending: string[] = [];
    let sellableToday = 0;

    for (const offset of [0, 1]) {
      const date = businessDate(offset);
      const times = await offeredTimes(date);
      if (offset === 0) sellableToday = times.length;
      for (const time of times) {
        const [h, m] = time.split(":").map(Number);
        const [y, mo, d] = date.split("-").map(Number);
        const moment = new Date(y, mo - 1, d, h, m, 0, 0);
        if (moment < earliestAllowed) offending.push(`${date} ${time}`);
      }
    }

    expect(
      offending,
      `⛔ THE ENGINE IS OFFERING TIMES INSIDE THE ${noticeHours}-HOUR NOTICE WINDOW: ` +
        `${offending.join(", ")}. The earliest it should offer is ` +
        `${businessDate(0)} ${hhmm(earliestAllowed)}.`,
    ).toEqual([]);

    noticeReadLayer =
      sellableToday > 0
        ? `TIGHT — today still had ${sellableToday} sellable times and none of them was inside the window`
        : `LOOSE — the clinic was already shut for today (run at ${hhmm(now)}), so the notice had ` +
          `nothing left to remove and only the back door proved it`;

    console.log(
      `\n[E4] COMPLETE. Window: ${lastDay} sells and was BOOKED, ${beyondWindow} is refused by ` +
        `the calendar AND the server ("exceeds the booking window"). Notice: a time one hour out ` +
        `is refused by the server ("inside the minimum notice window"); read layer ` +
        `${noticeReadLayer}. Three real emails spent and all accepted.\n`,
    );
  });
});
