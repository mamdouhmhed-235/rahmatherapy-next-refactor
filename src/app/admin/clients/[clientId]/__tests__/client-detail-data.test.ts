// C-09 Phase C Step 7 — cache behaviour for /admin/clients/[clientId]'s helper.
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

const { createFakeAdminClient } = await import(
  "@/lib/cache/__tests__/fake-supabase-admin"
);
const {
  getClientDetailData,
  countClientBookings,
  resolveClientBookingHistoryBannerState,
  resolveClientNotesBannerState,
  resolveClientSensitiveNotesBannerState,
  CLIENT_BOOKING_HISTORY_LIMIT,
  CLIENT_BOOKING_HISTORY_VIEW_ALL_CAP,
  CLIENT_LIFETIME_SCAN_CAP,
  CLIENT_NOTES_LIMIT,
  CLIENT_NOTES_VIEW_ALL_CAP,
  CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP,
  CLIENT_SENSITIVE_NOTES_VIEW_ALL_CAP,
  CRITICAL_NOTE_KEYWORDS,
  CRITICAL_NOTE_PATTERN,
} = await import("../client-detail-data");
const { summariseClientBookingHistory } = await import("../page");
const { TAGS } = await import("@/lib/cache/tag-taxonomy");

const FULL_FLAGS = {
  canViewClient: true,
  canViewContactDetails: true,
  canViewHealthNotes: true,
  canCreateClientNote: true,
  canViewSensitiveNoteQueue: true,
  canManagePrivacyOperations: true,
};

const NARROW_FLAGS = {
  canViewClient: false,
  canViewContactDetails: false,
  canViewHealthNotes: false,
  canCreateClientNote: false,
  canViewSensitiveNoteQueue: false,
  canManagePrivacyOperations: false,
};

const OWNER_PARAMS = {
  clientId: "c1",
  staffId: "s1",
  hasAllClientAccess: true,
  accessWithoutAssignment: FULL_FLAGS,
  accessWithAssignment: FULL_FLAGS,
};

function stubClient() {
  return createFakeAdminClient({
    clients: {
      data: {
        id: "c1",
        full_name: "Test Client",
        client_source: "web",
        created_at: "2026-01-02T09:30:00.000Z",
        updated_at: "2026-01-02T09:30:00.000Z",
        deleted_at: null,
      },
      error: null,
    },
    bookings: {
      data: [
        {
          id: "b1",
          client_id: "c1",
          booking_date: "2026-01-10",
          start_time: "10:00",
          status: "confirmed",
          booking_items: [],
        },
      ],
      error: null,
      count: 4,
    },
    booking_assignments: { data: [{ booking_id: "b1" }], error: null },
    // C-16 Step 14 (N6) + fix round (verify-FAIL Check 1) — five
    // `.from("client_notes")` calls per fetch when `canViewSensitiveNoteQueue`
    // is true, in this order: regular-notes rows, regular-notes head-count,
    // sensitive-notes rows (the DISPLAY rail), sensitive-notes head-count,
    // criticalNote candidates (the safety scan's own query — see
    // `criticalNoteCandidatesQuery` in client-detail-data.ts).
    // `createFakeAdminClient` cycles an array registration in call order and
    // clamps to the last entry once exhausted, which is why tests that don't
    // care about the tail (e.g. a narrow caller skipping the sensitive
    // queries) don't need all five registered.
    client_notes: [
      {
        data: [
          {
            id: "n1",
            note: "note",
            is_sensitive: false,
            created_at: "2026-01-02T09:30:00.000Z",
          },
        ],
        error: null,
      },
      { data: null, error: null, count: 1 },
      {
        data: [
          {
            id: "n2",
            note: "sensitive note",
            is_sensitive: true,
            created_at: "2026-01-01T09:30:00.000Z",
          },
        ],
        error: null,
      },
      { data: null, error: null, count: 1 },
      { data: [], error: null },
    ],
    client_privacy_requests: {
      data: [
        {
          id: "p1",
          request_type: "data_export",
          status: "open",
          request_note: null,
          created_at: "2026-01-02T09:30:00.000Z",
        },
      ],
      error: null,
    },
    audit_logs: {
      data: [
        {
          id: "a1",
          action_type: "client_created",
          created_at: "2026-01-02T09:30:00.000Z",
        },
      ],
      error: null,
    },
  });
}

beforeEach(() => {
  cacheHarness.clear();
  createSupabaseAdminClient.mockReset();
  createSupabaseAdminClient.mockImplementation(() => stubClient());
});

describe("getClientDetailData cache behaviour", () => {
  it("runs the fetcher on a cache miss", async () => {
    const data = await getClientDetailData(OWNER_PARAMS);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(data.client?.id).toBe("c1");
    expect(data.bookingHistory).toHaveLength(1);
    expect(data.regularNotes).toHaveLength(1);
    expect(data.regularNotesTotal).toBe(1);
    expect(data.sensitiveNotes).toHaveLength(1);
    expect(data.sensitiveNotesTotal).toBe(1);
    expect(data.criticalNote).toBeNull();
    expect(data.privacyRequests).toHaveLength(1);
    expect(data.auditLogs).toHaveLength(1);
  });

  it("does not re-run the fetcher on a cache hit", async () => {
    await getClientDetailData(OWNER_PARAMS);
    await getClientDetailData(OWNER_PARAMS);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it.each([TAGS.CLIENTS, TAGS.BOOKINGS, TAGS.AUDIT, TAGS.EMAILS])(
    "re-runs the fetcher after the %s tag is invalidated",
    async (tag) => {
      await getClientDetailData(OWNER_PARAMS);
      cacheHarness.invalidateTag(tag);
      await getClientDetailData(OWNER_PARAMS);
      expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    }
  );

  it("keys separately per client id, staff id and access flags", async () => {
    await getClientDetailData(OWNER_PARAMS);
    await getClientDetailData({ ...OWNER_PARAMS, clientId: "c2" });
    await getClientDetailData({ ...OWNER_PARAMS, staffId: "s2" });
    await getClientDetailData({
      ...OWNER_PARAMS,
      accessWithoutAssignment: NARROW_FLAGS,
    });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(4);
  });

  // C-16 closeout — replaces the old limit/offset keying test. That plumbing
  // is gone: no caller ever passed it, which is precisely why the rail shipped
  // unbounded. `historyViewAll` changes the cap the query carries, so it has to
  // reach the cache key or the expanded rail could be served the capped entry.
  it("keys separately per historyViewAll (the cap actually queried differs)", async () => {
    await getClientDetailData({ ...OWNER_PARAMS, historyViewAll: false });
    await getClientDetailData({ ...OWNER_PARAMS, historyViewAll: true });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    await getClientDetailData({ ...OWNER_PARAMS, historyViewAll: true });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("reports assignment-derived access as a boolean the page re-derives from", async () => {
    const data = await getClientDetailData({
      ...OWNER_PARAMS,
      hasAllClientAccess: false,
      accessWithoutAssignment: NARROW_FLAGS,
      accessWithAssignment: FULL_FLAGS,
    });
    expect(data.hasAssignedClientAccess).toBe(true);
    expect(typeof data.hasAssignedClientAccess).toBe("boolean");
  });

  it("returns a JSON-safe shape (no Map/Set/Date crosses the boundary)", async () => {
    const data = await getClientDetailData(OWNER_PARAMS);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it("caches the companion count path per client id", async () => {
    await expect(countClientBookings("c1")).resolves.toBe(4);
    await countClientBookings("c1");
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    await countClientBookings("c2");
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// C-16 closeout — the booking-history rail bound
// ---------------------------------------------------------------------------
//
// `createFakeAdminClient` above records nothing and honours nothing, so a query
// that quietly lost its `.limit()` would still pass every spec written against
// it. This stand-in records the builder calls AND applies the recorded limit
// after the fact, which is what makes "the bound is in the query, not in
// memory" an assertion with teeth rather than a claim.

interface RecordedCall {
  method: string;
  args: unknown[];
}
interface RecordedQuery {
  table: string;
  select: string;
  options?: { count?: string; head?: boolean };
  calls: RecordedCall[];
}

const RECORDING_CHAIN = [
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
  "like",
  "order",
  "limit",
  "range",
  "returns",
  "overrideTypes",
] as const;

function createRecordingAdminClient(
  resolve: (query: RecordedQuery) => {
    data?: unknown;
    count?: number | null;
    error?: unknown;
  }
) {
  const queries: RecordedQuery[] = [];
  const client = {
    from(table: string) {
      const query: RecordedQuery = { table, select: "", calls: [] };
      queries.push(query);
      const chain: Record<string, unknown> = {};
      for (const method of RECORDING_CHAIN) {
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
      chain.single = async () => resolve(query);
      chain.maybeSingle = async () => resolve(query);
      chain.then = (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(resolve(query)).then(onFulfilled, onRejected);
      return chain;
    },
  };
  return { client, queries };
}

/** Newest-first, £10 paid each, so a truncated sum is unmistakable. */
function makeBookings(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `b${String(index).padStart(4, "0")}`,
    client_id: "c1",
    booking_date: new Date(Date.UTC(2026, 0, 1) - index * 86_400_000)
      .toISOString()
      .slice(0, 10),
    start_time: "10:00",
    end_time: "11:00",
    status: "completed",
    payment_status: "paid",
    assignment_status: "fully_assigned",
    group_booking: false,
    total_price: 60,
    amount_paid: 10,
    created_at: "2025-01-01T09:00:00.000Z",
    service_city: "Luton",
    service_postcode: "LU1 1AA",
    booking_items: [],
  }));
}

function recordingClientWith(bookingRows: ReturnType<typeof makeBookings>) {
  return createRecordingAdminClient((query) => {
    if (query.table === "clients") {
      return {
        data: {
          id: "c1",
          full_name: "Test Client",
          client_source: "web",
          created_at: "2020-01-02T09:30:00.000Z",
          updated_at: "2020-01-02T09:30:00.000Z",
          deleted_at: null,
        },
        error: null,
      };
    }
    if (query.table === "bookings") {
      if (query.options?.head) {
        return { data: null, count: bookingRows.length, error: null };
      }
      const limitCall = query.calls.find((call) => call.method === "limit");
      const capped = limitCall
        ? bookingRows.slice(0, limitCall.args[0] as number)
        : bookingRows;
      return { data: capped, count: bookingRows.length, error: null };
    }
    if (query.table === "booking_assignments") {
      return { data: bookingRows.map((row) => ({ booking_id: row.id })), error: null };
    }
    if (query.options?.head) return { data: null, count: 0, error: null };
    return { data: [], error: null };
  });
}

/** The rail's fat select carries `amount_due`; the lifetime projection doesn't. */
function railQuery(queries: RecordedQuery[]) {
  const found = queries.find(
    (query) =>
      query.table === "bookings" &&
      !query.options?.head &&
      query.select.includes("amount_due")
  );
  if (!found) throw new Error("no rendered booking-history query was issued");
  return found;
}

function lifetimeQuery(queries: RecordedQuery[]) {
  const found = queries.find(
    (query) =>
      query.table === "bookings" &&
      !query.options?.head &&
      !query.select.includes("amount_due")
  );
  if (!found) throw new Error("no lifetime-scan query was issued");
  return found;
}

function historyCountQuery(queries: RecordedQuery[]) {
  const found = queries.find(
    (query) => query.table === "bookings" && query.options?.head === true
  );
  if (!found) throw new Error("no booking head-count was issued");
  return found;
}

function limitOf(query: RecordedQuery): number | undefined {
  const call = query.calls.find((entry) => entry.method === "limit");
  return call ? (call.args[0] as number) : undefined;
}

describe("getClientDetailData — booking-history rail bound (C-16 closeout)", () => {
  const HISTORY_SIZE = CLIENT_BOOKING_HISTORY_LIMIT + 70;
  let recording: ReturnType<typeof createRecordingAdminClient>;

  function useRecording(count = HISTORY_SIZE) {
    recording = recordingClientWith(makeBookings(count));
    createSupabaseAdminClient.mockImplementation(() => recording.client);
  }

  it("bounds the rendered rail ON THE QUERY at the default cap", async () => {
    useRecording();
    const data = await getClientDetailData(OWNER_PARAMS);

    expect(limitOf(railQuery(recording.queries))).toBe(CLIENT_BOOKING_HISTORY_LIMIT);
    expect(railQuery(recording.queries).calls).not.toContainEqual(
      expect.objectContaining({ method: "range" })
    );
    expect(data.bookingHistory).toHaveLength(CLIENT_BOOKING_HISTORY_LIMIT);
  });

  it("raises that bound to the view-all cap, still on the query", async () => {
    useRecording();
    const data = await getClientDetailData({
      ...OWNER_PARAMS,
      historyViewAll: true,
    });

    expect(limitOf(railQuery(recording.queries))).toBe(
      CLIENT_BOOKING_HISTORY_VIEW_ALL_CAP
    );
    expect(data.bookingHistory).toHaveLength(HISTORY_SIZE);
  });

  it("head-counts the SAME client scope, so the total the rail reports is the true one", async () => {
    useRecording();
    const data = await getClientDetailData(OWNER_PARAMS);

    const count = historyCountQuery(recording.queries);
    expect(count.options).toEqual({ count: "exact", head: true });
    expect(count.calls).toContainEqual({ method: "eq", args: ["client_id", "c1"] });
    expect(limitOf(count)).toBeUndefined();
    expect(data.bookingHistoryTotal).toBe(HISTORY_SIZE);
    expect(data.bookingHistoryTotal).toBeGreaterThan(data.bookingHistory.length);
  });

  it("gives the lifetime figures their own whole-history read — PII-free, and capped", async () => {
    useRecording();
    const data = await getClientDetailData(OWNER_PARAMS);

    const scan = lifetimeQuery(recording.queries);
    expect(limitOf(scan)).toBe(CLIENT_LIFETIME_SCAN_CAP);
    for (const forbidden of [
      "contact_",
      "health_notes",
      "customer_notes",
      "booking_participants",
      "service_address_line1",
    ]) {
      expect(scan.select).not.toContain(forbidden);
    }
    // The whole history, while the rail beside it is capped — the two reads
    // are what let the ribbon stay lifetime-true after the rail was bounded.
    expect(data.lifetimeBookings).toHaveLength(HISTORY_SIZE);
    expect(data.bookingHistory).toHaveLength(CLIENT_BOOKING_HISTORY_LIMIT);
  });

  it("does not move the lifetime read when the rail is expanded", async () => {
    useRecording();
    const capped = await getClientDetailData(OWNER_PARAMS);
    useRecording();
    const expanded = await getClientDetailData({
      ...OWNER_PARAMS,
      historyViewAll: true,
    });

    expect(expanded.lifetimeBookings).toHaveLength(capped.lifetimeBookings.length);
    expect(expanded.bookingHistoryTotal).toBe(capped.bookingHistoryTotal);
  });

  it("narrows all three reads to the therapist's own assignments alike", async () => {
    useRecording();
    await getClientDetailData({
      ...OWNER_PARAMS,
      hasAllClientAccess: false,
      accessWithoutAssignment: NARROW_FLAGS,
      accessWithAssignment: FULL_FLAGS,
    });

    for (const query of [
      railQuery(recording.queries),
      lifetimeQuery(recording.queries),
      historyCountQuery(recording.queries),
    ]) {
      expect(query.calls).toContainEqual({ method: "eq", args: ["client_id", "c1"] });
      expect(
        query.calls.some(
          (call) => call.method === "in" && call.args[0] === "id"
        )
      ).toBe(true);
    }
  });

  it("SABOTAGE TARGET — the lifetime figures are the whole history's, never the rail page's", async () => {
    useRecording();
    const data = await getClientDetailData(OWNER_PARAMS);

    const lifetime = summariseClientBookingHistory(data.lifetimeBookings);
    const overTheRail = summariseClientBookingHistory(data.bookingHistory);

    // £10 paid per booking: the whole history, and the rail's page, disagree —
    // which is exactly the silent "lifetime value of the last 50 visits" this
    // split exists to prevent. Feed the ribbon or the summary panel the rail
    // and these are the numbers it would print.
    expect(lifetime.totalSpend).toBe(HISTORY_SIZE * 10);
    expect(lifetime.total).toBe(data.bookingHistoryTotal);
    expect(lifetime.completedCount).toBe(HISTORY_SIZE);
    expect(overTheRail.totalSpend).toBe(CLIENT_BOOKING_HISTORY_LIMIT * 10);
    expect(overTheRail.totalSpend).toBeLessThan(lifetime.totalSpend);
    expect(overTheRail.total).toBeLessThan(data.bookingHistoryTotal);
  });
});

// The rail's four-state signal. Same branch order as the two notes resolvers:
// `cappedOut` BEFORE `hidden`, or "show all N" links back to the state already
// open once the true total exceeds the view-all cap itself.
describe("resolveClientBookingHistoryBannerState", () => {
  it("is 'none' when the cap never bound", () => {
    expect(
      resolveClientBookingHistoryBannerState({
        historyTotal: 6,
        historyShown: 6,
        viewAll: false,
      })
    ).toEqual({ kind: "none" });
  });

  it("is 'hidden' when the default cap is truncating", () => {
    expect(
      resolveClientBookingHistoryBannerState({
        historyTotal: CLIENT_BOOKING_HISTORY_LIMIT + 10,
        historyShown: CLIENT_BOOKING_HISTORY_LIMIT,
        viewAll: false,
      })
    ).toEqual({ kind: "hidden", total: CLIENT_BOOKING_HISTORY_LIMIT + 10 });
  });

  it("is 'viewingAll' when the view-all cap covers everything", () => {
    expect(
      resolveClientBookingHistoryBannerState({
        historyTotal: CLIENT_BOOKING_HISTORY_LIMIT + 10,
        historyShown: CLIENT_BOOKING_HISTORY_LIMIT + 10,
        viewAll: true,
      })
    ).toEqual({ kind: "viewingAll", total: CLIENT_BOOKING_HISTORY_LIMIT + 10 });
  });

  it("SABOTAGE TARGET — is 'cappedOut', not 'hidden', once already viewing all and the total still exceeds the view-all cap", () => {
    const result = resolveClientBookingHistoryBannerState({
      historyTotal: CLIENT_BOOKING_HISTORY_VIEW_ALL_CAP + 25,
      historyShown: CLIENT_BOOKING_HISTORY_VIEW_ALL_CAP,
      viewAll: true,
    });
    expect(result.kind).toBe("cappedOut");
    expect(result).toEqual({
      kind: "cappedOut",
      total: CLIENT_BOOKING_HISTORY_VIEW_ALL_CAP + 25,
    });
  });
});

// C-16 Step 14 (N6) — the notes rail bound. The query is what's asserted
// (not an in-memory filter over an unbounded fetch): `regularNotes` carries
// `.eq("is_sensitive", false)` + `.limit()`, `sensitiveNotes` carries
// `.eq("is_sensitive", true)` + its own defensive cap, and `regularNotesTotal`
// is a head-count over the SAME `is_sensitive = false` predicate as the rows.
describe("getClientDetailData — notes rail bound (N6)", () => {
  it("keys separately per notesViewAll (the cap actually queried differs)", async () => {
    await getClientDetailData({ ...OWNER_PARAMS, notesViewAll: false });
    await getClientDetailData({ ...OWNER_PARAMS, notesViewAll: true });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("never returns fewer sensitive notes than exist regardless of notesViewAll", async () => {
    const withoutViewAll = await getClientDetailData({
      ...OWNER_PARAMS,
      notesViewAll: false,
    });
    const withViewAll = await getClientDetailData({
      ...OWNER_PARAMS,
      notesViewAll: true,
    });
    // The regular-notes cap toggles; the sensitive-notes defensive cap does not.
    expect(withoutViewAll.sensitiveNotes).toHaveLength(1);
    expect(withViewAll.sensitiveNotes).toHaveLength(1);
  });

  it("a caller without canViewSensitiveNoteQueue gets zero sensitive notes, same as before this step", async () => {
    const data = await getClientDetailData({
      ...OWNER_PARAMS,
      accessWithoutAssignment: { ...FULL_FLAGS, canViewSensitiveNoteQueue: false },
    });
    // hasAllClientAccess: true (from OWNER_PARAMS) means clientAccess is
    // always accessWithoutAssignment — canViewHealthNotes still true,
    // canViewSensitiveNoteQueue false: regular notes fetch, sensitive skipped
    // — including the new head-count and the criticalNote scan, both gated
    // the same way as the display list.
    expect(data.sensitiveNotes).toEqual([]);
    expect(data.sensitiveNotesTotal).toBe(0);
    expect(data.criticalNote).toBeNull();
    expect(data.regularNotes).toHaveLength(1);
  });

  it("keys separately per sensitiveNotesViewAll (the cap actually queried differs)", async () => {
    await getClientDetailData({ ...OWNER_PARAMS, sensitiveNotesViewAll: false });
    await getClientDetailData({ ...OWNER_PARAMS, sensitiveNotesViewAll: true });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("returns a true sensitive-notes head-count over the same is_sensitive=true predicate", async () => {
    const data = await getClientDetailData(OWNER_PARAMS);
    expect(data.sensitiveNotesTotal).toBe(1);
  });
});

// Fix round (verify-FAIL Check 1) — pins the property the FAIL was about:
// `criticalNote`'s correctness must NOT depend on `sensitiveNotes`' display
// cap. Each fixture below simulates the cap having already excluded the
// flagged note from `sensitiveNotes` (a short/unrelated capped list) while
// `criticalNote`'s own dedicated query still returns it — exactly the
// scenario a client with more than CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP
// sensitive notes would produce.
describe("getClientDetailData — criticalNote decoupled from the sensitiveNotes cap", () => {
  function stubWithNotes(
    sensitiveDisplayRows: unknown[],
    criticalCandidateRows: unknown[]
  ) {
    return createFakeAdminClient({
      clients: {
        data: {
          id: "c1",
          full_name: "Test Client",
          client_source: "web",
          created_at: "2026-01-02T09:30:00.000Z",
          updated_at: "2026-01-02T09:30:00.000Z",
          deleted_at: null,
        },
        error: null,
      },
      bookings: { data: [], error: null, count: 0 },
      booking_assignments: { data: [], error: null },
      client_notes: [
        { data: [], error: null }, // regular rows
        { data: null, error: null, count: 0 }, // regular head-count
        { data: sensitiveDisplayRows, error: null }, // sensitiveNotes (capped display rail)
        { data: null, error: null, count: 400 }, // sensitiveNotesTotal — the cap WAS hit
        { data: criticalCandidateRows, error: null }, // criticalNote's own query
      ],
      client_privacy_requests: { data: [], error: null },
      audit_logs: { data: [], error: null },
    });
  }

  it("fires even when the flagged note fell outside the capped display list", async () => {
    const flaggedNote = {
      id: "n-old-allergy",
      note: "Patient has a severe allergy to penicillin.",
      is_sensitive: true,
      created_at: "2020-01-01T09:00:00.000Z",
    };
    // `sensitiveNotes` (display rail) only contains a RECENT, unrelated note
    // — the flagged one is old enough to have aged out of the 300-cap. The
    // OLD code (`sensitiveNotes.find(...)`) would report `criticalNote: null`
    // here. `criticalNoteCandidatesQuery`'s own result still carries it.
    createSupabaseAdminClient.mockImplementation(() =>
      stubWithNotes(
        [
          {
            id: "n-recent",
            note: "Client rescheduled for next week.",
            is_sensitive: true,
            created_at: "2026-01-01T09:00:00.000Z",
          },
        ],
        [flaggedNote]
      )
    );
    const data = await getClientDetailData(OWNER_PARAMS);
    expect(data.sensitiveNotes.map((n) => n.id)).not.toContain("n-old-allergy");
    expect(data.criticalNote?.id).toBe("n-old-allergy");
  });

  it("is null when no candidate matches the exact pattern", async () => {
    createSupabaseAdminClient.mockImplementation(() =>
      stubWithNotes(
        [],
        [
          {
            id: "n-decoy",
            note: "Nothing concerning here, just a routine check-in.",
            is_sensitive: true,
            created_at: "2026-01-01T09:00:00.000Z",
          },
        ]
      )
    );
    const data = await getClientDetailData(OWNER_PARAMS);
    expect(data.criticalNote).toBeNull();
  });

  it("picks the most recent matching candidate when several match", async () => {
    createSupabaseAdminClient.mockImplementation(() =>
      stubWithNotes(
        [],
        [
          // Candidates are query-ordered newest-first, same as production.
          {
            id: "n-newer",
            note: "Please avoid citrus with this client.",
            is_sensitive: true,
            created_at: "2026-02-01T09:00:00.000Z",
          },
          {
            id: "n-older",
            note: "Do not administer without checking with GP first.",
            is_sensitive: true,
            created_at: "2025-01-01T09:00:00.000Z",
          },
        ]
      )
    );
    const data = await getClientDetailData(OWNER_PARAMS);
    expect(data.criticalNote?.id).toBe("n-newer");
  });
});

// Fix round (verify-FAIL Check 1) — keeps the SQL-side superset filter
// honest against the JS-side exact pattern: every string below matches
// CRITICAL_NOTE_PATTERN, so each MUST also contain at least one
// CRITICAL_NOTE_KEYWORDS substring (case-insensitive) — otherwise the SQL
// `ilike`-OR scan (built from the keyword list) could exclude a note the
// regex would flag, silently reintroducing the exact bug this fix closes.
describe("CRITICAL_NOTE_KEYWORDS stays a superset of CRITICAL_NOTE_PATTERN", () => {
  const sampleMatches = [
    "Client has a nut allergy.",
    "Known to be allergic to latex.",
    "History of allergies noted at intake.",
    "Family history of anaphyla noted at intake.",
    "Carries an epipen at all times.",
    "Deep tissue work is contraindic for this client.",
    "Urgent — call before next visit.",
    "Warning: previous adverse reaction.",
    "Do not use essential oils with this client.",
    "Avoid pressure on the left shoulder.",
  ];

  it.each(sampleMatches)("%s", (sample) => {
    expect(CRITICAL_NOTE_PATTERN.test(sample)).toBe(true);
    const lower = sample.toLowerCase();
    const coveredByKeyword = CRITICAL_NOTE_KEYWORDS.some((keyword) =>
      lower.includes(keyword)
    );
    expect(coveredByKeyword).toBe(true);
  });
});

// Owner-authorised widening (2026-08-03): the trailing `\b` on the whole
// alternation made `anaphyla` and `contraindic` match only as standalone
// words — which they never are in real clinical writing
// ("anaphylactic", "contraindicated") — so those two branches were
// effectively dead false negatives. Dropping the trailing `\b` (keeping the
// leading one) turns every branch into a prefix match instead.
describe("CRITICAL_NOTE_PATTERN — prefix widening (trailing \\b removed)", () => {
  it.each([
    "severe anaphylactic reaction",
    "history of anaphylaxis",
    "massage contraindicated due to DVT",
    "contraindication for deep tissue",
    "allergen exposure",
    "carries an EpiPen",
    "urgently review",
    "warnings from GP",
  ])(
    "now matches %j (previously a false negative under the trailing \\b)",
    (sample) => {
      expect(CRITICAL_NOTE_PATTERN.test(sample)).toBe(true);
    }
  );

  it.each([
    "allergy to latex",
    "allergic reaction",
    "known allergies",
    "do not use oils",
    "avoid the lower back",
  ])("still matches %j (no regression from the old whole-word form)", (sample) => {
    expect(CRITICAL_NOTE_PATTERN.test(sample)).toBe(true);
  });

  it.each([
    // "urgent" appears here, but not preceded by a word boundary (it's
    // "ins-urgent", not a standalone "urgent") — the widening drops the
    // TRAILING \b only; the LEADING \b still bounds the pattern against
    // unrelated words that merely embed a keyword substring mid-word.
    "The report describes an insurgent uprising.",
    // No keyword substring anywhere in this sentence at all — confirms the
    // widened pattern still doesn't fire on an ordinary, unremarkable note.
    "Client felt relaxed and enjoyed the session.",
  ])("does not match %j (the widening is bounded, not open-ended)", (sample) => {
    expect(CRITICAL_NOTE_PATTERN.test(sample)).toBe(false);
  });
});

// C-16 closeout — the blast radius the widening shipped without. Dropping the
// trailing `\b` loosened EVERY branch, not just the two dead ones, and on `do
// not` a prefix match inverts the branch's own meaning: "do nothing", "do
// notice", "do note" are ordinary notes that were tripping a clinical-safety
// banner. That branch — and only that branch — gets its `\b` back.
describe("CRITICAL_NOTE_PATTERN — the `do not` branch does not fire on benign prose", () => {
  it.each([
    "Client asked to do nothing more than light stretching this week.",
    "Please do notice the change in posture.",
    "Plan: continue current exercises, do nothing new this week.",
    "do note the tension across the shoulders",
    "Do noting of the session times, please.",
    "do nothing",
    "do notice",
    "do note",
  ])("does not match %j", (sample) => {
    expect(CRITICAL_NOTE_PATTERN.test(sample)).toBe(false);
  });

  it.each([
    "Do not use essential oils with this client.",
    "do not use oils",
    "DO NOT apply heat.",
    "Do not administer without checking with GP first.",
    "Instruction is clear: do not.",
    "do not, under any circumstances, use deep pressure",
  ])("still matches %j — the prohibition itself is untouched", (sample) => {
    expect(CRITICAL_NOTE_PATTERN.test(sample)).toBe(true);
  });
});

// Per-branch verdict, pinned. The other seven branches keep prefix matching on
// purpose: every extension they reach preserves the clinical meaning, and
// narrowing them would cost a false NEGATIVE on a safety banner — which this
// module's own header ranks as the worse failure of the two.
describe("CRITICAL_NOTE_PATTERN — the other branches keep their Owner-authorised prefix match", () => {
  it.each([
    // allerg — the widening's whole point; no benign English word starts here.
    "allergen exposure noted",
    "allergen-free oils only",
    "seen by an allergist last year",
    // anaphyla / contraindic — dead branches before the widening.
    "severe anaphylactic reaction",
    "history of anaphylaxis",
    "massage contraindicated due to DVT",
    "contraindication for deep tissue",
    // epipen
    "carries an EpiPen",
    // urgent / warning — "urgently"/"warnings" are the same instruction.
    "urgently review before the next visit",
    "warnings from GP on file",
    // avoid — "avoiding"/"avoidance of" are how this is actually written up;
    // a trailing \b here would silently stop matching them.
    "Avoiding the left shoulder due to injury.",
    "avoidance of pressure on the lower back",
    "avoids prone positioning",
  ])("matches %j", (sample) => {
    expect(CRITICAL_NOTE_PATTERN.test(sample)).toBe(true);
  });
});

// Mechanical version of the "superset" check above: instead of relying on
// hand-picked sample sentences (which silently stop catching drift the
// moment someone adds a branch without adding a matching sample), this
// parses the branches straight out of CRITICAL_NOTE_PATTERN's own regex
// source and checks EVERY one against CRITICAL_NOTE_KEYWORDS. A future edit
// that adds an alternation branch with no corresponding keyword, or removes
// a keyword a branch still depends on, fails HERE per-branch — hand
// verification is what let the original trailing-\b defect survive.
describe("CRITICAL_NOTE_PATTERN's branches are mechanically covered by CRITICAL_NOTE_KEYWORDS", () => {
  function extractFlatAlternationBranches(pattern: RegExp): string[] {
    // Expects the exact shape `\b(branch1|branch2|...)` — a single leading
    // \b, one flat (non-nested) alternation group, nothing after the close
    // paren. If the pattern's shape changes (trailing \b comes back, a
    // branch grows a nested group, etc.) this throws instead of silently
    // mis-parsing, so the failure below is loud and points at this test.
    const flatAlternation = pattern.source.match(/^\\b\(([^()]*)\)$/);
    if (!flatAlternation) {
      throw new Error(
        "CRITICAL_NOTE_PATTERN's source is no longer a single flat " +
          "`\\b(a|b|c)` alternation with no trailing \\b — update this " +
          `test's parser before trusting its per-branch coverage check. ` +
          `Actual source: ${pattern.source}`
      );
    }
    return flatAlternation[1].split("|");
  }

  it("parses into a flat, non-nested alternation of literal branches", () => {
    expect(() => extractFlatAlternationBranches(CRITICAL_NOTE_PATTERN)).not.toThrow();
  });

  // Computed at collection time (needed for it.each below); falls back to an
  // empty list if parsing fails, so a shape change reads as the dedicated
  // "parses into a flat..." test above failing, not a collection-time crash
  // that would also blank out unrelated tests in this file.
  let branches: string[] = [];
  try {
    branches = extractFlatAlternationBranches(CRITICAL_NOTE_PATTERN);
  } catch {
    branches = [];
  }

  it.each(branches)(
    "branch %j is itself matched by CRITICAL_NOTE_PATTERN",
    (branch) => {
      // Every current branch is a plain literal (no regex metacharacters),
      // so a branch's own text is the minimal string it matches — this also
      // exercises the leading \b anchor.
      expect(CRITICAL_NOTE_PATTERN.test(branch)).toBe(true);
    }
  );

  it.each(branches)(
    "branch %j contains a CRITICAL_NOTE_KEYWORDS substring (the superset property)",
    (branch) => {
      // Appending characters after a matching prefix can only ever add
      // substring occurrences, never remove the one already present in the
      // branch's own literal text — so checking this minimal string proves
      // the property for every longer string the branch can match too.
      const lower = branch.toLowerCase();
      const coveredByKeyword = CRITICAL_NOTE_KEYWORDS.some((keyword) =>
        lower.includes(keyword)
      );
      expect(coveredByKeyword).toBe(true);
    }
  );
});

// Fix round (verify-FAIL Check 1) — `sensitiveNotes`' own hidden-rows signal,
// mirroring `resolveClientNotesBannerState`'s tests exactly (same branch
// order, same sabotage shape: `cappedOut` must be checked BEFORE `hidden`).
describe("resolveClientSensitiveNotesBannerState", () => {
  it("is 'none' when nothing is hidden and not viewing all", () => {
    expect(
      resolveClientSensitiveNotesBannerState({
        sensitiveTotal: 2,
        sensitiveShown: 2,
        viewAll: false,
      })
    ).toEqual({ kind: "none" });
  });

  it("is 'hidden' when the default cap is truncating", () => {
    expect(
      resolveClientSensitiveNotesBannerState({
        sensitiveTotal: CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP + 10,
        sensitiveShown: CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP,
        viewAll: false,
      })
    ).toEqual({ kind: "hidden", total: CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP + 10 });
  });

  it("is 'viewingAll' when the view-all cap covers everything", () => {
    expect(
      resolveClientSensitiveNotesBannerState({
        sensitiveTotal: CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP + 10,
        sensitiveShown: CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP + 10,
        viewAll: true,
      })
    ).toEqual({ kind: "viewingAll", total: CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP + 10 });
  });

  it("SABOTAGE TARGET — is 'cappedOut', not 'hidden', once already viewing all and the total still exceeds the view-all cap", () => {
    // Already viewing all AND the true total exceeds the view-all cap itself
    // — the exact bug shape that shipped twice before this plan. If `hidden`
    // were checked first, this would link back to the same already-active
    // `sensitiveNotes=all` state.
    const result = resolveClientSensitiveNotesBannerState({
      sensitiveTotal: CLIENT_SENSITIVE_NOTES_VIEW_ALL_CAP + 25,
      sensitiveShown: CLIENT_SENSITIVE_NOTES_VIEW_ALL_CAP,
      viewAll: true,
    });
    expect(result.kind).toBe("cappedOut");
    expect(result).toEqual({
      kind: "cappedOut",
      total: CLIENT_SENSITIVE_NOTES_VIEW_ALL_CAP + 25,
    });
  });
});

// C-16 Step 14 (N6) — mirrors password-requests' resolvePasswordRequestsBannerState
// tests (commit 6fa19ce). This is the branch order that shipped broken twice
// before this plan (privacy's notes rail, then password-requests): `cappedOut`
// MUST be evaluated before `hidden`, or "view all N" becomes a dead link once
// the true total exceeds the view-all cap itself.
describe("resolveClientNotesBannerState", () => {
  it("is 'none' when nothing is hidden and not viewing all", () => {
    expect(
      resolveClientNotesBannerState({ regularTotal: 5, regularShown: 5, viewAll: false })
    ).toEqual({ kind: "none" });
  });

  it("is 'hidden' when the default cap is truncating", () => {
    expect(
      resolveClientNotesBannerState({
        regularTotal: CLIENT_NOTES_LIMIT + 10,
        regularShown: CLIENT_NOTES_LIMIT,
        viewAll: false,
      })
    ).toEqual({ kind: "hidden", total: CLIENT_NOTES_LIMIT + 10 });
  });

  it("is 'viewingAll' when the view-all cap covers everything", () => {
    expect(
      resolveClientNotesBannerState({
        regularTotal: CLIENT_NOTES_LIMIT + 10,
        regularShown: CLIENT_NOTES_LIMIT + 10,
        viewAll: true,
      })
    ).toEqual({ kind: "viewingAll", total: CLIENT_NOTES_LIMIT + 10 });
  });

  it("SABOTAGE TARGET — is 'cappedOut', not 'hidden', once view-all itself is truncating", () => {
    // The exact scenario that shipped broken twice: already viewing all AND
    // the true total exceeds the view-all cap. If `hidden` were checked
    // first (the bug's shape), this would return `hidden` with a link back
    // to the same already-active `all=1` state — a dead "view all" link.
    const result = resolveClientNotesBannerState({
      regularTotal: CLIENT_NOTES_VIEW_ALL_CAP + 25,
      regularShown: CLIENT_NOTES_VIEW_ALL_CAP,
      viewAll: true,
    });
    expect(result.kind).toBe("cappedOut");
    expect(result).toEqual({ kind: "cappedOut", total: CLIENT_NOTES_VIEW_ALL_CAP + 25 });
  });

  it("does not let a small sensitive-note count push cappedOut early (regularTotal only, never combined)", () => {
    // Regression guard for the bug caught during implementation: comparing a
    // COMBINED (sensitive + regular) total against CLIENT_NOTES_VIEW_ALL_CAP
    // would falsely report cappedOut here even though every regular note is
    // shown. The function only ever sees `regularTotal`/`regularShown`.
    const result = resolveClientNotesBannerState({
      regularTotal: CLIENT_NOTES_VIEW_ALL_CAP - 5,
      regularShown: CLIENT_NOTES_VIEW_ALL_CAP - 5,
      viewAll: true,
    });
    expect(result.kind).toBe("viewingAll");
  });
});
