// SERVER ONLY — cached data helper for /admin/clients (C-09 Phase C Step 5).
//
// Page access (getAdminPageAccess + getClientDataAccess) is resolved upstream
// in page.tsx; `canViewContactDetails` is passed in because it selects which
// column set is read, and it is part of the cache key so a caller without
// contact-detail authority can never be served the fuller entry.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is JSON-safe.
//  - `clients` and `bookings` are plain row arrays; `booking_items` is a
//    nested array of scalars.
//  - Every timestamp (`created_at`, `updated_at`, `deleted_at`,
//    `booking_date`) stays a string. page.tsx's `new Date(...)` lifecycle and
//    recency arithmetic — and its `now` reference — live entirely on the
//    consumer side of the cache boundary, so nothing degrades in transit.
//  - TRANSFORM APPLIED: none needed. `bookingsByClientId` (a Map) is built by
//    page.tsx after this returns, not here.
// No Set / Map / Date crosses the boundary.
//
// Tags per the plan's Step 5 table: clients, bookings.
//
// PAGINATION-READY (C-16): optional `limit` + `offset` bound the CLIENT list
// and flow into BOTH the query and the cache key, so page 2 can never be
// served page 1's rows. Both default to undefined, reproducing today's
// unbounded read exactly — the page still slices its own 50-row pages in
// memory. `countClients` is the cheap head-count companion for C-16's
// "Showing X–Y of Z" readout; it is not called by the page today.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";
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

export interface ClientsListParams {
  /** `getClientDataAccess(...).canViewContactDetails` — picks the column set. */
  canViewContactDetails: boolean;
  limit?: number;
  offset?: number;
}

export interface ClientsListData {
  clients: ClientRecord[];
  bookings: ClientBookingRecord[];
}

export async function getClientsListData(
  params: ClientsListParams
): Promise<ClientsListData> {
  const { canViewContactDetails, limit, offset } = params;

  const cached = unstable_cache(
    async (): Promise<ClientsListData> => {
      const adminClient = createSupabaseAdminClient();
      const clientSelect = canViewContactDetails ? CLIENT_SELECT : CLIENT_SAFE_SELECT;
      const bookingSelect = canViewContactDetails ? BOOKING_SELECT : BOOKING_SAFE_SELECT;

      let clientsQuery = adminClient
        .from("clients")
        .select(clientSelect)
        .order("full_name");
      if (limit !== undefined) {
        const start = offset ?? 0;
        clientsQuery = clientsQuery.range(start, start + limit - 1);
      }

      const [clientsResult, bookingsResult] = await Promise.all([
        clientsQuery.returns<ClientRecord[]>(),
        adminClient
          .from("bookings")
          .select(bookingSelect)
          .order("booking_date", { ascending: false })
          .order("start_time", { ascending: false })
          .returns<ClientBookingRecord[]>(),
      ]);

      return {
        clients: clientsResult.data ?? [],
        bookings: bookingsResult.data ?? [],
      };
    },
    ["clients-list", cacheKeyPart({ canViewContactDetails, limit, offset })],
    { revalidate: 60, tags: [TAGS.CLIENTS, TAGS.BOOKINGS] }
  );
  return cached();
}

/**
 * Cheap head-count companion for C-16's "Showing X–Y of Z" readout. Head
 * request — no rows transferred. `includeDeleted` mirrors the page's
 * "Show deleted" toggle. Not used by the page today.
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
