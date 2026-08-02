// SERVER — pure function, no side effects.
//
// C-09 Phase C: single normaliser for the params half of every
// `unstable_cache` key. Plan §4 flags "cache key instability (different JSON
// shapes for same filters)" as a medium risk and prescribes sorted keys; this
// is that mitigation in one place so all 13 page-data helpers key identically.
//
// Rules:
//  - keys sorted, so `{a,b}` and `{b,a}` produce the same string;
//  - `undefined` values dropped, so an absent filter and an explicitly
//    undefined one share a cache entry rather than splitting it;
//  - the result is always a string (unstable_cache key parts must be
//    string-serialisable).
//
// Callers pair this with a literal surface prefix — `["clients-list",
// cacheKeyPart(params)]` — so two surfaces can never collide on an
// identically-shaped params object (plan §4, last row).

export function cacheKeyPart(params?: Record<string, unknown>): string {
  if (!params) return "{}";
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value === undefined) continue;
    sorted[key] = value;
  }
  return JSON.stringify(sorted);
}
