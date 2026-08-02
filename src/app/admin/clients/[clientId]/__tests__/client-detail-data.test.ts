// C-09 Phase C Step 7 — cache behaviour for /admin/clients/[clientId]'s helper.
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
const { getClientDetailData, countClientBookings } = await import(
  "../client-detail-data"
);
const { TAGS } = await import("@/lib/cache/tag-taxonomy");

const FULL_FLAGS = {
  canViewClient: true,
  canViewContactDetails: true,
  canViewHealthNotes: true,
  canCreateClientNote: true,
  canViewSensitiveNoteQueue: true,
  canManagePrivacyOperations: true,
};

const NARROW_FLAGS = {
  canViewClient: false,
  canViewContactDetails: false,
  canViewHealthNotes: false,
  canCreateClientNote: false,
  canViewSensitiveNoteQueue: false,
  canManagePrivacyOperations: false,
};

const OWNER_PARAMS = {
  clientId: "c1",
  staffId: "s1",
  hasAllClientAccess: true,
  accessWithoutAssignment: FULL_FLAGS,
  accessWithAssignment: FULL_FLAGS,
};

function stubClient() {
  return createFakeAdminClient({
    clients: {
      data: {
        id: "c1",
        full_name: "Test Client",
        client_source: "web",
        created_at: "2026-01-02T09:30:00.000Z",
        updated_at: "2026-01-02T09:30:00.000Z",
        deleted_at: null,
      },
      error: null,
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
      count: 4,
    },
    booking_assignments: { data: [{ booking_id: "b1" }], error: null },
    client_notes: {
      data: [
        {
          id: "n1",
          note: "note",
          is_sensitive: false,
          created_at: "2026-01-02T09:30:00.000Z",
        },
      ],
      error: null,
    },
    client_privacy_requests: {
      data: [
        {
          id: "p1",
          request_type: "data_export",
          status: "open",
          request_note: null,
          created_at: "2026-01-02T09:30:00.000Z",
        },
      ],
      error: null,
    },
    audit_logs: {
      data: [
        {
          id: "a1",
          action_type: "client_created",
          created_at: "2026-01-02T09:30:00.000Z",
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

describe("getClientDetailData cache behaviour", () => {
  it("runs the fetcher on a cache miss", async () => {
    const data = await getClientDetailData(OWNER_PARAMS);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(data.client?.id).toBe("c1");
    expect(data.bookingHistory).toHaveLength(1);
    expect(data.clientNotes).toHaveLength(1);
    expect(data.privacyRequests).toHaveLength(1);
    expect(data.auditLogs).toHaveLength(1);
  });

  it("does not re-run the fetcher on a cache hit", async () => {
    await getClientDetailData(OWNER_PARAMS);
    await getClientDetailData(OWNER_PARAMS);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it.each([TAGS.CLIENTS, TAGS.BOOKINGS, TAGS.AUDIT, TAGS.EMAILS])(
    "re-runs the fetcher after the %s tag is invalidated",
    async (tag) => {
      await getClientDetailData(OWNER_PARAMS);
      cacheHarness.invalidateTag(tag);
      await getClientDetailData(OWNER_PARAMS);
      expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    }
  );

  it("keys separately per client id, staff id and access flags", async () => {
    await getClientDetailData(OWNER_PARAMS);
    await getClientDetailData({ ...OWNER_PARAMS, clientId: "c2" });
    await getClientDetailData({ ...OWNER_PARAMS, staffId: "s2" });
    await getClientDetailData({
      ...OWNER_PARAMS,
      accessWithoutAssignment: NARROW_FLAGS,
    });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(4);
  });

  it("keys separately per limit/offset on the booking history", async () => {
    await getClientDetailData({ ...OWNER_PARAMS, limit: 20, offset: 0 });
    await getClientDetailData({ ...OWNER_PARAMS, limit: 20, offset: 20 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    await getClientDetailData({ ...OWNER_PARAMS, limit: 20, offset: 20 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("reports assignment-derived access as a boolean the page re-derives from", async () => {
    const data = await getClientDetailData({
      ...OWNER_PARAMS,
      hasAllClientAccess: false,
      accessWithoutAssignment: NARROW_FLAGS,
      accessWithAssignment: FULL_FLAGS,
    });
    expect(data.hasAssignedClientAccess).toBe(true);
    expect(typeof data.hasAssignedClientAccess).toBe("boolean");
  });

  it("returns a JSON-safe shape (no Map/Set/Date crosses the boundary)", async () => {
    const data = await getClientDetailData(OWNER_PARAMS);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it("caches the companion count path per client id", async () => {
    await expect(countClientBookings("c1")).resolves.toBe(4);
    await countClientBookings("c1");
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    await countClientBookings("c2");
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });
});
