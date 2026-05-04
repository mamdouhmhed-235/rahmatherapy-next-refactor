import { describe, expect, it } from "vitest";
import { PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import {
  canViewRevenueReports,
  getStaffRevenueAttribution,
  summarizeReports,
  type ReportData,
} from "./reporting";

function profile(permissions: string[]): StaffProfile {
  return {
    id: "staff-a",
    auth_user_id: "auth-a",
    name: "Staff A",
    email: "staff-a@example.test",
    role_id: "role-a",
    role_name: "Therapist",
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "use_global",
    permissions: new Set(permissions),
  };
}

function reportData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    filters: {
      range: "month",
      from: "2026-06-01",
      to: "2026-06-30",
      staffId: "",
      service: "",
      source: "",
      status: "",
      paymentStatus: "",
      city: "",
    },
    bookings: [],
    assignments: [],
    bookingItems: [],
    clients: [],
    staff: [],
    enquiries: [],
    emailEvents: [],
    operationalEvents: [],
    staffAvailabilityRuleStaffIds: new Set(),
    ...overrides,
  };
}

describe("reporting metrics", () => {
  it("does not expose revenue reports to own-booking-only therapist scope", () => {
    expect(canViewRevenueReports(profile([PERMISSIONS.VIEW_OWN_BOOKINGS]))).toBe(false);
    expect(canViewRevenueReports(profile([PERMISSIONS.VIEW_REPORTS]))).toBe(true);
    expect(canViewRevenueReports(profile([PERMISSIONS.MANAGE_PAYMENTS]))).toBe(true);
  });

  it("summarizes booked, collected, outstanding, repeat client, and participant metrics", () => {
    const summary = summarizeReports(
      reportData({
        bookings: [
          {
            id: "booking-a",
            client_id: "client-a",
            booking_date: "2026-06-10",
            status: "completed",
            payment_status: "paid",
            total_price: 90,
            amount_due: 90,
            amount_paid: 90,
          },
          {
            id: "booking-b",
            client_id: "client-a",
            booking_date: "2026-06-12",
            status: "confirmed",
            payment_status: "unpaid",
            total_price: 45,
            amount_due: 45,
            amount_paid: 0,
          },
        ] as ReportData["bookings"],
        assignments: [
          { id: "assignment-a" },
          { id: "assignment-b" },
        ] as ReportData["assignments"],
        clients: [
          {
            id: "client-a",
            full_name: "Aisha Khan",
            client_source: "website",
            created_at: "2026-06-01T10:00:00Z",
          },
        ],
      })
    );

    expect(summary.bookedRevenue).toBe(135);
    expect(summary.collectedRevenue).toBe(90);
    expect(summary.outstandingRevenue).toBe(45);
    expect(summary.repeatClients).toBe(1);
    expect(summary.participantCount).toBe(2);
  });

  it("attributes group booking revenue by participant item instead of duplicating full booking value per staff member", () => {
    const staffRevenue = getStaffRevenueAttribution(
      reportData({
        assignments: [
          {
            id: "assignment-a",
            booking_id: "booking-a",
            participant_id: "participant-a",
            assigned_staff_id: "staff-a",
            required_therapist_gender: "female",
            status: "assigned",
            staff_profiles: { name: "Aisha" },
          },
          {
            id: "assignment-b",
            booking_id: "booking-a",
            participant_id: "participant-b",
            assigned_staff_id: "staff-b",
            required_therapist_gender: "male",
            status: "assigned",
            staff_profiles: { name: "Omar" },
          },
        ],
        bookingItems: [
          {
            id: "item-a",
            booking_id: "booking-a",
            booking_participant_id: "participant-a",
            service_name_snapshot: "Hijama",
            service_price_snapshot: 45,
            service_duration_snapshot: 60,
          },
          {
            id: "item-b",
            booking_id: "booking-a",
            booking_participant_id: "participant-b",
            service_name_snapshot: "Hijama",
            service_price_snapshot: 45,
            service_duration_snapshot: 60,
          },
        ],
      })
    );

    expect(staffRevenue).toEqual([
      { staffId: "staff-a", staffName: "Aisha", revenue: 45 },
      { staffId: "staff-b", staffName: "Omar", revenue: 45 },
    ]);
  });
});
