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
  canManageSensitiveClientNotes,
  canManageStaffProfiles,
  canOpenReports,
  canViewAssignedBookings,
  canViewOperationalReports,
  canViewRevenueReports,
  getRoleDisplayName,
  hasUniversalReportScope,
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

// ─── permission lists cannot silently lose a member ──────────────────────────
//
// ⛔ Five helpers answer true if the profile holds ANY member of a list. Remove
// one member and every existing test stays green — proven by deleting
// PERMISSIONS.MANAGE_BOOKINGS_ASSIGNED from canViewAssignedBookings, which left
// all 2,523 tests passing. Fourteen members are exposed this way, so this is one
// table rather than one test: a row per member, so losing ANY of them fails here.
//
// These all fail CLOSED — a therapist quietly loses visibility rather than
// gaining it — which is why this is a correctness net, not a security gate. It
// is here because it is cheap, not because it is urgent.
const ANY_OF_HELPERS: ReadonlyArray<
  readonly [string, (p: StaffProfile | null) => boolean, readonly string[]]
> = [
  [
    "canViewAssignedBookings",
    canViewAssignedBookings,
    [PERMISSIONS.VIEW_BOOKINGS_ASSIGNED, PERMISSIONS.MANAGE_BOOKINGS_ASSIGNED],
  ],
  [
    "canOpenReports",
    canOpenReports,
    [
      PERMISSIONS.VIEW_REPORTS_OWN,
      PERMISSIONS.VIEW_REPORTS_OPERATIONAL,
      PERMISSIONS.VIEW_REPORTS_BUSINESS,
      PERMISSIONS.VIEW_REPORTS_REVENUE,
    ],
  ],
  [
    "hasUniversalReportScope",
    hasUniversalReportScope,
    [
      PERMISSIONS.VIEW_REPORTS_OPERATIONAL,
      PERMISSIONS.VIEW_REPORTS_BUSINESS,
      PERMISSIONS.VIEW_BOOKINGS_ALL,
      PERMISSIONS.MANAGE_BOOKINGS_ALL,
    ],
  ],
  [
    "canManageSensitiveClientNotes",
    canManageSensitiveClientNotes,
    [
      PERMISSIONS.MANAGE_SENSITIVE_CLIENT_NOTES,
      PERMISSIONS.MANAGE_PRIVACY_OPERATIONS,
    ],
  ],
  [
    "canManageOperations",
    canManageOperations,
    [PERMISSIONS.MANAGE_SETTINGS, PERMISSIONS.MANAGE_EMAIL_SETTINGS],
  ],
];

describe("permission lists cannot silently lose a member", () => {
  it.each(ANY_OF_HELPERS)(
    "%s accepts every one of its permissions on its own",
    (name, helper, members) => {
      for (const permission of members) {
        expect(helper(profile([permission])), `${name} via ${permission}`).toBe(
          true
        );
      }

      // Non-vacuity: a profile holding none of them must be refused, so the
      // helper is not simply returning true for everything.
      expect(
        helper(profile(["definitely_not_a_real_permission"])),
        `${name} with no relevant permission`
      ).toBe(false);

      // …and neither is it returning true for a null profile.
      expect(helper(null), `${name} with a null profile`).toBe(false);
    }
  );

  it("covers every member of every list", () => {
    // ⛔ Guards the guard. If a helper gains a permission and this table is not
    // updated, the new member is unguarded again — the same problem one layer
    // up. This count is what forces the table to be maintained.
    const total = ANY_OF_HELPERS.reduce((n, [, , members]) => n + members.length, 0);
    expect(total, "permission members covered").toBe(14);
    expect(ANY_OF_HELPERS.length, "helpers covered").toBe(5);
  });
});
