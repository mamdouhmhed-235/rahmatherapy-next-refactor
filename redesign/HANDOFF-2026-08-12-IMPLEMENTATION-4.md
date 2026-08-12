# HANDOFF — 2026-08-12 (fourth implementation session)

**Read this file first, end to end.** Then `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md`
§0.0a, §0.0b, §0.0c, §1, §10 and §11 before opening any item section.

The four earlier handoffs are still live and are **not** superseded:
- `HANDOFF-2026-08-11-PLANNING.md` §5 — gotchas 1-19.
- `HANDOFF-2026-08-11-IMPLEMENTATION.md` §5 — gotchas 1-15.
- `HANDOFF-2026-08-11-IMPLEMENTATION-2.md` §5 — gotchas 16-27.
- `HANDOFF-2026-08-12-IMPLEMENTATION-3.md` §5 — gotchas 28-41.

This file adds §5's **new** gotchas 42-53. Nothing is mid-flight. No agent is running.
Every change is committed. The tree is clean apart from the one standing dirty path.

| | |
|---|---|
| **HEAD** | `4f23ccd` |
| **Branch** | `master` |
| **Shipped this session** | Item 1 **COMPLETE** (Batch B + Step 1e) · item 5 **COMPLETE** · Step 0.5 **COMPLETE** · item 7 Phases B(part)+C |
| **Next** | **Item 7's tail only** — ~33 distinct colours needing new token pairs, then Phase D |
| **Deploy** | Still deferred, **to the very end of the plan, by Owner decision** |

**SEVEN OF EIGHT ITEMS ARE DONE.** Items 1, 2, 3, 4, 5, 6, 8 are complete. Only item 7
remains, and only its judgement-requiring tail.

---

## 1 — What happened this session, in order

| Commit | What |
|---|---|
| `f7a8ccd` | **Item 1 Batch B.** Manual review-request send on a NEW "Review requests" tab at `/admin/emails`. New `getReviewRequestCandidates` export, new `sendManualReviewRequest` action, new `ReviewRequestButton`, `review_email_sent` registered in the audit `ACTIONS` map. 20 tests, 17/17 mutants |
| `bb2379c` | **Item 7 Phase B, the provably-safe half.** 549 frozen literals → tokens across 94 files. Layer 1 dark 377→97, light **unchanged at 79** |
| `4fa5266` | **Item 7 Phase C.** The oklch ratchet guard + `scripts/admin-oklch-ceiling.json`. 3/3 mutants |
| `829522e` | **Step 0.5 tooling half.** Prose contrast claims harvested and reported |
| `9130ccc` | **Item 1 Step 1e.** Review copy varied by client class. 10 tests, 5/5 mutants. **ITEM 1 COMPLETE** |
| `52bac46` | **Item 5.** Route auto-discovery (6 → 32 routes) + argv filter + re-baseline against a fresh build. **ITEM 5 COMPLETE** |
| `0348cb7` | **Item 7, role half.** 28 error borders → `--admin-status-cancelled-text` |
| `55f3efd` | `dispatchResend` refuses review-request resends with a reason instead of the raw event type |
| `4f23ccd` | **Item 7.** `--admin-warning-solid` / `-hover` minted in all four blocks; the 3 Override buttons now invert |

---

## 2 — ⛔ GATE BASELINES. Use these, not any earlier file's numbers.

```powershell
npx tsc --noEmit    # 0, silent, exit 0
npx vitest run      # 5 failed / 2393 passed (2398)   <-- was 2352/2357 at session start
pnpm lint           # 59 errors / 7 warnings, the same six files
git status --porcelain -- src/ supabase/   # exactly:  M src/lib/maintenance.ts
```

**The five failures are unchanged and unrelated to every item.** Isolation, per §11.2:

```powershell
npx vitest run src/app/admin/bookings/new/ManualBookingForm.test.tsx   # exactly 3 failed / 33 passed (36)
npx vitest run src/lib/auth/admin-access.test.ts                       # exactly 2 failed / 4 passed (6)
```

**+41 tests added this session**, all passing. **26 mutants teeth-checked**; 23 HAS_TEETH on
the first pass, **1 found toothless and rewritten** (gotcha 44), and **2 anchors found
ambiguous rather than missing** (gotcha 43).

**The documented 6th flake never appeared once**, across ~10 full-suite runs including runs
under heavy concurrent agent load. Do not conclude it is gone; it is intermittent.

### Contrast layers — current readings

```powershell
node scripts/measure-admin-contrast.mjs .      # 170 failures (91 dark / 79 light), 240 unresolved
node scripts/verify-admin-token-contrast.mjs   # 0 failures
npx vitest run scripts/admin-oklch-ceiling.test.ts   # 4 passed
```

**⛔ LIGHT HAS BEEN EXACTLY 79 THROUGHOUT, ACROSS ALL 583 SUBSTITUTIONS.** That is the
control. If a future batch moves it, a substitution was mis-mapped — stop.

---

## 3 — Live database state after this session

**Unchanged. This session applied NO migrations and made NO data writes.** Every DB
interaction was SELECT-only against `twzutkfgqclqurvkmvqz`.

| Object | State |
|---|---|
| `email_delivery_events` | **43 rows**, latest `2026-07-29`. `event_type='review_request_client'` = **1** |
| `bookings` | 15 rows; 2 completed, **both already carry `review_email_sent_at`** |
| Manual-send eligible | **0 rows** — the new Review requests tab renders its empty state against live data |

**Zero real emails proof** (plan §11.7), run-window start `2026-08-12 09:33:35.349436+00`:

```sql
SELECT count(*) FROM public.email_delivery_events WHERE created_at > '<start>'::timestamptz;
-- 0
```

---

## 4 — Owner decisions this session

| # | Decision | Answer |
|---|---|---|
| 17 | Step 1e's three sentences of customer copy | **Approved as drafted.** `first_time` "We hope this was the first visit of many." · `returning` "It's good to have you back with us." · `series` "Thank you for keeping us part of your routine." **Changing any of these needs fresh sign-off, not a judgement call.** |
| 18 | Item 5's one sanctioned `pnpm build` | **Approved and run.** Owner restarted the dev server afterwards. `BUILD_ID klyIaTbt2NPXZNWL01xKf` |
| 19 | Item 7's remaining 168 literals | **Both halves, two commits** — role-disagreement sites first, then new token pairs |
| 20 | `dispatchResend`'s missing `review_request_client` case | **Fix it.** Owner chose "call sendReviewRequestEmail"; implementation analysis showed that would misreport (gotcha 53), so the **clean refusal** was implemented instead and the reasoning recorded at the call site and in `55f3efd` |

---

## 5 — NEW GOTCHAS (42-53). Each cost real time this session.

42. **⛔ The Edit tool converted `emails-data.ts` wholesale from CRLF to LF.** Three files
    ended LF while their neighbours stayed CRLF. `core.autocrlf=true` means git normalises
    on commit, so **the diff stays clean and this is cosmetic** — but a mutation harness
    with hard-coded `\n` anchors then matches **zero occurrences** in the CRLF files and
    reports a confident "ANCHOR NOT UNIQUE (0)". Always try both EOL forms of an anchor.

43. **⛔ A MISSING ANCHOR AND AN AMBIGUOUS ANCHOR LOOK IDENTICAL IF YOU ONLY REPORT ZERO.**
    Two Batch B mutants reported "found 0". The truth was the opposite: my new H11
    scope-check block and my new rate-limit block are **byte-identical** to the ones in
    `sendManualBookingReminder` and `resendEmail`, so each anchor occurred **twice**, and
    the harness's "exactly one" test failed on the LF form and never reported the CRLF
    count of 2. Report the count you actually found, in both EOL forms, before concluding
    anything. Mutating the wrong copy of an identical block silently proves nothing.

44. **⛔ A PERMISSION TEST CAN PASS BECAUSE A DIFFERENT GUARD REFUSED FIRST.** My "refuses
    without `resend_booking_emails`" test passed with the permission gate **deleted** —
    the fixture also lacked `VIEW_BOOKINGS_ALL`, so the H11 scope check refused before
    execution ever reached the gate under test. **Give the fixture every permission EXCEPT
    the one being tested**, and assert the exact error string so the refusal's *source* is
    pinned. Found only by mutation. This is the third session running in which a guard
    asserted something adjacent to the real thing.

45. **⛔ `describeAction`'s FALLBACK FAMILY IS ALREADY `operations_and_email`.** So
    `expect(describeAction("x").family).toBe("operations_and_email")` passes whether or not
    `x` is registered in `ACTIONS`. The assertions with teeth are `ACTION_TYPES_BY_FAMILY`
    membership (the fallback never adds to that map), the curated `phrase`, and the `chip`
    (fallback gives `"none"`). A derivation agent proposed exactly the toothless version.

46. **⚠️ DO NOT RUN ADVERSARIAL CRITICS AGAINST A TREE YOU ARE CONCURRENTLY EDITING.** I
    spawned critics pre-implementation and then started editing while they ran. One spent
    its entire budget reporting, as a "blocker", that the working tree was changing under
    it — which was true, and my fault. **Sequence: derive → implement → critique the
    finished diff.** The re-run against the real diff found a genuine defect immediately.

47. **⛔ COLOUR EQUALITY IS NOT SUFFICIENT FOR A SAFE TOKEN SUBSTITUTION — THE ROLE MUST
    MATCH TOO.** The Phase B script gates every substitution on the Tailwind utility prefix
    agreeing with the token's role suffix, and **that check earned its place immediately**:
    `bg-[oklch(99.5%_0.003_88)]` matches `--admin-on-primary` exactly, but that token stays
    near-white in dark mode by design, so substituting it as a *background* renders a
    near-white panel in dark mode — a NEW defect introduced by the sweep meant to FIX dark
    mode. 36 sites disagreed and were skipped rather than guessed at. A blind global
    replace ships that bug.

48. **`escapeHtml` emits `&#039;` — zero-padded, three digits.** A copy assertion on any
    approved sentence containing an apostrophe ("It's good to have you back") fails against
    the raw string on the HTML leg only. Decode entities before comparing, and cover
    `&#039;` as well as `&#39;`.

49. **⛔ A CONDITIONAL IN A TEMPLATE LITERAL MUST EMIT NOTHING IN ITS ABSENT BRANCH — NOT
    EVEN AN INDENT.** My first Step 1e render left `\n      ` behind when there was no
    class line, and `registry-defaults.test.ts`'s render-parity fixture failed instantly.
    That guard is load-bearing and it works; respect it rather than re-capturing the
    baseline.

50. **⛔ PROSE CONTRAST CLAIMS ARE NOT MACHINE-PAIRABLE, AND TRYING FABRICATES FAILURES.**
    My first Step 0.5 parser paired "the two resolvable tokens in this comment" and reported
    a confident MISMATCH with a +4.43 delta against `tokens.css:378-382` — which states a
    ratio for `--admin-primary` against the **panel** while also naming
    `--admin-on-primary`. It picked the wrong two tokens and would have broken Layer 2's
    zero-failure gate on a fabrication. **Only an explicitly written `A vs B` / `A on B`
    is safe to check.** 38 prose claims exist; **zero** are safely pairable. They are
    enumerated with reasons instead — which is what the plan actually asked for.

51. **⛔ C-20's +3 kB AND C-23's +6 kB CEILINGS ARE PERMANENTLY UN-EVALUABLE.**
    `redesign/baselines/bundle-pre-B1.json` contains exactly four routes —
    `/admin/dashboard`, `/admin/reports`, `/admin/clients/[clientId]`,
    `/admin/staff/[staffId]` — and `/admin/bookings/new`, the route C-20's ceiling is
    about, is **not one of them**. The blocker was never the stale `.next/` or the
    hardcoded route list; both are now fixed and it changed nothing. Evaluating those
    ceilings needs a pre-change baseline for that route, which no longer exists to capture.
    **Stop re-opening this.**

52. **⚠️ `--admin-on-primary` FLIPS.** It is near-white in light mode and near-black
    (`oklch(18% 0.012 88)`) in dark. `tokens.css` says so explicitly. This means a solid
    fill token paired with it inverts *together* — the fill lightens as the label darkens.
    Get this backwards and a button's label vanishes into it.

53. **⛔ ROUTING `review_request_client` TO `sendReviewRequestEmail` FROM `dispatchResend`
    REPORTS SUCCESS WHILE SENDING NOTHING.** A delivery row of that type only exists
    because a review already went out, so the per-booking `review_email_sent_at` sentinel
    refuses — and `dispatchResend` returns `void`, so the refusal is invisible. `resendEmail`
    then finds the ORIGINAL row, stamps resend metadata on it, and returns `ok: true`. The
    shipped behaviour is a **clean refusal**. If one-per-booking ever changes, this needs a
    genuine second-send path, not a call to the sentinel-guarded one.

**Also re-confirmed:** PowerShell's working directory persists between tool calls and
drifted again mid-session — this time into `redesign/evidence/...`, which made a `Read`
of a relative path fail confusingly. `Set-Location` to the repo root before trusting
anything, and prefer absolute paths in `Read`/`Glob`.

---

## 6 — Plan claims that FAILED verification this session

Add these to the 29 from the deepening pass, the 6 from the second session, and the 9 from
the third.

| Where | Claim | Truth |
|---|---|---|
| §1.7 vs §1.8 | The manual-send candidate list | **The plan contradicts itself.** §1.7 says "completed + recipient + no `review_email_sent_at`"; §1.8's file table says "completed, recipient-present, **not-yet-cooled-down**". §1.8 is wrong: hiding cooled-down clients makes `ignoreClientCooldown: true` dead code for every row the list can show. Built to §1.7 |
| §1.6 vs §1.11 | Step 1e's seam | **The plan contradicts itself again.** §1.6 calls `pickReviewMessages` "the natural seam"; §1.11's Batch B gate requires `pickReviewMessages.test.ts` untouched by item 1. Taking §1.6 literally would also grow the registry 10 → 30 fields and **orphan every admin override already saved under `massage_variant_N`**. Built as a separate class-keyed field; `pickReviewMessages` untouched |
| §1.7/§1.12 | New action records a `failed_resend_attempt` operational event | **Deviated deliberately.** That name is resend-specific and already means something else; reusing it conflates two refusals in the operations event-type filter. Used `failed_review_request_attempt`, matching this file's own `failed_reminder_attempt` precedent |
| §1.8/§3050 | `describeAction` at `:100-110` | **`:105-115`.** Item 8's own 5-line `ACTIONS` addition pushed it down |
| §1.11 | "Before: 12 tests / 6 tests" | **Stale, pre-Batch-A.** `sendReviewRequestEmail.test.ts` had **23**; `review-emails.test.ts` had **11** |
| §7.6 | "717 occurrences / 102 files / 94 distinct" | Occurrences 717 correct; **103 files, 96 distinct**. `ManualBookingForm.tsx` is **78**, not 79. Top-10 sum **481**, not 483 |
| §7.8 | Flip the Phase C guard "to zero-tolerance on completion" | **Unreachable.** 14 occurrences across 8 files are runtime-computed hues (`oklch(88% 0.025 ${hue})`, one colour per person via `hueFromId`). A token is one fixed value; these vary per row. §7 never mentions them. The guard allowlists them by count AND by file |
| §7.5b Step 0.5 | "16 prose contrast claims", verify them all | **38 exist**, and **none** is safely machine-pairable — see gotcha 50 |
| §13 | "whether C-20's +3 kB and C-23's +6 kB ceilings can finally be evaluated" | **They cannot, ever** — gotcha 51 |
| §7.7a | Capture `/booking/manage` in both themes as a control before editing any primitive | **Satisfied by a stronger proof, not a screenshot** (a visual capture needs a login no agent may perform). `data-theme` is set by exactly one file (admin's `ThemeProvider`); nothing under `booking/` or `(public)/` sets it, so those tokens resolve from `:root` there — and **all 26 tokens** the three primitives reference have byte-identical `:root` and `[data-theme="light"]` values. The page renders the same bytes as before |

---

## 7 — What is left, in order

### ✅ ITEMS 1, 2, 3, 4, 5, 6, 8 ARE ALL COMPLETE. Do not reopen any of them.

In particular: **item 1 is now finished** (Batch A + Batch B + Step 1e). The three Step 1e
sentences are **Owner-approved and test-guarded**
(`src/lib/email/__tests__/review-class-line.test.ts`) — changing any of them needs fresh
sign-off. **Item 5 is finished**; do not run another `pnpm build` without asking.

### 1. NEXT — Item 7's tail *(the only remaining work)*

**Current census: 134 occurrences = 120 static + 14 computed-hue.**
Ceiling lives in `scripts/admin-oklch-ceiling.json` (`staticCeiling: 120`). **The ratchet
FAILS if you remove literals without lowering it** — that is deliberate, so a stale ceiling
cannot become a rubber stamp.

**What remains:**
- **~33 distinct colours with no reasonable token**, needing new pairs.
- **4 role-disagreement sites**: 2 surfaces (`bg-[oklch(99.5%_0.003_88)]` ×2) and 2 fills
  (`bg-[oklch(88%_0.055_155)]` ×2), all in `clients/[clientId]/page.tsx`. Both want tokens
  with honest names rather than a foreground token used as a fill.
- **14 computed-hue occurrences** — DONE, allowlisted, not fixable.

**The method that works, with `4f23ccd` as the worked example:**
1. Mint the pair in **all four blocks** — `:root`, `[data-theme="dark"]`,
   `[data-theme="light"]` AND `@media print`. A token missing from print silently falls
   back to the browser default.
2. **Light value byte-identical to the literal** it replaces, so light mode cannot move.
3. **Dark value mirroring the nearest existing family's inversion shape.** For a solid fill
   paired with `--admin-on-primary`, remember gotcha 52 — the fill lightens as the label
   darkens, and hover goes *further* in that direction.
4. Add a **measured ratio comment**; Layer 2 re-derives it independently and will catch a
   wrong number (it confirmed both of mine to −0.00).
5. Re-run: light must stay **79**, `unresolvedElements` must not rise above **240**
   (§7.7b hard stop), Layer 2 must stay **0**.

⛔ **Do not rebuild the three contrast verification layers** — they exist and work.
⛔ **Never compare a Layer 3 sweep against a stored baseline from another day.**

### 2. Item 7 Phase D — the Layer 3 sweep

```powershell
node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts --project=chromium
```
Needs real credentials. **Orchestrator/Owner work, never a subagent's.** It writes
`redesign/evidence/admin-contrast/<ROLE>-<theme>.md` (tracked) plus untracked
`test-results/`.

### 3. ⛔ THE DEPLOY, then Step Z — LAST

`ALTER TABLE public.business_settings DROP COLUMN allowed_cities;` **and** delete the
dual-write line in `settings/actions.ts`. Its entire safety argument is that it runs after
the deploy. **Do not schedule it earlier as a tidy-up.** Zero database objects reference
`allowed_cities`; the dual-write is the only consumer left.

---

## 8 — Standing facts (unchanged, restated so this file stands alone)

- **Tree is intentionally dirty**: `git status --porcelain -- src/ supabase/` must show
  exactly ` M src/lib/maintenance.ts` (working copy `false`, HEAD `true`). Untracked
  `design_handoff_area_pages/`, `photos-rahma-therapy/` and `redesign/evidence/C-21/*.png`
  are also expected. **Never `git add .`/`-A`; never stash/checkout to "clean" it.**
- **Zone-2** = migrations, data-mutating SQL, deploys, package installs, env changes, real
  emails. **Owner-approved per action, orchestrator-performed, never delegated.**
  `mcp__supabase__execute_sql` is SELECT-only, project `twzutkfgqclqurvkmvqz`.
- **⛔ Never send a real email.** `src/lib/email/client.ts`'s `sendEmail` is an unguarded
  wrapper over the real Resend SDK and `RESEND_API_KEY` is live here. Mock either
  `@/lib/email/client` or the whole of `@/lib/email/notifications` — there is no third
  option. Prefer the `importOriginal`-spread shape plus a `client.ts` mock as defence in
  depth (`review-emails.test.ts` is the model).
- **Dev server is Owner-run** at `localhost:3000` (not `127.0.0.1`). Never spawn, restart or
  kill it. It currently serves the `.next/` written by item 5's build; the Owner restarted it.
- **Do not "fix" the four pre-existing lint errors** in `BookingExperience{,Loader}.tsx`.
- **Commit messages**: PowerShell here-strings strip double quotes — always
  `git commit -F <scratchpad file>`.
- **Teeth-check every guard** by mutating the source, running, restoring, and asserting the
  restore is byte-identical — and read gotchas 42-44 first, because the harness itself has
  three failure modes that look like passes.
- **Business reality that should govern effort**: 15 bookings, all Luton. 6 therapists.
  The manual review-send list is currently **empty** against live data, by design.

---

## 9 — Method that worked, and is worth repeating

**Compute the mapping, do not have an agent guess it.** Item 7's literal→token mapping is a
deterministic function of `tokens.css`, so it was written as a script that reuses the
SHIPPED `parseTokensCss`/`resolveColour` rather than reimplementing colour maths. It
classified all 96 distinct literals in seconds, exactly, and its role-agreement check caught
a defect no reviewer would have (gotcha 47). **Where the answer is computable, compute it.**

**Let the critic finish, and critique the finished diff.** The re-run against the real
implementation found the send-before-sentinel race in minutes. The pre-implementation run
against a moving tree found nothing but the moving tree (gotcha 46).

**When an approved instruction turns out to be wrong, say so and implement the correct
thing.** Owner decision 20 approved wiring `dispatchResend` to `sendReviewRequestEmail`;
analysis showed that reports success while sending nothing (gotcha 53). The refusal was
implemented instead, with the reasoning recorded at the call site, in the commit, and here.

**Prefer a proof to a screenshot where one exists.** `/booking/manage` was proven unchanged
by showing that all 26 tokens its primitives reference have identical `:root` and light
values — stronger than a visual diff, and obtainable without a login.

---

## 10 — Known-but-not-fixed, recorded deliberately

- **⛔ Double-send race on review requests.** `sendReviewRequestEmail` sends first
  (`notifications.ts:1596`) and writes the `review_email_sent_at` sentinel afterwards
  (`:1615`), so two *simultaneous* callers both read a null sentinel and both send. Its own
  comments already acknowledge this ("the email may have been double-sent"); the cron has
  carried it since C-01. Batch B narrows the window (a 60s rate limit, a confirm modal, a
  button disabled for the transition) but does not close it.
  **⛔ Do NOT "fix" it by moving the sentinel write ahead of the send** — that turns a rare
  duplicate email into a booking permanently retired with no email ever sent whenever the
  transport fails, which is the exact failure §1.4 names as the easiest mistake in this item.
  Closing it properly needs a serialization point (a partial unique index or an advisory
  lock keyed on `booking_id`). **Its own item.**
- **Audit-log insert failures are silently ignored** after a successful send. Pre-existing
  convention across all three sibling call sites in `admin/emails/actions.ts`
  (`manual_booking_reminder_sent`, `email_resent`, and now `review_email_sent`). Changing it
  means changing all three.
- **15-19 audit `action_type` strings are written but unregistered** in `audit/format.ts` —
  `booking_restored`, `recurring_series_extended`, `email_resent`, `customer_*` and others.
  Each is invisible to the audit timeline's family filter. Full list in
  `redesign/evidence/post-band-c-impl/item-1/B2-audit-format-current.md` §5. Item 8 added
  exactly one new type and registered it correctly; none of the gaps trace to item 8.
- **`getReviewRequestCandidates` over-fetches ×2 and filters in JS**, so a page where more
  than half the completed bookings have no email on file yields a SHORT list — never a wrong
  one. Disclosed in-source and guarded by a source-text test so the multiplier cannot be
  silently dropped to ×1.
- **The reminders/review H11 scope block caps `booking_assignments` at `.limit(200)`.**
  Inherited verbatim so the two scoping paths cannot drift. A therapist past 200 lifetime
  assignments would see a short list. Pre-existing; raising it is a shared-behaviour change.
- **`e2e/booking-public.spec.ts:7`'s test name** is still slightly misleading. Cosmetic.
