import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendRecurringSeriesCancelledEmail } from "../notifications";

/**
 * C-02 Phase Fb — `sendRecurringSeriesCancelledEmail`. Mirrors
 * sendRecurringSeriesCreatedEmail.test.ts's shape: resolveTemplateOverrides
 * calls createSupabaseAdminClient() internally (not the `supabase` param this
 * function is handed), so that module is mocked independently of the stub
 * client below, which stands in for the caller's own admin client.
 *
 * The two load-bearing cases are the last two: an admin-edited body field
 * AND an admin-edited subject must both reach the real send (resolveSubject
 * / renderRecurringSeriesCancelledEmail called with the SAME resolved
 * overrides) — the exact wiring gap C-08 and C-15 each found and fixed once
 * already on other templates.
 *
 * Unlike the created-series email, a missing client email must NOT throw —
 * that case is its own dedicated spec below, asserting the function resolves
 * without calling sendEmail (a phone-only walk-in client's series must still
 * cancel successfully).
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
  clients: { full_name: "Aisha Khan", email: CUSTOMER_EMAIL },
  services: { name: "Hijama Package" },
};

function stubClient({ template }: { template: Record<string, unknown> | null }) {
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
      return Promise.resolve({ data: [], error: null });
    };
    const chain = {
      select: () => chain,
      eq: () => chain,
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

describe("sendRecurringSeriesCancelledEmail", () => {
  it("sends the recurring-series-cancelled email to the client with the default copy", async () => {
    const stub = stubClient({ template: BASE_TEMPLATE_ROW });

    await sendRecurringSeriesCancelledEmail(TEMPLATE_ID, 8, stub.client);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe(CUSTOMER_EMAIL);
    expect(call.subject).toBe("Your recurring booking has been cancelled");
    expect(call.html as string).toContain(
      "Hi Aisha Khan, your weekly Hijama Package series has been cancelled. 8 upcoming visits have been cancelled. Get in touch if you&#039;d like to set up a new series."
    );
    expect(call.text as string).toContain(
      "Hi Aisha Khan, your weekly Hijama Package series has been cancelled. 8 upcoming visits have been cancelled. Get in touch if you'd like to set up a new series."
    );

    const trackedInsert = stub.inserts.find((i) => i.table === "email_delivery_events");
    expect(trackedInsert?.payload).toMatchObject({
      booking_id: null,
      event_type: "recurring_series_cancelled_client",
      recipient_role: "customer",
    });
  });

  it("uses the exact cancelled-occurrence count passed in, not a fixed number", async () => {
    const stub = stubClient({ template: BASE_TEMPLATE_ROW });

    await sendRecurringSeriesCancelledEmail(TEMPLATE_ID, 1, stub.client);

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html as string).toContain("1 upcoming visits have been cancelled");
  });

  it("no-ops without throwing when the template's client has no email address", async () => {
    const stub = stubClient({
      template: { ...BASE_TEMPLATE_ROW, clients: { full_name: "Aisha Khan", email: null } },
    });

    await expect(
      sendRecurringSeriesCancelledEmail(TEMPLATE_ID, 8, stub.client)
    ).resolves.toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("throws when the template row cannot be found", async () => {
    const stub = stubClient({ template: null });

    await expect(
      sendRecurringSeriesCancelledEmail(TEMPLATE_ID, 8, stub.client)
    ).rejects.toThrow(/not found/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("an admin-edited body field reaches the real send — the HTML and plain-text legs both change", async () => {
    const overrideRows = [
      {
        field_key: "body_intro",
        value: "OVERRIDE — {clientName}, your {cadence} series is cancelled.",
      },
    ];
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: overrideRows, error: null }) }),
      }),
    } as never);

    const stub = stubClient({ template: BASE_TEMPLATE_ROW });
    await sendRecurringSeriesCancelledEmail(TEMPLATE_ID, 8, stub.client);

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html as string;
    const text = call.text as string;

    expect(html).toContain("OVERRIDE — Aisha Khan, your weekly series is cancelled.");
    expect(html).not.toContain("has been cancelled. 8 upcoming");
    expect(text).toContain("OVERRIDE — Aisha Khan, your weekly series is cancelled.");
  });

  it("an admin-edited subject reaches the real Subject: header, not just the resolved default", async () => {
    const overrideRows = [
      { field_key: "subject", value: "Your {cadence} series has ended" },
    ];
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: overrideRows, error: null }) }),
      }),
    } as never);

    const stub = stubClient({ template: BASE_TEMPLATE_ROW });
    await sendRecurringSeriesCancelledEmail(TEMPLATE_ID, 8, stub.client);

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.subject).toBe("Your weekly series has ended");
  });
});
