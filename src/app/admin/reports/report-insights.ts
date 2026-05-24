// B-2 — Reports Insights stripe data layer.
//
// `getReportInsights` is a pure function over (current ReportData + prior
// ReportData + optional dismissed-id Set). Returns 0–3 plain-English
// observations from threshold-based comparisons. `buildInsightId` produces
// stable IDs (5%-bucketed deltas per AUDIT M10) so a dismissal in period P
// keeps the row hidden as the underlying delta drifts by ±2pp within P.
//
// Plan: redesign/plans/B-phase/B2-metric-backend-plan.md (step 6).
// Brief: redesign/briefs/B2-metric-backend-brief.md §4 #9 + §8 (templates).
// IDs: SHARED-IMPLEMENTATION-NOTES.md §14 (insight_dismissals + bucketing).

import {
  amount,
  getNetCollectionRate,
  getNoShowRate,
  getUtilisationRate,
  summarizeReports,
  type ReportData,
  type ReportFilters,
} from "./reporting";

export type InsightSeverity = "critical" | "warning" | "info";

export interface ReportInsight {
  id: string;
  severity: InsightSeverity;
  message: string;
  drillUrl?: string;
}

export interface InsightThresholds {
  bookingsDropWarningPct: number;
  bookingsDropCriticalPct: number;
  bookingsGrowthInfoPct: number;
  outstandingGrowthWarningGbp: number;
  staffUtilisationDropPp: number;
  timeToFirstContactWarningMinutes: number;
  noShowRateWarningPct: number;
  netCollectionCriticalPct: number;
}

export const DEFAULT_INSIGHT_THRESHOLDS: InsightThresholds = {
  bookingsDropWarningPct: 15,
  bookingsDropCriticalPct: 30,
  bookingsGrowthInfoPct: 25,
  outstandingGrowthWarningGbp: 200,
  staffUtilisationDropPp: 10,
  timeToFirstContactWarningMinutes: 60,
  noShowRateWarningPct: 15,
  netCollectionCriticalPct: 90,
};

export interface InsightOptions {
  thresholds?: Partial<InsightThresholds>;
  maxInsights?: number;
}

// ── buildInsightId ───────────────────────────────────────────────────────────
// Stable ID format: `<category>-<deltaBucket>-<period>-<yyyy-mm>`.
// deltaBucket is the delta rounded to the nearest 5% (per AUDIT M10) so a
// dismissed insight stays dismissed even if the delta drifts by ±2pp inside
// the same period. For non-percentage insights (e.g. outstanding £-delta),
// pass the magnitude bucket as a string (e.g. "300gbp").
export function buildInsightId(
  category: string,
  deltaBucket: string,
  period: string,
  yyyyMm: string
): string {
  return `${category}-${deltaBucket}-${period}-${yyyyMm}`;
}

// ── getReportInsights ────────────────────────────────────────────────────────
export function getReportInsights(
  data: ReportData,
  priorData: ReportData | null,
  dismissedIds: Set<string> = new Set(),
  options: InsightOptions = {}
): ReportInsight[] {
  if (!priorData) return [];
  const thresholds: InsightThresholds = { ...DEFAULT_INSIGHT_THRESHOLDS, ...options.thresholds };
  const maxInsights = options.maxInsights ?? 3;
  const period = periodLabel(data.filters);
  const priorLabel = priorPeriodLabel(data.filters);
  const yyyyMm = (data.filters.from || "").slice(0, 7) || "unknown";

  const candidates: ReportInsight[] = [];

  // 1+2. Booking count delta
  const current = summarizeReports(data);
  const prior = summarizeReports(priorData);
  const bookingsDeltaPct = prior.bookingCount > 0
    ? ((current.bookingCount - prior.bookingCount) / prior.bookingCount) * 100
    : 0;
  if (prior.bookingCount > 0 && bookingsDeltaPct <= -thresholds.bookingsDropCriticalPct) {
    const bucket = bucket5(Math.abs(bookingsDeltaPct));
    candidates.push({
      id: buildInsightId("bookings-dropped-critical", `${bucket}pct`, period, yyyyMm),
      severity: "critical",
      message: `Bookings this ${period} dropped sharply — ${Math.round(Math.abs(bookingsDeltaPct))}% lower than the prior ${priorLabel}.`,
    });
  } else if (prior.bookingCount > 0 && bookingsDeltaPct <= -thresholds.bookingsDropWarningPct) {
    const bucket = bucket5(Math.abs(bookingsDeltaPct));
    candidates.push({
      id: buildInsightId("bookings-dropped", `${bucket}pct`, period, yyyyMm),
      severity: "warning",
      message: `Bookings this ${period} are ${Math.round(Math.abs(bookingsDeltaPct))}% lower than the prior ${priorLabel}.`,
    });
  } else if (prior.bookingCount > 0 && bookingsDeltaPct >= thresholds.bookingsGrowthInfoPct) {
    const bucket = bucket5(bookingsDeltaPct);
    candidates.push({
      id: buildInsightId("bookings-grew", `${bucket}pct`, period, yyyyMm),
      severity: "info",
      message: `Bookings up ${Math.round(bookingsDeltaPct)}% on the prior ${priorLabel} — nice.`,
    });
  }

  // 3. Outstanding revenue grew
  const outstandingDelta = current.outstandingRevenue - prior.outstandingRevenue;
  if (outstandingDelta > thresholds.outstandingGrowthWarningGbp) {
    // £-bucket: round to nearest £50 for ID stability
    const gbpBucket = Math.round(outstandingDelta / 50) * 50;
    candidates.push({
      id: buildInsightId("outstanding-grew", `${gbpBucket}gbp`, period, yyyyMm),
      severity: "warning",
      message: `Outstanding revenue grew £${Math.round(outstandingDelta)} vs last ${priorLabel} — review unpaid bookings.`,
      drillUrl: "/admin/reports?paymentStatus=unpaid",
    });
  }

  // 4. Per-staff utilisation drops > 10pp. Computes per-staff utilisation in
  // current and prior; flags the single biggest drop (avoids stripe spam).
  let worstDrop: { staffId: string; staffName: string; current: number; prior: number; drop: number } | null = null;
  for (const staff of data.staff) {
    if (!staff.active || !staff.can_take_bookings) continue;
    const currUtil = getUtilisationRate(data, { staffId: staff.id }).rate;
    const priorUtil = getUtilisationRate(priorData, { staffId: staff.id }).rate;
    const dropPp = (priorUtil - currUtil) * 100; // positive = drop
    if (priorUtil > 0 && dropPp >= thresholds.staffUtilisationDropPp) {
      if (!worstDrop || dropPp > worstDrop.drop) {
        worstDrop = {
          staffId: staff.id,
          staffName: staff.name,
          current: Math.round(currUtil * 100),
          prior: Math.round(priorUtil * 100),
          drop: dropPp,
        };
      }
    }
  }
  if (worstDrop) {
    const bucket = bucket5(worstDrop.drop);
    candidates.push({
      id: buildInsightId(
        `staff-utilisation-${worstDrop.staffId}-drop`,
        `${bucket}pct`,
        period,
        yyyyMm
      ),
      severity: "warning",
      message: `${worstDrop.staffName}'s utilisation dropped from ${worstDrop.prior}% to ${worstDrop.current}% this ${period}.`,
      drillUrl: `/admin/staff/${worstDrop.staffId}?range=${data.filters.range}`,
    });
  }

  // 5. Avg time-to-first-contact exceeded threshold
  const currTtfc = averageTimeToFirstContactMinutes(data);
  const priorTtfc = averageTimeToFirstContactMinutes(priorData);
  if (currTtfc >= thresholds.timeToFirstContactWarningMinutes) {
    const bucket = Math.round(currTtfc / 5) * 5; // 5-minute bucket
    candidates.push({
      id: buildInsightId("ttfc-high", `${bucket}min`, period, yyyyMm),
      severity: "warning",
      message: priorTtfc > 0
        ? `Avg time-to-first-contact on new enquiries is ${Math.round(currTtfc)} min this ${period}, up from ${Math.round(priorTtfc)} min.`
        : `Avg time-to-first-contact on new enquiries is ${Math.round(currTtfc)} min this ${period}.`,
      drillUrl: "/admin/enquiries?tab=new",
    });
  }

  // 6. No-show rate exceeded threshold
  const noShow = getNoShowRate(data);
  if (noShow.rate * 100 >= thresholds.noShowRateWarningPct && noShow.total > 0) {
    const bucket = bucket5(noShow.rate * 100);
    candidates.push({
      id: buildInsightId("noshow-high", `${bucket}pct`, period, yyyyMm),
      severity: "warning",
      message: `No-show rate is ${Math.round(noShow.rate * 100)}% this ${period} — £${Math.round(noShow.lostRevenue)} potential revenue lost.`,
    });
  }

  // 7. Net collection rate fell below 90%
  const collection = getNetCollectionRate(data);
  if (collection.billed > 0 && collection.rate * 100 < thresholds.netCollectionCriticalPct) {
    const bucket = bucket5(collection.rate * 100);
    candidates.push({
      id: buildInsightId("collection-low", `${bucket}pct`, period, yyyyMm),
      severity: "critical",
      message: `Net collection rate fell to ${Math.round(collection.rate * 100)}% — below the 95% benchmark.`,
      drillUrl: "/admin/reports?paymentStatus=unpaid",
    });
  }

  // Filter dismissed, sort by severity, cap.
  const live = candidates.filter((i) => !dismissedIds.has(i.id));
  live.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));
  return live.slice(0, maxInsights);
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function bucket5(value: number): number {
  return Math.round(value / 5) * 5;
}

function severityWeight(s: InsightSeverity): number {
  return s === "critical" ? 3 : s === "warning" ? 2 : 1;
}

function periodLabel(filters: ReportFilters): string {
  if (filters.range === "today") return "day";
  if (filters.range === "week") return "week";
  if (filters.range === "month") return "month";
  if (filters.range === "year") return "year";
  if (filters.range === "lifetime") return "period";
  return "period";
}

function priorPeriodLabel(filters: ReportFilters): string {
  if (filters.range === "today") return "day";
  if (filters.range === "week") return "week";
  if (filters.range === "month") return "month";
  if (filters.range === "year") return "year";
  return "period";
}

// Average minutes between enquiry created_at and first_contacted_at, across
// the enquiries in this period that have both timestamps set. Period is
// derived from the enquiry's created_at, matching the brief's "this week"
// semantics for new enquiries.
function averageTimeToFirstContactMinutes(data: ReportData): number {
  let totalMinutes = 0;
  let n = 0;
  const fromMs = data.filters.from ? Date.parse(`${data.filters.from}T00:00:00.000Z`) : Number.NEGATIVE_INFINITY;
  const toMs = data.filters.to ? Date.parse(`${data.filters.to}T23:59:59.999Z`) : Number.POSITIVE_INFINITY;
  for (const enquiry of data.enquiries) {
    if (!enquiry.first_contacted_at || !enquiry.created_at) continue;
    const createdMs = Date.parse(enquiry.created_at);
    if (Number.isNaN(createdMs)) continue;
    if (createdMs < fromMs || createdMs > toMs) continue;
    const contactedMs = Date.parse(enquiry.first_contacted_at);
    if (Number.isNaN(contactedMs) || contactedMs < createdMs) continue;
    totalMinutes += (contactedMs - createdMs) / 60000;
    n += 1;
  }
  return n > 0 ? totalMinutes / n : 0;
}

// Re-export amount via /admin/reports to keep import surface tidy; consumers
// can import from this file when working with insights-shaped data.
export { amount };
