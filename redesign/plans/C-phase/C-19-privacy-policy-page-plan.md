# C-19 — Privacy policy page — **PLAN**

**Type:** Band C plan-writing output (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Brief:** `redesign/briefs/C-19-privacy-policy-page-brief.md` (companion — read first; carries the scope discipline: ONE new page, nothing else touched)
**Progress (filled in C-C):** `redesign/per-page-progress/C-19-privacy-policy-page-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. Branch confirmed with user (public-pages work — same note as C-17/C-18: `(public)` diverges ~9 lines from the frontend line).
2. Dev server → 200; static gates green.
3. **Three user confirmations (copy inputs, 2 minutes):** (a) contact details to publish (email/phone; postal optional); (b) retention number (7-year insurance default unless their policy says otherwise); (c) business/trading name line for "Who we are".
4. Re-verify the booking schema fields haven't changed since 2026-07-16 (`src/app/api/bookings/route.ts:14-40`) — the "What we collect" section mirrors it.
5. **DO-NOT-TOUCH:** every other file. The diff for this plan is one new page file (+ optional trivial test).

---

## 1 — Implementation (2 steps)

**Step 1 — `src/app/(public)/privacy/page.tsx`.**

Server component; static content; `metadata` with title "Privacy Policy — Rahma Therapy" + description. Structure: page header (existing public heading pattern), "Last updated: {date}" line, then the nine brief-§1 sections as anchored headings (`id` per section) with short plain-English paragraphs — copy drafted from the brief's section list and the three pre-flight confirmations. Styling: existing public section/typography components + `--rahma-*` tokens only; readable measure (~65ch); no new components beyond what the page itself needs.

Copy rules: no statute citations in body text (rights and bases described in plain words); health-information sentence mirrors the booking form's reality ("notes you choose to share, which may include health information — used only to deliver your treatment safely, with your consent, and removable on request"); transfers paragraph written swap-ready (names the UK-US framework OR approved contract terms without hinging on either).

**Step 2 — Verify + evidence.** `pnpm lint` / `tsc` / `build` green; page renders at `/privacy` at 375 + 1280 (screenshots); content cross-checked against the booking schema (pre-flight #4) and the brief's nine sections; `git status` shows exactly the one new file.

---

## 2 — Files touched

**NEW (1):** `src/app/(public)/privacy/page.tsx`.
**EDITED: none.** **UNCHANGED: everything else — by design (user-locked scope).**

---

## 3 — Verification gate

1. Static gates (lint, tsc, build; vitest untouched baseline). Bundle ~0 (static server-rendered page).
2. Nine sections present; content matches the audited data flows + the three user confirmations; last-updated present; plain-English check (read-aloud test).
3. 375 + 1280 screenshots stored in `redesign/audits/C-A/screenshots-c-19/`.
4. Diff audit: exactly one new file.

---

## 4 — Risks / undo / fixtures

- Content drift if the booking form changes later — the standing note: edit this page when collected fields change (one line in the page's header comment).
- Transfers framework under CJEU appeal — wording is swap-ready; annual review note in the header comment.
- Undo: revert one commit. No data, no migration, no fixtures.

---

## 5 — Commit cadence

One commit: `feat(redesign): C-19 privacy policy page`. (+ the verification screenshots in the progress commit if separate.)

---

## 6 — Hand-off to C-C

Run pre-flight #3's three confirmations with the user → write the page → gate → flip the master-plan C-19 row → ✅. Business items recorded in the brief (ICO fee; retention confirmation) are the user's, not the implementer's.

---

*End of C-19 plan.*
