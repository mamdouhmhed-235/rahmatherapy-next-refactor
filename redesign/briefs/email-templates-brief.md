# Brief: email-templates

## 1. Feature Summary

The Email Templates & Delivery Hub extends the existing `/admin/emails` page into a three-tab tool: a Template browser organised by recipient audience, a per-template preview-and-edit panel for safe copy fields (greeting sentences, intro lines, footer contact — never booking IDs, participant data, or variable placeholders), and the existing Reminders queue and Delivery log. It serves the Owner and high-permission Admin users who want to control the brand voice in outgoing emails without touching code, and surfaces a read-only plus manual-send mode for Therapists who need to push a specific template at will.

## 2. Primary User Action

**Open a template, see exactly what the recipient receives, and — if you have permission — correct a line of copy before the next booking fires it.**

## 3. Design Direction

**Colour strategy:** Full palette, inheriting DESIGN.md §2. Status-family tints flag template states (saved, unsaved, error). The three audience groups each carry a soft `surface-hover` or `surface-selected` tint on hover and selection — not a full-bleed colour shift per group.

**Theme scene sentence:** *"Fatimah, the Owner, on her laptop on a Sunday afternoon, checking that the 'booking cancelled' email doesn't sound cold before she cancels a booking tomorrow. She wants to see the real email and fix one sentence."* The scene forces light mode (already locked), a calm distraction-free preview environment, and an edit surface that feels considered rather than form-filler.

**Anchor references:**
- **Mailchimp's template preview panel** — the side-by-side live preview as you edit is the interaction model target, not its brand
- **Linear's inline field editing** — low-chrome editing, quiet Form Seam borders, no modal for a single field change
- **Basecamp 4's message composer** — warm-neutral surfaces, generous spacing, the sense of composing something intentional

## 4. Scope

Production-ready. Full extension of `/admin/emails` — tabs added, existing Reminders and Delivery log surfaces left cosmetically token-updated only. Template preview renders live server-side HTML in a sandboxed iframe. Inline edit with explicit save. Phase 6 implements; this brief specifies intent.

## 5. Layout Strategy

A **tab bar** sits below `AdminPageHeader` as the primary navigation unit. Three tabs: **Templates** (new) · **Reminders** (existing) · **Delivery log** (existing).

Within **Templates**, the layout is a **two-panel split**:

- **Left panel (~320px, fixed on desktop):** Template browser. Three collapsible accordion groups — Customer / Staff / Admin — each containing template cards. Each card: template name (Urbanist 500, title step) + trigger description (Work Sans 400, Soft Slate, body step) + last-sent timestamp if available (IBM Plex Mono, label step). Selecting a card loads the right panel; active card: `surface-selected` tint, 1px `border-default` on the full card border. A trailing Ghost "Send" button (Lucide `send`, 16px) on each card is visible at rest.

- **Right panel (remaining width):** Preview-and-edit surface. Top: sandboxed HTML preview rendered with realistic dummy data — never real client data. Below preview: `AdminPanel` titled "Editable fields" containing only the safe form fields for this template, each using standard DESIGN.md Input styling. Save: Primary "Save changes" (disabled at 60% opacity until a field changes); Soft Slate "Last saved {time}" alongside.

**Mobile (<768px):** Collapses to single column. Template browser becomes a collapsed accordion list; selected template preview and edit fields stack below. Preview iframe scales to viewport width. Primary action moves to `AdminMobileActionBar`.

## 6. Key States

| State | What the user sees |
|---|---|
| No template selected | Right panel: `EmptyState` — envelope illustration, "Select a template to preview", no CTA |
| Template loading | Right panel: `AdminSkeleton` bars at preview height + skeleton inputs below |
| Template ready | Live HTML preview (sandboxed) + editable fields panel |
| Field focused / unsaved changes | Focus Azure border on active input; Save button activates; "Unsaved changes" `text-muted` label appears |
| Saving | Primary button: 16px spinner, `aria-busy="true"`, text "Saving…"; inputs disabled |
| Saved | Button resets; "Saved just now" `text-muted` label; Sonner toast "Template updated." (4s) |
| Save error | Button re-enables; error Sonner toast (no auto-dismiss, Ghost "Retry"); `role="alert"` region below form |
| Read-only (Therapist / no edit permission) | Editable fields panel hidden; preview shown; `text-muted` notice: "You can view but not edit these templates. Contact the owner to make changes." |
| Manual send sheet open | `AdminSheet` from right: template name header, "Send to" email input, booking-context picker if required, Primary "Send now" + Secondary "Cancel" |
| Navigating away with unsaved changes | Confirmation: "You have unsaved changes. Leave without saving?" / Destructive "Leave" + Secondary "Keep editing" |

## 7. Interaction Model

**Browsing:** All three accordion groups open by default. Clicking a card selects it and loads the preview. Unsaved changes trigger the leave-confirmation. Keyboard: `↑`/`↓` within an open group; `Enter` selects; group header toggles on `Space`/`Enter`.

**Editing:** Inline — no modal. Editable fields panel sits below preview. Explicit "Save changes" — no autosave (prevents accidental edits for a novice owner). A Lucide `info` tooltip (14px) on the panel heading: *"These fields are safe to edit. Booking details, IDs, and participant data are generated automatically."*

**Manual send:** Ghost "Send" button visible at rest on each card (mobile and desktop — never hover-reveal). Opens `AdminSheet` from the right with a preview thumbnail, "Send to" input, runtime context fields, and Primary "Send now." Therapists see only this action; the edit panel is hidden for them.

**Tab switching:** Pill-style tabs matching the bookings `view` tab pattern (DESIGN.md Admin-Specific Patterns). Active: `action-primary` fill + Field White. Inactive: transparent + Practice Charcoal. State in Templates tab (selection, unsaved edits) persists across tab switches.

## 8. Content Requirements

**Tab labels:** Templates · Reminders · Delivery log

**Template card copy:**

| Card name | Trigger line |
|---|---|
| Booking confirmation | Sent when a booking request is submitted |
| Booking cancelled (client) | Sent when a booking is cancelled |
| Booking reminder | Sent manually from the Reminders tab |
| Plain-text companion | Paired with HTML emails as a plain-text fallback |
| Assignment notification | Sent when a therapist is assigned to a booking |
| Assignment updated | Sent when an assigned booking changes |
| New booking (internal) | Sent to the owner when a booking is submitted |
| Cancellation (internal) | Sent to the owner when a booking is cancelled |
| Reschedule request (internal) | Sent to the owner when a client requests a reschedule |

**Safe-edit fields by template:**

| Template | Editable fields |
|---|---|
| All | Footer contact line (sourced from `contactEmail` / `contactPhone` in settings) |
| All customer-facing | Greeting intro sentence (the "Hi {clientName}, …" opener before the booking summary) |
| Booking confirmation | Group-copy sentence ("This booking is for one participant" / group variant) |
| Booking reminder | Intro sentence |
| Assignment notification | Intro sentence |
| Assignment updated | Wrapper sentence around the `changeSummary` variable |

**Microcopy:**
- No template selected: "Select a template to preview"
- Editable fields tooltip: "These fields are safe to edit. Booking details, IDs, and participant data are generated automatically."
- Read-only notice: "You can view but not edit these templates. Contact the owner to make changes."
- Admin-template preview label: "Internal only — not seen by clients or therapists"
- Unsaved leave confirmation: "You have unsaved changes. Leave without saving?" / "Leave" (Destructive) + "Keep editing" (Secondary)

## 9. Recommended References

- `reference/interaction-design.md` — inline field editing, unsaved-changes confirmation, focus management in the manual-send `AdminSheet`
- `reference/spatial-design.md` — two-panel split, accordion group pattern, mobile single-column collapse
- `reference/motion-design.md` — `AdminSheet` slide-in (240ms ease-gentle), tab switch, preview skeleton

## 10. Open Questions

1. **Route.** Does this stay at `/admin/emails` (tabs) or move to `/admin/email-templates` with a dedicated nav entry? Tabs are lower friction; a dedicated route makes deep-linking to a specific template clean (`/admin/email-templates/booking-confirmation`). Recommendation: dedicated route, reachable from the owner_admin overflow nav.
2. **Editable field storage.** Safe-edit strings are currently hardcoded in `templates.ts` (SERVER ONLY). Phase 6 must decide: (a) new `email_template_overrides` table in Supabase (auditable per template, falls back to code defaults); or (b) extend `business_settings`. Recommendation: dedicated table.
3. **Preview rendering.** `templates.ts` is SERVER ONLY. Decide between a dedicated `/admin/email-templates/preview/[id]` route handler (clean) or a data URL (no extra route, but character-limit risk on large templates). Recommendation: dedicated route handler.
4. **Permission key.** `manage_settings` (Owner) gates edit access today. A new `manage_email_templates` key would let Admin/PM have edit access without full settings access. Recommendation: new key, granted to Owner + Admin/PM by default.
5. **Therapist manual-send scope.** Should therapists be able to send ANY template or only their audience's two (assignment notification, assignment updated)? Recommendation: restrict to staff-audience templates to prevent overreach.

---

## Audience variants

### Customer

**Tone:** Warm, reassuring, full Rahma brand voice. "Hi {clientName}, we have received your booking request." Culturally respectful — gender-match details stated plainly, not apologetically. Verbs over nouns; no jargon. The client is reading this on a phone, possibly while managing other things; the email should feel like a confident, friendly confirmation, not a form acknowledgement.

**Density:** Comfortable. One greeting sentence → appointment summary box → participant details → optional customer notes → optional manage link → footer contact. Nothing compressed. The appointment summary box is the primary scan target.

**Template-level decisions:** Greeting intro and footer contact line are the editable layer. The appointment summary block, participant breakdown, and manage-booking CTA are generated from booking data — never editable from the admin UI. `renderBookingPlainText` is a code-paired companion with no independent editable greeting; render it in the preview panel as a plain-text block (IBM Plex Mono, `surface-card` background) rather than an HTML iframe.

**Templates in this audience:**
1. `renderBookingConfirmationEmail` — Booking confirmation
2. `renderBookingCancellationEmail` — Booking cancelled (client)
3. `renderBookingReminderEmail` — Booking reminder
4. `renderBookingPlainText` — Plain-text companion

---

### Staff (therapist recipient)

**Tone:** Direct, professional, operational. The therapist reads this between visits on their phone. No marketing warmth; every sentence is functional. Compact opener — the booking summary is what they need, not a greeting. Participant gender requirements are stated without comment; they are a clinical fact, not an exception.

**Density:** Information-dense. The participant block is the primary scan target: date, time, address, participant count, required therapist gender, assigned services. Footer contact is secondary. There is no manage-booking link; therapists act through the admin panel.

**Template-level decisions:** The intro sentence is the editable layer for both templates. Participant block and all clinical data (gender requirements, services) are generated and never editable. `renderStaffBookingChangeEmail` exposes `changeSummary` as a runtime variable; the wrapper sentence around it is the editable surface, not the variable value itself.

**Templates in this audience:**
1. `renderStaffAssignmentEmail` — Assignment notification
2. `renderStaffBookingChangeEmail` — Assignment updated

---

### Admin internal

**Tone:** Terse, data-first, no warmth layer. The admin triages these in their email client, often scanning subject lines only. Headings double as the complete intent signal. Booking reference is the first data point — it is the cross-reference to the admin panel and must remain intact and unformatted.

**Density:** Maximum. Every available field is present: booking ID (always first), client email and phone in a tinted contact card, full participant breakdown including gender requirements, cancellation note if present, requested reschedule time if present. Nothing collapsed.

**Template-level decisions:** These have the least editable surface — headings and layout are fixed for scan-consistency. Footer contact line is the only editable field. `bookingId` may not be removed or reformatted. Each admin-template preview renders with a persistent `text-muted` banner: "Internal only — not seen by clients or therapists."

**Templates in this audience:**
1. `renderAdminBookingNotificationEmail` — New booking (internal)
2. `renderAdminBookingCancellationEmail` — Cancellation (internal)
3. `renderAdminRescheduleRequestEmail` — Reschedule request (internal)

---

## Recipe Context

### Files to edit

| File | What changes |
|---|---|
| `src/app/admin/emails/page.tsx` | Restructure into tabbed layout (Templates / Reminders / Delivery log); existing Reminders and Delivery log sections become tabs with token-only cosmetic updates |
| `src/app/admin/emails/components/` *(create)* | New component directory: `TemplateBrowser.tsx` (accordion groups + cards), `TemplatePreviewPanel.tsx` (iframe + editable fields), `TemplateEditForm.tsx` (safe-field inputs + save), `ManualSendSheet.tsx` (AdminSheet wrapper) |
| `src/app/admin/email-templates/preview/[id]/route.ts` *(create, if dedicated route chosen per Open Question 3)* | Server route handler: receives template id + dummy data, calls the relevant `render*Email()` function from `templates.ts`, returns HTML; used as iframe `src` |
| `src/app/admin/email-templates/actions.ts` *(create)* | New server actions file (separate from untouchable `emails/actions.ts`): `saveTemplateOverride(templateId, field, value)`, `sendTemplateManually(templateId, recipientEmail, contextData)` — writes to `email_template_overrides` table and `audit_logs` |
| `src/components/ui/` | shadcn primitives (Button, Input, Badge) receive token restyle from 00-shared-components brief; no email-specific changes needed |

### Files to NEVER touch

- `src/lib/email/templates.ts` — SERVER ONLY; read-only reference for rendering; editing strings here is exactly what the new override layer replaces
- `src/lib/email/**` — all Resend sender helpers
- `src/app/admin/emails/actions.ts` — `sendManualBookingReminder`; extend via a new actions file, never by editing this one
- `src/lib/auth/**`, `src/lib/supabase/**`, `src/middleware.ts` — standard untouchables (RECON §5)
- `supabase/migrations/**` — Phase 6 adds a new migration for `email_template_overrides`; never edits existing migrations
- All build/config files

### Feature Preservation Manifest

**Existing emails-page features that must survive the tab restructure:**
- `sendManualBookingReminder` server action wire-up — the Reminders tab is the existing manual-reminder queue; its `<form action={sendManualBookingReminder}>` and `booking_id` hidden field must stay intact
- Resend delivery log display — the Delivery log tab is the existing delivery-events list; all rendering logic preserved, token-updated only
- Form field `name` attributes on the reminder form (`booking_id`) — RECON §2

**New audit writes (Phase 6 must add):**
- `email_template_override_saved` — fires when an editable field is saved
- `email_template_sent_manually` — fires when a template is sent via the manual-send sheet
Both follow the existing `audit_logs` schema: `{ actor_staff_id, action_type, target_type: "email_template", target_id: templateId, before_state, after_state }`.

**`templates.ts` SERVER ONLY constraint:** The preview route handler must call `render*Email()` server-side only. No import of `templates.ts` from any Client Component.

### Information hierarchy (Templates tab, top to bottom)

1. Tab bar (Templates / Reminders / Delivery log)
2. Left panel — audience accordion groups → template cards (browse and select)
3. Right panel top — sandboxed HTML preview with dummy data (verify what is sent)
4. Right panel bottom — editable fields `AdminPanel` (correct copy if permitted)
5. Save / Send actions (contextual to selection and permission)

### Design direction — tokens and components

- **Tab bar:** View Tabs pattern from DESIGN.md Admin-Specific Patterns — `action-primary` fill + Field White on active; transparent + Practice Charcoal inactive; `aria-current="page"` on active
- **Template cards:** `AdminEntityRow` pattern from `admin-ui.tsx` — `surface-page` row background, `border-bottom: 1px border-subtle`, 44px min-height, `surface-hover` tint on hover
- **Active card:** `surface-selected` tint + 1px `border-default` full card border (NOT `border-l-4` — absolute ban)
- **Preview panel:** `AdminPanel` wrapper (`surface-card`, 8px radius, 1px `border-subtle`, no shadow at rest); iframe inside with `sandbox="allow-same-origin"` and pointer-events disabled
- **Editable fields:** DESIGN.md §5 Input spec — `surface-input` ground, `border-default` Form Seam, Focus Azure on focus, `role="alert"` error region
- **Manual send:** `AdminSheet` right-slide (240ms ease-gentle) — DESIGN.md §5 AdminSheet
- **Accordion groups:** Ghost toggle button (Lucide `chevron-down`/`chevron-right`, 16px) — Work Sans 600 at label step group label, `text-muted` count ("4 templates")
- **Admin-template banner:** `text-muted` Work Sans 400 label step, `surface-hover` background tint, full-width above iframe — "Internal only — not seen by clients or therapists"
- **Plain-text preview:** IBM Plex Mono 0.875rem, `surface-card` background, `border-subtle` border, `md` padding — not an iframe

---

## Implementation Notes

### Per-state intent

**Empty (no template selected)**
- Heading: "Select a template to preview" (Urbanist 600, title step, Practice Charcoal)
- Body: none
- Visual: `EmptyState` component with envelope SVG illustration (80–120px)
- CTA: none

**Loading (template selected, preview fetching)**
- Right panel: `AdminSkeleton` bars approximating iframe height (~400px on desktop) + 3 skeleton input rows below for editable fields
- Left panel card: selected state applied immediately (no skeleton on card itself)

**Error (preview failed to load)**
- Heading: "Couldn't load preview"
- Body: "Try selecting the template again."
- Action: Ghost "Retry" button — re-fetches the preview route
- Container: `<div role="alert" aria-live="polite" aria-atomic="true">` in Cancelled family colours, inside the right panel where the iframe would appear

**Error (save failed)**
- Sonner toast: Cancelled family, no auto-dismiss, Ghost "Retry" button
- Inline `<div role="alert" aria-live="polite" aria-atomic="true">` below the form with "Changes couldn't be saved. Try again."

**Permission denied (page-level)**
- `AdminAccessDenied` component (standard from 00-shared-components brief)
- Copy: "You don't have access to email templates. Contact the owner."
- CTA: Secondary "Back to dashboard"

**Read-only mode (can view, cannot edit — Therapist / lower-permission)**
- Editable fields `AdminPanel` hidden entirely
- `text-muted` notice above the preview: "You can view but not edit these templates. Contact the owner to make changes."
- Ghost "Send" button on cards remains active — manual send is the one permitted action

### Per-viewport intent

**Mobile (375px)**
- Tab bar: horizontal scroll strip (momentum scroll) — same pattern as bookings view tabs; never wraps or stacks
- Two-panel collapses to single column: accordion browser at top (full width), selected template preview below (iframe scales to `width: 100%`), editable fields below that
- Primary Save and Send actions move to `AdminMobileActionBar` (sticky bottom, `surface-card`, 1px `border-subtle` top)
- Ghost "Send" button on cards: visible at rest, 44px touch target (Lucide `send` icon + "Send" label, Work Sans 500)
- Accordion groups default to collapsed on mobile to avoid overwhelming the initial view (unlike desktop where all groups open by default)

**Tablet (768px)**
- Breakpoint shared with desktop: two-panel split activates at ≥768px
- Left panel narrows to 280px at 768px, expands toward 320px at wider viewports
- No distinct tablet-only layout

**Desktop (1440px)**
- Full two-panel split: 320px left browser panel (fixed, scrollable independently if templates list is tall), remaining width right preview-and-edit panel
- Tab bar sits below `AdminPageHeader`, above the split
- Save button and "Last saved" label: right-aligned within the editable fields `AdminPanel` header
- Accordion groups: all three open by default; group headers show template count in `text-muted` label step ("4 templates", "2 templates", "3 templates")
- Preview iframe: max-height 480px with internal scroll — shows the full email at desktop email-client width (~680px) scaled to fit the panel

### Verification steps

**Playwright (automated):**
- Tab switching: Templates → Reminders → Delivery log; state in Templates tab (selected card, unsaved field value) persists across tab switches and returns correctly
- Unsaved-changes guard: edit a field → click a different template card → confirm "Leave" fires; confirm "Keep editing" returns focus to the field
- Save flow: edit a field → click "Save changes" → POST fires to `saveTemplateOverride` action → success toast appears → "Saved just now" label updates
- Read-only mode: sign in as Therapist role → Templates tab shows accordion + cards + previews → editable fields panel absent → Ghost "Send" button present and active
- Manual send: click Ghost "Send" on any card → `AdminSheet` slides in from right → "Send to" input focusable → Primary "Send now" fires `sendTemplateManually` action
- Preview SERVER ONLY: confirm no import of `templates.ts` appears in any client component bundle (check network tab — template HTML arrives via the preview route, not inline)

**DevTools:**
- Preview iframe has `sandbox` attribute; no script execution inside preview frame
- Zero new console errors across all admin routes after the tab restructure
- `audit_logs` table receives `email_template_override_saved` row on save (Supabase table inspector)

**`/impeccable audit`:**
- Zero `border-l-4` on template cards or accordion group headers
- Active template card uses full `border-default` border, not a left-only accent
- Zero colour-only status signals on template state indicators

**`/impeccable critique`:**
- Heading hierarchy: page H1 (AdminPageHeader) → tab bar (not a heading) → group labels as `<h2>` inside the left panel → template card names as `<h3>` — no skips
- Every editable field has a visible `<label>` element
- Save error region has `role="alert" aria-live="polite" aria-atomic="true"`
- "Send" button accessible name includes template context ("Send booking confirmation", not just "Send")

---

## Copy

### Form labels

**Editable-fields panel (varies per template — labels for each safe field):**
- `Greeting intro sentence` (customer templates only). Placeholder `Hi {clientName}, we have received your booking request.` Helper `Variables in curly braces are filled automatically.`
- `Footer contact line` (all templates). Placeholder `Questions? Reply to this email or call {contactPhone}.` Helper `Sourced from your clinic settings — update there to change everywhere.`
- `Group-copy sentence` (booking confirmation only). Placeholder `This booking is for one participant.` / `This booking is for {participantCount} participants.`
- `Wrapper sentence around changes` (assignment-updated only). Placeholder `Here's what changed for the booking on {date}:`

**Manual send sheet:**
- `Send to *` (email input). Placeholder `recipient@example.com`. Helper `One address per send.`
- `Booking context` (select, when template needs booking data). Default option `Pick a booking`.
- Per-template context fields (e.g. `Customer name`, `Booking date`, `Therapist name`) — labelled per template, all required.

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Save edits | `Save changes` | Primary |
| Cancel edits inline | (no button — leaves on tab switch with confirm) | — |
| Manual send trigger (per card) | `Send` (with `send` icon) | Ghost |
| Manual send sheet submit | `Send now` | Primary |
| Manual send sheet cancel | `Cancel` | Secondary |
| Unsaved-changes — leave | `Leave` | Destructive |
| Unsaved-changes — stay | `Keep editing` | Secondary |
| Preview load retry | `Try again` | Ghost |
| Save failure retry | `Retry` | Ghost (toast) |
| Tab links | `Templates` / `Reminders` / `Delivery log` | Tab-pill |

### Error messages

- Field too long (over template max): `Trim this to {N} characters or fewer.`
- Curly-brace variable misspelled (e.g. `{ clientNam }` instead of `{clientName}`): `That variable isn't recognised — check spelling. Available: {list}.`
- HTML/script tags in a safe field: `Plain text only — HTML and script tags will be stripped.`
- Save server failure: `Changes couldn't be saved. Try again.`
- Manual send — invalid email: `That email doesn't look right. Use the format name@example.com.`
- Manual send — required context missing: `Pick a booking to fill in the booking details.`
- Manual send — send failure: `Couldn't send. Check the address, or try again shortly.`
- Preview load failure: `Couldn't load preview. Try selecting the template again.`
- Read-only user attempts edit (defensive — UI hides controls): `You can view but not edit these templates. Contact the owner.`

### Empty-state text

| Context | Heading | Body | CTA |
|---|---|---|---|
| No template selected | `Select a template to preview` | `Pick one from the list to see what gets sent.` | — |
| Preview failed | `Couldn't load preview` | `Try selecting the template again.` | `Try again` |
| Read-only notice (above preview) | — | `You can view but not edit these templates. Contact the owner to make changes.` (inline) | — |
| Admin-template internal banner (above preview) | — | `Internal only — not seen by clients or therapists.` (inline) | — |
| Denied (Therapist on page) | `You don't have access to email templates` | `Templates are managed by the owner and admin. Ask one of them.` | `Back to dashboard` |

### Tooltip text

- "Editable fields" panel info icon: `These fields are safe to edit. Booking details, IDs, and participant data are generated automatically.`
- Variable token in editor (e.g. `{clientName}`): native `title` — `Filled with the client's first name when the email is sent.` (Enhancement only; not visible on mobile. Template editing is a desktop-primary task, so this is acceptable here.)
- Per-template `Send` Ghost: `Send {template name}` (e.g. `Send booking confirmation`). The accessible name on the button already carries this context; the tooltip reinforces it for mouse users.
- Manual send sheet variable preview (in-context substitution): `Preview filled from the booking you picked.`
- "Last saved {time}": native `title` shows absolute time — `Saved 12 May 2026, 19:42 BST by Fatimah`.
- Accordion group counts: `{N} templates in this group`.
- Read-only state on editable panel: `Editing is restricted. Contact the owner.`

### Confirmation dialog text

**Leave with unsaved changes**
- Heading: `Leave without saving?`
- Body: `Your edits to "{template name}" will be lost.`
- Destructive: `Leave`
- Secondary: `Keep editing`

**Manual send — pre-send confirm (optional, for sensitive recipients e.g. admin internal templates)**
- Heading: `Send "{template name}" to {email}?`
- Body: `This sends the email immediately. It can't be unsent.`
- Primary: `Send now`
- Secondary: `Cancel`

**Toasts**
- Save success: `Template updated.`
- Save failure: `Changes couldn't be saved. Try again.` (persistent, Retry)
- Manual send success: `Sent "{template name}" to {email}.`
- Manual send failure: `Couldn't send. Try again.` (persistent, Retry)
