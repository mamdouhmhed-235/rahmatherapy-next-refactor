# Per-Page Scope Contract — booking-detail

Phase 6 Step 8 diffs actual changes against this file. Anything edited outside the "Files to edit" list is scope creep.

## Files to edit

- src/app/admin/bookings/[bookingId]/page.tsx
- src/app/admin/bookings/BookingManagementForm.tsx
- src/app/admin/bookings/AssignmentManager.tsx
- src/app/admin/bookings/ClaimAssignmentButton.tsx
- src/app/admin/bookings/BookingActionButton.tsx
- src/app/admin/bookings/[bookingId]/BookingCreatedToast.tsx (new — sessionStorage toast consumer for booking-new handoff)
- src/app/admin/bookings/[bookingId]/BookingDetailSidebar.tsx (new — extracted sidebar: summary, client, address)

## Files to NEVER touch

- src/app/admin/bookings/actions.ts — server actions (updateBookingManagement, quickUpdateBooking, claimBookingAssignment, updateBookingAssignment, updateOwnAssignmentStatus) are the contract surface
- src/app/admin/bookings/access.ts — scope helpers, behaviour-locked
- src/app/admin/bookings/access.test.ts — test for above
- src/app/admin/bookings/format.ts — date/money/label formatters (shared contract)
- src/app/admin/bookings/types.ts — type definitions (shared)
- src/app/admin/bookings/assignment-eligibility.ts — gender/service eligibility logic
- src/app/admin/bookings/assignment-eligibility.test.ts — test for above
- src/lib/auth/** — standard untouchable (RECON §5)
- src/lib/supabase/** — standard untouchable (RECON §5)
- src/middleware.ts — standard untouchable (RECON §5)
- supabase/migrations/** — backend schema
