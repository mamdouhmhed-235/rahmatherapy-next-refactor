# C-07 Phase B4 — FULL-tier verification of `f038b4f`

**VERDICT: PASS**

Commit verified: `f038b4fccab3997637fba7a7a91368ff1a80c2ac` — "feat(redesign): C-07 B4 — saved views namespaced per staff id + spec coverage (B-161 in-place)", HEAD of `master` at time of verification.

Context confirmed before judging the diff: per the progress file (`redesign/per-page-progress/C-07-routing-and-per-role-defaults-progress.md` §1.8/§1.8a), the plan's original Steps 14–16 (new `src/lib/booking/saved-filters.ts` + `SavedFiltersBar.tsx`) were cancelled by Owner ruling because the capability already ships in `BookingsChrome.tsx` (`449f722`, pre-programme). B4 closes as VERIFY-ALREADY-IMPLEMENTED plus a scoped fix round for two gaps (namespacing + tests). The absence of the two plan-named files is correct and is not a finding. This diff was judged against the fix-round spec, not against Steps 14–16.

---

## Check 1 — `git show f038b4f --stat` / full diff: exactly three files, no others

Confirmed:
```
src/app/admin/bookings/BookingsChrome.tsx          | 41 +++++--
.../admin/bookings/__tests__/savedViews.test.ts    | 120 +++++++++++++++++++++
src/app/admin/bookings/page.tsx                    |  1 +
3 files changed, 152 insertions(+), 10 deletions(-)
```
No other files touched. `src/lib/booking/saved-filters.ts` and `src/app/admin/bookings/SavedFiltersBar.tsx` were not created (correct, per the cancellation ruling).

## Check 2 — Re-derived storage logic: cross-staff leak / legacy-key resurfacing / purge-skip paths

Read post-change `BookingsChrome.tsx:90-151` directly (not the implementer's summary):

- `storageKeyFor(staffId)` (line 90-92) → `` `rahma.admin.bookings.saved-views.v2.${staffId}` ``. `staffId` is `profile.id`, the `staff_profiles` table's DB primary key (`src/lib/auth/rbac.ts:340-384`) — a stable UUID, not an editable/derived field (unlike the `role_name` display-label trap from an earlier C-07 phase). Two distinct staff ids always produce two distinct keys; no collision path exists short of two staff rows sharing a primary key, which the DB precludes.
- `loadSavedViews(staffId)` (line 115-142): first line is `if (typeof window === "undefined") return [];` — this is the pre-existing **SSR** guard only, unrelated to the purge; on the server there is no localStorage to purge from, so skipping is correct, not a bug.
- The **legacy purge** (`window.localStorage.removeItem(LEGACY_GLOBAL_STORAGE_KEY)`, line 122-126) runs **unconditionally**, in its own try/catch, immediately after the SSR guard and **before** any staff-id-keyed read. It does not sit behind an "if key present" check and does not sit behind the current staff id's own "absent key → return []" branch (that branch is a *separate*, later try block reading `storageKeyFor(staffId)`, line 127-141). So there is no ordering where the purge is skipped because the current staff's own key happens to be empty — the purge always fires first, on every `loadSavedViews` call, for every staff id.
- **Legacy-key contents can never resurface**: `LEGACY_GLOBAL_STORAGE_KEY` (`"rahma.admin.bookings.saved-views.v1"`) is referenced exactly once in the file — inside the `removeItem` call. There is no `getItem` on it anywhere, no migration/copy step. Its contents are structurally unreachable after this change, for any staff id.
- **Cross-staff read**: every read/write of saved views goes through `storageKeyFor(staffId)` (load: line 128; persist: line 147). No code path in `loadSavedViews`, `persistSavedViews`, `handleSaveView`, or `handleRemoveView` reads/writes any key other than the one derived from the `staffId` argument passed in. `FilterForm` and `SavedViewBar` (the latter in `src/app/admin/components/admin-scalable-lists.tsx`, untouched by this diff) never touch `localStorage` directly — `SavedViewBar` only receives `views`/`onApply`/`onSave`/`onRemove` as props and contains the (unchanged) 20-item cap, name-uniqueness/length validation, and two-step inline remove-confirm UI (`admin-scalable-lists.tsx:365-437`). No path found where one staff id's data is readable under another.

**Conclusion: no cross-staff leak path, no legacy-resurfacing path, no purge-skip path.**

## Check 3 — `useEffect` dependency array / stale-closure risk

`BookingsChrome.tsx:169-172`:
```
React.useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setSavedViews(loadSavedViews(staffId));
}, [staffId]);
```
Dependency array is `[staffId]` (previously `[]`). If `staffId` changes on a live-mounted instance, the effect re-fires and **replaces** `savedViews` wholesale via `setSavedViews(loadSavedViews(staffId))` — it does not merge with the prior array, so the previous staff id's views cannot linger in state after the effect runs. `handleSaveView`/`handleRemoveView` derive `next` from the current `savedViews` closure and immediately call both `setSavedViews(next)` and `persistSavedViews(staffId, next)` with the same in-scope `staffId`, so no stale-staffId write is possible within a single render's event handlers. (In practice `staffId` originates from a Server Component prop fetched fresh via `getStaffProfile()` per request, so a live in-place staff-id swap without a full remount is not a real-world path here; the dependency array is correct defensive behaviour regardless, matching the fix-round spec's explicit requirement.)

## Check 4 — `git show f038b4f -- src/app/admin/bookings/page.tsx`

One hunk:
```diff
@@ -259,6 +259,7 @@ export default async function BookingsPage({
         services={services}
         staff={staff}
         canViewAll={canViewAll}
+        staffId={profile.id}
       />
```
Verified `profile` cannot be null at this point: `page.tsx:211-213` — `const profile = await getStaffProfile(supabase); if (!profile || !profile.active) { return <...denied...>; }` — an early return guards every use of `profile` below it, including line 262. Zero behavioural drift; purely a new prop pass-through.

## Check 5 — New spec file: assertion strength, vacuousness, and genuine regression-detection

Read `src/app/admin/bookings/__tests__/savedViews.test.ts` in full (9 tests). Per case:

- `storageKeyFor derives a distinct v2 key per staff id` — asserts exact string output for two ids and inequality between them. Not vacuous; pins the key format including the `v2.` segment.
- `round-trips: persistSavedViews then loadSavedViews for the same staff id` — straightforward, exercises the happy path.
- **`isolates saved views per staff id — staff B never sees staff A's saved views`** — persists under `"staff-a"`, asserts `loadSavedViews("staff-b")` is `[]` and `loadSavedViews("staff-a")` still has length 1. **Reasoned through a revert**: if `staffId` were accepted but ignored (falling back to a single global key, i.e. the pre-fix behaviour), `persistSavedViews("staff-a", …)` would write to that shared key and `loadSavedViews("staff-b")` would read the same key back, returning length-1, not `[]` — the `toEqual([])` assertion would fail. This test **genuinely fails** if namespacing were reverted; it is not vacuous.
- `returns [] when nothing has ever been saved for this staff id` — absent-key path.
- `returns [] for a non-JSON string stored under the key` / `returns [] when stored value is valid JSON but not an array` — corrupt-data resilience, matches the two `try/catch` and `Array.isArray` guards in the implementation.
- `filters out entries with wrong-typed or missing id/label/query, keeping valid ones` — seeds 8 malformed/mixed entries (numeric id, null label, missing query, missing id, a bare string, `null`, `undefined`) plus one valid entry, asserts only the valid one survives. Exercises the exact per-entry type-guard predicate in `loadSavedViews` (`typeof entry.id === "string" && ...`).
- **`purges the legacy global v1 key on load and never returns its contents to any staff id`** — seeds the legacy key with data, calls `loadSavedViews("staff-a")`, asserts result is `[]` **and** the legacy key is now `null` in storage; re-seeds the legacy key and repeats for `"staff-b"`, asserting the same. This directly exercises both the "never migrated" and "removed" halves of Gap 1's spec, and would fail under either a reverted purge or an accidental migration-on-read.
- `is idempotent when the legacy global key is already absent` — confirms no throw when there's nothing to purge.

No assertion found that would pass equally well with the feature reverted or removed (i.e., no vacuous assertions). The cross-staff isolation test and the legacy-purge test are both genuine regression detectors for the two stated gaps.

## Check 6 — `npx tsc --noEmit`

Ran. **0 errors** (empty output). Matches inherited baseline.

## Check 7 — `npx vitest run`

Ran. Tail:
```
Test Files  2 failed | 171 passed (173)
     Tests  5 failed | 1494 passed (1499)
```
Failing tests, confirmed by name:
```
FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated
FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent
```
This is exactly the inherited baseline identity: `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3, 5 total, no swapped-in new failure. All 9 new `savedViews.test.ts` cases pass (none appear in the failure list). Raw pass/total counts (1494/1499) differ from the last recorded figure in the progress file (1483/1488 at `838d049`), but per the dispatch's own instruction the progress file's counts are known to have drifted and identity is the only thing that matters — identity matches exactly, so this is a PASS by the stated rule. Only doc commits landed between `838d049` and `f038b4f` (confirmed via `git log --oneline 838d049..f038b4f`), so the small count delta is not attributable to this diff regardless.

## Check 8 — `npx eslint .`

Ran (`npx eslint . > <scratchpad>/eslint_out.txt 2>&1`). Tail: `✖ 66 problems (59 errors, 7 warnings)`. Grepped the full output for `BookingsChrome`, `savedViews`, `admin/bookings` — zero matches. Manually confirmed the errors/warnings are confined to the same six baseline files: `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` and `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`. Identity matches the inherited baseline exactly.

## Check 9 — `git status --porcelain`

Ran. Inside `src/`, the only modification is `M src/lib/maintenance.ts` — the known Owner-owned uncommitted change, not touched, not reported as dirt per instruction. All other porcelain output is pre-existing dirt under `.playwright-mcp/`, `design_handoff_public_pages/` (deletions), `design_handoff_area_pages/`, `photos-rahma-therapy/`, `test-results/`, `redesign/evidence/C-21/*.png` — all in the excluded/expected list. Nothing staged or modified inside `src/` beyond that one known file.

## Check 10 — No silently-implemented ⛔/⏸ markers

`git show f038b4f | grep -i "⛔\|⏸\|TODO\|FIXME\|placeholder\|assumed"` → no matches. Nothing in this diff carries a placeholder/assumed-value marker.

## `FilterForm` prop-type change — judged, not just noted

`FilterForm`'s signature changed from `Props & { mobile?: boolean }` to `Omit<Props, "staffId"> & { mobile?: boolean }` (`BookingsChrome.tsx:497-504`). Verified: `FilterForm`'s destructured params are `currentView, query, services, staff, canViewAll, mobile` — `staffId` is never read in its body. Both call sites (`BookingsChrome.tsx:425-431` desktop, `:463-470` mobile) never pass `staffId` and didn't before this change either. Since `Props.staffId` is now a required (non-optional) field, leaving `FilterForm`'s type as `Props & {mobile?}` would have made both existing call sites fail to typecheck (missing required prop) without changing anything about what they render. `Omit<Props, "staffId">` is exactly the minimal type-only consequence of adding a required field to `Props` — it does not hide any behavioural change; `FilterForm`'s runtime behaviour is untouched.

---

## BLOCKING findings

None.

## Non-blocking observations

- None beyond what the progress file already logs as Owner-accepted deviations (desktop saved-views bar always-visible for `canViewAll` roles; no mobile save affordance) — neither is in scope for this diff and neither was touched by it.

## Summary

All ten checks pass. The three-file diff is exactly the fix-round spec: `staffId` threaded from `page.tsx` (one-line, provably safe against non-null `profile`) into `BookingsChrome.tsx`, storage keys namespaced per staff id via `storageKeyFor`, the legacy global key purged unconditionally on every load with no read/migration path, the mount effect keyed on `staffId`, and a 9-case spec file that includes at least two assertions (cross-staff isolation, legacy-purge) that would genuinely fail if the fix were reverted. `tsc`, `vitest`, and `eslint` all match their inherited baselines by identity, and `git status` shows no unexpected dirt inside `src/`.
