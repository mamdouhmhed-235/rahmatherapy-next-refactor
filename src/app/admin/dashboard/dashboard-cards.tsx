import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  HeartPulse,
  Info,
  Mail,
  Plus,
  PoundSterling,
  ShieldAlert,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AdminDashboardPanel,
  AdminEmptyState,
  AdminHealthTile,
  AdminIconBadge,
  AdminPanelHeader,
  AdminProgressBar,
  AdminSeverityMeter,
  AdminStackedBar,
  AdminStatusBadge,
} from "../components/admin-ui";
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
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function avatarColor(name: string) {
  const colors = [
    "bg-[#e8d5e0] text-[#8b4a6b]",
    "bg-[#d5e0e8] text-[#4a6b8b]",
    "bg-[#d5e8d8] text-[#4a8b5e]",
    "bg-[#e8e0d5] text-[#8b6b4a]",
    "bg-[#d8d5e8] text-[#5e4a8b]",
    "bg-[#e8d8d5] text-[#8b4a4a]",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
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
        "dashboard-attention-item grid min-w-0 gap-3 rounded-[var(--admin-radius-card)] border border-l-4 border-y-[var(--admin-border)] border-r-[var(--admin-border)] bg-white px-4 py-4 shadow-[var(--admin-shadow-subtle)]",
        severity === "critical" && "border-l-[var(--admin-danger)]",
        severity === "warning" && "border-l-[var(--admin-warning)]",
        severity === "info" && "border-l-[var(--admin-info)]"
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
              className="inline-flex min-h-9 min-w-[8.5rem] items-center justify-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-3.5 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
            >
              {primaryLabel}
            </Link>
          ) : (
            <span className="inline-flex min-h-9 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-3.5 text-[13px] text-[var(--admin-restricted)]">
              Restricted
            </span>
          )}
          {secondaryHref ? (
            <Link
              href={secondaryHref}
              className="inline-flex min-h-9 min-w-[7.5rem] items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-3.5 text-[13px] font-medium text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
            >
              {secondaryLabel ?? "Details"}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function TodayAtAGlanceCard({
  appointments,
  nextAppointment,
  todayCount,
  weekCount,
  permissionAccess,
  readiness,
}: {
  appointments: {
    time: string;
    endTime?: string;
    title: string;
    detail: string;
    status: string;
    href: string | null;
  }[];
  nextAppointment?: { date: string; time: string; title: string } | null;
  todayCount: number;
  weekCount: number;
  permissionAccess?: { bookings: boolean; calendar: boolean };
  readiness: {
    confirmations: string;
    staffCoverage: string;
    paymentCollection: string;
  };
}) {
  const timeTicks = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];

  return (
    <AdminDashboardPanel className="min-h-[20rem]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <AdminPanelHeader icon={CalendarDays} title="Today at a glance" />
        <div className="flex flex-wrap items-start justify-end gap-4">
          <div className="grid grid-cols-2 divide-x divide-[var(--admin-border)] text-center">
            <MetricMini value={todayCount.toString()} label="today" />
            <MetricMini value={weekCount.toString()} label="this week" />
          </div>
          <div className="flex flex-wrap gap-2">
            {permissionAccess?.calendar ? (
              <Link className="admin-action-outline" href="/admin/calendar">
                View calendar
              </Link>
            ) : null}
            {permissionAccess?.bookings ? (
              <Link className="admin-action-primary" href="/admin/bookings">
                View bookings
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="hidden sm:block">
          <div className="grid grid-cols-7 text-center text-sm font-semibold text-[var(--admin-text-muted)]">
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
            {appointments.length > 0 ? (
              appointments.map((appointment) => {
                const content = (
                  <span className="block truncate rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-success-bg)] px-3 py-2 text-xs font-semibold text-[var(--admin-primary)] shadow-[var(--admin-shadow-subtle)]">
                    {appointment.time} {appointment.title}
                  </span>
                );
                const style = appointmentStyle(appointment.time, appointment.endTime);
                return appointment.href ? (
                  <Link
                    key={`${appointment.time}-${appointment.title}`}
                    href={appointment.href}
                    className="absolute top-8 min-w-[7rem] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                    style={style}
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    key={`${appointment.time}-${appointment.title}`}
                    className="absolute top-8 min-w-[7rem]"
                    style={style}
                  >
                    {content}
                  </div>
                );
              })
            ) : (
              <div className="absolute inset-x-0 top-8">
                <AdminEmptyState
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
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:hidden">
          {appointments.length > 0 ? (
            appointments.map((appointment) => (
              <AppointmentMobileRow key={`${appointment.time}-${appointment.title}`} appointment={appointment} />
            ))
          ) : (
            <AdminEmptyState
              icon={CalendarDays}
              title="No appointments today"
              message={
                nextAppointment
                  ? `Next booking: ${nextAppointment.date} at ${nextAppointment.time}`
                  : "Enjoy a quiet day. Great time for admin and planning."
              }
              tone="muted"
            />
          )}
        </div>
      </div>

      <div className="mt-5 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-white px-4 py-3">
        <p className="mb-3 text-sm font-semibold text-[var(--admin-heading)]">
          Day readiness
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <ReadinessItem icon={Mail} label="Client confirmations" value={readiness.confirmations} />
          <ReadinessItem icon={Users} label="Staff coverage" value={readiness.staffCoverage} />
          <ReadinessItem icon={PoundSterling} label="Payment collection" value={readiness.paymentCollection} />
        </div>
      </div>
    </AdminDashboardPanel>
  );
}

export const TodayAgendaCard = TodayAtAGlanceCard;

function MetricMini({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-16 px-3">
      <p className="text-2xl font-semibold leading-none text-[var(--admin-heading)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{label}</p>
    </div>
  );
}

function AppointmentMobileRow({
  appointment,
}: {
  appointment: { time: string; title: string; detail: string; status: string; href: string | null };
}) {
  const content = (
    <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[var(--admin-heading)]">{appointment.time}</span>
        <AdminStatusBadge
          value={appointment.status}
          tone={appointment.status === "fully_assigned" ? "success" : "warning"}
        />
      </div>
      <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
        {appointment.title} - {appointment.detail}
      </p>
    </div>
  );

  return appointment.href ? (
    <Link href={appointment.href}>{content}</Link>
  ) : (
    content
  );
}

function ReadinessItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <AdminIconBadge icon={Icon} tone="default" className="size-9" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--admin-heading)]">{label}</p>
        <p className="text-sm text-[var(--admin-text-muted)]">{value}</p>
      </div>
    </div>
  );
}

export function UrgentAttentionPanel({
  rows,
  groups,
}: {
  rows: AttentionSummaryRow[];
  groups: AttentionGroup[];
}) {
  const visibleRows = rows.slice(0, 5);
  const activeGroups = groups.filter((group) => group.count > 0);

  return (
    <AdminDashboardPanel className="min-h-[20rem]">
      <AdminPanelHeader
        icon={ShieldAlert}
        title="Urgent attention"
        description="High priority signals that may need your action."
        tone={visibleRows.some((row) => row.severity === "critical") ? "danger" : "warning"}
      />

      <div className="mt-5 grid gap-2">
        {visibleRows.map((row) => {
          const tone = severityTone(row.severity);
          const content = (
            <div
              className={cn(
                "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-white px-4 py-3 shadow-[var(--admin-shadow-subtle)]",
                row.severity === "critical" && "border-l-4 border-l-[var(--admin-danger)]",
                row.severity === "warning" && "border-l-4 border-l-[var(--admin-warning)]",
                row.severity === "clear" && "border-l-4 border-l-[var(--admin-success)]"
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
                <p className="text-2xl font-semibold leading-none text-[var(--admin-heading)]">
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

          return row.href ? (
            <Link key={row.key} href={row.href} className="outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35">
              {content}
            </Link>
          ) : (
            <div key={row.key}>{content}</div>
          );
        })}
      </div>

      <div className="mt-5">
        <AttentionReviewButton groups={activeGroups.length > 0 ? activeGroups : groups} />
      </div>
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
    <AdminDashboardPanel>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AdminIconBadge icon={Users} tone="default" />
          <div>
            <h2 className="admin-display text-[1.35rem] font-bold leading-7 text-[var(--admin-heading)]">
              Staff Capacity
            </h2>
            <p className="text-sm text-[var(--admin-text-muted)]">
              {staffWorkload.length} active · Today
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
            const colorClass = avatarColor(staff.staffName);
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
                className="flex items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-white px-3 py-3"
              >
                <div
                  className={cn(
                    "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    colorClass
                  )}
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
          <AdminEmptyState
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
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)]/60 text-sm font-semibold text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
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
  const collectedDegrees = total > 0 ? (summary.collectedRevenue / total) * 360 : 0;
  const collectionRate = total > 0 ? safeDivide(summary.collectedRevenue, total) : 0;

  return (
    <AdminDashboardPanel>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AdminIconBadge icon={PoundSterling} tone="default" />
          <div>
            <h2 className="admin-display text-[1.35rem] font-bold leading-7 text-[var(--admin-heading)]">
              Payment Health
            </h2>
            <p className="text-sm text-[var(--admin-text-muted)]">This week</p>
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

      {revenueAllowed ? (
        total > 0 ? (
          <div className="mt-4">
            {/* Row-based payment bars */}
            <div className="grid gap-3">
              {/* Booked */}
              <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-[#5b8dd9]" />
                    <span className="text-sm font-semibold text-[var(--admin-heading)]">Booked</span>
                  </div>
                  <span className="text-lg font-bold text-[var(--admin-heading)]">
                    {formatMoney(summary.bookedRevenue)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--admin-progress-neutral)]">
                  <span className="block h-full rounded-full bg-[#5b8dd9]" style={{ width: "100%" }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-xs text-[var(--admin-text-muted)]">Total value of bookings</span>
                  <span className="text-xs font-medium text-[var(--admin-success)]">+12% vs last week</span>
                </div>
              </div>

              {/* Collected */}
              <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-white px-4 py-3">
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
              <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-white px-4 py-3">
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

            {/* Pie chart summary */}
            <div className="mt-4 flex items-center justify-center gap-6 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-white px-4 py-4">
              <div
                className="grid size-24 place-items-center rounded-full"
                role="img"
                aria-label={`Total payment value ${formatMoney(total)}`}
                style={{
                  background: `conic-gradient(var(--admin-success) ${collectedDegrees}deg, var(--admin-progress-neutral) 0deg)`,
                }}
              >
                <div className="grid size-16 place-items-center rounded-full bg-[var(--admin-panel)] text-center">
                  <span className="text-base font-bold leading-none text-[var(--admin-heading)]">
                    {formatMoney(total)}
                  </span>
                  <span className="text-[10px] text-[var(--admin-text-muted)]">Total</span>
                </div>
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[#5b8dd9]" />
                  <span className="text-xs text-[var(--admin-text-muted)]">Booked</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[var(--admin-success)]" />
                  <span className="text-xs text-[var(--admin-text-muted)]">Collected</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[var(--admin-warning)]" />
                  <span className="text-xs text-[var(--admin-text-muted)]">Outstanding</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <p className="mt-4 flex items-center gap-2 text-xs text-[var(--admin-text-muted)]">
              <Info className="size-3.5" aria-hidden="true" />
              {hasActivity
                ? `${unpaidCount} unpaid booking${unpaidCount === 1 ? "" : "s"}${unpaidCompletedCount ? `, ${unpaidCompletedCount} completed` : ""}.`
                : "No financial activity in this period."}
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <AdminEmptyState
              icon={PoundSterling}
              title="No financial activity"
              message="Bookings and payments will appear here once there is activity in the selected range."
              tone="muted"
            />
          </div>
        )
      ) : (
        <div className="mt-4 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] px-4 py-6 text-center">
          <p className="text-sm font-semibold text-[var(--admin-heading)]">Revenue hidden</p>
          <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
            Payment counts stay visible, but money values need reporting permission.
          </p>
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
  const overall = failedEmails > 0 || openOperations > 0 || availabilityGaps > 0
    ? "Needs attention"
    : "All clear";
  const warningDots = Math.min(4, [failedEmails, openOperations, availabilityGaps].filter(Boolean).length + (failedEmails > 0 ? 1 : 0));

  return (
    <AdminDashboardPanel>
      <AdminPanelHeader
        icon={HeartPulse}
        title="Operational health"
        action={
          permissionAccess?.operations ? (
            <Link className="admin-link-action" href="/admin/operations">
              View details
            </Link>
          ) : null
        }
      />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <AdminHealthTile
          icon={Mail}
          label="Emails"
          value={failedEmails}
          status={failedEmails > 0 ? "Critical" : "All clear"}
          tone={failedEmails > 0 ? "danger" : "success"}
          href={permissionAccess?.emails ? "/admin/emails" : null}
        />
        <AdminHealthTile
          icon={Wrench}
          label="Operations"
          value={openOperations}
          status={openOperations > 0 ? "Warning" : "All clear"}
          tone={openOperations > 0 ? "warning" : "success"}
          href={permissionAccess?.operations ? "/admin/operations" : null}
        />
        <AdminHealthTile
          icon={UserRound}
          label="Enquiries"
          value={openEnquiries}
          status={openEnquiries > 0 ? "Open" : "All clear"}
          tone={openEnquiries > 0 ? "info" : "success"}
          href={permissionAccess?.enquiries ? "/admin/enquiries" : null}
        />
        <AdminHealthTile
          icon={Users}
          label="Staff gaps"
          value={availabilityGaps}
          status={availabilityGaps > 0 ? "Warning" : "All clear"}
          tone={availabilityGaps > 0 ? "warning" : "success"}
          href={permissionAccess?.staff ? "/admin/staff" : null}
        />
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-white px-4 py-3">
        <span className="inline-flex gap-1.5" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <span
              key={index}
              className={cn(
                "size-2 rounded-full",
                index < warningDots ? "bg-[var(--admin-warning)]" : "bg-[var(--admin-progress-neutral)]"
              )}
            />
          ))}
        </span>
        <p className="text-sm font-semibold text-[var(--admin-body)]">
          Overall status:{" "}
          <span className={overall === "Needs attention" ? "text-[var(--admin-warning)]" : "text-[var(--admin-success)]"}>
            {overall}
          </span>
        </p>
      </div>
    </AdminDashboardPanel>
  );
}

export function BusinessPulseCard({
  services,
  clients,
  bookings,
  dateRange,
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
  bookings: { booking_date: string }[];
  dateRange: { from: string; to: string };
  revenueAllowed: boolean;
  canViewReports?: boolean;
}) {
  const clientTotal =
    clients.repeatClients + clients.newClients + clients.newEnquiries + clients.noShowCancelled;

  return (
    <AdminDashboardPanel>
      <AdminPanelHeader
        icon={HeartPulse}
        title="Business pulse"
        description="Understand demand, client mix and trends."
        action={
          canViewReports ? (
            <Link className="admin-link-action" href="/admin/reports">
              View full reports
            </Link>
          ) : null
        }
      />

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.35fr_1.25fr]">
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
            <AdminEmptyState
              icon={Wrench}
              title="No services booked yet"
              message="Once bookings come in, you will see which services are most popular."
              tone="muted"
            />
          )}
        </div>

        <div className="min-w-0 border-y border-[var(--admin-border)] py-4 xl:border-x xl:border-y-0 xl:px-5 xl:py-0">
          <p className="mb-3 text-sm font-semibold text-[var(--admin-body)]">Client mix</p>
          {clientTotal > 0 ? (
            <>
              <AdminStackedBar
                label="Client mix"
                segments={[
                  { label: "Repeat", value: clients.repeatClients, className: "bg-[var(--admin-primary)]" },
                  { label: "New", value: clients.newClients, className: "bg-[#a8d1bd]" },
                  { label: "Enquiries", value: clients.newEnquiries, className: "bg-[var(--admin-client-accent)]" },
                  { label: "No-show / Cancelled", value: clients.noShowCancelled, className: "bg-[#bdbab4]" },
                ]}
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <ClientMixLegend label="Repeat" value={clients.repeatClients} total={clientTotal} color="bg-[var(--admin-primary)]" />
                <ClientMixLegend label="New" value={clients.newClients} total={clientTotal} color="bg-[#a8d1bd]" />
                <ClientMixLegend label="Enquiries" value={clients.newEnquiries} total={clientTotal} color="bg-[var(--admin-client-accent)]" />
                <ClientMixLegend label="No-show / Cancelled" value={clients.noShowCancelled} total={clientTotal} color="bg-[#bdbab4]" />
              </div>
            </>
          ) : (
            <AdminEmptyState
              icon={Users}
              title="No client activity"
              message="Client mix data will appear once there are bookings or enquiries in the selected range."
              tone="muted"
            />
          )}
        </div>

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
    "inline-flex min-h-10 items-center justify-center rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-white outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35",
  outlineButton:
    "inline-flex min-h-10 items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-white px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35",
};
