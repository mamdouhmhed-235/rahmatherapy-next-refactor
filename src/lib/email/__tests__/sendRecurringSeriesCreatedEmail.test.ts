import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendRecurringSeriesCreatedEmail } from "../notifications";

/**
 * C-02 Phase D (Step 12) — `sendRecurringSeriesCreatedEmail`. Mirrors
 * sendBookingRestoredClientEmail.test.ts's shape: resolveTemplateOverrides
 * calls createSupabaseAdminClient() internally (not the `supabase` param this
 * function is handed), so that module is mocked independently of the stub
 * client below, which stands in for the caller's own admin client.
 *
 * The two load-bearing cases are the last two: an admin-edited body field
 * AND an admin-edited subject must both reach the real send (resolveSubject
 * / renderRecurringSeriesCreatedEmail called with the SAME resolved
 * overrides) — the exact wiring gap C-08 and C-15 each found and fixed once
 * already on other templates.
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

const TEMPLATE_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_EMAIL = "aisha@client.example.test";

const BASE_TEMPLATE_ROW = {
  cadence: "weekly" as const,
  anchor_start_time: "14:00:00",
  clients: { full_name: "Aisha Khan", email: CUSTOMER_EMAIL },
  services: { name: "Hijama Package" },
};

const OCCURRENCE_ROWS = [
  { booking_date: "2026-09-04" },
  { booking_date: "2026-09-11" },
  { booking_date: "2026-09-18" },
];

function stubClient({
  template,
  occurrences = OCCURRENCE_ROWS,
}: {
  template: Record<string, unknown> | null;
  occurrences?: { booking_date: string }[];
}) {
  const inserts: { table: string; payload: Record<string, unknown> }[] = [];

  function startOp(table: string) {
    const settle = () => {
      if (table === "recurring_booking_templates") {
        return Promise.resolve(
          template
            ? { data: template, error: null }
            : { data: null, error: { message: "Not found." } }
        );
      }
      if (table === "bookings") {
        return Promise.resolve({ data: occurrences, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    };
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      returns: () => chain,
      single: settle,
      then: (resolve: (value: unknown) => unknown) => settle().then(resolve),
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

describe("sendRecurringSeriesCreatedEmail", () => {
  it("sends the recurring-series-created email to the client with the default copy", async () => {
    const stub = stubClient({ template: BASE_TEMPLATE_ROW });

    await sendRecurringSeriesCreatedEmail(TEMPLATE_ID, stub.client);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe(CUSTOMER_EMAIL);
    expect(call.subject).toBe("Your recurring booking is set");
    // The apostrophes in "we've"/"We'll" are escaped — escapeHtml runs over
    // the WHOLE substituted string (substitute-then-escape, the same order
    // every other HTML render site in templates.ts uses), not just the
    // variable values.
    expect(call.html as string).toContain(
      "Hi Aisha Khan, we&#039;ve set up your weekly Hijama Package starting 2026-09-04 at 14:00:00. The next 3 visits are confirmed. We&#039;ll send reminders for each one."
    );
    expect(call.text as string).toContain(
      "Hi Aisha Khan, we've set up your weekly Hijama Package starting 2026-09-04 at 14:00:00. The next 3 visits are confirmed. We'll send reminders for each one."
    );

    const trackedInsert = stub.inserts.find((i) => i.table === "email_delivery_events");
    expect(trackedInsert?.payload).toMatchObject({
      booking_id: null,
      event_type: "recurring_series_created_client",
      recipient_role: "customer",
    });
  });

  it("throws before sending when the template's client has no email address", async () => {
    const stub = stubClient({
      template: { ...BASE_TEMPLATE_ROW, clients: { full_name: "Aisha Khan", email: null } },
    });

    await expect(
      sendRecurringSeriesCreatedEmail(TEMPLATE_ID, stub.client)
    ).rejects.toThrow(/email/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("throws when the template row cannot be found", async () => {
    const stub = stubClient({ template: null });

    await expect(
      sendRecurringSeriesCreatedEmail(TEMPLATE_ID, stub.client)
    ).rejects.toThrow(/not found/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("derives firstDate and occurrenceCount from the bookings the RPC actually created, not a fixed number", async () => {
    const stub = stubClient({
      template: BASE_TEMPLATE_ROW,
      occurrences: [{ booking_date: "2026-10-02" }],
    });

    await sendRecurringSeriesCreatedEmail(TEMPLATE_ID, stub.client);

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html as string).toContain("starting 2026-10-02");
    expect(call.html as string).toContain("The next 1 visits are confirmed");
  });

  it("an admin-edited body field reaches the real send — the HTML and plain-text legs both change", async () => {
    const overrideRows = [
      {
        field_key: "body_intro",
        value: "OVERRIDE — {clientName}, your {cadence} series is booked.",
      },
    ];
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: overrideRows, error: null }) }),
      }),
    } as never);

    const stub = stubClient({ template: BASE_TEMPLATE_ROW });
    await sendRecurringSeriesCreatedEmail(TEMPLATE_ID, stub.client);

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html as string;
    const text = call.text as string;

    expect(html).toContain("OVERRIDE — Aisha Khan, your weekly series is booked.");
    expect(html).not.toContain("we&#039;ve set up");
    expect(text).toContain("OVERRIDE — Aisha Khan, your weekly series is booked.");
  });

  it("an admin-edited subject reaches the real Subject: header, not just the resolved default", async () => {
    const overrideRows = [
      { field_key: "subject", value: "Your {cadence} visits are confirmed" },
    ];
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: overrideRows, error: null }) }),
      }),
    } as never);

    const stub = stubClient({ template: BASE_TEMPLATE_ROW });
    await sendRecurringSeriesCreatedEmail(TEMPLATE_ID, stub.client);

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.subject).toBe("Your weekly visits are confirmed");
  });
});
