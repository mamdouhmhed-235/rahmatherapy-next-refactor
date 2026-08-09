// C-14 Phase C, Step 13 — do per-DATE overrides carry breaks through the slot
// engine?
//
// This is the phase's only slot-engine change, and it sits under a live public
// customer surface (`/api/availability/month` feeds the real booking
// calendar), so nothing here is asserted from reading the code. Every spec
// drives real fixtures through the REAL `calculateAvailableSlots`, faking only
// the Supabase data layer — the same standard Phases A and B were held to.
//
// What changed, and where the bug actually lived:
//
//   availability.ts  `loadDayRecords`  buckets the (already batched, already
//                    array-shaped) override fetches per date. It kept the
//                    FIRST row per date and the FIRST row per staff+date, so a
//                    second window on a date was silently discarded before the
//                    engine ever saw it.
//   availability.ts  `resolveStaffWindows`  then did `normalizeWindows([one])`.
//
// Both now take every row. The two failure modes each spec has to separate:
//   * only the FIRST row consumed   -> the later window disappears entirely;
//   * all rows merged into one span -> slots offered straight across the break.
// Asserting either alone would pass against the other bug, so every break spec
// asserts both ends AND the gap.
//
// The negative controls feed the engine only the first row — byte-for-byte what
// a first-row-wins bucketing would hand it — and show the assertions genuinely
// fail there. (The source is not mutated: agents may not leave the tree dirty.)

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createFakeAdminClient } from "@/lib/cache/__tests__/fake-supabase-admin";
import { calculateAvailableSlots } from "../availability";

const FROZEN_NOW = new Date("2026-06-15T08:00:00.000Z"); // Mon 09:00 London
const BOOKING_DATE = "2026-06-16"; // Tuesday -> day_of_week 2
const DAY_OF_WEEK = 2;
const STAFF_ID = "staff-female-1";

interface Window {
  start_time: string;
  end_time: string;
}

interface StaffOverrideRow extends Window {
  override_type?: string | null;
}

function at(start_time: string, end_time: string): Window {
  return { start_time, end_time };
}

/** The clinic's ordinary Tuesday: one unbroken 08:00–20:00 stretch. */
const RECURRING_DAY = [{ ...at("08:00", "20:00"), is_working_day: true }];

/** An adjusted date: 08:00–12:30 and 15:00–20:00, i.e. a 12:30–15:00 break. */
const OVERRIDE_WITH_BREAK = [at("08:00", "12:30"), at("15:00", "20:00")];

/** 08:00–11:00, 12:00–15:00, 16:00–20:00 — two breaks, three rows. */
const OVERRIDE_WITH_TWO_BREAKS = [
  at("08:00", "11:00"),
  at("12:00", "15:00"),
  at("16:00", "20:00"),
];

function engineClient({
  availabilityMode = "use_global",
  globalOverrides = [],
  staffOverrides = [],
  blockedDates = [],
  staffBlockedDates = [],
}: {
  availabilityMode?: "custom" | "use_global";
  globalOverrides?: Window[];
  staffOverrides?: StaffOverrideRow[];
  blockedDates?: string[];
  staffBlockedDates?: string[];
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
      data: RECURRING_DAY.map((row) => ({ ...row, day_of_week: DAY_OF_WEEK })),
      error: null,
    },
    // Present and unbroken throughout, so any slot inside a break would prove
    // the override was bypassed rather than widened.
    staff_availability_rules: {
      data: RECURRING_DAY.map((row) => ({
        ...row,
        staff_id: STAFF_ID,
        day_of_week: DAY_OF_WEEK,
      })),
      error: null,
    },
    blocked_dates: {
      data: blockedDates.map((blocked_date) => ({ blocked_date })),
      error: null,
    },
    availability_overrides: {
      // The real query selects override_date/start_time/end_time only — global
      // overrides carry no override_type (closures are blocked_dates).
      data: globalOverrides.map((row) => ({ ...row, override_date: BOOKING_DATE })),
      error: null,
    },
    staff_blocked_dates: {
      data: staffBlockedDates.map((blocked_date) => ({
        staff_id: STAFF_ID,
        blocked_date,
      })),
      error: null,
    },
    staff_availability_overrides: {
      data: staffOverrides.map((row) => ({
        override_type: null,
        ...row,
        staff_id: STAFF_ID,
        override_date: BOOKING_DATE,
      })),
      error: null,
    },
    bookings: { data: [], error: null },
    booking_assignments: { data: [], error: null },
  }) as unknown as SupabaseClient;
}

async function slotTimes(options: Parameters<typeof engineClient>[0]) {
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

/** 60-minute service on a 30-minute step: none of these fit around 12:30–15:00. */
const ACROSS_THE_BREAK = ["12:00", "12:30", "13:00", "13:30", "14:00"];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("global override breaks", () => {
  it("honours BOTH windows of an adjusted date and offers nothing across the gap", async () => {
    const times = await slotTimes({ globalOverrides: OVERRIDE_WITH_BREAK });

    // First row honoured…
    expect(times[0]).toBe("08:00");
    expect(times).toContain("11:30");
    // …and the second, which first-row-wins bucketing dropped entirely.
    expect(times).toContain("15:00");
    expect(times[times.length - 1]).toBe("19:00");

    for (const blocked of ACROSS_THE_BREAK) {
      expect(times).not.toContain(blocked);
    }
  });

  it("negative control — first row only loses the whole afternoon", async () => {
    const times = await slotTimes({
      globalOverrides: [OVERRIDE_WITH_BREAK[0]],
    });

    expect(times).not.toContain("15:00");
    expect(times[times.length - 1]).toBe("11:30");
  });

  it("carries two breaks on one date", async () => {
    const times = await slotTimes({ globalOverrides: OVERRIDE_WITH_TWO_BREAKS });

    expect(times).toContain("08:00");
    expect(times).toContain("10:00");
    expect(times).toContain("12:00");
    expect(times).toContain("14:00");
    expect(times).toContain("16:00");
    expect(times[times.length - 1]).toBe("19:00");

    // 11:00–12:00 and 15:00–16:00 are the breaks.
    for (const blocked of ["10:30", "11:00", "11:30", "14:30", "15:00", "15:30"]) {
      expect(times).not.toContain(blocked);
    }
  });

  it("replaces the recurring hours for that date rather than adding to them", async () => {
    // The weekly Tuesday is an unbroken 08:00–20:00. If the override were
    // merged with it instead of replacing it, the break would vanish.
    const times = await slotTimes({ globalOverrides: OVERRIDE_WITH_BREAK });

    expect(times).not.toContain("13:00");
  });

  it("leaves a single-window override behaving exactly as before (control)", async () => {
    const times = await slotTimes({ globalOverrides: [at("10:00", "14:00")] });

    expect(times).toEqual(["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00"]);
  });
});

describe("staff override breaks", () => {
  it("honours BOTH windows of one staff member's adjusted date", async () => {
    const times = await slotTimes({
      availabilityMode: "custom",
      staffOverrides: OVERRIDE_WITH_BREAK,
    });

    expect(times[0]).toBe("08:00");
    expect(times).toContain("11:30");
    expect(times).toContain("15:00");
    expect(times[times.length - 1]).toBe("19:00");

    for (const blocked of ACROSS_THE_BREAK) {
      expect(times).not.toContain(blocked);
    }
  });

  it("negative control — first row only loses the whole afternoon", async () => {
    const times = await slotTimes({
      availabilityMode: "custom",
      staffOverrides: [OVERRIDE_WITH_BREAK[0]],
    });

    expect(times).not.toContain("15:00");
    expect(times[times.length - 1]).toBe("11:30");
  });

  it("honours all THREE rows when one staff+date carries two breaks", async () => {
    const times = await slotTimes({
      availabilityMode: "custom",
      staffOverrides: OVERRIDE_WITH_TWO_BREAKS,
    });

    expect(times).toContain("08:00");
    expect(times).toContain("12:00");
    expect(times).toContain("16:00");
    expect(times[times.length - 1]).toBe("19:00");

    for (const blocked of ["11:00", "15:00"]) {
      expect(times).not.toContain(blocked);
    }
  });

  it("negative control — the third row is the one first-row-wins never reached", async () => {
    const times = await slotTimes({
      availabilityMode: "custom",
      staffOverrides: [OVERRIDE_WITH_TWO_BREAKS[0]],
    });

    expect(times).not.toContain("12:00");
    expect(times).not.toContain("16:00");
    expect(times[times.length - 1]).toBe("10:00");
  });

  it("applies to a use_global staff member too, ahead of the global override", async () => {
    const times = await slotTimes({
      availabilityMode: "use_global",
      globalOverrides: [at("08:00", "20:00")],
      staffOverrides: OVERRIDE_WITH_BREAK,
    });

    expect(times).toContain("11:30");
    expect(times).toContain("15:00");
    for (const blocked of ACROSS_THE_BREAK) {
      expect(times).not.toContain(blocked);
    }
  });

  it("takes the staff override over the staff's own recurring rows", async () => {
    // The staff recurring Tuesday is an unbroken 08:00–20:00.
    const times = await slotTimes({
      availabilityMode: "custom",
      staffOverrides: OVERRIDE_WITH_BREAK,
    });

    expect(times).not.toContain("13:00");
  });
});

describe("closures stay full-day closures", () => {
  it("a blocking staff override closes the date even alongside an hours row", async () => {
    // A closure and a set of hours on the same date contradict each other. The
    // safe reading is the one that cannot over-offer — and before the widening,
    // whichever row arrived first decided it.
    const times = await slotTimes({
      availabilityMode: "custom",
      staffOverrides: [
        at("08:00", "12:30"),
        { ...at("15:00", "20:00"), override_type: "blocked" },
      ],
    });

    expect(times).toEqual([]);
  });

  it("a blocking staff override on its own closes the date", async () => {
    const times = await slotTimes({
      availabilityMode: "custom",
      staffOverrides: [{ ...at("09:00", "17:00"), override_type: "closed" }],
    });

    expect(times).toEqual([]);
  });

  it("a blocked_date closes the day even with an override carrying breaks", async () => {
    const times = await slotTimes({
      globalOverrides: OVERRIDE_WITH_BREAK,
      blockedDates: [BOOKING_DATE],
    });

    expect(times).toEqual([]);
  });

  it("a staff blocked_date closes that staff member's day", async () => {
    const times = await slotTimes({
      globalOverrides: OVERRIDE_WITH_BREAK,
      staffBlockedDates: [BOOKING_DATE],
    });

    expect(times).toEqual([]);
  });
});

describe("recurring days are untouched by the override widening", () => {
  it("control — no override at all still yields the full recurring day", async () => {
    const times = await slotTimes({});

    expect(times[0]).toBe("08:00");
    expect(times[times.length - 1]).toBe("19:00");
    // The whole day is bookable: nothing the override change could have leaked.
    for (const offered of ACROSS_THE_BREAK) {
      expect(times).toContain(offered);
    }
  });

  it("control — a recurring day with its own break still works (Phase A/B)", async () => {
    const client = createFakeAdminClient({
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
        data: OVERRIDE_WITH_BREAK.map((row) => ({
          ...row,
          day_of_week: DAY_OF_WEEK,
          is_working_day: true,
        })),
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

    const result = await calculateAvailableSlots(
      {
        date: BOOKING_DATE,
        serviceIds: ["hijama-package"],
        participantGenders: ["female"],
        city: "Luton",
      },
      client,
      { now: FROZEN_NOW }
    );
    const times = result.slots.map((slot) => slot.time);

    expect(times).toContain("11:30");
    expect(times).toContain("15:00");
    for (const blocked of ACROSS_THE_BREAK) {
      expect(times).not.toContain(blocked);
    }
  });
});
