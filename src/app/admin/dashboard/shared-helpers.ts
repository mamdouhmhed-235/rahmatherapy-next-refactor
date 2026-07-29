// Shared fieldwork-ergonomics helpers, lifted verbatim from
// TherapistDashboard.tsx (C-FIELDWORK-EXPERIENCE Phase A). C-11 will
// eventually consume these from each dashboard variant (Business /
// Coordinator / Therapist); TherapistDashboard.tsx re-exports them for
// backward compat with existing importers.

import type { ReportData } from "../reports/reporting";

export const FORMATTERS = {
  weekday: new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: "Europe/London",
  }),
  longDate: new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  }),
};

export function getGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Europe/London",
    }).format(new Date())
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  if (hours >= 10) return `${Math.round(hours)}h`;
  return `${hours.toFixed(1).replace(/\.0$/, "")}h`;
}

export function buildAddressLines(
  booking: ReportData["bookings"][number]
): string[] {
  const lines = [
    booking.service_address_line1,
    booking.service_postcode,
    booking.service_city,
  ];
  return lines.filter((line): line is string => Boolean(line && line.trim()));
}

export function buildMapsHref(
  booking: ReportData["bookings"][number]
): string | null {
  const parts = buildAddressLines(booking);
  if (parts.length === 0) return null;
  const query = encodeURIComponent(parts.join(", "));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export interface MinimalBookingForPredicate {
  booking_assignments: Array<{
    assigned_staff_id: string | null;
    status: string;
  }>;
}

/**
 * Capability-keyed predicate: is the viewer an actively-assigned practitioner
 * on this booking? Used by the booking detail page to switch between
 * admin-curator view and practitioner view (mobile sidebar reorder, etc.)
 *
 * Returns false when:
 *   - viewer lacks can_take_bookings capability
 *   - viewer has no assignment row on this booking
 *   - viewer's assignment status is 'unassigned' (slot existed but never claimed)
 *   - viewer's assignment status is 'cancelled' (no longer active)
 *
 * Returns true for: 'assigned', 'completed', 'no_show' assignment statuses
 *   — i.e., the viewer was actively the practitioner for this booking.
 *   Including 'completed' / 'no_show' so retrospective viewing of one's own
 *   work still gets the field-optimised layout (e.g., to follow up).
 */
export function isViewerAssignedPractitioner(
  booking: MinimalBookingForPredicate,
  viewerStaffId: string,
  viewerCanTakeBookings: boolean
): boolean {
  if (!viewerCanTakeBookings) return false;
  return booking.booking_assignments.some(
    (a) =>
      a.assigned_staff_id === viewerStaffId &&
      a.status !== "unassigned" &&
      a.status !== "cancelled"
  );
}
