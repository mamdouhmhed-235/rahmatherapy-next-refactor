import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS, requirePermission, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createStaffAvailabilityRule,
  createStaffProfile,
  deleteStaffAvailabilityRule,
  updateStaffAvailabilityMode,
  updateStaffPermissionOverride,
  updateStaffProfile,
} from "../actions";

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

  return { client: { from }, audits };
}

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
