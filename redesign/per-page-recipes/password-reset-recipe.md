# /goal recipe — page: password-reset (16 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/password-reset-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `password-reset` |
| Page row in IMPLEMENTATION-PLAN.md | row 16 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/password-reset-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (password-reset section) |
| Source files to edit | `src/app/admin/password-reset/page.tsx`, `src/app/admin/password-reset/[token]/page.tsx`, `src/app/admin/password-reset/actions.ts`, `src/app/admin/password-reset/PasswordResetCard.tsx`, `src/app/admin/password-reset/states/*.tsx` (all net-new — greenfield surface; six state components + shared card) |
| Logo asset (already vendored by Login session) | `public/images/brand/rahma/logo-refined.svg` |
| Worktree | this checkout — branch `agent/password-reset-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3001` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `FAKE` — BLOCKS-REDESIGN BUILD plans `BUILD-password-reset-email-templates.md` (Layer 0 #2) and `BUILD-password-reset-request-actions.md` (Layer 0 #3) are still `[ ]` per IMPLEMENTATION-PLAN.md footer. UI ships against FAKE handlers that no-op real email send + audit writes; real server actions land before Phase 7. |
| Progress scratchpad | `/redesign/per-page-progress/password-reset-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `supabase/migrations/**` — the `account_password_requests` table already exists; no schema changes
   - `src/lib/auth/**` — RBAC and admin-access helpers; this is a pre-auth surface, does NOT use `getAdminPageAccess`
   - `src/lib/supabase/**` — client factories used unchanged
   - `src/middleware.ts` — both new routes must be added to the public-route allow-list, but middleware logic itself is untouched (RECON §5)
   - `src/app/admin/login/page.tsx` — Login session owns this; the only touchpoint is the existing "Forgot your password?" Ghost link that already routes here
   - `src/app/admin/account-password-requests/**` — sibling admin-facing brief (Brief 13) owns these; cross-link target only
   - All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.)
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve form `name` attributes** verbatim:
   - State 1 / 6 inline: `name="email"`
   - State 4: `name="new_password"`, `name="confirm_new_password"`
6. **Preserve the server-action contract:** `submitPasswordResetRequest(formData)` and `setPasswordWithToken(formData)` invoked via `<form action={…}>`. No `fetch` / no `XHR` replacement.
7. **Never echo a hostile token** to the client; React's default escaping handles the `reviewer_note` plain-text rendering. NO `dangerouslySetInnerHTML` anywhere on this surface.
8. **Security-by-uniform-response:** state 1 must return identical responses for "valid staff email" and "email not found" (both render state 2 success copy). Confirm via DevTools network inspector at Step 11.

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
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `password-reset` for page-specific entries
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; lines 585–625 for the password-reset row; lines 1140–1180 for BUILD-plan layer 0 status

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
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/password-reset-progress.md` and cat it.

---

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: password-reset
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/password-reset-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for password-reset)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/password-reset-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

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

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (password-reset) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
> - /redesign/briefs/password-reset-brief.md  ← THIS IS THE PREPARED BRIEF
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
> Write to `/redesign/per-page-scope/password-reset-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/password-reset-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1440.
>
> IMAGE HANDLING: `public/images/brand/rahma/logo-refined.svg` is already tracked (Login session vendored it). Reference it as `/images/brand/rahma/logo-refined.svg` with `alt="Rahma Therapy"`, 180px desktop / 140px mobile, natural colours. No `invert` class. Do NOT add `data-redesign-needs-photo` (no illustrated states; the flow uses chips + plain text per brief §8 / §11).
>
> BACKEND FAKE MARKER: password-reset has BLOCKS-REDESIGN BUILD plans (`BUILD-password-reset-email-templates.md`, `BUILD-password-reset-request-actions.md`) that are still `[ ]`. Mark every feature whose final wiring depends on those plans with `data-redesign-backend="FAKE"` and a comment block citing the BUILD plan filename. Affected surfaces: state 1 form submission to `submitPasswordResetRequest` (real action writes to `account_password_requests` + sends template email; FAKE handler renders state 2 without DB write), state 4 form submission to `setPasswordWithToken` (real action verifies token + calls Supabase Auth admin-API + redirects; FAKE handler renders a stub success state), the two email-template definitions in `src/lib/email/templates.ts` (`password_reset_approved`, `password_reset_rejected`).

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list
- `/redesign/per-page-scope/password-reset-scope.md` written; print its contents to chat
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- List of `data-redesign-backend="FAKE"` surfaces printed to chat as `BACKEND_FAKE_SURFACES:` bullets
- Append `step-3: COMPLETE — scope written, plan updated, FAKE surfaces marked` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page password-reset`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page password-reset`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase. Craft must produce the shared `PasswordResetCard` chrome + the six state components inhabiting its slots, NOT a single mega-page with state branching at the route level.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/password-reset-brief.md. Compare the current implementation to the brief's requirements (11 native sections + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3001 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-password-reset-redesign"
pnpm next dev -p 3001
```

Use `run_in_background: true`. Poll `http://localhost:3001/admin/password-reset` until it returns HTTP 200 (or 308 — that's a trailing-slash redirect which Playwright handles). Max wait: 60 seconds.

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

This is a public pre-auth surface; NO sign-in required. Clear any session cookie first (or use a fresh browser context). Take screenshots and save to `/redesign/screenshots/password-reset-redesign/`:
- `chunk1-1440-state1.png` at 1440×900 — state 1 forgot form (`/admin/password-reset`, no cookie)
- `chunk1-768-state1.png` at 768×1024
- `chunk1-375-state1.png` at 375×812
- `chunk1-1440-state2.png` at 1440×900 — state 2 request submitted (after submitting the form once, FAKE handler renders state 2)
- `chunk1-1440-state4.png` at 1440×900 — state 4 set new password (navigate to `/admin/password-reset/<test-token>` where the test token is wired by the FAKE handler to always render state 4)
- `chunk1-1440-state5.png` at 1440×900 — state 5 rejected (FAKE token "reject-test")
- `chunk1-1440-state6.png` at 1440×900 — state 6 expired (FAKE token "expired-test")
- `chunk1-375-state4.png` at 375×812 — state 4 mobile (two password fields)

> **Heads up on session-cookie bleed:** if a prior browser session was signed in as a staff member, the admin layout might intercept these routes. The brief requires both new routes added to the middleware's public-route allow-list; verify that allow-list is in place before screenshotting. If the page redirects to `/admin/dashboard` or `/admin/login`, the allow-list is missing.

Self-assess against the brief. If you can identify ONE specific axis problem:

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder password-reset` |
| Too loud, too many colours | `/impeccable quieter password-reset` |
| Grey, lifeless, no identity | `/impeccable colorize password-reset` |
| Fonts feel default or inconsistent | `/impeccable typeset password-reset` |
| Spacing is off, things feel cramped | `/impeccable layout password-reset` |
| Static, jumpy, no motion | `/impeccable animate password-reset` |
| Functional but cold | `/impeccable delight password-reset` |
| Too much on the page | `/impeccable distill password-reset` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

If a refine runs, re-screenshot with `-after-refine` suffix.

**Evidence to surface:**
- 5+ screenshot file paths printed to chat (`ls redesign/screenshots/password-reset-redesign/`)
- Literal decision: `ITERATE_DECISION: no refine needed — <brief-justified reason>` OR `ITERATE_DECISION: ran /impeccable <axis> password-reset because <reason>`
- Append `step-7: COMPLETE — iterate decision logged` and cat progress file

---

## Step 8 — `/impeccable adapt password-reset for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt password-reset for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/password-reset-adapt-after-tablet.png` (state 1)
2. Screenshot at 375×812 → save to `/redesign/baseline/password-reset-adapt-after-mobile.png` (state 1)
3. Screenshot at 375×812 → save to `/redesign/baseline/password-reset-adapt-after-mobile-state4.png` (state 4, two password fields)
4. Confirm no horizontal scroll at either breakpoint (Playwright: check `document.documentElement.scrollWidth <= window.innerWidth`)
5. Confirm form inputs are tappable without zoom on mobile (min 44px touch targets); confirm the "Submit request" and "Save and sign in" full-width Primary buttons meet 44px minimum height
6. Confirm card max-width is 440px desktop (wider than Login's 400px per brief §5)

**Evidence to surface:**
- Three `password-reset-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target height for Submit request button on mobile (`TOUCH_TARGET_SUBMIT_MOBILE: <px>`)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden password-reset`

**Action:** Invoke Skill with `/impeccable harden password-reset`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-password-reset.md`. Implement what harden recommends (validation error / server error / rate-limit / hostile-token / cookie-vs-table routing / reviewer-note plain-text) per the brief's `## 6. Key States` and `## 11. Flow states` sections. For each state listed in the brief that harden didn't surface, add it anyway.

Verification edge cases (password-reset-specific):
- 60-character email in state 1 doesn't break layout
- State 4 mismatched passwords renders `role="alert"` "Passwords don't match." inline
- State 4 password under 12 chars renders "Password needs at least 12 characters."
- Hostile token (`/admin/password-reset/abc%20<script>`) renders state 5 copy with body "This link is no longer valid. Submit a new request below." — token never echoes to the client
- Reviewer-note well renders plain text even if DB row's `reviewer_note` contains `<script>alert(1)</script>` (React default escaping; NO `dangerouslySetInnerHTML`)
- Rate-limit: rapid repeat submit on state 1 within cooldown window renders Pending family info line "We've already got your request from {time}." — NOT a `role="alert"` error
- Email-not-found (state 1) renders IDENTICAL response to state-2 success copy (security-by-uniform-response, brief §10.1)
- Card max-width holds at 440px on desktop with two-password-field state 4

**Evidence to surface:**
- `/redesign/HARDEN-RECS-password-reset.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-password-reset.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify password-reset`

**Action:** Invoke Skill with `/impeccable clarify password-reset`.

Verify copy matches the brief's `## Copy` + `## 11. Flow states` sections exactly (or has been tightened for layout — that's allowed). Specifically:

State H1s (per brief §8):
- State 1: "Reset your password"
- State 2: "Request received"
- State 3: "Still waiting on review"
- State 4: "Set a new password"
- State 5: "Request not approved"
- State 6: "This link has expired"

Body copy (verbatim per brief §11):
- State 1: "An Owner reviews each request. We'll let you know by email when it's approved."
- State 2: "Thanks. An Owner will review this and email you when it's approved. You can close this page; the link will come to your inbox." + Sub-line "Sent for: f••@rahmatherapy.co.uk"
- State 3: "Your request is still in the queue. We'll email you when it's approved. Submitted {time-ago}."
- State 4: "Almost done. Pick a password you'll remember."
- State 5: "An Owner reviewed your request and decided not to approve it this time." + reviewer-note well when present
- State 6: "This password-reset link is no longer valid. Submit a new request below." + inline state-1 form

Buttons:
- State 1 / 6: "Submit request" (Primary, full-width)
- State 4: "Save and sign in" (Primary, full-width)
- State 5: "Submit a new request" (Primary)
- State 2 / 3: "Submit a different email" (Ghost)
- All except 4-success: "Back to sign in" (Ghost) → `/admin/login`

Validation errors:
- "Email needs an @ symbol. For example, sara@rahmatherapy.com."
- "Add your email address."
- "Password needs at least 12 characters."
- "Passwords don't match."
- "Pick something that doesn't include your email address."
- "Something went wrong. Try again in a minute."

Footer (matches Login): "Rahma Therapy staff portal."

Voice anchors: NO "unfortunately", NO "sadly", NO "we're sorry"; NO technical terms (no "token", no "payload", no "TTL"); reviewer-note must render plain.

**Evidence to surface:**
- List of copy surfaces changed (with before/after) — OR `CLARIFY_RESULT: copy already matches brief Copy + Flow states sections`
- Append `step-10: COMPLETE — clarify run, copy verified` and cat progress file

---

## Step 11 — Verify (Step 6 from workflow guide)

**Action:** Three sub-checks in order.

### 11a — Token-drift lint

For files changed in this redesign, grep:
```bash
# Raw hex (should be 0 outside comments)
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/password-reset/**/*.tsx

# Raw oklch() literals (should be 0 — colors come from tokens)
grep -nE 'oklch\(' src/app/admin/password-reset/**/*.tsx

# Raw px outside @media (allowed: tailwind arbitrary like `mt-[2px]` for icon alignment is borderline — flag, don't fail)
grep -nE '\[[0-9]+px\]' src/app/admin/password-reset/**/*.tsx

# font-family literals (should be 0)
grep -nE "font-family:\s*['\"]" src/app/admin/password-reset/**/*.tsx

# dangerouslySetInnerHTML MUST be 0 — reviewer-note plain-text rule
grep -nE 'dangerouslySetInnerHTML' src/app/admin/password-reset/**/*.tsx
```

For each match, confirm the value comes from a DESIGN.md token. If a hardcoded value isn't backed by a token, FIX IT — either add the token to DESIGN.md (only with user approval, otherwise STUCK) or replace with the existing token. The state 5 reviewer-note well must use `var(--admin-cancelled)` family tokens, not raw `oklch()`.

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1440)

- Clear session cookie / use a fresh context (this is a pre-auth surface)
- Navigate to `/admin/password-reset` at each viewport
- Save final-state screenshots: `password-reset-state1-{375,768,1440}.png` to `/redesign/screenshots/password-reset-redesign/`
- Fill the email field with `unknown@example.com` and click "Submit request" → confirm state 2 renders (security-by-uniform-response: same as valid staff email). Capture the network request and confirm the response body is identical to the valid-email response
- Fill the email field with `test.therapist@rahmatherapy.example.test` and click "Submit request" → confirm state 2 renders (the FAKE handler does not actually write to DB or send email)
- Navigate to `/admin/password-reset/test-approved-token` → confirm state 4 renders with "Set a new password" H1, two password fields, "Save and sign in" Primary
- Navigate to `/admin/password-reset/test-rejected-token` → confirm state 5 renders with reviewer-note well (FAKE handler returns canned reviewer note)
- Navigate to `/admin/password-reset/test-expired-token` → confirm state 6 renders with inline state-1 form below
- Navigate to `/admin/password-reset/<script>alert(1)</script>` (URL-encoded) → confirm state 5 renders with body "This link is no longer valid. Submit a new request below."; token NEVER appears in the rendered HTML
- Click "Back to sign in" Ghost on state 1 → navigates to `/admin/login`

### 11c — Console + Network

- Print last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md` (warnings OK)
- Print network requests during state 1 submit (both unknown-email and known-email) — confirm IDENTICAL response shape + status; both render state 2 (`UNIFORM_RESPONSE_PASS: true`)
- Confirm no calls leave the localhost surface other than the form POST to the FAKE server action (BUILD plans not landed yet; no real email send)

**Evidence to surface:**
- All five grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix). `DANGEROUSLY_SET_INNER_HTML_HITS: 0` literal line.
- 6 screenshot files in `/redesign/screenshots/password-reset-redesign/`: `password-reset-state1-{375,768,1440}.png` + `password-reset-state{2,4,5,6}-1440.png`
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Uniform-response line: `UNIFORM_RESPONSE_PASS: true` (or `false` with diff)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — `/impeccable audit password-reset` + `/impeccable critique password-reset` + functional smoke test

### 12a — Audit
Invoke Skill with `/impeccable audit password-reset`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## password-reset — audit`:
- 5 dimension scores
- P0/P1/P2/P3 findings, each on its own line
- Backend status: `FAKE` — BLOCKS-REDESIGN BUILD plans `BUILD-password-reset-email-templates.md`, `BUILD-password-reset-request-actions.md` still `[ ]`; UI ships against mocked handlers. Note which surfaces carry `data-redesign-backend="FAKE"`.

**Print the appended section to chat.**

**If any P0 finding: emit `P0_FOUND:` followed by the list and STOP.** Do not proceed to handoff. The user will decide whether to fix-now or defer.

### 12b — Critique
Invoke Skill with `/impeccable critique password-reset`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## password-reset — critique`:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

**Print the appended section to chat.**

If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder password-reset` OR `/impeccable distill password-reset` based on which fits the verdict's reasoning, then re-run `/impeccable critique password-reset`. Loop max 2 times.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code (no sign-in; this is pre-auth):

- [ ] State 1: `name="email"` preserved; `<input type="email" required>` with `autocomplete="username"`; "Submit request" Primary full-width; "Back to sign in" Ghost links to `/admin/login`
- [ ] State 4: `name="new_password"` and `name="confirm_new_password"` preserved; `<input type="password" required minLength="12">`; helper "At least 12 characters." beneath first field; both fields have `autocomplete="new-password"`
- [ ] No autofocus on mount (per brief §7: "No autofocus on mount (avoids aggressive mobile keyboard pop-up on a low-anxiety landing surface).")
- [ ] All six states render the shared `PasswordResetCard` chrome (logo, H1 slot, chip slot, body slot, affordance slot, back-link); composition not branching inside the card
- [ ] State chips render with correct family per brief §8 table: Pending (states 2/3) → "Pending review" + `clock`; Confirmed (state 4) → "Approved" + `check-circle`; Cancelled (state 5) → "Not approved" + `x-circle`; Restricted (state 6) → "Expired" + `lock`
- [ ] Hostile token never echoes to the client (verified via View Source on `/admin/password-reset/<script>alert(1)</script>` URL-encoded)
- [ ] `reviewer_note` renders as plain text when DB row contains HTML or `<script>` tags (no `dangerouslySetInnerHTML` anywhere in the codebase per grep above)
- [ ] Email-not-found returns IDENTICAL response to valid-email (security-by-uniform-response, brief §10.1)
- [ ] Existing `/admin/login` "Forgot your password?" Ghost link routes here correctly (untouched per Login session)
- [ ] `id="admin-main"` skip-link target present on both new routes (this surface has stripped chrome, no top nav, so the skip-link target lives at the card root)

**Evidence to surface:**
- Both PER-PAGE-SCORES.md sections printed to chat (audit + critique)
- Functional smoke test checklist printed with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit/critique/smoke clean` and cat progress file

---

## Step 13 — Handoff (NO COMMIT — wait for user approval)

**Action:**
1. Run `git diff --stat` in the worktree — print to chat
2. Compare changed-files list against `/redesign/per-page-scope/password-reset-scope.md`. For any file changed that isn't in the scope file's "Files to edit" list: STOP and emit `SCOPE_VIOLATION: <file>`. Otherwise: `SCOPE_CLEAN: only scoped files changed`.
3. Run `git diff` (full) and confirm nothing unexpected appears — print the diff to chat in collapsible form. Pay particular attention to `src/middleware.ts` — if it changed beyond the public-route allow-list addition, STOP.
4. Emit the handoff message to chat with:
   - Dev server URL: `http://localhost:3001/admin/password-reset`
   - All screenshot paths (six state shots + final-3 viewport shots)
   - Audit + critique key scores
   - Backend status: `FAKE` with the two BUILD-plan filenames listed
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
13. `DANGEROUSLY_SET_INNER_HTML_HITS: 0`
14. `UNIFORM_RESPONSE_PASS: true`
15. `CONSOLE_NEW_ERRORS: 0`
16. `## password-reset — audit` and `## password-reset — critique` headings appended (printed to chat from the file)
17. `SMOKE_TEST: all PASS`
18. `SCOPE_CLEAN: only scoped files changed`
19. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
