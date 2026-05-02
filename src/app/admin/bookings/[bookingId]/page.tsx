import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  MapPin,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/rbac";
import {
  canManageAllBookings,
  canManageBookings,
  isOwnBooking,
} from "../access";
import { BookingManagementForm } from "../BookingManagementForm";
import { formatDate, formatLabel, formatMoney, formatTime } from "../format";
import type { BookingRecord } from "../types";

export const metadata = {
  title: "Booking Detail - Rahma Therapy Admin",
};

const BOOKING_DETAIL_SELECT = `
  id,
  booking_date,
  start_time,
  end_time,
  total_duration_mins,
  total_price,
  status,
  payment_status,
  payment_method,
  assignment_status,
  group_booking,
  service_address_line1,
  service_address_line2,
  service_city,
  service_postcode,
  access_notes,
  customer_notes,
  customer_manage_notes,
  admin_notes,
  created_at,
  clients(full_name, phone, email),
  booking_participants(id, participant_gender, required_therapist_gender, is_main_contact),
  booking_items(id, booking_participant_id, service_name_snapshot, service_price_snapshot, service_duration_snapshot),
  booking_assignments(id, participant_id, assigned_staff_id, required_therapist_gender, status, staff_profiles(name))
`;

interface BookingDetailPageProps {
  params: Promise<{ bookingId: string }>;
}

export default async function BookingDetailPage({
  params,
}: BookingDetailPageProps) {
  const { bookingId } = await params;
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!canManageBookings(profile)) {
    return <InsufficientPermissions />;
  }

  const adminClient = createSupabaseAdminClient();
  const { data: booking } = await adminClient
    .from("bookings")
    .select(BOOKING_DETAIL_SELECT)
    .eq("id", bookingId)
    .single<BookingRecord>();

  if (!booking) notFound();

  if (!canManageAllBookings(profile) && !isOwnBooking(booking, profile)) {
    return <InsufficientPermissions />;
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/bookings"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--rahma-muted)] transition-colors hover:text-[var(--rahma-green)]"
        >
          <ArrowLeft className="size-4" />
          Back to bookings
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
              {booking.clients?.full_name ?? "Unknown client"}
            </h1>
            <p className="mt-1 text-sm text-[var(--rahma-muted)]">
              {formatDate(booking.booking_date)} at{" "}
              {formatTime(booking.start_time)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge value={booking.status} />
            <StatusBadge value={booking.assignment_status} muted />
            {booking.group_booking ? <StatusBadge value="group booking" muted /> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid gap-6">
          <BookingManagementForm booking={booking} />
          <ParticipantBreakdown booking={booking} />
          <ServiceSnapshots booking={booking} />
          <Notes booking={booking} />
        </div>

        <aside className="grid content-start gap-4">
          <SummaryCard booking={booking} />
          <ClientCard booking={booking} />
          <AddressCard booking={booking} />
        </aside>
      </div>
    </div>
  );
}

function SummaryCard({ booking }: { booking: BookingRecord }) {
  return (
    <Card title="Booking Summary" icon={<CalendarCheck className="size-5" />}>
      <dl className="grid gap-3 text-sm">
        <Row label="Date">{formatDate(booking.booking_date)}</Row>
        <Row label="Time">
          {formatTime(booking.start_time)}-{formatTime(booking.end_time)}
        </Row>
        <Row label="Duration">{booking.total_duration_mins ?? 0} mins</Row>
        <Row label="Total">{formatMoney(booking.total_price)}</Row>
        <Row label="Payment">
          {formatLabel(booking.payment_status)}
          {booking.payment_method ? ` / ${booking.payment_method}` : ""}
        </Row>
      </dl>
    </Card>
  );
}

function ClientCard({ booking }: { booking: BookingRecord }) {
  return (
    <Card title="Client" icon={<Users className="size-5" />}>
      <div className="grid gap-2 text-sm text-[var(--rahma-muted)]">
        <p className="font-medium text-[var(--rahma-charcoal)]">
          {booking.clients?.full_name ?? "Unknown client"}
        </p>
        <p>{booking.clients?.email ?? "No email"}</p>
        <p>{booking.clients?.phone ?? "No phone"}</p>
      </div>
    </Card>
  );
}

function AddressCard({ booking }: { booking: BookingRecord }) {
  return (
    <Card title="Home Visit" icon={<MapPin className="size-5" />}>
      <div className="grid gap-1 text-sm text-[var(--rahma-muted)]">
        <p>{booking.service_address_line1 ?? "No address line"}</p>
        {booking.service_address_line2 ? <p>{booking.service_address_line2}</p> : null}
        <p>{booking.service_city ?? "No city"}</p>
        <p>{booking.service_postcode ?? "No postcode"}</p>
        {booking.access_notes ? (
          <p className="pt-2 text-[var(--rahma-charcoal)]">
            Area/access: {booking.access_notes}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function ParticipantBreakdown({ booking }: { booking: BookingRecord }) {
  return (
    <SectionCard
      title="Participants & Assignments"
      icon={<UserCheck className="size-5" />}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {booking.booking_participants.map((participant, index) => {
          const assignment = booking.booking_assignments.find(
            (item) => item.participant_id === participant.id
          );
          const items = booking.booking_items.filter(
            (item) => item.booking_participant_id === participant.id
          );

          return (
            <article
              key={participant.id}
              className="rounded-xl border border-[var(--rahma-border)] bg-white/70 p-4"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-[var(--rahma-charcoal)]">
                  Person {index + 1}
                </h3>
                {participant.is_main_contact ? (
                  <StatusBadge value="main contact" muted />
                ) : null}
              </div>
              <dl className="grid gap-2 text-sm">
                <Row label="Participant">
                  {formatLabel(participant.participant_gender)}
                </Row>
                <Row label="Required therapist">
                  {formatLabel(participant.required_therapist_gender)}
                </Row>
                <Row label="Assignment">
                  {formatLabel(assignment?.status ?? "unassigned")}
                </Row>
                <Row label="Assigned staff">
                  {assignment?.staff_profiles?.name ?? "Unassigned"}
                </Row>
              </dl>
              <div className="mt-3 border-t border-[var(--rahma-border)] pt-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
                  Service snapshots
                </p>
                <ul className="grid gap-1 text-sm text-[var(--rahma-muted)]">
                  {items.map((item) => (
                    <li key={item.id}>
                      {item.service_name_snapshot} -{" "}
                      {formatMoney(item.service_price_snapshot)}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </SectionCard>
  );
}

function ServiceSnapshots({ booking }: { booking: BookingRecord }) {
  const totalsByService = new Map<string, { count: number; price: number }>();
  for (const item of booking.booking_items) {
    const current = totalsByService.get(item.service_name_snapshot) ?? {
      count: 0,
      price: 0,
    };
    totalsByService.set(item.service_name_snapshot, {
      count: current.count + 1,
      price: current.price + Number(item.service_price_snapshot),
    });
  }

  return (
    <SectionCard title="Service Snapshots" icon={<CreditCard className="size-5" />}>
      <div className="grid gap-3">
        {[...totalsByService.entries()].map(([name, summary]) => (
          <div
            key={name}
            className="flex items-center justify-between gap-4 rounded-xl border border-[var(--rahma-border)] bg-white/70 px-4 py-3"
          >
            <div>
              <p className="font-medium text-[var(--rahma-charcoal)]">{name}</p>
              <p className="text-sm text-[var(--rahma-muted)]">
                {summary.count} snapshot{summary.count === 1 ? "" : "s"}
              </p>
            </div>
            <p className="font-semibold text-[var(--rahma-charcoal)]">
              {formatMoney(summary.price)}
            </p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function Notes({ booking }: { booking: BookingRecord }) {
  return (
    <SectionCard title="Notes" icon={<ClipboardList className="size-5" />}>
      <div className="grid gap-4 md:grid-cols-3">
        <NoteBlock title="Customer notes" value={booking.customer_notes} />
        <NoteBlock
          title="Customer manage notes"
          value={booking.customer_manage_notes}
        />
        <NoteBlock title="Admin notes" value={booking.admin_notes} />
      </div>
    </SectionCard>
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

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return <Card title={title} icon={icon}>{children}</Card>;
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
      <dd className="text-right font-medium capitalize text-[var(--rahma-charcoal)]">
        {children}
      </dd>
    </div>
  );
}

function NoteBlock({ title, value }: { title: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-[var(--rahma-border)] bg-white/70 p-4">
      <h3 className="mb-2 text-sm font-semibold text-[var(--rahma-charcoal)]">
        {title}
      </h3>
      <p className="whitespace-pre-wrap text-sm text-[var(--rahma-muted)]">
        {value || "No notes."}
      </p>
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
        Booking
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
          You need booking management permission to access this booking.
        </p>
      </div>
    </div>
  );
}
