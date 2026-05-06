# Phase 3 Business Operations, CRM Benchmark, And Missing Essentials

Tracking issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/101

## Business Operations Verdict

Business operations readiness verdict: **Ready for controlled owner/admin use, not ready for confident launch/scale until P1 issues and key operational hardening are addressed**.

Rahma Therapy now has a meaningful small-business operating system: public booking, admin CRM, client profiles, manual clients/bookings, staff/service/settings/availability management, reports/export, enquiries, email status, audit log, privacy operations, operational events, command search, RBAC, and assignment claiming. The remaining gaps are not a lack of CRM foundation; they are launch trust, security hardening, accessible admin polish, production-safe E2E/load confidence, and explicit operational policy readiness.

## Missing Business Essentials

### Must-Have Before Confident Public Launch

- Replace visible public placeholder images: #97.
- Resolve or formally accept Supabase leaked-password protection risk: #88.
- Revoke unnecessary public-role non-DML grants on sensitive operational/privacy tables: #102.
- Verify Resend production sender/domain and canonical `NEXT_PUBLIC_SITE_URL` in the deployed environment.
- Run final customer lifecycle smoke: booking request, admin visibility, email event, manage link, cancellation/reschedule request, and cleanup.

### Should-Have Before Serious Marketing Or Scale

- Add a controlled non-production E2E/load-test path: #104.
- Add missing FK indexes and review advisor performance warnings: #89.
- Fix admin accessible labels and low-contrast controls: #98, #105.
- Make restricted dashboard quick links permission-aware: #99.
- Align CSP report-only policy before enforcing production CSP: #103.
- Validate dashboard/report metrics under realistic data volume and role scopes.
- Refresh README and onboarding docs so they match the implemented admin CRM/backend: #85.

### Polish / Operational Backlog

- Replace deprecated middleware convention with proxy: #86.
- Remove/reconcile legacy unused `AdminSidebar`: #87.
- Continue improving admin page density, filter ergonomics, status hierarchy, and Rahma-specific workflow language.
- Add saved views or better default filters only if repeated daily use proves the need.
- Keep enterprise sales-pipeline features out of scope unless they directly support enquiries, bookings, clients, staff, or revenue.

## Right-Sized CRM/Admin Benchmark

Sources used for current benchmark expectations:

- Cliniko feature overview: https://www.cliniko.com/features/
- Fresha for business: https://www.fresha.com/for-business
- monday CRM: https://monday.com/crm
- Supabase RLS performance guidance: https://supabase.com/docs/guides/database/postgres/row-level-security

| Benchmark area | Source/reference | Current Rahma Therapy state | Benchmark expectation | Production relevance | Recommendation | Severity | Issue |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Operational dashboard/work queue | Cliniko/Fresha/monday patterns | Partial. Dashboard and attention-style booking views exist. | Quickly show what needs action today. | High | Improve permission-aware quick links and validate metrics under volume. | P2 | #99, #104 |
| Calendar/agenda | Cliniko/Fresha | Partial. Calendar renders and no mobile overflow in checked viewport. | Daily/weekly schedule should be fast to scan. | High | Improve labels/filter density and verify staff-scoped agenda under data volume. | P2 | #105, #104 |
| Booking lifecycle | Cliniko/Fresha | Meets core need. Status, payment, notes, assignments, manual bookings work. | Manage appointment state, payment, notes, and follow-up. | High | Keep; run final lifecycle smoke before launch. | P1/P2 | #104 |
| Client profiles/history | Cliniko/Fresha/CRM norms | Meets core need. Manual client, notes, privacy request, history worked. | Show client context and repeat history. | High | Add duplicate warnings and correction polish as near-term enhancement. | P2 | Backlog, no new issue needed unless prioritized. |
| Reports/export | monday/Cliniko/Fresha | Partial. CSV export works; metric definitions exist. | Filtered reports and safe exports. | Medium-high | Validate role-scoped metrics and add performance indexes. | P2 | #89, #104 |
| Search and workflow speed | monday CRM | Meets core need. Command search worked for permitted audit records. | Fast global navigation and lookup. | Medium | Continue refining result labels and mobile behavior. | P3 | Backlog polish. |
| Reminders/notifications | Cliniko/Fresha | Partial. Email events/reminders surface exists. | Operational visibility into reminders and failures. | High | Verify sender/domain and CSP/Sentry monitoring path. | P1/P2 | #103 |
| Mobile admin usability | Fresha/modern CRM norms | Partial. Shell works; contrast/labels/density need work. | Repeated mobile workflows must be readable and accessible. | High | Fix contrast and accessible labels before serious staff use. | P2 | #98, #105 |
| Privacy/audit operations | Practice-management expectation | Partial to strong. Privacy and audit surfaces exist. | Sensitive data access must be controlled and traceable. | High | Clean public-role grants and verify final privacy/RLS checks. | P1 | #102 |
| Enterprise sales pipeline | monday CRM | Mostly not applicable. Enquiries cover lightweight leads. | Sales stages only if operationally useful. | Low | Avoid enterprise pipeline overbuild. | Not relevant | None |

## CRM/Admin Operations Readiness

| Area | Assessment |
| --- | --- |
| Daily owner workflow | Partial to strong. Owner can use dashboard, bookings, clients, reports, calendar, command search, and operational surfaces. |
| Staff workload | Partial. Assignment claiming and staff availability work; larger workload dashboards need volume validation. |
| Payment tracking | Meets core need. Payment status/method/amount updates persisted on audit records. |
| Service/catalog management | Meets core need. Audit service create/edit/delete worked. |
| Enquiries/leads | Partial. Surface exists; conversion workflow needs continued business-use validation. |
| Privacy operations | Partial to strong. Request creation and audit visibility exist; least-privilege grants need cleanup. |
| Operational events/email events | Partial. Surfaces exist; Sentry/CSP/email production config needs final readiness check. |

## No-Fix Confirmation

No business workflow, CRM feature, configuration, production data, or Supabase changes were made in Phase 3.
