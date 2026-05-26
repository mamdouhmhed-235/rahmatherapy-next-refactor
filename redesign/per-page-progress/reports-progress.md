# Progress — reports

Started: 2026-05-15
Recipe: /redesign/per-page-recipes/reports-recipe.md

## Step log

step-1: COMPLETE — re-prime confirmed
step-2: COMPLETE — BROKEN guard run (result: none)
step-3: COMPLETE — scope written, plan already points at reports (line 13 set in commit fd6d542)
step-4: COMPLETE — craft built page (page.tsx rewritten; RangeHelper.tsx added)
step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE (4 iterations: sub-line copy, Section C tile alignment, metric-summary Restricted chip, flat row primitive)
step-6: COMPLETE — dev server on 3020 (webpack; turbopack root inference issue worked around — same approach as availability/calendar sessions)
step-7: COMPLETE — axes applied: layout (section gap 24→32px, FilterField gap 6→8px), typeset (section H2 → 1.5rem inline-icon header replacing 36px boxed chiclet)
step-7b: COMPLETE — polish loop done (iter1 audit found no visible defects at 375/768/1440; iter2 skipped per recipe rule; horizontal scroll false at all 3 viewports)
step-8: COMPLETE — adapt run, mobile AdminSheet trigger added (h-11 44px), all sheet inputs h-11, Apply Primary in sheet h-11; HORIZONTAL_SCROLL_MOBILE false, HORIZONTAL_SCROLL_TABLET false, TOUCH_TARGET_APPLY_MOBILE 44px
step-9: COMPLETE — harden run, HARDEN-RECS-reports.md saved (4 added states: custom-empty-from-to, far-future, source-channel empty differentiation, error.tsx page-load boundary)
step-10: COMPLETE — clarify run, CLARIFY_RESULT: copy already matches brief Copy section (no surface changes — all page-visible strings verbatim per brief §Copy)
step-11: COMPLETE — verification clean (TOKEN_DRIFT 0, CONSOLE_NEW_ERRORS 0, RECHARTS_WARNINGS 0 [baseline 6 → fixed via explicit height={288} on ResponsiveContainer], NETWORK_BASELINE_MATCH yes; range select+Apply URL update verified; CSV download HTTP 200 text/csv verified; custom from>to inline error verified; clean sign-out via POST verified)
step-12: COMPLETE — audit (34/40 ish, 0 P0 / 0 P1 / 4 P2 / 4 P3; Backend N-A; 2A-7 fully resolved, 2A-6 partial), critique (34/40 Nielsen; AI-slop PASS; 5 polish carry-forwards), SMOKE_TEST all PASS (form action + 6 params + 8 CSV keys + 3-of-8 CSV downloads HTTP 200 + Owner/Coordinator/Therapist role pass + Outstanding tint + <details> + Recharts minHeight + no raw permission identifier)
step-13: COMPLETE — handoff emitted, awaiting approval

## Corrective dispatch (post-handoff, 2026-05-16)

Six fixes applied on top of the handoff state per user-validated audit list. Scoped to `src/app/admin/reports/page.tsx` + new `loading.tsx`. Two items deferred per their own rationale.

- **Fix 1 (Section C inline tiles):** Replaced two full `AdminStat` tiles with compact `CompactStat` mini-tiles inside the "Outstanding vs collected" panel — Cormorant numeral at heading step (1.778rem) instead of display step (3.157rem); label/note left-aligned, value right-aligned, status-family border tint. Preserves brief §5 "AdminStat-LIKE tiles stacked (Cormorant numerals), Mirrors the headline stats" while reducing visual repetition at desktop.
- **Fix 2 (Metric definitions grid):** Split `METRIC_DEFINITIONS` into Revenue group (booked/expected/collected/outstanding/completed/staff revenue) + Activity group (repeat_clients/participant_count) with `MetricGroupHeading` sub-labels and thin border-subtle divider between. Breaks the 4×2 identical-chip grid into 3-row+1-row clusters with semantic grouping.
- **Fix 3 (AdminStat resting shadow):** DEFERRED — cross-cutting 00-shared-components territory; would impact 28+ admin pages. Logged in deferrals file as Phase 7 carry-forward.
- **Fix 4 (Section H2 type step):** Bumped from `text-[1.5rem]` + `tracking-[-0.018em]` + `leading-[1.2]` to DESIGN.md heading step verbatim: `text-[1.778rem]` + `tracking-[-0.015em]` + `leading-[1.25]`. Section icon size adjusted to `size-5` (20px) for proportion. Eliminates the hand-rolled 1.5rem step the audit P2 flagged.
- **Fix 5 (Sparse bar charts):** SKIPPED — user noted "Out of brief scope, but worth flagging". Per brief-discipline directive, no out-of-brief swap from CountBarChart to a horizontal stat-row composition.
- **Fix 6 (Mobile filter trigger):** Trigger button label now reads "Filters · {rangeLabel}" with chip count badge preserved. RangeLabel sourced from `RANGE_OPTIONS` map.
- **Fix 7 (Loading state):** Added `src/app/admin/reports/loading.tsx` matching brief §6 K7 spec ("AdminSkeleton: filter strip (instant), 4 stat-tile skeletons, then section-by-section: panel headers + chart skeleton with minHeight: 288 placeholder rectangle + 4 row skeletons in each list panel"). Uses Next.js App Router native `loading.tsx` convention so route transitions render the skeleton without restructuring server components.
- **Fix 8 (Mobile bottom-nav clearance):** Added `pb-10 md:pb-0` to the reports `AdminPageScaffold` (and matching skeleton in `loading.tsx`). Admin layout already carries `pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]` on `<main>` (56px clearance) but reports is denser/longer than other pages so the last metric chip pressed against the bottom tab bar. Reports-specific 40px extra at mobile only — `md:pb-0` keeps desktop unchanged since the bottom tab bar is hidden at md+.

**Post-corrective verification:**
- 1440 / 768 / 375 visual recaptured: `reports-corrective-{1440,768,375}-final.png`.
- Mobile trigger label verified: `Filters · Monthly` (44px touch target preserved).
- Console: 0 errors, 0 warnings on reports page (Recharts warnings still 0).
- Horizontal scroll: false at all three viewports.
- `git diff --stat src/app/admin/reports/`: `page.tsx` ~70 lines net change; `loading.tsx` new file.
- No source file outside `src/app/admin/reports/**` modified.
- Brief contracts intact: form action `/admin/reports`, 6 GET param names, 8 CSV export keys, role variants, "How these numbers are calculated" title, denied copy.
