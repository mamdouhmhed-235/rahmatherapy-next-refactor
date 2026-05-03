import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  CalendarCheck,
  CreditCard,
  ShieldCheck,
  Star,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";

export const metadata = {
  title: "Dashboard - Rahma Therapy Admin",
};

type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

type BookingAssignmentStatus =
  | "unassigned"
  | "partially_assigned"
  | "fully_assigned";

type AssignmentStatus =
  | "unassigned"
  | "assigned"
  | "completed"
  | "cancelled"
  | "no_show";

interface DashboardBooking {
  id: string;
  client_id: string;
  booking_date: string;
  start_time: string;
  total_price: number | string | null;
  status: BookingStatus;
  payment_status: "paid" | "unpaid";
  assignment_status: BookingAssignmentStatus;
  clients: { full_name: string } | null;
}

interface DashboardAssignment {
  id: string;
  booking_id: string;
  assigned_staff_id: string | null;
  required_therapist_gender: "male" | "female";
  status: AssignmentStatus;
  staff_profiles: { name: string } | null;
}

interface DashboardBookingItem {
  id: string;
  booking_id: string | null;
  service_name_snapshot: string;
  service_price_snapshot: number | string;
}

interface StaffWorkload {
  staffId: string;
  staffName: string;
  assignmentCount: number;
}

interface ServiceMetric {
  serviceName: string;
  bookingCount: number;
  revenue: number;
}

interface AttentionBooking {
  id: string;
  clientName: string;
  bookingDate: string;
  startTime: string;
  assignmentCount: number;
}

const BOOKING_SELECT = `
  id,
  client_id,
  booking_date,
  start_time,
  total_price,
  status,
  payment_status,
  assignment_status,
  clients(full_name)
`;

const ASSIGNMENT_SELECT = `
  id,
  booking_id,
  assigned_staff_id,
  required_therapist_gender,
  status,
  staff_profiles(name)
`;

const BOOKING_ITEM_SELECT = `
  id,
  booking_id,
  service_name_snapshot,
  service_price_snapshot
`;

function canViewDashboard(
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>
) {
  return (
    profile.permissions.has(PERMISSIONS.VIEW_DASHBOARD) ||
    profile.permissions.has(PERMISSIONS.VIEW_REPORTS)
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

function toAmount(value: number | string | null) {
  return Number(value ?? 0);
}

function getCompletedRevenue(bookings: DashboardBooking[]) {
  return bookings
    .filter((booking) => booking.status === "completed")
    .reduce((total, booking) => total + toAmount(booking.total_price), 0);
}

function getAverageBookingValue(bookings: DashboardBooking[]) {
  if (bookings.length === 0) return 0;
  const total = bookings.reduce(
    (sum, booking) => sum + toAmount(booking.total_price),
    0
  );
  return total / bookings.length;
}

function getStaffWorkload(assignments: DashboardAssignment[]): StaffWorkload[] {
  const workload = new Map<string, StaffWorkload>();

  for (const assignment of assignments) {
    if (
      !assignment.assigned_staff_id ||
      !["assigned", "completed"].includes(assignment.status)
    ) {
      continue;
    }

    const existing = workload.get(assignment.assigned_staff_id);
    workload.set(assignment.assigned_staff_id, {
      staffId: assignment.assigned_staff_id,
      staffName: assignment.staff_profiles?.name ?? "Unknown staff",
      assignmentCount: (existing?.assignmentCount ?? 0) + 1,
    });
  }

  return [...workload.values()]
    .sort((a, b) => b.assignmentCount - a.assignmentCount)
    .slice(0, 5);
}

function getServiceMetrics(items: DashboardBookingItem[]): ServiceMetric[] {
  const metrics = new Map<string, ServiceMetric>();

  for (const item of items) {
    const serviceName = item.service_name_snapshot;
    const existing = metrics.get(serviceName);
    metrics.set(serviceName, {
      serviceName,
      bookingCount: (existing?.bookingCount ?? 0) + 1,
      revenue:
        (existing?.revenue ?? 0) + Number(item.service_price_snapshot ?? 0),
    });
  }

  return [...metrics.values()]
    .sort((a, b) => b.bookingCount - a.bookingCount || b.revenue - a.revenue)
    .slice(0, 5);
}

function getRepeatClientCount(bookings: DashboardBooking[]) {
  const bookingCountsByClient = new Map<string, number>();

  for (const booking of bookings) {
    bookingCountsByClient.set(
      booking.client_id,
      (bookingCountsByClient.get(booking.client_id) ?? 0) + 1
    );
  }

  return [...bookingCountsByClient.values()].filter((count) => count > 1).length;
}

function getAttentionBookings(
  bookings: DashboardBooking[],
  assignments: DashboardAssignment[]
): AttentionBooking[] {
  const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]));
  const countsByBookingId = new Map<string, number>();

  for (const assignment of assignments) {
    if (assignment.status !== "unassigned" || assignment.assigned_staff_id) {
      continue;
    }

    countsByBookingId.set(
      assignment.booking_id,
      (countsByBookingId.get(assignment.booking_id) ?? 0) + 1
    );
  }

  return [...countsByBookingId.entries()]
    .map(([bookingId, assignmentCount]) => {
      const booking = bookingsById.get(bookingId);
      if (!booking) return null;

      return {
        id: booking.id,
        clientName: booking.clients?.full_name ?? "Unknown client",
        bookingDate: booking.booking_date,
        startTime: booking.start_time,
        assignmentCount,
      };
    })
    .filter((booking): booking is AttentionBooking => booking !== null)
    .sort((a, b) => {
      const dateCompare = a.bookingDate.localeCompare(b.bookingDate);
      return dateCompare || a.startTime.localeCompare(b.startTime);
    })
    .slice(0, 5);
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!canViewDashboard(profile)) {
    return <InsufficientPermissions />;
  }

  const adminClient = createSupabaseAdminClient();
  const [
    bookingsResult,
    assignmentsResult,
    bookingItemsResult,
    clientsCountResult,
  ] = await Promise.all([
    adminClient
      .from("bookings")
      .select(BOOKING_SELECT)
      .order("booking_date", { ascending: false })
      .order("start_time", { ascending: false })
      .returns<DashboardBooking[]>(),
    adminClient
      .from("booking_assignments")
      .select(ASSIGNMENT_SELECT)
      .returns<DashboardAssignment[]>(),
    adminClient
      .from("booking_items")
      .select(BOOKING_ITEM_SELECT)
      .returns<DashboardBookingItem[]>(),
    adminClient.from("clients").select("id", { count: "exact", head: true }),
  ]);

  if (bookingsResult.error) throw bookingsResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;
  if (bookingItemsResult.error) throw bookingItemsResult.error;
  if (clientsCountResult.error) throw clientsCountResult.error;

  const bookings = bookingsResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const bookingItems = bookingItemsResult.data ?? [];
  const clientCount = clientsCountResult.count ?? 0;
  const unassignedAssignmentCount = assignments.filter(
    (assignment) =>
      assignment.status === "unassigned" && !assignment.assigned_staff_id
  ).length;
  const partiallyAssignedBookingCount = bookings.filter(
    (booking) => booking.assignment_status === "partially_assigned"
  ).length;
  const fullyAssignedBookingCount = bookings.filter(
    (booking) => booking.assignment_status === "fully_assigned"
  ).length;
  const completedRevenue = getCompletedRevenue(bookings);
  const averageBookingValue = getAverageBookingValue(bookings);
  const repeatClientCount = getRepeatClientCount(bookings);
  const staffWorkload = getStaffWorkload(assignments);
  const serviceMetrics = getServiceMetrics(bookingItems);
  const attentionBookings = getAttentionBookings(bookings, assignments);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">
            Business overview for bookings, assignments, clients, and revenue.
          </p>
        </div>
        <Badge
          variant="secondary"
          className="border-none bg-[var(--rahma-green)]/10 text-[var(--rahma-green)]"
        >
          {profile.role_name}
        </Badge>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={CalendarCheck}
          label="Total bookings"
          value={formatNumber(bookings.length)}
          note={`${formatNumber(
            bookings.filter((booking) => booking.status === "completed").length
          )} completed`}
        />
        <MetricCard
          icon={AlertCircle}
          label="Unassigned assignments"
          value={formatNumber(unassignedAssignmentCount)}
          note="Needs staff claiming"
          alert={unassignedAssignmentCount > 0}
        />
        <MetricCard
          icon={CreditCard}
          label="Completed revenue"
          value={formatMoney(completedRevenue)}
          note="Completed bookings only"
        />
        <MetricCard
          icon={TrendingUp}
          label="Average booking value"
          value={formatMoney(averageBookingValue)}
          note="Across all bookings"
        />
        <MetricCard
          icon={UserCheck}
          label="Fully assigned"
          value={formatNumber(fullyAssignedBookingCount)}
          note="Booking records"
        />
        <MetricCard
          icon={Users}
          label="Partially assigned"
          value={formatNumber(partiallyAssignedBookingCount)}
          note="Booking records"
        />
        <MetricCard
          icon={Users}
          label="Clients"
          value={formatNumber(clientCount)}
          note={`${formatNumber(repeatClientCount)} repeat client${
            repeatClientCount === 1 ? "" : "s"
          }`}
        />
        <MetricCard
          icon={BarChart3}
          label="Booked services"
          value={formatNumber(bookingItems.length)}
          note="Service snapshots"
        />
      </section>

      <section className="mt-8 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title="Needs Attention"
          badge={`${unassignedAssignmentCount} unassigned`}
          badgeAlert={unassignedAssignmentCount > 0}
        >
          {attentionBookings.length === 0 ? (
            <EmptyState message="No unassigned booking assignments." />
          ) : (
            <div className="divide-y divide-[var(--rahma-border)]">
              {attentionBookings.map((booking) => (
                <Link
                  key={booking.id}
                  href={`/admin/bookings/${booking.id}`}
                  className="flex items-center justify-between gap-4 py-4 text-sm transition-colors hover:text-[var(--rahma-green)]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--rahma-charcoal)]">
                      {booking.clientName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--rahma-muted)]">
                      {formatDate(booking.bookingDate)} at{" "}
                      {formatTime(booking.startTime)}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className="shrink-0 border-none bg-red-100 text-red-700"
                  >
                    {booking.assignmentCount} open
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Assignment Status">
          <StatusRow
            label="Unassigned assignments"
            value={unassignedAssignmentCount}
          />
          <StatusRow
            label="Partially assigned bookings"
            value={partiallyAssignedBookingCount}
          />
          <StatusRow
            label="Fully assigned bookings"
            value={fullyAssignedBookingCount}
          />
        </Panel>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Staff Workload">
          {staffWorkload.length === 0 ? (
            <EmptyState message="No assigned staff workload yet." />
          ) : (
            <div className="space-y-3">
              {staffWorkload.map((staff) => (
                <RankedRow
                  key={staff.staffId}
                  label={staff.staffName}
                  value={`${staff.assignmentCount} assignment${
                    staff.assignmentCount === 1 ? "" : "s"
                  }`}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Most Booked Services">
          {serviceMetrics.length === 0 ? (
            <EmptyState message="No booked services yet." />
          ) : (
            <div className="space-y-3">
              {serviceMetrics.map((service) => (
                <RankedRow
                  key={service.serviceName}
                  label={service.serviceName}
                  value={`${service.bookingCount} booked - ${formatMoney(
                    service.revenue
                  )}`}
                />
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
  alert = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  note: string;
  alert?: boolean;
}) {
  return (
    <article
      className="rounded-2xl border bg-white px-5 py-5"
      style={{
        borderColor: alert ? "rgba(220,38,38,0.35)" : "var(--rahma-border)",
        boxShadow: "var(--shadow-soft-token)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--rahma-muted)]">{label}</p>
        <Icon
          className={`size-4 shrink-0 ${
            alert ? "text-red-600" : "text-[var(--rahma-green)]"
          }`}
        />
      </div>
      <p className="mt-3 text-2xl font-semibold text-[var(--rahma-charcoal)]">
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--rahma-muted)]">{note}</p>
    </article>
  );
}

function Panel({
  title,
  badge,
  badgeAlert = false,
  children,
}: {
  title: string;
  badge?: string;
  badgeAlert?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border bg-white px-6 py-6"
      style={{
        borderColor: "var(--rahma-border)",
        boxShadow: "var(--shadow-soft-token)",
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-semibold text-[var(--rahma-charcoal)]">{title}</h2>
        {badge ? (
          <Badge
            variant="secondary"
            className={`border-none ${
              badgeAlert
                ? "bg-red-100 text-red-700"
                : "bg-[var(--rahma-green)]/10 text-[var(--rahma-green)]"
            }`}
          >
            {badge}
          </Badge>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function StatusRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--rahma-border)] py-3 last:border-0">
      <span className="text-sm text-[var(--rahma-muted)]">{label}</span>
      <span className="font-semibold text-[var(--rahma-charcoal)]">
        {formatNumber(value)}
      </span>
    </div>
  );
}

function RankedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-[var(--rahma-ivory)]/70 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <Star className="mt-0.5 size-4 shrink-0 text-[var(--rahma-gold)]" />
        <span className="truncate text-sm font-medium text-[var(--rahma-charcoal)]">
          {label}
        </span>
      </div>
      <span className="shrink-0 text-sm text-[var(--rahma-muted)]">
        {value}
      </span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-[var(--rahma-border)] px-4 py-8 text-center text-sm text-[var(--rahma-muted)]">
      {message}
    </p>
  );
}

function InsufficientPermissions() {
  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
        Dashboard
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
          You need{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            view_dashboard
          </code>{" "}
          or{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            view_reports
          </code>{" "}
          to access this page.
        </p>
      </div>
    </div>
  );
}
