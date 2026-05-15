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
| Dev server port for this worktree | `3001` (user's main tree owns `3000`) |
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
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/enquiries-progress.md` and cat it.

---

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

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (enquiries) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
/ralph-loop "Read the brief at /redesign/briefs/enquiries-brief.md. Compare the current implementation to the brief's requirements (10 native sections + Role variants + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3001 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-enquiries-redesign"
pnpm next dev -p 3001
```

Use `run_in_background: true`. Poll `http://localhost:3001/admin/enquiries` until it returns HTTP 200 (or 308). Max wait: 60 seconds.

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

Sign in as `test.admin@rahmatherapy.example.test` / `AdminTest123!` at `/admin/login`. Take screenshots and save to `/redesign/screenshots/enquiries-redesign/`:
- `chunk1-1440-all.png` at 1440×900 navigating to `/admin/enquiries` (default `?tab=all`)
- `chunk1-1440-new.png` at 1440×900 navigating to `/admin/enquiries?tab=new` (Attention-family count badge if any new exist)
- `chunk1-1440-converted.png` at 1440×900 navigating to `/admin/enquiries?tab=converted` (`View booking →` Ghost on each row)
- `chunk1-1440-filtered.png` at 1440×900 navigating to `/admin/enquiries?source=whatsapp&assigned_staff=<seed-uuid>` (filter chips below bar)
- `chunk1-768-default.png` at 768×1024 (still two-column at 1024+ — adjust if breakpoint changes)
- `chunk1-375-collapsed.png` at 375×812 on `/admin/enquiries` (intake form collapsed behind `Record new enquiry` toggle; filter bar collapsed to Ghost)
- `chunk1-375-expanded.png` at 375×812 on `/admin/enquiries` with intake form expanded

> **Heads up on session-cookie bleed:** Therapist hitting this URL renders `AdminAccessDenied`. Verify the admin session before saving the default screenshot.

Self-assess against the brief. If you can identify ONE specific axis problem:

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

If a refine runs, re-screenshot with `-after-refine` suffix.

**Evidence to surface:**
- 7+ screenshot file paths printed to chat (`ls redesign/screenshots/enquiries-redesign/`)
- Literal decision: `ITERATE_DECISION: no refine needed — <brief-justified reason>` OR `ITERATE_DECISION: ran /impeccable <axis> enquiries because <reason>`
- Append `step-7: COMPLETE — iterate decision logged` and cat progress file

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

```bash
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/enquiries/page.tsx src/app/admin/enquiries/EnquiryForm.tsx src/app/admin/enquiries/EnquiryStatusButton.tsx
grep -nE 'oklch\(' src/app/admin/enquiries/*.tsx
grep -nE '\\d+px' src/app/admin/enquiries/*.tsx
grep -nE "font-family:\s*['\"]" src/app/admin/enquiries/*.tsx

# Raw spacing literals (canon: should match the spacing scale in DESIGN.md)
grep -nE '(margin\|padding):\s*\d' src/app/admin/enquiries/*.tsx
grep -nE 'text-(emerald|orange|red|amber|green)-[0-9]+' src/app/admin/enquiries/*.tsx
grep -nE 'border-l-4' src/app/admin/enquiries/*.tsx
grep -nE 'manage_enquiries' src/app/admin/enquiries/*.tsx
grep -nE 'warning|muted' src/app/admin/enquiries/EnquiryStatusButton.tsx
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

### 11c — Console + Network

- Print last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md`
- Print network requests during form submit + mark-contacted + filter apply — verify POSTs to `createEnquiry` and `updateEnquiryStatus` with the documented form field names (RECON §6.4 preserved)

**Evidence to surface:**
- All eight grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix)
- 3 final screenshots in `/redesign/screenshots/enquiries-redesign/`
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — `/impeccable audit enquiries` + `/impeccable critique enquiries` + functional smoke test

### 12a — Audit
Invoke Skill with `/impeccable audit enquiries`.

**Severity rubric — anchor every finding before tagging (impeccable v5 L884-890):**
- **P0** Blocks release — fix before shipping anything
- **P1** Fix this sprint — significant impact on users
- **P2** Next cycle — noticeable but not blocking
- **P3** Polish — minor, fix when time allows

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## enquiries — audit`:
- 5 dimension scores
- P0/P1/P2/P3 findings, each on its own line
- Backend status: `FAKE` — `BUILD-enquiries-filter-query.md` still BLOCKS-REDESIGN; FAKE markers in code
- **P1 (tag for Phase 7 gauntlet):** subsection — list each P1 finding with location + file:line; if zero, write `none`. Phase 7 `/impeccable audit admin` re-scans this section.
- **BUSINESS-COMPLETENESS impact:** subsection — name any `redesign/BUSINESS-COMPLETENESS.md` items this page newly contributes to (e.g. `2A-6` if form-level error `role="alert"` was implemented). Lets the universal flag flip `PARTIAL` → `HANDLED` when all form-bearing pages adopt.

**Print the appended section to chat.**

**If any P0 finding: emit `P0_FOUND:` followed by the list and STOP.**

### 12b — Critique
Invoke Skill with `/impeccable critique enquiries`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## enquiries — critique`:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

**Print the appended section to chat.**

If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder enquiries` OR `/impeccable distill enquiries`, then re-run `/impeccable critique enquiries`. Loop max 2 times.

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

## Step 13 — Handoff (NO COMMIT — wait for user approval)

**Action:**
1. Run `git diff --stat` in the worktree — print to chat
2. Compare changed-files list against `/redesign/per-page-scope/enquiries-scope.md`. For any file changed that isn't in the scope file's "Files to edit" list: STOP and emit `SCOPE_VIOLATION: <file>`. Otherwise: `SCOPE_CLEAN: only scoped files changed`.
3. Run `git diff` (full) and confirm nothing unexpected appears — print the diff to chat in collapsible form.
4. Emit the handoff message to chat with:
   - Dev server URL: `http://localhost:3001/admin/enquiries`
   - All screenshot paths
   - Audit + critique key scores
   - Backend status: `FAKE` until `BUILD-enquiries-filter-query.md` lands (BLOCKS-REDESIGN; gates Phase 7)
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
13. `## enquiries — audit` and `## enquiries — critique` headings appended (printed to chat from the file)
14. `SMOKE_TEST: all PASS`
15. `SCOPE_CLEAN: only scoped files changed`
16. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
