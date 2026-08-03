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
const {
  getPrivacyPageData,
  countPrivacyRequests,
  countSensitiveNotes,
  getOldestOpenPrivacyRequest,
  getPrivacyRequestsPage,
} = await import("../privacy-data");
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

// C-16 Phase D Step 10 — `countPrivacyRequests` must build its WHERE clause
// from the exact same filters as `getPrivacyPageData`'s requests query, so
// the pager's total can never describe a different query than the rows it's
// paginating.
describe("countPrivacyRequests honours the same filters as getPrivacyPageData", () => {
  it("applies the identical in/gte/lte/ilike sequence to the count query and the rows query", async () => {
    const filters = {
      requestTypes: ["data_export"],
      statuses: ["open", "reviewing"],
      fromDate: "2026-01-01T00:00:00.000Z",
      toDate: "2026-01-31T23:59:59.000Z",
      q: "deletion",
    };

    function recordingChain(calls: string[]) {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.order = () => chain;
      chain.in = (column: string, values: readonly string[]) => {
        calls.push(`in:${column}:${values.join(",")}`);
        return chain;
      };
      chain.gte = (column: string, value: string) => {
        calls.push(`gte:${column}:${value}`);
        return chain;
      };
      chain.lte = (column: string, value: string) => {
        calls.push(`lte:${column}:${value}`);
        return chain;
      };
      chain.ilike = (column: string, value: string) => {
        calls.push(`ilike:${column}:${value}`);
        return chain;
      };
      chain.range = () => chain;
      chain.returns = async () => ({ data: [], error: null });
      chain.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ count: 0, error: null }).then(resolve);
      return chain;
    }

    // `client_privacy_requests` routes through the recording chain; every
    // other table (notes/clients/staff, which getPrivacyPageData also reads)
    // routes through the shared fake with empty results — irrelevant here.
    function makeClient(calls: string[]) {
      const fallback = createFakeAdminClient({
        client_notes: { data: [], error: null },
        clients: { data: [], error: null },
        staff_profiles: { data: [], error: null },
      });
      return {
        from: (table: string) =>
          table === "client_privacy_requests" ? recordingChain(calls) : fallback.from(table),
      };
    }

    const countCalls: string[] = [];
    createSupabaseAdminClient.mockImplementation(() => makeClient(countCalls));
    await countPrivacyRequests(filters);

    cacheHarness.clear();
    const rowCalls: string[] = [];
    createSupabaseAdminClient.mockImplementation(() => makeClient(rowCalls));
    await getPrivacyPageData({ ...FULL_ACCESS, filters });

    expect(countCalls.length).toBeGreaterThan(0);
    expect(countCalls).toEqual(rowCalls);
  });
});

describe("countSensitiveNotes", () => {
  it("caches the sensitive-notes head-count under its own key", async () => {
    createSupabaseAdminClient.mockImplementation(() =>
      createFakeAdminClient({
        client_notes: { data: [], error: null, count: 143 },
      })
    );
    await expect(countSensitiveNotes()).resolves.toBe(143);
    await countSensitiveNotes();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });
});

describe("getOldestOpenPrivacyRequest", () => {
  it("returns null without a query when the caller can't manage privacy operations", async () => {
    const result = await getOldestOpenPrivacyRequest(false);
    expect(result).toBeNull();
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns null when there is no open/reviewing request", async () => {
    createSupabaseAdminClient.mockImplementation(() =>
      createFakeAdminClient({ client_privacy_requests: { data: [], error: null } })
    );
    const result = await getOldestOpenPrivacyRequest(true);
    expect(result).toBeNull();
  });

  it("resolves the oldest open request's client name", async () => {
    createSupabaseAdminClient.mockImplementation(() =>
      createFakeAdminClient({
        client_privacy_requests: {
          data: [
            {
              id: "r9",
              client_id: "c9",
              created_at: "2025-11-01T00:00:00.000Z",
            },
          ],
          error: null,
        },
        // `.maybeSingle()` on a real Supabase client unwraps to one row (not
        // an array) — the shared fake returns whatever's registered verbatim,
        // so this must be registered as the unwrapped shape.
        clients: { data: { full_name: "Oldest Client" }, error: null },
      })
    );
    const result = await getOldestOpenPrivacyRequest(true);
    expect(result).toEqual({
      id: "r9",
      clientId: "c9",
      clientName: "Oldest Client",
      createdAt: "2025-11-01T00:00:00.000Z",
    });
  });
});

describe("getPrivacyRequestsPage", () => {
  it("clamps a stale ?page=99 to the last real page", async () => {
    createSupabaseAdminClient.mockImplementation(() =>
      createFakeAdminClient({
        client_privacy_requests: { data: [], error: null, count: 60 },
        client_notes: { data: [], error: null },
        clients: { data: [], error: null },
        staff_profiles: { data: [], error: null },
      })
    );
    // count 60, LIST_PAGE_SIZE 25 => 3 pages.
    const result = await getPrivacyRequestsPage({ ...FULL_ACCESS, page: 99 });
    expect(result.pageCount).toBe(3);
    expect(result.page).toBe(3);
    expect(result.total).toBe(60);
  });

  it("computes pageCount 1 (pager renders nothing) when the total fits on one page", async () => {
    const result = await getPrivacyRequestsPage(FULL_ACCESS);
    expect(result.pageCount).toBe(1);
    expect(result.page).toBe(1);
    expect(result.total).toBe(7); // stubClient's registered count
  });

  it("reports total 0 without a query when the caller can't manage privacy operations", async () => {
    const result = await getPrivacyRequestsPage({
      ...FULL_ACCESS,
      canManagePrivacyOperations: false,
    });
    expect(result.total).toBe(0);
    expect(result.pageCount).toBe(1);
    expect(result.page).toBe(1);
  });
});
