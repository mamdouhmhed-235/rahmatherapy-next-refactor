// B-3 — pure helpers for the Performance surface.
// Server-component-safe: no React, no client-only APIs. The consumer
// (PerformanceSurface + child sections) renders these specs through a small
// `"use client"` adapter so format functions never have to cross the
// server→client boundary (B-1 progress logged that constraint).

import { Calendar, MessageCircle, Users, Settings, Clock, AlertCircle, BarChart3, Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { describeAction, type ActionFamily } from "@/app/admin/audit/format";
import type { StaffScorecard } from "@/app/admin/reports/reporting";

// ── TileSpec ─────────────────────────────────────────────────────────────────
// Serialisable shape so server components can pass these to client `<KpiTile>`
// / `<ScorecardRing>` via a thin client adapter that resolves `formatKey` to a
// formatter function. `formatValue` closures cannot cross the RSC wire.

export type TileFormatKey = "count" | "money" | "percent" | "hours" | "minutes";

export interface KpiTileSpec {
  kind: "kpi";
  id: string;
  label: string;
  value: number;
  delta?: number | null;
  series?: number[];
  tone?: "auto" | "invert";
  href?: string;
  hint?: string;
  formatKey?: TileFormatKey;
}

export interface RingTileSpec {
  kind: "ring";
  id: string;
  label: string;
  value: number;
  target: number;
  unit?: string;
  hint?: string;
}

export type TileSpec = KpiTileSpec | RingTileSpec;

// ── Shell mapping ────────────────────────────────────────────────────────────
// Brief literal `'owner' | 'admin' | 'coordinator' | 'therapist'` is collapsed
// to the project's existing `AdminShellVariant` because owner+admin behave
// identically on this surface (same tile set; only Owner-who-doesn't-treat
// branches, decided by scorecard.clinical.assignmentsTotal at runtime).

export type PerformanceShell = "owner_admin" | "coordinator" | "therapist";

export interface TilesForRoleOptions {
  staffId?: string;
  range?: string;
  // Owner-who-doesn't-treat tile #6: business net revenue this period.
  businessNetRevenue?: number;
  // ?show=all on /admin/me URL — expands the owner_admin union from 6 → 13.
  showAll?: boolean;
  // Per-metric historical series (weekly buckets in the selected range). The
  // caller (PerformanceSurface section) precomputes these from ReportData;
  // tilesForRole only threads them into the spec.
  series?: {
    assignmentsCompleted?: number[];
    hoursWorked?: number[];
    revenueAttributed?: number[];
    clientsTouched?: number[];
    enquiriesContactedCount?: number[];
    bookingsAssignedCount?: number[];
  };
}

// ── tilesForRole ─────────────────────────────────────────────────────────────

export function tilesForRole(
  shell: PerformanceShell,
  scorecard: StaffScorecard,
  options: TilesForRoleOptions = {}
): TileSpec[] {
  const therapistTiles = buildTherapistTiles(scorecard, options);
  const coordinatorTiles = buildCoordinatorTiles(scorecard, options);

  if (shell === "therapist") return therapistTiles;
  if (shell === "coordinator") return coordinatorTiles;

  // owner_admin: branch on assignmentsTotal in the selected period (brief §6).
  const treats = scorecard.clinical.assignmentsTotal > 0;
  if (!treats) {
    const adminPlusRevenue = [...coordinatorTiles];
    if (options.businessNetRevenue != null) {
      adminPlusRevenue.push({
        kind: "kpi",
        id: "business-net-revenue",
        label: "Business net revenue",
        value: options.businessNetRevenue,
        formatKey: "money",
        hint: "across the whole clinic this period",
      });
    }
    return adminPlusRevenue;
  }

  // Owner-who-treats / Admin: union of clinical + admin. Default visible 6
  // (top-by-relevance per brief §5.2), full 13 when showAll.
  if (options.showAll) {
    return [...therapistTiles, ...coordinatorTiles];
  }
  return [
    therapistTiles[0], // Completed sessions
    therapistTiles[1], // Hours worked
    therapistTiles[2], // Revenue attributed
    therapistTiles[3], // Personal utilisation (ring)
    coordinatorTiles[0], // Enquiries handled
    coordinatorTiles[1], // Conversion rate
  ];
}

// ── Therapist tile set (8) ───────────────────────────────────────────────────

function buildTherapistTiles(
  scorecard: StaffScorecard,
  options: TilesForRoleOptions
): TileSpec[] {
  const { clinical, deltas } = scorecard;
  const hrefBookings = options.staffId
    ? `/admin/bookings?view=completed&staffId=${options.staffId}${options.range ? `&range=${options.range}` : ""}`
    : undefined;
  const hrefRevenue = options.staffId
    ? `/admin/reports?scope=personal&staffId=${options.staffId}${options.range ? `&range=${options.range}` : ""}`
    : undefined;
  const utilPct = roundPercent(clinical.utilisation.rate * 100);
  return [
    {
      kind: "kpi",
      id: "completed-sessions",
      label: "Completed sessions",
      value: clinical.assignmentsCompleted,
      delta: nzDelta(deltas?.clinical.assignmentsCompleted),
      series: options.series?.assignmentsCompleted,
      href: hrefBookings,
    },
    {
      kind: "kpi",
      id: "hours-worked",
      label: "Hours worked",
      value: roundHours(clinical.hoursWorked),
      delta: nzDelta(deltas?.clinical.hoursWorked),
      series: options.series?.hoursWorked,
      formatKey: "hours",
    },
    {
      kind: "kpi",
      id: "revenue-attributed",
      label: "Revenue attributed",
      value: Math.round(clinical.revenueAttributed),
      delta: nzDelta(deltas?.clinical.revenueAttributed),
      series: options.series?.revenueAttributed,
      formatKey: "money",
      href: hrefRevenue,
    },
    {
      kind: "ring",
      id: "utilisation",
      label: "Personal utilisation",
      value: utilPct,
      target: 80,
      unit: "%",
      hint:
        clinical.utilisation.availableHours > 0
          ? `${roundHours(clinical.utilisation.bookedHours)}h of ${roundHours(clinical.utilisation.availableHours)}h available`
          : "Set your availability to see this",
    },
    {
      kind: "kpi",
      id: "retention",
      label: "Personal retention",
      value: roundPercent(clinical.retention.rate * 100),
      delta: percentPointDelta(deltas?.clinical.retentionRate),
      formatKey: "percent",
      hint:
        clinical.retention.totalClients > 0
          ? `${clinical.retention.retainedClients} of ${clinical.retention.totalClients} clients returned`
          : "Building your base",
    },
    {
      kind: "kpi",
      id: "no-show-rate",
      label: "No-show rate",
      value: roundPercent(clinical.noShowRate.rate * 100),
      delta: percentPointDelta(deltas?.clinical.noShowRate),
      formatKey: "percent",
      tone: "invert",
      hint: `${clinical.noShowRate.noShows + clinical.noShowRate.cancelled} of ${clinical.noShowRate.total} bookings`,
    },
    {
      kind: "kpi",
      id: "clients-touched",
      label: "Clients touched",
      value: clinical.clientsTouched,
      delta: nzDelta(deltas?.clinical.clientsTouched),
      series: options.series?.clientsTouched,
    },
    {
      kind: "kpi",
      id: "same-gender-fulfilled",
      label: "Same-gender fulfilled",
      value: clinical.sameGenderFulfilled,
      hint: "requested + delivered",
    },
  ];
}

// ── Coordinator tile set (5) ─────────────────────────────────────────────────

function buildCoordinatorTiles(
  scorecard: StaffScorecard,
  options: TilesForRoleOptions
): TileSpec[] {
  const { admin, deltas } = scorecard;
  const hrefEnquiries = options.staffId ? `/admin/enquiries?actor=${options.staffId}` : "/admin/enquiries";
  return [
    {
      kind: "kpi",
      id: "enquiries-handled",
      label: "Enquiries handled",
      value: admin.enquiriesContactedCount,
      delta: nzDelta(deltas?.admin.enquiriesContactedCount),
      series: options.series?.enquiriesContactedCount,
      href: hrefEnquiries,
    },
    {
      kind: "kpi",
      id: "conversion-rate",
      label: "Conversion rate",
      value: roundPercent(admin.enquiryConversionRate * 100),
      delta: percentPointDelta(deltas?.admin.enquiryConversionRate),
      formatKey: "percent",
      hint:
        admin.enquiriesContactedCount > 0
          ? `${Math.round(admin.enquiryConversionRate * admin.enquiriesContactedCount)} of ${admin.enquiriesContactedCount} enquiries became bookings`
          : "No enquiries handled this period",
    },
    {
      kind: "kpi",
      id: "avg-time-to-first-contact",
      label: "Avg time-to-first-contact",
      value: Math.round(admin.avgMinutesToFirstContact),
      delta: admin.avgMinutesToFirstContact > 0 ? nzDelta(Math.round(deltas?.admin.avgMinutesToFirstContact ?? 0)) : null,
      formatKey: "minutes",
      tone: "invert",
      hint: `across ${admin.enquiriesContactedCount} enquiries`,
    },
    {
      kind: "kpi",
      id: "bookings-assigned",
      label: "Bookings assigned",
      value: admin.bookingsAssignedCount,
      delta: nzDelta(deltas?.admin.bookingsAssignedCount),
      series: options.series?.bookingsAssignedCount,
    },
    {
      kind: "kpi",
      id: "ops-events-resolved",
      label: "Operational events resolved",
      value: admin.opsEventsResolvedCount,
      delta: nzDelta(deltas?.admin.opsEventsResolvedCount),
    },
  ];
}

// ── humanizeAuditAction ──────────────────────────────────────────────────────
// Thin wrapper around the existing /admin/audit `describeAction` helper.
// Self-view: "You completed booking" / Manager-view: "completed booking"
// (actor name rendered separately by the caller). Mirrors RECON §6.2's
// 8-family taxonomy.

export function humanizeAuditAction(actionType: string, mode: "self" | "manager"): string {
  const phrase = describeAction(actionType).phrase;
  if (mode === "self") {
    return `You ${phrase}`;
  }
  return phrase;
}

// ── iconForActionType ────────────────────────────────────────────────────────
// Returns the Lucide icon component for the action's family. Bundled
// per-icon (tree-shaken). Returning the component (not an icon name string)
// keeps the consumer ergonomic.

const ICON_BY_FAMILY: Record<ActionFamily, LucideIcon> = {
  bookings_and_assignments: Calendar,
  clients_and_enquiries: MessageCircle,
  staff_and_roles: Users,
  services_and_settings: Settings,
  availability: Clock,
  operations_and_email: AlertCircle,
  reports_and_exports: BarChart3,
  account_security: Lock,
};

export function iconForActionType(actionType: string): LucideIcon {
  return ICON_BY_FAMILY[describeAction(actionType).family];
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function roundPercent(n: number): number {
  return Math.round(n);
}

function roundHours(n: number): number {
  return Math.round(n * 10) / 10;
}

// retentionRate / noShowRate deltas are stored as raw differences in
// 0–1 space (clinical.retentionRate - priorClinical.retentionRate). When
// surfaced on a percent-formatted tile they read more naturally as
// percentage-point deltas (e.g. "+5pp" instead of "+0.05").
function percentPointDelta(rawDiff: number | undefined): number | null {
  if (rawDiff == null) return null;
  const rounded = Math.round(rawDiff * 100);
  // Hide zero deltas so KpiTile / TrendTile don't show a "→ 0.0%" pill —
  // user-found regression from B-5 mobile review (2026-05-25).
  if (rounded === 0) return null;
  return rounded;
}

/**
 * Coerce a raw count/value delta to null when it's zero. Used at every
 * `delta:` assignment site so an "unchanged" reading doesn't render a
 * "→ 0.0%" pill. Pass-through for non-zero numbers and null/undefined.
 */
function nzDelta(raw: number | null | undefined): number | null {
  if (raw == null || raw === 0) return null;
  return raw;
}
