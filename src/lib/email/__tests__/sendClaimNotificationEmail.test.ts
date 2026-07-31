import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractEmailAddress, sendEmail } from "@/lib/email/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendClaimNotificationEmail } from "../notifications";

/**
 * C-08. `sendClaimNotificationEmail` takes its `supabase` client as a
 * parameter, so the booking/business-settings/staff stub below is passed
 * straight in. `resolveTemplateOverrides` (called once inside the real,
 * unmocked `renderClaimNotificationEmail` for the HTML leg, and once again
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
  ensureBookingManageUrl: vi.fn().mockResolvedValue(null),
}));

const SETTINGS = {
  company_name: "Rahma Therapy Test",
  contact_email: "owner@rahmatherapy.example.test",
  contact_phone: "01582 000000",
};

const CLAIMING_STAFF_ID = "staff-sara";

function baseBooking(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "booking-1",
    contact_full_name: "Aisha Khan",
    contact_email: "aisha@client.example.test",
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
      email: "aisha@client.example.test",
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
 * `getBookingTemplateInput`'s two reads (booking, business_settings), the
 * staff_profiles lookup for the claiming staff's name, and the
 * email_delivery_events insert `sendTrackedEmail` writes on send.
 */
function stubClient({
  booking,
  settings = SETTINGS,
  claimingStaff,
}: {
  booking: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  claimingStaff: Record<string, unknown> | null;
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
            : table === "staff_profiles"
              ? { data: claimingStaff, error: null }
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

describe("sendClaimNotificationEmail", () => {
  it("sends the claim notification to the admin recipient with the default copy", async () => {
    const stub = stubClient({
      booking: baseBooking(),
      claimingStaff: { name: "Sara" },
    });

    await sendClaimNotificationEmail("booking-1", CLAIMING_STAFF_ID, stub.client);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe(SETTINGS.contact_email);
    expect(call.subject).toBe("Slot claimed: Sara → 2026-07-20");

    const html = call.html as string;
    const text = call.text as string;
    expect(html).toContain("Sara just claimed the 2026-07-20 14:00:00 slot for Aisha Khan.");
    expect(text).toContain("Sara just claimed the 2026-07-20 14:00:00 slot for Aisha Khan.");

    // One tracked email_delivery_events row, for the right booking + event.
    const trackedInsert = stub.inserts.find((i) => i.table === "email_delivery_events");
    expect(trackedInsert?.payload).toMatchObject({
      booking_id: "booking-1",
      event_type: "claim",
      recipient_role: "admin",
    });
  });

  it("returns without sending when no admin recipient is configured", async () => {
    // getAdminRecipient falls back to the from-address's local part when
    // contact_email is null — simulate the fully-opted-out state by making
    // that fallback resolve empty too.
    vi.mocked(extractEmailAddress).mockReturnValueOnce("");
    const stub = stubClient({
      booking: baseBooking(),
      settings: { ...SETTINGS, contact_email: null },
      claimingStaff: { name: "Sara" },
    });

    await sendClaimNotificationEmail("booking-1", CLAIMING_STAFF_ID, stub.client);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(stub.inserts.find((i) => i.table === "email_delivery_events")).toBeUndefined();
  });

  it("falls back to (unknown) when the claiming staff row can't be found", async () => {
    const stub = stubClient({ booking: baseBooking(), claimingStaff: null });

    await sendClaimNotificationEmail("booking-1", CLAIMING_STAFF_ID, stub.client);

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.subject).toBe("Slot claimed: (unknown) → 2026-07-20");
    expect(call.html as string).toContain("(unknown) just claimed");
  });

  it("applies the admin-configured body_intro override to both the HTML and plain-text legs", async () => {
    const overrideRows = [
      {
        field_key: "body_intro",
        value: "OVERRIDE — {therapistName} grabbed the {bookingDate} slot.",
      },
    ];
    const overrideAdminClient = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: overrideRows, error: null }),
        }),
      }),
    };
    // resolveTemplateOverrides is called twice per send: once inside the real
    // renderClaimNotificationEmail (HTML leg), once directly by
    // sendClaimNotificationEmail for the plain-text leg.
    vi.mocked(createSupabaseAdminClient)
      .mockReturnValueOnce(overrideAdminClient as never)
      .mockReturnValueOnce(overrideAdminClient as never);

    const stub = stubClient({ booking: baseBooking(), claimingStaff: { name: "Sara" } });

    await sendClaimNotificationEmail("booking-1", CLAIMING_STAFF_ID, stub.client);

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html as string;
    const text = call.text as string;

    // body_intro — both legs.
    expect(html).toContain("OVERRIDE — Sara grabbed the 2026-07-20 slot.");
    expect(text).toContain("OVERRIDE — Sara grabbed the 2026-07-20 slot.");

    // Hardcoded default must not leak through on either leg (the C-01
    // regression this test guards against).
    expect(html).not.toContain("just claimed the 2026-07-20 14:00:00 slot");
    expect(text).not.toContain("just claimed the 2026-07-20 14:00:00 slot");
  });
});
