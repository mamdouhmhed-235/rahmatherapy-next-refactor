// C-16 Phase C Step 8 — /admin/clients: one filter resolution, one page.
//
// The point of this spec is that the "Showing X–Y of Z" readout and the rows
// beneath it cannot describe different selections. The stand-in Postgres below
// HONOURS the predicates the code sends it (`is`, `eq`, `in`, and the `ilike` /
// `eq` / `id.in` arms of `.or(...)`) and replays the recorded `.order()`s, so a
// predicate that stops reaching SQL changes the rows this spec sees — which is
// what stops the assertions from passing vacuously.
import { describe, it, expect, beforeEach, vi } from "vitest";

const cacheHarness = await vi.hoisted(async () => {
  const { createFakeUnstableCache } = await import(
    "@/lib/cache/__tests__/fake-unstable-cache"
  );
  return createFakeUnstableCache();
});

vi.mock("next/cache", () => ({
  unstable_cache: cacheHarness.unstable_cache,
}));

const createSupabaseAdminClient = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClient(),
}));

const {
  applyClientPredicates,
  buildClientPredicatePlan,
  getClientsListPage,
  resolveClientBookingMatches,
} = await import("../clients-list-data");
type ClientListContext = import("../clients-list-data").ClientListContext;
const { LIST_PAGE_SIZE } = await import("@/lib/pagination");

// ---------------------------------------------------------------------------
// A stand-in Postgres, small enough to read and faithful enough to have teeth
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
interface Recorded {
  method: string;
  args: unknown[];
}
interface Query {
  table: string;
  select: string;
  options?: { count?: string; head?: boolean };
  calls: Recorded[];
}

const CHAIN_METHODS = [
  "eq",
  "neq",
  "in",
  "is",
  "or",
  "not",
  "gte",
  "gt",
  "lte",
  "lt",
  "ilike",
  "order",
  "limit",
  "range",
  "returns",
  "overrideTypes",
] as const;

function createFakeDb(
  resolve: (query: Query) => {
    data?: unknown;
    count?: number | null;
    error?: unknown;
  }
) {
  const queries: Query[] = [];
  const client = {
    from(table: string) {
      const query: Query = { table, select: "", calls: [] };
      queries.push(query);
      const chain: Record<string, unknown> = {};
      for (const method of CHAIN_METHODS) {
        chain[method] = (...args: unknown[]) => {
          query.calls.push({ method, args });
          return chain;
        };
      }
      chain.select = (
        select: string,
        options?: { count?: string; head?: boolean }
      ) => {
        query.select = select;
        query.options = options;
        return chain;
      };
      chain.then = (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(resolve(query)).then(onFulfilled, onRejected);
      return chain;
    },
  };
  return { client, queries };
}

/** `col.ilike."%needle%"` / `col.eq."value"` / `id.in.(a,b)` — the arms this
 *  module actually emits inside `.or(...)`. */
function matchesOrArm(row: Row, arm: string): boolean {
  const ilike = /^([a-z_0-9]+)\.ilike\.(.*)$/.exec(arm);
  if (ilike) {
    const value = row[ilike[1]];
    if (typeof value !== "string") return false;
    const pattern = ilike[2].replace(/^"|"$/g, "").replace(/^%|%$/g, "");
    return value.toLowerCase().includes(pattern.toLowerCase());
  }
  const eq = /^([a-z_0-9]+)\.eq\.(.*)$/.exec(arm);
  if (eq) return row[eq[1]] === eq[2].replace(/^"|"$/g, "");
  const inArm = /^([a-z_0-9]+)\.in\.\((.*)\)$/.exec(arm);
  if (inArm) {
    const values = inArm[2] ? inArm[2].split(",") : [];
    return values.includes(String(row[inArm[1]]));
  }
  throw new Error(`unsupported or() arm in fixture DB: ${arm}`);
}

/** Splits an `.or(...)` string on its top-level commas. */
function splitOrArms(filters: string): string[] {
  const arms: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (const char of filters) {
    if (char === '"') quoted = !quoted;
    if (!quoted && char === "(") depth += 1;
    if (!quoted && char === ")") depth -= 1;
    if (char === "," && depth === 0 && !quoted) {
      arms.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) arms.push(current);
  return arms;
}

function applyRecorded(rows: Row[], calls: Recorded[]): Row[] {
  let result = [...rows];
  for (const call of calls) {
    if (call.method === "is") {
      const [column, value] = call.args as [string, null];
      if (value !== null) throw new Error("only is(col, null) is modelled");
      result = result.filter(
        (row) => row[column] === null || row[column] === undefined
      );
    } else if (call.method === "in") {
      const [column, values] = call.args as [string, string[]];
      result = result.filter((row) => values.includes(String(row[column])));
    } else if (call.method === "eq") {
      const [column, value] = call.args as [string, unknown];
      result = result.filter((row) => row[column] === value);
    } else if (call.method === "or") {
      const arms = splitOrArms(call.args[0] as string);
      result = result.filter((row) => arms.some((arm) => matchesOrArm(row, arm)));
    }
  }
  // PostgREST's first `.order()` is the primary key of the sort, so replay the
  // recorded orders in reverse over a stable sort.
  const orders = calls.filter((call) => call.method === "order").reverse();
  for (const order of orders) {
    const [column, options] = order.args as [
      string,
      { ascending?: boolean } | undefined,
    ];
    const ascending = options?.ascending ?? true;
    result = [...result].sort((a, b) => {
      const left = String(a[column] ?? "");
      const right = String(b[column] ?? "");
      return ascending ? left.localeCompare(right) : right.localeCompare(left);
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TODAY = "2026-08-03";

/** 10 live clients + 2 soft-deleted, alphabetical by construction. */
const CLIENTS: Row[] = [
  { id: "c01", full_name: "Adam Ali", created_at: "2026-07-20T09:00:00.000Z", deleted_at: null, client_source: "website", postcode: "LU1 1AA", address: "1 Hill Road", phone: "07000000001", email: "adam@example.test" },
  { id: "c02", full_name: "Bilal Bakr", created_at: "2024-01-05T09:00:00.000Z", deleted_at: null, client_source: "phone", postcode: "LU2 2BB", address: "2 Hill Road", phone: "07000000002", email: "bilal@example.test" },
  { id: "c03", full_name: "Cara Chen", created_at: "2024-02-05T09:00:00.000Z", deleted_at: null, client_source: "referral", postcode: "MK1 1CC", address: "3 Vale Street", phone: "07000000003", email: "cara@trio.example.test" },
  { id: "c04", full_name: "Dania Dar", created_at: "2024-03-05T09:00:00.000Z", deleted_at: null, client_source: "website", postcode: "MK2 2DD", address: "4 Vale Street", phone: "07000000004", email: "dania@trio.example.test" },
  { id: "c05", full_name: "Emre Eren", created_at: "2024-04-05T09:00:00.000Z", deleted_at: null, client_source: "phone", postcode: "LU3 3EE", address: "5 Hill Road", phone: "07000000005", email: "emre@trio.example.test" },
  { id: "c06", full_name: "Farah Faris", created_at: "2024-05-05T09:00:00.000Z", deleted_at: null, client_source: "website", postcode: "LU4 4FF", address: "6 Hill Road", phone: "07000000006", email: "farah@example.test" },
  { id: "c07", full_name: "Gita Gomes", created_at: "2024-06-05T09:00:00.000Z", deleted_at: null, client_source: "phone", postcode: "MK3 3GG", address: "7 Vale Street", phone: "07000000007", email: "gita@example.test" },
  { id: "c08", full_name: "Hana Haddad", created_at: "2024-07-05T09:00:00.000Z", deleted_at: null, client_source: "website", postcode: "LU5 5HH", address: "8 Hill Road", phone: "07000000008", email: "hana@example.test" },
  { id: "c09", full_name: "Idris Iqbal", created_at: "2024-08-05T09:00:00.000Z", deleted_at: null, client_source: "phone", postcode: "MK4 4II", address: "9 Vale Street", phone: "07000000009", email: "idris@example.test" },
  { id: "c10", full_name: "Jamil Jama", created_at: "2024-09-05T09:00:00.000Z", deleted_at: null, client_source: "website", postcode: "LU6 6JJ", address: "10 Hill Road", phone: "07000000010", email: "jamil@example.test" },
  { id: "c11", full_name: "Karim Khan", created_at: "2024-10-05T09:00:00.000Z", deleted_at: "2026-06-01T09:00:00.000Z", client_source: "phone", postcode: "LU7 7KK", address: "11 Hill Road", phone: "07000000011", email: "karim@example.test" },
  { id: "c12", full_name: "Lina Lodhi", created_at: "2024-11-05T09:00:00.000Z", deleted_at: "2026-06-02T09:00:00.000Z", client_source: "website", postcode: "LU8 8LL", address: "12 Hill Road", phone: "07000000012", email: "lina@example.test" },
];

/**
 * Bookings chosen so the derived values differ per client:
 *  - c02 has 3 completed visits and the only outstanding balance;
 *  - c03/c04/c05 have one completed visit each, on distinct ordered dates;
 *  - c06 last visited well over 6 months ago and has nothing booked (lapsed);
 *  - c01 has never visited and joined within 30 days (new);
 *  - c03's one booking came in through a source its client row does not carry,
 *    which is the only way the source filter's booking arm can be observed.
 */
const BOOKINGS: Row[] = [
  { id: "b01", client_id: "c01", booking_date: "2026-09-10", start_time: "10:00", status: "confirmed", total_price: 60, amount_due: 60, amount_paid: 60, booking_source: "website", service_city: "Luton", service_postcode: "LU1 1AA", booking_items: [] },
  { id: "b02", client_id: "c02", booking_date: "2026-05-01", start_time: "10:00", status: "completed", total_price: 60, amount_due: 60, amount_paid: 20, booking_source: "phone", service_city: "Luton", service_postcode: "LU2 2BB", booking_items: [] },
  { id: "b03", client_id: "c02", booking_date: "2026-06-01", start_time: "10:00", status: "completed", total_price: 60, amount_due: 60, amount_paid: 60, booking_source: "phone", service_city: "Luton", service_postcode: "LU2 2BB", booking_items: [] },
  { id: "b04", client_id: "c02", booking_date: "2026-07-01", start_time: "10:00", status: "completed", total_price: 60, amount_due: 60, amount_paid: 60, booking_source: "phone", service_city: "Luton", service_postcode: "LU2 2BB", booking_items: [] },
  { id: "b05", client_id: "c03", booking_date: "2026-07-20", start_time: "10:00", status: "completed", total_price: 60, amount_due: 60, amount_paid: 60, booking_source: "instagram", service_city: "Milton Keynes", service_postcode: "MK1 1CC", booking_items: [] },
  { id: "b06", client_id: "c04", booking_date: "2026-07-25", start_time: "10:00", status: "completed", total_price: 60, amount_due: 60, amount_paid: 60, booking_source: "website", service_city: "Milton Keynes", service_postcode: "MK2 2DD", booking_items: [] },
  { id: "b07", client_id: "c05", booking_date: "2026-07-30", start_time: "10:00", status: "completed", total_price: 60, amount_due: 60, amount_paid: 60, booking_source: "phone", service_city: "Luton", service_postcode: "LU3 3EE", booking_items: [] },
  { id: "b08", client_id: "c06", booking_date: "2025-01-05", start_time: "10:00", status: "completed", total_price: 60, amount_due: 60, amount_paid: 60, booking_source: "website", service_city: "Luton", service_postcode: "LU4 4FF", booking_items: [] },
];

let db: ReturnType<typeof createFakeDb>;

function context(overrides: Partial<ClientListContext> = {}): ClientListContext {
  return {
    canViewContactDetails: true,
    includeDeleted: false,
    sort: "name",
    today: TODAY,
    ...overrides,
  };
}

const CANDIDATE_SELECT = "id, full_name, created_at";

function candidateQueries(): Query[] {
  return db.queries.filter(
    (query) => query.table === "clients" && query.select === CANDIDATE_SELECT
  );
}

function candidateQuery(): Query {
  const found = candidateQueries()[0];
  if (!found) throw new Error("no candidate query was issued");
  return found;
}

function ids(rows: { client: { id: string } }[]): string[] {
  return rows.map((row) => row.client.id);
}

beforeEach(() => {
  cacheHarness.clear();
  createSupabaseAdminClient.mockReset();
  db = createFakeDb((query) => {
    const source = query.table === "clients" ? CLIENTS : BOOKINGS;
    const rows = applyRecorded(source, query.calls);
    if (query.options?.head) return { data: null, count: rows.length, error: null };
    return { data: rows, count: rows.length, error: null };
  });
  createSupabaseAdminClient.mockImplementation(() => db.client);
});

describe("the deleted-clients toggle reaches SQL", () => {
  it("scopes the candidate query, and the total and the rows agree with it", async () => {
    const result = await getClientsListPage({ context: context(), pageSize: 25 });

    expect(
      candidateQuery().calls.some(
        (call) => call.method === "is" && call.args[0] === "deleted_at"
      )
    ).toBe(true);
    expect(result.total).toBe(10);
    expect(result.rows).toHaveLength(10);
    expect(result.rows.every((row) => !row.client.deleted_at)).toBe(true);
    expect(result.deletedCount).toBe(2);
  });

  it("drops the predicate — and admits the deleted rows — with the toggle on", async () => {
    const result = await getClientsListPage({
      context: context({ includeDeleted: true }),
      pageSize: 25,
    });

    expect(
      candidateQuery().calls.some(
        (call) => call.method === "is" && call.args[0] === "deleted_at"
      )
    ).toBe(false);
    expect(result.total).toBe(12);
    expect(ids(result.rows)).toContain("c11");
  });

  it("counts the deleted through the same SQL scope as the head-counts", async () => {
    await getClientsListPage({ context: context(), pageSize: 25 });

    const headCounts = db.queries.filter(
      (query) => query.table === "clients" && query.options?.head === true
    );
    expect(headCounts).toHaveLength(2);
    // Exactly one of the pair carries the deleted scope: all-vs-live.
    expect(
      headCounts.filter((query) =>
        query.calls.some(
          (call) => call.method === "is" && call.args[0] === "deleted_at"
        )
      )
    ).toHaveLength(1);
  });
});

describe("the total and the rows come from ONE resolution", () => {
  it("sends exactly the plan the shared builder produced — no second predicate path", async () => {
    const ctx = context({ q: "ali", source: "instagram" });
    await getClientsListPage({ context: ctx, pageSize: 25 });

    // Rebuild the resolution the way the helper does, replay it onto a
    // recorder, and compare against what the real query actually received.
    const matches = await resolveClientBookingMatches(ctx);
    const replayed: Recorded[] = [];
    const recorder = {
      is: (column: string, value: null) => {
        replayed.push({ method: "is", args: [column, value] });
        return recorder;
      },
      in: (column: string, values: readonly string[]) => {
        replayed.push({ method: "in", args: [column, values] });
        return recorder;
      },
      or: (filters: string) => {
        replayed.push({ method: "or", args: [filters] });
        return recorder;
      },
    };
    applyClientPredicates(recorder, buildClientPredicatePlan(ctx, matches).steps);

    const sent = candidateQuery().calls.filter((call) =>
      ["is", "in", "or"].includes(call.method)
    );
    expect(sent).toEqual(replayed);
    expect(sent.length).toBeGreaterThan(1);
  });

  it("slices the window out of the very array it counted", async () => {
    const result = await getClientsListPage({
      context: context(),
      page: "2",
      pageSize: 4,
    });

    expect(result.total).toBe(10);
    expect(result.pageCount).toBe(3);
    expect(result.page).toBe(2);
    expect(ids(result.rows)).toEqual(["c05", "c06", "c07", "c08"]);
  });

  it("computes the stats over the deleted-scope, not over the filtered result", async () => {
    const unfiltered = await getClientsListPage({
      context: context(),
      pageSize: 25,
    });
    const searched = await getClientsListPage({
      context: context({ q: "Bilal" }),
      pageSize: 25,
    });

    expect(searched.total).toBe(1);
    expect(searched.totalInScope).toBe(10);
    expect(searched.stats).toEqual(unfiltered.stats);
    // c01 new; c02–c05 returning; c06–c10 lapsed.
    expect(unfiltered.stats).toEqual({
      active: 5,
      newThisMonth: 1,
      returning: 4,
      atRiskLapsed: 5,
    });
  });
});

describe("search composes with paging", () => {
  it("a search narrowing to 3 is ONE page, not an empty page 2", async () => {
    const result = await getClientsListPage({
      context: context({ q: "trio" }),
      page: "2",
      pageSize: LIST_PAGE_SIZE,
    });

    expect(result.total).toBe(3);
    expect(result.pageCount).toBe(1);
    expect(result.page).toBe(1);
    expect(ids(result.rows)).toEqual(["c03", "c04", "c05"]);
  });

  it("does not reach phone or email without the contact permission", async () => {
    const result = await getClientsListPage({
      context: context({ q: "trio", canViewContactDetails: false }),
      pageSize: LIST_PAGE_SIZE,
    });

    expect(result.total).toBe(0);
    expect(result.rows).toEqual([]);
  });

  it("matches a client through its own field OR one of its bookings", async () => {
    const bySource = await getClientsListPage({
      context: context({ source: "instagram" }),
      pageSize: 25,
    });
    // No client row carries "instagram" — only c03's booking does.
    expect(ids(bySource.rows)).toEqual(["c03"]);

    const byLocation = await getClientsListPage({
      context: context({ location: "Vale Street" }),
      pageSize: 25,
    });
    expect(ids(byLocation.rows)).toEqual(["c03", "c04", "c07", "c09"]);
  });
});

describe("page clamping", () => {
  it("clamps a stale ?page=99 to the last page", async () => {
    const result = await getClientsListPage({
      context: context(),
      page: "99",
      pageSize: 4,
    });

    expect(result.page).toBe(3);
    expect(ids(result.rows)).toEqual(["c09", "c10"]);
  });

  it("clamps junk, zero and absent to page 1", async () => {
    for (const raw of ["0", "-4", "abc", undefined]) {
      const result = await getClientsListPage({
        context: context(),
        page: raw,
        pageSize: 4,
      });
      expect(result.page).toBe(1);
    }
  });
});

describe("derived filters and the derived sort survive the page boundary", () => {
  it("selects by lifecycle over the whole set before slicing", async () => {
    const result = await getClientsListPage({
      context: context({ lifecycle: "returning" }),
      pageSize: 25,
    });

    expect(ids(result.rows)).toEqual(["c02", "c03", "c04", "c05"]);
    expect(result.total).toBe(4);
  });

  it("selects by payment standing from the summed balance", async () => {
    const outstanding = await getClientsListPage({
      context: context({ payment: "outstanding" }),
      pageSize: 25,
    });
    expect(ids(outstanding.rows)).toEqual(["c02"]);

    const good = await getClientsListPage({
      context: context({ payment: "in_good_standing" }),
      pageSize: 25,
    });
    expect(good.total).toBe(9);
    expect(ids(good.rows)).not.toContain("c02");
  });

  it("orders by last visit GLOBALLY — page 2 continues page 1's order", async () => {
    const first = await getClientsListPage({
      context: context({ sort: "last_visit" }),
      page: "1",
      pageSize: 2,
    });
    const second = await getClientsListPage({
      context: context({ sort: "last_visit" }),
      page: "2",
      pageSize: 2,
    });

    // Most recent completed visit first: c05 (07-30), c04 (07-25),
    // c03 (07-20), c02 (07-01), then c06 (2025-01-05), then the visitless.
    expect(ids(first.rows)).toEqual(["c05", "c04"]);
    expect(ids(second.rows)).toEqual(["c03", "c02"]);
  });

  it("carries each row's counts from the same reducer that selected it", async () => {
    const result = await getClientsListPage({
      context: context({ lifecycle: "returning" }),
      pageSize: 25,
    });

    const row = result.rows[0];
    expect(row.client.id).toBe("c02");
    expect(row.completedCount).toBe(3);
    expect(row.upcomingCount).toBe(0);
    expect(row.lastCompleted?.booking_date).toBe("2026-07-01");
    expect(row.nextUpcoming).toBeNull();
  });
});

describe("the reads are bounded", () => {
  it("asks for only the window's clients' bookings, never the whole table", async () => {
    await getClientsListPage({ context: context(), page: "1", pageSize: 3 });

    const pageBookingQuery = db.queries.find(
      (query) =>
        query.table === "bookings" && query.select.includes("booking_items(")
    );
    expect(pageBookingQuery).toBeDefined();
    const idFilter = pageBookingQuery!.calls.find(
      (call) => call.method === "in" && call.args[0] === "client_id"
    );
    expect(idFilter).toBeDefined();
    expect(idFilter!.args[1]).toEqual(["c01", "c02", "c03"]);
  });

  it("reads the summary through a projection with no joins and no contact columns", async () => {
    await getClientsListPage({ context: context(), pageSize: 25 });

    const summaryQuery = db.queries.find(
      (query) =>
        query.table === "bookings" && query.select.startsWith("client_id, booking_date")
    );
    expect(summaryQuery).toBeDefined();
    expect(summaryQuery!.select).not.toContain("(");
    expect(summaryQuery!.select).not.toContain("contact_");
  });

  it("shares one candidate query between the list and the stats when nothing narrows", async () => {
    await getClientsListPage({ context: context(), pageSize: 25 });
    expect(candidateQueries()).toHaveLength(1);
  });

  it("issues a second, scope-only candidate query once a filter narrows the list", async () => {
    await getClientsListPage({ context: context({ q: "Bilal" }), pageSize: 25 });
    expect(candidateQueries()).toHaveLength(2);
  });
});
