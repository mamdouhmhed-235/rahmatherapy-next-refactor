# /goal recipe — page: roles (27 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/roles-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `roles` |
| Page row in IMPLEMENTATION-PLAN.md | row 27 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/roles-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (roles section) |
| Source files to edit | `src/app/admin/roles/page.tsx` (and any new client wrapper for the "Create role" `AdminSheet` introduced during craft — keep new files under `src/app/admin/roles/`) |
| Worktree | this checkout — branch `agent/roles-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3022` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `N-A` — roles has no BLOCKS-REDESIGN BUILD plan. `createRole` already exists and is untouchable (RECON §5). No FAKE markers required on this page. |
| RBAC scope | Owner only (`manage_role_templates` is owner-exclusive). Test creds must be the owner account, not the admin seed. |
| Progress scratchpad | `/redesign/per-page-progress/roles-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `src/app/admin/roles/actions.ts` — `updateRoleMetadata`, `togglePermissionForRole`, `createRole` server actions (RECON §5 explicit DO-NOT-TOUCH)
   - `src/lib/auth/rbac.ts` — `canManageRoleTemplates`, `getRoleDisplayName` helpers preserved
   - `src/app/admin/roles/[roleId]/**` — the role-detail page lives at its own session; do not touch sibling subroute files
   - `src/middleware.ts`
   - `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layer (RECON §5)
   - `src/components/ui/card.tsx` and other shared primitives — out of scope (fixes live in `00-shared-components` session)
   - All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.)
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve form `name` attributes:** the Create-role `AdminSheet` keeps `display_label`, `name`, `description`, `sort_order`, `active` (RECON §6.4). No rename of any input.
6. **Preserve the server action contract:** the Create-role form stays wired to `createRole`. No `fetch` / no `XHR` replacement. The 5-role seed (Owner / Admin / Coordinator / Therapist / Inactive) cannot be deleted from this page (delete lives on the detail surface). Inactive role grouping is `<details>`-based; do not introduce drag-to-reorder.

### Additional universal restrictions (added 2026-05-16 after `tsc@2.0.4` npx-fetch incident)

These apply to every page on top of the page-specific rules above. The 2026-05-16 incident: a /goal agent ran `npx tsc --noEmit` as a discretionary off-recipe verification step; this project doesn't expose a top-level `node_modules/.bin/tsc` shim (pnpm isolated mode), so `npx` fell back to downloading `tsc@2.0.4` from the npm registry — a benign warning name-squat package, but a registry call we did not authorize. The rules below prevent recurrence.

- **NEVER fetch from any package registry.** Forbidden invocations: `npx <anything>`, `npm install`, `npm i`, `npm ci`, `pnpm install`, `pnpm add`, `pnpm dlx`, `yarn`, `yarn add`. The worktree's `node_modules` is pre-installed by the spawn script (a real local copy of main tree's `node_modules`, zero network). To run a project binary, choose:
  - `pnpm exec <bin>` — resolves via pnpm's lockfile, no network
  - `node node_modules/<pkg>/bin/<bin>.js` (or wherever the package's entry is) — direct node-runtime invocation, no shell shim required
  Avoid `npx <bin>` and `node_modules/.bin/<bin>` — neither is guaranteed to resolve locally in this project's pnpm isolated layout, and `npx` will silently fall back to a registry fetch when it can't find a local shim.
- **NEVER run off-recipe verification commands.** The recipe's verification surface is exhaustive and lives at Step 11 + Step 12: token-drift grep (11a), Playwright at 3 viewports + flow (11b), chrome-devtools console+network (11c), audit + critique via subagents (12a + 12b), functional smoke test (12c). Do NOT run discretionary `tsc --noEmit`, `vitest`, `next build`, `eslint`, `next lint`, or similar — they fall outside Phase 6 and will surface pre-existing baseline issues already excluded by `/redesign/BASELINE-ISSUES.md` (referenced in Step 1). Pre-existing TypeScript / test errors are not Phase 6's concern; they're tracked separately and addressed in Phase 7.

## Decision-making directives — when impeccable craft (or any tool) asks something not in the brief

The /goal session is autonomous — there's no user mid-run to consult. When impeccable craft's `shape` phase asks discovery questions (Purpose / User / Content / Feeling / Constraints), or any step surfaces a question or conflict, follow this order:

**Answer source priority (never invent):**
1. The brief at `/redesign/briefs/roles-brief.md` — quote the relevant section verbatim.
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
- Follows the **Design Route Directives** below.

**Deferral protocol — when a question is NOT a Phase 6 blocker:**

Some questions impeccable surfaces are open suggestions, polish opportunities, or post-launch concerns that belong to Phase 7 (`/impeccable audit admin`) or Phase 8 (`/impeccable extract admin`). Do NOT answer them — defer:

1. Append to `/redesign/per-page-deferrals/roles-deferrals.md` in this format:

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

## Design Route Directives — design north star for this page

These govern every visual + structural decision in steps 4–11. Read once; apply everywhere.

1. **Beautiful, mobile-first.** 375px is the primary canvas — make it look intentional, not "the desktop scaled down". Enhance to 768 → 1440 from there.
2. **Production-ready, business-workflow ready.** This is an operational CRM/backend. Every screen should look and feel like a finished professional product, not a wireframe or default-styled component drop.
3. **Responsive, modern, reactive, interactive.** Use CSS transitions on hover/focus/tab states (DESIGN.md motion tokens — `duration-fast`, `ease-gentle`); respect `prefers-reduced-motion`. Feedback on every interactive element. Never static where motion would carry meaning.
4. **Simple front door that opens into the full feature set.** Progressive disclosure. The first surface a staff member sees is calm and obvious; complexity unfolds when invited (panels, `<details>`, `AdminSheet`, modals). Never strip features — hide them behind a tap or click.
5. **Professional CRM/backend feel — never awkward, weird, or mediocre.** No generic SaaS defaults. No identical-card grids. No decorative-blob-on-empty-state. Every visual element earns its place per PRODUCT.md anti-references.
6. **Designed for lists that grow.** Where data lists exist, plan for 50+ rows: pagination/load-more, visible row density at scale, A–Z index strips where alphabetical, "show more" disclosures, virtualisation cues.
7. **Polish without straying.** All improvements stay within the recipe's "Files to edit" scope, use existing DESIGN.md tokens (no new tokens without explicit user approval), and respect the brief's "Feature Preservation Manifest."

## STUCK clause

If you are genuinely blocked on any step (skill unavailable, brief contradicts codebase, server won't start, etc.) — **stop trying** and emit a literal line:

```
STUCK: <step number> — <specific, actionable reason>
```

The `/goal` evaluator will see this and end the loop cleanly. The user will then investigate and re-dispatch with the fix.

## Hard cap

If you reach **40 turns** without the goal being met, emit:

```
TURN_CAP_REACHED — <summary of what's complete vs missing>
```

…and stop.

## Oversize file handling

When `Read` returns "File content (N tokens) exceeds maximum allowed tokens (25000)", DO NOT retry the full read. Use `offset` + `limit`, or use `Grep`.

Known oversize files relevant to this recipe:
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `roles` for page-specific entries
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; lines 1005–1043 for the roles row

## MCP usage

| MCP | Role | Used in |
|---|---|---|
| `playwright` | Screenshots, form fills, click-through, viewport resize, navigation | Steps 7, 7b, 8, 11b, 12c |
| `chrome-devtools` | Console messages, network requests, performance trace, runtime metrics | Step 11c, optional Step 12c console replay |

Both MCPs must be connected per `/mcp` in your session (preflight check in LAUNCH-SHEET Section 0b). They don't conflict — each does what it's best at. The earlier "playwright NOT chrome-devtools" guidance from older recipe drafts is retired.

**Credentials:** every sign-in step references `/redesign/test-credentials.md`. The recipe inlines the specific account for clarity (the account that holds the RBAC permissions for this page), but the canonical source is always `test-credentials.md`.

---

# Steps

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: roles
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/roles-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for roles)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/roles-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

**Evidence to surface:**
- All 7 one-sentence summaries printed to chat
- The literal line: `PRODUCT.md register: product`
- A verbatim quote of brief `## 6. Key States` sentence 2, prefixed with `BRIEF_S6_QUOTE: ` and inside a blockquote
- Feature Preservation Manifest items listed in chat as a bullet list
- Append `step-1: COMPLETE — re-prime confirmed` and cat the progress file

---

## Step 2 — Turn 2 ack + Ralph Zone 1 BROKEN guard (READ-ONLY)

Self-acknowledge `primed — go` (no external user to wait for; you proceed in `/goal` mode).

The Ralph Zone 1 batch loop was run once near the start of Phase 6, before this page. **Do NOT re-run the batch loop.** Run only the read-only BROKEN discrepancy guard:

> Quick check: have you read `/redesign/BUSINESS-COMPLETENESS.md`? Note any Track A / BLOCKS-REDESIGN Zone 1 items still tagged BROKEN that this page should handle (typically `none` — login already flipped 2A-6 + 2A-9 to PARTIAL). Read-only; do not edit.

**Evidence to surface:**
- Literal line `BROKEN_GUARD_RESULT:` followed by either the bullet list of items or `none`
- Append `step-2: COMPLETE — BROKEN guard run` and cat progress file

---

## Step 3 — Step 1 framing prompt (verbatim)

> FIRST — update the "Currently on" line in `/redesign/IMPLEMENTATION-PLAN.md` to point at THIS page's row so the plan stays in sync with what's being worked on. After the page is approved + committed in Step 7 (here Step 11), change `[ ]` to `[x]` and fill in the commit hash on the same row. **Do this in your worktree's copy only.**
>
> Read first (load these into your context BEFORE running craft so the brief content is available when craft's internal shape phase asks discovery questions):
> - DESIGN.md
> - PRODUCT.md
> - /redesign/IMAGES-NEEDED.md
> - /redesign/briefs/roles-brief.md  ← THIS IS THE PREPARED BRIEF
>
> Tell me before writing any code:
> - Files you will edit
> - Files you will NOT touch (from the brief's untouchable list)
> - Features you are preserving
> - Any conflict between brief and codebase
>
> (You are running under `/goal`, so "wait for my go-ahead" → instead print the file list to chat with a literal `SCOPE_PROPOSAL:` prefix, then proceed.)
>
> WRITE THE PER-PAGE SCOPE TO DISK before craft runs:
> Write to `/redesign/per-page-scope/roles-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/roles-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1440.
>
> IMAGE HANDLING: `roles-empty.svg` (shield-and-people) is listed in IMAGES-NEEDED for the render-safe empty state. If it isn't on disk yet, mark the slot with `data-redesign-needs-photo` and degrade gracefully to the EmptyState's text-only fallback. The letter token (first letter of `display_label` on Hover Moss) uses no SVG.
>
> BACKEND FAKE MARKER: roles has no FAKE-tagged backend features. Skip.

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list
- `/redesign/per-page-scope/roles-scope.md` written; print its contents to chat
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- Append `step-3: COMPLETE — scope written, plan updated` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page roles`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page roles`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/roles-brief.md. Compare the current implementation to the brief's requirements (every section of the brief, including Recipe Context and Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3022 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

**Pre-flight (do this BEFORE the cd):** verify the worktree directory exists. If `Test-Path` (PowerShell) or `[ -d ... ]` (bash) returns false on `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-roles-redesign`, emit `STUCK: 6 — worktree directory missing — re-run the worktree setup from LAUNCH-SHEET Section 1a` and STOP. Do not try to recreate the worktree from inside the agent.

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-roles-redesign"
pnpm next dev -p 3022
```

Use `run_in_background: true`. Poll `http://localhost:3022/admin/roles` until it returns HTTP 200 (or 308). Max wait: 120 seconds (cold compile of admin routes in Next.js 15 can exceed 60s — be patient on a fresh worktree).

**Evidence to surface:**
- The HTTP status code from the readiness poll printed to chat
- Literal line `DEV_SERVER_READY at http://localhost:3022`
- Append `step-6: COMPLETE — dev server on 3022` and cat progress file

---

## Step 7 — Step 2 iterate (screenshots + multi-axis polish, max 4 axes)

**Action:** Use the `playwright` MCP tool. Sign in first with the owner test account (roles is owner-only per brief §11; `test.admin@rahmatherapy.example.test` will hit `AdminAccessDenied`). Resolve owner credentials from `/redesign/test-credentials.md`.

Take screenshots and save to `/redesign/screenshots/roles-redesign/`:
- `chunk1-1440-default.png` at 1440×900
- `chunk1-768-default.png` at 768×1024
- `chunk1-375-default.png` at 375×812
- `chunk1-1440-inactive-expanded.png` at 1440×900 with the "Inactive roles (N)" `<details>` expanded
- `chunk1-1440-create-sheet.png` at 1440×900 with the "Create role" `AdminSheet` open

Visually self-audit against the brief, PRODUCT.md, DESIGN.md, and the Design Route Directives at the top of this recipe.

**Identify 2 to 4 axes** where the page has *visible* problems (not plausible improvements). Skip axes that contradict each other:
- `bolder` + `quieter` contradict
- `distill` + `delight` often contradict (distill removes; delight adds)

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder roles` |
| Too loud, too many colours | `/impeccable quieter roles` |
| Grey, lifeless, no identity | `/impeccable colorize roles` |
| Fonts feel default or inconsistent | `/impeccable typeset roles` |
| Spacing is off, things feel cramped | `/impeccable layout roles` |
| Static, jumpy, no motion | `/impeccable animate roles` |
| Functional but cold | `/impeccable delight roles` |
| Too much on the page | `/impeccable distill roles` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

**For each chosen axis (sequential, not parallel):**
1. Invoke the impeccable Skill tool with `<axis> roles` args. Use the Skill tool (not the slash-command shorthand) so the invocation appears as a transcript event the Haiku evaluator can see.
2. After it completes, take `chunk1-1440-after-<axis>.png` at 1440×900 and save to `/redesign/screenshots/roles-redesign/`.
3. Write one line stating whether the change addressed the targeted problem.
4. If the axis did NOT resolve the targeted problem, do NOT run further axes on the same problem — emit `STUCK: 7 — <axis> did not resolve <problem>` and let the user guide.

**Hard cap:** maximum 4 axes per page. If more would be needed, the brief is the wrong shape — emit `STUCK: 7 — page needs more than 4 axes; brief shape needs review` and stop.

After all axes complete, take post-polish screenshots at all 3 viewports: `roles-post-axes-{375,768,1440}.png` to `/redesign/screenshots/roles-redesign/`.

**Evidence to surface:**
- All baseline + per-axis + post-polish screenshot file paths printed to chat (`ls redesign/screenshots/roles-redesign/`)
- Literal line: `AXES_APPLIED: <axis-1>, <axis-2>, …` followed by one-line rationale for each axis
- Append `step-7: COMPLETE — axes applied: <list>` and cat progress file

---

## Step 7b — Visual polish loop (bounded refinement, max 2 iterations)

**Action:** Now that axes are applied, look for visual discrepancies, design inconsistencies, frontend issues, layout gaps, and styling conflicts. The Design Route Directives at the top of this recipe are your north star.

**Audit at all 3 viewports** (use the `playwright` MCP):
- 375×812 — primary mobile
- 768×1024 — tablet
- 1440×900 — desktop

**List specific issues found** in chat as `POLISH_ISSUES_ITER_<N>:` followed by bullet points. Be specific — e.g. "card padding inconsistent between Today panel and Attention panel at 1440px", "primary button label wraps at 375px because copy too long", "status pill icon misaligned with text at all viewports".

**Apply fixes within existing scope only:**
- No new files outside the recipe's "Files to edit" list.
- No new components — use existing primitives.
- No new DESIGN.md tokens (existing ones only).
- Polish layout, spacing, alignment, consistency — not the feature set.

**Re-audit, list remaining issues, fix again.** Loop maximum 2 iterations. If iteration 1 finds zero issues (the page already looks clean post-axes), emit `POLISH_ISSUES_ITER_1: none` AND `POLISH_ISSUES_ITER_2: none — clean (skipped, iteration 1 already clean)` and proceed directly to Step 8. If after 2 iterations there are still issues, append them to `/redesign/per-page-deferrals/roles-deferrals.md` with **Defer to: Phase 7** and proceed.

**Evidence to surface:**
- `POLISH_ISSUES_ITER_1: <issues list>` followed by `POLISH_FIXES_ITER_1: <fixes applied>` (or `POLISH_ISSUES_ITER_1: none` if the first audit found nothing)
- `POLISH_ISSUES_ITER_2: none — clean` (or the remaining-issues list, deferred to Phase 7 if any)
- Final 3-viewport screenshots: `roles-polish-final-{375,768,1440}.png` saved to `/redesign/screenshots/roles-redesign/`
- Append `step-7b: COMPLETE — polish loop done` and cat progress file

---

## Step 8 — `/impeccable adapt roles for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt roles for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/roles-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/roles-adapt-after-mobile.png`
3. Confirm no horizontal scroll at either breakpoint (Playwright: check `document.documentElement.scrollWidth <= window.innerWidth`)
4. Confirm rows + the nested staff-count Ghost link are tappable without zoom on mobile (min 44px touch targets — check `getBoundingClientRect().height >= 44`)
5. Confirm "Create role" Primary becomes full-width below the page summary on mobile per brief §5
6. Confirm the row right-rail collapses: counts move below the description on a separate line ("12 permissions · 3 staff") with `ChevronRight` pinned right

**Evidence to surface:**
- Two `roles-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target height for the "Create role" Primary on mobile (`TOUCH_TARGET_CREATE_MOBILE: <px>`) and for the row link (`TOUCH_TARGET_ROW_MOBILE: <px>`)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden roles`

**Action:** Invoke Skill with `/impeccable harden roles`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-roles.md`. Implement what harden recommends (empty / loading / error / permission-denied / overflow states) per the brief's `## 6. Key States` section. For each state listed in the brief that harden didn't surface, add it anyway.

Verification edge cases (roles-specific):
- A role `display_label` at 60 chars doesn't break the row layout on mobile
- The "Inactive roles (8)" disclosure expansion doesn't reflow active rows
- Create-role `AdminSheet` with a `name` validation error keeps the form data intact (no reset)
- Render-safe `EmptyState` triggers if the 5 seeded roles are somehow missing (defensive only)
- Row's nested staff-count link `event.stopPropagation()` prevents the row-level navigation when clicked

**Evidence to surface:**
- `/redesign/HARDEN-RECS-roles.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-roles.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify roles`

**Action:** Invoke Skill with `/impeccable clarify roles`.

Verify copy matches the brief's `## Copy` and `## 8. Content Requirements` sections exactly (or has been tightened for layout — that's allowed). Specifically:
- No `Submit` buttons remain → `Create role`, `Cancel`, `Back to dashboard`
- Page summary copy verbatim: `{n} active roles, {m} inactive. {x} staff assigned across all roles.` (count-aware)
- Inactive disclosure summary: `Inactive roles ({n})`
- DB-role line prefix: `DB role: {name}` (mono)
- Counts: `{n} permission` / `{n} permissions` (count-aware), `{n} staff` (no plural switch)
- Create-role helper: `Used in code and audit logs. Lowercase letters and underscores only.`
- Success toast verbatim: `Role "{display_label}" created. Add permissions next.`
- Failure toast verbatim: `Couldn't create role. Try again.`
- Denied screen reads "Roles access limited" with no raw `manage_role_templates` identifier
- Voice matches `PRODUCT.md` Brand Personality (calm, plain, direct, kind)

**Evidence to surface:**
- List of copy surfaces changed (with before/after) — OR `CLARIFY_RESULT: copy already matches brief`
- Append `step-10: COMPLETE — clarify run, copy verified` and cat progress file

---

## Step 11 — Verify (Step 6 from workflow guide)

**Action:** Three sub-checks in order.

### 11a — Token-drift lint

For files changed in this redesign, search for these patterns using the **Grep tool** (do NOT execute them as literal shell pipelines — chained `grep | grep -v` commands behave inconsistently across Windows shell environments, and `TOKEN_DRIFT: 0` from a parsing failure is indistinguishable from a clean lint):
```text
# Raw hex (should be 0 outside comments)
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/roles/page.tsx

# Raw oklch() literals (should be 0)
grep -nE 'oklch\(' src/app/admin/roles/page.tsx

# Raw px values outside @media queries (canon: should be 0 outside @media rules)
grep -nE '[0-9]+px' src/app/admin/roles/page.tsx | grep -v '@media'

# font-family literals (should be 0)
grep -nE "font-family:\s*['\"]" src/app/admin/roles/page.tsx

# Raw spacing literals (canon: should match the spacing scale in DESIGN.md)
grep -nE '(margin|padding):[[:space:]]*[0-9]' src/app/admin/roles/page.tsx

# Legacy rahma escapes (Phase-6 soft fix per brief §4)
grep -nE 'var\(--rahma-' src/app/admin/roles/page.tsx

# Carry-forward raw token escapes (Tonal Lift Rule / decorative tile retirement)
grep -nE 'bg-white|var\(--shadow-soft-token\)|var\(--rahma-green\)|text-white' src/app/admin/roles/page.tsx
```

For each match, confirm the value comes from a DESIGN.md token. If a hardcoded value isn't backed by a token, FIX IT — either add the token to DESIGN.md (only with user approval, otherwise STUCK) or replace with the existing token. The decorative green tile must retire per brief §3; rows must be flat at rest (Tonal Lift Rule: no `shadow-soft` on resting rows; hover-only).

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1440)

- Sign in first at `/admin/login` with owner credentials (roles is owner-only; admin seed will hit `AdminAccessDenied`).
- Navigate to `/admin/roles` at each viewport
- Save final-state screenshots: `roles-final-{375,768,1440}.png` to `/redesign/screenshots/roles-redesign/`
- Exercise the primary action: click "Create role" Primary → `AdminSheet` slides in from right → fill `display_label = "Test Role"`, `name = "test_role_<timestamp>"`, leave description blank, accept default sort_order, leave active checked → click `Create role` (Primary) → verify Sonner `Role "Test Role" created. Add permissions next.` and redirect to `/admin/roles/<new_id>`
- Navigate back to `/admin/roles` and verify the new row appears in the active section
- Click the "Inactive roles (N)" `<details>` to expand it; verify the inactive section opens
- Click the staff-count Ghost link on a role with `staff_count > 0` → verify navigation to `/admin/staff?roleId=<id>` (NOT to the role detail) — confirms `event.stopPropagation()` works
- Take a verification screenshot of the create-role success: `roles-create-success.png`
- Sign out cleanly: use the playwright MCP to send a POST to `/admin/signout` from the browser context (the route is POST-only — a regular browser navigation would issue GET and receive 405, leaving the session intact). After the POST, navigate to `/admin/login` and verify the sign-in page renders. This leaves a clean session for downstream pages.

### 11c — Console + Network (via the chrome-devtools MCP)

_Note for `NETWORK_BASELINE_MATCH`: Next.js 15 server actions don't appear as literal POSTs to the action endpoint — they go through the RSC stream as a POST to the page URL with a `next-action` header. Count EITHER the literal action POST OR an RSC POST with `next-action` header as a match._

- Use the chrome-devtools MCP to read the last 20 console messages and print them to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md` (warnings OK)
- Use the chrome-devtools MCP to inspect network requests during the create-role flow — verify POST to `createRole` server action

**Evidence to surface:**
- All grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix)
- Screenshot files in `/redesign/screenshots/roles-redesign/`: `roles-final-{375,768,1440}.png` + `roles-create-success.png`
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — Audit + Critique (via subagents) + Smoke Test

This step dispatches subagents for the audit and critique commands. The reason: self-scoring inflation is a known failure mode (login self-scored 20/20 audit + 37/40 critique — almost certainly inflated by recency bias). Subagents start with no "I just did this work" bias and re-prime from disk fresh; the scores you bring back are objective.

**Subagent model + thinking:** subagents inherit your model + thinking level. The user must already be on Opus 4.7 + medium thinking in `/config` (preflight in LAUNCH-SHEET Section 0b). The Agent tool does NOT expose a per-subagent thinking override.

**Why both — and how it lands in the transcript:** subagent internal turns are invisible to the parent /goal Haiku evaluator. Only the subagent's *returned summary* reaches the main transcript. Therefore: subagents do NOT write to PER-PAGE-SCORES.md (their writes are invisible to the parent loop); they return text; the main agent performs the append + prints the appended section to chat. That print is what the Haiku evaluator sees.

### 12a — Audit (subagent)

**Action:** Use the Agent tool with `subagent_type=general-purpose`. Subagent prompt (the slug `roles` is already substituted below — pass this prompt verbatim):

```
You are auditing the redesign of admin page roles for Phase 6 of the Rahma Therapy admin redesign. The page has just been crafted, polished, adapted, and hardened by another agent. Your job is an objective code + design audit — you have NO bias from doing the work.

Re-prime (read these in order, in full):
1. /redesign/briefs/roles-brief.md
2. PRODUCT.md
3. DESIGN.md (full, including ## Admin-Specific Patterns)
4. /redesign/IMPLEMENTATION-PLAN.md — find the roles row to determine Backend status (N-A / FAKE / HANDLED) and any BUILD plan dependencies
5. /redesign/BUSINESS-COMPLETENESS.md — to identify any Track A items this page contributes to
6. The post-polish screenshots at /redesign/screenshots/roles-redesign/roles-polish-final-{375,768,1440}.png
7. The current source code: src/app/admin/roles/** and any other files in the recipe's "Files to edit" list

Severity rubric (impeccable v5 L884-890 — quote it verbatim, do not paraphrase):
- P0 — Blocks release — fix before shipping anything
- P1 — Fix this sprint — significant impact on users
- P2 — Next cycle — noticeable but not blocking
- P3 — Polish — minor, fix when time allows

Task: invoke the impeccable Skill with `audit roles`. Score 5 dimensions and surface all P0/P1/P2/P3 findings with file:line references.

Return format — the full audit text, formatted to be appendable to PER-PAGE-SCORES.md under heading `## roles — audit`, with these required subsections:
- 5 dimension scores
- P0/P1/P2/P3 findings (each on its own line with file:line refs)
- Backend status (N-A / FAKE / HANDLED — if FAKE, name the blocking BUILD plan filename(s) verbatim from IMPLEMENTATION-PLAN.md)
- **P1 (tag for Phase 7 gauntlet):** subsection — list each P1 finding with location + file:line. If zero, write `none`. Phase 7 `/impeccable audit admin` re-scans this section.
- **BUSINESS-COMPLETENESS impact:** subsection — name any Track A items this page newly contributes to (e.g. `2A-6` if form-level `role="alert" aria-live="polite"` was implemented). If none, write `none`.

Do NOT write to PER-PAGE-SCORES.md. The main agent will perform the append. Return the full audit text verbatim.
```

After the subagent returns:
1. Read the returned audit text from the Agent tool result.
2. Append it verbatim to `/redesign/PER-PAGE-SCORES.md` under heading `## roles — audit`.
3. **Print the appended section to chat verbatim.** This is critical — the subagent's internal turns are invisible to the parent /goal evaluator. Without surfacing the appended section, the audit is invisible to the parent loop.
4. If any P0 finding exists: emit `P0_FOUND:` followed by the list and STOP. Do not proceed to 12b. The user decides fix-now vs defer.

### 12b — Critique (subagent)

**Action:** Use the Agent tool with `subagent_type=general-purpose`. Subagent prompt (`roles` already substituted):

```
You are critiquing the redesign of admin page roles for Phase 6. The page has been crafted + polished + adapted + hardened + audited by another agent. Your job is an objective UX critique — you have NO bias from doing the work.

Re-prime (read in full):
1. /redesign/briefs/roles-brief.md
2. PRODUCT.md
3. DESIGN.md (full)
4. The post-polish screenshots at /redesign/screenshots/roles-redesign/roles-polish-final-{375,768,1440}.png
5. The current source code: src/app/admin/roles/**

Task: invoke the impeccable Skill with `critique roles`. Return:
- 10 Nielsen heuristic scores (Visibility of system status; Match between system and real world; User control and freedom; Consistency and standards; Error prevention; Recognition rather than recall; Flexibility and efficiency; Aesthetic and minimalist design; Help users recognize, diagnose, and recover from errors; Help and documentation)
- AI-slop verdict (PASS / REGRESSED / FAIL) with one-sentence reasoning
- Brief commentary on UX-quality, mapping concrete observations to PRODUCT.md anti-references (no generic SaaS feel, no identical-card grids, no decorative blobs, etc.)

Return format — the full critique text, formatted to be appendable to PER-PAGE-SCORES.md under heading `## roles — critique`.

Do NOT write to PER-PAGE-SCORES.md. Return the full critique text verbatim.
```

After the subagent returns:
1. Append verbatim to `/redesign/PER-PAGE-SCORES.md` under heading `## roles — critique`.
2. **Print to chat verbatim** — same reasoning as 12a.
3. If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder roles` or `/impeccable distill roles` (whichever fits the verdict's reasoning), then re-dispatch the critique subagent with the same prompt. Loop max 2 times. If after 2 loops the verdict is still REGRESSED/FAIL, append the verdict + reasoning to `/redesign/per-page-deferrals/roles-deferrals.md` with **Defer to: Phase 7** and proceed to 12c.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code:

- [ ] Role-row name renders as `<h2>` (BASELINE-CRITIQUE Sam #1 fix — verify in DOM)
- [ ] Active roles render in `sort_order`; inactive roles inside the `<details>` "Inactive roles ({n})" collapsed by default
- [ ] "Create role" Primary opens `AdminSheet` from the right on desktop, from the bottom on mobile
- [ ] Create-role form posts to `createRole` server action with fields `display_label`, `name`, `description`, `sort_order`, `active` (verify in network panel)
- [ ] Server validation error (e.g. duplicate `name`) → inline `role="alert"` region above the form's first invalid field; sheet stays open with data intact
- [ ] Row-level `<Link>` to `/admin/roles/<id>` works; nested staff-count link to `/admin/staff?roleId=<id>` does NOT trigger the outer row navigation
- [ ] System chip (Restricted family) appears beside the active/inactive chip on system roles
- [ ] Tonal Lift Rule: rows have NO shadow at rest; hover applies `card-hover` shadow
- [ ] `AdminAccessDenied` does NOT render the raw `manage_role_templates` permission identifier
- [ ] Keyboard `n` opens the create-role sheet (additional only — never the sole path)

**Evidence to surface:**
- Both PER-PAGE-SCORES.md sections printed to chat (audit + critique)
- Functional smoke test checklist printed with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit/critique/smoke clean` and cat progress file

---

## Step 13 — Handoff (canon Step 8 — NO COMMIT, wait for user approval)

> **Canon mapping:** this recipe's internal Step 13 corresponds to workflow-guide canon Step 8 (final handoff / commit decision per `phase6-admin-workflow-guide.html`). The recipe expands canon's 8 steps to 14 internal steps for autonomous-agent traceability. Full mapping: canon 1 → recipe 1 (re-prime), canon 2 → recipe 3 (framing), canon 3 → recipe 4 (craft), canon 4 → recipe 5 (ralph polish), canon 5 → recipes 7 / 7b / 8 / 9 / 10 (iterate / polish loop / adapt / harden / clarify), canon 6 → recipe 11 (verify), canon 7 → recipe 12 (audit / critique / smoke), canon 8 → recipe 13 (this handoff). The recipe is canonical to itself; the workflow guide is canon for the whole admin redesign.

**Action — final preflight checklist before emitting `HANDOFF_READY`:**
- [ ] Every literal string in this recipe's `/goal evaluator quick-reference` section has appeared in this transcript, each preceded by the tool output (or appended file section) that proves it. No retrospective summary-only emissions.
- [ ] `git diff --stat` reviewed in the worktree; printed to chat.
- [ ] **Source files** changed match the recipe's "Files to edit" scope. **Runtime support files** written per recipe instructions are EXPECTED and **NOT** scope violations even though they appear in `git diff` / `git status`. Expected runtime writes:
    - `redesign/per-page-progress/<slug>-progress.md` — Step 1+ append per step
    - `redesign/per-page-scope/<slug>-scope.md` — Step 3 writes
    - `redesign/per-page-deferrals/<slug>-deferrals.md` — Decision-making + Step 13 (sentinel if no deferrals)
    - `redesign/screenshots/<slug>-redesign/*.png` — Steps 7, 7b, 8, 11b, 12c
    - `redesign/baseline/<slug>-adapt-after-{mobile,tablet}.png` — Step 8
    - `redesign/HARDEN-RECS-<slug>.md` — Step 9
    - `redesign/PER-PAGE-SCORES.md` — Step 12 audit + critique appends
  Any **source file** (under `src/` or other code paths) changed outside the recipe's scope list → emit `SCOPE_VIOLATION: <file>` and STOP. Otherwise emit `SCOPE_CLEAN: only scoped source files + expected runtime support files changed`.
- [ ] `git diff` (full) printed to chat in collapsible form; nothing surprising.
- [ ] Screenshots present at expected paths (per Steps 7, 7b, 8, 11b, 12c — list them grouped by step in the handoff message).
- [ ] PER-PAGE-SCORES.md sections appended (`## roles — audit` + `## roles — critique`) and printed to chat verbatim from the subagent results (Step 12a + 12b).
- [ ] Deferral file written at `/redesign/per-page-deferrals/roles-deferrals.md` — even if empty, write `(no deferrals — Phase 6 closed cleanly for roles)`. The main agent and the Phase 7 gauntlet both read this; missing file = ambiguous closure.
- [ ] No commit. No `git add`. The main agent in the user's primary session stages + commits scoped files after the user approves.

**Handoff message — emit to chat in this shape:**
- Dev server URL: `http://localhost:3022/admin/roles`
- All screenshot paths grouped by step (Step 7 baseline + per-axis + post-polish, Step 7b polish-final, Step 8 adapt-after, Step 11b final, Step 12c smoke)
- Audit headline scores (5 dimensions) + critique headline (10 Nielsen heuristics + AI-slop verdict)
- Any deviations from brief, or `DEVIATIONS: none`
- Deferrals file path
- Final literal line: `HANDOFF_READY — awaiting user approval`

**STOP. Do NOT stage. Do NOT commit. Wait for the user.**

**Evidence to surface:**
- `git diff --stat` output
- `SCOPE_CLEAN: only scoped files changed` (or `SCOPE_VIOLATION:`)
- Full handoff message
- The literal final line: `HANDOFF_READY — awaiting user approval`
- Append `step-13: COMPLETE — handoff emitted, awaiting approval` (final line in progress file) and cat progress file

---

# /goal evaluator quick-reference

The Haiku evaluator should see ALL of these literal strings in the transcript before declaring the goal met:

1. `PRODUCT.md register: product`
2. `BRIEF_S6_QUOTE: ` (with verbatim quoted text)
3. `BROKEN_GUARD_RESULT:`
4. `SCOPE_PROPOSAL:`
5. `CRAFT_COMPLETE`
6. `PAGE-POLISH-COMPLETE` (inside `<promise>` tags)
7. `DEV_SERVER_READY at http://localhost:3022`
8. `AXES_APPLIED:` (list of impeccable axes run with one-line rationale each)
9. `POLISH_ISSUES_ITER_2: none — clean` (or the remaining-issues list, deferred to Phase 7 if any)
10. `HORIZONTAL_SCROLL_TABLET: false` and `HORIZONTAL_SCROLL_MOBILE: false`
11. `TOKEN_DRIFT: 0` (or each drift explicitly addressed)
12. `CONSOLE_NEW_ERRORS: 0`
13. `## roles — audit` and `## roles — critique` headings appended (printed to chat from the file)
14. `SMOKE_TEST: all PASS`
15. `SCOPE_CLEAN: only scoped files changed`
16. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
