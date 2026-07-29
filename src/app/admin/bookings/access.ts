import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  canClaimAssignments as hasClaimAssignmentPermission,
  canManageAllBookings,
  canManageBookings,
  canViewAllBookings,
  canViewAssignedBookings,
  type StaffProfile,
} from "@/lib/auth/rbac";
import type { BookingRecord } from "./types";

export { canManageAllBookings, canManageBookings };

export function canClaimAssignments(profile: StaffProfile) {
  return hasClaimAssignmentPermission(profile);
}

export function isOwnBooking(booking: BookingRecord, profile: StaffProfile) {
  return booking.booking_assignments.some(
    (assignment) => assignment.assigned_staff_id === profile.id
  );
}

export function hasClaimableAssignment(
  booking: BookingRecord,
  profile: StaffProfile,
  todayISO?: string
) {
  if (!canClaimAssignments(profile)) return false;

  // Lockdown (C-05): cancelled / no_show / past-dated are inert
  if (booking.status === "cancelled" || booking.status === "no_show") return false;
  const today = todayISO ?? getLondonToday();
  if (booking.booking_date < today) return false;

  return booking.booking_assignments.some(
    (assignment) =>
      assignment.status === "unassigned" &&
      !assignment.assigned_staff_id &&
      assignment.required_therapist_gender === profile.gender
  );
}

export function canOpenBookingRecord(booking: BookingRecord, profile: StaffProfile) {
  return (
    canManageAllBookings(profile) ||
    canViewAllBookings(profile) ||
    isOwnBooking(booking, profile) ||
    hasClaimableAssignment(booking, profile)
  );
}

export async function canAccessBooking(bookingId: string, profile: StaffProfile) {
  if (canManageAllBookings(profile) || canViewAllBookings(profile)) return true;
  if (!canManageBookings(profile) && !canViewAssignedBookings(profile)) return false;

  const adminClient = createSupabaseAdminClient();
  const { count, error } = await adminClient
    .from("booking_assignments")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .eq("assigned_staff_id", profile.id);

  return !error && (count ?? 0) > 0;
}

export type BookingActivityCheck =
  | {
      active: true;
      booking: {
        id: string;
        status: string;
        booking_date: string;
        start_time: string;
        end_time: string;
      };
    }
  | {
      active: false;
      reason: "not_found" | "cancelled" | "no_show" | "past_dated" | "client_deleted";
      message: string;
    };

function getLondonToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function ensureBookingActive(
  bookingId: string,
  supabase: SupabaseClient,
  options: { allowToday?: boolean } = {}
): Promise<BookingActivityCheck> {
  const allowToday = options.allowToday ?? true;

  // SELECT shape: unconditional — pre-flight Step 6 hard-gates on C-06's migration
  // having landed (2026-07-26, Checkpoint D4 / finding F4), so deleted_at and
  // clients(deleted_at) always exist by the time this helper runs.
  // end_time (Phase B, Step 4): claimBookingAssignment/updateBookingAssignment both
  // need it downstream for getClaimAssignmentEligibility/getStaffAssignmentPreviews
  // (assignment-eligibility.ts's AssignmentEligibilityBooking), so it's folded into
  // this shared SELECT rather than re-fetched separately at each call site.
  const selectColumns =
    "id, status, booking_date, start_time, end_time, deleted_at, clients(deleted_at)";

  const { data: booking, error } = await supabase
    .from("bookings")
    .select(selectColumns)
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !booking) {
    return { active: false, reason: "not_found", message: "Booking not found." };
  }

  // (Forward-looking C-06) Booking soft-deleted
  if ((booking as { deleted_at?: string | null }).deleted_at) {
    return {
      active: false,
      reason: "not_found",
      message: "Booking not found.",
    };
  }

  // (Forward-looking C-06) Parent client soft-deleted
  const clientsRow = (booking as { clients?: { deleted_at?: string | null } | null }).clients;
  if (clientsRow?.deleted_at) {
    return {
      active: false,
      reason: "client_deleted",
      message: "This booking's client has been deleted.",
    };
  }

  if (booking.status === "cancelled") {
    return {
      active: false,
      reason: "cancelled",
      message: "This booking is cancelled. Restore it from the booking detail page first.",
    };
  }

  if (booking.status === "no_show") {
    return {
      active: false,
      reason: "no_show",
      message: "This booking is marked no-show. Restore it from the booking detail page first.",
    };
  }

  const today = getLondonToday();
  const minDate = allowToday ? today : addDaysISO(today, 1);
  if (booking.booking_date < minDate) {
    return {
      active: false,
      reason: "past_dated",
      message: "This booking is in the past. Actions are no longer available.",
    };
  }

  return {
    active: true,
    booking: {
      id: booking.id,
      status: booking.status,
      booking_date: booking.booking_date,
      start_time: booking.start_time,
      end_time: booking.end_time,
    },
  };
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
