import { updateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "@/lib/auth/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createAvailabilityOverride,
  createBlockedDate,
  deleteAvailabilityOverride,
  deleteAvailabilityRule,
  deleteBlockedDate,
  saveAvailabilityRule,
} from "../actions";

/**
 * C-09 Phase B fix round — Step 3 spec coverage. availability/actions.ts had
 * no dedicated spec at all. Each mutation here already carried
 * staff + bookings + audit ("availability affects booking eligibility") —
 * this file asserts that tag set is actually what's invalidated.
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
const EXPECTED_TAGS = ["report-data", "dashboard-data", "staff", "bookings", "audit"];

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
    // availability_rules / blocked_dates / availability_overrides — all three
    // tables get the same shape of query from this file (select/eq/single,
    // insert/update + select/single, delete/eq).
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { id: "row-1" }, error: null }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: async () => ({ data: { id: "row-1" }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: async () => ({ data: { id: "row-1" }, error: null }),
          }),
        }),
      }),
      upsert: () => ({
        select: () => ({
          single: async () => ({ data: { id: "row-1" }, error: null }),
        }),
      }),
      delete: () => ({
        eq: async () => ({ error: null }),
      }),
    };
  });

  return { client: { from }, audits };
}

function ruleFormData() {
  const data = new FormData();
  data.set("day_of_week", "1");
  data.set("start_time", "09:00");
  data.set("end_time", "17:00");
  data.set("is_working_day", "on");
  return data;
}

function blockedDateFormData() {
  const data = new FormData();
  data.set("blocked_date", "2099-01-01");
  data.set("reason", "Bank holiday");
  return data;
}

function overrideFormData() {
  const data = new FormData();
  data.set("override_date", "2099-01-01");
  data.set("start_time", "09:00");
  data.set("end_time", "12:00");
  data.set("reason", "Half day");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue(ACTOR as never);
});

describe("availability/actions.ts — cache tag invalidation", () => {
  it("saveAvailabilityRule invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await saveAvailabilityRule({}, ruleFormData());

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual(EXPECTED_TAGS);
  });

  it("deleteAvailabilityRule invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await deleteAvailabilityRule("rule-1");

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual(EXPECTED_TAGS);
  });

  it("createBlockedDate invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await createBlockedDate({}, blockedDateFormData());

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual(EXPECTED_TAGS);
  });

  it("deleteBlockedDate invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await deleteBlockedDate("blocked-1");

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual(EXPECTED_TAGS);
  });

  it("createAvailabilityOverride invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await createAvailabilityOverride({}, overrideFormData());

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual(EXPECTED_TAGS);
  });

  it("deleteAvailabilityOverride invalidates staff + bookings + audit", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await deleteAvailabilityOverride("override-1");

    expect(result.error).toBeUndefined();
    expect(vi.mocked(updateTag).mock.calls.map(([tag]) => tag)).toEqual(EXPECTED_TAGS);
  });
});
