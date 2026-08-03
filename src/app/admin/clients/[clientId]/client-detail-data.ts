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
// PAGINATION-READY (C-16): optional `limit` + `offset` bound the booking
// history — the only unbounded list on this surface — and flow into BOTH the
// query and the cache key, so page 2 can never be served page 1's rows. Both
// default to undefined, reproducing today's unbounded read exactly.
// `countClientBookings` is the cheap head-count companion. Neither is used by
// the page today; /admin/clients/[id] is not on C-16's Phase A list.
//
// NOTES RAIL BOUND (C-16 Phase E Step 14, finding N6 — Owner-approved
// extension, per-page-progress §1 row 3 / §2). The old single `client_notes`
// query (`.eq("client_id", clientId)`, no `.limit()`/`.range()` of any kind)
// is split into TWO queries with two different, explicitly-chosen verdicts —
// they cannot share one bound because page.tsx's header renders a safety
// banner ("Critical note") sourced from whichever sensitive note matches
// `CRITICAL_NOTE_PATTERN` (allergy/anaphylaxis/urgent/etc.), and a display
// cap that could silently drop an old allergy note from that scan would be a
// patient-safety regression, not a cosmetic one:
//   - `sensitiveNotes` (`is_sensitive = true`) — DEFENSIVE CAP ONLY
//     (`CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP`, 300), no view-all UI. Verdict:
//     bound is conscious, not defaulted, but NOT cap+view-all — sensitive
//     notes are the safety-critical subset (health/allergy context), their
//     per-client volume is bounded by business reality (written far less
//     often than general notes; the inventory's own "tens per client" 5-year
//     projection is for the WHOLE notes rail, sensitive notes are a minority
//     of that), and silently truncating the set `criticalNote` is derived
//     from would be worse than the residual unbounded-read risk. Same
//     reasoning as the bookings scoped-branch's `SCOPED_BRANCH_ROW_CAP` /
//     privacy's `PRIVACY_NOTES_VIEW_ALL_CAP` — "a defensive ceiling, not a
//     truly unbounded read."
//   - `regularNotes` (`is_sensitive = false`) — real cap+view-all
//     (`CLIENT_NOTES_LIMIT` 25 / `CLIENT_NOTES_VIEW_ALL_CAP` 200), same shape
//     as privacy's sensitive-notes rail (C-16 Step 10): `regularNotesTotal`
//     is a head-count over the SAME `is_sensitive = false` predicate, so a
//     "hidden notes" banner in page.tsx can never disagree with what it
//     counts. `notesViewAll` flows into the query AND the cache key.
// page.tsx recombines `sensitiveNotes` (always complete) with `regularNotes`
// (the capped window) for the rendered list — see its own comment.

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
/** Defensive-only — see the file header. Never paginated; a client's
 *  sensitive-note count realistically never approaches this. */
export const CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP = 300;

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
  limit?: number;
  offset?: number;
  /** C-16 Step 14 (N6) — cap+view-all toggle for `regularNotes` only. */
  notesViewAll?: boolean;
}

export interface ClientDetailData {
  client: ClientRecord | null;
  bookingHistory: ClientBookingRecord[];
  /** True when the caller reached this client through their own assignments. */
  hasAssignedClientAccess: boolean;
  /** Safety-critical subset, defensive-capped only — see file header. */
  sensitiveNotes: ClientNoteRecord[];
  /** The growing rail, real cap+view-all — see file header. */
  regularNotes: ClientNoteRecord[];
  /** True count of `is_sensitive = false` notes — same predicate as `regularNotes`. */
  regularNotesTotal: number;
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
    limit,
    offset,
    notesViewAll,
  } = params;

  const cached = unstable_cache(
    async (): Promise<ClientDetailData> => {
      const adminClient = createSupabaseAdminClient();

      let clientAccess = accessWithoutAssignment;
      let hasAssignedClientAccess = false;
      let bookingHistory: ClientBookingRecord[] = [];
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
        let bookingsQuery = adminClient
          .from("bookings")
          .select(bookingSelect)
          .eq("client_id", clientId)
          .order("booking_date", { ascending: false })
          .order("start_time", { ascending: false });
        if (limit !== undefined) {
          const start = offset ?? 0;
          bookingsQuery = bookingsQuery.range(start, start + limit - 1);
        }
        const [clientResult, bookingsResult] = await Promise.all([
          adminClient
            .from("clients")
            .select(clientSelect)
            .eq("id", clientId)
            .single<ClientRecord>(),
          bookingsQuery.returns<ClientBookingRecord[]>(),
        ]);
        client = clientResult.data;
        bookingHistory = bookingsResult.data ?? [];
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
          let assignedQuery = adminClient
            .from("bookings")
            .select(bookingSelect)
            .eq("client_id", clientId)
            .in("id", assignedBookingIds)
            .order("booking_date", { ascending: false })
            .order("start_time", { ascending: false });
          if (limit !== undefined) {
            const start = offset ?? 0;
            assignedQuery = assignedQuery.range(start, start + limit - 1);
          }
          const { data: assignedBookings } =
            await assignedQuery.returns<ClientBookingRecord[]>();
          bookingHistory = assignedBookings ?? [];
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

      // C-16 Step 14 (N6) — two queries, two verdicts. See file header.
      let sensitiveNotes: ClientNoteRecord[] = [];
      let regularNotes: ClientNoteRecord[] = [];
      let regularNotesTotal = 0;
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
        // Defensive-cap only, no view-all — see file header on why this
        // subset is never truncated by the same rule as `regularNotes`.
        const sensitiveNotesQuery = clientAccess.canViewSensitiveNoteQueue
          ? adminClient
              .from("client_notes")
              .select("id, note, is_sensitive, created_at, staff_profiles(name)")
              .eq("client_id", clientId)
              .eq("is_sensitive", true)
              .order("created_at", { ascending: false })
              .limit(CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP)
              .returns<ClientNoteRecord[]>()
          : Promise.resolve({ data: [] as ClientNoteRecord[] });

        const [regularResult, regularCountResult, sensitiveResult] = await Promise.all([
          regularNotesQuery,
          regularNotesCountQuery,
          sensitiveNotesQuery,
        ]);
        regularNotes = regularResult.data ?? [];
        regularNotesTotal = regularCountResult.count ?? 0;
        sensitiveNotes = sensitiveResult.data ?? [];
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
        hasAssignedClientAccess,
        sensitiveNotes,
        regularNotes,
        regularNotesTotal,
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
        limit,
        offset,
        notesViewAll,
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
  /** True count of `is_sensitive = false` notes — the only capped resource. */
  regularTotal: number;
  /** `regularNotes.length` actually fetched (bounded by the current cap). */
  regularShown: number;
  viewAll: boolean;
}): ClientNotesBannerState {
  const { regularTotal, regularShown, viewAll } = params;
  // Scoped to `regularNotes` throughout — `sensitiveNotes` is always fully
  // fetched (defensive cap only, see file header), so it never contributes
  // to whether anything is hidden and must NOT be mixed into these
  // comparisons: a client with a handful of sensitive notes pushing a
  // COMBINED total past CLIENT_NOTES_VIEW_ALL_CAP would otherwise report
  // `cappedOut` even though every regular note is already shown.
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
