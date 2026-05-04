import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  MailWarning,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addBusinessDays, getBusinessDate } from "@/lib/time/london";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminFilterBar,
  AdminPageHeader,
  AdminPanel,
  AdminStat,
  AdminStatusBadge,
} from "../components/admin-ui";
import { cn } from "@/lib/utils";
import {
  canViewRevenueReports,
  formatMoney,
  formatNumber,
  getAttentionItems,
  getReportData,
  getServicePerformance,
  getStaffWorkload,
  parseReportFilters,
  summarizeReports,
} from "../reports/reporting";

export const metadata = {
  title: "Dashboard - Rahma Therapy Admin",
};

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function canViewDashboard(
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>
) {
  return (
    profile.permissions.has(PERMISSIONS.VIEW_DASHBOARD) ||
    profile.permissions.has(PERMISSIONS.VIEW_REPORTS) ||
    profile.permissions.has(PERMISSIONS.VIEW_OWN_BOOKINGS)
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");
  if (!canViewDashboard(profile)) return <InsufficientPermissions />;

  const today = getBusinessDate();
  const params = await searchParams;
  const filters = parseReportFilters({
    range: params.range ?? "week",
    from: params.from ?? today,
    to: params.to ?? addBusinessDays(today, 7),
  });
  const adminClient = createSupabaseAdminClient();
  const data = await getReportData(adminClient, profile, filters);
  const summary = summarizeReports(data);
  const attentionItems = getAttentionItems(data);
  const todayAppointments = data.bookings.filter(
    (booking) => booking.booking_date === today
  );
  const nextSevenDays = data.bookings.filter(
    (booking) => booking.booking_date >= today && booking.booking_date <= addBusinessDays(today, 7)
  );
  const needsAssignment = data.bookings.filter((booking) =>
    ["unassigned", "partially_assigned"].includes(booking.assignment_status)
  );
  const rescheduleRequests = data.bookings.filter(
    (booking) => booking.reschedule_status === "requested"
  );
  const cancellationRequests = data.bookings.filter(
    (booking) => booking.customer_cancelled_at
  );
  const unpaidBookings = data.bookings.filter(
    (booking) => booking.payment_status === "unpaid"
  );
  const failedEmails = data.emailEvents.filter(
    (event) => event.delivery_status === "failed"
  );
  const openOperationalErrors = data.operationalEvents.filter(
    (event) => event.status === "open"
  );
  const staffWorkload = getStaffWorkload(data);
  const services = getServicePerformance(data);
  const revenueAllowed = canViewRevenueReports(profile);

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        description="Action-first operational view for today, upcoming work, assignments, payment follow-up, and system attention."
        actions={
          <Badge
            variant="secondary"
            className="border-none bg-[var(--rahma-green)]/10 text-[var(--rahma-green)]"
          >
            {profile.role_name}
          </Badge>
        }
      />

      <form action="/admin/dashboard">
        <AdminFilterBar>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
            From
            <input name="from" type="date" defaultValue={filters.from} className="h-10 rounded-md border border-[var(--rahma-border)] px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
            To
            <input name="to" type="date" defaultValue={filters.to} className="h-10 rounded-md border border-[var(--rahma-border)] px-3 text-sm" />
          </label>
          <button className={cn(buttonVariants({ size: "sm" }), "min-h-10")}>Apply</button>
          <Link href="/admin/reports" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-10")}>
            Reports
          </Link>
          <Link href="/admin/calendar" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-10")}>
            Calendar
          </Link>
        </AdminFilterBar>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat icon={CalendarCheck} label="Today's appointments" value={formatNumber(todayAppointments.length)} note="Action priority for the day" />
        <AdminStat icon={AlertCircle} label="Needs assignment" value={formatNumber(needsAssignment.length)} note={`${rescheduleRequests.length} reschedule request(s)`} alert={needsAssignment.length > 0 || rescheduleRequests.length > 0} />
        <AdminStat icon={CreditCard} label="Unpaid bookings" value={formatNumber(unpaidBookings.length)} note={revenueAllowed ? `${formatMoney(summary.outstandingRevenue)} outstanding` : "Payment follow-up"} alert={unpaidBookings.length > 0} />
        <AdminStat icon={ClipboardList} label="Operational errors" value={formatNumber(openOperationalErrors.length + failedEmails.length)} note="Open events and failed emails" alert={openOperationalErrors.length + failedEmails.length > 0} />
        <AdminStat icon={CalendarCheck} label="Upcoming next 7 days" value={formatNumber(nextSevenDays.length)} note="Calendar-visible work" />
        <AdminStat icon={Users} label="Repeat clients" value={formatNumber(summary.repeatClients)} note={`${summary.newClients} new in range`} />
        <AdminStat icon={CreditCard} label="Completed revenue" value={revenueAllowed ? formatMoney(summary.completedRevenue) : "Hidden"} note="Paid/completed booking revenue" />
        <AdminStat icon={MailWarning} label="New enquiries" value={formatNumber(data.enquiries.filter((item) => item.status === "new").length)} note="Uncontacted leads" alert={data.enquiries.some((item) => item.status === "new")} />
        <AdminStat
          icon={AlertCircle}
          label="No-show/cancelled"
          value={formatNumber(data.bookings.filter((booking) => ["cancelled", "no_show"].includes(booking.status)).length)}
          note={`${cancellationRequests.length} customer cancellation request(s)`}
          alert={cancellationRequests.length > 0}
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminPanel
          title="Attention queue"
          description="Only high-signal items that need action."
          badge={<AdminStatusBadge value={`${attentionItems.length} open`} tone={attentionItems.length > 0 ? "danger" : "success"} />}
        >
          <div className="divide-y divide-[var(--rahma-border)]">
            {attentionItems.slice(0, 10).map((item) => (
              <Link key={item.id} href={item.href} className="flex items-start justify-between gap-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--rahma-charcoal)]">{item.label}</p>
                  <p className="mt-1 truncate text-xs text-[var(--rahma-muted)]">{item.detail}</p>
                </div>
                <AdminStatusBadge value={item.date} tone={item.tone} />
              </Link>
            ))}
            {attentionItems.length === 0 ? <p className="py-8 text-center text-sm text-[var(--rahma-muted)]">No urgent operational items.</p> : null}
          </div>
        </AdminPanel>

        <AdminPanel title="Today's agenda">
          <div className="grid gap-2">
            {todayAppointments.slice(0, 8).map((booking) => (
              <Link key={booking.id} href={`/admin/bookings/${booking.id}`} className="rounded-lg bg-[var(--rahma-ivory)]/70 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-[var(--rahma-charcoal)]">{booking.start_time.slice(0, 5)}</span>
                  <AdminStatusBadge value={booking.assignment_status} tone={booking.assignment_status === "fully_assigned" ? "success" : "warning"} />
                </div>
                <p className="mt-1 text-[var(--rahma-muted)]">{booking.contact_full_name ?? "Unknown contact"} · {booking.service_city ?? "No city"}</p>
              </Link>
            ))}
            {todayAppointments.length === 0 ? <p className="text-sm text-[var(--rahma-muted)]">No appointments today.</p> : null}
          </div>
        </AdminPanel>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <AdminPanel title="Staff workload">
          <Rows rows={staffWorkload.slice(0, 6).map((row) => ({
            label: row.staffName,
            value: `${row.assignments} assignment(s)`,
          }))} />
        </AdminPanel>
        <AdminPanel title="Most booked services">
          <Rows rows={services.slice(0, 6).map((row) => ({
            label: row.service,
            value: `${row.bookings} booking(s)${revenueAllowed ? ` · ${formatMoney(row.revenue)}` : ""}`,
          }))} />
        </AdminPanel>
      </section>
    </div>
  );
}

function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--rahma-muted)]">No records in range.</p>;
  }
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-4 rounded-lg bg-[var(--rahma-ivory)]/70 p-3 text-sm">
          <span className="min-w-0 truncate font-medium text-[var(--rahma-charcoal)]">{row.label}</span>
          <span className="shrink-0 text-[var(--rahma-muted)]">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function InsufficientPermissions() {
  return (
    <AdminAccessDenied
      title="Dashboard access limited"
      message="You need dashboard, reporting, or own-booking permission to view this area."
      permission="view_dashboard or view_reports"
    />
  );
}
