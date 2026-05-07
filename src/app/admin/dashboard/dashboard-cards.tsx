import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock,
  Info,
  Mail,
  Siren,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminStatusBadge } from "../components/admin-ui";
import { AttentionBoardClient } from "./attention-group-client";

/* ═══════════════════════════════════════════════════════════════
   Shared helpers & types
   ═══════════════════════════════════════════════════════════════ */

type CommandCardTone = "default" | "warning" | "critical" | "success" | "info";

const commandCardToneClasses: Record<CommandCardTone, string> = {
  default: "border-[var(--rahma-border)] bg-white hover:border-[var(--rahma-green)]/35",
  warning: "border-amber-200 bg-[#fffbeb] hover:border-amber-300",
  critical: "border-rose-200 bg-[#fff1f2] hover:border-rose-300",
  success: "border-emerald-200 bg-[#ecfdf5] hover:border-emerald-300",
  info: "border-sky-200 bg-[#eff8ff] hover:border-sky-300",
};

const commandCardAccent: Record<CommandCardTone, string> = {
  default: "text-[var(--rahma-green)]",
  warning: "text-amber-600",
  critical: "text-rose-600",
  success: "text-emerald-600",
  info: "text-sky-600",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

/* ═══════════════════════════════════════════════════════════════
   DashboardCommandCard
   ═══════════════════════════════════════════════════════════════ */

export function DashboardCommandCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "default",
  href,
  actionLabel,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  tone?: CommandCardTone;
  href?: string;
  actionLabel?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-xs font-bold uppercase tracking-[0.06em] leading-4", commandCardAccent[tone])}>
          {title}
        </p>
        <Icon className="mt-0.5 size-4 shrink-0 text-[var(--rahma-muted)]/50" aria-hidden="true" />
      </div>
      <p className="mt-3.5 text-[1.85rem] font-semibold leading-none tracking-[-0.02em] text-[var(--rahma-charcoal)]">
        {value}
      </p>
      <p className="mt-2.5 text-[13px] leading-5 text-[var(--rahma-muted)]">{subtitle}</p>
      {actionLabel ? (
        <div className="mt-5 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--rahma-green)] transition-colors group-hover/link:text-[var(--rahma-green-dark)]">
          {actionLabel}
          <ArrowRight className="size-3" aria-hidden="true" />
        </div>
      ) : null}
    </>
  );

  const className = cn(
    "group/link rounded-xl border px-5 py-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all duration-150 xl:min-h-[10.25rem]",
    commandCardToneClasses[tone]
  );

  return href ? (
    <Link href={href} className={cn(className, "block focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/40 focus-visible:ring-offset-2")} aria-label={`${title}: ${value}. ${actionLabel ?? ""}`}>
      {content}
    </Link>
  ) : (
    <article className={className} aria-label={`${title}: ${value}`}>
      {content}
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AttentionItemCard
   ═══════════════════════════════════════════════════════════════ */

export type AttentionSeverity = "critical" | "warning" | "info";

const severityLabel: Record<AttentionSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

const severityColor = {
  critical: "danger",
  warning: "warning",
  info: "info",
} as const;

const severityAccent = {
  critical: "border-l-rose-400",
  warning: "border-l-amber-400",
  info: "border-l-sky-400",
} as const;

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
  const tone = severityColor[severity];
  const SeverityIcon = severity === "info" ? Info : AlertTriangle;

  return (
    <div className={cn(
      "dashboard-attention-item grid min-w-0 gap-3 rounded-lg border border-l-4 border-y-[var(--rahma-border)] border-r-[var(--rahma-border)] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.025)] transition-colors hover:bg-[var(--rahma-ivory)]/25",
      severityAccent[severity]
    )}>
      {/* ── Header row ── */}
      <div className="flex items-start gap-3">
        <span className={cn(
          "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full",
          severity === "critical" && "bg-rose-50 text-rose-600",
          severity === "warning" && "bg-amber-50 text-amber-600",
          severity === "info" && "bg-sky-50 text-sky-600"
        )}>
          <SeverityIcon className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-[15px] font-semibold leading-snug text-[var(--rahma-charcoal)]">
              {title}
            </p>
            <AdminStatusBadge value={severityLabel[severity]} tone={tone} />
          </div>
          <p className="dashboard-attention-detail mt-1.5 text-sm leading-5 text-[var(--rahma-muted)]">{detail}</p>
          {impact ? (
            <p className="dashboard-attention-impact mt-1 text-[13px] leading-5 text-[var(--rahma-muted)]">
              {impact}
            </p>
          ) : null}
        </div>
      </div>

      {/* ── Meta row ── */}
      <div className="dashboard-attention-meta flex flex-col items-stretch gap-2 sm:pl-10">
        {date || ageLabel ? (
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--rahma-muted)]">
            {[date, ageLabel].filter(Boolean).join(" \u00b7 ")}
          </span>
        ) : <span />}
        <div className="flex w-full flex-wrap items-center gap-2">
          {href ? (
            <Link
              href={href}
              className="inline-flex min-h-9 min-w-[8.5rem] items-center justify-center rounded-lg bg-[var(--rahma-green)] px-3.5 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-[var(--rahma-green)]/90 focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
              style={{ color: "#ffffff" }}
            >
              {primaryLabel}
            </Link>
          ) : (
            <span className="inline-flex min-h-9 items-center rounded-lg border border-[var(--rahma-border)] bg-white px-3.5 text-[13px] text-[var(--admin-restricted)]">
              Restricted
            </span>
          )}
          {secondaryHref ? (
            <Link
              href={secondaryHref}
              className="inline-flex min-h-9 min-w-[7.5rem] items-center justify-center rounded-lg border border-[var(--rahma-border)] bg-white px-3.5 text-[13px] font-medium text-[var(--rahma-charcoal)] outline-none transition-colors hover:bg-[var(--rahma-ivory)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
            >
              {secondaryLabel ?? "Details"}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AttentionGroup — a named bucket of attention items
   ═══════════════════════════════════════════════════════════════ */

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

/* Extracted to a client component for expand/collapse interactivity */

/* ═══════════════════════════════════════════════════════════════
   NeedsActionBoard
   ═══════════════════════════════════════════════════════════════ */

export function NeedsActionBoard({
  groups,
  title = "Needs attention",
}: {
  groups: AttentionGroup[];
  title?: string;
}) {
  const total = groups.reduce((sum, g) => sum + g.count, 0);

  return (
    <section className="rounded-xl border border-[var(--rahma-border)] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      {total === 0 ? (
        <>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
                {title}
              </h2>
              <AdminStatusBadge value="All clear" tone="success" />
            </div>
          </div>
        <div className="rounded-lg border border-dashed border-[var(--rahma-border)] bg-[var(--rahma-ivory)]/50 px-4 py-10 text-center">
          <p className="text-base font-semibold text-[var(--rahma-charcoal)]">
            All clear
          </p>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">
            No items need attention in the selected range.
          </p>
        </div>
        </>
      ) : (
        <AttentionBoardClient title={title} groups={groups.filter((g) => g.count > 0)} />
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TodayAgendaCard
   ═══════════════════════════════════════════════════════════════ */

export function TodayAgendaCard({
  appointments,
  nextAppointment,
  permissionAccess,
}: {
  appointments: { time: string; title: string; detail: string; status: string; href: string | null }[];
  nextAppointment?: { date: string; time: string; title: string } | null;
  permissionAccess?: { bookings: boolean; calendar: boolean };
}) {
  return (
    <section className="rounded-xl border border-[var(--rahma-border)] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
          Today &amp; upcoming
        </h2>
        <AdminStatusBadge
          value={`${appointments.length} today`}
          tone={appointments.length > 0 ? "success" : "muted"}
        />
      </div>

      {appointments.length > 0 ? (
        <div className="grid gap-2">
          {appointments.slice(0, 2).map((apt) => {
            const content = (
              <>
              <span className="text-sm font-semibold text-[var(--rahma-charcoal)]">{apt.time}</span>
              <span className="min-w-0 break-words text-sm leading-5 text-[var(--rahma-muted)]">
                {apt.title} {"\u00b7"} {apt.detail}
              </span>
              <AdminStatusBadge
                value={apt.status}
                tone={apt.status === "fully_assigned" ? "success" : "warning"}
              />
              </>
            );
            const className = "grid gap-2 rounded-lg border border-[var(--rahma-border)] bg-[var(--admin-surface-muted)] px-4 py-3 transition-colors sm:grid-cols-[auto_1fr_auto] sm:items-center";
            return apt.href ? (
              <Link
                key={apt.time + apt.title}
                href={apt.href}
                className={cn(className, "outline-none hover:border-[var(--rahma-green)]/35 focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30")}
              >
                {content}
              </Link>
            ) : (
              <div key={apt.time + apt.title} className={className}>
                {content}
              </div>
            );
          })}
          {appointments.length > 2 ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--rahma-border)] bg-white px-4 py-3">
              <span className="text-xs font-medium text-[var(--rahma-muted)]">
                {appointments.length - 2} more appointment{appointments.length - 2 === 1 ? "" : "s"} today
              </span>
              {permissionAccess?.bookings ? (
                <Link
                  href="/admin/bookings"
                  className="inline-flex min-h-8 items-center rounded-lg bg-[var(--rahma-green)] px-3 text-xs font-semibold text-white outline-none transition-colors hover:bg-[var(--rahma-green)]/90 focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
                  style={{ color: "#ffffff" }}
                >
                  View all
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--rahma-border)] bg-[var(--rahma-ivory)]/50 px-4 py-4 text-center">
          <div className="min-w-0">
            <p className="text-base font-semibold text-[var(--rahma-charcoal)]">
              No appointments today
            </p>
            {nextAppointment ? (
              <>
                <p className="mt-1.5 text-sm leading-5 text-[var(--rahma-muted)]">
                  Next upcoming:{" "}
                  <span className="font-medium text-[var(--rahma-charcoal)]">
                    {nextAppointment.date} at {nextAppointment.time}
                  </span>
                </p>
                <p className="text-sm text-[var(--rahma-muted)]">
                  {nextAppointment.title}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-[var(--rahma-muted)]">
                No upcoming bookings in this range.
              </p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {permissionAccess?.calendar ? (
              <Link
                href="/admin/calendar"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--rahma-border)] bg-white px-4 text-[13px] font-semibold text-[var(--rahma-charcoal)] outline-none transition-colors hover:bg-[var(--rahma-ivory)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
              >
                <CalendarDays className="size-3.5" />
                View calendar
              </Link>
            ) : null}
            {permissionAccess?.bookings ? (
              <Link
                href="/admin/bookings"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--rahma-green)] px-4 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-[var(--rahma-green)]/90 focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
                style={{ color: "#ffffff" }}
              >
                View bookings
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OperationsHealthCard
   ═══════════════════════════════════════════════════════════════ */

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
  const signals = [
    {
      label: "Failed emails",
      value: failedEmails,
      href: permissionAccess?.emails ? "/admin/emails" : null,
      icon: Mail,
      warn: failedEmails > 0,
    },
    {
      label: "Open operations",
      value: openOperations,
      href: permissionAccess?.operations ? "/admin/operations" : null,
      icon: Siren,
      warn: openOperations > 0,
    },
    {
      label: "New enquiries",
      value: openEnquiries,
      href: permissionAccess?.enquiries ? "/admin/enquiries" : null,
      icon: UserRound,
      warn: false,
    },
    {
      label: "Staff gaps",
      value: availabilityGaps,
      href: permissionAccess?.staff ? "/admin/staff" : null,
      icon: Clock,
      warn: availabilityGaps > 0,
    },
  ];

  return (
    <section className="rounded-xl border border-[var(--rahma-border)] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
          Operations health
        </h2>
        {permissionAccess?.operations ? (
          <Link
            href="/admin/operations"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-[var(--rahma-green)] outline-none transition-colors hover:bg-[var(--rahma-green)]/8 focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
          >
            View details
            <ChevronRight className="size-3" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {signals.map((signal) => {
          const content = (
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <signal.icon
                  className={cn(
                    "size-4 shrink-0",
                    signal.warn ? "text-amber-500" : "text-[var(--rahma-muted)]"
                  )}
                />
                <span className="min-w-0 text-sm text-[var(--rahma-charcoal)]">{signal.label}</span>
              </div>
              <AdminStatusBadge
                value={signal.value.toString()}
                tone={signal.warn ? "warning" : "muted"}
              />
            </div>
          );

          return signal.href ? (
            <Link
              key={signal.label}
              href={signal.href}
              className="rounded-lg border border-transparent bg-[var(--admin-surface-muted)] px-4 py-3.5 transition-colors hover:border-[var(--rahma-green)]/20 hover:bg-[var(--rahma-ivory)]/70"
            >
              {content}
            </Link>
          ) : (
            <div
              key={signal.label}
              className="rounded-lg bg-[var(--admin-surface-muted)] px-4 py-3.5"
            >
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   StaffCapacityCard
   ═══════════════════════════════════════════════════════════════ */

export function StaffCapacityCard({
  genderCapacity,
  staffWorkload,
  permissionAccess,
}: {
  genderCapacity: { gender: string; label: string; activeTherapists: number; totalAssignments: number; unassignedAssignments: number }[];
  staffWorkload: { staffName: string; assignments: number; completed: number }[];
  permissionAccess?: { staff: boolean; bookings?: boolean };
}) {
  const totalUnassigned = genderCapacity.reduce((sum, row) => sum + row.unassignedAssignments, 0);
  const capacityActionHref = permissionAccess?.bookings && totalUnassigned > 0
    ? "/admin/bookings?view=unassigned"
    : permissionAccess?.staff
      ? "/admin/staff"
      : null;
  const capacityActionLabel = totalUnassigned > 0 && permissionAccess?.bookings
    ? "Assign bookings"
    : "Manage staff";

  return (
    <section className="rounded-xl border border-[var(--rahma-border)] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
          Staff capacity
        </h2>
        {capacityActionHref ? (
          <Link
            href={capacityActionHref}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-[var(--rahma-green)] outline-none hover:bg-[var(--rahma-green)]/8 focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30 transition-colors"
          >
            {capacityActionLabel}
            <ChevronRight className="size-3" aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      {genderCapacity.length > 0 ? (
        <div className="mb-4 grid gap-2">
          {genderCapacity.map((gc) => {
            const therapistType = gc.label.toLowerCase().replace(/\s*therapists?$/, "");

            return (
              <div
                key={gc.gender}
                className="rounded-lg bg-[var(--admin-surface-muted)] px-4 py-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Users className="size-3.5 shrink-0 text-[var(--rahma-green)]" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold leading-5 text-[var(--rahma-charcoal)]">{gc.label}</p>
                      <p className="text-sm leading-5 text-[var(--rahma-muted)]">
                        {gc.activeTherapists} active therapist{gc.activeTherapists === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <AdminStatusBadge
                    value={gc.unassignedAssignments > 0 ? "Needs therapist" : "Covered"}
                    tone={gc.unassignedAssignments > 0 ? "warning" : "success"}
                  />
                </div>
                <p className="mt-2 text-sm leading-5 text-[var(--rahma-muted)]">
                  {gc.totalAssignments} assigned work item{gc.totalAssignments === 1 ? "" : "s"} in range.
                </p>
                {gc.unassignedAssignments > 0 ? (
                  <p className="mt-1 text-sm font-medium leading-5 text-amber-700">
                    {gc.unassignedAssignments} {therapistType} assignment{gc.unassignedAssignments === 1 ? "" : "s"} still need a therapist.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-dashed border-[var(--rahma-border)] bg-[var(--rahma-ivory)]/50 px-4 py-5 text-center">
          <p className="text-sm text-[var(--rahma-muted)]">No capacity data in this range.</p>
        </div>
      )}

      {staffWorkload.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.07em] text-[var(--rahma-muted)]">
            Workload
          </p>
          <div className="grid gap-1">
            {staffWorkload.slice(0, 5).map((row) => (
              <div
                key={row.staffName}
                className="flex items-center justify-between gap-3 rounded-md px-3 py-2"
              >
                <span className="text-sm font-medium text-[var(--rahma-charcoal)]">{row.staffName}</span>
                <span className="text-sm text-[var(--rahma-muted)]">
                  {row.assignments} assigned &middot; {row.completed} done
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--rahma-border)] bg-[var(--rahma-ivory)]/50 px-4 py-5 text-center">
          <p className="text-base font-semibold text-[var(--rahma-charcoal)]">
            No assigned work in this range.
          </p>
          {totalUnassigned > 0 ? (
            <p className="mt-1 text-sm text-amber-700">
              {totalUnassigned} assignment{totalUnassigned === 1 ? "" : "s"} still need a therapist.
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--rahma-muted)]">
              No staff workload appears for the selected scope.
            </p>
          )}
          {capacityActionHref ? (
            <Link
              href={capacityActionHref}
              className="mt-3 inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--rahma-border)] bg-white px-3.5 text-[13px] font-semibold text-[var(--rahma-green)] outline-none transition-colors hover:bg-[var(--rahma-ivory)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
            >
              {capacityActionLabel}
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PaymentHealthCard
   ═══════════════════════════════════════════════════════════════ */

export function PaymentHealthCard({
  summary,
  unpaidCount,
  unpaidCompletedCount,
  revenueAllowed,
  canReviewBookings,
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
}) {
  const hasOutstanding = summary.outstandingRevenue > 0 || unpaidCount > 0;

  return (
    <section className="rounded-xl border border-[var(--rahma-border)] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
          Payment health
        </h2>
        {revenueAllowed && hasOutstanding && canReviewBookings ? (
          <Link
            href="/admin/bookings?payment_status=unpaid"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-[var(--rahma-green)] outline-none transition-colors hover:bg-[var(--rahma-green)]/8 focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
          >
            Review unpaid
            <ChevronRight className="size-3" aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      {revenueAllowed ? (
        <div className="mt-4 grid gap-2">
          {hasOutstanding ? (
            <div className="rounded-lg border border-amber-100 bg-[#fffbeb] px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.06em] text-amber-700">
                Outstanding
              </p>
              <p className="mt-1 text-[2rem] font-semibold leading-none text-amber-800">
                {formatMoney(summary.outstandingRevenue)}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-amber-700">
                  {unpaidCount} unpaid booking{unpaidCount !== 1 ? "s" : ""}
                  {unpaidCompletedCount ? `, ${unpaidCompletedCount} completed` : ""}
                </p>
                {canReviewBookings ? (
                  <Link
                    href="/admin/bookings?payment_status=unpaid"
                    className="inline-flex min-h-9 items-center rounded-lg bg-[var(--rahma-green)] px-3.5 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-[var(--rahma-green)]/90 focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
                    style={{ color: "#ffffff" }}
                  >
                    Review unpaid bookings
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
          <PaymentRow label="Booked" value={formatMoney(summary.bookedRevenue)} tone="default" />
          <PaymentRow label="Collected" value={formatMoney(summary.collectedRevenue)} tone={hasOutstanding ? "quiet" : "success"} />
          {!hasOutstanding ? (
            <PaymentRow label="Outstanding" value={formatMoney(summary.outstandingRevenue)} tone="success" />
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-purple-200 bg-purple-50/50 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-purple-600">Revenue hidden</p>
          <p className="mt-1 text-sm text-purple-500/80">
            You don&rsquo;t have permission to view revenue.
          </p>
          <p className="mt-2 text-xs text-purple-400">
            Requires view_reports or manage_payments
          </p>
        </div>
      )}
    </section>
  );
}

function PaymentRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "success" | "warning" | "quiet";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--admin-surface-muted)] px-3.5 py-3">
      <span className="text-sm text-[var(--rahma-charcoal)]">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold",
          tone === "success" && "text-[var(--admin-success)]",
          tone === "warning" && "text-[var(--admin-warning)]",
          tone === "default" && "text-[var(--rahma-charcoal)]",
          tone === "quiet" && "text-[var(--rahma-muted)]"
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BusinessPulseCard
   ═══════════════════════════════════════════════════════════════ */

export function BusinessPulseCard({
  services,
  clients,
  revenueAllowed,
}: {
  services: { service: string; bookings: number; revenue: number }[];
  clients: {
    repeatClients: number;
    newClients: number;
    noShowCancelled: number;
    newEnquiries: number;
  };
  revenueAllowed: boolean;
}) {
  return (
    <section className="rounded-xl border border-[var(--rahma-border)] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <h2 className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
        Business pulse
      </h2>

      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(9.5rem,0.62fr)]">
        {/* Most booked */}
        <div>
          <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.07em] text-[var(--rahma-muted)]">
            Most booked
          </p>
          {services.length > 0 ? (
            <div className="grid gap-2">
              {services.slice(0, 3).map((s) => (
                <div
                  key={s.service}
                  className="rounded-lg bg-[var(--admin-surface-muted)] px-3.5 py-3"
                >
                  <p className="break-words text-sm font-semibold leading-5 text-[var(--rahma-charcoal)]">
                    {s.service}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="text-sm text-[var(--rahma-muted)]">
                      {s.bookings} booking{s.bookings === 1 ? "" : "s"}
                    </span>
                    {revenueAllowed ? (
                      <span className="text-sm font-semibold text-[var(--rahma-charcoal)]">
                        {formatMoney(s.revenue)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-3 py-2 text-sm text-[var(--rahma-muted)]">No bookings in range.</p>
          )}
        </div>

        {/* Client activity */}
        <div>
          <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.07em] text-[var(--rahma-muted)]">
            Clients
          </p>
          <div className="grid gap-2">
            <ClientPulseRow label="Repeat" value={clients.repeatClients.toString()} />
            <ClientPulseRow label="New" value={clients.newClients.toString()} />
            <ClientPulseRow label="Enquiries" value={clients.newEnquiries.toString()} />
            <ClientPulseRow label="No-show / cancelled" value={clients.noShowCancelled.toString()} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ClientPulseRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-[var(--admin-surface-muted)] px-3.5 py-3">
      <span className="min-w-0 break-words text-sm leading-5 text-[var(--rahma-muted)]">{label}</span>
      <span className="shrink-0 text-sm font-semibold text-[var(--rahma-charcoal)]">{value}</span>
    </div>
  );
}
