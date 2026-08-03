// SERVER ONLY — cached data helpers for /admin/clients (C-09 Phase C Step 5,
// re-shaped by C-16 Phase C Step 8).
//
// Page access (getAdminPageAccess + getClientDataAccess) is resolved upstream
// in page.tsx; `canViewContactDetails` is passed in because it selects which
// column set is read AND which columns the search/location predicates may
// touch, and it is part of every cache key here, so a caller without
// contact-detail authority can never be served the fuller entry.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE IS SHAPED THE WAY IT IS (C-16 Phase C Step 8)
//
// Until this step the page read EVERY row of `bookings` — no filter, no limit —
// purely to build a client→bookings map, and then filtered, sorted, counted and
// paged in memory. Bolting `.range()` onto the clients query would have been
// silently wrong: the lifecycle / payment / source / location filters, the
// "last visit" sort and the stats line all run over the WHOLE client set before
// any page slice, so a bounded query would have produced a correct-looking page
// of wrong rows.
//
// The map is now replaced by a per-client SUMMARY:
//
//   1. `getClientBookingSummaries(today)` reads `bookings` through a six-column
//      projection — client_id, booking_date, status, total_price, amount_due,
//      amount_paid. No joins, no contact columns, no addresses. Inside the
//      cached fetcher it is reduced immediately by `summariseClientBookings`
//      into ONE `ClientBookingSummary` per client, so what crosses the cache
//      boundary and lives in page memory is O(clients), not O(bookings).
//   2. The SQL-expressible narrowing (the deleted-clients scope, search, source,
//      location) is a predicate PLAN built once by `buildClientPredicatePlan`
//      and replayed by `applyClientPredicates` — the clients query no longer
//      filters anything in memory.
//   3. The derived narrowing that PostgREST cannot express (lifecycle, payment
//      standing) and the "last visit" sort run over that summary, against the
//      candidate id list the plan returned.
//   4. `total` is the LENGTH of the resolved, ordered candidate list and `rows`
//      is a window sliced out of that same array — so the "Showing X–Y of Z"
//      readout cannot disagree with the rows beneath it by construction, not
//      merely by convention.
//   5. Only that window's 25 clients are then read in full, together with only
//      those clients' bookings.
//
// RESIDUAL, STATED PLAINLY: step 1 still scans `bookings` server-side and
// transfers one narrow row per booking. It cannot be a grouped max()/count()
// query on this project — PostgREST aggregate functions are disabled here
// (probed read-only against the live REST endpoint: `PGRST123 "Use of
// aggregate functions is not allowed"`), and enabling them, or adding a view,
// an RPC or a stored per-client column, is a migration/config change outside
// this step's remit. The reduction is therefore done in the fetcher, cached on
// TAGS.BOOKINGS, and shared by the rows, the total and the stats line.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): every returned shape is JSON-safe.
//  - `ClientBookingSummaryIndex` is a plain Record keyed by client id — NOT a
//    Map, which would re-hydrate as {}.
//  - clients/bookings rows stay plain arrays of scalars plus a nested array of
//    scalars (`booking_items`); every timestamp stays a string.
//  - `today` is a `YYYY-MM-DD` UTC day string resolved by the CALLER, never a
//    `Date` and never a millisecond `Date.now()`. At millisecond precision it
//    would change on every call (so the entry would never hit) and two callers
//    could disagree about which bookings are "completed", which is exactly how
//    a total comes to describe a different rule than its rows.
// No Set / Map / Date crosses the boundary.
//
// Tags per the plan's Step 5 table: clients, bookings.

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
import type { ClientBookingRecord, ClientRecord } from "./types";

// `deleted_at` is selected in BOTH branches on purpose: these two strings are
// the contact-details and no-contact-details RBAC variants of the same read, and
// omitting the column from either would leave soft-deleted clients fully visible
// for that role alone. Nothing static can catch that — both are cast through
// `.returns<ClientRecord[]>()`, so a missing column reads as `undefined` and the
// "Show deleted" scoping downstream silently passes every row.
//
// The BOOKING_* selects deliberately do NOT carry it: no code path reads
// `booking.deleted_at`, because a soft-deleted booking only ever exists as a
// cascade of its client's deletion, and that client is already filtered out
// here and 404'd on the detail page.
const CLIENT_SELECT = `
  id,
  full_name,
  phone,
  email,
  address,
  postcode,
  client_source,
  source_detail,
  created_at,
  updated_at,
  deleted_at
`;

const CLIENT_SAFE_SELECT = `
  id,
  full_name,
  client_source,
  source_detail,
  created_at,
  updated_at,
  deleted_at
`;

const BOOKING_SELECT = `
  id,
  client_id,
  booking_date,
  start_time,
  end_time,
  status,
  payment_status,
  assignment_status,
  group_booking,
  total_price,
  amount_due,
  amount_paid,
  booking_source,
  contact_full_name,
  contact_email,
  contact_phone,
  service_city,
  service_postcode,
  service_address_line1,
  created_at,
  booking_items(service_name_snapshot, service_price_snapshot, service_duration_snapshot)
`;

const BOOKING_SAFE_SELECT = `
  id,
  client_id,
  booking_date,
  start_time,
  end_time,
  status,
  payment_status,
  assignment_status,
  group_booking,
  total_price,
  amount_due,
  amount_paid,
  booking_source,
  service_city,
  created_at,
  booking_items(service_name_snapshot, service_price_snapshot, service_duration_snapshot)
`;

/**
 * The candidate projection: the three columns the selection pass needs and
 * nothing else. `full_name` rides along so the alphabetical order stays
 * `localeCompare`'s, byte-for-byte what the page produced before this step,
 * rather than silently switching to the database collation.
 */
const CLIENT_CANDIDATE_SELECT = "id, full_name, created_at";

/** The summary projection — see the header note. No joins, no PII. */
const SUMMARY_BOOKING_SELECT =
  "client_id, booking_date, status, total_price, amount_due, amount_paid";

// Mirrors `escapeLike`/`quoteOrValue` in enquiries-data.ts, emails-data.ts and
// bookings-list-data.ts — duplicated per data module by house convention, each
// module owning its own PostgREST string handling.
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function quoteOrValue(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

// ---------------------------------------------------------------------------
// Derived per-client values
// ---------------------------------------------------------------------------

export type ClientLifecycleKey = "new" | "returning" | "at_risk" | "lapsed";
export type ClientSortKey = "name" | "last_visit";
export type ClientPaymentFilter = "in_good_standing" | "outstanding";

export interface ClientBookingSummary {
  /** Latest completed visit, `YYYY-MM-DD`. */
  lastCompletedDate: string | null;
  /** Earliest non-cancelled booking dated today or later. */
  nextUpcomingDate: string | null;
  completedCount: number;
  upcomingCount: number;
  /** Σ max(0, due − paid) across every booking, cancelled ones included. */
  outstanding: number;
}

/** Plain Record, not a Map — it crosses an `unstable_cache` boundary. */
export type ClientBookingSummaryIndex = Record<string, ClientBookingSummary>;

export const EMPTY_CLIENT_SUMMARY: ClientBookingSummary = {
  lastCompletedDate: null,
  nextUpcomingDate: null,
  completedCount: 0,
  upcomingCount: 0,
  outstanding: 0,
};

/** The minimum a row needs to be summarisable — satisfied by both projections. */
export interface SummarisableBooking {
  client_id: string;
  booking_date: string;
  status: string;
  total_price?: number | string | null;
  amount_due?: number | string | null;
  amount_paid?: number | string | null;
}

export function isCompletedVisit(
  booking: { status: string; booking_date: string },
  today: string
): boolean {
  if (booking.status === "cancelled" || booking.status === "no_show") return false;
  return booking.booking_date < today;
}

export function isUpcomingBooking(
  booking: { status: string; booking_date: string },
  today: string
): boolean {
  if (booking.status === "cancelled") return false;
  return booking.booking_date >= today;
}

/**
 * The ONE reducer. Run over the whole table inside `getClientBookingSummaries`
 * it yields the index the selection pass filters and sorts by; run over a
 * single page's booking rows it yields that page's row counts. Same function,
 * same inputs per client, so the badge on a row and the filter that selected it
 * cannot disagree.
 */
export function summariseClientBookings(
  rows: readonly SummarisableBooking[],
  today: string
): ClientBookingSummaryIndex {
  const index: ClientBookingSummaryIndex = {};
  for (const row of rows) {
    const current = index[row.client_id] ?? { ...EMPTY_CLIENT_SUMMARY };

    if (isCompletedVisit(row, today)) {
      current.completedCount += 1;
      if (
        current.lastCompletedDate === null ||
        row.booking_date > current.lastCompletedDate
      ) {
        current.lastCompletedDate = row.booking_date;
      }
    }
    if (isUpcomingBooking(row, today)) {
      current.upcomingCount += 1;
      if (
        current.nextUpcomingDate === null ||
        row.booking_date < current.nextUpcomingDate
      ) {
        current.nextUpcomingDate = row.booking_date;
      }
    }

    const due = Number(row.amount_due ?? row.total_price ?? 0);
    const paid = Number(row.amount_paid ?? 0);
    current.outstanding += Math.max(0, due - paid);

    index[row.client_id] = current;
  }
  return index;
}

/**
 * Whole days between two `YYYY-MM-DD` days, UTC.
 *
 * The pre-Step-8 code parsed each date at LOCAL midnight and subtracted the
 * current instant. This is the same arithmetic at day granularity — which is
 * the granularity the thresholds are written in (30 / 90 / 180 days) — and,
 * unlike a `Date.now()` read, it is stable for the whole UTC day, so it can sit
 * inside a cached derivation without the boundary drifting between two callers.
 */
function daysBetweenDays(fromIsoDay: string, toIsoDay: string): number | null {
  const from = Date.parse(`${fromIsoDay}T00:00:00Z`);
  const to = Date.parse(`${toIsoDay}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

/** Unchanged rules, re-expressed over the summary instead of a booking array. */
export function clientLifecycle(
  createdAt: string,
  summary: ClientBookingSummary,
  today: string
): ClientLifecycleKey {
  const hasUpcoming = summary.upcomingCount > 0;
  const createdDays = daysBetweenDays(createdAt.slice(0, 10), today);
  const isNewByAge = createdDays !== null && createdDays <= 30;

  if (summary.completedCount === 0) {
    // Never visited yet
    if (hasUpcoming) return isNewByAge ? "new" : "returning";
    return isNewByAge ? "new" : "lapsed";
  }

  const daysSinceLastCompleted = summary.lastCompletedDate
    ? daysBetweenDays(summary.lastCompletedDate, today)
    : null;
  if (daysSinceLastCompleted !== null && !hasUpcoming) {
    if (daysSinceLastCompleted > 180) return "lapsed";
    if (daysSinceLastCompleted > 90) return "at_risk";
  }
  if (summary.completedCount >= 3) return "returning";
  if (isNewByAge) return "new";
  return "returning";
}

// ---------------------------------------------------------------------------
// The request's filter context, and its SQL half
// ---------------------------------------------------------------------------

export interface ClientListFilters {
  /** Name, and — with the permission — phone/email. */
  q?: string;
  lifecycle?: ClientLifecycleKey;
  payment?: ClientPaymentFilter;
  location?: string;
  source?: string;
}

/**
 * Everything the selection needs, resolved ONCE per request. JSON-safe
 * throughout, because parts of it become `unstable_cache` keys.
 */
export interface ClientListContext extends ClientListFilters {
  canViewContactDetails: boolean;
  includeDeleted: boolean;
  sort: ClientSortKey;
  /** UTC day, `YYYY-MM-DD`. Resolved by the caller — never inside a fetcher. */
  today: string;
}

const LIFECYCLE_KEYS: readonly ClientLifecycleKey[] = [
  "new",
  "returning",
  "at_risk",
  "lapsed",
];

/** Query string → context. The single place a URL becomes a filter. */
export function clientListContextFromQuery(
  query: Record<string, string | string[] | undefined>,
  options: { canViewContactDetails: boolean }
): ClientListContext {
  const value = (key: string) => {
    const raw = query[key];
    const single = Array.isArray(raw) ? raw[0] : raw;
    const trimmed = (single ?? "").trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };
  const lifecycle = value("lifecycle");
  const payment = value("payment");

  return {
    canViewContactDetails: options.canViewContactDetails,
    includeDeleted: value("show_deleted") === "1",
    sort: value("sort") === "last_visit" ? "last_visit" : "name",
    today: new Date().toISOString().slice(0, 10),
    q: value("q"),
    lifecycle: LIFECYCLE_KEYS.includes(lifecycle as ClientLifecycleKey)
      ? (lifecycle as ClientLifecycleKey)
      : undefined,
    payment:
      payment === "in_good_standing" || payment === "outstanding"
        ? payment
        : undefined,
    location: value("location"),
    source: value("source"),
  };
}

export type ClientPredicateStep =
  | { op: "isNull"; column: string }
  | { op: "in"; column: string; values: string[] }
  | { op: "or"; filters: string };

export interface ClientPredicatePlan {
  steps: ClientPredicateStep[];
}

/**
 * The client ids reachable through a BOOKING for the source / location filters.
 *
 * Both filters are `client matches OR any of its bookings matches` in the
 * original in-memory pass. PostgREST cannot OR across an embed, so the booking
 * arm is resolved to ids first and folded into the same `.or(...)` as one
 * `id.in.(…)` operand — the shape `getSearchClientIds` established for the
 * bookings list.
 */
export interface ClientBookingMatches {
  sourceClientIds: string[];
  locationClientIds: string[];
}

/**
 * Capped for the same reason the bookings list caps its search ids: a
 * one-character location must not put every client id in a URL. Beyond the cap
 * the filter narrows rather than failing — documented, and reachable only with
 * far more matching bookings than this clinic will have.
 */
const CLIENT_ID_OPERAND_CAP = 200;

async function getBookingSourceClientIds(source?: string): Promise<string[]> {
  if (!source) return [];
  const cached = unstable_cache(
    async (): Promise<string[]> => {
      const { data } = await createSupabaseAdminClient()
        .from("bookings")
        .select("client_id")
        .eq("booking_source", source)
        .limit(CLIENT_ID_OPERAND_CAP)
        .returns<{ client_id: string | null }[]>();
      return uniqueIds(data);
    },
    ["clients-source-booking-ids", cacheKeyPart({ source })],
    { revalidate: 60, tags: [TAGS.BOOKINGS] }
  );
  return cached();
}

async function getBookingLocationClientIds(
  location: string | undefined,
  canViewContactDetails: boolean
): Promise<string[]> {
  if (!location) return [];
  const cached = unstable_cache(
    async (): Promise<string[]> => {
      const needle = quoteOrValue(`%${escapeLike(location)}%`);
      const arms = [
        `service_city.ilike.${needle}`,
        `service_postcode.ilike.${needle}`,
        ...(canViewContactDetails
          ? [`service_address_line1.ilike.${needle}`]
          : []),
      ];
      const { data } = await createSupabaseAdminClient()
        .from("bookings")
        .select("client_id")
        .or(arms.join(","))
        .limit(CLIENT_ID_OPERAND_CAP)
        .returns<{ client_id: string | null }[]>();
      return uniqueIds(data);
    },
    [
      "clients-location-booking-ids",
      cacheKeyPart({ location, canViewContactDetails }),
    ],
    { revalidate: 60, tags: [TAGS.BOOKINGS] }
  );
  return cached();
}

function uniqueIds(rows: { client_id: string | null }[] | null): string[] {
  const seen = new Set<string>();
  for (const row of rows ?? []) {
    if (row.client_id) seen.add(row.client_id);
  }
  return Array.from(seen);
}

export async function resolveClientBookingMatches(
  context: ClientListContext
): Promise<ClientBookingMatches> {
  const [sourceClientIds, locationClientIds] = await Promise.all([
    getBookingSourceClientIds(context.source),
    getBookingLocationClientIds(
      context.location,
      context.canViewContactDetails
    ),
  ]);
  return { sourceClientIds, locationClientIds };
}

/**
 * The ONLY place a clients WHERE clause is written. The candidate query, the
 * unfiltered scope query behind the stats line and (through `countClients`) the
 * deleted-toggle head-counts all narrow through this — including the
 * deleted-clients scope, which before this step never reached SQL at all and
 * was a pure in-memory `.filter(...)`.
 */
export function buildClientPredicatePlan(
  context: ClientListContext,
  matches: ClientBookingMatches
): ClientPredicatePlan {
  const steps: ClientPredicateStep[] = [];

  // 1 — the deleted-clients scope (C-06's toggle), in SQL.
  if (!context.includeDeleted) steps.push({ op: "isNull", column: "deleted_at" });

  // 2 — search. Name always; phone/email only with the contact permission,
  // exactly as the in-memory pass read them.
  if (context.q) {
    const needle = quoteOrValue(`%${escapeLike(context.q)}%`);
    steps.push({
      op: "or",
      filters: [
        `full_name.ilike.${needle}`,
        ...(context.canViewContactDetails
          ? [`phone.ilike.${needle}`, `email.ilike.${needle}`]
          : []),
      ].join(","),
    });
  }

  // 3 — source: the client's own source, or any of its bookings'.
  if (context.source) {
    const arms = [`client_source.eq.${quoteOrValue(context.source)}`];
    if (matches.sourceClientIds.length > 0) {
      arms.push(`id.in.(${matches.sourceClientIds.join(",")})`);
    }
    steps.push({ op: "or", filters: arms.join(",") });
  }

  // 4 — location: the client's own postcode/address (permission-gated), or any
  // of its bookings' city/postcode/address.
  if (context.location) {
    const needle = quoteOrValue(`%${escapeLike(context.location)}%`);
    const arms = [
      ...(context.canViewContactDetails
        ? [`postcode.ilike.${needle}`, `address.ilike.${needle}`]
        : []),
    ];
    if (matches.locationClientIds.length > 0) {
      arms.push(`id.in.(${matches.locationClientIds.join(",")})`);
    }
    // No arm can match: without the contact permission the client half of the
    // filter does not exist, and no booking matched either. An empty `.or()` is
    // not a valid PostgREST filter, so express "nothing" explicitly.
    if (arms.length === 0) steps.push({ op: "in", column: "id", values: [] });
    else steps.push({ op: "or", filters: arms.join(",") });
  }

  return { steps };
}

/** Structural minimum of a PostgREST filter builder. */
export interface ClientsFilterBuilder {
  is(column: string, value: null): ClientsFilterBuilder;
  in(column: string, values: readonly string[]): ClientsFilterBuilder;
  or(filters: string): ClientsFilterBuilder;
}

/**
 * Replays a plan onto a query builder — the only consumer of a step, and the
 * reason two queries built from one plan cannot carry different WHERE clauses.
 *
 * `Q` is deliberately unconstrained, same reasoning as `applyBookingPredicates`
 * in bookings-list-data.ts (constraining it makes tsc give up with TS2589 on
 * PostgrestFilterBuilder's parsed-select generics). `Q` flows straight back out.
 */
export function applyClientPredicates<Q>(
  query: Q,
  steps: readonly ClientPredicateStep[]
): Q {
  let next = query as unknown as ClientsFilterBuilder;
  for (const step of steps) {
    switch (step.op) {
      case "isNull":
        next = next.is(step.column, null);
        break;
      case "in":
        next = next.in(step.column, step.values);
        break;
      case "or":
        next = next.or(step.filters);
        break;
    }
  }
  return next as unknown as Q;
}

// ---------------------------------------------------------------------------
// The reads
// ---------------------------------------------------------------------------

/**
 * One `ClientBookingSummary` per client, for the whole table.
 *
 * The read is a six-column projection; the reduction happens INSIDE the cached
 * fetcher, so the booking rows never leave it — the entry, and everything
 * downstream of it, is O(clients).
 */
export async function getClientBookingSummaries(
  today: string
): Promise<ClientBookingSummaryIndex> {
  const cached = unstable_cache(
    async (): Promise<ClientBookingSummaryIndex> => {
      const { data } = await createSupabaseAdminClient()
        .from("bookings")
        .select(SUMMARY_BOOKING_SELECT)
        .returns<SummarisableBooking[]>();
      return summariseClientBookings(data ?? [], today);
    },
    ["clients-booking-summaries", cacheKeyPart({ today })],
    { revalidate: 60, tags: [TAGS.BOOKINGS] }
  );
  return cached();
}

export interface ClientCandidate {
  id: string;
  full_name: string;
  created_at: string;
}

/**
 * The clients matching the plan, id + name + created_at only.
 *
 * Keyed on the plan's steps: the cache key IS the WHERE clause, so a predicate
 * that reached the query but not the key cannot exist.
 */
async function getClientCandidates(
  plan: ClientPredicatePlan
): Promise<ClientCandidate[]> {
  const cached = unstable_cache(
    async (): Promise<ClientCandidate[]> => {
      const { data } = await applyClientPredicates(
        createSupabaseAdminClient()
          .from("clients")
          .select(CLIENT_CANDIDATE_SELECT),
        plan.steps
      )
        .order("full_name")
        .order("id")
        .returns<ClientCandidate[]>();
      return data ?? [];
    },
    ["clients-candidates", cacheKeyPart({ steps: plan.steps })],
    { revalidate: 60, tags: [TAGS.CLIENTS] }
  );
  return cached();
}

export interface ClientsPageRowsData {
  clients: ClientRecord[];
  bookings: ClientBookingRecord[];
}

/** The full rows for ONE page's clients, and only those clients' bookings. */
export async function getClientsPageRows(params: {
  canViewContactDetails: boolean;
  ids: string[];
}): Promise<ClientsPageRowsData> {
  const { canViewContactDetails, ids } = params;
  if (ids.length === 0) return { clients: [], bookings: [] };

  const cached = unstable_cache(
    async (): Promise<ClientsPageRowsData> => {
      const adminClient = createSupabaseAdminClient();
      const [clientsResult, bookingsResult] = await Promise.all([
        adminClient
          .from("clients")
          .select(canViewContactDetails ? CLIENT_SELECT : CLIENT_SAFE_SELECT)
          .in("id", ids)
          .returns<ClientRecord[]>(),
        adminClient
          .from("bookings")
          .select(canViewContactDetails ? BOOKING_SELECT : BOOKING_SAFE_SELECT)
          .in("client_id", ids)
          .order("booking_date", { ascending: false })
          .order("start_time", { ascending: false })
          .returns<ClientBookingRecord[]>(),
      ]);
      return {
        clients: clientsResult.data ?? [],
        bookings: bookingsResult.data ?? [],
      };
    },
    ["clients-page-rows", cacheKeyPart({ canViewContactDetails, ids })],
    { revalidate: 60, tags: [TAGS.CLIENTS, TAGS.BOOKINGS] }
  );
  return cached();
}

/**
 * Cheap head-count companion. Head request — no rows transferred.
 * `includeDeleted` mirrors the page's "Show deleted" toggle, and pushes it into
 * SQL exactly as `buildClientPredicatePlan` does for the candidate query.
 */
export async function countClients(includeDeleted = false): Promise<number> {
  const cached = unstable_cache(
    async (): Promise<number> => {
      const adminClient = createSupabaseAdminClient();
      let query = adminClient
        .from("clients")
        .select("id", { count: "exact", head: true });
      if (!includeDeleted) query = query.is("deleted_at", null);
      const { count, error } = await query;
      if (error) return 0;
      return count ?? 0;
    },
    ["clients-count", cacheKeyPart({ includeDeleted })],
    { revalidate: 60, tags: [TAGS.CLIENTS] }
  );
  return cached();
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export interface ClientListRow {
  client: ClientRecord;
  bookings: ClientBookingRecord[];
  lifecycle: ClientLifecycleKey;
  lastCompleted: ClientBookingRecord | null;
  nextUpcoming: ClientBookingRecord | null;
  completedCount: number;
  upcomingCount: number;
}

export interface ClientLifecycleStats {
  active: number;
  newThisMonth: number;
  returning: number;
  atRiskLapsed: number;
}

export type ClientsListPage = PaginatedResult<ClientListRow> & {
  /** Clients in the current deleted-scope, before any filter or search. */
  totalInScope: number;
  /** Soft-deleted clients that exist at all — the "Show deleted (N)" label. */
  deletedCount: number;
  stats: ClientLifecycleStats;
};

function matchesDerivedFilters(
  candidate: ClientCandidate,
  summary: ClientBookingSummary,
  context: ClientListContext
): boolean {
  if (
    context.lifecycle &&
    clientLifecycle(candidate.created_at, summary, context.today) !==
      context.lifecycle
  ) {
    return false;
  }
  if (context.payment === "in_good_standing" && summary.outstanding > 0) {
    return false;
  }
  if (context.payment === "outstanding" && summary.outstanding <= 0) {
    return false;
  }
  return true;
}

/**
 * The comparators, unchanged from the in-memory pass — most recent completed
 * visit first, then the earliest upcoming for clients who have never visited,
 * then alphabetical.
 */
function sortCandidates(
  candidates: ClientCandidate[],
  summaries: ClientBookingSummaryIndex,
  sort: ClientSortKey
): void {
  if (sort !== "last_visit") {
    candidates.sort((a, b) => a.full_name.localeCompare(b.full_name));
    return;
  }
  candidates.sort((a, b) => {
    const aSummary = summaries[a.id] ?? EMPTY_CLIENT_SUMMARY;
    const bSummary = summaries[b.id] ?? EMPTY_CLIENT_SUMMARY;
    const aLast = aSummary.lastCompletedDate ?? "";
    const bLast = bSummary.lastCompletedDate ?? "";
    if (aLast && bLast) return bLast.localeCompare(aLast);
    if (aLast) return -1;
    if (bLast) return 1;
    const aNext = aSummary.nextUpcomingDate ?? "";
    const bNext = bSummary.nextUpcomingDate ?? "";
    if (aNext && bNext) return aNext.localeCompare(bNext);
    if (aNext) return -1;
    if (bNext) return 1;
    return a.full_name.localeCompare(b.full_name);
  });
}

function pickLastCompleted(
  bookings: readonly ClientBookingRecord[],
  today: string
): ClientBookingRecord | null {
  let latest: ClientBookingRecord | null = null;
  for (const booking of bookings) {
    if (!isCompletedVisit(booking, today)) continue;
    if (!latest || booking.booking_date > latest.booking_date) latest = booking;
  }
  return latest;
}

function pickNextUpcoming(
  bookings: readonly ClientBookingRecord[],
  today: string
): ClientBookingRecord | null {
  let earliest: ClientBookingRecord | null = null;
  for (const booking of bookings) {
    if (!isUpcomingBooking(booking, today)) continue;
    if (!earliest || booking.booking_date < earliest.booking_date) {
      earliest = booking;
    }
  }
  return earliest;
}

function computeLifecycleStats(
  roster: readonly ClientCandidate[],
  summaries: ClientBookingSummaryIndex,
  today: string
): ClientLifecycleStats {
  const stats: ClientLifecycleStats = {
    active: 0,
    newThisMonth: 0,
    returning: 0,
    atRiskLapsed: 0,
  };
  for (const candidate of roster) {
    const lifecycle = clientLifecycle(
      candidate.created_at,
      summaries[candidate.id] ?? EMPTY_CLIENT_SUMMARY,
      today
    );
    if (lifecycle !== "lapsed") stats.active += 1;
    if (lifecycle === "new") stats.newThisMonth += 1;
    if (lifecycle === "returning") stats.returning += 1;
    if (lifecycle === "at_risk" || lifecycle === "lapsed") {
      stats.atRiskLapsed += 1;
    }
  }
  return stats;
}

/**
 * The clients list's single entry point (C-16 Phase C Step 8) — the analogue of
 * `getBookingsListPage` / `getEmailDeliveryPage`, adapted to a surface whose
 * filters are partly derived rather than partly stored.
 *
 * ONE `ClientListContext` produces: the predicate plan (SQL), the derived
 * filter pass, the sort, the total and the window. `total` is the length of the
 * very array `rows` is sliced from, so the readout and the rows are the same
 * selection by construction.
 *
 * The stats line and the "of N clients" denominator are computed over the same
 * plan with the NARROWING filters removed — i.e. the current deleted-scope,
 * before search/lifecycle/payment/location/source — which is what they always
 * described.
 */
export async function getClientsListPage(params: {
  context: ClientListContext;
  /** Raw `?page=` — parsed and clamped here, against the REAL page count. */
  page?: unknown;
  pageSize?: number;
}): Promise<ClientsListPage> {
  const { context } = params;
  const pageSize = params.pageSize ?? LIST_PAGE_SIZE;

  const scopeContext: ClientListContext = {
    canViewContactDetails: context.canViewContactDetails,
    includeDeleted: context.includeDeleted,
    sort: context.sort,
    today: context.today,
  };

  const matches = await resolveClientBookingMatches(context);
  const plan = buildClientPredicatePlan(context, matches);
  const scopePlan = buildClientPredicatePlan(scopeContext, {
    sourceClientIds: [],
    locationClientIds: [],
  });

  const [summaries, candidates, allClients, liveClients] = await Promise.all([
    getClientBookingSummaries(context.today),
    getClientCandidates(plan),
    countClients(true),
    countClients(false),
  ]);

  // With nothing narrowing the list, the two plans ARE the same WHERE clause,
  // so the stats reuse the array rather than re-issuing it — the default view
  // costs one clients query, as it did before this step. (Reused explicitly,
  // not left to the cache: two identical fetches issued concurrently both miss.)
  const roster =
    cacheKeyPart({ steps: plan.steps }) === cacheKeyPart({ steps: scopePlan.steps })
      ? candidates
      : await getClientCandidates(scopePlan);

  const selected = candidates.filter((candidate) =>
    matchesDerivedFilters(
      candidate,
      summaries[candidate.id] ?? EMPTY_CLIENT_SUMMARY,
      context
    )
  );
  sortCandidates(selected, summaries, context.sort);

  const total = selected.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = clampPage(params.page, pageCount);
  const { from, to } = pageRange(page, pageSize);
  const pageIds = selected.slice(from, to + 1).map((candidate) => candidate.id);

  const { clients, bookings } = await getClientsPageRows({
    canViewContactDetails: context.canViewContactDetails,
    ids: pageIds,
  });

  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const bookingsByClientId = new Map<string, ClientBookingRecord[]>();
  for (const booking of bookings) {
    const list = bookingsByClientId.get(booking.client_id);
    if (list) list.push(booking);
    else bookingsByClientId.set(booking.client_id, [booking]);
  }

  const rows: ClientListRow[] = [];
  for (const id of pageIds) {
    const client = clientsById.get(id);
    if (!client) continue; // deleted between the two reads
    const clientBookings = bookingsByClientId.get(id) ?? [];
    // Same reducer as the whole-set index, over this client's own rows — so a
    // row's visit counts and the filter that selected it are one rule.
    const summary =
      summariseClientBookings(clientBookings, context.today)[id] ??
      EMPTY_CLIENT_SUMMARY;
    rows.push({
      client,
      bookings: clientBookings,
      lifecycle: clientLifecycle(client.created_at, summary, context.today),
      lastCompleted: pickLastCompleted(clientBookings, context.today),
      nextUpcoming: pickNextUpcoming(clientBookings, context.today),
      completedCount: summary.completedCount,
      upcomingCount: summary.upcomingCount,
    });
  }

  return {
    rows,
    total,
    page,
    pageCount,
    totalInScope: roster.length,
    deletedCount: Math.max(0, allClients - liveClients),
    stats: computeLifecycleStats(roster, summaries, context.today),
  };
}
