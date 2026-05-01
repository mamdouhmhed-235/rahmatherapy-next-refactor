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
- **Availability & Rolling Window (CRUD Managed):** The system features a two-layer availability model:
  1. **Global/Universal Availability:** A default business schedule set by Owners or users with `manage_availability_global`. Includes default working days, times, booking window, minimum notice, and buffer times.
  2. **Individual Staff Availability:** Each eligible staff member can have their own schedule. Staff profiles have an `availability_mode` (`use_global`, `custom`, or `global_with_overrides`). 
  The frontend calendar aggregates these layers to show slots where *at least one* suitable therapist is available. The admin/owner decides how many days or weeks in advance a user can book via settings.
- **Buffer Time (CRUD Managed):** The system will default to a 30-minute travel buffer between mobile appointments, but this will be fully editable (or disableable by setting it to 0) via the `/admin/settings` page.
- **Payment Tracking:** Customers pay in person. The admin can edit every booking to record whether the payment was made via **cash** or **card**, and update the status to **paid** or **unpaid**.
- **Admin CMS Architecture:** The custom admin CRM will be built seamlessly within the Next.js app under `/admin`, securely hidden from the public using Supabase RLS and Next.js server-side route protection. All business rules, settings, and services will be managed via CRUD interfaces rather than hardcoding.
- **Role-Based Access Control (RBAC):** The system uses a strict RBAC model, distinguishing between system management permissions and treatment eligibility. For example, a male Super Admin can manage the whole system, but cannot personally take female-client bookings unless explicitly eligible. Inactive staff cannot log in, take bookings, or appear available.

## 3. Final Backend Scope
**What will be built (MVP boundaries):**
- **Public Booking API:** Endpoint to submit bookings from the existing frontend flow.
- **Client Booking Management:** A secure, unique UUID-based URL generated for each booking, allowing customers to easily cancel or add notes without needing an account.
- **Authentication & RBAC:** Secure login via Supabase Auth powered by a granular Role-Based Access Control system (Owner, Admin, Therapist, Inactive).
- **Services Management:** Admin capability to CRUD services/packages (syncing with the frontend).
- **Dynamic Availability Engine:** Logic to calculate rolling booking windows, blocked dates, and double-booking prevention.
- **Staff CRM & Booking Management:** Assigning/claiming booking assignments, managing client history, and enforcing treatment eligibility rules (e.g., gender, `can_take_bookings` flag).
- **Admin Dashboard:** Key metrics overview (revenue, booking statuses) with a highly visible "Needs Attention" badge for unassigned/new booking assignments.
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

### `roles`
- **Purpose:** Defines the core roles in the RBAC system.
- **Important Columns:** `id` (uuid, PK), `name` (text, e.g., 'Owner', 'Admin', 'Therapist'), `description` (text).
- **Relationships:** Referenced by `staff_profiles` and `role_permissions`.

### `permissions`
- **Purpose:** Defines the granular permissions available in the system.
- **Important Columns:** `id` (uuid, PK), `name` (text, e.g., 'manage_users'), `description` (text).
- **Relationships:** Referenced by `role_permissions`.

### `role_permissions`
- **Purpose:** Maps permissions to roles.
- **Important Columns:** `role_id` (uuid, PK), `permission_id` (uuid, PK).
- **Relationships:** References `roles(id)` and `permissions(id)`.

### `staff_permission_overrides` (Optional)
- **Purpose:** Allows assigning specific permissions to a user directly, bypassing or adding to their role.
- **Important Columns:** `staff_id` (uuid, PK), `permission_id` (uuid, PK), `is_granted` (boolean).
- **Relationships:** References `staff_profiles(id)` and `permissions(id)`.

### `staff_profiles`
- **Purpose:** Stores staff information, RBAC assignment, and treatment eligibility.
- **Important Columns:** `id` (uuid, PK), `auth_user_id` (uuid, nullable, references `auth.users(id)`), `name` (text), `email` (text), `role_id` (uuid), `gender` (enum: male, female), `active` (boolean), `can_take_bookings` (boolean), `availability_mode` (enum: use_global, custom, global_with_overrides), `created_by` (uuid), `updated_by` (uuid), `created_at`, `updated_at`.
- **Relationships:** `role_id` references `roles(id)`. `auth_user_id` links to Supabase Auth.
- **Pages/Features:** `/admin/staff`, booking assignment logic.
- **Constraints:** Email must be unique.
- **RLS Notes:** Read-only for authenticated admins/staff. Public has no access.

### `services`
- **Purpose:** Stores the packages and treatments offered.
- **Important Columns:** `id` (uuid, PK), `slug` (text), `name` (text), `group_category` (text), `short_description` (text), `full_description` (text), `suitable_for_notes` (text), `gender_restrictions` (enum: any, male_only, female_only), `price` (numeric), `duration_mins` (int), `is_active` (boolean), `is_visible_on_frontend` (boolean), `display_order` (int).
- **Relationships:** None.
- **Pages/Features:** Public booking flow, `/admin/services`.
- **Constraints:** `slug` must be unique.
- **RLS Notes:** Read-only for public. Full CRUD for authorized staff.

### `clients`
- **Purpose:** Simple CRM storage for customer details and history.
- **Important Columns:** `id` (uuid, PK), `full_name` (text), `phone` (text), `email` (text), `gender_preference` (enum: male, female, no_preference), `address` (text), `postcode` (text), `notes` (text), `created_at`, `updated_at`.
- **Relationships:** None directly, but `bookings` references this table.
- **Pages/Features:** `/admin/clients`, `/admin/clients/[id]`.
- **Constraints:** Email must be unique.
- **RLS Notes:** Public can insert (via secure server route). Read/Update restricted to authorized staff.

### `bookings`
- **Purpose:** Core transaction record representing a customer's appointment. Supports group bookings at a single location.
- **Important Columns:** `id` (uuid, PK), `client_id` (uuid), `booking_date` (date), `start_time` (time), `end_time` (time), `total_duration_mins` (int), `total_price` (numeric), `payment_method` (enum: cash, card), `payment_status` (enum: paid, unpaid), `status` (enum: pending, confirmed, completed, cancelled, no_show), `assignment_status` (enum: unassigned, partially_assigned, fully_assigned), `group_booking` (boolean), `manage_token_hash` (text, nullable), `manage_token_expires_at` (timestamp, nullable), `customer_cancelled_at` (timestamp, nullable), `customer_manage_notes` (text, nullable), `service_address_line1`, `service_address_line2`, `service_city`, `service_postcode`, `access_notes`, `customer_notes`, `admin_notes`, `created_at`, `updated_at`.
- **Relationships:** `client_id` references `clients(id)`.
- **Pages/Features:** `/admin/bookings`, Dashboard, Staff claiming.
- **Constraints:** Dates/times must be valid. `manage_token_hash` and `manage_token_expires_at` support the secure customer manage/cancel link, and raw tokens must never be stored.
- **RLS Notes:** Public can insert (via secure backend). Access restricted by RBAC.

### `booking_participants`
- **Purpose:** Replaces simple `number_of_people` counts. Every person gets a participant record to handle male/female participants correctly. `number_of_people` can only be a derived field for display purposes.
- **Important Columns:** `id` (uuid, PK), `booking_id` (uuid), `participant_gender` (enum: male, female), `required_therapist_gender` (enum: male, female), `is_main_contact` (boolean). (`participant_gender` = the participant's gender, `required_therapist_gender` = the therapist gender required for treatment).
- **Relationships:** References `bookings(id)`.

### `booking_items`
- **Purpose:** Stores the multiple services selected for a booking or a specific participant.
- **Important Columns:** `id` (uuid, PK), `booking_id` (uuid, nullable), `booking_participant_id` (uuid, nullable), `service_id` (uuid), `service_name_snapshot` (text), `service_price_snapshot` (numeric), `service_duration_snapshot` (int).
- **Relationships:** References `bookings(id)`, `booking_participants(id)`, and `services(id)`.
- **Pages/Features:** Booking creation, `/admin/bookings/[id]`.
- **Constraints:** Snapshot values must not be null to preserve historical revenue.
- **RLS Notes:** Insert for public via backend. Access restricted by RBAC.

### `booking_assignments`
- **Purpose:** Connects the participant to the assigned staff member for tracking.
- **Important Columns:** `id` (uuid, PK), `booking_id` (uuid), `participant_id` (uuid), `assigned_staff_id` (uuid, nullable), `required_therapist_gender` (enum: male, female), `status` (enum: unassigned, assigned, completed, cancelled, no_show), `created_at`, `updated_at`.
- **Relationships:** References `bookings(id)`, `booking_participants(id)`, and `staff_profiles(id)`.
- **Pages/Features:** Dashboard, Staff claiming, `/admin/bookings/[id]`.
- **Constraints:** `required_therapist_gender` is copied from the participant requirement at booking creation time so assignment claiming can validate directly without relying only on joins. Only staff matching the required gender profile can be assigned.

### `availability_rules`
- **Purpose:** Defines the global/default weekly repeating hours of operation.
- **Important Columns:** `id` (uuid, PK), `day_of_week` (int 0-6), `start_time` (time), `end_time` (time), `is_working_day` (boolean).
- **Relationships:** None.
- **Pages/Features:** Slot generation logic, `/admin/availability`.
- **Constraints:** Valid day integers and time formats.
- **RLS Notes:** Read-only for public. Management restricted by RBAC.

### `blocked_dates`
- **Purpose:** Explicit dates where the business is entirely closed globally (holidays, emergencies).
- **Important Columns:** `id` (uuid, PK), `blocked_date` (date), `reason` (text).
- **Relationships:** None.
- **Pages/Features:** Slot generation logic, `/admin/availability`.
- **Constraints:** Date must be unique.
- **RLS Notes:** Read-only for public. Management restricted by RBAC.

### `availability_overrides`
- **Purpose:** Allows admins to adjust global hours for a specific date that differs from the standard rules.
- **Important Columns:** `id` (uuid, PK), `override_date` (date), `start_time` (time), `end_time` (time), `reason` (text).
- **Relationships:** None.
- **Pages/Features:** Slot generation logic, `/admin/availability`.
- **Constraints:** Date must be unique.
- **RLS Notes:** Read-only for public. Management restricted by RBAC.

### `staff_availability_rules`
- **Purpose:** Defines custom weekly repeating hours for specific staff.
- **Important Columns:** `id` (uuid, PK), `staff_id` (uuid), `day_of_week` (int 0-6), `start_time` (time), `end_time` (time), `is_working_day` (boolean).
- **Relationships:** References `staff_profiles(id)`.
- **Pages/Features:** Slot generation, `/admin/staff/[staffId]/availability`.

### `staff_blocked_dates`
- **Purpose:** Specific dates blocked for a particular staff member (e.g., PTO).
- **Important Columns:** `id` (uuid, PK), `staff_id` (uuid), `blocked_date` (date), `reason` (text).
- **Relationships:** References `staff_profiles(id)`.
- **Pages/Features:** Slot generation, `/admin/staff/[staffId]/availability`.

### `staff_availability_overrides`
- **Purpose:** Staff-specific overrides for a given date.
- **Important Columns:** `id` (uuid, PK), `staff_id` (uuid), `override_date` (date), `start_time` (time), `end_time` (time), `override_type` (text), `reason` (text).
- **Relationships:** References `staff_profiles(id)`.
- **Pages/Features:** Slot generation, `/admin/staff/[staffId]/availability`.

### `business_settings`
- **Purpose:** Global configuration variables to ensure all business rules are CRUD-editable by the admin, eliminating the need for hardcoding.
- **Important Columns:** `id` (int, PK), `company_name`, `contact_email`, `contact_phone` (text), `booking_window_days` (int), `allowed_cities` (text array/jsonb), `buffer_time_mins` (int), `minimum_notice_hours` (int), `booking_status_enabled` (boolean).
- **Relationships:** None.
- **Pages/Features:** Slot generation, `/admin/settings`.
- **Constraints:** Only row with ID=1 should exist.
- **RLS Notes:** Read-only for public. Management restricted by RBAC.

### `audit_logs`
- **Purpose:** Tracks important admin actions for accountability and troubleshooting.
- **Important Columns:** `id` (uuid, PK), `actor_staff_id` (uuid, references `staff_profiles(id)`), `action_type` (text), `target_type` (text), `target_id` (uuid), `before_state` (jsonb, nullable), `after_state` (jsonb, nullable), `created_at` (timestamp).
- **Examples of tracked actions:** User role changed, permission changed, staff deactivated, booking reassigned, availability changed, service price changed, payment status changed.

## 6. Auth and Role Model
- **Admin/Staff Only:** Customers do not log in.
- **Role-Based Access Control (RBAC):** The system relies on granular permissions mapped to roles, rather than a flat enum hierarchy.
  - **1. Owner / Super Admin:** Can do everything. Can create users, invite users, deactivate users, assign roles, create/edit/delete roles, assign permissions to roles, assign direct permission overrides if supported, give another user the same level of access as themselves, and manage every part of the system.
  - **2. Admin / Manager:** Can manage bookings, clients, services, availability, dashboard, and business operations depending on assigned permissions.
  - **3. Therapist / Staff:** Can see their own assignments. Can see unassigned assignments they are eligible to claim (matching gender). For group bookings, can see it is a group booking and shared appointment context/address. Cannot claim another-gender participant/assignment. Can update status/add notes depending on permissions.
  - **4. Inactive Staff:** Cannot log in to the admin system. Cannot take bookings. Cannot appear as available to customers.
- **Separation of Concerns:** Management permissions are strictly separated from treatment eligibility. A male Super Admin can manage the system but cannot automatically take female-client bookings unless his profile is eligible (`can_take_bookings = true`, matching gender logic).
- **Key Permissions List:**
  - `manage_users`
  - `manage_roles`
  - `manage_services`
  - `manage_availability_global`
  - `manage_availability_own`
  - `manage_bookings_all`
  - `manage_bookings_own`
  - `claim_bookings`
  - `reassign_bookings`
  - `manage_clients`
  - `manage_payments`
  - `view_dashboard`
  - `manage_settings`
  - `manage_staff`
  - `view_reports`
  - `manage_emails`
- **Required Lockout Protections:** The system must prevent:
  - Deleting the last Super Admin.
  - Deactivating the last active Super Admin.
  - Removing `manage_users` from the last active Super Admin.
  - Removing `manage_roles` from the last active Super Admin.
  - Removing the last role that contains full ownership permissions.
  - Changing your own permissions in a way that locks you out.
  - Creating a system state where no active user can manage users and roles.
- **Protected Routes:** Next.js Middleware and server-side utilities will protect all routes under `/admin/*` and strictly verify permissions before allowing access or executing Server Actions.

## 7. Availability, Location, and Booking Logic
- **Location Restrictions:** The frontend will require users to select their city/town/area. If the selected area is not within the admin-defined `allowed_cities` list, the booking request will be blocked with a clear notification stating the business does not cover that area.
- **Booking Flow Sequence (Gender-First):** The frontend booking flow must collect required information in a strict sequence *before* querying the availability engine:
  1. **Step 1: Choose service/package.** Required first because service duration affects slot calculation.
  2. **Step 2: Choose participant demographics.** Customer selects "Male client", "Female client", or "Group booking". If group booking, collect participant count and each participant's gender.
  3. **Step 3: Choose location.** Customer provides city/town/area. The system checks this against `allowed_cities` to enforce geo-fencing.
  4. **Step 4: Choose Date and Time.** Only now does the system calculate available slots. It matches the requested service duration, participant gender(s), and location against the active schedules of eligible, gender-matching therapists.
- **Concurrent Capacity:** **One booking per available matching therapist/assignment slot**. The system checks capacity on a per-participant/assignment basis, allowing concurrent bookings as long as they are assigned to different therapists.
- **Group Bookings:** Group bookings are broken down into `booking_participants` and their corresponding `booking_assignments`. All participants in a group booking must have simultaneous start times. Each assignment blocks the relevant therapist for their specific service duration plus buffer. The parent booking end time is the latest end time across all constituent assignments. The parent booking reflects `assignment_status` (e.g., `partially_assigned` until all parts are claimed).
- **Rolling Window:** Customers can only view/book dates between `Current Date + minimum_notice_hours` and `Current Date + booking_window_days`. On the frontend calendar, available days and times will be clearly visible, based on aggregated staff schedules.
  1. Frontend sends booking payload (service, gender(s), location).
  2. Retrieve global rules, overrides, and blocks.
  3. Retrieve staff profiles (`can_take_bookings = true`) and their personal availability modes/rules.
  4. Retrieve existing active booking_assignments per therapist, joined to parent bookings where needed.
  5. Calculate slots by checking if *at least one* suitable therapist (matching the requested gender constraints and location) has enough free time for `requested_duration + buffer_time_mins`.
- **Double-Booking Prevention:** Checked server-side per therapist during assignment claiming and insertion using transactions to ensure a specific therapist isn't double-booked.
- **Cancelled Slots:** If a whole booking is cancelled, all slots reopen. If a single assignment is cancelled, only that specific staff member's slot reopens. `completed` or `no_show` statuses prevent slot reopening.

## 8. Admin CRM Architecture
Pages to be implemented (All emphasizing easy CRUD management, guarded by RBAC):
- `/admin/dashboard`: High-level metrics.
- `/admin/bookings`: Filterable/sortable list.
- `/admin/bookings/[bookingId]`: Deep dive into a booking to manage status, assignments, payment, and notes. Shows breakdown of participants and their assignment statuses.
- `/admin/clients` & `/admin/clients/[clientId]`: Customer profiles and history.
- `/admin/services`: Full CRUD interface for treatments and packages.
- `/admin/availability`: CRUD UI to manage **global business availability** (standard working hours, blocked dates, and overrides). Restricted to `manage_availability_global` or Owners.
- `/admin/settings`: CRUD interface for global business variables (buffer times, booking windows, etc).
- **Staff & Roles Management:**
  - `/admin/staff`: Manage staff profiles, view workload, set `active` status, and set `can_take_bookings` flag.
  - `/admin/staff/[staffId]`: Detailed view to assign roles, permission overrides.
  - `/admin/staff/[staffId]/availability`: A dedicated tab or page to manage an individual staff member's personal schedule (`custom`, `use_global`, etc.). Staff with `manage_availability_own` can edit their own; Owners/Super Admins can edit anyone's.
  - `/admin/roles`: View and manage system roles.
  - `/admin/roles/[roleId]`: Detail view to edit role permissions.
  - **Safety Confirmation UX:** Dangerous permission changes must use confirmation modals. Examples include changing a user's role to Owner/Super Admin, removing Owner/Super Admin, deactivating an admin, deleting a role, or removing high-level permissions.

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
  - Unassigned and partially assigned bookings.
  - Bookings per staff member.
  - Repeat clients vs. New clients.
  - Average booking value.
- **Calculation:** Handled via server-side SQL aggregations or Supabase RPCs.
- **Filtering:** Provide simple date range filters (e.g., "This Week", "This Month").

## 11. Required Backend Logic & API Routes
The following logical boundaries/Server Actions will be required:
- `requirePermission(permission)`: Core utility/middleware to block server actions or routes if the authenticated user lacks the required RBAC permission.
- `verifyLockoutProtections(action, payload)`: Validates that a requested role/permission change will not lock out the system or deactivate the last active Super Admin.
- `calculateAvailableSlots(payload)`: Reads global rules, staff-specific availability modes, personal overrides, blocks, and existing bookings to return valid times where a suitable therapist is free. The payload includes service_ids, booking_type, participant genders, required therapist genders, location, date(s), and durations.
- `createBookingTransaction(payload)`: Inserts client (or finds existing), inserts parent booking, inserts `booking_participants`, inserts `booking_assignments`, inserts `booking_items` snapshots, and sends emails. Protects against double booking.
- `claimBookingAssignment(assignmentId, staffId)`: Validates staff is active and `can_take_bookings` is true, validates `claim_bookings` permission, ensures assignment is `unassigned`, checks staff gender matches `required_therapist_gender`, prevents race conditions, updates assignment status, and updates parent booking `assignment_status` if all parts are assigned.
- `updateBookingStatus(bookingId, status, assignment_status, paymentMethod, paymentStatus)`: Marks completed, cancelled, or updates payment info.
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
- **[NEW] Build Health:** Resolve the `numberOfPeople` TypeScript mismatch in `BookingExperience.tsx` to ensure a clean build before starting database work.
- **What not to do:** Do not write schemas or UI yet.

### Phase 2: Database Schema & Migrations
- **Objective:** Create the remote database structure including RBAC tables, staff availability, and advanced booking logic.
- **Why this phase comes now:** Tables must exist before data can be managed or queried.
- **Files/folders involved:** `supabase/migrations/*`.
- **Database changes:** Create `roles`, `permissions`, `role_permissions`, `staff_permission_overrides`, `staff_profiles`, `services`, `clients`, `bookings`, `booking_participants`, `booking_items`, `booking_assignments`, `availability_rules`, `blocked_dates`, `availability_overrides`, `business_settings`, `audit_logs`, `staff_availability_rules`, `staff_blocked_dates`, `staff_availability_overrides`.
- **Backend logic:** None.
- **UI/admin pages:** None.
- **Security/RLS:** Set up base RLS policies leveraging the RBAC structure.
- **Testing:** Run migrations locally or against staging DB to verify relationships.
- **Acceptance criteria:** All tables exist with correct relationships and constraints.
- **What not to do:** Do not build the frontend fetching logic yet.

### Phase 3: Auth, RBAC, Roles, Permissions & Protected Admin Shell
- **Objective:** Secure the admin area, handle logins, and enforce the full RBAC system.
- **Why this phase comes now:** Admin pages and management logic cannot be built until there is a secure, permissioned place to put them.
- **Files/folders involved:** `src/app/admin/login`, `src/app/admin/layout.tsx`, `src/middleware.ts`, `src/lib/auth/rbac.ts`, `src/app/admin/roles/*`.
- **Database changes:** Seed default roles and permissions (Owner, Admin, Therapist).
- **Backend logic:** Supabase Auth sign-in logic, `requirePermission` utility, route access based on permissions, staff profile lookup.
- **UI/admin pages:** Login page, basic Admin layout shell (sidebar/navbar filtering based on permissions), `/admin/roles`, `/admin/roles/[roleId]`.
- **Security/RLS:** Middleware redirects unauthenticated/inactive users away. Implement Safety Confirmation UX for dangerous role changes.
- **Testing:** Verify an Inactive staff member cannot log in. Verify correct route access per role.
- **Acceptance criteria:** Authorized staff can log in, view protected dashboard, and manage roles if permitted; inactive staff are blocked.
- **What not to do:** Do not build complex dashboard metrics yet.

### Phase 4: Staff Profiles & Staff Availability
- **Objective:** Manage staff accounts, their treatment eligibility, and their individual availability.
- **Why this phase comes now:** Availability and bookings rely on active staff profiles with their own schedules and permissions.
- **Files/folders involved:** `src/app/admin/staff/*`.
- **Database changes:** None.
- **Backend logic:** Server actions for managing staff CRUD, toggling `active`/`can_take_bookings` flags, `availability_mode` (own schedule, global, or overrides).
- **UI/admin pages:** `/admin/staff` list, `/admin/staff/[staffId]` detail, `/admin/staff/[staffId]/availability`.
- **Security/RLS:** Restricted to `manage_users` and `manage_availability_own`/`manage_availability_global` permissions.
- **Testing:** Create a new staff profile, assign availability rules, and verify controls.
- **Acceptance criteria:** Admins can manage staff profiles, activity status, and set personal/global availability modes.
- **What not to do:** Do not connect this to the public booking calculation yet.

### Phase 5: Services & Packages CRUD
- **Objective:** Manage treatments and packages dynamically.
- **Why this phase comes now:** Booking availability calculations and flows rely on the services and their durations.
- **Files/folders involved:** `src/app/admin/services/*`.
- **Database changes:** Seed default services.
- **Backend logic:** Server actions for Create/Update/Delete services. Snapshots must still be required when bookings are made.
- **UI/admin pages:** `/admin/services` list view, and a modal/page for editing a service.
- **Security/RLS:** Restricted by `manage_services` permission.
- **Testing:** Create a new service and verify it appears in the database.
- **Acceptance criteria:** Admin can fully manage the service catalog via UI.
- **What not to do:** Do not build slot calculations yet.

### Phase 6: Global Settings & Universal Availability
- **Objective:** Create the operational rules for the business.
- **Why this phase comes now:** Slot generation depends on default global working hours, booking windows, and location settings.
- **Files/folders involved:** `src/app/admin/settings/*`, `src/app/admin/availability/*`.
- **Database changes:** Seed default `business_settings`.
- **Backend logic:** Server actions to update `business_settings`, global `availability_rules`, global `blocked_dates`, global `availability_overrides`, booking window, minimum notice, buffer time, allowed service areas.
- **UI/admin pages:** `/admin/settings`, `/admin/availability`.
- **Security/RLS:** Restricted by `manage_settings` and `manage_availability_global` permissions.
- **Testing:** Add a blocked date and verify it saves.
- **Acceptance criteria:** Authorized staff can update master switches, buffers, booking limits, and global working days.
- **What not to do:** Do not build the frontend booking flow yet.

### Phase 7: Gender-First Booking Flow Planning/Refactor
- **Objective:** Update the frontend booking flow to logically sequence data collection.
- **Why this phase comes now:** The UI must collect required parameters before slot calculations can happen.
- **Files/folders involved:** `src/features/booking/*`.
- **Database changes:** None.
- **Backend logic:** None.
- **UI/admin pages:** Refactor `BookingExperience.tsx` sequence: Service -> Gender/Group info -> Location -> *then* Calendar/Time Slots. Do not show the calendar too early.
- **Security/RLS:** N/A.
- **Testing:** Verify the form steps flow logically and collect accurate group/gender information.
- **Acceptance criteria:** User provides service, accurate participant genders, and location before they can query date/time availability.
- **What not to do:** Do not connect the backend slot calculation yet.

### Phase 8: Staff-Aware, Gender-Aware Slot Calculation
- **Objective:** Dynamically calculate available times based on granular availability and rules.
- **Why this phase comes now:** The frontend is ready to query; the database has staff, availability rules, and services.
- **Files/folders involved:** `src/app/api/availability/*`, `src/lib/booking/availability.ts`.
- **Database changes:** None.
- **Backend logic:** `calculateAvailableSlots(payload)`. Must match staff by gender, active status, `can_take_bookings`, permissions, individual availability, global availability inheritance, blocked dates, overrides, existing assignments/bookings, buffer time, minimum notice, and booking window.
- **UI/admin pages:** Integration with the calendar component in the booking flow.
- **Security/RLS:** Public read access via secure backend route.
- **Testing:** Request a mixed-group booking slot and verify it only shows times where *both* a male and female eligible therapist are simultaneously free.
- **Acceptance criteria:** The system accurately returns valid slots respecting all layered availability rules.
- **What not to do:** Do not insert bookings into the database yet.

### Phase 9: Booking Creation with Participants and Assignments
- **Objective:** Safely save the booking to the database with all relational parts.
- **Why this phase comes now:** Slots can be found, so now users need to finalize the booking.
- **Files/folders involved:** `src/app/api/bookings/*`, `src/features/booking/actions.ts`.
- **Database changes:** None.
- **Backend logic:** `createBookingTransaction(payload)`. Create or find client, create booking parent, create `booking_participants`, create `booking_items` snapshots, create `booking_assignments`. Recheck slot availability server-side immediately before insert to prevent double-booking.
- **UI/admin pages:** Final confirmation step in frontend flow.
- **Security/RLS:** Secure public server action to insert data.
- **Testing:** Submit a group booking and verify it properly creates parent, participants, and unassigned assignment rows.
- **Acceptance criteria:** Complex booking payloads are correctly normalized and safely inserted.
- **What not to do:** Do not build the Admin CMS viewing pages yet.

### Phase 10: Admin Booking Management
- **Objective:** View, edit, and update the lifecycle of bookings from the back office.
- **Why this phase comes now:** Staff need to see the bookings that customers are creating.
- **Files/folders involved:** `src/app/admin/bookings/*`.
- **Database changes:** None.
- **Backend logic:** Update booking status, payment status, and notes.
- **UI/admin pages:** `/admin/bookings` list view and `/admin/bookings/[bookingId]` detail page. Display group bookings clearly. Show assignment visibility and status.
- **Security/RLS:** Restricted by `manage_bookings_all` or `manage_bookings_own` permissions.
- **Testing:** Change a booking from pending to completed and mark as paid.
- **Acceptance criteria:** Staff with appropriate permissions can manage booking lifecycles and view participant breakdowns.
- **What not to do:** Do not build assignment claiming yet.

### Phase 11: Staff Claiming and Gender-Restricted Assignment
- **Objective:** Allow therapists to claim specific parts of a booking (assignments) and respect gender/eligibility constraints.
- **Why this phase comes now:** Admin can view the bookings and their participant breakdown; now they must be assigned to workers.
- **Files/folders involved:** booking detail pages, assignment components.
- **Database changes:** None.
- **Backend logic:** `claimBookingAssignment(assignmentId, staffId)`. Group bookings can become `partially_assigned` or `fully_assigned`.
- **UI/admin pages:** "Claim Assignment" buttons on unassigned segments for eligible staff.
- **Security/RLS:** Prevent claiming an already assigned segment without permission. Staff can only claim matching gender assignments.
- **Testing:** Verify a male therapist cannot claim a female participant's assignment.
- **Acceptance criteria:** Eligible staff can securely claim assignments, updating the status accordingly.
- **What not to do:** Do not build the dashboard metrics yet.

### Phase 12: Client CRM
- **Objective:** Track and view customer profiles.
- **Why this phase comes now:** Once bookings exist, we need to organize the people making them.
- **Files/folders involved:** `src/app/admin/clients/*`.
- **Database changes:** None.
- **Backend logic:** Queries to fetch clients and their booking histories, repeat client handling.
- **UI/admin pages:** `/admin/clients` list view and `/admin/clients/[clientId]` detail page.
- **Security/RLS:** Restricted by `manage_clients` permission.
- **Testing:** Search for a client by name or phone number.
- **Acceptance criteria:** Authorized staff can view a list of all clients and click in to see their past/future bookings.
- **What not to do:** Do not build email notifications yet.

### Phase 13: Dashboard Metrics
- **Objective:** Provide a business overview.
- **Why this phase comes now:** The full lifecycle of data (bookings, assignments, clients) is now in the system.
- **Files/folders involved:** `src/app/admin/dashboard/*`.
- **Database changes:** None.
- **Backend logic:** Aggregation queries for total bookings, unassigned assignments, partially assigned bookings, fully assigned bookings, revenue, staff workload, most booked services, repeat clients, average booking value.
- **UI/admin pages:** `/admin/dashboard`.
- **Security/RLS:** Restricted by `view_dashboard` or `view_reports` permissions.
- **Testing:** Verify revenue totals match completed bookings.
- **Acceptance criteria:** Dashboard accurately reflects database state and assignments for authorized users.
- **What not to do:** Do not overcomplicate with highly granular charting yet.

### Phase 14: Email Notifications
- **Objective:** Automate communication via Resend.
- **Why this phase comes now:** The booking logic is stable and tested; safe to add external side-effects.
- **Files/folders involved:** `src/lib/email/*`.
- **Database changes:** None.
- **Backend logic:** API calls to Resend upon booking creation or cancellation. Group booking wording if relevant. Confirmation email, cancellation email, reminder email, admin notification.
- **UI/admin pages:** None.
- **Security/RLS:** Keep API keys server-side.
- **Testing:** Book a test appointment and verify email receipt.
- **Acceptance criteria:** Customer and admin receive correct HTML emails with participant context.
- **What not to do:** Do not build SMS notifications.

### Phase 15: Safety, Consent & Notes
- **Objective:** Ensure clinical compliance.
- **Why this phase comes now:** A final polish on the data collected to meet business needs.
- **Files/folders involved:** Booking frontend, Admin booking details.
- **Database changes:** Add specific consent columns if not already in `bookings`.
- **Backend logic:** Save admin treatment notes, health notes.
- **UI/admin pages:** Consent checkboxes on frontend, rich text area for treatment/admin notes in admin.
- **Security/RLS:** Standard RBAC protections for reading/writing notes.
- **Testing:** Verify consent boolean is saved.
- **Acceptance criteria:** Treatment notes can be saved and viewed on a per-booking basis.
- **What not to do:** Do not build a massive multi-page medical intake form.

### Phase 16: Security & RLS Hardening
- **Objective:** Final lockdown and audit of the database.
- **Why this phase comes now:** While base RLS, schema, and access logic are built from the beginning (Phases 2 & 3), all queries are now written, allowing for a final, comprehensive audit to guarantee no permission leaks exist before production.
- **Files/folders involved:** `supabase/migrations/*`.
- **Database changes:** Update RLS policies.
- **Backend logic:** None.
- **UI/admin pages:** None.
- **Security/RLS:** Full least-privilege RLS audit. Public insert only through safe server flow if possible. Staff cannot bypass gender rules. Staff cannot claim another-gender assignments. Inactive users cannot access admin or take bookings. Super Admin lockout protections.
- **Testing:** Attempt raw SQL inserts from an unauthenticated client.
- **Acceptance criteria:** Database is fully secure from public and unauthorized internal tampering.
- **What not to do:** Do not deploy without completing this.

### Phase 17: QA & Regression
- **Objective:** Final verification before handoff.
- **Why this phase comes now:** Development is complete.
- **Files/folders involved:** N/A.
- **Database changes:** None.
- **Backend logic:** None.
- **UI/admin pages:** N/A.
- **Security/RLS:** Final review.
- **Testing:** Full booking flow. Gender-based slots. Staff availability inheritance. Mixed group booking. RLS. Dashboard accuracy. Mobile admin responsiveness. Existing frontend regression.
- **Acceptance criteria:** System is bug-free and visually matches the branding guide.
- **What not to do:** Do not introduce new features.

## 13. Testing and Verification Plan
- **Admin Flow Checks:** Verify middleware correctly redirects unauthenticated users and enforces RBAC logic correctly (e.g., Therapist cannot access `/admin/settings`).
- **Inactive Staff Checks:** Verify inactive staff cannot log in, and users without `can_take_bookings` cannot claim bookings for themselves.
- **Lockout Protection Checks:** Ensure tests cover that the last Super Admin cannot be deactivated or deleted, and `manage_users`/`manage_roles` cannot be removed from them. Verify a Super Admin can grant another user Super Admin-level permissions, and non-authorized users cannot manage roles or permissions.
- **Booking Flow Checks:** Submit test bookings including mixed-gender group bookings. Verify assignments are properly split and the booking reflects `partially_assigned` correctly until all assignments are claimed. Verify a slot disappears only if all matching therapists for that slot are booked.
- **RLS/Security Checks:** Attempt to query `bookings` table from the public client to ensure it is blocked.
- **Mobile Checks:** Ensure all admin tables and detail pages are responsive and usable on mobile devices.

## 14. Risks and Edge Cases
- **RBAC Lockout:** A Super Admin accidentally revoking their own access or modifying the core Owner role. *Mitigation:* Implement strict `verifyLockoutProtections` logic preventing deletion/deactivation of the last Super Admin or removal of critical permissions, alongside Safety Confirmation UX modals for high-risk actions.
- **Double-Booking:** Race conditions when two users select the same slot for the same therapist profile or two staff try to claim the same assignment. *Mitigation:* Use database-level constraints or transaction locks during assignment claiming/insertion.
- **Gender Assignment:** A male therapist accidentally claiming a female assignment. *Mitigation:* `claimBookingAssignment` action strict server-side validation against both `can_take_bookings` and gender rules.
- **Timezones:** Luton operates on UK time (GMT/BST). *Mitigation:* Ensure all date parsing explicitly handles London timezone rather than assuming UTC blindly on the frontend.
- **Address Validation:** Bad postcodes causing travel issues. *Mitigation:* Zod validation exists, but consider a basic UK postcode regex.

## 15. Final Implementation Checklist
- [ ] Approve this Implementation Plan.
- [ ] Create `task.md` based on the phases.
- [ ] Execute Phase 1 (Supabase Setup & Environment).
- [ ] Execute Phase 2 (Database Schema & Migrations).
- [ ] Execute Phase 3 (Auth, RBAC, Roles, Permissions & Protected Admin Shell).
- [ ] Execute Phase 4 (Staff Profiles & Staff Availability).
- [ ] Execute Phase 5 (Services & Packages CRUD).
- [ ] Execute Phase 6 (Global Settings & Universal Availability).
- [ ] Execute Phase 7 (Gender-First Booking Flow Planning/Refactor).
- [ ] Execute Phase 8 (Staff-Aware, Gender-Aware Slot Calculation).
- [ ] Execute Phase 9 (Booking Creation with Participants and Assignments).
- [ ] Execute Phase 10 (Admin Booking Management).
- [ ] Execute Phase 11 (Staff Claiming and Gender-Restricted Assignment).
- [ ] Execute Phase 12 (Client CRM).
- [ ] Execute Phase 13 (Dashboard Metrics).
- [ ] Execute Phase 14 (Email Notifications).
- [ ] Execute Phase 15 (Safety, Consent & Notes).
- [ ] Execute Phase 16 (Security & RLS Hardening).
- [ ] Execute Phase 17 (QA & Regression).

## 16. Consistency Review Summary
- **Major contradictions removed:** 
  - Purged all references to simple role enums (admin/therapist); strictly using the dynamic RBAC schema (`roles`, `permissions`, `role_permissions`, `staff_profiles.role_id`).
  - Removed outdated global-only availability assumptions; the plan now enforces a dual-layer global + individual staff availability model with three modes (`use_global`, `custom`, `global_with_overrides`).
  - Removed whole-business singular booking constraints; capacity is now explicitly "one booking per available matching therapist/assignment slot".
  - Eliminated single `bookings.assigned_staff_id` and simple `claimBooking(bookingId, staffId)` functions in favor of `booking_assignments` and `claimBookingAssignment(assignmentId, staffId)`.
  - Replaced `number_of_people` as the core group booking driver with the `booking_participants` data model (`number_of_people` is now strictly a derived display field).
- **Major model changes confirmed:** 
  - Gender-first frontend flow is mandated (Service → Demographics → Location → Dates/Times).
  - Gender awareness is strictly enforced at *both* the early slot calculation stage and the later assignment/claiming stage.
  - Granular RBAC includes critical Super Admin safety protections (e.g., preventing the last Super Admin from being deleted or losing core management access) while allowing a Super Admin to grant equal permissions to others.
  - Inactive staff are explicitly blocked from logging in, appearing available, or taking bookings.
  - Staff visibility is properly separated from staff claiming permissions (e.g., therapists can see shared appointment contexts but cannot claim participants of another gender).
  - RLS and security are noted as foundational from the start (Phase 2/3), with a final hardening audit in Phase 16.
- **Remaining assumptions/questions:** 
  - Are there any specific edge cases for group bookings where participants arrive at different times, or are all group bookings strictly simultaneous? (Assumed simultaneous).
  - Is `staff_permission_overrides` fully necessary for V1 MVP, or can we rely strictly on roles for now? (Marked as Optional).
