import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS, requirePermission, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createStaffAvailabilityRule,
  createStaffProfile,
  deleteStaffAvailabilityRule,
  saveStaffAvailabilityDay,
  updateStaffAvailabilityMode,
  updateStaffPermissionOverride,
  updateStaffProfile,
} from "../actions";
import type { DaySchedule } from "@/lib/booking/working-hours-segments";

/**
 * C-09 Phase B fix round — Step 3 spec coverage for staff/actions.ts's
 * mutations, none of which had a dedicated tag-assertion spec. Also covers
 * the fix itself: createStaffAvailabilityRule / deleteStaffAvailabilityRule
 * now add TAGS.BOOKINGS alongside TAGS.STAFF (per-staff availability
 * affects booking eligibility, same rationale as the global-scope siblings
 * in availability/actions.ts).
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
  requirePermission: vi.fn(),
  getStaffProfile: vi.fn(),
}));

const { getStaffProfile } = await import("@/lib/auth/rbac");

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

const owner = staff("Owner", [
  PERMISSIONS.MANAGE_STAFF_PROFILES,
  PERMISSIONS.ASSIGN_STAFF_ROLES,
  PERMISSIONS.MANAGE_AVAILABILITY_GLOBAL,
  PERMISSIONS.MANAGE_PERMISSION_OVERRIDES,
]);

const TARGET_STAFF_ID = "staff-target";

/** Generic per-table stub covering exactly the queries these actions issue. */
function stubAdminClient() {
  const audits: Record<string, unknown>[] = [];

  // C-14 Phase B Step 10 — the per-staff day save is a single RPC so the delete
  // and the insert share one transaction; it hands back the day's rows either
  // side of the swap for the audit entry.
  const rpc = vi.fn<
    (
      name: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  >(async () => ({
    data: {
      before: [{ id: "rule-old", start_time: "09:00:00", end_time: "17:00:00" }],
      after: [{ id: "rule-new", start_time: "08:00:00", end_time: "12:30:00" }],
    },
    error: null,
  }));

  const from = vi.fn((table: string) => {
    if (table === "audit_logs") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          audits.push(row);
          return { error: null };
        }),
      };
    }
    if (table === "roles") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => ({ data: { id: "role-1" }, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === "role_permissions") {
      // No critical-admin permissions on the role — keeps the
      // wasCriticalAdmin/last-admin guard out of the way for these specs.
      return {
        select: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      };
    }
    if (table === "staff_profiles") {
      return {
        select: (columns: string) => ({
          eq: () => ({
            single: async () => ({
              data:
                columns === "availability_mode"
                  ? { availability_mode: "use_global" }
                  : { id: TARGET_STAFF_ID, active: true, role_id: "role-1" },
              error: null,
            }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: "new-staff-1" }, error: null }),
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: () => ({
            select: () => ({
              single: async () => ({
                data: { id: TARGET_STAFF_ID, active: true, role_id: "role-1", ...patch },
                error: null,
              }),
            }),
          }),
        }),
      };
    }
    if (table === "staff_availability_rules") {
      return {
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: "rule-1" }, error: null }),
          }),
        }),
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: "rule-1", staff_id: TARGET_STAFF_ID },
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
    if (table === "permissions") {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { id: "perm-1", name: PERMISSIONS.MANAGE_ENQUIRIES, active: true },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "staff_permission_overrides") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
        upsert: async () => ({ error: null }),
      };
    }
    throw new Error(`Unexpected table in staff actions test: ${table}`);
  });

  return { client: { from, rpc }, audits, rpc };
}

/** Monday 08:00–20:00 with a 12:30–15:00 break. */
const MONDAY_WITH_BREAK: DaySchedule = {
  isWorkingDay: true,
  opens: "08:00",
  closes: "20:00",
  breaks: [{ start: "12:30", end: "15:00" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue(owner);
  vi.mocked(getStaffProfile).mockResolvedValue(owner);
});

describe("staff/actions.ts — cache tag invalidation", () => {
  it("createStaffProfile invalidates staff + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await createStaffProfile({
      name: "New Therapist",
      email: "new@rahmatherapy.example.test",
      role_id: "role-1",
      gender: "female",
    });

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "report-data",
      "dashboard-data",
      "staff",
      "audit",
    ]);
  });

  it("updateStaffProfile invalidates staff + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await updateStaffProfile(TARGET_STAFF_ID, { phone: "07000000000" });

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "report-data",
      "dashboard-data",
      "staff",
      "audit",
    ]);
  });

  it("updateStaffAvailabilityMode invalidates staff + audit (no bookings tag — not part of this fix)", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await updateStaffAvailabilityMode(TARGET_STAFF_ID, "custom");

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "report-data",
      "dashboard-data",
      "staff",
      "audit",
    ]);
  });

  it("createStaffAvailabilityRule invalidates staff + bookings + audit (fix)", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await createStaffAvailabilityRule(TARGET_STAFF_ID, {
      day_of_week: 1,
      start_time: "09:00",
      end_time: "17:00",
      is_working_day: true,
    });

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "report-data",
      "dashboard-data",
      "staff",
      "bookings",
      "audit",
    ]);
  });

  it("deleteStaffAvailabilityRule invalidates staff + bookings + audit (fix)", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await deleteStaffAvailabilityRule(TARGET_STAFF_ID, "rule-1");

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "report-data",
      "dashboard-data",
      "staff",
      "bookings",
      "audit",
    ]);
  });

  it("saveStaffAvailabilityDay invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await saveStaffAvailabilityDay(
      TARGET_STAFF_ID,
      1,
      MONDAY_WITH_BREAK
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

  it("updateStaffPermissionOverride invalidates staff + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await updateStaffPermissionOverride(
      TARGET_STAFF_ID,
      "perm-1",
      "grant"
    );

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "report-data",
      "dashboard-data",
      "staff",
      "audit",
    ]);
  });
});

/**
 * C-14 Phase B Step 10. The RPC is what makes the day's delete + insert one
 * transaction: without it a failed insert leaves the day with ZERO rows, and
 * `getRuleWindowsForDay` reads a staff day with no rows as CLOSED — silently
 * taking that therapist off the rota for that weekday.
 */
describe("saveStaffAvailabilityDay — segments", () => {
  it("sends every segment of the day, so a break survives the save", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await saveStaffAvailabilityDay(TARGET_STAFF_ID, 1, MONDAY_WITH_BREAK);

    expect(stub.rpc).toHaveBeenCalledWith("save_staff_availability_day", {
      p_staff_id: TARGET_STAFF_ID,
      p_day_of_week: 1,
      p_segments: [
        { start_time: "08:00", end_time: "12:30", is_working_day: true },
        { start_time: "15:00", end_time: "20:00", is_working_day: true },
      ],
    });
  });

  it("writes a closed day as one is_working_day:false row that keeps the hours", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await saveStaffAvailabilityDay(TARGET_STAFF_ID, 0, {
      ...MONDAY_WITH_BREAK,
      isWorkingDay: false,
    });

    expect(stub.rpc).toHaveBeenCalledWith("save_staff_availability_day", {
      p_staff_id: TARGET_STAFF_ID,
      p_day_of_week: 0,
      p_segments: [
        { start_time: "08:00", end_time: "20:00", is_working_day: false },
      ],
    });
  });

  it("audits the rows the RPC reports from either side of the swap", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await saveStaffAvailabilityDay(TARGET_STAFF_ID, 1, MONDAY_WITH_BREAK);

    expect(stub.audits).toHaveLength(1);
    expect(stub.audits[0]).toMatchObject({
      actor_staff_id: owner.id,
      action_type: "staff_availability_rules_updated",
      target_type: "staff_availability_rules",
      target_id: TARGET_STAFF_ID,
    });
    expect(stub.audits[0].before_state).toEqual([
      { id: "rule-old", start_time: "09:00:00", end_time: "17:00:00" },
    ]);
    expect(stub.audits[0].after_state).toEqual([
      { id: "rule-new", start_time: "08:00:00", end_time: "12:30:00" },
    ]);
  });

  it("refuses a schedule whose breaks fall outside the working day", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await saveStaffAvailabilityDay(TARGET_STAFF_ID, 1, {
      ...MONDAY_WITH_BREAK,
      breaks: [{ start: "12:30", end: "23:00" }],
    });

    expect(result.fieldErrors?.start_time).toBe(
      "Break 1 has to sit between 08:00 and 20:00."
    );
    expect(stub.rpc).not.toHaveBeenCalled();
  });

  it("refuses a day outside 0..6", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await saveStaffAvailabilityDay(
      TARGET_STAFF_ID,
      7,
      MONDAY_WITH_BREAK
    );

    expect(result.fieldErrors?.day_of_week).toBe("Choose a valid day.");
    expect(stub.rpc).not.toHaveBeenCalled();
  });

  it("surfaces an RPC failure instead of reporting success", async () => {
    const stub = stubAdminClient();
    stub.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied for table staff_availability_rules" },
    } as never);
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await saveStaffAvailabilityDay(
      TARGET_STAFF_ID,
      1,
      MONDAY_WITH_BREAK
    );

    expect(result.error).toBe(
      "permission denied for table staff_availability_rules"
    );
    expect(result.success).toBeUndefined();
    expect(stub.audits).toHaveLength(0);
  });

  it("refuses a caller with neither global nor own availability permission", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);
    vi.mocked(requirePermission).mockRejectedValue(new Error("denied"));

    const result = await saveStaffAvailabilityDay(
      TARGET_STAFF_ID,
      1,
      MONDAY_WITH_BREAK
    );

    expect(result.error).toBe("Insufficient permissions.");
    expect(stub.rpc).not.toHaveBeenCalled();
  });
});
