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
// page 1's rows. Both default to undefined, reproducing today's unbounded read
// exactly. They deliberately do NOT slice the therapist-scoped branch: that
// branch is a union of two id-bounded reads (assigned + claimable) merged and
// re-sorted in memory, so a per-query range would page each half independently
// and produce a wrong window. C-16 must page that branch explicitly.
// `countBookings` is the cheap head-count companion; it is not called today.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";
import type { getStaffProfile } from "@/lib/auth/rbac";
import { canClaimAssignments } from "./access";
import { getTodayIsoDate } from "./_helpers";
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

// Exported (C-FIELDWORK Phase D, brief §9.4 locked decision) — dashboard/page.tsx
// reuses this exact gender-matched claimable-scoping logic for the
// practitioner-mode Owner/Coordinator's claimableCount. Behaviour unchanged.
export async function getScopedBookingIds(profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>) {
  const adminClient = createSupabaseAdminClient();
  const { data: assignedRows } = await adminClient
    .from("booking_assignments")
    .select("booking_id")
    .eq("assigned_staff_id", profile.id);

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

export interface BookingsListParams {
  /** Closure-only: never keyed, never returned (carries a permissions Set). */
  profile: Profile;
  canViewAll: boolean;
  limit?: number;
  offset?: number;
}

/**
 * The bookings list, in the same order and shape page.tsx built inline. Errors
 * are NOT swallowed — page.tsx keeps its try/catch and its "Couldn't load
 * bookings" panel, and a rejected fetch is never cached.
 */
export async function getBookingsListData(
  params: BookingsListParams
): Promise<BookingRecord[]> {
  const { profile, canViewAll, limit, offset } = params;
  const canClaim = canClaimAssignments(profile);

  const cached = unstable_cache(
    async (): Promise<BookingRecord[]> => {
      const adminClient = createSupabaseAdminClient();
      const scopedIds = canViewAll ? null : await getScopedBookingIds(profile);
      const claimableOnlyIds =
        scopedIds?.claimableIds.filter((id) => !scopedIds.assignedIds.includes(id)) ?? [];

      if (canViewAll) {
        let query = adminClient
          .from("bookings")
          .select(BOOKING_SELECT)
          .order("booking_date", { ascending: false })
          .order("start_time", { ascending: false });
        if (limit !== undefined) {
          const start = offset ?? 0;
          query = query.range(start, start + limit - 1);
        }
        return (await query.returns<BookingRecord[]>()).data ?? [];
      }

      return [
        ...(
          scopedIds?.assignedIds.length
            ? (
                await adminClient
                  .from("bookings")
                  .select(BOOKING_SELECT)
                  .in("id", scopedIds.assignedIds)
                  .order("booking_date", { ascending: false })
                  .order("start_time", { ascending: false })
                  .returns<BookingRecord[]>()
              ).data ?? []
            : []
        ),
        ...(
          claimableOnlyIds.length
            ? (
                await adminClient
                  .from("bookings")
                  .select(CLAIMABLE_BOOKING_SELECT)
                  .in("id", claimableOnlyIds)
                  .order("booking_date", { ascending: false })
                  .order("start_time", { ascending: false })
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
      }),
    ],
    { revalidate: 60, tags: [TAGS.BOOKINGS, TAGS.CLIENTS, TAGS.STAFF] }
  );
  return cached();
}

/**
 * Cheap head-count companion for C-16's "Showing X-Y of Z" readout. Head
 * request - no rows transferred. Clinic-wide only. Not used by the page today.
 */
export async function countBookings(): Promise<number> {
  const cached = unstable_cache(
    async (): Promise<number> => {
      const adminClient = createSupabaseAdminClient();
      const { count, error } = await adminClient
        .from("bookings")
        .select("id", { count: "exact", head: true });
      if (error) return 0;
      return count ?? 0;
    },
    ["bookings-count"],
    { revalidate: 60, tags: [TAGS.BOOKINGS] }
  );
  return cached();
}
