# C-C Execution Protocol — binding rules for every implementation session

**Audience:** the agent implementing Band C plans (any model, fresh session, ultracode/workflows enabled). This file is BINDING. If anything here conflicts with improvisation, this file wins. If reality conflicts with a plan, STOP (see the STOP rule below) — never improvise around a contradiction. Where Master Plan Part 0's static gate wording (e.g. "lint — 0 errors") conflicts with this file's baseline convention, THIS file is authoritative (red-team hardened 2026-07-26).

**The STOP rule (applies to every "STOP" in this file and in the plans):** post the finding in chat and do NO further plan work — including any next queued plan in an orchestrated/goal-mode run — until the Owner replies in chat. Writing a note to a file is NOT reporting. Same blocking semantics as a HARD-STOP, minus the per-action approval formality.

---

## 0 — Session bootstrap (every session, before ANY action)

Read, in this order — nothing else first:
1. This file, end to end.
2. `redesign/plans/C-phase/BAND-C-REFINEMENT-2026-07-26.md` — decisions D1–D26 (D17 unused), conventions, open items.
3. `redesign/plans/C-phase/BAND-C-MIGRATION-LEDGER.md` — if your plan carries a migration.
4. `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md` — Part 0 (operating discipline, incl. the **Login credentials table** used for all Playwright role-sweeps — never invent accounts) + your plan's checklist row.
5. Your assigned plan `redesign/plans/C-phase/<PLAN-ID>-*-plan.md` **and** its brief `redesign/briefs/<PLAN-ID>-*-brief.md` — end to end, before writing any code.

Do NOT read the audit corpus (`redesign/audits/**`) or other plans' bodies unless your plan's coordination notes direct you to a specific section.

**Session pre-flight (run and report before implementing):**
- `git branch --show-current` → `master`. `git merge-base --is-ancestor 7fe8b4f HEAD` → exit 0. Any drift → STOP.
- Prior-plan gate: for every dependency in your plan's header, `git log --oneline --grep="feat(redesign): <DEP-ID>"` returns its commits. Missing → STOP.
- **Owner-review gate:** the immediately-prior shipped plan's `redesign/per-page-progress/<PRIOR-ID>-progress.md` must contain a line beginning `Reviewed:` (the Owner adds it after their independent review). Absent → STOP and ask the Owner whether to proceed. (First plan of the programme: gate is N/A.)
- Run your plan's own §0 pre-flight EXACTLY as written. Any mismatch → STOP with the mismatch verbatim.
- **Baselines — identity, not counts.** Programme-start snapshot (verified 2026-07-26): tsc clean; build clean; vitest 6 failures in exactly ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1; lint 59 errors in exactly `design_handoff_area_pages/prototype/*.jsx` (55) + `src/features/booking/` (4). These SHIFT as plans land (C-06 is expected to fix the createBookingTransaction failure). Authority chain: compare your observed failure/error IDENTITIES against the list recorded in the immediately-prior shipped plan's progress file; fall back to this snapshot only for the first session. Record your observed list in your own progress file. A gate passes only if every present failure/error is on the inherited list — same total with a swapped-in new failure is a FAIL.

## 1 — Hard rules (violations are session-ending mistakes)

1. **One plan per session.** Implement ONLY `<PLAN-ID>`. Sole exception: C-17 + C-18 co-ship in one session (C-17 first).
2. **⛔ HARD-STOP blocks are absolute.** On reaching one: stop, present the exact action + SQL/change verbatim in chat, WAIT for explicit Owner approval. Per-action — never carried forward, never inferred. Triggers (each and every occurrence): `mcp__supabase__apply_migration`; **any data-mutating SQL (INSERT/UPDATE/DELETE) via `mcp__supabase__execute_sql` against the production project**; any production env-var change; any external-console action; **any Cloudflare Workers / `wrangler` production deploy (incl. cron-trigger activation for C-01/C-02/C-04a)**; any package install (`pnpm add`/`pnpm install <pkg>`, or `npx` fetching a package not already in the lockfile — routine `npx tsc --noEmit` is exempt and required).
3. **Backup precondition (once, before the programme's FIRST migration — C-06):** ⏸ ask the Owner to confirm either (a) a Supabase backup/PITR point exists, or (b) they explicitly accept applying without one (they have stated backup/DR is deferred — the choice is theirs, made in chat, recorded in the progress file). Do not apply C-06's migration without this exchange.
4. **⏸ STOP-AND-ASK gates:** ask the listed questions and wait. Never proceed on placeholder values.
5. **Git:** never push. Never `git add .` / `-A`. Never stash/restore/checkout to "clean" the tree — it is intentionally dirty (258 deletions under `.playwright-mcp/` + `design_handoff_public_pages/`, 3 untracked dirs). Stage explicitly by path, only files your plan touches. Commits: `feat(redesign): <PLAN-ID> <phase summary>` per the plan's cadence table; migrations: `chore(supabase): <PLAN-ID> migration applied <name>`.
6. **Files — two distinct cases:** (a) an unrelated issue you noticed that your plan does NOT need → log it in the progress file, do not fix, continue. (b) a change to any file OUTSIDE your plan's files-touched list that IS required for your plan to work → STOP (chat, blocking). There is no third option; never quietly widen scope.
7. **DO-NOT-TOUCH:** booking `9d55ce2a` (Badar — real customer); Owner account `rahmatherapy@outlook.com` in any email-test path; any client whose email isn't `*.example.test` or name isn't `Phase10*`/`Audit Test*`; `redesign/audits/**`; `C-B-DECISIONS.md`; RECON §5 untouchables (`reporting.ts` core exports, `dashboard-helpers.ts`, RBAC matrix, middleware, build configs) beyond your plan's explicit exceptions.
8. **Production DB is live.** Read-only `execute_sql` (project `twzutkfgqclqurvkmvqz`) is fine for verification. All writes go through rule 2. The availability engine + `/api/availability/month` serve the LIVE public customer calendar — every edit there is a production customer-surface change (C-23/C-14 carry specifics).
9. **Shared surfaces:** before editing `ManualBookingForm.tsx`, `notifications.ts` (`sendBookingCancellationEmails` region), `wrangler.jsonc`/`worker-entrypoint.ts`, `admin/bookings/page.tsx`, or `templates-data.ts` — re-run your plan's anchor greps; prior plans may have shifted positions. Re-locate by symbol, never by stale line number.
10. **VERIFY-ALREADY-IMPLEMENTED wrappers:** run the wrapper's verification; do NOT re-implement the preserved text beneath.
11. **Code discipline (master plan Part 0):** no `border-l-4`; honour `prefers-reduced-motion`; `updateTag(tag)` not `revalidateTag`; `createSupabaseAdminClient()` only after `getStaffProfile()`; **never pass `Set`/`Map`/`Date` through `unstable_cache` — JSON-safe types only (SHARED-NOTES §15)**; mobile-first (clean at 375px); match each file's existing style.
12. **Dev server:** Owner runs `pnpm dev` at `http://localhost:3000` (use `localhost`, not `127.0.0.1`). Curl to verify; never spawn or kill servers.

## 2 — Execution loop (per plan)

1. Bootstrap + pre-flight (§0). Report a 5-line readiness summary in chat, then begin.
2. Implement **phases strictly in plan order**; within a phase follow the steps as written (they carry verified paths, anchors, per-step verification). Run each step's verification before moving on.
3. **After every phase:** the plan's phase verify-checkpoint; `npx tsc --noEmit`; targeted vitest. Commit the phase per the cadence table — never batch phases into one commit.
4. **Workflows (ultracode):** use them for READ/VERIFY fan-outs — multi-role Playwright sweeps, cross-file audits, independent test authoring, adversarial review of a finished phase. Do NOT fan out parallel write-agents onto the same file or phase; sequential steps run in the main loop. Batches of 3–5 agents max (Owner is on Max 5x); agents persist outputs to files so a limit hit loses nothing.
5. **Full verification gate (plan §3) before declaring done** — every numbered item, with evidence. Screenshots/captures → `redesign/evidence/<PLAN-ID>/`. Role-sweeps use the master plan Part 0 credentials table.
6. **Completion bookkeeping:** write `redesign/per-page-progress/<PLAN-ID>-progress.md` — phases + commit SHAs, gate results, the observed baseline-identity list (§0), deviations (none, or listed), deferred notes, Owner actions outstanding. Flip the plan's master-plan checklist row → ✅ with the final SHA. Commit: `docs(redesign): <PLAN-ID> shipped — progress + checklist`.
7. **Closing chat report:** what shipped per phase; gate results (zero new failures by identity); migrations applied (names + post-apply verification output); anything the Owner must do; the next plan per §4. Then STOP — the Owner reviews and adds the `Reviewed:` line before the next session starts.

## 3 — Interruptions, limits, context

- Approaching a usage limit or context ceiling: finish the current coherent step; commit it (never half-applied edits across files); then write and COMMIT an interrupt checkpoint in the progress file — required fields: plan-id, phase #, step #, files mid-flight, last-good commit SHA, exact next action + anchor — as `docs(redesign): <PLAN-ID> interrupt checkpoint — phase X step Y`. Stop cleanly with a one-line resume instruction in chat.
- On resume: re-run §0 (cheap), read your own progress file, verify the last commit matches it, continue from the recorded step. Trust the progress file + git log over memory.
- Never mark a phase/gate done that didn't run. If a check can't run, say so and STOP.

## 4 — Implementation order (Owner-locked; one session each; Owner review between)

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
| 17 | C-17 + C-18 | ONE session, co-ship pair, C-17 then C-18 |
| 18 | C-19 | STOP-AND-ASK for 3 Owner copy inputs |
| 19 | C-20 | Dropdown-in-dialog spike first; key-rotation STOP-AND-ASK |
| 20 | C-23 | Before C-14 (both edit the live availability engine) |
| 21 | C-14 | Phase C migration = atomic co-deploy with its 3 code fixes (D12) |
| 22 | C-10 | LAST — overlap catalogue measures final page heights |

**Owner-review handshake:** after a plan's closing report, the Owner (with their review agent) reviews the work; on acceptance the Owner adds `Reviewed: <date>` to that plan's progress file. The next session's §0 gate checks for it.
