# Chunk 1 instructions for worktree subagent — login page redesign

You are a worktree-isolated subagent. This is a **test of subagent viability** for the Phase 6 admin redesign workflow. If this works, we'll parallelise 3 pages at a time. Right now we're proving it on one page: `login`.

**MAIN TREE PATH:** `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`
**YOUR WORKTREE:** you are already cd'd here (a fresh git worktree on a temp branch off `redesign/start-state`).
**PARENT BRANCH:** `redesign/start-state`
**TARGET PAGE:** `login` (page 15 of 29 in the IMPLEMENTATION-PLAN, but row 5 chronologically).

## Strict rules — read these first

1. **NO COMMITS. NO STAGING.** Not even `git add -p`. Do not touch git's index. The user reviews your worktree, decides to merge after Chunk 3. Commits happen only after explicit user approval, executed by the parent agent.
2. **Edit files only in this worktree.** Never write to the main tree path above.
3. **Tracking files** (`IMPLEMENTATION-PLAN.md`, `PER-PAGE-SCORES.md`, `AUTONOMOUS-LOG.md`, `BUSINESS-COMPLETENESS.md`) — your edits live only in this worktree's copy. They'll merge to main only if the user approves.
4. **Screenshots go to** `redesign/screenshots/login-redesign/` (relative to worktree root). Create the folder if missing.
5. **Use the Skill tool** to invoke `/impeccable` commands. If the Skill tool is not available or `/impeccable craft` isn't recognised, STOP and report immediately.
6. **Dev server: port 3001** in this worktree. The user's main dev server is on 3000 — leave it alone.
7. **Skip `/impeccable live`** — it requires interactive browser variant-swapping, which doesn't work in your context. The named-axis refines (bolder/quieter/colorize/typeset/layout/animate/delight/distill) are fine.

## STEP 0 — Skill availability check (do this FIRST, ~30 seconds)

Before any other work, verify you can invoke `/impeccable` skills. Check your available-skills list for the `impeccable` skill. If `/impeccable craft` is not invocable via the Skill tool in your subagent context, **STOP everything** and report back with: "SKILL UNAVAILABLE: [details]". Do not proceed to Step 1.

If skills are available, proceed.

## STEP 1 — Re-prime (verbatim from workflow guide, with size adaptations)

Execute the re-prime exactly as the workflow guide specifies. Read these 7 files in order:

1. `PRODUCT.md` (165 lines — read in full)
2. `redesign/RECIPE-PROGRESS.md` (~26k tokens — **OVER Read-tool 25k limit; use chunked reads**)
3. `redesign/SAFETY-NET.md` (9 lines — read in full)
4. `DESIGN.md` (445 lines — read in full; if it hits the size limit, chunk it)
5. `redesign/briefs/login-brief.md` ← the brief for THIS page only (279 lines — read in full)
6. `redesign/BASELINE-ISSUES.md` (85 lines — read in full)
7. `redesign/IMAGES-NEEDED.md` (47 lines — read in full)

**Oversize file handling — IMPORTANT**: When a `Read` returns "File content (N tokens) exceeds maximum allowed tokens (25000)", do **NOT** retry the same full read. Use `offset` and `limit` parameters to read sections, or use `Grep` to find specific patterns. Do not loop on the same failing call.

**For `redesign/RECIPE-PROGRESS.md` specifically:**
- Read lines 1–100 for structure/phase overview (`Read` with `offset: 1, limit: 100`).
- Grep for `Phase 6` and `login` to surface page-specific entries.
- That's enough for the "one sentence per file" summary — you don't need every line.

**For `redesign/IMPLEMENTATION-PLAN.md` (you'll need this in Step 3 too, ~29k tokens):**
- Read lines 1–60 for "Currently on" + overview (`Read` with `offset: 1, limit: 60`).
- Read lines 540–580 for the login row (`Read` with `offset: 540, limit: 50`).
- That's enough for both re-prime summary AND the Step 3a "Currently on" edit.

**For `redesign/BUSINESS-COMPLETENESS.md` (Step 2 BROKEN guard, 299 lines):**
- Should fit. If it doesn't, grep first: `Grep` pattern `Zone 1.*BROKEN|BROKEN.*Zone 1` to find the relevant items.

Then write your re-prime confirmation INTO YOUR FINAL REPORT (not as a separate message — there's no user to send it to mid-task). The confirmation has:

- One sentence per file telling what's in it
- The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
- The page being redesigned + its file path (cross-checked between RECON.md mentions and the brief)
- The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
- Pre-existing console errors NOT to chase (from BASELINE-ISSUES.md)
- Phase + page (should be Phase 6, page `login`)

**CONFIRMATION CHALLENGE:** Quote the SECOND sentence of `redesign/briefs/login-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, re-read from disk. This guards against summarised cache.

Self-acknowledge "primed — go" once your re-prime is solid and proceed.

## STEP 2 — Ralph Zone 1 BROKEN guard (READ-ONLY, not the batch loop)

The recipe's Ralph Zone 1 batch processor has already been run for prior pages (`00-shared-components`, `booking-new`, `bookings`). **Do NOT re-run the full Zone 1 batch loop.**

Only run the read-only BROKEN discrepancy guard:

> Read `redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

Include the BROKEN guard findings in your final report.

## STEP 3 — Step 1 framing prompt (do these activities verbatim)

Per the workflow guide's Step 1 framing prompt:

**3a.** Update the "Currently on" line in `redesign/IMPLEMENTATION-PLAN.md` to point at the `login` row (line 549 area — search for `## 15. [ ] login`). Set the file's "Currently on:" line to `5 of 29 — login` (count by chronological position: 4 done, login is row 5). **Worktree only.**

**3b.** Identify and report (before writing any code):
- Files you will edit (cross-reference the brief's `### Files to edit` table at the bottom of `redesign/briefs/login-brief.md`)
- Files you will NOT touch (from the brief's `### Files to NEVER touch`)
- Features you are preserving (the brief's `### Feature Preservation Manifest`)
- Any conflict between brief and codebase

**3c.** Write the scope contract to `redesign/per-page-scope/login-scope.md` (create the folder if needed). Format:

```markdown
## Files to edit
- [path] — [what changes]

## Files to NEVER touch
- [path] — [reason]
```

**3d.** Note responsive strategy: **mobile-first** — build 375px first, then enhance to 768 → 1440.

**3e.** Image handling: the brief specifies copying `brand-logo-assets/vector-trace-no-tagline/logo-refined.svg` → `public/images/brand/rahma/logo-refined.svg`. Copy it (already optimised SVG, no compression needed). Log to `redesign/IMAGES-NEEDED.md` only if a NEW photo is needed (it isn't — this is an existing brand asset).

**3f.** Backend FAKE marker: login has NO backend dependencies. Skip.

## STEP 4 — `/impeccable craft` for login

Invoke via Skill tool:

```
/impeccable craft redesign of admin page login
```

When craft's internal shape phase asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `redesign/briefs/login-brief.md` verbatim as your answers. Accept any expansions shape proposes. Proceed through load-references and build phases.

Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.

## STEP 5 — Required Ralph polish loop

Invoke via Skill tool:

```
/ralph-loop "Read the brief at /redesign/briefs/login-brief.md. Compare the current implementation to the brief's requirements (5 native sections + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

Run until completion-promise emits or 8 iterations exhausted. Report iteration count + what each iteration changed.

## STEP 6 — Start dev server in worktree on port 3001

```powershell
New-Item -ItemType Junction -Path node_modules -Target "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor\node_modules"
```

If the junction command fails on Windows, fall back to:
```powershell
cmd /c mklink /J node_modules "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor\node_modules"
```

If even that fails, run `pnpm install --prefer-offline` in the worktree.

Start the dev server in the background:
```
pnpm next dev -p 3001
```

Use `run_in_background: true` on the Bash/PowerShell call. Poll http://localhost:3001/admin/login until it returns HTTP 200 (or until 60s timeout — then investigate).

## STEP 7 — Step 2 iterate

Per the workflow guide:

> Step 2 — Iterate (only if it's "almost right but not quite")
>
> Look at the page in the browser. If something feels off, run a single named-axis refine command instead of describing the problem in prose. Each axis has one command.

**7a.** Use Playwright MCP to take screenshots:
- Navigate to `http://localhost:3001/admin/login`
- Resize to 1440x900, screenshot → save as `redesign/screenshots/login-redesign/chunk1-1440-default.png`
- Resize to 768x1024, screenshot → `chunk1-768-default.png`
- Resize to 375x812, screenshot → `chunk1-375-default.png`

**7b.** Take inactive-notice screenshots:
- Navigate to `http://localhost:3001/admin/login?reason=inactive`
- Screenshot at 1440x900 → `chunk1-1440-inactive.png`
- Screenshot at 375x812 → `chunk1-375-inactive.png`

**7c.** Self-assess against the brief. If you can name a specific axis problem (e.g. "spacing is cramped" → layout, "feels generic SaaS" → bolder, "fonts inconsistent" → typeset), run ONE named-axis refine:

```
/impeccable bolder login        — generic, like every SaaS
/impeccable quieter login       — too loud, too many colours
/impeccable colorize login      — grey, lifeless, no identity
/impeccable typeset login       — fonts default or inconsistent
/impeccable layout login        — spacing off, things cramped
/impeccable animate login       — static, jumpy, no motion
/impeccable delight login       — functional but cold
/impeccable distill login       — too much on the page
```

**Skip `/impeccable live`** — interactive only.

**7d.** If you ran a refine, re-screenshot:
- `chunk1-1440-after-refine.png`
- `chunk1-768-after-refine.png`
- `chunk1-375-after-refine.png`
- `chunk1-1440-inactive-after-refine.png`
- `chunk1-375-inactive-after-refine.png`

If you did NOT run a refine (page already matches brief at default), say so explicitly.

**One iteration rule:** never chain refines without re-screenshotting in between. Run one, look, decide.

## STEP 8 — Final report (the message you return)

Return a single comprehensive report with these sections:

```
## STATUS: CHUNK 1 COMPLETE / FAILED

## Skill availability
[whether Skill tool can invoke /impeccable; list of impeccable subcommands seen]

## Worktree
- Path: [absolute path]
- Branch: [git branch --show-current]
- Dev server URL: http://localhost:3001/admin/login

## Re-prime confirmation
[7 one-sentence summaries]
PRODUCT.md register: [exact value]
Page + file path: [...]
Feature Preservation Manifest:
- [...]
Pre-existing console errors to ignore:
- [...]
Phase + page: Phase 6, login
CONFIRMATION CHALLENGE — brief.md ## 6. Key States sentence 2 verbatim:
> [quoted text]

## BROKEN guard findings
[list of Track A / BLOCKS-REDESIGN Zone 1 BROKEN items, or "none"]

## Scope contract
- Files to edit: [...]
- Files to NEVER touch: [...]
- Scope file written to: redesign/per-page-scope/login-scope.md

## Craft output
[summary of what /impeccable craft did — high level files written/modified]

## Polish loop
- Iterations: [count]
- Each iteration's change: [bullets]
- Final promise: [PAGE-POLISH-COMPLETE or "max iterations hit"]

## Step 2 iterate
- Iterate ran: yes/no
- If yes, axis used: [name]
- Reason: [why that axis]

## Screenshots
[list of all PNG paths under redesign/screenshots/login-redesign/]

## Files actually changed in worktree
[git diff --stat output — read-only inspection, NO STAGING]

## Deviations from brief
[any, or "none"]

## Failures / unexpected behavior
[any, or "none"]

## READY FOR CHUNK 2
[yes / no — explain if no]
```

## Reminder: DO NOT COMMIT. DO NOT STAGE.

That's all for Chunk 1. The parent agent will visually audit your screenshots and either approve Chunk 2 or send corrections.
