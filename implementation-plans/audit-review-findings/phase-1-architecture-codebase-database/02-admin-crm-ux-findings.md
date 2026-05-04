# Phase 1 Admin CRM Architecture And UX Findings

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/84

## Admin Shell And Navigation

Implemented shell:

- `src/app/admin/layout.tsx` resolves the current staff profile.
- Inactive staff receive an inactive access-denied state.
- Active staff are wrapped in `src/app/admin/components/AdminShell.tsx`.
- `AdminShell` provides desktop sidebar, mobile drawer/top bar, skip link, signout, and command search.
- Navigation is filtered by permissions from `PERMISSIONS`.

Shared admin primitives:

- `AdminPageHeader`
- `AdminStat`
- `AdminPanel`
- `AdminStatusBadge`
- `AdminFilterBar`
- `AdminEmptyState`
- `AdminAccessDenied`
- `AdminMobileActionBar`

These primitives provide a coherent admin foundation and match the latest implementation direction better than the stale README implies.

## Admin Data Flow Map

Admin route protection:

1. `src/middleware.ts` redirects unauthenticated or inactive staff away from `/admin/*`.
2. Admin layout fetches `getStaffProfile`.
3. Individual pages check route-level permission and return `AdminAccessDenied` when appropriate.
4. Server actions call `requirePermission` or explicit profile/permission checks.
5. Service-role writes happen after app-level permission checks and generally write audit logs.

Admin booking management:

1. Booking pages fetch profile through RLS-enforced server client.
2. Page-level checks determine all-bookings, own-bookings, or claimable assignment access.
3. Admin client fetches booking details after permission checks.
4. Updates write `bookings`, `booking_assignments`, `audit_logs`, email events, and dashboard revalidation paths.

Reports:

1. `/admin/reports` and `/admin/reports/export` are permission-gated.
2. `getReportData` fetches bookings, assignments, items, clients, staff, enquiries, emails, operations, and availability rule references.
3. Revenue display/export is controlled by `canViewRevenueReports`.
4. Exports write `audit_logs` and exclude health notes, treatment notes, admin notes, consent details, and raw audit payloads from CSV output.

## Role And Persona Architecture

Covered in code and docs:

- Owner/Super Admin: all permissions through role matrix and seeded owner role.
- Admin/Manager: operational permissions without user/role governance.
- Therapist: own availability, own/claimable bookings, claiming.
- Inactive staff: blocked by middleware and layout.
- `can_take_bookings = false`: excluded from availability and claiming checks.
- Restricted/read-only/reporting roles: documented as future/partial roles; Phase 2 should verify runtime persona behavior.

The role matrix in `docs/production/role-matrix.md` is the best current source of truth for intended role boundaries.

## Findings

| Severity | Title | Evidence | Affected area | Why it matters | Issue |
| --- | --- | --- | --- | --- | --- |
| Low | Unused legacy `AdminSidebar` remains | `rg "AdminSidebar" src` only finds the definition in `src/app/admin/AdminSidebar.tsx`; active shell is `src/app/admin/components/AdminShell.tsx` | Admin frontend architecture | Duplicate navigation code can mislead future edits and drift from the active permission route set | #87 |

## Admin UX Risks For Phase 2

These are not confirmed defects from the static audit. They need browser evidence in Phase 2:

- Mobile usability of dense booking, client, report, audit, privacy, and operations pages.
- Table overflow, action placement, and sticky mobile action bars under real data volume.
- Permission-limited states across owner, admin/manager, therapist, restricted, inactive, and no-bookings personas.
- Whether `AdminCommandSearch` materially improves daily workflow and remains permission-scoped in browser.
- Whether the admin experience feels purpose-built for a calm clinical mobile therapy business rather than a generic dashboard.

## Right-Sized CRM Benchmark Classification

| Benchmark area | Current Rahma state | Rating | Recommendation |
| --- | --- | --- | --- |
| Operational dashboard/work queue | Dashboard and `getAttentionItems` cover unassigned, partial, cancellations, reschedules, unpaid completed bookings, failed emails, operations, and availability gaps | Meets/partial | Phase 2 should validate usefulness under realistic volume. |
| Calendar/agenda | `/admin/calendar` exists | Partial | Browser audit should assess mobile usefulness and own/all visibility. |
| Client profile/history | Client list/detail/manual creation exist | Meets/partial | Verify repeat-client clarity and sensitive note access in Phase 2. |
| Booking lifecycle management | Status, payment, notes, assignments, claiming, emails, audit logs exist | Meets | Phase 2 should test end-to-end behavior. |
| Team performance/workload | Reports include workload and staff revenue attribution | Partial | Validate metric correctness against docs and role scopes. |
| Automations/reminders | Email events and manual reminders exist; no broad automation engine | Right-sized | Avoid enterprise automation unless tied to booking follow-up. |
| Duplicate client handling | Architecture supports repeat clients, but dedupe quality needs runtime evidence | Partial | Phase 2 should test repeat submissions and manual clients. |
| Mobile admin | Responsive shell exists | Partial | Needs browser screenshots and interaction checks. |
