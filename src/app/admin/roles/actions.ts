"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePermission, PERMISSIONS } from "@/lib/auth/rbac";
import { revalidatePath } from "next/cache";

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

  // Capture before state for audit log
  const beforeState = { roleId, permissionId, permissionName, granted: isCurrentlyGranted };

  if (isCurrentlyGranted) {
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
    action_type: isCurrentlyGranted ? "role_permission_revoked" : "role_permission_granted",
    target_type: "role_permissions",
    target_id: roleId,
    before_state: beforeState,
    after_state: { roleId, permissionId, permissionName, granted: !isCurrentlyGranted },
  });

  revalidatePath(`/admin/roles/${roleId}`);
  revalidatePath("/admin/roles");

  return {};
}
