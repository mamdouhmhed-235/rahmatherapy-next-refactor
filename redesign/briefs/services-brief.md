# Brief: services

## 1. Feature Summary

The services page is the treatment catalog for Rahma Therapy — the canonical list of every procedure the clinic offers, with pricing, duration, gender restrictions, and visibility controls. It is an infrequently-visited configuration surface: the Owner opens it to add a new service, update pricing, or deactivate a discontinued treatment. It is not a daily-operations page. The current 2-column card grid is replaced with a grouped catalog: services sectioned by `group_category` (Hijama, Massage, Soft tissue, etc.) with `AdminEntityRow` list rows within each group, and a right-side `AdminSheet` for create and edit replacing the centered Dialog.

## 2. Primary User Action

**Review the treatment catalog by category, add or edit a service, and update pricing or visibility.**

## 3. Design Direction

**Color strategy:** Restrained. This is a configuration surface visited rarely. Clinic Green anchors the "Add service" CTA. Status badges (Cancelled-family "Inactive", Restricted-family "Hidden") provide the only color signals needed. No triage palette — no need for Full palette on a catalog this size.

**Theme scene sentence:** *"The practice owner sits down on a quiet Wednesday afternoon to add a new cupping session to the treatment catalog before next month's booking window opens."* Forces light mode, deliberate and methodical pace — catalog management, not crisis triage.

**Anchor references:**
- **Stripe Dashboard product catalog** — clean grouped list, price prominent, status chips, sheet for create/edit
- **Linear settings — workflows** — section headers per category, row-level actions in a trailing menu
- **Shopify products admin** — list-not-grid, quick-edit inline, status badges at a glance

## 4. Scope

Production-ready. Restructures `page.tsx` from card grid to grouped list. Converts `ServiceFormDialog.tsx` from Dialog to `AdminSheet`. Routes `DeleteServiceButton.tsx` through `ConfirmActionModal`. All 12 form field names preserved verbatim.

## 5. Layout Strategy

**Single-column content area.** No persistent sidebar — this is a catalog, not a two-task page. Page header: H1 "Services" + summary prose ("{N} active, {M} inactive across {X} categories") + "Add service" Primary button (top-right header actions slot).

**Grouped sections:** One section per distinct `group_category`, sorted by the lowest `display_order` within that group. Each section: H2 group name (Urbanist 600, heading step, Chronicle) + `AdminEntityRow` list below. Sections appear in the natural order the treatments are offered (lowest `display_order` group first).

**Service row composition (AdminEntityRow style, 44px comfortable density):**
- Leading: 40px Hover Moss circle with the service's first letter (Urbanist 600, title step) — letter-token pattern matching Brief 20 roles
- Primary: service name (Urbanist 600, title step, Chronicle)
- Secondary: short description (Work Sans 400, label step, Soft Slate, `line-clamp-1`)
- Right rail: price (Work Sans 600, body step, Practice Charcoal) + duration chip (`{N} min`, Restricted family compact badge) + gender restriction chip (`Any` / `Female only` / `Male only`, Pending family) + order number (IBM Plex Mono, label step, Soft Slate, `#N`)
- Status badges (trailing, before actions): "Inactive" (Cancelled family) if `!is_active`; "Hidden" (Restricted family) if `!is_visible_on_frontend`; "In use" (Completed family) if `usage_count > 0`
- Actions: "Edit" Ghost button (always visible at rest) + three-dot `AdminActionMenu` containing: "Deactivate" / "Activate" + "Hide from website" / "Show on website" + separator + "Delete" (Destructive text color, guarded)

**Inactive services:** Shown inline within their group with the "Inactive" badge. No separate collapsed section — the catalog is small enough that burying inactive services creates confusion about what exists.

**Mobile (<768px):** Single column. Group section headers stack above their rows. Right-rail chips wrap below the service name on narrow viewports. "Edit" Ghost and three-dot menu remain visible at rest — no action hidden behind hover.

## 6. Key States

| State | What the user sees |
|---|---|
| Default (loaded) | Grouped catalog sections, all services visible, "Add service" Primary in header |
| Active service row | Letter token + name + description + price + duration + gender chips + "Edit" + three-dot |
| Inactive service row | Same + Cancelled-family "Inactive" badge; three-dot shows "Activate" |
| Hidden service row | Same + Restricted-family "Hidden" badge; three-dot shows "Show on website" |
| In-use service row | Same + Completed-family "In use" badge; "Delete" in three-dot disabled |
| Empty catalog | `EmptyState`: illustration + "No services yet. Add your first treatment." + "Add service" Primary |
| AdminSheet: Add service | Slide in from right, title "Add service", blank form, "Save service" Primary + "Cancel" Ghost |
| AdminSheet: Edit service | Same sheet, title "Edit {service name}", form pre-filled, "Save changes" Primary + "Cancel" Ghost |
| AdminSheet: submitting | Active button: 16px spinner + `aria-busy="true"`; inputs remain enabled |
| AdminSheet: field errors | Inline `role="alert"` error per field; cross-field error banner above submit for server errors |
| Delete confirmation | `ConfirmActionModal`: Cancelled family, "Delete {service name}?", plain-English body, "Delete" Destructive + "Cancel" Secondary |
| Delete blocked | Sonner toast (Cancelled family, no auto-dismiss): "This service has booking history and can't be deleted. Deactivate it instead." |
| Loading | AdminSkeleton: group headings + row placeholders at expected positions |

## 7. Interaction Model

**"Add service" CTA:** Primary button in page header opens `AdminSheet` (480px wide on desktop, full-width bottom sheet on mobile). Form action: `saveService` (create mode). On success: sheet closes, page revalidates, new service appears in its group section; Sonner toast "Service added."

**"Edit" per row:** Ghost button opens `AdminSheet` pre-filled with service's current values. Form action: `saveService` (edit mode). On success: sheet closes, row updates in place; Sonner toast "Service updated."

**Toggle `is_active` (three-dot menu):** Instant `saveService` call with flipped `is_active`. Non-destructive in both directions — no `ConfirmActionModal`. Sonner toast "Service deactivated." / "Service activated."

**Toggle `is_visible_on_frontend`:** Same pattern. Sonner toast "Hidden from website." / "Visible on website."

**Delete (three-dot menu):** Disabled with `title` tooltip if `usage_count > 0` ("Has booking history — deactivate instead"). If enabled: clicking "Delete" opens `ConfirmActionModal` (Cancelled family). Confirming calls `deleteService`. On success: Sonner toast "Service deleted.", row removed from list. On error: Sonner toast (Cancelled, no auto-dismiss).

**`AdminSheet` dismissal:** "Cancel" Ghost or clicking the backdrop closes without saving. No confirm-discard prompt needed (services are infrequently edited catalog records, not time-sensitive mutations).

**Gender restriction field (form):** Required dropdown — "Any gender", "Female clients only", "Male clients only". Clinically significant for Rahma (same-gender care). Label: "Gender restriction". Helper text below: "Affects which therapists can be assigned to this service." No blank/placeholder option.

**Form field grouping within `AdminSheet` (visual fieldsets, no `<fieldset>` required):**
1. Basic: Name + Slug + Category
2. Details: Gender restriction + Price + Duration + Display order
3. Visibility: Active checkbox + Show on website checkbox
4. Copy: Short description + Full description + Suitable for notes

## 8. Content Requirements

**Page header:**
- H1: "Services"
- Summary: "{N} active, {M} inactive across {X} categories" (Work Sans 400, label step, Soft Slate)
- "Add service" Primary button

**Group section headings (H2):** `group_category` value, title-cased (e.g. "Hijama", "Massage", "Soft tissue therapy")

**Row chips:** "{N} min" (duration, Restricted family) | "Any" / "Female only" / "Male only" (gender, Pending family) | "#N" (order, mono Soft Slate)

**Status badges:** "Inactive" (Cancelled) | "Hidden" (Restricted) | "In use" (Completed)

**Three-dot menu items:** "Deactivate" / "Activate" | "Hide from website" / "Show on website" | — | "Delete"

**Delete modal:** heading "Delete {service name}?", body "This service will be permanently removed. This cannot be undone.", actions "Delete" (Destructive Primary) + "Cancel" (Secondary)

**Delete blocked toast:** "This service has booking history and can't be deleted. Deactivate it instead."

**AdminSheet form field labels:** "Service name" (`name`, required) | "URL slug" (`slug`, helper: "Auto-generated from name") | "Category" (`group_category`, required) | "Gender restriction" (`gender_restrictions`, required, helper text) | "Price" (`price`, £ prefix) | "Duration" (`duration_mins`, "minutes" suffix) | "Display order" (`display_order`, helper: "Lower numbers appear first within the category") | "Active" (`is_active`) | "Show on website" (`is_visible_on_frontend`) | "Short description" (`short_description`) | "Full description" (`full_description`) | "Suitable for" (`suitable_for_notes`)

**Form submit buttons:** "Save service" (create mode) / "Save changes" (edit mode) — both Primary, full-width within sheet footer

**Empty catalog:** "No services yet. Add your first treatment." + "Add service" Primary

**Access denied:** Title: "Services access limited" / Body: "Service management is restricted to the practice owner. Ask the owner if you need a service updated."

## 9. Recommended References

- `reference/interaction-design.md` — `AdminSheet` pattern, `ConfirmActionModal` wiring, `AdminActionMenu` three-dot menu, Sonner toast feedback
- `reference/spatial-design.md` — grouped catalog sections with H2 headers, single-column content layout

## 10. Open Questions

1. **`group_category` is free-text.** The current form has a plain text input. Slightly different spellings (e.g. "Hijama" vs "hijama") will render as separate groups. Phase 6 should consider whether to keep free-text or replace with a datalist derived from existing distinct values. The brief preserves the free-text `group_category` field name unchanged.

2. **Drag-to-reorder within groups.** `display_order` controls ordering within a group but is edited as a number field. Drag-and-drop reorder handles would be more intuitive but require a batch `saveService` call. Out of scope for Phase 6 unless explicitly requested.

3. **`deleteService` vs archive variant.** RECON.md §6.1 notes "deleteService (and archive/restore variant)." Phase 6 must confirm whether `archiveService` is a separate action from `saveService(is_active: false)` before wiring the three-dot menu toggle. The brief treats deactivation as `saveService` with `is_active: false` and permanent removal as `deleteService`.

---

## Role Variants

### Owner

**Visible:** Full surface. Page header (H1 + summary + "Add service" Primary), all grouped catalog sections with all service rows in full composition, all row actions (Edit, Deactivate/Activate, Hide/Show, Delete), `AdminSheet` create/edit form, `ConfirmActionModal` on delete.

**Hidden:** Nothing.

**Actions available:** Add service, edit service, activate/deactivate, show/hide from website, delete (when `usage_count === 0`).

### Admin (Practice Manager)

**What renders:** `AdminAccessDenied` standard component. Title: "Services access limited" / Body: "Service management is restricted to the practice owner. Ask the owner if you need a service updated."

**Note:** `manage_services` is Owner-only per RECON.md §2.

### Booking Coordinator

**What renders:** `AdminAccessDenied`. Same copy as Admin.

### Therapist

**What renders:** `AdminAccessDenied`. Same copy as Admin.

### Denied state

**What renders:** `AdminAccessDenied` standard component. Title: "Services access limited" / Body: "Service management is restricted to the practice owner. Ask the owner if you need a service updated."

**When triggered:** Any staff member without `manage_services` — currently everyone except Owner. The raw permission name `manage_services` must not appear in the denied copy (DESIGN.md § Don't, BASELINE-CRITIQUE Fatimah #3).

**What is hidden:** Entire page content. No partial render of the catalog.

---

## Recipe Context

### Files to edit

| File | What changes |
|---|---|
| `src/app/admin/services/page.tsx` | Replace 2-column card grid with grouped `AdminEntityRow` list; add H2 group section headers per distinct `group_category` sorted by lowest `display_order`; add "Add service" Primary CTA in page header (opens `AdminSheet`); add summary prose to header; replace `AdminEmptyState` (legacy) with shared `EmptyState`; restyle to DESIGN.md token spec |
| `src/app/admin/services/ServiceFormDialog.tsx` | Convert from centered `Dialog` to `AdminSheet` (right-side slide-in on desktop, bottom sheet on mobile); restyle all 12 fields to DESIGN.md Input spec (surface-input ground, border-default Form Seam, Focus Azure on focus); add logical visual fieldsets (Basic / Details / Visibility / Copy); add `role="alert"` error regions per field and a cross-field error banner; add loading spinner to submit button; add helper text to `gender_restrictions` and `display_order` fields; preserve all 12 field `name` attributes verbatim |
| `src/app/admin/services/DeleteServiceButton.tsx` | Remove current two-stage inline button confirm; route through shared `ConfirmActionModal` (Cancelled family) for destruction confirmation; preserve existing guard logic (block deletion if `usage_count > 0` → Sonner toast, no modal) |

### Files to NEVER touch

- `src/app/admin/services/actions.ts` — `saveService`, `deleteService` (and archive/restore variant); do not change action names, signatures, or field bindings
- `src/lib/auth/**`, `src/lib/supabase/**` — standard untouchables (RECON §5)
- All build/config files

### Feature Preservation Manifest

**Form field `name` attributes that must not change (RECON §2):**

`ServiceFormDialog`: `name`, `slug`, `group_category`, `gender_restrictions`, `price`, `duration_mins`, `display_order`, `is_active`, `is_visible_on_frontend`, `short_description`, `full_description`, `suitable_for_notes`

**Server action wire-up:**
- `saveService` — `<form action={saveService}>` must be preserved (both create and edit modes)
- `deleteService` — `DeleteServiceButton` calls this action; binding must be preserved

**Existing guard logic to preserve:**
- If `usage_count > 0`: block `deleteService` call, show Sonner toast "This service has booking history and can't be deleted. Deactivate it instead." — do not show `ConfirmActionModal` in this path

**Deep-links that must remain valid:**
- `/admin/services` — entry from admin nav
- Services are referenced by `slug` in booking forms — slug field must remain editable but Phase 6 should warn that changing a slug on an active service may break existing booking form references

### Information hierarchy (top to bottom)

1. Page identity + summary — H1 "Services" + "{N} active, {M} inactive across {X} categories"
2. Primary action — "Add service" Primary CTA
3. Grouped catalog sections — H2 group name → service rows
4. Per-row: service name → price + duration + gender restriction → status indicators → actions

---

## Implementation Notes

See ## Key States above for per-state intent and ## Layout Strategy above for per-viewport intent.

### Verification steps

**Playwright (automated):**
- Default state: navigate to `/admin/services` as Owner — H1 "Services" visible, services grouped under H2 section headings, "Add service" Primary button present, all rows show "Edit" Ghost and three-dot menu
- "Add service" flow: click "Add service" → `AdminSheet` slides in, blank form; fill required fields + submit → sheet closes, new service appears in correct group section, Sonner toast "Service added."
- "Edit" flow: click "Edit" on a service row → `AdminSheet` slides in pre-filled; change price → submit → sheet closes, updated price visible on row, Sonner toast "Service updated."
- Deactivate flow: open three-dot menu → "Deactivate" → row gains "Inactive" Cancelled-family badge; three-dot menu now shows "Activate"; Sonner toast "Service deactivated."
- Delete flow (no booking history): open three-dot → "Delete" → `ConfirmActionModal` opens; click "Delete" → modal closes, row removed, Sonner toast "Service deleted."
- Delete blocked (has booking history): open three-dot → "Delete" option disabled; if somehow triggered → Sonner toast "This service has booking history and can't be deleted." (no modal shown)
- Empty catalog: access with no services in DB — `EmptyState` renders with "Add your first treatment." and "Add service" CTA (no dashed border)
- Access denied: sign in as Admin/Coordinator/Therapist → `AdminAccessDenied` renders, raw `manage_services` absent from page copy

**DevTools:**
- Group section headings are H2 elements (not H3 or `<p>`) — no H1→H3 skip
- All `ServiceFormDialog` fields have `<label for="…">` with matching `id` attributes
- Required fields (`name`, `slug`, `group_category`, `gender_restrictions`, `price`, `duration_mins`) have visible `*` marker in Cancelled text colour
- `role="alert"` error regions present in DOM even when empty
- `AdminSheet` is focusable and traps focus while open (WCAG 2.1 dialog pattern)
- No `border-l-4` on any row or status indicator

**`/impeccable audit`:**
- Zero `border-l-4` on rows, group headers, or error regions
- All status badges ("Inactive", "Hidden", "In use") have text label + icon + bg tint (Named Status Rule)
- "Edit" button and three-dot trigger visible at rest on every row (no hover-reveal)
- Duration and gender restriction chips are not colour-only (have text labels)
- Delete disabled state has programmatic `disabled` attribute + tooltip, not just visual greying

**`/impeccable critique`:**
- Single H1 "Services" on the page; group names are H2; no heading skips
- `gender_restrictions` select has `<label for="gender_restrictions">` with helper text below (not inside the label)
- `AdminActionMenu` three-dot button has `aria-label="More actions for {service name}"`
- `ConfirmActionModal` has `role="dialog"` and `aria-labelledby` pointing to the modal heading
- `AdminAccessDenied` copy contains no raw permission identifier (`manage_services` not shown)

---

## Copy

Voice: calm, plain, direct, kind. Verbs over nouns. Policy fields paired with plain-English consequence helpers. Encouraging empty states; specific errors; no raw permission names or raw DB column names in user copy.

### Form labels

**`ServiceFormDialog` → `AdminSheet` (preserved field names per RECON §6.4):**
- `Service name *` (`name="name"`) — placeholder `e.g. Hijama (wet cupping)`.
- `URL slug` (`name="slug"`) — placeholder `hijama-wet-cupping`. Helper `Auto-generated from name. Change with care; booking forms reference this.`
- `Category *` (`name="group_category"`) — placeholder `e.g. Hijama, Massage, Soft tissue therapy`. Helper `Services are grouped by category in the catalog and on the public site.`
- `Gender restriction *` (`name="gender_restrictions"`) — select. Options: `Any gender`, `Female clients only`, `Male clients only`. Helper `Affects which therapists can be assigned to this service.`
- `Price *` (`name="price"`) — `£` prefix, type `number`, step `0.01`, min `0`. Placeholder `60.00`.
- `Duration *` (`name="duration_mins"`) — type `number`, suffix `minutes`. Placeholder `60`.
- `Display order` (`name="display_order"`, number). Helper `Lower numbers appear first within the category.`
- `Active` (`name="is_active"`, checkbox, default checked). Helper `Inactive services don't show up on the public site or in booking forms.`
- `Show on website` (`name="is_visible_on_frontend"`, checkbox, default checked). Helper `Toggle off to hide from the customer-facing site without deactivating.`
- `Short description` (`name="short_description"`, textarea 2 rows). Placeholder `One sentence. Appears next to the service name in lists.`
- `Full description` (`name="full_description"`, textarea 5 rows). Placeholder `What it involves, what it's good for, what to expect.`
- `Suitable for` (`name="suitable_for_notes"`, textarea 3 rows). Placeholder `Conditions or audiences this treatment is suitable for. Written for the client.`

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Header CTA | `Add service` | Primary |
| Per-row edit | `Edit` | Ghost |
| Three-dot menu trigger | (icon `more-horizontal`) | Ghost — tooltip `More actions for {service name}` |
| Three-dot menu — deactivate | `Deactivate` | Ghost |
| Three-dot menu — activate | `Activate` | Ghost |
| Three-dot menu — hide | `Hide from website` | Ghost |
| Three-dot menu — show | `Show on website` | Ghost |
| Three-dot menu — delete | `Delete` | Ghost (destructive text, disabled when usage_count > 0) |
| Sheet — create | `Save service` | Primary (full-width in footer) |
| Sheet — edit | `Save changes` | Primary |
| Sheet — cancel | `Cancel` | Ghost |
| Delete modal — confirm | `Delete service` | Destructive |
| Delete modal — cancel | `Keep it` | Secondary |
| Empty-state CTA | `Add service` | Primary |

### Error messages

- `name` empty: `Add a service name.`
- `name` over 80 chars: `Trim the name to 80 characters or fewer.`
- `slug` invalid format: `Slugs use lowercase letters, numbers, and hyphens. For example: hijama-wet-cupping.`
- `slug` duplicate: `A service with that slug already exists. Edit the slug to make it unique.`
- `group_category` empty: `Add a category so this service groups with others.`
- `gender_restrictions` not picked: `Pick which gender this service is restricted to (or "Any" if it's open to all).`
- `price` negative: `Price can't be negative.`
- `price` non-numeric: `Price must be a number. For example: 60.00.`
- `duration_mins` zero or empty: `Duration must be at least 1 minute.`
- `duration_mins` over 600: `Duration over 10 hours doesn't look right. Double-check.`
- Server failure (save): `Couldn't save the service. Try again.` (toast, persistent)
- Server failure (delete): `Couldn't delete the service. Try again.`
- Delete blocked (has booking history): `This service has booking history and can't be deleted. Deactivate it instead.` (toast, Cancelled family, no auto-dismiss)
- Slug change on in-use service (warning, not blocker): `Changing the slug may break existing booking links. Continue?` (inline Pending banner above submit)

### Empty-state text

| Context | Heading | Body | CTA |
|---|---|---|---|
| No services yet | `No services yet` | `Add your first treatment to start the catalog.` | `Add service` |
| Filtered to empty (no current filters; render-safe) | `No services match` | `Try adjusting or clearing your filters.` | `Clear filters` |
| Group section empty (defensive) | (group hidden entirely if no services in it) | — | — |
| Denied | `Services access limited` | `Service management is restricted to the practice owner. Ask the owner if you need a service updated.` | `Back to dashboard` |

### Tooltip text

- Letter token: native `title` shows the full service name.
- Duration chip "{N} min": `{N}-minute appointment slot`.
- Gender chip "Any" / "Female only" / "Male only": `Open to any therapist` / `Female therapists only` / `Male therapists only`.
- Order number "#N": `Display order within {category} — lower first`.
- "Inactive" badge: `Hidden from booking forms and the public site`.
- "Hidden" badge: `Hidden from the public site but still bookable internally`.
- "In use" badge: `{N} bookings on file — can't be deleted`.
- "Edit" Ghost: `Edit {service name}`.
- Three-dot trigger: `More actions for {service name}`.
- Delete option (when disabled): native `title` — `Has booking history — deactivate instead`.
- Helper icons on form fields (where info icon is rendered): same text as the helper line.

### Confirmation dialog text

**Delete service**
- Heading: `Delete "{service name}"?`
- Body: `Past bookings keep this service name on their record. New bookings won't be able to use it.`
- Destructive: `Delete service`
- Secondary: `Keep it`

**Slug-change warning on in-use service** (optional inline confirmation modal)
- Heading: `Change the slug on a service in use?`
- Body: `{N} past bookings reference this service. Existing customer manage-booking links may break. The change still goes through.`
- Destructive: `Change slug`
- Secondary: `Keep current slug`

No confirmation on Activate / Deactivate / Hide / Show — these are reversible one-click toggles.

**Toasts**
- Create success: `Service added.`
- Edit success: `Service updated.`
- Deactivate success: `Service deactivated.`
- Activate success: `Service activated.`
- Hide success: `Hidden from the website.`
- Show success: `Visible on the website.`
- Delete success: `Service deleted.`
- Delete blocked: `This service has booking history and can't be deleted. Deactivate it instead.` (persistent)
- Save failure: `Couldn't save the service. Try again.` (persistent, Retry)
