// SERVER ONLY — never import this in client components or expose to the browser.
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Permission name constants ────────────────────────────────────────────────

export const PERMISSIONS = {
  VIEW_DASHBOARD: "view_dashboard",
  VIEW_BOOKINGS_ALL: "view_bookings_all",
  VIEW_BOOKINGS_ASSIGNED: "view_bookings_assigned",
  MANAGE_BOOKINGS_ALL: "manage_bookings_all",
  MANAGE_BOOKINGS_ASSIGNED: "manage_bookings_assigned",
  ASSIGN_BOOKINGS: "assign_bookings",
  CLAIM_ASSIGNMENTS: "claim_assignments",
  VIEW_REPORTS_OWN: "view_reports_own",
  EXPORT_REPORTS_OWN: "export_reports_own",
  VIEW_REPORTS_OPERATIONAL: "view_reports_operational",
  VIEW_REPORTS_REVENUE: "view_reports_revenue",
  EXPORT_REPORTS_REVENUE: "export_reports_revenue",
  VIEW_REPORTS_BUSINESS: "view_reports_business",
  VIEW_CLIENTS_ASSIGNED: "view_clients_assigned",
  VIEW_CLIENTS_ALL: "view_clients_all",
  VIEW_CLIENT_CONTACT_DETAILS: "view_client_contact_details",
  VIEW_CLIENT_HEALTH_NOTES_ASSIGNED: "view_client_health_notes_assigned",
  CREATE_CLIENT_SESSION_NOTES: "create_client_session_notes",
  MANAGE_CLIENTS_ALL: "manage_clients_all",
  MANAGE_SENSITIVE_CLIENT_NOTES: "manage_sensitive_client_notes",
  VIEW_STAFF: "view_staff",
  MANAGE_STAFF_PROFILES: "manage_staff_profiles",
  ASSIGN_STAFF_ROLES: "assign_staff_roles",
  MANAGE_PERMISSION_OVERRIDES: "manage_permission_overrides",
  MANAGE_ROLE_TEMPLATES: "manage_role_templates",
  VIEW_EMAIL_LOGS: "view_email_logs",
  RESEND_BOOKING_EMAILS: "resend_booking_emails",
  MANAGE_EMAIL_SETTINGS: "manage_email_settings",
  MANAGE_ENQUIRIES: "manage_enquiries",
  MANAGE_SERVICES: "manage_services",
  MANAGE_SETTINGS: "manage_settings",
  MANAGE_AVAILABILITY_GLOBAL: "manage_availability_global",
  MANAGE_AVAILABILITY_OWN: "manage_availability_own",
  MANAGE_AUDIT_LOGS: "manage_audit_logs",
  MANAGE_PRIVACY_OPERATIONS: "manage_privacy_operations",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function getRoleDisplayName(role: { name: string; display_label?: string | null }) {
  return role.display_label?.trim() || role.name;
}

export function hasAnyPermission(
  profile: StaffProfile | null,
  permissions: string[]
): boolean {
  return permissions.some((permission) => profile?.permissions.has(permission));
}

export function canViewDashboard(profile: StaffProfile | null) {
  return hasAnyPermission(profile, [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_REPORTS_OWN,
    PERMISSIONS.VIEW_REPORTS_OPERATIONAL,
    PERMISSIONS.VIEW_REPORTS_BUSINESS,
    PERMISSIONS.VIEW_BOOKINGS_ASSIGNED,
  ]);
}

export function canViewAllBookings(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.VIEW_BOOKINGS_ALL);
}

export function canViewAssignedBookings(profile: StaffProfile | null) {
  return hasAnyPermission(profile, [
    PERMISSIONS.VIEW_BOOKINGS_ASSIGNED,
    PERMISSIONS.MANAGE_BOOKINGS_ASSIGNED,
  ]);
}

export function canManageAllBookings(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.MANAGE_BOOKINGS_ALL);
}

export function canManageAssignedBookings(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.MANAGE_BOOKINGS_ASSIGNED);
}

export function canManageBookings(profile: StaffProfile | null) {
  return canManageAllBookings(profile) || canManageAssignedBookings(profile);
}

export function canAssignBookings(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.ASSIGN_BOOKINGS);
}

export function canClaimAssignments(profile: StaffProfile | null) {
  return Boolean(
    profile?.active &&
      profile.can_take_bookings &&
      hasPermission(profile, PERMISSIONS.CLAIM_ASSIGNMENTS)
  );
}

export function canViewOwnReports(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.VIEW_REPORTS_OWN);
}

export function canExportOwnReports(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.EXPORT_REPORTS_OWN);
}

export function canViewOperationalReports(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.VIEW_REPORTS_OPERATIONAL);
}

export function canViewBusinessReports(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.VIEW_REPORTS_BUSINESS);
}

export function canViewRevenueReports(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.VIEW_REPORTS_REVENUE);
}

export function canExportRevenueReports(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.EXPORT_REPORTS_REVENUE);
}

export function canOpenReports(profile: StaffProfile | null) {
  return hasAnyPermission(profile, [
    PERMISSIONS.VIEW_REPORTS_OWN,
    PERMISSIONS.VIEW_REPORTS_OPERATIONAL,
    PERMISSIONS.VIEW_REPORTS_BUSINESS,
    PERMISSIONS.VIEW_REPORTS_REVENUE,
  ]);
}

export function hasUniversalReportScope(profile: StaffProfile | null) {
  return hasAnyPermission(profile, [
    PERMISSIONS.VIEW_REPORTS_OPERATIONAL,
    PERMISSIONS.VIEW_REPORTS_BUSINESS,
    PERMISSIONS.VIEW_BOOKINGS_ALL,
    PERMISSIONS.MANAGE_BOOKINGS_ALL,
  ]);
}

export function canViewAllClients(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.VIEW_CLIENTS_ALL);
}

export function canViewAssignedClients(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.VIEW_CLIENTS_ASSIGNED);
}

export function canViewClientContactDetails(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.VIEW_CLIENT_CONTACT_DETAILS);
}

export function canViewAssignedHealthNotes(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.VIEW_CLIENT_HEALTH_NOTES_ASSIGNED);
}

export function canCreateSessionNotes(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.CREATE_CLIENT_SESSION_NOTES);
}

export function canManageAllClients(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.MANAGE_CLIENTS_ALL);
}

export function canManageSensitiveClientNotes(profile: StaffProfile | null) {
  return hasAnyPermission(profile, [
    PERMISSIONS.MANAGE_SENSITIVE_CLIENT_NOTES,
    PERMISSIONS.MANAGE_PRIVACY_OPERATIONS,
  ]);
}

export function canViewStaff(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.VIEW_STAFF);
}

export function canManageStaffProfiles(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.MANAGE_STAFF_PROFILES);
}

export function canAssignStaffRoles(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.ASSIGN_STAFF_ROLES);
}

export function canManagePermissionOverrides(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.MANAGE_PERMISSION_OVERRIDES);
}

export function canManageRoleTemplates(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.MANAGE_ROLE_TEMPLATES);
}

export function canViewEmailLogs(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.VIEW_EMAIL_LOGS);
}

export function canResendBookingEmails(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.RESEND_BOOKING_EMAILS);
}

export function canManageEmailSettings(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.MANAGE_EMAIL_SETTINGS);
}

export function canManageEnquiries(profile: StaffProfile | null) {
  return hasPermission(profile, PERMISSIONS.MANAGE_ENQUIRIES);
}

export function canManageOperations(profile: StaffProfile | null) {
  return hasAnyPermission(profile, [
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.MANAGE_EMAIL_SETTINGS,
  ]);
}

export function isCriticalAdmin(profile: StaffProfile | null) {
  return Boolean(
    profile &&
      canManageStaffProfiles(profile) &&
      canAssignStaffRoles(profile)
  );
}

// ─── Staff profile shape ──────────────────────────────────────────────────────

export interface StaffProfile {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  role_id: string;
  role_name: string;
  gender: string;
  active: boolean;
  can_take_bookings: boolean;
  availability_mode: string;
  profile_photo_path?: string | null;
  phone?: string | null;
  show_phone_on_profile?: boolean;
  short_bio?: string | null;
  specialties?: string[];
  languages?: string[];
  service_areas?: string[];
  profile_completed_at?: string | null;
  permissions: Set<string>;
}

// ─── Resolve permissions for a staff member ───────────────────────────────────
// Resolution order:
//   1. All permissions granted to the staff member's role (role_permissions)
//   2. Individual overrides where is_granted = true  (additive)
//   3. Individual overrides where is_granted = false (revocations)

async function resolvePermissions(
  supabase: SupabaseClient,
  roleId: string,
  staffId: string
): Promise<Set<string>> {
  const [rolePermsResult, overridesResult] = await Promise.all([
    supabase
      .from("role_permissions")
      .select("permissions(name)")
      .eq("role_id", roleId),
    supabase
      .from("staff_permission_overrides")
      .select("permissions(name), is_granted")
      .eq("staff_id", staffId),
  ]);

  const resolved = new Set<string>();

  // Step 1: add role permissions
  for (const row of rolePermsResult.data ?? []) {
    const perm = (row.permissions as unknown) as { name: string } | null;
    if (perm?.name) resolved.add(perm.name);
  }

  // Step 2 & 3: apply individual overrides
  for (const row of overridesResult.data ?? []) {
    const perm = (row.permissions as unknown) as { name: string } | null;
    if (!perm?.name) continue;
    if (row.is_granted) {
      resolved.add(perm.name);
    } else {
      resolved.delete(perm.name);
    }
  }

  return resolved;
}

// ─── getStaffProfile ─────────────────────────────────────────────────────────
// Fetches the current user's staff profile plus all resolved permissions.
// Returns null if the user has no session or no matching staff profile.

export async function getStaffProfile(
  supabase: SupabaseClient
): Promise<StaffProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("id, auth_user_id, name, email, role_id, gender, active, can_take_bookings, availability_mode, profile_photo_path, phone, show_phone_on_profile, short_bio, specialties, languages, service_areas, profile_completed_at, roles(name, display_label)")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile) return null;

  const role = (profile.roles as unknown) as { name: string; display_label?: string | null } | null;
  const permissions = await resolvePermissions(supabase, profile.role_id, profile.id);

  return {
    id: profile.id,
    auth_user_id: profile.auth_user_id,
    name: profile.name,
    email: profile.email,
    role_id: profile.role_id,
    role_name: role ? getRoleDisplayName(role) : "Unknown",
    gender: profile.gender,
    active: profile.active,
    can_take_bookings: profile.can_take_bookings,
    availability_mode: profile.availability_mode,
    profile_photo_path: profile.profile_photo_path,
    phone: profile.phone,
    show_phone_on_profile: profile.show_phone_on_profile,
    short_bio: profile.short_bio,
    specialties: profile.specialties ?? [],
    languages: profile.languages ?? [],
    service_areas: profile.service_areas ?? [],
    profile_completed_at: profile.profile_completed_at,
    permissions,
  };
}

// ─── requirePermission ───────────────────────────────────────────────────────
// Server-side permission gate for Server Components, Server Actions, and
// Route Handlers. Returns the staff profile if the permission is granted.
// Throws if the user is unauthenticated, inactive, or lacks the permission.

export class PermissionError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "INACTIVE" | "FORBIDDEN",
    message: string
  ) {
    super(message);
    this.name = "PermissionError";
  }
}

export async function requirePermission(
  permission: Permission,
  supabase: SupabaseClient
): Promise<StaffProfile> {
  const profile = await getStaffProfile(supabase);

  if (!profile) {
    throw new PermissionError("UNAUTHENTICATED", "No authenticated staff session.");
  }

  if (!profile.active) {
    throw new PermissionError("INACTIVE", "This account is inactive.");
  }

  if (!profile.permissions.has(permission)) {
    throw new PermissionError(
      "FORBIDDEN",
      `Permission "${permission}" is required for this action.`
    );
  }

  return profile;
}

// ─── hasPermission ───────────────────────────────────────────────────────────
// Non-throwing check — useful for conditional UI rendering in Server Components.

export function hasPermission(
  profile: StaffProfile | null,
  permission: Permission
): boolean {
  return profile?.permissions.has(permission) ?? false;
}
