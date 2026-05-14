# Per-Page Scope: booking-new

Generated before Phase 6 implementation. This file is the contract. Step 8's commit diff will be checked against this scope.

## Resolved conflicts (user-confirmed)

| # | Conflict | Decision |
|---|----------|----------|
| 1 | `actions.ts` untouchable per brief vs. previous session decisions | Honour previous session — `actions.ts` is editable |
| 2 | Supabase migrations untouchable vs. two already-created migrations | Keep and apply both migrations |
| 3 | Single shared time slot vs. per-participant independent slots (group) | Option C: same-gender group = one shared slot; mixed-gender group = two independent sections (Phase 1 still creates one booking record) |
| 4 | SERVICE UI: checkbox grid vs. radio | Package radio (one of three options) + optional massage duration radio — not a free checkbox grid |

## Design decisions (locked)

| # | Decision |
|---|----------|
| 1 | `requiredTherapistGender` is NOT a form input — derived from participant gender in RPC; shown as read-only chip only |
| 2 | Per-participant service selection: package radio (at most one) + massage duration radio (at most one) — max 2 service slugs per participant |
| 3 | `booking_for` three options: Themself (single participant, name pre-filled) / Someone else (single participant, blank) / Group (2 participants pre-open) |
| 4 | `BOOKING_SOURCES` enum: `['phone','whatsapp','facebook','instagram','referral','admin','other']` |
| 5 | Postcode-first location: postcodes.io auto-fills city + area on postcode blur; falls back to manual entry |
| 6 | Mixed-gender group (Option C Phase 1): two availability sections shown (one per gender group); still creates ONE booking record; Phase 2 (deferred) allows different times → linked records |
| 7 | REQUEST state: all created bookings arrive as `status: "pending"` + `assignment_status: "unassigned"` unless inline assignment used |
| 8 | REQUEST status badge: Attention family (orange) in BookingListCard and bookings list |
| 9 | Submit button: "Submit booking request" (not "Create booking"); toast: "Booking request submitted." (Attention family) |
| 10 | Inline assignment on step 4: optional panel for `manage_bookings_all` + `assign_staff_roles` users; hidden for Coordinator + Therapist |
| 11 | Participant row cap at 6 (UI); backend allows 10 (safe mismatch) |
| 12 | Booking for "Group" pre-opens 2 rows; "Themself"/"Someone else" cap at 1, no "Add" button |

## Files to edit

- `src/app/admin/bookings/new/page.tsx` — wizard shell; pre-fetch client (city/area), enquiry, bookable staff (for inline assignment when user has `assign_staff_roles`); pass `canAssign` + `staffForAssignment` to ManualBookingForm
- `src/app/admin/bookings/new/ManualBookingForm.tsx` — full rewrite: three-option Booking for; package radio + massage toggle per participant; postcode auto-fill (postcodes.io); Option C mixed-gender two availability sections; inline assignment panel; "Submit booking request" button; Attention REQUEST toast
- `src/app/admin/bookings/actions.ts` — `BOOKING_SOURCES` enum updated; `overrideAvailability` and `participantServiceSlugs` parsed; `therapist_assignment_N` fields parsed and applied post-creation (pending `BUILD-booking-create-inline-assignment.md`)
- `src/app/api/bookings/createBookingTransaction.ts` — `facebook` in BookingSource type; `overrideAvailability?: boolean`; `participantServiceSlugs?: string[][]` threaded to RPC; `groupSessionId?: string` (Phase 2 deferred)
- `src/app/admin/bookings/[bookingId]/BookingCreatedToast.tsx` — update toast text to "Booking request submitted." and family to Attention
- `supabase/migrations/20260513120000_add_client_city_area.sql` — apply via MCP
- `supabase/migrations/20260513120100_update_create_booking_request_per_participant_services.sql` — apply via MCP

## Files to NEVER touch

- `src/lib/auth/**` — RBAC helpers; use existing exports only
- `src/lib/supabase/**` — client factories; use existing imports only
- `src/middleware.ts` — auth middleware
- `src/app/admin/bookings/access.ts` — scope helpers; import only
- `src/app/admin/bookings/format.ts` — format helpers; import only
- `src/app/api/availability/**` — availability endpoint; call it (POST), never modify it
- `src/lib/booking/availability.ts` — availability logic; never modify
- All build/config files

## Feature Preservation Manifest

**Form field `name` attributes that must not change:**
`enquiry_id`, `booking_source`, `full_name`, `email`, `phone`, `booking_for`, `service_slugs[]`, `number_of_people`, `booking_date`, `start_time`, `address`, `postcode`, `city`, `area`, `access_notes`, `parking_notes`, `customer_notes`, `health_notes`, `consent_acknowledged`, `send_confirmation_email`

**Service slugs per participant (revised UI — same DB contract):**
Each participant sends at most 2 slugs via `participant_services_N[]`:
- One package slug: `supreme-combo-package` OR `hijama-package` OR `fire-package` (or none)
- One massage slug: `30-min-massage-therapy` OR `1-hour-massage-therapy` (or none)
- At least one of the two is required per participant

**New optional fields:**
- `therapist_assignment_0`, `therapist_assignment_1`... — staff UUID or empty string per participant (inline assignment, pending backend plan)
- `override_availability` — `"on"` when override mode active

**Server action wire-up:**
- `createManualBooking` called as `<form action={createManualBooking}>`
- `enquiry_id` presence triggers `enquiry_converted_to_booking` audit log

**URL param pre-fill:**
- `?clientId=` → pre-fetches client (includes city + area post-migration)
- `?enquiryId=` → pre-fetches enquiry, injects hidden `enquiry_id`

**Audit log writes:**
- `manual_admin_booking_created` on every success
- `enquiry_converted_to_booking` when `enquiry_id` present
- `booking_assignment_reassigned` per inline-assigned participant

**Availability API:**
- `POST /api/availability` with JSON body `{ date, serviceIds, participantGenders, city }`
- Same-gender group: ONE call with all genders
- Mixed-gender group (Option C Phase 1): TWO calls — female genders only, male genders only

## Backend changes summary

### Migrations to apply (already created, pending MCP apply)
1. `20260513120000_add_client_city_area.sql` — adds `city`, `area` to `clients` table
2. `20260513120100_update_create_booking_request_per_participant_services.sql` — updates RPC to accept `p_participant_service_slugs`

### BOOKING_SOURCES update (`actions.ts`)
`['phone','whatsapp','facebook','instagram','referral','admin','other']`

### Postcode auto-fill (client-side, no server change)
`fetch("https://api.postcodes.io/postcodes/{postcode}")` on postcode blur → fills city + area
Full spec: `BUILD-postcode-lookup-client.md`

### Inline assignment threading (pending backend plan)
`therapist_assignment_N` → `createManualBooking` → `booking_assignments` update post-creation
Full spec: `BUILD-booking-create-inline-assignment.md`

### BookingCreatedToast copy update
`sessionStorage` key + toast text: "Booking request submitted." (Attention family, 4s)

## Design direction — tokens and components

- **Package radio card unselected:** `border-[var(--admin-border)]`, `bg-[var(--admin-panel)]`
- **Package radio card selected:** Clinic Green border + Confirmed-family background tint + green service name text
- **Massage toggle:** Switch component (from `src/components/ui/switch.tsx`)
- **Time-slot grid:** same as existing — Clinic Green fill + ring + shadow when selected
- **REQUEST booking badge:** Attention family — `oklch(95% 0.05 65)` bg, `oklch(26% 0.13 55)` text, `alert-circle` icon
- **"Submit booking request" button:** same Primary style as "Create booking" was
- **Inline assignment panel:** `AdminPanel` with `description` prop; staff shown as avatar-initialled token + name + secondary "Available" Confirmed chip

## Responsive strategy

- Mobile 375px: package cards stack single-column; massage toggle inline; postcode field at top of location step; time-slot grid 2 columns; inline assignment panel below consent
- Tablet 768px: two-column package grid; two-column location fields; inline nav strip
- Desktop 1440px: package grid 2-column; location fields 2-column; step 4 two-column (summaries left, notes+consent+assignment right)

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Service radio sends at most 2 slugs; backend accepts any count | Low | RPC handles ≥1 slug per participant — no constraint violated |
| Postcode auto-fill overwrites manually typed city | Low | Guard: only fills if field currently empty |
| Mixed-gender group makes 2 availability calls | Low | Calls are independent; no race condition |
| `booking_for: "someone_else"` removed from step 1 UI | Low | Backend still accepts it; hidden input still sends correct value |
| BookingCreatedToast text change | Low | Copy-only; no logic change |
| Inline assignment silently skips gender mismatch | Low | By design — booking is created, participant stays unassigned |
