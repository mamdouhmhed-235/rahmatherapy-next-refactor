# /goal recipe — page: audit (20 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/audit-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `audit` |
| Page row in IMPLEMENTATION-PLAN.md | row 20 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/audit-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (audit section) |
| Source files to edit | `src/app/admin/audit/page.tsx`, plus net-new files: `src/app/admin/audit/format.ts`, `src/app/admin/audit/redaction.ts`, `src/app/admin/audit/actions.ts`, `src/app/admin/audit/AuditFilterStrip.tsx`, `src/app/admin/audit/AuditEventCard.tsx`, `src/app/admin/audit/AuditLoadMoreButton.tsx` |
| Worktree | this checkout — branch `agent/audit-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3001` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `FAKE` — depends on BLOCKS-REDESIGN `BUILD-audit-filter-and-pagination.md` (cursor pagination + filter query) + non-blocking `BUILD-audit-target-existence.md` (per-row existence batch lookup). Until built, the new filter strip + Load more degrade gracefully: filters return the unfiltered top-100; the "Open target" Ghost is omitted when the existence check is unavailable. Mark FAKE comments at the data-fetch call sites. |
| Progress scratchpad | `/redesign/per-page-progress/audit-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `src/lib/auth/**` — `manage_audit_logs` permission resolution (RECON §5)
   - `src/lib/supabase/**` — client factories
   - `src/middleware.ts`
   - `supabase/migrations/**` — `audit_logs` schema; no new columns proposed
   - The existing audit-log repository helper (`getRecentAuditLogs` or equivalent in `src/lib/`) — net-new actions.ts adds a cursor-paged variant alongside, never modifies the existing helper
   - The redaction regex `note|health|treatment|consent|token|secret|key|payload|body` at RECON §6.2 — preserved character-for-character; `redaction.ts` references it verbatim
   - All build/config files
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **No audit-log writes from this page.** Audit is append-only and read-only at the UI layer. Visiting `/admin/audit` is not itself an audit event.
6. **Preserve the `manage_audit_logs` permission gate** at the top of the page; `AdminAccessDenied` renders for any authenticated staff without it.
7. **`AdminAccessDenied` copy must not leak `manage_audit_logs` as a raw identifier.**

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
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `audit`
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; search for the audit row
- `redesign/briefs/audit-brief.md` (~40k bytes) → likely fits but if it errors, use offset reads

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
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/audit-progress.md` and cat it.

---

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: audit
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/audit-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive — particularly the `manage_audit_logs` gate, the verbatim redaction regex, and the "no audit writes from this page" invariant)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for audit)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/audit-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

**Evidence to surface:**
- All 7 one-sentence summaries printed to chat
- The literal line: `PRODUCT.md register: product`
- A verbatim quote of brief `## 6. Key States` sentence 2, prefixed with `BRIEF_S6_QUOTE: ` and inside a blockquote
- Feature Preservation Manifest items listed in chat as a bullet list (gate + regex + no-writes invariant + 8-family taxonomy mapping requirements)
- Append `step-1: COMPLETE — re-prime confirmed` and cat the progress file

---

## Step 2 — Turn 2 ack + Ralph Zone 1 BROKEN guard (READ-ONLY)

Self-acknowledge `primed — go` (no external user to wait for; you proceed in `/goal` mode).

The Ralph Zone 1 batch loop was run once near the start of Phase 6, before this page. **Do NOT re-run the batch loop.** Run only the read-only BROKEN discrepancy guard:

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (audit) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
> - /redesign/briefs/audit-brief.md  ← THIS IS THE PREPARED BRIEF
>
> Tell me before writing any code:
> - Files you will edit (including the 6 net-new files)
> - Files you will NOT touch (from the brief's untouchable list)
> - Features you are preserving (gate, regex, no-writes invariant)
> - Any conflict between brief and codebase
>
> (You are running under `/goal`, so "wait for my go-ahead" → instead print the file list to chat with a literal `SCOPE_PROPOSAL:` prefix, then proceed.)
>
> WRITE THE PER-PAGE SCOPE TO DISK before craft runs:
> Write to `/redesign/per-page-scope/audit-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/audit-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1440. Filter strip collapses to "Filter" Ghost + `AdminSheet` on mobile; JSON `<details>` columns stack vertically below 768px.
>
> IMAGE HANDLING: append any new empty-state SVGs (search illustration, archive illustration, lock-icon for denied) to IMAGES-NEEDED.md as part of this session.
>
> BACKEND FAKE MARKER: `BUILD-audit-filter-and-pagination.md` is BLOCKS-REDESIGN and not yet handled. Mark the new filter strip + Load more code paths with `// FAKE: BUILD-audit-filter-and-pagination` comments. `BUILD-audit-target-existence.md` is non-blocking; the "Open target" Ghost falls back to the inline "Target row no longer exists." note when the existence helper isn't available.

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list (including all 6 net-new files)
- `/redesign/per-page-scope/audit-scope.md` written; print its contents to chat
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- Append `step-3: COMPLETE — scope written, plan updated` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page audit`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page audit`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/audit-brief.md. Compare the current implementation to the brief's requirements (11 native sections + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3001 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-audit-redesign"
pnpm next dev -p 3001
```

Use `run_in_background: true`. Poll `http://localhost:3001/admin/audit` until it returns HTTP 200 (or 308). Max wait: 60 seconds.

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

Sign in as the Owner — `test.admin@rahmatherapy.example.test` / `AdminTest123!` (the test admin has `manage_audit_logs` per seed). Take screenshots and save to `/redesign/screenshots/audit-redesign/`:
- `chunk1-1440-default.png` at 1440×900 navigating to `/admin/audit` (default "Last 30 days" range, no filters)
- `chunk1-1440-filtered.png` at 1440×900 navigating to `/admin/audit?family=bookings_and_assignments&range=this_week` (filter chips visible below strip)
- `chunk1-1440-expanded.png` at 1440×900 with one row's `<details>` JSON expansion open
- `chunk1-1440-search.png` at 1440×900 navigating to `/admin/audit?q=<seed-uuid-prefix>` (4+ chars)
- `chunk1-768-default.png` at 768×1024 on `/admin/audit`
- `chunk1-375-default.png` at 375×812 on `/admin/audit` (filter strip behind Ghost; cards single-column)
- `chunk1-375-sheet.png` at 375×812 on `/admin/audit` with the mobile filter sheet open

> **Heads up on session-cookie bleed:** if signed in as a non-Owner role, `/admin/audit` will render `AdminAccessDenied`. Verify the Owner / Main Admin scope before saving the default screenshot.

Self-assess against the brief. If you can identify ONE specific axis problem:

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder audit` |
| Too loud, too many colours | `/impeccable quieter audit` |
| Grey, lifeless, no identity | `/impeccable colorize audit` |
| Fonts feel default or inconsistent | `/impeccable typeset audit` |
| Spacing is off, things feel cramped | `/impeccable layout audit` |
| Static, jumpy, no motion | `/impeccable animate audit` |
| Functional but cold | `/impeccable delight audit` |
| Too much on the page | `/impeccable distill audit` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

If a refine runs, re-screenshot with `-after-refine` suffix.

**Evidence to surface:**
- 7+ screenshot file paths printed to chat (`ls redesign/screenshots/audit-redesign/`)
- Literal decision: `ITERATE_DECISION: no refine needed — <brief-justified reason>` OR `ITERATE_DECISION: ran /impeccable <axis> audit because <reason>`
- Append `step-7: COMPLETE — iterate decision logged` and cat progress file

---

## Step 8 — `/impeccable adapt audit for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt audit for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/audit-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/audit-adapt-after-mobile.png`
3. Confirm no horizontal scroll at either breakpoint
4. Confirm tap targets ≥ 44px on mobile for the "Filter" Ghost trigger, search input, `<details>` summary, and Copy ID Ghost links
5. Confirm JSON expansion columns stack vertically below 768px with the 1px `border-subtle` divider between them
6. Confirm date-range chip strip momentum-scrolls horizontally without overflowing the viewport

**Evidence to surface:**
- Two `audit-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target height for `<details>` summary on mobile (`TOUCH_TARGET_DETAILS_MOBILE: <px>`)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden audit`

**Action:** Invoke Skill with `/impeccable harden audit`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-audit.md`. Implement what harden recommends per the brief's `## 6. Key States` table. Particular attention to:
- Search query < 4 characters: inline note `Type at least 4 characters of an ID.`
- Filter timeout: Cancelled-family `role="alert"` region replaces timeline with Ghost "Try again"
- Filtered-to-empty / search-no-match: distinct `EmptyState` copy per brief
- Redacted-keys card variant: chip + `[redacted]` placeholders in expansion
- Deleted-target card variant: `Target row no longer exists.` inline replaces "Open target"
- `before_state: null` (creation event) and `after_state: null` (deletion event) JSON column variants
- Clipboard API unavailable fallback: inline `<code>{id}</code>` for manual copy

Verification edge cases (audit-specific):
- 1,000-character `error_message` doesn't overflow the JSON well
- 5,000-row session via 10× Load more clicks doesn't crash the page (mitigation per §10 Q2)
- `from > to` date range renders the documented inline error
- Print stylesheet (`@media print`): filter strip hidden, all `<details>` forced open, `break-inside: avoid` on each card

**Evidence to surface:**
- `/redesign/HARDEN-RECS-audit.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-audit.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify audit`

**Action:** Invoke Skill with `/impeccable clarify audit`.

Verify copy matches the brief's `## 8. Content Requirements` and `## Copy` sections exactly. Specifically:
- H1: `Audit log`
- Subtitle: `Read-only record of every administrative action. Sensitive fields are always redacted.`
- Redaction chip label: `Redacted: {N} field(s)` (singular at N=1: `Redacted: 1 field`)
- Result count unfiltered: `Showing 100 most recent events. Load more to see older entries.`
- Result count filtered: `Showing {N} of {M} events.`
- Verb-phrase mapping for every `action_type` (verify the `format.ts` table covers all 47 documented action types, including the 4 password-reset types from Brief 10) — voice is plain present-tense verbs ("confirmed", "cancelled", "added")
- Empty states: `No events match` / `No events yet` / `Nothing matches that ID` with documented bodies
- Toasts: `Copied event ID` / `Copied target ID`
- Denied state copy: `Audit access is restricted to the practice owner. Contact the owner if you think this is a mistake.` — no raw `manage_audit_logs` identifier
- Browser tab title for denied state reads `Access denied · Rahma` (not `Audit log · Rahma`)

**Evidence to surface:**
- List of copy surfaces changed (with before/after) — OR `CLARIFY_RESULT: copy already matches brief §8 + Copy block`
- Append `step-10: COMPLETE — clarify run, copy verified` and cat progress file

---

## Step 11 — Verify (Step 6 from workflow guide)

**Action:** Three sub-checks in order.

### 11a — Token-drift lint + forensic-trust verification

```bash
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/audit/page.tsx src/app/admin/audit/*.tsx
grep -nE 'oklch\(' src/app/admin/audit/*.tsx
grep -nE '\\d+px' src/app/admin/audit/*.tsx
grep -nE "font-family:\s*['\"]" src/app/admin/audit/*.tsx

# Raw spacing literals (canon: should match the spacing scale in DESIGN.md)
grep -nE '(margin\|padding):\s*\d' src/app/admin/audit/*.tsx
grep -nE 'text-(emerald|orange|red|amber|green)-[0-9]+' src/app/admin/audit/*.tsx
grep -nE 'border-l-4|border-dashed' src/app/admin/audit/*.tsx
grep -nE 'manage_audit_logs' src/app/admin/audit/*.tsx
grep -nE 'note\|health\|treatment\|consent\|token\|secret\|key\|payload\|body' src/app/admin/audit/redaction.ts
```

For each match, confirm the value comes from a DESIGN.md token. The `manage_audit_logs` raw identifier must be 0 on user-facing copy. The redaction regex grep must return exactly 1 match — the verbatim copy of the RECON §6.2 regex in `redaction.ts`.

Additional forensic-trust checks (brief §11 explicit):
- String-equality check: the regex in `redaction.ts` matches the RECON §6.2 regex verbatim (no edits, no reordering)
- No audit-log row is written when `/admin/audit` is loaded (confirm via Supabase logs)
- The page renders `AdminAccessDenied` for every authenticated role except Owner

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1440)

- Sign in at `/admin/login` with `test.admin@rahmatherapy.example.test` / `AdminTest123!`
- Navigate to `/admin/audit` at each viewport
- Save final-state screenshots: `audit-final-{375,768,1440}.png` to `/redesign/screenshots/audit-redesign/`
- Apply a filter (e.g. `family=staff_and_roles`) → verify URL updates, chip renders, result count updates
- Click a row's `<details>` summary → verify expansion + JSON pretty-print renders + `[redacted]` placeholders for matched keys
- Click `Copy event ID` → verify Sonner toast `Copied event ID.` + clipboard contents (Playwright: read `navigator.clipboard.readText()`)
- Click `Load more` → verify next page appends without scroll jump; `aria-busy="true"` during request
- Sign out, sign in as a Coordinator → navigate to `/admin/audit` → verify `AdminAccessDenied` renders with the documented copy (no raw permission identifier) and the browser tab title is `Access denied · Rahma`

### 11c — Console + Network

- Print last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md`
- Print network requests during page load + filter + Load more — verify the `auditLoadMore` server action POST appears on Load more click and the page itself issues no audit-log writes (Supabase inserts to `audit_logs` table = 0)

**Evidence to surface:**
- All eight grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix)
- 3 final screenshots in `/redesign/screenshots/audit-redesign/`
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Forensic-trust line: `AUDIT_WRITES_ON_LOAD: 0` and `REDACTION_REGEX_VERBATIM: yes`
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — `/impeccable audit audit` + `/impeccable critique audit` + functional smoke test

### 12a — Audit
Invoke Skill with `/impeccable audit audit`.

**Severity rubric — anchor every finding before tagging (impeccable v5 L884-890):**
- **P0** Blocks release — fix before shipping anything
- **P1** Fix this sprint — significant impact on users
- **P2** Next cycle — noticeable but not blocking
- **P3** Polish — minor, fix when time allows

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## audit — audit`:
- 5 dimension scores
- P0/P1/P2/P3 findings, each on its own line
- Backend status: `FAKE` — `BUILD-audit-filter-and-pagination.md` still BLOCKS-REDESIGN; `BUILD-audit-target-existence.md` non-blocking; both noted with FAKE markers in code for Phase 7 handoff
- **P1 (tag for Phase 7 gauntlet):** subsection — list each P1 finding with location + file:line; if zero, write `none`. Phase 7 `/impeccable audit admin` re-scans this section.
- **BUSINESS-COMPLETENESS impact:** subsection — name any `redesign/BUSINESS-COMPLETENESS.md` items this page newly contributes to (e.g. `2A-6` if form-level error `role="alert"` was implemented). Lets the universal flag flip `PARTIAL` → `HANDLED` when all form-bearing pages adopt.

**Print the appended section to chat.**

**If any P0 finding: emit `P0_FOUND:` followed by the list and STOP.**

### 12b — Critique
Invoke Skill with `/impeccable critique audit`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## audit — critique`:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

**Print the appended section to chat.**

If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder audit` OR `/impeccable distill audit`, then re-run `/impeccable critique audit`. Loop max 2 times.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code:

- [ ] `manage_audit_logs` gate: Owner sees the surface; every other authenticated role hits `AdminAccessDenied`
- [ ] Redaction regex referenced verbatim by `redaction.ts` (string-equality check)
- [ ] No audit-log write fires when `/admin/audit` loads (Supabase insert count = 0)
- [ ] Filter contract: every documented GET param (`q`, `actor`, `family`, `target_type`, `range`, `from`, `to`) deep-links + survives reload
- [ ] Search 3-char query: no server request, inline note renders
- [ ] Search 4+ char query: prefix-matches `target_id`, `actor_staff_id`, `id` UUIDs
- [ ] 8-family taxonomy mapping covers every `action_type` in `format.ts` (verify exhaustive map)
- [ ] Action-verb phrases use plain present-tense voice ("confirmed", "cancelled", "added") for every action type
- [ ] Redaction chip + `[redacted]` placeholders render for every row whose `before_state`/`after_state` matches the regex
- [ ] "Open target" Ghost renders only when target row exists; otherwise inline `Target row no longer exists.`
- [ ] Copy event/target ID writes to clipboard + Sonner success toast fires
- [ ] Load more appends 100 next-page rows in place without scroll jump
- [ ] `@media print`: filter strip hidden, all `<details>` forced open, `break-inside: avoid` on each card
- [ ] `AdminAccessDenied` copy contains no raw `manage_audit_logs` identifier; tab title `Access denied · Rahma`

**Evidence to surface:**
- Both PER-PAGE-SCORES.md sections printed to chat (audit + critique)
- Functional smoke test checklist printed with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit/critique/smoke clean` and cat progress file

---

## Step 13 — Handoff (NO COMMIT — wait for user approval)

**Action:**
1. Run `git diff --stat` in the worktree — print to chat
2. Compare changed-files list against `/redesign/per-page-scope/audit-scope.md`. For any file changed that isn't in the scope file's "Files to edit" list: STOP and emit `SCOPE_VIOLATION: <file>`. Otherwise: `SCOPE_CLEAN: only scoped files changed`.
3. Run `git diff` (full) and confirm nothing unexpected appears — print the diff to chat in collapsible form.
4. Emit the handoff message to chat with:
   - Dev server URL: `http://localhost:3001/admin/audit`
   - All screenshot paths
   - Audit + critique key scores
   - Backend status: `FAKE` until `BUILD-audit-filter-and-pagination.md` lands (BLOCKS-REDESIGN; gates Phase 7)
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
13. `AUDIT_WRITES_ON_LOAD: 0` and `REDACTION_REGEX_VERBATIM: yes`
14. `## audit — audit` and `## audit — critique` headings appended (printed to chat from the file)
15. `SMOKE_TEST: all PASS`
16. `SCOPE_CLEAN: only scoped files changed`
17. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
