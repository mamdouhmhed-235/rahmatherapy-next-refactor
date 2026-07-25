# C-23 — Availability-aware calendar on the admin create-booking page — **PLAN**

**Type:** Band C plan-writing output (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Brief:** `redesign/briefs/C-23-admin-availability-calendar-brief.md` (companion — read first; §2 carries the audit + the explicit non-removal list)
**Progress (filled in C-C):** `redesign/per-page-progress/C-23-admin-availability-calendar-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

**Governing constraint (user direction 2026-07-16):** *"ensure it doesn't cause any discrepancies or issues nor remove anything unnecessarily."* C-23 changes how staff **see** dates, never what the form **submits**. The brief's §2 non-removal list is a hard gate, not advice.

---

## 0 — Pre-flight

1. Branch confirmed with user — **master** (this plan ports files *from* `redesign/start-state`; it does not work on it).
2. Dev server → 200; baseline tests + static gates green.
3. **Re-verify the port is still clean** (was true 2026-07-16; re-check because start-state may have moved):
   ```bash
   git log --oneline 02951a2..master -- src/lib/booking/availability.ts        # expect: only the merge commit 3ef8423
   git log --oneline 02951a2..redesign/start-state -- src/lib/booking/availability.ts  # expect: 0325838 (+ any newer — inspect if so)
   git diff master redesign/start-state --stat -- src/lib/booking/availability.ts src/app/api/availability/
   ```
   If start-state has newer commits touching these files, **stop and surface to the user** — the port scope changed.
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
7. **DO-NOT-TOUCH:** the public booking flow and its components · `calculateAvailableSlots`' contract · Badar's `9d55ce2a` · real customer data · RECON §5 untouchables beyond the explicitly-approved engine port.

---

## 1 — Implementation order (5 phases)

### Phase A — Port the engine (no behaviour change)

**Step 1 — Byte-identical port.**

```bash
git checkout redesign/start-state -- src/lib/booking/availability.ts src/app/api/availability/month/
git diff --stat redesign/start-state -- src/lib/booking/availability.ts src/app/api/availability/month/   # MUST be empty
```

An empty diff is the acceptance condition: identical files mean the eventual `redesign/start-state → master` merge sees no divergence here (brief §4.1). **Do not reformat, re-lint, or "improve" the ported code in this commit** — any edit forfeits that property. Improvements, if any, land in Phase B as separate hunks.

**Step 2 — Prove nothing changed for existing callers.** `calculateAvailableSlots` keeps its exact contract; the per-day admin + public paths must behave identically. Run the existing suite plus a manual per-day check on the admin form (a date known to have slots, and one known not to) — compare against the Pre-flight #4 baseline. Commit only when identical.

*Note: after this phase `/api/availability/month` exists on master but only Phase B's admin route calls it — the public consumer lives on start-state. Intentional (brief §4.1).*

### Phase B — Admin month endpoint + engine options

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

**Step 4 — `POST /api/admin/availability/month`.**

Mirrors the public route's zod shape (`month`, `serviceIds`, `participantGenders`, `city`) and adds: staff-session auth + booking-create permission via the standard `getStaffProfile()` → `createSupabaseAdminClient()` pattern; calls `calculateAvailableDays(..., { ignoreBookingWindow: true, ignorePublicPause: true })`. Returns `{ month, days, durationMins, requiredStaffByGender, reason? }`.

Route tests: unauthenticated → rejected; insufficient permission → rejected; valid staff → days returned; bad payload → 400.

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

### Phase D — Wire into the three branches (no state/payload change)

**Step 7 — Single/same-gender branch** (`:1445` region): replace the `AdminInput type="date"` with `AvailabilityCalendarField`, passing one cohort. `onChange` executes **the identical handler body** as today — `setBookingDate(d); setStartTime(""); if (d) checkAvailability(d);`. Everything below (loading row, slot buttons, `slotLabel`, the "No therapists available… or override" notice) is untouched.

**Step 8 — Mixed-gender branch** (`:1498` region): same component, **two cohorts** (female, male) → two marker sets on the one calendar. The two per-cohort slot sections and both skip-availability panels below remain exactly as they are. **One date, one `start_time` — unchanged** (brief finding 1).

**Step 9 — Fallback branch** (`:1630` region): used when `!canCheckAvailability` or `overrideAvailability`. Either keep today's plain `AdminInput` (zero risk, recommended) or render the calendar with `cohorts: []`. **Decide at impl and record it** — the requirement is only that this path keeps working identically.

**Step 10 — Non-removal audit.** Walk the brief §2 list item by item against the diff and tick each in the progress file. Anything that must change gets surfaced to the user *before* the commit.

### Phase E — Verification (see §3)

---

## 2 — Files touched

**PORTED (2, byte-identical):** `src/lib/booking/availability.ts` · `src/app/api/availability/month/route.ts`
**NEW (3–4):** `src/app/api/admin/availability/month/route.ts` (+ test) · `src/app/admin/bookings/new/AvailabilityCalendarField.tsx` · the month-cache hook (colocated or `src/app/admin/bookings/new/use-month-availability.ts`) (+ tests)
**EDITED (2):** `src/lib/booking/availability.ts` (Phase B options — two conditionals, separate commit from the port) · `src/app/admin/bookings/new/ManualBookingForm.tsx` (three date-input branches only)
**UNCHANGED (explicitly):** the entire public booking flow · `calculateAvailableSlots` · `/api/availability` · form state, payload, validation, step gating, draft persistence · `/admin/calendar`.

---

## 3 — Verification gate

1. **Static gates:** lint, tsc, vitest (engine options, admin route, hook, component), build, bundle (**+6 kB ceiling on `/admin/bookings/new`**, 0 elsewhere; no new package).
2. **Port fidelity (blocking):** `git diff redesign/start-state -- src/lib/booking/availability.ts src/app/api/availability/month/` is empty at the Phase A commit.
3. **No-discrepancy proof (blocking):** re-run the Pre-flight #4 baseline submissions — the submitted `booking_date`, `start_time`, `override_availability` and resulting rows are **identical** for the same inputs, in all three branch states.
4. **Non-removal audit (blocking):** every brief §2 item verified working — override toggle, both cohort skips, fallback branch, per-day slot rows with staff counts, `min=today`, `setStartTime("")` on date change, step-3 gate, draft persistence.
5. **Month ↔ day equivalence:** for ≥5 sampled dates in the shown month — including a fully-booked day and a no-gender-match day — `hasSlots` agrees with `/api/availability`'s slot presence for the same inputs. Mirrors the reference commit's own live check.
6. **Admin relaxation:** with public booking **paused**, the admin calendar still marks days (and the public route still reports unavailable); a date **beyond the customer window** shows true availability in admin and remains unavailable publicly.
7. **Mixed-gender:** a day servable for only one cohort renders "partial", both cohorts' slot sections behave as before, one shared `start_time` still applies.
8. **Degradation:** `canCheckAvailability` false → no network call (Network tab) and a plain calendar; month endpoint forced to fail → unmarked calendar, booking still completable.
9. **A11y + responsive:** keyboard selection, AT announcement of marker meaning, non-colour-only encoding, `motion-reduce`; 375 + 1280 screenshots of all three branches → `redesign/audits/C-A/screenshots-c-23/`.
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
| C-14 later edits the same engine regions | medium | low | Brief §7 coordination note in both plans; whichever ships second re-reads the other's changes. |
| Selected date silently cleared when inputs change | low | medium | Explicitly forbidden (brief §5.5) — selection is kept, markers refresh. |

---

## 5 — Undo

Per-phase git reverts. Reverting Phase D restores the native date inputs; reverting Phase A removes the ported engine + month route (safe — nothing on master called `calculateAvailableDays` before Phase B, and `calculateAvailableSlots` is unchanged either way). No migration, no data, no config.

---

## 6 — Test fixture guidance

Use existing `.example.test` clients and the standard test staff for availability shaping. Where a fully-booked or no-gender-match day is needed, prefer an **existing** quiet/busy date over creating bookings; if fixtures are created, clean them up and record the ids in the progress file. Badar's `9d55ce2a` and real customer rows untouched.

---

## 7 — Commit cadence

| Commit | Coverage |
|---|---|
| 1 | Phase A — byte-identical engine + month-route port (empty-diff verified) |
| 2 | Phase B — engine options bag + tests |
| 3 | Phase B — admin month route + tests |
| 4 | Phase C — calendar component + month-cache hook + tests |
| 5 | Phase D — wire single/same-gender + mixed-gender + fallback branches |
| 6 | Verification — non-removal audit, equivalence evidence, screenshots, progress file, master-plan row → ✅ |

`feat(redesign): C-23 {phase}` prefixes. No migration commits.

---

## 8 — Hand-off to C-C

1. Read brief (§2 audit + non-removal list) + plan. Run pre-flight — **#3 (port still clean) and #4 (behavioural baseline) are blocking**.
2. Phases A→E in order. Phase A must land as its own commit with an empty diff vs start-state.
3. The three blocking gates are §3.2 (port fidelity), §3.3 (identical payload), §3.4 (non-removal audit). None may be waived.
4. Record the Step 9 fallback-branch decision in the progress file.
5. Final commit flips the master-plan C-23 row → ✅.

---

*End of C-23 plan. Brief: `redesign/briefs/C-23-admin-availability-calendar-brief.md`.*
