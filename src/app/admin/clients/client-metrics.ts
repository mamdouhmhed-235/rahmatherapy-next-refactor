// B-2 — Client lifetime metrics for the B-6 LTV ribbon.
//
// Pure function over the bookingHistory shape that
// `src/app/admin/clients/[clientId]/page.tsx` already fetches
// (`ClientBookingRecord[]`). Per AUDIT-2026-05-22 H2: the helper consumes
// this directly so the B-6 ribbon adds zero new DB queries. Returns a
// zero-filled object when the client has no bookings (B-6 hides the ribbon
// when `visitCount === 0`).
//
// Plan: redesign/plans/B-phase/B2-metric-backend-plan.md (step 7).
// Brief: redesign/briefs/B2-metric-backend-brief.md §4 #10.

import type { ClientBookingRecord } from "./types";

export type ClientRepeatStatus = "new" | "returning" | "regular" | "loyal";

export interface ClientLifetimeMetrics {
  ltv: number;
  visitCount: number;
  completedCount: number;
  cancelledCount: number;
  lastSeenAt: string | null;
  firstSeenAt: string | null;
  avgBookingValue: number;
  preferredService: string | null;
  monthlyVisitsSeries: { month: string; count: number }[];
  repeatStatus: ClientRepeatStatus;
}

const MONTHS_IN_SPARKLINE = 12;

// Bucket thresholds per brief §4 #10:
//   < 2  → new
//   2–4  → returning
//   5–9  → regular
//   ≥ 10 → loyal
export function getRepeatStatus(completedCount: number): ClientRepeatStatus {
  if (completedCount >= 10) return "loyal";
  if (completedCount >= 5) return "regular";
  if (completedCount >= 2) return "returning";
  return "new";
}

export function getClientLifetimeMetrics(
  clientId: string,
  bookings: ClientBookingRecord[]
): ClientLifetimeMetrics {
  // Defensive: callers usually pre-filter, but support whole-history input too.
  const clientBookings = bookings.filter((b) => b.client_id === clientId);
  const completedBookings = clientBookings.filter((b) => b.status === "completed");
  const cancelledCount = clientBookings.filter((b) => b.status === "cancelled").length;

  if (completedBookings.length === 0) {
    return {
      ltv: 0,
      visitCount: 0,
      completedCount: 0,
      cancelledCount,
      lastSeenAt: null,
      firstSeenAt: null,
      avgBookingValue: 0,
      preferredService: null,
      monthlyVisitsSeries: buildEmptyMonthlySeries(MONTHS_IN_SPARKLINE),
      repeatStatus: "new",
    };
  }

  let ltv = 0;
  let firstSeenAt: string | null = null;
  let lastSeenAt: string | null = null;
  const serviceCounts = new Map<string, number>();
  for (const booking of completedBookings) {
    ltv += toNumber(booking.amount_paid ?? booking.total_price);
    if (!firstSeenAt || booking.booking_date < firstSeenAt) firstSeenAt = booking.booking_date;
    if (!lastSeenAt || booking.booking_date > lastSeenAt) lastSeenAt = booking.booking_date;
    for (const item of booking.booking_items) {
      const name = item.service_name_snapshot || "Unknown service";
      serviceCounts.set(name, (serviceCounts.get(name) ?? 0) + 1);
    }
  }

  const completedCount = completedBookings.length;
  const visitCount = completedCount;
  const avgBookingValue = visitCount > 0 ? ltv / visitCount : 0;
  const preferredService = pickPreferredService(serviceCounts);
  const monthlyVisitsSeries = buildMonthlySeries(
    completedBookings.map((b) => b.booking_date),
    lastSeenAt ?? firstSeenAt ?? "",
    MONTHS_IN_SPARKLINE
  );
  const repeatStatus = getRepeatStatus(completedCount);

  return {
    ltv,
    visitCount,
    completedCount,
    cancelledCount,
    lastSeenAt,
    firstSeenAt,
    avgBookingValue,
    preferredService,
    monthlyVisitsSeries,
    repeatStatus,
  };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0) || 0;
}

function pickPreferredService(serviceCounts: Map<string, number>): string | null {
  if (serviceCounts.size === 0) return null;
  let best: string | null = null;
  let bestCount = 0;
  for (const [service, count] of serviceCounts) {
    if (count > bestCount || (count === bestCount && best !== null && service < best)) {
      best = service;
      bestCount = count;
    }
  }
  return best;
}

function buildMonthlySeries(
  dateStrings: string[],
  anchorYmd: string,
  monthsBack: number
): { month: string; count: number }[] {
  // anchor = most recent visit's month, or today's month if no anchor supplied.
  const anchorMonth = anchorYmd ? anchorYmd.slice(0, 7) : new Date().toISOString().slice(0, 7);
  const months: string[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    months.push(shiftMonth(anchorMonth, -i));
  }
  const counts = new Map<string, number>();
  for (const ymd of dateStrings) {
    const month = ymd.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return months.map((month) => ({ month, count: counts.get(month) ?? 0 }));
}

function buildEmptyMonthlySeries(monthsBack: number): { month: string; count: number }[] {
  const anchorMonth = new Date().toISOString().slice(0, 7);
  const months: string[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    months.push(shiftMonth(anchorMonth, -i));
  }
  return months.map((month) => ({ month, count: 0 }));
}

function shiftMonth(yyyyMm: string, delta: number): string {
  const [year, month] = yyyyMm.split("-").map(Number);
  if (!year || !month) return yyyyMm;
  // delta is months to add (negative = earlier).
  const totalMonths = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${newYear.toString().padStart(4, "0")}-${newMonth.toString().padStart(2, "0")}`;
}
