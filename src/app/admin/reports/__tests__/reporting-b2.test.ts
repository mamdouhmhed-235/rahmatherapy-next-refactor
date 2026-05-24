import { describe, expect, it } from "vitest";
import {
  buildPriorPeriodFilters,
  filterReportDataToStaff,
  getAvgBookingValue,
  getNetCollectionRate,
  getNoShowRate,
  getRetentionRate,
  getSourceAttribution,
  getStaffScorecard,
  getUtilisationRate,
  type AuditEventRow,
  type ReportData,
  type ReportFilters,
  AUDIT_ACTION_TYPES,
} from "../reporting";

// Local fixture factory mirroring the pattern in reporting.test.ts. Each new
// helper has its own narrowed expectations; the factory provides safe defaults
// for the fields not under test in that case.
function filters(overrides: Partial<ReportFilters> = {}): ReportFilters {
  return {
    range: "month",
    from: "2026-06-01",
    to: "2026-06-30",
    staffId: "",
    service: "",
    source: "",
    status: "",
    paymentStatus: "",
    city: "",
    ...overrides,
  };
}

function reportData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    filters: filters(),
    bookings: [],
    cityOptions: [],
    assignments: [],
    bookingItems: [],
    clients: [],
    staff: [],
    enquiries: [],
    emailEvents: [],
    operationalEvents: [],
    staffAvailabilityRuleStaffIds: new Set(),
    staffAvailabilityRules: [],
    ...overrides,
  };
}

describe("buildPriorPeriodFilters", () => {
  it("returns the immediately-preceding month for range=month", () => {
    const prior = buildPriorPeriodFilters(
      filters({ range: "month", from: "2026-06-01", to: "2026-06-30" })
    );
    expect(prior).toMatchObject({ from: "2026-05-02", to: "2026-05-31", range: "custom" });
    // 30-day inclusive span shifted back; the helper uses inclusive day count.
  });

  it("returns the preceding week for range=week", () => {
    const prior = buildPriorPeriodFilters(
      filters({ range: "week", from: "2026-05-25", to: "2026-05-31" })
    );
    expect(prior).toMatchObject({ from: "2026-05-18", to: "2026-05-24" });
  });

  it("returns null for range=lifetime (no meaningful prior period)", () => {
    expect(buildPriorPeriodFilters(filters({ range: "lifetime" }))).toBeNull();
  });

  it("returns null when from > to (edge case)", () => {
    expect(buildPriorPeriodFilters(filters({ from: "2026-07-01", to: "2026-06-01" }))).toBeNull();
  });
});

describe("filterReportDataToStaff", () => {
  it("narrows bookings, assignments, items, and clients to those touching the staffId", () => {
    const data = reportData({
      assignments: [
        { id: "a1", booking_id: "b1", participant_id: "p1", assigned_staff_id: "staff-a", required_therapist_gender: "any", status: "completed", staff_profiles: { name: "A" } },
        { id: "a2", booking_id: "b2", participant_id: "p2", assigned_staff_id: "staff-b", required_therapist_gender: "any", status: "completed", staff_profiles: { name: "B" } },
      ],
      bookings: [
        { id: "b1", client_id: "c1", booking_date: "2026-06-10", start_time: "09:00", end_time: "10:00", status: "completed", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 50, amount_due: 50, amount_paid: 50, booking_source: "website", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "2026-06-01T10:00:00Z" },
        { id: "b2", client_id: "c2", booking_date: "2026-06-11", start_time: "09:00", end_time: "10:00", status: "completed", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 70, amount_due: 70, amount_paid: 70, booking_source: "website", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "2026-06-01T10:00:00Z" },
      ],
      bookingItems: [
        { id: "i1", booking_id: "b1", booking_participant_id: "p1", service_name_snapshot: "Massage", service_price_snapshot: 50, service_duration_snapshot: 60 },
        { id: "i2", booking_id: "b2", booking_participant_id: "p2", service_name_snapshot: "Massage", service_price_snapshot: 70, service_duration_snapshot: 60 },
      ],
      clients: [
        { id: "c1", full_name: "Aisha", client_source: "website", created_at: "2026-01-01T00:00:00Z" },
        { id: "c2", full_name: "Bob", client_source: "website", created_at: "2026-01-01T00:00:00Z" },
      ],
    });
    const narrowed = filterReportDataToStaff(data, "staff-a");
    expect(narrowed.assignments).toHaveLength(1);
    expect(narrowed.bookings).toHaveLength(1);
    expect(narrowed.bookings[0].id).toBe("b1");
    expect(narrowed.bookingItems).toHaveLength(1);
    expect(narrowed.clients).toEqual([expect.objectContaining({ id: "c1" })]);
  });

  it("returns an empty-ish clone when the staff has no assignments", () => {
    const data = reportData({
      assignments: [{ id: "a1", booking_id: "b1", participant_id: "p1", assigned_staff_id: "staff-other", required_therapist_gender: "any", status: "completed", staff_profiles: { name: "X" } }],
    });
    const narrowed = filterReportDataToStaff(data, "staff-a");
    expect(narrowed.assignments).toEqual([]);
    expect(narrowed.bookings).toEqual([]);
  });

  it("preserves immutability of the input", () => {
    const data = reportData({ assignments: [{ id: "a1", booking_id: "b1", participant_id: null, assigned_staff_id: "staff-a", required_therapist_gender: "any", status: "completed", staff_profiles: null }] });
    filterReportDataToStaff(data, "staff-a");
    expect(data.assignments).toHaveLength(1); // not mutated
  });
});

describe("getUtilisationRate", () => {
  it("computes bookedHours from confirmed/completed assignments and availableHours from rules", () => {
    const data = reportData({
      filters: filters({ from: "2026-06-01", to: "2026-06-07" }), // 1 week = 7 days
      assignments: [
        { id: "a1", booking_id: "b1", participant_id: null, assigned_staff_id: "staff-a", required_therapist_gender: "any", status: "completed", staff_profiles: null },
      ],
      bookings: [
        { id: "b1", client_id: null, booking_date: "2026-06-02", start_time: "09:00", end_time: "11:00", status: "completed", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 100, amount_due: 100, amount_paid: 100, booking_source: "website", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "2026-06-01T10:00:00Z" },
      ],
      staffAvailabilityRules: [
        { staff_id: "staff-a", day_of_week: 1, start_time: "09:00", end_time: "17:00", is_working_day: true }, // 8h
        { staff_id: "staff-a", day_of_week: 2, start_time: "09:00", end_time: "17:00", is_working_day: true }, // 8h, weekly total = 16h
      ],
    });
    const result = getUtilisationRate(data, { staffId: "staff-a" });
    expect(result.bookedHours).toBe(2);
    expect(result.availableHours).toBe(16); // 16h/week × 1 week
    expect(result.rate).toBeCloseTo(2 / 16, 4);
  });

  it("returns 0 rate when no available hours (zero rules)", () => {
    const data = reportData({});
    expect(getUtilisationRate(data).rate).toBe(0);
    expect(getUtilisationRate(data).availableHours).toBe(0);
  });

  it("ignores non-working-day rules", () => {
    const data = reportData({
      filters: filters({ from: "2026-06-01", to: "2026-06-07" }),
      staffAvailabilityRules: [
        { staff_id: "staff-a", day_of_week: 1, start_time: "09:00", end_time: "17:00", is_working_day: false },
      ],
    });
    expect(getUtilisationRate(data, { staffId: "staff-a" }).availableHours).toBe(0);
  });
});

describe("getNoShowRate", () => {
  it("computes the rate across no-show + cancelled bookings", () => {
    const data = reportData({
      bookings: [
        { id: "b1", client_id: null, booking_date: "", start_time: "", end_time: "", status: "completed", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 50, amount_due: 50, amount_paid: 50, booking_source: "", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "" },
        { id: "b2", client_id: null, booking_date: "", start_time: "", end_time: "", status: "no_show", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 50, amount_due: 50, amount_paid: 0, booking_source: "", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "" },
        { id: "b3", client_id: null, booking_date: "", start_time: "", end_time: "", status: "cancelled", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 50, amount_due: 50, amount_paid: 0, booking_source: "", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "" },
      ],
    });
    const result = getNoShowRate(data);
    expect(result.total).toBe(3);
    expect(result.noShows).toBe(1);
    expect(result.cancelled).toBe(1);
    expect(result.rate).toBeCloseTo(2 / 3, 4);
    expect(result.lostRevenue).toBe(100);
  });

  it("returns rate=0 (no NaN) when there are zero bookings", () => {
    const result = getNoShowRate(reportData({}));
    expect(result.rate).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe("getRetentionRate", () => {
  it("counts retained clients above the default threshold of 3", () => {
    const data = reportData({
      bookings: [
        ...Array.from({ length: 3 }, (_, i) => ({ id: `b${i}`, client_id: "c1", booking_date: "", start_time: "", end_time: "", status: "completed", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 0, amount_due: 0, amount_paid: 0, booking_source: "", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "" })),
        { id: "b4", client_id: "c2", booking_date: "", start_time: "", end_time: "", status: "completed", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 0, amount_due: 0, amount_paid: 0, booking_source: "", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "" },
      ],
    });
    const result = getRetentionRate(data);
    expect(result.totalClients).toBe(2);
    expect(result.retainedClients).toBe(1); // only c1 hit 3+
    expect(result.rate).toBeCloseTo(0.5);
  });

  it("honours an overridden threshold", () => {
    const data = reportData({
      bookings: Array.from({ length: 2 }, (_, i) => ({ id: `b${i}`, client_id: "c1", booking_date: "", start_time: "", end_time: "", status: "completed", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 0, amount_due: 0, amount_paid: 0, booking_source: "", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "" })),
    });
    expect(getRetentionRate(data, undefined, 2).rate).toBe(1);
    expect(getRetentionRate(data, undefined, 5).rate).toBe(0);
  });
});

describe("getSourceAttribution", () => {
  it("groups by booking_source, sums revenue, sorts desc, computes percentage", () => {
    const data = reportData({
      bookings: [
        { id: "b1", client_id: null, booking_date: "", start_time: "", end_time: "", status: "completed", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 100, amount_due: 100, amount_paid: 100, booking_source: "website", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "" },
        { id: "b2", client_id: null, booking_date: "", start_time: "", end_time: "", status: "completed", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 50, amount_due: 50, amount_paid: 50, booking_source: "referral", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "" },
      ],
    });
    const result = getSourceAttribution(data);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ source: "website", bookings: 1, revenue: 100 });
    expect(result[0].percentageOfRevenue).toBeCloseTo(100 / 150, 4);
  });

  it("collects null/empty sources under 'Not set'", () => {
    const data = reportData({
      bookings: [{ id: "b1", client_id: null, booking_date: "", start_time: "", end_time: "", status: "completed", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 100, amount_due: 100, amount_paid: 100, booking_source: "", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "" }],
    });
    expect(getSourceAttribution(data)[0].source).toBe("Not set");
  });
});

describe("getNetCollectionRate", () => {
  it("computes collected / billed excluding cancelled + no_show from the denominator", () => {
    const data = reportData({
      bookings: [
        { id: "b1", client_id: null, booking_date: "", start_time: "", end_time: "", status: "completed", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 100, amount_due: 100, amount_paid: 95, booking_source: "", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "" },
        { id: "b2", client_id: null, booking_date: "", start_time: "", end_time: "", status: "cancelled", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 1000, amount_due: 1000, amount_paid: 0, booking_source: "", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "" },
      ],
    });
    const result = getNetCollectionRate(data);
    expect(result.billed).toBe(100);
    expect(result.collected).toBe(95);
    expect(result.rate).toBeCloseTo(0.95, 4);
  });

  it("returns rate=0 (no NaN) when nothing billed", () => {
    expect(getNetCollectionRate(reportData({})).rate).toBe(0);
  });
});

describe("getAvgBookingValue (AUDIT Q2 lock)", () => {
  it("completedRevenue / completedBookingCount; ignores non-completed", () => {
    const data = reportData({
      bookings: [
        { id: "b1", client_id: null, booking_date: "", start_time: "", end_time: "", status: "completed", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 100, amount_due: 100, amount_paid: 90, booking_source: "", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "" },
        { id: "b2", client_id: null, booking_date: "", start_time: "", end_time: "", status: "confirmed", payment_status: "unpaid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 999, amount_due: 999, amount_paid: 0, booking_source: "", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "" },
      ],
    });
    expect(getAvgBookingValue(data)).toBe(90);
  });

  it("returns 0 (no NaN) when no completed bookings", () => {
    expect(getAvgBookingValue(reportData({}))).toBe(0);
  });
});

describe("getStaffScorecard", () => {
  it("returns zero-filled clinical/admin shape when staffId has no activity (never throws)", () => {
    const result = getStaffScorecard(reportData({}), "ghost-staff");
    expect(result.clinical.assignmentsTotal).toBe(0);
    expect(result.clinical.assignmentsCompleted).toBe(0);
    expect(result.clinical.hoursWorked).toBe(0);
    expect(result.admin.enquiriesContactedCount).toBe(0);
    expect(result.deltas).toBeUndefined();
  });

  it("computes clinical deltas when priorData supplied", () => {
    const current = reportData({
      assignments: [
        { id: "a1", booking_id: "b1", participant_id: null, assigned_staff_id: "staff-a", required_therapist_gender: "any", status: "completed", staff_profiles: null },
        { id: "a2", booking_id: "b2", participant_id: null, assigned_staff_id: "staff-a", required_therapist_gender: "any", status: "completed", staff_profiles: null },
      ],
      bookings: [
        { id: "b1", client_id: "c1", booking_date: "", start_time: "09:00", end_time: "10:00", status: "completed", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 50, amount_due: 50, amount_paid: 50, booking_source: "", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "" },
        { id: "b2", client_id: "c2", booking_date: "", start_time: "09:00", end_time: "10:00", status: "completed", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 50, amount_due: 50, amount_paid: 50, booking_source: "", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "" },
      ],
    });
    const prior = reportData({
      assignments: [{ id: "a3", booking_id: "b3", participant_id: null, assigned_staff_id: "staff-a", required_therapist_gender: "any", status: "completed", staff_profiles: null }],
      bookings: [{ id: "b3", client_id: "c1", booking_date: "", start_time: "09:00", end_time: "10:00", status: "completed", payment_status: "paid", assignment_status: "assigned", reschedule_status: "none", customer_cancelled_at: null, total_price: 50, amount_due: 50, amount_paid: 50, booking_source: "", contact_full_name: null, contact_email: null, contact_phone: null, service_city: null, service_postcode: null, service_address_line1: null, health_notes: null, created_at: "" }],
    });
    const result = getStaffScorecard(current, "staff-a", prior);
    expect(result.deltas).toBeDefined();
    expect(result.deltas!.clinical.assignmentsCompleted).toBe(1); // 2 - 1
  });

  it("derives admin counts from audit logs when supplied", () => {
    const data = reportData({
      filters: filters({ from: "2026-06-01", to: "2026-06-30" }),
      enquiries: [
        { id: "e1", full_name: "Aisha", source: "website", status: "booked", created_at: "2026-06-10T10:00:00Z", first_contacted_at: "2026-06-10T10:30:00Z", assigned_staff_id: "staff-a", converted_booking_id: "b1" },
      ],
    });
    const auditLogs: AuditEventRow[] = [
      {
        id: "log-1",
        actor_staff_id: "staff-a",
        action_type: AUDIT_ACTION_TYPES.ENQUIRY_STATUS_UPDATED,
        target_type: "enquiries",
        target_id: "e1",
        before_state: { status: "new" },
        after_state: { status: "contacted" },
        created_at: "2026-06-10T10:30:00Z",
      },
      {
        id: "log-2",
        actor_staff_id: "staff-a",
        action_type: AUDIT_ACTION_TYPES.BOOKING_ASSIGNMENT_REASSIGNED,
        target_type: "booking_assignments",
        target_id: "a1",
        before_state: null,
        after_state: { assigned_staff_id: "other-staff" },
        created_at: "2026-06-15T10:00:00Z",
      },
      {
        id: "log-3",
        actor_staff_id: "staff-a",
        action_type: AUDIT_ACTION_TYPES.OPERATIONAL_EVENT_STATUS_UPDATED,
        target_type: "operational_events",
        target_id: "ev1",
        before_state: { status: "open" },
        after_state: { status: "resolved" },
        created_at: "2026-06-20T10:00:00Z",
      },
    ];
    const result = getStaffScorecard(data, "staff-a", undefined, auditLogs);
    expect(result.admin.enquiriesContactedCount).toBe(1);
    expect(result.admin.bookingsAssignedCount).toBe(1);
    expect(result.admin.opsEventsResolvedCount).toBe(1);
    expect(result.admin.enquiryConversionRate).toBe(1); // contacted + booked + converted_booking_id set
    expect(result.admin.avgMinutesToFirstContact).toBeCloseTo(30, 0); // 30 min between created_at and first_contacted_at
  });

  it("does NOT count the contact transition twice if status was already 'contacted'", () => {
    const data = reportData({
      filters: filters({ from: "2026-06-01", to: "2026-06-30" }),
      enquiries: [{ id: "e1", full_name: "X", source: "website", status: "booked", created_at: "2026-06-10T10:00:00Z", first_contacted_at: "2026-06-10T10:30:00Z", assigned_staff_id: null, converted_booking_id: null }],
    });
    const auditLogs: AuditEventRow[] = [
      // first transition contacted-from-new: counts
      { id: "1", actor_staff_id: "staff-a", action_type: AUDIT_ACTION_TYPES.ENQUIRY_STATUS_UPDATED, target_type: "enquiries", target_id: "e1", before_state: { status: "new" }, after_state: { status: "contacted" }, created_at: "2026-06-10T10:30:00Z" },
      // re-marking contacted from contacted: should NOT count
      { id: "2", actor_staff_id: "staff-a", action_type: AUDIT_ACTION_TYPES.ENQUIRY_STATUS_UPDATED, target_type: "enquiries", target_id: "e1", before_state: { status: "contacted" }, after_state: { status: "contacted" }, created_at: "2026-06-11T10:30:00Z" },
    ];
    expect(getStaffScorecard(data, "staff-a", undefined, auditLogs).admin.enquiriesContactedCount).toBe(1);
  });
});
