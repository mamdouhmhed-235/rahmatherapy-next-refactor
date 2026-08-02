// B-3 — page-scoped data helpers for the Performance surface.
// Per AUDIT G1: kept out of reporting.ts because these are derived-data
// fetchers specific to this surface, not shared infra. Sentry-span-wrapped
// per SHARED-NOTES §12.

import { cache } from "react";
import { unstable_cache } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBusinessDate } from "@/lib/time/london";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import type { StaffProfile } from "@/lib/auth/rbac";
import {
  getReportData,
  getAuditLogForStaff,
  type ReportData,
  type ReportFilters,
  type AuditEventRow,
} from "@/app/admin/reports/reporting";
import type { PerformanceShell } from "./performance-helpers";
import type { UpcomingWorkItem, TrendChartInput } from "./PerformanceSurface";

// Re-export for consumer ergonomics — pages typically import the fetcher
// alongside its return type from this single module.
export type { UpcomingWorkItem, TrendChartInput } from "./PerformanceSurface";
export type { PerformanceShell } from "./performance-helpers";

// ── Per-render-deduped fetchers (B-3 follow-up) ──────────────────────────────
// Per-section Suspense (plan step 5.5) requires each section to fetch its
// own data so it can stream independently. Without dedup, that would multiply
// queries (KpiTiles + TrendChart both want ReportData → 2 queries; KpiTiles +
// ActivityTimeline both want auditLog → 2 queries). React `cache()` (per-render
// dedup) collapses parallel awaits with identical args into a single in-flight
// promise — keeping the ≤4 query budget intact (SHARED-NOTES §11).
//
// Note on argument identity: cache() deduplicates by referential equality.
// The route page resolves `profile` + `filters` once and passes the SAME
// references down to PerformanceSurface, which threads them through Suspense
// children unchanged. So both KpiTilesSection and TrendChartSection see the
// same object references — dedup fires.

/**
 * `getReportData` + B-2's `unstable_cache` wrap (60s revalidate, 'report-data'
 * tag) + Sentry slow-query span + per-render React `cache()` dedup.
 * Used by KpiTilesSection (current + prior) and TrendChartSection (current).
 */
export const fetchCachedReportData = cache(
  async (
    profile: StaffProfile,
    filters: ReportFilters,
    purpose: "current" | "prior" = "current"
  ): Promise<ReportData> => {
    const adminClient = createSupabaseAdminClient();
    const cachedFetcher = unstable_cache(
      () =>
        Sentry.startSpan(
          {
            name: "getReportData",
            op: "db.query",
            attributes: {
              profile_id: profile.id,
              range: filters.range,
              purpose,
            },
          },
          async () => getReportData(adminClient, profile, filters)
        ),
      ["report-data", profile.id, JSON.stringify(filters)],
      // C-09 Step 4: resource tags ADDED alongside the existing output-driven
      // 'report-data' tag (cache key untouched). getReportData reads bookings +
      // staff + audit_logs, so a mutation to any of those now invalidates the
      // performance surface directly rather than waiting out the 60s window.
      {
        revalidate: 60,
        tags: ["report-data", TAGS.STAFF, TAGS.BOOKINGS, TAGS.AUDIT],
      }
    );
    return cachedFetcher();
  }
);

/**
 * Per-render-deduped audit-log fetch. NO `unstable_cache` wrap on this one —
 * brief §5.4 wants the activity timeline to be fresh-on-reload. React `cache()`
 * provides per-render dedup only (no cross-render persistence) so the timeline
 * still reads the latest audit_logs on every page load. Used by KpiTilesSection
 * (for scorecard.admin computation across current + prior periods, needs the
 * full 100 rows) and ActivityTimelineSection (slices first 20).
 */
export const fetchAuditLogForStaff = cache(
  async (staffId: string, limit: number = 100): Promise<AuditEventRow[]> => {
    const adminClient = createSupabaseAdminClient();
    return getAuditLogForStaff(adminClient, staffId, limit);
  }
);

// Row shapes returned by the nested-select query. Narrow what the consumer
// can use without pulling in the wider booking shape.

interface UpcomingBookingRow {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  clients: { full_name: string | null } | null;
  booking_items: Array<{ service_name_snapshot: string | null }> | null;
}

interface UpcomingEnquiryRow {
  id: string;
  full_name: string | null;
  source: string | null;
  created_at: string;
}

// ── getUpcomingWorkForStaff ──────────────────────────────────────────────────
// For Therapist: next N booking assignments scoped to this staff, on or after
// today, in active statuses ('pending', 'confirmed'). Ordered earliest-first.
// For Coordinator: enquiries currently in 'contacted' status (cross-coord;
// schema has no last_touched_by). Ordered most-recent-first.
// For Owner/Admin (owner_admin shell): returns [] — these roles don't have
// a "my upcoming work" panel per brief §5.5.

export async function getUpcomingWorkForStaff(
  adminClient: SupabaseClient,
  staffId: string,
  shell: PerformanceShell,
  limit = 5
): Promise<UpcomingWorkItem[]> {
  if (shell === "owner_admin") return [];

  return Sentry.startSpan(
    {
      name: "getUpcomingWorkForStaff",
      op: "db.query",
      attributes: { staff_id: staffId, shell, limit },
    },
    async () => {
      if (shell === "therapist") {
        const today = getBusinessDate();
        const { data, error } = await adminClient
          .from("bookings")
          .select(
            "id, booking_date, start_time, end_time, clients(full_name), booking_items(service_name_snapshot), booking_assignments!inner(assigned_staff_id, status)"
          )
          .eq("booking_assignments.assigned_staff_id", staffId)
          .gte("booking_date", today)
          .in("status", ["pending", "confirmed"])
          .order("booking_date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(limit)
          .returns<UpcomingBookingRow[]>();
        if (error || !data) return [];
        return data.map((row) => ({
          kind: "assignment" as const,
          data: {
            bookingId: row.id,
            bookingDate: row.booking_date,
            startTime: row.start_time,
            endTime: row.end_time,
            clientName: row.clients?.full_name ?? null,
            serviceLabel:
              row.booking_items?.find((it) => it.service_name_snapshot)?.service_name_snapshot ??
              null,
          },
        }));
      }

      // Coordinator
      const { data, error } = await adminClient
        .from("enquiries")
        .select("id, full_name, source, created_at")
        .eq("status", "contacted")
        .order("created_at", { ascending: false })
        .limit(limit)
        .returns<UpcomingEnquiryRow[]>();
      if (error || !data) return [];
      return data.map((row) => ({
        kind: "enquiry" as const,
        data: {
          enquiryId: row.id,
          name: row.full_name ?? "Unnamed enquiry",
          source: row.source ?? "unknown",
          createdAt: row.created_at,
        },
      }));
    }
  );
}

// ── buildPerformanceTrend ────────────────────────────────────────────────────
// Pure CPU helper over already-fetched ReportData. Partitions the report
// window into ISO-week buckets (Monday-anchored) and counts the dimension
// appropriate to the shell:
//   - therapist:    completed bookings assigned to staffId per week
//   - coordinator:  enquiries with first_contacted_at in the bucket
//   - owner_admin:  both lines (stacked area would also work; LineChart for
//                   visual consistency with the per-shell single-line variant)

export function buildPerformanceTrend(
  data: ReportData,
  staffId: string,
  shell: PerformanceShell
): TrendChartInput {
  const buckets = makeWeeklyBuckets(data.filters.from, data.filters.to);
  const labelKey = "week";

  const sessionsByBucket = new Map<string, number>();
  const enquiriesByBucket = new Map<string, number>();

  if (shell !== "coordinator") {
    const bookingById = new Map(data.bookings.map((b) => [b.id, b]));
    for (const assignment of data.assignments) {
      if (assignment.assigned_staff_id !== staffId) continue;
      if (assignment.status !== "completed") continue;
      const booking = bookingById.get(assignment.booking_id);
      if (!booking) continue;
      const bucketKey = findBucketKey(booking.booking_date, buckets);
      if (!bucketKey) continue;
      sessionsByBucket.set(bucketKey, (sessionsByBucket.get(bucketKey) ?? 0) + 1);
    }
  }

  if (shell !== "therapist") {
    for (const enquiry of data.enquiries) {
      if (!enquiry.first_contacted_at) continue;
      const dateOnly = enquiry.first_contacted_at.slice(0, 10);
      const bucketKey = findBucketKey(dateOnly, buckets);
      if (!bucketKey) continue;
      enquiriesByBucket.set(bucketKey, (enquiriesByBucket.get(bucketKey) ?? 0) + 1);
    }
  }

  const rows = buckets.map((bucket) => {
    const row: Record<string, unknown> = { [labelKey]: bucket.label };
    if (shell !== "coordinator") row.sessions = sessionsByBucket.get(bucket.key) ?? 0;
    if (shell !== "therapist") row.enquiries = enquiriesByBucket.get(bucket.key) ?? 0;
    return row;
  });

  const lines: TrendChartInput["lines"] = [];
  if (shell !== "coordinator") {
    lines.push({ dataKey: "sessions", label: "Sessions completed" });
  }
  if (shell !== "therapist") {
    lines.push({ dataKey: "enquiries", label: "Enquiries handled" });
  }

  return { data: rows, categoryKey: labelKey, lines };
}

interface WeekBucket {
  key: string;   // ISO date of the Monday
  label: string; // short "DD MMM" label for the chart axis
  start: string; // YYYY-MM-DD inclusive
  end: string;   // YYYY-MM-DD inclusive
}

function makeWeeklyBuckets(fromYmd: string, toYmd: string): WeekBucket[] {
  const fromDate = new Date(`${fromYmd}T00:00:00Z`);
  const toDate = new Date(`${toYmd}T00:00:00Z`);
  // Anchor to the Monday of the from-week (Monday is day 1; UTC Sunday=0).
  const fromDay = fromDate.getUTCDay();
  const offsetToMonday = (fromDay + 6) % 7; // 0=Mon → 0, 1=Tue → 1, ..., 0=Sun → 6
  const anchor = new Date(fromDate);
  anchor.setUTCDate(anchor.getUTCDate() - offsetToMonday);

  const labelFmt = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/London",
  });

  const buckets: WeekBucket[] = [];
  const cursor = new Date(anchor);
  while (cursor <= toDate) {
    const start = cursor.toISOString().slice(0, 10);
    const endDate = new Date(cursor);
    endDate.setUTCDate(endDate.getUTCDate() + 6);
    const end = endDate.toISOString().slice(0, 10);
    buckets.push({
      key: start,
      label: labelFmt.format(cursor),
      start,
      end,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return buckets;
}

function findBucketKey(dateYmd: string, buckets: WeekBucket[]): string | null {
  for (const bucket of buckets) {
    if (dateYmd >= bucket.start && dateYmd <= bucket.end) return bucket.key;
  }
  return null;
}
