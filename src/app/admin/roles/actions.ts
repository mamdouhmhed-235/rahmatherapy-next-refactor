"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePermission, PERMISSIONS } from "@/lib/auth/rbac";
import { revalidatePath } from "next/cache";

const CRITICAL_ROLE_PERMISSIONS = new Set<string>([
  PERMISSIONS.MANAGE_USERS,
  PERMISSIONS.MANAGE_ROLES,
]);

export async function toggleRolePermission(
  roleId: string,
  permissionId: string,
  permissionName: string,
  isCurrentlyGranted: boolean
): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();

  // Only users with manage_roles may call this
  let actor;
  try {
    actor = await requirePermission(PERMISSIONS.MANAGE_ROLES, supabase);
  } catch {
    return { error: "Insufficient permissions." };
  }

  const adminClient = createSupabaseAdminClient();

  const [{ data: role }, { data: permission }] = await Promise.all([
    adminClient.from("roles").select("id, name").eq("id", roleId).single(),
    adminClient
      .from("permissions")
      .select("id, name")
      .eq("id", permissionId)
      .single(),
  ]);

  if (!role || !permission) {
    return { error: "Role or permission not found." };
  }

  const { data: existingGrant, error: grantLookupError } = await adminClient
    .from("role_permissions")
    .select("role_id")
    .eq("role_id", roleId)
    .eq("permission_id", permissionId)
    .maybeSingle();

  if (grantLookupError) {
    return { error: "Failed to verify current permission state." };
  }

  const isGranted = Boolean(existingGrant);
  const effectivePermissionName = permission.name;
  const isCriticalRevoke =
    isGranted && CRITICAL_ROLE_PERMISSIONS.has(effectivePermissionName);
  const isOwnerRole = role.name.toLowerCase() === "owner";

  if (isCriticalRevoke && isOwnerRole) {
    return {
      error:
        "Owner must keep manage_users and manage_roles to prevent admin lockout.",
    };
  }

  if (isCriticalRevoke && actor.role_id === roleId) {
    return {
      error: "You cannot revoke critical permissions from your current role.",
    };
  }

  // Capture before state for audit log
  const beforeState = {
    roleId,
    permissionId,
    permissionName: effectivePermissionName,
    granted: isGranted,
    requestedPermissionName: permissionName,
    requestedGranted: isCurrentlyGranted,
  };

  if (isGranted) {
    // Revoke — delete the row
    const { error } = await adminClient
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId)
      .eq("permission_id", permissionId);

    if (error) return { error: "Failed to remove permission." };
  } else {
    // Grant — insert the row
    const { error } = await adminClient
      .from("role_permissions")
      .insert({ role_id: roleId, permission_id: permissionId });

    if (error) return { error: "Failed to add permission." };
  }

  // Write audit log
  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: isGranted ? "role_permission_revoked" : "role_permission_granted",
    target_type: "role_permissions",
    target_id: roleId,
    before_state: beforeState,
    after_state: {
      roleId,
      permissionId,
      permissionName: effectivePermissionName,
      granted: !isGranted,
    },
  });

  revalidatePath(`/admin/roles/${roleId}`);
  revalidatePath("/admin/roles");

  return {};
}
