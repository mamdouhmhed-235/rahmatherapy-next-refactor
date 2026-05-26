# Per-page scope: bookings

Page: `/admin/bookings`
Brief: `redesign/briefs/bookings-brief.md`
Approved: 2026-05-14

## Files to edit

- src/app/admin/bookings/page.tsx
- src/app/admin/components/admin-scalable-lists.tsx
- src/app/admin/bookings/BookingsChrome.tsx (new — client island for tabs + SavedViews + mobile Refine sheet)
- src/app/admin/bookings/BookingRowActions.tsx (new — client island for per-row quick-action menu + ConfirmActionModal for Cancel)

## Files to NEVER touch

- src/app/admin/bookings/actions.ts — server actions (`quickUpdateBooking`, `claimBookingAssignment`, `updateBookingAssignment`); brief untouchable
- src/app/admin/bookings/access.ts — booking scope helpers (`canManageBookings`, `canManageAllBookings`, `canClaimAssignments`, `isOwnBooking`, `hasClaimableAssignment`); brief untouchable
- src/app/admin/bookings/format.ts — `formatDate`, `formatTime`, `formatLabel`, `formatMoney`; brief untouchable
- src/app/admin/bookings/types.ts — booking record types; brief implicit (data contract)
- src/app/admin/bookings/assignment-eligibility.ts — assignment rules
- src/app/admin/bookings/*.test.ts — tests must continue passing unmodified
- src/app/admin/bookings/BookingActionButton.tsx — fires `quickUpdateBooking`; consumed unchanged
- src/app/admin/bookings/ClaimAssignmentButton.tsx — fires `claimBookingAssignment`; consumed unchanged
- src/app/admin/bookings/CopyButton.tsx — phone/email copy affordance; consumed unchanged
- src/app/admin/bookings/AssignmentManager.tsx — detail-page assignment UI; not used on list
- src/app/admin/bookings/BookingManagementForm.tsx — detail-page form; not used on list
- src/lib/auth/** — RBAC (RECON §5)
- src/lib/supabase/** — Supabase clients (RECON §5)
- src/middleware.ts — auth middleware (RECON §5)
- supabase/migrations/** — schema (brief untouchable)
- All build/config files — next.config.ts, tsconfig.json, package.json, tailwind.config.* (brief untouchable)

## Feature preservation manifest (must survive)

Filter `name` attributes (no rename):
`view`, `search`, `from`, `to`, `status`, `assignment_status`, `payment_status`, `required_gender`, `service`, `location`, `assigned_staff`

Server actions that must keep firing:
- `quickUpdateBooking` (Confirm / Mark paid / Cancel / Complete)
- `claimBookingAssignment`
- `updateBookingAssignment`

Audit log writes that must keep firing:
`booking_quick_confirm`, `booking_quick_mark_paid`, `booking_quick_cancel`, `booking_quick_complete`, `booking_assignment_claimed`, `booking_assignment_unassigned`, `booking_assignment_reassigned`

External link contract:
Google Maps deep-link `https://www.google.com/maps/search/?api=1&query=${address}` must remain a `target="_blank"` anchor — never a POST.

URL deep-link contract:
All filter params serialise to URL; `/admin/bookings?view=claimable` and `/admin/bookings?view=needs-attention` resolve.
