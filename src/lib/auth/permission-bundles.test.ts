// ⛔ GATE 07 CASE 1 — THE BUNDLE BOUNDARY MATRIX.
//
// The system holds client health notes, and the ONLY thing protecting them is
// this TypeScript permission layer: `authenticated` has no SELECT grant on
// public.client_notes (so the RLS policies written for it are unreachable), and
// every read in the admin app goes through the service-role client, which
// bypasses RLS by design. There is no database backstop. This file is a test of
// the layer that is actually load-bearing.
//
// It asserts three INDEPENDENT things, in order of what each can catch:
//
//   Layer A — the role model. 5 roles × 8 capability bundles = 40 cells, each
//             stating the exact set of that bundle's permissions the role holds.
//             Hand-written here, checked against src/lib/auth/role-grants.json,
//             which scripts/verify-rbac-grants.mjs checks against the live
//             database (gate 07 case 2). Three-way, so no copy can drift alone.
//
//   Layer B — predicate wiring. Each canX() helper declares the permissions it
//             depends on, and is probed with a profile holding EXACTLY those
//             (must be true) and a profile holding all 40 EXCEPT those (must be
//             false). ⛔ This is the layer that catches a helper rewired to the
//             wrong permission — Layer A cannot, because permissions with an
//             identical role distribution are indistinguishable by role alone.
//             view_clients_assigned and view_client_health_notes_assigned are
//             exactly such a pair, and one of them guards health notes.
//
//   Layer C — the composition: what each real role can actually do. This is
//             DERIVED from Layers A and B and is therefore not an independent
//             control; it exists so the matrix is readable as evidence. The
//             facts a human actually relies on are re-stated by hand as anchors
//             below, and those ARE independent.
//
// ⚠️ Scope note, deliberate: most canX() helpers do NOT check `profile.active`.
// Deactivation is enforced by requirePermission (throws INACTIVE) and by
// getAdminPageAccess, not here. The three helpers that DO check it are pinned
// explicitly at the end, so the boundary is recorded rather than assumed.

import { describe, expect, it } from "vitest";
import {
  canAssignBookings,
  canAssignStaffRoles,
  canClaimAssignments,
  canCreateSessionNotes,
  canExportOwnReports,
  canExportRevenueReports,
  canManageAllBookings,
  canManageAllClients,
  canManageAssignedBookings,
  canManageBookings,
  canManageClientDestructiveOps,
  canManageClientIdentityFields,
  canManageEmailSettings,
  canManageEmailTemplates,
  canManageEnquiries,
  canManageOperations,
  canManagePermissionOverrides,
  canManageRoleTemplates,
  canManageSensitiveClientNotes,
  canManageStaffProfiles,
  canManageTravelOrigin,
  canOpenReports,
  canResendBookingEmails,
  canViewAllBookings,
  canViewAllClients,
  canViewAssignedBookings,
  canViewAssignedClients,
  canViewAssignedHealthNotes,
  canViewBusinessReports,
  canViewClientContactDetails,
  canViewEmailLogs,
  canViewOperationalReports,
  canViewOwnReports,
  canViewRevenueReports,
  canViewStaff,
  hasUniversalReportScope,
  PERMISSIONS,
  type StaffProfile,
} from "./rbac";
import roleGrantsFixture from "./role-grants.json";

// ─── the measured role model ─────────────────────────────────────────────────

type RoleName = "Owner" | "Admin" | "Booking Coordinator" | "Therapist" | "Inactive";

const FIXTURE = roleGrantsFixture as {
  expectedRoleCount: number;
  expectedPermissionCount: number;
  expectedGrantCount: number;
  roles: Record<string, { note: string; grants: string[] }>;
};

const ROLES: readonly RoleName[] = [
  "Owner",
  "Admin",
  "Booking Coordinator",
  "Therapist",
  "Inactive",
];

function grantsFor(role: RoleName): string[] {
  const entry = FIXTURE.roles[role];
  if (!entry) throw new Error(`role "${role}" missing from role-grants.json`);
  return entry.grants;
}

function profileFor(
  role: RoleName,
  overrides: Partial<StaffProfile> = {}
): StaffProfile {
  return {
    id: `staff-${role}`,
    auth_user_id: `auth-${role}`,
    name: role,
    email: `${role}@example.test`,
    role_id: `role-${role}`,
    role_name: role,
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set(grantsFor(role)),
    ...overrides,
  };
}

function profileWith(permissions: readonly string[]): StaffProfile {
  return {
    id: "staff-probe",
    auth_user_id: "auth-probe",
    name: "Probe",
    email: "probe@example.test",
    role_id: "role-probe",
    role_name: "Probe",
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set(permissions),
  };
}

const ALL_PERMISSIONS: readonly string[] = Object.values(PERMISSIONS);

// ─── the 8 capability bundles ────────────────────────────────────────────────
//
// Every one of the 40 permissions belongs to exactly one bundle. That partition
// is asserted below, and it is what makes "40 cells" mean COMPLETE coverage of
// the model rather than 40 arbitrary spot-checks.

const BUNDLES = {
  "B-1 Booking read": [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_BOOKINGS_ALL,
    PERMISSIONS.VIEW_BOOKINGS_ASSIGNED,
  ],
  "B-2 Booking mutation": [
    PERMISSIONS.MANAGE_BOOKINGS_ALL,
    PERMISSIONS.MANAGE_BOOKINGS_ASSIGNED,
    PERMISSIONS.ASSIGN_BOOKINGS,
    PERMISSIONS.CLAIM_ASSIGNMENTS,
  ],
  "B-3 Client read and contact details": [
    PERMISSIONS.VIEW_CLIENTS_ALL,
    PERMISSIONS.VIEW_CLIENTS_ASSIGNED,
    PERMISSIONS.VIEW_CLIENT_CONTACT_DETAILS,
    PERMISSIONS.VIEW_CLIENT_HEALTH_NOTES_ASSIGNED,
  ],
  "B-4 Client mutation": [
    PERMISSIONS.MANAGE_CLIENTS_ALL,
    PERMISSIONS.MANAGE_CLIENT_IDENTITY_FIELDS,
    PERMISSIONS.MANAGE_CLIENT_DESTRUCTIVE_OPS,
    PERMISSIONS.CREATE_CLIENT_SESSION_NOTES,
    PERMISSIONS.MANAGE_SENSITIVE_CLIENT_NOTES,
  ],
  "B-5 Staff and RBAC admin": [
    PERMISSIONS.VIEW_STAFF,
    PERMISSIONS.MANAGE_STAFF_PROFILES,
    PERMISSIONS.ASSIGN_STAFF_ROLES,
    PERMISSIONS.MANAGE_PERMISSION_OVERRIDES,
    PERMISSIONS.MANAGE_ROLE_TEMPLATES,
  ],
  "B-6 Reporting and export": [
    PERMISSIONS.VIEW_REPORTS_OWN,
    PERMISSIONS.EXPORT_REPORTS_OWN,
    PERMISSIONS.VIEW_REPORTS_OPERATIONAL,
    PERMISSIONS.VIEW_REPORTS_REVENUE,
    PERMISSIONS.EXPORT_REPORTS_REVENUE,
    PERMISSIONS.VIEW_REPORTS_BUSINESS,
  ],
  "B-7 Comms": [
    PERMISSIONS.VIEW_EMAIL_LOGS,
    PERMISSIONS.RESEND_BOOKING_EMAILS,
    PERMISSIONS.MANAGE_EMAIL_SETTINGS,
    PERMISSIONS.MANAGE_EMAIL_TEMPLATES,
    PERMISSIONS.MANAGE_ENQUIRIES,
  ],
  "B-8 Config and privileged ops": [
    PERMISSIONS.MANAGE_SERVICES,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.MANAGE_TRAVEL_ORIGIN,
    PERMISSIONS.MANAGE_AVAILABILITY_GLOBAL,
    PERMISSIONS.MANAGE_AVAILABILITY_OWN,
    PERMISSIONS.MANAGE_AUDIT_LOGS,
    PERMISSIONS.MANAGE_PRIVACY_OPERATIONS,
    PERMISSIONS.MANAGE_ACCOUNT_PASSWORD_REQUESTS,
  ],
} as const;

type BundleName = keyof typeof BUNDLES;

const BUNDLE_NAMES = Object.keys(BUNDLES) as BundleName[];

// ─── Layer A — the 40 cells ──────────────────────────────────────────────────
//
// ⛔ Written by hand from the live measurement, NOT computed from the fixture.
// If these were derived the assertion would be a tautology. The whole value is
// that this is a second, independent statement of the same fact.
//
// Read a row as: "of this bundle's permissions, this role holds exactly these."

const EXPECTED_CELLS: Record<RoleName, Record<BundleName, string[]>> = {
  // Every permission in the system.
  Owner: {
    "B-1 Booking read": ["view_dashboard", "view_bookings_all", "view_bookings_assigned"],
    "B-2 Booking mutation": [
      "manage_bookings_all",
      "manage_bookings_assigned",
      "assign_bookings",
      "claim_assignments",
    ],
    "B-3 Client read and contact details": [
      "view_clients_all",
      "view_clients_assigned",
      "view_client_contact_details",
      "view_client_health_notes_assigned",
    ],
    "B-4 Client mutation": [
      "manage_clients_all",
      "manage_client_identity_fields",
      "manage_client_destructive_ops",
      "create_client_session_notes",
      "manage_sensitive_client_notes",
    ],
    "B-5 Staff and RBAC admin": [
      "view_staff",
      "manage_staff_profiles",
      "assign_staff_roles",
      "manage_permission_overrides",
      "manage_role_templates",
    ],
    "B-6 Reporting and export": [
      "view_reports_own",
      "export_reports_own",
      "view_reports_operational",
      "view_reports_revenue",
      "export_reports_revenue",
      "view_reports_business",
    ],
    "B-7 Comms": [
      "view_email_logs",
      "resend_booking_emails",
      "manage_email_settings",
      "manage_email_templates",
      "manage_enquiries",
    ],
    "B-8 Config and privileged ops": [
      "manage_services",
      "manage_settings",
      "manage_travel_origin",
      "manage_availability_global",
      "manage_availability_own",
      "manage_audit_logs",
      "manage_privacy_operations",
      "manage_account_requests",
    ],
  },

  // Owner minus 8. ⛔ The two absences that matter downstream: no
  // manage_travel_origin (Owner-exclusive, gate 07 case 16) and no
  // view_client_health_notes_assigned — an Admin manages the practice, they do
  // not read a client's health notes through the assigned-therapist route.
  Admin: {
    "B-1 Booking read": ["view_dashboard", "view_bookings_all", "view_bookings_assigned"],
    "B-2 Booking mutation": [
      "manage_bookings_all",
      "manage_bookings_assigned",
      "assign_bookings",
      "claim_assignments",
    ],
    "B-3 Client read and contact details": ["view_clients_all", "view_client_contact_details"],
    "B-4 Client mutation": [
      "manage_clients_all",
      "manage_client_identity_fields",
      "manage_client_destructive_ops",
      "manage_sensitive_client_notes",
    ],
    "B-5 Staff and RBAC admin": ["view_staff", "manage_staff_profiles", "assign_staff_roles"],
    "B-6 Reporting and export": [
      "view_reports_operational",
      "view_reports_revenue",
      "export_reports_revenue",
      "view_reports_business",
    ],
    "B-7 Comms": [
      "view_email_logs",
      "resend_booking_emails",
      "manage_email_settings",
      "manage_email_templates",
      "manage_enquiries",
    ],
    "B-8 Config and privileged ops": [
      "manage_services",
      "manage_settings",
      "manage_availability_global",
      "manage_availability_own",
      "manage_audit_logs",
      "manage_privacy_operations",
      "manage_account_requests",
    ],
  },

  // ⛔ Front desk. Holds assign_bookings but NOT claim_assignments — they hand
  // work out, they do not take it. Holds NEITHER health-note permission, which
  // is what makes the booking-detail redaction observable at all.
  "Booking Coordinator": {
    "B-1 Booking read": ["view_dashboard", "view_bookings_all"],
    "B-2 Booking mutation": ["manage_bookings_all", "assign_bookings"],
    "B-3 Client read and contact details": ["view_clients_all", "view_client_contact_details"],
    "B-4 Client mutation": ["manage_clients_all"],
    "B-5 Staff and RBAC admin": [],
    "B-6 Reporting and export": ["view_reports_operational"],
    "B-7 Comms": ["view_email_logs", "resend_booking_emails", "manage_enquiries"],
    "B-8 Config and privileged ops": [],
  },

  // Practising therapist: everything scoped to their OWN assignments. Holds
  // view_client_health_notes_assigned because they are the person treating the
  // client, and claim_assignments but NOT assign_bookings — the mirror image of
  // the Coordinator.
  Therapist: {
    "B-1 Booking read": ["view_dashboard", "view_bookings_assigned"],
    "B-2 Booking mutation": ["manage_bookings_assigned", "claim_assignments"],
    "B-3 Client read and contact details": [
      "view_clients_assigned",
      "view_client_contact_details",
      "view_client_health_notes_assigned",
    ],
    "B-4 Client mutation": ["create_client_session_notes"],
    "B-5 Staff and RBAC admin": [],
    "B-6 Reporting and export": ["view_reports_own", "export_reports_own"],
    // ⚠️ Gate 07's PLAN.md says the Therapist holds "none in base bundle" here.
    // That is wrong: the live grants include resend_booking_emails, so a
    // therapist can re-send the confirmation for a booking. Measured, not
    // assumed — see role-grants.json and scripts/verify-rbac-grants.mjs.
    "B-7 Comms": ["resend_booking_emails"],
    "B-8 Config and privileged ops": ["manage_availability_own"],
  },

  // ⛔ The zero IS the assertion. This role exists so a deactivated staff member
  // keeps a valid role_id rather than a dangling reference.
  Inactive: {
    "B-1 Booking read": [],
    "B-2 Booking mutation": [],
    "B-3 Client read and contact details": [],
    "B-4 Client mutation": [],
    "B-5 Staff and RBAC admin": [],
    "B-6 Reporting and export": [],
    "B-7 Comms": [],
    "B-8 Config and privileged ops": [],
  },
};

// ─── Layer B — what each helper is wired to ──────────────────────────────────
//
// Hand-written spec: the permissions each helper answers `true` for, on their
// own. Probed against an isolate profile and a complement profile, so a helper
// pointed at the wrong constant fails here even when the two constants have an
// identical role distribution.

const PREDICATE_SPEC: ReadonlyArray<
  readonly [string, (p: StaffProfile | null) => boolean, readonly string[]]
> = [
  ["canViewAllBookings", canViewAllBookings, [PERMISSIONS.VIEW_BOOKINGS_ALL]],
  [
    "canViewAssignedBookings",
    canViewAssignedBookings,
    [PERMISSIONS.VIEW_BOOKINGS_ASSIGNED, PERMISSIONS.MANAGE_BOOKINGS_ASSIGNED],
  ],
  ["canManageAllBookings", canManageAllBookings, [PERMISSIONS.MANAGE_BOOKINGS_ALL]],
  ["canManageAssignedBookings", canManageAssignedBookings, [PERMISSIONS.MANAGE_BOOKINGS_ASSIGNED]],
  [
    "canManageBookings",
    canManageBookings,
    [PERMISSIONS.MANAGE_BOOKINGS_ALL, PERMISSIONS.MANAGE_BOOKINGS_ASSIGNED],
  ],
  ["canAssignBookings", canAssignBookings, [PERMISSIONS.ASSIGN_BOOKINGS]],
  ["canClaimAssignments", canClaimAssignments, [PERMISSIONS.CLAIM_ASSIGNMENTS]],
  ["canViewOwnReports", canViewOwnReports, [PERMISSIONS.VIEW_REPORTS_OWN]],
  ["canExportOwnReports", canExportOwnReports, [PERMISSIONS.EXPORT_REPORTS_OWN]],
  ["canViewOperationalReports", canViewOperationalReports, [PERMISSIONS.VIEW_REPORTS_OPERATIONAL]],
  ["canViewBusinessReports", canViewBusinessReports, [PERMISSIONS.VIEW_REPORTS_BUSINESS]],
  ["canViewRevenueReports", canViewRevenueReports, [PERMISSIONS.VIEW_REPORTS_REVENUE]],
  ["canExportRevenueReports", canExportRevenueReports, [PERMISSIONS.EXPORT_REPORTS_REVENUE]],
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
  ["canViewAllClients", canViewAllClients, [PERMISSIONS.VIEW_CLIENTS_ALL]],
  ["canViewAssignedClients", canViewAssignedClients, [PERMISSIONS.VIEW_CLIENTS_ASSIGNED]],
  [
    "canViewClientContactDetails",
    canViewClientContactDetails,
    [PERMISSIONS.VIEW_CLIENT_CONTACT_DETAILS],
  ],
  // ⛔ The health-note gate. Its constant is asserted here precisely because
  // VIEW_CLIENTS_ASSIGNED has an identical role distribution and would sail
  // through any role-level test.
  [
    "canViewAssignedHealthNotes",
    canViewAssignedHealthNotes,
    [PERMISSIONS.VIEW_CLIENT_HEALTH_NOTES_ASSIGNED],
  ],
  ["canCreateSessionNotes", canCreateSessionNotes, [PERMISSIONS.CREATE_CLIENT_SESSION_NOTES]],
  ["canManageAllClients", canManageAllClients, [PERMISSIONS.MANAGE_CLIENTS_ALL]],
  [
    "canManageSensitiveClientNotes",
    canManageSensitiveClientNotes,
    [PERMISSIONS.MANAGE_SENSITIVE_CLIENT_NOTES, PERMISSIONS.MANAGE_PRIVACY_OPERATIONS],
  ],
  [
    "canManageClientIdentityFields",
    canManageClientIdentityFields,
    [PERMISSIONS.MANAGE_CLIENT_IDENTITY_FIELDS],
  ],
  [
    "canManageClientDestructiveOps",
    canManageClientDestructiveOps,
    [PERMISSIONS.MANAGE_CLIENT_DESTRUCTIVE_OPS],
  ],
  ["canViewStaff", canViewStaff, [PERMISSIONS.VIEW_STAFF]],
  ["canManageStaffProfiles", canManageStaffProfiles, [PERMISSIONS.MANAGE_STAFF_PROFILES]],
  ["canAssignStaffRoles", canAssignStaffRoles, [PERMISSIONS.ASSIGN_STAFF_ROLES]],
  [
    "canManagePermissionOverrides",
    canManagePermissionOverrides,
    [PERMISSIONS.MANAGE_PERMISSION_OVERRIDES],
  ],
  ["canManageRoleTemplates", canManageRoleTemplates, [PERMISSIONS.MANAGE_ROLE_TEMPLATES]],
  ["canManageTravelOrigin", canManageTravelOrigin, [PERMISSIONS.MANAGE_TRAVEL_ORIGIN]],
  ["canViewEmailLogs", canViewEmailLogs, [PERMISSIONS.VIEW_EMAIL_LOGS]],
  ["canResendBookingEmails", canResendBookingEmails, [PERMISSIONS.RESEND_BOOKING_EMAILS]],
  ["canManageEmailSettings", canManageEmailSettings, [PERMISSIONS.MANAGE_EMAIL_SETTINGS]],
  ["canManageEmailTemplates", canManageEmailTemplates, [PERMISSIONS.MANAGE_EMAIL_TEMPLATES]],
  ["canManageEnquiries", canManageEnquiries, [PERMISSIONS.MANAGE_ENQUIRIES]],
  [
    "canManageOperations",
    canManageOperations,
    [PERMISSIONS.MANAGE_SETTINGS, PERMISSIONS.MANAGE_EMAIL_SETTINGS],
  ],
];

// ═════════════════════════════════════════════════════════════════════════════

describe("the 8 capability bundles partition all 40 permissions", () => {
  it("covers every permission exactly once", () => {
    const seen = new Map<string, BundleName>();
    for (const bundle of BUNDLE_NAMES) {
      for (const permission of BUNDLES[bundle]) {
        const already = seen.get(permission);
        expect(already, `"${permission}" is in both ${already} and ${bundle}`).toBeUndefined();
        seen.set(permission, bundle);
      }
    }

    const missing = ALL_PERMISSIONS.filter((p) => !seen.has(p));
    expect(missing, "permissions in PERMISSIONS but in no bundle").toEqual([]);

    const unknown = [...seen.keys()].filter((p) => !ALL_PERMISSIONS.includes(p));
    expect(unknown, "permissions in a bundle but not in PERMISSIONS").toEqual([]);
  });

  it("is 8 bundles over 40 permissions", () => {
    // ⛔ Guards the guard: without the counts, deleting a bundle AND its
    // permissions from PERMISSIONS would leave the partition test green.
    expect(BUNDLE_NAMES.length, "bundles").toBe(8);
    expect(ALL_PERMISSIONS.length, "permissions in PERMISSIONS").toBe(40);
    expect(new Set(ALL_PERMISSIONS).size, "permission values are unique").toBe(40);
  });
});

describe("the role-grants fixture is the shape the database was measured to be", () => {
  it("declares 5 roles, 40 permissions and 95 grants", () => {
    expect(FIXTURE.expectedRoleCount).toBe(5);
    expect(FIXTURE.expectedPermissionCount).toBe(40);
    expect(FIXTURE.expectedGrantCount).toBe(95);
    expect(Object.keys(FIXTURE.roles).sort()).toEqual([...ROLES].sort());

    const total = ROLES.reduce((n, role) => n + grantsFor(role).length, 0);
    expect(total, "grants summed across roles").toBe(FIXTURE.expectedGrantCount);
  });

  it("grants only permissions that actually exist in PERMISSIONS", () => {
    for (const role of ROLES) {
      const unknown = grantsFor(role).filter((p) => !ALL_PERMISSIONS.includes(p));
      expect(unknown, `${role} is granted permissions that do not exist`).toEqual([]);
      expect(new Set(grantsFor(role)).size, `${role} has a duplicate grant`).toBe(
        grantsFor(role).length
      );
    }
  });
});

// ─── Layer A — 5 roles × 8 bundles = 40 cells ────────────────────────────────

describe("Layer A — bundle boundary matrix (40 cells)", () => {
  const cells = ROLES.flatMap((role) =>
    BUNDLE_NAMES.map((bundle) => [role, bundle] as const)
  );

  it("is exactly 40 cells", () => {
    expect(cells.length).toBe(40);
  });

  it.each(cells)("%s × %s holds exactly the expected permissions", (role, bundle) => {
    const held = grantsFor(role).filter((p) =>
      (BUNDLES[bundle] as readonly string[]).includes(p)
    );
    const expected = EXPECTED_CELLS[role][bundle];

    expect([...held].sort(), `${role} × ${bundle}`).toEqual([...expected].sort());

    // The boundary half: every bundle permission NOT expected must be absent.
    const shouldNotHold = (BUNDLES[bundle] as readonly string[]).filter(
      (p) => !expected.includes(p)
    );
    for (const permission of shouldNotHold) {
      expect(
        grantsFor(role).includes(permission),
        `${role} must NOT hold ${permission}`
      ).toBe(false);
    }
  });
});

// ─── Layer B — predicate wiring ──────────────────────────────────────────────

describe("Layer B — every permission helper is wired to the permission it names", () => {
  it.each(PREDICATE_SPEC)(
    "%s is true for exactly its own permissions",
    (name, helper, members) => {
      // Isolate: a profile holding ONLY this helper's permissions.
      expect(helper(profileWith(members)), `${name} on its own permissions`).toBe(true);

      // Each member on its own — an OR-helper must not silently lose a member.
      for (const permission of members) {
        expect(helper(profileWith([permission])), `${name} via ${permission} alone`).toBe(
          true
        );
      }

      // ⛔ Complement: every OTHER permission in the system, all 40 minus these.
      // This is the assertion that catches a helper rewired to a neighbouring
      // constant, which no role-level test can see.
      const complement = ALL_PERMISSIONS.filter((p) => !members.includes(p));
      expect(
        helper(profileWith(complement)),
        `${name} must be false while holding all ${complement.length} other permissions`
      ).toBe(false);

      expect(helper(profileWith([])), `${name} with no permissions`).toBe(false);
      expect(helper(null), `${name} with a null profile`).toBe(false);
    }
  );

  it("covers every helper exported for permission checking", () => {
    // ⛔ Guards the guard. A new canX() helper that nobody adds here is an
    // unwired permission check with no test — the exact gap this file exists
    // to close. Bump this deliberately, in the same commit as the new helper.
    expect(PREDICATE_SPEC.length, "helpers specified").toBe(36);
    expect(new Set(PREDICATE_SPEC.map(([n]) => n)).size, "helper names unique").toBe(36);
  });
});

// ─── Layer C — the composition, plus hand-written anchors ────────────────────

describe("Layer C — what each role can actually do", () => {
  // Derived from Layers A and B. Kept because it is the readable evidence
  // matrix, and because it fails loudly if a helper stops composing the way
  // its spec says — but it is NOT an independent control. The anchors are.
  it.each(ROLES)("%s composes its helpers consistently with its grants", (role) => {
    const profile = profileFor(role);
    const granted = new Set(grantsFor(role));

    for (const [name, helper, members] of PREDICATE_SPEC) {
      const expected = members.some((p) => granted.has(p));
      expect(helper(profile), `${role} → ${name}`).toBe(expected);
    }
  });

  // ⛔ Hand-written. These are the facts the rest of the system relies on, and
  // each is stated here independently of the fixture so that a wrong fixture
  // and a wrong expectation cannot agree with each other.
  it("Owner is the only role that can manage travel origin, role templates and permission overrides", () => {
    for (const role of ROLES) {
      const isOwner = role === "Owner";
      const profile = profileFor(role);
      expect(canManageTravelOrigin(profile), `${role} travel origin`).toBe(isOwner);
      expect(canManageRoleTemplates(profile), `${role} role templates`).toBe(isOwner);
      expect(canManagePermissionOverrides(profile), `${role} permission overrides`).toBe(
        isOwner
      );
    }
  });

  it("only Owner and Therapist can read a client's health notes", () => {
    // ⛔ The most consequential row in this file. An Admin and a Booking
    // Coordinator run the practice; neither is the person treating the client,
    // and neither holds view_client_health_notes_assigned.
    expect(canViewAssignedHealthNotes(profileFor("Owner"))).toBe(true);
    expect(canViewAssignedHealthNotes(profileFor("Therapist"))).toBe(true);
    expect(canViewAssignedHealthNotes(profileFor("Admin"))).toBe(false);
    expect(canViewAssignedHealthNotes(profileFor("Booking Coordinator"))).toBe(false);
    expect(canViewAssignedHealthNotes(profileFor("Inactive"))).toBe(false);
  });

  it("the Booking Coordinator holds neither health-note permission", () => {
    // This is what makes the booking-detail redaction observable at all — see
    // src/app/admin/bookings/[bookingId]/__tests__/booking-detail-data.test.ts.
    const coordinator = profileFor("Booking Coordinator");
    expect(coordinator.permissions.has(PERMISSIONS.VIEW_CLIENT_HEALTH_NOTES_ASSIGNED)).toBe(
      false
    );
    expect(coordinator.permissions.has(PERMISSIONS.MANAGE_SENSITIVE_CLIENT_NOTES)).toBe(false);
    expect(canManageSensitiveClientNotes(coordinator)).toBe(false);
  });

  it("assigning and claiming are mirror images: Coordinator assigns, Therapist claims", () => {
    const coordinator = profileFor("Booking Coordinator");
    const therapist = profileFor("Therapist");

    expect(canAssignBookings(coordinator), "coordinator assigns").toBe(true);
    expect(canClaimAssignments(coordinator), "coordinator must not claim").toBe(false);

    expect(canClaimAssignments(therapist), "therapist claims").toBe(true);
    expect(canAssignBookings(therapist), "therapist must not assign").toBe(false);
  });

  it("the Inactive role is denied by every single helper", () => {
    // ⛔ The zero-grant role. If this ever passes anything, a deactivated staff
    // member has capabilities.
    const inactive = profileFor("Inactive");
    expect(grantsFor("Inactive"), "Inactive grants").toEqual([]);
    for (const [name, helper] of PREDICATE_SPEC) {
      expect(helper(inactive), `Inactive → ${name}`).toBe(false);
    }
  });

  it("only the Owner holds all 40 permissions", () => {
    for (const role of ROLES) {
      const held = grantsFor(role).length;
      if (role === "Owner") expect(held, "Owner").toBe(40);
      else expect(held, `${role} must not hold all 40`).toBeLessThan(40);
    }
  });
});

// ─── the `active` boundary, recorded rather than assumed ─────────────────────

describe("which helpers check profile.active, and which deliberately do not", () => {
  // ⚠️ Only three helpers consult `active`. That is not a defect: deactivation
  // is enforced by requirePermission (throws INACTIVE before any capability
  // question is asked) and by getAdminPageAccess, which denies every page to an
  // inactive profile. This test records the split so nobody has to infer it, and
  // so a change to it is visible in a diff.
  const ACTIVE_AWARE: ReadonlyArray<
    readonly [string, (p: StaffProfile | null) => boolean, string]
  > = [
    ["canClaimAssignments", canClaimAssignments, PERMISSIONS.CLAIM_ASSIGNMENTS],
    [
      "canManageClientIdentityFields",
      canManageClientIdentityFields,
      PERMISSIONS.MANAGE_CLIENT_IDENTITY_FIELDS,
    ],
    [
      "canManageClientDestructiveOps",
      canManageClientDestructiveOps,
      PERMISSIONS.MANAGE_CLIENT_DESTRUCTIVE_OPS,
    ],
  ];

  it.each(ACTIVE_AWARE)("%s refuses a deactivated profile that still holds the permission", (
    name,
    helper,
    permission
  ) => {
    expect(helper(profileWith([permission])), `${name} while active`).toBe(true);
    expect(
      helper({ ...profileWith([permission]), active: false }),
      `${name} while deactivated`
    ).toBe(false);
  });

  it("canClaimAssignments also requires can_take_bookings", () => {
    const base = profileWith([PERMISSIONS.CLAIM_ASSIGNMENTS]);
    expect(canClaimAssignments(base)).toBe(true);
    expect(canClaimAssignments({ ...base, can_take_bookings: false })).toBe(false);
  });

  it("the other helpers ignore active — deactivation is enforced elsewhere", () => {
    const activeAwareNames = new Set(ACTIVE_AWARE.map(([n]) => n));
    const ignoring = PREDICATE_SPEC.filter(([name]) => !activeAwareNames.has(name));

    expect(ignoring.length, "helpers that ignore active").toBe(33);

    for (const [name, helper, members] of ignoring) {
      const deactivated = { ...profileWith(members), active: false };
      expect(
        helper(deactivated),
        `${name} ignores active by design; requirePermission is the gate`
      ).toBe(true);
    }
  });
});
