// C-16 Phase D Step 12 — /admin/account-password-requests verdict: cap +
// view-all, not a full pager (see the reasoning comment atop
// password-requests-data.ts). Phase A found two real defects on this
// surface: the query carried NO bound at all, and it wasn't cache-wrapped.
// This spec pins both fixes: the query is now capped (and the cap is real —
// `.limit()` receives PASSWORD_REQUESTS_LIMIT / PASSWORD_REQUESTS_VIEW_ALL_CAP),
// and the fetch no longer re-runs on every render.
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
  getPasswordResetRequests,
  countPasswordResetRequests,
  PASSWORD_REQUESTS_LIMIT,
  PASSWORD_REQUESTS_VIEW_ALL_CAP,
} = await import("../password-requests-data");
const { TAGS } = await import("@/lib/cache/tag-taxonomy");

interface RawRow {
  id: string;
  staff_id: string;
  status: "pending" | "approved" | "rejected" | "expired" | "used";
  requested_at: string;
  created_at: string;
  expires_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_note: string | null;
}

const REQUEST_ROW: RawRow = {
  id: "req-1",
  staff_id: "staff-1",
  status: "pending",
  requested_at: "2026-01-02T09:00:00.000Z",
  created_at: "2026-01-02T09:00:00.000Z",
  expires_at: "2026-01-03T09:00:00.000Z",
  reviewed_at: null,
  reviewed_by: null,
  reviewer_note: null,
};

/**
 * Bespoke fake client (not the shared `createFakeAdminClient`, which has no
 * `.auth.admin.listUsers` and cannot distinguish a `.limit()`-terminated list
 * query from a `{count, head: true}` count query on the SAME table): the
 * list query always terminates with `.returns()`, the count query is always
 * awaited directly (`.then()`), so routing on the terminal call is
 * unambiguous. `limitCalls` records every `.limit(n)` invocation so specs can
 * assert the REAL cap value reached the query.
 */
function fakeClient(opts: {
  requests?: RawRow[];
  requestsError?: unknown;
  staff?: { id: string; name: string | null; auth_user_id: string }[];
  users?: { id: string; email: string }[];
  count?: number;
  countError?: unknown;
  limitCalls?: number[];
}) {
  const {
    requests = [],
    requestsError = null,
    staff = [],
    users = [],
    count = requests.length,
    countError = null,
    limitCalls = [],
  } = opts;

  return {
    from(table: string) {
      if (table === "staff_profiles") {
        const c: Record<string, unknown> = {};
        c.select = () => c;
        c.in = () => c;
        c.returns = async () => ({ data: staff, error: null });
        return c;
      }
      // account_password_requests — list path terminates in `.returns()`;
      // count path is awaited directly, invoking `.then()`.
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.order = () => c;
      c.eq = () => c;
      c.limit = (n: number) => {
        limitCalls.push(n);
        return c;
      };
      c.returns = async () => ({ data: requests, error: requestsError });
      c.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ count, error: countError }).then(resolve, reject);
      return c;
    },
    auth: {
      admin: {
        listUsers: async () => ({
          data: { users },
          error: null,
        }),
      },
    },
  };
}

beforeEach(() => {
  cacheHarness.clear();
  createSupabaseAdminClient.mockReset();
});

describe("getPasswordResetRequests — cap (C-16 Step 12 verdict: cap + view-all)", () => {
  it("caps the query at PASSWORD_REQUESTS_LIMIT by default", async () => {
    const limitCalls: number[] = [];
    createSupabaseAdminClient.mockImplementation(() =>
      fakeClient({ requests: [REQUEST_ROW], limitCalls })
    );
    await getPasswordResetRequests();
    expect(limitCalls).toEqual([PASSWORD_REQUESTS_LIMIT]);
  });

  it("raises the cap to PASSWORD_REQUESTS_VIEW_ALL_CAP when viewAll is set", async () => {
    const limitCalls: number[] = [];
    createSupabaseAdminClient.mockImplementation(() =>
      fakeClient({ requests: [REQUEST_ROW], limitCalls })
    );
    await getPasswordResetRequests({ viewAll: true });
    expect(limitCalls).toEqual([PASSWORD_REQUESTS_VIEW_ALL_CAP]);
  });

  it("maps a row through the staff + auth lookups to a full PasswordResetRequest", async () => {
    createSupabaseAdminClient.mockImplementation(() =>
      fakeClient({
        requests: [REQUEST_ROW],
        staff: [{ id: "staff-1", name: "Amina K", auth_user_id: "auth-1" }],
        users: [{ id: "auth-1", email: "amina@example.test" }],
      })
    );
    const [row] = await getPasswordResetRequests();
    expect(row).toMatchObject({
      id: "req-1",
      email: "amina@example.test",
      status: "pending",
    });
  });

  it("returns an empty array (not a throw) when the query errors", async () => {
    createSupabaseAdminClient.mockImplementation(() =>
      fakeClient({ requests: [], requestsError: { message: "boom" } })
    );
    await expect(getPasswordResetRequests()).resolves.toEqual([]);
  });
});

describe("getPasswordResetRequests — cache wrapping (Phase A finding N5 fix)", () => {
  it("was NOT cache-wrapped before this step; now does not re-run the fetcher on a cache hit", async () => {
    createSupabaseAdminClient.mockImplementation(() => fakeClient({ requests: [REQUEST_ROW] }));
    await getPasswordResetRequests();
    await getPasswordResetRequests();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });

  it("keys the default fetch and the view-all fetch separately", async () => {
    createSupabaseAdminClient.mockImplementation(() => fakeClient({ requests: [REQUEST_ROW] }));
    await getPasswordResetRequests({ viewAll: false });
    await getPasswordResetRequests({ viewAll: true });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    await getPasswordResetRequests({ viewAll: true });
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it.each([TAGS.AUDIT, TAGS.STAFF])(
    "re-runs the fetcher after the %s tag is invalidated",
    async (tag) => {
      createSupabaseAdminClient.mockImplementation(() => fakeClient({ requests: [REQUEST_ROW] }));
      await getPasswordResetRequests();
      cacheHarness.invalidateTag(tag);
      await getPasswordResetRequests();
      expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    }
  );
});

describe("countPasswordResetRequests — real total, independent of the row cap", () => {
  it("reports the true table total even when it exceeds PASSWORD_REQUESTS_LIMIT", async () => {
    createSupabaseAdminClient.mockImplementation(() =>
      fakeClient({ requests: [REQUEST_ROW], count: 250 })
    );
    await expect(countPasswordResetRequests()).resolves.toBe(250);
  });

  it("keys the unfiltered total and a status-filtered count separately", async () => {
    createSupabaseAdminClient.mockImplementation(() =>
      fakeClient({ requests: [], count: 3 })
    );
    await countPasswordResetRequests();
    await countPasswordResetRequests("pending");
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
    await countPasswordResetRequests("pending");
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(2);
  });

  it("does not re-run on a cache hit (this count was also uncached before this step)", async () => {
    createSupabaseAdminClient.mockImplementation(() =>
      fakeClient({ requests: [], count: 3 })
    );
    await countPasswordResetRequests();
    await countPasswordResetRequests();
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
  });
});
