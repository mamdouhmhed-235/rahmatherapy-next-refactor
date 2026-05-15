# /goal recipe — page: dashboard-coordinator (9 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/dashboard-coordinator-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `dashboard-coordinator` |
| Page row in IMPLEMENTATION-PLAN.md | row 9 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/dashboard-coordinator-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (dashboard-coordinator section) |
| Source files to edit | `src/app/admin/dashboard/page.tsx`, `src/app/admin/dashboard/dashboard-cards.tsx`, `src/app/admin/dashboard/dashboard-header.tsx`, `src/app/admin/dashboard/dashboard-filters-client.tsx`, `src/app/admin/dashboard/attention-group-client.tsx`, `src/app/admin/dashboard/demand-trend-client.tsx`, `src/app/admin/components/notification-bell.tsx` |
| Logo asset (already present and tracked) | `public/images/brand/rahma/logo-refined.svg` |
| Worktree | this checkout — branch `agent/dashboard-coordinator-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3001` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `N-A` for THIS session — read-only surface. Brief Open Question 1 flags an Active Enquiries data fetcher that may need a small read-only helper in `dashboard-data.ts` (RECON §5 untouchable). Default: flag in handoff and leave `dashboard-data.ts` untouched; if the helper is missing, render the tile with `0` and an empty state. |
| Progress scratchpad | `/redesign/per-page-progress/dashboard-coordinator-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `src/app/admin/dashboard/dashboard-data.ts` — server-side aggregation, including `coordinator` variant resolution at line 124. If Active Enquiries needs a new data shape, flag and let the user decide (see STUCK clause).
   - `src/app/admin/dashboard/dashboard-helpers.ts`
   - `src/app/admin/dashboard/dashboard-data.test.ts`, `dashboard-helpers.test.ts`
   - `src/app/admin/dashboard/TherapistDashboard.tsx` — therapist variant (separate brief)
   - `src/app/admin/shell-variant.ts` — `resolveAdminShellVariant`
   - `src/app/admin/enquiries/actions.ts` — enquiry mutations stay in their own route
   - `src/middleware.ts` — Supabase session refresh / route protection
   - `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layer (RECON §5)
   - `supabase/migrations/**`
   - `src/components/ui/card.tsx` — out of scope here (fix lives in `00-shared-components` session)
   - All build/config files (`next.config.ts`, `wrangler.jsonc`, `open-next.config.ts`, `tsconfig.json`, etc.)
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve GET filter form `name` attributes (RECON §2):** `range`, `from`, `to`, `city`, `service`, `staffId`, `source`, `status`, `paymentStatus` — every name must remain literal.
6. **Preserve IDs (RECON §6.4):** `id="admin-main"` + skip-link, `id="admin-command-search"`, `id="attention-dialog-title"`, SVG `<linearGradient id="demandGradient">` (preserve when rendering for Owner/Admin even though not rendered for Coordinator).
7. **Preserve permission gates verbatim:** `view_reports_revenue` must remain **false** for Coordinator (no Payment Health, no Export Ghost link). `manage_staff_profiles` must remain **false** (no Staff Capacity). `manage_enquiries` gates the new Active Enquiries tile.
8. **`notification-bell.tsx` is shared infrastructure** — coordinate with `00-shared-components` and the `dashboard-owner-admin` session. If `border-l-4` line 403 has already been removed in start-state, skip that edit here.

## STUCK clause

If you are genuinely blocked on any step (skill unavailable, brief contradicts codebase, server won't start, Active Enquiries data not available, etc.) — **stop trying** and emit a literal line:

```
STUCK: <step number> — <specific, actionable reason>
```

Specifically: if the Active Enquiries tile requires a new data fetcher that does not currently exist in the coordinator-variant payload from `dashboard-data.ts`, emit `STUCK: <step> — Active Enquiries data fetcher missing from dashboard-data.ts and that file is RECON §5 untouchable; please confirm extension scope or fall-back UI`.

The `/goal` evaluator will see this and end the loop cleanly. The user will then investigate and re-dispatch with the fix.

## Hard cap

If you reach **40 turns** without the goal being met, emit:

```
TURN_CAP_REACHED — <summary of what's complete vs missing>
```

…and stop. (Cap will be raised once we trust the path.)

## Oversize file handling

When `Read` returns "File content (N tokens) exceeds maximum allowed tokens (25000)", DO NOT retry the full read. Use `offset` + `limit`, or use `Grep`.

Known oversize files relevant to this recipe:
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `dashboard` for page-specific entries
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; lines 540–580 for the dashboard rows
- `src/app/admin/dashboard/dashboard-cards.tsx` may be oversize — use targeted Grep instead of full reads

---

# Steps

## Step 0 — Skill availability check (FIRST, do not skip)

**Action:** Verify these Skill-tool invocations resolve in this session:
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
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/dashboard-coordinator-progress.md` and cat it.

---

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: dashboard-coordinator
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/dashboard-coordinator-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for dashboard-coordinator)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/dashboard-coordinator-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

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

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (dashboard-coordinator) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
> - /redesign/briefs/dashboard-coordinator-brief.md  ← THIS IS THE PREPARED BRIEF
> - /redesign/briefs/dashboard-owner-admin-brief.md  ← share most chrome with this variant; read for cross-brief consistency
>
> Tell me before writing any code:
> - Files you will edit
> - Files you will NOT touch (from the brief's untouchable list)
> - Features you are preserving
> - Any conflict between brief and codebase
> - Whether the Owner/Admin carry-forward fixes (`border-l-4`, `bg-black`, avatar hexes, chart colors) have already landed in `redesign/start-state` from the previous dashboard session — if yes, skip those edits here; if no, land them once
>
> (You are running under `/goal`, so "wait for my go-ahead" → instead print the file list to chat with a literal `SCOPE_PROPOSAL:` prefix, then proceed.)
>
> WRITE THE PER-PAGE SCOPE TO DISK before craft runs:
> Write to `/redesign/per-page-scope/dashboard-coordinator-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/dashboard-coordinator-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1024 → 1280 → 1440. Tier 1 two-column grid activates at ≥1280px; Tier 2 narrows to 1×2 (two sub-tiles side-by-side at desktop, stacked on mobile).
>
> IMAGE HANDLING: no new image assets required for this page.
>
> BACKEND FAKE MARKER: Active Enquiries data fetcher may be FAKE/unavailable per brief Open Question 1. If missing from `dashboard-data.ts` coordinator-variant payload, render the tile with `0`, empty-state copy, and flag in handoff.

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list
- `/redesign/per-page-scope/dashboard-coordinator-scope.md` written; print its contents to chat
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- Append `step-3: COMPLETE — scope written, plan updated` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page dashboard-coordinator`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page dashboard-coordinator`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/dashboard-coordinator-brief.md. Compare the current implementation to the brief's requirements (5 native sections + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3001 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-dashboard-coordinator-redesign"
pnpm next dev -p 3001
```

Use `run_in_background: true`. Poll `http://localhost:3001/admin/dashboard` (signed in as Coordinator) until it returns HTTP 200 (or 308 — that's a trailing-slash redirect which Playwright handles). Max wait: 60 seconds.

**If node_modules junction is broken** (junction got removed or stale), fall back to:
```powershell
cmd /c mklink /J node_modules "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor\node_modules"
```

**Evidence to surface:**
- The HTTP status code from the readiness poll printed to chat
- Literal line `DEV_SERVER_READY at http://localhost:3001`
- Append `step-6: COMPLETE — dev server on 3001` and cat progress file

---

## Step 7 — Step 2 iterate (screenshots + named-axis decision)

**Action:** Use the `playwright` MCP tool (NOT `chrome-devtools` — playwright handles redirects).

Sign in first as `test.coordinator@rahmatherapy.example.test` / `CoordinatorTest123!` (the Coordinator-variant dashboard requires this role). Then take screenshots and save to `/redesign/screenshots/dashboard-coordinator-redesign/`:
- `chunk1-1440-default-collapsed.png` at 1440×900 (Tier 1 visible, Tier 2 "Active queues" collapsed)
- `chunk1-1440-tier2-expanded.png` at 1440×900 ("Active queues" open — 1×2 grid: Active Enquiries + Operations Health)
- `chunk1-1440-unassigned-first.png` at 1440×900 (Today panel with 3 unassigned bookings — unassigned-first sort, Attention chips visible)
- `chunk1-1440-all-assigned.png` at 1440×900 (all today bookings assigned — "0 unassigned" in Confirmed family)
- `chunk1-768-default.png` at 768×1024
- `chunk1-375-default.png` at 375×812
- `chunk1-1440-no-export.png` at 1440×900 — verify "Export" Ghost link is ABSENT in filter strip (Coordinator lacks `view_reports_revenue`)
- `chunk1-1440-empty-db.png` at 1440×900 (no bookings, no enquiries, no events)

Self-assess against the brief. If you can identify ONE specific axis problem:

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder dashboard-coordinator` |
| Too loud, too many colours | `/impeccable quieter dashboard-coordinator` |
| Grey, lifeless, no identity | `/impeccable colorize dashboard-coordinator` |
| Fonts feel default or inconsistent | `/impeccable typeset dashboard-coordinator` |
| Spacing is off, things feel cramped | `/impeccable layout dashboard-coordinator` |
| Static, jumpy, no motion | `/impeccable animate dashboard-coordinator` |
| Functional but cold | `/impeccable delight dashboard-coordinator` |
| Too much on the page | `/impeccable distill dashboard-coordinator` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

If a refine runs, re-screenshot with `-after-refine` suffix.

**Evidence to surface:**
- 8+ screenshot file paths printed to chat (`ls redesign/screenshots/dashboard-coordinator-redesign/`)
- Literal decision: `ITERATE_DECISION: no refine needed — <brief-justified reason>` OR `ITERATE_DECISION: ran /impeccable <axis> dashboard-coordinator because <reason>`
- Append `step-7: COMPLETE — iterate decision logged` and cat progress file

---

## Step 8 — `/impeccable adapt dashboard-coordinator for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt dashboard-coordinator for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/dashboard-coordinator-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/dashboard-coordinator-adapt-after-mobile.png`
3. Confirm no horizontal scroll at either breakpoint (Playwright: check `document.documentElement.scrollWidth <= window.innerWidth`)
4. Confirm Tier 1 grid collapses to single-column at <1280px (Today first, then Attention)
5. Confirm Tier 2 "Active queues" sub-tiles stack vertically on mobile when expanded
6. Confirm date-preset chips become horizontal momentum-scroll strip at <768px
7. Confirm "More filters" sheet opens from bottom on mobile, right on desktop
8. Confirm "Export" Ghost is absent at every viewport for Coordinator role

**Evidence to surface:**
- Two `dashboard-coordinator-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target heights (`TOUCH_TARGET_CHIP_MOBILE: <px>`, `TOUCH_TARGET_CONVERT_MOBILE: <px>` — the "Convert →" link)
- DOM check for Export Ghost absence (`EXPORT_LINK_PRESENT: false`)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden dashboard-coordinator`

**Action:** Invoke Skill with `/impeccable harden dashboard-coordinator`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-dashboard-coordinator.md`. Implement what harden recommends per the brief's `## 6. Key States` section. Key states include: first paint populated, empty DB, all bookings assigned, 3 unassigned bookings, Tier 2 expanded, Active Enquiries empty / populated / all-handled, Operations Health empty, filter open, filtered to empty range, loading, error.

Verification edge cases (dashboard-coordinator-specific):
- Today panel sub-line: when "N unassigned > 0", text colour is Attention family with leading `alert-circle`; when "0 unassigned", text colour is Confirmed family (subtle reward signal)
- Unassigned today rows sort to the top of the list above assigned rows (regardless of start time)
- Assignment chip on unassigned rows reads "Unassigned" or "Unassigned · same-gender required" — never colour-only
- "Convert →" Ghost link in Active Enquiries renders Clinic Green; stale enquiry on Convert click shows toast `That enquiry is no longer open. Refresh to see the updated list.`
- Operations Health link target `/admin/operations` resolves correctly for Coordinator (verify per brief Open Question 4)
- Avatar placeholder for unassigned rows: 32px Hover Moss circle + centred `user-x` 16px icon

**Evidence to surface:**
- `/redesign/HARDEN-RECS-dashboard-coordinator.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-dashboard-coordinator.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify dashboard-coordinator`

**Action:** Invoke Skill with `/impeccable clarify dashboard-coordinator`.

Verify copy matches the brief's `## Copy` section exactly (or has been tightened for layout — that's allowed). Specifically:
- H1: `Today at Rahma` (identical to Owner/Admin — voice-anchored)
- Subtitle: live date + locality
- Tier 1 H2s: `Today` · `Needs your attention`
- Tier 2 disclosure H2: `Active queues` / `Active queues (nothing right now)` when empty
- Tier 2 sub-tile H3s: `Active enquiries` · `Operations health`
- Today panel inline count: `of which N unassigned · N confirmed · N pending`
- Assignment chip text: `Unassigned` / `Unassigned · same-gender required`
- Role pill: `Coordinator` (Restricted family pill)
- Date preset chips verbatim: `Today` / `This week` / `This month` / `Last 30 days` / `Custom`
- "More filters" button label with count
- "See all {N} for today →" overflow link
- Tier 2 disclosure aria-labels: `Show active queues` / `Hide active queues`
- "Convert →" Ghost (Clinic Green) on Active Enquiries rows
- "→ All enquiries" Ghost (Clinic Green) trailing link
- "→ Operations" Ghost trailing link
- Empty-state copy verbatim per brief Copy §Empty-state text table — note the Coordinator-specific pivots ("Use the time to follow up on enquiries" vs Owner/Admin's "Quiet days are healthy days")
- Voice matches `PRODUCT.md` Brand Personality

**Evidence to surface:**
- List of copy surfaces changed (with before/after) — OR `CLARIFY_RESULT: copy already matches brief Copy section`
- Append `step-10: COMPLETE — clarify run, copy verified` and cat progress file

---

## Step 11 — Verify (Step 6 from workflow guide)

**Action:** Three sub-checks in order.

### 11a — Token-drift lint

For files changed in this redesign, grep:
```bash
# Raw hex (should be 0 outside comments)
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/dashboard/page.tsx src/app/admin/dashboard/dashboard-cards.tsx src/app/admin/dashboard/dashboard-header.tsx src/app/admin/dashboard/dashboard-filters-client.tsx src/app/admin/dashboard/attention-group-client.tsx src/app/admin/components/notification-bell.tsx

# Raw oklch() literals (allowed for `var(--avatar-hue)` wrapping; flag others)
grep -nE 'oklch\(' src/app/admin/dashboard/page.tsx src/app/admin/dashboard/dashboard-cards.tsx src/app/admin/dashboard/dashboard-header.tsx src/app/admin/dashboard/dashboard-filters-client.tsx src/app/admin/dashboard/attention-group-client.tsx src/app/admin/components/notification-bell.tsx

# Forbidden `border-l-4` — MUST be 0 across edited files (carry-forward from Brief 06)
grep -nE 'border-l-4' src/app/admin/dashboard/page.tsx src/app/admin/dashboard/dashboard-cards.tsx src/app/admin/dashboard/dashboard-header.tsx src/app/admin/dashboard/dashboard-filters-client.tsx src/app/admin/dashboard/attention-group-client.tsx src/app/admin/components/notification-bell.tsx

# Forbidden `bg-black` — MUST be 0 (carry-forward from Brief 06)
grep -nE 'bg-black' src/app/admin/dashboard/attention-group-client.tsx

# Raw Tailwind gray classes (carry-forward from Brief 06)
grep -nE 'bg-gray-\d+|text-gray-\d+' src/app/admin/dashboard/dashboard-cards.tsx

# font-family literals (should be 0)
grep -nE "font-family:\s*['\"]" src/app/admin/dashboard/page.tsx src/app/admin/dashboard/dashboard-cards.tsx
```

For each match, confirm the value comes from a DESIGN.md token. If a hardcoded value isn't backed by a token, FIX IT.

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1280 → 1440)

- Sign in as `test.coordinator@rahmatherapy.example.test` / `CoordinatorTest123!` then navigate to `/admin/dashboard` at each viewport
- Save final-state screenshots: `dashboard-coordinator-final-{375,768,1280,1440}.png` to `/redesign/screenshots/dashboard-coordinator-redesign/`
- Verify "Export" Ghost link is NOT in the DOM (revenue-gated; Coordinator fails the gate)
- Verify role pill reads "Coordinator" with Restricted family tint
- Verify Today panel renders unassigned bookings first when at least one is unassigned (sort order honours `unassignedFirst: true`)
- Toggle Tier 2 "Active queues" disclosure → verify `aria-expanded` flips, two sub-tiles render side-by-side at desktop, stacked at mobile
- Click "Convert →" Ghost in Active Enquiries → verify navigation to `/admin/bookings/new?enquiryId=<id>`
- Click Active Enquiries tile body (not the Convert link) → verify navigation to `/admin/enquiries`
- Click Operations Health tile trailing link → verify navigation to `/admin/operations`
- Verify `localStorage` key persists Tier 2 disclosure state per (user × variant)
- Sign out via `/admin/signout` to leave a clean session for downstream pages

### 11c — Console + Network

- Print last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md` (warnings OK)
- Print network requests during filter change — verify only GET navigation (no server action invocation)

**Evidence to surface:**
- All six grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix); explicit `BORDER_L_4: 0`; explicit `BG_BLACK: 0`; explicit `RAW_TAILWIND_GRAY: 0`
- 4+ final screenshot files in `/redesign/screenshots/dashboard-coordinator-redesign/`: `dashboard-coordinator-final-{375,768,1280,1440}.png`
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — `/impeccable audit dashboard-coordinator` + `/impeccable critique dashboard-coordinator` + functional smoke test

### 12a — Audit
Invoke Skill with `/impeccable audit dashboard-coordinator`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## dashboard-coordinator — audit`:
- 5 dimension scores
- P0/P1/P2/P3 findings, each on its own line
- Backend status: `N-A` (Active Enquiries flagged as possible follow-up if data fetcher is missing)
- Confirm Brief-06 carry-forwards remain resolved across the shared files

**Print the appended section to chat.**

**If any P0 finding: emit `P0_FOUND:` followed by the list and STOP.** Do not proceed to handoff. The user will decide whether to fix-now or defer.

### 12b — Critique
Invoke Skill with `/impeccable critique dashboard-coordinator`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## dashboard-coordinator — critique`:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

**Print the appended section to chat.**

If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder dashboard-coordinator` OR `/impeccable distill dashboard-coordinator` based on which fits the verdict's reasoning, then re-run `/impeccable critique dashboard-coordinator`. Loop max 2 times.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code:

- [ ] All 9 GET filter form `name` attributes present: `range`, `from`, `to`, `city`, `service`, `staffId`, `source`, `status`, `paymentStatus`
- [ ] `getAdminPageAccess("dashboard")` ≠ none for Coordinator (verified by being able to render the page)
- [ ] `view_reports_revenue` returns false for Coordinator → no Payment Health tile, no Export Ghost link
- [ ] `manage_staff_profiles` returns false for Coordinator → no Staff Capacity tile
- [ ] `manage_enquiries` returns true for Coordinator → Active Enquiries tile renders
- [ ] `manage_settings` / `manage_email_settings` gating per brief Open Question 4 — Operations Health renders for Coordinator (or flag a P1 if it 404s on navigation)
- [ ] IDs preserved: `id="admin-main"`, skip-link, `id="admin-command-search"`, `id="attention-dialog-title"`; `<linearGradient id="demandGradient">` preserved when this file is touched for Owner/Admin variant
- [ ] POST `/admin/signout` remains POST
- [ ] Deep-link `/admin/dashboard?range=custom&from=…&to=…` reachable for Coordinator
- [ ] Deep-link `/admin/bookings/new?enquiryId=<id>` works from "Convert →" Ghost
- [ ] `/admin/bookings?view=today` (Today panel "See all" link) and `/admin/enquiries` and `/admin/operations` all resolve
- [ ] `/admin/reports/export?…` NOT rendered for Coordinator
- [ ] No `border-l-4` anywhere across the edited files
- [ ] No `bg-black` in `attention-group-client.tsx`
- [ ] No marquee gold numerals on this variant (Today count is Chronicle, not gold)
- [ ] Tier 2 disclosure `aria-expanded` toggles, `localStorage` persists
- [ ] All date preset pills have `aria-current="page"` on active
- [ ] All status badges + assignment chip + lifecycle chip have text label + icon

**Evidence to surface:**
- Both PER-PAGE-SCORES.md sections printed to chat (audit + critique)
- Functional smoke test checklist printed with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit/critique/smoke clean` and cat progress file

---

## Step 13 — Handoff (NO COMMIT — wait for user approval)

**Action:**
1. Run `git diff --stat` in the worktree — print to chat
2. Compare changed-files list against `/redesign/per-page-scope/dashboard-coordinator-scope.md`. For any file changed that isn't in the scope file's "Files to edit" list: STOP and emit `SCOPE_VIOLATION: <file>`. Otherwise: `SCOPE_CLEAN: only scoped files changed`.
3. Run `git diff` (full) and confirm nothing unexpected appears — print the diff to chat in collapsible form.
4. Emit the handoff message to chat with:
   - Dev server URL: `http://localhost:3001/admin/dashboard` (signed in as Coordinator)
   - All screenshot paths
   - Audit + critique key scores
   - Active Enquiries data status (wired to real fetcher / placeholder with empty state / flagged for separate session)
   - Operations Health link verification (resolves for Coordinator / 404s — flagged)
   - Coordination note about shared files (`dashboard-cards.tsx`, `notification-bell.tsx`, `attention-group-client.tsx`)
   - Any deviations from brief (or `DEVIATIONS: none`)
5. **Emit the literal string `HANDOFF_READY — awaiting user approval`** — this is the `/goal` evaluator's final completion signal.
6. **STOP. Do NOT stage anything. Do NOT commit.** Wait for the user to inspect the worktree and respond.

**Evidence to surface:**
- `git diff --stat` output
- `SCOPE_CLEAN: only scoped files changed` (or `SCOPE_VIOLATION:`)
- Full handoff message
- The literal final line: `HANDOFF_READY — awaiting user approval`
- Append `step-13: COMPLETE — handoff emitted, awaiting approval` (final line) and cat progress file

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
8. `DEV_SERVER_READY at http://localhost:3001`
9. `ITERATE_DECISION:`
10. `HORIZONTAL_SCROLL_TABLET: false` and `HORIZONTAL_SCROLL_MOBILE: false`
11. `TOKEN_DRIFT: 0` (or each drift explicitly addressed)
12. `CONSOLE_NEW_ERRORS: 0`
13. `## dashboard-coordinator — audit` and `## dashboard-coordinator — critique` headings appended (printed to chat from the file)
14. `SMOKE_TEST: all PASS`
15. `SCOPE_CLEAN: only scoped files changed`
16. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
