import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import type { BookingRecord } from "./types";

export function canManageBookings(profile: StaffProfile) {
  return (
    profile.permissions.has(PERMISSIONS.MANAGE_BOOKINGS_ALL) ||
    profile.permissions.has(PERMISSIONS.MANAGE_BOOKINGS_OWN)
  );
}

export function canClaimAssignments(profile: StaffProfile) {
  return (
    profile.active &&
    profile.can_take_bookings &&
    (profile.permissions.has(PERMISSIONS.CLAIM_ASSIGNMENTS) ||
      profile.permissions.has(PERMISSIONS.CLAIM_BOOKINGS))
  );
}

export function canManageAllBookings(profile: StaffProfile) {
  return profile.permissions.has(PERMISSIONS.MANAGE_BOOKINGS_ALL);
}

export function isOwnBooking(booking: BookingRecord, profile: StaffProfile) {
  return booking.booking_assignments.some(
    (assignment) => assignment.assigned_staff_id === profile.id
  );
}

export function hasClaimableAssignment(booking: BookingRecord, profile: StaffProfile) {
  if (!canClaimAssignments(profile)) return false;

  return booking.booking_assignments.some(
    (assignment) =>
      assignment.status === "unassigned" &&
      !assignment.assigned_staff_id &&
      assignment.required_therapist_gender === profile.gender
  );
}

export async function canAccessBooking(bookingId: string, profile: StaffProfile) {
  if (canManageAllBookings(profile)) return true;

  const adminClient = createSupabaseAdminClient();
  const { count, error } = await adminClient
    .from("booking_assignments")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .eq("assigned_staff_id", profile.id);

  return !error && (count ?? 0) > 0;
}
