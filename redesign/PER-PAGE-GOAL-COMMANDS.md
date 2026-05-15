# Per-page /goal commands — Phase 6 admin redesign

This file is the copy-paste reference for kicking off `/goal`-driven, autonomous per-page redesign sessions across the 26 remaining admin pages. One section per page. Each section contains the exact `/goal` command with the slug, worktree paths, and port already substituted — open the section for your page, copy the entire code block, and paste it as the first message in the spawned worktree's Claude Code session.

This sheet is the runtime companion to `redesign/LAUNCH-SHEET.md` (which holds the full preflight rationale + per-page background). When in doubt about *why* a step exists, read the launch sheet. When you're ready to execute, copy from here.

**Per-page preface placement convention used in this file:** when a page has an extra preface addendum (per LAUNCH-SHEET §2), it lives in a clearly-labelled "**Per-page preface to paste alongside the /goal command**" callout *above* the code block. Send the preface as a normal chat message immediately *before* the `/goal` command — do not concatenate it into the `/goal` string itself (which would risk Haiku evaluator interpreting it as part of the goal condition).

## How to use this file

1. Decide which page to redesign next (per LAUNCH-SHEET §3 — Wave 1 quick wins are: `calendar`, `availability`, `reports`, `settings`).
2. From the main tree, spawn the worktree:
   ```powershell
   node scripts/spawn-worktree.mjs <slug>
   ```
   The script creates the worktree at `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-<slug>-redesign`, junctions `node_modules`, and copies the latest recipe + progress + test-credentials files into it.
3. Open Claude Code in the worktree:
   ```powershell
   cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-<slug>-redesign"
   claude
   ```
4. **Confirm preflight in the new session** (per LAUNCH-SHEET §0):
   - `/config` → Opus 4.7 + thinking = medium (subagents inherit this)
   - `/skills` → `impeccable` (with subcommands: craft, adapt, harden, clarify, audit, critique) + `ralph-loop` listed
   - `/mcp` → `playwright` connected (chrome-devtools optional)
   - `/hooks` → Stop hooks should be empty (you removed the entry; you did NOT set `disableAllHooks: true`)
   - `claude --version` → ≥ 2.1.140 (v2.1.139 has a known-buggy `/goal`; v2.1.140 fixes the silent-hang)
   - `$env:ANTHROPIC_DEFAULT_HAIKU_MODEL` set to `claude-haiku-4-5-20251001` so all parallel worktrees evaluate against the same Haiku revision
5. Find the matching `/goal` command below for your slug, then:
   - If the section has a "**Per-page preface to paste alongside the /goal command**" callout, **paste the preface text first as a regular message**, wait for the agent's acknowledgement, then paste the `/goal` command.
   - If there is no preface callout, paste the `/goal` command directly.
6. Watch the first 3 turns (per LAUNCH-SHEET §1e). Healthy signs:
   - Turn 1: Read tool call on the exact recipe path
   - Turn 2: emits `SKILLS_OK: craft, adapt, harden, clarify, audit, critique, ralph-loop`
   - Turn 3: begins re-prime (reading brief + foundation files)
   - Unhealthy: agent skips the recipe Read, fabricates evidence, or claims `SKILLS_OK` after only loading `using-superpowers`. If any of these → `/goal clear` immediately and re-paste a corrected command.
7. When the agent emits `HANDOFF_READY — awaiting user approval`, signal back to the main agent in your primary session for QC + merge (per LAUNCH-SHEET §1f and §1g).

## Critical reminders (never violate)

- **Stop hooks must be REMOVED, not disabled.** `disableAllHooks: true` or `allowManagedHooksOnly: true` will silently break `/goal` itself (CLI v2.1.140 surfaces a clear error, but the failure mode is the same — your goal never starts). Open `~/.claude/settings.local.json` and remove the `Stop` key entry for the duration of `/goal` runs.
- **CLI version pin:** ≥ 2.1.140. v2.1.139 shipped a known-buggy `/goal`.
- **Haiku evaluator pin:** `$env:ANTHROPIC_DEFAULT_HAIKU_MODEL = "claude-haiku-4-5-20251001"`. Parallel worktrees launched this week should all use the same evaluator even if Anthropic ships a new Haiku next week.
- **Subagent inheritance:** subagents inherit the parent session's `/config` model + thinking depth. Set Opus 4.7 + medium thinking *once* in the parent and you don't need to re-set it inside subagents.
- **Never auto-commit.** The agent under `/goal` must NEVER commit, NEVER stage with `git add .` or `git add -A`. Final step is `HANDOFF_READY` only. Commits happen only after you explicitly type `approved` in the worktree session AND the main-tree audit has passed.
- **Never modify the main tree from a worktree.** The agent's CWD is the worktree; the recipe enumerates "Files to NEVER touch" — do not let the agent stray from those.
- **Don't paste extra prose after the `/goal` command.** The Haiku evaluator only judges the goal condition string + transcript. Anything you concatenate after the `/goal` line is just chat — it does NOT change the termination criteria. Use the per-page preface (sent as a separate message *before* `/goal`) for context that should reach the agent without entering the goal-condition string.

## Recommended wave ordering (mirrors LAUNCH-SHEET §3)

If running sequentially, follow these waves. If running in parallel (3–4 worktrees at once), pick from different waves so shared-infrastructure pages aren't fighting each other. Avoid running `dashboard-*` in parallel (shared files). Avoid running `emails` + `email-templates` in parallel (tab coupling — strict sequential ordering required, see notes on those two pages).

| Wave | Pages | Notes |
|---|---|---|
| **Wave 1 — quick wins** | `calendar`, `availability`, `reports`, `settings` | All N-A backend; small surfaces; warm up the workflow |
| **Wave 2 — dashboards** | `dashboard-owner-admin` → `dashboard-coordinator` → `dashboard-therapist` | Run in this order so shared `dashboard-cards.tsx` / `notification-bell.tsx` fixes from owner-admin are inherited by the other two variants |
| **Wave 3 — CRM stack** | `clients`, `client-detail`, `client-new` | `client-new` has a sanctioned `actions.ts` extension — see its preface |
| **Wave 4 — staff stack** | `staff`, `staff-detail`, `staff-availability` | All Backend FAKE for filter queries / blocked-dates / overrides |
| **Wave 5 — Owner-only** | `roles`, `role-detail`, `services`, `settings` | Sign in as the Owner account (`rahmatherapy@outlook.com` / `Password123`); do these together while in owner mode |
| **Wave 6 — admin lists** | `audit`, `enquiries`, `operations`, `privacy` | All Backend FAKE with filter queries pending; similar shape |
| **Wave 7 — comms tab pair** | **`emails` first**, then `email-templates` | Strict sequential. `emails` lays the tab shell + Templates-tab stub; `email-templates` does a scoped swap-in. NEVER run in parallel. |
| **Wave 8 — auth/access (FAKE)** | `password-reset`, `account-password-requests` | Both depend on un-built backend BUILDs; FAKE state with full DOM markers |
| (skip) | `booking-detail` | Already committed at `b415bb7`; re-running would re-do work. Listed below for completeness. |

---

## Pages (alphabetical)

### account-password-requests — port 3002

**Backend status:** **FAKE** — three BLOCKS-REDESIGN BUILD plans still unchecked (`BUILD-rbac-permission-account-password-requests`, `BUILD-password-reset-email-templates`, `BUILD-approve-reject-password-reset`)
**RBAC:** test.admin OR test.owner
**Per-page note:** Greenfield 4-file surface. Recipe adds evaluator anchor `BACKEND_FAKE_SURFACES:` to enforce `data-redesign-backend="FAKE"` DOM markers on all FAKE controls. Test database may have zero pending rows — recipe Step 7 includes a heads-up to seed a row before Step 11 verification.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-account-password-requests-redesign\redesign\per-page-recipes\account-password-requests-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-account-password-requests-redesign\redesign\per-page-progress\account-password-requests-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### audit — port 3003

**Backend status:** **FAKE** — `BUILD-audit-filter-and-pagination` is BLOCKS-REDESIGN (non-blocking `BUILD-audit-target-existence` noted)
**RBAC:** test.admin OR test.owner
**Per-page note:** Forensic-trust invariants apply (verbatim redaction regex, no-writes-on-load). Recipe adds two unique evaluator anchors: `AUDIT_WRITES_ON_LOAD: 0` and `REDACTION_REGEX_VERBATIM: yes`. Dedicated forensic check in Step 11a.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-audit-redesign\redesign\per-page-recipes\audit-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-audit-redesign\redesign\per-page-progress\audit-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### availability — port 3004

**Backend status:** N-A (non-blocking `BUILD-availability-this-week-chip` noted with graceful degradation)
**RBAC:** test.admin OR test.owner
**Per-page note:** 4-file restyle. Recipe adds evaluator anchor `BORDER_L4_HITS: 0` per brief's audit requirement.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-availability-redesign\redesign\per-page-recipes\availability-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-availability-redesign\redesign\per-page-progress\availability-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### booking-detail — port 3005

**Backend status:** TBD per brief (no explicit BUILD plan dependency)
**RBAC:** test.admin sees full surface; test.therapist sees narrowed view
**Per-page note:** **Already committed (commit `b415bb7`) and marked [x] in IMPLEMENTATION-PLAN.md row 4 (flipped in commit `eae9f67`).** Re-running this recipe would re-do the work — skip unless you actively want a re-redesign. The command is included below for completeness only.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-booking-detail-redesign\redesign\per-page-recipes\booking-detail-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-booking-detail-redesign\redesign\per-page-progress\booking-detail-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### calendar — port 3006

**Backend status:** N-A
**RBAC:** test.admin / test.coordinator
**Per-page note:** Single-file restyle. Recipe adds evaluator anchors `IMAGES_NEEDED_DELTA:` (for `calendar-empty.svg`) and `BG_WHITE_HITS: 0`.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-calendar-redesign\redesign\per-page-recipes\calendar-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-calendar-redesign\redesign\per-page-progress\calendar-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### client-detail — port 3007

**Backend status:** N-A (high RBAC complexity but no BUILD blockers)
**RBAC:** test.admin (most permission-varied page after booking-detail)
**Per-page note:** Brief Open-Question-3 flags a server-action name discrepancy: `requestClientPrivacyAction` (RECON §6.1) vs `createClientPrivacyRequest` (current `ClientDetailForms.tsx`). Recipe routes the agent to verify the exported name from `src/app/admin/clients/actions.ts` at Step 3 before wiring, and surface the resolved name in Step 13 handoff.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-client-detail-redesign\redesign\per-page-recipes\client-detail-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-client-detail-redesign\redesign\per-page-progress\client-detail-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### client-new — port 3008

**Backend status:** N-A
**RBAC:** test.admin (manage_clients_all)
**Per-page note:** Brief §5 authorises a small additive extension to `src/app/admin/clients/actions.ts` (read 2 FormData fields — `city`, `area` — and add to insert payload). This is a sanctioned exception to the RECON §5 untouchable rule for this one file, this one session. The migration `supabase/migrations/20260513120000_add_client_city_area.sql` is in the repo. STUCK trigger now narrows to the only actual blocker: if the migration is missing or the `city`/`area` columns don't exist when the schema is read. postcodes.io integration is explicitly out-of-scope (deferred to `BUILD-postcode-lookup-client.md`).

> **Per-page preface to paste alongside the /goal command** (send as a regular message *before* the `/goal` command, then wait for a brief acknowledgement):
> "Brief §5 authorises a small extension to `src/app/admin/clients/actions.ts` to accept `city` and `area`. This is a sanctioned exception to RECON §5's blanket untouchable rule for this one file, this one session. Treat `actions.ts` as in-scope for additive field reads/inserts only; do not touch duplicate-detection, validation, or any other code path in that file."

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-client-new-redesign\redesign\per-page-recipes\client-new-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-client-new-redesign\redesign\per-page-progress\client-new-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### clients — port 3009

**Backend status:** N-A (non-blocking `BUILD-clients-sort-last-visit`)
**RBAC:** test.admin (admin/coordinator see `manage_clients_all`; therapists scoped)
**Per-page note:** No subagent flags.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-clients-redesign\redesign\per-page-recipes\clients-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-clients-redesign\redesign\per-page-progress\clients-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### dashboard-coordinator — port 3010

**Backend status:** N-A (`dashboard-data.ts` untouchable)
**RBAC:** test.coordinator
**Per-page note:** **MILD FLAG** — Brief OQ1 says the Active Enquiries data fetcher may not exist in the coordinator-variant payload of `dashboard-data.ts`. Recipe routes the implementer to either render `0` + empty state OR emit `STUCK` if the data shape blocks the implementation. `dashboard-data.ts` remains untouchable either way. Shares infrastructure files with `dashboard-owner-admin` + `dashboard-therapist` (`dashboard-cards.tsx`, `notification-bell.tsx`, `attention-group-client.tsx`, `dashboard-header.tsx`, `dashboard-filters-client.tsx`) — recipe checks whether prior variant sessions have already landed Brief-06 carry-forward fixes and skips those edits if already in `redesign/start-state`. **Run AFTER `dashboard-owner-admin`** to inherit the shared-infrastructure fixes.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-dashboard-coordinator-redesign\redesign\per-page-recipes\dashboard-coordinator-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-dashboard-coordinator-redesign\redesign\per-page-progress\dashboard-coordinator-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### dashboard-owner-admin — port 3011

**Backend status:** N-A (`dashboard-data.ts` is untouchable; uses existing payloads)
**RBAC:** test.owner OR test.admin (Owner + Admin/PM both qualify)
**Per-page note:** **Run FIRST** of the three dashboards — shared-infrastructure files (`dashboard-cards.tsx`, `notification-bell.tsx`, `attention-group-client.tsx`, `dashboard-header.tsx`, `dashboard-filters-client.tsx`) carry-forward fixes (`border-l-4`, `bg-black`, avatar hexes, raw chart colors) get applied here and inherited by the coordinator + therapist variants. Brief OQ2 about `notification-bell.tsx` coordinated with `00-shared-components` — recipe defers to whatever 00-shared landed.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-dashboard-owner-admin-redesign\redesign\per-page-recipes\dashboard-owner-admin-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-dashboard-owner-admin-redesign\redesign\per-page-progress\dashboard-owner-admin-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### dashboard-therapist — port 3012

**Backend status:** N-A
**RBAC:** test.therapist
**Per-page note:** Primary canvas is **mobile (375px)** with desktop documented as "phone layout, more comfortable line height". Recipe Step 8 explicitly checks no multi-column desktop chrome is introduced. Brief OQ1 (tomorrow-first-visit) and OQ2 (client-phone-on-nextAppointment) routed to documented empty-state / "Open booking" fallbacks per brief. Shares infrastructure with `dashboard-owner-admin` + `dashboard-coordinator` — **run AFTER both** of those for cleanest inheritance.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-dashboard-therapist-redesign\redesign\per-page-recipes\dashboard-therapist-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-dashboard-therapist-redesign\redesign\per-page-progress\dashboard-therapist-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### email-templates — port 3013

**Backend status:** **FAKE** — four BLOCKS-REDESIGN BUILDs: `BUILD-email-template-overrides-table`, `BUILD-email-templates-actions`, `BUILD-email-templates-preview-route`, `BUILD-rbac-permission-email-templates`
**RBAC:** test.admin OR test.owner
**Per-page note:** **HARD ORDERING RULE — runs SECOND in the emails ↔ email-templates pair.** Run **AFTER** `emails`. The `emails` session lays the tab shell + Delivery + Reminders bodies + a literal Templates-tab stub. This session does a scoped swap-in to replace the stub with the real `<TemplatesTab />` component — no tab-shell rebuild. If the stub marker is missing in `src/app/admin/emails/page.tsx` when this session starts, it will exit with `STUCK: <step> — emails session has not laid the tab shell`. NEVER run in parallel with `emails`. Recipe owns: `src/app/admin/emails/components/` (new directory: TemplateBrowser, TemplatePreviewPanel, TemplateEditForm, ManualSendSheet), `src/app/admin/email-templates/preview/[id]/route.ts`, `src/app/admin/email-templates/actions.ts`, plus a **two-line scoped edit** to `src/app/admin/emails/page.tsx`. Final user-facing route: `/admin/emails?tab=templates`. Recipe adds extra evaluator anchor `SERVER_ONLY_GUARD:` for the `templates.ts` SERVER ONLY constraint.

> **Per-page preface to paste alongside the /goal command** (send as a regular message *before* the `/goal` command, then wait for a brief acknowledgement):
> "The `emails` session has already established the tab shell at `src/app/admin/emails/page.tsx` and rendered a stub for the Templates tab. Your scope for `emails/page.tsx` is limited to: (1) import the new `<TemplatesTab />` component you'll build under `src/app/admin/emails/components/`, (2) swap the stub for that import. Everything else lives under `src/app/admin/emails/components/` and `src/app/admin/email-templates/`. If the stub marker `Templates tab body — populated by the email-templates session` is missing, STOP and emit STUCK."

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-email-templates-redesign\redesign\per-page-recipes\email-templates-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-email-templates-redesign\redesign\per-page-progress\email-templates-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### emails — port 3014

**Backend status:** **FAKE** — `BUILD-email-delivery-filter-query` + `BUILD-automated-booking-reminders` are BLOCKS-REDESIGN
**RBAC:** test.admin OR test.owner
**Per-page note:** **HARD ORDERING RULE — runs FIRST in the emails ↔ email-templates pair.** Run **BEFORE** `email-templates`. This session owns `src/app/admin/emails/page.tsx` outright — the tab shell, Delivery body, Reminders body, and a literal Templates-tab stub. The `email-templates` session that runs after will do a scoped swap-in to replace the stub. (Despite alphabetical order putting `email-templates` first in the file, the briefs explicitly mandate this run-order — see LAUNCH-SHEET §2.21 footnote.) NEVER run in parallel with `email-templates`. **Required stub marker:** in `src/app/admin/emails/page.tsx`, render the Templates tab as a placeholder/EmptyState containing the literal text `Templates tab body — populated by the email-templates session`. The `email-templates` session greps for this marker; if missing, that session exits STUCK. Recipe Step 13 handoff grep-verifies the stub is present before emitting `HANDOFF_READY`.

> **Per-page preface to paste alongside the /goal command** (send as a regular message *before* the `/goal` command, then wait for a brief acknowledgement):
> "You own the tab shell at `src/app/admin/emails/page.tsx` for `/admin/emails`. Render a Templates tab body as a stub component or `EmptyState` containing the literal text `Templates tab body — populated by the email-templates session`. The `email-templates` session runs after yours and will swap your stub for the real Templates tab content. Do not implement template browsing, preview, or editing in this session."

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-emails-redesign\redesign\per-page-recipes\emails-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-emails-redesign\redesign\per-page-progress\emails-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### enquiries — port 3015

**Backend status:** **FAKE** — `BUILD-enquiries-filter-query` is BLOCKS-REDESIGN
**RBAC:** test.admin OR test.owner
**Per-page note:** No subagent flags beyond Backend FAKE handling.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-enquiries-redesign\redesign\per-page-recipes\enquiries-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-enquiries-redesign\redesign\per-page-progress\enquiries-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### login — port 3016

**Backend status:** N-A (login has no BLOCKS-REDESIGN backend dependencies)
**RBAC:** public (pre-auth surface)
**Per-page note:** Login is the canonical exemplar already merged into `redesign/start-state` (commit `a054df4`). The recipe + worktree command are included here for reference / re-redesign use only. Confirm `git log --oneline -3 redesign/start-state` includes `redesign: login` and `Mark login [x] complete` before treating any other page recipe's "login pattern" reference as canonical.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-login-redesign\redesign\per-page-recipes\login-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-login-redesign\redesign\per-page-progress\login-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### operations — port 3017

**Backend status:** **FAKE** — `BUILD-operations-filter-query` is BLOCKS-REDESIGN
**RBAC:** test.admin OR test.owner
**Per-page note:** Recipe Context section in brief doesn't include explicit `### Files to edit` table — recipe infers single primary file `src/app/admin/operations/page.tsx` from RECON §2; agent given room to extract additional client list/row components under the same directory. Filter strip flagged FAKE.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-operations-redesign\redesign\per-page-recipes\operations-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-operations-redesign\redesign\per-page-progress\operations-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### password-reset — port 3018

**Backend status:** **FAKE** — two BLOCKS-REDESIGN BUILD plans still unchecked (`BUILD-password-reset-email-templates`, `BUILD-password-reset-request-actions`)
**RBAC:** **public (no sign-in required)** — this is a pre-auth surface, like login
**Per-page note:** Greenfield 6-state public pre-auth flow. Step 7/8/11 reflect "no sign-in required" + middleware allow-list dependency. Recipe legitimately references `/admin/login` route as a foreign page in 6 places ("Back to sign in" link, Login session ownership of `page.tsx`, "Forgot your password?" cross-reference). Six state-specific screenshots requested using FAKE-handler test tokens. Recipe adds evaluator anchors `DANGEROUSLY_SET_INNER_HTML_HITS: 0` and `UNIFORM_RESPONSE_PASS: true`.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-password-reset-redesign\redesign\per-page-recipes\password-reset-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-password-reset-redesign\redesign\per-page-progress\password-reset-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### privacy — port 3019

**Backend status:** **FAKE** — `BUILD-privacy-filter-query` is BLOCKS-REDESIGN
**RBAC:** test.admin OR test.owner
**Per-page note:** Filter strip flagged FAKE.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-privacy-redesign\redesign\per-page-recipes\privacy-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-privacy-redesign\redesign\per-page-progress\privacy-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### reports — port 3020

**Backend status:** N-A
**RBAC:** test.admin OR test.owner (`view_reports_revenue` gated)
**Per-page note:** Single-file page (`page.tsx`). Recipe adds extra evaluator anchor `RECHARTS_WARNINGS: 0` (Recharts `minHeight: 288` carry-forward fix). Step 11 explicitly notes: `[288px]` literal IS required (Recharts container) — should NOT be refactored away by token-drift lint.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-reports-redesign\redesign\per-page-recipes\reports-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-reports-redesign\redesign\per-page-progress\reports-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### role-detail — port 3021

**Backend status:** **FAKE** for `deleteRole` only (non-blocking `BUILD-delete-role`)
**RBAC:** **test.owner ONLY** — sign in as the Owner account from `/redesign/test-credentials.md` (`rahmatherapy@outlook.com` / `Password123`); there is no `test.owner@…` account.
**Per-page note:** Brief §10 Q1 flags `deleteRole(roleId)` as net-new server action awaiting backend confirmation; recipe ties Backend status to matching non-blocking BUILD plan with graceful degrade (disabled button or hidden with `data-redesign-fake="delete-role"`) until BUILD plan lands. High/critical/owner/deactivate confirm flows wire to existing untouchable actions.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-role-detail-redesign\redesign\per-page-recipes\role-detail-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-role-detail-redesign\redesign\per-page-progress\role-detail-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### roles — port 3022

**Backend status:** N-A (`createRole` already exists, untouchable)
**RBAC:** **test.owner ONLY** — sign in as the Owner account from `/redesign/test-credentials.md` (`rahmatherapy@outlook.com` / `Password123`); there is no `test.owner@…` account.
**Per-page note:** No subagent flags.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-roles-redesign\redesign\per-page-recipes\roles-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-roles-redesign\redesign\per-page-progress\roles-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### services — port 3023

**Backend status:** N-A
**RBAC:** **test.owner ONLY** — sign in as the Owner account from `/redesign/test-credentials.md` (`rahmatherapy@outlook.com` / `Password123`); there is no `test.owner@…` account.
**Per-page note:** Brief lacks explicit "Brief number" header (other briefs read "Brief number: NN of 29 (Phase 5)") — agent ok to proceed; row position confirmed in IMPLEMENTATION-PLAN row 28. All 12 form `name` attributes called out for preservation.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-services-redesign\redesign\per-page-recipes\services-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-services-redesign\redesign\per-page-progress\services-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### settings — port 3024

**Backend status:** N-A (non-blocking `BUILD-settings-last-changed-by`)
**RBAC:** **test.owner ONLY** — `MANAGE_SETTINGS` is Owner-only per RBAC seed. Sign in as the Owner account from `/redesign/test-credentials.md` (`rahmatherapy@outlook.com` / `Password123`), NOT `test.admin@...`. There is no `test.owner@…` account.
**Per-page note:** 2-file Owner-only restyle. Recipe adds evaluator anchors `BG_WHITE_HITS: 0`, `RAW_RED_HITS: 0`, `BACKDROP_BLUR_HITS: 0` per brief soft-fix carry-forwards.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-settings-redesign\redesign\per-page-recipes\settings-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-settings-redesign\redesign\per-page-progress\settings-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### staff — port 3025

**Backend status:** **FAKE** — `BUILD-staff-filter-query` is BLOCKS-REDESIGN (non-blocking `BUILD-staff-workload-aggregates` noted)
**RBAC:** test.admin OR test.owner
**Per-page note:** Introduces 7 net-new GET params (`q`, `roleId`, `gender`, `status`, `workload`, `bookable`, `onboarding`) — all listed in Step 12 smoke test.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-staff-redesign\redesign\per-page-recipes\staff-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-staff-redesign\redesign\per-page-progress\staff-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### staff-availability — port 3026

**Backend status:** **FAKE** for Panels B + C (`BUILD-staff-blocked-dates-actions`, `BUILD-staff-availability-override-actions` — both BLOCKS-REDESIGN); Panel A (Weekly rules) uses existing untouchable contract and is NOT fake
**RBAC:** test.admin OR test.owner
**Per-page note:** Brief §10 Q1: net-new server actions on per-staff path; per brief the proposal is to create a parallel set rather than extend global helpers. Recipe records the four new action names verbatim with named-field contracts ready for craft when BUILD plans land.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-staff-availability-redesign\redesign\per-page-recipes\staff-availability-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-staff-availability-redesign\redesign\per-page-progress\staff-availability-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

### staff-detail — port 3027

**Backend status:** HANDLED (no BLOCKS-REDESIGN; brief §10 Q3 assignment `limit(8)→16` is a soft non-blocking adjustment)
**RBAC:** test.admin OR test.owner
**Per-page note:** §10 Q3 `limit(8)→16` flagged as soft non-blocking; Backend status `HANDLED` with asterisk.

```
/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-staff-detail-redesign\redesign\per-page-recipes\staff-detail-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-staff-detail-redesign\redesign\per-page-progress\staff-detail-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".
```

---

End of per-page commands. If you add or rename a slug, update both this file and `scripts/spawn-worktree.mjs` (`PORT_BY_SLUG` map) in the same commit.
