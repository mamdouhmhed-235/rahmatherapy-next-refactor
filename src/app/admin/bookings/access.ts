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

export function hasClaimableAssignment(booking: BookingRecord, profile: StaffProfile) {
  if (!canClaimAssignments(profile)) return false;

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
