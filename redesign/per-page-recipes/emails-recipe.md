# /goal recipe — page: emails (22 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/emails-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `emails` |
| Page row in IMPLEMENTATION-PLAN.md | row 22 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/emails-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (emails section) |
| Source files to edit | `src/app/admin/emails/page.tsx` (tab shell + Delivery + Reminders bodies; the Templates tab body lives in the email-templates recipe) |
| Worktree | this checkout — branch `agent/emails-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3001` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `FAKE` — depends on BLOCKS-REDESIGN `BUILD-email-delivery-filter-query.md` (server-side filter contract for Delivery tab) + `BUILD-automated-booking-reminders.md` (must be handled before or during this session). Until built, the new Delivery filter strip degrades to the unfiltered last-100 events; the Reminders tab's `sendManualBookingReminder` stays wired verbatim. Mark FAKE comments at the filter call sites. |
| Progress scratchpad | `/redesign/per-page-progress/emails-progress.md` |
| Tabbed-shell coupling | Templates tab body owned by the email-templates recipe. This recipe owns the tab shell, the Delivery body, and the Reminders body only. |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `src/app/admin/emails/actions.ts` — `sendManualBookingReminder` server action and its no-private-body contract (RECON §5 explicit DO-NOT-TOUCH)
   - `src/lib/email/**` — Resend sender helpers; `templates.ts` SERVER ONLY constraint
   - `src/lib/auth/**`, `src/lib/supabase/**`, `src/middleware.ts` (RECON §5)
   - `supabase/migrations/**`
   - All build/config files
   - The `email_delivery_events` schema and the read shape
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve `<input type="hidden" name="booking_id">` on every Reminders row** (RECON §6.4). The `<form action={sendManualBookingReminder}>` per-row wire-up must remain intact.
6. **`AdminAccessDenied` copy must NOT leak `view_email_logs`** as a raw identifier (current `page.tsx:143` leaks it; fix here).
7. **No new mutations beyond resend.** No "resend any event" generic button; resend is reminder-scoped on purpose.

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
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `emails`
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; search for the emails row

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
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/emails-progress.md` and cat it.

---

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: emails
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/emails-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (the `sendManualBookingReminder` wire-up, `booking_id` hidden input, no-private-body contract, no-new-mutations rule)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for emails)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/emails-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

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

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (emails) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
> - /redesign/briefs/emails-brief.md  ← THIS IS THE PREPARED BRIEF
>
> Tell me before writing any code:
> - Files you will edit (this recipe owns the tab shell + Delivery + Reminders bodies; Templates body is the email-templates recipe's slot)
> - Files you will NOT touch (from the brief's untouchable list — particularly `emails/actions.ts`)
> - Features you are preserving
> - Any conflict between brief and codebase
>
> (You are running under `/goal`, so "wait for my go-ahead" → instead print the file list to chat with a literal `SCOPE_PROPOSAL:` prefix, then proceed.)
>
> WRITE THE PER-PAGE SCOPE TO DISK before craft runs:
> Write to `/redesign/per-page-scope/emails-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/emails-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1440. Tab strip → momentum-scroll pills on mobile; Delivery filters collapse to `AdminSheet` from the bottom; Reminders Primary becomes sticky bottom action bar on mobile.
>
> IMAGE HANDLING: append `emails-empty.svg` (envelope-with-check, ~80–120px) and `reminders-empty.svg` (calendar-with-zzz, ~80–120px) to IMAGES-NEEDED.md.
>
> BACKEND FAKE MARKER: this surface depends on `BUILD-email-delivery-filter-query.md` (BLOCKS-REDESIGN) for the Delivery filter contract and `BUILD-automated-booking-reminders.md` (BLOCKS-REDESIGN) for the automated reminder pipeline (separate from the manual resend). Mark FAKE markers at filter call sites and at any reminder-automation hook. The Reminders tab's `sendManualBookingReminder` action stays wired verbatim (untouchable, already works).

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list
- `/redesign/per-page-scope/emails-scope.md` written; print its contents to chat
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- Append `step-3: COMPLETE — scope written, plan updated` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page emails`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page emails`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/emails-brief.md. Compare the current implementation to the brief's requirements (11 native sections + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3001 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-emails-redesign"
pnpm next dev -p 3001
```

Use `run_in_background: true`. Poll `http://localhost:3001/admin/emails` until it returns HTTP 200 (or 308). Max wait: 60 seconds.

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

Sign in as `test.admin@rahmatherapy.example.test` / `AdminTest123!` at `/admin/login`. Take screenshots and save to `/redesign/screenshots/emails-redesign/`:
- `chunk1-1440-delivery.png` at 1440×900 navigating to `/admin/emails?tab=delivery` (default; "All events" filter)
- `chunk1-1440-delivery-filtered.png` at 1440×900 navigating to `/admin/emails?tab=delivery&delivery_status=failed&range=last_24h` (filter chips below strip)
- `chunk1-1440-delivery-expanded.png` at 1440×900 with one event row's `<details>` error_message expansion open
- `chunk1-1440-reminders.png` at 1440×900 navigating to `/admin/emails?tab=reminders` (next-20 upcoming bookings)
- `chunk1-768-delivery.png` at 768×1024 on `/admin/emails?tab=delivery`
- `chunk1-375-delivery.png` at 375×812 on `/admin/emails?tab=delivery` (tab pills momentum-scroll; filter strip collapsed)
- `chunk1-375-reminders.png` at 375×812 on `/admin/emails?tab=reminders` (Primary "Send reminder" full-width on each row)

> **Heads up on session-cookie bleed:** if signed in as a coordinator-resend-only role, the Delivery tab and its badge are hidden. Verify the admin scope before saving the default screenshot.

Self-assess against the brief. If you can identify ONE specific axis problem:

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder emails` |
| Too loud, too many colours | `/impeccable quieter emails` |
| Grey, lifeless, no identity | `/impeccable colorize emails` |
| Fonts feel default or inconsistent | `/impeccable typeset emails` |
| Spacing is off, things feel cramped | `/impeccable layout emails` |
| Static, jumpy, no motion | `/impeccable animate emails` |
| Functional but cold | `/impeccable delight emails` |
| Too much on the page | `/impeccable distill emails` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

If a refine runs, re-screenshot with `-after-refine` suffix.

**Evidence to surface:**
- 7+ screenshot file paths printed to chat (`ls redesign/screenshots/emails-redesign/`)
- Literal decision: `ITERATE_DECISION: no refine needed — <brief-justified reason>` OR `ITERATE_DECISION: ran /impeccable <axis> emails because <reason>`
- Append `step-7: COMPLETE — iterate decision logged` and cat progress file

---

## Step 8 — `/impeccable adapt emails for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt emails for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/emails-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/emails-adapt-after-mobile.png`
3. Confirm no horizontal scroll at either breakpoint
4. Confirm tab pills momentum-scroll horizontally on mobile without overflow
5. Confirm Reminders Primary "Send reminder" is full-width on mobile rows with ≥44px tap target
6. Confirm Delivery filter sheet opens from the bottom on mobile, traps focus, Apply submits + closes

**Evidence to surface:**
- Two `emails-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target height for "Send reminder" Primary on mobile (`TOUCH_TARGET_SEND_REMINDER_MOBILE: <px>`)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden emails`

**Action:** Invoke Skill with `/impeccable harden emails`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-emails.md`. Implement what harden recommends per the brief's `## 6. Key States`. Particular attention to:
- Failed-events spike: tab badge in Cancelled family
- Resend submitting: `aria-busy="true"` + Pending "Sending…" chip; success → Confirmed "Sent" chip + "Last reminder" line updates
- Resend failure: Cancelled Sonner toast with Retry, no auto-dismiss
- Missing recipient: leading Attention chip `No recipient on file`, resend button hidden
- Resend on stale (cancelled) booking: Cancelled toast `That booking was cancelled. No reminder sent.`
- Delivery data load failure: Cancelled inline `role="alert"` region replaces timeline; tab strip stays usable
- Filtered-to-empty: `EmptyState` with `Clear filters` Ghost
- Failed filter, no failures: `No failed events in this range. Your emails are all getting through.`
- All-reminders-sent: `All reminders sent. Every upcoming booking already had one go out.`

Verification edge cases (emails-specific):
- 60-char email in recipient column doesn't break the row at 375px
- 1,000-char `error_message` in `<details>` doesn't overflow
- 24h `Last reminder` line wraps cleanly on a narrow row
- "No recipient on file" Attention chip + the row's resend-removed state align correctly

**Evidence to surface:**
- `/redesign/HARDEN-RECS-emails.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-emails.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify emails`

**Action:** Invoke Skill with `/impeccable clarify emails`.

Verify copy matches the brief's `## 8. Content Requirements` and `## Copy` sections exactly. Specifically:
- Page title: `Email`
- Page description: `Delivery status, manual reminders, and template library.`
- Tab labels: `Delivery` (count badge if failed-in-last-24h > 0) / `Reminders` (count badge: upcoming candidates) / `Templates`
- Reminders intro: `Sends the existing reminder template. No private email bodies are stored.`
- Delivery empty (no filters): `No email events logged yet`
- Delivery empty (with filters): `No email events match your filters`
- Reminders empty: `No upcoming bookings need a reminder. Everyone's confirmed.`
- Resend success toast: `Reminder sent to {first_name}.`
- Resend failure toast: `Couldn't send to {first_name}. Try again or check the email address.`
- Missing recipient row chip: `No recipient on file`
- Denied state: `Email access limited` / `You need email or booking-management access to see delivery status. Ask the practice owner.` — no raw `view_email_logs` identifier
- Search-too-short copy: `Type at least 4 characters of an email or event ID.`

**Evidence to surface:**
- List of copy surfaces changed (with before/after) — OR `CLARIFY_RESULT: copy already matches brief §8 + Copy block`
- Append `step-10: COMPLETE — clarify run, copy verified` and cat progress file

---

## Step 11 — Verify (Step 6 from workflow guide)

**Action:** Three sub-checks in order.

### 11a — Token-drift lint

```bash
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/emails/page.tsx
grep -nE 'oklch\(' src/app/admin/emails/page.tsx
grep -nE '\[[0-9]+px\]' src/app/admin/emails/page.tsx
grep -nE "font-family:\s*['\"]" src/app/admin/emails/page.tsx
grep -nE 'text-(red|emerald|orange|amber|green)-[0-9]+' src/app/admin/emails/page.tsx
grep -nE 'border-l-4' src/app/admin/emails/page.tsx
grep -nE 'view_email_logs' src/app/admin/emails/page.tsx
```

For each match, confirm the value comes from a DESIGN.md token. Particular attention: the `error_message` line should use Cancelled-family tokens, not raw `text-red-700`. The `view_email_logs` raw identifier must be 0.

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1440)

- Sign in at `/admin/login` with `test.admin@rahmatherapy.example.test` / `AdminTest123!`
- Navigate to `/admin/emails` at each viewport
- Save final-state screenshots: `emails-final-{375,768,1440}.png` to `/redesign/screenshots/emails-redesign/`
- Click `Reminders` tab → verify URL updates to `?tab=reminders` and `aria-current="page"` on the active tab
- Click `Send reminder` on the first upcoming row → verify `aria-busy` during request → Sonner success toast `Reminder sent to <first_name>.` → "Last reminder" sub-line updates without full reload
- Apply Delivery filter `delivery_status=failed` → verify URL gains the param, chip renders, list narrows
- Click `Clear filters` → verify chips clear and full list returns
- Click `Load more` on Delivery → verify next 50 rows append in place without scroll jump
- Sign out, sign in as a Therapist (no permissions) → navigate to `/admin/emails` → verify `AdminAccessDenied` renders with documented copy (no raw `view_email_logs`)

### 11c — Console + Network

- Print last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md`
- Print network requests during resend click — verify the POST to `sendManualBookingReminder` with `booking_id` in the form body (preserved verbatim) + GET refresh of the Reminders list

**Evidence to surface:**
- All seven grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix)
- 3 final screenshots in `/redesign/screenshots/emails-redesign/`
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — `/impeccable audit emails` + `/impeccable critique emails` + functional smoke test

### 12a — Audit
Invoke Skill with `/impeccable audit emails`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## emails — audit`:
- 5 dimension scores
- P0/P1/P2/P3 findings, each on its own line
- Backend status: `FAKE` — `BUILD-email-delivery-filter-query.md` + `BUILD-automated-booking-reminders.md` still BLOCKS-REDESIGN; FAKE markers in code

**Print the appended section to chat.**

**If any P0 finding: emit `P0_FOUND:` followed by the list and STOP.**

### 12b — Critique
Invoke Skill with `/impeccable critique emails`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## emails — critique`:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

**Print the appended section to chat.**

If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder emails` OR `/impeccable distill emails`, then re-run `/impeccable critique emails`. Loop max 2 times.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code:

- [ ] Tab strip: `?tab=` deep-links resolve to the correct default; `aria-current="page"` set on the active tab; mobile pill row scrolls horizontally without overflow
- [ ] `<input type="hidden" name="booking_id">` present on every Reminders row in the DOM
- [ ] `sendManualBookingReminder` server action wired verbatim on each row (no `fetch` / `XHR` replacement)
- [ ] Resend round-trip: `aria-busy` → success Sonner → "Last reminder" sub-line updates without full reload
- [ ] Resend failure path: forced server-action throw → Cancelled toast with Retry, no auto-dismiss, no row state mutation
- [ ] Filter contract: every Delivery filter combination produces a URL with the documented param names; deep-link survives reload
- [ ] Pagination: Load more appends 50 rows in place; URL gains no offset param (server reads cursor from the last visible row)
- [ ] Copy provider message ID: click on mono token → Sonner `Copied event ID`
- [ ] Expand error: native `<details>` keyboard-operable
- [ ] Role pass: Owner / Admin/PM / Coordinator-resend-only / Coordinator-both / Therapist — tab visibility, filter visibility, `recipient_role` filter options, `AdminAccessDenied` content match brief §11
- [ ] `AdminAccessDenied` (Therapist) contains no raw `view_email_logs` identifier
- [ ] Mobile filter `AdminSheet` traps focus; Esc dismisses
- [ ] Resend buttons announce target name in accessible name (`Send reminder to <first_name>`)

**Evidence to surface:**
- Both PER-PAGE-SCORES.md sections printed to chat (audit + critique)
- Functional smoke test checklist printed with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit/critique/smoke clean` and cat progress file

---

## Step 13 — Handoff (NO COMMIT — wait for user approval)

**Action:**
1. Run `git diff --stat` in the worktree — print to chat
2. Compare changed-files list against `/redesign/per-page-scope/emails-scope.md`. For any file changed that isn't in the scope file's "Files to edit" list: STOP and emit `SCOPE_VIOLATION: <file>`. Otherwise: `SCOPE_CLEAN: only scoped files changed`.
3. Run `git diff` (full) and confirm nothing unexpected appears — print the diff to chat in collapsible form.
4. Emit the handoff message to chat with:
   - Dev server URL: `http://localhost:3001/admin/emails`
   - All screenshot paths
   - Audit + critique key scores
   - Backend status: `FAKE` until 2 BLOCKS-REDESIGN BUILDs land (`email-delivery-filter-query`, `automated-booking-reminders`); gates Phase 7
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
13. `## emails — audit` and `## emails — critique` headings appended (printed to chat from the file)
14. `SMOKE_TEST: all PASS`
15. `SCOPE_CLEAN: only scoped files changed`
16. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
