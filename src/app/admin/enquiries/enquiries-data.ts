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
//
// WIRED (C-16 Phase C Step 8): `getEnquiriesListPage` is the entry point the
// page now uses, and three things changed underneath it.
//
//  1. SORT MOVED INTO THE QUERY. It used to be a JS pass over the fetched
//     rows. Bounding the query without moving it would have sorted each page
//     within itself — page 2 of "oldest first" would have been the second
//     newest-first block, re-sorted locally, and every row would still have
//     looked plausible. `applyEnquirySort` is now the only place an order is
//     expressed, and `sort` is part of the cache key.
//  2. ONE FILTER RESOLUTION FOR ROWS AND TOTAL. `applyEnquiryFilters` is the
//     single writer of the WHERE clause; `getEnquiriesPageData` (rows) and
//     `countEnquiries` (total) both run the SAME `EnquiriesFilters` object
//     through it, so the pager's total cannot describe a different predicate
//     than the rows beneath it.
//  3. BADGES AND STATS BECAME HEAD-COUNTS. The tab badge and the at-a-glance
//     strip used to be `.filter(...).length` over an unfiltered fetch of the
//     whole table — the read this step exists to remove. They are now
//     `count: "exact", head: true` queries through that SAME
//     `applyEnquiryFilters` (`getEnquiryOverviewCounts`), which is the
//     bookings chip-count precedent (C-16 Step 6): a badge cannot advertise a
//     number its own tab would not show, because there is no second place the
//     rule is written. Their day bounds are `YYYY-MM-DD` strings resolved by
//     the caller — never a millisecond `Date.now()`, which would both break
//     the cache key and let two counts disagree about "today".

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";
import {
  LIST_PAGE_SIZE,
  clampPage,
  pageRange,
  type PaginatedResult,
} from "@/lib/pagination";

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

export type EnquirySortKey = "newest" | "oldest" | "name" | "activity";

export interface EnquiriesParams extends EnquiriesFilters {
  sort?: EnquirySortKey;
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

/** Structural minimum of the PostgREST filter builder this module drives. */
interface EnquiryFilterBuilder {
  eq(column: string, value: unknown): EnquiryFilterBuilder;
  gte(column: string, value: unknown): EnquiryFilterBuilder;
  lte(column: string, value: unknown): EnquiryFilterBuilder;
  is(column: string, value: null): EnquiryFilterBuilder;
  not(column: string, operator: string, value: unknown): EnquiryFilterBuilder;
  or(filters: string): EnquiryFilterBuilder;
}

/**
 * The ONLY place an enquiries WHERE clause is written. The row query and the
 * head-count query both run the same `EnquiriesFilters` object through this,
 * which is what stops the pager's total describing a different predicate than
 * the rows it is counting — and it is also what the tab badge and the
 * at-a-glance stats are now built from.
 *
 * `Q` is deliberately unconstrained, same reasoning as `applyBookingPredicates`
 * in bookings-list-data.ts and `applyDeliveryPredicates` in emails-data.ts:
 * constraining it makes tsc compare this interface against
 * `PostgrestFilterBuilder`'s parsed-select generics and give up (TS2589). `Q`
 * flows straight back out, so callers keep `.order()`/`.range()`/`.returns()`
 * on the concrete builder.
 */
export function applyEnquiryFilters<Q>(query: Q, filters: EnquiriesFilters): Q {
  const { status, source, assignedStaff, fromDate, toDate, q } = filters;
  let next = query as unknown as EnquiryFilterBuilder;

  if (status === "converted") {
    next = next.not("converted_booking_id", "is", null);
  } else if (status) {
    next = next.eq("status", status);
  }
  if (source) next = next.eq("source", source);
  if (assignedStaff === "unassigned") {
    next = next.is("assigned_staff_id", null);
  } else if (assignedStaff) {
    next = next.eq("assigned_staff_id", assignedStaff);
  }
  if (fromDate) next = next.gte("created_at", `${fromDate}T00:00:00Z`);
  if (toDate) next = next.lte("created_at", `${toDate}T23:59:59Z`);
  if (q) {
    const needle = quoteOrValue(`%${escapeLike(q)}%`);
    next = next.or(
      [
        `full_name.ilike.${needle}`,
        `phone.ilike.${needle}`,
        `email.ilike.${needle}`,
        `service_interest.ilike.${needle}`,
      ].join(",")
    );
  }

  return next as unknown as Q;
}

/** Structural minimum of the ordering half of the builder. */
interface EnquiryOrderBuilder {
  order(
    column: string,
    options: { ascending: boolean }
  ): EnquiryOrderBuilder;
}

/**
 * The sort, in SQL (C-16 Phase C Step 8). It used to run in JS after the
 * fetch, which is safe only while the fetch is the whole table: bound the
 * query and each page gets sorted within itself, so "oldest first" page 2 is
 * the second newest-first block re-ordered locally — wrong, and every row on
 * it still looks plausible.
 *
 * Two deliberate notes:
 *  - `activity` orders by `updated_at` alone. The JS pass read
 *    `updated_at ?? created_at`; `enquiries.updated_at` is `NOT NULL DEFAULT
 *    now()` (verified against information_schema), so the fallback arm was
 *    unreachable, and PostgREST cannot express a COALESCE in `order`.
 *  - `name` orders by the database collation rather than
 *    `localeCompare(…, { sensitivity: "base" })`. The two agree on ASCII
 *    names and can differ on accents; the alternative is not sorting names
 *    globally at all.
 * Every branch ends on `id` so two rows sharing the leading value cannot swap
 * places between two page requests and show one row twice.
 */
export function applyEnquirySort<Q>(query: Q, sort: EnquirySortKey): Q {
  const next = query as unknown as EnquiryOrderBuilder;
  switch (sort) {
    case "oldest":
      return next
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }) as unknown as Q;
    case "name":
      return next
        .order("full_name", { ascending: true })
        .order("id", { ascending: true }) as unknown as Q;
    case "activity":
      return next
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false }) as unknown as Q;
    default:
      return next
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }) as unknown as Q;
  }
}

export async function getEnquiriesPageData(
  params: EnquiriesParams = {}
): Promise<EnquiriesPageData> {
  const { limit, offset, sort, status, source, assignedStaff, fromDate, toDate, q } =
    params;
  const filters: EnquiriesFilters = {
    status,
    source,
    assignedStaff,
    fromDate,
    toDate,
    q,
  };

  const cached = unstable_cache(
    async (): Promise<EnquiriesPageData> => {
      const adminClient = createSupabaseAdminClient();

      const sortedQuery = applyEnquirySort(
        applyEnquiryFilters(
          adminClient.from("enquiries").select(ENQUIRIES_SELECT),
          filters
        ),
        sort ?? "newest"
      );
      const start = offset ?? 0;
      const enquiriesQuery =
        limit === undefined
          ? sortedQuery
          : sortedQuery.range(start, start + limit - 1);

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
        sort,
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
 * request — no rows transferred. Takes the SAME `EnquiriesFilters` as
 * `getEnquiriesPageData` and applies them through the SAME
 * `applyEnquiryFilters`, so the total it returns always describes the rows
 * query's WHERE clause. Called with only a `status` (or a status plus day
 * bounds) it is also the tab badge / at-a-glance stat.
 */
export async function countEnquiries(
  filters: EnquiriesFilters = {}
): Promise<number> {
  const { status, source, assignedStaff, fromDate, toDate, q } = filters;

  const cached = unstable_cache(
    async (): Promise<number> => {
      const adminClient = createSupabaseAdminClient();
      const { count, error } = await applyEnquiryFilters(
        adminClient
          .from("enquiries")
          .select("id", { count: "exact", head: true }),
        filters
      );
      if (error) return 0;
      return count ?? 0;
    },
    [
      "enquiries-count",
      cacheKeyPart({ status, source, assignedStaff, fromDate, toDate, q }),
    ],
    { revalidate: 60, tags: [TAGS.ENQUIRIES] }
  );
  return cached();
}

export type EnquiriesListPage = PaginatedResult<EnquiryRecord> & {
  staff: EnquiryStaffOption[];
};

/**
 * The enquiries list's single entry point (C-16 Phase C Step 8) — mirrors
 * `getBookingsListPage` and `getEmailDeliveryPage`. One `EnquiriesFilters`
 * object produces the total and the window: count first, clamp `?page=`
 * against the REAL page count, then fetch exactly that window.
 */
export async function getEnquiriesListPage(params: {
  filters: EnquiriesFilters;
  sort: EnquirySortKey;
  /** Raw `?page=` — parsed and clamped here, against the REAL page count. */
  page?: unknown;
  pageSize?: number;
}): Promise<EnquiriesListPage> {
  const { filters, sort } = params;
  const pageSize = params.pageSize ?? LIST_PAGE_SIZE;

  // Sequential, not Promise.all — same reasoning as getBookingsListPage: a
  // stale `?page=99` can only be clamped once the total is known, and
  // fetching a window that then has to be discarded costs a whole row query.
  const total = await countEnquiries(filters);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = clampPage(params.page, pageCount);
  const { from } = pageRange(page, pageSize);

  const { enquiries, staff } = await getEnquiriesPageData({
    ...filters,
    sort,
    limit: pageSize,
    offset: from,
  });

  return { rows: enquiries, total, page, pageCount, staff };
}

/** Day bounds for the badge/stat head-counts, as `YYYY-MM-DD` strings. */
export interface EnquiryOverviewRanges {
  today: { from: string; to: string };
  week: { from: string; to: string };
  month: { from: string; to: string };
}

export interface EnquiryOverviewCounts {
  /** Whole-pipeline "new" total — the tab badge. */
  newTotal: number;
  todayNew: number;
  weekTotal: number;
  monthTotal: number;
  monthConverted: number;
}

/**
 * The tab badge and the at-a-glance strip, as head-counts (C-16 Phase C
 * Step 8). Each one is `countEnquiries` over the filter set the stat's own
 * link navigates to, so a stat can never advertise a number its destination
 * would not show — the bookings chip-count precedent, applied to the five
 * numbers this page actually renders.
 *
 * The ranges arrive as `YYYY-MM-DD` strings from the caller's own preset
 * helper (the same one that builds those links), so the day boundary is
 * shared, stable for the day, and safe in an `unstable_cache` key.
 */
export async function getEnquiryOverviewCounts(
  ranges: EnquiryOverviewRanges
): Promise<EnquiryOverviewCounts> {
  const [newTotal, todayNew, weekTotal, monthTotal, monthConverted] =
    await Promise.all([
      countEnquiries({ status: "new" }),
      countEnquiries({
        status: "new",
        fromDate: ranges.today.from,
        toDate: ranges.today.to,
      }),
      countEnquiries({ fromDate: ranges.week.from, toDate: ranges.week.to }),
      countEnquiries({ fromDate: ranges.month.from, toDate: ranges.month.to }),
      countEnquiries({
        status: "converted",
        fromDate: ranges.month.from,
        toDate: ranges.month.to,
      }),
    ]);

  return { newTotal, todayNew, weekTotal, monthTotal, monthConverted };
}
