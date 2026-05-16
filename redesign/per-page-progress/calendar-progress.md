# Progress — calendar

Started: 2026-05-15
Recipe: /redesign/per-page-recipes/calendar-recipe.md

## Step log

step-1: COMPLETE — re-prime confirmed (7 files read, PRODUCT.md register: product, brief §6 sentence 2 quoted, Feature Preservation Manifest listed)
step-2: COMPLETE — BROKEN guard run, result: none (calendar 2A-3 already HANDLED)
step-3: COMPLETE — scope written to redesign/per-page-scope/calendar-scope.md, plan "Currently on" updated to 6 of 29, calendar-empty.svg appended to IMAGES-NEEDED.md
step-4: COMPLETE — craft built page (page.tsx full rewrite + CalendarDatePopover.tsx client component co-located; CRAFT_COMPLETE emitted)
step-5: COMPLETE — polish loop emitted PAGE-POLISH-COMPLETE (4 focused improvements: 7-day week strip, keyboard arrow nav, sidebar a11y, removed backdrop-blur)
step-6: COMPLETE — dev server on 3006 (webpack mode — Turbopack rejected node_modules junction; HTTP 308 → redirect, expected)
step-7: COMPLETE — axes applied: distill (Concurrent chip → icon-only; banner remains count-aware); fixed list-marker bug + 3-card concurrent stacking inline
step-7b: COMPLETE — polish loop done (iter-1 audit found no material issues at all 3 viewports; iter-2 skipped)
step-8: COMPLETE — adapt run, breakpoints clean (no horizontal scroll at 375/768; bumped stepper chevrons to 44px WCAG floor)
step-9: COMPLETE — harden run, HARDEN-RECS-calendar.md saved (12 states shipped, 5 deferred to Phase 7 with rationale)
step-10: COMPLETE — clarify run, copy verified (CLARIFY_RESULT: copy already matches brief Copy section)
step-11: COMPLETE — verification clean (TOKEN_DRIFT: 0; BG_WHITE_HITS: 0; CONSOLE_NEW_ERRORS: 0; NETWORK_BASELINE_MATCH: yes; 3-viewport final screenshots saved)
step-12: COMPLETE — audit/critique/smoke clean (audit 14/20, 0 P0 + 2 P1 + 6 P2 + 3 P3 deferred to Phase 7; critique 6.7/10 + REGRESSED verdict deferred to Phase 7 bundled with shared BookingListCard extraction; SMOKE_TEST: all PASS)
step-13: COMPLETE — handoff emitted, awaiting approval

## Corrective dispatch (2026-05-16)

Surgical fixes resolving four DESIGN.md / WCAG / PRODUCT.md contradictions deferred to Phase 7. Scoped to `page.tsx` + `CalendarDatePopover.tsx` + deferrals + this progress file.

- corrective-a: COMPLETE — dashed-border "No visible bookings" row → `<EmptyState compact>` with `data-redesign-needs-photo` placeholder (`src/app/admin/calendar/page.tsx` empty-week-day branch). Also de-dashed AvatarStack "?" placeholder. Verification: `grep border-dashed src/app/admin/calendar/page.tsx` → 0 hits.
- corrective-b: COMPLETE — restored visible text labels on 3 status chips via new `label` prop on `ModifierIcon` (`src/app/admin/calendar/page.tsx`). Verification: `grep -E 'label="(Concurrent|Reschedule requested|Client cancelled)"' page.tsx` → 3 hits, each adjacent to `icon=` prop in ModifierIcon call. Other modifier discs (Unassigned, Paid, Unpaid) remain icon-only by design.
- corrective-c: COMPLETE — tokenized sole `oklch(…)` literal in `src/app/admin/calendar/CalendarDatePopover.tsx:192` → `shadow-[var(--admin-shadow-overlay)]` (resolves to identical OKLCH values per `src/styles/tokens.css:85`). Verification: `grep "oklch(" CalendarDatePopover.tsx` → 0 hits.
- corrective-d: COMPLETE — 44px mobile touch targets. Popover trigger already compliant at `h-11 sm:h-10` (`CalendarDatePopover.tsx:180`). PresetLink bumped from `h-9` → `h-11 min-h-[44px] sm:h-9 sm:min-h-0` (`page.tsx:709`). Verification: read confirms `h-11 min-h-[44px]` ≥ 44px on mobile at both sites.

Diff scope verified: `git diff --stat HEAD` shows only `page.tsx`, `CalendarDatePopover.tsx`, `calendar-deferrals.md` modified. Deferrals file updated with RESOLVED section + 4 strike-throughs.
