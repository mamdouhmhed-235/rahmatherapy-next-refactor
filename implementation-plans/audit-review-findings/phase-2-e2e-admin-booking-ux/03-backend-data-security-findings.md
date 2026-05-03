# Phase 2 Backend Data Security Findings

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/57

## Supabase Records Created

Temporary audit records were created with the `audit_phase2_` prefix:

| Type | Count | Notes |
|---|---:|---|
| Auth users/staff profiles | 6 | Owner, admin, male therapist, female therapist, inactive user, no-bookings therapist. |
| Clients | 1 | Repeat-client email used for two bookings. |
| Bookings | 2 | One single male booking, one mixed-gender group booking. |
| Participants | 3 | One male single; group male + female. |
| Booking items | 3 | Hijama snapshots. |
| Assignments | 3 | Male single, group male, group female. |

Cleanup status is recorded in `05-blockers-and-follow-up-issues.md`.

## Security/RLS Matrix

| Check | Result | Evidence |
|---|---:|---|
| Anon REST read `bookings` | Pass | Returned 404/no exposed table access. |
| Anon REST read `clients` | Pass | Returned 404/no exposed table access. |
| Anon REST read `booking_participants` | Pass | Returned 404/no exposed table access. |
| Anon REST read `booking_items` | Pass | Returned 404/no exposed table access. |
| Anon REST read `booking_assignments` | Pass | Returned 404/no exposed table access. |
| Anon REST read `staff_profiles` | Pass | Returned 404/no exposed table access. |
| Anon REST insert `clients` | Pass | Returned 401. |
| Auth owner raw REST read booking | Pass | Returned one authorized row. |
| Auth owner raw REST patch booking | Pass | Returned 403. |
| Browser bundle secret-name scan | Pass | No `SUPABASE_SERVICE_ROLE`, `RESEND_API_KEY`, `SENTRY_AUTH_TOKEN`, or `service_role` string hits in checked JS chunks. |
| Email side effects | Pass with limited observability | Booking API returned 200 for both submissions; email failures, if any, did not break booking creation. Email contents were not inspected. |

## Findings

No high-confidence RLS bypass was confirmed in runtime testing. The main backend/data issue confirmed in Phase 2 is data modeling for repeat booking contact snapshots, documented in files 01 and 02.

## Data Integrity Notes

| Area | Result | Notes |
|---|---:|---|
| Service snapshot | Pass | Booking items stored `Hijama Package` snapshots at `£45.00`. |
| Group total | Pass in backend | DB calculated `£90.00` for two participants. |
| Required therapist gender | Pass | Assignment rows matched participant gender. |
| Assignment statuses | Pass | Unassigned -> partially assigned -> fully assigned transitions were observed. |
| Repeat client linking | Partial | Same email deduplicated to one client, but booking-specific contact details were not preserved. |
