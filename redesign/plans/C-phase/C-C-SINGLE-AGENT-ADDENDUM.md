# C-C Single-Agent Addendum — binding adaptation for harnesses WITHOUT subagents (Codex etc.)

**Read `C-C-EXECUTION-PROTOCOL.md` FIRST — it remains binding in full.** This addendum adapts it for a single-agent executor (no subagents, no workflows, one model doing everything). Where the two conflict on execution mechanics, THIS file wins. Everything else — the STOP rule, §0 bootstrap + baselines-by-identity, §1 hard rules, §3 interruptions/resume, §4 order — applies unchanged and verbatim.

## A1 — Execution loop (replaces protocol §2)

You are implementer AND verifier. The independent-verification layer is gone — it is compensated by mechanical gates and disciplined self-review, never by confidence.

Per plan (strictly in §4 order): read the plan + brief end to end; run its §0 pre-flight exactly; report a plan-start note in chat. Then per phase:
1. Re-read the phase's plan section immediately before implementing (never from memory).
2. Implement the steps EXACTLY as written; run each step's inline verification before the next step.
3. **Self-verify as a separate, mandatory pass:** run `git diff` for the phase and review it line-by-line against the plan text as if auditing a stranger's work — every changed line traces to a named plan step; zero files outside the plan's files-touched list (`git status --porcelain` scoped check; the Owner's `src/lib/maintenance.ts` modification and the documented pre-existing dirt are excluded); `npx tsc --noEmit` clean; targeted vitest green; lint/vitest baseline check BY IDENTITY vs the inherited list (protocol §0 — from the latest shipped plan's progress file, never a plan's hardcoded text); every ⛔/⏸ in the phase was genuinely paused-on in chat, never satisfied with an assumed value.
4. Commit per the plan's cadence table, staged by explicit path. Never batch phases.

Plan closeout: run the plan's full §3 verification gate item by item with evidence (→ `redesign/evidence/<PLAN-ID>/`, unique filenames); then a whole-plan diff self-review (`git diff <sha-before-plan>..HEAD`) hunting scope creep, missed steps, style drift; then progress file + master-plan checklist row ✅ + bookkeeping commit + compact chat report; then the next plan.

## A2 — Model routing (protocol §5): VOID

One model executes everything; the routing table, escalation rule, and Sonnet/Opus split do not apply. The **programme drift checkpoints survive** (§2.6 — after plans #10, #15, #20, full-range self-review vs Part 0 conventions). **Additionally, the post-plan-#5 drift review was never run by the prior harness — it is OVERDUE and must be the first action of the takeover session** (review the full `feat(redesign)` range shipped so far — 7 plans — before starting C-11): this is the seam-check between the previous model's work and yours; report findings in chat before writing any code.

## A3 — Tooling substitutions (when a tool the protocol/plans assume is unavailable)

- **Database (Supabase MCP absent):** NEVER reach the production DB by improvised means. Read-only pre-flight queries: if you have no sanctioned read path, ask the Owner in chat to run the query (they have the Supabase dashboard) and paste the result. Migrations/data writes: unchanged HARD-STOP flow, but the APPLY step becomes — present the exact SQL in chat; the Owner applies it in the Supabase dashboard SQL editor; the Owner pastes the post-apply verification query output back; only then does the plan proceed. Record migration name + verification output in the progress file as usual.
- **Browser verification (Playwright/browser tooling absent or different):** use whatever browser automation the harness provides; if none, list the exact URLs, roles (Part 0 credentials), viewports, and expected observations in chat and ask the Owner to perform + confirm each. A gate item is only "passed" when its evidence exists — never silently downgrade a check because tooling is missing; say so and ⏸ ask.
- **Anything else missing:** same principle — STOP-AND-ASK with the concrete substitute you propose; the Owner decides.

## A4 — Continuity

Protocol §3 applies verbatim (graceful interrupt checkpoints committed to the progress file; resume via git log + progress files; ungraceful-loss rule for uncommitted plan-scope work). One model change note: on ANY takeover by a different model/harness, the first action is the A2 seam review.

## A5 — Verified position at addendum time (2026-07-29 — re-verify from git, which always wins)

SHIPPED (7): C-21, C-22, C-06, C-04a, C-05, C-01, C-FIELDWORK — closeouts complete, HEAD `ba6caf3`. Migrations applied: c06_client_crud_hardening, c04a_scheduled_emails, c01_review_email_infrastructure. Remaining (15, in order): **C-11 → C-08 → C-15 → C-13 → C-02 → C-09 → C-03 → C-07 → C-16 → C-17+C-18 → C-19 → C-20 → C-23 → C-14 → C-10.** Owner-owned uncommitted change: `src/lib/maintenance.ts` (MAINTENANCE_MODE=false) — never stage/commit/revert it; excluded from all isolation checks.
