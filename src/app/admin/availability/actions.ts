"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePermission, PERMISSIONS } from "@/lib/auth/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export async function saveAvailabilityRule(
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
  const ruleId = String(formData.get("rule_id") ?? "").trim();
  const dayOfWeek = Number(formData.get("day_of_week"));
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");
  const isWorkingDay = formData.get("is_working_day") === "on";

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    fieldErrors.day_of_week = "Choose a valid day.";
  }

  const timeError = validateTimeRange(startTime, endTime);
  if (timeError) fieldErrors.start_time = timeError;

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const adminClient = createSupabaseAdminClient();
  const payload = {
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
    is_working_day: isWorkingDay,
  };

  const { data: beforeState } = ruleId
    ? await adminClient
        .from("availability_rules")
        .select("*")
        .eq("id", ruleId)
        .single()
    : { data: null };

  const query = ruleId
    ? adminClient
        .from("availability_rules")
        .update(payload)
        .eq("id", ruleId)
        .select()
        .single()
    : adminClient.from("availability_rules").insert(payload).select().single();

  const { data, error } = await query;
  if (error) return { error: error.message };

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: ruleId
      ? "availability_rule_updated"
      : "availability_rule_created",
    target_type: "availability_rules",
    target_id: data.id,
    before_state: beforeState,
    after_state: data,
  });

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

  revalidatePath("/admin/availability");
  return {};
}
