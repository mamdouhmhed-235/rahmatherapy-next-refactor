"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getStaffProfile,
  PERMISSIONS,
} from "@/lib/auth/rbac";

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

const FAKE_BLOCKED_DATE_MESSAGE =
  "Saving closures isn't wired up yet. The backend lands with the staff-blocked-dates BUILD plan.";
const FAKE_OVERRIDE_MESSAGE =
  "Saving overrides isn't wired up yet. The backend lands with the staff-availability-override BUILD plan.";

export async function addStaffBlockedDate(
  _previousState: StaffAvailabilityActionState,
  formData: FormData
): Promise<StaffAvailabilityActionState> {
  const staffId = String(formData.get("staff_id") ?? "");
  const gate = await ensureStaffAvailabilityActor(staffId);
  if ("error" in gate) return { error: gate.error };
  return { error: FAKE_BLOCKED_DATE_MESSAGE };
}

export async function deleteStaffBlockedDate(
  staffId: string,
  blockedDateId: string
): Promise<StaffAvailabilityActionState> {
  void blockedDateId;
  const gate = await ensureStaffAvailabilityActor(staffId);
  if ("error" in gate) return { error: gate.error };
  return { error: FAKE_BLOCKED_DATE_MESSAGE };
}

export async function addStaffAvailabilityOverride(
  _previousState: StaffAvailabilityActionState,
  formData: FormData
): Promise<StaffAvailabilityActionState> {
  const staffId = String(formData.get("staff_id") ?? "");
  const gate = await ensureStaffAvailabilityActor(staffId);
  if ("error" in gate) return { error: gate.error };
  return { error: FAKE_OVERRIDE_MESSAGE };
}

export async function deleteStaffAvailabilityOverride(
  staffId: string,
  overrideId: string
): Promise<StaffAvailabilityActionState> {
  void overrideId;
  const gate = await ensureStaffAvailabilityActor(staffId);
  if ("error" in gate) return { error: gate.error };
  return { error: FAKE_OVERRIDE_MESSAGE };
}
