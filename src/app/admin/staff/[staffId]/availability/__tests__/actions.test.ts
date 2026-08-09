import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  addStaffAvailabilityOverride,
  addStaffBlockedDate,
  deleteStaffAvailabilityOverride,
  deleteStaffBlockedDate,
} from "../actions";
import type { DaySchedule } from "@/lib/booking/working-hours-segments";

/**
 * C-09 Phase B fix round — Step 3 spec coverage, plus the fix itself: all
 * four per-staff availability mutations here now add TAGS.BOOKINGS
 * alongside TAGS.STAFF (per-staff availability affects booking
 * eligibility, same rationale as the global-scope siblings in
 * availability/actions.ts).
 */

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

function staff(name: string, permissions: string[]): StaffProfile {
  return {
    id: `staff-${name}`,
    auth_user_id: `auth-${name}`,
    name,
    email: `${name}@rahmatherapy.example.test`,
    role_id: `role-${name}`,
    role_name: name,
    gender: "female",
    active: true,
    can_take_bookings: false,
    availability_mode: "use_global",
    permissions: new Set(permissions),
  } as StaffProfile;
}

const owner = staff("Owner", [PERMISSIONS.MANAGE_AVAILABILITY_GLOBAL]);
const STAFF_ID = "staff-target";
const FUTURE_DATE = "2099-01-01";

function stubAdminClient() {
  const audits: Record<string, unknown>[] = [];
  const overrideInserts: unknown[] = [];
  const overrideDeletes: unknown[] = [];
  /** Rows the duplicate-date pre-check finds. Empty = the date is free. */
  let existingOverrideRows: unknown[] = [];

  const from = vi.fn((table: string) => {
    if (table === "audit_logs") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          audits.push(row);
          return { error: null };
        }),
      };
    }
    if (table === "staff_blocked_dates") {
      return {
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: "blocked-1" }, error: null }),
          }),
        }),
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: "blocked-1", staff_id: STAFF_ID },
                error: null,
              }),
            }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            eq: async () => ({ error: null }),
          }),
        }),
      };
    }
    if (table === "staff_availability_overrides") {
      // C-14 Phase C Step 12a/14 — a date is now N segment rows. The duplicate
      // pre-check ends in .limit(1); the delete's before-state read ends in the
      // second .eq(); the insert takes an array.
      const rows = [
        { id: "override-1", staff_id: STAFF_ID, override_date: FUTURE_DATE },
      ];
      return {
        insert: (payload: unknown) => {
          overrideInserts.push(payload);
          return {
            select: async () => ({
              data: [{ id: "override-1" }],
              error: null,
            }),
          };
        },
        select: () => ({
          eq: () => ({
            eq: () => ({
              // The delete path's before-state read awaits here…
              then: (
                onFulfilled?: (value: unknown) => unknown,
                onRejected?: (reason: unknown) => unknown
              ) =>
                Promise.resolve({ data: rows, error: null }).then(
                  onFulfilled,
                  onRejected
                ),
              // …and the duplicate pre-check ends in .limit(1).
              // `existingOverrideRows` is what a spec swaps to make the date
              // look already taken.
              limit: async () => ({ data: existingOverrideRows, error: null }),
            }),
          }),
        }),
        delete: () => ({
          eq: (_column: string, value: unknown) => ({
            eq: async () => {
              overrideDeletes.push(value);
              return { error: null };
            },
          }),
        }),
      };
    }
    throw new Error(`Unexpected table in staff availability actions test: ${table}`);
  });

  return {
    client: { from },
    audits,
    overrideInserts,
    overrideDeletes,
    setExistingOverrideRows(next: unknown[]) {
      existingOverrideRows = next;
    },
  };
}

function blockedDateFormData() {
  const data = new FormData();
  data.set("staff_id", STAFF_ID);
  data.set("date", FUTURE_DATE);
  data.set("reason", "Holiday");
  return data;
}

/** 09:00–17:00 with a 12:30–13:30 break — two bookable segments. */
const OVERRIDE_WITH_BREAK: DaySchedule = {
  isWorkingDay: true,
  opens: "09:00",
  closes: "17:00",
  breaks: [{ start: "12:30", end: "13:30" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStaffProfile).mockResolvedValue(owner);
});

describe("staff/[staffId]/availability/actions.ts — cache tag invalidation (fix)", () => {
  it("addStaffBlockedDate invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await addStaffBlockedDate({}, blockedDateFormData());

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "report-data",
      "dashboard-data",
      "staff",
      "bookings",
      "audit",
    ]);
  });

  it("deleteStaffBlockedDate invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await deleteStaffBlockedDate(STAFF_ID, "blocked-1");

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "report-data",
      "dashboard-data",
      "staff",
      "bookings",
      "audit",
    ]);
  });

  it("addStaffAvailabilityOverride invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await addStaffAvailabilityOverride(
      STAFF_ID,
      FUTURE_DATE,
      OVERRIDE_WITH_BREAK,
      "Half day"
    );

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "report-data",
      "dashboard-data",
      "staff",
      "bookings",
      "audit",
    ]);
  });

  it("deleteStaffAvailabilityOverride invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await deleteStaffAvailabilityOverride(STAFF_ID, FUTURE_DATE);

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "report-data",
      "dashboard-data",
      "staff",
      "bookings",
      "audit",
    ]);
  });
});

/**
 * C-14 Phase C Step 12a — the migration drops the
 * `(staff_id, override_date)` unique, and with it the SQLSTATE 23505 this
 * action used to catch for its duplicate-date message. That guard would not
 * have started erroring; it would have silently stopped guarding, letting a
 * second "Add override" stack another whole set of hours onto the date. These
 * specs pin the explicit pre-check that replaces it, and the segments write.
 */
describe("addStaffAvailabilityOverride — segments + duplicate-date guard", () => {
  it("writes one row per bookable segment, so a break survives the save", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await addStaffAvailabilityOverride(
      STAFF_ID,
      FUTURE_DATE,
      OVERRIDE_WITH_BREAK,
      "Half day"
    );

    expect(stub.overrideInserts).toEqual([
      [
        {
          staff_id: STAFF_ID,
          override_date: FUTURE_DATE,
          start_time: "09:00",
          end_time: "12:30",
          reason: "Half day",
        },
        {
          staff_id: STAFF_ID,
          override_date: FUTURE_DATE,
          start_time: "13:30",
          end_time: "17:00",
          reason: "Half day",
        },
      ],
    ]);
  });

  it("several segments in ONE call are the intended multi-row write", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await addStaffAvailabilityOverride(
      STAFF_ID,
      FUTURE_DATE,
      { ...OVERRIDE_WITH_BREAK, breaks: [
        { start: "11:00", end: "11:30" },
        { start: "14:00", end: "15:00" },
      ] },
      ""
    );

    // Three segments, no duplicate-date complaint: the guard is about a SECOND
    // call for a date that already has rows, not about a multi-segment one.
    expect(result.fieldErrors).toBeUndefined();
    expect((stub.overrideInserts[0] as unknown[]).length).toBe(3);
  });

  it("rejects a date that already has rows with the same message as before", async () => {
    const stub = stubAdminClient();
    stub.setExistingOverrideRows([{ id: "override-existing" }]);
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await addStaffAvailabilityOverride(
      STAFF_ID,
      FUTURE_DATE,
      OVERRIDE_WITH_BREAK,
      ""
    );

    expect(result.fieldErrors?.date).toBe(
      "That date already has an adjustment. Delete the existing one first."
    );
    expect(stub.overrideInserts).toEqual([]);
  });

  it("refuses a break that falls outside the date's hours", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await addStaffAvailabilityOverride(
      STAFF_ID,
      FUTURE_DATE,
      { ...OVERRIDE_WITH_BREAK, breaks: [{ start: "12:30", end: "23:00" }] },
      ""
    );

    expect(result.fieldErrors?.start_time).toBe(
      "Break 1 has to sit between 09:00 and 17:00."
    );
    expect(stub.overrideInserts).toEqual([]);
  });

  it("refuses a malformed date", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await addStaffAvailabilityOverride(
      STAFF_ID,
      "not-a-date",
      OVERRIDE_WITH_BREAK,
      ""
    );

    expect(result.fieldErrors?.date).toBe("Pick a date.");
    expect(stub.overrideInserts).toEqual([]);
  });
});

describe("deleteStaffAvailabilityOverride — by date", () => {
  it("removes every segment of the date, not one row", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await deleteStaffAvailabilityOverride(STAFF_ID, FUTURE_DATE);

    expect(result.error).toBeUndefined();
    expect(stub.overrideDeletes).toEqual([FUTURE_DATE]);
    expect(stub.audits[0].before_state).toEqual([
      { id: "override-1", staff_id: STAFF_ID, override_date: FUTURE_DATE },
    ]);
  });

  it("rejects a row id instead of deleting", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await deleteStaffAvailabilityOverride(STAFF_ID, "override-1");

    expect(result.error).toBe("Missing override reference.");
    expect(stub.overrideDeletes).toEqual([]);
  });
});
