// C-09 Phase C Step 7 — cache behaviour for /admin/emails' data helper.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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

const getTemplateOverrideSummaries = vi.fn(async () => ({
  booking_confirmation: { updatedAt: "2026-01-02T09:30:00.000Z", updatedBy: "s1" },
}));
vi.mock("@/lib/email/templates", () => ({
  getTemplateOverrideSummaries: () => getTemplateOverrideSummaries(),
}));

const { createFakeAdminClient } = await import(
  "@/lib/cache/__tests__/fake-supabase-admin"
);
const {
  getEmailsPageData,
  getFilteredDeliveryEvents,
  countEmailDeliveryEvents,
  getEmailDeliveryPage,
  getReviewRequestCandidates,
  resolveDeliveryDateBounds,
} = await import("../emails-data");
const { TAGS } = await import("@/lib/cache/tag-taxonomy");

const BASE_PARAMS = {
  canSeeDelivery: true,
  canResend: true,
  canSeeAllBookings: true,
  staffId: "s1",
  businessDate: "2026-01-02",
  includeTemplates: false,
};

function stubClient() {
  return createFakeAdminClient({
    email_delivery_events: {
      data: [
        {
          id: "ev1",
          booking_id: "b1",
          staff_id: null,
          event_type: "booking_reminder",
          recipient_email: "someone@example.test",
          recipient_role: "customer",
          delivery_status: "delivered",
          provider_message_id: null,
          error_message: null,
          created_at: "2026-01-02T09:30:00.000Z",
        },
      ],
      error: null,
      count: 250,
    },
    bookings: {
      data: [
        {
          id: "b1",
          booking_date: "2026-01-03",
          start_time: "10:00",
          contact_full_name: "Test Client",
          contact_email: "someone@example.test",
          status: "confirmed",
        },
      ],
      error: null,
    },
    booking_assignments: { data: [{ booking_id: "b1" }], error: null },
    staff_profiles: { data: [{ id: "s1", name: "Owner" }], error: null },
  });
}

beforeEach(() => {
  cacheHarness.clear();
  createSupabaseAdminClient.mockReset();
  createSupabaseAdminClient.mockImplementation(() => stubClient());
  getTemplateOverrideSummaries.mockClear();
});

describe("getEmailsPageData cache behaviour", () => {
  it("runs the fetcher on a cache miss", async () => {
    const data = await getEmailsPageData(BASE_PARAMS);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(data.events).toHaveLength(1);
    expect(data.reminderBookings).toHaveLength(1);
    expect(data.deliveryError).toBeNull();
  });

  it("does not re-run the fetcher on a cache hit", async () => {
    await getEmailsPageData(BASE_PARAMS);
    await getEmailsPageData(BASE_PARAMS);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it("re-runs the fetcher after the emails tag is invalidated", async () => {
    await getEmailsPageData(BASE_PARAMS);
    cacheHarness.invalidateTag(TAGS.EMAILS);
    await getEmailsPageData(BASE_PARAMS);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("keys separately per permission scope", async () => {
    await getEmailsPageData(BASE_PARAMS);
    await getEmailsPageData({ ...BASE_PARAMS, canSeeAllBookings: false });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("keys separately per business date, so the day boundary is not frozen", async () => {
    await getEmailsPageData(BASE_PARAMS);
    await getEmailsPageData({ ...BASE_PARAMS, businessDate: "2026-01-03" });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("keys separately per limit/offset, so page 2 never serves page 1", async () => {
    await getEmailsPageData({ ...BASE_PARAMS, limit: 100, offset: 0 });
    await getEmailsPageData({ ...BASE_PARAMS, limit: 100, offset: 100 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    await getEmailsPageData({ ...BASE_PARAMS, limit: 100, offset: 100 });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("only reads the template lookups when the Templates tab asked for them", async () => {
    await getEmailsPageData(BASE_PARAMS);
    expect(getTemplateOverrideSummaries).not.toHaveBeenCalled();
    const data = await getEmailsPageData({ ...BASE_PARAMS, includeTemplates: true });
    expect(getTemplateOverrideSummaries).toHaveBeenCalledTimes(1);
    expect(data.templateStaff).toEqual([{ id: "s1", name: "Owner" }]);
  });

  it("returns a JSON-safe shape (template staff is an array, not a Map)", async () => {
    const data = await getEmailsPageData({ ...BASE_PARAMS, includeTemplates: true });
    expect(Array.isArray(data.templateStaff)).toBe(true);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it("caches the companion count path under its own key", async () => {
    await expect(countEmailDeliveryEvents()).resolves.toBe(250);
    await countEmailDeliveryEvents();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });
});

// C-09 Phase D Step 11 — getFilteredDeliveryEvents is a second, focused
// fetcher (see emails-data.ts's FILTERS note); its own filter wiring keys
// separately, so a caller filtering to delivery_status=failed can never be
// served a cache entry built for another status.
describe("getFilteredDeliveryEvents filter-wiring cache behaviour", () => {
  const DEFAULT_FILTERS = { range: "last_30_days" as const };

  it("short-circuits without a Supabase call when the caller can't see delivery", async () => {
    const data = await getFilteredDeliveryEvents({
      canSeeDelivery: false,
      filters: DEFAULT_FILTERS,
    });
    expect(data).toEqual({ events: [], deliveryError: null });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("runs the fetcher on a cache miss", async () => {
    const data = await getFilteredDeliveryEvents({
      canSeeDelivery: true,
      filters: DEFAULT_FILTERS,
    });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(data.events).toHaveLength(1);
    expect(data.deliveryError).toBeNull();
  });

  it("does not re-run the fetcher on a cache hit", async () => {
    await getFilteredDeliveryEvents({ canSeeDelivery: true, filters: DEFAULT_FILTERS });
    await getFilteredDeliveryEvents({ canSeeDelivery: true, filters: DEFAULT_FILTERS });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it("keys separately per event_type/delivery_status/recipient_role/q filter", async () => {
    await getFilteredDeliveryEvents({
      canSeeDelivery: true,
      filters: { ...DEFAULT_FILTERS, event_type: "booking_reminder" },
    });
    await getFilteredDeliveryEvents({
      canSeeDelivery: true,
      filters: { ...DEFAULT_FILTERS, delivery_status: "failed" },
    });
    await getFilteredDeliveryEvents({
      canSeeDelivery: true,
      filters: { ...DEFAULT_FILTERS, recipient_role: "staff" },
    });
    await getFilteredDeliveryEvents({
      canSeeDelivery: true,
      filters: { ...DEFAULT_FILTERS, q: "someone" },
    });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(4);
  });

  it("keys separately per date-range preset, so the boundary is not frozen", async () => {
    await getFilteredDeliveryEvents({
      canSeeDelivery: true,
      filters: { range: "today" },
    });
    await getFilteredDeliveryEvents({
      canSeeDelivery: true,
      filters: { range: "last_7_days" },
    });
    await getFilteredDeliveryEvents({
      canSeeDelivery: true,
      filters: { range: "custom", from: "2026-01-01", to: "2026-01-10" },
    });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(3);
  });

  it("re-runs a filtered call after the emails tag is invalidated", async () => {
    await getFilteredDeliveryEvents({ canSeeDelivery: true, filters: DEFAULT_FILTERS });
    cacheHarness.invalidateTag(TAGS.EMAILS);
    await getFilteredDeliveryEvents({ canSeeDelivery: true, filters: DEFAULT_FILTERS });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("returns a JSON-safe shape", async () => {
    const data = await getFilteredDeliveryEvents({
      canSeeDelivery: true,
      filters: DEFAULT_FILTERS,
    });
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  // C-09 Phase D fix round — a malformed custom from/to used to hit
  // `.toISOString()` on an Invalid Date and throw RangeError, 500ing the
  // whole page. Malformed input must fall back to "no bound" instead.
  it("does not throw on a malformed custom `from` and ignores it", async () => {
    const data = await getFilteredDeliveryEvents({
      canSeeDelivery: true,
      filters: { range: "custom", from: "not-a-date", to: "2026-01-10" },
    });
    expect(data.deliveryError).toBeNull();
  });

  it("does not throw on a malformed custom `to` and ignores it", async () => {
    const data = await getFilteredDeliveryEvents({
      canSeeDelivery: true,
      filters: { range: "custom", from: "2026-01-01", to: "not-a-date" },
    });
    expect(data.deliveryError).toBeNull();
  });
});

// C-09 Phase D fix round — PostgREST's `.or(...)` argument is forwarded to
// the URL verbatim (postgrest-js does no escaping of its own); reserved
// characters (comma, parens) inside a value must be handled by wrapping the
// WHOLE value in double quotes, not by backslash-prefixing them unquoted.
// `createFakeAdminClient`'s chain doesn't record `.or()` calls, so this uses
// a local recording stub to assert on the exact generated filter string.
describe("getFilteredDeliveryEvents q-filter or() string", () => {
  it("quotes the whole needle so an embedded comma and parenthesis survive", async () => {
    const orCalls: string[] = [];
    const chain: {
      select: () => typeof chain;
      order: () => typeof chain;
      or: (filters: string) => typeof chain;
      gte: () => typeof chain;
      lte: () => typeof chain;
      range: () => typeof chain;
      returns: () => Promise<{ data: unknown[]; error: null }>;
    } = {
      select: () => chain,
      order: () => chain,
      or: (filters) => {
        orCalls.push(filters);
        return chain;
      },
      gte: () => chain,
      lte: () => chain,
      range: () => chain,
      returns: async () => ({ data: [], error: null }),
    };
    createSupabaseAdminClient.mockImplementation(() => ({ from: () => chain }));

    await getFilteredDeliveryEvents({
      canSeeDelivery: true,
      filters: { range: "last_30_days", q: "Smith, John (Jr.)" },
    });

    const needle = `"%Smith, John (Jr.)%"`;
    expect(orCalls).toEqual([
      [
        `recipient_email.ilike.${needle}`,
        `provider_message_id.ilike.${needle}`,
        `id.ilike.${needle}`,
      ].join(","),
    ]);
  });
});

// C-16 Phase D Step 9 — the date-bounds resolution used to read `Date.now()`
// at millisecond precision, which meant two calls a moment apart (the count
// query and the rows query, once a count query existed) could disagree about
// the window. This must fail if ms-precision `Date.now()` is reintroduced.
describe("resolveDeliveryDateBounds stability", () => {
  it.each(["today", "last_7_days", "last_30_days"] as const)(
    "resolves %s identically across two calls in the same request",
    (range) => {
      const first = resolveDeliveryDateBounds({ range });
      const second = resolveDeliveryDateBounds({ range });
      expect(second).toEqual(first);
    }
  );

  it("resolves the default (no range) preset identically across two calls", () => {
    const first = resolveDeliveryDateBounds({});
    const second = resolveDeliveryDateBounds({});
    expect(second).toEqual(first);
  });
});

// Fix round (verify-FAIL on commit dc26dc0) — the stability suite above would
// pass unchanged with a wrong-but-stable `fromIso`, which is exactly how the
// "today" regression (resolved to the start of YESTERDAY) got through. These
// pin the EXACT `fromIso` each preset produces for a fixed, non-midnight
// clock, so a wrong offset fails even though it's still stable across calls.
// "Today" = the current calendar day (`todayStart`). "Last 7/30 days" = that
// many calendar days up to and including today (`todayStart - 6`/`29 * day`)
// — the conventional dashboard reading, and internally coherent with "Today"
// meaning today rather than "today excluded".
describe("resolveDeliveryDateBounds correctness (fixed clock)", () => {
  const FIXED_NOW = "2026-01-15T15:42:07.123Z";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIXED_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('"today" resolves to the start of TODAY, not yesterday', () => {
    expect(resolveDeliveryDateBounds({ range: "today" })).toEqual({
      fromIso: "2026-01-15T00:00:00.000Z",
    });
  });

  it('"last_7_days" resolves to 7 calendar days including today', () => {
    expect(resolveDeliveryDateBounds({ range: "last_7_days" })).toEqual({
      fromIso: "2026-01-09T00:00:00.000Z",
    });
  });

  it('"last_30_days" resolves to 30 calendar days including today', () => {
    expect(resolveDeliveryDateBounds({ range: "last_30_days" })).toEqual({
      fromIso: "2025-12-17T00:00:00.000Z",
    });
  });

  it("the default (no range) preset matches last_30_days", () => {
    expect(resolveDeliveryDateBounds({})).toEqual({
      fromIso: "2025-12-17T00:00:00.000Z",
    });
  });
});

// C-16 Phase D Step 9 — `countEmailDeliveryEvents` and `getFilteredDeliveryEvents`
// must build their WHERE clause from the exact same filters, so the pager's
// total can never describe a different query than the rows it's paginating.
describe("countEmailDeliveryEvents honours the same filters as getFilteredDeliveryEvents", () => {
  it("applies the identical eq/or/gte/lte sequence to the count query and the rows query", async () => {
    const filters = {
      event_type: "booking_reminder",
      delivery_status: "failed",
      recipient_role: "customer" as const,
      q: "Smith",
      range: "last_7_days" as const,
    };

    function recordingChain(calls: string[]) {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.order = () => chain;
      chain.eq = (column: string, value: string) => {
        calls.push(`eq:${column}:${value}`);
        return chain;
      };
      chain.or = (filterString: string) => {
        calls.push(`or:${filterString}`);
        return chain;
      };
      chain.gte = (column: string, value: string) => {
        calls.push(`gte:${column}:${value}`);
        return chain;
      };
      chain.lte = (column: string, value: string) => {
        calls.push(`lte:${column}:${value}`);
        return chain;
      };
      chain.range = () => chain;
      chain.returns = async () => ({ data: [], error: null });
      chain.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ count: 0, error: null }).then(resolve);
      return chain;
    }

    const countCalls: string[] = [];
    createSupabaseAdminClient.mockImplementation(() => ({
      from: () => recordingChain(countCalls),
    }));
    await countEmailDeliveryEvents(filters);

    cacheHarness.clear();
    const rowCalls: string[] = [];
    createSupabaseAdminClient.mockImplementation(() => ({
      from: () => recordingChain(rowCalls),
    }));
    await getFilteredDeliveryEvents({ canSeeDelivery: true, filters });

    expect(countCalls.length).toBeGreaterThan(0);
    expect(countCalls).toEqual(rowCalls);
  });
});

describe("getEmailDeliveryPage", () => {
  it("clamps a stale ?page=99 to the last real page", async () => {
    // stubClient's email_delivery_events count is 250; LOG_PAGE_SIZE (100) => 3 pages.
    const result = await getEmailDeliveryPage({
      canSeeDelivery: true,
      filters: {},
      page: 99,
    });
    expect(result.pageCount).toBe(3);
    expect(result.page).toBe(3);
    expect(result.total).toBe(250);
  });

  it("computes pageCount 1 (pager renders nothing) when the total fits on one page", async () => {
    createSupabaseAdminClient.mockImplementation(() =>
      createFakeAdminClient({
        email_delivery_events: { data: [], error: null, count: 12 },
      })
    );
    const result = await getEmailDeliveryPage({ canSeeDelivery: true, filters: {} });
    expect(result.pageCount).toBe(1);
    expect(result.page).toBe(1);
    expect(result.total).toBe(12);
  });

  it("short-circuits without a query when the caller can't see delivery", async () => {
    const result = await getEmailDeliveryPage({ canSeeDelivery: false, filters: {} });
    expect(result).toEqual({
      rows: [],
      total: 0,
      page: 1,
      pageCount: 1,
      deliveryError: null,
    });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });
});

// ─── Item 1 Batch B — getReviewRequestCandidates ──────────────────────────────

const REVIEW_PARAMS = {
  canResend: true,
  canSeeAllBookings: true,
  staffId: "s1",
};

function reviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    booking_date: "2026-01-03",
    start_time: "10:00",
    completed_at: "2026-01-03T11:00:00.000Z",
    contact_full_name: "Test Client",
    contact_email: "someone@example.test",
    clients: null,
    ...overrides,
  };
}

describe("getReviewRequestCandidates", () => {
  it("returns completed bookings with a recipient and no review_email_sent_at, for the manual review-send list", async () => {
    createSupabaseAdminClient.mockImplementation(() =>
      createFakeAdminClient({
        bookings: {
          data: [
            reviewRow({ id: "own-email" }),
            // Embed arrives as an object on some PostgREST paths...
            reviewRow({
              id: "client-email-object",
              contact_email: null,
              clients: { email: "viaclient@example.test" },
            }),
            // ...and as a single-element array on others.
            reviewRow({
              id: "client-email-array",
              contact_email: null,
              clients: [{ email: "viaarray@example.test" }],
            }),
            // An empty-string contact_email must fall through to the client's
            // address, exactly as sendReviewRequestEmail's `||` does.
            reviewRow({
              id: "empty-string-contact",
              contact_email: "",
              clients: { email: "fallback@example.test" },
            }),
            // No recipient anywhere — must not be offered.
            reviewRow({ id: "no-recipient", contact_email: null, clients: null }),
            reviewRow({
              id: "null-client-email",
              contact_email: null,
              clients: { email: null },
            }),
          ],
          error: null,
        },
      })
    );

    const rows = await getReviewRequestCandidates(REVIEW_PARAMS);

    expect(rows.map((r) => r.id)).toEqual([
      "own-email",
      "client-email-object",
      "client-email-array",
      "empty-string-contact",
    ]);
    expect(rows.map((r) => r.recipient_email)).toEqual([
      "someone@example.test",
      "viaclient@example.test",
      "viaarray@example.test",
      "fallback@example.test",
    ]);
  });

  it("returns nothing, without querying, for a caller who can't resend", async () => {
    const rows = await getReviewRequestCandidates({
      ...REVIEW_PARAMS,
      canResend: false,
    });

    expect(rows).toEqual([]);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns nothing for a scoped therapist with no assignments, without reading bookings", async () => {
    const fake = createFakeAdminClient({
      booking_assignments: { data: [], error: null },
    });
    createSupabaseAdminClient.mockImplementation(() => fake);

    const rows = await getReviewRequestCandidates({
      ...REVIEW_PARAMS,
      canSeeAllBookings: false,
    });

    expect(rows).toEqual([]);
    expect(fake.fromCalls).toEqual(["booking_assignments"]);
  });

  it("scopes a therapist to their own assigned bookings", async () => {
    const fake = createFakeAdminClient({
      booking_assignments: { data: [{ booking_id: "b1" }], error: null },
      bookings: { data: [reviewRow()], error: null },
    });
    createSupabaseAdminClient.mockImplementation(() => fake);

    const rows = await getReviewRequestCandidates({
      ...REVIEW_PARAMS,
      canSeeAllBookings: false,
    });

    expect(rows).toHaveLength(1);
    expect(fake.fromCalls).toEqual(["booking_assignments", "bookings"]);
  });

  it("keys its cache separately per scope, so one staff member's list is never served to another", async () => {
    const first = await getReviewRequestCandidates(REVIEW_PARAMS);
    const second = await getReviewRequestCandidates({
      ...REVIEW_PARAMS,
      staffId: "s2",
    });

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  // ⛔ Gotcha 39. `createFakeAdminClient`'s chain methods are all `() => chain`
  // — `select`, `eq`, `is`, `in`, `order` and `limit` are pure no-ops that
  // never touch the registered result. So every predicate below could be
  // deleted with all four behavioural tests above still green, while
  // production silently offered cancelled bookings, or ones already asked.
  // Only reading the source catches it.
  describe("source-text guards for predicates no stub can honour", () => {
    function reviewSource() {
      const source = readFileSync(
        join(process.cwd(), "src/app/admin/emails/emails-data.ts"),
        "utf8"
      );
      const open = "const REVIEW_CANDIDATE_SELECT";
      const close = "export interface EmailDeliveryFilters";
      // Assert each cut anchor is unique before slicing, so this guard can
      // never quietly measure the wrong region of the file.
      expect(source.split(open)).toHaveLength(2);
      expect(source.split(close)).toHaveLength(2);
      return source.split(open)[1].split(close)[0];
    }

    it("filters to completed bookings that have not been asked yet", () => {
      const region = reviewSource();
      expect(region).toContain('.eq("status", "completed")');
      expect(region).toContain('.is("review_email_sent_at", null)');
    });

    it("selects the embedded client email the recipient fallback depends on", () => {
      const region = reviewSource();
      expect(region).toContain("clients(email)");
      expect(region).toContain("contact_email");
    });

    it("does not filter by the client cooldown, which the manual send exists to override", () => {
      const region = reviewSource();
      expect(region).not.toContain("email_delivery_events");
      expect(region).not.toContain("delivery_status");
    });

    // The recipient filter runs in JS AFTER the row limit, so fetching exactly
    // the display limit would let recipient-less rows crowd out eligible ones.
    // The fake admin client ignores `.limit()` entirely, so no behavioural test
    // can catch the multiplier being dropped — only the source can.
    it("over-fetches past the display limit so the JS recipient filter cannot starve the list", () => {
      const region = reviewSource();
      expect(region).toContain(".limit(REVIEW_CANDIDATE_LIMIT * 2)");
      expect(region).toContain(".slice(0, REVIEW_CANDIDATE_LIMIT)");
    });
  });
});
