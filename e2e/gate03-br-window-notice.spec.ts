// ⛔ GATE 03 — LANE BR (part 1): PAUSE-FREE WINDOW AND NOTICE RULES.
//   Cases BR-03 · BR-04 · BR-05 · BR-06 · BR-07 · BR-08 · BR-09,
//   plus the RPC half of PA-03 · PA-04 · PA-05 · PA-06.
//
// ⛔ AUTHORED, NOT RUN. Gate 03's authoring pass wrote this file and did NOT
// execute it — every case here WRITES, and writes were deferred to Wave 3
// (Owner decision D22). Nothing below has a measured verdict yet.
//
// ── ⛔ WHY THIS FILE DRIVES THE RPC AND NOT A BROWSER ─────────────────────
//
// The rules under test live inside `public.create_booking_request`, not in a
// screen. A greyed-out calendar cell proves the SCREEN behaves; it proves
// nothing about what a hand-crafted POST is allowed to do. This run has already
// been bitten by exactly that gap — `booking_status_enabled` and
// `minimum_notice_hours` "were honoured by the read engine … but had ZERO
// references here, so a hand-crafted POST bypassed both" (the function's own
// comment, fixed 2026-08-17). So this file calls the function the way both
// doors call it, exactly as `e2e/scenario-c2-full-day.spec.ts` step 3 does.
//
// ⛔ CALLING THE RPC DIRECTLY SENDS NO EMAIL. The send path lives in
// `src/app/api/bookings/route.ts`, above the RPC. That is why the contact
// addresses here are `@probe.invalid` — the same choice C2 makes — and why this
// file costs nothing to run. ⚠️ If a future edit routes any case through
// `POST /api/bookings/`, it starts spending real messages and the header must
// say so.
//
// ── ⛔ EVERY ACCEPTED BOOKING IS A REAL ROW IN A LIVE CLINIC'S DATABASE ────
//
// Teardown is UNCONDITIONAL and is never gated on having captured an id
// (GOTCHA G19: an aborted request still creates the booking, so the case where
// you have no id is precisely the case that needs the sweep).
//
// ── ⛔ WHAT THIS FILE DELIBERATELY DOES NOT DO ────────────────────────────
//
// It changes NO setting. `minimum_notice_hours` (4) and `booking_window_days`
// (29) are READ from `business_settings` and the cases are built around
// whatever they say, so the file keeps testing the real edge if the Owner moves
// them. BR-01, BR-02, BR-21, BR-22 and BR-24 need a setting changed and live in
// `gate03-settings-gated.spec.ts` behind an explicit opt-in.

import { expect, test } from "@playwright/test";
import {
  RUN_TAG,
  destroyScenarioFixtures,
  serviceClient,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const clientIds: string[] = [];
/** `operational_events` ids that existed before this file ran. */
let opsIdsBefore = new Set<string>();

let windowDays = 0;
let noticeHours = 0;

function zz(label: string) {
  return `ZZTEST-G03-${label}-${RUN_TAG}`;
}

/**
 * A date N days from today in LONDON terms.
 *
 * ⛔ Written here rather than reusing `isoDaysFromToday`, which builds its
 * answer with `toISOString()` (UTC) and therefore returns TOMORROW between
 * 23:00 and midnight BST. Every case in this file is an argument about an exact
 * day boundary; being one day out would test the wrong edge and pass.
 */
function businessDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function weekdayOf(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

/** The first non-Sunday at or after `offset`, because Sunday is CLOSED. */
function firstWorkingDayFrom(offset: number, limit = 10) {
  for (let i = offset; i < offset + limit; i += 1) {
    if (weekdayOf(businessDate(i)) !== 0) return businessDate(i);
  }
  throw new Error("no working day found — impossible unless the week changed");
}

/** London wall-clock `HH:MM:SS` for `now + hours`. */
function londonTimePlusHours(hours: number) {
  const at = new Date(Date.now() + hours * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}:00`;
}

/** The London calendar date of `now + hours`. */
function londonDatePlusHours(hours: number) {
  const at = new Date(Date.now() + hours * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * The RPC's arguments, spelled exactly as the deployed function declares them.
 *
 * ⚠️ Several are NOT-NULL text with no default. Omitting one comes back as
 * "function public.create_booking_request(...) does not exist", which reads like
 * the RPC is missing rather than mis-called.
 */
function bookingArgs(opts: {
  label: string;
  date: string;
  time: string;
  source?: string;
  override?: boolean;
  genders?: ("male" | "female")[];
  slugs?: string[];
}) {
  const name = zz(opts.label);
  return {
    p_service_slugs: opts.slugs ?? ["massage-30"],
    p_contact_full_name: name,
    p_contact_email: `${name.toLowerCase()}@probe.invalid`,
    p_contact_phone: "07700900301",
    p_customer_notes: "",
    p_health_notes: "",
    p_consent_acknowledged: true,
    p_service_address_line1: "1 ZZTEST Street",
    p_service_city: "Luton",
    p_service_postcode: "LU1 1AA",
    p_access_notes: "",
    p_booking_date: opts.date,
    p_start_time: opts.time,
    p_participant_genders: opts.genders ?? ["female"],
    p_booking_source: opts.source ?? "website",
    p_override_availability: opts.override ?? false,
  };
}

type RpcOutcome = { bookingId: string | null; message: string | null };

async function callRpc(
  db: ReturnType<typeof serviceClient>,
  args: ReturnType<typeof bookingArgs>,
): Promise<RpcOutcome> {
  const { data, error } = await db.rpc("create_booking_request", args);
  if (error) return { bookingId: null, message: error.message };
  const bookingId = String((data as { bookingId?: string })?.bookingId ?? "");
  if (bookingId) {
    const { data: row } = await db
      .from("bookings")
      .select("client_id")
      .eq("id", bookingId)
      .single();
    const clientId = (row as { client_id?: string } | null)?.client_id;
    if (clientId) clientIds.push(clientId);
  }
  return { bookingId: bookingId || null, message: null };
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const db = serviceClient();
  const { data: settings, error } = await db
    .from("business_settings")
    .select("booking_window_days, minimum_notice_hours")
    .eq("id", 1)
    .single();
  expect(error?.message ?? "", "could not read the business settings").toBe("");
  const row = settings as { booking_window_days: number; minimum_notice_hours: number };
  windowDays = row.booking_window_days;
  noticeHours = row.minimum_notice_hours;
  expect(windowDays, "the booking window must be a real number of days").toBeGreaterThan(0);
  expect(noticeHours, "the minimum notice must be a real number of hours").toBeGreaterThan(0);

  // Everything new in this table afterwards is this run's debris.
  const { data: opsRows } = await db.from("operational_events").select("id");
  opsIdsBefore = new Set(((opsRows ?? []) as { id: string }[]).map((r) => r.id));
});

test.afterAll(async () => {
  test.setTimeout(300_000);
  const db = serviceClient();
  const problems: string[] = [];

  // ⛔ THE REFUSALS' DEBRIS. A rejected booking through the HTTP route writes a
  // `failed_booking_creation` operational event with a NULL booking id, so it is
  // unreachable by every sweep in `destroyScenarioFixtures`. This file calls the
  // RPC directly and so should write none — the sweep is here because "should"
  // is not "did".
  if (opsIdsBefore.size > 0) {
    const { data: opsNow } = await db.from("operational_events").select("id");
    const ours = ((opsNow ?? []) as { id: string }[])
      .map((r) => r.id)
      .filter((id) => !opsIdsBefore.has(id));
    if (ours.length > 0) {
      const { error } = await db.from("operational_events").delete().in("id", ours);
      if (error) problems.push(`could not remove this run's operational events: ${error.message}`);
    }
  }

  // ⛔ UNCONDITIONAL (G19). `destroyScenarioFixtures` finds strays by the
  // run-tagged name prefix, so it works even when this file never learned an id.
  try {
    await destroyScenarioFixtures(db, clientIds, { prefix: `ZZTEST-G03-%-${RUN_TAG}` });
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  if (problems.length > 0) {
    throw new Error(`⛔ GATE-03 BR/WINDOW TEARDOWN LEFT PRODUCTION DIRTY:\n  - ${problems.join("\n  - ")}`);
  }
});

test.describe("Gate 03 · BR-03…BR-09 — notice, window and past dates on the WRITE path", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the gate-03 write lanes.");

  test("BR-04 — the control: a request comfortably outside the notice window is ACCEPTED", async () => {
    // ⛔ THE CONTROL RUNS FIRST, AND ON PURPOSE. Every refusal below would also
    // pass against an RPC that was simply broken, or against a slot nobody can
    // staff. Without a proven acceptance, BR-03 and BR-09 prove nothing at all.
    const db = serviceClient();
    const date = firstWorkingDayFrom(7);
    const outcome = await callRpc(db, bookingArgs({ label: "BR04", date, time: "12:00:00" }));

    expect(
      outcome.message,
      `⛔ THE CONTROL FAILED. A plain booking ${date} 12:00 was refused: "${outcome.message}". ` +
        `Nothing else in this file means anything until this passes.`,
    ).toBeNull();
    expect(outcome.bookingId, "the control should have created a real booking").toBeTruthy();
    console.log(`[BR-04] control accepted ${date} 12:00 -> ${outcome.bookingId}`);
  });

  test("BR-03 / PA-03 — a request inside the minimum notice window is REFUSED on `website`", async () => {
    const db = serviceClient();
    // now + (notice - 1) hours: inside the window by exactly one hour.
    const hoursInside = Math.max(1, noticeHours - 1);
    const date = londonDatePlusHours(hoursInside);
    const time = londonTimePlusHours(hoursInside);

    // ⛔ SUNDAY WOULD REFUSE FOR THE WRONG REASON. Told plainly rather than
    // worked around — a case that passes for a reason it did not test is worse
    // than one that is skipped.
    test.skip(
      weekdayOf(date) === 0,
      `the notice edge lands on a Sunday (${date}), when the clinic is shut, so a refusal ` +
        `would not be evidence about the notice rule. Re-run on another day.`,
    );

    const outcome = await callRpc(db, bookingArgs({ label: "BR03", date, time }));

    expect(
      outcome.bookingId,
      `⛔ THE WRITE PATH ACCEPTED A BOOKING ${hoursInside}h away with a ${noticeHours}h notice ` +
        `rule. A customer could book a visit nobody can get to.`,
    ).toBeNull();
    expect(outcome.message).toContain("minimum notice");
    console.log(`[BR-03] refused ${date} ${time} (${hoursInside}h away): "${outcome.message}"`);
  });

  test("BR-05 — the same instant is ACCEPTED when staff are entering it (`admin`)", async () => {
    // ⛔ D6. The notice and pause gates are keyed on `p_booking_source`, NOT on
    // `p_override_availability`. Pausing intake must never block the Owner's own
    // same-day phone booking.
    const db = serviceClient();
    const hoursInside = Math.max(1, noticeHours - 1);
    const date = londonDatePlusHours(hoursInside);
    const time = londonTimePlusHours(hoursInside);

    test.skip(
      weekdayOf(date) === 0,
      `the notice edge lands on a Sunday (${date}); the clinic is shut and this would refuse for ` +
        `a reason that has nothing to do with booking source.`,
    );

    const outcome = await callRpc(
      db,
      bookingArgs({ label: "BR05", date, time, source: "admin" }),
    );

    expect(
      outcome.message,
      `⛔ STAFF INTAKE WAS BLOCKED BY THE CUSTOMER NOTICE RULE. A receptionist taking a same-day ` +
        `call could not record it: "${outcome.message}"`,
    ).toBeNull();
    expect(outcome.bookingId).toBeTruthy();
    console.log(`[BR-05] admin source accepted ${date} ${time} -> ${outcome.bookingId}`);
  });

  test("BR-06 — a PAST date is refused EVEN WITH the availability override", async () => {
    // ⛔ This is the case that proves the date guards sit ABOVE the override
    // block rather than inside it. If it ever passes, the override has become a
    // way to write history.
    const db = serviceClient();
    const yesterday = businessDate(-1);
    const outcome = await callRpc(
      db,
      bookingArgs({ label: "BR06", date: yesterday, time: "12:00:00", override: true }),
    );

    expect(
      outcome.bookingId,
      `⛔ THE OVERRIDE WROTE A BOOKING INTO THE PAST (${yesterday}). The date guards have moved ` +
        `below the override block.`,
    ).toBeNull();
    expect(outcome.message).toContain("Booking date must be today or later");
    console.log(`[BR-06] refused ${yesterday} under override: "${outcome.message}"`);
  });

  test("BR-07 / PA-05 — the LAST day inside the booking window is accepted", async () => {
    const db = serviceClient();
    const lastDay = businessDate(windowDays);

    test.skip(
      weekdayOf(lastDay) === 0,
      `the last day inside the ${windowDays}-day window (${lastDay}) is a SUNDAY, when the clinic ` +
        `is shut, so it cannot be the "this one IS allowed" control. Re-run on another day.`,
    );

    const outcome = await callRpc(
      db,
      bookingArgs({ label: "BR07", date: lastDay, time: "12:00:00" }),
    );
    expect(
      outcome.message,
      `⛔ the last legal day of the window was refused: "${outcome.message}"`,
    ).toBeNull();
    expect(outcome.bookingId).toBeTruthy();
    console.log(`[BR-07] accepted ${lastDay} (today + ${windowDays})`);
  });

  test("BR-08 / PA-04 — the FIRST day beyond the booking window is refused", async () => {
    const db = serviceClient();
    const beyond = businessDate(windowDays + 1);
    const outcome = await callRpc(
      db,
      bookingArgs({ label: "BR08", date: beyond, time: "12:00:00" }),
    );

    expect(
      outcome.bookingId,
      `⛔ THE BOOKING WINDOW IS NOT HELD ON THE WRITE PATH. ${beyond} is ${windowDays + 1} days ` +
        `away, past a ${windowDays}-day window, and it was accepted.`,
    ).toBeNull();
    expect(outcome.message).toContain("Booking date exceeds the booking window");
    console.log(`[BR-08] refused ${beyond}: "${outcome.message}"`);
  });

  test("BR-09 — a past INSTANT on today's date is refused", async () => {
    const db = serviceClient();
    const today = londonDatePlusHours(0);
    const oneHourAgo = londonTimePlusHours(-1);

    // ⛔ Before ~01:00 London this wraps to yesterday and would be caught by the
    // DATE guard (BR-06's rule) rather than the INSTANT guard, which is a
    // different assertion. Say so rather than pass the wrong one.
    test.skip(
      Number(oneHourAgo.slice(0, 2)) >= 23,
      `an hour ago is on the previous London day; BR-09 needs a past instant on TODAY'S date.`,
    );

    const outcome = await callRpc(
      db,
      bookingArgs({ label: "BR09", date: today, time: oneHourAgo }),
    );

    expect(
      outcome.bookingId,
      `⛔ A BOOKING WAS ACCEPTED FOR A TIME THAT HAS ALREADY PASSED (${today} ${oneHourAgo}).`,
    ).toBeNull();
    // ⚠️ Either guard is a correct refusal; the notice rule fires first when the
    // window is wide. Assert that it was refused for a TIME reason, not any reason.
    expect(outcome.message).toMatch(/must be in the future|minimum notice/i);
    console.log(`[BR-09] refused ${today} ${oneHourAgo}: "${outcome.message}"`);
  });

  test("PA-06 — Sunday is CLOSED on the write path too", async () => {
    const db = serviceClient();
    let sunday = "";
    for (let offset = 1; offset <= 14; offset += 1) {
      if (weekdayOf(businessDate(offset)) === 0) {
        sunday = businessDate(offset);
        break;
      }
    }
    expect(sunday, "there is a Sunday in the next fortnight").not.toBe("");

    const outcome = await callRpc(
      db,
      bookingArgs({ label: "PA06", date: sunday, time: "12:00:00" }),
    );

    expect(
      outcome.bookingId,
      `⛔ THE WRITE PATH SOLD A SUNDAY (${sunday}). The clinic is closed; nobody would turn up.`,
    ).toBeNull();
    // No therapist has a window that contains the slot, so capacity is 0.
    expect(outcome.message).toMatch(/Not enough (female|male) therapists available/);
    console.log(`[PA-06] refused Sunday ${sunday}: "${outcome.message}"`);
  });
});
