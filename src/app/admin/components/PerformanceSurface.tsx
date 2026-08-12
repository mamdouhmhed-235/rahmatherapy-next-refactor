// B-3 — shared surface for /admin/me + /admin/staff/[staffId]/performance.
// Server-rendered with per-section `<Suspense>` boundaries (plan step 5.5):
// each section is an async server component that fetches its own data;
// per-render `cache()` dedup (see performance-data.ts) keeps the total
// cold-cache query count at ≤4 (SHARED-NOTES §11).
//
// Why this shape instead of the simpler "page fetches everything, surface
// renders sync" iteration: faster perceived render. Header paints
// immediately; tile grid arrives next; trend + timeline + upcoming-work
// stream in as each query returns. On slow networks (or under load) the
// user sees content as soon as the fastest section resolves, not after
// the slowest.

import { Suspense } from "react";
import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { StaffProfile } from "@/lib/auth/rbac";
import { hasPermission, PERMISSIONS } from "@/lib/auth/rbac";
import {
  buildPriorPeriodFilters,
  getStaffScorecard,
  summarizeReports,
  type ReportFilters,
} from "@/app/admin/reports/reporting";
import type { LineChartProps } from "./charts/LineChart";
import { LineChart } from "./charts/LineChart";
import { AdminPanel, AdminSkeleton } from "./admin-ui";
import { TileFromSpec } from "./tiles/TileFromSpec";
import { PerformanceHeader, type RangeChip } from "./PerformanceHeader";
import { ActivityTimeline } from "./ActivityTimeline";
import {
  tilesForRole,
  type TileSpec,
  type PerformanceShell,
} from "./performance-helpers";
import {
  fetchCachedReportData,
  fetchAuditLogForStaff,
  getUpcomingWorkForStaff,
  buildPerformanceTrend,
} from "./performance-data";

// ── Upcoming-work shape ──────────────────────────────────────────────────────

export interface UpcomingAssignment {
  bookingId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  clientName: string | null;
  serviceLabel: string | null;
}

export interface UpcomingEnquiry {
  enquiryId: string;
  name: string;
  source: string;
  createdAt: string;
}

export type UpcomingWorkItem =
  | { kind: "assignment"; data: UpcomingAssignment }
  | { kind: "enquiry"; data: UpcomingEnquiry };

// ── Trend chart shape ────────────────────────────────────────────────────────

export interface TrendChartInput {
  data: LineChartProps<Record<string, unknown>>["data"];
  categoryKey: string;
  lines: LineChartProps<Record<string, unknown>>["series"];
}

// ── Public props ─────────────────────────────────────────────────────────────

export interface PerformanceSurfaceProps {
  // Subject + viewer (same instance in self mode; distinct in manager mode).
  profile: StaffProfile;
  viewer: StaffProfile;
  mode: "self" | "manager";
  shell: PerformanceShell;
  // Raw inputs — sections fetch their own data via the cache()-wrapped helpers.
  filters: ReportFilters;
  // URL params that influence tile rendering (e.g. ?show=all expands the
  // owner_admin union from 6 → 13 tiles). Passed as a shallow record so the
  // surface doesn't need to know the full searchParams contract.
  tileOptions?: { showAll?: boolean };
  // Chrome inputs the route page assembles up-front (cheap, no I/O).
  rangeChips: RangeChip[];
  rangeWindowLabel: string;
  isInactive?: boolean;
  inactiveSinceLabel?: string;
  viewInReportsHref?: string;
  // Custom date-range form support (B-3 follow-up). When the active chip is
  // "custom", PerformanceHeader renders an inline from/to date input + Apply
  // button. Caller passes the current from/to so the form pre-fills.
  customDateRange?: { from: string; to: string };
  // URL the surface "lives at" — used by CustomDateRangeForm to build the
  // submit href without hard-coding /admin/me or /admin/staff/{id}/performance.
  basePath: string;
  // ITEM J — "Recent activity" shows a short preview until the reader asks for
  // the rest. Same shape as `tileOptions`: the route page owns the query string
  // and hands down the resolved state plus the href that toggles it, so this
  // surface never has to know the full searchParams contract.
  activity?: { expanded?: boolean; expandHref?: string };
}

export function PerformanceSurface({
  profile,
  viewer,
  mode,
  shell,
  filters,
  tileOptions,
  rangeChips,
  rangeWindowLabel,
  isInactive,
  inactiveSinceLabel,
  viewInReportsHref,
  customDateRange,
  basePath,
  activity,
}: PerformanceSurfaceProps) {
  const viewerCanManageAudit = hasPermission(viewer, PERMISSIONS.MANAGE_AUDIT_LOGS);
  const tileCount = tilesForRole(shell, EMPTY_SCORECARD, {
    showAll: tileOptions?.showAll,
    businessNetRevenue: shell === "owner_admin" ? 0 : undefined,
  }).length;

  return (
    <main id="admin-main" className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-24 pt-4 sm:px-6 sm:pb-8">
      <PerformanceHeader
        profile={profile}
        viewer={viewer}
        mode={mode}
        rangeChips={rangeChips}
        rangeWindowLabel={rangeWindowLabel}
        inactiveSinceLabel={inactiveSinceLabel}
        viewInReportsHref={viewInReportsHref}
        customDateRange={customDateRange}
        basePath={basePath}
      />

      <Suspense fallback={<KpiTileGridSkeleton count={tileCount} />}>
        <KpiTileGridSection
          profile={profile}
          viewer={viewer}
          shell={shell}
          filters={filters}
          tileOptions={tileOptions}
        />
      </Suspense>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense fallback={<TrendChartSkeleton />}>
            <TrendChartSection
              viewer={viewer}
              filters={filters}
              shell={shell}
              staffId={profile.id}
            />
          </Suspense>
        </div>
        <div>
          <Suspense fallback={<ActivityTimelineSkeleton />}>
            <ActivityTimelineSection
              staffId={profile.id}
              mode={mode}
              viewerCanManageAudit={viewerCanManageAudit}
              expanded={activity?.expanded ?? false}
              expandHref={activity?.expandHref}
            />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<UpcomingWorkSkeleton />}>
        <UpcomingWorkAndStickyBarSection
          staffId={profile.id}
          shell={shell}
          mode={mode}
          isInactive={isInactive}
        />
      </Suspense>
    </main>
  );
}

// ── KPI tile grid section ────────────────────────────────────────────────────

interface KpiTileGridSectionProps {
  profile: StaffProfile;
  viewer: StaffProfile;
  shell: PerformanceShell;
  filters: ReportFilters;
  tileOptions?: { showAll?: boolean };
}

async function KpiTileGridSection({
  profile,
  viewer,
  shell,
  filters,
  tileOptions,
}: KpiTileGridSectionProps) {
  const priorFilters = buildPriorPeriodFilters(filters);
  // `viewer` is used for getReportData's RBAC narrowing — the function filters
  // the dataset by what the caller is allowed to see. The narrowed scorecard
  // is then scoped to `profile.id`.
  const [data, priorData, auditLog] = await Promise.all([
    fetchCachedReportData(viewer, filters, "current"),
    priorFilters
      ? fetchCachedReportData(viewer, priorFilters, "prior")
      : Promise.resolve(undefined),
    fetchAuditLogForStaff(profile.id, 100),
  ]);

  const scorecard = getStaffScorecard(data, profile.id, priorData, auditLog);
  const businessNetRevenue =
    shell === "owner_admin" && scorecard.clinical.assignmentsTotal === 0
      ? summarizeReports(data).collectedRevenue
      : undefined;

  const tiles = tilesForRole(shell, scorecard, {
    staffId: profile.id,
    range: filters.range,
    businessNetRevenue,
    showAll: tileOptions?.showAll,
  });

  return <KpiTileGrid tiles={tiles} />;
}

function KpiTileGrid({ tiles }: { tiles: TileSpec[] }) {
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
      {tiles.map((tile) => (
        <TileFromSpec key={tile.id} spec={tile} />
      ))}
    </div>
  );
}

function KpiTileGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-6"
        >
          <AdminSkeleton className="h-3 w-1/2" />
          <AdminSkeleton className="mt-4 h-10 w-3/4" />
          <AdminSkeleton className="mt-3 h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

// ── Trend chart section ──────────────────────────────────────────────────────

interface TrendChartSectionProps {
  viewer: StaffProfile;
  filters: ReportFilters;
  shell: PerformanceShell;
  staffId: string;
}

async function TrendChartSection({
  viewer,
  filters,
  shell,
  staffId,
}: TrendChartSectionProps) {
  // Same fetch as KpiTileGridSection's "current" — React cache() dedups, so
  // this awaits the same in-flight promise without a second DB call.
  const data = await fetchCachedReportData(viewer, filters, "current");
  const trend = buildPerformanceTrend(data, staffId, shell);
  const title =
    shell === "therapist"
      ? "Sessions per week"
      : shell === "coordinator"
      ? "Enquiries handled per week"
      : "Activity per week";

  return (
    <AdminPanel title={title} titleAs="h3">
      <LineChart
        data={trend.data}
        series={trend.lines}
        categoryKey={trend.categoryKey}
        height={260}
        ariaLabel={title}
      />
    </AdminPanel>
  );
}

function TrendChartSkeleton() {
  return (
    <AdminPanel title="Trend" titleAs="h3" loading>
      {null}
    </AdminPanel>
  );
}

// ── Activity timeline section ────────────────────────────────────────────────

/**
 * ITEM J — how many events the panel shows before it is expanded.
 *
 * It was 20, which made this panel taller than the KPI tiles and the chart it
 * sits beside: an Owner screenshot showed it dominating the page. 6 is enough
 * to answer "what have I been up to lately" at a glance, which is the panel's
 * stated job, and the badge still reports the true count so the shorter list
 * never reads as the whole story.
 *
 * ⚠️ Not a de-duplication. ~14 near-identical "updated availability rule" rows
 * in that screenshot looked like one bulk save writing many rows, but
 * `saveAvailabilityDay` writes exactly ONE audit row per save (its own comment
 * says so) — they were 14 genuine saves, correctly logged. Collapsing them
 * would have hidden a legitimate trail. See the plan's J.2a.
 */
const ACTIVITY_PREVIEW_COUNT = 6;

interface ActivityTimelineSectionProps {
  staffId: string;
  mode: "self" | "manager";
  viewerCanManageAudit: boolean;
  expanded: boolean;
  expandHref?: string;
}

async function ActivityTimelineSection({
  staffId,
  mode,
  viewerCanManageAudit,
  expanded,
  expandHref,
}: ActivityTimelineSectionProps) {
  // Same audit fetch as KpiTileGridSection's scorecard.admin pass — cache()
  // dedups so the single 100-row query serves both consumers. The list is
  // intentionally NOT date-filtered — the "Recent activity" panel shows the
  // most recent 20 actions taken by this staffer regardless of the page
  // period filter (it's a "what have you been up to lately" panel, not a
  // period audit). The empty-state copy reflects that framing.
  const allEvents = await fetchAuditLogForStaff(staffId, 100);
  return (
    <ActivityTimeline
      staffId={staffId}
      mode={mode}
      viewerCanManageAudit={viewerCanManageAudit}
      events={expanded ? allEvents : allEvents.slice(0, ACTIVITY_PREVIEW_COUNT)}
      totalAvailable={allEvents.length}
      // Withheld when the preview already shows everything, so a reader who
      // arrives on a bookmarked `?activity=all` with three events is not
      // offered a "Show fewer" that would hide nothing.
      expandHref={
        allEvents.length > ACTIVITY_PREVIEW_COUNT ? expandHref : undefined
      }
      expanded={expanded}
    />
  );
}

function ActivityTimelineSkeleton() {
  return (
    <AdminPanel title="Recent activity" titleAs="h3" loading>
      {null}
    </AdminPanel>
  );
}

// ── Upcoming-work + mobile sticky bar (single Suspense child) ────────────────
// These two share the upcomingWork fetch (the sticky bar's label depends on
// whether the Therapist has a Next Visit). Wrapping them together avoids a
// second fetch + lets them stream in as one unit.

interface UpcomingWorkAndStickyBarSectionProps {
  staffId: string;
  shell: PerformanceShell;
  mode: "self" | "manager";
  isInactive?: boolean;
}

async function UpcomingWorkAndStickyBarSection({
  staffId,
  shell,
  mode,
  isInactive,
}: UpcomingWorkAndStickyBarSectionProps) {
  // Owner/Admin (owner_admin) → no upcoming-work panel per brief §5.5.
  // Inactive staff (manager view via G5) → no future work to surface.
  if (shell === "owner_admin" || isInactive) return null;

  const adminClient = createSupabaseAdminClient();
  const upcomingWork = await getUpcomingWorkForStaff(adminClient, staffId, shell, 5);
  const sticky =
    mode === "self" ? buildStickyForUpcomingWork(shell, upcomingWork) : undefined;

  return (
    <>
      <UpcomingWorkSection shell={shell} items={upcomingWork} />
      {sticky ? <MobileStickyActionBar href={sticky.href} label={sticky.label} /> : null}
    </>
  );
}

function UpcomingWorkSkeleton() {
  return (
    <AdminPanel title="Upcoming work" titleAs="h3" loading>
      {null}
    </AdminPanel>
  );
}

// Brief §5.5 + Q5 fallback ladder. Therapist: Next Visit → Browse claimable.
// Coordinator: Open enquiries. Mirrors the helper in performance-surface-
// helpers.ts but stays local because the section already has the upcoming-
// work array in hand.
function buildStickyForUpcomingWork(
  shell: PerformanceShell,
  upcomingWork: UpcomingWorkItem[]
): { href: string; label: string } | undefined {
  if (shell === "owner_admin") return undefined;
  if (shell === "therapist") {
    const next = upcomingWork.find((i) => i.kind === "assignment");
    if (next && next.kind === "assignment") {
      return { href: `/admin/bookings/${next.data.bookingId}`, label: "Go to my next visit" };
    }
    return { href: "/admin/bookings?view=claimable", label: "Browse claimable" };
  }
  return { href: "/admin/enquiries", label: "Open enquiries" };
}

function UpcomingWorkSection({
  shell,
  items,
}: {
  shell: PerformanceShell;
  items: UpcomingWorkItem[];
}) {
  if (shell === "therapist") {
    const assignments = items.filter(
      (i): i is Extract<UpcomingWorkItem, { kind: "assignment" }> => i.kind === "assignment"
    );
    if (assignments.length === 0) {
      return (
        <AdminPanel
          title="My upcoming work"
          titleAs="h3"
          footer={
            <Link
              href="/admin/bookings?view=claimable"
              className="inline-flex items-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-3 py-1.5 text-sm font-medium text-[var(--admin-on-primary)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2"
            >
              Browse claimable work
            </Link>
          }
        >
          <p className="text-sm font-medium text-[var(--admin-heading)]">Nothing scheduled</p>
          <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
            Browse claimable work to fill your day.
          </p>
        </AdminPanel>
      );
    }
    return (
      <AdminPanel title="My upcoming work" titleAs="h3">
        <ul role="list" className="-my-1 list-none divide-y divide-[var(--admin-border-subtle)]/60">
          {assignments.map((item) => (
            <li key={item.data.bookingId} className="py-3">
              <Link
                href={`/admin/bookings/${item.data.bookingId}`}
                className="-mx-2 flex items-start gap-3 rounded px-2 py-1 hover:bg-[var(--admin-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--admin-body)]">
                    {item.data.clientName ?? "Unnamed client"}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--admin-text-muted)] tabular-nums">
                    {item.data.serviceLabel ?? "Service"} · {item.data.bookingDate} · {item.data.startTime.slice(0, 5)}–{item.data.endTime.slice(0, 5)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </AdminPanel>
    );
  }
  // Coordinator
  const enquiries = items.filter(
    (i): i is Extract<UpcomingWorkItem, { kind: "enquiry" }> => i.kind === "enquiry"
  );
  if (enquiries.length === 0) {
    return (
      <AdminPanel
        title="Enquiries needing my follow-up"
        titleAs="h3"
        footer={
          <Link
            href="/admin/enquiries"
            className="inline-flex items-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-3 py-1.5 text-sm font-medium text-[var(--admin-on-primary)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2"
          >
            Open enquiries
          </Link>
        }
      >
        <p className="text-sm font-medium text-[var(--admin-heading)]">All caught up</p>
        <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
          New enquiries will land in the inbox.
        </p>
      </AdminPanel>
    );
  }
  return (
    <AdminPanel title="Enquiries needing my follow-up" titleAs="h3">
      <ul role="list" className="-my-1 list-none divide-y divide-[var(--admin-border-subtle)]/60">
        {enquiries.map((item) => (
          <li key={item.data.enquiryId} className="py-3">
            <Link
              href={`/admin/enquiries/${item.data.enquiryId}`}
              className="-mx-2 flex items-start gap-3 rounded px-2 py-1 hover:bg-[var(--admin-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--admin-body)]">
                  {item.data.name}
                </p>
                <p className="mt-0.5 text-xs text-[var(--admin-text-muted)] tabular-nums">
                  via {item.data.source} · {item.data.createdAt.slice(0, 10)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </AdminPanel>
  );
}

function MobileStickyActionBar({ href, label }: { href: string; label: string }) {
  return (
    <div
      role="region"
      aria-label="Quick actions"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--admin-border)] bg-[var(--admin-panel)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"
    >
      <Link
        href={href}
        className="flex h-11 w-full items-center justify-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-medium text-[var(--admin-on-primary)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] focus-visible:ring-offset-2"
      >
        {label}
      </Link>
    </div>
  );
}

// ── Tiny placeholder constants ───────────────────────────────────────────────
// `tilesForRole` needs a StaffScorecard input to compute the tile count for
// the skeleton fallback. EMPTY_SCORECARD lets us derive tile count without
// awaiting any data — pure CPU, deterministic by shell + showAll.

const EMPTY_SCORECARD = {
  clinical: {
    assignmentsTotal: 0,
    assignmentsCompleted: 0,
    hoursWorked: 0,
    clientsTouched: 0,
    revenueAttributed: 0,
    utilisation: { rate: 0, bookedHours: 0, availableHours: 0 },
    retention: { rate: 0, retainedClients: 0, totalClients: 0 },
    noShowRate: { rate: 0, total: 0, noShows: 0, cancelled: 0, lostRevenue: 0 },
    sameGenderFulfilled: 0,
  },
  admin: {
    enquiriesContactedCount: 0,
    enquiryConversionRate: 0,
    avgMinutesToFirstContact: 0,
    bookingsAssignedCount: 0,
    opsEventsResolvedCount: 0,
  },
} as const;
