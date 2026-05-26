import { describe, expect, it } from "vitest";
import { PERMISSIONS, type StaffProfile } from "@/lib/auth/rbac";
import {
  canViewRevenueReports,
  getCityOptionsFromBookings,
  getStaffRevenueAttribution,
  parseReportFilters,
  summarizeReports,
  type ReportData,
} from "./reporting";
import { getBusinessDate } from "@/lib/time/london";

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
    cityOptions: [],
    assignments: [],
    bookingItems: [],
    clients: [],
    staff: [],
    enquiries: [],
    emailEvents: [],
    operationalEvents: [],
    staffAvailabilityRuleStaffIds: [],
    ...overrides,
  };
}

describe("reporting metrics", () => {
  it("supports an explicit today range for dashboard defaults", () => {
    const today = getBusinessDate();

    expect(parseReportFilters({ range: "today" })).toMatchObject({
      range: "today",
      from: today,
      to: today,
    });
  });

  // Added 2026-05-25 after audit found Therapist DateRangeChips's "Tomorrow"
  // chip silently fell through to the catch-all month-forward window.
  it("range=tomorrow narrows to the single day after today", () => {
    const today = getBusinessDate();
    const next = new Date(`${today}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const tomorrow = next.toISOString().slice(0, 10);

    expect(parseReportFilters({ range: "tomorrow" })).toMatchObject({
      range: "tomorrow",
      from: tomorrow,
      to: tomorrow,
    });
  });

  // range=this_week is the calendar Mon-Sun shape. Distinct from `week`
  // which is rolling +7 business days forward (different semantic — kept
  // for backwards-compat with consumers that expect forward-7-days).
  it("range=this_week narrows to the calendar Mon-Sun of the current week", () => {
    const today = getBusinessDate();
    const result = parseReportFilters({ range: "this_week" });

    expect(result.range).toBe("this_week");
    // from must be a Monday, to must be the Sunday 6 days later
    const fromDate = new Date(`${result.from}T00:00:00Z`);
    const toDate = new Date(`${result.to}T00:00:00Z`);
    expect(fromDate.getUTCDay()).toBe(1); // Monday
    expect(toDate.getUTCDay()).toBe(0); // Sunday
    // window must contain today
    expect(result.from <= today && today <= result.to).toBe(true);
    // window is exactly 7 days
    const ms = (toDate.getTime() - fromDate.getTime()) / 86_400_000;
    expect(ms).toBe(6);
  });

  it("range=this_month narrows to the calendar month-01 through last-day", () => {
    const today = getBusinessDate();
    const currentMonth = today.slice(0, 7);
    const result = parseReportFilters({ range: "this_month" });

    expect(result.range).toBe("this_month");
    expect(result.from).toBe(`${currentMonth}-01`);
    // to must be the last day of this month
    const [y, m] = currentMonth.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    expect(result.to).toBe(`${currentMonth}-${String(lastDay).padStart(2, "0")}`);
  });

  it("does not expose revenue reports to own-booking-only therapist scope", () => {
    expect(canViewRevenueReports(profile([PERMISSIONS.VIEW_REPORTS_OWN]))).toBe(false);
    expect(canViewRevenueReports(profile([PERMISSIONS.VIEW_REPORTS_OPERATIONAL]))).toBe(false);
    expect(canViewRevenueReports(profile([PERMISSIONS.VIEW_REPORTS_REVENUE]))).toBe(true);
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

  it("builds distinct sorted city options from permitted bookings before city filtering", () => {
    const cityOptions = getCityOptionsFromBookings([
      { service_city: "  Barnet  " },
      { service_city: "Finchley" },
      { service_city: "barnet" },
      { service_city: "" },
      { service_city: null },
    ] as ReportData["bookings"]);

    expect(cityOptions).toEqual(["Barnet", "Finchley"]);
  });
});
