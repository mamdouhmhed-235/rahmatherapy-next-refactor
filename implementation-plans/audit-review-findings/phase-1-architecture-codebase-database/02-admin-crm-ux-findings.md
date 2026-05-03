# Phase 1 Admin CRM UX Findings

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/50

## Scope
- Admin shell and route protection.
- Dashboard, bookings, clients, staff, services, settings, availability, and roles surfaces.
- CRM suitability for daily mobile therapy operations.

## Architecture Map
- Admin routes confirmed by `pnpm build`: `/admin/login`, `/admin/signout`, `/admin/dashboard`, `/admin/bookings`, `/admin/bookings/[bookingId]`, `/admin/clients`, `/admin/clients/[clientId]`, `/admin/staff`, `/admin/staff/[staffId]`, `/admin/staff/[staffId]/availability`, `/admin/services`, `/admin/settings`, `/admin/availability`, `/admin/roles`, `/admin/roles/[roleId]`.
- Route protection: `src/proxy.ts` redirects `/admin/*` except login/signout when there is no session, no active `staff_profiles` row, or inactive staff.
- Sidebar filtering: `src/app/admin/AdminSidebar.tsx` filters links by resolved RBAC permissions.
- Booking CRM: list/detail pages display client, participant, service snapshot, assignment, payment, address, consent, health notes, treatment notes, and admin notes.
- Client CRM: list/detail pages connect clients to booking history.

## Findings

| Severity | Title | Evidence | Affected Area | Reproduction Notes | Follow-up Issue |
|---|---|---|---|---|---|
| Blocker | Live Supabase has no staff profiles | Supabase MCP row counts show `staff_profiles = 0` and active booking staff = 0. `src/proxy.ts` requires an active `staff_profiles` row for admin access. | Admin login, admin CRM, public availability | Any authenticated user without a linked staff profile is redirected away from `/admin/*`; availability has no eligible staff. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/51 |
| Medium | Repeat client profile can remain stale across bookings | `createOrFindClient` returns an existing client by email without updating phone/address/notes; booking-level address is preserved separately. | Client CRM | A repeat customer using the same email with a new phone/address will attach to the existing client, but the client summary may show old contact/address data. | Consider a focused CRM issue after Phase 2 validates behavior through the UI. |

## Positive Architecture Notes
- Booking detail uses `booking_participants` and `booking_assignments`, not a simple `bookings.assigned_staff_id` model.
- Staff claiming UI only exposes claim actions when assignment gender matches the current staff profile and the staff can claim.
- Staff management code includes self-lockout and last-critical-admin protection checks.
- Role permission changes are audited.

## No Fixes
No admin or CRM fixes were made in Phase 1.
