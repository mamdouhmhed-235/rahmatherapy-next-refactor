# Deferrals — calendar (Phase 6 → Phase 7)

## RESOLVED in corrective dispatch (2026-05-16)

Surgical fixes landed against DESIGN.md / WCAG / PRODUCT.md contradictions. Phase 7 gauntlet no longer needs to re-scan these.

- **Dashed-border "No visible bookings" row → EmptyState** — `src/app/admin/calendar/page.tsx` empty-week-day branch (was the dashed div at the per-date map; now renders `<EmptyState icon={CalendarCheck} title="All quiet — no bookings in this range." message="Quiet days are healthy days." compact />` wrapped in `data-redesign-needs-photo` placeholder). `AvatarStack` "?" placeholder also de-dashed (solid border).
- **Restored visible text on 3 status chips** — `Concurrent`, `Reschedule requested`, `Client cancelled` now render as labelled pills (icon + NBSP + text) via new `label` prop on `ModifierIcon` (`src/app/admin/calendar/page.tsx` — chip call sites + `ModifierIcon` definition). Other modifier discs (Unassigned, Paid, Unpaid) remain icon-only per existing design.
- **Tokenized `oklch(…)` in CalendarDatePopover.tsx** — sole match was the overlay shadow tuple; replaced with `shadow-[var(--admin-shadow-overlay)]` (`src/app/admin/calendar/CalendarDatePopover.tsx` popover dialog className). Resolves to the same OKLCH values per `src/styles/tokens.css:85`.
- **Touch targets ≥ 44px on mobile** — popover trigger already `h-11 sm:h-10` (44px mobile, compliant). `PresetLink` (Today / This week / This month segmented control, replaced the prior Today Ghost link) bumped from `h-9` → `h-11 min-h-[44px] sm:h-9 sm:min-h-0` (`src/app/admin/calendar/page.tsx` PresetLink definition).

## Shared `BookingListCard` not yet extracted to `00-shared-components`
- **Source:** calendar-brief.md §9 + recipe Hard rule 3 ("REUSE verbatim, do not re-skin a calendar-specific card")
- **Verbatim:** Brief §9 — "Reuse `BookingListCard` per Brief 01 (`00-shared-components`); reuse verbatim, do not re-skin a calendar-specific card."
- **Defer to:** Phase 7 (after Brief 01 `00-shared-components` session — currently marked incomplete per RECIPE-PROGRESS.md)
- **Why deferred:** `BookingListCard` currently lives as a local function inside `src/app/admin/bookings/page.tsx` (lines 737–919) and depends on the full `BookingRecord` shape with `booking_assignments(staff_profiles)`, `booking_participants`, `booking_items` joined relations. The calendar reads `ReportBooking` from `getReportData` (RECON §5 untouchable) which does not carry those joins. Phase 6 cannot extract the shared component because (a) Brief 01 is incomplete and owns that extraction, and (b) modifying `bookings/page.tsx` to extract it is outside the calendar recipe's "Files to edit" scope.
- **Provisional Phase 6 answer used to continue this session:** A local `CalendarBookingRow` component is rendered on the calendar page that mirrors the bookings-page `BookingListCard`'s visual chrome verbatim (same className, same composition, same status-badge placement, same hover treatment) but is parameterised on the `ReportBooking` shape and uses `formatLabel`/`formatTime`/`formatDate` from the same `bookings/format.ts` helper module so the two card surfaces stay visually identical. Phase 7 should extract the shared component during the `00-shared-components` follow-up and replace this local row.

## Critique AI-slop verdict: REGRESSED (Phase 7 fixes batch)
- **Source:** Step 12b critique subagent
- **Verbatim:** "REGRESSED. The chrome (control rail, week strip with Cormorant numerals, sidebar avatars, validation banners) is on-brand and operator-grade, but the main column collapses into the identical-card-grid antipattern PRODUCT.md names (3+ near-identical pill-cluster cards, no avatars, dashed-border empty rows banned by DESIGN.md), pulling the surface back toward 'generic admin list' territory."
- **Defer to:** Phase 7
- **Why deferred:** Bundled with the shared `BookingListCard` extraction deferral above — the surface-quality fixes (avatar in main row, demoted pill cluster, gender-match + group-booking chips, replace dashed borders with hairline rule) are most cleanly resolved together with the `00-shared-components` re-work that owns the shared card primitive. Re-running `bolder/distill` axes in-place would only mask the structural cause.
- **Provisional Phase 6 answer used to continue this session:** Ship the current implementation (chrome is sound, copy is verbatim, states are covered, accessibility carry-forwards landed) and tag the surface-quality refinements for Phase 7's gauntlet pass.

## P1 audit findings (Phase 7 gauntlet re-scan)
- **Source:** Step 12a audit subagent (P1 section)
- **Verbatim:**
  1. ~~Per-card "Concurrent" chip lacks visible text label — `src/app/admin/calendar/page.tsx:872-882` (concurrent), `:893-900` (reschedule requested), `:901-909` (client cancelled).~~ **RESOLVED 2026-05-16 corrective dispatch — visible labels restored via `ModifierIcon` `label` prop.**
  2. Card hover/click asymmetry — `src/app/admin/calendar/page.tsx:849-924` (article hovers entirely; only the inner `<Link>` at `:852-869` is clickable; badges at `:871-923` are dead zones).
- **Defer to:** Phase 7
- **Why deferred:** Both findings are interlinked with the shared `BookingListCard` extraction (Phase 7 owns extracting the card primitive that already implements the whole-row anchor + named chip pattern correctly in `bookings/page.tsx`). Fixing in-place on the calendar copy would re-introduce divergence from the to-be-shared component.

## P2 audit findings (Phase 7 polish batch)
- **Source:** Step 12a audit subagent (P2 section)
- **Verbatim:** `aria-pressed` on `<Link>` (line 405) → `aria-current="page"`; ~~date popover + Today link 40px touch targets (`CalendarDatePopover.tsx:82`, `page.tsx:200`) → 44px~~ **RESOLVED 2026-05-16 corrective dispatch — popover already `h-11 sm:h-10`; `PresetLink` now `h-11 min-h-[44px] sm:h-9 sm:min-h-0`**; ~~hardcoded `oklch(...)` literals → status-family CSS variables~~ **PARTIALLY RESOLVED 2026-05-16 corrective dispatch — `CalendarDatePopover.tsx` tokenized (`shadow-[var(--admin-shadow-overlay)]`); `page.tsx` literals remain for the global token-extraction sweep**; ~~dashed-border "No visible bookings" row (line 474) → hairline rule~~ **RESOLVED 2026-05-16 corrective dispatch — replaced with EmptyState**; day-view desktop absolute positioning (lines 731-757) → brief §5 specifies padding-top approach; `title=` tooltips on icon-only chips → proper tooltip primitive.
- **Defer to:** Phase 7
- **Why deferred:** Phase 6 surface lands the brief's named deliverables; these are next-cycle polish items that benefit from the gauntlet pass's holistic review (the `oklch()` literal pattern is widespread across briefs already shipped, so a single global token-extraction sweep is cleaner than per-page edits).

