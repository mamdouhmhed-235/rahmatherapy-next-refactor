# Rahma Therapy Backend & CRM Implementation Plan

## 1. Project Inspection Summary
**Current Codebase State:**
- **Framework:** Next.js App Router (React, TypeScript).
- **Styling:** Tailwind CSS v4, utilizing CSS variables mapped in `src/styles/tokens.css` (Rahma ivory, green, charcoal, gold) and shadcn/ui.
- **Routing Structure:** Separated into public routes `src/app/(public)` and a skeleton admin area `src/app/admin` (currently containing `dashboard` and `login` folders).
- **Booking Flow Frontend:** Currently handled in `src/features/booking` via `BookingExperience.tsx`. Form validation is robust using Zod (`src/features/booking/schemas/booking-schema.ts`).
- **Data Shape:** Packages are currently hardcoded in `src/features/booking/data/booking-packages.ts` (e.g., "Supreme Combo", "Hijama Package").
- **Gaps:** No active backend, no Supabase configuration yet (empty `src/lib/supabase`), no database schemas, no dynamic availability checking, and no real API endpoints for saving bookings or sending emails.

## 2. Confirmed Answers & Assumptions
- **Working Hours & Days (CRUD Managed):** Completely dynamic via an admin CRUD interface. The admin can easily decide and edit which specific working hours or days are permanently off-limits (e.g., closed on Sundays) without touching code. The frontend will automatically honor these rules, ensuring customers only see genuinely available slots.
- **Availability Pool & Rolling Window (CRUD Managed):** Managed at a business level. The admin sets the overall availability pool, and staff claim from the pooled available times. The admin can also use manual overrides for unavailable days. On the frontend, users will only see available days and times on the calendar; unavailable dates and times will not show or will be unselectable. This is entirely dynamic—the admin decides via the settings UI exactly how many days or weeks in advance a user can book.
- **Buffer Time (CRUD Managed):** The system will default to a 30-minute travel buffer between mobile appointments, but this will be fully editable (or disableable by setting it to 0) via the `/admin/settings` page.
- **Payment Tracking:** Customers pay in person. The admin can edit every booking to record whether the payment was made via **cash** or **card**, and update the status to **paid** or **unpaid**.
- **Admin CMS Architecture:** The custom admin CRM will be built seamlessly within the Next.js app under `/admin`, securely hidden from the public using Supabase RLS and Next.js server-side route protection. All business rules, settings, and services will be managed via CRUD interfaces rather than hardcoding.

## 3. Final Backend Scope
**What will be built (MVP boundaries):**
- **Public Booking API:** Endpoint to submit bookings from the existing frontend flow.
- **Client Booking Management:** A secure, unique UUID-based URL generated for each booking, allowing customers to easily cancel or add notes without needing an account.
- **Admin Authentication:** Secure login for 3 staff members using Supabase Auth.
- **Services Management:** Admin capability to CRUD services/packages (syncing with the frontend).
- **Dynamic Availability Engine:** Logic to calculate rolling booking windows, blocked dates, and double-booking prevention.
- **Staff CRM & Booking Management:** Assigning/claiming bookings, managing client history, and gender-matching rules.
- **Admin Dashboard:** Key metrics overview (revenue, booking statuses) with a highly visible "Needs Attention" badge for unassigned/new bookings.
- **Email Notifications:** Integration with Resend for confirmations (including the secure manage link) and reminders.

**What will NOT be built:**
- Customer accounts or a customer portal.
- Online payment integrations (no Stripe).
- SMS or WhatsApp notifications.
- Loyalty points, complex marketing automation, or multi-location systems.

## 4. Branding and UI/UX Guide
**Adhering to the Rahma Therapy Aesthetic:**
- **Colors:**
  - Backgrounds: Ivory (`--rahma-ivory: #f7f3ec`), White (`#ffffff`) for cards.
  - Text: Charcoal (`--rahma-charcoal: #1f2f2b`), Muted Green-Gray (`--rahma-muted: #53615d`).
  - Primary Brand/Buttons: Deep Green (`--rahma-green: #30463f`).
  - Accents: Gold (`--rahma-gold: #f5a623`), used sparingly for highlights or warnings.
- **Typography:** Modern, clean, and legible (using existing variables like `--font-sans`).
- **Cards & Radii:** Rounded, soft appearances (`--radius-card: 1.5rem`, `--radius-base: 0.75rem`) with soft shadows (`--shadow-card-token`).
- **Admin Design Rules:**
  - The Admin CMS must feel like an extension of the public site, not a generic SaaS template. Maintain the warm clinical luxury feel.
  - **Unread/Alert Badges:** Ensure there is a highly visible, red "Needs Attention / Unassigned" badge on the dashboard/sidebar so staff immediately know when a new booking requires assignment or review.
  - **Routing vs. Modals:** Use unique pages/slugs for detailed records (e.g., `/admin/bookings/[id]`). Modals should be strictly reserved for confirmations, deletions, or very small field edits.
  - **Toasts:** Use screen toast messages positioned at the **top-left**. Implement for success states (booking claimed, settings saved) and errors.
  - **States:** Implement clear empty states (e.g., "No unassigned bookings"), loading skeletons matching card radii, and graceful error boundaries.

## 5. Proposed Supabase Database Schema

### `staff_profiles`
- **Purpose:** Extends Supabase Auth users to store therapist and admin information.
- **Important Columns:** `id` (uuid, PK), `name` (text), `email` (text), `role` (enum: admin, therapist), `gender` (enum: male, female), `active` (boolean).
- **Relationships:** `id` references `auth.users(id)`.
- **Pages/Features:** `/admin/staff`, booking assignment logic.
- **Constraints:** Email must be unique.
- **RLS Notes:** Read-only for authenticated admins/staff. Public has no access.

### `services`
- **Purpose:** Stores the packages and treatments offered.
- **Important Columns:** `id` (uuid, PK), `slug` (text), `name` (text), `group_category` (text), `short_description` (text), `full_description` (text), `suitable_for_notes` (text), `gender_restrictions` (enum: any, male_only, female_only), `price` (numeric), `duration_mins` (int), `is_active` (boolean), `is_visible_on_frontend` (boolean), `display_order` (int).
- **Relationships:** None.
- **Pages/Features:** Public booking flow, `/admin/services`.
- **Constraints:** `slug` must be unique.
- **RLS Notes:** Read-only for public. Full CRUD for authenticated admins.

### `clients`
- **Purpose:** Simple CRM storage for customer details and history.
- **Important Columns:** `id` (uuid, PK), `full_name` (text), `phone` (text), `email` (text), `gender_preference` (enum: male, female, no_preference), `address` (text), `postcode` (text), `notes` (text), `created_at`, `updated_at`.
- **Relationships:** None directly, but `bookings` references this table.
- **Pages/Features:** `/admin/clients`, `/admin/clients/[id]`.
- **Constraints:** Email must be unique.
- **RLS Notes:** Public can insert (via secure server route). Read/Update restricted to admins.

### `bookings`
- **Purpose:** Core transaction record representing a customer's appointment. Supports group bookings at a single location.
- **Important Columns:** `id` (uuid, PK), `client_id` (uuid), `booking_date` (date), `start_time` (time), `end_time` (time), `total_duration_mins` (int), `number_of_people` (int), `total_price` (numeric), `payment_method` (enum: cash, card), `payment_status` (enum: paid, unpaid), `status` (enum: pending, confirmed, assigned, completed, cancelled, no_show), `assigned_staff_id` (uuid), `service_address_line1`, `service_address_line2`, `service_city`, `service_postcode`, `access_notes`, `customer_notes`, `admin_notes`, `created_at`, `updated_at`.
- **Relationships:** `client_id` references `clients(id)`. `assigned_staff_id` references `staff_profiles(id)`.
- **Pages/Features:** `/admin/bookings`, Dashboard, Staff claiming.
- **Constraints:** Dates/times must be valid.
- **RLS Notes:** Public can insert (via secure backend). Full access for admins.

### `booking_items`
- **Purpose:** Stores the multiple services selected within a single booking.
- **Important Columns:** `id` (uuid, PK), `booking_id` (uuid), `service_id` (uuid), `service_name_snapshot` (text), `service_price_snapshot` (numeric), `service_duration_snapshot` (int).
- **Relationships:** References `bookings(id)` and `services(id)`.
- **Pages/Features:** Booking creation, `/admin/bookings/[id]`.
- **Constraints:** Snapshot values must not be null to preserve historical revenue.
- **RLS Notes:** Insert for public via backend. Full access for admins.

### `availability_rules`
- **Purpose:** Defines the standard weekly repeating hours of operation.
- **Important Columns:** `id` (uuid, PK), `day_of_week` (int 0-6), `start_time` (time), `end_time` (time), `is_working_day` (boolean).
- **Relationships:** None.
- **Pages/Features:** Slot generation logic, `/admin/availability`.
- **Constraints:** Valid day integers and time formats.
- **RLS Notes:** Read-only for public. Full access for admins.

### `blocked_dates`
- **Purpose:** Explicit dates where the business is entirely closed (holidays, emergencies).
- **Important Columns:** `id` (uuid, PK), `blocked_date` (date), `reason` (text).
- **Relationships:** None.
- **Pages/Features:** Slot generation logic, `/admin/availability`.
- **Constraints:** Date must be unique.
- **RLS Notes:** Read-only for public. Full access for admins.

### `availability_overrides`
- **Purpose:** Allows admins to open up or adjust hours for a specific date that differs from the standard weekly rules.
- **Important Columns:** `id` (uuid, PK), `override_date` (date), `start_time` (time), `end_time` (time), `reason` (text).
- **Relationships:** None.
- **Pages/Features:** Slot generation logic, `/admin/availability`.
- **Constraints:** Date must be unique.
- **RLS Notes:** Read-only for public. Full access for admins.

### `business_settings`
- **Purpose:** Global configuration variables to ensure all business rules are CRUD-editable by the admin, eliminating the need for hardcoding.
- **Important Columns:** `id` (int, PK), `company_name`, `contact_email`, `contact_phone` (text), `booking_window_days` (int) [determines how many days/weeks in advance a user can book], `allowed_cities` (text array/jsonb) [cities/towns the business serves], `buffer_time_mins` (int), `minimum_notice_hours` (int), `booking_status_enabled` (boolean).
- **Relationships:** None.
- **Pages/Features:** Slot generation, `/admin/settings`.
- **Constraints:** Only row with ID=1 should exist.
- **RLS Notes:** Read-only for public. Update access for admins.

## 6. Auth and Role Model
- **Admin/Staff Only:** Customers do not log in.
- **Roles:** Handled via the `staff_profiles` table mapping to the auth user.
- **Protected Routes:** Next.js Middleware will protect all routes under `/admin/*`. Unauthenticated users are redirected to `/admin/login`.

## 7. Availability, Location, and Booking Logic
- **Location Restrictions:** The frontend will require users to select their city/town/area. If the selected area is not within the admin-defined `allowed_cities` list, the booking request will be blocked with a clear notification stating the business does not cover that area.
- **Concurrent Capacity:** Strictly **1 booking slot at a time** (no overlapping bookings) for the MVP. The system will enforce this to prevent overlaps, but the database architecture will leave room to increase capacity in the future if more therapists are added.
- **Group Bookings:** The frontend will allow a single user to book for multiple people at the same address (including specifying different genders). The backend will treat this as one continuous block of time with `number_of_people` tracked.
- **Rolling Window:** Customers can only view/book dates between `Current Date + minimum_notice_hours` and `Current Date + booking_window_days`. On the frontend calendar, available days and times will be clearly visible, whereas other dates/times will not show or will be completely unselectable.
  1. Retrieve day rules (checking which days are permanently off-limits), blocked dates, and overrides.
  2. Retrieve existing `bookings`.
  3. Calculate slots ensuring `requested_duration + buffer_time_mins` fits.
- **Double-Booking Prevention:** Checked server-side during insertion using transactions.
- **Cancelled Slots:** Reopening a slot automatically happens when a booking changes status to `cancelled`.

## 8. Admin CRM Architecture
Pages to be implemented (All emphasizing easy CRUD management):
- `/admin/dashboard`: High-level metrics.
- `/admin/bookings`: Filterable/sortable list.
- `/admin/bookings/[bookingId]`: Deep dive into a booking to manage status, payment, notes, and staff claiming.
- `/admin/clients` & `/admin/clients/[clientId]`: Customer profiles and history.
- `/admin/services`: Full CRUD interface for treatments and packages so the admin can easily add, edit, or remove services without editing code.
- `/admin/availability`: CRUD UI to manage standard working hours (including setting permanently off-limit days), blocked dates, and overrides.
- `/admin/staff`: Manage staff profiles and view workload.
- `/admin/settings`: CRUD interface for global business variables (buffer times, booking windows in days/weeks, site-wide contact info, master booking switch). This ensures the admin can tweak operational rules easily without deploying code.

## 9. Email Notification Plan
- **Resend Setup:** API keys stored in environment variables.
- **Trigger Points:** 
  - Confirmation to Client on creation (MUST include the secure UUID link to cancel/manage the booking).
  - Admin alert on creation.
  - Client alert on cancellation.
- **Reminder Timing:** Cron job or background queue to send 24 hours before `booking_date`.

## 10. Dashboard Metrics Plan
- **Metrics Needed:**
  - Total bookings, upcoming bookings, completed bookings, cancelled bookings, no-shows.
  - Total revenue & unpaid bookings.
  - Revenue by date range.
  - Most booked services.
  - Unassigned bookings.
  - Bookings per staff member.
  - Repeat clients vs. New clients.
  - Average booking value.
- **Calculation:** Handled via server-side SQL aggregations or Supabase RPCs.
- **Filtering:** Provide simple date range filters (e.g., "This Week", "This Month").

## 11. Required Backend Logic & API Routes
The following logical boundaries/Server Actions will be required:
- `calculateAvailableSlots(date, requestedDuration)`: Reads rules, overrides, blocks, and bookings to return valid times.
- `createBookingTransaction(payload)`: Inserts client (or finds existing), inserts booking, inserts booking_items snapshots, and sends emails. Protects against double booking.
- `claimBooking(bookingId, staffId)`: Validates gender rules, ensures booking is currently unassigned, and updates status.
- `updateBookingStatus(bookingId, status, paymentMethod, paymentStatus)`: Marks completed, cancelled, or updates payment info.
- `getDashboardMetrics(dateRange)`: Aggregates revenue, counts, and client splits.

## 12. Phase-by-Phase Implementation Sequence

### Phase 1: Supabase Setup & Environment
- **Objective:** Configure the backend connection securely.
- **Why this phase comes now:** Forms the foundation before any database or auth logic can be written.
- **Files/folders involved:** `.env.local`, `src/lib/supabase/*`, `package.json`.
- **Database changes:** None.
- **Backend logic:** Supabase client instantiation (server, browser, middleware).
- **UI/admin pages:** None.
- **Security/RLS:** Ensure anon keys vs service keys are strictly separated.
- **Testing:** Verify client successfully pings Supabase.
- **Acceptance criteria:** Supabase clients function correctly in Server Components and Route Handlers.
- **What not to do:** Do not write schemas or UI yet.

### Phase 2: Database Schema & Migrations
- **Objective:** Create the remote database structure.
- **Why this phase comes now:** Tables must exist before data can be managed or queried.
- **Files/folders involved:** `supabase/migrations/*`.
- **Database changes:** Create `staff_profiles`, `services`, `clients`, `bookings`, `booking_items`, `availability_rules`, `blocked_dates`, `availability_overrides`, `business_settings`.
- **Backend logic:** None.
- **UI/admin pages:** None.
- **Security/RLS:** Set up base RLS policies allowing Admin full access, Public restricted access.
- **Testing:** Run migrations locally or against staging DB to verify relationships.
- **Acceptance criteria:** All 9 tables exist with correct relationships and constraints.
- **What not to do:** Do not build the frontend fetching logic yet.

### Phase 3: Auth & Protected Admin Shell
- **Objective:** Secure the admin area and allow staff to log in.
- **Why this phase comes now:** Admin pages cannot be built until there is a secure place to put them.
- **Files/folders involved:** `src/app/admin/login`, `src/app/admin/layout.tsx`, `src/middleware.ts`.
- **Database changes:** None.
- **Backend logic:** Supabase Auth sign-in logic.
- **UI/admin pages:** Login page, basic Admin layout shell (sidebar/navbar).
- **Security/RLS:** Middleware redirects unauthenticated users away from `/admin/*`.
- **Testing:** Attempt to visit `/admin/dashboard` while logged out, ensure redirect to login.
- **Acceptance criteria:** Staff can log in and view an empty protected dashboard.
- **What not to do:** Do not build complex dashboard metrics yet.

### Phase 4: Services CRUD
- **Objective:** Manage treatments and packages dynamically.
- **Why this phase comes now:** Bookings rely on services existing in the database.
- **Files/folders involved:** `src/app/admin/services/*`.
- **Database changes:** Seed default services.
- **Backend logic:** Server actions for Create/Update/Delete services.
- **UI/admin pages:** `/admin/services` list view, and a modal/page for editing a service.
- **Security/RLS:** Verify public can read active services, only admins can edit.
- **Testing:** Create a new service and verify it appears in the database.
- **Acceptance criteria:** Admin can fully manage the service catalog via UI.
- **What not to do:** Do not connect this to the public booking form yet.

### Phase 5: Business Settings & Availability Base
- **Objective:** Create the operational rules for the business.
- **Why this phase comes now:** Slot generation depends on working hours and buffer settings.
- **Files/folders involved:** `src/app/admin/settings/*`, `src/app/admin/availability/*`.
- **Database changes:** Seed default `business_settings`.
- **Backend logic:** Server actions to update settings, standard hours, blocked dates, and overrides.
- **UI/admin pages:** `/admin/settings` (contact info, windows) and `/admin/availability` (calendar/list).
- **Security/RLS:** Admin-only access.
- **Testing:** Add a blocked date and verify it saves.
- **Acceptance criteria:** Admin can update the master switch, buffers, and working days.
- **What not to do:** Do not build the complex slot calculation engine yet.

### Phase 6: Booking Engine & Slot Calculation
- **Objective:** Allow customers to find valid slots and submit bookings.
- **Why this phase comes now:** Now that services and availability rules exist, the core product can be built.
- **Files/folders involved:** `src/features/booking/*`, `src/app/api/bookings/*`.
- **Database changes:** None.
- **Backend logic:** `calculateAvailableSlots` and `createBookingTransaction`.
- **UI/admin pages:** Refactor public `BookingExperience.tsx` to use dynamic services and slots.
- **Security/RLS:** Protect against double-booking. Allow public insert to bookings.
- **Testing:** Simulate two users booking the same slot at the exact same time.
- **Acceptance criteria:** A user can successfully submit a booking through the public UI into the database.
- **What not to do:** Do not build the Admin CRM viewing pages yet.

### Phase 7: Client CRM
- **Objective:** Track and view customer profiles.
- **Why this phase comes now:** Once bookings exist, we need to organize the people making them.
- **Files/folders involved:** `src/app/admin/clients/*`.
- **Database changes:** None.
- **Backend logic:** Queries to fetch clients and their booking histories.
- **UI/admin pages:** `/admin/clients` list view and `/admin/clients/[clientId]` detail page.
- **Security/RLS:** Admin-only access to client data.
- **Testing:** Search for a client by name or phone number.
- **Acceptance criteria:** Admins can view a list of all clients and click in to see their past/future bookings.
- **What not to do:** Do not build complex marketing integrations.

### Phase 8: Admin Bookings Management
- **Objective:** View, edit, and update the lifecycle of bookings.
- **Why this phase comes now:** Admins need to see the bookings that customers are creating.
- **Files/folders involved:** `src/app/admin/bookings/*`.
- **Database changes:** None.
- **Backend logic:** Update booking status, update payment method/status.
- **UI/admin pages:** `/admin/bookings` list view and `/admin/bookings/[bookingId]` detail page.
- **Security/RLS:** Admin-only.
- **Testing:** Change a booking from pending to completed and mark as paid.
- **Acceptance criteria:** Admins can manage all aspects of a booking's lifecycle.
- **What not to do:** Do not build staff assignment yet.

### Phase 9: Staff Assignment
- **Objective:** Allow therapists to claim work and respect gender constraints.
- **Why this phase comes now:** Bookings are now manageable, so they need to be assigned to workers.
- **Files/folders involved:** `src/app/admin/staff/*`, booking detail pages.
- **Database changes:** None.
- **Backend logic:** `claimBooking` action with gender validation.
- **UI/admin pages:** "Claim Booking" button on unassigned bookings. `/admin/staff` page to view workloads.
- **Security/RLS:** Prevent claiming an already assigned booking.
- **Testing:** Attempt to claim a female client's booking as a male therapist (should fail).
- **Acceptance criteria:** Staff can securely claim bookings and view their own schedule.
- **What not to do:** Do not build complex payroll tracking.

### Phase 10: Dashboard Metrics
- **Objective:** Provide a business overview.
- **Why this phase comes now:** The full lifecycle of data (bookings, payments, clients) is now in the system.
- **Files/folders involved:** `src/app/admin/dashboard/*`.
- **Database changes:** None.
- **Backend logic:** Aggregation queries for revenue, repeat clients, and upcoming counts.
- **UI/admin pages:** `/admin/dashboard`.
- **Security/RLS:** Admin-only.
- **Testing:** Verify revenue totals match completed bookings.
- **Acceptance criteria:** Dashboard accurately reflects database state.
- **What not to do:** Do not overcomplicate with highly granular charting yet.

### Phase 11: Email Notifications
- **Objective:** Automate communication via Resend.
- **Why this phase comes now:** The booking logic is stable and tested; safe to add external side-effects.
- **Files/folders involved:** `src/lib/email/*`.
- **Database changes:** None.
- **Backend logic:** API calls to Resend upon booking creation or cancellation.
- **UI/admin pages:** None.
- **Security/RLS:** Keep API keys server-side.
- **Testing:** Book a test appointment and verify email receipt.
- **Acceptance criteria:** Customer and admin receive correct HTML emails.
- **What not to do:** Do not build SMS notifications.

### Phase 12: Safety, Consent & Notes
- **Objective:** Ensure clinical compliance.
- **Why this phase comes now:** A final polish on the data collected to meet business needs.
- **Files/folders involved:** Booking frontend, Admin booking details.
- **Database changes:** Add specific consent columns if not already in `bookings`.
- **Backend logic:** Save admin treatment notes.
- **UI/admin pages:** Checkboxes on frontend, rich text area for treatment notes in admin.
- **Security/RLS:** Standard admin protections.
- **Testing:** Verify consent boolean is saved.
- **Acceptance criteria:** Treatment notes can be saved and viewed on a per-booking basis.
- **What not to do:** Do not build a massive multi-page medical intake form.

### Phase 13: Security & RLS Hardening
- **Objective:** Final lockdown of the database.
- **Why this phase comes now:** All queries are written, so we know exactly what access is legitimately required.
- **Files/folders involved:** `supabase/migrations/*`.
- **Database changes:** Update RLS policies.
- **Backend logic:** None.
- **UI/admin pages:** None.
- **Security/RLS:** Audit all tables for strictly least-privilege access.
- **Testing:** Attempt raw SQL inserts from an unauthenticated client.
- **Acceptance criteria:** Database is fully secure from public tampering.
- **What not to do:** Do not deploy without completing this.

### Phase 14: QA & Regression
- **Objective:** Final verification before handoff.
- **Why this phase comes now:** Development is complete.
- **Files/folders involved:** N/A.
- **Database changes:** None.
- **Backend logic:** None.
- **UI/admin pages:** N/A.
- **Security/RLS:** Final review.
- **Testing:** End-to-end booking flow, mobile responsiveness checks on admin tables.
- **Acceptance criteria:** System is bug-free and visually matches the branding guide.
- **What not to do:** Do not introduce new features.

## 13. Testing and Verification Plan
- **Admin Flow Checks:** Verify middleware correctly redirects unauthenticated users.
- **Booking Flow Checks:** Submit test bookings. Verify slots disappear after booking. Verify cancelled slots reappear.
- **RLS/Security Checks:** Attempt to query `bookings` table from the public client to ensure it is blocked.
- **Mobile Checks:** Ensure all admin tables and detail pages are responsive and usable on mobile devices.

## 14. Risks and Edge Cases
- **Double-Booking:** Race conditions when two users select the same slot. *Mitigation:* Use database-level constraints or transaction locks during insertion.
- **Gender Assignment:** A male therapist accidentally claiming a female client's booking. *Mitigation:* UI blocking and server-side validation.
- **Timezones:** Luton operates on UK time (GMT/BST). *Mitigation:* Ensure all date parsing explicitly handles London timezone rather than assuming UTC blindly on the frontend.
- **Address Validation:** Bad postcodes causing travel issues. *Mitigation:* Zod validation exists, but consider a basic UK postcode regex.

## 15. Final Implementation Checklist
- [ ] Approve this Implementation Plan.
- [ ] Create `task.md` based on the phases.
- [ ] Execute Phase 1 (Supabase Setup).
- [ ] Execute Phase 2 (Database Migrations).
- [ ] Execute Phase 3 (Auth & Middleware).
- [ ] Execute Phase 4 (Services CRUD).
- [ ] Execute Phase 5 (Availability Setup).
- [ ] Execute Phase 6 (Booking Engine).
- [ ] Execute Phase 7 (Client CRM).
- [ ] Execute Phase 8 (Admin Bookings).
- [ ] Execute Phase 9 (Staff Assignment).
- [ ] Execute Phase 10 (Dashboard).
- [ ] Execute Phase 11 (Emails).
- [ ] Execute Phase 12 (Notes & Consent).
- [ ] Execute Phase 13 (RLS & Security).
- [ ] Execute Phase 14 (QA).
