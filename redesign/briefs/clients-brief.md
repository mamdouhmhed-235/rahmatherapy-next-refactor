# Brief: clients

## 1. Feature Summary

The clients page is the CRM directory of Rahma Admin — the surface staff open when a returning client calls to rebook, when a coordinator needs to find someone fast, or when the owner wants a pulse on the client base. It is a searchable, filterable list of all client records with per-row rebooking, lifecycle status, and enough summary data to identify the right person in a single glance. The current `ClientCard` grid is replaced with scannable list rows that scale to hundreds of clients without cognitive overload. The P0 a11y issue (unlabelled `location` filter input) is resolved in this redesign.

## 2. Primary User Action

**Find the right client in under 10 seconds and either open their record or start a new booking directly from the row.**

## 3. Design Direction

**Colour strategy:** Restrained. The client list is a directory — the eye should move to names and phone numbers, not status chips. Lifecycle status badges provide the single accent colour per row; the canvas stays warm and quiet.

**Theme scene sentence:** *"The Owner is at her kitchen table on a Sunday evening with her phone, looking up a returning client who just texted asking to rebook — she has a first name and wants the right record in under 10 seconds."* The scene forces light mode (locked), comfortable density on a small screen, and a layout where name and phone number land first.

**Anchor references:**
- **Apple Contacts on Mac/iOS** — the definitive CRM directory: avatar-led rows, name prominence, phone number as the secondary identifier, fast search
- **Linear's members list** — clean row density, avatar + name + metadata, no decoration competing with the data
- **Notion's table view filtered to a people database** — the filter/search strip as a quiet control bar above a clean list

## 4. Scope

Production-ready. List-row layout replacing the card grid, unlabelled `location` filter fixed, "New booking" Ghost button per row as a direct rebooking shortcut, `AdminFilterBar` with all five filters, alphabetical index strip (visible at 40+ records), alphabetical default sort with "Sort by last visit" toggle. Phase 6 implements.

## 5. Layout Strategy

**Above the list:**

1. `AdminPageHeader` — H1 "Clients", right-aligned "New client" Secondary button (→ `/admin/clients/new`; visible only to roles with `manage_clients_all`).
2. `AdminFilterBar` — five inputs in a horizontal grid on desktop, collapsing to a "Refine" bottom sheet on mobile: search (`q`, widest input, spans 2 columns on desktop, placeholder "Search by name, email, or phone"), Lifecycle select, Payment select, Location input (with explicit visible `<label>` — P0 BASELINE-CRITIQUE fix), Source select. Sort toggle ("Name A–Z" / "Last visit") as a secondary control right-aligned in the filter bar. "Apply filters" Secondary button. GET form; URL stays deep-linkable.
3. Active filter chips — Restricted family, dismissible, below the filter bar.

**The list:**

Each row is an `AdminEntityRow` — `surface-page` background, `border-bottom: 1px border-subtle`, 56px min-height.

Row anatomy (left to right):
- **Avatar** (32px circle): real photo if available; Work Sans 600 initials on a deterministic warm-tinted background (hue from `hash(client.id) % 360`, chroma 0.025, lightness 88%).
- **Primary column:** client name (Urbanist 600, title step, Chronicle) + phone number below (Work Sans 400, body step, Soft Slate).
- **Secondary column (desktop only):** "Last visit {date}" (IBM Plex Mono, label step, Soft Slate) + "{n} visits" (Work Sans 400, label step, Soft Slate).
- **Status column:** lifecycle status badge (Confirmed family for Returning, Pending family for New, Attention family for At-risk, Restricted family for Lapsed).
- **Actions column (right):** "New booking" Ghost button (→ `/admin/bookings/new?clientId={id}`), visible at rest; trailing `more-horizontal` Ghost icon for `AdminActionMenu`.

**Alphabetical index strip (desktop, 40+ records only):** A–Z anchor strip in the right gutter (Work Sans 500, label step, Soft Slate). Each letter links to a sticky section heading. Hidden when fewer than 40 records, when a search query is active, or when sorted by last visit.

## 6. Key States

| State | What the user sees |
|---|---|
| Default (alphabetical, 40+ records) | Filter bar, A–Z strip, alphabetically grouped rows with sticky letter headings |
| Default (fewer than 40 records) | Filter bar only (no A–Z strip), flat list of rows |
| Sorted by last visit | A–Z strip hidden; rows ordered by most recent booking date descending |
| Search query active | A–Z strip hidden; filtered rows; active chip "Search: {query}" |
| Filter applied | Active chips below filter bar; filtered rows |
| Empty (no filter) | `EmptyState`: "No clients yet" / "Add a client to start a history, or take a booking and we'll create one." Primary "New client" |
| Empty (filtered) | `EmptyState`: "No clients match" / "Try adjusting or clearing your filters." Ghost "Clear filters" CTA |
| Loading | `AdminSkeleton` rows (avatar circle + two text-line skeletons, 56px height) |
| "New booking" clicked | Instant navigation to `/admin/bookings/new?clientId={id}` with client pre-fill |
| Permission denied | `AdminAccessDenied` component |

## 7. Interaction Model

**Search:** The `q` input filters on submit ("Apply filters") or when the user clears it. Matches against name, email, and phone number. First Tab stop in the filter bar.

**Sort toggle:** A Ghost button pair ("Name A–Z" / "Last visit") right-aligned in the filter bar; clicking adds `?sort=name` or `?sort=last_visit` to the GET params. Active sort has `surface-selected` tint. Defaults to `sort=name`.

**Row click:** Opens client detail at `/admin/clients/{clientId}`. The full row is a link.

**"New booking" button:** Ghost, visible at rest, navigates directly to `/admin/bookings/new?clientId={clientId}`. Phone number is visible on the same row — the coordinator can confirm the caller's identity before clicking. On mobile, moves to a contextual `AdminMobileActionBar` when the row is tapped.

**A–Z anchor strip:** Each letter `<a href="#section-{letter}">` scrolls to the corresponding sticky `<h2>` group heading. Strip only renders at 40+ records and when sorted alphabetically.

**Mobile filter sheet:** "Refine" Ghost button (Lucide `sliders-horizontal`) + active-filter-count badge opens `AdminSheet` from the bottom with all five filters stacked vertically. "Apply filters" closes and submits.

## 8. Content Requirements

**Page H1:** "Clients"

**Filter labels (matching RECON.md `name` attributes):**
- `q`: visible `<label>` "Search"; placeholder "Search by name, email, or phone"
- `lifecycle`: "Lifecycle"
- `payment`: "Payment"
- `location`: "Location" — **must have an explicit visible `<label>` (P0 BASELINE-CRITIQUE Sam #3 fix)**
- `source`: "Source"

**Sort toggle labels:** "Name A–Z" / "Last visit"

**Row secondary line:** "Last visit {date}" / "{n} visit" / "{n} visits"

**Lifecycle badge labels:** New · Returning · At-risk · Lapsed

**Empty state copy:**

| Context | Heading | Body | CTA |
|---|---|---|---|
| No clients (unfiltered) | No clients yet | Add a client to start a history, or take a booking and we'll create one. | Primary "New client" |
| No clients (filtered) | No clients match | Try adjusting or clearing your filters. | Ghost "Clear filters" |

**"New client" button:** Secondary, visible for `manage_clients_all` roles only.

**"New booking" per row:** Ghost, visible at rest; accessible name "New booking for {clientName}".

## 9. Recommended References

- `reference/spatial-design.md` — list row anatomy with avatar + multi-column metadata, alphabetical index strip, sticky section headings, `AdminFilterBar` mobile collapse
- `reference/interaction-design.md` — GET filter form, active filter chips, sort toggle, `AdminMobileActionBar` contextual trigger
- `reference/motion-design.md` — `AdminSheet` bottom slide-in, skeleton row pulse

## 10. Open Questions

1. **Lifecycle param values.** Confirm the exact `?lifecycle=` param values from the server (New / Returning / At-risk / Lapsed, or different strings) before Phase 6 wires the select options. This is a code-lookup task, not a design decision.

---

## Role variants

### Owner

**Visible:** Full client list, all columns (avatar, name, phone, last visit, visit count, lifecycle badge). Full `AdminFilterBar` with all five filters including location (now labelled). Sort toggle. "New client" Secondary button. "New booking" Ghost button per row. A–Z strip (when 40+ records). `AdminActionMenu` with all secondary actions.

**Hidden:** Nothing.

**Role-specific notes:** Phone number is visible at list level. Default sort: alphabetical. Source attribution visible in filters for tracking acquisition channels.

---

### Admin (Practice Manager)

**Visible:** Identical to Owner — all columns, all filters, "New client" button, "New booking" per row, sort toggle, A–Z strip.

**Hidden:** Nothing.

**Role-specific notes:** No UI differences from Owner on this page.

---

### Booking Coordinator

**Visible:** Full client list, all columns, full `AdminFilterBar`, "New booking" Ghost button per row, sort toggle. "New client" Secondary button (Coordinators hold `manage_clients_all`).

**Hidden:** Nothing confirmed hidden. Secondary `AdminActionMenu` actions may be scoped by permission but the list row and primary rebooking action are fully visible.

**Role-specific notes:** This is the Coordinator's primary rebooking surface. Phone number prominence in each row is especially important — they confirm the caller's identity before clicking "New booking."

---

### Therapist

**Visible:** `AdminAccessDenied` component only.

**Hidden:** All rows, filter bar, search, sort, "New client" button, everything.

**Role-specific copy:** Heading "You don't have access to this section." Body "Therapists see clients only through their assigned bookings." CTA "Back to my bookings" → `/admin/bookings?view=assigned`. (No "contact the owner" prompt — this denial is intentional by design, not a configuration error.)

**Why denied:** Therapists access client context only through their assigned bookings (PRODUCT.md). They do not hold a general `clients scope` for the full CRM directory. The `therapist` shell variant (00-shared-components brief §11.3) has no "Clients" nav item.

---

### Denied state

Rendered for: Therapist role, Inactive accounts, and any custom role without `clients scope`.

**What renders:** `AdminAccessDenied` — illustrated `EmptyState`, heading "You don't have access to this section.", body "Therapists see clients only through their assigned bookings.", CTA "Back to my bookings" → `/admin/bookings?view=assigned`. No list, no filter bar, no search.

---

## Recipe Context

### Files to edit

| File | What changes |
|---|---|
| `src/app/admin/clients/page.tsx` | Replace `ClientCard` grid with `AdminEntityRow` list; add sort toggle to `AdminFilterBar`; add alphabetical index strip (desktop, 40+ records); wire "New booking" Ghost button per row |

### Files to NEVER touch

- `src/app/admin/clients/actions.ts` — `createClient`, `updateClient`, `addClientNote`, `createClientPrivacyRequest`
- `src/app/admin/clients/access.ts`, `format.ts` — client scope helpers and format utilities
- `src/lib/auth/**`, `src/lib/supabase/**`, `src/middleware.ts` — standard untouchables (RECON §5)
- `supabase/migrations/**`
- All build/config files

### Feature Preservation Manifest

**Filter form `name` attributes that must not change (RECON §2):**
`q`, `lifecycle`, `payment`, `location`, `source`

**Fix required (BASELINE-CRITIQUE Sam #3, P0):**
The `location` filter input currently has no `<label>` or `aria-label` at runtime. The redesign must add a visible `<label for="location">Location</label>` (or equivalent `aria-label`) — this is a WCAG 2.1 AA blocker.

**"New booking" deep-link (RECON §6.5):**
`/admin/bookings/new?clientId={id}` — must remain a GET navigation link, never a server action

**"New client" button:**
→ `/admin/clients/new`; visible only to roles with `manage_clients_all`

### Information hierarchy (per row, top to bottom / left to right)

1. Avatar/initials (identity anchor)
2. Client name (primary search target — Urbanist 600, title step)
3. Phone number (caller confirmation — Work Sans 400, Soft Slate)
4. Last visit date + visit count (secondary context — IBM Plex Mono / Work Sans, label step)
5. Lifecycle status badge (one status signal per row)
6. "New booking" quick action (the primary task outcome)

### Design direction — tokens and components

- **Row:** `AdminEntityRow` — `surface-page` background, `border-bottom: 1px border-subtle`, 56px min-height
- **Row hover:** `surface-hover` `oklch(95.5% 0.012 155)` tint, cursor pointer (full row is a link)
- **Avatar:** 32px circle — deterministic initials colour: hue from `hash(client.id) % 360`, chroma 0.025, lightness 88% (matches 00-shared-components §10 avatar algorithm)
- **Client name:** Urbanist 600, title step (1.333rem), Chronicle `oklch(11% 0.014 155)`
- **Phone / meta:** Work Sans 400, body/label step, Soft Slate `oklch(42% 0.008 143)`
- **Last visit date:** IBM Plex Mono, label step (0.875rem), Soft Slate
- **Lifecycle badges:** Confirmed family (Returning) / Pending family (New) / Attention family (At-risk) / Restricted family (Lapsed) — all with icon + text label per Named Status Rule
- **"New booking" button:** Ghost — no border, Hover Moss fill on hover, Work Sans 500 label step; accessible name "New booking for {clientName}"
- **A–Z strip:** Work Sans 500, label step, Soft Slate; anchors to sticky `<h2>` section headings (Urbanist 600, title step, Chronicle, `surface-page` bg)
- **Sort toggle:** Ghost button pair, `surface-selected` tint on active; Work Sans 500 label step
- **`AdminFilterBar`:** `surface-input` ground, `border-default` Form Seam on each input; `location` input requires explicit `<label>` element

---

## Implementation Notes

### Per-state intent

**Empty (no clients, unfiltered)**
- Heading: "No clients yet" (Urbanist 600, title step)
- Body: "Add a client to start a history, or take a booking and we'll create one." (Work Sans 400, Soft Slate)
- CTA: Primary "New client" → `/admin/clients/new`
- Visual: `EmptyState` with person-plus illustration

**Empty (filtered, no matches)**
- Heading: "No clients match"
- Body: "Try adjusting or clearing your filters."
- CTA: Ghost "Clear filters" — removes all active filter params and re-submits
- Visual: `EmptyState` with search illustration

**Loading**
- `AdminSkeleton` rows: avatar circle skeleton (32px, `border-subtle` background) + two text-line skeletons at body and label step heights; 56px row height maintained; 6–8 skeleton rows shown
- Filter bar and page header remain visible; only the list area skeletons

**Error (list fetch failed)**
- Inline error region replacing list area: Cancelled family, "Couldn't load clients." body, Ghost "Try again" button
- Filter bar remains visible

**Permission denied**
- `AdminAccessDenied`: illustrated `EmptyState`, "You don't have access to this section.", "Contact the owner if you think this is a mistake.", Secondary "Back to dashboard"
- No list, no filter bar, no sort toggle

### Per-viewport intent

**Mobile (375px)**
- `AdminPageHeader`: H1 "Clients" full-width; "New client" button moves to `AdminMobileActionBar` at viewport bottom (keeps header clean)
- `AdminFilterBar`: collapses entirely to "Refine" Ghost button (Lucide `sliders-horizontal`) + active-filter-count badge; tapping opens `AdminSheet` from bottom with all five filters stacked; sort toggle included at bottom of the sheet
- Active filter chips: horizontal momentum-scroll strip
- Row layout: avatar (left, 32px) + name + phone stacked (centre, full remaining width) + lifecycle badge (right); secondary column (last visit, visit count) hidden on mobile — not enough space; accessible via client detail
- A–Z strip: hidden on mobile (insufficient width for gutter positioning)
- "New booking" button: hidden from row at rest on mobile; appears in `AdminMobileActionBar` when the row is tapped

**Tablet (768px)**
- Filter bar expands to horizontal grid at ≥768px
- Sort toggle visible in filter bar
- Secondary column (last visit, visit count) appears at ≥768px
- A–Z strip appears at ≥1024px (not at 768px — insufficient canvas width for the gutter)
- "New booking" button appears inline at ≥768px

**Desktop (1440px)**
- Full row: avatar + name/phone + last visit/visit count + lifecycle badge + "New booking" + `more-horizontal`
- A–Z strip: right gutter, 24px from right edge of content area, sticky within scroll (only at 40+ records, alphabetical sort)
- Content max-width: `--content-width-xl` (full-bleed list surface matching bookings list)
- Filter bar: all five inputs in a 5-column horizontal grid + sort toggle right-aligned + "Apply filters" Secondary
- Sticky alphabetical `<h2>` group headings: `surface-page` background, `lg` (24px) top padding above each letter group

### Verification steps

**Playwright (automated):**
- Search: type a name in `q` input, click "Apply filters" — URL updates with `?q=`, list filters to matching rows
- Location filter: inspect DOM — `<label>` element with text "Location" is associated with the `location` input via `for`/`id` pair (P0 BASELINE-CRITIQUE fix verification)
- "New booking" click: click the Ghost "New booking" button on any client row — browser navigates to `/admin/bookings/new?clientId={id}`; booking-new page renders with "From client profile" chips on pre-filled fields
- Sort toggle: click "Last visit" — `?sort=last_visit` in URL, rows reorder by last booking date descending; click "Name A–Z" — alphabetical order restored, A–Z strip reappears (if 40+ records)
- A–Z strip threshold: verify strip is absent when list has <40 records; verify it appears and scroll-anchors correctly when list has 40+
- Therapist role: sign in as Therapist — `AdminAccessDenied` renders, no list or filter bar present

**DevTools:**
- Zero console errors on the clients page
- `location` input has a computable accessible name (axe-core: no "Form elements must have labels" violation)
- All `AdminEntityRow` rows have `role="link"` or are wrapped in `<a>` with correct href

**`/impeccable audit`:**
- Zero `border-l-4` on any row or section heading
- All lifecycle status badges have text label + icon (not colour-only)
- "New booking" Ghost button has accessible name including client name

**`/impeccable critique`:**
- Heading hierarchy: H1 "Clients" (AdminPageHeader) → `<h2>` for alphabetical group headings → no skips
- `location` filter has explicit visible `<label>` (P0 fix confirmed)
- All filter inputs have associated labels
- Sort toggle buttons have descriptive accessible names ("Sort alphabetically" / "Sort by last visit")

---

## Copy

### Form labels

- `Search` (`name="q"`) — placeholder `Search by name, email, or phone`.
- `Lifecycle` (`name="lifecycle"`) — default option `Any lifecycle`. Options: `New`, `Returning`, `At-risk`, `Lapsed`.
- `Payment` (`name="payment"`) — default option `Any payment`. Options: `In good standing`, `Has outstanding`, `Refund issued`.
- `Location` (`name="location"`) — placeholder `City or area`. **Visible `<label>` required** (P0 fix).
- `Source` (`name="source"`) — default option `Any source`. Options: `Website`, `Phone`, `WhatsApp`, `Instagram`, `Referral`, `Manual`, `Other`.
- Sort toggle — group label (sr-only) `Sort clients by`. Buttons: `Name A–Z` / `Last visit`.

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Header CTA (admin/coordinator) | `New client` | Secondary |
| Filter submit | `Apply filters` | Secondary |
| Filter clear | `Clear filters` | Ghost |
| Mobile filter sheet trigger | `Refine` (with count) | Ghost |
| Mobile filter sheet apply | `Apply filters` | Primary |
| Per-row primary action | `New booking` | Ghost |
| Row overflow trigger | (icon `more-horizontal`) | Ghost — tooltip `More actions` |
| Empty filtered CTA | `Clear filters` | Ghost |
| Empty unfiltered CTA | `New client` | Primary |
| Load retry | `Try again` | Ghost |
| Denied CTA | `Back to dashboard` | Secondary |

### Error messages

- Search returns nothing: `No clients match "{query}". Check the spelling, or try a phone number.`
- Filter combination returns nothing: `No clients match. Try adjusting or clearing your filters.`
- List load failure: `Couldn't load clients. Try refreshing.`
- Location filter — empty input (rare; both label and placeholder guide the user): no specific error, results just return empty.
- "New booking" link broken (404 client): `That client's record was deleted. Refresh to see the updated list.`

### Empty-state text

| Context | Heading | Body | CTA |
|---|---|---|---|
| No clients yet | `No clients yet` | `Add a client to start a history, or take a booking and we'll create one.` | `New client` |
| Filtered empty | `No clients match` | `Try adjusting or clearing your filters.` | `Clear filters` |
| Search empty | `No clients match "{query}"` | `Check the spelling, or try a phone number.` | `Clear search` |
| Lifecycle "Lapsed" but none | `No lapsed clients yet` | `Clients move into Lapsed after 6 months without a visit.` | `Show all` |
| Therapist denied | `You don't have access to this section` | `Therapists see clients only through their assigned bookings.` | `Back to my bookings` |

### Tooltip text

- Per-row avatar: no `title` attribute needed — the client name is already visible in the same row.
- Phone number: `Call this number` (mobile only — on desktop the phone number is metadata, no `tel:` link unless explicit).
- Lifecycle badge: native `title` describes the state — `Returning: 3 or more visits`, `New: joined within the last 30 days`, `At-risk: last visit over 3 months ago`, `Lapsed: last visit over 6 months ago`. (Enhancement only; not visible on mobile. The badge text label is the primary accessible signal.)
- "New booking" Ghost: `Start a new booking with {client name}`.
- A–Z strip letter: `Jump to {letter}` (e.g. `Jump to S`).
- Sort toggle buttons: `Sort alphabetically by name` / `Sort by most recent visit first`.
- Filter count badge on "Refine": `{N} active filters` (e.g. `3 active filters`).
- Last-visit date: native `title` shows absolute date — `12 May 2026`.

### Confirmation dialog text

No destructive actions on the list view. (Delete-client lives on the client detail page, not here.) No `ConfirmActionModal` instances.

**Toasts**
- "New client" success (renders on detail page after redirect): `{name} added.`
- Search/filter applied: no toast — list refresh is the feedback.
