import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "@/lib/email/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { POST } from "../route";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn(),
}));

const SECRET = "test-cron-secret";
const NOW = new Date("2026-07-28T09:00:00.000Z");

function queuedRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    booking_id: `booking-${id}`,
    event_type: "booking_cancellation_customer",
    recipient_role: "customer",
    recipient_email: `${id}@example.test`,
    to_email: `${id}@example.test`,
    subject: "Rahma Therapy booking cancelled",
    html_payload: `<p>${id}</p>`,
    text_payload: `${id} plain`,
    scheduled_for: "2026-07-28T08:59:50.000Z",
    delivery_status: "queued",
    ...overrides,
  };
}

interface RecordedOp {
  op: "select" | "update";
  payload?: Record<string, unknown>;
  filters: string[];
}

/**
 * Stand-in for the Supabase admin client covering exactly the two chains the
 * route builds: the candidate sweep and the per-row status flip.
 */
function stubAdminClient({
  rows = [] as Record<string, unknown>[],
  selectError = null as { message: string } | null,
} = {}) {
  const ops: RecordedOp[] = [];

  function startOp(op: RecordedOp["op"], payload?: Record<string, unknown>) {
    const entry: RecordedOp = { op, payload, filters: [] };
    ops.push(entry);
    const result =
      op === "select"
        ? { data: selectError ? null : rows, error: selectError }
        : { data: null, error: null };
    const chain = {
      eq: (column: string, value: unknown) => {
        entry.filters.push(`eq:${column}=${String(value)}`);
        return chain;
      },
      lte: (column: string, value: unknown) => {
        entry.filters.push(`lte:${column}=${String(value)}`);
        return chain;
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        entry.filters.push(`order:${column}=${options?.ascending ? "asc" : "desc"}`);
        return chain;
      },
      limit: (count: number) => {
        entry.filters.push(`limit:${count}`);
        return chain;
      },
      then: (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(result).then(onFulfilled, onRejected),
    };
    return chain;
  }

  const from = vi.fn(() => ({
    select: () => startOp("select"),
    update: (payload: Record<string, unknown>) => startOp("update", payload),
  }));

  vi.mocked(createSupabaseAdminClient).mockReturnValue(
    { from } as unknown as ReturnType<typeof createSupabaseAdminClient>
  );

  return {
    ops,
    from,
    selects: () => ops.filter((entry) => entry.op === "select"),
    updates: () => ops.filter((entry) => entry.op === "update"),
  };
}

function post(headers: Record<string, string> = { "X-Cron-Secret": SECRET }) {
  return POST(new Request("https://internal.invalid/api/cron/scheduled-emails", {
    method: "POST",
    headers,
  }));
}

describe("POST /api/cron/scheduled-emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    process.env.CRON_SECRET = SECRET;
    vi.mocked(sendEmail).mockReset().mockResolvedValue({ id: "resend-id" });
  });

  it("rejects a request whose X-Cron-Secret does not match", async () => {
    const stub = stubAdminClient({ rows: [queuedRow("a")] });

    const res = await post({ "X-Cron-Secret": "wrong" });

    expect(res.status).toBe(401);
    // The gate runs before anything is read or sent.
    expect(stub.from).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects a request with no secret header at all", async () => {
    stubAdminClient({ rows: [queuedRow("a")] });

    expect((await post({})).status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("fails loudly when CRON_SECRET is unset rather than accepting anything", async () => {
    delete process.env.CRON_SECRET;
    stubAdminClient({ rows: [queuedRow("a")] });

    // A bare `if (secret !== process.env.CRON_SECRET)` would let a request with
    // no header through when the env var is missing; this is the canary.
    const res = await post({});

    expect(res.status).toBe(500);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns { sent: 0, total: 0 } when nothing is due", async () => {
    stubAdminClient({ rows: [] });

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0, total: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("only ever picks up queued rows whose scheduled_for has passed", async () => {
    const stub = stubAdminClient({ rows: [] });

    await post();

    // Drop `delivery_status = 'queued'` and a row restoreBooking already flipped
    // to 'cancelled_by_restore' gets sent anyway — the undo window would leak an
    // email it exists to prevent. Drop the lte and every future-scheduled row
    // fires on the next tick, collapsing the delay to zero.
    expect(stub.selects()[0].filters).toEqual([
      `lte:scheduled_for=${NOW.toISOString()}`,
      "eq:delivery_status=queued",
      "order:scheduled_for=asc",
      "limit:50",
    ]);
  });

  it("sends each queued row's stored payload and flips it to sent", async () => {
    const stub = stubAdminClient({ rows: [queuedRow("a"), queuedRow("b")] });

    const res = await post();

    expect(await res.json()).toEqual({ sent: 2, total: 2, failures: [] });
    // The payload comes off the row — the route never re-renders a template.
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenNthCalledWith(1, {
      to: "a@example.test",
      subject: "Rahma Therapy booking cancelled",
      html: "<p>a</p>",
      text: "a plain",
    });
    expect(stub.updates()).toEqual([
      { op: "update", payload: { delivery_status: "sent" }, filters: ["eq:id=a"] },
      { op: "update", payload: { delivery_status: "sent" }, filters: ["eq:id=b"] },
    ]);
  });

  it("marks only the failing row failed and still sends the rest", async () => {
    const stub = stubAdminClient({ rows: [queuedRow("a"), queuedRow("b")] });
    vi.mocked(sendEmail)
      .mockRejectedValueOnce(new Error("Resend 422"))
      .mockResolvedValueOnce({ id: "resend-id" });

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      sent: 1,
      total: 2,
      failures: ["a: Resend 422"],
    });
    expect(stub.updates()).toEqual([
      { op: "update", payload: { delivery_status: "failed" }, filters: ["eq:id=a"] },
      { op: "update", payload: { delivery_status: "sent" }, filters: ["eq:id=b"] },
    ]);
  });

  it("surfaces a query failure as a 500 without touching any row", async () => {
    const stub = stubAdminClient({ selectError: { message: "boom" } });

    const res = await post();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "boom", sent: 0, total: 0 });
    expect(stub.updates()).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
