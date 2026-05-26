// B-5 dashboard helpers — Personal Contribution stripe tile composition,
// Mobile sticky action bar config, and the one-time legacy disclosure key
// cleanup.
//
// All helpers are pure (no React, no DOM aside from the explicit
// `cleanupLegacyDisclosureKey` window-touch which is guarded). Values that
// render in <MetricRow> are pre-formatted strings to avoid the server→client
// function-prop boundary (B-1 lesson: closures can't cross).
//
// AUDIT references:
//   - Q4: Owner Personal Stripe shows OWN metrics — tile 2 (Business) sums
//     clinical.assignmentsCompleted + admin.bookingsAssignedCount so an
//     Owner-who-doesn't-treat sees `0 + N` (not hidden).
//   - Q5: Therapist mobile sticky bar fallback ladder — Next Visit → Browse
//     claimable → Set my availability. The bar essentially never hides for
//     an active Therapist.
//   - R6: Therapist fullness pass guarded by NEXT_PUBLIC_B5_THERAPIST_FULLNESS
//     (consumed by TherapistDashboard; helpers don't read env).

import type {
  ReportBooking,
  StaffScorecard,
} from "../reports/reporting";
import { formatMoney, formatNumber } from "../reports/reporting";
import { formatDurationFromMinutes } from "../reports/report-insights";

export type StripeVariant = "business" | "coordinator" | "therapist";

export interface PersonalStripeTile {
  /** Short label rendered as the row prefix. */
  label: string;
  /** Pre-formatted value string (numbers narrow to en-GB; money via formatMoney). */
  value: string;
  /** Delta from prior period (rounded number, sign carries meaning). Optional. */
  delta?: number | null;
  /** Optional daily series for the mini-sparkline; omit when not meaningful. */
  series?: number[];
  /** "invert" inverts colour semantics for smaller-is-better metrics (e.g. minutes-to-first-contact). */
  tone?: "auto" | "invert";
}

export interface PersonalStripeContext {
  staffId: string;
  /**
   * Therapist tile 1 — the only forward-looking exception in the stripe.
   * Sits outside the picker's period frame by design ("what's next?" doesn't
   * narrow to today/week/month meaningfully).
   */
  nextAppointment: ReportBooking | null;
  /**
   * Coordinator tile 1 — count of enquiries CREATED in the stripe period
   * (not "open right now"). Computed page-side from `stripeData.enquiries`
   * filtered by `created_at` within the stripe window.
   */
  newEnquiriesInPeriod: number;
}

// ── tile composition ────────────────────────────────────────────────────────

export function tilesForVariant(
  variant: StripeVariant,
  scorecard: StaffScorecard,
  context: PersonalStripeContext
): PersonalStripeTile[] {
  if (variant === "business") {
    return businessTiles(scorecard, context);
  }
  if (variant === "coordinator") {
    return coordinatorTiles(scorecard, context);
  }
  return therapistTiles(scorecard, context);
}

function businessTiles(
  scorecard: StaffScorecard,
  context: PersonalStripeContext
): PersonalStripeTile[] {
  // context parameter retained for signature uniformity across variant
  // builders; Business currently derives all four tiles from `scorecard`.
  void context;
  // Tile 2 union per AUDIT Q4: clinical (completed visits) + admin (bookings
  // assigned to staff). An Owner who never treats sees `0 + N`, not hidden.
  const contributionValue =
    scorecard.clinical.assignmentsCompleted +
    scorecard.admin.bookingsAssignedCount;
  const contributionDelta = scorecard.deltas
    ? scorecard.deltas.clinical.assignmentsCompleted +
      scorecard.deltas.admin.bookingsAssignedCount
    : null;

  // Avg booking value — personal scope (my completed visits' revenue / count).
  // Owner who doesn't treat → both are 0 → show "—". Truthful + consistent
  // with tile 2's clinical-zero behaviour. Period-able because the source
  // scorecard is built from period-scoped `stripeData`.
  const avgBookingValue =
    scorecard.clinical.assignmentsCompleted > 0
      ? scorecard.clinical.revenueAttributed /
        scorecard.clinical.assignmentsCompleted
      : null;

  return [
    {
      // Period-scoped count of my assignments — replaces the prior
      // "Bookings today" NOW-snapshot (which ignored the picker).
      label: "My bookings",
      value: formatNumber(scorecard.clinical.assignmentsTotal),
    },
    {
      label: "My contribution",
      value: formatNumber(contributionValue),
      delta: contributionDelta,
    },
    {
      // Label drops hardcoded "this week" suffix — the eyebrow already
      // shows the period, the tile shouldn't repeat or contradict it.
      label: "Revenue",
      value: formatMoney(scorecard.clinical.revenueAttributed),
      delta: scorecard.deltas?.clinical.revenueAttributed ?? null,
    },
    {
      // Replaces "Open attention" (which was clinic-wide NOW state and
      // ignored the picker). AUDIT Q2 specced this formula for B-4 Reports;
      // same denominator applies here at personal scope.
      label: "Avg booking value",
      value: avgBookingValue !== null ? formatMoney(avgBookingValue) : "—",
    },
  ];
}

function coordinatorTiles(
  scorecard: StaffScorecard,
  context: PersonalStripeContext
): PersonalStripeTile[] {
  // Avg time-to-first-contact reads naturally as a duration — reuse the B-4
  // smart-unit formatter so 9712 min renders as "6.7 days" not raw minutes.
  const avgResponseMinutes = scorecard.admin.avgMinutesToFirstContact;
  const avgResponseValue =
    avgResponseMinutes > 0
      ? formatDurationFromMinutes(avgResponseMinutes)
      : "—";

  return [
    {
      // Period-able front-of-funnel volume — replaces "Unassigned today"
      // (which was a NOW-state snapshot that ignored the picker).
      label: "New enquiries",
      value: formatNumber(context.newEnquiriesInPeriod),
    },
    {
      label: "Enquiries handled",
      value: formatNumber(scorecard.admin.enquiriesContactedCount),
      delta: scorecard.deltas?.admin.enquiriesContactedCount ?? null,
    },
    {
      label: "Conversion rate",
      value: `${Math.round(scorecard.admin.enquiryConversionRate * 100)}%`,
      delta: scorecard.deltas
        ? Math.round(scorecard.deltas.admin.enquiryConversionRate * 100)
        : null,
    },
    {
      // Replaces "Active attention" (clinic-wide NOW) with the Coordinator's
      // signature operational metric — period-able + personal. Already in
      // the B-2 scorecard.
      label: "Avg response time",
      value: avgResponseValue,
      tone: "invert",
    },
  ];
}

function therapistTiles(
  scorecard: StaffScorecard,
  context: PersonalStripeContext
): PersonalStripeTile[] {
  const nextVisitLabel = formatNextVisitLabel(context.nextAppointment);
  return [
    {
      // Forward-looking exception — the only stripe tile that legitimately
      // doesn't narrow with the picker. Worker-app pattern (Uber Driver,
      // DoorDash Dasher) — "what's next?" beats "what did I do?" for the
      // on-the-road operator.
      label: "Next visit",
      value: nextVisitLabel,
    },
    {
      // Period-scoped count of my assignments (was "Today's visits" — a
      // NOW snapshot that ignored the picker).
      label: "Visits",
      value: formatNumber(scorecard.clinical.assignmentsTotal),
    },
    {
      // Label drops "this week" suffix; value already period-scoped.
      label: "Hours",
      value: formatHoursDecimal(scorecard.clinical.hoursWorked),
      delta: scorecard.deltas?.clinical.hoursWorked
        ? Math.round(scorecard.deltas.clinical.hoursWorked)
        : null,
    },
    {
      // Label drops "this month" suffix; value already period-scoped.
      label: "Clients",
      value: formatNumber(scorecard.clinical.clientsTouched),
      delta: scorecard.deltas?.clinical.clientsTouched ?? null,
    },
  ];
}

function formatNextVisitLabel(next: ReportBooking | null): string {
  if (!next) return "Nothing scheduled";
  const time = next.start_time?.slice(0, 5) ?? "—";
  const fullName = next.contact_full_name ?? "";
  const firstName = fullName.trim().split(/\s+/)[0] ?? "";
  if (!firstName) return time;
  return `${time} · ${firstName}`;
}

/**
 * Drop decimal at ≥10h; otherwise show one decimal. Reuses the B-4 "smart unit"
 * pattern from `TherapistDashboard.formatHours` so the stripe matches the
 * weekly summary visually.
 */
function formatHoursDecimal(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "0h";
  if (hours >= 10) return `${Math.round(hours)}h`;
  return `${hours.toFixed(1).replace(/\.0$/, "")}h`;
}

// ── mobile sticky bar config ────────────────────────────────────────────────

export interface StickyActionItem {
  label: string;
  href: string;
  /** External (Maps / tel:) so the link doesn't intercept via next/link. */
  external?: boolean;
}

export interface MobileStickyAction {
  primary: StickyActionItem;
  secondary?: StickyActionItem;
}

export interface MobileStickyActionContext {
  variant: StripeVariant;
  staffId: string;
  unassignedCount: number;
  /** Therapist-only — count of claimable assignments for the fallback ladder. */
  claimableCount: number;
  /** Therapist-only — drives Maps + Call deep-links. */
  nextAppointment: ReportBooking | null;
}

/**
 * Per AUDIT-2026-05-22 Q5 fallback ladder for Therapist:
 *   1. Next Visit present → "Open in Maps" + "Call client" side-by-side.
 *   2. No Next Visit but claimable > 0 → "Browse claimable →" full-width.
 *   3. Neither → "Set my availability →".
 *   4. Hide only when ALL three are unavailable (essentially never for an
 *      active Therapist).
 *
 * Business / Coordinator: "Assign N unassigned →" when N > 0, else null.
 */
export function mobileStickyActionForVariant(
  context: MobileStickyActionContext
): MobileStickyAction | null {
  if (context.variant === "therapist") {
    return therapistSticky(context);
  }
  if (context.unassignedCount > 0) {
    return {
      primary: {
        label: `Assign ${context.unassignedCount} unassigned →`,
        href: "/admin/bookings?view=unassigned",
      },
    };
  }
  return null;
}

function therapistSticky(
  context: MobileStickyActionContext
): MobileStickyAction | null {
  const next = context.nextAppointment;
  if (next) {
    const maps = buildMapsHref(next);
    const phone = next.contact_phone ?? null;
    if (maps && phone) {
      return {
        primary: { label: "Open in Maps", href: maps, external: true },
        secondary: { label: "Call client", href: `tel:${phone}`, external: true },
      };
    }
    if (maps) {
      return { primary: { label: "Open in Maps", href: maps, external: true } };
    }
    if (phone) {
      return {
        primary: { label: "Call client", href: `tel:${phone}`, external: true },
      };
    }
    // Has appointment but no address + no phone — fall through to claimable.
  }
  if (context.claimableCount > 0) {
    return {
      primary: {
        label: "Browse claimable →",
        href: "/admin/bookings?view=claimable",
      },
    };
  }
  return {
    primary: {
      label: "Set my availability →",
      href: `/admin/staff/${context.staffId}/availability`,
    },
  };
}

function buildMapsHref(booking: ReportBooking): string | null {
  const parts = [
    booking.service_address_line1,
    booking.service_postcode,
    booking.service_city,
  ].filter((part): part is string => Boolean(part && part.trim()));
  if (parts.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    parts.join(", ")
  )}`;
}

// ── legacy disclosure cleanup ───────────────────────────────────────────────

/**
 * Removes the orphaned `BusinessOverviewDisclosure` Business-variant
 * preference key from earlier dashboard iterations. With Tier-2 disclosure
 * removed for Business variant, the stored value never re-reads — pure
 * housekeeping so users don't carry stale localStorage indefinitely.
 *
 * The actual key shape is `rahmatherapy-business-overview-expanded-{staffId}`
 * (verified via `dashboard-filters-client.tsx:625`). The earlier B-5 brief
 * referenced `dashboard:show-business-overview-{userId}` as a placeholder;
 * we honour the intent with the real key. The Coordinator-variant disclosure
 * (still active for Active Enquiries) uses `…-coordinator-{staffId}` and is
 * NOT touched.
 *
 * Safe to call on any tick; idempotent.
 */
export function cleanupLegacyDisclosureKey(staffId: string): void {
  if (typeof window === "undefined") return;
  const key = `rahmatherapy-business-overview-expanded-${staffId}`;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // localStorage unavailable (private mode / quota). Ignore.
  }
}

/** Test-only export of the prefix used by `cleanupLegacyDisclosureKey`. */
export const LEGACY_DISCLOSURE_KEY_PREFIX =
  "rahmatherapy-business-overview-expanded-";

// ── stripe date-range helpers ───────────────────────────────────────────────
//
// The Personal Stripe period picker (today / this_week / this_month) is
// independent of the dashboard's filter strip range. Compute its own date
// window so getDashboardData can be invoked with stripe-scoped filters and
// the scorecard reflects the user's chosen period regardless of what the
// filter strip is set to.
//
// Prior-period windows are immediately-preceding equal-length windows
// (matches buildPriorPeriodFilters semantics so deltas read intuitively).
// All math is UTC-anchored on the supplied `todayKey` (yyyy-mm-dd from
// `getBusinessDate()`).

export type StripeRange = "today" | "this_week" | "this_month";

export interface StripeDateRange {
  from: string;
  to: string;
}

function ymdAddDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfWeekMonday(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - daysFromMonday);
  return d.toISOString().slice(0, 10);
}

function startOfMonth(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

function endOfMonth(ymd: string): string {
  const [year, month] = ymd.slice(0, 7).split("-").map(Number);
  // Day 0 of next month = last day of this month.
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}

export function getStripeDateRange(
  range: StripeRange,
  todayKey: string
): StripeDateRange {
  if (range === "today") return { from: todayKey, to: todayKey };
  if (range === "this_week") {
    return { from: startOfWeekMonday(todayKey), to: todayKey };
  }
  return { from: startOfMonth(todayKey), to: todayKey };
}

export function getPriorStripeDateRange(
  range: StripeRange,
  todayKey: string
): StripeDateRange {
  if (range === "today") {
    const yesterday = ymdAddDays(todayKey, -1);
    return { from: yesterday, to: yesterday };
  }
  if (range === "this_week") {
    const weekStart = startOfWeekMonday(todayKey);
    const priorEnd = ymdAddDays(weekStart, -1); // last Sun before this Mon
    const priorStart = ymdAddDays(priorEnd, -6); // previous Mon
    return { from: priorStart, to: priorEnd };
  }
  // this_month — previous calendar month in full.
  const thisMonthStart = startOfMonth(todayKey);
  const priorEnd = ymdAddDays(thisMonthStart, -1); // last day of prev month
  const priorStart = startOfMonth(priorEnd);
  // Use endOfMonth so the window spans the full prior month (not just to
  // the same day-of-month as today, which would skew month-over-month deltas
  // mid-month).
  return { from: priorStart, to: endOfMonth(priorEnd) };
}
