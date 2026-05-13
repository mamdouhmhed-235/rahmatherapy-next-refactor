import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { NotificationItem } from "../reports/reporting";

const OPS_EVENT_LABELS: Record<string, string> = {
  booking_failed: "Booking error",
  payment_failed: "Payment failed",
  email_failed: "Email delivery failed",
  assignment_failed: "Assignment error",
  webhook_failed: "System webhook failed",
  reminder_failed: "Reminder delivery failed",
  sync_failed: "Sync error",
};

export async function getNavNotifications(profileId: string): Promise<NotificationItem[]> {
  try {
    const supabase = await createSupabaseServerClient();

    const [assignmentsRes, emailsRes, opsRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, date")
        .in("status", ["pending", "confirmed"])
        .is("assigned_staff_id", null)
        .gte("date", new Date().toISOString().slice(0, 10))
        .order("date", { ascending: true })
        .limit(20),
      supabase
        .from("email_events")
        .select("id, event_type, error_message, booking_id, created_at")
        .eq("delivery_status", "failed")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("operational_events")
        .select("id, event_type, summary, severity, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const items: NotificationItem[] = [];

    for (const booking of assignmentsRes.data ?? []) {
      items.push({
        id: `nav-assign-${booking.id}`,
        type: "assignment",
        title: "Unassigned booking",
        detail: `Booking on ${booking.date} needs a therapist assigned.`,
        severity: "warning",
        timestamp: booking.date,
        href: "/admin/bookings?view=unassigned",
        actionLabel: "Assign therapist",
      });
    }

    for (const email of emailsRes.data ?? []) {
      items.push({
        id: `nav-email-${email.id}`,
        type: "email",
        title: "Email delivery failed",
        detail: email.error_message ?? "An email could not be delivered.",
        severity: "critical",
        timestamp: email.created_at.slice(0, 16).replace("T", " "),
        href: "/admin/emails",
        actionLabel: "Review email",
        secondaryHref: email.booking_id ? `/admin/bookings/${email.booking_id}` : null,
        secondaryLabel: "View booking",
      });
    }

    for (const event of opsRes.data ?? []) {
      items.push({
        id: `nav-ops-${event.id}`,
        type: "operation",
        title: OPS_EVENT_LABELS[event.event_type] ?? "Operational alert",
        detail: event.summary,
        severity: event.severity === "error" ? "critical" : "warning",
        timestamp: event.created_at.slice(0, 16).replace("T", " "),
        href: "/admin/operations",
        actionLabel: "Review event",
      });
    }

    return items;
  } catch {
    return [];
  }
}
