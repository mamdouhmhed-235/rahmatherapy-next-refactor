import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  canManageBookings,
  canViewAllBookings,
  canManageOperations,
  canViewEmailLogs,
  canManageEnquiries,
  canClaimAssignments,
  type StaffProfile,
} from "@/lib/auth/rbac";
import type { AdminShellVariant } from "../shell-variant";
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

const ENQUIRY_SOURCE_LABELS: Record<string, string> = {
  phone: "Phone",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  referral: "Referral",
  website: "Website",
  other: "Other",
};

/**
 * Per-shell-variant notification fetcher.
 *
 * Mirrors the dashboard's role-variant pattern: each shell variant gets its
 * own set of category queries so the bell only ever shows items the role can
 * act on. Permission checks inside each helper are retained as defence-in-
 * depth — variant resolution is permission-derived but a custom role mix
 * could still surprise it.
 *
 * Returns [] on any failure so the bell renders gracefully; the console.error
 * keeps the next regression surfacing via Sentry's instrumentation hook.
 */
export async function getNavNotifications(
  profile: StaffProfile,
  variant: AdminShellVariant | null
): Promise<NotificationItem[]> {
  if (!variant) return [];
  try {
    // Service-role client (same pattern as dashboard-data.ts) so RLS doesn't
    // hide claimable visits from a Therapist's user-scoped session. Per-
    // category permission checks inside each helper are the defence-in-depth
    // — variant resolution + permission helpers prove the caller is allowed
    // to see each category before the query fires.
    const supabase = createSupabaseAdminClient();
    switch (variant) {
      case "owner_admin":
        return await getOwnerAdminNotifications(profile, supabase);
      case "coordinator":
        return await getCoordinatorNotifications(profile, supabase);
      case "therapist":
        return await getTherapistNotifications(profile, supabase);
      default:
        return [];
    }
  } catch (err) {
    console.error("getNavNotifications failed:", err);
    return [];
  }
}

// ─── Owner / Admin ────────────────────────────────────────────────────────────
// Everything operationally meaningful: unassigned bookings, failed emails,
// open ops events, uncontacted enquiries, unpaid completed bookings.

async function getOwnerAdminNotifications(
  profile: StaffProfile,
  supabase: SupabaseClient
): Promise<NotificationItem[]> {
  const canSeeBookings = canManageBookings(profile) || canViewAllBookings(profile);
  const canSeeEmails = canViewEmailLogs(profile);
  const canSeeOps = canManageOperations(profile);
  const canSeeEnquiries = canManageEnquiries(profile);
  const today = new Date().toISOString().slice(0, 10);

  const [assignmentsRes, emailsRes, opsRes, enquiriesRes, unpaidRes] = await Promise.all([
    canSeeBookings
      ? supabase
          .from("bookings")
          .select("id, booking_date")
          .in("status", ["pending", "confirmed"])
          .eq("assignment_status", "unassigned")
          .gte("booking_date", today)
          .order("booking_date", { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [] as { id: string; booking_date: string }[], error: null }),

    canSeeEmails
      ? supabase
          .from("email_delivery_events")
          .select("id, event_type, error_message, booking_id, created_at")
          .eq("delivery_status", "failed")
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({
          data: [] as {
            id: string;
            event_type: string;
            error_message: string | null;
            booking_id: string | null;
            created_at: string;
          }[],
          error: null,
        }),

    canSeeOps
      ? supabase
          .from("operational_events")
          .select("id, event_type, summary, severity, created_at")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({
          data: [] as {
            id: string;
            event_type: string;
            summary: string;
            severity: string;
            created_at: string;
          }[],
          error: null,
        }),

    canSeeEnquiries
      ? supabase
          .from("enquiries")
          .select("id, full_name, source, created_at")
          .eq("status", "new")
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({
          data: [] as { id: string; full_name: string; source: string; created_at: string }[],
          error: null,
        }),

    canSeeBookings
      ? supabase
          .from("bookings")
          .select("id, contact_full_name, booking_date, amount_due, amount_paid")
          .eq("status", "completed")
          .eq("payment_status", "unpaid")
          .order("booking_date", { ascending: false })
          .limit(10)
      : Promise.resolve({
          data: [] as {
            id: string;
            contact_full_name: string | null;
            booking_date: string;
            amount_due: number | null;
            amount_paid: number | null;
          }[],
          error: null,
        }),
  ]);

  const items: NotificationItem[] = [];

  for (const booking of assignmentsRes.data ?? []) {
    items.push({
      id: `nav-assign-${booking.id}`,
      type: "assignment",
      title: "Unassigned booking",
      detail: `Booking on ${booking.booking_date} needs a therapist assigned.`,
      severity: "warning",
      timestamp: booking.booking_date,
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

  for (const enquiry of enquiriesRes.data ?? []) {
    items.push({
      id: `nav-enquiry-${enquiry.id}`,
      type: "enquiry",
      title: "New enquiry awaiting follow-up",
      detail: `${enquiry.full_name} · ${ENQUIRY_SOURCE_LABELS[enquiry.source] ?? enquiry.source}`,
      severity: "info",
      timestamp: enquiry.created_at.slice(0, 16).replace("T", " "),
      href: "/admin/enquiries?tab=new",
      actionLabel: "Contact enquiry",
    });
  }

  for (const booking of unpaidRes.data ?? []) {
    const outstanding = Number(booking.amount_due ?? 0) - Number(booking.amount_paid ?? 0);
    items.push({
      id: `nav-unpaid-${booking.id}`,
      type: "payment",
      title: "Unpaid completed booking",
      detail: `${booking.contact_full_name ?? "Client"} · £${outstanding.toFixed(2)} outstanding`,
      severity: "warning",
      timestamp: booking.booking_date,
      href: `/admin/bookings/${booking.id}`,
      actionLabel: "Review payment",
    });
  }

  return items;
}

// ─── Coordinator ──────────────────────────────────────────────────────────────
// Enquiry-led front-desk surface: new enquiries first, then unassigned
// bookings, then failed emails (Coordinator holds view_email_logs +
// resend_booking_emails). No ops events — Coordinator lacks
// MANAGE_OPERATIONS semantics.

async function getCoordinatorNotifications(
  profile: StaffProfile,
  supabase: SupabaseClient
): Promise<NotificationItem[]> {
  const canSeeBookings = canManageBookings(profile) || canViewAllBookings(profile);
  const canSeeEmails = canViewEmailLogs(profile);
  const canSeeEnquiries = canManageEnquiries(profile);
  const today = new Date().toISOString().slice(0, 10);

  const [enquiriesRes, assignmentsRes, emailsRes] = await Promise.all([
    canSeeEnquiries
      ? supabase
          .from("enquiries")
          .select("id, full_name, source, created_at")
          .eq("status", "new")
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({
          data: [] as { id: string; full_name: string; source: string; created_at: string }[],
          error: null,
        }),

    canSeeBookings
      ? supabase
          .from("bookings")
          .select("id, booking_date")
          .in("status", ["pending", "confirmed"])
          .eq("assignment_status", "unassigned")
          .gte("booking_date", today)
          .order("booking_date", { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [] as { id: string; booking_date: string }[], error: null }),

    canSeeEmails
      ? supabase
          .from("email_delivery_events")
          .select("id, event_type, error_message, booking_id, created_at")
          .eq("delivery_status", "failed")
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({
          data: [] as {
            id: string;
            event_type: string;
            error_message: string | null;
            booking_id: string | null;
            created_at: string;
          }[],
          error: null,
        }),
  ]);

  const items: NotificationItem[] = [];

  for (const enquiry of enquiriesRes.data ?? []) {
    items.push({
      id: `nav-enquiry-${enquiry.id}`,
      type: "enquiry",
      title: "New enquiry awaiting follow-up",
      detail: `${enquiry.full_name} · ${ENQUIRY_SOURCE_LABELS[enquiry.source] ?? enquiry.source}`,
      severity: "info",
      timestamp: enquiry.created_at.slice(0, 16).replace("T", " "),
      href: "/admin/enquiries?tab=new",
      actionLabel: "Contact enquiry",
    });
  }

  for (const booking of assignmentsRes.data ?? []) {
    items.push({
      id: `nav-assign-${booking.id}`,
      type: "assignment",
      title: "Unassigned booking",
      detail: `Booking on ${booking.booking_date} needs a therapist assigned.`,
      severity: "warning",
      timestamp: booking.booking_date,
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

  return items;
}

// ─── Therapist ────────────────────────────────────────────────────────────────
// Self-scoped: reschedule requests on the therapist's own bookings + visits
// they're eligible to claim. Mirrors the dashboard's
// `getTherapistScopeAssignments` pattern but lighter (no claimable count
// rollup, no participant joins).

async function getTherapistNotifications(
  profile: StaffProfile,
  supabase: SupabaseClient
): Promise<NotificationItem[]> {
  const canSeeAssigned = canManageBookings(profile);
  const canClaim = canClaimAssignments(profile);
  const today = new Date().toISOString().slice(0, 10);
  const items: NotificationItem[] = [];

  // 1. Reschedule requests on bookings assigned to this therapist.
  if (canSeeAssigned) {
    const { data: myAssignments } = await supabase
      .from("booking_assignments")
      .select("booking_id")
      .eq("assigned_staff_id", profile.id)
      .limit(50);
    const myBookingIds = Array.from(
      new Set((myAssignments ?? []).map((a) => a.booking_id).filter(Boolean))
    );
    if (myBookingIds.length > 0) {
      const { data: rescheduledBookings } = await supabase
        .from("bookings")
        .select(
          "id, contact_full_name, booking_date, reschedule_preferred_date, reschedule_preferred_time"
        )
        .in("id", myBookingIds)
        .eq("reschedule_status", "requested")
        .order("booking_date", { ascending: true })
        .limit(10);
      for (const booking of rescheduledBookings ?? []) {
        const proposed =
          booking.reschedule_preferred_date && booking.reschedule_preferred_time
            ? `${booking.reschedule_preferred_date} at ${String(booking.reschedule_preferred_time).slice(0, 5)}`
            : booking.reschedule_preferred_date ?? "—";
        items.push({
          id: `nav-resched-${booking.id}`,
          type: "assignment",
          title: "Client requested a reschedule",
          detail: `${booking.contact_full_name ?? "Client"} · proposed ${proposed}`,
          severity: "warning",
          timestamp: booking.booking_date,
          href: `/admin/bookings/${booking.id}`,
          actionLabel: "Review request",
        });
      }
    }
  }

  // 2. Claimable visits matching this therapist's gender scope.
  if (canClaim && profile.gender) {
    const { data: claimableAssigns } = await supabase
      .from("booking_assignments")
      .select("id, booking_id")
      .is("assigned_staff_id", null)
      .neq("status", "completed")
      .eq("required_therapist_gender", profile.gender)
      .limit(20);
    const claimableBookingIds = Array.from(
      new Set((claimableAssigns ?? []).map((a) => a.booking_id).filter(Boolean))
    );
    if (claimableBookingIds.length > 0) {
      const { data: claimableBookings } = await supabase
        .from("bookings")
        .select("id, booking_date, start_time")
        .in("id", claimableBookingIds)
        .gte("booking_date", today)
        .in("status", ["pending", "confirmed"])
        .order("booking_date", { ascending: true })
        .limit(10);
      for (const booking of claimableBookings ?? []) {
        const time = booking.start_time ? String(booking.start_time).slice(0, 5) : "";
        items.push({
          id: `nav-claim-${booking.id}`,
          type: "assignment",
          title: "Visit open to claim",
          detail: time ? `${booking.booking_date} at ${time}` : booking.booking_date,
          severity: "info",
          timestamp: booking.booking_date,
          href: `/admin/bookings/${booking.id}`,
          actionLabel: "View booking",
        });
      }
    }
  }

  return items;
}
