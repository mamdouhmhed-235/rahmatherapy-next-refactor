# C-C Execution Protocol — binding rules for the implementation run

**Audience:** the ORCHESTRATOR agent implementing ALL Band C plans in one continuous session (ultracode/workflows enabled), and every subagent it dispatches. This file is BINDING for both. If anything here conflicts with improvisation, this file wins. If reality contradicts a plan, STOP — never improvise around a contradiction. Where Master Plan Part 0's static gate wording (e.g. "lint — 0 errors") conflicts with this file's baseline convention, THIS file is authoritative.

**The STOP rule (every "STOP" in this file and the plans):** post the finding in chat and do NO further programme work — not the next step, phase, or plan — until the Owner replies in chat. Writing a note to a file is NOT reporting. Same blocking semantics as a HARD-STOP, minus the per-action approval formality.

**Execution model (Owner-locked 2026-07-26):** ONE orchestrating session runs the whole programme, plans strictly sequential in §4 order, phases strictly sequential within a plan. The orchestrator's main loop NEVER implements code itself — it reads plans, dispatches implementer/verifier subagents, enforces gates, handles HARD-STOPs with the Owner, commits Zone-2 actions after approval, and reports. Implementation happens inside subagent contexts that are disposed after returning summaries — this is what keeps a 23-plan run inside one session. Durable state lives in git + progress files, never in conversational memory.

---

## 0 — Programme bootstrap (once, before anything)

Read, in this order:
1. This file, end to end.
2. `redesign/plans/C-phase/BAND-C-REFINEMENT-2026-07-26.md` — decisions D1–D26 (D17 unused), conventions, open items.
3. `redesign/plans/C-phase/BAND-C-MIGRATION-LEDGER.md` — the migration sequence + per-migration verification SQL.
4. `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md` — Part 0 (operating discipline, incl. the **Login credentials table** for all Playwright role-sweeps — never invent accounts).

Do NOT read all 23 plans up front — read each plan + brief when its turn starts (§2.1). Never read `redesign/audits/**` or other plans' bodies unless a coordination note directs you to a specific section.

**Programme pre-flight (run once, report in chat):**
- `git branch --show-current` → `master`; `git merge-base --is-ancestor 7fe8b4f HEAD` → exit 0. Drift → STOP.
- Dev server: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200 (the Owner runs `pnpm dev`; use `localhost`, never `127.0.0.1`; never spawn or kill servers). Not running → ask the Owner to start it.
- **Baselines — identity, not counts.** Programme-start snapshot (verified 2026-07-26): tsc clean; build clean; vitest 6 failures in exactly ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1; lint 59 errors in exactly `design_handoff_area_pages/prototype/*.jsx` (55) + `src/features/booking/` (4). Re-run all four now and confirm identity match; record the list. These SHIFT as plans land (C-06 is expected to fix the createBookingTransaction failure) — after each plan, the updated identity list recorded in its progress file becomes the inherited baseline for the next. A gate passes only if every present failure/error is on the inherited list — same totals with a swapped-in new failure is a FAIL. **Precedence rule:** baseline numbers/names hardcoded inside any plan's own §0/§3 text are a frozen plan-writing-time snapshot — from plan #2 onward they are ALWAYS superseded by the current inherited identity list; never diff live results against a plan's stale hardcoded copy. **Expected shrinkage:** when a plan names a baseline entry it expects to fix (e.g. C-06 → createBookingTransaction), confirming that entry's REMOVAL from the inherited list is an explicit closeout exit-criterion for that plan, not just folded into "no new entries".

## 1 — Hard rules (bind the orchestrator AND every subagent; violations are run-ending)

1. **Sequence is law.** Plans in §4 order, one at a time; phases in plan order, one at a time. NEVER two write-tasks in flight at once anywhere in the programme — parallelism is for read/verify work only.
2. **⛔ HARD-STOP blocks are absolute and orchestrator-owned.** Implementer subagents NEVER perform HARD-STOP actions — on reaching one they stop and return to the orchestrator. The orchestrator presents the exact action + SQL/change verbatim in chat and WAITS for the Owner's explicit approval, then performs the action itself. Per-action — never carried forward, never inferred. Triggers (every occurrence): `mcp__supabase__apply_migration`; **any data-mutating SQL (INSERT/UPDATE/DELETE) via `mcp__supabase__execute_sql` against the production project**; any production env-var change; any external-console action; **any Cloudflare Workers / `wrangler` production deploy (incl. cron-trigger activation for C-01/C-02/C-04a)**; any package install (`pnpm add`/`pnpm install <pkg>`, or `npx` fetching a package absent from the lockfile — routine `npx tsc --noEmit` is exempt and required); **any write to `auth.users`**; and — effect-based catch-all — **any action through ANY path (cron route, admin UI via Playwright, server action, curl) that sends a real email/notification to a recipient outside the `*.example.test` convention**. Subagents hold `execute_sql` for SELECT-only verification; every dispatch states "SELECT-only — any INSERT/UPDATE/DELETE/DDL is forbidden and run-ending", and the orchestrator scans returned summaries for SQL use.
3. **Backup precondition (once, before the programme's FIRST migration — C-06):** ⏸ ask the Owner to confirm either (a) a Supabase backup/PITR point exists, or (b) they explicitly accept applying without one (backup/DR is Owner-deferred; the choice is theirs, made in chat, recorded in the progress file). No C-06 migration without this exchange.
4. **⏸ STOP-AND-ASK gates:** ask the listed questions in chat and wait. Never proceed on placeholder values.
5. **Git:** never push. Never `git add .` / `-A`. Never stash/restore/checkout to "clean" the tree — it is intentionally dirty (258 deletions under `.playwright-mcp/` + `design_handoff_public_pages/`, 3 untracked dirs). Stage explicitly by path, only files the current plan touches. Commits: `feat(redesign): <PLAN-ID> <phase summary>` per each plan's cadence table; migrations: `chore(supabase): <PLAN-ID> migration applied <name>`; bookkeeping: `docs(redesign): <PLAN-ID> shipped — progress + checklist`.
6. **Files — two distinct cases:** (a) an unrelated issue noticed that the current plan does NOT need → log in the progress file, do not fix, continue. (b) a change to any file OUTSIDE the current plan's files-touched list that IS required for the plan to work → STOP (chat, blocking). No third option; never quietly widen scope.
7. **DO-NOT-TOUCH:** booking `9d55ce2a` (Badar — real customer); Owner account `rahmatherapy@outlook.com` in any email-test path; any client whose email isn't `*.example.test` or name isn't `Phase10*`/`Audit Test*`; `redesign/audits/**`; `C-B-DECISIONS.md`; RECON §5 untouchables (`reporting.ts` core exports, `dashboard-helpers.ts`, RBAC matrix, middleware, build configs) beyond a plan's explicit exceptions.
8. **Production DB is live.** Read-only `execute_sql` (project `twzutkfgqclqurvkmvqz`) is fine for verification. All writes go through rule 2. The availability engine + `/api/availability/month` serve the LIVE public customer calendar — every edit there is a production customer-surface change (C-23/C-14 carry specifics).
9. **Shared surfaces:** before editing `ManualBookingForm.tsx`, `notifications.ts` (`sendBookingCancellationEmails` region), `wrangler.jsonc`/`worker-entrypoint.ts`, `admin/bookings/page.tsx`, or `templates-data.ts` — re-run the plan's anchor greps; earlier plans in this run may have shifted positions. Re-locate by symbol, never by stale line number.
10. **VERIFY-ALREADY-IMPLEMENTED wrappers:** run the wrapper's verification; do NOT re-implement the preserved text beneath.
11. **Code discipline (master plan Part 0):** no `border-l-4`; honour `prefers-reduced-motion`; `updateTag(tag)` not `revalidateTag`; `createSupabaseAdminClient()` only after `getStaffProfile()`; **never pass `Set`/`Map`/`Date` through `unstable_cache` — JSON-safe types only (SHARED-NOTES §15)**; mobile-first (clean at 375px); match each file's existing style.
12. **Never mark a phase/gate done that didn't run.** If a check can't run, say so and STOP.

## 2 — Orchestration loop (per plan, strictly in §4 order)

1. **Plan start:** read the plan + brief end to end (orchestrator). Run the plan's §0 pre-flight exactly (read-only checks may be delegated to one read-only agent). Verify dependency commits: `git log --oneline --grep="feat(redesign): <DEP-ID>"` per the plan header. Post a 3-line plan-start note in chat. Any mismatch → STOP.
2. **Per phase — implement:** dispatch ONE implementer subagent **on the model §5's routing table assigns for this plan** with: (a) the paths of this protocol, the plan, and the brief, **plus the Part 0 login-credentials table verbatim** (plans embed mid-phase authenticated Playwright checks; never invent accounts); (b) the phase/steps assigned; (c) the CURRENT inherited baseline identity list (supersedes any baseline text inside the plan — say so explicitly); (d) instructions to **first read this protocol file in full — §1 binds every subagent — then** its assigned plan sections, implement the steps EXACTLY as written, run each step's verification, stage by explicit path and commit per the plan's cadence table, and return a compact summary: files touched, commit SHAs, verification outputs, deviations (must be none) or the exact blocker; (e) the SELECT-only SQL restriction (rule 2). Implementer agents write code and tests ONLY — on hitting any rule-2 trigger or STOP condition they halt and return.
3. **Per phase — verify:** dispatch ONE verifier subagent (read-only): checks the phase's diff against the plan step-by-step; runs `npx tsc --noEmit` + targeted vitest + the phase's verify-checkpoint; confirms baseline identity (no new failures vs the inherited list); confirms `git status --porcelain` shows nothing staged/modified outside the plan's files (pre-existing dirt excluded); **confirms every ⛔/⏸ marker in this phase's plan text was genuinely paused-on-and-answered in chat OR is absent from the diff — never silently implemented with placeholder/assumed values**. "Read-only" means: no writes anywhere, and git limited to `log`/`diff`/`show`/`status` — `checkout`/`stash`/`switch`/`restore` are forbidden (shared working tree). PASS → next phase. FAIL → one fix round (implementer agent with the verifier's findings), re-verify; still failing → STOP with both reports.
4. **Zone-2 steps:** the orchestrator raises the HARD-STOP in chat (exact SQL/action verbatim), waits, then executes the approved action itself, runs the plan's post-apply verification, posts the output, and commits per convention.
5. **Plan closeout:** run the plan's full §3 verification gate — parallel READ-ONLY verification agents are encouraged (role sweeps with the Part 0 credentials, multi-viewport checks), batches of 3–5, **each writing to a unique prescribed filename** (`redesign/evidence/<PLAN-ID>/role-sweep-<role>.md`, `viewport-<breakpoint>.png`, etc. — never generic names that siblings could clobber); the read-only git restriction (§2.3) binds every one of them. Then one adversarial reviewer agent sweeps the plan's whole diff (`git diff <sha-before-plan>..HEAD`) against the plan for scope creep, lost steps, or style drift — findings → fix round, then **the reviewer (or a fresh verifier) re-checks the fixed findings before anything is marked done**; still failing → STOP. Then: write `redesign/per-page-progress/<PLAN-ID>-progress.md` (phases + SHAs, gate results, **updated baseline identity list incl. confirmed expected-shrinkage removals**, deviations, deferred notes, outstanding Owner actions); flip the plan's master-plan checklist row → ✅ with the final SHA; commit bookkeeping; post a compact closing report in chat. Proceed to the next plan without waiting for sign-off — **but every ⛔/⏸ inside the next plan binds afresh on its own read; momentum never carries an approval forward** — the Owner reviews the full programme at the end and may interject at any time.
6. **Programme drift checkpoint (after plans #5, #10, #15, #20):** one adversarial reviewer diffs the FULL range since programme start (`git diff <programme-start-sha>..HEAD --stat` + targeted reads) against Part 0 conventions and the baseline-gate history, hunting cross-plan drift no single-plan review can see (token misuse creeping across files, copied deviations becoming patterns, baseline erosion, **and style/idiom divergence between Sonnet-implemented and Opus-implemented plans — §5**). Findings → fix round or STOP.
7. **Context hygiene:** after each closeout, carry forward ONLY: next plan id, inherited baseline list, open Owner items, last commit SHA, programme-start SHA. Everything else is in git + progress files. If the session compacts, that is safe by design.
8. **Medium-throughput mode (Owner-requested 2026-07-31 — speed WITHOUT touching accuracy/security):** the following parallelism is permitted, and ONLY the following. (a) Read-only fan-outs (closeout gates, seam/drift reviews, pre-flight checks) may batch up to 6–8 agents, unique output filenames, read-only git rules unchanged. (b) Within a single phase, up to TWO implementer subagents may run concurrently IF their step assignments touch provably disjoint file sets (e.g. a component and its separate test file, or two independent sweeps) — each stages only its own paths, the orchestrator commits per the cadence after both return, and any doubt about overlap means serialize. (c) While plan N's closeout verification agents run, the orchestrator may do READ-ONLY preparation of plan N+1 (read its plan + brief, run read-only pre-flight checks) — no plan N+1 implementation until plan N's closeout passes. STILL FORBIDDEN, exactly as before: overlapping write-phases, write parallelism across plans, starting phase N+1 implementation before phase N's verify passes, and any relaxation of verification, HARD-STOP, or isolation rules in the name of speed.

## 3 — Interruptions, limits, resume

- Approaching a usage limit or context ceiling: let the in-flight subagent finish its current coherent step and commit; then write and COMMIT an interrupt checkpoint into the current plan's progress file — required fields: plan-id, phase #, step #, files mid-flight, last-good commit SHA, exact next action + anchor — as `docs(redesign): <PLAN-ID> interrupt checkpoint — phase X step Y`. Stop cleanly with a one-line resume instruction in chat.
- On resume (fresh or compacted context): re-run §0 bootstrap; find the LATEST progress file (`git log --oneline --grep="interrupt checkpoint"` and `--grep="shipped"` establish position in §4); verify **the checkpoint commit's PARENT equals the last-good commit SHA recorded in the checkpoint's fields**; pull the inherited baseline list from the latest progress file (never from §0's programme-start snapshot); continue from the recorded step. Trust progress files + git log over memory. All rules apply unchanged.
- **Ungraceful loss (crash/kill mid-step — no checkpoint written):** before dispatching anything, run `git status --porcelain -- <current plan's touched paths>`. Non-empty = uncommitted in-flight work: inspect the diff and EITHER resume from it (treat it as true in-progress state, complete the step, commit) OR explicitly discard it (`git checkout -- <exact paths>`, decision + reason logged in the progress file). Never dispatch an implementer onto a dirty plan-scope tree without resolving it first.

## 3b — Standing programme state (added 2026-07-28; read at §0 bootstrap, before touching anything)

These are programme-wide and outlive any one plan. Plan-specific detail stays in progress files; this is only what would otherwise be lost between sessions or, worse, actively misread.

**⚠️ `src/lib/maintenance.ts` is DELIBERATELY DIRTY. Do not resolve it.**
`MAINTENANCE_MODE = false` in the working copy under a standing Owner authorisation, for the **entire programme**. It is **never staged and never committed** (last commit touching it is `35bf817`, pre-programme). Without the flip, `(public)/layout.tsx` does not mount the booking experience, which blocks browser verification for C-22, C-17 Phase B, C-20 and C-14 Phase D.
**§3's ungraceful-loss rule does NOT apply to this file.** A resuming agent that finds it modified must neither resume from it nor `git checkout --` it. Leave it exactly as it is.
**It MUST be restored to `true` before any deploy, and the final report must state its state.**

**Pre-flight addition — check table privileges before the first write of a kind.**
When a plan adds the **first** `UPDATE`, `DELETE` or upsert against a table, run `has_table_privilege('service_role', '<table>', 'UPDATE')` before implementing. This project grants **explicitly per table**; the Supabase blanket `grant all` default is **not** in effect. tsc, lint and vitest are all blind to a missing GRANT, and this codebase's habit of discarding the `error` from a Supabase call makes the failure silent at runtime.
C-04a lost a full verification cycle to exactly this: `service_role` had no `UPDATE` on `email_delivery_events`, so all three of its UPDATEs were 42501s and the cron would have reported `200 {sent:0, failures:[]}` — indistinguishable from healthy — while no customer ever received a cancellation email. Note also that `ON CONFLICT DO UPDATE` requires `UPDATE` privilege **whether or not a conflict occurs**.
Still lacking `service_role` UPDATE: `blocked_dates`, `insight_dismissals`, `staff_availability_rules`, `staff_blocked_dates`, `staff_permission_overrides`. (`audit_logs` and `permissions` are correctly restricted.) **Logged, not fixed:** `staff_permission_overrides` breaks its upsert in `admin/staff/actions.ts` for this reason; Owner scoped the C-04a grant to `email_delivery_events` only.

**⛔ The Cloudflare deploy is three-in-one.** Its approval text must say all three: it applies **C-22's `RateLimiter` Durable Object migration**; it activates the **`* * * * *` cron**; and since C-04a Phase H it is the **only thing that drains the cancellation-email queue** — deploy the code without the cron trigger and no customer receives a cancellation email at all. Code and trigger ship together (the trigger lives in `wrangler.jsonc`), so there is no gap provided the deploy happens.

**Owner cannot be substituted for on two things.** The agent may not authenticate (entering passwords is prohibited), so any plan step requiring admin sign-in — Playwright role sweeps, most manual UI checkpoints — is **Owner-performed by necessity**, not deferred by choice. Write the checklist into the progress file and hand it over; do not record such a step as "pending" as though an agent could later run it. Likewise all Zone-2 actions are orchestrator-only under per-action Owner approval, never a subagent.

**DO-NOT-TOUCH:** booking `9d55ce2a-7a76-42ed-9166-a33fa66ee7fe` — a real customer with a real email address. Never reference it in a fixture, never act on it, exclude it explicitly in any backfill.

**The working tree is touched by an external process.** Files under `Desktop\` have been observed rewritten mid-task with identical mtimes (OneDrive sync, or a concurrent session). A single-instant working-tree read is not fully trustworthy: anchor findings to committed blobs (`git show <sha>:<path>`), re-read before concluding a change vanished, and verify any byte-copy restore by hash. `core.autocrlf` is `true`, so never round-trip a file through `git show` to restore it.

## 4 — Implementation order (Owner-locked; strictly sequential)

| # | Plan | Notes |
|---|---|---|
| 1 | C-21 | Smallest; 1 commit; SEO fix compounds while unfixed |
| 2 | C-22 | Small; includes availability-API rate limiting (D23) |
| 3 | C-06 | Main chain start — backup precondition (§1.3) fires here |
| 4 | C-04a | Before C-05 (Restore is C-05's escape hatch) |
| 5 | C-05 | Hard-gated on C-06's migration being live |
| 6 | C-01 | Cron dispatch: order-agnostic pattern (D3) |
| 7 | C-FIELDWORK | Before C-11 |
| 8 | C-11 | Admin-wide dark mode — admin-SCOPED tokens only |
| 9 | C-08 | Run the `resend_booking_emails` permission spot-check first (ledger) |
| 10 | C-15 | After C-08; before C-13/C-02 |
| 11 | C-13 | |
| 12 | C-02 | Gated on C-01 + C-08 commits existing |
| 13 | C-09 | Tag sweep covers all prior plans' new actions |
| 14 | C-03 | |
| 15 | C-07 | |
| 16 | C-16 | Hard-before C-10 |
| 17 | C-17 then C-18 | Co-ship pair, back to back — "back to back" means no context reset between them, NOT a merged closeout: each gets its own pre-flight, phase loop, closeout gate, adversarial diff review, and progress file |
| 18 | C-19 | STOP-AND-ASK for 3 Owner copy inputs |
| 19 | C-20 | Dropdown-in-dialog spike first; key-rotation STOP-AND-ASK |
| 20 | C-23 | Before C-14 (both edit the live availability engine) |
| 21 | C-14 | Phase C migration = atomic co-deploy with its 3 code fixes (D12) |
| 22 | C-10 | LAST — overlap catalogue measures final page heights |

**Programme completion:** all 22 rows ✅ in the master-plan checklist; final consolidated report in chat (per-plan commits, all gate results, migrations applied, Owner-action list). The Owner then runs their independent end-of-programme review.

## 5 — Model routing (Owner-locked, 2026-07-28)

**Session model: Opus 5** (Owner decision 2026-07-30, for the continuation from plan #8 onward; the Owner sets it via `/model` before issuing the goal — the first 7 plans shipped under a Sonnet orchestrator). **Because the session model is Opus, inheritance means Opus — EVERY dispatched agent MUST carry an explicit `model` parameter; never rely on inheritance.** Belt-and-braces: the Owner may set `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` so any accidentally-unpinned agent defaults to Sonnet; the table's explicit `opus` pins override it.

**Routing table (explicit `model` on every dispatch):**
- **Implementer agents `model: opus`** for exactly these plans: **C-06** (RPC rewrite + highest-blast-radius migration), **C-04a** (largest plan; cron/delayed-email infrastructure), **C-11** (system-wide theming; public-flip risk lives here), **C-02** (greenfield schema + 2 RPCs + horizon cron), **C-23** (live public availability engine), **C-14** (live engine + atomic co-deploy migration).
- **Implementer agents `model: sonnet`** for all other plans: C-21, C-22, C-05, C-01, C-FIELDWORK, C-08, C-15, C-13, C-09, C-03, C-07, C-16, C-17, C-18, C-19, C-20, C-10.
- **All phase verifiers and closeout adversarial reviewers: `model: sonnet`, high effort** (they judge against plan text, not from taste — Sonnet keeps the check cheap and independent).
- **The 4 programme drift checkpoints (§2.6): `model: opus`** — programme-wide judgment, 4 total, worth the spend.

**Phase-level granularity (2026-07-30 — "each model gets its relevant tasks"):** Sonnet is the DEFAULT worker everywhere; Opus is the exception, never the habit. Within an `opus`-routed plan, phases that are purely mechanical — sweeps, file extractions, evidence collection, test-file authoring, copy application — MAY be dispatched on `sonnet`; any phase touching a migration, a live surface (availability engine, public routes, email sends), schema/RPC work, shared-surface edits, or the plan's headline complexity STAYS on `opus`. When in doubt, keep the routed model. Log every within-plan downgrade in the progress file (phase, reason). The inverse is not discretionary: a Sonnet-routed plan's phases stay Sonnet — hard cases are handled by the escalation rule below, not by pre-emptive upgrades.

**Escalation rule (self-healing):** if a Sonnet-implemented phase fails its verify round twice, re-dispatch that ONE phase's implementer on `opus` with both failure reports attached, re-verify; still failing → STOP. Log every escalation in the progress file (plan, phase, reason).

**De-escalation ban:** never downgrade a routed-`opus` plan to Sonnet to conserve usage — the routing is Owner-locked; usage pressure is handled by §3 (checkpoint + resume), never by weakening the model on a hard plan.

**Cross-model consistency:** the same protocol + plan text binds every model; rule 11's match-existing-style requirement normalizes output; verifiers are model-blind (they compare diff to plan); §2.6's drift checkpoints explicitly watch for Sonnet/Opus idiom divergence.
