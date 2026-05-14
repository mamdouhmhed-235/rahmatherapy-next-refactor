# Brief: enquiries

## 1. Feature Summary

The enquiries page is the lead pipeline for Rahma Therapy: every phone call, WhatsApp message, Instagram DM, website form, or referral that hasn't yet become a booking lives here. The Booking Coordinator (and Owner/Admin) works through this queue daily — recording new leads, following up with contacts, and converting qualified enquiries into bookings. The current page is two-column with the intake form on the left and a flat unfiltered list on the right; the redesign keeps the always-visible intake sidebar but adds a status tab strip and filter bar to the list column, turning the flat list into a genuine lead triage surface.

## 2. Primary User Action

**Work through the lead queue: record new enquiries as they come in, mark them contacted, and convert qualified leads to bookings.**

## 3. Design Direction

**Color strategy:** Full palette. Four status families active simultaneously in the list — Attention (New), Pending (Contacted), Confirmed (Converted), Cancelled (Closed) — each visible as a badge on every row. The intake form is a restrained surface beside a colour-rich list; the contrast is useful, not noisy.

**Theme scene sentence:** *"The booking coordinator is at their desk on a Tuesday morning, phone beside them, working through a list of weekend WhatsApp enquiries to follow up before noon."* Forces light mode, comfortable reading density, calm task-focused momentum — not the crisis-mode urgency of the audit or operations page.

**Anchor references:**
- **Linear triage queue** — work through items one by one, status updates inline, no modal interruption per item
- **Basecamp to-do list with intake sidebar** — form-beside-list where the form earns its permanent position by constant use
- **Front (email inbox)** — enquiry-as-communication-thread: receive, respond, convert or close

## 4. Scope

Production-ready. Restructures `page.tsx` layout and adds tabs + filter bar. Reskins `EnquiryForm.tsx` and `EnquiryStatusButton.tsx` to DESIGN.md token spec. All field names and server actions wired verbatim.

## 5. Layout Strategy

**Desktop (≥1024px):** Two-column. Left sidebar `24rem`, `AdminPanel` titled "Record enquiry" wrapping `EnquiryForm`. Right main column: tab strip (All | New | Contacted | Converted | Closed) + filter bar (Source / Assigned to / Date / search) + enquiry list below. "New" tab carries an Attention-family count badge when there are uncontacted leads.

**Mobile (<768px):** Single column. The intake form collapses behind a disclosure toggle at the top of the page ("Record new enquiry") — collapsed by default so the list is the first thing visible. Tab strip is a momentum-scroll horizontal pill row. Filter bar collapses to a "Filters" Ghost button that opens an `AdminSheet`.

**Enquiry rows (right column):** `AdminEntityRow`-style, `44px` comfortable density. Left: source icon (16px Lucide; `phone`, `message-circle`, `at-sign`, `globe`, `users`, `more-horizontal` for other) + full name (Urbanist 600, title step, Chronicle). Below name: service interest (Work Sans 400, label step, Soft Slate) + assigned staff avatar (24px) + name (label step). Right: date (IBM Plex Mono, Soft Slate) + status badge (top-right corner). Action row below the name line: Ghost buttons, always visible at rest (no hover-reveal — DESIGN.md Table Actions rule).

## 6. Key States

| State | What the user sees |
|---|---|
| All tab (default) | All enquiries newest-first; status badges distinguish pipeline stage at a glance |
| New tab | Only `status = "new"` rows; Attention-family badges; "Mark contacted" is the primary row action |
| Contacted tab | Only `status = "contacted"` rows; Pending-family badges; "Convert" is the primary row action |
| Converted tab | Only rows with `converted_booking_id`; Confirmed-family badges; "View booking →" Ghost link replaces action buttons |
| Closed tab | Only `status = "closed"` rows; Cancelled-family badges; no active actions (Closed is terminal) |
| Empty tab | `EmptyState` per tab with context-appropriate copy and optional CTA |
| Filter active | Active filter chips below the filter bar (Restricted family); "Clear filters" Ghost at right of chip row |
| Row: New | "Mark contacted" Ghost (primary next step) + "Convert" Ghost; three-dot menu contains "Close enquiry" |
| Row: Contacted | "Convert" Ghost (primary next step); three-dot menu contains "Close enquiry" |
| Row: Converted | "View booking →" Ghost link only; no status-change actions |
| Row: Closed | Three-dot menu only; intentionally quiet |
| Form: submitting | "Record enquiry" Primary button: 16px spinner + `aria-busy="true"`; inputs remain enabled |
| Form: error | `role="alert"` region above submit; Cancelled family; `x-circle` icon |
| Form: success | Form resets; new enquiry appears at top of list; Sonner toast "Enquiry recorded." |
| Loading | AdminSkeleton in list column |

## 7. Interaction Model

**Tab switching:** URL-param driven (`?tab=all|new|contacted|converted|closed`), default `all`. Server component reads param and queries accordingly. Tab links carry `aria-current="page"` on the active tab. "New" tab label appends an Attention-family pill count badge (Work Sans 500, label step) when `count > 0`.

**Converted tab filter:** Queries `converted_booking_id IS NOT NULL` (not a database `status` value — derived at query time). Status badge on converted rows reads "Converted" in Confirmed family colors.

**Filter bar:** GET form, additive URL params. Fields: `source` select (website / phone / whatsapp / facebook / instagram / referral / other), `assigned_staff` select (unassigned + active staff list), `from`/`to` date range with presets (Today / This week / This month / Custom), `q` free-text search (name, phone, email). Active filters render as Restricted-family chips below the bar. "Clear" on each chip removes that param from the URL.

**Status actions per row:**
- "Mark contacted": `EnquiryStatusButton` → `updateEnquiryStatus(id, "contacted")` — instant, Sonner toast "Marked as contacted."
- "Convert": Ghost link → `/admin/bookings/new?enquiryId={id}` (navigation only, no server action)
- "Close enquiry": via three-dot `AdminActionMenu` → `updateEnquiryStatus(id, "closed")` — no `ConfirmActionModal` (see Open Question 1)
- "View booking →": Ghost link → `/admin/bookings/{converted_booking_id}`

**Intake form (left sidebar):** Standard `<form action={createEnquiry}>`. On mobile, the disclosure toggle uses client-side `useState` — no URL change. Form resets on successful submission (server action revalidates path).

**Source icon mapping:** `phone` → `phone`, `whatsapp` → `message-circle`, `facebook` → `facebook`, `instagram` → `at-sign`, `website` → `globe`, `referral` → `users`, `other` → `more-horizontal`. All icons 16px, `aria-hidden="true"`. (Lucide includes a `facebook` icon; `at-sign` remains the substitute for Instagram which has no Lucide icon — see Open Question 4.)

## 8. Content Requirements

**Tab labels:** "All" | "New" | "Contacted" | "Converted" | "Closed"

**New tab count badge:** Attention-family pill showing uncontacted lead count (e.g. "3"); hidden when count is 0.

**Status badge copy:** "New" (Attention) | "Contacted" (Pending) | "Converted" (Confirmed) | "Closed" (Cancelled)

**Row action copy:**
- "Mark contacted" (Ghost)
- "Convert" (Ghost → becomes "View booking →" once converted)
- Three-dot menu item: "Close enquiry"

**Filter bar labels:** "Source" | "Assigned to" | "Date" | search placeholder "Search by name, phone or email"

**Form section title:** "Record enquiry" (AdminPanel heading, H2)

**Form submit button:** "Record enquiry" (Primary, full-width within sidebar)

**Success toast:** "Enquiry recorded."

**Error alert:** "Something went wrong. Try again." — `role="alert" aria-live="polite" aria-atomic="true"`, Cancelled family, `x-circle` icon

**Mobile form toggle trigger:** "Record new enquiry" (Work Sans 600, title step, `+` / `−` icon 16px)

**Empty states per tab:**
- All: "No enquiries yet. They'll appear here when recorded."
- New: "No new enquiries."
- Contacted: "No contacted enquiries."
- Converted: "No converted enquiries yet."
- Closed: "No closed enquiries."

**Access denied:** "You don't have access to the enquiries pipeline. Contact the owner if you need access."

## 9. Recommended References

- `reference/interaction-design.md` — URL-param tab navigation, `role="alert"` error region, `AdminActionMenu` three-dot pattern, `AdminSheet` filter collapse on mobile
- `reference/spatial-design.md` — two-column sidebar/main layout, filter chip row below filter bar

## 10. Open Questions

1. **"Close" reversibility.** The brief treats Close as non-destructive (no `ConfirmActionModal`) because `updateEnquiryStatus` can theoretically reopen a record. Confirm whether the server action supports reverting `closed → new`. If not, wrap "Close enquiry" in a `ConfirmActionModal` (Cancelled family) before shipping.

2. **Assigned staff on existing enquiries.** `EnquiryForm` has `assigned_staff_id` at creation but there is no reassignment UI on existing rows. Phase 6 should confirm whether a "Reassign" action in the three-dot menu is needed for New/Contacted rows.

3. **"New" count badge placement.** The current page renders a "X new" count in the page header. The redesign moves this to the "New" tab badge. Confirm no other part of the admin (NotificationBell, dashboard Attention strip) reads the header badge DOM — the count comes from the same Supabase query, not the DOM.

4. **Source icon for Instagram.** Lucide has no Instagram icon. Using `at-sign` as the closest substitute. If the team prefers a text-only chip for all sources (no leading icon), that is a cleaner fallback — confirm preference before Phase 6.

---

## Role Variants

### Owner

**Visible:** Full surface. Left sidebar `AdminPanel` "Record enquiry" wrapping `EnquiryForm` (with `assigned_staff_id` staff selector showing all active staff) + full tab strip with count badge + filter bar + enquiry list with all row actions.

**Hidden:** Nothing.

**Actions available:** Record enquiry, mark contacted, convert, close, view booking, all filters.

### Admin (Practice Manager)

**Visible:** Identical surface to Owner. Full `EnquiryForm` + all tabs + filter bar + all row actions. Same `assigned_staff_id` staff list.

**Hidden:** Nothing.

**Actions available:** Same as Owner.

### Booking Coordinator

**Visible:** Identical surface to Owner and Admin. This is the Coordinator's primary daily-work page — full `EnquiryForm`, full tab strip, full filter bar, all row actions.

**Hidden:** Nothing.

**Copy note:** Coordinator sees the same surface as Owner and Admin on this page because enquiry management is their core function. No trimming applied.

**Actions available:** Same as Owner.

### Therapist

**Visible:** Nothing. `canManageEnquiries` is false for the Therapist role.

**What renders:** `AdminAccessDenied` standard component. Copy: "You don't have access to the enquiries pipeline. Contact the owner if you need access."

**Hidden:** Entire page content including the intake form and enquiry list.

### Denied state

**What renders:** `AdminAccessDenied` standard component. Copy: "You don't have access to the enquiries pipeline. Contact the owner if you need access."

**When triggered:** `canManageEnquiries` returns false. Currently: Therapist role and Inactive staff. The raw permission name `manage_enquiries` must not appear in the denied copy (DESIGN.md § Don't, BASELINE-CRITIQUE Fatimah #3).

**What is hidden:** Entire page content. No partial render.

---

## Recipe Context

### Files to edit

| File | What changes |
|---|---|
| `src/app/admin/enquiries/page.tsx` | Add URL-param tab strip (`?tab=all\|new\|contacted\|converted\|closed`, default `all`); add filter bar (`source`, `assigned_staff`, `from`, `to`, `q` GET params); restructure enquiry list to use tab-filtered + filter-filtered queries; restyle list rows to `AdminEntityRow`-pattern with source icon + status badge + always-visible Ghost action buttons + three-dot `AdminActionMenu`; replace plain header count badge with "New" tab count badge; replace `AdminEmptyState` (legacy) with shared `EmptyState` per tab; mobile: add form disclosure toggle (`useState isFormOpen`); restyle page to DESIGN.md token spec |
| `src/app/admin/enquiries/EnquiryForm.tsx` | Restyle all form fields to DESIGN.md Input spec (`surface-input` ground, `border-default` Form Seam, Focus Azure on focus); add `role="alert"` error region above submit; add loading spinner to "Record enquiry" button on submit; add `aria-label` to `assigned_staff_id` select; ensure all `<label>` elements have `for` attributes matching field `id`s |
| `src/app/admin/enquiries/EnquiryStatusButton.tsx` | Replace current tone-based styling (raw `warning`/`muted` classes) with DESIGN.md `AdminStatusBadge` + Ghost button pattern; status transitions use Sonner toast feedback |

### Files to NEVER touch

- `src/app/admin/enquiries/actions.ts` — `createEnquiry`, `updateEnquiryStatus`; do not change action names, signatures, or field bindings
- `src/lib/auth/**`, `src/lib/supabase/**` — standard untouchables (RECON §5)
- All build/config files

### Feature Preservation Manifest

**Form field `name` attributes that must not change (RECON §2):**

`EnquiryForm`: `full_name`, `source`, `phone`, `email`, `service_interest`, `assigned_staff_id`, `notes`

**Server action wire-up:**
- `createEnquiry` — `<form action={createEnquiry}>` must be preserved
- `updateEnquiryStatus` — `EnquiryStatusButton` calls this action; binding must be preserved

**URL contract (additive — no existing params renamed):**
- New params introduced by this brief: `tab`, `source`, `assigned_staff`, `from`, `to`, `q`
- No existing URL contract to preserve (current page has no GET params)

**Deep-links that must remain valid:**
- `/admin/enquiries` — entry from nav and dashboard Coordinator tile
- `/admin/bookings/new?enquiryId={id}` — "Convert" CTA target; pre-populates booking form (RECON §6.5)
- `/admin/bookings/{converted_booking_id}` — "View booking →" link on converted rows

### Information hierarchy (top to bottom / left to right)

**Left sidebar (24rem):**
1. EnquiryForm in `AdminPanel` "Record enquiry" (H2) — always visible on desktop

**Right main column:**
2. Tab strip — All | New (with count badge) | Contacted | Converted | Closed
3. Filter bar — Source / Assigned to / Date / search `q`
4. Active filter chips (when filters applied)
5. Enquiry list rows:
   - Source icon + client name (primary identity)
   - Service interest + assigned staff (secondary context)
   - Date + status badge (metadata + lifecycle state)
   - Action row: primary Ghost action (context-dependent) + three-dot menu

---

## Implementation Notes

See ## Key States above for per-state intent and ## Layout Strategy above for per-viewport intent.

### Verification steps

**Playwright (automated):**
- Default state: navigate to `/admin/enquiries` as Owner — EnquiryForm sidebar visible, "All" tab active, all enquiries listed newest-first, no filter chips visible
- Tab switching: click "New" tab — URL updates to `?tab=new`, only `status = "new"` rows visible, Attention-family badges on all rows; click "Converted" tab — only rows with `converted_booking_id` visible, "View booking →" link present on each row
- New tab count badge: present when `status = "new"` count > 0; absent when count is 0
- Filter bar: select source "whatsapp" — URL updates with `?source=whatsapp`, only whatsapp rows visible, active chip renders below filter bar; click chip "×" — filter clears, all rows return
- "Mark contacted" action: click on a New row's "Mark contacted" button — `updateEnquiryStatus` fires, Sonner toast "Marked as contacted." appears, row moves to Contacted status
- "Convert" action: click "Convert" on a Contacted row — navigates to `/admin/bookings/new?enquiryId={id}`
- Empty state per tab: navigate to "Closed" tab with no closed enquiries — `EmptyState` component renders (no dashed border, correct copy)
- Mobile: at 375px viewport — form is collapsed, "Record new enquiry" toggle visible; click toggle — form expands; filter bar collapsed to "Filters" Ghost button
- Form submit: fill form + submit — form resets, Sonner toast "Enquiry recorded.", new row appears at top of list
- Therapist denied: sign in as Therapist — `AdminAccessDenied` renders, raw `manage_enquiries` string absent from page copy
- Coordinator access: sign in as Coordinator — full surface visible, identical to Owner

**DevTools:**
- `aria-current="page"` present on active tab link, absent on inactive tabs
- `role="alert" aria-live="polite" aria-atomic="true"` present on form error region (even when empty — region pre-exists in DOM)
- All filter inputs have `<label>` elements with matching `for`/`id` pairs
- Source icons are 16px, `aria-hidden="true"` on each
- No `border-l-4` on any row, card, or alert element

**`/impeccable audit`:**
- Zero `border-l-4` on rows, status banners, or form error regions
- All status badges have text label + icon + bg tint (Named Status Rule — no colour-only badges)
- "Convert" and "Mark contacted" buttons are visible at rest (not hover-revealed)
- `AdminActionMenu` three-dot button has `aria-label="More actions for {full_name}"`
- No gradient text anywhere on the page

**`/impeccable critique`:**
- Single H1 (page title "Enquiries") + H2 "Record enquiry" in sidebar — no heading skips
- All `EnquiryForm` inputs have `<label for="…">` with matching `id` attributes
- Required fields (`full_name`, `email`) have visible `*` marker in Cancelled text colour (`<span aria-hidden="true">*</span>`)
- "New" tab count badge is supplementary to the tab label (not the sole indicator of lead count)
- `AdminAccessDenied` copy contains no raw permission identifier (`manage_enquiries` not shown)

---

## Copy

### Form labels

**Intake form (`EnquiryForm`):**
- `Full name *` (`name="full_name"`) — placeholder `Their name as they gave it`.
- `Source *` (`name="source"`) — select; options `Website`, `Phone`, `WhatsApp`, `Instagram`, `Referral`, `Other`.
- `Phone` (`name="phone"`) — placeholder `07…`. Helper `Either phone or email helps you reply.`
- `Email` (`name="email"`) — placeholder `name@example.com`.
- `Service interest` (`name="service_interest"`) — placeholder `e.g. Hijama, group booking, postnatal massage`.
- `Assign to` (`name="assigned_staff_id"`) — select; default `Unassigned`.
- `Notes` (`name="notes"`) — textarea, 4 rows. Placeholder `What did they say? Anything useful for follow-up.`

**Filter bar (right column):**
- `Source` — default `Any source`.
- `Assigned to` — default `Anyone`. Includes `Unassigned`.
- `Date` — chip group: `Today`, `This week`, `This month`, `Custom` (reveals `From`/`To`).
- `Search` (`name="q"`) — placeholder `Search by name, phone, or email`.

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Intake submit | `Record enquiry` | Primary |
| Mobile intake toggle | `Record new enquiry` (with `+`/`−`) | Ghost |
| Tab pills | `All` / `New` / `Contacted` / `Converted` / `Closed` | Tab-pill |
| Filter apply | `Apply filters` | Secondary |
| Filter clear | `Clear filters` | Ghost |
| Mobile filter sheet trigger | `Filters` (with count) | Ghost |
| Mobile filter sheet apply | `Apply filters` | Primary |
| Per-row mark contacted | `Mark contacted` | Ghost |
| Per-row convert | `Convert` | Ghost |
| Per-row view booking (converted rows) | `View booking →` | Ghost |
| Per-row close (in `AdminActionMenu`) | `Close enquiry` | Ghost (destructive text) |
| Per-row overflow trigger | (icon `more-horizontal`) | Ghost |

### Error messages

- Full name empty: `Add their name so you have something to call them.`
- Source not picked: `Pick where this enquiry came from.`
- Phone and email both empty: `Add a phone or email; you need at least one to follow up.`
- Email malformed: `Email needs an @ symbol (for example, sara@example.com).`
- Phone too short: `Phone number is too short. Include the area code.`
- Server submit failure: `Something went wrong. Try again.` (inline `role="alert"`)
- Mark contacted failure: `Couldn't update that one. Try again.` (toast, persistent)
- Convert click on stale enquiry (already converted): `That enquiry was already converted. Open the booking from the row.`
- Close failure: `Couldn't close that one. Try again.`
- Filter date range invalid: `End date must be after the start date.`

### Empty-state text

| Tab | Heading | Body | CTA |
|---|---|---|---|
| All, no enquiries ever | `No enquiries yet` | `New leads from phone, WhatsApp, Instagram, or the website show up here.` | `Record enquiry` (scrolls focus to form) |
| New, zero | `No new enquiries` | `Everything that's come in has been picked up.` | — |
| Contacted, zero | `No contacted enquiries waiting` | `Once you reach out to a new lead, it'll appear here.` | `Show new` |
| Converted, zero | `No converted enquiries yet` | `When a lead becomes a booking, it'll show up here with a link to the booking.` | — |
| Closed, zero | `No closed enquiries` | `Closed leads show up here for the record.` | — |
| Filtered to empty (any tab) | `No enquiries match` | `Try adjusting or clearing your filters.` | `Clear filters` |
| Denied | `You don't have access to the enquiries pipeline` | `Contact the owner if you need access.` | `Back to dashboard` |

### Tooltip text

- Source icon on a row: `From {source}` (e.g. `From WhatsApp`).
- Status badge on row: native `title` shows when it last changed, e.g. `Marked contacted by Aisha on 11 May`. (Enhancement only; not visible on mobile.)
- Assigned staff avatar: `Assigned to {name}` or `Unassigned`.
- Date on row: native `title` shows absolute date, e.g. `Received 12 May 2026, 09:42 BST`. (Enhancement only; not visible on mobile.)
- "Mark contacted" Ghost: `Record that you've reached out to {first name}`.
- "Convert" Ghost: `Open a new booking with this enquiry pre-filled`.
- "View booking →" on converted row: `Open the booking that came from this enquiry`.
- "Close enquiry" in menu: `Mark this one done: they didn't book, or it wasn't a fit`.
- New-tab count badge: `{N} new enquiries to follow up`.
- Three-dot menu trigger: `More actions for {first name}`.

### Confirmation dialog text

Per §10 Q1, Close is treated as non-destructive (reversible via `updateEnquiryStatus`). No `ConfirmActionModal` instances by default. **If Phase 6 confirms Close is one-way**, wrap "Close enquiry" with:

- Heading: `Close this enquiry?`
- Body: `Closed enquiries stay on file but stop appearing in the active queue.`
- Destructive: `Close enquiry`
- Secondary: `Keep it open`

**Toasts**
- Record success: `Enquiry recorded.`
- Mark contacted success: `Marked as contacted.`
- Close success: `Enquiry closed.`
- Convert (no toast — navigation is the feedback)
- Any failure: persistent Cancelled toast with `Retry` Ghost.
