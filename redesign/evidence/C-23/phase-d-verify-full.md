# C-23 Phase D — Independent FULL Verification

**Verifier:** independent, read-only, fresh context. Tier: FULL (full re-derivation against plan/brief, not a diff skim).
**Under review:** `d701d9a` (Phase D wiring, Steps 7–10) + `d142897` (month-navigation fix, brief §4.3 compliance).
**HEAD at verification:** `f6ae498` (confirmed unchanged before and after this review — no commit was made by this verifier).
**Model:** Claude Sonnet 5 (`claude-sonnet-5`).

---

## VERDICT: PASS

No blocking findings. One non-blocking finding (a masked/surviving mutant, explained below — behaviourally inert, not a defect, and not introduced by C-23).

---

## 1 — Payload-identity (the blocking gate, plan §3.3)

Confirmed byte-unchanged across **both** commits, verified directly against the current file (not assumed from the progress record):

| Item | Location (current HEAD) | Status |
|---|---|---|
| Hidden `booking_date` | `ManualBookingForm.tsx:1136` | unchanged |
| Hidden `start_time` | `ManualBookingForm.tsx:1137` | unchanged |
| Hidden `override_availability` (conditional) | `ManualBookingForm.tsx:1138-1140` — `{(overrideAvailability \|\| femaleOverride \|\| maleOverride) && (...)}` | unchanged |
| Hidden `send_confirmation_email` | `ManualBookingForm.tsx:1144` | unchanged |
| `bookingDate`/`startTime`/`overrideAvailability` state | `:595-597` | unchanged |
| `checkAvailability` body, deps, call timing | `:750-809` | unchanged |
| `canCheckAvailability` expression | `:744-748` — not widened | unchanged |
| `validateStep` / step gating / draft persistence | `:202-244`, `:1065-1076`, `:870-902` | unchanged |

**Structural proof, not just spot-checks:** `git diff 8acfb5d f6ae498 -- src/app/admin/bookings/new/ManualBookingForm.tsx` produces exactly **five hunks** across the full Phase D span: the `useMemo` import (`@@ -1,6 +1,6 @@`), the two new component imports (`@@ -27,6 +27,8 @@`), the new calendar-state block (`@@ -806,6 +808,65 @@`), and the two branch insertions (`@@ -1642,6 +1703,15 @@`, `@@ -1695,6 +1765,15 @@`). Nothing else in the 2,254-line file changed — `canCheckAvailability`, `checkAvailability`, the hidden inputs, `validateStep`, `isStepReady`, and draft persistence are outside every hunk's range, so they are definitionally untouched, not just visually similar.

**Branch-by-branch:**
- **Branch 1 (single/same-gender):** payload identity already **live-confirmed by the orchestrator** (progress file §3.4) — `booking_date=2026-08-10`, `start_time=10:00`, `override_availability` absent, both before (typed) and after (via calendar). Not re-run here (no browser access).
- **Branch 2 (mixed-gender):** confirmed **by code derivation**. The calendar's `onChange` runs `{ setBookingDate(d); setStartTime(""); if (d) checkAvailability(d); }` — textually identical in effect to the native input's handler at the same branch, and both write through the same `bookingDate`/`startTime` state that feeds the same unchanged hidden inputs. Neither path touches `overrideAvailability`/`femaleOverride`/`maleOverride`, `booking_for`, or `number_of_people`. For the baseline inputs (`booking_date=2026-08-12`, `start_time=11:00`, `override_availability` absent, `booking_for=group`, `number_of_people=2`), the two entry paths (typed vs. calendar) converge on identical state and therefore identical payload.
- **Branch 3 (fallback/override):** confirmed **by the strongest possible derivation — the code is byte-identical, not just equivalent**. `git show 8acfb5d:.../ManualBookingForm.tsx | grep 'AdminInput id="booking_date"... type="date"'` and the same grep against current HEAD return the **exact same text**, only shifted from line 1824 to line 1903 by the unrelated insertions above it. Since the code that produces the payload did not change at all, the payload for the baseline inputs (`booking_date=2026-08-11`, `start_time=14:30`, `override_availability=on`) is trivially identical.

**Conclusion: payload identity holds for all three branches.**

---

## 2 — The two rulings, checked (not assumed)

**Ruling 1 — Branch 3 was deliberately left untouched.** CONFIRMED. Verified independently via the byte-comparison above (§1), not the implementer's md5sum claim. The condition at `:1874` is exactly `overrideAvailability || (isMixedGenderGroup && (femaleOverride || maleOverride))` — matching the surface map's correction of the plan's `!canCheckAvailability` text. The plan's wording is indeed wrong; the code and the progress-file correction are right. No defect.

**Ruling 2 — Typed `AdminInput type="date"` kept alongside the calendar, brief wins over plan Step 7.** CONFIRMED, reasoning holds. Grepped every render site of `stepErrors.booking_date`:
```
1702:              error={stepErrors.booking_date}
1764:              error={stepErrors.booking_date}
1903:              <AdminInput ... error={stepErrors.booking_date} ...
```
Exactly the three `AdminInput` date fields (one per branch) — no other render site. Checked for an error summary that might otherwise surface `booking_date` validation if the input were removed: `multiErrorBanner` (`:1158-1168`) renders only the generic `stepBannerError` string ("Check the highlighted fields before continuing.") — it does not reference `stepErrors.booking_date` or any per-field message. So had the plan's literal "replace" been followed, the "Pick a date from today onwards" message would have had nowhere to render. The reasoning is sound, and since the implementer chose the additive (keep-both) resolution rather than the destructive one, this is moot in practice but the underlying logic is correct.

---

## 3 — Brief clause-by-clause

| Clause | Requirement | Status | Evidence |
|---|---|---|---|
| §4.3 marks-never-disables | `disabled` never exceeds `{ before: min }` | met | `AvailabilityCalendarField.tsx:231` — `disabled={[{ before: minDate }]}`; untouched by either Phase D commit (confirmed via diff — no hunk touches this line) |
| §4.3 mixed-gender: one calendar, one date, one `start_time` | two marker sets, ONE calendar | met | `ManualBookingForm.tsx:1768-1776` — single `AvailabilityCalendarField` with `cohorts={mixedCohorts}` (2 entries), both wired to the same `bookingDate`/`onChange` |
| §4.3 legend + hint | present | met | `AvailabilityCalendarField.tsx:251-282` — legend + `hintId` paragraph, untouched by Phase D |
| §4.3 month navigation triggers a fetch | met (after `d142897` fix) | met | `displayedMonth` state (`:826-829` in current file) drives all three `useMonthAvailability` calls; live-confirmed by orchestrator (26/30 September days marked after paging) and by this verifier's own executed mutation (§5 below, Mutant 2) |
| §4.3 per-month cache, `AbortController` | keyed `month\|services\|genders\|city` | met | `use-month-availability.ts:55,116` — unchanged by Phase D (only its `.test.ts` gained cases) |
| §4.3 direct date entry preserved | typed input alongside calendar | met | §2 above (Ruling 2) |
| §4.4 no change to form state/payload/validation/step gating | — | met | §1 above |
| §4.5 not ported: auto-select first day | must be absent | met | no `useEffect` or logic in the diff selects a day automatically; `bookingDate` is only ever set by explicit `onChange`/`setBookingDate` calls traced in §1 |
| §4.5 not ported: auto-hop to next month when empty | must be absent | met | `displayedMonth` changes only via `onMonthChange`, which fires only from the DayPicker's own `onMonthChange` (user paging), never from data state |
| §4.5 not ported: disabling full days | must be absent | met | same `disabled={[{ before: minDate }]}` as §4.3 row above |
| §4.5 no change to public flow | must be absent | met | diff scope confined to `src/app/admin/bookings/new/**` (§6 below) |
| §5.1 `canCheckAvailability` false → plain calendar, no fetch | — | met | test `"adds no new preconditions — with canCheckAvailability false there is no month fetch and no calendar"` (`ManualBookingForm.test.tsx:647-659`) — asserts `MONTH_ENDPOINT` calls = 0 and zero `[data-day]` elements; re-run by this verifier, passes on real code |
| §5.2 override on → calendar unmarked/available, never blocks | — | met | branch 3 renders no calendar at all when override is on (confirmed structurally: the calendar only appears in branches 1/2, whose render conditions explicitly exclude `overrideAvailability`) |
| §5.3 month fetch fails/aborts → unmarked, per-day still authoritative | — | met | test `"a failed month fetch leaves the calendar unmarked and every day still selectable"` (`:661-676`) — non-vacuous, asserts `aria-label` excludes "availability confirmed" and `disabled` is `false`; re-run, passes |
| §5.4 inputs change mid-view → key changes, refetch, stale discarded | — | met (inherited from Phase C, untouched by Phase D) | `use-month-availability.ts` cache key includes all four components; `AbortController` cleanup unconditional |
| §5.5 selected date becoming unmarked → selection KEPT, never auto-cleared | — | met | test `"paging the calendar never changes the selected date or the chosen start time"` — re-run, passes on real code; **and this verifier's own Mutant 3 (§5 below) proves the test is non-vacuous** by breaking exactly this guarantee and watching the test catch it |
| §5.6 marker vs per-day disagreement → per-day wins | — | met by design | every day-selection path (native input and calendar) calls `checkAvailability`, the actual per-day fetch; markers never gate `onChange` or `onSelect` |
| §5.7 `min=today` preserved | — | met | `calendarMin = new Date().toISOString().split("T")[0]`, same expression as the native inputs' `min`, passed unchanged through both commits |
| §5.8 beyond customer window → true availability shown | — | met (Phase B behaviour, inherited) | live-confirmed by the orchestrator (September, beyond the 29-day window, still marked 26/30 days) — not re-verified live by this verifier (no browser access permitted) |

**All brief clauses met. No clause failing.**

---

## 4 — Step 10 non-removal audit (13-item checklist), re-derived independently

| # | Item | Verified | Evidence |
|---|---|---|---|
| 1 | Shared `bookingDate` state | present, unmoved semantics | `:595` |
| 2 | Shared `startTime` state | present | `:596` |
| 3 | Hidden `booking_date` input | present, unchanged | `:1136` |
| 4 | Hidden `override_availability` input | present, unchanged | `:1138-1140` |
| 5 | All three date-input branches | present | `:1694` / `:1756` / `:1874` (conditions), `AdminInput type="date"` kept at `:1696`, `:1758`, `:1903` |
| 6 | Override toggle | present | trigger `:1674-1681`, confirm dialog `:1909-1920` — outside every diff hunk |
| 7 | Both cohort skips (female + male) | present | female `:1796`→confirm `:1815-1824`; male `:1840`→confirm `:1859-1868` — outside every diff hunk |
| 8 | `canCheckAvailability` semantics | unwidened | `:744-748`, textually identical to pre-Phase-D |
| 9 | Per-day fetch + slot buttons (`slotLabel` **and** the mixed-gender gender-count variant) | present, both paths | `slotLabel` used at `:1746`; gender counts at `:1810`/`:1854` — neither touched |
| 10 | `min=today` | present, all branches | `:1703`, `:1765`, `:1903`, plus `calendarMin` fed identically to the two calendars |
| 11 | `setStartTime("")` on date change | present (branches 1/2), correctly absent (branch 3) | `:1704`, `:1708`, `:1766`, `:1770` vs. `:1903` (no clear) |
| 12 | Step-3 gate (`bookingDate && startTime`) | present | `isStepReady` `:1070-1073`; `validateStep` `:234-235` |
| 13 | Draft persistence (bookingDate/startTime/overrideAvailability deliberately excluded) | present, unchanged | restore effect `:871-893`, save effect `:895-902` — list of persisted keys unchanged |

**All 13 items independently re-derived and confirmed intact.** None collapsed, none assumed from the implementer's or prior verifier's report.

---

## 5 — Mutation testing (executed, scratchpad-only, non-vacuity proof)

**Method.** Per the rule against in-place mutation, I built an isolated harness under scratchpad (`.../scratchpad/c23-verify/`) mirroring the exact relative directory depth of `src/app/admin/bookings/new/` (plus the small dependency chain `../actions.ts`, `../recurring-actions.ts`, `./access.ts`, `./_helpers.ts`, `./types.ts`, `./RecurringSection.tsx` — all copied verbatim, unmutated) and a dedicated `vitest.c23.config.ts` with the same `jsdom` environment and `@ → src` alias as the real config. Node-module resolution was made to work via a temporary NTFS **junction** (`c23-verify/node_modules → <repo>/node_modules`), which was deleted immediately after use — this never touched the real `node_modules` directory (junction deletion removes only the link). No file inside the actual repository was ever written or modified; `git status --porcelain` scoped to the C-23 paths was empty both before and after.

**Harness validated first (control run):** running the harness unmutated against the real `ManualBookingForm.test.tsx` + `AvailabilityCalendarField.test.tsx` + `use-month-availability.test.ts` produced **exactly** `1 failed | 2 passed (3)` files / `3 failed | 42 passed (45)` tests — identical to running those same three files directly from the real repo. The harness is a faithful reproduction.

| # | Mutant | Method | Result |
|---|---|---|---|
| 1 | Calendar's `onChange` (branch 1) skips `setStartTime("")`, keeping `checkAvailability(d)` | Edited the scratchpad copy's line 1708 equivalent to drop the explicit clear | **SURVIVED** — all 10 "C-23 Phase D" tests still pass. See Finding NON-BLOCKING-1 below. |
| 2 | Restored the pre-fix month derivation `(bookingDate \|\| min).slice(0,7)`, making `displayedMonth` a plain re-derived constant instead of state, with `onMonthChange` a no-op | Edited the scratchpad copy | **KILLED** — 4 tests fail: `"paging to the next month fetches THAT month and marks it…"`, `"paging aborts the month request still in flight for the month left behind"`, `"paging the calendar never changes the selected date or the chosen start time"`, `"branch 2 — paging drives BOTH cohorts from the one displayed month"` |
| 3 | Paging the calendar (`onMonthChange`) also moves the selected date (`setBookingDate(`${m}-01`)`) | Edited the scratchpad copy | **KILLED** — exactly 1 test fails: `"paging the calendar never changes the selected date or the chosen start time"` |

### Finding NON-BLOCKING-1 — Mutant 1 survives, but it is a masked, pre-existing, behaviourally-inert gap

Dropping the calendar's own explicit `setStartTime("")` call (while leaving `if (d) checkAvailability(d)` intact) does not change observed behaviour, because `checkAvailability` itself unconditionally executes `setStartTime("");` as its first statement once its own early-return guard (`if (!date || !canCheckAvailability) return;`) passes (`ManualBookingForm.tsx:752,769`) — and the calendar branch only renders when `canCheckAvailability` is already true. So for any real (truthy) date selection with `canCheckAvailability` true, the outer clear is redundant with the inner one, and removing it is invisible to every existing test.

This is **not new to Phase D**: the exact same redundant pattern exists in the pre-existing native-input handler (`setBookingDate(d); setStartTime(""); if (d) checkAvailability(d);`, byte-identical in branches 1 and 2, both native and calendar) — Step 7 explicitly required the calendar to run "the identical handler body," and the implementer did so faithfully, redundancy included. The only scenario where the outer clear would matter is deselecting to an empty date (`d === ""`), which short-circuits `checkAvailability` before its internal clear runs — and there is no dedicated test for a deselect path either (react-day-picker's `mode="single"` `onSelect` can pass `undefined`, mapped to `""` by `AvailabilityCalendarField.tsx:224`, but nothing in the current UI offers a way to deselect a chosen day).

**Assessment: NON-BLOCKING.** Payload identity and the shipped behaviour are both correct (start time is still reliably cleared via the inner call in every exercised path); this is a test-coverage characteristic inherited from pre-existing code, not a defect introduced by this diff, and it does not violate any brief clause or gate.

---

## 6 — Diff scope (blocking if violated) — clean

```
git show d701d9a --stat   → ManualBookingForm.test.tsx, ManualBookingForm.tsx (both under src/app/admin/bookings/new/)
git show d142897 --stat   → AvailabilityCalendarField.test.tsx, AvailabilityCalendarField.tsx,
                             ManualBookingForm.test.tsx, ManualBookingForm.tsx, use-month-availability.test.ts
                             (all under src/app/admin/bookings/new/)
```
`src/lib/booking/availability.ts`, `src/app/api/availability/**`, and the entire public booking flow are **absent from both commits**. No BLOCKING scope violation.

---

## 7 — Gates by identity (all run by this verifier, this session, at HEAD `f6ae498`)

- **`npx tsc --noEmit`** → **0 errors.**
- **`pnpm vitest run`** → **5 failed / 2041 passed / 2046 total.** Failure identities, confirmed by name (not count): `src/lib/auth/admin-access.test.ts` — `"gives Owner broad access while keeping owner-only role actions permission-gated"`, `"gives Admin broad operational access without role template management"`; `src/app/admin/bookings/new/ManualBookingForm.test.tsx` — `"renders step 1 on first load"`, `"moves focus to the first invalid field when continuing with errors"`, `"shows the consent error when trying to create booking without consent"`. Matches the dispatch's stated identity exactly. The three `ManualBookingForm` failures are a pre-existing "Found multiple elements with the text: Contact & source" testing-library ambiguity (step-1/step-4 heading collision), unrelated to the calendar — not newly introduced, not "fixed."
- **`pnpm lint`** → **66 problems (59 errors, 7 warnings)**, confirmed in exactly `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`. Grepped the full lint output for `ManualBookingForm`, `AvailabilityCalendarField`, `use-month-availability` — zero matches.
- **`pnpm build`** → **NOT RUN** (banned this session per standing rule).

## 8 — Code rules

- `border-l-4` — absent from all C-23 Phase D/C files (grepped).
- `prefers-reduced-motion` — vacuously satisfied: `AvailabilityCalendarField.tsx` contains no `transition`/`animate`/`duration-*` classes to guard.
- Admin-scoped tokens — every colour in `AvailabilityCalendarField.tsx` is a `var(--admin-*)` reference; grepped for hex/`rgb(`/`rgba(`/`oklch(` literals — zero matches.
- `unstable_cache` with `Set`/`Map`/`Date` — not applicable; no Phase D file touches `unstable_cache`.
- Style match — Phase D's insertions match the surrounding file's existing formatting conventions (inline arrow handlers, `AdminInput`/`AdminPanel` idiom).

## 9 — Isolation

`git status --porcelain -- src/lib/booking src/app/api src/app/admin/bookings/new` → **empty**, both before and after this verification's mutation testing. `src/lib/maintenance.ts` shows as the sole modified tracked file in the wider tree (standing Owner change, excluded per instructions, never staged/touched). No mutation-testing artifact leaked into the real repository (confirmed via a targeted grep of `git status --porcelain` for the scratchpad harness name).

---

## Findings

**BLOCKING:** none.

**NON-BLOCKING:**
1. See §5, Finding NON-BLOCKING-1 — the calendar's explicit `setStartTime("")` (branches 1 and 2, `ManualBookingForm.tsx:1708` and `:1770`) is currently masked by `checkAvailability`'s own internal clear for every exercised code path, so a mutant that removes it survives the full test suite. Inherited from the pre-existing native-input pattern (not introduced by C-23), behaviourally inert given current UI (no deselect affordance), does not affect payload identity or any brief clause. No action required; noted for completeness per the dispatch's request to report survivors.

---

## Checks I could not run

- Live browser / authenticated-session verification of branches 2 and 3's payload identity — done by code derivation instead (§1), per the dispatch's explicit instruction (Zone-2, orchestrator-only).
- Live accessibility-tree / assistive-technology confirmation for Phase D's specific insertions — relied on Phase C's independent live-AT verification (unaffected by Phase D's additive changes, confirmed via diff) plus the orchestrator's own live AT-tree check recorded in the progress file (`"Monday, August 10th, 2026 — availability confirmed"`).
- `pnpm build` — banned for agents this session; recorded as not run, per instruction.
- Live confirmation of §5.8 (beyond-customer-window availability) — relies on the orchestrator's recorded live check (September marked 26/30 beyond the 29-day window); not independently re-run (no browser access).
