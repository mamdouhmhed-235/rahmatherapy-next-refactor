# VERIFY V1 — adversarial attack on the document deletions

**Date:** 2026-08-17 · **Mandate:** refute, not confirm. Uncertainty defaults to "do not delete".

## ⛔ Result: 44 of 46 candidates REFUTED. Only 3 files clear.

---

## 1 — Verdicts

| Candidate | Verdict | Reason |
|---|---|---|
| `redesign/subagent-chunk1-instructions.md` | ✅ **CLEARED** | Zero citations via all 7 mechanisms; mechanism later formalised in `MAIN-AGENT-CONTEXT.md §5A` |
| `redesign/plans/C-phase/C-C-RESUME-2026-07-31.md` | ✅ **CLEARED** | Self-subordinating position snapshot; its one gotcha is duplicated in three surviving docs |
| `role-specific-admin-crm-plan.html` | ✅ **CLEARED** | Zero citations; content absorbed into live code + `DESIGN.md`/`PRODUCT.md` |
| `redesign/DEFERRALS-SUMMARY.md` | ⛔ **REFUTED** | Its cross-page "Top Themes" synthesis is original analysis, **not** a regenerable rollup |
| `redesign/HANDOFF-2026-08-04-ADVISOR-SEAT.md` | ⛔ **REFUTED** | Unique process rationale **and an outstanding unfulfilled promise** |
| `redesign/per-page-scope/*.md` (29) | ⛔ **REFUTED, all 29** | Every file cited by basename from a surviving document |
| `redesign/per-page-recipes/*.md` (26) | ⛔ **REFUTED, all 26** | Every file cited from its `per-page-progress/` sibling |
| `redesign/backend-plans/BUILD-*.md` (18) | ⛔ **REFUTED, all 18** | Every one is an unchecked `[ ]` row in `IMPLEMENTATION-PLAN.md` |

---

## 2 — ⛔ The root cause: A3's proof script was tautological

A3's proof-of-safety command, quoted verbatim from its own report:

```bash
grep -rl "$(basename "$f")" --exclude-dir=node_modules --exclude-dir=redesign \
     --exclude-dir=.next --exclude-dir=.git .
```

⛔ **It passes `--exclude-dir=redesign` to the very search meant to prove that no `redesign/`-internal
citation exists.** Every actual citer lives inside `redesign/`. The check was structurally
incapable of returning a hit. This is not a subtle miss — it is a tautology.

**Independently re-verified during this session:**

```
grep -rl "calendar-recipe.md" --exclude-dir=redesign …   →  EMPTY      (what A3 saw)
grep -rn "calendar-recipe.md" …                          →  redesign/per-page-progress/calendar-progress.md:4
                                                            "Recipe: /redesign/per-page-recipes/calendar-recipe.md"
```

**26 of 26 recipes are cited from `per-page-progress/`** — the directory `AGENTS.md` names as the
"position of record".

### How the 55 scope/recipe files are actually cited

- **All 26 recipes** — a `Recipe: /redesign/per-page-recipes/<slug>-recipe.md` header on line 4 of
  each corresponding `per-page-progress/<slug>-progress.md`.
- **4 scope files** (`calendar`, `email-templates`, `emails`, `login`) — cited the same way.
- **22 scope files** — cited from their sibling recipe (e.g. `audit-recipe.md` cites `audit-scope.md`).
- **3 scope files** (`00-shared-components`, `booking-new`, `bookings`) — cited from
  `phase6-admin-workflow-guide.html`, which instructs: *"compare… against
  /redesign/per-page-scope/booking-new-scope.md (the scope contract written before craft ran)."*

---

## 3 — The 18 "shipped" backend plans

`redesign/IMPLEMENTATION-PLAN.md` (42 inbound citations, explicitly uncuttable) carries a 27-row
master checklist at lines 1144-1177 naming **all 27** backend-plan filenames — the 9 A3 kept *and*
all 18 it marked for deletion — each as an unchecked `[ ]` box.

⛔ **And at least one is not actually shipped.** `src/app/admin/audit/page.tsx:116` reads today:

```
// FAKE: BUILD-audit-target-existence — when the BUILD plan lands this becomes a batched lookup
const targetExistence: Record<string, boolean> = {};
```

A live, empty stub. A5's extractor missed it because the comment omits the `.md` suffix — a **ninth
citation mechanism** beyond the eight already catalogued.

Four more are named in `per-page-deferrals/` files that A3 itself classifies "KEEP-MEMORY, all 25,
no exceptions", and correspond to A3's own still-open deferrals. Two more are named inside
`redesign/audits/**`, which `AGENTS.md` marks never-touch.

✅ A3's list of **9 protected** backend plans was independently re-derived via the
`data-redesign-fake` attribute mechanism and is **correct**.

---

## 4 — The two Group 1 refutations

**`DEFERRALS-SUMMARY.md`** — its "Top Themes" section groups findings across 10+ pages each
(Theme 1, "shared-primitives debt", spans nine pages). That cross-page synthesis exists nowhere
else and is not a mechanical concatenation. **"Regenerable aggregate" is false.**

**`HANDOFF-2026-08-04-ADVISOR-SEAT.md`** — §7 "Outstanding promises of this seat" records a still-owed
*"full end-of-programme review"* plus six specific watch items (C-19 reorder logging, C-23 gates,
C-14 co-deploy, C-10 timing, the four-in-one deploy checklist, the `maintenance.ts` flip). Not
marked closed anywhere. It also explains the `/goal` 4,000-char cap and the `C-C-RESUME-<date>.md`
convention — the rationale behind another candidate's very naming pattern.

---

## 5 — The seven-mechanism check for the three CLEARED files

Each was checked against: source comments · `data-redesign-fake` attributes · SQL migration
comments · bare-filename repo-wide · `AGENTS.md` directory protections · doc-to-doc ·
`OWNER-ACTION-BACKLOG.md`. All seven returned empty for all three.

- **`subagent-chunk1-instructions.md`** — `git grep -l` → empty. ⚠️ A1's claim that
  `PHASE6-AUTONOMOUS-AGENT-PLAN.md` "records its outcome" is imprecise (shared screenshot naming
  only), but that plan is itself marked historical and points to `MAIN-AGENT-CONTEXT.md §5A` as
  operative — so the verdict survives on other grounds.
- **`C-C-RESUME-2026-07-31.md`** — self-subordinates ("if git or the progress files disagree,
  THEY win"). Its one substantive item, the C-08 RBAC correction, is duplicated in
  `OWNER-ACTION-BACKLOG.md`, `C-08-…-progress.md` and `BAND-C-MASTER-PLAN.md`.
- **`role-specific-admin-crm-plan.html`** — single commit `e13b212` (2026-05-09), never touched
  again. Its proposed permission slugs were adopted into live `src/lib/auth/rbac.ts`; content fully
  realised in code.

---

## 6 — What Wave 1 got wrong

| Agent | Error |
|---|---|
| **A3** | ⛔ Group 2 verdict decisively wrong — tautological proof script (§2) |
| **A3** | ⛔ Group 3 wrong twice: never checked doc-to-doc citations, and `BUILD-audit-target-existence.md` is not actually shipped |
| **A1** | `PHASE6-AUTONOMOUS-AGENT-PLAN.md` does not record the outcome it was credited with |
| **A1** | `DEFERRALS-SUMMARY.md` is not "regenerable" |

⚠️ **No instance was found of A1/A3 being too cautious** — everything adjacent that they marked KEEP
checked out as genuinely load-bearing. Their KEEP list was not exhaustively audited, however.

---

## 7 — Confidence and gaps

High on Group 2 and on the citation-existence claims in Group 3 — all mechanically re-verifiable.
Medium-high on shipped/unshipped status of individual Group-3 features: source was checked directly
for ~9 of 18; the REFUTED verdict for the rest rests independently on the `IMPLEMENTATION-PLAN.md`
citation, which does not require that check.

Lower confidence on `role-specific-admin-crm-plan.html`'s ~15 unread "Risks and Caveats"
subsections (one spot-checked, structurally consistent) and on `C-C-RESUME-2026-07-31.md`'s prose
beyond the traced gotcha.

No `.env`, `docs/users-credentials` or `redesign/test-credentials.md` was opened. No build, test or
lint was run. No file was modified.
