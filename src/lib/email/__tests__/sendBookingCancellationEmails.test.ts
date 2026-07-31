import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendBookingCancellationEmails } from "../notifications";

/**
 * C-08 Phase B. `sendBookingCancellationEmails` fires three legs (customer,
 * admin, and — via `sendAssignedStaffBookingChangeEmails` — any assigned
 * staff); the customer leg is C-04a's delayed/queued path. This file proves
 * two things: (1) with zero override rows the rendered copy is byte-identical
 * to before this change, and (2) overrides are resolved and baked into the
 * HTML/text *before* a delayed customer send is queued — not deferred to the
 * cron that later drains the queue, since there is no later render step on
 * that path to apply them.
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

/**
 * Stand-in for the `supabase` param. Covers `getBookingTemplateInput`'s two
 * reads (booking, business_settings), the `booking_assignments` read
 * `sendAssignedStaffBookingChangeEmails` makes (empty — no assigned staff, so
 * that third leg sends nothing), and every `email_delivery_events` insert
 * (immediate accepted rows and C-04a's queued row).
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
    const result =
      table === "bookings"
        ? booking
          ? { data: booking, error: null }
          : { data: null, error: { message: "Booking not found." } }
        : table === "business_settings"
          ? { data: settings, error: null }
          : table === "booking_assignments"
            ? { data: [], error: null }
            : table === "staff_profiles"
              ? { data: staffProfiles ?? [], error: null }
              : { data: null, error: null };

    const chain = {
      eq: () => chain,
      not: () => chain,
      select: () => chain,
      returns: () => chain,
      single: () => Promise.resolve(result),
      maybeSingle: () => Promise.resolve(result),
      then: (resolve: (value: typeof result) => unknown) =>
        Promise.resolve(result).then(resolve),
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

describe("sendBookingCancellationEmails", () => {
  it("sends the customer and admin cancellation emails with the default copy", async () => {
    const stub = stubClient({ booking: baseBooking() });

    await sendBookingCancellationEmails("booking-1", stub.client, { initiatedBy: "admin" });

    expect(sendEmail).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(sendEmail).mock.calls.map((c) => c[0]);
    const customerCall = calls.find((c) => c.to === CUSTOMER_EMAIL)!;
    const adminCall = calls.find((c) => c.to === SETTINGS.contact_email)!;

    expect(customerCall.subject).toBe("Rahma Therapy Test booking cancelled");
    expect(customerCall.html as string).toContain(
      "Hi Aisha Khan, your Rahma Therapy Test booking has been cancelled."
    );

    expect(adminCall.subject).toBe("Booking cancelled - Aisha Khan");
    expect(adminCall.html as string).toContain(
      "Aisha Khan's booking was cancelled by admin. Booking reference: booking-1."
    );

    const trackedInserts = stub.inserts.filter((i) => i.table === "email_delivery_events");
    expect(trackedInserts.map((i) => i.payload.event_type)).toEqual(
      expect.arrayContaining(["booking_cancellation_customer", "booking_cancellation_admin"])
    );
  });

  it("throws before sending when the booking has no email anywhere", async () => {
    const stub = stubClient({
      booking: baseBooking({
        contact_email: null,
        clients: { full_name: "Aisha Khan", phone: "07123456789", email: null },
      }),
    });

    await expect(
      sendBookingCancellationEmails("booking-1", stub.client, { initiatedBy: "admin" })
    ).rejects.toThrow(/email/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("resolves each leg's overrides independently — the customer leg's edit does not leak into the admin leg", async () => {
    const overrideRows = [
      { field_key: "greeting_intro", value: "OVERRIDE cancellation greeting {clientName}." },
    ];
    // booking_cancellation_client is resolved first; admin_booking_cancellation
    // (and staff_booking_change, via the third leg) fall through to the
    // module-level empty-overrides mock.
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: overrideRows, error: null }) }),
      }),
    } as never);

    const stub = stubClient({ booking: baseBooking() });
    await sendBookingCancellationEmails("booking-1", stub.client, { initiatedBy: "admin" });

    const calls = vi.mocked(sendEmail).mock.calls.map((c) => c[0]);
    const customerCall = calls.find((c) => c.to === CUSTOMER_EMAIL)!;
    const adminCall = calls.find((c) => c.to === SETTINGS.contact_email)!;

    expect(customerCall.html as string).toContain("OVERRIDE cancellation greeting Aisha Khan.");
    expect(adminCall.html as string).not.toContain("OVERRIDE cancellation greeting");
  });

  it("resolves overrides before queueing a delayed customer send — C-04a path", async () => {
    const overrideRows = [
      { field_key: "greeting_intro", value: "OVERRIDE — delayed cancellation copy." },
    ];
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: overrideRows, error: null }) }),
      }),
    } as never);

    const stub = stubClient({ booking: baseBooking() });
    await sendBookingCancellationEmails("booking-1", stub.client, {
      initiatedBy: "admin",
      delaySeconds: 5,
    });

    // The customer leg is queued, not sent immediately — only the admin leg
    // calls sendEmail now.
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const queuedInsert = stub.inserts.find(
      (i) => i.table === "email_delivery_events" && i.payload.delivery_status === "queued"
    );
    expect(queuedInsert).toBeDefined();
    expect(queuedInsert?.payload.html_payload as string).toContain(
      "OVERRIDE — delayed cancellation copy."
    );
    expect(queuedInsert?.payload.html_payload as string).not.toContain(
      "Hi Aisha Khan, your Rahma Therapy Test booking has been cancelled."
    );
  });

  it("C-08 Phase D — sends the admin leg to every opted-in recipient except the cancelling actor, one row each", async () => {
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

    await sendBookingCancellationEmails("booking-1", stub.client, {
      initiatedBy: "admin",
      actorStaffId: "staff-admin",
    });

    // Customer leg + only the non-excluded admin (staff-admin cancelled it,
    // so skip-self excludes them) = 2 sends.
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(sendEmail).mock.calls.map((c) => c[0]);
    expect(calls.some((c) => c.to === "owner@rahmatherapy.example.test")).toBe(true);
    expect(calls.some((c) => c.to === "admin@rahmatherapy.example.test")).toBe(false);

    const adminRows = stub.inserts.filter(
      (i) => i.table === "email_delivery_events" && i.payload.event_type === "booking_cancellation_admin"
    );
    expect(adminRows).toHaveLength(1);
    expect(adminRows[0].payload.staff_id).toBe("staff-owner");
  });

  it("C-08 Phase D — writes a skipped row with actor_excluded when skip-self empties a single-recipient opt-in list", async () => {
    const stub = stubClient({
      booking: baseBooking(),
      staffProfiles: [
        {
          id: "staff-admin",
          email: "admin@rahmatherapy.example.test",
          notification_email: null,
          business_notification_prefs: { enabled: true },
          roles: { name: "Admin" },
        },
      ],
    });

    await sendBookingCancellationEmails("booking-1", stub.client, {
      initiatedBy: "admin",
      actorStaffId: "staff-admin",
    });

    // Only the customer leg sends — the sole opted-in admin cancelled it themselves.
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmail).mock.calls[0][0].to).toBe(CUSTOMER_EMAIL);

    const skippedRow = stub.inserts.find(
      (i) => i.table === "email_delivery_events" && i.payload.event_type === "booking_cancellation_admin"
    );
    expect(skippedRow?.payload).toMatchObject({
      delivery_status: "skipped",
      error_message: "actor_excluded",
    });
  });
});
