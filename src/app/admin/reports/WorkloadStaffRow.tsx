// B-4 — Workload staff row.
//
// One clickable row per staff member in the Workload section. Click sets
// `?staffId={row.staffId}` (preserving other filters) and the page-side
// drill flow narrows the entire surface via `filterReportDataToStaff` (B-2).
//
// The bar segments are rendered as a 3-segment flex strip (18px tall) rather
// than a Recharts instance — for a list of 8+ rows the chart-library overhead
// dwarfs the visual payload. Segments map to the brief §4 spec:
//   assigned  → slate / --admin-info
//   completed → mint  / --admin-success
//   cancelled → coral / --admin-danger
//
// All-zero rows render an empty muted track so the row still has the
// expected 18px gutter.
//
// Plan: redesign/plans/B-phase/B4-reports-rebuild-plan.md (step 5).

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { WorkloadRowWithStatus } from "./reports-helpers";

interface WorkloadStaffRowProps {
  row: WorkloadRowWithStatus;
  /** Current report filters as a URLSearchParams string — preserved across the drill click. */
  query: string;
}

function SegmentedBar({ row }: { row: WorkloadRowWithStatus }) {
  if (row.total === 0) {
    return (
      <div
        className="h-[18px] w-full rounded-full bg-[var(--admin-panel-muted)]"
        aria-hidden="true"
      />
    );
  }
  const aPct = (row.assigned / row.total) * 100;
  const cPct = (row.completed / row.total) * 100;
  const xPct = (row.cancelled / row.total) * 100;
  return (
    <div
      className="flex h-[18px] w-full overflow-hidden rounded-full bg-[var(--admin-panel-muted)]"
      role="img"
      aria-label={`${row.assigned} assigned, ${row.completed} completed, ${row.cancelled} cancelled`}
    >
      {row.assigned > 0 ? (
        <div
          className="bg-[var(--admin-info)]"
          style={{ width: `${aPct}%` }}
          title={`Assigned: ${row.assigned}`}
        />
      ) : null}
      {row.completed > 0 ? (
        <div
          className="bg-[var(--admin-success)]"
          style={{ width: `${cPct}%` }}
          title={`Completed: ${row.completed}`}
        />
      ) : null}
      {row.cancelled > 0 ? (
        <div
          className="bg-[var(--admin-danger)]"
          style={{ width: `${xPct}%` }}
          title={`Cancelled: ${row.cancelled}`}
        />
      ) : null}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const letter = (name?.trim()?.[0] ?? "·").toUpperCase();
  return (
    <span
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--admin-hover-mist)] text-sm font-semibold text-[var(--admin-primary)]"
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

export function WorkloadStaffRow({ row, query }: WorkloadStaffRowProps) {
  // Build the drill href: take current query string, override staffId.
  const params = new URLSearchParams(query);
  params.set("staffId", row.staffId);
  const href = `/admin/reports?${params.toString()}`;

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-[var(--admin-radius-control)] border border-transparent px-3 py-3 outline-none transition-colors",
        "hover:-translate-y-px hover:border-[var(--admin-border)] hover:bg-[var(--admin-panel-muted)]/40",
        "focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/45"
      )}
      data-staff-id={row.staffId}
    >
      <Avatar name={row.staffName} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--admin-heading)]">
          {row.staffName}
        </p>
        <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">
          {row.assigned} assigned · {row.completed} completed · {row.cancelled} cancelled
        </p>
        <div className="mt-2">
          <SegmentedBar row={row} />
        </div>
      </div>
    </Link>
  );
}
