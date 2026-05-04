# Implementation Plan 3: Production-Ready Rahma Therapy Platform

## 1. Purpose

This plan turns the three-phase audit findings into an implementation roadmap for making Rahma Therapy production-ready.

It builds on the current direction of the system:

- Next.js App Router and React.
- Supabase Auth, Postgres, RLS, and service-role server flows.
- Public customer booking with no customer accounts.
- Admin CRM for staff, bookings, clients, services, roles, settings, availability, payments, notes, and assignment claiming.
- Gender-aware therapist availability and assignment.
- Resend transactional email.
- Sentry observability.
- Cloudflare/OpenNext deployment.

This is not a rewrite. The goal is to fix the audit findings, fill the missing operational gaps, improve the booking experience, modernize the admin CRM, and add the must-have production features needed for a real UK mobile therapy business.

## 2. Inputs And Audit Traceability

This plan is based on the audit artifacts created by Phases 1, 2, and 3:

- `implementation-plans/audit-review-findings/phase-1-architecture-codebase-database/`
- `implementation-plans/audit-review-findings/phase-2-e2e-admin-booking-ux/`
- `implementation-plans/audit-review-findings/phase-3-triage-roadmap/`

Primary GitHub issues referenced:

| Issue | Severity | Area | Summary |
| --- | --- | --- | --- |
| `#51` | P0 | Admin operations | Create and link initial active staff profiles for admin access and booking availability. |
| `#52` | P0 | Booking data integrity | Add atomic booking creation and database-level capacity protection. |
| `#58` | P1 | Booking UX | Fix group booking estimated total in public booking UI. |
| `#59` | P1 | CRM/data | Snapshot booking contact details for repeat customers. |
| `#65` | P1 | Privacy/observability | Review Sentry PII and local variable capture before production. |
| `#53` | P1 | Customer operations | Implement customer booking manage route before sending manage links. |
| `#60` | P1 | Admin UX | Make admin layout responsive on mobile. |
| `#54` | P2 | Timezone correctness | Make booking date and minimum-notice logic explicitly Europe/London aware. |
| `#55` | P2 | DevOps/data | Reconcile local Supabase migrations with live migration history. |
| `#61` | P2 | Booking UX | Replace stale static-slot copy with live availability messaging. |
| `#62` | P2 | Booking UX | Reset booking wizard step after successful submission. |
| `#63` | P2 | Admin/RBAC UX | Scope therapist booking detail controls to permitted actions. |

## 3. Product Direction

### 3.1 Chosen Direction

The chosen direction is a premium operations suite with a calm, dense, warm clinical CRM.

The admin experience should feel like a serious operational tool for a small healthcare-adjacent mobile therapy business:

- Fast to scan.
- Clear about what needs action.
- Reliable on mobile and desktop.
- Permission-aware.
- Privacy-aware.
- Focused on repeated daily use.

The public marketing site should not be redesigned as part of this plan. The only normal-user-facing surfaces in scope are:

- The booking flow.
- The customer booking manage/cancel/reschedule route.
- Transactional email-linked flows.

### 3.2 Production Readiness Definition

The platform is production-ready when:

- A real owner/admin can be safely provisioned.
- Active staff and therapist availability can be configured without raw DB access.
- Public booking cannot create partial records or overbook therapist capacity.
- Customer-visible totals match backend/admin totals.
- Repeat bookings preserve booking-specific contact, address, participant, consent, and health context.
- Customer manage links work or are not sent.
- Admin CRM is usable on mobile, tablet, and desktop.
- Admin users can create and manage bookings from non-website channels such as phone, WhatsApp, Instagram, referrals, and repeat-customer requests.
- Admin users can manually create clients and later convert those clients into bookings.
- Admin users can run daily operations from a calendar/agenda view as well as lists and dashboards.
- Owner/super-admin roles can see universal revenue and client/customer analytics across all time ranges.
- Lower-privilege roles can see only their own or permitted scoped revenue, workload, and client/customer metrics.
- Historical revenue, client, booking, payment, source, service, and staff reports can be filtered and exported safely.
- Role permissions are documented in a formal matrix and reflected consistently in navigation, data access, and actions.
- Therapist views expose only relevant, permitted controls.
- RLS blocks public/raw sensitive access.
- Sentry, Resend, and Cloudflare are production-safe.
- Privacy/data-retention operations exist for customer, booking, health, treatment, audit, and email records.
- The system passes the launch validation gates at the end of this document.

## 4. Global Constraints

- Do not rebuild the platform from scratch.
- Do not replace Supabase, Next.js, Resend, Sentry, or Cloudflare/OpenNext.
- Do not introduce online payments; payment remains in-person cash/card tracking.
- Do not expose staff names or raw therapist capacity to public booking users.
- Do not redesign public marketing pages unless separately approved.
- Do not add complex geocoding/routing unless separately approved.
- Keep staff treatment eligibility separate from admin permissions.
- Keep `booking_participants` as the source of truth for group composition.
- Keep `booking_assignments` as the source of truth for staff claiming.
- Preserve historical booking service snapshots.
- Treat health notes, treatment notes, contact details, addresses, and consent data as sensitive.
- Every new sensitive admin action must be permission-gated and audit-logged.
- Admin-created bookings must use the same validation, availability, gender matching, pricing, snapshots, and audit rules as public bookings.
- Staff assignment by an admin must use the same gender, active, `can_take_bookings`, availability, and permission rules as staff claiming.

## 5. Phase 0: Baseline, Branch, And Work Tracking

### Objective

Create a safe implementation baseline and make this plan the source of truth for remediation.

### Tasks

1. Create a working branch:
   - `implementation-plan-3-production-readiness`
2. Confirm baseline checks:
   - `pnpm lint`
   - `pnpm build`
   - `git diff --check`
   - Supabase migration status
   - Supabase security advisor
3. Record current live data counts:
   - staff profiles
   - active booking staff
   - clients
   - bookings
   - services
   - roles
   - audit logs
4. Convert the roadmap into a GitHub milestone or project board.
5. Group work into small PRs by phase or subsystem.

### Gate

Baseline checks either pass or failures are recorded before implementation begins.

## 6. Phase 1: Production Bootstrap, Security Defaults, And Migration Hygiene

### Objective

Remove the blockers that prevent real staff/admin use and safe production observability.

### 6.1 Production Owner/Admin Bootstrap

Add a safe first-admin bootstrap path.

Implementation requirements:

- Provide a server-only bootstrap command or script.
- Link an existing Supabase Auth user to `staff_profiles`.
- Require:
  - email
  - full name
  - gender
  - owner/super-admin role id or role name
- Refuse to run if an active critical admin already exists, unless an explicit reviewed override is supplied.
- Create the staff profile as:
  - `active = true`
  - `can_take_bookings = false` by default
  - `availability_mode = 'use_global'`
- Write an `audit_logs` row.
- Document exact usage in the production runbook.

Acceptance criteria:

- A real owner/admin can log into `/admin/dashboard`.
- A regular auth user without a staff profile remains blocked.
- Inactive staff remains blocked.
- Last critical admin protections still work.

### 6.2 Formal Role Matrix

Define the role and permission model before expanding the CRM.

Implementation requirements:

- Create a role matrix document covering:
  - Owner
  - Admin/Manager
  - Therapist
  - Reception or booking coordinator, if the business wants that role
  - Read-only/reporting, if the business wants that role
- For each role define:
  - visible admin navigation
  - readable booking/client/staff/payment/health data
  - writable actions
  - assignment permissions
  - availability permissions
  - payment permissions
  - reporting and export permissions
  - universal versus own-scope revenue visibility
  - universal versus own-scope client/customer visibility
  - sensitive note permissions
  - audit log access
- Align seeded roles, `PERMISSIONS`, sidebar visibility, server actions, and RLS assumptions with the matrix.
- Add the role matrix to the production runbook or implementation docs.

Acceptance criteria:

- Each admin route and server action maps to an intended role/permission.
- Reports and exports have explicit role scopes before analytics are implemented.
- Therapist views are intentionally scoped before UI expansion.
- New CRM conveniences do not accidentally broaden sensitive data access.

### 6.3 Migration Hygiene

Resolve migration reproducibility risk without rewriting applied production migrations.

Implementation requirements:

- Add a migration history note documenting live migration versions and corresponding local migration files.
- Future migrations must use new chronological timestamps.
- Do not rename already-applied migrations unless the team intentionally resets non-production environments.
- Add a repeatable migration status check to the launch checklist.

Acceptance criteria:

- A developer can understand which migrations are live and which checked-in files represent them.
- Future migrations are unambiguous.
- Supabase migration status is documented before launch.

### 6.4 Sentry Privacy Defaults

Harden Sentry before production use.

Implementation requirements:

- Set production `sendDefaultPii` to false in client, server, and edge configs.
- Disable `includeLocalVariables` in production.
- Add `beforeSend` scrubbing for:
  - names
  - emails
  - phone numbers
  - addresses
  - postcodes
  - health notes
  - consent notes
  - customer notes
  - admin notes
  - treatment notes
  - manage tokens
  - Supabase keys
  - Resend keys
  - Sentry auth tokens
- Preserve safe operational context:
  - route
  - error class
  - status code
  - safe booking id
  - safe staff id

Acceptance criteria:

- Sentry remains useful for debugging.
- Sensitive customer/admin/health data is not sent by default.
- Issue `#65` can be closed.

### Gate

- Real owner/admin bootstrap works.
- Role matrix is documented and matched to current permissions.
- Sentry privacy config is production-safe.
- Supabase security advisor has no security lints.
- Issues `#51`, `#55`, and `#65` are resolved or explicitly re-scoped.

## 7. Phase 2: Booking Data Model, Atomic Creation, And Repeat-Customer Correctness

### Objective

Make booking creation reliable, transactional, repeat-customer-safe, and ready for real traffic.

### 7.1 Booking-Level Contact Snapshots

Add booking-specific contact fields so repeat customers do not overwrite or obscure the details submitted for a specific appointment.

Database additions to `bookings`:

- `contact_full_name text not null`
- `contact_email text not null`
- `contact_phone text not null`
- `booking_source text not null default 'website'`
- `amount_due numeric`
- `amount_paid numeric`
- `paid_at timestamptz`
- `payment_note text`

Behavior:

- `clients` remains the deduplicated CRM profile by normalized email.
- Each booking stores the exact submitted contact details.
- Each booking records its source, such as `website`, `phone`, `whatsapp`, `instagram`, `referral`, or `admin`.
- On repeat booking:
  - the booking snapshot shows the new submitted contact details
  - the client profile may update to latest-known details
  - older bookings keep their original contact snapshots
- Payment fields support in-person cash/card operations without introducing online checkout.
- `amount_due` defaults to booking total, `amount_paid` defaults to zero until marked paid, and `paid_at` is set when payment is recorded.

Admin UX:

- Booking detail shows booking contact snapshot as primary.
- Linked client profile appears separately as CRM profile.
- Client detail shows contact history through booking records.
- Booking source appears in list/detail filters and reports.
- Payment detail shows amount due, amount paid, paid timestamp, method, status, and payment note.

Acceptance criteria:

- Two bookings with the same email but different phone/name/address both display their own booking-specific submitted details.
- Admin can distinguish website bookings from phone/WhatsApp/Instagram/referral/admin bookings.
- Admin can audit payment status and amount without relying only on a paid/unpaid flag.
- Issue `#59` can be closed.

### 7.2 Participant-Level Details

Upgrade group booking data so admins understand who each assignment belongs to.

Database additions to `booking_participants`:

- `display_name text`
- `participant_notes text`
- `health_notes text`
- `consent_acknowledged boolean not null default false`

Behavior:

- Main contact is stored on `bookings`.
- Participant identity and participant-specific context are stored on `booking_participants`.
- For one-person bookings, participant display name may default from contact full name.
- For group bookings, each participant should have a clear label or name.

Acceptance criteria:

- Mixed-gender group booking creates distinct participants with useful labels.
- Admin booking detail can show which participant needs which therapist gender.
- Health/consent context is not collapsed into one ambiguous booking note when participant-specific data exists.

### 7.3 Atomic Booking Creation

Replace the current sequential booking insert flow with a transactional database-backed flow.

Implementation approach:

- Add a Postgres RPC such as `public.create_booking_request`.
- Call it only from the server-side booking API using the service-role client.
- Keep validation at the API layer and enforce critical invariants inside the database transaction.

The RPC must:

- Normalize submitted email and contact fields.
- Validate selected service slugs.
- Validate participant genders and service gender restrictions.
- Validate city/service-area coverage.
- Validate booking window and minimum notice.
- Recalculate total duration and total price.
- Set `booking_source` to `website` for public booking requests.
- Set `amount_due`, `amount_paid`, and initial payment fields consistently.
- Recalculate required staff by gender.
- Recheck active staff, `can_take_bookings`, role/permission eligibility, gender, global availability, staff availability, blocked dates, overrides, existing bookings, assignments, and buffer time.
- Use transaction-scoped locking to prevent two simultaneous bookings consuming the same capacity.
- Insert/update `clients`.
- Insert `bookings`.
- Insert `booking_participants`.
- Insert `booking_items`.
- Insert `booking_assignments`.
- Return booking id and safe summary metadata.
- Roll back fully on any failure.

Acceptance criteria:

- Simulated concurrent requests cannot overbook the same staff capacity.
- Insert failure cannot leave partial booking rows.
- Group booking total is correct in database.
- Booking source and payment-detail fields are populated consistently.
- Issue `#52` can be closed.

### 7.4 Europe/London Date Handling

Make availability and minimum notice explicitly UK/London aware.

Implementation requirements:

- Centralize date/time helpers for:
  - local business date
  - day of week
  - minimum notice comparison
  - booking window comparison
  - date/time display
- Use Europe/London semantics consistently.
- Add BST boundary tests.

Acceptance criteria:

- Same date/time input behaves consistently regardless of server runtime timezone.
- Issue `#54` can be closed.

### 7.5 Revenue, Client, And Attribution Definitions

Define reporting metrics before building dashboards and exports.

Revenue definitions:

- `booked_revenue`: total booking value created in a period.
- `expected_revenue`: confirmed or upcoming unpaid revenue.
- `collected_revenue`: actual amount paid in a period.
- `outstanding_revenue`: amount due minus amount paid.
- `completed_revenue`: paid/completed booking revenue.
- `cancelled_revenue`: cancelled booking value tracked as lost or excluded from collected totals.
- `no_show_revenue`: no-show value tracked separately from collected totals.

Client/customer definitions:

- `total_clients`: all client profiles ever created.
- `new_clients`: client profiles created in a selected period.
- `repeat_clients`: clients with more than one booking.
- `active_clients`: clients with at least one booking in the selected period.
- `upcoming_clients`: clients with future bookings.
- `manual_clients`: clients created manually by admin.
- `website_clients`: clients created through public booking.
- `participant_count`: number of booking participants, which is separate from client profile count.

Attribution rules:

- Booking-level revenue belongs to the business total.
- Staff revenue views must not double-count group bookings with multiple therapists.
- For staff/role reporting, attribute revenue by booking item or participant assignment rather than assigning full booking total to every therapist.
- Staff workload and staff revenue must be separate metrics.
- Source/channel reporting uses `booking_source` for bookings and enquiry source for leads.

Acceptance criteria:

- Report calculations have written definitions before graphs are implemented.
- Universal totals, staff-scoped totals, role-scoped totals, and own-work totals use the same metric definitions.
- Group bookings do not inflate staff revenue reports.

### Gate

- Booking creation is atomic.
- Repeat booking snapshots work.
- Group totals match frontend/admin/backend.
- UK date behavior is tested.
- Revenue, client, participant, source, and staff attribution definitions are documented.
- Issues `#52`, `#54`, and `#59` are resolved.

## 8. Phase 3: Booking Experience Redesign

### Objective

Redesign the booking flow into a professional, mobile-first, gender-aware experience without redesigning the wider public website.

### UX Direction

The booking experience should feel:

- calm
- respectful
- clear
- clinically trustworthy
- easy on mobile
- explicit about price, payment, consent, and therapist matching

It must not expose internal staffing complexity.

### New Booking Flow

#### Step 1: Service

Show service package cards with:

- service name
- duration
- per-person price
- short suitability text
- gender restrictions where relevant

Requirements:

- Fix group total calculation in all summaries.
- Keep existing service selection constraints.
- Make selected service visually obvious.

#### Step 2: Who Is This For

Ask whether the customer is booking:

- for themselves
- for someone else
- for a group

Collect:

- main contact name
- email
- phone
- participant count
- participant gender
- participant display name or label
- participant notes if needed

Requirements:

- Gender matching copy must be respectful and operationally clear.
- Group participant entry must avoid ambiguity.
- Mixed-gender group bookings must remain simultaneous.

#### Step 3: Location

Collect:

- postcode
- city
- address
- area/access notes
- parking/access notes

Requirements:

- Show service-area feedback before times.
- Do not let unsupported locations continue to time selection.
- Explain mobile appointment preparation briefly.

#### Step 4: Matched Times

Show only valid date/time slots returned by availability.

Copy direction:

- "These times match the therapist availability needed for your booking."
- Avoid phrases like "static slots" or "request slots until live availability is connected."
- Do not show staff names or raw capacity counts.

Requirements:

- Male clients see only male-therapist-backed times where required.
- Female clients see only female-therapist-backed times where required.
- Mixed groups see only simultaneous times backed by all required therapist genders.

#### Step 5: Details And Consent

Collect:

- health/safety notes
- consent acknowledgement
- payment expectation acknowledgement
- cancellation/manage expectation acknowledgement

Requirements:

- Keep this lightweight; do not turn it into a full medical intake.
- Make cash/card in-person payment clear.
- Mention that confirmation/admin follow-up may still happen if needed.

#### Step 6: Review

Show:

- service
- participant count
- per-person price
- total group price
- duration
- address
- date/time
- contact snapshot
- participant summary
- consent/payment/cancellation summary

Requirements:

- Customer total must exactly match backend/admin total.
- Customer can go back without losing entered data.

#### Step 7: Confirmation

Show:

- booking request reference
- next steps
- payment reminder
- manage-link expectation
- "Start a new request"

Requirements:

- "Start a new request" resets to Step 1.
- Sensitive health/consent data should not remain in persisted local storage.

### Technical Requirements

- Reuse current React, `react-hook-form`, Zod, Zustand, Base UI Dialog, and Framer Motion patterns where practical.
- Split booking UI into focused components.
- Persist only safe draft data.
- Add accessible labels, errors, focus states, keyboard navigation, and mobile text-fit checks.

### Gate

Pass E2E for:

- single male booking
- single female booking
- mixed-gender group booking
- booking for someone else
- repeat customer booking
- outside service area
- no availability
- successful start-over reset

Issues `#58`, `#61`, and `#62` are resolved.

## 9. Phase 4: Customer Manage, Cancellation, Rescheduling, And Email Readiness

### Objective

Make customer manage links real and safe before production emails include them.

### Customer Manage Route

Add:

- `/booking/manage?token=...`

Token rules:

- Store only token hash in the database.
- Validate token server-side.
- Respect expiry.
- Never expose other bookings.
- Never expose admin notes, treatment notes, or internal audit data.

Customer can:

- view safe booking summary
- request cancellation
- request rescheduling
- add customer manage note

Customer cannot:

- edit staff assignment
- edit payment status
- see staff-only notes
- see other bookings

### Cancellation Rules

Allow customer cancellation only when:

- booking status is `pending` or `confirmed`
- token is valid
- cancellation cutoff has not passed

On cancellation:

- set `customer_cancelled_at`
- update booking status
- store customer note
- write audit log
- email customer
- email admin

### Rescheduling Rules

For v1, rescheduling should be a request, not automatic reassignment.

Behavior:

- Customer submits preferred new date/time and note.
- Admin sees reschedule request in dashboard and booking detail.
- Existing booking time does not change until admin confirms.

### Email Readiness

Improve email flows:

- confirmation
- admin notification
- cancellation
- reminder readiness
- staff assignment notification
- staff booking-change notification

Requirements:

- Fix manage links.
- Do not store private email body content by default.
- Record provider accepted/failed status where useful.
- Email failure must not break booking creation.
- Verify `RESEND_FROM_EMAIL`, domain readiness, and `NEXT_PUBLIC_SITE_URL`.
- Notify staff when they are assigned, unassigned, or when an assigned booking is cancelled or materially changed.
- If staff email fails, surface it in admin email status or operational errors rather than blocking booking management.

### Gate

- Valid manage token loads safe booking summary.
- Invalid/expired token fails safely.
- Cancellation updates DB and emails.
- Reschedule request appears in admin attention queue.
- Staff assignment and booking-change notifications are sent or safely logged as failed.
- Issue `#53` is resolved.

## 10. Phase 5: Responsive Admin Shell And Clinical Ops Design System

### Objective

Make `/admin/*` professional and usable on desktop, tablet, and mobile.

### Design Direction

Use a Clinical Ops interface:

- calm
- dense
- warm
- restrained
- fast to scan
- practical for repeated daily use

Avoid:

- marketing-style hero layouts
- oversized decorative cards
- nested cards
- horizontal overflow
- tiny mobile content beside a fixed sidebar

### Admin Shell

Replace the fixed desktop-only shell with:

- desktop persistent left navigation
- tablet/mobile top bar
- mobile menu drawer
- responsive content container
- sticky mobile action area where needed
- role/profile indicator
- clear sign-out access

### Shared Admin Components

Create reusable admin UI primitives:

- `AdminPageHeader`
- `AdminStat`
- `AdminPanel`
- `AdminStatusBadge`
- `AdminFilterBar`
- `AdminEmptyState`
- `AdminAccessDenied`
- `AdminMobileActionBar`
- `AdminCommandSearch`

### Access Denied UX

Standardize restricted states:

- Do not show the original page as if it loaded normally.
- Show a clear permission-limited page.
- Include required permission only where useful for admins.
- Inactive users get a clear inactive-account message.

### Global Admin Search

Add a global search entry point for high-frequency CRM work.

Requirements:

- Desktop: keyboard-accessible command/search trigger in the admin shell.
- Mobile: visible search action in the top bar.
- Search across:
  - clients
  - bookings
  - phone numbers
  - emails
  - postcodes
  - booking ids
- Results must be permission-aware.
- Sensitive fields must not appear in search results unless the user has the relevant permission.
- Search result rows should deep-link to the client or booking detail page.

### Responsive Requirements

Test at:

- 390px mobile
- 768px tablet
- 1440px desktop

Pages required:

- dashboard
- bookings list
- booking detail
- clients list
- client detail
- staff list
- staff detail
- staff availability
- services
- settings
- global availability
- roles list/detail

### Gate

- No primary admin workflow requires horizontal scrolling.
- Mobile admin navigation is usable.
- Forms, filters, lists, tables, and action buttons fit.
- Global admin search is usable on desktop and mobile.
- Issue `#60` is resolved.

## 11. Phase 6: Admin Booking Operations And Role-Specific Workflows

### Objective

Turn booking management into a real daily operations console.

### Bookings List

Add views:

- Needs attention
- Today
- Upcoming
- Unassigned
- Partially assigned
- Completed
- Cancelled/no-show
- All

Add filters:

- date range
- status
- assignment status
- payment status
- required therapist gender
- service
- city/postcode
- assigned staff

Add search:

- client name
- email
- phone
- postcode
- booking id

Add quick actions where permitted:

- confirm booking
- mark paid
- cancel
- open map/address
- copy phone/email
- assign/reassign staff
- create booking

### Booking Detail

Upgrade booking detail to show:

- booking contact snapshot
- linked client profile
- participant cards
- assignment state
- health and consent context
- service snapshots
- payment state
- amount due, amount paid, paid timestamp, and payment note
- booking source
- address and access notes
- timeline/activity
- customer manage/reschedule/cancellation requests

### Role-Specific Views

Owner/admin:

- full lifecycle controls
- payment controls
- assignment/reassignment
- admin notes
- audit timeline

Therapist:

- own assigned/claimable participant cards
- relevant address/access notes
- relevant health notes
- treatment notes
- complete/no-show action if permitted

Restricted staff:

- no broad lifecycle/payment/admin controls
- no unnecessary sensitive client data

### Assignment Operations

Support:

- claim
- unclaim by manager
- reassign by manager
- direct admin assignment to a specific eligible staff member
- eligible-staff preview by required therapist gender and availability
- clear unavailable reasons for inactive, wrong-gender, no-bookings, busy, or out-of-availability staff
- prevent wrong-gender assignment
- prevent inactive staff assignment
- prevent `can_take_bookings=false` assignment
- audit all changes

### Manual Admin Booking

Add a first-class admin booking creation flow for bookings received outside the public website.

Supported sources:

- phone
- WhatsApp
- Instagram
- referral
- repeat customer
- walk-in/manual admin entry

Requirements:

- Start from `/admin/bookings/new` or an equivalent create action.
- Choose an existing client or create a new client inline.
- Add one or more participants using the same participant model as public booking.
- Select services from active admin services.
- Run the same availability, gender matching, service restriction, booking window, minimum notice, buffer, and staff-capacity checks as public booking.
- Allow privileged admins to request an override only if an explicit permission is added and audit-logged.
- Store `booking_source`.
- Store booking contact snapshots and participant details.
- Optionally send confirmation email from the admin flow.
- Do not create bookings through a separate logic path that bypasses the transactional booking RPC.

Acceptance criteria:

- Admin can create a phone/WhatsApp booking for an existing repeat client.
- Admin can create a mixed-gender group booking with correct assignments.
- Admin-created bookings appear in dashboard, calendar, client history, payment reports, and audit logs.
- Availability rules are enforced consistently with public bookings.

### Gate

- Owner can take a booking from pending to confirmed to fully assigned to paid/completed.
- Therapist cannot access broad admin/payment controls unless explicitly permitted.
- Admin can create a manual booking without raw DB access.
- Admin can directly assign and reassign eligible staff with clear unavailable reasons.
- Issue `#63` is resolved.

## 12. Phase 7: Client CRM, Staff, Services, Settings, And Availability Premium Ops

### Objective

Make the CRM feature-complete for Rahma Therapy daily operations.

### Client CRM

Client profile should show:

- latest known contact details
- booking-specific contact history
- upcoming bookings
- past bookings
- repeat client status
- total spend
- last visit
- common services
- sensitive notes with permission checks
- health/safety context summary

Add filters:

- repeat clients
- upcoming booking
- no future booking
- outstanding payment
- postcode/city
- booking source

Add audited client notes.

### Manual Client Creation

Add first-class client creation for admins and booking coordinators.

Requirements:

- Add a create-client action from `/admin/clients`.
- Search existing clients before creation to reduce duplicates.
- Allow entry of:
  - full name
  - phone
  - email
  - address
  - postcode
  - city or service area where useful
  - source
  - internal client notes
- Supported client sources:
  - website
  - phone
  - WhatsApp
  - Instagram
  - referral
  - manual
  - other
- Allow a manually created client to be converted into a booking through the manual admin booking flow.
- Audit client creation and edits.
- Permission-gate manual client creation to roles with client-management permission.

Acceptance criteria:

- Admin can create a client without creating a booking.
- Admin is warned about likely duplicate email/phone matches before saving.
- Manually created clients appear in client analytics as manual clients.
- Unauthorized staff cannot create clients.

Add a privacy/admin workflow for:

- data export request
- correction request
- deletion request review

### Enquiry And Lead Tracking

Add a lightweight enquiry workflow for contacts that have not yet become bookings.

Requirements:

- Track enquiry source:
  - website
  - phone
  - WhatsApp
  - Instagram
  - referral
  - other
- Track:
  - name
  - phone
  - email
  - service interest
  - notes
  - status
  - assigned staff/admin owner if needed
- Supported statuses:
  - new
  - contacted
  - booked
  - closed
- Allow conversion from enquiry to booking through the manual admin booking flow.
- Show uncontacted enquiries in the dashboard attention queue.
- Keep enquiry notes permission-gated and audit important status changes.

Acceptance criteria:

- Admin can record a WhatsApp or phone enquiry without creating a booking.
- Admin can convert an enquiry into a booking without retyping client context.
- Enquiries do not appear as bookings until converted.

### Staff Operations

Staff list should show:

- active/inactive
- role
- gender
- `can_take_bookings`
- availability mode
- upcoming workload

Staff detail should show:

- profile
- permissions
- availability
- assigned bookings
- workload
- audit history

Add onboarding checklist:

- auth linked
- role assigned
- gender set
- active
- can take bookings
- availability configured

### Services

Services admin should show:

- frontend visibility
- gender restrictions
- duration
- price
- status
- historical booking protection

Prefer deactivation over destructive deletion where historical bookings exist.

### Settings

Group settings into:

- booking availability
- service areas
- travel/buffer/minimum notice
- cancellation cutoff
- payment expectations
- contact details
- email readiness

### Availability

Improve availability admin with:

- weekly global calendar grid
- blocked dates
- overrides
- staff availability summary
- male/female capacity preview

Keep `allowed_cities` for v1. Do not add complex geocoding unless separately approved.

### Gate

- Admin can onboard staff and configure availability without raw DB access.
- Admin can create clients manually without creating bookings.
- Staff availability changes affect public slots.
- Client CRM separates profile data from booking snapshots.
- Services preserve historical booking snapshots.

## 13. Phase 8: Dashboard, Reporting, Notifications, Audit, And Operational Conveniences

### Objective

Add premium operational visibility and admin conveniences.

### Dashboard

Dashboard sections:

- Today’s appointments
- Needs assignment
- Reschedule requests
- Cancellation requests
- Unpaid bookings
- Upcoming next 7 days
- Staff workload
- Repeat clients
- Completed revenue
- Most booked services
- No-show/cancellation count
- New enquiries
- Operational errors

Add:

- date range controls
- metric definitions
- permission-aware metrics

Dashboard rule:

- The dashboard should prioritize what needs action today.
- Long-range historical analysis belongs in `/admin/reports`.
- Only high-signal charts should appear on the dashboard.

### Reports, Analytics, And Exports

Add `/admin/reports` as a first-class reporting module.

Report areas:

- business overview
- revenue reports
- client/customer reports
- booking volume reports
- payment reports
- staff workload reports
- staff revenue attribution reports
- service performance reports
- source/channel reports
- cancellation and no-show reports

Date ranges:

- lifetime
- yearly
- monthly
- weekly
- custom date range

Charts and visualizations:

- revenue by week/month/year
- collected versus outstanding revenue
- booked, expected, collected, cancelled, and no-show revenue
- new versus repeat clients
- client growth over time
- clients by source/channel
- bookings by status
- bookings by service
- revenue by service
- workload by staff
- staff revenue attribution, where permitted
- cancellations/no-shows over time

Role-scoped reporting:

- Owner/super-admin can view universal totals across all clients, bookings, staff, services, sources, and revenue.
- Owner/super-admin can filter reports by staff, role, service, source, city/postcode, payment status, booking status, and date range.
- Admin/manager can view business-wide operational reports unless restricted by the role matrix.
- Finance/reporting roles can view revenue, payment, outstanding balance, and export reports without health or treatment notes.
- Reception/booking coordinator can view booking volume, client counts, source/channel activity, unpaid operational flags, and limited revenue if permitted.
- Therapist can view only own assigned/completed workload, own assigned-client counts, and own attributed revenue if permitted.
- Read-only/reporting roles can view aggregate reports without sensitive client details unless explicitly permitted.

Exports:

- CSV export is the default v1 export format.
- Exportable reports:
  - revenue summary
  - client summary
  - booking list
  - payment report
  - staff workload report
  - staff revenue attribution report
  - service performance report
  - source/channel report
- Exports must support date range and report filters.
- Exports must be permission-gated and audit-logged.
- Default exports must exclude health notes, treatment notes, admin notes, consent details, and raw audit payloads.
- Sensitive exports require a separate explicit permission if ever added.
- Exported rows must be scoped server-side to the user's role and permissions.

Implementation requirements:

- Add a charting library such as `recharts` for accessible line, bar, and stacked charts.
- Keep report calculations server-side or database-backed; do not trust client-side filtering for permissions.
- Use shared metric definitions from Phase 2.
- Avoid manually maintained total counters unless a future performance need proves they are necessary.

Acceptance criteria:

- Owner/super-admin can view and export universal revenue and client reports for lifetime, yearly, monthly, weekly, and custom ranges.
- Therapist can view only own permitted workload/revenue/client metrics.
- Group bookings do not double-count staff revenue.
- Exported CSV data matches on-screen filters and role scope.
- Sensitive notes are excluded from default exports.

### Attention Queue

Create an admin attention queue for:

- unassigned booking
- partially assigned booking
- customer cancellation
- reschedule request
- unpaid completed booking
- booking with health notes
- staff availability gaps
- uncontacted enquiry
- failed email send
- failed operational side effect

### Operational Calendar And Agenda

Add calendar-first daily operations views.

Views:

- daily schedule
- weekly schedule
- staff schedule
- unassigned appointments
- mobile agenda
- print/share-friendly day sheet

Requirements:

- Calendar entries show time, client/contact snapshot, service, city/postcode, assignment status, payment status, and action state.
- Staff views show only assigned or claimable work unless the role has broader permissions.
- Admin views can filter by staff, status, service, city, payment, and assignment state.
- Calendar uses the same Europe/London date/time helpers as availability and booking creation.
- Mobile agenda must be usable at 390px.

Acceptance criteria:

- Admin can run a typical day from the calendar/agenda without relying only on the dashboard.
- Therapist can see their own schedule without broad CRM access.
- Unassigned bookings are visible in both attention queue and calendar.

### Audit Log UI

Add an audit log page for users with `manage_audit_logs`.

Show:

- actor
- action
- target
- timestamp
- safe before/after summary

Do not expose sensitive full payloads to roles that should not see them.

### Email Status Logging

Record email events:

- booking id
- staff id where relevant
- type
- recipient
- provider accepted/failed
- timestamp
- error summary

Do not store private email bodies by default.

### Operational Errors

Add a safe operational errors/system events view for production support.

Track:

- failed email sends
- failed staff notifications
- failed reminder attempts
- failed customer manage actions
- failed booking creation attempts where no sensitive payload is stored
- safe Sentry-related context where available

Requirements:

- Store only safe error summaries.
- Do not store raw request bodies, health notes, secrets, or full email bodies.
- Mark events as open, acknowledged, or resolved.
- Show unresolved operational errors in the dashboard attention queue.
- Permission-gate the view to owner/admin roles.

### Reminder Readiness

Add:

- manual send-reminder action
- reminder email template

Scheduled Cloudflare cron reminders can be a later follow-up if not required for initial launch.

### Gate

- Dashboard metrics match Supabase records.
- Admin knows what needs action next.
- Reports show universal and role-scoped revenue/client metrics correctly.
- CSV exports match filters and permissions.
- Calendar/agenda supports daily operations on desktop and mobile.
- Audit log is permission-gated.
- Email status can be reviewed safely.
- Operational errors can be reviewed without exposing sensitive payloads.

## 14. Phase 9: Privacy, RLS, Deployment, And Production Hardening

### Objective

Make the system safe to operate with real customer and health-adjacent data.

### Security And RLS

Re-run RLS checks for:

- bookings
- clients
- booking participants
- booking items
- booking assignments
- staff profiles
- enquiries
- notes fields
- audit logs
- email status logs
- operational error logs
- report export routes
- role-scoped analytics queries
- manage-token access

Confirm:

- anon raw reads blocked for sensitive tables
- anon inserts blocked
- authenticated raw writes blocked where server actions are required
- service-role flows still work
- public API responses do not leak sensitive details
- report exports are scoped server-side to the user's role and permissions
- default exports exclude health notes, treatment notes, admin notes, consent details, and raw audit payloads
- browser bundles do not expose service-role, Resend, Sentry auth token, or secrets

### Privacy Documentation

Document:

- Sentry capture policy
- email logging policy
- health note access rules
- treatment note access rules
- audit log retention expectation
- customer data request workflow

### Data Retention And GDPR Operations

Define practical retention and privacy operations for the CRM.

Requirements:

- Define retention expectations for:
  - bookings
  - client profiles
  - booking contact snapshots
  - health notes
  - treatment notes
  - consent records
  - audit logs
  - email status logs
  - enquiry records
  - operational error records
- Add admin workflows for:
  - customer data export request
  - customer correction request
  - customer deletion/anonymization review
  - sensitive note review
- Deletion/anonymization must preserve legally/operationally necessary booking and audit integrity where required.
- Only owner/admin roles with explicit permission can run privacy operations.
- Every privacy operation must write an audit log.

### Deployment

Verify:

- `pnpm cf:build`
- Cloudflare preview
- Cloudflare env vars
- Supabase production project
- Resend verified sender/domain
- Sentry project
- `NEXT_PUBLIC_SITE_URL`

### Production Runbook

Create a runbook covering:

- first admin bootstrap
- staff setup
- service setup
- settings setup
- availability setup
- booking smoke test
- email smoke test
- RLS smoke test
- rollback notes
- backup/export expectations

### Gate

- Supabase security advisor returns no security lints.
- Browser bundle scan finds no server secrets.
- Public manage route cannot leak another booking.
- Privacy operations are permission-gated and audit-logged.
- Cloudflare build passes.
- Production runbook is complete.

## 15. Phase 10: Test Suite, E2E Coverage, And Launch Acceptance

### Objective

Add enough verification to prevent regressions and support launch confidence.

### Test Tooling

Add:

- `vitest`
- `@testing-library/react`
- `@testing-library/user-event`
- `jsdom`
- `@playwright/test`

Optional:

- `axe-core` if compatible with the testing setup.

### Required Automated Tests

Booking:

- group total calculation
- participant gender derivation
- booking form reset
- service-area validation
- repeat-customer snapshot behavior
- male availability payload
- female availability payload
- mixed-group availability payload

Backend/RPC:

- single booking creates normalized records
- mixed booking creates correct participants/items/assignments
- concurrent booking does not overbook
- email failure does not rollback booking
- invalid location fails cleanly
- invalid service fails cleanly
- invalid date/time fails cleanly

Admin:

- unauthenticated admin redirect
- inactive staff blocked
- restricted therapist cannot access settings/roles
- therapist sees scoped booking controls
- owner/admin can manage booking/payment/assignment
- owner/admin can create a manual booking from an existing client
- owner/admin can directly assign and reassign eligible staff
- owner/admin can search globally across permitted clients/bookings
- owner/admin can view daily and weekly operational calendar
- owner/admin can record and convert an enquiry
- owner/admin can create a manual client
- owner/admin can view universal revenue/client reports for selected periods
- owner/admin can export permitted CSV reports
- lower-privilege users see only role-scoped or own-scope report data
- owner/admin can review operational errors safely
- mobile admin shell has no horizontal overflow

Admin role journeys:

- each role lands on the correct dashboard, shell, and default admin view for its permissions
- owner/super-admin can access all admin navigation, bookings, assignments, reports, audit logs, privacy operations, and operational errors
- admin/manager can access business operations within the formal role matrix
- booking coordinator/reception can use permitted booking, client, enquiry, and calendar workflows without broad settings, role, privacy, or audit access
- therapist can access only own assigned work, eligible claimable work, and permitted own-scope reports
- read-only/reporting user can access permitted aggregate reports and exports without mutation controls or sensitive notes
- inactive staff sees an inactive-account blocked state
- authenticated user without a staff profile is blocked from `/admin/*`
- each role sees only permitted sidebar/top-bar navigation items
- restricted pages show standardized access denied states instead of partially loaded sensitive content
- server actions reject unauthorized role attempts even when called directly

Role-based booking visibility and claiming:

- two eligible therapists can initially see the same unassigned claimable booking request
- when therapist A claims an assignment, therapist B no longer sees that assignment as claimable after refresh/reload
- therapist B cannot claim the already-claimed assignment through a stale UI or direct server action/API request
- owner/super-admin still sees the claimed booking request, assignment state, assigned staff, and audit trail after it is taken
- admin/manager can unclaim, reassign, or directly assign eligible staff where permitted
- wrong-gender, inactive, or `can_take_bookings=false` staff never see the request as claimable and cannot claim it directly
- partially assigned mixed-gender bookings remain claimable only to eligible staff needed for the remaining unfilled participant/assignment
- completed, cancelled, no-show, or otherwise closed bookings do not remain in claimable queues

Customer manage:

- valid token loads safe booking summary
- invalid token fails safely
- expired token fails safely
- cancellation request updates booking
- reschedule request appears in admin queue

Privacy operations:

- permitted admin can record export/correction/deletion review request
- unauthorized staff cannot access privacy operations
- privacy operation writes audit log
- sensitive payloads are not exposed in operational errors

Reports and exports:

- revenue metrics match booking/payment records for weekly, monthly, yearly, lifetime, and custom ranges
- client metrics distinguish clients from participants
- booking source reports split website, phone, WhatsApp, Instagram, referral, manual, and other sources
- therapist reports do not expose universal business revenue
- group booking revenue is not double-counted in staff revenue attribution
- exported CSV rows match visible filtered report data
- unauthorized exports fail server-side

Security:

- anon raw sensitive reads blocked
- anon inserts blocked
- authenticated raw writes blocked where required
- secret-name scan passes

### Manual Launch Checklist

Test at:

- 390px mobile
- 768px tablet
- 1440px desktop

Pages:

- booking flow
- admin dashboard
- bookings list/detail
- clients list/detail
- staff list/detail/availability
- services
- settings
- availability
- roles

E2E scenarios:

- single male booking
- single female booking
- mixed-gender group booking
- booking for someone else
- repeat customer with changed phone/address
- manually created client
- admin-created phone/WhatsApp booking
- enquiry converted to booking
- outside service area
- no eligible staff
- cancellation through manage link
- reschedule request through manage link
- admin confirms/assigns/completes/marks paid
- admin directly reassigns staff
- therapist claims and completes own assignment
- owner/super-admin completes full admin navigation and booking lifecycle journey
- booking coordinator completes limited booking/client/enquiry workflow without restricted access
- therapist claimable-to-claimed visibility handoff after another therapist claims the request
- owner/super-admin can still find and inspect the request after it is claimed by a therapist
- therapist stale claim attempt is rejected after another therapist claims the request
- read-only/reporting user cannot access booking mutation controls or sensitive notes
- inactive staff and authenticated non-staff users are blocked from admin pages
- admin uses calendar agenda for a daily schedule
- owner exports a monthly revenue CSV
- therapist views own scoped workload/revenue report

### Final Production Gate

Production readiness requires:

- `pnpm lint` passes
- `pnpm build` passes
- `pnpm cf:build` passes
- `git diff --check` passes
- Supabase migrations are applied and reproducible
- Supabase security advisor is clean
- all P0 issues closed
- all P1 issues closed or explicitly accepted with mitigation
- no `audit_phase` test data remains
- production owner/admin/staff setup exists
- formal role matrix is implemented
- manual admin booking works
- manual client creation works
- operational calendar works
- enquiry tracking works
- universal and role-scoped reports work
- CSV exports are permission-gated and audit-logged
- role-based admin E2E passes for owner/super-admin, admin/manager, booking coordinator/reception, therapist, read-only/reporting, inactive staff, and authenticated non-staff users
- claimable booking visibility updates correctly after another eligible user claims or is assigned
- stale claim and assignment attempts are rejected server-side
- booking UX passes E2E
- admin CRM passes responsive review
- customer manage route works
- emails are production-ready
- staff notifications are production-ready
- operational errors are visible without sensitive payloads
- privacy/data-retention operations are documented and permission-gated
- Sentry privacy is production-safe
- Cloudflare deployment smoke passes

## 16. Post-Phase 10: Cloudflare GitHub Deployment And Business Site Setup

### Objective

Deploy only after Phase 10 is complete and the final launch acceptance checks pass.

The production deployment should use Cloudflare Workers Builds connected to GitHub, with the existing
`@opennextjs/cloudflare` and Wrangler configuration in this repository.

### Deployment Timing

Do not use Cloudflare production deployment as a substitute for Phase 9 or Phase 10 verification.

Deployment can begin when:

- Phase 9 privacy, RLS, deployment hardening, and production runbook gates pass.
- Phase 10 automated tests, E2E scenarios, and manual launch checklist pass.
- The working branch has been merged into the intended production branch.
- No known P0/P1 launch blocker remains open unless it has written mitigation.

### Cloudflare Project Type

Use:

- Cloudflare Workers, not standard static Pages.
- Workers Builds GitHub integration.
- Worker name: `rahmatherapy-next-refactor`, matching `wrangler.jsonc`.
- Existing deployment scripts:
  - `pnpm cf:build`
  - `pnpm preview`
  - `pnpm deploy`
  - `pnpm upload`

The Worker name in Cloudflare must match the `name` value in `wrangler.jsonc`, otherwise Git-connected
Workers Builds can fail.

### GitHub-Connected Deployment Steps

1. In Cloudflare, go to Workers & Pages.
2. Select Create application.
3. Choose Import a repository.
4. Connect the GitHub account that owns `mamdouhmhed-235/rahmatherapy-next-refactor`.
5. Select the repository.
6. Configure the Worker:
   - Project/Worker name: `rahmatherapy-next-refactor`
   - Production branch: the final production branch, normally `main`
   - Root directory: leave blank or use `.` unless the GitHub repository contains the app in a nested folder
   - Build command: leave blank
   - Deploy command: `pnpm deploy`
   - Non-production branch deploy command: `pnpm upload`
7. Select the same scoped Cloudflare API token for deployments, or let Cloudflare generate one.
8. Enable build cache after the first successful build.
9. Save and deploy.
10. Confirm the first build reaches Active Deployment.

Reasoning:

- `pnpm deploy` already runs `opennextjs-cloudflare build` and then deploys.
- `pnpm upload` builds and uploads a non-production version without promoting it.
- Cloudflare Workers Builds treats build variables as build-only; runtime app variables must still be configured in
  Settings > Variables and Secrets.

### Cloudflare API Token

Use a scoped API token, not the global API key.

Recommended token permissions:

- Account: Account Settings Read
- Account: Workers Scripts Edit
- Account: Workers KV Storage Edit
- Account: Workers R2 Storage Edit
- Zone: Workers Routes Edit for the Rahma Therapy domain zone
- User: User Details Read
- User: Memberships Read

Resource scope:

- Account Resources: include only the Rahma Therapy Cloudflare account.
- Zone Resources: include only the Rahma Therapy domain zone.

Do not store `CLOUDFLARE_API_TOKEN` in application runtime variables. Use it only as a Cloudflare Workers Builds
deployment credential or a local/CI deployment secret.

### Runtime Variables And Secrets

Set these in Cloudflare Worker Settings > Variables and Secrets.

Plain variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `RESEND_FROM_EMAIL`
- `SENTRY_DSN`

Secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`

Build-only secret if source maps are uploaded:

- `SENTRY_AUTH_TOKEN`

Rules:

- `NEXT_PUBLIC_SITE_URL` must be the final canonical production URL.
- Service-role, Resend, Sentry auth, and Cloudflare API tokens must never appear in browser bundles.
- Verify runtime environment access in Cloudflare preview before promoting production.
- Do not commit `.env`, `.env.local`, `.dev.vars`, or any environment-specific secret file.

### Custom Domain Steps

Use Workers Custom Domains for the public website.

1. Confirm the domain is active in Cloudflare DNS.
2. Deploy the Worker successfully.
3. In Cloudflare, open Workers & Pages.
4. Select `rahmatherapy-next-refactor`.
5. Go to Settings > Domains & Routes.
6. Select Add > Custom Domain.
7. Add the canonical hostname, for example:
   - `rahmatherapy.example`
   - or `www.rahmatherapy.example`
8. Let Cloudflare create the DNS record and certificate.
9. Add the non-canonical hostname only after the canonical hostname works.
10. Configure a redirect from the non-canonical hostname to the canonical hostname.
11. Update `NEXT_PUBLIC_SITE_URL` to the canonical URL.
12. Re-run booking, manage-link, admin-login, and email smoke tests.

Use Custom Domains instead of a wildcard Worker route unless a specific routing need is documented.

### Cloudflare Business Site Settings

Configure these settings after the custom domain is live.

#### SSL And HTTPS

- Set SSL/TLS mode to Full (strict) where applicable.
- Enable Always Use HTTPS.
- Enable Automatic HTTPS Rewrites.
- Add HSTS only after HTTPS and redirects have been stable in production.
- Do not enable HSTS preload until the canonical domain, subdomains, and email/link behavior are proven stable.

#### Redirects

- Choose one canonical host: apex or `www`.
- Redirect the other host to the canonical host.
- Confirm `NEXT_PUBLIC_SITE_URL`, Supabase Auth URL settings, Resend email links, Sentry environment, and sitemap URLs all use the canonical host.

#### Caching

- Keep dynamic and sensitive routes uncacheable:
  - `/admin*`
  - `/booking/manage*`
  - `/api*`
  - any route using auth, manage tokens, or personalized customer/admin data
- Allow static assets generated by OpenNext and Next.js to be cached normally.
- Use Cache Rules only after confirming response headers and booking/admin behavior in preview.

#### Security Headers

- Prefer app-level security headers for precise control.
- Use Cloudflare Managed Transforms to remove `X-Powered-By` where safe.
- Add or verify:
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `X-Frame-Options` or `Content-Security-Policy frame-ancestors`
  - a production Content Security Policy
- Test booking, admin, Sentry, Supabase, Resend links, images, and scripts after any header change.

#### WAF, Bot Protection, And Forms

- Enable Cloudflare WAF managed protections appropriate to the plan.
- Avoid aggressive challenges on booking, manage, and admin auth routes until those flows are tested.
- If spam becomes a real issue, add Cloudflare Turnstile to public booking/contact flows as a separate issue because it
  requires client widget and server-side token verification.
- If rate limiting is available on the active plan, apply conservative rate limits to public booking creation and
  customer manage actions after smoke testing.

#### Observability

- Keep Cloudflare Worker observability enabled.
- Confirm Sentry production environment receives safe errors only.
- Confirm operational errors are visible in `/admin/operations` without sensitive payloads.
- Review Cloudflare build and deployment logs for accidental secret output.

#### Email And DNS

- Verify Resend sender/domain before launch.
- Confirm SPF, DKIM, and DMARC records in Cloudflare DNS.
- Send a production email smoke test from the deployed domain.
- Confirm all email manage links use `NEXT_PUBLIC_SITE_URL`.

#### Supabase Production Settings

- Confirm Supabase Auth Site URL uses the canonical production domain.
- Add production redirect URLs for admin/auth flows.
- Re-run Supabase security advisor.
- Re-run RLS smoke tests against production.
- Confirm production migrations match checked-in migrations.

### Deployment Smoke Test

After Cloudflare deploy and custom domain setup:

1. Open the canonical public URL.
2. Confirm public pages load over HTTPS.
3. Complete a public booking smoke test.
4. Confirm the booking appears in admin.
5. Confirm admin login works.
6. Confirm the customer manage link loads only its own safe booking summary.
7. Confirm a test cancellation or reschedule request appears in admin attention queues.
8. Send a test email and confirm Resend accepted or safely logged the result.
9. Open `/admin/dashboard`, `/admin/bookings`, `/admin/reports`, `/admin/calendar`, `/admin/operations`.
10. Export a permitted CSV report and confirm sensitive fields are excluded.
11. Scan browser bundles and deployment output for secret names and secret values.
12. Review Cloudflare Worker logs, Sentry, Supabase logs, email status logs, and operational events.

### Deployment Gate

Deployment is complete only when:

- GitHub-connected Cloudflare deployment works from the production branch.
- Cloudflare preview or non-production branch upload works.
- Custom domain serves the Worker over HTTPS.
- Canonical host redirects are correct.
- Runtime variables and secrets are present in Cloudflare and not exposed to the browser.
- Supabase production Auth URLs and redirect URLs match the canonical domain.
- Resend sender/domain is verified.
- Sentry production project receives scrubbed events only.
- Booking, admin, manage-link, email, reports, and CSV export smoke tests pass.
- Cloudflare logs, browser bundles, and source output do not expose secrets.

### Reference Documentation

- Cloudflare Workers Builds: https://developers.cloudflare.com/workers/ci-cd/builds/
- Cloudflare Workers Build configuration: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- Cloudflare Workers environment variables: https://developers.cloudflare.com/workers/configuration/environment-variables/
- Cloudflare Workers secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Cloudflare Workers Custom Domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- OpenNext Cloudflare get started: https://opennext.js.org/cloudflare/get-started
- OpenNext Cloudflare deploy guide: https://opennext.js.org/cloudflare/howtos/dev-deploy
- Cloudflare SSL Full strict: https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/
- Cloudflare Always Use HTTPS: https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/
- Cloudflare Automatic HTTPS Rewrites: https://developers.cloudflare.com/ssl/edge-certificates/additional-options/automatic-https-rewrites/
- Cloudflare Cache Rules: https://developers.cloudflare.com/cache/how-to/cache-rules/
- Cloudflare Response Header Transform Rules: https://developers.cloudflare.com/rules/transform/response-header-modification/
- Cloudflare Managed Transforms: https://developers.cloudflare.com/rules/transform/managed-transforms/reference/
- Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/

## 17. Recommended PR Sequence

1. Planning artifact and baseline checks.
2. Admin bootstrap, formal role matrix, and Sentry privacy.
3. Migration hygiene and production runbook shell.
4. Booking snapshot schema, participant detail schema, booking source, and payment detail schema.
5. Atomic booking creation RPC.
6. Booking UI total/reset/copy fixes.
7. Full booking redesign.
8. Customer manage route, cancellation/reschedule request, and staff notifications.
9. Responsive admin shell, shared admin UI primitives, and global search.
10. Booking operations console, manual admin booking, direct assignment, and role-specific booking detail.
11. Client CRM improvements, manual client creation, and enquiry/lead tracking.
12. Staff/services/settings/availability improvements.
13. Dashboard, reports, analytics graphs, calendar/agenda, role-scoped exports, attention queue, audit log UI, operational errors, and email status logging.
14. RLS/privacy/data-retention/report-export/deployment hardening.
15. Automated tests and E2E coverage.
16. Final launch acceptance pass.
17. GitHub-connected Cloudflare deployment and custom-domain production smoke pass.

## 18. Completion Definition

Implementation Plan 3 is complete when:

- every P0/P1 audit issue is closed or consciously accepted with written mitigation
- booking creation is atomic and repeat-customer-safe
- booking UX is professional, gender-aware, and mobile-first
- admin CRM is responsive and operationally complete
- manual admin booking, direct staff assignment, calendar operations, global search, and enquiry tracking work
- manual client creation works
- universal and role-scoped revenue/client reporting works
- historical report exports are permission-gated, audit-logged, and privacy-safe
- customer manage links work safely
- RLS and privacy checks pass
- data retention and privacy operations are documented and permission-gated
- Resend/Sentry/Cloudflare are production-ready
- final launch checklist passes
- production runbook exists
