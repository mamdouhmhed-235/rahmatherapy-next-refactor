# Production Role Matrix

This matrix defines the intended Phase 1 role and permission boundaries before the CRM expands further. Seeded roles are `Owner`, `Admin`, `Therapist`, and `Inactive`.

## Permission Constants

| Permission | Purpose |
| --- | --- |
| `manage_users` | Create and update staff profiles. |
| `manage_roles` | View roles and update role permissions. |
| `manage_permissions` | Manage permission records. Reserved for owner-level governance. |
| `manage_services` | Manage service catalog records. |
| `manage_availability_global` | Manage global availability, blocked dates, and overrides. |
| `manage_availability_own` | Manage own availability. |
| `manage_bookings_all` | Manage all bookings. |
| `manage_bookings_own` | Manage own assigned or claimable booking work. |
| `claim_bookings` | Claim eligible booking work. |
| `claim_assignments` | Claim eligible assignment rows. |
| `reassign_bookings` | Reassign booking assignments. |
| `manage_clients` | Manage client records. |
| `manage_payments` | Manage payment status and method. |
| `view_dashboard` | View the admin dashboard. |
| `manage_settings` | Manage business settings. |
| `manage_staff` | Staff-management navigation support. |
| `view_reports` | View reporting data. |
| `manage_emails` | Manage email notification settings. |
| `view_all_bookings` | View all bookings. |
| `view_own_bookings` | View own bookings and assignments. |
| `view_clients` | View client records. |
| `manage_audit_logs` | View and manage audit logs. |
| `manage_privacy_operations` | Manage customer data export, correction, deletion/anonymization review, and sensitive-note review workflows. |

## Role Scope

| Role | Seeded permissions | Intended scope |
| --- | --- | --- |
| Owner | All permissions | Full system governance, production setup, role management, staff management, all bookings, all clients, all settings, all reports, exports, audit logs, Sentry/privacy decisions. |
| Admin/Manager | Operational permissions excluding `manage_users`, `manage_roles`, and `manage_permissions` | Day-to-day business operations: services, availability, bookings, clients, payments, dashboard, settings, reports, emails, and audit review where seeded. |
| Therapist | `manage_availability_own`, `manage_bookings_own`, `claim_bookings`, `claim_assignments` | Own availability and own assigned or claimable booking work only. No broad client, payment, settings, role, report, or audit access. |
| Reception/Booking Coordinator | Not seeded in Phase 1 | Future role. Should receive booking/client/enquiry operational permissions without health-note, treatment-note, role, audit, or universal revenue access unless explicitly approved. |
| Read-only/Reporting | Not seeded in Phase 1 | Future role. Should receive aggregate report access without sensitive client detail by default. Exports require explicit permission. |
| Inactive | No permissions | No admin access. Inactive users are blocked by `/admin/*` middleware and server permission gates. |

## Admin Navigation

| Route | Sidebar permission gate | Intended roles |
| --- | --- | --- |
| `/admin/dashboard` | `view_dashboard` or `view_reports` | Owner, Admin/Manager |
| `/admin/bookings` | `view_all_bookings`, `manage_bookings_all`, or `manage_bookings_own` | Owner, Admin/Manager, Therapist where own/claimable views apply |
| `/admin/staff` | `manage_users` or `manage_staff` | Owner; Admin/Manager only if staff-management permissions are intentionally granted |
| `/admin/services` | `manage_services` | Owner, Admin/Manager |
| `/admin/roles` | `manage_roles` | Owner |
| `/admin/privacy` | `manage_privacy_operations` | Owner, Admin/Manager where explicitly granted |
| `/admin/availability` | `manage_availability_global` | Owner, Admin/Manager |
| `/admin/clients` | `manage_clients` | Owner, Admin/Manager |
| `/admin/settings` | `manage_settings` | Owner, Admin/Manager |

## Server Action And Page Gates

| Area | Gate in current code | Intended role scope |
| --- | --- | --- |
| Staff list/create/update | `manage_users` | Owner only by seeded permissions. |
| Staff availability | `manage_availability_global` or own `manage_availability_own` | Owner/Admin for global, Therapist for own. |
| Role permission changes | `manage_roles` with critical-owner safeguards | Owner only. |
| Services | `manage_services` | Owner/Admin. |
| Settings | `manage_settings` | Owner/Admin. |
| Global availability | `manage_availability_global` | Owner/Admin. |
| Clients | `manage_clients` | Owner/Admin. |
| Bookings lifecycle | `manage_bookings_all`, `manage_bookings_own`, claim permissions | Owner/Admin for broad lifecycle, Therapist for own/claimable work. |
| Payments | `manage_payments` | Owner/Admin; future finance role may receive scoped payment/reporting access. |
| Privacy operations | `manage_privacy_operations` | Owner/Admin only where explicitly granted; every request/status change is audit-logged. |

## Data Visibility Rules

| Data category | Owner | Admin/Manager | Therapist | Future Reception | Future Read-only/Reporting |
| --- | --- | --- | --- | --- | --- |
| Booking contact snapshots | All | All operational bookings | Own assigned/claimable only | Operational bookings if approved | Aggregate only by default |
| Client profiles | All | All | No broad access | Limited if approved | Aggregate only |
| Health notes | All if needed | Operational need only | Own assigned participants only | No by default | No |
| Treatment notes | All if needed | Operational need only | Own treatment notes only | No | No |
| Payment data | All | All operational payment data | No by default | Limited if approved | Aggregate only unless finance/reporting role approved |
| Revenue reports | Universal | Business-wide unless restricted | Own attributed revenue only if explicitly permitted later | Limited if approved | Aggregate scoped only |
| Client/customer reports | Universal | Business-wide unless restricted | Own assigned-client counts only if explicitly permitted later | Limited if approved | Aggregate scoped only |
| Audit logs | All | Seeded Admin currently has `manage_audit_logs`; review before launch if too broad | No | No | No |

## RLS Assumptions

- Anonymous users must not read or write sensitive CRM/admin tables directly.
- Authenticated users without an active `staff_profiles` row must not read admin data.
- Active staff can read only the rows allowed by RLS helpers and server route gates.
- Service-role flows bypass RLS only inside trusted server actions, route handlers, scripts, and migrations.
- Every new sensitive admin action must be permission-gated and audit-logged.

## Phase 1 Alignment Notes

- The seeded Owner role is the only current role with all permissions.
- The seeded Admin role is intentionally operational and does not include `manage_users`, `manage_roles`, or `manage_permissions`.
- Existing last-critical-admin safeguards use `manage_users` and `manage_roles` as the critical permission pair.
- Therapist UI expansion in later phases must stay scoped to own assigned/claimable booking work.
- Reports and exports in later phases must use these role scopes before any chart or CSV route is implemented.
