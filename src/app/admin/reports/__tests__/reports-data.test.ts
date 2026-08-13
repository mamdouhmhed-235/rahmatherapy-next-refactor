// ITEM N — the insights stripe must never name a colleague to a Therapist.
//
// The two halves of that guarantee are already covered elsewhere and BOTH stay
// green if the guarantee is removed:
//   - `resolvableStaffFor` itself — ../reporting.test.ts
//   - the rule that renders the name — ./report-insights.test.ts
// What is covered HERE is the line joining them, in reports-data.ts:
//   `staff: resolvableStaffFor(profile, data.staff)`
// Delete it and both of those suites still pass, while a Therapist starts
// seeing a colleague named on an ordinary page load.
//
// `getReportData` is the ONLY thing stubbed. The guard, the prior-period
// arithmetic and the insight rules all run for real — a spec that mocked the
// guard would be asserting against itself.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/lib/auth/rbac";

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

vi.mock("@sentry/nextjs", () => ({
  startSpan: (_options: unknown, callback: () => unknown) => callback(),
  captureException: vi.fn(),
}));

const getReportData = vi.fn();
vi.mock("../reporting", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../reporting")>();
  return { ...actual, getReportData: (...args: unknown[]) => getReportData(...args) };
});

const { createFakeAdminClient } = await import(
  "@/lib/cache/__tests__/fake-supabase-admin"
);
const { fetchReportInsights } = await import("../reports-data");
const { getReportInsights } = await import("../report-insights");
import type { ReportData, ReportFilters } from "../reporting";
import type { StaffProfile } from "@/lib/auth/rbac";


function profile(id: string, permissions: string[]): StaffProfile {
  return {
    id,
    auth_user_id: `auth-${id}`,
    name: "Viewer",
    email: `${id}@example.test`,
    role_id: "role-x",
    role_name: "Therapist",
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set(permissions),
  } as unknown as StaffProfile;
}

function staffFixture(id: string, name: string): ReportData["staff"][number] {
  return {
    id,
    name,
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "custom",
    role_id: "role-therapist",
    roles: null,
  };
}

const FILTERS: ReportFilters = {
  range: "month",
  from: "2026-06-01",
  to: "2026-06-30",
  staffId: "",
  service: "",
  source: "",
  status: "",
  paymentStatus: "",
  city: "",
};

/** `staff-b` worked 09:00-`endTime` against one 8-hour working day. */
function period(from: string, to: string, endTime: string): ReportData {
  return {
    filters: { ...FILTERS, from, to },
    bookings: [
      {
        id: `b-${from}`,
        client_id: null,
        booking_date: from,
        start_time: "09:00",
        end_time: endTime,
        status: "completed",
        payment_status: "paid",
        assignment_status: "assigned",
        reschedule_status: "none",
        customer_cancelled_at: null,
        total_price: 50,
        amount_due: 50,
        amount_paid: 50,
        booking_source: "website",
        contact_full_name: null,
        contact_email: null,
        contact_phone: null,
        service_city: null,
        service_postcode: null,
        service_address_line1: null,
        health_notes: null,
        created_at: "",
      },
    ],
    cityOptions: [],
    assignments: [
      {
        id: `a-${from}`,
        booking_id: `b-${from}`,
        participant_id: null,
        assigned_staff_id: "staff-b",
        required_therapist_gender: "female",
        status: "completed",
        staff_profiles: null,
      },
    ],
    bookingItems: [],
    clients: [],
    staff: [staffFixture("staff-a", "Amina Viewer"), staffFixture("staff-b", "Bilqis Colleague")],
    enquiries: [],
    emailEvents: [],
    operationalEvents: [],
    staffAvailabilityRuleStaffIds: ["staff-b"],
    staffAvailabilityRules: [
      { staff_id: "staff-b", day_of_week: 1, start_time: "09:00", end_time: "17:00", is_working_day: true },
    ],
  } as unknown as ReportData;
}

const CURRENT = period("2026-06-01", "2026-06-30", "10:00"); // 1h booked
const PRIOR = period("2026-05-01", "2026-05-31", "15:00"); // 6h booked

beforeEach(() => {
  cacheHarness.clear();
  createSupabaseAdminClient.mockReset();
  // The only real read left in this path is the dismissals lookup.
  createSupabaseAdminClient.mockImplementation(() =>
    createFakeAdminClient({ insight_dismissals: { data: [], error: null } })
  );
  getReportData.mockReset();
  // Keyed on the period rather than call order, so the prior-period fetch
  // cannot be satisfied by the current period's rows if the order ever moves.
  getReportData.mockImplementation(
    (_client: unknown, _profile: unknown, filters: ReportFilters) =>
      filters.from === "2026-06-01" ? CURRENT : PRIOR
  );
});

describe("fetchReportInsights narrows the roster before the rules see it", () => {
  it("hands a Therapist no insight about a colleague", async () => {
    const therapist = profile("staff-a", [
      PERMISSIONS.VIEW_REPORTS_OWN,
      PERMISSIONS.VIEW_BOOKINGS_ASSIGNED,
    ]);

    const insights = await fetchReportInsights(therapist, FILTERS);

    expect(insights.some((i) => i.message.includes("Bilqis"))).toBe(false);
    expect(insights.some((i) => i.id.startsWith("staff-utilisation-"))).toBe(false);
  });

  it("still hands the same insight to a viewer who may see the roster", async () => {
    // The contrast is the point: without it, a spec asserting only the absence
    // above would pass just as happily against a fixture that produces nothing.
    const owner = profile("staff-a", [PERMISSIONS.VIEW_STAFF]);

    const insights = await fetchReportInsights(owner, FILTERS);

    expect(insights.some((i) => i.message.includes("Bilqis Colleague"))).toBe(true);
  });

  it("the fixture really does trip the rule when nothing narrows it", () => {
    // Anchors the two cases above to the unguarded baseline, so a fixture that
    // silently stopped firing could not be mistaken for a working guard.
    expect(
      getReportInsights(CURRENT, PRIOR).some((i) => i.id.startsWith("staff-utilisation-"))
    ).toBe(true);
  });
});
