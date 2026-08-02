// B-4 — page-scoped data helpers for the Reports rebuild.
//
// Mirrors the B-3 performance-data.ts pattern: React `cache()` (per-render
// dedup) wraps `unstable_cache` (cross-render persistence) wraps the actual
// fetch (Sentry-spanned). Identical-argument awaits across sibling Suspense
// children collapse to a single in-flight promise — preserves the ≤8 query
// budget per render (SHARED-IMPLEMENTATION-NOTES §11).
//
// Cross-render cache invalidation: every mutation site (B-2 wired ~58 of
// them) calls `updateTag('report-data')`; on the next render the cache key
// re-fetches once and serves cached on all subsequent reads within 60s.
//
// Cache-hit safety: every value returned from these fetchers must be JSON-
// serializable (no Sets/Maps/Dates) because the unstable_cache wrap
// round-trips through JSON. The B-2 cache-Set regression (commit d556278)
// is the canonical lesson; we audit any return shape against
// SHARED-IMPLEMENTATION-NOTES §15 before introducing a new field.
//   - `fetchCachedReportData` / `fetchPriorReportData` — return ReportData
//     which is now JSON-safe (staffAvailabilityRuleStaffIds is string[]).
//   - `fetchDismissedInsightIds` — returns string[] (NOT Set<string>) so
//     the cache layer survives serialization; consumer wraps to Set at use.
//   - `fetchReportInsights` — returns ReportInsight[]; pure shape, safe.
//
// Plan: redesign/plans/B-phase/B4-reports-rebuild-plan.md (step 7).

import { cache } from "react";
import { unstable_cache } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import type { StaffProfile } from "@/lib/auth/rbac";
import {
  buildPriorPeriodFilters,
  getReportData,
  type ReportData,
  type ReportFilters,
} from "./reporting";
import { getReportInsights, type ReportInsight } from "./report-insights";

/**
 * Current-period ReportData. React-cached per render (dedupes parallel
 * Suspense-child awaits) and Next-cached per 60s with 'report-data' tag.
 * Sentry span tagged with profile + range + purpose for slow-query triage.
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
      // 'report-data' tag (cache key untouched). ReportData is assembled from
      // bookings + clients + staff reads.
      {
        revalidate: 60,
        tags: ["report-data", TAGS.BOOKINGS, TAGS.CLIENTS, TAGS.STAFF],
      }
    );
    return cachedFetcher();
  }
);

/**
 * Prior-period ReportData (for delta + insights). Returns null for
 * range='lifetime' (no comparable prior period — buildPriorPeriodFilters
 * returns null and DeltaChip hides on the consumer side).
 */
export const fetchPriorReportData = cache(
  async (profile: StaffProfile, filters: ReportFilters): Promise<ReportData | null> => {
    const priorFilters = buildPriorPeriodFilters(filters);
    if (!priorFilters) return null;
    return fetchCachedReportData(profile, priorFilters, "prior");
  }
);

/**
 * Per-staff list of dismissed insight ids. NOT `unstable_cache`-wrapped (the
 * dismiss action mutates this directly and we want read-your-own-writes on
 * the next render); just React `cache()` for per-render dedup so the
 * Insights stripe + any other consumer share a single SELECT.
 *
 * Returns string[] (not Set<string>) per SHARED-NOTES §15 — even though
 * this isn't wrapped in `unstable_cache` today, keeping the API JSON-safe
 * means a future cache wrap won't degrade the value silently.
 */
export const fetchDismissedInsightIds = cache(
  async (staffId: string): Promise<string[]> => {
    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient
      .from("insight_dismissals")
      .select("insight_id")
      .eq("staff_id", staffId);
    if (error) {
      Sentry.captureException(error, { tags: { feature: "band-b-4", surface: "/admin/reports" } });
      return [];
    }
    return (data ?? []).map((row) => row.insight_id as string);
  }
);

/**
 * Composed insights: pulls current + prior ReportData + dismissals in
 * parallel, runs the pure `getReportInsights` over the result, and returns
 * the ≤3 ranked observations. Sibling Suspense children also calling
 * `fetchCachedReportData` / `fetchPriorReportData` reuse the in-flight
 * promises via React `cache()` — no duplicate DB hit.
 */
export const fetchReportInsights = cache(
  async (profile: StaffProfile, filters: ReportFilters): Promise<ReportInsight[]> => {
    const [data, priorData, dismissedIds] = await Promise.all([
      fetchCachedReportData(profile, filters),
      fetchPriorReportData(profile, filters),
      fetchDismissedInsightIds(profile.id),
    ]);
    return getReportInsights(data, priorData, new Set(dismissedIds));
  }
);
