import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { POST } from "../extend-recurring-horizons/route";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

const SECRET = "test-cron-secret";
/** 2026-10-30 in Europe/London (GMT — BST ended 2026-10-25). */
const NOW = new Date("2026-10-30T09:00:00.000Z");
/** `today + 12*7 - 1`, the window this run should reconcile every series to. */
const NEW_HORIZON = "2027-01-21";

/**
 * The series every test builds on: weekly, anchored Friday 2026-09-04, its first
 * batch of 12 materialised through 2026-11-20, `horizon_through_date` sitting at
 * 2026-11-26 — six days PAST the last real visit, which is the whole reason this
 * route may not resume from it. See the route header and
 * redesign/evidence/C-02/phase-b-rpc-verification.md §3.
 */
const ANCHOR = "2026-09-04";
const STORED_HORIZON = "2026-11-26";
const FIRST_BATCH = [
  "2026-09-04", "2026-09-11", "2026-09-18", "2026-09-25",
  "2026-10-02", "2026-10-09", "2026-10-16", "2026-10-23",
  "2026-10-30", "2026-11-06", "2026-11-13", "2026-11-20",
];

type Row = Record<string, unknown>;

function template(overrides: Row = {}): Row {
  return {
    id: "tmpl-1",
    client_id: "client-1",
    service_id: "service-1",
    bound_therapist_id: null,
    anchor_start_time: "09:00:00",
    cadence: "weekly",
    end_type: "until_cancelled",
    end_count: null,
    end_date: null,
    participant_gender: "female",
    required_therapist_gender: "female",
    service_address_line1: "1 Test Street",
    service_city: "Luton",
    service_postcode: "LU1 1AA",
    horizon_through_date: STORED_HORIZON,
    cancelled_at: null,
    ...overrides,
  };
}

function occurrence(date: string, overrides: Row = {}): Row {
  return {
    id: `booking-${date}`,
    client_id: "client-1",
    recurring_template_id: "tmpl-1",
    booking_date: date,
    start_time: "09:00:00",
    status: "pending",
    deleted_at: null,
    consent_acknowledged: true,
    ...overrides,
  };
}

const CLIENT = {
  id: "client-1",
  full_name: "Test Client",
  email: "client@example.test",
  phone: "07700900000",
  deleted_at: null,
};

const SERVICE = {
  id: "service-1",
  name: "Deep tissue massage",
  price: 60,
  duration_mins: 60,
};

// ─── a faithful TypeScript oracle for the deployed compute_occurrence_dates ───
// The route calls the real PL/pgSQL function; the stub answers with this. It
// walks from WHATEVER first date it is handed, which is what turns the weekday
// assertions below into a real trap detector: hand it `horizon_through_date`
// and it returns a Thursday sequence, exactly as production would.

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function stepDate(iso: string, cadence: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (cadence === "monthly") {
    const month = m; // zero-based m-1, plus one month
    const year = y + Math.floor(month / 12);
    const normalised = month % 12;
    // Postgres clamps a month-end rather than rolling into the next month.
    const day = Math.min(d, daysInMonth(year, normalised));
    return new Date(Date.UTC(year, normalised, day)).toISOString().slice(0, 10);
  }
  const step = cadence === "fortnightly" ? 14 : 7;
  return new Date(Date.UTC(y, m - 1, d + step)).toISOString().slice(0, 10);
}

function computeOccurrenceDates(args: Record<string, unknown>): string[] {
  const first = String(args.p_first_date);
  const cadence = String(args.p_cadence);
  const horizonEnd = String(args.p_horizon_end);
  const endType = String(args.p_end_type);
  const endCount = args.p_end_count as number | null;
  const endDate = args.p_end_date as string | null;

  const effectiveEnd =
    endType === "until_date" && endDate
      ? endDate < horizonEnd
        ? endDate
        : horizonEnd
      : horizonEnd;

  const dates: string[] = [];
  let dt = first;
  while (dt <= effectiveEnd) {
    if (endType === "after_count" && dates.length >= (endCount ?? 0)) break;
    dates.push(dt);
    dt = stepDate(dt, cadence);
    if (dates.length > 500) break; // stub safety net; never reached in practice
  }
  return dates;
}

function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// ─────────────────────────── the admin-client stub ───────────────────────────

interface Filter {
  kind: string;
  column: string;
  value: unknown;
}

interface RecordedSelect {
  table: string;
  projection?: string;
  filters: Filter[];
}

function matches(row: Row, filter: Filter): boolean {
  const cell = row[filter.column];
  switch (filter.kind) {
    case "eq":
      return cell === filter.value;
    case "is":
      return filter.value === null ? cell === null : cell === filter.value;
    case "lt":
      return String(cell) < String(filter.value);
    case "gte":
      return String(cell) >= String(filter.value);
    case "in":
      return (filter.value as unknown[]).includes(cell);
    case "not.in": {
      const list = String(filter.value)
        .replace(/^\(|\)$/g, "")
        .split(",");
      return !list.includes(String(cell));
    }
    default:
      throw new Error(`stub: unsupported filter ${filter.kind}`);
  }
}

function stubAdminClient({
  tables = {} as Record<string, Row[]>,
  selectErrors = {} as Record<string, { message: string }>,
  insertErrors = {} as Record<string, { message: string }>,
  updateErrors = {} as Record<string, { message: string }>,
  rpcError = null as { message: string } | null,
} = {}) {
  const data: Record<string, Row[]> = {
    recurring_booking_templates: [],
    bookings: [],
    clients: [],
    services: [],
    staff_profiles: [],
    audit_logs: [],
    booking_participants: [],
    booking_items: [],
    booking_assignments: [],
    ...tables,
  };

  const selects: RecordedSelect[] = [];
  const inserts: { table: string; payload: Row }[] = [];
  const updates: { table: string; payload: Row; filters: Filter[] }[] = [];
  const deletes: { table: string; filters: Filter[] }[] = [];
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];

  let idCounter = 0;
  const nextId = (table: string) => `${table}-new-${++idCounter}`;

  function selectChain(table: string, projection?: string) {
    const filters: Filter[] = [];
    selects.push({ table, projection, filters });
    let order: { column: string; ascending: boolean } | null = null;
    let limit: number | null = null;

    const resolve = () => {
      if (selectErrors[table]) return { data: null, error: selectErrors[table] };
      let rows = data[table].filter((row) =>
        filters.every((filter) => matches(row, filter))
      );
      if (order) {
        const { column, ascending } = order;
        rows = [...rows].sort((a, b) =>
          String(a[column]) < String(b[column])
            ? ascending
              ? -1
              : 1
            : String(a[column]) > String(b[column])
              ? ascending
                ? 1
                : -1
              : 0
        );
      }
      if (limit !== null) rows = rows.slice(0, limit);
      // Copies, not references: PostgREST hands back JSON, so a later UPDATE
      // must not retroactively rewrite a row the route is still holding.
      return { data: rows.map((row) => ({ ...row })), error: null };
    };

    const chain: Record<string, unknown> = {
      eq: (column: string, value: unknown) => {
        filters.push({ kind: "eq", column, value });
        return chain;
      },
      is: (column: string, value: unknown) => {
        filters.push({ kind: "is", column, value });
        return chain;
      },
      lt: (column: string, value: unknown) => {
        filters.push({ kind: "lt", column, value });
        return chain;
      },
      gte: (column: string, value: unknown) => {
        filters.push({ kind: "gte", column, value });
        return chain;
      },
      in: (column: string, value: unknown) => {
        filters.push({ kind: "in", column, value });
        return chain;
      },
      not: (column: string, operator: string, value: unknown) => {
        filters.push({ kind: `not.${operator}`, column, value });
        return chain;
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        order = { column, ascending: options?.ascending !== false };
        return chain;
      },
      limit: (count: number) => {
        limit = count;
        return chain;
      },
      maybeSingle: () => {
        const result = resolve();
        return Promise.resolve({
          data: result.data ? (result.data[0] ?? null) : null,
          error: result.error,
        });
      },
      single: () => {
        const result = resolve();
        return Promise.resolve({
          data: result.data ? (result.data[0] ?? null) : null,
          error: result.error ?? (result.data?.length ? null : { message: "no rows" }),
        });
      },
      then: (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(resolve()).then(onFulfilled, onRejected),
    };
    return chain;
  }

  function insertChain(table: string, payload: Row) {
    inserts.push({ table, payload });
    const error = insertErrors[table] ?? null;
    const row = { id: nextId(table), ...payload };
    if (!error) data[table].push(row);
    const result = { data: error ? null : row, error };
    const chain: Record<string, unknown> = {
      select: () => chain,
      single: () => Promise.resolve(result),
      maybeSingle: () => Promise.resolve(result),
      then: (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve({ data: null, error }).then(onFulfilled, onRejected),
    };
    return chain;
  }

  function updateChain(table: string, payload: Row) {
    const filters: Filter[] = [];
    const entry = { table, payload, filters };
    updates.push(entry);
    const resolve = () => {
      if (updateErrors[table]) return { data: null, error: updateErrors[table] };
      const rows = data[table].filter((row) =>
        filters.every((filter) => matches(row, filter))
      );
      for (const row of rows) Object.assign(row, payload);
      return { data: rows, error: null };
    };
    const chain: Record<string, unknown> = {
      eq: (column: string, value: unknown) => {
        filters.push({ kind: "eq", column, value });
        return chain;
      },
      is: (column: string, value: unknown) => {
        filters.push({ kind: "is", column, value });
        return chain;
      },
      select: () => chain,
      then: (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(resolve()).then(onFulfilled, onRejected),
    };
    return chain;
  }

  function deleteChain(table: string) {
    const filters: Filter[] = [];
    deletes.push({ table, filters });
    const chain: Record<string, unknown> = {
      eq: (column: string, value: unknown) => {
        filters.push({ kind: "eq", column, value });
        return chain;
      },
      then: (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => {
        data[table] = data[table].filter(
          (row) => !filters.every((filter) => matches(row, filter))
        );
        return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
      },
    };
    return chain;
  }

  const from = vi.fn((table: string) => ({
    select: (projection?: string) => selectChain(table, projection),
    insert: (payload: Row) => insertChain(table, payload),
    update: (payload: Row) => updateChain(table, payload),
    delete: () => deleteChain(table),
  }));

  const rpc = vi.fn((name: string, args: Record<string, unknown>) => {
    rpcCalls.push({ name, args });
    if (rpcError) return Promise.resolve({ data: null, error: rpcError });
    return Promise.resolve({ data: computeOccurrenceDates(args), error: null });
  });

  vi.mocked(createSupabaseAdminClient).mockReturnValue(
    { from, rpc } as unknown as ReturnType<typeof createSupabaseAdminClient>
  );

  return {
    data,
    from,
    rpc,
    selects,
    inserts,
    updates,
    deletes,
    rpcCalls,
    insertsInto: (table: string) =>
      inserts.filter((entry) => entry.table === table).map((entry) => entry.payload),
    createdDates: () =>
      inserts
        .filter((entry) => entry.table === "bookings")
        .map((entry) => String(entry.payload.booking_date)),
  };
}

function post(headers: Record<string, string> = { "X-Cron-Secret": SECRET }) {
  return POST(
    new Request("https://internal.invalid/api/cron/extend-recurring-horizons", {
      method: "POST",
      headers,
    })
  );
}

/** The standard fixture: one due weekly series with its first batch in place. */
function dueWeeklySeries(overrides: Row = {}, occurrences = FIRST_BATCH) {
  return stubAdminClient({
    tables: {
      recurring_booking_templates: [template(overrides)],
      bookings: occurrences.map((date) => occurrence(date)),
      clients: [{ ...CLIENT }],
      services: [{ ...SERVICE }],
    },
  });
}

describe("POST /api/cron/extend-recurring-horizons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    process.env.CRON_SECRET = SECRET;
  });

  it("rejects a request whose X-Cron-Secret does not match", async () => {
    const stub = dueWeeklySeries();

    const res = await post({ "X-Cron-Secret": "wrong" });

    expect(res.status).toBe(401);
    expect(stub.from).not.toHaveBeenCalled();
    expect(stub.inserts).toEqual([]);
  });

  it("rejects a request with no secret header at all", async () => {
    const stub = dueWeeklySeries();

    expect((await post({})).status).toBe(401);
    expect(stub.inserts).toEqual([]);
  });

  it("fails loudly when CRON_SECRET is unset rather than accepting anything", async () => {
    delete process.env.CRON_SECRET;
    const stub = dueWeeklySeries();

    const res = await post({});

    expect(res.status).toBe(500);
    expect(stub.from).not.toHaveBeenCalled();
  });

  it("reports a zero summary when no template is due", async () => {
    const stub = stubAdminClient({ tables: { recurring_booking_templates: [] } });

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      templatesExtended: 0,
      occurrencesCreated: 0,
      skipped: 0,
      failures: [],
    });
    expect(stub.inserts).toEqual([]);
  });

  it("extends a due series, creating only the dates past the last materialised visit", async () => {
    const stub = dueWeeklySeries();

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      templatesExtended: 1,
      occurrencesCreated: 8,
      // 12 computed dates already exist (or are in the past) and are not redone.
      skipped: 12,
      failures: [],
    });
    expect(stub.createdDates()).toEqual([
      "2026-11-27", "2026-12-04", "2026-12-11", "2026-12-18",
      "2026-12-25", "2027-01-01", "2027-01-08", "2027-01-15",
    ]);
    // One participant, one item and one assignment per created booking.
    expect(stub.insertsInto("booking_participants")).toHaveLength(8);
    expect(stub.insertsInto("booking_items")).toHaveLength(8);
    expect(stub.insertsInto("booking_assignments")).toHaveLength(8);
  });

  // ───────────────────────── the horizon-walk regression ─────────────────────
  // These two are the point of this file. A row-counting assertion cannot catch
  // the trap: resuming from `horizon_through_date` produces the SAME NUMBER of
  // bookings, on the wrong days, forever.

  it("walks from the series anchor, never from horizon_through_date", async () => {
    const stub = dueWeeklySeries();

    await post();

    const call = stub.rpcCalls.find(
      (entry) => entry.name === "compute_occurrence_dates"
    );
    expect(call).toBeDefined();
    expect(call?.args.p_first_date).toBe(ANCHOR);
    // The stored horizon sits six days past the last real visit (83 mod 7 = 6),
    // so handing it in as the first date shifts every future visit a weekday
    // early — silently, because the dates genuinely differ from the ones the
    // duplicate check knows about.
    expect(call?.args.p_first_date).not.toBe(STORED_HORIZON);
    expect(call?.args.p_horizon_end).toBe(NEW_HORIZON);
  });

  it("keeps every extended weekly visit on the anchor's weekday", async () => {
    const stub = dueWeeklySeries();

    await post();

    const anchorWeekday = weekdayOf(ANCHOR); // Friday
    const created = stub.createdDates();
    expect(created.length).toBeGreaterThan(0);
    for (const date of created) {
      expect({ date, weekday: weekdayOf(date) }).toEqual({
        date,
        weekday: anchorWeekday,
      });
    }
  });

  it("keeps every extended monthly visit on the anchor's day of month", async () => {
    const monthlyAnchor = "2026-09-04";
    const stub = stubAdminClient({
      tables: {
        recurring_booking_templates: [
          template({ cadence: "monthly", horizon_through_date: STORED_HORIZON }),
        ],
        bookings: ["2026-09-04", "2026-10-04", "2026-11-04"].map((date) =>
          occurrence(date)
        ),
        clients: [{ ...CLIENT }],
        services: [{ ...SERVICE }],
      },
    });

    await post();

    const anchorDay = monthlyAnchor.slice(8, 10);
    const created = stub.createdDates();
    expect(created).toEqual(["2026-12-04", "2027-01-04"]);
    for (const date of created) {
      expect(date.slice(8, 10)).toBe(anchorDay);
    }
  });

  // ───────────────────────────── end conditions ──────────────────────────────

  it("creates nothing once an after_count series has had all its visits", async () => {
    const fortnightly = [
      "2026-09-04", "2026-09-18", "2026-10-02",
      "2026-10-16", "2026-10-30", "2026-11-13",
    ];
    const stub = dueWeeklySeries(
      { cadence: "fortnightly", end_type: "after_count", end_count: 6 },
      fortnightly
    );

    const res = await post();

    // Walking from the anchor with the series TOTAL count is what makes this
    // structural: compute can never return a 7th date. Resuming from the stored
    // horizon would have handed back six BRAND NEW dates and doubled the series.
    expect(await res.json()).toEqual({
      templatesExtended: 1,
      occurrencesCreated: 0,
      skipped: 6,
      failures: [],
    });
    expect(stub.insertsInto("bookings")).toEqual([]);
    // Nothing happened, so no audit row claims something did.
    expect(stub.insertsInto("audit_logs")).toEqual([]);
    // ...but the horizon still moves, so the reconciliation point stays honest.
    expect(stub.data.recurring_booking_templates[0].horizon_through_date).toBe(
      NEW_HORIZON
    );
  });

  it("creates nothing once an until_date series is past its end date", async () => {
    const stub = dueWeeklySeries({
      end_type: "until_date",
      end_date: "2026-11-20",
    });

    const res = await post();

    expect(await res.json()).toEqual({
      templatesExtended: 1,
      occurrencesCreated: 0,
      skipped: 12,
      failures: [],
    });
    expect(stub.insertsInto("bookings")).toEqual([]);
  });

  it("stops an until_date series exactly at its end date", async () => {
    const stub = dueWeeklySeries({
      end_type: "until_date",
      end_date: "2026-12-31",
    });

    await post();

    // 2027-01-01 is a valid weekly occurrence and is inside the new horizon —
    // the end date is what excludes it.
    expect(stub.createdDates()).toEqual([
      "2026-11-27", "2026-12-04", "2026-12-11", "2026-12-18", "2026-12-25",
    ]);
  });

  // ─────────────────────────── template selection ────────────────────────────

  it("ignores a cancelled template entirely", async () => {
    const stub = dueWeeklySeries({ cancelled_at: "2026-10-01T10:00:00.000Z" });

    const res = await post();

    expect(await res.json()).toEqual({
      templatesExtended: 0,
      occurrencesCreated: 0,
      skipped: 0,
      failures: [],
    });
    expect(stub.inserts).toEqual([]);
    expect(stub.updates).toEqual([]);
  });

  it("leaves a template that is already covered to the new horizon alone", async () => {
    const stub = dueWeeklySeries({ horizon_through_date: NEW_HORIZON });

    const res = await post();

    expect(await res.json()).toEqual({
      templatesExtended: 0,
      occurrencesCreated: 0,
      skipped: 0,
      failures: [],
    });
    expect(stub.inserts).toEqual([]);
    expect(stub.rpcCalls).toEqual([]);
  });

  // ──────────────────────────── what gets written ────────────────────────────

  it("writes each occurrence with the series' own identity and a recurring source", async () => {
    const stub = dueWeeklySeries();

    await post();

    const [first] = stub.insertsInto("bookings");
    expect(first).toMatchObject({
      client_id: "client-1",
      recurring_template_id: "tmpl-1",
      booking_source: "recurring",
      booking_date: "2026-11-27",
      start_time: "09:00:00",
      end_time: "10:00:00",
      total_duration_mins: 60,
      total_price: 60,
      amount_due: 60,
      status: "pending",
      assignment_status: "unassigned",
      consent_acknowledged: true,
      service_address_line1: "1 Test Street",
      service_postcode: "LU1 1AA",
      contact_full_name: "Test Client",
      contact_phone: "07700900000",
    });
    expect(stub.insertsInto("booking_participants")[0]).toMatchObject({
      participant_gender: "female",
      required_therapist_gender: "female",
      is_main_contact: true,
    });
    expect(stub.insertsInto("booking_items")[0]).toMatchObject({
      service_id: "service-1",
      service_name_snapshot: "Deep tissue massage",
      service_price_snapshot: 60,
      service_duration_snapshot: 60,
    });
  });

  it("advances horizon_through_date and records one audit row per extension", async () => {
    const stub = dueWeeklySeries();

    await post();

    expect(stub.data.recurring_booking_templates[0].horizon_through_date).toBe(
      NEW_HORIZON
    );
    const audits = stub.insertsInto("audit_logs");
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action_type: "recurring_series_extended",
      target_type: "recurring_booking_templates",
      target_id: "tmpl-1",
    });
    expect(audits[0].after_state).toMatchObject({
      series_anchor_date: ANCHOR,
      occurrence_count: 8,
      first_new_date: "2026-11-27",
      last_new_date: "2027-01-15",
      previous_horizon_through: STORED_HORIZON,
      horizon_through: NEW_HORIZON,
      automated: true,
    });
  });

  it("does not recreate an occurrence the client already cancelled", async () => {
    const stub = dueWeeklySeries({}, [...FIRST_BATCH, "2026-11-27"]);
    // Mark the extra visit cancelled — it exists, so the walk must step over it.
    const cancelled = stub.data.bookings.find(
      (row) => row.booking_date === "2026-11-27"
    );
    if (cancelled) cancelled.status = "cancelled";

    await post();

    expect(stub.createdDates()).not.toContain("2026-11-27");
    expect(stub.createdDates()[0]).toBe("2026-12-04");
  });

  it("skips a date the client already holds another booking on at that time", async () => {
    const stub = dueWeeklySeries();
    stub.data.bookings.push({
      id: "one-off",
      client_id: "client-1",
      recurring_template_id: null,
      booking_date: "2026-12-04",
      start_time: "09:00:00",
      status: "confirmed",
      deleted_at: null,
      consent_acknowledged: true,
    });

    const res = await post();

    expect(stub.createdDates()).not.toContain("2026-12-04");
    expect(await res.json()).toMatchObject({
      occurrencesCreated: 7,
      skipped: 13,
    });
  });

  // ─────────────────────────── therapist pre-assignment ──────────────────────

  it("pre-assigns the bound therapist when they are still active and eligible", async () => {
    const stub = stubAdminClient({
      tables: {
        recurring_booking_templates: [template({ bound_therapist_id: "staff-1" })],
        bookings: FIRST_BATCH.map((date) => occurrence(date)),
        clients: [{ ...CLIENT }],
        services: [{ ...SERVICE }],
        staff_profiles: [
          { id: "staff-1", active: true, can_take_bookings: true, gender: "female" },
        ],
      },
    });

    await post();

    expect(stub.insertsInto("bookings")[0]).toMatchObject({
      assignment_status: "fully_assigned",
    });
    expect(stub.insertsInto("booking_assignments")[0]).toMatchObject({
      assigned_staff_id: "staff-1",
      status: "assigned",
    });
  });

  it("creates the visits unassigned when the bound therapist has gone inactive", async () => {
    const stub = stubAdminClient({
      tables: {
        recurring_booking_templates: [template({ bound_therapist_id: "staff-1" })],
        bookings: FIRST_BATCH.map((date) => occurrence(date)),
        clients: [{ ...CLIENT }],
        services: [{ ...SERVICE }],
        staff_profiles: [
          { id: "staff-1", active: false, can_take_bookings: true, gender: "female" },
        ],
      },
    });

    const res = await post();

    // The documented degradation: the visits still get created, just unassigned.
    expect(await res.json()).toMatchObject({ occurrencesCreated: 8 });
    expect(stub.insertsInto("bookings")[0]).toMatchObject({
      assignment_status: "unassigned",
    });
    expect(stub.insertsInto("booking_assignments")[0]).toMatchObject({
      assigned_staff_id: null,
      status: "unassigned",
    });
  });

  it("creates the visits unassigned when the bound therapist no longer matches the required gender", async () => {
    const stub = stubAdminClient({
      tables: {
        recurring_booking_templates: [template({ bound_therapist_id: "staff-1" })],
        bookings: FIRST_BATCH.map((date) => occurrence(date)),
        clients: [{ ...CLIENT }],
        services: [{ ...SERVICE }],
        staff_profiles: [
          { id: "staff-1", active: true, can_take_bookings: true, gender: "male" },
        ],
      },
    });

    await post();

    expect(stub.insertsInto("booking_assignments")[0]).toMatchObject({
      assigned_staff_id: null,
      status: "unassigned",
    });
  });

  // ───────────────────────────── failure surfaces ────────────────────────────

  it("undoes a half-written occurrence when a child insert fails", async () => {
    const stub = stubAdminClient({
      tables: {
        recurring_booking_templates: [template()],
        bookings: FIRST_BATCH.map((date) => occurrence(date)),
        clients: [{ ...CLIENT }],
        services: [{ ...SERVICE }],
      },
      insertErrors: { booking_items: { message: "permission denied" } },
    });

    const res = await post();
    const body = await res.json();

    // A booking with no item reads as a real appointment with no service on it.
    expect(body.occurrencesCreated).toBe(0);
    expect(body.failures.length).toBeGreaterThan(0);
    expect(body.failures[0]).toContain("booking item insert failed");
    expect(stub.deletes.map((entry) => entry.table)).toContain("bookings");
    // Nothing survives in the bookings table beyond the original batch.
    expect(stub.data.bookings).toHaveLength(FIRST_BATCH.length);
  });

  it("reports a series with no materialised occurrences instead of extending it", async () => {
    const stub = stubAdminClient({
      tables: {
        recurring_booking_templates: [template()],
        bookings: [],
        clients: [{ ...CLIENT }],
        services: [{ ...SERVICE }],
      },
    });

    const res = await post();
    const body = await res.json();

    // There is no anchor to walk from, so guessing one is the one thing this
    // route must never do.
    expect(body.templatesExtended).toBe(0);
    expect(body.occurrencesCreated).toBe(0);
    expect(body.failures[0]).toContain("no materialised occurrences");
    expect(stub.rpcCalls).toEqual([]);
    expect(stub.updates).toEqual([]);
  });

  it("reports a failed occurrence computation rather than a healthy-looking zero", async () => {
    const stub = stubAdminClient({
      tables: {
        recurring_booking_templates: [template()],
        bookings: FIRST_BATCH.map((date) => occurrence(date)),
        clients: [{ ...CLIENT }],
        services: [{ ...SERVICE }],
      },
      rpcError: { message: "function does not exist" },
    });

    const res = await post();
    const body = await res.json();

    // C-04a's cron answered 200 { sent: 0 } for a day while every write was a
    // 42501. A summary of zeroes with an empty `failures` is that same lie.
    expect(body).toMatchObject({ templatesExtended: 0, occurrencesCreated: 0 });
    expect(body.failures[0]).toContain("occurrence computation failed");
    expect(stub.inserts).toEqual([]);
  });

  it("surfaces a template query failure as a 500 without writing anything", async () => {
    const stub = stubAdminClient({
      tables: { recurring_booking_templates: [template()] },
      selectErrors: { recurring_booking_templates: { message: "boom" } },
    });

    const res = await post();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "boom",
      templatesExtended: 0,
      occurrencesCreated: 0,
      skipped: 0,
      failures: [],
    });
    expect(stub.inserts).toEqual([]);
  });

  it("reports a client whose record can no longer support a booking", async () => {
    const stub = stubAdminClient({
      tables: {
        recurring_booking_templates: [template()],
        bookings: FIRST_BATCH.map((date) => occurrence(date)),
        clients: [{ ...CLIENT, phone: null }],
        services: [{ ...SERVICE }],
      },
    });

    const res = await post();
    const body = await res.json();

    // `bookings.contact_phone` is NOT NULL — without this guard every night is
    // eight bare 23502s and no visits.
    expect(body.occurrencesCreated).toBe(0);
    expect(body.failures[0]).toContain("no phone number");
    expect(stub.insertsInto("bookings")).toEqual([]);
  });
});
