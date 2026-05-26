"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getStaffProfile,
  PERMISSIONS,
} from "@/lib/auth/rbac";
import { getBusinessDate } from "@/lib/time/london";

export interface StaffAvailabilityActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
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
  revalidatePath(`/admin/staff/${staffId}/availability`);
  return {};
}

export async function addStaffAvailabilityOverride(
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
  const startTime = String(formData.get("start_time") ?? "").trim();
  const endTime = String(formData.get("end_time") ?? "").trim();
  const reasonRaw = String(formData.get("reason") ?? "").trim();
  const reason = reasonRaw ? reasonRaw : null;

  if (!date) {
    return { fieldErrors: { date: "Pick a date." } };
  }
  if (date < getBusinessDate()) {
    return { fieldErrors: { date: "Pick a date from today onwards." } };
  }
  if (!startTime || !endTime) {
    return {
      fieldErrors: { start_time: "Pick start and end times." },
    };
  }
  if (endTime <= startTime) {
    return {
      fieldErrors: { start_time: "End time has to be after start time." },
    };
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("staff_availability_overrides")
    .insert({
      staff_id: staffId,
      override_date: date,
      start_time: startTime,
      end_time: endTime,
      reason,
    })
    .select()
    .single();

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      return {
        fieldErrors: {
          date: "That date already has an adjustment. Delete the existing one first.",
        },
      };
    }
    console.error("addStaffAvailabilityOverride supabase error:", error);
    return { error: error.message };
  }

  await adminClient.from("audit_logs").insert({
    actor_staff_id: gate.profile.id,
    action_type: "availability_override_upserted",
    target_type: "staff_availability_overrides",
    target_id: data.id,
    after_state: data,
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  revalidatePath(`/admin/staff/${staffId}/availability`);
  return {};
}

export async function deleteStaffAvailabilityOverride(
  staffId: string,
  overrideId: string
): Promise<StaffAvailabilityActionState> {
  const gate = await ensureStaffAvailabilityActor(staffId);
  if ("error" in gate) return { error: gate.error };
  if (!overrideId) {
    return { error: "Missing override reference." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("staff_availability_overrides")
    .select("*")
    .eq("id", overrideId)
    .eq("staff_id", staffId)
    .single();

  if (!beforeState) {
    return { error: "Override not found." };
  }

  const { error } = await adminClient
    .from("staff_availability_overrides")
    .delete()
    .eq("id", overrideId)
    .eq("staff_id", staffId);

  if (error) {
    console.error("deleteStaffAvailabilityOverride supabase error:", error);
    return { error: error.message };
  }

  await adminClient.from("audit_logs").insert({
    actor_staff_id: gate.profile.id,
    action_type: "availability_override_deleted",
    target_type: "staff_availability_overrides",
    target_id: overrideId,
    before_state: beforeState,
  });

  updateTag("report-data");
  updateTag("dashboard-data");
  revalidatePath(`/admin/staff/${staffId}/availability`);
  return {};
}
