# C-14 Phase B (Steps 10–11) — Independent FULL Verification

**Commit under verification:** `233a61ea6b517ab0c7f513a394b31b0f07a1924d` (parent `b5c8c81`)
**Verifier:** read-only subagent, `git log/diff/show/status` only, `execute_sql` SELECT-only.
**Verdict: PASS.** Zero blocking findings. One non-blocking documentation gap (below).

---

## 1 — Diff vs plan, file by file

`git diff b5c8c81 233a61e --stat`:

```
 .../StaffAvailabilityRulesForm.test.tsx            | 234 ++++++++
 .../availability/StaffAvailabilityRulesForm.tsx    | 620 ++++++++++-----------
 src/app/admin/staff/__tests__/actions.test.ts      | 176 +++++-
 src/app/admin/staff/actions.ts                     | 119 ++++
 .../__tests__/staff-recurring-windows.test.ts      | 253 +++++++++
 5 files changed, 1090 insertions(+), 312 deletions(-)
```

Exactly the five files the dispatch named. `src/lib/booking/availability.ts` does **not** appear in this diff — confirmed absent, matching the plan's zero-engine-change premise for Phase B. No file outside the plan's Phase B files-touched list (`src/app/admin/staff/actions.ts`, `StaffAvailabilityRulesForm.tsx`) was touched by commit `233a61e` itself (the two extra source-adjacent files are its own new/expanded test files).

## 2 — Step 11's central claim, re-derived independently

**Claim:** `resolveStaffWindows` already normalizes every recurring row for a staff weekday; no engine change needed for Phase B.

Verified by reading the exact blob at commit `233a61e` (`git show 233a61e:src/lib/booking/availability.ts`, saved to a scratch copy and cross-checked against disk — see caveat in §7) — **not** the implementer's chain, independently:

- `loadContextRest`, `availability.ts:535-541` (commit blob):
  ```
  const staffRulesByStaffId = new Map<string, StaffAvailabilityRuleRecord[]>();
  for (const rule of staffRulesResult.data ?? []) {
    staffRulesByStaffId.set(rule.staff_id, [
      ...(staffRulesByStaffId.get(rule.staff_id) ?? []),
      rule,
    ]);
  }
  ```
  This **appends** every row for a staff_id — genuinely accumulates, never overwrites.

- `resolveStaffWindows`, `availability.ts:309-311`, custom-mode branch:
  ```
  if (staff.availability_mode === "custom") {
    return getRuleWindowsForDay(staffRulesByStaffId.get(staff.id) ?? [], dayOfWeek);
  }
  ```
  Hands the **whole array** for that staff to `getRuleWindowsForDay`.

- `getRuleWindowsForDay`, `availability.ts:275-282`:
  ```
  return normalizeWindows(
    rules.filter((rule) => rule.day_of_week === dayOfWeek && rule.is_working_day)
  );
  ```
  Filters by day + is_working_day, passes **all** survivors to `normalizeWindows`.

- `normalizeWindows`, `availability.ts:204-213`: `.flatMap` — every surviving record becomes a window, not just the first.
- `containsWindow`, `availability.ts:215-217`: `.some()` — a slot books if it fits inside **any** window.

**Claim holds.** No engine change was required for Phase B; the chain genuinely handles N rows per staff weekday.

**§9 "first-row-wins" confinement, also re-derived from the same commit blob:**
- `loadDayRecords`, `availability.ts:651-656`: `if (day && !day.globalOverride) { day.globalOverride = {...} }` — first-row-wins, **global override table only**.
- `loadDayRecords`, `availability.ts:662-672`: `if (day && !day.staffOverrideByStaffId.has(row.staff_id)) { ...set(...) }` — first-row-wins, **staff override table only**.

Both are confined to `availability_overrides` / `staff_availability_overrides` — the tables `staffRulesByStaffId` (recurring rules, §2 above) never touches. Confirms the plan's framing: this is Phase C's scope (Step 13), not a Phase B miss.

## 3 — Step 11's test: proves what it claims

`src/lib/booking/__tests__/staff-recurring-windows.test.ts`:
- Imports `calculateAvailableSlots` from `../availability` (the real engine) — `import { calculateAvailableSlots } from "../availability";` at line 32.
- Fakes only the Supabase layer via the pre-existing `createFakeAdminClient` helper (`src/lib/cache/__tests__/fake-supabase-admin.ts`, not touched by this diff).
- Negative control (line 212-221) feeds only `STAFF_DAY_WITH_BREAK[0]` (the first row) and asserts `times[times.length - 1]` is `"11:30"` (day ends before the break) and `times` excludes `"15:00"`. The main spec (line 147-166) asserts the day ends at `"19:00"` and includes `"15:00"`. **These two expectations are mutually exclusive** — if `resolveStaffWindows` only consumed the first row, the main spec's assertions would fail exactly as the negative control demonstrates. The test is not vacuous.
- 7 `it(...)` blocks total, matching the commit message's claim of "7 for the engine."

## 4 — RPC call vs deployed function signature

Migration: `supabase/migrations/20260809120000_c14_save_availability_day.sql` (already applied 2026-08-09 under Phase A's approval — confirmed via Progress §2.4 and live query below).

Live signature, re-verified SELECT-only:
```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'save_staff_availability_day';
```
→ `{"proname":"save_staff_availability_day","args":"p_staff_id uuid, p_day_of_week integer, p_segments jsonb","prosecdef":false,"proconfig":["search_path=public"]}`

Code call, `src/app/admin/staff/actions.ts` (new `saveStaffAvailabilityDay`):
```ts
const { data, error } = await adminClient.rpc("save_staff_availability_day", {
  p_staff_id: staffId,
  p_day_of_week: dayOfWeek,
  p_segments: segments,
});
```
Named-arg match confirmed: `p_staff_id`/`p_day_of_week`/`p_segments` against `uuid`/`integer`/`jsonb`. `segments = scheduleToRows(normalized)` (from `working-hours-segments.ts`) returns `{ start_time: string; end_time: string; is_working_day: boolean }[]` — exactly what `assert_availability_day_segments` (called inside `save_staff_availability_day`) validates: string `start_time`/`end_time`, boolean `is_working_day`. No mismatch.

## 5 — Privilege trap

```sql
select has_table_privilege('service_role','public.staff_availability_rules','SELECT') as sel,
       has_table_privilege('service_role','public.staff_availability_rules','INSERT') as ins,
       has_table_privilege('service_role','public.staff_availability_rules','UPDATE') as upd,
       has_table_privilege('service_role','public.staff_availability_rules','DELETE') as del;
```
→ `{"sel":true,"ins":true,"upd":false,"del":true}` — confirmed live, no UPDATE. `saveStaffAvailabilityDay` never issues an UPDATE against this table — it calls the RPC, whose body (read via the migration file) is DELETE + INSERT only, under `SECURITY INVOKER`, so it is bound by exactly these privileges. No path in the new code touches UPDATE.

## 6 — Four disclosed judgement calls

**(a) `normalizeSchedule` duplicated rather than shared.**
Confirmed byte-identical duplication: `src/app/admin/availability/actions.ts:42-54` (Phase A, pre-existing, unmodified by this diff) vs the new `src/app/admin/staff/actions.ts` copy. **Correct call.** Extracting a shared home would mean either (i) creating a new shared file not authorized by Step 10's files-touched list, or (ii) editing `availability/actions.ts`, a file outside Phase B's assignment — both are scope-widening moves SUBAGENT-RULES rule 4 forbids initiating unilaterally. Duplication kept the change inside the two files the plan actually names. Not a rule-4b halt condition, because no outside-file edit was *required* for Step 10 to work — the duplication avoided that need entirely.

**(b) Audit `target_id = staffId`, event name already reserved.**
`src/app/admin/audit/format.ts:58` at `b5c8c81` (parent, pre-existing, unmodified by this diff):
```
staff_availability_rules_updated: { phrase: "updated availability rules for staff", family: "staff_and_roles", chip: "pending" },
```
confirmed present **before** this commit, with an explanatory comment above it ("reserved per RECON §6.2 as bulk-update event names"). The existing singular-form events in the same file (`staff_availability_rule_created` line 612, `staff_availability_rule_deleted` line 663 of `staff/actions.ts`) remain distinct and unused by the new action — no collision. **Claim verified.**

**(c) Three deliberate UI differences vs the global editor.**
- *No stored rows → renders CLOSED*: matches the engine truth independently confirmed in §2 — `resolveStaffWindows`'s custom branch on an empty array returns `[]` via `getRuleWindowsForDay([], day)` → `normalizeWindows([])` → no windows → closed. The editor default is not cosmetic; it mirrors what the engine already does. Consistent with brief §2.4/§5.5.
- *Badge counts open days, not stored rows*: the **old** form (`git show b5c8c81:.../StaffAvailabilityRulesForm.tsx`) badge was `rules.length` (raw row count) — valid only because the old one-row-per-working-day shape made row count and open-day count coincide. Under segments a working day can be 1-3+ rows, so row count would overstate open days; switching to `openDayCount` (days where `schedule.isWorkingDay`) preserves the same *intended* meaning rather than the same computation. Correct adaptation, not a regression.
- *"Start from clinic-wide hours" loads for review instead of writing immediately*: confirmed via `git show b5c8c81:...` — the **old** `startFromGlobal` called `createStaffAvailabilityRule` in a loop, writing rows to the DB immediately with no review step. The **new** version only calls `setDays(buildInitialState(globalRulesSeed))` — local state only, nothing persisted until "Save hours" is clicked. This is a genuine, disclosed, and *safer* behavior change (removes an immediate, un-reviewed write), consistent with the segments model's whole-day-at-a-time save semantics. `use_global` mode itself (the toggle, `AvailabilityModeSelector`) is untouched — confirmed via `page.tsx` (not in this diff) passing the same `globalModeLocked`/`globalRulesSeed`/`initialRules` props unchanged before and after.

**(d) Closed staff days now write an `is_working_day=false` row instead of deleting — highest-value item.**

Re-located the three flagged consumers by symbol, independently, against the current disk state (see §7 caveat — none of the three files were touched by concurrent in-flight work, confirmed via `git diff 233a61e` for each):

1. `src/app/admin/availability/page.tsx:287-289,633` — `staffRules = new Set(staffRulesResult.data.map(r => r.staff_id))`; a "custom rules" badge shown per staff `if (staffRules.has(staff.id))`. Used **only** for display (`flags` array rendered on the admin staff-capacity list); traced every other use of `staffRules` in the file (lines 409, 468, 478, 596, 607, 612, 633) — none feed capacity math (`bookingStaff`/`maleCapacity` etc. are computed independently from `can_take_bookings`, not from `staffRules`).
2. `src/app/admin/dashboard/dashboard-data.ts:506` (`getStaffAvailabilityRuleIds`) → `BusinessDashboard.tsx:124-130` / `CoordinatorDashboard.tsx:171` — feeds a "Staff gaps" health-warning row: staff flagged when `availability_mode === "custom" && !staffAvailabilityRuleStaffIds.includes(id)`, i.e. **zero rows at all**. Used only to build a dashboard warning list, no scheduling logic.
3. `src/app/admin/staff/[staffId]/staff-detail-data.ts:260` (`.from("staff_availability_rules").select("id").eq("staff_id", staffId)`) → `src/app/admin/staff/[staffId]/page.tsx:317` — an onboarding-checklist item, `"Availability set up"` `done: mode === "use_global" || rules.length > 0`.

**What actually changes for a user, per consumer:**
- All three keyed off row *presence*, not `is_working_day`. Before this diff, closing every one of a staff's days (via the old per-row delete UI) left **zero** rows → all three consumers read "not configured." After this diff, the new editor's `performSave` calls `saveStaffAvailabilityDay` for **all 7 days on every save**, so a staff explicitly saved "all closed" (behind the form's own `ConfirmActionModal`, "This staff member will have no working days...") now holds 7 `is_working_day=false` rows → all three consumers read "configured."
- **This is a genuine, traceable consequence of the diff**, confirmed by tracing the exact query + exact consumption site for each of the three files, not by trusting a description of it.
- **Ruling: benign**, and in two of three cases an accuracy *improvement*, not a regression:
  - (2) "Staff gaps" now stops flagging a staff member whose zero-availability state was an *explicit, confirmed* admin action, and continues to flag the genuine oversight case (custom mode selected, editor never saved at all — unaffected by this diff, still 0 rows).
  - (3) The onboarding checklist now correctly marks "Availability set up" done for a staff who was, in fact, taken through setup (even if the outcome was "closed every day") — previously it read as *incomplete*, which was itself an inaccuracy pre-dating this diff.
  - (1) is a neutral cosmetic shift: "has this staff ever saved custom hours" vs "has this staff at least one open day" — both are legitimate admin-facing labels for the same underlying fact ("this staff has a custom-rules row").
- **Confirmed this cannot reach the slot engine**: `getRuleWindowsForDay` (§2) filters by `is_working_day` per row regardless of row count — a day with 0 rows and a day with N `is_working_day=false` rows produce the **identical** empty-windows result for `calculateAvailableSlots`. The three affected consumers are admin-display-only; booking/slot computation is unaffected. Verified directly by re-reading the filter predicate, not inferred.

**Process note (non-blocking):** the dispatch describes this as something "the implementer flagged." I could not find this disclosure anywhere in the actual artifacts — not in the commit message body (read in full, 55 lines), not in the diff (`git diff b5c8c81 233a61e | grep` for the three file names/paths returns nothing), not in the progress file (`redesign/per-page-progress/C-14-granular-working-hours-breaks-progress.md`, which as of the tip of `master` still reads "Phase B not started" at line 168 — the progress file has not been updated for this commit at all). The ruling above is my own independent re-derivation, not a check against a disclosure that in fact exists in the repo. Flagging this as a real gap: per SUBAGENT-RULES rule 4a and the Phase A precedent (Progress §2.6, "Noted, left alone"), a consequence of this shape should have been written down somewhere in the commit or progress file, and as of this commit it has not been.

## 7 — Gates, by identity

**tsc:**
```
npx tsc --noEmit
```
→ exit 0. **0 errors.** Confirmed.

**vitest:**
```
npx vitest run
```
→ `Test Files  2 failed | 213 passed (215)` / `Tests  5 failed | 2147 passed (2152)`.
Failures, by identity:
```
FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated
FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent
```
Exactly **5 failed / 2147 passed / 2152 total**, confined to the two named files (2 + 3). Matches expectation exactly.

**lint:**
```
pnpm lint
```
→ `66 problems (59 errors, 7 warnings)`. Files with errors/warnings:
```
design_handoff_area_pages/prototype/area-page.jsx
design_handoff_area_pages/prototype/shared.jsx
design_handoff_area_pages/prototype/site-chrome.jsx
src/features/booking/BookingExperience.tsx
src/features/booking/BookingExperienceLoader.tsx
src/features/booking/utils/returning-customer.ts
```
Exactly the expected set: `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`. 59 errors / 7 warnings matches.

**git status (with pollution caveat):**
```
git status --porcelain -- src/ supabase/
```
→
```
 M src/app/admin/bookings/assignment-eligibility.ts
 M src/components/consent/consent-store.ts
 M src/lib/booking/availability.ts
 M src/lib/consent/__tests__/registry-completeness.test.ts
 M src/lib/consent/cookie-registry.ts
 M src/lib/maintenance.ts
?? supabase/migrations/20260809160000_c14_override_breaks.sql
```
**Not** the expected "only `M src/lib/maintenance.ts`." Diagnosed, not reported as a false FAIL, per the dispatch's own instruction:
- `src/lib/booking/availability.ts` + `src/app/admin/bookings/assignment-eligibility.ts` + the untracked `supabase/migrations/20260809160000_c14_override_breaks.sql` are **Phase C** (Step 12/13/13a) in-flight work by a concurrent agent — confirmed via `git diff 233a61e -- src/lib/booking/availability.ts`, which shows exactly the override-bucketing widening (`globalOverride` → `globalOverrides[]`, `staffOverrideByStaffId` → `staffOverridesByStaffId: Map<string, StaffDateOverrideRecord[]>`) the plan describes for Phase C Step 13, not anything from Phase B.
- `src/components/consent/consent-store.ts` + `src/lib/consent/cookie-registry.ts` + `src/lib/consent/__tests__/registry-completeness.test.ts` are an unrelated concurrent workstream (cookie-consent registry), no relation to C-14.
- **HEAD did not move** — `git rev-parse HEAD` = `233a61ea6b517ab0c7f513a394b31b0f07a1924d`, identical to `git log -1 --format=%H 233a61e`, confirming the commit under verification is still HEAD; the pollution is uncommitted working-tree state from a sibling agent, not a competing commit.
- **Important secondary check performed because of this pollution:** since `availability.ts` was dirty on disk, my §2 evidence (read initially from disk) was independently re-verified against `git show 233a61e:src/lib/booking/availability.ts` (exact committed blob, saved to a scratch file) for every cited line range (204-217, 275-282, 309-311, 535-541, 651-656, 662-672) — all matched verbatim. The tsc/vitest/lint runs above executed against the polluted tree and still passed/matched exactly, which is a stronger signal, not a weaker one.
- Conclusion: this is the "polluted by someone else's in-flight file" case the dispatch anticipated, not a Phase B FAIL. Phase B's own contribution to git status is clean (no Phase-B-scoped file appears modified beyond what's already in commit `233a61e`).

## 8 — ⛔/⏸ markers

`git diff b5c8c81 233a61e | grep "⛔\|⏸\|TODO\|FIXME\|XXX"` → no matches. No new migration shipped in this commit (the RPC `save_staff_availability_day` was created in the Phase A migration, already applied under Phase A's approval — confirmed live via the `pg_proc` query in §4). No production write occurred during this verification (all Supabase calls were SELECT-only, listed in §4/§5). No placeholder/assumed value found in the diff.

---

## Summary

**PASS.** No blocking findings.

Non-blocking observations:
- Judgement call (d)'s consumer-impact analysis is real and independently re-derived, and is genuinely benign (admin-display only, slot engine unaffected, two of three cases arguably improved in accuracy) — but its disclosure claimed by the dispatch does not actually exist in the commit message or the progress file. The progress file has not been updated for Phase B at all as of this commit.
- Working tree pollution from concurrent Phase C + unrelated consent work was present during verification; diagnosed and shown not to affect any gate result or Phase B evidence (§7).

Judgement-call rulings: (a) correct call, (b) verified correct, (c) all three correct/improving, (d) benign, admin-display-only, not slot-engine-reaching — disclosure gap noted as non-blocking.
