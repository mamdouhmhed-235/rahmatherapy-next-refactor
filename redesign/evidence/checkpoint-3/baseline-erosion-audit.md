# Baseline Erosion Audit — Drift Checkpoint #3 Support

**VERDICT: CHAIN INTACT-WITH-BOOKKEEPING-DRIFT**

Read-only audit. Repo `rahmatherapy-next-refactor`, branch `master`, HEAD `435472a`. All 15 shipped C-phase progress files read in full (`redesign/per-page-progress/C-{21,22,06,04a,05,01,FIELDWORK,11,08,15,13,02,09,03,07}-*.md`), plus `SUBAGENT-RULES.md`, `DRIFT-CHECKPOINTS.md`, `OWNER-ACTION-BACKLOG.md`, `C-C-EXECUTION-PROTOCOL.md`, and the relevant `BAND-C-MASTER-PLAN.md` rows. Every git claim below was checked with `git log`/`diff`/`show`/`status` (no checkout, no stash, no writes except this file). Three static gates were **independently re-run at current HEAD** (not just read from documents): `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`.

**Independent re-verification at HEAD `435472a` (run by this audit, not copied from any progress file):**
- `npx tsc --noEmit` → **0 errors.**
- `npx eslint .` → **59 errors, 7 warnings**, in exactly: `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`.
- `npx vitest run` → **5 failed | 1494 passed (1499)**, failures exactly `src/lib/auth/admin-access.test.ts` ×2 (`gives Owner broad access…`, `gives Admin broad operational access…`) + `src/app/admin/bookings/new/ManualBookingForm.test.tsx` ×3 (`renders step 1 on first load`, `moves focus to the first invalid field…`, `shows the consent error…`).
- `git ls-files design_handoff_area_pages/` → **0 files** (directory is entirely untracked; `git status --porcelain` shows it as `??`).
- `git status --porcelain -- src/` → only `M src/lib/maintenance.ts` (`MAINTENANCE_MODE = false` in the working copy vs `true` at HEAD — the documented, deliberate, never-staged Owner exception).

This matches C-07's own final closeout numbers (§1.11 of its progress file) exactly. **The core safety mechanism — gates pass only if every present failure is on the inherited identity list — held all the way to today, and I confirmed that myself rather than trusting the last progress file's word for it.**

---

## 1 — Chronological table

All totals below are as **recorded in each plan's own progress file / the master-plan row**, not independently re-run per-commit (checkout is forbidden, so historical intermediate states cannot be reproduced — only HEAD can be, and was, above). Where a plan's own file never states a final total, that gap is itself flagged (see §3).

| # | Plan | Final code SHA | tsc | vitest (failed/passed/total) | Failure identity | lint | Migration(s) |
|---|---|---|---|---|---|---|---|
| 0 | *programme start* | `7fe8b4f` (docs) / `11553c7` (C-21's own "programme-start" cite, a later docs commit, `7fe8b4f` ⊂ `11553c7`) | 0 | 6 / ~485 / ~491 | `ManualBookingForm`×3, `admin-access`×2, `createBookingTransaction`×1 | 59E/7W | — |
| 1 | C-21 canonical domain | `21915d0` | 0 | 6 / 488 / 494 | same 6 | 59E/7W | — |
| 2 | C-22 abuse protection | `e4544bb` | 0 | 6 / 519 / 525 | same 6 | 59E/7W | — |
| 3 | C-06 client CRUD | `88d2a6d` | 0 | **5** / 612 / 617 | `createBookingTransaction` **removed, confirmed** (§4 below) | 59E/7W | `c06_client_crud_hardening` |
| 4 | C-04a cancellation restore | `ad0c50b` | 0 | 5 / 749 / 754 | same 5 | 59E/7W | `c04a_scheduled_emails`, `c04a_grant_update_email_delivery_events` |
| 5 | C-05 cancelled-bookings inert | `61be354` | 0 | 5 / 773 / 778 | same 5 | 59E/7W | — |
| — | *Drift checkpoint #1* (`7fe8b4f..8682f3b`) | | | 5/773/778 | identity-exact | 59E/7W | PASS, no findings |
| 6 | C-01 review-request email | `5164d00`, 2nd fix round `69c4e01` | 0 | 5 / 792 / 797 → **5 / 829 / 834** (after 2nd fix round, dated 2026-07-30, landed *after* C-FIELDWORK shipped) | same 5 | 59E/7W | — |
| 7 | C-FIELDWORK experience | `6314718` | 0 | 5 / 826 / **831** (own file's claim — **stale**, see §3) | same 5 | 59E/7W | — |
| 8 | C-11 dashboard/dark-mode | pre-flight re-verify **5/829/834** (matches C-01's later number, not C-FIELDWORK's own claim) → hand-off **5/881/886** (dropped from 888 by an Owner-approved deletion of 2 unwired blocks, −7 tests, explicitly *not* erosion) | 0 | | | 59E/7W | `c11_theme_preference` |
| 9 | C-08 email automation | `302f90e` | 0 | 5 / 991 / 996 | same 5 | 59E/7W | 2 migrations + 1 Zone-2 data deletion |
| 10 | C-15 email template studio | `8851e8c` | 0 | 5 / 1107 / 1112 | same 5 | 59E/7W | — |
| — | *Drift checkpoint #2* (`7fe8b4f..0bb356d`) | | | 5/1107/1112 | identity-exact | 59E/7W | FAIL (F-1 process, F-2 product) → both fixed `34e45da` |
| 11 | C-13 group bookings | `d7d67c3` | 0 | 5 / 1181 / 1186 | same 5 | 59E/7W | — |
| 12 | C-02 recurring bookings | `ce5ad07`(+closeout) | 0 | 5 / 1258 / 1263 | same 5 | 59E/7W | `c02_recurring_bookings` |
| 13 | C-09 cache invalidation | master-plan cites `880809e` → **5/1421/1426** — **but this is not C-09's actual final commit** (see §3) | 0 | (no final gate table in C-09's own progress file) | same 5 (by every reference) | 59E/7W | — |
| 14 | C-03 enquiry→booking | `8864e46`/`d3b5c90` | 0 | 5 / 1462 / 1467 (master-plan row; **C-03's own progress file never restates this**, see §3) | same 5 | 59E/7W | `c03_enquiries_converted_booking_index` |
| — | *Drift checkpoint #3 groundwork*, `822441d` | | | **5/1485/1490**, independently re-run by 3 agents | identity-exact | 59E/7W | — |
| 15 | C-07 routing/defaults | `f038b4f` | 0 | 5 / 1494 / 1499 (own file **corrects** a stale interim `1483/1488` figure — §3) | same 5 | 59E/7W | — |
| — | **HEAD `435472a` — independently re-run by this audit** | | **0** | **5 / 1494 / 1499** | **same 5, names verified** | **59E/7W, files verified** | — |

---

## 2 — Q1: Identity chain integrity

**Finding: no failure was ever added to the list. No failure ever silently vanished without being confirmed. The chain is intact.**

- **`createBookingTransaction`'s removal was not a quiet disappearance — it was pre-announced and then confirmed.** C-21's own progress file (line 127) states, before any work on it: *"C-06 (plan #3) is the plan expected to remove failure #3 (`createBookingTransaction`) — confirming that removal is an explicit exit-criterion of C-06's closeout."* C-22 repeats the same forward-reference verbatim (line 223). C-06 then delivers: §5 Phase B of `C-06-client-crud-hardening-progress.md` states *"Expected shrinkage CONFIRMED... The verifier ruled it legitimately fixed and in fact strengthened — the spec diff is six additions and zero deletions, the assertion remains exact deep-equality (not `objectContaining`)."* Drift checkpoint #2 (`DRIFT-CHECKPOINTS.md` line 50) independently re-read the diff at a later date and confirmed the same thing: *"`createBookingTransaction.test.ts` was strengthened... that is C-06's expected shrinkage, correctly earned."* This is triple-verified, not a single self-report.
- **Every one of the 12 subsequent plans (C-04a through C-07) re-confirms the same 5-name list, by identity, at its own closeout**, and several explicitly re-check that `createBookingTransaction` stays absent (e.g. C-11 pre-flight: *"`createBookingTransaction` confirmed ABSENT — C-06's expected shrinkage still holds"*; C-07 closeout: *"No `createBookingTransaction` entry — C-06's expected shrinkage still holding"*).
- **No plan recorded a different list without explaining the change.** The only list-shape events across the whole programme are: (a) the one confirmed removal above; (b) two intermittent 6th-failure flakes, both explicitly diagnosed as environment flakes and not identity changes — C-09 (§4.1 addendum note) and C-02 (§4.1: *"a 6th failure appeared once in the same already-failing `ManualBookingForm` file... Three later clean runs showed exactly 5. Recorded as a load flake, not an identity change."*).
- **Independently confirmed today:** my own `npx vitest run` at HEAD reproduced the exact 5 names verbatim (see header). This is not "the last plan says so" — it is this audit's own tool output.

**Verdict on Q1: no erosion. This is the strongest-held invariant in the whole programme.**

---

## 3 — Q2: Count drift — where it entered, and what it did (and didn't) affect

**Two documented, real drift events. Both are bookkeeping inaccuracies. Neither ever changed a gate's PASS/FAIL outcome, because outcomes were judged by identity, never by count — but they are real inaccuracies in the written record, and I traced their concrete origin with git.**

### 3.1 — The C-FIELDWORK/C-01 "826 vs 829" episode

C-FIELDWORK's own progress file (§0, §6) records its inherited baseline as *"792 total at plan start"* and its own final hand-off as *"5 failed / 826 passed"* with the explicit claim *"This is the baseline plan #8 (C-11) inherits."* But C-01 underwent a **second fix round** (`69c4e01`), dated 2026-07-30 — chronologically *after* C-FIELDWORK shipped the same day — which added 3 more passing tests, moving the true count from 826/831 to **829/834** (C-01 progress file §8). C-FIELDWORK's own closing claim was therefore stale the moment it was written, superseded by a sibling plan's later same-day commit.

**This did not mislead anyone downstream**: C-11's own pre-flight independently re-ran the suite and recorded **5/829/834** (`C-11-...progress.md` line 31) — the *correct*, post-fix-round number — not C-FIELDWORK's stale 826. So the error was self-correcting in practice, caught by the next plan's own independent gate re-run rather than by anyone noticing the file contradiction. Nobody flagged the C-FIELDWORK/C-01 file disagreement explicitly in text, but no gate decision was ever made on the wrong number.

### 3.2 — The "1483 vs 1490" episode (the one the task names) — traced to its exact source

C-07's own progress file (§1.11) states: *"This file previously recorded the inherited vitest baseline as 5 failed / 1483 passed (1488). Three agents independently re-ran the suite at HEAD on unchanged test code and all three got 1490 total pre-B4... The gap was already present before B4 touched anything."* I confirmed via `git log -S"1483 passed" -- redesign/per-page-progress/C-07-routing-and-per-role-defaults-progress.md` that this figure was first written at commit `c52942c` ("C-07 interrupt checkpoint — paused at B4 HARD-STOP"), and that `1483 = 1477 (B1's own recorded figure) + 4 (B2's new specs) + 2 (B3's new specs)` — i.e. C-07's own phase-by-phase arithmetic was **internally consistent** but its **starting point (1477, recorded at B1) was already wrong relative to ground truth**. Drift-checkpoint #3's groundwork, run independently at `822441d` (before B4), got **1490** by three separate re-runs — a **7-test gap that predates any C-07 phase**.

**I traced this gap to its actual entry point, not just its discovery point.** The chain of custody:
- C-02 closed cleanly at **1263** (independently re-verified at its own closeout, §4.1).
- **C-09 is the only one of the 15 plans whose progress file never states a final post-implementation gate table** (tsc/lint/vitest/build numbers) — every other plan has one (C-21 §3, C-22 §4/§9, C-06 §6b, C-04a §0l, C-05 §6, C-01 §7, C-FIELDWORK §6, C-11 §3, C-08 §3, C-15 §7.4, C-13 §4.2, C-02 §4.1, C-07 §1.11). The master-plan's own C-09 row cites commit **`880809e`** and **"5 failed / 1421 passed (1426)."**
- **But `880809e` is not C-09's true final commit.** `git log --oneline 880809e..08cba8c` shows five more commits after it: `76f527c` (docs) · `08bee11` (fix: tag roles+services mutations) · `2d5bcdb` (fix: tag `updateRoleMetadata`) · `457e3ff` (fix: tag three more `audit_logs` writers — C-09's own "second addendum... 'genuinely inert' retracted") · `08cba8c` (docs, C-09's actual final, cited by C-03's own predecessor line as *"C-09, whose final commit is `08cba8c`"*).
- `git diff --stat 880809e 08cba8c -- '*.test.ts' '*.test.tsx'` shows **6 new/extended spec files, 1184 insertions, 29 new `it(`/`test(` cases** added by those addenda commits — tests that exist in the tree today but were **never folded into any recorded "final" total** for C-09, because no closeout gate table was ever written after them.
- **C-03 also never restates a final gate table in its own progress file** (its §0 pre-flight only says *"all four static gates identity-exact"* with no numbers); the only concrete C-03 total (1462/1467) lives solely in the master-plan row, one level removed from the plan's own primary record.
- C-07's B1 (the very next concrete number recorded anywhere) states **1477** — a figure that, given the 29 uncounted C-09 tests plus C-03's own additions, undercounts the actual tree by roughly the same order as the eventual 7-test gap found at `822441d`.

**Conclusion for Q2: the drift entered specifically at the C-09→C-03 handoff, because C-09 is the one plan in the programme whose Owner-approved addenda (widening the tag sweep twice, after its own headline closeout) were never re-counted into a fresh closeout total, and C-03 — the next plan — inherited a number one step removed from C-09's own file rather than a fresh independent re-run.** This is a **process gap** (two plans broke the otherwise-universal "record a final gate table" convention, at exactly the point drift later surfaced), not a case of numbers being fabricated or a gate passing on a false premise: every plan from C-09 onward still verified failures **by identity** at each of its own checkpoints, and identity was never wrong. C-07's closeout (three independent re-runs) and drift-checkpoint #3's groundwork both caught and corrected the total before it could mislead a real decision.

**This is a bookkeeping inaccuracy, not a safety failure**, for the same reason as §3.1: the protocol's actual gate criterion (§0/§header of `C-C-EXECUTION-PROTOCOL.md`) is stated explicitly — *"A gate passes only if every present failure/error is on the inherited list — same totals with a swapped-in new failure is a FAIL"* — and totals were never the criterion. No plan's PASS was ever contingent on the wrong total; the totals are a health metric, not a gate condition, and the identity list underneath them was continuously correct.

---

## 4 — Q3: Lint chain — never different, but structurally fragile

**Finding: the lint identity (59 errors / 7 warnings, in exactly six files) never changed once across all 15 shipped plans, and I independently reproduced it exactly at HEAD.** I grepped every progress file for its recorded lint line and diffed the phrasing across all 15 (`grep -rhoE "[0-9]+E[/ ][0-9]+W|[0-9]+ errors? */ *[0-9]+ warnings?"`) — every single instance reads `59 errors / 7 warnings` / `59E/7W`, and every file-level breakdown that names files individually (C-05, C-08, C-13, C-15, C-07) lists the identical six paths with identical per-file counts: `design_handoff_area_pages/prototype/area-page.jsx` (48E/1W), `.../shared.jsx` (2E/5W), `.../site-chrome.jsx` (5E/0W), `src/features/booking/BookingExperience.tsx` (3E/0W), `.../BookingExperienceLoader.tsx` (1E/0W), `.../utils/returning-customer.ts` (0E/1W). My own `npx eslint .` run at HEAD reproduced this file set and these exact per-file counts.

**The membership never changed. But the flag the task asked me to note is real and confirmed**: `design_handoff_area_pages/` is **completely untracked by git**. `git ls-files design_handoff_area_pages/` returns **0 files**; `git status --porcelain design_handoff_area_pages/` shows `?? design_handoff_area_pages/`; there is no `.gitignore` entry for it (it's simply never been `git add`-ed). **93% of the recorded lint errors (55 of 59) and 86% of the warnings (6 of 7) come from a directory git has never versioned.** This was independently noted inside the programme too — C-21's own progress file §5.6 flags the directory's evidence-PNG analogue as deliberately uncommitted, and no plan ever raises the lint implication specifically, but the fact stands on inspection.

**The implication, stated plainly:** the protocol's baseline-by-identity mechanism (`SUBAGENT-RULES.md` rule 9: *"Baselines are BY IDENTITY: compare lint/vitest failures against the inherited list... same totals with a swapped-in new failure is a FAIL"*) implicitly assumes the six-file lint baseline is a stable, reproducible fact of the repository. For three of those six files, it is not a fact of the *repository* at all — it is a fact of whatever happens to sit, untracked, in this working directory. A fresh clone of this repo at any commit in the entire programme would show only **4 errors / 1 warning** (the three `src/features/booking` files), because `design_handoff_area_pages/` would not exist. If that directory were ever deleted, moved outside this working copy, or excluded by a future `.gitignore`, the "inherited lint identity" that every subsequent plan is instructed to diff against would silently shrink from 6 files to 3 — and, more importantly, if it were ever re-created differently (e.g. re-generated by a design tool with different content), a genuinely new lint error introduced there would be indistinguishable, by the "same total" heuristic alone, from the pre-existing baseline. **This has not happened — every re-run throughout the programme, including mine today, found the identical six files with identical counts** — but it is a real structural gap in the safety mechanism's own precondition, not a hypothetical one: the mechanism's reproducibility currently depends on an artifact git does not control.

---

## 5 — Q4: Gates recorded as NOT RUN / skipped / deferred / Owner-performed — the complete list

Two categories: (A) items that are **structurally impossible for any agent** (require admin authentication, which the harness prohibits), consistently and honestly disclosed every time, never claimed as passed; (B) the **bundle-budget gate**, hit by a specific, identifiable tooling gap, also always honestly disclosed as NOT RUN rather than falsely marked PASS.

### 5.1 — Category A: sign-in-gated Playwright/role sweeps (every instance found)

| Plan | Item(s) NOT RUN | Disposition |
|---|---|---|
| C-06 | §3.2e/f/g (irreversible sensitive-note deletion, bulk delete, privacy `deletion_review` completion), §3.2h/i | Owner-scoped-out; covered by unit specs only |
| C-22 | §3.2 happy-path booking, §3.7 admin booking (need production writes/real emails); §3.5/§3.5a rate-limit 429s (structurally impossible pre-deploy — limiter fails open under `next dev`) | deferred post-deploy |
| C-04a | §3.2 (4-role×4-viewport, 14 items), §3.3 screenshots | Owner-performed by necessity |
| C-05 | §3.2 (16-step sweep), §3.4 screenshots | Owner-performed by necessity |
| C-01 | §3.5 (4-role sweep), §3.6 screenshots, §3.3 Resend dashboard spot-check | Owner-performed; pipeline mechanism itself separately proved live via DB E2E |
| C-FIELDWORK | §3.2/§3.4 — **no safe fixture existed at all** for this plan's checks | Owner must create a fixture first |
| C-11 | §3.2/§3.5/§3.6/§3.7/§3.8 (role×theme sweep, WCAG, print, FOUC, ~35 screenshots) | Owner-performed by necessity |
| C-08 | §2.6b Phase C Resend checklist, §3.3 Phase D business-notification checklist, §3.4 trigger-hook E2E, §3.5 screenshots | Owner-performed by necessity |
| C-15 | §7.7 full studio verification pack | Owner-performed by necessity |
| C-13 | Entire group-booking sweep — **zero group bookings exist anywhere in production**, so C-13's headline feature is fixture-free by construction until the Owner creates one | Owner-performed by necessity |
| C-02 | §3.2 role×cadence×end-condition matrix, §3.4 email verification, all 8 §3.5 screenshots, §3.6 WCAG; 4 sub-items are **also post-deploy-only** (cron-dependent) | Owner-performed; some doubly blocked (sign-in AND deploy) |
| C-09 | §5 manual verification (per-mutation/cross-surface invalidation, filter round-trips) | Owner-performed by necessity |
| C-03 | §4 conversion-flow checklist; the B-106 re-conversion guard's E2E specifically needs a converted enquiry (production has 0) | Owner-performed; Owner explicitly deferred rather than plant a SQL fixture |
| C-07 | §3.2 (18-item role×viewport sweep), §3.4 screenshots | Owner-performed by necessity |

All of these are consolidated in `redesign/per-page-progress/OWNER-ACTION-BACKLOG.md`, itself created at drift checkpoint #1 specifically to stop this list fragmenting across per-plan appendices. **None of these were ever recorded as PASS** — every one carries an explicit NOT-RUN/deferred marker in its own progress file, per `SUBAGENT-RULES.md` rule 5 ("never claim a check you didn't run").

### 5.2 — Category B: the bundle-budget gate — precise identification, and the ordinal count is itself unreliable

The root tool is `scripts/measure-admin-bundles.mjs`, whose hardcoded `ROUTES` array covers only `/admin/dashboard`, `/admin/reports`, `/admin/clients/[clientId]`, `/admin/staff/[staffId]`, `/admin/me`, `/admin/staff/[staffId]/performance` — and whose only baseline snapshot (`redesign/baselines/bundle-pre-B1.json`) predates Band B entirely (captured 2026-05-24 at `d2e6512`). Every plan whose own budget ceiling named a route outside that list could not have its gate measured.

**Every plan actually hit by this, in order, with citations:**

1. **C-04a** (`C-04a-...progress.md` §0k) — first to log it: *"`node scripts/measure-admin-bundles.mjs` runs clean but measures only 6 routes... None is `/admin/bookings` or `/admin/bookings/[bookingId]`."*
2. **C-05** (§4) — *"Same pre-existing tooling gap already logged against C-04a's closeout."*
3. **C-FIELDWORK** (§5) — *"same pre-existing tooling gap already logged against C-04a's and C-05's closeouts."*
4. **C-08** (§3.2) — PARTIAL: `/admin/emails` uncovered; a sibling-route proxy measurement was substituted.
5. **C-15** (§7.4) — *"the delta is unobtainable... the plan's named ceilings (+10 kB / +2 kB) were never checked by anyone."*
6. **C-13** (§4.2) — *"the same structural blind spot C-08 and C-04a disclosed"*; used a scratchpad-only proxy script.
7. **C-02** (§4.2) — *"The bundle gate was NOT RUN. It cannot be... This is the third plan to hit the same tool gap (C-04a and C-08 logged it; C-15 hit it too)."*
8. **C-03** (master-plan row) — *"Bundle gate NEVER RUN... third plan hit by this"* — **the same ordinal ("third") C-02 used**, one plan later.
9. **C-07** (§1.10) — *"This is the fourth plan hit by the same gap (C-03's master-plan row records it as the third...)"* — correctly notices the numbering discrepancy and picks up from C-03's count rather than C-02's.

**C-11 is the one exception worth naming precisely**: its own headline ceiling (`/admin/dashboard`, +20 kB) **is** on the tool's route list and **was** genuinely measured (`+0.11 kB JS / +2.65 kB CSS`, comfortably inside budget) — C-11 only *mentions* the gap in passing (§5 item 5, re: `/admin/bookings/[bookingId]`), it was not itself blocked by it.

**The task's framing ("known to have been missed by at least four plans... C-07 says fourth") undercounts the true scope, and this undercounting is itself worth flagging as a finding.** By any consistent count, this gate has failed to answer the question it was asked **at least nine times** (C-04a, C-05, C-FIELDWORK, C-08, C-15, C-13, C-02, C-03, C-07) — not four. The programme's own internal tallies disagree with each other about the ordinal (C-02 and C-03 both self-report as "third"; `OWNER-ACTION-BACKLOG.md` line 46 separately calls C-07 "fourth occurrence" while line 57 calls C-02's discovery a distinct entry citing "C-04a, C-08, C-15 hit it first" without mentioning C-05, C-FIELDWORK, or C-13 at all). **This is a second-order bookkeeping inaccuracy layered on top of a correctly-and-consistently-disclosed gate**: the underlying fact (gate not run, don't claim it passed) was never misrepresented in any single plan — but the running tally of *how many times* this has happened is wrong in every file that states a specific ordinal, because no single document ever attempted the exhaustive count this audit just did.

**No other gate shows this same "hit repeatedly, self-count wrong" pattern at this scale.** The closest analogues are narrower and self-contained: the §3.2/§3.5 Playwright sweeps (Category A) recur constantly but are never given a running ordinal count in the text (each plan just says "Owner-performed by necessity," no "Nth plan" framing), so there is no ordinal to get wrong there.

---

## 6 — Q5: Expected shrinkage — the one instance, confirmed; no other promise was ever broken

Protocol §0 of `C-C-EXECUTION-PROTOCOL.md` states the rule directly: *"when a plan names a baseline entry it expects to fix... confirming that entry's REMOVAL from the inherited list is an explicit closeout exit-criterion for that plan."*

**Exactly one baseline entry was ever named as an expected fix across the whole programme: `createBookingTransaction`, assigned to C-06.** I grepped every progress file and every plan document for the phrase "expected shrinkage" (`grep -rn "[Ee]xpected shrinkage"`) and found:
- **C-21, C-22** (plans #1–2): both explicitly pre-announce it and record "none was expected for [this plan], and none occurred."
- **C-06** (plan #3): delivers it, with the confirmation quoted in §2 above.
- **C-08, C-13, C-15** (plans #9–11): each explicitly writes *"Expected shrinkage: none applicable — [plan] named no baseline entry it expected to fix, and none was fixed"* — i.e. every later plan actively confirms it named nothing new, rather than the topic simply going quiet.
- **C-11, C-07** (plans #8, #15): both explicitly re-confirm `createBookingTransaction`'s continued absence at their own pre-flight/closeout.

**No plan ever promised a baseline-failure removal that its own or a later progress file failed to confirm.** The one instance is unusually well-verified — verified once by C-06's own implementer/verifier pair, once by C-06's own closeout, and once independently by drift checkpoint #2 re-reading the actual test diff months later and confirming "strengthened... not weakened."

---

## 7 — Summary: what is a real safety failure vs. a bookkeeping inaccuracy

**Real safety failures found in this audit: none.** The mechanism the programme depends on — gates pass only if every present failure is on the inherited identity list — was never violated. No new failure was ever silently swapped in for a fixed one. No count-based judgment was ever substituted for an identity-based one in an actual gate decision. I confirmed the current state of all three static gates myself rather than trusting the last file's word, and it matches the historical record exactly.

**Bookkeeping inaccuracies found, real and worth fixing, none of which changed a gate outcome:**
1. The "826 vs 829" (C-FIELDWORK/C-01) and "1483 vs 1490" (C-07) count-drift episodes — both traced to their root cause here for the first time: C-01's second fix round landing same-day-but-after C-FIELDWORK's own closeout text was written, and — more materially — **C-09 and C-03 being the only two of fifteen plans that never recorded a final post-implementation gate table**, exactly where the larger (7–29 test) undercount entered.
2. The bundle-budget gate's own internal "ordinal" bookkeeping (which plan is "the third"/"the fourth" to hit the tooling gap) is itself wrong in every file that states a specific number — the true count of affected plans is at least nine, not four, though the underlying substance (never falsely marked as passing) was consistently honest every single time.
3. The lint chain's reproducibility rests on an untracked directory (`design_handoff_area_pages/`, confirmed 0 files under git) — never yet a live problem, but a real structural dependency the protocol's own identity-comparison mechanism does not currently account for.

**What this audit did not do:** it did not check out any historical commit (forbidden by the isolation rules and not attempted), so it cannot independently re-derive the exact historical vitest/lint totals at every intermediate commit — only at HEAD, and only by reading what each plan's own file recorded for its own point in time. Where a plan's file is the *only* source for a historical number (nearly everywhere except the specific git-diff spot-checks cited by SHA in §3), that is stated as such rather than asserted as independently re-verified.

---

*Audit complete. Output file: `redesign/evidence/checkpoint-3/baseline-erosion-audit.md` (this file), the only write performed.*
