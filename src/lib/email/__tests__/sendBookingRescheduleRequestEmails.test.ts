import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendBookingRescheduleRequestEmails } from "../notifications";

/**
 * C-08 Phase B. `sendBookingRescheduleRequestEmails` now resolves
 * "admin_reschedule_request" overrides once and shares the result between
 * the HTML and plain-text legs. `resolveTemplateOverrides` creates its own
 * admin client via `createSupabaseAdminClient`, mocked separately below,
 * defaulting to empty overrides.
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
  staffProfiles,
}: {
  booking: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  /** C-08 Phase D — rows for `resolveBusinessNotificationRecipients`' bulk
   *  staff_profiles fetch. Defaults to `[]` (zero opted-in), which is the
   *  pre-Phase-D "fall back to getAdminRecipient" state. */
  staffProfiles?: Record<string, unknown>[];
}) {
  const inserts: { table: string; payload: Record<string, unknown> }[] = [];

  function startOp(table: string) {
    const chain = {
      eq: () => chain,
      select: () => chain,
      returns: () =>
        Promise.resolve({
          data: table === "staff_profiles" ? (staffProfiles ?? []) : [],
          error: null,
        }),
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

describe("sendBookingRescheduleRequestEmails", () => {
  it("sends the reschedule-request email to the admin recipient with the default copy", async () => {
    const stub = stubClient({ booking: baseBooking() });

    await sendBookingRescheduleRequestEmails("booking-1", stub.client, {
      requestedDate: "2026-08-01",
      requestedTime: "10:00",
      requestNote: null,
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe(SETTINGS.contact_email);
    expect(call.subject).toBe("Reschedule request - Aisha Khan");
    expect(call.html as string).toContain(
      "Aisha Khan requested a new appointment time. Booking reference: booking-1."
    );

    const trackedInsert = stub.inserts.find((i) => i.table === "email_delivery_events");
    expect(trackedInsert?.payload).toMatchObject({
      booking_id: "booking-1",
      event_type: "booking_reschedule_request_admin",
      recipient_role: "admin",
    });
  });

  it("applies the admin-configured footer_contact override to both the HTML and plain-text legs", async () => {
    const overrideRows = [
      { field_key: "footer_contact", value: "OVERRIDE — reach us on 0000 000000." },
    ];
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: overrideRows, error: null }) }),
      }),
    } as never);

    const stub = stubClient({ booking: baseBooking() });
    await sendBookingRescheduleRequestEmails("booking-1", stub.client, {
      requestedDate: "2026-08-01",
      requestedTime: "10:00",
      requestNote: null,
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html as string).toContain("OVERRIDE — reach us on 0000 000000.");
    expect(call.text as string).toContain("OVERRIDE — reach us on 0000 000000.");
  });

  it("C-08 Phase D — sends to every opted-in Owner/Admin, one delivery row each, no exclusion (customer-initiated)", async () => {
    const stub = stubClient({
      booking: baseBooking(),
      staffProfiles: [
        {
          id: "staff-owner",
          email: "owner@rahmatherapy.example.test",
          notification_email: null,
          business_notification_prefs: { enabled: true },
          roles: { name: "Owner" },
        },
        {
          id: "staff-admin",
          email: "admin@rahmatherapy.example.test",
          notification_email: null,
          business_notification_prefs: { enabled: true },
          roles: { name: "Admin" },
        },
      ],
    });

    await sendBookingRescheduleRequestEmails("booking-1", stub.client, {
      requestedDate: "2026-08-01",
      requestedTime: "10:00",
      requestNote: null,
    });

    expect(sendEmail).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(sendEmail).mock.calls.map((c) => c[0]);
    expect(calls.some((c) => c.to === "owner@rahmatherapy.example.test")).toBe(true);
    expect(calls.some((c) => c.to === "admin@rahmatherapy.example.test")).toBe(true);

    const trackedInserts = stub.inserts.filter((i) => i.table === "email_delivery_events");
    expect(trackedInserts).toHaveLength(2);
    expect(trackedInserts.map((i) => i.payload.staff_id).sort()).toEqual([
      "staff-admin",
      "staff-owner",
    ]);
  });
});
