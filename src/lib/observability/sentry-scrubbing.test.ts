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

  // D9 (2026-08-17) — TRANSACTION-shaped events.
  //
  // scrubSentryEvent was wired only to beforeSend, which sees ERROR events.
  // Performance transactions go through beforeSendTransaction, which did not
  // exist, so /booking/manage?token=... reached Sentry unscrubbed at
  // tracesSampleRate 0.1 in production. F9 wired it up; nothing asserted it.
  it("redacts the manage token from a transaction URL while keeping trace stitching intact", () => {
    const token = "3f2504e0-4f89-11d3-9a0c-0305e82c3301"; // randomUUID shape, 36 chars
    const scrubbed = scrubSentryEvent({
      type: "transaction",
      transaction: "/booking/manage",
      contexts: {
        trace: {
          trace_id: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
          span_id: "1234567890abcdef",
          op: "pageload",
          status: "ok",
        },
      },
      // Deliberately NOT the live origin: canonical-domain.test.ts fails on a
      // second hard-coded literal of it anywhere under src/, comments included
      // (gotcha 92). The scrubbing behaviour is identical for any host.
      request: { url: `https://example.test/booking/manage?token=${token}` },
    } as never) as Record<string, never>;

    // The token must not survive anywhere in the serialised event.
    expect(JSON.stringify(scrubbed)).not.toContain(token);

    // ...and the fields Sentry needs to stitch a trace together must survive,
    // or scrubbing would silently break performance monitoring instead.
    const trace = (scrubbed.contexts as Record<string, Record<string, unknown>>).trace;
    expect(trace.trace_id).toBe("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6");
    expect(trace.span_id).toBe("1234567890abcdef");
    expect(scrubbed.type).toBe("transaction");
  });

  it("redacts a bare 36-char UUID by value, not only by key name", () => {
    // The key here (`note`) is NOT in SENSITIVE_KEY_PATTERN, so this passes only
    // if LONG_TOKEN_PATTERN matches the UUID itself — hyphens included, which is
    // the case that makes URL scrubbing work at all.
    const scrubbed = scrubSentryEvent({
      extra: { note: "see 3f2504e0-4f89-11d3-9a0c-0305e82c3301 for detail" },
    } as never) as Record<string, Record<string, string>>;
    expect(scrubbed.extra.note).not.toContain("3f2504e0");
  });
});
