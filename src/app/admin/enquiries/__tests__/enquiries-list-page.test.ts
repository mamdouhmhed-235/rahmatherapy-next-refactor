// C-16 Phase C Step 8 — /admin/enquiries: the sort had to move into the query.
//
// THE TRAP THIS SPEC EXISTS FOR: bounding the query while the sort stays a JS
// pass over the fetched rows sorts each page WITHIN ITSELF. Page 2 of "oldest
// first" would then be the second newest-first block, re-ordered locally — and
// every row on it still looks plausible. A spec that only checked the order
// within one page would pass on that broken code, so the assertions below are
// about which rows land on page 2 at all.
//
// The stand-in Postgres honours the recorded `.order()`s, `.range()` and the
// filters, so the rows this spec sees come from the query the code actually
// built, not from a fixture handed back regardless.
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

const { getEnquiriesListPage, getEnquiryOverviewCounts } = await import(
  "../enquiries-data"
);

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

function matchesOrArm(row: Row, arm: string): boolean {
  const ilike = /^([a-z_0-9]+)\.ilike\.(.*)$/.exec(arm);
  if (!ilike) throw new Error(`unsupported or() arm in fixture DB: ${arm}`);
  const value = row[ilike[1]];
  if (typeof value !== "string") return false;
  const pattern = ilike[2].replace(/^"|"$/g, "").replace(/^%|%$/g, "");
  return value.toLowerCase().includes(pattern.toLowerCase());
}

function applyRecorded(rows: Row[], calls: Recorded[]): Row[] {
  let result = [...rows];
  for (const call of calls) {
    if (call.method === "eq") {
      const [column, value] = call.args as [string, unknown];
      result = result.filter((row) => row[column] === value);
    } else if (call.method === "is") {
      const [column] = call.args as [string, null];
      result = result.filter(
        (row) => row[column] === null || row[column] === undefined
      );
    } else if (call.method === "not") {
      const [column, operator] = call.args as [string, string, unknown];
      if (operator !== "is") throw new Error("only not(col, 'is', null) is modelled");
      result = result.filter(
        (row) => row[column] !== null && row[column] !== undefined
      );
    } else if (call.method === "gte") {
      const [column, value] = call.args as [string, string];
      result = result.filter((row) => String(row[column]) >= value);
    } else if (call.method === "lte") {
      const [column, value] = call.args as [string, string];
      result = result.filter((row) => String(row[column]) <= value);
    } else if (call.method === "or") {
      const arms = (call.args[0] as string).split(",");
      result = result.filter((row) => arms.some((arm) => matchesOrArm(row, arm)));
    }
  }

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

  const range = calls.find((call) => call.method === "range");
  if (range) {
    const [from, to] = range.args as [number, number];
    return result.slice(from, to + 1);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Fixtures — 30 enquiries, one per day, names in the REVERSE of date order so a
// name sort and a date sort can never be mistaken for one another.
// ---------------------------------------------------------------------------

const ENQUIRIES: Row[] = Array.from({ length: 30 }, (_, index) => {
  const day = String(index + 1).padStart(2, "0");
  const reverse = String(30 - index).padStart(2, "0");
  return {
    id: `e${day}`,
    full_name: `Enquirer ${reverse}`,
    phone: `0700000${day}`,
    email: `person${day}@example.test`,
    source: index % 2 === 0 ? "website" : "phone",
    status: index < 10 ? "new" : index < 20 ? "contacted" : "closed",
    // Exactly three carry this, so a search can narrow to three.
    service_interest: index < 3 ? "Deep tissue trio" : null,
    notes: null,
    client_id: null,
    converted_booking_id: index % 5 === 0 ? `b${day}` : null,
    assigned_staff_id: null,
    created_at: `2026-03-${day}T09:00:00.000Z`,
    updated_at: `2026-04-${reverse}T09:00:00.000Z`,
  };
});

let db: ReturnType<typeof createFakeDb>;

function enquiryQueries(): Query[] {
  return db.queries.filter((query) => query.table === "enquiries");
}

function rowQuery(): Query {
  const found = enquiryQueries().find((query) => !query.options?.head);
  if (!found) throw new Error("no enquiries row query was issued");
  return found;
}

function countQuery(): Query {
  const found = enquiryQueries().find((query) => query.options?.head === true);
  if (!found) throw new Error("no enquiries count query was issued");
  return found;
}

function predicateCalls(query: Query): Recorded[] {
  return query.calls.filter((call) =>
    ["eq", "is", "not", "gte", "lte", "or"].includes(call.method)
  );
}

beforeEach(() => {
  cacheHarness.clear();
  createSupabaseAdminClient.mockReset();
  db = createFakeDb((query) => {
    if (query.table === "staff_profiles") {
      return { data: [{ id: "s1", name: "Owner" }], error: null };
    }
    const rows = applyRecorded(ENQUIRIES, query.calls);
    if (query.options?.head) return { data: null, count: rows.length, error: null };
    return { data: rows, count: rows.length, error: null };
  });
  createSupabaseAdminClient.mockImplementation(() => db.client);
});

describe("the sort is global, not per page", () => {
  it("oldest-first page 2 is the tail of the WHOLE order, not a re-sorted block", async () => {
    const result = await getEnquiriesListPage({
      filters: {},
      sort: "oldest",
      page: "2",
      pageSize: 25,
    });

    expect(result.total).toBe(30);
    expect(result.pageCount).toBe(2);
    // Oldest first across all 30 rows: e01…e30. Page 2 is the five NEWEST.
    // Sorted after a newest-first window it would have been e05…e01.
    expect(result.rows.map((row) => row.id)).toEqual([
      "e26",
      "e27",
      "e28",
      "e29",
      "e30",
    ]);
  });

  it("newest-first page 2 is the five oldest", async () => {
    const result = await getEnquiriesListPage({
      filters: {},
      sort: "newest",
      page: "2",
      pageSize: 25,
    });

    expect(result.rows.map((row) => row.id)).toEqual([
      "e05",
      "e04",
      "e03",
      "e02",
      "e01",
    ]);
  });

  it("name-sorted page 2 continues the alphabet, and is not the date order", async () => {
    const result = await getEnquiriesListPage({
      filters: {},
      sort: "name",
      page: "2",
      pageSize: 25,
    });

    // "Enquirer 01" … "Enquirer 30" maps to e30 … e01, so page 2 is e05…e01.
    expect(result.rows.map((row) => row.full_name)).toEqual([
      "Enquirer 26",
      "Enquirer 27",
      "Enquirer 28",
      "Enquirer 29",
      "Enquirer 30",
    ]);
  });

  it("activity-sorted page 2 follows updated_at, not created_at", async () => {
    const result = await getEnquiriesListPage({
      filters: {},
      sort: "activity",
      page: "2",
      pageSize: 25,
    });

    // updated_at runs opposite to created_at, so newest-activity is e01 first.
    expect(result.rows.map((row) => row.id)).toEqual([
      "e26",
      "e27",
      "e28",
      "e29",
      "e30",
    ]);
  });

  it("puts the order in the query, ahead of the window", async () => {
    await getEnquiriesListPage({ filters: {}, sort: "oldest", pageSize: 25 });

    const calls = rowQuery().calls.map((call) => call.method);
    expect(calls.filter((method) => method === "order")).toHaveLength(2);
    expect(calls.indexOf("order")).toBeLessThan(calls.indexOf("range"));
    expect(rowQuery().calls[0]).toEqual({
      method: "order",
      args: ["created_at", { ascending: true }],
    });
  });
});

describe("the total and the rows share one filter resolution", () => {
  it("sends the count query the same predicates as the row query", async () => {
    await getEnquiriesListPage({
      filters: { status: "contacted", source: "website", q: "person1" },
      sort: "newest",
      pageSize: 25,
    });

    expect(predicateCalls(countQuery())).toEqual(predicateCalls(rowQuery()));
    expect(predicateCalls(rowQuery()).length).toBe(3);
  });

  it("counts what the tab shows, converted included", async () => {
    const converted = await getEnquiriesListPage({
      filters: { status: "converted" },
      sort: "newest",
      pageSize: 25,
    });

    expect(converted.total).toBe(6);
    expect(converted.rows).toHaveLength(6);
    expect(converted.rows.every((row) => row.converted_booking_id)).toBe(true);
  });
});

describe("search composes with paging", () => {
  it("a search narrowing to 3 is ONE page, not an empty page 2", async () => {
    const result = await getEnquiriesListPage({
      filters: { q: "trio" },
      sort: "oldest",
      page: "2",
      pageSize: 25,
    });

    expect(result.total).toBe(3);
    expect(result.pageCount).toBe(1);
    expect(result.page).toBe(1);
    expect(result.rows.map((row) => row.id)).toEqual(["e01", "e02", "e03"]);

    const narrower = await getEnquiriesListPage({
      filters: { q: "person28@" },
      sort: "oldest",
      page: "2",
      pageSize: 25,
    });
    expect(narrower.total).toBe(1);
    expect(narrower.pageCount).toBe(1);
    expect(narrower.page).toBe(1);
    expect(narrower.rows.map((row) => row.id)).toEqual(["e28"]);
  });
});

describe("page clamping", () => {
  it("clamps a stale ?page=99 to the last page", async () => {
    const result = await getEnquiriesListPage({
      filters: {},
      sort: "oldest",
      page: "99",
      pageSize: 25,
    });

    expect(result.page).toBe(2);
    expect(result.rows).toHaveLength(5);
  });

  it("clamps junk, zero and absent to page 1", async () => {
    for (const raw of ["0", "-2", "nope", undefined]) {
      const result = await getEnquiriesListPage({
        filters: {},
        sort: "newest",
        page: raw,
        pageSize: 25,
      });
      expect(result.page).toBe(1);
    }
  });

  it("reports one page for an empty result set, so the pager disappears", async () => {
    const result = await getEnquiriesListPage({
      filters: { q: "nobody-by-that-name" },
      sort: "newest",
      page: "3",
      pageSize: 25,
    });

    expect(result.total).toBe(0);
    expect(result.pageCount).toBe(1);
    expect(result.page).toBe(1);
  });
});

describe("the badge and the at-a-glance stats are head-counts", () => {
  it("asks for counts, never rows, and scopes each one like its own link", async () => {
    const counts = await getEnquiryOverviewCounts({
      today: { from: "2026-03-30", to: "2026-03-30" },
      week: { from: "2026-03-23", to: "2026-03-29" },
      month: { from: "2026-03-01", to: "2026-03-31" },
    });

    expect(counts.newTotal).toBe(10);
    expect(counts.weekTotal).toBe(7);
    expect(counts.monthTotal).toBe(30);
    expect(counts.monthConverted).toBe(6);

    // Every query this made was a head-count: no enquiry rows were transferred.
    expect(enquiryQueries()).toHaveLength(5);
    expect(enquiryQueries().every((query) => query.options?.head === true)).toBe(
      true
    );
  });
});
