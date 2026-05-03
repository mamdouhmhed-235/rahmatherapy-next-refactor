# Phase 1 Business Operational Gaps

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/50

## Business Context Checked
- UK mobile therapy appointments at customer location.
- Cash/card payment in person.
- No customer accounts.
- Staff/admin use Supabase Auth.
- Gender matching is a core safety and comfort rule.
- Group bookings are modeled as simultaneous participant assignments.

## Findings

| Severity | Title | Evidence | Affected Area | Why It Matters | Follow-up Issue |
|---|---|---|---|---|---|
| Blocker | No staff/therapist operational data in live Supabase | `staff_profiles` and active booking staff counts are both zero. | Admin operations, booking availability | The business cannot operate daily workflows or show customer slots without configured staff. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/51 |
| High | Concurrent booking risk remains operationally unresolved | Booking insertion is not atomic and has no DB-level capacity lock. | Scheduling, customer trust, staff workload | Mobile appointments cannot safely tolerate double-booked therapists or partial booking records. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/52 |
| Medium | Customer cancellation/manage-link workflow is incomplete | Email generates a manage URL, but no matching route exists. | Cancellation/rescheduling expectations | Customers are told to use a link that cannot currently resolve. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/53 |
| Medium | UK timezone behavior is implicit | Availability and validation rely on runtime-local JavaScript `Date`. | Booking windows, minimum notice, BST | UK booking rules need consistent Europe/London behavior in production. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/54 |

## Data Flow Diagrams

### Public Booking
Service selection -> participant genders -> address/city -> `/api/availability` -> selected slot -> `/api/bookings` -> normalized Supabase rows -> email notification.

### Slot Calculation
Input date/services/genders/city -> business settings -> service visibility/duration -> active booking-eligible staff -> role permissions/overrides -> global and staff availability -> blocked dates/overrides -> existing bookings/assignments -> returned slots.

### Booking Creation
Payload validation -> participant gender derivation -> availability recheck -> service lookup -> find/create client -> insert booking -> insert participants -> insert item snapshots -> insert unassigned assignments -> send emails.

### Admin Booking Management
Admin login -> staff profile/RBAC -> booking list/detail -> management form/claim actions -> service-role update -> audit log -> revalidate admin routes.

### Assignment Claiming
Staff profile/RBAC -> load assignment -> verify unassigned -> verify required therapist gender matches staff gender -> update assignment -> recompute booking assignment status -> audit log.

## No Fixes
No operational fixes were made in Phase 1.
