// C-09 Phase C Step 7 — cache behaviour for /admin/audit's data helper.
import { describe, it, expect, beforeEach, vi } from "vitest";

const cacheHarness = await vi.hoisted(async () => {
  const { createFakeUnstableCache } = await import(
    "@/lib/cache/__tests__/fake-unstable-cache"
  );
  return createFakeUnstableCache();
});

vi.mock("next/cache", () => ({
  unstable_cache: cacheHarness.unstable_cache,
}));

const createSupabaseAdminClient = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClient(),
}));

const { createFakeAdminClient } = await import(
  "@/lib/cache/__tests__/fake-supabase-admin"
);
const { getAuditPageData } = await import("../audit-data");
const { TAGS } = await import("@/lib/cache/tag-taxonomy");

const FILTERS = { range: "last_30_days" as const };

function stubClient() {
  return createFakeAdminClient({
    audit_logs: {
      data: [
        {
          id: "a1",
          action_type: "booking_updated",
          target_type: "booking",
          target_id: "b1",
          actor_staff_id: "s1",
          before_state: null,
          after_state: null,
          created_at: "2026-01-02T09:30:00.000Z",
        },
      ],
      error: null,
    },
    staff_profiles: { data: [{ id: "s1", name: "Owner" }], error: null },
  });
}

beforeEach(() => {
  cacheHarness.clear();
  createSupabaseAdminClient.mockReset();
  createSupabaseAdminClient.mockImplementation(() => stubClient());
});

describe("getAuditPageData cache behaviour", () => {
  it("runs the fetcher on a cache miss", async () => {
    const data = await getAuditPageData({ filters: FILTERS, cursor: null });
    expect(createSupabaseAdminClient).toHaveBeenCalled();
    expect(data.events).toHaveLength(1);
    expect(data.staff).toEqual([{ id: "s1", name: "Owner" }]);
  });

  it("does not re-run the fetcher on a cache hit", async () => {
    await getAuditPageData({ filters: FILTERS, cursor: null });
    const callsAfterMiss = createSupabaseAdminClient.mock.calls.length;
    await getAuditPageData({ filters: FILTERS, cursor: null });
    expect(createSupabaseAdminClient.mock.calls.length).toBe(callsAfterMiss);
  });

  it("re-runs the fetcher after the audit tag is invalidated", async () => {
    await getAuditPageData({ filters: FILTERS, cursor: null });
    const callsAfterMiss = createSupabaseAdminClient.mock.calls.length;
    cacheHarness.invalidateTag(TAGS.AUDIT);
    await getAuditPageData({ filters: FILTERS, cursor: null });
    expect(createSupabaseAdminClient.mock.calls.length).toBeGreaterThan(
      callsAfterMiss
    );
  });

  it("keys separately per cursor, so page 2 never serves page 1", async () => {
    await getAuditPageData({ filters: FILTERS, cursor: null });
    const callsAfterFirstPage = createSupabaseAdminClient.mock.calls.length;
    await getAuditPageData({
      filters: FILTERS,
      cursor: { created_at: "2026-01-01T00:00:00.000Z", id: "a0" },
    });
    expect(createSupabaseAdminClient.mock.calls.length).toBeGreaterThan(
      callsAfterFirstPage
    );
  });

  it("keys separately per filter set", async () => {
    await getAuditPageData({ filters: FILTERS, cursor: null });
    const callsAfterFirst = createSupabaseAdminClient.mock.calls.length;
    await getAuditPageData({
      filters: { ...FILTERS, target_type: "booking" },
      cursor: null,
    });
    expect(createSupabaseAdminClient.mock.calls.length).toBeGreaterThan(
      callsAfterFirst
    );
  });

  it("returns a JSON-safe shape (staff is an array, not a Map)", async () => {
    const data = await getAuditPageData({ filters: FILTERS, cursor: null });
    expect(Array.isArray(data.staff)).toBe(true);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });
});
