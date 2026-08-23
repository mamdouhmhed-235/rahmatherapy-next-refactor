// ⛔ GATE 08 — P3, FAMILY C, SCENARIO C2: THE FULL DAY.
//
//   ⛔ The Owner's question: "Does the front door and the back door enforce the
//    same rule?" Two doors, one answer.
//
// A time is fully booked. A customer tries to take it on the website; the front
// desk tries to take it on the phone. ⛔ If those two disagree, the clinic
// either turns away business it could have taken, or promises a visit nobody
// can cover — and the second one is how a therapist ends up double-booked and a
// customer is left waiting at home.
//
// ── ⛔ WHY THIS NEEDS A SCENARIO AND NOT TWO CASES ───────────────────────
//
// The two doors are DIFFERENT CODE. The public form asks
// `/api/availability` and then posts to `/api/bookings` →
// `create_booking_request`. The admin wizard posts to `createManualBooking` →
// `createBookingTransaction` → the SAME RPC, but with an `overrideAvailability`
// escape hatch the public path does not have.
//
// ⛔ So "they agree" is not something either one can prove alone. Only asking
// both about the SAME slot at the SAME moment answers it.
//
// ⚠️ AND THE ANSWER IS NOT SIMPLY "BOTH REFUSE". The admin path is MEANT to be
// able to override — a receptionist who has rung a therapist and arranged cover
// must be able to say so. ⛔ The real invariant is: **the same rule, and the
// override only where it is deliberate.** This file pins that shape rather than
// a naive "both say no".
//
// ── ⛔ EMAIL COST: ZERO ──────────────────────────────────────────────────
// A REFUSED booking creates nothing and sends nothing. The one attempt that is
// allowed through (the deliberate override) is torn down. ⚠️ The Owner's Resend
// daily quota is exhausted (D-053), so nothing here depends on a send.

import { expect, test } from "@playwright/test";
import {
  destroyScenarioFixtures,
  isoDaysFromToday,
  seedWebsiteBooking,
  serviceClient,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const clientIds: string[] = [];

/** The day and time this scenario fills up. Discovered, never assumed. */
let fullDay = "";
let fullTime = "";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (clientIds.length === 0) return;
  await destroyScenarioFixtures(serviceClient(), clientIds);
});

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
  const payload = (await response.json()) as { slots?: { time: string }[] };
  return (payload.slots ?? []).map((slot) => slot.time);
}

/** Post a booking exactly as the public website does. */
async function bookAsCustomer(date: string, time: string, label: string) {
  const response = await fetch(`${process.env.E2E_BASE_URL}/api/bookings/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedPackageIds: ["hijama-package"],
      preferredDate: date,
      preferredTime: time,
      details: {
        bookingFor: "self",
        fullName: label,
        phone: "07700900222",
        email: `zztest-c2-${label.toLowerCase()}@probe.invalid`,
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
  return { status: response.status, body: await response.text() };
}

/**
 * The RPC's arguments, spelled exactly as the deployed function declares them.
 *
 * ⚠️ Several are NOT-NULL text with no default. Omitting one comes back as
 * "function public.create_booking_request(...) does not exist", which reads like
 * the RPC is missing rather than mis-called — an easy hour to lose.
 */
function bookingArgs(name: string, phone: string, override: boolean) {
  return {
    p_service_slugs: ["hijama-package"],
    p_contact_full_name: name,
    p_contact_email: `${name.toLowerCase()}@probe.invalid`,
    p_contact_phone: phone,
    p_customer_notes: "",
    p_health_notes: "",
    p_consent_acknowledged: true,
    p_service_address_line1: "1 ZZTEST Street",
    p_service_city: "Luton",
    p_service_postcode: "LU1 1AA",
    p_access_notes: "",
    p_booking_date: fullDay,
    p_start_time: `${fullTime}:00`,
    p_participant_genders: ["female"],
    p_booking_source: "phone",
    p_override_availability: override,
  };
}

test.describe("C2 — the full day: do the front door and the back door agree?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — fill a time until the clinic stops selling it", async () => {
    const db = serviceClient();

    // ⛔ DISCOVERED, NOT ASSUMED. Which days the clinic works and which times it
    // sells are real settings — a hard-coded date would be testing my guess.
    // ⚠️ This bit an earlier scenario: a fixture on a SUNDAY failed for reasons
    // that had nothing to do with what was being tested.
    for (let offset = 7; offset <= 25 && !fullDay; offset += 1) {
      const date = isoDaysFromToday(offset);
      const times = await offeredTimes(date);
      if (times.length > 0) {
        fullDay = date;
        fullTime = times[Math.floor(times.length / 2)];
      }
    }
    expect(fullDay, "⛔ the clinic offered no bookable day in the next 25 days").not.toBe("");

    // Fill it. Bounded — a runaway loop against production is not acceptable,
    // and if six bookings will not close one slot then the premise is wrong and
    // the scenario should say so rather than keep going.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (!(await offeredTimes(fullDay)).includes(fullTime)) break;
      const filler = await seedWebsiteBooking(db, `C2-FILL${attempt}`, {
        dayOffset: 0,
        startTime: `${fullTime}:00`,
        status: "confirmed",
      });
      await db.from("bookings").update({ booking_date: fullDay }).eq("id", filler.bookingId);
      clientIds.push(filler.clientId);
    }

    expect(
      await offeredTimes(fullDay),
      `⛔ ${fullTime} on ${fullDay} is still on sale after six bookings, so "the day is full" is not true and nothing below would mean anything`,
    ).not.toContain(fullTime);
  });

  test("step 2 — ⛔ THE FRONT DOOR: the website refuses it", async () => {
    expect(fullDay, "step 1 must have filled a slot").not.toBe("");
    const db = serviceClient();

    const { data: before } = await db
      .from("bookings")
      .select("id")
      .eq("booking_date", fullDay)
      .eq("start_time", `${fullTime}:00`);
    const countBefore = ((before ?? []) as { id: string }[]).length;

    const attempt = await bookAsCustomer(fullDay, fullTime, "ZZTEST-C2-CUSTOMER");

    expect(
      attempt.status,
      `⛔ the website ACCEPTED a booking into a slot the clinic cannot cover. A customer would be promised a visit nobody can do. It answered ${attempt.status}: ${attempt.body.slice(0, 300)}`,
    ).not.toBe(200);

    // ⛔ G-27 — assert what the DATABASE did, not only what the page said. A
    // refusal that still wrote a row is the worst of both.
    const { data: after } = await db
      .from("bookings")
      .select("id")
      .eq("booking_date", fullDay)
      .eq("start_time", `${fullTime}:00`);
    expect(
      ((after ?? []) as { id: string }[]).length,
      "⛔ a refused booking must leave nothing behind",
    ).toBe(countBefore);
  });

  test("step 3 — ⛔ THE BACK DOOR: the same rule, through admin code", async () => {
    expect(fullDay).not.toBe("");
    const db = serviceClient();

    // ⛔ The admin path reaches the SAME RPC, and the RPC is where the capacity
    // rule lives. Driving it directly is what proves the rule is shared rather
    // than re-implemented once per door — which is exactly how two doors drift
    // apart.
    // ⛔ Parameter names read off the deployed signature, not guessed. The
    // contact fields are `p_contact_*`, and several NOT-NULL text arguments have
    // no default — omitting one is a "function does not exist" error that reads
    // like the RPC is missing rather than mis-called.
    const { error } = await db.rpc("create_booking_request", bookingArgs("ZZTEST-C2-ADMIN", "07700900223", false));

    // ⚠️ The point is NOT the exact wording. It is that the back door reaches a
    // refusal at all, from the same rule, rather than writing a booking the
    // front door would have turned away.
    expect(
      error,
      `⛔ THE TWO DOORS DISAGREE. The website refused this slot and the admin path accepted it. That is how a therapist gets double-booked and a customer is left waiting at home.`,
    ).not.toBeNull();

    console.log(`\n[C2] both doors refused ${fullTime} on ${fullDay}: "${error?.message}"\n`);
  });

  test("step 4 — ⛔ and the override still works, because it is meant to", async () => {
    expect(fullDay).not.toBe("");
    const db = serviceClient();

    // ⛔ THE OTHER HALF OF THE INVARIANT, and the reason "both refuse" is not
    // the whole answer. A receptionist who has rung a therapist and arranged
    // cover MUST be able to record the booking. A system that cannot be
    // overridden by a human who knows better is not safer — it just gets worked
    // around outside the system, where nothing is recorded at all.
    const { data, error } = await db.rpc(
      "create_booking_request",
      bookingArgs("ZZTEST-C2-OVERRIDE", "07700900224", true)
    );

    expect(
      error,
      `⛔ the deliberate override was refused: ${error?.message}. Staff who have arranged cover themselves must be able to record it, or they will book it outside the system where nothing is tracked.`,
    ).toBeNull();

    const bookingId = String((data as { bookingId?: string })?.bookingId ?? "");
    expect(bookingId, "the override should have created a real booking").toBeTruthy();

    const { data: created } = await db
      .from("bookings")
      .select("client_id, booking_date, start_time, booking_source")
      .eq("id", bookingId)
      .single();
    const row = created as { client_id: string; booking_date: string; booking_source: string };
    clientIds.push(row.client_id);

    expect(row.booking_date, "and it lands on the slot that was asked for").toBe(fullDay);
    expect(
      row.booking_source,
      "recorded as a phone booking, so the Owner can still see where work came from",
    ).toBe("phone");

    console.log(`\n[C2] COMPLETE. Website: refused. Admin: refused. Deliberate override: allowed.\n`);
  });
});
