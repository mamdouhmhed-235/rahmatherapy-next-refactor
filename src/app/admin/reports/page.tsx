// B-4 — Reports rebuild.
//
// Wholesale restructure per B4-reports-rebuild-plan step 7. Composes the new
// surface: ScopePill → InsightsStripe (Suspense) → filter strip +
// PersonalTeamToggle + active chips → HeadlineTileStrip (Suspense) →
// Activity (donut + source + business pulse, Suspense) → Workload
// (per-staff stacked bars + service rows, Suspense) → Money (Owner/Admin,
// Suspense) → Metric definitions. Per-section Suspense via `cache()`-deduped
// fetchers (SHARED-NOTES §10 + B-3 precedent in performance-data.ts):
// every section awaits `fetchCachedReportData(profile, filters)`, sibling
// awaits collapse to a single in-flight promise + cached on cache-hit.
//
// AUDIT Q3 — whole-page narrowing via [Team|Personal] toggle: when `scope=
// personal` is set, effectiveFilters carries staffId=profile.id and every
// downstream helper consumes `filterReportDataToStaff(data, staffId)`. The
// CSV-export deep-links also include staffId so the existing /export route
// narrows server-side without modification.
//
// AUDIT Q6 — Insights stripe dismissals: page-side fetch of dismissed IDs
// (cache()-deduped) → filter from getReportInsights output → optimistic
// dismiss in InsightRow.
//
// AUDIT Q8 — print stylesheet: B-4 step 8.5 — landed inline below.

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Briefcase,
  Calculator,
  Download,
  Filter,
  Receipt,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canOpenReports,
  type StaffProfile,
  getStaffProfile,
} from "@/lib/auth/rbac";
import {
  AdminAccessDenied,
  AdminFilterBar,
  AdminPageHeader,
  AdminPageScaffold,
  AdminPanel,
  AdminSkeleton,
} from "../components/admin-ui";
import { AdminSheet } from "../components/admin-ui-interactions";
import { BusinessPulseCard } from "../dashboard/dashboard-cards";
import {
  METRIC_DEFINITIONS,
  canViewRevenueReports,
  hasUniversalReportScope,
  filterReportDataToStaff,
  formatMoney,
  formatNumber,
  getCountBy,
  getNoShowRate,
  getRevenueSeries,
  getServicePerformance,
  getStaffRevenueAttribution,
  getUtilisationRate,
  parseReportFilters,
  summarizeReports,
  type ReportData,
  type ReportFilters,
} from "./reporting";
import { CountBarChart, RevenueChart, StatusDonutChart } from "./ReportsCharts";
import { RangeHelper } from "./RangeHelper";
import {
  PAYMENT_OPTIONS,
  RANGE_OPTIONS,
  buildActiveFilterChips,
  buildDailySeries,
  formatRangeLabel,
  getStaffWorkloadWithStatus,
  tilesForScope,
  validateFarFutureDate,
  type ActiveFilterChip as ActiveChip,
  type TileScope,
} from "./reports-helpers";
import { ScopePill } from "./ScopePill";
import { PersonalTeamToggle } from "./PersonalTeamToggle";
import { InsightsStripe } from "./InsightsStripe";
import { HeadlineTileStrip } from "./HeadlineTileStrip";
import { WorkloadStaffRow } from "./WorkloadStaffRow";
import {
  fetchCachedReportData,
  fetchPriorReportData,
  fetchReportInsights,
} from "./reports-data";

export const metadata = {
  title: "Reports - Rahma Therapy Admin",
};

interface ReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// ── Page entry ────────────────────────────────────────────────────────────────

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");
  if (!canOpenReports(profile)) return <InsufficientPermissions />;

  const params = await searchParams;
  const rawFilters = parseReportFilters(params);

  const revenueAllowed = canViewRevenueReports(profile);
  const universalScope = hasUniversalReportScope(profile);
  const isTherapistScope = !revenueAllowed && !universalScope;

  // AUDIT Q3 — scope resolution:
  //   - Therapist always reads as personal (no toggle, no Workload-Staff panel).
  //   - Owner/Admin/Coordinator opt in via ?scope=personal which auto-fills
  //     staffId=profile.id so the data layer narrows.
  const scopeParam = typeof params.scope === "string" ? params.scope : "";
  const isPersonalScope =
    isTherapistScope || scopeParam === "personal";

  // Effective filters thread the personal-scope staffId through every helper.
  // Manually-drilled ?staffId=other-id is preserved when the toggle is "team".
  const effectiveStaffId = isPersonalScope ? profile.id : rawFilters.staffId;
  const effectiveFilters: ReportFilters = {
    ...rawFilters,
    staffId: effectiveStaffId,
  };

  // Tile scope key for tilesForScope
  const tileScope: TileScope = isTherapistScope
    ? "therapist"
    : !revenueAllowed
      ? "coordinator"
      : "owner_admin";

  // Filter-aware querystring used by tile hrefs + CSV deep-links. Includes
  // staffId when set so the existing /export route narrows server-side
  // without route changes (brief §11.5 plan).
  const filterEntries = Object.entries(effectiveFilters).filter(
    ([, value]) => Boolean(value)
  );
  if (isPersonalScope && scopeParam === "personal") {
    filterEntries.push(["scope", "personal"]);
  }
  const query = new URLSearchParams(filterEntries).toString();

  const customRangeError = (() => {
    if (rawFilters.range !== "custom") {
      return validateFarFutureDate(rawFilters.from, rawFilters.to);
    }
    if (!rawFilters.from || !rawFilters.to) {
      return "Pick a start and end date for a custom range.";
    }
    if (rawFilters.from > rawFilters.to) {
      return "End date must be on or after start date.";
    }
    return validateFarFutureDate(rawFilters.from, rawFilters.to);
  })();

  // Top-level: prime the cache once so the FilterStrip's staff dropdown +
  // ScopePill's drilled-staff name + every Suspense child's await all hit
  // the React cache. Single DB call per render (cache() dedup); cache-hit
  // verification at recipe step 6 keeps the unstable_cache shape safe.
  const data = await fetchCachedReportData(profile, effectiveFilters);

  // Use rawFilters (not effectiveFilters) so the auto-narrowed staffId from
  // the Therapist-scope / Personal-toggle code path doesn't surface as a
  // removable filter chip (the user didn't set it; the page enforced it).
  const activeFilterChips = buildActiveFilterChips({
    filters: rawFilters,
    staff: data.staff,
  });

  const sourceOptions = getCountBy(data.bookings, (b) => b.booking_source)
    .map((row) => row.name)
    .filter((name): name is string => Boolean(name));

  const drilledStaffName = effectiveStaffId
    ? data.staff.find((s) => s.id === effectiveStaffId)?.name ?? null
    : null;

  const isManagerDrillingOther =
    Boolean(effectiveStaffId) && effectiveStaffId !== profile.id && universalScope;

  const pageTitle = isTherapistScope
    ? "My report"
    : isManagerDrillingOther && drilledStaffName
      ? `Reports — ${drilledStaffName}`
      : "Reports";

  const scopeWho = isPersonalScope
    ? "Me"
    : drilledStaffName ?? "All staff";
  const rangeLabel = formatRangeLabel(rawFilters);

  return (
    <AdminPageScaffold className="gap-8 pb-10 md:pb-0 print:gap-4">
      {/* Print-only header (visible only in @media print — see <style> below).
          aria-hidden so screen-reader users on-screen don't hear a duplicate
          page-title alongside AdminPageHeader's <h1>; the print medium has
          no AT consumer so the hidden semantics are safe. */}
      <div className="print-only" aria-hidden="true">
        <p className="text-xl font-semibold">Rahma Therapy — {pageTitle}</p>
        <p className="text-xs">
          Scope: {scopeWho} · {rangeLabel}
        </p>
      </div>

      <AdminPageHeader
        title={pageTitle}
        description={
          revenueAllowed
            ? "Server-scoped business, client, booking, payment, staff, service, and source reporting."
            : isTherapistScope
              ? "Your workload, completed sessions, and own bookings in the selected range."
              : "Operational reporting for bookings, staff workload, and source/channel."
        }
        actions={
          isManagerDrillingOther ? (
            <Link
              href={`/admin/reports?${new URLSearchParams(
                Object.entries(rawFilters).filter(
                  ([key, value]) => key !== "staffId" && Boolean(value)
                )
              ).toString()}`}
              className="admin-link-action inline-flex items-center gap-1 text-xs print:hidden"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to all staff
            </Link>
          ) : null
        }
      />

      <div className="print:hidden">
        <ScopePill who={scopeWho} rangeLabel={rangeLabel} />
      </div>

      {/* Insights stripe — Suspense for independent streaming */}
      <div className="print:hidden">
        <Suspense fallback={<InsightsStripeSkeleton />}>
          <InsightsSection
            profile={profile}
            filters={effectiveFilters}
            scopeForDrills={
              isPersonalScope && scopeParam === "personal" ? "personal" : null
            }
            staffIdForDrills={
              isPersonalScope && scopeParam === "personal" ? profile.id : null
            }
          />
        </Suspense>
      </div>

      {/* Mobile filter sheet (visible <md only). Same GET form contract. */}
      <div className="grid gap-3 md:hidden print:hidden">
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
                    {RANGE_OPTIONS.find((o) => o.value === rawFilters.range)?.label ?? "Monthly"}
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
            <FilterForm
              filters={rawFilters}
              staff={data.staff}
              sourceOptions={sourceOptions}
              isTherapistScope={isTherapistScope}
              currentScope={isPersonalScope ? "personal" : "team"}
              variant="mobile"
            />
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

      {/* Desktop filter strip + Personal/Team toggle (visible md+ only) */}
      <div id="admin-reports-filters" className="hidden gap-3 md:grid print:hidden">
        <FilterForm
          filters={rawFilters}
          staff={data.staff}
          sourceOptions={sourceOptions}
          isTherapistScope={isTherapistScope}
          currentScope={isPersonalScope ? "personal" : "team"}
          variant="desktop"
          extraActions={
            <PersonalTeamToggle
              visible={!isTherapistScope}
              scope={isPersonalScope ? "personal" : "team"}
              viewerId={profile.id}
              filters={Object.fromEntries(
                Object.entries(rawFilters).filter(([, v]) => Boolean(v))
              ) as Record<string, string>}
            />
          }
          activeFilterChipsCount={activeFilterChips.length}
        />
      </div>

      {/* Filter feedback */}
      {customRangeError ? (
        <div
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-center gap-1.5 text-xs text-[var(--admin-status-cancelled-text)] print:hidden"
        >
          {customRangeError}
        </div>
      ) : null}

      {activeFilterChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {activeFilterChips.map((chip) => (
            <ActiveFilterChip
              key={chip.id}
              chip={chip}
              filters={rawFilters}
              scope={isPersonalScope ? "personal" : ""}
            />
          ))}
        </div>
      ) : null}

      {/* Headline tile strip */}
      <Suspense fallback={<HeadlineSkeleton count={tileScope === "owner_admin" ? 6 : 4} />}>
        <HeadlineSection
          profile={profile}
          filters={effectiveFilters}
          scope={tileScope}
          query={query}
        />
      </Suspense>

      {/* Activity section */}
      <Suspense fallback={<SectionSkeleton heading="Activity" />}>
        <ActivitySection
          profile={profile}
          filters={effectiveFilters}
          revenueAllowed={revenueAllowed}
          isTherapistScope={isTherapistScope}
          query={query}
        />
      </Suspense>

      {/* Workload section */}
      {!isTherapistScope ? (
        <Suspense fallback={<SectionSkeleton heading="Workload" />}>
          <WorkloadSection
            profile={profile}
            filters={effectiveFilters}
            revenueAllowed={revenueAllowed}
            query={query}
          />
        </Suspense>
      ) : (
        <Suspense fallback={<SectionSkeleton heading="Workload" />}>
          <TherapistWorkloadSection
            profile={profile}
            filters={effectiveFilters}
          />
        </Suspense>
      )}

      {/* Money section (Owner/Admin) */}
      {revenueAllowed ? (
        <Suspense fallback={<SectionSkeleton heading="Money" />}>
          <MoneySection
            profile={profile}
            filters={effectiveFilters}
            query={query}
          />
        </Suspense>
      ) : null}

      <MetricDefinitions />

      {/* AUDIT Q8 — print stylesheet (step 8.5).
          @page sets A4 portrait; .print-only blocks shown only when printing;
          chrome (filter strip, scope pill, toggle, CSV chips, drill links,
          dismiss × buttons) hidden; section break-inside avoid; Recharts
          animations disabled (M4 fix). */}
      <style>{`
        @media screen { .print-only { display: none; } }
        @media print {
          @page { size: A4 portrait; margin: 1.5cm; }
          html, body { background: white; color: black; color-scheme: light; }
          .print-only { display: block; margin-bottom: 1rem; border-bottom: 1px solid #ccc; padding-bottom: 0.5rem; }
          section { break-inside: avoid; }
          svg { animation: none !important; }
          a[href] { color: black; text-decoration: none; }
        }
      `}</style>
    </AdminPageScaffold>
  );
}

// ── Suspense children ─────────────────────────────────────────────────────────

async function InsightsSection({
  profile,
  filters,
  scopeForDrills,
  staffIdForDrills,
}: {
  profile: StaffProfile;
  filters: ReportFilters;
  // Preserve `?scope=personal` and `?staffId=X` on the destination of each
  // insight's drillUrl. Without this, a Personal-scope viewer clicking an
  // insight derived from their own data would land on Team-scoped Reports
  // (silent scope widening). Audit-found 2026-05-25.
  scopeForDrills: "personal" | null;
  staffIdForDrills: string | null;
}) {
  const insights = await fetchReportInsights(profile, filters);
  const enriched = insights.map((insight) => {
    if (!insight.drillUrl) return insight;
    if (!scopeForDrills && !staffIdForDrills) return insight;
    const separator = insight.drillUrl.includes("?") ? "&" : "?";
    const extras: string[] = [];
    if (scopeForDrills) extras.push(`scope=${scopeForDrills}`);
    if (staffIdForDrills) extras.push(`staffId=${staffIdForDrills}`);
    return {
      ...insight,
      drillUrl: extras.length
        ? `${insight.drillUrl}${separator}${extras.join("&")}`
        : insight.drillUrl,
    };
  });
  return <InsightsStripe insights={enriched} />;
}

async function HeadlineSection({
  profile,
  filters,
  scope,
  query,
}: {
  profile: StaffProfile;
  filters: ReportFilters;
  scope: TileScope;
  query: string;
}) {
  const [data, priorData] = await Promise.all([
    fetchCachedReportData(profile, filters),
    fetchPriorReportData(profile, filters),
  ]);

  // When drilled to a specific staff (or personal scope), narrow the data
  // for tile computation. Top-level fetcher already narrowed via filters.staffId
  // through the SELECT, but filterReportDataToStaff is a safety net + the
  // canonical helper for "this staff only" derivations.
  const narrowed = filters.staffId ? filterReportDataToStaff(data, filters.staffId) : data;
  const priorNarrowed =
    filters.staffId && priorData ? filterReportDataToStaff(priorData, filters.staffId) : priorData;

  const summary = summarizeReports(narrowed);
  const priorSummary = priorNarrowed ? summarizeReports(priorNarrowed) : undefined;
  const utilisation = getUtilisationRate(narrowed, filters.staffId ? { staffId: filters.staffId } : undefined);
  const priorUtilisation = priorNarrowed
    ? getUtilisationRate(priorNarrowed, filters.staffId ? { staffId: filters.staffId } : undefined)
    : undefined;
  const noShow = getNoShowRate(narrowed, filters.staffId ? { staffId: filters.staffId } : undefined);
  const priorNoShow = priorNarrowed
    ? getNoShowRate(priorNarrowed, filters.staffId ? { staffId: filters.staffId } : undefined)
    : undefined;

  // Sparkline series — 12-day window from data.bookings + data.clients.
  const bookingsSeries = buildDailySeries(
    narrowed.bookings,
    (b) => b.booking_date,
    () => 1,
    12
  );
  const collectedSeries = buildDailySeries(
    narrowed.bookings,
    (b) => b.booking_date,
    (b) => Number(b.amount_paid ?? 0),
    12
  );
  const newClientsSeries = buildDailySeries(
    narrowed.clients ?? [],
    (c) => (c as { created_at?: string }).created_at,
    () => 1,
    12
  );

  const tiles = tilesForScope({
    scope,
    filters,
    summary,
    priorSummary,
    utilisation,
    priorUtilisation,
    noShow,
    priorNoShow,
    newClients: summary.newClients,
    priorNewClients: priorSummary?.newClients,
    series: {
      bookings: bookingsSeries,
      collected: collectedSeries,
      newClients: newClientsSeries,
    },
    query,
  });

  return <HeadlineTileStrip tiles={tiles} />;
}

async function ActivitySection({
  profile,
  filters,
  revenueAllowed,
  isTherapistScope,
  query,
}: {
  profile: StaffProfile;
  filters: ReportFilters;
  revenueAllowed: boolean;
  isTherapistScope: boolean;
  query: string;
}) {
  const data = await fetchCachedReportData(profile, filters);
  const narrowed = filters.staffId ? filterReportDataToStaff(data, filters.staffId) : data;
  const summary = summarizeReports(narrowed);
  const servicePerformance = getServicePerformance(narrowed);

  const statusBreakdown = getCountBy(narrowed.bookings, (b) => b.status);
  const sourceBreakdown = getCountBy(narrowed.bookings, (b) => b.booking_source);

  // Match the Dashboard's BusinessPulseCard math so the relocated card reports
  // the same noShow/cancelled count as it did on /admin/dashboard.
  const noShowCancelledCount = narrowed.bookings.filter(
    (b) => b.status === "no_show" || b.status === "cancelled"
  ).length;
  // newEnquiries narrowed by created_at within the page period — audit-found
  // 2026-05-25. Previously this read the unfiltered enquiries list so the
  // count was always lifetime-total while the three sibling buckets (repeat /
  // new / no-show-cancelled) were period-scoped. Mixed time-scope inside one
  // "client mix" card.
  const fromBound = filters.from
    ? `${filters.from}T00:00:00.000Z`
    : null;
  const toBound = filters.to
    ? `${filters.to}T23:59:59.999Z`
    : null;
  const newEnquiriesInPeriod = (narrowed.enquiries ?? []).filter((e) => {
    if (!e.created_at) return false;
    if (fromBound && e.created_at < fromBound) return false;
    if (toBound && e.created_at > toBound) return false;
    return true;
  }).length;
  const businessPulseClients = {
    repeatClients: summary.repeatClients,
    newClients: summary.newClients,
    noShowCancelled: noShowCancelledCount,
    newEnquiries: newEnquiriesInPeriod,
  };

  const activityCsvChips = isTherapistScope
    ? [{ reportKey: "booking_list", label: "Booking list" }]
    : [
        { reportKey: "client_summary", label: "Client summary" },
        { reportKey: "booking_list", label: "Booking list" },
        { reportKey: "source_channel_report", label: "Source-channel" },
      ];

  return (
    <ReportSection
      icon={Activity}
      heading="Activity"
      framing="How busy the clinic was in this window and where clients came from."
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <AdminPanel title="Bookings by status">
          <StatusDonutChart data={statusBreakdown} />
        </AdminPanel>
        <AdminPanel title="Source and channel">
          <CountBarChart data={sourceBreakdown} label="Bookings by source chart" />
        </AdminPanel>
      </div>
      {/* BusinessPulseCard — relocated from Dashboard per brief §4 (B-5 later
          removes its mount from /admin/dashboard) */}
      <BusinessPulseCard
        services={servicePerformance}
        clients={businessPulseClients}
        revenueAllowed={revenueAllowed}
      />
      <CsvExportPanel
        heading="Export Activity data"
        chips={activityCsvChips}
        query={query}
      />
    </ReportSection>
  );
}

async function WorkloadSection({
  profile,
  filters,
  revenueAllowed,
  query,
}: {
  profile: StaffProfile;
  filters: ReportFilters;
  revenueAllowed: boolean;
  query: string;
}) {
  const data = await fetchCachedReportData(profile, filters);
  const narrowed = filters.staffId ? filterReportDataToStaff(data, filters.staffId) : data;

  const workloadRows = getStaffWorkloadWithStatus({ assignments: narrowed.assignments });
  const servicePerformance = getServicePerformance(narrowed);

  return (
    <ReportSection
      icon={Briefcase}
      heading="Workload"
      framing="Who carried the load and which services led."
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <AdminPanel title="Staff workload">
          {workloadRows.length === 0 ? (
            <EmptyPanel
              title="No staff workload recorded in this window."
              body="Once assignments are made, the breakdown appears here."
            />
          ) : (
            <div className="grid gap-1">
              {workloadRows.slice(0, 8).map((row) => (
                <WorkloadStaffRow key={row.staffId} row={row} query={query} />
              ))}
            </div>
          )}
        </AdminPanel>
        <AdminPanel title="Service performance">
          {servicePerformance.length === 0 ? (
            <EmptyPanel
              title="No services delivered in this window."
              body="Service rows surface once bookings complete."
            />
          ) : (
            <div className="grid gap-2">
              {servicePerformance.slice(0, 8).map((row, idx) => (
                <ServiceRow
                  key={`${row.service}-${idx}`}
                  service={row.service}
                  bookings={row.bookings}
                  revenue={row.revenue}
                  revenueAllowed={revenueAllowed}
                />
              ))}
            </div>
          )}
        </AdminPanel>
      </div>
      <CsvExportPanel
        heading="Export Workload data"
        chips={[
          { reportKey: "staff_workload_report", label: "Staff workload" },
          { reportKey: "service_performance_report", label: "Service performance" },
        ]}
        query={query}
      />
    </ReportSection>
  );
}

async function TherapistWorkloadSection({
  profile,
  filters,
}: {
  profile: StaffProfile;
  filters: ReportFilters;
}) {
  const data = await fetchCachedReportData(profile, filters);
  const narrowed = filterReportDataToStaff(data, profile.id);
  const servicePerformance = getServicePerformance(narrowed);

  return (
    <ReportSection
      icon={Briefcase}
      heading="Workload"
      framing="Which of your services led in this window."
    >
      <AdminPanel title="Service performance">
        {servicePerformance.length === 0 ? (
          <EmptyPanel
            title="No services delivered in this window."
            body="Service rows surface once bookings complete."
          />
        ) : (
          <div className="grid gap-2">
            {servicePerformance.slice(0, 8).map((row, idx) => (
              <ServiceRow
                key={`${row.service}-${idx}`}
                service={row.service}
                bookings={row.bookings}
                revenue={row.revenue}
                revenueAllowed={false}
              />
            ))}
          </div>
        )}
      </AdminPanel>
    </ReportSection>
  );
}

async function MoneySection({
  profile,
  filters,
  query,
}: {
  profile: StaffProfile;
  filters: ReportFilters;
  query: string;
}) {
  const data = await fetchCachedReportData(profile, filters);
  const narrowed = filters.staffId ? filterReportDataToStaff(data, filters.staffId) : data;

  const summary = summarizeReports(narrowed);
  const revenueSeries = getRevenueSeries(narrowed.bookings);
  const staffRevenue = getStaffRevenueAttribution(narrowed);

  return (
    <ReportSection
      icon={Receipt}
      heading="Money"
      framing="What was collected, what's outstanding, and how it splits across staff."
    >
      <AdminPanel title="Revenue by period">
        <RevenueChart data={revenueSeries} />
      </AdminPanel>
      <div className="grid gap-4 xl:grid-cols-2">
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
        <AdminPanel
          title="Staff revenue attribution"
          description="Participant service-item attribution avoids group-booking double-counting."
        >
          {staffRevenue.length === 0 ? (
            <EmptyPanel
              title="No revenue attributed yet"
              body="Once bookings are paid, attribution appears here."
            />
          ) : (
            <div className="grid gap-2">
              {staffRevenue.slice(0, 8).map((row, idx) => (
                <div
                  key={`${row.staffName}-${idx}`}
                  className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] py-2 text-sm last:border-b-0"
                >
                  <span className="truncate font-medium text-[var(--admin-heading)]">
                    {row.staffName}
                  </span>
                  <span className="tabular-nums text-[var(--admin-body)]">
                    {formatMoney(row.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>
      <CsvExportPanel
        heading="Export Money data"
        chips={[
          { reportKey: "revenue_summary", label: "Revenue summary" },
          { reportKey: "payment_report", label: "Payment report" },
          { reportKey: "staff_revenue_attribution_report", label: "Staff revenue attribution" },
        ]}
        query={query}
      />
    </ReportSection>
  );
}

// ── Sync sub-sections ─────────────────────────────────────────────────────────

interface FilterFormProps {
  filters: ReportFilters;
  staff: ReportData["staff"];
  sourceOptions: string[];
  isTherapistScope: boolean;
  /** When 'personal' the form emits a hidden scope input so Apply preserves the toggle state. */
  currentScope: "team" | "personal";
  variant: "mobile" | "desktop";
  extraActions?: React.ReactNode;
  activeFilterChipsCount?: number;
}

function FilterForm({
  filters,
  staff,
  sourceOptions,
  isTherapistScope,
  currentScope,
  variant,
  extraActions,
  activeFilterChipsCount = 0,
}: FilterFormProps) {
  const inputBase =
    "w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35";
  const inputHeight = variant === "mobile" ? "h-11" : "h-10";

  const formInner = (
    <>
      {/* Preserve Personal-toggle state through the GET-form Apply round-trip.
          Without this hidden input, clicking Apply while in Personal scope
          would silently drop scope=personal and revert to Team. */}
      {currentScope === "personal" ? (
        <input type="hidden" name="scope" value="personal" />
      ) : null}
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
          className={cn(inputBase, inputHeight, variant === "desktop" && "min-w-[9rem]")}
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FilterField>
      <div className={variant === "mobile" ? "grid grid-cols-2 gap-3" : "contents"}>
        <FilterField label="From">
          <input
            name="from"
            type="date"
            defaultValue={filters.from}
            className={cn(inputBase, inputHeight, variant === "desktop" && "min-w-[8.5rem]")}
          />
        </FilterField>
        <FilterField label="To">
          <input
            name="to"
            type="date"
            defaultValue={filters.to}
            className={cn(inputBase, inputHeight, variant === "desktop" && "min-w-[8.5rem]")}
          />
        </FilterField>
      </div>
      {!isTherapistScope ? (
        <FilterField label="Staff">
          <select
            name="staffId"
            defaultValue={filters.staffId}
            className={cn(inputBase, inputHeight, variant === "desktop" && "min-w-[10rem]")}
          >
            <option value="">All staff</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </FilterField>
      ) : null}
      <FilterField label="Source">
        <select
          name="source"
          defaultValue={filters.source}
          className={cn(inputBase, inputHeight, variant === "desktop" && "min-w-[10rem]")}
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
          className={cn(inputBase, inputHeight, variant === "desktop" && "min-w-[9rem]")}
        >
          {PAYMENT_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FilterField>
    </>
  );

  if (variant === "mobile") {
    return (
      <form action="/admin/reports" className="grid gap-4">
        {formInner}
        <button
          type="submit"
          className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/45"
        >
          <Filter className="size-4" aria-hidden="true" />
          Apply filters
        </button>
      </form>
    );
  }

  return (
    <form action="/admin/reports" className="grid gap-3">
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
            {extraActions}
            {activeFilterChipsCount > 0 ? (
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
        {formInner}
      </AdminFilterBar>
    </form>
  );
}

function MetricDefinitions() {
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
    <AdminPanel
      title="How these numbers are calculated"
      description="Each metric is computed from the bookings visible in this window. Expand any row for the definition."
    >
      <MetricGroupHeading label="Revenue" />
      <div className="grid gap-2 sm:grid-cols-2">{revenueMetrics.map(renderMetricDetails)}</div>
      <div className="my-5 border-t border-[var(--admin-border)]" aria-hidden="true" />
      <MetricGroupHeading label="Activity" />
      <div className="grid gap-2 sm:grid-cols-2">{activityMetrics.map(renderMetricDetails)}</div>
    </AdminPanel>
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--admin-status-restricted-bg)] px-2.5 py-1 text-xs font-medium text-[var(--admin-status-restricted-text)]">
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
      <p className="mt-2 text-xs leading-5 text-[var(--admin-text-muted)]">{metric.definition}</p>
    </details>
  );
}

// ── Small primitives ──────────────────────────────────────────────────────────

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
          <Icon className="size-5 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
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
    <AdminPanel
      title={heading}
      description="CSV downloads use the current filter window."
      tone="muted"
    >
      <div className="flex flex-wrap gap-2 print:hidden">
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

function ServiceRow({
  service,
  bookings,
  revenue,
  revenueAllowed,
}: {
  service: string;
  bookings: number;
  revenue: number;
  revenueAllowed: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] py-2 text-sm last:border-b-0">
      <span className="truncate font-medium text-[var(--admin-heading)]">{service}</span>
      <span className="tabular-nums text-[var(--admin-text-muted)]">
        {formatNumber(bookings)} bookings{revenueAllowed ? ` · ${formatMoney(revenue)}` : ""}
      </span>
    </div>
  );
}

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
      ? "bg-[var(--admin-status-confirmed-bg)] border-[var(--admin-status-confirmed-border)]"
      : tone === "warning"
        ? "bg-[var(--admin-status-attention-bg)] border-[var(--admin-status-attention-border)]"
        : "bg-[var(--admin-panel)] border-[var(--admin-border)]";
  const iconColor =
    tone === "success"
      ? "text-[var(--admin-status-confirmed-text)]"
      : tone === "warning"
        ? "text-[var(--admin-status-attention-text)]"
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

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="grid gap-1 rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)]/50 px-3 py-4 text-sm"
      role="status"
    >
      <p className="font-medium text-[var(--admin-heading)]">{title}</p>
      <p className="text-xs text-[var(--admin-text-muted)]">{body}</p>
    </div>
  );
}

function InsightsStripeSkeleton() {
  return (
    <div className="grid gap-2">
      <AdminSkeleton className="h-12 rounded-md" />
      <AdminSkeleton className="h-12 rounded-md" />
    </div>
  );
}

function HeadlineSkeleton({ count }: { count: number }) {
  return (
    <section
      aria-label="Headline metrics"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <AdminSkeleton key={idx} className="h-[14rem] rounded-[var(--admin-radius-card)]" />
      ))}
    </section>
  );
}

function SectionSkeleton({ heading }: { heading: string }) {
  return (
    <section aria-label={heading} className="grid gap-4">
      <AdminSkeleton className="h-8 w-40 rounded-md" />
      <div className="grid gap-4 xl:grid-cols-2">
        <AdminSkeleton className="h-64 rounded-[var(--admin-radius-card)]" />
        <AdminSkeleton className="h-64 rounded-[var(--admin-radius-card)]" />
      </div>
    </section>
  );
}

function ActiveFilterChip({
  chip,
  filters,
  scope,
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
  /** When 'personal', preserved on chip-removal so the toggle state survives. */
  scope: "" | "personal";
}) {
  const next = { ...filters, [chip.id]: "" } as typeof filters;
  if (chip.id === "range") {
    next.from = "";
    next.to = "";
  }
  const params = new URLSearchParams(
    Object.entries(next).filter(([, value]) => Boolean(value))
  );
  if (scope === "personal") params.set("scope", "personal");
  const search = params.toString();
  return (
    <Link
      href={search ? `/admin/reports?${search}` : "/admin/reports"}
      className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--admin-status-restricted-bg)] px-2.5 text-xs font-medium text-[var(--admin-status-restricted-text)] outline-none transition-colors hover:bg-[oklch(91%_0.012_280)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/45"
      aria-label={`Remove ${chip.label} filter`}
    >
      <span>
        <span className="text-[var(--admin-text-muted)]">{chip.label}:</span> {chip.value}
      </span>
      <X className="size-3" aria-hidden="true" />
    </Link>
  );
}

function InsufficientPermissions() {
  return (
    <AdminAccessDenied
      title="Reports access limited"
      message="Reports access requires reporting or own-booking permission. Ask the owner if you need broader access."
    />
  );
}
