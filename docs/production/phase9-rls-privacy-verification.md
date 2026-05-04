# Phase 9 RLS, Privacy, And Deployment Hardening Verification

Date: 2026-05-03

## Supabase Security Advisor

Status:

- RLS no-policy lints for `client_notes`, `client_privacy_requests`, and `enquiries` were resolved by Phase 9 RLS policies.
- Remaining advisor warning: `auth_leaked_password_protection`.

Decision:

- Keep the leaked-password warning tracked as a plan constraint because Supabase marks it as Pro-plan dependent in the dashboard. Do not treat it as remediated until the production Supabase project has leaked password protection enabled and the advisor confirms the warning is gone.

## Sensitive Table Access Check

Checked tables:

- `bookings`
- `clients`
- `booking_participants`
- `booking_items`
- `booking_assignments`
- `staff_profiles`
- `enquiries`
- `client_notes`
- `client_privacy_requests`
- `audit_logs`
- `email_delivery_events`
- `operational_events`

Verified:

- RLS is enabled for each checked table.
- Each checked table has at least one RLS policy.
- `anon` has no raw `select` grant on checked sensitive tables.
- `anon` has no raw `insert` grant on checked sensitive tables.
- `authenticated` has no raw `insert`, `update`, or `delete` grants on checked sensitive tables.
- `service_role` has required `select` and `insert` grants for server-side flows.

## Privacy RLS Policies Added

Phase 9 added explicit authenticated read policies for:

- `client_notes`
- `client_privacy_requests`
- `enquiries`

These policies require:

- `manage_privacy_operations`, or
- `manage_clients`

The application still performs privacy workflow writes through permission-gated server actions using the service-role client.

## Report Exports

Report exports must remain server-scoped through `/admin/reports/export`.

Default exports must exclude:

- health notes
- treatment notes
- admin notes
- consent details
- raw audit payloads

Every report export must write an `audit_logs` row.

## Customer Manage Route

Customer manage access is token-hash based:

- raw token is not stored
- only `manage_token_hash` is queried
- expired tokens are rejected server-side
- invalid tokens return the same safe unavailable state
- manage output excludes admin notes, treatment notes, audit logs, staff-only notes, and other bookings

## Browser Bundle Secret Scan

Required before launch:

- scan `.next`
- scan `.open-next`
- scan public/static output
- search for secret names and known secret values without printing secret values

Secret values that must never appear in client/browser output:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `SENTRY_AUTH_TOKEN`
- `CLOUDFLARE_API_TOKEN`
- manage tokens

## Cloudflare Build And Deployment

Phase 9 requires:

- `pnpm cf:build`
- Cloudflare preview readiness
- Cloudflare environment-variable inventory

Final GitHub-connected Cloudflare production deployment is intentionally documented after Phase 10 in the implementation plan.
