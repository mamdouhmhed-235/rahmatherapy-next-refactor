# HANDOFF — 2026-08-11 — post-Band-C implementation session

**Read this file first, end to end. Then `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` §0, §1, §10 and §11 before opening any item section.**

Nothing is mid-flight. No agent is running. Every change is committed. The tree is clean apart from the one standing dirty path (§6).

| | |
|---|---|
| **HEAD** | `fe58f9b` |
| **Branch** | `master` |
| **Band C** | ✅ COMPLETE — 23/23 |
| **Follow-up plan** | `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` — **3,537 lines, 8 items, 3 shipped** |
| **Shipped this session** | Item 7 **Phase 0** (complete), Item **3**, Item **6** |
| **Next** | Item **2** → Item **4** ⛔Zone-2 → Item **1** → Item 7 Phases A–B → Item **8** ⛔Zone-2 → Item 7 tail → Item **5** |
| **Deploy** | Still deferred. Live site runs OLDER code |

---

## 1 — What happened this session, in order

### 1a. The plan was deepened (`5a6cb78`, `3d5c0a6`)

1,265 → **3,537 lines**, by a 34-agent read-only verification pass (14 auditors → 10 adversaries → 10 drafters). **29 of the plan's own claims failed verification and were corrected in place**, each marked *(corrected 2026-08-11)*. Full audit trail: `redesign/evidence/plan-deepening/`.

Every item now carries: exact files **and symbols** (with re-locate-by-symbol instructions), full blast radius **plus** an explicit "proven NOT affected" list, `/booking/manage` checked by name, ordering/collision callouts, exact per-batch verification commands with which numbers must move and which must not, named tests each with a real file path, numbered stop conditions, and rollback.

### 1b. Item 7 Phase 0 — complete (9 commits, `8ab0e6d`..`bbb6a35`)

| Commit | What |
|---|---|
| `8ab0e6d` | **Parser fix** — `parseTokensCss` matched `@media print` from a prose comment 226 lines early, so it returned the **dark** block under the "print" label. The print block had never been verified by anything. `ratioCommentsFound` 14 → 11 |
| `be7740d` | **`--admin-warning`** #b77900 → **#986400** (3.41:1 → 4.72:1), in light **and** print |
| `153ae41` | **De-aliased 11 `:root`-only frozen tokens** across all four blocks — D1 cause 1, D9, D7's mechanism |
| `e267c8e` | **`findFrozenRootAliases`** regression guard |
| `0900613` | **Self-correction** — pinned the three notification-badge fills (see §5 gotcha 4) |
| `2a3bfcf` | Corrected **9 of 16** false prose contrast claims in `tokens.css` |
| `46f18cc` | The **A/B evidence** (see §3) |
| `ad0db14` | **Step 0.3** — scoped `site-parity.css`'s `a { color: inherit }` into `@layer base` |
| `bbb6a35` | Plan correction — Steps 0.1 and 0.3 are **not** independent |

### 1c. Item 3 (`5212bc4`) and Item 6 (`fe58f9b`)

- **Item 3** — added `.order("start_time", { ascending: true })` as the **second** key on all five override list queries. Both DESC queries keep date DESC with start_time ASC. `start_time` is `NOT NULL` on both tables, so no NULLS handling. Created `StaffAvailabilityOverridesManager.test.tsx`, which had **zero** coverage of any kind.
- **Item 6** — adjustment lists now count and cap by **DATE**. Row-fetch ceiling 800 → group by date in code → slice to N dates, in both trees (**duplicated, not shared** — deliberate). Includes the **saturation disclosure**: if the ceiling truncates, the total renders `30+`, never a bare `30`. 22 new tests.

---

## 2 — ⛔ THE GATE BASELINES HAVE MOVED. Use these, not the plan's §11 numbers.

The plan's §11 records the baselines as of the start of this session. **This session added tests, so `vitest` has legitimately moved.** The failure *identity* is unchanged.

```powershell
npx tsc --noEmit    # 0, silent, exit 0
npx vitest run      # 5 failed / 2274 passed (2279)   <-- was 2236/2241 in the plan
pnpm lint           # 59 errors / 7 warnings, the same six files
git status --porcelain -- src/ supabase/   # exactly:  M src/lib/maintenance.ts
```

**The five failures, by name — unchanged, and unrelated to every item in this plan:**
- `src/lib/auth/admin-access.test.ts` — *"gives Owner broad access while keeping owner-only role actions permission-gated"*, *"gives Admin broad operational access without role template management"*
- `src/app/admin/bookings/new/ManualBookingForm.test.tsx` — *"renders step 1 on first load"*, *"moves focus to the first invalid field when continuing with errors"*, *"shows the consent error when trying to create booking without consent"*

**A 6th failure** (`ManualBookingForm > optional email > "still rejects a malformed email…"`, 5000ms timeout) appears intermittently under full-suite load. **Do not report it as a regression** until you have run:
```powershell
npx vitest run src/app/admin/bookings/new/ManualBookingForm.test.tsx   # must be exactly 3 failed / 33 passed (36)
npx vitest run src/lib/auth/admin-access.test.ts                       # must be exactly 2 failed / 4 passed (6)
```

**Lint identity is keyed on the `{file, ruleId}` multiset with counts — NOT `file:line:column`.** Item 8 edits `BookingExperience.tsx` and `BookingExperienceLoader.tsx`, and its own specified edits *guarantee* the pre-existing errors' line numbers move. Per-file: `area-page.jsx` 48E/1W · `shared.jsx` 2E/5W · `site-chrome.jsx` 5E/0W · `BookingExperience.tsx` 3E · `BookingExperienceLoader.tsx` 1E · `returning-customer.ts` 0E/1W.

**Contrast layers:**
```powershell
node scripts/measure-admin-contrast.mjs .      # 456 failures (377 dark / 79 light) — Phase 0 removed NO literals, this is correct
node scripts/verify-admin-token-contrast.mjs   # 0 failures, 11 ratio comments
```
Layer 3 (live sweep) last read **2,151** (dark 798 / light 1,353) — but see §3, that number is perishable.

---

## 3 — ⛔ THE LAYER 3 BASELINE IS PERISHABLE. Always A/B on the same day.

The single most important methodology finding of this session.

The naive before/after after the de-alias showed light-mode contrast **+367 — an apparent regression**. It was half illusory. Re-running the *pre-change* `tokens.css` against *the same day's data* gave:

| | dark | light | all |
|---|---:|---:|---:|
| **A** old tokens, 2026-08-10 (the stored 2,615 baseline) | 1,433 | 1,180 | 2,615 |
| **C** old tokens, **today** (control) | 1,431 | 1,363 | 2,796 |
| **B** de-alias only, today | 844 | 1,547 | 2,391 |
| **D** + Step 0.3, today | **798** | **1,353** | **2,151** |

**Data drift alone (A→C) moved light by +183 with NO code change.** Phase 0's true effect (C→D) is **dark −633 (−44%), light −10, total −645 (−23%)**.

**Rule for the next agent: never compare a Layer 3 run against a stored baseline from another day.** Re-run the control. The procedure that works, without `git stash` (forbidden):
1. `cp` the current file to the scratchpad; `git show <sha>:<path> > scratchpad/old.css`
2. `cp` old into place, hit a page to force recompile, run the sweep, capture
3. `cp` the saved current file back; verify with `git diff --stat -- <path>` showing nothing

Also: **`e2e/admin-contrast-helpers.ts` persists only the 15 worst findings per role/theme** (`.slice(0, 15)`), so a full per-finding diff is not recoverable from the artefacts — only per-route counts and the worst 15.

---

## 4 — Every Owner decision. Do NOT re-ask any of these.

**From the previous session (13)** — see `redesign/HANDOFF-2026-08-11-PLANNING.md` §4. Highlights: Maps cookie label stays `purpose:"essential"`; mileage is **manual**, never automated; `allowed_cities` inverts to a free-travel zone; fee locked once completed or fully paid (cancelled **not** locked); free-travel list keeps a minimum of one entry; series-level control lives on the series page.

**Made this session (5), all folded into the plan at §0.0a:**

| # | Decision | Answer |
|---|---|---|
| 1 | Privacy section 6 — rewrite or delete? | **Rewrite. Keep it general. Promise nothing the website does not actually do.** The delete-and-renumber path (§2.3) is closed |
| 2 | The analytics-retention sentence in section 6 | **Keep it, unedited** |
| 3 | Quiet hours on the new manual review-request send | **Exempt by design**, matching the existing manual resend path. Accepted consequence: a permitted staff member can trigger a customer email at 2am |
| 4 | HTML form field `name="allowed_cities"` | **Rename it** with the column, for consistency. Contained to 3 files Phase 1 already edits — `SettingsForm.tsx`, `settings/actions.ts`, and `updateBusinessSettings.test.ts` (that test edit is **required**, not optional) |
| 5 | Two ordering changes | **Sanctioned** — item 7's Phase B splits so its five item-8-shared files land after item 8; item 5 moves to last |

*Decision 4 was answered as "as you suggest" where no explicit recommendation had been given; it was recorded as **rename** on the Owner's stated rationale of consistency, and is a three-line revert if that reading was wrong.*

---

## 5 — GOTCHAS. Every one of these cost real time in this session.

Read these **in addition to** `HANDOFF-2026-08-11-PLANNING.md` §5, which still applies in full.

1. **⛔ Agents may NEVER enter a credential.** Does not lift when offered. The Playwright harness authenticates via `getCredentials(prefix)` reading env vars; agents reference the prefix only.
2. **The dev server is Owner-run** at `localhost:3000` (not `127.0.0.1`). Never spawn/restart/kill it. It was down mid-session and the correct move was to **stop and ask**, which is what the plan requires.
3. **Git Bash rewrites bare leading-slash arguments** into Windows paths. **Quoting does NOT fix it** — tested and disproved. `MSYS_NO_PATHCONV=1` does. **Prefer PowerShell.** Only `CONTRAST_ROUTES` self-heals (`resolveRouteFilter`, commit `2903108`).
4. **⚠️ WHEN TWO DERIVATION AGENTS DISAGREE, COMPUTE THE OUTCOME — do not pick the more confident one.** This produced the session's one real regression: two agents disagreed about the `--notif-badge-*-bg` tokens; the naive "track the target" table was applied and made dark mode far worse (5.60→2.26, 3.65→1.65, 6.97→1.90 against white text), because `--admin-danger/-warning/-info` are *foreground* colours and are **light** in dark mode, while the badge is a *fill*. Caught only by computing the after-state. Fixed in `0900613`.
5. **⚠️ TEETH-CHECK EVERY GUARD TEST against the pre-fix state.** My own `site-parity-anchor-scope` test had a regex anchored on the preceding `}`, counting one brace level too many — it would have **passed on the unfixed file**. Caught by running its logic against `git show HEAD:<path>`. A guard that cannot fail is worse than no guard.
6. **Python `str.count`/`replace` is SUBSTRING matching, not line matching.** `"  pastTotal,"` matched twice because `"    pastTotal,"` (4-space indent) contains it. **Anchor replacements with surrounding newlines** and assert `count == 1` before writing. Every edit script in this session asserted first — that is why nothing was silently corrupted.
7. **Most source files here are CRLF.** Split on `"\n"` keeps a trailing `"\r"` on each line; strip it for comparison and re-add it when writing, or your assertion fails (which is the safe outcome — it did, and nothing was written).
8. **A subagent can return a stub JSON while still having written a good report.** One agent returned `{"task":"test","deliverable":"test deliverable"}` but had written a complete 30KB report to disk. **Check the evidence file before concluding an agent failed.**
9. **`parseTokensCss`'s `DECL_RE` is `--admin-*` only** — it is structurally blind to the entire `--notif-*` family (6 tokens). Any guard built on it silently misses them. `findFrozenRootAliases` uses its own `--(admin|notif)-` regex for exactly this reason.
10. **`checkPairs()` only iterates dark and light — never print.** Extending it would break two existing passing assertions (`pairChecksRun === pairs.length * 2`) and needs a curated print-relevant pair list. The print block is verified by a dedicated test instead.
11. **Both contrast scripts exit `0` regardless of failures** unless `--max-failures=N` is passed. A bare run gates nothing.
12. **Bracket paths** (`src/app/admin/staff/[staffId]/…`) miscount under raw shell glob — 26 vs the true 23. Count with ripgrep / the Grep tool.
13. **`npx tsc --noEmit` writes a gitignored `tsconfig.tsbuildinfo`** at the repo root. Never stage it.
14. **`redesign/**` is excluded from lint** (`eslint.config.mjs` `globalIgnores`), so evidence files cannot pollute the lint baseline. Files written **anywhere else** still can.
15. **Plan text is a CLAIM, not a fact.** 29 of its claims failed verification in the deepening pass, and item 6's own §6.5.3 was found incomplete *during implementation* (see §7 below). Assume there is another.

---

## 6 — Standing facts

- **Tree is intentionally dirty**: `git status --porcelain -- src/ supabase/` must show exactly ` M src/lib/maintenance.ts`. Untracked `design_handoff_area_pages/`, `photos-rahma-therapy/`, `test-results/`, `redesign/evidence/C-21/*.png` are pre-existing and not yours. **Never `git add .`/`-A`; never stash/checkout/restore to "clean" it.**
- **`src/lib/maintenance.ts`: working copy `false`, HEAD `true`.** Never stage, commit or revert it. For deployed behaviour read `git show HEAD:<path>`.
- **Zone-2** = migrations, any data-mutating SQL, deploys, package installs, env changes, real emails. **Owner-approved per action, orchestrator-performed, never delegated to a subagent.** `mcp__supabase__execute_sql` is SELECT-only, project `twzutkfgqclqurvkmvqz`.
- **Migration filenames**: `YYYYMMDDHHMMSS_<slug>.sql`; newest existing is `20260809160000_c14_override_breaks.sql`. Check `Get-ChildItem supabase/migrations | Select-Object -Last 3` first and space new files ≥60s apart, in apply order.
- **Playwright**: `node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/<spec>.spec.ts --project=chromium`. (`.env.e2e` and `node_modules/playwright/cli.js` do **not** exist — `.env.example` still carries both stale errors; that is a known separate follow-up.) `e2e/admin-contrast.spec.ts` pins `channel: "chrome"` deliberately — **keep the pin**.
- **DO-NOT-TOUCH**: booking `9d55ce2a` (real customer); `redesign/audits/**`; `C-B-DECISIONS.md`; the Owner account in email-test paths.
- **Business reality that should govern effort**: 12 real bookings, all Luton. 6 therapists who claim jobs voluntarily; **no pay/rate/payout table exists anywhere**.
- **Test conventions**: components → sibling `<Name>.test.tsx`; page/data/action modules → `__tests__/<name>.test.ts`. Mailer mocked at `@/lib/email/client`. Supabase → mock the **factory**. RBAC → `vi.mock(..., importOriginal)` so the **real** permission logic runs. **Zero snapshot files repo-wide.** Zero tests under `src/app/(public)/**` or `src/components/ui/**`.

---

## 7 — What is left, in the order to do it (plan §10.3)

### NEXT: Item 2 — privacy retention copy *(small, no Zone-2)*
- **Decisions 1 and 2 above are already made.** Rewrite section 6 criteria-based; keep the analytics sentence; **do not renumber anything**.
- **§2.1's original claim "Nothing in the codebase deletes anything" is FALSE** and already corrected: 17 `.delete()` sites exist including a wired GDPR-erasure path (`deleteClient()`). The true claim is narrower — **nothing deletes by AGE**. The new copy must not imply scheduled or automatic deletion.
- **There are no tests for this page or any public page.** The plan names a new file `src/app/(public)/privacy/page.test.tsx` with 5 cases, including one guarding the analytics sentence (no grep can catch its silent deletion) and one guarding contiguous heading numbering.
- Also bump the hardcoded `LAST_UPDATED` constant in that file.

### Item 4 — `bookings` indexes ⛔ **ZONE-2 — HARD STOP**
Write the migration file and **stop**. Present the exact SQL in chat, wait for the Owner's approval, then the orchestrator applies it. 4 × `CREATE INDEX IF NOT EXISTS`; **no `CONCURRENTLY`** (it cannot run in a transaction block). Live pre-state: `bookings` has exactly 3 indexes and 15 rows. Post-apply: `pg_indexes` must show **7**, row count unchanged. Rollback = `DROP INDEX` ×4. Note `status` appears in **6** distinct predicate sites, not the 12 the plan originally claimed.

### Item 1 — review emails
- `resendDeliveryEvent` **does not exist**; the function to mirror is **`resendEmail`** (`src/app/admin/emails/actions.ts:120`).
- "Place it beside `ReminderResendForm`, only for completed bookings" is **unbuildable** — that list is filtered to `status IN ('pending','confirmed')`. A **new query in `emails-data.ts` and a new tab/subsection** are required.
- `src/app/admin/emails/format.ts`'s `DELIVERY_STATUSES` is **not** a valid source of truth (5 values nothing writes, 4 real ones missing). Use the DB CHECK constraint.
- Quiet hours: **exempt** (decision 3).
- ⚠️ **Highest-risk rule in the plan: never send a real email.** Verify with the SELECT-only bounded query in §11.7; pass condition is **0**, not "0 except test addresses".

### Item 7 Phases A–B, then Item 8, then Item 7's tail, then Item 5
- Workstream 2's true size is **717 occurrences across 102 files** (677/99 is admin-only; the three shared primitives add 40/3).
- **`badge.tsx` has exactly ONE importer in the whole repo — `src/app/booking/manage/page.tsx`.** Zero admin exposure. Editing it is pure customer-page risk with no admin payoff.
- **Item 7's five item-8-shared files must land AFTER item 8**: `SettingsForm.tsx`, `BookingManagementForm.tsx`, `bookings/[bookingId]/page.tsx`, `ManualBookingForm.tsx`, `SeriesActions.tsx`.
- **Item 8 needs 6 migrations**, not the 4 originally claimed. Its Phase 3 and Phase 5's chip-gating **must ship together** — otherwise an admin can quick-confirm an out-of-zone booking at £0 and the fee locks permanently once completed or paid. That is a **stop condition**, not a note.
- **Still outstanding from Phase 0**: Step 0.5's tooling half — extending the verifier to *parse* prose ratio claims. The claims themselves are all verified and 9 corrected by hand.

---

## 8 — What must NOT happen next

- **No `git add .`/`-A`**, no stashing, no "cleaning" the tree.
- **No migrations, data writes, deploys, package installs or real emails** without per-action Owner approval.
- **No credential entry**, ever, by any agent.
- **Do not rebuild the three contrast verification layers** — they exist and work.
- **Do not "fix" `create_recurring_booking_series`'s missing city check** — its absence is deliberate and documented.
- **Do not fix the four pre-existing lint errors** in `BookingExperience.tsx` / `BookingExperienceLoader.tsx` as a drive-by. It would change the very baseline the gate checks.
- **Do not compare a Layer 3 sweep against a stored baseline from another day** (§3).
- **Do not start implementing from an item section alone** — read §1, §10 and §11 of the plan first.
