# C-23 — Availability-aware calendar on the admin create-booking page — PROGRESS

**Plan:** `redesign/plans/C-phase/C-23-admin-availability-calendar-plan.md`
**Brief:** `redesign/briefs/C-23-admin-availability-calendar-brief.md`
**Programme:** Band C, C-C implementation — plan **#19 executed** (§4 order position 20). **Taken ahead of C-19 and C-20 under an Owner-approved reorder (2026-08-04)**: C-19 is blocked on the registered company name/number and C-20 on a Maps API key absent from the repo. C-23-before-C-14 is preserved.
**Predecessor:** C-18, closeout `7b1db05`.
**Migrations:** none. **Zone-2 actions:** one (pre-flight #4).

**Governing constraint (Owner direction 2026-07-16):** *"ensure it doesn't cause any discrepancies or issues nor remove anything unnecessarily."* C-23 changes how staff **see** dates, never what the form **submits**. Brief §2's non-removal list is a hard blocking gate (§3.4), not advice.

---

## 0 — Pre-flight (2026-08-04, at `7b1db05`)

| # | Check | Result |
|---|---|---|
| 1 | branch `master`; `git merge-base --is-ancestor ea97932 HEAD` | ✅ `master`, exit 0 |
| 1 | `git status --porcelain -- src/lib/booking src/app/api src/app/admin/bookings/new` | ✅ **empty** |
| 2 | dev server | ✅ 200 (Owner-run; never spawned or killed by an agent) |
| 3 | port-parity identity assertion | ⚠️ **NON-EMPTY — see §0.1** |
| 4 | behavioural baseline | ⛔ **HELD — see §0.2** |
| 5 | anchor greps | ✅ all re-located by symbol — see §0.3 |
| 6 | sibling-plan collision check | ✅ C-02, C-03, C-06 all shipped; **C-20 not started**; C-22 shipped (see §0.1) |
| — | serialization: C-14 must not have landed | ✅ `git log --grep="feat(redesign): C-14"` empty; `src/lib/booking/working-hours-segments.ts` absent |

**Baselines inherited from C-18 §5.3, by identity:** tsc 0 · build clean 54/54 static · vitest **5 failed / 1975 passed (1980)**, failures exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 · eslint **59E/7W** in exactly the six baseline files. **Three of the five vitest failures sit in `ManualBookingForm.test.tsx`, this plan's primary edited file** — so every "prove nothing changed" run diffs against those three named failures, never against green.

### 0.1 — ⚠️ Pre-flight #3 came back non-empty. Plan-vs-reality contradiction, STOPPED, Owner resolved.

The plan's assertion (`plan:30`) requires `git diff master redesign/start-state --stat -- src/lib/booking/availability.ts src/app/api/availability/` to be **empty**, and states: *"Non-empty output → the parity premise broke — stop and surface to the user."* It returned:

```
src/app/api/availability/month/route.ts |  17 ---
src/app/api/availability/route.test.ts  | 177 ---
src/app/api/availability/route.ts       |  15 ---
3 files changed, 209 deletions(-)
```

**Diagnosed before surfacing, and the premise it protects is intact:**
- **`src/lib/booking/availability.ts` is absent from the diff — the engine is byte-identical.** Every C-23 Phase B anchor therefore still holds exactly (confirmed in §0.3).
- **Zero insertions.** Every line is a deletion in the master→start-state direction, i.e. master is strictly *ahead*; start-state contains nothing master lacks. The property the port gate exists to protect — *master has everything start-state has* — holds perfectly.
- **The entire 209-line divergence is C-22's rate limiting**, added to master after the `ea97932` merge. Confirmed by reading the hunks: both route files gain the `// C-22 Step 4a (D23)` import + `checkRateLimit` guard block, and `route.test.ts` is 177 lines of C-22's rate-limit tests. **This plan's own header told us to check for exactly this** ("C-22 (D23) adds rate limiting to the public `/api/availability*` routes — check `git log --oneline --grep=\"feat(redesign): C-22\"` before touching those files"). C-22 is shipped: `a63de0b`, `ceb028d`.

**Owner decision 2026-08-04, in chat: amend the gate to its actual intent.** The blocking assertion (pre-flight #3 and gate §3.2) becomes **"the diff has ZERO INSERTIONS"** — start-state contains nothing master lacks — rather than "the diff is empty". The literal empty-diff form is now permanently unsatisfiable, because C-22 is shipped and staying, and the merge the gate was originally protecting already happened at `ea97932`. Rejected alternative: porting C-22's rate limiting onto `redesign/start-state` purely to restore literal parity — writing to a branch outside this plan's scope to satisfy a check whose purpose is already served.

**Gate §3.2 is therefore re-stated as:** `git diff master redesign/start-state -- src/lib/booking/availability.ts src/app/api/availability/` shows **zero insertions**, and `src/lib/booking/availability.ts` specifically is **byte-identical**. Both true at `7b1db05`.

### 0.2 — ⛔ Pre-flight #4 — HELD, awaiting Owner approval

Plan `:34-39`. Submitting three real admin bookings end-to-end against the **production** database, via the live admin form (no SQL), to capture the behavioural baseline that blocking gate §3.3 compares against. Fixture guard: `*.example.test` clients and standard test staff only; every created row id recorded here for cleanup; Badar's `9d55ce2a` and all real customer rows untouched.

**Two blockers, both surfaced in chat:**
1. **No agent may authenticate** (password entry is prohibited; protocol §3b records the same). The Owner authorised agents to use the admin logins directly on 2026-08-04; **that authorisation cannot be accepted** — the prohibition holds regardless of who grants it. **Substitute offered:** the Owner signs in once in their own Chrome and the orchestrator drives the already-authenticated session, which is not credential entry.
2. **Open question raised with the ⛔, not yet answered:** does completing an admin booking send a real confirmation email? If so that is a second Zone-2 trigger (rule 2's effect-based catch-all). `*.example.test` addresses do not receive mail, but the send would still occur.

**Re-sequencing proposed to the Owner, not acted on unilaterally:** pre-flight #4's baseline is load-bearing only for gate §3.3, which compares the admin form's *submitted payload* before and after. Phases B and C do not touch that form — B adds a defaulted options bag to the engine plus a new admin route, C builds a component that is not wired in until Phase D. So the baseline could be captured after B and C and remain a valid "before", provided the diff confirms `ManualBookingForm.tsx` was untouched (trivially checkable). That would unblock 3 of 5 commits. **Awaiting the Owner's decision; nothing proceeds without it.**

### 0.3 — Anchors, re-located by symbol (plan line numbers are 2026-07-16 vintage)

The divergence is instructive: **`availability.ts` has not moved a single line since `ea97932`**, so every Phase B anchor is exact — while `ManualBookingForm.tsx` grew **2,019 → 2,254 lines** under C-02/C-03/C-06.

| Anchor | Plan cites | Actual at `7b1db05` | |
|---|---|---|---|
| `calculateAvailableDays` | 867 | **867** | exact |
| `booking_status_enabled` early return | 887-889 | **887** | exact |
| `datesInWindow` filter | 896-904 | **896** | exact |
| `ignoreBookingWindow` / `ignorePublicPause` | — | **absent** | correct; Phase B adds them |
| `bookingDate` / `startTime` / `overrideAvailability` state | ~527-530 | **593-595** | drifted |
| `canCheckAvailability` | 665 | **742** | drifted |
| `checkAvailability` useCallback | — | **748** | |
| hidden `booking_date` / `override_availability` inputs | — | **1075 / 1078** | |
| the three `type="date"` branches | 1445 / 1498 / 1630 | **1639 / 1692 / 1824** | drifted; **still exactly three** |
| `getStaffProfile` | `rbac.ts:308` | **`rbac.ts:340`** | drifted |
| `src/app/api/admin/` | expected absent | **absent** | Step 4 creates the first route there |

### 0.4 — Verification tiers and model routing, declared in advance (§2.9c, §5)

| Phase | Tier | Model | Why |
|---|---|---|---|
| A | verify-only, no commit | — | Superseded by C23-F1/D25 — a commit here would be empty |
| B — engine options + admin route | **FULL** | **opus** | `availability.ts` and `/api/availability/month` serve the **LIVE public customer calendar** (`ScheduleStep.tsx:94-104`, unauthenticated, service-role). D25 makes this a production customer surface, not a dormant port |
| C — calendar component + month hook | TARGETED | sonnet | Presentational component plus a cache/abort hook, not wired in until Phase D |
| D — wire the three branches | **FULL** | **opus** | Where payload identity is actually at risk, on a shared file five Band-C plans edit |
| E — closeout | FULL | sonnet fan-out | Three blocking gates (§3.2, §3.3, §3.4), none waivable |

---

## 1 — ▶ Position

**HELD at pre-flight #4 (⛔).** Pre-flight items 1, 2, 3, 5, 6 and the C-14 serialization check all pass. Nothing implemented; no commits; working tree clean over every C-23 path.
