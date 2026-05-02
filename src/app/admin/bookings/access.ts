import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import type { BookingRecord } from "./types";

export function canManageBookings(profile: StaffProfile) {
  return (
    profile.permissions.has(PERMISSIONS.MANAGE_BOOKINGS_ALL) ||
    profile.permissions.has(PERMISSIONS.MANAGE_BOOKINGS_OWN)
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
