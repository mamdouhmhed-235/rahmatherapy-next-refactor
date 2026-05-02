"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePermission, PERMISSIONS } from "@/lib/auth/rbac";
import { revalidatePath } from "next/cache";

type AvailabilityMode = "use_global" | "custom" | "global_with_overrides";
type StaffGender = "male" | "female";

interface StaffProfileUpdate {
  active?: boolean;
  can_take_bookings?: boolean;
  role_id?: string;
  gender?: StaffGender;
}

interface StaffAvailabilityRuleInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working_day: boolean;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validateStaffAvailabilityRule(input: StaffAvailabilityRuleInput) {
  if (input.day_of_week < 0 || input.day_of_week > 6) {
    return "Choose a valid day of the week.";
  }

  if (
    !TIME_PATTERN.test(input.start_time) ||
    !TIME_PATTERN.test(input.end_time)
  ) {
    return "Use valid start and end times.";
  }

  if (input.end_time <= input.start_time) {
    return "End time must be after start time.";
  }

  return null;
}

async function roleHasCriticalAdminPermissions(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  roleId: string
) {
  const { data, error } = await adminClient
    .from("role_permissions")
    .select("permissions(name)")
    .eq("role_id", roleId);

  if (error) return false;

  const permissions = new Set(
    (data ?? [])
      .map((row) => (row.permissions as unknown as { name: string } | null)?.name)
      .filter(Boolean)
  );

  return (
    permissions.has(PERMISSIONS.MANAGE_USERS) &&
    permissions.has(PERMISSIONS.MANAGE_ROLES)
  );
}

async function countOtherActiveCriticalAdmins(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  staffId: string
) {
  const { data, error } = await adminClient
    .from("staff_profiles")
    .select("id, role_id")
    .eq("active", true)
    .neq("id", staffId);

  if (error) return 0;

  let count = 0;
  for (const profile of data ?? []) {
    if (await roleHasCriticalAdminPermissions(adminClient, profile.role_id)) {
      count += 1;
    }
  }

  return count;
}

async function getAvailabilityActor(
  staffId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
) {
  try {
    return await requirePermission(PERMISSIONS.MANAGE_AVAILABILITY_GLOBAL, supabase);
  } catch {
    try {
      const profile = await requirePermission(
        PERMISSIONS.MANAGE_AVAILABILITY_OWN,
        supabase
      );
      if (profile.id !== staffId) throw new Error();
      return profile;
    } catch {
      return null;
    }
  }
}

/**
 * Fetch all staff profiles with their roles.
 */
export async function getStaffProfiles() {
  const supabase = await createSupabaseServerClient();
  
  try {
    await requirePermission(PERMISSIONS.MANAGE_USERS, supabase);
  } catch {
    return { error: "Insufficient permissions." };
  }

  const { data, error } = await supabase
    .from("staff_profiles")
    .select(`
      *,
      roles (
        id,
        name
      )
    `)
    .order("name");

  if (error) return { error: error.message };
  return { data };
}

/**
 * Create a staff profile. Auth user linking happens separately through Supabase Auth.
 */
export async function createStaffProfile(input: {
  name: string;
  email: string;
  role_id: string;
  gender: StaffGender;
}): Promise<{ error?: string; data?: { id: string } }> {
  const supabase = await createSupabaseServerClient();

  let actor;
  try {
    actor = await requirePermission(PERMISSIONS.MANAGE_USERS, supabase);
  } catch {
    return { error: "Insufficient permissions." };
  }

  const name = input.name.trim();
  const email = normalizeEmail(input.email);

  if (!name) return { error: "Name is required." };
  if (!email.includes("@")) return { error: "Enter a valid email address." };
  if (!["male", "female"].includes(input.gender)) {
    return { error: "Choose a valid gender." };
  }

  const adminClient = createSupabaseAdminClient();

  const { data: role } = await adminClient
    .from("roles")
    .select("id")
    .eq("id", input.role_id)
    .single();

  if (!role) return { error: "Choose a valid role." };

  const { data, error } = await adminClient
    .from("staff_profiles")
    .insert({
      name,
      email,
      role_id: input.role_id,
      gender: input.gender,
      active: true,
      can_take_bookings: false,
      availability_mode: "use_global",
      created_by: actor.id,
      updated_by: actor.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "staff_profile_created",
    target_type: "staff_profiles",
    target_id: data.id,
    after_state: { name, email, role_id: input.role_id, gender: input.gender },
  });

  revalidatePath("/admin/staff");

  return { data };
}

/**
 * Update basic staff profile fields.
 */
export async function updateStaffProfile(
  staffId: string,
  updates: StaffProfileUpdate
) {
  const supabase = await createSupabaseServerClient();
  
  let actor;
  try {
    actor = await requirePermission(PERMISSIONS.MANAGE_USERS, supabase);
  } catch {
    return { error: "Insufficient permissions." };
  }

  const adminClient = createSupabaseAdminClient();

  // Get before state for audit log
  const { data: beforeState } = await adminClient
    .from("staff_profiles")
    .select("*")
    .eq("id", staffId)
    .single();

  if (!beforeState) return { error: "Staff profile not found." };

  if (staffId === actor.id && updates.active === false) {
    return { error: "You cannot deactivate your own account." };
  }

  if (staffId === actor.id && updates.role_id && updates.role_id !== beforeState.role_id) {
    return { error: "You cannot change your own role." };
  }

  if (updates.role_id) {
    const { data: role } = await adminClient
      .from("roles")
      .select("id")
      .eq("id", updates.role_id)
      .single();

    if (!role) return { error: "Choose a valid role." };
  }

  if (updates.gender && !["male", "female"].includes(updates.gender)) {
    return { error: "Choose a valid gender." };
  }

  if (
    updates.can_take_bookings === true &&
    updates.active !== true &&
    !beforeState.active
  ) {
    return { error: "Inactive staff cannot accept bookings." };
  }

  const wasCriticalAdmin =
    beforeState.active &&
    (await roleHasCriticalAdminPermissions(adminClient, beforeState.role_id));
  const nextKeepsCriticalAdmin =
    updates.active !== false &&
    (!updates.role_id ||
      (await roleHasCriticalAdminPermissions(adminClient, updates.role_id)));

  if (wasCriticalAdmin && !nextKeepsCriticalAdmin) {
    const remainingCriticalAdmins = await countOtherActiveCriticalAdmins(
      adminClient,
      staffId
    );

    if (remainingCriticalAdmins === 0) {
      return { error: "Cannot remove the last active staff admin." };
    }
  }

  const sanitizedUpdates = {
    ...updates,
    ...(updates.active === false ? { can_take_bookings: false } : {}),
  };

  const { data, error } = await adminClient
    .from("staff_profiles")
    .update({
      ...sanitizedUpdates,
      updated_at: new Date().toISOString(),
      updated_by: actor.id
    })
    .eq("id", staffId)
    .select()
    .single();

  if (error) return { error: error.message };

  // Write audit log
  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "staff_profile_updated",
    target_type: "staff_profiles",
    target_id: staffId,
    before_state: beforeState,
    after_state: data,
  });

  revalidatePath("/admin/staff");
  revalidatePath(`/admin/staff/${staffId}`);
  
  return { data };
}

/**
 * Update staff availability mode.
 */
export async function updateStaffAvailabilityMode(
  staffId: string,
  mode: AvailabilityMode
) {
  const supabase = await createSupabaseServerClient();
  
  const actor = await getAvailabilityActor(staffId, supabase);
  if (!actor) {
    return { error: "Insufficient permissions." };
  }

  const adminClient = createSupabaseAdminClient();

  // Get before state for audit log
  const { data: beforeState } = await adminClient
    .from("staff_profiles")
    .select("availability_mode")
    .eq("id", staffId)
    .single();

  const { data, error } = await adminClient
    .from("staff_profiles")
    .update({
      availability_mode: mode,
      updated_at: new Date().toISOString(),
      updated_by: actor.id
    })
    .eq("id", staffId)
    .select()
    .single();

  if (error) return { error: error.message };

  // Write audit log
  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "staff_availability_mode_updated",
    target_type: "staff_profiles",
    target_id: staffId,
    before_state: beforeState,
    after_state: { availability_mode: mode },
  });

  revalidatePath(`/admin/staff/${staffId}/availability`);
  revalidatePath(`/admin/staff/${staffId}`);
  
  return { data };
}

export async function createStaffAvailabilityRule(
  staffId: string,
  input: StaffAvailabilityRuleInput
) {
  const supabase = await createSupabaseServerClient();
  const actor = await getAvailabilityActor(staffId, supabase);

  if (!actor) {
    return { error: "Insufficient permissions." };
  }

  const validationError = validateStaffAvailabilityRule(input);
  if (validationError) return { error: validationError };

  const adminClient = createSupabaseAdminClient();

  const { data: staff } = await adminClient
    .from("staff_profiles")
    .select("id")
    .eq("id", staffId)
    .single();

  if (!staff) return { error: "Staff profile not found." };

  const { data, error } = await adminClient
    .from("staff_availability_rules")
    .insert({
      staff_id: staffId,
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      is_working_day: input.is_working_day,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "staff_availability_rule_created",
    target_type: "staff_availability_rules",
    target_id: data.id,
    after_state: data,
  });

  revalidatePath(`/admin/staff/${staffId}/availability`);

  return { data };
}

export async function deleteStaffAvailabilityRule(
  staffId: string,
  ruleId: string
) {
  const supabase = await createSupabaseServerClient();
  const actor = await getAvailabilityActor(staffId, supabase);

  if (!actor) {
    return { error: "Insufficient permissions." };
  }

  const adminClient = createSupabaseAdminClient();

  const { data: beforeState } = await adminClient
    .from("staff_availability_rules")
    .select("*")
    .eq("id", ruleId)
    .eq("staff_id", staffId)
    .single();

  if (!beforeState) return { error: "Availability rule not found." };

  const { error } = await adminClient
    .from("staff_availability_rules")
    .delete()
    .eq("id", ruleId)
    .eq("staff_id", staffId);

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "staff_availability_rule_deleted",
    target_type: "staff_availability_rules",
    target_id: ruleId,
    before_state: beforeState,
  });

  revalidatePath(`/admin/staff/${staffId}/availability`);

  return { success: true };
}
