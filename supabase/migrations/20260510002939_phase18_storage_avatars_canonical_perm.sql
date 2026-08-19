-- ⛔ BACKFILL — reconstructed from live introspection on 2026-08-19.
-- Production ALREADY HAS this migration applied (version 20260510002939,
-- name `phase18_storage_avatars_canonical_perm`). It was missing from this
-- directory; see README-MIGRATION-DRIFT.md §1. Do NOT apply it to production.
-- It exists so a rebuild from this directory reaches the same state
-- production is in.
--
-- What it creates: the three WRITE policies on the `staff-avatars` bucket,
-- re-created so the admin escape hatch tests the CANONICAL permission slug
-- `manage_staff_profiles` instead of the retired legacy slug `manage_staff`.
--
-- WHY. 20260509143000_granular_rbac_consolidation.sql retired `manage_staff`
-- and `manage_users` as legacy aliases (lines 166-169) in favour of
-- `manage_staff_profiles`. `manage_staff` is not a row in public.permissions
-- today — verified live — so `current_staff_has_permission('manage_staff')`
-- returns false for everyone and the escape hatch in the bucket policies was
-- dead: an operator with manage_staff_profiles could not replace another
-- staff member's avatar, only their own. docs/production/backend-parity-audit.md:77
-- and docs/production/production-readiness-checklist.md:33 both record this
-- file as the corrective migration.
--
-- The SELECT policy is deliberately untouched — it carries no permission
-- reference, only `current_active_staff_id() is not null`.
--
-- The predicates below are EXACT: read from `pg_policies` where
-- schemaname='storage' on 2026-08-19. What is inferred is only that this file
-- (rather than the bucket file) is where the canonical slug arrived; see the
-- confidence note in 20260509224253_phase8_staff_avatars_bucket.sql.
--
-- Idempotent: `drop policy if exists` before each create, so this is safe to
-- re-run and safe whichever slug the previous file left behind.

drop policy if exists "Staff can insert own staff_avatar" on storage.objects;
create policy "Staff can insert own staff_avatar"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'staff-avatars'
    and (
      (storage.foldername(name))[1] = (app_private.current_active_staff_id())::text
      or app_private.current_staff_has_permission('manage_staff_profiles')
    )
  );

drop policy if exists "Staff can update own staff_avatar" on storage.objects;
create policy "Staff can update own staff_avatar"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'staff-avatars'
    and (
      (storage.foldername(name))[1] = (app_private.current_active_staff_id())::text
      or app_private.current_staff_has_permission('manage_staff_profiles')
    )
  )
  with check (
    bucket_id = 'staff-avatars'
    and (
      (storage.foldername(name))[1] = (app_private.current_active_staff_id())::text
      or app_private.current_staff_has_permission('manage_staff_profiles')
    )
  );

drop policy if exists "Staff can delete own staff_avatar" on storage.objects;
create policy "Staff can delete own staff_avatar"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'staff-avatars'
    and (
      (storage.foldername(name))[1] = (app_private.current_active_staff_id())::text
      or app_private.current_staff_has_permission('manage_staff_profiles')
    )
  );
