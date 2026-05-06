# Phase 2 Frontend Booking UX Findings

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/96

## Skills Used

- Browser automation: used for live route smoke checks, booking flow execution, screenshots, console checks, and viewport checks.
- Frontend/UI/UX design audit: used to review customer lifecycle clarity, admin CRM polish, responsive behavior, and workflow fit.
- Accessibility review: used for labels, focusable controls, contrast, mobile layout, and permission-state checks.
- Security/RLS runtime QA: used for public API leakage checks, RLS behavior, and credential redaction discipline.

## Browser Routes Tested

- Public: `/`, `/home/`, `/services/`, `/about/`, `/reviews/`, `/faqs-aftercare/`
- Booking: `/?booking=1`, `/booking/manage/` without token
- Admin login/protection: `/admin/login/`, `/admin/dashboard/`

Baseline public/admin route fetches returned 200 for the public routes and login/manage pages. Unauthenticated `/admin/dashboard/` redirected to `/admin/login/?redirectTo=%2Fadmin%2Fdashboard%2F`.

Chrome DevTools MCP was initially blocked by an existing Chrome profile lock, then re-checked successfully in the completion pass. Chrome DevTools was used for live snapshots, console/network checks, viewport checks, command search, and authenticated admin workflow verification. Playwright was also used earlier for route smoke checks and viewport summaries.

## Customer Booking Flow

### Single-person booking

Status: passed with observations.

Flow tested through the public booking modal:

Service -> For -> Location -> Time -> Details -> Review -> Ready

Audit record:

- Booking: `e8941e0f-3740-4df2-87b3-cc3a36cdf98b`
- Client: `audit_phase2 Single Customer`
- Date/time: `2026-05-11 10:00`
- Status: `pending`
- Assignment status: `unassigned`
- Payment status: `unpaid`
- Participants: 1
- Booking items: 1
- Assignments: 1
- Required therapist gender: female

Customer copy was clear about:

- Gender use being for therapist matching.
- Home treatment location/access/parking notes.
- Health and safety notes not replacing a full medical intake.
- Payment in person by cash/card.
- Booking being a request until confirmed.
- Keeping the manage/cancellation link safe.

### Mixed-gender group booking

Status: passed with observations.

Audit record:

- Booking: `1c71ce80-7084-484d-8e59-8d954844f18c`
- Client: `audit_phase2 Repeat Customer`
- Date/time: `2026-05-11 11:00`
- Status: `pending`
- Assignment status after male therapist test claim: `partially_assigned`
- Participants: 2
- Booking items: 2
- Assignments: 2
- Participant genders: male and female
- Required therapist genders: male and female

The public API returned a manage URL, but the token was redacted from audit notes and was not published.

### Repeat customer behavior

Status: passed.

Created a second audit booking for the same repeat customer email:

- Booking: `dbe87449-ee7b-49c3-849c-e12a2e586a58`
- Client email: `audit_phase2_repeat@example.test`
- Result: both bookings linked to one client record.
- Booking-specific address and health notes remained separate per booking.

## Availability and Gender-Aware UX

Status: passed with privacy/product observation.

The booking UI showed matched availability only after date selection and used clear customer-facing copy:

- "These times match the therapist availability needed for your booking."
- "We only show times that match the therapist availability needed for the selected service, location and participant gender."

The public availability API returned:

- date
- slots
- duration
- required staff by gender
- available staff counts by gender

No staff IDs, staff names, auth user IDs, or assigned staff details were returned. The visible gendered capacity counts are not a direct data leak, but they should be reviewed as a small privacy/product-design consideration because they expose operational capacity shape.

## Confirmed Finding

| Severity | Title | Reproduction | Expected | Actual | Evidence | Affected Route | Follow-up Issue |
|---|---|---|---|---|---|---|---|
| High | Live public pages show placeholder image panels | Open `https://rahmatherapy.uk/` at 1440px | Production public pages show real/polished imagery | Hero and other public image sections display `PLACEHOLDER IMAGE` copy and intended asset paths | Screenshot `phase2-home-placeholders-desktop.png` | `/` | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/97 |

## Business-Fit Observations

- Booking gender questions are operationally justified and worded respectfully.
- The flow supports self, someone-else, and group booking concepts.
- Location collection includes access and parking notes, which fits mobile therapy operations.
- Payment expectations are present in the booking flow.
- Cancellation/rescheduling expectation exists through the manage-link acknowledgement, but customer policy detail should still be easier to find before submission.

No frontend code fixes were made.

## Completion Pass Addendum

Status: previously blocked browser coverage was completed.

- Chrome DevTools MCP created isolated live contexts and loaded `https://rahmatherapy.uk/`, `/admin/login/`, and authenticated owner/admin routes.
- Public homepage DevTools snapshot confirmed the existing placeholder-image finding, with no console errors during the sampled load.
- Controlled rapid booking test sent four parallel booking requests for the same slot. Two were accepted and two were rejected with `Selected appointment time is no longer available`; accepted audit bookings were one female-capacity booking and one male-capacity booking at the same time.
- A new mixed-gender group booking was created and verified through admin/staff surfaces before cleanup.
- Command search was tested via `Ctrl+K`; searching `Completion` returned permitted audit bookings and clients.
- Screenshots/snapshots were captured during the DevTools session, but only these five Markdown deliverables are retained in the findings directory to preserve the approved file cap.

Temporary public booking records from this completion pass were cleaned up. No frontend code fixes were made.
