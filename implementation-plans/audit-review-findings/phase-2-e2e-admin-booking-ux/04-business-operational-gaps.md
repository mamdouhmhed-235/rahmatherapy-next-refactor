# Phase 2 Business and Operational Gaps

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/96

## Right-Sized CRM Benchmark

Sources checked during Phase 2:

- monday.com CRM features: https://monday.com/crm/features
- Cliniko features: https://www.cliniko.com/features/
- Cliniko appointments: https://www.cliniko.com/features/appointments/
- Cliniko reporting: https://www.cliniko.com/features/reporting/
- Fresha business features: https://www.fresha.com/for-business/features

Benchmark summary:

| Area | Phase 2 Rating | Notes |
|---|---|---|
| Operational dashboard/work queue | Partial | Dashboard exists and is action-oriented, but role-specific quick links need refinement. |
| Calendar/agenda view | Partial | Calendar route rendered at mobile width without document-level horizontal overflow; deeper own-vs-all and print workflow still needs larger controlled data. |
| Booking lifecycle management | Meets core need / Partial polish | Audit booking lifecycle, payment, amount paid, payment note, treatment note, and admin note persisted. Mobile density and hierarchy still need polish. |
| Client profile/history | Meets core need / Partial polish | Manual client creation, repeat/history display, sensitive note, privacy request, and booking creation from client profile worked. |
| Staff workload/claiming | Partial | Male and female gender-aware claiming worked; larger concurrent claim testing still needs controlled non-production environment. |
| Revenue/reporting/export | Partial | Reports route rendered and CSV export returned valid `text/csv`; full metric reconciliation should still be run against a controlled dataset. |
| Search/filter/table density | Partial | Booking cards are scannable, but mobile filter-heavy pages are dense. |
| Reminders/notifications | Partial | Booking/admin emails were accepted; historical failed email events remain visible in operations. |
| Mobile admin usability | Partial | Shell and dashboard work on mobile; primary action contrast and dense filters need polish. |
| Enterprise sales pipeline | Not relevant | Avoid adding sales-pipeline complexity unless it directly supports bookings, clients, staff, or revenue operations. |

## Must-Have

- Replace visible production placeholder imagery on public booking-entry pages.
- Enable Supabase leaked-password protection for staff/admin auth hardening.
- Keep all customer health notes, participant details, manage links, and email content redacted in audit/public artifacts.
- Run concurrency and high-volume booking/claiming tests in a controlled environment before relying on live-production spike behavior.

## Should-Have

- Permission-scope dashboard quick links and shortcut actions.
- Review availability API response shape so customers see matched slots without unnecessary operational capacity details.
- Add clearer public cancellation/rescheduling policy before booking submission, not only at manage-link acknowledgement time.
- Improve mobile admin filter hierarchy and dense list ergonomics.
- Add a documented production auth/security baseline covering Supabase Auth controls, RLS checks, and advisor status.

## Polish

- Strengthen admin CRM visual identity so it feels less generic and more Rahma Therapy while staying calm and operational.
- Standardize admin page headers, action placement, filter layout, and empty/error/success state presentation.
- Add more refined mobile spacing and contrast for repeated daily use.
- Make booking and client repeat-history affordances more prominent in the CRM.

## Customer Lifecycle Assessment

The tested customer lifecycle works for:

- Single-person booking request.
- Mixed-gender group booking request.
- Repeat customer multiple bookings.
- Admin visibility of audit bookings.
- Email event creation with accepted status.
- Gender-aware availability and assignment creation.
- Manual admin client creation, manual booking creation, booking lifecycle/payment updates, client notes, and privacy requests.
- Report CSV export and command search for audit records.

Lifecycle gaps are mainly operational polish rather than total blockers:

- The live public placeholder imagery undermines trust before booking.
- Cancellation/rescheduling expectations should be easier to discover before submission.
- High-intensity double-booking and concurrent claim behavior should be proven outside live production. The completion pass did run a small controlled parallel same-slot booking check; larger-volume spike behavior remains a non-production test need.

No feature work or fixes were performed.
