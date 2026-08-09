# VERDICT: FAIL

**Programme drift checkpoint #4 (formal) — after plan #20 (C-23). Run 2026-08-09 on `opus`, read-only. The last of the four §2.6 checkpoints.**

**Range:** `7fe8b4f..102241f` — 336 commits, 514 files, +90,782 / −6,827. New ground since checkpoint #3 (`435472a`): 82 commits covering plans #16–#20 — C-16, C-17, C-18, C-19, **C-20 (still open)**, C-23.

**Programme-start SHA confirmed independently**, not taken from the dispatch: `C-C-EXECUTION-PROTOCOL.md:22` asserts `git merge-base --is-ancestor 7fe8b4f HEAD` as the §0 pre-flight; re-run here → **exit 0**. `7fe8b4f` = *"docs(redesign): D19 withdrawn per Owner…"*, 2026-07-27. (Master Plan Part 0's `6072284` is the last **Band B** doc commit, a different anchor; every prior checkpoint used `7fe8b4f` and this one does too, so the series is comparable.)

**Why FAIL, stated plainly so it is not over-read.** There is **no code-quality regression in this range**. The gates are identity-exact, every Part 0 convention holds, the colour-literal re-planting trend that checkpoints #2 and #3 tracked has **stopped**, token families are uncontaminated, JSON-safety held across eleven new cache wraps, and the baseline has never been eroded in 20 plans. The FAIL rests on three things, two of which are process and one of which is product:

1. **Checkpoint #2's `F-1` has recurred, live, during this checkpoint** — a write-task is mutating `src/` in the shared tree right now. The correction adopted in response to `F-1` ("drift checkpoints complete before the next plan's implementation begins; read-only prep may run in parallel, **writes may not**") is written down and was violated anyway. If a checkpoint cannot enforce its own precondition, the mechanism has no force.
2. **The one plan still open, C-20, has a progress file that is materially false about its own state** — and the protocol's resume procedure (§3) treats progress files as the durable state of record.
3. **A customer-visible cross-plan seam defect** on `ManualBookingForm.tsx` that no remaining plan owns: the "Send confirmation email to client" checkbox is honoured on the single-booking submit path and **silently ignored on the recurring path**.

All three are cheap to close. None requires a new plan. But this is the last checkpoint before completion, and shipping with them unrecorded would hand the Owner a programme whose final audit certified a tree it did not fully control.

---

## Working-tree discipline — the `F-1` recurrence, measured at both ends

Per checkpoint #3's recommendation #9, `git status --porcelain` was snapshotted at both ends of this session and compared **`-- src/`**, not whole-tree.

| | Checkpoint start (≈13:52) | Checkpoint end (14:12:58) |
|---|---|---|
| `git status --porcelain -- src/` | `M src/lib/maintenance.ts` — **and nothing else** | `M src/features/booking/components/AboutYouStep.tsx`<br>`M src/lib/maintenance.ts`<br>`?? src/features/booking/components/AboutYouStep.test.tsx` |
| whole-tree line count | 279 | 281 |
| HEAD | `102241f` | `102241f` (unmoved) |

The two new entries are **C-20 Phase C** — wiring `AddressAutocompleteField` into `AboutYouStep.tsx`, the **live public customer booking flow**. File mtimes: `AboutYouStep.tsx` **14:03:00**, `AboutYouStep.test.tsx` **14:05:24** (`ls --time-style=full-iso`). `git diff --stat` on the modified file: **+54 / −6**.

**The gate measurements in this report are clean — by timing, not by design.** All four completed before the first write landed:

| Gate | Started | Finished | vs. first write (14:03:00) |
|---|---|---|---|
| `npx tsc --noEmit` | ≈13:55 | ≈13:56 | before |
| `pnpm vitest run` (run 1) | **13:57:13** | 13:58:07 | before |
| `pnpm lint` (×2, incl. per-file identity) | ≈13:58 | ≈14:00 | before |
| `pnpm vitest run --reporter=dot` (run 2) | **13:59:23** | ≈14:00:20 | before |

Both vitest runs collected **208 test files** — identical — so the untracked `AboutYouStep.test.tsx` was not in either run. Checkpoint #2 recorded its own measurements as clean "by luck, not design"; that sentence applies verbatim, two checkpoints later.

**A second-order consequence worth naming:** the concurrent work is C-20 **Phase C**, which the C-20 progress file says has not started (finding 2). So the checkpoint could not have known from the record that a write-task was live — it found out by grepping a file and getting a result `git show HEAD:` could not reproduce.

---

## 1 — Token misuse creeping across files: **CLEAN, and the trend reversed**

Re-measured with one identical method across three tree-ishes (`git grep -l '\[oklch(' <rev> -- src/ | wc -l`, `git grep -o … | wc -l`):

| Tree | Files with `[oklch(` in `src/` | Occurrences |
|---|---|---|
| `7fe8b4f` (programme start) | 93 | 726 |
| `435472a` (checkpoint #3) | 98 | 679 |
| **`102241f` (HEAD)** | **98** | **677** |

**Delta since checkpoint #3: 0 files, −2 occurrences.** A `comm` on the sorted file lists confirms the *same* 98 files at both points — zero joined, zero cleaned. The −2 is a single incidental deletion (`src/app/admin/emails/page.tsx` lost a two-literal "BUILD pending" dev badge), not a retrofit.

**This closes checkpoint #3's recommendation #4 with a clear answer: the re-planting stopped.** Checkpoint #3 found eleven brand-new files planting the debt across four plans. In this range there are **57 new `src/` files**, every one scanned for `[oklch(`, `[#…]`, `rgb(`, `hsl(` and bare hex — **zero live colour literals**. The single hit is a comment documenting a WCAG contrast calculation (`src/components/consent/ConsentActionButton.tsx:16`), whose component correctly uses `--rahma-*` tokens.

**Checkpoint #2's `F-4` class did not repeat.** C-23's new admin files are token-clean throughout — `AvailabilityCalendarField.tsx` uses only `var(--admin-radius-card | --admin-border | --admin-panel | --admin-primary | --admin-status-confirmed-* | --admin-status-attention-* | --admin-text-muted)`, and its header comment states the reasoning (no admin precedent existed for a `disabled`+`modifiers` calendar, so markers were built from `--admin-*` directly rather than copying the public `DatePickerField.tsx`). Verified true.

**The dual-surface component — the highest-risk shape — is the best-engineered answer this programme has produced to the defect class.** `src/components/address/AddressAutocompleteField.tsx` is shared between a `--rahma-*` public form and an `--admin-*` admin form. It refuses to accept a colour: `listClassName` / `optionClassName` / `activeOptionClassName` are **required props with no defaults** (`:47-59` documents why — *"a host that forgets to theme the list fails to compile instead of silently shipping a bright-white box into a dark form"*). Compile-time enforcement, not convention.

**Cross-family contamination, both directions, whole range:** two hits, **both pre-programme and neither live**.
- `src/app/admin/components/admin-ui.tsx:37,59,81` — `--rahma-gold` in the `"gold"` `AdminTone` variant, introduced `82fe2fa` (2026-05-13). No caller passes `tone="gold"` anywhere in `src/`. Dead.
- `src/components/ui/accordion.tsx:37-81` — `rahma-*` classes, introduced `44d2dda` (2026-04-27). Its only four importers are public components. A folder-classification mismatch, not a rendering defect.

**Zero `--admin-*` in any public surface.** No new contamination anywhere in `7fe8b4f..102241f`.

**What did NOT improve:** the standing 98-file / 677-occurrence pile is untouched, including checkpoint #3's worst concrete offender. `src/components/ui/input.tsx` is **byte-identical to `435472a`**: `:40` `data-[error=true]:border-[oklch(26%_0.14_25)]`, `:116` the required asterisk, `:143` the error text — all three the same dark-red literal calibrated for a light background, rendering on the dark panel that every staff account gets by default. `badge.tsx` and `button.tsx` likewise unchanged. **Decision A was never answered and no Part 0 exception was added** (`git diff 435472a..HEAD -- BAND-C-MASTER-PLAN.md` contains no such rule).

## 2 — Copied deviations becoming patterns: **one new instance, one entrenched**

**New (minor, well-argued): duplicate-by-comment on the admin availability route.** `src/app/api/admin/availability/month/route.ts:31-51` carries a `datesOfMonth()` helper and a zod schema both duplicated from the live public month route, with an in-code justification (`:40-42` — declining to edit a customer-facing file to export eight lines of date arithmetic). The judgement is defensible and C-23's gate 5 confirmed behavioural equivalence over six sampled dates. **But note the discipline slip:** the programme's seventh instance of "two things that should be one thing" (`visibleBookingViews` vs `BookingsChrome`'s chip arrays) was **pinned by a test** (`booking-view-counts.test.ts:257-267`, still passing, still holding). This eighth instance is pinned only by a comment saying *"Mirrors … exactly"*. `route.test.ts` (218 lines) contains no parity assertion against the public route. If the public schema changes, nothing fails.

**Entrenched, and now structural: the bundle-budget gate.** Checkpoint #3 corrected the miss count from "three or four" to **nine**. It is now **twelve** — C-16 (*"tenth plan hit by the same tooling gap"*), C-17 (*"NOT RUN"*), C-23 (*"NOT RUN"*) all added themselves, and C-18 measured a **breach** (≈5.19 kB against a +5 kB ceiling, self-described as likely ≈6.7 kB) using a ratio-derived approximation against **no baseline anywhere in the programme**, then ratified it. Only C-06 and C-11 ever ran the gate successfully. The backlog says the fix "needs an Owner decision, not an implementer's judgement"; that decision was never made, and the gate is now **structurally un-runnable** because builds are banned for agents this session. Every plan recorded it honestly as NOT RUN — the reporting stayed sound, exactly as checkpoint #3 found. The pattern is that a gate nobody can run has quietly become optional.

**What did NOT become a pattern — worth recording as a positive:** C-15's `providedOverrides` seam is still unwired (`git grep providedOverrides -- src/` returns hits only inside `templates.ts`; zero call sites pass it), and **no plan copied the double-fetch shape**. Checkpoint #2's prediction that C-13/C-02 would copy it was already refuted at #3; five more plans have now passed without doing so.

## 3 — Baseline erosion: **NONE, across all 20 plans**

**Vitest identity.** Programme start was six failures; HEAD is five — a strict **subset**, so there is no room for a swap. All 20 progress files were read for their recorded identity list; every one names the same tests **by full title**, not by count. The single removal (`createBookingTransaction`) was pre-announced as expected shrinkage before it happened (`C-21-…progress.md:127`, `C-22-…progress.md:223`) and confirmed on delivery (`C-06-…progress.md:196`), then re-confirmed at C-11 and C-07. Two transient sixth failures appeared mid-plan (C-02 §415, C-03 §89), both diagnosed, both reverted to the exact three names before any closeout gate. **No identity was ever added or removed silently.**

`git diff --stat 2ad93d0..102241f -- '*.test.ts' '*.test.tsx'` is **empty** — HEAD is pure bookkeeping on top of C-23's last code commit, so C-23's recorded `5 failed / 2044 passed (2049)` is byte-for-byte this checkpoint's independent measurement.

**Lint identity.** Same six files, same 59E/7W, every plan. Per-file breakdown re-derived here (see gates table). One of the six *tracked* files was edited in range — `BookingExperience.tsx`, by C-18 Phase C (`9689213`) — and C-18 disclosed the non-event explicitly (`:190`: *"delta zero (same three rule ids, line numbers shifted only by the inserted block)"*).

**The untracked-baseline fragility is unchanged and is now load-bearing for handover.** `git ls-files design_handoff_area_pages/` returns **0 files**; the directory is untracked and *not* gitignored. It supplies **55 of 59 errors and 6 of 7 warnings**. On a fresh clone — which is precisely what the Owner's stated end-of-programme GitHub push produces — the gate identity every plan has been judged against becomes **4E/1W in three files**, not 59E/7W in six. No plan's gate *decision* rested on those files (all 59 are pre-existing and none is in any plan's scope), so this is not erosion; it is a handover hazard that should be stated once in the final report.

**Suppression honesty — no repeat of `F-5`, but a disclosure regression.** `git grep -c eslint-disable -- 'src/*'` summed per tree: `7fe8b4f` **45 in 25 files** → `435472a` **37 in 24** → HEAD **40 in 26**. The first two reproduce checkpoint #2/#3's recorded figures exactly. **The entire +3 is C-23**: `AvailabilityCalendarField.tsx:139` (`no-unused-vars`), `use-month-availability.ts:117` (`exhaustive-deps`), and `ManualBookingForm.tsx` 6→7 (`set-state-in-effect`). C-16/C-17/C-18/C-19/C-20 added **zero**. No plan in this range makes any suppression-count claim, so there is no false number to catch — but that is the point: **C-15 itemised and individually justified each site (and was caught understating); C-23 added three and mentions none of them anywhere in its progress file.** The count is honest by silence rather than by disclosure.

**Final-gate-table rule (checkpoint #3's mandate): 5/5 shipped plans comply.** C-16 (§10, `:198-208`), C-17 (§5, `:92-100`), C-18 (§5.2/5.3, `:303-336`), C-19 (§4.3, `:120-127`), C-23 (§3.4a + §4.1, `:250-262`, `:316-320`) each carry a full tsc/lint/vitest/build table with every NOT-RUN item disclosed. The pass-count drift that made this rule necessary is fully reconciled: `git diff --numstat ab80687..HEAD -- '*.test.*'` accounts for every added test by named commit.

**Test-suite integrity.** Zero `.skip`/`.todo`/`xit`/`xdescribe` in `src/` at HEAD. `git diff 7fe8b4f..102241f -- e2e/` **empty**. Zero test files deleted in `435472a..102241f`. The three failing `ManualBookingForm.test.tsx` bodies (lines 37–83) are **byte-identical** between `435472a` and HEAD — confirmed by snippet diff, not by name grep.

**Part 0 conventions, re-run at HEAD:** zero `border-l-4` repo-wide; zero `revalidateTag(` in `src/`; **JSON-safety held across a 27 → 38 expansion of `unstable_cache` call sites**. The eleven new wraps land in five files (`password-requests-data.ts` +2, `clients-list-data.ts` +5, `privacy-data.ts` +2, `bookings-list-data.ts` +1, `services-data.ts` +1); every `Set`/`Map` was read in context and is a local intermediate consumed via `Array.from(new Set(…))` / `.has()` / `.get()` inside the closure, and the one `new Date()` (`clients-list-data.ts:422`) is `.toISOString().slice(0,10)`'d to a string before it goes anywhere. Three of the five files carry explicit in-file JSON-boundary header comments. Zero violations.

## 4 — Sonnet ↔ Opus idiom divergence: **§2.6's fourth clause is now moot, and the Owner should be told so**

Checkpoint #3's recommendation #2 asked for the `F-A` reconciliation to be re-run over `435472a..HEAD` first, and #3 said: *"If reading (i) is confirmed, §2.6's fourth clause is **moot** and the Owner should be told so rather than having a checkpoint pretend to check it."*

**Trailer tally, `435472a..102241f` (82 commits): Opus 5 ×46 · Fable 5 ×1 · no trailer ×35 · Sonnet 5 ×0.**
**Whole programme `7fe8b4f..102241f` (336 commits): Opus 5 ×234 · Sonnet 5 ×30 · Fable 5 ×13 · Opus 4.7 ×1 · no trailer ×58.** This reconciles exactly with checkpoint #3's `7fe8b4f..435472a` figures plus this range's deltas.

**Every one of the programme's 30 Sonnet trailers predates `435472a`. Not one has appeared since.** The condition checkpoint #3 set for declaring the clause moot is met.

**`F-A` was never resolved.** Its "cheapest durable fix" was to make SUBAGENT-RULES rule 12's model return unconditional. `git log -- SUBAGENT-RULES.md` shows **exactly one commit** (`6b1628b`, pre-checkpoint-#3) and rule 12 still reads *"the model you ran as, **if known**"*. `git diff --stat 435472a..HEAD -- C-C-EXECUTION-PROTOCOL.md SUBAGENT-RULES.md` is **empty**. The recommendation was flagged "blocking on the Owner before plan #16 starts"; five plans have shipped since.

**Progress-file routing records — the audit checkpoint #3 asked for, run from progress files rather than git:**

| Plan | §5 says | Progress file records | Trailers agree? |
|---|---|---|---|
| C-16 | sonnet | plan-level sonnet; **Phase C Steps 5–7 opus, justified** (`:111`, `:133`). **No model line at all for Phases D or E** | ✗ — `dc26dc0`, `66e9391`, `e822e12`, `f27a9da` all carry Opus trailers with no logged justification |
| C-17 | sonnet | *"all dispatches `sonnet`"* (`:22`) | ✓ — all four commits trailer-less |
| C-18 | sonnet | Phases B, D + Phase 0 opus; A/E/F/fix-round sonnet (`:23`, `:290-297`) | ✗ — 5 of 6 fix-round commits, both Phase E commits and Phase F's commit carry Opus trailers; unacknowledged |
| C-19 | sonnet | *"all `model: sonnet`… no `opus` dispatch"* (`:95`) | ✓ — both commits trailer-less |
| C-20 | sonnet | A/B sonnet, C/D opus with justifications (`:98-104`) | ✓ for shipped phases — all four trailer-less |
| C-23 | **opus** | per phase, with §5 justifications (`:113-121`, `:132`, `:200`) | ✓ except Phase C, **which the file itself flags** (`:181`) |

**C-23 is the compliance model** — tiers and models declared *in advance* (§0.4), a one-line opus justification per dispatch, and the one anomaly surfaced in-document rather than buried: *"the dispatch pinned `model: sonnet` per §5, but the agent self-reported running as Opus 5… recorded as an unverified self-report rather than a confirmed routing breach."* The trailer agrees with the self-report.

**C-16 and C-18 are the gap.** Phases recorded `sonnet` carry Opus trailers with no acknowledgement anywhere. Under the orchestrator's refutation ("the trailer names the orchestrating session, not the subagent") that would mean the **orchestrator committed the implementers' work**, contra §2.2 and SUBAGENT-RULES rule 11 — `F-A`'s reading (ii). Under the alternative it means routing was not honoured — reading (i). **The evidence still cannot distinguish them, which is exactly `F-A`'s point.** What is new is that C-17/C-19/C-20 are *internally consistent* (declared sonnet, zero Opus trailers) in the same range and the same session, which weakens — without refuting — the "trailer = session constant" reading.

**Code-level comparison: not attempted at scale, deliberately.** Checkpoint #3 established the null result on 28,656 added lines across nine plans and two models. Re-deriving it on an effectively all-Opus corpus would measure nothing. The one matched pair available — C-23's closeout seam `2ad93d0` (recorded sonnet, no trailer) against `d701d9a`/`d142897` (recorded opus, trailered), all three editing `ManualBookingForm.tsx` for the same feature — is **indistinguishable**: the same discursive header-comment convention (state the risk, state why the approach avoids it, cite the brief by section), the same test idiom (long descriptive `it()` names, a preamble comment framing the regression each guards, shared `stubFetch`/`seedStep3Draft`/`dayButton` helpers). The apparent gap between C-16's opus Phase C and sonnet Phase B tracks task complexity, not model — and C-16's sonnet Phase B tests are terser than C-23's sonnet seam tests, so the variance is per-dispatch, not per-model.

**Answer to the remit's question — "can you tell which is which from the code?" — No.** Not from the code, and no longer from git either. **Recommendation: tell the Owner §2.6's Sonnet/Opus clause is spent, and stop paying a checkpoint to check it.**

## 5 — Honesty of the record: **seven strong claims spot-checked; six hold, one is false, and two supporting figures are stale**

| # | Claim | Check | Result |
|---|---|---|---|
| 1 | C-23 §0.2a: *"⛔ ZERO EMAILS SENT… `SELECT count(*) FROM email_delivery_events WHERE created_at > '2026-08-09 10:55:00+00'` → 0"* | Re-run live (SELECT-only) | ✅ **0** |
| 2 | C-23 §0.2a: three baseline bookings, dates/times/`override`, all clients `*.example.test` | Live join `bookings`→`clients` on the three ids | ✅ exact — `2026-08-10 10:00` / `2026-08-11 14:30` / `2026-08-12 11:00`, all `pending`, all `…@example.test` |
| 3 | C-23 §3.4c: closeout seam is *"29 insertions, 0 deletions — a pure addition"* | `git show --numstat 2ad93d0` | ✅ `ManualBookingForm.tsx` **+29 / −0** |
| 4 | C-23 §3.4c: *"all three branches now have 375 + 1280 evidence"* | `ls` + `git ls-files redesign/evidence/C-23/` | ✅ six `phase-d-branch{1,2,3}-*-{375,1280}-AFTER.png`, all tracked |
| 5 | C-17: gtag must be **absent** from `/booking/manage`, enforced by a recursive guard test | `git grep GoogleAnalytics -- src/app/booking` | ✅ only the guard test itself; `git show HEAD:src/app/booking/layout.tsx` → does not exist |
| 6 | C-23 §3.1: branch 3's handler is untouched, `setBookingDate(e.target.value)` only | Read `ManualBookingForm.tsx:1932` | ✅ verbatim |
| 7 | **C-20 §1/§2: *"Phase A ▶ In flight… Phases B–E not started"*** | `git log` | ❌ **FALSE — see finding 2** |

**Two stale supporting figures, both in `OWNER-ACTION-BACKLOG.md`:**

- **The `consent_events` prune list is short by one row and one `consent_id`.** The row states *"6 rows"* and names four `consent_id`s. Live: **7 rows across 5 distinct `consent_id`s**, all `banner_version = 2026-07-16.1`. The four named ids account for exactly 6 rows (1+2+2+1) — correct as written on 2026-08-04. A **fifth**, `30c34cae-edb9-4d48-8b4d-ee394d595aad` (1 row), was created **2026-08-09 09:05:45+00**, during this session's work, and was never added. The Owner working from that list would prune six and leave one orphan test row in a GDPR-facing consent-proof table. *(By contrast, C-23's booking fixture list **is** complete: exactly 3 bookings and 3 clients were created on 2026-08-09, matching its cleanup list with no extras.)*
- **The post-deploy runbook is stale by five plans.** `redesign/evidence/checkpoint-3/post-deploy-runbook.md` was last touched by `74ed6ed` — the checkpoint #3 commit — and still reads *"Total: 13 post-deploy checks, across 5 plans."* `grep -E "C-1[6-9]|C-20|C-23|GA_MEASUREMENT|Sentry|Maps"` over it returns **nothing**, yet C-17 (the Cloudflare **build** env var + three live GA Realtime checks), C-18 (three Sentry-console items), C-20 (build env var + two Maps cost checks) and C-16 (the `bookings` indexes) all added post-deploy-only items — to their own progress files and to the backlog, but not to the consolidated list. **This is precisely the failure mode checkpoint #3's recommendation #6 predicted:** *"a plan adding an item to its own progress file and nowhere else."* Half-mitigated — nothing is lost, it is all in the backlog — but there are now two lists again, which is the state consolidating was meant to end.

**One stale in-code comment**, trivial but the same class: `src/app/admin/bookings/new/AvailabilityCalendarField.tsx:6-7` still says wiring into `ManualBookingForm`'s branches *"is Phase D (out of scope here)"*. Phase D shipped; the component is wired at `ManualBookingForm.tsx:1735` and `:1797`.

**The record is, on the whole, unusually good.** C-23's progress file is the strongest artefact the programme has produced — it records a plan-vs-brief conflict resolved in the brief's favour with reasoning, an orchestrator miss named as an orchestrator miss (§3.3: *"a led verification only ever finds what it is pointed at"*), a possible routing breach it had every incentive to omit, and a Zone-2 email risk it closed by reading the actual gate at `actions.ts:1689` rather than asserting safety. Finding 2 is a lapse against that standard, not the standard itself.

## 6 — Un-actioned prior findings

**Checkpoint #3's nine recommendations for this checkpoint:**

| # | Recommendation | Status |
|---|---|---|
| 1 | Resolve `F-A`; make SUBAGENT-RULES rule 12's model return unconditional | ❌ **not actioned** — one commit ever on that file, wording unchanged; no protocol diff in range |
| 2 | Re-run the `F-A` reconciliation over `435472a..HEAD` | ✅ done — §4; reading (i) confirmed in the trailers |
| 3 | Don't re-run the idiom comparison unless Sonnet code reappears | ✅ honoured — one matched pair only, null result, clause declared moot |
| 4 | Re-measure `[oklch(` | ✅ done — **98 / 677**, flat. Re-planting stopped |
| 5 | Re-check D1/D2 for an owner; check the runbook for drift | ⚠️ partial — D1/D2 unchanged (below); **runbook has drifted** (§5) |
| 6 | Verify the post-deploy runbook is still complete | ❌ **it is not** — §5 |
| 7 | Confirm the five permanent test failures got a backlog row | ❌ **not actioned** — no such row exists in `OWNER-ACTION-BACKLOG.md` |
| 8 | Watch `notifications.ts` for an unowned edit | ✅ **zero edits** — 1467 lines at `435472a` and at HEAD; `git log 435472a..HEAD --` empty. Checkpoint #2's and #3's pressure predictions were both over-stated; the file went untouched for five plans |
| 9 | Snapshot `git status --porcelain -- src/` at both ends | ✅ done — **and it caught the `F-1` recurrence** |

**Owner Decisions A and B are both still open, and neither has moved.** No answer is recorded anywhere (`git log --grep=DECISION` in range is empty; the only files mentioning them are the checkpoint-3 artefacts and the backlog rows).
- **Decision A** (colour debt): no Part 0 exception added; `input.tsx` byte-identical.
- **Decision B** (preset divergence): re-verified live and **the hole is exactly as checkpoint #3 described**. `buildPresets()` still emits `yesterday` and `last_30` (`dashboard-filters-client.tsx:41,65,68`); `getRangeDefaults()` (`reports/reporting.ts:963-1008`) still handles `lifetime, year, today, tomorrow, week, this_week, this_month, custom, quarter` and **neither of the two**. A bookmarked `?range=yesterday` on `/admin/me`, `/admin/staff/[id]/performance` or `/admin/reports` still silently returns month-to-+30-business-days.

**D1 / D2 unchanged.** `MISSING_COLUMN_CODES` + `hasErrorCode` still byte-identical at `bookings/actions.ts:84` and `clients/actions.ts:455`, still doubly dead. Checkpoint #3 established C-14 does not need the shape either, so the assignment has failed. **Recommendation: record both shims as permanently dead in the final report rather than carrying the row into a programme that has no checkpoints left.** D2's three today-in-London helpers likewise unreconciled and unworsened.

**Checkpoint #2's open backlog rows were spot-checked for silent fixes or silent staleness — none found.** `F-6` (`providedOverrides` unwired on five templates) still open, verified by grep; `F-3` (no status guard in `dispatchResend`) still open; `F-8` (`review_email_sent_at` stamped regardless of send status) still open at `notifications.ts:1431`. All three are honestly recorded as open. No row has quietly become false.

## 7 — Cross-plan seams: **one blocking defect, one non-blocking; four seams clean**

| Surface | Plans (chronological) | Lines start → HEAD | Verdict |
|---|---|---|---|
| `ManualBookingForm.tsx` | C-06 ×4, C-02, C-03 ×3, C-07, C-23 ×3 — **C-20: zero commits** | 2019 → 2362 | **defects — see below** |
| `notifications.ts` | C-06, C-04a, C-01, C-08, C-15, C-13, C-02 — all pre-`435472a` | 539 → 1467, **1467 → 1467 in range** | untouched; N/A |
| `wrangler.jsonc` / `worker-entrypoint.ts` | C-22, C-04a, C-01, C-02 | 41 → 73 | **COHERENT** |
| `admin/bookings/page.tsx` + list | C-04a, C-05, C-FIELDWORK, C-13, C-02, C-09, C-07, C-16 | 967 → 656 (C-13 extraction) | **COHERENT** |
| `templates-data.ts` | C-01, C-08 ×5, C-15 ×2, C-13, C-02 ×2 — all pre-`435472a` | 168 → 904 | **COHERENT** |

**Clean seams, checked not assumed.** The step machine is coherent across all five plans — one `STEPS` array (`:131-136`), one `validateStep` (`:202-244`), one `handleContinue`/`handleBack` pair (`:1040-1061`); no plan introduced a second step counter. Cron: `wrangler.jsonc:71` declares exactly `["0 8 * * *", "* * * * *", "*/15 * * * *", "0 3 * * *"]`, `worker-entrypoint.ts:221-238` has exactly four matching `case`s, and all four consumer routes exist — no orphan trigger, no orphan handler. The chip-count pin still holds: `visibleBookingViews(true)` (`bookings-list-data.ts:916-931`) equals `[...FULL_PRIMARY, ...FULL_OVERFLOW]` (`BookingsChrome.tsx:45,50-58`) **element-for-element in the same order**, with the same for the therapist arrays, asserted by `booking-view-counts.test.ts:257-267` and untouched since C-16 introduced it. `templates-data.ts`'s 18 ids round-trip exactly against `sample-data.ts:158-234` and every literal `templateId` in `templates.ts`, and `fieldDefault()` **throws** on a missing id (`templates.ts:125-133`) rather than rendering wrong copy.

**Correction to the dispatch's premise, worth recording:** the protocol's shared-surface note lists C-20 as an editor of `ManualBookingForm.tsx`. **It is not, and has not been** — C-20's four commits touch only `src/lib/address/parse-place.ts` and `src/components/address/AddressAutocompleteField.tsx`; the admin form still uses a plain `useState` string for address (`:589`, `:1664-1672`). So the C-20 × C-23 interaction the remit asked about **does not exist yet**; C-20 Phase D is where it would arise. The live wiring is into the *public* `AboutYouStep.tsx`, and it is the uncommitted in-flight edit of finding 1.

**The two real defects are both C-02 × the rest of step 4** — a plan that shipped seven plans ago, whose additions are individually correct and whose seam with the surrounding form was never re-examined:

- **BLOCKING (finding 3):** the "Send confirmation email to client" checkbox. Rendered unconditionally on step 4 (`ManualBookingForm.tsx:2158-2167`, hidden mirror at `:1173`), honoured by the single-booking path (`actions.ts:1689` — `if (parsed.data.sendConfirmationEmail && parsed.data.details.email.trim())`), and **absent from `recurringSchema` entirely** (`recurring-actions.ts:26-58`). `createRecurringSeries` calls `sendRecurringSeriesCreatedEmail(...)` **unconditionally** at `:197`. One control, two submit paths, opposite behaviour, no visual difference.
- **NON-BLOCKING (finding 5):** availability disclosure. `RecurringSection` receives `firstOccurrenceDate={bookingDate}` (`:2183-2184`), so C-23's new calendar does inform the **first** occurrence — but occurrences 2..N are deliberately unchecked at the RPC (`20260802122636_c02_recurring_bookings.sql:175-179`: *"No availability / capacity check… a series spans 12 weeks of rotas that do not exist yet"*). The step-4 "Unassigned note" banner renders **regardless of `isRecurring`** (`:2192-2201`) in singular language — *"this booking will be unassigned until a therapist accepts it"* — and `RecurringSection.tsx:293-296` says nothing about availability. C-23 made the availability signal visible at step 3 without anything saying it applies to one visit out of twelve.

**A forward-looking seam, correctly recorded and not yet tripped: C-18 × C-20.** `AddressAutocompleteField` loads the Google Maps JS API from inside `runFetch()` (`:307`), i.e. **on the first keystroke, not on mount** — so no third-party request fires on page load and C-18's "zero pre-consent Google requests" regulator test is not broken today. But typing in the address field on the public form *will* call Google, and `src/lib/consent/cookie-registry.ts` has **no Google Maps entry** (its six entries are `rahma_consent`, the booking draft, `rahma-booking-contact-v1`, `_ga/_ga_*`, `maintenance-modal-seen`, `sentryReplaySession`). C-20's own progress file records this correctly as an open ⏸ (§0.4 item 2: registry entry + `CONSENT_BANNER_VERSION` bump + a functional-on-interaction vs consent-gated classification the Owner must make). **The code that will make this live is committed and being wired into the public form right now** (finding 1), so the classification decision has become time-critical rather than theoretical.

---

## Gates — BY IDENTITY, re-run independently at HEAD `102241f`

All four completed **before** the in-flight write at 14:03:00 (see the working-tree section).

| Gate | Result | Identity verdict |
|---|---|---|
| `npx tsc --noEmit` | **0 errors** (no output) | ✅ MATCH |
| `pnpm vitest run` | **5 failed / 2044 passed (2049)** · 2 files failed / 206 passed (208) | ✅ **MATCH — by name** |
| ↳ `src/lib/auth/admin-access.test.ts` | *"gives Owner broad access while keeping owner-only role actions permission-gated"* · *"gives Admin broad operational access without role template management"* | ×2, inherited |
| ↳ `src/app/admin/bookings/new/ManualBookingForm.test.tsx` | *"renders step 1 on first load"* · *"moves focus to the first invalid field when continuing with errors"* · *"shows the consent error when trying to create booking without consent"* | ×3, inherited |
| `pnpm lint` | **59 errors / 7 warnings** in exactly six files | ✅ MATCH |
| ↳ `design_handoff_area_pages/prototype/area-page.jsx` | 48E / 1W | untracked |
| ↳ `design_handoff_area_pages/prototype/site-chrome.jsx` | 5E / 0W | untracked |
| ↳ `design_handoff_area_pages/prototype/shared.jsx` | 2E / 5W | untracked |
| ↳ `src/features/booking/BookingExperience.tsx` | 3E / 0W | tracked |
| ↳ `src/features/booking/BookingExperienceLoader.tsx` | 1E / 0W | tracked |
| ↳ `src/features/booking/utils/returning-customer.ts` | 0E / 1W | tracked |
| `pnpm build` | **NOT RUN — banned for agents this session** | orchestrator runs one, last |
| `node scripts/measure-admin-bundles.mjs` | **NOT RUN** — depends on a build; twelfth plan-cycle affected | see §2 |

Vitest was run twice (default reporter, then `--reporter=dot`) to recover the full failure list; both runs collected **208 test files** and produced identical totals.

## `src/lib/maintenance.ts` — exact state

| Check | Result |
|---|---|
| Working copy | `export const MAINTENANCE_MODE = false;` |
| `git show HEAD:src/lib/maintenance.ts` | `export const MAINTENANCE_MODE = true;` |
| `git log --oneline -- src/lib/maintenance.ts` | **`35bf817`, and only `35bf817`** — *"feat(maintenance): add site-under-construction banner, popup, and booking block"* |
| Is `35bf817` pre-programme? | ✅ `git merge-base --is-ancestor 35bf817 7fe8b4f` → exit 0 |
| Ever staged? | **No.** `git diff --cached --name-only -- src/lib/maintenance.ts` → empty; `git status --porcelain` → ` M` (unstaged) at both ends of this session |
| File mtime | 2026-08-03 09:55:00 — untouched by this session |

**Exactly as protocol §3b requires.** Never staged, never committed at any point in the 336-commit programme. The file was not read into any edit path, opened for write, or reverted by this checkpoint. **For the final programme report:** the *committed* value is already `true`, so the risk is not "remember to flip it back" — it is **"never let the working copy's uncommitted `false` be swept into a commit"** before the push that triggers the deploy.

---

## Findings

### BLOCKING

**1 — `F-1` has recurred: a write-task is mutating the shared tree during this checkpoint.**
At checkpoint start `git status --porcelain -- src/` was `M src/lib/maintenance.ts` alone; at end it is that plus ` M src/features/booking/components/AboutYouStep.tsx` (+54/−6) and `?? src/features/booking/components/AboutYouStep.test.tsx`, mtimes **14:03:00** and **14:05:24**. HEAD unmoved at `102241f`. The work is **C-20 Phase C — the live public customer booking flow**. Checkpoint #2 rated `F-1` BLOCKING and its correction was explicitly **adopted**: *"drift checkpoints complete before the next plan's implementation begins. Read-only prep may still run in parallel; writes may not."* This is a direct recurrence of an adopted correction, and it is the second time this checkpoint's gate numbers have been saved by timing rather than by control. **Recommended owner: the orchestrator, no plan.** Freeze C-20 Phase C until this report is filed, then resume; and — since this is the last checkpoint — record in the final programme report that two of four drift checkpoints ran against a moving tree.

**2 — C-20's progress file and its master-plan row are materially false about C-20's own state.**
`C-20-address-autocomplete-progress.md:122` reads *"Phase A ▶ **In flight** at time of writing"* and `:130` *"Phase A in flight. Phases B–E not started. Both ⏸ items in §0.4 open."* Git: Phase A shipped (`92f031d`, fix `cc32657`) **and** Phase B shipped (`ac0a283`, fix `af2c5b1`), both ancestors of HEAD, with real independent evidence on disk (`redesign/evidence/C-20/phase-a-verify.md` PASS; `phase-b-verify-full.md` **FAIL, 2 BLOCKING**; `phase-b-fix-reverify.md` PASS — a legitimate FAIL→fix→PASS cycle, and the two Phase-B evidence files are **untracked**). The file's own §0.4 records the key-rotation ⏸ as *"✅ ANSWERED"*, contradicting §2 two sections later — the same self-contradiction shape checkpoint #2's `F-5` caught in C-15. `BAND-C-MASTER-PLAN.md:467` still shows C-20 as `⏳ (brief + plan ✅)` with Started/Shipped/Commit all `—`. The last progress edit (`e847a74`, 11:34:42) landed **after** Phase B's first commit (11:31:27) and left the false text in place; Phase B's fix (12:03:29) is unrecorded entirely.
**Why blocking rather than tidy-up:** protocol §2.7 makes progress files the durable state (*"Durable state lives in git + progress files, never in conversational memory"*) and §3's resume procedure says to *"continue from the recorded step"*. A session resuming on this file would re-dispatch Phase A onto work that is already verified and shipped. **Recommended owner: the orchestrator, before any resume or handover** — write the Phase A and Phase B records including the FAIL→fix→PASS cycle, commit the two evidence files, correct §2, and update the checklist row to reflect two shipped phases.

**3 — The "Send confirmation email to client" checkbox is silently ignored on the recurring submit path.**
`ManualBookingForm.tsx:2158-2167` renders one checkbox on step 4, unconditional on `isRecurring`. `createManualBooking` honours it (`src/app/admin/bookings/actions.ts:1689`). `recurringSchema` (`src/app/admin/bookings/recurring-actions.ts:26-58`) has **no** `send_confirmation_email` field and `createRecurringSeries` fires `sendRecurringSeriesCreatedEmail(...)` **unconditionally** at `:197`. An operator who unticks the box and creates a repeat series sends the client an email anyway — the control asserts something untrue about what the submit will do, which is this programme's named defect class.
**Latent, not live** — zero recurring series exist today — but it ships on the deploy, and it **undermines a safety procedure the programme actively relies on**: C-23's Zone-2 baseline capture was made safe precisely by unticking this box (C-23 progress §0.2a, §3 — *"Capturing the three baseline bookings with the toggle off therefore sends nothing at all"*). That reasoning is correct **for `createManualBooking` only**, and the progress file scopes it correctly — but the backlog asks the Owner to create four real recurring series through this same form, and anyone generalising "untick the box = no email" would be wrong. **No remaining plan owns it:** C-14 is the availability engine, C-10 is admin layout polish. **Recommended owner: an Owner-approved fix round, ~4 lines** — add `send_confirmation_email` to `recurringSchema` and gate the `:197` send on it, matching `actions.ts:1689`'s posture. Do **not** "fix" it by hiding the checkbox in recurring mode: that removes a control the operator should have.

### NON-BLOCKING

**4 — The post-deploy runbook is stale by five plans; there are two lists again.** `redesign/evidence/checkpoint-3/post-deploy-runbook.md` last touched by `74ed6ed` (the checkpoint #3 commit), still says *"13 post-deploy checks, across 5 plans"*, and contains no reference to C-16/C-17/C-18/C-19/C-20/C-23 — all of which added post-deploy-only items to their progress files and to `OWNER-ACTION-BACKLOG.md` instead. Nothing is lost; the consolidation is. **Recommended owner: the orchestrator, at final-report time** — append the C-16 index item, C-17's build env var + three GA Realtime checks, C-18's three Sentry-console items, and C-20's build env var + two Maps cost checks, and re-state the total.

**5 — Availability disclosure on recurring submissions.** C-23's calendar informs the first occurrence only; occurrences 2..N are deliberately unchecked (`20260802122636_c02_recurring_bookings.sql:175-179`), and the step-4 banner (`ManualBookingForm.tsx:2192-2201`) renders regardless of `isRecurring` in singular language. **Recommended owner: fold into finding 3's fix round** — one conditional sentence in the banner when `isRecurring` is true. If finding 3 is not fixed, leave this; it is copy, and the underlying behaviour is correct and documented.

**6 — The `consent_events` prune list is short by one row.** Backlog says 6 rows / four `consent_id`s; live is **7 rows / 5 ids**, the extra being `30c34cae-edb9-4d48-8b4d-ee394d595aad` (2026-08-09 09:05:45+00). GDPR-facing table. **Recommended owner: the orchestrator** — add the fifth id to the backlog row before handover. No code change.

**7 — Checkpoint #3's recommendations 1, 6 and 7 were never actioned.** (1) SUBAGENT-RULES rule 12's model return is still conditional (*"if known"*) and no protocol file changed in range, despite being flagged "blocking on the Owner before plan #16". (6) see finding 4. (7) `OWNER-ACTION-BACKLOG.md` still has **no row** recording that five tests fail permanently by design, with their names and `C-20-address-autocomplete-plan.md:173` as the decision. There are no checkpoints left to carry these forward. **Recommended owner: the orchestrator, at final-report time.** Item (7) in particular is a handover artefact — the Owner will otherwise receive a suite with five unexplained failures.

**8 — Owner Decisions A and B remain open and unmoved, with no answer recorded anywhere.** Decision B's hole is re-verified live at HEAD: `buildPresets()` emits `yesterday`/`last_30` (`dashboard-filters-client.tsx:41,65,68`); `getRangeDefaults()` (`src/app/admin/reports/reporting.ts:963-1008`) handles neither. Decision A: `input.tsx` is byte-identical to `435472a` and no Part 0 exception was added. **Recommended owner: the Owner.** Both were correctly framed as Owner calls; the finding is only that neither was re-raised in five plans and this is the last checkpoint that will ask.

**9 — The lint baseline is not reproducible from a fresh clone, and that matters now.** `git ls-files design_handoff_area_pages/` → **0 files**; untracked, not gitignored; supplies **55/59 errors and 6/7 warnings**. After the Owner's stated end-of-programme GitHub push, the identity becomes **4E/1W in three tracked files**. Not erosion — no plan's decision rested on it — but the final report should state the post-clone identity so the first fresh-clone lint run is not read as a regression. **Recommended owner: the orchestrator, at final-report time.**

**10 — Suppression disclosure regressed.** `src/` suppressions went 45 (25 files) → 37 (24) → **40 (26)**; the entire +3 is C-23 (`AvailabilityCalendarField.tsx:139`, `use-month-availability.ts:117`, `ManualBookingForm.tsx` 6→7). All three are ordinary and defensible. **But C-23's progress file mentions none of them**, where C-15 itemised and argued each site. No false claim was made — but the metric the checkpoints use is now maintained by silence. **Recommended owner: none.** Recorded so the final report's number is right.

**11 — D1 and D2 will end the programme unclaimed.** `MISSING_COLUMN_CODES`/`hasErrorCode` still byte-identical at `bookings/actions.ts:84` and `clients/actions.ts:455`, still doubly dead; checkpoint #3 established C-14 does not need the shape. **Recommended owner: none — record them as permanently dead in the final report** rather than carrying an assignment that has now failed four times.

**12 — Two small record-vs-reality drifts.** `AvailabilityCalendarField.tsx:6-7` still says wiring *"is Phase D (out of scope here)"* though Phase D shipped and the component is used at `ManualBookingForm.tsx:1735,1797`. And the admin month route's duplicated `datesOfMonth`/zod schema (`src/app/api/admin/availability/month/route.ts:31-51`) is pinned to its public sibling by a comment saying *"Mirrors … exactly"* with **no parity test** — the programme's seventh duplicate instance got a test pin, this eighth one did not. **Recommended owner: none; log only.**

### Explicitly NOT findings — checked and clean

Zero `border-l-4`; zero `revalidateTag(`; JSON-safety across all 38 `unstable_cache` sites including the 11 new ones; zero new colour literals in 57 new files; zero token cross-contamination introduced in range; zero `.skip`/`.todo`/`xit`/`xdescribe` in `src/`; `e2e/` byte-unchanged across 336 commits; no test file deleted; the three failing `ManualBookingForm` bodies byte-identical to `435472a`; no baseline identity ever added or removed silently in 20 plans; all four cron triggers matched to live consumers; the bookings chip/pager/predicate pin still exact; `templates-data.ts`'s 18 ids round-tripping both ways; `notifications.ts` untouched for five consecutive plans; and `maintenance.ts` never staged in 336 commits.

---

## Checks I could not run

- **`pnpm build` and the bundle-budget gate** — builds are banned for agents this session (the orchestrator runs one, last). This is the twelfth plan-cycle in which the bundle gate could not run; see §2.
- **Anything behind an authenticated session** — no agent may enter credentials. Every Playwright role×viewport sweep in `OWNER-ACTION-BACKLOG.md` remains Owner-performed by necessity, including C-23's §3.9 branch screenshots at other roles, C-16's multi-page proof, and all of C-10 Phase A.
- **Live confirmation of finding 3** — proving the recurring path sends despite the unticked box would mean creating a real recurring series (Zone-2, and it sends a real email). The finding is established by reading `recurringSchema` (`recurring-actions.ts:26-58`) and the unconditional send at `:197` against `actions.ts:1689`. **Not verified at runtime.**
- **Re-running the gates after the in-flight C-20 Phase C write** — deliberately not attempted. The tree is moving; a second measurement would describe a state that is neither HEAD nor a plan's closeout. The gates reported here are pinned to their timestamps and to HEAD `102241f` plus the standing `maintenance.ts` change only.
- **Whether C-16's and C-18's Opus-trailered commits were opus dispatches or orchestrator commits** — undecidable from inside the repo, which is `F-A`'s standing point. Only the Owner can settle it.
- **The user-visible size of the `oklch` debt** — grep cannot distinguish a literal with a dark sibling from one without. Checkpoint #3 raised this caveat; it still stands, and the 98/677 figure is the population, not the defect count.

---

## ADDENDUM — written at 14:18, after the body above was filed: HEAD moved twice during this checkpoint

The final read-only snapshot, taken immediately after this report was written, found **HEAD had advanced from `102241f` to `cb2ade4`**:

```
9593a74  14:13:15  feat(redesign): C-20 Phase C — customer form address autocomplete
cb2ade4  14:17:09  docs(redesign): C-20 phases A-C recorded — live gate evidence, step 4a spike passes
git diff --stat 102241f..cb2ade4 → 5 files, +695/−6
  src/features/booking/components/AboutYouStep.tsx      +60/−6
  src/features/booking/components/AboutYouStep.test.tsx +297 (new)
  redesign/evidence/C-20/phase-b-verify-full.md         +180 (new)
  redesign/evidence/C-20/phase-b-fix-reverify.md        +121 (new)
  redesign/per-page-progress/C-20-…-progress.md          +43
```

**This escalates finding 1 rather than changing it.** The body of this report described uncommitted writes to `src/`; the true state is that a plan's implementation phase **committed to master, twice, while the programme's final drift checkpoint was running**. Checkpoint #2's `F-1` recorded that its measurements were clean "by luck, not design"; here the same is true and HEAD itself moved. **Every gate result in this report is pinned to `102241f`** — the SHA in the dispatch — and was measured before 14:03. They are not re-run against `cb2ade4`, deliberately: a checkpoint that chases a moving tree measures nothing. `cb2ade4` touches one `src/` component plus one new test file, so a re-run at `cb2ade4` is a separate measurement someone should take before the final build, and this checkpoint does not certify it.

**Finding 2 is now PARTIALLY remediated — and partially sharpened.** `cb2ade4` added Phase A/B/C records and committed the two previously-untracked evidence files, which closes most of the finding. But:
- **`C-20-…-progress.md` §2 "Position" still reads verbatim *"Phase A in flight. Phases B–E not started. Both ⏸ items in §0.4 open."*** — now contradicting three fully-written phase sections above it in the same file. This is the one section a resuming agent reads under §3 to learn where it is, and it is still false.
- **`BAND-C-MASTER-PLAN.md`'s C-20 row is untouched**, still `⏳ (brief + plan ✅)` with Started/Shipped/Commit all `—`, though three phases have shipped. It is absent from `cb2ade4`'s diff.

**Two new items the late commit itself discloses, recorded here because no later checkpoint exists to catch them:**

1. **A credential-handling slip, self-reported (C-20 progress §1a.3).** While confirming the lazy load, the Maps loader's script URL was captured *"and it contained the key value… an avoidable slip on the orchestrator's part — the standing instruction is never to read or print it."* Self-disclosure is the right behaviour and the file states it plainly. **NON-BLOCKING** — a `NEXT_PUBLIC_*` Maps key is inlined into client bundles and public by nature, and the load-bearing control is the referrer restriction, which is correct.
2. **But it answers a question the Owner's "do not rotate" ruling was made without.** `OWNER-ACTION-BACKLOG.md` records that whether the key in `.env` is the one pasted into the 2026-08-04 chat transcript was *"unconfirmed — no agent read the value."* It is now confirmed to be **the same key**. The progress file argues the ruling stands on unchanged mitigating facts, which is defensible — but the Owner decided on 2026-08-09 against an explicitly open question that has since been closed the other way. **Recommended owner: the orchestrator — update the backlog's C-20 row from "unconfirmed" to confirmed, and put the closed question back in front of the Owner once, without re-litigating the decision.**

**The verdict is unchanged: FAIL.** It is now better evidenced than when it was written.

---

*Checkpoint #4 formal, complete 2026-08-09. Gates and all code findings pinned to HEAD `102241f`; the tree advanced to `cb2ade4` mid-checkpoint (see addendum). Read-only: no source, test, config, migration or standing-state file was modified; this file is the only write. Git limited to `log`/`diff`/`show`/`status`/`grep`/`ls-files`/`merge-base`; four SELECT-only `execute_sql` queries (email count, the three C-23 fixture bookings, `consent_events` totals, 2026-08-09 row counts). `src/lib/maintenance.ts` was read but never staged, committed, reverted or written. This is the last of the four §2.6 checkpoints; findings 1, 2 and 3 have no later checkpoint to catch them.*
