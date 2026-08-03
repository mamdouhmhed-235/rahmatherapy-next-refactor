// B-4 — Personal/Team toggle.
//
// Segmented control rendered next to the filter strip's Apply button per
// brief §5 (visible to Owner/Admin/Coordinator; auto-Personal for Therapist
// so the control is hidden server-side via the `visible` prop).
//
// Implementation: two adjacent <Link> elements with pre-computed hrefs.
// Personal sets `?scope=personal&staffId={viewerId}`; Team clears `scope`
// and clears the auto-added staffId when it equals viewerId (leaves a
// manually-drilled staffId alone). Per AUDIT-2026-05-22 Q3 this drives
// whole-page narrowing — the page.tsx consumer reads `scope` + `staffId`
// and re-fetches via `filterReportDataToStaff` from B-2.
//
// We render server-side: <Link> handles client navigation natively + works
// without JS. The plan called for a client component "needs to submit
// GET form on toggle" — Link does that without client-side state.
//
// Plan: redesign/plans/B-phase/B4-reports-rebuild-plan.md (step 2).

import Link from "next/link";
import { cn } from "@/lib/utils";

interface PersonalTeamToggleProps {
  /** Hide entirely for Therapist scope per brief §5 (auto-Personal, no manual control). */
  visible: boolean;
  /** Active scope — driven by the `?scope=` URL param read by parseReportFilters. */
  scope: "team" | "personal";
  /** Caller's staff id — Personal adds `staffId={viewerId}` so the data layer narrows. */
  viewerId: string;
  /** Current filters (Record-shape) — preserved across the toggle. */
  filters: Record<string, string>;
}

export function PersonalTeamToggle({ visible, scope, viewerId, filters }: PersonalTeamToggleProps) {
  if (!visible) return null;

  const teamFilters = { ...filters };
  delete teamFilters.scope;
  // Drop staffId only when it was auto-set to viewerId (Personal flow).
  // A manually-drilled `?staffId=other-id` is preserved.
  if (teamFilters.staffId === viewerId) delete teamFilters.staffId;
  const teamQuery = new URLSearchParams(
    Object.entries(teamFilters).filter(([, value]) => Boolean(value))
  ).toString();
  const teamHref = teamQuery ? `/admin/reports?${teamQuery}` : "/admin/reports";

  const personalFilters = { ...filters, scope: "personal", staffId: viewerId };
  const personalQuery = new URLSearchParams(
    Object.entries(personalFilters).filter(([, value]) => Boolean(value))
  ).toString();
  const personalHref = `/admin/reports?${personalQuery}`;

  const baseClass =
    "inline-flex h-9 items-center justify-center px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/45";
  const activeClass = "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]";
  const idleClass = "bg-transparent text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)]";

  return (
    <fieldset
      role="group"
      aria-label="Report scope"
      className="inline-flex h-9 items-center overflow-hidden rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-panel)] p-0"
    >
      <legend className="sr-only">Report scope</legend>
      <Link
        href={teamHref}
        aria-current={scope === "team" ? "page" : undefined}
        className={cn(baseClass, scope === "team" ? activeClass : idleClass)}
      >
        Team
      </Link>
      <Link
        href={personalHref}
        aria-current={scope === "personal" ? "page" : undefined}
        className={cn(baseClass, scope === "personal" ? activeClass : idleClass)}
      >
        Mine
      </Link>
    </fieldset>
  );
}
