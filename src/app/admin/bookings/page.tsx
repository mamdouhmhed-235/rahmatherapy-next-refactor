import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  ChevronRight,
  CreditCard,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/rbac";
import {
  canClaimAssignments,
  canManageAllBookings,
  canManageBookings,
  hasClaimableAssignment,
  isOwnBooking,
} from "./access";
import { formatDate, formatLabel, formatMoney, formatTime } from "./format";
import type { BookingRecord } from "./types";

export const metadata = {
  title: "Bookings - Rahma Therapy Admin",
};

const BOOKING_SELECT = `
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
  consent_acknowledged,
  customer_notes,
  health_notes,
  customer_manage_notes,
  admin_notes,
  treatment_notes,
  created_at,
  clients(full_name, phone, email),
  booking_participants(id, participant_gender, required_therapist_gender, is_main_contact),
  booking_items(id, booking_participant_id, service_name_snapshot, service_price_snapshot, service_duration_snapshot),
  booking_assignments(id, participant_id, assigned_staff_id, required_therapist_gender, status, staff_profiles(name))
`;

async function getManageableBookingIds(profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>) {
  const adminClient = createSupabaseAdminClient();
  const { data: assignedRows } = await adminClient
    .from("booking_assignments")
    .select("booking_id")
    .eq("assigned_staff_id", profile.id);

  const claimableRows = canClaimAssignments(profile)
    ? (
        await adminClient
          .from("booking_assignments")
          .select("booking_id")
          .eq("status", "unassigned")
          .is("assigned_staff_id", null)
          .eq("required_therapist_gender", profile.gender)
      ).data ?? []
    : [];

  return Array.from(
    new Set(
      [...(assignedRows ?? []), ...claimableRows].map(
        (assignment) => assignment.booking_id as string
      )
    )
  );
}

export default async function BookingsPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!canManageBookings(profile)) {
    return <InsufficientPermissions />;
  }

  const adminClient = createSupabaseAdminClient();
  const canViewAll = canManageAllBookings(profile);
  const manageableIds = canViewAll
    ? null
    : await getManageableBookingIds(profile);

  const bookings =
    manageableIds?.length === 0
      ? []
      : (
          await (manageableIds
            ? adminClient
                .from("bookings")
                .select(BOOKING_SELECT)
                .in("id", manageableIds)
                .order("booking_date", { ascending: false })
                .order("start_time", { ascending: false })
                .returns<BookingRecord[]>()
            : adminClient
                .from("bookings")
                .select(BOOKING_SELECT)
                .order("booking_date", { ascending: false })
                .order("start_time", { ascending: false })
                .returns<BookingRecord[]>())
        ).data ?? [];

  return (
    <div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
            Bookings
          </h1>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">
            View booking requests, participant breakdowns, assignment status,
            and payment lifecycle.
          </p>
        </div>
        <Badge
          variant="secondary"
          className="border-none bg-[var(--rahma-green)]/10 text-[var(--rahma-green)]"
        >
          {canViewAll ? "All bookings" : "Assigned bookings"}
        </Badge>
      </div>

      {bookings.length === 0 ? (
        <div
          className="rounded-2xl border-2 border-dashed bg-white/50 px-6 py-20 text-center"
          style={{ borderColor: "var(--rahma-border)" }}
        >
          <CalendarCheck className="mx-auto mb-4 size-12 text-[var(--rahma-muted)]/30" />
          <h2 className="text-lg font-semibold text-[var(--rahma-charcoal)]">
            No bookings found
          </h2>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">
            New booking requests will appear here once customers submit them.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {bookings.map((booking) => (
            <BookingListCard
              key={booking.id}
              booking={booking}
              ownBooking={isOwnBooking(booking, profile)}
              claimableBooking={hasClaimableAssignment(booking, profile)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingListCard({
  booking,
  ownBooking,
  claimableBooking,
}: {
  booking: BookingRecord;
  ownBooking: boolean;
  claimableBooking: boolean;
}) {
  const participantCount = booking.booking_participants.length;
  const serviceNames = Array.from(
    new Set(
      booking.booking_items.map((item) => item.service_name_snapshot)
    )
  );

  return (
    <Link
      href={`/admin/bookings/${booking.id}`}
      className="group rounded-2xl border bg-white p-5 transition-shadow duration-150 hover:shadow-card"
      style={{
        borderColor: "var(--rahma-border)",
        boxShadow: "var(--shadow-soft-token)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-[var(--rahma-charcoal)]">
              {booking.clients?.full_name ?? "Unknown client"}
            </h2>
            <StatusBadge value={booking.status} />
            <StatusBadge value={booking.assignment_status} muted />
            {ownBooking ? <StatusBadge value="assigned to you" muted /> : null}
            {claimableBooking ? <StatusBadge value="claimable" muted /> : null}
          </div>
          <p className="text-sm text-[var(--rahma-muted)]">
            {formatDate(booking.booking_date)} at {formatTime(booking.start_time)}
            {" - "}
            {serviceNames.join(", ") || "No service snapshots"}
          </p>
        </div>
        <ChevronRight className="mt-1 size-5 text-[var(--rahma-muted)] transition-transform group-hover:translate-x-1" />
      </div>

      <div className="mt-4 grid gap-3 border-t border-[var(--rahma-border)] pt-4 sm:grid-cols-4">
        <Meta icon={<Users className="size-4" />} label="Participants">
          {participantCount} {participantCount === 1 ? "person" : "people"}
          {booking.group_booking ? " - group" : ""}
        </Meta>
        <Meta icon={<CalendarCheck className="size-4" />} label="Time">
          {formatTime(booking.start_time)}-{formatTime(booking.end_time)}
        </Meta>
        <Meta icon={<CreditCard className="size-4" />} label="Payment">
          {formatLabel(booking.payment_status)}
          {booking.payment_method ? ` / ${booking.payment_method}` : ""}
        </Meta>
        <Meta label="Total">{formatMoney(booking.total_price)}</Meta>
      </div>
    </Link>
  );
}

function Meta({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-sm">
      <p className="mb-1 flex items-center gap-1.5 font-medium text-[var(--rahma-charcoal)]">
        {icon}
        {label}
      </p>
      <p className="capitalize text-[var(--rahma-muted)]">{children}</p>
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
        Bookings
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
          You need booking management permission to access this page.
        </p>
      </div>
    </div>
  );
}
