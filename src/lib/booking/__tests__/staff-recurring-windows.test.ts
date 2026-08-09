// C-14 Phase B, Step 11 — does `resolveStaffWindows` consume MULTIPLE recurring
// rows for one staff weekday, or only the first?
//
// The plan flagged this as "likely already fine — verify + test". It is fine,
// and this file is the proof rather than the assertion:
//
//   availability.ts:535-541  `loadContextRest` buckets staff rules into a
//                            Map<staff_id, StaffAvailabilityRuleRecord[]>,
//                            APPENDING each row (`[...existing, rule]`).
//   availability.ts:309-311  `resolveStaffWindows`, custom mode, passes that
//                            whole array to `getRuleWindowsForDay`.
//   availability.ts:275-282  which filters by day + is_working_day and hands
//                            the survivors to `normalizeWindows`.
//   availability.ts:204-213  `normalizeWindows` flatMaps EVERY record into a
//                            window; :215-217 `containsWindow` uses .some(),
//                            so a slot has to fit inside ONE of them.
//
// So `src/lib/booking/availability.ts` needed NO change for Phase B. Reading
// that chain is not enough on its own — the same reading would have been
// written of a first-row-wins implementation — so the specs below drive a
// two-row staff day through the REAL `calculateAvailableSlots`, faking only
// the Supabase data layer, exactly as the Phase A spec does for global rules.
//
// The two failure modes these have to separate:
//   * only the FIRST row consumed  -> no afternoon slots at all;
//   * both rows merged into one span -> slots offered across the break.
// Asserting either alone would pass against the other bug.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createFakeAdminClient } from "@/lib/cache/__tests__/fake-supabase-admin";
import { calculateAvailableSlots } from "../availability";

const FROZEN_NOW = new Date("2026-06-15T08:00:00.000Z"); // Mon 09:00 London
const BOOKING_DATE = "2026-06-16"; // Tuesday -> day_of_week 2
const DAY_OF_WEEK = 2;
const STAFF_ID = "staff-female-1";

interface Segment {
  start_time: string;
  end_time: string;
  is_working_day?: boolean;
}

function open(start_time: string, end_time: string): Segment {
  return { start_time, end_time, is_working_day: true };
}

/** The staff day under test: 08:00–12:30 and 15:00–20:00, i.e. a 12:30–15:00 break. */
const STAFF_DAY_WITH_BREAK = [open("08:00", "12:30"), open("15:00", "20:00")];

/** Deliberately unbroken, so falling through to the global rules is visible. */
const GLOBAL_DAY_NO_BREAK = [open("08:00", "20:00")];

function engineClient({
  availabilityMode,
  staffSegments,
  globalSegments,
}: {
  availabilityMode: "custom" | "use_global";
  staffSegments: Segment[];
  globalSegments: Segment[];
}) {
  return createFakeAdminClient({
    business_settings: {
      data: {
        booking_window_days: 30,
        buffer_time_mins: 0,
        minimum_notice_hours: 0,
        allowed_cities: ["Luton"],
        booking_status_enabled: true,
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
          id: STAFF_ID,
          role_id: "role-therapist",
          gender: "female",
          availability_mode: availabilityMode,
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
      data: globalSegments.map((row) => ({ ...row, day_of_week: DAY_OF_WEEK })),
      error: null,
    },
    staff_availability_rules: {
      data: staffSegments.map((row) => ({
        ...row,
        staff_id: STAFF_ID,
        day_of_week: DAY_OF_WEEK,
      })),
      error: null,
    },
    blocked_dates: { data: [], error: null },
    availability_overrides: { data: [], error: null },
    staff_blocked_dates: { data: [], error: null },
    staff_availability_overrides: { data: [], error: null },
    bookings: { data: [], error: null },
    booking_assignments: { data: [], error: null },
  }) as unknown as SupabaseClient;
}

async function slotTimes(options: {
  availabilityMode: "custom" | "use_global";
  staffSegments: Segment[];
  globalSegments: Segment[];
}) {
  const result = await calculateAvailableSlots(
    {
      date: BOOKING_DATE,
      serviceIds: ["hijama-package"],
      participantGenders: ["female"],
      city: "Luton",
    },
    engineClient(options),
    { now: FROZEN_NOW }
  );

  return result.slots.map((slot) => slot.time);
}

const ACROSS_THE_BREAK = ["12:00", "12:30", "13:00", "13:30", "14:00"];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("resolveStaffWindows — recurring staff rules, multiple rows per day", () => {
  it("turns BOTH of a custom staff member's rows into windows", async () => {
    const times = await slotTimes({
      availabilityMode: "custom",
      staffSegments: STAFF_DAY_WITH_BREAK,
      globalSegments: GLOBAL_DAY_NO_BREAK,
    });

    // First row honoured…
    expect(times[0]).toBe("08:00");
    expect(times).toContain("11:30");
    // …and the second, which a first-row-wins implementation would drop
    // entirely (the day would end at 11:30).
    expect(times).toContain("15:00");
    expect(times[times.length - 1]).toBe("19:00");

    // 60-minute service on a 30-minute step: nothing may span 12:30–15:00.
    for (const blocked of ACROSS_THE_BREAK) {
      expect(times).not.toContain(blocked);
    }
  });

  it("offers the whole span when the same staff day is one row (control)", async () => {
    const times = await slotTimes({
      availabilityMode: "custom",
      staffSegments: [open("08:00", "20:00")],
      globalSegments: GLOBAL_DAY_NO_BREAK,
    });

    for (const offered of ["08:00", ...ACROSS_THE_BREAK, "15:00", "19:00"]) {
      expect(times).toContain(offered);
    }
  });

  it("uses the staff member's own rows, not the clinic-wide ones", async () => {
    // The global day is unbroken 08:00–20:00, so any slot inside 12:30–15:00
    // would mean the custom branch was bypassed.
    const times = await slotTimes({
      availabilityMode: "custom",
      staffSegments: STAFF_DAY_WITH_BREAK,
      globalSegments: GLOBAL_DAY_NO_BREAK,
    });

    expect(times).not.toContain("13:00");
  });

  it("ignores an is_working_day:false row while honouring the rest", async () => {
    const times = await slotTimes({
      availabilityMode: "custom",
      staffSegments: [
        ...STAFF_DAY_WITH_BREAK,
        { start_time: "21:00", end_time: "23:00", is_working_day: false },
      ],
      globalSegments: GLOBAL_DAY_NO_BREAK,
    });

    expect(times).toContain("15:00");
    expect(times[times.length - 1]).toBe("19:00");
    expect(times).not.toContain("21:00");
  });

  // Negative control. Everything downstream of the bucketing loop sees exactly
  // the same input either way, so feeding ONLY the first row reproduces what a
  // first-row-wins `resolveStaffWindows` would produce — and shows the spec
  // above fails against it rather than passing for an unrelated reason.
  // (The source itself is not mutated: agents may not leave the tree dirty.)
  it("negative control — a first-row-only day loses the afternoon entirely", async () => {
    const times = await slotTimes({
      availabilityMode: "custom",
      staffSegments: [STAFF_DAY_WITH_BREAK[0]],
      globalSegments: GLOBAL_DAY_NO_BREAK,
    });

    expect(times).not.toContain("15:00");
    expect(times[times.length - 1]).toBe("11:30");
  });

  it("closes the day when a custom staff member has no working rows", async () => {
    const times = await slotTimes({
      availabilityMode: "custom",
      staffSegments: [
        { start_time: "08:00", end_time: "20:00", is_working_day: false },
      ],
      globalSegments: GLOBAL_DAY_NO_BREAK,
    });

    expect(times).toEqual([]);
  });
});

describe("resolveStaffWindows — use_global staff inherit the clinic's breaks", () => {
  it("applies every global segment to a staff member on use_global", async () => {
    const times = await slotTimes({
      availabilityMode: "use_global",
      // Present but irrelevant: on use_global these rows must not be read.
      staffSegments: [open("08:00", "20:00")],
      globalSegments: STAFF_DAY_WITH_BREAK,
    });

    expect(times).toContain("11:30");
    expect(times).toContain("15:00");
    expect(times[times.length - 1]).toBe("19:00");

    for (const blocked of ACROSS_THE_BREAK) {
      expect(times).not.toContain(blocked);
    }
  });
});
