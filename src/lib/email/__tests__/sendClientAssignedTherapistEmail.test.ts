import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureBookingManageUrl } from "@/lib/booking/manage-token";
import { sendClientAssignedTherapistEmail } from "../notifications";

/**
 * C-08. `sendClientAssignedTherapistEmail` takes its `supabase` client as a
 * parameter, so the booking/business-settings/staff stub below is passed
 * straight in. `resolveTemplateOverrides` (called once inside the real,
 * unmocked `renderClientAssignedTherapistEmail` for the HTML leg, and once
 * again directly by the send fn for the plain-text leg) creates its own
 * admin client via `createSupabaseAdminClient`, so that factory is mocked
 * separately — by default returning empty overrides.
 *
 * C-C fix round (F-2) — this send used to pass `includeManageUrl: true`,
 * which minted a fresh manage token and overwrote the booking's single live
 * one on every assign/reassign/claim, killing the link in whatever email
 * the customer already had — the highest-frequency offender, since this
 * fires on every assignment change. It now resolves the manage URL via the
 * non-rotating `getExistingBookingManageUrl`, which never mints, so the
 * email simply omits the "Manage this booking" CTA. `ensureBookingManageUrl`
 * is mocked to throw here specifically so a future regression that
 * reintroduces rotation on this send path fails loudly.
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
  ensureBookingManageUrl: vi.fn().mockRejectedValue(
    new Error(
      "sendClientAssignedTherapistEmail must not rotate the manage token — use getExistingBookingManageUrl."
    )
  ),
  getExistingBookingManageUrl: vi.fn().mockResolvedValue(undefined),
}));

const CUSTOMER_EMAIL = "aisha@client.example.test";
const ASSIGNED_STAFF_ID = "staff-sara";

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
 * `getBookingTemplateInput`'s two reads (booking, business_settings), the
 * staff_profiles lookup for the assigned staff's name, and the
 * email_delivery_events insert `sendTrackedEmail` writes on send.
 */
function stubClient({
  booking,
  settings = SETTINGS,
  assignedStaff,
}: {
  booking: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  assignedStaff: Record<string, unknown> | null;
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
              ? { data: assignedStaff, error: null }
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

describe("sendClientAssignedTherapistEmail", () => {
  it("sends the assigned-therapist email to the client with the default copy", async () => {
    const stub = stubClient({
      booking: baseBooking(),
      assignedStaff: { name: "Sara" },
    });

    await sendClientAssignedTherapistEmail("booking-1", ASSIGNED_STAFF_ID, stub.client);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe(CUSTOMER_EMAIL);
    expect(call.subject).toBe("Your therapist for 2026-07-20");

    const html = call.html as string;
    const text = call.text as string;
    expect(html).toContain(
      "Hi Aisha Khan, your appointment on 2026-07-20 at 14:00:00 will be with Sara."
    );
    expect(text).toContain(
      "Hi Aisha Khan, your appointment on 2026-07-20 at 14:00:00 will be with Sara."
    );

    // F-2 fix: no manage link — getExistingBookingManageUrl never mints, so
    // the CTA (both legs) is cleanly omitted rather than risk breaking a
    // link already emailed to this customer.
    expect(html).not.toContain("Manage your booking");
    expect(text).not.toContain("Manage your booking");

    // One tracked email_delivery_events row, for the right booking + event.
    const trackedInsert = stub.inserts.find((i) => i.table === "email_delivery_events");
    expect(trackedInsert?.payload).toMatchObject({
      booking_id: "booking-1",
      event_type: "client_assigned_therapist",
      recipient_role: "customer",
    });
  });

  it("never rotates the manage token (F-2 regression guard)", async () => {
    const stub = stubClient({ booking: baseBooking(), assignedStaff: { name: "Sara" } });

    await sendClientAssignedTherapistEmail("booking-1", ASSIGNED_STAFF_ID, stub.client);

    expect(ensureBookingManageUrl).not.toHaveBeenCalled();
  });

  it("throws before sending when the booking has no email anywhere", async () => {
    const stub = stubClient({
      booking: baseBooking({
        contact_email: null,
        clients: { full_name: "Aisha Khan", phone: "07123456789", email: null },
      }),
      assignedStaff: { name: "Sara" },
    });

    await expect(
      sendClientAssignedTherapistEmail("booking-1", ASSIGNED_STAFF_ID, stub.client)
    ).rejects.toThrow(/email/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("falls back to \"your therapist\" when the assigned staff row can't be found", async () => {
    const stub = stubClient({ booking: baseBooking(), assignedStaff: null });

    await sendClientAssignedTherapistEmail("booking-1", ASSIGNED_STAFF_ID, stub.client);

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html as string).toContain("will be with your therapist.");
  });

  it("applies admin-configured overrides to the HTML and plain-text legs, per field", async () => {
    const overrideRows = [
      { field_key: "body_intro", value: "OVERRIDE — {clientName}, {therapistName} has you on {bookingDate}." },
    ];
    const overrideAdminClient = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: overrideRows, error: null }),
        }),
      }),
    };
    // resolveTemplateOverrides is called twice per send: once inside the real
    // renderClientAssignedTherapistEmail (HTML leg), once directly by
    // sendClientAssignedTherapistEmail for the plain-text leg.
    vi.mocked(createSupabaseAdminClient)
      .mockReturnValueOnce(overrideAdminClient as never)
      .mockReturnValueOnce(overrideAdminClient as never);

    const stub = stubClient({ booking: baseBooking(), assignedStaff: { name: "Sara" } });

    await sendClientAssignedTherapistEmail("booking-1", ASSIGNED_STAFF_ID, stub.client);

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html as string;
    const text = call.text as string;

    // body_intro — both legs.
    expect(html).toContain("OVERRIDE — Aisha Khan, Sara has you on 2026-07-20.");
    expect(text).toContain("OVERRIDE — Aisha Khan, Sara has you on 2026-07-20.");

    // Hardcoded defaults must not leak through on either leg (the C-01
    // regression this test guards against — a plain-text leg that ignores
    // the override and keeps sending the hardcoded default).
    expect(html).not.toContain("will be with Sara");
    expect(text).not.toContain("will be with Sara");

    // F-2 fix: no manage link — a body_cta_label override can't resurrect a
    // CTA that only ever renders when manageUrl is set.
    expect(html).not.toContain("Manage your booking</a>");
    expect(text).not.toContain("Manage your booking:");
  });
});
