# C-16 Step 12 fix re-verification — commit `6fa19ce`

**VERDICT: PASS**

Re-verifies the fix for the verify-FAIL recorded in `redesign/evidence/C-16/steps1112-verify.md` (check 6) against `66e9391`. This clears the programme-wide freeze imposed under §2.9(b).

---

## Check 1 — commit scope

`git show 6fa19ce --stat`:

```
src/app/admin/account-password-requests/__tests__/password-requests-data.test.ts             | 18 ++
src/app/admin/account-password-requests/__tests__/resolvePasswordRequestsBannerState.test.ts | 69 ++
src/app/admin/account-password-requests/page.tsx                                             | 74 ++++---
3 files changed, 149 insertions(+), 12 deletions(-)
```

Exactly three files, all under `account-password-requests/`. `privacy/**`, `emails/**`, `operations/**`, `clients/**`, `enquiries/**`, `bookings/**`, `src/lib/pagination.ts`, `PaginationBar.tsx` are untouched by this commit (not in the stat output; confirmed by grep against the full repo diff between `66e9391` and `6fa19ce` — only the three listed files differ). **PASS.**

## Check 2 — re-derived banner states

`resolvePasswordRequestsBannerState` (`src/app/admin/account-password-requests/page.tsx:123-138`):

```
if (viewAll && totalCount > PASSWORD_REQUESTS_VIEW_ALL_CAP) return cappedOut   // line 128
if (totalCount > rowsLength) return hidden                                     // line 131
if (viewAll && totalCount > PASSWORD_REQUESTS_LIMIT) return viewingAll         // line 134
return none                                                                     // line 137
```
Constants: `PASSWORD_REQUESTS_LIMIT = 100`, `PASSWORD_REQUESTS_VIEW_ALL_CAP = 500` (`password-requests-data.ts:60-61`, unchanged by this commit).

My own derivation before reading the test file:

| total | rows | viewAll | my derivation | code produces | test coverage |
|---|---|---|---|---|---|
| 40 | 40 | false | equal → nothing hidden → `none` | `none` | not explicitly tested, but subsumed by the (50,50,false) case at `resolvePasswordRequestsBannerState.test.ts:19` |
| 250 | 100 | false | over LIMIT, capped fetch=100 → `hidden`, total 250 | `hidden`, totalCount 250 | `resolvePasswordRequestsBannerState.test.ts:27-34` |
| 250 | 250 | true | under VIEW_ALL_CAP, all fetched, but > LIMIT so worth flagging → `viewingAll`, total 250 | `viewingAll`, totalCount 250 | `resolvePasswordRequestsBannerState.test.ts:36-43` |
| 600 | 500 | true | over VIEW_ALL_CAP while already viewing all → `cappedOut`, total 600 (the original defect) | `cappedOut`, totalCount 600 | `resolvePasswordRequestsBannerState.test.ts:53-60` |
| 100 | 100 | false (boundary) | exactly at LIMIT, nothing truncated → `none` | `none` | **not directly tested** (nearest is 50/50 and 250/100 — see note below) |
| 500 | 500 | true (boundary) | exactly at VIEW_ALL_CAP, nothing truncated → `viewingAll` (not `cappedOut`, since `>` not `>=`) | `viewingAll`, totalCount 500 | `resolvePasswordRequestsBannerState.test.ts:45-51`, explicitly named as the boundary case |

All six derivations match the code's actual output — worked out independently from the function body and constants, then checked against the test file afterward, not read off the implementer's summary. One gap: the exact `total=100/rows=100/viewAll=false` boundary (as opposed to the `500/500/true` boundary, which the test file does cover explicitly) has no dedicated unit test. It's covered indirectly — my own derivation and manual trace of the `if` chain confirm it resolves to `none` correctly — but a future regression at that specific boundary (e.g. an accidental `>=`) wouldn't be caught by name. This is a minor test-coverage gap, not a correctness defect; noting it rather than treating it as a fail condition since check 2 asked me to derive and compare, which I did and it holds.

The banner text always names the cap actually in force: `cappedOut` → "first {VIEW_ALL_CAP} of {total}… **Show recent {LIMIT} only**" (`page.tsx:200-210`, links to `recentHref`, which drops `all=1`); `hidden` → "the {LIMIT} most recent … **view all {total}**" (`page.tsx:211-222`, links to `viewAllHref`, which adds `all=1`); `viewingAll` → "all {total} … **Show recent {LIMIT} only**" (`page.tsx:223-232`, links to `recentHref`). In every case the link target differs from the state that produced it (never points back at the current URL), so no dead link is possible. **PASS.**

## Check 3 — branch ordering

`cappedOut` is checked first (`page.tsx:128`), `hidden` second (`page.tsx:131`) — confirmed by reading the function body directly.

A dedicated ordering test exists at `resolvePasswordRequestsBannerState.test.ts:62-68`:
```ts
it("takes the cappedOut branch over the generic hidden branch when both conditions are technically true", () => {
  const result = resolvePasswordRequestsBannerState(650, 500, true);
  expect(result.kind).toBe("cappedOut");
});
```
This is a genuine ordering pin, not an outcomes-only check: at `(650, 500, true)`, `totalCount > VIEW_ALL_CAP` (650>500) **and** `totalCount > rowsLength` (650>500) are simultaneously true. If the two `if` statements were swapped, this exact input would return `hidden` instead of `cappedOut` and the test would fail. Traced through by hand — confirmed. **PASS.**

## Check 4 — consistency with the privacy fix (`6faf895`)

`git show 6faf895 -- src/app/admin/privacy/page.tsx` shows the privacy rail added `PRIVACY_NOTES_VIEW_ALL_CAP` import and:
```ts
const cappedOut = notesViewAll && notesTotal > PRIVACY_NOTES_VIEW_ALL_CAP;   // privacy/page.tsx:928
```
rendered as `cappedOut ? ... : hasHiddenNotes ? ... : (notesViewAll && notesTotal > PRIVACY_NOTES_LIMIT) ? ... : null` (`privacy/page.tsx:993-1025`) — same three-state shape, same branch order (`cappedOut` before the generic hidden check), same principle (state plainly what's unreachable, keep only a working "show fewer" link, never a dead "view all"). Verified both `cappedOut` branches link to a `*RecentHref` that drops the view-all param, never to the current URL.

Structural difference: privacy computes `cappedOut` as an inline `const` inside the component; password-requests extracts the whole state machine into an exported, independently-tested pure function `resolvePasswordRequestsBannerState`. The code comment (`page.tsx:114-116`) says this mirrors `resolvePrivacyDateBounds` — checked, that function does exist as an exported pure function in `privacy/page.tsx:192` — so the claimed precedent is accurate, not fabricated. Judged as a reasonable, non-drift improvement (better testability), not an inconsistency in behavior.

Wording difference: privacy's `cappedOut` copy says "The rest aren't reachable from this rail — open individual clients to review them" (`privacy/page.tsx:999-1000`); password-requests says only "The rest aren't reachable from this page" (`page.tsx:203`). Checked whether password-requests has an equivalent per-item escape hatch: `RequestRow.tsx` only links to the audit log for rows that are *currently rendered* (`RequestRow.tsx:210-231`, gated on `canOpenAudit`); there is no way to reach a specific password-reset request that fell outside the cap by any other route (no per-request detail page exists, unlike `/admin/clients/[id]`). The omitted alternate-path clause is therefore accurate to this surface's actual navigation structure, not drift — privacy has a real escape hatch and says so; password-requests doesn't have one and correctly doesn't claim one. **PASS.**

## Check 5 — nothing from `66e9391` was lost

`password-requests-data.ts` is **not** in `6fa19ce`'s file list (check 1) — confirms it's untouched, so everything in it is exactly as `66e9391` left it:
- `PASSWORD_REQUESTS_LIMIT = 100`, `PASSWORD_REQUESTS_VIEW_ALL_CAP = 500` — unchanged (`password-requests-data.ts:60-61`).
- `getPasswordResetRequests` still `unstable_cache`-wrapped, tags `[TAGS.AUDIT, TAGS.STAFF]` (`password-requests-data.ts:104,183`).
- `countPasswordResetRequests()` (no status arg) still uncapped — head-count query with no `.eq()` filter, independent of the row limit (`password-requests-data.ts:199-217`).
- `pendingCount` still comes from the same cap-independent `countPasswordResetRequests("pending")` call, unchanged (`page.tsx:177`).
- In-memory tab filtering via `filterByStatus` (`page.tsx:47-62`) is untouched — not present in the `6fa19ce` diff at all.

`git diff 66e9391 6fa19ce -- page.tsx` confirms the only removed line of substance is `const hasHiddenRequests = totalCount > rows.length;` (old, buggy single-boolean check), replaced by the `bannerState` computation — nothing else in the component changed. **PASS.**

## Check 6 — tab-honesty claim

New test at `password-requests-data.test.ts:233-242`:
```ts
it("stays exact even when the capped row fetch would hide pending requests the tab should count", async () => {
  ...
  const rows = await getPasswordResetRequests();
  const pendingCount = await countPasswordResetRequests("pending");
  expect(rows.length).toBeLessThan(pendingCount);
  expect(pendingCount).toBe(140);
});
```
Verified this is genuinely true in the implementation, not just the mock: `countPasswordResetRequests` issues its own independent `{count: "exact", head: true}` Supabase query with `.eq("status", status)` applied when a status is given (`password-requests-data.ts:199-211`) — it never reads from or is derived from `rows`/`getPasswordResetRequests`'s output. The two functions are structurally decoupled in the source, which is what the test is pinning (the mock's `count` value being independent of `requests` merely exercises that decoupling, it doesn't manufacture it).

**What a user actually sees:** the "Pending (N)" tab badge (`page.tsx:239-242`, driven by `pendingCount`) is always exact. But the *rendered* Pending tab content comes from `filterByStatus(rows, "pending")` (`page.tsx:47-62`), where `rows` is the capped fetch (100, or 500 with view-all), ordered by `requested_at` across **all** statuses. Since pending requests expire 24h after creation, they're normally within the "most recent N" window regardless of N — but if request volume across *all* statuses is unusually high in a short window, a genuinely-pending request could in principle be sorted outside the cap, so the badge count and the number of rows the Pending tab actually renders could diverge in that edge case.

Is the UI honest about this? Yes, indirectly: `bannerState.kind === "hidden"` fires whenever `totalCount > rows.length` — i.e. whenever the cap is hiding *any* row of *any* status — and that banner's copy is `"Older requests won't appear in any tab until you view all {N}."` (`page.tsx:213-214`), which explicitly covers the pending tab too. So a user who sees a pending-badge count higher than what's rendered will also see the generic hidden-rows banner warning them that some requests (unspecified which) aren't shown in any tab. It's not per-tab-specific, but it isn't silent either. This is an accepted, documented design tradeoff from the Step 12 verdict ("pending" is "self-bounding", `password-requests-data.ts:16-20`), not a new gap introduced by this fix, and it is not the defect shape the FAIL was about. **PASS**, with this caveat stated for the record.

## Check 7 — are the new test assertions real?

Traced by hand (not read off the summary):
- The `cappedOut`-vs-`hidden` ordering test (`resolvePasswordRequestsBannerState.test.ts:62-68`) would fail if the two branches were swapped — confirmed under check 3.
- Reverting to the pre-fix single-boolean logic (`hasHiddenRequests = totalCount > rows.length`, no `cappedOut` concept) and feeding it `(650, 500, true)` produces `{kind: "hidden"}` under old logic — the new test at `resolvePasswordRequestsBannerState.test.ts:53-60` expects `{kind: "cappedOut", totalCount: 650}` and would fail against that reverted behavior. No test would pass "with the feature removed" (i.e. against the actual pre-fix code) — several fail immediately on import if `resolvePasswordRequestsBannerState` doesn't exist, and even against a hand-rolled bug-compatible version without `cappedOut`, the boundary and ordering tests fail as shown. **PASS.**

## Check 8 — third-instance sweep

Repo-wide grep for the cap/view-all-toggle shape (`_LIMIT`, `_VIEW_ALL_CAP`, `View all`, `cappedOut`) across `src/app/admin/**` turns up only `privacy/**` and `account-password-requests/**` using the `LIMIT`/`VIEW_ALL_CAP` same-page-toggle pattern. Spot-checked three other "View all"-style affordances:

1. **`dashboard/PractitionerTodaySection.tsx:333-372`** — `capped = appointments.slice(0, 5)`; `appointments` is already the complete "today" dataset (today's bookings are inherently small, not itself a capped fetch), so `.length` is exact and there's no cap-vs-real-total comparison to get wrong. "View all today's visits" links to a **different page** (`/admin/bookings?view=today`), not a same-page toggle. Structurally immune.
2. **`bookings/series/[templateId]/page.tsx:294,313,444`** — `totalCount = (upcomingCount ?? 0) + (pastCount ?? 0)`, both destructured directly from exact-count Supabase queries (`{ count: upcomingCount }` / `{ count: pastCount }`, lines 231-232) — not derived from any capped array's `.length`. "View all {totalCount} visits" links to `/admin/bookings?view=series&templateId=...`, a cross-page link with an always-exact count. No same-page cap-raise toggle exists on this page at all. Structurally immune.
3. **`operations/operations-data.ts`** (Step 11, same commit `66e9391` that also produced Step 12) — uses the real pager pattern (`getOperationsEventsPage`: count → clamp → range via a shared `applyOperationsPredicates` helper), mirroring `PaginationBar`. This is the "shared pager" shape the sweep claims immunity for, not the cap+view-all shape at all — confirmed no `_LIMIT`/`_VIEW_ALL_CAP` pair exists in this file.

Also checked `admin-scalable-lists.tsx:365-529`'s `SAVED_VIEW_LIMIT` — this is a max-count guard on *creating* saved views, unrelated to hiding rows from a read view; not a fourth instance.

I agree with the implementer's sweep conclusion for the surfaces checked. **PASS**, with the caveat that I spot-checked three surfaces rather than auditing the entire `admin/` tree exhaustively — a missed fourth instance elsewhere in the tree remains possible but wasn't found in the areas checked.

## Check 9 — tsc / vitest / eslint

**`npx tsc --noEmit`** → 0 errors (empty output).

**`npx vitest run`** → tail:
```
Test Files  2 failed | 183 passed (185)
     Tests  5 failed | 1682 passed (1687)
  Start at  21:26:04
  Duration  45.54s
```
Failing tests, by name:
```
FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated
FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent
```
Matches the inherited baseline by identity: `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3, no new/swapped failure. The new `resolvePasswordRequestsBannerState.test.ts` and the `password-requests-data.test.ts` addition are both green (not in the failure list).

**`npx eslint .`** → `✖ 66 problems (59 errors, 7 warnings)`, across exactly these six files:
```
design_handoff_area_pages/prototype/area-page.jsx
design_handoff_area_pages/prototype/shared.jsx
design_handoff_area_pages/prototype/site-chrome.jsx
src/features/booking/BookingExperience.tsx
src/features/booking/BookingExperienceLoader.tsx
src/features/booking/utils/returning-customer.ts
```
Matches the inherited baseline (59 errors / 7 warnings, same six files) exactly. **PASS.**

## Check 10 — git status

`git status --porcelain` shows: the pre-existing `.playwright-mcp/**` and `design_handoff_public_pages/**` deletions (unrelated, pre-existing); `M src/lib/maintenance.ts` — the standing Owner-owned change, not touched or further described here per instruction; untracked `design_handoff_area_pages/`, `photos-rahma-therapy/`, `redesign/evidence/C-16/step9-fix-reverify.md`, `redesign/evidence/C-16/steps1112-verify.md`, `redesign/evidence/C-16/steps910-verify.md`, `redesign/evidence/C-16/step8-verify-full.md`, `redesign/evidence/C-21/*.png`, `test-results/`. None of these are under `clients/**` or `enquiries/**`; nothing was modified by my verification run itself (tsc/vitest/eslint are read-only checks, and none of these paths are their output). I did not create, edit, or touch any of these — they predate or are outside this re-verification. **PASS**, nothing unexpected caused by this session.

---

## Summary

All ten checks pass. The fix in `6fa19ce` correctly resolves the `cappedOut`-vs-`hidden` mislabeling defect that failed `66e9391`, is consistent with the precedent set by the privacy fix (`6faf895`) with a justified (not drifted) wording difference, preserves everything `66e9391` got right, is covered by tests that genuinely pin both the outcomes and the branch ordering, and does not reintroduce or leave behind a third instance of the bug shape in the three other admin surfaces spot-checked. Baselines (tsc/vitest/eslint) hold by identity. One minor, non-blocking observation: the exact `total=100/rows=100/viewAll=false` boundary has no dedicated unit test (covered only by manual derivation here), and the "Pending (N)" badge can in a rare high-volume edge case exceed what the Pending tab actually renders — mitigated by the umbrella "hidden" banner, and this is a pre-existing accepted tradeoff from the Step 12 verdict, not a new or reintroduced defect.

**This clears the programme-wide freeze imposed by the `steps1112-verify.md` FAIL.**
