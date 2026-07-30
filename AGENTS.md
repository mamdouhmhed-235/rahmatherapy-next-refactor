# Agent instructions — Rahma Therapy repo

This repository is mid-way through the **Band C implementation programme**. If you are working on ANY implementation task here, the following are BINDING before any action:

1. Read `redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md` end to end (hard rules, plan order, baselines, STOP semantics).
2. If your harness has no subagents/workflows: also read `redesign/plans/C-phase/C-C-SINGLE-AGENT-ADDENDUM.md` — it adapts the execution loop and tooling and records the current programme position.
3. Position of record is git (`git log --oneline --grep="shipped"`, `--grep="feat(redesign):"`) + `redesign/per-page-progress/` — never memory or assumptions.

Non-negotiables even for one-off tasks: never `git push`; never `git add .`/`-A`; never stash/restore/checkout to "clean" the intentionally-dirty working tree; never touch `src/lib/maintenance.ts` (Owner-owned uncommitted change), `redesign/audits/**`, `C-B-DECISIONS.md`, or live customer data (booking `9d55ce2a`, any client not matching `*.example.test` / `Phase10*` / `Audit Test*`); the production Supabase DB and the public availability endpoints are LIVE customer surfaces — all DB writes require the Owner's explicit per-action approval in chat (⛔ HARD-STOP flow in the protocol).
