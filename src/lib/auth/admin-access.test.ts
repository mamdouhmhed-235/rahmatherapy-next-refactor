import { describe, expect, it } from "vitest";
import type { StaffProfile } from "./rbac";
import {
  ADMIN_PAGE_KEYS,
  canAccessAdminPage,
  getAdminPageAccess,
  getVisibleAdminPages,
  type AdminDataScope,
  type AdminPageKey,
} from "./admin-access";
import roleGrantsFixture from "./role-grants.json";

const EXPECTED_PAGE_KEYS: AdminPageKey[] = [
  "dashboard",
  "bookings",
  "bookingDetail",
  "calendar",
  "reports",
  "clients",
  "clientDetail",
  "enquiries",
  "staff",
  "staffDetail",
  "roles",
  "roleDetail",
  "services",
  "availability",
  "emails",
  "operations",
  "audit",
  "privacy",
  "settings",
  "profile",
  "accountRequests",
];

// ⛔ GATE 07 CASE 3 — the role fixtures are NOT written here.
//
// They used to be, and they had drifted. Measured 2026-08-20 against the live
// database: the Owner list held 36 of 40 permissions, Admin 29 of 32 and
// Therapist 11 of 12. The four missing from Owner were
// manage_client_identity_fields, manage_client_destructive_ops,
// manage_email_templates and manage_travel_origin; the Therapist was missing
// resend_booking_emails, which is what actually opens the emails page for them.
//
// Nothing here was falsely green — every drifted permission unlocked a cell the
// old tests did not assert — but this file had been describing three roles that
// do not exist in production. That is exactly the failure mode
// scripts/verify-rbac-grants.mjs was built to catch, one layer up, and it could
// not see it because these lists were a separate copy.
//
// They now come from src/lib/auth/role-grants.json, the single fixture that
// script checks against the live database. Recorded as FIND-07-C.
const ROLE_GRANTS = (
  roleGrantsFixture as { roles: Record<string, { grants: string[] }> }
).roles;

function grantsFor(role: string): string[] {
  const entry = ROLE_GRANTS[role];
  if (!entry) throw new Error(`role "${role}" missing from role-grants.json`);
  return entry.grants;
}

const OWNER_PERMISSIONS = grantsFor("Owner");
const ADMIN_PERMISSIONS = grantsFor("Admin");
const BOOKING_COORDINATOR_PERMISSIONS = grantsFor("Booking Coordinator");
const THERAPIST_PERMISSIONS = grantsFor("Therapist");
const INACTIVE_ROLE_PERMISSIONS = grantsFor("Inactive");

function profile(
  roleName: string,
  permissions: string[],
  overrides: Partial<StaffProfile> = {}
): StaffProfile {
  return {
    id: "staff-a",
    auth_user_id: "auth-a",
    name: "Staff A",
    email: "staff-a@example.test",
    role_id: "role-a",
    role_name: roleName,
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set(permissions),
    ...overrides,
  };
}

describe("admin access matrix", () => {
  it("defines an explicit rule for every admin page key", () => {
    expect(ADMIN_PAGE_KEYS).toEqual(EXPECTED_PAGE_KEYS);
  });

  it("denies every admin page for missing and inactive staff profiles", () => {
    const inactive = profile("Inactive / Suspended", OWNER_PERMISSIONS, {
      active: false,
    });

    for (const pageKey of ADMIN_PAGE_KEYS) {
      expect(getAdminPageAccess(null, pageKey)).toMatchObject({
        access: false,
        dataScope: "none",
      });
      expect(getAdminPageAccess(inactive, pageKey)).toMatchObject({
        access: false,
        dataScope: "none",
      });
      expect(getAdminPageAccess(inactive, pageKey).actions).toEqual({
        view: false,
        create: false,
        edit: false,
        assign: false,
        claim: false,
        export: false,
        manageSettings: false,
        manageRoles: false,
        manageProfiles: false,
        approveRequests: false,
        viewSensitiveFields: false,
      });
    }
  });

  it("gives Owner broad access while keeping owner-only role actions permission-gated", () => {
    const owner = profile("Owner / Main Admin", OWNER_PERMISSIONS);

    expect(getVisibleAdminPages(owner)).toEqual(EXPECTED_PAGE_KEYS);
    expect(getAdminPageAccess(owner, "dashboard")).toMatchObject({
      access: true,
      dataScope: "all",
    });
    expect(getAdminPageAccess(owner, "roles")).toMatchObject({
      access: true,
      dataScope: "all",
      actions: expect.objectContaining({ manageRoles: true }),
    });
    expect(getAdminPageAccess(owner, "staff")).toMatchObject({
      access: true,
      dataScope: "all",
      actions: expect.objectContaining({ manageProfiles: true }),
    });
    expect(getAdminPageAccess(owner, "privacy").actions.viewSensitiveFields).toBe(true);
  });

  it("gives Admin broad operational access without role template management", () => {
    const admin = profile("Admin / Practice Manager", ADMIN_PERMISSIONS);

    expect(getAdminPageAccess(admin, "bookings")).toMatchObject({
      access: true,
      dataScope: "all",
      actions: expect.objectContaining({ assign: true, edit: true }),
    });
    expect(getAdminPageAccess(admin, "roles")).toMatchObject({
      access: false,
      dataScope: "none",
      actions: expect.objectContaining({ manageRoles: false }),
    });
    expect(getAdminPageAccess(admin, "accountRequests")).toMatchObject({
      access: true,
      dataScope: "all",
      actions: expect.objectContaining({ approveRequests: true }),
    });
  });

  it("keeps Booking Coordinator on operational booking, client, enquiry, and email scopes", () => {
    const coordinator = profile(
      "Client Care / Booking Coordinator",
      BOOKING_COORDINATOR_PERMISSIONS
    );

    expect(getAdminPageAccess(coordinator, "dashboard")).toMatchObject({
      access: true,
      dataScope: "operational",
    });
    expect(getAdminPageAccess(coordinator, "bookings")).toMatchObject({
      access: true,
      dataScope: "all",
      actions: expect.objectContaining({ assign: true, edit: true }),
    });
    expect(getAdminPageAccess(coordinator, "clients")).toMatchObject({
      access: true,
      dataScope: "sensitive_hidden",
      actions: expect.objectContaining({ viewSensitiveFields: false }),
    });
    expect(getAdminPageAccess(coordinator, "enquiries")).toMatchObject({
      access: true,
      dataScope: "operational",
    });
    expect(getAdminPageAccess(coordinator, "emails")).toMatchObject({
      access: true,
      dataScope: "operational",
      actions: expect.objectContaining({ edit: true }),
    });
    expect(canAccessAdminPage(coordinator, "roles")).toBe(false);
    expect(getAdminPageAccess(coordinator, "staff")).toMatchObject({
      access: true,
      dataScope: "team_visible",
      actions: expect.objectContaining({ manageProfiles: false }),
    });
    expect(canAccessAdminPage(coordinator, "settings")).toBe(false);
    expect(canAccessAdminPage(coordinator, "privacy")).toBe(false);
  });

  it("keeps Therapist on assigned, own, and sensitive-limited scopes", () => {
    const therapist = profile("Therapist", THERAPIST_PERMISSIONS);

    expect(getAdminPageAccess(therapist, "dashboard")).toMatchObject({
      access: true,
      dataScope: "own",
    });
    expect(getAdminPageAccess(therapist, "bookings")).toMatchObject({
      access: true,
      dataScope: "assigned",
      actions: expect.objectContaining({ claim: true, assign: false }),
    });
    expect(getAdminPageAccess(therapist, "clients")).toMatchObject({
      access: true,
      dataScope: "assigned",
      actions: expect.objectContaining({
        create: true,
        viewSensitiveFields: true,
      }),
    });
    expect(getAdminPageAccess(therapist, "reports")).toMatchObject({
      access: true,
      dataScope: "own",
      actions: expect.objectContaining({ export: true }),
    });
    expect(getAdminPageAccess(therapist, "availability")).toMatchObject({
      access: true,
      dataScope: "own",
    });
    expect(canAccessAdminPage(therapist, "roles")).toBe(false);
    expect(getAdminPageAccess(therapist, "staff")).toMatchObject({
      access: true,
      dataScope: "same_gender_team",
      actions: expect.objectContaining({ manageProfiles: false }),
    });
    expect(canAccessAdminPage(therapist, "audit")).toBe(false);
    expect(canAccessAdminPage(therapist, "privacy")).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// GATE 07 CASE 3 - THE COMPLETE PAGE-ACCESS MATRIX: 21 pages x 5 roles.
//
// The tests above check a handful of pages per role. This checks all of them.
//
// Two parallel authorization systems exist in this app and they can drift:
// getAdminPageAccess drives the nav, but only 6 of the 21 pages consult it - the
// other 15 hand-roll their checks. So this matrix is NOT proof of enforcement,
// and it is not offered as such. It is the complete, pinned statement of what
// the nav layer believes, which is what makes the nav-vs-enforcement comparison
// in case 19 possible at all.
//
// One row is worth reading before anyone treats a dataScope as an enforcement
// claim. Therapist x emails is [true, "operational"], because a therapist holds
// resend_booking_emails. That is a NAV answer, not a data answer: the page
// hand-rolls its own check (canViewEmailLogs gates the delivery tab) and
// emails-data.ts returns early when it is false, so a therapist reaches the page
// and still cannot read the delivery log. Checked in the source before being
// written down here, rather than inferred from the scope label.
//
// Every cell below was measured from the live role grants and is pinned so that
// any future change to the matrix has to be deliberate. The intent behind the
// rows that matter is asserted separately, by hand, under "invariants".

type Cell = readonly [boolean, AdminDataScope, readonly string[]];

const PAGE_ACCESS_MATRIX: Record<string, Record<AdminPageKey, Cell>> = {
  "Owner": {
    dashboard: [true, "all", ["view", "export", "viewSensitiveFields"]],
    bookings: [true, "all", ["view", "create", "edit", "assign", "claim"]],
    bookingDetail: [true, "all", ["view", "create", "edit", "assign", "claim"]],
    calendar: [true, "all", ["view", "create", "edit", "assign", "claim"]],
    reports: [true, "all", ["view", "export", "viewSensitiveFields"]],
    clients: [true, "all", ["view", "create", "edit", "viewSensitiveFields"]],
    clientDetail: [true, "all", ["view", "create", "edit", "viewSensitiveFields"]],
    enquiries: [true, "operational", ["view", "create", "edit"]],
    staff: [true, "all", ["view", "create", "edit", "assign", "manageProfiles"]],
    staffDetail: [true, "all", ["view", "create", "edit", "assign", "manageProfiles"]],
    roles: [true, "all", ["view", "create", "edit", "manageRoles", "viewSensitiveFields"]],
    roleDetail: [true, "all", ["view", "create", "edit", "manageRoles", "viewSensitiveFields"]],
    services: [true, "all", ["view", "create", "edit"]],
    availability: [true, "all", ["view", "edit"]],
    emails: [true, "operational", ["view", "edit", "manageSettings"]],
    operations: [true, "operational", ["view", "edit", "manageSettings"]],
    audit: [true, "all", ["view", "viewSensitiveFields"]],
    privacy: [true, "all", ["view", "edit", "approveRequests", "viewSensitiveFields"]],
    settings: [true, "all", ["view", "edit", "manageSettings"]],
    profile: [true, "own", ["view", "edit"]],
    accountRequests: [true, "all", ["view", "edit", "approveRequests"]],
  },
  "Admin": {
    dashboard: [true, "all", ["view", "export", "viewSensitiveFields"]],
    bookings: [true, "all", ["view", "create", "edit", "assign", "claim"]],
    bookingDetail: [true, "all", ["view", "create", "edit", "assign", "claim"]],
    calendar: [true, "all", ["view", "create", "edit", "assign", "claim"]],
    reports: [true, "all", ["view", "export", "viewSensitiveFields"]],
    clients: [true, "all", ["view", "create", "edit", "viewSensitiveFields"]],
    clientDetail: [true, "all", ["view", "create", "edit", "viewSensitiveFields"]],
    enquiries: [true, "operational", ["view", "create", "edit"]],
    staff: [true, "all", ["view", "create", "edit", "assign", "manageProfiles"]],
    staffDetail: [true, "all", ["view", "create", "edit", "assign", "manageProfiles"]],
    roles: [false, "none", []],
    roleDetail: [false, "none", []],
    services: [true, "all", ["view", "create", "edit"]],
    availability: [true, "all", ["view", "edit"]],
    emails: [true, "operational", ["view", "edit", "manageSettings"]],
    operations: [true, "operational", ["view", "edit", "manageSettings"]],
    audit: [true, "all", ["view", "viewSensitiveFields"]],
    privacy: [true, "all", ["view", "edit", "approveRequests", "viewSensitiveFields"]],
    settings: [true, "all", ["view", "edit", "manageSettings"]],
    profile: [true, "own", ["view", "edit"]],
    accountRequests: [true, "all", ["view", "edit", "approveRequests"]],
  },
  "Booking Coordinator": {
    dashboard: [true, "operational", ["view"]],
    bookings: [true, "all", ["view", "create", "edit", "assign"]],
    bookingDetail: [true, "all", ["view", "create", "edit", "assign"]],
    calendar: [true, "all", ["view", "create", "edit", "assign"]],
    reports: [true, "operational", ["view"]],
    clients: [true, "sensitive_hidden", ["view", "create", "edit"]],
    clientDetail: [true, "sensitive_hidden", ["view", "create", "edit"]],
    enquiries: [true, "operational", ["view", "create", "edit"]],
    staff: [true, "team_visible", ["view"]],
    staffDetail: [true, "team_visible", ["view"]],
    roles: [false, "none", []],
    roleDetail: [false, "none", []],
    services: [false, "none", []],
    availability: [false, "none", []],
    emails: [true, "operational", ["view", "edit"]],
    operations: [false, "none", []],
    audit: [false, "none", []],
    privacy: [false, "none", []],
    settings: [false, "none", []],
    profile: [true, "own", ["view", "edit"]],
    accountRequests: [false, "none", []],
  },
  "Therapist": {
    dashboard: [true, "own", ["view", "export"]],
    bookings: [true, "assigned", ["view", "edit", "claim"]],
    bookingDetail: [true, "assigned", ["view", "edit", "claim"]],
    calendar: [true, "assigned", ["view", "edit", "claim"]],
    reports: [true, "own", ["view", "export"]],
    clients: [true, "assigned", ["view", "create", "edit", "viewSensitiveFields"]],
    clientDetail: [true, "assigned", ["view", "create", "edit", "viewSensitiveFields"]],
    enquiries: [false, "none", []],
    staff: [true, "same_gender_team", ["view"]],
    staffDetail: [true, "same_gender_team", ["view"]],
    roles: [false, "none", []],
    roleDetail: [false, "none", []],
    services: [false, "none", []],
    availability: [true, "own", ["view", "edit"]],
    emails: [true, "operational", ["view", "edit"]],
    operations: [false, "none", []],
    audit: [false, "none", []],
    privacy: [false, "none", []],
    settings: [false, "none", []],
    profile: [true, "own", ["view", "edit"]],
    accountRequests: [false, "none", []],
  },
  "Inactive": {
    dashboard: [false, "none", []],
    bookings: [false, "none", []],
    bookingDetail: [false, "none", []],
    calendar: [false, "none", []],
    reports: [false, "none", []],
    clients: [false, "none", []],
    clientDetail: [false, "none", []],
    enquiries: [false, "none", []],
    staff: [false, "none", []],
    staffDetail: [false, "none", []],
    roles: [false, "none", []],
    roleDetail: [false, "none", []],
    services: [false, "none", []],
    availability: [false, "none", []],
    emails: [false, "none", []],
    operations: [false, "none", []],
    audit: [false, "none", []],
    privacy: [false, "none", []],
    settings: [false, "none", []],
    profile: [true, "own", ["view", "edit"]],
    accountRequests: [false, "none", []],
  },
};

const MATRIX_ROLES = Object.keys(PAGE_ACCESS_MATRIX);

function activeProfileFor(role: string): StaffProfile {
  return profile(role, grantsFor(role));
}

describe("page-access matrix - 21 pages x 5 roles", () => {
  const cells = MATRIX_ROLES.flatMap((role) =>
    EXPECTED_PAGE_KEYS.map((pageKey) => [role, pageKey] as const)
  );

  it("is exactly 105 cells over all 21 page keys", () => {
    expect(cells.length, "cells").toBe(105);
    expect(MATRIX_ROLES.length, "roles").toBe(5);
    expect(EXPECTED_PAGE_KEYS.length, "pages").toBe(21);
    // Guards the guard: a page key added to the app but not to the matrix would
    // otherwise get no cell for any role.
    for (const role of MATRIX_ROLES) {
      expect(
        Object.keys(PAGE_ACCESS_MATRIX[role]).sort(),
        role + " covers every page key"
      ).toEqual([...EXPECTED_PAGE_KEYS].sort());
    }
    expect(MATRIX_ROLES.sort()).toEqual(Object.keys(ROLE_GRANTS).sort());
  });

  it.each(cells)("%s x %s", (role, pageKey) => {
    const [expectedAccess, expectedScope, expectedActions] =
      PAGE_ACCESS_MATRIX[role][pageKey];
    const result = getAdminPageAccess(activeProfileFor(role), pageKey);

    expect(result.access, role + " x " + pageKey + " access").toBe(expectedAccess);
    expect(result.dataScope, role + " x " + pageKey + " dataScope").toBe(expectedScope);

    const enabled = Object.entries(result.actions)
      .filter(([, value]) => value)
      .map(([flag]) => flag)
      .sort();
    expect(enabled, role + " x " + pageKey + " action flags").toEqual(
      [...expectedActions].sort()
    );
  });

  it.each(MATRIX_ROLES)("%s is denied every one of the 21 pages once deactivated", (role) => {
    // The other half of the matrix. Deactivation is absolute here - unlike the
    // canX() helpers in rbac.ts, which mostly ignore `active` and leave the
    // refusal to requirePermission.
    const deactivated = profile(role, grantsFor(role), { active: false });
    for (const pageKey of EXPECTED_PAGE_KEYS) {
      const result = getAdminPageAccess(deactivated, pageKey);
      expect(result.access, "deactivated " + role + " x " + pageKey).toBe(false);
      expect(result.dataScope, "deactivated " + role + " x " + pageKey + " scope").toBe(
        "none"
      );
      expect(
        Object.values(result.actions).some(Boolean),
        "deactivated " + role + " x " + pageKey + " must have no action flag set"
      ).toBe(false);
    }
    expect(getVisibleAdminPages(deactivated), "deactivated " + role + " nav").toEqual([]);
  });
});

describe("page-access invariants - stated by hand, not derived from the matrix", () => {
  it("the Owner reaches all 21 pages and is the only role that reaches roles/roleDetail", () => {
    expect(getVisibleAdminPages(activeProfileFor("Owner")).length).toBe(21);
    for (const role of MATRIX_ROLES) {
      const expected = role === "Owner";
      expect(canAccessAdminPage(activeProfileFor(role), "roles"), role + " roles").toBe(
        expected
      );
      expect(
        canAccessAdminPage(activeProfileFor(role), "roleDetail"),
        role + " roleDetail"
      ).toBe(expected);
    }
  });

  it("a Booking Coordinator sees clients with sensitive fields hidden", () => {
    // The health-note boundary at the page layer. A coordinator can open the
    // full client list - they book the appointments - but holds neither
    // health-note permission, so the scope narrows and the sensitive-field flag
    // stays off.
    const access = getAdminPageAccess(activeProfileFor("Booking Coordinator"), "clients");
    expect(access.access).toBe(true);
    expect(access.dataScope).toBe("sensitive_hidden");
    expect(access.actions.viewSensitiveFields).toBe(false);
  });

  it("a Therapist sees only assigned clients, but WITH sensitive fields", () => {
    // The mirror of the row above: a narrower scope, a wider field set. They are
    // the person treating the client.
    const access = getAdminPageAccess(activeProfileFor("Therapist"), "clients");
    expect(access.dataScope).toBe("assigned");
    expect(access.actions.viewSensitiveFields).toBe(true);
  });

  it("no role except Owner and Admin reaches audit, privacy, settings or accountRequests", () => {
    for (const pageKey of ["audit", "privacy", "settings", "accountRequests"] as const) {
      expect(canAccessAdminPage(activeProfileFor("Owner"), pageKey), "Owner " + pageKey).toBe(
        true
      );
      expect(canAccessAdminPage(activeProfileFor("Admin"), pageKey), "Admin " + pageKey).toBe(
        true
      );
      expect(
        canAccessAdminPage(activeProfileFor("Booking Coordinator"), pageKey),
        "Coordinator " + pageKey
      ).toBe(false);
      expect(
        canAccessAdminPage(activeProfileFor("Therapist"), pageKey),
        "Therapist " + pageKey
      ).toBe(false);
    }
  });

  it("the booking scope splits Coordinator from Therapist, assign from claim", () => {
    expect(getAdminPageAccess(activeProfileFor("Therapist"), "bookings").dataScope).toBe(
      "assigned"
    );
    expect(
      getAdminPageAccess(activeProfileFor("Booking Coordinator"), "bookings").dataScope
    ).toBe("all");
    expect(
      getAdminPageAccess(activeProfileFor("Booking Coordinator"), "bookings").actions
    ).toMatchObject({ assign: true, claim: false });
    expect(getAdminPageAccess(activeProfileFor("Therapist"), "bookings").actions).toMatchObject(
      { assign: false, claim: true }
    );
  });

  it("the own-profile page is the one page a zero-permission active role still reaches", () => {
    // Recorded, not raised. `profile` is granted unconditionally to any ACTIVE
    // staff member, so somebody on the Inactive role who is still flagged active
    // can edit their own profile and nothing else. They cannot get there in
    // practice - resolveAdminShellVariant returns null for them and
    // admin/layout.tsx redirects to /admin/login?reason=inactive before any page
    // renders - but the matrix says what it says, so it is pinned rather than
    // left to surprise someone later.
    const zeroPermission = profile("Inactive", INACTIVE_ROLE_PERMISSIONS);
    expect(getVisibleAdminPages(zeroPermission)).toEqual(["profile"]);
    expect(getAdminPageAccess(zeroPermission, "profile")).toMatchObject({
      access: true,
      dataScope: "own",
    });
  });
});
