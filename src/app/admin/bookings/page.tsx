import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  ChevronRight,
  CreditCard,
  MapPin,
  Plus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile } from "@/lib/auth/rbac";
import { AdminAccessDenied } from "../components/admin-ui";
import { BookingActionButton } from "./BookingActionButton";
import { CopyButton } from "./CopyButton";
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

type BookingView =
  | "attention"
  | "today"
  | "upcoming"
  | "unassigned"
  | "partially_assigned"
  | "completed"
  | "cancelled"
  | "all";

const BOOKING_VIEWS: Array<{ key: BookingView; label: string }> = [
  { key: "attention", label: "Needs attention" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "unassigned", label: "Unassigned" },
  { key: "partially_assigned", label: "Partially assigned" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled/no-show" },
  { key: "all", label: "All" },
];

const BOOKING_SELECT = `
  id,
  booking_date,
  start_time,
  end_time,
  total_duration_mins,
  total_price,
  contact_full_name,
  contact_email,
  contact_phone,
  booking_source,
  amount_due,
  amount_paid,
  paid_at,
  payment_note,
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
  customer_cancelled_at,
  customer_cancellation_note,
  last_customer_manage_action_at,
  reschedule_requested_at,
  reschedule_preferred_date,
  reschedule_preferred_time,
  reschedule_note,
  reschedule_status,
  admin_notes,
  treatment_notes,
  created_at,
  clients(full_name, phone, email),
  booking_participants(id, participant_gender, required_therapist_gender, is_main_contact, display_name, participant_notes, health_notes, consent_acknowledged),
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

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getTodayIsoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function filterBookings(
  bookings: BookingRecord[],
  query: Record<string, string | string[] | undefined>
) {
  const view = (getQueryValue(query.view) || "attention") as BookingView;
  const search = getQueryValue(query.search)?.trim().toLowerCase() ?? "";
  const status = getQueryValue(query.status) ?? "";
  const assignmentStatus = getQueryValue(query.assignment_status) ?? "";
  const paymentStatus = getQueryValue(query.payment_status) ?? "";
  const gender = getQueryValue(query.required_gender) ?? "";
  const service = getQueryValue(query.service) ?? "";
  const location = getQueryValue(query.location)?.trim().toLowerCase() ?? "";
  const assignedStaff = getQueryValue(query.assigned_staff) ?? "";
  const from = getQueryValue(query.from) ?? "";
  const to = getQueryValue(query.to) ?? "";
  const today = getTodayIsoDate();

  return bookings.filter((booking) => {
    const matchesView =
      view === "all" ||
      (view === "attention" &&
        (booking.status === "pending" ||
          booking.assignment_status !== "fully_assigned" ||
          booking.reschedule_status === "requested" ||
          Boolean(booking.customer_cancelled_at))) ||
      (view === "today" && booking.booking_date === today) ||
      (view === "upcoming" &&
        booking.booking_date >= today &&
        !["completed", "cancelled", "no_show"].includes(booking.status)) ||
      (view === "unassigned" && booking.assignment_status === "unassigned") ||
      (view === "partially_assigned" &&
        booking.assignment_status === "partially_assigned") ||
      (view === "completed" && booking.status === "completed") ||
      (view === "cancelled" &&
        ["cancelled", "no_show"].includes(booking.status));

    if (!matchesView) return false;
    if (status && booking.status !== status) return false;
    if (assignmentStatus && booking.assignment_status !== assignmentStatus) return false;
    if (paymentStatus && booking.payment_status !== paymentStatus) return false;
    if (from && booking.booking_date < from) return false;
    if (to && booking.booking_date > to) return false;
    if (
      gender &&
      !booking.booking_assignments.some(
        (assignment) => assignment.required_therapist_gender === gender
      )
    ) {
      return false;
    }
    if (
      service &&
      !booking.booking_items.some((item) => item.service_name_snapshot === service)
    ) {
      return false;
    }
    if (
      assignedStaff &&
      !booking.booking_assignments.some(
        (assignment) => assignment.assigned_staff_id === assignedStaff
      )
    ) {
      return false;
    }
    if (
      location &&
      ![
        booking.service_city,
        booking.service_postcode,
        booking.service_address_line1,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(location)
    ) {
      return false;
    }
    if (
      search &&
      ![
        booking.id,
        booking.contact_full_name,
        booking.contact_email,
        booking.contact_phone,
        booking.service_postcode,
        booking.clients?.full_name,
        booking.clients?.email,
        booking.clients?.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search)
    ) {
      return false;
    }

    return true;
  });
}

function queryWithView(view: BookingView) {
  return `/admin/bookings?view=${view}`;
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
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
  const [{ data: services }, { data: staff }] = canViewAll
    ? await Promise.all([
        adminClient
          .from("services")
          .select("slug, name")
          .eq("is_active", true)
          .order("name"),
        adminClient
          .from("staff_profiles")
          .select("id, name")
          .eq("active", true)
          .order("name"),
      ])
    : [{ data: [] }, { data: [] }];
  const filteredBookings = filterBookings(bookings, query);
  const currentView = getQueryValue(query.view) || "attention";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
            Bookings
          </h1>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">
            View booking requests, participant breakdowns, assignment status,
            and payment lifecycle.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className="border-none bg-[var(--rahma-green)]/10 text-[var(--rahma-green)]"
          >
            {canViewAll ? "All bookings" : "Assigned bookings"}
          </Badge>
          {canViewAll ? (
            <Link
              href="/admin/bookings/new"
              className={cn(buttonVariants({ size: "md" }))}
            >
              <Plus className="size-4" />
              Create booking
            </Link>
          ) : null}
        </div>
      </div>

      <BookingOperationsBar
        currentView={currentView as BookingView}
        query={query}
        services={services ?? []}
        staff={staff ?? []}
        canViewAll={canViewAll}
      />

      {filteredBookings.length === 0 ? (
        <div
          className="rounded-2xl border-2 border-dashed bg-white/50 px-6 py-20 text-center"
          style={{ borderColor: "var(--rahma-border)" }}
        >
          <CalendarCheck className="mx-auto mb-4 size-12 text-[var(--rahma-muted)]/30" />
          <h2 className="text-lg font-semibold text-[var(--rahma-charcoal)]">
            No bookings found
          </h2>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">
            Adjust filters or create a new manual booking if this request came
            in by phone, WhatsApp, referral, or walk-in.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredBookings.map((booking) => (
            <BookingListCard
              key={booking.id}
              booking={booking}
              ownBooking={isOwnBooking(booking, profile)}
              claimableBooking={hasClaimableAssignment(booking, profile)}
              canQuickAct={canViewAll}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingOperationsBar({
  currentView,
  query,
  services,
  staff,
  canViewAll,
}: {
  currentView: BookingView;
  query: Record<string, string | string[] | undefined>;
  services: Array<{ slug: string; name: string }>;
  staff: Array<{ id: string; name: string }>;
  canViewAll: boolean;
}) {
  return (
    <div className="mb-5 grid gap-4">
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Booking views">
        {BOOKING_VIEWS.map((view) => (
          <Link
            key={view.key}
            href={queryWithView(view.key)}
            className={
              currentView === view.key
                ? "shrink-0 rounded-lg bg-[var(--rahma-green)] px-3 py-2 text-sm font-medium text-white"
                : "shrink-0 rounded-lg border border-[var(--rahma-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--rahma-muted)] hover:text-[var(--rahma-charcoal)]"
            }
          >
            {view.label}
          </Link>
        ))}
      </nav>

      <form
        action="/admin/bookings"
        className="rounded-2xl border bg-white p-4"
        style={{ borderColor: "var(--rahma-border)" }}
      >
        <input type="hidden" name="view" value={currentView} />
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <FilterInput label="Search" name="search" defaultValue={getQueryValue(query.search)} />
          <FilterInput label="From" name="from" type="date" defaultValue={getQueryValue(query.from)} />
          <FilterInput label="To" name="to" type="date" defaultValue={getQueryValue(query.to)} />
          <FilterSelect label="Status" name="status" defaultValue={getQueryValue(query.status)}>
            <option value="">Any</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No show</option>
          </FilterSelect>
          <FilterSelect
            label="Assignment"
            name="assignment_status"
            defaultValue={getQueryValue(query.assignment_status)}
          >
            <option value="">Any</option>
            <option value="unassigned">Unassigned</option>
            <option value="partially_assigned">Partially assigned</option>
            <option value="fully_assigned">Fully assigned</option>
          </FilterSelect>
          <FilterSelect
            label="Payment"
            name="payment_status"
            defaultValue={getQueryValue(query.payment_status)}
          >
            <option value="">Any</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
          </FilterSelect>
          <FilterSelect
            label="Gender"
            name="required_gender"
            defaultValue={getQueryValue(query.required_gender)}
          >
            <option value="">Any</option>
            <option value="male">Male therapist</option>
            <option value="female">Female therapist</option>
          </FilterSelect>
          <FilterInput
            label="City/postcode"
            name="location"
            defaultValue={getQueryValue(query.location)}
          />
          <FilterSelect label="Service" name="service" defaultValue={getQueryValue(query.service)}>
            <option value="">Any</option>
            {services.map((service) => (
              <option key={service.slug} value={service.name}>
                {service.name}
              </option>
            ))}
          </FilterSelect>
          {canViewAll ? (
            <FilterSelect
              label="Assigned staff"
              name="assigned_staff"
              defaultValue={getQueryValue(query.assigned_staff)}
            >
              <option value="">Any</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </FilterSelect>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit" size="sm">Apply filters</Button>
          <Link
            href="/admin/bookings"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Reset
          </Link>
        </div>
      </form>
    </div>
  );
}

function FilterInput({
  label,
  name,
  type = "text",
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-[var(--rahma-muted)]">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        className="h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm text-[var(--rahma-charcoal)] outline-none focus:ring-2 focus:ring-[var(--rahma-green)]/20"
      />
    </label>
  );
}

function FilterSelect({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-[var(--rahma-muted)]">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm text-[var(--rahma-charcoal)] outline-none focus:ring-2 focus:ring-[var(--rahma-green)]/20"
      >
        {children}
      </select>
    </label>
  );
}

function BookingListCard({
  booking,
  ownBooking,
  claimableBooking,
  canQuickAct,
}: {
  booking: BookingRecord;
  ownBooking: boolean;
  claimableBooking: boolean;
  canQuickAct: boolean;
}) {
  const participantCount = booking.booking_participants.length;
  const serviceNames = Array.from(
    new Set(
      booking.booking_items.map((item) => item.service_name_snapshot)
    )
  );

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [
      booking.service_address_line1,
      booking.service_city,
      booking.service_postcode,
    ]
      .filter(Boolean)
      .join(" ")
  )}`;

  return (
    <article
      className="rounded-2xl border bg-white p-5 transition-shadow duration-150 hover:shadow-card"
      style={{
        borderColor: "var(--rahma-border)",
        boxShadow: "var(--shadow-soft-token)",
      }}
    >
      <div className="group">
        <Link href={`/admin/bookings/${booking.id}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-[var(--rahma-charcoal)]">
                  {booking.contact_full_name || booking.clients?.full_name || "Unknown client"}
                </h2>
                <StatusBadge value={booking.status} />
                <StatusBadge value={booking.assignment_status} muted />
                {ownBooking ? <StatusBadge value="assigned to you" muted /> : null}
                {claimableBooking ? <StatusBadge value="claimable" muted /> : null}
                {booking.reschedule_status === "requested" ? (
                  <StatusBadge value="reschedule requested" muted />
                ) : null}
                {booking.customer_cancelled_at ? (
                  <StatusBadge value="customer cancelled" muted />
                ) : null}
              </div>
              <p className="text-sm text-[var(--rahma-muted)]">
                {formatDate(booking.booking_date)} at {formatTime(booking.start_time)}
                {" - "}
                {serviceNames.join(", ") || "No service snapshots"}
              </p>
            </div>
            <ChevronRight className="mt-1 size-5 text-[var(--rahma-muted)] transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
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
        <Meta label="Source">{formatLabel(booking.booking_source)}</Meta>
        <Meta label="Due">{formatMoney(booking.amount_due ?? booking.total_price)}</Meta>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--rahma-border)] pt-4">
        <a
          href={mapUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
        >
          <MapPin className="size-4" />
          Map
        </a>
        <CopyButton value={booking.contact_phone} label="Phone" />
        <CopyButton value={booking.contact_email} label="Email" />
        {canQuickAct && booking.status === "pending" ? (
          <BookingActionButton bookingId={booking.id} action="confirm">
            Confirm
          </BookingActionButton>
        ) : null}
        {canQuickAct && booking.payment_status !== "paid" ? (
          <BookingActionButton bookingId={booking.id} action="mark_paid">
            Mark paid
          </BookingActionButton>
        ) : null}
        {canQuickAct && !["cancelled", "completed", "no_show"].includes(booking.status) ? (
          <BookingActionButton bookingId={booking.id} action="cancel" variant="outline">
            Cancel
          </BookingActionButton>
        ) : null}
      </div>
    </article>
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
    <AdminAccessDenied
      title="Bookings access limited"
      message="You need booking management permission to access this page."
      permission="manage_bookings_all or manage_bookings_own"
    />
  );
}
