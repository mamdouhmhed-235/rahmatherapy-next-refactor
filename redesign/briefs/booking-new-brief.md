# Brief: booking-new

## 1. Feature Summary

The new booking form is the highest-frequency creation surface in Rahma Admin — used for every phone call, WhatsApp message, walk-in, and repeat rebook that doesn't arrive through the public website. It is a four-step wizard covering contact and source, services and participants, location and time, and notes with a final confirmation review. It optionally pre-fills from an existing client profile (`?clientId=`) or an enquiry (`?enquiryId=`), and all pre-filled fields are visually distinguished from hand-typed ones. The form is gated to `manage_bookings_all` (Owner, Admin/PM, and Booking Coordinator).

## 2. Primary User Action

**Move through all four steps without losing the caller's details, reach the confirmation review with confidence, and submit a complete booking in a single sitting.**

## 3. Design Direction

**Colour strategy:** Full palette. Status families carry validation states and pre-fill indicators. Clinic Green carries the primary progress thread. The form itself is calm and spacious — the colour appears in the step rail, active states, and error/success signals, not as decoration.

**Theme scene sentence:** *"A Booking Coordinator at her desk, phone wedged between ear and shoulder, taking a new booking from a caller she doesn't recognise — she needs to move through the form at conversation pace without losing her place or asking the caller to repeat themselves."* The scene forces light mode (already locked), fast tab-key navigation, and a form that communicates exactly where she is and what comes next.

**Anchor references:**
- **Typeform's step-by-step progression** — one focused section at a time, clear forward momentum, adapted to a data-entry context rather than a survey
- **Linear's new issue form** — field precision, keyboard-first, no decorative chrome competing with the inputs
- **UK GP surgery online intake form** — familiar to the clinical context; serious, clear, dignified; captures sensitive data (health notes, gender requirements) without coldness

## 4. Scope

Production-ready. Multi-step wizard with step validation, pre-fill treatment, gender-match participant rows, and a confirmation review step. Phase 6 implements; this brief specifies intent.

## 5. Layout Strategy

A **four-step wizard** with a persistent step rail at the top of the content area, below `AdminPageHeader`.

**Step rail (desktop):** Numbered circles (1–4) connected by a horizontal track. Completed steps: `action-primary` Clinic Green fill, white numeral, `check` icon replaces numeral on completion. Active step: Clinic Green fill + step name below in Work Sans 500 label step. Upcoming steps: `border-subtle` outline circle, Soft Slate numeral and label. Clicking a completed step navigates back to it; clicking ahead is disabled.

**Step rail (mobile):** Condensed to "Step 2 of 4 — Services" in Work Sans 500 at label step (Practice Charcoal), left-aligned below the H1. A thin `border-subtle` progress track spans full width below it; active portion fills to `action-primary`.

**Each step:** Full-width form section within the page canvas. Fields grouped in `AdminPanel` wrappers with an `AdminPanelHeader` (H2) naming the section. Multiple field groups within a step can each be their own `AdminPanel` at `md` (16px) gap between them. No nested panels.

**Navigation strip (bottom of each step):** On desktop — left: "Back" Secondary button (absent on step 1); right: "Continue" Primary button. On mobile — both move to `AdminMobileActionBar` sticky at viewport bottom. Step 4 replaces "Continue" with **"Submit booking request"** Primary button.

**"Booking for" and step 2 layout:** The "Booking for" radio in step 1 has three options that directly control step 2 structure:
- **Themself** — step 2 shows one participant row with name pre-filled from contact name; "Add another person" button is hidden; `bookingForMode: "self"`.
- **Someone else** — step 2 shows one blank participant row (name/gender empty); "Add another person" button is hidden; `bookingForMode: "someone_else"`.
- **Group** — step 2 opens immediately with two blank participant rows; "Add another person" button visible; `bookingForMode: "group"`.
Changing the selection updates step 2 immediately without navigation. Changing from Group back to Themself or Someone else removes all rows beyond the first.

**Step 2 — services per participant:** Two distinct selection sections per participant row:
- **Package** (radio, pick at most one): Supreme Combo Package £55 / Hijama Package £45 / Fire Package £40. Each option shows a short descriptor of included treatments. Selecting one deselects the others.
- **Massage add-on** (optional toggle + duration radio): toggle "Add a massage?" → expands to "30 minutes £40" / "1 hour £60" radio. Picking both massage durations is not permitted. The 30-min and 1-hr options map to the two existing massage service slugs in the DB but are presented as one service with a duration choice.
- Validation: at least one selection (package or massage) required per participant before "Continue" enables.

**Step 3 — location, postcode-first:** Location panel field order:
1. Postcode `*` (first field; on blur → `fetch("https://api.postcodes.io/postcodes/{postcode}")` → auto-fills City + Area if empty)
2. City `*` (auto-filled from `result.post_town`, editable)
3. Area (auto-filled from `result.admin_district`, editable)
4. Address `*` (free-text; postcodes.io does not return individual street addresses)
5. Access notes (optional) / Parking notes (optional)
See `BUILD-postcode-lookup-client.md` for API contract and error handling.

**Step 3 — date/time for mixed-gender groups (Option C, Phase 1):** When the group has both male and female participants, Step 3 shows TWO availability sections — one for female participants (checking for N female therapists) and one for male participants (checking for M male therapists). Each section runs its own `POST /api/availability` call independently. Each has its own no-availability banner and Override button. **Phase 1:** both sections produce one booking record; only one `start_time` is submitted. **Phase 2 (future, deferred):** different times create two linked records via `group_session_id` — see `BUILD-group-session-id.md`.

**Step 4 — inline therapist assignment (high-permission roles only):** For users with `manage_bookings_all` + `assign_staff_roles`, step 4 renders an optional "Assign therapist now" `AdminPanel` beneath the summary cards. It shows a gender-filtered therapist select per participant. Assignment is optional — leaving it empty creates an unassigned REQUEST booking. When assigned, the booking_assignment writes `status: "assigned"` immediately on creation. Section is invisible for Booking Coordinator and Therapist roles. See `BUILD-booking-create-inline-assignment.md`.

**Pre-fill treatment:** Fields auto-populated from `?clientId=` or `?enquiryId=` receive a `surface-selected` background tint and a small chip immediately below the input: "From enquiry" or "From client profile" in Restricted family colours (`status-restricted-bg` / `status-restricted-text`). The chip is not interactive — it is a metadata signal only. Typing over a pre-filled field removes the tint and chip on first keystroke.

## 6. Key States

| State | What the user sees |
|---|---|
| Fresh form (no pre-fill) | Step 1 active, all fields empty, "Continue" disabled until required fields filled |
| Pre-filled from enquiry | Fields populated, each showing `surface-selected` tint + "From enquiry" chip |
| Pre-filled from client | Contact fields populated from client profile, address fields populated on step 3, "From client profile" chips |
| Step validation error | Inline `role="alert"` below each invalid field; "Continue" remains disabled; focus moves to first error on attempt |
| Step completed, moving forward | Step circle fills Clinic Green with `check` icon; next step slides in (160ms `ease-gentle`) |
| Navigating back | No validation; previous step restores with values intact |
| "Booking for: Themself" selected | Step 2 shows one row with name pre-filled from contact name; "Add another person" button hidden |
| "Booking for: Someone else" selected | Step 2 shows one blank row; "Add another person" button hidden |
| "Booking for: Group" selected | Step 2 opens with two blank rows pre-shown; "Add another person" button visible |
| Step 2 — package radio | Per participant: up to three package radio options (Supreme Combo / Hijama / Fire); selecting one deselects others; "none selected" is valid only if massage is selected |
| Step 2 — massage toggle and duration | "Add a massage?" toggle off by default; when toggled on, shows 30 min or 1 hr radio; only one duration can be selected |
| Step 2 — service validation | If neither package nor massage is selected for a participant, inline error: "Pick at least one package or massage." |
| Step 2 — multiple participants (group) | Rows numbered "Person 1", "Person 2", etc. Each has name, gender, package radio, massage toggle. Gender chip auto-shows from gender select. "Add another person" Ghost button at bottom. Remove button on row 2+. Cap at 6. |
| Gender-match chip on participant row | When participant gender is set: "Same-gender required" chip (Restricted family, Lock icon) renders inline as read-only — derived from gender, never editable, never colour-only |
| Postcode entered (Step 3) | On blur, postcodes.io called; if found: City + Area auto-fill (if currently empty); city validates against allowed list immediately |
| Postcode not found | Inline error: "Postcode not found. Fill in city and area manually." City and Area fields editable manually |
| City auto-filled but not in allowed list | Inline error: "We don't currently serve [city]. Update Allowed cities in Settings if you want to add it." |
| Availability prerequisites not met (Step 3) | Date/time section disabled; message: "Enter the client's city first to see available slots." (until city + genders + services all filled) |
| Checking availability (Step 3) | Loading state after date selection fires the `POST /api/availability` call |
| Slots available (Step 3) — same-gender group | ONE time-slot grid for the gender group; each slot labelled with therapist count ("2 therapists available") |
| Slots available (Step 3) — mixed-gender group | TWO availability sections (one per gender group); each shows its gender's available slots independently |
| No slots on selected date | Attention-family banner per section: "No [gender] therapists available on [date]. Pick another date, or override."; "Override this date" Ghost button appears below banner |
| Override mode active | Date/time inputs unlock; Attention-family persistent banner: "No availability checked — this booking will be unassigned until a therapist accepts it."; hidden `override_availability` field set to `"on"` |
| Additional participant — same address | By default inherits main contact's address silently; no override UI shown unless "Different address?" toggle is expanded |
| Additional participant — address override | "Different address for this person?" toggle → address + postcode sub-form appears; value stored in `participant_note_N` as `"Visit address: [address], [postcode]"` |
| Step 4 — confirmation review (standard) | Summary cards for steps 1–3, each with an "Edit" Ghost link. Note: "Once submitted, this booking will be unassigned until a therapist accepts it." `consent_acknowledged` checkbox. `send_confirmation_email` toggle (on by default). "Submit booking request" Primary button |
| Step 4 — inline assignment (high-permission) | Additional "Assign therapist now" optional panel visible for Owner/Admin/assign-permitted roles; gender-filtered therapist select per participant; leaving empty = unassigned REQUEST |
| Submitting | "Submit booking request" button shows 16px spinner, `aria-busy="true"`, inputs disabled |
| Success (REQUEST created) | Redirect to new booking detail page; Sonner toast "Booking request submitted." (Attention family, 4s) on arrival; booking arrives as `status: "pending"` + `assignment_status: "unassigned"` unless inline assignment was used |
| Success (pre-assigned) | Same redirect; toast "Booking request submitted."; booking arrives with `assignment_status: "partially_assigned"` or `"fully_assigned"` if all participants were assigned in step 4 |
| Server error | Error Sonner toast (no auto-dismiss, Ghost "Retry"); inline `role="alert"` region above submit button on step 4 |
| Unsaved / accidental navigation | Confirmation sheet: "Leave this booking? Your progress will be lost." / "Leave" (Destructive) + "Keep going" (Secondary) |

## 7. Interaction Model

**Keyboard contract:** `Tab` moves forward through fields in document order. `Enter` on "Continue" / "Create booking" submits the step. Within step 2's participant rows, `Tab` sequences through all fields in row order before moving to the next row.

**Step progression:** "Continue" validates all required fields on the current step. On error: focus moves to the first invalid field; its `role="alert"` message appears below it. On success: step rail updates, next step slides in (160ms `ease-gentle`), scroll returns to top of form area.

**Back navigation:** Always permitted. No validation. Previous step values preserved in form state.

**Pre-fill on mount:** When `?clientId=` or `?enquiryId=` is present, the server pre-populates fields before the page renders (Server Component pre-fetch). No visible loading flash.

**Participant rows (step 2):** Each row has a trailing Ghost `trash-2` button (16px) to remove it. "Add participant" Ghost button adds a blank row. `number_of_people` hidden field syncs with rendered row count on step change. Cap at 6 rows with inline note: "For larger groups, contact us directly." **When `number_of_people > 1`, `createManualBooking` automatically sets `bookingFor: "group"` — no separate group checkbox needed; the booking is flagged as a group booking in the database.**

**Additional participant address (step 2 / step 3):** Additional participant rows show a collapsed "Different address for this person?" disclosure toggle. When expanded: address line + postcode inputs appear (city/area locked to main contact's). The different address is stored as `"Visit address: [address], [postcode]"` appended to that participant's `participant_note_N` field — no schema change required for V1.

**"Booking for" selection drives step 2:** Selecting Themself, Someone else, or Group in step 1 immediately reshapes step 2 without a page transition. Themself/Someone else: hides the "Add another person" button, caps participants at 1. Group: pre-opens two blank participant rows. Changing back to Themself/Someone else from Group removes all rows beyond the first participant.

**Package radio per participant:** Radio group per participant — selecting Supreme Combo, Hijama, or Fire deselects the other options within that participant's row. Selecting a package is independent of other participants. Massage toggle is a separate optional section below the package radio.

**Postcode auto-fill flow (step 3):** On postcode field `onBlur`: if postcode ≥ 5 chars, `fetch("https://api.postcodes.io/postcodes/{postcode}")` is called client-side (no API key). On success: fills City (from `post_town`, title-cased) only if City is currently empty — never overwrites user-typed value. Area is **manual-entry only** (`admin_district` is not granular enough to be useful). Immediately validates city against allowed list after fill. On failure (not found / network error): shows inline error, manual entry unblocked.

**Availability check flow (step 3) — same-gender group:** Prerequisites: (1) city filled, (2) at least one service selected per participant, (3) at least one gender filled. On date selection: ONE `POST /api/availability` call with all participant genders combined. Response drives one time-slot grid. Available slots show combined gender-breakdown label.

**Availability check flow (step 3) — mixed-gender group (Option C Phase 1):** When group contains both male and female participants: TWO independent `POST /api/availability` calls, one with female genders only, one with male genders only. Two separate time-slot sections rendered. Each has its own no-availability banner and Override button. Both sections fire on each date selection. **Phase 1:** coordinator sees both gender sections' availability but the form submits ONE `start_time` (last-selected). A note informs: "Two time options shown — only one appointment time will be saved. Different appointment times per gender group will be supported in a future update."

**Override flow (step 3):** When no slots are available for the selected date, an "Override this date" Ghost button appears. Clicking it opens an Attention-family confirmation sheet: "Override availability? This booking will be created unassigned — a therapist will need to accept it." + "Override" (Attention Primary) + "Cancel" (Secondary). On confirm: the date/time inputs unlock to accept any date/time; an Attention-family banner persists below the inputs. On submission, a hidden `override_availability` field (`value="on"`) is included in the form. A persistent "Override availability" Ghost link also appears in the date/time section header as an always-available escape hatch. **Backend dependency:** `createManualBooking` must pass `overrideAvailability: true` through `createBookingTransaction.ts` to the RPC as `p_override_availability: true`, bypassing the therapist-count check. See §10 Q6 and plan file `BUILD-booking-create-override-flag.md`. Until this backend change ships, the override path results in a server error caught gracefully by the form.

**Inline assignment flow (step 4, high-permission only):** Rendered for `manage_bookings_all` + `assign_staff_roles` users only. Per participant: a select filtered to gender-matching active staff. Selecting a staff member stores `participantAssignments[i] = staffId` in React state; hidden inputs `therapist_assignment_N` carry values to the server action. Leaving a select at "Leave unassigned" is valid. On submission, `createManualBooking` applies pre-assignments after booking creation — see `BUILD-booking-create-inline-assignment.md`.

**Confirmation review (step 4):** Summary cards show completed data in `AdminDescriptionList` format (Work Sans 500 labels / Work Sans 400 values). Each "Edit" Ghost link navigates back to the corresponding step. Step 4 always shows: "Once submitted, this booking will be unassigned until a therapist accepts it." If override mode is active: "No availability checked — a therapist must be assigned before the visit." If inline assignment was used, a summary of pre-assignments is shown.

## 8. Content Requirements

**Page H1:** "New booking"

**Step labels and H2s:**

| Step | Rail label | Section H2 |
|---|---|---|
| 1 | Contact | Contact & source |
| 2 | Services | Services & participants |
| 3 | Location | Location & time |
| 4 | Confirm | Review & confirm |

**Field labels (matching `name` attributes from RECON.md §2):**

Step 1: Booking source / Full name / Email address / Phone number / Booking for (Self / Group)

Step 2: Per participant: Participant label, Client gender. Then services: Package radio (Supreme Combo Package / Hijama Package / Fire Package / none), Massage add-on toggle → duration radio (30 minutes / 1 hour). (`Required therapist gender` is **not** a form field — auto-derived from participant gender in RPC. `Number of people` is derived from participant count, not a separate field.)

Step 3: Address / Postcode / City / Area / Access notes (optional) / Parking notes (optional) — then, once city + participant genders + services are filled: Date (via availability calendar) / Start time (via time-slot grid). Override mode adds: hidden `override_availability` field.

Step 4: Customer notes (optional) / Health notes (optional) / Consent acknowledged / Send confirmation email

**Pre-fill chip labels:** "From enquiry" / "From client profile"

**Gender-match chip:** "Same-gender required" (Restricted family)

**Consent label:** "I confirm that the client's details and consent have been obtained."

**Send-toggle label:** "Send confirmation email to client"

**Unsaved-changes copy:** "Leave this booking? Your progress will be lost." / "Leave" + "Keep going"

**Multi-error step summary:** "Check the highlighted fields before continuing." (shown above first error when 3+ fields invalid on one step)

**Participant row limit note:** "For larger groups, contact us directly."

## 9. Recommended References

- `reference/interaction-design.md` — multi-step form navigation, step validation, focus management, unsaved-changes confirmation
- `reference/spatial-design.md` — step rail topology, participant row layout, sticky mobile action bar
- `reference/motion-design.md` — step transition (160ms ease-gentle), error appearance

## 10. Open Questions

1. **Conflict checking.** When the coordinator selects date and time on step 3, should the form check therapist availability in real time and warn inline if no same-gender therapist is free? Recommendation: deferred to booking detail page — the form doesn't assign staff, so a conflict at creation is a warning, not a blocker.
2. **Step state persistence.** Should step progress be preserved in `sessionStorage` if the coordinator navigates away and returns? Recommendation: yes, keyed by a session ID, cleared on successful submission or explicit "Leave."
3. **Health notes visibility.** Should `health_notes` be visible to all three permitted roles at creation, or gated by an additional permission? Recommendation: visible to all three at creation (intake data from the caller); sensitivity gating applies on the client detail page.
4. **Participant row limit.** Cap at 6 in the UI with a client-side note. Confirm with the data model that `number_of_people` has no server-side constraint that conflicts.
5. **Enquiry conversion audit.** When `?enquiryId=` is present, confirm `createManualBooking` writes `enquiry_converted_to_booking` to `audit_logs` when `enquiry_id` is in the form payload (RECON §6.2).
6. **Override availability backend flag.** The `create_booking_request` RPC currently throws a Postgres exception when `v_required_male > v_available_male` or `v_required_female > v_available_female`. Override mode requires `p_override_availability boolean default false` added to the RPC (skipping those two checks when true), threaded through `createBookingTransaction.ts` as `overrideAvailability?: boolean`, and read from the form as `formData.get("override_availability") === "on"` in `createManualBooking`. Plan file: `BUILD-booking-create-override-flag.md` (Zone 2, non-blocking — until built, the override path hits a server error caught and displayed by the form).
7. **`BOOKING_SOURCES` enum update.** The current `actions.ts` array is `['phone','whatsapp','instagram','referral','admin','manual','other']`. Per previous session decision: change to `['phone','whatsapp','facebook','instagram','referral','admin','other']` (add `facebook`, remove `manual`). Requires updating `BOOKING_SOURCES` constant in `actions.ts` and the `BookingSource` type in `createBookingTransaction.ts`.
8. **Postcode auto-fill (postcodes.io).** Client-side fetch on postcode blur. Free API, no key, no server changes. Full spec in `BUILD-postcode-lookup-client.md`. Non-blocking — form works fully without it (manual city/area entry).
9. **Inline therapist assignment on step 4.** Requires `page.tsx` to pre-fetch active bookable staff and pass as prop. `createManualBooking` extended to parse `therapist_assignment_N` fields and apply assignments post-creation. Full spec in `BUILD-booking-create-inline-assignment.md`. Non-blocking — section simply doesn't render until this ships.
10. **Phase 2 — split-time mixed-gender groups.** When mixed-gender participants pick different times, two linked booking records would be created sharing a `group_session_id`. Phase 1 (current) submits one time for all. Full spec in `BUILD-group-session-id.md`. Deferred until Phase 2.

---

## Role variants

### Owner

**Visible:** All four steps in full. All fields including `health_notes`, `consent_acknowledged`, `send_confirmation_email`, all booking source options. Pre-fill from both `?clientId=` and `?enquiryId=`.

**Hidden:** Nothing.

**Role-specific copy and actions:** No differences from the base form. Owner is most likely to create complex multi-participant bookings and reach this page from the enquiries list or clients list. The `booking_source` default may lean toward "Admin" for bookings entered on behalf of the business.

---

### Admin (Practice Manager)

**Visible:** Identical to Owner — all four steps, all fields, all source options.

**Hidden:** Nothing.

**Role-specific copy and actions:** No UI differences from Owner on this page. Admin/PM holds `manage_bookings_all` fully and reaches this page from the same entry points.

---

### Booking Coordinator

**Visible:** All four steps and all fields. This is the Coordinator's primary daily task. They reach this page most frequently — converting phone enquiries and WhatsApp messages into bookings is their core workflow.

**Hidden:** Nothing — the field set is identical to Owner/Admin. Health notes are intake data captured from the caller and are not gated at creation time.

**Role-specific copy and actions:** No UI differences. Entry point is almost always the enquiries list (pre-fill via `?enquiryId=`) or a direct "New booking" action. The pre-fill treatment (tint + "From enquiry" chip) is most meaningful for Coordinators since enquiry-to-booking conversion is their dominant use of this form.

---

### Therapist

**Visible:** `AdminAccessDenied` component only — the wizard does not render.

**Hidden:** All four steps, all fields, all navigation.

**Role-specific copy:** "You don't have access to create bookings. Contact the owner if you think this is a mistake." Secondary button "Back to dashboard" → `/admin/dashboard`.

**Why denied:** Therapists hold `manage_bookings_assigned` scope, not `manage_bookings_all`. They can view and action their own assigned bookings but cannot create new ones on behalf of clients.

---

### Denied state

Rendered for: Therapist role, Inactive accounts, and any custom role without `manage_bookings_all`.

**What renders:** `AdminAccessDenied` — illustrated `EmptyState` variant, heading "You don't have access to this section.", body "Contact the owner if you think this is a mistake.", Secondary button "Back to dashboard" → `/admin/dashboard`. No raw permission string shown. No form elements render at all.

---

## Recipe Context

### Files to edit

| File | What changes |
|---|---|
| `src/app/admin/bookings/new/page.tsx` | Wizard shell; pre-fetch client + enquiry; pre-fetch active bookable staff (for inline assignment panel — passed as prop, empty array if user lacks `assign_staff_roles`); pass `canAssign` boolean to form |
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | Full rewrite: step rail; Booking for three-option radio; step 2 package radio + massage toggle per participant; postcode auto-fill (postcodes.io); Option C mixed-gender two availability sections; inline assignment panel (high-permission); "Submit booking request" button; Attention-family REQUEST toast |
| `src/app/admin/bookings/actions.ts` | (Per previous session scope decision — editable.) Parse `therapist_assignment_N` fields; apply inline assignments post-booking-creation; extend when `BUILD-booking-create-inline-assignment.md` is implemented |

### Files to NEVER touch

- `src/app/admin/bookings/access.ts`, `format.ts` — booking scope and format helpers
- `src/lib/auth/**`, `src/lib/supabase/**`, `src/middleware.ts` — standard untouchables (RECON §5)
- `supabase/migrations/**`
- All build/config files

### Feature Preservation Manifest

**Form field `name` attributes that must not change (RECON §2 + §6.1):**
`enquiry_id` (hidden), `booking_source`, `full_name`, `email`, `phone`, `booking_for`, `service_slugs[]`, `number_of_people`, `booking_date`, `start_time`, `address`, `postcode`, `city`, `area`, `access_notes`, `parking_notes`, `customer_notes`, `health_notes`, `consent_acknowledged`, `send_confirmation_email`

**Server action wire-up:**
- `createManualBooking` — called on step 4 final submit; must remain a `<form action={createManualBooking}>` server action
- When `enquiry_id` is present in the payload, `createManualBooking` writes `enquiry_converted_to_booking` to `audit_logs` (RECON §6.2) — preserve this

**URL param pre-fill contracts:**
- `?clientId=` — server pre-fetches the client record and populates `full_name`, `email`, `phone`, `address`, `postcode`, `city`, `area`
- `?enquiryId=` — server pre-fetches the enquiry record and populates `full_name`, `email`, `phone`, `booking_source`, and injects the hidden `enquiry_id` field

**Audit log writes that must keep firing:**
- `manual_admin_booking_created` — fires on every successful submission
- `enquiry_converted_to_booking` — fires when `enquiry_id` is present in payload

**Availability API (admin form uses the same endpoint as the customer booking flow — do not invent a separate one):**
- **Method: POST** (confirmed from codebase — not GET). Body: `{ date, serviceIds, participantGenders, city }`
- Same-gender group: ONE call with all participant genders
- Mixed-gender group (Option C Phase 1): TWO independent calls — one with female genders, one with male genders
- Response drives the time-slot grid(s); `availableStaffByGender` drives slot labels
- Not called until city + participant genders + at least one service per participant are all filled

**Override availability (pending §10 Q6 backend change):**
- Hidden input `name="override_availability"` value `"on"` when admin activates override mode
- `createManualBooking` reads: `formData.get("override_availability") === "on"`
- Threaded to `createBookingTransaction.ts` as `overrideAvailability?: boolean`
- Threaded to RPC as `p_override_availability: overrideAvailability ?? false`
- Until backend change ships: override path gracefully surfaces the RPC error to the user

**Group booking (automatic — no additional field required):**
- When `number_of_people > 1`, `createManualBooking` forces `bookingFor: "group"` → `group_booking = true` in DB
- No separate group-booking checkbox or field needed in the form

### Information hierarchy (per step)

**Step 1 — Contact & source:** Booking source (frames context first) → client identity (name, email, phone) → booking-for scope (individual/group)

**Step 2 — Services & participants:** Per-participant row: identity label → client gender → "Same-gender required" chip (auto-derives from gender) → Package radio (Supreme Combo / Hijama / Fire) → Massage add-on toggle + duration radio (30 min / 1 hr)

**Step 3 — Location & time:** Postcode (auto-fills city + area via postcodes.io) → address → city → area → access + parking notes → [availability unlocks once city + genders + at least one service per participant filled] → date → time slot(s) — one grid for same-gender groups, two grids for mixed-gender (Option C Phase 1)

**Step 4 — Review & confirm:** Step summaries (verify) → optional notes → health notes → consent acknowledgement (gate) → send email toggle → submit

### Design direction — tokens and components

- **Step rail completed:** `action-primary` `oklch(23% 0.073 155)` fill, Field White `check` icon
- **Step rail active:** `action-primary` fill + step name below in Work Sans 500 label step
- **Step rail upcoming:** `border-subtle` `oklch(89% 0.014 78)` outline, Soft Slate numeral/label
- **Progress track (mobile):** `border-subtle` background, `action-primary` active fill
- **Pre-fill tint:** `surface-selected` `oklch(92.0% 0.022 155)` on pre-filled inputs
- **Pre-fill chip:** Restricted family — `status-restricted-bg` / `status-restricted-text` — Work Sans 500 label step, `rounded-full` pill, not interactive
- **Gender-match chip:** Restricted family — same token pair — "Same-gender required" (matches BookingListCard spec in 00-shared-components brief)
- **Form panels:** `AdminPanel` — `surface-card`, 8px radius, 1px `border-subtle`, no shadow at rest
- **Inputs:** DESIGN.md §5 — `surface-input` ground, `border-default` Form Seam, Focus Azure on focus, `role="alert"` error region below
- **Navigation strip:** Primary "Continue" right-aligned on steps 1–3; **"Submit booking request"** on step 4; Secondary "Back" left-aligned; moves to `AdminMobileActionBar` on mobile (<768px)
- **Package radio card selected:** Clinic Green border + Confirmed-family background tint + green service name
- **REQUEST booking status badge:** Attention family (orange) — `status: "pending"` + `assignment_status: "unassigned"` after booking creation
- **Participant rows:** `AdminEntityRow` pattern — `surface-page` background, `border-bottom: 1px border-subtle`, 44px min-height; trailing Ghost `trash-2` remove button
- **Confirmation summary cards:** `AdminDescriptionList` inside `AdminPanel` with "Edit" Ghost link in panel header

---

## Implementation Notes

### Per-state intent

**Empty (step 1, fresh load)**
- All fields empty; "Continue" disabled at 60% opacity + `aria-disabled="true"`
- No illustration — this is an active creation surface, not an absence state
- `send_confirmation_email` toggle defaults to on at step 4

**Loading (pre-fill on mount)**
- Server Component pre-fetch: fields arrive populated before hydration — no skeleton needed
- If server fetch fails (invalid `clientId`/`enquiryId`): form loads empty; Sonner toast warning "Couldn't load client details. Fill in manually." (Pending family, 6s auto-dismiss)

**Step validation error**
- Field-level: input border shifts to Cancelled text colour; `<div role="alert" aria-live="polite" aria-atomic="true">` below field with specific message
- Step-level (3+ errors): "Check the highlighted fields before continuing." banner above first error field — Cancelled family, `alert-circle` icon; not a toast
- "Continue" stays disabled; focus jumps to first error field

**Server error (submit)**
- "Create booking" re-enables; error Sonner toast (no auto-dismiss, Ghost "Retry")
- Inline `<div role="alert">` above submit button on step 4: "Something went wrong. Your details are still here — try again."
- Form values retained; no data loss

**Permission denied**
- `AdminAccessDenied`: illustrated `EmptyState` variant
- Heading: "You don't have access to this section."
- Body: "Contact the owner if you think this is a mistake."
- CTA: Secondary "Back to dashboard" → `/admin/dashboard`

**Success**
- `createManualBooking` redirects to `/admin/bookings/{newBookingId}` on success
- Sonner toast "Booking created." (Confirmed family, `check-circle`, 4s) appears on the detail page after redirect
- `sessionStorage` step state cleared on redirect

### Per-viewport intent

**Mobile (375px)**
- Step rail: "Step 2 of 4 — Services" text + full-width `border-subtle` track with `action-primary` fill; no individual circles
- `AdminPanel` sections: full-width, `md` (16px) horizontal padding
- Participant rows: fields stack vertically within each row (label → client gender → services); "Same-gender required" chip shows inline beneath gender select; each row is its own `AdminPanel` card
- Navigation: "Continue"/"Create booking" + "Back" move to `AdminMobileActionBar` — sticky bottom, full-width stacked (primary above, secondary below) or side-by-side at 44px height
- Pre-fill chips: below each input, full row width
- Step 4 summaries: each step's summary in its own `AdminPanel`, stacked vertically; "Edit" link in panel header right-aligned

**Tablet (768px)**
- Step rail switches to desktop version (numbered circles + track + labels) at ≥768px
- Two-column layout for naturally paired fields (name/email, address/postcode)
- `AdminMobileActionBar` replaced by inline navigation strip at ≥768px

**Desktop (1440px)**
- Content max-width: `--content-width-lg` (form does not spread full-bleed)
- Step rail: full horizontal track, four labelled circles, centred within content width
- Participant rows: horizontal grid — label (25%) / client gender (20%) / services (42%) / remove (13%); "Same-gender required" chip displays inline below the gender select, not as a separate column
- Step 4: two-column layout — summary cards left (55%) / notes + consent + submit right (45%)
- Navigation strip: `xl` (32px) top margin from last field group, left/right aligned within content width

### Verification steps

**Playwright (automated):**
- Fresh form: tab through step 1 fields, click "Continue" with empty required fields — inline errors appear, focus moves to first error, "Continue" disabled
- Pre-fill from `?enquiryId=`: fields arrive populated with `surface-selected` tint; "From enquiry" chip visible; typing removes tint and chip
- Back navigation: complete step 1, advance to step 2, click "Back" — step 1 values preserved, step rail shows correct active/completed states
- Participant rows: add second row, remove it — minimum 1 row enforced; attempt to add 7 rows — 6-row cap with note visible
- Gender-match chip: set participant gender select → "Same-gender required" chip appears inline automatically (no `requiredTherapistGender` input)
- Full submission: complete all four steps → "Create booking" → spinner → redirect → "Booking created." toast
- Permission check: sign in as Therapist → `/admin/bookings/new` → `AdminAccessDenied` renders, no form fields present

**DevTools:**
- `sessionStorage` contains step state after step 1 completes; cleared after successful redirect
- `audit_logs` row `manual_admin_booking_created` written on success
- `enquiry_converted_to_booking` row present when `?enquiryId=` was used

**`/impeccable audit`:**
- Zero `border-l-4` on step rail, participant rows, or navigation strip
- Pre-fill chip and gender-match chip both have visible text labels (not colour-only)
- "Continue"/"Create booking" have `aria-disabled="true"` (not just `opacity: 60%`) when disabled

**`/impeccable critique`:**
- Heading hierarchy: H1 "New booking" → H2 per step section panel — no skips
- Every input has a visible `<label>`; participant row fields use unique IDs per row (`gender-0`, `gender-1`, etc.)
- All error regions use `role="alert" aria-live="polite" aria-atomic="true"`
- Required fields marked with `<span aria-hidden="true">*</span>` in Cancelled text colour
- `consent_acknowledged` checkbox has an explicit associated `<label>` (not just adjacent text)

---

## Copy

### Form labels

**Step 1 — Contact & source:**
- `Booking source *` (select; options `Phone call`, `WhatsApp`, `Facebook`, `Instagram`, `Referral`, `Repeat client`, `Other`)
- `Full name *` — placeholder `As the client would like it on their record`
- `Email address` — placeholder `sara@example.com` (helper: `Used for confirmations and reminders.`)
- `Phone number *` — placeholder `07…` (helper: `Used for WhatsApp and SMS.`)
- `Booking for *` (radio; `Themself` / `A group of people`)

**Step 2 — Services & participants:**
- Per-row: `Participant label *` (placeholder `Client 1`, `Husband`, `Daughter`), `Client's gender *`
- Package section label: `Select a package *` (required if no massage selected)
  - ○ `Supreme Combo Package — £55` subtext: *Pre-Cupping massage / IASTM · Dry Cupping · Fire Cupping · Wet Cupping*
  - ○ `Hijama Package — £45` subtext: *Pre-Cupping massage · Dry Cupping · Wet Cupping*
  - ○ `Fire Package — £40` subtext: *Pre-Cupping massage with essential oils · Dry / Fire Cupping*
- Massage toggle label: `Add a massage to this booking`
- Duration radio (when massage toggled on):
  - ○ `30 minutes — £40`
  - ○ `1 hour — £60`
- `Required therapist gender` is derived automatically from client gender (shown as read-only "Same-gender required" chip, Restricted family, Lock icon — not a form input)

**Step 3 — Location & time (postcode-first field order):**
- `Postcode *` — placeholder `LU1 1AA` — helper: `We'll auto-fill city from this`
- `City *` — placeholder `Luton` — auto-filled from postcodes.io `post_town` (title-cased)
- `Area` — placeholder `e.g. Bury Park` — **manual entry only** (postcodes.io `admin_district` returns borough names, not meaningful local area names)
- `Address *` — placeholder `Street name and number`
- `Access notes` — placeholder `e.g. side door, ring the bell twice`
- `Parking notes` — placeholder `e.g. free on-street after 6pm`
- Date and time-slot grid(s) appear below once city + genders + services are filled

**Step 4 — Review & confirm:**
- Unassigned note (always shown): `Once submitted, this booking will be unassigned until a therapist accepts it.`
- Override note (shown when override active): `No availability checked — a therapist must be assigned before the visit.`
- `Customer notes` — placeholder `Anything the client should know before their visit.`
- `Health notes` — placeholder `Anything the therapist should know: injuries, conditions, medications.` (helper: `Treated confidentially. Only the assigned therapist sees this.`)
- `I confirm that the client's details and consent have been obtained.` (required checkbox)
- `Send confirmation email to client` (toggle, on by default)
- **Assign therapist section (high-permission only):** `Assign therapist now` panel title; `Leave unassigned` default option per participant; staff listed by gender match; section description: `Optional — you can assign later from the booking detail page.`

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Step 1–3 forward | `Continue` | Primary |
| Step 4 final submit | `Submit booking request` | Primary |
| Step back | `Back` | Secondary |
| Add participant row | `Add another person` | Ghost |
| Remove participant row | (icon-only `trash-2`) | Ghost — tooltip `Remove this person` |
| Step 4 "edit" link per summary | `Edit` (with chevron) | Ghost |
| Cancel-out leave dialog | `Leave` (Destructive) + `Keep going` (Secondary) | — |
| Retry on submit failure | `Retry` | Ghost (on toast) |
| Override availability | `Override this date` | Ghost (below no-availability banner) |
| Override confirmation | `Override` (confirm sheet) | Attention family Primary |
| Override persistent link | `Override availability` | Ghost (always visible in date/time section header) |
| Different address toggle | `Different address for this person?` | disclosure toggle, Ghost style |

### Error messages

**Step 1:**
- Full name empty: `Add the client's name so we know who to book.`
- Email malformed: `Email needs an @. For example, sara@example.com.`
- Phone too short: `Phone number is too short. Include the area code.`
- Both email and phone empty: `Add an email or a phone number. We need at least one way to reach the client.`

**Step 2:**
- Participant row missing label: `Label this person so the therapist knows who's who (e.g. "Client 1", "Husband").`
- Participant row missing client gender: `Pick the client's gender so we can match the right therapist.`
- Participant row — no package or massage selected: `Pick at least one package or massage for this person.`
- Over 6 participants attempted: `For larger groups, contact us directly.`

**Step 3:**
- Postcode not found: `Postcode not found. Fill in city and area manually.`
- City not in allowed list (after auto-fill or manual entry): `We don't currently serve {city}. Update Allowed cities in Settings if you want to add it.`
- Prerequisites not yet met (date/time disabled): `Enter the client's city first to see available slots.`
- No slots available on selected date: `No {female/male} therapists available on {date}. Pick another date, or override.` (Attention banner per gender section)
- Override confirmation sheet body: `This booking will be created unassigned — a therapist will need to accept it before the visit.`
- Override mode active banner: `No availability checked — this booking will be unassigned until a therapist accepts it.`
- Date in past: `Pick a date from today onwards.`
- Date beyond booking window: `That date is past the {N}-day booking window. Pick an earlier date, or extend the window in Settings.`
- Address empty: `Street address is needed so the therapist can find them.`
- Postcode malformed: `Postcode doesn't look right. Try the format LU1 1AA.`
- City outside allowed list: `We don't currently serve {city}. Update Allowed cities in settings if you want to add it.`
- Override server error (before backend flag is built): `No therapists are available for that slot. Pick another date, or contact the owner to force-assign manually.`

**Step 4 / submit:**
- Consent unchecked: `Confirm the consent box before booking.`
- Step has 3+ open errors: `Check the highlighted fields before continuing.` (above first error)
- Server failure: `Something went wrong. Your details are still here. Try again.`
- Pre-fill failure: `Couldn't load client details. Fill in manually.` (toast, Pending family, 6s)

### Empty-state text

| Context | Heading | Body | CTA |
|---|---|---|---|
| Permission denied (Therapist) | `You don't have access to this section` | `Bookings are created by coordinators and admins. Ask one of them if a client needs a new booking.` | `Back to dashboard` |
| Pre-fill failed (toast) | — | `Couldn't load client details. Fill in manually.` | — (auto-dismiss) |
| Step 4 nothing to review (impossible by design) | — | — | — |

No EmptyState in the form body itself; the form is always active when rendered.

### Tooltip text

- Step rail completed circle: `Step {N}: done` (native `title`).
- Step rail upcoming circle: `Step {N}: not yet` (native `title`).
- Pre-fill chip "From enquiry": `Loaded from enquiry {first 8 chars of id}`.
- Pre-fill chip "From client profile": `Loaded from {client name}'s profile`.
- Gender-match chip "Same-gender required": `The client asked for a therapist of the same gender.`
- Health notes help text icon (info): `Only the assigned therapist sees this. It's encrypted at rest.`
- Send-email toggle off state: `The client won't get an automatic email. Confirm with them another way.`
- Remove participant `trash-2`: `Remove this person from the booking`.

### Confirmation dialog text

**Leave booking with unsaved changes**
- Heading: `Leave this booking?`
- Body: `Your progress will be lost.`
- Destructive: `Leave`
- Secondary: `Keep going`

**Toasts**
- Success (on arrival at detail page after redirect): `Booking request submitted.` (Attention family, 4s)
- Pre-fill failure: `Couldn't load client details. Fill in manually.`
- Submit failure: `Something went wrong. Try again.` (persistent, Retry)

