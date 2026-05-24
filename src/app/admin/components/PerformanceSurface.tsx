// B-3 — shared surface composition for /admin/me + the staff-detail
// /performance sub-route. Server-rendered + synchronous: takes pre-computed
// inputs from the route page and lays out header → tile grid → trend +
// timeline (right rail on desktop) → upcoming work → mobile sticky bar.
//
// Note on architecture: per AUDIT G2 + SHARED-NOTES §10, the original plan
// floated per-section Suspense boundaries. The first iteration uses a single
// page-level fetch (≤4 queries via Promise.all) and renders everything
// synchronously — simpler, no streaming complexity, fits comfortably under
// the query budget. The Suspense-per-section refactor (plan step 5.5) is
// deferred to once the basic surface is verified.

import Link from "next/link";
import type { StaffProfile } from "@/lib/auth/rbac";
import type { AuditEventRow } from "@/app/admin/reports/reporting";
import type { LineChartProps } from "./charts/LineChart";
import { LineChart } from "./charts/LineChart";
import { AdminPanel } from "./admin-ui";
import { TileFromSpec } from "./tiles/TileFromSpec";
import { PerformanceHeader, type RangeChip } from "./PerformanceHeader";
import { ActivityTimeline } from "./ActivityTimeline";
import type { TileSpec, PerformanceShell } from "./performance-helpers";

// ── Upcoming-work shape ──────────────────────────────────────────────────────
// Defined here so PerformanceSurface compiles independently of step 5's
// performance-data.ts; step 5 re-exports these types and provides the fetcher.

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
  profile: StaffProfile;
  viewer: StaffProfile;
  mode: "self" | "manager";
  shell: PerformanceShell;
  tiles: TileSpec[];
  trend: TrendChartInput;
  upcomingWork: UpcomingWorkItem[];
  // Pre-fetched audit events (first ~20 of the page's 100-row scorecard fetch).
  // Per SHARED-NOTES §11, consolidates the audit query into a single page-level
  // call rather than duplicating across the timeline + scorecard.
  auditEvents: AuditEventRow[];
  rangeChips: RangeChip[];
  rangeWindowLabel: string;
  // G5 — render historical scorecard for inactive staff to managers; pill in
  // the header; upcoming-work panel hidden (no future assignments exist).
  isInactive?: boolean;
  inactiveSinceLabel?: string;
  // Resolved by the page from viewer.permissions etc.
  viewInReportsHref?: string;
  viewerCanManageAudit: boolean;
  mobileStickyHref?: string;
  mobileStickyLabel?: string;
}

export function PerformanceSurface({
  profile,
  viewer,
  mode,
  shell,
  tiles,
  trend,
  upcomingWork,
  auditEvents,
  rangeChips,
  rangeWindowLabel,
  isInactive,
  inactiveSinceLabel,
  viewInReportsHref,
  viewerCanManageAudit,
  mobileStickyHref,
  mobileStickyLabel,
}: PerformanceSurfaceProps) {
  const activeChip = rangeChips.find((c) => c.active);
  const rangeLabel = activeChip ? activeChip.label.toLowerCase() : "this period";
  const showUpcoming = !isInactive && shell !== "owner_admin";

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
      />

      <KpiTileGrid tiles={tiles} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChartSection shell={shell} trend={trend} />
        </div>
        <div>
          <ActivityTimeline
            staffId={profile.id}
            mode={mode}
            rangeLabel={rangeLabel}
            viewerCanManageAudit={viewerCanManageAudit}
            events={auditEvents}
          />
        </div>
      </div>

      {showUpcoming ? (
        <UpcomingWorkSection shell={shell} items={upcomingWork} />
      ) : null}

      {mobileStickyHref && mobileStickyLabel ? (
        <MobileStickyActionBar href={mobileStickyHref} label={mobileStickyLabel} />
      ) : null}
    </main>
  );
}

// ── Sub-sections ─────────────────────────────────────────────────────────────

function KpiTileGrid({ tiles }: { tiles: TileSpec[] }) {
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
      {tiles.map((tile) => (
        <TileFromSpec key={tile.id} spec={tile} />
      ))}
    </div>
  );
}

function TrendChartSection({ shell, trend }: { shell: PerformanceShell; trend: TrendChartInput }) {
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
      <ul role="list" className="-my-1 divide-y divide-[var(--admin-border-subtle)]/60">
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
