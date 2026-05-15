# /goal recipe — page: calendar (14 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/calendar-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `calendar` |
| Page row in IMPLEMENTATION-PLAN.md | row 14 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/calendar-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (calendar section) |
| Source files to edit | `src/app/admin/calendar/page.tsx` (+ existing `PrintButton.tsx` if a `print:hidden` adjustment is needed; otherwise leave untouched) |
| Worktree | this checkout — branch `agent/calendar-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3001` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `N-A` (calendar has no BLOCKS-REDESIGN backend dependencies; presentation-only redesign against existing `getReportData` + `parseReportFilters` contracts) |
| Progress scratchpad | `/redesign/per-page-progress/calendar-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `src/app/admin/reports/reporting.ts` (and any shared `getReportData` / `parseReportFilters` location) — RECON §5 untouchable; calendar reads from this contract
   - `src/lib/time/london/**` — `addBusinessDays`, `formatBusinessDate`, `getBusinessDate` (RECON §5)
   - `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layer (RECON §5)
   - `src/lib/auth/getAdminPageAccess.ts` (or wherever it lives) — `getAdminPageAccess(profile, "calendar")` admits all four active roles; do not touch
   - `src/middleware.ts` — admin route gating, unaffected
   - `src/components/ui/card.tsx` — out of scope for calendar (fix lives in `00-shared-components` session)
   - `BookingListCard` (the shared component from Brief 01) — REUSE verbatim, do not re-skin a calendar-specific card
   - All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.)
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve GET-form filter contract** verbatim: param names `view`, `date`, `staffId`, `paymentStatus`. No rename, no addition.
6. **Preserve `id="admin-main"` skip-link target** at the layout level.
7. **Preserve `window.print()` wiring** via the existing `PrintButton.tsx`.
8. **No new mutations from this page.** All assign / cancel actions hand off to `/admin/bookings/[id]`.

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
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `calendar` for page-specific entries
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; lines 510–550 for the calendar row

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
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/calendar-progress.md` and cat it.

---

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: calendar
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/calendar-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for calendar)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/calendar-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

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

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (calendar) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
> - /redesign/briefs/calendar-brief.md  ← THIS IS THE PREPARED BRIEF
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
> Write to `/redesign/per-page-scope/calendar-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/calendar-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1440.
>
> IMAGE HANDLING: brief §Recipe Context lists `calendar-empty.svg` (calendar-with-check illustration, ~80–120px) for the `EmptyState`. Append the row in `/redesign/IMAGES-NEEDED.md` and add a `data-redesign-needs-photo` placeholder on the empty-state element until the asset lands. Reference path: `/images/admin/empty-states/calendar-empty.svg` with `alt="No bookings scheduled"`.
>
> BACKEND FAKE MARKER: calendar has no FAKE-tagged backend features. Skip.

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list
- `/redesign/per-page-scope/calendar-scope.md` written; print its contents to chat
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- `IMAGES_NEEDED_DELTA: calendar-empty.svg appended` (literal line)
- Append `step-3: COMPLETE — scope written, plan updated, image flagged` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page calendar`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page calendar`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/calendar-brief.md. Compare the current implementation to the brief's requirements (11 native sections + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3001 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-calendar-redesign"
pnpm next dev -p 3001
```

Use `run_in_background: true`. Poll `http://localhost:3001/admin/calendar` until it returns HTTP 200 (or 308 — that's a trailing-slash redirect which Playwright handles). Max wait: 60 seconds.

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

Sign in first as `test.admin@rahmatherapy.example.test` / `AdminTest123!`. Then take screenshots and save to `/redesign/screenshots/calendar-redesign/`:
- `chunk1-1440-week.png` at 1440×900 (default — week view, today centred)
- `chunk1-1440-day.png` at 1440×900 navigating to `/admin/calendar?view=day&date=<today>`
- `chunk1-768-default.png` at 768×1024
- `chunk1-375-default.png` at 375×812 (sidebar should stack above day list per brief §5)
- `chunk1-1440-empty.png` at 1440×900 navigating to a known-empty date (`/admin/calendar?view=day&date=2025-12-25`)
- `chunk1-1440-print.png` at 1440×900 with `emulate_media({media: 'print'})` so the print stylesheet is exercised (nav / filter rail / sidebar hidden; `break-inside: avoid` per per-date panel)

Self-assess against the brief. If you can identify ONE specific axis problem:

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder calendar` |
| Too loud, too many colours | `/impeccable quieter calendar` |
| Grey, lifeless, no identity | `/impeccable colorize calendar` |
| Fonts feel default or inconsistent | `/impeccable typeset calendar` |
| Spacing is off, things feel cramped | `/impeccable layout calendar` |
| Static, jumpy, no motion | `/impeccable animate calendar` |
| Functional but cold | `/impeccable delight calendar` |
| Too much on the page | `/impeccable distill calendar` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

If a refine runs, re-screenshot with `-after-refine` suffix.

**Evidence to surface:**
- 5+ screenshot file paths printed to chat (`ls redesign/screenshots/calendar-redesign/`)
- Literal decision: `ITERATE_DECISION: no refine needed — <brief-justified reason>` OR `ITERATE_DECISION: ran /impeccable <axis> calendar because <reason>`
- Append `step-7: COMPLETE — iterate decision logged` and cat progress file

---

## Step 8 — `/impeccable adapt calendar for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt calendar for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/calendar-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/calendar-adapt-after-mobile.png`
3. Confirm no horizontal scroll at either breakpoint (Playwright: check `document.documentElement.scrollWidth <= window.innerWidth`)
4. Confirm date stepper chevrons, "Today" Ghost, Print Secondary, staff combobox, payment select, and Apply Secondary all meet 44px touch target on mobile
5. Confirm Unassigned sidebar collapses to stacked-above-list with Attention-tinted disclosure on `lg` and below per brief §3

**Evidence to surface:**
- Two `calendar-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target height for the date stepper chevrons on mobile (`TOUCH_TARGET_STEPPER_MOBILE: <px>`)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden calendar`

**Action:** Invoke Skill with `/impeccable harden calendar`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-calendar.md`. Implement what harden recommends (empty / loading / error / concurrent / print / permission-denied / overflow) per the brief's `## 6. Key States` section. For each state listed in the brief that harden didn't surface, add it anyway.

Verification edge cases (calendar-specific):
- Empty day in admin scope renders the `EmptyState` with `calendar-empty.svg` illustration and the "All quiet — no bookings in this range." copy + "Create a booking" Secondary CTA (role-gated)
- Concurrent bookings render with leading Attention "Concurrent" chip on each affected card + a `role="status" aria-live="polite"` banner above the day panel
- Print mode: nav, filter rail, sidebar hidden; per-date panels honour `break-inside: avoid`; chips render as outlines (not filled)
- Malformed `?date=` URL renders Pending-family banner: "That date doesn't look right. Showing today instead."
- Unknown `?staffId=` renders Pending-family banner: "That therapist isn't in your team. Showing everyone."
- Therapist scope: staff combobox replaced by "Your schedule" Soft Slate label; sidebar swapped from "Unassigned" → "Claimable today"
- Denied scope renders `AdminAccessDenied` with brief copy and NO raw `view_bookings_all or view_bookings_assigned` permission identifier

**Evidence to surface:**
- `/redesign/HARDEN-RECS-calendar.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-calendar.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify calendar`

**Action:** Invoke Skill with `/impeccable clarify calendar`.

Verify copy matches the brief's `## Copy` section exactly (or has been tightened for layout — that's allowed). Specifically:
- Page title "Calendar"; description "Daily and weekly operations agenda. Europe/London business dates."
- Sidebar title "Unassigned" (or "Claimable today" on Therapist) with numeric badge
- Sidebar empty (admin): "Every visit has a therapist."
- Sidebar empty (therapist): "No claimable visits match your profile right now."
- Main empty (admin/coordinator): "All quiet — no bookings in this range. Quiet days are healthy days." with Secondary "Create a booking"
- Main empty (therapist): "Nothing booked" + "No visits in this range." — no CTA (Therapists lack `create_bookings`)
- Concurrent banner: "{n} bookings overlap at {time}." (count-aware; singular: "Two bookings overlap at {time}.")
- Print sheet header: "Rahma Therapy — Operations sheet — {formatted date or range}"
- Denied: "Calendar access limited" + "You need booking visibility to view the operations calendar. Ask the practice owner to enable it." + "Back to dashboard" Secondary; NO raw permission identifier
- All tooltip text per brief Copy section
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
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/calendar/page.tsx

# Raw oklch() literals (should be 0 — colors come from tokens)
grep -nE 'oklch\(' src/app/admin/calendar/page.tsx

# Raw px outside @media (allowed: tailwind arbitrary like `mt-[2px]` for icon alignment is borderline — flag, don't fail)
grep -nE '\[[0-9]+px\]' src/app/admin/calendar/page.tsx

# font-family literals (should be 0)
grep -nE "font-family:\s*['\"]" src/app/admin/calendar/page.tsx

# Raw rahma token escapes (brief flags these for cleanup at lines 62/64/etc.)
grep -nE 'var\(--rahma-' src/app/admin/calendar/page.tsx

# Bare bg-white on inner card (brief flags line 135)
grep -nE 'bg-white\b' src/app/admin/calendar/page.tsx
```

For each match, confirm the value comes from a DESIGN.md token. If a hardcoded value isn't backed by a token, FIX IT — either add the token to DESIGN.md (only with user approval, otherwise STUCK) or replace with the existing token. The inner CalendarBooking card must use `bg-surface-card`, not `bg-white`.

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1440)

- Sign in as `test.admin@rahmatherapy.example.test` / `AdminTest123!`
- Navigate to `/admin/calendar` at each viewport
- Save final-state screenshots: `calendar-final-{375,768,1440}.png` to `/redesign/screenshots/calendar-redesign/`
- Click the date stepper "Next" chevron → URL `date=` increments; click "Today" → URL `date=` resets to today
- Toggle Day/Week segmented control → `?view=` updates; deep-link `/admin/calendar?view=day&date=2026-05-15&paymentStatus=paid` reloads with all filters applied
- Click a `BookingListCard` → navigates to `/admin/bookings/[id]`
- Click an Unassigned sidebar "Assign →" Ghost → navigates to `/admin/bookings/[id]?focus=assignment`
- Trigger print via `window.print()` or `emulate_media({media: 'print'})` → nav, filter rail, sidebar absent
- Sign out via `/admin/signout` to leave a clean session for downstream pages

### 11c — Console + Network

- Print last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md` (warnings OK)
- Print network requests during the view-toggle + date-step flow — verify same endpoints as `/redesign/RECON.md` baseline (GET `/admin/calendar?view=…&date=…&staffId=…&paymentStatus=…`)

**Evidence to surface:**
- All six grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix). `BG_WHITE_HITS: 0` literal line.
- 3 screenshot files in `/redesign/screenshots/calendar-redesign/`: `calendar-final-{375,768,1440}.png`
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — `/impeccable audit calendar` + `/impeccable critique calendar` + functional smoke test

### 12a — Audit
Invoke Skill with `/impeccable audit calendar`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## calendar — audit`:
- 5 dimension scores
- P0/P1/P2/P3 findings, each on its own line
- Backend status: `N-A` (calendar has no BLOCKS-REDESIGN backend deps; presentation-only redesign)

**Print the appended section to chat.**

**If any P0 finding: emit `P0_FOUND:` followed by the list and STOP.** Do not proceed to handoff. The user will decide whether to fix-now or defer.

### 12b — Critique
Invoke Skill with `/impeccable critique calendar`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## calendar — critique`:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

**Print the appended section to chat.**

If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder calendar` OR `/impeccable distill calendar` based on which fits the verdict's reasoning, then re-run `/impeccable critique calendar`. Loop max 2 times.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code (sign in as admin first):

- [ ] All four GET-form param names preserved: `view`, `date`, `staffId`, `paymentStatus`
- [ ] `BookingListCard` reused verbatim from Brief 01 (no calendar-specific variant); each card's whole-row anchor matches `BookingListCard` semantics
- [ ] Date stepper buttons preserve `view` and other filters; "Today" resets `date` only
- [ ] Date label opens React DayPicker popover (same import path as `/admin/bookings/new`)
- [ ] Keyboard: arrow-left / arrow-right on date stepper steps a day (day view) or week (week view) when focus is inside the stepper region
- [ ] Print: `window.print()` hides nav / filter rail / sidebar; per-date panels honour `break-inside: avoid`
- [ ] Role pass (sign-out + sign-in each): Owner, Admin, Coordinator see full surface (Coordinator's payment chip hides on cards because they lack `view_revenue`); Therapist sees narrowed data with "Your schedule" label + "Claimable today" sidebar; no `create_bookings` CTA in empty state for Therapist
- [ ] `AdminAccessDenied` no longer renders the raw `view_bookings_all or view_bookings_assigned` permission identifier
- [ ] Concurrent banner: `role="status" aria-live="polite"` reaches screen readers; week-view 7-day strip is keyboard-traversable

**Evidence to surface:**
- Both PER-PAGE-SCORES.md sections printed to chat (audit + critique)
- Functional smoke test checklist printed with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit/critique/smoke clean` and cat progress file

---

## Step 13 — Handoff (NO COMMIT — wait for user approval)

**Action:**
1. Run `git diff --stat` in the worktree — print to chat
2. Compare changed-files list against `/redesign/per-page-scope/calendar-scope.md`. For any file changed that isn't in the scope file's "Files to edit" list: STOP and emit `SCOPE_VIOLATION: <file>`. Otherwise: `SCOPE_CLEAN: only scoped files changed`.
3. Run `git diff` (full) and confirm nothing unexpected appears — print the diff to chat in collapsible form.
4. Emit the handoff message to chat with:
   - Dev server URL: `http://localhost:3001/admin/calendar`
   - All screenshot paths (including the print-emulated one)
   - Audit + critique key scores
   - IMAGES-NEEDED delta: `calendar-empty.svg` appended (with `data-redesign-needs-photo` placeholder pending)
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
6. `IMAGES_NEEDED_DELTA: calendar-empty.svg appended`
7. `CRAFT_COMPLETE`
8. `PAGE-POLISH-COMPLETE` (inside `<promise>` tags)
9. `DEV_SERVER_READY at http://localhost:3001`
10. `ITERATE_DECISION:`
11. `HORIZONTAL_SCROLL_TABLET: false` and `HORIZONTAL_SCROLL_MOBILE: false`
12. `TOKEN_DRIFT: 0` (or each drift explicitly addressed)
13. `BG_WHITE_HITS: 0`
14. `CONSOLE_NEW_ERRORS: 0`
15. `## calendar — audit` and `## calendar — critique` headings appended (printed to chat from the file)
16. `SMOKE_TEST: all PASS`
17. `SCOPE_CLEAN: only scoped files changed`
18. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
