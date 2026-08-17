# VERIFY R1 — adversarial review of the plan itself

**Date:** 2026-08-17 · **Target:** `DECLUTTER-2026-08-17-plan.md` rev. 2 (463 lines)
**Mandate:** find defects in the plan, not in the workspace. Part B had never been attacked.

⛔ **Top claims independently re-verified by the orchestrator.** Verdict accepted; plan rewritten as
rev. 3.

---

## 1 — The structural defect (most important, and missed by everyone including the author)

⛔ **The plan never asked WHERE the commits go.** On `master` they descend from `3eb2939` (Phase 12),
so **the `AGENTS.md` fix — the plan's self-declared highest-value edit — becomes unshippable until
the Owner decides to open live bookings.** A pure documentation correction was coupled to a business
go-live decision for no reason.

✅ **Verified:** `git merge-base --is-ancestor 3eb2939 origin/master` → false. **A branch off
`origin/master` (`0f8ab9d`) carries no Phase-12 entanglement.**

Also unnamed: the unpushed stack grows 4 → ~14, all gated on one decision; a prefix push
(`git push origin 563d520:master`) exists but is undocumented; and if the Owner ever *reverts*
Phase 12, the edited docs become wrong in the opposite direction and re-correcting them is a merge
problem, not an edit.

---

## 2 — Defects, ranked

| # | Defect | Fix applied in rev. 3 |
|---|---|---|
| **D4** | ⛔ **`src/lib/maintenance.ts` still exists on `origin/master`** (`git cat-file -e` → exit 0). Its absence is a property of 4 unpushed commits, not settled fact. Rev. 2 treated it as fact | Phrase every correction as *"removed by `3eb2939` (unpushed; still present on `origin/master`)"* — true in both worlds |
| **D3** | ⛔ §14 said "rewrite `AGENTS.md`" while §4 relied on that same file's never-touch clause as the **sole** protection for `redesign/audits/**` (99 files) and `C-B-DECISIONS.md`. An executor rewriting it deletes the protection. §10.1 then listed `audits/` as movable | Rev. 3 specifies a **surgical** edit and names the clauses that must survive verbatim |
| **D5** | ⛔ Batch 1's "all regenerable" is **false for 4 of 7 rows**. `.playwright-mcp/` (316 files), `.impeccable/` (21), `.superpowers/brainstorm/` (3 hand-built HTML artefacts), `redesign/.kilo/` do not regenerate — as unrecoverable as C-21. **And the Owner ruled "keep logs and test artifacts"; the plan deleted 316 Playwright files by re-classifying them as "tool scratch, not a test record" — a distinction the Owner never made** | Rev. 3 **moves** them out with the photos instead of deleting |
| **D1** | ⛔ Batch 3 vs §7 are incompatible. `visual-regression-1280.md` names **exactly the 15 PNGs** Batch 3 deletes (verified: 15 = 15). Batch 3 accepts creating 15 dangling refs; §7's criterion is "no NEW dangling". The resolution model was never stated — filesystem-based → Batch 3 must fail; tracked-list-based → the gate is blind to **every** untracked deletion | Rev. 3 states the model and pre-approves the C-21 delta |
| **D2** | ⛔ §13's tree cannot deliver "85 → 3". Nine files had **no destination** (`AUTONOMOUS-LOG`, `BRIEF-COMMANDS`, `DEFERRED-COMPLETENESS`, `FOUNDATION-FLOOR`, `IMAGES-NEEDED`, `PHASE-7-THEME-RECOLOR`, `SAFETY-NET`, `subagent-chunk1-instructions`, `test-credentials`). Real result **85 → 12** | Moves demoted to optional; tree completed if used |
| **D7** | §10.1 listed `per-page-recipes/` as "no code citations" while §4 protected two of its files as citations 50 and 51 | §10.1 deleted |
| **D8** | Moving `photos-rahma-therapy/` invalidates the "intentionally dirty tree" contract recorded in **HANDOFF-9:174,245** and 9 other docs. Not in Batch 6's correction list; §7's `git status` gate only checks `src/ supabase/` so it cannot catch it | Added to the correction list |
| **D6** | Batch 0's tag covers only the *reversible* work. Batches 1-4 (8.5 GB, all untracked) get **zero** snapshot coverage | Stated plainly |
| **D9** | §15's order contradicts §3 and §7's "baseline before Batch 0". Also a stale "Batch 3" reference to a file now in Batch 5 | Single ordered list in rev. 3 |
| **D10** | `redesign/README.md` was to hand-copy the 51-path list — the same drift failure it exists to fix, in a repo shipping ~700 commits/quarter | Points at the script instead |
| **D11** | Write target is **`e2e/admin-contrast-helpers.ts:849`**, not the spec · `DESIGN.json` has **zero** code citations · header said "tree clean" (3 untracked entries) | All corrected |

---

## 3 — Numbers: wrong

| Claim | Actual |
|---|---|
| "13 superseded handoffs" | **15** `HANDOFF-*` at root → 14 superseded |
| "root 85 → 3" | **85 → 12** |
| `screenshots/` "88.5 MB" | **94 MB** — 88.5 was A2's figure for the 669-file *subset* |
| "905 screenshots / 126 MB" | 959 files / ~123 MiB |
| §10.1 `evidence/` 17 · `briefs/` 10 · `baselines/` 6 | 15 · **9** · 2 |
| "load-bearing ~2,990" | **2,993** |
| "7 groups ~8.5 GB" | those 7 total **90 MB**; 8.5 GB needs `.next/` |

⛔ **The `briefs/` error is the same substring false positive A3 documented** (`bookings-brief.md`
matching `C-02-recurring-bookings-brief.md`). The author reproduced the exact bug the plan criticises.

**Verified correct:** `.next` 8.36 GiB · C-21 15 files / 25,848,230 B exact · photos 28/24
(reproduced by independent MD5 against the whole `public/` tree) · 2,996 / 1,819 / 215 MB · 85 loose
files all tracked · "exactly one code-cited" · 1,199 · Batch 5's three files at 90,580 B with **zero**
citations across five match forms · `maintenance.ts` in 111 documents · 49 + 2 = 51 with no overlap ·
`AGENTS.md`'s four never-touch items · **no test asserts `AGENTS.md`**, so editing it cannot break one.

---

## 4 — The `.gitignore` trap: NEGATIVE, definitively

All four ignore sources enumerated (`.gitignore` only — no nested files; `.git/info/exclude`;
`core.excludesFile` unset; `~/.config/git/ignore`). Every proposed destination tested with
`git check-ignore -v --no-index` → **not ignored, every one.** No `archive*` pattern exists. All 85
source files are tracked. **No tracked file can silently become untracked by these moves.**

⚠️ **Method warning:** `git check-ignore -v --no-index "redesign/archive/"` — *with* a trailing slash
— returns a **false positive** citing blank line 69. A control run on a nonexistent path reproduced
it. **Test destinations without trailing slashes.** The reviewer notes this was the third
matcher-trust failure of the audit — this time the tool itself.

---

## 5 — What still slips through the verification

1. Resolution model unstated (D1) — decides whether the gate covers the irreversible half or none.
2. ⛔ **Untracking is not checked.** Cheapest fix in the whole review: add `git ls-files | wc -l`
   (2,996 → 2,993 after Batch 5, unchanged by any move). Catches untracking, an interrupted
   `git mv`, a stray `rm` and an accidental `git add` at once.
3. ⛔ **Segment-assembled paths are invisible to any regex extractor.**
   `admin-contrast-helpers.ts:849` builds its path via `path.join(…, "redesign", "evidence", …)`.
   A5's entry for it was reconstructed by hand, not extracted. **The plan's strongest protection
   claim is one the gate cannot enforce.**
4. Bare-filename citations resolve by basename fallback, so the gate cannot prove a rewrite pass was
   *complete* — only that nothing dangles.
5. A wrong-but-resolving rewrite passes silently.
6. Citations naming no file (`"per recipe Hard rule #5"`) are undetectable by construction.
7. `data-redesign-fake` is name-keyed; 41 files carry it, 7 of them movable. No script counts them.
8. `pnpm test:e2e` — the only thing exercising the write target — is not in the gate list.
9. "No new dangling" is only correct as a **set** difference, not a count.
10. No content-integrity check that moved files are byte-identical.

---

## 6 — Proportionality: cut about two thirds

⛔ **"Part A is right-sized. Part B is a bureaucracy, and Part B is where all the risk lives."**

For ~15 bookings, 6 therapists and one engineer, rev. 2 proposed ~10 commits, ~60 stampings, a
citation rewrite across 73 moved files, two hand-maintained READMEs and a five-step per-move protocol.

**Keep:** the surgical `AGENTS.md` fix · Batch 6's four corrections (all line references verified) ·
`.next/` (98% of the disk win, one Owner action, zero risk) · the photos move · Batch 5's three files ·
the one-line `.gitignore` entry for the zip.

**Cut:** §13's 73 moves entirely (only risky part; doesn't achieve its headline) · stamping from ~60
files to **4** (the ones with nameable harm) · the README to ~15 lines with no hand-copied path list ·
§10.1 wholesale · re-asking Owner decision 2 when the plan already recommends "leave it".

⛔ **And: the plan's own evidence is 188 KB across 9 files and would become an 18th subdirectory of
the directory being decluttered. Net tracked-file change: −3 +10 = +7. A declutter that adds files.**

---

## 7 — Missing entirely

1. ⛔ Branch placement (§1) — the largest unnamed risk.
2. The compounding unpushed stack; the undocumented prefix-push option.
3. `push.followTags` is unset (verified) so the tag is safe — but "never pushed" should say why.
4. If the Owner squashes/rebases the unpushed stack, the `pre-declutter` tag detaches and the
   doc→doc baseline it anchors becomes unreachable.
5. No disposition for the plan's own 188 KB of evidence.
6. The "intentionally dirty tree" contract update (D8).
7. The `git ls-files | wc -l` invariant.
8. ⛔ **Cold-build cost understated.** §3 said "one slower first page load". But §7 requires
   `pnpm build` after *every* batch, and with `.next/` gone the next is a **full cold Turbopack
   build** — minutes, ~6 more times.
9. ⛔ **§6's accessibility defects have no owner.** A 36px touch target below the 44px floor on every
   admin page is a live WCAG failure, **worth more to the business than the entire declutter**, and
   it is buried in a cleanup plan. Promote to `OWNER-ACTION-BACKLOG.md`.
10. `.git` is 289 MB against a 2,996-file tree, almost all of it ~1,190 tracked screenshots. The plan
    never asks the forward-looking question: **should new screenshot evidence keep being committed?**
    That is the only change that stops the problem recurring.

---

## 8 — Credit where due

The §7 doc→doc addition **does** close the hole Round 2 found. **Batch 5 survived every attack
constructible** — five independent match forms, zero citations. The defects are concentrated in
Part B, which was appended *after* the two adversarial rounds and had never been attacked until now.

**Could not check:** the seven gate baselines (no builds/tests permitted); whether `.next`/`.open-next`
truly regenerate; the two credential files by instruction — so §2's placeholder claim is unverified
by this reviewer.
