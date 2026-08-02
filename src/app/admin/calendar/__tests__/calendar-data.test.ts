// C-09 Phase C Step 7 — cache behaviour for /admin/calendar's data helper.
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

const getReportData = vi.fn(async () => ({
  bookings: [{ id: "b1", status: "confirmed", contact_full_name: "Test" }],
  staff: [],
}));
vi.mock("../../reports/reporting", () => ({
  getReportData: (...args: unknown[]) => getReportData(...(args as [])),
}));

const { createFakeAdminClient } = await import(
  "@/lib/cache/__tests__/fake-supabase-admin"
);
const { getCalendarPageData } = await import("../calendar-data");
const { TAGS } = await import("@/lib/cache/tag-taxonomy");

type CalendarParams = Parameters<typeof getCalendarPageData>[0];

const profile = {
  id: "s1",
  gender: "female",
  active: true,
  permissions: new Set(["manage_bookings_all"]),
} as unknown as CalendarParams["profile"];

const FILTERS = {
  range: "custom",
  from: "2026-01-01",
  to: "2026-01-01",
} as unknown as CalendarParams["filters"];

function stubClient() {
  return createFakeAdminClient({
    booking_participants: {
      data: [
        {
          id: "p1",
          booking_id: "b1",
          display_name: "Guest",
          is_main_contact: false,
        },
      ],
      error: null,
    },
    bookings: {
      data: [
        {
          id: "b1",
          recurring_template_id: "t1",
          recurring_booking_templates: { cadence: "weekly" },
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
  getReportData.mockClear();
});

describe("getCalendarPageData cache behaviour", () => {
  it("runs the fetcher on a cache miss", async () => {
    const data = await getCalendarPageData({ profile, filters: FILTERS });
    expect(getReportData).toHaveBeenCalledTimes(1);
    expect(data.participantRows).toHaveLength(1);
    expect(data.recurringRows).toHaveLength(1);
  });

  it("does not re-run the fetcher on a cache hit", async () => {
    await getCalendarPageData({ profile, filters: FILTERS });
    await getCalendarPageData({ profile, filters: FILTERS });
    expect(getReportData).toHaveBeenCalledTimes(1);
  });

  it.each([TAGS.BOOKINGS, TAGS.STAFF, TAGS.SETTINGS])(
    "re-runs the fetcher after the %s tag is invalidated",
    async (tag) => {
      await getCalendarPageData({ profile, filters: FILTERS });
      cacheHarness.invalidateTag(tag);
      await getCalendarPageData({ profile, filters: FILTERS });
      expect(getReportData).toHaveBeenCalledTimes(2);
    }
  );

  it("keys separately per viewer, so RBAC-narrowed data never bleeds", async () => {
    await getCalendarPageData({ profile, filters: FILTERS });
    await getCalendarPageData({
      profile: { ...profile, id: "s2" } as CalendarParams["profile"],
      filters: FILTERS,
    });
    expect(cacheHarness.size()).toBe(2);
  });

  it("keys separately per date window, so a week never serves a day's rows", async () => {
    await getCalendarPageData({ profile, filters: FILTERS });
    await getCalendarPageData({
      profile,
      filters: { ...FILTERS, to: "2026-01-07" } as CalendarParams["filters"],
    });
    expect(cacheHarness.size()).toBe(2);
  });

  it("returns row ARRAYS, not the Maps the page renders from", async () => {
    const data = await getCalendarPageData({ profile, filters: FILTERS });
    expect(Array.isArray(data.participantRows)).toBe(true);
    expect(Array.isArray(data.recurringRows)).toBe(true);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });
});
