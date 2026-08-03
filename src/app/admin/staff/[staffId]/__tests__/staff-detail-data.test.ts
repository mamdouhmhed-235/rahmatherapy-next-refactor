// C-09 Phase C Step 7 — cache behaviour for /admin/staff/[staffId].
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
const { getStaffDetailData, hasHiddenStaffAssignments } = await import(
  "../staff-detail-data"
);
const { TAGS } = await import("@/lib/cache/tag-taxonomy");

const OWNER_PARAMS = {
  staffId: "s2",
  viewerId: "s1",
  viewerGender: "female" as string | null,
  isOwnProfile: false,
  scope: "admin" as const,
  staffSelect: "id, name, gender, active, can_take_bookings, availability_mode",
  hasTeamAccess: true,
  canShowAdminPanels: true,
  canViewPermissionControls: true,
  canViewAudit: true,
  showClientWorkloadContext: true,
};

function stubClient() {
  return createFakeAdminClient({
    staff_profiles: [
      {
        data: {
          id: "s2",
          name: "Therapist",
          gender: "female",
          active: true,
          can_take_bookings: true,
          availability_mode: "use_global",
          role_id: "r1",
        },
        error: null,
      },
      { data: [{ id: "s2", name: "Therapist" }], error: null },
      { data: { name: "Owner" }, error: null },
    ],
    role_permissions: {
      data: [{ permission_id: "p1", permissions: { name: "manage_bookings_all" } }],
      error: null,
    },
    staff_permission_overrides: {
      data: [{ permission_id: "p1", is_granted: true }],
      error: null,
    },
    permissions: {
      data: [
        {
          id: "p1",
          name: "manage_bookings_all",
          description: null,
          category: "bookings",
          scope: "all",
          risk_level: "high",
        },
      ],
      error: null,
    },
    // C-16 Step 14 (N7) — two `.from("booking_assignments")` calls per fetch,
    // in this order: the capped rows, then the true head-count.
    booking_assignments: [
      {
        data: [
          {
            id: "a1",
            status: "assigned",
            required_therapist_gender: "female",
            bookings: {
              id: "b1",
              booking_date: "2026-01-10",
              start_time: "10:00",
              status: "confirmed",
            },
          },
        ],
        error: null,
      },
      { data: null, error: null, count: 19 },
    ],
    audit_logs: {
      data: [
        {
          id: "al1",
          action_type: "staff_profile_updated",
          created_at: "2026-01-02T09:30:00.000Z",
          actor_id: "s1",
        },
      ],
      error: null,
    },
    staff_availability_rules: { data: [{ id: "ar1" }], error: null },
  });
}

beforeEach(() => {
  cacheHarness.clear();
  createSupabaseAdminClient.mockReset();
  createSupabaseAdminClient.mockImplementation(() => stubClient());
});

describe("getStaffDetailData cache behaviour", () => {
  it("runs the fetcher on a cache miss", async () => {
    const data = await getStaffDetailData(OWNER_PARAMS);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(data.staff?.id).toBe("s2");
    expect(data.assignments).toHaveLength(1);
    expect(data.allPermissions).toHaveLength(1);
  });

  // C-16 Step 14 (N7) — the bound is in the query (a real head-count), not a
  // derivation over the already-capped `assignments` array: the true total
  // (19) is bigger than what the capped fetch could ever report (1 in this
  // fixture), which is exactly the "hidden rows" case page.tsx must be able
  // to detect.
  it("surfaces a true assignments total independent of the capped fetch (N7)", async () => {
    const data = await getStaffDetailData(OWNER_PARAMS);
    expect(data.assignmentsTotal).toBe(19);
    expect(data.assignmentsTotal).toBeGreaterThan(data.assignments.length);
  });

  it("does not re-run the fetcher on a cache hit", async () => {
    await getStaffDetailData(OWNER_PARAMS);
    await getStaffDetailData(OWNER_PARAMS);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it.each([TAGS.STAFF, TAGS.BOOKINGS, TAGS.AUDIT])(
    "re-runs the fetcher after the %s tag is invalidated",
    async (tag) => {
      await getStaffDetailData(OWNER_PARAMS);
      cacheHarness.invalidateTag(tag);
      await getStaffDetailData(OWNER_PARAMS);
      expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    }
  );

  it("keys separately per subject, per viewer and per panel-gating flags", async () => {
    await getStaffDetailData(OWNER_PARAMS);
    await getStaffDetailData({ ...OWNER_PARAMS, staffId: "s3" });
    await getStaffDetailData({ ...OWNER_PARAMS, viewerId: "s9" });
    await getStaffDetailData({ ...OWNER_PARAMS, canViewAudit: false });
    await getStaffDetailData({ ...OWNER_PARAMS, showClientWorkloadContext: false });
    expect(cacheHarness.size()).toBe(5);
  });

  it("keys separately per assignment/audit page size", async () => {
    await getStaffDetailData(OWNER_PARAMS);
    await getStaffDetailData({ ...OWNER_PARAMS, assignmentLimit: 50 });
    await getStaffDetailData({ ...OWNER_PARAMS, auditLimit: 20 });
    expect(cacheHarness.size()).toBe(3);
  });

  it("resolves the last-modified actor to a name string, not a row to re-query", async () => {
    const data = await getStaffDetailData(OWNER_PARAMS);
    expect(data.lastModifiedActorName).toBe("Owner");
  });

  it("returns a JSON-safe shape (no Map/Set/Date crosses the boundary)", async () => {
    const data = await getStaffDetailData(OWNER_PARAMS);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });
});

// C-16 Step 14 (N7) — the two independent ways the panel can be truncating,
// and the case that must stay false (nothing hidden at all).
describe("hasHiddenStaffAssignments", () => {
  it("is false when the fetch is complete and the past slice isn't truncating", () => {
    expect(
      hasHiddenStaffAssignments({
        assignmentsTotal: 3,
        fetchedCount: 3,
        pastCount: 2,
        visiblePastCount: 2,
      })
    ).toBe(false);
  });

  it("is true when the 16-row fetch itself is short of the true total", () => {
    expect(
      hasHiddenStaffAssignments({
        assignmentsTotal: 40,
        fetchedCount: 16,
        pastCount: 5,
        visiblePastCount: 5,
      })
    ).toBe(true);
  });

  it("SABOTAGE TARGET — is true when only the panel's own 8-visible past slice is truncating (fetch itself is complete)", () => {
    // This is the exact N7 gap: 16-row fetch caught everything (total ==
    // fetched), but the panel's in-panel disclosure only ever shows 8 of the
    // past ones it already has. If this branch were dropped (`||` narrowed
    // to just the assignmentsTotal check), this case would wrongly report
    // "nothing hidden" while 4 past assignments sit unreachable.
    expect(
      hasHiddenStaffAssignments({
        assignmentsTotal: 12,
        fetchedCount: 12,
        pastCount: 12,
        visiblePastCount: 8,
      })
    ).toBe(true);
  });
});
