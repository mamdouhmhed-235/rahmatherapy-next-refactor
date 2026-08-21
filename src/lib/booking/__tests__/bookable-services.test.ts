// ⛔ D-033 / PR-011 / FIND-03-B — a service hidden in the admin must not be
// bookable ANYWHERE, while keeping its marketing page.
//
// Owner ruling, verbatim: "if a service is hidden from the admin site then it
// shouldnt be bookable from the customer create booking page at all, its cards
// and info may still show on the frontend customer facing pages but not in the
// create booking page itself and it should not show nor be bookable. … should
// not be bookable in the admin pages create booking page either. once its
// hidden then it should stay actually hidden properly."
//
// ⛔ THE TWO HALVES ARE DELIBERATELY DIFFERENT AND BOTH ARE ASSERTED HERE:
//
//   getBookableServiceSlugs  FAILS OPEN  — a database blip must not take the
//                                          booking form down; the list is
//                                          presentation only.
//   assertServicesBookable   FAILS CLOSED — it is the actual refusal, so it
//                                          throws rather than permit a write
//                                          it could not verify.
//
// Getting those the wrong way round would either blank the booking form on a
// transient error, or let a hidden service through whenever the lookup failed.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

const from = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from }),
}));

import {
  ServiceNotBookableError,
  assertServicesBookable,
  getBookableServiceSlugs,
} from "../bookable-services";

/**
 * The guard runs on the client the CALLER passes in, so tests hand it this —
 * the same `from` spy the cached read uses, which keeps both halves of the file
 * measuring the same thing.
 */
function client() {
  return { from } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

/**
 * A query builder that records the filters it was given and resolves to a
 * fixed result. ⛔ Recording the filters is the point: the whole finding was
 * that one code path filtered on `is_active` and another also on
 * `is_visible_on_frontend`, so "which filters were applied" IS the behaviour
 * under test, not an implementation detail.
 */
function builder(result: { data?: unknown; error?: unknown }) {
  const calls: Array<[string, unknown]> = [];
  const chain = {
    calls,
    select: () => chain,
    in: (col: string, val: unknown) => {
      calls.push(["in:" + col, val]);
      return chain;
    },
    eq: (col: string, val: unknown) => {
      calls.push([col, val]);
      return chain;
    },
    returns: () => chain,
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: result.data ?? null, error: result.error ?? null }),
  };
  return chain;
}

describe("getBookableServiceSlugs — the list the booking dialog renders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only services that are BOTH active and visible", async () => {
    const chain = builder({ data: [{ slug: "massage-30" }, { slug: "fire-package" }] });
    from.mockReturnValue(chain);

    expect(await getBookableServiceSlugs()).toEqual(["massage-30", "fire-package"]);

    // ⛔ Both filters, asserted explicitly. Dropping either one is exactly the
    // defect this whole ruling exists to close.
    expect(chain.calls).toContainEqual(["is_active", true]);
    expect(chain.calls).toContainEqual(["is_visible_on_frontend", true]);
  });

  it("⛔ FAILS OPEN — returns null on a database error, never an empty list", async () => {
    from.mockReturnValue(builder({ error: { message: "connection lost" } }));

    // null means "unknown", and the caller then shows everything. Returning []
    // here would blank the customer's booking form on a transient error.
    expect(await getBookableServiceSlugs()).toBeNull();
  });

  it("⛔ distinguishes an ERROR from a genuinely empty result", async () => {
    from.mockReturnValue(builder({ data: [] }));

    // Not null: the query worked and really did find nothing bookable.
    // Collapsing this into null would silently re-offer hidden services.
    expect(await getBookableServiceSlugs()).toEqual([]);
  });

  it("returns null rather than throwing if the client itself blows up", async () => {
    from.mockImplementation(() => {
      throw new Error("no service-role key at build time");
    });

    expect(await getBookableServiceSlugs()).toBeNull();
  });
});

describe("assertServicesBookable — the refusal that actually guards the write", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permits a service that is active and visible", async () => {
    from.mockReturnValue(builder({ data: [{ slug: "massage-30" }] }));

    await expect(
      assertServicesBookable(["massage-30"], client())
    ).resolves.toBeUndefined();
  });

  it("⛔ REFUSES a hidden service, and names it", async () => {
    // The database returns nothing for it, because it fails the visibility
    // filter — exactly what a hidden service looks like.
    from.mockReturnValue(builder({ data: [] }));

    const error = await assertServicesBookable(["hijama-package"], client()).catch(
      (e) => e
    );

    expect(error).toBeInstanceOf(ServiceNotBookableError);
    expect((error as ServiceNotBookableError).slugs).toEqual(["hijama-package"]);
  });

  it("⛔ refuses the whole booking when only ONE of several is hidden", async () => {
    // A mixed basket must not quietly drop the hidden item and book the rest —
    // that would charge a different total from the one the customer agreed to.
    from.mockReturnValue(builder({ data: [{ slug: "massage-30" }] }));

    const error = await assertServicesBookable(
      ["massage-30", "hijama-package"],
      client()
    ).catch((e) => e);

    expect(error).toBeInstanceOf(ServiceNotBookableError);
    expect((error as ServiceNotBookableError).slugs).toEqual(["hijama-package"]);
  });

  it("⛔ FAILS CLOSED — throws when it cannot verify, rather than permitting", async () => {
    from.mockReturnValue(builder({ error: { message: "connection lost" } }));

    // ⚠️ The opposite of getBookableServiceSlugs, on purpose. A booking cannot
    // succeed while the database is unreachable anyway, so refusing here costs
    // nothing real and closes the "blip lets a hidden service through" hole.
    await expect(
      assertServicesBookable(["massage-30"], client())
    ).rejects.toThrow(/Could not verify service availability/);
  });

  it("does nothing when asked about no services at all", async () => {
    await expect(assertServicesBookable([], client())).resolves.toBeUndefined();
    expect(from).not.toHaveBeenCalled();
  });

  it("filters on BOTH flags when checking", async () => {
    const chain = builder({ data: [{ slug: "massage-30" }] });
    from.mockReturnValue(chain);

    await assertServicesBookable(["massage-30"], client());

    expect(chain.calls).toContainEqual(["is_active", true]);
    expect(chain.calls).toContainEqual(["is_visible_on_frontend", true]);
  });
});
