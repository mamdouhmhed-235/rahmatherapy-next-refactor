// SERVER ONLY — cached data helper for /admin/privacy (C-09 Phase C Step 5).
//
// Permissions are resolved upstream in page.tsx and passed in as the three
// booleans that decide WHICH queries run; they are part of the cache key, so a
// caller without sensitive-note authority can never be served a cache entry
// built for one who has it.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is JSON-safe.
//  - `requests`, `notes`, `clients`, `staff` are plain row arrays of scalars.
//  - TRANSFORM APPLIED: the client and staff lookups are returned as ARRAYS,
//    not the `Map`s page.tsx builds from them — a Map re-hydrates as {}. The
//    Maps are rebuilt after the cache boundary.
//  - TRANSFORM APPLIED: the queue query's Supabase error is reduced to the
//    boolean `queueLoadFailed`, the only thing page.tsx derived from it.
//  - Every timestamp stays an ISO string; the page's `new Date(...)` age
//    arithmetic runs on this side of the boundary, on those strings.
// No Set / Map / Date crosses the boundary.
//
// Tags per the plan's Step 5 table: clients, audit.
//
// PAGER (C-16 Phase D Step 10): the request queue (`client_privacy_requests`)
// previously carried no bound at all — no `.limit()`, no `.range()`. `limit` +
// `offset` now bound it and flow into BOTH the query and the cache key, so
// page 2 can never be served page 1's rows. `getPrivacyPageData`'s
// `requestsQuery` and `countPrivacyRequests` both build their WHERE clause
// through the same `applyPrivacyRequestFilters` helper, so a caller can never
// get a total that describes a different query than the rows it's paginating
// (page.tsx passes both the SAME resolved `filters` object). The
// sensitive-notes rail is verdicted cap+view-all, not pagination (it's a side
// rail, not the primary list): `PRIVACY_NOTES_LIMIT` (25) stays the default,
// and `notesViewAll` raises it to `PRIVACY_NOTES_VIEW_ALL_CAP` — a defensive
// cap, not a truly unbounded read, matching the SCOPED_BRANCH_ROW_CAP /
// SEARCH_CLIENT_ID_CAP precedent in bookings-list-data.ts.
//
// FILTERS (C-09 Phase D Step 12): request_type/status/date-range/q are now
// real `.in`/`.gte`/`.lte`/`.ilike` predicates on the requests query, applied
// here and folded into the cache key — a caller filtering to status=open can
// never be served a cache entry built for status=completed.
//
// STATS (C-16 Phase D Step 10): the "Open requests" / "Awaiting longest" stat
// tiles used to be computed by reducing over an UNFILTERED call to this same
// fetcher with no bound at all — i.e. the exact unbounded read this step
// removes. They no longer read `getPrivacyPageData`'s output: "Open requests"
// is `countPrivacyRequests({ statuses: ["open", "reviewing"] })` and "oldest
// open" is `getOldestOpenPrivacyRequest()` below. Both are backlog-sized, not
// table-sized — a request stays "open" only until resolved, so these stay
// cheap however large the table's full five-year history grows. page.tsx now
// calls `getPrivacyPageData` exactly once per render, with whatever filters
// (if any) are active and the current page's `limit`/`offset`.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";
import { LIST_PAGE_SIZE, clampPage, pageRange } from "@/lib/pagination";

export const PRIVACY_NOTES_LIMIT = 25;
// C-16 Phase D Step 10 — cap+view-all verdict for the sensitive-notes rail
// (a side rail, not the primary list, so it doesn't get a pager). This is the
// "view all" cap: generous enough that a small clinic's sensitive-note
// backlog won't realistically hit it, but still a defensive bound rather than
// a truly unbounded read — same reasoning as bookings' SCOPED_BRANCH_ROW_CAP.
export const PRIVACY_NOTES_VIEW_ALL_CAP = 500;

export interface PrivacyRequestRecord {
  id: string;
  client_id: string;
  request_type: string;
  status: string;
  request_note: string | null;
  created_at: string;
  updated_at: string;
  created_by_staff_id: string | null;
}

export interface PrivacyClientSummary {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

export interface PrivacySensitiveNote {
  id: string;
  client_id: string;
  note: string;
  created_at: string;
  author_staff_id: string | null;
}

export interface PrivacyStaffName {
  id: string;
  full_name: string;
}

export interface PrivacyQueueFilters {
  requestTypes?: string[];
  statuses?: string[];
  /** Inclusive ISO bounds, resolved from the page's range preset. */
  fromDate?: string;
  toDate?: string;
  /** Matched against `request_note`. */
  q?: string;
}

export interface PrivacyPageParams {
  canManagePrivacyOperations: boolean;
  canViewSensitiveNotes: boolean;
  canViewContactDetails: boolean;
  limit?: number;
  offset?: number;
  filters?: PrivacyQueueFilters;
  /** C-16 Step 10 — cap+view-all toggle for the sensitive-notes rail. */
  notesViewAll?: boolean;
}

export interface PrivacyPageData {
  requests: PrivacyRequestRecord[];
  notes: PrivacySensitiveNote[];
  clients: PrivacyClientSummary[];
  staff: PrivacyStaffName[];
  queueLoadFailed: boolean;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_,()]/g, (match) => `\\${match}`);
}

/** Structural minimum of a PostgREST filter builder — see the note on
 *  `applyPrivacyRequestFilters` below for why `Q` stays unconstrained. */
interface PrivacyFilterBuilder {
  in(column: string, values: readonly string[]): PrivacyFilterBuilder;
  gte(column: string, value: string): PrivacyFilterBuilder;
  lte(column: string, value: string): PrivacyFilterBuilder;
  ilike(column: string, value: string): PrivacyFilterBuilder;
}

/**
 * Applies requestTypes/statuses/date-bounds/q to a `client_privacy_requests`
 * query builder. The ONLY place this WHERE clause is built —
 * `getPrivacyPageData` (rows) and `countPrivacyRequests` (total) both call
 * this with the same `filters`, so the pager's total cannot describe a
 * different query than the rows it's paginating (C-16 Phase D Step 10, same
 * discipline as `applyBookingPredicates` / `applyDeliveryPredicates`).
 *
 * `Q` is deliberately unconstrained — constraining it makes tsc compare
 * `PrivacyFilterBuilder` against `PostgrestFilterBuilder`'s parsed-select
 * generics and give up (TS2589). `Q` flows straight back out, so callers keep
 * `.order()`/`.range()`/`.returns()` on the concrete builder.
 */
function applyPrivacyRequestFilters<Q>(
  query: Q,
  filters: PrivacyQueueFilters | undefined
): Q {
  let next = query as unknown as PrivacyFilterBuilder;
  if (filters?.requestTypes?.length) {
    next = next.in("request_type", filters.requestTypes);
  }
  if (filters?.statuses?.length) {
    next = next.in("status", filters.statuses);
  }
  if (filters?.fromDate) next = next.gte("created_at", filters.fromDate);
  if (filters?.toDate) next = next.lte("created_at", filters.toDate);
  if (filters?.q) {
    next = next.ilike("request_note", `%${escapeLike(filters.q)}%`);
  }
  return next as unknown as Q;
}

export async function getPrivacyPageData(
  params: PrivacyPageParams
): Promise<PrivacyPageData> {
  const {
    canManagePrivacyOperations,
    canViewSensitiveNotes,
    canViewContactDetails,
    limit,
    offset,
    filters,
    notesViewAll,
  } = params;

  const cached = unstable_cache(
    async (): Promise<PrivacyPageData> => {
      const adminClient = createSupabaseAdminClient();

      let requestsQuery = applyPrivacyRequestFilters(
        adminClient
          .from("client_privacy_requests")
          .select(
            "id, client_id, request_type, status, request_note, created_at, updated_at, created_by_staff_id"
          )
          .order("created_at", { ascending: false }),
        filters
      );
      if (limit !== undefined) {
        const start = offset ?? 0;
        requestsQuery = requestsQuery.range(start, start + limit - 1);
      }

      const requestsResult = canManagePrivacyOperations
        ? await requestsQuery.returns<PrivacyRequestRecord[]>()
        : { data: [] as PrivacyRequestRecord[], error: null };

      const notesResult = canViewSensitiveNotes
        ? await adminClient
            .from("client_notes")
            .select("id, client_id, note, created_at, author_staff_id")
            .eq("is_sensitive", true)
            .order("created_at", { ascending: false })
            .limit(notesViewAll ? PRIVACY_NOTES_VIEW_ALL_CAP : PRIVACY_NOTES_LIMIT)
            .returns<PrivacySensitiveNote[]>()
        : { data: [] as PrivacySensitiveNote[], error: null };

      // Layer-3 error gate (brief §6): only meaningful for an operator who
      // depends on the queue. Reduced to a boolean before it crosses out.
      const queueLoadFailed =
        canManagePrivacyOperations &&
        "error" in requestsResult &&
        requestsResult.error != null;

      const requests = requestsResult.data ?? [];
      const notes = notesResult.data ?? [];

      const clientIds = Array.from(
        new Set([
          ...requests.map((request) => request.client_id),
          ...notes.map((note) => note.client_id),
        ])
      );
      const { data: clients } =
        clientIds.length > 0
          ? await adminClient
              .from("clients")
              .select(
                canViewContactDetails ? "id, full_name, email, phone" : "id, full_name"
              )
              .in("id", clientIds)
              .returns<PrivacyClientSummary[]>()
          : { data: [] as PrivacyClientSummary[] };

      const staffIds = Array.from(
        new Set(
          requests
            .map((request) => request.created_by_staff_id)
            .filter((id): id is string => Boolean(id))
        )
      );
      const { data: staffProfiles } =
        staffIds.length > 0
          ? await adminClient
              .from("staff_profiles")
              .select("id, full_name")
              .in("id", staffIds)
              .returns<PrivacyStaffName[]>()
          : { data: [] as PrivacyStaffName[] };

      return {
        requests,
        notes,
        clients: clients ?? [],
        staff: staffProfiles ?? [],
        queueLoadFailed,
      };
    },
    [
      "privacy-page",
      cacheKeyPart({
        canManagePrivacyOperations,
        canViewSensitiveNotes,
        canViewContactDetails,
        limit,
        offset,
        requestTypes: filters?.requestTypes,
        statuses: filters?.statuses,
        fromDate: filters?.fromDate,
        toDate: filters?.toDate,
        q: filters?.q,
        notesViewAll,
      }),
    ],
    { revalidate: 60, tags: [TAGS.CLIENTS, TAGS.AUDIT] }
  );
  return cached();
}

/**
 * Cheap head-count companion for C-16's "Showing X–Y of Z" readout. Head
 * request — no rows transferred. Takes the SAME `filters` as
 * `getPrivacyPageData` and applies them through the SAME
 * `applyPrivacyRequestFilters`, so the total this returns always describes
 * the rows query's WHERE clause.
 */
export async function countPrivacyRequests(
  filters?: PrivacyQueueFilters
): Promise<number> {
  const cached = unstable_cache(
    async (): Promise<number> => {
      const adminClient = createSupabaseAdminClient();
      const query = applyPrivacyRequestFilters(
        adminClient
          .from("client_privacy_requests")
          .select("id", { count: "exact", head: true }),
        filters
      );
      const { count, error } = await query;
      if (error) return 0;
      return count ?? 0;
    },
    [
      "privacy-requests-count",
      cacheKeyPart({
        requestTypes: filters?.requestTypes,
        statuses: filters?.statuses,
        fromDate: filters?.fromDate,
        toDate: filters?.toDate,
        q: filters?.q,
      }),
    ],
    { revalidate: 60, tags: [TAGS.CLIENTS, TAGS.AUDIT] }
  );
  return cached();
}

/**
 * Cheap head-count companion for the sensitive-notes rail (C-16 Phase D
 * Step 10 — "surface the total so a user knows notes are hidden"). No
 * filters: the rail has no filter UI of its own.
 */
export async function countSensitiveNotes(): Promise<number> {
  const cached = unstable_cache(
    async (): Promise<number> => {
      const adminClient = createSupabaseAdminClient();
      const { count, error } = await adminClient
        .from("client_notes")
        .select("id", { count: "exact", head: true })
        .eq("is_sensitive", true);
      if (error) return 0;
      return count ?? 0;
    },
    ["privacy-notes-count"],
    { revalidate: 60, tags: [TAGS.CLIENTS] }
  );
  return cached();
}

export interface PrivacyOldestOpenRequest {
  id: string;
  clientId: string;
  clientName: string | null;
  createdAt: string;
}

/**
 * The single oldest still-open (`open` | `reviewing`) privacy request, for
 * the "Awaiting longest" stat tile (C-16 Phase D Step 10). Previously this
 * and the "Open requests" count (see `countPrivacyRequests` above) were both
 * derived by reducing over an UNFILTERED, unbounded `getPrivacyPageData` call
 * — the exact "no bound at all" defect this step removes. A currently-open
 * request stays open only until it's resolved, so this stays a 1-row read
 * regardless of how large the table's full history grows over five years.
 */
export async function getOldestOpenPrivacyRequest(
  canManagePrivacyOperations: boolean
): Promise<PrivacyOldestOpenRequest | null> {
  if (!canManagePrivacyOperations) return null;

  const cached = unstable_cache(
    async (): Promise<PrivacyOldestOpenRequest | null> => {
      const adminClient = createSupabaseAdminClient();
      const { data } = await adminClient
        .from("client_privacy_requests")
        .select("id, client_id, created_at")
        .in("status", ["open", "reviewing"])
        .order("created_at", { ascending: true })
        .limit(1)
        .returns<{ id: string; client_id: string; created_at: string }[]>();
      const row = data?.[0];
      if (!row) return null;

      const { data: client } = await adminClient
        .from("clients")
        .select("full_name")
        .eq("id", row.client_id)
        .maybeSingle<{ full_name: string }>();

      return {
        id: row.id,
        clientId: row.client_id,
        clientName: client?.full_name ?? null,
        createdAt: row.created_at,
      };
    },
    ["privacy-oldest-open"],
    { revalidate: 60, tags: [TAGS.CLIENTS, TAGS.AUDIT] }
  );
  return cached();
}

export interface PrivacyRequestsPage {
  data: PrivacyPageData;
  total: number;
  page: number;
  pageCount: number;
}

/**
 * The privacy queue's single entry point (C-16 Phase D Step 10) — mirrors
 * `getBookingsListPage` / `getEmailDeliveryPage`. Builds the total from
 * `countPrivacyRequests(filters)`, clamps `?page=` against the REAL page
 * count, then fetches exactly that window from `getPrivacyPageData`. Both
 * calls receive the SAME `filters`, so `total` always describes the
 * `requests` it's paginating.
 */
export async function getPrivacyRequestsPage(params: {
  canManagePrivacyOperations: boolean;
  canViewSensitiveNotes: boolean;
  canViewContactDetails: boolean;
  filters?: PrivacyQueueFilters;
  notesViewAll?: boolean;
  /** Raw `?page=` — parsed and clamped here, against the REAL page count. */
  page?: unknown;
  pageSize?: number;
}): Promise<PrivacyRequestsPage> {
  const { canManagePrivacyOperations, filters } = params;
  const pageSize = params.pageSize ?? LIST_PAGE_SIZE;

  // Sequential, not Promise.all — same reasoning as getBookingsListPage: a
  // stale `?page=99` can only be clamped once the total is known.
  const total = canManagePrivacyOperations ? await countPrivacyRequests(filters) : 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = clampPage(params.page, pageCount);
  const { from } = pageRange(page, pageSize);

  const data = await getPrivacyPageData({
    canManagePrivacyOperations: params.canManagePrivacyOperations,
    canViewSensitiveNotes: params.canViewSensitiveNotes,
    canViewContactDetails: params.canViewContactDetails,
    filters,
    notesViewAll: params.notesViewAll,
    limit: pageSize,
    offset: from,
  });

  return { data, total, page, pageCount };
}
