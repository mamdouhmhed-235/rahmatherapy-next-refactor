import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { updateBusinessSettings } from "../actions";

/**
 * C-09 Phase B fix round — Step 3 spec coverage. `updateBusinessSettings` is
 * the B-149 fix the whole C-09 plan cites as its motivation and had zero
 * regression coverage before this. Asserts the settings + audit resource
 * tags it invalidates.
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

function stubAdminClient() {
  const audits: Record<string, unknown>[] = [];
  const upserts: Record<string, unknown>[] = [];

  const from = vi.fn((table: string) => {
    if (table === "audit_logs") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          audits.push(row);
          return { error: null };
        }),
      };
    }
    // business_settings
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: 1, company_name: "Rahma Therapy", booking_window_days: 14 },
            error: null,
          }),
        }),
      }),
      upsert: (row: Record<string, unknown>) => {
        upserts.push(row);
        return {
          select: () => ({
            single: async () => ({ data: row, error: null }),
          }),
        };
      },
    };
  });

  return { client: { from }, audits, upserts };
}

function formData(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set("company_name", overrides.company_name ?? "Rahma Therapy");
  data.set("contact_email", overrides.contact_email ?? "owner@example.test");
  data.set("contact_phone", overrides.contact_phone ?? "07000000000");
  data.set("booking_window_days", overrides.booking_window_days ?? "30");
  data.set("buffer_time_mins", overrides.buffer_time_mins ?? "15");
  data.set("minimum_notice_hours", overrides.minimum_notice_hours ?? "2");
  data.set(
    "customer_cancellation_cutoff_hours",
    overrides.customer_cancellation_cutoff_hours ?? "24"
  );
  data.set("allowed_cities", overrides.allowed_cities ?? "Luton, Dunstable");
  data.set("booking_status_enabled", overrides.booking_status_enabled ?? "on");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue(ACTOR as never);
});

describe("updateBusinessSettings — cache tag invalidation (B-149 fix)", () => {
  it("invalidates the settings and audit resource tags", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await updateBusinessSettings({}, formData());

    expect(result).toEqual({ success: true });
    expect(stub.upserts).toHaveLength(1);
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual([
      "settings",
      "audit",
    ]);
  });

  it("never calls updateTag when validation fails", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await updateBusinessSettings(
      {},
      formData({ booking_window_days: "0" })
    );

    expect(result.fieldErrors).toBeDefined();
    expect(stub.upserts).toHaveLength(0);
    expect(updateTag).not.toHaveBeenCalled();
  });
});
