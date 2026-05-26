import {
  canAssignBookings,
  canAssignStaffRoles,
  canManagePermissionOverrides,
  canManageStaffProfiles,
  canViewAssignedBookings,
  canViewStaff,
  hasPermission,
  PERMISSIONS,
  type StaffProfile,
} from "@/lib/auth/rbac";

export type StaffTeamScope = "admin" | "assignment" | "same_gender_team" | "none";

export interface StaffTeamAccess {
  access: boolean;
  scope: StaffTeamScope;
  canViewAdminFields: boolean;
  canViewContactFields: boolean;
  canViewRoleControls: boolean;
  canViewPermissionControls: boolean;
  canViewAudit: boolean;
  canViewClientWorkloadContext: boolean;
  canViewWorkloadSummary: boolean;
  canCreateStaff: boolean;
}

export interface StaffVisibilityRow {
  id: string;
  active: boolean;
  can_take_bookings: boolean;
  gender: string | null;
}

type QueryError = { message: string };
type QueryResult<T> = { data: T | null; error: QueryError | null };
type StaffProfilesQueryBuilder<T = unknown> = PromiseLike<QueryResult<T>> & {
  eq(column: string, value: unknown): StaffProfilesQueryBuilder<T>;
  order(
    column: string,
    options?: { ascending?: boolean }
  ): StaffProfilesQueryBuilder<T>;
  maybeSingle(): Promise<QueryResult<T>>;
};
type StaffProfilesTable = {
  select<T = unknown>(columns: string): StaffProfilesQueryBuilder<T>;
};
type SupabaseTableClient = {
  from(table: "staff_profiles"): unknown;
};

const ADMIN_STAFF_SELECT = `
  id,
  auth_user_id,
  name,
  email,
  role_id,
  gender,
  active,
  can_take_bookings,
  availability_mode,
  profile_photo_path,
  phone,
  show_phone_on_profile,
  short_bio,
  specialties,
  languages,
  service_areas,
  profile_completed_at,
  roles (
    id,
    name,
    display_label
  )
`;

const TEAM_STAFF_SELECT = `
  id,
  name,
  gender,
  active,
  can_take_bookings,
  availability_mode,
  short_bio,
  specialties,
  languages,
  service_areas,
  profile_photo_path,
  profile_completed_at
`;

const NO_TEAM_ACCESS: StaffTeamAccess = {
  access: false,
  scope: "none",
  canViewAdminFields: false,
  canViewContactFields: false,
  canViewRoleControls: false,
  canViewPermissionControls: false,
  canViewAudit: false,
  canViewClientWorkloadContext: false,
  canViewWorkloadSummary: false,
  canCreateStaff: false,
};

export function getStaffTeamAccess(profile: StaffProfile | null): StaffTeamAccess {
  if (!profile?.active) return NO_TEAM_ACCESS;

  if (canViewStaff(profile) || canManageStaffProfiles(profile)) {
    return {
      access: true,
      scope: "admin",
      canViewAdminFields: true,
      canViewContactFields: true,
      canViewRoleControls: canAssignStaffRoles(profile),
      canViewPermissionControls: canManagePermissionOverrides(profile),
      canViewAudit: canManageStaffProfiles(profile),
      canViewClientWorkloadContext: true,
      canViewWorkloadSummary: true,
      canCreateStaff: canManageStaffProfiles(profile) && canAssignStaffRoles(profile),
    };
  }

  if (canAssignBookings(profile)) {
    return {
      ...NO_TEAM_ACCESS,
      access: true,
      scope: "assignment",
      canViewWorkloadSummary: true,
    };
  }

  if (
    canViewAssignedBookings(profile) ||
    hasPermission(profile, PERMISSIONS.CLAIM_ASSIGNMENTS)
  ) {
    return {
      ...NO_TEAM_ACCESS,
      access: true,
      scope: "same_gender_team",
      canViewWorkloadSummary: true,
    };
  }

  return NO_TEAM_ACCESS;
}

export function canViewStaffProfile(
  actor: StaffProfile | null,
  target: StaffVisibilityRow | null
) {
  if (!actor?.active || !target) return false;
  if (actor.id === target.id) return true;

  const access = getStaffTeamAccess(actor);
  if (access.scope === "admin") return true;
  if (access.scope === "assignment") {
    return target.active && target.can_take_bookings;
  }
  if (access.scope === "same_gender_team") {
    return (
      target.active &&
      target.can_take_bookings &&
      Boolean(actor.gender) &&
      target.gender === actor.gender
    );
  }

  return false;
}

export function canEditSafeStaffProfile(actor: StaffProfile | null, staffId: string) {
  return Boolean(actor?.active && (actor.id === staffId || canManageStaffProfiles(actor)));
}

export function getStaffTeamSelect(access: StaffTeamAccess) {
  return access.scope === "admin" ? ADMIN_STAFF_SELECT : TEAM_STAFF_SELECT;
}

export function staffProfilesFrom(client: SupabaseTableClient): StaffProfilesTable {
  return client.from("staff_profiles") as StaffProfilesTable;
}
