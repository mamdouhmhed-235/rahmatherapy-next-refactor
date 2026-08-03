import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toggleRolePermission } from "../actions";

/**
 * C-09 addendum (Owner-approved 2026-08-03, closeout cache-correctness fix).
 * `toggleRolePermission` mutates role_permissions and writes an audit_logs
 * row, but previously called no `updateTag` (only `revalidatePath`).
 * staff-detail-data.ts's unstable_cache wrap (tags: staff, bookings, audit)
 * reads role_permissions to render a staff member's effective permissions,
 * so a grant/revoke was only self-healing after the ~60s revalidate window.
 * Asserts the staff + audit resource tags it now invalidates.
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
}));

const ACTOR = { id: "staff-owner", role_id: "role-owner", name: "Owner" };

const ROLE_ID = "role-coordinator";
const PERMISSION_ID = "perm-1";

function stubAdminClient(options: { existingGrant?: boolean } = {}) {
  const audits: Record<string, unknown>[] = [];
  const inserts: Record<string, unknown>[] = [];
  const deletes: { roleId: string; permissionId: string }[] = [];

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
            single: async () => ({
              data: { id: ROLE_ID, name: "coordinator" },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "permissions") {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { id: PERMISSION_ID, name: "manage_bookings" },
              error: null,
            }),
          }),
        }),
      };
    }
    // role_permissions
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: options.existingGrant ? { role_id: ROLE_ID } : null,
              error: null,
            }),
          }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          eq: async (permissionId: string) => {
            deletes.push({ roleId: ROLE_ID, permissionId });
            return { error: null };
          },
        }),
      }),
      insert: vi.fn(async (row: Record<string, unknown>) => {
        inserts.push(row);
        return { error: null };
      }),
    };
  });

  return { client: { from }, audits, inserts, deletes };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("toggleRolePermission — cache tag invalidation", () => {
  it("invalidates the staff and audit resource tags on grant", async () => {
    vi.mocked(requirePermission).mockResolvedValue(ACTOR as never);
    const stub = stubAdminClient({ existingGrant: false });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await toggleRolePermission(
      ROLE_ID,
      PERMISSION_ID,
      "manage_bookings",
      false
    );

    expect(result).toEqual({});
    expect(stub.inserts).toHaveLength(1);
    expect(stub.audits).toHaveLength(1);
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "staff",
      "audit",
    ]);
  });

  it("invalidates the staff and audit resource tags on revoke", async () => {
    vi.mocked(requirePermission).mockResolvedValue(ACTOR as never);
    const stub = stubAdminClient({ existingGrant: true });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await toggleRolePermission(
      ROLE_ID,
      PERMISSION_ID,
      "manage_bookings",
      true
    );

    expect(result).toEqual({});
    expect(stub.deletes).toHaveLength(1);
    expect(stub.audits).toHaveLength(1);
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "staff",
      "audit",
    ]);
  });

  it("never calls updateTag when the actor lacks permission", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error("forbidden"));
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await toggleRolePermission(
      ROLE_ID,
      PERMISSION_ID,
      "manage_bookings",
      false
    );

    expect(result).toEqual({ error: "Insufficient permissions." });
    expect(stub.inserts).toHaveLength(0);
    expect(stub.deletes).toHaveLength(0);
    expect(updateTag).not.toHaveBeenCalled();
  });
});
