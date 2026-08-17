# DECLUTTER — plan (rev. 3)

**2026-08-17** · ⛔ **AWAITING OWNER APPROVAL. Nothing deleted.**
**Base:** `c04b6b4` on `master` · `origin/master` = `0f8ab9d` · 4 unpushed · working tree has 3
untracked entries (this plan, its evidence folder, `.claude/skills/impeccable.zip`)
**Evidence:** `redesign/declutter-2026-08-17/` — 6 inventories, 4 adversarial reviews

> **Rev. 3 supersedes rev. 2**, which was reviewed adversarially and found to contain 11 defects and
> 7 wrong figures — including one bug identical to the matcher error the plan itself criticised.
> Rev. 3 is **two thirds shorter** because the reviewer was right that rev. 2 had become a
> bureaucracy. Full record: `VERIFY-R1-plan-review.md`.

---

## ✅ EXECUTED 2026-08-17 — record

Owner approved execution. All actions completed. **Nothing pushed;
`origin/master` is still `0f8ab9d`.**

| Step | Result |
|---|---|
| §0.0 backup | ✅ Verified all-refs **bundle** ("records a complete history") + raw `.git` copy → `~/Desktop/rahma-git-backup-2026-08-17` (499 MB) |
| A2 build caches | ✅ 57 MB |
| A3 C-21 PNGs | ✅ exactly **15** removed, 24.65 MB; tracked `visual-regression-1280.md` preserved |
| A4 `.playwright-mcp` | ✅ exactly **316** (167 `.yml` / 124 `.log` / 25 `.png`), 33 MB |
| A5 move | ✅ exactly **80** files, 55 MB → `~/Desktop/rahma-archive-2026-08-17`; all sources gone |
| A1 `.next` | ✅ 8.4 GB |
| Commit 1 `af47605` | ✅ 10 files — `AGENTS.md` surgical fix, 4 doc corrections, `.gitignore`, 4 stamps, `redesign/README.md` |
| Commit 2 `ba2072e` | ✅ 3 tracked documents, 90,580 B |
| Commit 3 `ce7f502` | ✅ **1,020** screenshots, ~136 MB |

**Tracked files: 2,996 → 1,988.** `redesign/`: 215 MB → **55 MB**, 1,819 → **810** files.

### Verification — all seven gates identical to baseline

`tsc` 0 · `vitest` **0 failed / 2501 passed / 242 files** · `lint` 4 errors + 1 warning in the same
**three** files · `vitest scripts/` 47 · contrast **110 (46 dark / 64 light)** · verify **0** ·
`git status --porcelain -- src/ supabase/` **empty**. Working tree fully clean.

**Citation gates:**
- code→doc: **1** dangling — the known pre-existing external one. **Unchanged.**
- doc→doc set-difference: **92** new entries, and **92 of 92 are inside the six deleted screenshot
  directories.** Zero unexpected, zero from `baselines/`. Exactly the pre-approved delta.

### The safety claims, proven rather than asserted

- ⛔ **All 1,020 deleted screenshots are recoverable** — `git ls-tree -r ce7f502^` over the six paths
  returns exactly **1,020**.
- `.git` is **286 MB, unchanged** — history was never rewritten, which is what makes the above true.
- ⛔ **`redesign/baselines/` (plural) untouched: still 87 tracked**, with `bundle-pre-B1.json` and
  `wcag-severity-tokens.md` both verified present. The `--pathspec-from-file` guard asserted **0**
  entries containing `baselines/` before deleting `baseline/`.
- ⛔ **`redesign/audits/` untouched: still 99** (`AGENTS.md` never-touch).

---

## 0 — ⛔ SAFETY

**Owner instruction, 2026-08-17: no destructive command that could destroy everything may be used.
Every removal must be precise.** This section overrides convenience everywhere below.

> **Rev. 4.** A second adversarial review (`VERIFY-R2-plan-review.md`) returned **NO-GO** on rev. 3
> with 13 defects — including a factually wrong entry in this very section and an unrunnable primary
> gate. All six required fixes are applied below.

### ⛔ 0.0 — BACK UP `.git` FIRST. This is action zero.

⛔ **The entire safety argument of this plan — "tracked files stay recoverable from git history
forever" — rests on ONE un-backed-up directory.** Verified:

```
git remote                                          → origin (only)
git merge-base --is-ancestor 3eb2939 origin/master   → FALSE: Phase 12 is NOT on the remote
git worktree list                                    → 1 worktree
```

**So the 1,020 screenshot blobs AND the 4 unpushed commits — including Phase 12, the commit that
opens live bookings — exist in exactly one place on earth: this `.git`.** No remote copy is possible
(nothing may be pushed), there is no second clone, and there is no backup.

**Before any other action, copy `.git` (289 MB) to a location outside this working copy.** It costs
nothing against the 8.4 GB being freed, and without it a single corrupt object, one stray
`reset --hard`, or one `gc --prune` takes all 1,023 deleted files *and* Phase 12 together.

### 0.1 — ⛔ NEVER RUN THESE

⛔ **This project is PowerShell-primary with Bash also available. Both shells' forms are listed —
a rule covering one shell is a hole in the other.**

**git — destroys history or the working tree**

| Command | What it destroys here |
|---|---|
| `git reset --hard` | The **4 unpushed commits**, incl. Phase 12. `origin/master` does not have them |
| ⛔ `git reflog expire` · `git gc --prune=now` | **The reflog that would rescue a bad `reset`.** Forbidding the reset without forbidding these is only half a rule |
| `git clean -fd` | ⛔ **Deletes this plan, all 10 evidence files, and `impeccable.zip`** — the only justification for every deletion below. ⚠️ It does **not** touch `.env`, `node_modules` or the photos: those are gitignored. **`-x`/`-X` is the flag that reaches them** — and that is genuinely catastrophic |
| ⛔ `git stash` · `-u` · `stash drop` · `stash clear` | `-u` sweeps the plan + evidence + zip into a stash; `drop` then loses them |
| ⛔ `git checkout <branch>` · `git switch` | Reverts the working tree to pre-Phase-12 — **closes bookings on the local site the Owner tests with** |
| `git checkout -- .` · `git restore .` · `git checkout <ref> -- <path>` | Restores to HEAD, not to your working copy (gotcha 108 — already cost a session) |
| `git rm -r --cached` · `git update-ref -d` · `git branch -D` · `git worktree remove --force` · `git filter-branch` / `filter-repo` | Index/ref/history destruction |
| `git add .` · `-A` · `commit -am` | Forbidden by `AGENTS.md`; stages unintended files |
| `git push` in any form, incl. `--tags` / `--follow-tags` | Opens live bookings |
| ⛔ `git rm -r redesign/baselines` | Takes `bundle-pre-B1.json` + `wcag-severity-tokens.md` — see B7 and §0.3 |

**Filesystem — Bash**

`rm -rf` with a variable, glob, or `*` on a parent · `find … -delete` · `find … -exec rm` ·
anything targeting `.` `/` `~` `$HOME` or the repo root · `> file` truncation.

**Filesystem — PowerShell / cmd** ⛔ *(missing entirely from rev. 3)*

`Remove-Item -Recurse -Force` (and `ri -r -fo`, `rm -r -fo`) · `Get-ChildItem … | Remove-Item` ·
`Clear-Content` · `Set-Content` / `Out-File` / `>` on an existing file · `New-Item -Force` on an
existing file (**truncates**) · `del /f /s /q` · `rmdir /s /q` · ⛔ `robocopy /MIR` (mirrors, and
**deletes everything extra in the destination** — a repo-killer).

⚠️ **`rm -rf` does not exist in PowerShell** (`rm` is `Remove-Item`, which has no `-rf`). Every
`rm -rf` below is a **Bash** command — run it in Bash, or the executor will reach for
`Remove-Item -Recurse -Force`, which this section does not sanction.

### ⛔ 0.3 — The `baseline` / `baselines` trap

`redesign/baseline` (B7, delete) and `redesign/baselines` (⛔ never delete) differ by one character,
and **`baseline` is a strict prefix of `baselines`**. Tab-completing `redesign/base` yields
`baseline`; **one more Tab yields `baselines`** — the command §0.1 calls destructive.

⛔ **"Literal paths typed in full" is no defence: a tab-completed prefix IS a literal path.**

**Therefore B7 must never pass `redesign/baseline` as a directory pathspec.** Enumerate:

```bash
git ls-files redesign/baseline > /tmp/b7-baseline.txt
wc -l < /tmp/b7-baseline.txt                    # must be exactly 146
grep -c 'baselines/' /tmp/b7-baseline.txt       # must be exactly 0  ← the guard
git rm --pathspec-from-file=/tmp/b7-baseline.txt
```

### 0.4 — Required method

1. **`pwd` first**, every time. A path is only safe relative to where you stand.
2. **Literal paths, typed in full** — never a variable, never concatenation, never a wildcard
   spanning something kept. ⚠️ **Exception, stated so it is not generalised:**
   `rm redesign/evidence/C-21/*.png` is admissible because the only kept file there is a `.md`, which
   `*.png` cannot match. **Expect exactly 15 removals; any other count is a stop.**
3. **List before you delete**, then act on that enumeration. ⛔ **`git rm -r -n` dry-run first for
   every tracked deletion** — and confirm the printed count.
4. **Tracked files: `git rm`, never bare `rm`.** Atomic index update, recoverable from history —
   *provided §0.0 was done*.
5. **One target per command.** ⚠️ `git rm -r <dir>` is inherently a parent operation; it is admissible
   only for the six B7 directories, which have been **proven** to contain nothing kept (§1 B7).
6. **Count before, count after**, against a number written down in advance.
7. **One commit per logical action**, so any step reverts alone. ⛔ Never mix a deletion and an edit.
8. **After every step:** `git status --porcelain`, and the tracked-file delta check in §8.
9. ⛔ **Stop on the first surprise.** A mismatched count is a stop — not something to investigate
   while continuing.
10. **Label the shell.** Every command block below is Bash unless marked otherwise.

---

## 1 — What to do, in order

**Two kinds of work, and they are independent.**

### A — Filesystem actions · ~8.5 GB · no git, no commit, no branch, no push risk

Everything here is **untracked**, so none of it involves git at all.

⛔ **Bash commands.** `rm -rf` does not exist in PowerShell (§0.1).
⛔ **A1 runs LAST** — every gate run after it pays a full cold Turbopack build (§8).

| # | Action | Files | Size |
|---|---|---:|---:|
| A2 | `rm -rf .open-next` · then `rm tsconfig.tsbuildinfo` and `rm tsconfig.phase0check.tsbuildinfo` **as two literal paths** (§0.4 rule 2 — no `tsconfig*` glob) | — | 57 MB |
| A3 | `rm redesign/evidence/C-21/*.png` — ⛔ Owner-approved, irreversible. **Keep the tracked `visual-regression-1280.md`.** Glob admissible per §0.4 rule 2. Expect exactly **15** | 15 | 24.65 MB |
| A4 | `rm -rf .playwright-mcp` — ⛔ **Owner-approved 2026-08-17.** Irreversible (untracked). Expect **316**: 167 `.yml`, 124 `.log`, 25 `.png` | 316 | 33 MB |
| A5 | **MOVE out, do not delete** — see the literal commands below | **80** | 55.3 MB |
| A1 | `rm -rf .next` — ⛔ literal path, verified `pwd`. No dev server is running (verified) | — | **8.4 GB** |

#### A5 — the move, precisely

⛔ **This is the highest-consequence irreversible step in the plan, and rev. 3 gave it no destination
at all.** `photos-rahma-therapy/` holds **24 files that exist nowhere else** (md5-verified: 28 of 52
are byte-identical to something under `public/`, 24 are not). ⚠️ **A mistyped `mv` destination
silently renames instead of erroring.**

```bash
DEST="/c/Users/mamdo/Desktop/rahma-archive-2026-08-17"    # literal; create it first
mkdir -p "$DEST"
mv photos-rahma-therapy   "$DEST"/     # expect 52 files
mv .impeccable            "$DEST"/     # expect 21
mv .superpowers/brainstorm "$DEST"/superpowers-brainstorm   # expect 5
mv redesign/.kilo         "$DEST"/kilo # expect 2
find "$DEST" -type f | wc -l           # must be exactly 80
```

⛔ **Verify the destination count is 80 before proceeding.** Rev. 3 said 78 — wrong;
`.superpowers/brainstorm/` holds **5** files (3 HTML artefacts **plus** `state/server-info` and
`state/server.pid`), not 3.

⛔ **After A5, two files go stale and both must be corrected (§3):** `HANDOFF-…-9.md:174` and the
`.gitignore` comment block, which both assert the "28 of 52 files already exist under
`public/images/`" fact about a directory that will no longer be there.

⛔ **A4 is a reversal, recorded deliberately.** Rev. 2 deleted these 316 files by re-classifying them
as *"tool scratch, not a test record"* — a distinction the Owner had not made, against a standing
ruling to keep logs and test artifacts. Rev. 3 moved them out instead. **The Owner has now ruled
directly: the site is built, this data has no remaining value, delete it.** That is their call and it
supersedes the earlier ruling for this item.

⛔ **A5 stays a MOVE.** The Owner's new ruling named *screenshots and Playwright data* only.
`.impeccable/` (10 design sessions) and `.superpowers/brainstorm/` (3 hand-built HTML artefacts) are
untracked, unrecoverable, and contain human work nobody has ruled on. Moving costs nothing.

⛔ **`dev-server*.log` and `test-results/` are KEPT** per the earlier ruling. Cost: 459 bytes.

### B — Git actions · **three commits**, per §0.4 rule 7

⛔ **Edits and deletions must not share a commit.** So:
**Commit 1** — edits only: B1, B2, B4, B5, B6 · **Commit 2** — B3 (3 files) · **Commit 3** — B7 (1,020 files).
Each is revertible alone, and a bad B7 cannot take the `AGENTS.md` fix with it.

| # | Action |
|---|---|
| B1 | ⛔ **`AGENTS.md` — surgical fix.** See §2. The highest-value edit here |
| B2 | Four doc corrections in the governing SEO plans. See §3 |
| B3 | Delete 3 tracked files: `role-specific-admin-crm-plan.html` (74,138 B) · `redesign/subagent-chunk1-instructions.md` (13,177 B) · `redesign/plans/C-phase/C-C-RESUME-2026-07-31.md` (3,265 B) |
| B4 | Add `.claude/skills/impeccable.zip` to `.gitignore` — one line. It is untracked **and unignored**; one `git add .` puts 284 KB in the public repo |
| B5 | Stamp **4** files as historical. See §4 |
| B6 | `redesign/README.md` — ~15 lines. See §5 |
| B7 | ⛔ **The screenshot archives — 1,020 tracked files, ~136 MB.** Owner-approved 2026-08-17. See below |

✅ **B3 survived every attack constructible** — five independent match forms, zero citations repo-wide.

### B7 — the screenshot archives, precisely

⛔ **OWNER RULING, 2026-08-17: "we already have the final site built, we don't need these old
screenshots… they won't actually have any value."** Approved.

✅ **Good news: all 1,020 are TRACKED**, so `git rm` leaves every one recoverable from git history
forever. This is Class A, not the irreversible class C-21 was.

✅ **All six were proven pure by an independent adversarial check** — `git ls-files` and `find` both
return **zero** non-image files; all 1,020 are `.png`; all 932 unique basenames return zero hits
across `src/ scripts/ e2e/ supabase/` and every root config; no README, manifest or JSON capture
exists inside any of them; no script glob reaches them; `playwright.config.ts` defines no output path
there.

⛔ **Dry-run every one first** (`git rm -r -n <dir>`) and confirm the printed count matches.

| Directory | Files | Size | Method |
|---|---:|---:|---|
| `redesign/screenshots/` | 723 | 94 MB | `git rm -r` |
| ⛔ `redesign/baseline/` (singular) | 146 | 20 MB | ⛔ **NEVER a directory pathspec — enumerate per §0.3** |
| `redesign/reconciliation-walk/` | 90 | 12 MB | `git rm -r` |
| `redesign/adapt-shots/` | 50 | 8.7 MB | `git rm -r` |
| `redesign/onboard-shots/` | 7 | 1.3 MB | `git rm -r` |
| `redesign/polish-shots/` | 4 | 472 KB | `git rm -r` |

⛔ **`redesign/baselines/` (PLURAL) IS NOT ON THIS LIST AND MUST NOT BE `git rm -r`'d.** It is not a
screenshot directory. Six non-image files live in it, and two are load-bearing:

- ⛔ `bundle-pre-B1.json` — **read at runtime** by `scripts/measure-admin-bundles.mjs:146`
- ⛔ `wcag-severity-tokens.md` — **cited from production `src/styles/tokens.css:112`**
- `sentry-baseline.txt` · `screenshots-pre-B1/README.md` · two `.json` probe captures

**If you want its 81 images gone, enumerate them explicitly** — `git ls-files redesign/baselines | grep -E '\.(png|jpg|jpeg|webp)$'`
— review the list, then `git rm` exactly that set. **Never the directory.**

⛔ **`redesign/audits/` holds 56 more images (part of 14 MB) and is on `AGENTS.md`'s never-touch
list.** Not included here. Deleting them needs an explicit Owner instruction that overrides that
clause — say so directly if you want them gone.

**Expected effect:** `git ls-files` 2,996 → **1,973** after B3 (−3) and B7 (−1,020).

⚠️ **Three honest caveats:**

1. ⛔ **`.git` does not shrink.** It stays at 289 MB — the objects remain in history, which is exactly
   what makes this recoverable. The ~136 MB is a **working-tree** saving only. ⛔ **And that
   recoverability is real only if §0.0 was done.**
2. ⛔ **48 files cite the deleted paths, not "~30 recipes"** — rev. 3 quoted the full-path-only figure
   and mislabelled it. Measured: 30 files by full path (66 lines), 38 by basename (268 lines), **48 in
   union**. It is **all 26 recipes plus 22 others**, and **six are on this plan's own protected/live
   lists**: `per-page-deferrals/client-detail-deferrals.md` (the 15-open-commitments set), three
   `per-page-progress/*-progress.md` (the live punch-list), and both IMMUTABLE HTML files. Two more
   are §4 stamp targets. This is not collateral confined to a retired archive.
   ✅ **Zero citers live under `redesign/audits/`** — B7 forces no edit to the protected tree.
3. ⛔ **Two of the 48 citers may never be edited** (§6): `phase6-admin-workflow-guide.html` carries
   **58** lines naming concrete `baseline/<slug>-adapt-after.png` files, and
   `impeccable-v5-latest-stable.html` carries 15. **Their dangling references can never be repaired**,
   so the §8 manifest must absorb them permanently. Accept that or do not run B7.

### Where the commit goes

⛔ **Rev. 2 never asked. It matters:** on `master`, this commit descends from `3eb2939` (Phase 12), so
it cannot be pushed without opening live bookings.

**Recommendation: commit on `master` anyway.** Every item in B is developer-facing — it delivers its
full value *locally*, to the next session, whether or not it reaches the remote. Nothing in B affects
the live site.

⚠️ **If you do want the doc fixes on the remote before bookings open**, a branch off `origin/master`
carries them with zero Phase-12 entanglement (verified: `3eb2939` is not an ancestor of `0f8ab9d`).
Use a **worktree**, not a checkout — `git worktree add ../rt-docs 0f8ab9d -b docs/declutter` — because
switching branches in place would revert your working tree to pre-Phase-12 and close bookings on the
local site you are testing with.

---

## 2 — `AGENTS.md`: the surgical fix

⛔ **Do NOT "rewrite" this file.** §6 relies on its never-touch clause as the **sole** protection for
`redesign/audits/**` (99 files) and `C-B-DECISIONS.md`. Rev. 2 said "rewrite to point at HANDOFF-9",
which an executor could satisfy by replacing the clause — deleting that protection.

### ⛔ The sentence you are editing carries FIVE protections. Read it before touching it.

`AGENTS.md`'s final paragraph is **one sentence**, quoted verbatim:

> `Non-negotiables even for one-off tasks: never git push; never git add ./-A; never stash/restore/checkout to "clean" the intentionally-dirty working tree; never touch src/lib/maintenance.ts (Owner-owned uncommitted change), redesign/audits/**, C-B-DECISIONS.md, or live customer data (booking 9d55ce2a, …); the production Supabase DB and the public availability endpoints are LIVE customer surfaces — all DB writes require the Owner's explicit per-action approval in chat (⛔ HARD-STOP flow in the protocol).`

⛔ **The only substring to replace is `src/lib/maintenance.ts (Owner-owned uncommitted change)`.**
Everything else in that sentence must survive **verbatim**:

1. never `git push`
2. never `git add .`/`-A`
3. ⛔ **never stash/restore/checkout to "clean" the intentionally-dirty working tree** — rev. 3's
   must-survive list omitted this, while §0.1 also failed to forbid `git stash`. Editing it away would
   have left the repo with **no** stash prohibition at all
4. never touch `redesign/audits/**`, `C-B-DECISIONS.md`, or live customer data
5. ⛔ **the LIVE-Supabase / per-action-approval HARD-STOP clause** — also omitted by rev. 3

**Make three changes, no more:**

1. The Band-C framing (*"mid-way through the Band C implementation programme"*) → Band C closed
   2026-08-09; point at `redesign/HANDOFF-2026-08-13-IMPLEMENTATION-9.md` as current position.
2. The `src/lib/maintenance.ts` substring → ⛔ **phrase it true in both worlds:**
   *"removed by `3eb2939` (unpushed; still present on `origin/master`)"*.
3. The stale *"Position of record is git + `redesign/per-page-progress/`"* line (see below).

⛔ **Because `src/lib/maintenance.ts` STILL EXISTS on `origin/master`** — verified,
`git cat-file -e origin/master:src/lib/maintenance.ts` exits 0. Its absence is a property of four
unpushed commits, not a fact. If Phase 12 is ever reverted, a flat "this file is gone" becomes wrong
in the opposite direction.

**Must survive verbatim:** never `git push` · never `git add .`/`-A` · never touch
`redesign/audits/**`, `C-B-DECISIONS.md`, or live customer data · items 1-2 (the binding reads of
`C-C-EXECUTION-PROTOCOL.md` and `C-C-SINGLE-AGENT-ADDENDUM.md`).

⛔ Also fix the line that caused this audit two wasted waves: *"Position of record is git +
`redesign/per-page-progress/`"* was read as a deletion veto over 57 files. It is a statement of fact,
and it is stale. Say so.

✅ Safe to edit: `git grep -ln "AGENTS.md" -- ':!*.md' ':!*.html'` → empty. **No test asserts it.**

---

## 3 — The four doc corrections

All four line references verified present as quoted.

1. `SEO-AEO-GEO-IMPLEMENTATION.md:1148` — *"ZERO pushed. `origin/master` is still at `9271863`."*
   16 commits are live. The most misleading line in the repo.
2. `SEO-AEO-GEO-2026-08-13-plan.md:7` — *"Not implemented. No `src/` file has been changed."*
3. `SEO-AEO-GEO-IMPLEMENTATION.md:803` — Phase 11 gate demands `src/lib/maintenance.ts`. Use the
   both-worlds phrasing from §2.
4. `SEO-AEO-GEO-2026-08-13-plan.md:389-394` — the languages ask, closed permanently.

⛔ **Correction #5 — rev. 3 got this wrong and pointed at the wrong file.** It claimed HANDOFF-9
records an expected `??` dirty tree. It does not: `grep -n '??'` and `grep -in 'dirty'` on that file
both return **zero**. (The `??` list lives in `redesign/evidence/C-07/b4-verify-full.md:100`, a frozen
C-phase evidence file, and it is already partly stale — `design_handoff_area_pages/` is a phantom.)

**Every A-target is gitignored, so no A-action changes `git status` output at all.** There was nothing
to invalidate.

**The real correction, and it follows A5, not A3/A4:** `HANDOFF-…-9.md:174` and the matching
**`.gitignore` comment block** both assert *"28 of its 52 files already exist byte-identically under
`public/images/`"* about `photos-rahma-therapy/`. After A5 that directory is gone. Update both.

⚠️ `src/lib/maintenance.ts` is cited from **111 documents**. ⛔ **Do not mass-edit.** Fix only
`AGENTS.md` and the two SEO plans — the three anyone reads.

---

## 4 — Stamp exactly four files

Rev. 2 proposed ~60. Stamp only the ones with **nameable harm**:

| File | Concrete harm |
|---|---|
| ⛔ `PER-PAGE-GOAL-COMMANDS.md` | 65 KB of **runnable** `/goal` commands for a retired programme — the most dangerous file here to follow by accident |
| ⛔ `MAIN-AGENT-CONTEXT.md` | Says *"Phase 6 … 5/29 pages merged, 24 to go"* — ~700 commits stale. All 29 shipped |
| `PHASE6-AUTONOMOUS-AGENT-PLAN.md` | Describes worktree tooling deleted 2026-05-16 |
| `SAFETY-NET.md` | Rollback net for a phase closed three months ago |

```markdown
> ⚠️ **HISTORICAL — <programme> closed <date>. Do not act on instructions in this file.**
> Current position: `redesign/HANDOFF-2026-08-13-IMPLEMENTATION-9.md`.
```

Stamping 42 gate reports and 14 handoffs that already point forward is ceremony. Nobody has ever been
misled by `HARDEN-RECS-privacy.md`.

---

## 5 — `redesign/README.md`, ~15 lines

⛔ **Do NOT hand-copy the 51-path protected list** — that is the same drift failure this plan
corrects, pre-loaded, in a repo shipping ~700 commits a quarter. Point at the script.

Content: HANDOFF-9 is current, everything else is history · before deleting or moving anything under
`redesign/`, run `extract-doc-citations.sh` **and** the doc→doc check — paths are cited from source
comments and SQL migrations · ⛔ **citation count is not a protection signal here: 26 recipes share
~1 MB of boilerplate that name-drops most top-level docs** · `evidence/admin-contrast/` is an **e2e
write target**, `baselines/bundle-pre-B1.json` is read at runtime.

---

## 6 — ⛔ What must not be deleted

| Protected | Why |
|---|---|
| `redesign/audits/**` (99) · `C-B-DECISIONS.md` | `AGENTS.md` never-touch — see §2 |
| `redesign/evidence/admin-contrast/` | ⛔ **e2e write target** — `e2e/admin-contrast-helpers.ts:849` builds the path via `path.join` and writes on every `pnpm test:e2e` |
| `redesign/baselines/bundle-pre-B1.json` | Read at runtime by `scripts/measure-admin-bundles.mjs:146`; `existsSync`-guarded, so deleting it **silently disables** the bundle check |
| **51 code-cited paths** | A5 §2 lists 49; two more cite recipe content *without naming a file* (`SetNewPassword.tsx:19`, `reports/page.tsx:174`). No overlap — verified |
| `per-page-deferrals/` (25) | **15 still-open commitments** — see §9 |
| `OWNER-ACTION-BACKLOG.md` + 30 Band-C progress files | Live punch-list |
| `brand-logo-assets/`, `rahma-therapy-image-replacements/` | ⛔ Closed ruling, `CLEANUP-AND-CONTRAST-plan.md §G.5`: *"a future audit must not list them as deletion candidates"* |
| `DESIGN.md`, `PRODUCT.md`, `ENGINEERING-LOG.md` | Cited from shipped code. ⚠️ `DESIGN.json` is **not** — zero code citations, contrary to rev. 2 |
| ⛔ `redesign/baselines/` — **6 named non-image files** | `bundle-pre-B1.json` read at runtime · `wcag-severity-tokens.md` cited from `tokens.css:112`. ⛔ **Never `git rm -r` this directory** — B7 |
| ⛔ `redesign/audits/` — 56 images inside it | On `AGENTS.md`'s never-touch list. Excluded from B7; needs an explicit override |
| ~~`screenshots/`, `baseline/`, `reconciliation-walk/`, the three `*-shots/`~~ | ✅ **No longer protected — Owner approved deletion 2026-08-17.** Now B7 |
| ⛔ `impeccable-v5-latest-stable.html` **AND `phase6-admin-workflow-guide.html`** | `MAIN-AGENT-CONTEXT.md:**73**` (not :71) declares **both** IMMUTABLE: *"Never edit … or …"*. Rev. 3 listed only one. ⛔ **Both are hit by B7 and neither may be repaired** — see B7 caveat 3 |

---

## 7 — Optional, and NOT recommended: the 73-file reorganisation

You asked for categorisation and moving. Here is the honest cost, so the choice is yours.

**Target:** `redesign/` root from 85 loose files to 3, sorting the rest into
`archive/{handoffs, phase-6, phase-7-gates, programme}` plus the files rev. 2 left unplaced —
which, reconciled against rev. 4's own actions, is **seven**, not nine: `AUTONOMOUS-LOG`,
`BRIEF-COMMANDS`, `DEFERRED-COMPLETENESS`, `FOUNDATION-FLOOR`, `IMAGES-NEEDED`,
`PHASE-7-THEME-RECOLOR`, `test-credentials`.
*(`subagent-chunk1-instructions` is deleted by B3; `SAFETY-NET` is stamped and stays at root by B5.)*

⛔ **Recommendation: don't.** Reasons:

- **A move breaks citations identically to a delete.** Paths are repo-root-relative, so relocating
  breaks them even with structure preserved. 73 moves = 73 citation rewrites.
- **§4's stamping already achieves the stated goal** — "don't become blockers or create confusion" —
  at zero risk.
- **The verification cannot confirm a rewrite was correct**, only that nothing dangles. A citation
  retargeted to the wrong existing file passes.
- **It reduces a directory listing one person reads.** No customer sees it.
- ✅ **The one good news:** the `.gitignore` trap is **negative** — every destination tested, nothing
  ignored, so no tracked file can silently become untracked. That risk was real and is now excluded.

If you want it anyway: one commit per archive subfolder, citation census before each, rewrite in the
same commit, gate after each.

---

## 8 — Verification

After every action:

```powershell
npx tsc --noEmit                              # 0
npx vitest run                                # 0 failed / 2501 passed, 242 files
pnpm lint                                     # 4 errors / 1 warning, THREE files
npx vitest run scripts/                       # 47 passed
node scripts/measure-admin-contrast.mjs .     # 110 (46 dark / 64 light)
node scripts/verify-admin-token-contrast.mjs  # 0
git status --porcelain -- src/ supabase/      # EMPTY
(git ls-files).Count                          # PowerShell form — see the delta rule below
```

⛔ **`wc -l` is Bash, not PowerShell.** Rev. 3 put it inside a ` ```powershell ` fence, where it does
not exist. Use `(git ls-files).Count` in PowerShell or `git ls-files | wc -l` in Bash.

### ⛔ The tracked-file check is a DELTA rule, not an absolute

Rev. 3 gave absolutes (2996 → 2993 → 1973) **and** told you to commit the plan, its evidence and a
baseline manifest — which makes the absolute wrong and, under §0.4 rule 9, forces a **false stop on
the plan's own primary gate.**

**Instead: record the count immediately before each step, and require the exact delta.**

| Step | Required delta |
|---|---|
| A2–A5, A1 (all untracked) | **0** |
| Commit 1 (edits + whatever docs you choose to commit) | `+N`, where N is the number of files you deliberately added — **count them first** |
| Commit 2 (B3) | **−3** |
| Commit 3 (B7) | **−1020** |

Any other delta is a **stop**.

### ⛔ Gate 1 does not exist yet — create it first

`extract-doc-citations.sh` is **not a file in this repo** (`git ls-files '*.sh'` → zero). It exists
only as a fenced code block at `FINDINGS-A5-reference-graph.md:131`.

⛔ **Before any verification: copy that block out to `extract-doc-citations.sh` and commit it as a
tracked script.** Until then §8 gate 1 fails with "No such file or directory", §5 would bake a broken
command into the permanent README, and §10's suggestion to delete the evidence files would destroy
**the only copy of its source.**

⛔ **The `git ls-files` count is new and is the cheapest gate here** — it catches a file silently
untracked, an interrupted `git mv`, a stray `rm` and an accidental `git add`, all in one line.

**Citation checks, both directions:**
1. `bash extract-doc-citations.sh` (A5 §3) — code→doc. Zero dangling.
2. **doc→doc** — ⛔ **resolve against the filesystem, not `git ls-files`** (otherwise it is blind to
   every untracked deletion). Compare as a **set difference** against a baseline captured *before any
   action*, and commit that baseline file so it stays auditable. Pass = **no new entries**.
   - ⛔ **Pre-approved deltas — expected, not failures. Anything beyond them is a stop:**
     **A3 adds exactly 15** (the C-21 filenames in `visual-regression-1280.md`).
     **B7 adds the screenshot references from all 48 citing files** (B7 caveat 2).
     ⛔ **Capture that manifest AFTER Commit 2, not before A1.** Commit 2 deletes
     `subagent-chunk1-instructions.md`, which is **itself one of the 48 citers** (6 citing lines) — so
     a manifest captured earlier over-counts, the B7 delta comes in short, and §0.4 rule 9 forces a
     **false stop**.
     ⛔ **Generate the manifest with the same command as the check**, and state the pass condition as
     a **subset** relation, not equality. An unspecified generator is not auditable — this audit has
     been bitten five times by bad matchers (a `--exclude-dir` tautology, a `ts|tsx` ordering bug,
     a substring false positive, `git check-ignore` on a trailing slash, and `git grep` being blind
     to untracked files).
   - ⚠️ Build the matcher with `tsx` alternated **before** `ts`, or every `page.tsx` reads as
     `page.ts` and reports dangling (this produced 353 false positives once).

⛔ **What neither gate can catch** — know these before relying on them: segment-assembled paths
(`path.join(…, "redesign", …)`); a rewrite retargeted to the wrong existing file; citations naming no
file (`"per recipe Hard rule #5"`); the `data-redesign-fake` attribute mechanism. `pnpm test:e2e` is
not in the list and is the only thing exercising the write target.

⚠️ **After A1, `pnpm build` is a full cold Turbopack build — minutes, not seconds.** Rev. 2 said "one
slower page load"; that was wrong, and it applies to every subsequent gate run.

⛔ **Nothing is pushed.** `push.followTags` is unset, so a local tag stays local — but `git push --tags`
would leak it.

---

## 9 — Promoted OUT of this plan

⛔ **These are worth more to the business than the entire declutter and do not belong in a cleanup
document.** Move them to `OWNER-ACTION-BACKLOG.md`:

- **`AdminActionMenu` trigger is 36px — below the 44px accessibility floor — on every admin page.**
  A live WCAG failure.
- `AdminErrorBoundary` fallback lacks `role="alert"`.
- Therapist dashboard missing its gender-match chip and customer-notes block.
- 12 further still-open deferrals; role create/delete and password-reset unshipped with live FAKE
  markers.
- Repo-wide oklch token drift — 98 files / 679 occurrences.

---

## 10 — Honest accounting

| | |
|---|---|
| Disk **freed** | **~8.60 GB** — `.next` 8.4 GB · 136 MB screenshots · 57 MB caches · 33 MB Playwright · 24.65 MB C-21 |
| Disk **moved, not freed** | 55 MB (A5) — relocated outside the repo, still on disk |
| Tracked files deleted | **1,023** (3 documents + 1,020 screenshots) |
| `.git` | ⛔ **unchanged at 289 MB.** `git rm` never shrinks history — which is why all 1,023 stay recoverable. ⛔ **And only if §0.0's backup was made.** The 136 MB is a **working-tree** saving |
| ⛔ **This plan's own footprint** | `redesign/declutter-2026-08-17/` is **11 files**, becoming an **18th** subdirectory of the directory being decluttered. Plus the plan and the extracted script: **+13 tracked**. So the true net is **−1,023 +13 = −1,010** |
| ⛔ **Do NOT delete the evidence afterwards** | Rev. 3 suggested reducing to the plan alone. ⛔ **That would destroy the only copy of `extract-doc-citations.sh`'s source** (inside `FINDINGS-A5`) — the plan's own primary gate. Keep `FINDINGS-A5` at minimum, or extract the script to a tracked file first (§8) |

**The forward-looking question, now sharper.** Deleting 1,020 screenshots frees the working tree but
leaves all 289 MB of them in `.git` forever — because that is what makes the deletion safe. So the
recurrence is not prevented by B7; it is only paused. ⛔ **The one change that would prevent it: stop
committing screenshot evidence.** Add `*.png` under evidence paths to `.gitignore` and keep captures
local, exactly as `redesign/evidence/C-21/*.png` already does — a precedent this repo set deliberately
and then never reused. Owner's call, and it is the only structural fix available.

---

## 11 — Corrections to rev. 2 (honest record)

Wrong figures, now fixed: "13 superseded handoffs" → **15 `HANDOFF-*` at root, 14 superseded** ·
"root 85 → 3" → rev. 2's tree actually delivered **85 → 12** · `screenshots/` "88.5 MB" → **94 MB**
(88.5 was a subset figure) · "905 screenshots / 126 MB" → 959 files / ~123 MiB · frozen counts
`evidence/` 17 → **15**, `briefs/` 10 → **9**, `baselines/` **2 code-cited** (of 6 non-image files —
rev. 3 blurred those two counts) · "load-bearing ~2,990" →
**2,993** · "7 groups ~8.5 GB" → those 7 total **90 MB** · "tree clean" → 3 untracked entries ·
`DESIGN.json` "cited from code" → **zero** citations · write target attributed to the spec →
**`admin-contrast-helpers.ts:849`**.

⛔ **The `briefs/` error was the same substring false positive A3 had already documented**
(`bookings-brief.md` matching `C-02-recurring-bookings-brief.md`). The author reproduced the exact bug
this plan criticises. **Treat every count in any revision of this document as a claim to recompute.**

---

## 12 — Evidence index

`redesign/declutter-2026-08-17/`

| File | What |
|---|---|
| `FINDINGS-A1-documents.md` | `redesign/` loose files + `plans/` |
| `FINDINGS-A2-visual-evidence.md` | Screenshots, evidence, baselines |
| `FINDINGS-A3-process-artifacts.md` | Audits, briefs, per-page-*, backend-plans |
| `FINDINGS-A4-outside-redesign.md` | Root docs, asset roots, untracked bulk |
| `FINDINGS-A5-reference-graph.md` | Citation map, veto list, the code→doc extractor |
| `FINDINGS-O1-fresh-sweep.md` | The 8.5 GB residue · duplicate analysis |
| `VERIFY-V1-documents.md` | Refuted 44 of 46 deletions |
| `VERIFY-V2-irreversible.md` | Attack on the irreversible deletions |
| `VERIFY-O2-keep-list-attack.md` | Attack on the KEEP list · circular citations |
| `VERIFY-R1-plan-review.md` | ⛔ Attack on **this plan** (rev. 1-2) — 11 defects, 7 wrong figures |
| `VERIFY-R2-plan-review.md` | ⛔ Attack on **rev. 3** — **NO-GO**, 13 defects. Proved the six B7 directories pure; found the un-backed-up `.git`, the missing gate script, and the `baseline`/`baselines` trap |
