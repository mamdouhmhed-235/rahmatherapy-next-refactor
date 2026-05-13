# Shape Brief: `/admin/calendar` redesign

**Date:** 2026-05-12
**Page slug:** `calendar`
**Status:** user-confirmed
**Brief number:** 14 of 29 (Phase 5)

## 1. Feature Summary

Day or week operations agenda over Europe/London business dates, grouped by date with per-date panels of booking cards, an Unassigned sidebar for triage, and a printable layout. The redesign rebuilds it on the Card-Board grammar: warm panels with a true time-rail spine on the day view, an avatar-led week strip on the week view, and a sticky right-rail Unassigned tray that doubles as the print "to dispatch" list.

## 2. Primary User Action

**Find a specific day's bookings, scan who is unassigned, and either open the booking or pivot to the assign flow** without leaving the calendar surface or losing the date context. Secondary action: print the dispatched day for a therapist's run sheet.

## 3. Design Direction

Card-Board over a thin time-rail. Day view places a left gutter of hourly tick labels (Work Sans 500 label step, Soft Slate) against which each `BookingListCard` aligns to its `start_time`. Week view collapses the gutter into a 7-column header strip (Mon–Sun, business date, Cormorant Garamond day numeral) above stacked per-date panels; no horizontal scroll-board. Unassigned tray pinned to the right on `xl:` and above; on `lg` and below it stacks above the day list under an Attention-tinted disclosure.

## 4. Scope

In:
- Replace the four-filter `AdminFilterBar` with a date-aware control rail: day/week segmented toggle, prev / today / next chevrons around a date display, staff combobox, payment select, "Apply" Secondary.
- Day-view time-rail rendering (07:00 → 21:00 default, expanded to bookings' span if outside).
- Week-view 7-day strip + per-date stacked panels (reusing the same `BookingListCard` body so the card scan-pattern matches `/admin/bookings`).
- Unassigned sidebar redesigned with avatar tokens, service city chip, and a Ghost "Assign therapist →" deep-link to `/admin/bookings/[id]?focus=assignment`.
- Empty state via shared `EmptyState` (replacing the ad-hoc `CalendarDays` + muted text block at `page.tsx:105`).
- Print stylesheet honouring DESIGN.md §Admin-Specific Patterns → Print Considerations (hide nav, filter rail, sidebar; expand list; outline pills; `break-inside: avoid` per per-date panel).
- Role variants per §11; Therapist scope already narrows their data, the surface adapts.

Out (unchanged):
- The `getReportData` + `parseReportFilters` server data layer (RECON §5 untouchable). All filtering remains GET-form URL params.
- No new mutations from this page. All assign / cancel actions hand off to the booking detail page.
- No drag-to-reschedule. Booking-engine constraints (gender match, staff availability, travel buffers) make drag-drop a separate, larger surface not justified at this scale.

## 5. Layout Strategy

Page chrome (top to bottom):
1. `AdminPageHeader` — "Calendar" / "Daily and weekly operations agenda — Europe/London." / actions: `PrintButton` + Ghost "Today".
2. Control rail (sticky on scroll, `print:hidden`): segmented Day/Week + date stepper (`‹ Mon 12 May ›` with a calendar popover trigger on the date label) + staff combobox + payment select + Secondary "Apply".
3. Main two-column grid on `xl:` (`1fr 22rem`), single column below; same breakpoint the current page already uses, kept on purpose so existing muscle memory holds.

Left column (the agenda):
- **Day view:** single `AdminPanel` with the formatted business date as H2, then a flex layout: 56px gutter of hourly ticks + flex-1 column of `BookingListCard`s offset vertically by start_time (no absolute positioning; uses `padding-top` per card so reflow stays correct on mobile). Cards never overlap visually; concurrent bookings stack and carry a small "Concurrent" Attention chip so the operator notices the clash explicitly.
- **Week view:** 7 stacked `AdminPanel`s (one per business date), each with the date as title and a count `AdminStatusBadge` (`{n} booking(s)`). Empty days collapse to a one-line muted "No visible bookings" row, not an empty panel; scroll length stays proportional to actual workload.

Right column (Unassigned):
- Sticky `AdminPanel` titled "Unassigned" with a count badge (Attention family).
- Up to 8 visible rows; "See all N →" link to `/admin/bookings?view=claimable` at the bottom.
- Per row: avatar (Hover Moss initialled token) + contact name (Work Sans 500) + service city / postcode (Soft Slate) + date+time (Work Sans 500 label step) + Ghost "Assign →".
- Empty: inline encouraging line "Every visit has a therapist." (no illustration in the sidebar; illustrations belong to the main column's `EmptyState`).

## 6. Key States

- **Default — week view, today centred.**
- **Day view, mid-week date.** Time-rail visible; cards offset by `start_time`.
- **Loading.** `AdminSkeleton` bars approximating panel rows (per-date panel header + 3 row skeletons) + a 4-row sidebar skeleton.
- **Empty day / empty week.** `EmptyState` in main column: calendar-with-check SVG, "All quiet — no bookings in this range.", Secondary "Create a booking" → `/admin/bookings/new` (only for roles with `create_bookings`; otherwise omit the CTA entirely, no greyed-out button).
- **All assigned (sidebar).** "Every visit has a therapist." quiet line; no illustration.
- **Concurrent bookings in day view.** Cards stacked with a leading Attention-family "Concurrent" chip on each affected card and a single banner above the day panel: "2 bookings overlap at 14:00." Banner is inline `role="status" aria-live="polite"`.
- **Print.** Per DESIGN.md print pattern: nav, filter rail, sidebar hidden; outline pills; `break-inside: avoid` per per-date panel.

## 7. Interaction Model

- View toggle and date stepper write directly to URL (`view`, `date`) on click, submitted via the surrounding GET form so the URL stays deep-linkable (RECON §6.5).
- Date stepper buttons preserve `view` and other filters; "Today" resets `date` only.
- Date label opens an inline popover with React DayPicker (the booking-engine's existing date primitive; same import path as `/admin/bookings/new`) for a calendar jump.
- Sidebar "Assign →" goes to `/admin/bookings/[id]?focus=assignment`. The detail page reads `focus` and auto-scrolls / opens the assignment panel.
- Main agenda cards open `/admin/bookings/[id]`; full row is the link target so the entire card has a single accessible name (matches `BookingListCard` semantics from Brief 01).
- Print button triggers `window.print()` (existing `PrintButton.tsx`; preserved).
- Keyboard: arrow-left / arrow-right on the date stepper steps a day (day view) or a week (week view) when focus is inside the stepper region. Documented in the page's screen-reader-only help text.

## 8. Content Requirements

- Page title: "Calendar".
- Page description: "Daily and weekly operations agenda. Europe/London business dates."
- Sidebar title: "Unassigned" + numeric badge.
- Sidebar empty: "Every visit has a therapist."
- Main empty: "All quiet — no bookings in this range." with Secondary "Create a booking" (role-gated).
- Concurrent banner: "{n} bookings overlap at {time}." (count-aware; singular: "Two bookings overlap at {time}.").
- Print sheet header (`@media print` only): "Rahma Therapy — Operations sheet — {formatted date or range}".
- No raw permission names anywhere on the surface (RECON §6.4 / DESIGN.md Don't list).

## 9. Recommended References

- `BookingListCard` per Brief 01 (`00-shared-components`); reuse verbatim, do not re-skin a calendar-specific card.
- DESIGN.md §Admin-Specific Patterns → Print Considerations; apply line-by-line.
- DESIGN.md §5 → AdminPanel, AdminStat (count badge), AdminStatusBadge, EmptyState.
- BASELINE-CRITIQUE: no calendar-specific carry-forwards listed, but the page currently uses raw `var(--rahma-*)` tokens (line 62/64/etc.) and bare `bg-white` on the inner card (line 135). Both are token escapes; replace with Tailwind classes that resolve to DESIGN.md tokens (`bg-surface-card`, `border-default`, etc.) during Phase 6.
- Brief 04 (`bookings`); share the View-toggle vocabulary so a coordinator moving between `/admin/bookings?view=today` and `/admin/calendar?view=day&date=today` finds matching chrome.

## 10. Open Questions

1. **Week-view density on Therapist.** A therapist with three visits in a week sees three populated panels and four "No visible bookings" rows; informative for an Owner, possibly hollow for a Therapist. Proposal: on Therapist role, empty days collapse to a single grouped line ("Mon, Wed, Fri — no visits"); on Owner / Admin / Coordinator they stay one-line-per-empty-day. Flag for Phase 6 confirmation.
2. **Calendar popover vs. native date input.** Current page uses `<input type="date">` which on iOS Safari renders the system date wheel; usable but visually inconsistent with the rest of the redesign. React DayPicker matches the booking wizard. Cost: ~3 KB JS on a server-rendered surface. Recommendation: DayPicker, since the booking wizard ships it anyway and tree-shaking already includes it.

## 11. Role variants

### Owner

Full surface. Sees every booking across all therapists; staff combobox includes "All visible staff" + every active therapist. Payment filter unrestricted. PrintButton visible. "Create a booking" CTA visible in empty state. Unassigned sidebar shows the full clinic-wide unassigned queue.

### Admin (Practice Manager)

Identical to Owner. PM has `view_bookings_all` and `create_bookings`, same as Owner for this surface. The only invisible delta is that any deep-link from the calendar into a booking that requires role-template authority (which Admin lacks) will resolve correctly on the booking detail; not this page's concern.

### Booking Coordinator

Identical chrome to Owner / Admin. Coordinator has `view_bookings_all`, `create_bookings`, `assign_staff`. Staff combobox is full. Payment filter is **visible but neutral**; coordinators have no `view_revenue` permission, so the payment chip on each card hides (the existing card composition supports omitting that slot). Unassigned sidebar emphasis: this is the coordinator's primary entry point to the assign flow; "Assign →" Ghost is the dominant secondary action. Empty state CTA "Create a booking" visible.

### Therapist

Same chrome, narrowed data. `getReportData` already returns only their own assigned bookings (existing untouchable backend per RECON §5). Visible:

- Day / week toggle, date stepper, payment filter, payment chip on cards.
- Staff combobox is **hidden** (single-entry list = self; redundant). Replace with a small Soft Slate label reading "Your schedule".
- PrintButton visible (therapists print their own day for the road).
- Unassigned sidebar replaced by a "Claimable today" panel that pulls the same data source the dashboard's claimable strip uses (Brief 08). Up to 5 rows; Ghost "Browse all claimable →" links to `/admin/bookings?view=claimable`.
- Empty state copy adapts: "No visits in this range." No "Create a booking" CTA (Therapists lack `create_bookings`).
- Concurrent banner: same treatment, scoped to overlapping visits the therapist themself owns.

### Denied state

Roles below the `view_bookings_assigned` floor (Inactive, or any future role explicitly stripped of booking visibility) hit `AdminAccessDenied`:

- Title: "Calendar access limited"
- Body: "You need booking visibility to view the operations calendar. Ask the practice owner to enable it."
- No raw `view_bookings_all or view_bookings_assigned` permission identifier on the screen (current `page.tsx:176` leaks it; fix in Phase 6).
- Single Secondary "Back to dashboard" → `/admin/dashboard`.

---

## Recipe Context

- **RECON §2 inventory row:** Calendar — `src/app/admin/calendar/page.tsx` — `/admin/calendar?view=day|week&date=&staffId=&paymentStatus=` — Day/week agenda (Europe/London), printable, with unassigned sidebar.
- **Access gate (RECON §3):** `getAdminPageAccess(profile, "calendar")` — passes when `bookingScope ≠ none`. All four active roles (Owner, Admin/PM, Coordinator, Therapist) reach this page; Inactive blocked at middleware.
- **Untouchable backend (RECON §5):** `getReportData`, `parseReportFilters`, `getAdminPageAccess`, `addBusinessDays` / `formatBusinessDate` / `getBusinessDate` in `lib/time/london`. The redesign is presentation-only against these contracts.
- **Untouchable URL params (RECON §6.5):** `view`, `date`, `staffId`, `paymentStatus` GET param names preserved verbatim so deep links don't break.
- **Preserved IDs / form names (RECON §6.4):** No named form fields on this page beyond the GET form's `name` attributes above; `id="admin-main"` skip-link target preserved at layout level.
- **BASELINE-CRITIQUE carry-forwards landing on this page:** none deterministic (no `border-l-4`, no `bg-black`). Soft carry-forwards (Phase 6 cleanup): raw `var(--rahma-*)` token escapes throughout, bare `bg-white` on the inner CalendarBooking card, raw permission identifier on the denied screen, ad-hoc empty state instead of shared `EmptyState`.
- **IMAGES-NEEDED additions:** `calendar-empty.svg` (calendar-with-check illustration, ~80–120px) for the `EmptyState`. Append row in Phase 6.

## Implementation Notes

- Component layout and state coverage live in this brief's §5 (Layout Strategy) and §6 (Key States); Phase 6 implements directly from those.
- **Verification steps (Phase 6 / Phase 7):**
  - Pixel parity to Brief 01 `BookingListCard` (no calendar-specific card variant).
  - Print: invoke `window.print()` in Chrome and Safari, confirm nav / filter rail / sidebar absent, per-date panels do not split mid-page (`break-inside: avoid`).
  - URL contract: every control mutation produces a URL change with the existing param names; deep-linking `/admin/calendar?view=day&date=2026-05-12&staffId=…&paymentStatus=paid` lands on the correct view with all filters applied.
  - Role pass: visit as Owner / Admin / Coordinator / Therapist; confirm staff combobox visibility, payment chip visibility on cards, sidebar variant, empty-state CTA visibility match §11.
  - A11y pass: AdminAccessDenied no longer renders the raw permission string; concurrent banner reaches screen readers via `role="status"`; date stepper buttons announce target date in their accessible name; week-view 7-day strip is keyboard-traversable.
  - Lighthouse / axe: no new violations vs. the Phase 2 baseline.

---

## Copy

### Form labels

- View toggle (segmented control): `Day` / `Week`. Group label (sr-only): `Calendar view`.
- Date stepper: `Previous` / `Next` (icon buttons, accessible names below). Centre date button: `Pick a date`.
- Staff combobox: `Therapist` — default option `All visible staff`. Therapist variant replaces this with the read-only label `Your schedule`.
- Payment select: `Payment` — default option `Any payment`. Options match RECON enum.
- Filter submit: `Apply` (Secondary).

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Print page | `Print` | Secondary |
| Jump to today | `Today` | Ghost |
| Date stepper prev | (icon `chevron-left`) | Ghost — tooltip `Previous {day|week}` |
| Date stepper next | (icon `chevron-right`) | Ghost — tooltip `Next {day|week}` |
| Day picker trigger | `Pick a date` (with current label) | Ghost |
| Filter apply | `Apply` | Secondary |
| Sidebar row CTA | `Assign →` | Ghost |
| Sidebar overflow | `See all {N} →` | Ghost |
| Main empty CTA (admin) | `Create a booking` | Secondary |

### Error messages

- Date in URL malformed: `That date doesn't look right. Showing today instead.` (inline, Pending-family banner above the agenda; URL silently coerced)
- Staff filter UUID not found: `That therapist isn't in your team. Showing everyone.` (inline, Pending-family banner)
- Load failure: `Couldn't load the calendar.` (Cancelled banner replacing the agenda) with `Try again` Ghost.
- Print attempted with empty range: `There's nothing to print on {date}.` (toast, Pending family, 6s) — print still proceeds with the empty-state page if the user confirms.
- Cross-timezone hint (informational): `Times shown in Europe/London.`

### Empty-state text

| Context | Heading | Body | CTA |
|---|---|---|---|
| Empty day (admin/coordinator) | `All quiet` | `No bookings in this range. Quiet days are healthy days.` | `Create a booking` |
| Empty week (admin/coordinator) | `All quiet` | `No bookings this week.` | `Create a booking` |
| Empty day (therapist) | `Nothing booked` | `No visits in this range.` | — |
| Empty week (therapist) | `Nothing booked this week` | `No visits in this range.` | — |
| Empty sidebar — Unassigned | (no heading) | `Every visit has a therapist.` (inline line, not an EmptyState) | — |
| Empty sidebar — Claimable today (therapist) | (no heading) | `No claimable visits match your profile right now.` | `Browse all claimable →` |
| Denied | `Calendar access limited` | `You need booking visibility to view the operations calendar. Ask the practice owner to enable it.` | `Back to dashboard` |

### Tooltip text

- View toggle buttons: `Switch to day view` / `Switch to week view`.
- Date stepper: `Previous {day|week}` / `Next {day|week}` (variant adjusts to current view).
- "Today" Ghost: `Jump to today`.
- Day picker trigger: native `title` shows ISO date.
- Staff combobox option `All visible staff`: `Everyone you can see on the calendar`.
- Concurrent chip on a card: `This booking overlaps with another at {time}`.
- Sidebar row avatar: `{Client name}` (native `title`).
- "Assign →" Ghost on sidebar row: `Assign a therapist to this booking`.
- Per-card body (link target): the row's accessible name is `{Client name}, {service}, {date} at {time}, {status}`.
- Print button: `Print this view as a run sheet`.

### Confirmation dialog text

This page mutates nothing. No `ConfirmActionModal` instances. Concurrent-overlap signal renders as an inline `role="status"` banner, not a confirmation:

- `{N} bookings overlap at {time}.` (count-aware; singular: `Two bookings overlap at {time}.`)

**Toasts**
- Date jumped (informational): `Showing {weekday}, {day month}.` (4s) — fires only when the operator picks a date via the popover.
- Filter applied (informational): no toast — agenda reload is the feedback.
