# C-19 — Privacy policy page — **PLAN**

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: none — C-19 has no hard dependency on any Band C plan; soft coordination with C-17/C-18 (conditional-safe copy, not a blocking order — see §0 item 1a and Decision D18).
> Decisions: C-B-DECISIONS.md — no direct C-19 entries (2026-07-16 post-handoff addition). Findings applied: see refinement changelog.

**Type:** Band C plan-writing output (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Brief:** `redesign/briefs/C-19-privacy-policy-page-brief.md` (companion — read first; carries the scope discipline: ONE new page, nothing else touched)
**Progress (filled in C-C):** `redesign/per-page-progress/C-19-privacy-policy-page-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. Branch confirmed with user: on `master`; HEAD at or descended from `ea97932`; verify with `git branch --show-current` + `git merge-base --is-ancestor ea97932 HEAD` (the pre-merge `(public)` divergence from the frontend line no longer exists — the frontend branch merged at `ea97932`) [C19-F1].
1a. Soft coordination (not a hard dependency, Decision D18): C-19's copy for the analytics/processor list and the `/cookies` reference is written conditional-safe so it stays true whether C-17/C-18 have landed yet or not (see §1 Step 1 copy rules and brief §1 items 3-4). No blocking order required.
2. Dev server → 200 (`pnpm dev`, default port 3000; `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` expect `200`); static gates green — no NEW errors vs baseline: tsc/build clean; lint 59-error baseline (55 untracked `design_handoff_area_pages/prototype/*.jsx` + 4 pre-existing in `src/features/booking/`); vitest 6 pre-existing failures in 3 files (ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1) unchanged [C19-F3].
> ⏸ **STOP-AND-ASK: OWNER INPUT REQUIRED** — (a) contact details to publish (email/phone; postal optional); (b) retention number (7-year insurance default unless their policy says otherwise); (c) business/trading name line for "Who we are". Do not proceed with placeholder values.
3. **Three user confirmations (copy inputs, 2 minutes):** (a) contact details to publish (email/phone; postal optional); (b) retention number (7-year insurance default unless their policy says otherwise); (c) business/trading name line for "Who we are".
4. Re-verify the booking schema fields haven't changed since 2026-07-16 (`src/app/api/bookings/route.ts:14-40` — still byte-accurate post-merge, verified 2026-07-26) — the "What we collect" section mirrors it, including per-participant notes (`participantNotes[]` in `AboutYouStep.tsx:429` / `route.ts:27`), which are third-party free-text about other people and may include their health information [C19-F6].
5. **DO-NOT-TOUCH:** every other file. The diff for this plan is one new page file (+ optional trivial test).
6. **DO-NOT-TOUCH (live data)**: booking `9d55ce2a` (Badar — real customer email); Owner account `rahmatherapy@outlook.com` in email-test paths; any client whose email isn't `*.example.test` or name isn't `Phase10*`/`Audit Test*` test patterns.

---

## 1 — Implementation (2 steps)

**Step 1 — `src/app/(public)/privacy/page.tsx`.**

Server component; static content; `metadata` with title "Privacy Policy — Rahma Therapy" + description. Structure: page header (existing public heading pattern), "Last updated: {date}" line, then the nine brief-§1 sections as anchored headings (`id` per section) with short plain-English paragraphs — copy drafted from the brief's section list and the three pre-flight confirmations. Styling: existing public section/typography components + `--rahma-*` tokens only; readable measure (~65ch); no new components beyond what the page itself needs.

Copy rules: no statute citations in body text (rights and bases described in plain words); health-information sentence mirrors the booking form's reality ("notes you choose to share, which may include health information — used only to deliver your treatment safely, with your consent, and removable on request"); transfers paragraph written swap-ready (names the UK-US framework OR approved contract terms without hinging on either); analytics/processor and `/cookies` wording written conditional-safe (Decision D18) so the sentence stays true whether or not C-17/C-18 have shipped yet — see brief §1 items 3-4 for the exact phrasing.

**Step 2 — Verify + evidence.** `pnpm lint` (no NEW errors vs the 59-error baseline — see pre-flight #2) / `tsc` / `build` green; page renders at `/privacy` at 375 + 1280 (screenshots saved to `redesign/evidence/C-19/`); content cross-checked against the booking schema (pre-flight #4) and the brief's nine sections; `git status --porcelain -- src/app/(public)/privacy/` shows exactly the one new file (the wider tree is intentionally dirty outside this path — never `git add -A`/stash/restore to "clean" it) [C19-F2].

---

## 2 — Files touched

**NEW (1):** `src/app/(public)/privacy/page.tsx`.
**EDITED: none.** **UNCHANGED: everything else — by design (user-locked scope).**

---

## 3 — Verification gate

1. Static gates: no NEW lint errors vs the 59-error baseline; tsc/build clean; vitest 6 pre-existing failures baseline unchanged [C19-F3]. Bundle ~0 (static server-rendered page).
2. Nine sections present, including the participant-notes third-party-data sentence [C19-F6]; content matches the audited data flows + the three user confirmations; last-updated present; plain-English check (read-aloud test).
3. 375 + 1280 screenshots stored in `redesign/evidence/C-19/` (`redesign/audits/**` is read-only historical record — not a valid write target) [C19-F4 / Decision D15].
4. Diff audit: `git status --porcelain -- src/app/(public)/privacy/` shows exactly one new file [C19-F2].

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
