// ⛔ GATE 03 — LANE BR (part 2): CAPACITY ARITHMETIC AND THE TRAVEL BUFFER.
//   Cases BR-10 · BR-11 · BR-12 · BR-13 · BR-14 · BR-15 · BR-16 · BR-17 ·
//   BR-18 · BR-19 · BR-20 (behavioural half) · BR-23,
//   plus the RPC half of PA-01 · PA-07 · PA-08 · PA-09 · PA-11 · PA-13 · PA-14.
//
// ⛔ AUTHORED, NOT RUN. Gate 03 wrote this file and did NOT execute it. Every
// case here WRITES. Wave 3 owns execution (Owner decision D22).
//
// ── ⛔ THE ONE DESIGN DECISION THAT MATTERS ───────────────────────────────
//
// The PLAN's capacity cases assume a seeded branch with exactly 2 male and 2
// female therapists, so every expected verdict is arithmetic. ⛔ THAT BRANCH
// DOES NOT EXIST and this file runs against PRODUCTION, where the bookable pool
// is whatever the clinic currently employs — and where DEACTIVATING A REAL
// THERAPIST TO MAKE THE ARITHMETIC TIDY IS NOT ACCEPTABLE.
//
// So the pool size is MEASURED, not assumed. Step 1 adds one unassigned female
// reservation at a time until the engine refuses, which yields N — the number of
// female therapists the rules actually consider free at that moment. Every later
// assertion is expressed relative to N, so the file keeps meaning the same thing
// whoever is on the rota.
//
// ⛔ AND THE BUFFER CASES USE RESERVATIONS, NOT STAFF DEACTIVATION. The PLAN's
// BR-16…BR-19 deactivate a therapist to get down to one. Exhausting the pool
// with unassigned reservations reaches the same state and touches no staff row.
// The padded-overlap predicate under test is the SAME one in both the named and
// the unassigned query (they are two copies of one expression, deliberately —
// see the A2 comment in 20260819150206), so a boundary proven through the
// unassigned path is proven for the predicate.
//
// ── ⛔ COST ──────────────────────────────────────────────────────────────
//
// Zero emails: every write here goes through the RPC or a direct insert, and
// the send path lives above both, in `src/app/api/bookings/route.ts`.
// ⚠️ Real rows, though — this file creates and removes bookings in a live
// clinic's database. Teardown is unconditional (G19) and error-checked.

import { expect, test } from "@playwright/test";
import {
  RUN_TAG,
  THERAPIST_A_STAFF_ID,
  destroyScenarioFixtures,
  seedWebsiteBooking,
  serviceClient,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

/** ⛔ 30-minute service, so the times below are exact. Read at run time. */
const SERVICE_SLUG = "massage-30";

const clientIds: string[] = [];
let bufferMins = 0;
let day = "";
/** The measured number of female therapists free at `day` 13:00. */
let femalePool = 0;

function zz(label: string) {
  return `ZZTEST-G03-${label}-${RUN_TAG}`;
}

function businessDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function weekdayOf(iso: string) {
  const [year, month, day_] = iso.split("-").map(Number);
  return new Date(year, month - 1, day_).getDay();
}

function bookingArgs(opts: {
  label: string;
  date: string;
  time: string;
  genders?: ("male" | "female")[];
  override?: boolean;
  source?: string;
  slugs?: string[];
}) {
  const name = zz(opts.label);
  return {
    p_service_slugs: opts.slugs ?? [SERVICE_SLUG],
    p_contact_full_name: name,
    p_contact_email: `${name.toLowerCase()}@probe.invalid`,
    p_contact_phone: "07700900302",
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

type Outcome = { bookingId: string | null; clientId: string | null; message: string | null };

async function callRpc(
  db: ReturnType<typeof serviceClient>,
  args: ReturnType<typeof bookingArgs>,
): Promise<Outcome> {
  const { data, error } = await db.rpc("create_booking_request", args);
  if (error) return { bookingId: null, clientId: null, message: error.message };
  const bookingId = String((data as { bookingId?: string })?.bookingId ?? "");
  let clientId: string | null = null;
  if (bookingId) {
    const { data: row } = await db.from("bookings").select("client_id").eq("id", bookingId).single();
    clientId = (row as { client_id?: string } | null)?.client_id ?? null;
    if (clientId) clientIds.push(clientId);
  }
  return { bookingId: bookingId || null, clientId, message: null };
}

/**
 * ⛔ Remove ONE booking immediately, in foreign-key order, and prove it is gone.
 *
 * Needed because a successful probe is itself an unassigned reservation and
 * would silently consume the capacity the next probe is trying to measure. The
 * client row is left for the end-of-file sweep.
 */
async function removeBooking(db: ReturnType<typeof serviceClient>, bookingId: string) {
  await db.from("booking_assignments").delete().eq("booking_id", bookingId);
  await db.from("booking_items").delete().eq("booking_id", bookingId);
  await db.from("booking_participants").delete().eq("booking_id", bookingId);
  await db.from("audit_logs").delete().eq("target_id", bookingId);
  await db.from("operational_events").delete().eq("booking_id", bookingId);
  const { error } = await db.from("bookings").delete().eq("id", bookingId);
  if (error) throw new Error(`could not remove probe booking ${bookingId}: ${error.message}`);
  const { data: left } = await db.from("bookings").select("id").eq("id", bookingId);
  if ((left ?? []).length) throw new Error(`probe booking ${bookingId} survived deletion`);
}

/**
 * Ask the rules a question WITHOUT changing the answer to the next one:
 * call the RPC and, if it succeeded, remove the row it created straight away.
 */
async function probe(
  db: ReturnType<typeof serviceClient>,
  args: ReturnType<typeof bookingArgs>,
): Promise<{ allowed: boolean; message: string | null }> {
  const outcome = await callRpc(db, args);
  if (outcome.bookingId) await removeBooking(db, outcome.bookingId);
  return { allowed: outcome.bookingId !== null, message: outcome.message };
}

/** One unassigned, pending, female reservation at `date` `time`. */
async function reserveOneFemale(
  db: ReturnType<typeof serviceClient>,
  label: string,
  date: string,
  time: string,
): Promise<SeededBooking> {
  const seeded = await seedWebsiteBooking(db, `G03-${label}`, {
    dayOffset: 0,
    startTime: time,
    status: "pending",
    service: { id: "0ca84b71-4dc1-44fe-ada0-25176c7f283c", name: "30-Min Massage Therapy", price: 40, mins: 30 },
  });
  // `seedWebsiteBooking` builds its date with `isoDaysFromToday`; pin the day
  // explicitly so a late-evening run cannot land it on the wrong date.
  const { error } = await db.from("bookings").update({ booking_date: date }).eq("id", seeded.bookingId);
  if (error) throw new Error(`could not pin the reservation to ${date}: ${error.message}`);
  clientIds.push(seeded.clientId);
  return seeded;
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  test.setTimeout(300_000);
  const db = serviceClient();
  try {
    // ⛔ UNCONDITIONAL and never gated on a captured id (G19).
    await destroyScenarioFixtures(db, clientIds, { prefix: `ZZTEST-G03-%-${RUN_TAG}` });
  } catch (error) {
    throw new Error(
      `⛔ GATE-03 CAPACITY/BUFFER TEARDOWN LEFT PRODUCTION DIRTY:\n  - ` +
        (error instanceof Error ? error.message : String(error)),
    );
  }
});

test.describe("Gate 03 · capacity arithmetic and the buffer", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the gate-03 write lanes.");

  test("step 0 — pick a clear working day and read the live buffer", async () => {
    const db = serviceClient();

    const { data: settings, error } = await db
      .from("business_settings")
      .select("buffer_time_mins")
      .eq("id", 1)
      .single();
    expect(error?.message ?? "", "could not read the business settings").toBe("");
    bufferMins = (settings as { buffer_time_mins: number }).buffer_time_mins;
    expect(bufferMins, "the travel buffer must be a real number of minutes").toBeGreaterThan(0);

    // ⛔ DISCOVERED, NOT ASSUMED. A hard-coded date would be testing a guess,
    // and a Sunday would fail for reasons that have nothing to do with capacity.
    for (let offset = 9; offset <= 20 && !day; offset += 1) {
      const candidate = businessDate(offset);
      if (weekdayOf(candidate) === 0) continue;
      const { data: existing } = await db
        .from("bookings")
        .select("id")
        .eq("booking_date", candidate)
        .in("status", ["pending", "confirmed"]);
      // A day the clinic already has work on would make the arithmetic below
      // depend on someone else's diary.
      if (((existing ?? []) as { id: string }[]).length === 0) day = candidate;
    }
    expect(
      day,
      "⛔ every working day in the next three weeks already has bookings, so the capacity " +
        "arithmetic below could not be attributed to this file. Re-run later, or extend the search.",
    ).not.toBe("");
    console.log(`[step 0] day = ${day} · buffer = ${bufferMins} mins`);
  });

  test("PA-01 / step 1 — the control: one female at 13:00 is accepted on a clear day", async () => {
    const db = serviceClient();
    const result = await probe(db, bookingArgs({ label: "PA01", date: day, time: "13:00:00" }));
    expect(
      result.allowed,
      `⛔ THE CONTROL FAILED. A single female booking on a clear day was refused: ` +
        `"${result.message}". Every refusal below would then prove nothing.`,
    ).toBe(true);
    console.log(`[PA-01] control accepted ${day} 13:00`);
  });

  test("BR-11…BR-14 — reservations consume capacity, one at a time, and do not leak across genders", async () => {
    test.setTimeout(300_000);
    const db = serviceClient();

    // ⛔ MEASURE the pool rather than assume it. Bounded at 8: if eight
    // reservations will not close one slot, the premise is wrong and the file
    // should say so rather than keep writing rows into production.
    let reservations = 0;
    let lastMessage: string | null = null;
    for (let i = 0; i < 8; i += 1) {
      const stillFree = await probe(db, bookingArgs({ label: `CAP${i}`, date: day, time: "13:00:00" }));
      if (!stillFree.allowed) {
        lastMessage = stillFree.message;
        break;
      }
      await reserveOneFemale(db, `RES${i}`, day, "13:00:00");
      reservations += 1;
    }
    femalePool = reservations;

    expect(
      lastMessage,
      `⛔ EIGHT unassigned female reservations did not close 13:00 on ${day}. Either the ` +
        `reservations are not being counted at all — which is the F1 release blocker returning — ` +
        `or the clinic has more than eight bookable female therapists free at once.`,
    ).not.toBeNull();
    expect(
      femalePool,
      "⛔ the day was supposed to be clear, so at least one female must have been free",
    ).toBeGreaterThan(0);

    // BR-11 — with the pool exhausted, one more female is refused.
    expect(lastMessage).toContain("Not enough female therapists available");
    console.log(
      `[BR-11] ${femalePool} unassigned female reservations exhausted 13:00 on ${day}: "${lastMessage}"`,
    );

    // BR-14 — the male pool is untouched by female reservations.
    const male = await probe(
      db,
      bookingArgs({ label: "BR14", date: day, time: "13:00:00", genders: ["male"] }),
    );
    expect(
      male.allowed,
      `⛔ GENDER KEYING LEAKED. Female reservations closed the MALE pool too: "${male.message}"`,
    ).toBe(true);
    console.log(`[BR-14] male request still accepted at the same instant`);

    // BR-12 — release one reservation and the slot reopens for exactly one.
    const { data: mine } = await db
      .from("bookings")
      .select("id")
      .eq("booking_date", day)
      .eq("start_time", "13:00:00")
      .in("status", ["pending", "confirmed"]);
    const ids = ((mine ?? []) as { id: string }[]).map((r) => r.id);
    expect(ids.length, "the reservations this file made should still be there").toBe(femalePool);
    await removeBooking(db, ids[0]);

    const reopened = await probe(db, bookingArgs({ label: "BR12", date: day, time: "13:00:00" }));
    expect(
      reopened.allowed,
      `⛔ releasing one reservation did not reopen the slot: "${reopened.message}"`,
    ).toBe(true);
    console.log(`[BR-12] releasing one reservation reopened 13:00 for exactly one female`);

    // BR-13 — and a group of two is still refused with only one free.
    if (femalePool >= 2) {
      const pair = await probe(
        db,
        bookingArgs({ label: "BR13", date: day, time: "13:00:00", genders: ["female", "female"] }),
      );
      expect(
        pair.allowed,
        `⛔ a group of TWO was accepted with only ONE therapist free. That is an overbooking.`,
      ).toBe(false);
      console.log(`[BR-13] a pair was refused with one free: "${pair.message}"`);
    } else {
      console.log(`[BR-13] skipped — the measured pool was ${femalePool}, so there is no pair case`);
    }
  });

  test("BR-10 — a group of two females is accepted when two are free, with 2 participants, 2 items, 2 assignments", async () => {
    const db = serviceClient();
    test.skip(
      femalePool < 2,
      `only ${femalePool} female therapist(s) were free, so a two-person group has nothing to prove.`,
    );

    // A different hour, so the 13:00 reservations cannot reach it: the buffer is
    // 30 minutes each side, and 16:00 is three hours clear.
    const outcome = await callRpc(
      db,
      bookingArgs({ label: "BR10", date: day, time: "16:00:00", genders: ["female", "female"] }),
    );
    expect(outcome.message, `⛔ a two-person group was refused: "${outcome.message}"`).toBeNull();
    expect(outcome.bookingId).toBeTruthy();

    const bookingId = outcome.bookingId!;
    const [{ data: participants }, { data: items }, { data: assignments }] = await Promise.all([
      db.from("booking_participants").select("id").eq("booking_id", bookingId),
      db.from("booking_items").select("id").eq("booking_id", bookingId),
      db.from("booking_assignments").select("id, assigned_staff_id, status").eq("booking_id", bookingId),
    ]);
    expect(((participants ?? []) as unknown[]).length, "one participant row per person").toBe(2);
    expect(((items ?? []) as unknown[]).length, "one line item per person").toBe(2);
    expect(((assignments ?? []) as unknown[]).length, "one assignment per person").toBe(2);
    for (const row of (assignments ?? []) as { assigned_staff_id: string | null; status: string }[]) {
      expect(row.assigned_staff_id, "a website booking names nobody").toBeNull();
      expect(row.status).toBe("unassigned");
    }

    const { data: booking } = await db
      .from("bookings")
      .select("total_price, amount_due, amount_paid, payment_status, group_booking, end_time, total_duration_mins")
      .eq("id", bookingId)
      .single();
    const row = booking as {
      total_price: number; amount_due: number; amount_paid: number;
      payment_status: string; group_booking: boolean; end_time: string; total_duration_mins: number;
    };
    // ⛔ M-02's arithmetic: the price multiplies by PARTICIPANTS, and the
    // duration does NOT.
    expect(Number(row.total_price)).toBe(80);
    expect(Number(row.amount_due)).toBe(80);
    expect(Number(row.amount_paid)).toBe(0);
    expect(row.payment_status).toBe("unpaid");
    expect(row.group_booking).toBe(true);
    expect(row.total_duration_mins).toBe(30);
    expect(row.end_time.slice(0, 5)).toBe("16:30");
    console.log(`[BR-10] group of two accepted: £${row.total_price}, ends ${row.end_time}`);

    await removeBooking(db, bookingId);
  });

  test("BR-16…BR-19 / PA-07 / PA-08 — the buffer boundary, exactly", async () => {
    test.setTimeout(300_000);
    const db = serviceClient();
    expect(femalePool, "step 1 must have measured the pool").toBeGreaterThan(0);

    // Exhaust the pool at 18:00-18:30 only. 18:00 is at least 90 minutes clear
    // of every other fixture in this file, so nothing else can reach it.
    for (let i = 0; i < femalePool; i += 1) {
      await reserveOneFemale(db, `BUF${i}`, day, "18:00:00");
    }

    // ⛔ THE FIXTURE MUST ACTUALLY BE FULL, or every "deny" below is vacuous.
    const centre = await probe(db, bookingArgs({ label: "BUFC", date: day, time: "18:00:00" }));
    expect(
      centre.allowed,
      `⛔ 18:00 is not full after ${femalePool} reservations, so the boundary results mean nothing`,
    ).toBe(false);

    // With a 30-minute service and a `bufferMins` buffer, the busy window
    // 18:00-18:30 blocks any request whose start < 18:30 + buffer and whose
    // end > 18:00 - buffer.
    const results: Record<string, boolean> = {};
    const times: [string, boolean, string][] = [
      // end == 18:00 - buffer exactly -> `>` is false -> ALLOWED
      [addMinutesTo("18:00", -(bufferMins + 30)), true, "ends exactly on the lower edge"],
      // one step later -> overlaps -> DENIED
      [addMinutesTo("18:00", -bufferMins), false, "ends one buffer inside the lower edge"],
      // starts one minute before the upper edge -> DENIED
      [addMinutesTo("18:30", bufferMins - 1), false, "starts one minute before the upper edge"],
      // starts exactly on the upper edge -> `<` is false -> ALLOWED
      [addMinutesTo("18:30", bufferMins), true, "starts exactly on the upper edge"],
    ];

    for (const [time, expected, why] of times) {
      const result = await probe(db, bookingArgs({ label: `BUF-${time.slice(0, 5)}`, date: day, time }));
      results[time] = result.allowed;
      expect(
        result.allowed,
        `⛔ BUFFER BOUNDARY WRONG at ${time} (${why}): expected ${expected ? "ALLOW" : "DENY"}, ` +
          `got ${result.allowed ? "ALLOW" : "DENY"}${result.message ? ` — "${result.message}"` : ""}`,
      ).toBe(expected);
    }
    console.log(
      `[BR-16…19] buffer ${bufferMins} around 18:00-18:30 -> ` +
        Object.entries(results).map(([t, ok]) => `${t.slice(0, 5)}=${ok ? "allow" : "deny"}`).join(" · "),
    );
  });

  test("BR-20 / PA-13 — the midnight wrap cannot come back", async () => {
    const db = serviceClient();
    expect(day, "step 0 must have chosen a day").not.toBe("");

    // ⛔ THE BEHAVIOURAL HALF of BR-20. A booking at the very end of the day
    // must not, through `time` arithmetic that wraps past midnight, make a
    // midday request look busy. Before 20260819150206 the padded window covered
    // nearly the whole day.
    const lateSeed = await seedWebsiteBooking(db, "G03-WRAP", {
      dayOffset: 0,
      startTime: "23:30:00",
      status: "confirmed",
      assignTo: THERAPIST_A_STAFF_ID,
      service: { id: "0ca84b71-4dc1-44fe-ada0-25176c7f283c", name: "30-Min Massage Therapy", price: 40, mins: 30 },
    });
    clientIds.push(lateSeed.clientId);
    await db
      .from("bookings")
      .update({ booking_date: day, start_time: "23:30:00", end_time: "23:59:00" })
      .eq("id", lateSeed.bookingId);

    // 09:00 is far from every other fixture in this file.
    const midday = await probe(db, bookingArgs({ label: "BR20", date: day, time: "09:00:00" }));
    expect(
      midday.allowed,
      `⛔ THE MIDNIGHT WRAP IS BACK. A 23:30-23:59 booking blocked a 09:00 request: ` +
        `"${midday.message}". The padded overlap has returned to 'time' arithmetic, which wraps.`,
    ).toBe(true);
    console.log(`[BR-20/PA-13] a 23:30-23:59 booking did not block 09:00 on ${day}`);
  });

  test("PA-09 / PA-14 — which busy definitions the WRITE path uses, with a paired control", async () => {
    test.setTimeout(300_000);
    const db = serviceClient();
    expect(femalePool, "step 1 must have measured the pool").toBeGreaterThan(0);

    // 11:00-11:30, clear of everything else. Leave exactly ONE female free by
    // reserving the rest, then name the last one with bookings in three
    // different states and see which of them the RPC treats as busy.
    const time = "11:00:00";
    for (let i = 0; i < femalePool - 1; i += 1) {
      await reserveOneFemale(db, `PA09R${i}`, day, time);
    }

    // ⛔ THE CONTROL FIRST. A CONFIRMED booking named to the last free therapist
    // must close the slot. Without this, "completed did not block" would also be
    // true of a busy-check that never worked at all.
    const control = await seedWebsiteBooking(db, "G03-PA09CTL", {
      dayOffset: 0,
      startTime: time,
      status: "confirmed",
      assignTo: THERAPIST_A_STAFF_ID,
      service: { id: "0ca84b71-4dc1-44fe-ada0-25176c7f283c", name: "30-Min Massage Therapy", price: 40, mins: 30 },
    });
    clientIds.push(control.clientId);
    await db.from("bookings").update({ booking_date: day }).eq("id", control.bookingId);

    const withConfirmed = await probe(db, bookingArgs({ label: "PA09A", date: day, time }));
    expect(
      withConfirmed.allowed,
      `⛔ CONTROL FAILED: a CONFIRMED booking named to the last free therapist did not close the ` +
        `slot. The busy check is not working at all, so nothing below is evidence.`,
    ).toBe(false);

    // PA-09 — the same booking marked COMPLETED must NOT block. Owner ruling
    // 2026-08-19, implemented in 20260819233514.
    await db.from("bookings").update({ status: "completed" }).eq("id", control.bookingId);
    const withCompleted = await probe(db, bookingArgs({ label: "PA09B", date: day, time }));
    expect(
      withCompleted.allowed,
      `⛔ B5 HAS REGRESSED. A COMPLETED booking is blocking its slot again, so the public ` +
        `calendar offers a time the write path then refuses: "${withCompleted.message}"`,
    ).toBe(true);
    console.log(`[PA-09] confirmed = busy · completed = free (as ruled 2026-08-19)`);

    // PA-14 — ⛔ NOT IN THE PLAN. The named-therapist busy check joins
    // `booking_assignments` with NO filter on `ba.status`, while the read engine
    // drops any assignment outside ('unassigned','assigned')
    // (availability.ts:690). `assignment_status_type` also allows 'completed',
    // 'cancelled' and 'no_show'. If those block here but not there, the calendar
    // offers a slot the write path refuses — a dead end on the revenue path.
    await db.from("bookings").update({ status: "confirmed" }).eq("id", control.bookingId);
    await db
      .from("booking_assignments")
      .update({ status: "completed" })
      .eq("booking_id", control.bookingId);

    const withCompletedAssignment = await probe(db, bookingArgs({ label: "PA14", date: day, time }));
    console.log(
      `[PA-14] booking confirmed + assignment status 'completed' -> write path ` +
        `${withCompletedAssignment.allowed ? "ALLOWS" : "REFUSES"}` +
        (withCompletedAssignment.message ? ` ("${withCompletedAssignment.message}")` : ""),
    );
    expect(
      withCompletedAssignment.allowed,
      `⛔ PARITY BREAK. The READ engine ignores an assignment whose status is 'completed' ` +
        `(availability.ts:690 filters to unassigned/assigned), so the customer calendar OFFERS ` +
        `this slot — and the WRITE path just refused it. That is a dead end on the revenue path. ` +
        `Fix: add "and ba.status in ('unassigned','assigned')" to the named-therapist busy check ` +
        `in create_booking_request, matching the unassigned query directly beneath it.`,
    ).toBe(true);
  });

  test("BR-23 — the override bypasses capacity, and that is by design", async () => {
    const db = serviceClient();
    expect(femalePool, "step 1 must have measured the pool").toBeGreaterThan(0);

    // 13:00 is still exhausted from step 1 (minus the one released for BR-12,
    // which BR-12's own probe did not consume), so top it back up first.
    await reserveOneFemale(db, "OVR", day, "13:00:00");
    const refused = await probe(db, bookingArgs({ label: "BR23A", date: day, time: "13:00:00" }));
    expect(refused.allowed, "13:00 must be full before the override means anything").toBe(false);

    const overridden = await callRpc(
      db,
      bookingArgs({ label: "BR23B", date: day, time: "13:00:00", source: "phone", override: true }),
    );
    expect(
      overridden.message,
      `⛔ the deliberate override was refused: "${overridden.message}". Staff who have arranged ` +
        `cover themselves must be able to record it, or they book outside the system.`,
    ).toBeNull();
    expect(overridden.bookingId).toBeTruthy();
    console.log(
      `[BR-23] override wrote a booking into a full slot — DESIGNED behaviour. ` +
        `⛔ HAND TO GATE 11: this path takes NO advisory lock.`,
    );
    await removeBooking(db, overridden.bookingId!);
  });
});

/** `HH:MM` plus (or minus) minutes, as `HH:MM:SS`. Never wraps past a day. */
function addMinutesTo(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  if (total < 0 || total > 24 * 60) {
    throw new Error(`buffer arithmetic left the day: ${hhmm} ${minutes >= 0 ? "+" : ""}${minutes}`);
  }
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;
}
