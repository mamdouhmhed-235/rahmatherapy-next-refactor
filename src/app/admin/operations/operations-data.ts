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
// PAGER (C-16 Phase D Step 11): `limit` + `offset` flow into BOTH the query
// and the cache key, so page 2 can never be served page 1's rows. `limit`
// defaults to OPERATIONS_DEFAULT_LIMIT (300) for callers that don't pass one
// (page.tsx's separate unfiltered stat-tile/dropdown fetch below still uses
// this bare default, unchanged) — `getOperationsEventsPage` is the entry
// point that passes `limit: LOG_PAGE_SIZE` (100) explicitly for the board's
// windowed page. `getOperationsPageData` and `countOperationalEvents` both
// build their WHERE clause through the SAME `applyOperationsPredicates`
// helper, so the pager's total can never describe a different query than the
// rows it's paginating (same discipline as `applyBookingPredicates` /
// `applyDeliveryPredicates` / `applyPrivacyRequestFilters`).
//
// FILTERS (C-09 Phase D Step 10): severity/eventType/status/date-range/q are
// real `.eq`/`.gte`/`.lte`/`.ilike` predicates, applied here and folded into
// the cache key — a caller filtering to severity=error can never be served a
// cache entry built for severity=warning. page.tsx calls
// `getOperationsPageData` (bare) once for the open-errors/warnings/infos stat
// tiles and the event-type dropdown, which must keep reflecting a WIDE
// (top-300) read regardless of the current filter/page — that call is
// unaffected by the pager, same top-N approximation `emails/page.tsx`'s
// badges document (C-16 Phase D Step 9's comment). `getOperationsEventsPage`
// is the separate, filtered + paged call that feeds the board.
//
// No `Date.now()` anywhere in this file (checked at C-16 Phase D Step 11):
// `fromDate`/`toDate` arrive as `YYYY-MM-DD` strings straight from the URL,
// never resolved from "now" inside the data layer, so this file does not
// have emails' Step 9 millisecond-cache-key defect (`resolveDeliveryDateBounds`
// reading `Date.now()` at ms precision) — there is no equivalent function
// here to fix.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";
import { LOG_PAGE_SIZE, clampPage, pageRange, type PaginatedResult } from "@/lib/pagination";
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

/** Structural minimum of a PostgREST filter builder — see the note on
 *  `applyOperationsPredicates` below for why `Q` stays unconstrained. */
interface OperationsFilterBuilder {
  eq(column: string, value: string): OperationsFilterBuilder;
  gte(column: string, value: string): OperationsFilterBuilder;
  lte(column: string, value: string): OperationsFilterBuilder;
  ilike(column: string, value: string): OperationsFilterBuilder;
}

/**
 * Applies severity/eventType/status/date-bounds/q to an `operational_events`
 * query builder. The ONLY place this WHERE clause is built —
 * `getOperationsPageData` (rows) and `countOperationalEvents` (total) both
 * call this with the same `filters`, so the pager's total cannot describe a
 * different query than the rows it's paginating (C-16 Phase D Step 11, same
 * discipline as `applyDeliveryPredicates` / `applyPrivacyRequestFilters`).
 *
 * `Q` is deliberately unconstrained — constraining it makes tsc compare
 * `OperationsFilterBuilder` against `PostgrestFilterBuilder`'s parsed-select
 * generics and give up (TS2589). `Q` flows straight back out, so callers keep
 * `.order()`/`.range()`/`.returns()` on the concrete builder.
 */
function applyOperationsPredicates<Q>(query: Q, filters: OperationsFilters | undefined): Q {
  let next = query as unknown as OperationsFilterBuilder;
  if (filters?.severity) next = next.eq("severity", filters.severity);
  if (filters?.eventType) next = next.eq("event_type", filters.eventType);
  if (filters?.status) next = next.eq("status", filters.status);
  if (filters?.fromDate) next = next.gte("created_at", `${filters.fromDate}T00:00:00Z`);
  if (filters?.toDate) next = next.lte("created_at", `${filters.toDate}T23:59:59Z`);
  if (filters?.q) next = next.ilike("summary", `%${escapeLike(filters.q)}%`);
  return next as unknown as Q;
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
      const query = applyOperationsPredicates(
        adminClient
          .from("operational_events")
          .select(OPERATIONS_SELECT)
          .order("created_at", { ascending: false }),
        params
      ).range(offset, offset + limit - 1);

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
 * request — no rows transferred. Takes the SAME `filters` as
 * `getOperationsPageData` and applies them through the SAME
 * `applyOperationsPredicates`, so the total this returns always describes
 * the rows query's WHERE clause — it can no longer describe the whole table
 * while the rows query describes a filtered severity=error view.
 */
export async function countOperationalEvents(filters?: OperationsFilters): Promise<number> {
  const cached = unstable_cache(
    async (): Promise<number> => {
      const adminClient = createSupabaseAdminClient();
      const query = applyOperationsPredicates(
        adminClient.from("operational_events").select("id", { count: "exact", head: true }),
        filters
      );
      const { count, error } = await query;
      if (error) return 0;
      return count ?? 0;
    },
    [
      "operations-count",
      cacheKeyPart({
        severity: filters?.severity,
        eventType: filters?.eventType,
        status: filters?.status,
        fromDate: filters?.fromDate,
        toDate: filters?.toDate,
        q: filters?.q,
      }),
    ],
    { revalidate: 60, tags: [TAGS.AUDIT, TAGS.BOOKINGS, TAGS.SETTINGS] }
  );
  return cached();
}

export type OperationsEventsPage = PaginatedResult<OperationalEventRow> & {
  hasError: boolean;
};

/**
 * The operations board's single entry point (C-16 Phase D Step 11) — mirrors
 * `getBookingsListPage` / `getEmailDeliveryPage` / `getPrivacyRequestsPage`.
 * Builds the total from `countOperationalEvents(filters)`, clamps `?page=`
 * against the REAL page count, then fetches exactly that window from
 * `getOperationsPageData`. Both calls resolve the SAME `filters` through the
 * SAME `applyOperationsPredicates`, so `total` always describes `rows`' WHERE
 * clause — the exact defect this step fixes (`countOperationalEvents` used
 * to take no filter arguments and count the whole table).
 */
export async function getOperationsEventsPage(params: {
  filters?: OperationsFilters;
  /** Raw `?page=` — parsed and clamped here, against the REAL page count. */
  page?: unknown;
  pageSize?: number;
}): Promise<OperationsEventsPage> {
  const { filters } = params;
  const pageSize = params.pageSize ?? LOG_PAGE_SIZE;

  // Sequential, not Promise.all — same reasoning as getBookingsListPage: a
  // stale `?page=99` can only be clamped once the total is known, and
  // fetching a window that then has to be discarded costs a whole row query.
  const total = await countOperationalEvents(filters);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = clampPage(params.page, pageCount);
  const { from } = pageRange(page, pageSize);

  const { events, hasError } = await getOperationsPageData({
    ...filters,
    limit: pageSize,
    offset: from,
  });

  return { rows: events, total, page, pageCount, hasError };
}
