# /goal recipe — page: availability (13 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/availability-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `availability` |
| Page row in IMPLEMENTATION-PLAN.md | row 13 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/availability-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (availability section) |
| Source files to edit | `src/app/admin/availability/page.tsx`, `src/app/admin/availability/AvailabilityRulesManager.tsx`, `src/app/admin/availability/BlockedDatesManager.tsx`, `src/app/admin/availability/AvailabilityOverridesManager.tsx` |
| Worktree | this checkout — branch `agent/availability-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3001` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `N-A` (availability has no BLOCKS-REDESIGN backend dependencies; `BUILD-availability-this-week-chip.md` listed as **non-blocking** in IMPLEMENTATION-PLAN footer) |
| Progress scratchpad | `/redesign/per-page-progress/availability-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `src/app/admin/availability/actions.ts` — `saveAvailabilityRule`, `deleteAvailabilityRule`, `createBlockedDate`, `deleteBlockedDate`, `createAvailabilityOverride`, `deleteAvailabilityOverride` (RECON §5 untouchable)
   - `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layer (RECON §5)
   - `src/middleware.ts` — admin route gating, unaffected
   - `supabase/migrations/**` — `availability_rules`, `blocked_dates`, `availability_overrides` schema preserved
   - `src/components/ui/card.tsx` — out of scope for availability (fix lives in `00-shared-components` session)
   - All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.)
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve form field `name` attributes** verbatim:
   - Rules: `rule_id`, `day_of_week`, `start_time`, `end_time`, `is_working_day`
   - Blocked dates: `blocked_date`, `reason`
   - Overrides: `override_date`, `start_time`, `end_time`, `reason`
6. **Preserve the server-action contract:** each manager calls its own `src/app/admin/availability/actions.ts` action via `<form action={…}>`. No `fetch` / no `XHR` replacement.
7. **Preserve `revalidatePath('/admin/availability')` behaviour** — capacity preview is a Server Component and must refresh after each mutation.
8. **Preserve audit-log writes** for: `availability_rule_created`, `availability_rule_updated`, `availability_rule_deleted`, `blocked_date_created`, `blocked_date_deleted`, `availability_override_upserted`, `availability_override_deleted`.

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

…and stop. (This is the first-page test run; cap will be raised once we trust the path.)

## Oversize file handling

When `Read` returns "File content (N tokens) exceeds maximum allowed tokens (25000)", DO NOT retry the full read. Use `offset` + `limit`, or use `Grep`.

Known oversize files relevant to this recipe:
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `availability` for page-specific entries
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; lines 473–510 for the availability row

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
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/availability-progress.md` and cat it.

---

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: availability
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/availability-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for availability)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/availability-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

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

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (availability) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
> - /redesign/briefs/availability-brief.md  ← THIS IS THE PREPARED BRIEF
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
> Write to `/redesign/per-page-scope/availability-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/availability-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1440.
>
> IMAGE HANDLING: availability is fields-and-grid only. No new illustrations needed. Do NOT add `data-redesign-needs-photo`.
>
> BACKEND FAKE MARKER: availability has no BLOCKS-REDESIGN backend dependencies (the "this-week chip" BUILD plan is non-blocking; the feature degrades gracefully without it).

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list
- `/redesign/per-page-scope/availability-scope.md` written; print its contents to chat
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- Append `step-3: COMPLETE — scope written, plan updated` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page availability`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page availability`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/availability-brief.md. Compare the current implementation to the brief's requirements (10 native sections + Role variants + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3001 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-availability-redesign"
pnpm next dev -p 3001
```

Use `run_in_background: true`. Poll `http://localhost:3001/admin/availability` until it returns HTTP 200 (or 308 — that's a trailing-slash redirect which Playwright handles). Max wait: 60 seconds.

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

Sign in first as `test.admin@rahmatherapy.example.test` / `AdminTest123!` (Owner/Admin has `manage_availability_global`). Then take screenshots and save to `/redesign/screenshots/availability-redesign/`:
- `chunk1-1440-default.png` at 1440×900 (desktop: capacity preview + all three stacked managers)
- `chunk1-768-default.png` at 768×1024 (still stacked — brief sets tab strip at <768px)
- `chunk1-375-default-hours.png` at 375×812 (mobile: capacity preview + tab strip, Hours active)
- `chunk1-375-closed-dates.png` at 375×812 (mobile: tap "Closed dates" tab)
- `chunk1-375-adjustments.png` at 375×812 (mobile: tap "Adjustments" tab)
- `chunk1-1440-toggle-off.png` at 1440×900 (capture a working-hours row with day toggled off — Restricted tint, no time inputs)

Self-assess against the brief. If you can identify ONE specific axis problem:

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder availability` |
| Too loud, too many colours | `/impeccable quieter availability` |
| Grey, lifeless, no identity | `/impeccable colorize availability` |
| Fonts feel default or inconsistent | `/impeccable typeset availability` |
| Spacing is off, things feel cramped | `/impeccable layout availability` |
| Static, jumpy, no motion | `/impeccable animate availability` |
| Functional but cold | `/impeccable delight availability` |
| Too much on the page | `/impeccable distill availability` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

If a refine runs, re-screenshot with `-after-refine` suffix.

**Evidence to surface:**
- 5+ screenshot file paths printed to chat (`ls redesign/screenshots/availability-redesign/`)
- Literal decision: `ITERATE_DECISION: no refine needed — <brief-justified reason>` OR `ITERATE_DECISION: ran /impeccable <axis> availability because <reason>`
- Append `step-7: COMPLETE — iterate decision logged` and cat progress file

---

## Step 8 — `/impeccable adapt availability for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt availability for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/availability-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/availability-adapt-after-mobile.png`
3. Confirm no horizontal scroll at either breakpoint (Playwright: check `document.documentElement.scrollWidth <= window.innerWidth`). The 7-day strip in the capacity preview is allowed to scroll on mobile (per brief §5 "horizontally scrollable strip with momentum scroll") — that's an internal `overflow-x: auto` element, NOT a document-level scroll
4. Confirm switch toggles, time inputs, "Save hours", "Add closed date", "Add adjustment", and trash buttons all meet 44px touch target on mobile
5. Confirm mobile tab strip (Hours / Closed dates / Adjustments) renders below the capacity preview and toggles correctly

**Evidence to surface:**
- Two `availability-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target heights for Save hours + Add closed date buttons on mobile (`TOUCH_TARGET_SAVE_HOURS_MOBILE: <px>`, `TOUCH_TARGET_ADD_CLOSED_DATE_MOBILE: <px>`)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden availability`

**Action:** Invoke Skill with `/impeccable harden availability`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-availability.md`. Implement what harden recommends (empty / loading / error / permission-denied / overflow / conflicting-date validation) per the brief's `## 6. Key States` section. For each state listed in the brief that harden didn't surface, add it anyway.

Verification edge cases (availability-specific):
- Working day toggled on with end_time before start_time shows "End time has to be after start time." in Cancelled text
- Duplicate `blocked_date` shows "That date is already closed. Edit or delete the existing entry."
- Override on a non-working day shows "That day is closed in the weekly schedule. Open it in Working hours before adding an adjustment."
- Date in the past shows "Pick a date from today onwards."
- Working-day toggle off → time inputs collapse with 160ms ease-gentle; row background shifts to `status-restricted-bg`
- Working-day toggle on → time inputs reveal with 160ms; row background shifts to `surface-selected`
- Capacity preview refreshes after each mutation via `revalidatePath` (no manual reload required)
- Therapist scope denied state renders the specific "Global availability settings are managed by the owner or practice manager." copy with "My availability" Secondary link to `/admin/staff/{ownStaffId}/availability` (NOT the generic denied copy)

**Evidence to surface:**
- `/redesign/HARDEN-RECS-availability.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-availability.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify availability`

**Action:** Invoke Skill with `/impeccable clarify availability`.

Verify copy matches the brief's `## Copy` section exactly (or has been tightened for layout — that's allowed). Specifically:
- Page H1 "Availability"; section H2s "This week's capacity" / "Working hours" / "Closed dates" / "Hour adjustments"
- Mobile tab labels: "Hours" / "Closed dates" / "Adjustments"
- Capacity pill labels: "Male: {n}" / "Female: {n}" (Confirmed family)
- This-week signal chips: "1 closure this week" / "{n} closures this week" / "1 adjustment this week" / "{n} adjustments this week" (Pending family)
- Mode badges: "Global schedule" (Confirmed) / "Custom schedule" (Pending)
- Save button: "Save hours" (Primary)
- Add buttons: "Add closed date" / "Add adjustment" (Primary)
- Confirm modal — Closed date: "Remove this closed date?" / "The clinic will show as available on {date}. Existing bookings on that day stay put." / Destructive "Remove" + Secondary "Keep it"
- Confirm modal — Override: "Remove this hour adjustment?" / "The clinic will use its standard hours on {date} again." / "Remove" + "Keep it"
- Empty states per brief Copy table verbatim
- Coordinator denied: generic "You don't have access to this section" + "Availability settings are managed by the owner or practice manager."
- Therapist denied: specific "This section is for the practice owner" + "Your working hours are on your availability page." + "My availability" Secondary
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
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/availability/page.tsx src/app/admin/availability/AvailabilityRulesManager.tsx src/app/admin/availability/BlockedDatesManager.tsx src/app/admin/availability/AvailabilityOverridesManager.tsx

# Raw oklch() literals (should be 0 — colors come from tokens)
grep -nE 'oklch\(' src/app/admin/availability/page.tsx src/app/admin/availability/AvailabilityRulesManager.tsx src/app/admin/availability/BlockedDatesManager.tsx src/app/admin/availability/AvailabilityOverridesManager.tsx

# Raw px values outside @media queries (canon: should be 0 outside @media rules)
grep -nE '\\d+px' src/app/admin/availability/page.tsx src/app/admin/availability/AvailabilityRulesManager.tsx src/app/admin/availability/BlockedDatesManager.tsx src/app/admin/availability/AvailabilityOverridesManager.tsx

# font-family literals (should be 0)
grep -nE "font-family:\s*['\"]" src/app/admin/availability/page.tsx src/app/admin/availability/AvailabilityRulesManager.tsx src/app/admin/availability/BlockedDatesManager.tsx src/app/admin/availability/AvailabilityOverridesManager.tsx

# Raw spacing literals (canon: should match the spacing scale in DESIGN.md)
grep -nE '(margin\|padding):\s*\d' src/app/admin/availability/page.tsx src/app/admin/availability/AvailabilityRulesManager.tsx src/app/admin/availability/BlockedDatesManager.tsx src/app/admin/availability/AvailabilityOverridesManager.tsx

# `border-l-4` accent stripes (brief §Implementation Notes audit: must be zero on any working-hours, closed-date, or override row)
grep -nE 'border-l-4' src/app/admin/availability/*.tsx
```

For each match, confirm the value comes from a DESIGN.md token. If a hardcoded value isn't backed by a token, FIX IT — either add the token to DESIGN.md (only with user approval, otherwise STUCK) or replace with the existing token.

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1440)

- Sign in as `test.admin@rahmatherapy.example.test` / `AdminTest123!`
- Navigate to `/admin/availability` at each viewport
- Save final-state screenshots: `availability-final-{375,768,1440}.png` to `/redesign/screenshots/availability-redesign/`
- Toggle Monday's working-hours switch off → time inputs collapse with 160ms ease-gentle; row background shifts to `status-restricted-bg`. Toggle back on → time inputs reveal; row tints to `surface-selected`. Click "Save hours" → toast "Working hours saved." appears; capacity preview 7-day strip refreshes
- Add a closed date (date 2 weeks in the future + reason "Eid al-Fitr" + "Add closed date") → row appears in list; form resets; if date is in current week, the "1 closure this week" chip appears in the capacity preview header
- Click the `trash-2` Ghost on a closed-date row → `ConfirmActionModal` opens with "Remove this closed date?" copy; click "Remove" → row removed
- At 375px: tap "Closed dates" tab → closed-dates manager visible, Hours manager hidden; tap "Hours" → reverse
- Sign out via `/admin/signout` to leave a clean session for downstream pages

### 11c — Console + Network

- Print last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md` (warnings OK)
- Print network requests during a working-hours save + a blocked-date add + a delete — verify same endpoints as `/redesign/RECON.md` baseline (POST to each server action; revalidation tick on GET `/admin/availability`)

**Evidence to surface:**
- All five grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix). `BORDER_L4_HITS: 0` literal line.
- 3 screenshot files in `/redesign/screenshots/availability-redesign/`: `availability-final-{375,768,1440}.png`
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — `/impeccable audit availability` + `/impeccable critique availability` + functional smoke test

### 12a — Audit
Invoke Skill with `/impeccable audit availability`.

**Severity rubric — anchor every finding before tagging (impeccable v5 L884-890):**
- **P0** Blocks release — fix before shipping anything
- **P1** Fix this sprint — significant impact on users
- **P2** Next cycle — noticeable but not blocking
- **P3** Polish — minor, fix when time allows

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## availability — audit`:
- 5 dimension scores
- P0/P1/P2/P3 findings, each on its own line
- Backend status: `N-A` (availability has no BLOCKS-REDESIGN backend deps; this-week-chip BUILD plan is non-blocking)
- **P1 (tag for Phase 7 gauntlet):** subsection — list each P1 finding with location + file:line; if zero, write `none`. Phase 7 `/impeccable audit admin` re-scans this section.
- **BUSINESS-COMPLETENESS impact:** subsection — name any `redesign/BUSINESS-COMPLETENESS.md` items this page newly contributes to (e.g. `2A-6` if form-level error `role="alert"` was implemented). Lets the universal flag flip `PARTIAL` → `HANDLED` when all form-bearing pages adopt.

**Print the appended section to chat.**

**If any P0 finding: emit `P0_FOUND:` followed by the list and STOP.** Do not proceed to handoff. The user will decide whether to fix-now or defer.

### 12b — Critique
Invoke Skill with `/impeccable critique availability`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## availability — critique`:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

**Print the appended section to chat.**

If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder availability` OR `/impeccable distill availability` based on which fits the verdict's reasoning, then re-run `/impeccable critique availability`. Loop max 2 times.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code (sign in as admin first):

- [ ] All form field `name` attributes preserved: `rule_id`, `day_of_week`, `start_time`, `end_time`, `is_working_day` on rules; `blocked_date`, `reason` on blocked dates; `override_date`, `start_time`, `end_time`, `reason` on overrides
- [ ] All six server actions wire to the correct UI controls: `saveAvailabilityRule` → "Save hours"; `createBlockedDate` → blocked-date "Add"; `deleteBlockedDate` → blocked-date `trash-2` confirm; `createAvailabilityOverride` → override "Add"; `deleteAvailabilityOverride` → override `trash-2` confirm; `deleteAvailabilityRule` → working-hours individual rule delete (if surfaced)
- [ ] Audit-log writes fire (verify via `/admin/audit` after each mutation): `availability_rule_created/updated/deleted`, `blocked_date_created/deleted`, `availability_override_upserted/deleted`
- [ ] Capacity preview is a Server Component and updates after `revalidatePath('/admin/availability')` (confirmed by 7-day strip reflecting changed hours without manual reload)
- [ ] Switch toggle accessible name reads `{Day}, open` (e.g. `Monday, open`)
- [ ] Required date inputs marked with `<span aria-hidden="true">*</span>`
- [ ] All error regions use `role="alert" aria-live="polite" aria-atomic="true"`
- [ ] Role pass (sign-out + sign-in each): Owner sees full surface; Admin/PM same; Coordinator (`test.coordinator@…`) hits generic denied; Therapist (`test.therapist@…`) hits therapist-specific denied with "My availability" link
- [ ] No `border-l-4` on any working-hours, closed-date, or override row (brief audit requirement)

**Evidence to surface:**
- Both PER-PAGE-SCORES.md sections printed to chat (audit + critique)
- Functional smoke test checklist printed with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit/critique/smoke clean` and cat progress file

---

## Step 13 — Handoff (NO COMMIT — wait for user approval)

**Action:**
1. Run `git diff --stat` in the worktree — print to chat
2. Compare changed-files list against `/redesign/per-page-scope/availability-scope.md`. For any file changed that isn't in the scope file's "Files to edit" list: STOP and emit `SCOPE_VIOLATION: <file>`. Otherwise: `SCOPE_CLEAN: only scoped files changed`.
3. Run `git diff` (full) and confirm nothing unexpected appears — print the diff to chat in collapsible form.
4. Emit the handoff message to chat with:
   - Dev server URL: `http://localhost:3001/admin/availability`
   - All screenshot paths
   - Audit + critique key scores
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
12. `BORDER_L4_HITS: 0`
13. `CONSOLE_NEW_ERRORS: 0`
14. `## availability — audit` and `## availability — critique` headings appended (printed to chat from the file)
15. `SMOKE_TEST: all PASS`
16. `SCOPE_CLEAN: only scoped files changed`
17. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
