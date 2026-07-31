import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendBookingConfirmedClientEmail } from "../notifications";

/**
 * C-08. `sendBookingConfirmedClientEmail` takes its `supabase` client as a
 * parameter, so the booking/business-settings stub below is passed straight
 * in. `resolveTemplateOverrides` (called once inside the real, unmocked
 * `renderBookingConfirmedClientEmail` for the HTML leg, and once again
 * directly by the send fn for the plain-text leg) creates its own admin
 * client via `createSupabaseAdminClient`, so that factory is mocked
 * separately — by default returning empty overrides.
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
  ensureBookingManageUrl: vi
    .fn()
    .mockResolvedValue("https://rahmatherapy.example.test/manage/token-abc"),
}));

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
    clients: {
      full_name: "Aisha Khan",
      phone: "07123456789",
      email: CUSTOMER_EMAIL,
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

/**
 * Stand-in for the `supabase` param the send fn receives directly. Covers
 * `getBookingTemplateInput`'s two reads (booking, business_settings) and the
 * email_delivery_events insert `sendTrackedEmail` writes on send.
 */
function stubClient({
  booking,
  settings = SETTINGS,
}: {
  booking: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
}) {
  const inserts: { table: string; payload: Record<string, unknown> }[] = [];

  function startOp(table: string) {
    const chain = {
      eq: () => chain,
      select: () => chain,
      single: () =>
        Promise.resolve(
          table === "bookings"
            ? booking
              ? { data: booking, error: null }
              : { data: null, error: { message: "Booking not found." } }
            : { data: null, error: null }
        ),
      maybeSingle: () =>
        Promise.resolve(
          table === "business_settings"
            ? { data: settings, error: null }
            : { data: null, error: null }
        ),
    };
    return chain;
  }

  const from = vi.fn((table: string) => ({
    select: () => startOp(table),
    insert: (payload: Record<string, unknown>) => {
      inserts.push({ table, payload });
      return Promise.resolve({ error: null });
    },
  }));

  return { client: { from } as unknown as SupabaseClient, inserts };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sendEmail).mockResolvedValue({ id: "resend-stub-id" } as never);
});

describe("sendBookingConfirmedClientEmail", () => {
  it("sends the booking-confirmed email to the client with the default copy", async () => {
    const stub = stubClient({ booking: baseBooking() });

    await sendBookingConfirmedClientEmail("booking-1", stub.client);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe(CUSTOMER_EMAIL);
    expect(call.subject).toBe("Your booking is confirmed");

    const html = call.html as string;
    const text = call.text as string;
    expect(html).toContain(
      "Hi Aisha Khan, your appointment on 2026-07-20 at 14:00:00 is confirmed."
    );
    expect(html).toContain("Manage your booking");
    expect(html).toContain("Thank you,");
    expect(text).toContain(
      "Hi Aisha Khan, your appointment on 2026-07-20 at 14:00:00 is confirmed."
    );
    expect(text).toContain("Manage your booking: https://rahmatherapy.example.test/manage/token-abc");
    expect(text).toContain("Thank you,\nThe Rahma Therapy team");

    // One tracked email_delivery_events row, for the right booking + event.
    const trackedInsert = stub.inserts.find((i) => i.table === "email_delivery_events");
    expect(trackedInsert?.payload).toMatchObject({
      booking_id: "booking-1",
      event_type: "booking_confirmed_client",
      recipient_role: "customer",
    });
  });

  it("throws before sending when the booking has no email anywhere", async () => {
    const stub = stubClient({
      booking: baseBooking({
        contact_email: null,
        clients: { full_name: "Aisha Khan", phone: "07123456789", email: null },
      }),
    });

    await expect(
      sendBookingConfirmedClientEmail("booking-1", stub.client)
    ).rejects.toThrow(/email/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("applies admin-configured overrides to the HTML and plain-text legs, per field", async () => {
    const overrideRows = [
      { field_key: "body_intro", value: "OVERRIDE — your session on {bookingDate} is locked in." },
      { field_key: "body_cta_label", value: "OVERRIDE view booking" },
      { field_key: "body_signoff", value: "OVERRIDE signoff line,\nThe Team" },
    ];
    const overrideAdminClient = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: overrideRows, error: null }),
        }),
      }),
    };
    // resolveTemplateOverrides is called twice per send: once inside the real
    // renderBookingConfirmedClientEmail (HTML leg), once directly by
    // sendBookingConfirmedClientEmail for the plain-text leg.
    vi.mocked(createSupabaseAdminClient)
      .mockReturnValueOnce(overrideAdminClient as never)
      .mockReturnValueOnce(overrideAdminClient as never);

    const stub = stubClient({ booking: baseBooking() });

    await sendBookingConfirmedClientEmail("booking-1", stub.client);

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html as string;
    const text = call.text as string;

    // body_intro — both legs.
    expect(html).toContain("OVERRIDE — your session on 2026-07-20 is locked in.");
    expect(text).toContain("OVERRIDE — your session on 2026-07-20 is locked in.");

    // body_cta_label — both legs.
    expect(html).toContain("OVERRIDE view booking");
    expect(text).toContain("OVERRIDE view booking");

    // body_signoff — both legs.
    expect(html).toContain("OVERRIDE signoff line,");
    expect(text).toContain("OVERRIDE signoff line,");

    // Hardcoded defaults must not leak through on either leg (the C-01
    // regression this test guards against — a plain-text leg that ignores
    // the override and keeps sending the hardcoded default).
    expect(html).not.toContain("We'll send a reminder closer to the day");
    expect(text).not.toContain("We'll send a reminder closer to the day");
    expect(html).not.toContain("Manage your booking</a>");
    expect(text).not.toContain("Manage your booking: https://");
    expect(html).not.toContain("Thank you,\nThe Rahma Therapy team");
    expect(text).not.toContain("Thank you,\nThe Rahma Therapy team");
  });
});
