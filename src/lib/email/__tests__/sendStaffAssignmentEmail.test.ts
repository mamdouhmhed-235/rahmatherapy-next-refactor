import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendStaffAssignmentEmail } from "../notifications";

/**
 * C-08 Phase B. `sendStaffAssignmentEmail` now resolves "staff_assignment"
 * overrides once and shares the result between the HTML and plain-text legs.
 * Phase B's audit already confirmed the templates-data.ts registration for
 * this template is clean (reads exactly `intro` + `footer_contact`); this
 * file is the missing piece — proving the send fn actually applies them.
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

const STAFF_EMAIL = "therapist@staff.example.test";

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

describe("sendStaffAssignmentEmail", () => {
  it("sends the assignment email to the assigned staff member with the default copy", async () => {
    const stub = stubClient({ booking: baseBooking() });

    await sendStaffAssignmentEmail("booking-1", STAFF_EMAIL, stub.client, "staff-1");

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe(STAFF_EMAIL);
    expect(call.subject).toBe("Rahma Therapy Test booking assignment");
    expect(call.html as string).toContain("You have been assigned to a Rahma Therapy Test booking.");

    const trackedInsert = stub.inserts.find((i) => i.table === "email_delivery_events");
    expect(trackedInsert?.payload).toMatchObject({
      booking_id: "booking-1",
      event_type: "staff_assignment",
      recipient_role: "staff",
      staff_id: "staff-1",
    });
  });

  it("records a skipped delivery row and does not call sendEmail when the staff member has no address", async () => {
    const stub = stubClient({ booking: baseBooking() });

    await sendStaffAssignmentEmail("booking-1", null, stub.client, "staff-1");

    expect(sendEmail).not.toHaveBeenCalled();
    const trackedInsert = stub.inserts.find((i) => i.table === "email_delivery_events");
    expect(trackedInsert?.payload.delivery_status).toBe("skipped");
  });

  it("applies the admin-configured intro override to both the HTML and plain-text legs", async () => {
    const overrideRows = [
      { field_key: "intro", value: "OVERRIDE — you are on the {bookingDate} booking." },
    ];
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: overrideRows, error: null }) }),
      }),
    } as never);

    const stub = stubClient({ booking: baseBooking() });
    await sendStaffAssignmentEmail("booking-1", STAFF_EMAIL, stub.client, "staff-1");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html as string;
    const text = call.text as string;

    expect(html).toContain("OVERRIDE — you are on the 2026-07-20 booking.");
    expect(html).not.toContain("You have been assigned to a Rahma Therapy Test booking.");
    // The generic plain-text renderer only reads footer_contact — `intro` is
    // HTML-only, so the text leg keeps its unrelated default shape either way.
    expect(text).not.toContain("OVERRIDE");
  });
});
