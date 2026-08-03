VERDICT: FAIL

# C-16 Phase D Steps 11-12 — verification of commit `66e9391`

Read-only verification per `redesign/plans/C-phase/SUBAGENT-RULES.md`. Git limited to `log`/`diff`/`show`/`status`; no writes except this file.

## Check 1 — the locked verdict (do this first): PASS

`redesign/per-page-progress/C-16-data-growth-pagination-progress.md` §1 row 1 (lines 37-47) records the Phase A Step 2 HARD-STOP checkpoint as **ANSWERED 2026-08-03**, with an explicit Q9.4 verdict: **"PAGER at 100/page (LOG_PAGE_SIZE)"**, justified by: nothing links to a specific operational-event row, but `safe_context` is not duplicated into `audit_logs`, so the prior 300-row cap destroyed the only copy of older event detail.

Implementation matches this verdict exactly:
- `getOperationsEventsPage` (`operations-data.ts:198-222`) is a real pager: it counts (`countOperationalEvents(filters)`), clamps (`clampPage`), and ranges (`pageRange`) with `pageSize` defaulting to `LOG_PAGE_SIZE` (100).
- `page.tsx:114-123` calls it and renders `PaginationBar` (`page.tsx:449-455`) with `pageSize={LOG_PAGE_SIZE}`.
- This replaces the prior behaviour (confirmed via `git show 66e9391 -- operations-data.ts`): a static `OPERATIONS_DEFAULT_LIMIT` (300) cap with no pager UI and no `countOperationalEvents` filter support.

A pager shipped, not a documented cap. Check 1 is satisfied — the locked verdict was read, not re-decided, and the implementation is faithful to it.

## Check 2 — file scope: PASS

`git show 66e9391 --stat` lists exactly 8 files:
```
account-password-requests/__tests__/password-requests-data.test.ts (new)
account-password-requests/page.tsx
account-password-requests/password-requests-data.ts (new)
operations/__tests__/operations-board.test.tsx
operations/__tests__/operations-data.test.ts
operations/operations-board.tsx
operations/operations-data.ts
operations/page.tsx
```
`emails/**`, `privacy/**`, `bookings/**`, `src/lib/pagination.ts`, `src/app/admin/components/PaginationBar.tsx` do not appear — confirmed untouched by this commit. (A later `git diff 66e9391 -- emails/...` against the current working tree shows unrelated post-66e9391 changes to `emails-data.test.ts`; that is diff-against-HEAD noise, not part of this commit — `--stat` on the commit itself is the correct check and it is clean.)

`operations-board.tsx`'s presence is covered by the Owner-approved extension logged in the progress file §3.1 (row: `operations-board.tsx` / Step 11) — not a scope finding.

## Check 3 — shared filter resolution: PASS

`applyOperationsPredicates<Q>` (`operations-data.ts:106-115`) is the only place the `operational_events` WHERE clause is built. `getOperationsPageData` calls it at `:127-133` with `params`; `countOperationalEvents` calls it at `:160-163` with `filters`. `getOperationsEventsPage` (`:198-222`) resolves `filters` once and threads the *same* object to both `countOperationalEvents(filters)` (total) and `getOperationsPageData({...filters, limit, offset})` (rows). `page.tsx:91-108` builds `filtersForQuery` once and passes it through at `:120-123`.

Diff-verified the prior defect this replaces (`git show 66e9391 -- operations-data.ts`): `countOperationalEvents` previously took **zero** arguments, had cache key `["operations-count"]` (a single constant, filter-blind), and counted the whole table unconditionally. It is now genuinely fixed, not merely wrapped: it accepts `filters`, routes them through the shared predicate function, and its cache key (`operations-data.ts:168-178`) includes every filter field.

Adversarial check: no path was found where one query gets a predicate the other doesn't — both `getOperationsPageData` and `countOperationalEvents` are structurally forced through the one function. `operations-data.test.ts:157-211` ("countOperationalEvents honours the same filters as getOperationsPageData") proves this empirically: it captures the literal `eq`/`gte`/`lte`/`ilike` call sequence emitted by each function against a recording fake and asserts `countCalls` equals `rowCalls` — this is a comparison against the shared builder's actual behaviour, not a hand-written duplicate expectation, and would fail if either path silently diverged.

## Check 4 — the nested "Load more" removal: PASS

Diff (`git show 66e9391 -- operations-board.tsx`) confirms the removed mechanism: `DEFAULT_PAGE_SIZE = 50`, `pageSize` state per column, `visibleRows = allRows.slice(0, pageSize[key])`, and a "Load more" button that only incremented `pageSize[key]` — it never fetched anything; `allRows` was already the complete in-memory array for that column. All of `pageSize`, `DEFAULT_PAGE_SIZE`, `visibleRows`, `hasMore`, and the button were deleted, not merely hidden.

Current code (`operations-board.tsx:393`) does `allRows.map(...)` unconditionally — every row in the server-fetched page window renders. No orphaned per-column cap survives anywhere in the file (grepped the full diff; no residual `slice`/`pageSize` reference remains). No row is unreachable: the array being mapped is exactly what the server returned for the current page (bounded at `LOG_PAGE_SIZE` by the pager, not by any remaining client-side logic).

`operations-board.test.tsx:52-65` ("renders every row of a 70-event single-status page with no 'Load more' control") is a real regression guard — 70 exceeds the old 50-row cap, so this test would fail under the removed behaviour.

## Check 5 — the uneven-split UX: PASS, one caveat logged (not a failure)

`multiPage={pageCount > 1}` (`page.tsx:445`) is derived directly from `getOperationsEventsPage`'s real `pageCount` — correct.

Per-column empty-state swap (`operations-board.tsx:363-375`): non-multiPage uses `column.emptyTitle`/`emptyMessage` ("Nothing open" / "The clinic is humming"); multiPage uses `"{label}: none on this page"` / `"There may be more on another page — check the pager below."` Pinned both directions by `operations-board.test.tsx:98-117`.

**Caveat, logged not failed:** the board's top-level `allEmpty` early return (`operations-board.tsx:207-231`, reached when the *entire* fetched page has zero rows across all three columns) still uses unconditional global-sounding copy ("No operational events logged" / "Quietest week in months") with no `multiPage` gate at all. In practice this branch cannot be reached while `pageCount > 1` through the normal clamp→range flow (`clampPage` guarantees the requested page is inside `[1, pageCount]`, and every valid page in that range holds at least one row by construction) — the only way to hit it would be a race between the sequential `countOperationalEvents` and `getOperationsPageData` calls (rows deleted between the two awaits), which is a pre-existing, codebase-wide characteristic of this two-query pattern (shared with bookings/emails/privacy), not something newly introduced by this diff. Recorded for completeness; not counted as a check-5 failure.

## Check 6 — password requests (TARGETED): FAIL — real defect found

(a) **Bound in place** — PASS. `getPasswordResetRequests` caps at `PASSWORD_REQUESTS_LIMIT` (100), raised to `PASSWORD_REQUESTS_VIEW_ALL_CAP` (500) via `viewAll` (`password-requests-data.ts:60-61`, `:99-114`, `.limit(limit)` at `:113`). The prior query had no `.limit()` at all (confirmed via `git show 66e9391 -- .../password-requests-data.ts`, a new file — the old unbounded query lived inline in `page.tsx` before this step per the file's own header comment, `password-requests-data.ts:7-10`).

(b) **Cache-wrapped, tags `[AUDIT, STAFF]`, invalidation fires** — PASS. `unstable_cache(..., { tags: [TAGS.AUDIT, TAGS.STAFF] })` at `password-requests-data.ts:183` and `:214`. `actions.ts:223` (`approvePasswordResetRequest`) and `actions.ts:354` (`rejectPasswordResetRequest`) both call `updateTag(TAGS.AUDIT)` — `actions.ts` is not in this commit's file list (confirmed in check 2's `--stat`), so the claim "no change to actions.ts was needed" is verified true, not merely asserted.

(c) **`countPasswordResetRequests()` gives a real total** — PASS. `password-requests-data.ts:199-217`, a `head: true` count query with no `.limit()`, no `status` filter when called bare — genuinely uncapped.

(d) **`pendingCount` exact and cap-independent** — PASS. `countPasswordResetRequests("pending")` (`page.tsx:141`) is its own `.eq("status","pending")` head-count, independent of `PASSWORD_REQUESTS_LIMIT`.

**The trap — found broken.** `page.tsx:161-183`'s "hidden rows" banner is not honest in every reachable state:

```
141  const pendingCount = await countPasswordResetRequests("pending");
142  const hasHiddenRequests = totalCount > rows.length;
...
161  {hasHiddenRequests ? (
162    <p ...>
163      Showing the {PASSWORD_REQUESTS_LIMIT} most recent requests of {totalCount} total. Older
164      requests won't appear in any tab until you{" "}
165      <Link href={viewAllHref}>view all {totalCount}</Link>.
166    </p>
173  ) : viewAll && totalCount > PASSWORD_REQUESTS_LIMIT ? (
174    <p>Showing all {totalCount} requests. <Link href={recentHref}>Show recent {PASSWORD_REQUESTS_LIMIT} only</Link></p>
181  ) : null}
```

`hasHiddenRequests` is computed purely from `totalCount > rows.length` — it does not distinguish *which* cap produced `rows.length`. Concrete failure scenario: the real table total exceeds `PASSWORD_REQUESTS_VIEW_ALL_CAP` (500) and the operator is already in `viewAll` mode. Then `rows.length` is capped at 500 (not 100), `totalCount > 500`, so `hasHiddenRequests` is `true` and the code takes the **first** branch — the one hardcoded to `PASSWORD_REQUESTS_LIMIT` (100) — rendering *"Showing the 100 most recent requests of {totalCount} total... view all {totalCount}"* even though 500 rows are actually on screen, and the `view all {totalCount}` link (`viewAllHref`, which is already the active URL since `viewAll=true`) is a no-op: clicking it reloads the same capped-at-500 view, never the unbounded `totalCount` the copy promises.

This is exactly the scenario the dispatch's "trap" asked to be checked for: the UI does *not* say something honest when the cap hides rows, in the one state where honesty matters most (an operator who already clicked "view all" and still isn't seeing everything). It is reachable within the plan's own stated growth envelope — the file's header comment (`password-requests-data.ts:14`) accepts the brief's "hundreds of rows" 5-year projection for this table, and nothing in the schema or the reviewed code purges `approved`/`rejected`/`expired` rows, so accumulation past 500 over years of staff turnover and periodic resets is a real, not merely theoretical, eventuality — not an artificial edge case.

Fix would be to compare `totalCount` against the cap actually in effect (`viewAll ? PASSWORD_REQUESTS_VIEW_ALL_CAP : PASSWORD_REQUESTS_LIMIT`) rather than always quoting `PASSWORD_REQUESTS_LIMIT`, and to branch the "still capped after view-all" case separately from the "not yet viewing all" case.

Tabs filter coherently over the bounded set otherwise: `filterByStatus` (`page.tsx:46-61`) operates on `rows`, which is always the capped/view-all-capped array — confirmed by reading every branch; no tab reaches past the fetched set.

## Check 7 — millisecond cache-key defect: PASS, verified independently

Grepped both files directly for `Date.now()` / `new Date()`:
- `operations-data.ts`: zero matches (only the comment block at lines 40-45 stating its absence).
- `password-requests-data.ts`: zero matches.

Confirmed independently, not merely trusting the commit message: `operations-data.ts`'s `fromDate`/`toDate` are `YYYY-MM-DD` strings sourced from `page.tsx`'s `readParam(params, "from"/"to")` (URL-derived), never resolved from "now" inside the data layer. `password-requests-data.ts` has no date-range filter at all — its only cache-key-affecting parameter is `limit`/`viewAll` and `status`, both plain values. Neither file has the emails-feed-class defect.

## Check 8 — page-param behaviour: PASS (operations); N/A (password requests, by design)

Enumerated every URL-writing path on the operations surface:
- `makeOperationsPageHref` (`page.tsx:199-203`) — builds from a filter-only `currentFilterParams` (`:192-198`, populated only from `severity`/`event_type`/`status`/`from`/`to`/`q`) and sets `page` itself; never carries forward a prior `page`.
- `buildClearUrl` (`:138-148`) — no `page` key ever set.
- `presetUrl` (`:169-178`) — no `page` key ever set.
- "Clear filters" link (`:394`) — fixed `/admin/operations`, no query at all.
- The three severity stat-tile hrefs (`:220,233,246`) — fixed query strings (`severity=...&status=open#...`), no `page`.
- The GET filter form (`:306-401`) — browser-constructed submission replaces the entire query string with only the form's named fields; any existing `page` in the address bar is dropped on submit.

None of the six paths preserves a stale `page`. `clampPage`/`pageRange` (`src/lib/pagination.ts`, untouched by this commit, Phase-B-verified) clamp rather than 404 or render empty; `PaginationBar`'s `OffsetBar` (`PaginationBar.tsx:72`) returns `null` when `pageCount <= 1`. Pinned directly by `operations-data.test.ts:213-225` ("clamps a stale ?page=99 to the last real page" / "computes pageCount 1... when the total fits on one page").

Password requests has no `?page=` concept at all — its verdict is cap+view-all, not a pager (confirmed: `PageProps.searchParams` only ever destructures `status`/`all`, `page.tsx:105`) — so this check is structurally not applicable to that surface, not a gap in verification.

## Check 9 — all three test files: real, not vacuous

- `operations-data.test.ts:157-211` — captures actual predicate call sequences from both `countOperationalEvents` and `getOperationsPageData` via a recording fake and asserts equality; would fail on any real divergence, not a hand-copied expected list.
- `operations-board.test.tsx:52-65,80-95` — 70- and 100-row fixtures exceeding the old 50-row cap; would fail under the removed per-column-cap behaviour.
- `operations-board.test.tsx:98-117` — pins both directions of the `multiPage` empty-copy swap ("Nothing open" present/absent, "Open: none on this page" absent/present) — would fail if `multiPage` were ignored or the copy branch removed.
- `password-requests-data.test.ts:127-143` — asserts the literal value passed to `.limit()` via a `limitCalls` recorder, for both the default and `viewAll` cases — would fail if the cap value changed or the cap were dropped.
- `password-requests-data.test.ts:169-196` — cache-wrap and per-tag-invalidation behaviour, would fail if the fetch were left uncached (the pre-existing defect) or mis-tagged.
- `password-requests-data.test.ts:198-225` — asserts the count query returns the true total even when it exceeds `PASSWORD_REQUESTS_LIMIT`, and that unfiltered vs. status-filtered counts key separately.

All read as genuine regression guards tied to the specific defects each step claims to fix; none would pass with the fix reverted.

## Check 10 — code rules: PASS except the check-6 defect

- No `border-l-4` in either `operations/` or `account-password-requests/` (grepped).
- No `revalidateTag` in either directory; only `updateTag` (`actions.ts:223,354`).
- `createSupabaseAdminClient()` is only ever invoked inside the server data-helpers, which both pages call *after* `getStaffProfile`/access-gate checks (`page.tsx` operations: `:44-57`; page.tsx password-requests: `:108-124`).
- No new hardcoded `oklch(...)`: `oklch(` matches exist in `event-row.tsx`/`error.tsx` (operations) and `error.tsx`/`RequestRow.tsx`/`RejectModal.tsx`/`ApproveModal.tsx` (password-requests), but none of those five files are in this commit's file list (check 2) — pre-existing, not introduced here.
- Cache keys are JSON-safe: every `cacheKeyPart({...})` call site in both files (`operations-data.ts:141,170-177`; `password-requests-data.ts:182,213`) is fed only strings/numbers/booleans/undefined — no `Set`/`Map`/`Date`.
- `min-h-11` is present on `PaginationBar`'s pager controls (`PaginationBar.tsx:33`) — file untouched by this commit, Phase-B-verified already.
- **375px cleanliness was reviewed at the source level only** (responsive class review: `sm:`/`xl:` breakpoints, `overflow-x-auto` tab strips on both surfaces, mobile tab strip fallback on the operations board at `operations-board.tsx:250-289`) — this agent has no staff-authenticated session and cannot render the admin UI in a browser, consistent with the Phase A inventory's already-logged method deviation. This is a source review, not a rendered check — flagging the gap rather than claiming a check that was not run.

## Check 11 — verification commands: PASS (identity match)

`npx tsc --noEmit` → **0 errors.**

`npx vitest run` → **5 failed / 1617 passed** (178 files passed, 2 files failed). Failures, by identity:
```
FAIL src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated
FAIL src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent
```
Matches the inherited baseline exactly: `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3. No new failures, no swapped identity. None of the new operations/password-requests tests failed.

`npx eslint .` → **59 errors / 7 warnings**, confirmed in exactly six files:
```
design_handoff_area_pages/prototype/area-page.jsx
design_handoff_area_pages/prototype/shared.jsx
design_handoff_area_pages/prototype/site-chrome.jsx
src/features/booking/BookingExperience.tsx
src/features/booking/BookingExperienceLoader.tsx
src/features/booking/utils/returning-customer.ts
```
Matches the inherited baseline (59E/7W in exactly six files) by identity.

## Summary

Step 11 (operations) is a clean, faithful implementation of the locked PAGER verdict: the shared-predicate discipline structurally rules out count/rows divergence, the client-side "Load more" cap is genuinely removed with no orphaned reveal path, and the `multiPage` empty-copy correction is real and tested. Check 1 (the highest-priority check) passes cleanly.

Step 12 (password requests) gets the cap, the cache-wrapping, the real total, and the exact pending count all correctly — but the "hidden rows" banner in `page.tsx:161-183` gives a false accounting of what's on screen once a table exceeds `PASSWORD_REQUESTS_VIEW_ALL_CAP` (500) while `viewAll` is active: it always cites the 100-row default cap and offers a "view all N" link that is already active and will not surface anything more. This directly fails the check-6 "trap" — telling an operator an inaccurate story about what the cap is hiding — reachable within the plan's own stated growth horizon for this table. On that basis: **FAIL.**
