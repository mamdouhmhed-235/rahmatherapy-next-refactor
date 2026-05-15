# /goal recipe — page: operations (24 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/operations-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `operations` |
| Page row in IMPLEMENTATION-PLAN.md | row 24 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/operations-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (operations section) |
| Source files to edit | `src/app/admin/operations/page.tsx` (and any extracted client list / row component introduced during craft — keep new files under `src/app/admin/operations/`) |
| Worktree | this checkout — branch `agent/operations-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3001` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `FAKE` — `BUILD-operations-filter-query.md` is BLOCKS-REDESIGN (IMPLEMENTATION-PLAN.md row L0/10). Until handled, filter-strip filters render and submit a URL but the server returns the unfiltered page-load result; flag FAKE in the audit. |
| Progress scratchpad | `/redesign/per-page-progress/operations-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `src/app/admin/operations/actions.ts` — `updateOperationalEventStatus` server action, must remain wired (RECON §5)
   - `operational_events` insert/redaction paths (RECON §6.2) — write-side redaction is untouchable
   - `src/middleware.ts`
   - `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layer (RECON §5)
   - `src/components/ui/card.tsx` and other shared primitives — out of scope for operations (fixes live in `00-shared-components` session)
   - All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.)
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve form `name` attributes:** `name="event_id"` and `name="status"` (hidden) on every Ack / Resolve `<form action={updateOperationalEventStatus}>` must remain literal and verbatim (RECON §6.4).
6. **Preserve the server action contract:** every Ack/Resolve form must keep calling `updateOperationalEventStatus`. No `fetch` / no `XHR` replacement. Bulk Resolve sequences one POST per event_id through the same action.

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

…and stop.

## Oversize file handling

When `Read` returns "File content (N tokens) exceeds maximum allowed tokens (25000)", DO NOT retry the full read. Use `offset` + `limit`, or use `Grep`.

Known oversize files relevant to this recipe:
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `operations` for page-specific entries
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; lines 885–925 for the operations row

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
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/operations-progress.md` and cat it.

---

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: operations
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/operations-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for operations)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/operations-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

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

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (operations) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
> - /redesign/briefs/operations-brief.md  ← THIS IS THE PREPARED BRIEF
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
> Write to `/redesign/per-page-scope/operations-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/operations-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1440.
>
> IMAGE HANDLING: `operations-clear.svg` is listed in IMAGES-NEEDED for the all-clear EmptyState. If it isn't on disk yet, mark the slot with `data-redesign-needs-photo` and degrade gracefully to the EmptyState's text-only fallback.
>
> BACKEND FAKE MARKER: filter strip submits via GET with `severity`, `event_type`, `status`, `from`, `to`, `q`. The server-side query is still un-implemented per `BUILD-operations-filter-query.md` (BLOCKS-REDESIGN). Render the filter strip as if it works, but add a `data-redesign-fake="filter-query"` attribute on the form element. Severity stat-tile click-to-filter is also FAKE under the same constraint until the BUILD plan lands.

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list
- `/redesign/per-page-scope/operations-scope.md` written; print its contents to chat
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- Append `step-3: COMPLETE — scope written, plan updated` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page operations`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page operations`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/operations-brief.md. Compare the current implementation to the brief's requirements (5 native sections + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3001 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-operations-redesign"
pnpm next dev -p 3001
```

Use `run_in_background: true`. Poll `http://localhost:3001/admin/operations` until it returns HTTP 200 (or 308 — that's a trailing-slash redirect which Playwright handles). Max wait: 60 seconds.

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

**Action:** Use the `playwright` MCP tool (NOT `chrome-devtools` — playwright handles redirects). Sign in first with `test.admin@rahmatherapy.example.test` / `AdminTest123!` (operations gates on `manage_settings` OR `manage_email_settings`; Admin/PM seed has `manage_email_settings`). Owner credentials may be required to see the full event stream; if the admin seed account lacks operational events visibility, swap to the owner test account documented in `/redesign/test-credentials.md`.

Take screenshots and save to `/redesign/screenshots/operations-redesign/`:
- `chunk1-1440-default.png` at 1440×900
- `chunk1-768-default.png` at 768×1024
- `chunk1-375-default.png` at 375×812
- `chunk1-1440-empty.png` at 1440×900 with the database in the all-clear state (or simulate by filtering to a severity/event_type that yields zero matches)
- `chunk1-375-filter-active.png` at 375×812 with the mobile filter sheet open

Self-assess against the brief. If you can identify ONE specific axis problem:

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder operations` |
| Too loud, too many colours | `/impeccable quieter operations` |
| Grey, lifeless, no identity | `/impeccable colorize operations` |
| Fonts feel default or inconsistent | `/impeccable typeset operations` |
| Spacing is off, things feel cramped | `/impeccable layout operations` |
| Static, jumpy, no motion | `/impeccable animate operations` |
| Functional but cold | `/impeccable delight operations` |
| Too much on the page | `/impeccable distill operations` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

If a refine runs, re-screenshot with `-after-refine` suffix.

**Evidence to surface:**
- 5+ screenshot file paths printed to chat (`ls redesign/screenshots/operations-redesign/`)
- Literal decision: `ITERATE_DECISION: no refine needed — <brief-justified reason>` OR `ITERATE_DECISION: ran /impeccable <axis> operations because <reason>`
- Append `step-7: COMPLETE — iterate decision logged` and cat progress file

---

## Step 8 — `/impeccable adapt operations for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt operations for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/operations-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/operations-adapt-after-mobile.png`
3. Confirm no horizontal scroll at either breakpoint (Playwright: check `document.documentElement.scrollWidth <= window.innerWidth`)
4. Confirm Ack / Resolve buttons are tappable without zoom on mobile (min 44px touch targets — check `getBoundingClientRect().height >= 44`)
5. Confirm the `TabPills` strip (Open / Acknowledged / Resolved) replaces the three-column desktop grid at `lg:` and below

**Evidence to surface:**
- Two `operations-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target height for Ack / Resolve buttons on mobile (`TOUCH_TARGET_ACK_MOBILE: <px>`)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden operations`

**Action:** Invoke Skill with `/impeccable harden operations`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-operations.md`. Implement what harden recommends (empty / loading / error / permission-denied / overflow states) per the brief's `## 6. Key States` section. For each state listed in the brief that harden didn't surface, add it anyway. Pay particular attention to the Layer-3 backend error table at the bottom of brief §6 (initial-load failure, admin/PM silent omission, bulk-resolve partial failure).

Verification edge cases (operations-specific):
- A 250-character `summary` truncates on desktop with a working tooltip; wraps clean on mobile
- An event row with 8+ `safe_context` keys renders 4 chips + "+N more" Ghost without breaking the row layout
- The Open column with 60 error-severity rows renders the tinted background per §6 "High-severity emphasis" without visual fatigue
- Bulk-Resolve `ConfirmActionModal` body with `{n}=87` doesn't overflow at 375px
- The all-clear `EmptyState` shield-with-check renders even when `operations-clear.svg` isn't on disk yet (text-only degrade)

**Evidence to surface:**
- `/redesign/HARDEN-RECS-operations.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-operations.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify operations`

**Action:** Invoke Skill with `/impeccable clarify operations`.

Verify copy matches the brief's `## Copy` and `## 8. Content Requirements` sections exactly (or has been tightened for layout — that's allowed). Specifically:
- No `Submit` buttons remain → `Acknowledge`, `Resolve`, `Resolve all`, `Apply filters`, `Clear filters`, `Try again`, `Load more`
- No `An error occurred` messages → use brief's specific copy (e.g. `Couldn't load operational events. Try refreshing.`)
- Toast copy verbatim: `Acknowledged.` / `Resolved.` / `{N} events resolved.` / `Couldn't resolve {N} of {total}. Try again.` / `Copied safe context.`
- Empty-state heads + bodies match the brief's table
- Denied screen reads "Operational events access limited" with no raw `manage_settings or view_email_logs` identifier
- Voice matches `PRODUCT.md` Brand Personality (calm, plain, direct, kind)

**Evidence to surface:**
- List of copy surfaces changed (with before/after) — OR `CLARIFY_RESULT: copy already matches brief`
- Append `step-10: COMPLETE — clarify run, copy verified` and cat progress file

---

## Step 11 — Verify (Step 6 from workflow guide)

**Action:** Three sub-checks in order.

### 11a — Token-drift lint

For files changed in this redesign, grep:
```bash
# Raw hex (should be 0 outside comments)
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/operations/page.tsx <other-files-touched-this-page>

# Raw oklch() literals (should be 0 — colors come from tokens)
grep -nE 'oklch\(' src/app/admin/operations/page.tsx <other-files-touched-this-page>

# Raw px outside @media (allowed: tailwind arbitrary like `mt-[2px]` for icon alignment is borderline — flag, don't fail)
grep -nE '\[[0-9]+px\]' src/app/admin/operations/page.tsx <other-files-touched-this-page>

# font-family literals (should be 0)
grep -nE "font-family:\s*['\"]" src/app/admin/operations/page.tsx <other-files-touched-this-page>

# legacy raw rahma escapes (Phase-6 soft fix per brief §4)
grep -nE 'var\(--rahma-' src/app/admin/operations/page.tsx <other-files-touched-this-page>

# raw text-red-600 on Siren (the current red severity icon — must retire per §3)
grep -n 'text-red-600' src/app/admin/operations/page.tsx <other-files-touched-this-page>
```

For each match, confirm the value comes from a DESIGN.md token. If a hardcoded value isn't backed by a token, FIX IT — either add the token to DESIGN.md (only with user approval, otherwise STUCK) or replace with the existing token. The error-severity tint must use `var(--admin-cancelled)` family, not raw `oklch()` or `bg-red-*`.

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1440)

- Sign in first at `/admin/login` with `test.admin@rahmatherapy.example.test` / `AdminTest123!` (Admin/PM has `manage_email_settings`; if events visible are too sparse, use the owner credentials).
- Navigate to `/admin/operations` at each viewport
- Save final-state screenshots: `operations-final-{375,768,1440}.png` to `/redesign/screenshots/operations-redesign/`
- Exercise the primary action: click `Acknowledge` on the top Open-column row → verify the row migrates to the Acknowledged column without a full page reload; verify success Sonner `Acknowledged.`
- Click `Resolve` on an Acknowledged row → verify migration to Resolved; verify Sonner `Resolved.`
- If ≥2 open rows remain, click `Resolve all` → `ConfirmActionModal` opens → click `Resolve all` (Destructive) → verify column progress line + Sonner `{N} events resolved.`
- Take a verification screenshot of the success toast: `operations-resolve-toast.png`
- Sign out via `/admin/signout` to leave a clean session for downstream pages

### 11c — Console + Network

- Print last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md` (warnings OK)
- Print network requests during the Ack/Resolve flow — verify POST to `updateOperationalEventStatus` server action (one POST per individual action; bulk Resolve sequences N POSTs)

**Evidence to surface:**
- All grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix)
- Screenshot files in `/redesign/screenshots/operations-redesign/`: `operations-final-{375,768,1440}.png` + `operations-resolve-toast.png`
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — `/impeccable audit operations` + `/impeccable critique operations` + functional smoke test

### 12a — Audit
Invoke Skill with `/impeccable audit operations`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## operations — audit`:
- 5 dimension scores
- P0/P1/P2/P3 findings, each on its own line
- Backend status: `FAKE — BUILD-operations-filter-query.md (BLOCKS-REDESIGN, Layer 0 row 10)`

**Print the appended section to chat.**

**If any P0 finding: emit `P0_FOUND:` followed by the list and STOP.** Do not proceed to handoff.

### 12b — Critique
Invoke Skill with `/impeccable critique operations`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## operations — critique`:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

**Print the appended section to chat.**

If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder operations` OR `/impeccable distill operations` based on which fits the verdict's reasoning, then re-run `/impeccable critique operations`. Loop max 2 times.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code:

- [ ] Per-row `<form action={updateOperationalEventStatus}>` with hidden `event_id` + `status` inputs still present and functional (Ack moves to Acknowledged; Resolve moves to Resolved)
- [ ] Bulk Resolve sequences N POSTs (not parallel), preserves audit-log ordering, surfaces partial-failure toast naming the failed count
- [ ] Stat-tile click → applies filter (severity=error&status=open) and scrolls to the Open column
- [ ] Severity chip click on a row → applies that severity to the filter and re-renders
- [ ] Safe-context `<details>` opens natively without JS; "Copy as JSON" copies the formatted object and fires Sonner `Copied safe context.`
- [ ] Three-column grid on `xl:` switches to `TabPills` strip on `lg:` and below; default tab Open
- [ ] Keyboard `o` / `a` / `r` jumps focus to the Open / Acknowledged / Resolved column heading (additional only — never the sole path)
- [ ] `AdminAccessDenied` does NOT render the raw `manage_settings or view_email_logs` permission identifier

**Evidence to surface:**
- Both PER-PAGE-SCORES.md sections printed to chat (audit + critique)
- Functional smoke test checklist printed with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit/critique/smoke clean` and cat progress file

---

## Step 13 — Handoff (NO COMMIT — wait for user approval)

**Action:**
1. Run `git diff --stat` in the worktree — print to chat
2. Compare changed-files list against `/redesign/per-page-scope/operations-scope.md`. For any file changed that isn't in the scope file's "Files to edit" list: STOP and emit `SCOPE_VIOLATION: <file>`. Otherwise: `SCOPE_CLEAN: only scoped files changed`.
3. Run `git diff` (full) and confirm nothing unexpected appears — print the diff to chat in collapsible form.
4. Emit the handoff message to chat with:
   - Dev server URL: `http://localhost:3001/admin/operations`
   - All screenshot paths
   - Audit + critique key scores
   - Backend FAKE flag: filter-strip query still depends on `BUILD-operations-filter-query.md`
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
13. `## operations — audit` and `## operations — critique` headings appended (printed to chat from the file)
14. `SMOKE_TEST: all PASS`
15. `SCOPE_CLEAN: only scoped files changed`
16. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
