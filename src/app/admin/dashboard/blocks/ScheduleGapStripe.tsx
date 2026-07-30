// SERVER COMPONENT — Schedule gap stripe (C-11 block; brief §4.2
// "ScheduleGapStripe").
//
// Coordinator-only: surfaces schedule-coverage gaps in the coming days so
// staffing shortfalls surface before they become unassigned bookings.
// Genuinely new — no pre-C-11 analogue exists in the codebase (plan §1
// Phase A lift note: "derive from `nextSevenDays` + staff availability").
// Render-only — the caller computes the gap list; this block only renders it.

import Link from "next/link";
import { AlertTriangle, CalendarClock } from "lucide-react";
import {
  AdminDashboardPanel,
  AdminIconBadge,
  AdminPanelHeader,
} from "../../components/admin-ui";
import { EmptyState } from "../../components/EmptyState";

export interface ScheduleGap {
  /** Pre-formatted day label, e.g. "Mon 3 Aug". */
  dateLabel: string;
  /** Pre-formatted time-of-day label, e.g. "Morning" or "09:00–13:00". */
  periodLabel: string;
  city: string | null;
}

export interface ScheduleGapStripeProps {
  gaps: ScheduleGap[];
  /** Pre-formatted range label for the copy — defaults to "Next 7 days". */
  rangeLabel?: string;
  viewAllHref?: string;
}

export function ScheduleGapStripe({
  gaps,
  rangeLabel = "Next 7 days",
  viewAllHref = "/admin/staff",
}: ScheduleGapStripeProps) {
  return (
    <AdminDashboardPanel ariaLabel="Schedule gaps">
      <AdminPanelHeader
        icon={CalendarClock}
        title="Schedule gaps"
        description={
          gaps.length > 0
            ? `${rangeLabel}: ${gaps.length} gap${gaps.length === 1 ? "" : "s"} in coverage.`
            : `${rangeLabel} — fully covered.`
        }
        tone={gaps.length > 0 ? "warning" : "default"}
      />

      {gaps.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={CalendarClock}
            title="No coverage gaps"
            message={`Staff availability looks well covered for the ${rangeLabel.toLowerCase()}.`}
            tone="muted"
          />
        </div>
      ) : (
        <ul className="m-0 mt-4 grid list-none gap-2 p-0">
          {gaps.slice(0, 5).map((gap, index) => (
            <li
              key={`${gap.dateLabel}-${gap.periodLabel}-${index}`}
              className="flex items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 py-2.5"
            >
              <AdminIconBadge icon={AlertTriangle} tone="warning" className="size-8" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--admin-heading)]">
                  {gap.dateLabel} · {gap.periodLabel}
                </p>
                {gap.city ? (
                  <p className="truncate text-xs text-[var(--admin-text-muted)]">
                    {gap.city}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {gaps.length > 0 ? (
        <div className="mt-4">
          <Link href={viewAllHref} className="admin-link-action text-sm">
            Review staff availability →
          </Link>
        </div>
      ) : null}
    </AdminDashboardPanel>
  );
}
