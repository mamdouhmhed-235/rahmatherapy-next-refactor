# Phase 3 Blockers, Final Roadmap, And Follow-Up Issues

## Executive Summary

Rahma Therapy is **blocked for production use**. The codebase builds and lints successfully, RLS posture is materially improved, and Phase 2 proved the core customer/admin workflows can be exercised with temporary staff data. However, real launch is blocked by absent production admin/staff setup, non-atomic booking creation, group pricing mismatch, repeat-client contact/address ambiguity, missing public manage route, mobile admin usability, and Sentry privacy defaults.

## Launch Readiness Verdict

**Blocked**

The system should not be used by real customers or staff until P0 issues are resolved and P1 issues are either fixed or consciously accepted with mitigation.

## Architecture Confidence

Medium. The architecture has a good separation of public booking, server actions/API routes, Supabase-backed admin CRM, RBAC, RLS, availability, and email side effects. Confidence is reduced by booking transaction atomicity, migration drift, missing production bootstrap data, and privacy configuration.

## Production Gate Status

| Gate | Status | Evidence |
| --- | --- | --- |
| Build passes | Pass | `pnpm build` passed |
| Lint passes | Pass | `pnpm lint` passed |
| Whitespace diff check | Pass | `git diff --check` passed |
| No booking data-integrity blocker | Fail | #52 remains open |
| RLS blocks raw sensitive public access | Pass with residual risk | Phase 2 runtime checks passed; Phase 3 advisor clean |
| Admin RBAC and inactive protections | Partial | Code/browser checks show route protection; no real staff data exists |
| Booking creation independent of email success | Pass by prior evidence | Phase 2 booking creation survived email behavior checks |
| Production Resend/site URL ready | Partial | Env keys exist; production sender/domain and manage links need review |
| Dashboard/admin daily use ready | Fail | No real staff profiles and mobile admin issue |
| Public booking UX ready | Fail | Pricing, repeat-customer, manage-link, reset/copy issues |
| Health/consent protected appropriately | Partial | RLS improved; Sentry privacy issue remains |
| Test data cleaned up | Pass | Supabase count returned zero `audit_phase` auth users, clients, bookings |

## Prioritized Backlog

| Order | Issue | Severity | Category | Affected area |
| --- | --- | --- | --- | --- |
| 1 | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/51 | P0 | Admin/operations | Real owner/admin/staff bootstrap |
| 2 | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/52 | P0 | Backend/data | Booking transaction and capacity integrity |
| 3 | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/58 | P1 | Booking UX | Group booking total |
| 4 | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/59 | P1 | CRM/data | Repeat-customer contact/address snapshots |
| 5 | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/65 | P1 | Privacy/observability | Sentry PII and local variables |
| 6 | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/53 | P1 | Customer operations | Missing public manage route |
| 7 | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/60 | P1 | Admin UX | Mobile admin layout |
| 8 | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/54 | P2 | Backend/time | Europe/London date handling |
| 9 | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/55 | P2 | DevOps/data | Migration reproducibility |
| 10 | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/61 | P2 | Booking UX | Stale availability copy |
| 11 | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/62 | P2 | Booking UX | Wizard reset behavior |
| 12 | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/63 | P2 | Admin/RBAC UX | Therapist detail controls |

## Remediation Roadmap

### P0 Before Any Real Use

1. Create a safe production owner/admin/staff bootstrap path.
2. Make booking creation atomic and capacity-safe.

### P1 Before Public Launch

1. Fix group pricing and repeat-client contact/address handling.
2. Implement or suppress customer manage links until manage/cancel/reschedule exists.
3. Harden Sentry privacy defaults and sensitive-field scrubbing.
4. Make admin CRM usable on realistic mobile/tablet widths.

### P2 Before Serious Marketing Or Scale

1. Harden Europe/London date boundaries.
2. Normalize migration history and deployment documentation.
3. Clean up booking copy/reset behavior.
4. Narrow therapist-specific admin controls.
5. Improve service-area, travel, parking/access, cancellation, payment, preparation, and aftercare expectations.

## Data Cleanup Confirmation

Phase 3 did not create admin accounts, bookings, clients, staff profiles, migrations, or production data. Supabase verification returned zero `audit_phase` auth users, clients, and bookings.

## No Fixes Confirmation

No application fixes, feature work, migrations, refactors, or Supabase data changes were performed in Phase 3.
