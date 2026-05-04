# Phase 1 Backend, Data, RLS, And Security Findings

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/84

## Database Entity Map

Core entities observed through migrations and Supabase inspection:

- RBAC: `roles`, `permissions`, `role_permissions`, `staff_permission_overrides`
- Staff: `staff_profiles`
- Services: `services`
- Booking: `clients`, `bookings`, `booking_participants`, `booking_items`, `booking_assignments`
- Availability: `business_settings`, `availability_rules`, `availability_overrides`, `blocked_dates`, `staff_availability_rules`, `staff_availability_overrides`, `staff_blocked_dates`
- Operations: `audit_logs`, `email_delivery_events`, `operational_events`, `enquiries`, `client_notes`, `client_privacy_requests`

Expected model alignment:

- Dynamic RBAC exists.
- Optional staff permission overrides exist.
- Staff availability modes exist: `use_global`, `custom`, `global_with_overrides`.
- `booking_participants` is present as group composition source.
- `booking_assignments` is present as staff claiming source.
- No simple `bookings.assigned_staff_id` model was found.
- Payment status/method and amount fields exist for in-person cash/card tracking.
- Customer manage token fields exist on `bookings`.

## RLS And Trust Boundaries

Supabase inspection found RLS enabled on all public tables. Sensitive tables do not expose broad anon select policies. `services` is intentionally readable by anon/authenticated only when active and frontend-visible.

The main trust model is:

- Browser/public clients use app routes, not raw sensitive table access.
- Public booking and availability routes use service-role server clients.
- The booking SQL RPC is `security definer` but checks the actor role and rejects non-service-role calls.
- Staff/admin pages first resolve the authenticated staff profile with the anon server client, then use service-role clients for trusted server-side queries/writes after app permission checks.
- RLS policies use private helper functions in `app_private` for active staff, permissions, and gender-aware claiming.

## Data Flow Notes

Booking creation:

1. Server Zod validation in `/api/bookings`.
2. Shared `createBookingTransaction`.
3. RPC `public.create_booking_request`.
4. RPC validates service area, service visibility, participant gender data, business window, active booking staff, permission eligibility, staff capacity, existing assigned bookings, and unassigned reservations.
5. RPC uses `pg_advisory_xact_lock` for date/time booking creation.
6. RPC inserts client, booking, participant, item, and assignment rows.

Assignment claiming:

1. `claimBookingAssignment` verifies current staff can claim.
2. Staff must be active, `can_take_bookings`, and have claim permission.
3. Required therapist gender must match actor gender.
4. Update is conditional on `status = unassigned` and `assigned_staff_id is null`.
5. Booking-level assignment status is recomputed.

Email and operations:

- Email sends are tracked in `email_delivery_events`.
- Failed emails create safe operational events.
- Booking creation catches email failures after the transaction, so email failure does not block booking creation.

## Supabase Advisor Findings

| Severity | Title | Evidence | Affected area | Why it matters | Issue |
| --- | --- | --- | --- | --- | --- |
| Medium | Leaked password protection disabled | Supabase security advisor reports `auth_leaked_password_protection`; docs already track it in `docs/production/phase9-rls-privacy-verification.md:10` | Supabase Auth | Staff/admin accounts should reject known compromised passwords before launch if available | #88 |
| Medium | Missing indexes for several foreign keys | Supabase performance advisor reports unindexed FKs across booking, audit, email, operations, role, staff, and CRM tables | Supabase Postgres | Admin lists, reports, RLS checks, joins, cleanup, and audit views can degrade as data grows | #89 |

## Additional Backend Hardening Opportunities

| Priority | Area | Opportunity | Evidence |
| --- | --- | --- | --- |
| Should-have | RLS performance | Replace per-row `auth.uid()` style policy calls with initplan style where advisor flags them. | Supabase performance advisor flags staff profile policy performance. |
| Should-have | Service-role grants | Review odd-looking `anon`/`authenticated` non-DML grants such as `REFERENCES`, `TRIGGER`, and `TRUNCATE` on sensitive tables. | Supabase grants query showed no anon select/insert on sensitive tables, but non-DML grants deserve cleanup review. |
| Should-have | Reporting data minimization | `getReportData` selects `health_notes` for attention flags. Verify only roles with operational need can infer health-note presence. | `src/app/admin/reports/reporting.ts:38`, `:141`, `:571`. |
| Polish | Performance advisor hygiene | Review unused-index warnings only after realistic production usage exists. | Supabase performance advisor reports several unused indexes; this may be normal for a new system. |

## Validation Results

| Check | Result |
| --- | --- |
| `pnpm lint` | Passed |
| `pnpm test` | Passed after sandbox-related `spawn EPERM` rerun outside sandbox; 9 files, 30 tests |
| `pnpm test:security:secrets` | Passed; 6 sensitive env keys checked across `.next/static`, `.open-next/assets`, and `public` |
| `pnpm verify:london-time` | Passed |
| `pnpm build` | Passed; emitted middleware-to-proxy warning |
| `pnpm cf:build` | Passed after sandbox-related `spawn EPERM` rerun outside sandbox; emitted Windows compatibility and middleware-to-proxy warnings |
| `git diff --check` | Passed; warned about LF to CRLF on pre-existing modified `implementation_plan2.md` |
| Supabase migration status | Live migrations present through `20260504052757_phase10_inactive_staff_self_profile_rls` |
| Supabase security advisor | One warning: leaked password protection disabled |
| Supabase performance advisor | Missing FK indexes, RLS initplan warning, multiple permissive policy warnings, unused index info |
