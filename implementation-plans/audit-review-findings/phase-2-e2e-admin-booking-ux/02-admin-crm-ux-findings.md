# Phase 2 Admin CRM UX Findings

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/57

## Admin Workflows Tested

| Workflow | Result | Notes |
|---|---:|---|
| Owner login | Pass | Temporary `audit_phase2_owner` could access full sidebar and dashboard. |
| Bad login state | Pass | Wrong password showed generic invalid credentials. |
| Inactive user login | Partial | Account could authenticate but admin routes rendered inactive/insufficient access instead of a clear inactive redirect in the tested flow. |
| Owner dashboard | Pass | Metrics matched 2 bookings, 3 assignments, 1 repeat client, £67.50 average. |
| Booking list/detail | Pass with UX defects | Group booking, participants, assignments, notes, payment and address were visible. |
| Client CRM | Partial | Repeat client was detected, but per-booking contact differences were not visible. |
| Staff/services/settings/availability/roles | Pass | Owner routes loaded and rendered data. |
| Therapist RBAC | Pass with UX concern | Sidebar hid restricted routes; direct `/admin/settings/` showed insufficient permissions. |
| Assignment claiming | Pass | Male owner claimed male assignment; female therapist claimed female assignment; wrong/no-booking staff could not claim male assignment. |

## Findings

| Severity | Title | Reproduction steps | Expected behavior | Actual behavior | Evidence | Affected route/file/table | Recommended follow-up issue title |
|---|---|---|---|---|---|---|---|
| High | Admin mobile layout is unusable at 390px | Open an admin page at 390x844. | Admin should collapse navigation or provide a usable mobile layout without horizontal scrolling. | Fixed sidebar consumed most of the viewport; content was squeezed into a narrow strip with horizontal scrolling. | Screenshot `phase2-admin-mobile-390.png`. | `/admin/*`, `src/app/admin/layout.tsx`, `AdminSidebar` | Make admin layout responsive on mobile |
| High | Repeat customer CRM hides booking-specific contact details | Submit two bookings using same email but different name/phone; open booking detail and clients page. | Admin should know the contact name/phone supplied for each booking. | Admin shows only the original client name/phone, making the second booking look like it was submitted by the first contact details. | Booking detail for group request showed `audit_phase2_single client` and `07700900001`. | `/admin/bookings/[bookingId]/`, `/admin/clients/`, `clients`, `bookings` | Add booking contact snapshots to CRM views |
| Medium | Therapist can see edit controls on assigned booking detail | Login as therapist assigned to a booking and open booking detail. | If therapists can only claim/view own assignments, management controls should be hidden or explicitly scoped. | Therapist view displayed lifecycle/payment/admin note form on an assigned booking. | Female therapist booking detail after claim showed Booking status, Payment status, Admin notes, Save booking. | `/admin/bookings/[bookingId]/` | Scope therapist booking detail controls to permitted actions |
| Medium | Permission-denied pages keep restricted page titles | Login as therapist and navigate directly to `/admin/settings/` or `/admin/dashboard/`. | The page should clearly present a restricted/access-denied state, ideally with a consistent title and route handling. | Restricted pages render original page heading plus insufficient permission copy. | `/admin/settings/` showed `Settings` then insufficient permissions. | `/admin/settings/`, `/admin/dashboard/` | Improve admin access-denied route UX |

## CRM Notes

Daily operations are broadly supported: dashboard attention queue, booking list, group booking detail, participants, assignments, payment, notes, client history, staff, services, settings, global availability, and roles are present. The biggest CRM trust issue is contact snapshotting for repeat bookings.
