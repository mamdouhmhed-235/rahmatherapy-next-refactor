# Brief: bookings

## 1. Feature Summary

The bookings list is the highest-traffic operational surface in Rahma Admin — the page where coordinators, admins, and the owner spend the most daily time. It presents all bookings across a tabbed triage structure: four primary view tabs covering the daily workflow, a "More views" overflow for the remaining tabs, a `SavedViewTabs` row for named custom views, and a collapsible `AdminFilterBar`. Each `BookingListCard` row carries quick-action buttons visible at rest, so the most common actions (Confirm, Assign, Send reminder, Claim) never require drilling into the detail page. Permission scope shapes which tabs, filters, and actions each role sees.

## 2. Primary User Action

**Scan the list for bookings that need action, act on them directly from the row, and clear the queue before the day's first appointment.**

## 3. Design Direction

**Colour strategy:** Full palette. Every booking status family appears on this page — Confirmed, Pending, Cancelled, Completed, Unassigned/Attention, Restricted. Status badges carry the colour; the warm ivory canvas keeps them legible without competing.

**Theme scene sentence:** *"A Booking Coordinator on her phone at 9:10am, standing at the kitchen counter, checking which bookings still need confirmation before the first therapist leaves at 10."* The scene forces light mode (already locked), mobile-first triage, and a list that communicates urgency hierarchy without requiring a zoom-in.

**Anchor references:**
- **Linear's issue list** — view-tab navigation, consistent row density, quick actions visible at rest, keyboard-navigable filter bar
- **Notion's database view** — "More views" overflow, saved named views as first-class navigation, tabs as workspaces
- **Airtable's grid toolbar** — the filter/group strip as a compact control bar that collapses gracefully on mobile without losing power

## 4. Scope

Production-ready. Includes tab consolidation (4 primary + "More views" overflow), `SavedViewTabs` wire-up, `AdminFilterBar` mobile collapse to a bottom sheet, `BookingListCard` quick-action rows, Google Maps deep-link per row. Phase 6 implements.

## 5. Layout Strategy

**Above the list (top to bottom):**

1. `AdminPageHeader` — H1 "Bookings", right-aligned Primary "New booking" button (→ `/admin/bookings/new`).
2. **Primary view tab strip** — 4 tabs (Needs Attention · Today · Upcoming · Claimable) as `action-primary` fill pills when active, transparent + Practice Charcoal when inactive, with `aria-current="page"` on the active tab. A "More" Ghost button (trailing `chevron-down`, 16px) sits at the right end and opens a dropdown of the remaining view tabs. On mobile: horizontal momentum-scroll strip; "More" stays anchored at the right.
3. **`SavedViewTabs` row** — secondary pill row below the primary tabs. Each saved view is a smaller pill (Work Sans 500, label step, `surface-card` background, `border-subtle` border when inactive; `surface-selected` tint when active). "Save this view" Ghost button at the right end. Hidden entirely when the user has zero saved views.
4. **`AdminFilterBar`** — horizontal grid of inputs/selects (desktop). On mobile: collapses to a "Refine" Ghost button (Lucide `sliders-horizontal`) with an active-filter-count badge. Tapping "Refine" opens an `AdminSheet` from the bottom with the full filter form.
5. **Active filter chips** — below the filter bar, one dismissible chip per active filter in Restricted family colours. "Clear all" Ghost link at the end of the row.

**The list:**
- `BookingListCard` rows at comfortable density (44px minimum, expanding to card height).
- On date-ordered views (Today, Upcoming): sticky date group headings (Urbanist 600, title step, Chronicle, `surface-page` background).
- Each row: full `BookingListCard` spec from DESIGN.md §5 + trailing quick-action strip (primary Ghost action + `more-horizontal` trailing menu + `map-pin` Ghost icon for Google Maps).

## 6. Key States

| State | What the user sees |
|---|---|
| Default (Needs Attention, bookings present) | Active tab, filter bar, list of `BookingListCard` rows with status badges and quick actions |
| REQUEST booking (from booking-new) | `status: "pending"` + `assignment_status: "unassigned"` — renders with **Attention-family** status badge (orange, `alert-circle` icon, label "Pending") + "Unassigned" Attention-family assignment chip. Appears in Needs Attention tab and Claimable tab. Coordinator's primary action: Confirm + trigger assignment. |
| Today tab, empty | `EmptyState`: "All caught up" / "Nothing scheduled for today. Quiet days are healthy days." |
| Needs Attention, empty | `EmptyState`: "All caught up" / "No bookings need your attention right now." |
| Claimable, empty | `EmptyState`: "Nothing to claim" / "No unassigned bookings match your profile right now." |
| Filtered result, empty | `EmptyState`: "No bookings match" / "Try adjusting or clearing your filters." Ghost "Clear filters" CTA |
| Filter bar open (mobile sheet) | `AdminSheet` from bottom: full filter form, "Apply filters" Secondary + "Clear" Ghost |
| "More views" open | Dropdown below overflow button, listing remaining view tabs; keyboard-navigable, closes on selection or Escape |
| Saved view active | Saved view pill highlighted (`surface-selected` tint); filter bar pre-populated with saved params |
| "Save this view" open | Inline name input in `SavedViewTabs` row; "Save" Primary + "Cancel" Ghost; new pill appears on save |
| Loading (tab switch or filter apply) | `AdminSkeleton` rows approximating `BookingListCard` height |
| Quick action in flight | That row's action button: 16px spinner, `aria-busy="true"`; other rows unaffected |
| Quick action success | Sonner toast (Confirmed family, 4s); row status badge updates in place |
| Quick action error | Error Sonner toast (no auto-dismiss, Ghost "Retry") |
| Permission denied | `AdminAccessDenied` component |

## 7. Interaction Model

**View tabs:** Clicking updates `?view=` param, re-fetches the list, updates `aria-current="page"`. "More views" opens an `AdminActionMenu`-style dropdown — keyboard navigable with `↑`/`↓`, closes on selection or Escape.

**Saved views:** "Save this view" captures the current `?view=` and all active filter params as a named view. Inline name input, no modal. Saved pills are deletable via a trailing Ghost `x` (12px) with inline confirmation: "Remove '{name}'?" / "Remove" (Destructive text colour) + "Keep" — no modal.

**Filter bar (desktop):** GET form, submits on "Apply filters" Secondary button. URL stays deep-linkable. Each active filter chip `x` clears that param and re-submits.

**Filter bar (mobile):** "Refine" badge shows active filter count. `AdminSheet` from bottom. "Apply filters" closes and submits. Closing without applying discards uncommitted changes.

**Quick actions per row:** Primary action Ghost button visible at rest — Confirm / Assign / Send reminder / Claim based on booking state. Trailing `more-horizontal` opens `AdminActionMenu`. "Cancel booking" triggers `ConfirmActionModal`. Google Maps `map-pin` always visible at rest, opens new tab.

**Quick actions (mobile):** The two highest-priority actions for the active view appear in a contextual `AdminMobileActionBar` when a row is tapped. The `more-horizontal` menu handles the rest.

## 8. Content Requirements

**Page H1:** "Bookings"

**Primary tabs (4):** Needs Attention · Today · Upcoming · Claimable

**"More views" overflow:** remaining view tab labels resolved from existing `?view=` param values in Phase 6.

**SavedViewTabs microcopy:** "Save this view" / placeholder "Name this view…" / "Save" / "Cancel" / delete tooltip "Remove this view" / inline confirmation "Remove '{name}'?" / "Remove" / "Keep"

**Filter labels (matching RECON.md `name` attributes):** Search / Status / Assignment status / Payment status / Required gender / Service / Location / Assigned staff (admins only) / From / To

**Active filter chip format:** `{field}: {value}` (e.g. "Status: Confirmed", "Location: Luton")

**Empty state copy:**

| View | Heading | Body |
|---|---|---|
| Needs Attention | All caught up | No bookings need your attention right now. |
| Today | All caught up | Nothing scheduled for today. Quiet days are healthy days. |
| Upcoming | Nothing upcoming | No bookings scheduled beyond today. |
| Claimable | Nothing to claim | No unassigned bookings match your profile right now. |
| Filtered | No bookings match | Try adjusting or clearing your filters. |

**Quick action labels:** Confirm · Assign · Send reminder · Claim · View on Maps

## 9. Recommended References

- `reference/interaction-design.md` — view-tab keyboard navigation, `AdminActionMenu` dropdown, `SavedViewTabs` inline save/delete flow, `ConfirmActionModal` for Cancel
- `reference/spatial-design.md` — tab strip + saved views row stacking, `AdminFilterBar` mobile collapse, `BookingListCard` row layout, sticky date group headings
- `reference/motion-design.md` — `AdminSheet` bottom slide-in (240ms ease-gentle), dropdown open/close (160ms ease-gentle)

## 10. Open Questions

1. **`SavedViewTabs` storage.** URL-bound (v1: shareable, audit-friendly) or per-user `saved_views` Supabase table? Recommendation: URL-bound for v1; per-user persistence in a later phase.
2. **`assigned_staff` filter scope.** RECON §2 marks it "admins only." Does that exclude Booking Coordinators? Confirm with RBAC matrix before Phase 6.
3. **Claimable scope for Therapists.** Confirm the server filters claimable bookings to the therapist's gender and service profile only, not all unassigned bookings.
4. **Optimistic row updates.** Recommendation: optimistic updates with TanStack Query rollback on error.
5. **Date group headings.** Group by date on Upcoming (yes); suppress on Today (all same date, redundant). Confirm this matches current server grouping logic.

---

## Role variants

### Owner

**Visible:** All 4 primary tabs + "More views" overflow (all 10 views). `SavedViewTabs` row with full save/delete capability. Full `AdminFilterBar` including `assigned_staff` filter. All quick actions: Confirm, Assign, Send reminder, Cancel (via `ConfirmActionModal`), View on Maps. "New booking" Primary button.

**Hidden:** Nothing.

**Role-specific notes:** Default filter on load: `view=needs-attention`. Owner uses `assigned_staff` to drill into a specific therapist's queue.

---

### Admin (Practice Manager)

**Visible:** Identical to Owner — all tabs, full filter bar including `assigned_staff`, all quick actions, `SavedViewTabs`, "New booking" button.

**Hidden:** Nothing.

**Role-specific notes:** No UI differences from Owner on this page. Admin/PM holds `manage_bookings_all` fully.

---

### Booking Coordinator

**Visible:** All 4 primary tabs + "More views" overflow. `SavedViewTabs`. Full `AdminFilterBar` — `assigned_staff` filter present if RBAC confirms scope (Open Question 2); absent otherwise. All quick actions. "New booking" button.

**Hidden:** `assigned_staff` filter if excluded by RBAC (to confirm).

**Role-specific notes:** This is the Coordinator's primary triage surface. Default view: `view=needs-attention`. Converting the queue from pending to confirmed is their core daily loop.

---

### Therapist

**Visible:** Three view tabs only — Today, Upcoming, Claimable. Simplified `AdminFilterBar`: search, date range, status only. Quick actions limited to Claim (on claimable rows) and View on Maps. `SavedViewTabs` hidden.

**Hidden:** Needs Attention tab. All other view tabs. `assigned_staff`, `payment_status`, `location`, and `service` filters. Payment status badge on `BookingListCard` rows. Assign, Confirm, Cancel, Send reminder quick actions. "New booking" button.

**Role-specific notes:** Default view: `view=claimable` when zero assigned bookings today; otherwise `view=today`. `BookingListCard` shows a reduced data set — no payment information, no out-of-scope client contact details.

---

### Denied state

Rendered for: Inactive accounts and any custom role with neither `manage_bookings_all` nor `manage_bookings_assigned`.

**What renders:** `AdminAccessDenied` — illustrated `EmptyState`, heading "You don't have access to this section.", body "Contact the owner if you think this is a mistake.", Secondary button "Back to dashboard" → `/admin/dashboard`. No tabs, no filter bar, no list.

---

## Recipe Context

### Files to edit

| File | What changes |
|---|---|
| `src/app/admin/bookings/page.tsx` | Restructure above-list chrome: tab consolidation to 4 primary + "More" overflow, `SavedViewTabs` row, `AdminFilterBar` with mobile collapse trigger; `BookingListCard` rows with quick-action strip and Google Maps button |
| `src/app/admin/components/admin-scalable-lists.tsx` | Wire up `AdminListSurface` and `SavedViewTabs` — currently at 0/24 page usage (RECON §4); this page is their first consumer |

### Files to NEVER touch

- `src/app/admin/bookings/actions.ts` — all quick-action server actions (`quickUpdateBooking`, `claimBookingAssignment`, `updateBookingAssignment`, `updateBookingManagement`, etc.); UI calls these unchanged
- `src/app/admin/bookings/access.ts` — booking scope helpers (`canManageBookings`, `getBookingViewAccess`)
- `src/app/admin/bookings/format.ts` — booking format helpers
- `src/lib/auth/**`, `src/lib/supabase/**`, `src/middleware.ts` — standard untouchables (RECON §5)
- `supabase/migrations/**`
- All build/config files

### Feature Preservation Manifest

**Filter form `name` attributes that must not change (RECON §2):**
`view`, `search`, `from`, `to`, `status`, `assignment_status`, `payment_status`, `required_gender`, `location`, `service`, `assigned_staff` (admins only)

**Quick-action server actions that must keep firing (RECON §6.1):**
- `quickUpdateBooking` — Confirm, Mark paid, Cancel, Complete quick actions
- `claimBookingAssignment` — Claim action (Therapist + Coordinator)
- `updateBookingAssignment` — Assign action

**Audit log writes that must keep firing (RECON §6.2):**
`booking_quick_confirm`, `booking_quick_mark_paid`, `booking_quick_cancel`, `booking_quick_complete`, `booking_assignment_claimed`, `booking_assignment_unassigned`, `booking_assignment_reassigned`

**External link to preserve (RECON §6.5):**
Google Maps deep-link per booking row: `https://www.google.com/maps/search/?api=1&query=${address}` — must remain a `target="_blank"` link, never a server action

**URL filter deep-link contract (RECON §6.5):**
All filter params serialise to URL; deep-links like `/admin/bookings?view=claimable` and `/admin/bookings?view=needs-attention` must remain functional

### Information hierarchy (top to bottom)

1. Page identity + primary action (`AdminPageHeader` H1 + "New booking" button)
2. View context (primary tab strip + "More" overflow — which lens am I looking through?)
3. Saved views (personal shortcuts below the primary tabs)
4. Active filter context (`AdminFilterBar` + active chips — what am I filtering by?)
5. The list (`BookingListCard` rows — the actual work)

### Design direction — tokens and components

- **Primary tab active:** `action-primary` `oklch(23% 0.073 155)` fill + Field White text + `aria-current="page"`
- **Primary tab inactive:** transparent + Practice Charcoal + Work Sans 500 label step
- **Primary tab hover:** `surface-hover` `oklch(95.5% 0.012 155)` tint
- **SavedViewTabs pill inactive:** `surface-card` background + `border-subtle` border + Work Sans 500 label step
- **SavedViewTabs pill active:** `surface-selected` `oklch(92.0% 0.022 155)` tint + `border-default`
- **"More views" dropdown:** `AdminActionMenu` pattern — `surface-card` background, 8px radius, `overlay` green-tinted shadow, 240ms ease-gentle open
- **Filter bar:** `AdminFilterBar` — `surface-input` ground, `border-default` Form Seam on each input
- **Active filter chips:** Restricted family — `status-restricted-bg` / `status-restricted-text` — dismissible with trailing `x`
- **BookingListCard:** DESIGN.md §5 full spec — `surface-card` background, 1px `border-subtle`, 8px radius, status badge top-right, avatar inline with therapist name, payment badge bottom-left, gender-match chip when applicable, never `border-l-4`. **Group booking:** when `booking.group_booking = true`, a Restricted-family "Group · {N}" chip renders beside the booking reference — never colour-only, always shows participant count. **Override-created bookings** (unassigned with no therapist availability at creation) carry an Attention-family "Unassigned" assignment-status chip until a therapist claims it.
- **Quick-action strip:** Ghost buttons visible at rest — Work Sans 500 label step; trailing `more-horizontal` `AdminActionMenu`; `map-pin` Ghost icon always visible
- **Sticky date headings:** Urbanist 600 title step, Chronicle colour, `surface-page` background (so they stick cleanly over scrolling rows)
- **Skeleton rows:** `AdminSkeleton` at `BookingListCard` approximate height (≈80px desktop, ≈100px mobile)

---

## Implementation Notes

### Per-state intent

**Empty (view-specific)**
- All empty states use the `EmptyState` component (illustration + Urbanist title + Soft Slate body + optional CTA)
- Needs Attention empty: `check-circle` illustration, "All caught up", "No bookings need your attention right now." — no CTA
- Today empty: calendar illustration, "All caught up", "Nothing scheduled for today. Quiet days are healthy days." — no CTA
- Upcoming empty: calendar illustration, "Nothing upcoming", "No bookings scheduled beyond today." — no CTA
- Claimable empty: person-plus illustration, "Nothing to claim", "No unassigned bookings match your profile right now." — no CTA
- Filtered empty: search illustration, "No bookings match", "Try adjusting or clearing your filters." — Ghost "Clear filters" CTA that removes all active filter params

**Loading (tab switch or filter apply)**
- `AdminSkeleton` rows: 5–6 rows at approximate `BookingListCard` height; pulse animation (1.4s ease-in-out, `prefers-reduced-motion` respected)
- The tab strip, filter bar, and active chips remain visible during loading — only the list area skeletons
- Do not show a full-page spinner; the page chrome stays stable

**Error (list fetch failed)**
- Inline error region replacing the list area: Cancelled family, `alert-circle` icon, "Couldn't load bookings." body, Ghost "Try again" button that retriggers the fetch
- Tab strip and filter bar remain visible so the user can switch views or clear filters

**Permission denied**
- `AdminAccessDenied`: illustrated `EmptyState` variant, "You don't have access to this section.", "Contact the owner if you think this is a mistake.", Secondary "Back to dashboard"
- No tabs, no filter bar, no list render at all

### Per-viewport intent

**Mobile (375px)**
- `AdminPageHeader`: H1 "Bookings" full-width; "New booking" button stacks below H1 OR moves to `AdminMobileActionBar` at viewport bottom (preferred — keeps the header clean)
- Primary tab strip: horizontal momentum-scroll; tabs do not wrap; "More" button anchored at right edge; `SavedViewTabs` row hidden by default on mobile (accessible via a "Saved views" Ghost link or collapsed accordion if the user has saved views)
- `AdminFilterBar`: collapses entirely to a "Refine" Ghost button (Lucide `sliders-horizontal`, 16px) + active-filter-count badge (Pending family colours, pill); tapping opens `AdminSheet` from the bottom with the full filter form stacked vertically; "Apply filters" Secondary full-width + "Clear" Ghost below it
- Active filter chips: horizontal momentum-scroll strip below the "Refine" button; each chip has a trailing `x`; "Clear all" at the right end
- `BookingListCard` rows: full-width, single column; quick-action strip collapses — only `map-pin` Ghost icon remains inline at rest; tapping a row triggers contextual `AdminMobileActionBar` at viewport bottom with the 2 highest-priority actions for that booking state
- Date group headings: sticky within the scroll container, full-width

**Tablet (768px)**
- `AdminFilterBar` switches from collapsed to expanded at ≥768px
- `SavedViewTabs` row visible at ≥768px
- "New booking" button returns to right-aligned in `AdminPageHeader`
- `BookingListCard` rows remain single-column; quick-action strip becomes visible at rest

**Desktop (1440px)**
- Full above-list chrome: `AdminPageHeader` → primary tab strip + "More" → `SavedViewTabs` row → `AdminFilterBar` horizontal grid → active chips
- Content max-width: full-bleed (bookings list is a full-bleed surface per 00-shared-components brief)
- `BookingListCard` rows: comfortable density, 44px minimum row height; quick-action strip right-aligned with `map-pin` + primary Ghost action + `more-horizontal`
- Date group headings: sticky, `lg` (24px) top padding above each date group
- `SavedViewTabs`: "Save this view" Ghost button right-aligned in the saved views row; inline name input expands from that button position on click

### Verification steps

**Playwright (automated):**
- Tab navigation: click each of the 4 primary tabs — `?view=` param updates in URL, `aria-current="page"` moves to clicked tab, list re-fetches with skeleton then content
- "More views" dropdown: click "More" — dropdown opens with remaining tabs; click one — navigates to that view; press Escape — dropdown closes, focus returns to "More" button
- Save a view: apply a filter, click "Save this view", type a name, click "Save" — new pill appears in `SavedViewTabs`; click the pill — filter params pre-populate; delete the pill — inline confirmation appears, confirm "Remove" — pill disappears
- Mobile filter sheet: resize to 375px — filter bar collapses to "Refine" button; tap "Refine" — `AdminSheet` opens from bottom; apply a filter — sheet closes, chip appears, list re-fetches
- Quick action — Confirm: click "Confirm" on a pending booking row — button shows spinner — Sonner toast "Booking confirmed." appears — row status badge updates
- Quick action — Cancel: click `more-horizontal` → "Cancel booking" in menu → `ConfirmActionModal` opens → "Confirm" → booking cancelled, row updates
- Therapist role: sign in as Therapist — only Today, Upcoming, Claimable tabs visible; no "New booking" button; no payment badge on cards; only "Claim" and "View on Maps" quick actions present

**DevTools:**
- Google Maps link opens `https://www.google.com/maps/search/?api=1&query=…` in a new tab (not a POST)
- All filter params serialise to URL; page is deep-linkable at any filter state
- `audit_logs` receives correct action type on each quick action (Supabase inspector)
- Zero new console errors on any tab or filter combination

**`/impeccable audit`:**
- Zero `border-l-4` on any `BookingListCard` row, date group heading, or attention indicator
- All status badges have text label + icon (not colour-only)
- Active filter chips have text label (not colour-only)
- `SavedViewTabs` delete confirmation uses text ("Remove") not colour alone

**`/impeccable critique`:**
- Heading hierarchy: H1 "Bookings" (AdminPageHeader) — no H2/H3 on this page unless date group headings are rendered as H2 (confirm with implementer)
- `aria-current="page"` on active primary tab
- `aria-current` or `aria-pressed` on active saved view pill
- "Refine" button has accessible name including filter count when active: "Refine, 3 active filters"
- All quick-action Ghost buttons have accessible names that include booking context: "Confirm booking for {clientName}", not just "Confirm"

---

## Copy

### Form labels

**Filter bar (every field has a visible `<label>`):**
- `Search` — placeholder `Client name, phone, or booking ID`
- `Status` (select; default `Any status`)
- `Assignment` (select; default `Any assignment`)
- `Payment` (select; default `Any payment`)
- `Gender required` (select; default `Any gender`)
- `Service` (select; default `Any service`)
- `Location` (input; placeholder `City or area`)
- `Assigned to` (select, admins only; default `Anyone`)
- `From` (date)
- `To` (date)

**Saved-view inline name input:** `Name this view`. Placeholder `e.g. Today, unpaid`.

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Page header CTA | `New booking` | Primary |
| Filter bar submit (desktop) | `Apply filters` | Secondary |
| Filter bar reset | `Clear filters` | Ghost |
| Mobile filter sheet trigger | `Refine` (with count badge) | Ghost |
| Mobile filter sheet submit | `Apply filters` | Primary |
| Mobile filter sheet reset | `Clear` | Ghost |
| Saved view — save trigger | `Save this view` | Ghost |
| Saved view — confirm name | `Save view` | Primary |
| Saved view — cancel name | `Cancel` | Ghost |
| Saved view — delete inline confirm | `Remove` (Destructive) + `Keep` (Ghost) | — |
| "More views" overflow trigger | `More` (chevron) | Ghost |
| Row quick: confirm | `Confirm` | Ghost |
| Row quick: assign | `Assign` | Ghost |
| Row quick: send reminder | `Send reminder` | Ghost |
| Row quick: claim | `Claim` | Primary |
| Row quick: cancel (in menu) | `Cancel booking` | Ghost (Destructive text) |
| Row map link | `Maps` (icon `map-pin`) | Ghost |
| List load retry | `Try again` | Ghost |

### Error messages

- Saved view name empty: `Give this view a name.`
- Saved view name duplicate: `You already have a view called "{name}". Pick a different name.`
- Date range `From` after `To`: `End date has to be after the start date.`
- Filter load failure: `Couldn't load bookings.` (with `Try again` Ghost)
- Quick-action failure: `Couldn't update that booking. Try again.` (persistent toast, Retry Ghost)
- Quick-action stale (booking changed by someone else): `Someone just updated this one. Refresh to see the latest.`
- Claim race lost: `Someone got there first. The booking has been claimed.` (toast, 4s)

### Empty-state text

| View / context | Heading | Body | CTA |
|---|---|---|---|
| Needs Attention empty | `All caught up` | `No bookings need your attention right now.` | — |
| Today empty | `All caught up` | `Nothing scheduled for today. Quiet days are healthy days.` | — |
| Upcoming empty | `Nothing upcoming` | `No bookings scheduled beyond today.` | `New booking` |
| Claimable empty (admin/coordinator) | `Nothing to claim` | `No unassigned bookings right now.` | — |
| Claimable empty (therapist) | `Nothing to claim` | `No unassigned bookings match your profile right now.` | — |
| Filtered to empty | `No bookings match` | `Try adjusting or clearing your filters.` | `Clear filters` |
| Search to empty | `No bookings match that search` | `Check the name, phone, or ID and try again.` | `Clear search` |
| Denied | `You don't have access to this section` | `Contact the owner if you think this is a mistake.` | `Back to dashboard` |

### Tooltip text

- Each primary tab includes a native `title` showing the unfiltered count (e.g. `Today: 12 bookings`).
- "More" overflow Ghost: `Other views`.
- Saved-view pill: `Apply this view`.
- Saved-view delete `x`: `Remove this view`.
- Filter count badge on "Refine": `{N} active filters` (e.g. `3 active filters`).
- Active filter chip: `Clear this filter` (on the `x`).
- Row quick-action accessible names (sr-only suffix per row, never visible): `Confirm booking for {client name}`, `Assign therapist for {client name}`, `Send reminder for {client name}'s booking on {date}`, `Claim booking for {date} at {time}`.
- Maps icon: `Open in Google Maps`.
- Status badge on row: native `title` shows the action that last set the status, e.g. `Confirmed by Fatimah on 11 May`.
- Gender-required chip on row: `Client asked for a same-gender therapist`.

### Confirmation dialog text

**Cancel booking** (from row menu — reuses canonical from 00-shared-components)
- Heading: `Cancel this booking?`
- Body: `The client will be notified by email. This cannot be undone from the booking page.`
- Destructive: `Cancel booking`
- Secondary: `Keep it`

**Saved view — delete** (inline, not modal)
- Inline confirm: `Remove "{name}"?` with `Remove` (Destructive) and `Keep` (Ghost) buttons.

**Toasts**
- Confirm success: `Booking confirmed.`
- Send reminder success: `Reminder sent to {client name}.`
- Assign success: `Assigned to {therapist name}.`
- Claim success: `Booking claimed.`
- Cancel success: `Booking cancelled. The client has been notified.`
- Saved view created: `View "{name}" saved.`
- Saved view removed: `View "{name}" removed.`
