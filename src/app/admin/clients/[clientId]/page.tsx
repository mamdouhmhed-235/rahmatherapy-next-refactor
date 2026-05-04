import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  StickyNote,
  UserSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AdminAccessDenied,
  AdminPanel,
  AdminStatusBadge,
} from "../../components/admin-ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import {
  formatDate,
  formatDateTime,
  formatLabel,
  formatMoney,
  formatTime,
} from "../format";
import type {
  ClientBookingRecord,
  ClientNoteRecord,
  ClientPrivacyRequestRecord,
  ClientRecord,
} from "../types";
import { ClientNoteForm, ClientPrivacyRequestForm } from "./ClientDetailForms";

export const metadata = {
  title: "Client Detail - Rahma Therapy Admin",
};

interface ClientDetailPageProps {
  params: Promise<{ clientId: string }>;
}

const CLIENT_SELECT = `
  id,
  full_name,
  phone,
  email,
  address,
  postcode,
  client_source,
  source_detail,
  notes,
  created_at,
  updated_at
`;

const BOOKING_SELECT = `
  id,
  client_id,
  booking_date,
  start_time,
  end_time,
  status,
  payment_status,
  assignment_status,
  group_booking,
  total_price,
  amount_due,
  amount_paid,
  booking_source,
  contact_full_name,
  contact_email,
  contact_phone,
  service_city,
  service_postcode,
  service_address_line1,
  health_notes,
  customer_notes,
  created_at,
  booking_items(service_name_snapshot, service_price_snapshot, service_duration_snapshot),
  booking_participants(display_name, participant_gender, health_notes, participant_notes, consent_acknowledged)
`;

function isFutureBooking(booking: ClientBookingRecord) {
  return new Date(`${booking.booking_date}T${booking.start_time}`) >= new Date();
}

export default async function ClientDetailPage({
  params,
}: ClientDetailPageProps) {
  const { clientId } = await params;
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (
    !profile.permissions.has(PERMISSIONS.MANAGE_CLIENTS) &&
    !profile.permissions.has(PERMISSIONS.VIEW_CLIENTS)
  ) {
    return <InsufficientPermissions />;
  }

  const adminClient = createSupabaseAdminClient();
  const [{ data: client }, { data: bookings }] = await Promise.all([
    adminClient
      .from("clients")
      .select(CLIENT_SELECT)
      .eq("id", clientId)
      .single<ClientRecord>(),
    adminClient
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("client_id", clientId)
      .order("booking_date", { ascending: false })
      .order("start_time", { ascending: false })
      .returns<ClientBookingRecord[]>(),
  ]);

  if (!client) notFound();

  const bookingHistory = bookings ?? [];
  const upcomingCount = bookingHistory.filter(isFutureBooking).length;
  const completedCount = bookingHistory.filter(
    (booking) => booking.status === "completed"
  ).length;
  const pastBookings = bookingHistory.filter((booking) => !isFutureBooking(booking));
  const upcomingBookings = bookingHistory.filter(isFutureBooking);
  const totalSpend = bookingHistory.reduce(
    (total, booking) => total + Number(booking.amount_paid ?? 0),
    0
  );
  const lastVisit = pastBookings[0];
  const commonServices = getCommonServices(bookingHistory);
  const canManageClients = profile.permissions.has(PERMISSIONS.MANAGE_CLIENTS);
  const canManagePrivacyOperations = profile.permissions.has(
    PERMISSIONS.MANAGE_PRIVACY_OPERATIONS
  );
  const canViewSensitiveClientData = canManageClients;

  let clientNotes: ClientNoteRecord[] = [];
  let privacyRequests: ClientPrivacyRequestRecord[] = [];
  let auditLogs: { id: string; action_type: string; created_at: string }[] = [];

  if (canViewSensitiveClientData) {
    const [clientNotesResult, privacyRequestsResult] = await Promise.all([
      adminClient
        .from("client_notes")
        .select("id, note, is_sensitive, created_at, staff_profiles(name)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .returns<ClientNoteRecord[]>(),
      adminClient
        .from("client_privacy_requests")
        .select("id, request_type, status, request_note, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .returns<ClientPrivacyRequestRecord[]>(),
    ]);
    clientNotes = clientNotesResult.data ?? [];
    privacyRequests = privacyRequestsResult.data ?? [];

    const auditTargetIds = [
      clientId,
      ...clientNotes.map((note) => note.id),
      ...privacyRequests.map((request) => request.id),
    ];
    const { data: auditEvents } = await adminClient
      .from("audit_logs")
      .select("id, action_type, created_at")
      .in("target_id", auditTargetIds)
      .order("created_at", { ascending: false })
      .limit(10);
    auditLogs = auditEvents ?? [];
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/clients"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--rahma-muted)] transition-colors hover:text-[var(--rahma-green)]"
        >
          <ArrowLeft className="size-4" />
          Back to clients
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
              {client.full_name}
            </h1>
            <p className="mt-1 text-sm text-[var(--rahma-muted)]">
              Client since {formatDateTime(client.created_at)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/bookings/new?clientId=${client.id}`}
              className={cn(buttonVariants({ size: "sm" }), "min-h-10")}
            >
              <Plus className="size-4" />
              Create booking
            </Link>
            {bookingHistory.length > 1 ? <StatusBadge value="repeat client" /> : null}
            <StatusBadge value={client.client_source} muted />
            <StatusBadge value={`${bookingHistory.length} booking${bookingHistory.length === 1 ? "" : "s"}`} muted />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <aside className="grid content-start gap-4">
          <ClientCard client={client} />
          <StatsCard
            bookingCount={bookingHistory.length}
            upcomingCount={upcomingCount}
            completedCount={completedCount}
            totalSpend={totalSpend}
            lastVisit={lastVisit}
            commonServices={commonServices}
          />
          {canViewSensitiveClientData ? (
            <>
              <HealthContextCard bookings={bookingHistory} />
              <NotesCard client={client} notes={clientNotes} />
              {canManagePrivacyOperations ? (
                <PrivacyCard requests={privacyRequests} clientId={client.id} />
              ) : null}
              <AuditCard events={auditLogs} />
            </>
          ) : (
            <AdminPanel
              title="Sensitive CRM context"
              description="Client notes, privacy requests, and health context require client-management permission."
            >
              <ShieldCheck className="mb-3 size-5 text-[var(--rahma-muted)]" />
              <p className="text-sm text-[var(--rahma-muted)]">
                Sensitive data is hidden for this role.
              </p>
            </AdminPanel>
          )}
        </aside>

        <section
          className="rounded-2xl border bg-white p-6"
          style={{
            borderColor: "var(--rahma-border)",
            boxShadow: "var(--shadow-soft-token)",
          }}
        >
          <div className="mb-5">
            <h2 className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
              Booking History
            </h2>
            <p className="mt-1 text-sm text-[var(--rahma-muted)]">
              Booking-specific snapshots connected to this client.
            </p>
          </div>

          {bookingHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--rahma-border)] px-5 py-12 text-center">
              <CalendarCheck className="mx-auto mb-3 size-10 text-[var(--rahma-muted)]/30" />
              <p className="font-medium text-[var(--rahma-charcoal)]">
                No bookings yet
              </p>
            </div>
          ) : (
            <div className="grid gap-6">
              <BookingGroup title="Upcoming bookings" bookings={upcomingBookings} />
              <BookingGroup title="Past bookings" bookings={pastBookings} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ClientCard({ client }: { client: ClientRecord }) {
  return (
    <Card title="Contact" icon={<UserSquare className="size-5" />}>
      <div className="grid gap-3 text-sm text-[var(--rahma-muted)]">
        <p className="flex items-center gap-2">
          <Phone className="size-4" />
          {client.phone ?? "No phone"}
        </p>
        <p className="flex items-center gap-2">
          <Mail className="size-4" />
          {client.email ?? "No email"}
        </p>
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4" />
          <div>
            <p>{client.address ?? "No address"}</p>
            <p>{client.postcode ?? "No postcode"}</p>
          </div>
        </div>
        <Row label="Source">{formatLabel(client.client_source)}</Row>
        {client.source_detail ? <Row label="Source detail">{client.source_detail}</Row> : null}
      </div>
    </Card>
  );
}

function StatsCard({
  bookingCount,
  upcomingCount,
  completedCount,
  totalSpend,
  lastVisit,
  commonServices,
}: {
  bookingCount: number;
  upcomingCount: number;
  completedCount: number;
  totalSpend: number;
  lastVisit?: ClientBookingRecord;
  commonServices: string[];
}) {
  return (
    <Card title="Client Summary" icon={<CalendarCheck className="size-5" />}>
      <dl className="grid gap-3 text-sm">
        <Row label="Total bookings">{bookingCount}</Row>
        <Row label="Upcoming">{upcomingCount}</Row>
        <Row label="Completed">{completedCount}</Row>
        <Row label="Repeat client">{bookingCount > 1 ? "Yes" : "No"}</Row>
        <Row label="Total spend">{formatMoney(totalSpend)}</Row>
        <Row label="Last visit">
          {lastVisit ? `${formatDate(lastVisit.booking_date)} at ${formatTime(lastVisit.start_time)}` : "None"}
        </Row>
        <Row label="Common services">
          {commonServices.join(", ") || "No services yet"}
        </Row>
      </dl>
    </Card>
  );
}

function NotesCard({
  client,
  notes,
}: {
  client: ClientRecord;
  notes: ClientNoteRecord[];
}) {
  return (
    <Card title="Client Notes" icon={<StickyNote className="size-5" />}>
      <p className="whitespace-pre-wrap text-sm text-[var(--rahma-muted)]">
        {client.notes || "No notes."}
      </p>
      <div className="my-4 border-t border-[var(--rahma-border)]" />
      <ClientNoteForm clientId={client.id} />
      <div className="mt-4 grid gap-3">
        {notes.map((note) => (
          <div key={note.id} className="rounded-lg bg-[var(--rahma-ivory)]/70 p-3">
            <p className="whitespace-pre-wrap text-sm text-[var(--rahma-charcoal)]">
              {note.note}
            </p>
            <p className="mt-2 text-xs text-[var(--rahma-muted)]">
              {note.staff_profiles?.name ?? "Unknown staff"} - {formatDateTime(note.created_at)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function HealthContextCard({ bookings }: { bookings: ClientBookingRecord[] }) {
  const notes = bookings.flatMap((booking) => [
    ...(booking.health_notes
      ? [{ label: "Booking health note", value: booking.health_notes }]
      : []),
    ...((booking.booking_participants ?? [])
      .filter((participant) => participant.health_notes || participant.participant_notes)
      .map((participant) => ({
        label: participant.display_name ?? formatLabel(participant.participant_gender),
        value: participant.health_notes ?? participant.participant_notes ?? "",
      }))),
  ]);

  return (
    <Card title="Health and safety context" icon={<ShieldCheck className="size-5" />}>
      {notes.length === 0 ? (
        <p className="text-sm text-[var(--rahma-muted)]">No health or participant safety notes.</p>
      ) : (
        <div className="grid gap-3">
          {notes.slice(0, 6).map((note, index) => (
            <div key={`${note.label}-${index}`} className="rounded-lg bg-[var(--rahma-ivory)]/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
                {note.label}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--rahma-charcoal)]">
                {note.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PrivacyCard({
  requests,
  clientId,
}: {
  requests: ClientPrivacyRequestRecord[];
  clientId: string;
}) {
  return (
    <Card title="Privacy workflow" icon={<ShieldCheck className="size-5" />}>
      <ClientPrivacyRequestForm clientId={clientId} />
      <div className="mt-4 grid gap-2">
        {requests.map((request) => (
          <div key={request.id} className="flex items-start justify-between gap-3 rounded-lg bg-[var(--rahma-ivory)]/70 p-3 text-sm">
            <div>
              <p className="font-medium capitalize text-[var(--rahma-charcoal)]">
                {formatLabel(request.request_type)}
              </p>
              <p className="text-xs text-[var(--rahma-muted)]">
                {formatDateTime(request.created_at)}
              </p>
            </div>
            <AdminStatusBadge value={request.status} tone="warning" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function AuditCard({ events }: { events: { id: string; action_type: string; created_at: string }[] }) {
  return (
    <Card title="Recent audit activity" icon={<ShieldCheck className="size-5" />}>
      {events.length === 0 ? (
        <p className="text-sm text-[var(--rahma-muted)]">No recent client audit activity.</p>
      ) : (
        <div className="grid gap-2 text-sm">
          {events.map((event) => (
            <Row key={event.id} label={formatLabel(event.action_type)}>
              {formatDateTime(event.created_at)}
            </Row>
          ))}
        </div>
      )}
    </Card>
  );
}

function BookingGroup({
  title,
  bookings,
}: {
  title: string;
  bookings: ClientBookingRecord[];
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-[var(--rahma-charcoal)]">
        {title}
      </h3>
      {bookings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--rahma-border)] px-4 py-6 text-center text-sm text-[var(--rahma-muted)]">
          No {title.toLowerCase()}.
        </p>
      ) : (
        <div className="grid gap-3">
          {bookings.map((booking) => (
            <BookingHistoryCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </section>
  );
}

function BookingHistoryCard({ booking }: { booking: ClientBookingRecord }) {
  const serviceNames = Array.from(
    new Set(booking.booking_items.map((item) => item.service_name_snapshot))
  );

  return (
    <Link
      href={`/admin/bookings/${booking.id}`}
      className="rounded-xl border border-[var(--rahma-border)] bg-white/70 p-4 transition-shadow hover:shadow-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <StatusBadge value={booking.status} />
            <StatusBadge value={booking.assignment_status} muted />
            {booking.group_booking ? <StatusBadge value="group booking" muted /> : null}
          </div>
          <p className="font-medium text-[var(--rahma-charcoal)]">
            {formatDate(booking.booking_date)} at {formatTime(booking.start_time)}
          </p>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">
            {serviceNames.join(", ") || "No service snapshots"}
          </p>
          <p className="mt-2 text-xs text-[var(--rahma-muted)]">
            Snapshot: {booking.contact_full_name ?? "No name"} -{" "}
            {booking.contact_email ?? "No email"} - {booking.contact_phone ?? "No phone"}
          </p>
          <p className="mt-1 text-xs text-[var(--rahma-muted)]">
            {booking.service_address_line1 ?? "No address"} {booking.service_city ?? ""}{" "}
            {booking.service_postcode ?? ""}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold text-[var(--rahma-charcoal)]">
            {formatMoney(booking.total_price)}
          </p>
          <p className="capitalize text-[var(--rahma-muted)]">
            {formatLabel(booking.payment_status)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function getCommonServices(bookings: ClientBookingRecord[]) {
  const counts = new Map<string, number>();
  for (const booking of bookings) {
    for (const item of booking.booking_items) {
      counts.set(
        item.service_name_snapshot,
        (counts.get(item.service_name_snapshot) ?? 0) + 1
      );
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([serviceName]) => serviceName);
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border bg-white p-5"
      style={{
        borderColor: "var(--rahma-border)",
        boxShadow: "var(--shadow-soft-token)",
      }}
    >
      <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-[var(--rahma-charcoal)]">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[var(--rahma-muted)]">{label}</dt>
      <dd className="text-right font-medium text-[var(--rahma-charcoal)]">
        {children}
      </dd>
    </div>
  );
}

function StatusBadge({ value, muted }: { value: string; muted?: boolean }) {
  return (
    <Badge
      variant="secondary"
      className={
        muted
          ? "border-none bg-gray-100 text-gray-600 capitalize"
          : "border-none bg-[var(--rahma-green)]/10 text-[var(--rahma-green)] capitalize"
      }
    >
      {formatLabel(value)}
    </Badge>
  );
}

function InsufficientPermissions() {
  return (
    <AdminAccessDenied
      title="Client access limited"
      message="You need client management permission to access this client."
      permission="manage_clients"
    />
  );
}
