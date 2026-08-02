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
// PAGINATION-READY (C-16): optional `limit` + `offset` bound the privacy-request
// queue and flow into BOTH the query and the cache key, so page 2 can never be
// served page 1's rows. Both default to undefined, which reproduces today's
// unbounded queue exactly. The sensitive-notes rail keeps its fixed 25-row cap.
// `countPrivacyRequests` is the cheap head-count companion for C-16's
// "Showing X–Y of Z" readout; it is not called by the page today.
//
// FILTERS (C-09 Phase D Step 12): request_type/status/date-range/q are now
// real `.in`/`.gte`/`.lte`/`.ilike` predicates on the requests query, applied
// here and folded into the cache key — a caller filtering to status=open can
// never be served a cache entry built for status=completed. page.tsx calls
// this fetcher twice when any filter is active: once unfiltered (the "Open
// requests" / "Awaiting longest" stat tiles always reflect the WHOLE queue,
// not the current filter, and `clients`/`staff` need to cover every request
// referenced by those unfiltered stats) and once with the filters (for the
// status-grouped queue). The two calls share a cache entry in the common
// no-filter case, so the default view still costs exactly one query.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";

export const PRIVACY_NOTES_LIMIT = 25;

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
  } = params;

  const cached = unstable_cache(
    async (): Promise<PrivacyPageData> => {
      const adminClient = createSupabaseAdminClient();

      let requestsQuery = adminClient
        .from("client_privacy_requests")
        .select(
          "id, client_id, request_type, status, request_note, created_at, updated_at, created_by_staff_id"
        )
        .order("created_at", { ascending: false });
      if (filters?.requestTypes?.length) {
        requestsQuery = requestsQuery.in("request_type", filters.requestTypes);
      }
      if (filters?.statuses?.length) {
        requestsQuery = requestsQuery.in("status", filters.statuses);
      }
      if (filters?.fromDate) requestsQuery = requestsQuery.gte("created_at", filters.fromDate);
      if (filters?.toDate) requestsQuery = requestsQuery.lte("created_at", filters.toDate);
      if (filters?.q) {
        requestsQuery = requestsQuery.ilike(
          "request_note",
          `%${escapeLike(filters.q)}%`
        );
      }
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
            .limit(PRIVACY_NOTES_LIMIT)
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
      }),
    ],
    { revalidate: 60, tags: [TAGS.CLIENTS, TAGS.AUDIT] }
  );
  return cached();
}

/**
 * Cheap head-count companion for C-16's "Showing X–Y of Z" readout. Head
 * request — no rows transferred. Not used by the page yet.
 */
export async function countPrivacyRequests(): Promise<number> {
  const cached = unstable_cache(
    async (): Promise<number> => {
      const adminClient = createSupabaseAdminClient();
      const { count, error } = await adminClient
        .from("client_privacy_requests")
        .select("id", { count: "exact", head: true });
      if (error) return 0;
      return count ?? 0;
    },
    ["privacy-requests-count"],
    { revalidate: 60, tags: [TAGS.CLIENTS, TAGS.AUDIT] }
  );
  return cached();
}
