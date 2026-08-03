# C-16 Phase D Steps 9–10 — verification (commit `dc26dc0`)

VERDICT: FAIL

Scope note: `src/app/admin/operations/**` and `src/app/admin/account-password-requests/**`
are being concurrently edited by another agent and are explicitly NOT this commit's
subject. All claims about `dc26dc0` itself are sourced from `git show dc26dc0[:<path>]` /
`git show dc26dc0 -- <path>`, not the live working tree. tsc/vitest/eslint were run
against the live working tree (per dispatch instruction), which is where the concurrent
`operations/**` edits caused observed volatility — documented under Check 11, not counted
against this commit.

**Reason for FAIL:** Check 3 found a genuine, concrete, user-visible date-range bug
introduced by this commit's own date-bounds fix (`resolveDeliveryDateBounds`,
`emails-data.ts:344-346`): the "Today" preset on `/admin/emails` resolves to **start of
yesterday**, not start of today, so selecting "Today" shows up to ~48 hours of events
(yesterday + today-so-far) under a filter labelled "Today." This is exactly the class of
defect the dispatch was hunting for — silently wrong, plausible-looking output that no
type check or existing test catches (verified: the new stability test only asserts
self-consistency, not correctness — see Check 9). Everything else, including the
headline stat-tile-scoping risk, passed.

---

## Highest-value check — stat-tile scoping (privacy) and badge/count scoping (emails)

**Privacy `/admin/privacy` — PASS, correctly fixed.**

- `getPrivacyPageData`'s `requestsQuery` is now bounded to the current page
  (`privacy-data.ts:196-199`, `.range(start, start+limit-1)`), and page.tsx builds its
  status-grouped panels from that one page's `requests` (`page.tsx:330,346-353`) — this
  is a display list, not a stat, and is expected to be page-scoped.
- The "Open requests" stat tile (`page.tsx:361-363`) is **not** derived from that page.
  It calls `countPrivacyRequests({ statuses: ["open", "reviewing"] })`
  (`privacy-data.ts:294-323`) — a `head: true` HEAD count against the whole table,
  filtered only by status, independent of the page/pager and independent of whatever
  filter the user has applied to the visible queue (`page.tsx:374-375` documents this:
  "Stat-tile shortcuts — always jump to the GLOBAL open/oldest queue, independent of
  whatever filter is currently applied").
- The "Awaiting longest" stat tile (`page.tsx:364-367`) calls
  `getOldestOpenPrivacyRequest(canManagePrivacyOperations)`
  (`privacy-data.ts:363-398`) — a 1-row query (`.order(...).limit(1)`) against the
  whole `client_privacy_requests` table filtered to `status in (open, reviewing)`, also
  independent of the page.
- Concretely: with 40 open requests and `LIST_PAGE_SIZE=25`, page 1 shows 25 rows, but
  "Open requests" still correctly reads 40 (verified by code path, not by exercising a
  live 40-row dataset — the count query has no `.range()`/`.limit()` at all, so page
  size is structurally incapable of leaking into it).
- Secondary, disclosed exception: "Sensitive notes this month" (`page.tsx:369-372`,
  `notesReviewedThisMonth`) is computed by filtering `notes` — the **capped**
  sensitive-notes rail (25, or up to 500 in view-all mode) — not a whole-table query.
  Unlike the two primary tiles, this one is honest about its own scope: the UI renders
  `"{notesReviewedThisMonth} reviewed (last 25 always visible)"` inline
  (`page.tsx:513-517`), so a user with >25 sensitive notes this month sees a visibly
  caveated number, not a silently wrong one. Flagged for completeness, not a defect.

**Emails `/admin/emails` — PASS on the pager's own total; one pre-existing bounded
badge confirmed unchanged (not a regression from this commit).**

- The Delivery tab's "Showing X of Y" readout (`page.tsx:591-593` inside
  `DayGroupedFeed`) uses `total={deliveryPage.total}` (`page.tsx:307`), which is
  `countEmailDeliveryEvents(filters)` — a real `head: true` count query
  (`emails-data.ts:411-445`), not a slice of the fetched page. This is the actual
  Step 9 fix and it is correct.
- `failedRecent` (the Delivery tab badge, "X failed in the last 24 hours",
  `page.tsx:260,950-961`) is computed by `countFailedRecent(allEvents)` where
  `allEvents` is the **top-100** unfiltered fetch from `getEmailsPageData`
  (`page.tsx:159-173`, `limit: PAGE_SIZE` = 100). I confirmed via
  `git show 46d5706:src/app/admin/emails/page.tsx` (the commit immediately before
  dc26dc0) that this was **already** computed exactly this way before this commit —
  it is unchanged, not a regression introduced by Step 9. It remains a real, if
  pre-existing, risk: on a day with >100 email events, failures beyond the 100th most
  recent event are silently excluded from the badge. Per SUBAGENT-RULES §4(a) this is
  noted, not fixed (outside my assigned files' scope — `countFailedRecent` predates
  this diff and Step 9's file list doesn't touch it).
- `upcomingBookings.length` (Reminders tab badge) is capped at `.limit(20)`
  (`emails-data.ts:192`) — also pre-existing, unrelated to the delivery pager, not
  touched by this diff.
- No count/badge/total was found that **used to be computed over the top-100 and is
  now computed over a single page** — the specific regression pattern the dispatch
  asked me to hunt for did not occur on the emails surface.

---

## Check 1 — `git show dc26dc0 --stat`

```
 src/app/admin/emails/__tests__/emails-data.test.ts | 126 +++++++++-
 src/app/admin/emails/emails-data.ts                | 235 ++++++++++++++----
 src/app/admin/emails/page.tsx                      | 123 ++++++----
 .../admin/privacy/__tests__/privacy-data.test.ts   | 172 ++++++++++++-
 src/app/admin/privacy/page.tsx                     | 208 +++++++++++-----
 src/app/admin/privacy/privacy-data.ts              | 272 ++++++++++++++++++---
 6 files changed, 934 insertions(+), 202 deletions(-)
```
Exactly six files, no component files (`DeliveryFilterStrip.tsx`, `PrivacyFilterBar.tsx`,
`PaginationBar.tsx`, `ResendButton.tsx` all absent from the diff — confirmed by their
absence here and by the byte-identical `DeliveryEventRow` function, see Check 7).
**PASS.**

---

## Check 2 — Shared filter resolution (both surfaces), adversarial

**Emails.** `applyDeliveryPredicates` (`emails-data.ts:379-402`) is the only place the
`eq`/`or`/`gte`/`lte` sequence is built. `countEmailDeliveryEvents` (`:411-445`) and
`getFilteredDeliveryEvents` (`:452-496`) both call it with the same `filters` object and
both resolve `fromIso`/`toIso` via `resolveDeliveryDateBounds(filters)` independently
(see Check 3 for why this is "independently, not literally once"). `getEmailDeliveryPage`
(`:511-541`) is the only caller of both, and it passes the same `filters` argument to
each — no branch in between that could give one a predicate the other lacks.

**Privacy.** `applyPrivacyRequestFilters` (`privacy-data.ts:151-168`) is the only place
the `in`/`gte`/`lte`/`ilike` sequence is built. `getPrivacyPageData`'s `requestsQuery`
(`:187-195`) and `countPrivacyRequests` (`:294-323`) both call it with the same `filters`.
`getPrivacyRequestsPage` (`:415-446`) is the only caller of both and threads one
`filters` value through to each — same discipline.

**Adversarial — early-return / default divergence search:**
- `countEmailDeliveryEvents(filters: EmailDeliveryFilters = {})` has no `canSeeDelivery`
  gate of its own; `getFilteredDeliveryEvents` does
  (`emails-data.ts:456-458`, returns `{events:[],deliveryError:null}` early). This
  looks like an asymmetry, but the only call site that matters,
  `getEmailDeliveryPage`, gates **both** behind one `if (!canSeeDelivery) return ...`
  at the top (`:521-523`) before either is called — so in practice they can never run
  with mismatched permission state. Confirmed by reading the only production call
  path (`page.tsx:233-239` calls `getEmailDeliveryPage` inside a
  `canSeeDelivery ? ... : {...}` ternary — belt-and-suspenders, not a divergence risk).
- `getPrivacyRequestsPage` computes
  `total = canManagePrivacyOperations ? await countPrivacyRequests(filters) : 0`
  (`:430`) while `getPrivacyPageData` internally gates its own requests query on the
  same `canManagePrivacyOperations` boolean (`:201-203`) — both read the same
  pass-through parameter, not independently derived values, so they can't disagree.
- No default-parameter or conditional path was found where one side of a count/rows
  pair could receive a filter the other doesn't. **PASS.**

---

## Check 3 — The date-bounds fix — PARTIAL PASS / REGRESSION FOUND

**(a) Stability across two calls in the same request — confirmed true, but not via a
single resolution.** Contrary to the framing "resolves once per request in
`getEmailDeliveryPage` (`:511`)", `resolveDeliveryDateBounds` is actually invoked
**twice** per request: once inside `countEmailDeliveryEvents` (`emails-data.ts:414`)
and once inside `getFilteredDeliveryEvents` (`:459`) — `getEmailDeliveryPage` itself
never calls it directly, it just calls the two functions that each call it. The two
calls land on the same value because both floor to the UTC day boundary
(`Math.floor(Date.now()/day)*day`, `:343`), which is stable for the whole day, not
because the value is computed once and threaded through. Contrast with privacy, where
`resolvePrivacyDateBounds` genuinely is called once in `page.tsx:279-283` and the
resulting ISO strings are threaded through as static values into `queueFilters`
(`:284-295`) — a structurally different, arguably more robust approach to the same
goal. Both are stable in practice; only privacy is stable *by construction* rather than
*by coincidence of flooring*.

**(b) Reaches both queries** — confirmed: `applyDeliveryPredicates(..., fromIso, toIso)`
is called with the resolved bounds in both `countEmailDeliveryEvents` (`:419-426`) and
`getFilteredDeliveryEvents` (`:464-472`).

**(c) Cache key stable within a day** — confirmed: both cache keys include `fromIso`/
`toIso` (`:432-441`, `:481-492`), and since those values only change once every UTC
day, the key no longer changes on every millisecond as before. This part of the fix is
real and correctly implemented — verified against the pre-commit version
(`git show 880809e:src/app/admin/emails/emails-data.ts`), which read `Date.now()`
directly with no flooring.

**(d) REGRESSION — the "Today" preset is wrong, not just imprecise.**
`emails-data.ts:344-346`:
```ts
case "today":
  return { fromIso: new Date(todayStart - day).toISOString() };
```
`todayStart` is UTC midnight of **today**. Subtracting one more `day` makes `fromIso`
UTC midnight of **yesterday** — not "since midnight today" (which would just be
`todayStart`) and not the pre-existing "rolling last 24 hours" behavior either (which
was `now - day`, i.e. exactly 24h regardless of time of day). Concrete failure
scenario: at 15:00 UTC, selecting the "Today" filter (labelled "Today" in the UI —
`format.ts:47`, `{ key: "today", label: "Today" }`) returns every event from
00:00 UTC **yesterday** through now — a 39-hour window, nearly double the 24 hours a
"Today" filter should show, and it will visibly include yesterday afternoon's emails
under "Today." Right before UTC midnight the window approaches 48 hours. This is a new
defect: the old code's "today" was at least a true rolling 24h window (mislabeled but
consistent); the new code's "today" is neither a true 24h window nor a true calendar
day — it's off by exactly one full day. No test in `emails-data.test.ts` catches this
because the stability test only checks that two calls return the *same* value, never
that the value is the *correct* one (see Check 9).

`last_7_days`/`last_30_days` (`:347-351`) have the same day-floor applied, which
inflates their windows by up to ~24h (the fraction of "today" already elapsed) beyond
the old exact-N-days rolling window — e.g. "last 7 days" can return up to 8 days of
data. This is a smaller, more defensible shift (rounding a labelled-in-days preset to
day granularity is a reasonable interpretation) and I would not fail the commit on this
alone, but it is a real, user-visible shift the dispatch asked me to confirm — and it
does shift.

**Verdict on Check 3: FAIL** — the cache-key-stability defect this step set out to fix
is genuinely fixed, but the fix introduced a new, concrete, user-facing correctness bug
in the "Today" filter specifically.

---

## Check 4 — FAKE pager removed

Confirmed via `git show 46d5706:src/app/admin/emails/page.tsx` (pre-commit): the FAKE
notice lived at that file's lines 604-619, `data-redesign-backend="FAKE"` at line 607,
with "Showing the most recent {PAGE_SIZE} events" / "BUILD pending" copy. In `dc26dc0`'s
version of `page.tsx`, that block is gone; `<PaginationBar page={page} pageCount=
{pageCount} total={total} pageSize={LOG_PAGE_SIZE} makeHref={makeHref} />`
(`page.tsx:481-487`) renders in its place. Grepped both `page.tsx` files (emails,
privacy) in the after-state for `data-redesign-backend` — zero matches. **PASS.**

---

## Check 5 — Privacy's two regions treated distinctly

**Request queue** (`client_privacy_requests`) — confirmed it previously carried no
bound (verified absent `.limit()`/`.range()` in the pre-commit `privacy-data.ts`; this
matches the commit message's own claim) and now gets `getPrivacyRequestsPage`
(`privacy-data.ts:415-446`) at `LIST_PAGE_SIZE` (25), rendered via the same
`PaginationBar` (`page.tsx:691-699`).

**Sensitive-notes rail** (`client_notes`) — confirmed cap+view-all, not a pager:
`PRIVACY_NOTES_LIMIT = 25` default, `notesViewAll` raises the query's `.limit()` to
`PRIVACY_NOTES_VIEW_ALL_CAP = 500` (`privacy-data.ts:57-63,211`). Total surfaced via
`countSensitiveNotes()` (`:330-345`, a real HEAD count, unbounded). "View all N" link
(`page.tsx:989-997`) sets `?notes=all`; a way back exists ("Show recent 25 only",
`page.tsx:998-1006`). Both confirmed present and wired correctly.

**Is 500 defensible, and does the UI say anything beyond it?** No — this is a real gap.
`hasHiddenNotes = notesTotal > notes.length` (`page.tsx:921`) is the only condition
gating the "View all N" CTA. Concrete failure scenario: clinic has 600 sensitive notes.
User clicks "View all 600 sensitive notes" → `notesViewAll=true` → `notes.length` caps
at 500 (`PRIVACY_NOTES_VIEW_ALL_CAP`) → back on the page, `hasHiddenNotes` is
STILL true (600 > 500) → the badge honestly reads "500 of 600" (`page.tsx:928`, this
part is correct and not misleading) BUT the "View all 600 sensitive notes" link
(`page.tsx:989-996`) renders again, identical to before, pointing at the same
`notesAllHref` (already the current URL/state) — clicking it does nothing, since 500
is a hard ceiling with no next tier. The link offers a false promise of seeing more;
there is no copy anywhere that says "capped at 500" or otherwise distinguishes "capped,
25→500 available" from "capped, hit the ceiling, nothing more to show." This is exactly
the "bigger silent truncation" the dispatch asked me to judge for — the badge itself
is honest, but the CTA is not.

---

## Check 6 — Page-param behaviour on both surfaces

`clampPage` (`src/lib/pagination.ts:17-21`, pre-existing/shared, not part of this diff)
parses `rawPage`, returns `1` for anything non-finite or `<1`, and clamps to
`Math.min(n, Math.max(1, pageCount))` — a stale `?page=99` clamps to the last real page,
never 404s or renders empty. `PaginationBar`'s `OffsetBar` (`PaginationBar.tsx:71-72`)
returns `null` when `pageCount <= 1` — confirmed renders nothing at one page.

`DeliveryFilterStrip`'s `toUrl` (`DeliveryFilterStrip.tsx:28-41`) and `PrivacyFilterBar`'s
`buildHref` (`PrivacyFilterBar.tsx:35-48`) both build fresh `URLSearchParams` from
scratch and never call `.set("page", ...)` — confirmed by reading both functions in
full; neither is part of this commit's diff (both pre-existing, reused as-is).

**Other URL-writing paths checked for a preserved stale `page`:**
- `emails/page.tsx`: only other href builder is `makeDeliveryPageHref`
  (`:253-257`), which explicitly rewrites `page` (that's its job) from
  `deliveryRetryParams`, itself built by excluding `key === "page"`
  (`:248-252`) — correct.
- `privacy/page.tsx`: `openHref`/`oldestHref` (`:376-377`) are static, no `page`.
  `makeQueuePageHref` (`:390-394`) rewrites `page` from `queueRetryParams`, built
  the same way (`:384-389`, excludes `page`). `notesAllHref`/`notesRecentHref`
  (`:398-408`) reuse `queueRetryParams` too — as a side effect, toggling the
  sensitive-notes view-all cap also resets the queue's `page` to whatever
  `queueRetryParams` implies (i.e., drops it). This isn't the "stale page preserved"
  failure mode the check was hunting for (it's the opposite: an unrelated control
  drops a page param it didn't need to touch), so it doesn't fail this check, but it
  is a minor coupling worth a note: navigating "View all notes" while on queue page 3
  silently returns the queue to page 1.

No path was found that preserves a stale `page` across a filter change on either
surface. **PASS**, with the minor coupling noted above.

---

## Check 7 — C-08's per-row Resend buttons untouched

Diffed the `DeliveryEventRow` function body (from `function DeliveryEventRow` to
`function RecipientFallback`) between `git show 46d5706:src/app/admin/emails/page.tsx`
(immediately pre-commit) and `git show dc26dc0:src/app/admin/emails/page.tsx` — byte-
identical, zero diff output. `ResendButton` is invoked with the same three props
(`deliveryEventId`, `eventTypeLabel`, `recipientEmail`) unchanged
(`page.tsx:712-716`). **PASS.**

---

## Check 8 — New data-layer orchestrators mirror `getBookingsListPage`

`getBookingsListPage` (`bookings-list-data.ts:869-905`) shape: `total = await
countBookings(predicates)` → `pageCount = Math.max(1, Math.ceil(total/pageSize))` →
`page = clampPage(...)` → `{from} = pageRange(...)` → `rows = await
getBookingsListData({..., limit, offset})`, explicitly sequential ("Sequential, not
Promise.all" comment at `:887`).

`getEmailDeliveryPage` (`emails-data.ts:511-541`) and `getPrivacyRequestsPage`
(`privacy-data.ts:415-446`) both follow the identical count → clamp → range → rows
shape, both explicitly `await` the count before clamping and before fetching rows (not
`Promise.all`), both carry an explicit comment citing the same reasoning ("a stale
`?page=99` can only be clamped once the total is known"). **PASS.**

---

## Check 9 — Are the test assertions real?

**Date-bounds stability test — weak, does not reliably guard the regression class it
claims to.** `emails-data.test.ts:310-325`:
```ts
describe("resolveDeliveryDateBounds stability", () => {
  it.each(["today", "last_7_days", "last_30_days"] as const)(
    "resolves %s identically across two calls in the same request",
    (range) => {
      const first = resolveDeliveryDateBounds({ range });
      const second = resolveDeliveryDateBounds({ range });
      expect(second).toEqual(first);
    }
  );
  ...
```
No `vi.useFakeTimers()`/`vi.setSystemTime()`/simulated delay anywhere in the file
(confirmed by grep). The two calls execute synchronously, back to back, with no `await`
between them. On real V8, two such calls virtually always land in the same millisecond,
so **this test would very likely still pass even if millisecond-precision `Date.now()`
were reintroduced** — it doesn't reproduce the actual production race, which was two
calls separated by a real async DB round trip (the count query, then later the rows
query), not two synchronous calls in a tight loop. It also does not assert what the
*correct* value is (no assertion on the ISO string's actual date/time), so it would not
have caught the "today = yesterday" bug from Check 3 even if it were re-run today — it
only proves the two calls agree with each other, not that either is right. This is a
real weakness in the regression coverage the dispatch specifically asked me to
pressure-test.

**Shared-filter tests — real, compare against actual runtime behavior, not a
hand-written duplicate.** Both `emails-data.test.ts:330-383`
("`countEmailDeliveryEvents` honours the same filters as `getFilteredDeliveryEvents`")
and `privacy-data.test.ts:193-256` ("`countPrivacyRequests` honours the same filters as
`getPrivacyPageData`") record the actual sequence of `.eq()`/`.or()`/`.gte()`/`.lte()`/
`.in()`/`.ilike()` calls each function makes against a recording stub, then assert
`expect(countCalls).toEqual(rowCalls)` — comparing the two real code paths against each
other, not against a separately hand-written expected-calls array. This means a bug in
the shared predicate builder itself wouldn't be caught (both sides would agree on the
same wrong thing), but the specific defect class this step is defending against — count
and rows silently diverging — is well covered. **PASS on this half of the check.**

---

## Check 10 — Code-rule compliance

- **JSON-safe cache keys / no Set/Map/Date crossing `unstable_cache`:** confirmed for
  all five cache entries added/touched (`getEmailsPageData`, `countEmailDeliveryEvents`,
  `getFilteredDeliveryEvents`, `getPrivacyPageData`, `countPrivacyRequests`) — every
  field reaching the query (filters, limit/offset, fromIso/toIso, permission booleans,
  staffId, businessDate, notesViewAll) also appears in that function's `cacheKeyPart(...)`
  call. Return shapes are plain arrays/scalars per each file's own "CACHE HAZARD AUDIT"
  comment, verified against the actual interfaces (`EmailsPageData`, `PrivacyPageData`,
  etc.) — no `Map`/`Set`/`Date` fields.
- **No `border-l-4`:** grepped both `page.tsx` files, zero matches.
- **`updateTag` not `revalidateTag`:** grepped `emails-data.ts`/`privacy-data.ts`, zero
  `revalidateTag` matches. Neither of these six files performs cache invalidation at
  all (they're reads only), so this rule is inapplicable to this commit rather than
  actively demonstrated — noting rather than claiming a positive test.
- **`createSupabaseAdminClient()` only after `getStaffProfile()`:** confirmed by call
  order in both `page.tsx` files — `getStaffProfile(supabase)` runs and can `redirect()`
  before any data-fetching function (which internally calls
  `createSupabaseAdminClient()` inside its `unstable_cache` callback) is invoked.
- **No new hardcoded `oklch(...)`:** `git show dc26dc0 -- src/app/admin/emails/page.tsx
  src/app/admin/privacy/page.tsx | grep "^+.*oklch("` — zero matches. The `oklch(...)`
  occurrences visible in the after-state file are pre-existing lines that only had
  variable names changed around them (e.g. `oldestOpen` → `oldestOpenRequest`),
  confirmed by inspecting the diff context directly.
- **`min-h-11` on pager controls:** `PaginationBar.tsx:33` (`controlClassName`)
  includes `min-h-11` — pre-existing shared component, reused correctly by both new
  call sites.
- **Clean at 375px:** verified by static diff scan only — `git show dc26dc0 -- ... |
  grep -nE "w-\[[0-9]+px\]|min-w-\[[0-9]{3,}px\]"` on both page files found no added
  fixed-pixel widths, and the new stat-tile/queue-rail layouts use responsive Tailwind
  breakpoints (`lg:grid-cols-[...]`, `xl:grid-cols-[...]`) that default to a single
  column. **I did not render either page in a browser at 375px** — this is a code-review
  finding, not a visual confirmation, and should be treated as such.

---

## Check 11 — `tsc` / `vitest` / `eslint`

**`npx tsc --noEmit`** → 0 errors, 0 output. Matches inherited baseline.

**`npx vitest run`** → `Test Files 2 failed | 176 passed (178)`, `Tests 5 failed | 1592
passed (1597)`. Failing tests, by name:
```
FAIL src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated
FAIL src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent
```
Exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 — matches the
inherited baseline **by identity**.

Ran the targeted flaky test 5 times in a row:
`npx vitest run src/app/admin/emails/ -t "does not re-run the fetcher on a cache hit"`
→ `2 passed | 83 skipped` on every one of the 5 runs, no failures. Stable.

**`npx eslint .`** → volatile across runs due to the concurrently-edited
`src/app/admin/operations/**` files (explicitly out of scope per dispatch): observed
`59 errors, 7 warnings` / `59 errors, 12 warnings` / `59 errors, 8 warnings` /
`59 errors, 7 warnings` across four consecutive runs — **errors held at exactly 59 in
every run**; only the warning count moved (7↔12↔8↔7), and one run transiently showed a
7th file (`src/app/admin/operations/operations-data.ts`, then
`src/app/admin/operations/page.tsx` on the next run) that disappeared on the following
run — consistent with a file mid-save by the concurrent agent, not with this commit.
Scoped `npx eslint` to exactly this commit's six files directly:
`emails/page.tsx emails/emails-data.ts emails/__tests__/emails-data.test.ts
privacy/page.tsx privacy/privacy-data.ts privacy/__tests__/privacy-data.test.ts` →
**zero errors, zero warnings.** The 59-error/7-warning baseline (six files:
`design_handoff_area_pages/prototype/*.jsx` ×3 + `src/features/booking/*` ×3) matches
by identity; the warning-count volatility and transient 7th file are attributable to
the concurrent `operations/**` edit, not to `dc26dc0`.

---

## Summary

| # | Check | Result |
|---|---|---|
| HV | Stat tiles page-scoped? | **PASS** — privacy tiles are whole-table aggregates; emails' one bounded badge (`failedRecent`) is pre-existing, not a new regression |
| 1 | Six files, no components | PASS |
| 2 | Shared filter resolution, adversarial | PASS |
| 3 | Date-bounds fix | **FAIL** — cache-key stability fixed correctly, but "Today" preset now resolves to yesterday's midnight, a new user-visible bug |
| 4 | FAKE pager removed | PASS |
| 5 | Privacy's two regions | PASS, with a UX gap: "View all N" is a no-op once N > 500 and offers no ceiling messaging |
| 6 | Page-param behaviour | PASS, with a minor coupling noted (notes toggle drops queue page as a side effect) |
| 7 | C-08 Resend buttons untouched | PASS |
| 8 | Orchestrators mirror `getBookingsListPage` | PASS |
| 9 | Test assertions real | Mixed — shared-filter tests are real; date-bounds stability test is weak and would not have caught Check 3's bug |
| 10 | Code-rule compliance | PASS (375px verified by static scan only, not rendered) |
| 11 | tsc/vitest/eslint identity | PASS by identity; eslint volatility attributed to concurrent unrelated edits, not this commit |

**VERDICT: FAIL** — driven by Check 3's "Today" date-range regression on
`/admin/emails`. Recommend: in `resolveDeliveryDateBounds` (`emails-data.ts:344-346`),
change the `"today"` case to `fromIso: new Date(todayStart).toISOString()` (drop the
`- day`), and add a test asserting the actual returned boundary equals the start of the
current UTC day (not just that two calls agree with each other).
