import { redirect } from "next/navigation";
import { Mail, Send } from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBusinessDate } from "@/lib/time/london";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
} from "../components/admin-ui";
import { formatDate, formatDateTime, formatLabel, formatTime } from "../clients/format";
import { sendManualBookingReminder } from "./actions";

export const metadata = {
  title: "Email Status - Rahma Therapy Admin",
};

interface EmailEvent {
  id: string;
  booking_id: string | null;
  staff_id: string | null;
  event_type: string;
  recipient_email: string | null;
  recipient_role: string | null;
  delivery_status: string;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
}

interface ReminderBooking {
  id: string;
  booking_date: string;
  start_time: string;
  contact_full_name: string | null;
  contact_email: string | null;
  status: string;
}

function canOpenEmailStatus(profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>) {
  return (
    profile.permissions.has(PERMISSIONS.MANAGE_EMAILS) ||
    profile.permissions.has(PERMISSIONS.MANAGE_BOOKINGS_ALL)
  );
}

export default async function EmailsPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");
  if (!canOpenEmailStatus(profile)) return <InsufficientPermissions />;

  const adminClient = createSupabaseAdminClient();
  const [{ data: events }, { data: bookings }] = await Promise.all([
    adminClient
      .from("email_delivery_events")
      .select("id, booking_id, staff_id, event_type, recipient_email, recipient_role, delivery_status, provider_message_id, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<EmailEvent[]>(),
    adminClient
      .from("bookings")
      .select("id, booking_date, start_time, contact_full_name, contact_email, status")
      .gte("booking_date", getBusinessDate())
      .in("status", ["pending", "confirmed"])
      .order("booking_date")
      .order("start_time")
      .limit(20)
      .returns<ReminderBooking[]>(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Email status"
        description="Review provider accepted/failed events and send manual reminders without storing private email bodies."
      />

      <section className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <AdminPanel title="Manual reminder" description="Send the existing reminder template for an upcoming booking.">
          <div className="grid gap-3">
            {(bookings ?? []).map((booking) => (
              <form key={booking.id} action={sendManualBookingReminder} className="rounded-lg bg-[var(--rahma-ivory)]/70 p-3">
                <input type="hidden" name="booking_id" value={booking.id} />
                <p className="text-sm font-medium text-[var(--rahma-charcoal)]">
                  {booking.contact_full_name ?? booking.id}
                </p>
                <p className="mt-1 text-xs text-[var(--rahma-muted)]">
                  {formatDate(booking.booking_date)} at {formatTime(booking.start_time)}
                </p>
                <button className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md bg-[var(--rahma-green)] px-3 text-sm font-semibold text-white">
                  <Send className="size-3" />
                  Send reminder
                </button>
              </form>
            ))}
            {(bookings ?? []).length === 0 ? (
              <p className="text-sm text-[var(--rahma-muted)]">No upcoming reminder candidates.</p>
            ) : null}
          </div>
        </AdminPanel>

        <AdminPanel title="Delivery events">
          <div className="grid gap-3">
            {(events ?? []).map((event) => (
              <article key={event.id} className="rounded-lg border border-[var(--rahma-border)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <AdminStatusBadge value={formatLabel(event.event_type)} tone="muted" />
                      <AdminStatusBadge value={event.delivery_status} tone={event.delivery_status === "failed" ? "danger" : event.delivery_status === "accepted" ? "success" : "warning"} />
                    </div>
                    <p className="truncate text-sm font-medium text-[var(--rahma-charcoal)]">
                      {event.recipient_email ?? "No recipient"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--rahma-muted)]">
                      {event.recipient_role ?? "unknown"} · {formatDateTime(event.created_at)}
                    </p>
                    {event.error_message ? (
                      <p className="mt-2 text-sm text-red-700">{event.error_message}</p>
                    ) : null}
                  </div>
                  <Mail className="size-5 text-[var(--rahma-green)]" />
                </div>
              </article>
            ))}
            {(events ?? []).length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--rahma-muted)]">
                No email events logged yet.
              </p>
            ) : null}
          </div>
        </AdminPanel>
      </section>
    </div>
  );
}

function InsufficientPermissions() {
  return (
    <AdminAccessDenied
      title="Email access limited"
      message="You need email or booking-management permission to view delivery status."
      permission="manage_emails"
    />
  );
}
