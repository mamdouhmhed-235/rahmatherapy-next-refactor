# Rahma Therapy Production Runbook

This runbook records the operational steps required before launch. It is intentionally conservative: sensitive admin, staff, booking, health, payment, audit, and email data must be handled through permission-gated server paths.

## First Owner/Admin Bootstrap

The first owner/admin is created with a server-only command that links an existing Supabase Auth user to `public.staff_profiles`.

Prerequisites:

- The Supabase Auth user already exists.
- `NEXT_PUBLIC_SUPABASE_URL` is set.
- `SUPABASE_SERVICE_ROLE_KEY` is set only in a trusted server or local admin shell.
- The target role exists and includes both `manage_users` and `manage_roles`.
- No active critical admin already exists, unless the override has been explicitly reviewed.

Command:

```bash
pnpm bootstrap:owner-admin -- --email owner@example.com --full-name "Owner Name" --gender female --role Owner
```

Use `--role-id <uuid>` instead of `--role Owner` if role names have been changed.

Reviewed override:

```bash
pnpm bootstrap:owner-admin -- --email owner@example.com --full-name "Owner Name" --gender female --role Owner --allow-existing-critical-admin
```

The command creates the staff profile with:

- `active = true`
- `can_take_bookings = false`
- `availability_mode = 'use_global'`

It writes an `audit_logs` row with `action_type = 'production_owner_admin_bootstrapped'`.

Verification:

- The intended owner/admin can log into `/admin/dashboard`.
- An authenticated user without a `staff_profiles` row is redirected away from `/admin/*`.
- An inactive staff profile is redirected with the inactive reason.
- Existing role/staff actions still prevent removal of the last active critical admin.

## Migration Status Check

Before launch and before future migration work:

1. Run Supabase migration status through Supabase MCP or Supabase CLI.
2. Compare live versions with [Migration History](./production/migration-history.md).
3. Use new chronological timestamps for future migrations.
4. Do not rename already-applied migrations unless intentionally resetting non-production environments.

## Sentry Capture Policy

Production Sentry config must keep:

- `sendDefaultPii = false`
- server `includeLocalVariables = false`
- `beforeSend` scrubbing enabled

See [Sentry Privacy Policy](./production/sentry-privacy.md).

## Privacy And Data Retention

Production privacy operations are documented in
[Privacy, Data Retention, And Customer Data Operations](./production/privacy-data-retention.md).

Operational rules:

- Customer data export, correction, deletion/anonymization review, and sensitive-note review require `manage_privacy_operations`.
- Create privacy requests from a client detail page.
- Review and status privacy requests from `/admin/privacy`.
- Every privacy request creation and status change must write an `audit_logs` row.
- Default report exports must exclude health notes, treatment notes, admin notes, consent details, and raw audit payloads.
- Do not hard-delete booking or audit history where financial, legal, operational, or accountability integrity must be preserved.

## Staff Setup

1. Create or link Supabase Auth users.
2. Create staff profiles in `/admin/staff`.
3. Assign each staff member the least-privilege role required for their work.
4. Set gender and active status.
5. Keep `can_take_bookings = false` until availability and role eligibility are confirmed.
6. Configure staff availability in `/admin/staff/[staffId]/availability`.
7. Confirm therapist accounts cannot access broad admin/payment/reporting controls unless explicitly permitted.

## Service Setup

1. Review services in `/admin/services`.
2. Confirm frontend visibility for services that should appear publicly.
3. Confirm duration, price, gender restrictions, and active status.
4. Prefer deactivation over destructive deletion where historical bookings exist.
5. Create a booking smoke test after service edits.

## Settings Setup

Review `/admin/settings` before launch:

- booking window
- minimum notice
- buffer/travel expectations
- cancellation cutoff
- payment expectations
- service-area city list
- contact details
- email readiness values

## Availability Setup

1. Configure global weekly availability in `/admin/availability`.
2. Add blocked dates and overrides where needed.
3. Configure individual staff availability where they do not use global availability.
4. Confirm male and female capacity preview supports the expected public booking scenarios.
5. Run public availability smoke tests for single male, single female, and mixed-gender group bookings.

## Booking Smoke Test

Use non-sensitive test data.

1. Submit a public website booking.
2. Confirm booking contact snapshots are stored.
3. Confirm participant records and assignments are created.
4. Confirm the booking appears in `/admin/bookings`, `/admin/dashboard`, and `/admin/calendar`.
5. Confirm a repeat customer booking preserves older booking snapshots.

## Email Smoke Test

1. Confirm `RESEND_FROM_EMAIL` is a verified sender/domain.
2. Confirm `NEXT_PUBLIC_SITE_URL` is the production canonical URL.
3. Submit a booking request.
4. Confirm customer/admin emails are accepted or safely logged as failed.
5. Confirm staff assignment/change emails are accepted or safely logged as failed.
6. Confirm email status appears in `/admin/emails`.

## RLS Smoke Test

See [Phase 9 RLS, Privacy, And Deployment Hardening Verification](./production/phase9-rls-privacy-verification.md).

Before launch:

- `anon` must not read sensitive admin/CRM tables directly.
- `anon` must not insert into sensitive admin/CRM tables directly.
- `authenticated` must not raw-write tables that are controlled by server actions.
- `service_role` server flows must still work.
- Supabase security advisor must be reviewed and any remaining lints must have written mitigation.

## Rollback Notes

- Keep each phase in small PRs where possible.
- Database rollback should be a reviewed forward migration unless the environment is explicitly non-production and disposable.
- Do not rename or edit already-applied production migrations.
- If Cloudflare deployment fails, roll back to the previous Worker version in Cloudflare Version History.
- If a runtime secret is wrong, update the Cloudflare secret and redeploy rather than committing secret values.

## Backup And Export Expectations

- Supabase backups and export expectations must be confirmed before launch.
- Report CSV exports are operational exports, not full database backups.
- Customer data exports must go through the privacy workflow and be audit-logged.
- Default report exports must exclude sensitive health, treatment, admin-note, consent, and raw audit payload data.

## Launch Checks

Run these before production launch:

```bash
pnpm lint
pnpm build
pnpm cf:build
git diff --check
```

Also verify:

- Supabase security advisor has no security lints.
- Browser bundles do not expose service-role, Resend, Sentry auth token, or other server secrets.
- First owner/admin bootstrap has been completed and audited.
- Role matrix assumptions match seeded permissions and admin route gates.
- Migration history is documented.
- Cloudflare runtime variables and secrets are configured without storing deployment API tokens in application runtime.
- Production runbook smoke tests pass before launch.
