# VERIFY R2 — second adversarial review of the plan

**Date:** 2026-08-17 · **Target:** rev. 3 (403 lines) · **Verdict: ⛔ NO-GO as written**
**13 defects, 2 capable of real data loss.** All six required fixes applied in rev. 4.
Top claims independently re-verified by the orchestrator.

---

## 1 — ⛔ The finding that matters most: the recoverability argument rests on one un-backed-up `.git`

B7's entire safety case is *"`git rm` leaves every one recoverable from git history forever."*

**Verified:**

```
git remote                                          → origin (only)
git merge-base --is-ancestor 3eb2939 origin/master   → FALSE
git worktree list                                    → 1
```

⛔ **The 1,020 screenshot blobs AND the 4 unpushed commits — including Phase 12 — exist in exactly one
place: this `.git`.** No remote copy is possible (nothing may be pushed), no second clone, no backup.

And §0.1 forbade `git reset --hard` **but not** `git reflog expire` / `git gc --prune=now` — the pair
that makes a bad reset permanent — nor `git branch -D`.

**A 289 MB copy of `.git` costs nothing against the 8.4 GB being freed. The plan never asked for one.**
→ Now §0.0, action zero.

---

## 2 — Defects

| # | Severity | Defect |
|---|---|---|
| **D1** | CRITICAL | `AGENTS.md`'s final paragraph is **one sentence carrying five protections**; rev. 3's must-survive list named **three**. Omitted: the *"never stash/restore/checkout to clean the intentionally-dirty working tree"* clause and the **LIVE-Supabase HARD-STOP** clause. ⛔ Compounding: §0.1 did not forbid `git stash` or `git checkout <branch>` either — so the plan authorised editing away the repo's only stash prohibition while its replacement failed to cover it. Also: §2 said "change exactly two things" then prescribed a third |
| **D2** | CRITICAL | ⛔ **`extract-doc-citations.sh` does not exist.** `git ls-files '*.sh'` → **0**. It is only a fenced block in `FINDINGS-A5:131`. So §8's primary gate fails with "No such file"; §5 would bake the broken command into the permanent README; §10 would delete its only source. Plus §8's absolute counts (2996→2993→1973) contradict its own instruction to commit the plan, evidence and baseline — forcing a **false stop** under rule 9. And `wc -l` sat inside a ` ```powershell ` fence, where it does not exist |
| **D3** | HIGH | §0 covered **Bash only**, in a PowerShell-primary environment. ⛔ **`rm -rf` does not exist in PowerShell** — A1/A2/A4 would error, and the executor would reach for `Remove-Item -Recurse -Force`, unsanctioned. Missing: `Remove-Item -Recurse -Force`, `robocopy /MIR`, `del /f /s /q`, `rmdir /s /q`, `Clear-Content`, `New-Item -Force`, plus `git stash`, `checkout <branch>`/`switch`, `rm -r --cached`, `reflog expire`, `gc --prune=now`, `branch -D`, `worktree remove --force`, `filter-branch`, `update-ref -d` |
| **D4** | HIGH | ⛔ **The `baseline`/`baselines` tab-completion trap.** `baseline` is a **strict prefix** of `baselines`. Tab-completing `redesign/base` gives `baseline`; **one more Tab gives `baselines`** — the command §0.1 calls destructive, which would silently disable the bundle gate (`existsSync`-guarded) and break `tokens.css:112`. "Literal paths typed in full" is no defence: a completed prefix *is* literal |
| **D5** | HIGH | §3's fifth correction pointed at the wrong file on a false premise. `grep -n '??'` and `grep -in 'dirty'` on HANDOFF-9 → **zero hits each**. The `??` list is in `evidence/C-07/b4-verify-full.md:100`. **Every A-target is gitignored, so no A-action changes `git status` at all.** The real staleness follows **A5**: HANDOFF-9:174 *and the `.gitignore` comment block* both assert the 28-of-52 photos fact |
| **D6** | MED-HIGH | `MAIN-AGENT-CONTEXT.md:**73**` (not :71) declares **two** files IMMUTABLE. **`phase6-admin-workflow-guide.html` was absent from §6** — and B7 breaks both: 58 citing lines in one, 15 in the other, **unrepairable** because the files may not be edited |
| **D7** | MED | B7's citation figure was the full-path-only number, mislabelled. Real: **48 files** (30 full-path/66 lines, 38 basename/268 lines). **All 26 recipes + 22 others**, six of them on the plan's own protected/live lists. ✅ Zero citers under `redesign/audits/` |
| **D8** | MED | The manifest could not be captured correctly in the stated order — **Commit 2 deletes one of the 48 citers**, so a manifest taken before A1 over-counts and forces a false stop. Generator never specified |
| **D9** | MED | ⛔ §0.1's `git clean` row was **factually wrong**. `.env`, `node_modules`, `photos-rahma-therapy`, C-21 are all **gitignored** — `-fd` spares them; only `-x`/`-X` reaches them. What `-fd` **does** delete: **this plan, all 10 evidence files, and `impeccable.zip`** — the entire justification for every deletion |
| **D10** | MED | A5 — the only irreversible move, 24 files existing nowhere else — had **no destination path anywhere**. A mistyped `mv` silently renames. Count wrong: **80**, not 78 (`.superpowers/brainstorm/` has 5 files, not 3) |
| **D11** | LOW-MED | Rule 7 ("one commit per action") ↔ Commit 1 bundling five · rule 3's `git rm -n` dry-run never applied in B3 or B7 · rule 5 vs `git rm -r` being inherently a parent operation |
| **D12** | LOW | A2 forbids a `tsconfig*` glob citing rule 2; A3 then uses `*.png` in a directory with a kept file. Safe in fact, inconsistent in principle |
| **D13** | LOW | §7's "9 unplaced files" list still contained `subagent-chunk1-instructions` (deleted by B3) and `SAFETY-NET` (stamped by B5) |

---

## 3 — ✅ Attack 1 FAILED: the six B7 directories are provably pure

The top suspicion — that the author caught only one instance of the `baselines/` trap — **did not
hold.**

```bash
git ls-files <dir> | grep -viE '\.(png|jpg|jpeg|webp|gif|svg)$'   → empty, all six
find <dir> -type f | grep -viE '…'                                → empty, all six (catches untracked)
git status --porcelain -uall -- <six dirs>                         → empty
git ls-files <six> | sed 's/.*\.//' | sort | uniq -c               → 1020 png, nothing else
```

| Directory | Files | Non-image | Cited from code | Write target | Verdict |
|---|---:|---:|---|---|---|
| `screenshots/` | 723 | 0 | no | no | ✅ pure |
| `baseline/` | 146 | 0 | no | no | ✅ pure (⚠️ D4) |
| `reconciliation-walk/` | 90 | 0 | no | no | ✅ pure |
| `adapt-shots/` | 50 | 0 | no | no | ✅ pure |
| `onboard-shots/` | 7 | 0 | no | no | ✅ pure |
| `polish-shots/` | 4 | 0 | no | no | ✅ pure |

Cross-checks that *could* have found something: all 1,020 are `.png` (no `.svg` importable as an
asset) · all **932 unique basenames** grepped against `src/ scripts/ e2e/ supabase/` + every root
config → **zero hits** · directory-name greps → zero in any code tree · `playwright.config.ts` has no
`snapshotPathTemplate` or `outputDir` override · every `readdirSync`/`globSync` root is `public/images`,
`src/app/admin`, `src/components/ui`, `.next/static`, `.open-next/assets` or a CLI positional · no
README, manifest or JSON capture inside any of them.

✅ **The `baselines/` exclusion is correct AND complete:** 87 tracked = 81 images + exactly 6
non-image, both load-bearing citations verified at the exact lines claimed.

---

## 4 — Numbers

✅ **Verified exact:** 1,020 screenshots and all six per-directory counts · all tracked, all `.png` ·
six-dir total 135.6 MiB · `.playwright-mcp` 316 = 167/124/25 · C-21 15 png + 1 tracked md · photos
28/24 by independent md5 · `baselines/` 6 non-image + 81 images · `audits/` 99 tracked / 56 images ·
`.next` 8.36 GiB · `.git` 289 MB · 15 `HANDOFF-*` · 85 loose root files · 17 subdirs → 18th · 4
unpushed · `3eb2939` not an ancestor of `0f8ab9d` · `maintenance.ts` exists on the remote, absent
locally · 111 citers · `tokens.css:112`, `measure-admin-bundles.mjs:146`,
`admin-contrast-helpers.ts:849` · B3 sizes · zip 284 KB untracked+unignored · all four §3 line refs.

❌ **Wrong:** A5 78 → **80** · "~30 recipes" → **48 files** · `MAIN-AGENT-CONTEXT:71` → **:73**, two
files · HANDOFF-9 `??` claim → **false** · "nine evidence files" → **ten** · the `git clean -fd` row ·
"~8.74 GB freed" → **~8.60 GB** (55 MB is moved, not freed) · "959 files / ~123 MiB" → **125.2 MiB**.

---

## 5 — Go / no-go

⛔ **NO-GO as written** — but the *intent* is sound. The six directories really are 1,020 pure tracked
PNGs with no load-bearing content and no code citations; B7 is genuinely Class A. **Attack 1 found no
defect.** The problems were in the method, the safety section, and the gates.

**Six required fixes, all applied in rev. 4:**

1. §2 — quote `AGENTS.md`'s sentence verbatim, mark the exact substring, list all five protections.
2. §0.1 — add PowerShell/cmd forms and the missing git commands; fix the `git clean` row.
3. B7 — enumerate `redesign/baseline` via `--pathspec-from-file`; add `git rm -r -n` dry-runs.
4. §8 — create `extract-doc-citations.sh`; replace absolutes with a **delta** rule; fix the shell.
5. A5 — literal destination path; 78 → 80.
6. ⛔ **§0.0 — back up `.git` before anything.**

**Four recommended, also applied:** manifest after Commit 2 · citation figure 48 with the six
protected citers named · `phase6-admin-workflow-guide.html` added to §6 at line 73 · §3's fifth
correction replaced with the real one.
