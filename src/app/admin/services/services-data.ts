// SERVER ONLY — cached data helper for /admin/services (C-16 Phase E Step
// 14, finding N2 — Owner-approved extension, per-page-progress §1 row 3 /
// §2).
//
// VERDICT — restructure, not a pager: this page renders 5-30 services
// (static, brief §1.1's own bucket). There is nothing to paginate. The
// defect was the per-service "in use" usage count, which read EVERY row of
// `booking_items` (no filter, no limit) on every render to build a `Map` via
// in-memory reduce in page.tsx — `booking_items` scales with bookings
// (10-15k projected over 5 years per the brief's own table), so a static
// ≤30-row page was silently full-table-scanning a fast-growing table on
// every load.
//
// FIX SHAPE — same as `getClientBookingSummaries` in clients-list-data.ts
// (C-16 Phase C Step 8): the read stays a ONE-column projection
// (`service_id`, already narrow — no joins, no other columns) but the
// reduction to per-service counts now happens INSIDE a cached fetcher, so
// what crosses the cache boundary and lives in page memory is
// O(services), not O(booking_items).
//
// RESIDUAL, STATED PLAINLY, same as clients: this cannot become a grouped
// count() query. PostgREST aggregate functions are disabled on this project
// (`{"code":"PGRST123","message":"Use of aggregate functions is not
// allowed"}` — confirmed independently by two agents during Phase C Step 8)
// and there is no view/RPC/derived column available; adding one is a
// migration/config change, i.e. Zone-2, correctly not taken here. The query
// still scans `booking_items` server-side — only the shape crossing into
// page memory and the render is bounded.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is a plain
// `Record<string, number>`, not a `Map` — a Map would re-hydrate as `{}`
// across the `unstable_cache` boundary. No Set/Map/Date crosses it.
//
// Tag: TAGS.BOOKINGS — `booking_items` rows are written exclusively via
// bookings/actions.ts, which already calls `updateTag(TAGS.BOOKINGS)` on
// every mutation; no change to actions.ts is needed for this cache to
// invalidate.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";

export type ServiceUsageCounts = Record<string, number>;

interface UsageRow {
  service_id: string;
}

/** The ONE reducer — pure, testable without the cache boundary. */
export function summariseServiceUsage(rows: readonly UsageRow[]): ServiceUsageCounts {
  const counts: ServiceUsageCounts = {};
  for (const row of rows) {
    counts[row.service_id] = (counts[row.service_id] ?? 0) + 1;
  }
  return counts;
}

/**
 * One usage count per service, reduced from `booking_items` inside the
 * cached fetcher. See file header — the projection is narrow (one column),
 * the reduction happens before the boundary, so only O(services) numbers
 * cross it and reach page memory.
 */
export async function getServiceUsageCounts(): Promise<ServiceUsageCounts> {
  const cached = unstable_cache(
    async (): Promise<ServiceUsageCounts> => {
      const { data } = await createSupabaseAdminClient()
        .from("booking_items")
        .select("service_id")
        .returns<UsageRow[]>();
      return summariseServiceUsage(data ?? []);
    },
    ["services-usage-counts"],
    { revalidate: 60, tags: [TAGS.BOOKINGS] }
  );
  return cached();
}
