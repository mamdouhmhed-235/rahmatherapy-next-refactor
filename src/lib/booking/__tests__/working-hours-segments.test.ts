// C-14 Phase A, Step 6 — segments conversion + validation.
//
// The last describe block is the load-bearing one: it feeds `scheduleToRows`
// output straight into the REAL slot engine (`calculateAvailableSlots`, via the
// shared fake admin client) and asserts the break yields no slots. That is what
// proves the plan's "zero engine change" premise — that the rows this module
// emits are exactly the shape `getRuleWindowsForDay` / `containsWindow` already
// consume — rather than asserting it against a re-implementation.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createFakeAdminClient } from "@/lib/cache/__tests__/fake-supabase-admin";
import { calculateAvailableSlots } from "../availability";
import {
  DEFAULT_CLOSES,
  DEFAULT_OPENS,
  rowsToSchedule,
  scheduleToRows,
  validateSchedule,
  type DaySchedule,
  type SegmentRow,
} from "../working-hours-segments";

function workingDay(overrides: Partial<DaySchedule> = {}): DaySchedule {
  return {
    isWorkingDay: true,
    opens: "08:00",
    closes: "20:00",
    breaks: [],
    ...overrides,
  };
}

function open(start_time: string, end_time: string): SegmentRow {
  return { start_time, end_time, is_working_day: true };
}

describe("scheduleToRows / rowsToSchedule — round trips", () => {
  it("keeps a single window as one row", () => {
    const schedule = workingDay();
    const rows = scheduleToRows(schedule);

    expect(rows).toEqual([open("08:00", "20:00")]);
    expect(rowsToSchedule(rows)).toEqual(schedule);
  });

  it("splits one break into TWO segment rows and round-trips", () => {
    const schedule = workingDay({ breaks: [{ start: "12:30", end: "15:00" }] });
    const rows = scheduleToRows(schedule);

    expect(rows).toEqual([open("08:00", "12:30"), open("15:00", "20:00")]);
    expect(rowsToSchedule(rows)).toEqual(schedule);
  });

  it("splits two breaks into THREE segment rows and round-trips", () => {
    const schedule = workingDay({
      breaks: [
        { start: "12:30", end: "15:00" },
        { start: "17:00", end: "17:30" },
      ],
    });
    const rows = scheduleToRows(schedule);

    expect(rows).toEqual([
      open("08:00", "12:30"),
      open("15:00", "17:00"),
      open("17:30", "20:00"),
    ]);
    expect(rowsToSchedule(rows)).toEqual(schedule);
  });

  it("writes a closed day as one is_working_day:false row that keeps the hours", () => {
    const schedule: DaySchedule = {
      isWorkingDay: false,
      opens: "08:00",
      closes: "20:00",
      breaks: [],
    };
    const rows = scheduleToRows(schedule);

    expect(rows).toEqual([
      { start_time: "08:00", end_time: "20:00", is_working_day: false },
    ]);
    expect(rowsToSchedule(rows)).toEqual(schedule);
  });

  it("sorts breaks before splitting, so rows always come back in time order", () => {
    const rows = scheduleToRows(
      workingDay({
        breaks: [
          { start: "17:00", end: "17:30" },
          { start: "12:30", end: "15:00" },
        ],
      })
    );

    expect(rows).toEqual([
      open("08:00", "12:30"),
      open("15:00", "17:00"),
      open("17:30", "20:00"),
    ]);
  });

  it("drops zero-length segments instead of persisting empty rows", () => {
    // Breaks butting against opens, against closes, and against each other.
    const rows = scheduleToRows(
      workingDay({
        breaks: [
          { start: "08:00", end: "09:00" },
          { start: "12:00", end: "13:00" },
          { start: "13:00", end: "14:00" },
          { start: "19:00", end: "20:00" },
        ],
      })
    );

    expect(rows).toEqual([open("09:00", "12:00"), open("14:00", "19:00")]);
  });

  it("returns no rows when the breaks swallow the whole day", () => {
    expect(
      scheduleToRows(workingDay({ breaks: [{ start: "08:00", end: "20:00" }] }))
    ).toEqual([]);
  });

  it("normalises HH:MM:SS rows from the database to HH:MM", () => {
    expect(
      rowsToSchedule([open("08:00:00", "12:30:00"), open("15:00:00", "20:00:00")])
    ).toEqual(workingDay({ breaks: [{ start: "12:30", end: "15:00" }] }));
  });

  it("ignores rows the slot engine would ignore (bad times, end <= start)", () => {
    expect(
      rowsToSchedule([
        open("08:00", "12:30"),
        open("noon", "13:00"),
        open("16:00", "16:00"),
        open("15:00", "20:00"),
      ])
    ).toEqual(workingDay({ breaks: [{ start: "12:30", end: "15:00" }] }));
  });

  it("collapses overlapping stored rows rather than inventing a negative break", () => {
    expect(rowsToSchedule([open("08:00", "13:00"), open("12:00", "20:00")])).toEqual(
      workingDay()
    );
  });

  it("falls back to the manager's default hours when a day has no rows at all", () => {
    expect(rowsToSchedule([])).toEqual({
      isWorkingDay: false,
      opens: DEFAULT_OPENS,
      closes: DEFAULT_CLOSES,
      breaks: [],
    });
  });
});

describe("validateSchedule — errors", () => {
  it("rejects a break that starts before opening", () => {
    const { errors } = validateSchedule(
      workingDay({ breaks: [{ start: "07:00", end: "09:00" }] })
    );

    expect(errors).toEqual(["Break 1 has to sit between 08:00 and 20:00."]);
  });

  it("rejects a break that ends after closing", () => {
    const { errors } = validateSchedule(
      workingDay({ breaks: [{ start: "19:00", end: "21:00" }] })
    );

    expect(errors).toEqual(["Break 1 has to sit between 08:00 and 20:00."]);
  });

  it("rejects overlapping breaks", () => {
    const { errors } = validateSchedule(
      workingDay({
        breaks: [
          { start: "12:00", end: "14:00" },
          { start: "13:00", end: "15:00" },
        ],
      })
    );

    expect(errors).toEqual(["Break 1 and Break 2 overlap."]);
  });

  it("rejects opens >= closes", () => {
    expect(validateSchedule(workingDay({ opens: "20:00", closes: "08:00" })).errors).toEqual(
      ["The closing time has to be after the opening time."]
    );
    expect(validateSchedule(workingDay({ opens: "09:00", closes: "09:00" })).errors).toEqual(
      ["The closing time has to be after the opening time."]
    );
  });

  it("rejects a break that ends before it starts", () => {
    const { errors } = validateSchedule(
      workingDay({ breaks: [{ start: "15:00", end: "12:30" }] })
    );

    expect(errors).toEqual(["Break 1 has to end after it starts."]);
  });

  it("rejects a day whose breaks leave nothing bookable", () => {
    const { errors } = validateSchedule(
      workingDay({ breaks: [{ start: "08:00", end: "20:00" }] })
    );

    expect(errors).toEqual([
      "The breaks cover the whole day — there is no bookable time left.",
    ]);
  });

  it("accepts back-to-back breaks and a valid multi-break day", () => {
    expect(
      validateSchedule(
        workingDay({
          breaks: [
            { start: "12:30", end: "15:00" },
            { start: "15:00", end: "16:00" },
          ],
        })
      )
    ).toEqual({ errors: [], warnings: [] });
  });

  it("has nothing to say about a closed day", () => {
    expect(
      validateSchedule({
        isWorkingDay: false,
        opens: "20:00",
        closes: "08:00",
        breaks: [],
      })
    ).toEqual({ errors: [], warnings: [] });
  });
});

describe("validateSchedule — warnings", () => {
  it("warns (without blocking) on a bookable stretch too short for any service", () => {
    const { errors, warnings } = validateSchedule(
      workingDay({
        breaks: [
          { start: "12:30", end: "15:00" },
          { start: "15:15", end: "17:00" },
        ],
      })
    );

    expect(errors).toEqual([]);
    expect(warnings).toEqual([
      "The 15-minute stretch from 15:00 to 15:15 is too short for most services to book.",
    ]);
  });

  it("does not warn on a stretch exactly one slot step long", () => {
    const { warnings } = validateSchedule(
      workingDay({
        breaks: [
          { start: "12:30", end: "15:00" },
          { start: "15:30", end: "17:00" },
        ],
      })
    );

    expect(warnings).toEqual([]);
  });
});

// --- The zero-engine-change premise, checked against the real engine --------

const FROZEN_NOW = new Date("2026-06-15T08:00:00.000Z"); // Mon 09:00 London
const BREAK_DATE = "2026-06-16"; // Tuesday -> day_of_week 2

const MONDAY_WITH_A_BREAK = workingDay({
  breaks: [{ start: "12:30", end: "15:00" }],
});

function engineClient(rules: SegmentRow[]) {
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
      data: rules.map((row) => ({ ...row, day_of_week: 2 })),
      error: null,
    },
    staff_availability_rules: { data: [], error: null },
    blocked_dates: { data: [], error: null },
    availability_overrides: { data: [], error: null },
    staff_blocked_dates: { data: [], error: null },
    staff_availability_overrides: { data: [], error: null },
    bookings: { data: [], error: null },
    booking_assignments: { data: [], error: null },
  }) as unknown as SupabaseClient;
}

async function slotTimes(rules: SegmentRow[]) {
  const result = await calculateAvailableSlots(
    {
      date: BREAK_DATE,
      serviceIds: ["hijama-package"],
      participantGenders: ["female"],
      city: "Luton",
    },
    engineClient(rules),
    { now: FROZEN_NOW }
  );

  return result.slots.map((slot) => slot.time);
}

describe("scheduleToRows output against the live slot engine", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FROZEN_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers slots either side of the break and none across it", async () => {
    const times = await slotTimes(scheduleToRows(MONDAY_WITH_A_BREAK));

    // 60-minute service, 30-minute step: the last slot before the break must
    // END by 12:30, the first after it must START at 15:00.
    expect(times).toContain("11:30");
    expect(times).toContain("15:00");
    expect(times[times.length - 1]).toBe("19:00");

    for (const blocked of ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30"]) {
      expect(times).not.toContain(blocked);
    }
  });

  it("offers the whole span once the break is removed (control)", async () => {
    const times = await slotTimes(scheduleToRows(workingDay()));

    for (const offered of ["11:30", "12:00", "13:00", "14:30", "15:00", "19:00"]) {
      expect(times).toContain(offered);
    }
  });

  it("offers nothing on a closed day", async () => {
    const times = await slotTimes(
      scheduleToRows({ ...MONDAY_WITH_A_BREAK, isWorkingDay: false })
    );

    expect(times).toEqual([]);
  });
});
