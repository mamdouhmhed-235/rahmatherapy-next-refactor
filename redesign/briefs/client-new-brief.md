# Shape Brief: `/admin/clients/new` redesign

**Date:** 2026-05-12
**Page slug:** `client-new`
**Status:** user-confirmed
**Brief number:** 23 of 29 (Phase 5)

## 1. Feature Summary

Single-page form for creating a CRM client profile without booking, surfaced when an operator wants a customer record ahead of a future visit (phone enquiry, walk-in inquiry, returning client whose record was never digitised). The form already does one thing well: duplicate detection (matching email or phone re-prompts with a confirm-checkbox). The redesign tightens the visual language, raises the duplicate warning to its proper status-family treatment, fixes the `backdrop-blur` glass-default ban on the sticky save bar, and clusters the eight fields into two intentionally-grouped panels rather than the current "one mega-card with a sub-section."

## 2. Primary User Action

**Create a client record fast, with email/phone collision caught before it lands in the database.** The page is reactive on the part of the operator (they came here from `/admin/clients` after `Cmd+F`-failing to find an existing match) and from the system on duplicates (the server replies with a duplicate warning and a required confirm-checkbox). Success: a saved client profile with redirect to `/admin/clients/<id>` so the operator can immediately add notes or book.

## 3. Design Direction

Calm clinic-intake form: two narrow panels, generous label/value rhythm, no decorative chrome. The current `backdrop-blur` sticky save bar (line 87) violates DESIGN.md's glass-default ban and reads as a borrowed SaaS reflex; replace with a flat sticky bar in `surface-card` carrying a 1px top border. The current duplicate warning uses raw `border-orange-200`/`bg-orange-50`/`text-orange-800` (token escapes flagged in BASELINE-CRITIQUE); promote to the Attention status family with proper icon + label + tint composition. The current error message uses raw `border-red-200`/`bg-red-50`/`text-red-600`; promote to Cancelled family. Form fields restyle to the DESIGN.md Input spec (Form Seam border at oklch 55%, not Warm Veil; RECON §8 already flags this page's inputs as below WCAG 1.4.11).

## 4. Scope

In:
- Re-cluster fields into two intentionally-named panels: **"Who they are"** (full_name, client_source, source_detail) and **"How to reach them"** (email, phone, address, postcode). Internal notes stay in its own third panel.
- Restyle every input to DESIGN.md Input spec (Form Seam border, Input Ground background, 6px radius, focus ring tokens). Drop the local `inputClass` constant.
- Required-field `*` markers in Cancelled text colour (DESIGN.md §5 Input spec; carry-forward fix from BASELINE-CRITIQUE P0).
- Per-field error wrapping in `role="alert" aria-live="polite" aria-atomic="true"` regions (currently `Field` renders error below as plain text; P0 a11y fix).
- Form-level error: promote from raw red tokens to a Cancelled-family banner with leading `x-circle` icon + Field White text label.
- Duplicate warning: promote from raw orange tokens to an Attention-family banner with leading `alert-circle` icon + visible "Possible duplicate" label + the existing prose + the existing required `confirm_duplicate` checkbox preserved verbatim (RECON §6.4).
- Source field: keep the seven-option select (matches the canonical source enum used across enquiries, bookings, and clients). Map each option to an icon prefix when rendering the chosen value back in subsequent client surfaces (decorative continuity, not on this form's input).
- Sticky save bar: flat `surface-card` with `border-subtle` top border, no `backdrop-blur`. Primary "Create client" + Ghost "Cancel" → `/admin/clients`.
- Mobile (≤md): the panel pair stacks; sticky save bar pinned to viewport bottom with full-width Primary; "Cancel" Ghost stays inline above the Primary, not in the sticky bar.
- Carry-forward soft fixes: raw `var(--rahma-*)` token escapes throughout, `bg-white` on panels (line 40, 81), raw `border-red-200`/`bg-red-50`/`text-red-600` (line 19), raw `border-orange-200`/`bg-orange-50`/`text-orange-800` (line 25), raw `backdrop-blur` on save bar (line 87), raw permission identifier on the denied screen (line 26).

Out (unchanged):
- `createClient` server action and its full form field contract (RECON §5 untouchable; §6.4 preserved field names: `full_name`, `client_source`, `email`, `phone`, `address`, `postcode`, `source_detail`, `notes`, `confirm_duplicate`).
- Duplicate detection rules (server-side; matches on lowercased email or normalised phone).
- The seven-option client_source enum.
- Server-side validation rules. Client-side is courtesy; server is truth.
- No address autocomplete / postcode lookup. UK postcode validation stays server-side only.
- No customer-facing copy; this is admin chrome.

## 5. Layout Strategy

Page chrome (top to bottom):
1. Breadcrumb link "← Clients" (Soft Slate label step) at top-left.
2. `AdminPageHeader`; title "Create client" / description "Create a CRM profile without booking. Duplicate email or phone matches are flagged before save."
3. Form region, single column, `max-w-[640px]` left-aligned (not centred; the form is the operator's working surface, not a marketing card; left-aligned matches the rest of the admin's data-density grammar).

**Form panels (top to bottom):**

**Panel 1; "Who they are"** (`AdminPanel`):
- H2 "Who they are" (Urbanist 600 heading step).
- Description (Soft Slate body step): "Their name and how this profile reached you."
- Fields (2-column grid on `md:`+, single column on mobile):
  - `full_name` (required, `*` marker, label "Full name").
  - `client_source` (required, label "Source"; select with the seven canonical options).
  - `source_detail` (full-width, optional, label "Source detail", placeholder "Referral name, campaign, or admin context").

**Panel 2; "How to reach them"** (`AdminPanel`):
- H2 "How to reach them" (Urbanist 600 heading step).
- Description (Soft Slate body step): "At least one of email or phone helps confirmations land."
- Fields (2-column grid on `md:`+):
  - `email` (optional but advised, type=email, label "Email", inline helper "Used for confirmations and reminders.").
  - `phone` (optional but advised, type=tel, label "Phone", inline helper "Used for WhatsApp and SMS.").
  - `address` (full-width, optional, label "Address").
  - `postcode` (label "Postcode", `max-w-[220px]` because it doesn't need full width).

**Panel 3; "Internal notes"** (`AdminPanel`):
- H2 "Internal notes" (Urbanist 600 heading step).
- Description (Soft Slate body step): "Visible to admin staff only. Don't include sensitive health information here; the client detail page has a dedicated health-notes surface."
- Field:
  - `notes` (Textarea, 5 rows, full-width, label hidden; "Internal client notes"; labelled via `aria-label` on the textarea since the panel title H2 carries the visible affordance).

**Banner positions (when relevant):**
- Form-level error banner: above Panel 1, Cancelled-family, leading `x-circle`, includes a Ghost "Dismiss" button only when the error is recoverable client-side.
- Duplicate warning: above Panel 1 (and above the error banner if both present), Attention-family, leading `alert-circle`, contains the warning prose + a required `confirm_duplicate` checkbox with label "Create a separate client profile anyway." Save Primary stays disabled until the checkbox is ticked.

**Sticky save bar:**
- Position: sticky at viewport bottom on mobile, in-flow above the form footer on `md:`+.
- Composition: `surface-card` background, 1px `border-subtle` top border, no `backdrop-blur`.
- Left: Ghost "Cancel" → `/admin/clients`. Right: Primary "Create client" with leading `Save` Lucide icon (replaced by 16px spinner when `aria-busy`).
- Mobile: the bar is full-width; Primary becomes a 48px-tall Primary, Ghost "Cancel" stacks above as a full-width Ghost inside the bar (not below the form).

**Mobile (≤md):**
- All panels collapse to single-column field layouts.
- Source-detail input stays full-width.
- Description copy on each panel wraps to 2 lines maximum.
- Sticky save bar pinned to viewport bottom with safe-area inset padding.

## 6. Key States

- **Default; empty form.**
- **Filling in.** No live validation chatter; required-field `*` markers stay visible.
- **Submitting.** Primary `aria-busy="true"`, spinner replaces Save icon, button label unchanged ("Create client"). All inputs preserve their values (server-action pattern; never wipe).
- **Validation error (field-level).** Per-field `role="alert"` region below the offending field, Cancelled text colour; field border shifts to Cancelled. Focus moves to the first invalid field on submit response.
- **Validation error (form-level).** Cancelled-family banner above Panel 1; field-level errors also render if present.
- **Duplicate warning.** Attention-family banner above the form; Primary disabled until `confirm_duplicate` checkbox is ticked. Banner copy: server-supplied prose naming the matched field. Checkbox label: "Create a separate client profile anyway."
- **Duplicate warning + checkbox ticked.** Primary re-enables.
- **Submission success.** Server-side redirect to `/admin/clients/<new_id>` with a Sonner Confirmed toast: "{full_name} added." (Toast renders on the client detail page, not this one.)
- **Submission failure (server error).** Cancelled-family banner above Panel 1, no auto-dismiss, with "Try again" Ghost. Sticky save bar stays interactive.
- **Cancel.** Ghost "Cancel" → `/admin/clients` (no confirmation prompt; form data is not persisted on cancel, by design; client creation is fast enough that re-entry is cheaper than a confirmation dialog).
- **Denied (Therapist or other no-permission).** `AdminAccessDenied` with plain-English copy; no raw permission identifier.

## 7. Interaction Model

- Form submission: `<form action={createClient}>` with `useActionState` preserved (current pattern). All field `name` attributes preserved verbatim (RECON §6.4).
- `confirm_duplicate` checkbox: rendered only when the server returns a `duplicateWarning` state; required; HTML-required attribute keeps the checkbox a hard gate even with JS off.
- Field-level error display: `state.fieldErrors?.<field>` rendered inside the field's `role="alert"` region.
- Source select: native `<select>` (no Combobox needed; seven enumerated options, no search burden).
- Source detail: optional follow-up to source; when source is "referral" or "other", an inline helper line nudges the operator to fill source_detail ("Who referred them?" / "Tell us where they came from"), but never enforces.
- Sticky save bar: pinned via CSS `position: sticky; bottom: 0;` on mobile; in-flow on desktop. Primary action is the form's submit button (Enter on any field submits the form natively).
- Cancel: anchor link, never a form button (avoids accidental dirty-state confirm dialog reflex).
- Keyboard: tab traverses fields in panel order; Enter submits; Escape on the duplicate warning checkbox unfocuses (does not auto-cancel; destructive interactions don't take an Escape).

## 8. Content Requirements

- Page title: "Create client".
- Page description: "Create a CRM profile without booking. Duplicate email or phone matches are flagged before save."
- Breadcrumb: "← Clients" linking to `/admin/clients`.
- Panel 1 title: "Who they are".
- Panel 1 description: "Their name and how this profile reached you."
- Panel 2 title: "How to reach them".
- Panel 2 description: "At least one of email or phone helps confirmations land."
- Panel 3 title: "Internal notes".
- Panel 3 description: "Visible to admin staff only. Don't include sensitive health information here; the client detail page has a dedicated health-notes surface."
- Email helper: "Used for confirmations and reminders."
- Phone helper: "Used for WhatsApp and SMS."
- Source-detail placeholder: "Referral name, campaign, or admin context".
- Source-detail conditional helpers: "Who referred them?" (when source=referral), "Where did they find out about us?" (when source=other).
- Duplicate warning title: "Possible duplicate client".
- Duplicate checkbox label: "Create a separate client profile anyway."
- Primary CTA: "Create client".
- Cancel: "Cancel".
- Submission success toast (renders on destination page): "{full_name} added."
- Submission failure banner: "Couldn't create client. {server message}" + Ghost "Try again".
- Denied state copy: "Client creation is restricted to staff with client management permission. Ask the owner if you need it." (no raw `manage_clients_all` identifier).

## 9. Recommended References

- Brief 05 (`clients`) → list-row paradigm; the breadcrumb destination uses Brief 05 chrome.
- Brief 03 (`booking-new`) → form-panel grouping pattern; the wizard-step panels are siblings of this single-page form.
- Brief 18 (`client-detail`) → destination after success; copy aligns ("notes are admin-only", "health context lives in its own panel").
- DESIGN.md §5 → Inputs and Fields (Form Seam border, required `*` marker, error region wrapping).
- DESIGN.md §2 → Status Families (Attention for duplicate, Cancelled for error).
- DESIGN.md §Admin-Specific Patterns → Status Communication (form-level error, action-blocking warning).
- BASELINE-CRITIQUE Sam #1/#3: required-field markers, form errors announced, input borders meeting WCAG 1.4.11; all resolve here.

## 10. Open Questions

1. **Per-panel descriptions vs. a single intro line.** Three panel descriptions adds 3 × ~12 words of chrome to a form whose operator scans, not reads. Proposal: keep them; they're short and they help a novice owner (PRODUCT.md Fatimah) on her phone understand what each panel asks for. Phase 6 A/B is overkill; commit.
2. **Phone-required vs. email-required.** Currently both are optional. The "at least one of email or phone" advisory copy is real, but the server enforces nothing. Proposal: keep both optional at the schema layer (some walk-ins genuinely give neither up front), but add a client-side soft warning when both are blank ("This client will have no contact channel. Save anyway?") on form submit. Defer to Phase 6 polish.
3. **Postcode lookup integration.** Not in scope (PRODUCT.md backend-issues-to-leave-alone implies no third-party address services). Flag for Phase 7 product question: do we want to integrate a postcode lookup (e.g. Ideal Postcodes) once the team grows past a manual-entry tolerance threshold?

## 11. Role variants

The page is gated by `canManageAllClients(profile)` (i.e. `manage_clients_all`). RBAC seed: Owner / Admin (Practice Manager) / Booking Coordinator hold this permission by default; Therapist does not.

### Owner

Full surface. All three panels visible. All fields editable. Duplicate warning and form-level error banner behave as specified.

### Admin (Practice Manager)

Identical to Owner. PM holds `manage_clients_all` and operates this form as a peer of the Owner.

### Booking Coordinator

Identical chrome to Owner. Coordinator's principal use case for this page: a phone enquiry where the customer doesn't yet have a booking. No copy adjustments; the form is role-agnostic in content.

### Therapist

Therapist lacks `manage_clients_all`. Collapse to the **Denied state**.

### Denied state

`AdminAccessDenied` invoked when `manage_clients_all` is not held:

- Title: "Client creation limited"
- Body: "Creating client records is restricted to admin staff with client management permission. Ask the owner if you need it."
- No raw `manage_clients_all` permission identifier on screen (current `page.tsx:26` leaks it; fix in Phase 6).
- Single Secondary "Back to dashboard" → `/admin/dashboard`. Tertiary Ghost "View clients" → `/admin/clients` (Therapists can view the directory; they just can't create entries).

---

## Recipe Context

- **RECON §2 inventory row:** Client new — `src/app/admin/clients/new/page.tsx` (+ `ClientCreateForm.tsx`) — `/admin/clients/new` — Create profile without booking; flags duplicates.
- **Access gate (RECON §3):** `canManageAllClients(profile)` (i.e. `manage_clients_all`). Owner / Admin/PM / Coordinator hold this; Therapist does not.
- **Untouchable backend (RECON §5):** `createClient` server action at `src/app/admin/clients/actions.ts` (DO-NOT-TOUCH per RECON §5 client list). Duplicate-detection rules server-side. Validation schema server-side.
- **Preserved IDs / form names (RECON §6.4):** `full_name`, `client_source`, `email`, `phone`, `address`, `postcode`, `source_detail`, `notes`, `confirm_duplicate` (conditional). `id="admin-main"` skip-link target preserved at layout level.
- **URL params (RECON §6.5):** None on this page.
- **Source enum (canonical):** website / phone / whatsapp / instagram / referral / manual / other; preserved verbatim, shared with `enquiries` and `bookings`.
- **BASELINE-CRITIQUE carry-forwards landing on this page:** Sam #3 input-border WCAG 1.4.11 risk (Warm Veil → Form Seam); P0 form-error not announced (current `Field` renders plain text → `role="alert" aria-live="polite" aria-atomic="true"`); P0 required-field `*` markers missing. Soft fixes (Phase 6 cleanup): raw `var(--rahma-*)` token escapes throughout; `bg-white` on panels at `page.tsx` lines 40 and 81; raw `border-red-200`/`bg-red-50`/`text-red-600` form-error at line 19; raw `border-orange-200`/`bg-orange-50`/`text-orange-800` duplicate warning at line 25; raw `backdrop-blur` glass-default on save bar at line 87 (absolute-ban adjacent); raw permission identifier on `AdminAccessDenied` at `page.tsx:26`.
- **IMAGES-NEEDED additions:** none; this page is fields-only.

## Implementation Notes

- Component layout and state coverage live in this brief's §5 (Layout Strategy) and §6 (Key States); Phase 6 implements directly from those.
- **Verification steps (Phase 6 / Phase 7):**
  - Form contract: every field `name` preserved verbatim; `createClient` server action signature unchanged; success redirects to `/admin/clients/<new_id>` with Sonner toast.
  - Duplicate path: server response sets `duplicateWarning`; banner renders Attention-family with leading `alert-circle` + visible label + checkbox; Primary disabled until checkbox ticked; on confirm + resubmit, server proceeds.
  - Validation paths: field-level errors render inside `role="alert" aria-live="polite" aria-atomic="true"`; focus jumps to first invalid field on response.
  - Required `*` markers visible on `full_name` and `client_source` in Cancelled text colour; readable by SR via `aria-hidden="true"` on the marker glyph.
  - Sticky save bar: no `backdrop-blur`; flat `surface-card` with `border-subtle` top; mobile pinned to viewport bottom with safe-area padding.
  - Role pass: Owner / Admin-PM / Coordinator render form; Therapist hits `AdminAccessDenied` with new copy and no raw permission identifier; tertiary "View clients" Ghost present.
  - A11y pass: `AdminAccessDenied` no longer renders `manage_clients_all`; input borders meet WCAG 1.4.11 (Form Seam oklch 55%); textarea labelled via `aria-label`; Tab order traverses fields in panel order.
  - Lighthouse / axe: no new violations vs. Phase 2 baseline.

---

## Copy

### Form labels

**Panel 1 — Who they are:**
- `full_name *` → label `Full name`. Placeholder `As they'd like it on their record`.
- `client_source *` → label `Source`. Select options: `Website`, `Phone`, `WhatsApp`, `Instagram`, `Referral`, `Manual`, `Other`. Default option: `Pick a source`.
- `source_detail` → label `Source detail` (full-width, optional). Placeholder `Referral name, campaign, or admin context`. Conditional helpers: `Who referred them?` (source=Referral) / `Where did they find out about us?` (source=Other).

**Panel 2 — How to reach them:**
- `email` → label `Email`. Placeholder `sara@example.com`. Helper `Used for confirmations and reminders.`
- `phone` → label `Phone`. Placeholder `07…`. Helper `Used for WhatsApp and SMS.`
- `address` → label `Address` (full-width). Placeholder `Street name and number, building or flat`.
- `postcode` → label `Postcode`. Placeholder `LU1 1AA`.

**Panel 3 — Internal notes:**
- `notes` → textarea, visible H2 carries the affordance; `aria-label="Internal client notes"`. Placeholder `Anything admin staff should know. Avoid clinical health context here.` 5 rows.

**Duplicate-warning panel:**
- `confirm_duplicate` (required when shown) → label `Create a separate client profile anyway.`

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Save | `Create client` | Primary |
| Cancel | `Cancel` | Ghost (anchor → `/admin/clients`) |
| Submission error retry | `Try again` | Ghost |
| Breadcrumb | `← Clients` | Ghost (anchor) |
| Denied CTA primary | `Back to dashboard` | Secondary |
| Denied CTA tertiary | `View clients` | Ghost |

### Error messages

- Full name empty: `Enter the client's full name.`
- Source not selected: `Pick where this client came from.`
- Email malformed: `Email needs an @ symbol (for example, sara@example.com).`
- Phone too short: `Phone number is too short. Include the area code.`
- Both email and phone empty (soft warning on submit): `This client has no email or phone on record. Save anyway?` — Primary `Save anyway`, Secondary `Add contact details`.
- Postcode malformed: `Postcode doesn't look right. Try the format LU1 1AA.`
- Notes contains "blood/medication/condition" keywords (soft hint): `Health notes belong on the client's detail page; they're treated more carefully there.` (Pending family hint, not a hard block.)
- Server: duplicate detected (Attention banner above panels): `Possible duplicate client: {field} matches an existing record for {existing client name}.`
- Server: generic failure: `Couldn't create client. Try again.`
- Confirm-duplicate unchecked on resubmit: `Tick the box above to create a separate profile anyway.`

### Empty-state text

This form has no empty states in the body — it's always in input mode. The Denied state covers absence:

| Context | Heading | Body | CTA |
|---|---|---|---|
| Therapist denied | `Client creation limited` | `Creating client records is restricted to admin staff with client management permission. Ask the owner if you need it.` | `Back to dashboard` + `View clients` |

### Tooltip text

- Required `*` marker: `aria-hidden`, but a nearby legend at the top of the form reads `* means required` (visible, label step, Soft Slate).
- Source select: option labels are self-explanatory; no `title` attributes. The conditional source-detail helper provides any needed disambiguation at the field below.
- Postcode field info icon (if rendered): `Used to set the service area, not for marketing.`
- Internal-notes panel description carries the warning inline (no tooltip needed): `Don't include sensitive health information here; the client detail page has a dedicated health-notes surface.`
- Duplicate warning matched-field hint: native `title` on the field name (e.g. `email`) — `This email matches {existing client name}`.

### Confirmation dialog text

**Soft "no contact channel" warning** (modal on submit, only when both email and phone empty):
- Heading: `No contact details yet`
- Body: `They won't receive confirmation or reminder emails. You can still add details later.`
- Primary: `Save anyway`
- Secondary: `Add contact details`

No other confirmations on this page. Cancel is a plain anchor link (no dirty-state prompt).

**Toasts**
- Success (renders on the destination `/admin/clients/{id}` page): `{full_name} added.`
- Server failure: persistent Cancelled toast `Couldn't create client. Try again.` with `Retry` Ghost.
- Duplicate detected (not a toast — see banner above).
