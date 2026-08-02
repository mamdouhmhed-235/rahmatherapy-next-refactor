// C-09 Phase C Step 7 — cache behaviour for /admin/emails' data helper.
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

const getTemplateOverrideSummaries = vi.fn(async () => ({
  booking_confirmation: { updatedAt: "2026-01-02T09:30:00.000Z", updatedBy: "s1" },
}));
vi.mock("@/lib/email/templates", () => ({
  getTemplateOverrideSummaries: () => getTemplateOverrideSummaries(),
}));

const { createFakeAdminClient } = await import(
  "@/lib/cache/__tests__/fake-supabase-admin"
);
const { getEmailsPageData, countEmailDeliveryEvents } = await import(
  "../emails-data"
);
const { TAGS } = await import("@/lib/cache/tag-taxonomy");

const BASE_PARAMS = {
  canSeeDelivery: true,
  canResend: true,
  canSeeAllBookings: true,
  staffId: "s1",
  businessDate: "2026-01-02",
  includeTemplates: false,
};

function stubClient() {
  return createFakeAdminClient({
    email_delivery_events: {
      data: [
        {
          id: "ev1",
          booking_id: "b1",
          staff_id: null,
          event_type: "booking_reminder",
          recipient_email: "someone@example.test",
          recipient_role: "customer",
          delivery_status: "delivered",
          provider_message_id: null,
          error_message: null,
          created_at: "2026-01-02T09:30:00.000Z",
        },
      ],
      error: null,
      count: 250,
    },
    bookings: {
      data: [
        {
          id: "b1",
          booking_date: "2026-01-03",
          start_time: "10:00",
          contact_full_name: "Test Client",
          contact_email: "someone@example.test",
          status: "confirmed",
        },
      ],
      error: null,
    },
    booking_assignments: { data: [{ booking_id: "b1" }], error: null },
    staff_profiles: { data: [{ id: "s1", name: "Owner" }], error: null },
  });
}

beforeEach(() => {
  cacheHarness.clear();
  createSupabaseAdminClient.mockReset();
  createSupabaseAdminClient.mockImplementation(() => stubClient());
  getTemplateOverrideSummaries.mockClear();
});

describe("getEmailsPageData cache behaviour", () => {
  it("runs the fetcher on a cache miss", async () => {
    const data = await getEmailsPageData(BASE_PARAMS);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(data.events).toHaveLength(1);
    expect(data.reminderBookings).toHaveLength(1);
    expect(data.deliveryError).toBeNull();
  });

  it("does not re-run the fetcher on a cache hit", async () => {
    await getEmailsPageData(BASE_PARAMS);
    await getEmailsPageData(BASE_PARAMS);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it("re-runs the fetcher after the emails tag is invalidated", async () => {
    await getEmailsPageData(BASE_PARAMS);
    cacheHarness.invalidateTag(TAGS.EMAILS);
    await getEmailsPageData(BASE_PARAMS);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("keys separately per permission scope", async () => {
    await getEmailsPageData(BASE_PARAMS);
    await getEmailsPageData({ ...BASE_PARAMS, canSeeAllBookings: false });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("keys separately per business date, so the day boundary is not frozen", async () => {
    await getEmailsPageData(BASE_PARAMS);
    await getEmailsPageData({ ...BASE_PARAMS, businessDate: "2026-01-03" });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("keys separately per limit/offset, so page 2 never serves page 1", async () => {
    await getEmailsPageData({ ...BASE_PARAMS, limit: 100, offset: 0 });
    await getEmailsPageData({ ...BASE_PARAMS, limit: 100, offset: 100 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    await getEmailsPageData({ ...BASE_PARAMS, limit: 100, offset: 100 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("only reads the template lookups when the Templates tab asked for them", async () => {
    await getEmailsPageData(BASE_PARAMS);
    expect(getTemplateOverrideSummaries).not.toHaveBeenCalled();
    const data = await getEmailsPageData({ ...BASE_PARAMS, includeTemplates: true });
    expect(getTemplateOverrideSummaries).toHaveBeenCalledTimes(1);
    expect(data.templateStaff).toEqual([{ id: "s1", name: "Owner" }]);
  });

  it("returns a JSON-safe shape (template staff is an array, not a Map)", async () => {
    const data = await getEmailsPageData({ ...BASE_PARAMS, includeTemplates: true });
    expect(Array.isArray(data.templateStaff)).toBe(true);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it("caches the companion count path under its own key", async () => {
    await expect(countEmailDeliveryEvents()).resolves.toBe(250);
    await countEmailDeliveryEvents();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });
});
