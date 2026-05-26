// SERVER UTILITY — pick the admin shell variant from a staff profile's
// permission set. The variant drives nav density, command-palette
// visibility, brand sub-label, page-header style, and filter defaults.
//
// Capability-based, not role-name-based: a custom role with the right
// permissions still gets the right shell. Order matters — the first
// matching capability wins.

import type { StaffProfile } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/auth/rbac";

export type AdminShellVariant = "owner_admin" | "coordinator" | "therapist";

export function resolveAdminShellVariant(
  profile: StaffProfile | null
): AdminShellVariant | null {
  if (!profile || !profile.active) return null;

  // Owner / Admin: revenue reports access is the owner/admin signal.
  if (profile.permissions.has(PERMISSIONS.VIEW_REPORTS_REVENUE)) {
    return "owner_admin";
  }

  // Coordinator: full booking visibility or enquiry management without
  // revenue access.
  if (
    profile.permissions.has(PERMISSIONS.MANAGE_BOOKINGS_ALL) ||
    profile.permissions.has(PERMISSIONS.VIEW_BOOKINGS_ALL) ||
    profile.permissions.has(PERMISSIONS.MANAGE_ENQUIRIES)
  ) {
    return "coordinator";
  }

  // Therapist: assignment-scoped capabilities only.
  if (
    profile.permissions.has(PERMISSIONS.VIEW_BOOKINGS_ASSIGNED) ||
    profile.permissions.has(PERMISSIONS.MANAGE_BOOKINGS_ASSIGNED) ||
    profile.permissions.has(PERMISSIONS.CLAIM_ASSIGNMENTS)
  ) {
    return "therapist";
  }

  return null;
}
