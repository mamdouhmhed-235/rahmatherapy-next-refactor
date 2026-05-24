import { describe, expect, it } from "vitest";
import { getClientLifetimeMetrics, getRepeatStatus } from "../client-metrics";
import type { ClientBookingRecord } from "../types";

function booking(overrides: Partial<ClientBookingRecord> = {}): ClientBookingRecord {
  return {
    id: overrides.id ?? "b-x",
    client_id: overrides.client_id ?? "c1",
    booking_date: overrides.booking_date ?? "2026-06-10",
    start_time: "09:00",
    end_time: "10:00",
    status: overrides.status ?? "completed",
    payment_status: "paid",
    assignment_status: "assigned",
    group_booking: false,
    total_price: overrides.total_price ?? 50,
    amount_due: 50,
    amount_paid: overrides.amount_paid ?? 50,
    service_city: null,
    service_postcode: null,
    created_at: "2026-06-01T00:00:00Z",
    booking_items: overrides.booking_items ?? [
      { service_name_snapshot: "Massage", service_price_snapshot: 50, service_duration_snapshot: 60 },
    ],
  };
}

describe("getRepeatStatus", () => {
  it("buckets by completed-count thresholds (<2 new, 2–4 returning, 5–9 regular, ≥10 loyal)", () => {
    expect(getRepeatStatus(0)).toBe("new");
    expect(getRepeatStatus(1)).toBe("new");
    expect(getRepeatStatus(2)).toBe("returning");
    expect(getRepeatStatus(4)).toBe("returning");
    expect(getRepeatStatus(5)).toBe("regular");
    expect(getRepeatStatus(9)).toBe("regular");
    expect(getRepeatStatus(10)).toBe("loyal");
    expect(getRepeatStatus(99)).toBe("loyal");
  });
});

describe("getClientLifetimeMetrics", () => {
  it("returns zero-filled object when client has no completed bookings", () => {
    const result = getClientLifetimeMetrics("c1", []);
    expect(result.visitCount).toBe(0);
    expect(result.completedCount).toBe(0);
    expect(result.ltv).toBe(0);
    expect(result.repeatStatus).toBe("new");
    expect(result.preferredService).toBeNull();
    expect(result.lastSeenAt).toBeNull();
    expect(result.monthlyVisitsSeries.length).toBe(12);
    expect(result.monthlyVisitsSeries.every((m) => m.count === 0)).toBe(true);
  });

  it("computes LTV as the sum of amount_paid across completed bookings (matching summarizeReports.completedRevenue)", () => {
    const result = getClientLifetimeMetrics("c1", [
      booking({ id: "b1", amount_paid: 50 }),
      booking({ id: "b2", amount_paid: 70 }),
      // cancelled bookings don't add to LTV
      booking({ id: "b3", amount_paid: 999, status: "cancelled" }),
    ]);
    expect(result.ltv).toBe(120);
    expect(result.visitCount).toBe(2);
    expect(result.completedCount).toBe(2);
    expect(result.cancelledCount).toBe(1);
    expect(result.avgBookingValue).toBe(60);
  });

  it("maps to 'loyal' at 10+ completed visits", () => {
    const tenCompleted = Array.from({ length: 10 }, (_, i) =>
      booking({ id: `b${i}`, booking_date: `2026-06-${(i + 1).toString().padStart(2, "0")}` })
    );
    expect(getClientLifetimeMetrics("c1", tenCompleted).repeatStatus).toBe("loyal");
  });

  it("picks the most-booked service as preferredService; deterministic alphabetical tie-break", () => {
    const result = getClientLifetimeMetrics("c1", [
      booking({ id: "b1", booking_items: [{ service_name_snapshot: "Sports", service_price_snapshot: 50, service_duration_snapshot: 60 }] }),
      booking({ id: "b2", booking_items: [{ service_name_snapshot: "Sports", service_price_snapshot: 50, service_duration_snapshot: 60 }] }),
      booking({ id: "b3", booking_items: [{ service_name_snapshot: "Deep Tissue", service_price_snapshot: 50, service_duration_snapshot: 60 }] }),
    ]);
    expect(result.preferredService).toBe("Sports");
  });

  it("ignores bookings belonging to other clients (defensive filter)", () => {
    const result = getClientLifetimeMetrics("c1", [
      booking({ id: "b1", client_id: "c1" }),
      booking({ id: "b2", client_id: "c-other", amount_paid: 999 }),
    ]);
    expect(result.ltv).toBe(50); // c-other booking excluded
  });

  it("builds a 12-month sparkline anchored to the most recent visit", () => {
    const result = getClientLifetimeMetrics("c1", [
      booking({ id: "b1", booking_date: "2026-06-10" }),
      booking({ id: "b2", booking_date: "2026-06-25" }),
      booking({ id: "b3", booking_date: "2026-05-01" }),
    ]);
    expect(result.monthlyVisitsSeries.length).toBe(12);
    const recent = result.monthlyVisitsSeries[result.monthlyVisitsSeries.length - 1];
    expect(recent.month).toBe("2026-06");
    expect(recent.count).toBe(2);
  });
});
