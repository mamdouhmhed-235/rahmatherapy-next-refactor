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
import {
  accountEmailSchema,
  passwordSchema,
} from "@/lib/auth/password-policy";

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
 * Create a staff profile AND its sign-in account, in one step.
 *
 * ⛔ WHY THIS EXISTS. `createStaffProfile` below makes a person, not a login. Before
 * this action the only way to finish the job was the Supabase dashboard: create the
 * auth user by hand, copy its UUID, paste it into `staff_profiles.auth_user_id`.
 * Miss the paste and the person types the correct password and is bounced to the
 * login screen for ever. That is not something a non-technical owner should be asked
 * to get right, so the whole sequence lives here instead.
 *
 * ⛔ ORDERING IS THE ENTIRE DESIGN. No transaction can span Supabase Auth (GoTrue)
 * and Postgres — they are separate services. So the only safety available is: do the
 * reversible thing first, and undo it by hand if the second step fails.
 *
 *   1. permission  →  2. validate  →  3. pre-check the duplicate surfaces
 *   →  4. create the auth user  →  5. insert the profile WITH auth_user_id
 *   →  6. if 5 failed, DELETE the auth user from 4  →  7. audit  →  8. revalidate
 *
 * ⚠️ Step 6 is the one that matters. Without it a failed step 5 leaves an auth user
 * with no profile — someone who authenticates successfully and is then rejected by
 * the app with no explanation, and no signal to anyone that it happened. Step 3
 * exists so the ordinary "email already used" case never reaches step 4 at all.
 *
 * ⚠️ `auth_user_id` is set INSIDE the insert rather than by a follow-up update. One
 * write instead of two removes a whole failure mode — there is no window in which a
 * profile exists unlinked.
 *
 * ⛔ NO EMAIL IS SENT. Deliberate. The owner types the password and hands it over
 * directly, so this path cannot be broken by mail configuration. Contrast
 * `approvePasswordResetRequest`, which must carry a secret it can never show twice.
 */
export async function createStaffProfileWithLogin(input: {
  name: string;
  email: string;
  password: string;
  role_id: string;
  gender: StaffGender;
}): Promise<{ error?: string; data?: { id: string } }> {
  const supabase = await createSupabaseServerClient();

  // 1. Permission — the same pair that gates createStaffProfile. Creating a login is
  //    strictly more powerful than creating a profile, so it must not be easier.
  let actor;
  try {
    actor = await requirePermission(PERMISSIONS.MANAGE_STAFF_PROFILES, supabase);
  } catch {
    return { error: "Insufficient permissions." };
  }
  if (!canAssignStaffRoles(actor)) return { error: "Insufficient permissions." };

  // 2. Validate.
  const name = input.name.trim();
  if (!name) return { error: "Name is required." };

  const emailParsed = accountEmailSchema.safeParse(input.email);
  if (!emailParsed.success) return { error: "Enter a valid email address." };
  const email = emailParsed.data;

  const passwordParsed = passwordSchema.safeParse(input.password);
  if (!passwordParsed.success) {
    return { error: passwordParsed.error.issues[0]?.message ?? "Invalid password." };
  }
  const password = passwordParsed.data;

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

  // 3. Pre-check for a duplicate before creating anything.
  //
  //    ⚠️ There are two uniqueness surfaces and they can disagree:
  //    `staff_profiles.email` has a unique index, and Supabase Auth separately
  //    refuses a duplicate address. Checking here means the ordinary case returns a
  //    readable message instead of a raw Postgres string, and never creates an auth
  //    user that then has to be deleted again.
  const { data: existingProfile } = await adminClient
    .from("staff_profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    return { error: "That email address is already used by another staff member." };
  }

  // 4. Create the sign-in account.
  //
  //    ⛔ `email_confirm: true` is not optional. This project requires confirmation,
  //    and an unconfirmed account fails sign-in while the login page reports
  //    "Incorrect email or password" — sending whoever debugs it after a password
  //    that was correct all along.
  const { data: created, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError || !created?.user) {
    const message = createError?.message ?? "";
    // Auth's own duplicate check — reachable when a login exists with no profile
    // attached to it, which step 3 cannot see.
    if (/already|registered|exists/i.test(message)) {
      return {
        error:
          "A sign-in account already exists for that email address. Check Supabase " +
          "Authentication, or use a different address.",
      };
    }
    return { error: "Could not create the sign-in account. Try again." };
  }

  const authUserId = created.user.id;

  // 5. Insert the profile, already linked.
  const { data, error } = await adminClient
    .from("staff_profiles")
    .insert({
      name,
      email,
      role_id: input.role_id,
      gender: input.gender,
      auth_user_id: authUserId,
      active: true,
      can_take_bookings: false,
      availability_mode: "use_global",
      created_by: actor.id,
      updated_by: actor.id,
    })
    .select("id")
    .single();

  // 6. ⛔ COMPENSATE. The profile failed, so the login must not survive it.
  //
  //    Without this the account is a silent trap: it authenticates, the app then
  //    rejects it because no profile matches, and the person is told nothing useful
  //    while nobody else knows the account exists at all.
  if (error || !data) {
    const { error: cleanupError } =
      await adminClient.auth.admin.deleteUser(authUserId);

    if (cleanupError) {
      // ⚠️ Both halves failed. Say so precisely — this is the one case that needs a
      // human in the Supabase dashboard, and hiding it would strand the account.
      console.error(
        "createStaffProfileWithLogin: profile insert failed AND auth cleanup failed",
        {
          authUserId,
          insertError: error?.message,
          cleanupError: cleanupError.message,
        }
      );
      return {
        error:
          "The staff member could not be created, and a stray sign-in account was " +
          `left behind (id ${authUserId}). Delete it in Supabase → Authentication → ` +
          "Users before trying again.",
      };
    }

    if (/duplicate key|unique constraint/i.test(error?.message ?? "")) {
      return { error: "That email address is already used by another staff member." };
    }
    return { error: "Could not create the staff member. Try again." };
  }

  // 7. Audit.
  //
  //    ⛔ NEVER the password, its hash, or its length. The audit screen's redaction
  //    list does not contain the word "password", so anything stored under such a key
  //    would be rendered in full to every reviewer.
  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "staff_login_created",
    // ⚠️ "staff", not "staff_profiles", so the row is reachable by the audit screen's
    //    target filter — see the note on staff_profile_created below.
    target_type: "staff",
    target_id: data.id,
    after_state: {
      name,
      email,
      role_id: input.role_id,
      gender: input.gender,
      auth_user_id: authUserId,
      password_set_by: "admin",
    },
  });

  // 8. Revalidate.
  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.STAFF);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/staff");

  return { data };
}

/**
 * Create a staff profile. Auth user linking happens separately through Supabase Auth.
 *
 * ⚠️ Prefer `createStaffProfileWithLogin` above for new staff. This action leaves the
 * person unable to sign in, and no in-app route finishes the job — the "Sign-in
 * account created" item on their profile stays unticked with nothing behind it. Kept
 * because existing callers and tests depend on it.
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
