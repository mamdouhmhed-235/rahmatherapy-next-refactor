-- F10 (2026-08-17) — restore the EXECUTE grants on create_recurring_booking_series.
--
-- WHAT HAPPENED
-- `20260802122636_c02_recurring_bookings.sql:936-940` deliberately locked both
-- recurring-series functions down:
--
--   REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated;
--   GRANT  EXECUTE ON FUNCTION ... TO service_role;
--
-- `20260812010100_item8_phase4_series_fn_travel_fee.sql:92` then had to CHANGE
-- THE SIGNATURE of `create_recurring_booking_series` to add `p_travel_fee`. A
-- signature change cannot be done with CREATE OR REPLACE, so that migration
-- DROPs and recreates the function — and it contains no GRANT or REVOKE of any
-- kind.
--
-- ⛔ Postgres discards all privileges when a function is dropped, and a newly
-- created function defaults to EXECUTE for PUBLIC. So since that migration,
-- `anon` and `authenticated` have held EXECUTE on it.
--
-- WHY THIS IS NOT AN EMERGENCY
-- The function's own body still refuses any caller whose role is not
-- `service_role`, raising 42501. That guard survived because the phase-4
-- migration rewrites the live function's source in place rather than retyping
-- it. So the outer lock was lost while the inner one held — defence in depth
-- reduced to a single layer, not an open door. A live probe confirmed the guard
-- holds.
--
-- WHY FIX IT ANYWAY
--   1. Defence in depth is the point. One remaining guard is not two.
--   2. It generates Supabase advisor findings until corrected.
--   3. The next person to edit that function body could remove the internal
--      check without realising it is now the ONLY thing protecting the function.
--
-- ⚠️ `compute_occurrence_dates` was NOT dropped by the phase-4 migration, so its
-- grants are intact. It is re-stated here anyway: REVOKE from a role holding
-- nothing is a no-op, and stating both keeps this file a complete description of
-- the intended end state rather than a diff someone has to reconstruct.
--
-- IDEMPOTENT. Safe to re-run.

REVOKE ALL ON FUNCTION public.compute_occurrence_dates FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_occurrence_dates TO service_role;

REVOKE ALL ON FUNCTION public.create_recurring_booking_series FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_recurring_booking_series TO service_role;

-- Verification: after applying, neither function should list anon or
-- authenticated in its ACL.
--
--   select p.proname, p.proacl
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('compute_occurrence_dates',
--                       'create_recurring_booking_series');
