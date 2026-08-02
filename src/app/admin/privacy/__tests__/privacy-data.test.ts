// C-09 Phase C Step 7 — cache behaviour for /admin/privacy's data helper.
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
const { getPrivacyPageData, countPrivacyRequests } = await import(
  "../privacy-data"
);
const { TAGS } = await import("@/lib/cache/tag-taxonomy");

const FULL_ACCESS = {
  canManagePrivacyOperations: true,
  canViewSensitiveNotes: true,
  canViewContactDetails: true,
};

function stubClient() {
  return createFakeAdminClient({
    client_privacy_requests: {
      data: [
        {
          id: "r1",
          client_id: "c1",
          request_type: "data_export",
          status: "open",
          request_note: null,
          created_at: "2026-01-02T09:30:00.000Z",
          updated_at: "2026-01-02T09:30:00.000Z",
          created_by_staff_id: "s1",
        },
      ],
      error: null,
      count: 7,
    },
    client_notes: {
      data: [
        {
          id: "n1",
          client_id: "c1",
          note: "sensitive",
          created_at: "2026-01-02T09:30:00.000Z",
          author_staff_id: "s1",
        },
      ],
      error: null,
    },
    clients: {
      data: [{ id: "c1", full_name: "Test Client", email: null, phone: null }],
      error: null,
    },
    staff_profiles: { data: [{ id: "s1", full_name: "Owner" }], error: null },
  });
}

beforeEach(() => {
  cacheHarness.clear();
  createSupabaseAdminClient.mockReset();
  createSupabaseAdminClient.mockImplementation(() => stubClient());
});

describe("getPrivacyPageData cache behaviour", () => {
  it("runs the fetcher on a cache miss", async () => {
    const data = await getPrivacyPageData(FULL_ACCESS);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(data.requests).toHaveLength(1);
    expect(data.clients).toHaveLength(1);
    expect(data.staff).toHaveLength(1);
    expect(data.queueLoadFailed).toBe(false);
  });

  it("does not re-run the fetcher on a cache hit", async () => {
    await getPrivacyPageData(FULL_ACCESS);
    await getPrivacyPageData(FULL_ACCESS);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it.each([TAGS.CLIENTS, TAGS.AUDIT])(
    "re-runs the fetcher after the %s tag is invalidated",
    async (tag) => {
      await getPrivacyPageData(FULL_ACCESS);
      cacheHarness.invalidateTag(tag);
      await getPrivacyPageData(FULL_ACCESS);
      expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    }
  );

  it("keys separately per permission set, so a narrower caller never reads a wider entry", async () => {
    await getPrivacyPageData(FULL_ACCESS);
    await getPrivacyPageData({ ...FULL_ACCESS, canViewContactDetails: false });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("keys separately per limit/offset, so page 2 never serves page 1", async () => {
    await getPrivacyPageData({ ...FULL_ACCESS, limit: 25, offset: 0 });
    await getPrivacyPageData({ ...FULL_ACCESS, limit: 25, offset: 25 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    await getPrivacyPageData({ ...FULL_ACCESS, limit: 25, offset: 25 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("returns a JSON-safe shape (lookups are arrays, not Maps)", async () => {
    const data = await getPrivacyPageData(FULL_ACCESS);
    expect(Array.isArray(data.clients)).toBe(true);
    expect(Array.isArray(data.staff)).toBe(true);
    expect(typeof data.queueLoadFailed).toBe("boolean");
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it("caches the companion count path under its own key", async () => {
    await expect(countPrivacyRequests()).resolves.toBe(7);
    await countPrivacyRequests();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });
});

// C-09 Phase D Step 12 — filter wiring keys separately, so a caller
// filtering to status=open can never be served a cache entry built for
// status=completed (or for the unfiltered queue).
describe("getPrivacyPageData filter-wiring cache behaviour", () => {
  it("keys the unfiltered call and a fully-empty-filters call identically", async () => {
    await getPrivacyPageData(FULL_ACCESS);
    await getPrivacyPageData({
      ...FULL_ACCESS,
      filters: {
        requestTypes: undefined,
        statuses: undefined,
        fromDate: undefined,
        toDate: undefined,
        q: undefined,
      },
    });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it("keys separately per requestTypes/statuses/date/q filter", async () => {
    await getPrivacyPageData({
      ...FULL_ACCESS,
      filters: { requestTypes: ["data_export"] },
    });
    await getPrivacyPageData({
      ...FULL_ACCESS,
      filters: { statuses: ["open"] },
    });
    await getPrivacyPageData({
      ...FULL_ACCESS,
      filters: { fromDate: "2026-01-01T00:00:00.000Z" },
    });
    await getPrivacyPageData({
      ...FULL_ACCESS,
      filters: { q: "deletion" },
    });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(4);
    await getPrivacyPageData({
      ...FULL_ACCESS,
      filters: { requestTypes: ["data_export"] },
    });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(4);
  });

  it("re-runs a filtered call after the audit tag is invalidated", async () => {
    await getPrivacyPageData({ ...FULL_ACCESS, filters: { statuses: ["open"] } });
    cacheHarness.invalidateTag(TAGS.AUDIT);
    await getPrivacyPageData({ ...FULL_ACCESS, filters: { statuses: ["open"] } });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });
});
