// C-09 Phase C Step 7 — cache behaviour for /admin/staff's list data helper.
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
const { getStaffListData, countStaff } = await import("../staff-list-data");
const { TAGS } = await import("@/lib/cache/tag-taxonomy");

const ADMIN_PARAMS = {
  scope: "admin" as const,
  staffSelect: "id, name, gender, active, can_take_bookings, availability_mode",
  staffId: "s1",
  staffGender: "female" as string | null,
};

function stubClient() {
  return createFakeAdminClient({
    staff_profiles: {
      data: [
        {
          id: "s1",
          name: "Owner",
          gender: "female",
          active: true,
          can_take_bookings: true,
          availability_mode: "use_global",
        },
      ],
      error: null,
      count: 6,
    },
    booking_assignments: {
      data: [
        {
          assigned_staff_id: "s1",
          status: "assigned",
          bookings: {
            booking_date: "2026-01-10",
            start_time: "10:00",
            status: "confirmed",
          },
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

describe("getStaffListData cache behaviour", () => {
  it("runs the fetcher on a cache miss", async () => {
    const data = await getStaffListData(ADMIN_PARAMS);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(data.staff).toHaveLength(1);
    expect(data.assignments).toHaveLength(1);
    expect(data.staffLoadError).toBe(false);
  });

  it("does not re-run the fetcher on a cache hit", async () => {
    await getStaffListData(ADMIN_PARAMS);
    await getStaffListData(ADMIN_PARAMS);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it.each([TAGS.STAFF, TAGS.BOOKINGS])(
    "re-runs the fetcher after the %s tag is invalidated",
    async (tag) => {
      await getStaffListData(ADMIN_PARAMS);
      cacheHarness.invalidateTag(tag);
      await getStaffListData(ADMIN_PARAMS);
      expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    }
  );

  it("keys separately per team scope and per select variant", async () => {
    await getStaffListData(ADMIN_PARAMS);
    await getStaffListData({ ...ADMIN_PARAMS, scope: "assignment" });
    await getStaffListData({ ...ADMIN_PARAMS, staffSelect: "id, name" });
    expect(cacheHarness.size()).toBe(3);
  });

  it("reports the load failure as a boolean, never a Supabase error object", async () => {
    createSupabaseAdminClient.mockImplementation(() =>
      createFakeAdminClient({
        staff_profiles: { data: null, error: { message: "boom" } },
      })
    );
    const data = await getStaffListData(ADMIN_PARAMS);
    expect(data.staffLoadError).toBe(true);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it("returns a JSON-safe shape (no Map/Set/Date crosses the boundary)", async () => {
    const data = await getStaffListData(ADMIN_PARAMS);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it("caches the companion count path under its own key", async () => {
    await expect(countStaff()).resolves.toBe(6);
    await countStaff();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });
});
