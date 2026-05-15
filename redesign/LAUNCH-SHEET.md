# Phase 6 admin redesign — per-page launch sheet

This is the per-page reference for running `/goal`-driven redesigns. The 4 pages already merged into `redesign/start-state` (00-shared-components, booking-new, bookings, booking-detail, login) are not listed here — see git log for those.

For each page below: setup commands, the exact `/goal` command to paste, and any agent-flagged quirks to be aware of going in. The setup and `/goal` blocks are templated — substitute `<SLUG>` for the page's slug; everything else stays verbatim.

---

## Section 0 — One-time preflight (do once, then reuse for every page)

### 0a. Disable your existing Stop hook

`/goal` is itself a session-scoped Stop hook. Your existing Stop hook (the polish-loop instruction we saw fire earlier) will layer with `/goal` and confuse the evaluator. In `~/.claude/settings.local.json` (or wherever your Stop hook lives), comment out or rename the `Stop` key for the duration of `/goal` runs.

Verify with `/hooks` in any session — Stop hooks should be empty.

### 0b. Verify Claude Code session config

In any fresh Claude Code window you'll use:
```
/config       → set model = Opus 4.7, thinking = medium
/skills       → confirm `impeccable` (with subcommands) and `ralph-loop` are listed
/mcp          → confirm `playwright` is connected (chrome-devtools optional)
```

If `impeccable` isn't listed, the page's `/goal` session will exit at Step 0 with `STUCK: 0 — skill impeccable unavailable`. Surface the plugin first.

### 0c. Land the login work first if you haven't

The `redesign/start-state` HEAD must contain login before any other page runs. Verify with `git log --oneline -3 redesign/start-state` — top three commits should include `redesign: login` and `Mark login [x] complete`. Done as of `a054df4`.

---

## Section 1 — Per-page workflow (common — substitute `<SLUG>` everywhere)

### 1a. Worktree setup (PowerShell, run from main tree `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`)

```powershell
$slug = "<SLUG>"
$mainTree = "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor"
$worktree = "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-$slug-redesign"

# 1. Create the worktree from current redesign/start-state HEAD
git worktree add $worktree -b "agent/$slug-redesign" redesign/start-state

# 2. Junction node_modules so dev server starts fast
cmd /c mklink /J "$worktree\node_modules" "$mainTree\node_modules"

# 3. Copy the per-page recipe + progress files into the worktree
New-Item -ItemType Directory -Force "$worktree\redesign\per-page-recipes" | Out-Null
New-Item -ItemType Directory -Force "$worktree\redesign\per-page-progress" | Out-Null
Copy-Item "$mainTree\redesign\per-page-recipes\$slug-recipe.md" "$worktree\redesign\per-page-recipes\"
Copy-Item "$mainTree\redesign\per-page-progress\$slug-progress.md" "$worktree\redesign\per-page-progress\"
```

### 1b. (Optional — for parallel runs only) reassign the dev port

The recipes default to port 3001. If you're running multiple worktree sessions in parallel, give each a unique port (3001 / 3002 / 3003 …):

```powershell
# Change the dev port for this worktree from 3001 to e.g. 3002
$port = 3002
$recipePath = "$worktree\redesign\per-page-recipes\$slug-recipe.md"
(Get-Content $recipePath) -replace '3001', "$port" | Set-Content $recipePath
```

For single-page sequential runs, leave at 3001.

### 1c. Open Claude Code in the worktree

```powershell
cd $worktree
claude
```

In the new CC window: confirm Section 0 settings hold (`/config`, `/skills`, `/mcp`), then paste the page's `/goal` command (next sub-section).

### 1d. Generic `/goal` command template (substitute `<SLUG>` — exactly one substitution if path is the same)

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-<SLUG>-redesign\redesign\per-page-recipes\<SLUG>-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-<SLUG>-redesign\redesign\per-page-progress\<SLUG>-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The goal is met when ALL literal strings in the recipe's "/goal evaluator quick-reference" section have appeared in this transcript (the recipe lists them). The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable. Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". If stuck, emit "STUCK: <step> — <reason>" and stop. Stop after 40 turns.
```

### 1e. Watch the first 3 turns live

If the agent skips the recipe-file Read in turn 1, fabricates evidence, or claims `SKILLS_OK` without actually verifying skills — `/goal clear` immediately. Re-paste a corrected command or ask me before continuing.

Healthy signs in turns 1–3:
- Turn 1: reads the recipe file (you'll see a Read tool call on the exact absolute path)
- Turn 2: emits `SKILLS_OK: craft, adapt, harden, clarify, audit, critique, ralph-loop` literal
- Turn 3: begins re-prime (reading the brief + foundation files)

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

# Kill any leftover dev-server processes (Next.js / postcss / webpack — they will hold the dir open)
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*rahmatherapy-$slug-redesign*" -and $_.Name -ne "powershell.exe" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 2

# Remove worktree dir + delete branch + prune registry
Remove-Item -Recurse -Force $worktree
git worktree prune
git branch -d "agent/$slug-redesign"
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

### 2.07 — client-new (row 7) ⚠

**Brief:** `redesign/briefs/client-new-brief.md`
**Backend status:** N-A
**RBAC:** test.admin (manage_clients_all)
**Recommended port:** 3001
**Subagent flags:**
- **⚠ FLAG:** Brief has an internal contradiction — §5 calls for "a small update to accept and insert city/area" in `actions.ts`, while Recipe Context still lists `createClient` server action as untouchable. The recipe encodes a conservative default (treat `actions.ts` as NEVER-touch, render fields only) plus a STUCK trigger so the agent escalates if it reaches a wiring fork without prior user authorisation.
- postcodes.io integration explicitly out-of-scope per brief §4 (deferred to `BUILD-postcode-lookup-client.md`).
- Before launching, decide whether you'll authorise the `actions.ts` exception — if yes, tell the agent in the `/goal` preface; if no, accept the STUCK exit at the relevant step.

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
- Recipe adds evaluator anchor `BORDER_L4_HITS: 0` per brief's audit requirement.

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
- Step 11 explicitly notes sign-in must be as `test.owner@rahmatherapy.example.test` / appropriate password (NOT `test.admin@...`).
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

### 2.21 — email-templates (row 21) ⚠ FAKE · tab-coupled

**Brief:** `redesign/briefs/email-templates-brief.md`
**Backend status:** **FAKE** — four BLOCKS-REDESIGN BUILDs: `BUILD-email-template-overrides-table`, `BUILD-email-templates-actions`, `BUILD-email-templates-preview-route`, `BUILD-rbac-permission-email-templates`
**RBAC:** test.admin OR test.owner
**Recommended port:** 3001
**Subagent flags:**
- Recipe adds extra evaluator anchor `SERVER_ONLY_GUARD:` for the `templates.ts` SERVER ONLY constraint.
- **Tab-shell coupling with `emails`**: this page owns the Templates tab body; `emails` page owns the tab shell + Delivery + Reminders bodies. Recipe screenshots/dev-server URL route to `/admin/emails?tab=templates`. Brief Q1 unresolved (route at `/admin/emails` tabs vs separate `/admin/email-templates`) — recipe defers to Recipe Context's file placement under `src/app/admin/email-templates/`.

---

### 2.22 — emails (row 22) ⚠ FAKE · tab-host

**Brief:** `redesign/briefs/emails-brief.md`
**Backend status:** **FAKE** — `BUILD-email-delivery-filter-query` + `BUILD-automated-booking-reminders` BLOCKS-REDESIGN
**RBAC:** test.admin OR test.owner
**Recommended port:** 3001
**Subagent flags:**
- Owns the tab shell + Delivery + Reminders bodies; coupled with `email-templates` (which owns Templates tab body).
- Run BEFORE or AFTER email-templates, but ensure both sessions agree on the tab shell ownership boundary (recipe carries a "Tabbed-shell coupling" note).

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
| **Wave 5 (Owner-only)** | roles, role-detail, services | Switch to `test.owner@…` creds; do these together while you're in owner mode |
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
| Agent claims `SKILLS_OK` after only loading `using-superpowers` | `/goal clear`. Verify `/skills` shows `impeccable` + `ralph-loop`. Re-paste. |
| Agent fabricates evidence (claims a step is done without doing it) | `/goal clear`. Reduce scope: send a corrected `/goal` that names ONLY the steps from where it went wrong. |
| Agent emits `STUCK: N — <reason>` | Read the reason. Common: brief contradiction (resolve & give explicit direction), missing skill, missing test credentials. Re-launch with the fix. |
| Goal hits 40-turn cap with progress | Read progress file. If close, raise cap manually (`/goal clear`, then re-paste with `Stop after 80 turns`). If far, root-cause first. |
| Dev server fails to start | Check node_modules junction (`Get-Item <worktree>\node_modules`). If broken, recreate. If still fails, `pnpm install --prefer-offline` in the worktree. |
| Worktree won't delete after merge | Leftover Node processes hold files. Find them: `Get-CimInstance Win32_Process \| ? { $_.CommandLine -like "*<slug>-redesign*" }` and `Stop-Process -Force`. Then retry. |

---

End of launch sheet. Update as pages complete.
