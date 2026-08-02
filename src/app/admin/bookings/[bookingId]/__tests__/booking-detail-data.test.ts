// C-09 Phase C Step 7 — cache behaviour for /admin/bookings/[bookingId].
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
const { getBookingDetailData } = await import("../booking-detail-data");
const { TAGS } = await import("@/lib/cache/tag-taxonomy");

type TestProfile = Parameters<typeof getBookingDetailData>[0]["profile"];

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
      data: {
        id: "b1",
        client_id: "c1",
        booking_date: "2026-01-10",
        start_time: "10:00",
        status: "confirmed",
        booking_participants: [],
        booking_items: [],
        booking_assignments: [],
      },
      error: null,
    },
    audit_logs: {
      data: [
        {
          id: "a1",
          action_type: "booking_updated",
          target_type: "booking",
          target_id: "b1",
          created_at: "2026-01-02T09:30:00.000Z",
          staff_profiles: { name: "Owner" },
        },
      ],
      error: null,
    },
    booking_assignments: { data: [], error: null, count: 1 },
  });
}

beforeEach(() => {
  cacheHarness.clear();
  createSupabaseAdminClient.mockReset();
  createSupabaseAdminClient.mockImplementation(() => stubClient());
});

describe("getBookingDetailData cache behaviour", () => {
  it("runs the fetcher on a cache miss", async () => {
    const data = await getBookingDetailData({
      bookingId: "b1",
      profile: makeProfile("s1"),
      fullScope: true,
    });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(data.canOpen).toBe(true);
    expect(data.booking?.id).toBe("b1");
    expect(data.auditLogs).toHaveLength(1);
  });

  it("does not re-run the fetcher on a cache hit", async () => {
    const profile = makeProfile("s1");
    await getBookingDetailData({ bookingId: "b1", profile, fullScope: true });
    await getBookingDetailData({ bookingId: "b1", profile, fullScope: true });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it.each([TAGS.BOOKINGS, TAGS.CLIENTS, TAGS.STAFF, TAGS.AUDIT, TAGS.EMAILS])(
    "re-runs the fetcher after the %s tag is invalidated",
    async (tag) => {
      const profile = makeProfile("s1");
      await getBookingDetailData({ bookingId: "b1", profile, fullScope: true });
      cacheHarness.invalidateTag(tag);
      await getBookingDetailData({ bookingId: "b1", profile, fullScope: true });
      expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    }
  );

  it("keys separately per booking, per caller and per scope", async () => {
    await getBookingDetailData({
      bookingId: "b1",
      profile: makeProfile("s1"),
      fullScope: true,
    });
    await getBookingDetailData({
      bookingId: "b2",
      profile: makeProfile("s1"),
      fullScope: true,
    });
    await getBookingDetailData({
      bookingId: "b1",
      profile: makeProfile("s2"),
      fullScope: true,
    });
    await getBookingDetailData({
      bookingId: "b1",
      profile: makeProfile("s1"),
      fullScope: false,
    });
    expect(cacheHarness.size()).toBe(4);
  });

  it("keys separately per audit page size", async () => {
    const profile = makeProfile("s1");
    await getBookingDetailData({ bookingId: "b1", profile, fullScope: true });
    await getBookingDetailData({
      bookingId: "b1",
      profile,
      fullScope: true,
      auditLimit: 25,
    });
    expect(cacheHarness.size()).toBe(2);
  });

  it("omits the activity timeline when the caller is not full-scope", async () => {
    const data = await getBookingDetailData({
      bookingId: "b1",
      profile: makeProfile("s1"),
      fullScope: false,
    });
    expect(data.auditLogs).toEqual([]);
  });

  it("returns a JSON-safe shape (no Map/Set/Date crosses the boundary)", async () => {
    const data = await getBookingDetailData({
      bookingId: "b1",
      profile: makeProfile("s1"),
      fullScope: true,
    });
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });
});
