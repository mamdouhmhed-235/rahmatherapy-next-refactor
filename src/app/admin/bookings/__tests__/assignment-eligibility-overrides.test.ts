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
import {
  createFakeAdminClient,
  type FakeQueryResult,
} from "@/lib/cache/__tests__/fake-supabase-admin";
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

// The specs above use `client()`, whose fake `.select()` is a pure
// passthrough — it never checks the requested columns against anything, so
// it could not have caught `assignment-eligibility.ts` selecting
// `override_type` from `availability_overrides`, a column that table does
// not have (confirmed live via `information_schema.columns`:
// `availability_overrides` is id, override_date, start_time, end_time,
// reason — no `override_type`). PostgREST answers that with a 42703 error;
// nothing in `getStaffAssignmentPreviews` inspects `.error`, so the override
// silently evaporated and eligibility fell through to the plain weekly
// rules. `schemaCheckedClient` below re-creates that failure mode: a
// `.select()` naming a column outside a table's REAL column set resolves the
// way Postgres really answers it.
const REAL_OVERRIDE_TABLE_COLUMNS: Record<string, ReadonlySet<string>> = {
  availability_overrides: new Set(["id", "override_date", "start_time", "end_time", "reason"]),
  staff_availability_overrides: new Set([
    "id",
    "staff_id",
    "override_date",
    "start_time",
    "end_time",
    "override_type",
    "reason",
  ]),
};

function schemaErrorChain(result: FakeQueryResult) {
  const chain: Record<string, unknown> = {};
  const passthrough = ["select", "eq", "in", "is", "not", "order", "limit", "returns"];
  for (const method of passthrough) chain[method] = () => chain;
  chain.single = async () => result;
  chain.maybeSingle = async () => result;
  chain.then = (
    onFulfilled?: (value: FakeQueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return chain;
}

function schemaCheckedClient(tables: Record<string, FakeQueryResult>) {
  const base = createFakeAdminClient(tables) as unknown as {
    from: (table: string) => Record<string, unknown>;
  };

  return {
    from(table: string) {
      const knownColumns = REAL_OVERRIDE_TABLE_COLUMNS[table];
      const builder = base.from(table);
      if (!knownColumns) return builder;

      return {
        ...builder,
        select: (cols: string) => {
          const requested = cols.split(",").map((column) => column.trim());
          const badColumn = requested.find((column) => !knownColumns.has(column));
          return badColumn
            ? schemaErrorChain({
                data: null,
                error: { code: "42703", message: `column "${badColumn}" does not exist` },
              })
            : (builder.select as (cols: string) => unknown)(cols);
        },
      };
    },
  };
}

describe("assignment eligibility — override selects against the real table columns", () => {
  it("a global override with a break genuinely excludes the gap", async () => {
    const supabase = schemaCheckedClient({
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
            availability_mode: "use_global",
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
      // Exactly the real column set: no `override_type`.
      availability_overrides: { data: OVERRIDE_WITH_BREAK, error: null },
      // Unbroken on purpose: a fall-through to the weekly hours shows up as
      // an incorrect "Eligible" during the break.
      availability_rules: {
        data: [{ ...at("08:00", "20:00"), day_of_week: DAY_OF_WEEK, is_working_day: true }],
        error: null,
      },
      staff_blocked_dates: { data: [], error: null },
      staff_availability_overrides: { data: [], error: null },
      staff_availability_rules: { data: [], error: null },
      booking_assignments: { data: [], error: null },
    }) as unknown as SupabaseClient;

    const previews = await getStaffAssignmentPreviews({
      booking: booking("13:00", "14:00"), // inside the 12:30-15:00 gap
      requiredGender: "female",
      supabase,
    });

    expect(previews[0]).toMatchObject({ eligible: false, reason: "Out of availability" });
  });

  it("the staff override select naming override_type stays valid — that column is real there", async () => {
    const supabase = schemaCheckedClient({
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
            availability_mode: "custom",
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
      availability_overrides: { data: [], error: null },
      availability_rules: { data: [], error: null },
      staff_blocked_dates: { data: [], error: null },
      staff_availability_overrides: {
        data: [
          { staff_id: STAFF_ID, ...at("08:00", "12:30"), override_type: null },
          { staff_id: STAFF_ID, ...at("15:00", "20:00"), override_type: "blocked" },
        ],
        error: null,
      },
      staff_availability_rules: { data: [], error: null },
      booking_assignments: { data: [], error: null },
    }) as unknown as SupabaseClient;

    const previews = await getStaffAssignmentPreviews({
      booking: booking("11:00", "12:00"),
      requiredGender: "female",
      supabase,
    });

    expect(previews[0]).toMatchObject({ eligible: false, reason: "Staff unavailable" });
  });
});
