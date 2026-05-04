# Phase 10 Test Setup

Phase 10 adds automated and E2E checks for launch acceptance. Unit tests run
without live credentials. Playwright E2E checks require a running deployment or
local server plus test users that match the role matrix.

## Commands

- `pnpm test:unit` - run Vitest unit and server-helper tests.
- `pnpm test:e2e` - run Playwright E2E checks.
- `pnpm test:security:secrets` - scan built browser/static output for sensitive
  env key names and exact secret values.
- `node scripts/phase10-e2e-data.mjs setup` - create temporary Phase 10 E2E
  auth users, roles, staff profiles, and a claimable test booking.
- `node scripts/phase10-e2e-data.mjs cleanup` - remove the temporary Phase 10
  E2E records and auth users.

## E2E Environment

Set these variables outside the browser bundle, for example in a local terminal
session or CI secret store:

- `E2E_BASE_URL`
- `E2E_OWNER_EMAIL`
- `E2E_OWNER_PASSWORD`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_COORDINATOR_EMAIL`
- `E2E_COORDINATOR_PASSWORD`
- `E2E_THERAPIST_A_EMAIL`
- `E2E_THERAPIST_A_PASSWORD`
- `E2E_THERAPIST_B_EMAIL`
- `E2E_THERAPIST_B_PASSWORD`
- `E2E_REPORTING_EMAIL`
- `E2E_REPORTING_PASSWORD`
- `E2E_INACTIVE_EMAIL`
- `E2E_INACTIVE_PASSWORD`
- `E2E_NON_STAFF_EMAIL`
- `E2E_NON_STAFF_PASSWORD`
- `E2E_CLAIMABLE_BOOKING_PATH`

`E2E_CLAIMABLE_BOOKING_PATH` must point to an admin booking detail route with an
unassigned assignment that both therapist test users are eligible to claim.

The setup script prints these values as JSON. Set them in the shell that runs
Playwright, then run cleanup when the E2E pass is complete.

## Role Coverage

The Playwright specs cover:

- unauthenticated admin redirect
- owner/super-admin universal navigation
- admin/manager operational navigation without owner-only controls
- booking coordinator limited workflow access
- therapist scoped booking/calendar/report access
- read-only/reporting access without booking mutation controls
- inactive staff and authenticated non-staff blocking
- therapist claimable-to-claimed handoff
- owner/super-admin visibility after a therapist claims an assignment

Do not close the Phase 10 issue until these E2E checks have run against the
intended launch environment and the manual launch checklist is complete.
