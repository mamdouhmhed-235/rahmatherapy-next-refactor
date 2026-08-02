// TEST SUPPORT ONLY — not imported by application code.
//
// Minimal chainable stand-in for the Supabase admin client, shared by the
// C-09 Step 7 cache specs. Every builder method returns `this`, and the
// builder is thenable, so `await client.from(t).select(...).eq(...)`,
// `.single()`, `.maybeSingle()` and `.returns<T>()` all resolve to the result
// registered for that table.
//
// Register one result per table, or an array of results consumed in call
// order when a fetcher hits the same table more than once:
//
//   const client = createFakeAdminClient({
//     clients: { data: [{ id: "c1" }], error: null },
//     bookings: [{ data: [], error: null }, { data: [{ id: "b1" }], error: null }],
//   });
//
// `client.fromCalls` records the table names in order, which is how the specs
// prove the fetcher ran (or did not re-run on a cache hit).

export interface FakeQueryResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

export interface FakeAdminClient {
  from: (table: string) => unknown;
  fromCalls: string[];
}

const EMPTY: FakeQueryResult = { data: [], error: null, count: 0 };

export function createFakeAdminClient(
  tables: Record<string, FakeQueryResult | FakeQueryResult[]> = {}
): FakeAdminClient {
  const cursors: Record<string, number> = {};
  const fromCalls: string[] = [];

  function resultFor(table: string): FakeQueryResult {
    const registered = tables[table];
    if (!registered) return EMPTY;
    if (Array.isArray(registered)) {
      const index = cursors[table] ?? 0;
      cursors[table] = index + 1;
      return registered[Math.min(index, registered.length - 1)] ?? EMPTY;
    }
    return registered;
  }

  function builder(result: FakeQueryResult) {
    const chain: Record<string, unknown> = {};
    const passthrough = [
      "select",
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
    ];
    for (const method of passthrough) {
      chain[method] = () => chain;
    }
    chain.single = async () => result;
    chain.maybeSingle = async () => result;
    chain.then = (
      onFulfilled?: (value: FakeQueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
    return chain;
  }

  return {
    from(table: string) {
      fromCalls.push(table);
      return builder(resultFor(table));
    },
    fromCalls,
  };
}
