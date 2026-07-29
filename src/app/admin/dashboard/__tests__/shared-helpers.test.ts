import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAddressLines,
  buildMapsHref,
  formatHours,
  getFirstName,
  getGreeting,
  isViewerAssignedPractitioner,
  type MinimalBookingForPredicate,
} from "../shared-helpers";
import type { ReportBooking } from "../../reports/reporting";

function makeBooking(overrides?: Partial<ReportBooking>): ReportBooking {
  return {
    id: "b-1",
    client_id: "c-1",
    booking_date: "2026-05-25",
    start_time: "11:45:00",
    end_time: "12:45:00",
    status: "confirmed",
    payment_status: "unpaid",
    assignment_status: "assigned",
    reschedule_status: "none",
    customer_cancelled_at: null,
    total_price: null,
    amount_due: null,
    amount_paid: null,
    booking_source: "website",
    contact_full_name: "Aisha Khan",
    contact_email: "aisha@example.test",
    contact_phone: "07700900000",
    service_city: "Luton",
    service_postcode: "LU1 1AA",
    service_address_line1: "1 Park Street",
    health_notes: null,
    created_at: "2026-05-24T10:00:00Z",
    ...overrides,
  };
}

describe("getGreeting", () => {
  // Winter, GMT (no DST offset), so the Europe/London wall-clock hour equals
  // the UTC hour — keeps the fixture times unambiguous.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'Good morning' at 09:00 London", () => {
    vi.setSystemTime(new Date("2026-01-15T09:00:00.000Z"));
    expect(getGreeting()).toBe("Good morning");
  });

  it("returns 'Good afternoon' at 14:00 London", () => {
    vi.setSystemTime(new Date("2026-01-15T14:00:00.000Z"));
    expect(getGreeting()).toBe("Good afternoon");
  });

  it("returns 'Good evening' at 20:00 London", () => {
    vi.setSystemTime(new Date("2026-01-15T20:00:00.000Z"));
    expect(getGreeting()).toBe("Good evening");
  });
});

describe("getFirstName", () => {
  it("returns the first word of a full name", () => {
    expect(getFirstName("Sara Mohamed")).toBe("Sara");
  });

  it("returns an empty string for an empty name", () => {
    expect(getFirstName("")).toBe("");
  });
});

describe("formatHours", () => {
  it("formats whole hours without a decimal", () => {
    expect(formatHours(60)).toBe("1h");
    expect(formatHours(120)).toBe("2h");
  });

  it("formats fractional hours to one decimal place", () => {
    expect(formatHours(45)).toBe("0.8h");
    expect(formatHours(30)).toBe("0.5h");
  });

  it("rounds to a whole number once hours reach double digits", () => {
    expect(formatHours(600)).toBe("10h");
  });
});

describe("buildAddressLines", () => {
  it("returns all 3 lines when all fields are populated", () => {
    const booking = makeBooking();
    expect(buildAddressLines(booking)).toEqual([
      "1 Park Street",
      "LU1 1AA",
      "Luton",
    ]);
  });

  it("omits a missing field", () => {
    const booking = makeBooking({ service_postcode: null });
    expect(buildAddressLines(booking)).toEqual(["1 Park Street", "Luton"]);
  });

  it("returns an empty array when all fields are missing", () => {
    const booking = makeBooking({
      service_address_line1: null,
      service_postcode: null,
      service_city: null,
    });
    expect(buildAddressLines(booking)).toEqual([]);
  });
});

describe("buildMapsHref", () => {
  it("returns a Google Maps search URL when an address is present", () => {
    const booking = makeBooking();
    expect(buildMapsHref(booking)).toBe(
      "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("1 Park Street, LU1 1AA, Luton")
    );
  });

  it("returns null when no address is present", () => {
    const booking = makeBooking({
      service_address_line1: null,
      service_postcode: null,
      service_city: null,
    });
    expect(buildMapsHref(booking)).toBeNull();
  });
});

describe("isViewerAssignedPractitioner", () => {
  const viewerStaffId = "staff-1";

  function makeBookingWithAssignment(
    status: string,
    assignedStaffId: string | null = viewerStaffId
  ): MinimalBookingForPredicate {
    return {
      booking_assignments: [
        { assigned_staff_id: assignedStaffId, status },
      ],
    };
  }

  it("returns false when the viewer lacks can_take_bookings, regardless of assignment", () => {
    const booking = makeBookingWithAssignment("assigned");
    expect(isViewerAssignedPractitioner(booking, viewerStaffId, false)).toBe(
      false
    );
  });

  it("returns true when the viewer is assigned with status 'assigned'", () => {
    const booking = makeBookingWithAssignment("assigned");
    expect(isViewerAssignedPractitioner(booking, viewerStaffId, true)).toBe(
      true
    );
  });

  it("returns true when the viewer is assigned with status 'completed' (inclusive predicate — plan overrides brief Q9.2)", () => {
    const booking = makeBookingWithAssignment("completed");
    expect(isViewerAssignedPractitioner(booking, viewerStaffId, true)).toBe(
      true
    );
  });

  it("returns true when the viewer is assigned with status 'no_show'", () => {
    const booking = makeBookingWithAssignment("no_show");
    expect(isViewerAssignedPractitioner(booking, viewerStaffId, true)).toBe(
      true
    );
  });

  it("returns false when the viewer's assignment is 'cancelled'", () => {
    const booking = makeBookingWithAssignment("cancelled");
    expect(isViewerAssignedPractitioner(booking, viewerStaffId, true)).toBe(
      false
    );
  });

  it("returns false when the viewer's assignment is 'unassigned'", () => {
    const booking = makeBookingWithAssignment("unassigned");
    expect(isViewerAssignedPractitioner(booking, viewerStaffId, true)).toBe(
      false
    );
  });

  it("returns false when the viewer is not assigned at all", () => {
    const booking = makeBookingWithAssignment("assigned", "some-other-staff");
    expect(isViewerAssignedPractitioner(booking, viewerStaffId, true)).toBe(
      false
    );
  });
});
