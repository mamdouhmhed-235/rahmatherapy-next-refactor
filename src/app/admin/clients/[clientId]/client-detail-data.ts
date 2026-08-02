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
//  - `client`, `bookingHistory`, `clientNotes`, `privacyRequests`,
//    `auditLogs` are plain rows / nested arrays of scalars.
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
}

export interface ClientDetailData {
  client: ClientRecord | null;
  bookingHistory: ClientBookingRecord[];
  /** True when the caller reached this client through their own assignments. */
  hasAssignedClientAccess: boolean;
  clientNotes: ClientNoteRecord[];
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

      let clientNotes: ClientNoteRecord[] = [];
      let privacyRequests: ClientPrivacyRequestRecord[] = [];
      let auditLogs: { id: string; action_type: string; created_at: string }[] = [];

      if (clientAccess.canViewHealthNotes || clientAccess.canViewSensitiveNoteQueue) {
        let clientNotesQuery = adminClient
          .from("client_notes")
          .select("id, note, is_sensitive, created_at, staff_profiles(name)")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false });
        if (!clientAccess.canViewSensitiveNoteQueue) {
          clientNotesQuery = clientNotesQuery.eq("is_sensitive", false);
        }
        const clientNotesResult = await clientNotesQuery.returns<ClientNoteRecord[]>();
        clientNotes = clientNotesResult.data ?? [];
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
          ...clientNotes.map((note) => note.id),
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
        clientNotes,
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
