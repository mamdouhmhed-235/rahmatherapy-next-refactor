import { describe, expect, it } from "vitest";
import { PERMISSIONS, type StaffProfile } from "./rbac";
import {
  ADMIN_PAGE_KEYS,
  canAccessAdminPage,
  getAdminPageAccess,
  getVisibleAdminPages,
  type AdminPageKey,
} from "./admin-access";

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

const OWNER_PERMISSIONS = [
  PERMISSIONS.ASSIGN_BOOKINGS,
  PERMISSIONS.ASSIGN_STAFF_ROLES,
  PERMISSIONS.CLAIM_ASSIGNMENTS,
  PERMISSIONS.CREATE_CLIENT_SESSION_NOTES,
  PERMISSIONS.EXPORT_REPORTS_OWN,
  PERMISSIONS.EXPORT_REPORTS_REVENUE,
  PERMISSIONS.MANAGE_AUDIT_LOGS,
  PERMISSIONS.MANAGE_AVAILABILITY_GLOBAL,
  PERMISSIONS.MANAGE_AVAILABILITY_OWN,
  PERMISSIONS.MANAGE_BOOKINGS_ALL,
  PERMISSIONS.MANAGE_BOOKINGS_ASSIGNED,
  PERMISSIONS.MANAGE_CLIENTS_ALL,
  PERMISSIONS.MANAGE_EMAIL_SETTINGS,
  PERMISSIONS.MANAGE_ENQUIRIES,
  PERMISSIONS.MANAGE_PERMISSION_OVERRIDES,
  PERMISSIONS.MANAGE_PRIVACY_OPERATIONS,
  PERMISSIONS.MANAGE_ROLE_TEMPLATES,
  PERMISSIONS.MANAGE_SENSITIVE_CLIENT_NOTES,
  PERMISSIONS.MANAGE_SERVICES,
  PERMISSIONS.MANAGE_SETTINGS,
  PERMISSIONS.MANAGE_STAFF_PROFILES,
  PERMISSIONS.RESEND_BOOKING_EMAILS,
  PERMISSIONS.VIEW_BOOKINGS_ALL,
  PERMISSIONS.VIEW_BOOKINGS_ASSIGNED,
  PERMISSIONS.VIEW_CLIENT_CONTACT_DETAILS,
  PERMISSIONS.VIEW_CLIENT_HEALTH_NOTES_ASSIGNED,
  PERMISSIONS.VIEW_CLIENTS_ALL,
  PERMISSIONS.VIEW_CLIENTS_ASSIGNED,
  PERMISSIONS.VIEW_DASHBOARD,
  PERMISSIONS.VIEW_EMAIL_LOGS,
  PERMISSIONS.VIEW_REPORTS_BUSINESS,
  PERMISSIONS.VIEW_REPORTS_OPERATIONAL,
  PERMISSIONS.VIEW_REPORTS_OWN,
  PERMISSIONS.VIEW_REPORTS_REVENUE,
  PERMISSIONS.VIEW_STAFF,
];

const ADMIN_PERMISSIONS = [
  PERMISSIONS.ASSIGN_BOOKINGS,
  PERMISSIONS.ASSIGN_STAFF_ROLES,
  PERMISSIONS.CLAIM_ASSIGNMENTS,
  PERMISSIONS.EXPORT_REPORTS_REVENUE,
  PERMISSIONS.MANAGE_AUDIT_LOGS,
  PERMISSIONS.MANAGE_AVAILABILITY_GLOBAL,
  PERMISSIONS.MANAGE_AVAILABILITY_OWN,
  PERMISSIONS.MANAGE_BOOKINGS_ALL,
  PERMISSIONS.MANAGE_BOOKINGS_ASSIGNED,
  PERMISSIONS.MANAGE_CLIENTS_ALL,
  PERMISSIONS.MANAGE_EMAIL_SETTINGS,
  PERMISSIONS.MANAGE_ENQUIRIES,
  PERMISSIONS.MANAGE_PRIVACY_OPERATIONS,
  PERMISSIONS.MANAGE_SENSITIVE_CLIENT_NOTES,
  PERMISSIONS.MANAGE_SERVICES,
  PERMISSIONS.MANAGE_SETTINGS,
  PERMISSIONS.MANAGE_STAFF_PROFILES,
  PERMISSIONS.RESEND_BOOKING_EMAILS,
  PERMISSIONS.VIEW_BOOKINGS_ALL,
  PERMISSIONS.VIEW_BOOKINGS_ASSIGNED,
  PERMISSIONS.VIEW_CLIENT_CONTACT_DETAILS,
  PERMISSIONS.VIEW_CLIENTS_ALL,
  PERMISSIONS.VIEW_DASHBOARD,
  PERMISSIONS.VIEW_EMAIL_LOGS,
  PERMISSIONS.VIEW_REPORTS_BUSINESS,
  PERMISSIONS.VIEW_REPORTS_OPERATIONAL,
  PERMISSIONS.VIEW_REPORTS_REVENUE,
  PERMISSIONS.VIEW_STAFF,
];

const BOOKING_COORDINATOR_PERMISSIONS = [
  PERMISSIONS.ASSIGN_BOOKINGS,
  PERMISSIONS.MANAGE_BOOKINGS_ALL,
  PERMISSIONS.MANAGE_CLIENTS_ALL,
  PERMISSIONS.MANAGE_ENQUIRIES,
  PERMISSIONS.RESEND_BOOKING_EMAILS,
  PERMISSIONS.VIEW_BOOKINGS_ALL,
  PERMISSIONS.VIEW_CLIENT_CONTACT_DETAILS,
  PERMISSIONS.VIEW_CLIENTS_ALL,
  PERMISSIONS.VIEW_DASHBOARD,
  PERMISSIONS.VIEW_EMAIL_LOGS,
  PERMISSIONS.VIEW_REPORTS_OPERATIONAL,
];

const THERAPIST_PERMISSIONS = [
  PERMISSIONS.CLAIM_ASSIGNMENTS,
  PERMISSIONS.CREATE_CLIENT_SESSION_NOTES,
  PERMISSIONS.EXPORT_REPORTS_OWN,
  PERMISSIONS.MANAGE_AVAILABILITY_OWN,
  PERMISSIONS.MANAGE_BOOKINGS_ASSIGNED,
  PERMISSIONS.VIEW_BOOKINGS_ASSIGNED,
  PERMISSIONS.VIEW_CLIENT_CONTACT_DETAILS,
  PERMISSIONS.VIEW_CLIENT_HEALTH_NOTES_ASSIGNED,
  PERMISSIONS.VIEW_CLIENTS_ASSIGNED,
  PERMISSIONS.VIEW_DASHBOARD,
  PERMISSIONS.VIEW_REPORTS_OWN,
];

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
    expect(canAccessAdminPage(therapist, "staff")).toBe(false);
    expect(canAccessAdminPage(therapist, "audit")).toBe(false);
    expect(canAccessAdminPage(therapist, "privacy")).toBe(false);
  });
});
