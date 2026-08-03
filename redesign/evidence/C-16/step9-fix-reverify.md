# C-16 Phase D Step 9 — fix re-verification (commit `6faf895`)

VERDICT: PASS

This clears the programme-wide freeze imposed under protocol §2.9(b) after
`redesign/evidence/C-16/steps910-verify.md` FAILed commit `dc26dc0` on the
"Today" date-range regression. Commit under test: **`6faf895`** — "fix(redesign):
C-16 Step 9 — 'Today' means today; date-range labels made coherent."

---

## Check 1 — `git show 6faf895 --stat`

```
 src/app/admin/emails/__tests__/emails-data.test.ts | 48 +++++++++++++++++++++-
 src/app/admin/emails/emails-data.ts                | 16 ++++++--
 src/app/admin/privacy/page.tsx                     | 21 +++++++++-
 3 files changed, 80 insertions(+), 5 deletions(-)
```

Exactly three files, matching the dispatch's permitted set. `operations/**`,
`account-password-requests/**`, `bookings/**`, `src/lib/pagination.ts`, and
`PaginationBar.tsx` are absent from this commit's own diff.

Note: `git log --oneline dc26dc0..6faf895` shows one intervening commit,
`66e9391 feat(redesign): C-16 Phase D Steps 11-12 — operations pager +
password-requests bound`, which is why a *range* diff (`git diff dc26dc0
6faf895`) shows `operations/**` and `account-password-requests/**` files —
those belong to `66e9391`, not to the fix commit `6faf895` itself (confirmed
by `git show 6faf895 --stat` above, which is the correct scope for this
check). **PASS.**

---

## Check 2 — Date arithmetic, re-derived by hand

Fixed clock: `2026-01-15T15:42:07.123Z`. `day = 86400000` ms. Epoch time is
UTC-midnight-aligned, so `todayStart = Math.floor(Date.now()/day)*day` is UTC
midnight of the current calendar day:

- `todayStart` → `2026-01-15T00:00:00.000Z` (flooring `15:42:07.123` on
  Jan 15 lands on Jan 15's own midnight).
- `case "today"`: code now returns `fromIso: todayStart` directly (the `- day`
  offset was dropped) → **`2026-01-15T00:00:00.000Z`**. Matches the
  implementer's reported value.
- `case "last_7_days"`: `todayStart - 6*day`. Counting back 6 days from
  Jan 15: 14,13,12,11,10,9 → **`2026-01-09T00:00:00.000Z`**. Matches.
- `case "last_30_days"`: `todayStart - 29*day`. Counting back 29 days from
  Jan 15: 14 days lands on Jan 1, a further 15 days lands on Dec 17, 2025
  (Jan 1 → Dec 31 is day 15 back, ... → Dec 17 is day 29 back) →
  **`2025-12-17T00:00:00.000Z`**. Matches.

All three independently hand-computed values agree exactly with the
implementer's reported values and with the actual code
(`src/app/admin/emails/emails-data.ts:353-360`):

```ts
switch (filters.range) {
  case "today":
    return { fromIso: new Date(todayStart).toISOString() };
  case "last_7_days":
    return { fromIso: new Date(todayStart - 6 * day).toISOString() };
  case "last_30_days":
  default:
    return { fromIso: new Date(todayStart - 29 * day).toISOString() };
}
```

No off-by-one. **PASS.**

---

## Check 3 — Mutual coherence of the three presets

None of the three branches sets `toIso` — the upper bound is implicitly "now"
(unbounded above) in all three cases, so the three windows are:

- today: `[todayStart, now]` — 1 calendar day, includes today.
- last_7_days: `[todayStart - 6*day, now]` — 7 calendar days, includes today.
- last_30_days: `[todayStart - 29*day, now]` — 30 calendar days, includes today.

Because all three share the same upper bound and their lower bounds are
strictly nested (`todayStart ≥ todayStart-6*day ≥ todayStart-29*day`), the
`today` window is a subset of `last_7_days`, which is a subset of
`last_30_days` — no case excludes today, and no two labels can describe
contradictory or overlapping-but-inconsistent meanings. This matches the new
doc comment's stated semantics ("N calendar days up to and including today")
and the UI labels in `format.ts:47-49` ("Today" / "Last 7 days" / "Last 30
days"). This is exactly the class of defect the original FAIL exposed (one
case fixed in isolation) — here all three were changed together and remain
coherent. **PASS.**

---

## Check 4 — Cache-key fix survived

`git diff dc26dc0 6faf895 -- src/app/admin/emails/emails-data.ts` shows the
**entire** change is the 3-line switch-statement fix plus a doc comment —
`todayStart = Math.floor(Date.now()/day)*day` (millisecond-flooring to a UTC
day boundary) is untouched, so the cache key is still stable across calls
within a day, not reintroduced to millisecond precision.

`applyDeliveryPredicates`, `countEmailDeliveryEvents`, and
`getFilteredDeliveryEvents` are byte-identical to `dc26dc0` (same diff, zero
changes outside the switch statement) — confirmed both still call
`resolveDeliveryDateBounds(filters)` independently and both still feed the
result into the same `applyDeliveryPredicates(..., fromIso, toIso)` and into
their respective cache keys. Resolution is still "once per request" in the
same sense verified in the original report (stable by flooring, called twice
but landing on the same value). **PASS — no new defect traded in.**

---

## Check 5 — Test teeth, judged directly (not on the sabotage report's word)

Read `src/app/admin/emails/__tests__/emails-data.test.ts:327-370` in full. A
new `describe("resolveDeliveryDateBounds correctness (fixed clock)")` block
was added:

```ts
const FIXED_NOW = "2026-01-15T15:42:07.123Z";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(FIXED_NOW)); });
afterEach(() => { vi.useRealTimers(); });

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
```

These assert against **fixed, independently-stated ISO string literals**
(hand-checkable, and I did check them in Check 2), not against a value
recomputed by the function under test — this is the opposite structure from
the vacuous stability test the FAIL report identified.

- Would it fail if `last_7_days` regressed to `- 7*day`? That would produce
  `2026-01-08T00:00:00.000Z`, which does not equal the asserted
  `2026-01-09T00:00:00.000Z` → **yes, it would fail.**
- Would it fail if `today` regressed to `- day` (the original bug)? That
  would produce `2026-01-14T00:00:00.000Z`, which does not equal the
  asserted `2026-01-15T00:00:00.000Z` → **yes, it would fail.**

The old vacuous stability suite (`describe("resolveDeliveryDateBounds
stability")`, still present, untouched, lines ~300-325) was left in place
rather than replaced — correct per SUBAGENT-RULES §6 (VERIFY-ALREADY-
IMPLEMENTED text is preserved, not re-implemented); it still only checks
self-consistency, but it's no longer the only guard, and the new suite closes
exactly the gap the FAIL report identified. **PASS.**

---

## Check 6 — `"custom"` range branch untouched

`git diff dc26dc0 6faf895 -- src/app/admin/emails/emails-data.ts` (full diff,
reproduced under Check 4) touches only the `switch` statement's three preset
cases and a doc comment above the function — the `if (filters.range ===
"custom")` block is outside the diff hunk entirely, confirmed unchanged:

```ts
if (filters.range === "custom") {
  const fromMs = filters.from ? new Date(filters.from).getTime() : NaN;
  const toMs = filters.to ? new Date(filters.to).getTime() : NaN;
  return {
    fromIso: Number.isNaN(fromMs) ? undefined : new Date(fromMs).toISOString(),
    toIso: Number.isNaN(toMs)
      ? undefined
      : new Date(toMs + 24 * 60 * 60 * 1000).toISOString(),
  };
}
```

Still validates raw params via `Number.isNaN(...getTime())` before ever
calling `.toISOString()`, and still falls back to `undefined` (no bound) on a
malformed value rather than throwing a `RangeError`. **PASS.**

---

## Check 7 — Privacy notes-rail CTA (defect 3)

`src/app/admin/privacy/page.tsx` diff adds, inside `SensitiveNotesPanel`:

```ts
const cappedOut = notesViewAll && notesTotal > PRIVACY_NOTES_VIEW_ALL_CAP;
...
{cappedOut ? (
  <p ...>
    Showing the first {PRIVACY_NOTES_VIEW_ALL_CAP} of {notesTotal} sensitive
    notes. The rest aren't reachable from this rail — open individual
    clients to review them.{" "}
    <Link href={notesRecentHref} ...>Show recent {PRIVACY_NOTES_LIMIT} only</Link>
  </p>
) : hasHiddenNotes ? (
  <p ...><Link href={notesAllHref} ...>View all {notesTotal}...</Link></p>
) : null}
```

Branch ordering is correct: `cappedOut` is checked **before** `hasHiddenNotes`
in the ternary chain. This matters because when `notesViewAll` is true and
`notesTotal > 500`, `notes.length` is capped at `PRIVACY_NOTES_VIEW_ALL_CAP`
(500), so `hasHiddenNotes = notesTotal > notes.length` (page.tsx:922) is
*also* true in that state — without `cappedOut` taking priority, the old
"View all N" link would keep re-rendering and re-pointing at the same
already-active state, a dead link. With the fix: `cappedOut` state shows
plain explanatory text plus a working "Show recent 25 only" link
(`notesRecentHref`, pre-existing href, drops back to the default view);
non-capped `hasHiddenNotes` state (viewing 25 of N≤500, or not yet viewing
all) still shows the original working "View all N" link; the case of
viewing-all with total ≤ 500 falls to `null` (nothing left to show, correct —
`hasHiddenNotes` is false there since `notes.length` would equal
`notesTotal`). No state renders a link that does nothing.

Cap value: `git diff dc26dc0 6faf895 -- src/app/admin/privacy/privacy-data.ts`
is empty — `privacy-data.ts` is byte-identical to the FAILed commit.
`PRIVACY_NOTES_VIEW_ALL_CAP = 500` (`privacy-data.ts:63`) is unchanged; the
fix only imports it into `page.tsx` and branches on it. **PASS.**

---

## Check 8 — Everything `dc26dc0` got right, preserved

- `git diff dc26dc0 6faf895 -- src/app/admin/emails/page.tsx` → 0 lines. The
  removed `data-redesign-backend="FAKE"` pager stays removed; `PaginationBar`
  usage, page clamping (`clampPage` via `src/lib/pagination.ts`, itself
  outside this diff entirely), and the `DeliveryEventRow`/`ResendButton`
  wiring are untouched.
- `git diff dc26dc0 6faf895 -- src/app/admin/privacy/privacy-data.ts` → 0
  lines. `applyPrivacyRequestFilters` and the count/rows split are untouched.
- `git diff dc26dc0 6faf895 -- src/app/admin/privacy/__tests__/privacy-data.test.ts`
  → 0 lines.
- `emails-data.ts`'s only change is the 3-line switch fix (Check 4) —
  `applyDeliveryPredicates` (single builder, both count and rows call it),
  the single-resolution-per-request shape, and `getEmailDeliveryPage`'s
  count→clamp→range→rows sequence are all untouched.

**PASS — nothing `dc26dc0` fixed correctly was lost.**

---

## Check 9 — `tsc` / `vitest` / `eslint`

**`npx tsc --noEmit`** → 0 errors, 0 output. Matches inherited baseline.

**`npx vitest run`** → `Test Files 2 failed | 178 passed (180)`, `Tests 5
failed | 1617 passed (1622)`. Failing tests, by name:
```
FAIL src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated
FAIL src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent
```
Exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 — matches
the inherited baseline **by identity**. (Total test count rose from
1592/1597 in the prior verify to 1617/1622 here, and test files from 176/178
to 178/180 — expected, since the intervening commit `66e9391` and this fix's
own 4 new date-bounds tests both landed since the last run; the failing set
itself did not change.)

**`npx eslint .`** → `✖ 66 problems (59 errors, 7 warnings)`. Files with
findings (via `grep -E "^C:\\\\"` on the output, deduplicated):
```
design_handoff_area_pages/prototype/area-page.jsx
design_handoff_area_pages/prototype/shared.jsx
design_handoff_area_pages/prototype/site-chrome.jsx
src/features/booking/BookingExperience.tsx
src/features/booking/BookingExperienceLoader.tsx
src/features/booking/utils/returning-customer.ts
```
Exactly six files, exactly 59 errors / 7 warnings — matches the dispatch's
expected settled baseline by identity. No other file appeared. **PASS.**

---

## Check 10 — `git status --porcelain`

Working tree shows only the standing Owner-owned modification to
`src/lib/maintenance.ts` (not touched, not reported further per instruction)
plus pre-existing untracked/deleted paths unrelated to this fix (stale
`.playwright-mcp/` logs, a deleted `design_handoff_public_pages/` tree,
untracked `design_handoff_area_pages/`, `photos-rahma-therapy/`,
`redesign/evidence/C-16/steps910-verify.md`, `redesign/evidence/C-21/*`
screenshots, `test-results/`). Nothing unexpected introduced by verifying
`6faf895` — no local edits were made by this verification pass. **PASS.**

---

## Summary

| # | Check | Result |
|---|---|---|
| 1 | Exactly 3 files, untouchables clear | PASS |
| 2 | Date arithmetic re-derived by hand | PASS — today/2026-01-09/2025-12-17 all confirmed |
| 3 | Three presets mutually coherent | PASS — nested windows, shared upper bound, today always included |
| 4 | Cache-key fix (flooring, dual-call stability) survived | PASS |
| 5 | New test has teeth (fixed-clock, literal expected values) | PASS — verified it would catch both the `today` and `last_7_days` regressions |
| 6 | `"custom"` branch untouched, still validates before `.toISOString()` | PASS |
| 7 | Privacy `cappedOut` branch ordering + cap value unchanged | PASS |
| 8 | Everything `dc26dc0` got right preserved | PASS — zero diff outside the 3 touched files |
| 9 | tsc/vitest/eslint identity | PASS — 0 / 5 known failures / 59 errors+7 warnings in the same six files |
| 10 | `git status` clean of surprises | PASS |

**VERDICT: PASS.** The "Today" regression from `dc26dc0` is fixed and
independently re-derived correct; the fix is scoped to exactly the three
files it should touch; the new test would have caught the original defect;
the privacy CTA gap (defect 3) is closed without changing the cap; nothing
previously correct was lost; and tsc/vitest/eslint all match their inherited
baselines by identity. This clears the programme-wide freeze.
