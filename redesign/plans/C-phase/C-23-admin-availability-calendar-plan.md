# C-23 — Availability-aware calendar on the admin create-booking page — **PLAN**

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: none — C-23 is independent. Serialization (2026-07-26, Owner-approved): C-23 Phase B lands BEFORE C-14's `availability.ts` phases — before starting, check `git log --oneline --grep="feat(redesign): C-14"` AND `ls src/lib/booking/working-hours-segments.ts 2>/dev/null` (either non-empty = C-14 implementation landed first — stop and re-anchor Phase B against its engine edits; a bare `--grep="C-14"` is unreliable, the 2026-07-26 refinement DOCS commits already match it — final-sweep fix 2026-07-26). Coordination: C-22 (D23) adds rate limiting to the public `/api/availability*` routes — check `git log --oneline --grep="feat(redesign): C-22"` before touching those files.
> Decisions: C-B-DECISIONS.md contains no C-23 entries (post-handoff addition; governing directions cited inline). Checkpoint decision D25 (2026-07-26, Owner-approved) applied. Findings applied: see refinement changelog.

**Type:** Band C plan-writing output (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Brief:** `redesign/briefs/C-23-admin-availability-calendar-brief.md` (companion — read first; §2 carries the audit + the explicit non-removal list)
**Progress (filled in C-C):** `redesign/per-page-progress/C-23-admin-availability-calendar-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

**Governing constraint (user direction 2026-07-16):** *"ensure it doesn't cause any discrepancies or issues nor remove anything unnecessarily."* C-23 changes how staff **see** dates, never what the form **submits**. The brief's §2 non-removal list is a hard gate, not advice.

---

## 0 — Pre-flight

1. Branch confirmed with user — **master** (this plan ports files *from* `redesign/start-state`; it does not work on it). **Amended 2026-07-26 (C23-F5):** the `redesign/start-state → master` merge has already happened (`ea97932`) — there is nothing left to port (Phase A is verify-only, see its wrapper). Work on `master`; HEAD at or descended from `ea97932` — verify with `git branch --show-current` + `git merge-base --is-ancestor ea97932 HEAD`. Working tree has no modifications under the paths this plan touches: `git status --porcelain -- src/lib/booking src/app/api src/app/admin/bookings/new` returns empty. The wider tree is intentionally dirty (untracked photo/design folders, deleted .playwright-mcp logs) — NEVER stage broadly, NEVER stash/restore/checkout to "clean" it.
2. Dev server → 200; baseline tests + static gates green. **Baseline caveats (verified 2026-07-20, C23-F6):** vitest = 485/491 with 6 pre-existing failures in 3 files (ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1) — 3 of the 6 sit in ManualBookingForm tests, THIS plan's primary edited file, so every "prove nothing changed" run diffs against those 3 named failures, not against green; `pnpm lint` = 59-error baseline (55 untracked design_handoff_area_pages/prototype JSX + 4 pre-existing in src/features/booking/). "Green" = no NEW failures/errors vs these baselines; tsc + build clean.
3. **Re-verify the port is still clean** (was true 2026-07-16; re-check because start-state may have moved):
   ```bash
   git log --oneline 02951a2..master -- src/lib/booking/availability.ts        # expect: only the merge commit 3ef8423
   git log --oneline 02951a2..redesign/start-state -- src/lib/booking/availability.ts  # expect: 0325838 (+ any newer — inspect if so)
   git diff master redesign/start-state --stat -- src/lib/booking/availability.ts src/app/api/availability/
   ```
   If start-state has newer commits touching these files, **stop and surface to the user** — the port scope changed.
   **Superseded 2026-07-26 (C23-F4, verifier-CONFIRMED):** the literal expected outputs above are stale and would false-halt an executing agent — the range log `02951a2..master` now returns the content commit `0325838` (carried onto master by the `ea97932` merge; `3ef8423` is an unrelated earlier merge that never touched these files), and the same range against `redesign/start-state` also returns only `0325838`. Run instead this read-only identity assertion:
   ```bash
   git diff master redesign/start-state --stat -- src/lib/booking/availability.ts src/app/api/availability/   # MUST be empty — Phase A already satisfied by the ea97932 merge
   ```
   Empty output → proceed (Phase A collapses to its verify wrapper, §1). Non-empty output → the parity premise broke — **stop and surface to the user**.

> ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
> An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
> Action: pre-flight #4 below submits real admin bookings end-to-end (three baseline variants) against the production DB.
> Exact SQL / change: no SQL — booking rows created via the live admin form. Fixture-only guard: `.example.test` clients + standard test staff ONLY (per §6); record every created row id in the progress file for cleanup.
> Post-action verification: the three recorded rows exist with the captured `booking_date`/`start_time`/`override_availability`; cleaned up per §6 once the §3.3 before/after comparison completes.
> Never auto-apply. Approval is per-action and does not carry forward.

4. **Capture the behavioural baseline** (this is what "no discrepancies" is measured against):
   - Complete an admin booking end-to-end on a date **with** availability; record the submitted `booking_date`, `start_time`, `override_availability` and the resulting row.
   - Repeat with **override on**, and once as a **mixed-gender group**.
   - Screenshot step 3 in all three branch states (single/same-gender, mixed-gender, fallback).
5. **Re-verify the audit line numbers** (2026-07-16 vintage, file is 2,019 lines):
   ```bash
   grep -n "const \[bookingDate\|const \[startTime\|const \[overrideAvailability\|canCheckAvailability =\|checkAvailability = useCallback\|name=\"booking_date\"\|name=\"override_availability\"" src/app/admin/bookings/new/ManualBookingForm.tsx
   grep -n 'type="date"' src/app/admin/bookings/new/ManualBookingForm.tsx   # expect 3 branches
   ```
6. **Sibling-plan collision check:** if C-20 / C-06 Step 13 / C-02 Phase E are landing in the same window, note the shared file and coordinate commit order (different regions).
   **Coordination note (2026-07-26, programme-wide):** *"ManualBookingForm.tsx is edited by C-02, C-03, C-06, C-20, and C-23 in this programme. Before this plan's ManualBookingForm.tsx steps, re-run this plan's own anchor greps (do not trust hardcoded line numbers) — a predecessor plan may have already shifted them. If a target region overlaps a just-landed edit from another Band-C plan, stop and diff manually rather than applying a line-numbered patch."*
7. **DO-NOT-TOUCH:** the public booking flow and its components · `calculateAvailableSlots`' contract · Badar's `9d55ce2a` · real customer data · RECON §5 untouchables beyond the explicitly-approved engine port.
8. **DO-NOT-TOUCH (live data):** booking 9d55ce2a (Badar — real customer email); Owner account rahmatherapy@outlook.com in email-test paths; any client whose email isn't *.example.test or name isn't Phase10*/Audit Test* test patterns.

---

## 1 — Implementation order (5 phases)

### Phase A — Port the engine (no behaviour change)

> ✅ **VERIFY-ALREADY-IMPLEMENTED (2026-07-26)** — the build at `ea97932` already implements this step (C23-F1, verifier-CONFIRMED twice: `git diff master redesign/start-state --stat -- src/lib/booking/availability.ts src/app/api/availability/` → empty; `src/lib/booking/availability.ts` exports `calculateAvailableSlots` L796 + `calculateAvailableDays` L867 on master; `src/app/api/availability/month/route.ts` present, 55 lines). The `redesign/start-state → master` merge carried content commit `0325838` — the port happened via the merge; Step 1's `git checkout` would be a tree-mutating no-op against the intentionally-dirty tree and commit 1 would be empty.
> Executor: VERIFY the behaviour instead of re-implementing — run the pre-flight #3 read-only identity assertion (diff MUST be empty; do NOT run the `git checkout` below) and Step 2's existing-caller checks against the pre-flight #4 baseline. No Phase A commit lands — the cadence starts at commit 2 (§7). ⚠️ Risk-posture change (D25, Owner-acknowledged): `/api/availability/month` is a LIVE public endpoint serving the customer calendar (`ScheduleStep.tsx:94-104`) — undo/rollback for the engine now starts at Phase B (§5). Original step text preserved below for reference.

**Step 1 — Byte-identical port.**

```bash
git checkout redesign/start-state -- src/lib/booking/availability.ts src/app/api/availability/month/
git diff --stat redesign/start-state -- src/lib/booking/availability.ts src/app/api/availability/month/   # MUST be empty
```

An empty diff is the acceptance condition: identical files mean the eventual `redesign/start-state → master` merge sees no divergence here (brief §4.1). **Do not reformat, re-lint, or "improve" the ported code in this commit** — any edit forfeits that property. Improvements, if any, land in Phase B as separate hunks.

**Step 2 — Prove nothing changed for existing callers.** `calculateAvailableSlots` keeps its exact contract; the per-day admin + public paths must behave identically. Run the existing suite plus a manual per-day check on the admin form (a date known to have slots, and one known not to) — compare against the Pre-flight #4 baseline. Commit only when identical.

*Note: after this phase `/api/availability/month` exists on master but only Phase B's admin route calls it — the public consumer lives on start-state. Intentional (brief §4.1).*

*Premise INVERTED 2026-07-26 (C23-F2, verifier-CONFIRMED): the route is ALREADY live and customer-facing — the shipped public booking flow's `ScheduleStep.tsx:94-104` POSTs `/api/availability/month`, which is unauthenticated and uses the service-role client (`route.ts:47`). Any edit to the route or the engine touches production customer behaviour NOW.*

### Phase B — Admin month endpoint + engine options

> ⚠️ **Live-surface note (2026-07-26, D25 — Owner-acknowledged risk posture):** `src/lib/booking/availability.ts` and `/api/availability/month` serve the LIVE public customer calendar today (`ScheduleStep.tsx:94-104`; unauthenticated, service-role client) — Phase B modifies a production customer surface, not a dormant port. The additive options bag MUST be verified against the public flow: with options absent, behaviour is byte-identical (Step 3's options-omitted fixture test + §3.6's public-route check are the proof). Serialization (Owner-approved): land Phase B BEFORE C-14's engine phases. C-22 (D23) adds rate limiting to the public availability routes (the new admin route in Step 4 is authenticated and NOT rate-limited by it) — re-grep anchors if either plan has landed.

**Step 3 — Additive options on `calculateAvailableDays`.**

```ts
export async function calculateAvailableDays(
  input: CalculateAvailableDaysInput,
  supabase: SupabaseClient,
  options: {
    now?: Date;
    /** Admin-only: report true therapist availability beyond the customer booking window. */
    ignoreBookingWindow?: boolean;
    /** Admin-only: staff keep booking while public online booking is paused. */
    ignorePublicPause?: boolean;
  } = {}
): Promise<AvailableDaysResult>
```

Two guarded call sites inside the function: the `booking_status_enabled` early return, and the `datesInWindow` filter. **Defaults preserve today's behaviour exactly** — every existing caller is untouched by omission. Keep the diff to these two conditionals so the merge surface stays minimal (brief §7).

Unit tests: options omitted → identical output to pre-change (fixture comparison); `ignorePublicPause` with booking paused → days still computed; `ignoreBookingWindow` with a date beyond the window → real availability reported.

*Executability (2026-07-26): file `src/lib/booking/availability.ts` — `calculateAvailableDays` at L867 (options bag currently `{ now?: Date }`, L870); the two guarded sites are the `booking_status_enabled` early return (L887-889) and the `datesInWindow` filter (L896-904). Verify: `grep -n "ignoreBookingWindow\|ignorePublicPause" src/lib/booking/availability.ts` → exactly the type + the two conditionals; options-omitted fixture test passes unchanged.*

**Step 4 — `POST /api/admin/availability/month`.**

Mirrors the public route's zod shape (`month`, `serviceIds`, `participantGenders`, `city`) and adds: staff-session auth + booking-create permission via the standard `getStaffProfile()` → `createSupabaseAdminClient()` pattern; calls `calculateAvailableDays(..., { ignoreBookingWindow: true, ignorePublicPause: true })`. Returns `{ month, days, durationMins, requiredStaffByGender, reason? }`.

Route tests: unauthenticated → rejected; insufficient permission → rejected; valid staff → days returned; bad payload → 400.

*Executability (2026-07-26): NEW file `src/app/api/admin/availability/month/route.ts` — the FIRST route under `src/app/api/admin/` (subtree does not exist yet; create it). Auth anchor: `getStaffProfile` exported at `src/lib/auth/rbac.ts:308`; zod-shape mirror: `src/app/api/availability/month/route.ts` (55 lines). Verify: route tests above green; an unauthenticated request is rejected.*

### Phase C — Admin calendar component

**Step 5 — `AvailabilityCalendarField.tsx`** (`src/app/admin/bookings/new/`), presentational + self-contained fetching:

```tsx
interface CohortMarkers {
  label: string;                        // "Female participants" | "Male participants" | ""
  days: Map<string, boolean>;           // yyyy-MM-dd → hasSlots
}

interface Props {
  value: string;                        // the shared bookingDate — unchanged owner: ManualBookingForm
  onChange: (date: string) => void;     // must run the SAME handler body as today (setBookingDate + setStartTime("") + checkAvailability)
  cohorts: CohortMarkers[];             // 1 entry normally, 2 for mixed-gender
  loading: boolean;
  min: string;                          // today — preserved
}
```

Rules, all load-bearing:
- **Never `disabled`** beyond `{ before: min }`. Days without availability get a de-emphasis modifier only (brief finding 3).
- **Marker resolution with 2 cohorts:** both → "available"; exactly one → "partial" (distinct treatment); neither → de-emphasised. With 1 cohort: available / de-emphasised.
- Admin idiom only — `--admin-*` tokens, `h-11` targets, focus rings — matching `src/app/admin/calendar/CalendarDatePopover.tsx`. No `--rahma-*`, no public CSS module.
- Legend + one-line hint; `motion-reduce` respected; keyboard operable; markers conveyed by more than colour alone (shape/label), announced to AT.
- Renders unmarked (not broken) when `cohorts` is empty or `loading`.

**Step 6 — Month fetching + cache hook.** `useMonthAvailability(monthKey, serviceIds, genders, city, enabled)` — lifted from the reference's `ScheduleStep` effect: cache keyed `month|services|genders|city`, `AbortController` on change/unmount, failure → `null` (unmarked, silent). `enabled` is wired to the existing `canCheckAvailability` — **no new preconditions** (brief finding 4). Mixed-gender calls it twice, once per cohort.

*Executability (2026-07-26): `canCheckAvailability` declared at `ManualBookingForm.tsx:665` (`const canCheckAvailability =` — re-grep before wiring, sibling plans edit this file); reference effect to lift: `src/features/booking/components/ScheduleStep.tsx:94-104`. Verify: hook unit tests (cache hit, abort on key change, failure → `null`).*

### Phase D — Wire into the three branches (no state/payload change)

> Shared-file caution (2026-07-26, rubric §10): re-run the pre-flight #5 anchor greps immediately before Steps 7-9 — C-02/C-03/C-06/C-20 edit other regions of `ManualBookingForm.tsx` and may have shifted the `:1445`/`:1498`/`:1630` regions (see the pre-flight #6 coordination note).

**Step 7 — Single/same-gender branch** (`:1445` region): replace the `AdminInput type="date"` with `AvailabilityCalendarField`, passing one cohort. `onChange` executes **the identical handler body** as today — `setBookingDate(d); setStartTime(""); if (d) checkAvailability(d);`. Everything below (loading row, slot buttons, `slotLabel`, the "No therapists available… or override" notice) is untouched.

**Step 8 — Mixed-gender branch** (`:1498` region): same component, **two cohorts** (female, male) → two marker sets on the one calendar. The two per-cohort slot sections and both skip-availability panels below remain exactly as they are. **One date, one `start_time` — unchanged** (brief finding 1).

**Step 9 — Fallback branch** (`:1630` region): used when `!canCheckAvailability` or `overrideAvailability`. Either keep today's plain `AdminInput` (zero risk, recommended) or render the calendar with `cohorts: []`. **Decide at impl and record it** — the requirement is only that this path keeps working identically.

**Step 10 — Non-removal audit.** Walk the brief §2 list item by item against the diff and tick each in the progress file. Anything that must change gets surfaced to the user *before* the commit.

### Phase E — Verification (see §3)

---

## 2 — Files touched

**PORTED (2, byte-identical):** `src/lib/booking/availability.ts` · `src/app/api/availability/month/route.ts` — **superseded 2026-07-26 (C23-F1): both already on master via `ea97932`, byte-identical to start-state; nothing to port — verify-only (Phase A wrapper)**
**NEW (3–4):** `src/app/api/admin/availability/month/route.ts` (+ test) · `src/app/admin/bookings/new/AvailabilityCalendarField.tsx` · the month-cache hook (colocated or `src/app/admin/bookings/new/use-month-availability.ts`) (+ tests)
**EDITED (2):** `src/lib/booking/availability.ts` (Phase B options — two conditionals, separate commit from the port) · `src/app/admin/bookings/new/ManualBookingForm.tsx` (three date-input branches only)
**UNCHANGED (explicitly):** the entire public booking flow · `calculateAvailableSlots` · `/api/availability` · form state, payload, validation, step gating, draft persistence · `/admin/calendar`.

---

## 3 — Verification gate

1. **Static gates:** lint, tsc, vitest (engine options, admin route, hook, component), build, bundle (**+6 kB ceiling on `/admin/bookings/new`**, 0 elsewhere; no new package). **Baseline caveat (2026-07-26, C23-F6):** "pass" = no NEW errors/failures vs the verified baselines — lint 59 errors (55 untracked prototype JSX + 4 pre-existing in src/features/booking/), vitest 6 pre-existing failures incl. ManualBookingForm ×3 (this plan's primary edited file — diff the named failure list, not the exit code); tsc + build clean.
2. **Port fidelity (blocking):** `git diff redesign/start-state -- src/lib/booking/availability.ts src/app/api/availability/month/` is empty at the Phase A commit. **Reframed 2026-07-26 (C23-F1): there is no Phase A commit — the gate is the pre-flight #3 read-only identity assertion: the master↔start-state diff on both paths MUST be empty BEFORE Phase B starts (already true at `ea97932`; still blocking — a non-empty diff means the parity premise broke, stop and surface).**
3. **No-discrepancy proof (blocking):** re-run the Pre-flight #4 baseline submissions — the submitted `booking_date`, `start_time`, `override_availability` and resulting rows are **identical** for the same inputs, in all three branch states.
4. **Non-removal audit (blocking):** every brief §2 item verified working — override toggle, both cohort skips, fallback branch, per-day slot rows with staff counts, `min=today`, `setStartTime("")` on date change, step-3 gate, draft persistence.
5. **Month ↔ day equivalence:** for ≥5 sampled dates in the shown month — including a fully-booked day and a no-gender-match day — `hasSlots` agrees with `/api/availability`'s slot presence for the same inputs. Mirrors the reference commit's own live check.
6. **Admin relaxation:** with public booking **paused**, the admin calendar still marks days (and the public route still reports unavailable); a date **beyond the customer window** shows true availability in admin and remains unavailable publicly.
7. **Mixed-gender:** a day servable for only one cohort renders "partial", both cohorts' slot sections behave as before, one shared `start_time` still applies.
8. **Degradation:** `canCheckAvailability` false → no network call (Network tab) and a plain calendar; month endpoint forced to fail → unmarked calendar, booking still completable.
9. **A11y + responsive:** keyboard selection, AT announcement of marker meaning, non-colour-only encoding, `motion-reduce`; 375 + 1280 screenshots of all three branches → `redesign/evidence/C-23/` (evidence convention 2026-07-26, D15 — never write into `redesign/audits/**`).
10. **RBAC:** the admin month route rejects unauthenticated and under-permissioned callers.

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| **Port drifts from start-state** (a stray lint fix) → the eventual merge conflicts after all | medium | medium | §3.2 empty-diff gate at the Phase A commit; improvements land in later, separate hunks. |
| Rewiring the date input silently changes submitted data | medium | **high** | Step 7 reuses the identical handler body; §3.3 before/after payload comparison is blocking; state ownership stays in `ManualBookingForm`. |
| A branch (esp. the fallback) gets dropped in the rewrite | medium | high | Step 9 + the §3.4 non-removal audit walk all three branches explicitly. |
| Engine options bag regresses the public path | low | high | Defaults preserve behaviour; fixture test asserts options-omitted output is identical; §3.6 checks the public route directly. |
| Markers disagree with the per-day check → staff distrust the calendar | medium | medium | §3.5 equivalence gate; the per-day check remains the source of truth and the UI never gates on markers (brief §5.6). |
| Month fetch cost on every month nav | low | low | Cache + AbortController; one batched round-trip per month per cohort by design — the whole point of the refactor. |
| Mixed-gender two-cohort markers confuse rather than clarify | medium | low | Distinct "partial" treatment + legend; the per-cohort slot sections below remain the detailed answer. |
| C-14 later edits the same engine regions | medium | low | Brief §7 coordination note in both plans; whichever ships second re-reads the other's changes. **Updated 2026-07-26 (C23-F7): the refactored engine is ALREADY on master independent of C-23 — the "after C-23 Phase A" framing is gone. Serialization (Owner-approved): C-23 Phase B lands BEFORE C-14's engine phases; C-14 re-anchors against the options bag.** |
| Selected date silently cleared when inputs change | low | medium | Explicitly forbidden (brief §5.5) — selection is kept, markers refresh. |

---

## 5 — Undo

Per-phase git reverts. Reverting Phase D restores the native date inputs; reverting Phase A removes the ported engine + month route (safe — nothing on master called `calculateAvailableDays` before Phase B, and `calculateAvailableSlots` is unchanged either way). No migration, no data, no config.

**Rewritten 2026-07-26 (C23-F3, verifier-CONFIRMED — the Phase A revert above is UNSAFE and moot):** there is no Phase A commit to revert, and the live customer calendar depends on `calculateAvailableDays` + `/api/availability/month` (`ScheduleStep.tsx:94-104`) — removing them would break the shipped public booking flow. Undo scope starts at Phase B: revert commit 2 (options bag — defaults preserved, so reverting restores exact current behaviour), commit 3 (admin route — additive, no public caller), commits 4-5 (component/hook/wiring — restores the native date inputs). NEVER revert `src/lib/booking/availability.ts` or `src/app/api/availability/month/route.ts` below their `ea97932` state.

---

## 6 — Test fixture guidance

Use existing `.example.test` clients and the standard test staff for availability shaping. Where a fully-booked or no-gender-match day is needed, prefer an **existing** quiet/busy date over creating bookings; if fixtures are created, clean them up and record the ids in the progress file. Badar's `9d55ce2a` and real customer rows untouched.

---

## 7 — Commit cadence

| Commit | Coverage |
|---|---|
| 1 | Phase A — byte-identical engine + month-route port (empty-diff verified). **Superseded 2026-07-26 (C23-F1/D25): NO commit — Phase A collapsed to read-only verification (a commit here would be empty). Record the pre-flight #3 identity-assertion output in the progress file instead; the first landing commit is commit 2. Rows below keep their numbers (no renumber).** |
| 2 | Phase B — engine options bag + tests |
| 3 | Phase B — admin month route + tests |
| 4 | Phase C — calendar component + month-cache hook + tests |
| 5 | Phase D — wire single/same-gender + mixed-gender + fallback branches |
| 6 | Verification — non-removal audit, equivalence evidence, screenshots, progress file, master-plan row → ✅ |

`feat(redesign): C-23 {phase}` prefixes. No migration commits.

---

## 8 — Hand-off to C-C

1. Read brief (§2 audit + non-removal list) + plan. Run pre-flight — **#3 (port still clean) and #4 (behavioural baseline) are blocking**.
2. Phases A→E in order. Phase A must land as its own commit with an empty diff vs start-state. **Amended 2026-07-26 (C23-F1/D25): Phase A is verify-only — no commit; run the pre-flight #3 read-only identity assertion and record its output in the progress file. The first landing commit is Phase B (commit 2, §7).**
3. The three blocking gates are §3.2 (port fidelity), §3.3 (identical payload), §3.4 (non-removal audit). None may be waived.
4. Record the Step 9 fallback-branch decision in the progress file.
5. Final commit flips the master-plan C-23 row → ✅.

---

*End of C-23 plan. Brief: `redesign/briefs/C-23-admin-availability-calendar-brief.md`.*
