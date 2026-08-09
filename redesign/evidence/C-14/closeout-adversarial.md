# C-14 — Adversarial Closeout Review (whole-plan, cumulative)

**Range:** `ecc1d0d`..`0bc2a02`. C-14 commits reviewed, in order: `4583573` (Phase D), `17aade6` + `d9d252a` (Phase A), `233a61e` (Phase B), `9f41430` (Phase C), `5e79506`, `88f4d80`, `0bc2a02` (sonnet follow-ups).
**Mode:** read-only. `git log/diff/show/status` only. `execute_sql` not used in this pass (prior phase reviews already did the live DB verification this range needed — see citations below). No writes except this file.
**Verified excluded from C-14 attribution:** `ded190b` (C-20), `72670e1` (recurring-email fix — touches `recurring-actions.ts`/`createRecurringSeries.test.ts`, confirmed via `git show 72670e1 --stat`, not in any C-14 commit's diff). Neither touches `AdminTopNav.tsx`/`admin/me/*`; confirmed HEAD moved to `51942b0` (C-10 Phase B) during this review, touching only `src/app/admin/me/*` — expected, ignored, does not pollute any gate result below (re-confirmed by re-running gates at that HEAD).

**VERDICT: PASS.** Zero blocking findings after an exhaustive cross-phase sweep. Several non-blocking findings, two of which are genuinely new (not surfaced by any of the four phase-level reviews already on file) — reported in full below per the "genuinely adversarial" mandate.

---

## 1 — BLOCKING findings

**None.** Nothing found in this pass rises to a customer-facing defect, a data-loss risk, or a regression a phase review missed that actually reaches a live surface.

---

## 2 — NON-BLOCKING findings (new in this pass, not previously reported)

### 2.1 — Override list pagination has no tiebreaker: a `.limit()` cap can split one date's segments across the boundary

`src/app/admin/availability/page.tsx:270-296` and `src/app/admin/staff/[staffId]/availability/page.tsx` (same shape) fetch the "past" and "upcoming" `availability_overrides` / `staff_availability_overrides` buckets with a single-column sort:

```ts
.from("availability_overrides")
.select("*")
.lt("override_date", today)
.order("override_date", { ascending: false })
.limit(adjPastViewAll ? AVAILABILITY_PAST_VIEW_ALL_CAP : AVAILABILITY_PAST_CAP)
```

No secondary `.order("start_time")`. Contrast with the `availability_rules` query 30 lines above it in the same file, which 5e79506 explicitly gave a secondary sort ("`day_of_week` alone leaves segment order within a day unspecified") for exactly this reason. Since Phase C's migration drops the per-date unique, a break-having override date is 2+ rows, and rows for the same date are only guaranteed *contiguous* (because the primary sort key is the date), never guaranteed to land *together on the same side of a `LIMIT` cut*. If the 25-row (or 200-row view-all) cap lands mid-group, `groupByDate` in the Manager component receives a truncated segment set for the boundary date and renders it with the wrong hours (e.g. only the morning segment of a 2-segment break day) — not "date not shown," but "date shown with incorrect hours," which is worse because nothing on screen indicates the row is incomplete.

**Reachability today: nil.** `SELECT count(*) FROM availability_overrides` was confirmed `0` in `phase-c-verify-full.md` §2, and the cap is 25 (past) / 500 (upcoming, defensive-only) — this cannot fire until the table accumulates dozens of past override dates, several of which would need to be break-having, one of which would need to land exactly on the cap boundary. Admin-display-only (historical/upcoming override list), never reaches the slot engine or a customer.
**Not previously flagged.** `0bc2a02`'s commit message discusses the *count* problem (rows vs. dates for `pastTotal`) at length but never mentions the *pagination-boundary* problem, which is a distinct failure mode of the same root cause (row-based `LIMIT` over a domain that is now multi-row-per-key). Worth a one-line secondary sort (`.order("start_time")`) whenever this area is next touched; not urgent given current reachability.

### 2.2 — The "N past adjustments" banner still counts rows, not dates — the same bug class `0bc2a02` fixed elsewhere, left unfixed here

`AvailabilityOverridesManager.tsx:153-157` and `StaffAvailabilityOverridesManager.tsx:156-160`:
```ts
const bannerState = resolveAvailabilityBannerState({
  pastTotal,
  pastShown: past.length,
  viewAll: pastViewAll,
});
```
rendered as `"View all {bannerState.total} past adjustments"` / `"Showing the first N of {bannerState.total} past adjustments"` (`AvailabilityOverridesManager.tsx:436,451`). `bannerState.total` is `pastTotal`, sourced from a `count("id")` head-count query (`page.tsx:293-296`) — a **row** count. A past date with a break (2 segment rows) is counted as 2 "adjustments" in this label, exactly the defect `0bc2a02` fixed for the current-week chip (`weekAdjustments.length` → `weekAdjustmentsByDate.size`).

**I checked whether `pastShown: past.length` should instead be `pastDays.length` (already computed one line above via `useMemo`) — it should not.** `pastTotal` is *also* row-based (same head-count query), so `past.length` (rows) is the internally-consistent pairing for the banner's own truncation-detection math (`pastTotal > pastShown` → "there are more rows the query didn't fetch"). Swapping in `pastDays.length` (dates) against a rows-based `pastTotal` would make that comparison **wrong in the other direction** — e.g. `pastTotal=25` rows / `pastDays.length=15` dates would falsely claim truncation (`25 > 15`) even when every row was in fact fetched. So the line the dispatch pointed me at is not itself the bug; the bug is one level up, in what `pastTotal`'s query counts.

**Matches `0bc2a02`'s own disclosed scope-out**, which explains at length why a `COUNT(DISTINCT override_date)` wasn't built this pass (Zone-2 RPC/view, or an unbounded read that undoes C-16's cap+view-all fix) — I verified that reasoning independently (§4 below) and it holds. What that commit message does not do is connect its own fix to this sibling, still-broken instance of the identical mislabeling one UI panel over. Non-blocking, cosmetic, admin-only, and honestly the same shape of gap the implementer already disclosed — but worth naming precisely since the dispatch asked.

### 2.3 — Two more orphaned pre-segments functions, one of them never disclosed

`src/app/admin/staff/actions.ts:572-676` — `createStaffAvailabilityRule` and `deleteStaffAvailabilityRule` (the old per-row create/delete pair, pre-dating Phase B's `saveStaffAvailabilityDay`). Grepped the whole tree: no caller outside `actions.ts` itself and its own test file.
```
grep -rn "createStaffAvailabilityRule\|deleteStaffAvailabilityRule" src --include=*.tsx --include=*.ts | grep -v "actions.ts\|__tests__\|\.test\."
```
returns nothing. Same shape as the already-disclosed `deleteAvailabilityRule` orphan (`availability/actions.ts`, flagged in `phase-a-verify-full.md` Finding 2) — dead code, not a live risk (nothing calls it), but **this specific pair was not mentioned in `phase-b-verify-full.md`**, which reviewed `staff/actions.ts` in detail (§6a-d) without surfacing it. Same caveat as the Phase A instance applies: if ever re-wired to a UI, it would need the same advisory-lock discipline as `save_staff_availability_day` to stay race-safe.

---

## 3 — NON-BLOCKING findings (re-confirmed from earlier phase reviews — still true at final HEAD, listed for completeness)

- **Progress file staleness.** `redesign/per-page-progress/C-14-granular-working-hours-breaks-progress.md` still ends at the Phase A "PROGRAMME INTERRUPT CHECKPOINT" (line 204). Phase B, Phase C, and all three sonnet follow-up commits (`5e79506`, `88f4d80`, `0bc2a02`) have **no entry anywhere in the progress file** — confirmed by reading the file in full (204 lines total, nothing past the interrupt checkpoint). `phase-b-verify-full.md` §6(d) already flagged this for Phase B specifically ("the progress file has not been updated for this commit at all"); it is now also true for Phase C and both sonnet commits. Non-blocking (doesn't affect shipped behaviour) but real, and it means a reader who trusts the progress file alone would materially under-estimate what shipped.
- **Plan §4.4 screenshot evidence: not delivered.** The plan requires four specific captures (375+1280 editor with two breaks; 375+1280 staff custom hours with a break; 1280 override editor with a break; customer picker showing greyed dates). `redesign/evidence/C-14/` contains exactly one screenshot, `capacity-strip-multi-segment-AFTER.png` (from `5e79506`'s admin-page work, not any of the four required captures). Brief acceptance criterion 12 ("Playwright sweep at 375/768/1280/1440") is likewise unfulfilled — no Playwright run exists in the evidence trail for any of Phases A/B/C's editors. I did not attempt this myself (browser/auth work is out of scope for this review). Functionally low-risk given how thoroughly the underlying logic is unit- and mutation-tested, but it is a plainly unmet item against the plan's own verification gate.
- **Brief AC1's literal live round-trip was never executed.** The plan's Phase A verify checkpoint and brief §10 AC1 call for an actual save via the admin UI (Monday: opens 08:00 / break 12:30–15:00 / closes 20:00 → save → DB shows 2 rows → customer slots confirmed either side of the break). `C-14-…-progress.md` §2.5 explicitly records this as "NOT DONE," gated on Owner Decision #2 (`HANDOFF-2026-08-09-ORCHESTRATOR.md` §2.2/§3). I found no evidence anywhere in the repo (progress file, evidence folder, commit messages after the interrupt checkpoint) that this was subsequently performed. The underlying correctness is nonetheless well-established by other means: `phase-a-verify-full.md` independently re-derived the RPC's atomicity/locking/security from first principles and live grant queries, and `working-hours-segments.test.ts` feeds real `scheduleToRows` output through the real `calculateAvailableSlots` (not a stub) with the exact Monday/break/12:30–15:00 scenario the brief names, confirmed by both the Phase A verifier and independently by me reading the test file. So the property is proven at the engine level; only the literal "did a human click Save on the real rota" step is outstanding.

---

## 4 — Known-open items — reasoning re-verified, severity judged

**1. `AVAILABILITY_PAST_CAP`/`STAFF_AVAILABILITY_*` caps count rows, not distinct dates.** Independently re-traced: `page.tsx`'s `overridesPastCountResult` is `.select("id", { count: "exact", head: true }).lt("override_date", today)` — a row count. `availability-data.ts` and `staff/[staffId]/availability/lib.ts` contain zero query logic (confirmed by reading both files in full) — only cap constants and the pure `resolveAvailabilityBannerState`/`resolveStaffAvailabilityBannerState` helpers, exactly as `0bc2a02`'s commit message claims. The stated alternatives — an RPC/view for `COUNT(DISTINCT override_date)` (Zone-2, genuinely out of a read-only/non-migration pass) or an unbounded row read (which would undo the exact anti-pattern C-16's cap+view-all fix eliminated) — are the only two ways to build a correct distinct-date total from this schema without a migration. **Reasoning verified correct; halting rather than shipping half of it (which risks the "view all" link silently failing to appear, per the commit's own concern) was the right call.** See §2.1/§2.2 above for the two sibling gaps this same root cause leaves open that the disclosure doesn't individually name.

**2. `pastShown: past.length` vs. the already-computed `pastDays.length`.** See §2.2 — re-verified this is *not* a bug in isolation; it is the internally-consistent choice given `pastTotal`'s own row-based semantics. The real gap is one level up (item 1). Severity: **low**, cosmetic, admin-only.

**3. Global override save is deliberately non-atomic (delete-then-insert, no RPC).** Re-traced the failure path independently: `resolveStaffWindows` (`availability.ts:288-325`) falls through to `return getRuleWindowsForDay(globalRules, dayOfWeek)` when `globalOverrides` is empty for a date — i.e. a failed insert after a successful delete makes that date read as an **ordinary weekly day**, not CLOSED and not empty. This is categorically milder than the Phase A/B RPC case (where zero rows for a recurring weekday reads as CLOSED), which is exactly why Phase A got an RPC and Phase C's override save didn't. Confirmed the reasoning by reading the fallthrough path myself, not by trusting the comment. **Severity: low**, and correctly documented in the code comment at `availability/actions.ts:262-269`.

**4. Staff duplicate-date pre-check is read-then-write (TOCTOU).** `addStaffAvailabilityOverride` (`staff/[staffId]/availability/actions.ts:246-260`) does a `.select("id")...limit(1)` existence check, then a separate `.insert(...)` — the dropped unique can no longer make this atomic. Two concurrent submissions for the same staff+date can both pass the check. **Severity: low** — requires two admins (or one double-submitting) racing a single low-frequency permission-gated form within one request window; the failure is immediately visible on screen (duplicated segments for one date) and trivially recoverable (delete-by-date removes all of it in one action, confirmed in `deleteStaffAvailabilityOverride`, which deletes by `override_date` not by row id). Honestly disclosed in the function's own doc comment.

---

## 5 — Cross-phase seams (what a purely per-phase review structurally cannot see)

Checked directly, not inferred from each phase's own claims:

- **All four save surfaces (global rules, staff rules, global overrides, staff overrides) share exactly one validation/conversion helper** (`src/lib/booking/working-hours-segments.ts`) via exactly one shared editor (`WorkingHoursDayEditor.tsx`) — confirmed by import in all four managers (`AvailabilityRulesManager.tsx:15-16`, `StaffAvailabilityRulesForm.tsx:20,25`, `AvailabilityOverridesManager.tsx:12-17`, `StaffAvailabilityOverridesManager.tsx:17-22`). This closes off an entire class of "does validation agree across surfaces" concern by construction, not by convention.
- **The three server-action copies of `normalizeSchedule`** (`availability/actions.ts:32-44`, `staff/actions.ts:472-484`, `staff/[staffId]/availability/actions.ts:33-45`) are **byte-identical**, diffed directly. The duplication is real but forced (Next.js server-action files may only export async functions — confirmed via the file's own comment — so a shared home would require either a new shared file or editing a file outside the assignment; `phase-b-verify-full.md` §6a already reasoned through this and I concur).
- **Segment-formatting convention is identical across all four render surfaces**, verified by grep, not by trusting the commit message's claim: `WorkingHoursDayEditor.tsx:187-188`, `AvailabilityOverridesManager.tsx:480-481,501-502`, `StaffAvailabilityOverridesManager.tsx:517-518,542-543`, and `page.tsx`'s `formatSegments` (added by `5e79506`) all produce `"HH:MM–HH:MM"` per segment joined by `" · "` — byte-identical separator choice, confirmed by direct grep across all four files.
- **"Closed" means the same thing everywhere it can apply.** Recurring rules: a closed day is one `is_working_day:false` row that memoizes the last hours (`working-hours-segments.ts:127-137`, `AvailabilityRulesManager.tsx` toggle). Overrides cannot be "closed" at all — both `saveAvailabilityOverride` and `addStaffAvailabilityOverride` hard-force `isWorkingDay: true` on the normalized schedule before validating (`availability/actions.ts:292`, `staff/[staffId]/availability/actions.ts:235`) — matching brief §5.6 ("a whole-day closure is a blocked date, not an override") exactly, and matching what `WorkingHoursDayEditor` renders (it never shows a closed-toggle in the override managers because the schedule it's handed is always `isWorkingDay: true`).
- **Ordering determinism.** `5e79506` added a secondary `.order("start_time")` to the `availability_rules` query specifically because segment order within a day was previously unspecified; I confirmed the override queries in the *same file* (and the staff-side equivalent) never received the same treatment — see §2.1, the one genuine ordering-related gap this sweep found.
- **No surviving single-row assumption reaches the slot engine or a save path.** Beyond what `phase-b-verify-full.md`/`phase-c-verify-full.md` already found and the implementers already fixed (`page.tsx`, `assignment-eligibility.ts`, both override managers, `StaffAvailabilityOverridesManager.tsx:~111`), I grepped every `.single()`/`.maybeSingle()`/`.limit(1)`/`.find(`/`new Map(rows.map(` touching the four multi-row tables across `src/app/admin` and `src/lib/booking` (23 files matched the table names; every hit inspected). Everything remaining is either (a) a genuine single-row lookup by the row's own primary key (e.g. `deleteAvailabilityRule`, `deleteStaffAvailabilityRule` — correct, not a day/date lookup), (b) a `staff_id`-only dedup via `Set`/`Map` that's insensitive to row count by construction (`dashboard-data.ts:506-513`, `staff-detail-data.ts`), or (c) `reporting.ts`'s `getUtilisationRate`, which sums `(end−start)` across **every** matching row regardless of day-of-week grouping — already robust to multi-row days without any change, and in fact now more accurate post-C-14 (a lunch break correctly reduces "available hours" where it previously couldn't be expressed at all). No new defect found in this class beyond §2.1's pagination gap, which is a `LIMIT`-boundary issue, not a `.single()`-style crash/silent-drop issue.

---

## 6 — Style/idiom drift, opus vs. sonnet

Compared `4583573`/`233a61e`/`9f41430` (opus) against `5e79506`/`88f4d80`/`0bc2a02` (sonnet) directly, not by trusting the attribution table: comment density and style (long "why, not what" block comments citing exact line numbers and prior commits), the C-14/Phase/Step cross-referencing convention in comments, `oklch`-free new components, `updateTag`-only cache invalidation, and the shared-helper-over-duplication instinct (`formatSegments`/`resolveWeekdayRule`/`groupOverridesByDate` extracted as pure, independently unit-tested functions in `5e79506`, mirroring the same pattern `working-hours-segments.ts` set in Phase A) are all consistent across every commit in the range. No idiom drift found. One trivial, purely cosmetic inconsistency: `5e79506`'s commit message carries a `Co-Authored-By: Claude Opus 5` trailer despite being the first of the three commits attributed to sonnet in this review's dispatch table, while `88f4d80` and `0bc2a02` carry no co-author trailer at all. Metadata-only; does not affect the code and I would not weight it as a real drift signal.

---

## 7 — Scope: files outside the plan's list

Full cumulative file list cross-checked against plan §3 (`C-14-granular-working-hours-breaks-plan.md`) and the brief's §7 preview list. Every file is accounted for by one of: (a) the plan's own NEW/EDITED tables, (b) a test file for an already-authorized source file, or (c) the two explicitly Owner-approved deviations named in this review's dispatch (`src/app/(public)/layout.tsx`, Phase D; `src/app/admin/availability/page.tsx`, added later — `assignment-eligibility.ts` was already on the plan's list via the 2026-07-26 refinement, not a new deviation).

**One caveat worth recording precisely.** By strict letter, four more files sit outside the plan's literal §3 list and are not individually named among the "two deviations": `src/lib/booking/booking-window-settings.ts` (new), `src/lib/time/london.ts` + `london.test.ts` (the plan named `src/lib/booking/date-bounds.ts`; the implementer relocated the helper into `london.ts` to avoid a real, verified circular import — `phase-d-verify-full.md` §7 independently confirmed the cycle claim), and `src/features/booking/BookingExperience.tsx` + `BookingExperienceLoader.tsx` (the client-tree hops between the newly-authorized `layout.tsx` read and the already-authorized `ScheduleStep.tsx`). All four are part of the *same* Phase D "thread settings to the client tree" task the plan's Step 4 explicitly calls for, without knowing in advance which files that would touch (the plan itself says the booking-experience server entry "does not exist" and the remedy "requires a layout-level fetch or API-returned bounds"). `phase-d-verify-full.md` §6-§8 already reviewed every one of these files on the merits and found them safe (no `cookies()`/`headers()`, JSON-safe cache boundary, optional props with safe fallbacks, no step-sequencing changes). I re-read §6-§8 and the cited source directly rather than re-deriving from scratch, and concur with its conclusion. Flagging only because the dispatch's framing of "two rule-6(b) deviations" undercounts the true footprint by the letter of the plan's file list — a documentation-completeness note, not a new functional or scope-creep concern.

---

## 8 — Brief §10 acceptance criteria — walkthrough

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Global working hours support breaks, round-trip via the real UI on the real rota | **Partial** | Engine-level round-trip proven (real `scheduleToRows` fed through real `calculateAvailableSlots`, `working-hours-segments.test.ts:352-380`); RPC atomicity/security independently audited (`phase-a-verify-full.md`). The literal live-UI save-and-reload-on-production step was deliberately deferred (progress §2.5, Owner Decision #2) and no evidence shows it was later performed. |
| 2 | Multiple breaks per day | **Satisfied** | `working-hours-segments.test.ts:55-70`, two breaks → 3 rows, round-trips. |
| 3 | Customer slots respect breaks | **Satisfied** | Same test file + `phase-a-verify-full.md` §9; independently re-confirmed in Phase B/C via `staff-recurring-windows.test.ts` and `override-windows.test.ts`, all real-engine-fed. |
| 4 | Per-staff breaks (custom + use_global) | **Satisfied** | `233a61e`; `phase-b-verify-full.md` §2 independently re-derives `resolveStaffWindows`/`loadContextRest` handle N rows. |
| 5 | Override breaks (global + staff) | **Satisfied** | `9f41430`; `phase-c-verify-full.md` §4-§5, migration applied and live-verified (`phase-b-verify-full.md` §4 re-confirms the RPC live). |
| 6 | Closed day round-trips | **Satisfied** | `working-hours-segments.test.ts:72-85`; `AvailabilityRulesManager.test.tsx`. |
| 7 | Existing single-window days unaffected | **Satisfied** | Same-shape 1-row round-trip preserved; `availability.ts` untouched by Phases A/B (confirmed via `git diff --stat` on both commits). |
| 8 | Phase D: out-of-window dates non-clickable, last-clickable == last-server-accepted | **Satisfied** | `phase-d-verify-full.md` §0, independently re-derived and live-probed both directions. |
| 9 | Phase D: minimum-notice floor | **Satisfied** | `phase-d-verify-full.md` §2, confirmed `isOutsideMinimumNotice` untouched and doing the real per-slot filtering. |
| 10 | Phase D: admin picker unbounded | **Satisfied** | `phase-d-verify-full.md` §4, `AvailabilityCalendarField.tsx` confirmed to have no `after` bound and no C-14 import. |
| 11 | Static gates (lint/tsc/vitest/build/bundle) | **Satisfied**, build/bundle excepted | tsc/vitest/lint independently re-run by me at final HEAD, §9 below — all match baseline by identity. `pnpm build` and the bundle-delta script are orchestrator-reserved / agent-banned; not run by any phase reviewer or by me, consistent with SUBAGENT-RULES. Still genuinely outstanding at programme level (per `HANDOFF-2026-08-09-ORCHESTRATOR.md` §3.5, unresolved as of the files I can see). |
| 12 | Playwright sweep, 375/768/1280/1440 | **Not satisfied / not performed** | See §3 — no Playwright evidence exists in `redesign/evidence/C-14/` beyond one incidental screenshot. |
| 13 | No regression in existing availability behaviour | **Satisfied** | Confirmed via `phase-b-verify-full.md`/`phase-c-verify-full.md`'s hunk-range diffs (only the intended lines touched) plus my own independent gate re-run showing no new failures. |

---

## 9 — Gates, quoted, re-run independently at final HEAD

Tree confirmed at `51942b0` (C-10 Phase B, landed on top of `0bc2a02` by the concurrent implementer during this review — touches only `src/app/admin/me/*`, confirmed via `git log --oneline 0bc2a02..HEAD`; does not touch any C-14 file and does not pollute any gate below).

**`npx tsc --noEmit`**
```
(no output, exit 0)
```
**0 errors.**

**`npx vitest run`** — run six times across this session for stability (flakiness precedent already noted in `phase-c-verify-full.md` §8, "environment/import-timing flakiness, 2203 → 2213 across runs"). Representative clean run:
```
Test Files  2 failed | 218 passed (220)
     Tests  5 failed | 2214 passed (2219)
```
Failing by name, every run where the count was exactly 5:
```
FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated
FAIL  src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors
FAIL  src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent
```
Exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 by name — matches the dispatch's baseline exactly. **Two of six full-suite runs** additionally showed a sixth, transient failure (`ManualBookingForm.test.tsx > ManualBookingForm optional email > still rejects a malformed email, and stops rejecting it once cleared`, a `waitFor`/timeout failure). Re-ran `ManualBookingForm.test.tsx` in isolation: **exactly 3 failed / 33 passed (36)** — the sixth failure does not reproduce outside the full-suite run, and `admin-access.test.ts` in isolation is **exactly 2 failed / 4 passed (6)**. Judged as environment/timing flakiness under full-suite load, consistent with the precedent already on file, not a C-14-introduced regression — it never appears when the file runs alone, and its own file (`ManualBookingForm.test.tsx`) is a pre-existing baseline-failure file already, not a C-14-touched one.

**`pnpm lint`**
```
✖ 66 problems (59 errors, 7 warnings)
```
Files, verified by listing every unique path in the output:
```
design_handoff_area_pages/prototype/area-page.jsx
design_handoff_area_pages/prototype/shared.jsx
design_handoff_area_pages/prototype/site-chrome.jsx
src/features/booking/BookingExperience.tsx
src/features/booking/BookingExperienceLoader.tsx
src/features/booking/utils/returning-customer.ts
```
Exactly the six baseline files. **Matches expectation exactly.**

**`pnpm build`** — not run (banned for this agent; reserved for the orchestrator's single end-of-programme build per SUBAGENT-RULES and every prior phase review's own constraint). The **54/54-static prerender** check that `layout.tsx` becoming `async` requires remains genuinely unverified — carried forward from `phase-d-verify-full.md`, still true.

---

## 10 — Summary

C-14 is functionally sound end to end. The segments model is proven at the engine level with real-engine-fed tests in every phase, not stubs; the one schema migration was independently SQL-audited before application and re-confirmed live afterward; every previously-known cross-phase gap (page.tsx's `.find()`, assignment-eligibility's `.maybeSingle()` and its separate `override_type` column bug, both override managers' first-row-wins) was genuinely fixed, and this pass found the fixes hold under direct re-inspection. The four surfaces (global rules, staff rules, global overrides, staff overrides) share one validation helper and one editor by construction, and their rendering conventions are byte-identical where they should be.

What this pass adds beyond the four phase reviews already on file: a latent pagination-boundary gap in the override list queries (§2.1, unreachable today), a precise account of why the "past adjustments" banner still mislabels row-count as date-count and why the line the dispatch pointed at is not itself fixable in isolation (§2.2), one more undisclosed orphaned function pair (§2.3), and a consolidated accounting of what the plan's own verification gate (§4.4 screenshots, the Phase A live round-trip, the progress file) still has open at final HEAD (§3). None of it is blocking. All gates re-run clean by identity.
