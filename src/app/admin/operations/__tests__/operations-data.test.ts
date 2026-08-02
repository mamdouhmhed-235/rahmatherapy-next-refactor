// C-09 Phase C Step 7 — cache behaviour for /admin/operations' data helper.
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
const { getOperationsPageData, countOperationalEvents } = await import(
  "../operations-data"
);
const { TAGS } = await import("@/lib/cache/tag-taxonomy");

function stubClient() {
  return createFakeAdminClient({
    operational_events: {
      data: [
        {
          id: "e1",
          event_type: "email_failed",
          severity: "error",
          status: "open",
          summary: "Send failed",
          safe_context: { attempt: 1 },
          booking_id: null,
          staff_id: null,
          created_at: "2026-01-02T09:30:00.000Z",
        },
      ],
      error: null,
      count: 42,
    },
  });
}

beforeEach(() => {
  cacheHarness.clear();
  createSupabaseAdminClient.mockReset();
  createSupabaseAdminClient.mockImplementation(() => stubClient());
});

describe("getOperationsPageData cache behaviour", () => {
  it("runs the fetcher on a cache miss", async () => {
    const data = await getOperationsPageData();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(data.events).toHaveLength(1);
    expect(data.hasError).toBe(false);
  });

  it("does not re-run the fetcher on a cache hit", async () => {
    await getOperationsPageData();
    await getOperationsPageData();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it.each([TAGS.AUDIT, TAGS.BOOKINGS, TAGS.SETTINGS])(
    "re-runs the fetcher after the %s tag is invalidated",
    async (tag) => {
      await getOperationsPageData();
      cacheHarness.invalidateTag(tag);
      await getOperationsPageData();
      expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    }
  );

  it("keys separately per limit/offset, so page 2 never serves page 1", async () => {
    await getOperationsPageData({ limit: 50, offset: 0 });
    await getOperationsPageData({ limit: 50, offset: 50 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    await getOperationsPageData({ limit: 50, offset: 50 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("treats the default params as the same key as an explicit default", async () => {
    await getOperationsPageData();
    await getOperationsPageData({ limit: 300, offset: 0 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it("reports hasError as a boolean, never a Supabase error object", async () => {
    createSupabaseAdminClient.mockImplementation(() =>
      createFakeAdminClient({
        operational_events: { data: null, error: { message: "boom" } },
      })
    );
    const data = await getOperationsPageData();
    expect(data.hasError).toBe(true);
    expect(data.events).toEqual([]);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it("caches the companion count path under its own key", async () => {
    await expect(countOperationalEvents()).resolves.toBe(42);
    await countOperationalEvents();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });
});

// C-09 Phase D Step 10 — filter wiring keys separately, so a caller filtering
// to severity=error can never be served a cache entry built for another
// severity (or for the unfiltered queue).
describe("getOperationsPageData filter-wiring cache behaviour", () => {
  it("keys the unfiltered call and a fully-empty-filters call identically", async () => {
    await getOperationsPageData();
    await getOperationsPageData({
      severity: undefined,
      eventType: undefined,
      status: undefined,
      fromDate: undefined,
      toDate: undefined,
      q: undefined,
    });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it("keys separately per severity/eventType/status/date/q filter", async () => {
    await getOperationsPageData({ severity: "error" });
    await getOperationsPageData({ severity: "warning" });
    await getOperationsPageData({ eventType: "email_failed" });
    await getOperationsPageData({ status: "open" });
    await getOperationsPageData({ fromDate: "2026-01-01", toDate: "2026-01-31" });
    await getOperationsPageData({ q: "timeout" });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(6);
    await getOperationsPageData({ severity: "error" });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(6);
  });

  it("re-runs a filtered call after the audit tag is invalidated", async () => {
    await getOperationsPageData({ severity: "error" });
    cacheHarness.invalidateTag(TAGS.AUDIT);
    await getOperationsPageData({ severity: "error" });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });
});
