// B-5 Therapist fullness pass — pure helpers (brief §5.6, AUDIT M1 + Q1).
//
// AUDIT Q1 tone discipline ("disciplined warmth" per PRODUCT.md): factual,
// calm phrasing; no "best month yet" gamification copy; icons are
// TrendingUp / Sparkles / Lightbulb — not Trophy or Star.
//
// AUDIT G-final-4: `getRecentClientsForTherapist` reads `data.bookings` which
// is already auto-narrowed to assigned_and_claimable scope in dashboard-data
// (line 139). Do NOT widen the scope from a future audit pass — that would
// turn this strip into a clinic-wide leak.

import type { ReportData, StaffScorecard } from "../reports/reporting";
import type { StripeRange } from "./dashboard-helpers-b5";

// ── Highlight or tip ────────────────────────────────────────────────────────

export type TherapistHighlightIcon = "TrendingUp" | "Sparkles" | "Lightbulb";

export interface TherapistHighlight {
  /** "highlight" when computed from real metrics; "tip" when nothing tripped. */
  kind: "highlight" | "tip";
  icon: TherapistHighlightIcon;
  message: string;
}

const PERIOD_WORD: Record<StripeRange, string> = {
  today: "today",
  this_week: "this week",
  this_month: "this month",
};

const PRIOR_PERIOD_WORD: Record<StripeRange, string> = {
  today: "yesterday",
  this_week: "last week",
  this_month: "last month",
};

const TIP_LIBRARY: string[] = [
  "Tip: Tap a Next Visit address to open Maps directly.",
  "Tip: Pull down to refresh the dashboard.",
  "Tip: Claim a booking from the strip below — first to claim wins.",
  "Tip: Mark a session complete from the booking detail page after each visit.",
  "Tip: Set your availability under Staff → My availability to control bookings.",
];

/**
 * Deterministic hash from a profile id to a tip index. Stable per session so
 * the same staff sees the same tip across renders within the same period.
 */
function pickTipIndex(profileId: string): number {
  let hash = 0;
  for (let i = 0; i < profileId.length; i++) {
    hash = ((hash << 5) - hash + profileId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % TIP_LIBRARY.length;
}

function pluraliseVisits(n: number): string {
  return `${n} visit${n === 1 ? "" : "s"}`;
}

function pluraliseRequests(n: number): string {
  return `${n} same-gender request${n === 1 ? "" : "s"}`;
}

function formatPctWhole(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "0%";
  return `${Math.round(rate * 100)}%`;
}

/**
 * Picks at most one factual highlight from the scorecard (+ prior, if given);
 * falls back to a deterministic tip when nothing trips. Priority order:
 *   1. First visit completed (welcome — only triggers on assignmentsCompleted === 1
 *      AND assignmentsTotal === 1 to avoid mis-firing on quiet returning therapists)
 *   2. Same-gender requests fulfilled this period
 *   3. Visits up vs prior period
 *   4. Utilisation up vs prior period
 *   5. Steady period (≥3 completions, zero cancellations / no-shows)
 *   6. Tip fallback (deterministic library pick)
 */
export function getTherapistHighlightOrTip(
  scorecard: StaffScorecard,
  priorScorecard: StaffScorecard | null | undefined,
  profile: { id: string },
  range: StripeRange = "this_week"
): TherapistHighlight {
  const period = PERIOD_WORD[range];
  const priorPeriod = PRIOR_PERIOD_WORD[range];
  const c = scorecard.clinical;

  // 1. First visit ever — fire only when exactly one assignment exists and it
  // completed. Pre-onboarding (zero assignments) does NOT trigger here; the
  // ProfileCompletionNudge handles that case.
  if (c.assignmentsTotal === 1 && c.assignmentsCompleted === 1) {
    return {
      kind: "highlight",
      icon: "Sparkles",
      message: "First visit completed — welcome to the rota.",
    };
  }

  // 2. Same-gender requests fulfilled this period
  if (c.sameGenderFulfilled > 0) {
    return {
      kind: "highlight",
      icon: "TrendingUp",
      message: `${pluraliseRequests(c.sameGenderFulfilled)} fulfilled ${period}.`,
    };
  }

  // 3. Visits up vs prior period (both > 0, and at least +1 visit absolute gain)
  if (priorScorecard) {
    const p = priorScorecard.clinical;
    if (
      c.assignmentsCompleted > p.assignmentsCompleted &&
      p.assignmentsCompleted > 0
    ) {
      return {
        kind: "highlight",
        icon: "TrendingUp",
        message: `${pluraliseVisits(c.assignmentsCompleted)} completed ${period} — up from ${p.assignmentsCompleted} ${priorPeriod}.`,
      };
    }
  }

  // 4. Utilisation up vs prior period (require ≥10pp gain so noise doesn't fire)
  if (priorScorecard) {
    const p = priorScorecard.clinical;
    if (
      c.utilisation.rate > p.utilisation.rate + 0.1 &&
      p.utilisation.rate > 0
    ) {
      return {
        kind: "highlight",
        icon: "TrendingUp",
        message: `Utilisation at ${formatPctWhole(c.utilisation.rate)} — up from ${formatPctWhole(p.utilisation.rate)} ${priorPeriod}.`,
      };
    }
  }

  // 5. Steady period — ≥3 completions, zero no-shows + cancellations
  if (
    c.assignmentsCompleted >= 3 &&
    c.noShowRate.noShows === 0 &&
    c.noShowRate.cancelled === 0
  ) {
    return {
      kind: "highlight",
      icon: "TrendingUp",
      message: `Steady ${period}: ${pluraliseVisits(c.assignmentsCompleted)} completed with no cancellations.`,
    };
  }

  // 6. Tip fallback
  return {
    kind: "tip",
    icon: "Lightbulb",
    message: TIP_LIBRARY[pickTipIndex(profile.id)],
  };
}

/** Test-only export. */
export function listTipLibraryForTests(): readonly string[] {
  return TIP_LIBRARY;
}

// ── Recent clients ──────────────────────────────────────────────────────────

export interface RecentClient {
  clientId: string;
  firstName: string;
  fullName: string;
  lastBookingDate: string;
  lastBookingId: string;
  lastService: string;
  daysSinceLast: number;
}

function ymdToUtcMs(ymd: string): number {
  const [year, month, day] = ymd.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return Number.NaN;
  return Date.UTC(year, month - 1, day);
}

function pickFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/**
 * Last `max` unique clients (by client_id) seen by this Therapist, filtered to
 * completed bookings within the last `windowDays` from `todayKey`. Returns
 * most-recent-first. Hidden entirely when there are no matches.
 *
 * AUDIT G-final-4 dependency: `data.bookings` is already narrowed to
 * assigned_and_claimable in dashboard-data.ts (line 139), so "clients seen by
 * this therapist" falls out naturally. A future widening of that scope would
 * leak clinic-wide clients into this strip — don't.
 */
export function getRecentClientsForTherapist(
  data: ReportData,
  todayKey: string,
  windowDays: number = 30,
  max: number = 6
): RecentClient[] {
  if (!todayKey) return [];
  const todayMs = ymdToUtcMs(todayKey);
  if (!Number.isFinite(todayMs)) return [];
  const windowStartMs = todayMs - windowDays * 86_400_000;

  // Build a booking_id → first service name lookup (booking_items snapshot).
  const serviceByBookingId = new Map<string, string>();
  for (const item of data.bookingItems) {
    if (!item.booking_id) continue;
    if (serviceByBookingId.has(item.booking_id)) continue;
    const name = item.service_name_snapshot?.trim();
    if (name) serviceByBookingId.set(item.booking_id, name);
  }

  // Filter + sort bookings: completed only, has client_id, within window.
  const eligible = data.bookings
    .filter((booking) => {
      if (booking.status !== "completed") return false;
      if (!booking.client_id) return false;
      if (!booking.booking_date) return false;
      const ms = ymdToUtcMs(booking.booking_date);
      if (!Number.isFinite(ms)) return false;
      return ms >= windowStartMs && ms <= todayMs;
    })
    .sort((a, b) => {
      if (a.booking_date !== b.booking_date) {
        return b.booking_date.localeCompare(a.booking_date);
      }
      return (b.start_time ?? "").localeCompare(a.start_time ?? "");
    });

  const seen = new Set<string>();
  const out: RecentClient[] = [];
  for (const booking of eligible) {
    const clientId = booking.client_id;
    if (!clientId || seen.has(clientId)) continue;
    seen.add(clientId);
    const fullName = booking.contact_full_name?.trim() ?? "Client";
    const ms = ymdToUtcMs(booking.booking_date);
    const daysSinceLast = Math.max(
      0,
      Math.round((todayMs - ms) / 86_400_000)
    );
    out.push({
      clientId,
      firstName: pickFirstName(fullName) || "Client",
      fullName,
      lastBookingDate: booking.booking_date,
      lastBookingId: booking.id,
      lastService: serviceByBookingId.get(booking.id) ?? "Visit",
      daysSinceLast,
    });
    if (out.length >= max) break;
  }
  return out;
}

// ── Quick-help links ────────────────────────────────────────────────────────

export interface QuickHelpLink {
  key: string;
  label: string;
  href: string;
}

export interface QuickHelpPermissions {
  canEditProfile: boolean;
  canEditAvailability: boolean;
  canBrowseClaimable: boolean;
  canViewOwnBookings: boolean;
}

/**
 * Returns the help-panel link set filtered to what the Therapist can reach.
 * Brief §5.6 #10: "Always renders at least one link; hides the panel entirely
 * only when every link would be denied (essentially impossible for an active
 * Therapist)." The consumer decides whether to mount the panel based on the
 * returned array's length.
 */
export function quickHelpLinksForTherapist(
  staffId: string,
  permissions: QuickHelpPermissions
): QuickHelpLink[] {
  const links: QuickHelpLink[] = [];
  if (permissions.canEditProfile) {
    links.push({
      key: "profile",
      label: "Update my profile",
      href: `/admin/staff/${staffId}`,
    });
  }
  if (permissions.canEditAvailability) {
    links.push({
      key: "availability",
      label: "Set my availability",
      href: `/admin/staff/${staffId}/availability`,
    });
  }
  if (permissions.canBrowseClaimable) {
    links.push({
      key: "claimable",
      label: "Browse claimable work",
      href: "/admin/bookings?view=claimable",
    });
  }
  if (permissions.canViewOwnBookings) {
    links.push({
      key: "completed",
      label: "View my completed visits",
      href: `/admin/bookings?view=completed&staffId=${staffId}`,
    });
  }
  return links;
}
