import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { updateRoleMetadata } from "../actions";

/**
 * C-09 addendum (Owner-approved 2026-08-03, follow-up to the roles+services
 * cache-correctness fix). `updateRoleMetadata` writes roles.display_label
 * (among other columns) and an audit_logs row, but previously called no
 * `updateTag` (only `revalidatePath`). dashboard-data.ts's getDashboardData
 * unstable_cache wrap (tags incl. bookings, clients, enquiries, staff) reads
 * `roles(name, display_label)` via its staff join, so a role rename/relabel
 * was only self-healing after the ~60s revalidate window. Asserts the staff
 * + audit resource tags it now invalidates.
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

const ACTOR = { id: "staff-owner", name: "Owner" };
const ROLE_ID = "role-coordinator";

function stubAdminClient(options: { isSystem?: boolean } = {}) {
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
    // roles
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: ROLE_ID,
              name: "coordinator",
              display_label: "Coordinator",
              description: null,
              sort_order: 1,
              is_system: options.isSystem ?? false,
              active: true,
            },
            error: null,
          }),
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        updates.push(payload);
        return {
          eq: () => ({
            select: () => ({
              single: async () => ({
                data: { id: ROLE_ID, name: "coordinator", ...payload },
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

function formData(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set("role_id", overrides.role_id ?? ROLE_ID);
  data.set("display_label", overrides.display_label ?? "Coordinator");
  data.set("description", overrides.description ?? "");
  data.set("sort_order", overrides.sort_order ?? "1");
  data.set("active", overrides.active ?? "on");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateRoleMetadata — cache tag invalidation", () => {
  it("invalidates the staff and audit resource tags", async () => {
    vi.mocked(requirePermission).mockResolvedValue(ACTOR as never);
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await updateRoleMetadata({}, formData({ display_label: "Lead Coordinator" }));

    expect(result).toEqual({ success: true });
    expect(stub.updates).toHaveLength(1);
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

    const result = await updateRoleMetadata({}, formData());

    expect(result).toEqual({ error: "Insufficient permissions." });
    expect(stub.updates).toHaveLength(0);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("never calls updateTag when validation fails", async () => {
    vi.mocked(requirePermission).mockResolvedValue(ACTOR as never);
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await updateRoleMetadata({}, formData({ sort_order: "1000" }));

    expect(result).toEqual({
      error: "Sort order must be a whole number between 0 and 999.",
    });
    expect(stub.updates).toHaveLength(0);
    expect(updateTag).not.toHaveBeenCalled();
  });
});
