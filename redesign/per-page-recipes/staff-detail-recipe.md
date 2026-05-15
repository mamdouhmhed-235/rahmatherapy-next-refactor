# /goal recipe — page: staff-detail (19 of 29)

> **You are executing this recipe under a `/goal` session.** Follow every step in order. After each step, append a `step-N: COMPLETE — <one-line summary>` line to `/redesign/per-page-progress/staff-detail-progress.md` and `cat` the full file to chat. The Haiku evaluator will read your transcript after every turn — it can only see what you surface. Print evidence to chat liberally.

## Context

| Field | Value |
|---|---|
| Page slug | `staff-detail` |
| Page row in IMPLEMENTATION-PLAN.md | row 19 of 29 (renumber based on chronological position, not numeric label) |
| Brief | `/redesign/briefs/staff-detail-brief.md` |
| Workflow guide reference | `/redesign/phase6-admin-workflow-guide.html` (staff-detail section) |
| Source files to edit | `src/app/admin/staff/[staffId]/page.tsx`, `src/app/admin/staff/[staffId]/StaffProfileForm.tsx`, `src/app/admin/staff/[staffId]/StaffPermissionOverridesForm.tsx` |
| Worktree | this checkout — branch `agent/staff-detail-redesign` off `redesign/start-state` |
| Parent branch (rollback target) | `redesign/start-state` |
| Main tree (DO NOT MODIFY — user works there) | `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` |
| Dev server port for this worktree | `3001` (user's main tree owns `3000`) |
| node_modules | already junctioned from main tree to this worktree's `./node_modules` — do not reinstall |
| Backend status | `HANDLED` — staff-detail has no BLOCKS-REDESIGN BUILD dependency. RECON §5 untouchable helpers (`getStaffTeamAccess`, `staffProfilesFrom`, `canEditSafeStaffProfile`) + the two form server-action contracts remain wired verbatim. §10 Q3 proposes bumping the assignment `limit(8)` to `limit(16)`; that's a soft, non-blocking adjustment that can ship with this redesign. |
| Progress scratchpad | `/redesign/per-page-progress/staff-detail-progress.md` |

## Hard rules — never violate these

1. **NEVER commit. NEVER stage.** Not even `git add -p`. Final step is handoff. Commits happen only after the user explicitly types `approved` in this session.
2. **NEVER use `git add .` or `git add -A`.** When the time comes (after approval), stage scoped files explicitly.
3. **NEVER modify any of these files** (Feature Preservation Manifest + RECON untouchables):
   - `src/lib/staff/team-access.ts` — `getStaffTeamAccess`, `staffProfilesFrom`, `getStaffTeamSelect`, `canEditSafeStaffProfile` (RECON §5)
   - `src/app/admin/staff/[staffId]/actions.ts` — `StaffProfileForm` + `StaffPermissionOverridesForm` server-action contracts (RECON §6.4)
   - `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layer (RECON §5)
   - `src/middleware.ts`
   - `supabase/migrations/**`
   - All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.)
4. **NEVER modify files in the main tree.** Your CWD is the worktree; keep it that way.
5. **Preserve `StaffProfileForm` field `name` attributes:** `name`, `phone`, `show_phone_on_profile`, `short_bio`, `specialties`, `languages`, `service_areas`, `role_id`, `gender`, `active`, `can_take_bookings`, `availability_mode`, `profile_photo_path` (RECON §6.4).
6. **Preserve `StaffPermissionOverridesForm` per-row switch contract** and the self-lockout protection (current line 374–377 in the page or wherever it lives in the component).
7. **Preserve the five permission flags + `isOwnProfile` matrix** driving panel visibility (§11 (viewer × target) table). Never collapse the matrix logic.

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
- `redesign/RECIPE-PROGRESS.md` (~26k tokens) → read lines 1–100 for overview; grep for `Phase 6` and `staff-detail`
- `redesign/IMPLEMENTATION-PLAN.md` (~29k tokens) → read lines 1–60 for "Currently on"; search for the staff-detail row
- `redesign/briefs/staff-detail-brief.md` (~37k bytes; safely under token limit but verify with a head read first)

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
- Append `step-0: COMPLETE — skills verified` to `/redesign/per-page-progress/staff-detail-progress.md` and cat it.

---

## Step 1 — Turn 1: Re-prime (verbatim from workflow guide)

> Fresh session — re-priming for Phase 6 (Implementation) of the admin redesign recipe.
> Page being redesigned in THIS session: staff-detail
>
> STEP 1 — READ THESE FILES IN ORDER. Do not skim.
> 1. PRODUCT.md (foundation file — register, voice, anti-references)
> 2. /redesign/RECIPE-PROGRESS.md
> 3. /redesign/SAFETY-NET.md (so you know the rollback path for the branch I chose in Phase 0a)
> 4. DESIGN.md (full, incl. ## Admin-Specific Patterns)
> 5. /redesign/briefs/staff-detail-brief.md   ← the brief for THIS page only
> 6. /redesign/BASELINE-ISSUES.md
> 7. /redesign/IMAGES-NEEDED.md
>
> STEP 2 — CONFIRM IN ONE MESSAGE:
> - One sentence per file, telling me what's in it
> - The exact register from PRODUCT.md (must read "product" for this admin recipe — flag if it doesn't)
> - The page you're about to redesign + its file path (cross-checked between RECON.md mentions and the brief)
> - The Feature Preservation Manifest items from the brief (every form, button, JS hook that must survive — particularly the (viewer × target) matrix in §11)
> - Pre-existing console errors I should NOT chase (from BASELINE-ISSUES.md)
> - The phase + page we're entering (should be Phase 6 for staff-detail)
>
> CONFIRMATION CHALLENGE: after your one-sentence-per-file summary, quote the SECOND sentence of `/redesign/briefs/staff-detail-brief.md`'s `## 6. Key States` section verbatim. If you can't quote it accurately, you didn't actually re-read — re-read from disk now and try again. This guards against summarised cache.

**Evidence to surface:**
- All 7 one-sentence summaries printed to chat
- The literal line: `PRODUCT.md register: product`
- A verbatim quote of brief `## 6. Key States` sentence 2, prefixed with `BRIEF_S6_QUOTE: ` and inside a blockquote
- Feature Preservation Manifest items listed in chat as a bullet list (RECON §5 helpers + both form field names + five permission flags + `isOwnProfile` + self-lockout protection)
- Append `step-1: COMPLETE — re-prime confirmed` and cat the progress file

---

## Step 2 — Turn 2 ack + Ralph Zone 1 BROKEN guard (READ-ONLY)

Self-acknowledge `primed — go` (no external user to wait for; you proceed in `/goal` mode).

The Ralph Zone 1 batch loop was run once near the start of Phase 6, before this page. **Do NOT re-run the batch loop.** Run only the read-only BROKEN discrepancy guard:

> Read `/redesign/BUSINESS-COMPLETENESS.md`. List every Track A / BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN. For each item, report: item id/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session (staff-detail) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED/PARTIAL. Do not edit files. Do not modify the recipe Ralph command. Stop after the list.

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
> - /redesign/briefs/staff-detail-brief.md  ← THIS IS THE PREPARED BRIEF
>
> Tell me before writing any code:
> - Files you will edit
> - Files you will NOT touch (from the brief's untouchable list)
> - Features you are preserving — particularly each cell of the (viewer × target) matrix
> - Any conflict between brief and codebase
>
> (You are running under `/goal`, so "wait for my go-ahead" → instead print the file list to chat with a literal `SCOPE_PROPOSAL:` prefix, then proceed.)
>
> WRITE THE PER-PAGE SCOPE TO DISK before craft runs:
> Write to `/redesign/per-page-scope/staff-detail-scope.md` with two sections:
>   ## Files to edit
>   - [path] — [what changes]
>   ## Files to NEVER touch
>   - [path] — [reason]
>
> CRITICAL — how to handle craft's internal shape discovery: per the docs, `/impeccable craft` runs `/impeccable shape` internally as its first phase. When shape asks discovery questions (Purpose, User, Content, Feeling, Constraints), quote each section from `/redesign/briefs/staff-detail-brief.md` verbatim as your answer, but expect shape to expand or adjust them. Confirm each section back to chat, accept any expansions shape proposes, then proceed.
>
> Match DESIGN.md tokens exactly. If the brief conflicts with the codebase, STOP and report — do not guess.
>
> RESPONSIVE STRATEGY: **mobile-first** — build 375px first, then enhance to 768 → 1440. Right rail is stacked below main column on mobile; sticky on `xl:` and above.
>
> IMAGE HANDLING: append `assignments-quiet.svg` (calendar-quiet, ~80–120px) to IMAGES-NEEDED.md for Panel L2 empty state.
>
> BACKEND FAKE MARKER: staff-detail has no FAKE-tagged backend dependencies. Skip; mark Backend status: `HANDLED` in the audit log entry.

**Evidence to surface:**
- Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list
- `/redesign/per-page-scope/staff-detail-scope.md` written; print its contents to chat
- `git diff redesign/IMPLEMENTATION-PLAN.md` shows the "Currently on" line update
- Append `step-3: COMPLETE — scope written, plan updated` and cat progress file

---

## Step 4 — `/impeccable craft redesign of admin page staff-detail`

**Action:** Invoke Skill tool with `/impeccable craft redesign of admin page staff-detail`. Feed the brief sections verbatim to shape discovery as they're requested. Let craft do its full build phase. Pay particular attention to the (viewer × target) matrix in §11 — every cell must remain functional.

**Evidence to surface:**
- The Skill invocation appears in transcript
- After craft finishes, print `git diff --stat` to chat (only worktree-scoped files should appear)
- Print the literal line `CRAFT_COMPLETE`
- Append `step-4: COMPLETE — craft built page` and cat progress file

---

## Step 5 — Required Ralph polish loop

**Action:** Invoke Skill with:

```
/ralph-loop "Read the brief at /redesign/briefs/staff-detail-brief.md. Compare the current implementation to the brief's requirements (11 native sections + Recipe Context + Implementation Notes). Apply one focused improvement. Re-check against the brief. If all brief requirements are met, output <promise>PAGE-POLISH-COMPLETE</promise>." --max-iterations 8 --completion-promise "PAGE-POLISH-COMPLETE"
```

**Evidence to surface:**
- The literal token `PAGE-POLISH-COMPLETE` (inside `<promise>...</promise>` tags) appears in the transcript before this step exits
- Each polish iteration's one-line change summary printed
- Append `step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE` and cat progress file

---

## Step 6 — Start dev server on port 3001 (in this worktree)

**Action:** node_modules is already junctioned. Start the dev server in the background:

```bash
cd "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-staff-detail-redesign"
pnpm next dev -p 3001
```

Use `run_in_background: true`. Poll `http://localhost:3001/admin/staff` until it returns HTTP 200 (or 308). Max wait: 60 seconds. Then resolve a seed staff UUID for use in subsequent steps (read the seed file or query the test admin's own staff_id).

**If node_modules junction is broken** (junction got removed or stale), fall back to:
```powershell
cmd /c mklink /J node_modules "C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor\node_modules"
```

**Evidence to surface:**
- The HTTP status code from the readiness poll printed to chat
- A real seed `staffId` UUID resolved and printed: `SEED_STAFF_ID: <uuid>`
- Literal line `DEV_SERVER_READY at http://localhost:3001`
- Append `step-6: COMPLETE — dev server on 3001` and cat progress file

---

## Step 7 — Step 2 iterate (screenshots + named-axis decision)

**Action:** Use the `playwright` MCP tool (NOT `chrome-devtools` — playwright handles redirects).

Sign in as `test.admin@rahmatherapy.example.test` / `AdminTest123!` at `/admin/login`. Take screenshots and save to `/redesign/screenshots/staff-detail-redesign/`:
- `chunk1-1440-default.png` at 1440×900 navigating to `/admin/staff/<SEED_STAFF_ID>` (admin viewing colleague — full surface)
- `chunk1-1440-self.png` at 1440×900 navigating to the admin's own staff-detail URL (self-view with R5 lockout banner + "You" chip)
- `chunk1-768-default.png` at 768×1024 on colleague URL
- `chunk1-375-default.png` at 375×812 on colleague URL (right rail stacks below main)
- `chunk1-1440-readonly.png` at 1440×900 after re-signing-in as a coordinator on a same-pool colleague (read-only `dl` Profile + L2 only + R1)
- `chunk1-1440-denied.png` at 1440×900 on an out-of-scope URL (e.g. coordinator hitting an inactive colleague) — denied state

> **Heads up on session-cookie bleed:** between role swaps, sign out via `/admin/signout` so the (viewer × target) matrix renders cleanly. If the page renders the wrong scope, clear cookies and retake.

Self-assess against the brief. If you can identify ONE specific axis problem:

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | `/impeccable bolder staff-detail` |
| Too loud, too many colours | `/impeccable quieter staff-detail` |
| Grey, lifeless, no identity | `/impeccable colorize staff-detail` |
| Fonts feel default or inconsistent | `/impeccable typeset staff-detail` |
| Spacing is off, things feel cramped | `/impeccable layout staff-detail` |
| Static, jumpy, no motion | `/impeccable animate staff-detail` |
| Functional but cold | `/impeccable delight staff-detail` |
| Too much on the page | `/impeccable distill staff-detail` |

**Skip `/impeccable live`** — interactive only, doesn't work headless.

If a refine runs, re-screenshot with `-after-refine` suffix.

**Evidence to surface:**
- 6+ screenshot file paths printed to chat (`ls redesign/screenshots/staff-detail-redesign/`)
- Literal decision: `ITERATE_DECISION: no refine needed — <brief-justified reason>` OR `ITERATE_DECISION: ran /impeccable <axis> staff-detail because <reason>`
- Append `step-7: COMPLETE — iterate decision logged` and cat progress file

---

## Step 8 — `/impeccable adapt staff-detail for mobile and tablet`

**Action:** Invoke Skill with `/impeccable adapt staff-detail for mobile and tablet`.

After adapt finishes:
1. Screenshot at 768×1024 → save to `/redesign/baseline/staff-detail-adapt-after-tablet.png`
2. Screenshot at 375×812 → save to `/redesign/baseline/staff-detail-adapt-after-mobile.png`
3. Confirm no horizontal scroll at either breakpoint (Playwright: check `document.documentElement.scrollWidth <= window.innerWidth`)
4. Confirm tap targets ≥ 44px on mobile for the Save profile Primary, tab pills, and override-row switches
5. Confirm the right rail stacks below the main column on mobile in the documented order R1 → R2 → R3 → R4 → R5

**Evidence to surface:**
- Two `staff-detail-adapt-after-*.png` paths printed
- Horizontal-scroll check result for both viewports (`HORIZONTAL_SCROLL_TABLET: false`, `HORIZONTAL_SCROLL_MOBILE: false`)
- Touch-target height for Save profile button on mobile (`TOUCH_TARGET_SAVE_MOBILE: <px>`)
- Rail-order check on mobile (`RAIL_ORDER_MOBILE: R1, R2, R3, R4, R5` or list deltas)
- Append `step-8: COMPLETE — adapt run, breakpoints clean` and cat progress file

---

## Step 9 — `/impeccable harden staff-detail`

**Action:** Invoke Skill with `/impeccable harden staff-detail`.

Save the FULL harden recommendations report to `/redesign/HARDEN-RECS-staff-detail.md`. Implement what harden recommends per the brief's `## 6. Key States`. Particular attention to:
- Inactive staff banner above the tab strip
- Out-of-team vs out-of-scope denied surfaces (distinct copy, no `view_staff` identifier)
- Permission override critical/high/medium/low risk-tier confirm matrix
- Self-overrides lockout banner replaces editor on self-view
- Empty Assigned bookings + Audit history states

Verification edge cases (staff-detail-specific):
- 60-character `name` doesn't break the H1 row at 375px
- Bio at 600-character cap doesn't overflow the read-only `dl` cell
- R4 disclosure expansion doesn't push other rail panels out of sticky position
- Profile completion count of 0/5 renders Cancelled-family tint without colour-only signal
- Override grant on a critical-tier permission opens the destructive confirm with the documented copy

**Evidence to surface:**
- `/redesign/HARDEN-RECS-staff-detail.md` exists; print first 60 lines to chat
- List of states added (or "none, harden confirmed existing states cover brief")
- File paths touched (`git diff --stat`)
- Append `step-9: COMPLETE — harden run, HARDEN-RECS-staff-detail.md saved` and cat progress file

---

## Step 10 — `/impeccable clarify staff-detail`

**Action:** Invoke Skill with `/impeccable clarify staff-detail`.

Verify copy matches the brief's `## 8. Content Requirements` and `## Copy` sections exactly. Specifically:
- Breadcrumb: `← Team directory`
- Sub-line: `Staff profile` (colleague) / `Your profile` (own)
- Tab labels: `Profile` / `Availability` with `aria-current="page"` on active
- Status chips: `Active` / `Bookings off` / `Inactive`
- Panel L1 read-only fallback: `This colleague's profile is still being filled in.`
- Panel L2 sub-line: `{n} upcoming · {n} past visible.`
- Panel R5 self-banner: `Self overrides are disabled to prevent lockout. Ask another owner-level admin to change your overrides.`
- Out-of-team denied: `Team profiles aren't visible in your role. Open your own profile from the directory instead.`
- Out-of-scope denied: `This profile isn't visible in your current team scope. Ask the owner if you need access.`
- No raw `view_staff` permission identifier anywhere (current `page.tsx:91` and `:121` leak it; fix here)
- All `StaffProfileForm` validation copy matches brief §10 / Copy block

**Evidence to surface:**
- List of copy surfaces changed (with before/after) — OR `CLARIFY_RESULT: copy already matches brief §8 + Copy block`
- Append `step-10: COMPLETE — clarify run, copy verified` and cat progress file

---

## Step 11 — Verify (Step 6 from workflow guide)

**Action:** Three sub-checks in order.

### 11a — Token-drift lint

```bash
grep -nE '#[0-9a-fA-F]{3,8}' src/app/admin/staff/\[staffId\]/page.tsx src/app/admin/staff/\[staffId\]/StaffProfileForm.tsx src/app/admin/staff/\[staffId\]/StaffPermissionOverridesForm.tsx
grep -nE 'oklch\(' src/app/admin/staff/\[staffId\]/*.tsx
grep -nE '\\d+px' src/app/admin/staff/\[staffId\]/*.tsx
grep -nE "font-family:\s*['\"]" src/app/admin/staff/\[staffId\]/*.tsx

# Raw spacing literals (canon: should match the spacing scale in DESIGN.md)
grep -nE '(margin\|padding):\s*\d' src/app/admin/staff/\[staffId\]/*.tsx
grep -nE 'text-(emerald|orange|red|amber|green)-[0-9]+' src/app/admin/staff/\[staffId\]/*.tsx
grep -nE 'border-l-4|border-b-2' src/app/admin/staff/\[staffId\]/*.tsx
grep -nE 'view_staff' src/app/admin/staff/\[staffId\]/*.tsx
```

For each match, confirm the value comes from a DESIGN.md token. Particular attention to the Profile-completion + Onboarding checklist icons — they should use Confirmed/Cancelled status families, never raw `text-emerald-600` / `text-orange-600`. The `view_staff` raw identifier must be 0. The active tab indicator must NOT be `border-b-2` colour-only.

### 11b — Playwright verification at all viewports (mobile-first: 375 → 768 → 1440)

- Sign in at `/admin/login` with `test.admin@rahmatherapy.example.test` / `AdminTest123!`
- Navigate to `/admin/staff/<SEED_STAFF_ID>` (colleague URL) at each viewport
- Save final-state screenshots: `staff-detail-final-{375,768,1440}.png`
- Edit the `short_bio` field → click Save profile → verify Sonner success toast `Profile saved.` + R2 count refreshes via revalidatePath
- Click an override row's switch on a medium-risk permission → verify one-click (no modal); on a critical-risk → verify modal renders with documented copy
- Click tab `Availability` → verify navigation to `/admin/staff/<id>/availability` (cross-page navigation, no JS error)
- Click `Show all assignments →` (Panel L2 footer) → verify URL `/admin/bookings?staffId=<id>&view=upcoming`
- Click `Open audit trail →` (Panel L3 footer) → verify URL `/admin/audit?target_type=staff&target_id=<id>`
- Sign out, sign back in as the admin's own self URL → verify R5 renders the lockout banner instead of the editor + "You" chip on R1

### 11c — Console + Network

- Print last 20 console messages to chat — verify 0 NEW errors vs `/redesign/BASELINE-ISSUES.md`
- Print network requests during profile save — verify the POST to the `StaffProfileForm` server action with all preserved field names

**Evidence to surface:**
- All seven grep results in chat with explicit `TOKEN_DRIFT: 0` (or list each match + fix)
- 3 final screenshots + the save-success screenshot
- Console summary line: `CONSOLE_NEW_ERRORS: 0` (or list)
- Network summary line: `NETWORK_BASELINE_MATCH: yes` (or list deltas)
- Append `step-11: COMPLETE — verification clean` and cat progress file

---

## Step 12 — `/impeccable audit staff-detail` + `/impeccable critique staff-detail` + functional smoke test

### 12a — Audit
Invoke Skill with `/impeccable audit staff-detail`.

**Severity rubric — anchor every finding before tagging (impeccable v5 L884-890):**
- **P0** Blocks release — fix before shipping anything
- **P1** Fix this sprint — significant impact on users
- **P2** Next cycle — noticeable but not blocking
- **P3** Polish — minor, fix when time allows

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## staff-detail — audit`:
- 5 dimension scores
- P0/P1/P2/P3 findings, each on its own line
- Backend status: `HANDLED` (no BLOCKS-REDESIGN BUILD; §10 Q3 limit-bump non-blocking and applied if scope allows)
- **P1 (tag for Phase 7 gauntlet):** subsection — list each P1 finding with location + file:line; if zero, write `none`. Phase 7 `/impeccable audit admin` re-scans this section.
- **BUSINESS-COMPLETENESS impact:** subsection — name any `redesign/BUSINESS-COMPLETENESS.md` items this page newly contributes to (e.g. `2A-6` if form-level error `role="alert"` was implemented). Lets the universal flag flip `PARTIAL` → `HANDLED` when all form-bearing pages adopt.

**Print the appended section to chat.**

**If any P0 finding: emit `P0_FOUND:` followed by the list and STOP.**

### 12b — Critique
Invoke Skill with `/impeccable critique staff-detail`.

Append to `/redesign/PER-PAGE-SCORES.md` under heading `## staff-detail — critique`:
- 10 Nielsen heuristic scores
- AI-slop verdict (PASS / REGRESSED / FAIL)
- Brief commentary

**Print the appended section to chat.**

If AI-slop verdict is REGRESSED or FAIL: re-run `/impeccable bolder staff-detail` OR `/impeccable distill staff-detail`, then re-run `/impeccable critique staff-detail`. Loop max 2 times.

### 12c — Functional smoke test

Run through brief's Feature Preservation Manifest manually via Playwright + read-the-code, walking each cell of the §11 (viewer × target) matrix:

- [ ] Owner viewing colleague: all panels L1 (editable) / L2 / L3 / R1 / R2 / R3 / R4 / R5 visible
- [ ] Owner viewing self: same panels except R5 (lockout banner), "You" chip on R1
- [ ] Coordinator viewing assignment-pool colleague: L1 read-only `dl` + L2 (with/without client context per `canViewClientWorkloadContext`) + R1 only
- [ ] Therapist viewing same-gender colleague: L1 read-only + L2 (gender-chip variant) + R1 only
- [ ] Therapist viewing self: L1 editable safe-fields + L2 (own assignments) + R1 (You) + R2
- [ ] Out-of-team denied surface renders `Team profiles aren't visible in your role.` with `Open my profile` Secondary + `Back to dashboard` Ghost
- [ ] Out-of-scope denied surface renders `This profile isn't visible in your current team scope.` with `Back to team directory` Secondary
- [ ] `StaffProfileForm` field `name` attrs all present in DOM (full list from Hard Rule 5)
- [ ] `StaffPermissionOverridesForm` per-row switch posts preserved; self-lockout protection in place server-side
- [ ] Cross-link "Show all assignments →" resolves to `/admin/bookings?staffId=<id>&view=upcoming`
- [ ] Cross-link "Open audit trail →" resolves to `/admin/audit?target_type=staff&target_id=<id>`
- [ ] Cross-link "Open availability →" resolves to `/admin/staff/<id>/availability`
- [ ] Active tab carries `aria-current="page"` (Sam #3 fix); active state is Clinic Green fill + Field White text, NOT `border-b-2`
- [ ] No raw `view_staff` identifier on either denied surface (BASELINE-CRITIQUE carry-forward)
- [ ] Checklist icons use Confirmed/Cancelled status families, never raw `text-emerald-600` / `text-orange-600`
- [ ] Right rail is sticky on `xl:` and stacks naturally below main on mobile

**Evidence to surface:**
- Both PER-PAGE-SCORES.md sections printed to chat (audit + critique)
- Functional smoke test checklist printed with PASS/FAIL per item
- Literal line `SMOKE_TEST: all PASS` (or list FAILs)
- Append `step-12: COMPLETE — audit/critique/smoke clean` and cat progress file

---

## Step 13 — Handoff (NO COMMIT — wait for user approval)

**Action:**
1. Run `git diff --stat` in the worktree — print to chat
2. Compare changed-files list against `/redesign/per-page-scope/staff-detail-scope.md`. For any file changed that isn't in the scope file's "Files to edit" list: STOP and emit `SCOPE_VIOLATION: <file>`. Otherwise: `SCOPE_CLEAN: only scoped files changed`.
3. Run `git diff` (full) and confirm nothing unexpected appears — print the diff to chat in collapsible form.
4. Emit the handoff message to chat with:
   - Dev server URL: `http://localhost:3001/admin/staff/<SEED_STAFF_ID>`
   - All screenshot paths
   - Audit + critique key scores
   - Backend status: `HANDLED` (no BLOCKS-REDESIGN dependency)
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
13. `## staff-detail — audit` and `## staff-detail — critique` headings appended (printed to chat from the file)
14. `SMOKE_TEST: all PASS`
15. `SCOPE_CLEAN: only scoped files changed`
16. `HANDOFF_READY — awaiting user approval`

If any of those is missing → keep working on the corresponding step. If the agent is repeating itself without progress, the user will `/goal clear` manually.

End of recipe.
