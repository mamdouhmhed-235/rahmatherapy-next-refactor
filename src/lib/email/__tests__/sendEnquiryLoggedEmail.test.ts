import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEnquiryLoggedEmail } from "../notifications";

/**
 * C-08 Phase D Step 16. `sendEnquiryLoggedEmail` takes its `supabase` client
 * as a parameter, so the enquiry/business-settings/staff stub below is
 * passed straight in. `resolveTemplateOverrides` (called once inside the
 * real, unmocked `renderEnquiryLoggedEmail` for the HTML leg, and once again
 * directly by the send fn for the plain-text leg) creates its own admin
 * client via `createSupabaseAdminClient`, so that factory is mocked
 * separately — by default returning empty overrides. `getSiteUrl` is mocked
 * directly rather than relying on `NEXT_PUBLIC_SITE_URL` being set in the
 * test environment (mirrors how other C-08 specs mock `ensureBookingManageUrl`
 * instead of exercising the real env-var path).
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
  getSiteUrl: vi.fn(() => "https://rahmatherapy.example.test"),
}));

vi.mock("@/lib/ops/operational-events", () => ({
  recordOperationalEvent: vi.fn().mockResolvedValue(undefined),
}));

const SETTINGS = {
  company_name: "Rahma Therapy Test",
  contact_email: "owner@rahmatherapy.example.test",
  contact_phone: "01582 000000",
};

const ENQUIRY_ID = "enquiry-1";
const ACTOR_STAFF_ID = "staff-admin-jamie";

function baseEnquiry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ENQUIRY_ID,
    full_name: "Priya Shah",
    phone: "07123456789",
    email: "priya@client.example.test",
    service_interest: "Swedish massage",
    ...overrides,
  };
}

/**
 * Stand-in for the `supabase` param the send fn receives directly. Covers
 * the enquiries lookup, the actor's staff_profiles name lookup, the
 * business_settings read, `resolveBusinessNotificationRecipients`' bulk
 * staff_profiles fetch, and the email_delivery_events insert
 * `sendTrackedEmail`/`sendToBusinessRecipients` write on send.
 */
function stubClient({
  enquiry,
  settings = SETTINGS,
  actor,
  staffProfiles = [],
}: {
  enquiry: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  actor: Record<string, unknown> | null;
  /** C-08 Phase D — rows for `resolveBusinessNotificationRecipients`' bulk
   *  staff_profiles fetch (a distinct query from the `actor`
   *  `.eq("id", ...).maybeSingle()` lookup below — same table, different
   *  terminal call). Defaults to `[]` (zero opted-in), which is the
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
          data: table === "staff_profiles" ? staffProfiles : [],
          error: null,
        }),
      maybeSingle: () =>
        Promise.resolve(
          table === "enquiries"
            ? { data: enquiry, error: null }
            : table === "business_settings"
              ? { data: settings, error: null }
              : table === "staff_profiles"
                ? { data: actor, error: null }
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

describe("sendEnquiryLoggedEmail", () => {
  it("falls back to getAdminRecipient and sends the default copy when nobody is opted in", async () => {
    const stub = stubClient({
      enquiry: baseEnquiry(),
      actor: { name: "Jamie" },
    });

    await sendEnquiryLoggedEmail(ENQUIRY_ID, ACTOR_STAFF_ID, stub.client);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe(SETTINGS.contact_email);
    expect(call.subject).toBe("New enquiry: Priya Shah");

    const html = call.html as string;
    const text = call.text as string;
    const expectedIntro =
      "Jamie logged a new enquiry from Priya Shah (priya@client.example.test) interested in Swedish massage. View it here: https://rahmatherapy.example.test/admin/enquiries.";
    expect(html).toContain(expectedIntro);
    expect(text).toContain(expectedIntro);

    const trackedInsert = stub.inserts.find((i) => i.table === "email_delivery_events");
    expect(trackedInsert?.payload).toMatchObject({
      booking_id: null,
      event_type: "enquiry_logged",
      recipient_role: "admin",
    });
  });

  it("falls back to (unknown) when the actor's staff row can't be found", async () => {
    const stub = stubClient({ enquiry: baseEnquiry(), actor: null });

    await sendEnquiryLoggedEmail(ENQUIRY_ID, ACTOR_STAFF_ID, stub.client);

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html as string).toContain("(unknown) logged a new enquiry");
  });

  it("throws when the enquiry can't be found", async () => {
    const stub = stubClient({ enquiry: null, actor: { name: "Jamie" } });

    await expect(
      sendEnquiryLoggedEmail(ENQUIRY_ID, ACTOR_STAFF_ID, stub.client)
    ).rejects.toThrow(`sendEnquiryLoggedEmail: enquiry ${ENQUIRY_ID} not found.`);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("falls back to a words placeholder when service_interest is null", async () => {
    const stub = stubClient({
      enquiry: baseEnquiry({ service_interest: null }),
      actor: { name: "Jamie" },
    });

    await sendEnquiryLoggedEmail(ENQUIRY_ID, ACTOR_STAFF_ID, stub.client);

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html as string).toContain("interested in an unspecified service.");
  });

  it("applies the admin-configured body_intro override to both the HTML and plain-text legs", async () => {
    const overrideRows = [
      {
        field_key: "body_intro",
        value: "OVERRIDE — {staffName} logged a lead from {clientName}.",
      },
    ];
    const overrideAdminClient = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: overrideRows, error: null }),
        }),
      }),
    };
    // resolveTemplateOverrides is called twice per send: once inside the
    // real renderEnquiryLoggedEmail (HTML leg), once directly by
    // sendEnquiryLoggedEmail for the plain-text leg.
    vi.mocked(createSupabaseAdminClient)
      .mockReturnValueOnce(overrideAdminClient as never)
      .mockReturnValueOnce(overrideAdminClient as never);

    const stub = stubClient({ enquiry: baseEnquiry(), actor: { name: "Jamie" } });

    await sendEnquiryLoggedEmail(ENQUIRY_ID, ACTOR_STAFF_ID, stub.client);

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html as string;
    const text = call.text as string;

    expect(html).toContain("OVERRIDE — Jamie logged a lead from Priya Shah.");
    expect(text).toContain("OVERRIDE — Jamie logged a lead from Priya Shah.");

    // The hardcoded default must not leak through on either leg (the C-01
    // regression this test guards against).
    expect(html).not.toContain("View it here");
    expect(text).not.toContain("View it here");
  });

  it("C-08 Phase D — sends to every opted-in Owner/Admin except the logging staff member, one row each", async () => {
    const stub = stubClient({
      enquiry: baseEnquiry(),
      actor: { name: "Jamie" },
      staffProfiles: [
        // Jamie herself is also an opted-in Admin here — skip-self must
        // exclude her from the alert about her own enquiry.
        {
          id: ACTOR_STAFF_ID,
          email: "jamie@rahmatherapy.example.test",
          notification_email: null,
          business_notification_prefs: { enabled: true },
          roles: { name: "Admin" },
        },
        {
          id: "staff-owner",
          email: "owner@rahmatherapy.example.test",
          notification_email: null,
          business_notification_prefs: { enabled: true },
          roles: { name: "Owner" },
        },
      ],
    });

    await sendEnquiryLoggedEmail(ENQUIRY_ID, ACTOR_STAFF_ID, stub.client);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe("owner@rahmatherapy.example.test");

    const trackedInserts = stub.inserts.filter((i) => i.table === "email_delivery_events");
    expect(trackedInserts).toHaveLength(1);
    expect(trackedInserts[0].payload).toMatchObject({
      booking_id: null,
      staff_id: "staff-owner",
    });
  });

  it("C-08 Phase D — writes a skipped row with actor_excluded when the logger is the only opted-in recipient", async () => {
    const stub = stubClient({
      enquiry: baseEnquiry(),
      actor: { name: "Jamie" },
      staffProfiles: [
        {
          id: ACTOR_STAFF_ID,
          email: "jamie@rahmatherapy.example.test",
          notification_email: null,
          business_notification_prefs: { enabled: true },
          roles: { name: "Admin" },
        },
      ],
    });

    await sendEnquiryLoggedEmail(ENQUIRY_ID, ACTOR_STAFF_ID, stub.client);

    expect(sendEmail).not.toHaveBeenCalled();
    const skippedRow = stub.inserts.find((i) => i.table === "email_delivery_events");
    expect(skippedRow?.payload).toMatchObject({
      booking_id: null,
      event_type: "enquiry_logged",
      delivery_status: "skipped",
      error_message: "actor_excluded",
    });
  });

  it("C-08 Phase D — writes a skipped row with all_recipients_opted_out when everyone opted out of this alert type", async () => {
    const stub = stubClient({
      enquiry: baseEnquiry(),
      actor: { name: "Jamie" },
      staffProfiles: [
        {
          id: "staff-owner",
          email: "owner@rahmatherapy.example.test",
          notification_email: null,
          business_notification_prefs: { enabled: true, types: { enquiry_logged: false } },
          roles: { name: "Owner" },
        },
      ],
    });

    await sendEnquiryLoggedEmail(ENQUIRY_ID, ACTOR_STAFF_ID, stub.client);

    expect(sendEmail).not.toHaveBeenCalled();
    const skippedRow = stub.inserts.find((i) => i.table === "email_delivery_events");
    expect(skippedRow?.payload).toMatchObject({
      delivery_status: "skipped",
      error_message: "all_recipients_opted_out",
    });
  });
});
