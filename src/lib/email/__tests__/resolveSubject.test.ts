// C-15 closeout fix round — dedicated coverage for the exported
// resolveSubject() (src/lib/email/templates.ts), which real sends
// (notifications.ts) and "Send me a test" (email-templates/actions.ts)
// now share (resolveTestSubject() there is deleted). Three things this
// file exists to prove:
//   1. Zero-override subject == the exact literal each sender has always
//      emitted (brief §10 AC2 — customers' subject lines must not change
//      as a side effect of making subjects editable). Every "expected"
//      value below is copied verbatim from that sender's own
//      template-literal expression in notifications.ts (cross-checked
//      against the pre-existing per-sender spec files, e.g.
//      sendBookingCreatedEmails.test.ts's "Rahma Therapy Test booking
//      request received" assertion, which continues to pass unchanged).
//   2. An override — including one that needs substitution — changes the
//      resolved subject, and unknown/empty overrides behave like the rest
//      of the registry (brief §5.3).
//   3. A control-character override can never reach the resolved subject
//      (render-time guard, mirrors the save-time one in
//      email-templates/actions.ts's validateTemplateFields).
//
// This is separate from registry-defaults.test.ts's render-parity fixture,
// which captures HTML/text BODIES (and the <title> tag, via the renamed,
// unexported resolveTitleSubject()) — it never touches notifications.ts and
// cannot guard the real Subject: header. See the C-15 progress file for the
// full sender-by-sender audit table.

import { describe, expect, it } from "vitest";
import { resolveSubject } from "../templates";
import { TEMPLATES } from "@/app/admin/emails/components/templates-data";

// One row per registered template (18 total): the exact vars a real send
// passes to resolveSubject() for that template, and the literal subject
// that must come out with zero overrides.
const CASES: {
  templateId: string;
  vars: Record<string, unknown>;
  expected: string;
}[] = [
  {
    templateId: "booking_confirmation",
    vars: { companyName: "Rahma Therapy" },
    expected: "Rahma Therapy booking request received",
  },
  {
    templateId: "admin_booking_notification",
    vars: { clientName: "Aisha Khan" },
    expected: "New booking request - Aisha Khan",
  },
  {
    templateId: "booking_cancellation_client",
    vars: { companyName: "Rahma Therapy" },
    expected: "Rahma Therapy booking cancelled",
  },
  {
    templateId: "admin_booking_cancellation",
    vars: { clientName: "Aisha Khan" },
    expected: "Booking cancelled - Aisha Khan",
  },
  {
    templateId: "booking_restored_client",
    vars: { companyName: "Rahma Therapy" },
    expected: "Rahma Therapy — your booking is back on",
  },
  {
    templateId: "admin_reschedule_request",
    vars: { clientName: "Aisha Khan" },
    expected: "Reschedule request - Aisha Khan",
  },
  {
    templateId: "staff_assignment",
    vars: { companyName: "Rahma Therapy" },
    expected: "Rahma Therapy booking assignment",
  },
  {
    templateId: "staff_booking_change",
    vars: { companyName: "Rahma Therapy" },
    expected: "Rahma Therapy assigned booking changed",
  },
  {
    templateId: "booking_reminder",
    vars: { companyName: "Rahma Therapy" },
    expected: "Rahma Therapy booking reminder",
  },
  { templateId: "booking_confirmed_client", vars: {}, expected: "Your booking is confirmed" },
  { templateId: "staff_unassignment", vars: {}, expected: "Booking assignment removed" },
  {
    templateId: "claim",
    vars: { therapistName: "Sara", bookingDate: "2026-07-20" },
    expected: "Slot claimed: Sara → 2026-07-20",
  },
  {
    templateId: "client_assigned_therapist",
    vars: { bookingDate: "2026-07-20" },
    expected: "Your therapist for 2026-07-20",
  },
  {
    templateId: "enquiry_logged",
    vars: { clientName: "Priya Shah" },
    expected: "New enquiry: Priya Shah",
  },
  {
    templateId: "review_request_client",
    vars: {},
    expected: "Thank you for visiting Rahma Therapy",
  },
  // No independent real-send site (its subject always belongs to whichever
  // HTML email it is the plain-text companion of) — still registered, still
  // reachable via "Send me a test", so still covered here.
  { templateId: "booking_plain_text", vars: {}, expected: "Booking confirmation" },
  // C-02 Phase D — no interpolation in this one; the literal is what
  // sendRecurringSeriesCreatedEmail (notifications.ts) actually sends.
  {
    templateId: "recurring_series_created_client",
    vars: {},
    expected: "Your recurring booking is set",
  },
  // C-02 Phase Fb — no interpolation in this one; the literal is what
  // sendRecurringSeriesCancelledEmail (notifications.ts) actually sends.
  {
    templateId: "recurring_series_cancelled_client",
    vars: {},
    expected: "Your recurring booking has been cancelled",
  },
];

describe("resolveSubject — zero-override subject matches the live sender literal", () => {
  it("covers every registered template (18)", () => {
    expect(CASES.map((c) => c.templateId).sort()).toEqual(TEMPLATES.map((t) => t.id).sort());
  });

  for (const { templateId, vars, expected } of CASES) {
    it(`${templateId}: zero overrides -> ${JSON.stringify(expected)}`, () => {
      expect(resolveSubject(templateId, {}, vars)).toBe(expected);
    });
  }
});

describe("resolveSubject — override wins, and interpolates like a body field", () => {
  it("an override replaces the default", () => {
    expect(
      resolveSubject(
        "booking_confirmation",
        { subject: "Custom subject" },
        { companyName: "Rahma Therapy" }
      )
    ).toBe("Custom subject");
  });

  it("an admin-authored override can reference the same tokens body fields use", () => {
    expect(
      resolveSubject(
        "booking_confirmation",
        { subject: "Hi {clientName}, your booking is set" },
        { clientName: "Aisha Khan" }
      )
    ).toBe("Hi Aisha Khan, your booking is set");
  });

  it("an unrecognised token in an override is left literal (brief §5.3)", () => {
    expect(resolveSubject("booking_confirmation", { subject: "See {unknownToken}" }, {})).toBe(
      "See {unknownToken}"
    );
  });

  it("an empty-string override falls back to the default, same as no override at all", () => {
    expect(
      resolveSubject(
        "booking_confirmation",
        { subject: "" },
        { companyName: "Rahma Therapy" }
      )
    ).toBe("Rahma Therapy booking request received");
  });
});

describe("resolveSubject — control-character guard (render-time fallback)", () => {
  it("a stored override with an embedded CR/LF cannot reach the resolved subject", () => {
    const result = resolveSubject(
      "booking_confirmation",
      { subject: "Injected\r\nBcc: attacker@example.test" },
      { companyName: "Rahma Therapy" }
    );
    expect(result).toBe("Rahma Therapy booking request received");
    expect(result).not.toMatch(/[\r\n]/);
    expect(result).not.toContain("Bcc: attacker");
  });

  it("guards the full C0 control-character range, not just \\r\\n", () => {
    const result = resolveSubject("booking_confirmation", { subject: "Bad\x07subject" }, {});
    expect(result).not.toContain("Bad\x07subject");
  });

  it("throws on an unknown template id rather than silently sending an empty subject", () => {
    expect(() => resolveSubject("not_a_real_template", {})).toThrow(/unknown template/);
  });
});
