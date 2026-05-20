import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  Briefcase,
  Calculator,
  Download,
  FileText,
  Filter,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canOpenReports, getStaffProfile } from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminFilterBar,
  AdminPageHeader,
  AdminPageScaffold,
  AdminPanel,
  AdminStat,
} from "../components/admin-ui";
import { AdminSheet } from "../components/admin-ui-interactions";
import {
  METRIC_DEFINITIONS,
  canViewRevenueReports,
  hasUniversalReportScope,
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
import { RangeHelper } from "./RangeHelper";

export const metadata = {
  title: "Reports - Rahma Therapy Admin",
};

const RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: "lifetime", label: "Lifetime" },
  { value: "year", label: "Yearly" },
  { value: "month", label: "Monthly" },
  { value: "week", label: "Weekly" },
  { value: "custom", label: "Custom" },
];

const PAYMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any payment" },
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Outstanding" },
  { value: "refunded", label: "Refunded" },
  { value: "waived", label: "Waived" },
];

interface ReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  const universalScope = hasUniversalReportScope(profile);
  // Therapist = the only scope that opens reports but cannot see universal data
  // and cannot see revenue. Anything else (Owner / Admin / Coordinator) keeps
  // staff workload + the broader CSV grouping.
  const isTherapistScope = !revenueAllowed && !universalScope;

  const sourceOptions = getCountBy(
    data.bookings,
    (booking) => booking.booking_source
  )
    .map((row) => row.name)
    .filter((name): name is string => Boolean(name));

  const customRangeError = (() => {
    if (filters.range !== "custom") {
      // Future-date guard applies to any range with explicit dates set.
      return validateFarFutureDate(filters.from, filters.to);
    }
    if (!filters.from || !filters.to) {
      return "Pick a start and end date for a custom range.";
    }
    if (filters.from > filters.to) {
      return "End date must be on or after start date.";
    }
    return validateFarFutureDate(filters.from, filters.to);
  })();

  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => Boolean(value))
  ).toString();

  const activeFilterChips = buildActiveFilterChips({
    filters,
    staff: data.staff,
  });

  const activityCsvChips: { reportKey: string; label: string }[] = [
    { reportKey: "client_summary", label: "Client summary" },
    { reportKey: "booking_list", label: "Booking list" },
    { reportKey: "source_channel_report", label: "Source-channel" },
  ];
  const workloadCsvChips: { reportKey: string; label: string }[] = [
    { reportKey: "staff_workload_report", label: "Staff workload" },
    { reportKey: "service_performance_report", label: "Service performance" },
  ];
  const moneyCsvChips: { reportKey: string; label: string }[] = [
    { reportKey: "revenue_summary", label: "Revenue summary" },
    { reportKey: "payment_report", label: "Payment report" },
    { reportKey: "staff_revenue_attribution_report", label: "Staff revenue attribution" },
  ];

  return (
    <AdminPageScaffold className="gap-8 pb-10 md:pb-0">
      <AdminPageHeader
        title={revenueAllowed ? "Reports" : isTherapistScope ? "My report" : "Reports"}
        description={
          revenueAllowed
            ? "Server-scoped business, client, booking, payment, staff, service, and source reporting."
            : isTherapistScope
              ? "Your workload, completed sessions, and own bookings in the selected range."
              : "Operational reporting for bookings, staff workload, and source/channel."
        }
      />

      {/* Mobile filter sheet (visible <md only). Same GET form contract. */}
      <div className="grid gap-3 md:hidden">
        <div className="flex items-center gap-2">
          <AdminSheet
            title="Filters"
            description="Refine the reports window. Tap Apply to update results."
            side="bottom"
            trigger={
              <button
                type="button"
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-panel)] px-4 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/45"
              >
                <Filter className="size-4" aria-hidden="true" />
                <span className="truncate">
                  Filters
                  <span className="text-[var(--admin-text-muted)]">
                    {" · "}
                    {RANGE_OPTIONS.find((o) => o.value === filters.range)?.label ?? "Monthly"}
                  </span>
                </span>
                {activeFilterChips.length > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--admin-primary)] px-1.5 text-xs font-semibold text-[var(--admin-on-primary)]">
                    {activeFilterChips.length}
                  </span>
                ) : null}
              </button>
            }
          >
            <form action="/admin/reports" className="grid gap-4">
              <FilterField
                label="Range"
                hint={
                  <RangeHelper
                    initialRange={filters.range}
                    initialFrom={filters.from}
                    initialTo={filters.to}
                  />
                }
              >
                <select
                  name="range"
                  data-reports-range="true"
                  defaultValue={filters.range}
                  className="h-11 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                >
                  {RANGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FilterField>
              <div className="grid grid-cols-2 gap-3">
                <FilterField label="From">
                  <input
                    name="from"
                    type="date"
                    defaultValue={filters.from}
                    className="h-11 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                  />
                </FilterField>
                <FilterField label="To">
                  <input
                    name="to"
                    type="date"
                    defaultValue={filters.to}
                    className="h-11 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                  />
                </FilterField>
              </div>
              {!isTherapistScope ? (
                <FilterField label="Staff">
                  <select
                    name="staffId"
                    defaultValue={filters.staffId}
                    className="h-11 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                  >
                    <option value="">All staff</option>
                    {data.staff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                </FilterField>
              ) : null}
              <FilterField label="Source">
                <select
                  name="source"
                  defaultValue={filters.source}
                  className="h-11 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                >
                  <option value="">Any source</option>
                  {sourceOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Payment">
                <select
                  name="paymentStatus"
                  defaultValue={filters.paymentStatus}
                  className="h-11 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                >
                  {PAYMENT_OPTIONS.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FilterField>
              <button
                type="submit"
                className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/45"
              >
                <Filter className="size-4" aria-hidden="true" />
                Apply filters
              </button>
            </form>
          </AdminSheet>
          {activeFilterChips.length > 0 ? (
            <Link
              href="/admin/reports"
              className="inline-flex h-11 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-body)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </div>

      {/* Desktop filter strip (visible md+ only) — GET form. Field names preserved verbatim. */}
      <form action="/admin/reports" className="hidden gap-3 md:grid">
        <AdminFilterBar
          actions={
            <>
              <button
                type="submit"
                className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
              >
                <Filter className="size-3.5" aria-hidden="true" />
                Apply filters
              </button>
              {activeFilterChips.length > 0 ? (
                <Link
                  href="/admin/reports"
                  className="inline-flex h-10 items-center gap-1 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-body)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                >
                  Clear filters
                </Link>
              ) : null}
            </>
          }
        >
          <FilterField label="Range" hint={
            <RangeHelper
              initialRange={filters.range}
              initialFrom={filters.from}
              initialTo={filters.to}
            />
          }>
            <select
              name="range"
              data-reports-range="true"
              defaultValue={filters.range}
              className="h-10 w-full min-w-[9rem] rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="From">
            <input
              name="from"
              type="date"
              defaultValue={filters.from}
              className="h-10 w-full min-w-[8.5rem] rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
            />
          </FilterField>
          <FilterField label="To">
            <input
              name="to"
              type="date"
              defaultValue={filters.to}
              className="h-10 w-full min-w-[8.5rem] rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
            />
          </FilterField>
          {!isTherapistScope ? (
            <FilterField label="Staff">
              <select
                name="staffId"
                defaultValue={filters.staffId}
                className="h-10 w-full min-w-[10rem] rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
              >
                <option value="">All staff</option>
                {data.staff.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
            </FilterField>
          ) : null}
          <FilterField label="Source">
            <select
              name="source"
              defaultValue={filters.source}
              className="h-10 w-full min-w-[10rem] rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
            >
              <option value="">Any source</option>
              {sourceOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Payment">
            <select
              name="paymentStatus"
              defaultValue={filters.paymentStatus}
              className="h-10 w-full min-w-[9rem] rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
            >
              {PAYMENT_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
        </AdminFilterBar>
      </form>

      {/* Filter feedback (visible on all viewports — driven by URL state) */}
      {customRangeError ? (
        <div
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-center gap-1.5 text-xs text-[oklch(26%_0.14_25)]"
        >
          {customRangeError}
        </div>
      ) : null}

      {activeFilterChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilterChips.map((chip) => (
            <ActiveFilterChip key={chip.id} chip={chip} filters={filters} />
          ))}
        </div>
      ) : null}

      {/* Headline stats — Cormorant Garamond numerals via numeral prop. */}
      <section
        aria-label="Headline summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <AdminStat
          icon={FileText}
          label="Bookings"
          value={formatNumber(summary.bookingCount)}
          note="Booking records in scope"
          numeral
        />
        <AdminStat
          icon={Users}
          label="Repeat clients"
          value={formatNumber(summary.repeatClients)}
          note={`${formatNumber(summary.newClients)} new clients`}
          numeral
        />
        {revenueAllowed ? (
          <>
            <AdminStat
              icon={Wallet}
              label="Collected revenue"
              value={formatMoney(summary.collectedRevenue)}
              note="Actual amount paid"
              numeral
            />
            <AdminStat
              icon={TrendingUp}
              label="Outstanding"
              value={formatMoney(summary.outstandingRevenue)}
              note="Due minus paid"
              alert={summary.outstandingRevenue > 0}
              tone={summary.outstandingRevenue > 0 ? "warning" : "default"}
              numeral
            />
          </>
        ) : null}
      </section>

      {/* Section A — Activity */}
      <ReportSection
        icon={Activity}
        heading="Activity"
        framing="How busy the clinic was in this window and where clients came from."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <AdminPanel title="Bookings by status">
            {data.bookings.length === 0 ? (
              <ChartEmpty />
            ) : (
              <CountBarChart
                data={getCountBy(data.bookings, (booking) => booking.status)}
                label="Bookings by status chart"
              />
            )}
          </AdminPanel>
          <AdminPanel title="Source and channel">
            {data.bookings.length === 0 ? (
              <ChartEmpty
                title="No source data"
                body="New leads will show up here as bookings come in."
              />
            ) : (
              <CountBarChart
                data={getCountBy(data.bookings, (booking) => booking.booking_source)}
                label="Bookings by source chart"
              />
            )}
          </AdminPanel>
        </div>
        <CsvExportPanel
          heading="Export Activity data"
          chips={isTherapistScope ? [{ reportKey: "booking_list", label: "Booking list" }] : activityCsvChips}
          query={query}
        />
      </ReportSection>

      {/* Section B — Workload (visible to non-therapist; therapist gets Service performance only) */}
      <ReportSection
        icon={Briefcase}
        heading="Workload"
        framing={
          isTherapistScope
            ? "Which of your services led in this window."
            : "Who carried the load and which services led."
        }
      >
        <div
          className={
            isTherapistScope
              ? "grid gap-4"
              : "grid gap-4 xl:grid-cols-2"
          }
        >
          {!isTherapistScope ? (
            <AdminPanel title="Staff workload">
              <EntityRowList
                rows={staffWorkload}
                limit={8}
                empty={{
                  title: "No staff activity in this range",
                  body: "Nobody had a booking assigned in the selected window.",
                }}
                render={(row, idx) => ({
                  key: `${row.staffName}-${idx}`,
                  leading: <Avatar name={row.staffName} />,
                  title: row.staffName,
                  meta: `${formatNumber(row.assignments)} assignments · ${formatNumber(row.completed)} completed`,
                  htmlTitle: `${row.assignments} assignments, ${row.completed} completed`,
                })}
              />
            </AdminPanel>
          ) : null}
          <AdminPanel title="Service performance">
            <EntityRowList
              rows={servicePerformance}
              limit={8}
              empty={{
                title: "No services booked",
                body: "No services had bookings in the selected window.",
              }}
              render={(row, idx) => ({
                key: `${row.service}-${idx}`,
                leading: <Avatar name={row.service} variant="square" />,
                title: row.service,
                meta:
                  revenueAllowed
                    ? `${formatNumber(row.bookings)} bookings · ${formatMoney(row.revenue)}`
                    : `${formatNumber(row.bookings)} bookings`,
                htmlTitle: revenueAllowed
                  ? `${row.bookings} bookings · ${formatMoney(row.revenue)} collected`
                  : `${row.bookings} bookings`,
              })}
            />
          </AdminPanel>
        </div>
        {!isTherapistScope ? (
          <CsvExportPanel
            heading="Export Workload data"
            chips={workloadCsvChips}
            query={query}
          />
        ) : null}
      </ReportSection>

      {/* Section C — Money (revenue scope only) */}
      {revenueAllowed ? (
        <ReportSection
          icon={Receipt}
          heading="Money"
          framing="What was collected, what's outstanding, and how it splits across staff."
        >
          <AdminPanel title="Revenue by period">
            {revenueSeries.length === 0 ? (
              <ChartEmpty />
            ) : (
              <RevenueChart data={revenueSeries} />
            )}
          </AdminPanel>
          <div className="grid gap-4 xl:grid-cols-2">
            <AdminPanel
              title="Staff revenue attribution"
              description="Participant service-item attribution avoids group-booking double-counting."
            >
              <EntityRowList
                rows={staffRevenue}
                limit={8}
                empty={{
                  title: "No revenue attributed yet",
                  body: "Once bookings are paid, attribution appears here.",
                }}
                render={(row, idx) => ({
                  key: `${row.staffName}-${idx}`,
                  leading: <Avatar name={row.staffName} />,
                  title: row.staffName,
                  meta: formatMoney(row.revenue),
                })}
              />
            </AdminPanel>
            <AdminPanel title="Outstanding vs collected">
              <div className="grid gap-2">
                <CompactStat
                  icon={Wallet}
                  label="Collected"
                  value={formatMoney(summary.collectedRevenue)}
                  note="Actual amount paid"
                  tone="success"
                />
                <CompactStat
                  icon={TrendingUp}
                  label="Outstanding"
                  value={formatMoney(summary.outstandingRevenue)}
                  note="Due minus paid"
                  tone={summary.outstandingRevenue > 0 ? "warning" : "default"}
                />
              </div>
            </AdminPanel>
          </div>
          <CsvExportPanel
            heading="Export Money data"
            chips={moneyCsvChips}
            query={query}
          />
        </ReportSection>
      ) : null}

      {/* How these numbers are calculated. Split into Revenue + Activity
          groups so the 8-pill 4×2 uniform grid breaks into two semantic
          clusters with a thin divider between. */}
      <AdminPanel
        title="How these numbers are calculated"
        description="Each metric is computed from the bookings visible in this window. Expand any row for the definition."
      >
        {(() => {
          const revenueKeys = new Set([
            "booked_revenue",
            "expected_revenue",
            "collected_revenue",
            "outstanding_revenue",
            "completed_revenue",
            "staff_revenue",
          ]);
          const revenueMetrics = METRIC_DEFINITIONS.filter((m) => revenueKeys.has(m.key));
          const activityMetrics = METRIC_DEFINITIONS.filter((m) => !revenueKeys.has(m.key));
          return (
            <>
              <MetricGroupHeading label="Revenue" />
              <div className="grid gap-2 sm:grid-cols-2">
                {revenueMetrics.map(renderMetricDetails)}
              </div>
              <div className="my-5 border-t border-[var(--admin-border)]" aria-hidden="true" />
              <MetricGroupHeading label="Activity" />
              <div className="grid gap-2 sm:grid-cols-2">
                {activityMetrics.map(renderMetricDetails)}
              </div>
            </>
          );
        })()}
      </AdminPanel>
    </AdminPageScaffold>
  );
}

function MetricGroupHeading({ label }: { label: string }) {
  return (
    <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">
      {label}
    </p>
  );
}

function renderMetricDetails(metric: { key: string; label: string; definition: string }) {
  return (
    <details
      key={metric.key}
      className="group rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)]/40 p-3 transition-colors open:border-[var(--admin-primary)]/30 open:bg-[var(--admin-panel)] hover:border-[var(--admin-primary)]/30"
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 outline-none focus-visible:rounded-[var(--admin-radius-control)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/45"
        title="Show how this number is calculated"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[oklch(94%_0.008_280)] px-2.5 py-1 text-xs font-medium text-[oklch(30%_0.02_280)]">
          <Calculator
            className="size-3 transition-transform group-open:rotate-12"
            aria-hidden="true"
          />
          {metric.label}
        </span>
        <span
          aria-hidden="true"
          className="text-xs text-[var(--admin-text-muted)] transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <p className="mt-2 text-xs leading-5 text-[var(--admin-text-muted)]">
        {metric.definition}
      </p>
    </details>
  );
}

// ───────────────────────── Small in-file primitives ──────────────────────────

function FilterField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm">
      <span className="text-xs font-medium text-[var(--admin-heading)]">{label}</span>
      {children}
      {hint}
    </label>
  );
}

function ReportSection({
  icon: Icon,
  heading,
  framing,
  children,
}: {
  icon: React.ElementType;
  heading: string;
  framing: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={heading} className="grid gap-4">
      <header className="min-w-0">
        <h2 className="font-display flex items-center gap-2.5 text-[1.778rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[var(--admin-heading)]">
          <Icon
            className="size-5 shrink-0 text-[var(--admin-primary)]"
            aria-hidden="true"
          />
          {heading}
        </h2>
        <p className="mt-1.5 max-w-[60ch] pl-[1.75rem] text-sm leading-6 text-[var(--admin-text-muted)]">
          {framing}
        </p>
      </header>
      {children}
    </section>
  );
}

function CsvExportPanel({
  heading,
  chips,
  query,
}: {
  heading: string;
  chips: { reportKey: string; label: string }[];
  query: string;
}) {
  return (
    <AdminPanel title={heading} description="CSV downloads use the current filter window." tone="muted">
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <Link
            key={chip.reportKey}
            href={`/admin/reports/export?report=${chip.reportKey}&${query}`}
            download
            aria-label={`Download ${chip.label} as CSV`}
            title={`Download ${chip.label} as CSV`}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-panel)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:border-[var(--admin-primary)]/35 hover:bg-[var(--admin-panel-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
          >
            <Download className="size-3.5" aria-hidden="true" />
            {chip.label}
          </Link>
        ))}
      </div>
    </AdminPanel>
  );
}

interface EntityRowProps {
  key: string;
  leading: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  htmlTitle?: string;
}

function EntityRowList<T>({
  rows,
  limit,
  empty,
  render,
}: {
  rows: T[];
  limit: number;
  empty: { title: string; body: string };
  render: (row: T, index: number) => EntityRowProps;
}) {
  if (rows.length === 0) {
    return (
      <div className="grid gap-1 rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)]/50 px-3 py-4 text-sm">
        <p className="font-medium text-[var(--admin-heading)]">{empty.title}</p>
        <p className="text-xs text-[var(--admin-text-muted)]">{empty.body}</p>
      </div>
    );
  }

  const head = rows.slice(0, limit);
  const tail = rows.slice(limit);

  return (
    <div className="grid gap-2">
      {head.map((row, idx) => {
        const props = render(row, idx);
        return (
          <RowItem key={props.key} props={props} />
        );
      })}
      {tail.length > 0 ? (
        <details className="group">
          <summary
            className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-[var(--admin-radius-control)] px-3 text-xs font-medium text-[var(--admin-primary)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
            title={`Show all ${rows.length} rows`}
          >
            <span className="group-open:hidden">Show all {rows.length} →</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <div className="mt-2 grid gap-2">
            {tail.map((row, idx) => {
              const props = render(row, idx + limit);
              return <RowItem key={props.key} props={props} />;
            })}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function RowItem({ props }: { props: EntityRowProps }) {
  // Flat row inside a panel — surface-page divided lines, not nested cards.
  // (See DESIGN.md "Data Table" + Tonal Lift Rule; AdminEntityRow is preferred
  // when the row stands alone outside an AdminPanel.)
  return (
    <div
      className="flex min-w-0 items-center gap-3 border-b border-[var(--admin-border)] py-3 last:border-b-0"
      title={props.htmlTitle}
    >
      {props.leading}
      <div className="min-w-0 flex-1">
        <p className="min-w-0 truncate text-sm font-medium text-[var(--admin-heading)]">
          {props.title}
        </p>
        {props.meta ? (
          <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">{props.meta}</p>
        ) : null}
      </div>
    </div>
  );
}

// AdminStat-like tile at compact scale (heading step instead of display step).
// Used inside Section C "Outstanding vs collected" so the section anchor reads
// as subordinate to the headline strip rather than re-rendering it (brief §5
// mandates "AdminStat-like tiles stacked, Cormorant numerals"; the LIKE gives
// license for the compact scale).
function CompactStat({
  icon: Icon,
  label,
  value,
  note,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  note: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneClasses =
    tone === "success"
      ? "bg-[oklch(93.5%_0.038_155)] border-[oklch(88%_0.055_155)]"
      : tone === "warning"
        ? "bg-[oklch(95%_0.05_65)] border-[oklch(88%_0.06_65)]"
        : "bg-[var(--admin-panel)] border-[var(--admin-border)]";
  const iconColor =
    tone === "success"
      ? "text-[oklch(22%_0.085_155)]"
      : tone === "warning"
        ? "text-[oklch(26%_0.13_55)]"
        : "text-[var(--admin-primary)]";
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-[var(--admin-radius-control)] border px-3 py-2.5",
        toneClasses
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--admin-text-muted)]">
          <Icon className={cn("size-3.5 shrink-0", iconColor)} aria-hidden="true" />
          {label}
        </div>
        <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">{note}</p>
      </div>
      <p
        className="font-[var(--font-admin-serif),Georgia,serif] text-[1.778rem] font-bold leading-none tracking-[-0.015em] text-[var(--admin-heading)]"
        style={{ fontFamily: "var(--font-admin-serif), Georgia, serif" }}
      >
        {value}
      </p>
    </div>
  );
}

function ChartEmpty({ title, body }: { title?: string; body?: string } = {}) {
  return (
    <div
      className="flex min-h-[288px] w-full flex-col items-center justify-center gap-1 rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)]/40 px-4 text-center text-sm"
      role="status"
    >
      {title ? (
        <p className="font-medium text-[var(--admin-heading)]">{title}</p>
      ) : null}
      <p className="text-[var(--admin-text-muted)]">
        {body ?? "No bookings in this window."}
      </p>
    </div>
  );
}

// Deterministic letter-token avatar; warm Hover-Moss tint via panel-muted token.
function Avatar({ name, variant = "round" }: { name: string; variant?: "round" | "square" }) {
  const letter = (name?.trim()?.[0] ?? "·").toUpperCase();
  return (
    <span
      className={
        variant === "round"
          ? "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[oklch(95.5%_0.012_155)] text-sm font-semibold text-[var(--admin-primary)]"
          : "inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] bg-[oklch(95.5%_0.012_155)] text-sm font-semibold text-[var(--admin-primary)]"
      }
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

// ───────────────────────── Validation helpers ─────────────────────────────────

function validateFarFutureDate(from: string, to: string): string | null {
  const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;
  const horizon = Date.now() + FIVE_YEARS_MS;
  const parsed = [from, to]
    .filter(Boolean)
    .map((value) => new Date(`${value}T00:00:00Z`).getTime());
  if (parsed.some((time) => Number.isFinite(time) && time > horizon)) {
    return "That date is outside the supported range. Reports cover the last 5 years.";
  }
  return null;
}

// ───────────────────────── Active filter chips ────────────────────────────────

type FilterKey = "range" | "from" | "to" | "staffId" | "source" | "paymentStatus";

interface ActiveChip {
  id: FilterKey;
  label: string;
  value: string;
}

function buildActiveFilterChips({
  filters,
  staff,
}: {
  filters: {
    range: string;
    from: string;
    to: string;
    staffId: string;
    source: string;
    paymentStatus: string;
  };
  staff: { id: string; name: string }[];
}): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (filters.range && filters.range !== "month") {
    const label = RANGE_OPTIONS.find((option) => option.value === filters.range)?.label ?? filters.range;
    chips.push({ id: "range", label: "Range", value: label });
  }
  if (filters.range === "custom") {
    if (filters.from) chips.push({ id: "from", label: "From", value: filters.from });
    if (filters.to) chips.push({ id: "to", label: "To", value: filters.to });
  }
  if (filters.staffId) {
    const match = staff.find((s) => s.id === filters.staffId);
    chips.push({ id: "staffId", label: "Staff", value: match?.name ?? filters.staffId });
  }
  if (filters.source) {
    chips.push({ id: "source", label: "Source", value: filters.source });
  }
  if (filters.paymentStatus) {
    const label =
      PAYMENT_OPTIONS.find((option) => option.value === filters.paymentStatus)?.label ??
      filters.paymentStatus;
    chips.push({ id: "paymentStatus", label: "Payment", value: label });
  }
  return chips;
}

function ActiveFilterChip({
  chip,
  filters,
}: {
  chip: ActiveChip;
  filters: {
    range: string;
    from: string;
    to: string;
    staffId: string;
    source: string;
    paymentStatus: string;
  };
}) {
  const next = { ...filters, [chip.id]: "" } as typeof filters;
  // If we're dropping the Custom range pin we should also clear from/to so the
  // helper line resets cleanly.
  if (chip.id === "range") {
    next.from = "";
    next.to = "";
  }
  const search = new URLSearchParams(
    Object.entries(next).filter(([, value]) => Boolean(value))
  ).toString();
  return (
    <Link
      href={search ? `/admin/reports?${search}` : "/admin/reports"}
      className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[oklch(94%_0.008_280)] px-2.5 text-xs font-medium text-[oklch(30%_0.02_280)] outline-none transition-colors hover:bg-[oklch(91%_0.012_280)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/45"
      aria-label={`Remove ${chip.label} filter`}
    >
      <span>
        <span className="text-[var(--admin-text-muted)]">{chip.label}:</span> {chip.value}
      </span>
      <X className="size-3" aria-hidden="true" />
    </Link>
  );
}

// ───────────────────────── Denied state ───────────────────────────────────────

function InsufficientPermissions() {
  return (
    <AdminAccessDenied
      title="Reports access limited"
      message="Reports access requires reporting or own-booking permission. Ask the owner if you need broader access."
    />
  );
}
