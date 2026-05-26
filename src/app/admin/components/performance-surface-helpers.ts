// B-3 — small page-helpers shared by /admin/me + /admin/staff/[staffId]/performance.
// Pure URL + date manipulation; no React, no I/O. Server-safe.

import type { RangeChip } from "./PerformanceHeader";
import type { PerformanceShell } from "./performance-helpers";
import type { UpcomingWorkItem } from "./PerformanceSurface";

// Range chips in brief §5.1 order. Custom chip activates the inline From/To
// form rendered by PerformanceHeader → CustomDateRangeForm; the chip itself
// is a Link to ?range=custom&from=<today>&to=<today> as a starting point so
// the user has a valid baseline to edit. parseReportFilters already handles
// custom URLs (B-2).
const CHIP_DEFS: Array<{ key: string; label: string }> = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "quarter", label: "This quarter" },
  { key: "custom", label: "Custom" },
];

export function buildRangeChips(
  basePath: string,
  currentRange: string,
  params: Record<string, string | string[] | undefined>
): RangeChip[] {
  // Carry forward only the params that affect rendering shape (not range/from/to,
  // which we set per chip). Keeps the "show=all" expansion sticky across
  // period changes.
  const carriedKeys = ["show", "staffId"];
  const carried = new URLSearchParams();
  for (const key of carriedKeys) {
    const value = params[key];
    const flat = Array.isArray(value) ? value[0] : value;
    if (flat) carried.set(key, flat);
  }

  // For the Custom chip, also carry forward from/to so re-clicking Custom
  // preserves the user's date selection. For preset chips (today/week/etc.)
  // we explicitly drop from/to so parseReportFilters re-computes them.
  const customFrom = pickParam(params, "from");
  const customTo = pickParam(params, "to");

  return CHIP_DEFS.map((chip) => {
    const search = new URLSearchParams(carried);
    search.set("range", chip.key);
    if (chip.key === "custom" && customFrom && customTo) {
      search.set("from", customFrom);
      search.set("to", customTo);
    }
    return {
      key: chip.key,
      label: chip.label,
      href: `${basePath}?${search.toString()}`,
      active: currentRange === chip.key,
    };
  });
}

function pickParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string | null {
  const value = params[key];
  const flat = Array.isArray(value) ? value[0] : value;
  return flat || null;
}

const RANGE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
});

const RANGE_FMT_SHORT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/London",
});

export function buildRangeWindowLabel(fromYmd: string, toYmd: string): string {
  if (!fromYmd || !toYmd) return "";
  if (fromYmd === toYmd) {
    return RANGE_FMT.format(new Date(`${fromYmd}T00:00:00Z`));
  }
  const fromDate = new Date(`${fromYmd}T00:00:00Z`);
  const toDate = new Date(`${toYmd}T00:00:00Z`);
  const sameYear = fromYmd.slice(0, 4) === toYmd.slice(0, 4);
  const fromLabel = sameYear ? RANGE_FMT_SHORT.format(fromDate) : RANGE_FMT.format(fromDate);
  const toLabel = RANGE_FMT.format(toDate);
  return `${fromLabel} – ${toLabel}`;
}

// Brief §5.5 + Q5 fallback ladder. Therapist: Next Visit → Browse claimable →
// Set availability. Coordinator: Open enquiries. Admin/Owner: none.
export function buildMobileStickyConfig(
  shell: PerformanceShell,
  upcomingWork: UpcomingWorkItem[]
): { href: string; label: string } | undefined {
  if (shell === "owner_admin") return undefined;
  if (shell === "therapist") {
    const nextAssignment = upcomingWork.find((i) => i.kind === "assignment");
    if (nextAssignment && nextAssignment.kind === "assignment") {
      return {
        href: `/admin/bookings/${nextAssignment.data.bookingId}`,
        label: "Go to my next visit",
      };
    }
    // Fallback: assume Browse claimable is always linkable. The deeper Q5
    // ladder ("Set my availability" when no claimable) needs a 5th query to
    // count claimable assignments — out of scope for the ≤4 budget. Browse
    // claimable is reachable from any logged-in Therapist context, so a hard
    // "no claimable" empty hides naturally on the destination page.
    return { href: "/admin/bookings?view=claimable", label: "Browse claimable" };
  }
  // Coordinator
  return { href: "/admin/enquiries", label: "Open enquiries" };
}
