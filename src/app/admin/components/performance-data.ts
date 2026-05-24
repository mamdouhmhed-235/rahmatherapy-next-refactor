// B-3 — page-scoped data helpers for the Performance surface.
// Per AUDIT G1: kept out of reporting.ts because these are derived-data
// fetchers specific to this surface, not shared infra. Sentry-span-wrapped
// per SHARED-NOTES §12.

import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBusinessDate } from "@/lib/time/london";
import type { ReportData } from "@/app/admin/reports/reporting";
import type { PerformanceShell } from "./performance-helpers";
import type { UpcomingWorkItem, TrendChartInput } from "./PerformanceSurface";

// Re-export for consumer ergonomics — pages typically import the fetcher
// alongside its return type from this single module.
export type { UpcomingWorkItem, TrendChartInput } from "./PerformanceSurface";
export type { PerformanceShell } from "./performance-helpers";

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
