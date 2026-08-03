// C-16 Phase E Step 14 (finding N2) — services usage-count fetcher.
//
// Proves: (1) the reducer collapses `booking_items` rows to one count per
// service, (2) the query is bound by a narrow one-column projection (no
// `select("*")`, no joins) rather than fetched-then-filtered-in-memory, and
// (3) the fetcher is actually cache-wrapped (a repeat call within the same
// tag scope must not re-hit the table).
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
const { getServiceUsageCounts, summariseServiceUsage } = await import(
  "../services-data"
);

function stubClient() {
  return createFakeAdminClient({
    booking_items: {
      data: [
        { service_id: "s1" },
        { service_id: "s1" },
        { service_id: "s2" },
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

describe("summariseServiceUsage", () => {
  it("reduces booking_items rows to one count per service", () => {
    const counts = summariseServiceUsage([
      { service_id: "s1" },
      { service_id: "s1" },
      { service_id: "s2" },
    ]);
    expect(counts).toEqual({ s1: 2, s2: 1 });
  });

  it("returns a plain object (not a Map) for an empty input", () => {
    const counts = summariseServiceUsage([]);
    expect(counts).toEqual({});
    expect(counts).not.toBeInstanceOf(Map);
  });
});

describe("getServiceUsageCounts", () => {
  it("bounds the query to a narrow service_id projection, not select(*)", async () => {
    const client = stubClient();
    createSupabaseAdminClient.mockImplementation(() => client);

    const selectCalls: string[] = [];
    const originalFrom = client.from.bind(client);
    client.from = ((table: string) => {
      const builder = originalFrom(table) as Record<string, unknown>;
      const originalSelect = builder.select as (...args: unknown[]) => unknown;
      builder.select = (...args: unknown[]) => {
        selectCalls.push(String(args[0]));
        return originalSelect(...args);
      };
      return builder;
    }) as typeof client.from;

    await getServiceUsageCounts();

    expect(selectCalls).toEqual(["service_id"]);
    expect(selectCalls[0]).not.toContain("*");
  });

  it("reduces the fetched rows to a per-service count (sabotage target: the bound in the query)", async () => {
    const counts = await getServiceUsageCounts();
    expect(counts).toEqual({ s1: 2, s2: 1 });
  });

  it("is cache-wrapped: a second call does not re-hit booking_items", async () => {
    const client = stubClient();
    createSupabaseAdminClient.mockImplementation(() => client);

    await getServiceUsageCounts();
    await getServiceUsageCounts();

    expect(client.fromCalls.filter((t) => t === "booking_items")).toHaveLength(1);
  });

  it("returns {} when the table has no rows", async () => {
    createSupabaseAdminClient.mockImplementation(() =>
      createFakeAdminClient({ booking_items: { data: [], error: null } })
    );
    const counts = await getServiceUsageCounts();
    expect(counts).toEqual({});
  });
});
