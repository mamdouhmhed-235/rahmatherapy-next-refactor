-- Item 8 Phase 3 - the per-booking travel charge.
--
-- An admin sets this by hand when an address falls outside the free-travel
-- areas (Owner decision, plan 8.1: no distance API, no automated calculation,
-- admin discretion is the boundary).
--
-- numeric(10,2) deliberately matches total_price rather than amount_due's
-- unscaled convention. Verified live before writing this: total_price is
-- numeric(10,2), while amount_due and amount_paid are bare numeric with NO
-- scale constraint. That unscaled convention is a pre-existing gap, not a
-- pattern worth propagating -- and it is precisely why the application folds
-- this fee in as an integer-pence delta rather than by float arithmetic:
-- total_price would be rounded on write by its own scale, amount_due would
-- not, and the two could silently diverge by a fraction of a penny.
--
-- The column is retained on the row so the UI and emails can print a labelled
-- line. It is NOT the number any balance or revenue calculation reads -- the
-- fee is folded into total_price and amount_due at write time, which is what
-- makes all 17 existing readers of those columns correct with no code change.
--
-- Purely additive: not null default 0, so no existing row is rewritten and no
-- existing total changes. Rollback is a clean drop with no data loss:
--   alter table public.bookings drop column travel_fee;

alter table public.bookings
  add column travel_fee numeric(10,2) not null default 0;
