// TEST SUPPORT — not imported by any production module.
//
// ⛔ WHY THIS EXISTS. D-033 made `createBookingTransaction` verify, before it
// calls the RPC, that every requested service is active AND visible
// (`assertServicesBookable`). That verification runs on the SAME client the
// booking is written with, which is the right design — but it means every
// existing test stub for that client must now also model a `services` read, or
// the booking is refused before it ever reaches the behaviour under test.
//
// Four separate stubs needed it. One helper beats four hand-rolled copies that
// can drift apart — the exact failure mode already recorded twice in this
// codebase for `addMinutesToTime` and `formatBusinessDateLong`.
//
// ⚠️ This stub reports every requested slug as BOOKABLE, which is the ordinary
// state of the system: all five real services are active and visible. It is
// deliberately NOT a place to test the refusal — that has dedicated coverage in
// `__tests__/bookable-services.test.ts`, where the filters themselves are
// asserted. A stub that could also refuse would tempt callers to test the guard
// through four unrelated files and assert it nowhere properly.

/**
 * A `services` query chain that answers "all of these are bookable".
 *
 * Mirrors the exact call shape of `assertServicesBookable`:
 * `.select("slug").in("slug", …).eq(…).eq(…).returns()`.
 */
export function bookableServicesQueryStub() {
  const chain: Record<string, unknown> = {};
  let requested: string[] = [];
  Object.assign(chain, {
    select: () => chain,
    in: (_column: string, values: string[]) => {
      requested = values;
      return chain;
    },
    eq: () => chain,
    returns: () => chain,
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: requested.map((slug) => ({ slug })), error: null }),
  });
  return chain;
}

/**
 * Wrap an existing stub's `from` so that reads of `services` get the chain
 * above and every other table keeps whatever the caller already had.
 *
 * ⛔ Delegating rather than replacing matters: these stubs also serve
 * `audit_logs` inserts, and swallowing those would silently stop the audit
 * assertions in the same files from measuring anything.
 */
export function withBookableServices<T extends (table: string) => unknown>(
  existingFrom: T
) {
  return (table: string) =>
    table === "services" ? bookableServicesQueryStub() : existingFrom(table);
}
