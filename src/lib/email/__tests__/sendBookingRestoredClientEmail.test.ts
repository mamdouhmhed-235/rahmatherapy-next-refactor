import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendBookingRestoredClientEmail } from "../notifications";

/**
 * C-08 Phase B. `sendBookingRestoredClientEmail` now resolves
 * "booking_restored_client" overrides once and shares the result between the
 * HTML and plain-text legs, mirroring every other sender fixed in this
 * phase. There is no `templates-data.ts` entry for this template yet (never
 * one of the admin-editable ones), so no override row can exist for it via
 * the UI today — `resolveTemplateOverrides` always resolves `{}` in
 * production, which is exactly the "zero override rows" state the
 * default-copy test below proves is byte-identical to before this change.
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

describe("sendBookingRestoredClientEmail", () => {
  it("sends the restored-booking email to the client with the default copy", async () => {
    const stub = stubClient({ booking: baseBooking() });

    await sendBookingRestoredClientEmail("booking-1", stub.client);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe(CUSTOMER_EMAIL);
    expect(call.subject).toBe("Rahma Therapy Test — your booking is back on");
    expect(call.html as string).toContain(
      "Good news Aisha Khan — your Rahma Therapy Test booking has been restored. We are sorry for the earlier cancellation; everything is back on."
    );

    const trackedInsert = stub.inserts.find((i) => i.table === "email_delivery_events");
    expect(trackedInsert?.payload).toMatchObject({
      booking_id: "booking-1",
      event_type: "booking_restored_client",
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
      sendBookingRestoredClientEmail("booking-1", stub.client)
    ).rejects.toThrow(/email/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("applies the admin-configured greeting_intro override to both the HTML and plain-text legs", async () => {
    const overrideRows = [
      { field_key: "greeting_intro", value: "OVERRIDE — {clientName}, you are back on the books." },
    ];
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: overrideRows, error: null }) }),
      }),
    } as never);

    const stub = stubClient({ booking: baseBooking() });
    await sendBookingRestoredClientEmail("booking-1", stub.client);

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html as string;
    const text = call.text as string;

    expect(html).toContain("OVERRIDE — Aisha Khan, you are back on the books.");
    expect(html).not.toContain("Good news Aisha Khan");
    // The generic plain-text renderer only reads footer_contact — greeting_intro
    // is HTML-only, so the text leg keeps its unrelated default shape either way.
    expect(text).not.toContain("OVERRIDE");
  });
});
