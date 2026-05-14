# Brief: booking-detail

## 1. Feature Summary

The booking detail page is the operational command centre for a single booking — the surface where coordinators confirm, assign, update payment, capture notes, and trace the full event history of a booking's life. It is a two-column layout on desktop (management content left, key reference sidebar right) that collapses to a single prioritised stack on mobile with a fixed two-action sticky bar. The management form is split into two sections with independent saves: "Status & payment" and "Notes." The page is permission-scoped: Owner/Admin/Coordinator see the full surface; Therapists see a narrowed view of their own assigned or claimable bookings.

## 2. Primary User Action

**Understand the booking's current state, take the one action it needs right now (confirm, assign, mark paid), and leave with confidence — without hunting through eight sections.**

## 3. Design Direction

**Colour strategy:** Full palette. The booking detail surfaces status badges across every family — a pending booking shows Pending, its assignment shows Attention (unassigned), payment shows Restricted (outstanding) — all on one screen. The full palette is earned here.

**Theme scene sentence:** *"A Booking Coordinator at her desk, laptop open, reviewing a pending booking that came in overnight — she's checking the participant gender requirements, confirming the right therapist is free, and updating the payment note after taking a cash call."* The scene forces light mode (locked), desktop-primary, focused task mode with no ambient distractions.

**Anchor references:**
- **Linear's issue detail** — two-column, management form left, reference sidebar right; the sidebar persists while the user scrolls the main content
- **Stripe's charge detail** — sidebar with key amounts and status badges instantly visible; activity timeline as a read-only audit trail below
- **GitHub's PR detail** — layout model: main thread of actions and timeline + sidebar of metadata and links

## 4. Scope

Production-ready. Two-column desktop layout; single-column mobile with fixed sticky bar; split form sections with separate saves; gender-match chips on every participant; client back-link added (BASELINE-CRITIQUE fix); `ConfirmActionModal` on Cancel booking. Phase 6 implements.

## 5. Layout Strategy

**Desktop (≥768px) — two-column:**

**Main column (left, ~60%):**

1. **Status & payment** (`AdminPanel`, H2) — current status badge + status select, payment status select, payment method select, amount paid input, payment note textarea. Quick-action Ghost buttons (Confirm / Mark paid / Cancel / Complete) visible at rest above the form fields. "Save status & payment" Primary at the bottom of the panel. `ConfirmActionModal` on Cancel.
2. **Participants** (`AdminPanel`, H2) — `ParticipantBreakdown`: if `booking.group_booking = true`, the panel header carries a Restricted-family "Group · {N} people" chip alongside the H2. Each participant as an `AdminEntityRow` showing: label (Urbanist 500), client gender (Pending-family chip), "Same-gender required" Restricted-family chip (always visible when `required_therapist_gender` matches `participant_gender`, never colour-only), and services for that participant. Group bookings created via override show an additional Attention-family "Unassigned" chip on each participant row until a therapist claims their assignment.
3. **Assignment** (`AdminPanel`, H2) — `AssignmentManager` (full scope: therapist avatar + name + status badge, Reassign + Remove) or `ClaimAssignmentButton` (claimable Therapist scope). "Unassigned" Attention-family badge when no therapist is assigned.
4. **Notes** (`AdminPanel`, H2) — three labelled textareas: Treatment notes, Admin notes (hidden from Therapist), Customer notes. "Save notes" Primary at the bottom.
5. **Email activity** (`AdminPanel`, H2) — `EmailDeliveryStatus`: each email as an `AdminEntityRow` with template name, recipient, sent timestamp (IBM Plex Mono), delivery status badge.
6. **Activity** (`AdminPanel`, H2) — `ActivityTimeline`: chronological audit events. Each: actor avatar + action description + timestamp (IBM Plex Mono). Read-only.

**Sidebar (right, ~40%, sticky):**

1. **Booking summary** (`AdminPanel`, no heading) — booking reference (IBM Plex Mono, prominent) + current status badge + service name + formatted date/time + total amount (Cormorant Garamond numeral).
2. **Client** (`AdminPanel`, no heading) — client avatar (32px) + name (Urbanist 600, title step) + phone + email + Ghost "View client profile" link → `/admin/clients/{clientId}` (fixes BASELINE-CRITIQUE missing back-link).
3. **Address** (`AdminPanel`, no heading) — formatted address (`AdminDescriptionList`) + Primary "View on Maps" → Google Maps deep-link.

**Mobile (<768px) — single column:**

Section order: Booking summary (compact) → Status & payment → Participants → Assignment → Client card → Notes → Address card → Email activity → Activity timeline.

**Fixed `AdminMobileActionBar`** (always at viewport bottom):
- Left: Secondary "Save notes"
- Right: Primary "Save status & payment"

Quick actions (Confirm, Mark paid, Cancel, Complete) accessible via Ghost `more-horizontal` AdminActionMenu in the Status & payment section header — near the top of the mobile stack.

## 6. Key States

| State | What the user sees |
|---|---|
| Default — pending, unassigned | Pending status badge; Attention "Unassigned" assignment badge; "Confirm" quick action prominent |
| Confirmed, assigned | Confirmed status badge; therapist avatar + name in assignment; "Mark paid" prominent |
| Saving status & payment | "Save status & payment": spinner, `aria-busy="true"`, inputs disabled |
| Saved status & payment | Toast "Booking updated." (Confirmed, 4s); sidebar status badge refreshes |
| Saving notes | "Save notes": spinner, `aria-busy="true"`, textareas disabled |
| Saved notes | Toast "Notes saved." (Confirmed, 4s) |
| Cancel (quick action) | `ConfirmActionModal`: "Cancel this booking?" / "The client will be notified. This can't be undone from the booking page — restore it from the audit log if needed." / Destructive "Cancel booking" + Secondary "Keep it" |
| Claim assignment (Therapist) | `ClaimAssignmentButton` → optimistic "Claimed" state instantly → server confirmation or rollback |
| Own assignment status update | Ghost "Mark complete" / "Mark as no-show" buttons in Assignment section |
| Booking not found | `EmptyState`: "Booking not found" / "This booking may have been deleted or you don't have access." / Secondary "Back to bookings" → `/admin/bookings` |
| Permission denied | `AdminAccessDenied` |

## 7. Interaction Model

**Quick actions:** Confirm / Mark paid / Cancel / Complete Ghost buttons above the status form fields, visible at rest. Cancel triggers `ConfirmActionModal`. All others fire `quickUpdateBooking` directly with Sonner success toast.

**Split form saves:** "Save status & payment" submits status/payment fields via `updateBookingManagement` with `booking_id` hidden. "Save notes" submits note fields via the same action with a different field subset. Both save buttons activate from 60% opacity to full when any field in that section changes.

**Assignment — Reassign:** Opens `AdminActionMenu` (desktop) or `AdminSheet` from bottom (mobile) with scoped staff list. Fires `updateBookingAssignment`.

**Claim assignment:** `claimBookingAssignment` with optimistic UI — instant "Claimed" state, server rollback on error with Sonner error toast. Addresses BASELINE-CRITIQUE double-tap risk on flaky mobile connections.

**Back navigation:** Breadcrumb "Bookings → {reference}" in `AdminPageHeader` → `/admin/bookings`. "View client profile" Ghost link in sidebar → `/admin/clients/{clientId}`.

## 8. Content Requirements

**Page H1:** Booking reference (IBM Plex Mono, display step — the reference number is the title)

**Section H2s:** "Status & payment" / "Participants" / "Assignment" / "Notes" / "Email activity" / "Activity"

**Quick action labels:** Confirm · Mark paid · Cancel booking · Complete

**Form field labels:** Status / Payment status / Payment method / Amount paid / Payment note / Treatment notes / Admin notes / Customer notes

**Gender-match chip:** "Same-gender required" (Restricted family)

**Assignment states:** "Unassigned" (Attention family) / therapist name + assignment status badge

**Save buttons:** "Save status & payment" (Primary) / "Save notes" (Primary)

**Cancel modal:** "Cancel this booking?" / "The client will be notified. This can't be undone from the booking page — restore it from the audit log if needed." / Destructive "Cancel booking" + Secondary "Keep it"

**Client card link:** "View client profile" (Ghost)

**Address card button:** "View on Maps" (Primary → Google Maps deep-link)

**Booking not found:** "Booking not found" / "This booking may have been deleted or you don't have access." / Secondary "Back to bookings"

**Therapist assignment CTAs:** "Mark complete" / "Mark as no-show" (Ghost buttons)

## 9. Recommended References

- `reference/interaction-design.md` — split form saves, unsaved-state signalling, `ConfirmActionModal` for cancel, optimistic claim, `AdminActionMenu`/`AdminSheet` for reassign
- `reference/spatial-design.md` — two-column sticky sidebar, mobile section order, `AdminMobileActionBar` fixed positioning
- `reference/motion-design.md` — optimistic claim UI, spinner loading states

## 10. Open Questions

1. **Claim optimistic UI rollback.** On server error after optimistic claim, the button reverts to "Claim this booking" and a Sonner error toast appears. Confirm the `claimBookingAssignment` server action returns a typed error that the client component can catch for rollback.
2. **Reassign staff picker scope.** The staff list in the Reassign picker — does it show all active staff, or only same-gender-eligible therapists for this booking's participants? Recommendation: filter to gender-eligible by default, with a "Show all staff" Ghost toggle for edge cases.
3. **`updateBookingManagement` field split.** The current single action accepts all 8 fields. Phase 6 may call it twice (once for status/payment, once for notes) or split into two actions. Either works — confirm the server action handles partial field submission without nulling unsubmitted fields.

---

## Role variants

### Owner

**Visible:** All six main sections. Full sidebar including "View client profile" link. All quick actions (Confirm, Mark paid, Cancel, Complete). All three note fields including Admin notes. Full `AssignmentManager`. Full Activity timeline. Both save buttons.

**Hidden:** Nothing.

---

### Admin (Practice Manager)

**Visible:** Identical to Owner — all sections, all actions, all fields.

**Hidden:** Nothing.

**Role-specific notes:** No UI differences from Owner on this page.

---

### Booking Coordinator

**Visible:** All sections and fields. Status & payment (all fields including payment amount and payment note), Participants, Assignment (full `AssignmentManager`), Notes (all three fields including Admin notes), Email activity, Activity timeline. Full sidebar. All quick actions. Both save buttons.

**Hidden:** Nothing confirmed hidden. Coordinators handle payment recording and operational context in admin notes.

**Role-specific notes:** No visible UI differences from Owner/Admin on this page.

---

### Therapist

**Visible:** Scoped view. Participants section (full participant detail including gender-match chips — clinical requirement). Assignment section (own assignment status with "Mark complete" + "Mark as no-show" Ghost buttons; `ClaimAssignmentButton` for claimable bookings). Notes section (Treatment notes + Customer notes only). Compact sidebar: booking summary (date/time/service, total amount hidden) + address card with "View on Maps". Mobile sticky bar: single Primary "Save notes" centred (status/payment save slot removed).

**Hidden:** Status & payment section entirely (status select, payment status, payment method, amount paid, payment note, quick actions Confirm/Mark paid/Cancel/Complete). Admin notes field. Email activity section. Activity timeline section. "View client profile" link in client card. "Save status & payment" button. Left slot of `AdminMobileActionBar`.

**Role-specific copy:** Assignment CTA: "Mark complete" / "Mark as no-show". Claimable CTA: "Claim this booking" (Primary).

**Why scoped:** Therapists hold `manage_bookings_assigned` — they action their own work only. Payment data, admin notes, and audit events are outside their operational scope.

---

### Denied state

Rendered for: Inactive accounts, custom roles without booking scope, and requests for a booking outside the user's assignment scope.

**What renders:** `AdminAccessDenied` — heading "You don't have access to this booking.", body "Contact the owner if you think this is a mistake.", Secondary "Back to bookings" → `/admin/bookings`. No booking content, no sidebar.

---

## Recipe Context

### Files to edit

| File | What changes |
|---|---|
| `src/app/admin/bookings/[bookingId]/page.tsx` | Restructure into two-column layout (main + sticky sidebar); split inline `ParticipantBreakdown`, `ActivityTimeline`, `EmailDeliveryStatus` sections into separate `AdminPanel` blocks with H2 headings; add sidebar cards (summary, client with "View client profile" link, address); add back-link in `AdminPageHeader` breadcrumb; scope Therapist view to hide payment/admin-notes/email-activity/timeline sections; **import and render `<BookingCreatedToast />`** (reads from `sessionStorage` key `booking-new-created-toast` and fires "Booking created." Sonner Confirmed toast on mount — written by booking-new session, consumed here) |
| `src/app/admin/bookings/BookingManagementForm.tsx` | Split into two `AdminPanel` sections: "Status & payment" (status/payment fields + quick-action Ghost buttons + "Save status & payment" Primary) and "Notes" (three textareas + "Save notes" Primary); add unsaved-state signalling (save buttons 60% opacity → full on change) |
| `src/app/admin/bookings/AssignmentManager.tsx` | Restyle to DESIGN.md tokens; Reassign opens `AdminActionMenu` (desktop) or `AdminSheet` bottom (mobile); Attention-family "Unassigned" badge when no assignment; therapist avatar (32px) + name + status badge when assigned |
| `src/app/admin/bookings/ClaimAssignmentButton.tsx` | Add optimistic UI: instant "Claimed" state on click, spinner, server rollback on error with Sonner toast |
| `src/app/admin/bookings/BookingActionButton.tsx` | Restyle quick-action Ghost buttons to DESIGN.md spec; Cancel triggers `ConfirmActionModal` |

### Files to NEVER touch

- `src/app/admin/bookings/actions.ts` — `updateBookingManagement`, `quickUpdateBooking`, `claimBookingAssignment`, `updateBookingAssignment`, `updateOwnAssignmentStatus`
- `src/app/admin/bookings/access.ts`, `access.test.ts` — scope helpers
- `src/app/admin/bookings/format.ts` — date/money/label formatters
- `src/app/admin/bookings/types.ts` — type definitions
- `src/app/admin/bookings/assignment-eligibility.ts`, `assignment-eligibility.test.ts` — gender/service eligibility logic
- `src/lib/auth/**`, `src/lib/supabase/**`, `src/middleware.ts` — standard untouchables (RECON §5)
- `supabase/migrations/**`

### Feature Preservation Manifest

**Form field `name` attributes that must not change (RECON §2):**
`booking_id` (hidden), `status`, `payment_status`, `payment_method`, `amount_paid`, `payment_note`, `treatment_notes`, `admin_notes`, `customer_manage_notes`

**Server action wire-ups (all must keep firing):**
- `updateBookingManagement` — called by both "Save status & payment" and "Save notes" (with `booking_id` hidden in each form); must handle partial field submission without nulling unsubmitted fields
- `quickUpdateBooking` — Confirm / Mark paid / Cancel / Complete quick-action buttons
- `claimBookingAssignment` — `ClaimAssignmentButton`
- `updateBookingAssignment` — Reassign + Remove in `AssignmentManager`
- `updateOwnAssignmentStatus` — Therapist "Mark complete" / "Mark as no-show"

**Audit writes that must keep firing (RECON §6.2):**
`booking_management_updated`, `booking_quick_confirm`, `booking_quick_mark_paid`, `booking_quick_cancel`, `booking_quick_complete`, `booking_assignment_claimed`, `booking_assignment_unassigned`, `booking_assignment_reassigned`, `booking_assignment_completed`, `booking_assignment_no_show`

**External link to preserve (RECON §6.5):**
Google Maps deep-link in address card: `https://www.google.com/maps/search/?api=1&query=${address}` — must remain a `target="_blank"` link

**New link added (BASELINE-CRITIQUE fix):**
"View client profile" → `/admin/clients/{clientId}` in the client sidebar card — this is a net-new link; no server action required

### Information hierarchy (main column, top to bottom)

1. Status & payment (what state is the booking in? what's the financial picture?) — first because it drives the "what do I need to do?" decision
2. Participants (who are the clients? what are the gender requirements?) — second because it informs the assignment decision
3. Assignment (who is doing the work? is it covered?) — third because it depends on knowing the participant requirements
4. Notes (clinical, admin, customer context) — fourth; reference and record-keeping
5. Email activity (what has been communicated?) — fifth; comms audit
6. Activity (full event history) — last; forensic reference

### Design direction — tokens and components

- **Two-column layout:** main ~60% + sidebar ~40%; sidebar `position: sticky; top: var(--nav-height)` on desktop
- **Main `AdminPanel` sections:** `surface-card`, 8px radius, 1px `border-subtle`, `lg` (24px) gap between panels, no shadow at rest
- **Quick-action Ghost buttons:** Work Sans 500 label step, visible at rest, above status form fields; `ConfirmActionModal` on Cancel
- **Status badge:** current status as `AdminStatusBadge` (read display, not interactive) at the top of the Status & payment panel, beside the section H2
- **Gender-match chip per participant:** Restricted family — "Same-gender required" — always visible when applicable
- **"Unassigned" badge:** Attention family — `alert-circle` icon + "Unassigned" label
- **Therapist assignment row:** avatar (32px, deterministic tint) + name (Urbanist 600, title step) + assignment status `AdminStatusBadge`
- **Save buttons:** Primary full-width within each section's panel footer; 60% opacity + `aria-disabled="true"` until a field in that section changes
- **Sidebar cards:** `AdminPanel` without H2 headings — booking reference is the visual anchor; client card has avatar (32px) + name + phone + email + Ghost "View client profile" link
- **Address card:** `AdminDescriptionList` + Primary "View on Maps" full-width button at the bottom
- **Activity timeline entries:** avatar (24px) + action description (Work Sans 400 body step) + timestamp (IBM Plex Mono label step, Soft Slate); `border-left: 1px border-subtle` timeline track (1px — NOT a coloured side-stripe; this is a structural divider at minimum width)
- **Mobile sticky bar:** `surface-card`, 1px `border-subtle` top, `md` padding; left: Secondary "Save notes"; right: Primary "Save status & payment"

---

## Implementation Notes

### Per-state intent

**Default — pending, unassigned (full scope)**
- Status & payment: Pending badge top of panel; "Confirm" Ghost button most prominent quick action
- Assignment: full-width Attention-family "Unassigned" banner within the Assignment panel
- Sidebar summary: Pending status badge prominent

**Default — confirmed, assigned**
- Status & payment: Confirmed badge; "Mark paid" prominent if payment outstanding
- Assignment: therapist avatar + name + assignment status badge
- All panels fully populated

**Saving (either form)**
- Affected save button: 16px spinner, `aria-busy="true"`, text unchanged; inputs/textareas in that section disabled
- Other section unaffected

**Saved**
- Sonner toast (Confirmed family, 4s); save button resets; sidebar status badge refreshes via `revalidatePath`

**Cancel quick action**
- `ConfirmActionModal` opens; on confirm: `quickUpdateBooking` fires, booking status updates to Cancelled, activity timeline gets new entry, Sonner toast "Booking cancelled."

**Claim (Therapist, optimistic)**
- `ClaimAssignmentButton`: instant "Claimed" disabled state with spinner; on server success: assignment section updates with therapist's own info; on server error: button reverts + Sonner error toast "Couldn't claim this booking. Try again."

**Booking not found**
- `EmptyState` in place of the full page content: "Booking not found" heading, "This booking may have been deleted or you don't have access." body, Secondary "Back to bookings"

**Permission denied**
- `AdminAccessDenied`: "You don't have access to this booking." + "Contact the owner if you think this is a mistake." + Secondary "Back to bookings"

### Per-viewport intent

**Mobile (375px)**
- Single column; section order: booking summary (compact, `sm` padding) → Status & payment → Participants → Assignment → Client card → Notes → Address card → Email activity → Activity
- Status & payment quick actions: Ghost `more-horizontal` `AdminActionMenu` button in section header (top of page, easy to reach); no individual inline Ghost buttons at mobile
- Participants: participant rows stack vertically; gender-match chip full-width below the services list
- Assignment: `AssignmentManager` Reassign opens `AdminSheet` from bottom with staff list
- Notes: three textareas stacked full-width; `textarea` min-height 80px
- `AdminMobileActionBar`: fixed bottom; left Secondary "Save notes" / right Primary "Save status & payment"; 44px height; `surface-card` + 1px `border-subtle` top
- Therapist mobile: sticky bar shows only Primary "Save notes" centred; no "Save status & payment" slot

**Tablet (768px)**
- Two-column layout activates at ≥768px; sidebar becomes sticky
- Quick-action Ghost buttons visible at rest inline above status form fields

**Desktop (1440px)**
- Content max-width: `--content-width-lg`
- Sidebar: sticky within scroll container; all three sidebar cards visible simultaneously (summary, client, address)
- Activity timeline: entries at comfortable density; avatars 24px; IBM Plex Mono timestamps right-aligned
- Assignment Reassign: `AdminActionMenu` dropdown (not bottom sheet)

### Verification steps

**Playwright (automated):**
- Full scope load: all six main sections render; sidebar shows summary, client with "View client profile" link, address with "View on Maps" button
- "View client profile" link: navigates to `/admin/clients/{clientId}`
- "Save status & payment": change a status field → button activates from 60% opacity → click → spinner → toast "Booking updated." → sidebar status badge reflects new status
- "Save notes": change treatment notes → button activates → save → toast "Notes saved."
- Cancel quick action: click "Cancel booking" → `ConfirmActionModal` opens with exact copy → "Cancel booking" confirm → booking status updates to Cancelled, activity timeline entry appears
- Claim (Therapist): click "Claim this booking" → optimistic "Claimed" state instant → server confirms → assignment section shows therapist's own info
- Therapist scope: sign in as Therapist, navigate to own assigned booking — Status & payment section absent, Admin notes field absent, Email activity absent, Activity timeline absent; "Mark complete" / "Mark as no-show" present in Assignment section
- "View on Maps": address card button opens `https://www.google.com/maps/search/?api=1&query=...` in new tab (GET link, not server action)

**DevTools:**
- `revalidatePath('/admin/bookings/{id}')` fires after each server action (sidebar status badge refreshes without manual reload)
- Zero console errors on all scope variants (full, assigned, claimable)
- Sidebar is `position: sticky` on desktop — confirm it stays in viewport during main column scroll

**`/impeccable audit`:**
- Zero `border-l-4` anywhere on the page (timeline track is 1px `border-subtle`, not a coloured accent)
- Gender-match chip has text label + icon (not colour-only)
- "Unassigned" badge has text label + icon (not colour-only)
- All status badges have text label + icon

**`/impeccable critique`:**
- H1 is the booking reference; H2 per section panel — no heading skips
- All form fields in `BookingManagementForm` have associated `<label>` elements
- Save buttons use `aria-disabled="true"` + 60% opacity (not just visual opacity)
- `ConfirmActionModal` has `role="dialog"` + `aria-labelledby` pointing to the modal heading
- Therapist "Mark complete" and "Mark as no-show" buttons have descriptive accessible names

---

## Copy

### Form labels

**Status & payment panel:**
- `Status` (select; options `Pending`, `Confirmed`, `Completed`, `Cancelled`, `No-show`)
- `Payment status` (select; `Outstanding`, `Paid`, `Partially paid`, `Refunded`, `Waived`)
- `Payment method` (select; `Cash`, `Card on the day`, `Bank transfer`, `Other`)
- `Amount paid` (input, `£` prefix, `0.00` placeholder)
- `Payment note` (textarea, placeholder `e.g. paid in full at the door; £45 cash`)

**Notes panel:**
- `Treatment notes` (Therapist-visible) — placeholder `What you observed, what you treated, what you'd note for next time.`
- `Admin notes` (admin-only) — placeholder `Operational context — not shown to the client.`
- `Customer notes` (visible on customer manage page) — placeholder `Anything the client should know before their visit.`

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Save status + payment | `Save status & payment` | Primary |
| Save notes | `Save notes` | Primary |
| Quick: confirm | `Confirm booking` | Ghost |
| Quick: mark paid | `Mark paid` | Ghost |
| Quick: cancel | `Cancel booking` | Ghost (Destructive variant) |
| Quick: complete | `Mark complete` | Ghost |
| Therapist self-action: complete | `Mark complete` | Ghost |
| Therapist self-action: no-show | `Mark as no-show` | Ghost |
| Claim assignment | `Claim this booking` | Primary |
| Reassign trigger | `Reassign` | Ghost |
| Remove assignment | `Remove assignment` | Ghost (Destructive variant) |
| Sidebar back-link | `View client profile` | Ghost |
| Address card | `View on Maps` | Primary |
| Cancel modal — destructive | `Cancel booking` | Destructive |
| Cancel modal — keep | `Keep it` | Secondary |
| Not-found fallback | `Back to bookings` | Secondary |

### Error messages

- Amount paid invalid (non-numeric / negative): `Amount has to be a number, 0 or more.`
- Amount paid exceeds total: `Amount is more than the booking total. Mark as partially paid first, or check the figure.`
- Payment status `Paid` with zero amount: `Set the amount paid before marking this as paid.`
- Save failed: `Couldn't save changes. Try again.` (toast, persistent, Retry)
- Concurrent edit: `Someone else just updated this booking. Refresh to see the latest.` (inline alert above the save bar)
- Claim race lost: `Someone else just claimed this one. Refresh to see the latest.`
- Assignment to gender-mismatched therapist: `This therapist's gender doesn't match what the client asked for. Choose another, or change the requirement on the booking first.`
- Reassign — no eligible staff: `No eligible therapists are available for this time slot. Try a different time, or adjust the gender requirement on the booking.`
- Booking not found: heading `Booking not found` / body `This booking may have been deleted, or you don't have access.`

### Empty-state text

| Context | Heading | Body | CTA |
|---|---|---|---|
| Booking not found | `Booking not found` | `This booking may have been deleted, or you don't have access.` | `Back to bookings` |
| No assignments yet (admin view) | `Not assigned yet` | `Pick a therapist or wait for one to claim it.` | `Assign now` (Primary, opens Reassign sheet) |
| No emails sent yet | `No emails yet` | `Confirmation and reminder emails appear here once they go out.` | — |
| No activity yet | `No activity yet` | `Updates to this booking will appear here as you and the team work on it.` | — |
| Therapist denied (out-of-scope booking) | `You don't have access to this booking` | `Ask the coordinator or owner if you think this is a mistake.` | `Back to bookings` |

### Tooltip text

- Quick action `Confirm booking`: `Confirm and email the client`.
- Quick action `Mark paid`: `Record the payment in full`.
- Quick action `Cancel booking`: `Cancel and notify the client`.
- Quick action `Mark complete`: `Close out the appointment`.
- Gender-match chip on participants: `This participant asked for a same-gender therapist`.
- "Unassigned" Attention badge: `No therapist assigned yet`.
- Therapist avatar in assignment: `{Name}, {role}` (e.g. `Aisha, therapist`).
- Activity timeline timestamps: native `title` shows absolute date+time, `12 May 2026, 19:42 BST`.
- "View on Maps": `Open this address in Google Maps`.
- Sidebar reference number: native `title` shows the full booking reference for copy.

### Confirmation dialog text

**Cancel booking**
- Heading: `Cancel this booking?`
- Body: `The client will be notified by email. This cannot be undone from the booking page.`
- Destructive: `Cancel booking`
- Secondary: `Keep it`

**Remove assignment**
- Heading: `Remove {therapist name} from this booking?`
- Body: `The booking goes back to unassigned. Anyone eligible can claim it.`
- Destructive: `Remove assignment`
- Secondary: `Keep them`

**Therapist — mark no-show**
- Heading: `Mark this booking as no-show?`
- Body: `The booking will be recorded as a no-show. This still counts as a completed slot for your records.`
- Destructive: `Mark no-show`
- Secondary: `Cancel`

**Toasts**
- Status saved: `Booking updated.`
- Notes saved: `Notes saved.`
- Cancel success: `Booking cancelled. The client has been notified.`
- Mark paid success: `Marked paid.`
- Complete success: `Marked complete.`
- Reassign success: `Reassigned to {therapist name}.`
- Claim success (optimistic): `Booking claimed.`
- Claim race-lost (optimistic rollback): `Couldn't claim this booking. Someone got there first.` (persistent, Refresh Ghost)

