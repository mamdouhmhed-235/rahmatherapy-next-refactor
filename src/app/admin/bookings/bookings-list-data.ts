// SERVER ONLY — cached data helpers for /admin/bookings (C-09 Phase C Step 5).
//
// `canManageBookings` is enforced upstream in page.tsx. The RBAC scope
// (`canViewAll`, `canClaim`) and the caller's identity are passed in and form
// part of the cache key, so a therapist can never be served the clinic-wide
// entry — and vice versa.
//
// The `profile` object is handed to the fetcher as a CLOSURE argument only: it
// carries a `Set` of permissions, so it must never appear in the cache key or
// in a returned value (SHARED-NOTES §15). What varies per caller is captured by
// the explicit scalars `staffId`, `staffGender`, `canViewAll` and `canClaim`.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shapes are JSON-safe.
//  - `getBookingsListData` returns BookingRecord[] — scalars plus nested arrays
//    of scalars. Every date/time is a string; the page's `getTodayIsoDate()`
//    comparisons, `filterBookings`, the `new Set(...)` grouping check and the
//    `new Map(...)` flat index all run on the consumer side of the boundary.
//  - `getBookingsChromeData` returns two plain option arrays.
//  - TRANSFORM APPLIED: none needed — the `new Set(...)` de-duplication inside
//    `getScopedBookingIds` is consumed there and returned as `string[]`.
//
// Tags per the plan's Step 5 table: bookings, clients, staff.
//
// PAGINATION-READY (C-16): optional `limit` + `offset` flow into BOTH the
// clinic-wide bookings query and the cache key, so page 2 can never be served
// page 1's rows. They deliberately do NOT slice the therapist-scoped branch:
// that branch is a union of two id-bounded reads (assigned + claimable) merged
// and re-sorted in memory, so a per-query range would page each half
// independently and produce a wrong window.
//
// WIRED (C-16 Phase C Step 5): `getBookingsListPage` is the entry point the
// page uses. It resolves one predicate context, pages the clinic-wide branch
// through `limit`/`offset` at LIST_PAGE_SIZE, and gets the matching total from
// `countBookings` — both through the same predicate plan (see the Step 5
// section below). The therapist-scoped branch stays an in-memory merge with a
// defensive per-branch row cap.
//
// C-16 Phase C Steps 6-7: `getBookingsListPage` now also clamps `?page=`
// against the real page count, and `getBookingViewCounts` answers the chip
// counts — one head-count per RENDERED chip, each built from the SAME
// `BookingPredicateContext` the list uses with only `view` swapped, so a chip
// can never advertise a number its own view would not show.

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
import type { getStaffProfile } from "@/lib/auth/rbac";
import { canClaimAssignments } from "./access";
import { getTodayIsoDate } from "./_helpers";
import type { BookingViewKey } from "./BookingsChrome";
import type { BookingRecord } from "./types";

type Profile = NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>;

// C-04a Phase G — `cancelled_at` is named here in the SAME change that adds it
// to `BookingRecord` (./types.ts). Splitting them leaves the field `undefined`
// at runtime while tsc stays green (the admin client carries no `Database`
// generic and the row is an unchecked `.returns<BookingRecord[]>()` cast),
// which makes `isRestoreWindowExpired` fail closed on every cancelled booking
// and hides the row menu's Restore item everywhere.
const BOOKING_SELECT = `
  id,
  booking_date,
  start_time,
  end_time,
  total_duration_mins,
  total_price,
  travel_fee,
  contact_full_name,
  contact_email,
  contact_phone,
  booking_source,
  amount_due,
  amount_paid,
  paid_at,
  payment_note,
  status,
  payment_status,
  payment_method,
  assignment_status,
  group_booking,
  service_address_line1,
  service_address_line2,
  service_city,
  service_postcode,
  access_notes,
  consent_acknowledged,
  customer_notes,
  health_notes,
  customer_manage_notes,
  cancelled_at,
  customer_cancelled_at,
  customer_cancellation_note,
  last_customer_manage_action_at,
  reschedule_requested_at,
  reschedule_preferred_date,
  reschedule_preferred_time,
  reschedule_note,
  reschedule_status,
  admin_notes,
  treatment_notes,
  created_at,
  recurring_template_id,
  clients(full_name, phone, email),
  booking_participants(id, participant_gender, required_therapist_gender, is_main_contact, display_name, participant_notes, health_notes, consent_acknowledged),
  booking_items(id, booking_participant_id, service_name_snapshot, service_price_snapshot, service_duration_snapshot),
  booking_assignments(id, participant_id, assigned_staff_id, required_therapist_gender, status, staff_profiles(name))
`;

const CLAIMABLE_BOOKING_SELECT = `
  id,
  booking_date,
  start_time,
  end_time,
  total_duration_mins,
  status,
  assignment_status,
  group_booking,
  booking_source,
  reschedule_status,
  cancelled_at,
  customer_cancelled_at,
  created_at,
  recurring_template_id,
  booking_participants(id, participant_gender, required_therapist_gender, is_main_contact, consent_acknowledged),
  booking_items(id, booking_participant_id, service_name_snapshot, service_duration_snapshot),
  booking_assignments(id, participant_id, assigned_staff_id, required_therapist_gender, status, staff_profiles(name))
`;

// ---------------------------------------------------------------------------
// C-16 Phase C Step 5 — the bookings view/filter predicates, in SQL.
//
// `filterBookings` (page.tsx) stays the semantic ORACLE: it still runs the
// therapist-scoped branch, and `__tests__/view-predicates-parity.test.ts`
// asserts that the plan built here selects exactly the rows it selects across
// a 20-case fixture set covering all 11 views. Where the two disagree, the
// plan below is wrong — never the oracle.
//
// COUNT/RANGE DIVERGENCE IS STRUCTURAL, NOT MERELY TESTED FOR. One
// `BookingPredicateContext` is resolved once per request in
// `getBookingsListPage`, handed to `buildBookingPredicatePlan` once, and the
// resulting `{ embeds, steps }` drives BOTH the `.range()` row query and the
// `count: "exact", head: true` query through the same `bookingSelectWith`
// + `applyBookingPredicates` pair. There is no second place a predicate can
// be written, so the pager's total cannot describe a different WHERE clause
// than the rows it counts.
//
// JOINS: the oracle's `booking_assignments.some(...)` / `booking_items.some(...)`
// checks become PostgREST aliased `!inner` filter embeds
// (`fv:booking_assignments!inner(id)` + `.eq("fv.<col>", …)`), which is an
// EXISTS against that table. Two reasons for the alias rather than filtering
// the rendered embed directly:
//  1. filtering `booking_assignments(...)` itself would also truncate the
//     array BookingCard renders (a group booking filtered by one therapist
//     would render as if it had one assignment).
//  2. filters sharing ONE alias must all hold on the SAME joined row — that is
//     PostgREST's documented embedded-filter semantic, and it is the wrong
//     shape for independent `.some(...)` calls (e.g. `view=assigned` combined
//     with `assigned_staff=<somebody else>`), so each independent `.some(...)`
//     gets its own alias.
//
// Verified read-only against the live PostgREST instance before shipping
// (count-only `head: true` probes): aliased duplicate embeds, conjunctive
// filters on one alias, repeated `.or(...)`, `not.is.null` inside `.or(...)`,
// `client_id.in.(…)` inside `.or(...)`, and `.in("id", [])`.
//
// KNOWN NARROWING vs the in-memory oracle, both inherited from the oracle
// testing `[a, b, c].join(" ").includes(term)` rather than per-field:
//  - `search` on a booking id is a full-UUID equality match; a partial id
//    fragment no longer matches. Postgres has no `uuid ILIKE text` operator
//    and PostgREST has no cast syntax in filter params — the same wall
//    `audit/queries.ts:129-134` documents and answers the same way.
//  - a `search`/`location` term that spans two fields' boundary in that
//    joined string (e.g. "smith john@") matched the concatenation and does
//    not match any single column.
// Both are pinned as explicit divergence cases in the parity spec so a future
// change cannot widen them unnoticed.
// ---------------------------------------------------------------------------

/** `["cancelled","no_show"]` as a PostgREST `in` operand. */
const INERT_STATUS_FILTER = '("cancelled","no_show")';

/**
 * Filter-only embeds. The key is the PostgREST alias, the value the table it
 * joins. One alias per independent `.some(...)` in the oracle.
 */
export const BOOKING_FILTER_EMBEDS = {
  /** The view's own EXISTS on assignments (`assigned` / `claimable`). */
  fv: "booking_assignments",
  /** `required_gender` filter. */
  fg: "booking_assignments",
  /** `assigned_staff` filter. */
  fa: "booking_assignments",
  /** `service` filter. */
  fs: "booking_items",
} as const;

export type BookingFilterAlias = keyof typeof BOOKING_FILTER_EMBEDS;

/** The query-string filters, normalised exactly as `filterBookings` reads them. */
export interface BookingListFilters {
  view: BookingViewKey;
  status?: string;
  assignmentStatus?: string;
  paymentStatus?: string;
  requiredGender?: string;
  service?: string;
  location?: string;
  assignedStaff?: string;
  from?: string;
  to?: string;
  search?: string;
  templateId?: string;
}

/**
 * Everything the SQL plan needs. JSON-safe throughout (strings, booleans and a
 * string[]) because it becomes part of the `unstable_cache` key of both the row
 * query and the count query — a filter that reached the query but not the key
 * would serve one view's rows under another view's entry.
 */
export interface BookingPredicateContext extends BookingListFilters {
  /** `getTodayIsoDate()`, resolved by the caller so it reaches the cache key. */
  today: string;
  staffId: string;
  staffGender: string;
  canClaim: boolean;
  /** Client ids matching `search`, resolved once — see `getSearchClientIds`. */
  searchClientIds: string[];
}

export type BookingPredicateStep =
  | { op: "eq" | "neq" | "gte" | "lte"; column: string; value: string }
  | { op: "in"; column: string; values: string[] }
  | { op: "isNull"; column: string }
  | { op: "notIn"; column: string; value: string }
  | { op: "notNull"; column: string }
  | { op: "or"; filters: string };

export interface BookingPredicatePlan {
  embeds: BookingFilterAlias[];
  steps: BookingPredicateStep[];
}

// Mirrors `escapeLike`/`quoteOrValue` in enquiries-data.ts and emails-data.ts —
// duplicated per data module there, kept duplicated here for the same reason
// (each module owns its own PostgREST string handling).
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function quoteOrValue(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * The SQL twin of `filterBookings`. Order mirrors that function top to bottom:
 * the C-05 archive exclusion, then the view predicate, then the post-view
 * filters.
 */
export function buildBookingPredicatePlan(
  ctx: BookingPredicateContext
): BookingPredicatePlan {
  const embeds: BookingFilterAlias[] = [];
  const steps: BookingPredicateStep[] = [];

  // NB: not named `use` — eslint's rules-of-hooks reads that as React's `use`.
  const embed = (alias: BookingFilterAlias) => {
    if (!embeds.includes(alias)) embeds.push(alias);
    return alias;
  };
  const eq = (column: string, value: string) =>
    steps.push({ op: "eq", column, value });
  const neq = (column: string, value: string) =>
    steps.push({ op: "neq", column, value });
  const gte = (column: string, value: string) =>
    steps.push({ op: "gte", column, value });
  const lte = (column: string, value: string) =>
    steps.push({ op: "lte", column, value });
  const or = (filters: string) => steps.push({ op: "or", filters });
  const notInert = () =>
    steps.push({ op: "notIn", column: "status", value: INERT_STATUS_FILTER });

  // 1 — C-05 Phase D's archive exclusion (the early return in filterBookings):
  // every view but cancelled/all/series hides cancelled + no_show unless the
  // operator explicitly picked one of those two statuses.
  const userWantsInertStatus =
    ctx.status === "cancelled" || ctx.status === "no_show";
  const viewIsArchive =
    ctx.view === "cancelled" || ctx.view === "all" || ctx.view === "series";
  if (!viewIsArchive && !userWantsInertStatus) notInert();

  // 2 — the view predicate.
  switch (ctx.view) {
    case "all":
      break;
    case "attention":
      or(
        [
          "status.eq.pending",
          "assignment_status.neq.fully_assigned",
          "reschedule_status.eq.requested",
          "customer_cancelled_at.not.is.null",
        ].join(",")
      );
      break;
    case "assigned":
      eq(`${embed("fv")}.assigned_staff_id`, ctx.staffId);
      break;
    case "claimable":
      // `hasClaimableAssignment` returns false outright without the permission.
      if (!ctx.canClaim) {
        steps.push({ op: "in", column: "id", values: [] });
        break;
      }
      // Repeated on purpose even when rule 1 already excluded them: the C-05
      // lockdown invariant is that claimable is unconditionally strict, and it
      // must not become contingent on the shape of the archive rule above.
      notInert();
      gte("booking_date", ctx.today);
      eq(`${embed("fv")}.status`, "unassigned");
      steps.push({ op: "isNull", column: "fv.assigned_staff_id" });
      eq("fv.required_therapist_gender", ctx.staffGender);
      break;
    case "today":
      eq("booking_date", ctx.today);
      break;
    case "upcoming":
      gte("booking_date", ctx.today);
      neq("status", "completed");
      break;
    case "unassigned":
      eq("assignment_status", "unassigned");
      break;
    case "partially_assigned":
      eq("assignment_status", "partially_assigned");
      break;
    case "completed":
      eq("status", "completed");
      break;
    case "cancelled":
      steps.push({ op: "in", column: "status", values: ["cancelled", "no_show"] });
      break;
    case "series":
      if (ctx.templateId) eq("recurring_template_id", ctx.templateId);
      else steps.push({ op: "notNull", column: "recurring_template_id" });
      break;
  }

  // 3 — post-view filters, in filterBookings' order.
  if (ctx.status) eq("status", ctx.status);
  if (ctx.assignmentStatus) eq("assignment_status", ctx.assignmentStatus);
  if (ctx.paymentStatus) eq("payment_status", ctx.paymentStatus);
  if (ctx.from) gte("booking_date", ctx.from);
  if (ctx.to) lte("booking_date", ctx.to);
  if (ctx.requiredGender) {
    eq(`${embed("fg")}.required_therapist_gender`, ctx.requiredGender);
  }
  if (ctx.service) eq(`${embed("fs")}.service_name_snapshot`, ctx.service);
  if (ctx.assignedStaff) eq(`${embed("fa")}.assigned_staff_id`, ctx.assignedStaff);
  if (ctx.location) {
    const needle = quoteOrValue(`%${escapeLike(ctx.location)}%`);
    or(
      [
        `service_city.ilike.${needle}`,
        `service_postcode.ilike.${needle}`,
        `service_address_line1.ilike.${needle}`,
      ].join(",")
    );
  }
  if (ctx.search) {
    const needle = quoteOrValue(`%${escapeLike(ctx.search)}%`);
    const arms = [
      `contact_full_name.ilike.${needle}`,
      `contact_email.ilike.${needle}`,
      `contact_phone.ilike.${needle}`,
      `service_postcode.ilike.${needle}`,
    ];
    // Full UUID only — see the KNOWN NARROWING note at the top of this section.
    if (isUuid(ctx.search)) arms.push(`id.eq.${ctx.search}`);
    // The oracle's `clients.full_name/email/phone` arms, pre-resolved to ids.
    if (ctx.searchClientIds.length > 0) {
      arms.push(`client_id.in.(${ctx.searchClientIds.join(",")})`);
    }
    or(arms.join(","));
  }

  return { embeds, steps };
}

/**
 * ITEM K.1 — the therapist-scoped branch's PRE-CAP narrowing.
 *
 * That branch resolves an id set first and cannot be `.range()`d, so its caps
 * used to bite before any filter ran: a therapist could not narrow their way to
 * an old booking, because the rows were already gone. These steps run in the
 * SQL that fetches the candidate rows, so from/to/status narrow FIRST.
 *
 * It is the same builder, not a second implementation of it. `view: "all"` is
 * the one view that emits no view predicate (`case "all"` breaks immediately)
 * and no archive rule (`viewIsArchive` covers it), so what comes back is
 * exactly the post-view filter section — status, assignment, payment, from, to,
 * required gender, service and assigned staff. `filterBookings` stays the
 * oracle and re-applies all of them downstream; this only stops the caps from
 * discarding matches before it gets to look.
 *
 * ⛔ `search` and `location` are withheld on purpose, for two independent
 * reasons that agree. First, they are the two KNOWN NARROWING cases documented
 * above: both test a joined string in the oracle and separate columns in SQL,
 * and `search` on a partial booking id cannot round-trip at all. A predicate
 * that is NARROWER than the oracle must not run before it, or rows the page
 * would have shown are dropped where nothing can recover them. Second,
 * `search` expands to `client_id.in.(…)` carrying up to `SEARCH_CLIENT_ID_CAP`
 * ids — ~7.4 kB — which cannot share a URL with a candidate id array. Both
 * still filter, in memory, exactly as they always have.
 */
export function buildScopedPreCapPlan(
  ctx: BookingPredicateContext
): BookingPredicatePlan {
  return buildBookingPredicatePlan({
    ...ctx,
    view: "all",
    location: undefined,
    search: undefined,
  });
}

/**
 * The same steps again, re-aimed at the CANDIDATE read (ITEM K.1).
 *
 * That read's rows are `booking_assignments`, not `bookings`, so every plain
 * booking column has to travel through a `bookings!inner` embed and be named
 * `bookings.<column>`. The claimable half a few lines below has filtered this
 * way since C-05, so the idiom is the file's own.
 *
 * Only plain columns come across. A step whose column already carries a dot is
 * an `fg`/`fs`/`fa` filter-embed alias that exists solely on the `bookings`
 * query and has no meaning here, and `or` steps cannot appear at all because
 * `buildScopedPreCapPlan` withholds the only two filters that emit them. Both
 * are dropped rather than translated — they still run on the row read, and on
 * the oracle after it.
 */
function candidateStepsFor(
  ctx: BookingPredicateContext
): BookingPredicateStep[] {
  return buildScopedPreCapPlan(ctx)
    .steps.filter((step) => "column" in step && !step.column.includes("."))
    .map((step) =>
      "column" in step ? { ...step, column: `bookings.${step.column}` } : step
    );
}

/** Structural minimum of a PostgREST filter builder. */
export interface BookingsFilterBuilder {
  eq(column: string, value: unknown): BookingsFilterBuilder;
  neq(column: string, value: unknown): BookingsFilterBuilder;
  gte(column: string, value: unknown): BookingsFilterBuilder;
  lte(column: string, value: unknown): BookingsFilterBuilder;
  in(column: string, values: readonly string[]): BookingsFilterBuilder;
  is(column: string, value: null): BookingsFilterBuilder;
  not(column: string, operator: string, value: unknown): BookingsFilterBuilder;
  or(filters: string): BookingsFilterBuilder;
}

/**
 * Replays a plan's steps onto a query builder — the only consumer of a step,
 * and the reason the row query and the count query cannot carry different
 * WHERE clauses.
 *
 * `Q` is deliberately unconstrained. Constraining it to `BookingsFilterBuilder`
 * makes tsc compare that interface against `PostgrestFilterBuilder`'s parsed-
 * select generics and give up with TS2589 ("type instantiation is excessively
 * deep"). The cast below is the price; `Q` flows straight back out, so callers
 * keep `.order()`/`.range()`/`.returns()` on the concrete builder, and every
 * method named in the interface above is exercised by the parity spec against
 * a recording stand-in.
 */
export function applyBookingPredicates<Q>(
  query: Q,
  steps: readonly BookingPredicateStep[]
): Q {
  let next = query as unknown as BookingsFilterBuilder;
  for (const step of steps) {
    switch (step.op) {
      case "eq":
        next = next.eq(step.column, step.value);
        break;
      case "neq":
        next = next.neq(step.column, step.value);
        break;
      case "gte":
        next = next.gte(step.column, step.value);
        break;
      case "lte":
        next = next.lte(step.column, step.value);
        break;
      case "in":
        next = next.in(step.column, step.values);
        break;
      case "isNull":
        next = next.is(step.column, null);
        break;
      case "notIn":
        next = next.not(step.column, "in", step.value);
        break;
      case "notNull":
        next = next.not(step.column, "is", null);
        break;
      case "or":
        next = next.or(step.filters);
        break;
    }
  }
  return next as unknown as Q;
}

/** Appends the plan's filter-only embeds to a select string. */
export function bookingSelectWith(
  select: string,
  embeds: readonly BookingFilterAlias[]
): string {
  if (embeds.length === 0) return select;
  const joins = embeds
    .map((alias) => `${alias}:${BOOKING_FILTER_EMBEDS[alias]}!inner(id)`)
    .join(",");
  return `${select},${joins}`;
}

/**
 * Query-string → filters, reading exactly the params `filterBookings` reads
 * and normalising them the same way (trim + lowercase on the two substring
 * filters). Empty values become `undefined` so they drop out of the cache key
 * instead of splitting it.
 */
export function bookingListFiltersFromQuery(
  query: Record<string, string | string[] | undefined>,
  currentView: BookingViewKey
): BookingListFilters {
  const value = (key: string) => {
    const raw = query[key];
    const single = Array.isArray(raw) ? raw[0] : raw;
    return single && single.length > 0 ? single : undefined;
  };
  const lowered = (key: string) => value(key)?.trim().toLowerCase() || undefined;

  return {
    view: currentView,
    status: value("status"),
    assignmentStatus: value("assignment_status"),
    paymentStatus: value("payment_status"),
    requiredGender: value("required_gender"),
    service: value("service"),
    location: lowered("location"),
    assignedStaff: value("assigned_staff"),
    from: value("from"),
    to: value("to"),
    search: lowered("search"),
    templateId: value("templateId"),
  };
}

/**
 * Cap on the ASSIGNED candidate id read (ITEM K.1).
 *
 * `assignedIds` is serialised into `.in("id", …)` on a `BOOKING_SELECT` query
 * (1,079 characters once postgrest-js strips its whitespace), and each id adds
 * 37 more. The measured GET is ~1.75 kB empty, ~6.6 kB at 125 ids, ~7.6 kB at
 * 150 and ~9.5 kB at 200. That arithmetic is right.
 *
 * ⛔ THE CEILING IT WAS COMPARED AGAINST WAS NOT. An earlier version of this
 * comment put it at "a ~8 kB nginx request-line ceiling" and predicted a 414.
 * Measured 2026-08-13 against the live instance: a 24,918-byte request target
 * is accepted and reaches Postgres, and 25,473 bytes returns HTTP **400** —
 * not 414 — from the Supabase gateway, which sits behind Cloudflare and is not
 * nginx. Roughly 605 ids fit under that limit with this select. Do not re-derive
 * a cap from the 8 kB figure; it does not exist.
 *
 * 125 is therefore ~5x more conservative than the transport needs, and is KEPT
 * anyway. The busiest therapist holds 2 lifetime assignment rows, so nothing is
 * being lost — and raising this alone would only hand the truncation to
 * `SCOPED_BRANCH_ROW_CAP` (200) below while fetching hundreds of fully-embedded
 * rows to render 25. Raise the two together or neither. `SEARCH_CLIENT_ID_CAP`
 * further down bounds a URL for the same reason.
 *
 * ⚠️ The measurement was taken from a developer host. Production reaches
 * Supabase from a Cloudflare Worker, whose own outbound URL limit is NOT
 * verified here — one more reason not to spend the headroom on spec.
 *
 * Ordered because Postgres gives no ordering guarantee to a bare `limit`, and
 * `created_at` alone is not a total order — one booking writes one assignment
 * row per participant in a single transaction, and `now()` is transaction
 * time, so those rows share a timestamp exactly. `id` breaks the tie. That
 * makes the cap DETERMINISTIC: the same practitioner sees the same set twice.
 *
 * ⛔ It does NOT make it chronological, and an earlier draft of this comment
 * claimed it did. `created_at` is when the assignment row was written, which
 * for a recurring series is when `extend-recurring-horizons` materialised that
 * occurrence on its rolling 12-week horizon — so a live series' NEWEST rows are
 * its FARTHEST-FUTURE dates, not its nearest. Ordering by it therefore says
 * nothing about `booking_date`, and the residual selection when the cap binds
 * is arbitrary with respect to when the work actually happens. PostgREST
 * cannot order a parent by an embedded column, so there is no cheap way to
 * order this read by `booking_date` at all.
 *
 * What makes that survivable is that the request's own date and status filters
 * now run INSIDE this read, through `bookings!inner` — so from/to genuinely
 * reaches past the cap instead of merely re-narrowing whatever it happened to
 * keep. Targeting a period is the supported way to an old booking. The
 * structural repair is still a windowed history view — see the plan's ITEM K.1.
 *
 * The CLAIMABLE read below is deliberately left uncapped: it is already
 * narrowed in SQL to future-dated, non-cancelled, unassigned, gender-matched
 * rows, and `dashboard/page.tsx` reads `claimableIds.length` as a COUNT — a cap
 * there would silently understate that badge.
 */
const SCOPED_CANDIDATE_ID_CAP = 125;

// Exported (C-FIELDWORK Phase D, brief §9.4 locked decision) — dashboard/page.tsx
// reuses this exact gender-matched claimable-scoping logic for the
// practitioner-mode Owner/Coordinator's claimableCount. Behaviour unchanged.
export async function getScopedBookingIds(
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>,
  /**
   * ITEM K.1 — the request's own booking predicates, applied to the CANDIDATE
   * read. This argument is the whole point of the fix: the cap below is the
   * first thing that runs, so a filter applied any later can only narrow what
   * the cap already chose and can never reach back past it. Omitted (the
   * dashboard's count call) means "no narrowing", exactly as before.
   */
  predicates?: BookingPredicateContext
) {
  const adminClient = createSupabaseAdminClient();
  const assignedQuery = applyBookingPredicates(
    adminClient
      .from("booking_assignments")
      // The embed is unconditional so the select stays a literal the Supabase
      // type parser can read. It cannot change the result: `booking_id` is
      // `not null references bookings(id) on delete cascade`, so every
      // assignment row has exactly one booking and the inner join drops none.
      .select("booking_id, bookings!inner(id)")
      .eq("assigned_staff_id", profile.id),
    predicates ? candidateStepsFor(predicates) : []
  );
  const { data: assignedRows } = await assignedQuery
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(SCOPED_CANDIDATE_ID_CAP);

  // C-05 Phase C (edit point 5) — the `bookings!inner` join + status/date
  // filters keep cancelled, no_show, and past-dated bookings out of
  // `claimableIds` at the source, rather than relying solely on the
  // in-memory `filterBookings` pass below for defense-in-depth.
  const todayISO = getTodayIsoDate();
  const claimableRows = canClaimAssignments(profile)
    ? (
        await adminClient
          .from("booking_assignments")
          .select("booking_id, bookings!inner(status, booking_date)")
          .eq("status", "unassigned")
          .is("assigned_staff_id", null)
          .eq("required_therapist_gender", profile.gender)
          .not("bookings.status", "in", '("cancelled","no_show")')
          .gte("bookings.booking_date", todayISO)
          // ITEM K.1 — this array feeds `.in()` on a CLAIMABLE_BOOKING_SELECT
          // query too, so it carries the same request-line ceiling as the
          // assigned half and needs the same bound. It is already narrowed to
          // future-dated, non-cancelled, unassigned, gender-matched rows, so it
          // is far smaller in practice — but "smaller in practice" is what the
          // assigned half's original comment said as well.
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(SCOPED_CANDIDATE_ID_CAP)
      ).data ?? []
    : [];

  return {
    assignedIds: Array.from(
      new Set((assignedRows ?? []).map((assignment) => assignment.booking_id as string))
    ),
    claimableIds: Array.from(
      new Set((claimableRows ?? []).map((assignment) => assignment.booking_id as string))
    ),
  };
}

function normalizeClaimableBooking(booking: Partial<BookingRecord>): BookingRecord {
  return {
    id: booking.id ?? "",
    booking_date: booking.booking_date ?? "",
    start_time: booking.start_time ?? "",
    end_time: booking.end_time ?? "",
    total_duration_mins: booking.total_duration_mins ?? null,
    total_price: null,
    travel_fee: null,
    contact_full_name: "Claimable booking",
    contact_email: "",
    contact_phone: "",
    booking_source: booking.booking_source ?? "",
    amount_due: null,
    amount_paid: null,
    paid_at: null,
    payment_note: null,
    status: booking.status ?? "pending",
    payment_status: "unpaid",
    payment_method: null,
    assignment_status: booking.assignment_status ?? "unassigned",
    group_booking: booking.group_booking ?? false,
    service_address_line1: null,
    service_address_line2: null,
    service_city: null,
    service_postcode: null,
    access_notes: null,
    consent_acknowledged: false,
    customer_notes: null,
    health_notes: null,
    customer_manage_notes: null,
    cancelled_at: booking.cancelled_at ?? null,
    customer_cancelled_at: booking.customer_cancelled_at ?? null,
    customer_cancellation_note: null,
    last_customer_manage_action_at: null,
    reschedule_requested_at: null,
    reschedule_preferred_date: null,
    reschedule_preferred_time: null,
    reschedule_note: null,
    reschedule_status: booking.reschedule_status ?? "none",
    admin_notes: null,
    treatment_notes: null,
    created_at: booking.created_at ?? "",
    recurring_template_id: booking.recurring_template_id ?? null,
    clients: null,
    booking_participants: (booking.booking_participants ?? []).map((participant) => ({
      id: participant.id,
      participant_gender: participant.participant_gender,
      required_therapist_gender: participant.required_therapist_gender,
      is_main_contact: participant.is_main_contact,
      display_name: null,
      participant_notes: null,
      health_notes: null,
      consent_acknowledged: participant.consent_acknowledged,
    })),
    booking_items: (booking.booking_items ?? []).map((item) => ({
      id: item.id,
      booking_participant_id: item.booking_participant_id,
      service_name_snapshot: item.service_name_snapshot,
      service_price_snapshot: 0,
      service_duration_snapshot: item.service_duration_snapshot,
    })),
    booking_assignments: booking.booking_assignments ?? [],
  };
}

export interface BookingsChromeData {
  services: { slug: string; name: string }[];
  staff: { id: string; name: string }[];
}

/** Filter-dropdown options. Only the clinic-wide view renders them. */
export async function getBookingsChromeData(
  canViewAll: boolean
): Promise<BookingsChromeData> {
  const cached = unstable_cache(
    async (): Promise<BookingsChromeData> => {
      if (!canViewAll) return { services: [], staff: [] };
      const adminClient = createSupabaseAdminClient();
      const [{ data: services }, { data: staff }] = await Promise.all([
        adminClient
          .from("services")
          .select("slug, name")
          .eq("is_active", true)
          .order("name"),
        adminClient
          .from("staff_profiles")
          .select("id, name")
          .eq("active", true)
          .order("name"),
      ]);
      return {
        services: (services ?? []) as { slug: string; name: string }[],
        staff: (staff ?? []) as { id: string; name: string }[],
      };
    },
    ["bookings-chrome", cacheKeyPart({ canViewAll })],
    { revalidate: 60, tags: [TAGS.BOOKINGS, TAGS.CLIENTS, TAGS.STAFF] }
  );
  return cached();
}

/**
 * Defensive per-branch cap on the therapist-scoped reads (C-16 Phase C Step 5).
 * That branch is a union of two id-bounded reads merged in memory, so it cannot
 * be `.range()`d per query — but it also cannot legitimately approach this
 * number: one practitioner's own assignments plus the open, gender-matched,
 * future-dated slots they may claim is a working set of tens, not hundreds. The
 * cap exists so a data anomaly degrades into a truncated list rather than an
 * unbounded fetch.
 *
 * ⚠️ ITEM K.1 — this is now a backstop behind a backstop, and cannot bind.
 * Both id arrays are capped upstream at `SCOPED_CANDIDATE_ID_CAP` (125) and
 * the filter-only embeds do not multiply rows, so neither read can return 200.
 * Kept because it costs nothing and still bounds the fetch if that upstream cap
 * is ever raised past it; do not read it as the thing protecting these queries.
 */
const SCOPED_BRANCH_ROW_CAP = 200;

export interface BookingsListParams {
  /** Closure-only: never keyed, never returned (carries a permissions Set). */
  profile: Profile;
  canViewAll: boolean;
  limit?: number;
  offset?: number;
  /**
   * C-16 Step 5 — view/filter predicates. Absent means "no predicates" (the
   * pre-Step-5 read).
   *
   * The clinic-wide branch applies the whole plan and is filtered by it.
   * ITEM K.1 — the scoped branch now applies `buildScopedPreCapPlan`'s subset
   * too, so its caps stop discarding rows the request had already excluded.
   * It is a PRE-narrowing, not a filter: `filterBookings` remains that branch's
   * oracle and still runs over whatever comes back.
   */
  predicates?: BookingPredicateContext;
}

/**
 * The bookings list, in the same order and shape page.tsx built inline. Errors
 * are NOT swallowed — page.tsx keeps its try/catch and its "Couldn't load
 * bookings" panel, and a rejected fetch is never cached.
 */
export async function getBookingsListData(
  params: BookingsListParams
): Promise<BookingRecord[]> {
  const { profile, canViewAll, limit, offset, predicates } = params;
  const canClaim = canClaimAssignments(profile);
  const plan = predicates ? buildBookingPredicatePlan(predicates) : null;

  const cached = unstable_cache(
    async (): Promise<BookingRecord[]> => {
      const adminClient = createSupabaseAdminClient();
      const scopedIds = canViewAll
        ? null
        : await getScopedBookingIds(profile, predicates);
      const claimableOnlyIds =
        scopedIds?.claimableIds.filter((id) => !scopedIds.assignedIds.includes(id)) ?? [];

      if (canViewAll) {
        let query = applyBookingPredicates(
          adminClient
            .from("bookings")
            .select(bookingSelectWith(BOOKING_SELECT, plan?.embeds ?? [])),
          plan?.steps ?? []
        )
          .order("booking_date", { ascending: false })
          .order("start_time", { ascending: false })
          // Tiebreak (plan §4) — two bookings sharing a date and start time
          // would otherwise order non-deterministically, which at a page
          // boundary shows one row twice and drops another.
          .order("id", { ascending: false });
        if (limit !== undefined) {
          const start = offset ?? 0;
          query = query.range(start, start + limit - 1);
        }
        return (await query.returns<BookingRecord[]>()).data ?? [];
      }

      // ITEM K.1 — the request's own filters, narrowing in SQL BEFORE the caps.
      const preCap = predicates ? buildScopedPreCapPlan(predicates) : null;

      return [
        ...(
          scopedIds?.assignedIds.length
            ? (
                await applyBookingPredicates(
                  adminClient
                    .from("bookings")
                    .select(bookingSelectWith(BOOKING_SELECT, preCap?.embeds ?? []))
                    .in("id", scopedIds.assignedIds),
                  preCap?.steps ?? []
                )
                  .order("booking_date", { ascending: false })
                  .order("start_time", { ascending: false })
                  .limit(SCOPED_BRANCH_ROW_CAP)
                  .returns<BookingRecord[]>()
              ).data ?? []
            : []
        ),
        ...(
          claimableOnlyIds.length
            ? (
                await applyBookingPredicates(
                  adminClient
                    .from("bookings")
                    .select(bookingSelectWith(CLAIMABLE_BOOKING_SELECT, preCap?.embeds ?? []))
                    .in("id", claimableOnlyIds),
                  preCap?.steps ?? []
                )
                  .order("booking_date", { ascending: false })
                  .order("start_time", { ascending: false })
                  .limit(SCOPED_BRANCH_ROW_CAP)
                  .returns<Partial<BookingRecord>[]>()
              ).data?.map(normalizeClaimableBooking) ?? []
            : []
        ),
      ].sort((a, b) => (
        b.booking_date.localeCompare(a.booking_date) ||
        b.start_time.localeCompare(a.start_time)
      ));
    },
    [
      "bookings-list",
      cacheKeyPart({
        staffId: profile.id,
        staffGender: profile.gender,
        canViewAll,
        canClaim,
        limit,
        offset,
        // The predicates MUST reach the key, not just the query: two views
        // sharing one entry would serve the wrong rows under the right chrome.
        predicates,
      }),
    ],
    { revalidate: 60, tags: [TAGS.BOOKINGS, TAGS.CLIENTS, TAGS.STAFF] }
  );
  return cached();
}

/**
 * Cheap head-count companion for C-16's "Showing X-Y of Z" readout. Head
 * request - no rows transferred. Clinic-wide only.
 *
 * `predicates` is the SAME context object `getBookingsListData` receives, run
 * through the SAME `buildBookingPredicatePlan` — that is what keeps the total
 * describing the rows. Omitted, it counts the whole table.
 */
export async function countBookings(
  predicates?: BookingPredicateContext
): Promise<number> {
  const plan = predicates ? buildBookingPredicatePlan(predicates) : null;

  const cached = unstable_cache(
    async (): Promise<number> => {
      const adminClient = createSupabaseAdminClient();
      const { count, error } = await applyBookingPredicates(
        adminClient
          .from("bookings")
          .select(bookingSelectWith("id", plan?.embeds ?? []), {
            count: "exact",
            head: true,
          }),
        plan?.steps ?? []
      );
      if (error) return 0;
      return count ?? 0;
    },
    ["bookings-count", cacheKeyPart({ predicates })],
    { revalidate: 60, tags: [TAGS.BOOKINGS] }
  );
  return cached();
}

/**
 * The client ids whose name/email/phone match `search` — the SQL stand-in for
 * the oracle's `clients.full_name/email/phone` search arms, folded into the
 * booking query as one `client_id.in.(…)` operand.
 *
 * Resolved ONCE per request and passed into both the row and count queries, so
 * the two can never see different snapshots of it. Capped: a one-character
 * search must not put every client id in a URL.
 */
const SEARCH_CLIENT_ID_CAP = 200;

export async function getSearchClientIds(search?: string): Promise<string[]> {
  if (!search) return [];
  const cached = unstable_cache(
    async (): Promise<string[]> => {
      const needle = quoteOrValue(`%${escapeLike(search)}%`);
      const { data } = await createSupabaseAdminClient()
        .from("clients")
        .select("id")
        .or(
          [
            `full_name.ilike.${needle}`,
            `email.ilike.${needle}`,
            `phone.ilike.${needle}`,
          ].join(",")
        )
        .limit(SEARCH_CLIENT_ID_CAP)
        .returns<{ id: string }[]>();
      return (data ?? []).map((row) => row.id);
    },
    ["bookings-search-client-ids", cacheKeyPart({ search })],
    { revalidate: 60, tags: [TAGS.CLIENTS] }
  );
  return cached();
}

export type BookingsListPage = PaginatedResult<BookingRecord>;

/**
 * The request's predicate context — the filters plus everything the SQL plan
 * needs that only the server knows. Resolved ONCE and shared by the row query,
 * the head-count and (with `view` swapped) every chip count, which is what
 * stops any of them describing a different WHERE clause than the others.
 */
async function resolveBookingPredicateContext(
  profile: Profile,
  filters: BookingListFilters
): Promise<BookingPredicateContext> {
  return {
    ...filters,
    today: getTodayIsoDate(),
    staffId: profile.id,
    staffGender: profile.gender,
    canClaim: canClaimAssignments(profile),
    searchClientIds: await getSearchClientIds(filters.search),
  };
}

/**
 * The bookings list page's single entry point (C-16 Phase C Steps 5 + 7).
 *
 * Clinic-wide: builds ONE predicate context and hands it to both the paged row
 * query and the head-count, so `total` always describes `rows`' WHERE clause.
 * Therapist-scoped: the two id-bounded reads still merge in memory and
 * `filterBookings` still filters them at the page. ITEM K.1 — the request's
 * filters now narrow those reads in SQL first, but the result is still returned
 * as ONE page on purpose: `filterBookings` is that branch's view predicate and
 * runs downstream, so the window is taken at the page, after the oracle.
 * `getVisibleViewCounts` depends on getting the whole set back from here.
 */
export async function getBookingsListPage(params: {
  profile: Profile;
  canViewAll: boolean;
  filters: BookingListFilters;
  /** Raw `?page=` — parsed and clamped here, against the REAL page count. */
  page?: unknown;
  pageSize?: number;
}): Promise<BookingsListPage> {
  const { profile, canViewAll, filters } = params;
  const pageSize = params.pageSize ?? LIST_PAGE_SIZE;

  if (!canViewAll) {
    // ITEM K.1 — the filters now reach the SQL that resolves this branch's
    // rows, so they narrow before its caps instead of after.
    //
    // ⛔ Passing them also repairs the cache key. `cacheKeyPart` DROPS
    // undefined values, so while this call site sent `{ profile, canViewAll }`
    // the key collapsed to `{canClaim, canViewAll, staffGender, staffId}` —
    // one entry per therapist, shared by every filter combination they could
    // type. That was survivable only because the branch ignored the filters;
    // honouring them without keying them would serve one search's rows under
    // another's chrome, which is the exact hazard the key's own comment names.
    //
    // Still reported as a single page: the view predicate is `filterBookings`,
    // which runs downstream at the page, so a window taken here would be a
    // window of the wrong set. `BookingListSection` paginates after the oracle.
    const predicates = await resolveBookingPredicateContext(profile, filters);
    const rows = await getBookingsListData({ profile, canViewAll, predicates });
    return { rows, total: rows.length, page: 1, pageCount: 1 };
  }

  const predicates = await resolveBookingPredicateContext(profile, filters);

  // Sequential, not Promise.all: a stale `?page=99` can only be clamped once
  // the total is known, and fetching a window that then has to be discarded
  // costs a whole row query. Both halves are `unstable_cache`d on the same
  // tags, so the common path is two cache reads, not two round trips.
  const total = await countBookings(predicates);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = clampPage(params.page, pageCount);
  const { from } = pageRange(page, pageSize);

  const rows = await getBookingsListData({
    profile,
    canViewAll,
    limit: pageSize,
    offset: from,
    predicates,
  });

  return { rows, total, page, pageCount };
}

/**
 * The view chips `BookingsChrome` actually renders for this role.
 *
 * SECOND SOURCE, deliberately: the arrays live in `BookingsChrome.tsx`, which
 * is a `"use client"` module — a server component cannot read a value out of
 * one. `__tests__/booking-view-counts.test.ts` pins this list against those
 * arrays so the two cannot drift: a chip missing from here renders with no
 * count, and a view listed here that no chip renders is a wasted query.
 */
export function visibleBookingViews(canViewAll: boolean): BookingViewKey[] {
  return canViewAll
    ? [
        "attention",
        "today",
        "upcoming",
        "claimable",
        "assigned",
        "unassigned",
        "partially_assigned",
        "completed",
        "cancelled",
        "all",
        "series",
      ]
    : ["today", "upcoming", "claimable", "assigned", "completed"];
}

/**
 * C-16 Phase C Step 6 — one head-count per visible chip (clinic-wide scope).
 *
 * Each chip's number is `countBookings` over the request's own context with
 * ONLY `view` swapped, which is exactly the URL clicking that chip produces
 * (the chips carry every other filter across, and drop `page`). Because
 * `countBookings` runs that context through `buildBookingPredicatePlan`, the
 * chip count and the view's own list are the same predicate by construction —
 * there is no second place a chip's rule could be written.
 *
 * Fan-out: 11 chips clinic-wide, each a `count: "exact", head: true` query,
 * issued in parallel and cached on TAGS.BOOKINGS with the list. Measured at
 * implementation time on the live table: all 11 predicates together execute in
 * 0.596 ms / 13 shared buffers, so the Q9.5 fallback (active chip + total only)
 * was NOT taken.
 */
export async function getBookingViewCounts(params: {
  profile: Profile;
  filters: BookingListFilters;
  views: readonly BookingViewKey[];
}): Promise<Partial<Record<BookingViewKey, number>>> {
  const { profile, filters, views } = params;
  const base = await resolveBookingPredicateContext(profile, filters);

  const totals = await Promise.all(
    views.map((view) => countBookings({ ...base, view }))
  );

  const counts: Partial<Record<BookingViewKey, number>> = {};
  views.forEach((view, index) => {
    counts[view] = totals[index];
  });
  return counts;
}
