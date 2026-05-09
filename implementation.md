# Granular RBAC Consolidation Implementation Plan

**Summary**
Implement 5 fixed business roles backed by granular canonical permissions, migrate all app/RLS/script/test references away from broad legacy permissions, then remove deprecated permission rows after verification. The migration must be zero-loss: existing users keep access during the transition, but the final codebase uses only the cleaner granular permission model.

## Current Findings To Preserve

- Live Supabase currently has 4 roles: `Owner`, `Admin`, `Therapist`, `Inactive`; add `Booking Coordinator`.
- Live Supabase currently has 23 permissions and 0 `staff_permission_overrides`.
- RBAC already resolves `role_permissions` first, then `staff_permission_overrides`; keep this model.
- RLS depends on `app_private.current_staff_has_permission(...)`; update app gates and RLS together.
- Existing weak/broad permissions are the cleanup target: `view_reports`, `view_clients`, `manage_clients`, `manage_users`, `manage_staff`, `manage_roles`, `manage_permissions`, `manage_emails`, `claim_bookings`, `reassign_bookings`, `view_all_bookings`, `view_own_bookings`, `manage_bookings_own`, `manage_payments`.
- Supabase advisor findings about leaked-password protection and unrelated indexes are not part of this feature. Add only RBAC/scope indexes needed by the new permission model.

## Canonical Roles

Use stable DB names and separate UI labels:

| DB Role | UI Label |
|---|---|
| `Owner` | Owner / Main Admin |
| `Admin` | Admin / Practice Manager |
| `Booking Coordinator` | Client Care / Booking Coordinator |
| `Therapist` | Therapist |
| `Inactive` | Inactive / Suspended |

## Canonical Permissions

Keep these current permissions because they remain clear:

```txt
view_dashboard
manage_bookings_all
manage_services
manage_settings
manage_availability_global
manage_availability_own
manage_audit_logs
manage_privacy_operations
claim_assignments
```

Add these new canonical permissions:

```txt
view_bookings_all
view_bookings_assigned
manage_bookings_assigned
assign_bookings
view_reports_own
export_reports_own
view_reports_operational
view_reports_revenue
export_reports_revenue
view_reports_business
view_clients_assigned
view_clients_all
view_client_contact_details
view_client_health_notes_assigned
create_client_session_notes
manage_clients_all
manage_sensitive_client_notes
view_staff
manage_staff_profiles
assign_staff_roles
manage_permission_overrides
manage_role_templates
view_email_logs
resend_booking_emails
manage_email_settings
manage_enquiries
```

Deprecate and remove after migration:

```txt
view_reports
view_clients
manage_clients
manage_users
manage_staff
manage_roles
manage_permissions
manage_emails
claim_bookings
reassign_bookings
view_all_bookings
view_own_bookings
manage_bookings_own
manage_payments
```

## Role Permission Bundles

**Owner / Main Admin**
- All canonical permissions.
- Only role with default `manage_role_templates` and `manage_permission_overrides`.

**Admin / Practice Manager**
- `view_dashboard`
- `view_bookings_all`, `manage_bookings_all`, `view_bookings_assigned`, `manage_bookings_assigned`, `assign_bookings`, `claim_assignments`
- `view_reports_operational`, `view_reports_business`, `view_reports_revenue`, `export_reports_revenue`
- `view_clients_all`, `view_client_contact_details`, `manage_clients_all`, `manage_sensitive_client_notes`
- `manage_services`, `manage_settings`, `manage_availability_global`, `manage_availability_own`
- `view_staff`, `manage_staff_profiles`, `assign_staff_roles`
- `view_email_logs`, `resend_booking_emails`, `manage_email_settings`, `manage_enquiries`
- `manage_audit_logs`, `manage_privacy_operations`
- Excludes by default: `manage_role_templates`, `manage_permission_overrides`.

**Client Care / Booking Coordinator**
- `view_dashboard`
- `view_bookings_all`, `manage_bookings_all`, `assign_bookings`
- `view_clients_all`, `view_client_contact_details`, `manage_clients_all`
- `manage_enquiries`
- `view_email_logs`, `resend_booking_emails`
- `view_reports_operational`
- No revenue, staff, role, audit, privacy, settings, or sensitive-note access by default.

**Therapist**
- `view_dashboard`
- `view_bookings_assigned`, `manage_bookings_assigned`, `claim_assignments`
- `manage_availability_own`
- `view_clients_assigned`, `view_client_contact_details`, `view_client_health_notes_assigned`
- `create_client_session_notes`
- `view_reports_own`, `export_reports_own`

**Inactive / Suspended**
- No permissions.
- Staff profile must have `active = false`.

## Implementation Phases

1. Baseline and safety: snapshot roles, permissions, role grants, staff roles, and overrides; run `pnpm test`, `pnpm lint`, and `pnpm build`; do not delete or rename permissions before the migration path is ready.
2. Supabase state: add canonical permissions, add `Booking Coordinator`, seed bundles, preserve/remap any overrides, add RBAC indexes, update RLS policies, and remove deprecated rows once app code is canonical.
3. RBAC code layer: make canonical permissions the only exported constants; add scoped helpers for bookings, reports, clients, staff/roles, email, enquiries, and operations.
4. Staff, roles, and overrides: gate staff edits by `manage_staff_profiles`, fixed role assignment by `assign_staff_roles`, overrides by `manage_permission_overrides`, and role templates by `manage_role_templates`; keep self-lockout and last-admin safeguards.
5. Navigation and visibility: use canonical permission groups for admin nav; show Roles, Audit, and Privacy only when permissioned.
6. Reports: split own, operational, business, revenue, and export behavior; keep revenue hidden unless revenue permission exists; enforce CSV route permissions.
7. Booking and client scope: all booking management uses `manage_bookings_all`; assigned work uses assigned booking permissions; therapists can open assigned clients and health/session context only where permissioned.
8. Email, enquiries, and operations: split email logs, resend actions, email settings, and enquiry workflow; keep Booking Coordinator away from staff, role, settings, audit, and privacy controls by default.
9. Scripts and test data: use the 5 standard roles and remove temporary Phase10 role names.
10. Final verification: run tests/lint/build, verify no app/script references remain to deprecated permissions, and confirm Supabase role/permission state after applying the migration.

## Assumptions

- Legacy permissions are temporary compatibility only and will be removed by the consolidation migration.
- No production business data is deleted.
- Role labels with slashes are UI labels only.
- `Booking Coordinator` replaces temporary/test coordinator concepts.
- Existing users must not lose access mid-migration.
