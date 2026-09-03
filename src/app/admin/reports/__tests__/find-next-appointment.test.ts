import { describe, expect, it } from "vitest";
import { findNextAppointment } from "../reporting";
import type { ReportBooking } from "../reporting";

/**
 * ⛔ WHY THIS FILE EXISTS.
 *
 * `findNextAppointment` had NO test coverage, and it was wrong in a way that was
 * invisible from the outside: it filtered `booking_date > today` — strictly
 * after today — while the dashboard that consumes it loads `from = to = today`.
 * The two could never intersect, so the "Next visit" tile printed "Nothing
 * scheduled" on every single render, including directly above a list of five
 * visits happening that day.
 *
 * The two behaviours below are the contract. Breaking either one puts that
 * contradiction back on the busiest screen in the admin.
 */

const booking = (over: Partial<ReportBooking> & Pick<ReportBooking, "id" | "booking_date" | "start_time">): ReportBooking =>
  ({
    client_id: "c1",
    end_time: "10:00",
    status: "confirmed",
    payment_status: "unpaid",
    assignment_status: "assigned",
    reschedule_status: "none",
    customer_cancelled_at: null,
    total_price: 60,
    amount_due: 60,
    amount_paid: 0,
    booking_source: "admin",
    contact_full_name: null,
    contact_email: null,
    contact_phone: null,
    service_city: null,
    service_postcode: null,
    service_address_line1: null,
    health_notes: null,
    created_at: "2026-09-01T10:00:00Z",
    ...over,
  }) as ReportBooking;

const TODAY = "2026-09-03";

describe("findNextAppointment", () => {
  describe("with nowTime — the dashboard's case", () => {
    it("returns a booking LATER TODAY, which is the whole point", () => {
      const rows = [booking({ id: "later", booking_date: TODAY, start_time: "16:30" })];
      expect(findNextAppointment(rows, TODAY, "09:00")?.id).toBe("later");
    });

    it("ignores a booking that has already started", () => {
      const rows = [booking({ id: "past", booking_date: TODAY, start_time: "08:00" })];
      expect(findNextAppointment(rows, TODAY, "09:00")).toBeNull();
    });

    it("treats a booking starting exactly now as still ahead", () => {
      const rows = [booking({ id: "now", booking_date: TODAY, start_time: "09:00" })];
      expect(findNextAppointment(rows, TODAY, "09:00")?.id).toBe("now");
    });

    it("prefers the soonest, not merely the first in the array", () => {
      const rows = [
        booking({ id: "evening", booking_date: TODAY, start_time: "18:30" }),
        booking({ id: "midday", booking_date: TODAY, start_time: "13:00" }),
        booking({ id: "tomorrow", booking_date: "2026-09-04", start_time: "08:00" }),
      ];
      expect(findNextAppointment(rows, TODAY, "09:00")?.id).toBe("midday");
    });

    it("still skips cancelled and no-show", () => {
      const rows = [
        booking({ id: "cancelled", booking_date: TODAY, start_time: "10:00", status: "cancelled" }),
        booking({ id: "noshow", booking_date: TODAY, start_time: "11:00", status: "no_show" }),
        booking({ id: "real", booking_date: TODAY, start_time: "12:00" }),
      ];
      expect(findNextAppointment(rows, TODAY, "09:00")?.id).toBe("real");
    });
  });

  describe("without nowTime — unchanged for every existing caller", () => {
    it("ignores today entirely, however far ahead the booking is", () => {
      const rows = [booking({ id: "later", booking_date: TODAY, start_time: "23:00" })];
      expect(findNextAppointment(rows, TODAY)).toBeNull();
    });

    it("returns the soonest future booking", () => {
      const rows = [
        booking({ id: "far", booking_date: "2026-09-10", start_time: "09:00" }),
        booking({ id: "near", booking_date: "2026-09-04", start_time: "15:00" }),
      ];
      expect(findNextAppointment(rows, TODAY)?.id).toBe("near");
    });
  });

  it("returns null on an empty list rather than throwing", () => {
    expect(findNextAppointment([], TODAY, "09:00")).toBeNull();
  });
});
