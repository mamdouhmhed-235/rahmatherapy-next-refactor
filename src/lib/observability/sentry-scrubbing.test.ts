import { randomUUID } from "node:crypto";
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

  // D14 (2026-08-19) — the D9 test above pins ONE hard-coded UUID, which is a
  // single sample of a probabilistic property. PHONE_PATTERN ran BEFORE
  // LONG_TOKEN_PATTERN and ate digit runs inside the token, breaking the 24+
  // character run the token pattern needs, so the remainder survived. Measured
  // over 20,000 real randomUUID() values: 15.06% leaked a partial token, up to
  // 18 hex characters. The pinned UUID happened to be one of the ~85% that
  // scrubbed cleanly, so the suite stayed green while the guarantee was false.
  it("redacts EVERY manage token, not just a lucky sample", () => {
    const leaked: string[] = [];

    for (let index = 0; index < 200; index += 1) {
      const token = randomUUID();
      const scrubbed = scrubSentryEvent({
        request: { url: `https://example.test/booking/manage?token=${token}` },
      } as never);

      // Nothing else in this event carries a run of 6+ hex characters (asserted
      // by the control below), so any survivor came from the token.
      const residue = JSON.stringify(scrubbed).match(/[0-9a-f]{6,}/g);
      if (residue) leaked.push(`${token} -> ${residue.join(",")}`);
    }

    expect(leaked).toEqual([]);
  });

  it("control: the scaffolding around the token carries no hex run of its own", () => {
    // Without this, the test above could pass because its needle can never
    // match rather than because the scrubber works (gotcha 109).
    const scrubbed = scrubSentryEvent({
      request: { url: "https://example.test/booking/manage?token=" },
    } as never);
    expect(JSON.stringify(scrubbed).match(/[0-9a-f]{6,}/g)).toBeNull();

    // ...and the same assertion MUST fire on an unscrubbed token, or it proves
    // nothing about the scrubbed case.
    const raw = `https://example.test/booking/manage?token=${randomUUID()}`;
    expect(raw.match(/[0-9a-f]{6,}/g)).not.toBeNull();
  });

  it("still redacts phone numbers after the token/phone order swap", () => {
    // The swap is only free if PHONE_PATTERN still fires. Verified identical
    // output under both orders for these shapes before the change was made.
    for (const note of [
      "call 07700 900123 about it",
      "+44 7700 900123",
      "01582 123456",
    ]) {
      const scrubbed = scrubSentryEvent({ extra: { note } } as never) as Record<
        string,
        Record<string, string>
      >;
      expect(scrubbed.extra.note).toContain("[Filtered]");
      expect(scrubbed.extra.note).not.toContain("900123");
      expect(scrubbed.extra.note).not.toContain("123456");
    }
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
