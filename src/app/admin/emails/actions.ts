"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canManageAllBookings,
  canResendBookingEmails,
  canViewAllBookings,
  getStaffProfile,
} from "@/lib/auth/rbac";
import { sendBookingReminderEmail } from "@/lib/email/notifications";
import { recordOperationalEvent } from "@/lib/ops/operational-events";

function canManageEmails(
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>
) {
  return canResendBookingEmails(profile);
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

  // H11 middle-path scope check. If the actor can't see all bookings
  // (Therapist-class with resend permission), the booking must have an
  // assignment to them. Refuses silently — matches the existing silent-
  // refuse pattern when permission gates fail above. Logs an operational
  // event so the attempt is traceable.
  const canSeeAllBookings = canViewAllBookings(profile) || canManageAllBookings(profile);
  if (!canSeeAllBookings) {
    const { count } = await adminClient
      .from("booking_assignments")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", bookingId)
      .eq("assigned_staff_id", profile.id);
    if (!count || count === 0) {
      await recordOperationalEvent(adminClient, {
        eventType: "failed_reminder_attempt",
        severity: "warning",
        summary:
          "Staff attempted to resend a booking reminder for a booking they aren't assigned to.",
        bookingId,
        staffId: profile.id,
        safeContext: { route: "/admin/emails", reason: "out_of_scope_assignment" },
      }).catch(() => undefined);
      return;
    }
  }

  try {
    await sendBookingReminderEmail(bookingId, adminClient);
    await adminClient.from("audit_logs").insert({
      actor_staff_id: profile.id,
      action_type: "manual_booking_reminder_sent",
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
