# Brief: client-detail

## 1. Feature Summary

The client detail page is the single-client command centre for the practice team. It surfaces everything known about one client: contact details, visit statistics, health context (when permitted), session notes, privacy request history, and the full booking timeline, all in one place. It is the starting point for rebooking a returning client, verifying health constraints before a session, and reviewing payment or cancellation history. Multiple RBAC scopes gate which sections are visible, making this the most permission-varied page in the admin after booking-detail.

## 2. Primary User Action

**Assess a client's status and either rebook them or look up the information needed for the next session.**

## 3. Design Direction

**Color strategy:** Full palette. Six status families active across booking history cards (Confirmed, Pending, Cancelled, Completed, Attention). The stats card and lifecycle badge add a second palette layer. Consistent with booking-detail and the Tactile Card-Board grammar.

**Theme scene sentence:** *"The practice manager opens a returning client's profile on a laptop at the front desk to check their last visit and health notes before the therapist arrives in 10 minutes."* Forces light mode, comfortable reading density, fast lateral scanning between reference sidebar and operational main column.

**Anchor references:**
- **Linear issue detail** — sidebar metadata + main content column; section hierarchy that does not compete with itself
- **Notion person page** — contact card + activity log; biography-style accumulation of context across time
- **Basecamp card** — clean note-taking flow with expandable inline forms

## 4. Scope

Production-ready. Full redesign of `page.tsx` and `ClientDetailForms.tsx`. All RBAC conditional rendering preserved verbatim. All form fields and server actions wired as-is.

## 5. Layout Strategy

**Desktop (≥1024px):** Two-column. Left sidebar fixed at `24rem`, right main column flexible. Sidebar stacks top-to-bottom: Contact → Stats → Health context (conditional) → Notes (conditional, expandable form) → Privacy (conditional) → Audit (conditional). Main column: page header (H1 client name + lifecycle badge + source chip + "New booking" Primary CTA) above the tabbed Booking History.

The sidebar is the **reference column** (who is this client, what are their constraints); the main is the **operational column** (booking history, the most-used content on this page). "New booking" belongs in the header because rebooking is the highest-frequency action from this surface.

**Mobile (<1024px):** Single column. Order: page header → Contact → Stats → Booking History (tabbed) → Notes → Health context → Privacy → Audit. Booking history moves up in the mobile stack because it is operationally primary over health/privacy reference data.

**Heading hierarchy fix:** The current page uses shadcn `Card`/`CardTitle` which renders H3, causing an H1→H3 skip on this page. All sidebar section titles move to `AdminPanel`/`AdminPanelHeader` (Urbanist 600, heading step, H2). This resolves BASELINE-CRITIQUE Sam #1 for this page.

## 6. Key States

| State | What the user sees |
|---|---|
| Default (loaded) | Header (name + badge + "New booking"), sidebar cards, Upcoming tab active in main column |
| Upcoming tab | BookingListCards for future bookings, ascending by date |
| Past tab | BookingListCards for past bookings, reverse-chronological |
| All tab | Combined reverse-chronological list |
| Empty Upcoming | EmptyState: illustration + "No upcoming bookings for this client." + "Book now" → `/admin/bookings/new?clientId={id}` |
| Empty Past | EmptyState: "No past bookings yet." (no CTA — past is read-only context) |
| Empty All | EmptyState: "No bookings yet." + "Book now" CTA |
| Notes: collapsed | Ghost "Add note" button at bottom of notes list (+ icon, 16px, `aria-label`) |
| Notes: expanded | Textarea + "Save note" Primary + "Cancel" Ghost; animates open 160ms ease-gentle |
| Privacy section | Request list + always-visible ClientPrivacyRequestForm below |
| Therapist view | Contact + Health context + Notes (session notes only) + scoped booking history; no Stats, Privacy, Audit, or "New booking" CTA |
| Fallback panel | Shown when `canViewHealthNotes`, `canCreateClientNote`, and `canManagePrivacyOperations` all false; plain-text notice |
| Access denied | AdminAccessDenied standard component |
| Loading | AdminSkeleton in sidebar + main |

## 7. Interaction Model

**Tab switching:** URL-param driven (`?tab=upcoming|past|all`), default `upcoming`. Server component reads the param and renders the correct booking list server-side. No JS required. Tab links carry `aria-current="page"` on the active tab per DESIGN.md Admin-Specific Patterns. Active tab: Clinic Green fill, Field White text, Urbanist 500. Inactive: transparent, Practice Charcoal.

**Note expansion:** Client-side `useState` (`isExpanded`) in `ClientDetailForms.tsx`. Collapsed state renders a Ghost "Add note" button at the bottom of the notes list. Clicking sets `isExpanded = true` and the form slides in (160ms, ease-gentle). On successful `addClientNote` action, the page re-renders (server action redirects or revalidates path); form collapses. "Cancel" sets `isExpanded = false` with no mutation.

**"New booking" CTA:** Primary button in the page header, links to `/admin/bookings/new?clientId={clientId}`. Rendered for Owner/Admin/Coordinator only; hidden for Therapist (no `manage_bookings_all`).

**Booking history cards:** Each `BookingListCard` links to `/admin/bookings/{bookingId}`. No inline mutations on history cards — this page is a read context for history; mutations happen on booking-detail.

**Privacy form:** Always visible when the Privacy section renders. Standard server-action submit. `request_type` select uses Work Sans 400 body step. `request_note` textarea is optional (3 rows). Submit: "Submit request" Secondary button (formal submission, not a primary action).

**Back-navigation:** Reachable from the booking-detail sidebar "View client profile" Ghost link (Brief 15). No explicit back-link needed — browser back button and AdminTopNav breadcrumb handle it.

## 8. Content Requirements

**Page header:**
- H1: client full name (Urbanist 600, display step, Chronicle)
- Sub-header row: lifecycle badge (status family appropriate to client state) + source chip (Work Sans 400 label step, Soft Slate — e.g. "Website" / "Phone" / "Referral")
- "New booking" Primary button (Owner/Admin/Coordinator only) — links to `/admin/bookings/new?clientId={clientId}`

**Booking history tabs:** "Upcoming" | "Past" | "All"

**Empty states per tab:**
- Upcoming: "No upcoming bookings for this client." + "Book now" Primary → `/admin/bookings/new?clientId={id}`
- Past: "No past bookings yet."
- All: "No bookings yet." + "Book now" Primary

**Notes form (expanded state):**
- Field label: "Note" (Work Sans 500, body step)
- Textarea: `name="note"`, 4 rows
- Buttons: "Save note" (Primary) + "Cancel" (Ghost)
- Toggle trigger: "Add note" Ghost, `+` icon 16px `aria-hidden="true"`, `aria-label="Add note for {client name}"`

**Notes list entries:** note text (Work Sans 400 body step, Practice Charcoal) + author name (Work Sans 500 label step) + timestamp (IBM Plex Mono 0.75rem, Soft Slate — e.g. "12 May 2026, 14:30")

**Privacy form:**
- Select label: "Request type"
- Options: "Data export" | "Correction" | "Deletion review" | "Sensitive note review"
- Textarea label: "Note (optional)"
- Button: "Submit request" Secondary

**Fallback panel:** "Contact details and booking history are available above. Additional sections require further permissions."

**Access denied:** "You don't have access to this client's profile. Contact the owner if you need access."

## 9. Recommended References

- `reference/interaction-design.md` — expandable inline form pattern, URL-param tab navigation, `aria-current` on tab links
- `reference/spatial-design.md` — two-column layout, sidebar/main ratio, mobile column reorder

## 10. Open Questions

1. **Therapist booking history scope.** The Therapist's data scope is "assigned bookings" for this client. Should their Booking History tab show all bookings they have ever been assigned to for this client (full session history between them), or only the booking that brought them to this page? Recommendation: all assigned bookings for this client — more useful for continuity of care.

2. **Stats card revenue figures.** Does "Client Summary" include financial totals (total paid, outstanding balance)? If so, are those gated by `view_reports_revenue` (hiding them from Coordinators)? Confirm before wiring the stats query.

3. **Privacy action name.** RECON.md §6.1 lists the action as `createClientPrivacyRequest`; the live `ClientDetailForms.tsx` shows `createClientPrivacyRequest`. Phase 6 must verify the exported name from `actions.ts` before wiring the form.

4. **"New booking" for Coordinator.** Confirm Booking Coordinator holds `manage_bookings_all` (and therefore sees the "New booking" CTA). RECON.md lists Coordinators as "manages enquiries and bookings" — this should be true, but validate against the live RBAC matrix before rendering the button.

---

## Role Variants

### Owner

**Visible:** Full surface. Page header (H1 + lifecycle badge + source chip + "New booking" Primary), Contact card, Stats card, Health context card, Notes card (full note list + expandable add form), Privacy card (request list + ClientPrivacyRequestForm), Audit card (recent audit events), Booking History tabs (all three tabs, complete booking list for this client).

**Hidden:** Nothing.

**Actions available:** "New booking" CTA, "Add note", privacy request submission, all booking card links to detail pages.

### Admin (Practice Manager)

**Visible:** Same structure as Owner. Contact, Stats, Health context, Notes, Booking History all confirmed visible.

**Conditional:** Privacy card and Audit card render only if Admin holds `canManagePrivacyOperations`. If not, these two sections are absent; the sidebar shows Contact → Stats → Health context → Notes. This is still a complete operational view.

**Hidden:** Nothing beyond the permission-conditional sections above.

**Actions available:** "New booking" CTA, "Add note", all booking card links.

### Booking Coordinator

**Visible:** Page header (H1 + badges + "New booking" Primary), Contact card, Stats card, Notes card (if `canCreateClientNote`), Booking History tabs (all three tabs, complete booking list for this client).

**Hidden:** Health context card (lacks `canViewHealthNotes`), Privacy card, Audit card.

**Actions available:** "New booking" CTA, "Add note" (if permitted), all booking card links.

**Copy note:** Shorter sidebar (Contact → Stats → Notes only) makes the main booking-history column more prominent for Coordinators — appropriate since scheduling is their core job on this page.

### Therapist

**Visible:** Contact card (full contact details for on-site visits), Health context card (primary reason Therapist reaches this page — pre-session health check), Notes card (can add session notes; note list filtered to notes they are permitted to see, excluding sensitive notes if `canViewSensitiveNoteQueue` is false), Booking History tabs (scoped to bookings this Therapist is assigned to for this client across all tabs).

**Hidden:** Stats card (no revenue/reporting scope), "New booking" CTA (no `manage_bookings_all`), Privacy card, Audit card.

**Data scope:** Therapist reaches this page only via an assigned booking. The page verifies access via `booking_assignments` (`pageAccess.dataScope` is not "all"). Booking History shows only their own assignments with this client.

**Actions available:** "Add note" (session notes), booking card links back to their assigned bookings.

**Sidebar:** Contact → Health context → Notes only — a clean, task-scoped pre-session reference strip.

### Denied state

**What renders:** `AdminAccessDenied` standard component. Copy: "You don't have access to this client's profile. Contact the owner if you need access."

**When triggered:** `pageAccess.access === false` for "clientDetail" — the staff member's role holds no client-related scope. Currently: Inactive staff and any role with all client permissions removed.

**What is hidden:** Entire page content. No partial render.

---

## Recipe Context

### Files to edit

| File | What changes |
|---|---|
| `src/app/admin/clients/[clientId]/page.tsx` | Replace shadcn `Card`/`CardTitle` (H3) with `AdminPanel`/`AdminPanelHeader` (H2) throughout sidebar; add URL-param tabbed booking history (`?tab=upcoming|past|all`, default `upcoming`, read server-side); add "New booking" Primary CTA to page header (Owner/Admin/Coordinator; absent for Therapist); add Therapist-scoped booking history query; reorder mobile column layout (booking history above notes/health on mobile); add `EmptyState` component per tab |
| `src/app/admin/clients/[clientId]/ClientDetailForms.tsx` | Wrap `ClientNoteForm` in expandable state: add `useState isExpanded` + Ghost "Add note" toggle button → expands textarea form on click → collapses on save/cancel; preserve all field `name` attributes and server action binding verbatim |

### Files to NEVER touch

- `src/app/admin/clients/actions.ts` — `addClientNote`, `createClientPrivacyRequest` (or `createClientPrivacyRequest` — verify name); do not change action names, signatures, or field bindings
- `src/app/admin/clients/access.ts`, `src/app/admin/clients/format.ts` — client access helpers; read-only references
- `src/lib/auth/**`, `src/lib/supabase/**` — standard untouchables (RECON §5)
- All build/config files

### Feature Preservation Manifest

**Form field `name` attributes that must not change (RECON §2):**

`ClientNoteForm`: `client_id`, `note`

`ClientPrivacyRequestForm`: `client_id`, `request_type`, `request_note`

**Server action wire-up:**
- `addClientNote` — `<form action={addClientNote}>` must be preserved
- `createClientPrivacyRequest` (verify export name in `actions.ts` against RECON §6.1 `createClientPrivacyRequest`) — `<form action={...}>` must be preserved

**URL contract:**
- `?tab=upcoming|past|all` — new GET param introduced by this brief; default `upcoming`; read server-side in `page.tsx`

**Deep-links that must remain valid:**
- `/admin/clients/{clientId}` — entry from clients list and from booking-detail "View client profile" Ghost link (Brief 15)
- `/admin/bookings/new?clientId={clientId}` — "New booking" and "Book now" CTA targets

### Information hierarchy (top to bottom / left to right)

**Header (above both columns):**
1. Client identity — H1 name + lifecycle badge + source chip
2. Primary action — "New booking" CTA (Owner/Admin/Coordinator)

**Sidebar (left, 24rem):**
3. Contact details — phone, email, address, postcode, city, area (always visible; city/area display after `20260513120000_add_client_city_area.sql` migration; show "—" when blank)
4. Client summary stats — total visits, last visit, lifecycle, source (always visible)
5. Health context — health notes, consent (conditional: `canViewHealthNotes`)
6. Client notes — note list + expandable add form (conditional: `canViewHealthNotes` OR `canCreateClientNote`)
7. Privacy workflow — request list + ClientPrivacyRequestForm (conditional: `canManagePrivacyOperations`)
8. Audit activity — recent events (conditional: `canManagePrivacyOperations`)

**Main (right, flexible):**
9. Booking History — tabbed (Upcoming default | Past | All) with `BookingListCard` rows

---

## Implementation Notes

See ## Key States and ## Layout Strategy above for per-state and per-viewport intent.

### Verification steps

**Playwright (automated):**
- Default state: navigate to `/admin/clients/{id}` as Owner — H1 renders client name, "New booking" button present, Upcoming tab active, all sidebar sections visible
- Tab switching: click "Past" tab — URL updates to `?tab=past`, past bookings list renders; click "All" tab — combined list renders
- Empty states: navigate to a client with no upcoming bookings — EmptyState renders in Upcoming tab with "Book now" CTA; "Book now" navigates to `/admin/bookings/new?clientId={id}`
- Note expansion: click "Add note" — textarea expands (160ms); type and submit — form collapses, note appears in list; click "Add note" again and then "Cancel" — form collapses with no mutation
- Therapist view: sign in as Therapist, navigate to an assigned client — Health context card visible, Stats card absent, "New booking" CTA absent, Privacy and Audit absent, Booking History scoped to assigned bookings only
- Coordinator view: sign in as Coordinator — Health context hidden, Privacy/Audit hidden, "New booking" CTA visible
- Access denied: navigate to a client the Therapist is not assigned to — AdminAccessDenied renders with plain-English copy

**DevTools:**
- No H1→H3 heading skips — all sidebar section titles are H2 via `AdminPanelHeader`
- `aria-current="page"` present on the active tab link, absent on inactive tabs
- `?tab=upcoming` is the default (or absent URL treated as default)
- "New booking" button is absent from the DOM for Therapist (conditionally not rendered, not `display:none`)

**`/impeccable audit`:**
- Zero `border-l-4` anywhere on the page (BookingListCards use full-border pattern)
- "Add note" toggle has an `aria-label` — not icon-only
- All status badges on booking history cards have text label + icon + bg tint (Named Status Rule)
- No gradient text anywhere on the page

**`/impeccable critique`:**
- Single H1 (client name) per page
- All tab links have `aria-current="page"` on the active tab
- Notes textarea has `<label for="note">` with matching `id`
- Privacy request select has `<label for="request_type">` with matching `id`
- "New booking" button is conditionally not rendered for Therapist (not hidden via CSS)

---

## Copy

### Form labels

**Add-note form (expandable):**
- Textarea — `Note` (required `*`, `name="note"`). Placeholder `Anything the team needs to know (kept on this client's record).` 4 rows.

**Privacy request form (always visible when section renders):**
- Select — `Request type` (`name="request_type"`). Options: `Data export`, `Correction`, `Deletion review`, `Sensitive note review`.
- Textarea — `Note (optional)` (`name="request_note"`). 3 rows. Placeholder `Anything the reviewer should know.`

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Header CTA (Owner/Admin/Coordinator) | `New booking` | Primary |
| Add-note collapsed trigger | `Add note` (with `+` icon) | Ghost |
| Add-note save | `Save note` | Primary |
| Add-note cancel | `Cancel` | Ghost |
| Privacy form submit | `Submit request` | Secondary |
| Tab links | `Upcoming` / `Past` / `All` | Tab-pill |
| Empty-tab CTA | `Book now` | Primary |
| Denied CTA | `Back to dashboard` | Secondary |

### Error messages

- Note empty on save: `Add a note before saving. Even one line is helpful.`
- Note save failure: `Couldn't save the note. Try again.`
- Privacy submit failure: `Couldn't submit the request. Try again.`
- Privacy `request_type` empty: `Pick what the request is about.`
- Privacy submit on duplicate open request: `There's already an open {type} request for this client. Review it before submitting another.`
- Tab `?tab=` unknown value: silently coerces to `upcoming` (no error message; URL is the source of truth).
- Out-of-scope client (therapist not assigned): renders Denied state below, no inline error.

### Empty-state text

| Context | Heading | Body | CTA |
|---|---|---|---|
| Upcoming tab empty | `No upcoming bookings` | `Book this client in when they're ready.` | `Book now` |
| Past tab empty | `No past bookings yet` | `Their first visit will show up here once it's complete.` | — |
| All tab empty | `No bookings yet` | `Book this client in to start a history.` | `Book now` |
| Notes empty | `No notes yet` | `Add a note to keep the team in the loop.` | `Add note` |
| Privacy empty | `No privacy requests` | `Data access and deletion requests appear here when the client asks.` | — |
| Audit empty | `No recent activity` | `Updates to this client's record will appear here.` | — |
| Fallback panel (limited permissions) | `Limited view` | `Contact details and booking history are available above. Other sections need more permissions.` | — |
| Denied | `You don't have access to this client's profile` | `Contact the owner if you need access.` | `Back to clients` |
| Therapist denied (out-of-scope) | `You haven't been assigned to this client` | `Ask the coordinator if you should be on their record.` | `Back to my bookings` |

### Tooltip text

- Lifecycle badge: native `title` shows full meaning — e.g. `Lifecycle: Returning (3+ visits)`.
- Source chip: native `title` shows source detail — e.g. `Source: Referral (Aisha Khan)`.
- Add-note Ghost: `Add a note for the team`.
- Privacy request type options: each option has a native `title` describing scope — `Data export: packages every record we hold on this client`, etc.
- Audit row link: `Open this audit event`.
- Note timestamps: native `title` shows absolute time — `12 May 2026, 14:30 BST`.
- Tab pills: native `title` shows count — `Upcoming (4)`, `Past (12)`, `All (16)`.
- "New booking" header button: `Start a new booking with this client pre-filled`.

### Confirmation dialog text

No destructive actions on this page. The privacy request submission is a form post, not a confirm-modal action — once submitted, the request appears in the list and can be cancelled via `/admin/privacy`.

**Toasts**
- Note saved: `Note saved.`
- Privacy request submitted: `Request sent for review.`
- Both errors: persistent Cancelled toast with `Retry` Ghost.
