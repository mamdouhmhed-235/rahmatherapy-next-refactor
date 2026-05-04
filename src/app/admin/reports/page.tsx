import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, FileText, TrendingUp, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  METRIC_DEFINITIONS,
  canViewRevenueReports,
  formatMoney,
  formatNumber,
  getCountBy,
  getReportData,
  getRevenueSeries,
  getServicePerformance,
  getStaffRevenueAttribution,
  getStaffWorkload,
  parseReportFilters,
  summarizeReports,
} from "./reporting";
import { CountBarChart, RevenueChart } from "./ReportsCharts";

export const metadata = {
  title: "Reports - Rahma Therapy Admin",
};

interface ReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function canOpenReports(profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>) {
  return (
    profile.permissions.has(PERMISSIONS.VIEW_REPORTS) ||
    profile.permissions.has(PERMISSIONS.VIEW_OWN_BOOKINGS) ||
    profile.permissions.has(PERMISSIONS.MANAGE_BOOKINGS_OWN)
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");
  if (!canOpenReports(profile)) return <InsufficientPermissions />;

  const params = await searchParams;
  const filters = parseReportFilters(params);
  const adminClient = createSupabaseAdminClient();
  const data = await getReportData(adminClient, profile, filters);
  const summary = summarizeReports(data);
  const revenueSeries = getRevenueSeries(data.bookings);
  const servicePerformance = getServicePerformance(data);
  const staffWorkload = getStaffWorkload(data);
  const staffRevenue = getStaffRevenueAttribution(data);
  const revenueAllowed = canViewRevenueReports(profile);
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value)
  ).toString();

  return (
    <div>
      <AdminPageHeader
        title="Reports"
        description="Server-scoped business, client, booking, payment, staff, service, and source reporting."
        actions={
          <Link
            href={`/admin/reports/export?report=revenue_summary&${query}`}
            className={cn(buttonVariants({ size: "sm" }), "min-h-10")}
          >
            <Download className="size-4" />
            Export CSV
          </Link>
        }
      />

      <form action="/admin/reports" className="mb-6">
        <AdminFilterBar className="flex-wrap">
          <Field label="Range">
            <select name="range" defaultValue={filters.range} className="h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm">
              <option value="lifetime">Lifetime</option>
              <option value="year">Yearly</option>
              <option value="month">Monthly</option>
              <option value="week">Weekly</option>
              <option value="custom">Custom</option>
            </select>
          </Field>
          <Field label="From">
            <input name="from" type="date" defaultValue={filters.from} className="h-10 rounded-md border border-[var(--rahma-border)] px-3 text-sm" />
          </Field>
          <Field label="To">
            <input name="to" type="date" defaultValue={filters.to} className="h-10 rounded-md border border-[var(--rahma-border)] px-3 text-sm" />
          </Field>
          <Field label="Staff">
            <select name="staffId" defaultValue={filters.staffId} className="h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm">
              <option value="">All staff</option>
              {data.staff.map((staff) => (
                <option key={staff.id} value={staff.id}>{staff.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Source">
            <select name="source" defaultValue={filters.source} className="h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm">
              <option value="">Any source</option>
              {getCountBy(data.bookings, (booking) => booking.booking_source).map((source) => (
                <option key={source.name} value={source.name}>{source.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Payment">
            <select name="paymentStatus" defaultValue={filters.paymentStatus} className="h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm">
              <option value="">Any payment</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </Field>
          <button className={cn(buttonVariants({ size: "sm" }), "min-h-10")}>Apply</button>
        </AdminFilterBar>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat icon={FileText} label="Bookings" value={formatNumber(summary.bookingCount)} note="Booking records in scope" />
        <AdminStat icon={Users} label="Repeat clients" value={formatNumber(summary.repeatClients)} note={`${formatNumber(summary.newClients)} new clients`} />
        {revenueAllowed ? (
          <>
            <AdminStat icon={TrendingUp} label="Collected revenue" value={formatMoney(summary.collectedRevenue)} note="Actual amount paid" />
            <AdminStat icon={TrendingUp} label="Outstanding" value={formatMoney(summary.outstandingRevenue)} note="Due minus paid" alert={summary.outstandingRevenue > 0} />
          </>
        ) : (
          <AdminPanel title="Revenue hidden" description="This role can see workload metrics, not business-wide revenue.">
            <p className="text-sm text-[var(--rahma-muted)]">Revenue values are hidden for this permission scope.</p>
          </AdminPanel>
        )}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <AdminPanel title="Revenue by period" description="Booked, collected, and outstanding revenue from scoped booking rows.">
          {revenueAllowed ? <RevenueChart data={revenueSeries} /> : <p className="text-sm text-[var(--rahma-muted)]">Revenue chart requires reporting or payment permission.</p>}
        </AdminPanel>
        <AdminPanel title="Bookings by status">
          <CountBarChart data={getCountBy(data.bookings, (booking) => booking.status)} label="Bookings by status chart" />
        </AdminPanel>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        <AdminPanel title="Service performance">
          <Rows rows={servicePerformance.slice(0, 8).map((row) => ({
            label: row.service,
            value: `${row.bookings} bookings${revenueAllowed ? ` · ${formatMoney(row.revenue)}` : ""}`,
          }))} />
        </AdminPanel>
        <AdminPanel title="Staff workload">
          <Rows rows={staffWorkload.slice(0, 8).map((row) => ({
            label: row.staffName,
            value: `${row.assignments} assignments · ${row.completed} completed`,
          }))} />
        </AdminPanel>
        <AdminPanel title="Staff revenue attribution" description="Participant service-item attribution avoids group-booking double-counting.">
          {revenueAllowed ? (
            <Rows rows={staffRevenue.slice(0, 8).map((row) => ({
              label: row.staffName,
              value: formatMoney(row.revenue),
            }))} />
          ) : (
            <p className="text-sm text-[var(--rahma-muted)]">Revenue attribution requires reporting or payment permission.</p>
          )}
        </AdminPanel>
      </section>

      <AdminPanel title="CSV exports" description="Default exports exclude health notes, treatment notes, admin notes, consent details, and raw audit payloads." className="mt-6">
        <div className="flex flex-wrap gap-2">
          {[
            ["revenue_summary", "Revenue summary"],
            ["client_summary", "Client summary"],
            ["booking_list", "Booking list"],
            ["payment_report", "Payment report"],
            ["staff_workload_report", "Staff workload"],
            ["staff_revenue_attribution_report", "Staff revenue attribution"],
            ["service_performance_report", "Service performance"],
            ["source_channel_report", "Source/channel"],
          ].map(([report, label]) => (
            <Link
              key={report}
              href={`/admin/reports/export?report=${report}&${query}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-9")}
            >
              <Download className="size-3" />
              {label}
            </Link>
          ))}
        </div>
      </AdminPanel>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <AdminPanel title="Source/channel report">
          <CountBarChart data={getCountBy(data.bookings, (booking) => booking.booking_source)} label="Bookings by source chart" />
        </AdminPanel>
        <AdminPanel title="Metric definitions">
          <div className="grid gap-3">
            {METRIC_DEFINITIONS.map((metric) => (
              <div key={metric.key} className="rounded-lg bg-[var(--rahma-ivory)]/70 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <AdminStatusBadge value={metric.label} tone="muted" />
                </div>
                <p className="text-sm text-[var(--rahma-muted)]">{metric.definition}</p>
              </div>
            ))}
          </div>
        </AdminPanel>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid min-w-[9rem] gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
      {label}
      {children}
    </label>
  );
}

function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--rahma-muted)]">No records in this range.</p>;
  }

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={`${row.label}-${row.value}`} className="flex items-start justify-between gap-3 rounded-lg bg-[var(--rahma-ivory)]/70 p-3 text-sm">
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
      title="Reports access limited"
      message="You need reporting or own-booking permission to view reports."
      permission="view_reports or view_own_bookings"
    />
  );
}
