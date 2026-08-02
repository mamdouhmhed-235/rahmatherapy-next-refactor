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
      return {
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: "override-1" }, error: null }),
          }),
        }),
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: "override-1", staff_id: STAFF_ID },
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
    throw new Error(`Unexpected table in staff availability actions test: ${table}`);
  });

  return { client: { from }, audits };
}

function blockedDateFormData() {
  const data = new FormData();
  data.set("staff_id", STAFF_ID);
  data.set("date", FUTURE_DATE);
  data.set("reason", "Holiday");
  return data;
}

function overrideFormData() {
  const data = new FormData();
  data.set("staff_id", STAFF_ID);
  data.set("date", FUTURE_DATE);
  data.set("start_time", "09:00");
  data.set("end_time", "12:00");
  data.set("reason", "Half day");
  return data;
}

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

    const result = await addStaffAvailabilityOverride({}, overrideFormData());

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

    const result = await deleteStaffAvailabilityOverride(STAFF_ID, "override-1");

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
