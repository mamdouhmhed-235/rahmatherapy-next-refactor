import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
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

// Real `StaffProfile`s carry `permissions: Set<string>` (rbac.ts). The action
// reads it directly for the owner-only mileage-origin gate, so the fixtures
// must too — a bare `{ id, name }` actor would throw on `.permissions.has`.
const OWNER = {
  id: "staff-owner",
  name: "Owner",
  permissions: new Set<string>([
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.MANAGE_TRAVEL_ORIGIN,
  ]),
};
const ADMIN = {
  id: "staff-admin",
  name: "Admin",
  permissions: new Set<string>([PERMISSIONS.MANAGE_SETTINGS]),
};

function stubAdminClient(
  beforeState: Record<string, unknown> = {
    id: 1,
    company_name: "Rahma Therapy",
    booking_window_days: 14,
  }
) {
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
            data: beforeState,
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
  data.set(
    "free_travel_cities",
    overrides.free_travel_cities ?? "Luton, Dunstable"
  );
  data.set("booking_status_enabled", overrides.booking_status_enabled ?? "on");
  // Left ABSENT unless a test opts in — a disabled input is omitted from
  // FormData, which is exactly how an admin's form submits.
  if (overrides.mileage_origin !== undefined) {
    data.set("mileage_origin", overrides.mileage_origin);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue(OWNER as never);
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

/**
 * Item 8 Phase 1. `free_travel_cities` is the column the app reads, but the
 * live `create_booking_request` gate still reads `allowed_cities`, so the save
 * must write BOTH until Step Z drops the old column after the deploy.
 */
describe("updateBusinessSettings — free-travel areas dual-write", () => {
  it("writes the town list to free_travel_cities and allowed_cities together", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await updateBusinessSettings({}, formData());

    expect(result).toEqual({ success: true });
    expect(stub.upserts[0]).toMatchObject({
      free_travel_cities: ["Luton", "Dunstable"],
      allowed_cities: ["Luton", "Dunstable"],
    });
  });

  it("rejects an empty free-travel list with the reworded message", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await updateBusinessSettings(
      {},
      formData({ free_travel_cities: "" })
    );

    expect(result.fieldErrors?.free_travel_cities).toBe(
      "Enter at least one free-travel area."
    );
    expect(stub.upserts).toHaveLength(0);
  });
});

describe("updateBusinessSettings — owner-only mileage origin", () => {
  it("allows the owner to change the mileage origin", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await updateBusinessSettings(
      {},
      formData({ mileage_origin: "Luton town centre" })
    );

    expect(result).toEqual({ success: true });
    expect(stub.upserts[0]).toMatchObject({
      mileage_origin: "Luton town centre",
    });
  });

  it("rejects a mileage-origin change from an admin and writes nothing", async () => {
    vi.mocked(requirePermission).mockResolvedValue(ADMIN as never);
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await updateBusinessSettings(
      {},
      formData({ mileage_origin: "Dunstable depot" })
    );

    expect(result.fieldErrors?.mileage_origin).toBe(
      "Only the practice owner can change the mileage origin."
    );
    expect(stub.upserts).toHaveLength(0);
    expect(updateTag).not.toHaveBeenCalled();
  });

  // The partial-save regression: an admin's form omits the disabled origin
  // field entirely, so the save must succeed AND must not blank the stored
  // value the owner set.
  it("lets an admin save other settings while the origin field is absent, without clearing it", async () => {
    vi.mocked(requirePermission).mockResolvedValue(ADMIN as never);
    const stub = stubAdminClient({
      id: 1,
      company_name: "Rahma Therapy",
      booking_window_days: 14,
      mileage_origin: "Luton town centre",
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await updateBusinessSettings({}, formData());

    expect(result).toEqual({ success: true });
    expect(stub.upserts[0]).not.toHaveProperty("mileage_origin");
  });

  // "" from the form and NULL in the column mean the same thing. Comparing
  // them un-normalised would mark every save as a change and lock admins out.
  it("treats a blank submitted origin as unchanged when none is stored", async () => {
    vi.mocked(requirePermission).mockResolvedValue(ADMIN as never);
    const stub = stubAdminClient({
      id: 1,
      company_name: "Rahma Therapy",
      booking_window_days: 14,
      mileage_origin: null,
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await updateBusinessSettings(
      {},
      formData({ mileage_origin: "" })
    );

    expect(result).toEqual({ success: true });
    expect(stub.upserts[0]).toMatchObject({ mileage_origin: null });
  });
});
