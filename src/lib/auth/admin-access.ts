// SERVER ONLY - do not import this module into client components.
import {
  canAssignBookings,
  canClaimAssignments,
  canCreateSessionNotes,
  canExportOwnReports,
  canExportRevenueReports,
  canManageAllBookings,
  canManageAllClients,
  canManageAssignedBookings,
  canManageEmailSettings,
  canManageEnquiries,
  canManageOperations,
  canManagePermissionOverrides,
  canManageRoleTemplates,
  canManageSensitiveClientNotes,
  canManageStaffProfiles,
  canOpenReports,
  canResendBookingEmails,
  canViewAllBookings,
  canViewAllClients,
  canViewAssignedBookings,
  canViewAssignedClients,
  canViewAssignedHealthNotes,
  canViewBusinessReports,
  canViewEmailLogs,
  canViewOperationalReports,
  canViewOwnReports,
  canViewRevenueReports,
  canViewStaff,
  hasPermission,
  PERMISSIONS,
  type StaffProfile,
} from "./rbac";

export const ADMIN_PAGE_KEYS = [
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
] as const;

export type AdminPageKey = (typeof ADMIN_PAGE_KEYS)[number];

export type AdminDataScope =
  | "all"
  | "assigned"
  | "own"
  | "operational"
  | "team_visible"
  | "same_gender_team"
  | "sensitive_hidden"
  | "none";

export interface AdminActionFlags {
  view: boolean;
  create: boolean;
  edit: boolean;
  assign: boolean;
  claim: boolean;
  export: boolean;
  manageSettings: boolean;
  manageRoles: boolean;
  manageProfiles: boolean;
  approveRequests: boolean;
  viewSensitiveFields: boolean;
}

export interface AdminPageAccess {
  pageKey: AdminPageKey;
  access: boolean;
  dataScope: AdminDataScope;
  actions: AdminActionFlags;
}

type ActiveStaffProfile = StaffProfile & { active: true };
type AdminPageRule = (profile: ActiveStaffProfile) => Omit<AdminPageAccess, "pageKey">;

const NO_ACTIONS: AdminActionFlags = {
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
};

function denied(pageKey: AdminPageKey): AdminPageAccess {
  return {
    pageKey,
    access: false,
    dataScope: "none",
    actions: { ...NO_ACTIONS },
  };
}

function allowed(
  dataScope: AdminDataScope,
  actions: Partial<AdminActionFlags> = {}
): Omit<AdminPageAccess, "pageKey"> {
  return {
    access: true,
    dataScope,
    actions: {
      ...NO_ACTIONS,
      view: true,
      ...actions,
    },
  };
}

function maybeAllowed(
  pageKey: AdminPageKey,
  dataScope: AdminDataScope,
  actions: Partial<AdminActionFlags> = {}
): AdminPageAccess {
  return dataScope === "none"
    ? denied(pageKey)
    : { pageKey, ...allowed(dataScope, actions) };
}

function dashboardScope(profile: ActiveStaffProfile): AdminDataScope {
  if (canViewBusinessReports(profile) || canViewRevenueReports(profile)) {
    return "all";
  }
  if (
    canViewOperationalReports(profile) ||
    canManageAllBookings(profile) ||
    canViewAllBookings(profile)
  ) {
    return "operational";
  }
  if (canViewOwnReports(profile) || canViewAssignedBookings(profile)) {
    return "own";
  }
  return "none";
}

function bookingScope(profile: ActiveStaffProfile): AdminDataScope {
  if (canManageAllBookings(profile) || canViewAllBookings(profile)) {
    return "all";
  }
  if (canManageAssignedBookings(profile) || canViewAssignedBookings(profile)) {
    return "assigned";
  }
  return "none";
}

function reportScope(profile: ActiveStaffProfile): AdminDataScope {
  if (canViewBusinessReports(profile) || canViewRevenueReports(profile)) {
    return "all";
  }
  if (canViewOperationalReports(profile)) {
    return "operational";
  }
  if (canViewOwnReports(profile)) {
    return "own";
  }
  return "none";
}

function clientScope(profile: ActiveStaffProfile): AdminDataScope {
  if (canManageAllClients(profile) || canViewAllClients(profile)) {
    return canManageSensitiveClientNotes(profile) ? "all" : "sensitive_hidden";
  }
  if (canViewAssignedClients(profile)) {
    return "assigned";
  }
  return "none";
}

function staffScope(profile: ActiveStaffProfile): AdminDataScope {
  if (canManageStaffProfiles(profile) || canViewStaff(profile)) {
    return "all";
  }
  return "none";
}

function availabilityScope(profile: ActiveStaffProfile): AdminDataScope {
  if (hasPermission(profile, PERMISSIONS.MANAGE_AVAILABILITY_GLOBAL)) {
    return "all";
  }
  if (hasPermission(profile, PERMISSIONS.MANAGE_AVAILABILITY_OWN)) {
    return "own";
  }
  return "none";
}

function bookingActions(profile: ActiveStaffProfile): Partial<AdminActionFlags> {
  return {
    create: canManageAllBookings(profile),
    edit: canManageAllBookings(profile) || canManageAssignedBookings(profile),
    assign: canManageAllBookings(profile) && canAssignBookings(profile),
    claim: canClaimAssignments(profile),
  };
}

function clientActions(profile: ActiveStaffProfile): Partial<AdminActionFlags> {
  return {
    create: canManageAllClients(profile) || canCreateSessionNotes(profile),
    edit: canManageAllClients(profile) || canCreateSessionNotes(profile),
    viewSensitiveFields:
      canManageSensitiveClientNotes(profile) || canViewAssignedHealthNotes(profile),
  };
}

const ADMIN_PAGE_RULES = {
  dashboard: (profile) =>
    canViewDashboardThroughMatrix(profile)
      ? allowed(dashboardScope(profile), {
          export: canExportOwnReports(profile) || canExportRevenueReports(profile),
          viewSensitiveFields: canViewRevenueReports(profile),
        })
      : allowed("none"),
  bookings: (profile) => allowed(bookingScope(profile), bookingActions(profile)),
  bookingDetail: (profile) => allowed(bookingScope(profile), bookingActions(profile)),
  calendar: (profile) => allowed(bookingScope(profile), bookingActions(profile)),
  reports: (profile) =>
    canOpenReports(profile)
      ? allowed(reportScope(profile), {
          export: canExportOwnReports(profile) || canExportRevenueReports(profile),
          viewSensitiveFields: canViewRevenueReports(profile),
        })
      : allowed("none"),
  clients: (profile) => allowed(clientScope(profile), clientActions(profile)),
  clientDetail: (profile) => allowed(clientScope(profile), clientActions(profile)),
  enquiries: (profile) =>
    canManageEnquiries(profile)
      ? allowed("operational", { create: true, edit: true })
      : allowed("none"),
  staff: (profile) =>
    allowed(staffScope(profile), {
      create: canManageStaffProfiles(profile),
      edit: canManageStaffProfiles(profile),
      manageProfiles: canManageStaffProfiles(profile),
      assign: hasPermission(profile, PERMISSIONS.ASSIGN_STAFF_ROLES),
    }),
  staffDetail: (profile) =>
    allowed(staffScope(profile), {
      create: canManageStaffProfiles(profile),
      edit: canManageStaffProfiles(profile),
      manageProfiles: canManageStaffProfiles(profile),
      assign: hasPermission(profile, PERMISSIONS.ASSIGN_STAFF_ROLES),
    }),
  roles: (profile) =>
    canManageRoleTemplates(profile)
      ? allowed("all", {
          create: true,
          edit: true,
          manageRoles: true,
          viewSensitiveFields: canManagePermissionOverrides(profile),
        })
      : allowed("none"),
  roleDetail: (profile) =>
    canManageRoleTemplates(profile)
      ? allowed("all", {
          create: true,
          edit: true,
          manageRoles: true,
          viewSensitiveFields: canManagePermissionOverrides(profile),
        })
      : allowed("none"),
  services: (profile) =>
    hasPermission(profile, PERMISSIONS.MANAGE_SERVICES)
      ? allowed("all", { create: true, edit: true })
      : allowed("none"),
  availability: (profile) =>
    allowed(availabilityScope(profile), {
      edit:
        hasPermission(profile, PERMISSIONS.MANAGE_AVAILABILITY_GLOBAL) ||
        hasPermission(profile, PERMISSIONS.MANAGE_AVAILABILITY_OWN),
    }),
  emails: (profile) =>
    canViewEmailLogs(profile) || canResendBookingEmails(profile) || canManageEmailSettings(profile)
      ? allowed("operational", {
          edit: canResendBookingEmails(profile) || canManageEmailSettings(profile),
          manageSettings: canManageEmailSettings(profile),
        })
      : allowed("none"),
  operations: (profile) =>
    canManageOperations(profile)
      ? allowed("operational", {
          edit: true,
          manageSettings: canManageOperations(profile),
        })
      : allowed("none"),
  audit: (profile) =>
    hasPermission(profile, PERMISSIONS.MANAGE_AUDIT_LOGS)
      ? allowed("all", { viewSensitiveFields: true })
      : allowed("none"),
  privacy: (profile) =>
    hasPermission(profile, PERMISSIONS.MANAGE_PRIVACY_OPERATIONS)
      ? allowed("all", {
          edit: true,
          approveRequests: true,
          viewSensitiveFields: true,
        })
      : allowed("none"),
  settings: (profile) =>
    hasPermission(profile, PERMISSIONS.MANAGE_SETTINGS)
      ? allowed("all", { edit: true, manageSettings: true })
      : allowed("none"),
  profile: () => allowed("own", { edit: true }),
  accountRequests: (profile) =>
    canManageStaffProfiles(profile)
      ? allowed("all", {
          edit: true,
          manageProfiles: true,
          approveRequests: true,
        })
      : allowed("none"),
} satisfies Record<AdminPageKey, AdminPageRule>;

function canViewDashboardThroughMatrix(profile: ActiveStaffProfile) {
  return dashboardScope(profile) !== "none";
}

export function getAdminPageAccess(
  profile: StaffProfile | null,
  pageKey: AdminPageKey
): AdminPageAccess {
  if (!profile?.active) return denied(pageKey);

  const result = ADMIN_PAGE_RULES[pageKey](profile as ActiveStaffProfile);
  return maybeAllowed(pageKey, result.dataScope, result.actions);
}

export function canAccessAdminPage(profile: StaffProfile | null, pageKey: AdminPageKey) {
  return getAdminPageAccess(profile, pageKey).access;
}

export function getVisibleAdminPages(profile: StaffProfile | null): AdminPageKey[] {
  return ADMIN_PAGE_KEYS.filter((pageKey) => canAccessAdminPage(profile, pageKey));
}
