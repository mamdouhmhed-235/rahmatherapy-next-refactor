import { describe, expect, it } from "vitest";
import { PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import { getDashboardQueryPlan } from "./dashboard-data";

function profile(
  permissions: string[],
  overrides: Partial<StaffProfile> = {}
): StaffProfile {
  return {
    id: "staff-a",
    auth_user_id: "auth-a",
    name: "Staff A",
    email: "staff-a@example.test",
    role_id: "role-a",
    role_name: "Staff",
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set(permissions),
    ...overrides,
  };
}

describe("getDashboardQueryPlan", () => {
  it("allows Owner/Admin style profiles to load business-wide dashboard data with revenue only when permitted", () => {
    expect(
      getDashboardQueryPlan(
        profile([
          PERMISSIONS.VIEW_DASHBOARD,
          PERMISSIONS.VIEW_BOOKINGS_ALL,
          PERMISSIONS.VIEW_REPORTS_BUSINESS,
          PERMISSIONS.VIEW_REPORTS_REVENUE,
          PERMISSIONS.VIEW_CLIENTS_ALL,
          PERMISSIONS.VIEW_STAFF,
          PERMISSIONS.MANAGE_ENQUIRIES,
          PERMISSIONS.VIEW_EMAIL_LOGS,
          PERMISSIONS.MANAGE_SETTINGS,
        ])
      )
    ).toMatchObject({
      variant: "business",
      bookingScope: "all",
      includeRevenue: true,
      includeClients: true,
      includeStaff: true,
      includeEnquiries: true,
      includeEmailEvents: true,
      includeOperationalEvents: true,
    });
  });

  it("keeps Booking Coordinator dashboards operational and excludes revenue and staff-admin data", () => {
    expect(
      getDashboardQueryPlan(
        profile([
          PERMISSIONS.VIEW_DASHBOARD,
          PERMISSIONS.VIEW_BOOKINGS_ALL,
          PERMISSIONS.MANAGE_BOOKINGS_ALL,
          PERMISSIONS.VIEW_REPORTS_OPERATIONAL,
          PERMISSIONS.VIEW_CLIENTS_ALL,
          PERMISSIONS.MANAGE_ENQUIRIES,
          PERMISSIONS.VIEW_EMAIL_LOGS,
        ])
      )
    ).toMatchObject({
      variant: "coordinator",
      bookingScope: "all",
      includeRevenue: false,
      includeClients: true,
      includeStaff: false,
      includeEnquiries: true,
      includeEmailEvents: true,
      includeOperationalEvents: false,
    });
  });

  it("keeps Therapist dashboards assigned and claimable only", () => {
    expect(
      getDashboardQueryPlan(
        profile([
          PERMISSIONS.VIEW_DASHBOARD,
          PERMISSIONS.VIEW_BOOKINGS_ASSIGNED,
          PERMISSIONS.CLAIM_ASSIGNMENTS,
          PERMISSIONS.VIEW_REPORTS_OWN,
          PERMISSIONS.VIEW_CLIENTS_ASSIGNED,
          PERMISSIONS.MANAGE_AVAILABILITY_OWN,
        ])
      )
    ).toMatchObject({
      variant: "therapist",
      bookingScope: "assigned_and_claimable",
      includeRevenue: false,
      includeClients: "linked",
      includeStaff: "own",
      includeEnquiries: false,
      includeEmailEvents: false,
      includeOperationalEvents: false,
    });
  });

  it("denies missing or inactive dashboard profiles", () => {
    expect(getDashboardQueryPlan(null)).toMatchObject({
      variant: "blocked",
      bookingScope: "none",
    });
    expect(getDashboardQueryPlan(profile([], { active: false }))).toMatchObject({
      variant: "blocked",
      bookingScope: "none",
    });
  });
});
