import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  StickyNote,
  UserSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import type { ClientBookingRecord, ClientRecord } from "../types";

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
  service_city,
  service_postcode,
  created_at,
  booking_items(service_name_snapshot, service_price_snapshot, service_duration_snapshot)
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

  if (!profile.permissions.has(PERMISSIONS.MANAGE_CLIENTS)) {
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
          <div className="flex flex-wrap gap-2">
            {bookingHistory.length > 1 ? <StatusBadge value="repeat client" /> : null}
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
          />
          <NotesCard client={client} />
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
              Past and future booking requests connected to this client.
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
            <div className="grid gap-3">
              {bookingHistory.map((booking) => (
                <BookingHistoryCard key={booking.id} booking={booking} />
              ))}
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
      </div>
    </Card>
  );
}

function StatsCard({
  bookingCount,
  upcomingCount,
  completedCount,
}: {
  bookingCount: number;
  upcomingCount: number;
  completedCount: number;
}) {
  return (
    <Card title="Client Summary" icon={<CalendarCheck className="size-5" />}>
      <dl className="grid gap-3 text-sm">
        <Row label="Total bookings">{bookingCount}</Row>
        <Row label="Upcoming">{upcomingCount}</Row>
        <Row label="Completed">{completedCount}</Row>
        <Row label="Repeat client">{bookingCount > 1 ? "Yes" : "No"}</Row>
      </dl>
    </Card>
  );
}

function NotesCard({ client }: { client: ClientRecord }) {
  return (
    <Card title="Client Notes" icon={<StickyNote className="size-5" />}>
      <p className="whitespace-pre-wrap text-sm text-[var(--rahma-muted)]">
        {client.notes || "No notes."}
      </p>
    </Card>
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
    <div>
      <h1 className="mb-2 font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
        Clients
      </h1>
      <div
        className="mt-6 rounded-2xl border bg-white px-6 py-8 text-center"
        style={{ borderColor: "var(--rahma-border)" }}
      >
        <ShieldCheck className="mx-auto mb-3 size-8 text-[var(--rahma-muted)]" />
        <p className="font-medium text-[var(--rahma-charcoal)]">
          Insufficient permissions
        </p>
        <p className="mt-1 text-sm text-[var(--rahma-muted)]">
          You need client management permission to access this client.
        </p>
      </div>
    </div>
  );
}
