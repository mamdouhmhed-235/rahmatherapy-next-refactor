# Phase 2 Admin CRM UX Findings

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/96

## Admin Routes and Workflows Tested

Owner/super-admin route coverage confirmed these routes render:

- `/admin/dashboard/`
- `/admin/bookings/`
- `/admin/bookings/new/`
- `/admin/calendar/`
- `/admin/reports/`
- `/admin/clients/`
- `/admin/clients/new/`
- `/admin/enquiries/`
- `/admin/staff/`
- `/admin/services/`
- `/admin/availability/`
- `/admin/roles/`
- `/admin/audit/`
- `/admin/privacy/`
- `/admin/emails/`
- `/admin/operations/`
- `/admin/settings/`

Admin booking detail visibility was verified for the audit single and group bookings. The detail view exposed participant breakdowns, assignments, service snapshots, consent/health notes, customer requests, email delivery, booking summary, contact details, and home visit details.

## Role/Persona Matrix

| Persona | Method | Expected | Tested Result | Cleanup |
|---|---|---|---|---|
| Owner/super-admin | Real owner account, credentials redacted | Full admin access | Full nav and all major admin routes visible | Real account untouched |
| Admin/manager | Temporary `audit_phase2_` auth/staff profile | Daily admin access, no role management | Dashboard rendered, role page showed access-limited state | Cleaned up at phase end |
| Male therapist | Temporary `audit_phase2_` auth/staff profile | Own/eligible booking workflow | Saw therapist nav, only matching male assignment claim was available | Cleaned up at phase end |
| Restricted staff | Temporary dashboard-only role | Dashboard only, restricted direct routes | Nav only showed Dashboard, but dashboard quick links led to denied pages | Cleaned up at phase end |
| Inactive staff | Temporary inactive staff profile | Login blocked | Redirected to `/admin/login/?reason=inactive` and showed inactive-account message | Cleaned up at phase end |
| `can_take_bookings = false` therapist | Temporary therapist profile | No assignment access | Direct booking detail showed access-limited state | Cleaned up at phase end |

Female therapist coverage was completed in the follow-up pass. The temporary female therapist saw and claimed only the female assignment on a mixed-gender audit booking; the male assignment remained unassigned and the booking moved to `partially_assigned`.

## Assignment Claiming

Status: passed.

On mixed-gender audit booking `1c71ce80-7084-484d-8e59-8d954844f18c`:

- Male therapist could see and claim only the male assignment.
- After claim, the booking moved to `partially_assigned`.
- Female assignment remained `unassigned`.
- `can_take_bookings = false` therapist could not access the booking detail and therefore could not claim.
- Inactive staff login was blocked before reaching admin.

Completion-pass assignment check:

- Female therapist claimed the female assignment on audit booking `dbc77e6f-0ad3-4057-acda-dee79e6ca32a`.
- Supabase verification showed `assignment_status = partially_assigned`, the female assignment assigned to the female audit therapist, and the male assignment still `unassigned`.

## Visual, Responsive, and Accessibility Observations

Screenshots captured:

- `phase2-dashboard-mobile.png`
- `phase2-bookings-mobile.png`
- `phase2-home-placeholders-desktop.png`

Positive observations:

- Admin shell has a consistent sidebar/top-bar pattern.
- Mobile dashboard collapses into a usable top bar and stacked cards.
- Booking detail uses clear operational sections for participants, assignments, service snapshots, safety, notes, customer requests, contact, and home visit.
- Permission-limited pages clearly state the missing permission.
- Skip link and named navigation landmarks are present.

Improvement opportunities:

- Primary action button contrast needs correction.
- Mobile admin filter-heavy pages are usable but visually dense and should have stronger hierarchy between tabs, filters, and result cards.
- Dashboard quick links should be permission-scoped.
- The admin UI should continue consolidating page headers, action placement, and filter behavior so the CRM feels more like one polished operating system than several page-level tools.

## Completion Pass Addendum

Status: previously blocked admin workflow coverage was completed with controlled `audit_phase2_` data.

- Owner/admin DevTools route checks loaded dashboard, bookings, manual booking, calendar, reports, report export, clients, manual client creation, enquiries, staff, services, availability, roles, audit, privacy, emails, operations, and settings.
- Manual client creation was completed for an audit client. Client detail showed contact details, client summary, health/safety context, notes, privacy workflow, audit activity, and booking history.
- A sensitive client note and a privacy data-export request were created on the audit client and verified in the client CRM.
- Manual booking creation from the client profile was completed. Booking detail then persisted confirmed status, paid/card payment status, amount paid, payment note, treatment note, and admin note.
- Services management was tested with an audit-only service: create, edit price, and delete all worked.
- Staff management displayed the temporary admin, male therapist, female therapist, restricted, inactive, and no-bookings personas with expected role, gender, active, and booking eligibility fields.
- Staff availability mode switching was tested on the audit female therapist: `use_global`, `custom`, and `global_with_overrides` states rendered and persisted at the database level.
- Report CSV export returned HTTP 200 with `text/csv` and a booking-list attachment filename for the audited date range.
- Command search opened with `Ctrl+K`, returned permission-scoped booking and client results, and worked at mobile width.
- Mobile/tablet checks on dashboard, reports, calendar, booking detail, and client detail showed no document-level horizontal overflow in the sampled DevTools viewports. Several filter-heavy pages still expose unlabeled inputs/selects and dense mobile hierarchy as UX/accessibility improvement areas.

## Confirmed Findings

| Severity | Title | Reproduction | Expected | Actual | Evidence | Affected Route | Follow-up Issue |
|---|---|---|---|---|---|---|---|
| Medium | Low-contrast admin primary action buttons | Open `/admin/bookings/` at 390px | Primary actions meet contrast expectations | `Create booking` rendered dark text on dark green background | Screenshot `phase2-bookings-mobile.png`; computed colors `rgb(31,47,43)` on `rgb(48,70,63)` | `/admin/bookings/` | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/98 |
| Medium | Restricted dashboard links to denied routes | Log in as dashboard-only role and open `/admin/dashboard/` | Quick links are permission-scoped | Reports/Calendar links appear, but `/admin/reports/` renders access-limited state | Restricted role browser test | `/admin/dashboard/`, `/admin/reports/` | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/99 |

No frontend code fixes were made.
