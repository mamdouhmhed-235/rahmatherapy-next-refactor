# Phase 3 Admin CRM And Operations UX Findings

## Verdict

Admin CRM readiness is **blocked** for real operations because the live Supabase project currently has zero staff profiles and zero active booking staff. Phase 2 proved the admin CRM can be tested with temporary seeded users, but Phase 3 confirms no real admin/staff bootstrap data remains.

## Evidence Collected

- Supabase count on `2026-05-03`: `staff_profiles = 0`, `active_booking_staff = 0`.
- Browser smoke: unauthenticated `/admin/dashboard/` redirects to `/admin/login/?redirectTo=%2Fadmin%2Fdashboard%2F`.
- `src/proxy.ts` checks `/admin/*` access, redirects missing sessions, treats missing staff profiles as unauthenticated, and redirects inactive staff with `reason=inactive`.
- Phase 2 E2E created temporary audit admins/staff and cleaned them up, leaving zero audit records.

## Confirmed Findings

| Severity | Finding | Evidence | Issue |
| --- | --- | --- | --- |
| P0 | No real admin/staff bootstrap data exists | Supabase Phase 3 count returned zero staff profiles and zero active booking staff. No admin can operate CRM without provisioning. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/51 |
| P1 | Admin layout is unusable at narrow mobile width | Phase 2 visual audit at 390px found the fixed 256px sidebar leaves only about 134px for content, making dashboard/bookings/clients/settings impractical. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/60 |
| P1 | Repeat-customer CRM context can show stale contact/address data | Phase 2 repeat booking showed changed contact details did not create a booking-level operational snapshot. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/59 |
| P2 | Therapist booking detail controls are broader than needed | Phase 2 found therapist-accessible booking detail UI showed broad operational controls instead of a narrower staff task view. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/63 |

## Admin Experience Assessment

The admin login guard behaves correctly for unauthenticated access. Phase 2 validated dashboard, bookings, clients, staff, services, roles, settings, availability, and assignment claiming with temporary accounts. The CRM is not ready for production daily use until real owner/admin/staff bootstrap, mobile usability, and repeat-client contact history are resolved.

The biggest operational risks are:

- A real operator cannot log in until staff profiles and roles are provisioned.
- Staff cannot trust current client contact/address context for repeat bookings if customers change details.
- Mobile admin use is not practical on realistic phone widths.
- Therapist views need tighter task-focused controls and sensitive-data minimization.

## Recommended Order

1. Provision a real owner/admin bootstrap process and production staff setup.
2. Fix repeat-customer booking/contact snapshot behavior.
3. Make admin navigation/content usable on mobile and tablet widths.
4. Narrow therapist booking detail controls to claim/treatment-note workflows.
5. Re-run admin CRM E2E as owner, restricted therapist, inactive staff, and wrong-gender staff.
