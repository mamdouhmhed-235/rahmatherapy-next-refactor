# Phase 1 Business Fit And Operational Gap Review

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/84

## Business-Fit Summary

Rahma Therapy has a credible architecture for a small UK mobile therapy operation. The implemented model supports public booking, in-person payment tracking, mobile service addresses, service-area checks, London time helpers, gender-aware participant/therapist matching, group bookings, repeat client history, admin booking management, assignment claiming, reports, email delivery events, operational events, privacy workflows, and audit logs.

The highest-value remaining work is not more broad feature expansion. It is launch hardening: remove stale docs, clear security/performance advisor findings, verify role/persona behavior live, and validate that the admin CRM remains usable on mobile and under realistic data volume.

## Essential Business Checklist

Must-have before real customer/staff trust:

- Supabase security advisor warning for leaked password protection is resolved or formally accepted as residual risk.
- Admin/staff role behavior is tested in Phase 2 with owner, admin/manager, therapist, restricted, inactive, and no-bookings personas.
- Public booking, customer manage, cancellation, reschedule, emails, and CRM visibility are tested live or in a controlled environment.
- RLS raw-access checks are tested at runtime for anon/authenticated sensitive table access.
- Production owner/admin bootstrap and last-critical-admin safeguards are confirmed on the live project.

Should-have before serious marketing/scale:

- Missing FK indexes from the Supabase performance advisor are reviewed and added where query paths justify them.
- Middleware-to-proxy migration clears the Next.js 16 deprecation warning.
- README and docs are updated to match the implemented admin CRM and backend booking reality.
- High-data-volume admin list/report behavior is tested in Phase 2.
- Repeat customer and manual client dedupe behavior is tested in Phase 2.

Polish:

- Remove or reconcile unused `AdminSidebar`.
- Refine admin design consistency after browser screenshots.
- Consider a small-business follow-up/recall workflow only if real operations require it.

## Operational Risk Register

| Risk | Current architecture | Residual concern |
| --- | --- | --- |
| Duplicate bookings | RPC uses advisory lock and capacity checks. | Needs Phase 2 concurrent/near-concurrent runtime testing. |
| Stale availability | Availability and booking RPC both check staff/settings/capacity. | Need browser tests for edge cases: blocked dates, overrides, minimum notice, BST. |
| Gender assignment mismatch | Participant and assignment gender fields exist; claim checks enforce gender. | Need E2E proof across male, female, and mixed group flows. |
| Inactive staff access | Middleware/layout and RLS helper support inactive blocking. | Need live persona test. |
| Public access to sensitive data | RLS enabled; no broad anon sensitive select policies seen. | Need runtime anon raw-read/write attempts in Phase 2. |
| Admin lockout | Code/docs reference critical-owner safeguards. | Need runtime test or targeted code review of role/staff actions in Phase 2. |
| Email failures | Emails are tracked and failures do not block booking creation. | Need production Resend sender/domain verification. |
| Dashboard/report drift | Reporting module and metric docs exist. | Needs data-based reconciliation in Phase 2/3. |
| Mobile admin overflow | Responsive shell and admin primitives exist. | Needs screenshot/browser audit. |
| Unsupported service area | Frontend and RPC check allowed cities. | Postcode quality remains basic; advanced routing intentionally out of scope. |

## Right-Sized Benchmark Gaps

| Benchmark category | Source/reference | Current Rahma state | Rating | Recommendation |
| --- | --- | --- | --- | --- |
| Dashboard and activity visibility | monday.com CRM dashboards/activity tracking | Dashboard, attention items, operations, email status exist | Partial/meets | Validate operational usefulness under real data volume. |
| Calendar and practitioner schedule | Cliniko appointment calendar and practitioner reports | Calendar exists, staff availability exists | Partial | Browser-test calendar usability and own/all role views. |
| Client history and notes | Cliniko/Fresha client profiles and health records | Client profile/history and notes exist | Partial | Verify sensitive-note access and repeat-client clarity. |
| Forms/consent | Fresha forms and digital consent | Booking captures consent and health notes | Partial | Consider richer forms later only if operationally necessary. |
| Automated messages | Fresha automated messages and reminders | Booking, cancellation, reschedule, staff assignment, reminders/manual email surfaces exist | Partial | Confirm Resend production readiness and manual reminder workflow. |
| Reports | Cliniko/Fresha reporting | Revenue, service, source, staff workload, export routes exist | Partial | Validate against metric definitions and role scopes. |
| Duplicate handling | monday.com duplicate merge expectations | Client source and repeat-client metrics exist | Partial | Phase 2 should test repeat bookings and manual client correction. |
| Enterprise pipelines/lead scoring | monday.com sales pipeline references | Not central to this business | Not relevant/overbuilt risk | Avoid unless enquiries become a larger sales workflow. |

Sources used:

- https://monday.com/crm/features
- https://www.cliniko.com/features/
- https://www.cliniko.com/features/appointments/
- https://www.cliniko.com/features/reporting/
- https://www.fresha.com/for-business/features
