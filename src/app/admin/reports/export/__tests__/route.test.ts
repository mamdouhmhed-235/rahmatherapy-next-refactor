import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { StaffProfile } from "@/lib/auth/rbac";
import type { ReportData, ReportFilters } from "../../reporting";

/**
 * ⛔ WHY THIS FILE EXISTS — ITEM L, a live data-exposure defect.
 *
 * `/admin/reports/export` had no test of any kind, and that absence is part of
 * how this shipped. The route's permission gate looks correct — it requires an
 * export permission — but `Therapist` is granted BOTH `view_reports_own` and
 * `export_reports_own`
 * (20260509143000_granular_rbac_consolidation.sql:283-284), so it passes. The
 * report itself is chosen by an UNVALIDATED query parameter, and `getReportData`
 * returns `clients` as the full clinic-wide table for every profile — it scopes
 * only `bookings`/`assignments`/`bookingItems`.
 *
 * Every other consumer narrows afterwards (reports/page.tsx does it at sixteen
 * call sites). This route did not, so `report=client_summary` served a CSV of
 * EVERY client's full name to any therapist who asked for it.
 *
 * The first assertion below fails against the pre-fix route.
 */

const getReportDataMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: () => ({ insert: vi.fn(async () => ({ data: null, error: null })) }),
  })),
}));

// Only identity is a fixture — the REAL permission logic runs, so
// `hasUniversalReportScope` is exercised rather than stubbed.
vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: vi.fn(),
}));

// Spread the real module so `filterReportDataToStaff` and
// `hasUniversalReportScope` keep their real behaviour; only the fetch is faked.
vi.mock("../../reporting", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../reporting")>()),
  getReportData: (...args: unknown[]) => getReportDataMock(...args),
}));

const { getStaffProfile } = await import("@/lib/auth/rbac");
const { GET } = await import("../route");

const THERAPIST_ID = "staff-therapist";

function profile(overrides: Partial<StaffProfile> & { permissions: Set<string> }): StaffProfile {
  return {
    id: THERAPIST_ID,
    auth_user_id: "auth-1",
    name: "Test Therapist",
    email: "therapist@example.test",
    role_id: "role-1",
    role_name: "Therapist",
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "standard",
    ...overrides,
  } as StaffProfile;
}

function filters(): ReportFilters {
  return {
    range: "month", from: "2026-06-01", to: "2026-06-30",
    staffId: "", service: "", source: "", status: "",
    paymentStatus: "", city: "",
  } as ReportFilters;
}

/**
 * Two clients. Only `client-mine` is reachable from a booking this therapist is
 * assigned to; `client-someone-else` belongs to a colleague's booking and the
 * therapist has no relationship to it at all.
 */
function reportData(): ReportData {
  return {
    filters: filters(),
    bookings: [
      { id: "booking-mine", client_id: "client-mine" },
      { id: "booking-theirs", client_id: "client-someone-else" },
    ],
    cityOptions: [],
    assignments: [
      { booking_id: "booking-mine", assigned_staff_id: THERAPIST_ID, status: "completed" },
      { booking_id: "booking-theirs", assigned_staff_id: "staff-other", status: "completed" },
    ],
    bookingItems: [],
    clients: [
      { id: "client-mine", full_name: "My Own Client", client_source: "web", created_at: "2026-06-01" },
      { id: "client-someone-else", full_name: "Somebody Elses Client", client_source: "web", created_at: "2026-06-02" },
    ],
    staff: [],
    enquiries: [],
    emailEvents: [],
    operationalEvents: [],
    staffAvailabilityRuleStaffIds: [],
  } as unknown as ReportData;
}

const request = () =>
  new NextRequest("http://localhost:3000/admin/reports/export?report=client_summary&from=2026-06-01&to=2026-06-30");

beforeEach(() => {
  vi.clearAllMocks();
  getReportDataMock.mockResolvedValue(reportData());
});

describe("/admin/reports/export — client_summary scoping", () => {
  it("does not let a therapist export clients they have no relationship to", async () => {
    // Exactly the Therapist grant from the RBAC migration: it PASSES the
    // route's gate, which is why the gate alone was never sufficient.
    vi.mocked(getStaffProfile).mockResolvedValue(
      profile({ permissions: new Set(["view_reports_own", "export_reports_own"]) })
    );

    const csv = await (await GET(request())).text();

    expect(csv).toContain("My Own Client");
    // ⛔ The assertion that matters. Pre-fix this row was in the download.
    expect(csv).not.toContain("Somebody Elses Client");
  });

  it("leaves a universal-scope profile's export untouched", async () => {
    // An Owner must still get the whole clinic — the fix must narrow for the
    // scoped case only, never for someone entitled to everything.
    vi.mocked(getStaffProfile).mockResolvedValue(
      profile({
        role_name: "Owner",
        permissions: new Set([
          "view_reports_own", "export_reports_own", "view_reports_business",
        ]),
      })
    );

    const csv = await (await GET(request())).text();

    expect(csv).toContain("My Own Client");
    expect(csv).toContain("Somebody Elses Client");
  });

  it("refuses a profile with no export permission at all", async () => {
    vi.mocked(getStaffProfile).mockResolvedValue(
      profile({ permissions: new Set(["view_reports_own"]) })
    );

    expect((await GET(request())).status).toBe(403);
  });
});
