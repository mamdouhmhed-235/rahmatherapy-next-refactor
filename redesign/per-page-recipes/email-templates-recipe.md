# /goal recipe — page: email-templates (21 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/email-templates-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `email-templates` |
| Page row in IMPLEMENTATION-PLAN.md | row 21 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/email-templates-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (email-templates section) |
| Source files to edit | `src/app/admin/emails/components/` (net-new directory: TemplateBrowser, TemplatePreviewPanel, TemplateEditForm, ManualSendSheet) + `src/app/admin/email-templates/preview/[id]/route.ts` (preview route handler) + `src/app/admin/email-templates/actions.ts` (save + send server actions) + `src/app/admin/emails/page.tsx` (**scoped: swap-in only** — import `<TemplatesTab />` and replace the stub the `emails` session laid; do NOT rebuild the tab shell or touch Delivery / Reminders bodies) |
| Worktree | this checkout — branch `agent/email-templates-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3001` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `FAKE` — depends on BLOCKS-REDESIGN `BUILD-email-template-overrides-table.md` + `BUILD-email-templates-actions.md` + `BUILD-email-templates-preview-route.md` + `BUILD-rbac-permission-email-templates.md`. Until built, the Templates tab renders the browser + preview against the in-code defaults from `templates.ts` (SERVER ONLY); the edit form posts to a stub that returns "Couldn't save the override — table not yet provisioned" (mark FAKE comments at the call sites). The Reminders + Delivery log tabs (handled in the emails recipe) remain wired to existing actions. |
| Progress scratchpad | `/redesign/per-page-progress/email-templates-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `src/lib/email/templates.ts` — SERVER ONLY; the `render*Email()` functions are the canonical source. The new override layer reads from a future DB table; this file remains the fallback. NEVER edit strings here.
   - `src/lib/email/**` — all Resend sender helpers
   - `src/app/admin/emails/actions.ts` — `sendManualBookingReminder`; extend via the NEW `src/app/admin/email-templates/actions.ts` file, never by editing this one
   - `src/lib/auth/**`, `src/lib/supabase/**`, `src/middleware.ts` (RECON §5)
   - `supabase/migrations/**` — Phase 6 adds the `email_template_overrides` migration via the BUILD plan, not via this recipe
   - All build/config files
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve the existing emails-page features in the tab shell:** `sendManualBookingReminder` wire-up on the Reminders tab; Resend delivery log display on the Delivery log tab; `<input type="hidden" name="booking_id">` on each reminder row.
6. **`templates.ts` SERVER ONLY constraint:** the preview route handler must call `render*Email()` server-side. No import of `templates.ts` from any Client Component.
7. **New audit writes** that Phase 6 must add when BUILDs land: `email_template_override_saved` and `email_template_sent_manually`. Mark the call sites in `actions.ts` so the audit-row insert happens server-side once the BUILDs are in place.
8. **Run the `emails` session FIRST.** This recipe assumes `src/app/admin/emails/page.tsx` already contains a tab shell + a Templates-tab stub (laid by the emails session per its Step 4 framing). If you do not find the literal stub marker `Templates tab body — populated by the email-templates session` in `src/app/admin/emails/page.tsx`, emit `STUCK: <step> — emails session has not laid the tab shell; run the emails recipe first, then re-dispatch this one`. Your edit to `emails/page.tsx` is limited to: (a) import the new `<TemplatesTab />` from `./components`, (b) replace the stub JSX with `<TemplatesTab />`. That's it — no tab-shell rebuild, no Delivery/Reminders changes.

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
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `email-templates`
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; search for the email-templates row

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
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/email-templates-progress.md` and cat it.

---

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: email-templates
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/email-templates-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (Reminders/Delivery existing wire-ups, `templates.ts` SERVER ONLY constraint, new audit writes Phase 6 must add)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for email-templates)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/email-templates-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

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

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (email-templates) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
> - /redesign/briefs/email-templates-brief.md  ← THIS IS THE PREPARED BRIEF
>
> Tell me before writing any code:
> - Files you will edit (including the new component directory + preview route + actions file)
> - Files you will NOT touch (from the brief's untouchable list — particularly `templates.ts` and `emails/actions.ts`)
> - Features you are preserving (Reminders + Delivery wire-ups, `booking_id` hidden field)
> - Any conflict between brief and codebase
>
> (You are running under `/goal`, so "wait for my go-ahead" → instead print the file list to chat with a literal `SCOPE_PROPOSAL:` prefix, then proceed.)
>
> WRITE THE PER-PAGE SCOPE TO DISK before craft runs:
> Write to `/redesign/per-page-scope/email-templates-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> **Important scope note:** `src/app/admin/emails/page.tsx` belongs in "Files to edit" but with the **limited scope** of swapping the Templates-tab stub for the real `<TemplatesTab />` component (import + JSX replacement only — 2 lines maximum). The tab shell, Delivery body, and Reminders body were laid by the `emails` session and must NOT be re-styled or re-structured by THIS session. Document the swap-in scope explicitly in the scope file.
>

> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/email-templates-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1440. Two-panel split activates at ≥768px; mobile collapses to single column with `AdminMobileActionBar` for Save/Send.
>
> IMAGE HANDLING: append `templates-empty.svg` (envelope illustration, ~80–120px) to IMAGES-NEEDED.md.
>
> BACKEND FAKE MARKER: this surface depends on FOUR BLOCKS-REDESIGN BUILDs (`email-template-overrides-table`, `email-templates-actions`, `email-templates-preview-route`, `rbac-permission-email-templates`). Mark every server-action call site with `// FAKE: BUILD-<name>` comments. The preview iframe falls back to a placeholder rendered HTML page when the preview route handler isn't built. The save form posts to a stub returning the Cancelled toast.

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list (including the new component directory + preview route + actions file)
- `/redesign/per-page-scope/email-templates-scope.md` written; print its contents to chat
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- Append `step-3: COMPLETE — scope written, plan updated` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page email-templates`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page email-templates`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/email-templates-brief.md. Compare the current implementation to the brief's requirements (10 native sections + audience variants + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3001 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-email-templates-redesign"
pnpm next dev -p 3001
```

Use `run_in_background: true`. Poll `http://localhost:3001/admin/emails?tab=templates` until it returns HTTP 200 (or 308). Max wait: 60 seconds.

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

Sign in as `test.admin@rahmatherapy.example.test` / `AdminTest123!` at `/admin/login`. Take screenshots and save to `/redesign/screenshots/email-templates-redesign/`:
- `chunk1-1440-empty.png` at 1440×900 navigating to `/admin/emails?tab=templates` (no template selected — right panel shows `EmptyState`)
- `chunk1-1440-selected.png` at 1440×900 with a customer template selected (preview iframe + editable fields panel)
- `chunk1-1440-staff-template.png` at 1440×900 with the assignment-notification template selected
- `chunk1-1440-admin-internal.png` at 1440×900 with an admin-internal template selected (verify the `Internal only` banner above the iframe)
- `chunk1-1440-sheet.png` at 1440×900 with the manual-send `AdminSheet` open
- `chunk1-768-selected.png` at 768×1024 (two-panel layout)
- `chunk1-375-default.png` at 375×812 (single-column collapse, `AdminMobileActionBar` visible)

> **Heads up on session-cookie bleed:** if signed in as a Therapist, the edit panel is hidden and only the Ghost `Send` per card is active. If your first screenshot at 1440 shows that variant, re-sign-in as the admin and retake.

Self-assess against the brief. If you can identify ONE specific axis problem:

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder email-templates` |
| Too loud, too many colours | `/impeccable quieter email-templates` |
| Grey, lifeless, no identity | `/impeccable colorize email-templates` |
| Fonts feel default or inconsistent | `/impeccable typeset email-templates` |
| Spacing is off, things feel cramped | `/impeccable layout email-templates` |
| Static, jumpy, no motion | `/impeccable animate email-templates` |
| Functional but cold | `/impeccable delight email-templates` |
| Too much on the page | `/impeccable distill email-templates` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

If a refine runs, re-screenshot with `-after-refine` suffix.

**Evidence to surface:**
- 7+ screenshot file paths printed to chat
- Literal decision: `ITERATE_DECISION: no refine needed — <brief-justified reason>` OR `ITERATE_DECISION: ran /impeccable <axis> email-templates because <reason>`
- Append `step-7: COMPLETE — iterate decision logged` and cat progress file

---

## Step 8 — `/impeccable adapt email-templates for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt email-templates for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/email-templates-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/email-templates-adapt-after-mobile.png`
3. Confirm no horizontal scroll at either breakpoint
4. Confirm `AdminMobileActionBar` sticks to the bottom on mobile with Save + Send actions reachable at ≥44px tap target
5. Confirm `AdminSheet` (manual-send) opens from the right on desktop and traps focus; behaves correctly on mobile
6. Confirm preview iframe scales to viewport width on mobile (no horizontal overflow on the iframe content)

**Evidence to surface:**
- Two `email-templates-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target height for `Send` Ghost button on a card at mobile (`TOUCH_TARGET_SEND_MOBILE: <px>`)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden email-templates`

**Action:** Invoke Skill with `/impeccable harden email-templates`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-email-templates.md`. Implement what harden recommends per the brief's `## 6. Key States` table. Particular attention to:
- No template selected: `EmptyState` envelope illustration, "Select a template to preview"
- Loading: `AdminSkeleton` for iframe + 3 skeleton inputs
- Preview load failure: Cancelled-family `role="alert"` region with Ghost `Try again`
- Save error: Sonner toast (persistent, Ghost Retry) + inline `role="alert"` region below form
- Read-only mode (Therapist): editable panel hidden, `text-muted` notice above preview
- Unsaved-changes guard: navigating to a different template / different tab triggers Discard modal
- Admin-internal-template banner above the iframe: `Internal only — not seen by clients or therapists.`
- Permission denied page-level: `AdminAccessDenied` with copy `You don't have access to email templates. Contact the owner.`
- Plain-text companion (`renderBookingPlainText`): renders as IBM Plex Mono block on `surface-card`, NOT in an iframe

Verification edge cases (email-templates-specific):
- Greeting-intro field at 300 characters doesn't overflow the form input
- Variable token like `{clientName}` renders literally in the preview (no substitution leakage in the editor view)
- HTML/script tags pasted into a safe field are stripped server-side with the documented error
- `sandbox="allow-same-origin"` is present on the iframe; pointer-events disabled to prevent stealing focus
- Preview iframe never executes JS (no `allow-scripts` in sandbox)

**Evidence to surface:**
- `/redesign/HARDEN-RECS-email-templates.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-email-templates.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify email-templates`

**Action:** Invoke Skill with `/impeccable clarify email-templates`.

Verify copy matches the brief's `## 8. Content Requirements` and `## Copy` sections exactly. Specifically:
- Tab labels: `Templates` / `Reminders` / `Delivery log` with `aria-current="page"` on active
- No-selection heading: `Select a template to preview`
- Editable-fields tooltip: `These fields are safe to edit. Booking details, IDs, and participant data are generated automatically.`
- Read-only notice: `You can view but not edit these templates. Contact the owner to make changes.`
- Admin-template internal banner: `Internal only — not seen by clients or therapists.`
- Unsaved-changes confirm: `Leave without saving?` / `Your edits to "{template name}" will be lost.` / Destructive `Leave` + Secondary `Keep editing`
- Save success toast: `Template updated.`
- Save failure toast: `Changes couldn't be saved. Try again.` (persistent, Retry)
- Manual send success toast: `Sent "{template name}" to {email}.`
- Validation copy verbatim from brief §Copy (over-length, malformed variable, HTML/script, save failure, invalid email, etc.)
- Denied state: `You don't have access to email templates` / `Templates are managed by the owner and admin. Ask one of them.` — no raw permission identifier

**Evidence to surface:**
- List of copy surfaces changed (with before/after) — OR `CLARIFY_RESULT: copy already matches brief §8 + Copy block`
- Append `step-10: COMPLETE — clarify run, copy verified` and cat progress file

---

## Step 11 — Verify (Step 6 from workflow guide)

**Action:** Three sub-checks in order.

### 11a — Token-drift lint + SERVER-ONLY guard

```bash
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/emails/page.tsx src/app/admin/emails/components/*.tsx src/app/admin/email-templates/**/*.ts*
grep -nE 'oklch\(' src/app/admin/emails/components/*.tsx src/app/admin/email-templates/**/*.ts*
grep -nE '\\d+px' src/app/admin/emails/components/*.tsx
grep -nE "font-family:\s*['\"]" src/app/admin/emails/components/*.tsx

# Raw spacing literals (canon: should match the spacing scale in DESIGN.md)
grep -nE '(margin\|padding):\s*\d' src/app/admin/emails/components/*.tsx
grep -nE 'text-(emerald|orange|red|amber|green)-[0-9]+' src/app/admin/emails/components/*.tsx
grep -nE 'border-l-4' src/app/admin/emails/components/*.tsx
# SERVER ONLY guard — templates.ts must NOT be imported from any client component
grep -rn 'from .*lib/email/templates' src/app/admin/emails/components/ src/app/admin/email-templates/components/ 2>/dev/null || echo "no client-side templates.ts imports — pass"
```

For each match, confirm the value comes from a DESIGN.md token. The SERVER-ONLY grep must return `no client-side templates.ts imports — pass` (or 0 hits in client component files). Active template card must use full `border-default` border, NOT `border-l-4`.

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1440)

- Sign in at `/admin/login` with `test.admin@rahmatherapy.example.test` / `AdminTest123!`
- Navigate to `/admin/emails?tab=templates` at each viewport
- Save final-state screenshots: `email-templates-final-{375,768,1440}.png`
- Click each accordion group header → verify expand/collapse animation
- Select a customer template → verify iframe loads via preview route + editable fields panel renders
- Edit the `Footer contact line` field → verify Save button activates → click Save → verify Sonner success toast `Template updated.` + "Saved just now" label appears (or, if BUILDs not yet handled, verify the FAKE Cancelled toast)
- Unsaved-changes guard: edit a field → click a different template card → verify `Leave without saving?` modal renders → click `Keep editing` → focus returns to the field
- Click `Send` Ghost on any card → verify `AdminSheet` slides in from the right → focus moves to the `Send to` input
- Switch to `Reminders` tab → verify state in `Templates` tab persists (selected card + any unsaved edits)
- Sign out, sign back in as Therapist → navigate to `/admin/emails?tab=templates` → verify editable panel is hidden + read-only notice renders + `Send` Ghost remains active

### 11c — Console + Network

- Print last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md`
- Print network requests during template selection — verify the iframe fetches from the preview route (`/admin/email-templates/preview/[id]`) and NOT from any client-side `templates.ts` import
- Verify (when BUILDs handled) the `audit_logs` table receives `email_template_override_saved` row on save (Supabase inspector)

**Evidence to surface:**
- All seven grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix)
- Literal line `SERVER_ONLY_GUARD: no client-side templates.ts imports`
- 3 final screenshots in `/redesign/screenshots/email-templates-redesign/`
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — `/impeccable audit email-templates` + `/impeccable critique email-templates` + functional smoke test

### 12a — Audit
Invoke Skill with `/impeccable audit email-templates`.

**Severity rubric — anchor every finding before tagging (impeccable v5 L884-890):**
- **P0** Blocks release — fix before shipping anything
- **P1** Fix this sprint — significant impact on users
- **P2** Next cycle — noticeable but not blocking
- **P3** Polish — minor, fix when time allows

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## email-templates — audit`:
- 5 dimension scores
- P0/P1/P2/P3 findings, each on its own line
- Backend status: `FAKE` — four BLOCKS-REDESIGN BUILDs (`email-template-overrides-table`, `email-templates-actions`, `email-templates-preview-route`, `rbac-permission-email-templates`) gate Phase 7. FAKE markers in code at every server-action call site.
- **P1 (tag for Phase 7 gauntlet):** subsection — list each P1 finding with location + file:line; if zero, write `none`. Phase 7 `/impeccable audit admin` re-scans this section.
- **BUSINESS-COMPLETENESS impact:** subsection — name any `redesign/BUSINESS-COMPLETENESS.md` items this page newly contributes to (e.g. `2A-6` if form-level error `role="alert"` was implemented). Lets the universal flag flip `PARTIAL` → `HANDLED` when all form-bearing pages adopt.

**Print the appended section to chat.**

**If any P0 finding: emit `P0_FOUND:` followed by the list and STOP.**

### 12b — Critique
Invoke Skill with `/impeccable critique email-templates`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## email-templates — critique`:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

**Print the appended section to chat.**

If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder email-templates` OR `/impeccable distill email-templates`, then re-run `/impeccable critique email-templates`. Loop max 2 times.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code:

- [ ] Tab switching `Templates` → `Reminders` → `Delivery log` preserves state in the Templates tab (selected card, unsaved field value, scroll position)
- [ ] `sendManualBookingReminder` action still wired on the Reminders tab; `<input type="hidden" name="booking_id">` present on each reminder row
- [ ] Resend delivery log display renders on the Delivery log tab unchanged (token-only restyle)
- [ ] `templates.ts` is not imported from any client component (SERVER ONLY constraint holds)
- [ ] Preview iframe has `sandbox="allow-same-origin"` attribute; no `allow-scripts`
- [ ] Editable fields panel hidden for Therapist; `Send` Ghost still active on cards
- [ ] Unsaved-changes guard fires on tab switch / template-card switch / nav-away
- [ ] Save success: Sonner `Template updated.` toast + "Saved just now" label + `email_template_override_saved` audit row written (when BUILDs handled)
- [ ] Manual send: `AdminSheet` slides in → `Send to` email validated → `Send now` Primary calls action → success toast + `email_template_sent_manually` audit row written (when BUILDs handled)
- [ ] Active template card uses full `border-default` border, NOT `border-l-4` (absolute ban)
- [ ] Heading hierarchy: AdminPageHeader H1 → group labels `<h2>` → template card names `<h3>` — no skips
- [ ] Every editable field has a visible `<label>` element with matching `for`/`id`
- [ ] Save error region has `role="alert" aria-live="polite" aria-atomic="true"`
- [ ] `Send` button accessible name carries template context (e.g. `Send booking confirmation`)
- [ ] `AdminAccessDenied` (Therapist hit + no `manage_email_templates`) renders without raw permission identifier

**Evidence to surface:**
- Both PER-PAGE-SCORES.md sections printed to chat (audit + critique)
- Functional smoke test checklist printed with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit/critique/smoke clean` and cat progress file

---

## Step 13 — Handoff (NO COMMIT — wait for user approval)

**Action:**
1. Run `git diff --stat` in the worktree — print to chat
2. Compare changed-files list against `/redesign/per-page-scope/email-templates-scope.md`. For any file changed that isn't in the scope file's "Files to edit" list: STOP and emit `SCOPE_VIOLATION: <file>`. Otherwise: `SCOPE_CLEAN: only scoped files changed`.
3. Run `git diff` (full) and confirm nothing unexpected appears — print the diff to chat in collapsible form.
4. Emit the handoff message to chat with:
   - Dev server URL: `http://localhost:3001/admin/emails?tab=templates`
   - All screenshot paths
   - Audit + critique key scores
   - Backend status: `FAKE` until 4 BLOCKS-REDESIGN BUILDs land (gates Phase 7)
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
12. `SERVER_ONLY_GUARD: no client-side templates.ts imports`
13. `CONSOLE_NEW_ERRORS: 0`
14. `## email-templates — audit` and `## email-templates — critique` headings appended (printed to chat from the file)
15. `SMOKE_TEST: all PASS`
16. `SCOPE_CLEAN: only scoped files changed`
17. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
