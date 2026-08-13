import { describe, expect, it } from "vitest";
import {
  buildInsightId,
  DEFAULT_INSIGHT_THRESHOLDS,
  formatDurationFromMinutes,
  getReportInsights,
} from "../report-insights";
import type { ReportData, ReportFilters } from "../reporting";

describe("formatDurationFromMinutes", () => {
  it("renders sub-hour values in minutes", () => {
    expect(formatDurationFromMinutes(0)).toBe("0 min");
    expect(formatDurationFromMinutes(15)).toBe("15 min");
    expect(formatDurationFromMinutes(59)).toBe("59 min");
  });

  it("renders 1-23h windows in hours with one decimal under 10h", () => {
    expect(formatDurationFromMinutes(60)).toBe("1.0 hours");
    expect(formatDurationFromMinutes(90)).toBe("1.5 hours");
    expect(formatDurationFromMinutes(540)).toBe("9.0 hours");
  });

  it("renders 10-23h windows as whole hours", () => {
    expect(formatDurationFromMinutes(720)).toBe("12 hours");
    expect(formatDurationFromMinutes(1439)).toBe("24 hours"); // 23.98h → rounded
  });

  it("renders ≥24h windows in days with one decimal under 10 days", () => {
    expect(formatDurationFromMinutes(1440)).toBe("1.0 days");
    expect(formatDurationFromMinutes(9712)).toBe("6.7 days"); // the bug case
    expect(formatDurationFromMinutes(14399)).toBe("10.0 days"); // boundary
  });

  it("renders ≥10-day windows as whole days", () => {
    expect(formatDurationFromMinutes(15000)).toBe("10 days");
    expect(formatDurationFromMinutes(43200)).toBe("30 days");
  });

  it("clamps negative / non-finite inputs to '0 min'", () => {
    expect(formatDurationFromMinutes(-5)).toBe("0 min");
    expect(formatDurationFromMinutes(Number.NaN)).toBe("0 min");
    expect(formatDurationFromMinutes(Number.POSITIVE_INFINITY)).toBe("0 min");
  });
});

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
    staffAvailabilityRuleStaffIds: [],
    staffAvailabilityRules: [],
    ...overrides,
  };
}

function bookingFixture(overrides: Partial<ReportData["bookings"][number]> = {}): ReportData["bookings"][number] {
  return {
    id: overrides.id ?? "b-x",
    client_id: null,
    booking_date: "",
    start_time: "",
    end_time: "",
    status: "completed",
    payment_status: "paid",
    assignment_status: "assigned",
    reschedule_status: "none",
    customer_cancelled_at: null,
    total_price: 50,
    amount_due: 50,
    amount_paid: 50,
    booking_source: "website",
    contact_full_name: null,
    contact_email: null,
    contact_phone: null,
    service_city: null,
    service_postcode: null,
    service_address_line1: null,
    health_notes: null,
    created_at: "",
    ...overrides,
  };
}

function staffFixture(id: string, name: string): ReportData["staff"][number] {
  return {
    id,
    name,
    gender: "female",
    active: true,
    can_take_bookings: true,
    availability_mode: "custom",
    role_id: "role-therapist",
    roles: null,
  };
}

/**
 * One period in which `staff-b` worked `09:00`-`endTime` against a single
 * 8-hour working day — the smallest shape that gives `getUtilisationRate` a
 * non-zero numerator AND denominator, which rule 4 needs in BOTH periods
 * before it will fire.
 *
 * Rule 4 had never executed in this suite: every fixture above sets
 * `staff: []`, so the loop it lives in never had a body to run.
 */
function utilisationPeriod(from: string, to: string, endTime: string): ReportData {
  return reportData({
    filters: filters({ from, to }),
    bookings: [
      bookingFixture({ id: `b-${from}`, booking_date: from, start_time: "09:00", end_time: endTime }),
    ],
    assignments: [
      {
        id: `a-${from}`,
        booking_id: `b-${from}`,
        participant_id: null,
        assigned_staff_id: "staff-b",
        required_therapist_gender: "female",
        status: "completed",
        staff_profiles: null,
      },
    ],
    staff: [staffFixture("staff-a", "Amina Viewer"), staffFixture("staff-b", "Bilqis Colleague")],
    staffAvailabilityRuleStaffIds: ["staff-b"],
    staffAvailabilityRules: [
      { staff_id: "staff-b", day_of_week: 1, start_time: "09:00", end_time: "17:00", is_working_day: true },
    ],
  });
}

describe("buildInsightId", () => {
  it("composes category/bucket/period/yyyy-mm in a stable order", () => {
    expect(buildInsightId("bookings-dropped", "20pct", "month", "2026-05")).toBe(
      "bookings-dropped-20pct-month-2026-05"
    );
  });
});

describe("getReportInsights", () => {
  it("returns [] when priorData is null", () => {
    expect(getReportInsights(reportData({}), null)).toEqual([]);
  });

  it("returns [] when no thresholds tripped", () => {
    const stable = reportData({
      bookings: Array.from({ length: 10 }, (_, i) => bookingFixture({ id: `b${i}` })),
    });
    expect(getReportInsights(stable, stable)).toEqual([]);
  });

  it("flags critical bookings-drop when current is >30% below prior", () => {
    const current = reportData({
      bookings: Array.from({ length: 5 }, (_, i) => bookingFixture({ id: `c${i}` })),
    });
    const prior = reportData({
      bookings: Array.from({ length: 10 }, (_, i) => bookingFixture({ id: `p${i}` })),
    });
    const insights = getReportInsights(current, prior);
    const dropInsight = insights.find((i) => i.id.startsWith("bookings-dropped-critical"));
    expect(dropInsight?.severity).toBe("critical");
    expect(dropInsight?.message).toContain("50%");
  });

  it("flags net-collection-low as critical when below the 90% threshold", () => {
    const current = reportData({
      bookings: [bookingFixture({ id: "b1", total_price: 100, amount_paid: 80 })],
    });
    const prior = reportData({ bookings: [] });
    const insights = getReportInsights(current, prior);
    expect(insights.find((i) => i.id.startsWith("collection-low"))?.severity).toBe("critical");
  });

  it("respects dismissedIds filter", () => {
    const current = reportData({
      bookings: Array.from({ length: 5 }, (_, i) => bookingFixture({ id: `c${i}` })),
    });
    const prior = reportData({
      bookings: Array.from({ length: 10 }, (_, i) => bookingFixture({ id: `p${i}` })),
    });
    const unfiltered = getReportInsights(current, prior);
    expect(unfiltered.length).toBeGreaterThan(0);
    const dismissed = new Set(unfiltered.map((i) => i.id));
    expect(getReportInsights(current, prior, dismissed)).toEqual([]);
  });

  it("caps the returned list at maxInsights", () => {
    const current = reportData({
      bookings: Array.from({ length: 1 }, () => bookingFixture({ id: "b1", total_price: 100, amount_paid: 10 })),
    });
    const prior = reportData({
      bookings: Array.from({ length: 50 }, (_, i) => bookingFixture({ id: `p${i}` })),
    });
    const insights = getReportInsights(current, prior, new Set(), { maxInsights: 1 });
    expect(insights.length).toBe(1);
  });

  // ── rule 4, per-staff utilisation ────────────────────────────────────────
  //
  // This rule is the reason `reports-data.ts` narrows the roster before the
  // rules see it (ITEM N): it renders a PERSON'S NAME and a drill link to
  // their profile. Pinned here as the exact string, because the string is the
  // disclosure — see ./reports-data.test.ts for the guard that governs it.
  it("names the staff member whose utilisation dropped, and links to them", () => {
    const current = utilisationPeriod("2026-06-01", "2026-06-30", "10:00"); // 1h booked
    const prior = utilisationPeriod("2026-05-01", "2026-05-31", "15:00"); // 6h booked

    const insight = getReportInsights(current, prior).find((i) =>
      i.id.startsWith("staff-utilisation-")
    );

    expect(insight?.message).toBe(
      "Bilqis Colleague's utilisation dropped from 17% to 3% this month."
    );
    expect(insight?.drillUrl).toBe("/admin/staff/staff-b?range=month");
  });

  it("stays silent when the roster is empty, whatever the bookings did", () => {
    // The pre-existing fixtures' condition, pinned so it reads as a deliberate
    // case rather than an oversight.
    const current = { ...utilisationPeriod("2026-06-01", "2026-06-30", "10:00"), staff: [] };
    const prior = { ...utilisationPeriod("2026-05-01", "2026-05-31", "15:00"), staff: [] };

    expect(
      getReportInsights(current, prior).some((i) => i.id.startsWith("staff-utilisation-"))
    ).toBe(false);
  });

  it("uses 5%-bucket rounding for ID stability (AUDIT M10)", () => {
    // 17% drop → 15pct bucket; 18% drop → 20pct bucket — both round to the
    // closest 5%-bucket. The dismiss persistence depends on this.
    const make = (currCount: number, priorCount: number) => {
      const current = reportData({
        bookings: Array.from({ length: currCount }, (_, i) => bookingFixture({ id: `c${i}` })),
      });
      const prior = reportData({
        bookings: Array.from({ length: priorCount }, (_, i) => bookingFixture({ id: `p${i}` })),
      });
      return getReportInsights(current, prior).find((i) => i.id.startsWith("bookings-dropped"));
    };
    // 17/100 drop = 17% → bucket=15
    const a = make(83, 100);
    expect(a?.id).toContain("15pct");
    // Default thresholds are unchanged here — verify the const is exported.
    expect(DEFAULT_INSIGHT_THRESHOLDS.bookingsDropWarningPct).toBe(15);
  });
});
