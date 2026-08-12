// SERVER ONLY — cached data helper for /admin/bookings/[bookingId]
// (C-09 Phase C Step 5).
//
// `canManageBookings` is enforced upstream in page.tsx. The RBAC scope is
// passed in as explicit booleans and forms part of the cache key, so a
// claimable-only viewer can never be served the full record and vice versa.
//
// The `profile` object is handed to the fetcher as a CLOSURE argument only: it
// carries a `Set` of permissions, so it must never appear in the cache key or
// in a returned value (SHARED-NOTES §15). What varies per caller is captured by
// `staffId`, `staffGender`, `canViewAll` and `canClaim`.
//
// CACHE HAZARD AUDIT (SHARED-NOTES §15): the returned shape is JSON-safe.
//  - `booking` is a BookingRecordWithClientId — scalars plus nested arrays of
//    scalars; `normalizeClaimableBooking` already produces plain values.
//  - `auditLogs` is a plain row array; `canOpen` / `claimableOnly` are booleans.
//  - Every timestamp stays a string. page.tsx's `getTodayIsoDate()` comparison,
//    `findRecentAutoPromotion`'s `Date.now() - new Date(created_at)` window and
//    every `safeFormatDateTime` call run on the consumer side of the boundary.
//  - `sourceEnquiry` (C-03 Phase D) is `null` or a plain object of scalars
//    (id/full_name/service_interest strings, created_at kept as a string —
//    formatted by `formatDate` on the consumer side, same rule as above).
//  - TRANSFORM APPLIED: none needed — no Set / Map / Date is returned.
//
// NOT CACHED, deliberately: `getStaffAssignmentPreviews` (assignment
// eligibility) stays in page.tsx. It reaches into the availability engine and
// is computed per assignment from live staff state; freezing it behind a page
// cache is a different decision from the plan's Step 5 table and is not made
// here. `getRestoreContext` also stays uncached — it is a single conditional
// row read, only paid for when the Restore button will actually render.
//
// Tags per the plan's Step 5 table: bookings, clients, staff, audit, emails.
// C-03 Phase D adds `enquiries`: the fetcher now also runs the
// enquiry-origin reverse-lookup (Step 12) below, and `createManualBooking`
// already calls `updateTag(TAGS.ENQUIRIES)` in the same request that sets
// `enquiries.converted_booking_id` (bookings/actions.ts) — without this tag
// on the fetcher, that exact event would leave a stale Origin panel for up
// to 60s with nothing left that could ever bust it.
//
// PAGINATION (C-16): this surface is not on C-16's Phase A list and carries no
// unbounded list — the activity timeline is a merge of two 10-row reads capped
// at 20. `auditLimit` is therefore the only paging-shaped param: it flows into
// BOTH audit queries and into the cache key. No `offset` is offered, because an
// offset applied to each half of a two-query merge produces a wrong window
// rather than the next page.

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tag-taxonomy";
import { cacheKeyPart } from "@/lib/cache/cache-key";
import { safeFormatDateTime } from "@/lib/time/format";
import type { getStaffProfile } from "@/lib/auth/rbac";
import {
  canClaimAssignments,
  canManageAllBookings,
} from "../access";
import type { BookingRecord } from "../types";
import type { RestoreContext } from "./NextActionButton";

type Profile = NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>;

// `cancelled_at` is named here because `BookingRecord` (../types.ts) declares
// it. That pairing is load-bearing, not tidiness: the row arrives through an
// unchecked `.single<BookingRecordWithClientId>()` cast against an untyped
// admin client, so a column present on the type but absent from this string
// reads `undefined` at runtime with tsc, lint and vitest all green —
// `isRestoreWindowExpired` then fails closed and the Restore button disappears
// from this page while the list row (../page.tsx) still offers it. Never split
// the two.
const BOOKING_DETAIL_SELECT = `
  id,
  client_id,
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
  booking_assignments(id, participant_id, assigned_staff_id, required_therapist_gender, status, staff_profiles(name)),
  email_delivery_events(id, event_type, recipient_email, recipient_role, delivery_status, provider_message_id, error_message, created_at)
`;

const CLAIMABLE_BOOKING_DETAIL_SELECT = `
  id,
  client_id,
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
  booking_participants(id, participant_gender, required_therapist_gender, is_main_contact, consent_acknowledged),
  booking_items(id, booking_participant_id, service_name_snapshot, service_duration_snapshot),
  booking_assignments(id, participant_id, assigned_staff_id, required_therapist_gender, status, staff_profiles(name))
`;

// C-02 Phase F, Step 18 — `recurring_template_id` is local to this file (like
// `client_id` above) rather than added to the shared `BookingRecord` type in
// `../types.ts`, which Phase F does not otherwise touch.
export type BookingRecordWithClientId = BookingRecord & {
  client_id: string | null;
  recurring_template_id: string | null;
};

export async function getScopedBookingRelation(
  bookingId: string,
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>,
  adminClient: ReturnType<typeof createSupabaseAdminClient>
) {
  if (canManageAllBookings(profile)) {
    return { canOpen: true, claimableOnly: false };
  }

  const { count: assignedCount } = await adminClient
    .from("booking_assignments")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .eq("assigned_staff_id", profile.id);

  if ((assignedCount ?? 0) > 0) {
    return { canOpen: true, claimableOnly: false };
  }

  const { count: claimableCount } = canClaimAssignments(profile)
    ? await adminClient
        .from("booking_assignments")
        .select("id", { count: "exact", head: true })
        .eq("booking_id", bookingId)
        .eq("status", "unassigned")
        .is("assigned_staff_id", null)
        .eq("required_therapist_gender", profile.gender)
    : { count: 0 };

  return {
    canOpen: (claimableCount ?? 0) > 0,
    claimableOnly: (claimableCount ?? 0) > 0,
  };
}

function normalizeClaimableBooking(
  booking: Partial<BookingRecordWithClientId>
): BookingRecordWithClientId {
  return {
    id: booking.id ?? "",
    client_id: booking.client_id ?? null,
    // CLAIMABLE_BOOKING_DETAIL_SELECT never selects this column — a
    // claimable-only viewer doesn't qualify for the series view either
    // (F4), so there is no cross-link to point at regardless.
    recurring_template_id: booking.recurring_template_id ?? null,
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
    clients: null,
    booking_participants: (booking.booking_participants ?? []).map(
      (participant) => ({
        id: participant.id,
        participant_gender: participant.participant_gender,
        required_therapist_gender: participant.required_therapist_gender,
        is_main_contact: participant.is_main_contact,
        display_name: null,
        participant_notes: null,
        health_notes: null,
        consent_acknowledged: participant.consent_acknowledged,
      })
    ),
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

/**
 * S3 — the Restore confirm modal shows what is being undone. A customer's own
 * cancellation note wins; otherwise the most recent cancel audit row supplies
 * who and when.
 *
 * Both admin cancel paths are queried: the Status form writes
 * `booking_management_updated`, the quick action writes `booking_quick_cancel`
 * (`actions.ts`), and in production every admin cancellation so far has gone
 * through the latter.
 */
export async function getRestoreContext(
  booking: BookingRecord,
  adminClient: ReturnType<typeof createSupabaseAdminClient>
): Promise<RestoreContext> {
  if (booking.customer_cancellation_note) {
    return {
      customerNote: booking.customer_cancellation_note,
      cancelledByName: null,
      cancelledAtLabel: null,
    };
  }

  const { data } = await adminClient
    .from("audit_logs")
    .select("created_at, staff_profiles(name)")
    .eq("target_id", booking.id)
    .in("action_type", ["booking_management_updated", "booking_quick_cancel"])
    .eq("after_state->>status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string; staff_profiles: { name: string } | null }>();

  return {
    customerNote: null,
    cancelledByName: data?.staff_profiles?.name ?? null,
    cancelledAtLabel: data
      ? safeFormatDateTime(data.created_at, { dateStyle: "medium" })
      : null,
  };
}

export const BOOKING_DETAIL_AUDIT_LIMIT = 10;
export const BOOKING_DETAIL_TIMELINE_CAP = 20;

export interface BookingDetailParams {
  bookingId: string;
  /** Closure-only: never keyed, never returned (carries a permissions Set). */
  profile: Profile;
  /** `canManageAllBookings(profile)` — also gates the activity timeline read. */
  fullScope: boolean;
  /** Rows read per audit query before the two are merged and capped. */
  auditLimit?: number;
}

// C-03 Phase D, Step 12 — the enquiry that converted into this booking, via
// the reverse lookup (`enquiries.converted_booking_id = booking.id`). No
// forward pointer exists on `bookings` (brief §1.5 locked reverse-lookup over
// a schema change), so this is `null` for the overwhelming majority of
// bookings that didn't originate from an enquiry.
export interface SourceEnquiry {
  id: string;
  full_name: string;
  created_at: string;
  service_interest: string | null;
}

export interface BookingDetailData {
  canOpen: boolean;
  claimableOnly: boolean;
  booking: BookingRecordWithClientId | null;
  auditLogs: NonNullable<BookingRecord["audit_logs"]>;
  sourceEnquiry: SourceEnquiry | null;
}

export async function getBookingDetailData(
  params: BookingDetailParams
): Promise<BookingDetailData> {
  const { bookingId, profile, fullScope } = params;
  const auditLimit = params.auditLimit ?? BOOKING_DETAIL_AUDIT_LIMIT;
  const canViewAll = canManageAllBookings(profile);
  const canClaim = canClaimAssignments(profile);

  const cached = unstable_cache(
    async (): Promise<BookingDetailData> => {
      const adminClient = createSupabaseAdminClient();
      const scopedRelation = await getScopedBookingRelation(
        bookingId,
        profile,
        adminClient
      );
      if (!scopedRelation.canOpen) {
        return {
          canOpen: false,
          claimableOnly: false,
          booking: null,
          auditLogs: [],
          sourceEnquiry: null,
        };
      }

      const bookingResult = scopedRelation.claimableOnly
        ? (
            await adminClient
              .from("bookings")
              .select(CLAIMABLE_BOOKING_DETAIL_SELECT)
              .eq("id", bookingId)
              .single<Partial<BookingRecordWithClientId>>()
          ).data
        : (
            await adminClient
              .from("bookings")
              .select(BOOKING_DETAIL_SELECT)
              .eq("id", bookingId)
              .single<BookingRecordWithClientId>()
          ).data;

      if (!bookingResult) {
        return {
          canOpen: true,
          claimableOnly: scopedRelation.claimableOnly,
          booking: null,
          auditLogs: [],
          sourceEnquiry: null,
        };
      }

      const booking = scopedRelation.claimableOnly
        ? normalizeClaimableBooking(bookingResult)
        : (bookingResult as BookingRecordWithClientId);

      const auditLogs = fullScope
        ? (
            await Promise.all([
              adminClient
                .from("audit_logs")
                .select(
                  "id, action_type, target_type, target_id, created_at, staff_profiles(name)"
                )
                .eq("target_id", booking.id)
                .order("created_at", { ascending: false })
                .limit(auditLimit)
                .returns<NonNullable<BookingRecord["audit_logs"]>>(),
              booking.booking_assignments.length > 0
                ? adminClient
                    .from("audit_logs")
                    .select(
                      "id, action_type, target_type, target_id, created_at, staff_profiles(name)"
                    )
                    .in(
                      "target_id",
                      booking.booking_assignments.map((assignment) => assignment.id)
                    )
                    .order("created_at", { ascending: false })
                    .limit(auditLimit)
                    .returns<NonNullable<BookingRecord["audit_logs"]>>()
                : Promise.resolve({ data: [] }),
            ])
          )
            .flatMap((result) => result.data ?? [])
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, BOOKING_DETAIL_TIMELINE_CAP)
        : [];

      // C-03 Phase D, Step 12 — reverse lookup for the enquiry this booking
      // was converted from, if any. Every viewer who can open the booking may
      // see the Origin panel (brief §3 RBAC matrix draws no distinction), so
      // this runs unconditionally rather than gated on `fullScope`. Indexed
      // (`idx_enquiries_converted_booking`, migration applied at 3453c0b) —
      // a single-row lookup that returns null for the overwhelming majority
      // of bookings.
      const { data: sourceEnquiry } = await adminClient
        .from("enquiries")
        .select("id, full_name, created_at, service_interest")
        .eq("converted_booking_id", booking.id)
        .maybeSingle<SourceEnquiry>();

      return {
        canOpen: true,
        claimableOnly: scopedRelation.claimableOnly,
        booking,
        auditLogs,
        sourceEnquiry: sourceEnquiry ?? null,
      };
    },
    [
      "booking-detail",
      cacheKeyPart({
        bookingId,
        staffId: profile.id,
        staffGender: profile.gender,
        canViewAll,
        canClaim,
        fullScope,
        auditLimit,
      }),
    ],
    {
      revalidate: 60,
      tags: [
        TAGS.BOOKINGS,
        TAGS.CLIENTS,
        TAGS.STAFF,
        TAGS.AUDIT,
        TAGS.EMAILS,
        TAGS.ENQUIRIES,
      ],
    }
  );
  return cached();
}
