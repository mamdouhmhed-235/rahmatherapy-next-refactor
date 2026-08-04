# C-23 Phase B — Independent FULL-tier verification

**Verifier:** independent subagent (read-only, no repo mutation apart from this file)
**Scope:** C-23 Phase B, Steps 3–4 — commits `61111ee` (engine options) and `16c700e` (admin route)
**Baseline:** `8504746`
**Method:** re-derivation from committed blobs (`git show 16c700e:<path>`), live re-run of gates, and an executed mutation-check in a scratchpad copy (not the repo)

## Verdict: **PASS**

No blocking defects found. One reporting-precision issue is flagged (§5 below) — it does not indicate incorrect behaviour, only that the amended gate's literal wording ("zero insertions") does not survive contact with `git diff`'s line-level granularity once Phase B legitimately edits existing lines in `availability.ts`. Recommend the programme reword the gate; no code change is implicated.

---

## 1 — The options-omitted path (the whole risk)

**Verified: the omitted-options path is provably byte-identical in behaviour.**

- `src/lib/booking/__tests__/availability-options.test.ts:128-138` — `FROZEN_DEFAULTS` is a plain object literal, not derived from calling `calculateAvailableDays`. Confirmed by reading; it cannot be tautological.
- The two critical regression-guard tests (`availability-options.test.ts:150-154` and `:167-178`) call `calculateAvailableDays(INPUT, client())` — **exactly two arguments**, matching the one production caller, `src/app/api/availability/month/route.ts:65-68`, which also calls it with exactly two arguments (verified by reading that file).
- Clock: `beforeEach` at `availability-options.test.ts:140-143` calls `vi.useFakeTimers({ toFake: ["Date"] })` only — confirmed, no other API is faked.
- Algebra, re-derived from the actual source (`src/lib/booking/availability.ts:893` and `:902-911`):
  - Guard 1: `!settings.booking_status_enabled && !options.ignorePublicPause`. With options omitted, `options.ignorePublicPause` is `undefined`, so `!undefined === true`, collapsing the expression to `!settings.booking_status_enabled` — identical to the pre-Phase-B code. Confirmed correct.
  - Guard 2: `DATE_PATTERN.test(date) && (options.ignoreBookingWindow || isDateInBusinessWindow(...))`. With options omitted, `options.ignoreBookingWindow` is `undefined` (falsy), so JS `||` always evaluates and returns the right operand — `isDateInBusinessWindow(...)` is called on every date exactly as before. Confirmed correct, including call-frequency/order (no behavioural change from the short-circuit rewrite when options are omitted).
  - When `ignoreBookingWindow: true`, `isDateInBusinessWindow` is *not* called at all (left-operand short-circuit of `||`). Checked whether this matters: `isDateInBusinessWindow` (`src/lib/time/london.ts:97-110`) is pure, synchronous, UTC-only date arithmetic with no I/O and no side effects — skipping the call is behaviourally inert.

**Executed mutation-check (scratchpad only, no repo mutation):**

Built a harness at `<scratchpad>/c23-mutation/` — copies of `availability.ts` and the options test, run via a scratchpad `vitest.config.mts` with `root` pointed at the real repo (so `node_modules` and the `@` alias resolve normally) and `test.include` scoped to the scratchpad directory only. Three runs:

| Copy | Mutation | Result |
|---|---|---|
| control (unmodified copy of shipped `availability.ts`) | none | **7/7 pass** |
| mutant 1 | guard 1: `&&` → `\|\|` | **5/7 fail**, including both options-omitted tests |
| mutant 2 | guard 2: `\|\|` → `&&` | **4/7 fail**, including both options-omitted tests |

The control run confirms the harness itself is sound (matches the in-repo run below). Both mutants are caught specifically by the options-omitted regression-guard tests, confirming those tests are genuinely sensitive to the exact operators used — not vacuous. Full output logged at `<scratchpad>/c23-mutation/mutation-run-output.log`.

**Could not confirm:** the implementer's claimed historical TDD sequence (wrote the test first against the pre-change engine, saw 3/3 pass and "the two new-behaviour assertions" fail red, then edited) — no execution logs from that session exist for me to inspect. The current file has 3 options-omitted tests and 4 new-behaviour tests (1 `ignorePublicPause` + 3 `ignoreBookingWindow`), not 2; plausible that 2 of the 4 were added during later refinement, but I cannot verify the historical count. The executed mutation-check above is offered as an equivalent, arguably stronger, substitute for that claim: it does not matter what order the tests were written in — what matters is whether they actually catch a broken guard, which I directly demonstrated they do.

---

## 2 — Diff minimality and confinement

`git diff 8504746..16c700e --stat`: exactly 4 files, 571 insertions / 7 deletions —
```
src/app/api/admin/availability/month/route.test.ts | 218 ++
src/app/api/admin/availability/month/route.ts      | 106 ++
src/lib/booking/__tests__/availability-options.test.ts | 233 ++
src/lib/booking/availability.ts                    |  21 +-  (14 insertions, 7 deletions)
```

- `git diff 8504746..16c700e -- src/lib/booking/availability.ts` is exactly the two conditionals plus the necessary type-literal expansion to hold the two new optional fields — no reformatting, no unrelated edits. Verified every one of the +14/-7 lines: line-by-line accounted for as (a) the options-type literal growing from 1 line to 7 to fit two new documented optional fields, (b) the pause guard gaining `&& !options.ignorePublicPause`, (c) the window filter being wrapped in `(options.ignoreBookingWindow || ...)`. Nothing else changed in the file.
- `calculateAvailableSlots` (`availability.ts:796-859`): confirmed byte-for-byte untouched — its own `options: { now?: Date } = {}` signature and body are unmodified, absent from both commits' diffs.
- Public routes: `src/app/api/availability/route.ts` and `src/app/api/availability/month/route.ts` are absent from `git show --stat` on both `61111ee` and `16c700e` — confirmed unchanged.
- `ManualBookingForm.tsx`: absent from `git show --stat 61111ee` and `git show --stat 16c700e` — confirmed. The behavioural-baseline serialization the Owner approved (progress §0.2) is intact.

---

## 3 — The new admin route (`src/app/api/admin/availability/month/route.ts`)

- **Auth ordering (verified correct):** `createSupabaseServerClient()` → `getStaffProfile()` at `route.ts:55-56`; both permission checks (`route.ts:58-63`, `:68-73`) return early with 401/403 *before* `createSupabaseAdminClient()` is ever called at `route.ts:98`. This is the standing programme rule (`createSupabaseAdminClient()` only after `getStaffProfile()`), satisfied.
- **Tests exercise the real paths, not tautologies:** `route.test.ts` mocks `getStaffProfile`, `createSupabaseAdminClient`, and `calculateAvailableDays` individually, then asserts on the route's *own* branching logic:
  - unauthenticated → 401, `createSupabaseAdminClient` and `calculateAvailableDays` **not called** (`:99-107`)
  - `manage_bookings_assigned` only (not `_all`) → 403, admin client not called (`:109-119`)
  - active:false with the permission → 403 (`:121-130`) — a deactivated-account edge case beyond what the dispatch asked for
  - valid staff → 200 with the expected body (`:175-186`)
  - malformed month / missing fields / unparseable JSON → 400, engine not called (`:146-167`)
  These assertions can and do fail on a broken implementation (verified by reading the assertions — `not.toHaveBeenCalled()` and `.toBe(401)`/`.toBe(403)`/`.toBe(400)` are not tautological against mocks).
- **Zod shape:** byte-identical to the public route. Diffed `route.ts:33-38` against `src/app/api/availability/month/route.ts:11-16` — identical schema.
- **Engine call:** `route.ts:99-103` calls `calculateAvailableDays(..., adminClient, { ignoreBookingWindow: true, ignorePublicPause: true })` — matches the plan exactly; asserted by test `route.test.ts:188-196`.
- **Deliberately not rate-limited:** confirmed no `checkRateLimit`/`rate-limit` import anywhere in `route.ts`. The omission is explained in a substantial header comment (`route.ts:14-22`) and locked by a test (`route.test.ts:132-138`, `"never consults the public availability rate limiter"`) — deliberate and documented, not an oversight, per the requirement.
- **Permission choice — judged coherent, and more solidly than the dispatch implied.** The dispatch describes `createManualBooking` as using "the broader `canManageBookings` (all or assigned)." Traced this precisely: `createManualBooking` (`src/app/admin/bookings/actions.ts:1466-1473`) first calls `requireBookingManager()` (`actions.ts:118-127`), which does gate on the broad `canManageBookings` (all-or-assigned). **But `createManualBooking` then applies a second, narrower, explicit check at `actions.ts:1471`: `if (!actor || !canManageAllBookings(actor))` — which overrides the first.** The effective permission required to successfully submit a booking via this action is `canManageAllBookings`, not the broader `canManageBookings`. Separately, the page itself (`src/app/admin/bookings/new/page.tsx:26`) gates the *entire render* on `canManageAllBookings` — a staff member with only `manage_bookings_assigned` never even sees the form. All three surfaces — page render, actual submission, and the new availability route — converge on requiring `manage_bookings_all`. There is no role that can reach the form or successfully submit it that would be refused by the new route, and no role admitted by the new route that couldn't already reach/submit the form. Coherent.

---

## 4 — Duplication judgement (`datesOfMonth`)

Diffed the schema + `datesOfMonth` block in the admin route (`route.ts:33-51`) against the public route (`src/app/api/availability/month/route.ts:11-26`): **byte-identical** apart from one added explanatory comment in the admin copy. No drift risk from copy-paste error.

Correctness/robustness of the shared logic: `new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()` uses the "day 0 of the following month" trick entirely in UTC — immune to local-timezone/DST effects (no local-time APIs used), and correctly returns 28/29 for February since `Date.UTC` implements standard Gregorian leap-year rules. Verified this is identical, not just similar, in both files, so there is no risk of the two drifting on month boundaries, leap years, or DST.

The brief's "no duplicated logic" requirement targets the **availability engine**, not incidental date arithmetic: `calculateAvailableDays` itself is imported from `@/lib/booking/availability` in both routes — genuinely shared, not reimplemented. Only the 8-line `datesOfMonth` helper is duplicated, and the implementer's stated reason (avoid editing a live customer-facing route file to export a non-handler symbol) is sound given the D25 live-surface risk posture.

---

## 5 — Gate §3.2 as amended (progress §0.1) — re-run and reported literally

Amended gate text (progress §0.1): *"the diff has ZERO INSERTIONS... and `src/lib/booking/availability.ts` specifically is byte-identical."*

Re-ran at current HEAD (`16c700e`), post-Phase-B:

```
git diff master redesign/start-state --stat -- src/lib/booking/availability.ts src/app/api/availability/
 src/app/api/availability/month/route.ts |  17 ---
 src/app/api/availability/route.test.ts  | 177 --------------------------------
 src/app/api/availability/route.ts       |  15 ---
 src/lib/booking/availability.ts         |  21 ++--
 4 files changed, 7 insertions(+), 223 deletions(-)
```

- The two **route files**: pure deletions in the master→start-state direction (confirmed with `--numstat`; zero `+` lines) — cleanly satisfy "zero insertions." This is C-22's rate limiting, added on master as wholly new lines (new imports + new guard blocks) that never touched a pre-existing line, so git's line-diff renders it as pure addition/deletion with no ambiguity.
- **`availability.ts` does NOT literally show zero insertions**: `git diff master redesign/start-state --numstat -- src/lib/booking/availability.ts` → `7  14`. This contradicts the dispatch's expectation ("confirm... still zero insertions in the master→start-state direction").
- **Why, precisely:** Phase B's change is additive-but-inline — it appends `&& !options.ignorePublicPause` to an *existing* if-condition, wraps an *existing* expression in `(options.ignoreBookingWindow || ...)`, and expands an *existing* one-line type literal to fit two new optional fields. Git's diff is line-granular: any edit to an existing line necessarily renders as delete-old-line + add-new-line, even when the edit is purely additive at the character/AST level. I checked each of the 7 "+" lines individually against the pre-Phase-B source and **every one is character-for-character identical to code that already existed in the file before Phase B** — none of them is independently novel content that master lacks and start-state has. Confirmed by reading the reverse-direction diff (`git diff redesign/start-state master`, which mirrors this exactly at 14 insertions/7 deletions) and mapping each hunk back to the Phase B commit's own diff (§2 above) — they are the identical three hunks.
- **Net assessment:** the property the gate exists to protect — *master has everything start-state has, on these paths* — still holds semantically for `availability.ts`. But the literal numeric form of the amended gate ("zero insertions") is not achievable for any change that edits an existing line rather than adding a wholly new block, which is exactly what a minimal, guard-only Phase B edit necessarily does. The gate wording was written (and re-confirmed by the dispatch) without anticipating that inline edits render this way in git's diff algorithm.
- **The `availability.ts` byte-identical half of the compound gate now fails, exactly as both the plan (§0 risk note) and the progress doc (§0.1) explicitly anticipated** — Phase B intentionally, necessarily edits this file; this is not a new problem, it is the expected and accepted consequence of Phase B landing.
- **Direction check:** confirmed master-ahead-only in substance — the reverse diff (`redesign/start-state → master`) shows the two route files as pure `+` (zero deletions) and `availability.ts` as the same mirrored 14+/7- reformatting-artifact pattern, not any independent start-state-only content.

**Recommendation (not a blocker):** reword the gate to something git-diff-line-granularity can actually satisfy for inline edits — e.g. "no line in the master→start-state diff introduces content that isn't already present, verbatim, somewhere in the pre-Phase-B `availability.ts`" — or drop the literal-insertion-count framing for files touched by additive-but-inline edits and rely on the semantic walk-through above plus the mutation-check (§1) instead.

---

## 6 — Gates, run and reported by identity

All commands run from the repo root, read-only (no repo files written except this one).

**`npx tsc --noEmit`** → 0 errors. Matches inherited baseline (0 errors).

**The two new suites** (`npx vitest run src/lib/booking/__tests__/availability-options.test.ts src/app/api/admin/availability/month/route.test.ts`) → **18/18 pass** (7 + 11).

**Full `npx vitest run`** → **5 failed / 1993 passed (1998)**. Failing tests, by identity:
```
FAIL src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated
FAIL src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors
FAIL src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent
```
Exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 — matches the inherited baseline **by identity** (same test names, not just same count), and matches the implementer's own reported numbers exactly (5 failed / 1993 passed / 1998 total). No new failures, no swapped-in failures, no failures in any Phase C file.

**`npx eslint .`** → **59 errors / 7 warnings**, in exactly:
```
design_handoff_area_pages/prototype/area-page.jsx
design_handoff_area_pages/prototype/shared.jsx
design_handoff_area_pages/prototype/site-chrome.jsx
src/features/booking/BookingExperience.tsx
src/features/booking/BookingExperienceLoader.tsx
src/features/booking/utils/returning-customer.ts
```
Matches the inherited baseline exactly, by file identity.

**`git status --porcelain` isolation:** clean for every C-23-scoped path (`git status --porcelain -- src/lib/booking src/app/api src/app/admin/bookings/new src/lib/auth` → empty). The only tracked modification anywhere in the tree is `src/lib/maintenance.ts` (pre-existing Owner-owned change, excluded from isolation checks per the standing rule). Remaining untracked/deleted entries (`.playwright-mcp/*` deletions, `design_handoff_public_pages/*` deletions, `design_handoff_area_pages/`, `photos-rahma-therapy/`, `redesign/evidence/C-21/*`, `test-results/`) are pre-existing tree noise unrelated to C-23, none of it under this plan's touched paths.

**Concurrency check:** at the start of this verification, no Phase C files existed under `src/app/admin/bookings/new/`. Mid-session, two untracked files appeared there — `AvailabilityCalendarField.tsx` and `use-month-availability.ts` — matching exactly the calendar component and month-cache hook the plan's Phase C (Steps 5–6) describes. Confirmed via `git status --porcelain` on those two paths specifically: both `??` (untracked, not staged, not part of any commit). Disjoint from Phase B's touched-file set (`src/lib/booking/availability.ts`, `src/app/api/admin/availability/month/route.ts`(+test), `src/lib/booking/__tests__/availability-options.test.ts`) — no overlap. Per the dispatch, this is expected concurrent Phase C work-in-progress, not a Phase B isolation violation, and is reported here as context only. The full vitest run (above) predates their appearance and shows no failures attributable to them.

---

## 7 — Summary of findings, ranked

1. **(Informational, not blocking)** — Gate §3.2's literal "zero insertions" wording does not hold for `availability.ts` post-Phase-B (7 insertions per `git diff --numstat`), contradicting the dispatch's stated expectation. Root cause is git's line-granular diff rendering an inline, additive edit as delete+add; semantic re-derivation (§5) confirms no independently novel content exists in start-state that master lacks. Recommend rewording the gate. No code defect.
2. **(Clarification, not blocking)** — The dispatch's framing of `createManualBooking`'s permission gate as "the broader `canManageBookings`" is imprecise: the action applies a second, narrower `canManageAllBookings` check that is the one actually enforced (`actions.ts:1471`). This makes the new route's permission choice *more* clearly coherent than the dispatch implied, not less.
3. All other lead items (§1–4) verified with no discrepancies: options-omitted path is byte-identical by algebra, executed mutation-check, and test inspection; diff is minimal and fully confined; `calculateAvailableSlots` and both public routes are untouched; `ManualBookingForm.tsx` is absent from both commits; the new route's auth ordering, test coverage, zod-shape mirror, engine call, and rate-limit omission are all correct and deliberate; `datesOfMonth` duplication is byte-equivalent and timezone/leap-year-safe.

## 8 — Claims I could not confirm

- The implementer's claimed historical TDD sequence (test-first against the pre-change engine, observed red, then edited) — no session logs available to inspect. Substituted with an executed mutation-check (§1) that verifies the same property more directly: the guards are load-bearing and the regression tests actually catch broken guards.
