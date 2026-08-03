-- C-03 Phase A Step 1 — enquiries.converted_booking_id partial index
--
-- Protects the Origin-panel reverse lookup on the booking detail page
-- (`.eq("converted_booking_id", booking.id)`), which C-03 Step 12 adds.
-- Partial because only converted enquiries carry the link; today that is
-- zero rows of three, so the index costs nothing and exists for volume.
--
-- Owner-approved and applied 2026-08-03 (Zone-2, per-action approval in chat).
-- Applied version: 20260803053525. Additive, idempotent, no data modified.
-- Reversible with: DROP INDEX IF EXISTS public.idx_enquiries_converted_booking;
--
-- Ledger premise re-verified live immediately before applying: `enquiries`
-- carried four indexes (pkey, client_id, first_contacted_at, status_created)
-- and none referenced converted_booking_id — so the plan's conditional
-- resolved to APPLY, unchanged from the 2026-07-25 snapshot.

CREATE INDEX IF NOT EXISTS idx_enquiries_converted_booking
  ON public.enquiries (converted_booking_id)
  WHERE converted_booking_id IS NOT NULL;
