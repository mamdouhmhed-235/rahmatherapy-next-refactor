import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createService, deleteService, updateService } from "../actions";

/**
 * C-09 addendum (Owner-approved 2026-08-03, closeout cache-correctness fix).
 * `createService` / `updateService` / `deleteService` mutate `services` and
 * write an audit_logs row, but previously called no `updateTag` (only
 * `revalidatePath`). bookings-list-data.ts's `getBookingsChromeData`
 * unstable_cache wrap (tags: bookings, clients, staff) reads `services` for
 * the /admin/bookings filter dropdown, so a new/renamed/deleted service was
 * missing or stale there for up to ~60s. Asserts the bookings + audit
 * resource tags each mutation now invalidates.
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
const SERVICE_ID = "service-1";

function stubAdminClient(options: { bookingItemCount?: number } = {}) {
  const audits: Record<string, unknown>[] = [];
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const deletes: string[] = [];

  const from = vi.fn((table: string) => {
    if (table === "audit_logs") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          audits.push(row);
          return { error: null };
        }),
      };
    }
    if (table === "booking_items") {
      return {
        select: () => ({
          eq: async () => ({
            count: options.bookingItemCount ?? 0,
            error: null,
          }),
        }),
      };
    }
    // services
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: SERVICE_ID, name: "Deep Tissue Massage" },
            error: null,
          }),
        }),
      }),
      insert: (row: Record<string, unknown>) => {
        inserts.push(row);
        return {
          select: () => ({
            single: async () => ({
              data: { id: SERVICE_ID, ...row },
              error: null,
            }),
          }),
        };
      },
      update: (row: Record<string, unknown>) => {
        updates.push(row);
        return {
          eq: () => ({
            select: () => ({
              single: async () => ({
                data: { id: SERVICE_ID, ...row },
                error: null,
              }),
            }),
          }),
        };
      },
      delete: () => ({
        eq: async (serviceId: string) => {
          deletes.push(serviceId);
          return { error: null };
        },
      }),
    };
  });

  return { client: { from }, audits, inserts, updates, deletes };
}

function formData(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set("name", overrides.name ?? "Deep Tissue Massage");
  data.set("slug", overrides.slug ?? "");
  data.set("gender_restrictions", overrides.gender_restrictions ?? "any");
  data.set("price", overrides.price ?? "50");
  data.set("duration_mins", overrides.duration_mins ?? "60");
  data.set("display_order", overrides.display_order ?? "1");
  data.set("is_active", overrides.is_active ?? "on");
  data.set("is_visible_on_frontend", overrides.is_visible_on_frontend ?? "on");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue(ACTOR as never);
});

describe("services/actions.ts — cache tag invalidation", () => {
  it("createService invalidates the bookings and audit resource tags", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await createService({}, formData());

    expect(result).toEqual({ success: true });
    expect(stub.inserts).toHaveLength(1);
    expect(stub.audits).toHaveLength(1);
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "bookings",
      "audit",
    ]);
  });

  it("updateService invalidates the bookings and audit resource tags", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await updateService(SERVICE_ID, {}, formData());

    expect(result).toEqual({ success: true });
    expect(stub.updates).toHaveLength(1);
    expect(stub.audits).toHaveLength(1);
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "bookings",
      "audit",
    ]);
  });

  it("deleteService invalidates the bookings and audit resource tags", async () => {
    const stub = stubAdminClient({ bookingItemCount: 0 });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await deleteService(SERVICE_ID);

    expect(result).toEqual({});
    expect(stub.deletes).toHaveLength(1);
    expect(stub.audits).toHaveLength(1);
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "bookings",
      "audit",
    ]);
  });

  it("never calls updateTag when the actor lacks permission", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error("forbidden"));
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await createService({}, formData());

    expect(result).toEqual({ error: "Insufficient permissions." });
    expect(stub.inserts).toHaveLength(0);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("never calls updateTag when validation fails", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await createService({}, formData({ duration_mins: "0" }));

    expect(result.fieldErrors).toBeDefined();
    expect(stub.inserts).toHaveLength(0);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("never calls updateTag when deleteService is blocked by existing booking snapshots", async () => {
    const stub = stubAdminClient({ bookingItemCount: 2 });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await deleteService(SERVICE_ID);

    expect(result.error).toBeDefined();
    expect(stub.deletes).toHaveLength(0);
    expect(updateTag).not.toHaveBeenCalled();
  });
});
