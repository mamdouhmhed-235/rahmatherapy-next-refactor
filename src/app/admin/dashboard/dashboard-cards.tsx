import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  AtSign,
  CalendarDays,
  ChevronRight,
  Clock,
  Globe,
  HeartPulse,
  Info,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  PoundSterling,
  ShieldAlert,
  UserRound,
  UserX,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AdminDashboardPanel,
  AdminIconBadge,
  AdminPanelHeader,
  AdminProgressBar,
  AdminSeverityMeter,
  AdminStackedBar,
  AdminStatusBadge,
} from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { AttentionReviewButton } from "./attention-group-client";
import { DemandTrendClient } from "./demand-trend-client";
import {
  appointmentStyle,
  safeDivide,
  severityLabel,
  severityMeterValue,
  severityTone,
} from "./dashboard-helpers";

export type AttentionSeverity = "critical" | "warning" | "info";

export interface AttentionGroup {
  key: string;
  label: string;
  category: string;
  categoryLabel: string;
  priority: number;
  count: number;
  summary: string;
  pageHref?: string | null;
  href?: string | null;
  actionLabel?: string;
  items: React.ReactNode[];
}

export interface AttentionSummaryRow {
  key: string;
  label: string;
  detail: string;
  count: number;
  severity: AttentionSeverity | "clear";
  href?: string | null;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => Array.from(n)[0] ?? "")
    .join("")
    .toUpperCase();
}

// Deterministic avatar tint per name. Hue uses (index * 37) mod 360 then clamps
// to the brand-adjacent ranges 75-165 (greens/teals) and 30-80 (warm sand/amber),
// skipping purples/magentas. Background sits at L=85 C=0.035, text at L=28 C=0.085
// for accessible contrast (WCAG AA on body text inside the badge).
function avatarTintStyle(name: string): React.CSSProperties {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash);
  const rawHue = (index * 37) % 360;
  const greenBand = 75 + (rawHue % 91);
  const warmBand = 30 + (rawHue % 51);
  const hue = rawHue % 2 === 0 ? greenBand : warmBand;
  return {
    backgroundColor: `oklch(85% 0.035 ${hue})`,
    color: `oklch(28% 0.085 ${hue})`,
  };
}

export function AttentionItemCard({
  title,
  detail,
  impact,
  severity,
  date,
  ageLabel,
  href,
  primaryLabel = "View",
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  detail: string;
  impact?: string;
  severity: AttentionSeverity;
  date?: string;
  ageLabel?: string;
  href: string | null;
  primaryLabel?: string;
  secondaryHref?: string | null;
  secondaryLabel?: string;
}) {
  const tone = severityTone(severity);
  const SeverityIcon = severity === "info" ? Info : AlertTriangle;

  return (
    <div
      className={cn(
        "dashboard-attention-item grid min-w-0 gap-3 rounded-[var(--admin-radius-card)] border bg-[var(--admin-panel)] px-4 py-4",
        // B-5 step 10: switch from literal OKLCH to the B-1 severity-strong
        // tokens. WCAG verified at B-0; SHARED-NOTES §17 + G3.
        severity === "critical" && "border-[var(--admin-danger)] bg-[var(--admin-danger-bg-strong)]/30",
        severity === "warning" && "border-[var(--admin-warning)] bg-[var(--admin-warning-bg-strong)]/30",
        severity === "info" && "border-[var(--admin-border)]"
      )}
    >
      <div className="flex items-start gap-3">
        <AdminIconBadge icon={SeverityIcon} tone={tone} className="size-8" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-[15px] font-semibold leading-snug text-[var(--admin-heading)]">
              {title}
            </p>
            <AdminStatusBadge value={severityLabel(severity)} tone={tone} />
          </div>
          <p className="dashboard-attention-detail mt-1.5 text-sm leading-5 text-[var(--admin-text-muted)]">
            {detail}
          </p>
          {impact ? (
            <p className="dashboard-attention-impact mt-1 text-[13px] leading-5 text-[var(--admin-text-muted)]">
              {impact}
            </p>
          ) : null}
        </div>
      </div>

      <div className="dashboard-attention-meta flex flex-col items-stretch gap-2 sm:pl-11">
        {date || ageLabel ? (
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--admin-text-muted)]">
            {[date, ageLabel].filter(Boolean).join(" - ")}
          </span>
        ) : null}
        <div className="flex w-full flex-wrap items-center gap-2">
          {href ? (
            <Link
              href={href}
              className="inline-flex min-h-11 min-w-[8.5rem] items-center justify-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-3.5 text-[13px] font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 sm:min-h-9"
            >
              {primaryLabel}
            </Link>
          ) : (
            <span className="inline-flex min-h-11 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3.5 text-[13px] text-[var(--admin-restricted)] sm:min-h-9">
              Restricted
            </span>
          )}
          {secondaryHref ? (
            <Link
              href={secondaryHref}
              className="inline-flex min-h-11 min-w-[7.5rem] items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3.5 text-[13px] font-medium text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 sm:min-h-9"
            >
              {secondaryLabel ?? "Details"}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type SnapshotAppointment = {
  id?: string;
  time: string;
  endTime?: string;
  title: string;
  detail: string;
  status: string;
  href: string | null;
  // Coordinator-emphasis extras (optional; populated only for coordinator variant
  // where unassigned-first sort + assignment chip apply).
  assignmentStatus?: string;
  bookingStatus?: string;
  requiredGender?: string | null;
};

type SnapshotUpcoming = SnapshotAppointment & { date: string };

export interface TodayCoordinatorCounts {
  unassigned: number;
  confirmed: number;
  pending: number;
}

export function TodayAtAGlanceCard({
  appointments,
  upcomingAppointments,
  rangeKind,
  rangeLabel,
  dailySeries,
  filterQuery,
  scopeCount,
  todayView = "list",
  nextAppointment,
  todayCount,
  weekCount,
  permissionAccess,
  readiness,
  unassignedFirst = false,
  coordinatorCounts,
  revenueAllowed,
  showPaymentsReadiness = true,
}: {
  appointments: SnapshotAppointment[];
  upcomingAppointments?: SnapshotUpcoming[];
  rangeKind?: string;
  rangeLabel?: string;
  dailySeries?: number[];
  filterQuery?: string;
  scopeCount?: number;
  todayView?: "list" | "timeline";
  nextAppointment?: { date: string; time: string; title: string } | null;
  todayCount: number;
  weekCount: number;
  permissionAccess?: { bookings: boolean; calendar: boolean };
  readiness: {
    confirmations: string;
    staffCoverage: string;
    paymentCollection: string;
  };
  unassignedFirst?: boolean;
  coordinatorCounts?: TodayCoordinatorCounts;
  revenueAllowed?: boolean;
  showPaymentsReadiness?: boolean;
}) {
  const isToday = rangeKind === "today" || rangeKind === undefined;
  const qs = filterQuery ? `?${filterQuery}` : "";
  const heroCount = isToday ? todayCount : (scopeCount ?? appointments.length);
  const heroAriaLabel = isToday
    ? `${heroCount} booking${heroCount === 1 ? "" : "s"} today`
    : `${heroCount} booking${heroCount === 1 ? "" : "s"} in ${rangeLabel ?? "this range"}`;
  const upcomingCount = isToday ? weekCount : (upcomingAppointments?.length ?? 0);
  // Coordinator variant uses brief-spec H2 "Today" instead of eyebrow.
  const useCoordinatorHeading = unassignedFirst && isToday;
  const eyebrowLabel = isToday
    ? "SNAPSHOT · TODAY"
    : `SNAPSHOT · ${(rangeLabel ?? "").toUpperCase()}`;
  // Marquee size: Coordinator uses brief-spec 3.157rem; on 0-state, downsize so
  // the absence of work doesn't shout (V-1, brief PRODUCT.md anti-marquee on empty).
  const marqueeFontSize = useCoordinatorHeading
    ? heroCount === 0
      ? "clamp(1.5rem, 2.5vw, 1.875rem)"
      : "clamp(2rem, 3.5vw, 3.157rem)"
    : "clamp(2.75rem, 6vw, 4.5rem)";
  // B-01 (audit #01) — the Coordinator "Snapshot" marquee appeared to render a
  // literal "()" between the "Today" heading and the value. Nothing in the DOM
  // is parenthesised: the branch above is the only place the marquee drops to
  // ~24-30px, and at that size `.admin-display` (Cormorant Garamond) renders
  // its `0` with the hairline apex/base washed out by antialiasing — measured
  // at 33-66% of the side-stem darkness, against ~100% at the 44-72px sizes
  // every other variant uses. What survives is the two thick side stems, which
  // read as "()". The digit is right; the display face is not legible at this
  // size. Keep the deliberate 0-state downsize and render that one state in the
  // UI sans face, whose `0` is unambiguous at any size.
  const marqueeUsesDisplayFace = !(useCoordinatorHeading && heroCount === 0);

  return (
    <AdminDashboardPanel className="min-h-[22rem]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex items-center gap-3">
            <AdminIconBadge icon={CalendarDays} tone="default" className="size-9" />
            <div className="min-w-0">
              {useCoordinatorHeading ? (
                <h2 className="text-lg font-semibold leading-snug text-[var(--admin-heading)]">
                  Today
                </h2>
              ) : (
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-text-muted)]">
                  {eyebrowLabel}
                </h2>
              )}
              <p
                className={cn(
                  marqueeUsesDisplayFace ? "admin-display" : "font-sans",
                  "font-semibold leading-none text-[var(--admin-heading)] tabular-nums [font-variant-numeric:tabular-nums_lining-nums]"
                )}
                style={{ fontSize: marqueeFontSize }}
                aria-label={heroAriaLabel}
                title={isToday ? `${heroCount} booking${heroCount === 1 ? "" : "s"} today` : heroAriaLabel}
              >
                {heroCount}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pb-1">
            <div className="text-sm text-[var(--admin-text-muted)]">
              <span className="font-semibold text-[var(--admin-heading)] tabular-nums">{upcomingCount}</span>{" "}
              {/*
               * Label honesty (audit-fix 2026-05-25): upcomingCount is
               * computed page-side as `addBusinessDays(today, 7)` — rolling
               * 7 business days forward, NOT calendar Mon-Sun. Previous
               * "this week" copy mis-named the data. The forward-7-day shape
               * is the right operational signal; only the label was wrong.
               */}
              {isToday ? "next 7 days" : "upcoming"}
            </div>
            {dailySeries && dailySeries.length > 1 && dailySeries.some((v) => v > 0) ? (
              <Sparkline points={dailySeries.slice(-7)} />
            ) : null}
          </div>
          {isToday && coordinatorCounts ? (
            <TodayCoordinatorSubLine counts={coordinatorCounts} />
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:shrink-0">
          {permissionAccess?.calendar ? (
            <Link className="admin-action-outline justify-center" href={`/admin/calendar${qs}`}>
              View calendar
            </Link>
          ) : null}
          {permissionAccess?.bookings ? (
            <Link className="admin-action-primary justify-center" href={`/admin/bookings${qs}`}>
              View bookings
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        {isToday && appointments.length > 0 ? (
          <SnapshotViewToggle currentView={todayView} filterQuery={filterQuery} />
        ) : null}

        {!isToday ? (
          <UpcomingRangeList
            appointments={upcomingAppointments ?? []}
            rangeLabel={rangeLabel ?? "this range"}
            filterQuery={filterQuery}
            canViewBookings={permissionAccess?.bookings ?? false}
          />
        ) : todayView === "timeline" ? (
          <TodayTimeline appointments={appointments} nextAppointment={nextAppointment} />
        ) : (
          <TodayList
            appointments={appointments}
            nextAppointment={nextAppointment}
            canViewCalendar={permissionAccess?.calendar ?? false}
            unassignedFirst={unassignedFirst}
          />
        )}
      </div>

      <div
        className="mt-5 grid gap-y-1.5 gap-x-4 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3 sm:flex sm:flex-wrap sm:items-center"
        aria-label="Day readiness"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-text-muted)]">
          Ready
        </span>
        <ReadinessChip icon={Mail} label="Confirmations" value={readiness.confirmations} />
        <ReadinessChip icon={Users} label="Coverage" value={readiness.staffCoverage} />
        {showPaymentsReadiness && revenueAllowed !== false ? (
          <ReadinessChip icon={PoundSterling} label="Payments" value={readiness.paymentCollection} />
        ) : null}
      </div>
    </AdminDashboardPanel>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const width = 80;
  const height = 24;
  const max = Math.max(...points, 1);
  const step = width / (points.length - 1);
  const path = points
    .map((v, i) => {
      const x = i * step;
      const y = height - (v / max) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const lastX = (points.length - 1) * step;
  const lastY = height - (points[points.length - 1] / max) * height;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="7-day booking trend"
      className="shrink-0"
    >
      <path d={path} fill="none" stroke="var(--admin-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <circle cx={lastX} cy={lastY} r="2.25" fill="var(--admin-success)" />
    </svg>
  );
}

function SnapshotViewToggle({ currentView, filterQuery }: { currentView: "list" | "timeline"; filterQuery?: string }) {
  const baseParams = new URLSearchParams(filterQuery ?? "");
  const listParams = new URLSearchParams(baseParams);
  listParams.delete("todayView");
  const timelineParams = new URLSearchParams(baseParams);
  timelineParams.set("todayView", "timeline");
  const listHref = `/admin/dashboard?${listParams.toString()}`;
  const timelineHref = `/admin/dashboard?${timelineParams.toString()}`;
  return (
    <div
      role="group"
      aria-label="Today view mode"
      className="mb-3 inline-flex items-center gap-0.5 rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel)] p-0.5"
    >
      <Link
        href={listHref}
        scroll={false}
        aria-current={currentView === "list" ? "page" : undefined}
        className={cn(
          "inline-flex min-h-11 h-7 sm:min-h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors",
          currentView === "list"
            ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
            : "text-[var(--admin-text-muted)] hover:text-[var(--admin-body)]"
        )}
      >
        List
      </Link>
      <Link
        href={timelineHref}
        scroll={false}
        aria-current={currentView === "timeline" ? "page" : undefined}
        className={cn(
          "inline-flex min-h-11 h-7 sm:min-h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors",
          currentView === "timeline"
            ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
            : "text-[var(--admin-text-muted)] hover:text-[var(--admin-body)]"
        )}
      >
        Timeline
      </Link>
    </div>
  );
}

function TodayList({
  appointments,
  nextAppointment,
  canViewCalendar,
  unassignedFirst = false,
}: {
  appointments: SnapshotAppointment[];
  nextAppointment?: { date: string; time: string; title: string } | null;
  canViewCalendar: boolean;
  unassignedFirst?: boolean;
}) {
  if (appointments.length === 0) {
    const title = unassignedFirst ? "Quiet day" : "No appointments today";
    const message = unassignedFirst
      ? "Nothing scheduled. Use the time to follow up on enquiries."
      : nextAppointment
        ? `Next booking: ${nextAppointment.date} at ${nextAppointment.time}`
        : "Enjoy a quiet day. Great time for admin and planning.";
    return (
      <div className="flex flex-col items-center px-4 py-8 text-center">
        <CalendarDays className="mb-3 size-7 text-[var(--admin-text-muted)]" aria-hidden="true" />
        <p className="text-base font-semibold text-[var(--admin-heading)]">{title}</p>
        <p className="mt-1 max-w-[45ch] text-sm leading-6 text-[var(--admin-text-muted)]">
          {message}
        </p>
        {unassignedFirst ? (
          <Link
            href="/admin/enquiries"
            className="mt-4 inline-flex min-h-10 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 text-sm font-semibold text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
          >
            Open enquiries
          </Link>
        ) : null}
      </div>
    );
  }
  const ordered = unassignedFirst
    ? [...appointments].sort((a, b) => {
        const aUn = a.assignmentStatus === "unassigned" ? 0 : 1;
        const bUn = b.assignmentStatus === "unassigned" ? 0 : 1;
        if (aUn !== bUn) return aUn - bUn;
        return a.time.localeCompare(b.time);
      })
    : appointments;
  const visible = ordered.slice(0, 5);
  return (
    <div className="grid gap-2">
      {visible.map((a) => (
        <SnapshotListRow
          key={a.id ?? `${a.time}-${a.title}-${visible.indexOf(a)}`}
          appointment={a}
          showAssignmentChip={unassignedFirst}
        />
      ))}
      {appointments.length > 5 ? (
        <div className="pt-1">
          {canViewCalendar ? (
            <Link className="admin-link-action text-sm" href="/admin/calendar">
              See all {appointments.length} for today →
            </Link>
          ) : (
            <Link className="admin-link-action text-sm" href="/admin/bookings?view=today">
              See all {appointments.length} for today →
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}

function UpcomingRangeList({
  appointments,
  rangeLabel,
  filterQuery,
  canViewBookings,
}: {
  appointments: SnapshotUpcoming[];
  rangeLabel: string;
  filterQuery?: string;
  canViewBookings: boolean;
}) {
  const qs = filterQuery ? `?${filterQuery}` : "";
  if (appointments.length === 0) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          icon={CalendarDays}
          title={`No upcoming appointments in ${rangeLabel}`}
          message="Once bookings are scheduled they will appear here."
          tone="muted"
        />
      </div>
    );
  }
  const visible = appointments.slice(0, 5);
  return (
    <div className="grid gap-2">
      {visible.map((a) => (
        <SnapshotListRow key={a.id ?? `${a.date}-${a.time}-${a.title}-${visible.indexOf(a)}`} appointment={a} withDate />
      ))}
      {appointments.length > 5 && canViewBookings ? (
        <div className="pt-1">
          <Link className="admin-link-action text-sm" href={`/admin/bookings${qs}`}>
            See all {appointments.length} in {rangeLabel} →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function SnapshotListRow({
  appointment,
  withDate = false,
  showAssignmentChip = false,
}: {
  appointment: SnapshotAppointment & { date?: string };
  withDate?: boolean;
  showAssignmentChip?: boolean;
}) {
  const isUnconfirmed = appointment.status !== "fully_assigned";
  const isUnassigned = appointment.assignmentStatus === "unassigned";
  // C-13 Phase A (brief §2.1) — dashboard data collapses a booking's
  // participants to one gender value upstream (`deriveRequiredGenderByBooking`
  // in `CoordinatorDashboard.tsx`, Phase H), so the rephrase here is a
  // single-axis swap of the static string for the specific gender rather than
  // a `composeGenderRequirementChip` call (which needs a participants array
  // this data layer doesn't expose). Phase H (brief §5.11 b) added the
  // "mixed" marker for groups whose participants don't all need the same
  // gender — collapsed here to a generic label rather than surfacing a full
  // per-gender breakdown.
  const requiredGender = isUnassigned ? (appointment.requiredGender ?? null) : null;
  const timeRange = appointment.endTime ? `${appointment.time}–${appointment.endTime}` : appointment.time;
  const dateChip = withDate && appointment.date ? formatRowDate(appointment.date) : null;
  const initials = getInitials(appointment.title);
  const tintStyle = avatarTintStyle(appointment.title);
  const assignmentLabel = !requiredGender
    ? "Unassigned"
    : requiredGender === "mixed"
      ? "Unassigned · Mixed group"
      : `Unassigned · Needs ${requiredGender} therapist`;

  const content = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 py-2.5 transition-[background-color,box-shadow,transform] duration-150",
        appointment.href && "hover:-translate-y-px hover:bg-[var(--admin-panel-muted)]/60 hover:shadow-[var(--admin-shadow-subtle)]"
      )}
      title={`${dateChip ? `${dateChip} · ` : ""}${timeRange} · ${appointment.title}${isUnconfirmed ? " (awaiting confirmation)" : ""}`}
    >
      {showAssignmentChip && isUnassigned ? (
        <div
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-hover,var(--admin-panel-muted))] text-[var(--admin-warning)]"
          aria-hidden="true"
          title="No therapist assigned yet"
        >
          <UserX className="size-4" />
        </div>
      ) : (
        <div
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={tintStyle}
          aria-hidden="true"
        >
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {isUnconfirmed ? (
            <span aria-label="Awaiting confirmation" className="inline-block size-1.5 shrink-0 rounded-full bg-[var(--admin-accent)]" />
          ) : null}
          <p className="truncate text-sm font-semibold text-[var(--admin-heading)]">{appointment.title}</p>
        </div>
        <p className="truncate text-xs text-[var(--admin-text-muted)]">
          {dateChip ? <span className="font-medium text-[var(--admin-body)]">{dateChip} · </span> : null}
          <span className="tabular-nums">{timeRange}</span>
          {appointment.detail ? <span> · {appointment.detail}</span> : null}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
          {showAssignmentChip && isUnassigned ? (
            <AssignmentChip label={assignmentLabel} requiredGender={requiredGender} />
          ) : (
            <AdminStatusBadge
              value={appointment.status}
              tone={appointment.status === "fully_assigned" ? "success" : "warning"}
              className="text-[10px]"
            />
          )}
        </div>
      </div>
      {showAssignmentChip && isUnassigned ? (
        <AssignmentChip
          label={assignmentLabel}
          requiredGender={requiredGender}
          className="hidden shrink-0 sm:inline-flex"
        />
      ) : (
        <AdminStatusBadge
          value={appointment.status}
          tone={appointment.status === "fully_assigned" ? "success" : "warning"}
          className="hidden shrink-0 sm:inline-flex"
        />
      )}
    </div>
  );

  return appointment.href ? (
    <Link href={appointment.href} className="block outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35 rounded-[var(--admin-radius-card)]">
      {content}
    </Link>
  ) : (
    content
  );
}

function formatRowDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" }).format(d);
}

function AssignmentChip({
  label,
  requiredGender,
  className,
}: {
  label: string;
  requiredGender: string | null;
  className?: string;
}) {
  // Brief Section 5.3 calls for Attention family; in this codebase Attention is
  // aliased to --admin-warning (same hue family per tokens.css).
  // C-13 Phase A logged this tooltip as stale (fixed value "same-gender
  // therapist" beside a visible label that already names the specific
  // gender); Phase H closes it and adds the "mixed" case the visible label
  // gained at the same time.
  const title = !requiredGender
    ? "Open the booking to assign a therapist"
    : requiredGender === "mixed"
      ? "This group needs therapists of more than one gender"
      : `Needs a ${requiredGender} therapist`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-[var(--admin-warning-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--admin-warning)]",
        className
      )}
      title={title}
    >
      <UserX className="size-3" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function TodayCoordinatorSubLine({ counts }: { counts: TodayCoordinatorCounts }) {
  const unassignedTone =
    counts.unassigned > 0 ? "text-[var(--admin-warning)]" : "text-[var(--admin-success)]";
  return (
    <p className="basis-full text-sm text-[var(--admin-text-muted)]">
      <span className="text-[var(--admin-text-muted)]/85">of which </span>
      <span
        className={cn("inline-flex items-center gap-1 font-semibold tabular-nums", unassignedTone)}
        title="These bookings need a therapist"
      >
        {counts.unassigned > 0 ? (
          <AlertCircle className="size-3" aria-hidden="true" />
        ) : null}
        {counts.unassigned} unassigned
      </span>
      <span aria-hidden="true"> · </span>
      <span className="font-semibold tabular-nums text-[var(--admin-success)]">
        {counts.confirmed} confirmed
      </span>
      <span aria-hidden="true"> · </span>
      <span className="font-semibold tabular-nums text-[var(--admin-body)]">
        {counts.pending} pending
      </span>
    </p>
  );
}

export type ActiveEnquirySource = "website" | "phone" | "whatsapp" | "instagram" | "referral" | "admin" | "manual" | "other" | string;
export type ActiveEnquiryStatus = "new" | "contacted" | string;

export interface ActiveEnquiryRow {
  id: string;
  fullName: string;
  source: ActiveEnquirySource;
  status: ActiveEnquiryStatus;
  createdAt: string;
}

function enquirySourceIcon(source: ActiveEnquirySource): {
  Icon: React.ElementType;
  label: string;
} {
  const normalized = source.toLowerCase();
  if (normalized === "phone") return { Icon: Phone, label: "From phone" };
  if (normalized === "whatsapp" || normalized === "sms") return { Icon: MessageSquare, label: "From WhatsApp" };
  if (normalized === "instagram") return { Icon: AtSign, label: "From Instagram" };
  if (normalized === "website") return { Icon: Globe, label: "From website" };
  if (normalized === "referral") return { Icon: UserRound, label: "From referral" };
  return { Icon: Mail, label: `From ${source}` };
}

function formatEnquiryAge(iso: string): string {
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return "";
  const diffMs = Date.now() - created.getTime();
  const diffMin = Math.max(1, Math.round(diffMs / 60000));
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return "1 day ago";
  if (diffDay < 7) return `${diffDay} days ago`;
  const diffWk = Math.round(diffDay / 7);
  if (diffWk === 1) return "1 wk ago";
  return `${diffWk} wks ago`;
}

export function ActiveEnquiriesCard({
  enquiries,
  totalActive,
  canManageEnquiries,
  hasAnyHandled,
}: {
  enquiries: ActiveEnquiryRow[];
  totalActive: number;
  canManageEnquiries: boolean;
  hasAnyHandled?: boolean;
}) {
  const visible = enquiries.slice(0, 2);
  return (
    <AdminDashboardPanel className="min-h-[18rem] bg-[var(--admin-canvas)]">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-start gap-3">
          <AdminIconBadge icon={UserRound} tone="info" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-snug text-[var(--admin-heading)]">
              Active enquiries
            </h3>
            <p
              className="admin-display font-semibold leading-none text-[var(--admin-heading)] tabular-nums [font-variant-numeric:tabular-nums_lining-nums]"
              style={{ fontSize: "clamp(1.625rem, 2.5vw, 1.875rem)" }}
              aria-label={`${totalActive} active ${totalActive === 1 ? "enquiry" : "enquiries"}`}
              title={`${totalActive} active ${totalActive === 1 ? "enquiry" : "enquiries"}`}
            >
              {totalActive}
            </p>
            <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
              {totalActive === 1 ? "needs follow-up" : "need follow-up"}
            </p>
          </div>
        </div>
        {canManageEnquiries ? (
          <Link
            className="admin-link-action inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm"
            href="/admin/enquiries"
            aria-label="Open all enquiries"
          >
            <ArrowRight className="size-3.5" aria-hidden="true" />
            <span>All enquiries</span>
          </Link>
        ) : null}
      </div>

      {totalActive === 0 ? (
        <div className="mt-4 flex flex-col items-center px-4 py-8 text-center">
          <UserRound className="mb-3 size-7 text-[var(--admin-text-muted)]" aria-hidden="true" />
          <p className="text-base font-semibold text-[var(--admin-heading)]">
            {hasAnyHandled ? "All enquiries handled" : "No active enquiries"}
          </p>
          <p className="mt-1 max-w-[45ch] text-sm leading-6 text-[var(--admin-text-muted)]">
            {hasAnyHandled
              ? "New leads will show up here."
              : "Anything new will appear here when it lands."}
          </p>
        </div>
      ) : (
        <ul className="mt-4 grid list-none gap-2 pl-0">
          {visible.map((enquiry) => {
            const { Icon, label } = enquirySourceIcon(enquiry.source);
            const lifecycleLabel = enquiry.status === "contacted" ? "Contacted" : "New";
            const lifecycleTitle =
              enquiry.status === "contacted"
                ? "Contacted: a response is pending"
                : "New: hasn't been contacted yet";
            const convertHref = canManageEnquiries
              ? `/admin/bookings/new?enquiryId=${encodeURIComponent(enquiry.id)}`
              : null;
            const initials = getInitials(enquiry.fullName || "New enquiry");
            const tint = avatarTintStyle(enquiry.fullName || enquiry.id);
            return (
              <li key={enquiry.id}>
                <div className="flex flex-wrap items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 py-2.5 sm:flex-nowrap">
                  <span
                    className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={tint}
                    aria-hidden="true"
                  >
                    {initials}
                    <span
                      className="absolute -bottom-0.5 -right-0.5 inline-flex size-4 items-center justify-center rounded-full bg-[var(--admin-canvas)] text-[var(--admin-text-muted)] ring-1 ring-[var(--admin-border)]"
                      title={label}
                    >
                      <Icon className="size-2.5" />
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--admin-heading)]">
                      {enquiry.fullName || "New enquiry"}
                    </p>
                    <p className="truncate text-xs text-[var(--admin-text-muted)]">
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-warning-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--admin-warning)]"
                        title={lifecycleTitle}
                      >
                        <Clock className="size-2.5" aria-hidden="true" />
                        {lifecycleLabel}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>{label}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="tabular-nums">{formatEnquiryAge(enquiry.createdAt)}</span>
                    </p>
                  </div>
                  {convertHref ? (
                    <Link
                      href={convertHref}
                      className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 text-sm font-semibold text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35 sm:w-auto"
                      title="Open the booking form with this enquiry pre-filled"
                    >
                      <span>Convert</span>
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AdminDashboardPanel>
  );
}

function TodayTimeline({
  appointments,
  nextAppointment,
}: {
  appointments: SnapshotAppointment[];
  nextAppointment?: { date: string; time: string; title: string } | null;
}) {
  const timeTicks = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
  if (appointments.length === 0) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          icon={CalendarDays}
          title="No appointments today"
          message={
            nextAppointment
              ? `Next booking: ${nextAppointment.date} at ${nextAppointment.time}`
              : "Enjoy a quiet day. Great time for admin and planning."
          }
          tone="muted"
        />
      </div>
    );
  }
  return (
    <div className="hidden sm:block">
      <div className="grid grid-cols-7 text-center text-sm font-semibold text-[var(--admin-text-muted)] tabular-nums">
        {timeTicks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
      <div className="relative mt-2 h-[8rem] overflow-visible">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0, transparent calc(8.333% - 1px), var(--admin-border) calc(8.333% - 1px), var(--admin-border) 8.333%)",
            opacity: 0.75,
          }}
        />
        {appointments.map((appointment) => {
          const isUnconfirmed = appointment.status !== "fully_assigned";
          const timeRange = appointment.endTime ? `${appointment.time}–${appointment.endTime}` : appointment.time;
          const content = (
            <span
              className={cn(
                "flex items-center gap-1.5 truncate rounded-[var(--admin-radius-control)] border px-3 py-2 text-xs font-semibold shadow-[var(--admin-shadow-subtle)] transition-colors tabular-nums",
                isUnconfirmed
                  ? "border-[var(--admin-warning-bg)] bg-[var(--admin-warning-bg)]/45 text-[var(--admin-heading)] hover:bg-[var(--admin-warning-bg)]/70"
                  : "border-[var(--admin-border)] bg-[var(--admin-success-bg)] text-[var(--admin-primary)] hover:bg-[var(--admin-success-bg)]/80"
              )}
              title={`${timeRange} · ${appointment.title}${isUnconfirmed ? " (awaiting confirmation)" : ""}`}
            >
              {isUnconfirmed ? (
                <span aria-label="Awaiting confirmation" className="inline-block size-1.5 shrink-0 rounded-full bg-[var(--admin-accent)]" />
              ) : null}
              <span className="truncate">{timeRange}</span>
            </span>
          );
          const style = appointmentStyle(appointment.time, appointment.endTime);
          return appointment.href ? (
            <Link
              key={appointment.id ?? `${appointment.time}-${appointment.title}`}
              href={appointment.href}
              className="absolute top-8 min-w-[7rem] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
              style={style}
            >
              {content}
            </Link>
          ) : (
            <div
              key={appointment.id ?? `${appointment.time}-${appointment.title}`}
              className="absolute top-8 min-w-[7rem]"
              style={style}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const TodayAgendaCard = TodayAtAGlanceCard;

function ReadinessChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm text-[var(--admin-body)]"
      title={`${label}: ${value}`}
    >
      <Icon aria-hidden="true" className="size-3.5 text-[var(--admin-text-muted)]" />
      <span className="font-medium text-[var(--admin-heading)]">{label}</span>
      <span className="text-[var(--admin-text-muted)]">{value}</span>
    </span>
  );
}

export function UrgentAttentionPanel({
  rows,
  groups,
  filterQuery,
}: {
  rows: AttentionSummaryRow[];
  groups: AttentionGroup[];
  filterQuery?: string;
}) {
  const severityRank: Record<string, number> = { critical: 0, warning: 1, info: 2, clear: 3 };
  const sortedRows = [...rows].sort(
    (a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9)
  );
  const activeRows = sortedRows.filter((r) => r.severity !== "clear");
  const clearRows = sortedRows.filter((r) => r.severity === "clear");
  const visibleRows = activeRows.slice(0, 5);
  const activeGroups = groups.filter((group) => group.count > 0);
  const allClear = rows.length > 0 && activeRows.length === 0;
  const qs = filterQuery ? `?${filterQuery}` : "";
  const appendFilterQuery = (href?: string | null) => {
    if (!href) return href ?? null;
    if (!filterQuery) return href;
    return href.includes("?") ? `${href}&${filterQuery}` : `${href}${qs}`;
  };

  return (
    <AdminDashboardPanel className="min-h-[22rem]">
      <AdminPanelHeader
        icon={ShieldAlert}
        title="Needs your attention"
        description={allClear ? undefined : "High priority signals that may need your action."}
        tone={visibleRows.some((row) => row.severity === "critical") ? "danger" : allClear ? "default" : "warning"}
      />

      {allClear ? (
        <div className="mt-5 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-success-bg)]/35 px-5 py-10">
          <EmptyState
            icon={ShieldAlert}
            title="All caught up"
            message="Nothing needs your attention right now."
            tone="muted"
          />
        </div>
      ) : (
      <div className="mt-5 grid gap-2">
        {visibleRows.map((row) => {
          const tone = severityTone(row.severity);
          const href = appendFilterQuery(row.href);
          const content = (
            <div
              className={cn(
                "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--admin-radius-card)] border px-4 py-3 transition-[background-color,border-color] duration-150",
                row.severity === "critical" && "border-[var(--admin-status-cancelled-border)] bg-[var(--admin-status-cancelled-bg)]/30",
                row.severity === "warning" && "border-[var(--admin-status-attention-border)] bg-[var(--admin-status-attention-bg)]/30",
                row.severity === "info" && "border-[var(--admin-border)] bg-[var(--admin-panel)]",
                row.severity === "clear" && "border-[var(--admin-status-confirmed-border)] bg-[var(--admin-status-confirmed-bg)]/20",
                href && "hover:-translate-y-px hover:shadow-[var(--admin-shadow-subtle)]"
              )}
            >
              <AdminIconBadge
                icon={row.severity === "critical" ? Mail : row.key.includes("staff") ? UserRound : Wrench}
                tone={tone}
                className="size-9"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--admin-heading)]">
                  {row.label}
                </p>
                <p className="truncate text-sm text-[var(--admin-text-muted)]">{row.detail}</p>
              </div>
              <div className="grid justify-items-end gap-1">
                <p className="text-2xl font-semibold leading-none text-[var(--admin-heading)] tabular-nums">
                  {row.count}
                </p>
                <span
                  className={cn(
                    "text-xs font-semibold",
                    row.severity === "critical" && "text-[var(--admin-danger)]",
                    row.severity === "warning" && "text-[var(--admin-warning)]",
                    row.severity === "clear" && "text-[var(--admin-success)]"
                  )}
                >
                  {severityLabel(row.severity)}
                </span>
                <AdminSeverityMeter
                  value={severityMeterValue(row)}
                  tone={tone}
                  label={`${row.label}: ${severityLabel(row.severity)}`}
                />
              </div>
            </div>
          );

          return href ? (
            <Link key={row.key} href={href} className="block outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35 rounded-[var(--admin-radius-card)]">
              {content}
            </Link>
          ) : (
            <div key={row.key}>{content}</div>
          );
        })}
      </div>
      )}

      {!allClear && clearRows.length > 0 ? (
        <p className="mt-5 border-t border-[var(--admin-border)]/60 pt-3 text-xs text-[var(--admin-text-muted)]">
          <span className="font-semibold uppercase tracking-[0.1em] text-[var(--admin-success)]">All clear:</span>{" "}
          {clearRows.map((row) => row.label).join(" · ")}
        </p>
      ) : null}

      {!allClear && activeRows.length > 5 ? (
        <p className="mt-3 text-right text-xs text-[var(--admin-text-muted)]">
          Showing top 5. <span className="font-semibold text-[var(--admin-body)]">{activeRows.length - 5} more</span> in review.
        </p>
      ) : null}

      {!allClear ? (
        <div className="mt-5">
          <AttentionReviewButton
            groups={activeGroups.length > 0 ? activeGroups : groups}
            label={rows.length > 5 ? `See all ${rows.length} signals →` : undefined}
          />
        </div>
      ) : null}
    </AdminDashboardPanel>
  );
}

export function StaffCapacityCard({
  genderCapacity,
  staffWorkload,
  permissionAccess,
}: {
  genderCapacity: {
    gender: string;
    label: string;
    activeTherapists: number;
    totalAssignments: number;
    unassignedAssignments: number;
  }[];
  staffWorkload: { staffName: string; assignments: number; completed: number }[];
  permissionAccess?: { staff: boolean; bookings?: boolean };
}) {
  const totalUnassigned = genderCapacity.reduce((sum, row) => sum + row.unassignedAssignments, 0);
  const totalAssignments = genderCapacity.reduce((sum, row) => sum + row.totalAssignments, 0);
  const totalSlots = totalAssignments + totalUnassigned;
  const overallUtilisation = totalSlots > 0 ? safeDivide(totalAssignments, totalSlots) : 0;
  const openSlots = totalUnassigned;

  return (
    <AdminDashboardPanel className="min-h-[22rem]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AdminIconBadge icon={Users} tone="default" />
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-text-muted)]">
              Staff capacity
            </h3>
            <p
              className="admin-display font-semibold leading-none text-[var(--admin-heading)] tabular-nums"
              style={{ fontSize: "clamp(1.625rem, 2.5vw, 1.875rem)" }}
            >
              {formatPercent(overallUtilisation)}
            </p>
            <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
              {staffWorkload.length} active · {totalAssignments}/{totalSlots} slots
            </p>
          </div>
        </div>
        {permissionAccess?.staff && (
          <Link
            href="/admin/staff"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
          >
            Manage
            <ChevronRight className="size-4" />
          </Link>
        )}
      </div>

      {/* Overall utilisation */}
      {genderCapacity.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">
              Overall utilisation
            </span>
            <span className="text-sm font-bold text-[var(--admin-heading)]">
              {totalAssignments}/{totalSlots} slots
            </span>
          </div>
          <AdminProgressBar
            value={overallUtilisation}
            label="Overall utilisation"
            tone={totalUnassigned > 0 ? "warning" : "success"}
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs font-semibold text-[var(--admin-success)]">
              {formatPercent(overallUtilisation)} utilised
            </span>
            <span className="text-xs text-[var(--admin-text-muted)]">
              {openSlots} slots open
            </span>
          </div>
        </div>
      )}

      {/* Staff list */}
      <div className="mt-4 grid gap-3">
        {staffWorkload.length > 0 ? (
          staffWorkload.map((staff) => {
            const initials = getInitials(staff.staffName);
            const tintStyle = avatarTintStyle(staff.staffName);
            const workloadPercent = staff.assignments > 0
              ? safeDivide(staff.completed, staff.assignments)
              : 0;
            const isNearFull = workloadPercent >= 75 && workloadPercent < 100;
            const isOverloaded = workloadPercent >= 100;
            const statusText = isOverloaded
              ? "Near full"
              : isNearFull
                ? "Near full"
                : workloadPercent > 0
                  ? "Active"
                  : "Staff gap";
            const statusTone = isOverloaded || isNearFull
              ? "warning"
              : workloadPercent > 0
                ? "success"
                : "danger";

            return (
              <div
                key={staff.staffName}
                className="flex items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 py-3"
                title={`${staff.staffName}: ${staff.completed} of ${staff.assignments} bookings completed (${formatPercent(workloadPercent)}) - ${statusText}`}
              >
                <div
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={tintStyle}
                  aria-hidden="true"
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--admin-heading)] truncate">
                      {staff.staffName}
                    </p>
                    <AdminStatusBadge
                      value={statusText}
                      tone={statusTone}
                      className="shrink-0 text-[10px]"
                    />
                  </div>
                  <AdminProgressBar
                    value={workloadPercent}
                    label={`${staff.staffName} workload`}
                    tone={statusTone}
                    className="mt-2"
                  />
                </div>
                <p className="shrink-0 text-sm font-semibold text-[var(--admin-text-muted)]">
                  {staff.completed}/{staff.assignments} ({formatPercent(workloadPercent)})
                </p>
              </div>
            );
          })
        ) : (
          <EmptyState
            icon={Users}
            title="No staff assigned"
            message="No appointments scheduled in this period."
            tone="muted"
          />
        )}
      </div>

      {/* Footer action */}
      {permissionAccess?.staff && (
        <div className="mt-4">
          <Link
            href="/admin/staff"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)]/60 text-sm font-semibold text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35 sm:min-h-10"
          >
            <Plus className="size-4" />
            Add or manage staff
          </Link>
        </div>
      )}
    </AdminDashboardPanel>
  );
}

export function PaymentHealthCard({
  summary,
  unpaidCount,
  unpaidCompletedCount,
  revenueAllowed,
  canReviewBookings,
  canViewReports,
}: {
  summary: {
    bookedRevenue: number;
    collectedRevenue: number;
    outstandingRevenue: number;
  };
  unpaidCount: number;
  unpaidCompletedCount?: number;
  revenueAllowed: boolean;
  canReviewBookings?: boolean;
  canViewReports?: boolean;
}) {
  const total = Math.max(summary.bookedRevenue, summary.collectedRevenue + summary.outstandingRevenue);
  const hasActivity = total > 0 || unpaidCount > 0;
  const actionHref =
    revenueAllowed && canViewReports
      ? "/admin/reports"
      : canReviewBookings && unpaidCount > 0
        ? "/admin/bookings?payment_status=unpaid"
        : null;
  const collectionRate = total > 0 ? safeDivide(summary.collectedRevenue, total) : 0;

  return (
    <AdminDashboardPanel className="min-h-[22rem]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AdminIconBadge icon={PoundSterling} tone="default" />
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-text-muted)]">
              Payment health
            </h3>
            <p
              className="admin-display font-semibold leading-none text-[var(--admin-heading)] tabular-nums"
              style={{ fontSize: "clamp(1.625rem, 2.5vw, 1.875rem)" }}
            >
              {formatMoney(summary.outstandingRevenue)}
            </p>
            <p className="mt-1 text-sm text-[var(--admin-text-muted)]">Outstanding</p>
          </div>
        </div>
        {actionHref && (
          <Link
            href={actionHref}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
          >
            Details
            <ChevronRight className="size-4" />
          </Link>
        )}
      </div>

      {total > 0 ? (
          <div className="mt-4">
            {/* Row-based payment bars */}
            <div className="grid gap-3">
              {/* Booked */}
              <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-[var(--admin-info)]" />
                    <span className="text-sm font-semibold text-[var(--admin-heading)]">Booked</span>
                  </div>
                  <span className="text-lg font-bold text-[var(--admin-heading)]">
                    {formatMoney(summary.bookedRevenue)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--admin-progress-neutral)]">
                  <span className="block h-full rounded-full bg-[var(--admin-info)]" style={{ width: "100%" }} />
                </div>
                <div className="mt-1.5">
                  <span className="text-xs text-[var(--admin-text-muted)]">Total value of bookings</span>
                </div>
              </div>

              {/* Collected */}
              <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-[var(--admin-success)]" />
                    <span className="text-sm font-semibold text-[var(--admin-heading)]">Collected</span>
                  </div>
                  <span className="text-lg font-bold text-[var(--admin-heading)]">
                    {formatMoney(summary.collectedRevenue)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--admin-progress-neutral)]">
                  <span
                    className="block h-full rounded-full bg-[var(--admin-success)]"
                    style={{ width: `${collectionRate}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-xs text-[var(--admin-text-muted)]">Payments received</span>
                  <span className="text-xs font-medium text-[var(--admin-success)]">
                    {formatPercent(collectionRate)} collection rate
                  </span>
                </div>
              </div>

              {/* Outstanding */}
              <div
                className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3"
                title={`Outstanding: ${formatMoney(summary.outstandingRevenue)} awaiting collection across ${unpaidCount} booking${unpaidCount === 1 ? "" : "s"}${(unpaidCompletedCount ?? 0) > 0 ? ` (${unpaidCompletedCount} already completed)` : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-[var(--admin-warning)]" />
                    <span className="text-sm font-semibold text-[var(--admin-heading)]">Outstanding</span>
                  </div>
                  <span className="text-lg font-bold text-[var(--admin-heading)]">
                    {formatMoney(summary.outstandingRevenue)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--admin-progress-neutral)]">
                  <span
                    className="block h-full rounded-full bg-[var(--admin-warning)]"
                    style={{ width: `${total > 0 ? (summary.outstandingRevenue / total) * 100 : 0}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-xs text-[var(--admin-text-muted)]">Awaiting collection</span>
                  {summary.outstandingRevenue > 0 && (
                    <span className="text-xs font-medium text-[var(--admin-warning)]">Requires follow-up</span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <p className="mt-5 flex items-center gap-2 border-t border-[var(--admin-border)]/60 pt-3 text-xs text-[var(--admin-text-muted)]">
              <Info className="size-3.5" aria-hidden="true" />
              {hasActivity
                ? `${unpaidCount} unpaid booking${unpaidCount === 1 ? "" : "s"}${unpaidCompletedCount ? `, ${unpaidCompletedCount} completed` : ""}.`
                : "No financial activity in this period."}
            </p>
          </div>
      ) : (
        <div className="mt-4">
          <EmptyState
            icon={PoundSterling}
            title="No financial activity"
            message="Bookings and payments will appear here once there is activity in the selected range."
            tone="muted"
          />
        </div>
      )}
    </AdminDashboardPanel>
  );
}

export function OperationsHealthCard({
  failedEmails,
  openEnquiries,
  openOperations,
  availabilityGaps,
  permissionAccess,
}: {
  failedEmails: number;
  openEnquiries: number;
  openOperations: number;
  availabilityGaps: number;
  permissionAccess?: { emails: boolean; operations: boolean; staff: boolean; enquiries: boolean };
}) {
  type Severity = "critical" | "warning" | "info" | "clear";
  type Row = {
    key: string;
    icon: React.ElementType;
    label: string;
    value: number;
    severity: Severity;
    status: string;
    href: string | null;
  };

  const rows: Row[] = [
    {
      key: "emails",
      icon: Mail,
      label: "Emails",
      value: failedEmails,
      severity: failedEmails > 0 ? "critical" : "clear",
      status: failedEmails > 0 ? "Delivery failures" : "All clear",
      href: permissionAccess?.emails ? "/admin/emails" : null,
    },
    {
      key: "operations",
      icon: Wrench,
      label: "Operations",
      value: openOperations,
      severity: openOperations > 0 ? "warning" : "clear",
      status: openOperations > 0 ? "Open errors" : "All clear",
      href: permissionAccess?.operations ? "/admin/operations" : null,
    },
    {
      key: "staff",
      icon: Users,
      label: "Staff gaps",
      value: availabilityGaps,
      severity: availabilityGaps > 0 ? "warning" : "clear",
      status: availabilityGaps > 0 ? "Coverage gaps" : "Well covered",
      href: permissionAccess?.staff ? "/admin/staff" : null,
    },
    {
      key: "enquiries",
      icon: UserRound,
      label: "Enquiries",
      value: openEnquiries,
      severity: openEnquiries > 0 ? "info" : "clear",
      status: openEnquiries > 0 ? "Awaiting response" : "All clear",
      href: permissionAccess?.enquiries ? "/admin/enquiries?tab=new" : null,
    },
  ];

  const severityRank: Record<Severity, number> = { critical: 0, warning: 1, info: 2, clear: 3 };
  const sorted = [...rows].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  const activeRows = sorted.filter((row) => row.severity !== "clear");
  const clearRows = sorted.filter((row) => row.severity === "clear");
  const overall: { label: string; tone: "success" | "warning" | "danger" } = failedEmails > 0
    ? { label: "Needs attention", tone: "danger" }
    : openOperations > 0 || availabilityGaps > 0
      ? { label: "Needs attention", tone: "warning" }
      : { label: "All systems quiet", tone: "success" };

  return (
    <AdminDashboardPanel className="min-h-[22rem]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AdminIconBadge icon={HeartPulse} tone={overall.tone === "success" ? "success" : overall.tone === "danger" ? "danger" : "warning"} />
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-text-muted)]">
              Operations health
            </h3>
            <p
              className="admin-display font-semibold leading-none text-[var(--admin-heading)] tabular-nums [font-variant-numeric:tabular-nums_lining-nums]"
              style={{ fontSize: "clamp(1.625rem, 2.5vw, 1.875rem)" }}
            >
              {overall.tone === "success" ? 0 : activeRows.length}
            </p>
            <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
              {overall.tone === "success"
                ? "All systems quiet"
                : activeRows.length === 1
                  ? "active issue"
                  : "active issues"}
            </p>
          </div>
        </div>
        {/*
         * M2 fix (B-5): panel-level "View details" link removed; each row in
         * the priority list now carries its own href + visible "View →"
         * affordance (see below). Avoids the misleading "panel goes to one
         * place" cue when rows actually point to distinct destinations.
         */}
      </div>

      <div
        className={cn(
          "mt-4 flex items-center gap-3 rounded-[var(--admin-radius-card)] border px-4 py-3",
          overall.tone === "danger" && "border-[var(--admin-danger-bg)] bg-[var(--admin-danger-bg)]/40",
          overall.tone === "warning" && "border-[var(--admin-warning-bg)] bg-[var(--admin-warning-bg)]/40",
          overall.tone === "success" && "border-[var(--admin-success-bg)] bg-[var(--admin-success-bg)]/40"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-full",
            overall.tone === "danger" && "bg-[var(--admin-danger)] text-[var(--admin-on-primary)]",
            overall.tone === "warning" && "bg-[var(--admin-warning)] text-[var(--admin-on-primary)]",
            overall.tone === "success" && "bg-[var(--admin-success)] text-[var(--admin-on-primary)]"
          )}
        >
          <HeartPulse className="size-3.5" />
        </span>
        <p className="text-sm font-semibold text-[var(--admin-body)]">
          Overall status:{" "}
          <span
            className={cn(
              overall.tone === "danger" && "text-[var(--admin-danger)]",
              overall.tone === "warning" && "text-[var(--admin-warning)]",
              overall.tone === "success" && "text-[var(--admin-success)]"
            )}
          >
            {overall.label}
          </span>
        </p>
      </div>

      {activeRows.length > 0 ? (
        <ul className="mt-3 grid list-none gap-2 pl-0">
          {activeRows.map((row) => {
            const Icon = row.icon;
            const content = (
              <div
                className={cn(
                  "flex items-center gap-3 rounded-[var(--admin-radius-card)] border px-4 py-3 transition-colors",
                  // B-5 step 10: severity-strong tokens for stronger
                  // affordance per brief §5.5.
                  row.severity === "critical" && "border-[var(--admin-danger)] bg-[var(--admin-danger-bg-strong)]/40 hover:bg-[var(--admin-danger-bg-strong)]/60",
                  row.severity === "warning" && "border-[var(--admin-warning)] bg-[var(--admin-warning-bg-strong)]/40 hover:bg-[var(--admin-warning-bg-strong)]/60",
                  row.severity === "info" && "border-[var(--admin-border)] bg-[var(--admin-panel)] hover:bg-[var(--admin-panel-muted)]/60"
                )}
              >
                <AdminIconBadge
                  icon={Icon}
                  tone={row.severity === "critical" ? "danger" : row.severity === "warning" ? "warning" : "info"}
                  className="size-9"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--admin-heading)]">{row.label}</p>
                  <p className="truncate text-xs text-[var(--admin-text-muted)]">{row.status}</p>
                </div>
                <p
                  className={cn(
                    "text-xl font-semibold leading-none",
                    row.severity === "critical" && "text-[var(--admin-danger)]",
                    row.severity === "warning" && "text-[var(--admin-warning)]",
                    row.severity === "info" && "text-[var(--admin-info)]"
                  )}
                  aria-label={`${row.value} ${row.label.toLowerCase()}`}
                >
                  {row.value}
                </p>
                {row.href ? (
                  // M2 fix (B-5): explicit "View →" affordance per row so the
                  // operator sees that EACH row is its own destination. The
                  // anchor wrapping the whole row keeps the click target wide;
                  // this is visual hint text only (the chevron span lives
                  // inside the wrapping Link, not as a nested anchor).
                  <span
                    aria-hidden="true"
                    className="ml-2 inline-flex shrink-0 items-center text-xs font-semibold text-[var(--admin-body)]"
                  >
                    View →
                  </span>
                ) : null}
              </div>
            );
            return (
              <li key={row.key}>
                {row.href ? (
                  <Link
                    href={row.href}
                    aria-label={`${row.label}: ${row.status}`}
                    data-row-key={row.key}
                    className="block outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {clearRows.length > 0 ? (
        <p className="mt-5 border-t border-[var(--admin-border)]/60 pt-3 text-xs text-[var(--admin-text-muted)]">
          <span className="font-semibold uppercase tracking-[0.1em] text-[var(--admin-success)]">All clear:</span>{" "}
          {clearRows.map((row) => row.label).join(" · ")}
        </p>
      ) : null}
    </AdminDashboardPanel>
  );
}

export function BusinessPulseCard({
  services,
  clients,
  revenueAllowed,
  canViewReports,
}: {
  services: { service: string; bookings: number; revenue: number }[];
  clients: {
    repeatClients: number;
    newClients: number;
    noShowCancelled: number;
    newEnquiries: number;
  };
  revenueAllowed: boolean;
  canViewReports?: boolean;
}) {
  const clientTotal =
    clients.repeatClients + clients.newClients + clients.newEnquiries + clients.noShowCancelled;

  return (
    <section
      aria-label="Service and client mix"
      className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)]/40 p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-text-muted)]">
          Mix snapshot · Service &amp; client
        </span>
        {canViewReports ? (
          <Link className="admin-link-action text-xs" href="/admin/reports">
            View full reports →
          </Link>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-3 text-sm font-semibold text-[var(--admin-body)]">Service mix</p>
          {services.length > 0 ? (
            <div className="grid gap-2">
              {services.slice(0, 4).map((service) => (
                <div key={service.service} className="grid gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-[var(--admin-heading)]">
                      {service.service}
                    </p>
                    <p className="text-sm text-[var(--admin-text-muted)]">
                      {service.bookings}
                      {revenueAllowed ? ` - ${formatMoney(service.revenue)}` : ""}
                    </p>
                  </div>
                  <AdminProgressBar
                    value={safeDivide(service.bookings, services[0]?.bookings ?? service.bookings)}
                    label={`${service.service} booking share`}
                    tone="success"
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Wrench}
              title="No services booked yet"
              message="Once bookings come in, you will see which services are most popular."
              tone="muted"
            />
          )}
        </div>

        <div className="min-w-0 border-t border-[var(--admin-border)] pt-5 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
          <p className="mb-3 text-sm font-semibold text-[var(--admin-body)]">Client mix</p>
          {clientTotal > 0 ? (
            <>
              <AdminStackedBar
                label="Client mix"
                segments={[
                  { label: "Repeat", value: clients.repeatClients, className: "bg-[var(--admin-primary)]" },
                  { label: "New", value: clients.newClients, className: "bg-[var(--admin-success)]" },
                  { label: "Enquiries", value: clients.newEnquiries, className: "bg-[var(--admin-client-accent)]" },
                  { label: "No-show / Cancelled", value: clients.noShowCancelled, className: "bg-[var(--admin-restricted)]" },
                ]}
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <ClientMixLegend label="Repeat" value={clients.repeatClients} total={clientTotal} color="bg-[var(--admin-primary)]" />
                <ClientMixLegend label="New" value={clients.newClients} total={clientTotal} color="bg-[var(--admin-success)]" />
                <ClientMixLegend label="Enquiries" value={clients.newEnquiries} total={clientTotal} color="bg-[var(--admin-client-accent)]" />
                <ClientMixLegend label="No-show / Cancelled" value={clients.noShowCancelled} total={clientTotal} color="bg-[var(--admin-restricted)]" />
              </div>
            </>
          ) : (
            <EmptyState
              icon={Users}
              title="No client activity"
              message="Client mix data will appear once there are bookings or enquiries in the selected range."
              tone="muted"
            />
          )}
        </div>

      </div>
    </section>
  );
}

export function DemandTrendCard({
  bookings,
  dateRange,
  rangeLabel,
}: {
  bookings: { booking_date: string }[];
  dateRange: { from: string; to: string };
  rangeLabel?: string;
}) {
  const totalBookings = bookings.length;
  return (
    <AdminDashboardPanel className="min-h-[22rem]">
      <div className="flex items-start gap-3">
        <AdminIconBadge icon={HeartPulse} tone="default" />
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-text-muted)]">
            Demand trend
          </h3>
          <p
            className="admin-display font-semibold leading-none text-[var(--admin-heading)] tabular-nums"
            style={{ fontSize: "clamp(1.625rem, 2.5vw, 1.875rem)" }}
          >
            {totalBookings}
          </p>
          <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
            {rangeLabel ? `Across ${rangeLabel}` : "Across the selected range"}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <DemandTrendClient
          bookings={bookings}
          from={dateRange.from}
          to={dateRange.to}
          today={new Date().toISOString().slice(0, 10)}
        />
      </div>
    </AdminDashboardPanel>
  );
}

function ClientMixLegend({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-body)]">
        <span className={cn("size-2.5 rounded-full", color)} />
        {label}
      </p>
      <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
        {value} ({Math.round(safeDivide(value, total))}%)
      </p>
    </div>
  );
}

export const adminDashboardCardClasses = {
  primaryButton:
    "inline-flex min-h-10 items-center justify-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35",
  outlineButton:
    "inline-flex min-h-10 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35",
};
