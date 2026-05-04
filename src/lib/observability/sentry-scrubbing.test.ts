import { describe, expect, it } from "vitest";
import { scrubSentryEvent } from "./sentry-scrubbing";

describe("scrubSentryEvent", () => {
  it("removes sensitive customer and operational fields while preserving safe context", () => {
    const event = scrubSentryEvent({
      user: {
        id: "staff-a",
        email: "staff@example.test",
        username: "Staff User",
      },
      contexts: {
        request: {
          route: "/admin/bookings",
          statusCode: 500,
          booking_id: "booking-a",
          staff_id: "staff-a",
          contact_email: "client@example.test",
          phone: "07123 456 789",
          postcode: "LU1 1AA",
          health_notes: "Sensitive health note",
          manage_token: "abcdefghijklmnopqrstuvwxyz123456",
        },
      },
    });

    expect(event.user).toEqual({ id: "staff-a" });
    expect(event.contexts?.request).toMatchObject({
      route: "/admin/bookings",
      statusCode: 500,
      booking_id: "booking-a",
      staff_id: "staff-a",
      contact_email: "[Filtered]",
      phone: "[Filtered]",
      postcode: "[Filtered]",
      health_notes: "[Filtered]",
      manage_token: "[Filtered]",
    });
  });
});
