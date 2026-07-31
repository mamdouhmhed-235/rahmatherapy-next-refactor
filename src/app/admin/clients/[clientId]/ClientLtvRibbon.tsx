// SERVER COMPONENT — B-6 Client LTV ribbon.
//
// Renders six stats (LTV / Visits / Last seen / Avg booking / Preferred
// service / Repeat status) and a 12-month visit sparkline at the top of
// /admin/clients/[clientId]. Consumes the already-fetched
// `bookingHistory` (the unfiltered Promise.all source at page.tsx:381–396
// per AUDIT H6) so no new DB queries are added. Hides entirely when the
// client has zero bookings.
//
// Sparkline is an inline SVG, NOT B-1's Recharts-backed `Sparkline`. The
// client detail route has not yet shipped any Recharts consumer, so
// importing B-1's Sparkline pulled the whole Recharts library into the
// route bundle (+97 kB gzip — see B-6 progress doc), breaking SHARED-NOTES
// §5 +6 kB budget. The inline SVG below delivers the same visual (and
// adds the area fill called for in brief §5.2 that B-1's line-only
// primitive doesn't support) while keeping the bundle within budget.
// Mobile-first stacked tile pattern matches B-5 `StripeTile` so 375 px
// labels never truncate.
//
// `scopeNarrowed` is forwarded from page.tsx's `hasAllClientAccess`
// flag — `true` when the page is rendering a Therapist's
// assignment-narrowed view, in which case the LTV sub-line reads
// "Across N visits with you" instead of "Across N visits".

import { Star } from "lucide-react";
import {
  getClientLifetimeMetrics,
  type ClientRepeatStatus,
} from "../client-metrics";
import { formatDate, formatMoney } from "../format";
import type { ClientBookingRecord } from "../types";

export interface ClientLtvRibbonProps {
  clientId: string;
  bookings: ClientBookingRecord[];
  scopeNarrowed?: boolean;
}

// C-11 Phase E (Step 11b / plan §4.3): tokenised so the stroke gains a dark
// counterpart. The token's :root value is the literal that used to sit here,
// verbatim, so light rendering is unchanged; left unmigrated this would have
// been a near-black line on a near-black panel in dark mode.
const SPARKLINE_STROKE = "var(--admin-sparkline-stroke)";
const PREFERRED_SERVICE_MAX_CHARS = 20;

const REPEAT_STATUS_LABEL: Record<ClientRepeatStatus, string> = {
  new: "New",
  returning: "Returning",
  regular: "Regular",
  loyal: "Loyal",
};

const REPEAT_STATUS_TITLE: Record<ClientRepeatStatus, string> = {
  new: "New: under 2 completed visits",
  returning: "Returning: 2–4 completed visits",
  regular: "Regular: 5–9 completed visits",
  loyal: "Loyal: 10+ completed visits",
};

export function ClientLtvRibbon({
  clientId,
  bookings,
  scopeNarrowed = false,
}: ClientLtvRibbonProps) {
  const metrics = getClientLifetimeMetrics(clientId, bookings);

  // Brief §5.4 / §6: hide entirely when client has no booking history at all.
  // All-cancelled-only clients keep the ribbon visible with a zero state.
  if (metrics.completedCount === 0 && metrics.cancelledCount === 0) {
    return null;
  }

  const completedVisitsWord =
    metrics.visitCount === 1 ? "visit" : "visits";
  const ltvSubLine = scopeNarrowed
    ? `Across ${metrics.visitCount} ${completedVisitsWord} with you`
    : `Across ${metrics.visitCount} ${completedVisitsWord}`;

  const lastSeenLabel = metrics.lastSeenAt
    ? formatRelativeDate(metrics.lastSeenAt)
    : "Never";
  const lastSeenTitle = metrics.lastSeenAt
    ? formatDate(metrics.lastSeenAt)
    : undefined;

  const preferredService = metrics.preferredService;
  const preferredIsTruncated =
    preferredService !== null &&
    preferredService.length > PREFERRED_SERVICE_MAX_CHARS;
  const preferredDisplay = preferredService
    ? preferredIsTruncated
      ? `${preferredService.slice(0, PREFERRED_SERVICE_MAX_CHARS).trimEnd()}…`
      : preferredService
    : "—";

  const sparklineValues = metrics.monthlyVisitsSeries.map((m) => m.count);
  const sparklineHasData = sparklineValues.some((v) => v > 0);

  return (
    <aside
      role="complementary"
      aria-label="Client lifetime overview"
      className="border-t border-b border-[var(--admin-border)] py-5"
    >
      <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        <RibbonTile label="LTV" accent subLine={ltvSubLine}>
          <span className="admin-display text-[1.778rem] font-semibold leading-none tabular-nums text-[var(--admin-heading)] [font-variant-numeric:tabular-nums_lining-nums]">
            {formatMoney(metrics.ltv)}
          </span>
        </RibbonTile>
        <RibbonTile label="Visits">
          <span className="text-lg font-semibold tabular-nums text-[var(--admin-text)]">
            {metrics.completedCount}
            <span className="mx-1 text-[var(--admin-text-muted)]">/</span>
            {metrics.cancelledCount}
          </span>
        </RibbonTile>
        <RibbonTile label="Last seen">
          <span
            title={lastSeenTitle}
            className="text-lg font-semibold leading-tight tabular-nums text-[var(--admin-text)]"
          >
            {lastSeenLabel}
          </span>
        </RibbonTile>
        <RibbonTile label="Avg booking">
          <span className="text-lg font-semibold tabular-nums text-[var(--admin-text)]">
            {formatMoney(metrics.avgBookingValue)}
          </span>
        </RibbonTile>
        <RibbonTile label="Preferred service">
          <span
            title={preferredIsTruncated ? preferredService ?? undefined : undefined}
            className="break-words text-lg font-semibold leading-tight text-[var(--admin-text)]"
          >
            {preferredDisplay}
          </span>
        </RibbonTile>
        <RibbonTile label="Repeat status">
          <RepeatStatusChip status={metrics.repeatStatus} />
        </RibbonTile>
      </div>
      {sparklineHasData ? (
        <div
          className="mt-4"
          role="img"
          aria-label="12-month visit trend for this client"
        >
          <InlineSparkline values={sparklineValues} />
        </div>
      ) : null}
    </aside>
  );
}

// Inline SVG sparkline tuned for the LTV ribbon. Width = 100% of parent;
// fixed pixel height. preserveAspectRatio="none" lets the path stretch to
// fill any container width without re-computing on resize. Single y-baseline
// math keeps the line vertically centred when every value is equal (which
// would otherwise produce a degenerate (max - min) === 0 division).
function InlineSparkline({
  values,
  height = 32,
}: {
  values: number[];
  height?: number;
}) {
  if (values.length === 0) return null;
  const viewWidth = 100;
  const viewHeight = height;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;
  const stepX = values.length > 1 ? viewWidth / (values.length - 1) : 0;
  // Padding so the stroke doesn't clip at the top/bottom edges.
  const paddingY = 2;
  const usableY = viewHeight - paddingY * 2;
  const points = values.map((v, i) => {
    const x = i * stepX;
    // When all values are equal (range === 0) draw a centred horizontal line
    // — looks more like a steady-state trend than a baseline-pinned flatline.
    const y =
      range === 0
        ? paddingY + usableY / 2
        : paddingY + usableY - ((v - min) / range) * usableY;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const linePath = `M ${points.join(" L ")}`;
  const areaPath = `${linePath} L ${(values.length - 1) * stepX},${viewHeight} L 0,${viewHeight} Z`;
  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      width="100%"
      height={viewHeight}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="block"
    >
      <path d={areaPath} fill={SPARKLINE_STROKE} fillOpacity={0.08} />
      <path
        d={linePath}
        fill="none"
        stroke={SPARKLINE_STROKE}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function RibbonTile({
  label,
  children,
  subLine,
  accent = false,
}: {
  label: string;
  children: React.ReactNode;
  subLine?: string;
  accent?: boolean;
}) {
  return (
    <div
      data-tile-label={label}
      className="flex min-w-0 flex-col gap-1.5"
    >
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-[var(--admin-text-muted)]">
        {label}
      </p>
      <div className={accent ? "min-w-0" : "min-w-0 leading-tight"}>
        {children}
      </div>
      {subLine ? (
        <p className="text-xs leading-snug text-[var(--admin-text-muted)]">
          {subLine}
        </p>
      ) : null}
    </div>
  );
}

function RepeatStatusChip({ status }: { status: ClientRepeatStatus }) {
  const label = REPEAT_STATUS_LABEL[status];
  const title = REPEAT_STATUS_TITLE[status];
  switch (status) {
    case "loyal":
      return (
        <span
          title={title}
          className="inline-flex h-6 items-center gap-1 rounded-full bg-[var(--admin-status-confirmed-bg)] px-2.5 text-xs font-medium text-[var(--admin-status-confirmed-text)] ring-1 ring-inset ring-[var(--admin-status-confirmed-border)]"
        >
          <Star className="size-3" aria-hidden="true" />
          {label}
        </span>
      );
    case "regular":
      return (
        <span
          title={title}
          className="inline-flex h-6 items-center rounded-full bg-[var(--admin-status-confirmed-bg)] px-2.5 text-xs font-medium text-[var(--admin-status-confirmed-text)] ring-1 ring-inset ring-[var(--admin-status-confirmed-border)]"
        >
          {label}
        </span>
      );
    case "returning":
      return (
        <span
          title={title}
          className="inline-flex h-6 items-center rounded-full bg-[var(--admin-panel-muted)] px-2.5 text-xs font-medium text-[var(--admin-body)] ring-1 ring-inset ring-[var(--admin-border)]"
        >
          {label}
        </span>
      );
    case "new":
    default:
      return (
        <span
          title={title}
          className="inline-flex h-6 items-center rounded-full bg-[var(--admin-status-pending-bg)] px-2.5 text-xs font-medium text-[var(--admin-status-pending-text)] ring-1 ring-inset ring-[var(--admin-status-pending-border)]"
        >
          {label}
        </span>
      );
  }
}

function formatRelativeDate(yyyymmdd: string): string {
  const target = new Date(`${yyyymmdd}T00:00:00`);
  if (Number.isNaN(target.getTime())) return yyyymmdd;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "Last week";
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} weeks ago`;
  }
  if (diffDays < 60) return "Last month";
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} months ago`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
