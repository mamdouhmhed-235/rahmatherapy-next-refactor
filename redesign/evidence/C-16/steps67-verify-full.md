# C-16 Phase C Steps 6-7 — FULL verification (commit `c54df61`)

VERDICT: PASS

Scope note: `src/app/admin/bookings/__tests__/view-predicates-parity.test.ts` is being
concurrently edited by another agent and is explicitly NOT this commit's subject (it
belongs to the predecessor, Step 5, `ca0cc21`, verified separately). It is not part of
`c54df61`'s file list and nothing below relies on its live working-copy content. All
claims about `c54df61` itself are sourced from `git show c54df61[:<path>]` /
`git show c54df61 -- <path>`, not the live working tree, except where noted (tsc/vitest/
eslint were run against the working tree, which for the five files this commit touches
was confirmed identical to `c54df61` via `git status --short` showing no pending changes
under `src/app/admin/bookings/`).

---

## Check 1 — `git show c54df61 --stat`

```
 src/app/admin/bookings/BookingsChrome.tsx                          |  89 ++++-
 .../bookings/__tests__/booking-view-counts.test.ts                 | 368 +++++++++++++++++++++
 .../__tests__/bookings-page-param.test.tsx                         | 228 +++++++++++++
 src/app/admin/bookings/bookings-list-data.ts                       | 144 ++++++--
 src/app/admin/bookings/page.tsx                                    |  92 +++++-
 5 files changed, 881 insertions(+), 40 deletions(-)
```
Exactly five files, matching the dispatch's list exactly (including the two new test
files). No others. `BookingsChrome.tsx`'s presence is the pre-granted files-touched
extension (2026-08-03), not a finding. **PASS.**

---

## Check 2 — The chip-count correctness claim (heart of Step 6)

Traced structurally, not just by reading the docstring claim:

- `resolveBookingPredicateContext` (`bookings-list-data.ts:846-858`) builds ONE
  `BookingPredicateContext` per request from `filters` + `profile`-derived scalars +
  `getSearchClientIds(filters.search)` (resolved once).
- `getBookingViewCounts` (`:950-967`) does `views.map((view) => countBookings({ ...base, view }))`
  — object-spread swaps only `view`; every other field (`status`, `assignmentStatus`,
  `paymentStatus`, `requiredGender`, `service`, `location`, `assignedStaff`, `from`,
  `to`, `search`, `searchClientIds`, `staffId`, `staffGender`, `canClaim`, `today`)
  is carried through unchanged from `base`.
- `countBookings` (`:776-800`) runs that context through `buildBookingPredicatePlan`
  (`:273-401`) — **the exact same builder** `getBookingsListData` (`:681-766`) runs
  for the row query — via the same `applyBookingPredicates` replay (`:428-465`) and
  the same `bookingSelectWith` embed-joining (`:468-477`). There is no second code
  path that could encode a chip's rule differently from its row query.
- Both the row query and the chip's count query build their PostgREST embeds from
  `plan.embeds`, the same array, so an EXISTS join present for one is present for
  the other — verified no `.select()` diverges between them (row query:
  `bookingSelectWith(BOOKING_SELECT, plan.embeds)`; count query:
  `bookingSelectWith("id", plan.embeds)` — same embeds, different field list, which
  cannot affect the WHERE clause).

**Adversarial check — is there any view where count and row path diverge?**
- Pagination (`limit`/`offset`) is a separate argument to `getBookingsListData`, never
  part of `BookingPredicateContext`/the cache key math for the plan itself — so it
  cannot leak into the count's WHERE clause. Confirmed by test
  `booking-view-counts.test.ts:309-327` ("counts and lists through one predicate — the
  two queries carry identical filters"), which asserts `rowQuery.filters` deep-equals
  `countQuery.filters` using a filter-call recorder, not a description of intent.
- Filters that ride along with a chip click (status/location/etc.) are carried by both
  the URL a chip actually points to (`BookingsChrome.tsx:114-126 readQueryString`,
  which keeps every param except `view`/`page`) and by `getVisibleViewCounts`'s
  `base` context — same source object (`bookingListFiltersFromQuery(query, currentView)`,
  `page.tsx:317-318` vs `BookingListSection`'s `bookingListFiltersFromQuery(query, currentView)`
  at `page.tsx:373`). Verified by test `booking-view-counts.test.ts:183-214`, which
  passes a non-view filter (`payment_status: "unpaid"`) and asserts every one of the 11
  chip queries carries it.
- `searchClientIds` is resolved once in `resolveBookingPredicateContext` and shared by
  reference across all 11 `{...base, view}` contexts, so a chip cannot see a different
  search snapshot than the list — verified by test `booking-view-counts.test.ts:236-255`
  (one `clients` table query total, and every bookings query's filter list contains the
  same resolved id).

No divergence found: a "Claimable 7" chip that opens to 3 rows would require either a
different builder, a different embed set, or a different filter object reaching the
count query than the row query — all three are structurally the same object/function
by construction, and the parity is pinned by a real assertion, not just a comment.
**PASS.**

---

## Check 3 — Therapist-scope chip counts (the `filterBookings`-oracle path)

`getVisibleViewCounts` (`page.tsx:305-333`):
```ts
const { rows } = await getBookingsListPage({ profile, canViewAll, filters });
for (const view of views) counts[view] = filterBookings(rows, query, profile, view).length;
```
vs `BookingListSection` (`page.tsx:373-378`):
```ts
listPage = await getBookingsListPage({ profile, canViewAll,
  filters: bookingListFiltersFromQuery(query, currentView), page: getQueryValue(query.page) });
...
const filteredBookings = canViewAll ? listPage.rows : filterBookings(listPage.rows, query, profile, currentView);
```

(a) **Correct**: both call sites source `rows` from the identical
`getBookingsListData({ profile, canViewAll: false })` (`bookings-list-data.ts:880-882`
early-return branch) — `filters`/`page` are accepted as params but never forwarded into
that call for the scoped branch, so both callers fetch the SAME unfiltered
assigned+claimable union, then apply the SAME unmodified `filterBookings` oracle
(diff-verified untouched: `git diff ca0cc21 c54df61 -- page.tsx` shows no edit inside
`filterBookings`'s body, only new call sites). The chip counts and the rendered list
are the same predicate function over the same rows, differing only in which `view`
each is evaluated against (per-chip vs `currentView`) — exactly mirroring the
clinic-wide design.

(b) **No extra read**: `getBookingsListData`'s cache key
(`bookings-list-data.ts:749-762`) is
`cacheKeyPart({ staffId, staffGender, canViewAll, canClaim, limit, offset, predicates })`.
For the scoped branch neither caller passes `limit`/`offset`/`predicates`, so both
produce the byte-identical key regardless of `filters`/`page` differing between the two
call sites — confirmed by static comparison, not runtime tracing (see caveat below).
This is a necessary condition for "one cache entry"; I did not independently trace the
Next.js Data Cache at runtime to confirm zero duplicate Supabase round-trips (would need
network/DB request logging under a live dev server, outside a static/vitest-based
verification) — flagging per rule 5, not claiming a check I did not run.

(c) **Agreement with the list**: since (a) established both consume the identical `rows`
array and the identical `filterBookings` function, and the list's `currentView` is one
of the swept `views`, the chip for `currentView` and the on-screen row count are
mathematically the same expression evaluated on the same input. **PASS**, with the
runtime-dedup caveat in (b) noted rather than asserted.

---

## Check 4 — Cache keys

`countBookings` key: `["bookings-count", cacheKeyPart({ predicates })]`
(`bookings-list-data.ts:796`). `predicates` (`BookingPredicateContext`,
`:228-236`) carries `staffId`, `staffGender`, `canClaim` plus every filter
(`view`, `status`, ..., `search`, `searchClientIds`). All staff-scoped inputs the
plan and dispatch worry about (`staffId`, staff gender, claim permission) are present
— a chip's "Assigned to me" or "Claimable" (both `staffId`/`staffGender`/`canClaim`-
dependent per `buildBookingPredicatePlan:319-336`) cannot be served from another
therapist's cache entry. Concrete failure scenario this guards: two admins who can both
`manage_bookings_all` open Bookings — Admin A's "Claimable" count (gender-matched to A)
would leak into Admin B's chip if `staffGender`/`canClaim` were absent from the key;
they are present, so it does not.

JSON-safety: `BookingPredicateContext` fields are `string | boolean | string[] |
undefined` only — no `Set`/`Map`/`Date`. The header comment at
`bookings-list-data.ts:8-11` explicitly keeps `profile` (which carries a `Set` of
permissions) as a closure-only argument, never spread into the cached context; verified
`resolveBookingPredicateContext` (`:846-858`) only extracts scalars (`profile.id`,
`profile.gender`) and a boolean (`canClaimAssignments(profile)`), never `profile`
itself. `cacheKeyPart` (`src/lib/cache/cache-key.ts`, pre-existing/unchanged)
`JSON.stringify`s the result, which drops nested `undefined` values automatically —
no manual recursion needed for the nested `predicates` object to stay collision-free
across an absent-vs-explicitly-undefined filter. **PASS.**

---

## Check 5 — Only visible chips are counted

`visibleBookingViews(true)` (`bookings-list-data.ts:916-931`) returns exactly the 11
keys `FULL_PRIMARY` (4: attention/today/upcoming/claimable) ∪ `FULL_OVERFLOW` (7:
assigned/unassigned/partially_assigned/completed/cancelled/all/series) render
(`BookingsChrome.tsx:45-58`, `:339,397` — `primaryKeys`/`overflowKeys` map 1:1 onto
these two arrays). `visibleBookingViews(false)` returns exactly `THERAPIST_PRIMARY` (3)
∪ `THERAPIST_OVERFLOW` (2) = 5. No chip renders from any key outside these
arrays (the nav only ever maps `primaryKeys`/`overflowKeys`), and no key in
`visibleBookingViews`'s output is absent from them. **PASS** — pinned in code and by
test (Check 6, below).

---

## Check 6 — The duplicate list, and whether the pinning test is load-bearing

`visibleBookingViews` (`bookings-list-data.ts:916-931`) is a hand-written second copy
of `BookingsChrome`'s `FULL_PRIMARY`/`FULL_OVERFLOW`/`THERAPIST_PRIMARY`/
`THERAPIST_OVERFLOW` arrays (now exported specifically so the test can import them,
`BookingsChrome.tsx:45,50,59-60`), justified by the `"use client"` boundary a server
component can't cross.

Reasoned through the pinning test (`booking-view-counts.test.ts:257-267`):
```ts
expect([...visibleBookingViews(true)].sort()).toEqual([...FULL_PRIMARY, ...FULL_OVERFLOW].sort());
expect([...visibleBookingViews(false)].sort()).toEqual([...THERAPIST_PRIMARY, ...THERAPIST_OVERFLOW].sort());
```
This imports the *actual* arrays from `BookingsChrome.tsx` (not a third hand-copied
list) and compares sorted contents against `visibleBookingViews`'s hardcoded output via
`toEqual`. Concrete divergence scenario: if a future change adds a 12th view (e.g.
`"draft"`) to `FULL_OVERFLOW` in `BookingsChrome.tsx` without touching
`visibleBookingViews`, `[...FULL_PRIMARY, ...FULL_OVERFLOW].sort()` gains an element
`visibleBookingViews(true)` lacks — `toEqual` on unequal-length arrays fails
deterministically. Same for a removal, a rename, or a key moved between primary/
overflow (sort neutralises order/bucket, but not membership). This is a real,
mechanically-enforced pin, not a comment-only promise — it would have caught 5 of the
programme's 6 prior "two things that should be one thing" defects (any that manifested
as a membership difference; it would NOT catch two lists differing only in which array
— primary vs overflow — a key sits in, since sorting merges both into one set before
comparing, but that class of drift doesn't affect Check 5's "no hidden/missing chip"
guarantee, only chip grouping, which isn't this test's job).

Judgement: pinning-by-test (vs. widening scope into `bookings/_helpers.ts`) is a
reasonable, proportionate call under SUBAGENT-RULES rule 4 (never widen scope
unprompted) — `_helpers.ts` is a shared surface this step's dispatch didn't authorise
touching. The trade-off is real: this is a CI-time guardrail, not a compile-time one — a
change that lands without running tests would still ship a drifted list undetected until
someone notices a missing/extra chip in the browser. That is a process risk inherent to
any test-pinned invariant, not specific to this implementation. **PASS**, with the
caveat noted for the record.

---

## Check 7 — Page-param behaviour (Step 7)

`clampPage` (`src/lib/pagination.ts`, pre-existing/unchanged Phase B primitive):
1-based, clamps `NaN`/negative/zero to 1, clamps above `pageCount` down to `pageCount`.
`getBookingsListPage` (`bookings-list-data.ts:869-905`) calls `countBookings` →
computes `pageCount` → `clampPage(params.page, pageCount)` → `pageRange` → windows —
count-then-clamp-then-window, in that order (`:891-902`). A stale `?page=99` clamps to
the real last page rather than 404ing or rendering empty — verified by test
`booking-view-counts.test.ts:271-290` (60 rows / 25 per page = 3 pages; `page=99` →
`page: 3`, row query ranges `[[50,74]]`).

**Every URL-writing path enumerated** (grepped `admin/bookings?` and
`URLSearchParams`/`params.set`/`params.delete` across `page.tsx` + `BookingsChrome.tsx`):
| Path | Drops `page`? | Evidence |
|---|---|---|
| View chip / overflow-menu links | Yes, explicit | `BookingsChrome.tsx:114-126` `readQueryString` skips `key === "page"` |
| `clearFilter` (single active-filter chip ×) | Yes, explicit | `BookingsChrome.tsx:245-250` `params.delete("page")` |
| `clearAllFilters` | Yes, implicit (fresh params) | `BookingsChrome.tsx:252-256` — only `view` set |
| `FilterForm` GET submit | Yes, implicit (no hidden field) | `BookingsChrome.tsx:588` only sets `view`; no `name="page"` input anywhere in the form — confirmed by test `bookings-page-param.test.tsx:109-117` |
| `buildClearSearchHref` | Yes, explicit | `page.tsx:543` `key === "page"` excluded |
| "Clear filters" empty-state link | Yes, implicit | `page.tsx:580` — fresh `?view=${view}` string |
| `handleSaveView` / `handleApplySavedView` | Yes, explicit | `BookingsChrome.tsx:263,286` `withoutPage(...)` |
| `PaginationBar`'s `makeHref` (the ONE path that legitimately keeps it) | N/A — this IS the page nav | `page.tsx:366-370` copies `retryParams` (built from `query`, which has no `page` key at render time since the fetch already consumed the raw value) then sets `page` |

No path was missed: I grepped every `/admin/bookings?` string literal and every
`URLSearchParams` construction in both files and every one is accounted for above.
`series/[templateId]/page.tsx:313`'s `?view=series&templateId=...` is a deep link INTO
the list from elsewhere, not a filter-change-from-within-the-list nav — out of Step 7's
"result set changes while already on the list" scope. **PASS** — this is exactly the
class of defect C-07 B2 hit twice (dropping `from`/`to`, then `scope`, on a
rebuild-from-scratch); here every writer was checked individually rather than assumed.

---

## Check 8 — Saved views

Three strip points, all present:
1. **On save** — `handleSaveView` (`BookingsChrome.tsx:258-271`):
   `withoutPage(searchParams.toString())` before persisting. Test
   `bookings-page-param.test.tsx:134-150` saves from `page=3`, asserts the persisted
   `query` lacks `page=`.
2. **On apply** — `handleApplySavedView` (`:281-287`): `navigateToQuery(withoutPage(target.query))`.
   Test `bookings-page-param.test.tsx:152-168` seeds `localStorage` directly with a
   pre-existing entry carrying `&page=3` (the migration case — a view saved by an
   earlier build of the app, never rewritten), applies it, and asserts the pushed URL
   lacks `page=` — this is the exact "already stored with `?page=3`" scenario the
   dispatch calls out, and it is explicitly exercised, not just reasoned about.
3. **Active-view comparison** — `currentQuery`/`activeSavedViewId`
   (`:289-293`) compares `withoutPage(searchParams.toString())` against
   `withoutPage(view.query)` on both sides, so a view saved page-free still shows as
   active while the reader is on page 2 — test `bookings-page-param.test.tsx:170-183`
   confirms `aria-current="true"` holds with `page=2` in the live URL against a
   page-free stored query.

**PASS**, all three verified with tests that exercise the pre-existing-localStorage
migration case specifically, not just the save-then-apply round trip.

---

## Check 9 — The interim gap is closed

`getBookingsListPage` (`bookings-list-data.ts:869-905`): `countBookings` → `pageCount`
→ `clampPage` → `pageRange` → `getBookingsListData({ limit: pageSize, offset: from,
predicates })` → returns `{ rows, total, page, pageCount }` (a `PaginatedResult<BookingRecord>`,
`:838`). `PaginationBar` renders below the list (`page.tsx:492-499`), inside
`BookingListSection`. Therapist branch: `getBookingsListPage`'s early return
(`:880-883`) reports `{ page: 1, pageCount: 1 }` unconditionally, and `PaginationBar`'s
`OffsetBar` renders `null` when `pageCount <= 1` (`PaginationBar.tsx`, pre-existing
Phase B code, unchanged) — verified by test `bookings-page-param.test.tsx:211-227`
("renders nothing for the one-page result") and
`booking-view-counts.test.ts:345-367` ("leaves the therapist-scoped branch un-paged").
**PASS.**

---

## Check 10 — Q9.5: is the "0.596 ms / 13 buffers" measurement defensible at scale?

**Not fully — this needs revisiting before the table grows materially, and the commit
message's framing overstates what the measurement supports.**

I independently re-ran the underlying facts against the live database
(project `twzutkfgqclqurvkmvqz`, read-only `execute_sql`):
- `SELECT count(*) FROM bookings` → **15 rows**, matching the commit message's "15 live
  rows" exactly (not fabricated).
- `pg_indexes` on `bookings` → three indexes: `bookings_pkey` (id), a partial index on
  `(client_id, status) WHERE status = 'completed'`, and a partial index on
  `recurring_template_id WHERE NOT NULL`. **No index touches `booking_date`,
  `start_time`, `status` (unqualified), `assignment_status`, `reschedule_status`,
  `customer_cancelled_at`, or `payment_status`** — the columns most of the 11 view
  predicates filter on.
- `EXPLAIN (ANALYZE, BUFFERS)` on the `attention` chip's predicate (the OR of
  `status`/`assignment_status`/`reschedule_status`/`customer_cancelled_at`) →
  **`Seq Scan on bookings`**, `Buffers: shared hit=1`, `Execution Time: 0.072 ms`.

This confirms the measurement is real, not fabricated — but it is a sequential scan of
a 15-row table, which is trivially fast regardless of predicate shape. Sequential-scan
cost is O(table size), not O(matching rows); the plan's own 5-year projection is
10-15k rows (brief §1.1). 11 sequential full-table scans per bookings-page render (the
chip fan-out), fired on every clinic-wide admin's every page load, is a fundamentally
different cost profile at 10-15k rows than at 15 — and nothing in this commit or its
verification measures that. The plan's own pre-flight step 3 anticipated exactly this
("If a materially-helpful index is missing, FLAG to user (separate follow-up; not
C-16)") but that flag was written against the row query's `ORDER BY booking_date`, not
against the Step-6 count fan-out's 11x multiplier on the same unindexed columns — the
fan-out is new load this step adds on top of an already-flagged gap, and it was not
re-measured against it.

Plainly: **all-chips is not defensible as currently evidenced for the 5-year horizon.**
It is defensible for TODAY's data (correctly measured, correctly concluded not to bite
right now) and the commit's engineering is otherwise sound — count and row queries are
provably the same predicate (Check 2), so there is no *correctness* risk here, only an
unverified *performance* claim. This should be tracked as a follow-up (consistent with
the plan's own §9 open question 4, "Index follow-ups... separate user-confirmed
change") rather than block this commit, since: the plan's Step 6 text only requires
"measure render cost in the gate" (done, on the live table, as instructed — the plan
does not specify measuring at a synthetic projected scale), and the Q9.5 fallback
(active chip + total only) remains available to apply later without a schema change if
the concern materialises. I am flagging a background task for this separately.

---

## Check 11 — Are the new tests real?

**`booking-view-counts.test.ts`** (368 lines): builds a recording fake Supabase admin
client (`createRecordingAdminClient`, `:108-152`) that captures every filter-builder
call verbatim, and a `planQuery` helper (`:154-160`) that runs
`buildBookingPredicatePlan`/`applyBookingPredicates` independently and records what
*that* production code would send. The parity assertion (`:206-213`) compares what
`getBookingViewCounts` actually sent to PostgREST against `planQuery`'s independent
recording — this is a genuine differential test, not a fixed-expectation test with
hand-typed predicates. **Would it catch a regression?** Yes: if `getBookingViewCounts`
stopped calling `countBookings`/`buildBookingPredicatePlan` (e.g., someone hand-rolled a
per-view `if` chain instead of reusing the plan), `sent[index].filters` would no longer
equal `planQuery({...ctx, view})`'s output and the test fails. The "counts and lists
through one predicate" test (`:309-327`) directly compares the count query's recorded
filters against the row query's recorded filters from the SAME `getBookingsListPage`
call — this fails immediately if the two ever use different predicate objects.

**`bookings-page-param.test.tsx`** (228 lines): renders the real `BookingsChrome`
component (not a mock) with `page=3`/`page=4`/etc. in the query, and asserts on actual
DOM output (`href` attributes, `localStorage` contents, `nav.push` call arguments) —
**would it catch a regression?** Yes: `it("view chips carry every filter across but
never the page")` asserts `href` does not contain `page=` for all 11 rendered chip
links; if a future edit re-added `page` to `readQueryString`'s copied params, this
fails on a plain `.not.toContain` check, not an indirect inference. Same for the
filter-clear, saved-view-save, and saved-view-apply tests — each asserts on the actual
string that would be written to the URL bar or `localStorage`, sourced from the
component under test, not restated by hand.

Both files pass under the current suite (confirmed in Check 12). **PASS** — the
assertions are load-bearing, not decorative.

---

## Check 12 — Static gates

**`npx tsc --noEmit`** → clean, 0 errors (empty output). Matches baseline.

**`npx vitest run`** → tail:
```
 Test Files  2 failed | 176 passed (178)
      Tests  5 failed | 1576 passed (1581)
```
Failures, by identity (via `grep FAIL`):
```
FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated
FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent
```
Exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 — **identity match**
to the inherited baseline. No new failures; both new C-16 test files
(`booking-view-counts.test.ts`, `bookings-page-param.test.tsx`) pass in full. The known
`emails-data.test.ts` cache-key flake did not trigger this run (not reported as new
since it wasn't observed — noted per instruction, not claimed).

**`npx eslint .`** → `66 problems (59 errors, 7 warnings)`, in exactly six files:
`design_handoff_area_pages/prototype/area-page.jsx`, `.../shared.jsx`,
`.../site-chrome.jsx`, `src/features/booking/BookingExperience.tsx`,
`src/features/booking/BookingExperienceLoader.tsx`,
`src/features/booking/utils/returning-customer.ts` — **identity match** to the
59-error/7-warning six-file baseline. None of this commit's five files appear.

**PASS** — all three gates match the inherited baseline by identity.

---

## Check 13 — Code rules

- `border-l-4`: `git show c54df61 | grep border-l-4` → no matches. **PASS.**
- `revalidateTag`: no matches in the diff (the commit doesn't touch cache invalidation
  at all — it's a read-path-only change). **PASS.**
- `createSupabaseAdminClient()` only after `getStaffProfile()`: `page.tsx` calls
  `getStaffProfile(supabase)` at `:217`; `getVisibleViewCounts` (`:293-333`, which
  triggers `createSupabaseAdminClient()` transitively via `getBookingViewCounts` /
  `getBookingsListPage`) and `BookingListSection` (which triggers it via
  `getBookingsListPage`) are both only ever invoked after that line resolves.
  **PASS.**
- No new hardcoded `oklch(...)` literals: `git show c54df61 | grep "oklch("` → no
  matches; all new styling in `BookingsChrome.tsx`'s `ViewCount` badge uses
  `var(--admin-*)` tokens (`:356-361`). **PASS.**
- Mobile-first / clean at 375px: reviewed by code reading only (no live viewport
  render performed in this verification) — the chip nav already had
  `overflow-x-auto` before this change and the new `ViewCount` badge is an inline
  flex child with no fixed width, so it wraps within the existing pill without a new
  overflow source; `PaginationBar`'s `OffsetBar` already stacks the readout above the
  buttons at narrow widths (pre-existing Phase B code, unchanged here) with
  `flex-col ... sm:flex-row`. Stated as code-review-only, not a rendered check, per
  rule 5.
- `min-h-11` touch targets on the pager controls: present in `PaginationBar.tsx`'s
  `controlClassName` (`min-h-11 items-center justify-center ...`) — this file is
  unchanged by `c54df61` (it's Phase B, pre-existing), and this commit's only
  interaction with it is passing props (`page.tsx:494-499`), not restyling it.
  **PASS** (inherited, confirmed still present, not regressed).

---

## Summary

All 13 checks performed. Twelve are clean PASSes with direct evidence. Check 10 (Q9.5)
surfaces a real, evidence-backed gap: the "not taken" fallback decision is measured
correctly for today's 15-row table but does not defend the plan's own 5-year
projection, and the predicates involved are confirmed sequential scans with no
supporting indexes. This is a performance-scaling risk, not a correctness defect (Check
2 independently proves count/row parity), and the plan's own open-questions section
already anticipates handling missing indexes as a separate, user-confirmed follow-up
rather than bundling it into C-16. Flagging as a background task rather than blocking.

VERDICT: PASS
