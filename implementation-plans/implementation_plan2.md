# Rahma Therapy Full-Stack Audit Prompt Plan

## 1. Purpose

This document is a standalone prompt pack for a comprehensive post-implementation audit of the Rahma Therapy website, backend, CRM, booking system, and operational tooling.

The original implementation plan has been followed through the backend, CRM, Supabase database, booking flow, admin system, Resend email notifications, safety/consent notes, RLS hardening, and QA/regression work. The next goal is not to build more features. The next goal is to audit what exists, identify gaps, verify whether the system matches the business model, and create clear GitHub issues for discrepancies.

Each phase below is written so it can be copied into a fresh ChatGPT 5.5 session as a standalone prompt. Do not assume the model has access to previous audit phases unless the prompt explicitly says so.

## 2. Global Audit Rules

These rules apply to every audit phase.

- This is audit-only work.
- Do not fix code.
- Do not add features.
- Do not refactor.
- Do not change schemas, migrations, UI, backend logic, environment files, or test data permanently.
- Before beginning each phase, create a new GitHub issue for that exact phase using the GitHub MCP.
- If the audit finds a defect, gap, or missing requirement, create a separate GitHub issue for that finding before proposing any fix.
- Do not close an audit phase issue unless the audit phase has been completed and its findings have been documented.
- Use Supabase MCP for database inspection, RLS checks, migration status, and temporary test data where needed.
- Use Chrome DevTools MCP and Playwright/browser tooling for visual and E2E testing.
- Use the local website at `http://localhost:3000` when available.
- Any test records must be clearly prefixed, for example `audit_phase1_`, `audit_phase2_`, or `audit_phase3_`, and cleaned up before the phase ends.
- Do not print or expose secrets from `.env`.
- Treat `.env.example` as the only safe source for environment variable names.
- Treat `IMPLEMENTATION_PLAN.md` as the source of intended behavior.
- Treat the current codebase and Supabase state as the source of actual behavior.

## 3. Project Context To Include In Every Phase

Rahma Therapy is a UK mobile therapy business. The system supports public package/service pages, a customer booking flow, a Supabase-backed CRM, and an internal admin system.

Known business context:

- The business provides mobile therapy appointments, including massage and hijama-related services.
- Appointments happen at the customer location.
- Location coverage, postcode/address quality, travel buffer time, booking window, and minimum notice are important operational rules.
- Customers pay in person by cash or card. There is no online payment integration in the MVP.
- Customers do not have accounts.
- Staff/admin users log in through Supabase Auth.
- Staff treatment eligibility is separate from admin permissions.
- Gender matching is a core business and safety rule.
- Mixed-gender group bookings must create separate participants and assignments.
- Group bookings are assumed simultaneous unless the business later changes that assumption.
- Admin users need to manage staff, services, bookings, clients, availability, roles, settings, dashboard metrics, and notes.
- Resend is used for transactional emails.
- Sentry is configured for observability.
- Cloudflare/OpenNext deployment support exists.

Known technical context:

- Framework: Next.js App Router, React, TypeScript.
- Styling: Tailwind CSS v4, CSS tokens, shadcn-style UI components.
- Database/backend: Supabase Auth, Postgres, RLS, service role server flows.
- Email: Resend with `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.
- Public app URL: `NEXT_PUBLIC_SITE_URL`.
- Observability: Sentry variables exist in `.env.example`.
- Deployment: Cloudflare/Wrangler/OpenNext scripts exist.
- Important code areas:
  - `implementation-plans/IMPLEMENTATION_PLAN.md`
  - `GITHUB_ISSUES_GUIDE.md`
  - `src/app/(public)/*`
  - `src/features/booking/*`
  - `src/app/api/availability/*`
  - `src/app/api/bookings/*`
  - `src/lib/booking/availability.ts`
  - `src/lib/auth/rbac.ts`
  - `src/lib/supabase/*`
  - `src/lib/email/*`
  - `src/app/admin/*`
  - `supabase/migrations/*`
  - `.env.example`
  - `package.json`
  - `next.config.ts`
  - `src/proxy.ts`

Core system model expected from the original plan:

- Dynamic RBAC through `roles`, `permissions`, `role_permissions`, and `staff_profiles.role_id`.
- Optional staff permission overrides through `staff_permission_overrides`.
- Individual staff availability layered on top of global business availability.
- Availability modes: `use_global`, `custom`, `global_with_overrides`.
- Public slot calculation must consider active staff, `can_take_bookings`, therapist gender, service duration, location rules, global availability, staff availability, blocked dates, overrides, existing bookings, buffers, minimum notice, and booking window.
- Booking creation must normalize data into `clients`, `bookings`, `booking_participants`, `booking_items`, and `booking_assignments`.
- `booking_participants` is the source of truth for group composition.
- `number_of_people` must only be derived/display information, not the core logic driver.
- `booking_assignments` is the source of truth for claimable staff work.
- There must not be a simple `bookings.assigned_staff_id` model.
- Staff cannot claim assignments for the wrong therapist gender.
- Inactive staff cannot access admin, appear available, or claim bookings.
- Last owner/super-admin lockout protections must exist.
- Public/raw access to sensitive booking data must be blocked by RLS.

## 4. Required Output Standard For Every Phase

Each phase must produce:

- GitHub issue link for that audit phase.
- Scope confirmation.
- Commands/tools used.
- Files/modules inspected.
- Supabase objects inspected.
- Browser routes/pages tested, where applicable.
- Test data created and cleanup confirmation, where applicable.
- Findings table with severity, evidence, affected area, reproduction notes, and recommended next issue.
- Review findings files written under that phase's assigned folder. These are audit artifacts only, not implementation changes.
- Explicit "No fixes were made" confirmation.
- Open questions or blocked checks.
- Phase completion decision: complete, partially complete, or blocked.

Severity model:

- Blocker: prevents core booking, admin, data security, or production readiness.
- High: data corruption, permission leak, double-booking risk, invalid gender assignment, broken booking creation, or broken admin workflow.
- Medium: important workflow failure, dashboard mismatch, confusing UX, mobile usability failure, email side-effect failure, or missing operational guard.
- Low: copy, minor visual polish, minor consistency issue, missing non-critical affordance.

Review findings artifact folders:

- Phase 1 folder: `implementation-plans/audit-review-findings/phase-1-architecture-codebase-database/`
- Phase 2 folder: `implementation-plans/audit-review-findings/phase-2-e2e-admin-booking-ux/`
- Phase 3 folder: `implementation-plans/audit-review-findings/phase-3-triage-roadmap/`

Each phase may create at most five findings files in its assigned folder. Use these exact filenames when a category has findings or relevant observations:

1. `01-frontend-booking-ux-findings.md`
2. `02-admin-crm-ux-findings.md`
3. `03-backend-data-security-findings.md`
4. `04-business-operational-gaps.md`
5. `05-blockers-and-follow-up-issues.md`

If a category has no confirmed findings, either omit that file or create it with a short "No confirmed findings in this category" note. Do not create extra category files. Do not use findings files to implement fixes.

## 5. Phase 1 Standalone Prompt: Architecture, Codebase, Database, And Business Fit Audit

Copy this prompt into ChatGPT 5.5 as a standalone request.

```md
You are ChatGPT 5.5 acting as a senior full-stack architect, product QA lead, and security-minded code reviewer.

I need you to perform Phase 1 of a three-phase audit for the Rahma Therapy project. This is audit-only. Do not fix anything. Do not edit files. Do not add features. Do not refactor. Do not create migrations. Do not change Supabase data unless explicitly needed for read-only verification, and prefer read-only inspection in this phase.

Before doing anything else, use the GitHub MCP to create a new issue titled:

`Audit Phase 1: Architecture, Codebase, Database, and Business Fit Review`

Issue body:

## Objective
Map the implemented Rahma Therapy system from a full-stack perspective and compare the actual architecture against the original implementation plan and business needs.

## Scope
- Codebase architecture
- Supabase schema and RLS architecture
- Full-stack frontend and backend architecture
- Public booking experience architecture
- Admin login, management, and CRM experience architecture
- Booking, CRM, admin, RBAC, availability, email, observability, and deployment architecture
- Business-fit audit for a UK mobile therapy service
- Gap identification only

## Acceptance Criteria
- Full architecture map is documented.
- Frontend, backend, booking page, and admin CRM surfaces are reviewed together as one full-stack system.
- Public user, admin, staff, booking, and email data flows are documented.
- Database entities, relationships, RLS boundaries, and service-role usage are reviewed.
- Booking UX risks are identified, including multi-person bookings, repeat/multiple bookings, participant information capture, and gender-aware availability.
- Admin UX risks are identified from login through daily CRM management.
- Business-specific missing requirements are identified.
- Findings files are created under `implementation-plans/audit-review-findings/phase-1-architecture-codebase-database/` using the approved filenames and capped at five files.
- Findings are documented with severity and evidence.
- No fixes or feature work are performed.

After creating the issue, begin the audit.

Project context:
- Rahma Therapy is a UK mobile therapy business offering home appointments for therapy packages such as massage and hijama-related services.
- Customers book appointments through the public website.
- Customers do not have accounts.
- Staff and admins use Supabase Auth.
- The admin CRM manages bookings, clients, staff, services, roles, settings, availability, dashboard metrics, assignment claiming, notes, and payment status.
- Customers pay in person by cash or card.
- Resend is used for email notifications.
- Sentry is configured for observability.
- Cloudflare/OpenNext deployment support exists.
- Local site is expected at `http://localhost:3000`, but Phase 1 should focus mainly on static architecture and database review.

Important files and folders:
- `implementation-plans/IMPLEMENTATION_PLAN.md`
- `GITHUB_ISSUES_GUIDE.md`
- `.env.example`
- `package.json`
- `next.config.ts`
- `src/proxy.ts`
- `src/app/(public)/*`
- `src/features/booking/*`
- `src/app/api/availability/*`
- `src/app/api/bookings/*`
- `src/lib/booking/availability.ts`
- `src/lib/auth/rbac.ts`
- `src/lib/supabase/*`
- `src/lib/email/*`
- `src/app/admin/*`
- `supabase/migrations/*`

Expected system model:
- Dynamic RBAC using `roles`, `permissions`, `role_permissions`, and `staff_profiles.role_id`.
- Optional direct staff permissions through `staff_permission_overrides`.
- Staff treatment eligibility must be separate from admin permissions.
- Staff availability must support global rules, custom staff rules, and global-with-overrides inheritance.
- Gender-aware slot calculation must happen before booking creation. ef
- Booking creation must normalize records into `clients`, `bookings`, `booking_participants`, `booking_items`, and `booking_assignments`.
- `booking_participants` is the source of truth for group bookings.
- `booking_assignments` is the source of truth for staff claiming.
- `number_of_people` must not be the core booking driver.
- Staff cannot claim another-gender assignment.
- Inactive staff cannot log in, appear available, or claim bookings.
- Public/raw access to sensitive booking data must be blocked by RLS.
- Resend API keys must remain server-side.

What to audit:

1. Repository and application architecture
- Identify the framework, major dependencies, scripts, and deployment model.
- Map the Next.js route structure.
- Map public pages and the booking entry points.
- Map admin pages and their route protection model.
- Map server actions, API routes, and Supabase client usage.
- Identify any architectural mismatches, duplicate concepts, dead routes, or stale code paths.
- Review the frontend and backend as one connected product, not as isolated code areas.
- Pay special attention to the public booking page and admin CRM because these are the highest-risk business workflows.

2. Backend and data flow architecture
- Map public booking data flow from UI to validation to availability to booking transaction to email notification.
- Map admin data flow for staff, services, availability, settings, roles, clients, bookings, assignment claiming, notes, and dashboard.
- Identify which flows use anon Supabase, authenticated Supabase, and service-role Supabase.
- Flag any unnecessary service-role use, missing validation boundary, or unclear trust boundary.
- Map how repeat customers, multiple bookings by the same client, group participants, participant service snapshots, and assignment rows are connected.
- Identify whether the architecture can represent a customer making multiple bookings over time without overwriting or confusing participant, address, health, consent, or booking history data.

3. Database and RLS architecture
- Use Supabase MCP to inspect schemas, tables, functions, policies, grants, migrations, constraints, and security advisor results.
- Compare database objects against the implementation plan.
- Verify RLS intent at the architecture level.
- Check whether sensitive tables are protected from public/raw access.
- Check whether server-only flows have the grants they need without broad public exposure.
- Identify weak constraints or missing DB-level protection for double-booking, assignment claiming, or lockout state.
- Check whether database relationships support different participant genders, required therapist genders, and separate assignment rows without falling back to derived `number_of_people` logic.

4. Business-fit audit
- Evaluate whether the implemented system supports a UK mobile therapy operation.
- Look for missing or weak business requirements:
  - service-area coverage and postcode handling
  - London/UK timezone and BST behavior
  - travel buffer and appointment spacing
  - minimum notice and booking window
  - cancellation and customer manage-link expectations
  - cash/card payment tracking
  - staff gender matching and client comfort
  - group booking simultaneity assumptions
  - consent, health notes, aftercare, contraindications, clinical safety language
  - GDPR/privacy expectations for clients, health notes, emails, and admin access
  - audit logging for sensitive admin changes
  - email deliverability and Resend sender configuration
  - Sentry coverage for backend and frontend failures
  - production readiness on Cloudflare/OpenNext
- Evaluate the booking experience from a customer psychology perspective: the gender questions should be clear, respectful, and operationally necessary without feeling awkward, intrusive, or hard to complete.
- Evaluate whether male and female customers can be shown appropriate availability based on matching therapist availability without exposing unnecessary staff details or making the customer understand backend assignment logic.
- Evaluate whether group booking UX can collect several people's information cleanly, including participant gender and required therapist gender, without making date/time selection confusing.
- Evaluate whether the admin CRM supports the real daily workflow of a mobile therapy business: seeing new bookings, understanding participant breakdowns, assigning/claiming work, tracking payment, reviewing notes, and managing repeat clients.

5. Operational risk review
- Identify likely failure modes:
  - duplicate bookings
  - stale availability
  - gender assignment mismatch
  - inactive staff still appearing available
  - public access to sensitive data
  - admin lockout
  - dashboard metric drift
  - email failures blocking bookings
  - timezone/date parsing bugs
  - mobile admin table overflow
  - unsupported service area bookings

Required validation commands/checks if available:
- `pnpm lint`
- `pnpm build`
- `git diff --check`
- Supabase migration status
- Supabase security advisor

Do not expose `.env` secret values. You may read `.env.example`.

Deliverables:
- Link to the GitHub issue you created.
- Architecture map:
  - frontend routes
  - admin routes
  - API/server action boundaries
  - Supabase client usage
  - database entity map
  - email/Resend flow
  - Sentry/Cloudflare/deployment flow
- Data-flow diagrams in text form for:
  - public booking
  - slot calculation
  - booking creation
  - admin booking management
  - assignment claiming
  - client CRM
  - dashboard metrics
  - email notifications
- Business-fit gap list.
- Security and RLS risk list.
- Booking experience architecture findings, including multi-person bookings, repeat bookings, gender-aware availability, and date/time selection risks.
- Admin experience architecture findings, including login, navigation, management workflows, CRM clarity, and daily operations.
- Findings table with:
  - severity
  - title
  - evidence
  - affected files/tables/routes
  - why it matters
  - recommended follow-up GitHub issue title
- Create review findings files in `implementation-plans/audit-review-findings/phase-1-architecture-codebase-database/`.
- Use no more than these five files:
  - `01-frontend-booking-ux-findings.md`
  - `02-admin-crm-ux-findings.md`
  - `03-backend-data-security-findings.md`
  - `04-business-operational-gaps.md`
  - `05-blockers-and-follow-up-issues.md`
- Explicit confirmation that no fixes were made.
- Comment the final audit summary on the GitHub issue and leave the issue open unless the user explicitly asks you to close it.
```

## 6. Phase 2 Standalone Prompt: Browser E2E, Admin, Customer, Security, And Visual Audit

Copy this prompt into ChatGPT 5.5 as a standalone request.

```md
You are ChatGPT 5.5 acting as a senior QA automation engineer, product tester, browser-based UX auditor, and security regression tester.

I need you to perform Phase 2 of a three-phase audit for the Rahma Therapy project. This phase is live E2E testing through the browser, admin UI, public booking UI, Supabase, Chrome DevTools MCP, and Playwright/browser tooling.

This is audit-only. Do not fix anything. Do not edit files. Do not add features. Do not refactor. Do not create migrations. You may create temporary test data only when needed for QA. All test data must be clearly prefixed with `audit_phase2_` and cleaned up before the phase ends.

Before doing anything else, use the GitHub MCP to create a new issue titled:

`Audit Phase 2: Browser E2E, Admin, Customer, Security, and Visual Review`

Issue body:

## Objective
Exercise the Rahma Therapy website end to end as a customer, admin, and staff member, using browser tooling and Supabase verification.

## Scope
- Full-stack frontend and backend behavior
- Public website behavior
- Customer booking flow
- Booking-page user experience
- Multi-person and repeat-customer booking behavior
- Availability and gender-aware slots
- Gender-aware date/time presentation for male and female clients
- Admin login and RBAC
- Admin booking management
- Admin CRM experience from login through daily operations
- Staff assignment claiming
- Client CRM
- Staff/services/settings/availability/roles admin pages
- Dashboard accuracy
- Resend email side effects
- RLS/security runtime checks
- Desktop and mobile visual audit
- Accessibility basics

## Acceptance Criteria
- Customer booking flows are tested end to end.
- Booking UX is evaluated for clarity, ease, trust, and missing steps.
- Multiple bookings by the same customer are tested or explicitly assessed.
- Multi-person participant information capture is tested.
- Gender-aware availability is reviewed from both technical and UX perspectives.
- Admin workflows are tested end to end.
- Admin CRM UX is reviewed from login through booking/client/staff/service/settings management.
- Mixed-gender and single bookings are verified.
- Assignment claiming rules are tested.
- RLS/security checks are attempted.
- Resend email behavior is observed without exposing secrets.
- Desktop and mobile screenshots/evidence are captured where useful.
- Findings are documented with severity and reproduction notes.
- Findings files are created under `implementation-plans/audit-review-findings/phase-2-e2e-admin-booking-ux/` using the approved filenames and capped at five files.
- No fixes or feature work are performed.

After creating the issue, begin the audit.

Project context:
- Rahma Therapy is a UK mobile therapy business.
- The site should be running at `http://localhost:3000`.
- Customers book mobile appointments from the public website.
- Customers do not log in.
- Staff/admin users log in through Supabase Auth.
- Admin users manage bookings, clients, staff, services, roles, settings, availability, dashboard, notes, payment status, and assignment claiming.
- Payments are tracked as in-person cash/card, not online checkout.
- Resend sends confirmation/admin/cancellation/reminder style emails.
- Sentry is present for app monitoring.
- Supabase is the source of truth for auth, database, RLS, and server-side booking data.

Important constraints:
- Do not expose `.env` secrets.
- Do not permanently modify production-like data.
- Prefix all QA records with `audit_phase2_`.
- Clean all temporary records before finishing.
- If a real admin account cannot be created through the UI, use Supabase MCP to provision a temporary audit admin only if needed, then clean it up.
- If a workflow is impossible because the UI has no path for it, document that as a finding rather than inventing a workaround silently.
- If email sending is tested, use safe test recipients and record whether Resend accepted the send. Do not publish email contents containing private data.

Required tools:
- Chrome DevTools MCP for browser inspection, console logs, network requests, screenshots, and viewport changes.
- Playwright/browser tooling for repeatable browser actions where useful.
- Supabase MCP for database verification, temporary data setup, RLS tests, and cleanup.
- GitHub MCP for issue creation and finding issues.

Pre-test setup:
1. Confirm the site is reachable at `http://localhost:3000`.
2. Confirm baseline routes load:
   - `/`
   - `/home/`
   - `/services/`
   - `/about/`
   - `/reviews/`
   - `/faqs-aftercare/`
   - `/admin/login/`
3. Check browser console and network errors on initial public and admin pages.
4. Record current Supabase migration/security status if accessible.

Customer-side E2E tests:
1. Public site browsing
- Review homepage, services, package detail pages, about, reviews, and FAQs/aftercare.
- Check whether calls-to-action lead to booking.
- Check whether content is appropriate for a UK mobile therapy business.
- Look for missing trust/safety information, unclear service-area information, weak contraindication language, weak aftercare guidance, missing cancellation expectations, or confusing payment expectations.

2. Single-person booking
- Start booking from the public UI.
- Verify the sequence remains: Service -> Demographics -> Location -> Dates/Times -> Details/Review/Confirmation.
- Select a service.
- Select one participant.
- Enter valid location/contact/health/consent details.
- Select an available slot.
- Submit the booking.
- Verify the booking is created in Supabase with correct client, booking, participant, item, assignment, consent, notes, service snapshot, price, duration, address, and status fields.
- Verify email side effects do not break booking creation.
- Evaluate whether the booking experience feels easy, respectful, and confidence-building for a therapy customer.
- Evaluate whether the customer understands why gender, location, health notes, and consent are being requested.
- Evaluate whether date/time availability feels natural and does not expose backend staff-assignment complexity.

3. Mixed-gender group booking
- Submit a booking with at least one male and one female participant.
- Verify participants are split correctly.
- Verify booking items and assignment rows are created correctly.
- Verify required therapist genders match the participants.
- Verify assignment status is initially unassigned or partially assigned according to actual claim state.
- Verify the group booking remains simultaneous unless the system intentionally supports staggered times.
- Evaluate how easy it is to enter different people's information on the booking page.
- Check whether the UI makes participant identity, participant gender, required therapist gender, service selection, and main-contact details clear.
- Check whether the UI prevents mismatched or ambiguous participant data.

4. Repeat and multiple-booking behavior
- Submit or inspect multiple bookings for the same customer details.
- Verify whether the CRM links repeat bookings to the same or clearly deduplicated client record.
- Verify previous booking details do not overwrite new booking details incorrectly.
- Verify participant-level details, health notes, consent, address, service snapshots, and booking dates remain tied to the correct booking.
- Identify whether the customer has a clear path to make another booking without confusion.

5. Availability and slot behavior
- Test active male therapist availability.
- Test active female therapist availability.
- Test inactive staff exclusion.
- Test `can_take_bookings = false` exclusion.
- Test `use_global`, `custom`, and `global_with_overrides` where data is available or can be safely created.
- Test blocked dates, overrides, buffer time, booking window, and minimum notice.
- Verify a slot disappears only when all matching eligible therapists for that slot are consumed.
- Verify mixed-gender slots require both male and female eligible therapists at the same time.
- Verify UK/London date behavior around current date and future dates; watch for UTC/BST off-by-one errors.
- Review the user-facing availability model:
  - male clients should only see times backed by eligible male therapist availability when that is required
  - female clients should only see times backed by eligible female therapist availability when that is required
  - mixed groups should only see simultaneous times backed by all required therapist genders
  - the UI should avoid awkward phrasing, unnecessary staff exposure, or making the customer manually reason about therapist capacity
- Identify whether availability messaging should explain "matched therapist availability" in a simple customer-friendly way.

Admin-side E2E tests:
1. Admin authentication and route protection
- Verify unauthenticated `/admin/*` access redirects or is blocked.
- Log in as an audit admin.
- Verify inactive users cannot access admin.
- Verify a restricted therapist cannot access `/admin/settings`, roles management, or other unauthorized pages.
- Verify the admin sidebar only shows allowed routes.
- Review login UX, failed login states, redirect behavior, signout behavior, and whether admins understand where they are after login.

2. Roles and lockout protection
- Check role list and role detail pages.
- Verify critical permissions such as `manage_users` and `manage_roles`.
- Attempt or inspect protections for:
  - deactivating the last Owner/Super Admin
  - deleting the last Owner/Super Admin
  - removing critical permissions from the last Owner/Super Admin
  - self-lockout
  - unauthorized role management
- Do not leave the system in a changed permission state.

3. Staff management and availability
- Create or inspect temporary active/inactive staff profiles.
- Verify gender, active status, `can_take_bookings`, role, and availability mode behavior.
- Verify staff availability pages save/read correctly if safe test data is used.
- Verify inactive staff cannot appear in booking availability.

4. Services management
- Create, edit, and delete or deactivate an `audit_phase2_` service if safe.
- Verify service visibility and booking availability behavior.
- Verify historical bookings preserve service snapshots.

5. Settings and global availability
- Inspect booking window, minimum notice, buffer time, allowed service areas, global weekly rules, blocked dates, and overrides.
- Make temporary changes only if they can be safely restored.
- Verify settings changes affect slot calculation as expected.

6. Booking management
- Open booking list and detail pages.
- Verify group booking display, participants, items, assignments, notes, payment method/status, booking status, assignment status, address, and client context.
- Update booking status, payment status, admin notes, treatment notes, and health notes only on audit records.
- Verify changes persist in Supabase.
- Evaluate whether an admin can quickly understand what needs attention, which participants need staff, who can claim what, payment state, customer notes, health/safety context, and appointment location.
- Check whether the admin experience supports daily CRM operations without forcing staff to inspect raw database details.

7. Assignment claiming
- Log in or act as eligible staff where possible.
- Claim a matching-gender assignment.
- Verify status transitions from unassigned to partially assigned to fully assigned.
- Verify wrong-gender claim fails.
- Verify inactive staff claim fails.
- Verify staff with `can_take_bookings = false` claim fails.
- Verify already claimed assignment cannot be claimed again.
- Attempt concurrent claim behavior if practical.

8. Client CRM
- Search for clients by name, phone, and email.
- Open a client detail page.
- Verify past/future booking history.
- Verify repeat client behavior.
- Check whether sensitive notes are appropriately protected.
- Evaluate whether the CRM helps staff understand a client's booking history, repeat visits, future bookings, notes, and safety context without exposing too much information to unauthorized roles.

9. Dashboard
- Compare dashboard metrics against Supabase records:
  - total bookings
  - unassigned assignments
  - partially assigned bookings
  - fully assigned bookings
  - completed revenue
  - average booking value
  - staff workload
  - most booked services
  - repeat clients
- Identify stale, inaccurate, or permission-inappropriate metrics.

Security/RLS runtime checks:
- Attempt anon raw reads from `bookings`, `clients`, `booking_participants`, `booking_items`, `booking_assignments`, `staff_profiles`, and notes fields.
- Attempt anon inserts into sensitive tables.
- Attempt authenticated raw writes that should only happen through server actions.
- Confirm service-role server flows still work.
- Confirm public API routes do not leak sensitive details.
- Confirm email and service-role keys are never exposed to browser network responses, JS bundles, or console output.

Visual, mobile, and accessibility checks:
- Test desktop width around 1440px.
- Test tablet width around 768px.
- Test mobile width around 390px.
- Capture screenshots where useful.
- Check public booking dialog and every major admin page:
  - dashboard
  - bookings list/detail
  - clients list/detail
  - staff list/detail/availability
  - services
  - settings
  - availability
  - roles list/detail
- Check:
  - layout overflow
  - text overlap
  - table usability
  - button and form control sizing
  - loading/error/empty states
  - keyboard navigation basics
  - visible focus states
  - labels for inputs
  - contrast/readability
  - brand consistency with warm clinical Rahma Therapy style

Business-specific missing-items audit:
- Does the site clearly explain service areas?
- Does it set expectations for mobile arrival, parking/access notes, preparation, and aftercare?
- Does it explain payment timing and methods?
- Does it explain cancellation/rescheduling policy?
- Does it collect enough safety/consent information without becoming a full medical intake?
- Does it protect health notes and sensitive client data?
- Does it give admins enough operational visibility to run the business daily?
- Does the email system cover customer confirmation, admin notification, cancellation, and reminders?
- Does the UX build trust for therapy/hijama services?
- Does the booking flow make gender matching feel clear and respectful rather than awkward?
- Does the booking flow handle a customer booking for themselves, for someone else, and for several people?
- Does the booking flow support repeat customers making multiple bookings without data confusion?
- Does the admin CRM give a complete operational picture from login through client, staff, service, booking, and payment management?

Deliverables:
- Link to the GitHub issue you created.
- Browser routes tested.
- Admin workflows tested.
- Supabase records created and cleanup confirmation.
- Screenshots/evidence summary.
- Console/network issue summary.
- E2E test matrix with pass/fail/blocked.
- Security/RLS test matrix with pass/fail/blocked.
- Mobile/accessibility findings.
- Business-fit findings.
- Booking-experience findings focused on clarity, missing steps, blockers, multi-person data entry, repeat bookings, and gender-aware availability.
- Admin-experience findings focused on login, navigation, management workflows, CRM clarity, and day-to-day operations.
- Findings table with:
  - severity
  - title
  - reproduction steps
  - expected behavior
  - actual behavior
  - evidence
  - affected route/file/table
  - recommended follow-up GitHub issue title
- Create review findings files in `implementation-plans/audit-review-findings/phase-2-e2e-admin-booking-ux/`.
- Use no more than these five files:
  - `01-frontend-booking-ux-findings.md`
  - `02-admin-crm-ux-findings.md`
  - `03-backend-data-security-findings.md`
  - `04-business-operational-gaps.md`
  - `05-blockers-and-follow-up-issues.md`
- Create separate GitHub issues for confirmed defects only after documenting them. Keep each issue atomic.
- Comment the final Phase 2 audit summary on the audit issue.
- Leave the audit issue open unless the user explicitly asks you to close it.
- Explicitly confirm no fixes were made.
```

## 7. Phase 3 Standalone Prompt: Findings Triage, Gap Analysis, Production Readiness, And Remediation Roadmap

Copy this prompt into ChatGPT 5.5 as a standalone request.

```md
You are ChatGPT 5.5 acting as a principal engineer, QA lead, product owner, security reviewer, and launch-readiness reviewer.

I need you to perform Phase 3 of a three-phase audit for the Rahma Therapy project. This phase turns audit evidence into a final findings register, production-readiness assessment, business-gap analysis, and remediation roadmap.

This is audit-only. Do not fix anything. Do not edit files. Do not add features. Do not refactor. Do not create migrations. Do not change Supabase data. Create GitHub issues for findings, but do not implement fixes.

Before doing anything else, use the GitHub MCP to create a new issue titled:

`Audit Phase 3: Findings Triage, Production Readiness, and Remediation Roadmap`

Issue body:

## Objective
Consolidate architecture, E2E, security, visual, business-fit, and operational findings into a prioritized launch-readiness report and atomic GitHub issue backlog.

## Scope
- Full-stack frontend/backend findings triage
- Findings triage
- Production readiness
- Security and privacy readiness
- Business operations readiness
- Customer booking readiness
- Booking experience readiness
- Admin CRM readiness
- Admin experience readiness
- Email/Resend readiness
- Observability/Sentry readiness
- Deployment/Cloudflare readiness
- Accessibility and mobile readiness
- Remediation roadmap

## Acceptance Criteria
- Findings are deduplicated and severity-ranked.
- Frontend, backend, booking UX, and admin CRM findings are categorized separately where useful.
- Confirmed defects have atomic GitHub issues.
- Missing business requirements are documented separately from bugs.
- Production blockers are clearly identified.
- Booking-experience blockers and admin-experience blockers are explicitly identified.
- Findings files are created under `implementation-plans/audit-review-findings/phase-3-triage-roadmap/` using the approved filenames and capped at five files.
- Launch readiness is assessed.
- A remediation roadmap is produced.
- No fixes or feature work are performed.

After creating the issue, begin the Phase 3 audit.

Important context:
- Rahma Therapy is a UK mobile therapy business with public booking, Supabase backend, admin CRM, RBAC, staff availability, gender-aware assignment, Resend email notifications, Sentry, and Cloudflare/OpenNext deployment support.
- The original implementation plan is in `implementation-plans/IMPLEMENTATION_PLAN.md`.
- Phase 3 may use findings from prior audit phases if available, but must also be able to run independently by inspecting the current codebase, GitHub issues, Supabase state, and browser state.
- This phase is about organizing truth, not making changes.

Inputs to collect:
- Existing GitHub audit issues and defect issues.
- `IMPLEMENTATION_PLAN.md`.
- Current Git status and uncommitted file list.
- Current package scripts and dependency list.
- Supabase migration status.
- Supabase security advisor.
- RLS/grants/policies summary.
- Key admin/public routes.
- Browser smoke evidence if needed.
- Sentry/Resend/Cloudflare environment expectations from `.env.example`.

Triage categories:

1. Functional correctness
- Public booking flow
- Booking-page UX and step sequencing
- Availability calculation
- Gender-aware availability presentation for male, female, and mixed-group bookings
- Booking creation transaction
- Booking participant/item/assignment normalization
- Repeat customer and multiple-booking behavior
- Admin booking management
- Assignment claiming
- Client CRM
- Staff/services/settings/availability/roles
- Dashboard metrics
- Email side effects

2. Security and privacy
- RLS policies
- Service-role boundaries
- Auth guards
- Admin route protection
- RBAC enforcement
- Inactive staff lockout
- Owner/Super Admin lockout protections
- Sensitive client and health notes protection
- Public API leakage
- Browser bundle secret leakage
- Audit logs for sensitive changes
- GDPR/privacy-readiness concerns

3. Business operations
- Mobile appointment service area handling
- UK postcode and address quality
- Travel buffer and realistic scheduling
- Cancellation/rescheduling workflow
- Customer manage links
- Cash/card payment tracking
- Admin daily workflow visibility
- Unassigned booking alerts
- Staff workload and availability maintenance
- Repeat client tracking
- Multi-person booking operations
- Admin daily workflow from login to management completion
- Clinical safety, consent, notes, and aftercare expectations
- Email deliverability and sender identity

4. UX, accessibility, and visual quality
- Brand consistency with Rahma Therapy warm clinical visual language
- Public website trust and clarity
- Booking form clarity
- Booking form ease for single clients, someone booking on behalf of another person, repeat customers, and multi-person groups
- Gender-matching wording and date/time availability clarity
- Whether male and female clients only see appropriate matching availability without awkward or confusing UX
- Admin mobile usability
- Admin login, navigation, CRM management, booking management, staff/service/settings workflows, and dashboard usability
- Tables/detail pages on small screens
- Form labels
- Focus states
- Keyboard navigation
- Contrast/readability
- Error, empty, loading, success, and permission-limited states

5. Observability and deployment readiness
- Sentry coverage for server/client errors
- Error handling and logging
- Environment variable completeness
- Resend production sender/domain readiness
- Cloudflare/OpenNext scripts and assumptions
- Build/lint status
- Migration reproducibility
- Rollback and backup assumptions

Finding rules:
- A finding must have evidence.
- Do not create duplicate issues for the same root cause.
- Separate bugs from missing product requirements.
- Separate security issues from UX issues.
- Keep GitHub issues atomic and actionable.
- Each issue must include:
  - objective
  - severity
  - affected area
  - reproduction or evidence
  - expected behavior
  - actual behavior
  - acceptance criteria
  - scope guard saying not to fix unrelated behavior

Prioritization rules:
- P0: must fix before any real customer/staff use.
- P1: must fix before public launch.
- P2: should fix before serious marketing/scale.
- P3: backlog polish or operational improvement.

Required checks if feasible:
- `pnpm lint`
- `pnpm build`
- `git diff --check`
- Supabase security advisor
- Supabase migration status
- Browser smoke check for public home, booking flow, admin login, and one admin page

Production-readiness gates:
- Build and lint pass.
- No known blocker/high security findings.
- No known booking data integrity blocker.
- RLS blocks public/raw sensitive access.
- Admin RBAC and inactive staff protections work.
- Booking creation does not depend on email success.
- Resend sender/domain and `NEXT_PUBLIC_SITE_URL` are production-ready.
- Dashboard metrics are trustworthy enough for operations.
- Admin can run daily workflows on mobile or a realistic device.
- Public booking UX is clear and trust-building.
- Health/consent data is collected and protected appropriately.
- Test data is cleaned up.

Deliverables:
- Link to the GitHub issue you created.
- Executive summary.
- Launch readiness verdict:
  - Ready
  - Ready with non-blocking issues
  - Not ready
  - Blocked
- Architecture confidence summary.
- Findings register grouped by severity and category.
- GitHub issue backlog table:
  - issue link
  - title
  - severity
  - category
  - affected area
  - recommended order
- Missing business requirements list.
- Security/privacy readiness assessment.
- CRM/admin operations readiness assessment.
- Customer booking readiness assessment.
- Booking experience readiness assessment, including multiple bookings, participant data, gender-aware date/time availability, and blockers introduced by the current flow.
- Admin experience readiness assessment, including login, navigation, CRM operations, booking lifecycle management, staff/service/settings management, and dashboard usability.
- Email/Resend readiness assessment.
- Sentry/observability readiness assessment.
- Cloudflare/deployment readiness assessment.
- Accessibility/mobile readiness assessment.
- Data cleanup confirmation.
- Create review findings files in `implementation-plans/audit-review-findings/phase-3-triage-roadmap/`.
- Use no more than these five files:
  - `01-frontend-booking-ux-findings.md`
  - `02-admin-crm-ux-findings.md`
  - `03-backend-data-security-findings.md`
  - `04-business-operational-gaps.md`
  - `05-blockers-and-follow-up-issues.md`
- Explicit confirmation that no fixes were made.
- Comment the final roadmap on the Phase 3 GitHub issue.
- Leave the issue open unless the user explicitly asks you to close it.
```

## 8. Recommended Phase Order

Run the phases in this order:

1. Phase 1: Architecture, Codebase, Database, and Business Fit Audit.
2. Phase 2: Browser E2E, Admin, Customer, Security, and Visual Audit.
3. Phase 3: Findings Triage, Production Readiness, and Remediation Roadmap.

Phase 2 can be started without Phase 1 if needed, because it is written as a standalone prompt. Phase 3 is strongest when it has Phase 1 and Phase 2 findings, but it can still inspect the repo and GitHub issues independently.

## 9. Important Reminder

These prompts are designed to find truth, not to repair the system. If an audit phase discovers an issue, the next correct step is:

1. Create or update a GitHub issue for the finding.
2. Confirm the finding with evidence.
3. Ask for permission before implementing a fix.
4. Fix only the issue scope if approved.
5. Verify the fix.
6. Close the finding issue only when acceptance criteria are met.
