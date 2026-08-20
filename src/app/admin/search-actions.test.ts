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
import { readFileSync } from "node:fs";
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

const FILTER_OPS = ["eq", "in", "or", "is"] as const;

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

// 2026-08-19 — PRODUCTION-FIXES §14 recorded "deleted clients show in search"
// as REFUTED/False on the strength of `clients-list-data.ts`, which does filter
// correctly. This path is a different one and did not. It runs on the
// service-role client, so RLS cannot save it.
describe("searchAdminCommand — soft-deleted clients never surface", () => {
  it("filters deleted_at on the client search", async () => {
    getStaffProfile.mockResolvedValue(makeProfile(["manage_clients_all"]));
    const client = mount({ clients: { data: [] } });

    await searchAdminCommand("smith");

    const [clients] = readsOf(client, "clients");
    expect(clients).toBeDefined();
    expect(clients.filters).toContainEqual(["is", "deleted_at", null]);
  });

  it("filters deleted_at on the booking search too", async () => {
    // A soft-deleted BOOKING must not surface. `assertBookingActive`
    // (bookings/access.ts:106) already answers "Booking not found." for one, so
    // a searchable-but-unopenable row is a dead end for whoever clicks it.
    getStaffProfile.mockResolvedValue(makeProfile(["manage_bookings_all"]));
    const client = mount({ bookings: { data: [] } });

    await searchAdminCommand("smith");

    const [bookings] = readsOf(client, "bookings");
    expect(bookings).toBeDefined();
    expect(bookings.filters).toContainEqual(["is", "deleted_at", null]);
  });

  it("control: the recorder reports a filter's absence rather than swallowing it", async () => {
    // ⛔ REWRITTEN 2026-08-20. This control used to assert that the BOOKINGS
    // chain carried no `deleted_at` filter. It was labelled a recorder
    // meta-control, but it pinned production behaviour: adding the filter above
    // turned it red and looked like the fix had broken something. Gate 02's
    // mutation M10 pre-proved exactly that trap.
    //
    // The control's real job is to prove the recorder distinguishes presence
    // from absence. It now does that against a chain that legitimately carries
    // no `deleted_at` filter — `booking_assignments`, which is scoped by staff
    // id and has no soft-delete column at all — so it can never again pin a
    // product decision by accident.
    getStaffProfile.mockResolvedValue(makeProfile(["manage_bookings_assigned"]));
    const client = mount({ booking_assignments: { data: [] }, bookings: { data: [] } });

    await searchAdminCommand("smith");

    const [assignments] = readsOf(client, "booking_assignments");
    expect(assignments).toBeDefined();
    expect(assignments.filters).not.toContainEqual(["is", "deleted_at", null]);

    // The positive half — that this same recorder DOES report the filter when a
    // chain carries one — is the preceding two tests. ⛔ It cannot be asserted
    // here: with only `manage_bookings_assigned` the scoped branch returns early
    // when the actor has no assignments, so the `bookings` read never happens.
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

// ---------------------------------------------------------------------------
// GATE 07 CASE 27 - FIND-07-B, raised and then FIXED.
//
// The defect: this surface gated on "may you see clients at all" and then
// emitted the email, phone and postcode straight into the visible result line,
// while the clients LIST page - over the same data - switches its entire column
// list on `view_client_contact_details` (clients-list-data.ts:754, CLIENT_SELECT
// vs CLIENT_SAFE_SELECT). Two surfaces, same data, opposite answers. The booking
// half of the same search box had the same gap on contact_email / contact_phone.
//
// Reachability, measured rather than assumed: no role reaches it today, because
// all three roles holding view_clients_all also hold view_client_contact_details.
// It was reachable through a per-person permission override - a supported
// feature, exercised in src/lib/auth/permission-resolution.test.ts.
//
// The fix mirrors the list exactly: the contact columns are not SELECTED without
// the permission, so the values never leave the database; and the search arms
// narrow to the name, so a phone number cannot be used to confirm whose it is.
//
// `service_postcode` on a BOOKING stays ungated deliberately. The list's own
// booking-location filter treats city and postcode as operational data and gates
// only `service_address_line1`, so gating it here would have made the two
// surfaces disagree in the opposite direction.
// ---------------------------------------------------------------------------

const CLIENT_ROW = {
  id: "cccccccc-0000-4000-8000-000000000001",
  full_name: "ZZTEST-Contact Leak",
  client_source: "website",
  email: "zztest.contact@example.test",
  phone: "07000 000000",
  postcode: "LU1 1AA",
};

const BOOKING_ROW = {
  id: "bbbbbbbb-0000-4000-8000-000000000001",
  contact_full_name: "ZZTEST-Booking Contact",
  contact_email: "zztest.booking@example.test",
  contact_phone: "07111 111111",
  service_postcode: "LU2 2BB",
  booking_date: "2026-09-14",
  start_time: "10:00:00",
  status: "pending",
};

/** view_clients_all WITHOUT view_client_contact_details - the shape a per-person
 *  permission override produces, and the only way to reach this at all. */
const CLIENTS_NO_CONTACT = ["view_clients_all"];
const CLIENTS_WITH_CONTACT = ["view_clients_all", "view_client_contact_details"];

describe("FIND-07-B - the command palette now respects view_client_contact_details", () => {
  it("does not put a client's email, phone or postcode in the result line", async () => {
    getStaffProfile.mockResolvedValue(makeProfile(CLIENTS_NO_CONTACT));
    mount({ bookings: { data: [] }, clients: { data: [CLIENT_ROW] } });

    const results = await searchAdminCommand("zztest");

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe(CLIENT_ROW.full_name);
    expect(results[0].detail).not.toContain(CLIENT_ROW.email);
    expect(results[0].detail).not.toContain(CLIENT_ROW.phone);
    expect(results[0].detail).not.toContain(CLIENT_ROW.postcode);
  });

  it("does not even SELECT the contact columns without the permission", async () => {
    // ⛔ The stronger half, and the reason the fix changes the query rather than
    // trimming the output string: values that are never selected never leave the
    // database and cannot leak through some later change to how a result renders.
    getStaffProfile.mockResolvedValue(makeProfile(CLIENTS_NO_CONTACT));
    const client = mount({ bookings: { data: [] }, clients: { data: [CLIENT_ROW] } });

    await searchAdminCommand("zztest");

    const [clientsQuery] = queriesFor(client, "clients");
    expect(clientsQuery.select).not.toContain("email");
    expect(clientsQuery.select).not.toContain("phone");
    expect(clientsQuery.select).not.toContain("postcode");
    expect(clientsQuery.select).toContain("full_name");
  });

  it("does not let a phone number or email be used to search by", async () => {
    // Searching by a phone number and getting a name back confirms whose number
    // it is - a disclosure even when the number itself is never displayed. The
    // list page narrows its arms for the same reason.
    getStaffProfile.mockResolvedValue(makeProfile(CLIENTS_NO_CONTACT));
    const client = mount({ bookings: { data: [] }, clients: { data: [CLIENT_ROW] } });

    await searchAdminCommand("07000");

    const [clientsQuery] = queriesFor(client, "clients");
    const orFilters = clientsQuery.filters
      .filter(([op]) => op === "or")
      .map(([, value]) => String(value))
      .join(" ");
    expect(orFilters).toContain("full_name.ilike");
    expect(orFilters).not.toContain("email.ilike");
    expect(orFilters).not.toContain("phone.ilike");
    expect(orFilters).not.toContain("postcode.ilike");
  });

  it("still gives contact details to a viewer who IS permitted", async () => {
    // ⛔ Non-vacuity, and the half that matters most: the fix must narrow the
    // surface for one caller without breaking it for everybody. Every role that
    // exists today lands here.
    getStaffProfile.mockResolvedValue(makeProfile(CLIENTS_WITH_CONTACT));
    const client = mount({ bookings: { data: [] }, clients: { data: [CLIENT_ROW] } });

    const results = await searchAdminCommand("zztest");

    expect(results[0].detail).toContain(CLIENT_ROW.email);
    expect(results[0].detail).toContain(CLIENT_ROW.phone);
    expect(results[0].detail).toContain(CLIENT_ROW.postcode);

    const [clientsQuery] = queriesFor(client, "clients");
    expect(clientsQuery.select).toContain("email");
    const orFilters = clientsQuery.filters
      .filter(([op]) => op === "or")
      .map(([, value]) => String(value))
      .join(" ");
    expect(orFilters).toContain("email.ilike");
  });

  it("shows a non-identifying source instead of a blank line", async () => {
    getStaffProfile.mockResolvedValue(makeProfile(CLIENTS_NO_CONTACT));
    mount({ bookings: { data: [] }, clients: { data: [CLIENT_ROW] } });

    const results = await searchAdminCommand("zztest");

    expect(results[0].detail).toBe("website");
  });

  it("still refuses a viewer who cannot see all clients at all", async () => {
    // The gate that always existed still works, so the specs above are about the
    // missing SECOND gate rather than a missing first one.
    getStaffProfile.mockResolvedValue(
      makeProfile(["view_bookings_assigned", "view_client_contact_details"])
    );
    const client = mount({ bookings: { data: [] }, clients: { data: [CLIENT_ROW] } });

    const results = await searchAdminCommand("zztest");

    expect(results.filter((result) => result.type === "client")).toEqual([]);
    expect(queriesFor(client, "clients")).toHaveLength(0);
  });
});

describe("FIND-07-B - the booking half of the same search box", () => {
  const BOOKINGS_NO_CONTACT = ["view_bookings_all"];
  const BOOKINGS_WITH_CONTACT = ["view_bookings_all", "view_client_contact_details"];

  it("does not select or search the customer's email and phone without the permission", async () => {
    getStaffProfile.mockResolvedValue(makeProfile(BOOKINGS_NO_CONTACT));
    const client = mount({ bookings: { data: [BOOKING_ROW] }, clients: { data: [] } });

    await searchAdminCommand("zztest");

    const [bookingsQuery] = queriesFor(client, "bookings");
    expect(bookingsQuery.select).not.toContain("contact_email");
    expect(bookingsQuery.select).not.toContain("contact_phone");

    const orFilters = bookingsQuery.filters
      .filter(([op]) => op === "or")
      .map(([, value]) => String(value))
      .join(" ");
    expect(orFilters).toContain("contact_full_name.ilike");
    expect(orFilters).not.toContain("contact_email.ilike");
    expect(orFilters).not.toContain("contact_phone.ilike");
  });

  it("keeps service_postcode ungated, matching the clients list's own precedent", async () => {
    // ⚠️ Deliberate, not an oversight. `clients-list-data.ts`'s booking-location
    // filter treats service_city and service_postcode as operational data and
    // gates only service_address_line1. Gating postcode here would make the two
    // surfaces disagree in the opposite direction.
    getStaffProfile.mockResolvedValue(makeProfile(BOOKINGS_NO_CONTACT));
    const client = mount({ bookings: { data: [BOOKING_ROW] }, clients: { data: [] } });

    const results = await searchAdminCommand("zztest");

    const [bookingsQuery] = queriesFor(client, "bookings");
    expect(bookingsQuery.select).toContain("service_postcode");
    const orFilters = bookingsQuery.filters
      .filter(([op]) => op === "or")
      .map(([, value]) => String(value))
      .join(" ");
    expect(orFilters).toContain("service_postcode.ilike");
    expect(results[0].detail).toContain(BOOKING_ROW.service_postcode);
  });

  it("still searches contact details for a viewer who IS permitted", async () => {
    getStaffProfile.mockResolvedValue(makeProfile(BOOKINGS_WITH_CONTACT));
    const client = mount({ bookings: { data: [BOOKING_ROW] }, clients: { data: [] } });

    await searchAdminCommand("zztest");

    const [bookingsQuery] = queriesFor(client, "bookings");
    expect(bookingsQuery.select).toContain("contact_email");
    const orFilters = bookingsQuery.filters
      .filter(([op]) => op === "or")
      .map(([, value]) => String(value))
      .join(" ");
    expect(orFilters).toContain("contact_email.ilike");
    expect(orFilters).toContain("contact_phone.ilike");
  });

  it("the clients LIST is the surface this was aligned to - contrast, in source", () => {
    // Structural, and stated as such: it pins the precedent the fix followed.
    const listSource = readFileSync(
      "src/app/admin/clients/clients-list-data.ts",
      "utf8"
    );
    expect(listSource).toContain(
      "canViewContactDetails ? CLIENT_SELECT : CLIENT_SAFE_SELECT"
    );
  });
});
