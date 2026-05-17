# Phase 6 admin redesign — per-page launch sheet

This is the per-page reference for running `/goal`-driven redesigns. The 4 pages already merged into `redesign/start-state` (00-shared-components, booking-new, bookings, booking-detail, login) are not listed here — see git log for those.

For each page below: setup commands, the exact `/goal` command to paste, and any agent-flagged quirks to be aware of going in. The setup and `/goal` blocks are templated — substitute `<SLUG>` for the page's slug; everything else stays verbatim.

---

## Section 0 — One-time preflight (do once, then reuse for every page)

### 0a. Disable your existing Stop hook (REMOVE the entry, do NOT set `disableAllHooks: true`)

`/goal` is itself a session-scoped prompt-based Stop hook (per Anthropic's [official docs](https://code.claude.com/docs/en/goal): *"a wrapper around a session-scoped prompt-based Stop hook"*). A second Stop hook in your `settings.local.json` fires alongside `/goal`'s and can vote "stop", short-circuiting the loop.

**Correct approach:** open `~/.claude/settings.local.json` (or wherever your Stop hook lives) and **remove or comment out the `Stop` key entry** for the duration of `/goal` runs.

**Wrong approach (will break `/goal`):** setting `"disableAllHooks": true` or `"allowManagedHooksOnly": true` disables `/goal` itself. CLI v2.1.140 surfaces a clear error in this case, but the failure mode is the same — your goal silently never starts.

Verify with `/hooks` in any session — Stop hooks should be empty.

### 0b. Verify Claude Code session config (CLI version + model pins)

In any fresh Claude Code window you'll use:
```
claude --version  → confirm CLI ≥ 2.1.140 (v2.1.139 shipped a known-buggy /goal; v2.1.140
                    fixes the silent-hang when disableAllHooks is set)
/config           → set model = Opus 4.7, thinking = medium
/skills           → confirm `impeccable` (with subcommands) and `ralph-loop` are listed
/mcp              → confirm `playwright` is connected (chrome-devtools optional)
```

If `impeccable` isn't listed, the spawned agent will fail mid-execution at the first skill invocation and emit `STUCK: <step> — skill <name> unavailable`. Surface the plugin first to avoid that.

**Pin the Haiku evaluator model across all parallel worktrees** so each `/goal` evaluates against the same model revision. In each worktree's environment (or once globally in `~/.zshrc`/PowerShell `$PROFILE`):

```powershell
# PowerShell
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL = "claude-haiku-4-5-20251001"

# Git Bash / WSL
export ANTHROPIC_DEFAULT_HAIKU_MODEL=claude-haiku-4-5-20251001
```

Anthropic's `haiku` alias updates over time; pinning a specific revision means parallel worktrees you launch this week will all use the same evaluator, even if Anthropic ships a new Haiku next week.

### 0c. Land the login work first if you haven't

The `redesign/start-state` HEAD must contain login before any other page runs. Verify with `git log --oneline -3 redesign/start-state` — top three commits should include `redesign: login` and `Mark login [x] complete`. Done as of `a054df4`.

---

## Section 1 — Per-page workflow (common — substitute `<SLUG>` everywhere)

### 1a. Worktree setup — main agent handles this inline

**You don't run any commands here.** When you signal **"let's start the agent for `<slug>`"** to the main agent in your primary Claude Code session, the main agent will execute the full spawn procedure inline (full detail in `MAIN-AGENT-CONTEXT.md §5A`, which the main agent reads at session start).

What the main agent does, in your behalf:

- Verifies preconditions (main-tree HEAD on `redesign/start-state`, worktree path free, branch free) — refuses to proceed if any fail
- Creates the worktree at `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-<slug>-redesign` on a fresh `agent/<slug>-redesign` branch off `redesign/start-state` HEAD
- **Robocopies `node_modules` from main tree as a real local directory** (`robocopy <src> <dst> /E /SL /SJ /R:1 /W:1 /MT:16 …` — ~2 min, no `pnpm install`, no network calls, no new packages introduced). Verifies post-copy by resolving `next/package.json` in the new local node_modules
- Creates a top-level `node_modules/.bin/` junction inside the worktree (safety net against `npx` registry-fetches — see recipes' "no registry fetches" hard rule)
- Copies current main-tree per-page recipe + progress stub + `test-credentials.md` + `.env` into the worktree (overwrites stale-committed versions; `.env` is required for Supabase to work — without it admin pages 500 on first request)
- Ensures the deferrals directory exists
- Generates the literal `/goal` kickoff command (slug + worktree path + port pre-substituted from §1b table) and prints it for you to paste into a new Claude Code session opened inside the worktree

> **Historical note (deleted 2026-05-16):** there used to be a `scripts/spawn-worktree.mjs` script that did all of the above. It was deleted in favor of inline execution by the main agent because the script accumulated edge cases across Next.js version bumps (junction-vs-Turbopack incompatibility, missing-`.bin/`-shim incident, opaque failure modes) and the cycle of patches outweighed the convenience. The inline approach is transparent — every command appears in chat, you can intervene per-page if needed, and there's no hidden script-state to debug.

### 1b. Per-page port assignment (pre-baked — no manual swap needed)

Every per-page recipe is pre-assigned a unique localhost port so 26 parallel `/goal` sessions never collide. Port 3001 was the old global default; user's main tree owns 3000; per-page ports run **3002–3027**, alphabetical.

| Port | Page slug |     | Port | Page slug |
|---|---|---|---|---|
| 3002 | account-password-requests | | 3015 | enquiries |
| 3003 | audit                     | | 3016 | login |
| 3004 | availability              | | 3017 | operations |
| 3005 | booking-detail            | | 3018 | password-reset |
| 3006 | calendar                  | | 3019 | privacy |
| 3007 | client-detail             | | 3020 | reports |
| 3008 | client-new                | | 3021 | role-detail |
| 3009 | clients                   | | 3022 | roles |
| 3010 | dashboard-coordinator     | | 3023 | services |
| 3011 | dashboard-owner-admin     | | 3024 | settings |
| 3012 | dashboard-therapist       | | 3025 | staff |
| 3013 | email-templates           | | 3026 | staff-availability |
| 3014 | emails                    | | 3027 | staff-detail |

**No manual swap required** for parallel runs. The per-page recipe carries its port inline (Context table, Step 6 dev-server command, Step 11b verification URL, quick-reference `DEV_SERVER_READY` anchor).

**If a port collides** with something else on your machine, override with a quick search-replace in the worktree's copy of the recipe:

```powershell
# Example: shift email-templates from 3013 to 3113 for this one run
$oldPort = 3013
$newPort = 3113
$recipePath = "$worktree\redesign\per-page-recipes\$slug-recipe.md"
(Get-Content $recipePath) -replace "\b$oldPort\b", "$newPort" | Set-Content $recipePath
```

(The port assignment was originally landed by a one-shot `patch-recipes-port-assignment.mjs` script, deleted 2026-05-16 along with the other 14 `patch-recipes-*.mjs` historical scripts. The port mappings are baked into the 26 recipes; if a port ever needs changing, edit the recipe file directly.)

### 1c. Open Claude Code in the worktree

```powershell
cd $worktree
claude
```

In the new CC window: confirm Section 0 settings hold (`/config`, `/skills`, `/mcp`), then paste the page's `/goal` command (next sub-section).

### 1d. Generic `/goal` command template (substitute `<SLUG>` — exactly one substitution if path is the same)

The template below puts the **turn cap** and the **STUCK detection** *inside the goal condition itself*, not just in the kickoff prose. Per Anthropic's docs the Haiku evaluator only judges what it sees in the condition + transcript — burying termination rules in kickoff prose means the evaluator won't enforce them; it just keeps voting "no" until something else stops the loop.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-<SLUG>-redesign\redesign\per-page-recipes\<SLUG>-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-<SLUG>-redesign\redesign\per-page-progress\<SLUG>-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

### 1e. Watch the first 2 turns live

If the agent skips the recipe-file Read in turn 1, or fabricates evidence — `/goal clear` immediately. Re-paste a corrected command or ask me before continuing.

Healthy signs in turns 1–2:
- Turn 1: reads the recipe file (you'll see a Read tool call on the exact absolute path)
- Turn 2: begins re-prime (reads PRODUCT.md, DESIGN.md, the brief, foundation files; emits summary + the `PRODUCT.md register: product` + `BRIEF_S6_QUOTE:` literals)

(Skills are not re-verified inside the spawned session — the user's `/skills` preflight in Section 0b is the canonical check. If a skill invocation fails mid-run, the agent emits `STUCK: <step> — skill <name> unavailable` and stops.)

### 1f. After `/goal` completes

The agent will emit `HANDOFF_READY — awaiting user approval` and stop. Ping me with one of:
- **"goal met for `<slug>`"** — I'll audit transcripts + artifacts against the recipe, report any stray
- **"STUCK at `<slug>` step N"** — I'll diagnose
- **"TURN_CAP_REACHED for `<slug>`"** — we look at progress vs missing and decide

### 1g. On your approval — scoped commit + merge + cleanup (per-page template)

After you say "approved" for a page (assuming I've already audited):

```powershell
$slug = "<SLUG>"
$mainTree = "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor"
$worktree = "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-$slug-redesign"

# In the worktree: scoped commit (review diff first, stage only files in scope contract)
cd $worktree
git diff --stat                                                            # confirm files match scope
# git add <each scoped file by name>  — NEVER git add . or git add -A
# git commit -m "redesign: $slug"
# git commit -m "Mark $slug [x] complete — final commit <hash>"  (optional; matches existing pattern)

# Back to main tree, fast-forward merge
cd $mainTree
git merge --ff-only "agent/$slug-redesign"

# Kill processes (by worktree path + by per-page port).
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*rahmatherapy-$slug-redesign*" -and $_.Name -ne "powershell.exe" -and $_.Name -ne "pwsh.exe" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-NetTCPConnection -LocalPort <port-for-slug> -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

# Remove worktree — git first, Node fs.rmSync fallback. NEVER `Remove-Item -Recurse -Force` (pnpm#10707).
git -C $mainTree worktree remove --force $worktree 2>$null
if (Test-Path -LiteralPath $worktree) {
    node -e "require('fs').rmSync(process.argv[1], { recursive: true, force: true })" -- $worktree
}
git -C $mainTree worktree prune
git -C $mainTree branch -d "agent/$slug-redesign"

# Auto-heal main — paste §3A's hybrid leaf-sweep + escalation block here. NEVER use bare --frozen-lockfile
# alone (misses empty-leaf damage where the package dir exists but contents are wiped).
```

If `git merge --ff-only` errors with "would be overwritten" — main tree has uncommitted edits on a file the branch changed. Restore that file (`git restore <path>`) if the change is stale; otherwise stash first.

---

## Section 2 — Pages (25 total, in IMPLEMENTATION-PLAN row order)

### 2.04 — booking-detail (row 4)

**Brief:** `redesign/briefs/booking-detail-brief.md`
**Backend status:** TBD per brief (no explicit BUILD plan dependency)
**RBAC:** test.admin sees full surface; test.therapist sees narrowed view
**Recommended port:** 3001
**Subagent flags:** none
**Note:** This page is already git-committed (commit `b415bb7`) and marked `[x]` in IMPLEMENTATION-PLAN.md row 4 (flipped in commit `eae9f67`). Re-running this recipe would re-do the work — skip unless you actively want a re-redesign.

`/goal` substitution: replace `<SLUG>` with `booking-detail` in Section 1d's template.

---

### 2.05 — clients (row 5)

**Brief:** `redesign/briefs/clients-brief.md`
**Backend status:** N-A (non-blocking BUILD-clients-sort-last-visit)
**RBAC:** test.admin (admin/coordinator see manage_clients_all; therapists scoped)
**Recommended port:** 3001
**Subagent flags:** none

---

### 2.06 — client-detail (row 6)

**Brief:** `redesign/briefs/client-detail-brief.md`
**Backend status:** N-A (high RBAC complexity but no BUILD blockers)
**RBAC:** test.admin (most permission-varied page after booking-detail)
**Recommended port:** 3001
**Subagent flags:**
- Brief Open-Question-3 flags a server-action name discrepancy: `requestClientPrivacyAction` (RECON §6.1) vs `createClientPrivacyRequest` (current `ClientDetailForms.tsx`). Recipe routes the agent to verify the exported name from `src/app/admin/clients/actions.ts` at Step 3 before wiring, and surface the resolved name in Step 13 handoff.

---

### 2.07 — client-new (row 7) ✅ resolved

**Brief:** `redesign/briefs/client-new-brief.md`
**Backend status:** N-A
**RBAC:** test.admin (manage_clients_all)
**Recommended port:** 3001
**Resolution notes (investigation 2026-05-15):**
- The earlier "brief contradiction" was over-flagged. Brief §5 explicitly authorises a small additive extension to `src/app/admin/clients/actions.ts` as a *"justified exception to the RECON §5 untouchable rule"* (the migration `supabase/migrations/20260513120000_add_client_city_area.sql` is in the repo; the booking-new pre-fill flow depends on `city`/`area` being populated).
- Recipe now reflects this: the `actions.ts` extension is pre-authorised; the agent should place it in "Files to edit" without further user confirmation. Scope is strictly additive (read 2 FormData fields, add to insert payload — no validation/duplicate/signature changes).
- STUCK trigger now narrows to the only actual blocker: if the migration is missing or the `city`/`area` columns don't exist when the schema is read.
- postcodes.io integration explicitly out-of-scope per brief §4 (deferred to `BUILD-postcode-lookup-client.md`).

**`/goal` preface addendum (optional — recipe already covers it):**
> "Brief §5 authorises a small extension to `src/app/admin/clients/actions.ts` to accept `city` and `area`. This is a sanctioned exception to RECON §5's blanket untouchable rule for this one file, this one session. Treat `actions.ts` as in-scope for additive field reads/inserts only; do not touch duplicate-detection, validation, or any other code path in that file."

---

### 2.08 — dashboard-owner-admin (row 8)

**Brief:** `redesign/briefs/dashboard-owner-admin-brief.md`
**Backend status:** N-A (dashboard-data.ts is untouchable; uses existing payloads)
**RBAC:** test.owner OR test.admin (Owner + Admin/PM both qualify)
**Recommended port:** 3001
**Subagent flags:**
- Shares infrastructure files with dashboard-coordinator + dashboard-therapist (`dashboard-cards.tsx`, `notification-bell.tsx`, `attention-group-client.tsx`, `dashboard-header.tsx`, `dashboard-filters-client.tsx`). Recipe checks whether prior variant sessions have already landed the Brief-06 carry-forward fixes (`border-l-4`, `bg-black`, avatar hexes, raw chart colors) — skips those edits if already in `redesign/start-state`.
- Brief OQ2 about `notification-bell.tsx` coordinated with `00-shared-components` — recipe defers to whatever 00-shared landed.

---

### 2.09 — dashboard-coordinator (row 9) ⚠

**Brief:** `redesign/briefs/dashboard-coordinator-brief.md`
**Backend status:** N-A (dashboard-data.ts untouchable)
**RBAC:** test.coordinator
**Recommended port:** 3001
**Subagent flags:**
- **⚠ MILD FLAG:** Brief OQ1 says the Active Enquiries data fetcher may not exist in the coordinator-variant payload of `dashboard-data.ts`. Recipe routes the implementer to either render `0` + empty state OR emit `STUCK` if the data shape blocks the implementation. `dashboard-data.ts` remains untouchable either way.
- Shares infrastructure with dashboard-owner-admin + dashboard-therapist — see notes there.

---

### 2.10 — dashboard-therapist (row 10)

**Brief:** `redesign/briefs/dashboard-therapist-brief.md`
**Backend status:** N-A
**RBAC:** test.therapist
**Recommended port:** 3001
**Subagent flags:**
- Brief's primary canvas is mobile (375px) with desktop documented as "phone layout, more comfortable line height". Recipe Step 8 explicitly checks no multi-column desktop chrome is introduced.
- Brief OQ1 (tomorrow-first-visit) and OQ2 (client-phone-on-nextAppointment) routed to documented empty-state / "Open booking" fallbacks per brief.
- Shares infrastructure with dashboard-owner-admin + dashboard-coordinator.

---

### 2.11 — reports (row 11)

**Brief:** `redesign/briefs/reports-brief.md`
**Backend status:** N-A
**RBAC:** test.admin OR test.owner (view_reports_revenue gated)
**Recommended port:** 3001
**Subagent flags:**
- Single-file page (`page.tsx`).
- Recipe adds extra evaluator anchor `RECHARTS_WARNINGS: 0` (Recharts `minHeight: 288` carry-forward fix).
- Step 11 explicitly notes: `[288px]` literal IS required (Recharts container) — should NOT be refactored away by token-drift lint.

---

### 2.12 — account-password-requests (row 12) ⚠ FAKE

**Brief:** `redesign/briefs/account-password-requests-brief.md`
**Backend status:** **FAKE** — three BLOCKS-REDESIGN BUILD plans still unchecked in IMPLEMENTATION-PLAN.md (`BUILD-rbac-permission-account-password-requests`, `BUILD-password-reset-email-templates`, `BUILD-approve-reject-password-reset`)
**RBAC:** test.admin OR test.owner
**Recommended port:** 3001
**Subagent flags:**
- Greenfield 4-file surface.
- Recipe adds evaluator anchor `BACKEND_FAKE_SURFACES:` to enforce the `data-redesign-backend="FAKE"` DOM markers.
- Test database may have zero pending rows — recipe Step 7 includes a heads-up to seed a row before Step 11 verification.

---

### 2.13 — availability (row 13)

**Brief:** `redesign/briefs/availability-brief.md`
**Backend status:** N-A (non-blocking BUILD-availability-this-week-chip noted with graceful degradation)
**RBAC:** test.admin OR test.owner
**Recommended port:** 3001
**Subagent flags:**
- 4-file restyle.
- Recipe adds evaluator anchor `BORDER_L_4: 0` per brief's audit requirement.

---

### 2.14 — calendar (row 14)

**Brief:** `redesign/briefs/calendar-brief.md`
**Backend status:** N-A
**RBAC:** test.admin / test.coordinator
**Recommended port:** 3001
**Subagent flags:**
- Single-file restyle.
- Recipe adds evaluator anchors `IMAGES_NEEDED_DELTA:` (for `calendar-empty.svg`) and `BG_WHITE_HITS: 0`.

---

### 2.16 — password-reset (row 16) ⚠ FAKE · public

**Brief:** `redesign/briefs/password-reset-brief.md`
**Backend status:** **FAKE** — two BLOCKS-REDESIGN BUILD plans still unchecked (`BUILD-password-reset-email-templates`, `BUILD-password-reset-request-actions`)
**RBAC:** **public (no sign-in required)** — this is a pre-auth surface, like login
**Recommended port:** 3001
**Subagent flags:**
- Greenfield 6-state public pre-auth flow.
- Step 7/8/11 reflect "no sign-in required" + middleware allow-list dependency.
- Recipe legitimately references `/admin/login` route as a foreign page in 6 places ("Back to sign in" link, Login session ownership of `page.tsx`, "Forgot your password?" cross-reference).
- Six state-specific screenshots requested using FAKE-handler test tokens.
- Recipe adds evaluator anchors `DANGEROUSLY_SET_INNER_HTML_HITS: 0` and `UNIFORM_RESPONSE_PASS: true`.

---

### 2.17 — settings (row 17)

**Brief:** `redesign/briefs/settings-brief.md`
**Backend status:** N-A (non-blocking BUILD-settings-last-changed-by)
**RBAC:** **test.owner ONLY** — `MANAGE_SETTINGS` is Owner-only per RBAC seed
**Recommended port:** 3001
**Subagent flags:**
- 2-file Owner-only restyle.
- Step 11 explicitly notes sign-in must be as the Owner account from `/redesign/test-credentials.md` (`rahmatherapy@outlook.com` / `Password123`), NOT `test.admin@...`. There is no `test.owner@…` account.
- Recipe adds evaluator anchors `BG_WHITE_HITS: 0`, `RAW_RED_HITS: 0`, `BACKDROP_BLUR_HITS: 0` per brief soft-fix carry-forwards.

---

### 2.18 — staff (row 18) ⚠ FAKE

**Brief:** `redesign/briefs/staff-brief.md`
**Backend status:** **FAKE** — `BUILD-staff-filter-query` is BLOCKS-REDESIGN (non-blocking `BUILD-staff-workload-aggregates` noted)
**RBAC:** test.admin OR test.owner
**Recommended port:** 3001
**Subagent flags:**
- Introduces 7 net-new GET params (`q`, `roleId`, `gender`, `status`, `workload`, `bookable`, `onboarding`) — all listed in Step 12 smoke test.

---

### 2.19 — staff-detail (row 19)

**Brief:** `redesign/briefs/staff-detail-brief.md`
**Backend status:** HANDLED (no BLOCKS-REDESIGN; brief §10 Q3 assignment `limit(8)→16` is a soft non-blocking adjustment)
**RBAC:** test.admin OR test.owner
**Recommended port:** 3001
**Subagent flags:**
- §10 Q3 `limit(8)→16` flagged as soft non-blocking; Backend status `HANDLED` with asterisk.

---

### 2.20 — audit (row 20) ⚠ FAKE · forensic

**Brief:** `redesign/briefs/audit-brief.md`
**Backend status:** **FAKE** — `BUILD-audit-filter-and-pagination` is BLOCKS-REDESIGN (non-blocking `BUILD-audit-target-existence`)
**RBAC:** test.admin OR test.owner
**Recommended port:** 3001
**Subagent flags:**
- Forensic-trust invariants (verbatim redaction regex, no-writes-on-load).
- Recipe adds two unique evaluator anchors: `AUDIT_WRITES_ON_LOAD: 0` and `REDACTION_REGEX_VERBATIM: yes`.
- Dedicated forensic check in Step 11a.

---

### 2.21 — email-templates (row 21) ⚠ FAKE · runs SECOND in pair

**Brief:** `redesign/briefs/email-templates-brief.md`
**Backend status:** **FAKE** — four BLOCKS-REDESIGN BUILDs: `BUILD-email-template-overrides-table`, `BUILD-email-templates-actions`, `BUILD-email-templates-preview-route`, `BUILD-rbac-permission-email-templates`
**RBAC:** test.admin OR test.owner
**Recommended port:** 3001
**Ordering (resolved 2026-05-15):** Run **AFTER** `emails` (row 22). The `emails` session lays the tab shell + Delivery + Reminders bodies + a literal Templates-tab stub. This session does a scoped swap-in to replace the stub with the real `<TemplatesTab />` component — no tab-shell rebuild. If the stub isn't present in `src/app/admin/emails/page.tsx` when this session starts, it will exit with `STUCK: <step> — emails session has not laid the tab shell`.

**Subagent flags:**
- Recipe adds extra evaluator anchor `SERVER_ONLY_GUARD:` for the `templates.ts` SERVER ONLY constraint.
- Recipe owns: `src/app/admin/emails/components/` (new directory: TemplateBrowser, TemplatePreviewPanel, TemplateEditForm, ManualSendSheet), `src/app/admin/email-templates/preview/[id]/route.ts`, `src/app/admin/email-templates/actions.ts`, plus a **two-line scoped edit** to `src/app/admin/emails/page.tsx` (import `<TemplatesTab />`, replace stub JSX).
- Final route: `/admin/emails?tab=templates` for user-facing surface (helper routes under `/admin/email-templates/...`).

**`/goal` preface addendum (recommended):**
> "The `emails` session has already established the tab shell at `src/app/admin/emails/page.tsx` and rendered a stub for the Templates tab. Your scope for `emails/page.tsx` is limited to: (1) import the new `<TemplatesTab />` component you'll build under `src/app/admin/emails/components/`, (2) swap the stub for that import. Everything else lives under `src/app/admin/emails/components/` and `src/app/admin/email-templates/`. If the stub marker `Templates tab body — populated by the email-templates session` is missing, STOP and emit STUCK."

---

### 2.22 — emails (row 22) ⚠ FAKE · tab-host · runs FIRST in pair

**Brief:** `redesign/briefs/emails-brief.md`
**Backend status:** **FAKE** — `BUILD-email-delivery-filter-query` + `BUILD-automated-booking-reminders` BLOCKS-REDESIGN
**RBAC:** test.admin OR test.owner
**Recommended port:** 3001
**Ordering (resolved 2026-05-15):** Run **BEFORE** `email-templates` (row 21). This session owns `src/app/admin/emails/page.tsx` outright — the tab shell, Delivery body, Reminders body, and a literal Templates-tab stub. The `email-templates` session that runs after will do a scoped swap-in to replace the stub. (Despite the alphabetical position in IMPLEMENTATION-PLAN.md row 21/22, the briefs explicitly mandate this order — see footnote on row 21.)

**Subagent flags:**
- Owns the tab shell + Delivery + Reminders bodies. Templates tab body owned by `email-templates` (runs second).
- **Required stub marker:** in `src/app/admin/emails/page.tsx`, render the Templates tab as a placeholder/EmptyState containing the literal text `Templates tab body — populated by the email-templates session`. The `email-templates` session greps for this marker; if missing, that session exits STUCK.
- Recipe Step 13 handoff grep-verifies the stub is present before emitting `HANDOFF_READY`.

**`/goal` preface addendum (recommended):**
> "You own the tab shell at `src/app/admin/emails/page.tsx` for `/admin/emails`. Render a Templates tab body as a stub component or `EmptyState` containing the literal text `Templates tab body — populated by the email-templates session`. The `email-templates` session runs after yours and will swap your stub for the real Templates tab content. Do not implement template browsing, preview, or editing in this session."

---

### 2.23 — enquiries (row 23) ⚠ FAKE

**Brief:** `redesign/briefs/enquiries-brief.md`
**Backend status:** **FAKE** — `BUILD-enquiries-filter-query` is BLOCKS-REDESIGN
**RBAC:** test.admin OR test.owner
**Recommended port:** 3001
**Subagent flags:** none beyond Backend FAKE handling.

---

### 2.24 — operations (row 24) ⚠ FAKE

**Brief:** `redesign/briefs/operations-brief.md`
**Backend status:** **FAKE** — `BUILD-operations-filter-query` is BLOCKS-REDESIGN
**RBAC:** test.admin OR test.owner
**Recommended port:** 3001
**Subagent flags:**
- Recipe Context section in brief doesn't include explicit `### Files to edit` table — recipe infers single primary file `src/app/admin/operations/page.tsx` from RECON §2; agent given room to extract additional client list/row components under the same directory.
- Filter strip flagged FAKE.

---

### 2.25 — privacy (row 25) ⚠ FAKE

**Brief:** `redesign/briefs/privacy-brief.md`
**Backend status:** **FAKE** — `BUILD-privacy-filter-query` is BLOCKS-REDESIGN
**RBAC:** test.admin OR test.owner
**Recommended port:** 3001
**Subagent flags:**
- Filter strip flagged FAKE.

---

### 2.26 — role-detail (row 26) ⚠ FAKE · Owner-only

**Brief:** `redesign/briefs/role-detail-brief.md`
**Backend status:** **FAKE** for `deleteRole` only (non-blocking `BUILD-delete-role`)
**RBAC:** **test.owner ONLY**
**Recommended port:** 3001
**Subagent flags:**
- Brief §10 Q1 flags `deleteRole(roleId)` as net-new server action awaiting backend confirmation; recipe ties Backend status to matching non-blocking BUILD plan with graceful degrade (disabled button or hidden with `data-redesign-fake="delete-role"`) until BUILD plan lands.
- High/critical/owner/deactivate confirm flows wire to existing untouchable actions.

---

### 2.27 — roles (row 27) · Owner-only

**Brief:** `redesign/briefs/roles-brief.md`
**Backend status:** N-A (`createRole` already exists, untouchable)
**RBAC:** **test.owner ONLY**
**Recommended port:** 3001
**Subagent flags:** none.

---

### 2.28 — services (row 28) · Owner-only

**Brief:** `redesign/briefs/services-brief.md`
**Backend status:** N-A
**RBAC:** **test.owner ONLY**
**Recommended port:** 3001
**Subagent flags:**
- Brief lacks explicit "Brief number" header (other briefs read "Brief number: NN of 29 (Phase 5)") — agent ok to proceed; row position confirmed in IMPLEMENTATION-PLAN row 28.
- All 12 form `name` attributes called out for preservation.

---

### 2.29 — staff-availability (row 29) ⚠ FAKE

**Brief:** `redesign/briefs/staff-availability-brief.md`
**Backend status:** **FAKE** for Panels B + C (`BUILD-staff-blocked-dates-actions`, `BUILD-staff-availability-override-actions` — both BLOCKS-REDESIGN); Panel A (Weekly rules) uses existing untouchable contract and is NOT fake
**RBAC:** test.admin OR test.owner
**Recommended port:** 3001
**Subagent flags:**
- Brief §10 Q1: net-new server actions on per-staff path; per brief the proposal is to create a parallel set rather than extend global helpers. Recipe records the four new action names verbatim with named-field contracts ready for craft when BUILD plans land.

---

## Section 3 — Recommended ordering

If working sequentially, suggested order (mixes simple + complex; lands shared-infrastructure pages together):

| Wave | Pages | Why this order |
|---|---|---|
| **Wave 1 (quick wins, no BUILD-FAKE)** | calendar, availability, reports, settings | All N-A backend; small surfaces; warm up the workflow |
| **Wave 2 (dashboards)** | dashboard-owner-admin → dashboard-coordinator → dashboard-therapist | Run in this order so shared `dashboard-cards.tsx` / `notification-bell.tsx` fixes from owner-admin are inherited by the other two variants without re-doing them |
| **Wave 3 (CRM stack)** | clients, client-detail, client-new | Run in this order; client-new ⚠ flag needs your decision before launching |
| **Wave 4 (staff stack)** | staff, staff-detail, staff-availability | All Backend FAKE; brief any "blocked-dates" / "override" backend gaps |
| **Wave 5 (Owner-only)** | roles, role-detail, services | Switch to the Owner account from `/redesign/test-credentials.md` (`rahmatherapy@outlook.com` / `Password123`); do these together while you're in owner mode |
| **Wave 6 (admin lists)** | audit, enquiries, operations, privacy | All Backend FAKE with filter queries pending; similar shape |
| **Wave 7 (comms — tab-coupled)** | emails ↔ email-templates | Both touch the tabs shell; decide ownership boundary first |
| **Wave 8 (auth/access — FAKE)** | password-reset, account-password-requests | Both depend on un-built backend BUILDs; FAKE state with full DOM markers |
| **booking-detail** | (skip unless explicitly re-doing) | Already committed at `b415bb7`; IMPLEMENTATION-PLAN row still `[ ]` is just tracking-file lag |

If running in **parallel** (3-4 worktrees at once): pick from different waves so shared-infrastructure pages aren't fighting each other. Good parallel batches:
- calendar + availability + reports + settings (Wave 1) — independent
- audit + enquiries + operations + privacy (Wave 6) — independent
- clients + staff + roles + services — independent

Avoid running dashboard-* in parallel (shared files).
Avoid running emails + email-templates in parallel (tab coupling).

---

## Section 4 — Where everything lives

| Artifact | Path |
|---|---|
| Per-page recipes (all 26) | `redesign/per-page-recipes/<slug>-recipe.md` |
| Per-page progress scratchpads (all 26) | `redesign/per-page-progress/<slug>-progress.md` |
| Per-page scope contracts (written by each session) | `redesign/per-page-scope/<slug>-scope.md` |
| Harden recommendations reports | `redesign/HARDEN-RECS-<slug>.md` |
| Audit + critique score sections | `redesign/PER-PAGE-SCORES.md` (appended per page) |
| Screenshots from /goal sessions | `redesign/screenshots/<slug>-redesign/*.png` |
| Adapt-after baseline screenshots | `redesign/baseline/<slug>-adapt-after-{mobile,tablet}.png` |
| This launch sheet | `redesign/LAUNCH-SHEET.md` |
| Phase 6 workflow source | `redesign/phase6-admin-workflow-guide.html` (reference only — recipes inline the prompts) |

---

## Section 5 — What to do if a `/goal` session goes wrong

| Symptom | Action |
|---|---|
| Agent ignores recipe file path and starts searching | `/goal clear` immediately. Re-paste with the explicit "do NOT use Glob or search" instruction emphasised. |
| Agent fabricates evidence (claims a step is done without doing it) | `/goal clear`. Reduce scope: send a corrected `/goal` that names ONLY the steps from where it went wrong. |
| Agent emits `STUCK: N — <reason>` | Read the reason. Common: brief contradiction (resolve & give explicit direction), missing skill, missing test credentials. Re-launch with the fix. |
| Goal hits 40-turn cap with progress | Read progress file. If close, raise cap manually (`/goal clear`, then re-paste with `Stop after 80 turns`). If far, root-cause first. |
| Dev server fails to start | Check `<worktree>\node_modules` exists as a real directory (not a junction) and contains `next\package.json`. If broken or missing, ping the main agent to tear down + re-spawn the worktree (the spawn script will re-robocopy `node_modules` fresh). Do NOT run `pnpm install` in the worktree — that's a security boundary we don't cross during Phase 6. |
| Worktree won't delete after merge | Leftover Node processes hold files. Find them: `Get-CimInstance Win32_Process \| ? { $_.CommandLine -like "*<slug>-redesign*" }` and `Stop-Process -Force`. Then retry. |

---

End of launch sheet. Update as pages complete.
