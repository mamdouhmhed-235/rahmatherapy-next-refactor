import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendAssignedStaffBookingChangeEmails } from "../notifications";

/**
 * C-08 Phase B. `sendAssignedStaffBookingChangeEmails` now resolves
 * "staff_booking_change" overrides once (shared across the whole staff loop)
 * and shares the result between each recipient's HTML and plain-text legs.
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

const CHANGE_SUMMARY = "An assigned booking has been cancelled.";

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

const ASSIGNED_STAFF = [
  {
    assigned_staff_id: "staff-1",
    staff_profiles: { email: "therapist1@staff.example.test" },
  },
  {
    assigned_staff_id: "staff-2",
    staff_profiles: { email: "therapist2@staff.example.test" },
  },
];

/**
 * Stand-in for the `supabase` param. Adds `booking_assignments` (read by
 * `getAssignedStaffEmails`) alongside `bookings` / `business_settings`.
 */
function stubClient({
  booking,
  settings = SETTINGS,
  assignedStaff = ASSIGNED_STAFF,
}: {
  booking: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  assignedStaff?: Record<string, unknown>[];
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
            ? { data: assignedStaff, error: null }
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

describe("sendAssignedStaffBookingChangeEmails", () => {
  it("sends the change email to every assigned staff member with the default copy", async () => {
    const stub = stubClient({ booking: baseBooking() });

    await sendAssignedStaffBookingChangeEmails("booking-1", stub.client, CHANGE_SUMMARY);

    expect(sendEmail).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(sendEmail).mock.calls.map((c) => c[0]);
    const recipients = calls.map((c) => c.to).sort();
    expect(recipients).toEqual(
      ["therapist1@staff.example.test", "therapist2@staff.example.test"].sort()
    );
    for (const call of calls) {
      expect(call.subject).toBe("Rahma Therapy Test assigned booking changed");
      expect(call.html as string).toContain(CHANGE_SUMMARY);
    }

    const trackedInserts = stub.inserts.filter((i) => i.table === "email_delivery_events");
    expect(trackedInserts).toHaveLength(2);
    expect(trackedInserts.every((i) => i.payload.event_type === "staff_booking_change")).toBe(true);
  });

  it("sends nothing when no one is assigned", async () => {
    const stub = stubClient({ booking: baseBooking(), assignedStaff: [] });

    await sendAssignedStaffBookingChangeEmails("booking-1", stub.client, CHANGE_SUMMARY);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("applies the admin-configured wrapper override to both the HTML and plain-text legs, for every recipient", async () => {
    const overrideRows = [
      { field_key: "wrapper_change_summary", value: "OVERRIDE — changes made on {date}:" },
    ];
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: overrideRows, error: null }) }),
      }),
    } as never);

    const stub = stubClient({ booking: baseBooking() });
    await sendAssignedStaffBookingChangeEmails("booking-1", stub.client, CHANGE_SUMMARY);

    const calls = vi.mocked(sendEmail).mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.html as string).toContain("OVERRIDE — changes made on 2026-07-20:");
      expect(call.html as string).not.toContain(CHANGE_SUMMARY);
    }
  });
});
