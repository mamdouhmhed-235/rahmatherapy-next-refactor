# Shape Brief: `/admin/settings` redesign

**Date:** 2026-05-12
**Page slug:** `settings`
**Status:** user-confirmed
**Brief number:** 25 of 29 (Phase 5)

## 1. Feature Summary

The Owner's clinic-policy workstation: one place to set company identity, booking-window mechanics, travel/notice buffers, customer cancellation cutoff, allowed service areas, and the master intake on/off switch that governs whether the customer-facing booking form will accept new requests at all. The redesign fixes the documented H1→H3 heading skip (Sam #1 / BASELINE-CRITIQUE), raises the intake toggle to a deliberate "kill switch" treatment proportional to its blast radius, and adds inline plain-English explanations of what each numeric setting actually does to a customer at the booking page.

## 2. Primary User Action

**Change one specific policy and save with confidence that the rest didn't drift.** Almost nobody opens this page to review everything; they come to flip intake off ("the team's away next week"), extend the booking window for a campaign, or add a service area for a new corner of Luton. The redesign optimises for "land on the section, change the value, save without scrolling past unrelated fields."

## 3. Design Direction

Quiet policy workstation. Single column, generous vertical rhythm, three named `AdminPanel`s instead of one mega-card with sub-sections. The intake-on/off control becomes its own panel at the top with a `Switch` and an explicit status-family banner reflecting current state (Confirmed when on, Restricted when off, no in-between). Numeric inputs gain plain-English helpers that translate "minimum_notice_hours" into "Customers can't book a slot starting in less than {n} hours." Allowed cities upgrades from a textarea-of-newlines into chip input + add field (still serialises to one-per-line for the server contract). Sticky save bar at the bottom of the form, never `backdrop-blur`.

## 4. Scope

In:
- Restructure into four panels (top-to-bottom): **Intake switch** (was the trailing checkbox, now leads); **Clinic identity** (company_name, contact_phone, contact_email); **Booking rules** (booking_window_days, minimum_notice_hours, buffer_time_mins, customer_cancellation_cutoff_hours); **Service areas** (allowed_cities chips).
- Replace shadcn `Card`/`CardTitle` with `AdminPanel`/`AdminPanelHeader` so panel titles render as H2 under the page H1 (resolves Sam #1 heading skip).
- Drop the inner `SettingsGroup` H3 wrapper; each former group becomes its own AdminPanel with H2 title.
- Restyle every input to DESIGN.md Input spec (Form Seam border replacing Warm Veil; addresses Sam #3 WCAG 1.4.11).
- Required-field `*` markers in Cancelled text colour on `company_name`, all four numeric fields (P0 carry-forward).
- Per-field error wrapping in `role="alert" aria-live="polite" aria-atomic="true"` regions (P0 carry-forward).
- Form-level error: promote from raw `border-red-200`/`bg-red-50`/`text-red-600` (line 67) to Cancelled-family banner with `x-circle` icon.
- Intake switch: replace the bare `<input type="checkbox" accent-...>` with the design-system `Switch`; surface the current state as a banner above the switch (Confirmed-family "Accepting new bookings" when on, Restricted-family "Intake paused" when off) so the operator sees the consequence before the input.
- Confirm-on-pause: flipping intake from on → off triggers `ConfirmActionModal` Cancelled family ("Pause new bookings? The customer-facing booking form will show a closed-for-intake message until you turn this back on.") Flipping off → on is one-click (resuming intake is non-destructive).
- Allowed cities: upgrade textarea → chip input. Each city renders as a `Restricted`-family chip with an `x` to remove; add field accepts a new city + Enter or comma submits. Behind the scenes serialises to one-per-line for the existing `allowed_cities` field name (RECON §6.4 preserved).
- Plain-English helpers under every numeric input (see §8 Content Requirements).
- Sticky save bar at form bottom: flat `surface-card`, no `backdrop-blur`. Primary "Save settings" + Ghost "Discard changes" (visible only when form is dirty).
- Carry-forward soft fixes: raw `var(--rahma-*)` token escapes, `bg-white/70` on inner panels, raw `text-red-600` on the form error + per-field error span (line 243), raw permission identifier on the denied screen.

Out (unchanged):
- `updateBusinessSettings` server action and its full form contract (RECON §5 untouchable; §6.4 preserved field names: `company_name`, `contact_phone`, `contact_email`, `booking_window_days`, `minimum_notice_hours`, `buffer_time_mins`, `customer_cancellation_cutoff_hours`, `allowed_cities`, `booking_status_enabled`).
- `business_settings.id = 1` singleton row contract.
- `fallbackSettings` shape for the first-load empty state.
- Validation rules (server-side authoritative).
- No new settings fields. Net-new policy controls (payment defaults, etc.) belong in a separate brief.

## 5. Layout Strategy

Page chrome (top to bottom):
1. `AdminPageHeader`; title "Settings" / description "Booking window, service areas, buffers, and the intake switch the customer-facing form reads."
2. **Panel 1; Intake switch** (`AdminPanel`):
   - H2 "Customer booking intake".
   - Description (Soft Slate): "When this is off, the public booking page shows a closed-for-intake notice and doesn't accept new requests. Existing bookings, reminders, and admin-side flows keep working."
   - State banner directly below: Confirmed-family pill "Accepting new bookings" with `check-circle` icon when on, Restricted-family pill "Intake paused" with `lock` icon when off. Full sentence in body text after the pill: "Customers can submit new bookings." / "The public booking page is closed."
   - Switch row: label "Accept new bookings" + Switch on the right + the inline helper sub-line "Last changed by {actor} on {timestamp}." (read from `audit_logs` if reachable; otherwise omitted).
3. **Panel 2; Clinic identity** (`AdminPanel`):
   - H2 "Clinic identity".
   - Description: "Shown to customers in emails and on the booking page footer."
   - Fields (2-column grid on `md:`+):
     - `company_name` (required, label "Clinic name", helper "Appears in confirmation emails as the sender name.").
     - `contact_phone` (optional, label "Contact phone", helper "Shown to customers in confirmation emails.").
     - `contact_email` (optional, type=email, label "Contact email", helper "Shown to customers as the reply-to address.").
4. **Panel 3; Booking rules** (`AdminPanel`):
   - H2 "Booking rules".
   - Description: "How far ahead customers can book, how soon, and the gap each therapist needs between visits."
   - Fields (2-column grid on `md:`+):
     - `booking_window_days` (required, number, min 1, label "Booking window", suffix "days", helper "Customers can book up to {n} days into the future.").
     - `minimum_notice_hours` (required, number, min 0, label "Minimum notice", suffix "hours", helper "Customers can't book a slot starting in less than {n} hours.").
     - `buffer_time_mins` (required, number, min 0, label "Travel buffer", suffix "minutes", helper "Each visit leaves {n} minutes of travel time after it for the therapist's next stop.").
     - `customer_cancellation_cutoff_hours` (required, number, min 0, label "Customer cancellation cutoff", suffix "hours", helper "Customers can self-cancel up to {n} hours before the visit starts. Closer cancellations need staff.").
5. **Panel 4; Service areas** (`AdminPanel`):
   - H2 "Service areas".
   - Description: "Cities and towns where the team will travel. Customers booking outside these areas see a helpful message instead of a closed door."
   - Field: chip input; current cities render as Restricted-family chips with `x`; an input below accepts new entries (Enter or comma adds; backspace on empty removes the last). Hidden `<input name="allowed_cities">` synchronised with the chips' joined value (newline-delimited) preserves the existing server contract.
   - Helper line: "{n} areas configured."

**Sticky save bar (form footer):**
- `surface-card` background, 1px `border-subtle` top, no `backdrop-blur`.
- Left: Ghost "Discard changes" (visible only when dirty; reverts the form to last-saved state, no full page reload).
- Right: Primary "Save settings" with `Save` Lucide leading icon (spinner when `aria-busy`).
- Mobile: pinned to viewport bottom with safe-area inset.

**Mobile (≤md):**
- All panels collapse to single-column field layouts.
- Numeric input + suffix becomes `flex-row` row with the suffix to the right of a narrower input.
- Chip input wraps; the add field becomes full-width.
- Sticky save bar full-width.

## 6. Key States

- **Default; populated.** All four panels rendered with current settings. Save bar idle.
- **Dirty.** Save bar's Discard Ghost appears; Primary stays the same. Any nav-away triggers a browser `beforeunload` confirm (this surface is a single mass-save form; losing changes silently is worse than a small interruption).
- **Loading initial.** `AdminSkeleton`: page header (instant), four panel headers + 3 field rows each.
- **Submitting.** Primary `aria-busy="true"`, spinner replaces Save icon. All inputs disabled.
- **Submission success.** Sonner Confirmed family toast: "Settings saved." Form returns to clean state; dirty flag clears. No navigation.
- **Validation error (field-level).** `role="alert"` region below the field; field border shifts to Cancelled; focus moves to the first invalid field on submit response.
- **Validation error (form-level).** Cancelled-family banner at the top of the form region (above Panel 1); persistent until next valid submit.
- **Intake toggle off → on.** One-click; toast Confirmed: "Intake reopened. The public booking page is accepting requests."
- **Intake toggle on → off.** `ConfirmActionModal` Cancelled family: "Pause new bookings? The public booking page will show a closed-for-intake notice until you turn this back on." Primary "Pause intake" (Destructive variant) / Secondary "Cancel". On confirm: switch flips, the banner above re-renders to Restricted-family "Intake paused", toast Confirmed (yes, Confirmed family; the *action succeeded*, even though its effect is restrictive): "Intake paused. Customer-facing booking page is now closed."
- **Intake currently off banner.** Restricted-family banner stays visible inside Panel 1 so the operator never accidentally forgets the clinic is closed for intake. Cross-references: the dashboard's Owner/Admin variant Brief 06 already surfaces an "Intake paused" attention chip; this panel is where it gets flipped.
- **Allowed cities empty.** Chip input renders an inline EmptyState style line: "No service areas yet. The booking form will currently turn every customer away. Add at least one city below." Not a full EmptyState component (that's overkill for one field), just an inline Attention-family one-liner above the chip input.
- **Last-changed sub-line.** Read from the most recent `audit_logs` row whose `target = business_settings.id = 1`; if no row, omit silently. Format: "Last changed by {actor display_name} on {date, time}."

## 7. Interaction Model

- Form submission: existing `useTransition` + `updateBusinessSettings` pattern preserved (note: `handleSubmit` currently uses `event.preventDefault()` + manual `FormData` + `startTransition` rather than `useActionState`; the redesign preserves this exactly; RECON §5 untouchable form-submit shape).
- Switch toggle: client-component intercept. On true → false transition, opens `ConfirmActionModal`; on confirm, submits the form with `booking_status_enabled=on` swapped to `off` and all other current field values intact (preserves any unsaved policy edits the operator made before flipping the switch; this is the right tradeoff because the switch's effect is loud; if the user wanted to discard pending edits first, they would have).
- Chip input: client component. Add: Enter or comma submits the input value, lowercased + trimmed, deduped against the existing chips. Remove: chip `x` button removes. Hidden `<input name="allowed_cities">` updates on every change with the chips joined by `\n`.
- Discard changes Ghost: client-side resets all fields to `defaultValue` props; doesn't hit the server; clears dirty flag.
- `beforeunload`: native `window` listener attached when dirty; detached when clean.
- Keyboard: tab traverses the four panels in document order; Enter inside any numeric or text field submits the form (matches the native behaviour). Switch responds to Space. Chip input's remove `x` buttons are reachable via Shift+Tab from the add field.
- Plain-English helpers update live as the operator types into a numeric input (helper text reads the current input value, not the persisted setting). Updates are bound to `onChange` on the input; pure visual feedback, never affects submit.

## 8. Content Requirements

- Page title: "Settings".
- Page description: "Booking window, service areas, buffers, and the intake switch the customer-facing form reads."
- Panel 1 title: "Customer booking intake".
- Panel 1 description: "When this is off, the public booking page shows a closed-for-intake notice and doesn't accept new requests. Existing bookings, reminders, and admin-side flows keep working."
- Panel 1 banner copy: "Accepting new bookings" (Confirmed family) / "Intake paused" (Restricted family) + sentence as in §5.
- Panel 1 switch label: "Accept new bookings".
- Panel 1 last-changed sub-line: "Last changed by {actor} on {date, time}." (omitted when no audit row).
- Confirm modal title: "Pause new bookings?"
- Confirm modal body: "The public booking page will show a closed-for-intake notice until you turn this back on. Existing bookings, reminders, and admin work continue."
- Confirm modal Primary: "Pause intake" (Destructive variant).
- Toast (resume): "Intake reopened. The public booking page is accepting requests."
- Toast (pause confirmed): "Intake paused. Customer-facing booking page is now closed."
- Panel 2 title: "Clinic identity".
- Panel 2 description: "Shown to customers in emails and on the booking page footer."
- Field helpers:
  - `company_name`: "Appears in confirmation emails as the sender name."
  - `contact_phone`: "Shown to customers in confirmation emails."
  - `contact_email`: "Shown to customers as the reply-to address."
- Panel 3 title: "Booking rules".
- Panel 3 description: "How far ahead customers can book, how soon, and the gap each therapist needs between visits."
- Numeric field helpers (live-bound):
  - `booking_window_days`: "Customers can book up to {n} days into the future."
  - `minimum_notice_hours`: "Customers can't book a slot starting in less than {n} hours."
  - `buffer_time_mins`: "Each visit leaves {n} minutes of travel time after it for the therapist's next stop."
  - `customer_cancellation_cutoff_hours`: "Customers can self-cancel up to {n} hours before the visit starts. Closer cancellations need staff."
- Panel 4 title: "Service areas".
- Panel 4 description: "Cities and towns where the team will travel. Customers booking outside these areas see a helpful message instead of a closed door."
- Panel 4 chip-input placeholder: "Add a city or town and press Enter".
- Panel 4 helper: "{n} areas configured."
- Panel 4 empty state inline: "No service areas yet. The booking form will currently turn every customer away. Add at least one city below."
- Primary CTA: "Save settings".
- Discard Ghost: "Discard changes".
- Submission success toast: "Settings saved."
- Submission failure banner: "Couldn't save settings. {server message}."
- Beforeunload prompt (browser-native; can't fully customise): default UA message.
- Denied state copy: "Settings are restricted to the practice owner. Ask the owner if you need a policy changed." (no raw `manage_settings` identifier).

## 9. Recommended References

- Brief 01 (`00-shared-components`) → `AdminPanel`, `ConfirmActionModal`, status family vocabulary, `Switch`.
- Brief 13 (`availability`) → inline-form treatment that this page now mirrors (no Card wrappers; AdminPanel with H2 titles).
- Brief 23 (`client-new`) → form-error banner promotion to Cancelled family; sticky save bar without `backdrop-blur`; chip-input pattern reference (service areas).
- Brief 17 (`operations`) → `ConfirmActionModal` wire-up pattern.
- Brief 06 (`dashboard-owner-admin`) → cross-reference: dashboard surfaces an "Intake paused" attention chip that links here.
- DESIGN.md §5 → Inputs and Fields (Form Seam border, error region, required marker).
- DESIGN.md §Admin-Specific Patterns → Status Communication (form-level error, confirmation destructive).
- BASELINE-CRITIQUE Sam #1 (heading skip on this page): shadcn `CardTitle` H3 → `AdminPanel`/`AdminPanelHeader` H2 resolves it.

## 10. Open Questions

1. **`beforeunload` on dirty.** The native browser prompt is ugly but the data-loss cost on a mass-save form is real. Proposal: keep it; one ugly prompt < a silent loss of three minutes of typing. Phase 6 polish may add an in-app confirm if `beforeunload` proves unpopular.
2. **Audit-log read for "Last changed by" sub-line.** Pulls a row from `audit_logs` on every settings page load. Cost: one extra query, indexed. Worth it? Proposal: yes; the page is rarely loaded (Owner-only, low traffic) and the operator's "did I change this?" question is the second-most-common reason to open it after "I need to change this." If query latency proves measurable, cache the most recent settings audit row in a tiny materialised view.
3. **Chip-input UX on iOS.** Comma as a submit key is fine on iOS hardware keyboards; on the soft keyboard it's the long-press path. Proposal: Enter as primary, comma as secondary, plus a small "Add" Ghost button beside the input on mobile only; operator can tap to add without reaching for Enter on the soft keyboard.

## 11. Role variants

The page is gated by `PERMISSIONS.MANAGE_SETTINGS` (Owner-only per the RBAC seed; RECON §3 confirms). Per recipe instruction "for pages only one role can reach, collapse to that role plus the Denied state."

### Owner

Full surface. All four panels visible and editable. Intake toggle wired through `ConfirmActionModal` on the destructive direction (on → off). All numeric helpers live-update with the current input value.

### Denied state

Admin (Practice Manager), Booking Coordinator, Therapist, and Inactive all hit `AdminAccessDenied`:

- Title: "Settings access limited"
- Body: "Settings are restricted to the practice owner. Ask the owner if you need a policy changed."
- No raw `manage_settings` permission identifier on screen (current `page.tsx:36` leaks it; fix in Phase 6).
- Single Secondary "Back to dashboard" → `/admin/dashboard`.

(Identical denied copy treatment to other Owner-only pages; Brief 11 `audit`, Brief 20 `roles`, Brief 22 `role-detail`, Brief 24 `services`; so the operator's denied experience is uniform regardless of which restricted surface they reach.)

---

## Recipe Context

- **RECON §2 inventory row:** Settings — `src/app/admin/settings/page.tsx` (+ `SettingsForm.tsx`) — `/admin/settings` — Booking window, buffers, notice, cancellation cutoff, allowed cities, intake on/off. Note: shadcn `CardTitle` renders as `<h3>` (RECON §8 confirmed H2 heading skip).
- **Access gate (RECON §3):** `profile.permissions.has(PERMISSIONS.MANAGE_SETTINGS)` (Owner-exclusive). Single-role page. Collapses to Owner + Denied per recipe.
- **Untouchable backend (RECON §5):** `updateBusinessSettings` server action at `src/app/admin/settings/actions.ts` (explicit DO-NOT-TOUCH). `business_settings.id = 1` singleton row contract preserved.
- **Preserved IDs / form names (RECON §6.4):** `company_name`, `contact_phone`, `contact_email`, `booking_window_days`, `minimum_notice_hours`, `buffer_time_mins`, `customer_cancellation_cutoff_hours`, `allowed_cities`, `booking_status_enabled`; all preserved verbatim. `allowed_cities` continues to serialise as newline-delimited via a hidden input behind the chip UI. `id="admin-main"` skip-link target preserved at layout level.
- **URL params (RECON §6.5):** None currently. Redesign adds none.
- **BASELINE-CRITIQUE carry-forwards landing on this page:** Sam #1 heading skip (`/admin/settings` explicitly named in RECON §8 line 365 — shadcn `CardTitle` H3 inside an H1 page). Soft fixes (Phase 6 cleanup): raw `var(--rahma-*)` token escapes throughout; `bg-white/70` on inner `SettingsGroup` panels at `SettingsForm.tsx:219`; raw `border-red-200`/`bg-red-50`/`text-red-600` form-error at line 67; raw `text-red-600` per-field error at line 243; raw `text-[var(--rahma-green)]` decorative icon at line 61; bare `<input type="checkbox" accent-...>` intake toggle at line 184 → design-system `Switch`; raw permission identifier on `AdminAccessDenied` at `page.tsx:36`.
- **IMAGES-NEEDED additions:** none; this page is fields-only.

## Implementation Notes

- Component layout and state coverage live in this brief's §5 (Layout Strategy) and §6 (Key States); Phase 6 implements directly from those.
- **Verification steps (Phase 6 / Phase 7):**
  - Heading hierarchy: page H1 followed by four H2 panel headings (Customer booking intake / Clinic identity / Booking rules / Service areas) contiguous; screen-reader heading nav traverses cleanly with no H3 skip.
  - Form contract: every field `name` preserved verbatim; `updateBusinessSettings` server action signature unchanged; success toast renders without page reload.
  - Intake confirm path: switch on → off opens `ConfirmActionModal` Cancelled family with Destructive Primary; cancel leaves state unchanged; confirm submits form and banner swaps to Restricted "Intake paused".
  - Intake resume path: switch off → on one-click; Confirmed toast.
  - Chip input: Enter adds; comma adds; backspace on empty removes last; hidden `allowed_cities` value reflects current chips joined by `\n` on every change.
  - Numeric helper live-binding: typing into a number input updates the helper text within the same tick; helper accepts current input value, not persisted value.
  - Dirty state: edits surface "Discard changes" Ghost; `beforeunload` fires on nav-away; "Save settings" returns the form to clean state and removes the `beforeunload` listener.
  - Role pass: Owner sees full surface; Admin/PM, Coordinator, Therapist, Inactive all hit `AdminAccessDenied` with new copy and no raw permission identifier.
  - A11y pass: `AdminAccessDenied` no longer renders `manage_settings`; Switch responds to Space and announces on/off state; required `*` markers `aria-hidden="true"`; per-field errors in `role="alert" aria-live="polite" aria-atomic="true"`; input borders meet WCAG 1.4.11 (Form Seam oklch 55%).
  - Lighthouse / axe: no new violations vs. Phase 2 baseline.

---

## Copy

Voice: calm, plain, direct, kind. Verbs over nouns. Policy fields paired with plain-English consequence helpers. Encouraging empty states; specific errors; no raw permission names or raw DB column names in user copy.

### Form labels

**Panel 1 — Customer booking intake:**
- `Accept new bookings` (`name="booking_status_enabled"`, Switch). Helper `Last changed by {actor} on {date, time}.` (when audit row available)

**Panel 2 — Clinic identity:**
- `Clinic name *` (`name="company_name"`) — placeholder `Rahma Therapy`. Helper `Appears in confirmation emails as the sender name.`
- `Contact phone` (`name="contact_phone"`) — placeholder `01582 …`. Helper `Shown to customers in confirmation emails.`
- `Contact email` (`name="contact_email"`, type `email`) — placeholder `hello@rahmatherapy.com`. Helper `Shown to customers as the reply-to address.`

**Panel 3 — Booking rules (each numeric input has a suffix and a live-bound helper):**
- `Booking window *` (`name="booking_window_days"`, suffix `days`). Helper `Customers can book up to {n} days into the future.`
- `Minimum notice *` (`name="minimum_notice_hours"`, suffix `hours`). Helper `Customers can't book a slot starting in less than {n} hours.`
- `Travel buffer *` (`name="buffer_time_mins"`, suffix `minutes`). Helper `Each visit leaves {n} minutes of travel time after it for the therapist's next stop.`
- `Customer cancellation cutoff *` (`name="customer_cancellation_cutoff_hours"`, suffix `hours`). Helper `Customers can self-cancel up to {n} hours before the visit starts. Closer cancellations need staff.`

**Panel 4 — Service areas:**
- Chip input — visible label `Service areas`; placeholder `Add a city or town and press Enter`. Helper `{N} areas configured.` Hidden `<input name="allowed_cities">` synchronised newline-delimited.

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Save | `Save settings` | Primary (sticky save bar) |
| Discard | `Discard changes` | Ghost (visible only when dirty) |
| Mobile chip-input add (iOS soft-keyboard helper) | `Add` | Ghost (inline beside the input) |
| Pause-intake modal confirm | `Pause intake` | Destructive |
| Pause-intake modal cancel | `Cancel` | Secondary |
| Denied CTA | `Back to dashboard` | Secondary |

### Error messages

- `company_name` empty: `Add a clinic name. It appears in confirmation emails.`
- `contact_email` malformed: `Email needs an @ symbol. For example: hello@rahmatherapy.com.`
- `contact_phone` too short: `Phone number is too short. Include the area code.`
- `booking_window_days` empty / non-numeric: `Booking window must be a number of days.`
- `booking_window_days` < 1: `Booking window has to be at least 1 day.`
- `booking_window_days` > 365: `Booking window over a year doesn't look right. Double-check.`
- `minimum_notice_hours` < 0: `Minimum notice can't be negative.`
- `minimum_notice_hours` > 168: `Minimum notice over a week doesn't look right. Double-check.`
- `buffer_time_mins` < 0: `Travel buffer can't be negative.`
- `buffer_time_mins` > 240: `Travel buffer over 4 hours doesn't look right. Double-check.`
- `customer_cancellation_cutoff_hours` < 0: `Cancellation cutoff can't be negative.`
- `allowed_cities` empty on save: `Add at least one service area. Without one, no bookings will go through.`
- Save failure: `Couldn't save settings. Try again.` (form-level banner, Cancelled family)
- Concurrent edit (someone else just saved): `Someone else just updated the settings. Refresh to see the latest before saving.`

### Empty-state text

| Context | Heading | Body | CTA |
|---|---|---|---|
| Service areas empty (inline above chip input) | (no heading) | `No service areas yet. The booking form will currently turn every customer away. Add at least one city below.` (Attention family) | — |
| Intake currently off banner (Panel 1) | (no heading) | `Intake paused. The public booking page is closed. Existing bookings, reminders, and admin work continue.` | (the Switch itself is the CTA) |
| Denied | `Settings access limited` | `Settings are restricted to the practice owner. Ask the owner if you need a policy changed.` | `Back to dashboard` |

### Tooltip text

- Intake state banner (on): native `title` — `Customers can submit new bookings via the public site.`
- Intake state banner (off): `Public site shows a closed-for-intake message until intake is resumed.`
- Switch (on→off pending modal): `Flipping this off pauses public bookings.`
- "Last changed by …" sub-line: native `title` shows absolute time.
- Required `*` markers: `aria-hidden`; legend at form top reads `* means required`.
- Each numeric input's suffix: native `title` repeats the helper meaning.
- Service-area chip `x`: `Remove {city}`.
- Service-area chip itself: `Service area. Customers within this area can book.`
- "Save settings" Primary (when dirty): native `title` — `Save changes to settings`.
- "Discard changes" Ghost: `Revert all fields to their last-saved values`.

### Confirmation dialog text

**Pause intake** (only fires on Switch on → off transition)
- Heading: `Pause new bookings?`
- Body: `The public booking page will show a closed-for-intake notice until you turn this back on. Existing bookings, reminders, and admin work continue.`
- Destructive: `Pause intake`
- Secondary: `Cancel`

**Beforeunload (native browser prompt)** — fires when dirty and the operator tries to navigate away. The native UA message is not customisable; the listener is attached when dirty and detached on successful save or discard.

No confirmation on Switch off → on (resume) — that's non-destructive.

**Toasts**
- Save success: `Settings saved.`
- Intake resume success: `Intake reopened. The public booking page is accepting requests.`
- Intake pause confirmed: `Intake paused. Customer-facing booking page is now closed.`
- Save failure: `Couldn't save settings. Try again.` (persistent, Retry)
- Discard success: no toast — the form reset is the feedback.
