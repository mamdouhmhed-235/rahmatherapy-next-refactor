// C-09 Phase C Step 7 — cache behaviour for /admin/clients' list data helpers,
// re-pointed at the C-16 Phase C Step 8 shape (the unbounded
// `getClientsListData` fetch it used to cover no longer exists: the page reads
// a per-client summary plus one window of rows).
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
  clientLifecycle,
  clientListContextFromQuery,
  countClients,
  getClientBookingSummaries,
  getClientsPageRows,
  summariseClientBookings,
} = await import("../clients-list-data");
const { TAGS } = await import("@/lib/cache/tag-taxonomy");

const TODAY = "2026-08-03";

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
          status: "completed",
          total_price: 60,
          amount_due: 60,
          amount_paid: 40,
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

describe("summariseClientBookings", () => {
  const rows = [
    { client_id: "c1", booking_date: "2026-05-01", status: "completed", total_price: 60, amount_due: 60, amount_paid: 20 },
    { client_id: "c1", booking_date: "2026-07-01", status: "completed", total_price: 60, amount_due: 60, amount_paid: 60 },
    { client_id: "c1", booking_date: "2026-09-01", status: "confirmed", total_price: 60, amount_due: 60, amount_paid: 0 },
    { client_id: "c1", booking_date: "2026-04-01", status: "no_show", total_price: 60, amount_due: 60, amount_paid: 60 },
    { client_id: "c2", booking_date: "2026-09-05", status: "cancelled", total_price: 60, amount_due: 60, amount_paid: 60 },
  ];

  it("reduces a booking stream to one record per client", () => {
    const index = summariseClientBookings(rows, TODAY);

    expect(index.c1).toEqual({
      lastCompletedDate: "2026-07-01",
      nextUpcomingDate: "2026-09-01",
      completedCount: 2,
      upcomingCount: 1,
      outstanding: 100,
    });
  });

  it("excludes cancelled bookings from upcoming, and no_show from completed", () => {
    const index = summariseClientBookings(rows, TODAY);

    expect(index.c1.completedCount).toBe(2); // the no_show is not a visit
    expect(index.c2.upcomingCount).toBe(0); // the cancelled one is not upcoming
    expect(index.c2.nextUpcomingDate).toBeNull();
  });

  it("is JSON-safe — a plain Record, not a Map", () => {
    const index = summariseClientBookings(rows, TODAY);
    expect(JSON.parse(JSON.stringify(index))).toEqual(index);
  });
});

describe("clientLifecycle", () => {
  const never = {
    lastCompletedDate: null,
    nextUpcomingDate: null,
    completedCount: 0,
    upcomingCount: 0,
    outstanding: 0,
  };

  it("calls a client who joined within 30 days new", () => {
    expect(clientLifecycle("2026-07-20T09:00:00.000Z", never, TODAY)).toBe("new");
  });

  it("calls three or more completed visits returning", () => {
    expect(
      clientLifecycle(
        "2024-01-01T09:00:00.000Z",
        { ...never, lastCompletedDate: "2026-07-01", completedCount: 3 },
        TODAY
      )
    ).toBe("returning");
  });

  it("calls a gap over 3 months at-risk and over 6 months lapsed", () => {
    expect(
      clientLifecycle(
        "2024-01-01T09:00:00.000Z",
        { ...never, lastCompletedDate: "2026-03-01", completedCount: 1 },
        TODAY
      )
    ).toBe("at_risk");
    expect(
      clientLifecycle(
        "2024-01-01T09:00:00.000Z",
        { ...never, lastCompletedDate: "2025-01-01", completedCount: 1 },
        TODAY
      )
    ).toBe("lapsed");
  });

  it("an upcoming booking keeps an old client out of at-risk/lapsed", () => {
    expect(
      clientLifecycle(
        "2024-01-01T09:00:00.000Z",
        {
          ...never,
          lastCompletedDate: "2025-01-01",
          completedCount: 1,
          nextUpcomingDate: "2026-09-01",
          upcomingCount: 1,
        },
        TODAY
      )
    ).toBe("returning");
  });
});

describe("clientListContextFromQuery", () => {
  it("keeps a UTC day string, never a Date, on the context", () => {
    const context = clientListContextFromQuery({}, { canViewContactDetails: true });
    expect(context.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(JSON.parse(JSON.stringify(context))).toEqual(context);
  });

  it("drops filter values it does not recognise", () => {
    const context = clientListContextFromQuery(
      { lifecycle: "made_up", payment: "nonsense", sort: "sideways", q: "  " },
      { canViewContactDetails: false }
    );
    expect(context.lifecycle).toBeUndefined();
    expect(context.payment).toBeUndefined();
    expect(context.sort).toBe("name");
    expect(context.q).toBeUndefined();
  });

  it("reads the deleted toggle off show_deleted=1", () => {
    expect(
      clientListContextFromQuery({ show_deleted: "1" }, { canViewContactDetails: true })
        .includeDeleted
    ).toBe(true);
    expect(
      clientListContextFromQuery({}, { canViewContactDetails: true }).includeDeleted
    ).toBe(false);
  });
});

describe("getClientBookingSummaries cache behaviour", () => {
  it("runs the fetcher on a miss and not on a hit", async () => {
    await getClientBookingSummaries(TODAY);
    await getClientBookingSummaries(TODAY);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it("keys per day, so the completed/upcoming boundary cannot go stale", async () => {
    await getClientBookingSummaries(TODAY);
    await getClientBookingSummaries("2026-08-04");
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("re-runs after the bookings tag is invalidated", async () => {
    await getClientBookingSummaries(TODAY);
    cacheHarness.invalidateTag(TAGS.BOOKINGS);
    await getClientBookingSummaries(TODAY);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });
});

describe("getClientsPageRows cache behaviour", () => {
  it("keys separately per id window, so page 2 never serves page 1", async () => {
    await getClientsPageRows({ canViewContactDetails: true, ids: ["c1"] });
    await getClientsPageRows({ canViewContactDetails: true, ids: ["c2"] });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    await getClientsPageRows({ canViewContactDetails: true, ids: ["c2"] });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("keys separately per contact-details permission", async () => {
    await getClientsPageRows({ canViewContactDetails: true, ids: ["c1"] });
    await getClientsPageRows({ canViewContactDetails: false, ids: ["c1"] });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("issues no query at all for an empty window", async () => {
    const data = await getClientsPageRows({ canViewContactDetails: true, ids: [] });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(data).toEqual({ clients: [], bookings: [] });
  });

  it("returns a JSON-safe shape (no Map/Set/Date crosses the boundary)", async () => {
    const data = await getClientsPageRows({
      canViewContactDetails: true,
      ids: ["c1"],
    });
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it.each([TAGS.CLIENTS, TAGS.BOOKINGS])(
    "re-runs the fetcher after the %s tag is invalidated",
    async (tag) => {
      await getClientsPageRows({ canViewContactDetails: true, ids: ["c1"] });
      cacheHarness.invalidateTag(tag);
      await getClientsPageRows({ canViewContactDetails: true, ids: ["c1"] });
      expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    }
  );
});

describe("countClients", () => {
  it("caches per includeDeleted variant", async () => {
    await expect(countClients()).resolves.toBe(31);
    await countClients();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    await countClients(true);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });
});
