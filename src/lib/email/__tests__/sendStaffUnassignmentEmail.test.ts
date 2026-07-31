import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendStaffUnassignmentEmail } from "../notifications";

/**
 * C-08. `sendStaffUnassignmentEmail` takes its `supabase` client as a
 * parameter, so the booking/business-settings/staff stub below is passed
 * straight in. `resolveTemplateOverrides` (called once inside the real,
 * unmocked `renderStaffUnassignmentEmail` for the HTML leg, and once again
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
  contact_email: "bookings@rahmatherapy.example.test",
  contact_phone: "01582 000000",
};

const PREVIOUS_STAFF_ID = "staff-mahmoud";

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
        required_therapist_gender: "male",
        is_main_contact: true,
        display_name: null,
      },
    ],
    booking_items: [
      {
        id: "i1",
        booking_participant_id: "p1",
        service_name_snapshot: "Hijama session",
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
 * staff_profiles lookup for the previously assigned staff, and the
 * email_delivery_events insert `sendTrackedEmail` writes on send.
 */
function stubClient({
  booking,
  settings = SETTINGS,
  staff,
}: {
  booking: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  staff: Record<string, unknown> | null;
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
              ? { data: staff, error: null }
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

describe("sendStaffUnassignmentEmail", () => {
  it("sends the unassignment email to the previously assigned staff member with the default copy", async () => {
    const stub = stubClient({
      booking: baseBooking(),
      staff: { email: "mahmoud@staff.example.test", name: "Mahmoud" },
    });

    await sendStaffUnassignmentEmail("booking-1", PREVIOUS_STAFF_ID, stub.client);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe("mahmoud@staff.example.test");
    expect(call.subject).toBe("Booking assignment removed");

    const html = call.html as string;
    const text = call.text as string;
    // escapeHtml turns the apostrophe into &#039; on the HTML leg only.
    expect(html).toContain(
      "Hi Mahmoud, you&#039;ve been unassigned from the 2026-07-20 14:00:00 booking (Aisha Khan)."
    );
    expect(text).toContain(
      "Hi Mahmoud, you've been unassigned from the 2026-07-20 14:00:00 booking (Aisha Khan)."
    );

    const trackedInsert = stub.inserts.find((i) => i.table === "email_delivery_events");
    expect(trackedInsert?.payload).toMatchObject({
      booking_id: "booking-1",
      event_type: "staff_unassignment",
      recipient_role: "staff",
      staff_id: PREVIOUS_STAFF_ID,
    });
  });

  it("warns and returns without sending when the previous staff has no email on file", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const stub = stubClient({
      booking: baseBooking(),
      staff: { email: null, name: "Mahmoud" },
    });

    const result = await sendStaffUnassignmentEmail(
      "booking-1",
      PREVIOUS_STAFF_ID,
      stub.client
    );

    expect(result).toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(PREVIOUS_STAFF_ID));
    expect(stub.inserts.find((i) => i.table === "email_delivery_events")).toBeUndefined();

    warnSpy.mockRestore();
  });

  it("warns and returns without sending when the previous staff row no longer exists", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const stub = stubClient({ booking: baseBooking(), staff: null });

    await sendStaffUnassignmentEmail("booking-1", PREVIOUS_STAFF_ID, stub.client);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("applies the admin-configured body_intro override to both the HTML and plain-text legs", async () => {
    const overrideRows = [
      {
        field_key: "body_intro",
        value: "OVERRIDE — {therapistName}, the {bookingDate} slot has been reassigned.",
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
    // renderStaffUnassignmentEmail (HTML leg), once directly by
    // sendStaffUnassignmentEmail for the plain-text leg.
    vi.mocked(createSupabaseAdminClient)
      .mockReturnValueOnce(overrideAdminClient as never)
      .mockReturnValueOnce(overrideAdminClient as never);

    const stub = stubClient({
      booking: baseBooking(),
      staff: { email: "mahmoud@staff.example.test", name: "Mahmoud" },
    });

    await sendStaffUnassignmentEmail("booking-1", PREVIOUS_STAFF_ID, stub.client);

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html as string;
    const text = call.text as string;

    // body_intro — both legs.
    expect(html).toContain("OVERRIDE — Mahmoud, the 2026-07-20 slot has been reassigned.");
    expect(text).toContain("OVERRIDE — Mahmoud, the 2026-07-20 slot has been reassigned.");

    // The hardcoded default must not leak through on either leg (the C-01
    // regression this test guards against).
    expect(html).not.toContain("Reach out to admin if you have questions.");
    expect(text).not.toContain("Reach out to admin if you have questions.");
  });
});
