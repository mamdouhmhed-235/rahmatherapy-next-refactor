// B-4 reports-rebuild helpers.
//
// Pure transformations extracted out of page.tsx so the new sub-components
// (HeadlineTileStrip, ScopePill, active filter chips) can consume them
// without duplication and so they can be unit-tested in isolation.
//
// Surgical extraction: nothing in this file changes existing behaviour. The
// chip-building logic, validation rules, and filter constants are copied
// verbatim from page.tsx (line numbers in the pre-B-4 file: RANGE_OPTIONS @53,
// PAYMENT_OPTIONS @61, validateFarFutureDate @966, buildActiveFilterChips @988).
//
// New: formatRangeLabel — derives a short human label from a ReportFilters
// for use by the new ScopePill. Returns the static RANGE_OPTIONS label by
// default and appends the custom-window dates when range === 'custom'.
//
// Plan: redesign/plans/B-phase/B4-reports-rebuild-plan.md (step 1).

import { formatMoney, formatNumber, type NoShowRate, type ReportAssignment, type ReportFilters, type UtilisationRate } from "./reporting";

export const RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: "lifetime", label: "Lifetime" },
  { value: "year", label: "Yearly" },
  { value: "month", label: "Monthly" },
  { value: "week", label: "Weekly" },
  { value: "custom", label: "Custom" },
];

export const PAYMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any payment" },
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Outstanding" },
  { value: "refunded", label: "Refunded" },
  { value: "waived", label: "Waived" },
];

const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;

/**
 * Returns an error string when either date is more than 5 years in the future,
 * or null when both are within the supported window. Empty inputs are skipped
 * — the form's required/optional semantics live in page.tsx, not here.
 */
export function validateFarFutureDate(from: string, to: string): string | null {
  const horizon = Date.now() + FIVE_YEARS_MS;
  const parsed = [from, to]
    .filter(Boolean)
    .map((value) => new Date(`${value}T00:00:00Z`).getTime());
  if (parsed.some((time) => Number.isFinite(time) && time > horizon)) {
    return "That date is outside the supported range. Reports cover the last 5 years.";
  }
  return null;
}

export type FilterChipKey = "range" | "from" | "to" | "staffId" | "source" | "paymentStatus";

export interface ActiveFilterChip {
  id: FilterChipKey;
  label: string;
  value: string;
}

interface BuildActiveFilterChipsArgs {
  filters: {
    range: string;
    from: string;
    to: string;
    staffId: string;
    source: string;
    paymentStatus: string;
  };
  staff: { id: string; name: string }[];
}

/**
 * Compose the visible chip row for active non-default filters. Mirrors the
 * pre-B-4 behaviour exactly: range=month is the implicit default and produces
 * no chip; custom range exposes from/to chips; any other filter that's set
 * gets a chip with the human-resolved label (staffId → staff.name lookup,
 * paymentStatus → PAYMENT_OPTIONS lookup).
 */
export function buildActiveFilterChips({
  filters,
  staff,
}: BuildActiveFilterChipsArgs): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  if (filters.range && filters.range !== "month") {
    const label =
      RANGE_OPTIONS.find((option) => option.value === filters.range)?.label ?? filters.range;
    chips.push({ id: "range", label: "Range", value: label });
  }
  if (filters.range === "custom") {
    if (filters.from) chips.push({ id: "from", label: "From", value: filters.from });
    if (filters.to) chips.push({ id: "to", label: "To", value: filters.to });
  }
  if (filters.staffId) {
    const match = staff.find((s) => s.id === filters.staffId);
    chips.push({ id: "staffId", label: "Staff", value: match?.name ?? filters.staffId });
  }
  if (filters.source) {
    chips.push({ id: "source", label: "Source", value: filters.source });
  }
  if (filters.paymentStatus) {
    const label =
      PAYMENT_OPTIONS.find((option) => option.value === filters.paymentStatus)?.label ??
      filters.paymentStatus;
    chips.push({ id: "paymentStatus", label: "Payment", value: label });
  }
  return chips;
}

/**
 * Short human label for a ReportFilters window. Used by the new B-4 scope
 * pill ("Scope: All staff · {rangeLabel}"). For static ranges (lifetime,
 * year, month, week) returns the matching RANGE_OPTIONS label; for custom
 * returns "{from} – {to}" when both dates are present, otherwise "Custom".
 */
export function formatRangeLabel(filters: Pick<ReportFilters, "range" | "from" | "to">): string {
  if (filters.range === "custom") {
    if (filters.from && filters.to) return `${filters.from} – ${filters.to}`;
    if (filters.from) return `From ${filters.from}`;
    if (filters.to) return `Through ${filters.to}`;
    return "Custom";
  }
  return RANGE_OPTIONS.find((option) => option.value === filters.range)?.label ?? "Monthly";
}

// ── buildDailySeries ─────────────────────────────────────────────────────────
//
// Pure generic for 12-day sparkline construction. Returns a number[] of length
// `days`, oldest at index 0 and most-recent at index days-1. anchorDate (YYYY-MM-DD)
// is exposed for testability; defaults to today in en-GB (Europe/London semantics
// match the rest of the project's date handling). Items outside the window or
// with unparseable dates contribute 0.

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildDailySeries<T>(
  items: T[],
  getDateString: (item: T) => string | null | undefined,
  getValue: (item: T) => number,
  days = 12,
  anchorDate?: string
): number[] {
  const series = new Array(days).fill(0) as number[];
  const today = anchorDate ?? new Date().toISOString().slice(0, 10);
  const anchorMs = Date.parse(`${today}T00:00:00.000Z`);
  if (Number.isNaN(anchorMs)) return series;
  for (const item of items) {
    const raw = getDateString(item);
    if (!raw) continue;
    const itemMs = Date.parse(`${raw.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(itemMs)) continue;
    const daysAgo = Math.round((anchorMs - itemMs) / DAY_MS);
    if (daysAgo < 0 || daysAgo >= days) continue;
    const idx = days - 1 - daysAgo;
    series[idx] += getValue(item);
  }
  return series;
}

// ── tilesForScope ────────────────────────────────────────────────────────────
//
// JSON-safe headline tile spec set per scope. The page composer pre-computes
// every metric value (so this helper stays pure CPU over already-derived
// numbers) and we pre-format the display value to a string so HeadlineTileStrip
// can hand serializable props to the client KpiTile without needing the
// server→client function-prop adapter that B-3's TileFromSpec uses for its
// dynamic format keys (see HANDOFF-2026-05-21 §1.12 deviation 6).
//
// Lifetime guard: when buildPriorPeriodFilters returns null (and therefore
// no priorSummary / priorUtilisation / priorNoShow / priorNewClients are
// passed), all deltas resolve to undefined and DeltaChip hides itself.
// Owner/Admin sees the 6 tile set; Coordinator + Therapist see 4 (no
// Revenue, no Outstanding) per brief §4.

export type TileScope = "owner_admin" | "coordinator" | "therapist";

export interface TileSpec {
  key: string;
  label: string;
  value: string;
  delta?: number;
  deltaTone?: "auto" | "invert";
  series?: number[];
  href?: string;
  hint?: string;
}

interface SummaryReportsLike {
  bookingCount: number;
  collectedRevenue: number;
  outstandingRevenue: number;
}

interface TilesForScopeArgs {
  scope: TileScope;
  filters: ReportFilters;
  summary: SummaryReportsLike;
  priorSummary?: SummaryReportsLike;
  utilisation: UtilisationRate;
  priorUtilisation?: UtilisationRate;
  noShow: NoShowRate;
  priorNoShow?: NoShowRate;
  newClients: number;
  priorNewClients?: number;
  series?: {
    bookings?: number[];
    collected?: number[];
    newClients?: number[];
  };
  /** Pre-built filter query (URLSearchParams encoded) — drives tile hrefs. */
  query: string;
}

function pctDelta(curr: number, prior: number | undefined): number | undefined {
  if (prior === undefined || prior === null || prior <= 0) return undefined;
  return ((curr - prior) / prior) * 100;
}

// Hours-with-smart-precision: keep a decimal under 10h (so "1.5h of 16.0h"
// stays readable in tight windows) but drop it at ≥10h ("156h of 320h"
// vs the awkward "156.0h of 320.0h"). Matches the formatDurationFromMinutes
// pattern in report-insights.ts so both surfaces feel consistent.
function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return "0h";
  return hours < 10 ? `${hours.toFixed(1)}h` : `${Math.round(hours)}h`;
}

function ppDelta(curr: number, prior: number | undefined): number | undefined {
  if (prior === undefined || prior === null) return undefined;
  return (curr - prior) * 100;
}

function appendQuery(baseHref: string, query: string, extra?: string): string {
  const tail = [query, extra].filter(Boolean).join("&");
  return tail ? `${baseHref}?${tail}` : baseHref;
}

export function tilesForScope(args: TilesForScopeArgs): TileSpec[] {
  const {
    scope,
    summary,
    priorSummary,
    utilisation,
    priorUtilisation,
    noShow,
    priorNoShow,
    newClients,
    priorNewClients,
    series,
    query,
  } = args;

  const showRevenue = scope === "owner_admin";
  const tiles: TileSpec[] = [];

  tiles.push({
    key: "bookings",
    label: "Bookings",
    value: formatNumber(summary.bookingCount),
    delta: pctDelta(summary.bookingCount, priorSummary?.bookingCount),
    series: series?.bookings,
    href: appendQuery("/admin/bookings", query),
  });

  if (showRevenue) {
    tiles.push({
      key: "collected_revenue",
      label: "Collected revenue",
      value: formatMoney(summary.collectedRevenue),
      delta: pctDelta(summary.collectedRevenue, priorSummary?.collectedRevenue),
      series: series?.collected,
    });
    tiles.push({
      key: "outstanding",
      label: "Outstanding",
      value: formatMoney(summary.outstandingRevenue),
      delta: pctDelta(summary.outstandingRevenue, priorSummary?.outstandingRevenue),
      hint: summary.outstandingRevenue > 0 ? "Of which completed but unpaid" : undefined,
      href: appendQuery("/admin/bookings", query, "payment_status=unpaid"),
    });
  }

  tiles.push({
    key: "new_clients",
    label: "New clients",
    value: formatNumber(newClients),
    delta: pctDelta(newClients, priorNewClients),
    series: series?.newClients,
    href: appendQuery("/admin/clients", query, "sort=created_desc"),
  });

  tiles.push({
    key: "utilisation",
    label: "Utilisation rate",
    value: `${Math.round(utilisation.rate * 100)}%`,
    delta: ppDelta(utilisation.rate, priorUtilisation?.rate),
    hint:
      utilisation.availableHours > 0
        ? `${formatHours(utilisation.bookedHours)} of ${formatHours(utilisation.availableHours)} available`
        : "Set availability rules to track utilisation",
  });

  tiles.push({
    key: "no_show",
    label: "No-show rate",
    value: `${Math.round(noShow.rate * 100)}%`,
    delta: ppDelta(noShow.rate, priorNoShow?.rate),
    deltaTone: "invert",
    hint:
      noShow.total > 0
        ? `${noShow.noShows} no-show · ${noShow.cancelled} cancelled of ${noShow.total} bookings`
        : "No bookings to measure yet",
    href: appendQuery("/admin/bookings", query, "status=no_show"),
  });

  return tiles;
}

// ── getStaffWorkloadWithStatus ───────────────────────────────────────────────
//
// Variant of the existing `getStaffWorkload` (reporting.ts) that splits each
// staff row into three segment counts so the new B-4 Workload section can
// render a per-staff stacked bar (assigned / completed / cancelled). The
// pre-B-4 helper only returned `{assignments, completed}` aggregates and
// is preserved verbatim for any other consumer.
//
// Mapping: `assignment.status === 'completed'` → completed bucket;
//          `'no_show' | 'declined'` → cancelled bucket; `'assigned'` → assigned bucket.
// `'unassigned'` rows are skipped (no `assigned_staff_id`). Sorted descending
// by total so the busiest staff render first; the page can `.slice(0, 8)`
// for the panel cap.

export interface WorkloadRowWithStatus {
  staffId: string;
  staffName: string;
  assigned: number;
  completed: number;
  cancelled: number;
  total: number;
}

export function getStaffWorkloadWithStatus(input: {
  assignments: ReportAssignment[];
}): WorkloadRowWithStatus[] {
  const rows = new Map<string, WorkloadRowWithStatus>();
  for (const assignment of input.assignments) {
    if (!assignment.assigned_staff_id) continue;
    const existing = rows.get(assignment.assigned_staff_id) ?? {
      staffId: assignment.assigned_staff_id,
      staffName: assignment.staff_profiles?.name ?? "Unknown staff",
      assigned: 0,
      completed: 0,
      cancelled: 0,
      total: 0,
    };
    if (assignment.status === "completed") existing.completed += 1;
    else if (assignment.status === "no_show" || assignment.status === "declined") existing.cancelled += 1;
    else if (assignment.status === "assigned") existing.assigned += 1;
    existing.total += 1;
    rows.set(assignment.assigned_staff_id, existing);
  }
  return [...rows.values()].sort((a, b) => b.total - a.total);
}
