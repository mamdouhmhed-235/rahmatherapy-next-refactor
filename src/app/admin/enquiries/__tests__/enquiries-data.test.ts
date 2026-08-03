// C-09 Phase C Step 7 — cache behaviour for /admin/enquiries' data helper.
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
const { getEnquiriesPageData, countEnquiries } = await import(
  "../enquiries-data"
);
const { TAGS } = await import("@/lib/cache/tag-taxonomy");

function stubClient() {
  return createFakeAdminClient({
    enquiries: {
      data: [
        {
          id: "e1",
          full_name: "Test Enquirer",
          phone: null,
          email: null,
          source: "web",
          status: "new",
          service_interest: null,
          notes: null,
          client_id: null,
          converted_booking_id: null,
          assigned_staff_id: null,
          created_at: "2026-01-02T09:30:00.000Z",
          updated_at: null,
        },
      ],
      error: null,
      count: 12,
    },
    staff_profiles: { data: [{ id: "s1", name: "Owner" }], error: null },
  });
}

beforeEach(() => {
  cacheHarness.clear();
  createSupabaseAdminClient.mockReset();
  createSupabaseAdminClient.mockImplementation(() => stubClient());
});

describe("getEnquiriesPageData cache behaviour", () => {
  it("runs the fetcher on a cache miss", async () => {
    const data = await getEnquiriesPageData();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(data.enquiries).toHaveLength(1);
    expect(data.staff).toEqual([{ id: "s1", name: "Owner" }]);
  });

  it("does not re-run the fetcher on a cache hit", async () => {
    await getEnquiriesPageData();
    await getEnquiriesPageData();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it("re-runs the fetcher after the enquiries tag is invalidated", async () => {
    await getEnquiriesPageData();
    cacheHarness.invalidateTag(TAGS.ENQUIRIES);
    await getEnquiriesPageData();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("keys separately per limit/offset, so page 2 never serves page 1", async () => {
    await getEnquiriesPageData({ limit: 50, offset: 0 });
    await getEnquiriesPageData({ limit: 50, offset: 50 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    await getEnquiriesPageData({ limit: 50, offset: 50 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("treats no params and explicitly-undefined params as one key", async () => {
    await getEnquiriesPageData();
    await getEnquiriesPageData({ limit: undefined, offset: undefined });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it("returns a JSON-safe shape (staff is an array, not a Map)", async () => {
    const data = await getEnquiriesPageData();
    expect(Array.isArray(data.staff)).toBe(true);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it("caches the companion count path under its own key", async () => {
    await expect(countEnquiries()).resolves.toBe(12);
    await countEnquiries();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });
});

// C-09 Phase D Step 8 — filter wiring keys separately per filter, so a
// caller filtering by "converted" can never be served a cache entry built
// for "new" (or for no filter at all).
describe("getEnquiriesPageData filter-wiring cache behaviour", () => {
  it("keys the unfiltered call and a fully-empty-filters call identically", async () => {
    await getEnquiriesPageData();
    await getEnquiriesPageData({
      status: undefined,
      source: undefined,
      assignedStaff: undefined,
      fromDate: undefined,
      toDate: undefined,
      q: undefined,
    });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it("keys separately per status filter", async () => {
    await getEnquiriesPageData({ status: "new" });
    await getEnquiriesPageData({ status: "converted" });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    await getEnquiriesPageData({ status: "new" });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("keys separately per source/assignedStaff/date/q filter", async () => {
    await getEnquiriesPageData({ source: "website" });
    await getEnquiriesPageData({ assignedStaff: "unassigned" });
    await getEnquiriesPageData({ fromDate: "2026-01-01", toDate: "2026-01-31" });
    await getEnquiriesPageData({ q: "jane" });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(4);
  });

  it("re-runs a filtered call after the enquiries tag is invalidated", async () => {
    await getEnquiriesPageData({ status: "new" });
    cacheHarness.invalidateTag(TAGS.ENQUIRIES);
    await getEnquiriesPageData({ status: "new" });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });
});

// C-09 Phase D fix round — PostgREST's `.or(...)` argument is forwarded to
// the URL verbatim (postgrest-js does no escaping of its own); reserved
// characters (comma, parens) inside a value must be handled by wrapping the
// WHOLE value in double quotes, not by backslash-prefixing them unquoted.
// `createFakeAdminClient`'s chain doesn't record `.or()` calls, so this uses
// a local recording stub to assert on the exact generated filter string.
describe("getEnquiriesPageData q-filter or() string", () => {
  it("quotes the whole needle so an embedded comma and parenthesis survive", async () => {
    const orCalls: string[] = [];
    const enquiriesChain: {
      select: () => typeof enquiriesChain;
      order: () => typeof enquiriesChain;
      or: (filters: string) => typeof enquiriesChain;
      returns: () => Promise<{ data: unknown[]; error: null }>;
    } = {
      select: () => enquiriesChain,
      order: () => enquiriesChain,
      or: (filters) => {
        orCalls.push(filters);
        return enquiriesChain;
      },
      returns: async () => ({ data: [], error: null }),
    };
    const staffChain = {
      select: () => staffChain,
      eq: () => staffChain,
      order: () => staffChain,
      returns: async () => ({ data: [], error: null }),
    };
    createSupabaseAdminClient.mockImplementation(() => ({
      from: (table: string) => (table === "enquiries" ? enquiriesChain : staffChain),
    }));

    await getEnquiriesPageData({ q: "Smith, John (Jr.)" });

    const needle = `"%Smith, John (Jr.)%"`;
    expect(orCalls).toEqual([
      [
        `full_name.ilike.${needle}`,
        `phone.ilike.${needle}`,
        `email.ilike.${needle}`,
        `service_interest.ilike.${needle}`,
      ].join(","),
    ]);
  });
});
