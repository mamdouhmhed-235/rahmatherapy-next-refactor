// C-15 Phase A — Step 5 tests.
//
// 1. Registry completeness: every template has a subjectDefault, every field
//    a non-empty defaultValue.
// 2. Length-cap (D13): every maxLength <= 500 and every defaultValue fits
//    inside its own field's maxLength — guards the email_template_overrides
//    DB CHECK (migration 20260519120000).
// 3. Render-parity (load-bearing, plan §3.2): every template, rendered with
//    zero overrides, byte-identical to a fixture captured from the
//    UNMODIFIED pre-Phase-A code (render-parity-baseline.json). Proves the
//    registry expansion + renderer copy-lift changed no live email. See the
//    C-15 progress file §1 for the capture procedure and the one documented
//    ground-truth deviation (enquiry_logged's subject).
// 4. Existing override rows still honoured — email_template_overrides is
//    empty in production today (verified 2026-07-31), so this uses mock
//    rows rather than real data (per the C-C dispatch's explicit guidance).

import { describe, expect, it, vi } from "vitest";
import baseline from "./__fixtures__/render-parity-baseline.json";
import {
  ADMIN_CANCELLATION_INPUT,
  ADMIN_NOTIFICATION_INPUT,
  BASE_INPUT,
  CHANGE_SUMMARY_INPUT,
  ENQUIRY_INPUT,
  RESCHEDULE_INPUT,
  RESTORED_FROM_CANCELLED_INPUT,
  RESTORED_FROM_COMPLETED_INPUT,
  REVIEW_INPUT,
  THERAPIST_INPUT,
} from "./__fixtures__/parity-sample-inputs";

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  })),
}));

import { TEMPLATES, findTemplate } from "@/app/admin/emails/components/templates-data";
import {
  renderAdminBookingCancellationEmail,
  renderAdminBookingNotificationEmail,
  renderAdminRescheduleRequestEmail,
  renderBookingCancellationEmail,
  renderBookingConfirmationEmail,
  renderBookingConfirmedClientEmail,
  renderBookingConfirmedClientPlainText,
  renderBookingPlainText,
  renderBookingReminderEmail,
  renderBookingRestoredEmail,
  renderClaimNotificationEmail,
  renderClaimNotificationPlainText,
  renderClientAssignedTherapistEmail,
  renderClientAssignedTherapistPlainText,
  renderEnquiryLoggedEmail,
  renderEnquiryLoggedPlainText,
  renderReviewRequestEmail,
  renderReviewRequestPlainText,
  renderStaffAssignmentEmail,
  renderStaffBookingChangeEmail,
  renderStaffUnassignmentEmail,
  renderStaffUnassignmentPlainText,
  pickReviewMessages,
} from "../templates";

describe("registry completeness", () => {
  it("every template has a non-empty subjectDefault", () => {
    for (const template of TEMPLATES) {
      expect(template.subjectDefault, template.id).toBeTruthy();
    }
  });

  it("every field has a non-empty defaultValue", () => {
    for (const template of TEMPLATES) {
      for (const field of template.fields) {
        expect(field.defaultValue, `${template.id}.${field.kind}`).toBeTruthy();
      }
    }
  });

  it("booking_restored_client is registered (C-15 Phase A, SIX THINGS item 3)", () => {
    const template = findTemplate("booking_restored_client");
    expect(template).toBeDefined();
    expect(template?.audience).toBe("customer");
    expect(template?.fields.some((f) => f.kind === "greeting_intro")).toBe(true);
    expect(template?.fields.some((f) => f.kind === "footer_contact")).toBe(true);
  });

  it("has 18 registered templates", () => {
    expect(TEMPLATES.length).toBe(18);
  });
});

describe("D13 length cap", () => {
  it("every field maxLength is <= 500 (email_template_overrides.value DB CHECK)", () => {
    for (const template of TEMPLATES) {
      for (const field of template.fields) {
        expect(field.maxLength, `${template.id}.${field.kind}`).toBeLessThanOrEqual(500);
      }
    }
  });

  it("every subject field keeps the tight ~100 cap, not the blanket 500", () => {
    for (const template of TEMPLATES) {
      const subject = template.fields.find((f) => f.kind === "subject");
      expect(subject, template.id).toBeDefined();
      expect(subject!.maxLength).toBeLessThanOrEqual(100);
    }
  });

  it("every defaultValue fits inside its own field's maxLength", () => {
    for (const template of TEMPLATES) {
      for (const field of template.fields) {
        expect(
          field.defaultValue.length,
          `${template.id}.${field.kind} defaultValue vs maxLength ${field.maxLength}`
        ).toBeLessThanOrEqual(field.maxLength);
      }
    }
  });
});

describe("render-parity (load-bearing — plan §3.2)", () => {
  it("renders every template with zero overrides byte-identical to the pre-Phase-A fixture", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const variants = pickReviewMessages({
      groupCategory: REVIEW_INPUT.groupCategory,
      city: REVIEW_INPUT.city,
      overrides: {},
    });

    const actual: Record<string, { html?: string; text?: string }> = {
      booking_confirmation: { html: renderBookingConfirmationEmail(BASE_INPUT) },
      booking_cancellation_client: { html: renderBookingCancellationEmail(BASE_INPUT) },
      booking_reminder: { html: renderBookingReminderEmail(BASE_INPUT) },
      booking_plain_text: {
        text: renderBookingPlainText("Booking confirmation", BASE_INPUT),
      },
      staff_assignment: { html: renderStaffAssignmentEmail(BASE_INPUT) },
      staff_booking_change: { html: renderStaffBookingChangeEmail(CHANGE_SUMMARY_INPUT) },
      admin_booking_notification: {
        html: renderAdminBookingNotificationEmail(ADMIN_NOTIFICATION_INPUT),
      },
      admin_booking_cancellation: {
        html: renderAdminBookingCancellationEmail(ADMIN_CANCELLATION_INPUT),
      },
      admin_reschedule_request: {
        html: renderAdminRescheduleRequestEmail(RESCHEDULE_INPUT),
      },
      review_request_client: {
        html: await renderReviewRequestEmail(REVIEW_INPUT),
        text: renderReviewRequestPlainText(REVIEW_INPUT, variants),
      },
      booking_confirmed_client: {
        html: await renderBookingConfirmedClientEmail(BASE_INPUT),
        text: renderBookingConfirmedClientPlainText(BASE_INPUT),
      },
      staff_unassignment: {
        html: await renderStaffUnassignmentEmail(THERAPIST_INPUT),
        text: renderStaffUnassignmentPlainText(THERAPIST_INPUT),
      },
      claim: {
        html: await renderClaimNotificationEmail(THERAPIST_INPUT),
        text: renderClaimNotificationPlainText(THERAPIST_INPUT),
      },
      client_assigned_therapist: {
        html: await renderClientAssignedTherapistEmail(THERAPIST_INPUT),
        text: renderClientAssignedTherapistPlainText(THERAPIST_INPUT),
      },
      enquiry_logged: {
        html: await renderEnquiryLoggedEmail(ENQUIRY_INPUT),
        text: renderEnquiryLoggedPlainText(ENQUIRY_INPUT),
      },
      booking_restored_client__from_cancelled: {
        html: renderBookingRestoredEmail(RESTORED_FROM_CANCELLED_INPUT),
        text: renderBookingPlainText("Booking restored", BASE_INPUT),
      },
      booking_restored_client__from_completed: {
        html: renderBookingRestoredEmail(RESTORED_FROM_COMPLETED_INPUT),
      },
    };

    randomSpy.mockRestore();

    const baselineTyped = baseline as Record<string, { html?: string; text?: string }>;
    for (const [key, legs] of Object.entries(baselineTyped)) {
      for (const [leg, expected] of Object.entries(legs)) {
        expect(
          (actual[key] as Record<string, string> | undefined)?.[leg],
          `${key}.${leg}`
        ).toBe(expected);
      }
    }
    // Symmetric check: nothing in `actual` that the baseline doesn't cover
    // (a silently-dropped template would slip through the loop above).
    expect(Object.keys(actual).sort()).toEqual(Object.keys(baselineTyped).sort());
  });
});

describe("existing override rows still honoured", () => {
  // email_template_overrides is empty in production (verified 2026-07-31),
  // so this uses mock rows rather than real data.
  it("an existing greeting_intro + footer_contact override reaches the rendered output", () => {
    const overrides = {
      greeting_intro: "Salaam {clientName}, your booking with {companyName} is in.",
      footer_contact: "Reach us on {contactPhone}.",
    };
    const html = renderBookingConfirmationEmail(BASE_INPUT, overrides);
    expect(html).toContain("Salaam Aisha Khan, your booking with Rahma Therapy is in.");
    expect(html).toContain("Reach us on 07000 000000.");
  });

  it("an existing subject override reaches the rendered <title>", () => {
    const html = renderBookingConfirmationEmail(BASE_INPUT, {
      subject: "Custom subject line",
    });
    expect(html).toContain("<title>Custom subject line</title>");
  });

  it("a subject override with an embedded control character falls back to the default (render-time guard)", () => {
    const html = renderBookingConfirmationEmail(BASE_INPUT, {
      subject: "Injected\r\nBcc: attacker@example.test",
    });
    expect(html).toContain("<title>Booking request received</title>");
    expect(html).not.toContain("Bcc: attacker");
  });

  it("an existing review-variant override reaches the rendered output", async () => {
    const overrides = {
      massage_variant_1: "Admin-configured sample review one.",
      massage_variant_2: "Admin-configured sample review two.",
      massage_variant_3: "Admin-configured sample review three.",
      massage_variant_4: "Admin-configured sample review four.",
      massage_variant_5: "Admin-configured sample review five.",
    };
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const variants = pickReviewMessages({
      groupCategory: "massage",
      city: "Luton",
      overrides,
    });
    randomSpy.mockRestore();
    expect(variants.every((v) => v.text.startsWith("Admin-configured sample review"))).toBe(
      true
    );
  });
});

describe("empty-string override falls back to default (C-15 Phase B fix, direct render path)", () => {
  // Phase A's copy-lift rewrote these sites from `overrides.x ? f(overrides.x) : hardcoded`
  // to `overrides.x ?? fieldDefault(...)`. `??` only falls back on
  // null/undefined, so an override of "" used to WIN and render a blank
  // paragraph. Fixed to `overrides.x || fieldDefault(...)` (templates.ts).
  // "Empty means default" is the established semantic everywhere else
  // (saveTemplateOverride deletes the row on an empty value rather than
  // storing "") — this asserts every site Phase A touched, not just the
  // five the Phase A verifier happened to enumerate, treats "" identically
  // to no override at all. The draft-merge path (Step 7's POST preview
  // handler) gets its own coverage once it exists — see
  // preview-post.test.ts's "draft merge" describe block.
  it("every fixed site renders an empty-string override byte-identical to no override", () => {
    const variants = pickReviewMessages({
      groupCategory: REVIEW_INPUT.groupCategory,
      city: REVIEW_INPUT.city,
      overrides: {},
    });

    const cases: { name: string; withEmpty: string; withNone: string }[] = [
      {
        name: "booking_confirmation.greeting_intro",
        withEmpty: renderBookingConfirmationEmail(BASE_INPUT, { greeting_intro: "" }),
        withNone: renderBookingConfirmationEmail(BASE_INPUT, {}),
      },
      {
        name: "booking_cancellation_client.greeting_intro",
        withEmpty: renderBookingCancellationEmail(BASE_INPUT, { greeting_intro: "" }),
        withNone: renderBookingCancellationEmail(BASE_INPUT, {}),
      },
      {
        name: "staff_assignment.intro",
        withEmpty: renderStaffAssignmentEmail(BASE_INPUT, { intro: "" }),
        withNone: renderStaffAssignmentEmail(BASE_INPUT, {}),
      },
      {
        name: "staff_booking_change.wrapper_change_summary",
        withEmpty: renderStaffBookingChangeEmail(CHANGE_SUMMARY_INPUT, {
          wrapper_change_summary: "",
        }),
        withNone: renderStaffBookingChangeEmail(CHANGE_SUMMARY_INPUT, {}),
      },
      {
        name: "booking_reminder.intro",
        withEmpty: renderBookingReminderEmail(BASE_INPUT, { intro: "" }),
        withNone: renderBookingReminderEmail(BASE_INPUT, {}),
      },
      {
        name: "review_request_client.body_intro",
        withEmpty: renderReviewRequestPlainText(REVIEW_INPUT, variants, { body_intro: "" }),
        withNone: renderReviewRequestPlainText(REVIEW_INPUT, variants, {}),
      },
      {
        name: "review_request_client.body_ask",
        withEmpty: renderReviewRequestPlainText(REVIEW_INPUT, variants, { body_ask: "" }),
        withNone: renderReviewRequestPlainText(REVIEW_INPUT, variants, {}),
      },
      {
        name: "review_request_client.body_cta_label",
        withEmpty: renderReviewRequestPlainText(REVIEW_INPUT, variants, { body_cta_label: "" }),
        withNone: renderReviewRequestPlainText(REVIEW_INPUT, variants, {}),
      },
      {
        name: "review_request_client.body_signoff",
        withEmpty: renderReviewRequestPlainText(REVIEW_INPUT, variants, { body_signoff: "" }),
        withNone: renderReviewRequestPlainText(REVIEW_INPUT, variants, {}),
      },
      {
        name: "booking_confirmed_client.body_intro",
        withEmpty: renderBookingConfirmedClientPlainText(BASE_INPUT, { body_intro: "" }),
        withNone: renderBookingConfirmedClientPlainText(BASE_INPUT, {}),
      },
      {
        name: "booking_confirmed_client.body_cta_label",
        withEmpty: renderBookingConfirmedClientPlainText(BASE_INPUT, { body_cta_label: "" }),
        withNone: renderBookingConfirmedClientPlainText(BASE_INPUT, {}),
      },
      {
        name: "booking_confirmed_client.body_signoff",
        withEmpty: renderBookingConfirmedClientPlainText(BASE_INPUT, { body_signoff: "" }),
        withNone: renderBookingConfirmedClientPlainText(BASE_INPUT, {}),
      },
      {
        name: "staff_unassignment.body_intro",
        withEmpty: renderStaffUnassignmentPlainText(THERAPIST_INPUT, { body_intro: "" }),
        withNone: renderStaffUnassignmentPlainText(THERAPIST_INPUT, {}),
      },
      {
        name: "claim.body_intro",
        withEmpty: renderClaimNotificationPlainText(THERAPIST_INPUT, { body_intro: "" }),
        withNone: renderClaimNotificationPlainText(THERAPIST_INPUT, {}),
      },
      {
        name: "client_assigned_therapist.body_intro",
        withEmpty: renderClientAssignedTherapistPlainText(THERAPIST_INPUT, { body_intro: "" }),
        withNone: renderClientAssignedTherapistPlainText(THERAPIST_INPUT, {}),
      },
      {
        name: "client_assigned_therapist.body_cta_label",
        withEmpty: renderClientAssignedTherapistPlainText(THERAPIST_INPUT, {
          body_cta_label: "",
        }),
        withNone: renderClientAssignedTherapistPlainText(THERAPIST_INPUT, {}),
      },
      {
        name: "enquiry_logged.body_intro",
        withEmpty: renderEnquiryLoggedPlainText(ENQUIRY_INPUT, { body_intro: "" }),
        withNone: renderEnquiryLoggedPlainText(ENQUIRY_INPUT, {}),
      },
    ];

    for (const { name, withEmpty, withNone } of cases) {
      expect(withEmpty, name).toBe(withNone);
      // Guards against a vacuous pass where both sides are empty strings.
      expect(withEmpty.trim().length, name).toBeGreaterThan(0);
    }
  });
});
