// SERVER ONLY — never import this in client components or expose to the browser.
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Permission name constants ────────────────────────────────────────────────

export const PERMISSIONS = {
  MANAGE_USERS: "manage_users",
  MANAGE_ROLES: "manage_roles",
  MANAGE_PERMISSIONS: "manage_permissions",
  MANAGE_SERVICES: "manage_services",
  MANAGE_BOOKINGS_ALL: "manage_bookings_all",
  MANAGE_BOOKINGS_OWN: "manage_bookings_own",
  MANAGE_CLIENTS: "manage_clients",
  MANAGE_SETTINGS: "manage_settings",
  MANAGE_AVAILABILITY_GLOBAL: "manage_availability_global",
  MANAGE_AVAILABILITY_OWN: "manage_availability_own",
  VIEW_ALL_BOOKINGS: "view_all_bookings",
  VIEW_OWN_BOOKINGS: "view_own_bookings",
  VIEW_CLIENTS: "view_clients",
  VIEW_REPORTS: "view_reports",
  CLAIM_ASSIGNMENTS: "claim_assignments",
  MANAGE_AUDIT_LOGS: "manage_audit_logs",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

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
    .select("id, auth_user_id, name, email, role_id, gender, active, can_take_bookings, availability_mode, roles(name)")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile) return null;

  const role = (profile.roles as unknown) as { name: string } | null;
  const permissions = await resolvePermissions(supabase, profile.role_id, profile.id);

  return {
    id: profile.id,
    auth_user_id: profile.auth_user_id,
    name: profile.name,
    email: profile.email,
    role_id: profile.role_id,
    role_name: role?.name ?? "Unknown",
    gender: profile.gender,
    active: profile.active,
    can_take_bookings: profile.can_take_bookings,
    availability_mode: profile.availability_mode,
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
