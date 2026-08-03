// C-16 Phase C Steps 6-7 — chip counts + pager windowing, at the data layer.
//
// The load-bearing claim of Step 6 is that a chip's number is computed with
// the predicate that chip's OWN view would use. A chip counted through a
// second, hand-maintained predicate would silently lie to staff, so the specs
// below never write a view's rule out by hand: they record what
// `getBookingViewCounts` actually sends to PostgREST and compare it against
// the SAME `buildBookingPredicatePlan` + `applyBookingPredicates` pair the
// list query goes through (bookings-list-data.ts). If the two ever diverge,
// the comparison fails without anyone having to predict HOW they diverged.
//
// Step 7's half is the window: `getBookingsListPage` clamps `?page=` against
// the real page count and turns it into the row query's offset, and reports
// `pageCount` — which is what makes `PaginationBar` render nothing on a
// single-page result (its `pageCount <= 1` contract, pinned in
// components/PaginationBar.test.tsx).
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  applyBookingPredicates,
  bookingListFiltersFromQuery,
  bookingSelectWith,
  buildBookingPredicatePlan,
  getBookingViewCounts,
  getBookingsListPage,
  visibleBookingViews,
} = await import("../bookings-list-data");
const {
  FULL_OVERFLOW,
  FULL_PRIMARY,
  THERAPIST_OVERFLOW,
  THERAPIST_PRIMARY,
} = await import("../BookingsChrome");
const { canClaimAssignments } = await import("../access");
const { getTodayIsoDate } = await import("../_helpers");
const { LIST_PAGE_SIZE } = await import("@/lib/pagination");

type ListPageParams = Parameters<typeof getBookingsListPage>[0];
type TestProfile = ListPageParams["profile"];
type Filters = ListPageParams["filters"];

const STAFF_ID = "aaaaaaaa-0000-4000-8000-000000000001";

function makeProfile(
  permissions: string[] = ["manage_bookings_all", "claim_assignments"]
): TestProfile {
  return {
    id: STAFF_ID,
    gender: "female",
    active: true,
    can_take_bookings: true,
    permissions: new Set(permissions),
  } as unknown as TestProfile;
}

// ---------------------------------------------------------------------------
// Recording stand-ins. The filter recorder is shared by both sides of the
// comparison, so "what production sent" and "what the plan builder produces"
// are recorded in one grammar and can be compared with a plain `toEqual`.
// ---------------------------------------------------------------------------

const FILTER_OPS = ["eq", "neq", "gte", "lte", "in", "is", "not", "or"] as const;

type RecordedFilter = unknown[];

function createFilterRecorder() {
  const filters: RecordedFilter[] = [];
  const self: Record<string, unknown> = {};
  for (const op of FILTER_OPS) {
    self[op] = (...args: unknown[]) => {
      filters.push([op, ...args]);
      return self;
    };
  }
  return { filters, builder: self };
}

interface RecordedQuery {
  table: string;
  select: string;
  filters: RecordedFilter[];
  ranges: Array<[number, number]>;
  limits: number[];
}

interface TableResult {
  data?: unknown;
  count?: number | null;
  error?: unknown;
}

function createRecordingAdminClient(tables: Record<string, TableResult> = {}) {
  const queries: RecordedQuery[] = [];

  function from(table: string) {
    const result = tables[table] ?? { data: [], count: 0, error: null };
    const { filters, builder } = createFilterRecorder();
    const query: RecordedQuery = {
      table,
      select: "",
      filters,
      ranges: [],
      limits: [],
    };
    queries.push(query);

    const chain: Record<string, unknown> = {};
    for (const op of FILTER_OPS) {
      chain[op] = (...args: unknown[]) => {
        (builder[op] as (...a: unknown[]) => unknown)(...args);
        return chain;
      };
    }
    chain.select = (select: string) => {
      query.select = select;
      return chain;
    };
    chain.order = () => chain;
    chain.returns = () => chain;
    chain.limit = (value: number) => {
      query.limits.push(value);
      return chain;
    };
    chain.range = (start: number, end: number) => {
      query.ranges.push([start, end]);
      return chain;
    };
    chain.then = (
      onFulfilled?: (value: TableResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
    return chain;
  }

  return { from, queries };
}

/** The query the production plan builder describes for one predicate context. */
function planQuery(ctx: Parameters<typeof buildBookingPredicatePlan>[0]) {
  const plan = buildBookingPredicatePlan(ctx);
  const { filters, builder } = createFilterRecorder();
  applyBookingPredicates(builder, plan.steps);
  return { select: bookingSelectWith("id", plan.embeds), filters };
}

function baseContext(profile: TestProfile, filters: Filters) {
  return {
    ...filters,
    today: getTodayIsoDate(),
    staffId: STAFF_ID,
    staffGender: "female",
    canClaim: canClaimAssignments(profile as never),
    searchClientIds: [] as string[],
  };
}

function bookingsQueries(client: ReturnType<typeof createRecordingAdminClient>) {
  return client.queries.filter((query) => query.table === "bookings");
}

beforeEach(() => {
  cacheHarness.clear();
  createSupabaseAdminClient.mockReset();
});

describe("getBookingViewCounts — one count per chip, each with its own view's predicate", () => {
  it("sends, for every clinic-wide chip, exactly the predicate that view's list would use", async () => {
    const client = createRecordingAdminClient({
      bookings: { data: [], count: 7, error: null },
    });
    createSupabaseAdminClient.mockImplementation(() => client);

    const profile = makeProfile();
    // A filter that is NOT the view, to prove the other filters ride along on
    // every chip: clicking a chip keeps them, so its count must too.
    const filters = bookingListFiltersFromQuery(
      { payment_status: "unpaid" },
      "attention"
    );
    const views = visibleBookingViews(true);

    const counts = await getBookingViewCounts({ profile, filters, views });

    expect(Object.keys(counts).sort()).toEqual([...views].sort());
    expect(Object.values(counts)).toEqual(views.map(() => 7));

    const sent = bookingsQueries(client);
    expect(sent).toHaveLength(views.length);

    const ctx = baseContext(profile, filters);
    views.forEach((view, index) => {
      expect({
        view,
        select: sent[index].select,
        filters: sent[index].filters,
      }).toEqual({ view, ...planQuery({ ...ctx, view }) });
    });
  });

  it("counts only the chips a therapist actually sees", async () => {
    const client = createRecordingAdminClient({
      bookings: { data: [], count: 3, error: null },
    });
    createSupabaseAdminClient.mockImplementation(() => client);

    const profile = makeProfile(["manage_bookings_assigned", "claim_assignments"]);
    const filters = bookingListFiltersFromQuery({}, "today");
    const views = visibleBookingViews(false);

    const counts = await getBookingViewCounts({ profile, filters, views });

    expect(views).toHaveLength(5);
    expect(Object.keys(counts).sort()).toEqual([...views].sort());
    expect(bookingsQueries(client)).toHaveLength(5);
    // The six clinic-only chips are never queried.
    expect(counts).not.toHaveProperty("attention");
    expect(counts).not.toHaveProperty("all");
  });

  it("resolves the search's client ids once and shares them across every chip", async () => {
    const client = createRecordingAdminClient({
      bookings: { data: [], count: 1, error: null },
      clients: { data: [{ id: "c1111111-0000-4000-8000-00000000000c" }], error: null },
    });
    createSupabaseAdminClient.mockImplementation(() => client);

    const profile = makeProfile();
    const filters = bookingListFiltersFromQuery({ search: "Zainab" }, "today");
    const views = visibleBookingViews(false);

    await getBookingViewCounts({ profile, filters, views });

    expect(client.queries.filter((q) => q.table === "clients")).toHaveLength(1);
    for (const query of bookingsQueries(client)) {
      expect(JSON.stringify(query.filters)).toContain(
        "client_id.in.(c1111111-0000-4000-8000-00000000000c)"
      );
    }
  });

  it("names exactly the chips BookingsChrome renders (the two lists cannot drift)", () => {
    // `visibleBookingViews` is a second source by necessity — BookingsChrome
    // is a "use client" module and a server component cannot read a value out
    // of one. This is the pin that keeps it honest.
    expect([...visibleBookingViews(true)].sort()).toEqual(
      [...FULL_PRIMARY, ...FULL_OVERFLOW].sort()
    );
    expect([...visibleBookingViews(false)].sort()).toEqual(
      [...THERAPIST_PRIMARY, ...THERAPIST_OVERFLOW].sort()
    );
  });
});

describe("getBookingsListPage — ?page= windowing (Step 7)", () => {
  it("clamps a stale ?page=99 to the last page and windows the row query there", async () => {
    const client = createRecordingAdminClient({
      bookings: { data: [], count: 60, error: null },
    });
    createSupabaseAdminClient.mockImplementation(() => client);

    const result = await getBookingsListPage({
      profile: makeProfile(),
      canViewAll: true,
      filters: bookingListFiltersFromQuery({}, "all"),
      page: "99",
    });

    // 60 rows / 25 per page = 3 pages.
    expect(result).toMatchObject({ total: 60, page: 3, pageCount: 3 });

    const sent = bookingsQueries(client);
    expect(sent).toHaveLength(2); // head-count, then the rows
    expect(sent[1].ranges).toEqual([[50, 74]]);
  });

  it("clamps a junk ?page= to the first page", async () => {
    const client = createRecordingAdminClient({
      bookings: { data: [], count: 60, error: null },
    });
    createSupabaseAdminClient.mockImplementation(() => client);

    const result = await getBookingsListPage({
      profile: makeProfile(),
      canViewAll: true,
      filters: bookingListFiltersFromQuery({}, "all"),
      page: "-4",
    });

    expect(result.page).toBe(1);
    expect(bookingsQueries(client)[1].ranges).toEqual([[0, LIST_PAGE_SIZE - 1]]);
  });

  it("counts and lists through one predicate — the two queries carry identical filters", async () => {
    const client = createRecordingAdminClient({
      bookings: { data: [], count: 60, error: null },
    });
    createSupabaseAdminClient.mockImplementation(() => client);

    await getBookingsListPage({
      profile: makeProfile(),
      canViewAll: true,
      filters: bookingListFiltersFromQuery(
        { status: "pending", location: "Luton" },
        "upcoming"
      ),
      page: "2",
    });

    const [countQuery, rowQuery] = bookingsQueries(client);
    expect(rowQuery.filters).toEqual(countQuery.filters);
  });

  it("reports one page when everything fits, so the pager renders nothing", async () => {
    const client = createRecordingAdminClient({
      bookings: { data: [{ id: "b1" }], count: 12, error: null },
    });
    createSupabaseAdminClient.mockImplementation(() => client);

    const result = await getBookingsListPage({
      profile: makeProfile(),
      canViewAll: true,
      filters: bookingListFiltersFromQuery({}, "all"),
      page: undefined,
    });

    expect(result).toMatchObject({ total: 12, page: 1, pageCount: 1 });
  });

  it("leaves the therapist-scoped branch un-paged (one page, no range)", async () => {
    const client = createRecordingAdminClient({
      booking_assignments: { data: [{ booking_id: "b1" }], error: null },
      bookings: {
        data: [{ id: "b1", booking_date: "2026-01-10", start_time: "10:00" }],
        count: null,
        error: null,
      },
    });
    createSupabaseAdminClient.mockImplementation(() => client);

    const result = await getBookingsListPage({
      profile: makeProfile(["manage_bookings_assigned", "claim_assignments"]),
      canViewAll: false,
      filters: bookingListFiltersFromQuery({}, "today"),
      page: "3",
    });

    expect(result).toMatchObject({ total: 1, page: 1, pageCount: 1 });
    for (const query of bookingsQueries(client)) {
      expect(query.ranges).toEqual([]);
    }
  });
});
