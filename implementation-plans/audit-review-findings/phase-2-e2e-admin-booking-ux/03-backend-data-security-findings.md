# Phase 2 Backend, Data, and Security Findings

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/96

## Supabase Status

Migration status was available through Supabase MCP. The latest applied migration reported was:

- `20260504052757_phase10_inactive_staff_self_profile_rls`

Supabase Security Advisor reported one warning:

- `auth_leaked_password_protection`: leaked-password protection is disabled.

Follow-up issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/100

## Runtime RLS and Grants Checks

Sensitive public tables checked:

- `bookings`
- `clients`
- `booking_participants`
- `booking_items`
- `booking_assignments`
- `staff_profiles`
- `email_delivery_events`

Results:

- RLS is enabled on all checked tables.
- `anon` has no SELECT grants on the checked sensitive tables.
- `anon` has no INSERT grants on the checked sensitive tables.
- `authenticated` has no direct INSERT/UPDATE grants on the checked sensitive booking/client/staff tables.
- Runtime anon raw read attempt against `bookings` failed with `permission denied`, which is expected.
- Runtime anon insert attempt against `clients` failed with `permission denied`, which is expected.
- Runtime authenticated direct insert attempt against `clients` failed with `permission denied`, which is expected for server-action-owned writes.

## Public API Checks

Availability API:

- `POST /api/availability`
- Returned date, slots, duration, required staff by gender, and available staff counts by gender.
- Did not expose staff IDs, names, auth user IDs, or assignment identities.

Booking API:

- `POST /api/bookings`
- Created normalized audit bookings with client, booking, participant, item, assignment, manage-link, and email side effects.
- Validation errors returned generic error messages and field error summaries without secret leakage.

## Email Side Effects

For audit bookings:

- Admin booking notification events were created with `delivery_status = accepted`.
- Customer booking confirmation events were created with `delivery_status = accepted`.
- Provider message IDs existed, but private message contents and tokens were not copied into audit artifacts.

## Validation Commands

| Check | Result | Notes |
|---|---|---|
| `pnpm test:security:secrets` | Passed | Browser secret scan passed across `.next/static`, `.open-next/assets`, and `public`. |
| `pnpm verify:london-time` | Passed | Europe/London GMT and BST checks passed. |
| `git diff --check` | Passed | No whitespace errors. |
| `pnpm lint` | Passed | ESLint completed successfully. |
| `pnpm test` | Passed after sandbox rerun | First run hit Windows sandbox `spawn EPERM`; rerun outside sandbox passed 9 files / 30 tests. |
| `pnpm test:e2e` | Blocked for Phase 2 live audit | Existing E2E setup uses non-`audit_phase2_` data patterns, so it was not run against production-like live data. |
| Chrome DevTools MCP | Passed in completion pass | DevTools created isolated live contexts, loaded public/admin routes, captured snapshots, and provided console/network summaries. |

## Security Findings

| Severity | Title | Reproduction | Expected | Actual | Evidence | Affected Area | Follow-up Issue |
|---|---|---|---|---|---|---|---|
| Medium | Supabase leaked-password protection disabled | Run Supabase Security Advisor | Auth hardening rejects known compromised passwords | Advisor reports leaked-password protection disabled | Supabase advisor warning `auth_leaked_password_protection` | Supabase Auth | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/100 |

## Backend Hardening Opportunities

- Review whether public availability responses should include exact staff capacity counts by gender or only slot availability.
- Add a controlled concurrent booking/assignment test in a non-production branch to prove double-booking and claim-race behavior under load.
- Keep email failures decoupled from booking creation; Phase 2 saw accepted sends, but dashboard showed historical failed email/operation events requiring operational triage.
- Document production auth hardening settings alongside RLS/privacy verification.

No backend code, schema, migration, or configuration fixes were made.

## Completion Pass Addendum

Status: previously blocked runtime checks were completed where safe.

- Supabase migration status remained available; latest migration was still `20260504052757_phase10_inactive_staff_self_profile_rls`.
- Supabase Security Advisor still reported only `auth_leaked_password_protection`.
- Sensitive table grant matrix confirmed no anon select/insert and no authenticated direct insert/update grants for `bookings`, `clients`, `booking_participants`, `booking_items`, `booking_assignments`, and `staff_profiles`.
- Direct anon and authenticated insert attempts into `clients` failed with `permission denied`.
- Controlled parallel booking test produced two accepted and two rejected requests for the same slot. This provides live evidence that the booking API rejects some stale-capacity attempts, but a fuller race-condition proof still belongs in a non-production branch where larger-volume and parallel assignment-claim tests can run safely.
- Browser network summaries showed admin routes and Sentry monitoring requests returning successfully; no service-role, Resend, password, manage-token, or API key values were copied into findings.
- All completion-pass `audit_phase2_` auth users, staff profiles, roles, clients, bookings, participants, items, assignments, services, privacy requests, notes, email events, operational events, and audit-log traces were cleaned up and verified at zero.

No backend code, schema, migration, or configuration fixes were made.
