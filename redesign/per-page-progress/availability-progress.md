# Progress — availability

Started: 2026-05-15
Recipe: /redesign/per-page-recipes/availability-recipe.md

## Step log

step-1: COMPLETE — re-prime confirmed
step-2: COMPLETE — BROKEN guard run; none
step-3: COMPLETE — scope written, plan updated
step-4: COMPLETE — craft built page (capacity preview, 3 managers, tab wrapper, denied surfaces)
step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE
step-6: COMPLETE — dev server on 3004 (webpack; turbopack root inference issue worked around)
step-7: COMPLETE — axes applied: typeset, layout
step-7b: COMPLETE — polish loop done (iter1 fixed list-disc bullets; iter2 clean)
step-8: COMPLETE — adapt run, breakpoints clean (no horizontal scroll, 44px touch targets)
step-9: COMPLETE — harden run, HARDEN-RECS-availability.md saved (H1–H5 closed; client-side brief copy for duplicate/past/closed-day/network)
step-10: COMPLETE — clarify run, copy verified (fixed 2 em-dash tooltips)
step-11: COMPLETE — verification clean (TOKEN_DRIFT 0, BORDER_L_4 0, CONSOLE_NEW_ERRORS 0, NETWORK_BASELINE_MATCH yes)
step-12: COMPLETE — audit (28/40 ish, 0 P0 / 2 P1 / 3 P2 / 4 P3, Backend HANDLED), critique (AI-slop PASS, 28/40 Nielsen), smoke ALL PASS
step-13: COMPLETE — handoff emitted, awaiting approval
step-14: COMPLETE — 6 post-handoff operator-value enhancements applied: (1) Copy Monday → Tue–Sat Ghost button; (2) resolved-week 7-day strip overlaying closures + overrides; (3) "Last saved by {actor} on {date}" trail line under each manager panel; (4) all-days-closed save guard via ConfirmActionModal; (5) closed-day-with-bookings mismatch guard via inline Base UI Dialog + bookingsByDate prefetch; (6) dignified SVG empty-state illustrations replacing Lucide-icon-in-circle fallback for closed-dates / hour-adjustments / no-active-staff. All 6 verified live in browser at 375/768/1440 — no horizontal scroll, no console errors, all server-action contracts + audit writes + form field names preserved.

## Corrective dispatch (2026-05-16)

Five fixes applied on top of the 3083d97 commit; scoped to 3 source files + 2 doc files. No commit yet.

- **Fix 1 (P1 dangling aria):** Added `id={`availability-tab-${tab.key}`}` to each tab button (`AvailabilityManagersTabs.tsx:81`). Verified via Grep `availability-tab-` → 1 dynamic `id=` (resolves to 3 IDs via `.map`) + 3 consumer `aria-labelledby` references at lines 108/116/124.
- **Fix 2 (P1 keyboard nav):** Wired `onKeyDown={handleKeyDown}` on `role="tablist"` (`AvailabilityManagersTabs.tsx:72`) handling ArrowLeft/ArrowRight (wrap-around) + Home/End with focus migration via `tabRefs`. ARIA tab pattern: `tabIndex` is `0` on active, `-1` on inactive. Verified via Grep showing the 4 case statements + handler binding.
- **Fix 3 (P2 Cormorant in pills):** Removed the inline `fontFamily: "var(--font-admin-serif), ..."` from CapacityPill (`page.tsx:557-571`). Numerals now render in Work Sans 500 label step per DESIGN.md "Cormorant Exception". Verified via Grep — only a comment reference to "Cormorant" remains, 0 font-family usages.
- **Fix 4 (P2 Coordinator denied):** Added `actions={<Link href="/admin/dashboard">Back to dashboard</Link>}` to the Coordinator `AdminAccessDenied` (`page.tsx:625-632`) matching the Therapist denied pattern. Verified via Read showing the Link element with classes mirroring the Therapist Secondary button.
- **Fix 5 (P2 animation snap):** Replaced `hidden h-0 invisible` with a CSS-grid collapse pattern (`AvailabilityRulesManager.tsx:332-396`): outer `grid` toggles `[grid-template-rows:0fr]` ↔ `[grid-template-rows:1fr]` + `opacity-0` ↔ `opacity-100`, inner wrapper carries `min-h-0 overflow-hidden`, transition declared on `grid-template-rows,opacity` with `motion-reduce:transition-none`. Closed-day branch no longer contains the `hidden` token (the 3 remaining `aria-hidden` + 2 `overflow-hidden` + 1 dash-separator `hidden sm:block` matches are out-of-scope per directive). Brief §3 "160ms ease-gentle reveal" now fires.

**git diff --stat HEAD (verification 6):** 4 files reflect the source edits + deferrals; this progress file is the 5th, appended below. No unexpected src/ file appears in diff. The 2 pre-session-modified files (`availability-recipe.md`, `test-credentials.md`) remain unstaged and out of this corrective dispatch's scope.
