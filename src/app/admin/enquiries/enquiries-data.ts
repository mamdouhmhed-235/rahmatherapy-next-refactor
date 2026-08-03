// SERVER ONLY — cached data helper for /admin/enquiries (C-09 Phase C Step 5).
//
// Access (canManageEnquiries) is enforced upstream in page.tsx; the reads run
// on the admin client, exactly as they did inline.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is JSON-safe.
//  - `enquiries` and `staff` are plain row arrays of scalars.
//  - TRANSFORM APPLIED: `staff` is returned as an ARRAY of {id,name}, not the
//    `Map` page.tsx builds from it — a Map re-hydrates as {}. page.tsx builds
//    the Map after the cache boundary.
//  - All timestamps stay ISO strings; the page's date arithmetic and sorting
//    (`new Date(row.created_at).getTime()`) runs on this side of the boundary.
// No Set / Map / Date crosses the boundary.
//
// Tag: `enquiries`, per the plan's Step 5 table. The active-staff dropdown
// rides along in the same entry; a staff rename does not set the enquiries
// tag, so that dropdown can trail by at most the 60s revalidate window.
//
// PAGINATION-READY (C-16): optional `limit` + `offset` flow into BOTH the
// enquiries query and the cache key, so page 2 can never be served page 1's
// rows. Both default to undefined, which reproduces today's unbounded list
// exactly. `countEnquiries` is the cheap head-count companion for C-16's
// "Showing X–Y of Z" readout; it is not called by the page today.
//
// FILTERS (C-09 Phase D Step 8): tab/source/assigned/date/q are now applied
// server-side, inside this fetcher, and flow into the cache key via
// `cacheKeyPart` — a caller filtering by "converted" can never be served a
// cache entry built for "new". page.tsx calls this fetcher twice: once with
// no filters (for the tab badge + at-a-glance stats, which always reflect the
// whole pipeline regardless of the current filter) and once with the current
// filters (for the visible list) when any filter is active — the two calls
// share a cache entry when no filter is active, so the common default view
// costs exactly one query, same as before this step.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";

const ENQUIRIES_SELECT =
  "id, full_name, phone, email, source, status, service_interest, notes, client_id, converted_booking_id, assigned_staff_id, created_at, updated_at";

export interface EnquiryRecord {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  service_interest: string | null;
  notes: string | null;
  client_id: string | null;
  converted_booking_id: string | null;
  assigned_staff_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface EnquiryStaffOption {
  id: string;
  name: string;
}

export interface EnquiriesFilters {
  /** Maps the page's "tab" concept: a plain status, or "converted" for
   *  `converted_booking_id IS NOT NULL`. "all" is not passed — omit instead. */
  status?: "new" | "contacted" | "closed" | "converted";
  source?: string;
  /** Staff id, or the literal "unassigned" for `assigned_staff_id IS NULL`. */
  assignedStaff?: string;
  /** Inclusive UTC day bounds, `YYYY-MM-DD`. */
  fromDate?: string;
  toDate?: string;
  /** Matched against full_name / phone / email / service_interest. */
  q?: string;
}

export interface EnquiriesParams extends EnquiriesFilters {
  limit?: number;
  offset?: number;
}

export interface EnquiriesPageData {
  enquiries: EnquiryRecord[];
  staff: EnquiryStaffOption[];
}

function escapeLike(value: string) {
  // Escapes what the ILIKE pattern engine treats specially — a literal
  // backslash, `%`, and `_` — so user input matches literally instead of as
  // a wildcard.
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Wraps a `.or(...)` filter operand in double quotes — PostgREST's
 * documented mechanism for its reserved characters (`,` `.` `:` `*` `(` `)`)
 * inside a filter value. `postgrest-js`'s `.or()` forwards its argument to
 * the URL verbatim (see PostgrestFilterBuilder.or() in
 * node_modules/@supabase/postgrest-js) — nothing downstream escapes a bare
 * comma/paren, and a bare backslash before one is not honoured either
 * (confirmed against PostgREST's URL-grammar docs: reserved characters are
 * escaped by quoting the whole value, not by backslash-prefixing them
 * unquoted). A literal `"` inside the value is escaped to `\"` per the same
 * quoting convention.
 */
function quoteOrValue(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

export async function getEnquiriesPageData(
  params: EnquiriesParams = {}
): Promise<EnquiriesPageData> {
  const { limit, offset, status, source, assignedStaff, fromDate, toDate, q } =
    params;

  const cached = unstable_cache(
    async (): Promise<EnquiriesPageData> => {
      const adminClient = createSupabaseAdminClient();

      let enquiriesQuery = adminClient
        .from("enquiries")
        .select(ENQUIRIES_SELECT)
        .order("created_at", { ascending: false });
      if (status === "converted") {
        enquiriesQuery = enquiriesQuery.not("converted_booking_id", "is", null);
      } else if (status) {
        enquiriesQuery = enquiriesQuery.eq("status", status);
      }
      if (source) enquiriesQuery = enquiriesQuery.eq("source", source);
      if (assignedStaff === "unassigned") {
        enquiriesQuery = enquiriesQuery.is("assigned_staff_id", null);
      } else if (assignedStaff) {
        enquiriesQuery = enquiriesQuery.eq("assigned_staff_id", assignedStaff);
      }
      if (fromDate) enquiriesQuery = enquiriesQuery.gte("created_at", `${fromDate}T00:00:00Z`);
      if (toDate) enquiriesQuery = enquiriesQuery.lte("created_at", `${toDate}T23:59:59Z`);
      if (q) {
        const needle = quoteOrValue(`%${escapeLike(q)}%`);
        enquiriesQuery = enquiriesQuery.or(
          [
            `full_name.ilike.${needle}`,
            `phone.ilike.${needle}`,
            `email.ilike.${needle}`,
            `service_interest.ilike.${needle}`,
          ].join(",")
        );
      }
      if (limit !== undefined) {
        const start = offset ?? 0;
        enquiriesQuery = enquiriesQuery.range(start, start + limit - 1);
      }

      const [{ data: enquiriesRaw }, { data: staffRaw }] = await Promise.all([
        enquiriesQuery.returns<EnquiryRecord[]>(),
        adminClient
          .from("staff_profiles")
          .select("id, name")
          .eq("active", true)
          .order("name")
          .returns<EnquiryStaffOption[]>(),
      ]);

      return { enquiries: enquiriesRaw ?? [], staff: staffRaw ?? [] };
    },
    [
      "enquiries-page",
      cacheKeyPart({
        limit,
        offset,
        status,
        source,
        assignedStaff,
        fromDate,
        toDate,
        q,
      }),
    ],
    { revalidate: 60, tags: [TAGS.ENQUIRIES] }
  );
  return cached();
}

/**
 * Cheap head-count companion for C-16's "Showing X–Y of Z" readout. Head
 * request — no rows transferred. Not used by the page yet.
 */
export async function countEnquiries(): Promise<number> {
  const cached = unstable_cache(
    async (): Promise<number> => {
      const adminClient = createSupabaseAdminClient();
      const { count, error } = await adminClient
        .from("enquiries")
        .select("id", { count: "exact", head: true });
      if (error) return 0;
      return count ?? 0;
    },
    ["enquiries-count"],
    { revalidate: 60, tags: [TAGS.ENQUIRIES] }
  );
  return cached();
}
