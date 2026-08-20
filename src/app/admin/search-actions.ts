"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canManageAllBookings,
  canManageAllClients,
  canManageAssignedBookings,
  canViewAllBookings,
  canViewAllClients,
  canViewAssignedBookings,
  canViewClientContactDetails,
  getStaffProfile,
} from "@/lib/auth/rbac";

export interface AdminSearchResult {
  id: string;
  type: "booking" | "client";
  title: string;
  detail: string;
  href: string;
}

// ⛔ The contact columns are selected ONLY for a caller holding
// `view_client_contact_details`, so they are optional on the record types. See
// the FIND-07-B note above `searchClients`.
interface BookingSearchRecord {
  id: string;
  contact_full_name: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  service_postcode: string | null;
  booking_date: string;
  start_time: string;
  status: string;
}

interface ClientSearchRecord {
  id: string;
  full_name: string;
  client_source: string | null;
  email?: string | null;
  phone?: string | null;
  postcode?: string | null;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

/**
 * Defensive cap on the scoped branch's candidate read (ITEM M).
 *
 * The all-rows branch is O(1) forever — it filters in SQL and takes 8. The
 * scoped branch cannot do that: it has to resolve WHICH bookings this
 * practitioner is assigned to before it can filter them, and every one of
 * those ids is serialised into the `.in()` query string. Uncapped, the request
 * grows with every assignment they have ever held.
 *
 * A UUID costs 37 characters inside `in.(…)`, so the whole palette GET —
 * select, order, limit, the id list and the four-column ilike — measures
 * ≈4.3 kB at 100 ids and ≈8.2–8.3 kB at 200.
 *
 * ⛔ THE CEILING THIS WAS SIZED AGAINST WAS WRONG, and the same wrong figure
 * sized `SCOPED_CANDIDATE_ID_CAP` in `bookings/bookings-list-data.ts` — see the
 * full measurement there. In short: it is ~25 kB, not ~8 kB, and overflow is
 * HTTP 400 rather than 414. This select is small, so ~634 ids would fit.
 * (An earlier version of this comment also credited postgrest-js with a
 * matching "200+ IDs" overflow warning. There is no such warning in the
 * installed package — it was not there to check against.)
 *
 * 100 is KEPT regardless: a cap that makes the request fail is worse than one
 * that truncates, the busiest therapist holds 2 lifetime assignment rows, and
 * nothing here is close to a limit of any size.
 *
 * ⚠️ This deliberately does NOT mirror `SCOPED_BRANCH_ROW_CAP` in
 * `bookings-list-data.ts`. That constant caps the ROW FETCH that runs *after*
 * its `.in()`; the id array feeding it is still unbounded — the same latent
 * defect this constant closes here.
 *
 * Both order keys earn their place. Postgres gives no ordering guarantee to a
 * bare `limit`, so without one the truncated set could differ between two
 * identical searches. `created_at` alone is not a total order either: a
 * multi-participant booking writes one row per participant in a single
 * transaction and `now()` is transaction time, so those rows share a timestamp
 * exactly. `id` breaks that tie. Newest-first means the cap drops the
 * practitioner's OLDEST work rather than a random slice — the row is inserted
 * with the booking (`assigned_staff_id` null, filled later by UPDATE), so
 * `created_at` dates the booking and stands in for `booking_date`.
 *
 * ⚠️ A bound, not a cure. The palette has no date filter, so a scoped search is
 * a lifetime search: past the cap an old booking becomes unfindable, silently.
 * The repair is to drop the id array and filter through a
 * `booking_assignments!inner` embed (ITEM M's A2 fast-follow), the shape
 * `components/performance-data.ts` already ships.
 *
 * A2 stays gated on a multi-participant dedup test. The schema permits two
 * assignment rows per (booking, staff) pair — keyed per PARTICIPANT, no unique
 * constraint — and one row per match is exactly what `.in()` + `new Set`
 * guarantees outright here. That the embed preserves it is inherited from a
 * sibling, not proved. Prove it before trading one for the other.
 */
const SCOPED_SEARCH_ASSIGNMENT_CAP = 100;

async function getOwnBookingIds(staffId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data } = await adminClient
    .from("booking_assignments")
    .select("booking_id")
    .eq("assigned_staff_id", staffId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(SCOPED_SEARCH_ASSIGNMENT_CAP);

  return Array.from(new Set((data ?? []).map((item) => item.booking_id as string)));
}

async function searchBookings(
  query: string,
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>
): Promise<AdminSearchResult[]> {
  const canSearchAll = canManageAllBookings(profile) || canViewAllBookings(profile);
  const canSearchOwn = canManageAssignedBookings(profile) || canViewAssignedBookings(profile);

  if (!canSearchAll && !canSearchOwn) return [];

  // ⛔ FIND-07-B. Being allowed to SEE bookings is not the same as being allowed
  // to see the customer's contact details. `view_client_contact_details` is a
  // separate permission, and this surface used to ignore it entirely: it
  // selected and searched `contact_email` / `contact_phone` for anyone who
  // could open the bookings list.
  //
  // Mirrors `clients-list-data.ts`, which has always done this correctly:
  // name always, phone and email only with the contact permission.
  // `service_postcode` deliberately stays ungated on this surface — the list's
  // own booking-location filter treats city and postcode as operational rather
  // than contact data, and only gates `service_address_line1`.
  const canSeeContactDetails = canViewClientContactDetails(profile);

  const adminClient = createSupabaseAdminClient();
  let request = adminClient
    .from("bookings")
    .select(
      canSeeContactDetails
        ? "id, contact_full_name, contact_email, contact_phone, service_postcode, booking_date, start_time, status"
        : "id, contact_full_name, service_postcode, booking_date, start_time, status"
    )
    // A soft-deleted BOOKING must not surface here. `assertBookingActive`
    // (bookings/access.ts:106) already answers "Booking not found." for one, so
    // without this filter a staff member could search it up, click it, and be
    // told it does not exist. Service-role query, so RLS does not apply and the
    // filter has to be explicit.
    //
    // ⛔ This is about the BOOKING's own `deleted_at`, not the client's. A
    // deleted CLIENT's bookings stay findable on purpose — Owner ruling
    // 2026-08-20, see `bookings-list-data.ts` `resolveSearchClientIds`.
    .is("deleted_at", null)
    .order("booking_date", { ascending: false })
    .limit(8);

  if (!canSearchAll) {
    const ownBookingIds = await getOwnBookingIds(profile.id);
    if (ownBookingIds.length === 0) return [];
    request = request.in("id", ownBookingIds);
  }

  if (isUuid(query)) {
    request = request.eq("id", query);
  } else {
    const likeQuery = `%${escapeLike(query)}%`;
    request = request.or(
      [
        `contact_full_name.ilike.${likeQuery}`,
        ...(canSeeContactDetails
          ? [`contact_email.ilike.${likeQuery}`, `contact_phone.ilike.${likeQuery}`]
          : []),
        `service_postcode.ilike.${likeQuery}`,
      ].join(",")
    );
  }

  const { data } = await request.returns<BookingSearchRecord[]>();

  return (data ?? []).map((booking) => ({
    id: booking.id,
    type: "booking",
    title: booking.contact_full_name || "Unknown booking contact",
    detail: `${booking.booking_date} ${booking.start_time.slice(0, 5)} - ${booking.status} - ${booking.service_postcode ?? "no postcode"}`,
    href: `/admin/bookings/${booking.id}`,
  }));
}

async function searchClients(
  query: string,
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>
): Promise<AdminSearchResult[]> {
  const canSearchClients = canManageAllClients(profile) || canViewAllClients(profile);

  if (!canSearchClients) return [];

  // ⛔ FIND-07-B, raised by gate 07 case 27 and fixed here.
  //
  // This gated on "may you see clients at all" and then emitted the email,
  // phone and postcode straight into the visible result line — while the
  // clients LIST page, over the same data, switches its whole column list on
  // `view_client_contact_details` (`clients-list-data.ts:754`,
  // CLIENT_SELECT vs CLIENT_SAFE_SELECT). Two surfaces, same data, opposite
  // answers.
  //
  // No role reaches the gap today: all three roles holding `view_clients_all`
  // also hold `view_client_contact_details`. It was reachable through a
  // per-person permission override, which is a supported feature — revoke the
  // contact permission from one individual and the list obeyed while this
  // search did not.
  //
  // Fixed the way the list does it: the columns are not even SELECTED without
  // the permission, so the values never leave the database, and the search
  // arms narrow to the name so a phone number cannot be used to confirm whose
  // it is. `client_source` fills the result line instead — it is in the list's
  // own CLIENT_SAFE_SELECT and identifies nobody.
  const canSeeContactDetails = canViewClientContactDetails(profile);

  const likeQuery = `%${escapeLike(query)}%`;
  const { data } = await createSupabaseAdminClient()
    .from("clients")
    .select(
      canSeeContactDetails
        ? "id, full_name, client_source, email, phone, postcode"
        : "id, full_name, client_source"
    )
    // Soft-deleted clients must not resurface here. This runs on the service-role
    // client, so RLS does not apply and the filter has to be explicit — the same
    // rule `clients-list-data.ts` applies on every one of its own queries.
    .is("deleted_at", null)
    .or(
      [
        `full_name.ilike.${likeQuery}`,
        ...(canSeeContactDetails
          ? [
              `email.ilike.${likeQuery}`,
              `phone.ilike.${likeQuery}`,
              `postcode.ilike.${likeQuery}`,
            ]
          : []),
      ].join(",")
    )
    .order("full_name")
    .limit(8)
    .returns<ClientSearchRecord[]>();

  return (data ?? []).map((client) => ({
    id: client.id,
    type: "client",
    title: client.full_name,
    detail: canSeeContactDetails
      ? [client.email, client.phone, client.postcode].filter(Boolean).join(" - ")
      : (client.client_source ?? ""),
    href: `/admin/clients/${client.id}`,
  }));
}

export async function searchAdminCommand(query: string) {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return [];

  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) return [];

  const [bookingResults, clientResults] = await Promise.all([
    searchBookings(normalizedQuery, profile),
    searchClients(normalizedQuery, profile),
  ]);

  return [...bookingResults, ...clientResults].slice(0, 12);
}
