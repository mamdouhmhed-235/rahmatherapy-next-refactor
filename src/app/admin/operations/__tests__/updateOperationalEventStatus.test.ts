import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStaffProfile, PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { updateOperationalEventStatus } from "../actions";

/**
 * C-09 Phase B fix round — Owner-approved scope widening (chat 2026-08-02).
 * `updateOperationalEventStatus` mutates operational_events and writes an
 * audit_logs row, so it must invalidate the same tag set Phase C's
 * /admin/operations unstable_cache wrap will use (plan Step 5's table:
 * audit, bookings, settings) — otherwise resolving an event would leave the
 * page stale the moment Phase C lands.
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

const owner = staff("Owner", [PERMISSIONS.MANAGE_SETTINGS]);
const coordinator = staff("Coordinator", []);

const EVENT_ID = "event-1";

function stubAdminClient() {
  const audits: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];

  const from = vi.fn((table: string) => {
    if (table === "audit_logs") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          audits.push(row);
          return { error: null };
        }),
      };
    }
    // operational_events
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: EVENT_ID, status: "open" },
            error: null,
          }),
        }),
      }),
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return {
          eq: () => ({
            select: () => ({
              single: async () => ({
                data: { id: EVENT_ID, ...patch },
                error: null,
              }),
            }),
          }),
        };
      },
    };
  });

  return { client: { from }, audits, updates };
}

function formData(status = "acknowledged") {
  const data = new FormData();
  data.set("event_id", EVENT_ID);
  data.set("status", status);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateOperationalEventStatus — cache tag invalidation", () => {
  it("invalidates audit, bookings, and settings alongside the existing output tags", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(owner);
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await updateOperationalEventStatus(formData());

    expect(stub.updates).toHaveLength(1);
    expect(stub.audits).toHaveLength(1);
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "report-data",
      "dashboard-data",
      "audit",
      "bookings",
      "settings",
    ]);
  });

  it("never calls updateTag when the actor lacks permission", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(coordinator);
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await updateOperationalEventStatus(formData());

    expect(stub.updates).toHaveLength(0);
    expect(updateTag).not.toHaveBeenCalled();
  });
});
