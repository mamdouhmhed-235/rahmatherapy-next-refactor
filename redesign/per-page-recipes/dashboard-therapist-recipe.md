# /goal recipe — page: dashboard-therapist (10 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/dashboard-therapist-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `dashboard-therapist` |
| Page row in IMPLEMENTATION-PLAN.md | row 10 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/dashboard-therapist-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (dashboard-therapist section) |
| Source files to edit | `src/app/admin/dashboard/TherapistDashboard.tsx`, `src/app/admin/dashboard/page.tsx` (therapist branch only — preserve routing), `src/app/admin/components/EmptyState.tsx` (only if a calendar illustration variant is missing — confirm first) |
| Logo asset (already present and tracked) | `public/images/brand/rahma/logo-refined.svg` |
| Worktree | this checkout — branch `agent/dashboard-therapist-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3001` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `N-A` — read-only surface; `TherapistDashboardProps` server contract from `dashboard-data.ts` is UNTOUCHABLE. Brief Open Questions 1 and 2 (tomorrow's first visit, client phone on `nextAppointment`) are flagged as potential follow-ups; default to documented empty-state fallback. |
| Progress scratchpad | `/redesign/per-page-progress/dashboard-therapist-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `src/app/admin/dashboard/dashboard-data.ts` — server-side aggregation, including the `assignedOnly` therapist filter at line 487. Any net-new prop (tomorrow's first visit, client phone on `nextAppointment`) is flagged as an Open Question, not silently added.
   - `src/app/admin/dashboard/dashboard-helpers.ts`
   - `src/app/admin/dashboard/dashboard-data.test.ts`, `dashboard-helpers.test.ts`
   - `src/app/admin/dashboard/dashboard-cards.tsx` — owned by Owner/Admin + Coordinator variants; the Therapist component does not render it
   - `src/app/admin/dashboard/dashboard-header.tsx` — owned by Owner/Admin + Coordinator variants
   - `src/app/admin/dashboard/dashboard-filters-client.tsx` — owned by Owner/Admin + Coordinator variants
   - `src/app/admin/dashboard/attention-group-client.tsx`, `demand-trend-client.tsx`, `notification-bell.tsx` — not rendered for Therapist
   - `src/app/admin/bookings/actions.ts` — claim and update-own-assignment-status mutations live on the booking detail page; the Therapist dashboard only links
   - `src/app/admin/shell-variant.ts`, `src/app/admin/access.ts`
   - `src/middleware.ts`
   - `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layer (RECON §5)
   - `supabase/migrations/**`
   - `src/components/ui/card.tsx` — out of scope here (fix lives in `00-shared-components` session)
   - All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.)
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve `TherapistDashboardProps` shape verbatim:** `staffName: string`, `today: string`, `data: ReportData`, `weekCount: number`, `todayAppointments: ReportData["bookings"]`, `nextAppointment: ReportData["bookings"][number] | null`. Do not add fields silently. If `tomorrowFirstAppointment` or `nextAppointmentPhone` are needed, flag for the Phase 6 owner.
6. **Preserve helpers verbatim:** `getGreeting()`, `getFirstName()`, `formatHours()`, `FORMATTERS` constants — do not replace.
7. **Preserve IDs and external link contracts:** `id="admin-main"` + skip-link, POST `/admin/signout` (in global top nav, not this surface), Google Maps deep-link `https://www.google.com/maps/search/?api=1&query=${address}` with `target="_blank"`, `tel:<phone>` link, and all `/admin/bookings/<id>` and `/admin/bookings?view=claimable` deep-links.

## STUCK clause

If you are genuinely blocked on any step (skill unavailable, brief contradicts codebase, server won't start, etc.) — **stop trying** and emit a literal line:

```
STUCK: <step number> — <specific, actionable reason>
```

Specifically: if you reach a point where the hero requires a new prop (`tomorrowFirstAppointment` or `nextAppointmentPhone`) and the existing `TherapistDashboardProps` doesn't expose it, emit `STUCK: <step> — props extension needed; <prop name> not on TherapistDashboardProps and dashboard-data.ts is untouchable. Falling back to documented empty state.` and PROCEED with the empty-state fallback rather than waiting.

The `/goal` evaluator will see this and end the loop cleanly.

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
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/dashboard-therapist-progress.md` and cat it.

---

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: dashboard-therapist
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/dashboard-therapist-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for dashboard-therapist)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/dashboard-therapist-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

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

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (dashboard-therapist) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
> - /redesign/briefs/dashboard-therapist-brief.md  ← THIS IS THE PREPARED BRIEF
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
> Write to `/redesign/per-page-scope/dashboard-therapist-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/dashboard-therapist-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first IS the primary canvas for this variant** — 375px is the design intent, desktop ≥1024px is just "phone layout, more comfortable line height" at max-width ~640px centred. Do NOT introduce multi-column desktop chrome. Build at 375 first, verify it reads, then scale comfort up.
>
> IMAGE HANDLING: confirm a calendar illustration variant exists in `EmptyState` per DESIGN.md §5 EmptyState taxonomy ("no bookings → calendar with check mark"). If missing, flag in `redesign/IMAGES-NEEDED.md` and either add the SVG asset to `public/images/admin/empty-states/` OR fall back to an icon-only `EmptyState` with a `calendar` Lucide. The CTA "Browse claimable work" is the BASELINE-CRITIQUE Casey #4 fix and must render regardless of illustration availability.
>
> BACKEND FAKE MARKER: this brief flags Open Question 1 (tomorrow's first visit fallback) and Open Question 2 (client phone on `nextAppointment`) as potentially missing from the server contract. Default behaviour: no new props; missing data falls back to documented empty state (hero "Nothing scheduled" + Browse-claimable CTA) for OQ1, and to "Open booking" routing only (no separate Call action) for OQ2.

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list
- `/redesign/per-page-scope/dashboard-therapist-scope.md` written; print its contents to chat
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- Append `step-3: COMPLETE — scope written, plan updated` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page dashboard-therapist`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page dashboard-therapist`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/dashboard-therapist-brief.md. Compare the current implementation to the brief's requirements (5 native sections + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3001 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-dashboard-therapist-redesign"
pnpm next dev -p 3001
```

Use `run_in_background: true`. Poll `http://localhost:3001/admin/dashboard` (signed in as Therapist) until it returns HTTP 200 (or 308 — that's a trailing-slash redirect which Playwright handles). Max wait: 60 seconds.

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

Sign in first as `test.therapist@rahmatherapy.example.test` / `TherapistTest123!` (the Therapist-variant dashboard requires this role). Then take screenshots and save to `/redesign/screenshots/dashboard-therapist-redesign/`:
- `chunk1-375-default.png` at 375×812 (the primary canvas — full content: greeting + Next Visit hero + Today's visits + Claimable strip + Weekly summary)
- `chunk1-375-empty-hero.png` at 375×812 (no upcoming today — Casey #4 fix empty state with "Browse claimable work" CTA)
- `chunk1-375-gender-required.png` at 375×812 (hero with gender-match chip visible)
- `chunk1-375-customer-notes.png` at 375×812 (hero with customer notes block expanded by default)
- `chunk1-375-claimable-scroll.png` at 375×812 (claimable horizontal-scroll strip with snap)
- `chunk1-768-default.png` at 768×1024 (date-range chips visible, comfortable line height)
- `chunk1-1024-default.png` at 1024×900 (centred max-width ~640px column, no multi-column chrome)
- `chunk1-1440-default.png` at 1440×900 (same centred single-column at comfortable line height)

Self-assess against the brief. If you can identify ONE specific axis problem:

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder dashboard-therapist` |
| Too loud, too many colours | `/impeccable quieter dashboard-therapist` |
| Grey, lifeless, no identity | `/impeccable colorize dashboard-therapist` |
| Fonts feel default or inconsistent | `/impeccable typeset dashboard-therapist` |
| Spacing is off, things feel cramped | `/impeccable layout dashboard-therapist` |
| Static, jumpy, no motion | `/impeccable animate dashboard-therapist` |
| Functional but cold | `/impeccable delight dashboard-therapist` |
| Too much on the page | `/impeccable distill dashboard-therapist` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

If a refine runs, re-screenshot with `-after-refine` suffix.

**Evidence to surface:**
- 8+ screenshot file paths printed to chat (`ls redesign/screenshots/dashboard-therapist-redesign/`)
- Literal decision: `ITERATE_DECISION: no refine needed — <brief-justified reason>` OR `ITERATE_DECISION: ran /impeccable <axis> dashboard-therapist because <reason>`
- Append `step-7: COMPLETE — iterate decision logged` and cat progress file

---

## Step 8 — `/impeccable adapt dashboard-therapist for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt dashboard-therapist for mobile and tablet`. Note: mobile IS the primary canvas for this variant; "adapt" here means verifying the desktop reads as a comfortable single-column upgrade, not introducing multi-column chrome.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/dashboard-therapist-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/dashboard-therapist-adapt-after-mobile.png`
3. Screenshot at 1440×900 → save to `/redesign/baseline/dashboard-therapist-adapt-after-desktop.png`
4. Confirm no horizontal scroll at any breakpoint (Playwright: check `document.documentElement.scrollWidth <= window.innerWidth`)
5. Confirm single-column layout at every breakpoint — NO multi-column desktop chrome
6. Confirm Next Visit hero "Open in Maps" + "Call client" Ghost buttons are 44px touch targets at 375
7. Confirm hero "Open booking" Primary is full-width and 44px at 375
8. Confirm date-range chip strip is OMITTED on mobile (<768px) and present at ≥768px
9. Confirm claimable horizontal snap-scroll works on mobile; converts to 3-card grid at ≥1024px
10. Confirm `prefers-reduced-motion: reduce` removes hover/focus transitions; snap-scroll layout preserved

**Evidence to surface:**
- Three `dashboard-therapist-adapt-after-*.png` paths printed
- Horizontal-scroll check result for all three viewports (`HORIZONTAL_SCROLL_MOBILE: false`, `HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_DESKTOP: false`)
- Touch-target heights at 375 (`TOUCH_TARGET_MAPS_MOBILE: <px>`, `TOUCH_TARGET_CALL_MOBILE: <px>`, `TOUCH_TARGET_OPEN_BOOKING_MOBILE: <px>`)
- DOM check for chip strip absence at 375 (`CHIP_STRIP_MOBILE_PRESENT: false`) and presence at 768 (`CHIP_STRIP_TABLET_PRESENT: true`)
- DOM check for single-column at 1440 (`MULTI_COLUMN_DESKTOP: false`)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden dashboard-therapist`

**Action:** Invoke Skill with `/impeccable harden dashboard-therapist`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-dashboard-therapist.md`. Implement what harden recommends per the brief's `## 6. Key States` section. Key states include: has next visit, only Next Visit today, zero visits today (Casey #4 fix), evening with today done (tomorrow eyebrow), gender required, claimable empty, claimable overflowing, loading, error, inactive (middleware-blocked), `staffName` empty fallback.

Verification edge cases (dashboard-therapist-specific):
- Greeting falls back to "Good morning." (no name) when `staffName` is somehow empty — graceful, flag in evidence
- Hero customer notes block: max-height 8em mobile / 12em desktop; "Show full notes" Ghost link appears ONLY when content overflows; wrapped in `<details open>`
- Hero `tel:` link degrades gracefully on desktop (no tel handler) — tooltip shows phone number, no error
- Cormorant Garamond appears EXACTLY ONCE on this page (the hero time at 1.778rem mobile / 2.369rem desktop)
- The Today's visits list section is HIDDEN entirely when the Next Visit is the only visit of the day
- The Casey #4 fix is in place: empty hero state has the `EmptyState` component with `Browse claimable work` Primary CTA → `/admin/bookings?view=claimable` (NOT the prior dashed-border 25%-of-screen empty state)
- Weekly summary tile uses `<dl>` description-list pattern, no Cormorant, no status family tint
- Hero time format: "11:45 · 60 min"
- Skeleton state: hero skeleton is ~280px tall to prevent reflow when data lands

**Evidence to surface:**
- `/redesign/HARDEN-RECS-dashboard-therapist.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-dashboard-therapist.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify dashboard-therapist`

**Action:** Invoke Skill with `/impeccable clarify dashboard-therapist`.

Verify copy matches the brief's `## Copy` section exactly (or has been tightened for layout — that's allowed). Specifically:
- H1: `Good morning, {first name}.` / `Good afternoon, {first name}.` / `Good evening, {first name}.` (time-of-day via existing `getGreeting()`)
- Subtitle: long-date format, e.g. `Tuesday 12 May`
- Hero eyebrow: `Next visit` (or `Tomorrow's first visit` / `First visit back`)
- Hero time format: `11:45 · 60 min`
- Hero gender chip: `Same-gender required` (Restricted family)
- Hero buttons: `Open in Maps` / `Call client` / `Open booking`
- Hero overflow customer notes: `Show full notes` (Ghost)
- Empty hero CTA: `Browse claimable work` (Primary) → `/admin/bookings?view=claimable` — this is the Casey #4 fix
- Today's visits H2: `Today's visits ({N})`
- Today's visits empty (after Next Visit): `No more visits today` heading / `That's all for today.` body
- Claimable H2: `Open to claim ({N})`
- Claimable card chip: `Available` (Attention family, never colour-only)
- Claimable card button: `View` (Ghost)
- Claimable overflow link (desktop): `See all {N} →`
- Claimable empty: `Nothing open right now` (inline, no illustration)
- Weekly summary H2: `This week`
- Weekly summary fresh week: heading `Week starting` / body `0 visits · 0h`
- Hero fully quiet day (no upcoming + no claimable): `Nothing scheduled` / `Quiet day. Take care of yourself.`
- Date-range chips (≥768px): `Today` / `Tomorrow` / `This week` / `Custom`
- Voice matches `PRODUCT.md` Brand Personality — verbs over nouns, personal pronouns ("Your day is clear"), encouraging empty states

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
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/dashboard/TherapistDashboard.tsx

# Raw oklch() literals (should be 0 — colors come from tokens)
grep -nE 'oklch\(' src/app/admin/dashboard/TherapistDashboard.tsx

# Raw px outside @media (allowed: tailwind arbitrary like `mt-[2px]` for icon alignment is borderline — flag, don't fail)
grep -nE '\[[0-9]+px\]' src/app/admin/dashboard/TherapistDashboard.tsx

# font-family literals (should be 0)
grep -nE "font-family:\s*['\"]" src/app/admin/dashboard/TherapistDashboard.tsx

# Forbidden `border-l-4` (claimable strip must use full-border + Attention bg tint)
grep -nE 'border-l-4' src/app/admin/dashboard/TherapistDashboard.tsx

# Cormorant Garamond usage — should appear EXACTLY once (the hero time)
grep -nE 'Cormorant|font-cormorant' src/app/admin/dashboard/TherapistDashboard.tsx

# Casey #4 fix marker — confirm the Browse-claimable CTA is wired
grep -nE 'Browse claimable work|/admin/bookings\?view=claimable' src/app/admin/dashboard/TherapistDashboard.tsx
```

For each match, confirm the value comes from a DESIGN.md token. If a hardcoded value isn't backed by a token, FIX IT. Particular attention to: hero gender chip MUST use `var(--status-restricted-bg)` / `var(--status-restricted-text)` tokens; claimable strip MUST use `var(--status-attention-bg)` / `var(--status-attention-text)` tokens. The Cormorant grep should return ONE site (the hero time component) — multiple sites means the brief's once-only constraint is violated.

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1024 → 1440)

- Sign in as `test.therapist@rahmatherapy.example.test` / `TherapistTest123!` then navigate to `/admin/dashboard` at each viewport
- Save final-state screenshots: `dashboard-therapist-final-{375,768,1024,1440}.png` to `/redesign/screenshots/dashboard-therapist-redesign/`
- Verify the greeting renders with the therapist's first name at all viewports
- Click "Open booking" Primary on the hero → verify navigation to `/admin/bookings/<id>`
- Click "Open in Maps" Ghost → verify `target="_blank"` to `https://www.google.com/maps/search/?api=1&query=...`
- On a mobile-emulated viewport, click "Call client" Ghost → verify the link href starts with `tel:` followed by the client phone (cannot actually trigger a call in test, but link contract is verifiable)
- Click a Today's visit row → verify navigation to `/admin/bookings/<id>`
- Click a Claimable card "View" Ghost → verify navigation to `/admin/bookings/<id>`
- Click the Weekly summary tile → verify navigation to `/admin/staff/<staffId>` (if `availability_mode` access granted)
- Navigate to a therapist account with zero visits today → verify the Casey #4 fix: hero shows `Nothing scheduled` empty state with Primary "Browse claimable work" CTA → click CTA → verify navigation to `/admin/bookings?view=claimable`; screenshot `dashboard-therapist-casey-fix.png`
- Sign out via `/admin/signout` to leave a clean session for downstream pages

### 11c — Console + Network

- Print last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md` (warnings OK)
- Print network requests during navigation — verify only GET navigations; no server action invocations from this surface

**Evidence to surface:**
- All seven grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix); explicit `BORDER_L_4: 0`; explicit `CORMORANT_COUNT: 1` (or list); explicit `CASEY_FIX_WIRED: yes` (the Browse-claimable CTA is present)
- 4+ final screenshot files in `/redesign/screenshots/dashboard-therapist-redesign/`: `dashboard-therapist-final-{375,768,1024,1440}.png` + `dashboard-therapist-casey-fix.png`
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — `/impeccable audit dashboard-therapist` + `/impeccable critique dashboard-therapist` + functional smoke test

### 12a — Audit
Invoke Skill with `/impeccable audit dashboard-therapist`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## dashboard-therapist — audit`:
- 5 dimension scores
- P0/P1/P2/P3 findings, each on its own line
- Backend status: `N-A` (OQ1 / OQ2 from brief flagged for separate follow-up; default fallback in place)
- Confirm BASELINE-CRITIQUE Casey #4 fix is resolved (Browse-claimable CTA wired)

**Print the appended section to chat.**

**If any P0 finding: emit `P0_FOUND:` followed by the list and STOP.** Do not proceed to handoff. The user will decide whether to fix-now or defer.

### 12b — Critique
Invoke Skill with `/impeccable critique dashboard-therapist`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## dashboard-therapist — critique`:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

**Print the appended section to chat.**

If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder dashboard-therapist` OR `/impeccable distill dashboard-therapist` based on which fits the verdict's reasoning, then re-run `/impeccable critique dashboard-therapist`. Loop max 2 times.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code:

- [ ] `TherapistDashboardProps` shape unchanged (`staffName`, `today`, `data`, `weekCount`, `todayAppointments`, `nextAppointment`) — verify by reading the file diff
- [ ] Helpers preserved verbatim: `getGreeting()`, `getFirstName()`, `formatHours()`, `FORMATTERS`
- [ ] `getAdminPageAccess("dashboard")` ≠ none for Therapist — page renders
- [ ] `view_reports_revenue` remains false — no revenue numbers anywhere on the page
- [ ] Middleware blocks inactive accounts at `/admin/login?reason=inactive` — this surface never renders for them
- [ ] IDs preserved: `id="admin-main"` + skip-link; `id="admin-command-search"` (in global top nav, not duplicated here)
- [ ] Google Maps deep-link `target="_blank"` to `https://www.google.com/maps/search/?api=1&query=${address}`
- [ ] `tel:<phone>` link present on hero when client phone available; graceful fallback on desktop
- [ ] All `/admin/bookings/<id>` deep-links resolve from Today rows, Claimable cards, and hero "Open booking" button
- [ ] `/admin/bookings?view=claimable` Casey #4 CTA wired
- [ ] `/admin/staff/<staffId>` self-link on Weekly summary tile (RBAC-gated)
- [ ] No `border-l-4` anywhere
- [ ] Cormorant Garamond appears exactly once (the hero time)
- [ ] Hero gender chip + claimable "Available" chip both have text label + icon (not colour-only)
- [ ] No multi-column desktop layout — single column at max-width ~640px centred at every viewport ≥1024px
- [ ] Single H1 (greeting); H2 for Today's visits / Open to claim / This week; no heading skips

**Evidence to surface:**
- Both PER-PAGE-SCORES.md sections printed to chat (audit + critique)
- Functional smoke test checklist printed with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit/critique/smoke clean` and cat progress file

---

## Step 13 — Handoff (NO COMMIT — wait for user approval)

**Action:**
1. Run `git diff --stat` in the worktree — print to chat
2. Compare changed-files list against `/redesign/per-page-scope/dashboard-therapist-scope.md`. For any file changed that isn't in the scope file's "Files to edit" list: STOP and emit `SCOPE_VIOLATION: <file>`. Otherwise: `SCOPE_CLEAN: only scoped files changed`.
3. Run `git diff` (full) and confirm nothing unexpected appears — print the diff to chat in collapsible form.
4. Emit the handoff message to chat with:
   - Dev server URL: `http://localhost:3001/admin/dashboard` (signed in as Therapist)
   - All screenshot paths
   - Audit + critique key scores
   - Casey #4 fix status (PASS — Browse-claimable CTA wired)
   - OQ1 / OQ2 status (tomorrow's first visit, client phone) — defaulted to empty-state fallback or, if data was available, wired
   - Calendar illustration availability (used existing asset / fell back to icon)
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
13. `## dashboard-therapist — audit` and `## dashboard-therapist — critique` headings appended (printed to chat from the file)
14. `SMOKE_TEST: all PASS`
15. `SCOPE_CLEAN: only scoped files changed`
16. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
