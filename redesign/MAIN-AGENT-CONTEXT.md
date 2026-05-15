# Main agent — context handoff

You are the **main agent** operating in the user's primary Claude Code session. This document is the single read-once orientation that gets you fully up to speed on the Rahma Therapy admin redesign — what's happening, your role, the operational model, and the canonical references you'll work from.

**You do NOT run per-page redesigns yourself.** Those happen in *spawned* `/goal`-driven Claude Code sessions, each in its own git worktree, each on its own port. **Your role is orchestrator + quality control + merge broker** — you spawn worktrees on demand, QC the spawned agents' work, present merge plans + conflict options to the user, and execute merges after explicit approval.

> **First action this session:** read this document in full, then read the files listed in [§7 First-turn reading list](#7-first-turn-reading-list). Do this before responding to any other user request.

---

## 1. Project at a glance

**What:** comprehensive redesign of a Next.js admin/CRM for Rahma Therapy — a small UK B2C mobile hijama / cupping / massage clinic in Luton (3–4 staff). 29 admin pages total. Each page gets its own brief + recipe + autonomous-agent run.

**Where in the multi-phase plan:** Phase 6 (Implementation). The full phase model lives in `redesign/impeccable-v5-latest-stable.html`:
- Phases 0–5 (setup, recon, briefs) are COMPLETE.
- Phase 6 (per-page implementation) is IN PROGRESS — 5/29 pages merged, 24 to go.
- Phase 7 (gauntlet/audit producing `FINAL-AUDIT.md`) follows Phase 6.
- Phase 8 (extract/deploy) follows Phase 7.

**Working branch:** `redesign/start-state` (the integration branch all per-page agent merges land on).

**Repo CWD:** `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`

**OS:** Windows 11. Git Bash + PowerShell available. Package manager: `pnpm`.

**Pages already merged on redesign/start-state** (don't re-run unless user explicitly asks):
- `00-shared-components` (commit `aa76451` + post-fix `23b84bf`)
- `booking-new` (commit `892df61` + harden recs `016dd6b`)
- `bookings` (commit `449f722`)
- `booking-detail` (commit `b415bb7` + scope file `834ea43`)
- `login` (commit `7e7e930` + post-audit `a054df4`)

24 pages remain. See `redesign/LAUNCH-SHEET.md` Section 2 for the per-page launch reference and Section 3 for recommended wave ordering.

---

## 2. Your role

You are NOT:
- The agent that runs `/impeccable craft`, `/impeccable adapt`, etc. on a page (that's the spawned per-page agent).
- The agent that writes brief content (that was Phase 5, complete).
- The agent that audits or critiques pages directly (those are subagents dispatched by the spawned per-page agent — see [§4 Autonomous-agent fleet](#4-the-autonomous-agent-fleet)).

You ARE:
- **The orchestrator** — when the user says "let's start the agent for X", you run `scripts/spawn-worktree.mjs <slug>` and surface the kickoff `/goal` command for the user to paste into a new Claude Code session.
- **Quality control** — when the user says "agent for X is done" and pastes the agent's transcript / handoff, you run the POST-AGENT-AUDIT-PROTOCOL.md checklist against the worktree state.
- **The merge broker** — when the user types "approved", you execute the scoped commit + `git merge --ff-only` + worktree cleanup. When conflicts surface, you analyze + present options to the user, never auto-resolve.
- **The forward-looking thinker** — you watch for cross-page consistency (especially within the same wave, where shared infrastructure could diverge), do end-of-wave reconciliation, prepare the Phase 7 handoff at end-of-batch.

---

## 3. Recent operational history (so you know what changed)

This session set up a hardened autonomous-agent infrastructure. What's in the working tree (untracked files) that future agents will rely on:

| New / modified | Purpose |
|---|---|
| `redesign/PHASE6-AUTONOMOUS-AGENT-PLAN.md` | The plan that was executed in this session — read for full design rationale |
| `redesign/POST-AGENT-AUDIT-PROTOCOL.md` | **Your operational reference** — read this thoroughly |
| `redesign/MAIN-AGENT-CONTEXT.md` | This file |
| `redesign/test-credentials.md` | Real test creds (Owner = `rahmatherapy@outlook.com` / `Password123`; 4 test roles) — there is **NO `test.owner@…` account** despite older recipe drafts referencing one |
| `redesign/per-page-deferrals/` | Phase 6 → Phase 7 bridge directory; per-page deferral files written by spawned agents at runtime |
| `scripts/spawn-worktree.mjs` | On-demand worktree spawner you call when user signals "start agent for X". Errors loudly (and best-effort cleans up the partial worktree) if a required source file is missing — no silent skips. |
| `scripts/patch-recipes-*.mjs` (9 scripts) | The bulk-patch scripts that hardened the 26 recipes — kept for reproducibility / future re-runs. The most recent (`patch-recipes-step13-runtime-files.mjs`) clarified that runtime support files are expected writes, not scope violations. |
| `redesign/PER-PAGE-GOAL-COMMANDS.md` | Static reference doc with all 26 ready-to-paste `/goal` commands (slug + paths + port pre-substituted). The user typically copies from here for ad-hoc planning; `spawn-worktree.mjs` prints the same command at spawn time, so you usually don't need to read this file — the user will. |
| 26 recipes in `redesign/per-page-recipes/` | All hardened with: per-page port assignment, Decision-making directives, Design Route Directives, multi-axis Step 7 + visual polish Step 7b, MCP role split (playwright + chrome-devtools), subagent-dispatched Step 12 audit/critique, canon-mapped Step 13 handoff with runtime-support-files clarification on the SCOPE_CLEAN check. Same step structure as before (0–13) but with substantially more autonomous-execution discipline baked in. `dashboard-coordinator-recipe.md` carries an extra `EXPORT_LINK_PRESENT: false` quick-ref anchor (Coordinator-only revenue-gate verification). |
| `redesign/LAUNCH-SHEET.md` | Updated with port table (§1b, 3002–3027), Stop-hook handling clarification (§0a — REMOVE the entry, do NOT set `disableAllHooks: true`), CLI version + Haiku model pin (§0b), new `/goal` kickoff template with turn-cap (40) and STUCK detection inside the goal condition itself (§1d). |
| `redesign/PER-PAGE-SCORES.md` | Already-tracked shared scores file. The `## bookings — critique-rerun` heading was renamed (was `## bookings — critique (re-run after distill + colorize)`) so the canonical regex `^## <slug> — (audit\|critique)$` from POST-AGENT-AUDIT-PROTOCOL §2C matches exactly two hits per page. |

**The workflow guide HTML and impeccable v5 HTML are IMMUTABLE.** Never edit `redesign/phase6-admin-workflow-guide.html` or `redesign/impeccable-v5-latest-stable.html`. Earlier in this session that rule was violated by accident (canonicalising recipe drift into the workflow guide); the user reverted and made the rule explicit. The recipes follow the workflow guide; the workflow guide never follows the recipes.

---

## 4. The autonomous-agent fleet

Each spawned per-page agent runs in its own git worktree at `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-<slug>-redesign\`, on branch `agent/<slug>-redesign`, on a unique localhost port (3002–3027 alphabetical, see LAUNCH-SHEET §1b).

Each agent's contract is its per-page recipe at `redesign/per-page-recipes/<slug>-recipe.md`. The recipe has 14 internal steps (0–13) which map to workflow-guide canon's 8 steps:

| Recipe step | Canon step | What happens |
|---|---|---|
| 0 | (preflight) | Skill availability check — verifies `/impeccable craft|adapt|harden|clarify|audit|critique` and `/ralph-loop` resolve via Skill tool |
| 1 | 1 | Re-prime — read PRODUCT, DESIGN, brief, RECIPE-PROGRESS, BASELINE-ISSUES, IMAGES-NEEDED |
| 2 | (extra) | Ralph Zone 1 BROKEN guard (READ-ONLY) |
| 3 | 2 | Framing — write per-page scope file, choose files to edit + never-touch |
| 4 | 3 | `/impeccable craft redesign of admin page <slug>` |
| 5 | 4 | Required Ralph polish loop |
| 6 | (extra) | Start dev server on assigned port |
| 7 | 5a | **Multi-axis polish** — identify 2–4 visible problems, run `/impeccable bolder|quieter|colorize|typeset|layout|animate|delight|distill <slug>` per axis (max 4) |
| 7b | 5b | **Visual polish loop** — bounded refinement, max 2 iterations, polishing within scope |
| 8 | 5c | `/impeccable adapt <slug> for mobile and tablet` |
| 9 | 5d | `/impeccable harden <slug>` |
| 10 | 5e | `/impeccable clarify <slug>` |
| 11 | 6 | Verify (token-drift lint + Playwright + chrome-devtools console+network) |
| 12 | 7 | **Audit + Critique via subagents** + functional smoke test (subagents avoid self-scoring inflation) |
| 13 | 8 | Handoff — emit `HANDOFF_READY — awaiting user approval`, no commit |

The per-page recipe is autonomous-friendly:
- **Decision-making directives** (recipe header) tell the agent what to answer when impeccable surfaces a question (priority: brief verbatim → PRODUCT/DESIGN → BUSINESS-COMPLETENESS → RECON → derived from forward-looking criteria).
- **Deferral protocol** (also in header) tells the agent when NOT to answer (Phase 7+ open questions go into `/redesign/per-page-deferrals/<slug>-deferrals.md`).
- **Design Route Directives** (header) — the design north star for every visual + structural decision.
- **MCP usage** (header) — playwright for screenshots/interactions, chrome-devtools for console/network.
- **STUCK clause + 40-turn cap** — both inside the `/goal` condition so the Haiku evaluator enforces them.

**Subagent caveat (Step 12):** subagent internal turns are invisible to the parent `/goal` Haiku evaluator. The spawned agent must paste the audit + critique output verbatim into chat. When you receive the user's pasted transcript, both the audit and critique sections should be there in full — if not, the spawned agent didn't fulfill the protocol; that's a QC failure.

---

## 5. Your operating model

The user drives the cadence. They will signal one of these states; you respond as listed.

### 5A — "Let's start the agent for `<slug>`"

1. Run: `node scripts/spawn-worktree.mjs <slug>` (foreground — let the output reach the user).
2. The script handles preflight (verify `redesign/start-state` HEAD, worktree path free, branch free), creates the worktree, junctions `node_modules`, copies the current recipe + progress + test-credentials into the worktree, and prints the user's next steps + the literal `/goal` kickoff command to paste.
3. Confirm to the user the spawn succeeded and remind them to run the preflight (`/config`, `/skills`, `/mcp`, `/hooks`) in the new session before pasting the kickoff.

### 5B — "Watch the first 3 turns" / "agent's running"

You're idle on this slug for now. Stay available; user may bring new info or signal another slug to spawn in parallel.

### 5C — "Goal met for `<slug>`" / "agent for `<slug>` done" + transcript paste

Run the [POST-AGENT-AUDIT-PROTOCOL §2](POST-AGENT-AUDIT-PROTOCOL.md#section-2--quality-control-checklist-per-page-run-before-approving) checklist top-to-bottom. Read the actual files in the worktree (don't trust the transcript alone) — `git diff --stat`, the deferrals file, PER-PAGE-SCORES.md additions, screenshots inventory.

Present findings to the user as a numbered checklist with PASS/FAIL/WARN per item, plus a summary verdict:
- **GREEN** — all checks pass, ready to merge on user approval.
- **YELLOW** — minor issues (e.g. one cosmetic deferral that should have been fixed inline), main agent surfaces but user can decide to merge anyway.
- **RED** — blocker (scope violation, missing audit, P0 found). Don't propose merge; recommend re-dispatch or escalate.

**Important — runtime support files are EXPECTED writes, not scope violations.** When you run `git diff --stat` / `git status` in the worktree, you'll see the spawned agent's writes to: `redesign/per-page-progress/<slug>-progress.md`, `redesign/per-page-scope/<slug>-scope.md`, `redesign/per-page-deferrals/<slug>-deferrals.md`, `redesign/screenshots/<slug>-redesign/*.png`, `redesign/baseline/<slug>-adapt-after-{mobile,tablet}.png`, `redesign/HARDEN-RECS-<slug>.md`, and an append to `redesign/PER-PAGE-SCORES.md`. **None of these are scope violations** — they're produced by recipe instructions (Steps 0+, 3, 7+, 8, 9, 12, 13). The recipe Step 13 clarifies this explicitly. The actual `SCOPE_VIOLATION` trigger is only for **source files** (under `src/` or other code paths) changed outside the recipe's "Files to edit" list. Don't reject a handoff because you see runtime support files in the diff — that's the agent doing its job.

### 5D — "Approved"

Execute the [POST-AGENT-AUDIT-PROTOCOL §3](POST-AGENT-AUDIT-PROTOCOL.md#section-3--merge-protocol-success-path-after-user-approves) merge protocol:
1. In worktree: stage scoped files by name (NEVER `git add .` / `-A`), commit with `redesign: <slug>` message.
2. In main tree: `git merge --ff-only "agent/<slug>-redesign"`.
3. Cleanup: kill leftover Node processes for the worktree (Windows `Get-CimInstance Win32_Process | … | Stop-Process`), remove worktree dir, `git worktree prune`, `git branch -d agent/<slug>-redesign`.
4. Update `redesign/IMPLEMENTATION-PLAN.md` (mark page row `[x]` with commit hash; advance "Currently on:").

### 5E — "STUCK" / "TURN_CAP_REACHED" / "P0_FOUND" surfaced by the agent

Use [POST-AGENT-AUDIT-PROTOCOL §5](POST-AGENT-AUDIT-PROTOCOL.md#section-5--failed-agent-recovery). Each marker has a specific recovery playbook (re-dispatch into same worktree with corrective context vs. raise turn cap vs. defer/fix-now P0).

### 5F — Conflict during merge

Use [POST-AGENT-AUDIT-PROTOCOL §4](POST-AGENT-AUDIT-PROTOCOL.md#section-4--conflict-resolution-playbook). Specific scenarios are pre-mapped: dashboard variants, emails ↔ email-templates tab shell, 00-shared-components edits, mid-batch recipe edits. For anything novel, present numbered options to the user — don't auto-resolve.

### 5G — End of wave

When all pages in a LAUNCH-SHEET §3 wave are merged, do the cross-page consistency check ([POST-AGENT-AUDIT-PROTOCOL §6](POST-AGENT-AUDIT-PROTOCOL.md#section-6--end-of-wave-reconciliation)) and note any divergence in `redesign/WAVE-RECONCILIATION.md` (create the file on first wave end).

### 5H — End of Phase 6

All 24 remaining pages merged. Run [POST-AGENT-AUDIT-PROTOCOL §7](POST-AGENT-AUDIT-PROTOCOL.md#section-7--end-of-batch-post-phase-6-cleanup--phase-7-prep): tag the state, aggregate deferrals, verify BUSINESS-COMPLETENESS Track A flips (especially 2A-6 + 2A-9 → HANDLED), hand off to Phase 7 (`/impeccable audit admin`).

---

## 6. Critical never-violate constraints

1. **Workflow guide and impeccable v5 HTML are immutable.** Never edit `redesign/phase6-admin-workflow-guide.html` or `redesign/impeccable-v5-latest-stable.html`. The recipes follow them, never the reverse. (Earlier-session lesson.)
2. **Never auto-merge.** Only merge after explicit user "approved" signal. Never act on implied approval.
3. **Never `git add .` or `git add -A`.** Always stage scoped file names from the recipe's "Files to edit" list.
4. **Never edit a per-page recipe mid-flight** (while a spawned agent for that page is running). If the recipe needs amending, signal the user first; coordinate.
5. **Never invent test credentials.** The Owner is `rahmatherapy@outlook.com` / `Password123` per `redesign/test-credentials.md`. There is no `test.owner@…` account.
6. **Never propose a destructive operation without explicit confirmation.** Force-push, hard reset, dropping branches, deleting worktrees that haven't been merged — confirm with the user. Reading and inspecting are always safe.
7. **Always present options for novel conflicts.** If you can't resolve mechanically against the conflict-resolution playbook, surface the conflict + options + your recommendation; let the user pick.
8. **The 5 already-merged pages should not be re-redesigned** unless the user explicitly asks. They're: `00-shared-components`, `booking-new`, `bookings`, `booking-detail`, `login`.
9. **Don't burn parent context on mass file reads.** When you need to verify multi-recipe consistency or do bulk QC, dispatch a subagent with a bounded prompt and let it summarize.

---

## 7. First-turn reading list

Read these in order on session start. The first 4 are essential before responding to any user request; the rest as needed.

| # | File | Why | Approx tokens |
|---|---|---|---|
| 1 | `PRODUCT.md` | Project register, brand voice, anti-references, accessibility commitments | ~5k |
| 2 | `DESIGN.md` | Design system canon — tokens, components, motion, status families | ~7k |
| 3 | `redesign/POST-AGENT-AUDIT-PROTOCOL.md` | **Your operational reference** — checklist, merge protocol, conflict playbook, recovery playbook | ~8k |
| 4 | `redesign/LAUNCH-SHEET.md` | Per-page launch reference + port table + Section 0 preflight + Section 3 wave ordering | ~12k |
| 5 | `redesign/PHASE6-AUTONOMOUS-AGENT-PLAN.md` | The plan executed this session — design rationale, decisions, what every change does | ~9k |
| 6 | `redesign/per-page-recipes/login-recipe.md` | The canonical recipe model — read once to understand the 14-step structure recipes use | ~10k |
| 7 | `redesign/test-credentials.md` | Cred reference + the no-test.owner clarification | ~1k |
| 8 | `redesign/IMPLEMENTATION-PLAN.md` (offset 0, limit 80) | "Currently on" + page row status table | ~3k |

After these 8, you have the full operating picture. Don't read every recipe up front — read the per-page recipe only when you're about to spawn or QC that page (saves context).

**Available on demand — NOT first-turn reading:**
- `redesign/PER-PAGE-GOAL-COMMANDS.md` (~70 KB, 390 lines) — static doc with all 26 ready-to-paste `/goal` commands per page. The user typically copies from here for planning; `spawn-worktree.mjs` prints the same command at spawn time. Read only if the user asks you to surface a specific command without spawning.
- `redesign/per-page-deferrals/README.md` — explains the Phase 6 → Phase 7 bridge format. Read if you need to verify a deferrals file's structure during QC.
- Any per-page recipe (`redesign/per-page-recipes/<slug>-recipe.md`) — read just-in-time when spawning or QC-ing that page.
- Any per-page brief (`redesign/briefs/<slug>-brief.md`) — read just-in-time when investigating QC findings (e.g. brief Feature Preservation Manifest cross-check).

**Oversize-file tip:** these are large but manageable as full reads:
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) — only read on demand, use offset+limit
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) — read first 80 lines for overview; offset+limit for specific page rows
- `redesign/impeccable-v5-latest-stable.html` (~721 KB) — never read in full; grep for specific phase / step / line range
- `redesign/phase6-admin-workflow-guide.html` (~921 KB / 12,510 lines) — same; never read in full

---

## 8. Helpful workflows

### Use TodoWrite for waves

When the user starts a wave, create todos for each page in that wave with `pending` status. Mark `in_progress` when you spawn its worktree, `completed` after merge. Lets you (and the user) see wave progress at a glance.

### Parallel reads at session start

The 8 first-turn files can be read in a single message with parallel tool calls. Do that — don't sequential-read.

### Use subagents for bulk QC

If 3 spawned agents finish at roughly the same time and the user says "QC all three", consider dispatching 3 parallel general-purpose subagents (one per page) — each verifies one page against POST-AGENT-AUDIT-PROTOCOL §2. Saves your parent context.

### Spawn-worktree.mjs is idempotent on the safe side

The script refuses to clobber an existing worktree path or existing branch. Safe to run anytime — if the args are wrong, it errors out with a clear recovery instruction.

### Long-form ScheduleWakeup is rarely needed

The user drives cadence. Don't poll/wake unless they explicitly ask you to monitor a long-running task.

### Plan mode is fine for big decisions

If the user surfaces a multi-page architectural concern (e.g. "should we change how dashboards share components?") — propose entering plan mode, present options, get explicit approval before touching anything.

---

## 9. Pointers to canonical references

Single source of truth, by topic:

| Topic | File |
|---|---|
| Project state + remaining-page tracking | `redesign/IMPLEMENTATION-PLAN.md` |
| Per-page launch commands + port table + Section 0 preflight | `redesign/LAUNCH-SHEET.md` |
| Per-page /goal commands (copy-paste-ready, all 26) | `redesign/PER-PAGE-GOAL-COMMANDS.md` |
| Per-page recipe structure (the spawned agent's contract) | `redesign/per-page-recipes/<slug>-recipe.md` |
| Per-page progress scratchpad (spawned agent appends per step + cats to chat) | `redesign/per-page-progress/<slug>-progress.md` |
| Per-page scope contract (Step 3 declares "Files to edit" + "Files to NEVER touch") | `redesign/per-page-scope/<slug>-scope.md` |
| Per-page screenshots (Steps 7, 7b, 8, 11b, 12c playwright outputs) | `redesign/screenshots/<slug>-redesign/` |
| Per-page baseline screenshots (Step 8 adapt-after) | `redesign/baseline/<slug>-adapt-after-{mobile,tablet}.png` |
| Per-page harden recommendations (Step 9 output) | `redesign/HARDEN-RECS-<slug>.md` |
| Design system canon | `DESIGN.md` |
| Brand voice + register + anti-references | `PRODUCT.md` |
| Phase 6 plan + design rationale (this session) | `redesign/PHASE6-AUTONOMOUS-AGENT-PLAN.md` |
| Your operational reference | `redesign/POST-AGENT-AUDIT-PROTOCOL.md` |
| Test credentials | `redesign/test-credentials.md` |
| Phase model (0–8) | `redesign/impeccable-v5-latest-stable.html` (immutable; grep for specific section) |
| Step-level workflow guide for Phase 6 | `redesign/phase6-admin-workflow-guide.html` (immutable; grep) |
| Track A obligations (BUSINESS-COMPLETENESS) | `redesign/BUSINESS-COMPLETENESS.md` |
| Codebase facts / RBAC scope inventory | `redesign/RECON.md` |
| Baseline issues to NOT chase | `redesign/BASELINE-ISSUES.md` |
| Per-page audit + critique scores (appended over Phase 6) | `redesign/PER-PAGE-SCORES.md` |
| Phase 6 → Phase 7 bridge | `redesign/per-page-deferrals/<slug>-deferrals.md` (one per page when Phase 6 closes) |
| Wave-level cross-page reconciliation log | `redesign/WAVE-RECONCILIATION.md` (create on first wave end) |

---

## 10. Open considerations / known limitations

1. **Worktree staleness.** Worktrees spawned early in a wave fall N commits behind `redesign/start-state` as later pages merge. The spawn script always spawns from current HEAD, so per-wave spawning avoids most of this. For long-running parallel batches across wave boundaries, you may need to rebase mid-batch — POST-AGENT-AUDIT-PROTOCOL §4D covers this.
2. **Subagent thinking-level inheritance.** The Agent tool doesn't expose per-subagent thinking override. The user must already be on Opus 4.7 + medium thinking in `/config` (LAUNCH-SHEET §0b preflight enforces this). If a subagent's audit/critique looks shallow, suspect thinking level was too low.
3. **CLI version drift.** Per LAUNCH-SHEET §0b, pin Claude Code CLI ≥ 2.1.140 across all worktrees. v2.1.139 had a known-buggy `/goal`. If a spawned agent behaves erratically, check its CLI version.
4. **Brief immutability under autonomy.** If a spawned agent thinks the brief is wrong, current protocol is STUCK. The agent stops; you (the main agent) resolve with the user. Open question: should we add a softer "agent proposes brief revision in deferrals file" channel? Not in scope today.
5. **The 5 already-merged pages are immutable for now.** Re-running them would risk regressing the 8+ commits already on `redesign/start-state`. Only re-run on explicit user instruction with a clear reason.
6. **The 26 patch scripts are reproducibility artifacts.** Don't run them again unless the user explicitly asks. They were one-shot recipe-hardening passes; re-running would be no-ops (idempotent) but adds noise.

---

End of context. After reading this + the first-turn list (§7), confirm orientation back to the user with a one-line readout: pages remaining, current wave (per LAUNCH-SHEET §3), next likely action (likely "wait for user to pick a slug to spawn"). Don't do anything else until the user asks.
