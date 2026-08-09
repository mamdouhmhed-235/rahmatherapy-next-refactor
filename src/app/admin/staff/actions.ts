"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  canAssignStaffRoles,
  getStaffProfile,
  requirePermission,
  PERMISSIONS,
} from "@/lib/auth/rbac";
import { revalidatePath, updateTag } from "next/cache";
import {
  getStaffProfileCompletion,
  sanitizeStaffProfileUpdate,
  type StaffProfileUpdate,
} from "./profile-access";
import { getStaffTeamAccess, getStaffTeamSelect, staffProfilesFrom } from "./team-access";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import {
  scheduleToRows,
  validateSchedule,
  type DaySchedule,
} from "@/lib/booking/working-hours-segments";

type AvailabilityMode = "use_global" | "custom" | "global_with_overrides";
type StaffGender = "male" | "female";

interface StaffAvailabilityRuleInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working_day: boolean;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const CRITICAL_ROLE_PERMISSIONS = new Set<string>([
  PERMISSIONS.MANAGE_STAFF_PROFILES,
  PERMISSIONS.ASSIGN_STAFF_ROLES,
]);

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
    permissions.has(PERMISSIONS.MANAGE_STAFF_PROFILES) &&
    permissions.has(PERMISSIONS.ASSIGN_STAFF_ROLES)
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
  
  const profile = await getStaffProfile(supabase);
  const teamAccess = getStaffTeamAccess(profile);
  if (!teamAccess.access) {
    return { error: "Insufficient permissions." };
  }

  const adminClient = createSupabaseAdminClient();
  const staffProfiles = staffProfilesFrom(adminClient);
  const staffSelect = getStaffTeamSelect(teamAccess);

  if (teamAccess.scope === "admin") {
    const { data, error } = await staffProfiles
      .select<unknown[]>(staffSelect)
      .order("name");

    if (error) return { error: error.message };
    return { data };
  }

  if (teamAccess.scope === "assignment") {
    const { data, error } = await staffProfiles
      .select<unknown[]>(staffSelect)
      .eq("active", true)
      .eq("can_take_bookings", true)
      .order("name");

    if (error) return { error: error.message };
    return { data };
  }

  if (teamAccess.scope === "same_gender_team") {
    const [{ data: sameGenderStaff, error }, { data: ownProfile }] = await Promise.all([
      staffProfiles
        .select<unknown[]>(staffSelect)
        .eq("active", true)
        .eq("can_take_bookings", true)
        .eq("gender", profile?.gender)
        .order("name"),
      staffProfiles
        .select<unknown>(staffSelect)
        .eq("id", profile?.id)
        .maybeSingle(),
    ]);

    if (error) return { error: error.message };
    const data = Array.from(
      new Map(
        ([...((sameGenderStaff ?? []) as unknown[]), ownProfile].filter(Boolean) as { id: string }[])
          .map((member) => [member.id, member])
      ).values()
    );
    return { data };
  }

  return { data: [] };
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
    actor = await requirePermission(PERMISSIONS.MANAGE_STAFF_PROFILES, supabase);
  } catch {
    return { error: "Insufficient permissions." };
  }
  if (!canAssignStaffRoles(actor)) return { error: "Insufficient permissions." };

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
    .eq("active", true)
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

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.STAFF);
  updateTag(TAGS.AUDIT);
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

  const actor = await getStaffProfile(supabase);
  const sanitizedResult = sanitizeStaffProfileUpdate({ actor, staffId, updates });
  if ("error" in sanitizedResult) {
    return { error: sanitizedResult.error };
  }
  const sanitizedUpdates = sanitizedResult.updates;
  if (Object.keys(sanitizedUpdates).length === 0) {
    return { error: "No profile changes submitted." };
  }

  if (!actor) {
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

  if (staffId === actor.id && sanitizedUpdates.active === false) {
    return { error: "You cannot deactivate your own account." };
  }

  if (
    staffId === actor.id &&
    sanitizedUpdates.role_id &&
    sanitizedUpdates.role_id !== beforeState.role_id
  ) {
    return { error: "You cannot change your own role." };
  }

  if (sanitizedUpdates.role_id) {
    const { data: role } = await adminClient
      .from("roles")
      .select("id")
      .eq("id", sanitizedUpdates.role_id)
      .eq("active", true)
      .single();

    if (!role) return { error: "Choose a valid role." };
  }

  if (
    sanitizedUpdates.gender &&
    !["male", "female"].includes(sanitizedUpdates.gender)
  ) {
    return { error: "Choose a valid gender." };
  }

  if (
    sanitizedUpdates.can_take_bookings === true &&
    sanitizedUpdates.active !== true &&
    !beforeState.active
  ) {
    return { error: "Inactive staff cannot accept bookings." };
  }

  const wasCriticalAdmin =
    beforeState.active &&
    (await roleHasCriticalAdminPermissions(adminClient, beforeState.role_id));
  const nextKeepsCriticalAdmin =
    sanitizedUpdates.active !== false &&
    (!sanitizedUpdates.role_id ||
      (await roleHasCriticalAdminPermissions(adminClient, sanitizedUpdates.role_id)));

  if (wasCriticalAdmin && !nextKeepsCriticalAdmin) {
    const remainingCriticalAdmins = await countOtherActiveCriticalAdmins(
      adminClient,
      staffId
    );

    if (remainingCriticalAdmins === 0) {
      return { error: "Cannot remove the last active staff admin." };
    }
  }

  const profileCompletion = getStaffProfileCompletion({
    ...beforeState,
    ...sanitizedUpdates,
  });
  const updatePayload = {
    ...sanitizedUpdates,
    ...(sanitizedUpdates.active === false ? { can_take_bookings: false } : {}),
    profile_completed_at: profileCompletion.isComplete
      ? beforeState.profile_completed_at ?? new Date().toISOString()
      : null,
  };

  const { data, error } = await adminClient
    .from("staff_profiles")
    .update({
      ...updatePayload,
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

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.STAFF);
  updateTag(TAGS.AUDIT);
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

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.STAFF);
  updateTag(TAGS.AUDIT);
  revalidatePath(`/admin/staff/${staffId}/availability`);
  revalidatePath(`/admin/staff/${staffId}`);

  return { data };
}

export interface StaffAvailabilityDayState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

/**
 * Server actions are public endpoints, so the schedule that arrives here is
 * untrusted whatever its TypeScript type says. Normalise before validating —
 * `validateSchedule` maps over `breaks` and would throw on a non-array.
 * (Same guard as `saveAvailabilityDay`'s in availability/actions.ts; the two
 * live apart because `working-hours-segments.ts` is the shared *pure* module
 * and this is server-action input hardening.)
 */
function normalizeSchedule(schedule: DaySchedule): DaySchedule {
  return {
    isWorkingDay: schedule?.isWorkingDay === true,
    opens: typeof schedule?.opens === "string" ? schedule.opens : "",
    closes: typeof schedule?.closes === "string" ? schedule.closes : "",
    breaks: (Array.isArray(schedule?.breaks) ? schedule.breaks : []).map(
      (entry) => ({
        start: typeof entry?.start === "string" ? entry.start : "",
        end: typeof entry?.end === "string" ? entry.end : "",
      })
    ),
  };
}

/**
 * C-14 Phase B Step 10 — replaces the whole of one staff member's weekday.
 *
 * The per-staff mirror of `saveAvailabilityDay` (availability/actions.ts). A
 * day is now N rows — a break is the gap between two of them — so a save has
 * to delete the day's rows and insert the new ones, and that pair MUST be
 * atomic: a delete that commits without its insert leaves the day with zero
 * rows, which `getRuleWindowsForDay` reads as CLOSED. Hence the RPC, whose
 * body is one transaction (supabase/migrations/20260809120000_c14_save_
 * availability_day.sql, applied 2026-08-09).
 *
 * Delete-then-insert also sidesteps a live privilege gap: `service_role` holds
 * SELECT/INSERT/DELETE on `staff_availability_rules` but NOT UPDATE.
 */
export async function saveStaffAvailabilityDay(
  staffId: string,
  dayOfWeek: number,
  schedule: DaySchedule
): Promise<StaffAvailabilityDayState> {
  const supabase = await createSupabaseServerClient();
  const actor = await getAvailabilityActor(staffId, supabase);

  if (!actor) {
    return { error: "Insufficient permissions." };
  }

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { fieldErrors: { day_of_week: "Choose a valid day." } };
  }

  const normalized = normalizeSchedule(schedule);
  const { errors } = validateSchedule(normalized);
  if (errors.length > 0) {
    return { fieldErrors: { start_time: errors[0] } };
  }

  const segments = scheduleToRows(normalized);
  if (segments.length === 0) {
    // Unreachable via validateSchedule, which rejects every shape that yields
    // no rows. Kept because the alternative is writing a day with no rows.
    return {
      fieldErrors: { start_time: "Set opening and closing times, or close the day." },
    };
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient.rpc("save_staff_availability_day", {
    p_staff_id: staffId,
    p_day_of_week: dayOfWeek,
    p_segments: segments,
  });

  if (error) return { error: error.message };

  const swap = (data ?? {}) as {
    before?: Array<{ id: string }>;
    after?: Array<{ id: string }>;
  };
  const before = Array.isArray(swap.before) ? swap.before : [];
  const after = Array.isArray(swap.after) ? swap.after : [];

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "staff_availability_rules_updated",
    target_type: "staff_availability_rules",
    // A day is several rows now, so no single row is the target; the staff
    // member is. (`staff_availability_rules_updated` is the bulk-update event
    // name reserved for exactly this in admin/audit/format.ts.)
    target_id: staffId,
    before_state: before,
    after_state: after,
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.STAFF);
  // C-09 Phase B fix round: per-staff availability affects booking
  // eligibility, same rationale as the global-scope siblings in
  // availability/actions.ts.
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.AUDIT);
  revalidatePath(`/admin/staff/${staffId}/availability`);

  return { success: true };
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

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.STAFF);
  // C-09 Phase B fix round: per-staff availability affects booking
  // eligibility, same rationale as the global-scope siblings in
  // availability/actions.ts.
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.AUDIT);
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

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.STAFF);
  // C-09 Phase B fix round: per-staff availability affects booking
  // eligibility, same rationale as the global-scope siblings in
  // availability/actions.ts.
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.AUDIT);
  revalidatePath(`/admin/staff/${staffId}/availability`);

  return { success: true };
}

export async function updateStaffPermissionOverride(
  staffId: string,
  permissionId: string,
  mode: "inherit" | "grant" | "revoke"
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createSupabaseServerClient();

  let actor;
  try {
    actor = await requirePermission(PERMISSIONS.MANAGE_PERMISSION_OVERRIDES, supabase);
  } catch {
    return { error: "Insufficient permissions." };
  }

  if (!["inherit", "grant", "revoke"].includes(mode)) {
    return { error: "Choose a valid override mode." };
  }

  if (actor.id === staffId) {
    return { error: "You cannot change your own permission overrides." };
  }

  const adminClient = createSupabaseAdminClient();

  const [{ data: staff }, { data: permission }] = await Promise.all([
    adminClient
      .from("staff_profiles")
      .select("id, role_id, active")
      .eq("id", staffId)
      .single(),
    adminClient
      .from("permissions")
      .select("id, name, active")
      .eq("id", permissionId)
      .single(),
  ]);

  if (!staff || !permission || !permission.active) {
    return { error: "Staff profile or permission not found." };
  }

  if (
    mode === "revoke" &&
    staff.active &&
    CRITICAL_ROLE_PERMISSIONS.has(permission.name) &&
    (await roleHasCriticalAdminPermissions(adminClient, staff.role_id)) &&
    (await countOtherActiveCriticalAdmins(adminClient, staffId)) === 0
  ) {
    return { error: "Cannot remove the last active staff admin." };
  }

  const { data: beforeState } = await adminClient
    .from("staff_permission_overrides")
    .select("*")
    .eq("staff_id", staffId)
    .eq("permission_id", permissionId)
    .maybeSingle();

  if (mode === "inherit") {
    const { error } = await adminClient
      .from("staff_permission_overrides")
      .delete()
      .eq("staff_id", staffId)
      .eq("permission_id", permissionId);

    if (error) return { error: "Failed to remove permission override." };
  } else {
    const { error } = await adminClient
      .from("staff_permission_overrides")
      .upsert(
        {
          staff_id: staffId,
          permission_id: permissionId,
          is_granted: mode === "grant",
        },
        { onConflict: "staff_id,permission_id" }
      );

    if (error) return { error: "Failed to save permission override." };
  }

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "staff_permission_override_updated",
    target_type: "staff_permission_overrides",
    target_id: staffId,
    before_state: beforeState,
    after_state: {
      staff_id: staffId,
      permission_id: permissionId,
      permission_name: permission.name,
      mode,
    },
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.STAFF);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/staff");
  revalidatePath(`/admin/staff/${staffId}`);

  return { success: true };
}
