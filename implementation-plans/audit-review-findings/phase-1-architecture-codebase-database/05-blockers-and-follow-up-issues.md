# Phase 1 Blockers, Follow-Up Issues, And Audit Summary

Tracking issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/84

## Scope

This file is the Phase 1 roll-up for architecture, codebase, database, RLS, business-fit, validation, and follow-up issues. No fixes or feature work were performed.

## Skills And Capabilities Used

| Capability | Why used |
| --- | --- |
| architecture | Full-stack route, shell, boundary, and deployment mapping. |
| database-design | Database entity, relationship, constraint, and migration review. |
| codex-security:threat-model | RLS, service-role, auth, email secret, and trust-boundary review. |
| agile-product-owner | Business-fit, CRM benchmark, and must-have/should-have/polish prioritization. |

## Created GitHub Issues

| Issue | Severity | Title |
| --- | --- | --- |
| https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/84 | Tracking | Audit Phase 1: Architecture, Codebase, Database, and Business Fit Review |
| https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/85 | Low | Phase 1 audit: README still describes admin and booking backend as future work |
| https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/86 | Low | Phase 1 audit: Replace deprecated Next.js middleware convention with proxy |
| https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/87 | Low | Phase 1 audit: Remove or reconcile unused legacy AdminSidebar component |
| https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/88 | Medium | Phase 1 audit: Enable Supabase leaked password protection before launch |
| https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/89 | Medium | Phase 1 audit: Add missing indexes for Supabase advisor unindexed foreign keys |

## Architecture Map

### Frontend And Admin Routes

```text
Public
  /, /home, /services, /services/[slug], /about, /reviews, /faqs-aftercare

Booking
  /api/availability
  /api/bookings
  /booking/manage

Admin
  /admin, /admin/login, /admin/signout, /admin/dashboard
  /admin/bookings, /admin/bookings/[bookingId], /admin/bookings/new
  /admin/calendar, /admin/reports, /admin/reports/export
  /admin/clients, /admin/clients/[clientId], /admin/clients/new
  /admin/enquiries
  /admin/staff, /admin/staff/[staffId], /admin/staff/[staffId]/availability
  /admin/services, /admin/availability, /admin/roles, /admin/roles/[roleId]
  /admin/audit, /admin/privacy, /admin/emails, /admin/operations, /admin/settings
```

### Admin Shell And Navigation

```text
src/middleware.ts
  -> session/profile/active staff route protection
src/app/admin/layout.tsx
  -> getStaffProfile()
  -> inactive access denied or AdminShell
src/app/admin/components/AdminShell.tsx
  -> desktop sidebar, mobile drawer, skip link, permission-filtered nav
src/app/admin/components/AdminCommandSearch.tsx
  -> permission-scoped search
src/app/admin/components/admin-ui.tsx
  -> shared admin page/header/panel/status/filter/empty/action primitives
```

### Supabase And Backend Boundary

```text
Browser anon client
  -> public client usage only
Server SSR anon client
  -> staff session and auth-aware server rendering
Service-role client
  -> route handlers, admin server actions, booking RPC, email/ops/audit writes
```

### Database Entity Map

```text
RBAC: roles, permissions, role_permissions, staff_permission_overrides
Staff: staff_profiles, staff_availability_rules, staff_availability_overrides, staff_blocked_dates
Settings/services: business_settings, services
Global availability: availability_rules, availability_overrides, blocked_dates
Bookings: clients, bookings, booking_participants, booking_items, booking_assignments
CRM/privacy/ops: client_notes, client_privacy_requests, enquiries, audit_logs, email_delivery_events, operational_events
```

### Email, Observability, And Deployment

```text
Booking/admin/customer action
  -> src/lib/email/notifications.ts
  -> src/lib/email/client.ts Resend server-only client
  -> email_delivery_events
  -> operational_events on failures
  -> Sentry configured for runtime observability
  -> Next.js 16 and OpenNext/Cloudflare build path
```

## Data-Flow Diagrams

```text
Public booking
UI -> /api/availability -> calculateAvailableSlots -> /api/bookings -> create_booking_request RPC -> email -> admin CRM

Slot calculation
services + participant genders + business settings + staff profiles + global/staff availability + existing bookings -> feasible slots

Booking creation
validated request -> RPC -> clients -> bookings -> booking_participants -> booking_items -> booking_assignments -> manage token

Customer manage link
email token -> hash lookup -> safe booking projection -> cancel/reschedule/note action -> audit/email/ops event

Admin booking management
AdminShell -> permission-scoped booking list/detail -> server actions -> audit/email/ops events

Manual booking creation
/admin/bookings/new -> permission-gated action -> normalized booking tables -> admin CRM

Manual client creation
/admin/clients/new -> permission-gated action -> clients -> client CRM

Assignment claiming
eligible staff -> unassigned assignment -> gender/active/can_take_bookings checks -> atomic claim -> audit/staff email

Client CRM
client list -> client detail -> booking history + notes + privacy actions by permission

Dashboard metrics
admin dashboard -> permission-scoped booking/client/payment data -> operational metrics

Reports and CSV export
reports -> report queries -> export route -> CSV without sensitive notes -> audit log

Enquiries
admin enquiries -> assigned/converted states -> optional booking link -> auditable admin action

Email notifications
booking/customer/admin event -> notification template -> Resend -> delivery event

Email delivery events
send attempt -> email_delivery_events -> admin email status surface

Operational events
backend failure or important operational state -> operational_events -> admin operations route

Privacy operations
privacy request -> permission-scoped admin action -> audit and privacy tracking tables

Audit logs
sensitive admin/customer-manage events -> audit_logs -> admin audit route
```

## Documentation Freshness

| Severity | Finding | Evidence | Follow-up |
| --- | --- | --- | --- |
| Low | README is stale against current admin/CRM implementation. | README still describes admin/CMS and booking backend pieces as future despite implemented admin CRM, API routes, E2E, privacy, reporting, email, and operations surfaces. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/85 |

Production docs are materially fresher than README. The role matrix, reporting definitions, privacy/data-retention guide, RLS/privacy verification, Phase 10 test setup, and production runbook align better with the implemented admin/CRM system.

## Test And Script Inventory

| Area | Evidence |
| --- | --- |
| Unit/integration tests | Vitest tests passed via `pnpm test`. |
| Playwright E2E | `e2e/*` and scripts for setup/cleanup exist; not run in Phase 1. |
| E2E data setup | `scripts/phase10-e2e-data.mjs`, `pnpm test:e2e:setup`, `pnpm test:e2e:cleanup`. |
| Owner bootstrap | `scripts/bootstrap-owner-admin.mjs`, `pnpm bootstrap:owner-admin`. |
| London time verification | `scripts/verify-london-time.mjs`, `pnpm verify:london-time`. |
| Browser secret scan | `scripts/scan-browser-secrets.mjs`, `pnpm test:security:secrets`. |
| Cloudflare/OpenNext build | `pnpm cf:build`, `open-next.config.ts`, `wrangler.jsonc`. |

## Validation Results

| Check | Result |
| --- | --- |
| `pnpm lint` | Passed. |
| `pnpm build` | Passed; deprecated middleware warning remains. |
| `pnpm test` | Passed after sandbox-related escalation. |
| `pnpm test:security:secrets` | Passed. |
| `pnpm verify:london-time` | Passed. |
| `pnpm cf:build` | Passed after sandbox-related escalation; Windows/OpenNext and middleware/proxy warnings remain. |
| `git diff --check` | Passed; line-ending warning on pre-existing `implementation_plan2.md`. |
| Supabase migration status | Live migrations applied through Phase 10 inactive-staff self-profile RLS. Local filenames/timestamps differ from live labels but logical phases are present. |
| Supabase security advisor | Warns that leaked password protection is disabled. |
| Supabase performance advisor | Warns about unindexed FKs, RLS initplan, multiple permissive policies, and unused indexes. |

## Findings Table

| Severity | Title | Evidence | Affected files/tables/routes | Why it matters | Recommended follow-up issue |
| --- | --- | --- | --- | --- | --- |
| Medium | Enable Supabase leaked password protection | Supabase security advisor reports `auth_leaked_password_protection`; production RLS/privacy docs also list it as pending. | Supabase Auth | Staff/admin accounts protect sensitive client, health, booking, and payment data. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/88 |
| Medium | Add missing indexes for Supabase advisor unindexed foreign keys | Performance advisor reports unindexed FKs across bookings, assignments, role, staff, email, enquiry, privacy, audit, and operations tables. | Multiple public tables | Admin CRM queries, RLS checks, reports, and deletes/updates can slow down as production data grows. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/89 |
| Low | Replace deprecated Next.js middleware convention with proxy | `pnpm build` and `pnpm cf:build` warn that `middleware` is deprecated; plan references `src/proxy.ts`. | `src/middleware.ts`, admin route protection | Route protection currently works, but future framework upgrades can create deployment risk. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/86 |
| Low | Remove or reconcile unused legacy AdminSidebar | `rg "AdminSidebar" src` only finds the component definition. | `src/app/admin/AdminSidebar.tsx`, `src/app/admin/components/AdminShell.tsx` | Duplicate navigation concepts can drift from active permission and responsive behavior. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/87 |
| Low | Refresh README to match implemented admin/CRM/backend state | README still presents implemented features as future work and has stale Sentry env naming. | `README.md`, docs | Onboarding and production operation docs should not contradict implemented behavior. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/85 |

## Blockers And Open Checks

No Phase 1 blocker prevented completion.

Checks intentionally deferred to later phases:

- Live browser testing of public booking, manage link, and admin CRM.
- Runtime RLS tests using anon/authenticated/service-role contexts.
- Playwright E2E execution and screenshot review.
- Production Sentry event capture and Resend sender/domain verification.
- Real staff/admin workflow testing with owner, admin, therapist, restricted, inactive, and no-bookings personas.

## Explicit No-Fix Confirmation

No application fixes, feature changes, schema changes, migration changes, configuration changes, or production changes were made in Phase 1. Only audit documentation files and GitHub issue/comment deliverables were created.
