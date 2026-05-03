# Phase 1 Backend, Data, and Security Findings

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/50

## Scope
- Supabase schema, migrations, RLS, grants, constraints, and security advisor.
- API routes and server actions that cross trust boundaries.
- Booking, availability, RBAC, email, and service-role usage.

## Supabase Objects Inspected
- Tables: `roles`, `permissions`, `role_permissions`, `staff_permission_overrides`, `staff_profiles`, `services`, `clients`, `bookings`, `booking_participants`, `booking_items`, `booking_assignments`, `availability_rules`, `blocked_dates`, `availability_overrides`, `staff_availability_rules`, `staff_blocked_dates`, `staff_availability_overrides`, `business_settings`, `audit_logs`.
- RLS policies from `pg_policies`.
- Grants from `information_schema.role_table_grants`.
- Constraints from `pg_constraint`.
- Functions: `app_private.current_active_staff_id`, `app_private.current_staff_has_permission`, `app_private.current_staff_can_claim_gender`, `public.update_updated_at_column`.
- Supabase security advisor: no lints returned.
- Migration history: 19 live migrations returned by Supabase MCP.

## Findings

| Severity | Title | Evidence | Affected Area | Reproduction Notes | Follow-up Issue |
|---|---|---|---|---|---|
| High | Booking creation lacks atomic transaction/capacity protection | `createBookingTransaction` rechecks availability, then separately inserts `bookings`, `booking_participants`, `booking_items`, and `booking_assignments`; constraints do not reserve capacity. | Booking creation, double-booking prevention | Two simultaneous requests can pass the same availability recheck; a later insert failure can leave partial rows. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/52 |
| Medium | Date and minimum-notice logic is not explicitly Europe/London aware | `availability.ts` uses `new Date()` and local date parsing for business dates and minimum notice. | Availability, booking window, UK/BST behavior | Runtime timezone differences can affect day-of-week and minimum-notice calculations around BST boundaries. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/54 |
| Medium | Local migration timestamps diverge from live migration history | Supabase MCP `list_migrations` versions differ from several checked-in migration filenames for the same logical migrations. | Migration reproducibility | Fresh environments may see confusing migration status or drift without reconciliation. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/55 |

## Trust Boundary Map
- Public browser -> `/api/availability`: server route validates payload and uses service-role client for availability reads.
- Public browser -> `/api/bookings`: server route validates payload, uses service-role client for booking writes, catches email failures.
- Admin Server Components: authenticate with anon SSR client, resolve staff profile/RBAC, then use service-role client for privileged reads.
- Admin Server Actions: require permission through SSR client, then use service-role client for writes and audit logging.
- Email: Resend client is server-only; API keys are represented only in `.env.example` names during this audit.

## No Fixes
No backend, schema, RLS, or security fixes were made in Phase 1.
