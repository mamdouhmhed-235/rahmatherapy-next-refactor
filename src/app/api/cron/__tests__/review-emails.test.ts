import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getClientsAskedForReviewSince,
  getCompletedBookingCountsByClient,
  sendReviewRequestEmail,
} from "@/lib/email/notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { POST } from "../review-emails/route";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

// Defence in depth. Nothing in this file should reach the transport — the
// sender itself is mocked below — but the notifications mock now spreads the
// real module, which pulls client.ts into the graph. sendEmail there is an
// unguarded wrapper over the real Resend SDK, so it is stubbed outright
// rather than left one mistake away from a live send.
vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn(),
  getFromEmail: vi.fn(() => "Rahma Therapy <no-reply@rahmatherapy.example.test>"),
  extractEmailAddress: vi.fn((value: string) => value),
}));

// Spread the real module so the PURE helpers (classifyReviewClient,
// reviewCooldownStart) actually run — the same reasoning as the RBAC mocks
// elsewhere in this repo, where the real logic runs and only the inputs are
// fixtures. Only the sender and the two DB-touching batch helpers are stubbed.
vi.mock("@/lib/email/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/notifications")>()),
  sendReviewRequestEmail: vi.fn(),
  getClientsAskedForReviewSince: vi.fn(),
  getCompletedBookingCountsByClient: vi.fn(),
}));

const SECRET = "test-cron-secret";
// Winter, GMT (no DST offset), so the Europe/London wall-clock hour equals
// the UTC hour — keeps the fixture times unambiguous.
const DAYTIME = new Date("2026-01-15T10:00:00.000Z"); // 10:00 London — inside 08:00-21:00
const QUIET = new Date("2026-01-15T22:00:00.000Z"); // 22:00 London — inside the skip window

interface RecordedOp {
  op: "select";
  projection: string | null;
  filters: string[];
}

interface CandidateRow {
  id: string;
  client_id?: string | null;
  recurring_template_id?: string | null;
}

/**
 * Stand-in for the Supabase admin client covering the one chain the route
 * itself builds directly: the candidate sweep. sendReviewRequestEmail is
 * mocked wholesale (see above), so its own DB calls never reach this stub —
 * only the route's `bookings` select and `audit_logs` insert do.
 */
function stubAdminClient({
  rows = [] as CandidateRow[],
  selectError = null as { message: string } | null,
} = {}) {
  const ops: RecordedOp[] = [];
  const inserts: { table: string; payload: Record<string, unknown> }[] = [];

  const from = vi.fn((table: string) => {
    if (table === "bookings") {
      const entry: RecordedOp = { op: "select", projection: null, filters: [] };
      ops.push(entry);
      const chain = {
        eq: (column: string, value: unknown) => {
          entry.filters.push(`eq:${column}=${String(value)}`);
          return chain;
        },
        is: (column: string, value: unknown) => {
          entry.filters.push(`is:${column}=${String(value)}`);
          return chain;
        },
        gte: (column: string, value: unknown) => {
          entry.filters.push(`gte:${column}=${String(value)}`);
          return chain;
        },
        lte: (column: string, value: unknown) => {
          entry.filters.push(`lte:${column}=${String(value)}`);
          return chain;
        },
        limit: (count: number) => {
          entry.filters.push(`limit:${count}`);
          return chain;
        },
        select: (projection?: string) => {
          entry.projection = projection ?? null;
          return chain;
        },
        then: (
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) =>
          Promise.resolve(
            selectError ? { data: null, error: selectError } : { data: rows, error: null }
          ).then(onFulfilled, onRejected),
      };
      return chain;
    }
    if (table === "audit_logs") {
      return {
        insert: (payload: Record<string, unknown>) => {
          inserts.push({ table, payload });
          return Promise.resolve({ data: null, error: null });
        },
      };
    }
    throw new Error(`stubAdminClient: unexpected table "${table}"`);
  });

  vi.mocked(createSupabaseAdminClient).mockReturnValue(
    { from } as unknown as ReturnType<typeof createSupabaseAdminClient>
  );

  return {
    from,
    inserts,
    selects: () => ops,
  };
}

function post(headers: Record<string, string> = { "X-Cron-Secret": SECRET }) {
  return POST(
    new Request("https://internal.invalid/api/cron/review-emails", {
      method: "POST",
      headers,
    })
  );
}

describe("POST /api/cron/review-emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(DAYTIME);
    process.env.CRON_SECRET = SECRET;
    // Default: nobody is inside the cooldown and no client has prior completed
    // bookings. Tests that care override these.
    vi.mocked(getClientsAskedForReviewSince).mockResolvedValue(new Set());
    vi.mocked(getCompletedBookingCountsByClient).mockResolvedValue(new Map());
  });

  it("fails loudly when CRON_SECRET is unset rather than accepting anything", async () => {
    delete process.env.CRON_SECRET;
    const stub = stubAdminClient({ rows: [{ id: "a" }] });

    const res = await post({});

    expect(res.status).toBe(500);
    expect(stub.from).not.toHaveBeenCalled();
    expect(sendReviewRequestEmail).not.toHaveBeenCalled();
  });

  it("rejects a request whose X-Cron-Secret does not match", async () => {
    const stub = stubAdminClient({ rows: [{ id: "a" }] });

    const res = await post({ "X-Cron-Secret": "wrong" });

    expect(res.status).toBe(401);
    // The gate runs before anything is read or sent.
    expect(stub.from).not.toHaveBeenCalled();
    expect(sendReviewRequestEmail).not.toHaveBeenCalled();
  });

  it("skips without touching the DB during quiet hours", async () => {
    vi.setSystemTime(QUIET);
    const stub = stubAdminClient({ rows: [{ id: "a" }] });

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      summary: {
        candidates: 0,
        sent: 0,
        skipped_no_email: 0,
        skipped_already_sent: 0,
        skipped_quiet_hours: 0,
        skipped_client_cooldown: 0,
        failed: 0,
      },
      skipped_reason: "quiet_hours",
    });
    expect(stub.from).not.toHaveBeenCalled();
    expect(sendReviewRequestEmail).not.toHaveBeenCalled();
  });

  it("returns 0 sent when there are no daytime candidates", async () => {
    const stub = stubAdminClient({ rows: [] });

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      summary: {
        candidates: 0,
        sent: 0,
        skipped_no_email: 0,
        skipped_already_sent: 0,
        skipped_quiet_hours: 0,
        skipped_client_cooldown: 0,
        failed: 0,
      },
    });
    expect(sendReviewRequestEmail).not.toHaveBeenCalled();
    // The candidate query itself — status/sentinel/window/limit, in the shape
    // the brief specifies.
    const filters = stub.selects()[0].filters;
    expect(filters[0]).toBe("eq:status=completed");
    expect(filters[1]).toBe("is:review_email_sent_at=null");
    expect(filters[2]).toMatch(/^gte:completed_at=/);
    expect(filters[3]).toMatch(/^lte:completed_at=/);
    expect(filters[4]).toBe("limit:50");
  });

  it("sends every sendable candidate and writes one audit row per send", async () => {
    const stub = stubAdminClient({ rows: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    vi.mocked(sendReviewRequestEmail).mockResolvedValue({ sent: true });

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      summary: {
        candidates: 3,
        sent: 3,
        skipped_no_email: 0,
        skipped_already_sent: 0,
        skipped_quiet_hours: 0,
        skipped_client_cooldown: 0,
        failed: 0,
      },
    });
    expect(sendReviewRequestEmail).toHaveBeenCalledTimes(3);
    expect(stub.inserts).toEqual([
      {
        table: "audit_logs",
        payload: {
          action_type: "review_email_sent",
          target_type: "bookings",
          target_id: "a",
          after_state: {
            booking_id: "a",
            automated: true,
            cron_trigger: "review-emails-15min",
            client_class: "first_time",
          },
        },
      },
      {
        table: "audit_logs",
        payload: {
          action_type: "review_email_sent",
          target_type: "bookings",
          target_id: "b",
          after_state: {
            booking_id: "b",
            automated: true,
            cron_trigger: "review-emails-15min",
            client_class: "first_time",
          },
        },
      },
      {
        table: "audit_logs",
        payload: {
          action_type: "review_email_sent",
          target_type: "bookings",
          target_id: "c",
          after_state: {
            booking_id: "c",
            automated: true,
            cron_trigger: "review-emails-15min",
            client_class: "first_time",
          },
        },
      },
    ]);
  });

  it("counts an already-sent candidate in skipped_already_sent, not sent", async () => {
    const stub = stubAdminClient({ rows: [{ id: "a" }] });
    vi.mocked(sendReviewRequestEmail).mockResolvedValue({
      sent: false,
      reason: "already_sent",
    });

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      summary: {
        candidates: 1,
        sent: 0,
        skipped_no_email: 0,
        skipped_already_sent: 1,
        skipped_quiet_hours: 0,
        skipped_client_cooldown: 0,
        failed: 0,
      },
    });
    expect(stub.inserts).toEqual([]);
  });

  // ---- Item 1: cooldown pre-filter and client classification ----

  it("counts a cooldown-suppressed candidate into skipped_client_cooldown, not sent", async () => {
    const stub = stubAdminClient({ rows: [{ id: "a", client_id: "c1" }] });
    vi.mocked(getClientsAskedForReviewSince).mockResolvedValue(new Set(["c1"]));

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      summary: {
        candidates: 1,
        sent: 0,
        skipped_no_email: 0,
        skipped_already_sent: 0,
        skipped_quiet_hours: 0,
        skipped_client_cooldown: 1,
        failed: 0,
      },
    });
    // Suppressed before the sender is reached at all, so no send and no audit
    // row — and critically no sentinel write, which happens inside the sender.
    expect(sendReviewRequestEmail).not.toHaveBeenCalled();
    expect(stub.inserts).toEqual([]);
  });

  it("calls the cooldown batch helper once per tick regardless of candidate count", async () => {
    stubAdminClient({
      rows: [
        { id: "a", client_id: "c1" },
        { id: "b", client_id: "c1" },
        { id: "c", client_id: "c2" },
        { id: "d", client_id: "c2" },
      ],
    });
    vi.mocked(sendReviewRequestEmail).mockResolvedValue({ sent: true });

    await post();

    expect(getClientsAskedForReviewSince).toHaveBeenCalledTimes(1);
    // Distinct client ids only — four candidates, two clients.
    expect(vi.mocked(getClientsAskedForReviewSince).mock.calls[0][0]).toEqual(["c1", "c2"]);
    expect(sendReviewRequestEmail).toHaveBeenCalledTimes(4);
  });

  it("computes the classification count in the same batched query as the cooldown lookup, not once per candidate", async () => {
    stubAdminClient({
      rows: [
        { id: "a", client_id: "c1" },
        { id: "b", client_id: "c2" },
        { id: "c", client_id: "c3" },
      ],
    });
    vi.mocked(sendReviewRequestEmail).mockResolvedValue({ sent: true });

    await post();

    expect(getCompletedBookingCountsByClient).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getCompletedBookingCountsByClient).mock.calls[0][0]).toEqual([
      "c1",
      "c2",
      "c3",
    ]);
  });

  it("widens the candidate select to include client_id and recurring_template_id", async () => {
    // The admin client is untyped, so a missing column here would surface as
    // `undefined` at runtime rather than as a compile error — hence pinning
    // the projection rather than trusting it.
    const stub = stubAdminClient({ rows: [] });

    await post();

    expect(stub.selects()[0].projection).toBe("id, client_id, recurring_template_id");
  });

  it("records the client class in the audit row's after_state alongside automated: true", async () => {
    const stub = stubAdminClient({
      rows: [
        { id: "a", client_id: "c1", recurring_template_id: "tpl-1" },
        { id: "b", client_id: "c2" },
        { id: "c", client_id: "c3" },
      ],
    });
    // c2 has two completed bookings including this one; c3 has only this one.
    vi.mocked(getCompletedBookingCountsByClient).mockResolvedValue(
      new Map([
        ["c1", 7],
        ["c2", 2],
        ["c3", 1],
      ])
    );
    vi.mocked(sendReviewRequestEmail).mockResolvedValue({ sent: true });

    await post();

    expect(
      stub.inserts.map((i) => (i.payload.after_state as Record<string, unknown>).client_class)
    ).toEqual(["series", "returning", "first_time"]);
    // The series row proves recurring_template_id wins over the count.
    expect(stub.inserts[0].payload.after_state).toEqual({
      booking_id: "a",
      automated: true,
      cron_trigger: "review-emails-15min",
      client_class: "series",
    });
  });

});
