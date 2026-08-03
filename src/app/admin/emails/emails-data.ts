// SERVER ONLY — cached data helper for /admin/emails (C-09 Phase C Step 5).
//
// Permissions are resolved upstream in page.tsx and passed in: they decide
// WHICH queries run, and they are part of the cache key, so a coordinator-
// resend-only caller can never be served an entry built for someone with full
// email-log access. `staffId` is in the key too, because the therapist-scoped
// reminders path filters by the caller's own assignments.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is JSON-safe.
//  - `events`, `reminderBookings`, `templateStaff` are plain row arrays.
//  - `templateOverrideSummaries` is a Record of string fields.
//  - `deliveryError` is `{ message } | null` — already a plain object; kept in
//    that shape because DeliveryTab renders the message.
//  - TRANSFORM APPLIED: `templateStaff` is returned as an ARRAY of {id,name},
//    not the `Map` page.tsx builds from it (a Map re-hydrates as {}). page.tsx
//    also builds `lastReminderByBooking` from `events` — both Maps live on the
//    consumer side of the cache boundary.
//  - `businessDate` is passed IN as a `YYYY-MM-DD` string rather than being
//    computed inside the fetcher, so the "upcoming bookings" day boundary is
//    part of the cache key instead of being frozen for the revalidate window.
// No Set / Map / Date crosses the boundary.
//
// Tag: `emails`, per the plan's Step 5 table. The Reminders tab's upcoming-
// bookings list rides in the same entry, so a booking change that does not
// also set the emails tag can leave it trailing by at most the 60s revalidate
// window.
//
// PAGINATION-READY (C-16): optional `limit` + `offset` bound the delivery feed
// and flow into BOTH the query and the cache key, so page 2 can never be
// served page 1's rows. `limit` defaults to EMAILS_PAGE_SIZE (100) — the
// ceiling the page already used — so behaviour is unchanged.
//
// FILTERS (C-09 Phase D Step 11): `getFilteredDeliveryEvents` below is a
// second, focused fetcher that applies event_type/delivery_status/
// recipient_role/date-range/q as real query predicates, instead of the
// in-memory slice page.tsx used to run over the unfiltered top-100. It's
// separate from `getEmailsPageData` (not a new parameter on it) because the
// reminders/templates data that function also loads doesn't vary with the
// delivery filters, and re-running the whole thing per filter combination
// would be wasteful; this fetcher owns only the delivery-events query and
// its own cache entry, tagged and keyed the same way. page.tsx still calls
// `getEmailsPageData` once, unfiltered, for the totalLoaded/failedRecent
// badge/reminders/templates — those always reflect the same top-100 read
// regardless of the delivery filters, same as before this step.
//
// PAGER (C-16 Phase D Step 9): `countEmailDeliveryEvents` and
// `getFilteredDeliveryEvents` both build their WHERE clause through the same
// `applyDeliveryPredicates` helper, and both resolve the date-range preset
// through the same `resolveDeliveryDateBounds` — so a caller can never get a
// total that describes a different query than the rows it's paginating.
// `getEmailDeliveryPage` is the single entry point that ties count → clamp →
// range together (mirrors `getBookingsListPage` in bookings-list-data.ts);
// page.tsx calls it instead of `getFilteredDeliveryEvents` directly.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";
import { getTemplateOverrideSummaries } from "@/lib/email/templates";
import {
  LOG_PAGE_SIZE,
  clampPage,
  pageRange,
  type PaginatedResult,
} from "@/lib/pagination";
import type { DateRangePresetKey } from "./format";

export const EMAILS_PAGE_SIZE = 100;

const DELIVERY_SELECT =
  "id, booking_id, staff_id, event_type, recipient_email, recipient_role, delivery_status, provider_message_id, error_message, created_at";

export interface EmailEvent {
  id: string;
  booking_id: string | null;
  staff_id: string | null;
  event_type: string;
  recipient_email: string | null;
  recipient_role: string | null;
  delivery_status: string;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ReminderBooking {
  id: string;
  booking_date: string;
  start_time: string;
  contact_full_name: string | null;
  contact_email: string | null;
  status: string;
}

export interface EmailTemplateStaffName {
  id: string;
  name: string;
}

export interface EmailsPageParams {
  /** `canViewEmailLogs(profile)` — gates the delivery feed. */
  canSeeDelivery: boolean;
  /** `canResendBookingEmails(profile)` — gates the reminders queue. */
  canResend: boolean;
  /** Owner/Admin/Coordinator see the whole clinic queue; a therapist does not. */
  canSeeAllBookings: boolean;
  /** Caller's staff id — scopes the therapist reminders path. */
  staffId: string;
  /** London business date (`YYYY-MM-DD`) — the upcoming-bookings floor. */
  businessDate: string;
  /** Only the Templates tab needs the override + staff-name lookups. */
  includeTemplates: boolean;
  limit?: number;
  offset?: number;
}

export interface EmailsPageData {
  events: EmailEvent[];
  deliveryError: { message: string } | null;
  reminderBookings: ReminderBooking[];
  templateOverrideSummaries: Record<
    string,
    { updatedAt: string; updatedBy: string | null }
  >;
  templateStaff: EmailTemplateStaffName[];
}

export async function getEmailsPageData(
  params: EmailsPageParams
): Promise<EmailsPageData> {
  const {
    canSeeDelivery,
    canResend,
    canSeeAllBookings,
    staffId,
    businessDate,
    includeTemplates,
  } = params;
  const limit = params.limit ?? EMAILS_PAGE_SIZE;
  const offset = params.offset ?? 0;

  const cached = unstable_cache(
    async (): Promise<EmailsPageData> => {
      const adminClient = createSupabaseAdminClient();

      type DeliveryResult = {
        data: EmailEvent[] | null;
        error?: { message: string } | null;
      };
      const deliveryPromise: Promise<DeliveryResult> = canSeeDelivery
        ? (adminClient
            .from("email_delivery_events")
            .select(DELIVERY_SELECT)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1)
            .returns<EmailEvent[]>() as unknown as Promise<DeliveryResult>)
        : Promise.resolve({ data: [] });

      // Reminders scope (H11 middle path). A therapist with
      // resend_booking_emails but only assigned-bookings view is scoped to
      // their own assignments — keeps client contact PII bounded to bookings
      // they're actually working on.
      let allowedReminderBookingIds: string[] | null = null;
      if (canResend && !canSeeAllBookings) {
        const { data: ownAssignments } = await adminClient
          .from("booking_assignments")
          .select("booking_id")
          .eq("assigned_staff_id", staffId)
          .limit(200);
        allowedReminderBookingIds = Array.from(
          new Set((ownAssignments ?? []).map((a) => a.booking_id).filter(Boolean))
        );
      }

      const remindersPromise = (() => {
        if (!canResend) return Promise.resolve({ data: [] as ReminderBooking[] });
        if (
          allowedReminderBookingIds !== null &&
          allowedReminderBookingIds.length === 0
        ) {
          return Promise.resolve({ data: [] as ReminderBooking[] });
        }
        let q = adminClient
          .from("bookings")
          .select(
            "id, booking_date, start_time, contact_full_name, contact_email, status"
          )
          .gte("booking_date", businessDate)
          .in("status", ["pending", "confirmed"])
          .order("booking_date")
          .order("start_time")
          .limit(20);
        if (allowedReminderBookingIds !== null) {
          q = q.in("id", allowedReminderBookingIds);
        }
        return q.returns<ReminderBooking[]>();
      })();

      // C-15 Phase E, Step 17 — gallery badge data. ONE grouped query plus one
      // companion query resolving `updated_by` ids to display names.
      const templateOverrideSummariesPromise = includeTemplates
        ? getTemplateOverrideSummaries()
        : Promise.resolve(
            {} as Record<string, { updatedAt: string; updatedBy: string | null }>
          );
      const templateStaffNamesPromise: Promise<{
        data: EmailTemplateStaffName[] | null;
      }> = includeTemplates
        ? (adminClient
            .from("staff_profiles")
            .select("id, name")
            .returns<EmailTemplateStaffName[]>() as unknown as Promise<{
            data: EmailTemplateStaffName[] | null;
          }>)
        : Promise.resolve({ data: [] });

      const [
        deliveryResult,
        remindersResult,
        templateOverrideSummaries,
        templateStaffNamesResult,
      ] = await Promise.all([
        deliveryPromise,
        remindersPromise,
        templateOverrideSummariesPromise,
        templateStaffNamesPromise,
      ]);

      return {
        events: deliveryResult.data ?? [],
        deliveryError:
          "error" in deliveryResult ? deliveryResult.error ?? null : null,
        reminderBookings: remindersResult.data ?? [],
        templateOverrideSummaries,
        templateStaff: templateStaffNamesResult.data ?? [],
      };
    },
    [
      "emails-page",
      cacheKeyPart({
        canSeeDelivery,
        canResend,
        canSeeAllBookings,
        staffId,
        businessDate,
        includeTemplates,
        limit,
        offset,
      }),
    ],
    { revalidate: 60, tags: [TAGS.EMAILS] }
  );
  return cached();
}

export interface EmailDeliveryFilters {
  event_type?: string;
  delivery_status?: string;
  recipient_role?: string;
  range?: DateRangePresetKey;
  /** `YYYY-MM-DD`, only read when `range === "custom"`. */
  from?: string;
  to?: string;
  /** Matched against recipient_email / provider_message_id / id. */
  q?: string;
}

export interface FilteredDeliveryParams {
  canSeeDelivery: boolean;
  filters: EmailDeliveryFilters;
  limit?: number;
  offset?: number;
}

export interface FilteredDeliveryData {
  events: EmailEvent[];
  deliveryError: { message: string } | null;
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

/**
 * Resolves the filter's date-range preset (or a custom from/to pair) to
 * concrete ISO bounds OUTSIDE the cached fetcher — same pattern as
 * `businessDate` above: resolved here, in the outer function, and passed
 * into both the query and the cache key, so the boundary never freezes for
 * the 60s revalidate window.
 *
 * C-16 Phase D Step 9: the preset branches floor to the UTC day boundary
 * (`todayStart` below) instead of reading `Date.now()` at millisecond
 * precision. Two defects that fixed: (a) the old ms-precision value was part
 * of the `unstable_cache` key, so the key changed on every single call and
 * this fetcher's cache never hit; (b) `countEmailDeliveryEvents` and
 * `getFilteredDeliveryEvents` each call this function independently — at
 * millisecond precision they could resolve `now` a moment apart and disagree
 * on the window, which would make the pager's total describe a different
 * WHERE clause than the rows it's paginating. A day boundary is the natural
 * granularity for a preset that's itself labelled in days ("today" /
 * "last 7 days" / "last 30 days"), and it's stable for the rest of the UTC
 * day regardless of which call resolves it or when within that day — so the
 * two calls can only disagree in the sub-second window that straddles UTC
 * midnight, an accepted, self-healing-on-navigation edge case (same category
 * as offset pagination's page-boundary risk elsewhere in this plan).
 *
 * Range semantics (fix round after C-16 Phase D Step 9): each preset means
 * "the N calendar days up to and including today", counting from
 * `todayStart` — NOT a rolling N×24h window from `now`. So "Today" is
 * `todayStart` itself (1 calendar day: today), "Last 7 days" is
 * `todayStart - 6 * day` (7 calendar days: today + 6 prior), and "Last 30
 * days" is `todayStart - 29 * day` (30 calendar days: today + 29 prior).
 * This is the conventional reading for dashboard date-range labels (e.g. GA)
 * and keeps all three presets internally consistent with each other and with
 * their labels in format.ts's `DATE_RANGE_PRESETS`.
 */
export function resolveDeliveryDateBounds(
  filters: EmailDeliveryFilters
): { fromIso?: string; toIso?: string } {
  if (filters.range === "custom") {
    // Raw, unvalidated URL params — validate before converting. A malformed
    // value silently falls back to "no bound" (same as no filter) rather than
    // throwing RangeError out of `.toISOString()` and 500ing the page.
    const fromMs = filters.from ? new Date(filters.from).getTime() : NaN;
    const toMs = filters.to ? new Date(filters.to).getTime() : NaN;
    return {
      fromIso: Number.isNaN(fromMs) ? undefined : new Date(fromMs).toISOString(),
      toIso: Number.isNaN(toMs)
        ? undefined
        : new Date(toMs + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  const day = 24 * 60 * 60 * 1000;
  const todayStart = Math.floor(Date.now() / day) * day;
  switch (filters.range) {
    case "today":
      return { fromIso: new Date(todayStart).toISOString() };
    case "last_7_days":
      return { fromIso: new Date(todayStart - 6 * day).toISOString() };
    case "last_30_days":
    default:
      return { fromIso: new Date(todayStart - 29 * day).toISOString() };
  }
}

/** Structural minimum of a PostgREST filter builder — see the note on
 *  `applyDeliveryPredicates` below for why `Q` stays unconstrained. */
interface DeliveryFilterBuilder {
  eq(column: string, value: string): DeliveryFilterBuilder;
  or(filters: string): DeliveryFilterBuilder;
  gte(column: string, value: string): DeliveryFilterBuilder;
  lte(column: string, value: string): DeliveryFilterBuilder;
}

/**
 * Applies event_type/delivery_status/recipient_role/q/date-bounds to a query
 * builder. The ONLY place this WHERE clause is built — `getFilteredDeliveryEvents`
 * (rows) and `countEmailDeliveryEvents` (total) both call this with the same
 * `filters`, so the pager's total cannot describe a different query than the
 * rows it's paginating (C-16 Phase D Step 9, same discipline Phase C's
 * `applyBookingPredicates` uses for bookings).
 *
 * `Q` is deliberately unconstrained, same reasoning as `applyBookingPredicates`
 * in bookings-list-data.ts: constraining it to `DeliveryFilterBuilder` makes
 * tsc compare that interface against `PostgrestFilterBuilder`'s parsed-select
 * generics and give up (TS2589). The cast below is the price; `Q` flows
 * straight back out, so callers keep `.order()`/`.range()`/`.returns()` on
 * the concrete builder.
 */
function applyDeliveryPredicates<Q>(
  query: Q,
  filters: EmailDeliveryFilters,
  fromIso: string | undefined,
  toIso: string | undefined
): Q {
  let next = query as unknown as DeliveryFilterBuilder;
  if (filters.event_type) next = next.eq("event_type", filters.event_type);
  if (filters.delivery_status) next = next.eq("delivery_status", filters.delivery_status);
  if (filters.recipient_role) next = next.eq("recipient_role", filters.recipient_role);
  if (filters.q) {
    const needle = quoteOrValue(`%${escapeLike(filters.q)}%`);
    next = next.or(
      [
        `recipient_email.ilike.${needle}`,
        `provider_message_id.ilike.${needle}`,
        `id.ilike.${needle}`,
      ].join(",")
    );
  }
  if (fromIso) next = next.gte("created_at", fromIso);
  if (toIso) next = next.lte("created_at", toIso);
  return next as unknown as Q;
}

/**
 * Cheap head-count companion for C-16's "Showing X–Y of Z" readout. Head
 * request — no rows transferred. Takes the SAME `filters` as
 * `getFilteredDeliveryEvents` and applies them through the SAME
 * `applyDeliveryPredicates`/`resolveDeliveryDateBounds` pair, so the total
 * this returns always describes the rows query's WHERE clause.
 */
export async function countEmailDeliveryEvents(
  filters: EmailDeliveryFilters = {}
): Promise<number> {
  const { fromIso, toIso } = resolveDeliveryDateBounds(filters);

  const cached = unstable_cache(
    async (): Promise<number> => {
      const adminClient = createSupabaseAdminClient();
      const query = applyDeliveryPredicates(
        adminClient
          .from("email_delivery_events")
          .select("id", { count: "exact", head: true }),
        filters,
        fromIso,
        toIso
      );
      const { count, error } = await query;
      if (error) return 0;
      return count ?? 0;
    },
    [
      "emails-delivery-count",
      cacheKeyPart({
        eventType: filters.event_type,
        deliveryStatus: filters.delivery_status,
        recipientRole: filters.recipient_role,
        q: filters.q,
        fromIso,
        toIso,
      }),
    ],
    { revalidate: 60, tags: [TAGS.EMAILS] }
  );
  return cached();
}

/**
 * Server-side delivery-feed query (C-09 Phase D Step 11). Applies
 * event_type/delivery_status/recipient_role/date-range/q as real predicates
 * instead of the in-memory slice page.tsx used to run over the top-100.
 */
export async function getFilteredDeliveryEvents(
  params: FilteredDeliveryParams
): Promise<FilteredDeliveryData> {
  const { canSeeDelivery, filters, limit = EMAILS_PAGE_SIZE, offset = 0 } = params;
  if (!canSeeDelivery) {
    return { events: [], deliveryError: null };
  }
  const { fromIso, toIso } = resolveDeliveryDateBounds(filters);

  const cached = unstable_cache(
    async (): Promise<FilteredDeliveryData> => {
      const adminClient = createSupabaseAdminClient();
      const query = applyDeliveryPredicates(
        adminClient
          .from("email_delivery_events")
          .select(DELIVERY_SELECT)
          .order("created_at", { ascending: false }),
        filters,
        fromIso,
        toIso
      ).range(offset, offset + limit - 1);

      const { data, error } = await query.returns<EmailEvent[]>();
      return {
        events: data ?? [],
        deliveryError: error ? { message: error.message } : null,
      };
    },
    [
      "emails-delivery-filtered",
      cacheKeyPart({
        eventType: filters.event_type,
        deliveryStatus: filters.delivery_status,
        recipientRole: filters.recipient_role,
        q: filters.q,
        fromIso,
        toIso,
        limit,
        offset,
      }),
    ],
    { revalidate: 60, tags: [TAGS.EMAILS] }
  );
  return cached();
}

export type EmailDeliveryPage = PaginatedResult<EmailEvent> & {
  deliveryError: { message: string } | null;
};

/**
 * The Delivery tab's single entry point (C-16 Phase D Step 9) — mirrors
 * `getBookingsListPage` in bookings-list-data.ts. Builds the total from
 * `countEmailDeliveryEvents(filters)`, clamps `?page=` against the REAL page
 * count, then fetches exactly that window from `getFilteredDeliveryEvents`.
 * Both calls resolve the SAME date bounds from the SAME `filters` through
 * `resolveDeliveryDateBounds` (see that function's doc), so `total` always
 * describes `rows`' WHERE clause.
 */
export async function getEmailDeliveryPage(params: {
  canSeeDelivery: boolean;
  filters: EmailDeliveryFilters;
  /** Raw `?page=` — parsed and clamped here, against the REAL page count. */
  page?: unknown;
  pageSize?: number;
}): Promise<EmailDeliveryPage> {
  const { canSeeDelivery, filters } = params;
  const pageSize = params.pageSize ?? LOG_PAGE_SIZE;

  if (!canSeeDelivery) {
    return { rows: [], total: 0, page: 1, pageCount: 1, deliveryError: null };
  }

  // Sequential, not Promise.all — same reasoning as getBookingsListPage: a
  // stale `?page=99` can only be clamped once the total is known, and
  // fetching a window that then has to be discarded costs a whole row query.
  const total = await countEmailDeliveryEvents(filters);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = clampPage(params.page, pageCount);
  const { from } = pageRange(page, pageSize);

  const { events, deliveryError } = await getFilteredDeliveryEvents({
    canSeeDelivery,
    filters,
    limit: pageSize,
    offset: from,
  });

  return { rows: events, total, page, pageCount, deliveryError };
}
