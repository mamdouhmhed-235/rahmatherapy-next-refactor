# /goal recipe — page: enquiries (23 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/enquiries-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `enquiries` |
| Page row in IMPLEMENTATION-PLAN.md | row 23 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/enquiries-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (enquiries section) |
| Source files to edit | `src/app/admin/enquiries/page.tsx`, `src/app/admin/enquiries/EnquiryForm.tsx`, `src/app/admin/enquiries/EnquiryStatusButton.tsx` |
| Worktree | this checkout — branch `agent/enquiries-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3015` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `FAKE` — depends on BLOCKS-REDESIGN `BUILD-enquiries-filter-query.md` (server-side filter query for the new `?source=`, `?assigned_staff=`, `?from=`, `?to=`, `?q=` params plus `?tab=` derived filtering). Until built, the new filter strip + tab strip degrade: `?tab=all` returns the full unfiltered list and additional GET params are no-ops server-side. The intake form (`createEnquiry`) and the per-row status actions (`updateEnquiryStatus`) remain wired verbatim. Mark FAKE comments at the filter-read call sites. |
| Progress scratchpad | `/redesign/per-page-progress/enquiries-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `src/app/admin/enquiries/actions.ts` — `createEnquiry`, `updateEnquiryStatus`; do not change action names, signatures, or field bindings
   - `src/lib/auth/**`, `src/lib/supabase/**` — standard untouchables (RECON §5)
   - `src/middleware.ts`
   - `supabase/migrations/**`
   - All build/config files
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve `EnquiryForm` field `name` attributes** verbatim (RECON §2): `full_name`, `source`, `phone`, `email`, `service_interest`, `assigned_staff_id`, `notes`.
6. **Preserve the server-action wire-ups:** `<form action={createEnquiry}>` on the intake form; `EnquiryStatusButton` calls `updateEnquiryStatus` with the documented bindings.
7. **`AdminAccessDenied` copy must NOT leak `manage_enquiries`** as a raw identifier (DESIGN.md § Don't, BASELINE-CRITIQUE Fatimah #3).
8. **`Convert` is navigation only, no server action** — Ghost link → `/admin/bookings/new?enquiryId={id}`. The `createManualBooking` flow sets `converted_booking_id` and `status: "booked"` server-side (confirmed in `bookings/actions.ts`); never replicate that mutation here.

## Decision-making directives — when impeccable craft (or any tool) asks something not in the brief

The /goal session is autonomous — there's no user mid-run to consult. When impeccable craft's `shape` phase asks discovery questions (Purpose / User / Content / Feeling / Constraints), or any step surfaces a question or conflict, follow this order:

**Answer source priority (never invent):**
1. The brief at `/redesign/briefs/enquiries-brief.md` — quote the relevant section verbatim.
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

1. Append to `/redesign/per-page-deferrals/enquiries-deferrals.md` in this format:

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

The `/goal` evaluator will see this and end the loop cleanly.

## Hard cap

If you reach **40 turns** without the goal being met, emit:

```
TURN_CAP_REACHED — <summary of what's complete vs missing>
```

…and stop.

## Oversize file handling

When `Read` returns "File content (N tokens) exceeds maximum allowed tokens (25000)", DO NOT retry the full read. Use `offset` + `limit`, or use `Grep`.

Known oversize files relevant to this recipe:
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `enquiries`
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; search for the enquiries row

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
> Page being redesigned in THIS session: enquiries
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/enquiries-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive — `EnquiryForm` field names, `createEnquiry`/`updateEnquiryStatus` actions, deep-link contracts)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for enquiries)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/enquiries-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

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
> - /redesign/briefs/enquiries-brief.md  ← THIS IS THE PREPARED BRIEF
>
> Tell me before writing any code:
> - Files you will edit
> - Files you will NOT touch (from the brief's untouchable list — particularly `enquiries/actions.ts`)
> - Features you are preserving (`EnquiryForm` field names + the two server actions + deep-link contracts)
> - Any conflict between brief and codebase
>
> (You are running under `/goal`, so "wait for my go-ahead" → instead print the file list to chat with a literal `SCOPE_PROPOSAL:` prefix, then proceed.)
>
> WRITE THE PER-PAGE SCOPE TO DISK before craft runs:
> Write to `/redesign/per-page-scope/enquiries-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/enquiries-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1440. The intake form collapses behind a disclosure toggle on mobile; the tab strip becomes momentum-scroll pills; the filter bar collapses to a "Filters" Ghost → `AdminSheet`.
>
> IMAGE HANDLING: append `enquiries-empty.svg` (~80–120px) variants per tab to IMAGES-NEEDED.md if not already there.
>
> BACKEND FAKE MARKER: `BUILD-enquiries-filter-query.md` is BLOCKS-REDESIGN and not yet handled. Mark the new filter-bar + tab-strip server-read code paths with `// FAKE: BUILD-enquiries-filter-query` comments. The form submits and the URL updates; server-side filtering is a no-op until the BUILD lands.

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list
- `/redesign/per-page-scope/enquiries-scope.md` written; print its contents to chat
- List of `data-redesign-backend="FAKE"` surfaces printed to chat as `BACKEND_FAKE_SURFACES:` bullets
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- Append `step-3: COMPLETE — scope written, plan updated` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page enquiries`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page enquiries`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/enquiries-brief.md. Compare the current implementation to the brief's requirements (every section of the brief, including Role variants, Recipe Context, and Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3015 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

**Pre-flight (do this BEFORE the cd):** verify the worktree directory exists. If `Test-Path` (PowerShell) or `[ -d ... ]` (bash) returns false on `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-enquiries-redesign`, emit `STUCK: 6 — worktree directory missing — re-run the worktree setup from LAUNCH-SHEET Section 1a` and STOP. Do not try to recreate the worktree from inside the agent.

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-enquiries-redesign"
pnpm next dev -p 3015
```

Use `run_in_background: true`. Poll `http://localhost:3015/admin/enquiries` until it returns HTTP 200 (or 308). Max wait: 120 seconds (cold compile of admin routes in Next.js 15 can exceed 60s — be patient on a fresh worktree).

**Evidence to surface:**
- The HTTP status code from the readiness poll printed to chat
- Literal line `DEV_SERVER_READY at http://localhost:3015`
- Append `step-6: COMPLETE — dev server on 3015` and cat progress file

---

## Step 7 — Step 2 iterate (screenshots + multi-axis polish, max 4 axes)

**Action:** Use the `playwright` MCP tool.

Sign in as `test.admin@rahmatherapy.example.test` / `AdminTest123!` at `/admin/login`. Take screenshots and save to `/redesign/screenshots/enquiries-redesign/`:
- `chunk1-1440-all.png` at 1440×900 navigating to `/admin/enquiries` (default `?tab=all`)
- `chunk1-1440-new.png` at 1440×900 navigating to `/admin/enquiries?tab=new` (Attention-family count badge if any new exist)
- `chunk1-1440-converted.png` at 1440×900 navigating to `/admin/enquiries?tab=converted` (`View booking →` Ghost on each row)
- `chunk1-1440-filtered.png` at 1440×900 navigating to `/admin/enquiries?source=whatsapp&assigned_staff=<seed-uuid>` (filter chips below bar)
- `chunk1-768-default.png` at 768×1024 (still two-column at 1024+ — adjust if breakpoint changes)
- `chunk1-375-collapsed.png` at 375×812 on `/admin/enquiries` (intake form collapsed behind `Record new enquiry` toggle; filter bar collapsed to Ghost)
- `chunk1-375-expanded.png` at 375×812 on `/admin/enquiries` with intake form expanded

> **Heads up on session-cookie bleed:** Therapist hitting this URL renders `AdminAccessDenied`. Verify the admin session before saving the default screenshot.

Visually self-audit against the brief, PRODUCT.md, DESIGN.md, and the Design Route Directives at the top of this recipe.

**Identify 2 to 4 axes** where the page has *visible* problems (not plausible improvements). Skip axes that contradict each other:
- `bolder` + `quieter` contradict
- `distill` + `delight` often contradict (distill removes; delight adds)

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder enquiries` |
| Too loud, too many colours | `/impeccable quieter enquiries` |
| Grey, lifeless, no identity | `/impeccable colorize enquiries` |
| Fonts feel default or inconsistent | `/impeccable typeset enquiries` |
| Spacing is off, things feel cramped | `/impeccable layout enquiries` |
| Static, jumpy, no motion | `/impeccable animate enquiries` |
| Functional but cold | `/impeccable delight enquiries` |
| Too much on the page | `/impeccable distill enquiries` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

**For each chosen axis (sequential, not parallel):**
1. Invoke the impeccable Skill tool with `<axis> enquiries` args. Use the Skill tool (not the slash-command shorthand) so the invocation appears as a transcript event the Haiku evaluator can see.
2. After it completes, take `chunk1-1440-after-<axis>.png` at 1440×900 and save to `/redesign/screenshots/enquiries-redesign/`.
3. Write one line stating whether the change addressed the targeted problem.
4. If the axis did NOT resolve the targeted problem, do NOT run further axes on the same problem — emit `STUCK: 7 — <axis> did not resolve <problem>` and let the user guide.

**Hard cap:** maximum 4 axes per page. If more would be needed, the brief is the wrong shape — emit `STUCK: 7 — page needs more than 4 axes; brief shape needs review` and stop.

After all axes complete, take post-polish screenshots at all 3 viewports: `enquiries-post-axes-{375,768,1440}.png` to `/redesign/screenshots/enquiries-redesign/`.

**Evidence to surface:**
- All baseline + per-axis + post-polish screenshot file paths printed to chat (`ls redesign/screenshots/enquiries-redesign/`)
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

**Re-audit, list remaining issues, fix again.** Loop maximum 2 iterations. If iteration 1 finds zero issues (the page already looks clean post-axes), emit `POLISH_ISSUES_ITER_1: none` AND `POLISH_ISSUES_ITER_2: none — clean (skipped, iteration 1 already clean)` and proceed directly to Step 8. If after 2 iterations there are still issues, append them to `/redesign/per-page-deferrals/enquiries-deferrals.md` with **Defer to: Phase 7** and proceed.

**Evidence to surface:**
- `POLISH_ISSUES_ITER_1: <issues list>` followed by `POLISH_FIXES_ITER_1: <fixes applied>` (or `POLISH_ISSUES_ITER_1: none` if the first audit found nothing)
- `POLISH_ISSUES_ITER_2: none — clean` (or the remaining-issues list, deferred to Phase 7 if any)
- Final 3-viewport screenshots: `enquiries-polish-final-{375,768,1440}.png` saved to `/redesign/screenshots/enquiries-redesign/`
- Append `step-7b: COMPLETE — polish loop done` and cat progress file

---

## Step 8 — `/impeccable adapt enquiries for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt enquiries for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/enquiries-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/enquiries-adapt-after-mobile.png`
3. Confirm no horizontal scroll at either breakpoint
4. Confirm intake form disclosure toggle behaves correctly on mobile (collapsed by default; expands on tap; ≥44px tap target)
5. Confirm tab pills momentum-scroll horizontally on mobile without overflow
6. Confirm filter sheet (mobile) traps focus, Apply submits + closes
7. Confirm row action buttons (`Mark contacted`, `Convert`) are visible at rest, not hover-revealed (DESIGN.md Table Actions rule)

**Evidence to surface:**
- Two `enquiries-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target height for `Mark contacted` Ghost on mobile (`TOUCH_TARGET_MARK_CONTACTED_MOBILE: <px>`)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden enquiries`

**Action:** Invoke Skill with `/impeccable harden enquiries`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-enquiries.md`. Implement what harden recommends per the brief's `## 6. Key States` table. Particular attention to:
- Per-tab empty states (All / New / Contacted / Converted / Closed) with documented copy + CTAs
- Filtered-to-empty: `No enquiries match. Try adjusting or clearing your filters.` + Ghost `Clear filters`
- Form submitting: `aria-busy="true"` on `Record enquiry` Primary with spinner; inputs remain enabled
- Form error: `role="alert" aria-live="polite" aria-atomic="true"` Cancelled region above submit
- Form success: form resets, new enquiry appears at top of list, Sonner toast `Enquiry recorded.`
- Mark contacted failure: Cancelled toast (persistent, Retry)
- Convert on stale (already converted) enquiry: `That enquiry was already converted. Open the booking from the row.`
- Close failure: `Couldn't close that one. Try again.`
- Loading: `AdminSkeleton` in list column

Verification edge cases (enquiries-specific):
- 60-char `full_name` doesn't break row at 375px
- 4-row `notes` textarea at content cap renders correctly
- Phone-and-email-both-empty validation fires before submit
- Instagram `at-sign` icon renders (Lucide substitute per §10 Q4); icon is 16px `aria-hidden="true"`
- Required-field `*` marker uses Cancelled text colour with `<span aria-hidden="true">*</span>`

**Evidence to surface:**
- `/redesign/HARDEN-RECS-enquiries.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-enquiries.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify enquiries`

**Action:** Invoke Skill with `/impeccable clarify enquiries`.

Verify copy matches the brief's `## 8. Content Requirements` and `## Copy` sections exactly. Specifically:
- Tab labels: `All` / `New` / `Contacted` / `Converted` / `Closed`
- Status badge copy: `New` (Attention) / `Contacted` (Pending) / `Converted` (Confirmed) / `Closed` (Cancelled)
- Row action copy: `Mark contacted` / `Convert` / `View booking →` / `Close enquiry`
- Form section title: `Record enquiry` (H2)
- Form submit: `Record enquiry` (Primary)
- Success toast: `Enquiry recorded.`
- Empty-state copy per tab matches brief verbatim
- Validation copy verbatim: name empty / source not picked / phone+email both empty / email malformed / phone too short / server failure
- Mobile form toggle trigger: `Record new enquiry`
- Denied copy: `You don't have access to the enquiries pipeline. Contact the owner if you need access.` — no `manage_enquiries` raw identifier
- Voice matches `PRODUCT.md` Brand Personality

**Evidence to surface:**
- List of copy surfaces changed (with before/after) — OR `CLARIFY_RESULT: copy already matches brief §8 + Copy block`
- Append `step-10: COMPLETE — clarify run, copy verified` and cat progress file

---

## Step 11 — Verify (Step 6 from workflow guide)

**Action:** Three sub-checks in order.

### 11a — Token-drift lint

Search for these patterns using the **Grep tool** (do NOT execute them as literal shell pipelines — chained `grep | grep -v` commands behave inconsistently across Windows shell environments, and `TOKEN_DRIFT: 0` from a parsing failure is indistinguishable from a clean lint):

```text
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/enquiries/page.tsx src/app/admin/enquiries/EnquiryForm.tsx src/app/admin/enquiries/EnquiryStatusButton.tsx
grep -nE 'oklch\(' src/app/admin/enquiries/*.tsx
grep -nE '[0-9]+px' src/app/admin/enquiries/*.tsx | grep -v '@media'
grep -nE "font-family:\s*['\"]" src/app/admin/enquiries/*.tsx

# Raw spacing literals (canon: should match the spacing scale in DESIGN.md)
grep -nE '(margin|padding):[[:space:]]*[0-9]' src/app/admin/enquiries/*.tsx
grep -nE 'text-(emerald|orange|red|amber|green)-[0-9]+' src/app/admin/enquiries/*.tsx
grep -nE 'border-l-4' src/app/admin/enquiries/*.tsx
grep -nE 'manage_enquiries' src/app/admin/enquiries/*.tsx
# `EnquiryStatusButton` raw variant classes — scope to className attribute values
# (the bare word "warning" / "muted" appears in JS error strings and aria-live
# contexts; we only want className occurrences). Match `variant="warning"` or
# `className="...warning..."` shapes.
grep -nE '(variant|className)[^>]*?(warning|muted)' src/app/admin/enquiries/EnquiryStatusButton.tsx
```

For each match, confirm the value comes from a DESIGN.md token. The `manage_enquiries` raw identifier must be 0. `EnquiryStatusButton` must not use raw `warning`/`muted` classes — replace with `AdminStatusBadge` + Ghost pattern.

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1440)

- Sign in at `/admin/login` with `test.admin@rahmatherapy.example.test` / `AdminTest123!`
- Navigate to `/admin/enquiries` at each viewport
- Save final-state screenshots: `enquiries-final-{375,768,1440}.png` to `/redesign/screenshots/enquiries-redesign/`
- Fill `EnquiryForm` with valid values (full_name + source + phone + email + service_interest) → click Record enquiry → verify Sonner success toast `Enquiry recorded.` + new row at top of list + form resets
- Click tab `New` → verify URL updates to `?tab=new` + active tab carries `aria-current="page"` + only status=new rows visible
- Click `Mark contacted` on a new row → verify `updateEnquiryStatus` fires + Sonner toast `Marked as contacted.` + row moves to Contacted status
- Click `Convert` on a contacted row → verify navigation to `/admin/bookings/new?enquiryId=<id>` (no server action; URL change is the feedback)
- Apply filter `?source=whatsapp` → verify URL gains the param + chip renders + only whatsapp-source rows visible
- Click `×` on a filter chip → verify the param is removed and the chip disappears
- Sign out, sign back in as Therapist → navigate to `/admin/enquiries` → verify `AdminAccessDenied` renders with documented copy (no raw `manage_enquiries`)

### 11c — Console + Network (via the chrome-devtools MCP)

_Note for `NETWORK_BASELINE_MATCH`: Next.js 15 server actions don't appear as literal POSTs to the action endpoint — they go through the RSC stream as a POST to the page URL with a `next-action` header. Count EITHER the literal action POST OR an RSC POST with `next-action` header as a match._

- Use the chrome-devtools MCP to read the last 20 console messages and print them to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md`
- Use the chrome-devtools MCP to inspect network requests during form submit + mark-contacted + filter apply — verify POSTs to `createEnquiry` and `updateEnquiryStatus` with the documented form field names (RECON §6.4 preserved)

**Evidence to surface:**
- All token-drift grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix)
- 3 final screenshots in `/redesign/screenshots/enquiries-redesign/`
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — Audit + Critique (via subagents) + Smoke Test

This step dispatches subagents for the audit and critique commands. The reason: self-scoring inflation is a known failure mode (login self-scored 20/20 audit + 37/40 critique — almost certainly inflated by recency bias). Subagents start with no "I just did this work" bias and re-prime from disk fresh; the scores you bring back are objective.

**Subagent model + thinking:** subagents inherit your model + thinking level. The user must already be on Opus 4.7 + medium thinking in `/config` (preflight in LAUNCH-SHEET Section 0b). The Agent tool does NOT expose a per-subagent thinking override.

**Why both — and how it lands in the transcript:** subagent internal turns are invisible to the parent /goal Haiku evaluator. Only the subagent's *returned summary* reaches the main transcript. Therefore: subagents do NOT write to PER-PAGE-SCORES.md (their writes are invisible to the parent loop); they return text; the main agent performs the append + prints the appended section to chat. That print is what the Haiku evaluator sees.

### 12a — Audit (subagent)

**Action:** Use the Agent tool with `subagent_type=general-purpose`. Subagent prompt (the slug `enquiries` is already substituted below — pass this prompt verbatim):

```
You are auditing the redesign of admin page enquiries for Phase 6 of the Rahma Therapy admin redesign. The page has just been crafted, polished, adapted, and hardened by another agent. Your job is an objective code + design audit — you have NO bias from doing the work.

Re-prime (read these in order, in full):
1. /redesign/briefs/enquiries-brief.md
2. PRODUCT.md
3. DESIGN.md (full, including ## Admin-Specific Patterns)
4. /redesign/IMPLEMENTATION-PLAN.md — find the enquiries row to determine Backend status (N-A / FAKE / HANDLED) and any BUILD plan dependencies
5. /redesign/BUSINESS-COMPLETENESS.md — to identify any Track A items this page contributes to
6. The post-polish screenshots at /redesign/screenshots/enquiries-redesign/enquiries-polish-final-{375,768,1440}.png
7. The current source code: src/app/admin/enquiries/** and any other files in the recipe's "Files to edit" list

Severity rubric (impeccable v5 L884-890 — quote it verbatim, do not paraphrase):
- P0 — Blocks release — fix before shipping anything
- P1 — Fix this sprint — significant impact on users
- P2 — Next cycle — noticeable but not blocking
- P3 — Polish — minor, fix when time allows

Task: invoke the impeccable Skill with `audit enquiries`. Score 5 dimensions and surface all P0/P1/P2/P3 findings with file:line references.

Return format — the full audit text, formatted to be appendable to PER-PAGE-SCORES.md under heading `## enquiries — audit`, with these required subsections:
- 5 dimension scores
- P0/P1/P2/P3 findings (each on its own line with file:line refs)
- Backend status (N-A / FAKE / HANDLED — if FAKE, name the blocking BUILD plan filename(s) verbatim from IMPLEMENTATION-PLAN.md)
- **P1 (tag for Phase 7 gauntlet):** subsection — list each P1 finding with location + file:line. If zero, write `none`. Phase 7 `/impeccable audit admin` re-scans this section.
- **BUSINESS-COMPLETENESS impact:** subsection — name any Track A items this page newly contributes to (e.g. `2A-6` if form-level `role="alert" aria-live="polite"` was implemented). If none, write `none`.

Do NOT write to PER-PAGE-SCORES.md. The main agent will perform the append. Return the full audit text verbatim.
```

After the subagent returns:
1. Read the returned audit text from the Agent tool result.
2. Append it verbatim to `/redesign/PER-PAGE-SCORES.md` under heading `## enquiries — audit`.
3. **Print the appended section to chat verbatim.** This is critical — the subagent's internal turns are invisible to the parent /goal evaluator. Without surfacing the appended section, the audit is invisible to the parent loop.
4. If any P0 finding exists: emit `P0_FOUND:` followed by the list and STOP. Do not proceed to 12b. The user decides fix-now vs defer.

### 12b — Critique (subagent)

**Action:** Use the Agent tool with `subagent_type=general-purpose`. Subagent prompt (`enquiries` already substituted):

```
You are critiquing the redesign of admin page enquiries for Phase 6. The page has been crafted + polished + adapted + hardened + audited by another agent. Your job is an objective UX critique — you have NO bias from doing the work.

Re-prime (read in full):
1. /redesign/briefs/enquiries-brief.md
2. PRODUCT.md
3. DESIGN.md (full)
4. The post-polish screenshots at /redesign/screenshots/enquiries-redesign/enquiries-polish-final-{375,768,1440}.png
5. The current source code: src/app/admin/enquiries/**

Task: invoke the impeccable Skill with `critique enquiries`. Return:
- 10 Nielsen heuristic scores (Visibility of system status; Match between system and real world; User control and freedom; Consistency and standards; Error prevention; Recognition rather than recall; Flexibility and efficiency; Aesthetic and minimalist design; Help users recognize, diagnose, and recover from errors; Help and documentation)
- AI-slop verdict (PASS / REGRESSED / FAIL) with one-sentence reasoning
- Brief commentary on UX-quality, mapping concrete observations to PRODUCT.md anti-references (no generic SaaS feel, no identical-card grids, no decorative blobs, etc.)

Return format — the full critique text, formatted to be appendable to PER-PAGE-SCORES.md under heading `## enquiries — critique`.

Do NOT write to PER-PAGE-SCORES.md. Return the full critique text verbatim.
```

After the subagent returns:
1. Append verbatim to `/redesign/PER-PAGE-SCORES.md` under heading `## enquiries — critique`.
2. **Print to chat verbatim** — same reasoning as 12a.
3. If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder enquiries` or `/impeccable distill enquiries` (whichever fits the verdict's reasoning), then re-dispatch the critique subagent with the same prompt. Loop max 2 times. If after 2 loops the verdict is still REGRESSED/FAIL, append the verdict + reasoning to `/redesign/per-page-deferrals/enquiries-deferrals.md` with **Defer to: Phase 7** and proceed to 12c.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code:

- [ ] `EnquiryForm` field `name` attrs all present in DOM: `full_name`, `source`, `phone`, `email`, `service_interest`, `assigned_staff_id`, `notes`
- [ ] `<form action={createEnquiry}>` wired verbatim (no `fetch`/`XHR` replacement)
- [ ] `EnquiryStatusButton` calls `updateEnquiryStatus` with documented bindings
- [ ] Tab strip: every `?tab=` value resolves correctly; `aria-current="page"` on active
- [ ] `New` tab count badge: present when uncontacted count > 0; absent when 0
- [ ] Filter contract: every documented GET param (`source`, `assigned_staff`, `from`, `to`, `q`) round-trips + survives reload
- [ ] Active filter chips: each carries a clear `×` button that removes the corresponding URL param
- [ ] Status actions per row: `Mark contacted` and `Convert` always visible at rest (DESIGN.md Table Actions rule); no hover-reveal
- [ ] Three-dot `AdminActionMenu` has `aria-label="More actions for {full_name}"`
- [ ] Converted rows: `View booking →` Ghost only; no status-change actions
- [ ] Closed rows: three-dot menu only; intentionally quiet
- [ ] `Convert` Ghost target: `/admin/bookings/new?enquiryId={id}` (navigation only, no server action)
- [ ] No `border-l-4` on any row, card, or alert
- [ ] All status badges have text label + icon + bg tint (Named Status Rule)
- [ ] No gradient text anywhere
- [ ] Single H1 (page title `Enquiries`) + H2 `Record enquiry` — no heading skips
- [ ] All form inputs have `<label for="…">` with matching `id`
- [ ] Required fields (`full_name`, `email`) have visible `*` in Cancelled colour with `aria-hidden`
- [ ] `AdminAccessDenied` (Therapist) contains no `manage_enquiries` raw identifier
- [ ] Mobile form disclosure toggle behaves correctly (collapsed default, expand on tap)

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
- [ ] PER-PAGE-SCORES.md sections appended (`## enquiries — audit` + `## enquiries — critique`) and printed to chat verbatim from the subagent results (Step 12a + 12b).
- [ ] Deferral file written at `/redesign/per-page-deferrals/enquiries-deferrals.md` — even if empty, write `(no deferrals — Phase 6 closed cleanly for enquiries)`. The main agent and the Phase 7 gauntlet both read this; missing file = ambiguous closure.
- [ ] No commit. No `git add`. The main agent in the user's primary session stages + commits scoped files after the user approves.

**Handoff message — emit to chat in this shape:**
- Dev server URL: `http://localhost:3015/admin/enquiries`
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
5. `BACKEND_FAKE_SURFACES:` (list of `data-redesign-backend="FAKE"` surfaces)
6. `CRAFT_COMPLETE`
7. `PAGE-POLISH-COMPLETE` (inside `<promise>` tags)
8. `DEV_SERVER_READY at http://localhost:3015`
9. `AXES_APPLIED:` (list of impeccable axes run with one-line rationale each)
10. `POLISH_ISSUES_ITER_2: none — clean` (or the remaining-issues list, deferred to Phase 7 if any)
11. `HORIZONTAL_SCROLL_TABLET: false` and `HORIZONTAL_SCROLL_MOBILE: false`
12. `TOKEN_DRIFT: 0` (or each drift explicitly addressed)
13. `CONSOLE_NEW_ERRORS: 0`
14. `## enquiries — audit` and `## enquiries — critique` headings appended (printed to chat from the file)
15. `SMOKE_TEST: all PASS`
16. `SCOPE_CLEAN: only scoped files changed`
17. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
