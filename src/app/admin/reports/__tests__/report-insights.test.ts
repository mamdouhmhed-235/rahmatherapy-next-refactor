import { describe, expect, it } from "vitest";
import {
  buildInsightId,
  DEFAULT_INSIGHT_THRESHOLDS,
  getReportInsights,
} from "../report-insights";
import type { ReportData, ReportFilters } from "../reporting";

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
