# Rahma Therapy Full-Stack Audit Prompt Plan

## 1. Purpose

This document is a standalone prompt pack for a comprehensive post-implementation audit of the Rahma Therapy live website, admin/staff CRM, booking operations, backend, business workflows, and operational tooling.

The original implementation plan established the first intended system model, and the latest implementation/remediation direction is now captured in `implementation-plans/implementation_plan3.md`. The next goal is not to build more features during this audit. The next goal is to audit what exists against the latest plan, identify gaps, verify whether the system matches the business model, assess the admin/staff frontend quality, and create clear GitHub issues for discrepancies.

This revised audit focus is intentionally admin- and staff-facing for frontend quality:

- Fully audit admin/staff-facing pages for design, UI, UX, responsiveness, accessibility, spacing, alignment, visual hierarchy, interaction quality, and workflow clarity.
- Do not run a visual redesign audit of public marketing pages such as `/home`, service pages, reviews, about, or FAQs.
- Do audit the customer lifecycle workflow from booking request through admin response, confirmation, cancellation/rescheduling expectations, email side effects, and CRM visibility.
- Observe the live production website at `https://rahmatherapy.uk` as the primary browser target.
- Use `http://localhost:3000` only as a fallback, comparison target, or when a local-only admin/test-data setup is required.

Each phase below is written so it can be copied into a fresh ChatGPT 5.5 session as a standalone prompt. Do not assume the model has access to previous audit phases unless the prompt explicitly says so.

## 2. Global Audit Rules

These rules apply to every audit phase.

- This is audit-only work.
- Do not fix code.
- Do not add features.
- Do not refactor.
- Do not edit application code, schemas, migrations, UI, backend logic, configuration, environment files, or feature files.
- You may create or update only the required audit artifact files and GitHub issues.
- Do not change test data permanently.
- Before beginning each phase, create a new GitHub issue for that exact phase using the GitHub MCP.
- If the audit finds a defect, gap, or missing requirement, create a separate GitHub issue for that finding before proposing any fix.
- Do not close an audit phase issue unless the audit phase has been completed and its findings have been documented.
- Use Supabase MCP for database inspection, RLS checks, migration status, and temporary test data where needed.
- Use Chrome DevTools MCP and Playwright/browser tooling for visual, accessibility, responsive, and E2E testing.
- Use web research where available for CRM/admin benchmark comparisons, cite source links, and record if web research was unavailable.
- Use the live production website at `https://rahmatherapy.uk` as the primary browser target.
- Use the local website at `http://localhost:3000` only as a fallback, comparison target, or when temporary audit accounts/data are required and production-like data must not be touched.
- Any test records must be clearly prefixed, for example `audit_phase1_`, `audit_phase2_`, or `audit_phase3_`, and cleaned up before the phase ends.
- Do not print or expose secrets from `.env`.
- Treat `.env.example` as the only safe source for environment variable names.
- Treat `implementation-plans/implementation_plan3.md` as the latest implementation, remediation, and production-readiness direction.
- Treat `implementation-plans/IMPLEMENTATION_PLAN.md` as historical/original implementation context, useful for understanding the earlier intended system model but secondary to `implementation_plan3.md`.
- Treat the current codebase and Supabase state as the source of actual behavior.

Skill usage rules:

- Each standalone phase must use 3 or 4 relevant skills/capabilities before beginning the audit work.
- Skill selection should happen after creating the phase GitHub issue and before collecting evidence.
- The selected skills should match the phase scope rather than being generic. For example:
  - Phase 1 should use architecture/codebase review, database/Supabase, security/RLS, and product/business-fit skills.
  - Phase 2 should use browser automation, frontend/UI/UX design audit, accessibility, and security/RLS/runtime QA skills.
  - Phase 3 should use findings triage, product/launch readiness, security/privacy readiness, and roadmap/planning skills.
- The audit output must list which 3 or 4 skills were used and why.

Credential and persona rules:

- A real owner account exists for audit login when needed: `rahmatherapy@outlook.com`.
- Do not commit, print, or write the owner password into findings files, GitHub issues, logs, screenshots, browser console output, or this plan.
- When running a standalone audit, obtain the owner password from the user in the active session or another secure, non-repo channel.
- Use the owner account only for owner/super-admin perspective testing.
- For all other admin, staff, therapist, inactive, restricted, receptionist/coordinator, reporting, and test-customer perspectives, create temporary `audit_phase*_` users/data through Supabase MCP or the UI as needed.
- Every relevant phase should explicitly audit more than one role/persona. At minimum, cover owner/super-admin, admin/manager, male therapist, female therapist, restricted staff, inactive staff, staff with `can_take_bookings = false`, and customer/no-login lifecycle behavior where the phase scope permits.
- Temporary audit personas and records must be cleaned up before the phase ends.
- If testing on live production risks disturbing real customer/staff data, use localhost or isolated temporary records and document the reason.
- Do not perform destructive, high-volume, or settings-changing tests against live production unless they are isolated, reversible, and clearly safe. Use localhost, a Supabase branch, or temporary prefixed records for heavier scenario coverage.
- Never update, cancel, delete, reassign, or alter real customer bookings, real staff profiles, real services, real roles, or real settings. All mutation tests must use `audit_phase*_` records only.

Benchmarking rules:

- Compare the admin/staff CRM against right-sized industry references, not enterprise-only CRMs.
- Use current research during the audit where useful, and include source links in findings.
- Relevant benchmark categories include:
  - monday.com-style CRM dashboards, activity tracking, automations, pipelines, team performance, duplicate handling, mobile access, imports/exports, and collaboration.
  - Cliniko-style practice management: appointment calendar, treatment notes, practitioner performance, client spend, payment reports, referrals/sources, cancellations/no-shows, recalls, exports, and clients without upcoming appointments.
  - Fresha-style local appointment business operations: calendar, appointments, client profiles, forms/consent, automated messages, sales/finance/client/team reports, team targets, performance tracking, and client reactivation.
- Do not recommend enterprise overengineering. Every benchmark gap should be judged against Rahma Therapy as a small local mobile therapy business.
- Benchmark output should distinguish between:
  - must-have production gaps for Rahma Therapy
  - useful near-term CRM/admin improvements
  - nice-to-have polish
  - enterprise features that should intentionally be left out
- Benchmark scoring should use a simple scale such as `meets`, `partial`, `missing`, `overbuilt risk`, or `not relevant`, with evidence for each rating.

Improvement-opportunity audit rules:

- The audit must not only find defects. It must also identify practical improvements that would make the system feel more polished, reliable, efficient, complete, and production-grade.
- Separate confirmed defects from improvement opportunities. Do not label every refinement as a bug.
- Improvement recommendations should preserve the current product direction, tech stack, brand language, data model, and business model unless there is strong evidence that a larger change is necessary.
- For admin/staff design, look for improvements in:
  - visual hierarchy and page composition
  - spacing, alignment, density, and rhythm
  - typography, headings, labels, badges, and table/card readability
  - component consistency and design-token usage
  - responsive desktop/tablet/mobile behavior
  - keyboard, focus, forms, and accessibility polish
  - loading, empty, success, error, destructive-action, and permission-limited states
  - workflow speed for repeated daily use
  - perceived quality: whether the CRM feels modern, calm, clinical, trustworthy, and purpose-built rather than generic
- For backend and data correctness, look for improvements in:
  - validation boundaries and Zod/server-action/API consistency
  - transaction safety, idempotency, and race-condition handling
  - availability correctness and double-booking prevention
  - gender-aware assignment correctness
  - role-scoped data visibility and server-side permission enforcement
  - audit logging, operational event logging, and privacy workflows
  - report/export correctness, revenue/client metrics, and sensitive-field exclusion
  - email failure handling and retry/manual follow-up paths
  - test coverage for critical booking, admin, privacy, reporting, and RLS behavior
- For business completeness, look for missing essentials that a real UK mobile therapy business needs before trusting the system in production:
  - clear daily owner/admin workflow
  - staff schedule and assignment clarity
  - client history, repeat-client, and manual-client workflows
  - cancellation/rescheduling/customer manage workflow
  - payment tracking and revenue reporting
  - service-area and travel/buffer operational controls
  - privacy/GDPR operations and safe handling of health notes
  - email delivery visibility and follow-up operations
  - operational alerts for bookings, unassigned work, failed emails, and support events
- Every improvement recommendation should include expected business value, affected area, suggested priority, and whether it is a must-have, should-have, or polish item.

## 3. Project Context To Include In Every Phase

Rahma Therapy is a UK mobile therapy business. The system supports public package/service pages, a customer booking flow, a Supabase-backed CRM, and an internal admin/staff system. The live production site is `https://rahmatherapy.uk`.

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
- Admin users need to manage staff, services, bookings, clients, availability, roles, settings, dashboard metrics, revenue/client tracking, notes, payment status, assignment claiming, and daily operational workflow.
- Resend is used for transactional emails.
- Sentry is configured for observability.
- Cloudflare/OpenNext deployment support exists.

Known technical context:

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 App Router |
| UI | React 19 + shadcn/ui |
| Language | TypeScript strict |
| Styling | Tailwind CSS v4, CSS variables, design tokens, utility-first responsive styling |
| Motion | Framer Motion v12 / Motion |
| Date picking | React DayPicker v9 |
| Forms | React Hook Form v7 + Zod v4 |
| Client state | Zustand v5 |
| Server state | TanStack Query v5 |
| Backend platform | Supabase |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| CMS | Custom in-app admin CMS, Supabase-backed, no separate CMS |
| Storage | Supabase Storage |
| Email | Resend |
| Images | `next/image` plus Cloudflare CDN/edge caching |
| Charts/reports | Recharts plus server-side report aggregation/export routes |
| Analytics | None initially; add Umami later if needed |
| Package manager | pnpm v10 |
| Runtime | Node 24.x |
| Build/dev | Next.js build pipeline; Turbopack in dev |
| Deployment | Cloudflare through `@opennextjs/cloudflare` |

Important technical expectations:

- The chosen stack should be evaluated for whether it is being used to a professional standard, especially in admin/staff frontend implementation.
- Admin/staff UI should use existing design tokens, Tailwind responsive utilities, shadcn-style components, accessible form patterns, and purposeful motion where it improves feedback or orientation.
- Public marketing pages are not the primary frontend-design audit target in this revised plan.
- Customer lifecycle behavior still matters: booking request, admin visibility, admin response, confirmation/cancellation/rescheduling emails, CRM records, payment status, and operational follow-up should be audited end to end.
- Some repository documentation may be older than the current implementation. For example, if `README.md` still describes admin as future/reserved, treat that as stale documentation and prefer the current route tree, production docs, migrations, and `implementation_plan3.md`.
- Important code areas:
  - `implementation-plans/implementation_plan3.md`
  - `implementation-plans/IMPLEMENTATION_PLAN.md`
  - `GITHUB_ISSUES_GUIDE.md`
  - `README.md`
  - `docs/production-runbook.md`
  - `docs/production/role-matrix.md`
  - `docs/production/reporting-metric-definitions.md`
  - `docs/production/privacy-data-retention.md`
  - `docs/production/phase9-rls-privacy-verification.md`
  - `docs/production/phase10-test-setup.md`
  - `src/app/(public)/*`
  - `src/app/booking/manage/*`
  - `src/features/booking/*`
  - `src/app/api/availability/*`
  - `src/app/api/bookings/*`
  - `src/lib/booking/availability.ts`
  - `src/lib/booking/customer-manage.ts`
  - `src/lib/booking/manage-token.ts`
  - `src/lib/auth/rbac.ts`
  - `src/lib/supabase/*`
  - `src/lib/email/*`
  - `src/lib/observability/*`
  - `src/lib/ops/*`
  - `src/lib/time/*`
  - `src/app/admin/*`
  - `supabase/migrations/*`
  - `scripts/bootstrap-owner-admin.mjs`
  - `scripts/create-phase-test-auth-users.mjs`
  - `scripts/phase10-e2e-data.mjs`
  - `scripts/scan-browser-secrets.mjs`
  - `scripts/verify-london-time.mjs`
  - `e2e/*`
  - `.env.example`
  - `package.json`
  - `next.config.ts`
  - `open-next.config.ts`
  - `wrangler.jsonc`
  - `src/proxy.ts`

Current verified codebase context to include in audits:

- Admin shell/navigation is implemented in `src/app/admin/components/AdminShell.tsx`, with a responsive desktop sidebar, mobile drawer/top bar, command search, skip link, and permission-filtered navigation.
- `src/app/admin/AdminSidebar.tsx` also exists and may be legacy or superseded; auditors should check whether it is still used or stale.
- Shared admin UI primitives exist in `src/app/admin/components/admin-ui.tsx`, including page headers, stat cards, panels, status badges, filter bars, empty states, access-denied states, and mobile action bars.
- Implemented admin routes include dashboard, bookings list/detail, manual booking creation, calendar, reports, report CSV export, clients list/detail/manual creation, enquiries, staff list/detail/availability, services, global availability, roles/detail permissions, audit log, privacy operations, email status/manual reminder, operational errors, settings, login, and signout.
- Customer self-service management exists under `src/app/booking/manage/*` and should be included in customer lifecycle auditing even though public marketing-page visual redesign is out of scope.
- Reporting is implemented through `src/app/admin/reports/reporting.ts`, `ReportsCharts.tsx`, `reporting.test.ts`, and `src/app/admin/reports/export/route.ts`; metrics and exports should be checked against `docs/production/reporting-metric-definitions.md`.
- Operational visibility is implemented through `operational_events`, `/admin/operations`, email delivery events, `/admin/emails`, audit logs, `/admin/audit`, and privacy workflows under `/admin/privacy`.
- Existing test coverage includes Vitest unit/integration tests for booking schemas, booking summaries, booking package data, booking transaction creation, booking access, reports, manage tokens, London time, and Sentry scrubbing.
- Existing Playwright E2E tests cover phase 10 admin roles, public booking, and booking claiming. `playwright.config.ts` uses `E2E_BASE_URL` with desktop Chrome and mobile Chrome projects.
- Existing scripts include `test:e2e:setup`, `test:e2e:cleanup`, `test:security:secrets`, `bootstrap:owner-admin`, `verify:london-time`, `cf:build`, `preview`, `deploy`, `upload`, and `cf:typegen`.
- The browser secret scan checks built/static output under `.next/static`, `.open-next/assets`, and `public` for sensitive non-public `.env` values.

Core system model expected from the latest implementation plan and original plan context:

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

Revised audit focus for frontend, design, UI, and UX:

- Admin/staff-facing pages are the primary frontend design audit target.
- Audit admin/staff pages for:
  - visual hierarchy
  - spacing
  - alignment
  - density
  - typography
  - color and token consistency
  - responsive layout
  - mobile usability
  - loading, empty, error, success, and permission-limited states
  - keyboard navigation
  - visible focus states
  - form labels and validation
  - table/list/card usability
  - role-specific clarity
  - day-to-day operational speed
  - whether the UI feels modern, polished, calm, and suitable for a clinical/mobile therapy business
- Public marketing pages are out of scope for frontend visual critique unless they directly block the customer booking-to-confirmation workflow.
- The booking page itself is not the main visual-design target in this revised audit, but the customer journey from booking request through admin follow-up, confirmation, cancellation/rescheduling expectations, email side effects, and CRM visibility must still be audited.
- Issues should distinguish:
  - admin/staff frontend UI defects
  - admin/staff workflow defects
  - customer lifecycle workflow defects
  - backend/security defects
  - missing business requirements

## 4. Required Output Standard For Every Phase

Each phase must produce:

- GitHub issue link for that audit phase.
- Scope confirmation.
- The 3 or 4 skills/capabilities selected for the phase and why each was relevant.
- Commands/tools used.
- Files/modules inspected.
- Supabase objects inspected.
- Browser routes/pages tested, where applicable.
- Test data created and cleanup confirmation, where applicable.
- Findings table with severity, evidence, affected area, reproduction notes, and recommended next issue.
- Improvement opportunities table with priority, business value, evidence, affected area, and recommended next issue.
- Missing essentials checklist for design quality, backend correctness, and business operations.
- Review findings files written under that phase's assigned folder. These are audit artifacts only, not implementation changes.
- Explicit "No fixes were made" confirmation.
- Open questions or blocked checks.
- Phase completion decision: complete, partially complete, or blocked.

Severity model:

- Blocker: prevents core booking, admin, data security, or production readiness.
- High: data corruption, permission leak, double-booking risk, invalid gender assignment, broken booking creation, or broken admin workflow.
- Medium: important workflow failure, dashboard mismatch, confusing UX, mobile usability failure, accessibility issue, email side-effect failure, admin layout inconsistency, or missing operational guard.
- Low: copy, minor visual polish, minor consistency issue, small spacing/alignment issue, missing non-critical affordance.

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

For compatibility with prior audit outputs, keep the same filenames. In this revised plan, `01-frontend-booking-ux-findings.md` should primarily cover admin/staff frontend UX and customer lifecycle workflow findings, not public marketing-page visual critique. `02-admin-crm-ux-findings.md` should cover deeper CRM workflow and role-specific operational experience findings. If a category has no confirmed findings, either omit that file or create it with a short "No confirmed findings in this category" note. Do not create extra category files. Do not use findings files to implement fixes.

## 5. Phase 1 Standalone Prompt: Architecture, Codebase, Database, And Business Fit Audit

Copy this prompt into ChatGPT 5.5 as a standalone request.

```md
You are ChatGPT 5.5 acting as a senior full-stack architect, product QA lead, and security-minded code reviewer.

I need you to perform Phase 1 of a three-phase audit for the Rahma Therapy project. This is audit-only. Do not fix anything. Do not edit application code, schemas, migrations, configuration, environment files, backend logic, or frontend UI files. Do not add features. Do not refactor. Do not create migrations. You may create or update only the required audit artifact files and GitHub issues. Do not change Supabase data in Phase 1. If a check cannot be verified read-only, document it as blocked for Phase 2.

Before doing anything else, use the GitHub MCP to create a new issue titled:

`Audit Phase 1: Architecture, Codebase, Database, and Business Fit Review`

Issue body:

## Objective
Map the implemented Rahma Therapy system from a full-stack perspective and compare the actual architecture, admin/staff frontend implementation, CRM workflows, and business operations support against the latest implementation plan, `implementation-plans/implementation_plan3.md`, the original implementation context in `implementation-plans/IMPLEMENTATION_PLAN.md`, and live business needs.

## Scope
- Codebase architecture
- Supabase schema and RLS architecture
- Full-stack frontend and backend architecture
- Customer lifecycle architecture from booking request through admin response, confirmation, cancellation/rescheduling expectations, email, and CRM visibility
- Admin/staff login, management, frontend UI, and CRM experience architecture
- Admin/staff design system usage, responsive layout architecture, component reuse, and accessibility architecture
- Booking, CRM, admin, RBAC, availability, email, observability, and deployment architecture
- Business-fit audit for a UK mobile therapy service
- Gap identification only

## Acceptance Criteria
- Full architecture map is documented.
- Frontend, backend, customer workflow, and admin CRM surfaces are reviewed together as one full-stack system.
- Admin/staff frontend architecture is reviewed for professional use of the chosen stack: Next.js App Router, React, shadcn/ui, TypeScript, Tailwind tokens, responsive utilities, Framer Motion, React Hook Form, Zod, Zustand, TanStack Query, and Supabase.
- Public user, admin, staff, booking, and email data flows are documented.
- Database entities, relationships, RLS boundaries, and service-role usage are reviewed.
- Customer workflow risks are identified, including booking request, multi-person bookings, repeat/multiple bookings, gender-aware availability, admin response, confirmation, cancellation/rescheduling expectations, email side effects, and CRM visibility.
- Admin/staff frontend and UX risks are identified from login through daily CRM management.
- Admin/staff visual, responsive, accessibility, spacing, alignment, component consistency, state handling, and workflow-density risks are identified.
- Admin/staff design and look-and-feel improvement opportunities are identified separately from defects.
- Backend/data correctness improvement opportunities are identified separately from confirmed bugs.
- Owner, admin/manager, therapist, restricted, inactive, and no-bookings staff perspectives are explicitly reviewed at the architecture and workflow-boundary level where relevant.
- Right-sized CRM/admin benchmark gaps are identified against small-business CRM and appointment/practice-management expectations without recommending enterprise overbuild.
- Business-specific missing requirements are identified.
- Essential business gaps are identified with clear must-have versus should-have versus polish prioritization.
- Findings files are created under `implementation-plans/audit-review-findings/phase-1-architecture-codebase-database/` using the approved filenames and capped at five files.
- Findings are documented with severity and evidence.
- No fixes or feature work are performed.

After creating the issue, select and use 3 or 4 relevant skills/capabilities before beginning the audit. For Phase 1, use skills/capabilities covering architecture/codebase review, Supabase/database review, security/RLS review, and product/business-fit review. List the selected skills and why they were used in the deliverables.

After selecting the skills, begin the audit.

Project context:
- Rahma Therapy is a UK mobile therapy business offering home appointments for therapy packages such as massage and hijama-related services.
- Customers book appointments through the public website.
- Customers do not have accounts.
- Staff and admins use Supabase Auth.
- The admin CRM manages bookings, clients, staff, services, roles, settings, availability, dashboard metrics, assignment claiming, notes, and payment status.
- Customers pay in person by cash or card.
- Resend is used for email notifications.
- Sentry is configured for observability.
- The site is live on Cloudflare at `https://rahmatherapy.uk`.
- Local site may also be available at `http://localhost:3000`, but Phase 1 should focus mainly on static architecture, admin/staff frontend architecture, database review, and business workflow review.

Important files and folders:
- `implementation-plans/implementation_plan3.md`
- `implementation-plans/IMPLEMENTATION_PLAN.md`
- `README.md`
- `GITHUB_ISSUES_GUIDE.md`
- `docs/production-runbook.md`
- `docs/production/role-matrix.md`
- `docs/production/reporting-metric-definitions.md`
- `docs/production/privacy-data-retention.md`
- `docs/production/phase9-rls-privacy-verification.md`
- `docs/production/phase10-test-setup.md`
- `.env.example`
- `package.json`
- `next.config.ts`
- `open-next.config.ts`
- `wrangler.jsonc`
- `src/proxy.ts`
- `src/app/(public)/*`
- `src/app/booking/manage/*`
- `src/features/booking/*`
- `src/app/api/availability/*`
- `src/app/api/bookings/*`
- `src/lib/booking/availability.ts`
- `src/lib/booking/customer-manage.ts`
- `src/lib/booking/manage-token.ts`
- `src/lib/auth/rbac.ts`
- `src/lib/supabase/*`
- `src/lib/email/*`
- `src/lib/observability/*`
- `src/lib/ops/*`
- `src/lib/time/*`
- `src/app/admin/*`
- admin layout, `AdminShell`, possible legacy `AdminSidebar`, command search, shared admin UI primitives, dashboard, bookings, manual bookings, calendar, reports/export, clients, manual client creation, enquiries, staff, services, settings, availability, roles, audit log, privacy operations, email status, operational errors, and CMS/content-management-related components where present
- `supabase/migrations/*`
- `scripts/bootstrap-owner-admin.mjs`
- `scripts/create-phase-test-auth-users.mjs`
- `scripts/phase10-e2e-data.mjs`
- `scripts/scan-browser-secrets.mjs`
- `scripts/verify-london-time.mjs`
- `e2e/*`

Expected system model:
- Dynamic RBAC using `roles`, `permissions`, `role_permissions`, and `staff_profiles.role_id`.
- Optional direct staff permissions through `staff_permission_overrides`.
- Staff treatment eligibility must be separate from admin permissions.
- Staff availability must support global rules, custom staff rules, and global-with-overrides inheritance.
- Gender-aware slot calculation must happen before booking creation.
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
- Map admin/staff frontend component structure, `AdminShell`, possible legacy `AdminSidebar`, command search, shared admin UI primitives, design tokens, layout shells, responsive breakpoints, form patterns, data-loading patterns, and state-management patterns.
- Map server actions, API routes, and Supabase client usage.
- Identify any architectural mismatches, duplicate concepts, dead routes, or stale code paths.
- Review the frontend and backend as one connected product, not as isolated code areas.
- Pay special attention to the admin/staff CRM, admin CMS, booking operations, customer lifecycle handoff, and role-specific workflows because these are the highest-risk business operations surfaces.
- Do not perform a visual-design critique of public marketing pages unless they directly affect the customer lifecycle from booking request to confirmation/follow-up.
- Check documentation freshness, especially where `README.md` or older docs describe admin/CMS as future while the current route tree includes implemented admin CRM, reporting, privacy, email, operations, and E2E support.
- Identify architectural refinements that could make the admin system easier to maintain without changing the overall direction, such as consolidating stale components, reducing duplicated permission/navigation logic, improving module boundaries, or standardizing admin UI primitives.

2. Backend and data flow architecture
- Map public booking data flow from UI to validation to availability to booking transaction to email notification.
- Map admin data flow for staff, services, availability, settings, roles, clients, bookings, manual booking creation, manual client creation, assignment claiming, notes, dashboard, calendar, enquiries, reports/CSV exports, emails, audit logs, privacy operations, and operational events.
- Identify which flows use anon Supabase, authenticated Supabase, and service-role Supabase.
- Flag any unnecessary service-role use, missing validation boundary, or unclear trust boundary.
- Map how repeat customers, multiple bookings by the same client, group participants, participant service snapshots, and assignment rows are connected.
- Identify whether the architecture can represent a customer making multiple bookings over time without overwriting or confusing participant, address, health, consent, or booking history data.
- Identify backend hardening opportunities around validation, transaction boundaries, idempotency, concurrency, server-only data access, error handling, audit logging, operational events, report/export correctness, and test coverage.

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
- Evaluate whether the admin/staff frontend feels modern, calm, visually cohesive, responsive, accessible, and professionally designed for repeated daily use.
- Evaluate whether all business workflows available in the admin system are discoverable, efficient, and role-appropriate.
- Evaluate whether the admin UI uses the chosen technology stack well or leaves obvious gaps in component reuse, responsive design, accessible forms, motion/feedback, loading states, and server/client state handling.
- Identify business-essential gaps that would make the system feel incomplete or risky for day-to-day operations, even if the existing code technically works.
- Identify design and workflow refinements that would make the CRM more beautiful, modern, responsive, and convenient without rebuilding it from scratch.

5. Operational risk review
- Identify likely failure modes:
  - duplicate bookings
  - stale availability
  - gender assignment mismatch
  - inactive staff still appearing available
  - public access to sensitive data
  - admin lockout
  - dashboard metric drift
  - reports/revenue/client metric drift
  - email failures blocking bookings
  - timezone/date parsing bugs
  - mobile admin table overflow
  - admin layout spacing/alignment inconsistency
  - admin role-specific UI exposing too much or too little
  - inaccessible forms, filters, navigation, tables, dialogs, or action controls
  - unsupported service area bookings

6. Role/persona and CRM benchmark architecture review
- Map how the system represents and separates owner/super-admin, admin/manager, therapist, restricted staff, inactive staff, staff with `can_take_bookings = false`, and customer/no-login personas.
- Check whether permissions, navigation visibility, dashboard visibility, reporting visibility, client visibility, booking management, assignment claiming, staff/service/settings access, and sensitive notes access are consistently role-scoped.
- Identify whether the codebase has enough reusable primitives to present role-specific CRM views without duplicating business logic or leaking unauthorized actions.
- Compare the implemented admin/CRM architecture against right-sized industry expectations:
  - operational dashboard or work queue for today's business state
  - calendar or agenda view
  - client profile with history and notes
  - booking lifecycle and status management
  - staff workload and performance visibility
  - revenue, client, and booking reports
  - search, filters, exports, and saved views where appropriate
  - automations or notification hooks where appropriate
  - mobile-friendly daily workflow
  - accessible forms and action controls
- Classify benchmark gaps as must-have, near-term improvement, polish, not relevant, or overbuilt risk for a small local mobile therapy business.

Required validation commands/checks if available:
- `pnpm lint`
- `pnpm build`
- `pnpm test`
- `pnpm test:security:secrets`
- `pnpm verify:london-time`
- `pnpm cf:build`
- `git diff --check`
- Supabase migration status
- Supabase security advisor

Do not expose `.env` secret values. You may read `.env.example`.

Deliverables:
- Link to the GitHub issue you created.
- Skills/capabilities used, limited to 3 or 4, with a short reason for each.
- Architecture map:
  - frontend routes
  - admin routes
  - admin shell/navigation and shared admin UI primitives
  - API/server action boundaries
  - Supabase client usage
  - database entity map
  - email/Resend flow
  - Sentry/Cloudflare/deployment flow
- Documentation freshness assessment, especially `README.md` versus current admin/CRM implementation.
- Test and script inventory, including unit/integration tests, Playwright E2E tests, E2E setup/cleanup scripts, owner bootstrap, London-time verification, browser secret scan, and Cloudflare build/deploy scripts.
- Data-flow diagrams in text form for:
  - public booking
  - slot calculation
  - booking creation
  - customer manage link
  - admin booking management
  - manual booking creation
  - manual client creation
  - assignment claiming
  - client CRM
  - dashboard metrics
  - reports and CSV export
  - enquiries
  - email notifications
  - email delivery events
  - operational events
  - privacy operations
  - audit logs
- Business-fit gap list.
- Business-essential missing-items checklist with must-have, should-have, and polish priority.
- Security and RLS risk list.
- Backend correctness and hardening improvement list.
- Customer lifecycle architecture findings, including booking request, admin response, confirmation, cancellation/rescheduling, email, repeat bookings, multi-person bookings, and gender-aware availability.
- Admin/staff frontend architecture findings, including layout, spacing, alignment, responsiveness, accessibility, state handling, visual polish, component consistency, and use of the chosen stack.
- Admin/staff design improvement opportunities focused on look, feel, polish, responsiveness, workflow convenience, and perceived quality.
- Admin experience architecture findings, including login, navigation, management workflows, CRM clarity, reports, revenue/client tracking, role-specific operations, and daily operations.
- Role/persona architecture findings, including owner/super-admin, admin/manager, therapist, restricted, inactive, and `can_take_bookings = false` boundaries.
- Right-sized CRM/admin benchmark architecture findings, including where Rahma Therapy meets, partially meets, misses, or should intentionally avoid common CRM/practice-management patterns.
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
- Leave defect/finding issues open after creation unless the user explicitly asks to close them or the issue is confirmed duplicate or invalid.
```

## 6. Phase 2 Standalone Prompt: Live Admin Frontend, Staff Workflow, Customer Lifecycle, Security, And Visual Audit

Copy this prompt into ChatGPT 5.5 as a standalone request.

```md
You are ChatGPT 5.5 acting as a senior QA automation engineer, frontend design auditor, admin CRM product tester, accessibility reviewer, business workflow auditor, and security regression tester.

I need you to perform Phase 2 of a three-phase audit for the Rahma Therapy project. This phase is live browser testing through the production site, admin UI, staff UI, customer lifecycle workflow, Supabase, Chrome DevTools MCP, and Playwright/browser tooling.

The live production site is:

`https://rahmatherapy.uk`

Use `http://localhost:3000` only as a fallback, comparison target, or when temporary audit users/data are required and must not touch production-like live data.

This revised Phase 2 is primarily focused on admin/staff-facing frontend quality, UI, UX, responsiveness, accessibility, visual polish, interaction quality, role-specific workflows, and business operations. Do not perform a broad visual-design audit of public marketing pages such as `/home`, service pages, reviews, about, or FAQs. The customer-facing workflow should still be audited from booking request through admin visibility, admin response, confirmation/cancellation/rescheduling expectations, email side effects, and CRM records.

This is audit-only. Do not fix anything. Do not edit application code, schemas, migrations, configuration, environment files, backend logic, or frontend UI files. Do not add features. Do not refactor. Do not create migrations. You may create or update only the required audit artifact files and GitHub issues. You may create temporary test data only when needed for QA. All test data must be clearly prefixed with `audit_phase2_` and cleaned up before the phase ends.

Before doing anything else, use the GitHub MCP to create a new issue titled:

`Audit Phase 2: Live Admin Frontend, Staff Workflow, Customer Lifecycle, Security, and Visual Review`

Issue body:

## Objective
Exercise the Rahma Therapy live production website, admin/staff CRM, and customer lifecycle workflow end to end, with special emphasis on admin/staff frontend quality, responsive design, accessibility, and business workflow suitability.

## Scope
- Full-stack frontend and backend behavior
- Customer lifecycle behavior from booking request to admin response and confirmation/follow-up
- Multi-person and repeat-customer booking behavior
- Availability and gender-aware slots
- Gender-aware date/time presentation for male and female clients
- Admin login and RBAC
- Admin booking management
- Admin/staff frontend design, layout, spacing, alignment, visual hierarchy, responsive behavior, interaction states, and accessibility
- Admin/staff look-and-feel, visual polish, responsiveness, workflow convenience, and perceived quality improvements
- Admin CRM experience from login through daily operations
- Staff role-specific workflow experience
- Staff assignment claiming
- Client CRM
- Staff/services/settings/availability/roles admin pages
- Admin CMS and any Supabase-backed content-management pages, if present
- Revenue/client tracking and reporting pages, if present
- Dashboard accuracy
- Backend correctness, data integrity, validation, RLS, reporting, email, and operational hardening opportunities
- Essential business capability gaps and production-readiness improvements
- Resend email side effects
- RLS/security runtime checks
- Desktop, tablet, and mobile admin/staff visual audit
- Accessibility basics

## Acceptance Criteria
- Customer booking flows are tested end to end.
- Customer lifecycle from booking request through admin visibility, admin response, confirmation/cancellation/rescheduling expectations, emails, and CRM records is tested or explicitly assessed.
- Multiple bookings by the same customer are tested or explicitly assessed.
- Multi-person participant information capture is tested.
- Gender-aware availability is reviewed from both technical and UX perspectives.
- Admin workflows are tested end to end.
- Owner/super-admin, admin/manager, therapist, restricted, inactive, and `can_take_bookings = false` perspectives are tested where feasible.
- Admin/staff frontend design quality is reviewed across all major admin pages.
- Admin/staff look-and-feel, visual polish, responsiveness, and workflow convenience improvements are identified separately from defects.
- Admin CRM UX is reviewed from login through booking/client/staff/service/settings/reporting management.
- Admin/staff pages are reviewed for spacing, alignment, typography, token usage, component consistency, loading states, empty states, error states, permission states, and action feedback.
- Admin/staff pages are reviewed for professional use of the chosen stack: Next.js App Router, React, shadcn/ui, TypeScript, Tailwind tokens, Framer Motion, React Hook Form, Zod, Zustand, TanStack Query, and Supabase.
- Mixed-gender and single bookings are verified.
- Assignment claiming rules are tested.
- RLS/security checks are attempted.
- Backend correctness and hardening opportunities are identified with evidence.
- Missing essential business capabilities are identified with must-have, should-have, or polish priority.
- Resend email behavior is observed without exposing secrets or private email contents.
- Desktop, tablet, and mobile admin/staff screenshots/evidence are captured where useful.
- High-intensity workflow scenarios are attempted where safe, including rapid booking requests, repeat customers, mixed groups, larger admin lists, role-specific dashboards, and assignment/status changes.
- The admin CRM is benchmarked against right-sized small-business CRM and appointment/practice-management expectations, with enterprise overbuild explicitly avoided.
- Findings are documented with severity and reproduction notes.
- Findings files are created under `implementation-plans/audit-review-findings/phase-2-e2e-admin-booking-ux/` using the approved filenames and capped at five files.
- No fixes or feature work are performed.

After creating the issue, select and use 3 or 4 relevant skills/capabilities before beginning the audit. For Phase 2, use skills/capabilities covering browser automation, frontend/UI/UX design audit, accessibility review, and security/RLS/runtime QA. List the selected skills and why they were used in the deliverables.

After selecting the skills, begin the audit.

Project context:
- Rahma Therapy is a UK mobile therapy business.
- The live site is `https://rahmatherapy.uk`.
- Local fallback may be available at `http://localhost:3000`.
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
- Use the owner account email `rahmatherapy@outlook.com` for owner/super-admin perspective testing when the password is supplied securely in the active audit session.
- Do not write, screenshot, log, or publish the owner password.
- Do not change real owner account settings, role assignments, password, email, MFA state, or permissions.
- Create temporary lower-privilege audit personas through Supabase MCP or the UI as needed, using names/emails clearly prefixed with `audit_phase2_`.
- If a real admin account cannot be created through the UI, use Supabase MCP to provision a temporary audit admin only if needed, then clean it up.
- If a workflow is impossible because the UI has no path for it, document that as a finding rather than inventing a workaround silently.
- If email sending is tested, use safe test recipients and record whether Resend accepted the send. Do not publish email contents containing private data.
- Do not seed high-volume data on live production unless all records are clearly isolated, reversible, and safe to clean. Prefer localhost, a Supabase branch/test project, or a controlled small sample on production.
- Never update, cancel, delete, reassign, or alter real customer bookings, real staff profiles, real services, real roles, or real settings. All mutation tests must use `audit_phase2_` records only.
- Confirm no passwords, auth tokens, magic links, API keys, cookies, or private email contents are captured in findings, screenshots, console logs, or GitHub issues.

Production versus controlled test-data modes:

- Production observation mode may use the live site for owner login, visual audit, role/read-only review, screenshots, console/network checks, route protection checks, and non-destructive workflow observation.
- Controlled test-data mode must be used for mutation-heavy or high-intensity checks, including temporary role creation, service changes, setting changes, rapid booking submissions, booking status changes, assignment changes, and larger-volume list testing.
- Controlled test-data mode should use localhost, a Supabase branch/test project, or a tightly isolated set of reversible `audit_phase2_` production records only when that is clearly safe.
- If the safer controlled environment is unavailable, document the affected checks as blocked rather than performing risky live-production mutations.

Required tools:
- Chrome DevTools MCP for browser inspection, console logs, network requests, screenshots, and viewport changes.
- Playwright/browser tooling for repeatable browser actions where useful.
- Supabase MCP for database verification, temporary data setup, RLS tests, and cleanup.
- GitHub MCP for issue creation and finding issues.
- Existing local E2E setup/cleanup scripts where safe: `pnpm test:e2e:setup` and `pnpm test:e2e:cleanup`.
- Existing E2E and security checks where useful: `pnpm test:e2e`, `pnpm test:security:secrets`, and `pnpm verify:london-time`.

Pre-test setup:
1. Confirm the live site is reachable at `https://rahmatherapy.uk`.
2. If needed, confirm the local fallback is reachable at `http://localhost:3000`.
3. Confirm baseline routes load on the chosen target:
   - `/`
   - `/home/`
   - `/services/`
   - `/about/`
   - `/reviews/`
   - `/faqs-aftercare/`
   - `/admin/login/`
   - `/booking/manage/` with no token, to verify invalid-link behavior
4. Check browser console and network errors on admin pages and minimal customer lifecycle touchpoints.
5. Record current Supabase migration/security status if accessible.
6. Record whether admin/staff testing is performed on live production, localhost, or both, and why.
7. Establish the audit persona matrix:
   - owner/super-admin using the real owner account email if secure credentials are available
   - temporary admin/manager
   - temporary male therapist
   - temporary female therapist
   - temporary restricted staff member
   - temporary inactive staff member
   - temporary staff member with `can_take_bookings = false`
   - no-login customer booking persona
8. For each temporary persona, record creation method, assigned role/permissions, expected access, tested access, and cleanup status.

Customer-side E2E tests:
1. Public site browsing
- Do not perform a broad frontend visual-design audit of homepage, services, package detail pages, about, reviews, or FAQs/aftercare.
- Smoke-check only the public pages needed to understand the customer lifecycle and routes into booking.
- Check whether calls-to-action lead to booking.
- Check whether content is appropriate for a UK mobile therapy business.
- Look for missing trust/safety information, unclear service-area information, weak contraindication language, weak aftercare guidance, missing cancellation expectations, or confusing payment expectations.
- Treat any public-page findings as customer lifecycle/business-fit findings, not public marketing visual redesign findings.

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
- Evaluate the customer lifecycle outcome: whether the request reaches admin clearly, whether the customer gets appropriate confirmation/follow-up, whether payment/cancellation/rescheduling expectations are visible, and whether the CRM gives staff enough context to respond.
- Do not treat booking page visual redesign as the primary scope unless a booking UI problem blocks the customer lifecycle.

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
- Booking page visual redesign is out of scope. Booking-page usability, data correctness, gender-aware availability clarity, and lifecycle completion are in scope.

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
0. Role/persona coverage
- Audit the admin/staff CRM from the owner/super-admin perspective, including full navigation, dashboard, bookings, clients, staff, services, availability, settings, roles, reporting/revenue/client tracking, and CMS/content-management routes where present.
- Include implemented owner/admin surfaces discovered in the current codebase: dashboard, bookings, manual booking creation, calendar, reports/export, clients, manual client creation, enquiries, staff, staff availability, services, global availability, roles, audit log, privacy operations, email status/manual reminder, operational errors, settings, login, signout, and command search.
- Audit from admin/manager perspective and verify the role can complete daily operations appropriate to that role without owner-only controls.
- Audit from male therapist and female therapist perspectives and verify each can see and act on only appropriate assignments, bookings, client context, notes, and workload information.
- Audit from restricted staff perspective and verify restricted routes, actions, and sensitive notes are hidden or blocked.
- Audit from inactive staff perspective and verify login/admin access, availability, and assignment claiming are blocked.
- Audit from `can_take_bookings = false` staff perspective and verify admin access, availability visibility, and claim behavior match the intended business rules.
- For every role, inspect sidebar/navigation, direct URL access, server responses, empty states, denied states, dashboard visibility, mobile layout, and action availability.

1. Admin authentication and route protection
- Verify unauthenticated `/admin/*` access redirects or is blocked.
- Log in as an audit admin.
- Verify inactive users cannot access admin.
- Verify a restricted therapist cannot access `/admin/settings`, roles management, or other unauthorized pages.
- Verify the admin sidebar only shows allowed routes.
- Review login UX, failed login states, redirect behavior, signout behavior, and whether admins understand where they are after login.
- Review login and shell design for visual quality, spacing, alignment, responsive behavior, focus states, loading/error states, and clarity.

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
- Review booking list/detail visual design, layout density, hierarchy, mobile usability, action placement, status badges, filters, empty/loading/error states, and role-specific clarity.

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
- Review client list/detail visual design, search/filter UX, mobile usability, client history layout, repeat-customer clarity, and sensitive note presentation.

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
- Review dashboard visual hierarchy, card density, chart/report affordances if present, operational usefulness, mobile layout, and whether it helps daily business workflow.

10. Extended admin operations surfaces
- Audit `/admin/calendar` for daily/weekly operational usefulness, print behavior, responsive layout, own-versus-all booking visibility, and whether staff can quickly understand their schedule.
- Audit `/admin/reports` and `/admin/reports/export` for metric correctness, role-scoped revenue/client visibility, filter behavior, CSV content safety, and alignment with `docs/production/reporting-metric-definitions.md`.
- Audit `/admin/enquiries` for lead/customer workflow, status updates, conversion path into clients/bookings, source tracking, search/filter needs, and mobile usability.
- Audit `/admin/emails` for delivery status clarity, manual reminder behavior, safe error display, private content avoidance, and role gating.
- Audit `/admin/operations` for operational event triage, severity/status clarity, safe-context display, and resolution workflow.
- Audit `/admin/audit` for safe before/after summaries, sensitive-field redaction, actor attribution, search/filter needs, and role gating.
- Audit `/admin/privacy` for customer data export/correction/deletion/anonymization review workflows, audit logging, role gating, and GDPR/privacy readiness.
- Audit manual creation flows at `/admin/bookings/new` and `/admin/clients/new` for validation, duplicate/repeat-client behavior, role permissions, address/service capture, and mobile form usability.
- Audit `AdminCommandSearch` for discoverability, keyboard interaction, permission-scoped results, mobile behavior, and whether it speeds up daily operations.

11. Admin/staff frontend design system audit
- Review every admin/staff-facing route for:
  - consistent page headers and action placement
  - spacing rhythm
  - alignment
  - typography scale
  - color/token consistency
  - shadcn/ui component consistency
  - button hierarchy
  - form control sizing and labels
  - table/list/card usability
  - status badge clarity
  - loading states
  - empty states
  - error states
  - success states
  - permission-limited states
  - keyboard navigation
  - visible focus states
  - responsive layout at 1440px, 768px, and 390px
  - whether the admin UI feels modern, polished, calm, and suitable for a clinical mobile therapy operation
- Identify improvements that refine and enhance the current UI without requiring a full rebuild or direction change.
- For every major admin/staff page, explicitly answer:
  - What looks or feels less polished than a modern professional CRM?
  - What spacing, alignment, density, typography, or hierarchy should be improved?
  - What interaction states are missing or weak?
  - What would make this page faster or easier for an owner, manager, therapist, or coordinator to use repeatedly?
  - What would make the page feel more clearly Rahma Therapy rather than a generic admin screen?

12. High-intensity production-readiness workflow scenarios
- Run high-intensity checks only where safe and reversible. Prefer localhost, a Supabase branch/test project, or a tightly controlled set of `audit_phase2_` records on production.
- Create or inspect enough `audit_phase2_` bookings, clients, participants, assignments, and services to test high-data UI behavior without polluting real data.
- Test rapid sequential booking submissions and, if tooling permits, controlled parallel booking attempts against the same slot to look for double-booking, stale availability, email failure coupling, and race-condition symptoms.
- Test many repeat bookings for the same customer details and verify client deduplication/history, participant-specific data, health notes, addresses, consent, and service snapshots remain attached to the correct booking.
- Test several mixed-gender group bookings with different participant counts and service combinations to verify simultaneous availability, assignment creation, UI clarity, and admin workload display.
- Test changing audit booking status, payment status, assignment status, notes, and cancellation/rescheduling-related fields where the UI supports it.
- Test admin list performance and usability with larger-than-normal result sets, including pagination, filtering, search, sorting, status badges, bulk perception, mobile overflow, and empty/error recovery.
- Test staff workload and dashboard/reporting views under multiple active, unassigned, partially assigned, completed, cancelled, and paid/unpaid audit bookings.
- Document whether the system appears ready for realistic spikes such as several customers requesting bookings in a short period, several staff claiming work, and admins managing multiple open bookings at once.
- If a scenario cannot safely be tested on live production, mark it blocked with the safer environment needed to complete it.

13. Right-sized CRM/admin industry benchmark comparison
- Research current small-business CRM and appointment/practice-management expectations during the audit and cite sources in findings.
- Compare Rahma Therapy's admin/CRM experience against right-sized patterns from monday.com-style CRM tools, Cliniko-style practice-management tools, Fresha-style local appointment-business tools, and general small-business CRM norms.
- Benchmark only features that matter to Rahma Therapy's business model. Do not recommend enterprise sales-pipeline complexity unless it directly supports booking, client, staff, or revenue operations.
- Rate each benchmark area as `meets`, `partial`, `missing`, `overbuilt risk`, or `not relevant`.
- Include benchmark areas such as:
  - operational dashboard and daily work queue
  - calendar/agenda view
  - booking lifecycle management
  - client profiles, notes, history, and repeat-client context
  - manual client creation and correction workflow
  - staff workload, claiming, and performance visibility
  - role-scoped dashboard/reporting visibility
  - revenue, client, booking, service, and staff reports
  - export/download of filtered historical data
  - search, filters, saved views, and table density
  - reminders, notifications, and admin follow-up workflow
  - mobile admin usability
  - visual polish, consistency, accessibility, and interaction feedback
- For each gap, state whether it is a production must-have, near-term improvement, polish item, or intentionally out of scope for a small local business.

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
- Check every major admin/staff-facing page:
  - dashboard
  - bookings list/detail
  - manual booking creation
  - calendar
  - reports and CSV export
  - clients list/detail
  - manual client creation
  - enquiries
  - staff list/detail/availability
  - services
  - settings
  - availability
  - roles list/detail
  - audit log
  - privacy operations
  - email status/manual reminder
  - operational errors
  - command search
  - reporting/revenue/client tracking pages, if present
  - admin CMS/content management pages, if present
  - customer manage/cancellation/rescheduling admin-linked pages, if present
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
  - spacing and alignment consistency
  - visual hierarchy
  - action clarity
  - role-specific UI clarity
  - brand consistency with warm clinical Rahma Therapy style
  - modern, polished, responsive admin/staff experience

Business-specific missing-items audit:
- Does the site clearly explain service areas?
- Does it set expectations for mobile arrival, parking/access notes, preparation, and aftercare?
- Does it explain payment timing and methods?
- Does it explain cancellation/rescheduling policy?
- Does it collect enough safety/consent information without becoming a full medical intake?
- Does it protect health notes and sensitive client data?
- Does it give admins enough operational visibility to run the business daily?
- Do admin/staff pages support realistic day-to-day workflow without awkward navigation, cramped layouts, or raw-database thinking?
- Do admin/staff pages look and feel modern, polished, responsive, and professionally designed?
- Are workflows clear for owners/admins, therapists, and restricted roles?
- Does the email system cover customer confirmation, admin notification, cancellation, and reminders?
- Does the customer lifecycle build trust from booking request through admin response and confirmation?
- Does the booking flow make gender matching feel clear and respectful rather than awkward?
- Does the booking flow handle a customer booking for themselves, for someone else, and for several people?
- Does the booking flow support repeat customers making multiple bookings without data confusion?
- Does the admin CRM give a complete operational picture from login through client, staff, service, booking, and payment management?
- What essential admin, staff, client, booking, reporting, privacy, email, or operational workflow is missing or too weak for production trust?
- What backend safeguards, tests, reports, exports, or operational alerts would make the system more reliable and complete?
- What UI/UX improvements would most improve perceived quality, confidence, and daily usability without changing the product direction?

Deliverables:
- Link to the GitHub issue you created.
- Skills/capabilities used, limited to 3 or 4, with a short reason for each.
- Browser routes tested.
- Admin workflows tested.
- Extended admin surfaces tested, including calendar, reports/export, enquiries, audit, privacy, emails, operations, manual booking, manual client creation, and command search where accessible.
- Role/persona matrix tested, including owner/super-admin, admin/manager, therapists, restricted staff, inactive staff, and `can_take_bookings = false` staff where feasible.
- Supabase records created and cleanup confirmation.
- High-intensity scenario summary, including what was tested on live production, localhost, or blocked for safety.
- Right-sized CRM/admin benchmark comparison summary with source links where current research was used.
- Credential and secret redaction confirmation.
- Screenshots/evidence summary.
- Console/network issue summary.
- E2E test matrix with pass/fail/blocked.
- Security/RLS test matrix with pass/fail/blocked.
- Mobile/accessibility findings.
- Business-fit findings.
- Design/look-and-feel improvement opportunities, grouped by admin page and role.
- Backend correctness and hardening improvement opportunities.
- Missing essential business capability checklist, grouped as must-have, should-have, and polish.
- Admin/staff frontend findings focused on design quality, UI polish, spacing, alignment, responsiveness, accessibility, interaction states, component consistency, and stack usage.
- Customer-lifecycle findings focused on booking request, admin visibility, response, confirmation, cancellation/rescheduling, email side effects, repeat bookings, multi-person data, and gender-aware availability.
- Admin-experience findings focused on login, navigation, management workflows, CRM clarity, role-specific workflow, reporting/revenue/client tracking, and day-to-day operations.
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
- Leave defect/finding issues open after creation unless the user explicitly asks to close them or the issue is confirmed duplicate or invalid.
- Explicitly confirm no fixes were made.
```

## 7. Phase 3 Standalone Prompt: Findings Triage, Gap Analysis, Production Readiness, And Remediation Roadmap

Copy this prompt into ChatGPT 5.5 as a standalone request.

```md
You are ChatGPT 5.5 acting as a principal engineer, QA lead, product owner, security reviewer, and launch-readiness reviewer.

I need you to perform Phase 3 of a three-phase audit for the Rahma Therapy project. This phase turns audit evidence into a final findings register, production-readiness assessment, business-gap analysis, and remediation roadmap.

This is audit-only. Do not fix anything. Do not edit application code, schemas, migrations, configuration, environment files, backend logic, or frontend UI files. Do not add features. Do not refactor. Do not create migrations. Do not change Supabase data. You may create or update only the required audit artifact files and GitHub issues. Create GitHub issues for findings, but do not implement fixes.

Before doing anything else, use the GitHub MCP to create a new issue titled:

`Audit Phase 3: Findings Triage, Production Readiness, and Remediation Roadmap`

Issue body:

## Objective
Consolidate architecture, E2E, security, admin/staff frontend, visual, accessibility, business-fit, customer lifecycle, and operational findings into a prioritized launch-readiness report and atomic GitHub issue backlog.

## Scope
- Full-stack frontend/backend findings triage
- Findings triage
- Production readiness
- Security and privacy readiness
- Business operations readiness
- Customer booking readiness
- Customer lifecycle readiness
- Admin/staff frontend readiness
- Admin CRM readiness
- Admin experience readiness
- Email/Resend readiness
- Observability/Sentry readiness
- Deployment/Cloudflare readiness
- Accessibility and mobile readiness
- Remediation roadmap

## Acceptance Criteria
- Findings are deduplicated and severity-ranked.
- Admin/staff frontend, backend, customer lifecycle, and admin CRM findings are categorized separately where useful.
- Confirmed defects have atomic GitHub issues.
- Improvement opportunities are categorized separately from confirmed defects and missing requirements.
- Missing business requirements are documented separately from bugs.
- Missing business essentials are prioritized as must-have, should-have, or polish.
- Right-sized CRM/admin benchmark gaps are documented separately from core defects where they are product improvements rather than bugs.
- Production blockers are clearly identified.
- Booking-experience blockers and admin-experience blockers are explicitly identified.
- Admin/staff frontend design blockers are explicitly identified.
- Admin/staff design/look-and-feel improvement opportunities are explicitly identified.
- Backend correctness and hardening opportunities are explicitly identified.
- Role/persona readiness and high-intensity workflow readiness are explicitly assessed.
- Findings files are created under `implementation-plans/audit-review-findings/phase-3-triage-roadmap/` using the approved filenames and capped at five files.
- Launch readiness is assessed.
- A remediation roadmap is produced.
- No fixes or feature work are performed.

After creating the issue, select and use 3 or 4 relevant skills/capabilities before beginning the Phase 3 audit. For Phase 3, use skills/capabilities covering findings triage, product/launch readiness, security/privacy readiness, and remediation roadmap planning. List the selected skills and why they were used in the deliverables.

After selecting the skills, begin the Phase 3 audit.

Important context:
- Rahma Therapy is a UK mobile therapy business with public booking, Supabase backend, admin CRM, RBAC, staff availability, gender-aware assignment, Resend email notifications, Sentry, and Cloudflare production deployment.
- The live production site is `https://rahmatherapy.uk`.
- The latest implementation, remediation, and production-readiness plan is `implementation-plans/implementation_plan3.md`.
- The original implementation context is in `implementation-plans/IMPLEMENTATION_PLAN.md` and should be treated as secondary to `implementation_plan3.md` when they differ.
- Phase 3 may use findings from prior audit phases if available, but must also be able to run independently by inspecting the current codebase, GitHub issues, Supabase state, and browser state.
- This phase is about organizing truth, not making changes.

Inputs to collect:
- Existing GitHub audit issues and defect issues.
- `implementation-plans/implementation_plan3.md`.
- `implementation-plans/IMPLEMENTATION_PLAN.md` as historical/original context.
- `docs/production-runbook.md`.
- `docs/production/role-matrix.md`.
- `docs/production/reporting-metric-definitions.md`.
- `docs/production/privacy-data-retention.md`.
- `docs/production/phase9-rls-privacy-verification.md`.
- `docs/production/phase10-test-setup.md`.
- `README.md`, with any stale admin/CMS statements treated as documentation findings rather than authoritative current behavior.
- Current Git status and uncommitted file list.
- Current package scripts and dependency list.
- Current unit/integration/E2E test inventory.
- Supabase migration status.
- Supabase security advisor.
- RLS/grants/policies summary.
- Key admin/public routes.
- Browser smoke evidence from `https://rahmatherapy.uk` if needed.
- Admin/staff responsive screenshots/evidence if available.
- Owner/super-admin, admin/manager, therapist, restricted, inactive, and `can_take_bookings = false` role/persona evidence from prior phases if available.
- High-intensity workflow evidence from prior phases if available, including booking spikes, larger list volumes, repeat customer behavior, mixed-gender group behavior, and assignment/status-change behavior.
- Current industry benchmark references for right-sized CRM/admin, appointment-management, practice-management, reporting, permissions, and mobile workflow expectations.
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
- Calendar, reports/export, enquiries, emails, audit logs, privacy operations, operational events, manual booking creation, and manual client creation
- Dashboard metrics
- Email side effects
- High-intensity booking/admin scenarios, including repeat bookings, grouped bookings, rapid requests, larger lists, and concurrent or near-concurrent assignment/booking operations where evidence exists
- Backend correctness improvement opportunities, including validation, transactions, idempotency, concurrency, error handling, tests, and data consistency

2. Security and privacy
- RLS policies
- Service-role boundaries
- Auth guards
- Admin route protection
- RBAC enforcement
- Inactive staff lockout
- Owner/Super Admin lockout protections
- Role-scoped owner/admin/therapist/restricted/inactive/no-bookings access boundaries
- Sensitive client and health notes protection
- Public API leakage
- Browser bundle secret leakage
- Audit logs for sensitive changes
- GDPR/privacy-readiness concerns
- Security and privacy hardening opportunities that reduce risk even when no exploit is confirmed

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
- Operational events and email delivery status workflows
- Privacy request and audit-log workflows
- Repeat client tracking
- Multi-person booking operations
- Admin daily workflow from login to management completion
- Owner-level universal business visibility versus role-scoped lower-level visibility
- Manual client creation and client correction workflow
- Historical revenue/client/report export workflow
- Clinical safety, consent, notes, and aftercare expectations
- Email deliverability and sender identity
- Right-sized CRM/admin benchmark gaps that materially affect daily business operations
- Missing business essentials and operational conveniences that would make the system more complete for a small mobile therapy business

4. UX, accessibility, and visual quality
- Admin/staff brand consistency with Rahma Therapy warm clinical visual language
- Admin/staff design quality, visual hierarchy, spacing, alignment, typography, token usage, and component consistency
- Admin/staff interaction quality, feedback states, loading states, empty states, error states, success states, and permission-limited states
- Admin/staff responsive quality at desktop, tablet, and mobile widths
- Admin/staff accessibility basics: semantic structure, labels, focus states, keyboard navigation, contrast, and form usability
- Customer lifecycle trust and clarity from booking request through admin response, confirmation, cancellation/rescheduling expectations, and email follow-up
- Gender-aware availability behavior as part of customer lifecycle correctness
- Admin mobile usability
- Admin login, navigation, CRM management, booking management, staff/service/settings workflows, and dashboard usability
- Calendar, reports/export, enquiries, emails, audit, privacy, operations, command search, manual booking, and manual client UX
- Tables/detail pages on small screens
- Form labels
- Focus states
- Keyboard navigation
- Contrast/readability
- Error, empty, loading, success, and permission-limited states
- Role-specific dashboard, reporting, client, booking, and staff workflow clarity
- High-data-volume admin list, table, chart, and mobile usability
- Right-sized benchmark comparison against small-business CRM and appointment/practice-management UI patterns
- Design/look-and-feel improvements that would make the admin CRM more beautiful, modern, responsive, polished, and efficient without changing the product direction

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
- Classify each item as `confirmed defect`, `missing essential`, `improvement opportunity`, `security/privacy risk`, or `benchmark gap`.
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
- `pnpm test`
- `pnpm test:e2e`
- `pnpm test:security:secrets`
- `pnpm verify:london-time`
- `pnpm cf:build`
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
- Admin/staff frontend is modern, polished, responsive, accessible, and usable for daily operations.
- Owner/super-admin can see whole-business state while lower roles only see appropriate scoped dashboards, bookings, clients, revenue/client metrics, and staff workload data.
- Admin CRM remains usable under realistic operational volume, including multiple open bookings, repeat clients, group bookings, and several staff assignments.
- Required CRM/admin benchmark gaps are either resolved, deliberately deferred, or documented as non-applicable for a small local business.
- Customer lifecycle from booking request through admin response and confirmation/follow-up is clear and trust-building.
- Health/consent data is collected and protected appropriately.
- Test data is cleaned up.

Deliverables:
- Link to the GitHub issue you created.
- Skills/capabilities used, limited to 3 or 4, with a short reason for each.
- Executive summary.
- Launch readiness verdict:
  - Ready
  - Ready with non-blocking issues
  - Not ready
  - Blocked
- Architecture confidence summary.
- Findings register grouped by severity and category.
- Improvement opportunities register grouped by admin design/look-and-feel, backend hardening, business completeness, workflow convenience, and polish.
- GitHub issue backlog table:
  - issue link
  - title
  - severity
  - category
  - affected area
  - recommended order
- Missing business requirements list.
- Missing business essentials checklist grouped as must-have, should-have, and polish.
- Assessment of current system against `implementation-plans/implementation_plan3.md`, with deviations marked as implemented, partial, missing, superseded, or not applicable.
- Security/privacy readiness assessment.
- Backend correctness and hardening readiness assessment.
- CRM/admin operations readiness assessment.
- Operational visibility readiness assessment, including operational events, email delivery events, audit logs, privacy operations, and admin command search.
- Customer booking readiness assessment.
- Customer lifecycle readiness assessment, including booking request, admin visibility, admin response, confirmation/cancellation/rescheduling, emails, repeat bookings, participant data, and gender-aware date/time availability.
- Admin/staff frontend readiness assessment, including design quality, UI polish, spacing, alignment, visual hierarchy, responsiveness, accessibility, state handling, and use of the chosen frontend stack.
- Admin/staff look-and-feel improvement assessment, including page-level polish, perceived quality, workflow speed, responsiveness, interaction feedback, and brand fit.
- Admin experience readiness assessment, including login, navigation, CRM operations, booking lifecycle management, staff/service/settings management, revenue/client tracking, reporting, dashboard usability, and daily business workflow.
- Role/persona readiness assessment, including owner/super-admin, admin/manager, therapist, restricted staff, inactive staff, and `can_take_bookings = false` staff.
- High-intensity workflow readiness assessment, including booking spikes, repeat-client volume, group bookings, assignment claiming, admin list/table usability, dashboard/reporting accuracy, and safe handling of larger operational datasets.
- Right-sized CRM/admin industry benchmark table:
  - benchmark area
  - source/reference
  - current Rahma Therapy state
  - benchmark expectation
  - production relevance
  - recommendation
  - severity
  - recommended GitHub issue title
- Email/Resend readiness assessment.
- Sentry/observability readiness assessment.
- Cloudflare/deployment readiness assessment.
- Accessibility/mobile readiness assessment.
- Data cleanup confirmation, or explicit confirmation that no test data was created.
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
- Leave defect/finding issues open after creation unless the user explicitly asks to close them or the issue is confirmed duplicate or invalid.
```

## 8. Recommended Phase Order

Run the phases in this order:

1. Phase 1: Architecture, Codebase, Database, and Business Fit Audit.
2. Phase 2: Live Admin Frontend, Staff Workflow, Customer Lifecycle, Security, and Visual Audit.
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
