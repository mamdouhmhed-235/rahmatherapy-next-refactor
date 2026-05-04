"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { sendBookingReminderEmail } from "@/lib/email/notifications";
import { recordOperationalEvent } from "@/lib/ops/operational-events";

function canManageEmails(
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>
) {
  return (
    profile.permissions.has(PERMISSIONS.MANAGE_EMAILS) ||
    profile.permissions.has(PERMISSIONS.MANAGE_BOOKINGS_ALL)
  );
}

export async function sendManualBookingReminder(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active || !canManageEmails(profile)) {
    return;
  }

  const bookingId = String(formData.get("booking_id") ?? "").trim();
  if (!bookingId) return;

  const adminClient = createSupabaseAdminClient();
  try {
    await sendBookingReminderEmail(bookingId, adminClient);
    await adminClient.from("audit_logs").insert({
      actor_staff_id: profile.id,
      action_type: "booking_reminder_sent",
      target_type: "bookings",
      target_id: bookingId,
      after_state: { manual: true },
    });
  } catch (error) {
    await recordOperationalEvent(adminClient, {
      eventType: "failed_reminder_attempt",
      severity: "error",
      summary: "Manual booking reminder failed.",
      bookingId,
      staffId: profile.id,
      safeContext: {
        route: "/admin/emails",
        error_class: error instanceof Error ? error.name : "UnknownError",
      },
    }).catch(() => undefined);
    return;
  }

  revalidatePath("/admin/emails");
  revalidatePath("/admin/dashboard");
}
