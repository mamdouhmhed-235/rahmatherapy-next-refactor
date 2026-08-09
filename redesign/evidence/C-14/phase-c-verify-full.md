# C-14 Phase C — Independent FULL Verification

**Commit under verification:** `9f41430` (parent `72670e1`)
**Verifier mode:** read-only (git log/diff/show/status only; `execute_sql` SELECT-only)
**Verdict: PASS — zero BLOCKING findings.**

---

## 1 — Diff vs plan, step by step

`git diff 72670e1 9f41430 --stat` → exactly 12 files, matching the diff-stat table in the commit. All 12 map onto the plan's §3 files-touched list for Phase C (editors, actions, `assignment-eligibility.ts`, `availability.ts`, the migration, plus test files for each). `src/app/admin/availability/page.tsx` does **not** appear anywhere in the diff — confirmed clean of the concurrently-edited file.

Verified each step is genuinely, not partially, implemented:

- **Step 12** — migration file written, not applied (see §9).
- **Step 12a** — `src/app/admin/availability/actions.ts`: `createAvailabilityOverride` deleted, replaced by `saveAvailabilityOverride(overrideDate, schedule, reason)` doing delete-by-date then insert-segments (lines ~251-345). `src/app/admin/staff/[staffId]/availability/actions.ts`: `addStaffAvailabilityOverride` signature changed from FormData to `(staffId, date, schedule, reason)`, PG_UNIQUE_VIOLATION catch removed, replaced by an explicit `.select("id").eq("staff_id",...).eq("override_date",...).limit(1)` pre-check returning the **identical** field-error text `"That date already has an adjustment. Delete the existing one first."`.
- **Step 13** — `src/lib/booking/availability.ts`: `DayRecords.globalOverride?` → `globalOverrides: DateOverrideRecord[]` (L169); `staffOverrideByStaffId: Map<string, StaffDateOverrideRecord>` → `staffOverridesByStaffId: Map<string, StaffDateOverrideRecord[]>` (L171); `resolveStaffWindows` (L288-325) consumes both as arrays via `.some(isBlockingOverride)` / `normalizeWindows(...)`; `loadDayRecords` (L577+) buckets **every** row per date (L667) and per staff+date (L676-684), no first-row-wins.
- **Step 13a** — `src/app/admin/bookings/assignment-eligibility.ts`: global override fetch changed from `.maybeSingle<...>()` to `.returns<DateOverrideRow[]>()` (no single-row cardinality, so PGRST116 cannot occur); staff-override `Map<string, StaffDateOverrideRow>` (single, last-wins) → `Map<string, StaffDateOverrideRow[]>` built by push-append (L233-244); new `overrideWindows()` helper feeds all rows through `normalizeWindows`; blocking check widened to `staffDateOverrides.some(isBlockingOverride)`.
- **Step 14** — both `AvailabilityOverridesManager.tsx` and `StaffAvailabilityOverridesManager.tsx` import `WorkingHoursDayEditor` (itself untouched — `git diff` on that file and `working-hours-segments.ts` is empty, confirming Phase A's component is reused, not modified), add a `groupByDate()` grouping rows into one `OverrideDay` per date with sorted segments, and delete-handlers now take a **date** not a row id.

All five steps genuinely present. **PASS.**

---

## 2 — The migration file

`supabase/migrations/20260809160000_c14_override_breaks.sql` read in full. Executable body (between `BEGIN`/`COMMIT`):

```sql
ALTER TABLE public.availability_overrides
  DROP CONSTRAINT IF EXISTS availability_overrides_override_date_key;

ALTER TABLE public.staff_availability_overrides
  DROP CONSTRAINT IF EXISTS staff_availability_overrides_staff_id_override_date_key;
```

Exactly two statements, both `ALTER TABLE ... DROP CONSTRAINT IF EXISTS`, wrapped in `BEGIN`/`COMMIT`. No other DDL (no `CREATE`, no `GRANT`, no column change), no data statements (no `INSERT`/`UPDATE`/`DELETE`). The header's deviation note (approved `DROP INDEX` cannot run because the object is a constraint-owned index, not a bare index) is independently re-confirmed live below.

**Live verification (SELECT-only):**
```sql
SELECT rel.relname, con.conname, pg_get_constraintdef(con.oid), con.contype
FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace n ON n.oid = rel.relnamespace
WHERE n.nspname='public' AND rel.relname IN ('availability_overrides','staff_availability_overrides');
```
Result: both target uniques exist, exact names match the migration verbatim —
`availability_overrides_override_date_key` — `UNIQUE (override_date)` — `contype='u'`
`staff_availability_overrides_staff_id_override_date_key` — `UNIQUE (staff_id, override_date)` — `contype='u'`
— plus the PK/CHECK/FK rows the header claims are untouched. Object names in the migration are byte-correct against the live database.

`SELECT count(*) FROM availability_overrides` → **0**. `SELECT count(*) FROM staff_availability_overrides` → **0**. Confirms the orchestrator's "both tables empty" claim independently.

**PASS.**

---

## 3 — Atomic co-deploy (D12) — VERDICT: PASS (with one important caveat, non-blocking — see below)

**a. `createAvailabilityOverride` no longer upserts.** Confirmed by diff: the `.upsert(..., { onConflict: "override_date" })` call is gone; `saveAvailabilityOverride` now does `.delete().eq("override_date", date)` then `.insert(segments.map(...))`. No `onConflict` anywhere in the new function.

**b. `addStaffAvailabilityOverride`'s duplicate-date guard replaced, same user-visible error.** The `PG_UNIQUE_VIOLATION`/`23505` catch is gone from this function (grep confirms `PG_UNIQUE_VIOLATION` still exists in the file at L67/104 but is **unused by this function** — it is dead in this specific call site, not a stray reference bug). Replacement: an explicit `.select("id").eq(staff_id).eq(override_date).limit(1)` pre-check; if any row exists, returns `{ fieldErrors: { date: "That date already has an adjustment. Delete the existing one first." } }` — **identical text** to the pre-commit fallback message. Verified against `git show 72670e1:.../actions.ts` — same string, byte for byte.

**c. `assignment-eligibility.ts` widened, but a pre-existing, unrelated defect limits its real-world effect for the *global* half.** `.maybeSingle()` on `availability_overrides` is gone, replaced by `.returns<DateOverrideRow[]>()` (a plain array select — this class of query never errors on multi-row match, so the PGRST116 failure mode the migration header describes is genuinely eliminated). The staff-override `Map` is confirmed widened from `new Map(rows.map(...))` (last-row-wins) to a push-append `Map<string, StaffDateOverrideRow[]>` (L233-241), and the blocking check widened to `.some(isBlockingOverride)`.

**However** — independently discovered, not prompted by the dispatch: the global-override select statement, **unchanged by this commit** (present verbatim in parent `72670e1`), requests `"start_time, end_time, override_type"` from `availability_overrides`. Live schema check (`information_schema.columns`) shows `availability_overrides` has **no `override_type` column** (only `id, override_date, start_time, end_time, reason`) — confirmed by directly running that exact `SELECT` against the live DB, which returns `ERROR 42703: column "override_type" does not exist`. Since this code path never inspects `.error` (by design of the widening — see the file's own comment at L186-190 acknowledging the file "swallows query errors"), this means: **`getStaffAssignmentPreviews`'s global-override fetch has always silently failed, before and after this commit, on every invocation, regardless of row count** — global overrides have never actually reached admin assignment-eligibility computations. Step 13a's widening correctly fixes the multi-row (PGRST116) failure mode it targeted, but does not — and was not asked to — fix this separate, pre-existing, wrong-column defect. The staff-override half (`staff_availability_overrides` genuinely has `override_type`) is unaffected and works as intended.

This is **not a regression introduced by 9f41430** (verified present in `72670e1` verbatim) and does **not** make applying the Step 12 migration any less safe — the defect is orthogonal to row cardinality. It does mean the new test file `assignment-eligibility-overrides.test.ts`'s global-override specs pass against a fake Supabase client that (correctly, for a mock) doesn't enforce real column existence, so those specific tests do not reflect production behaviour for the global-override path. **Recommendation: flag as a separate, pre-existing bug fix (not part of this migration decision).** I am filing it as a spawned background task with file:line evidence rather than fixing it here (read-only mandate).

**Verdict on item 3: PASS.** All three required rewrites are present and correct on their own terms; the caveat above is a real, evidenced, pre-existing defect that does not bear on migration safety.

---

## 4 — Slot-engine widening (Step 13) — VERDICT: PASS, no regressions

Re-derived independently by symbol in `src/lib/booking/availability.ts`:

- `DayRecords.globalOverrides: DateOverrideRecord[]` (L169) bucketed by `byDate.get(row.override_date)?.globalOverrides.push(...)` (L667) inside the batched, multi-date `loadDayRecords` (confirmed still multi-date: `dates: string[]` param, single round-trip per table, L577+). Per-date grouping preserved — no date's array leaks into another's.
- Staff overrides widened at **all three** required points: the bucketing loop (L676-684, push-append instead of `if (!has) set`), the `Map` value type (`Map<string, StaffDateOverrideRecord[]>`, L171/655), and `resolveStaffWindows`'s consumption (L313-315: `.some(isBlockingOverride)` then `normalizeWindows(staffOverrides)` on the full array).
- `override_type`-blocking rows still produce full-day closure: `resolveStaffWindows` L314 (staff) and L321 (global) each `return []` if any row in the bucket is blocking, before ever reaching `normalizeWindows`. (Global overrides carry no `override_type` column by schema — correctly reflected: the `loadDayRecords` global-override push at L667 only sets `start_time`/`end_time`, never `override_type`, matching the live schema exactly — this file does NOT have the Step-13a defect.)

**Regression checks, independently confirmed via `git diff` hunk ranges** (`git diff 72670e1 9f41430 -- src/lib/booking/availability.ts` touches only L162-174, L286-321, L556-728 — nothing else):
- `loadContextRest` (L449+) — outside every hunk, untouched.
- C-23's options bag — `ignoreBookingWindow` (L890) / `ignorePublicPause` (L892) — outside every hunk, present and unchanged.
- Phase D's `isDateInBusinessWindow` lives in `src/lib/time/london.ts`, which has **zero** diff in this commit (`git diff 72670e1 9f41430 -- src/lib/time/london.ts` → empty).

**PASS.**

---

## 5 — The tests prove what they claim

`src/lib/booking/__tests__/override-windows.test.ts` (new, 17 specs) and `src/app/admin/bookings/__tests__/assignment-eligibility-overrides.test.ts` (new, 9 specs) both import and call the real production functions — `calculateAvailableSlots` from `../availability` and `getStaffAssignmentPreviews` from `../assignment-eligibility` respectively — with only a fake Supabase client (`createFakeAdminClient`) supplying table data. Confirmed by reading both files in full: no stubbed/mocked engine function anywhere, only the data layer is faked.

**Negative controls, judged:** each file includes explicit "negative control" specs that feed the engine a fixture containing *only the first row* of a break pair (byte-for-byte what a first-row-wins (or last-row-wins) bucketing implementation would produce from the full input), and assert the resulting behaviour is *observably different* from the corresponding positive spec (e.g. `times[times.length - 1]` is `"11:30"` under the reduced fixture vs `"19:00"` under the full one). Because `normalizeWindows`/`containsWindow` are deterministic pure functions of their input array, a fixture with N=1 row is exactly what the current code would receive if it *still* discarded all but the first row — so these controls genuinely demonstrate the positive specs' assertions are sensitive to whether all rows are processed, not vacuously true. I could not literally re-apply and revert the implementer's described mutation (read-only mandate forbids editing source), so this is a reasoned-through-code-inspection confirmation, not a re-executed mutation run — stated plainly per the "never claim a check you didn't run" rule.

**Spec-count discrepancy (non-blocking, informational):** the dispatch states "26 new specs." My independent count, comparing `it(` declarations before/after via `git diff`, finds **41** genuinely new specs: 17 in `override-windows.test.ts` (whole new file) + 9 in `assignment-eligibility-overrides.test.ts` (whole new file) + 8 net-new in `src/app/admin/availability/__tests__/actions.test.ts` (12→20, one test renamed not counted as new) + 7 net-new in `src/app/admin/staff/[staffId]/availability/__tests__/actions.test.ts` (4→11). More coverage than claimed, not less — not a red flag, but the reported figure is materially wrong and worth correcting in the record.

**Mutation-testing claim ("8 mutants, 6 engine + 2 eligibility"):** could not be independently re-run (read-only). Diffed `availability.ts` and `assignment-eligibility.ts` in full against `72670e1` — no mutation residue, half-reverted logic, or leftover debug code found; both diffs are clean, minimal, and internally consistent with the stated widening.

**Verdict on item 5: PASS**, with the caveat from §3 (the global-override eligibility specs pass against a mock that doesn't reproduce the real schema's column mismatch) and the spec-count correction above.

---

## 6 — Disclosed non-atomicity — judged, claim VERIFIED TRUE

Independently traced `resolveStaffWindows` (`availability.ts` L288-325): when `globalOverrides` is empty for a date (e.g., a failed insert after a successful delete leaves zero rows), execution falls through past both override branches to `return getRuleWindowsForDay(globalRules, dayOfWeek)` (L325) — i.e., **the date reads as the ordinary recurring weekly schedule for that weekday, not as closed.** This is categorically different from the Phase A/B RPC case, where zero rows for a *recurring* day-of-week means `getRuleWindowsForDay` finds no matching rows and returns `[]` — genuinely CLOSED. The implementer's claim that "zero override rows never reads as CLOSED" is **confirmed correct** by tracing the actual fallthrough path, not merely trusted. A failed override save is therefore visible (admin sees old data reload) and mild (reverts to normal hours, no over- or under-booking risk beyond "today behaves like an ordinary day"). **Not blocking.**

---

## 7 — Staff duplicate-date pre-check — severity judged

The replacement guard (§3b) is read-then-write: two concurrent `addStaffAvailabilityOverride` calls for the same staff+date can both pass the `.limit(1)` pre-check before either inserts, landing two sets of rows for one date. This is a genuine regression from DB-enforced uniqueness to an app-level TOCTOU race. Severity assessed as **low**: it requires two admins (or one admin double-submitting) to race a single-purpose, low-frequency, permission-gated admin form within the same request window; the failure is immediately visible in the admin UI (the date would show duplicated/overlapping segments) and trivially recoverable (delete-by-date removes all of it in one action, per Step 14). Honestly disclosed in the implementer's code comments. **Not blocking.**

---

## 8 — Gates, quoted verbatim

**`npx tsc --noEmit`** → clean, zero output, exit implied 0. **0 errors — matches expectation.**

**`npx vitest run`** — run three times for stability:
- Run 1: `Test Files  2 failed | 216 passed (218)` / `Tests  5 failed | 2198 passed (2203)`
- Run 2: `Test Files  2 failed | 217 passed (219)` / `Tests  5 failed | 2208 passed (2213)`
- Run 3: `Test Files  2 failed | 217 passed (219)` / `Tests  5 failed | 2208 passed (2213)`

Failing tests, **identical by name across all three runs**:
```
FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated
FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent
```
Exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3, exactly as the dispatch's baseline names — **matches by identity, no new failure introduced.** The total pass count fluctuated between run 1 (2203) and runs 2-3 (2213, stable) — same failing set both times; attributed to environment/import-timing flakiness (the tool's own duration log shows highly variable "import" phase timing, 227s–329s), not to this commit's content. **PASS by identity**, count variance noted for the record.

**`pnpm lint`** → `✖ 66 problems (59 errors, 7 warnings)`. Files with findings, verified by listing every unique path in the output:
```
design_handoff_area_pages/prototype/area-page.jsx
design_handoff_area_pages/prototype/shared.jsx
design_handoff_area_pages/prototype/site-chrome.jsx
src/features/booking/BookingExperience.tsx
src/features/booking/BookingExperienceLoader.tsx
src/features/booking/utils/returning-customer.ts
```
Exactly the six baseline files; none of the 12 files touched by `9f41430` appear. **59E/7W — matches expectation exactly. PASS.**

---

## 9 — ⛔ markers

**Migration NOT applied**, confirmed live: `pg_constraint` query (§2) shows both `availability_overrides_override_date_key` and `staff_availability_overrides_staff_id_override_date_key` still present with `contype='u'`. Consistent with the commit message's explicit "Step 12 — migration FILE only, NOT applied (orchestrator-owned)."

**No placeholder/assumed values.** Scanned the full diff for `TODO|FIXME|placeholder|XXX|hack|not implemented|stub` — only benign matches (HTML `placeholder=` attributes on form inputs, and the pre-existing `stubAdminClient` test-helper name). No incomplete work markers.

---

## Summary

**PASS.** No blocking findings.

**Non-blocking findings (in order of significance):**
1. **Pre-existing bug, not introduced by this commit**: `src/app/admin/bookings/assignment-eligibility.ts`'s global-override query selects a column (`override_type`) that does not exist on `availability_overrides` (verified live: the table has no such column; the exact SELECT string errors with Postgres `42703`). This means admin assignment-eligibility has never correctly incorporated global overrides, before or after `9f41430`. Step 13a's widening is real and correctly fixes the multi-row (PGRST116) failure mode it targeted, but this separate defect means the global-override half doesn't actually reach eligibility computations in production. Orthogonal to the Step 12 migration's safety. Recommend a dedicated follow-up fix (dropping `override_type` from that one `.select()`).
2. Spec count: 41 new specs by independent count, not the reported 26 (more coverage than claimed, reporting inaccuracy only).
3. `StaffAvailabilityOverridesManager.tsx` got no component test (`AvailabilityOverridesManager.test.tsx` was added; no staff equivalent) — action-layer logic is still covered via `actions.test.ts`.
4. `StaffAvailabilityOverridesManager.tsx` doesn't surface `override_type` at all (pre-existing scope gap predating this commit) — Step 14's "hide breaks editor for blocking-type overrides" is moot there since this UI never creates/displays such rows; the engine itself handles blocking correctly regardless.
5. `vitest` total pass count varied 2203 → 2213 across repeated runs with an identical failing set — environment flakiness, not attributable to `9f41430`.

**Explicit verdicts:** Item 3 (atomic co-deploy) — **PASS**, with the caveat above. Item 4 (slot-engine widening) — **PASS**, no regressions found in `loadContextRest`, the C-23 options bag, or the Phase D guard. Item 5 (tests) — **PASS**, real engine driven with faked data layer confirmed; negative controls genuinely encode the first-row-wins distinction. Item 6 (non-atomicity claim) — **VERIFIED TRUE**, zero override rows falls through to ordinary weekly hours, never reads as closed.

**Recommendation: safe to apply the migration.** The atomic co-deploy's three required rewrites are all present and correct; the one defect found is pre-existing, orthogonal to the constraint drop, and does not worsen with or depend on the migration being applied.
