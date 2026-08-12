// ITEM M — the global command palette's two branches are bounded differently.
//
// `AdminCommandSearch` is mounted by `AdminTopNav` on every `/admin/*` page for
// every shell, so `searchAdminCommand` runs for every role. Its all-rows branch
// filters in SQL and takes 8 — O(1) forever. Its scoped branch has to resolve
// which bookings the practitioner is assigned to first, and that id array is
// serialised into an `.in()` query string; uncapped it grew with every
// assignment they had ever held.
//
// These specs record what the action actually sends to PostgREST rather than
// asserting on its return value, because the defect is invisible in the
// returned rows: a therapist with three assignments and a therapist with three
// thousand both render at most eight results. The only observable difference is
// the shape of the query, so that is what is pinned here.
//
// Written with this file: there was no test of this module anywhere in the repo.
import { beforeEach, describe, expect, it, vi } from "vitest";

const createSupabaseAdminClient = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClient(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({}),
}));

// Only `getStaffProfile` is replaced — it is the one function that reaches for a
// session. Every permission predicate below is the REAL one, running against a
// real permissions Set, so a change to what `Therapist` may search fails here
// rather than being mocked away (gotcha 44: a guard must refuse for its own
// reason, not an adjacent one).
const getStaffProfile = vi.fn();
vi.mock("@/lib/auth/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rbac")>()),
  getStaffProfile: (...args: unknown[]) => getStaffProfile(...args),
}));

const { searchAdminCommand } = await import("./search-actions");

type StaffProfile = NonNullable<
  Awaited<ReturnType<typeof import("@/lib/auth/rbac").getStaffProfile>>
>;

const STAFF_ID = "aaaaaaaa-0000-4000-8000-000000000001";

/** The cap `getOwnBookingIds` must apply. Duplicated deliberately: if the
 *  source constant changes, this number must be changed with intent. It is
 *  sized by URL arithmetic — 100 ids is ≈4.3 kB of PostgREST query string,
 *  200 is ≈8.2 kB, against a ~8 kB request-line ceiling. */
const EXPECTED_ASSIGNMENT_CAP = 100;

function makeProfile(permissions: string[]): StaffProfile {
  return {
    id: STAFF_ID,
    gender: "female",
    active: true,
    can_take_bookings: true,
    permissions: new Set(permissions),
  } as unknown as StaffProfile;
}

// ---------------------------------------------------------------------------
// Recording stand-in. Mirrors the idiom in
// bookings/__tests__/booking-view-counts.test.ts, narrowed to the chain
// search-actions.ts actually uses and extended to record `.order()`, which the
// cap's determinism depends on.
// ---------------------------------------------------------------------------

const FILTER_OPS = ["eq", "in", "or"] as const;

// ⚠️ `built` and `executed` are different questions, and the difference is
// load-bearing here. `searchBookings` constructs its `bookings` builder BEFORE
// it resolves the assignment ids, so on the "no assignments" path a builder
// exists that is never awaited. PostgREST issues no request until the builder
// is awaited, so "did the database get read" is answered by `executed`, not by
// the builder's existence. Asserting on the wrong one silently passes.
interface RecordedQuery {
  table: string;
  select: string;
  filters: unknown[][];
  orders: Array<[string, boolean | undefined]>;
  limits: number[];
  executed: boolean;
}

function createRecordingAdminClient(
  tables: Record<string, { data?: unknown }> = {}
) {
  const queries: RecordedQuery[] = [];

  function from(table: string) {
    const result = tables[table] ?? { data: [] };
    const query: RecordedQuery = {
      table,
      select: "",
      filters: [],
      orders: [],
      limits: [],
      executed: false,
    };
    queries.push(query);

    const chain: Record<string, unknown> = {};
    for (const op of FILTER_OPS) {
      chain[op] = (...args: unknown[]) => {
        query.filters.push([op, ...args]);
        return chain;
      };
    }
    chain.select = (select: string) => {
      query.select = select;
      return chain;
    };
    chain.order = (column: string, options?: { ascending?: boolean }) => {
      query.orders.push([column, options?.ascending]);
      return chain;
    };
    chain.limit = (value: number) => {
      query.limits.push(value);
      return chain;
    };
    chain.returns = () => chain;
    chain.then = (
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => {
      query.executed = true;
      return Promise.resolve(result).then(onFulfilled, onRejected);
    };
    return chain;
  }

  return { from, queries };
}

type RecordingClient = ReturnType<typeof createRecordingAdminClient>;

/** Builders constructed against a table, awaited or not. */
const queriesFor = (client: RecordingClient, table: string) =>
  client.queries.filter((query) => query.table === table);

/** Builders actually awaited — i.e. reads the database really performed. */
const readsOf = (client: RecordingClient, table: string) =>
  queriesFor(client, table).filter((query) => query.executed);

function mount(tables: Record<string, { data?: unknown }>) {
  const client = createRecordingAdminClient(tables);
  createSupabaseAdminClient.mockImplementation(() => client);
  return client;
}

beforeEach(() => {
  createSupabaseAdminClient.mockReset();
  getStaffProfile.mockReset();
});

describe("searchAdminCommand — the scoped branch's candidate read is bounded", () => {
  it("caps the assignment read and gives it a total order, so the same search always searches the same set", async () => {
    getStaffProfile.mockResolvedValue(makeProfile(["manage_bookings_assigned"]));
    const client = mount({
      booking_assignments: { data: [{ booking_id: "b1" }] },
      bookings: { data: [] },
    });

    await searchAdminCommand("smith");

    const [assignments] = queriesFor(client, "booking_assignments");
    expect(assignments).toBeDefined();
    // ⛔ The scoping filter itself. Without this the whole branch is ITEM L's
    // bug class: a candidate read that is capped and ordered beautifully, but
    // over somebody else's assignments — or everybody's.
    expect(assignments.filters).toEqual([
      ["eq", "assigned_staff_id", STAFF_ID],
    ]);
    expect(assignments.limits).toEqual([EXPECTED_ASSIGNMENT_CAP]);
    // `created_at` alone is not a total order: a multi-participant booking
    // writes one assignment row per participant in a single transaction, and
    // `now()` is transaction time, so those rows share a timestamp exactly.
    expect(assignments.orders).toEqual([
      ["created_at", false],
      ["id", false],
    ]);
    // A Therapist holds no clients permission, so the palette's client half
    // must not run for this profile at all.
    expect(queriesFor(client, "clients")).toHaveLength(0);
  });

  it("dedupes two assignment rows on one booking before they reach .in()", async () => {
    // The real multi-participant case: `booking_assignments` is keyed per
    // PARTICIPANT and carries no unique constraint on
    // (booking_id, assigned_staff_id), so one therapist treating two people on
    // one booking legitimately holds two rows for it.
    getStaffProfile.mockResolvedValue(makeProfile(["view_bookings_assigned"]));
    const client = mount({
      booking_assignments: {
        data: [{ booking_id: "b1" }, { booking_id: "b1" }, { booking_id: "b2" }],
      },
      bookings: { data: [] },
    });

    await searchAdminCommand("smith");

    const [bookings] = readsOf(client, "bookings");
    expect(bookings).toBeDefined();
    const inFilter = bookings.filters.find((filter) => filter[0] === "in");
    expect(inFilter).toEqual(["in", "id", ["b1", "b2"]]);
  });

  it("never reads bookings when the practitioner has no assignments", async () => {
    getStaffProfile.mockResolvedValue(makeProfile(["manage_bookings_assigned"]));
    const client = mount({
      booking_assignments: { data: [] },
      bookings: { data: [] },
    });

    expect(await searchAdminCommand("smith")).toEqual([]);
    // The builder is constructed before the ids are resolved; what must not
    // happen is the read.
    expect(readsOf(client, "booking_assignments")).toHaveLength(1);
    expect(readsOf(client, "bookings")).toHaveLength(0);
  });
});

describe("searchAdminCommand — the all-rows branch stays O(1)", () => {
  it("resolves no assignment ids at all and takes eight rows in SQL", async () => {
    getStaffProfile.mockResolvedValue(makeProfile(["manage_bookings_all"]));
    const client = mount({ bookings: { data: [] } });

    await searchAdminCommand("smith");

    expect(queriesFor(client, "booking_assignments")).toHaveLength(0);
    const [bookings] = readsOf(client, "bookings");
    expect(bookings).toBeDefined();
    expect(bookings.limits).toEqual([8]);
    expect(bookings.filters.some((filter) => filter[0] === "in")).toBe(false);
  });

  it("takes that branch on a view-only permission too, not just a manage one", async () => {
    // `canSearchAll` is an OR of manage/view. Without this case, dropping the
    // view half would quietly demote read-only Admins and Coordinators to the
    // scoped branch, where they have no assignments and so see nothing.
    getStaffProfile.mockResolvedValue(makeProfile(["view_bookings_all"]));
    const client = mount({ bookings: { data: [] } });

    await searchAdminCommand("smith");

    expect(queriesFor(client, "booking_assignments")).toHaveLength(0);
    expect(readsOf(client, "bookings")).toHaveLength(1);
  });
});

describe("searchAdminCommand — each half refuses for its own reason", () => {
  it("skips the booking half without a booking permission, while still searching clients", async () => {
    // Fixture holds every permission EXCEPT a booking one, and is active with a
    // long-enough query, so the only gate that can refuse is the booking gate.
    getStaffProfile.mockResolvedValue(
      makeProfile(["view_clients_all", "manage_clients_all"])
    );
    const client = mount({ clients: { data: [] } });

    await searchAdminCommand("smith");

    expect(queriesFor(client, "booking_assignments")).toHaveLength(0);
    expect(queriesFor(client, "bookings")).toHaveLength(0);
    expect(queriesFor(client, "clients")).toHaveLength(1);
  });

  it("searches nothing for an inactive profile, whatever it is permitted to do", async () => {
    getStaffProfile.mockResolvedValue({
      ...makeProfile(["manage_bookings_all", "manage_clients_all"]),
      active: false,
    });
    const client = mount({ bookings: { data: [] }, clients: { data: [] } });

    expect(await searchAdminCommand("smith")).toEqual([]);
    expect(client.queries).toHaveLength(0);
  });

  it("does not reach for a database connection at all below two characters", async () => {
    expect(await searchAdminCommand(" a ")).toEqual([]);
    expect(getStaffProfile).not.toHaveBeenCalled();
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
