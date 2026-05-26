# C-A.1 #09 — `/admin/calendar` audit

**Surface:** `/admin/calendar` (4 views — day / week / month / range)
**Audit type:** C-A.1 per-page discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `21474e9`.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Source surveyed:** `page.tsx` (~1942 LOC), `CalendarDatePopover.tsx`, `PrintButton.tsx`, `error.tsx`. Explore subagent.
**Roles swept:** Owner @ 1280 day + 1280 week + 375. Therapist narrowing confirmed via code at `page.tsx:233`.
**Screenshots:** 3 PNGs.

---

## 1 — Bugs found

### B-43 — Date-range query unbounded at reporting.ts:289-292, but 31-day user-soft-cap mitigates
**Severity:** medium (C-09 hazard)
**Source:** subagent — `reporting.ts:289-292` uses `.gte("booking_date", filters.from).lte("booking_date", filters.to)` with no `.limit()`. `page.tsx:60` defines `RANGE_SOFT_CAP_DAYS = 31` that limits the user-pickable range. So worst-case in current UX is 31 days × ~average 5 bookings/day = ~155 rows.
**Status:** acceptable today; flag for C-09 if range cap is ever loosened.

### B-44 — No drag-to-reschedule
**Severity:** very low (feature gap, not bug)
**Source:** subagent `page.tsx:1376` — cards are static `<Link>`s. Industry-standard CRMs offer drag-to-reschedule but it's a future scope item.
**Decision:** flag for C-12+ if user prioritises.

### B-45 — Motion-reduce missing on cubic-bezier card-shadow transition + 15+ transition-color classes
**Severity:** low (a11y consistency)
**Source:** subagent `page.tsx:1381` cubic-bezier shadow ease; 15+ transition-color throughout. Same anti-pattern.

### B-46 — Month view is not `role="grid"`; weekday headers not `<th scope="col">`
**Severity:** medium (a11y — screen-reader navigation through 42-cell month is poor)
**Source:** subagent `page.tsx:918, 907-914`. No grid role; cells read linearly. No arrow-key navigation within the grid.
**Implication for C-11 / dark-mode + design-system pass:** consider folding ARIA grid into the broader a11y improvement scope.

### B-47 — Icon-only modifier badges (e.g. concurrent overlap) rely on title attr — no sr-only label
**Severity:** low (a11y)
**Source:** subagent `page.tsx:1441-1447, 1533-1541`. Sighted users see the icon; SR users get tooltip on hover only.

---

## 2 — Visual issues

### V-26 — Cancelled + no_show bookings are EXCLUDED from calendar grid
**Source:** subagent `page.tsx:263-265` filters them out. Inline comment: "cancelled and no_show bookings are no longer on the schedule".
**Cross-reference to C-05:** the calendar hides them at the read layer (intended — they shouldn't be on the schedule). Booking list shows them via `view=cancelled`. So the inconsistency between surfaces is: calendar correctly excludes; list correctly shows; row-actions on detail page over-permit (C-05 bug).
**No new bug here.** Behaviour is correct on this surface.

### V-27 — Calendar is read-only (no mutations on this surface)
**Source:** subagent — booking cards are `<Link>` to `/admin/bookings/[id]` for any mutation. All status / assignment / payment changes happen on the detail page.
**Status:** clean separation of concerns. ✅ Accept.

---

## 3 — Empty / edge states

### E-23 — Therapist empty state copy: "Nothing booked this week"
**Source:** subagent `page.tsx:1826-1833`. Admin sees "All quiet…"; Therapist sees personalised copy. ✅ Good.

---

## 4 — Cross-role inconsistencies

### CR-18 — Therapist sees a narrowed calendar: no combobox, no payment data, claimable-today panel (5-cap) vs admin unassigned panel (8-cap)
**Source:** subagent `page.tsx:233, 491-516, 649-650, 694-701`. ✅ Intended RBAC narrowing.

---

## 5 — Cross-viewport issues

### CV-20 — Week strip horizontally scrolls below 42rem viewport
**Source:** subagent `page.tsx:1030` — `overflow-x-auto` with `min-w-[42rem]`. Standard pattern.

### CV-21 — Month cells shrink at mobile (`min-h-[3.5rem]` → `sm:min-h-[6rem]`) and hide booking pills
**Source:** subagent `page.tsx:935, 972`. Mobile loses pill detail — only count remains. Trade-off acceptable for cell density.

### CV-22 — Sidebar collapses to `<details>` disclosure below xl
**Source:** subagent `page.tsx:1590, 1636`. Good adaptive pattern.

---

## 6 — Console / network issues

### CN-21 — 0 errors / 0 warnings.
### CN-22 — Same Sentry + font-preload baseline.

---

## 7 — Pre-existing items the audit accepts

### PE-29 — Print button uses `window.print()` with print-only CSS
**Source:** subagent `PrintButton.tsx:7-18` + `page.tsx:740-745`. Adds "Operations sheet" title + range label on print. ✅ Sufficient for current scope.

### PE-30 — Date popover keyboard navigation present (arrows, focus trap, restore-on-close)
**Source:** subagent `CalendarDatePopover.tsx:96-114, 185, 329-346`. ✅ Best keyboard UX on any surface audited.

### PE-31 — `RANGE_SOFT_CAP_DAYS = 31`, `CARD_GAP = 8`, `MIN_CARD_HEIGHT = 140`, `WEEKDAYS_MON_FIRST` — good constant discipline
**Source:** subagent. ✅ Accept.

---

## 8 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | B-43 — reporting.ts:289-292 unbounded | Add .limit() defense even with soft-cap | C-09 |
| 2 | B-44 — no drag-to-reschedule | Future feature | C-12+ |
| 3 | B-45 — motion-reduce missing | Add `motion-safe:` modifiers | C-11 |
| 4 | B-46 — Month grid lacks ARIA grid + arrow-key nav | A11y polish | C-11 or C-12+ |
| 5 | B-47 — icon-only modifier badges | Add sr-only labels | C-12+ |
| 6 | Hardcoded `["cancelled","no_show"]` arrays repeated 5+ times | Extract constant | C-12+ |

---

## 9 — Hand-off

**State:** 3 screenshots. 0 code changes.
**Next surface:** #10 `/admin/staff` (list).

*End of calendar audit.*
