// C-14 Phase C, Step 13a — the admin-side twin of the slot engine's override
// widening.
//
// `getStaffAssignmentPreviews` read the date's global override with
// `.maybeSingle()`. Once the Step 12 migration lets a date hold several rows
// that is not merely incomplete, it is silently WRONG: PostgREST answers a
// multi-row match with an error, nothing in this file inspects `.error`, so the
// override would evaporate and eligibility would fall through to the clinic's
// ordinary weekly hours — quietly marking a therapist assignable during a
// break. The staff-override Map had the matching flaw from the other end: built
// with `new Map(rows.map(...))`, duplicate keys kept the LAST row.
//
// Every spec below runs the real `getStaffAssignmentPreviews` with only the
// Supabase layer faked, and the weekly rules are deliberately an unbroken
// 08:00–20:00 so a fall-through to them is visible as a WRONG "Eligible"
// rather than as a missing result.

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createFakeAdminClient } from "@/lib/cache/__tests__/fake-supabase-admin";
import {
  getStaffAssignmentPreviews,
  type AssignmentEligibilityBooking,
} from "../assignment-eligibility";

const BOOKING_DATE = "2026-06-16"; // Tuesday
const DAY_OF_WEEK = 2;
const STAFF_ID = "staff-female-1";

interface Window {
  start_time: string;
  end_time: string;
}

interface OverrideRow extends Window {
  override_type?: string | null;
}

function at(start_time: string, end_time: string): Window {
  return { start_time, end_time };
}

/** 08:00–12:30 and 15:00–20:00 — a 12:30–15:00 break. */
const OVERRIDE_WITH_BREAK = [at("08:00", "12:30"), at("15:00", "20:00")];

function booking(start_time: string, end_time: string): AssignmentEligibilityBooking {
  return { id: "booking-1", booking_date: BOOKING_DATE, start_time, end_time };
}

function client({
  availabilityMode = "use_global",
  globalOverrides = [],
  staffOverrides = [],
}: {
  availabilityMode?: "custom" | "use_global";
  globalOverrides?: OverrideRow[];
  staffOverrides?: OverrideRow[];
}) {
  return createFakeAdminClient({
    staff_profiles: {
      data: [
        {
          id: STAFF_ID,
          name: "Amina",
          email: "amina@rahmatherapy.example.test",
          active: true,
          can_take_bookings: true,
          gender: "female",
          role_id: "role-therapist",
          availability_mode: availabilityMode,
        },
      ],
      error: null,
    },
    business_settings: { data: { buffer_time_mins: 0 }, error: null },
    role_permissions: {
      data: [{ role_id: "role-therapist", permissions: { name: "claim_assignments" } }],
      error: null,
    },
    staff_permission_overrides: { data: [], error: null },
    blocked_dates: { data: [], error: null },
    availability_overrides: { data: globalOverrides, error: null },
    // Unbroken on purpose: a fall-through to the weekly hours shows up as an
    // incorrect "Eligible" during the break.
    availability_rules: {
      data: [{ ...at("08:00", "20:00"), day_of_week: DAY_OF_WEEK, is_working_day: true }],
      error: null,
    },
    staff_blocked_dates: { data: [], error: null },
    staff_availability_overrides: {
      data: staffOverrides.map((row) => ({
        override_type: null,
        ...row,
        staff_id: STAFF_ID,
      })),
      error: null,
    },
    staff_availability_rules: {
      data: [
        {
          ...at("08:00", "20:00"),
          staff_id: STAFF_ID,
          day_of_week: DAY_OF_WEEK,
          is_working_day: true,
        },
      ],
      error: null,
    },
    booking_assignments: { data: [], error: null },
  }) as unknown as SupabaseClient;
}

async function previewFor(
  slot: AssignmentEligibilityBooking,
  options: Parameters<typeof client>[0]
) {
  const previews = await getStaffAssignmentPreviews({
    booking: slot,
    requiredGender: "female",
    supabase: client(options),
  });

  return previews[0];
}

describe("assignment eligibility — global override with a break", () => {
  it("keeps the morning window assignable", async () => {
    const preview = await previewFor(booking("11:00", "12:00"), {
      globalOverrides: OVERRIDE_WITH_BREAK,
    });

    expect(preview).toMatchObject({ eligible: true, reason: "Eligible" });
  });

  it("keeps the afternoon window assignable — the row first-row-wins dropped", async () => {
    const preview = await previewFor(booking("15:00", "16:00"), {
      globalOverrides: OVERRIDE_WITH_BREAK,
    });

    expect(preview).toMatchObject({ eligible: true, reason: "Eligible" });
  });

  it("refuses a booking sitting inside the break", async () => {
    // The weekly rules cover 13:00. Under the old `.maybeSingle()` the two-row
    // date returned an unchecked error, the override became undefined, and this
    // fell through to those rules and answered "Eligible".
    const preview = await previewFor(booking("13:00", "14:00"), {
      globalOverrides: OVERRIDE_WITH_BREAK,
    });

    expect(preview).toMatchObject({ eligible: false, reason: "Out of availability" });
  });

  it("negative control — with only the first row, the afternoon is not assignable", async () => {
    const preview = await previewFor(booking("15:00", "16:00"), {
      globalOverrides: [OVERRIDE_WITH_BREAK[0]],
    });

    expect(preview).toMatchObject({ eligible: false, reason: "Out of availability" });
  });

  it("a single-window override still behaves exactly as before (control)", async () => {
    expect(
      await previewFor(booking("11:00", "12:00"), {
        globalOverrides: [at("10:00", "14:00")],
      })
    ).toMatchObject({ eligible: true });

    expect(
      await previewFor(booking("15:00", "16:00"), {
        globalOverrides: [at("10:00", "14:00")],
      })
    ).toMatchObject({ eligible: false, reason: "Out of availability" });
  });
});

describe("assignment eligibility — staff override with a break", () => {
  it("honours both of a staff member's windows", async () => {
    expect(
      await previewFor(booking("11:00", "12:00"), {
        availabilityMode: "custom",
        staffOverrides: OVERRIDE_WITH_BREAK,
      })
    ).toMatchObject({ eligible: true });

    // Previously the Map kept the LAST row, so the morning was the casualty
    // here and the afternoon the casualty on the global side.
    expect(
      await previewFor(booking("15:00", "16:00"), {
        availabilityMode: "custom",
        staffOverrides: OVERRIDE_WITH_BREAK,
      })
    ).toMatchObject({ eligible: true });
  });

  it("refuses a booking inside the staff member's break", async () => {
    const preview = await previewFor(booking("13:00", "14:00"), {
      availabilityMode: "custom",
      staffOverrides: OVERRIDE_WITH_BREAK,
    });

    expect(preview).toMatchObject({ eligible: false, reason: "Out of availability" });
  });

  it("negative control — last-row-wins would have lost the morning", async () => {
    const preview = await previewFor(booking("11:00", "12:00"), {
      availabilityMode: "custom",
      staffOverrides: [OVERRIDE_WITH_BREAK[1]],
    });

    expect(preview).toMatchObject({ eligible: false, reason: "Out of availability" });
  });

  it("a blocking row closes the date even alongside an hours row", async () => {
    const preview = await previewFor(booking("11:00", "12:00"), {
      availabilityMode: "custom",
      staffOverrides: [
        at("08:00", "12:30"),
        { ...at("15:00", "20:00"), override_type: "blocked" },
      ],
    });

    expect(preview).toMatchObject({ eligible: false, reason: "Staff unavailable" });
  });
});
