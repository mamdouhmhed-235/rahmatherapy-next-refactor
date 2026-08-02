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
// FILTERS: still fetched unfiltered, as before. Wiring the URL filters into
// this query is C-09 Phase D Step 10; this step only moves WHERE the fetch
// happens, never WHAT it returns.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";
import type { OperationalEventRow } from "./event-row";

export const OPERATIONS_DEFAULT_LIMIT = 300;

const OPERATIONS_SELECT =
  "id, event_type, severity, status, summary, safe_context, booking_id, staff_id, created_at";

export interface OperationsParams {
  limit?: number;
  offset?: number;
}

export interface OperationsPageData {
  events: OperationalEventRow[];
  hasError: boolean;
}

export async function getOperationsPageData(
  params: OperationsParams = {}
): Promise<OperationsPageData> {
  const limit = params.limit ?? OPERATIONS_DEFAULT_LIMIT;
  const offset = params.offset ?? 0;

  const cached = unstable_cache(
    async (): Promise<OperationsPageData> => {
      const adminClient = createSupabaseAdminClient();
      const { data, error } = await adminClient
        .from("operational_events")
        .select(OPERATIONS_SELECT)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)
        .returns<OperationalEventRow[]>();

      return { events: data ?? [], hasError: Boolean(error) };
    },
    ["operations-page", cacheKeyPart({ limit, offset })],
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
