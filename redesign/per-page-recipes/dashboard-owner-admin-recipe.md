# /goal recipe — page: dashboard-owner-admin (8 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/dashboard-owner-admin-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `dashboard-owner-admin` |
| Page row in IMPLEMENTATION-PLAN.md | row 8 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/dashboard-owner-admin-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (dashboard-owner-admin section) |
| Source files to edit | `src/app/admin/dashboard/page.tsx`, `src/app/admin/dashboard/dashboard-header.tsx`, `src/app/admin/dashboard/dashboard-filters-client.tsx`, `src/app/admin/dashboard/dashboard-cards.tsx`, `src/app/admin/dashboard/attention-group-client.tsx`, `src/app/admin/dashboard/demand-trend-client.tsx`, `src/app/admin/components/notification-bell.tsx` |
| Logo asset (already present and tracked) | `public/images/brand/rahma/logo-refined.svg` |
| Worktree | this checkout — branch `agent/dashboard-owner-admin-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3001` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `N-A` for THIS session — read-only surface; all mutations on other pages. `dashboard-data.ts` is UNTOUCHABLE per RECON §5; do not extend. |
| Progress scratchpad | `/redesign/per-page-progress/dashboard-owner-admin-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `src/app/admin/dashboard/dashboard-data.ts` — server-side data aggregation (RECON §5)
   - `src/app/admin/dashboard/dashboard-helpers.ts` — pure helpers (RECON §5)
   - `src/app/admin/dashboard/dashboard-data.test.ts`, `dashboard-helpers.test.ts` — tests
   - `src/app/admin/dashboard/TherapistDashboard.tsx` — therapist-variant component (owned by `dashboard-therapist-brief.md`)
   - `src/app/admin/shell-variant.ts` — role-to-variant resolver
   - `src/middleware.ts` — Supabase session refresh / route protection
   - `src/lib/auth/**` — RBAC matrix, `getAdminPageAccess`, page access resolver
   - `src/lib/supabase/**` — client factories
   - `supabase/migrations/**`
   - `src/components/ui/card.tsx` — out of scope here (fix lives in `00-shared-components` session)
   - All build/config files (`next.config.ts`, `wrangler.jsonc`, `open-next.config.ts`, `tsconfig.json`, etc.)
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve GET filter form `name` attributes (RECON §2):** `range`, `from`, `to`, `city`, `service`, `staffId`, `source`, `status`, `paymentStatus` — every name must remain literal.
6. **Preserve IDs (RECON §6.4):** `id="admin-main"` + skip-link, `id="admin-command-search"`, `id="attention-dialog-title"`, SVG `<linearGradient id="demandGradient">` — all must keep their literal values.
7. **Preserve external/deep-link contracts:** POST `/admin/signout` (never GET), GET `/admin/reports/export?…` (must carry current filter state), `/admin/dashboard?range=custom&from=…&to=…` deep-linkable.
8. **`notification-bell.tsx` is shared infrastructure** — coordinate with `00-shared-components` session per brief Open Question 2. If that session has already merged the bell rewrite into `redesign/start-state`, prefer its variant; otherwise apply the `variant="header-rail"` extension here.

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

…and stop. (Cap will be raised once we trust the path.)

## Oversize file handling

When `Read` returns "File content (N tokens) exceeds maximum allowed tokens (25000)", DO NOT retry the full read. Use `offset` + `limit`, or use `Grep`.

Known oversize files relevant to this recipe:
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `dashboard` for page-specific entries
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; lines 540–580 for the dashboard rows
- `src/app/admin/dashboard/dashboard-cards.tsx` may itself be oversize — use targeted Grep for `border-l-4`, `bg-black`, `#`, `oklch(` instead of full reads

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
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/dashboard-owner-admin-progress.md` and cat it.

---

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: dashboard-owner-admin
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/dashboard-owner-admin-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for dashboard-owner-admin)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/dashboard-owner-admin-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

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

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (dashboard-owner-admin) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
> - /redesign/briefs/dashboard-owner-admin-brief.md  ← THIS IS THE PREPARED BRIEF
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
> Write to `/redesign/per-page-scope/dashboard-owner-admin-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/dashboard-owner-admin-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1024 → 1280 → 1440. Tier 1 two-column grid activates at ≥1280px; below that, single-column stack (Today first, Attention second). Filter strip collapses chips to horizontal momentum-scroll on mobile.
>
> IMAGE HANDLING: no new image assets required for this page. EmptyState illustrations come from `/public/images/admin/empty-states/` (confirm asset presence; if missing, flag in `redesign/IMAGES-NEEDED.md` but don't block — fall back to icon-only empty state).
>
> BACKEND FAKE MARKER: dashboard-owner-admin has no FAKE-tagged backend features. Skip.

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list (7 files)
- `/redesign/per-page-scope/dashboard-owner-admin-scope.md` written; print its contents to chat
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- Append `step-3: COMPLETE — scope written, plan updated` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page dashboard-owner-admin`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page dashboard-owner-admin`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/dashboard-owner-admin-brief.md. Compare the current implementation to the brief's requirements (5 native sections + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3001 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-dashboard-owner-admin-redesign"
pnpm next dev -p 3001
```

Use `run_in_background: true`. Poll `http://localhost:3001/admin/dashboard` until it returns HTTP 200 (or 308 — that's a trailing-slash redirect which Playwright handles). Max wait: 60 seconds.

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

Sign in first as `test.admin@rahmatherapy.example.test` / `AdminTest123!` (the dashboard is auth-gated). Then take screenshots and save to `/redesign/screenshots/dashboard-owner-admin-redesign/`:
- `chunk1-1440-default-collapsed.png` at 1440×900 (Tier 1 visible, Tier 2 collapsed)
- `chunk1-1440-tier2-expanded.png` at 1440×900 (Business Overview disclosure open — 2×2 grid)
- `chunk1-768-default.png` at 768×1024
- `chunk1-375-default.png` at 375×812
- `chunk1-1440-empty-db.png` at 1440×900 (no bookings, no enquiries — Tier 1 + Tier 2 empty states)
- `chunk1-1440-attention-zero.png` at 1440×900 (Attention count = 0; panel background shifts to Confirmed family tint)
- `chunk1-1440-more-filters-open.png` at 1440×900 (right-side AdminSheet)
- `chunk1-375-more-filters-open.png` at 375×812 (bottom AdminSheet)
- `chunk1-1440-custom-date-range.png` at 1440×900 (Custom preset selected, from/to inputs revealed)
- `chunk1-1440-admin-pm-as-owner.png` at 1440×900 (signed in as `test.adminpm@…` — should be identical to Owner)

Self-assess against the brief. If you can identify ONE specific axis problem:

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder dashboard-owner-admin` |
| Too loud, too many colours | `/impeccable quieter dashboard-owner-admin` |
| Grey, lifeless, no identity | `/impeccable colorize dashboard-owner-admin` |
| Fonts feel default or inconsistent | `/impeccable typeset dashboard-owner-admin` |
| Spacing is off, things feel cramped | `/impeccable layout dashboard-owner-admin` |
| Static, jumpy, no motion | `/impeccable animate dashboard-owner-admin` |
| Functional but cold | `/impeccable delight dashboard-owner-admin` |
| Too much on the page | `/impeccable distill dashboard-owner-admin` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

If a refine runs, re-screenshot with `-after-refine` suffix.

**Evidence to surface:**
- 10+ screenshot file paths printed to chat (`ls redesign/screenshots/dashboard-owner-admin-redesign/`)
- Literal decision: `ITERATE_DECISION: no refine needed — <brief-justified reason>` OR `ITERATE_DECISION: ran /impeccable <axis> dashboard-owner-admin because <reason>`
- Append `step-7: COMPLETE — iterate decision logged` and cat progress file

---

## Step 8 — `/impeccable adapt dashboard-owner-admin for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt dashboard-owner-admin for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/dashboard-owner-admin-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/dashboard-owner-admin-adapt-after-mobile.png`
3. Confirm no horizontal scroll at either breakpoint (Playwright: check `document.documentElement.scrollWidth <= window.innerWidth`)
4. Confirm Tier 1 grid collapses to single-column at <1280px (Today first, then Attention)
5. Confirm date-preset chips become horizontal momentum-scroll strip at <768px
6. Confirm "More filters" sheet slides from bottom on mobile, right on desktop
7. Confirm NotificationBell touch target ≥44px (24px icon with padding) in header rail at all viewports
8. Confirm `localStorage` persistence for the Tier 2 disclosure preference (key by user ID; verify behaviour by toggling and reloading)

**Evidence to surface:**
- Two `dashboard-owner-admin-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target heights (`TOUCH_TARGET_BELL_MOBILE: <px>`, `TOUCH_TARGET_CHIP_MOBILE: <px>`)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden dashboard-owner-admin`

**Action:** Invoke Skill with `/impeccable harden dashboard-owner-admin`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-dashboard-owner-admin.md`. Implement what harden recommends per the brief's `## 6. Key States` section. Key states include: first paint populated, empty DB, no attention items, Tier 2 expanded, filter sheet open (desktop + mobile), filtered to empty range, loading skeletons, custom date range, Recharts measuring 0×0 (fixed via `minHeight: 288`), per-tile error.

Verification edge cases (dashboard-specific):
- 24-character role name in role pill doesn't break header rail at 375
- 9 active filters → "More filters (9)" badge wraps cleanly without breaking the button
- Today panel with 5 booking rows + 5 attention rows at 1280px doesn't exceed first viewport
- Recharts `ResponsiveContainer` has explicit `minHeight: 288` set on `demand-trend-client.tsx` (verify the 6 pre-existing console warnings are silenced)
- Disclosure transition uses `grid-template-rows: 0fr → 1fr` (NOT `height: auto`); honours `prefers-reduced-motion: reduce` with instant transition
- Avatar tints: 12 hardcoded hex values replaced with `oklch(85% 0.035 var(--avatar-hue))` and hue formula `(index * 37) mod 360` clamped to 75–165 and 30–80 ranges

**Evidence to surface:**
- `/redesign/HARDEN-RECS-dashboard-owner-admin.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-dashboard-owner-admin.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify dashboard-owner-admin`

**Action:** Invoke Skill with `/impeccable clarify dashboard-owner-admin`.

Verify copy matches the brief's `## Copy` section exactly (or has been tightened for layout — that's allowed). Specifically:
- H1: `Today at Rahma` (NOT "Dashboard" — voice-anchored per PRODUCT.md)
- Subtitle: live date format e.g. `Tuesday 12 May 2026 · Luton`
- Tier 1 H2s: `Today` and `Needs your attention`
- Tier 2 disclosure H2: `Business overview` / `Business overview (no activity yet)` when empty
- Tier 2 sub-tile H3s: `Staff capacity`, `Payment health`, `Operations health`, `Demand trend`
- Date preset chip labels verbatim: `Today` · `This week` · `This month` · `Last 30 days` · `Custom`
- "More filters" button label with active count: `More filters (3)`
- Export button label: `Export` (no "CSV" suffix)
- Disclosure aria-labels: `Show business overview` / `Hide business overview`
- Empty-state copy verbatim per brief's "Empty-state text" table (Quiet day / All caught up / All systems quiet / Not enough data yet / etc.)
- Error: `Couldn't load this section. Try refreshing.`
- Tier 1 overflow links: `See all {N} for today →` and `See all {N} →`
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
# Raw hex (should be 0 outside comments) — brief flags 12 avatar hexes + #5b8dd9 + #a8d1bd as carry-forwards
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/dashboard/page.tsx src/app/admin/dashboard/dashboard-header.tsx src/app/admin/dashboard/dashboard-filters-client.tsx src/app/admin/dashboard/dashboard-cards.tsx src/app/admin/dashboard/attention-group-client.tsx src/app/admin/dashboard/demand-trend-client.tsx src/app/admin/components/notification-bell.tsx

# Raw oklch() literals (allowed when wrapping `var(--avatar-hue)` per brief; flag others)
grep -nE 'oklch\(' src/app/admin/dashboard/page.tsx src/app/admin/dashboard/dashboard-header.tsx src/app/admin/dashboard/dashboard-filters-client.tsx src/app/admin/dashboard/dashboard-cards.tsx src/app/admin/dashboard/attention-group-client.tsx src/app/admin/dashboard/demand-trend-client.tsx src/app/admin/components/notification-bell.tsx

# Forbidden `border-l-4` — MUST be 0 across these files (brief flags lines 128, 417 in dashboard-cards.tsx; line 403 in notification-bell.tsx)
grep -nE 'border-l-4' src/app/admin/dashboard/page.tsx src/app/admin/dashboard/dashboard-header.tsx src/app/admin/dashboard/dashboard-filters-client.tsx src/app/admin/dashboard/dashboard-cards.tsx src/app/admin/dashboard/attention-group-client.tsx src/app/admin/dashboard/demand-trend-client.tsx src/app/admin/components/notification-bell.tsx

# Forbidden `bg-black` — MUST be 0 (brief flags attention-group-client.tsx:144)
grep -nE 'bg-black' src/app/admin/dashboard/attention-group-client.tsx

# Raw Tailwind gray classes (brief flags `bg-gray-100` / `text-gray-600` in dashboard-cards.tsx)
grep -nE 'bg-gray-\d+|text-gray-\d+' src/app/admin/dashboard/dashboard-cards.tsx

# font-family literals (should be 0)
grep -nE "font-family:\s*['\"]" src/app/admin/dashboard/page.tsx src/app/admin/dashboard/dashboard-header.tsx src/app/admin/dashboard/dashboard-filters-client.tsx src/app/admin/dashboard/dashboard-cards.tsx

# Raw spacing literals (canon: should match the spacing scale in DESIGN.md)
grep -nE '(margin\|padding):\s*\d' src/app/admin/dashboard/page.tsx src/app/admin/dashboard/dashboard-header.tsx src/app/admin/dashboard/dashboard-filters-client.tsx src/app/admin/dashboard/dashboard-cards.tsx
```

For each match, confirm the value comes from a DESIGN.md token. If a hardcoded value isn't backed by a token, FIX IT. Particular attention to: avatar hue tokenisation (12 hexes → `oklch(85% 0.035 var(--avatar-hue))`), chart accent `#5b8dd9` → `accent-amber` (`oklch(69% 0.142 72)`) or Focus Azure fallback, bar fill `#a8d1bd` → token, `bg-black` → `oklch(12% 0.014 155)`.

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1280 → 1440)

- Sign in as `test.admin@rahmatherapy.example.test` / `AdminTest123!` then navigate to `/admin/dashboard` at each viewport
- Save final-state screenshots: `dashboard-owner-admin-final-{375,768,1280,1440}.png` to `/redesign/screenshots/dashboard-owner-admin-redesign/`
- Click "This week" date preset → verify URL contains `?range=this_week` (or equivalent param value) and `aria-current="page"` moves to that pill
- Click "More filters" → verify AdminSheet opens (right on desktop, bottom on mobile); change a filter; click "Apply filters" → verify URL updates with all values
- Click "Custom" → verify `from` + `to` date inputs appear inline (desktop) or in a small AdminSheet (mobile)
- Toggle Tier 2 disclosure → verify `aria-expanded` flips, grid-template-rows transition runs, `localStorage` key for this user persists the state across reload
- Click "Export" Ghost link → verify it navigates to `/admin/reports/export?...` carrying the current filter state in querystring (link target only; downloading is browser behaviour)
- Open browser DevTools, navigate to dashboard with empty data — verify Recharts `ResponsiveContainer` has explicit `minHeight: 288` (no `width(0) and height(0)` warnings)
- Sign out via `/admin/signout` to leave a clean session for downstream pages

### 11c — Console + Network

- Print last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md` (warnings OK); confirm 6 pre-existing Recharts warnings are GONE (RECON §8 carry-forward fix)
- Print network requests during filter change — verify only GET navigation to `/admin/dashboard?<params>` (no server action invocation; dashboard is read-only)

**Evidence to surface:**
- All six grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix); explicit `BORDER_L_4: 0`; explicit `BG_BLACK: 0`; explicit `RAW_TAILWIND_GRAY: 0`
- 4+ final screenshot files in `/redesign/screenshots/dashboard-owner-admin-redesign/`: `dashboard-owner-admin-final-{375,768,1280,1440}.png`
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — `/impeccable audit dashboard-owner-admin` + `/impeccable critique dashboard-owner-admin` + functional smoke test

### 12a — Audit
Invoke Skill with `/impeccable audit dashboard-owner-admin`.

**Severity rubric — anchor every finding before tagging (impeccable v5 L884-890):**
- **P0** Blocks release — fix before shipping anything
- **P1** Fix this sprint — significant impact on users
- **P2** Next cycle — noticeable but not blocking
- **P3** Polish — minor, fix when time allows

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## dashboard-owner-admin — audit`:
- 5 dimension scores
- P0/P1/P2/P3 findings, each on its own line
- Backend status: `N-A` (no BLOCKS-REDESIGN backend deps)
- **P1 (tag for Phase 7 gauntlet):** subsection — list each P1 finding with location + file:line; if zero, write `none`. Phase 7 `/impeccable audit admin` re-scans this section.
- **BUSINESS-COMPLETENESS impact:** subsection — name any `redesign/BUSINESS-COMPLETENESS.md` items this page newly contributes to (e.g. `2A-6` if form-level error `role="alert"` was implemented). Lets the universal flag flip `PARTIAL` → `HANDLED` when all form-bearing pages adopt.
- Confirm BASELINE-CRITIQUE P1/P2 carry-forwards resolved: `border-l-4` × 3, `bg-black`, avatar hexes, chart raw colors, density limit (no longer 6+ tiers visible at first paint)

**Print the appended section to chat.**

**If any P0 finding: emit `P0_FOUND:` followed by the list and STOP.** Do not proceed to handoff. The user will decide whether to fix-now or defer.

### 12b — Critique
Invoke Skill with `/impeccable critique dashboard-owner-admin`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## dashboard-owner-admin — critique`:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

**Print the appended section to chat.**

If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder dashboard-owner-admin` OR `/impeccable distill dashboard-owner-admin` based on which fits the verdict's reasoning, then re-run `/impeccable critique dashboard-owner-admin`. Loop max 2 times.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code:

- [ ] All 9 GET filter form `name` attributes present and POST-eligible: `range`, `from`, `to`, `city`, `service`, `staffId`, `source`, `status`, `paymentStatus`
- [ ] `getAdminPageAccess("dashboard")` gate working — page renders for Owner + Admin/PM
- [ ] `view_reports_revenue` gate on Payment Health tile — present for Owner + Admin/PM
- [ ] `manage_settings` / `manage_email_settings` gate on Operations Health tile
- [ ] IDs preserved: `id="admin-main"`, skip-link `<a href="#admin-main">`, `id="admin-command-search"`, `id="attention-dialog-title"`, SVG `<linearGradient id="demandGradient">`
- [ ] POST `/admin/signout` remains POST (never GET)
- [ ] GET `/admin/reports/export?…` carries current filter state
- [ ] Deep-link `/admin/dashboard?range=custom&from=2026-05-01&to=2026-05-15` is reachable
- [ ] No `border-l-4` anywhere across all 7 edited files
- [ ] No `bg-black` in `attention-group-client.tsx`
- [ ] Recharts `ResponsiveContainer` in `demand-trend-client.tsx` has `minHeight: 288`
- [ ] 12 avatar hex literals in `dashboard-cards.tsx` replaced with deterministic `oklch(85% 0.035 var(--avatar-hue))` utility
- [ ] Tier 2 disclosure `aria-expanded` toggles correctly; `localStorage` persists preference per user
- [ ] All date preset pills have `aria-current="page"` on active one
- [ ] All status badges have text label + icon (Named Status Rule)
- [ ] Heading hierarchy: H1 → H2 (Today / Attention / Business overview) → H3 (sub-tiles) — no skips

**Evidence to surface:**
- Both PER-PAGE-SCORES.md sections printed to chat (audit + critique)
- Functional smoke test checklist printed with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit/critique/smoke clean` and cat progress file

---

## Step 13 — Handoff (NO COMMIT — wait for user approval)

**Action:**
1. Run `git diff --stat` in the worktree — print to chat
2. Compare changed-files list against `/redesign/per-page-scope/dashboard-owner-admin-scope.md`. For any file changed that isn't in the scope file's "Files to edit" list: STOP and emit `SCOPE_VIOLATION: <file>`. Otherwise: `SCOPE_CLEAN: only scoped files changed`.
3. Run `git diff` (full) and confirm nothing unexpected appears — print the diff to chat in collapsible form.
4. Emit the handoff message to chat with:
   - Dev server URL: `http://localhost:3001/admin/dashboard`
   - All screenshot paths
   - Audit + critique key scores
   - Coordination note about `notification-bell.tsx` (shared with `00-shared-components`)
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
13. `## dashboard-owner-admin — audit` and `## dashboard-owner-admin — critique` headings appended (printed to chat from the file)
14. `SMOKE_TEST: all PASS`
15. `SCOPE_CLEAN: only scoped files changed`
16. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
