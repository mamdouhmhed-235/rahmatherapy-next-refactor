// C-09 Phase C Step 7 — cache behaviour for /admin/bookings' list data helpers.
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
const { getBookingsListData, getBookingsChromeData, countBookings } =
  await import("../bookings-list-data");
const { TAGS } = await import("@/lib/cache/tag-taxonomy");

type TestProfile = Parameters<typeof getBookingsListData>[0]["profile"];

function makeProfile(
  id: string,
  permissions: string[] = ["manage_bookings_all"]
): TestProfile {
  return {
    id,
    gender: "female",
    active: true,
    can_take_bookings: true,
    permissions: new Set(permissions),
  } as unknown as TestProfile;
}

function stubClient() {
  return createFakeAdminClient({
    bookings: {
      data: [
        {
          id: "b1",
          booking_date: "2026-01-10",
          start_time: "10:00",
          status: "confirmed",
          booking_participants: [],
          booking_items: [],
          booking_assignments: [],
        },
      ],
      error: null,
      count: 88,
    },
    booking_assignments: { data: [{ booking_id: "b1" }], error: null },
    services: { data: [{ slug: "hijama", name: "Hijama" }], error: null },
    staff_profiles: { data: [{ id: "s1", name: "Owner" }], error: null },
  });
}

beforeEach(() => {
  cacheHarness.clear();
  createSupabaseAdminClient.mockReset();
  createSupabaseAdminClient.mockImplementation(() => stubClient());
});

describe("getBookingsListData cache behaviour", () => {
  it("runs the fetcher on a cache miss", async () => {
    const bookings = await getBookingsListData({
      profile: makeProfile("s1"),
      canViewAll: true,
    });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(bookings).toHaveLength(1);
  });

  it("does not re-run the fetcher on a cache hit", async () => {
    const profile = makeProfile("s1");
    await getBookingsListData({ profile, canViewAll: true });
    await getBookingsListData({ profile, canViewAll: true });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it.each([TAGS.BOOKINGS, TAGS.CLIENTS, TAGS.STAFF])(
    "re-runs the fetcher after the %s tag is invalidated",
    async (tag) => {
      const profile = makeProfile("s1");
      await getBookingsListData({ profile, canViewAll: true });
      cacheHarness.invalidateTag(tag);
      await getBookingsListData({ profile, canViewAll: true });
      expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    }
  );

  it("keys separately per caller and per scope", async () => {
    // Counted by distinct cache entries rather than client constructions: the
    // therapist-scoped branch builds a second client inside getScopedBookingIds.
    await getBookingsListData({ profile: makeProfile("s1"), canViewAll: true });
    await getBookingsListData({ profile: makeProfile("s2"), canViewAll: true });
    await getBookingsListData({ profile: makeProfile("s1"), canViewAll: false });
    expect(cacheHarness.size()).toBe(3);
  });

  it("keys separately per limit/offset, so page 2 never serves page 1", async () => {
    const profile = makeProfile("s1");
    await getBookingsListData({ profile, canViewAll: true, limit: 50, offset: 0 });
    await getBookingsListData({ profile, canViewAll: true, limit: 50, offset: 50 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    await getBookingsListData({ profile, canViewAll: true, limit: 50, offset: 50 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("returns a JSON-safe shape (no Map/Set/Date crosses the boundary)", async () => {
    const bookings = await getBookingsListData({
      profile: makeProfile("s1"),
      canViewAll: true,
    });
    expect(JSON.parse(JSON.stringify(bookings))).toEqual(bookings);
  });

  it("caches the chrome options separately per scope", async () => {
    await getBookingsChromeData(true);
    await getBookingsChromeData(true);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    const empty = await getBookingsChromeData(false);
    expect(empty).toEqual({ services: [], staff: [] });
  });

  it("caches the companion count path under its own key", async () => {
    await expect(countBookings()).resolves.toBe(88);
    await countBookings();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });
});
