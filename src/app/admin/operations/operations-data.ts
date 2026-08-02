// SERVER ONLY — cached data helper for /admin/operations (C-09 Phase C Step 5).
//
// Access (getAdminPageAccess(profile, "operations")) is enforced upstream in
// page.tsx; the read runs on the admin client, exactly as it did inline.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is JSON-safe.
//  - `events` are OperationalEventRow[] — scalars plus `safe_context`, a plain
//    JSON object.
//  - TRANSFORM APPLIED: the Supabase `error` object is reduced to the boolean
//    `hasError` before it crosses the cache boundary. page.tsx only ever tested
//    it for truthiness to pick the error panel, so the rendered output is
//    unchanged, and a boolean cannot degrade on re-hydration.
// No Set / Map / Date crosses the boundary.
//
// Tags per the plan's Step 5 table: audit, bookings, settings.
//
// PAGINATION-READY (C-16): `limit` + `offset` are optional params that flow
// into BOTH the query and the cache key, so page 2 can never be served page
// 1's rows. `limit` defaults to OPERATIONS_DEFAULT_LIMIT (300), the ceiling the
// page already used, so behaviour is unchanged until C-16 passes a page size.
// `countOperationalEvents` is the cheap head-count companion for C-16's
// "Showing X–Y of Z" readout — it is not called by the page today.
//
// FILTERS (C-09 Phase D Step 10): severity/eventType/status/date-range/q are
// now real `.eq`/`.gte`/`.lte`/`.ilike` predicates, applied here and folded
// into the cache key — a caller filtering to severity=error can never be
// served a cache entry built for severity=warning. page.tsx calls this
// fetcher twice when any filter is active: once unfiltered (for the open-
// errors/warnings/infos stat tiles and the event-type dropdown, which must
// keep reflecting the WHOLE queue, not the current filter) and once with the
// filters (for the board). The two calls share a cache entry in the common
// no-filter case, so the default view still costs exactly one query.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";
import type { OperationalEventRow } from "./event-row";

export const OPERATIONS_DEFAULT_LIMIT = 300;

const OPERATIONS_SELECT =
  "id, event_type, severity, status, summary, safe_context, booking_id, staff_id, created_at";

export interface OperationsFilters {
  severity?: "info" | "warning" | "error";
  eventType?: string;
  status?: "open" | "acknowledged" | "resolved";
  /** Inclusive UTC day bounds, `YYYY-MM-DD`. */
  fromDate?: string;
  toDate?: string;
  /** Matched against `summary`. */
  q?: string;
}

export interface OperationsParams extends OperationsFilters {
  limit?: number;
  offset?: number;
}

export interface OperationsPageData {
  events: OperationalEventRow[];
  hasError: boolean;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_,()]/g, (match) => `\\${match}`);
}

export async function getOperationsPageData(
  params: OperationsParams = {}
): Promise<OperationsPageData> {
  const limit = params.limit ?? OPERATIONS_DEFAULT_LIMIT;
  const offset = params.offset ?? 0;
  const { severity, eventType, status, fromDate, toDate, q } = params;

  const cached = unstable_cache(
    async (): Promise<OperationsPageData> => {
      const adminClient = createSupabaseAdminClient();
      let query = adminClient
        .from("operational_events")
        .select(OPERATIONS_SELECT)
        .order("created_at", { ascending: false });
      if (severity) query = query.eq("severity", severity);
      if (eventType) query = query.eq("event_type", eventType);
      if (status) query = query.eq("status", status);
      if (fromDate) query = query.gte("created_at", `${fromDate}T00:00:00Z`);
      if (toDate) query = query.lte("created_at", `${toDate}T23:59:59Z`);
      if (q) query = query.ilike("summary", `%${escapeLike(q)}%`);
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query.returns<OperationalEventRow[]>();

      return { events: data ?? [], hasError: Boolean(error) };
    },
    [
      "operations-page",
      cacheKeyPart({ limit, offset, severity, eventType, status, fromDate, toDate, q }),
    ],
    { revalidate: 60, tags: [TAGS.AUDIT, TAGS.BOOKINGS, TAGS.SETTINGS] }
  );
  return cached();
}

/**
 * Cheap head-count companion for C-16's "Showing X–Y of Z" readout. Head
 * request — no rows transferred. Not used by the page yet.
 */
export async function countOperationalEvents(): Promise<number> {
  const cached = unstable_cache(
    async (): Promise<number> => {
      const adminClient = createSupabaseAdminClient();
      const { count, error } = await adminClient
        .from("operational_events")
        .select("id", { count: "exact", head: true });
      if (error) return 0;
      return count ?? 0;
    },
    ["operations-count"],
    { revalidate: 60, tags: [TAGS.AUDIT, TAGS.BOOKINGS, TAGS.SETTINGS] }
  );
  return cached();
}
