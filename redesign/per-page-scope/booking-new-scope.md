# Per-Page Scope: booking-new

Generated before Phase 6 implementation. This file is the contract. Step 8's commit diff will be checked against this scope.

## Resolved conflicts (user-confirmed 2026-05-14)

| # | Conflict | Decision |
|---|----------|----------|
| 1 | `actions.ts` untouchable per brief vs. previous session decisions | **Honour previous session** — edit `actions.ts` for `BOOKING_SOURCES` enum + per-participant service parsing |
| 2 | Supabase migrations untouchable per brief vs. two already-created untracked migrations | **Keep and apply** — both migrations (`add_client_city_area` + `update_create_booking_request_per_participant_services`) are correct; apply via Supabase MCP |

## Design decisions (locked)

| # | Decision |
|---|----------|
| 1 | `requiredTherapistGender` is NOT a form input — derived automatically from participant gender in RPC; shown as read-only "Same-gender required" chip only |
| 2 | Per-participant `service_slugs[]` — each participant row has its own service checkboxes (`participant_services_0[]`, `participant_services_1[]`, …) |
| 3 | `booking_for` values: `self` / `someone_else` / `group` (group auto-set when `number_of_people > 1`) |
| 4 | `BOOKING_SOURCES` enum: `['phone','whatsapp','facebook','instagram','referral','admin','other']` (facebook added, manual/walk-in removed) |
| 5 | City/area pre-fill from `?clientId=` — already handled by `add_client_city_area` migration |
| 6 | Participant row UI cap at 6; backend cap at 10 (safe mismatch) |
| 7 | Availability check: uses `/api/availability` (same as customer flow); gated on city + participant genders + services all filled |
| 8 | Override mode: "Override availability" button → booking created unassigned; requires `BUILD-booking-create-override-flag.md` backend plan (non-blocking — degrades to server error until built) |
| 9 | Additional participant address: defaults to main contact's address; "Different address?" toggle stores override in `participant_note_N` as `"Visit address: [address], [postcode]"` |
| 10 | Group booking: `number_of_people > 1` → `bookingFor: "group"` → `group_booking = true` in DB — automatic, no extra field |

## Files to edit

- `src/app/admin/bookings/new/page.tsx` — wizard shell; server-side pre-fetch of client (`city`, `area` now included) + enquiry data; fix H1 ("New booking"); fix `AdminAccessDenied` (no raw permission string)
- `src/app/admin/bookings/new/ManualBookingForm.tsx` — full rewrite: four-step wizard, step rail, AdminPanel sections, availability calendar (calls `/api/availability`), override mode, pre-fill chips, gender-match chips, per-participant services, address sharing/override, AdminMobileActionBar, step validation, sessionStorage draft
- `src/app/admin/bookings/actions.ts` — update `BOOKING_SOURCES` enum; add `overrideAvailability` to `manualBookingSchema` + `createManualBooking` parse; add per-participant service slugs parsing (`participant_services_0[]`, etc.)
- `src/app/api/bookings/createBookingTransaction.ts` — add `overrideAvailability?: boolean` to `CreateBookingTransactionInput`; add `facebook` to `BookingSource` type, remove `manual`; add `participantServiceSlugs?: string[][]`; thread both to RPC call
- `src/app/admin/bookings/[bookingId]/BookingCreatedToast.tsx` — already exists (untracked, correct); ensure it is imported into the booking detail page
- `supabase/migrations/20260513120000_add_client_city_area.sql` — apply via `mcp__supabase__apply_migration`
- `supabase/migrations/20260513120100_update_create_booking_request_per_participant_services.sql` — apply via `mcp__supabase__apply_migration`

## Files to NEVER touch

- `src/lib/auth/**` — RBAC helpers; use existing exports only
- `src/lib/supabase/**` — client factories; use existing imports only
- `src/middleware.ts` — auth middleware
- `src/app/admin/bookings/access.ts` — scope helpers; import only
- `src/app/admin/bookings/format.ts` — format helpers; import only
- All build/config files (`next.config.ts`, `tsconfig.json`, `package.json`, etc.)
- `src/app/api/availability/**` — availability endpoint; call it, never modify it

## Feature Preservation Manifest

**Form field `name` attributes that must not change:**
`enquiry_id`, `booking_source`, `full_name`, `email`, `phone`, `booking_for`, `service_slugs`, `number_of_people`, `booking_date`, `start_time`, `address`, `postcode`, `city`, `area`, `access_notes`, `parking_notes`, `customer_notes`, `health_notes`, `consent_acknowledged`, `send_confirmation_email`

**New field names added this session:**
- `participant_services_0[]`, `participant_services_1[]`, … (per-participant services, indexed)
- `override_availability` (hidden `value="on"` when override mode active)
- `participant_note_N` address override appended as `"Visit address: [address], [postcode]"`

**Server action wire-up:**
- `createManualBooking` called as `<form action={createManualBooking}>`
- `enquiry_id` presence triggers `enquiry_converted_to_booking` audit log

**URL param pre-fill contracts:**
- `?clientId=` — server pre-fetches client record (including `city`, `area` after migration)
- `?enquiryId=` — server pre-fetches enquiry record, injects hidden `enquiry_id`

**Audit log writes:**
- `manual_admin_booking_created` on every success
- `enquiry_converted_to_booking` when `enquiry_id` present

**Availability API (read-only — do not modify):**
- `GET /api/availability?date=YYYY-MM-DD&serviceIds[]=slug&participantGenders[]=male&city=Luton`
- Same endpoint the customer booking flow uses

## Backend changes summary

### Migrations to apply
1. `20260513120000_add_client_city_area.sql` — adds `city text`, `area text` to `clients` table
2. `20260513120100_update_create_booking_request_per_participant_services.sql` — updates `create_booking_request` RPC to accept `p_participant_service_slugs text[]` (comma-separated per participant)

### `BOOKING_SOURCES` (`actions.ts`)
Change from `['phone','whatsapp','instagram','referral','admin','manual','other']`
to `['phone','whatsapp','facebook','instagram','referral','admin','other']`

### `BookingSource` type (`createBookingTransaction.ts`)
Add `"facebook"`, remove `"manual"` from union type.

### `overrideAvailability` threading
`ManualBookingForm.tsx` → hidden input `override_availability` → `createManualBooking` → `createBookingTransaction.ts` → RPC `p_override_availability`

**Note:** The `create_booking_request` RPC does not yet accept `p_override_availability`. Until `BUILD-booking-create-override-flag.md` is implemented, the override path results in a server error which the form surfaces as: "No therapists available for that slot. Pick another date, or contact the owner to force-assign manually."

### Per-participant services
`participant_services_0[]`, `participant_services_1[]` → `actions.ts` collects `participantServiceSlugs: string[][]` → `createBookingTransaction.ts` passes to RPC as `p_participant_service_slugs` (comma-joined per participant) → RPC uses per-participant services for `booking_items` inserts

## Design direction — tokens and components

- **Step rail completed:** `action-primary` fill, Field White `check` icon
- **Step rail active:** `action-primary` fill + step name Work Sans 500 label step
- **Step rail upcoming:** `border-subtle` outline, Soft Slate numeral/label
- **Pre-fill tint:** `surface-selected` on pre-filled inputs
- **Pre-fill chip:** Restricted family — `status-restricted-bg` / `status-restricted-text`
- **Gender-match chip:** Restricted family — "Same-gender required" (read-only, auto-derived)
- **Group booking chip:** Restricted family — "Group · {N}" on BookingListCard and Participants panel header
- **Form panels:** `AdminPanel` — `surface-card`, 8px radius, 1px `border-subtle`
- **Inputs:** `surface-input` ground, `border-default` Form Seam, Focus Azure on focus
- **Available time slot:** `surface-selected` tint, clickable
- **Unavailable time slot:** `surface-hover` tint, 60% opacity, not clickable
- **Override mode banner:** Attention family — `status-attention-bg` / `status-attention-text` / `alert-circle` icon
- **No-availability banner:** Attention family inline, above time-slot grid
- **Navigation strip:** Primary "Continue"/"Create booking" right-aligned; Secondary "Back" left-aligned
- **Participant rows:** `AdminEntityRow` pattern — `surface-page`, `border-bottom`, 44px min-height; trailing Ghost `trash-2`
- **Confirmation summary:** `AdminDescriptionList` inside `AdminPanel` with "Edit" Ghost link

## Responsive strategy

- **Mobile 375px:** step rail condensed to text + progress bar, `AdminMobileActionBar` sticky bottom, participant rows stack vertically, time-slot grid is a vertical list
- **Tablet 768px:** step rail switches to numbered circles, two-column field grid, inline navigation strip, time-slot grid horizontal
- **Desktop 1440px:** max-width content, horizontal participant grid, two-column step 4 layout
