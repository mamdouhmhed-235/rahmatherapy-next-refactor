import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock,
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
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-[11px] font-bold uppercase tracking-[0.06em]", commandCardAccent[tone])}>
          {title}
        </p>
        <Icon className="size-4 text-[var(--rahma-muted)]/50" aria-hidden="true" />
      </div>
      <p className="mt-3 text-[1.75rem] font-semibold leading-none tracking-[-0.02em] text-[var(--rahma-charcoal)]">
        {value}
      </p>
      <p className="mt-2 text-[13px] leading-5 text-[var(--rahma-muted)]">{subtitle}</p>
      {actionLabel ? (
        <div className="mt-4 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--rahma-green)] transition-colors group-hover/link:text-[var(--rahma-green-dark)]">
          {actionLabel}
          <ArrowRight className="size-3" aria-hidden="true" />
        </div>
      ) : null}
    </>
  );

  const className = cn(
    "group/link rounded-xl border px-5 py-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all duration-150",
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

  return (
    <div className={cn(
      "dashboard-attention-item grid min-w-0 gap-3 rounded-lg border px-4 py-3.5 transition-colors",
      severity === "critical"
        ? "border-rose-200 bg-[#fff1f2]/80"
        : severity === "warning"
          ? "border-amber-100 bg-[#fffbeb]/80"
          : "border-[var(--rahma-border)] bg-white hover:border-[var(--rahma-green)]/20"
    )}>
      {/* ── Header row ── */}
      <div className="flex items-start gap-2.5">
        <AdminStatusBadge
          value={severityLabel[severity]}
          tone={tone}
          className="shrink-0 text-[10px]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--rahma-charcoal)] leading-snug">
            {title}
          </p>
          <p className="dashboard-attention-detail mt-1 text-[13px] leading-5 text-[var(--rahma-muted)]">{detail}</p>
          {impact ? (
            <p className="dashboard-attention-impact mt-0.5 text-xs leading-5 text-[var(--rahma-muted)]/70 italic">
              {impact}
            </p>
          ) : null}
        </div>
      </div>

      {/* ── Meta row ── */}
      <div className="dashboard-attention-meta flex flex-col items-stretch gap-2">
        {date || ageLabel ? (
          <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--rahma-muted)]/60">
            {[date, ageLabel].filter(Boolean).join(" \u00b7 ")}
          </span>
        ) : <span />}
        <div className="flex w-full flex-wrap items-center gap-1.5">
          {href ? (
            <Link
              href={href}
              className="inline-flex min-h-8 min-w-0 flex-1 items-center justify-center rounded-lg bg-[var(--rahma-green)] px-3 text-xs font-semibold text-white outline-none transition-colors hover:bg-[var(--rahma-green)]/90 focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
              style={{ color: "#ffffff" }}
            >
              {primaryLabel}
            </Link>
          ) : (
            <span className="inline-flex min-h-8 items-center rounded-lg border border-[var(--rahma-border)] bg-white px-3 text-xs text-[var(--admin-restricted)]">
              Restricted
            </span>
          )}
          {secondaryHref ? (
            <Link
              href={secondaryHref}
              className="inline-flex min-h-8 min-w-0 flex-1 items-center justify-center rounded-lg border border-[var(--rahma-border)] bg-white px-3 text-xs font-medium text-[var(--rahma-charcoal)] outline-none transition-colors hover:bg-[var(--rahma-ivory)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
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
              <h2 className="font-display text-base font-semibold text-[var(--rahma-charcoal)]">
                {title}
              </h2>
              <AdminStatusBadge value="All clear" tone="success" />
            </div>
          </div>
        <div className="rounded-lg border border-dashed border-[var(--rahma-border)] bg-[var(--rahma-ivory)]/50 px-4 py-10 text-center">
          <p className="text-sm font-semibold text-[var(--rahma-charcoal)]">
            All clear
          </p>
          <p className="mt-1 text-xs text-[var(--rahma-muted)]">
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
        <h2 className="font-display text-base font-semibold text-[var(--rahma-charcoal)]">
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
              <span className="min-w-0 break-words text-sm text-[var(--rahma-muted)]">
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
        <div className="rounded-lg border border-dashed border-[var(--rahma-border)] bg-[var(--rahma-ivory)]/50 px-4 py-5 text-center">
          <p className="text-sm font-semibold text-[var(--rahma-charcoal)]">
            No appointments today
          </p>
          {nextAppointment ? (
            <>
              <p className="mt-1.5 text-[13px] text-[var(--rahma-muted)]">
                Next upcoming:{" "}
                <span className="font-medium text-[var(--rahma-charcoal)]">
                  {nextAppointment.date} at {nextAppointment.time}
                </span>
              </p>
              <p className="text-xs text-[var(--rahma-muted)]">
                {nextAppointment.title}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-[var(--rahma-muted)]">
              No upcoming bookings in this range.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {permissionAccess?.calendar ? (
              <Link
                href="/admin/calendar"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--rahma-border)] bg-white px-4 text-xs font-semibold text-[var(--rahma-charcoal)] outline-none transition-colors hover:bg-[var(--rahma-ivory)] focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
              >
                <CalendarDays className="size-3.5" />
                View calendar
              </Link>
            ) : null}
            {permissionAccess?.bookings ? (
              <Link
                href="/admin/bookings"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--rahma-green)] px-4 text-xs font-semibold text-white outline-none transition-colors hover:bg-[var(--rahma-green)]/90 focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
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
        <h2 className="font-display text-base font-semibold text-[var(--rahma-charcoal)]">
          Operations health
        </h2>
        {permissionAccess?.operations ? (
          <Link
            href="/admin/operations"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--rahma-green)] outline-none transition-colors hover:bg-[var(--rahma-green)]/8 focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30"
          >
            View details
            <ChevronRight className="size-3" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <div className="mt-4 grid gap-1.5">
        {signals.map((signal) => {
          const content = (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <signal.icon
                  className={cn(
                    "size-3.5",
                    signal.warn ? "text-amber-500" : "text-[var(--rahma-muted)]"
                  )}
                />
                <span className="text-[13px] text-[var(--rahma-charcoal)]">{signal.label}</span>
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
              className="rounded-lg border border-transparent bg-[var(--admin-surface-muted)] px-3.5 py-2.5 transition-colors hover:border-[var(--rahma-green)]/20 hover:bg-[var(--rahma-ivory)]/70"
            >
              {content}
            </Link>
          ) : (
            <div
              key={signal.label}
              className="rounded-lg bg-[var(--admin-surface-muted)] px-3.5 py-2.5"
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
  permissionAccess?: { staff: boolean };
}) {
  return (
    <section className="rounded-xl border border-[var(--rahma-border)] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-[var(--rahma-charcoal)]">
          Staff capacity
        </h2>
        {permissionAccess?.staff ? (
          <Link
            href="/admin/staff"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--rahma-green)] outline-none hover:bg-[var(--rahma-green)]/8 focus-visible:ring-2 focus-visible:ring-[var(--rahma-blue)]/30 transition-colors"
          >
            Manage
            <ChevronRight className="size-3" aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      {genderCapacity.length > 0 ? (
        <div className="mb-4 grid gap-2">
          {genderCapacity.map((gc) => (
            <div
              key={gc.gender}
              className="rounded-lg border border-[var(--rahma-border)] bg-[var(--admin-surface-muted)] px-4 py-3"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Users className="size-3.5 text-[var(--rahma-green)]" />
                <span className="text-sm font-semibold text-[var(--rahma-charcoal)]">{gc.label}</span>
                <span className="text-xs text-[var(--rahma-muted)]">
                  ({gc.activeTherapists} active)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--rahma-muted)]">
                <span>{gc.totalAssignments} assigned</span>
                {gc.unassignedAssignments > 0 ? (
                  <AdminStatusBadge
                    value={`${gc.unassignedAssignments} unassigned`}
                    tone="warning"
                  />
                ) : (
                  <AdminStatusBadge value="Covered" tone="success" />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-dashed border-[var(--rahma-border)] bg-[var(--rahma-ivory)]/50 px-4 py-5 text-center">
          <p className="text-sm text-[var(--rahma-muted)]">No capacity data in this range.</p>
        </div>
      )}

      {staffWorkload.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--rahma-muted)]">
            Workload
          </p>
          <div className="grid gap-1">
            {staffWorkload.slice(0, 5).map((row) => (
              <div
                key={row.staffName}
                className="flex items-center justify-between gap-2 rounded-md px-3 py-1.5"
              >
                <span className="text-[13px] font-medium text-[var(--rahma-charcoal)]">{row.staffName}</span>
                <span className="text-xs text-[var(--rahma-muted)]">
                  {row.assignments} assigned &middot; {row.completed} done
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--rahma-border)] bg-[var(--rahma-ivory)]/50 px-4 py-5 text-center text-sm text-[var(--rahma-muted)]">
          No staff assignments in this range.
          {permissionAccess?.staff ? (
            <Link
              href="/admin/staff"
              className="mt-2 block text-xs font-semibold text-[var(--rahma-green)] underline underline-offset-2"
            >
              Manage staff
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
}: {
  summary: {
    bookedRevenue: number;
    collectedRevenue: number;
    outstandingRevenue: number;
  };
  unpaidCount: number;
  unpaidCompletedCount?: number;
  revenueAllowed: boolean;
}) {
  return (
    <section className="rounded-xl border border-[var(--rahma-border)] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <h2 className="font-display text-base font-semibold text-[var(--rahma-charcoal)]">
        Payment health
      </h2>

      {revenueAllowed ? (
        <div className="mt-4 grid gap-1.5">
          <PaymentRow label="Booked" value={formatMoney(summary.bookedRevenue)} tone="default" />
          <PaymentRow label="Collected" value={formatMoney(summary.collectedRevenue)} tone="success" />
          <PaymentRow label="Outstanding" value={formatMoney(summary.outstandingRevenue)} tone={summary.outstandingRevenue > 0 ? "warning" : "success"} />
          {unpaidCount > 0 ? (
            <div className="mt-1 rounded-lg border border-amber-100 bg-[#fffbeb] px-4 py-2.5 flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-amber-700">
                {unpaidCount} unpaid booking{unpaidCount !== 1 ? "s" : ""}
              </span>
              {unpaidCompletedCount ? (
                <span className="text-xs text-amber-600">
                  {unpaidCompletedCount} completed
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-purple-200 bg-purple-50/50 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-purple-600">Revenue hidden</p>
          <p className="mt-1 text-xs text-purple-500/80">
            You don&rsquo;t have permission to view revenue.
          </p>
          <p className="mt-2 text-[10px] text-purple-400">
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
  tone: "default" | "success" | "warning";
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--admin-surface-muted)] px-3.5 py-2.5">
      <span className="text-[13px] text-[var(--rahma-charcoal)]">{label}</span>
      <span
        className={cn(
          "text-[13px] font-semibold",
          tone === "success" && "text-[var(--admin-success)]",
          tone === "warning" && "text-[var(--admin-warning)]",
          tone === "default" && "text-[var(--rahma-charcoal)]"
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
      <h2 className="font-display text-base font-semibold text-[var(--rahma-charcoal)]">
        Business pulse
      </h2>

      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(8.5rem,0.62fr)]">
        {/* Most booked */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--rahma-muted)] mb-2">
            Most booked
          </p>
          {services.length > 0 ? (
            <div className="grid gap-1.5">
              {services.slice(0, 3).map((s) => (
                <div
                  key={s.service}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-1.5"
                >
                  <span className="min-w-0 truncate text-[13px] font-medium text-[var(--rahma-charcoal)]">
                    {s.service}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-right text-xs text-[var(--rahma-muted)]">
                    {s.bookings}
                    {revenueAllowed ? (
                      <span className="ml-1 font-medium text-[var(--rahma-charcoal)]">
                        {formatMoney(s.revenue)}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--rahma-muted)] px-3 py-2">No bookings in range.</p>
          )}
        </div>

        {/* Client activity */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--rahma-muted)] mb-2">
            Clients
          </p>
          <div className="grid gap-1">
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
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-1.5">
      <span className="min-w-0 break-words text-[13px] leading-5 text-[var(--rahma-muted)]">{label}</span>
      <span className="shrink-0 text-[13px] font-semibold text-[var(--rahma-charcoal)]">{value}</span>
    </div>
  );
}
