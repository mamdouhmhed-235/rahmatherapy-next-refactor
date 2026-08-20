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
    enquiries: { data: null, error: null },
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

  it.each([TAGS.BOOKINGS, TAGS.CLIENTS, TAGS.STAFF, TAGS.AUDIT, TAGS.EMAILS, TAGS.ENQUIRIES])(
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

  it("returns sourceEnquiry: null when no enquiry converted into this booking", async () => {
    const data = await getBookingDetailData({
      bookingId: "b1",
      profile: makeProfile("s1"),
      fullScope: true,
    });
    expect(data.sourceEnquiry).toBeNull();
  });

  it("returns the converting enquiry when one exists (C-03 Phase D)", async () => {
    createSupabaseAdminClient.mockImplementation(() =>
      createFakeAdminClient({
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
        audit_logs: { data: [], error: null },
        booking_assignments: { data: [], error: null, count: 1 },
        enquiries: {
          data: {
            id: "e1",
            full_name: "Fatima Ahmed",
            created_at: "2026-01-01T09:00:00.000Z",
            service_interest: "Supreme Combo Package",
          },
          error: null,
        },
      })
    );

    const data = await getBookingDetailData({
      bookingId: "b1",
      profile: makeProfile("s1"),
      fullScope: true,
    });
    expect(data.sourceEnquiry).toEqual({
      id: "e1",
      full_name: "Fatima Ahmed",
      created_at: "2026-01-01T09:00:00.000Z",
      service_interest: "Supreme Combo Package",
    });
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

// ─── F3 — health notes are redacted AT THE CALL SITE ─────────────────────────
//
// ⛔ WHY THIS EXISTS AND WHY THE EXISTING HELPER TEST IS NOT ENOUGH.
// `__tests__/redact-health-notes.test.ts` tests `redactHealthNotes()` directly
// and passes whatever happens here. Gate 02 measured the consequence: changing
// `booking: redactHealthNotes(booking, canViewHealthNotes)` to `booking,` at
// booking-detail-data.ts:493 left all 2,523 tests green. The helper was tested;
// the WIRING was not, and the wiring is what a future edit removes.
//
// ⛔ THERE IS NO DATABASE BACKSTOP. Measured 2026-08-19: `authenticated` holds
// no SELECT grant on public.client_notes, so the single RLS policy written for
// that table can never fire, and the app reads through the service-role client
// which bypasses RLS by design. These assertions are the only thing beneath the
// permission check.
//
// The `SECRET-` sentinel is checked against the WHOLE returned object, not just
// the two known fields: the risk F3 addresses is a value travelling to the
// browser inside the RSC payload even when it is not rendered, so any route out
// must fail, not only the two we thought of.
function stubClientWithHealthNotes() {
  return createFakeAdminClient({
    bookings: {
      data: {
        id: "b1",
        client_id: "c1",
        booking_date: "2026-01-10",
        start_time: "10:00",
        status: "confirmed",
        health_notes: "SECRET-BOOKING-NOTE",
        booking_participants: [
          { id: "p1", health_notes: "SECRET-PARTICIPANT-NOTE" },
        ],
        booking_items: [],
        booking_assignments: [],
      },
      error: null,
    },
    audit_logs: { data: [], error: null },
    booking_assignments: { data: [], error: null, count: 1 },
    enquiries: { data: null, error: null },
  });
}

describe("F3 — health notes are redacted in the data layer, not just the helper", () => {
  it("strips them for a viewer holding neither health permission", async () => {
    createSupabaseAdminClient.mockImplementation(() => stubClientWithHealthNotes());

    const data = await getBookingDetailData({
      bookingId: "b1",
      // opens the booking, carries NO health permission
      profile: makeProfile("s1", ["manage_bookings_all"]),
      fullScope: true,
    });

    expect(data.booking?.health_notes).toBeNull();
    expect(data.booking?.booking_participants?.[0]?.health_notes).toBeNull();
    // ⛔ the load-bearing one: nothing anywhere in the payload
    expect(JSON.stringify(data)).not.toContain("SECRET-");
  });

  it("keeps them for a viewer holding manage_sensitive_client_notes", async () => {
    createSupabaseAdminClient.mockImplementation(() => stubClientWithHealthNotes());

    const data = await getBookingDetailData({
      bookingId: "b2",
      profile: makeProfile("s2", [
        "manage_bookings_all",
        "manage_sensitive_client_notes",
      ]),
      fullScope: true,
    });

    expect(data.booking?.health_notes).toBe("SECRET-BOOKING-NOTE");
    expect(data.booking?.booking_participants?.[0]?.health_notes).toBe(
      "SECRET-PARTICIPANT-NOTE"
    );
  });

  it("keeps them for an assigned therapist holding only the assigned-scope permission", async () => {
    // D3 (2026-08-17): the first version of F3 used canManageSensitiveClientNotes
    // ALONE, which denied health notes to the therapist about to treat the
    // client. This pins the corrected rule so that regression cannot return.
    createSupabaseAdminClient.mockImplementation(() => stubClientWithHealthNotes());

    const data = await getBookingDetailData({
      bookingId: "b3",
      profile: makeProfile("s3", [
        "manage_bookings_all",
        "view_client_health_notes_assigned",
      ]),
      fullScope: true,
    });

    expect(data.booking?.health_notes).toBe("SECRET-BOOKING-NOTE");
  });
});
