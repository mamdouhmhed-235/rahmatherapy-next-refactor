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
  resolveClientNotesBannerState,
  resolveClientSensitiveNotesBannerState,
  CLIENT_NOTES_LIMIT,
  CLIENT_NOTES_VIEW_ALL_CAP,
  CLIENT_SENSITIVE_NOTES_DEFENSIVE_CAP,
  CLIENT_SENSITIVE_NOTES_VIEW_ALL_CAP,
  CRITICAL_NOTE_KEYWORDS,
  CRITICAL_NOTE_PATTERN,
} = await import("../client-detail-data");
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

  it("keys separately per limit/offset on the booking history", async () => {
    await getClientDetailData({ ...OWNER_PARAMS, limit: 20, offset: 0 });
    await getClientDetailData({ ...OWNER_PARAMS, limit: 20, offset: 20 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    await getClientDetailData({ ...OWNER_PARAMS, limit: 20, offset: 20 });
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
