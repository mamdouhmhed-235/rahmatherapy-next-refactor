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

// C-09 Phase D Step 9 — role/gender/status/bookable filter wiring keys
// separately, so a caller filtering to "inactive" can never be served a
// cache entry built for "active" (or for no filter at all).
describe("getStaffListData filter-wiring cache behaviour", () => {
  it("keys the unfiltered call and an all-undefined filters call identically", async () => {
    await getStaffListData(ADMIN_PARAMS);
    await getStaffListData({
      ...ADMIN_PARAMS,
      filters: { roleId: undefined, gender: undefined, active: undefined, bookable: undefined },
    });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it("keys separately per filter combination", async () => {
    await getStaffListData({ ...ADMIN_PARAMS, filters: { active: true } });
    await getStaffListData({ ...ADMIN_PARAMS, filters: { active: false } });
    await getStaffListData({ ...ADMIN_PARAMS, filters: { gender: "female" } });
    await getStaffListData({ ...ADMIN_PARAMS, filters: { bookable: true } });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(4);
    await getStaffListData({ ...ADMIN_PARAMS, filters: { active: true } });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(4);
  });

  it("returns both `staff` (unfiltered) and `filteredStaff` from a single outer call", async () => {
    // The fake Supabase client is a passthrough stub (it doesn't evaluate
    // `.eq()` predicates), so this can't assert the filtered ROWS differ —
    // that's covered by code review of the real `.eq(...)` calls in
    // staff-list-data.ts. What it does prove: passing `filters` doesn't
    // require the caller to make a second round-trip for the aggregate
    // strip's unfiltered `staff` — one `getStaffListData` call returns both.
    const data = await getStaffListData({
      ...ADMIN_PARAMS,
      filters: { active: true },
    });
    expect(data.staff).toHaveLength(1);
    expect(data.filteredStaff).toHaveLength(1);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it("re-runs a filtered call after the staff tag is invalidated", async () => {
    await getStaffListData({ ...ADMIN_PARAMS, filters: { active: true } });
    cacheHarness.invalidateTag(TAGS.STAFF);
    await getStaffListData({ ...ADMIN_PARAMS, filters: { active: true } });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });
});

// C-09 Phase D fix round — "Bookable" must restore the conjunction the
// in-memory predicate enforced (member.active && member.can_take_bookings),
// not just the raw column, or an admin filtering by Bookable alone would
// surface inactive staff whose can_take_bookings flag was never flipped.
//
// `createFakeAdminClient`'s chain doesn't evaluate `.eq()` predicates (it's a
// passthrough stub), so asserting on returned rows would prove nothing here —
// this spec records the QUERY BUILDER CALLS directly via a local recording
// stub instead.
describe("getStaffListData admin-scope bookable filter", () => {
  it("applies both can_take_bookings AND active eq() calls for the admin scope", async () => {
    const eqCalls: [string, unknown][] = [];
    const chain: {
      select: () => typeof chain;
      eq: (column: string, value: unknown) => typeof chain;
      order: () => Promise<{ data: unknown[]; error: null }>;
    } = {
      select: () => chain,
      eq: (column, value) => {
        eqCalls.push([column, value]);
        return chain;
      },
      order: async () => ({ data: [], error: null }),
    };
    createSupabaseAdminClient.mockImplementation(() => ({
      from: () => chain,
    }));

    await getStaffListData({ ...ADMIN_PARAMS, filters: { bookable: true } });

    expect(eqCalls).toContainEqual(["can_take_bookings", true]);
    expect(eqCalls).toContainEqual(["active", true]);
  });
});
