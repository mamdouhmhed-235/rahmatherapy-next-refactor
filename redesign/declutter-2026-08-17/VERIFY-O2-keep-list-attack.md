# VERIFY O2 — attack on the KEEP list

**Date:** 2026-08-17 · **Mandate:** test the protection verdicts nobody had ever tested.
V1 stated explicitly it had not audited the KEEP list. This closes that gap.

⛔ **Three central claims independently re-verified by the orchestrator before acceptance.**

---

## 1 — ⛔ The `AGENTS.md` misreading

**`redesign/per-page-progress/` is NOT on `AGENTS.md`'s never-touch list.**

The never-touch list is the "Non-negotiables" paragraph, and it names exactly:
`src/lib/maintenance.ts` · `redesign/audits/**` · `C-B-DECISIONS.md` · live customer data.

Item 3 separately says *"Position of record is git … + `redesign/per-page-progress/`"* — **a factual
claim about where truth lives, not a prohibition.** A3 promoted a statement of fact into a
directory-wide deletion veto covering 57 files.

**And the factual claim is now stale:**

| Evidence | Finding |
|---|---|
| `git log -- AGENTS.md` | Last edited **2026-07-30**, mid-Band-C |
| `AGENTS.md:3` | "mid-way through the Band C implementation programme" — Band C closed **2026-08-09** (`33f895f`) |
| ⛔ `AGENTS.md` non-negotiables | "never touch `src/lib/maintenance.ts`" — **that file does not exist**, deleted by `3eb2939`. A named clause is provably obsolete: **`AGENTS.md` is not maintained** |
| `git log -- redesign/per-page-progress/` | Frozen since **2026-08-09**; ~20 commits shipped after |
| `git grep 'per-page-progress'` in HANDOFF-9 / both SEO docs / POST-BAND-C-FOLLOWUP | ⛔ **Zero hits.** The current governing documents never mention it |

**Verdict: the clause is a fossil; the directory is not.** `OWNER-ACTION-BACKLOG.md` (2026-08-09) is
an unambiguously live punch-list with open ⬜ rows, pointing at 17 named C-xx progress files. Seven
lines of live `src/` cite the directory. **The 31 Band-C files are alive on merit; the 25 Phase-6
page-progress files inherit no protection from either source.**

---

## 2 — ⛔ The Phase-6 execution cluster: 88 files, 2.51 MiB, ARCHIVE-INTERNAL

**Members:** `per-page-recipes/` (26) · `per-page-scope/` (29) · `phase6-admin-workflow-guide.html`
(926 KiB) · seven hub docs (246 KiB) · 25 Phase-6 page-progress files.
*(`calendar-progress.md` excluded — cited from live Band-C plans.)*

**Proof of closure**, one command, no exclusions:

```bash
git grep -l -iE "per-page-(recipe|scope|progress|deferral)|LAUNCH-SHEET|MAIN-AGENT-CONTEXT|PER-PAGE-GOAL|POST-AGENT-AUDIT|WAVE-RECONCILIATION|RECONCILIATION-WALK|PHASE6-AUTONOMOUS|phase6-admin-workflow" -- . ':!redesign/'
```

→ `AGENTS.md` + 7 `src/` files, **all seven referencing `per-page-progress` only**. Nothing outside
`redesign/` has ever named a recipe, a scope file, or any hub doc.

### Two textbook circular pairs

- **`PER-PAGE-GOAL-COMMANDS.md`** (65 KB) ← cited by `MAIN-AGENT-CONTEXT.md` **and nothing else**;
  cites it back. It is the **sole non-sibling citer of all 26 recipes and all 26 page-progress
  files.** One 65 KB file, held up by a single mutual citation, carries the "it is cited, therefore
  keep" verdict for 52 others.
- **`RECONCILIATION-WALK-PLAN.md`** ← cited by `WAVE-RECONCILIATION.md` **and nothing else**; cites
  it back. Between them they are the only protection for `reconciliation-walk/` (90 files, 12 MB).

### The mechanism is retired

`git worktree list` → main tree only · no `agent/<slug>-redesign` branch · `spawn-worktree.mjs` and
15 `patch-recipes-*.mjs` deleted 2026-05-16 · `PHASE6-AUTONOMOUS-AGENT-PLAN.md` opens
*"⚠ HISTORICAL — partially superseded"* · `MAIN-AGENT-CONTEXT.md` still says *"Phase 6 … IN PROGRESS
— 5/29 pages merged, 24 to go"*, ~700 commits and three months stale. **All 29 pages shipped.**

### ⛔ Why this is a RETIREMENT DECISION, not a proven deletion

Deleting it would: break 2 live `src/` comments (§4); leave dangling `Recipe:` headers in 25
progress files plus `IMPLEMENTATION-PLAN.md:783`, `PER-PAGE-SCORES.md:981`, four
`per-page-deferrals/*`, two `HARDEN-RECS-*`; and remove the **only** protection 905 screenshot files
(126 MB) currently have.

**Uncertainty defaults to KEEP, so it is not proposed as a deletion.** It is the largest legitimate
reclamation available and the call belongs to the Owner.

---

## 3 — ⛔ THE PLAN'S VERIFICATION GATE IS INADEQUATE

`extract-doc-citations.sh` (FINDINGS-A5 §3) scans **only** `src/`, `scripts/`, `e2e/`, `supabase/`
and root config.

⛔ **Deleting the 88-file cluster would return "zero dangling" while leaving ~35 broken doc→doc
pointers. The plan's §7 verification would pass and be wrong.**

**Any doc-to-doc deletion requires a second checker that walks `.md`/`.html` cross-references.**

---

## 4 — Two NEW live-code citations — the 50th and 51st

Both cite recipe content **without naming a file**, which is why eleven prior checks missed them:

- `src/app/admin/password-reset/states/SetNewPassword.tsx:19` —
  *"Form name attributes preserved verbatim per recipe Hard rule #5."*
- `src/app/admin/reports/page.tsx:174` —
  *"verification at recipe step 6 keeps the unstable_cache shape safe."*

✅ **`password-reset-recipe.md` and `reports-recipe.md` are therefore LIVE-CODE, not
archive-internal.** Password-reset also carries still-open deferrals.

---

## 5 — The citation metric that protected everything is inflated

| File | Inbound files | …of which `per-page-*` boilerplate |
|---|---:|---:|
| `SAFETY-NET.md` (368 B) | 31 | **26** |
| `BASELINE-ISSUES.md` | 36 | **26** |
| `RECON.md` | 48 | **26** |
| `IMPLEMENTATION-PLAN.md` | 42 | **31** |
| `PER-PAGE-SCORES.md` | 57 | **34** |

⛔ **The "dense citation web" is substantially one boilerplate reading-list block copy-pasted into
26 recipe files inside the retired cluster.** A 368-byte git-rollback note scores 31 citations that way.

⛔ **A1's headline number is wrong.** `C-C-EXECUTION-PROTOCOL.md` was reported at **93** inbound.
Measured by the orchestrator: **19 occurrences across 13 files.** Off by ~5×. The file is still
genuinely protected (`AGENTS.md` + two production migrations) — but the number that anchored the
audit's central claim was inflated.

---

## 6 — KEEP verdicts whose stated reason does not survive

The verdicts are right; the **reasons** were circular and are replaced.

| # | Verdict | Problem | Replacement basis |
|---|---|---|---|
| 1 | V1: 26 recipes "cited from `per-page-progress/` sibling" | Circular — the sibling's only non-cluster citer is itself in a two-file cycle | ✅ Two live `src/` citations (§4) for 2 of them; the rest revert to archive-internal |
| 2 | A3: `per-page-progress/` KEEP-GOVERNING wholesale | Over-read of `AGENTS.md` | 31 Band-C files alive via the backlog + 7 src citations; 25 Phase-6 files are not |
| 3 | A2: `screenshots/` (88.5 MB) KEEP-CITED | All 37 citers are inside `redesign/`; zero from code. Also "30 recipes" is impossible — there are 26 | ✅ Keeps under the Owner's explicit "keep test records and artifacts" ruling — a rule, not a citation |
| 4 | A2: `reconciliation-walk/` KEEP-MEMORY | Its two citers are a mutual pair | Circular; no independent basis |
| 5 | **Reverse-direction error** | `AUTONOMOUS-LOG.md` and `login-scope.md` are partly protected by `subagent-chunk1-instructions.md` — **already approved for deletion in Batch 3** | `AUTONOMOUS-LOG.md` drops from 3 citers to 2, both in the retired cluster |

⚠️ Also: V1 cleared `subagent-chunk1-instructions.md` partly because its mechanism was *"formalised
in `MAIN-AGENT-CONTEXT.md §5A`"* — but that file is itself a fossil describing the retired worktree
mechanism. **The verdict stands on zero-citations; the stated rationale does not.**

---

## 7 — KEEP verdicts that survive the attack

All 49 paths on A5 §2 · `per-page-deferrals/` (15 still-open commitments, self-contained) ·
`OWNER-ACTION-BACKLOG.md` + the 30 B-xx/C-xx progress files · `C-C-EXECUTION-PROTOCOL.md`,
`C-C-SINGLE-AGENT-ADDENDUM.md`, `C-B-DECISIONS.md` · `redesign/audits/**` · HANDOFF-9 and the
8-handoff gotcha chain · both SEO docs · `DESIGN.md`, `DESIGN.json`, `PRODUCT.md`,
`ENGINEERING-LOG.md` · `PHASE-7-THEME-RECOLOR.md`, `DEFERRALS-SUMMARY.md`, the advisor-seat handoff ·
`baselines/bundle-pre-B1.json`, `evidence/admin-contrast/`, `evidence/SEO-phase0-baseline/`.

---

## 8 — Confidence

**High** on the structural findings — closure sweep, both mutual cycles, the boilerplate
decomposition, `AGENTS.md` staleness, the count correction, the two new live-code citations, and the
verification-gate gap. All re-runnable, and the three most load-bearing were independently
re-verified.

**Medium** on whether the Phase-6 cluster's *content* is fully superseded: one recipe head, one scope
file and seven hub-doc heads were read — not 88 files end to end. The scope files are per-page
"files to edit / never touch" contracts, and it was not verified that every constraint they record
also appears in a surviving document.

**What would change the answer:** if the Owner confirms the Phase-6 worktree programme will never
run again, the cluster becomes a clean retirement candidate. If a content diff found any constraint
recorded nowhere else, it becomes UNIQUE-CONTENT and stays.
