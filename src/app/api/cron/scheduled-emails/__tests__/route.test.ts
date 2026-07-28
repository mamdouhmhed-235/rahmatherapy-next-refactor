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

/**
 * The error C-04a actually shipped against: `service_role` held no UPDATE
 * privilege on `email_delivery_events`, so every write this route makes was
 * refused — silently, because none of them looked at `error`.
 */
const UPDATE_DENIED = {
  message: 'permission denied for table "email_delivery_events"',
};

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
  /** Columns the route asked for, so narrowing a projection is visible here. */
  projection?: string;
}

/**
 * Stand-in for the Supabase admin client covering the chains the route builds:
 * the candidate sweep, the conditional per-row claim (an update carrying a
 * `.select()`), the failure flip, and the operational-event insert.
 */
function stubAdminClient({
  rows = [] as Record<string, unknown>[],
  selectError = null as { message: string } | null,
  /** Row ids whose conditional claim matches nothing — the restore sweep won. */
  claimLostFor = [] as string[],
  /**
   * Row ids whose conditional claim WRITE fails, mapped to the error PostgREST
   * hands back. Distinct from `claimLostFor`: nothing was written at all, so
   * the row is still queued. This is what a missing UPDATE grant looks like.
   */
  claimErrorFor = {} as Record<string, { message: string }>,
  /** Row ids whose corrective flip to 'failed' fails, mapped to its error. */
  flipErrorFor = {} as Record<string, { message: string }>,
} = {}) {
  const ops: RecordedOp[] = [];
  const inserts: { table: string; payload: Record<string, unknown> }[] = [];

  function startOp(
    op: RecordedOp["op"],
    payload?: Record<string, unknown>,
    projection?: string
  ) {
    const entry: RecordedOp = { op, payload, filters: [], projection };
    ops.push(entry);
    // Resolved lazily: an update's result depends on filters applied after this.
    const resolve = () => {
      if (op === "select") {
        return { data: selectError ? null : rows, error: selectError };
      }
      const id = entry.filters
        .find((filter) => filter.startsWith("eq:id="))
        ?.slice("eq:id=".length) ?? "";
      if (entry.projection === undefined) {
        // A bare update — the corrective flip. PostgREST returns no rows
        // without a projection, so its error is the only signal there is.
        return { data: null, error: flipErrorFor[id] ?? null };
      }
      // The conditional claim. PostgREST returns zero rows when the extra
      // `delivery_status = 'queued'` filter no longer matches — and an error,
      // with no rows either way, when the write is refused outright.
      if (claimErrorFor[id]) return { data: null, error: claimErrorFor[id] };
      return { data: claimLostFor.includes(id) ? [] : [{ id }], error: null };
    };
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
      select: (columns?: string) => {
        entry.projection = columns;
        return chain;
      },
      then: (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(resolve()).then(onFulfilled, onRejected),
    };
    return chain;
  }

  const from = vi.fn((table: string) => ({
    select: (columns?: string) => startOp("select", undefined, columns),
    update: (payload: Record<string, unknown>) => startOp("update", payload),
    insert: (payload: Record<string, unknown>) => {
      inserts.push({ table, payload });
      return Promise.resolve({ data: null, error: null });
    },
  }));

  vi.mocked(createSupabaseAdminClient).mockReturnValue(
    { from } as unknown as ReturnType<typeof createSupabaseAdminClient>
  );

  return {
    ops,
    from,
    inserts,
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

  it("selects the whole row, because the send reads the stored payload off it", async () => {
    const stub = stubAdminClient({ rows: [] });

    await post();

    // Narrowing this projection (to `id`, say) would leave every other spec here
    // green — the rows are handed straight back by the stub — while production
    // read `undefined` for to_email/subject/html_payload/text_payload and sent
    // empty emails. So the projection itself is asserted.
    expect(stub.selects()[0].projection).toBe("*");
  });

  it("sends each queued row's stored payload after claiming it", async () => {
    const stub = stubAdminClient({ rows: [queuedRow("a"), queuedRow("b")] });

    const res = await post();

    expect(await res.json()).toEqual({
      sent: 2,
      skipped: 0,
      errored: 0,
      total: 2,
      failures: [],
    });
    // The payload comes off the row — the route never re-renders a template.
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenNthCalledWith(1, {
      to: "a@example.test",
      subject: "Rahma Therapy booking cancelled",
      html: "<p>a</p>",
      text: "a plain",
    });
    // One write per row: the claim is the flip to sent.
    expect(stub.updates()).toEqual([
      {
        op: "update",
        payload: { delivery_status: "sent" },
        filters: ["eq:id=a", "eq:delivery_status=queued"],
        projection: "id",
      },
      {
        op: "update",
        payload: { delivery_status: "sent" },
        filters: ["eq:id=b", "eq:delivery_status=queued"],
        projection: "id",
      },
    ]);
  });

  it("claims a row conditionally, and before sending it", async () => {
    const stub = stubAdminClient({ rows: [queuedRow("a")] });
    let updatesWhenSent = -1;
    vi.mocked(sendEmail).mockImplementation(async () => {
      updatesWhenSent = stub.updates().length;
      return { id: "resend-id" };
    });

    await post();

    // The claim must already be written when the send happens — sending first
    // and writing after is what lets a mid-send restore be overwritten by 'sent'.
    expect(updatesWhenSent).toBe(1);
    const claim = stub.updates()[0];
    // Filtered on the status as well as the id: without that predicate the
    // update always matches, the restore sweep can never win the race, and the
    // customer gets a cancellation for a booking that is confirmed again.
    expect(claim.filters).toEqual(["eq:id=a", "eq:delivery_status=queued"]);
    // ...and the projection is what makes the outcome of the race legible.
    expect(claim.projection).toBe("id");
  });

  it("does not send a row whose claim matched nothing, and reports it skipped", async () => {
    const stub = stubAdminClient({
      rows: [queuedRow("a"), queuedRow("b")],
      claimLostFor: ["a"],
    });

    const res = await post();

    // Row a was flipped to 'cancelled_by_restore' between the sweep and the
    // claim. Losing that race is the mechanism working, not a failure.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      sent: 1,
      skipped: 1,
      errored: 0,
      total: 2,
      failures: [],
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "b@example.test" })
    );
    // No follow-up write on the row we lost — its status stays whatever the
    // restore sweep set.
    expect(stub.updates().filter((entry) => entry.filters.includes("eq:id=a")))
      .toHaveLength(1);
  });

  it("reports a claim that errored as a failure rather than a lost race", async () => {
    const stub = stubAdminClient({
      rows: [queuedRow("a"), queuedRow("b")],
      claimErrorFor: { a: UPDATE_DENIED },
    });

    const res = await post();

    // A claim that was refused and a claim the restore sweep won produce the
    // same empty row set. Counting them together is how this route answered
    // 200 { sent: 0, skipped: N, failures: [] } for a whole day of emails that
    // never left — a body indistinguishable from a healthy tick.
    expect(await res.json()).toEqual({
      sent: 1,
      skipped: 0,
      errored: 1,
      total: 2,
      failures: [`a: claim failed: ${UPDATE_DENIED.message}`],
    });
    // Nothing was written, so nothing may be sent: the row is still queued and
    // the next tick owns it.
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "b@example.test" })
    );
    // ...and no corrective write on it either — there is nothing to correct.
    expect(stub.updates().filter((entry) => entry.filters.includes("eq:id=a")))
      .toHaveLength(1);
  });

  it("records the reason when a send fails, and still sends the rest", async () => {
    const stub = stubAdminClient({ rows: [queuedRow("a"), queuedRow("b")] });
    vi.mocked(sendEmail)
      .mockRejectedValueOnce(new Error("Resend 422"))
      .mockResolvedValueOnce({ id: "resend-id" });

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      sent: 1,
      skipped: 0,
      errored: 0,
      total: 2,
      failures: ["a: Resend 422"],
    });
    expect(stub.updates()).toEqual([
      {
        op: "update",
        payload: { delivery_status: "sent" },
        filters: ["eq:id=a", "eq:delivery_status=queued"],
        projection: "id",
      },
      // A bare `{ delivery_status: 'failed' }` leaves /admin/emails showing a
      // failure with no reason — the error text belongs on the row.
      {
        op: "update",
        payload: { delivery_status: "failed", error_message: "Resend 422" },
        filters: ["eq:id=a"],
      },
      {
        op: "update",
        payload: { delivery_status: "sent" },
        filters: ["eq:id=b", "eq:delivery_status=queued"],
        projection: "id",
      },
    ]);
    // ...and the same operational event the immediate-send path records, so the
    // nav failure counter and /admin/operations see it too.
    expect(stub.inserts).toEqual([
      {
        table: "operational_events",
        payload: expect.objectContaining({
          event_type: "failed_email_send",
          severity: "error",
          booking_id: "booking-a",
        }),
      },
    ]);
  });

  it("surfaces a corrective flip that failed without losing the send error", async () => {
    const stub = stubAdminClient({
      rows: [queuedRow("a")],
      flipErrorFor: { a: UPDATE_DENIED },
    });
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("Resend 422"));

    const res = await post();

    // The row was claimed to 'sent' before the send. If the flip back to
    // 'failed' is also refused, the row reads 'sent' for an email that never
    // went — the one state /admin/emails cannot be trusted on. So BOTH facts
    // are reported, and the second never displaces the first.
    expect(await res.json()).toEqual({
      sent: 0,
      skipped: 0,
      errored: 0,
      total: 1,
      failures: [
        "a: Resend 422",
        `a: could not mark failed: ${UPDATE_DENIED.message}`,
      ],
    });
    // The operational event still lands, so /admin/operations sees the failed
    // send whatever the corrective write did.
    expect(stub.inserts).toHaveLength(1);
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
