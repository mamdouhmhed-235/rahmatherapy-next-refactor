// C-15 Phase D, Step 16 — sendTestEmail coverage.
//
// Scope, per the dispatch: recipient locked to the actor's own address
// (never a form value — the highest-severity risk row in brief §4), draft
// validation shared with saveTemplateOverride, the 60s per-template rate
// limit interacting correctly with audit-on-success-only, sendEmail (never
// sendTrackedEmail — no email_delivery_events row), the `[Test] ` subject
// prefix, and the Phase B merge path ("" means default, draft wins over
// saved). templates.ts and sample-data.ts run FOR REAL here (not mocked) —
// only the Supabase clients, rbac, and the Resend wrapper are stubbed — so
// these specs exercise the exact render path a real send uses, not a
// parallel one.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendTestEmail } from "../actions";
import { PermissionError } from "@/lib/auth/rbac";

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  requirePermission: vi.fn(),
}));

vi.mock("@/lib/email/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/client")>()),
  sendEmail: vi.fn(),
  getFromEmail: vi.fn(() => "noreply@rahmatherapy.example.test"),
}));

const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
const { requirePermission } = await import("@/lib/auth/rbac");
const { sendEmail, EmailDeliveryError } = await import("@/lib/email/client");

const TEMPLATE_ID = "booking_confirmation";

function testFormData(fields: Record<string, string> = {}, templateId = TEMPLATE_ID) {
  const data = new FormData();
  data.set("template_id", templateId);
  for (const [key, value] of Object.entries(fields)) {
    data.set(`field:${key}`, value);
  }
  return data;
}

function actor(overrides: Record<string, unknown> = {}) {
  return {
    id: "staff-owner",
    name: "Owner",
    email: "owner@rahmatherapy.example.test",
    notification_email: null,
    ...overrides,
  };
}

/** Stubs email_template_overrides (read by resolveTemplateOverrides) and
 *  audit_logs (read by the rate limit, written by the success audit). */
function stubAdminClient(
  {
    overrideRows = [] as { field_key: string; value: string }[],
    latestAuditRow = null as { created_at: string } | null,
  } = {}
) {
  const inserts: Record<string, unknown>[] = [];
  const tableNames: string[] = [];

  const from = vi.fn((table: string) => {
    tableNames.push(table);
    if (table === "email_template_overrides") {
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: overrideRows, error: null }),
        }),
      };
    }
    if (table === "audit_logs") {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.order = () => chain;
      chain.limit = () => chain;
      chain.maybeSingle = async () => ({ data: latestAuditRow, error: null });
      chain.insert = vi.fn(async (row: Record<string, unknown>) => {
        inserts.push(row);
        return { error: null };
      });
      return chain;
    }
    throw new Error(`Unexpected table in sendTestEmail: ${table}`);
  });

  return { client: { from }, inserts, tableNames };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue(actor() as never);
  vi.mocked(sendEmail).mockResolvedValue({ id: "resend-msg-1" } as never);
});

describe("sendTestEmail — permission gate", () => {
  it("returns an error and never calls sendEmail when the actor lacks MANAGE_EMAIL_TEMPLATES", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(
      new PermissionError("FORBIDDEN", "Permission required.")
    );
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await sendTestEmail(null, testFormData());

    expect(result.ok).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("sendTestEmail — unknown template", () => {
  it("rejects an id that isn't in the registry", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await sendTestEmail(null, testFormData({}, "not_a_real_template"));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unknown template/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("sendTestEmail — recipient is locked to the actor's own address (brief §4 highest-severity risk)", () => {
  it("sends to notification_email when set, ignoring a form-supplied recipient_email entirely", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      actor({ notification_email: "owner-alerts@rahmatherapy.example.test" }) as never
    );
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const data = testFormData();
    // Simulates a tampered client / attacker-controlled form field. The
    // action never reads this key — this spec fails loudly if it ever did.
    data.set("recipient_email", "attacker@evil.test");

    const result = await sendTestEmail(null, data);

    expect(result.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe("owner-alerts@rahmatherapy.example.test");
    expect(call.to).not.toBe("attacker@evil.test");
  });

  it("falls back to the login email when notification_email is null, still ignoring a form-supplied recipient", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      actor({ email: "owner@rahmatherapy.example.test", notification_email: null }) as never
    );
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const data = testFormData();
    data.set("recipient_email", "attacker@evil.test");

    const result = await sendTestEmail(null, data);

    expect(result.ok).toBe(true);
    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe("owner@rahmatherapy.example.test");
    expect(call.to).not.toBe("attacker@evil.test");
  });
});

describe("sendTestEmail — draft validation reuses saveTemplateOverride's rules (brief §5.5)", () => {
  it("rejects a subject over its 100-char maxLength and never sends", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await sendTestEmail(null, testFormData({ subject: "x".repeat(101) }));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/100 characters/i);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(stub.inserts).toHaveLength(0);
  });

  it("rejects a subject containing a control character and never sends", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await sendTestEmail(null, testFormData({ subject: "Line one\nLine two" }));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/line breaks/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects a non-https body_cta_url and never sends", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await sendTestEmail(
      null,
      testFormData({ body_cta_url: "javascript:alert(1)" }, "review_request_client")
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/https:\/\//);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("sendTestEmail — 60s per-template rate limit, audit-on-success-only", () => {
  it("blocks a second test send within 60s of the latest audit row, without sending", async () => {
    const stub = stubAdminClient({
      latestAuditRow: { created_at: new Date(Date.now() - 10_000).toISOString() }, // 10s ago
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await sendTestEmail(null, testFormData());

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/60 seconds|recently/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("allows a test send once the latest audit row is older than 60s", async () => {
    const stub = stubAdminClient({
      latestAuditRow: { created_at: new Date(Date.now() - 61_000).toISOString() }, // 61s ago
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await sendTestEmail(null, testFormData());

    expect(result.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("allows a test send when no prior test-send audit row exists at all", async () => {
    const stub = stubAdminClient({ latestAuditRow: null });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await sendTestEmail(null, testFormData());

    expect(result.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("writes exactly one email_template_test_sent audit row on success", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await sendTestEmail(null, testFormData());

    expect(result.ok).toBe(true);
    expect(stub.inserts).toHaveLength(1);
    expect(stub.inserts[0]).toMatchObject({
      action_type: "email_template_test_sent",
      actor_staff_id: "staff-owner",
    });
  });

  it("writes NO audit row when the send fails — a failed attempt must not consume the rate-limit window", async () => {
    vi.mocked(sendEmail).mockRejectedValueOnce(new EmailDeliveryError("Resend is down."));
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    const result = await sendTestEmail(null, testFormData());

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/delivery failed/i);
    expect(stub.inserts).toHaveLength(0);
  });
});

describe("sendTestEmail — sendEmail directly, never sendTrackedEmail (brief §2.6)", () => {
  it("never touches email_delivery_events", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await sendTestEmail(null, testFormData());

    expect(stub.tableNames).not.toContain("email_delivery_events");
    expect(stub.tableNames).toEqual(
      expect.arrayContaining(["email_template_overrides", "audit_logs"])
    );
  });
});

describe("sendTestEmail — subject prefix", () => {
  it("prefixes the resolved subject with '[Test] '", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await sendTestEmail(null, testFormData({ subject: "My custom subject" }));

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.subject).toBe("[Test] My custom subject");
  });

  it("falls back to the template's registry default subject when the draft subject is empty", async () => {
    const stub = stubAdminClient();
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await sendTestEmail(null, testFormData({ subject: "" }));

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.subject).toBe("[Test] Booking request received");
  });
});

describe("sendTestEmail — Phase B merge path reused (draft over saved, '' means default)", () => {
  it("renders the saved override when the draft doesn't mention that field", async () => {
    const stub = stubAdminClient({
      overrideRows: [{ field_key: "greeting_intro", value: "Salaam {clientName}, saved override text." }],
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await sendTestEmail(null, testFormData({ subject: "Booking request received" }));

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain("Salaam Aisha Khan, saved override text.");
  });

  it("draft wins over the saved override for the same field", async () => {
    const stub = stubAdminClient({
      overrideRows: [{ field_key: "greeting_intro", value: "Salaam {clientName}, saved override text." }],
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await sendTestEmail(
      null,
      testFormData({ greeting_intro: "Draft text for {clientName}, unsaved edit." })
    );

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain("Draft text for Aisha Khan, unsaved edit.");
    expect(call.html).not.toContain("saved override text");
  });

  it("an empty-string draft value falls back to the registry default, not the still-saved override (C-15 Phase B semantics)", async () => {
    const stub = stubAdminClient({
      overrideRows: [{ field_key: "greeting_intro", value: "Salaam {clientName}, saved override text." }],
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);

    await sendTestEmail(null, testFormData({ greeting_intro: "" }));

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).not.toContain("saved override text");
    expect(call.html).toContain("Hi Aisha Khan, we have received your Rahma Therapy booking request.");
  });
});
