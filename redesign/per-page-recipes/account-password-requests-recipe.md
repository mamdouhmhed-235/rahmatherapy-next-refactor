# /goal recipe — page: account-password-requests (12 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/account-password-requests-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `account-password-requests` |
| Page row in IMPLEMENTATION-PLAN.md | row 12 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/account-password-requests-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (account-password-requests section) |
| Source files to edit | `src/app/admin/account-password-requests/page.tsx`, `src/app/admin/account-password-requests/RequestRow.tsx`, `src/app/admin/account-password-requests/ApproveModal.tsx`, `src/app/admin/account-password-requests/RejectModal.tsx` (all net-new — greenfield surface) |
| Worktree | this checkout — branch `agent/account-password-requests-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3001` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `FAKE` — BLOCKS-REDESIGN BUILD plans `BUILD-rbac-permission-account-password-requests.md` (Layer 0 #1), `BUILD-password-reset-email-templates.md` (Layer 0 #2), and `BUILD-approve-reject-password-reset.md` (Layer 1 #25) are still `[ ]` per IMPLEMENTATION-PLAN.md footer. UI ships against FAKE data wiring; real server actions land before Phase 7. |
| Progress scratchpad | `/redesign/per-page-progress/account-password-requests-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `supabase/migrations/**` — the `account_password_requests` table already exists; no schema changes
   - `src/lib/auth/**` — RBAC matrix logic; permission seeded out-of-band, not edited in code from here
   - `src/lib/supabase/**` — client factories used unchanged (RECON §5)
   - `src/middleware.ts` — route added to admin-protected set, but middleware logic untouched
   - `src/app/admin/audit/**` — Brief 11 owns these; cross-link target only
   - `src/app/admin/password-reset/**` — Brief 10 owns the sibling staff-facing flow
   - `src/app/admin/components/admin-ui-interactions.tsx` — `ConfirmActionModal` primitive used as-is, no modifications
   - All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.)
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve modal form `name` attributes** verbatim: `reviewer_note` on both Approve and Reject textareas.
6. **Preserve the GET-form tab contract:** `?status=pending|approved|rejected|expired|all`. Pending is the default when `?status` is absent.
7. **Server-action contract (forward-looking):** `approvePasswordResetRequest({ requestId, reviewerNote? })` and `rejectPasswordResetRequest({ requestId, reviewerNote })`. Both must keep being invoked via `<form action={…}>`. No `fetch` / no `XHR` replacement.

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
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `account-password-requests` for page-specific entries
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; lines 435–475 for the account-password-requests row; lines 1140–1180 for BUILD-plan layer 0/1 status

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
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/account-password-requests-progress.md` and cat it.

---

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: account-password-requests
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/account-password-requests-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for account-password-requests)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/account-password-requests-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

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

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (account-password-requests) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
> - /redesign/briefs/account-password-requests-brief.md  ← THIS IS THE PREPARED BRIEF
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
> Write to `/redesign/per-page-scope/account-password-requests-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/account-password-requests-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1440.
>
> IMAGE HANDLING: no new illustrations needed. The `EmptyState` "All caught up" uses the Confirmed-family lock-with-check illustration already produced by `00-shared-components`. Do NOT add `data-redesign-needs-photo`.
>
> BACKEND FAKE MARKER: account-password-requests has BLOCKS-REDESIGN BUILD plans (`BUILD-rbac-permission-account-password-requests.md`, `BUILD-password-reset-email-templates.md`, `BUILD-approve-reject-password-reset.md`) that are still `[ ]`. Mark every feature whose final wiring depends on those plans with `data-redesign-backend="FAKE"` and a comment block citing the BUILD plan filename. Affected surfaces: the Approve / Reject server actions (call into Supabase Auth admin-API + Resend), the `manage_account_password_requests` permission gate, the two email templates carried by the two server actions. UI ships using mocked action handlers that no-op + write nothing real; row data fetched from `account_password_requests` directly is fine since the table already exists.

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list
- `/redesign/per-page-scope/account-password-requests-scope.md` written; print its contents to chat
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- List of `data-redesign-backend="FAKE"` surfaces printed to chat as `BACKEND_FAKE_SURFACES:` bullets
- Append `step-3: COMPLETE — scope written, plan updated, FAKE surfaces marked` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page account-password-requests`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page account-password-requests`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/account-password-requests-brief.md. Compare the current implementation to the brief's requirements (11 native sections + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3001 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-account-password-requests-redesign"
pnpm next dev -p 3001
```

Use `run_in_background: true`. Poll `http://localhost:3001/admin/account-password-requests` until it returns HTTP 200 (or 308 — that's a trailing-slash redirect which Playwright handles). Max wait: 60 seconds.

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

Sign in first as `test.admin@rahmatherapy.example.test` / `AdminTest123!` (Owner-equivalent for full Approve/Reject surface). Then take screenshots and save to `/redesign/screenshots/account-password-requests-redesign/`:
- `chunk1-1440-default.png` at 1440×900 (Pending tab default, one+ requests visible)
- `chunk1-768-default.png` at 768×1024
- `chunk1-375-default.png` at 375×812
- `chunk1-1440-approved.png` at 1440×900 navigating to `/admin/account-password-requests?status=approved`
- `chunk1-1440-empty.png` at 1440×900 navigating to `/admin/account-password-requests?status=expired` (likely empty in seed data → renders "No expired requests")
- `chunk1-1440-approve-modal.png` with the Approve `ConfirmActionModal` open

> **Heads up on seed data:** the brief notes one pending row exists in production; the test database may have zero. If the Pending tab renders the "All caught up" empty state at the default URL, screenshot that state instead and seed a pending row before Step 11 verification (or use the SQL console to insert a test row).

Self-assess against the brief. If you can identify ONE specific axis problem:

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder account-password-requests` |
| Too loud, too many colours | `/impeccable quieter account-password-requests` |
| Grey, lifeless, no identity | `/impeccable colorize account-password-requests` |
| Fonts feel default or inconsistent | `/impeccable typeset account-password-requests` |
| Spacing is off, things feel cramped | `/impeccable layout account-password-requests` |
| Static, jumpy, no motion | `/impeccable animate account-password-requests` |
| Functional but cold | `/impeccable delight account-password-requests` |
| Too much on the page | `/impeccable distill account-password-requests` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

If a refine runs, re-screenshot with `-after-refine` suffix.

**Evidence to surface:**
- 5+ screenshot file paths printed to chat (`ls redesign/screenshots/account-password-requests-redesign/`)
- Literal decision: `ITERATE_DECISION: no refine needed — <brief-justified reason>` OR `ITERATE_DECISION: ran /impeccable <axis> account-password-requests because <reason>`
- Append `step-7: COMPLETE — iterate decision logged` and cat progress file

---

## Step 8 — `/impeccable adapt account-password-requests for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt account-password-requests for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/account-password-requests-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/account-password-requests-adapt-after-mobile.png`
3. Confirm no horizontal scroll at either breakpoint (Playwright: check `document.documentElement.scrollWidth <= window.innerWidth`)
4. Confirm tab strip is horizontally scrollable on mobile (momentum scroll) and that all three action buttons stack full-width on mobile per brief §5
5. Confirm Approve/Reject modal renders as a full-screen sheet from the bottom on mobile (per DESIGN.md §6 motion-token mobile bias)

**Evidence to surface:**
- Two `account-password-requests-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target height for Approve and Reject buttons on mobile (`TOUCH_TARGET_APPROVE_MOBILE: <px>`, `TOUCH_TARGET_REJECT_MOBILE: <px>`)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden account-password-requests`

**Action:** Invoke Skill with `/impeccable harden account-password-requests`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-account-password-requests.md`. Implement what harden recommends (empty / loading / error / race-condition / self-approval / 240-char overflow / hostile reviewer text) per the brief's `## 6. Key States` section. For each state listed in the brief that harden didn't surface, add it anyway.

Verification edge cases (account-password-requests-specific):
- 80-character email address doesn't break the row layout at 375px (mobile truncates with `title` tooltip)
- Reject modal with empty `reviewer_note` displays `role="alert"` "Add a note before rejecting. The requester needs to know why." and the Destructive button does NOT enter loading state
- Reviewer note with 240 chars renders fully; 241 chars are truncated server-side (client `maxLength` enforces)
- Race-condition copy "This request was just reviewed by {other reviewer}." renders Cancelled family region above the modal footer
- Self-approval attempt renders the "You can't approve your own request." error region; DB row untouched
- Reviewer-note well renders plain text even if DB row contains HTML or `<script>` tags (React default escaping; no `dangerouslySetInnerHTML`)
- Admin role hides the "Open audit row" Ghost link entirely (not greyed-out); resolved rows show the Soft Slate "Audit details available to the owner only." line

**Evidence to surface:**
- `/redesign/HARDEN-RECS-account-password-requests.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-account-password-requests.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify account-password-requests`

**Action:** Invoke Skill with `/impeccable clarify account-password-requests`.

Verify copy matches the brief's `## Copy` section exactly (or has been tightened for layout — that's allowed). Specifically:
- H1 "Password-reset requests"; subtitle "Approve or reject staff requests to reset their password. Approval sends a one-time link to the requester's email."
- Tab labels: Pending / Approved / Rejected / Expired / All (Pending carries count: "Pending ({N})" when active)
- Approve modal H2 "Approve this request?"; body "An approval email with a one-time reset link will be sent to {email}. The link expires in 24 hours."
- Reject modal H2 "Reject this request?"; body "A rejection email will be sent to {email}. The requester will see the note you write below."
- Reject empty-note error: "Add a note before rejecting. The requester needs to know why."
- Self-approval error: "You can't approve your own request. Ask another owner or admin to review."
- Race-condition error: "This request was just reviewed by {other reviewer}. Refresh to see the latest."
- Email-send failure: "Couldn't send the email. Try again in a minute."
- Empty-states verbatim per brief §8 table (Pending zero: "All caught up" / "No password-reset requests are waiting for review.")
- Denied (Coordinator / Therapist): "You don't have access to this section" + "Password-reset reviews are restricted to the practice owner and admin. Contact one of them if you think this is a mistake."
- Toast success copy verbatim: "Approval email sent to {email}." / "Rejection email sent to {email}."
- Voice matches `PRODUCT.md` Brand Personality; no apology copy on rejection; no "we're sorry" or "unfortunately"

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
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/account-password-requests/*.tsx

# Raw oklch() literals (should be 0 — colors come from tokens)
grep -nE 'oklch\(' src/app/admin/account-password-requests/*.tsx

# Raw px values outside @media queries (canon: should be 0 outside @media rules)
grep -nE '\\d+px' src/app/admin/account-password-requests/*.tsx

# font-family literals (should be 0)
grep -nE "font-family:\s*['\"]" src/app/admin/account-password-requests/*.tsx

# Raw spacing literals (canon: should match the spacing scale in DESIGN.md)
grep -nE '(margin\|padding):\s*\d' src/app/admin/account-password-requests/*.tsx
```

For each match, confirm the value comes from a DESIGN.md token. If a hardcoded value isn't backed by a token, FIX IT — either add the token to DESIGN.md (only with user approval, otherwise STUCK) or replace with the existing token. Particular attention to the Reject modal's Cancelled-family error region (must use `var(--admin-cancelled)` and `var(--admin-cancelled-bg)`, not raw `oklch()`).

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1440)

- Sign in as `test.admin@rahmatherapy.example.test` / `AdminTest123!`
- Navigate to `/admin/account-password-requests` at each viewport
- Save final-state screenshots: `account-password-requests-final-{375,768,1440}.png` to `/redesign/screenshots/account-password-requests-redesign/`
- Click the Approve button on a Pending row → modal opens; type a note; click "Send approval email" → confirm the FAKE handler (no real email sent) resolves and the row updates visually (or the FAKE marker is honoured per Step 3); screenshot the toast
- Click the Reject button on a Pending row → modal opens; leave the note empty + click "Send rejection email" → confirm `role="alert"` error fires; type a note; submit; screenshot the toast
- Click a tab (e.g. Approved) → URL changes to `?status=approved`; deep-link by reloading → state persists
- Sign out via `/admin/signout` to leave a clean session for downstream pages

### 11c — Console + Network

- Print last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md` (warnings OK)
- Print network requests during the Approve / Reject flow — verify no calls leave the localhost surface other than the form POST to the FAKE server action (BUILD plans not landed yet)

**Evidence to surface:**
- All four grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix)
- 3 screenshot files in `/redesign/screenshots/account-password-requests-redesign/`: `account-password-requests-final-{375,768,1440}.png`
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — `/impeccable audit account-password-requests` + `/impeccable critique account-password-requests` + functional smoke test

### 12a — Audit
Invoke Skill with `/impeccable audit account-password-requests`.

**Severity rubric — anchor every finding before tagging (impeccable v5 L884-890):**
- **P0** Blocks release — fix before shipping anything
- **P1** Fix this sprint — significant impact on users
- **P2** Next cycle — noticeable but not blocking
- **P3** Polish — minor, fix when time allows

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## account-password-requests — audit`:
- 5 dimension scores
- P0/P1/P2/P3 findings, each on its own line
- Backend status: `FAKE` — BLOCKS-REDESIGN BUILD plans `BUILD-rbac-permission-account-password-requests.md`, `BUILD-password-reset-email-templates.md`, `BUILD-approve-reject-password-reset.md` still `[ ]`; UI ships against mocked handlers. Note which surfaces carry `data-redesign-backend="FAKE"`.
- **P1 (tag for Phase 7 gauntlet):** subsection — list each P1 finding with location + file:line; if zero, write `none`. Phase 7 `/impeccable audit admin` re-scans this section.
- **BUSINESS-COMPLETENESS impact:** subsection — name any `redesign/BUSINESS-COMPLETENESS.md` items this page newly contributes to (e.g. `2A-6` if form-level error `role="alert"` was implemented). Lets the universal flag flip `PARTIAL` → `HANDLED` when all form-bearing pages adopt.

**Print the appended section to chat.**

**If any P0 finding: emit `P0_FOUND:` followed by the list and STOP.** Do not proceed to handoff. The user will decide whether to fix-now or defer.

### 12b — Critique
Invoke Skill with `/impeccable critique account-password-requests`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## account-password-requests — critique`:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

**Print the appended section to chat.**

If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder account-password-requests` OR `/impeccable distill account-password-requests` based on which fits the verdict's reasoning, then re-run `/impeccable critique account-password-requests`. Loop max 2 times.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code (sign in as admin first):

- [ ] Five tab strip: clicking each tab updates `?status=` and re-renders the list; Pending is the default when `?status` is absent; `aria-current="page"` on the active tab
- [ ] Approve modal: optional note textarea has `maxLength=240`; character counter "{N} / 240" updates live; Primary "Send approval email" with loading spinner pattern
- [ ] Reject modal: required note textarea has `*` marker (`aria-hidden="true"` per DESIGN.md); empty-note submit fires `role="alert"` error and modal stays open
- [ ] Modal ESC + backdrop click closes (unless `aria-busy="true"`); focus returns to originating button
- [ ] "Open audit row" Ghost on resolved rows: Owner role renders functional link to `/admin/audit?q={requestId-first-8}`; Admin role hides the link entirely (renders "Audit details available to the owner only.")
- [ ] Role pass (sign-out + sign-in each): Owner sees full surface; Admin/PM sees full surface minus audit link; Coordinator (`test.coordinator@…`) hits `AdminAccessDenied`; Therapist (`test.therapist@…`) hits `AdminAccessDenied`
- [ ] Reviewer-note well renders plain text when DB row's `reviewer_note` contains `<script>alert(1)</script>` (React default escaping confirmed)
- [ ] No raw `manage_account_password_requests` identifier on `AdminAccessDenied` screen

**Evidence to surface:**
- Both PER-PAGE-SCORES.md sections printed to chat (audit + critique)
- Functional smoke test checklist printed with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit/critique/smoke clean` and cat progress file

---

## Step 13 — Handoff (NO COMMIT — wait for user approval)

**Action:**
1. Run `git diff --stat` in the worktree — print to chat
2. Compare changed-files list against `/redesign/per-page-scope/account-password-requests-scope.md`. For any file changed that isn't in the scope file's "Files to edit" list: STOP and emit `SCOPE_VIOLATION: <file>`. Otherwise: `SCOPE_CLEAN: only scoped files changed`.
3. Run `git diff` (full) and confirm nothing unexpected appears — print the diff to chat in collapsible form.
4. Emit the handoff message to chat with:
   - Dev server URL: `http://localhost:3001/admin/account-password-requests`
   - All screenshot paths
   - Audit + critique key scores
   - Backend status: `FAKE` with the three BUILD-plan filenames listed
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
6. `BACKEND_FAKE_SURFACES:` (list of `data-redesign-backend="FAKE"` surfaces)
7. `CRAFT_COMPLETE`
8. `PAGE-POLISH-COMPLETE` (inside `<promise>` tags)
9. `DEV_SERVER_READY at http://localhost:3001`
10. `ITERATE_DECISION:`
11. `HORIZONTAL_SCROLL_TABLET: false` and `HORIZONTAL_SCROLL_MOBILE: false`
12. `TOKEN_DRIFT: 0` (or each drift explicitly addressed)
13. `CONSOLE_NEW_ERRORS: 0`
14. `## account-password-requests — audit` and `## account-password-requests — critique` headings appended (printed to chat from the file)
15. `SMOKE_TEST: all PASS`
16. `SCOPE_CLEAN: only scoped files changed`
17. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
