# Phase 6 autonomous-agent plan — recipe enhancements + main-agent protocol

> **⚠ HISTORICAL — partially superseded 2026-05-16.** This doc was the design rationale for the script-based spawn + recipe-patching approach. The 15 `scripts/patch-recipes-*.mjs` one-shot scripts AND `scripts/spawn-worktree.mjs` were all deleted 2026-05-16 in favor of inline execution by the main agent. Their *outputs* (the hardened recipes themselves) remain — the scripts already did their work and the patches are baked into the 26 recipes under `redesign/per-page-recipes/`. The recipe-hardening Changes 1–8 described below ARE active in the recipes; only the *mechanism* (helper scripts) was retired.
>
> **For current workflow (how the main agent spawns worktrees today), read `MAIN-AGENT-CONTEXT.md §5A`.**
>
> This doc is preserved as historical record of the design decisions made when Phase 6 was being scaled up — useful for understanding *why* the recipes look the way they do, but not as a current operational guide.

This plan consolidates the design decisions for running Phase 6 of the admin redesign as a fleet of parallel autonomous `/goal`-driven Claude Code agents, with a main agent (operating in the user's primary session) acting as quality-control + merge broker. It's the single source of truth for the upcoming recipe enhancements and main-agent workflow.

**Scope:** all 26 per-page recipes under `redesign/per-page-recipes/` + LAUNCH-SHEET updates + one new protocol file + two new helper scripts. **Out of scope (immutable):** `redesign/phase6-admin-workflow-guide.html` and `redesign/impeccable-v5-latest-stable.html` — these are the canonical references; recipes follow them, never the reverse.

## Goals

- Each /goal agent reads its per-page recipe and completes Phase 6 for that page autonomously, with no human in the loop until `HANDOFF_READY`.
- Recipe quality is high enough that the agent never has to invent an answer that contradicts the brief, PRODUCT.md, DESIGN.md, or future phases (7 + 8).
- Phase 6 connects forward to Phase 7 (gauntlet/audit) and Phase 8 (extract/deploy) without contradiction — open questions deferred, not invented.
- Self-scoring inflation in audit/critique is eliminated by using subagents.
- Multi-axis polish + visual-polish loop produces a consistent, production-quality CRM look across all pages.
- Main agent (user's primary session) verifies completed work and brokers the merge with conflict-resolution intelligence.

## Constraints

- **Workflow guide and impeccable v5 HTML files are immutable.** Recipes may extend (add page-specific patterns, stricter checks), but never edit either source.
- **Recipe internal step numbering stays at 0–13.** Canon's 8 steps map onto these; mapping is documented in each recipe's Step 13 header. (Option A from the brainstorm.)
- **Subagents inherit the main agent's model + thinking level.** User must be on Opus 4.7 + medium thinking in `/config` before launching. (Preflight check in LAUNCH-SHEET Section 0 already covers Opus 4.7; medium thinking added to the same preflight.)
- **One `/goal` per session.** Parallel agents = parallel sessions, each in its own worktree, each on its own port.
- **No commits inside the spawned agent.** Spawned agent emits `HANDOFF_READY` and stops; main agent stages + commits after user approval.

---

## The 8 changes (in execution order)

### Change 1 — Per-page port assignment (mechanical, bulk script)

**Problem:** All 26 recipes default to port 3001. Parallel runs collide.

**Solution:** Pre-assign port `3001 + alphabetical-index` to each recipe. Port 3001 reserved for the user's main tree. 3002–3027 = 26 ports.

**Port table (alphabetical):**

| Port | Page slug |
|---|---|
| 3002 | account-password-requests |
| 3003 | audit |
| 3004 | availability |
| 3005 | booking-detail |
| 3006 | calendar |
| 3007 | client-detail |
| 3008 | client-new |
| 3009 | clients |
| 3010 | dashboard-coordinator |
| 3011 | dashboard-owner-admin |
| 3012 | dashboard-therapist |
| 3013 | email-templates |
| 3014 | emails |
| 3015 | enquiries |
| 3016 | login |
| 3017 | operations |
| 3018 | password-reset |
| 3019 | privacy |
| 3020 | reports |
| 3021 | role-detail |
| 3022 | roles |
| 3023 | services |
| 3024 | settings |
| 3025 | staff |
| 3026 | staff-availability |
| 3027 | staff-detail |

**Deliverables:**
- `scripts/patch-recipes-port-assignment.mjs` — bulk-rewrites every `3001` occurrence in each recipe's body to the pre-assigned port, plus every `DEV_SERVER_READY at http://localhost:3001` quick-reference entry.
- LAUNCH-SHEET Section 1b updated: "port is pre-assigned in each recipe; override only if your machine has a conflict."
- LAUNCH-SHEET new Section 5: full port-assignment table (mirrored from this plan).

---

### Change 2 — Decision-making directives (new recipe-header section, bulk script)

**Problem:** When `/impeccable craft` or any other step asks a question not directly covered in the brief, the autonomous agent today has no decision protocol. It guesses or stalls. Worse: it might answer a Phase 7-flavoured question that should have been deferred.

**Solution:** A "Decision-making directives" section inserted right after Hard Rules in every recipe. Two parts: answer-source priority + deferral protocol.

**Content (verbatim, in every recipe):**

```markdown
## Decision-making directives — when impeccable craft (or any tool) asks something not in the brief

The /goal session is autonomous — there's no user mid-run to consult. When impeccable craft's `shape` phase asks discovery questions (Purpose / User / Content / Feeling / Constraints), or any step surfaces a question or conflict, follow this order:

**Answer source priority (never invent):**
1. The brief at `/redesign/briefs/<slug>-brief.md` — quote the relevant section verbatim.
2. `PRODUCT.md` (register, brand voice, anti-references) and `DESIGN.md` (tokens, components, patterns).
3. `BUSINESS-COMPLETENESS.md` (Track A obligations).
4. `/redesign/RECON.md` for codebase facts.
5. If still uncovered: derive an answer using the *forward-looking criteria* below.

**Forward-looking criteria for derived answers:**
- Mobile-first; works at 375px before 1440px.
- Scales when the underlying list/data grows (pagination, load-more, virtualisation cues).
- Preserves named contracts: server-action signatures, form `name` attributes, IDs flagged in the recipe.
- Doesn't introduce cross-page contradictions — use shared components (`AdminPanel`, `AdminEntityRow`, `EmptyState`, `BookingListCard`, `AdminStatusBadge`) instead of new local equivalents.
- Uses DESIGN.md tokens, not raw colour/spacing/font literals.
- WCAG 2.1 AA: contrast, focus-visible, labels, `role="alert"` + `aria-live` on form errors, required `*` markers.
- Connects forward to Phase 7 (gauntlet/audit per `impeccable-v5-latest-stable.html`) and Phase 8 (extract/deploy) — don't bake decisions that contradict those phases' canonical scope.
- Follows the **Design Route Directives** at the top of this recipe.

**Deferral protocol — when a question is NOT a Phase 6 blocker:**

Some questions impeccable surfaces are open suggestions, polish opportunities, or post-launch concerns that belong to Phase 7 (`/impeccable audit admin`) or Phase 8 (`/impeccable extract admin`). Do NOT answer them — defer:

1. Append to `/redesign/per-page-deferrals/<slug>-deferrals.md` in this format:
   ```
   ## <Question summary>
   - **Source:** <step number / skill / file:line>
   - **Verbatim:** <what impeccable or the brief or your own observation said>
   - **Defer to:** Phase 7 / Phase 8 / post-launch
   - **Why deferred:** <one sentence>
   - **Provisional Phase 6 answer used to continue this session:** <if any>
   ```
2. Proceed with the brief's documented Phase 6 answer (or the most conservative provisional that satisfies the forward-looking criteria).

Phase 7's gauntlet agent will read all 26 deferral files and resolve them globally. This is the bridge that makes Phase 6 → Phase 7 connect cleanly.
```

**Deliverables:**
- `scripts/patch-recipes-decision-directives.mjs` — inserts the section above into all 26 recipes immediately after "Hard rules" and before "STUCK clause."
- New directory: `redesign/per-page-deferrals/` (gitkeep, populated by agents at runtime).

---

### Change 3 — Design Route Directives (new recipe-header section, bulk script — same script as Change 2)

**Problem:** Recipes today have no design north star. The brief specifies the page; PRODUCT/DESIGN specify the system; but the recipe doesn't restate the overarching design intent that should govern every decision in steps 4–11.

**Solution:** A "Design Route Directives" section after Decision-making directives.

**Content (verbatim, in every recipe):**

```markdown
## Design Route Directives — design north star for this page

These govern every visual + structural decision in steps 4–11. Read once; apply everywhere.

1. **Beautiful, mobile-first.** 375px is the primary canvas — make it look intentional, not "the desktop scaled down". Enhance to 768 → 1440 from there.
2. **Production-ready, business-workflow ready.** This is an operational CRM/backend. Every screen should look and feel like a finished professional product, not a wireframe or default-styled component drop.
3. **Responsive, modern, reactive, interactive.** Use CSS transitions on hover/focus/tab states (DESIGN.md motion tokens — `duration-fast`, `ease-gentle`); respect `prefers-reduced-motion`. Feedback on every interactive element. Never static where motion would carry meaning.
4. **Simple front door that opens into the full feature set.** Progressive disclosure. The first surface a staff member sees is calm and obvious; complexity unfolds when invited (panels, `<details>`, `AdminSheet`, modals). Never strip features — hide them behind a tap or click.
5. **Professional CRM/backend feel — never awkward, weird, or mediocre.** No generic SaaS defaults. No identical-card grids. No decorative-blob-on-empty-state. Every visual element earns its place per PRODUCT.md anti-references.
6. **Designed for lists that grow.** Where data lists exist, plan for 50+ rows: pagination/load-more, visible row density at scale, A–Z index strips where alphabetical, "show more" disclosures, virtualisation cues.
7. **Polish without straying.** All improvements stay within the recipe's "Files to edit" scope, use existing DESIGN.md tokens (no new tokens without explicit user approval), and respect the brief's "Feature Preservation Manifest."
```

**Deliverable:** Same script as Change 2 inserts both sections in one pass.

---

### Change 4 — Multi-axis polish loop (Step 7 rewrite)

**Problem:** Step 7 today says "if you can identify ONE specific axis problem, run /impeccable <axis>". A single axis rarely fixes everything; pages need 2–4 focused improvements.

**Solution:** Rewrite Step 7 to identify 2–4 axes, run them sequentially, screenshot between each, with a hard cap of 4.

**Content (replacing the existing Step 7 across all 26 recipes — script handles per-recipe slug substitution):**

```markdown
## Step 7 — Step 2 iterate (visual self-audit + multi-axis polish)

**Action:** Use the `playwright` MCP tool. Take baseline screenshots and save to `/redesign/screenshots/<slug>-redesign/`:
- `chunk1-1440-default.png` at 1440×900
- `chunk1-768-default.png` at 768×1024
- `chunk1-375-default.png` at 375×812
[Page-specific state screenshots per existing recipe content remain.]

Visually self-audit against the brief, PRODUCT.md, DESIGN.md, and the Design Route Directives at the top of this recipe.

**Identify 2 to 4 axes** where the page has *visible* problems (not plausible improvements). Skip axes that contradict each other:
- `bolder` + `quieter` contradict
- `distill` + `delight` often contradict (distill removes, delight adds)

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder <slug>` |
| Too loud, too many colours | `/impeccable quieter <slug>` |
| Grey, lifeless, no identity | `/impeccable colorize <slug>` |
| Fonts feel default or inconsistent | `/impeccable typeset <slug>` |
| Spacing is off, things feel cramped | `/impeccable layout <slug>` |
| Static, jumpy, no motion | `/impeccable animate <slug>` |
| Functional but cold | `/impeccable delight <slug>` |
| Too much on the page | `/impeccable distill <slug>` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

**For each chosen axis (sequential, not parallel):**
1. Invoke the impeccable Skill tool with `<axis> <slug>` args (not the slash-command shorthand).
2. After it completes, take `chunk1-1440-after-<axis>.png` at 1440×900.
3. Write one line: whether the change addressed the problem.
4. If the axis did NOT resolve the targeted problem, do NOT run further axes on the same problem — emit `STUCK: 7 — <axis> did not resolve <problem>` and let the user guide.

**Hard cap:** maximum 4 axes per page. If more would be needed, the brief is the wrong shape — emit `STUCK: 7 — page needs more than 4 axes; brief shape needs review` and stop.

After all axes complete, take post-polish screenshots at all 3 viewports: `<slug>-post-axes-{375,768,1440}.png`.

**Evidence to surface:**
- All baseline + per-axis + post-polish screenshot file paths printed to chat
- Literal line: `AXES_APPLIED: <axis-1>, <axis-2>, ...` followed by one-line rationale for each
- Append `step-7: COMPLETE — axes applied: <list>` and cat progress file
```

**New evidence anchor in quick-reference:** `AXES_APPLIED:` (between `ITERATE_DECISION:` and the existing horizontal-scroll entry).

**Deliverable:** `scripts/patch-recipes-step7-multi-axis.mjs` — replaces the existing Step 7 block in each recipe with the multi-axis variant.

---

### Change 5 — Visual polish loop (new Step 7b)

**Problem:** After axes run, there are usually leftover micro-issues — alignment, spacing inconsistencies, label wraps — that don't need a full axis but do need cleanup. Today recipes have no dedicated loop for this.

**Solution:** A bounded Step 7b that audits visually, fixes, re-audits, max 2 iterations.

**Content:**

```markdown
## Step 7b — Visual polish loop (bounded refinement, max 2 iterations)

**Action:** Now that axes are applied, look for visual discrepancies, design inconsistencies, frontend issues, layout gaps, styling conflicts. The Design Route Directives at the top of this recipe are your north star.

**Audit at all 3 viewports** (use `playwright` MCP):
- 375×812 — primary mobile
- 768×1024 — tablet
- 1440×900 — desktop

**List specific issues found** in chat as `POLISH_ISSUES_ITER_<N>:` followed by bullet points (e.g. "card padding inconsistent between Today panel and Attention panel at 1440px", "primary button label wraps at 375px", "status pill icon misaligned with text").

**Apply fixes within existing scope:**
- No new files outside the recipe's "Files to edit" list.
- No new components — use existing primitives.
- No new DESIGN.md tokens.
- Polish layout, spacing, alignment, consistency — not the feature set.

**Re-audit, list remaining issues, fix again.** Loop maximum 2 iterations. If after 2 iterations there are still issues, that's information for Phase 7 — append them to the deferral file with **Defer to: Phase 7** and proceed.

**Evidence to surface:**
- `POLISH_ISSUES_ITER_1:` list + fixes applied
- `POLISH_ISSUES_ITER_2:` list + fixes applied OR `POLISH_ISSUES_ITER_2: none — clean`
- Final 3-viewport screenshots: `<slug>-polish-final-{375,768,1440}.png`
- Append `step-7b: COMPLETE — polish loop done` and cat progress file
```

**New evidence anchor:** `POLISH_ISSUES_ITER_2: none — clean` (or the agent's list if not clean).

**Deliverable:** Same script as Change 4 inserts Step 7b right after the rewritten Step 7. Renumbers existing Steps 8–13 to 8–13 (no renumbering needed since 7b is sub-numbered, not 8).

---

### Change 6 — MCP role split (Step 11c rewrite + new recipe-header section)

**Problem:** Recipes say "use playwright NOT chrome-devtools" — which was the wrong fix to a redirect issue we hit once. Workflow-guide canon at L6255-6257 uses both: playwright for screenshots/interactions, chrome-devtools for console/network. Recipes should mirror canon.

**Solution:**
- Add an "MCP usage" section in each recipe header (after the existing skill availability check section).
- Update Step 11c to use `chrome-devtools__list_console_messages` and `chrome-devtools__list_network_requests` (currently uses playwright for these).

**Content (new section, bulk script):**

```markdown
## MCP usage

| MCP | Role | Used in |
|---|---|---|
| `playwright` | Screenshots, form fills, click-through, viewport resize, navigation | Steps 7, 7b, 8, 11b, 12c |
| `chrome-devtools` | Console messages, network requests, performance trace, runtime metrics | Step 11c, optional Step 12c console replay |

Both MCPs must be connected per `/mcp` in your session (preflight check in LAUNCH-SHEET Section 0b). They don't conflict — each does what it's best at.

**Credentials:** every sign-in step references `/redesign/test-credentials.md`. The recipe inlines the specific account for clarity (the account that holds the RBAC permissions for this page), but the canonical source is always test-credentials.md.
```

**Step 11c update (verbatim, bulk script):**

```markdown
### 11c — Console + Network (via chrome-devtools MCP)

- Use `chrome-devtools__list_console_messages` to print the last 20 console messages — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md` (warnings OK).
- Use `chrome-devtools__list_network_requests` during the sign-in flow + page interactions — verify same endpoints as `/redesign/RECON.md` baseline (POST to `<signInAction>` server action, then GET `/admin/<slug>`).
```

**Deliverable:** `scripts/patch-recipes-mcp-split.mjs` — adds the "MCP usage" header section and updates Step 11c language.

---

### Change 7 — Subagent audit + critique (Step 12 rewrite)

**Problem:** Self-scoring inflation is a known failure mode. Login self-scored 20/20 audit + 37/40 critique — almost certainly inflated. The agent that just did the work cannot objectively critique it.

**Solution:** The main /goal agent dispatches subagents (via the Agent tool, subagent_type=general-purpose) for the audit and critique. Subagents re-prime from disk, run the impeccable Skill, return verbatim output. Main agent appends to PER-PAGE-SCORES.md (visible to /goal evaluator) and emits the anchors.

**Why subagents over alternative approaches:**
- Subagents have no "I just did this work" bias.
- They re-read from disk, so they audit the actual state, not a cached summary.
- They inherit the main agent's model (Opus 4.7) — same quality bar.
- Their internal turns don't pollute the main agent's transcript or burn parent turn count.

**Caveats baked into the recipe:**
- Subagent internal turns are invisible to the parent /goal Haiku evaluator — only the returned summary lands in main transcript.
- Therefore the main agent **must paste the subagent's full verbatim audit/critique text** into chat. Don't paraphrase.
- Subagents do NOT write to PER-PAGE-SCORES.md. They return text; main agent writes.

**Content (replacing existing Step 12, bulk script):**

```markdown
## Step 12 — Audit + Critique (via subagents) + Smoke Test

This step dispatches subagents for audit and critique. The reason: self-scoring inflation is a known failure mode. Subagents start with no "I just did this work" bias and re-prime from disk fresh. Scores you bring back are objective.

**Subagent model:** subagents inherit your model + thinking level. The user must already be on Opus 4.7 + medium thinking in `/config` (preflight in LAUNCH-SHEET Section 0b).

### 12a — Audit (subagent)

**Action:** Use the Agent tool with `subagent_type=general-purpose`. Subagent prompt (substitute `<slug>`):

```
You are auditing the redesign of admin page <slug> for Phase 6 of the Rahma Therapy admin redesign. The page has just been crafted, polished, adapted, and hardened by another agent. Your job is an objective code + design audit — you have NO bias from doing the work.

Re-prime (read these in order, in full):
1. /redesign/briefs/<slug>-brief.md
2. PRODUCT.md
3. DESIGN.md (full)
4. The post-polish screenshots at /redesign/screenshots/<slug>-redesign/<slug>-polish-final-{375,768,1440}.png
5. The current source code: src/app/admin/<slug>/** and any other files in the recipe's "Files to edit" list

Severity rubric (impeccable v5 L884-890):
- P0 — Blocks release
- P1 — Fix this sprint
- P2 — Next cycle
- P3 — Polish

Task: invoke the impeccable Skill with `audit <slug>`. Score 5 dimensions and surface all P0/P1/P2/P3 findings, each with file:line refs.

Return format — the full audit text, formatted to be appended to PER-PAGE-SCORES.md under heading `## <slug> — audit`, with these required subsections:
- 5 dimension scores
- P0/P1/P2/P3 findings (each on its own line with file:line)
- Backend status: <N-A / FAKE / HANDLED — match IMPLEMENTATION-PLAN row>
- **P1 (tag for Phase 7 gauntlet):** subsection — each P1 finding with location + file:line; if zero, write `none`
- **BUSINESS-COMPLETENESS impact:** subsection — name any Track A items this page newly contributes to

Do NOT write to PER-PAGE-SCORES.md. The main agent will append. Just return the full audit text verbatim.
```

After the subagent returns:
1. Read the returned audit text.
2. Append it verbatim to `/redesign/PER-PAGE-SCORES.md` under heading `## <slug> — audit`.
3. Print the appended section to chat (so the /goal Haiku evaluator sees it — without this, the audit is invisible).
4. If any P0 finding exists: emit `P0_FOUND:` followed by the list and STOP. Do not proceed to 12b. The user decides fix-now vs defer.

### 12b — Critique (subagent)

Same shape as 12a but for `/impeccable critique <slug>`. Subagent prompt invokes `critique` instead. Returns:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

After the subagent returns:
1. Append verbatim to PER-PAGE-SCORES.md under heading `## <slug> — critique`.
2. Print to chat.
3. If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder <slug>` or `/impeccable distill <slug>` (whichever fits the verdict's reasoning), then re-dispatch the critique subagent. Loop max 2 times.

### 12c — Functional smoke test (main agent, no subagent)

Run through the brief's Feature Preservation Manifest manually via playwright. Use credentials from `/redesign/test-credentials.md` (the inline-listed account for this page's RBAC). [Existing per-page smoke checklist preserved.]

**Evidence to surface:**
- Agent-tool invocations for audit + critique visible in transcript (the Skill calls appear as tool events)
- Both PER-PAGE-SCORES.md sections appended and printed to chat verbatim
- Functional smoke checklist with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit + critique (via subagents) + smoke clean` and cat progress file
```

**Deliverable:** `scripts/patch-recipes-step12-subagents.mjs` — replaces existing Step 12 block in each recipe.

---

### Change 8 — Step 13 canon-mapping note + tightened handoff checklist

**Problem:** Recipe Step 13 = workflow-guide Step 8 (handoff/commit). Mapping is currently implicit. Also: today's Step 13 handoff checklist could be tighter on what "complete" means.

**Solution:** Add a one-paragraph canon-mapping note at the top of Step 13. Tighten the existing checklist.

**Content (header note, bulk script):**

```markdown
## Step 13 — Handoff (canon Step 8 — NO COMMIT, wait for user approval)

> **Canon mapping:** this recipe's internal Step 13 corresponds to workflow-guide canon Step 8 (final handoff / commit decision per `phase6-admin-workflow-guide.html`). The recipe expands canon's 8 steps to 14 internal steps for autonomous-agent traceability. Full mapping: canon 1→recipe 1 (re-prime), canon 2→recipe 3 (framing), canon 3→recipe 4 (craft), canon 4→recipe 5 (ralph polish), canon 5→recipes 7/7b/8/9/10 (iterate/adapt/harden/clarify), canon 6→recipe 11 (verify), canon 7→recipe 12 (audit/critique/smoke), canon 8→recipe 13 (this handoff). The recipe is canonical to itself; the workflow guide is canon for the whole admin redesign.

**Action — final preflight checklist before HANDOFF_READY:**
- [ ] Every literal string in this recipe's `/goal evaluator quick-reference` section appeared in this transcript, each preceded by the tool output that proves it.
- [ ] `git diff --stat` reviewed in the worktree; printed to chat.
- [ ] Changed files match the recipe's "Files to edit" scope. Any file changed outside the list → emit `SCOPE_VIOLATION: <file>` and STOP. Otherwise: `SCOPE_CLEAN: only scoped files changed`.
- [ ] `git diff` (full) printed to chat in collapsible form; nothing surprising.
- [ ] Screenshots present at expected paths (per Steps 7, 7b, 8, 11b, 12c).
- [ ] PER-PAGE-SCORES.md sections appended (`## <slug> — audit` + `## <slug> — critique`) and printed to chat verbatim.
- [ ] Deferral file written at `/redesign/per-page-deferrals/<slug>-deferrals.md` (even if empty — write `(no deferrals — Phase 6 closed cleanly for <slug>)`).
- [ ] No commit; no `git add`. The main agent in the user's primary session commits after user approval.

**Handoff message (emit to chat):**
- Dev server URL: `http://localhost:<port>/admin/<slug>`
- All screenshot paths grouped by step
- Audit + critique key scores
- Any deviations from brief, or `DEVIATIONS: none`
- Deferrals file path
- Final literal line: `HANDOFF_READY — awaiting user approval`

**STOP. Do NOT stage. Do NOT commit. Wait for the user.**
```

**Deliverable:** `scripts/patch-recipes-step13-tighten.mjs` — replaces the existing Step 13 block.

---

## Main agent (user's primary session) protocol

A new file documents the main agent's role: quality control + merge broker.

### File: `redesign/POST-AGENT-AUDIT-PROTOCOL.md`

**Contents (summary — full file written separately):**

1. **What the main agent receives** when the user says "agent X done": the worktree path, the spawned agent's final `HANDOFF_READY` message, the path to that agent's progress file, the path to the deferrals file.

2. **Quality-control checklist** (verified before approving):
   - All quick-reference anchors present in the agent's transcript (cross-check against the recipe's quick-reference list).
   - `SCOPE_CLEAN` was emitted (no scope violations).
   - `git diff` in the worktree only touches files in the recipe's "Files to edit" list.
   - PER-PAGE-SCORES.md has both `## <slug> — audit` and `## <slug> — critique` appended.
   - Audit + critique subagent outputs are present in the agent's transcript verbatim (not paraphrased).
   - Functional smoke test passed.
   - Deferrals file exists at `/redesign/per-page-deferrals/<slug>-deferrals.md`.
   - Screenshots present at expected paths.
   - No new untracked files in the worktree outside scope.
   - No edits to files in the recipe's "Files to NEVER touch" list.

3. **Merge protocol** when approving:
   - In the worktree: stage scoped files by name (never `git add .`), commit with `redesign: <slug>` message.
   - In the main tree: `git merge --ff-only agent/<slug>-redesign`.
   - Kill leftover dev-server processes for the worktree (Windows: Get-CimInstance + Stop-Process).
   - Remove the worktree dir, `git worktree prune`, `git branch -d agent/<slug>-redesign`.

4. **Conflict resolution playbook:**
   - **Shared dashboard files** (dashboard-cards.tsx, notification-bell.tsx, attention-group-client.tsx, dashboard-header.tsx, dashboard-filters-client.tsx): if a second dashboard variant changed the same file as the first, prefer the carry-forward fixes already merged (border-l-4 removal, bg-black removal, avatar hex tokenisation); only accept the second variant's net-new edits.
   - **Emails ↔ email-templates tab shell**: emails session lays the stub; email-templates session swaps it in. If both modified `src/app/admin/emails/page.tsx`, the email-templates session's swap-in is authoritative for the Templates tab body; emails session's tab shell + Delivery + Reminders bodies are authoritative for those tabs.
   - **00-shared-components conflicts**: shared primitives changed since the worktree spawned mean rebase, not merge. Main agent rebases the agent branch onto current redesign/start-state and re-tests the worktree before approving.
   - **Recipe-level conflicts** (e.g. a per-page recipe edit landed mid-batch): re-spawn the worktree from current redesign/start-state with the updated recipe; let the agent re-run the affected steps only.

5. **Failed-agent recovery:**
   - `STUCK: <step> — <reason>`: read the reason. Common causes: brief contradicts codebase (resolve with explicit direction, re-dispatch with the fix in the /goal command), missing migration (verify migration committed, re-dispatch), test credential not found (verify test-credentials.md is in the worktree). Re-dispatch into the SAME worktree — don't tear it down.
   - `TURN_CAP_REACHED`: read progress file. If close to done (10–13 of 14 steps complete), raise the cap with `Stop after 80 turns` and re-dispatch. If far from done, root-cause first — usually a brief or recipe mismatch.
   - `P0_FOUND`: subagent flagged a P0 audit finding. Either fix-now (extend the worktree session, re-dispatch with the fix scope) or defer (note in deferrals, accept the page with P0 outstanding — visible in Phase 7 gauntlet).

6. **End-of-wave reconciliation:**
   - After each wave (per LAUNCH-SHEET Section 3), the main agent does a cross-page consistency check on shared infrastructure (especially dashboards, emails, settings).
   - Visual diff at 1440px across sibling pages (e.g. the three dashboards) — confirm they look like siblings, not three different products.
   - If divergence, note in `/redesign/WAVE-RECONCILIATION.md` and decide whether a follow-up pass is needed before starting the next wave.

7. **Cleanup at end-of-batch** (all 24 remaining pages merged): tag the resulting state, prepare for Phase 7 dispatch.

**Deliverable:** `redesign/POST-AGENT-AUDIT-PROTOCOL.md` (written in the implementation phase below).

---

## Helper scripts to create

| Script | Purpose | When run |
|---|---|---|
| `scripts/patch-recipes-port-assignment.mjs` | Change 1 — port assignment | Once, up front |
| `scripts/patch-recipes-decision-directives.mjs` | Changes 2 + 3 — directives sections | Once, up front |
| `scripts/patch-recipes-step7-multi-axis.mjs` | Changes 4 + 5 — Step 7 + Step 7b | Once, up front |
| `scripts/patch-recipes-mcp-split.mjs` | Change 6 — MCP roles | Once, up front |
| `scripts/patch-recipes-step12-subagents.mjs` | Change 7 — subagent audit/critique | Once, up front |
| `scripts/patch-recipes-step13-tighten.mjs` | Change 8 — handoff tightening | Once, up front |
| `scripts/spawn-worktree.mjs` | Lazy worktree creation by main agent | On demand, per page, when the user says "start agent X" |

The 6 patch scripts run once during this plan's execution. The spawn script runs many times — once per agent launch.

---

## Execution sequence

Each step is independently shippable. Each script is idempotent (re-run is safe). After each step, I'll show the diff + ask for green light before the next.

| Step | What | Touches | Reversible? |
|---|---|---|---|
| 1 | Port assignment script + LAUNCH-SHEET port table | 26 recipes + LAUNCH-SHEET | Yes (single revert) |
| 2 | Decision-making directives + Design Route Directives (combined script) | 26 recipes | Yes |
| 3 | Step 7 multi-axis + Step 7b polish loop (combined script) | 26 recipes | Yes |
| 4 | MCP role split (header section + Step 11c) | 26 recipes | Yes |
| 5 | Step 12 subagent rewrite | 26 recipes | Yes |
| 6 | Step 13 canon-mapping + handoff tightening | 26 recipes | Yes |
| 7 | `POST-AGENT-AUDIT-PROTOCOL.md` written | 1 new file | Yes |
| 8 | `spawn-worktree.mjs` written | 1 new script | Yes |
| 9 | Create `per-page-deferrals/` dir with `.gitkeep` + a README | 2 new files | Yes |
| 10 | Verification: spot-check 3 recipes for canon-faithful structure + grep for remaining drift | Read-only | n/a |

---

## After execution — handoff to the new main agent

Once all 10 steps complete, the user spawns a new "main agent" session (or this one continues in that role). Two artifacts make that handoff work:

1. **A context-prime document** (probably `redesign/MAIN-AGENT-CONTEXT.md`) — what the main agent needs to know before the first page run starts. Includes: project summary, current state (pages merged, pages remaining), the POST-AGENT-AUDIT-PROTOCOL link, the conflict-resolution playbook, the spawn-worktree.mjs usage, the deferrals approach, the Phase 6→7 bridge.

2. **A /goal-style prompt template** for the main agent's role (it's NOT running /goal itself — it's the orchestrator of /goal sessions in other windows). The prompt makes the main agent's responsibilities explicit: quality control + merge brokerage.

We write these two artifacts after the 10 execution steps land — they reference the post-execution state.

---

## Things flagged for awareness (no immediate action required)

1. **Worktree staleness** — if pages merge mid-wave, sibling worktrees fall behind redesign/start-state. The `spawn-worktree.mjs` script will spawn from current HEAD each time, so per-wave spawning avoids most of this. For long-running parallel batches, the main agent may need to rebase mid-batch.
2. **Subagent context overhead** — each audit/critique subagent re-reads PRODUCT.md, DESIGN.md, the brief, screenshots. That's substantial token spend. Acceptable for the inflation-prevention payoff.
3. **Cross-wave brief evolution** — if a brief gets corrected mid-batch (e.g. Wave 2 reveals a brief error in a Wave 3 page), the affected Wave 3 recipe needs a manual update before that page launches. Recipe versioning would help; for now the main agent tracks this manually.
4. **Phase 6 → Phase 7 bridge** — the per-page deferral files are the bridge. Phase 7's `/impeccable audit admin` agent reads them all and resolves globally. If a recipe asks a question that's not really deferrable (e.g. brief contradiction), the agent STUCKs rather than defers — the main agent resolves and re-dispatches.
5. **Brief immutability under autonomy** — if a spawned agent thinks the brief is wrong, current protocol is STUCK. Open question for later: do we want a softer "agent proposes brief revision in deferrals file" channel? Not in scope for this plan; revisit if it comes up.

---

## Open decisions resolved (from the prior brainstorm)

| Question | Decision |
|---|---|
| Recipe step numbering | **Option A** — keep 0–13 internal, document canon Step-8 mapping in Step 13 header |
| Workflow guide HTML edits | **Forbidden** — workflow guide stays immutable, recipes follow it |
| Worktree creation timing | **Lazy** — main agent spawns per-page on demand via spawn-worktree.mjs |
| Phase 6 → Phase 7 connection | **Deferrals file per page** — Phase 7 reads all 26 globally |
| Multi-axis polish cap | **4 axes max**, **2 polish iterations max** |
| Subagent thinking level | User pre-configures Opus 4.7 medium thinking in `/config` — subagents inherit, no per-subagent override needed |

---

End of plan. Ready to execute step 1 (port assignment) on green light.
