import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  pickReviewMessages,
  renderReviewRequestPlainText,
  type ReviewMessageVariant,
  type ReviewRequestEmailInput,
} from "../templates";
import { sendReviewRequestEmail } from "../notifications";

/**
 * C-01 Phase C. `sendReviewRequestEmail` takes its `supabase` client as a
 * parameter (unlike the server actions elsewhere in this codebase), so the
 * stub below is passed straight in rather than routed through a mocked
 * `createSupabaseAdminClient`. The one exception is `resolveTemplateOverrides`
 * (called internally by the real, unmocked `renderReviewRequestEmail`): it
 * creates its own admin client, so that factory is stubbed separately to
 * return empty overrides — the point of these tests is the send function's
 * own control flow, not override-aware rendering (covered by
 * pickReviewMessages.test.ts).
 */

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  })),
}));

vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn(),
  getFromEmail: vi.fn(() => "Rahma Therapy <no-reply@rahmatherapy.example.test>"),
  extractEmailAddress: vi.fn((value: string) => value),
}));

vi.mock("@/lib/ops/operational-events", () => ({
  recordOperationalEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/booking/manage-token", () => ({
  ensureBookingManageUrl: vi.fn().mockResolvedValue(null),
}));

// Real templates.ts throughout — only `pickReviewMessages` is wrapped so its
// call args (from sendReviewRequestEmail's own plain-text variant lookup) are
// assertable. The wrapper still forwards to the real implementation.
vi.mock("../templates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../templates")>();
  return {
    ...actual,
    pickReviewMessages: vi.fn(actual.pickReviewMessages),
  };
});

const CUSTOMER_EMAIL = "aisha@client.example.test";

const SETTINGS = {
  company_name: "Rahma Therapy Test",
  contact_email: "bookings@rahmatherapy.example.test",
  contact_phone: "01582 000000",
};

function baseBooking(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "booking-1",
    contact_full_name: "Aisha Khan",
    contact_email: CUSTOMER_EMAIL,
    contact_phone: "07123456789",
    booking_date: "2026-07-20",
    start_time: "14:00:00",
    end_time: "15:00:00",
    total_price: 55,
    group_booking: false,
    service_address_line1: "10 Test Street",
    service_address_line2: null,
    service_city: "Luton",
    service_postcode: "LU1 1AA",
    access_notes: null,
    customer_notes: null,
    status: "completed",
    completed_at: "2026-07-20T10:00:00.000Z",
    review_email_sent_at: null,
    clients: {
      full_name: "Aisha Khan",
      phone: "07123456789",
      email: CUSTOMER_EMAIL,
      city: "Luton",
    },
    booking_participants: [
      {
        id: "p1",
        participant_gender: "female",
        required_therapist_gender: "female",
        is_main_contact: true,
        display_name: null,
      },
    ],
    booking_items: [
      {
        id: "i1",
        booking_participant_id: "p1",
        service_name_snapshot: "Swedish Massage",
        service_price_snapshot: 55,
        service_duration_snapshot: 60,
      },
    ],
    booking_assignments: [],
    ...overrides,
  };
}

interface RecordedOp {
  table: string;
  op: "select" | "update" | "insert";
  payload?: Record<string, unknown>;
  filters: string[];
}

/**
 * Stand-in for the `supabase` param `sendReviewRequestEmail` receives
 * directly. Covers the chains the function and its helpers build: the
 * sentinel/eligibility read, the no-email/sentinel-marking updates,
 * `getBookingTemplateInput`'s booking + business_settings reads, and
 * `deriveGroupCategoryForBooking`'s `booking_items` read.
 */
function stubClient({
  booking,
  bookingItemsRows = [{ services: { group_category: "massage" } }],
  settings = SETTINGS,
}: {
  booking: Record<string, unknown> | null;
  bookingItemsRows?: Record<string, unknown>[];
  settings?: Record<string, unknown>;
}) {
  const state: Record<string, unknown> | null = booking ? { ...booking } : null;
  const ops: RecordedOp[] = [];

  function startOp(
    table: string,
    op: RecordedOp["op"],
    payload?: Record<string, unknown>
  ) {
    const entry: RecordedOp = { table, op, payload, filters: [] };
    ops.push(entry);
    let projected: "single" | "array" = "array";

    function resolve() {
      if (table === "bookings") {
        if (op === "update") {
          // The final sentinel-marking update carries `.is(...)`; only the
          // real predicate — "still NULL" — should let the write through.
          const guardedByNull = entry.filters.includes(
            "is:review_email_sent_at=null"
          );
          if (guardedByNull && state && state.review_email_sent_at != null) {
            return { data: null, error: null }; // lost the race
          }
          if (state) Object.assign(state, payload);
        }
        if (!state) return { data: null, error: null };
        return projected === "single"
          ? { data: { ...state }, error: null }
          : { data: [{ ...state }], error: null };
      }
      if (table === "business_settings") {
        return { data: settings, error: null };
      }
      if (table === "booking_items") {
        return { data: bookingItemsRows, error: null };
      }
      return { data: null, error: null };
    }

    const settle = () => Promise.resolve(resolve());
    const chain = {
      eq: (column: string, value: unknown) => {
        entry.filters.push(`eq:${column}=${String(value)}`);
        return chain;
      },
      is: (column: string, value: unknown) => {
        entry.filters.push(`is:${column}=${value === null ? "null" : String(value)}`);
        return chain;
      },
      select: () => chain,
      returns: () => chain,
      single: () => {
        projected = "single";
        return settle();
      },
      maybeSingle: () => {
        projected = "single";
        return settle();
      },
      then: (
        onFulfilled?: ((value: unknown) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null
      ) => settle().then(onFulfilled, onRejected),
    };
    return chain;
  }

  const from = vi.fn((table: string) => ({
    select: () => startOp(table, "select"),
    update: (payload: Record<string, unknown>) => startOp(table, "update", payload),
    insert: (payload: Record<string, unknown>) => {
      ops.push({ table, op: "insert", payload, filters: [] });
      return Promise.resolve({ data: null, error: null });
    },
  }));

  const client = { from } as unknown as SupabaseClient;
  const find = (table: string, op: RecordedOp["op"]) =>
    ops.filter((entry) => entry.table === table && entry.op === op);

  return { client, state, ops, find };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sendEmail).mockResolvedValue({ id: "resend-stub-id" } as never);
});

describe("sendReviewRequestEmail", () => {
  it("sends the review email and marks the sentinel on a happy-path completed booking", async () => {
    const stub = stubClient({ booking: baseBooking() });

    const result = await sendReviewRequestEmail("booking-1", stub.client);

    expect(result).toEqual({ sent: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: CUSTOMER_EMAIL,
        subject: "Thank you for visiting Rahma Therapy",
      })
    );
    // The closing sentinel-marking UPDATE, guarded against a parallel tick.
    const sentinelUpdate = stub.find("bookings", "update").at(-1)!;
    expect(sentinelUpdate.filters).toEqual([
      "eq:id=booking-1",
      "is:review_email_sent_at=null",
    ]);
    expect(stub.state?.review_email_sent_at).toEqual(expect.any(String));
  });

  it("does not send and reports already_sent when the sentinel is already set", async () => {
    const stub = stubClient({
      booking: baseBooking({ review_email_sent_at: "2026-07-20T12:00:00.000Z" }),
    });

    const result = await sendReviewRequestEmail("booking-1", stub.client);

    expect(result).toEqual({ sent: false, reason: "already_sent" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(stub.find("bookings", "update")).toHaveLength(0);
  });

  it("marks the sentinel and reports no_email when the booking has no email anywhere", async () => {
    const stub = stubClient({
      booking: baseBooking({
        contact_email: null,
        clients: { full_name: "Aisha Khan", phone: "07123456789", email: null, city: "Luton" },
      }),
    });

    const result = await sendReviewRequestEmail("booking-1", stub.client);

    expect(result).toEqual({ sent: false, reason: "no_email" });
    expect(sendEmail).not.toHaveBeenCalled();
    // Marked as handled so the cron never retries this booking forever.
    expect(stub.state?.review_email_sent_at).toEqual(expect.any(String));
    const update = stub.find("bookings", "update").at(-1)!;
    expect(update.filters).toEqual(["eq:id=booking-1"]);
  });

  it("reports send_failed without sending when the booking is no longer completed", async () => {
    const stub = stubClient({ booking: baseBooking({ status: "confirmed" }) });

    const result = await sendReviewRequestEmail("booking-1", stub.client);

    expect(result).toEqual({ sent: false, reason: "send_failed" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(stub.find("bookings", "update")).toHaveLength(0);
  });

  it("throws when the booking does not exist", async () => {
    const stub = stubClient({ booking: null });

    await expect(sendReviewRequestEmail("missing-booking", stub.client)).rejects.toThrow(
      /not found/
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("falls back to the massage pool for a mixed-category booking", async () => {
    const stub = stubClient({
      booking: baseBooking(),
      bookingItemsRows: [
        { services: { group_category: "massage" } },
        { services: { group_category: "cupping" } },
      ],
    });

    const result = await sendReviewRequestEmail("booking-1", stub.client);

    expect(result).toEqual({ sent: true });
    // deriveGroupCategoryForBooking resolved a mixed set to null; the picker
    // itself defaults null to the massage pool (pickReviewMessages.test.ts).
    expect(pickReviewMessages).toHaveBeenCalledWith(
      expect.objectContaining({ groupCategory: null, city: "Luton" })
    );
  });

  it("propagates admin-configured override text into the plain-text leg, not just the HTML leg", async () => {
    const overrideRows = [
      { field_key: "massage_variant_1", value: "Admin override sample review number 1." },
      { field_key: "massage_variant_2", value: "Admin override sample review number 2." },
      { field_key: "massage_variant_3", value: "Admin override sample review number 3." },
      { field_key: "massage_variant_4", value: "Admin override sample review number 4." },
      { field_key: "massage_variant_5", value: "Admin override sample review number 5." },
      { field_key: "body_cta_url", value: "https://example.test/admin-configured-review-url" },
    ];
    const overrideAdminClient = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: overrideRows, error: null }),
        }),
      }),
    };
    // resolveTemplateOverrides is called twice per send: once inside the real
    // renderReviewRequestEmail (HTML leg), once directly by
    // sendReviewRequestEmail for the plain-text leg (the fix under test).
    vi.mocked(createSupabaseAdminClient)
      .mockReturnValueOnce(overrideAdminClient as never)
      .mockReturnValueOnce(overrideAdminClient as never);

    const stub = stubClient({ booking: baseBooking() });

    const result = await sendReviewRequestEmail("booking-1", stub.client);

    expect(result).toEqual({ sent: true });
    // The text-leg pickReviewMessages call must receive the real overrides,
    // not the previously hardcoded {}.
    expect(pickReviewMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        overrides: expect.objectContaining({
          massage_variant_2: "Admin override sample review number 2.",
        }),
      })
    );
    // All 5 pool entries are overridden, so whichever 3 the shuffle picks,
    // the sent plain-text body must show override text, never a default.
    const sentText = vi.mocked(sendEmail).mock.calls[0][0].text as string;
    expect(sentText).toMatch(/Admin override sample review number \d\./);
    expect(sentText).not.toContain("brilliant home massage");
    // The gap this whole fix closes: a body_cta_url override set through the
    // normal override path must reach the *sent* plain-text body, and the
    // hardcoded default CTA URL must not.
    expect(sentText).toContain("https://example.test/admin-configured-review-url");
    expect(sentText).not.toContain("g.page/r/Ccfwk27JycKDEBM");
  });
});

/**
 * C-01 seam-review fix. `renderReviewRequestPlainText` used to hardcode its
 * intro/ask/CTA/signoff as string literals, so an admin override to any of
 * those five review_request_client fields reached the HTML leg but not this
 * one. These tests call the real (unmocked) function directly with an
 * explicit `overrides` argument to verify it now resolves all five fields
 * through the same defaults renderReviewRequestEmail uses.
 */
describe("renderReviewRequestPlainText", () => {
  const VARIANTS: ReviewMessageVariant[] = [
    { text: "Sample pooled review sentence.", source: "default" },
  ];

  function reviewInput(
    overrides: Partial<ReviewRequestEmailInput> = {}
  ): ReviewRequestEmailInput {
    return {
      companyName: "Rahma Therapy Test",
      clientName: "Aisha Khan",
      bookingDate: "2026-07-20",
      startTime: "14:00",
      endTime: "15:00",
      addressLines: ["10 Test Street"],
      totalPrice: 55,
      participantCount: 1,
      participants: [
        {
          label: "Aisha Khan",
          participantGender: "female",
          requiredTherapistGender: "female",
          services: ["Swedish Massage"],
        },
      ],
      groupCategory: "massage",
      city: "Luton",
      ...overrides,
    };
  }

  it("falls back to the same shared defaults the HTML leg uses when no overrides exist", () => {
    const text = renderReviewRequestPlainText(reviewInput(), VARIANTS);

    expect(text).toContain(
      "Thank you for choosing Rahma Therapy for your Swedish Massage. We hope you felt looked after from start to finish."
    );
    expect(text).toContain("It helps other people in Luton find us.");
    expect(text).toContain(
      "Leave a Google review: https://g.page/r/Ccfwk27JycKDEBM/review"
    );
    expect(text).toContain("Thank you again,\nThe Rahma Therapy team");
  });

  it("honours all five admin-configured body fields, not the hardcoded defaults", () => {
    const overrides = {
      body_intro: "OVERRIDE intro for {service_name}.",
      body_ask: "OVERRIDE ask text.",
      body_cta_label: "OVERRIDE cta label",
      body_cta_url: "https://example.test/override-review-url",
      body_signoff: "OVERRIDE signoff line.",
    };

    const text = renderReviewRequestPlainText(reviewInput(), VARIANTS, overrides);

    expect(text).toContain("OVERRIDE intro for Swedish Massage.");
    expect(text).toContain("OVERRIDE ask text.");
    expect(text).toContain(
      "OVERRIDE cta label: https://example.test/override-review-url"
    );
    expect(text).toContain("OVERRIDE signoff line.");

    // The hardcoded defaults this fix removes must not leak through.
    expect(text).not.toContain("We hope you felt looked after from start to finish");
    expect(text).not.toContain("helps other people in");
    expect(text).not.toContain("Leave a Google review");
    expect(text).not.toContain("g.page/r/Ccfwk27JycKDEBM");
    expect(text).not.toContain("Thank you again,\nThe Rahma Therapy team");
  });

  it("falls back to the default CTA URL when the stored override isn't https:// (defence-in-depth)", () => {
    // saveTemplateOverride rejects a non-https body_cta_url at save time, but
    // a row already in the database (pre-dating that guard) must not reach
    // the sent link either.
    const text = renderReviewRequestPlainText(reviewInput(), VARIANTS, {
      body_cta_url: "javascript:alert(1)",
    });

    expect(text).toContain("https://g.page/r/Ccfwk27JycKDEBM/review");
    expect(text).not.toContain("javascript:alert(1)");
  });

  it("never leaks a {city} or {service_name} placeholder into the sent body", () => {
    const overrides = {
      body_ask: "It really helps people in {city} out, for your {service_name}.",
    };

    const withCity = renderReviewRequestPlainText(
      reviewInput({ city: "Luton" }),
      VARIANTS,
      overrides
    );
    const withoutCity = renderReviewRequestPlainText(
      reviewInput({ city: null }),
      VARIANTS,
      overrides
    );

    expect(withCity).not.toMatch(/\{city\}|\{service_name\}/);
    expect(withCity).toContain(
      "It really helps people in Luton out, for your Swedish Massage."
    );

    // No city: the "in {city}" clause drops gracefully rather than leaving a
    // dangling placeholder or an awkward blank gap.
    expect(withoutCity).not.toMatch(/\{city\}|\{service_name\}/);
    expect(withoutCity).toContain(
      "It really helps people out, for your Swedish Massage."
    );
  });
});
