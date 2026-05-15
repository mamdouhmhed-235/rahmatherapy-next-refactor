# /goal recipe — page: client-new (7 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/client-new-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `client-new` |
| Page row in IMPLEMENTATION-PLAN.md | row 7 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/client-new-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (client-new section) |
| Source files to edit | `src/app/admin/clients/new/page.tsx`, `src/app/admin/clients/new/ClientCreateForm.tsx` |
| Logo asset (already present and tracked) | `public/images/brand/rahma/logo-refined.svg` |
| Worktree | this checkout — branch `agent/client-new-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3001` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `N-A` for THIS session — the postcodes.io lookup integration (`BUILD-postcode-lookup-client.md`) is explicitly out of scope per brief §4. **`city` + `area` form fields ARE in scope** (new optional fields, post-migration `20260513120000_add_client_city_area.sql`); the brief flags a "justified exception" to extend `createClient` to accept them, but this must be confirmed with user before touching `actions.ts` — see STUCK clause. |
| Progress scratchpad | `/redesign/per-page-progress/client-new-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `src/app/admin/clients/actions.ts` — `createClient` server action. **EXCEPTION FLAG:** brief §5 calls for a small update to accept `city`/`area` fields. This is the only sanctioned deviation; treat it as STUCK if you can't verify the columns exist via `supabase/migrations/20260513120000_add_client_city_area.sql` and the user-confirmed scope file lists `actions.ts` in "Files to edit" with that note. Default: do NOT touch `actions.ts` — render `city`/`area` inputs but submit a form whose server-side discards them until confirmation. Flag in handoff.
   - Duplicate detection rules (server-side; matches on lowercased email or normalised phone) — preserved verbatim
   - `src/middleware.ts` — Supabase session refresh / route protection
   - `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layer (RECON §5)
   - `supabase/migrations/**`
   - `src/components/ui/card.tsx` — out of scope here (fix lives in `00-shared-components` session)
   - All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.)
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve form `name` attributes (RECON §6.4):** `full_name`, `client_source`, `email`, `phone`, `address`, `postcode`, `source_detail`, `notes`, `confirm_duplicate` (conditional). New `city`, `area` are optional additions; existing names stay literal.
6. **Preserve the server-action contract:** `<form action={createClient}>` with `useActionState` must remain wired. No `fetch` / no `XHR` replacement. The `confirm_duplicate` checkbox must remain HTML-required when the duplicate warning state shows, so JS-off still gates submission.
7. **NEVER introduce `backdrop-blur` on the sticky save bar.** The brief explicitly bans glass-default on this page (line 87 of current page is a flagged carry-forward fix).

## STUCK clause

If you are genuinely blocked on any step (skill unavailable, brief contradicts codebase, server won't start, `actions.ts` extension is unclear, etc.) — **stop trying** and emit a literal line:

```
STUCK: <step number> — <specific, actionable reason>
```

Specifically: if you reach a point where the `city`/`area` field wiring requires touching `src/app/admin/clients/actions.ts` and you cannot find evidence in the user-confirmed scope file that this is authorised, emit `STUCK: <step> — actions.ts extension for city/area not pre-authorised; please confirm scope`.

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
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `client-new` for page-specific entries
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; lines 540–580 for the client-new row

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
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/client-new-progress.md` and cat it.

---

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: client-new
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/client-new-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for client-new)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/client-new-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

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

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (client-new) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
> - /redesign/briefs/client-new-brief.md  ← THIS IS THE PREPARED BRIEF
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
> Write to `/redesign/per-page-scope/client-new-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> Decision required in the scope file: should `src/app/admin/clients/actions.ts` be in "Files to edit" (to accept `city`/`area`) or in "NEVER touch" (rendering the inputs but discarding them)? Default to NEVER touch unless the brief's flagged exception is explicitly authorised by user.
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/client-new-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1440. Form panels collapse to single-column on mobile; sticky save bar pinned to viewport bottom with safe-area inset.
>
> IMAGE HANDLING: no new image assets required for this page.
>
> BACKEND FAKE MARKER: postcodes.io lookup is FAKE/out-of-scope here per brief §4 ("Note"). Do not implement; flagged in `BUILD-postcode-lookup-client.md` for a separate session.

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list
- `/redesign/per-page-scope/client-new-scope.md` written; print its contents to chat (with explicit decision about `actions.ts`)
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- Append `step-3: COMPLETE — scope written, plan updated` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page client-new`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page client-new`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/client-new-brief.md. Compare the current implementation to the brief's requirements (5 native sections + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3001 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-client-new-redesign"
pnpm next dev -p 3001
```

Use `run_in_background: true`. Poll `http://localhost:3001/admin/clients/new` until it returns HTTP 200 (or 308 — that's a trailing-slash redirect which Playwright handles). Max wait: 60 seconds.

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

Sign in first as `test.admin@rahmatherapy.example.test` / `AdminTest123!` (the page is auth-gated). Then navigate to `/admin/clients/new` and take screenshots; save to `/redesign/screenshots/client-new-redesign/`:
- `chunk1-1440-default-empty.png` at 1440×900 (empty form, three panels visible)
- `chunk1-768-default-empty.png` at 768×1024
- `chunk1-375-default-empty.png` at 375×812 (sticky save bar pinned at viewport bottom)
- `chunk1-1440-validation-errors.png` at 1440×900 (form submitted blank — field-level errors render)
- `chunk1-1440-duplicate-warning.png` at 1440×900 (submit with email matching seeded client — Attention banner + confirm_duplicate checkbox)
- `chunk1-375-duplicate-warning.png` at 375×812
- `chunk1-1440-therapist-denied.png` at 1440×900 (signed in as therapist — AdminAccessDenied with new copy, no raw `manage_clients_all` identifier)

Self-assess against the brief. If you can identify ONE specific axis problem:

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder client-new` |
| Too loud, too many colours | `/impeccable quieter client-new` |
| Grey, lifeless, no identity | `/impeccable colorize client-new` |
| Fonts feel default or inconsistent | `/impeccable typeset client-new` |
| Spacing is off, things feel cramped | `/impeccable layout client-new` |
| Static, jumpy, no motion | `/impeccable animate client-new` |
| Functional but cold | `/impeccable delight client-new` |
| Too much on the page | `/impeccable distill client-new` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

If a refine runs, re-screenshot with `-after-refine` suffix.

**Evidence to surface:**
- 7+ screenshot file paths printed to chat (`ls redesign/screenshots/client-new-redesign/`)
- Literal decision: `ITERATE_DECISION: no refine needed — <brief-justified reason>` OR `ITERATE_DECISION: ran /impeccable <axis> client-new because <reason>`
- Append `step-7: COMPLETE — iterate decision logged` and cat progress file

---

## Step 8 — `/impeccable adapt client-new for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt client-new for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/client-new-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/client-new-adapt-after-mobile.png`
3. Confirm no horizontal scroll at either breakpoint (Playwright: check `document.documentElement.scrollWidth <= window.innerWidth`)
4. Confirm sticky save bar pinned to viewport bottom on mobile with safe-area inset padding (`env(safe-area-inset-bottom)`)
5. Confirm sticky save bar has NO `backdrop-blur` (flat `surface-card` + 1px `border-subtle` top)
6. Confirm Primary "Create client" + Ghost "Cancel" touch targets are 48px height on mobile
7. Confirm panels collapse to single-column field layouts at 375px

**Evidence to surface:**
- Two `client-new-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target heights for Primary + Cancel on mobile (`TOUCH_TARGET_CREATE_MOBILE: <px>`, `TOUCH_TARGET_CANCEL_MOBILE: <px>`)
- DOM check for `backdrop-blur` on sticky save bar (`BACKDROP_BLUR_PRESENT: false`)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden client-new`

**Action:** Invoke Skill with `/impeccable harden client-new`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-client-new.md`. Implement what harden recommends per the brief's `## 6. Key States` section. Key states include: default empty, filling in, submitting (Primary `aria-busy`), validation error field-level + form-level, duplicate warning, duplicate warning + checkbox ticked, submission success, submission failure, cancel, denied.

Verification edge cases (client-new-specific):
- 80-character full name in `full_name` doesn't break form layout
- Form-level error banner with 200-character server message wraps cleanly at 375px
- Duplicate warning prose with 2-line server-supplied text doesn't push the `confirm_duplicate` checkbox below the fold on mobile
- Primary "Create client" loading state spinner doesn't shift button width
- All required-field `*` markers render in Cancelled text colour, `aria-hidden="true"` on the glyph, with a visible legend at top of form reading `* means required`
- Soft "no contact channel" warning modal fires when both `email` and `phone` are empty (per brief Q2; treat as Phase 6 polish item, ok to defer if hardening time is tight)

**Evidence to surface:**
- `/redesign/HARDEN-RECS-client-new.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-client-new.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify client-new`

**Action:** Invoke Skill with `/impeccable clarify client-new`.

Verify copy matches the brief's `## Copy` section exactly (or has been tightened for layout — that's allowed). Specifically:
- Page title: `Create client`
- Page description: `Create a CRM profile without booking. Duplicate email or phone matches are flagged before save.`
- Breadcrumb: `← Clients` linking to `/admin/clients`
- Panel 1 title: `Who they are` / description: `Their name and how this profile reached you.`
- Panel 2 title: `How to reach them` / description: `At least one of email or phone helps confirmations land.`
- Panel 3 title: `Internal notes` / description: `Visible to admin staff only. Don't include sensitive health information here; the client detail page has a dedicated health-notes surface.`
- Email helper: `Used for confirmations and reminders.`
- Phone helper: `Used for WhatsApp and SMS.`
- Source-detail conditional helpers: `Who referred them?` (source=Referral) / `Where did they find out about us?` (source=Other)
- Duplicate warning title: `Possible duplicate client`
- Duplicate checkbox label: `Create a separate client profile anyway.`
- Primary CTA: `Create client`
- Cancel: `Cancel`
- Submission success toast (renders on destination page): `{full_name} added.`
- Submission failure: `Couldn't create client. {server message}` + Ghost `Try again`
- Denied title: `Client creation limited` / body: `Creating client records is restricted to admin staff with client management permission. Ask the owner if you need it.` / no raw `manage_clients_all` identifier
- Source enum option labels: `Website`, `Phone`, `WhatsApp`, `Instagram`, `Referral`, `Manual`, `Other` (default option `Pick a source`)
- Validation error strings verbatim per brief Copy §Error messages
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
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/clients/new/page.tsx src/app/admin/clients/new/ClientCreateForm.tsx

# Raw oklch() literals (should be 0 — colors come from tokens)
grep -nE 'oklch\(' src/app/admin/clients/new/page.tsx src/app/admin/clients/new/ClientCreateForm.tsx

# Raw px outside @media
grep -nE '\[[0-9]+px\]' src/app/admin/clients/new/page.tsx src/app/admin/clients/new/ClientCreateForm.tsx

# font-family literals (should be 0)
grep -nE "font-family:\s*['\"]" src/app/admin/clients/new/page.tsx src/app/admin/clients/new/ClientCreateForm.tsx

# Tailwind raw color classes flagged in brief (should be 0)
grep -nE 'border-(red|orange|gray)-\d+|bg-(red|orange|gray|white)-?\d*|text-(red|orange|gray)-\d+' src/app/admin/clients/new/page.tsx src/app/admin/clients/new/ClientCreateForm.tsx

# Glass-default ban (sticky save bar must NOT use backdrop-blur)
grep -nE 'backdrop-blur' src/app/admin/clients/new/page.tsx src/app/admin/clients/new/ClientCreateForm.tsx

# Raw `var(--rahma-*)` token escapes (brief carry-forward; should resolve to scoped tokens)
grep -nE 'var\(--rahma-' src/app/admin/clients/new/page.tsx src/app/admin/clients/new/ClientCreateForm.tsx

# Raw permission identifier (brief carry-forward; AdminAccessDenied must not render `manage_clients_all`)
grep -nE 'manage_clients_all' src/app/admin/clients/new/page.tsx src/app/admin/clients/new/ClientCreateForm.tsx
```

For each match, confirm the value comes from a DESIGN.md token. If a hardcoded value isn't backed by a token, FIX IT — either add the token to DESIGN.md (only with user approval, otherwise STUCK) or replace with the existing token. Particular attention: form-level error must use `var(--status-cancelled-bg)` / `var(--status-cancelled-text)` and duplicate warning must use `var(--status-attention-bg)` / `var(--status-attention-text)`, never raw red/orange Tailwind classes.

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1440)

- Sign in as `test.admin@rahmatherapy.example.test` / `AdminTest123!` then navigate to `/admin/clients/new` at each viewport
- Save final-state screenshots: `client-new-final-{375,768,1440}.png` to `/redesign/screenshots/client-new-redesign/`
- Submit empty form — verify per-field `role="alert" aria-live="polite" aria-atomic="true"` regions render with Cancelled-family error text; focus jumps to first invalid field; screenshot `client-new-field-errors.png`
- Fill `full_name` + `client_source` + an email that matches a seeded client → submit → verify Attention-family duplicate banner appears above Panel 1 with `alert-circle` icon, visible "Possible duplicate" label, server prose, and required `confirm_duplicate` checkbox; verify Primary "Create client" is disabled until checkbox is ticked; screenshot `client-new-duplicate-blocked.png`
- Tick checkbox → verify Primary re-enables → resubmit → verify server-side redirect to `/admin/clients/<new_id>` with Sonner Confirmed toast `{full_name} added.` (toast renders on destination page); screenshot `client-new-success-redirect.png`
- Click Ghost "Cancel" — verify navigation to `/admin/clients` (no dirty-state confirm dialog)
- Sign out → sign in as `test.therapist@rahmatherapy.example.test` / `TherapistTest123!` → navigate to `/admin/clients/new` → verify `AdminAccessDenied` renders with new copy (`Client creation limited` / no raw `manage_clients_all`); screenshot `client-new-therapist-denied.png`
- Sign out via `/admin/signout` to leave a clean session for downstream pages

### 11c — Console + Network

- Print last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md` (warnings OK)
- Print network requests during form submission — verify POST to `createClient` server action; on duplicate path, server returns `duplicateWarning` state without inserting; on confirmed-resubmit, server inserts and redirects

**Evidence to surface:**
- All eight grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix); explicit `BACKDROP_BLUR: 0`; explicit `RAW_PERMISSION_LEAK: 0`; explicit `RAW_TAILWIND_COLOR_CLASSES: 0`
- 7+ screenshot files in `/redesign/screenshots/client-new-redesign/`: `client-new-final-{375,768,1440}.png` + error/duplicate/success/denied shots
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — `/impeccable audit client-new` + `/impeccable critique client-new` + functional smoke test

### 12a — Audit
Invoke Skill with `/impeccable audit client-new`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## client-new — audit`:
- 5 dimension scores
- P0/P1/P2/P3 findings, each on its own line
- Backend status: `N-A` (postcodes.io out-of-scope; `actions.ts` extension flagged as STUCK candidate)
- Confirm BASELINE-CRITIQUE carry-forwards resolved: P0 form-error not announced, P0 required-field `*` markers, Sam #3 input-border WCAG 1.4.11 (Form Seam token), raw token escapes, `bg-white` on panels, `backdrop-blur` on save bar, raw permission identifier on AdminAccessDenied

**Print the appended section to chat.**

**If any P0 finding: emit `P0_FOUND:` followed by the list and STOP.** Do not proceed to handoff. The user will decide whether to fix-now or defer.

### 12b — Critique
Invoke Skill with `/impeccable critique client-new`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## client-new — critique`:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

**Print the appended section to chat.**

If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder client-new` OR `/impeccable distill client-new` based on which fits the verdict's reasoning, then re-run `/impeccable critique client-new`. Loop max 2 times.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code:

- [ ] All preserved form `name` attributes present: `full_name`, `client_source`, `email`, `phone`, `address`, `postcode`, `source_detail`, `notes`, `confirm_duplicate` (conditional)
- [ ] New optional fields rendered: `city`, `area` (presence confirmed in DOM; submission behaviour matches scope-file decision about `actions.ts` extension)
- [ ] `<form action={createClient}>` with `useActionState` wired; fires on submit
- [ ] Duplicate detection: server-side rules untouched (matches on lowercased email or normalised phone); `confirm_duplicate` HTML-required when shown so JS-off still gates
- [ ] Source enum: seven options verbatim (`Website`, `Phone`, `WhatsApp`, `Instagram`, `Referral`, `Manual`, `Other`), preserved
- [ ] Required `*` markers visible on `full_name` and `client_source`, `aria-hidden="true"` on glyph, visible `* means required` legend present
- [ ] Per-field error wrapping uses `role="alert" aria-live="polite" aria-atomic="true"`
- [ ] Form-level error banner uses Cancelled family tokens
- [ ] Duplicate warning banner uses Attention family tokens + leading `alert-circle` + visible "Possible duplicate" label
- [ ] Sticky save bar: NO `backdrop-blur`, flat `surface-card`, 1px `border-subtle` top
- [ ] Cancel is an anchor link (not a form button); no dirty-state confirm dialog
- [ ] Denied state: `AdminAccessDenied` does NOT leak `manage_clients_all` identifier; copy matches brief
- [ ] Inputs meet WCAG 1.4.11 contrast (Form Seam token, oklch 55%)
- [ ] `id="admin-main"` skip-link target preserved at layout level

**Evidence to surface:**
- Both PER-PAGE-SCORES.md sections printed to chat (audit + critique)
- Functional smoke test checklist printed with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit/critique/smoke clean` and cat progress file

---

## Step 13 — Handoff (NO COMMIT — wait for user approval)

**Action:**
1. Run `git diff --stat` in the worktree — print to chat
2. Compare changed-files list against `/redesign/per-page-scope/client-new-scope.md`. For any file changed that isn't in the scope file's "Files to edit" list: STOP and emit `SCOPE_VIOLATION: <file>`. Otherwise: `SCOPE_CLEAN: only scoped files changed`. Special note: if `actions.ts` was touched, confirm it was authorised in the scope file.
3. Run `git diff` (full) and confirm nothing unexpected appears — print the diff to chat in collapsible form.
4. Emit the handoff message to chat with:
   - Dev server URL: `http://localhost:3001/admin/clients/new`
   - All screenshot paths
   - Audit + critique key scores
   - Decision taken about `actions.ts` extension (touched / not touched / flagged for follow-up)
   - Status of postcode auto-fill (deferred to `BUILD-postcode-lookup-client.md`)
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
13. `## client-new — audit` and `## client-new — critique` headings appended (printed to chat from the file)
14. `SMOKE_TEST: all PASS`
15. `SCOPE_CLEAN: only scoped files changed`
16. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
