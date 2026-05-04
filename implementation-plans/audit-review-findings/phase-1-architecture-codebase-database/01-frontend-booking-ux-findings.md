# Phase 1 Frontend, Booking, And Customer Lifecycle Architecture Findings

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/84

## Scope

Phase 1 was a read-only architecture audit. No frontend UI was visually redesigned and no application code was changed.

## Skills Used

| Skill | Why it was used |
| --- | --- |
| `architecture` | Mapped frontend routes, admin shell structure, API boundaries, and deployment shape. |
| `database-design` | Reviewed how booking, participant, assignment, client, and settings data are represented. |
| `codex-security:threat-model` | Identified trust boundaries around public booking, service-role flows, RLS, tokens, and sensitive notes. |
| `agile-product-owner` | Classified business-fit gaps and right-sized CRM expectations without enterprise overbuild. |

## Frontend Route Map

Public routes:

- `/`, `/home`, `/services`, `/services/[slug]`, `/about`, `/reviews`, `/faqs-aftercare`
- Public booking is mounted through `src/features/booking/BookingExperience.tsx` and public booking components.

Customer lifecycle routes:

- `/api/availability`
- `/api/bookings`
- `/booking/manage`

Admin/staff routes:

- `/admin`, `/admin/login`, `/admin/signout`
- `/admin/dashboard`
- `/admin/bookings`, `/admin/bookings/[bookingId]`, `/admin/bookings/new`
- `/admin/calendar`
- `/admin/clients`, `/admin/clients/[clientId]`, `/admin/clients/new`
- `/admin/enquiries`
- `/admin/staff`, `/admin/staff/[staffId]`, `/admin/staff/[staffId]/availability`
- `/admin/services`, `/admin/availability`, `/admin/settings`
- `/admin/roles`, `/admin/roles/[roleId]`
- `/admin/reports`, `/admin/reports/export`
- `/admin/audit`, `/admin/privacy`, `/admin/emails`, `/admin/operations`

## Architecture Summary

The public booking architecture is connected to the live backend. `src/app/api/bookings/route.ts` validates the booking request, calls the shared `createBookingTransaction`, creates a manage URL, and sends Resend emails after booking creation. Email failures are caught and do not block the booking response.

Availability is live and backend-driven through `src/app/api/availability/route.ts` and `src/lib/booking/availability.ts`. It considers business settings, allowed cities, active staff, `can_take_bookings`, role/override permissions, global and staff availability, blocked dates, existing bookings, unassigned reservations, buffer time, minimum notice, and gender capacity.

The customer manage route is implemented through `src/app/booking/manage/*` and `src/lib/booking/customer-manage.ts`. It uses hashed manage tokens, expiry checks, cancellation cutoff logic, reschedule request fields, customer notes, audit rows, and email side effects.

## Customer Lifecycle Data Flow

Public booking:

1. Public CTA opens `BookingExperience`.
2. React Hook Form/Zod validates package, participant, location, scheduling, and acknowledgement steps.
3. `/api/availability` calculates real slots from Supabase using the service-role client.
4. `/api/bookings` validates payload again server-side.
5. `createBookingTransaction` calls the `create_booking_request` SQL RPC.
6. RPC creates/updates client data and inserts booking, participants, booking items, and assignments atomically.
7. Manage-token URL is generated and hashed.
8. Customer/admin emails are attempted and delivery events are recorded.
9. Booking response returns submitted status and manage URL.

Customer manage:

1. Customer opens `/booking/manage?token=...`.
2. Token is hashed and matched server-side against unexpired `bookings.manage_token_hash`.
3. Customer can add a note, request cancellation when inside cutoff, or request reschedule.
4. Actions update only the token-linked booking, write audit logs, emit operational events for invalid attempts, and send relevant emails.

## Findings

| Severity | Title | Evidence | Affected area | Why it matters | Issue |
| --- | --- | --- | --- | --- | --- |
| Low | README still describes admin and booking backend as future work | `README.md:72`, `README.md:158`; current routes and build output show implemented admin CRM and backend booking routes | Documentation | New maintainers may misunderstand production reality and make wrong audit/remediation decisions | #85 |
| Low | Deprecated Next.js middleware convention remains | `src/middleware.ts:4`; `pnpm build` and `pnpm cf:build` warn to use `proxy` | Admin route protection/deployment | Not a current runtime blocker, but it is a production-maintenance warning on Next.js 16 | #86 |

## Improvement Opportunities

| Priority | Area | Opportunity | Business value |
| --- | --- | --- | --- |
| Should-have | Booking copy/lifecycle | Phase 2 should verify the live UX makes gender matching feel respectful and operationally necessary. | Reduces customer hesitation and confusion. |
| Should-have | Customer manage route | Phase 2 should verify invalid/expired-token states, reschedule request clarity, and cancellation cutoff copy in browser. | Builds trust after booking submission. |
| Polish | Admin/public route docs | Align README route inventory with current route map and deployment output. | Reduces onboarding friction. |

## Benchmark Notes

Right-sized references used:

- monday.com CRM feature pages emphasize centralized customer communication, dashboards, activity tracking, mobile access, imports, duplicate handling, and automations: https://monday.com/crm/features
- Cliniko emphasizes appointment calendar, mobile-friendly scheduling, treatment notes, appointment change history, online cancellations, recalls, and reports: https://www.cliniko.com/features/ and https://www.cliniko.com/features/appointments/
- Fresha emphasizes calendar, appointments, clients, forms/consent, automated messages, group appointments, team permissions, and sales/client/team reports: https://www.fresha.com/for-business/features

Rahma Therapy should not copy enterprise CRM complexity. The relevant benchmark gap for Phase 1 is documentation and polish around a small-business operational CRM that already has most core surfaces implemented.
