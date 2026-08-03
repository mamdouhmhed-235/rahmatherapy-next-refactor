// SERVER ONLY — cached data helper for /admin/clients/[clientId]
// (C-09 Phase C Step 5).
//
// Page access (getAdminPageAccess) is resolved upstream in page.tsx. The
// RBAC-derived flags come in as plain booleans rather than a StaffProfile,
// because `StaffProfile.permissions` is a `Set` and must never cross an
// `unstable_cache` boundary. Every flag is part of the cache key, so a
// narrower caller can never be served a wider caller's entry.
//
// Two flag SETS are passed because this surface derives its access twice: a
// therapist without clinic-wide client access is re-evaluated once we know
// whether they hold an assignment on this client's bookings. The helper
// returns `hasAssignedClientAccess` so page.tsx can re-derive the final
// `clientAccess` object itself, identically to before — that object is never
// cached.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is JSON-safe.
//  - `client`, `bookingHistory`, `sensitiveNotes`, `regularNotes`,
//    `privacyRequests`, `auditLogs` are plain rows / nested arrays of
//    scalars; `regularNotesTotal` is a number.
//  - `hasAssignedClientAccess` is a boolean.
//  - Every timestamp stays an ISO/date string. `isFutureBooking`'s
//    `new Date(...)` comparison and the "now" it compares against both run in
//    page.tsx, on the consumer side of the boundary.
//  - TRANSFORM APPLIED: none needed — no Set / Map / Date is returned. The
//    `new Set(...)` used to de-duplicate assignment ids lives inside the
//    fetcher and is consumed there.
//
// Tags per the plan's Step 5 table: clients, bookings, audit, emails.
//
// BOOKING-HISTORY BOUND (C-16 closeout). Until this round the rail accepted
// `limit`/`offset` that gated a `.range()` — and its only caller never passed
// them, so every render read a client's ENTIRE booking history. That plumbing
// is gone, replaced by the cap+view-all treatment this plan applies to every
// other rail: `CLIENT_BOOKING_HISTORY_LIMIT`, raised to
// `CLIENT_BOOKING_HISTORY_VIEW_ALL_CAP` by `historyViewAll`, with
// `bookingHistoryTotal` as a head-count over the SAME predicate (client scope,
// plus the assigned-ids narrowing on the therapist path) so
// `resolveClientBookingHistoryBannerState` can state what is missing. A
// `.range()` pager was rejected for this surface: the tabs and the status /
// service filters run in memory over the fetched rows, so a page window would
// be filtered AFTER slicing — a correct-looking page of the wrong bookings.
//
// THE RIBBON'S OWN READ. The LTV ribbon, the client-summary panel, the tab
// counts and the lifecycle badge are LIFETIME figures: bounding the rail alone
// would silently turn "Total paid" into "paid across the last 50 visits" —
// this plan's signature defect. So `lifetimeBookings` is a SECOND, separate
// read of the same client scope through `BOOKING_LIFETIME_SELECT`, a PII-free
// projection (no contact columns, no address line, no health notes, no
// participants) that exists only to be reduced into those figures by page.tsx;
// it is never rendered as a booking card. It carries `CLIENT_LIFETIME_SCAN_CAP`
// so it too is a bounded query, and `bookingHistoryTotal` is the head-count
// that would expose it if that ceiling ever bound. Rows rather than a
// pre-reduced summary cross the boundary here because `ClientLtvRibbon`'s prop
// contract takes booking rows and lives outside this fix's file scope; the
// projection is O(one client's bookings) and capped, not O(table).
//
// `countClientBookings` remains the standalone head-count companion; the count
// used by this fetcher is issued INSIDE it instead, so the total and the rows
// are built from the same scope in the same pass and cannot diverge on the
// therapist path.
//
// NOTES RAIL BOUND (C-16 Phase E Step 14, finding N6 — Owner-approved
// extension, per-page-progress §1 row 3 / §2). The old single `client_notes`
// query (`.eq("client_id", clientId)`, no `.limit()`/`.range()` of any kind)
// is split into THREE queries:
//   - `regularNotes` (`is_sensitive = false`) — real cap+view-all
//     (`CLIENT_NOTES_LIMIT` 25 / `CLIENT_NOTES_VIEW_ALL_CAP` 200), same shape
//     as privacy's sensitive-notes rail (C-16 Step 10): `regularNotesTotal`
//     is a head-count over the SAME `is_sensitive = false` predicate, so a
//     "hidden notes" banner in page.tsx can never disagree with what it
//     counts. `notesViewAll` flows into the query AND the cache key.
//   - `sensitiveNotes` (`is_sensitive = true`) — DISPLAY/PINNING RAIL ONLY,
//     now also a real cap+view-all (`CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP`
//     300 / `CLIENT_SENSITIVE_NOTES_VIEW_ALL_CAP` 3000), with
//     `sensitiveNotesTotal` as its own head-count over the SAME
//     `is_sensitive = true` predicate — the same honesty shape as
//     `regularNotes`, mirrored via `resolveClientSensitiveNotesBannerState`.
//     `sensitiveNotesViewAll` flows into the query AND the cache key.
//   - `criticalNote` — a SEPARATE, dedicated query for the clinical-safety
//     "Critical note" banner (verify-FAIL Check 1, C-16 Step 14 fix round).
//     Fixed round finding: the banner used to be `sensitiveNotes.find(note
//     => CRITICAL_NOTE_PATTERN.test(note.note))`, which meant a client with
//     more than `CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP` sensitive notes could
//     have an older flagged note silently drop out of the scan — the display
//     cap and the safety scan shared one bound, with zero signal if it was
//     ever hit. The fix: the safety scan gets its OWN query, scoped to
//     `is_sensitive = true` AND a SQL-side `ilike`-OR filter built from
//     `CRITICAL_NOTE_KEYWORDS` — a guaranteed SUPERSET of every branch in
//     `CRITICAL_NOTE_PATTERN` (see that constant's comment), ordered
//     newest-first. The exact regex is then re-applied in JS over that
//     already-narrow, already-complete-relative-to-the-predicate result to
//     pick the true most-recent match. Because this query is filtered BEFORE
//     it is capped (not capped-then-filtered, which was the bug), whatever
//     `sensitiveNotes` is capped at for DISPLAY purposes is now irrelevant to
//     the banner's correctness — the property the fix round asked for.
// page.tsx recombines `sensitiveNotes` with `regularNotes` for the rendered
// notes list, and reads `criticalNote` directly off this fetcher's result —
// see its own comment.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";
import type {
  ClientBookingRecord,
  ClientNoteRecord,
  ClientPrivacyRequestRecord,
  ClientRecord,
} from "../types";

export const CLIENT_NOTES_LIMIT = 25;
export const CLIENT_NOTES_VIEW_ALL_CAP = 200;

/**
 * The rendered booking-history rail's default cap (C-16 closeout). 50 rows is
 * roughly a year of weekly visits — comfortably past what anyone scrolls on a
 * profile, and the tabs above it already carry the LIFETIME counts, so nothing
 * a reader needs to know is hidden by it.
 */
export const CLIENT_BOOKING_HISTORY_LIMIT = 50;
/**
 * The rail's view-all cap: ~10 years of weekly visits. The brief's own worked
 * example — a long-tenured weekly client over five years — lands near 260, so
 * this is a real ceiling with the working case well inside it. Reaching it is
 * the signal to give this rail a proper pager, which needs the tab/status
 * filtering to move into SQL first.
 */
export const CLIENT_BOOKING_HISTORY_VIEW_ALL_CAP = 500;
/**
 * Defensive ceiling on the lifetime scan (see the file header). ~38 years of
 * weekly visits for ONE client: a bound no real record reaches, kept only so
 * this query is bounded like every other. If it ever binds, `bookingHistoryTotal`
 * exceeds the scanned length and page.tsx says so rather than quietly reporting
 * a partial lifetime figure — it is not given a view-all because there is no
 * honest wider read to offer, only a migration.
 */
export const CLIENT_LIFETIME_SCAN_CAP = 2000;
/** `sensitiveNotes`' "recent" cap — same default as before this fix round,
 *  so ordinary clients (today's observed max: 2) see no change. See the
 *  file header: this no longer bounds the safety scan, only the display
 *  rail, which is why it can now safely have a real view-all cap below it. */
export const CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP = 300;
/** `sensitiveNotes`' view-all cap, mirroring `CLIENT_NOTES_VIEW_ALL_CAP`'s
 *  role for `regularNotes`. An order of magnitude beyond the recent cap —
 *  reaching it would itself be a signal to revisit, same as every other
 *  view-all ceiling in this plan. */
export const CLIENT_SENSITIVE_NOTES_VIEW_ALL_CAP = 3000;

/**
 * Substrings that make `CRITICAL_NOTE_PATTERN` match somewhere in a note.
 * Every branch of that regex's alternation nests one of these literal
 * substrings, so this array is a guaranteed SUPERSET of the pattern: any
 * note the regex matches necessarily contains at least one of these
 * substrings too (a word-boundary match is always a substring match; the
 * converse need not hold — an over-inclusive SQL scan is safe for a safety
 * banner, an under-inclusive one is not). Used to build the SQL-side filter
 * for `criticalNote` below, so the safety scan's completeness never depends
 * on `CRITICAL_NOTE_PATTERN` being reproduced correctly as a Postgres regex.
 * Kept as a plain array, not derived from the regex mechanically, so an edit
 * to one is a visible diff next to the other — see the sync test in
 * `__tests__/client-detail-data.test.ts`.
 */
export const CRITICAL_NOTE_KEYWORDS = [
  "allerg",
  "anaphyla",
  "epipen",
  "contraindic",
  "urgent",
  "warning",
  "do not",
  "avoid",
] as const;

/** Matches a sensitive note that should surface the "Critical note" safety
 *  banner. Every alternation branch here must nest at least one entry from
 *  `CRITICAL_NOTE_KEYWORDS` above as a substring — see that constant's
 *  comment and the sync test.
 *
 *  PREFIX MATCH, NOT WHOLE-WORD (Owner-authorised widening, 2026-08-03): only
 *  the LEADING `\b` is kept — a match must still START at a word boundary —
 *  but there is no trailing `\b`, so each branch matches as a prefix of
 *  whatever follows. A trailing `\b` on the whole alternation made
 *  `anaphyla` and `contraindic` match only as standalone words, which they
 *  never are in real writing ("anaphylactic", "contraindicated"); those two
 *  branches were effectively dead. Prefix matching fixes that while the
 *  leading `\b` still keeps the pattern from firing inside an unrelated word
 *  (e.g. "insurgent" does not match the `urgent` branch — the "urgent"
 *  substring there isn't preceded by a boundary). `allerg` alone (dropping
 *  the old `(y|ic|ies)` group) still covers allergy/allergic/allergies as
 *  prefixes, plus now allergen/allergens/allergies.
 *
 *  ONE BRANCH IS EXEMPT (C-16 closeout). Dropping the trailing `\b` loosened
 *  `do not` along with the rest, and that branch alone inverts its own meaning
 *  as a prefix: "do nothing", "do notice", "do note" are ordinary, benign
 *  clinical phrasings that were tripping the patient-safety banner. It gets
 *  its own trailing `\b` back — inside the group, so the alternation stays the
 *  flat `\b(a|b|c)` shape the mechanical superset guard parses. The other
 *  branches keep prefix matching, deliberately: their extensions all preserve
 *  the clinical meaning ("allergen", "anaphylactic", "contraindicated",
 *  "urgently", "warnings", "avoiding"), and narrowing `avoid` in particular
 *  would lose "avoiding the left shoulder" — a false NEGATIVE on a safety
 *  banner, which this file's own header ranks as the worse failure. */
export const CRITICAL_NOTE_PATTERN =
  /\b(allerg|anaphyla|epipen|contraindic|urgent|warning|avoid|do not\b)/i;

function escapeLike(value: string) {
  // Escapes ILIKE's own wildcard characters so a keyword can only match
  // literally — mirrors emails-data.ts's `escapeLike`/`quoteOrValue` pair.
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function quoteOrValue(value: string) {
  // PostgREST's documented mechanism for its reserved `.or(...)` characters
  // (`,` `.` `:` `*` `(` `)`) — wrap the whole operand in double quotes.
  return `"${value.replace(/"/g, '\\"')}"`;
}

/** The `.or(...)` filter string for the `criticalNote` query below — one
 *  `ilike` arm per keyword, ORed together. Built once at module scope since
 *  the keyword list is static. */
const CRITICAL_NOTE_KEYWORD_OR_FILTER = CRITICAL_NOTE_KEYWORDS.map(
  (keyword) => `note.ilike.${quoteOrValue(`%${escapeLike(keyword)}%`)}`
).join(",");

// `deleted_at` is selected in BOTH branches on purpose: they are the two RBAC
// variants that feed `getClientSelect`, and omitting the column from either
// would leave a soft-deleted client's profile fully readable by that role alone
// — the exact GDPR "UI lie" this plan removes. Nothing static can catch it:
// these are cast through `.single<ClientRecord>()`, so a missing column reads as
// `undefined` and page.tsx's `notFound()` short-circuit never fires.
//
// The four BOOKING_* selects deliberately do NOT carry it: no code path reads
// `booking.deleted_at`, because a soft-deleted booking only ever exists as a
// cascade of its client's deletion, and that client 404s in page.tsx.
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
  health_notes,
  customer_notes,
  created_at,
  booking_items(service_name_snapshot, service_price_snapshot, service_duration_snapshot),
  booking_participants(display_name, participant_gender, health_notes, participant_notes, consent_acknowledged)
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
  created_at,
  booking_items(service_name_snapshot, service_price_snapshot, service_duration_snapshot)
`;

const BOOKING_CONTACT_SELECT = `
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

const BOOKING_HEALTH_SELECT = `
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
  created_at,
  health_notes,
  customer_notes,
  booking_items(service_name_snapshot, service_price_snapshot, service_duration_snapshot),
  booking_participants(display_name, participant_gender, health_notes, participant_notes, consent_acknowledged)
`;

// The lifetime scan's projection (see the file header). Deliberately the
// PII-free column set — no contact columns, no address line, no health notes,
// no participants — because nothing downstream renders these as booking cards:
// they exist to be counted, summed and grouped into the page's lifetime
// figures. Every column here is read by one of those derivations
// (`isFutureBooking` needs booking_date + start_time; the LTV ribbon needs
// status, amount_paid, total_price and the service snapshots).
const BOOKING_LIFETIME_SELECT = `
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
  amount_paid,
  service_city,
  service_postcode,
  created_at,
  booking_items(service_name_snapshot, service_price_snapshot, service_duration_snapshot)
`;

function getClientSelect({
  canViewContactDetails,
  canViewNotes,
}: {
  canViewContactDetails: boolean;
  canViewNotes: boolean;
}) {
  const fields = canViewContactDetails ? CLIENT_SELECT : CLIENT_SAFE_SELECT;
  return canViewNotes ? `${fields}, notes` : fields;
}

function getBookingSelect({
  canViewContactDetails,
  canViewHealthNotes,
}: {
  canViewContactDetails: boolean;
  canViewHealthNotes: boolean;
}) {
  if (canViewContactDetails && canViewHealthNotes) return BOOKING_SELECT;
  if (canViewContactDetails) return BOOKING_CONTACT_SELECT;
  if (canViewHealthNotes) return BOOKING_HEALTH_SELECT;
  return BOOKING_SAFE_SELECT;
}

/** The `getClientDataAccess(...)` fields this fetch depends on, as booleans. */
export interface ClientDetailAccessFlags {
  canViewClient: boolean;
  canViewContactDetails: boolean;
  canViewHealthNotes: boolean;
  canCreateClientNote: boolean;
  canViewSensitiveNoteQueue: boolean;
  canManagePrivacyOperations: boolean;
}

export interface ClientDetailParams {
  clientId: string;
  /** Caller's staff id — scopes the assigned-bookings path. */
  staffId: string;
  /** dataScope is 'all' or 'sensitive_hidden'. */
  hasAllClientAccess: boolean;
  /** getClientDataAccess(profile, { hasAssignedBooking: false }). */
  accessWithoutAssignment: ClientDetailAccessFlags;
  /** getClientDataAccess(profile, { hasAssignedBooking: true }). */
  accessWithAssignment: ClientDetailAccessFlags;
  /**
   * C-16 closeout — cap+view-all toggle for the rendered booking-history rail
   * only. Never affects `lifetimeBookings`, so no lifetime figure on the page
   * moves when a reader expands or collapses the rail.
   */
  historyViewAll?: boolean;
  /** C-16 Step 14 (N6) — cap+view-all toggle for `regularNotes` only. */
  notesViewAll?: boolean;
  /** Fix round (verify-FAIL Check 1) — cap+view-all toggle for the
   *  `sensitiveNotes` DISPLAY rail only. Never affects `criticalNote`. */
  sensitiveNotesViewAll?: boolean;
}

export interface ClientDetailData {
  client: ClientRecord | null;
  /**
   * The RENDERED rail — bounded by `CLIENT_BOOKING_HISTORY_LIMIT` /
   * `CLIENT_BOOKING_HISTORY_VIEW_ALL_CAP`. Never the source of a lifetime
   * figure; use `lifetimeBookings` for those.
   */
  bookingHistory: ClientBookingRecord[];
  /**
   * True count of this client's bookings under the SAME scope the two reads
   * above and below use — clinic-wide for a full-access caller, assigned-only
   * for a therapist. Drives `resolveClientBookingHistoryBannerState`.
   */
  bookingHistoryTotal: number;
  /**
   * The client's whole history through the PII-free `BOOKING_LIFETIME_SELECT`,
   * bounded by `CLIENT_LIFETIME_SCAN_CAP`. Every LIFETIME figure on the page —
   * the LTV ribbon, the client summary, the tab counts, the lifecycle badge —
   * is computed over this, never over the capped rail.
   */
  lifetimeBookings: ClientBookingRecord[];
  /** True when the caller reached this client through their own assignments. */
  hasAssignedClientAccess: boolean;
  /** Display/pinning rail only, real cap+view-all — see file header. Never
   *  the source of `criticalNote` below. */
  sensitiveNotes: ClientNoteRecord[];
  /** True count of `is_sensitive = true` notes — same predicate as `sensitiveNotes`. */
  sensitiveNotesTotal: number;
  /** The growing rail, real cap+view-all — see file header. */
  regularNotes: ClientNoteRecord[];
  /** True count of `is_sensitive = false` notes — same predicate as `regularNotes`. */
  regularNotesTotal: number;
  /** The clinical-safety "Critical note" banner's own note, or `null`. From a
   *  dedicated query scoped to keyword-matching sensitive notes only — see
   *  the file header and `CRITICAL_NOTE_KEYWORDS` — so it can never miss a
   *  flagged note because `sensitiveNotes` above happened to be capped. */
  criticalNote: ClientNoteRecord | null;
  privacyRequests: ClientPrivacyRequestRecord[];
  auditLogs: { id: string; action_type: string; created_at: string }[];
}

export async function getClientDetailData(
  params: ClientDetailParams
): Promise<ClientDetailData> {
  const {
    clientId,
    staffId,
    hasAllClientAccess,
    accessWithoutAssignment,
    accessWithAssignment,
    historyViewAll,
    notesViewAll,
    sensitiveNotesViewAll,
  } = params;
  const historyCap = historyViewAll
    ? CLIENT_BOOKING_HISTORY_VIEW_ALL_CAP
    : CLIENT_BOOKING_HISTORY_LIMIT;

  const cached = unstable_cache(
    async (): Promise<ClientDetailData> => {
      const adminClient = createSupabaseAdminClient();

      let clientAccess = accessWithoutAssignment;
      let hasAssignedClientAccess = false;
      let bookingHistory: ClientBookingRecord[] = [];
      let bookingHistoryTotal = 0;
      let lifetimeBookings: ClientBookingRecord[] = [];
      let client: ClientRecord | null = null;

      if (hasAllClientAccess) {
        const clientSelect = getClientSelect({
          canViewContactDetails: clientAccess.canViewContactDetails,
          canViewNotes:
            clientAccess.canViewHealthNotes ||
            clientAccess.canCreateClientNote ||
            clientAccess.canViewSensitiveNoteQueue,
        });
        const bookingSelect = getBookingSelect({
          canViewContactDetails: clientAccess.canViewContactDetails,
          canViewHealthNotes: clientAccess.canViewHealthNotes,
        });
        const [clientResult, bookingsResult, historyCountResult, lifetimeResult] =
          await Promise.all([
            adminClient
              .from("clients")
              .select(clientSelect)
              .eq("id", clientId)
              .single<ClientRecord>(),
            // The rendered rail — bounded on the QUERY, newest first, so the
            // rows it does return are the ones the page shows first anyway.
            adminClient
              .from("bookings")
              .select(bookingSelect)
              .eq("client_id", clientId)
              .order("booking_date", { ascending: false })
              .order("start_time", { ascending: false })
              .limit(historyCap)
              .returns<ClientBookingRecord[]>(),
            // Head-count over the SAME `client_id` scope as both reads — no
            // rows transferred, and it cannot describe a different selection.
            adminClient
              .from("bookings")
              .select("id", { count: "exact", head: true })
              .eq("client_id", clientId),
            // The lifetime scan — PII-free projection, whole history, capped.
            adminClient
              .from("bookings")
              .select(BOOKING_LIFETIME_SELECT)
              .eq("client_id", clientId)
              .order("booking_date", { ascending: false })
              .order("start_time", { ascending: false })
              .limit(CLIENT_LIFETIME_SCAN_CAP)
              .returns<ClientBookingRecord[]>(),
          ]);
        client = clientResult.data;
        bookingHistory = bookingsResult.data ?? [];
        bookingHistoryTotal = historyCountResult.count ?? 0;
        lifetimeBookings = lifetimeResult.data ?? [];
      } else {
        const { data: assignments } = await adminClient
          .from("booking_assignments")
          .select("booking_id")
          .eq("assigned_staff_id", staffId);
        const assignedBookingIds = Array.from(
          new Set((assignments ?? []).map((assignment) => assignment.booking_id))
        );
        if (assignedBookingIds.length > 0) {
          clientAccess = accessWithAssignment;
          const bookingSelect = getBookingSelect({
            canViewContactDetails: clientAccess.canViewContactDetails,
            canViewHealthNotes: clientAccess.canViewHealthNotes,
          });
          // Same three reads as the full-access branch, every one of them
          // additionally narrowed to this therapist's own assignments — so the
          // count, the rail and the lifetime figures all describe the same
          // scope, and none of them can leak a booking they cannot see.
          const [assignedResult, assignedCountResult, assignedLifetimeResult] =
            await Promise.all([
              adminClient
                .from("bookings")
                .select(bookingSelect)
                .eq("client_id", clientId)
                .in("id", assignedBookingIds)
                .order("booking_date", { ascending: false })
                .order("start_time", { ascending: false })
                .limit(historyCap)
                .returns<ClientBookingRecord[]>(),
              adminClient
                .from("bookings")
                .select("id", { count: "exact", head: true })
                .eq("client_id", clientId)
                .in("id", assignedBookingIds),
              adminClient
                .from("bookings")
                .select(BOOKING_LIFETIME_SELECT)
                .eq("client_id", clientId)
                .in("id", assignedBookingIds)
                .order("booking_date", { ascending: false })
                .order("start_time", { ascending: false })
                .limit(CLIENT_LIFETIME_SCAN_CAP)
                .returns<ClientBookingRecord[]>(),
            ]);
          bookingHistory = assignedResult.data ?? [];
          bookingHistoryTotal = assignedCountResult.count ?? 0;
          lifetimeBookings = assignedLifetimeResult.data ?? [];
          hasAssignedClientAccess = bookingHistory.length > 0;
        } else {
          hasAssignedClientAccess = false;
        }

        clientAccess = hasAssignedClientAccess
          ? accessWithAssignment
          : accessWithoutAssignment;
        if (clientAccess.canViewClient) {
          const clientSelect = getClientSelect({
            canViewContactDetails: clientAccess.canViewContactDetails,
            canViewNotes:
              clientAccess.canViewHealthNotes ||
              clientAccess.canCreateClientNote ||
              clientAccess.canViewSensitiveNoteQueue,
          });
          const { data: assignedClient } = await adminClient
            .from("clients")
            .select(clientSelect)
            .eq("id", clientId)
            .single<ClientRecord>();
          client = assignedClient;
        }
      }

      // C-16 Step 14 (N6) + fix round (verify-FAIL Check 1). See file header.
      let sensitiveNotes: ClientNoteRecord[] = [];
      let sensitiveNotesTotal = 0;
      let regularNotes: ClientNoteRecord[] = [];
      let regularNotesTotal = 0;
      let criticalNote: ClientNoteRecord | null = null;
      let privacyRequests: ClientPrivacyRequestRecord[] = [];
      let auditLogs: { id: string; action_type: string; created_at: string }[] = [];

      if (clientAccess.canViewHealthNotes || clientAccess.canViewSensitiveNoteQueue) {
        const regularCap = notesViewAll ? CLIENT_NOTES_VIEW_ALL_CAP : CLIENT_NOTES_LIMIT;
        const regularNotesQuery = adminClient
          .from("client_notes")
          .select("id, note, is_sensitive, created_at, staff_profiles(name)")
          .eq("client_id", clientId)
          .eq("is_sensitive", false)
          .order("created_at", { ascending: false })
          .limit(regularCap)
          .returns<ClientNoteRecord[]>();
        const regularNotesCountQuery = adminClient
          .from("client_notes")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .eq("is_sensitive", false);
        const sensitiveCap = sensitiveNotesViewAll
          ? CLIENT_SENSITIVE_NOTES_VIEW_ALL_CAP
          : CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP;
        // Display/pinning rail only — NEVER the source of `criticalNote`
        // below. Real cap+view-all, same shape as `regularNotes`.
        const sensitiveNotesQuery = clientAccess.canViewSensitiveNoteQueue
          ? adminClient
              .from("client_notes")
              .select("id, note, is_sensitive, created_at, staff_profiles(name)")
              .eq("client_id", clientId)
              .eq("is_sensitive", true)
              .order("created_at", { ascending: false })
              .limit(sensitiveCap)
              .returns<ClientNoteRecord[]>()
          : Promise.resolve({ data: [] as ClientNoteRecord[] });
        const sensitiveNotesCountQuery = clientAccess.canViewSensitiveNoteQueue
          ? adminClient
              .from("client_notes")
              .select("id", { count: "exact", head: true })
              .eq("client_id", clientId)
              .eq("is_sensitive", true)
          : Promise.resolve({ count: 0 });
        // Fix round (verify-FAIL Check 1) — the safety banner's OWN query.
        // Scoped to keyword-matching sensitive notes only (see
        // CRITICAL_NOTE_KEYWORD_OR_FILTER), so its correctness never depends
        // on `sensitiveNotes`' cap above. Reuses the SAME defensive cap
        // number as a further ceiling on this already keyword-narrowed
        // subset — see the file header.
        const criticalNoteCandidatesQuery = clientAccess.canViewSensitiveNoteQueue
          ? adminClient
              .from("client_notes")
              .select("id, note, is_sensitive, created_at, staff_profiles(name)")
              .eq("client_id", clientId)
              .eq("is_sensitive", true)
              .or(CRITICAL_NOTE_KEYWORD_OR_FILTER)
              .order("created_at", { ascending: false })
              .limit(CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP)
              .returns<ClientNoteRecord[]>()
          : Promise.resolve({ data: [] as ClientNoteRecord[] });

        const [
          regularResult,
          regularCountResult,
          sensitiveResult,
          sensitiveCountResult,
          criticalNoteCandidatesResult,
        ] = await Promise.all([
          regularNotesQuery,
          regularNotesCountQuery,
          sensitiveNotesQuery,
          sensitiveNotesCountQuery,
          criticalNoteCandidatesQuery,
        ]);
        regularNotes = regularResult.data ?? [];
        regularNotesTotal = regularCountResult.count ?? 0;
        sensitiveNotes = sensitiveResult.data ?? [];
        sensitiveNotesTotal = sensitiveCountResult.count ?? 0;
        const criticalNoteCandidates = criticalNoteCandidatesResult.data ?? [];
        criticalNote =
          criticalNoteCandidates.find((note) => CRITICAL_NOTE_PATTERN.test(note.note)) ??
          null;
      }

      if (clientAccess.canManagePrivacyOperations) {
        const { data: requests } = await adminClient
          .from("client_privacy_requests")
          .select("id, request_type, status, request_note, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .returns<ClientPrivacyRequestRecord[]>();
        privacyRequests = requests ?? [];

        const auditTargetIds = [
          clientId,
          ...sensitiveNotes.map((note) => note.id),
          ...regularNotes.map((note) => note.id),
          ...privacyRequests.map((request) => request.id),
        ];
        const { data: auditEvents } = await adminClient
          .from("audit_logs")
          .select("id, action_type, created_at")
          .in("target_id", auditTargetIds)
          .order("created_at", { ascending: false })
          .limit(10);
        auditLogs = auditEvents ?? [];
      }

      return {
        client,
        bookingHistory,
        bookingHistoryTotal,
        lifetimeBookings,
        hasAssignedClientAccess,
        sensitiveNotes,
        sensitiveNotesTotal,
        regularNotes,
        regularNotesTotal,
        criticalNote,
        privacyRequests,
        auditLogs,
      };
    },
    [
      "client-detail",
      cacheKeyPart({
        clientId,
        staffId,
        hasAllClientAccess,
        accessWithoutAssignment,
        accessWithAssignment,
        historyViewAll,
        notesViewAll,
        sensitiveNotesViewAll,
      }),
    ],
    {
      revalidate: 60,
      tags: [TAGS.CLIENTS, TAGS.BOOKINGS, TAGS.AUDIT, TAGS.EMAILS],
    }
  );
  return cached();
}

/**
 * Cheap head-count companion for a future paged booking history. Head request
 * — no rows transferred. Not used by the page today.
 */
export async function countClientBookings(clientId: string): Promise<number> {
  const cached = unstable_cache(
    async (): Promise<number> => {
      const adminClient = createSupabaseAdminClient();
      const { count, error } = await adminClient
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId);
      if (error) return 0;
      return count ?? 0;
    },
    ["client-detail-bookings-count", cacheKeyPart({ clientId })],
    { revalidate: 60, tags: [TAGS.BOOKINGS] }
  );
  return cached();
}

// C-16 closeout — the booking-history rail's hidden-rows signal. Same four
// states and the same branch order as the two notes resolvers below:
// `cappedOut` BEFORE `hidden`, so once the reader is already viewing all AND
// the true total still exceeds the view-all cap, the rail says the rest are
// unreachable instead of offering a "view all" link back to the URL they are
// already on.
export type ClientBookingHistoryBannerState =
  | { kind: "none" }
  | { kind: "hidden"; total: number }
  | { kind: "cappedOut"; total: number }
  | { kind: "viewingAll"; total: number };

export function resolveClientBookingHistoryBannerState(params: {
  /** True count of bookings in the caller's scope — `bookingHistoryTotal`. */
  historyTotal: number;
  /** `bookingHistory.length` actually fetched (bounded by the cap in force). */
  historyShown: number;
  viewAll: boolean;
}): ClientBookingHistoryBannerState {
  const { historyTotal, historyShown, viewAll } = params;
  if (viewAll && historyTotal > CLIENT_BOOKING_HISTORY_VIEW_ALL_CAP) {
    return { kind: "cappedOut", total: historyTotal };
  }
  if (historyTotal > historyShown) {
    return { kind: "hidden", total: historyTotal };
  }
  if (viewAll && historyTotal > CLIENT_BOOKING_HISTORY_LIMIT) {
    return { kind: "viewingAll", total: historyTotal };
  }
  return { kind: "none" };
}

// C-16 Step 14 (N6) — mirrors `resolvePasswordRequestsBannerState`
// (account-password-requests/page.tsx, commit 6fa19ce) and privacy's
// `cappedOut` distinction (commit 6faf895) for the identical bug shape: once
// already viewing all AND the true total exceeds the view-all cap itself,
// "view all N" is a lie — clicking it re-navigates to the same state and
// still only returns CLIENT_NOTES_VIEW_ALL_CAP rows. `cappedOut` is
// evaluated BEFORE `hidden`, same branch order as both precedents (that bug
// shipped twice already on this exact plan — see the two sabotage tests in
// `__tests__/client-detail-data.test.ts`).
export type ClientNotesBannerState =
  | { kind: "none" }
  | { kind: "hidden"; total: number }
  | { kind: "cappedOut"; total: number }
  | { kind: "viewingAll"; total: number };

export function resolveClientNotesBannerState(params: {
  /** True count of `is_sensitive = false` notes — the only resource this
   *  function looks at. */
  regularTotal: number;
  /** `regularNotes.length` actually fetched (bounded by the current cap). */
  regularShown: number;
  viewAll: boolean;
}): ClientNotesBannerState {
  const { regularTotal, regularShown, viewAll } = params;
  // Scoped to `regularNotes` throughout, deliberately never mixed with
  // `sensitiveNotes` — the two rails have independent caps and independent
  // view-all toggles (see `resolveClientSensitiveNotesBannerState` below), so
  // a COMBINED total compared against CLIENT_NOTES_VIEW_ALL_CAP would falsely
  // report `cappedOut` from a handful of sensitive notes even though every
  // regular note is already shown.
  if (viewAll && regularTotal > CLIENT_NOTES_VIEW_ALL_CAP) {
    return { kind: "cappedOut", total: regularTotal };
  }
  if (regularTotal > regularShown) {
    return { kind: "hidden", total: regularTotal };
  }
  if (viewAll && regularTotal > CLIENT_NOTES_LIMIT) {
    return { kind: "viewingAll", total: regularTotal };
  }
  return { kind: "none" };
}

// Fix round (verify-FAIL Check 1) — `sensitiveNotes`' own hidden-rows signal,
// mirroring `resolveClientNotesBannerState` above exactly (same branch order,
// same reasoning: `cappedOut` before `hidden` so "view all N" never promises
// a link that can't deliver). Kept as a SEPARATE function rather than a
// parameter on the one above because the two rails have independent caps —
// see that function's comment. Scoped to `sensitiveNotes` (the DISPLAY rail)
// only; never affects `criticalNote`, which has no cap to hide behind.
export type ClientSensitiveNotesBannerState =
  | { kind: "none" }
  | { kind: "hidden"; total: number }
  | { kind: "cappedOut"; total: number }
  | { kind: "viewingAll"; total: number };

export function resolveClientSensitiveNotesBannerState(params: {
  /** True count of `is_sensitive = true` notes. */
  sensitiveTotal: number;
  /** `sensitiveNotes.length` actually fetched (bounded by the current cap). */
  sensitiveShown: number;
  viewAll: boolean;
}): ClientSensitiveNotesBannerState {
  const { sensitiveTotal, sensitiveShown, viewAll } = params;
  if (viewAll && sensitiveTotal > CLIENT_SENSITIVE_NOTES_VIEW_ALL_CAP) {
    return { kind: "cappedOut", total: sensitiveTotal };
  }
  if (sensitiveTotal > sensitiveShown) {
    return { kind: "hidden", total: sensitiveTotal };
  }
  if (viewAll && sensitiveTotal > CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP) {
    return { kind: "viewingAll", total: sensitiveTotal };
  }
  return { kind: "none" };
}
