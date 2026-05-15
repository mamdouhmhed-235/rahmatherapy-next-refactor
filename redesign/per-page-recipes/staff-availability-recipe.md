# /goal recipe — page: staff-availability (29 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/staff-availability-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `staff-availability` |
| Page row in IMPLEMENTATION-PLAN.md | row 29 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/staff-availability-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (staff-availability section) |
| Source files to edit | `src/app/admin/staff/[staffId]/availability/page.tsx`, `src/app/admin/staff/[staffId]/availability/AvailabilityModeSelector.tsx`, `src/app/admin/staff/[staffId]/availability/StaffAvailabilityRulesForm.tsx`, plus net-new client components `StaffBlockedDatesManager.tsx` and `StaffAvailabilityOverridesManager.tsx` (keep new files under `src/app/admin/staff/[staffId]/availability/`) |
| Worktree | this checkout — branch `agent/staff-availability-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3001` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `FAKE` — TWO BLOCKS-REDESIGN BUILD plans: `BUILD-staff-blocked-dates-actions.md` (Layer 0 row 12) and `BUILD-staff-availability-override-actions.md` (Layer 0 row 13). Until handled, Panel B / Panel C add + delete forms render but submitting either either no-ops or surfaces a server error toast. Flag `data-redesign-fake="staff-blocked-dates-actions"` on Panel B forms; `data-redesign-fake="staff-availability-override-actions"` on Panel C forms. Panel A (Weekly rules) uses the existing untouchable contract and is NOT fake. |
| RBAC scope | `manage_availability_global` OR (`isOwnProfile && manage_availability_own`). Owner / Admin (PM) reach via global path; Therapist on own profile only; Coordinator denied. Test creds vary; see Step 11 (verify with Owner + Therapist-on-own-profile). |
| Progress scratchpad | `/redesign/per-page-progress/staff-availability-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `staff_availability_rules` server-action contract (`StaffAvailabilityRulesForm`'s submit + add + delete) — RECON §5
   - `AvailabilityModeSelector`'s mode-update action contract — RECON §5
   - `staff_availability_rules`, `staff_blocked_dates`, `staff_availability_overrides` table schemas
   - Booking-engine read paths against all three tables
   - `src/middleware.ts`
   - `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layer (RECON §5); `manage_availability_global` OR `own && manage_availability_own` gate preserved
   - `src/components/ui/card.tsx` and other shared primitives — out of scope (fixes live in `00-shared-components` session)
   - All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.)
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve form `name` attributes:** existing weekly-rules form fields preserved verbatim (RECON §6.4). Net-new add/delete forms for blocked dates use named fields `staff_id`, `date`, `all_day`, `reason` (Panel B); for overrides use `staff_id`, `date`, `start_time`, `end_time`, `reason` (Panel C); deletes use `blocked_date_id` / `override_id`.
6. **Preserve the server action contract:** Panel A's existing `StaffAvailabilityRulesForm` submit/add/delete + the mode-update action keep their signatures. The four net-new actions (`addStaffBlockedDate`, `deleteStaffBlockedDate`, `addStaffAvailabilityOverride`, `deleteStaffAvailabilityOverride`) live on `src/app/admin/staff/[staffId]/availability/actions.ts` per brief §10 Q1, with `manage_availability_global OR (isOwnProfile && manage_availability_own)` permission checks inline. Until the BLOCKS-REDESIGN BUILD plans land, treat Panel B + C as FAKE and degrade gracefully.

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
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `staff-availability` for page-specific entries
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; lines 1081–1125 for the staff-availability row

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
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/staff-availability-progress.md` and cat it.

---

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: staff-availability
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/staff-availability-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for staff-availability)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/staff-availability-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

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

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (staff-availability) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
> - /redesign/briefs/staff-availability-brief.md  ← THIS IS THE PREPARED BRIEF
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
> Write to `/redesign/per-page-scope/staff-availability-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/staff-availability-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1440.
>
> IMAGE HANDLING: brief lists no net-new SVG (avatar uses the real-photo-or-initial-token pattern from Brief 26). If the staff member has no photo on disk, use the initialled Hover-Moss token.
>
> BACKEND FAKE MARKER: Panel B (Blocked dates) and Panel C (Availability overrides) depend on TWO BLOCKS-REDESIGN BUILD plans (`BUILD-staff-blocked-dates-actions.md`, `BUILD-staff-availability-override-actions.md`). Until handled, the inline add forms + per-row delete buttons render but submitting either either no-ops or surfaces a server error. Add `data-redesign-fake="staff-blocked-dates-actions"` on Panel B forms and `data-redesign-fake="staff-availability-override-actions"` on Panel C forms. Panel A (Weekly rules) is NOT fake.

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list
- `/redesign/per-page-scope/staff-availability-scope.md` written; print its contents to chat
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- Append `step-3: COMPLETE — scope written, plan updated` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page staff-availability`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page staff-availability`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/staff-availability-brief.md. Compare the current implementation to the brief's requirements (5 native sections + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3001 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-staff-availability-redesign"
pnpm next dev -p 3001
```

Use `run_in_background: true`. Poll `http://localhost:3001/admin/staff` (then click into a staff member to reach `/admin/staff/<staffId>/availability`) until it returns HTTP 200 (or 308). Max wait: 60 seconds. Resolve `<staffId>` by reading seed migrations or signing in as Owner and clicking through the staff directory.

**If node_modules junction is broken** (junction got removed or stale), fall back to:
```powershell
cmd /c mklink /J node_modules "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor\node_modules"
```

**Evidence to surface:**
- The HTTP status code from the readiness poll printed to chat
- The resolved `<staffId>` value printed: `RESOLVED_STAFF_ID: <id>`
- Literal line `DEV_SERVER_READY at http://localhost:3001`
- Append `step-6: COMPLETE — dev server on 3001` and cat progress file

---

## Step 7 — Step 2 iterate (screenshots + named-axis decision)

**Action:** Use the `playwright` MCP tool (NOT `chrome-devtools` — playwright handles redirects). Sign in first with the owner test account (Owner holds `manage_availability_global` always). For the therapist-on-own-profile variant in §11, the smoke test in Step 12 will swap to a therapist account.

Take screenshots and save to `/redesign/screenshots/staff-availability-redesign/`:
- `chunk1-1440-custom-mode.png` at 1440×900 (staff member in Custom hours mode, all three panels populated)
- `chunk1-1440-global-mode.png` at 1440×900 (staff member in Use-global mode — Panel A read-only with "Switch to custom hours" Ghost)
- `chunk1-1440-inactive-banner.png` at 1440×900 (an inactive staff member's availability page — Restricted-family banner above Panel A)
- `chunk1-768-default.png` at 768×1024
- `chunk1-375-default.png` at 375×812
- `chunk1-1440-mode-switch-modal.png` at 1440×900 with the Custom→Use-global `ConfirmActionModal` open

Self-assess against the brief. If you can identify ONE specific axis problem:

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder staff-availability` |
| Too loud, too many colours | `/impeccable quieter staff-availability` |
| Grey, lifeless, no identity | `/impeccable colorize staff-availability` |
| Fonts feel default or inconsistent | `/impeccable typeset staff-availability` |
| Spacing is off, things feel cramped | `/impeccable layout staff-availability` |
| Static, jumpy, no motion | `/impeccable animate staff-availability` |
| Functional but cold | `/impeccable delight staff-availability` |
| Too much on the page | `/impeccable distill staff-availability` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

If a refine runs, re-screenshot with `-after-refine` suffix.

**Evidence to surface:**
- 5+ screenshot file paths printed to chat (`ls redesign/screenshots/staff-availability-redesign/`)
- Literal decision: `ITERATE_DECISION: no refine needed — <brief-justified reason>` OR `ITERATE_DECISION: ran /impeccable <axis> staff-availability because <reason>`
- Append `step-7: COMPLETE — iterate decision logged` and cat progress file

---

## Step 8 — `/impeccable adapt staff-availability for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt staff-availability for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/staff-availability-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/staff-availability-adapt-after-mobile.png`
3. Confirm no horizontal scroll at either breakpoint (Playwright: check `document.documentElement.scrollWidth <= window.innerWidth`)
4. Confirm mode-selector segmented control + each panel's add-form submits are tappable without zoom on mobile (min 44px touch targets — check `getBoundingClientRect().height >= 44`)
5. Confirm mode-selector segmented control stacks above the explanatory sub-line on mobile per brief §5 Mobile
6. Confirm per-row trailing `Trash2` becomes inline below the row's centre column on `sm:` and below
7. Confirm inline add forms wrap into single-column field stacks; Secondary submit becomes full-width

**Evidence to surface:**
- Two `staff-availability-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target heights on mobile: `TOUCH_TARGET_MODE_SELECTOR_MOBILE: <px>`, `TOUCH_TARGET_ADD_CLOSURE_MOBILE: <px>`, `TOUCH_TARGET_ADD_OVERRIDE_MOBILE: <px>`
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden staff-availability`

**Action:** Invoke Skill with `/impeccable harden staff-availability`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-staff-availability.md`. Implement what harden recommends (empty / loading / error / permission-denied / overflow states) per the brief's `## 6. Key States` section. Pay particular attention to the Layer-3 backend error table at the bottom of brief §6 — there are EIGHT distinct backend error states (duplicate date, past date, permission-mismatch 403, start≥end, conflicting override, override on non-working day soft warning, network failure, etc.).

Verification edge cases (staff-availability-specific):
- A 60-row Past-closures `<details>` doesn't reflow active rows when expanded
- A `reason` with 200 characters on a blocked-date row wraps cleanly at 375px
- The Custom→Use-global `ConfirmActionModal` body fits at 375px
- The override "outside operating window" soft-warning Pending banner above submit doesn't break the form layout
- Therapist viewing another staff member's availability page sees the brief's variant denied copy with the "Open my availability" Secondary CTA

**Evidence to surface:**
- `/redesign/HARDEN-RECS-staff-availability.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-staff-availability.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify staff-availability`

**Action:** Invoke Skill with `/impeccable clarify staff-availability`.

Verify copy matches the brief's `## Copy` and `## 8. Content Requirements` sections exactly (or has been tightened for layout — that's allowed). Specifically:
- No `Submit` buttons remain → `Save hours`, `Add rule`, `Add closure`, `Add override`, `Use global hours` (Destructive in confirm), `Cancel`, `Remove`, `Keep it`, `Switch to custom hours`, `Back to staff directory`, `Open my availability`
- Mode pill copy verbatim: `Using global hours` (Pending) / `Custom hours` (Confirmed)
- Mode explanation copy verbatim from brief
- Inactive-staff banner verbatim: "This staff member is inactive. Availability edits won't take effect until they're reactivated."
- Panel A title: "Weekly working hours"; description: "The recurring pattern the booking engine uses every week."
- Panel B title: "Blocked dates"; description: "Days this staff member isn't available. Closures override the weekly pattern."
- Panel C title: "One-off overrides"; description: "Hours that replace the weekly pattern for a single date. Use this for extended Saturdays or a half-day clinic."
- Toast copy verbatim: `Working hours saved.` / `Closure added for {formatted date}.` / `Override added for {formatted date}.` / `Closure removed.` / `Override removed.` / `Now using {global|custom} hours.`
- Empty inline copy verbatim from brief
- Therapist self-view sub-line: "Your availability" (not "Availability")
- Denied screen reads "Availability access limited" with no raw `manage_availability_own or manage_availability_global` identifier
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
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/staff/\[staffId\]/availability/page.tsx src/app/admin/staff/\[staffId\]/availability/AvailabilityModeSelector.tsx src/app/admin/staff/\[staffId\]/availability/StaffAvailabilityRulesForm.tsx src/app/admin/staff/\[staffId\]/availability/StaffBlockedDatesManager.tsx src/app/admin/staff/\[staffId\]/availability/StaffAvailabilityOverridesManager.tsx

# Raw oklch() literals (should be 0)
grep -nE 'oklch\(' src/app/admin/staff/\[staffId\]/availability/page.tsx src/app/admin/staff/\[staffId\]/availability/AvailabilityModeSelector.tsx src/app/admin/staff/\[staffId\]/availability/StaffAvailabilityRulesForm.tsx src/app/admin/staff/\[staffId\]/availability/StaffBlockedDatesManager.tsx src/app/admin/staff/\[staffId\]/availability/StaffAvailabilityOverridesManager.tsx

# Raw px outside @media
grep -nE '\[[0-9]+px\]' src/app/admin/staff/\[staffId\]/availability/page.tsx src/app/admin/staff/\[staffId\]/availability/AvailabilityModeSelector.tsx src/app/admin/staff/\[staffId\]/availability/StaffAvailabilityRulesForm.tsx src/app/admin/staff/\[staffId\]/availability/StaffBlockedDatesManager.tsx src/app/admin/staff/\[staffId\]/availability/StaffAvailabilityOverridesManager.tsx

# font-family literals (should be 0)
grep -nE "font-family:\s*['\"]" src/app/admin/staff/\[staffId\]/availability/page.tsx src/app/admin/staff/\[staffId\]/availability/AvailabilityModeSelector.tsx src/app/admin/staff/\[staffId\]/availability/StaffAvailabilityRulesForm.tsx src/app/admin/staff/\[staffId\]/availability/StaffBlockedDatesManager.tsx src/app/admin/staff/\[staffId\]/availability/StaffAvailabilityOverridesManager.tsx

# Legacy rahma escapes (Phase-6 soft fix; brief §4 carry-forwards)
grep -nE 'var\(--rahma-' src/app/admin/staff/\[staffId\]/availability/page.tsx src/app/admin/staff/\[staffId\]/availability/AvailabilityModeSelector.tsx src/app/admin/staff/\[staffId\]/availability/StaffAvailabilityRulesForm.tsx src/app/admin/staff/\[staffId\]/availability/StaffBlockedDatesManager.tsx src/app/admin/staff/\[staffId\]/availability/StaffAvailabilityOverridesManager.tsx

# Tonal Lift carry-forwards (bg-white, shadow-soft, shadow-md on header card; border-2 border-white decorative ring on avatar; border-b-2 active-tab signal)
grep -nE 'bg-white|shadow-soft|shadow-md|border-2 border-white|border-b-2' src/app/admin/staff/\[staffId\]/availability/page.tsx
```

For each match, confirm the value comes from a DESIGN.md token. If a hardcoded value isn't backed by a token, FIX IT — either add the token to DESIGN.md (only with user approval, otherwise STUCK) or replace with the existing token. The active-tab indicator must be Clinic Green fill + Field White text, NOT the colour-only `border-b-2 border-[var(--rahma-green)]` (Sam #3 carry-forward).

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1440)

- Sign in first at `/admin/login` with owner credentials.
- Navigate to `/admin/staff/<staffId>/availability` (the staff id resolved in Step 6) at each viewport
- Save final-state screenshots: `staff-availability-final-{375,768,1440}.png` to `/redesign/screenshots/staff-availability-redesign/`
- Exercise the primary action on Panel A: with mode=Custom, toggle one weekday's working-day off, change another day's `end_time`, click `Save hours` → verify Sonner `Working hours saved.`
- Exercise the mode-switch flow: click "Use global hours" in the segmented control → `ConfirmActionModal` opens (Destructive Primary "Use global hours") → click Cancel; confirm mode does not change. Click again, confirm "Use global hours" → verify mode pill flips to Pending "Using global hours" and Panel A becomes read-only with "Switch to custom hours" Ghost inline
- Exercise Panel B (FAKE — surface check only): fill `date` in the inline add form, click `Add closure` → either the optimistic prepend happens + Sonner success (if BUILD plan landed) OR Sonner Cancelled toast with Retry (FAKE degrade). Take a screenshot of whichever path fires: `staff-availability-blocked-form.png`
- Exercise Panel C (FAKE — surface check only): fill `date` + `start_time` + `end_time`, click `Add override` → same FAKE degrade path. Screenshot: `staff-availability-override-form.png`
- Sign out via `/admin/signout` to leave a clean session for downstream pages

### 11c — Console + Network

- Print last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md` (warnings OK)
- Print network requests during the Panel A save + mode-switch flow — verify POSTs to the existing `StaffAvailabilityRulesForm` action + mode-update action

**Evidence to surface:**
- All grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix)
- Screenshot files in `/redesign/screenshots/staff-availability-redesign/`: `staff-availability-final-{375,768,1440}.png` + `staff-availability-blocked-form.png` + `staff-availability-override-form.png`
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — `/impeccable audit staff-availability` + `/impeccable critique staff-availability` + functional smoke test

### 12a — Audit
Invoke Skill with `/impeccable audit staff-availability`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## staff-availability — audit`:
- 5 dimension scores
- P0/P1/P2/P3 findings, each on its own line
- Backend status: `FAKE — BUILD-staff-blocked-dates-actions.md (BLOCKS-REDESIGN, Layer 0 row 12) + BUILD-staff-availability-override-actions.md (BLOCKS-REDESIGN, Layer 0 row 13)`

**Print the appended section to chat.**

**If any P0 finding: emit `P0_FOUND:` followed by the list and STOP.** Do not proceed to handoff.

### 12b — Critique
Invoke Skill with `/impeccable critique staff-availability`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## staff-availability — critique`:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

**Print the appended section to chat.**

If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder staff-availability` OR `/impeccable distill staff-availability` based on which fits the verdict's reasoning, then re-run `/impeccable critique staff-availability`. Loop max 2 times.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code:

- [ ] Three-manager stack: Weekly rules / Blocked dates / Availability overrides render in fixed order with H2 headings contiguous under page H1
- [ ] Sam #3 fix: active tab carries `aria-current="page"`; active state composition is Clinic Green fill + Field White text (NOT colour-only `border-b-2`)
- [ ] Decorative h-24 ivory banner + 96px avatar tile + nested tab nav retired; flat header with 40px avatar + H1 name + Soft Slate "Availability" sub-line present
- [ ] Mode selector: Use-global → Custom is one-click; Custom → Use-global gates through `ConfirmActionModal` with Destructive Primary
- [ ] Panel A (Weekly rules): existing `StaffAvailabilityRulesForm` submit/add/delete contracts intact; in global mode rows are read-only with inline "Switch to custom hours" Ghost
- [ ] Panel B (Blocked dates): inline add form posts to `addStaffBlockedDate` with `staff_id`, `date`, `all_day`, `reason`; per-row delete posts to `deleteStaffBlockedDate` with `blocked_date_id`; both gated by `ConfirmActionModal`
- [ ] Panel C (Overrides): inline add form posts to `addStaffAvailabilityOverride` with `staff_id`, `date`, `start_time`, `end_time`, `reason`; per-row delete posts to `deleteStaffAvailabilityOverride` with `override_id`
- [ ] Sort: both Panel B + Panel C ascend by date; past entries inside collapsed `<details>` "Past closures ({n})" / "Past overrides ({n})"
- [ ] Inactive-staff banner Restricted-family pinned above mode selector when `staff.active === false`
- [ ] Net-new add forms wrap errors in `role="alert" aria-live="polite" aria-atomic="true"`; required `*` markers in Cancelled text colour
- [ ] Therapist on own profile: sub-line reads "Your availability"; full editor enabled
- [ ] Therapist on another staff profile: denied state with "Open my availability" Secondary → `/admin/staff/<own_id>/availability`
- [ ] `AdminAccessDenied` does NOT render the raw `manage_availability_own or manage_availability_global` permission identifier

**Evidence to surface:**
- Both PER-PAGE-SCORES.md sections printed to chat (audit + critique)
- Functional smoke test checklist printed with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit/critique/smoke clean` and cat progress file

---

## Step 13 — Handoff (NO COMMIT — wait for user approval)

**Action:**
1. Run `git diff --stat` in the worktree — print to chat
2. Compare changed-files list against `/redesign/per-page-scope/staff-availability-scope.md`. For any file changed that isn't in the scope file's "Files to edit" list: STOP and emit `SCOPE_VIOLATION: <file>`. Otherwise: `SCOPE_CLEAN: only scoped files changed`.
3. Run `git diff` (full) and confirm nothing unexpected appears — print the diff to chat in collapsible form.
4. Emit the handoff message to chat with:
   - Dev server URL: `http://localhost:3001/admin/staff/<staffId>/availability`
   - All screenshot paths
   - Audit + critique key scores
   - Backend FAKE flags: Panel B + Panel C still depend on `BUILD-staff-blocked-dates-actions.md` and `BUILD-staff-availability-override-actions.md` (both BLOCKS-REDESIGN)
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
13. `## staff-availability — audit` and `## staff-availability — critique` headings appended (printed to chat from the file)
14. `SMOKE_TEST: all PASS`
15. `SCOPE_CLEAN: only scoped files changed`
16. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
