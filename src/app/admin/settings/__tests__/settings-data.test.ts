// C-09 Phase C Step 7 — cache behaviour for /admin/settings' data helper.
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
const { getSettingsPageData } = await import("../settings-data");
const { TAGS } = await import("@/lib/cache/tag-taxonomy");

function stubClient() {
  return createFakeAdminClient({
    business_settings: {
      data: { company_name: "Rahma Therapy", booking_window_days: 30 },
      error: null,
    },
    audit_logs: {
      data: { actor_staff_id: "s1", created_at: "2026-01-02T09:30:00.000Z" },
      error: null,
    },
    staff_profiles: { data: { name: "Owner" }, error: null },
  });
}

beforeEach(() => {
  cacheHarness.clear();
  createSupabaseAdminClient.mockReset();
  createSupabaseAdminClient.mockImplementation(() => stubClient());
});

describe("getSettingsPageData cache behaviour", () => {
  it("runs the fetcher on a cache miss", async () => {
    const data = await getSettingsPageData();
    expect(createSupabaseAdminClient).toHaveBeenCalled();
    expect(data.settings?.company_name).toBe("Rahma Therapy");
    expect(data.lastChange?.actor).toBe("Owner");
  });

  it("does not re-run the fetcher on a cache hit", async () => {
    await getSettingsPageData();
    const callsAfterMiss = createSupabaseAdminClient.mock.calls.length;
    await getSettingsPageData();
    expect(createSupabaseAdminClient.mock.calls.length).toBe(callsAfterMiss);
  });

  it("re-runs the fetcher after the settings tag is invalidated", async () => {
    await getSettingsPageData();
    const callsAfterMiss = createSupabaseAdminClient.mock.calls.length;
    cacheHarness.invalidateTag(TAGS.SETTINGS);
    await getSettingsPageData();
    expect(createSupabaseAdminClient.mock.calls.length).toBeGreaterThan(
      callsAfterMiss
    );
  });

  it("returns a JSON-safe shape (no Date/Set/Map crosses the boundary)", async () => {
    const data = await getSettingsPageData();
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
    expect(typeof data.lastChange?.isoTimestamp).toBe("string");
  });
});
