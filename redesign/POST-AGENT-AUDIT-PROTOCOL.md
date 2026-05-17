# Post-agent audit protocol — main-agent operational reference

This is the operational reference for the **main agent** (the Claude Code session you, the user, are operating in). It runs when a spawned `/goal` per-page agent finishes its session and the user signals "agent X done".

The main agent's role is **quality control + merge broker** — it does not run the per-page redesign itself. It verifies that the spawned agent did Phase 6 correctly for that page, plans a clean merge into `redesign/start-state`, identifies conflicts, presents resolutions, and performs the merge after the user approves.

Companion docs: [`PHASE6-AUTONOMOUS-AGENT-PLAN.md`](PHASE6-AUTONOMOUS-AGENT-PLAN.md) (overall plan), [`LAUNCH-SHEET.md`](LAUNCH-SHEET.md) (per-page launch reference), [`per-page-recipes/<slug>-recipe.md`](per-page-recipes/) (the contract for each spawned agent).

---

## Section 1 — What the main agent receives at handoff

When the user says "agent for `<slug>` done", the main agent has access to:

| Input | Path / source | Purpose |
|---|---|---|
| Worktree state | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-<slug>-redesign\` | git diff target |
| Spawned agent's recipe | `<worktree>\redesign\per-page-recipes\<slug>-recipe.md` | the contract — verify against this |
| Spawned agent's progress file | `<worktree>\redesign\per-page-progress\<slug>-progress.md` | step-by-step completion log |
| Spawned agent's transcript | the chat history the user paste-shares | source of truth for anchors |
| Final `HANDOFF_READY` message | last assistant message in the spawned session | summary + URL + paths |
| Scope file | `<worktree>\redesign\per-page-scope\<slug>-scope.md` | the agent's declared scope |
| Deferral file | `<worktree>\redesign\per-page-deferrals\<slug>-deferrals.md` | Phase-7-bridge open questions |
| PER-PAGE-SCORES.md additions | `<worktree>\redesign\PER-PAGE-SCORES.md` | appended audit + critique sections |
| Screenshots | `<worktree>\redesign\screenshots\<slug>-redesign\` | visual evidence per step |
| HARDEN recommendations | `<worktree>\redesign\HARDEN-RECS-<slug>.md` | Step 9 output |

**Important:** the spawned agent's *internal subagent turns* (Step 12a + 12b) do NOT appear in the user-shared transcript. Only the subagent's *returned summary* lands in the main session transcript. So when verifying audit + critique scores, look at PER-PAGE-SCORES.md (the persistent record), not the transcript.

---

## Section 2 — Quality-control checklist (per-page, run before approving)

Run through this checklist top to bottom. Any failure → don't merge yet; either re-dispatch the agent with the fix or escalate to the user.

### 2A — Recipe contract adherence

- [ ] **All quick-reference anchors emitted.** Open `<worktree>\redesign\per-page-recipes\<slug>-recipe.md`, find the `# /goal evaluator quick-reference` section, read the numbered anchor list. Cross-check each anchor literal against the transcript the user shares. Every anchor must appear, each preceded by the tool output that proves it (anti-fabrication rule). Missing anchors → re-dispatch the spawned agent to complete those steps.
- [ ] **STUCK / TURN_CAP_REACHED not emitted.** If either appears in the transcript, the agent did not complete — go to Section 5 (Failed-agent recovery).
- [ ] **HANDOFF_READY — awaiting user approval** is the final literal line in the transcript.

### 2B — Scope hygiene

- [ ] **SCOPE_CLEAN emitted** (or `SCOPE_VIOLATION:` flagged — if flagged, the agent already stopped; investigate the violation).
- [ ] **`git diff --stat` in the worktree only touches files in the recipe's "Files to edit" list.** Run:
  ```powershell
  cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-<slug>-redesign"
  git diff --stat
  ```
  Compare against the recipe's Context table "Source files to edit" + the recipe's `## Hard rules` "NEVER modify" list. Any file in the NEVER-touch list that has changes → scope violation; do not merge.
- [ ] **No new untracked files outside scope.** Run `git status --short` in the worktree. Expected untracked files (these are OK):
  - `redesign/screenshots/<slug>-redesign/*.png` — Step 7, 7b, 8, 11b, 12c outputs
  - `redesign/per-page-scope/<slug>-scope.md` — Step 3 output
  - `redesign/per-page-deferrals/<slug>-deferrals.md` — Step 13 output
  - `redesign/HARDEN-RECS-<slug>.md` — Step 9 output
  - `redesign/baseline/<slug>-adapt-after-{mobile,tablet}.png` — Step 8 output

  Anything else untracked → ask the agent why, or treat as a scope violation.

### 2C — Audit + critique fidelity

- [ ] **PER-PAGE-SCORES.md has both `## <slug> — audit` and `## <slug> — critique` headings appended.** Run:
  ```powershell
  Select-String -Path "<worktree>\redesign\PER-PAGE-SCORES.md" -Pattern "^## <slug> —"
  ```
  Two hits expected.
- [ ] **Audit section contains all required subsections:** 5 dimension scores, P0/P1/P2/P3 findings (each on its own line with file:line refs), Backend status, **P1 (tag for Phase 7 gauntlet):**, **BUSINESS-COMPLETENESS impact:**.
- [ ] **Critique section contains:** 10 Nielsen heuristic scores, AI-slop verdict (PASS / REGRESSED / FAIL), brief commentary.
- [ ] **Subagent output is in the transcript verbatim**, not paraphrased. The main agent's checklist line for Step 12a + 12b says "Print the appended section to chat verbatim" — confirm that print happened.
- [ ] **No `P0_FOUND:` in transcript.** If `P0_FOUND` was emitted, the agent stopped before critique; either fix-now (re-dispatch to address P0) or defer (note in deferrals, accept the page with P0 outstanding — flagged for Phase 7).

### 2D — Smoke test + functional preservation

- [ ] **`SMOKE_TEST: all PASS`** in transcript. Any FAIL → investigate per-item; do not merge until resolved.
- [ ] **Brief's Feature Preservation Manifest** items each checked in the transcript's Step 12c output. Open the brief, read the Manifest, cross-check each item is in the smoke-test checklist with a PASS.

### 2E — Forward-looking artifacts

- [ ] **Deferral file exists** at `<worktree>\redesign\per-page-deferrals\<slug>-deferrals.md`. Even if empty, the sentinel `(no deferrals — Phase 6 closed cleanly for <slug>)` should be present. Missing file → re-dispatch the agent to write it; it's the Phase 6 → Phase 7 bridge.
- [ ] **Deferrals content reviewed** if non-empty. Each deferred question should have: Source, Verbatim, Defer-to (Phase 7 / 8 / post-launch), Why deferred, Provisional Phase 6 answer used. Anything that should NOT be deferred (e.g. an actual brief contradiction the agent skipped) → re-dispatch.

### 2F — Screenshot evidence

- [ ] **Step 7 baseline screenshots**: `<slug>-redesign/chunk1-{1440,768,375}-default.png` + any page-specific state shots from the recipe.
- [ ] **Step 7 per-axis screenshots**: `chunk1-1440-after-<axis>.png` — one per axis listed in `AXES_APPLIED:`.
- [ ] **Step 7 post-axes screenshots**: `<slug>-post-axes-{375,768,1440}.png`.
- [ ] **Step 7b polish-final screenshots**: `<slug>-polish-final-{375,768,1440}.png`.
- [ ] **Step 8 adapt-after screenshots**: `<slug>-adapt-after-{mobile,tablet}.png` in `/redesign/baseline/`.
- [ ] **Step 11b final screenshots**: `<slug>-final-{375,768,1440}.png` + any page-specific functional shots (e.g. login's `login-success-redirect.png`).

---

## Section 3 — Merge protocol (success path, after user approves)

The user has reviewed the audit + critique + smoke test + handoff message and explicitly typed "approved". Now:

```powershell
$slug = "<SLUG>"
$mainTree = "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor"
$worktree = "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-$slug-redesign"

# 1. In the worktree: stage scoped files by name. NEVER `git add .` or `git add -A`.
cd $worktree
git diff --stat                         # final review of what's about to be staged
# git add <scoped-file-1> <scoped-file-2> ...  # explicit names from the recipe's "Files to edit" list

# 2. Commit with the scoped message (use HEREDOC for multiline if needed; single-line is fine)
git commit -m "redesign: $slug"

# 3. Back to main tree, fast-forward merge
cd $mainTree
git merge --ff-only "agent/$slug-redesign"

# 4. Verify the merge
git log --oneline -3 redesign/start-state
git status --short
```

If `git merge --ff-only` fails with "would be overwritten":
- Main tree has uncommitted edits on a file the agent branch changed.
- Run `git status` in main tree; identify the file.
- If the main-tree edit is stale or intentional throwaway → `git restore <file>` then retry merge.
- Otherwise → stash main-tree changes (`git stash`), merge, then `git stash pop` and resolve any conflict manually.

### 3A — Worktree cleanup after merge

> **NEVER `Remove-Item -Recurse -Force` on a worktree.** Worktree `node_modules/` is full of pnpm junctions into main tree's `.pnpm/<pkg>@<ver>/`. PowerShell's recursive force-remove follows them and deletes the real packages in main (canonical [pnpm/pnpm#10707](https://github.com/pnpm/pnpm/issues/10707)). On 2026-05-16 this destroyed `@alloc+quick-lru@5.2.0` + ~6 other `.pnpm/` entries; the next worktree's webpack pipeline then crashed. Use the pattern below.

**Prerequisite (one-time, host-wide; applied 2026-05-16):** `git config --global core.longpaths true` — lets `git worktree remove --force` handle pnpm's deeply-nested long paths in one fast pass.

```powershell
# Kill processes (by worktree path + by per-page port — look up <port> in LAUNCH-SHEET §1b).
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*rahmatherapy-$slug-redesign*" -and $_.Name -ne "powershell.exe" -and $_.Name -ne "pwsh.exe" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-NetTCPConnection -LocalPort <port> -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

# Remove worktree — git first, Node fs.rmSync fallback. Both treat junctions as links; never followed.
git -C $mainTree worktree remove --force $worktree 2>$null
if (Test-Path -LiteralPath $worktree) {
    node -e "require('fs').rmSync(process.argv[1], { recursive: true, force: true })" -- $worktree
}
git -C $mainTree worktree prune
git -C $mainTree branch -d "agent/$slug-redesign"

# Auto-heal main — hybrid: 10-package leaf sweep, escalate to --force if damaged, else --frozen-lockfile.
# `--frozen-lockfile` alone only checks "is the package directory installed?" — it does NOT detect
# empty-leaf damage (directory preserved, files gone).
#
# Confirmed parallel-worktree-side-effect (2026-05-17 observation, after 5 consecutive worktree-merge
# cleanups in one session): every cleanup triggered the --force escalation. The first 4 (with concurrent
# worktrees in flight) reported 10/10 sampled leaves damaged; the last (after zero in-flight worktrees)
# reported 8/10. The damage is concurrent-worktree junctions reaching back into main tree's .pnpm/ and
# polluting it as worktrees come and go. Earlier "cumulative past Remove-Item runs" hypothesis is
# superseded by this pattern.
#
# Mitigation upstream: spawning a worktree now runs `pnpm install --frozen-lockfile --ignore-scripts`
# post-robocopy (see MAIN-AGENT-CONTEXT.md §5A step 3, added 2026-05-17) — once worktrees no longer share
# .pnpm/ junctions with main, main's --force runs shouldn't ripple. Validate on the next batch.
#
# Clean ≈3s; damaged ≈60-90s (pnpm install --force re-fetches every package, ~1280 packages).
$pkgsToCheck = @(
    @{prefix='next@16.';               leaf='next'},
    @{prefix='react@19';               leaf='react'},
    @{prefix='react-dom@19';           leaf='react-dom'},
    @{prefix='@tailwindcss+postcss@';  leaf='@tailwindcss/postcss'},
    @{prefix='tailwindcss@';           leaf='tailwindcss'},
    @{prefix='postcss@8';              leaf='postcss'},
    @{prefix='typescript@';            leaf='typescript'},
    @{prefix='@supabase+supabase-js@'; leaf='@supabase/supabase-js'},
    @{prefix='lucide-react@';          leaf='lucide-react'},
    @{prefix='@alloc+quick-lru@';      leaf='@alloc/quick-lru'}
)
$damaged = @()
foreach ($p in $pkgsToCheck) {
    $dir = Get-ChildItem "$mainTree\node_modules\.pnpm" -Directory -ErrorAction SilentlyContinue | Where-Object Name -like "$($p.prefix)*" | Select-Object -First 1
    if (-not $dir) { $damaged += "$($p.prefix) (MISSING dir)"; continue }
    $pkgJson = "$($dir.FullName)\node_modules\$($p.leaf)\package.json"
    $info = Get-Item -LiteralPath $pkgJson -ErrorAction SilentlyContinue
    if (-not $info -or $info.Length -eq 0) { $damaged += "$($p.prefix) (EMPTY leaf)" }
}
if ($damaged.Count -gt 0) {
    Write-Host "Damage in $($damaged.Count) leaf(ves) — escalating to --force:"
    $damaged | ForEach-Object { Write-Host "  - $_" }
    pnpm -C $mainTree install --force --ignore-scripts
} else {
    pnpm -C $mainTree install --frozen-lockfile --ignore-scripts
}
```

### 3B — Update tracking

Update `redesign/IMPLEMENTATION-PLAN.md`:
- Mark the row `[x]` for this page with the commit hash.
- Advance the "Currently on:" line at the top of the file to the next undone row.

Move on to the next page in the wave, or signal end-of-wave for reconciliation.

---

## Section 4 — Conflict-resolution playbook

Conflicts almost always arise from shared infrastructure where two or more agents touched the same file. Below are the known shapes and how to resolve them.

### 4A — Dashboard variants share infrastructure

Files involved: `src/app/admin/dashboard/dashboard-cards.tsx`, `dashboard-header.tsx`, `dashboard-filters-client.tsx`, `attention-group-client.tsx`, `demand-trend-client.tsx`, `src/app/admin/components/notification-bell.tsx`.

Resolution rules:
1. **Owner/Admin variant (`dashboard-owner-admin`) runs first** per LAUNCH-SHEET Wave 2 ordering. It lands the canonical carry-forward fixes (`border-l-4` removal, `bg-black` removal, raw avatar hex tokenisation, raw chart colour tokenisation, Recharts `minHeight: 288`).
2. **Coordinator and Therapist variants run after.** Their recipes' Step 3 framing already says "check whether the Owner/Admin carry-forward fixes have already landed; if yes, skip those edits here; if no, land them once."
3. **If a second variant tries to re-land a carry-forward fix** that's already in `redesign/start-state` from the Owner/Admin merge — that's a no-op diff and merges cleanly.
4. **If a second variant introduces variant-specific edits** to a shared file (e.g. Coordinator hides the Export Ghost link in `dashboard-header.tsx`) — accept those edits; they're net-new.
5. **If a third variant's diff conflicts with both prior variants' edits** to the same line — escalate: read all three recipes' Files-to-edit notes for that line, present the user with options.

### 4B — Emails ↔ email-templates tab shell

Files involved: `src/app/admin/emails/page.tsx`, `src/app/admin/emails/components/` (net-new directory from email-templates session), `src/app/admin/email-templates/` (helper routes).

Resolution rule (per recipe Hard rule #8 on email-templates-recipe):
1. **`emails` session runs FIRST.** It owns `src/app/admin/emails/page.tsx` outright — lays the 3-tab shell (Delivery / Reminders / Templates), Delivery body, Reminders body, and a literal Templates-tab stub containing the marker `Templates tab body — populated by the email-templates session`.
2. **`email-templates` session runs SECOND.** Its edit to `emails/page.tsx` is limited to a 2-line scoped swap: import `<TemplatesTab />` from `./components`, replace the stub JSX with `<TemplatesTab />`. Tab shell + other tab bodies untouched.
3. **At merge time:** `emails` lands its tab-shell version first. `email-templates` then merges with the 2-line swap. The swap should be a clean diff (only those 2 lines changed in `page.tsx`) plus the new `components/` directory + helper routes — no conflict if both recipes were followed.
4. **If `email-templates` modified more than the 2 scoped lines** in `emails/page.tsx` — that's a scope violation; do not merge until the agent reverts the over-edit.

### 4C — 00-shared-components conflicts

`00-shared-components` is already merged (commit `aa76451` + `23b84bf`). All 24 remaining per-page agents inherit those primitives. New shared-component changes are NOT expected during Phase 6.

**If a per-page agent edits files inside `src/components/`** (e.g. `src/components/ui/card.tsx`, `AdminPanel.tsx`, `AdminEntityRow.tsx`) — that's a scope violation per every recipe's "Files to NEVER touch" list. Reject, ask the agent to revert + re-run with the correct scoped pattern.

**If shared infrastructure does need to evolve** mid-Phase-6, that's a recipe-level issue: stop the wave, surface the gap to the user, decide whether to amend `00-shared-components` (which requires a new mini-session) or adapt the per-page recipe.

### 4D — Recipe edits land mid-batch

If the recipes themselves get edited mid-Phase-6 (e.g. the user spots a gap in the directives + we patch all 26 recipes), worktrees spawned BEFORE the recipe edit are out of date.

Resolution:
1. **Worktrees not yet started** — when the user launches them next, they'll pick up the updated recipe automatically (recipe is copied into the worktree at setup time per LAUNCH-SHEET 1a).
2. **Worktrees in-flight** (an agent is currently running with the old recipe) — let it finish. Verify the gap the new recipe addresses isn't catastrophic for this page; if it is, ask the user whether to clear + restart with new recipe.
3. **Worktrees finished but not yet merged** — review the diff against the new recipe expectations. If the agent's work satisfies the new spec by accident (often does), merge. If not, either accept the gap (note in deferrals) or re-dispatch into the same worktree with corrective scope.

### 4E — When in doubt, present the options

For any conflict the main agent can't resolve mechanically, **don't guess**. Present the user with:
1. The conflict (which files, which lines, which agents).
2. Each plausible resolution as a numbered option.
3. The user's expected impact per option (lost work, additional work, risk of regression).
4. The main agent's recommendation with one-sentence reasoning.

The user decides; the main agent executes.

---

## Section 5 — Failed-agent recovery

The spawned agent didn't reach `HANDOFF_READY`. The transcript ends with one of these markers; pick the matching response.

### 5A — `STUCK: <step N> — <reason>`

Read the reason. Common causes + responses:

| Reason category | Response |
|---|---|
| Brief contradicts codebase | Resolve the contradiction with the user, then re-dispatch into the SAME worktree with explicit corrective direction in the `/goal` command (e.g. "Brief §X says Y, codebase says Z; treat Y as canonical and update the code to match"). |
| Missing migration / DB column | Verify the migration is committed to the main tree; verify the worktree has it (worktree pulls main-tree files at spawn); if missing, sync the migration into the worktree, then re-dispatch. |
| Missing test credential | Verify `redesign/test-credentials.md` is in the worktree (it should have been copied at setup). If missing, copy from main tree, re-dispatch. |
| Skill invocation failed mid-run (no in-recipe Step 0 anymore — skills are pre-verified by the user's `/skills` preflight in LAUNCH-SHEET §0b) | Have the user re-run `/skills` in the spawned session and confirm `impeccable` + `ralph-loop` are listed. If missing, the plugin isn't loaded — fix in user's CC config, restart spawned session, re-dispatch. |
| Axis didn't resolve problem (Step 7) | The brief shape may be at fault. Read the agent's reasoning; if a different axis would work, suggest it in the re-dispatch. If no axis would work, the brief itself needs revising — escalate. |
| FAKE backend not yet built | Confirm with the user whether to proceed with FAKE markers (the recipe's default), or defer the page until the BUILD plan lands. |

**Re-dispatch shape:** stay in the same worktree (don't delete + recreate). Send a refreshed `/goal` command that references the same recipe but adds corrective context at the top, e.g.:
```
/goal CORRECTIVE DISPATCH (continuation of previous STUCK at step <N>): <one-sentence resolution>. Resume from step <N> per the recipe at <absolute path>. [Original /goal payload follows.]
```

### 5B — `TURN_CAP_REACHED — <summary>`

Read the progress file: `<worktree>\redesign\per-page-progress\<slug>-progress.md`.

| Progress | Response |
|---|---|
| 10–13 of 14 steps complete | Raise the cap, re-dispatch. Append `Stop after 80 turns` (instead of 40) to the original /goal command. |
| 6–9 of 14 steps complete | Something's slow but progressing — usually craft or polish loops are eating turns. Raise cap and re-dispatch with `Stop after 100 turns`; investigate if it hits cap again. |
| 0–5 of 14 steps complete | Root-cause first. Likely the agent got stuck in a re-read loop or hit a tooling failure. Read the transcript, identify the friction point, fix it (recipe clarification, missing file, tool config), then re-dispatch into the same worktree. |

### 5C — `P0_FOUND: <list>`

The subagent's audit flagged a P0 (blocks-release) finding. Step 12a stops the recipe there — by design.

Options to present to the user:
1. **Fix now** — re-dispatch the spawned agent with scope expanded to address the P0 (e.g. "fix the keyboard-trap in the AdminSheet at file:line"). Run audit again afterward.
2. **Defer** — accept the page with P0 outstanding; the deferral file records the P0; Phase 7 gauntlet will see it. Merge can still happen.
3. **Reject** — the P0 is severe enough to consider the entire redesign of this page broken; revert and re-launch with a corrected brief.

Main agent recommends based on the P0's severity + scope. User decides.

---

## Section 6 — End-of-wave reconciliation

Run after each LAUNCH-SHEET Section 3 wave completes (all pages in the wave merged into `redesign/start-state`).

### 6A — Cross-page consistency check

Especially important for waves with shared infrastructure (dashboard variants, emails + email-templates).

1. **Spin up the main-tree dev server** at port 3000.
2. **Sign in as each role that touches the wave's pages** (Owner, Admin, Coordinator, Therapist as relevant).
3. **Visit each merged page in the wave at 1440px.** Take a quick screenshot or visual comparison.
4. **Confirm sibling pages look like siblings**, not three different products:
   - Three dashboards: same chrome (header, nav, filter strip), variant-appropriate content blocks.
   - Emails + email-templates: same tab shell, swap-in worked, no orphan stub marker.
5. **Note any divergence** in `redesign/WAVE-RECONCILIATION.md` (create this file if not yet present):
   - Wave number + pages merged
   - Divergence found
   - Severity (cosmetic / functional / blocks-release)
   - Decision (fix-now / defer to Phase 7 / accept)

### 6B — Decide whether to follow-up

| Divergence severity | Action |
|---|---|
| None | Proceed to next wave. |
| Cosmetic only | Note in WAVE-RECONCILIATION.md, accept, proceed. Phase 7 will catch in /impeccable audit admin. |
| Functional (one page's behavior contradicts another's) | Stop the next wave; resolve before launching. Usually requires a small mini-session against the shared file. |
| Blocks-release | Stop everything; surface to user; decide whether to roll back the breaking page or push forward with a fix. |

---

## Section 7 — End-of-batch (post-Phase-6) cleanup + Phase 7 prep

When all 24 remaining pages are merged (29 total pages, 5 already merged at the start):

1. **Tag the resulting state**:
   ```
   git tag -a phase6-complete -m "Phase 6 implementation complete: all 29 admin pages redesigned"
   git push origin phase6-complete   # if remote sync desired
   ```

2. **Run an end-of-Phase-6 reconciliation** across all pages:
   - Sign in as each of the 5 roles
   - Walk every admin page at 1440 + 375
   - Note any cross-page inconsistencies in `redesign/WAVE-RECONCILIATION.md`

3. **Aggregate the deferrals**:
   - All 26 `<slug>-deferrals.md` files are now populated (some may be "(no deferrals — Phase 6 closed cleanly)").
   - Phase 7 `/impeccable audit admin` reads them globally.
   - The main agent should prepare a summary table: "Pages with deferrals: N. Pages clean: M. Top deferral themes: …"

4. **Verify BUSINESS-COMPLETENESS Track A flips**:
   - Read `BUSINESS-COMPLETENESS.md` Section 2A.
   - Items 2A-6 + 2A-9 (currently PARTIAL with login coverage) should now be HANDLED if every form-bearing page's audit logged the "BUSINESS-COMPLETENESS impact" entry. Verify by grep over PER-PAGE-SCORES.md.
   - Update BUSINESS-COMPLETENESS.md status flags accordingly.

5. **Hand off to Phase 7**:
   - Phase 7 entry point is `/impeccable audit admin` per `impeccable-v5-latest-stable.html`.
   - It reads all 26 deferrals + PER-PAGE-SCORES.md to produce `FINAL-AUDIT.md`.
   - The main agent dispatches Phase 7 (or the user does manually) once Phase 6 is fully merged + reconciled.

---

## Appendix A — Windows PowerShell snippets (copy/paste)

```powershell
# Slug + paths used across the protocol — set once per agent run
$slug = "<SLUG>"
$mainTree = "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor"
$worktree = "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-$slug-redesign"

# Quality-control: confirm scope-clean diff
cd $worktree
git diff --stat
git status --short

# Quality-control: PER-PAGE-SCORES heading check
Select-String -Path "$worktree\redesign\PER-PAGE-SCORES.md" -Pattern "^## $slug —"

# Quality-control: deferrals file exists
Test-Path "$worktree\redesign\per-page-deferrals\$slug-deferrals.md"
Get-Content "$worktree\redesign\per-page-deferrals\$slug-deferrals.md"

# Quality-control: screenshot inventory
Get-ChildItem "$worktree\redesign\screenshots\$slug-redesign\" -Name

# Merge (after user approves)
cd $mainTree
git merge --ff-only "agent/$slug-redesign"
git log --oneline -3 redesign/start-state

# Cleanup — see §3A.
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*rahmatherapy-$slug-redesign*" -and $_.Name -ne "powershell.exe" -and $_.Name -ne "pwsh.exe" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-NetTCPConnection -LocalPort <port> -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
git -C $mainTree worktree remove --force $worktree 2>$null
if (Test-Path -LiteralPath $worktree) { node -e "require('fs').rmSync(process.argv[1], { recursive: true, force: true })" -- $worktree }
git -C $mainTree worktree prune
git -C $mainTree branch -d "agent/$slug-redesign"
# Auto-heal: paste §3A's hybrid leaf-sweep + escalation block here. NEVER use bare --frozen-lockfile —
# it misses empty-leaf damage (directory exists, files wiped). The sweep is required.
```

## Appendix B — Common transcript anchors and what they mean

| Anchor | Source step | Meaning |
|---|---|---|
| `PRODUCT.md register: product` | Step 1 | Re-prime confirmed |
| `BRIEF_S6_QUOTE: ...` | Step 1 | Verbatim quote proves the brief was actually re-read |
| `BROKEN_GUARD_RESULT: ...` | Step 2 | Track A BROKEN items checked |
| `SCOPE_PROPOSAL: ...` | Step 3 | Scope file written |
| `BACKEND_FAKE_SURFACES: ...` | Step 3 (FAKE pages only) | DOM markers for FAKE-backend surfaces |
| `CRAFT_COMPLETE` | Step 4 | Craft skill finished |
| `PAGE-POLISH-COMPLETE` (inside `<promise>` tags) | Step 5 | Ralph polish loop completed |
| `DEV_SERVER_READY at http://localhost:<port>` | Step 6 | Dev server up at the per-page port |
| `AXES_APPLIED: <list>` | Step 7 | Multi-axis polish: 2–4 axes applied |
| `POLISH_ISSUES_ITER_2: none — clean` (or list) | Step 7b | Visual polish loop concluded |
| `HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false` | Step 8 | Adapt verified no horizontal scroll |
| `TOKEN_DRIFT: 0` (or each drift addressed) | Step 11a | Token-drift lint clean |
| `CONSOLE_NEW_ERRORS: 0` | Step 11c | No new console errors vs baseline |
| `## <slug> — audit` / `## <slug> — critique` | Step 12a / 12b | Subagent audit + critique appended |
| `SMOKE_TEST: all PASS` | Step 12c | Feature Preservation Manifest verified |
| `SCOPE_CLEAN: only scoped files changed` | Step 13 | Final scope check |
| `HANDOFF_READY — awaiting user approval` | Step 13 | Agent is done; main agent's turn |

Plus per-page anchors (the recipe's quick-reference will list these — they vary by recipe):
- `RECHARTS_WARNINGS: 0` (reports)
- `BORDER_L_4: 0` (booking-detail, dashboards)
- `BG_WHITE_HITS: 0` (calendar, settings, role-detail)
- `RAW_RED_HITS: 0` (settings)
- `BACKDROP_BLUR_HITS: 0` (settings)
- `IMAGES_NEEDED_DELTA:` (calendar)
- `AUDIT_WRITES_ON_LOAD: 0` (audit)
- `REDACTION_REGEX_VERBATIM: yes` (audit)
- `DANGEROUSLY_SET_INNER_HTML_HITS: 0` (password-reset)
- `UNIFORM_RESPONSE_PASS: true` (password-reset)
- `SERVER_ONLY_GUARD: no client-side templates.ts imports` (email-templates)
- `MULTI_COLUMN_DESKTOP: false` (dashboard-therapist)
- `HORIZONTAL_SCROLL_DESKTOP: false` (dashboard-therapist)
- `CASEY_FIX_WIRED:` (dashboard-therapist)
- `EXPORT_LINK_PRESENT: false` (dashboard-coordinator)

---

End of protocol. Update as the operating model evolves.
