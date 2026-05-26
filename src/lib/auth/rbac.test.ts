import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canAssignStaffRoles,
  canExportOwnReports,
  canManageAllClients,
  canManageOperations,
  canManagePermissionOverrides,
  canManageRoleTemplates,
  canManageStaffProfiles,
  canViewOperationalReports,
  canViewRevenueReports,
  getRoleDisplayName,
  PERMISSIONS,
  type StaffProfile,
} from "./rbac";

function profile(permissions: string[]): StaffProfile {
  return {
    id: "staff-a",
    auth_user_id: "auth-a",
    name: "Staff A",
    email: "staff-a@example.test",
    role_id: "role-a",
    role_name: "Therapist",
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set(permissions),
  };
}

describe("canonical RBAC helpers", () => {
  it("uses database display labels with role name fallback", () => {
    expect(getRoleDisplayName({ name: "Admin", display_label: "Admin / Practice Manager" })).toBe(
      "Admin / Practice Manager"
    );
    expect(getRoleDisplayName({ name: "Therapist", display_label: null })).toBe("Therapist");
  });

  it("keeps owner-only role template and override permissions explicit", () => {
    const owner = profile([
      PERMISSIONS.MANAGE_ROLE_TEMPLATES,
      PERMISSIONS.MANAGE_PERMISSION_OVERRIDES,
    ]);
    const admin = profile([
      PERMISSIONS.MANAGE_STAFF_PROFILES,
      PERMISSIONS.ASSIGN_STAFF_ROLES,
    ]);

    expect(canManageRoleTemplates(owner)).toBe(true);
    expect(canManagePermissionOverrides(owner)).toBe(true);
    expect(canManageRoleTemplates(admin)).toBe(false);
    expect(canManagePermissionOverrides(admin)).toBe(false);
    expect(canManageStaffProfiles(admin)).toBe(true);
    expect(canAssignStaffRoles(admin)).toBe(true);
  });

  it("separates coordinator, therapist, and revenue reporting scope", () => {
    const coordinator = profile([
      PERMISSIONS.VIEW_REPORTS_OPERATIONAL,
      PERMISSIONS.MANAGE_CLIENTS_ALL,
    ]);
    const therapist = profile([
      PERMISSIONS.VIEW_REPORTS_OWN,
      PERMISSIONS.EXPORT_REPORTS_OWN,
    ]);
    const revenue = profile([PERMISSIONS.VIEW_REPORTS_REVENUE]);

    expect(canViewOperationalReports(coordinator)).toBe(true);
    expect(canManageAllClients(coordinator)).toBe(true);
    expect(canViewRevenueReports(coordinator)).toBe(false);
    expect(canExportOwnReports(therapist)).toBe(true);
    expect(canViewRevenueReports(therapist)).toBe(false);
    expect(canViewRevenueReports(revenue)).toBe(true);
  });

  it("keeps booking coordinator away from operations-only controls", () => {
    const coordinator = profile([
      PERMISSIONS.MANAGE_BOOKINGS_ALL,
      PERMISSIONS.VIEW_EMAIL_LOGS,
      PERMISSIONS.RESEND_BOOKING_EMAILS,
    ]);
    const practiceManager = profile([PERMISSIONS.MANAGE_EMAIL_SETTINGS]);

    expect(canManageOperations(coordinator)).toBe(false);
    expect(canManageOperations(practiceManager)).toBe(true);
  });

  it("keeps the canonical migration CRUD-ready for roles and permissions", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260509143000_granular_rbac_consolidation.sql"),
      "utf8"
    );

    expect(sql).toContain("add column if not exists display_label");
    expect(sql).toContain("add column if not exists sort_order");
    expect(sql).toContain("add column if not exists category");
    expect(sql).toContain("add column if not exists scope");
    expect(sql).toContain("add column if not exists risk_level");
    expect(sql).toContain("create temporary table _rbac_permission_migration_map");
  });
});
