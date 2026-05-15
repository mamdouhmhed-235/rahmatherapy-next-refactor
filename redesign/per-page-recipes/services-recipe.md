# /goal recipe — page: services (28 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/services-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `services` |
| Page row in IMPLEMENTATION-PLAN.md | row 28 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/services-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (services section) |
| Source files to edit | `src/app/admin/services/page.tsx`, `src/app/admin/services/ServiceFormDialog.tsx`, `src/app/admin/services/DeleteServiceButton.tsx` (and any new client wrapper for the `AdminSheet` / `ConfirmActionModal` introduced during craft — keep new files under `src/app/admin/services/`) |
| Worktree | this checkout — branch `agent/services-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3023` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `N-A` — services has no BLOCKS-REDESIGN BUILD plan. `saveService` and `deleteService` already exist and are untouchable (RECON §5). No FAKE markers required on this page. |
| RBAC scope | Owner only (`manage_services` is owner-exclusive per RECON.md §2). Test creds must be the owner account, not the admin seed. |
| Progress scratchpad | `/redesign/per-page-progress/services-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `src/app/admin/services/actions.ts` — `saveService`, `deleteService` (and archive/restore variant) server actions; do not change action names, signatures, or field bindings (RECON §5)
   - `src/middleware.ts`
   - `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layer (RECON §5)
   - `src/components/ui/card.tsx` and other shared primitives — out of scope (fixes live in `00-shared-components` session)
   - All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.)
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve form `name` attributes:** ALL 12 `ServiceFormDialog` field `name` attributes must remain literal and verbatim — `name`, `slug`, `group_category`, `gender_restrictions`, `price`, `duration_mins`, `display_order`, `is_active`, `is_visible_on_frontend`, `short_description`, `full_description`, `suitable_for_notes` (RECON §2 + brief Feature Preservation Manifest).
6. **Preserve the server action contracts:** create + edit modes both call `saveService`; `DeleteServiceButton` calls `deleteService`. No `fetch` / no `XHR` replacement. The `usage_count > 0` delete guard stays: if `usage_count > 0`, block `deleteService` call and show Sonner toast `This service has booking history and can't be deleted. Deactivate it instead.` — do NOT show `ConfirmActionModal` in this path.

## Decision-making directives — when impeccable craft (or any tool) asks something not in the brief

The /goal session is autonomous — there's no user mid-run to consult. When impeccable craft's `shape` phase asks discovery questions (Purpose / User / Content / Feeling / Constraints), or any step surfaces a question or conflict, follow this order:

**Answer source priority (never invent):**
1. The brief at `/redesign/briefs/services-brief.md` — quote the relevant section verbatim.
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

1. Append to `/redesign/per-page-deferrals/services-deferrals.md` in this format:

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
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `services` for page-specific entries
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; lines 1043–1081 for the services row

## MCP usage

| MCP | Role | Used in |
|---|---|---|
| `playwright` | Screenshots, form fills, click-through, viewport resize, navigation | Steps 7, 7b, 8, 11b, 12c |
| `chrome-devtools` | Console messages, network requests, performance trace, runtime metrics | Step 11c, optional Step 12c console replay |

Both MCPs must be connected per `/mcp` in your session (preflight check in LAUNCH-SHEET Section 0b). They don't conflict — each does what it's best at. The earlier "playwright NOT chrome-devtools" guidance from older recipe drafts is retired.

**Credentials:** every sign-in step references `/redesign/test-credentials.md`. The recipe inlines the specific account for clarity (the account that holds the RBAC permissions for this page), but the canonical source is always `test-credentials.md`.

---

# Steps

## Step 0 — Skill availability check (FIRST, do not skip)

**Action:** Verify these Skill-tool invocations resolve in this session. **Use the Skill tool (not the slash-command shorthand) so each invocation appears as a `Skill(...)` event in the transcript the Haiku evaluator reads** — slash-command text alone is harder for the evaluator to distinguish from a mention. Invoke each with a no-op or dry argument string just to confirm it resolves:
- `/impeccable craft`
- `/impeccable adapt`
- `/impeccable harden`
- `/impeccable clarify`
- `/impeccable audit`
- `/impeccable critique`
- `/ralph-loop`

**If any are missing, STOP** and emit `STUCK: 0 — skill <name> unavailable`.

**Evidence to surface:**
- Literal line in chat: `SKILLS_OK: craft, adapt, harden, clarify, audit, critique, ralph-loop`
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/services-progress.md` and cat it.

---

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: services
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/services-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for services)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/services-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

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

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (services) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
> - /redesign/briefs/services-brief.md  ← THIS IS THE PREPARED BRIEF
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
> Write to `/redesign/per-page-scope/services-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/services-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1440.
>
> IMAGE HANDLING: brief lists no net-new SVG (letter token uses typography). The empty-catalog `EmptyState` may use an existing illustration; if no asset on disk, degrade to text-only.
>
> BACKEND FAKE MARKER: services has no FAKE-tagged backend features. Skip.

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list
- `/redesign/per-page-scope/services-scope.md` written; print its contents to chat
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- Append `step-3: COMPLETE — scope written, plan updated` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page services`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page services`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/services-brief.md. Compare the current implementation to the brief's requirements (every section of the brief, including Recipe Context and Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3023 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

**Pre-flight (do this BEFORE the cd):** verify the worktree directory exists. If `Test-Path` (PowerShell) or `[ -d ... ]` (bash) returns false on `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-services-redesign`, emit `STUCK: 6 — worktree directory missing — re-run the worktree setup from LAUNCH-SHEET Section 1a` and STOP. Do not try to recreate the worktree from inside the agent.

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-services-redesign"
pnpm next dev -p 3023
```

Use `run_in_background: true`. Poll `http://localhost:3023/admin/services` until it returns HTTP 200 (or 308). Max wait: 60 seconds.

**If node_modules junction is broken** (junction got removed or stale), fall back to:
```powershell
cmd /c mklink /J node_modules "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor\node_modules"
```

**Evidence to surface:**
- The HTTP status code from the readiness poll printed to chat
- Literal line `DEV_SERVER_READY at http://localhost:3023`
- Append `step-6: COMPLETE — dev server on 3023` and cat progress file

---

## Step 7 — Step 2 iterate (screenshots + multi-axis polish, max 4 axes)

**Action:** Use the `playwright` MCP tool. Sign in first with the owner test account (services is owner-only per brief Role Variants; `test.admin@rahmatherapy.example.test` will hit `AdminAccessDenied`). Resolve owner credentials from `/redesign/test-credentials.md`.

Take screenshots and save to `/redesign/screenshots/services-redesign/`:
- `chunk1-1440-default.png` at 1440×900 (grouped catalog with multiple categories)
- `chunk1-768-default.png` at 768×1024
- `chunk1-375-default.png` at 375×812
- `chunk1-1440-add-sheet.png` at 1440×900 with the "Add service" `AdminSheet` open
- `chunk1-1440-edit-sheet.png` at 1440×900 with the "Edit {service}" `AdminSheet` pre-filled
- `chunk1-1440-delete-modal.png` at 1440×900 with the `ConfirmActionModal` open on a deletable service

Visually self-audit against the brief, PRODUCT.md, DESIGN.md, and the Design Route Directives at the top of this recipe.

**Identify 2 to 4 axes** where the page has *visible* problems (not plausible improvements). Skip axes that contradict each other:
- `bolder` + `quieter` contradict
- `distill` + `delight` often contradict (distill removes; delight adds)

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder services` |
| Too loud, too many colours | `/impeccable quieter services` |
| Grey, lifeless, no identity | `/impeccable colorize services` |
| Fonts feel default or inconsistent | `/impeccable typeset services` |
| Spacing is off, things feel cramped | `/impeccable layout services` |
| Static, jumpy, no motion | `/impeccable animate services` |
| Functional but cold | `/impeccable delight services` |
| Too much on the page | `/impeccable distill services` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

**For each chosen axis (sequential, not parallel):**
1. Invoke the impeccable Skill tool with `<axis> services` args. Use the Skill tool (not the slash-command shorthand) so the invocation appears as a transcript event the Haiku evaluator can see.
2. After it completes, take `chunk1-1440-after-<axis>.png` at 1440×900 and save to `/redesign/screenshots/services-redesign/`.
3. Write one line stating whether the change addressed the targeted problem.
4. If the axis did NOT resolve the targeted problem, do NOT run further axes on the same problem — emit `STUCK: 7 — <axis> did not resolve <problem>` and let the user guide.

**Hard cap:** maximum 4 axes per page. If more would be needed, the brief is the wrong shape — emit `STUCK: 7 — page needs more than 4 axes; brief shape needs review` and stop.

After all axes complete, take post-polish screenshots at all 3 viewports: `services-post-axes-{375,768,1440}.png` to `/redesign/screenshots/services-redesign/`.

**Evidence to surface:**
- All baseline + per-axis + post-polish screenshot file paths printed to chat (`ls redesign/screenshots/services-redesign/`)
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

**Re-audit, list remaining issues, fix again.** Loop maximum 2 iterations. If after 2 iterations there are still issues, append them to `/redesign/per-page-deferrals/services-deferrals.md` with **Defer to: Phase 7** and proceed.

**Evidence to surface:**
- `POLISH_ISSUES_ITER_1: <issues list>` followed by `POLISH_FIXES_ITER_1: <fixes applied>` (or `POLISH_ISSUES_ITER_1: none` if the first audit found nothing)
- `POLISH_ISSUES_ITER_2: none — clean` (or the remaining-issues list, deferred to Phase 7 if any)
- Final 3-viewport screenshots: `services-polish-final-{375,768,1440}.png` saved to `/redesign/screenshots/services-redesign/`
- Append `step-7b: COMPLETE — polish loop done` and cat progress file

---

## Step 8 — `/impeccable adapt services for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt services for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/services-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/services-adapt-after-mobile.png`
3. Confirm no horizontal scroll at either breakpoint (Playwright: check `document.documentElement.scrollWidth <= window.innerWidth`)
4. Confirm Edit + three-dot buttons are tappable without zoom on mobile (min 44px touch targets — check `getBoundingClientRect().height >= 44`)
5. Confirm right-rail chips wrap below the service name on narrow viewports per brief §5 Mobile
6. Confirm `AdminSheet` becomes a bottom sheet on mobile (full-width) with form fields stacking single-column

**Evidence to surface:**
- Two `services-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target height for "Edit" Ghost + three-dot trigger on mobile (`TOUCH_TARGET_EDIT_MOBILE: <px>`, `TOUCH_TARGET_MENU_MOBILE: <px>`)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden services`

**Action:** Invoke Skill with `/impeccable harden services`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-services.md`. Implement what harden recommends (empty / loading / error / permission-denied / overflow states) per the brief's `## 6. Key States` section. For each state listed in the brief that harden didn't surface, add it anyway.

Verification edge cases (services-specific):
- A service `name` at 80 chars doesn't break the row at 375px
- An `AdminSheet` open in edit mode with a 5-row `full_description` textarea pre-filled doesn't push the footer off the viewport
- The delete `ConfirmActionModal` body wraps clean at 375px with a long service name
- Three-dot menu Delete option is `disabled` with native `title` tooltip when `usage_count > 0` (not just visually greyed)
- Empty-catalog `EmptyState` renders with "Add your first treatment." + "Add service" Primary, no dashed border
- Slug-change warning banner above submit when editing a service with `usage_count > 0` (brief §10 + Copy section)

**Evidence to surface:**
- `/redesign/HARDEN-RECS-services.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-services.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify services`

**Action:** Invoke Skill with `/impeccable clarify services`.

Verify copy matches the brief's `## Copy` and `## 8. Content Requirements` sections exactly (or has been tightened for layout — that's allowed). Specifically:
- No `Submit` buttons remain → `Save service` (create), `Save changes` (edit), `Cancel`, `Add service`, `Edit`, `Delete service`, `Keep it`, `Back to dashboard`
- Page summary copy verbatim: `{N} active, {M} inactive across {X} categories`
- Row chip copy verbatim: `{N} min` (duration) / `Any` / `Female only` / `Male only` (gender) / `#N` (order)
- Status badge copy verbatim: `Inactive` (Cancelled family) / `Hidden` (Restricted family) / `In use` (Completed family)
- Three-dot menu items: `Deactivate` / `Activate` | `Hide from website` / `Show on website` | `Delete`
- Toast copy verbatim: `Service added.` / `Service updated.` / `Service deactivated.` / `Service activated.` / `Hidden from the website.` / `Visible on the website.` / `Service deleted.`
- Delete-blocked toast verbatim: `This service has booking history and can't be deleted. Deactivate it instead.`
- Delete modal heading: `Delete "{service name}"?`; body matches brief verbatim
- Denied screen reads "Services access limited" with no raw `manage_services` identifier
- Voice matches `PRODUCT.md` Brand Personality (calm, plain, direct, kind)

**Evidence to surface:**
- List of copy surfaces changed (with before/after) — OR `CLARIFY_RESULT: copy already matches brief`
- Append `step-10: COMPLETE — clarify run, copy verified` and cat progress file

---

## Step 11 — Verify (Step 6 from workflow guide)

**Action:** Three sub-checks in order.

### 11a — Token-drift lint

For files changed in this redesign, grep:
```bash
# Raw hex (should be 0 outside comments)
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/services/page.tsx src/app/admin/services/ServiceFormDialog.tsx src/app/admin/services/DeleteServiceButton.tsx

# Raw oklch() literals (should be 0)
grep -nE 'oklch\(' src/app/admin/services/page.tsx src/app/admin/services/ServiceFormDialog.tsx src/app/admin/services/DeleteServiceButton.tsx

# Raw px values outside @media queries (canon: should be 0 outside @media rules)
grep -nE '[0-9]+px' src/app/admin/services/page.tsx src/app/admin/services/ServiceFormDialog.tsx src/app/admin/services/DeleteServiceButton.tsx | grep -v '@media'

# font-family literals (should be 0)
grep -nE "font-family:\s*['\"]" src/app/admin/services/page.tsx src/app/admin/services/ServiceFormDialog.tsx src/app/admin/services/DeleteServiceButton.tsx

# Raw spacing literals (canon: should match the spacing scale in DESIGN.md)
grep -nE '(margin|padding):[[:space:]]*[0-9]' src/app/admin/services/page.tsx src/app/admin/services/ServiceFormDialog.tsx src/app/admin/services/DeleteServiceButton.tsx

# Legacy rahma escapes (Phase-6 soft fix)
grep -nE 'var\(--rahma-' src/app/admin/services/page.tsx src/app/admin/services/ServiceFormDialog.tsx src/app/admin/services/DeleteServiceButton.tsx

# border-l-4 (must be 0 — brief verification step explicitly bans on rows / status indicators)
grep -nE 'border-l-4' src/app/admin/services/page.tsx src/app/admin/services/ServiceFormDialog.tsx src/app/admin/services/DeleteServiceButton.tsx
```

For each match, confirm the value comes from a DESIGN.md token. If a hardcoded value isn't backed by a token, FIX IT — either add the token to DESIGN.md (only with user approval, otherwise STUCK) or replace with the existing token. Status-family backgrounds must come from token families, never raw `bg-red-*` / `bg-green-*`.

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1440)

- Sign in first at `/admin/login` with owner credentials (services is owner-only; admin seed will hit `AdminAccessDenied`).
- Navigate to `/admin/services` at each viewport
- Save final-state screenshots: `services-final-{375,768,1440}.png` to `/redesign/screenshots/services-redesign/`
- Exercise the primary action: click "Add service" Primary → `AdminSheet` opens blank → fill `name = "Test Treatment <timestamp>"`, slug auto-populates, `group_category = "Test category"`, `gender_restrictions = "Any gender"`, `price = "60.00"`, `duration_mins = "60"`, accept defaults for the rest → click `Save service` → verify sheet closes, row appears in the "Test category" group section, Sonner `Service added.`
- Edit the newly-created service: click `Edit` Ghost → sheet opens pre-filled → change price to `75.00` → click `Save changes` → verify Sonner `Service updated.` and row reflects new price
- Open the three-dot menu on the test service → click `Deactivate` → verify row gains "Inactive" Cancelled-family badge; three-dot now shows `Activate`; Sonner `Service deactivated.`
- Open three-dot on the test service → click `Delete` → `ConfirmActionModal` opens → click `Delete service` (Destructive) → verify row removed, Sonner `Service deleted.`
- Take a verification screenshot of the delete flow: `services-delete-modal.png`
- Sign out via `/admin/signout` to leave a clean session for downstream pages

### 11c — Console + Network (via `chrome-devtools` MCP)

- Use `chrome-devtools__list_console_messages` to print the last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md` (warnings OK)
- Use `chrome-devtools__list_network_requests` during the create + edit + delete flow — verify POSTs to `saveService` (create + edit + deactivate) and `deleteService` (delete)

**Evidence to surface:**
- All grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix)
- Screenshot files in `/redesign/screenshots/services-redesign/`: `services-final-{375,768,1440}.png` + `services-delete-modal.png`
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — Audit + Critique (via subagents) + Smoke Test

This step dispatches subagents for the audit and critique commands. The reason: self-scoring inflation is a known failure mode (login self-scored 20/20 audit + 37/40 critique — almost certainly inflated by recency bias). Subagents start with no "I just did this work" bias and re-prime from disk fresh; the scores you bring back are objective.

**Subagent model + thinking:** subagents inherit your model + thinking level. The user must already be on Opus 4.7 + medium thinking in `/config` (preflight in LAUNCH-SHEET Section 0b). The Agent tool does NOT expose a per-subagent thinking override.

**Why both — and how it lands in the transcript:** subagent internal turns are invisible to the parent /goal Haiku evaluator. Only the subagent's *returned summary* reaches the main transcript. Therefore: subagents do NOT write to PER-PAGE-SCORES.md (their writes are invisible to the parent loop); they return text; the main agent performs the append + prints the appended section to chat. That print is what the Haiku evaluator sees.

### 12a — Audit (subagent)

**Action:** Use the Agent tool with `subagent_type=general-purpose`. Subagent prompt (the slug `services` is already substituted below — pass this prompt verbatim):

```
You are auditing the redesign of admin page services for Phase 6 of the Rahma Therapy admin redesign. The page has just been crafted, polished, adapted, and hardened by another agent. Your job is an objective code + design audit — you have NO bias from doing the work.

Re-prime (read these in order, in full):
1. /redesign/briefs/services-brief.md
2. PRODUCT.md
3. DESIGN.md (full, including ## Admin-Specific Patterns)
4. /redesign/IMPLEMENTATION-PLAN.md — find the services row to determine Backend status (N-A / FAKE / HANDLED) and any BUILD plan dependencies
5. /redesign/BUSINESS-COMPLETENESS.md — to identify any Track A items this page contributes to
6. The post-polish screenshots at /redesign/screenshots/services-redesign/services-polish-final-{375,768,1440}.png
7. The current source code: src/app/admin/services/** and any other files in the recipe's "Files to edit" list

Severity rubric (impeccable v5 L884-890 — quote it verbatim, do not paraphrase):
- P0 — Blocks release — fix before shipping anything
- P1 — Fix this sprint — significant impact on users
- P2 — Next cycle — noticeable but not blocking
- P3 — Polish — minor, fix when time allows

Task: invoke the impeccable Skill with `audit services`. Score 5 dimensions and surface all P0/P1/P2/P3 findings with file:line references.

Return format — the full audit text, formatted to be appendable to PER-PAGE-SCORES.md under heading `## services — audit`, with these required subsections:
- 5 dimension scores
- P0/P1/P2/P3 findings (each on its own line with file:line refs)
- Backend status (N-A / FAKE / HANDLED — if FAKE, name the blocking BUILD plan filename(s) verbatim from IMPLEMENTATION-PLAN.md)
- **P1 (tag for Phase 7 gauntlet):** subsection — list each P1 finding with location + file:line. If zero, write `none`. Phase 7 `/impeccable audit admin` re-scans this section.
- **BUSINESS-COMPLETENESS impact:** subsection — name any Track A items this page newly contributes to (e.g. `2A-6` if form-level `role="alert" aria-live="polite"` was implemented). If none, write `none`.

Do NOT write to PER-PAGE-SCORES.md. The main agent will perform the append. Return the full audit text verbatim.
```

After the subagent returns:
1. Read the returned audit text from the Agent tool result.
2. Append it verbatim to `/redesign/PER-PAGE-SCORES.md` under heading `## services — audit`.
3. **Print the appended section to chat verbatim.** This is critical — the subagent's internal turns are invisible to the parent /goal evaluator. Without surfacing the appended section, the audit is invisible to the parent loop.
4. If any P0 finding exists: emit `P0_FOUND:` followed by the list and STOP. Do not proceed to 12b. The user decides fix-now vs defer.

### 12b — Critique (subagent)

**Action:** Use the Agent tool with `subagent_type=general-purpose`. Subagent prompt (`services` already substituted):

```
You are critiquing the redesign of admin page services for Phase 6. The page has been crafted + polished + adapted + hardened + audited by another agent. Your job is an objective UX critique — you have NO bias from doing the work.

Re-prime (read in full):
1. /redesign/briefs/services-brief.md
2. PRODUCT.md
3. DESIGN.md (full)
4. The post-polish screenshots at /redesign/screenshots/services-redesign/services-polish-final-{375,768,1440}.png
5. The current source code: src/app/admin/services/**

Task: invoke the impeccable Skill with `critique services`. Return:
- 10 Nielsen heuristic scores (Visibility of system status; Match between system and real world; User control and freedom; Consistency and standards; Error prevention; Recognition rather than recall; Flexibility and efficiency; Aesthetic and minimalist design; Help users recognize, diagnose, and recover from errors; Help and documentation)
- AI-slop verdict (PASS / REGRESSED / FAIL) with one-sentence reasoning
- Brief commentary on UX-quality, mapping concrete observations to PRODUCT.md anti-references (no generic SaaS feel, no identical-card grids, no decorative blobs, etc.)

Return format — the full critique text, formatted to be appendable to PER-PAGE-SCORES.md under heading `## services — critique`.

Do NOT write to PER-PAGE-SCORES.md. Return the full critique text verbatim.
```

After the subagent returns:
1. Append verbatim to `/redesign/PER-PAGE-SCORES.md` under heading `## services — critique`.
2. **Print to chat verbatim** — same reasoning as 12a.
3. If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder services` or `/impeccable distill services` (whichever fits the verdict's reasoning), then re-dispatch the critique subagent with the same prompt. Loop max 2 times. If after 2 loops the verdict is still REGRESSED/FAIL, append the verdict + reasoning to `/redesign/per-page-deferrals/services-deferrals.md` with **Defer to: Phase 7** and proceed to 12c.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code:

- [ ] All 12 `ServiceFormDialog` field `name` attributes preserved verbatim in DOM: `name`, `slug`, `group_category`, `gender_restrictions`, `price`, `duration_mins`, `display_order`, `is_active`, `is_visible_on_frontend`, `short_description`, `full_description`, `suitable_for_notes`
- [ ] `<form action={saveService}>` preserved in both create and edit modes
- [ ] `DeleteServiceButton` calls `deleteService` action; binding preserved
- [ ] `usage_count > 0` delete guard: option disabled with native `title` "Has booking history — deactivate instead"; if somehow triggered, Sonner `This service has booking history and can't be deleted. Deactivate it instead.` fires (no `ConfirmActionModal`)
- [ ] Group section headings are H2 elements (no H1→H3 skip)
- [ ] All form fields have `<label for="…">` with matching `id`; required fields show `*` in Cancelled text colour
- [ ] `role="alert"` error regions present in DOM even when empty
- [ ] `AdminSheet` traps focus while open (WCAG 2.1 dialog pattern)
- [ ] No `border-l-4` on any row or status indicator
- [ ] All status badges have text label + icon + bg tint (Named Status Rule)
- [ ] `AdminAccessDenied` does NOT render the raw `manage_services` permission identifier

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
    - `redesign/per-page-progress/<slug>-progress.md` — Step 0+ append per step
    - `redesign/per-page-scope/<slug>-scope.md` — Step 3 writes
    - `redesign/per-page-deferrals/<slug>-deferrals.md` — Decision-making + Step 13 (sentinel if no deferrals)
    - `redesign/screenshots/<slug>-redesign/*.png` — Steps 7, 7b, 8, 11b, 12c
    - `redesign/baseline/<slug>-adapt-after-{mobile,tablet}.png` — Step 8
    - `redesign/HARDEN-RECS-<slug>.md` — Step 9
    - `redesign/PER-PAGE-SCORES.md` — Step 12 audit + critique appends
  Any **source file** (under `src/` or other code paths) changed outside the recipe's scope list → emit `SCOPE_VIOLATION: <file>` and STOP. Otherwise emit `SCOPE_CLEAN: only scoped source files + expected runtime support files changed`.
- [ ] `git diff` (full) printed to chat in collapsible form; nothing surprising.
- [ ] Screenshots present at expected paths (per Steps 7, 7b, 8, 11b, 12c — list them grouped by step in the handoff message).
- [ ] PER-PAGE-SCORES.md sections appended (`## services — audit` + `## services — critique`) and printed to chat verbatim from the subagent results (Step 12a + 12b).
- [ ] Deferral file written at `/redesign/per-page-deferrals/services-deferrals.md` — even if empty, write `(no deferrals — Phase 6 closed cleanly for services)`. The main agent and the Phase 7 gauntlet both read this; missing file = ambiguous closure.
- [ ] No commit. No `git add`. The main agent in the user's primary session stages + commits scoped files after the user approves.

**Handoff message — emit to chat in this shape:**
- Dev server URL: `http://localhost:3023/admin/services`
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

1. `SKILLS_OK: craft, adapt, harden, clarify, audit, critique, ralph-loop`
2. `PRODUCT.md register: product`
3. `BRIEF_S6_QUOTE: ` (with verbatim quoted text)
4. `BROKEN_GUARD_RESULT:`
5. `SCOPE_PROPOSAL:`
6. `CRAFT_COMPLETE`
7. `PAGE-POLISH-COMPLETE` (inside `<promise>` tags)
8. `DEV_SERVER_READY at http://localhost:3023`
9. `AXES_APPLIED:` (list of impeccable axes run with one-line rationale each)
10. `POLISH_ISSUES_ITER_2: none — clean` (or the remaining-issues list, deferred to Phase 7 if any)
11. `HORIZONTAL_SCROLL_TABLET: false` and `HORIZONTAL_SCROLL_MOBILE: false`
12. `TOKEN_DRIFT: 0` (or each drift explicitly addressed)
13. `CONSOLE_NEW_ERRORS: 0`
14. `## services — audit` and `## services — critique` headings appended (printed to chat from the file)
15. `SMOKE_TEST: all PASS`
16. `SCOPE_CLEAN: only scoped files changed`
17. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
