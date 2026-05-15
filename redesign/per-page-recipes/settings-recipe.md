# /goal recipe — page: settings (17 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/settings-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `settings` |
| Page row in IMPLEMENTATION-PLAN.md | row 17 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/settings-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (settings section) |
| Source files to edit | `src/app/admin/settings/page.tsx`, `src/app/admin/settings/SettingsForm.tsx` |
| Worktree | this checkout — branch `agent/settings-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3001` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `N-A` (settings has no BLOCKS-REDESIGN backend dependencies; `BUILD-settings-last-changed-by.md` listed as **non-blocking** — last-changed-by sub-line omits silently when audit row absent) |
| Progress scratchpad | `/redesign/per-page-progress/settings-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `src/app/admin/settings/actions.ts` — `updateBusinessSettings` server action; full form contract preserved (RECON §5 untouchable; §6.4 preserved field names)
   - `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layer (RECON §5)
   - `src/middleware.ts` — admin route gating, unaffected
   - `supabase/migrations/**` — `business_settings.id = 1` singleton row contract preserved
   - `src/components/ui/card.tsx` — out of scope for settings (fix lives in `00-shared-components` session; brief explicitly replaces shadcn `Card`/`CardTitle` here with `AdminPanel`/`AdminPanelHeader` to resolve Sam #1 heading skip)
   - All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.)
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve form field `name` attributes** verbatim: `company_name`, `contact_phone`, `contact_email`, `booking_window_days`, `minimum_notice_hours`, `buffer_time_mins`, `customer_cancellation_cutoff_hours`, `allowed_cities`, `booking_status_enabled`.
6. **Preserve the `allowed_cities` server contract:** the new chip input must still serialise to a newline-delimited hidden `<input name="allowed_cities">` so the existing server action reads unchanged.
7. **Preserve the `updateBusinessSettings` form-submit shape:** the existing `handleSubmit` uses `event.preventDefault()` + manual `FormData` + `startTransition` (NOT `useActionState`). Keep this exactly; RECON §5 untouchable form-submit shape.
8. **Preserve `business_settings.id = 1` singleton row contract** and `fallbackSettings` shape for first-load empty state.

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
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `settings` for page-specific entries
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; lines 622–665 for the settings row

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
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/settings-progress.md` and cat it.

---

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: settings
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/settings-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for settings)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/settings-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

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

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (settings) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
> - /redesign/briefs/settings-brief.md  ← THIS IS THE PREPARED BRIEF
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
> Write to `/redesign/per-page-scope/settings-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/settings-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1440.
>
> IMAGE HANDLING: settings is fields-only. No new illustrations needed. Do NOT add `data-redesign-needs-photo`.
>
> BACKEND FAKE MARKER: settings has no BLOCKS-REDESIGN backend dependencies. The "Last changed by …" sub-line depends on `BUILD-settings-last-changed-by.md` which is **non-blocking** — render the sub-line when an audit row is reachable, omit silently otherwise (brief §6 explicitly accepts this graceful degradation). Do NOT mark any surface `data-redesign-backend="FAKE"`.

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list
- `/redesign/per-page-scope/settings-scope.md` written; print its contents to chat
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- Append `step-3: COMPLETE — scope written, plan updated` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page settings`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page settings`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase. Particular care: drop the inner `SettingsGroup` H3 wrapper; each former group becomes its own `AdminPanel` with H2 title (resolves Sam #1 heading skip per BASELINE-CRITIQUE).

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/settings-brief.md. Compare the current implementation to the brief's requirements (11 native sections + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3001 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-settings-redesign"
pnpm next dev -p 3001
```

Use `run_in_background: true`. Poll `http://localhost:3001/admin/settings` until it returns HTTP 200 (or 308 — that's a trailing-slash redirect which Playwright handles). Max wait: 60 seconds.

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

This page is Owner-only. Sign in first as `test.owner@rahmatherapy.example.test` / `OwnerTest123!` (or whichever credential holds `MANAGE_SETTINGS`; if `test.admin@…` does NOT hold the permission per the RBAC seed, you must use the owner credential). Then take screenshots and save to `/redesign/screenshots/settings-redesign/`:
- `chunk1-1440-default.png` at 1440×900 — full page with all four panels rendered
- `chunk1-1440-intake-off.png` at 1440×900 — Panel 1 in the "Intake paused" Restricted-family state (toggle the switch off, confirm the modal, capture the new banner state)
- `chunk1-768-default.png` at 768×1024
- `chunk1-375-default.png` at 375×812 (mobile: single-column panels, sticky save bar full-width)
- `chunk1-1440-pause-modal.png` at 1440×900 — the `ConfirmActionModal` open with "Pause new bookings?" copy
- `chunk1-1440-dirty.png` at 1440×900 — form in dirty state (edit a numeric field), "Discard changes" Ghost visible in the save bar

Self-assess against the brief. If you can identify ONE specific axis problem:

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder settings` |
| Too loud, too many colours | `/impeccable quieter settings` |
| Grey, lifeless, no identity | `/impeccable colorize settings` |
| Fonts feel default or inconsistent | `/impeccable typeset settings` |
| Spacing is off, things feel cramped | `/impeccable layout settings` |
| Static, jumpy, no motion | `/impeccable animate settings` |
| Functional but cold | `/impeccable delight settings` |
| Too much on the page | `/impeccable distill settings` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

If a refine runs, re-screenshot with `-after-refine` suffix.

**Evidence to surface:**
- 5+ screenshot file paths printed to chat (`ls redesign/screenshots/settings-redesign/`)
- Literal decision: `ITERATE_DECISION: no refine needed — <brief-justified reason>` OR `ITERATE_DECISION: ran /impeccable <axis> settings because <reason>`
- Append `step-7: COMPLETE — iterate decision logged` and cat progress file

---

## Step 8 — `/impeccable adapt settings for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt settings for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/settings-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/settings-adapt-after-mobile.png`
3. Confirm no horizontal scroll at either breakpoint (Playwright: check `document.documentElement.scrollWidth <= window.innerWidth`)
4. Confirm all four panels collapse to single-column field layouts on mobile; numeric inputs + suffix become `flex-row` with suffix to the right of a narrower input; chip input wraps with full-width "Add" Ghost
5. Confirm sticky save bar pinned to viewport bottom with safe-area inset on mobile; "Save settings" and "Discard changes" full-width

**Evidence to surface:**
- Two `settings-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target height for Save settings button on mobile (`TOUCH_TARGET_SAVE_MOBILE: <px>`)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden settings`

**Action:** Invoke Skill with `/impeccable harden settings`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-settings.md`. Implement what harden recommends (dirty / loading / submission / validation / concurrent-edit / pause-confirm / intake-off-banner / cities-empty / overflow) per the brief's `## 6. Key States` section. For each state listed in the brief that harden didn't surface, add it anyway.

Verification edge cases (settings-specific):
- Intake switch toggle on → off opens the `ConfirmActionModal` Cancelled family with Destructive Primary; cancel leaves state unchanged
- Intake switch toggle off → on is one-click (no modal); resume toast: "Intake reopened. The public booking page is accepting requests."
- Confirm Pause modal Primary "Pause intake" (Destructive variant) submits the form with `booking_status_enabled=off`; preserves any pending policy edits made before the toggle (brief §7)
- Numeric helpers update LIVE on `onChange` as the operator types (NOT on the persisted setting; pure visual feedback)
- `beforeunload` browser prompt fires when dirty and operator tries to nav away; detaches on successful save or discard
- Chip input: Enter adds; comma adds; backspace on empty removes last; hidden `<input name="allowed_cities">` updates on every change with chips joined by `\n`
- Service-area chip duplicate is deduped + lowercased + trimmed
- Cities empty: inline Attention-family one-liner "No service areas yet. The booking form will currently turn every customer away. Add at least one city below." (NOT a full EmptyState)
- "Discard changes" Ghost: client-side resets all fields to `defaultValue` props; doesn't hit the server; clears dirty flag
- Required `*` markers in Cancelled text colour with `aria-hidden="true"` on `company_name` and all four numeric fields (P0 carry-forward)

**Evidence to surface:**
- `/redesign/HARDEN-RECS-settings.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-settings.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify settings`

**Action:** Invoke Skill with `/impeccable clarify settings`.

Verify copy matches the brief's `## Copy` section exactly (or has been tightened for layout — that's allowed). Specifically:
- Page title "Settings"; description "Booking window, service areas, buffers, and the intake switch the customer-facing form reads."
- Panel H2s: "Customer booking intake" / "Clinic identity" / "Booking rules" / "Service areas"
- Intake banner copy: "Accepting new bookings" (Confirmed) / "Intake paused" (Restricted)
- Confirm modal: "Pause new bookings?" / "The public booking page will show a closed-for-intake notice until you turn this back on. Existing bookings, reminders, and admin work continue." / Destructive "Pause intake" + Secondary "Cancel"
- Save toast: "Settings saved."
- Resume toast: "Intake reopened. The public booking page is accepting requests."
- Pause toast: "Intake paused. Customer-facing booking page is now closed."
- All numeric helper live-bound strings verbatim:
  - `booking_window_days`: "Customers can book up to {n} days into the future."
  - `minimum_notice_hours`: "Customers can't book a slot starting in less than {n} hours."
  - `buffer_time_mins`: "Each visit leaves {n} minutes of travel time after it for the therapist's next stop."
  - `customer_cancellation_cutoff_hours`: "Customers can self-cancel up to {n} hours before the visit starts. Closer cancellations need staff."
- Field helpers per brief §8 verbatim
- Denied state: "Settings access limited" + "Settings are restricted to the practice owner. Ask the owner if you need a policy changed." + "Back to dashboard" Secondary; NO raw `manage_settings` permission identifier
- Cities-empty inline copy verbatim: "No service areas yet. The booking form will currently turn every customer away. Add at least one city below."
- All error messages per brief Copy section verbatim
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
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/settings/page.tsx src/app/admin/settings/SettingsForm.tsx

# Raw oklch() literals (should be 0 — colors come from tokens)
grep -nE 'oklch\(' src/app/admin/settings/page.tsx src/app/admin/settings/SettingsForm.tsx

# Raw px values outside @media queries (canon: should be 0 outside @media rules)
grep -nE '\\d+px' src/app/admin/settings/page.tsx src/app/admin/settings/SettingsForm.tsx

# font-family literals (should be 0)
grep -nE "font-family:\s*['\"]" src/app/admin/settings/page.tsx src/app/admin/settings/SettingsForm.tsx

# Raw spacing literals (canon: should match the spacing scale in DESIGN.md)
grep -nE '(margin\|padding):\s*\d' src/app/admin/settings/page.tsx src/app/admin/settings/SettingsForm.tsx

# Raw rahma token escapes (brief flags these for cleanup)
grep -nE 'var\(--rahma-' src/app/admin/settings/page.tsx src/app/admin/settings/SettingsForm.tsx

# Bare bg-white/70 on inner panels (brief flags SettingsForm.tsx:219)
grep -nE 'bg-white/[0-9]+' src/app/admin/settings/SettingsForm.tsx

# Raw red Tailwind colour classes — brief flags border-red-200 / bg-red-50 / text-red-600 on form error + per-field error
grep -nE '(border|bg|text)-red-' src/app/admin/settings/SettingsForm.tsx

# backdrop-blur on sticky save bar MUST be 0 per brief §5
grep -nE 'backdrop-blur' src/app/admin/settings/SettingsForm.tsx
```

For each match, confirm the value comes from a DESIGN.md token. If a hardcoded value isn't backed by a token, FIX IT — either add the token to DESIGN.md (only with user approval, otherwise STUCK) or replace with the existing token. Form-level errors must use Cancelled family (`var(--admin-cancelled)` + `var(--admin-cancelled-bg)`), not raw `text-red-600`.

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1440)

- Sign in as Owner (`test.owner@rahmatherapy.example.test` or whichever holds `MANAGE_SETTINGS`)
- Navigate to `/admin/settings` at each viewport
- Save final-state screenshots: `settings-final-{375,768,1440}.png` to `/redesign/screenshots/settings-redesign/`
- Edit `booking_window_days` to 14 → live helper updates to "Customers can book up to 14 days into the future."; "Discard changes" Ghost appears; `beforeunload` listener attaches (verify via DevTools event listener panel)
- Click "Save settings" → toast "Settings saved." appears; form returns to clean state; "Discard changes" disappears
- Toggle the intake switch off → `ConfirmActionModal` opens; click "Pause intake" Destructive → Panel 1 banner swaps to Restricted "Intake paused"; toast "Intake paused. Customer-facing booking page is now closed."
- Toggle the intake switch back on → no modal; toast "Intake reopened. The public booking page is accepting requests."
- Add a city to the chip input via Enter and via comma; remove one with the `x`; verify hidden `<input name="allowed_cities">` value is newline-delimited via DevTools
- Sign out via `/admin/signout` to leave a clean session for downstream pages

### 11c — Console + Network

- Print last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md` (warnings OK)
- Print network requests during a save + an intake toggle — verify same endpoint as `/redesign/RECON.md` baseline (POST to `updateBusinessSettings` server action)

**Evidence to surface:**
- All eight grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix). `BG_WHITE_HITS: 0`, `RAW_RED_HITS: 0`, `BACKDROP_BLUR_HITS: 0` literal lines.
- 3 screenshot files in `/redesign/screenshots/settings-redesign/`: `settings-final-{375,768,1440}.png`
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — `/impeccable audit settings` + `/impeccable critique settings` + functional smoke test

### 12a — Audit
Invoke Skill with `/impeccable audit settings`.

**Severity rubric — anchor every finding before tagging (impeccable v5 L884-890):**
- **P0** Blocks release — fix before shipping anything
- **P1** Fix this sprint — significant impact on users
- **P2** Next cycle — noticeable but not blocking
- **P3** Polish — minor, fix when time allows

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## settings — audit`:
- 5 dimension scores
- P0/P1/P2/P3 findings, each on its own line
- Backend status: `N-A` (settings has no BLOCKS-REDESIGN backend deps; last-changed-by sub-line BUILD plan is non-blocking)
- **P1 (tag for Phase 7 gauntlet):** subsection — list each P1 finding with location + file:line; if zero, write `none`. Phase 7 `/impeccable audit admin` re-scans this section.
- **BUSINESS-COMPLETENESS impact:** subsection — name any `redesign/BUSINESS-COMPLETENESS.md` items this page newly contributes to (e.g. `2A-6` if form-level error `role="alert"` was implemented). Lets the universal flag flip `PARTIAL` → `HANDLED` when all form-bearing pages adopt.

**Print the appended section to chat.**

**If any P0 finding: emit `P0_FOUND:` followed by the list and STOP.** Do not proceed to handoff. The user will decide whether to fix-now or defer.

### 12b — Critique
Invoke Skill with `/impeccable critique settings`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## settings — critique`:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

**Print the appended section to chat.**

If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder settings` OR `/impeccable distill settings` based on which fits the verdict's reasoning, then re-run `/impeccable critique settings`. Loop max 2 times.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code (sign in as Owner first):

- [ ] All nine form field `name` attributes preserved verbatim: `company_name`, `contact_phone`, `contact_email`, `booking_window_days`, `minimum_notice_hours`, `buffer_time_mins`, `customer_cancellation_cutoff_hours`, `allowed_cities`, `booking_status_enabled`
- [ ] `updateBusinessSettings` server action signature unchanged; existing `handleSubmit` shape preserved (`event.preventDefault()` + manual `FormData` + `startTransition`); RECON §5 untouchable
- [ ] Heading hierarchy: page H1 "Settings" followed by four H2 panel headings ("Customer booking intake" / "Clinic identity" / "Booking rules" / "Service areas") contiguous; NO H3 skip (resolves Sam #1)
- [ ] Switch responds to Space and announces on/off state via assistive tech
- [ ] Required `*` markers on `company_name` + four numeric fields with `aria-hidden="true"` (P0 carry-forward)
- [ ] Per-field errors render in `role="alert" aria-live="polite" aria-atomic="true"` (P0 carry-forward)
- [ ] Form-level error promoted to Cancelled-family banner with `x-circle` icon (replaces raw `border-red-200`/`bg-red-50`/`text-red-600` at line 67)
- [ ] Input borders meet WCAG 1.4.11 (Form Seam `oklch(55%)`; resolves Sam #3)
- [ ] Chip input: Enter / comma adds; backspace on empty removes last; hidden `allowed_cities` reflects current chips joined by `\n`
- [ ] Numeric helper live-binding: typing into a number input updates the helper text within the same tick
- [ ] Dirty state: edits surface "Discard changes" Ghost; `beforeunload` fires on nav-away; save returns clean state and removes listener
- [ ] Role pass: Owner sees full surface; Admin/PM, Coordinator, Therapist, Inactive all hit `AdminAccessDenied` with new copy and NO raw `manage_settings` identifier
- [ ] No `backdrop-blur` on sticky save bar (brief §5 requirement)

**Evidence to surface:**
- Both PER-PAGE-SCORES.md sections printed to chat (audit + critique)
- Functional smoke test checklist printed with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit/critique/smoke clean` and cat progress file

---

## Step 13 — Handoff (NO COMMIT — wait for user approval)

**Action:**
1. Run `git diff --stat` in the worktree — print to chat
2. Compare changed-files list against `/redesign/per-page-scope/settings-scope.md`. For any file changed that isn't in the scope file's "Files to edit" list: STOP and emit `SCOPE_VIOLATION: <file>`. Otherwise: `SCOPE_CLEAN: only scoped files changed`.
3. Run `git diff` (full) and confirm nothing unexpected appears — print the diff to chat in collapsible form.
4. Emit the handoff message to chat with:
   - Dev server URL: `http://localhost:3001/admin/settings`
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
12. `BG_WHITE_HITS: 0` and `RAW_RED_HITS: 0` and `BACKDROP_BLUR_HITS: 0`
13. `CONSOLE_NEW_ERRORS: 0`
14. `## settings — audit` and `## settings — critique` headings appended (printed to chat from the file)
15. `SMOKE_TEST: all PASS`
16. `SCOPE_CLEAN: only scoped files changed`
17. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
