-- Item 8 Phase 1a — free-travel areas + mileage origin (ADDITIVE ONLY)
--
-- `allowed_cities` stops being a gate ("who may book") and becomes the
-- free-travel zone ("where we travel at no charge"). Addresses outside it stay
-- bookable, at a fee an admin sets by hand.
--
-- ⛔ THIS DELIBERATELY DOES NOT RENAME THE COLUMN. The plan originally said
-- `alter table ... rename column allowed_cities to free_travel_cities`. That
-- was verified and rejected, for two independent reasons:
--
--   1. public.create_booking_request reads `v_settings.allowed_cities` by
--      field name. Postgres does not rewrite PL/pgSQL bodies on a rename, so
--      the ALTER succeeds silently and then every booking call -- public and
--      admin -- fails at execution time, surfacing raw Postgres error text to
--      the customer as a 400. It is the ONLY database object referencing the
--      column (functions, views, policies, triggers, indexes, constraints and
--      defaults were all swept, twice, independently).
--   2. src/lib/booking/availability.ts selects the column in a raw PostgREST
--      string. That is application code on a separate deploy cadence, and the
--      live site runs older code -- so a rename breaks the deployed booking
--      calendar no matter how atomic the migration is.
--
-- So this is expand-contract. Both columns coexist; old code keeps reading
-- `allowed_cities` and keeps seeing a correct value, because the application
-- writes BOTH until the old column goes. Phase 2 removes the city gate from
-- create_booking_request, which removes the last database reference to
-- `allowed_cities`; the DROP is then deferred to the very end of the plan,
-- after the deploy (Owner decision, 2026-08-11 -- plan section 0.0c, Step Z).
--
-- Owner-approved and applied 2026-08-11 (Zone-2, per-action approval in chat).
-- Applied version: 20260811203747. Additive only: no column dropped, no row
-- deleted, no function changed.
-- Post-apply verified: business_settings at 12 columns; free_travel_cities
-- equals allowed_cities exactly (["Luton","Dunstable"]); mileage_origin null;
-- bookings row count unchanged at 15.
--
-- Reversible with:
--   ALTER TABLE public.business_settings DROP COLUMN IF EXISTS free_travel_cities;
--   ALTER TABLE public.business_settings DROP COLUMN IF EXISTS mileage_origin;
-- Nothing reads either column until the Phase 1 application code ships, so
-- reverting before then is a no-op on behaviour.
--
-- Premise re-verified live immediately before authoring: business_settings has
-- 10 columns, none named free_travel_cities or mileage_origin; allowed_cities
-- is jsonb NOT NULL DEFAULT '[]' and holds ["Luton","Dunstable"] -- the
-- section 8.9.G reversibility snapshot.

-- The free-travel zone. Same shape and default as the column it will replace,
-- so the two are interchangeable to every reader during the transition.
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS free_travel_cities jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill, guarded so a re-run can never clobber values the application has
-- since written. Once free_travel_cities holds anything but the default, this
-- is a no-op -- which matters because the application dual-writes both columns
-- from the moment Phase 1's code ships.
UPDATE public.business_settings
   SET free_travel_cities = allowed_cities
 WHERE free_travel_cities = '[]'::jsonb;

-- Where mileage is measured from. Free-form and descriptive only -- nothing
-- computes from it, by explicit Owner decision (the fee is set by hand per
-- booking, with no distance API). Nullable with no default: there is no
-- sensible value to invent, and a blank origin must be distinguishable from a
-- chosen one.
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS mileage_origin text;
