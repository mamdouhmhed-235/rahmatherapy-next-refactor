-- C-11 Phase E Step 10 — per-user admin theme preference.
--
-- Applied to production project twzutkfgqclqurvkmvqz on 2026-07-31 under
-- explicit Owner approval in chat (protocol §1 rule 2, Zone-2 HARD-STOP).
-- Remote version: 20260731095039.
--
-- Purely additive: one nullable text column + a CHECK constraint, both
-- idempotent. No backfill. NULL means "use the app default" (dark), so all
-- 12 pre-existing staff rows are unaffected until a user toggles.
--
-- Rollback (plan §5.2) — loses stored preferences only:
--   ALTER TABLE public.staff_profiles
--     DROP CONSTRAINT IF EXISTS staff_profiles_theme_preference_check;
--   ALTER TABLE public.staff_profiles DROP COLUMN IF EXISTS theme_preference;

ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS theme_preference text;

ALTER TABLE public.staff_profiles
  DROP CONSTRAINT IF EXISTS staff_profiles_theme_preference_check;

ALTER TABLE public.staff_profiles
  ADD CONSTRAINT staff_profiles_theme_preference_check
  CHECK (theme_preference IS NULL OR theme_preference IN ('dark', 'light', 'system'));
