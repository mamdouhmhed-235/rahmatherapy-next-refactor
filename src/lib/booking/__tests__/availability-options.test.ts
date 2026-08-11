// C-23 Phase B, Step 3 — the additive admin options on calculateAvailableDays.
//
// `src/lib/booking/availability.ts` and `/api/availability/month` serve the
// LIVE public customer calendar (ScheduleStep.tsx POSTs the month route
// unauthenticated, on the service-role client), so the first suite below is a
// REGRESSION GUARD, not a feature test: FROZEN_DEFAULTS is the literal output
// this exact fixture produced from the engine BEFORE the options bag existed,
// captured by running this file against the pre-change source. Every later
// change to the options bag has to keep reproducing it byte for byte when the
// caller omits options — which is what the one production caller of this
// function (`src/app/api/availability/month/route.ts`, two args) does.
//
// The clock is frozen with `toFake: ["Date"]` only, so the two-argument call
// really is two arguments — `options.now` is omitted exactly as the public
// route omits it — while the result stays deterministic.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createFakeAdminClient } from "@/lib/cache/__tests__/fake-supabase-admin";
import {
  calculateAvailableDays,
  type AvailableDaysResult,
  type CalculateAvailableDaysInput,
} from "../availability";

// 2026-06-15 09:00 London (BST). Business window = 30 days, so the last
// bookable date is 2026-07-15 and minimum notice (24h) clears from
// 2026-06-16 09:00 London onwards.
const FROZEN_NOW = new Date("2026-06-15T08:00:00.000Z");

// 06-14 Sunday + in the past · 06-16 Tuesday · 06-17 Wednesday (one booked
// slot) · 06-21 Sunday (closed) · 07-20 Monday, five days past the window.
const INPUT: CalculateAvailableDaysInput = {
  dates: ["2026-06-14", "2026-06-16", "2026-06-17", "2026-06-21", "2026-07-20"],
  serviceIds: ["hijama-package"],
  participantGenders: ["female"],
  city: "Luton",
};

const WORKING_HOURS = { start_time: "10:00", end_time: "13:00" };

function tables(options: { bookingStatusEnabled: boolean }) {
  return {
    business_settings: {
      data: {
        booking_window_days: 30,
        buffer_time_mins: 15,
        minimum_notice_hours: 24,
        free_travel_cities: ["Luton"],
        booking_status_enabled: options.bookingStatusEnabled,
      },
      error: null,
    },
    services: {
      data: [
        { slug: "hijama-package", duration_mins: 60, gender_restrictions: "any" },
      ],
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
      data: [
        { role_id: "role-therapist", permissions: { name: "claim_assignments" } },
      ],
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
        {
          id: "booking-1",
          booking_date: "2026-06-17",
          start_time: "10:00",
          end_time: "11:00",
        },
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

function client(bookingStatusEnabled = true) {
  return createFakeAdminClient(
    tables({ bookingStatusEnabled })
  ) as unknown as SupabaseClient;
}

// Captured from the engine as it stood before the options bag was added
// (commit `8504746`). Do not "update" these numbers to match a new
// implementation — a diff here means the public month endpoint changed.
const FROZEN_DEFAULTS: AvailableDaysResult = {
  days: [
    { date: "2026-06-14", hasSlots: false, slotCount: 0 },
    { date: "2026-06-16", hasSlots: true, slotCount: 5 },
    { date: "2026-06-17", hasSlots: true, slotCount: 2 },
    { date: "2026-06-21", hasSlots: false, slotCount: 0 },
    { date: "2026-07-20", hasSlots: false, slotCount: 0 },
  ],
  durationMins: 60,
  requiredStaffByGender: { male: 0, female: 1 },
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("calculateAvailableDays — options omitted (public-path regression guard)", () => {
  it("reproduces the pre-change output exactly when called with two arguments", async () => {
    const result = await calculateAvailableDays(INPUT, client());

    expect(result).toStrictEqual(FROZEN_DEFAULTS);
  });

  // Item 8 Phase 2 — the free-travel list is not a gate. A city absent from
  // free_travel_cities must produce byte-identical availability to one inside
  // it; before this phase it returned zero days and
  // "Location is outside the service area.", which is the empty-calendar
  // defect a Harpenden customer hit after being told the area was covered.
  it("returns the same availability for a city outside the free-travel list", async () => {
    const outOfZone = await calculateAvailableDays(
      { ...INPUT, city: "Manchester" },
      client()
    );

    expect(outOfZone).toStrictEqual(FROZEN_DEFAULTS);
    expect(outOfZone.reason).toBeUndefined();
  });

  it("still refuses every day when public booking is paused and no option is passed", async () => {
    const result = await calculateAvailableDays(INPUT, client(false));

    expect(result).toStrictEqual({
      days: INPUT.dates.map((date) => ({ date, hasSlots: false, slotCount: 0 })),
      durationMins: 0,
      requiredStaffByGender: { male: 0, female: 1 },
      reason: "Online booking is currently paused.",
    });
  });

  it("treats an empty bag and both options explicitly false as the two-argument call", async () => {
    const omitted = await calculateAvailableDays(INPUT, client());
    const emptyBag = await calculateAvailableDays(INPUT, client(), {});
    const explicitlyOff = await calculateAvailableDays(INPUT, client(), {
      ignoreBookingWindow: false,
      ignorePublicPause: false,
    });

    expect(emptyBag).toStrictEqual(omitted);
    expect(explicitlyOff).toStrictEqual(omitted);
    expect(omitted).toStrictEqual(FROZEN_DEFAULTS);
  });
});

describe("calculateAvailableDays — ignorePublicPause", () => {
  it("computes days while public online booking is paused", async () => {
    const result = await calculateAvailableDays(INPUT, client(false), {
      ignorePublicPause: true,
    });

    // Identical to the unpaused public result: the pause is the only thing
    // the option lifts.
    expect(result).toStrictEqual(FROZEN_DEFAULTS);
    expect(result.reason).toBeUndefined();
  });
});

describe("calculateAvailableDays — ignoreBookingWindow", () => {
  it("reports real availability for a date beyond the customer booking window", async () => {
    const publicResult = await calculateAvailableDays(INPUT, client());
    const adminResult = await calculateAvailableDays(INPUT, client(), {
      ignoreBookingWindow: true,
    });

    const beyondWindow = "2026-07-20";
    expect(
      publicResult.days.find((day) => day.date === beyondWindow)
    ).toStrictEqual({ date: beyondWindow, hasSlots: false, slotCount: 0 });
    expect(
      adminResult.days.find((day) => day.date === beyondWindow)
    ).toStrictEqual({ date: beyondWindow, hasSlots: true, slotCount: 5 });
  });

  it("does not resurrect past dates — the minimum-notice floor is untouched", async () => {
    const result = await calculateAvailableDays(INPUT, client(), {
      ignoreBookingWindow: true,
    });

    expect(result.days.find((day) => day.date === "2026-06-14")).toStrictEqual({
      date: "2026-06-14",
      hasSlots: false,
      slotCount: 0,
    });
  });

  it("leaves in-window days exactly as the public path sees them", async () => {
    const result = await calculateAvailableDays(INPUT, client(), {
      ignoreBookingWindow: true,
    });

    for (const date of ["2026-06-14", "2026-06-16", "2026-06-17", "2026-06-21"]) {
      expect(result.days.find((day) => day.date === date)).toStrictEqual(
        FROZEN_DEFAULTS.days.find((day) => day.date === date)
      );
    }
  });
});
