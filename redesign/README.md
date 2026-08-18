# `redesign/` — what is live, what is history

**Current position:** `HANDOFF-2026-08-17-IMPLEMENTATION-10.md`. Read it first, end to end.
Everything else here is **history** unless listed below. Documents stamped
*"⛔ HISTORICAL"* must not be acted on — some contain runnable commands for retired programmes.

**Also live:** `plans/SEO-AEO-GEO-2026-08-13-plan.md` and `plans/SEO-AEO-GEO-IMPLEMENTATION.md` ·
`per-page-progress/OWNER-ACTION-BACKLOG.md` (open items) · `per-page-deferrals/` (14 commitments
still open in today's code) · `plans/C-phase/C-C-EXECUTION-PROTOCOL.md` (binding per `AGENTS.md`).

**Testing:** `PRODUCTION-READINESS-BASELINE-2026-08-17.md` — the measured gate baselines, what test
infrastructure exists, and an honest map of what is **not** covered. Read it before planning any
testing work.

## ⛔ Before deleting or moving anything in here

Run **both** citation checks from the repo root — they cover different directions and neither
subsumes the other:

```bash
bash extract-doc-citations.sh | awk -F'\t' 'NR>1 && $4=="DANGLING"'   # code → doc
bash extract-doc-doc-citations.sh                                     # doc → doc (set-diff it)
```

Paths in here are cited from source comments, **SQL migration comments**, and other documents.
The doc→doc check has ~336 pre-existing dangling entries, so it passes on a **set difference**
against a captured baseline — never on zero.

## ⛔ Three things that will mislead you

1. **Citation count is not a protection signal.** The 26 per-page recipes share ~1 MB of identical
   boilerplate that name-drops most top-level docs, so a 368-byte file scores 115 "citations".
   Judge by *who* cites, not how many.
2. **`evidence/admin-contrast/` is a live write target** — `e2e/admin-contrast-helpers.ts` writes
   there on every `pnpm test:e2e`. It is not an archive.
3. **`baselines/bundle-pre-B1.json` is read at runtime** by `scripts/measure-admin-bundles.mjs`, and
   it is `existsSync`-guarded — deleting it does not error, it **silently** disables the
   bundle-regression check. ⚠️ Note `baselines/` (plural, keep) is a different directory from
   `baseline/` (singular, deleted 2026-08-17).

Full audit and reasoning: `declutter-2026-08-17/` and `plans/DECLUTTER-2026-08-17-plan.md`.
