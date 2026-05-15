# /goal recipe — page: booking-detail (4 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/booking-detail-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `booking-detail` |
| Page row in IMPLEMENTATION-PLAN.md | row 4 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/booking-detail-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (booking-detail section) |
| Source files to edit | `src/app/admin/bookings/[bookingId]/page.tsx`, `src/app/admin/bookings/BookingManagementForm.tsx`, `src/app/admin/bookings/AssignmentManager.tsx`, `src/app/admin/bookings/ClaimAssignmentButton.tsx`, `src/app/admin/bookings/BookingActionButton.tsx` |
| Logo asset (already present and tracked) | `public/images/brand/rahma/logo-refined.svg` |
| Worktree | this checkout — branch `agent/booking-detail-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3001` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `N-A` (no BLOCKS-REDESIGN backend deps; the brief's `BookingCreatedToast` consumer reads sessionStorage written by booking-new, no new server action) |
| Progress scratchpad | `/redesign/per-page-progress/booking-detail-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `src/app/admin/bookings/actions.ts` — `updateBookingManagement`, `quickUpdateBooking`, `claimBookingAssignment`, `updateBookingAssignment`, `updateOwnAssignmentStatus`
   - `src/app/admin/bookings/access.ts`, `src/app/admin/bookings/access.test.ts` — scope helpers
   - `src/app/admin/bookings/format.ts` — date/money/label formatters
   - `src/app/admin/bookings/types.ts` — type definitions
   - `src/app/admin/bookings/assignment-eligibility.ts`, `assignment-eligibility.test.ts` — gender/service eligibility logic
   - `src/middleware.ts` — Supabase session refresh / route protection
   - `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layer (RECON §5)
   - `supabase/migrations/**`
   - `src/components/ui/card.tsx` — out of scope here (fix lives in `00-shared-components` session)
   - All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.)
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve form `name` attributes:** `booking_id` (hidden), `status`, `payment_status`, `payment_method`, `amount_paid`, `payment_note`, `treatment_notes`, `admin_notes`, `customer_manage_notes` must remain literal.
6. **Preserve the server-action contracts:** `updateBookingManagement`, `quickUpdateBooking`, `claimBookingAssignment`, `updateBookingAssignment`, `updateOwnAssignmentStatus` must keep being invoked verbatim from their existing client components. No `fetch` / no `XHR` replacement.

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
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `booking-detail` for page-specific entries
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; lines 510–550 for the booking-detail row

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
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/booking-detail-progress.md` and cat it.

---

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: booking-detail
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/booking-detail-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for booking-detail)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/booking-detail-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

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

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (booking-detail) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
> - /redesign/briefs/booking-detail-brief.md  ← THIS IS THE PREPARED BRIEF
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
> Write to `/redesign/per-page-scope/booking-detail-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/booking-detail-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1440. Two-column desktop layout activates at ≥768px with sticky sidebar.
>
> IMAGE HANDLING: no new image assets required for this page. The Google Maps deep-link is text-only.
>
> BACKEND FAKE MARKER: booking-detail has no FAKE-tagged backend features. The `BookingCreatedToast` mount is a sessionStorage consumer written by booking-new; no new server action required.

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list
- `/redesign/per-page-scope/booking-detail-scope.md` written; print its contents to chat
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- Append `step-3: COMPLETE — scope written, plan updated` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page booking-detail`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page booking-detail`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/booking-detail-brief.md. Compare the current implementation to the brief's requirements (5 native sections + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3001 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-booking-detail-redesign"
pnpm next dev -p 3001
```

Use `run_in_background: true`. Poll `http://localhost:3001/admin/bookings/<id>` (use any seeded booking id from the test fixtures) until it returns HTTP 200 (or 308 — that's a trailing-slash redirect which Playwright handles). Max wait: 60 seconds.

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

Sign in first as `test.admin@rahmatherapy.example.test` / `AdminTest123!` (the booking-detail page is auth-gated). Then navigate to a seeded booking detail URL. Take screenshots and save to `/redesign/screenshots/booking-detail-redesign/`:
- `chunk1-1440-default.png` at 1440×900 (pending + unassigned booking)
- `chunk1-768-default.png` at 768×1024
- `chunk1-375-default.png` at 375×812
- `chunk1-1440-confirmed-assigned.png` at 1440×900 (confirmed + assigned booking)
- `chunk1-375-confirmed-assigned.png` at 375×812
- `chunk1-1440-therapist-scope.png` at 1440×900 (signed in as therapist viewing their assigned booking — scoped view)

Self-assess against the brief. If you can identify ONE specific axis problem:

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder booking-detail` |
| Too loud, too many colours | `/impeccable quieter booking-detail` |
| Grey, lifeless, no identity | `/impeccable colorize booking-detail` |
| Fonts feel default or inconsistent | `/impeccable typeset booking-detail` |
| Spacing is off, things feel cramped | `/impeccable layout booking-detail` |
| Static, jumpy, no motion | `/impeccable animate booking-detail` |
| Functional but cold | `/impeccable delight booking-detail` |
| Too much on the page | `/impeccable distill booking-detail` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

If a refine runs, re-screenshot with `-after-refine` suffix.

**Evidence to surface:**
- 6+ screenshot file paths printed to chat (`ls redesign/screenshots/booking-detail-redesign/`)
- Literal decision: `ITERATE_DECISION: no refine needed — <brief-justified reason>` OR `ITERATE_DECISION: ran /impeccable <axis> booking-detail because <reason>`
- Append `step-7: COMPLETE — iterate decision logged` and cat progress file

---

## Step 8 — `/impeccable adapt booking-detail for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt booking-detail for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/booking-detail-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/booking-detail-adapt-after-mobile.png`
3. Confirm no horizontal scroll at either breakpoint (Playwright: check `document.documentElement.scrollWidth <= window.innerWidth`)
4. Confirm form inputs and primary buttons are tappable without zoom on mobile (min 44px touch targets — check `getBoundingClientRect().height >= 44`)
5. Confirm the `AdminMobileActionBar` is fixed at viewport bottom on mobile and renders both "Save notes" + "Save status & payment" buttons (or single centred "Save notes" for Therapist scope)
6. Confirm the two-column desktop layout collapses to single column below 768px and the sidebar cards reflow into the documented mobile section order

**Evidence to surface:**
- Two `booking-detail-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target height for the "Save status & payment" Primary on mobile (`TOUCH_TARGET_SAVE_MOBILE: <px>`)
- Sticky bar presence + composition check at 375 (`MOBILE_ACTIONBAR_PRESENT: true`)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden booking-detail`

**Action:** Invoke Skill with `/impeccable harden booking-detail`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-booking-detail.md`. Implement what harden recommends per the brief's `## 6. Key States` section. For each state listed in the brief that harden didn't surface, add it anyway. The key states list includes: pending+unassigned, confirmed+assigned, saving (each form), saved (each form), Cancel confirm modal, Claim optimistic, Therapist own-assignment update, Booking not found, Permission denied.

Verification edge cases (booking-detail-specific):
- 200-character payment note doesn't break textarea layout at 375px
- "Same-gender required" chip stays legible when participant name wraps to 2 lines
- Cancel confirm modal body text doesn't overflow at 375px (use brief's verbatim copy)
- Optimistic claim rollback toast doesn't cover the sticky action bar on mobile
- Activity timeline with 20 entries doesn't break sidebar sticky behaviour
- Address block with 5-line address renders without truncation in sidebar card

**Evidence to surface:**
- `/redesign/HARDEN-RECS-booking-detail.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-booking-detail.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify booking-detail`

**Action:** Invoke Skill with `/impeccable clarify booking-detail`.

Verify copy matches the brief's `## Copy` section exactly (or has been tightened for layout — that's allowed). Specifically:
- No generic `Save` buttons → "Save status & payment" + "Save notes" Primary literal labels
- Cancel modal copy verbatim:
  - Heading: `Cancel this booking?`
  - Body: `The client will be notified by email. This cannot be undone from the booking page.`
  - Destructive: `Cancel booking`
  - Secondary: `Keep it`
- Quick-action labels: `Confirm booking` / `Mark paid` / `Cancel booking` / `Mark complete`
- Claim CTA: `Claim this booking` (Primary)
- Sidebar back-link: `View client profile` (Ghost, → `/admin/clients/{clientId}`)
- Address CTA: `View on Maps` (Primary, → Google Maps deep-link)
- Toast strings verbatim: `Booking updated.`, `Notes saved.`, `Booking cancelled. The client has been notified.`, `Marked paid.`, `Marked complete.`, `Reassigned to {therapist name}.`, `Booking claimed.`, `Couldn't claim this booking. Someone got there first.`
- Booking-not-found copy: heading `Booking not found` / body `This booking may have been deleted, or you don't have access.` / Secondary `Back to bookings`
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
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/bookings/[bookingId]/page.tsx src/app/admin/bookings/BookingManagementForm.tsx src/app/admin/bookings/AssignmentManager.tsx src/app/admin/bookings/ClaimAssignmentButton.tsx src/app/admin/bookings/BookingActionButton.tsx

# Raw oklch() literals (should be 0 — colors come from tokens)
grep -nE 'oklch\(' src/app/admin/bookings/[bookingId]/page.tsx src/app/admin/bookings/BookingManagementForm.tsx src/app/admin/bookings/AssignmentManager.tsx src/app/admin/bookings/ClaimAssignmentButton.tsx src/app/admin/bookings/BookingActionButton.tsx

# Raw px values outside @media queries (canon: should be 0 outside @media rules)
grep -nE '\\d+px' src/app/admin/bookings/[bookingId]/page.tsx src/app/admin/bookings/BookingManagementForm.tsx src/app/admin/bookings/AssignmentManager.tsx src/app/admin/bookings/ClaimAssignmentButton.tsx src/app/admin/bookings/BookingActionButton.tsx

# font-family literals (should be 0)
grep -nE "font-family:\s*['\"]" src/app/admin/bookings/[bookingId]/page.tsx src/app/admin/bookings/BookingManagementForm.tsx src/app/admin/bookings/AssignmentManager.tsx src/app/admin/bookings/ClaimAssignmentButton.tsx src/app/admin/bookings/BookingActionButton.tsx

# Raw spacing literals (canon: should match the spacing scale in DESIGN.md)
grep -nE '(margin\|padding):\s*\d' src/app/admin/bookings/[bookingId]/page.tsx src/app/admin/bookings/BookingManagementForm.tsx src/app/admin/bookings/AssignmentManager.tsx src/app/admin/bookings/ClaimAssignmentButton.tsx src/app/admin/bookings/BookingActionButton.tsx

# Forbidden `border-l-4` (timeline track must be 1px border-subtle — brief §Implementation Notes)
grep -nE 'border-l-4' src/app/admin/bookings/[bookingId]/page.tsx src/app/admin/bookings/BookingManagementForm.tsx src/app/admin/bookings/AssignmentManager.tsx
```

For each match, confirm the value comes from a DESIGN.md token. If a hardcoded value isn't backed by a token, FIX IT — either add the token to DESIGN.md (only with user approval, otherwise STUCK) or replace with the existing token. Particular attention to status badge colours: each must use the corresponding `var(--status-*-bg)` / `var(--status-*-text)` pair, not raw `oklch()`.

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1440)

- Sign in as `test.admin@rahmatherapy.example.test` / `AdminTest123!` then navigate to a seeded booking detail URL at each viewport
- Save final-state screenshots: `booking-detail-final-{375,768,1440}.png` to `/redesign/screenshots/booking-detail-redesign/`
- Change a status field → "Save status & payment" activates from 60% opacity → click → spinner → toast "Booking updated." → sidebar status badge reflects new status. Screenshot: `booking-detail-status-saved.png`
- Change treatment notes → "Save notes" activates → save → toast "Notes saved." Screenshot: `booking-detail-notes-saved.png`
- Click "Cancel booking" quick action → `ConfirmActionModal` opens with exact brief copy → click "Cancel booking" → status updates to Cancelled, activity timeline entry appears. Screenshot: `booking-detail-cancel-confirmed.png`
- Click "View client profile" Ghost link in sidebar → verify navigation to `/admin/clients/{clientId}` (status 200)
- Click "View on Maps" Primary button → verify `target="_blank"` to `https://www.google.com/maps/search/?api=1&query=...`
- Sign out → sign in as `test.therapist@rahmatherapy.example.test` / `TherapistTest123!` → navigate to an assigned booking → verify scoped view: Status & payment section absent, Admin notes absent, Email activity absent, Activity timeline absent, "Mark complete"/"Mark as no-show" present, single Primary "Save notes" in mobile sticky bar
- Sign out via `/admin/signout` to leave a clean session for downstream pages

### 11c — Console + Network

- Print last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md` (warnings OK)
- Print network requests during save flows — verify same endpoints as `/redesign/RECON.md` baseline (POST to `updateBookingManagement`, `quickUpdateBooking`, `claimBookingAssignment`, `updateBookingAssignment`, `updateOwnAssignmentStatus` server actions)
- Confirm `revalidatePath('/admin/bookings/{id}')` fires after each server action (sidebar status badge refreshes without manual reload)

**Evidence to surface:**
- All five grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix); explicit `BORDER_L_4: 0`
- 7+ screenshot files in `/redesign/screenshots/booking-detail-redesign/`: `booking-detail-final-{375,768,1440}.png` + the action-flow shots
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — `/impeccable audit booking-detail` + `/impeccable critique booking-detail` + functional smoke test

### 12a — Audit
Invoke Skill with `/impeccable audit booking-detail`.

**Severity rubric — anchor every finding before tagging (impeccable v5 L884-890):**
- **P0** Blocks release — fix before shipping anything
- **P1** Fix this sprint — significant impact on users
- **P2** Next cycle — noticeable but not blocking
- **P3** Polish — minor, fix when time allows

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## booking-detail — audit`:
- 5 dimension scores
- P0/P1/P2/P3 findings, each on its own line
- Backend status: `N-A` (no BLOCKS-REDESIGN backend deps)
- **P1 (tag for Phase 7 gauntlet):** subsection — list each P1 finding with location + file:line; if zero, write `none`. Phase 7 `/impeccable audit admin` re-scans this section.
- **BUSINESS-COMPLETENESS impact:** subsection — name any `redesign/BUSINESS-COMPLETENESS.md` items this page newly contributes to (e.g. `2A-6` if form-level error `role="alert"` was implemented). Lets the universal flag flip `PARTIAL` → `HANDLED` when all form-bearing pages adopt.

**Print the appended section to chat.**

**If any P0 finding: emit `P0_FOUND:` followed by the list and STOP.** Do not proceed to handoff. The user will decide whether to fix-now or defer.

### 12b — Critique
Invoke Skill with `/impeccable critique booking-detail`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## booking-detail — critique`:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

**Print the appended section to chat.**

If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder booking-detail` OR `/impeccable distill booking-detail` based on which fits the verdict's reasoning, then re-run `/impeccable critique booking-detail`. Loop max 2 times.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code:

- [ ] Each form field `name` attribute present in DOM: `booking_id` (hidden), `status`, `payment_status`, `payment_method`, `amount_paid`, `payment_note`, `treatment_notes`, `admin_notes`, `customer_manage_notes`
- [ ] "Save status & payment" submits to `updateBookingManagement` with status/payment field subset; "Save notes" submits to `updateBookingManagement` with notes field subset; neither nulls the other section's fields
- [ ] Quick actions fire `quickUpdateBooking`: Confirm / Mark paid / Cancel (via ConfirmActionModal) / Mark complete — each shows Sonner toast
- [ ] `ClaimAssignmentButton` → instant "Claimed" optimistic state → server confirmation, error rollback shows toast `Couldn't claim this booking. Someone got there first.`
- [ ] `AssignmentManager` Reassign opens AdminActionMenu (desktop) or AdminSheet (mobile) and fires `updateBookingAssignment`
- [ ] Therapist "Mark complete" / "Mark as no-show" fire `updateOwnAssignmentStatus`
- [ ] Audit events fire: `booking_management_updated`, `booking_quick_*`, `booking_assignment_*` (verify via network tab / server log)
- [ ] Google Maps deep-link `target="_blank"` to `https://www.google.com/maps/search/?api=1&query=${address}`
- [ ] "View client profile" Ghost link navigates to `/admin/clients/{clientId}`
- [ ] Breadcrumb "Bookings → {reference}" in `AdminPageHeader` navigates back to `/admin/bookings`
- [ ] Therapist scope: status/admin-notes/email-activity/timeline sections absent; client-profile back-link absent
- [ ] No `border-l-4` anywhere on the page (timeline track is 1px `border-subtle`)
- [ ] Gender-match chip + "Unassigned" badge both have text label + icon (not colour-only)

**Evidence to surface:**
- Both PER-PAGE-SCORES.md sections printed to chat (audit + critique)
- Functional smoke test checklist printed with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit/critique/smoke clean` and cat progress file

---

## Step 13 — Handoff (NO COMMIT — wait for user approval)

**Action:**
1. Run `git diff --stat` in the worktree — print to chat
2. Compare changed-files list against `/redesign/per-page-scope/booking-detail-scope.md`. For any file changed that isn't in the scope file's "Files to edit" list: STOP and emit `SCOPE_VIOLATION: <file>`. Otherwise: `SCOPE_CLEAN: only scoped files changed`.
3. Run `git diff` (full) and confirm nothing unexpected appears — print the diff to chat in collapsible form.
4. Emit the handoff message to chat with:
   - Dev server URL: `http://localhost:3001/admin/bookings/<id>`
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
12. `CONSOLE_NEW_ERRORS: 0`
13. `## booking-detail — audit` and `## booking-detail — critique` headings appended (printed to chat from the file)
14. `SMOKE_TEST: all PASS`
15. `SCOPE_CLEAN: only scoped files changed`
16. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
