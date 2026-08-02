import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendBookingCreatedEmails } from "../notifications";

/**
 * C-08 Phase B. `sendBookingCreatedEmails` fires two legs (customer + admin),
 * each now resolving its OWN template's overrides (`booking_confirmation` /
 * `admin_booking_notification`) once and sharing that result between its
 * HTML and plain-text renderer — the fix this file guards against
 * regressing. Before Phase B neither leg read overrides at all.
 * `resolveTemplateOverrides` creates its own admin client via
 * `createSupabaseAdminClient`, mocked separately below, defaulting to empty
 * overrides — i.e. the "zero override rows in production today" state, so
 * the default-copy test below is the byte-identical-with-zero-overrides
 * regression proof.
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

describe("sendBookingCreatedEmails", () => {
  it("sends the customer confirmation and admin notification with the default copy", async () => {
    const stub = stubClient({ booking: baseBooking() });

    await sendBookingCreatedEmails("booking-1", stub.client);

    expect(sendEmail).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(sendEmail).mock.calls.map((c) => c[0]);
    const customerCall = calls.find((c) => c.to === CUSTOMER_EMAIL)!;
    const adminCall = calls.find((c) => c.to === SETTINGS.contact_email)!;

    expect(customerCall.subject).toBe("Rahma Therapy Test booking request received");
    expect(customerCall.html as string).toContain(
      "Hi Aisha Khan, we have received your Rahma Therapy Test booking request."
    );
    expect(customerCall.html as string).toContain("This booking is for one participant.");

    expect(adminCall.subject).toBe("New booking request - Aisha Khan");
    expect(adminCall.html as string).toContain(
      "Aisha Khan submitted a booking request. Booking reference: booking-1."
    );

    const trackedInserts = stub.inserts.filter((i) => i.table === "email_delivery_events");
    expect(trackedInserts.map((i) => i.payload.event_type)).toEqual(
      expect.arrayContaining(["booking_confirmation", "admin_booking_notification"])
    );
  });

  it("does not send when the booking has no email anywhere", async () => {
    const stub = stubClient({
      booking: baseBooking({
        contact_email: null,
        clients: { full_name: "Aisha Khan", phone: "07123456789", email: null },
      }),
    });

    await sendBookingCreatedEmails("booking-1", stub.client);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("resolves each leg's overrides independently — the customer leg's edit does not leak into the admin leg", async () => {
    const overrideRows = [
      { field_key: "greeting_intro", value: "OVERRIDE customer greeting {clientName}." },
    ];
    // Call order matches the code: booking_confirmation is resolved first
    // (Promise.all([customer, admin])); the admin_booking_notification call
    // (and anything after) falls through to the module-level empty-overrides
    // mock, proving the two legs are resolved separately rather than sharing
    // one blob.
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: overrideRows, error: null }) }),
      }),
    } as never);

    const stub = stubClient({ booking: baseBooking() });
    await sendBookingCreatedEmails("booking-1", stub.client);

    const calls = vi.mocked(sendEmail).mock.calls.map((c) => c[0]);
    const customerCall = calls.find((c) => c.to === CUSTOMER_EMAIL)!;
    const adminCall = calls.find((c) => c.to === SETTINGS.contact_email)!;

    expect(customerCall.html as string).toContain("OVERRIDE customer greeting Aisha Khan.");
    expect(customerCall.text as string).not.toContain("OVERRIDE customer greeting");
    expect(adminCall.html as string).not.toContain("OVERRIDE customer greeting");
  });

  it("C-15 closeout fix round — a stored subject override with an embedded CR/LF cannot reach sendEmail's subject", async () => {
    // Save-time (email-templates/actions.ts's validateTemplateFields)
    // already rejects a control character in a subject field, but this
    // proves the render-time fallback (resolveSubject(), in
    // src/lib/email/templates.ts) independently guards a row already in
    // the DB — pre-dating that guard, or written by any future direct-write
    // path — exactly like sendTrackedEmail's subject argument, not just
    // resolveSubject() in isolation.
    const overrideRows = [
      { field_key: "subject", value: "Injected\r\nBcc: attacker@example.test" },
    ];
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: overrideRows, error: null }) }),
      }),
    } as never);

    const stub = stubClient({ booking: baseBooking() });
    await sendBookingCreatedEmails("booking-1", stub.client);

    const calls = vi.mocked(sendEmail).mock.calls.map((c) => c[0]);
    const customerCall = calls.find((c) => c.to === CUSTOMER_EMAIL)!;

    expect(customerCall.subject).toBe("Rahma Therapy Test booking request received");
    expect(customerCall.subject).not.toMatch(/[\r\n]/);
    expect(customerCall.subject).not.toContain("Bcc: attacker");
  });

  it("C-15 closeout fix round — a valid stored subject override reaches sendEmail's subject (brief §10 AC2)", async () => {
    const overrideRows = [{ field_key: "subject", value: "We got your booking, {clientName}!" }];
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: overrideRows, error: null }) }),
      }),
    } as never);

    const stub = stubClient({ booking: baseBooking() });
    await sendBookingCreatedEmails("booking-1", stub.client);

    const calls = vi.mocked(sendEmail).mock.calls.map((c) => c[0]);
    const customerCall = calls.find((c) => c.to === CUSTOMER_EMAIL)!;
    expect(customerCall.subject).toBe("We got your booking, Aisha Khan!");
  });

  it("C-08 Phase D — sends the admin leg to every opted-in Owner/Admin, one delivery row each", async () => {
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
          notification_email: "admin-alerts@rahmatherapy.example.test",
          business_notification_prefs: { enabled: true },
          roles: { name: "Admin" },
        },
      ],
    });

    await sendBookingCreatedEmails("booking-1", stub.client);

    // Customer leg + 2 opted-in admin recipients = 3 sends, no fallback to
    // getAdminRecipient's single settings.contact_email.
    expect(sendEmail).toHaveBeenCalledTimes(3);
    const calls = vi.mocked(sendEmail).mock.calls.map((c) => c[0]);
    expect(calls.some((c) => c.to === "owner@rahmatherapy.example.test")).toBe(true);
    expect(calls.some((c) => c.to === "admin-alerts@rahmatherapy.example.test")).toBe(true);
    expect(calls.some((c) => c.to === SETTINGS.contact_email)).toBe(false);

    // One tracked email_delivery_events row per recipient (not one for the
    // whole admin leg).
    const adminRows = stub.inserts.filter(
      (i) => i.table === "email_delivery_events" && i.payload.event_type === "admin_booking_notification"
    );
    expect(adminRows).toHaveLength(2);
    expect(adminRows.map((r) => r.payload.staff_id).sort()).toEqual(["staff-admin", "staff-owner"]);
  });
});
