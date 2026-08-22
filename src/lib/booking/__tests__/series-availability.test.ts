// ⛔ D-042 — `checkSeriesSlots`: can the clinic actually cover a standing booking?
//
// Owner ruling D-042 (2026-08-22), chosen from three options: "fix it properly".
//
// ── WHAT THIS GUARDS, in the Owner's terms ───────────────────────────────────
//
// A one-off booking is checked against opening hours, blocked days, each
// therapist's working pattern, existing bookings and the travel buffer. ⛔ A
// REPEAT booking was checked against NONE of it. Measured against the live
// function body, `create_recurring_booking_series` contains zero occurrences of
// `availability_rules`, `booking_status_enabled` or `p_override_availability`;
// its only test was "does this same client already hold a booking at this date
// and time", and the nightly job repeated exactly that narrow check.
//
// So a standing booking could be placed — and re-placed every night for years —
// on days the clinic is shut, outside working hours, and with nobody free.
//
// ── ⛔ WHY THESE TESTS EXIST SEPARATELY FROM THE CALL SITES ──────────────────
//
// `createRecurringSeries` and the horizon cron both MOCK this function in their
// own suites, so that their cases stay about their own behaviour. ⛔ That means
// nothing there proves the check can REFUSE anything at all — a guard never seen
// to fail is not evidence (G-4). This file is where it is seen to fail, and the
// "ordinary working morning" case is the control that stops the refusals passing
// for the boring reason that everything is refused.
//
// The fixture is lifted from `availability-options.test.ts` so both suites
// describe the same clinic: open 10:00-13:00, CLOSED Sundays, one female
// therapist, a 15-minute travel buffer, 24 hours' notice, a 30-day public
// booking window, and one existing booking on 2026-06-17 at 10:00-11:00.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createFakeAdminClient } from "@/lib/cache/__tests__/fake-supabase-admin";
import { checkSeriesSlots } from "../availability";

/** 2026-06-15 09:00 London (BST). */
const FROZEN_NOW = new Date("2026-06-15T08:00:00.000Z");

const WORKING_HOURS = { start_time: "10:00", end_time: "13:00" };

/** Tuesday · Wednesday (the therapist is booked 10:00-11:00) · Thursday. */
const TUE = "2026-06-16";
const WED = "2026-06-17";
const THU = "2026-06-18";
/** Sunday — `is_working_day: false`. The clinic is shut. */
const SUN = "2026-06-21";
/** Five days beyond the 30-day public booking window. */
const BEYOND_WINDOW = "2026-07-20";

function tables(options: { bookingStatusEnabled?: boolean } = {}) {
  return {
    business_settings: {
      data: {
        booking_window_days: 30,
        buffer_time_mins: 15,
        minimum_notice_hours: 24,
        free_travel_cities: ["Luton"],
        booking_status_enabled: options.bookingStatusEnabled ?? true,
      },
      error: null,
    },
    services: {
      data: [{ slug: "hijama-package", duration_mins: 60, gender_restrictions: "any" }],
      error: null,
    },
    staff_profiles: {
      data: [
        {
          id: "staff-female-1",
          role_id: "role-therapist",
          gender: "female",
          availability_mode: "use_global",
        },
      ],
      error: null,
    },
    role_permissions: {
      data: [{ role_id: "role-therapist", permissions: { name: "claim_assignments" } }],
      error: null,
    },
    staff_permission_overrides: { data: [], error: null },
    availability_rules: {
      data: [
        { day_of_week: 0, ...WORKING_HOURS, is_working_day: false },
        { day_of_week: 1, ...WORKING_HOURS, is_working_day: true },
        { day_of_week: 2, ...WORKING_HOURS, is_working_day: true },
        { day_of_week: 3, ...WORKING_HOURS, is_working_day: true },
        { day_of_week: 4, ...WORKING_HOURS, is_working_day: true },
        { day_of_week: 5, ...WORKING_HOURS, is_working_day: true },
        { day_of_week: 6, ...WORKING_HOURS, is_working_day: true },
      ],
      error: null,
    },
    staff_availability_rules: { data: [], error: null },
    blocked_dates: { data: [], error: null },
    availability_overrides: { data: [], error: null },
    staff_blocked_dates: { data: [], error: null },
    staff_availability_overrides: { data: [], error: null },
    bookings: {
      data: [
        { id: "booking-1", booking_date: WED, start_time: "10:00", end_time: "11:00" },
      ],
      error: null,
    },
    booking_assignments: {
      data: [
        {
          booking_id: "booking-1",
          assigned_staff_id: "staff-female-1",
          required_therapist_gender: "female",
        },
      ],
      error: null,
    },
  };
}

function client(options: { bookingStatusEnabled?: boolean } = {}) {
  return createFakeAdminClient(tables(options)) as unknown as SupabaseClient;
}

function check(
  dates: string[],
  startTime: string,
  extra: { boundStaffId?: string | null } = {},
  options: { bookingStatusEnabled?: boolean } = {}
) {
  return checkSeriesSlots(
    {
      dates,
      startTime,
      serviceIds: ["hijama-package"],
      participantGenders: ["female"],
      city: "Luton",
      ...extra,
    },
    client(options)
  );
}

beforeEach(() => {
  vi.useFakeTimers({ now: FROZEN_NOW, toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkSeriesSlots — what it must REFUSE", () => {
  it("⛔ refuses a time the clinic is not open", async () => {
    // 03:00 is outside 10:00-13:00 on every day of the week.
    const result = await check([TUE, THU], "03:00");

    expect(result.verdicts.map((v) => v.available)).toEqual([false, false]);
    expect(result.verdicts[0].reason).toMatch(/no therapist of the right gender is free/i);
  });

  it("⛔ refuses a day the clinic is closed, while accepting the same time on an open day", async () => {
    // ⛔ Both in ONE call, so the refusal cannot be explained by the whole check
    // being broken — the Sunday is refused and the Tuesday is not.
    const result = await check([SUN, TUE], "10:00");

    expect(result.verdicts[0]).toMatchObject({ date: SUN, available: false });
    expect(result.verdicts[1]).toMatchObject({ date: TUE, available: true });
  });

  it("⛔ refuses a time the only therapist is already booked, including the travel buffer", async () => {
    // The therapist has 10:00-11:00 on the Wednesday. With a 15-minute buffer an
    // 11:00 start still overlaps, and the clinic shuts at 13:00 so a 60-minute
    // visit cannot start after 12:00 either.
    const booked = await check([WED], "10:00");
    expect(booked.verdicts[0].available, "the booked hour itself").toBe(false);

    const buffered = await check([WED], "11:00");
    expect(
      buffered.verdicts[0].available,
      "and the hour straight after it — zero travel gap is the whole point of the buffer"
    ).toBe(false);

    // ⛔ THE CONTROL. The same therapist, the same day, far enough clear of the
    // booking: available. Without this the two refusals above would be
    // consistent with "everything is refused".
    const clear = await check([WED], "12:00");
    expect(clear.verdicts[0].available, "12:00 is clear of both the booking and the buffer").toBe(
      true
    );
  });

  it("⛔ fails CLOSED when the settings cannot be read", async () => {
    const broken = createFakeAdminClient({
      ...tables(),
      business_settings: { data: null, error: { message: "boom" } },
    }) as unknown as SupabaseClient;

    const result = await checkSeriesSlots(
      {
        dates: [TUE],
        startTime: "10:00",
        serviceIds: ["hijama-package"],
        participantGenders: ["female"],
        city: "Luton",
      },
      broken
    );

    // ⛔ Not being able to check is not the same as being free.
    expect(result.verdicts[0].available).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("⛔ refuses a malformed start time rather than treating it as midnight", async () => {
    const result = await check([TUE], "2pm");
    expect(result.verdicts[0].available).toBe(false);
    expect(result.reason).toMatch(/invalid start time/i);
  });
});

describe("checkSeriesSlots — the four deliberate differences from the public path", () => {
  it("ignores the PUBLIC booking pause — staff are not the public", async () => {
    // ⛔ `booking_status_enabled` is the WEBSITE's own pause switch. Honouring it
    // here would refuse every series for a reason that has nothing to do with
    // the clinic's diary. ⚠️ It is NOT what keeps live bookings closed today —
    // production has it `true`, and the maintenance banner is in the deployed
    // code. Corrected after a D-035 review found the earlier claim false.
    const result = await check([TUE], "10:00", {}, { bookingStatusEnabled: false });
    expect(result.verdicts[0].available).toBe(true);
  });

  it("ignores the public booking WINDOW — a series materialises 12 weeks out by design", async () => {
    // 2026-07-20 is five days past the 30-day window. `calculateAvailableDays`
    // reports it unavailable for a customer; a standing booking must not be.
    const result = await check([BEYOND_WINDOW], "10:00");
    expect(result.verdicts[0].available).toBe(true);
  });

  it("ignores MINIMUM NOTICE — an arrangement is not a same-day request", async () => {
    // 24 hours' notice from 2026-06-15 09:00 London clears at 06-16 09:00, so a
    // 06-16 10:00 slot is inside notice anyway; the case that matters is the
    // day the clock is frozen on. The clinic is open 10:00 on 06-15, and the
    // public engine would refuse it for notice alone.
    const result = await check(["2026-06-15"], "10:00");
    expect(result.verdicts[0].available).toBe(true);
  });

  it("tests the EXACT anchor time, not the 30-minute slot grid", async () => {
    // ⛔ `computeDaySlots` walks in SLOT_STEP_MINS (30) steps, so a series
    // anchored off that grid would never match a listed slot. 10:20-11:20 sits
    // inside 10:00-13:00 and clear of everything on the Tuesday.
    const result = await check([TUE], "10:20");
    expect(result.verdicts[0].available).toBe(true);
  });
});

describe("checkSeriesSlots — the bound therapist is reported separately", () => {
  it("reports the locked therapist as busy when she is the one who is booked", async () => {
    // ⚠️ RENAMED after a D-035 review. It used to be called "says the clinic CAN
    // cover it while the locked therapist cannot" — which this fixture cannot
    // show, because she is the ONLY therapist, so `available` is false as well.
    // The title promised a separation the assertion never made. The genuine
    // separation is the "not eligible at all" case below, where the clinic can
    // cover the visit and the bound therapist still cannot.
    const result = await check([WED], "10:00", { boundStaffId: "staff-female-1" });

    expect(result.verdicts[0].boundStaffFree).toBe(false);
    expect(result.verdicts[0].available, "and here the clinic cannot cover it either").toBe(
      false
    );
  });

  it("reports boundStaffFree true when the locked therapist is genuinely free", async () => {
    const result = await check([TUE], "10:00", { boundStaffId: "staff-female-1" });
    expect(result.verdicts[0]).toMatchObject({ available: true, boundStaffFree: true });
  });

  it("⛔ reports boundStaffFree FALSE for a therapist who is not eligible at all", async () => {
    // A staff id that is not in the eligible set can never be found free, so the
    // series must not be silently treated as though its lock did not exist.
    const result = await check([TUE], "10:00", { boundStaffId: "staff-nobody" });

    expect(result.verdicts[0]).toMatchObject({
      // The clinic can still cover the visit with somebody else…
      available: true,
      // …but NOT with the person the series is locked to.
      boundStaffFree: false,
    });
    expect(result.verdicts[0].reason).toMatch(/locked to is not free/i);
  });

  it("leaves boundStaffFree undefined when the series is not locked to anyone", async () => {
    const result = await check([TUE], "10:00");
    expect(result.verdicts[0].boundStaffFree).toBeUndefined();
  });
});

describe("checkSeriesSlots — reservations that name nobody still use the therapist up", () => {
  // ⛔ FOUND BY MUTATION, NOT BY READING. Deleting the
  // `- reserved.male / - reserved.female` subtraction left every test in this
  // file GREEN, because the fixture's only booking is ASSIGNED — so there were
  // no unassigned reservations to subtract and the line was never exercised.
  //
  // ⚠️ That is not a hypothetical line. EVERY booking made through the website
  // is created with `assigned_staff_id = null`, and the F1 defect
  // (`availability.ts`, 2026-08-17) was exactly this: unassigned bookings
  // consumed ZERO capacity, so N of them could be accepted against far fewer
  // therapists. A standing booking placed on top of that would be promising a
  // slot the clinic has already given away.
  function clientWithUnassigned() {
    return createFakeAdminClient({
      ...tables(),
      bookings: {
        data: [
          // Thursday 10:00-11:00, nobody named.
          { id: "booking-open", booking_date: THU, start_time: "10:00", end_time: "11:00" },
        ],
        error: null,
      },
      booking_assignments: {
        data: [
          {
            booking_id: "booking-open",
            assigned_staff_id: null,
            required_therapist_gender: "female",
          },
        ],
        error: null,
      },
    }) as unknown as SupabaseClient;
  }

  it("⛔ counts an UNASSIGNED booking against capacity", async () => {
    const result = await checkSeriesSlots(
      {
        dates: [THU],
        startTime: "10:00",
        serviceIds: ["hijama-package"],
        participantGenders: ["female"],
        city: "Luton",
      },
      clientWithUnassigned()
    );

    // One female therapist, and an unassigned booking already holding her hour.
    expect(
      result.verdicts[0].available,
      "the clinic has already promised that hour to somebody, even though nobody is named on it"
    ).toBe(false);
  });

  it("still offers a time the unassigned booking does not reach", async () => {
    // ⛔ THE CONTROL for the case above: the same fixture, a clear hour.
    const result = await checkSeriesSlots(
      {
        dates: [THU],
        startTime: "12:00",
        serviceIds: ["hijama-package"],
        participantGenders: ["female"],
        city: "Luton",
      },
      clientWithUnassigned()
    );

    expect(result.verdicts[0].available).toBe(true);
  });
});
