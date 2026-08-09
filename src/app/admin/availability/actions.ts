"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePermission, PERMISSIONS } from "@/lib/auth/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import {
  scheduleToRows,
  validateSchedule,
  type DaySchedule,
} from "@/lib/booking/working-hours-segments";

export interface AvailabilityActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

async function requireGlobalAvailabilityManager() {
  const supabase = await createSupabaseServerClient();
  return requirePermission(PERMISSIONS.MANAGE_AVAILABILITY_GLOBAL, supabase);
}

function validateTimeRange(startTime: string, endTime: string) {
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
    return "Use valid start and end times.";
  }
  if (endTime <= startTime) {
    return "End time must be after start time.";
  }
  return null;
}

/**
 * Server actions are public endpoints, so the schedule that arrives here is
 * untrusted whatever its TypeScript type says. Normalise before validating —
 * `validateSchedule` maps over `breaks` and would throw on a non-array.
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
 * C-14 Phase A Step 9 — replaces the whole of one weekday's hours.
 *
 * Under the segments model a day is N rows (a break is the gap between two of
 * them), so a save can no longer be a one-row update: it has to delete the
 * day's rows and insert the new ones. That pair MUST be atomic — a delete that
 * commits without its insert leaves the day with zero rows, which the slot
 * engine reads as CLOSED, silently and customer-facing. Hence the RPC, whose
 * body is one transaction (Owner decision 2026-08-09, Option A;
 * supabase/migrations/20260809120000_c14_save_availability_day.sql).
 *
 * It returns the day's rows from before AND after the swap, taken from one
 * snapshot inside that transaction, which is what the audit entry records.
 */
export async function saveAvailabilityDay(
  dayOfWeek: number,
  schedule: DaySchedule
): Promise<AvailabilityActionState> {
  let actor;
  try {
    actor = await requireGlobalAvailabilityManager();
  } catch {
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
  const { data, error } = await adminClient.rpc("save_availability_day", {
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
    action_type: "availability_rule_updated",
    target_type: "availability_rules",
    // A day is now several rows, so there is no single target row. The first
    // segment is a real row at write time; before/after carry the full picture.
    target_id: after[0]?.id ?? null,
    before_state: before,
    after_state: after,
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.STAFF);
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/availability");
  return { success: true };
}

export async function deleteAvailabilityRule(ruleId: string) {
  let actor;
  try {
    actor = await requireGlobalAvailabilityManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("availability_rules")
    .select("*")
    .eq("id", ruleId)
    .single();

  if (!beforeState) return { error: "Availability rule not found." };

  const { error } = await adminClient
    .from("availability_rules")
    .delete()
    .eq("id", ruleId);

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "availability_rule_deleted",
    target_type: "availability_rules",
    target_id: ruleId,
    before_state: beforeState,
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.STAFF);
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/availability");
  return {};
}

export async function createBlockedDate(
  _previousState: AvailabilityActionState,
  formData: FormData
): Promise<AvailabilityActionState> {
  let actor;
  try {
    actor = await requireGlobalAvailabilityManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const blockedDate = String(formData.get("blocked_date") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!blockedDate) {
    return { fieldErrors: { blocked_date: "Choose a blocked date." } };
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("blocked_dates")
    .insert({ blocked_date: blockedDate, reason: reason || null })
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "blocked_date_created",
    target_type: "blocked_dates",
    target_id: data.id,
    after_state: data,
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.STAFF);
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/availability");
  return { success: true };
}

export async function deleteBlockedDate(blockedDateId: string) {
  let actor;
  try {
    actor = await requireGlobalAvailabilityManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("blocked_dates")
    .select("*")
    .eq("id", blockedDateId)
    .single();

  if (!beforeState) return { error: "Blocked date not found." };

  const { error } = await adminClient
    .from("blocked_dates")
    .delete()
    .eq("id", blockedDateId);

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "blocked_date_deleted",
    target_type: "blocked_dates",
    target_id: blockedDateId,
    before_state: beforeState,
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.STAFF);
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/availability");
  return {};
}

export async function createAvailabilityOverride(
  _previousState: AvailabilityActionState,
  formData: FormData
): Promise<AvailabilityActionState> {
  let actor;
  try {
    actor = await requireGlobalAvailabilityManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const fieldErrors: Record<string, string> = {};
  const overrideDate = String(formData.get("override_date") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!overrideDate) fieldErrors.override_date = "Choose an override date.";
  const timeError = validateTimeRange(startTime, endTime);
  if (timeError) fieldErrors.start_time = timeError;

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("availability_overrides")
    .upsert(
      {
        override_date: overrideDate,
        start_time: startTime,
        end_time: endTime,
        reason: reason || null,
      },
      { onConflict: "override_date" }
    )
    .select()
    .single();

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "availability_override_upserted",
    target_type: "availability_overrides",
    target_id: data.id,
    after_state: data,
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.STAFF);
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/availability");
  return { success: true };
}

export async function deleteAvailabilityOverride(overrideId: string) {
  let actor;
  try {
    actor = await requireGlobalAvailabilityManager();
  } catch {
    return { error: "Insufficient permissions." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("availability_overrides")
    .select("*")
    .eq("id", overrideId)
    .single();

  if (!beforeState) return { error: "Availability override not found." };

  const { error } = await adminClient
    .from("availability_overrides")
    .delete()
    .eq("id", overrideId);

  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "availability_override_deleted",
    target_type: "availability_overrides",
    target_id: overrideId,
    before_state: beforeState,
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  updateTag(TAGS.STAFF);
  updateTag(TAGS.BOOKINGS);
  updateTag(TAGS.AUDIT);
  revalidatePath("/admin/availability");
  return {};
}
