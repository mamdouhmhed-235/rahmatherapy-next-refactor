"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getStaffProfile,
  PERMISSIONS,
} from "@/lib/auth/rbac";
import { getBusinessDate } from "@/lib/time/london";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import {
  scheduleToRows,
  validateSchedule,
  type DaySchedule,
} from "@/lib/booking/working-hours-segments";

export interface StaffAvailabilityActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Server actions are public endpoints, so the schedule that arrives here is
 * untrusted whatever its TypeScript type says. Normalise before validating —
 * `validateSchedule` maps over `breaks` and would throw on a non-array.
 *
 * A twin of the one in `admin/availability/actions.ts`: a `"use server"` module
 * may only export async functions, so the two cannot share it from there.
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

async function ensureStaffAvailabilityActor(staffId: string) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) {
    return { error: "Sign in to manage availability." } as const;
  }
  const canManageGlobal = profile.permissions.has(
    PERMISSIONS.MANAGE_AVAILABILITY_GLOBAL
  );
  const canManageOwn = profile.permissions.has(
    PERMISSIONS.MANAGE_AVAILABILITY_OWN
  );
  const isOwnProfile = profile.id === staffId;
  if (!canManageGlobal && !(isOwnProfile && canManageOwn)) {
    return { error: "You can only edit your own availability." } as const;
  }
  return { profile } as const;
}

// Postgres unique-violation SQLSTATE.
const PG_UNIQUE_VIOLATION = "23505";

export async function addStaffBlockedDate(
  _previousState: StaffAvailabilityActionState,
  formData: FormData
): Promise<StaffAvailabilityActionState> {
  const staffId = String(formData.get("staff_id") ?? "");
  if (!staffId) {
    return { error: "Missing staff reference." };
  }

  const gate = await ensureStaffAvailabilityActor(staffId);
  if ("error" in gate) return { error: gate.error };

  const date = String(formData.get("date") ?? "").trim();
  const reasonRaw = String(formData.get("reason") ?? "").trim();
  const reason = reasonRaw ? reasonRaw : null;

  if (!date) {
    return { fieldErrors: { date: "Pick a date." } };
  }
  if (date < getBusinessDate()) {
    return { fieldErrors: { date: "Pick a date from today onwards." } };
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("staff_blocked_dates")
    .insert({
      staff_id: staffId,
      blocked_date: date,
      reason,
    })
    .select()
    .single();

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      return {
        fieldErrors: {
          date: "That date is already closed. Edit or delete the existing entry.",
        },
      };
    }
    console.error("addStaffBlockedDate supabase error:", error);
    return { error: error.message };
  }

  await adminClient.from("audit_logs").insert({
    actor_staff_id: gate.profile.id,
    action_type: "blocked_date_created",
    target_type: "staff_blocked_dates",
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
  return {};
}

export async function deleteStaffBlockedDate(
  staffId: string,
  blockedDateId: string
): Promise<StaffAvailabilityActionState> {
  const gate = await ensureStaffAvailabilityActor(staffId);
  if ("error" in gate) return { error: gate.error };
  if (!blockedDateId) {
    return { error: "Missing closure reference." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("staff_blocked_dates")
    .select("*")
    .eq("id", blockedDateId)
    .eq("staff_id", staffId)
    .single();

  if (!beforeState) {
    return { error: "Closure not found." };
  }

  const { error } = await adminClient
    .from("staff_blocked_dates")
    .delete()
    .eq("id", blockedDateId)
    .eq("staff_id", staffId);

  if (error) {
    console.error("deleteStaffBlockedDate supabase error:", error);
    return { error: error.message };
  }

  await adminClient.from("audit_logs").insert({
    actor_staff_id: gate.profile.id,
    action_type: "blocked_date_deleted",
    target_type: "staff_blocked_dates",
    target_id: blockedDateId,
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
  return {};
}

const DUPLICATE_OVERRIDE_DATE =
  "That date already has an adjustment. Delete the existing one first.";

/**
 * C-14 Phase C Steps 12a + 14 — one date's hours, as SEGMENTS.
 *
 * A break is the gap between two bookable rows, so this writes N rows for the
 * date in one insert. Two things changed with the Step 12 migration:
 *
 *  * The duplicate-date guard. It used to fall out of SQLSTATE 23505 on the
 *    `(staff_id, override_date)` unique. That unique is gone, so the violation
 *    can never fire again — the guard would not have errored, it would have
 *    silently stopped guarding, and a second "Add override" would have stacked
 *    a whole extra set of hours onto the date. Replaced by the explicit
 *    pre-check below, which returns the same message. This is still an ADD:
 *    several segments in ONE call are the intended multi-row write; a SECOND
 *    call for a date that already has rows is the duplicate it rejects.
 *  * The unique also can no longer protect against a concurrent double-add.
 *    The pre-check is a read-then-write, so two simultaneous adds for the same
 *    date can both pass it. That is a UI double-submit at worst, it is visible
 *    on the page immediately, and deleting the date clears all of it.
 */
export async function addStaffAvailabilityOverride(
  staffId: string,
  date: string,
  schedule: DaySchedule,
  reason: string
): Promise<StaffAvailabilityActionState> {
  if (!staffId) {
    return { error: "Missing staff reference." };
  }

  const gate = await ensureStaffAvailabilityActor(staffId);
  if ("error" in gate) return { error: gate.error };

  // Untrusted whatever the types say — a server action is a public endpoint.
  const overrideDate = String(date ?? "").trim();
  const reasonText = String(reason ?? "").trim();

  if (!DATE_PATTERN.test(overrideDate)) {
    return { fieldErrors: { date: "Pick a date." } };
  }
  if (overrideDate < getBusinessDate()) {
    return { fieldErrors: { date: "Pick a date from today onwards." } };
  }

  // An override is always a set of hours; a whole day off is a blocked date.
  const normalized = { ...normalizeSchedule(schedule), isWorkingDay: true };
  const { errors } = validateSchedule(normalized);
  if (errors.length > 0) {
    return { fieldErrors: { start_time: errors[0] } };
  }

  const segments = scheduleToRows(normalized);
  if (segments.length === 0) {
    return { fieldErrors: { start_time: "Pick start and end times." } };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await adminClient
    .from("staff_availability_overrides")
    .select("id")
    .eq("staff_id", staffId)
    .eq("override_date", overrideDate)
    .limit(1);

  if (existingError) {
    console.error("addStaffAvailabilityOverride supabase error:", existingError);
    return { error: existingError.message };
  }
  if ((existing ?? []).length > 0) {
    return { fieldErrors: { date: DUPLICATE_OVERRIDE_DATE } };
  }

  const { data, error } = await adminClient
    .from("staff_availability_overrides")
    .insert(
      segments.map((segment) => ({
        staff_id: staffId,
        override_date: overrideDate,
        start_time: segment.start_time,
        end_time: segment.end_time,
        reason: reasonText || null,
      }))
    )
    .select();

  if (error) {
    console.error("addStaffAvailabilityOverride supabase error:", error);
    return { error: error.message };
  }

  const after = data ?? [];

  await adminClient.from("audit_logs").insert({
    actor_staff_id: gate.profile.id,
    action_type: "availability_override_upserted",
    target_type: "staff_availability_overrides",
    // A date is now several rows, so there is no single target row.
    target_id: after[0]?.id ?? null,
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
  return {};
}

/**
 * C-14 Phase C Step 14 — removes the override for a whole DATE, not one row.
 * A date with a break is several rows and "remove this override" means all of
 * them; deleting by id would strip the morning and leave the afternoon.
 */
export async function deleteStaffAvailabilityOverride(
  staffId: string,
  overrideDate: string
): Promise<StaffAvailabilityActionState> {
  const gate = await ensureStaffAvailabilityActor(staffId);
  if ("error" in gate) return { error: gate.error };

  const date = String(overrideDate ?? "").trim();
  if (!DATE_PATTERN.test(date)) {
    return { error: "Missing override reference." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("staff_availability_overrides")
    .select("*")
    .eq("override_date", date)
    .eq("staff_id", staffId);

  if (!beforeState || beforeState.length === 0) {
    return { error: "Override not found." };
  }

  const { error } = await adminClient
    .from("staff_availability_overrides")
    .delete()
    .eq("override_date", date)
    .eq("staff_id", staffId);

  if (error) {
    console.error("deleteStaffAvailabilityOverride supabase error:", error);
    return { error: error.message };
  }

  await adminClient.from("audit_logs").insert({
    actor_staff_id: gate.profile.id,
    action_type: "availability_override_deleted",
    target_type: "staff_availability_overrides",
    target_id: beforeState[0]?.id ?? null,
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
  return {};
}
