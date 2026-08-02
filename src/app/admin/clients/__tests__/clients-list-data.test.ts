// C-09 Phase C Step 7 — cache behaviour for /admin/clients' list data helper.
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
const { getClientsListData, countClients } = await import("../clients-list-data");
const { TAGS } = await import("@/lib/cache/tag-taxonomy");

function stubClient() {
  return createFakeAdminClient({
    clients: {
      data: [
        {
          id: "c1",
          full_name: "Test Client",
          client_source: "web",
          source_detail: null,
          created_at: "2026-01-02T09:30:00.000Z",
          updated_at: "2026-01-02T09:30:00.000Z",
          deleted_at: null,
        },
      ],
      error: null,
      count: 31,
    },
    bookings: {
      data: [
        {
          id: "b1",
          client_id: "c1",
          booking_date: "2026-01-10",
          start_time: "10:00",
          status: "confirmed",
          booking_items: [],
        },
      ],
      error: null,
    },
  });
}

beforeEach(() => {
  cacheHarness.clear();
  createSupabaseAdminClient.mockReset();
  createSupabaseAdminClient.mockImplementation(() => stubClient());
});

describe("getClientsListData cache behaviour", () => {
  it("runs the fetcher on a cache miss", async () => {
    const data = await getClientsListData({ canViewContactDetails: true });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(data.clients).toHaveLength(1);
    expect(data.bookings).toHaveLength(1);
  });

  it("does not re-run the fetcher on a cache hit", async () => {
    await getClientsListData({ canViewContactDetails: true });
    await getClientsListData({ canViewContactDetails: true });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it.each([TAGS.CLIENTS, TAGS.BOOKINGS])(
    "re-runs the fetcher after the %s tag is invalidated",
    async (tag) => {
      await getClientsListData({ canViewContactDetails: true });
      cacheHarness.invalidateTag(tag);
      await getClientsListData({ canViewContactDetails: true });
      expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    }
  );

  it("keys separately per contact-details permission", async () => {
    await getClientsListData({ canViewContactDetails: true });
    await getClientsListData({ canViewContactDetails: false });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("keys separately per limit/offset, so page 2 never serves page 1", async () => {
    await getClientsListData({ canViewContactDetails: true, limit: 50, offset: 0 });
    await getClientsListData({ canViewContactDetails: true, limit: 50, offset: 50 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    await getClientsListData({ canViewContactDetails: true, limit: 50, offset: 50 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("returns a JSON-safe shape (no Map/Set/Date crosses the boundary)", async () => {
    const data = await getClientsListData({ canViewContactDetails: true });
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it("caches the companion count path per includeDeleted variant", async () => {
    await expect(countClients()).resolves.toBe(31);
    await countClients();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    await countClients(true);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });
});
