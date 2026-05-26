// B-4 — Scope pill.
//
// Slim badge under the page header that summarises the current scope:
//   "Scope: All staff · Monthly"
//   "Scope: Me · This week"
//   "Scope: Aisha Hassan · Custom"
//
// Per brief §5 it's clickable: anchor jump to the filter strip on desktop
// (where the filter form is always visible), and the existing AdminSheet
// trigger handles mobile separately. We render an <a href="#admin-reports-filters">
// so the native focus + scroll behaviour does the work — no JS required.
//
// Plan: redesign/plans/B-phase/B4-reports-rebuild-plan.md (step 2).

import { Filter } from "lucide-react";

interface ScopePillProps {
  who: string;
  rangeLabel: string;
  /** Anchor target id rendered on the filter strip. Defaults to the standard `admin-reports-filters`. */
  filterAnchorId?: string;
}

export function ScopePill({ who, rangeLabel, filterAnchorId = "admin-reports-filters" }: ScopePillProps) {
  return (
    <a
      href={`#${filterAnchorId}`}
      title="Click to refine scope"
      className="inline-flex h-7 w-fit items-center gap-1.5 rounded-full bg-[var(--admin-panel-muted)] px-3 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-hover-mist)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/45"
    >
      <Filter className="size-3" aria-hidden="true" />
      <span>
        <span className="text-[var(--admin-text-muted)]">Scope:</span> {who} · {rangeLabel}
      </span>
    </a>
  );
}
