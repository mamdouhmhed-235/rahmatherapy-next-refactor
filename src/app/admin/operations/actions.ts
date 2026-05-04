"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";

function canManageOperationalEvents(
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>
) {
  return (
    profile.permissions.has(PERMISSIONS.MANAGE_SETTINGS) ||
    profile.permissions.has(PERMISSIONS.MANAGE_EMAILS) ||
    profile.permissions.has(PERMISSIONS.MANAGE_BOOKINGS_ALL)
  );
}

export async function updateOperationalEventStatus(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active || !canManageOperationalEvents(profile)) {
    return;
  }

  const eventId = String(formData.get("event_id") ?? "").trim();
  const nextStatus = String(formData.get("status") ?? "").trim();
  if (!eventId) return;
  if (!["acknowledged", "resolved"].includes(nextStatus)) {
    return;
  }

  const timestamp = new Date().toISOString();
  const payload =
    nextStatus === "acknowledged"
      ? {
          status: nextStatus,
          acknowledged_at: timestamp,
          acknowledged_by_staff_id: profile.id,
        }
      : {
          status: nextStatus,
          resolved_at: timestamp,
          resolved_by_staff_id: profile.id,
        };

  const adminClient = createSupabaseAdminClient();
  const { data: beforeState } = await adminClient
    .from("operational_events")
    .select("*")
    .eq("id", eventId)
    .single();
  const { data, error } = await adminClient
    .from("operational_events")
    .update(payload)
    .eq("id", eventId)
    .select()
    .single();

  if (error) return;

  await adminClient.from("audit_logs").insert({
    actor_staff_id: profile.id,
    action_type: "operational_event_status_updated",
    target_type: "operational_events",
    target_id: eventId,
    before_state: beforeState,
    after_state: data,
  });

  revalidatePath("/admin/operations");
  revalidatePath("/admin/dashboard");
}
