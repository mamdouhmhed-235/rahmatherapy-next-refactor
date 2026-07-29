import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendReviewRequestEmail } from "@/lib/email/notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { POST } from "../review-emails/route";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/email/notifications", () => ({
  sendReviewRequestEmail: vi.fn(),
}));

const SECRET = "test-cron-secret";
// Winter, GMT (no DST offset), so the Europe/London wall-clock hour equals
// the UTC hour — keeps the fixture times unambiguous.
const DAYTIME = new Date("2026-01-15T10:00:00.000Z"); // 10:00 London — inside 08:00-21:00
const QUIET = new Date("2026-01-15T22:00:00.000Z"); // 22:00 London — inside the skip window

interface RecordedOp {
  op: "select";
  filters: string[];
}

/**
 * Stand-in for the Supabase admin client covering the one chain the route
 * itself builds directly: the candidate sweep. sendReviewRequestEmail is
 * mocked wholesale (see above), so its own DB calls never reach this stub —
 * only the route's `bookings` select and `audit_logs` insert do.
 */
function stubAdminClient({
  rows = [] as { id: string }[],
  selectError = null as { message: string } | null,
} = {}) {
  const ops: RecordedOp[] = [];
  const inserts: { table: string; payload: Record<string, unknown> }[] = [];

  const from = vi.fn((table: string) => {
    if (table === "bookings") {
      const entry: RecordedOp = { op: "select", filters: [] };
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
        select: () => chain,
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
        failed: 0,
      },
    });
    expect(stub.inserts).toEqual([]);
  });
});
