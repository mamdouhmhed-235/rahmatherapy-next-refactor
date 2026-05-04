# Reporting Metric Definitions

These definitions must be used by future dashboard, report, and CSV export work. Calculations should run server-side or database-side and must be permission-scoped before data reaches the browser.

## Revenue Metrics

| Metric | Definition |
| --- | --- |
| `booked_revenue` | Sum of `bookings.total_price` for bookings created in the selected period, regardless of payment collection. |
| `expected_revenue` | Sum of `amount_due - amount_paid` for pending or confirmed upcoming bookings that are not cancelled or no-show. |
| `collected_revenue` | Sum of `bookings.amount_paid` where `paid_at` falls in the selected period. |
| `outstanding_revenue` | Sum of `greatest(amount_due - amount_paid, 0)` for unpaid or partially paid bookings. |
| `completed_revenue` | Sum of paid value for completed bookings. Use `amount_paid` where present; fall back to `total_price` only for legacy rows with no amount fields. |
| `cancelled_revenue` | Sum of booking value for cancelled bookings, tracked separately as lost or excluded from collected totals. |
| `no_show_revenue` | Sum of booking value for no-show bookings, tracked separately from collected totals. |

## Client And Customer Metrics

| Metric | Definition |
| --- | --- |
| `total_clients` | Count of all rows in `clients`. |
| `new_clients` | Count of `clients` created in the selected period. |
| `repeat_clients` | Count of clients with more than one linked booking. |
| `active_clients` | Count of distinct clients with at least one booking in the selected period. |
| `upcoming_clients` | Count of distinct clients with a future pending or confirmed booking. |
| `manual_clients` | Count of clients created manually by admin. This requires a future explicit client source field. |
| `website_clients` | Count of clients first created through public booking. Until client source exists, infer cautiously from linked website bookings. |
| `participant_count` | Count of rows in `booking_participants`; this is separate from client profile count. |

## Source And Attribution Rules

- Booking source reports use `bookings.booking_source`.
- Lead/enquiry source reports must use the future enquiry source field, not `booking_source`.
- Booking-level revenue belongs to the business total.
- Staff workload and staff revenue are separate metrics.
- Staff workload can count assignments, participants, booking items, duration, or completed visits depending on the report.
- Staff revenue attribution must not assign the full group booking total to every therapist.
- Staff revenue should be attributed by booking item or participant assignment. For v1 reports, use `booking_items.service_price_snapshot` joined to each participant's assignment.
- Owner/super-admin universal totals can include all clients, bookings, staff, services, sources, and revenue.
- Therapist-scoped totals can include only own assigned/completed workload and own attributed revenue if the role matrix permits it.
- Default exports must exclude health notes, treatment notes, admin notes, consent details, and raw audit payloads.

## Group Booking Rule

For a booking with two participants and two therapists, business revenue is the booking total once. Staff revenue attribution is split by the service snapshots attached to each participant, not duplicated as the full booking total for each therapist.
