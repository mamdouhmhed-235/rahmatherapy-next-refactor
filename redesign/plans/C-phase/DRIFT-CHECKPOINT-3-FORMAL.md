# VERDICT: PASS-WITH-FINDINGS

**Programme drift checkpoint #3 (formal) — after plan #15 (C-07). Run 2026-08-03 on `opus`, read-only.**

**Range:** `7fe8b4f..435472a` — 254 commits, 355 files, +58,389/−5,987. Plans #1–15: C-21, C-22, C-06, C-04a, C-05, C-01, C-FIELDWORK, C-11, C-08, C-15, C-13, C-02, C-09, C-03, C-07.

**Why PASS-WITH-FINDINGS and not PASS:** no code defect in range justifies a FAIL, and the two things §2.6 exists to catch in code — convention drift and Sonnet/Opus idiom divergence — are genuinely clean (Job 1 is a rigorously-established null result; every Part 0 convention re-verified holds). But two record-keeping findings are load-bearing enough to name: the programme's **model-attribution record is contradicted by its own commit history** (F-A, five plans deep, nobody noticed), and one **groundwork figure does not reproduce** (F-B). Neither is a fix round; both need an Owner decision or a correction before checkpoint #4.

**Working-tree discipline (checkpoint #2's F-1 follow-up, item 1).** `git status --porcelain` snapshotted at both ends of this session: 276 → 277 lines. The single delta is `?? redesign/evidence/checkpoint-3/`, written by the two companion read-only lenses this checkpoint was told to reference. **HEAD unmoved at `435472a` throughout**, and `git status --porcelain -- src/` is `M src/lib/maintenance.ts` and nothing else — the standing §3b Owner-owned change. **F-1 did not recur**: no write-task mutated source mid-audit. Stated precisely rather than as the groundwork's "byte-identical", because it is not byte-identical and a future checkpoint should expect its own companions' evidence files to appear.

---

## JOB 1 — Sonnet/Opus idiom divergence

### The premise had to be rebuilt before it could be answered

My dispatch, §5's routing table, and the progress files all say the same thing about which plans ran on which model. **The commit history says something different**, and this checkpoint is the first to check.

**Method, and why the trailer is trustworthy here.** Every commit's `Co-Authored-By` trailer names the model of the agent that wrote the commit message. Three independent proofs that it varies per *agent*, not per session:

1. `4e18fa9` (C-11 Phase A, implementer) carries **Claude Sonnet 5**; the orchestrator's own progress commit for that same phase, `a633d3b`, lands the same day carrying **Claude Opus 5**. Adjacent commits, two different models.
2. Same pattern at C-08: implementer commits `80a8bc2`/`547c018`/`9f200ba`/`e522bdd` (Phase A) and `e018d67`/`40a0202` (Phase B) are **Sonnet 5**, while the orchestrator's `622d6eb` and `a4e7131` between them are **Opus 5**. C-08 is plan #9, *after* the session model became Opus — so a Sonnet trailer there can only come from a Sonnet subagent.
3. The range contains **four** distinct model names — `Claude Sonnet 5`, `Claude Opus 5`, `Claude Opus 4.7 (1M context)` (`af273e8`, C-13 Phase A) and `Claude Fable 5` (eight protocol-doc commits, e.g. `ce459f1`, `ab35e97`, `6b1628b`). A session constant cannot produce four values.

### F-A — NON-BLOCKING for code, but it disables §2.6's mandate going forward

**The last Sonnet-authored implementer commit in the entire programme is `40a0202` (C-08 Phase B, 2026-07-31).** After it, across the remaining ~120 commits, there is **not one Sonnet trailer**. Every implementer commit for **C-15, C-13, C-02, C-09, C-03 and C-07** carries `Claude Opus 5` or no trailer at all — and §5 routes five of those six (all but C-02) to **`sonnet` implementers**.

The contradiction is sharpest inside C-07, the plan that just closed:

| C-07 phase | Progress file records | Commit trailer |
|---|---|---|
| B1 (`4e23053`) | §1.5: "**Model:** implementer `sonnet`" | `Claude Opus 5` |
| B2 (`c6c1ec4`) | §1.6: "Routed **`opus`** — the only opus dispatch since C-02" | `Claude Opus 5` |
| B4 (`f038b4f`) | §1.9: "**Model:** implementer `sonnet`, verifier `sonnet`" | *(no trailer)* |

If the progress file is right, B1 and B2 ran on different models and their commits should differ. They do not.

**Two readings, and I cannot close between them from inside the repo — but both are protocol deviations:**

- **(i) The routing is not being honoured.** From C-08 Phase C onward, plans §5 assigns to `sonnet` have been implemented on `opus`. Consequence: §5's capability-based amendment ("never spend `opus` on work `sonnet` handles well", `ab35e97`) is being satisfied on paper only, and the Owner is paying opus rates for work they explicitly reasoned should be sonnet — an Owner-facing cost decision made silently.
- **(ii) Implementers stopped committing their own work** and the orchestrator committed for them, contra §2.2 and SUBAGENT-RULES rule 11. Consequence: a different deviation, and the progress-file model records become the *only* source, unverifiable by anything.

Weak evidence for (ii): `dc742d0` (C-08 Phase C) and `f038b4f` (C-07 B4) carry **no trailer at all** while every surrounding orchestrator docs commit carries one — inconsistent discipline more typical of many short-lived agents than one long-running orchestrator. Weak evidence for (i): the switch point (`dc742d0`, 2026-07-31) coincides with §2.8's medium-throughput mode landing (`1519ab6`, same day) and the Owner's "use workflows for speed" request that checkpoint #2's F-1 already traced to over-parallelisation — a plausible mechanism by which dispatches lose their `model` pin.

**This is exactly the shape §2.6 exists to catch and no single-plan review could:** each plan's own closeout compares its diff to its plan text, never to fifteen commits of trailer history.

### The code itself: no meaningful divergence — a null result, rigorously established

Because the attribution is disputed for six plans, I ran the comparison only where the two sources **agree**, so the corpora are certain:

- **Sonnet-certain** (progress files and trailers concur): C-05, C-01, C-FIELDWORK, C-11 Phase A, C-08 Phases A+B — **8,424 added `src/` lines**, 23 commits.
- **Opus-certain**: C-06, C-04a, C-11 Phases B–E, C-02 — **20,232 added `src/` lines**, 59 commits.

| Metric (added `src/` lines) | Sonnet-certain | Opus-certain |
|---|---|---|
| Comment lines | 881 (10.5%) | 2,925 (14.5%) — **12.0% excluding C-04a** |
| Supabase destructure **with** `error` | 3 | 32 |
| Supabase destructure **data-only** | 5 | 8 |
| `TODO` added | 0 | 6 |
| Silent/empty catch added | 0 | 2 |
| `eslint-disable` added | 0 | 1 |
| `it(`/`test(` added | 153 (18.2/kloc) | 311 (15.4/kloc) |

**Every apparent gap dissolves on inspection:**

- **Comment density is plan-driven, not model-driven.** Per plan: Sonnet C-05 13%, C-01 9%, C-FIELDWORK 10%, C-08AB 9%; Opus C-06 11%, C-04a **19%**, C-11B–E 14%, C-02 10%. The ranges overlap; Opus C-02 (10%) sits *below* Sonnet C-05 (13%). The aggregate gap is carried almost entirely by C-04a, the largest and most fix-round-heavy plan in the programme.
- **Test granularity likewise.** The highest density in the range is Sonnet's C-FIELDWORK (24.0 `it(`/kloc); the lowest is Opus's C-11 Phases B–E (5.8), a pure UI-extraction plan. Model explains nothing; plan type explains everything.
- **The `error`-handling ratio is a workload artefact, not a discipline gap.** I read **all 13** data-only destructure sites in both corpora. Every one handles the null explicitly: Sonnet `notifications.ts:1437` (`if (!marked)`), `:1456` (`(items ?? [])`), `:1126` (`if (!staff?.email)`), `:1176`/`:1235` (`?? "(unknown)"` / `?? "your therapist"`); Opus `availability/actions.ts:124` (`if (!beforeState) return { error: … }`) and siblings. **Neither corpus contains a swallowed `error` that produces a silent wrong outcome.** Opus's 32:8 vs Sonnet's 3:5 reflects that C-06/C-04a/C-02 wrote the write-heavy server actions while C-01/C-05/C-FIELDWORK wrote read-mostly UI and email.
- **The 6 Opus `TODO`s are not abandoned work.** All six are intra-plan forward markers — `TODO(C-06 Phase E)` ×3, `TODO(C-04a Phase F/G)` ×3 — placed by an early phase for a later phase of the same plan. **Five of the six were resolved before HEAD.** Only three `TODO`s survive in `src/` at HEAD and two are pre-programme (`AreaTherapists.tsx:23`, added `4ca5c07` 2026-06-01; `reporting.ts:417`, added `0b25108` 2026-05-20).
- **The 2 silent catches are the house idiom.** `.catch(() => undefined)` on fire-and-forget audit/operational writes appears at **17 sites at HEAD**, most pre-programme (`api/bookings/route.ts`, `booking/manage/actions.ts`, `notifications.ts:469`…). Rule 11 requires matching it.

**The sharpest test — same file, both models — returns the strongest null result of all.** 19 `src/` files were touched by both corpora. `src/lib/email/notifications.ts` is the ideal case: both groups wrote new `send*Email` functions into it. Placed side by side they are indistinguishable — same `/** C-XX Phase Y — rationale */` header convention, same `throw new Error("Booking client has no email address.")` for a required recipient (Sonnet `:1087`/`:1227`; Opus `:775`/`:836`), same `console.warn(...); return;` for an optional one (Sonnet `:1127`; Opus `:902`).

And better than indistinguishable — **the idiom is demonstrably inherited across the model boundary, in writing**:

> `src/lib/email/notifications.ts:880-883` (Opus, C-02 Phase Fb): *"Unlike sendRecurringSeriesCreatedEmail, a missing client email is NOT an error here — mirrors sendStaffUnassignmentEmail's posture above"*

`sendStaffUnassignmentEmail` is **Sonnet-authored** (C-08 Phase A, `547c018`). An Opus implementer read a Sonnet function and adopted its error posture on purpose. The same function's header (`:806`) cites Opus C-04a's `sendBookingRestoredClientEmail` as its structural model. Rule 11's match-existing-style requirement is doing exactly the normalising job §5's "cross-model consistency" paragraph predicted.

**Answer to the dispatch's four questions:** no divergence in error handling, comment style, defensive coding, test granularity, function size, or helper extraction. Neither group is measurably more likely to leave a `TODO`, a silent catch, or an unhandled `error`. Neither group's code reads as foreign beside the other. And on the sharpest form — a same-file idiom split — **there is none to find**.

### F-C — NON-BLOCKING, latent. One genuine asymmetry, and it is in the Sonnet corpus

`src/lib/email/notifications.ts:1427-1441` (C-01 Phase C, `89f997b`, Sonnet) is the **only** place in either corpus where a *write's* `error` is discarded and the resulting null is given a benign explanation:

```
const { data: marked } = await supabase
  .from("bookings")
  .update({ review_email_sent_at: new Date().toISOString() })
  …
if (!marked) {
  // Parallel cron tick already marked the sentinel first. …
  console.warn(`sendReviewRequestEmail: sentinel race for booking ${bookingId}`);
}
```

**Failure scenario:** if that UPDATE ever fails for a non-race reason — a revoked grant is the documented one — `marked` is null and the code reports a *race*. `review_email_sent_at` is never stamped, so `review-emails/route.ts` re-selects the same booking on the next tick and the customer receives a review request **every 15 minutes, indefinitely**, while the log says "race". This is precisely the §3b hazard ("this codebase's habit of discarding the `error` from a Supabase call makes the failure silent at runtime") that cost C-04a a verification cycle.

**Latent, not live:** I verified `has_table_privilege('service_role','bookings','UPDATE')` → **true** (SELECT-only query against `twzutkfgqclqurvkmvqz`). One line — destructure `error` and distinguish it from the race — closes it. Logged, not fixed; `notifications.ts` has no owner among the remaining plans.

---

## JOB 2 — Independent re-verification of the groundwork

I re-checked **nine** groundwork/checkpoint-#2 claims. **Eight hold. One does not reproduce.**

| # | Claim | Re-check at `435472a` | Result |
|---|---|---|---|
| 1 | "Zero `border-l-4`" | `git grep -n "border-l-4"` over `*.ts`/`*.tsx`/`*.css` → **0**; over `src/` → **0** | ✅ HOLDS |
| 2 | "Zero `revalidateTag(`" | `git grep -rn "revalidateTag(" src/` → **0** | ✅ HOLDS |
| 3 | **"JSON-safety across `unstable_cache`: zero violations"** | read the actual return paths, see below | ✅ HOLDS |
| 4 | "…across all **16 wraps**" | 16 *modules*, but **26** `unstable_cache(` call sites | ⚠️ under-counts by 10 |
| 5 | D2: `access.ts` and `_helpers.ts` today-in-London now byte-identical | `access.ts:85-92` vs `_helpers.ts:198-205` — bodies byte-identical, names differ (`getLondonToday` / `getTodayIsoDate`) | ✅ HOLDS |
| 6 | D1 shims still byte-identical and doubly dead | `bookings/actions.ts:84-89` vs `clients/actions.ts:455-460` — identical `Set` + identical `hasErrorCode` | ✅ HOLDS |
| 7 | ckpt#2: "no test skipped/weakened; zero `.skip` in `src/`, `e2e/` untouched" | 12 hits total, **all** `test.skip(<condition>, …)` env-guards in `e2e/`, all pre-programme; `git diff --stat 7fe8b4f..HEAD -- e2e/` → **empty**; `src/` → 0 | ✅ HOLDS |
| 8 | ckpt#2: "suppressions in `src/` went 45 → 37" | `7fe8b4f`: 45 in 25 files · HEAD: **37 in 24 files** | ✅ HOLDS |
| 9 | **"68 files carry light-only `oklch(…)` literals at `7fe8b4f`"** | not reproducible — see F-B | ❌ FAILS |

### Claim 3 in detail — the one checkpoint #2 most wanted watched

I did not trust declared types. I enumerated all 26 wrap sites, grepped the 16 modules for `new Set(` / `new Map(` / `new Date(` / `: Set<` / `: Map<` / `: Date`, and read every hit's return path:

- **The two highest-risk wraps** (`reports-data.ts:52`, `performance-data.ts:55`) both cache a `ReportData`. Its interface (`reporting.ts:134-153`) is arrays and primitives only — **and carries an in-code tombstone for this exact hazard** at `reporting.ts:145-149`: *"Was `Set<string>`; flipped to `string[]` because B-2's `unstable_cache` wrap JSON-serializes this payload — `JSON.stringify(Set)` returns `'{}'` and `.has` then throws on cache-hit reads."* The discipline is real, pre-dates the programme, and was written after the failure actually happened.
- `reports-data.ts:131` `new Set(dismissedIds)` — inside `fetchReportInsights`, which is React `cache()` only, and the Set is an *argument* to a pure function, never returned. `reports-data.ts:98-100` documents returning `string[]` deliberately "so a future cache wrap won't degrade the value silently".
- `performance-data.ts:213` (`new Map`) and `:261-279` (`new Date`) sit in `buildPerformanceTrend` (`:201`) and `makeWeeklyBuckets` (`:260`) — **outside** the file's only wrap, which closes at `:81`.
- `settings-data.ts:79` is the one `new Date` genuinely *inside* a cached closure (`loadLastChange`, called at `:100`). It is consumed into a string via `toLocaleString`; the returned object is `{ actor, display, isoTimestamp }` — all strings. This is the case the groundwork claimed it verified by reading return paths, and it does hold.
- Every remaining `Set`/`Map` (`dashboard-data.ts:220-264,362,370,513,641`; `bookings-list-data.ts:148,151`; `staff-list-data.ts:185,248`; `privacy-data.ts:174,191`; `client-detail-data.ts:290`; `emails-data.ts:158`) is a local intermediate consumed via `Array.from(new Set(…))` / `Array.from(new Map(…).values())` / `[...new Set(…)]`, or used only for `.has()` filtering inside the closure.

**Zero violations confirmed independently.** Incidental re-verification of a C-07 claim on the way: `dashboard-data.ts:182` shows the cache key is `["dashboard-data", profile.id, JSON.stringify(filters), scope]` — §1.6's "the key now carries `scope` as a fourth part" is exact.

### F-B — NON-BLOCKING, factual correction. The 68-file figure does not reproduce

The groundwork and `OWNER-ACTION-BACKLOG.md` both state **"68 files carry light-only `oklch(…)` colour literals… as of programme start `7fe8b4f`"**. I cannot reproduce 68 under any measurement:

| Measure, `src/` only | `7fe8b4f` | `435472a` | Δ |
|---|---|---|---|
| Files containing `oklch(` | 102 | 103 | +1 |
| Files containing `[oklch(` (Tailwind arbitrary value — the "literal in a component" shape) | **93** | **98** | **+5** |
| Occurrences of `[oklch(` | **726** | **679** | **−47** |

The population is **93 files at programme start, not 68** — the debt is ~37% larger than recorded. (The groundwork's narrower "*light-only*" semantic — a literal with no dark sibling — is a real distinction I cannot reproduce by grep, so 68 may be a valid subset; but the figure the backlog hands the Owner reads as the size of the problem, and the problem is 93→98.)

**The trajectory is the more useful finding, and it is genuinely two-sided:**

- **C-11's sweep worked.** Occurrences fell by 47 and **six files lost the pattern entirely**: `admin-ui.tsx`, `dashboard-cards.tsx`, `ManualSendSheet.tsx`, `TemplateEditForm.tsx`, `TemplatePreviewPanel.tsx`, `TemplatesTab.tsx`.
- **But 11 new files planted it during the programme**, spanning four plans and both model groups: C-06 (`ClientEditForm`, `BulkDeleteToolbar`, `DeleteClientButton`, `DuplicateWarningBanner`), C-04a (`NextActionButton`, `3bddb39`), C-02 (`RecurringSection`, `SeriesActions`), C-13 (`BookingCard`), C-15 (`LivePreview`, `TemplateEditor`, `TokenTextField`).

So **both prior framings were half right**: checkpoint #2's F-4 was too narrow (it named C-15's three files; there are eleven), and the groundwork's "not drift, just ambient debt that no plan owns" was too generous — **four separate plans re-planted it after C-11 shipped dark mode.** It is ambient debt *and* an active re-planting pattern. See Job 4.3 for the recommendation.

---

## JOB 3 — Baseline erosion across 15 plans: the judgement

**Verdict: the baseline has NOT been eroded at any point. No plan ever added a failure to the inherited list.** This is the strongest part of the programme and the evidence is unusually clean.

**1. No failure was ever added — arithmetic and identity both.** §0's programme-start snapshot is six failures: `ManualBookingForm` ×3, `admin-access` ×2, `createBookingTransaction` ×1. HEAD is five: the same set minus `createBookingTransaction`, C-06's declared expected shrinkage. **A strict subset. There is no room for a swap.** Every progress file names the same five test *titles* verbatim (C-02 §204, C-08 §265, C-13 §71/§258, C-15 §126/§359, C-07 §72/§193) — not counts, titles.

**2. The failures are unchanged in character, not merely in name — and this needed checking, because one of the two files was edited.** `admin-access.test.ts` is untouched in range. **`ManualBookingForm.test.tsx` was modified by five commits** across C-06 (`c20dc5e`, `e5d5d47`, `c57721f`) and C-03 (`073485c`, `8864e46`) — so "same three titles still failing" could in principle have masked a different failure. It did not:

- `git diff 7fe8b4f..HEAD` on that file is **+298 / −1**, and the single deleted line is `-import { render, screen, waitFor } from "@testing-library/react";`, replaced by a wider import.
- Every edit adds a **new `describe` block** with new `it()`s. **Zero `it(` or `describe(` lines were removed or rewritten.** The three failing test bodies were never touched.
- I confirmed the failures at HEAD directly rather than inferring: `npx vitest run src/lib/auth/admin-access.test.ts src/app/admin/bookings/new/ManualBookingForm.test.tsx` → **5 failed / 18 passed (23)**, same five, at `435472a`.

C-08's progress file (§265) recorded an explicit character-check for `admin-access.test.ts` because it edited `rbac.ts`. Worth noting for the record: **no plan made the equivalent explicit check for `ManualBookingForm.test.tsx`, the file that actually changed.** The answer is fine — but it was luck of purely-additive editing, not a check anyone ran.

**3. "Were the five ever going to be fixed, and by whom?" — No, deliberately, and it is written down.** `C-20-address-autocomplete-plan.md:173` instructs: *"the 3 pre-existing baseline failures in this file persist unchanged (**do not 'fix' them here**)"*. C-23's §0 (`:20`) treats them the same way. C-06 edits the file but only adds specs. **No plan in the 22 claims ownership of fixing any of the five.** They are pre-programme debt the programme deliberately carries. That is a defensible decision, consistently honoured.

**4. Nothing is accumulating behind "same identity, no new failures".** Lint suppressions are **down** 45→37 (re-verified). Lint errors remain 59E/7W in the same six files. Zero tests skipped, weakened or deleted in `src/`; `e2e/` untouched across the whole range. The one thing that *is* accumulating — colour literals — is F-B, and it is visible to grep rather than hidden behind a gate.

**5. The pass-count drift (C-07 §1.11: 1483 recorded vs 1490 actual) is benign bookkeeping — and I can name the mechanism.** It is not mysterious and not a symptom of anything hidden: **plans record their gate counts at closeout, then keep committing fix rounds that add tests afterwards.** Measured:

| Post-closeout commit | Tests added |
|---|---|
| `08bee11` C-09 — tag roles + services mutations | +9 |
| `2d5bcdb` C-09 — tag `updateRoleMetadata` | +3 |
| `457e3ff` C-09 — tag the three `audit_logs` writers | +17 |
| `8864e46` C-03 — step-2 match banner | +2 |

C-09's progress file records **1263 total** at its closeout gate; all 29 of those tests landed *after* its "shipped" bookkeeping commit `76f527c`. C-03 added 2 after `290b76f`. The next plan inherits the pre-addendum number and copies it forward.

**Judgement: benign, but only because gates are judged by identity — the counts are decoration that reads like data.** The residual risk is real and already has a precedent: checkpoint #2's F-5 found C-15's progress file understating its own suppression count, and noted that a count in a progress file is "the one input those checkpoints can't independently sanity-check without re-counting". C-07's §1.11 correction ("**judge by identity, never by count**") is the right response and should be treated as the programme's standing rule.

**One gap worth closing before programme end:** nothing in `OWNER-ACTION-BACKLOG.md` records that five tests fail permanently by design. At handover the Owner gets a suite that fails five tests and no single document saying "these are pre-programme, deliberately unfixed, here are their names, C-20 §173 is the decision". That belongs in the backlog's logged-items table.

---

## JOB 4 — The groundwork's five held items, closed

### 4.1 — Gates at true final HEAD ✅ (confirmed, not duplicated)

`git diff --stat f038b4f..HEAD` → **6 files, +392/−10, every one under `redesign/**`**: `evidence/C-07/b4-verify-full.md`, `evidence/C-07/closeout-adversarial-review.md`, `evidence/C-07/closeout-static-gates.md`, `per-page-progress/C-07-…-progress.md`, `per-page-progress/OWNER-ACTION-BACKLOG.md`, `plans/C-phase/BAND-C-MASTER-PLAN.md`. **No source, test, config or migration file changed since the last full gate run — the delta cannot move a gate.**

Authoritative results are the companion lens's: `redesign/evidence/checkpoint-3/final-head-gates.md` — **IDENTITY: MATCH** at `435472a` (tsc 0 · vitest 5 failures, the five by name · eslint 59E/7W across exactly six files · build clean). My own targeted re-run of the two baseline files (Job 3, item 2) independently agrees on the vitest identity. **Identity held through B4's resolution.**

### 4.2 — Fold in B4's outcome ✅ — and it *strengthens* the groundwork's recommendation

**The saved-views privacy fix verifies.** I re-derived the control flow at `BookingsChrome.tsx:114-140` rather than taking §1.9's word: `loadSavedViews(staffId)` returns early on SSR (`typeof window === "undefined"`), then **unconditionally** `removeItem`s `LEGACY_GLOBAL_STORAGE_KEY` inside its own try/catch, and only then reads `storageKeyFor(staffId)`. No early-return path can skip the purge. The comment at `:118-123` states the reasoning correctly: migrating the legacy key "would hand that data to the wrong person — the exact leak namespacing this key is meant to close."

**One correction to §1.9, small but worth recording.** §1.8a gap 1 says namespacing "fixes both at once" — the leak *and* brief §2.12's "cleared on logout". **It fixes the first, not the second.** Namespacing removes cross-staff *visibility in the UI*; it does not remove *data residency*. On a shared front-desk browser, Coordinator A saves a view whose `search=` param carries a client's name; A signs out; B signs in and correctly sees nothing — but `rahma.admin.bookings.saved-views.v2.<A-id>` remains in that browser's localStorage, with the client name in it, indefinitely, with no expiry and no clear-on-logout. The brief's literal requirement would have covered this. Not a blocker (the UI leak, which is what an ordinary user would encounter, is genuinely closed) — but the brief requirement should be recorded as **partially met**, not met.

**Does B4 change the duplicate-logic inventory? Yes — it makes the groundwork's recommendation stronger, not weaker.** B4 is the sixth instance of "two things that should be one thing", and the first the programme closed **by declining to build it**. The pattern across all six:

| Outcome | Instances |
|---|---|
| Reconciled inside the plan that found it | 2 (default-view computation, C-07 B3 `838d049`; allow-list param preserver, C-07 B2 `dd5b497`) |
| **Prevented before existing** | **1 (B4 — plan Steps 14–16 cancelled by Owner ruling)** |
| Survives because reconciliation touches protected/unowned files | 3 (D1 shims, D2 date helpers, client/server preset maps) |

**The groundwork's "keep the vigilance, don't invent a framework" recommendation should stand, and B4 is now its best evidence.** No framework would have caught B4 — the duplicate did not exist yet, and the instruction to create it came from the *plan*. What caught it was an implementer reading the existing code before writing, hitting a plan/reality contradiction, and returning a HARD-STOP instead of complying (SUBAGENT-RULES §3). That is a **process** control, and it worked. Three of six instances were caught by per-plan vigilance and one by a subagent refusing an instruction; the three survivors all survive for the same structural reason — no owner, or a Part 0 untouchable — which is an ownership problem, not an abstraction problem. **Recommendation unchanged and reinforced: give D1/D2 an owner; do not build a framework.**

### 4.3 — The `oklch(…)` colour-literal debt: a crisp recommendation

**Recommendation: do NOT open a retrofit plan. Add a one-line rule to Part 0 instead, and let the debt decay.**

Reasoning, from the trajectory in F-B rather than a restatement:

1. **A retrofit is large and low-yield.** 98 files, 679 occurrences. C-11 already spent a full phase on this and cleared six files for a net −47 occurrences — that is the actual rate of return on a dedicated sweep, and C-11 was the plan that owned theming.
2. **The bleeding is the cheap part to stop, and it is small.** Eleven files re-planted the pattern in fifteen plans. That is roughly **one new file every other plan** — and every one of them did it for the same defensible reason: rule 11 requires matching the file being extracted from (C-13's `BookingCard.tsx` is the documented case, verified byte-identical to its source at `0bb356d`).
3. **So the rule has to name the exception, or it will be ignored.** Concretely, for Part 0 rule 11: *"When a new file is created by extraction, match the source file's style — **except** hardcoded `oklch(…)` colour literals, which take the nearest `--admin-*` token instead."* One sentence, zero retrofit cost, and it converts the seven remaining plans from re-planters into non-contributors.
4. **The severity claim needs one caveat the backlog does not carry.** "Dark is the default so these render at poor contrast" is true only where the literal has no dark sibling. F-B's grep cannot distinguish those, and neither could the groundwork — so the *user-visible* size of this problem is still unmeasured. Anyone who does open a retrofit should measure that first; it may be far smaller than 98 files.

**If the Owner declines the rule:** record explicitly that the debt stays unowned into C-12+ and that the file count is **93→98, not 68** — the backlog row should be corrected either way, because it currently understates the population by ~37%.

### 4.4 — Client preset map vs server `getRangeDefaults()`: a crisp recommendation

**Recommendation: close it. Two `if` lines in `reporting.ts` under a narrow Owner-approved exception — this is not a hypothetical, it is a repeat of a failure this exact function has already had.**

**Re-verified live at HEAD.** `buildPresets()` emits six keys (`dashboard-filters-client.tsx:64-69`): `today`, **`yesterday`**, `this_week`, `this_month`, **`last_30`**, `custom`. `getRangeDefaults()` (`reporting.ts:962-1017`) handles `lifetime`, `year`, `today`, `tomorrow`, `week`, `this_week`, `this_month`, `custom`, `quarter` — **neither `yesterday` nor `last_30`.**

**Concrete failure scenario.** `parseReportFilters` resolves `from: customFrom || defaults.from` (`reporting.ts:259-260`). A URL carrying `?range=yesterday` with no `from`/`to` therefore falls through to the catch-all at `:1016` and renders **`{ from: <month-start>, to: today + 30 business days }`** — a ~60-day window presented as "Yesterday". No error, no warning, wrong number on every tile.

**Why this deserves closing rather than continued masking — three points the groundwork did not have:**

1. **This function has already shipped this exact bug once.** `reporting.ts:966-969` carries the tombstone: *"`tomorrow` … Added 2026-05-25 after the audit found the chip was silently falling through to a month-forward catch-all."* The class is not theoretical; it has been realised in production in this function, found by an audit, and fixed by adding the missing case. `yesterday` and `last_30` are the same omission, one audit later.
2. **C-07 B1's masking is robust but not load-bearing on anything.** It works because the chips always emit explicit `from`/`to`. I verified the other half is safe too: `handleClearAll` (`dashboard-filters-client.tsx:262-277`) now deletes only the six `ADVANCED_FILTER_KEYS` and preserves `from`/`to`/`range`/`scope`, so clear-all cannot strip the dates a range key depends on. The masking holds today.
3. **But the mask depends on every future author knowing about it.** Any new link, chip, saved default or redirect built as `?range=<key>` — the convention the `tomorrow` and `this_week` chips elsewhere already follow — reintroduces the bug silently. The next plan to add a range chip is the next occurrence.

**Cost of the fix: two `if` statements** matching the existing style at `:963-965`, e.g. `if (range === "yesterday") { const y = addBusinessDays(today, -1); return { from: y, to: y }; }` and `if (range === "last_30") return { from: addBusinessDays(today, -30), to: today };`. `reporting.ts` core exports are a Part 0 untouchable, so this needs an explicit Owner exception — but it is a two-line additive change to a private function with no exported signature change, which is about as small an exception as the programme could be asked to grant.

### 4.5 — Post-deploy-only checks ✅ (referenced, not duplicated)

The companion lens has delivered: `redesign/evidence/checkpoint-3/post-deploy-runbook.md` — **13 post-deploy checks across 5 plans** (C-22, C-04a, C-01, C-02, C-08) plus 2 external SEO items from C-21, sequenced, each citing its source progress file, with the `maintenance.ts` precondition and the four-in-one deploy's actual activations called out ahead of the list. It found two items already obsolete.

This closes the gap flagged at checkpoints #1, #2 and #3-groundwork. **Recommendation: replace the `OWNER-ACTION-BACKLOG.md` row that describes the gap (logged-items table, 2026-08-03) with a pointer to that runbook**, so there is one location rather than a description of the problem plus a solution nobody links to.

---

## Checked and found clean (no finding)

- **Part 0 conventions, re-run at HEAD**: zero `border-l-4` repo-wide; zero `revalidateTag(` in `src/`; zero `Set`/`Map`/`Date` crossing any of the 26 `unstable_cache` boundaries.
- **Baseline discipline across 15 plans**: identity-exact throughout; no failure ever added; the one removal is C-06's declared expected shrinkage; the failing test bodies are byte-untouched.
- **Test-suite integrity**: zero `.skip`/`.todo`/`xit`/`xdescribe` in `src/`; `e2e/` has zero diff across the entire range.
- **Lint erosion**: suppressions **down** 45 → 37 in `src/` (25 → 24 files); errors unchanged at 59E/7W in the same six files.
- **`ManualBookingForm.test.tsx`**: +298/−1 across five commits, purely additive, the one deletion an import statement.
- **C-07 B2's cache-key claim**: `scope` genuinely reaches the key (`dashboard-data.ts:182`), not just the query.
- **C-07 B2's clear-all fix**: `handleClearAll` preserves every non-advanced param by construction (`dashboard-filters-client.tsx:262-279`).
- **C-07 B4's legacy purge**: unconditional, pre-read, SSR-guarded, independently re-derived at `BookingsChrome.tsx:114-140`.
- **D1 / D2 duplicates**: both still byte-identical, both still unreconciled, neither worsened. D1's only remaining candidate owner is **C-14**.
- **Cross-model idiom inheritance**: positively evidenced in-code, not merely absent divergence (`notifications.ts:806`, `:880-883`).
- **`notifications.ts` pressure**: 1,467 lines at HEAD, matching the groundwork's figure. Still unowned; C-16/C-17/C-18 are next.

---

## Recommendations for checkpoint #4 (after plan #20)

**Blocking on the Owner before plan #16 starts:**

1. **Resolve F-A.** Decide which reading is true — routing not honoured, or implementers not committing their own work — and fix the cause. Until then §2.6's Sonnet/Opus mandate cannot be executed, because there is no trustworthy attribution to compare. **Cheapest durable fix:** SUBAGENT-RULES rule 12 already asks every worker to return "the model you ran as, if known" — make it unconditional, have the orchestrator record it **per phase** in the progress file, and have checkpoint #4 reconcile those records against `git log --format='%(trailers:key=Co-Authored-By)'`. A one-line discrepancy check turns this from invisible into automatic.

**For checkpoint #4 to carry forward:**

2. **Re-run the F-A reconciliation over `435472a..HEAD` first.** If C-16 through C-23 also show zero Sonnet trailers, reading (i) is confirmed and §5's routing table should be rewritten to describe what actually happens rather than what was intended.
3. **Do not re-run Job 1's idiom comparison unless F-A is resolved and Sonnet-authored code reappears.** The null result is established on 28,656 added lines across nine plans and two models; re-deriving it on an all-Opus corpus would be measuring nothing. If reading (i) is confirmed, §2.6's fourth clause is **moot** and the Owner should be told so rather than having a checkpoint pretend to check it.
4. **Measure the `[oklch(` occurrence count again** (679 at HEAD). It is a single grep and it is now the programme's clearest quantitative drift indicator: falling means retrofits are outpacing re-planting, rising means the four-plan re-planting pattern continued through C-16/C-17/C-18/C-19/C-20.
5. **Re-check the D1/D2 duplicates one last time at C-14** — checkpoint #1 assigned D1 to "whichever of C-02/C-08/C-14 next needs the shape", and C-02 and C-08 have both passed without needing it. **C-14 (plan #21) is the last candidate.** If C-14 passes too, the assignment has failed and the honest close is to record both shims as permanently dead rather than carrying the row into a fifth checkpoint.
6. **Verify the post-deploy runbook is still complete** rather than re-enumerating it: diff plans #16–#20's progress files for new post-deploy-only items and confirm each was appended to `post-deploy-runbook.md`. The failure mode this list exists to prevent is a plan adding an item to its own progress file and nowhere else — exactly what F-10 caught the backlog doing.
7. **Confirm the five permanent test failures got a backlog row** (Job 3's closing gap). Checkpoint #4 is the last one before the programme's final three plans; a suite handed over with five unexplained failures is a bad handover artefact and the explanation exists — it just lives in `C-20-address-autocomplete-plan.md:173`.
8. **Watch `notifications.ts` for the first time it is edited without an owner.** +185 in the last window, 1,467 lines, four plans deep, and C-16/C-17/C-18 are queued. Checkpoint #2's prediction about C-13/C-02/C-09 was overstated by a third; do not over-predict again — just measure the delta and whether any new logic was woven into an existing function's control flow rather than appended.
9. **F-1 protocol: keep snapshotting `git status --porcelain` at both ends**, but compare **`-- src/`** rather than the whole tree. The whole-tree comparison now produces a false positive every time, because this checkpoint's own companion lenses legitimately write evidence files while it runs.

---

*Checkpoint #3 formal, complete 2026-08-03 at HEAD `435472a`. Read-only: no source, test, config, migration or standing-state file was modified; this file is the only write. Git limited to `log`/`diff`/`show`/`status`/`grep`; one SELECT-only `execute_sql` privilege check. Checkpoint #4 due after plan #20 (C-23).*
