-- ⛔ BACKFILL — RECOVERED VERBATIM from production's migration ledger on
-- 2026-08-19 (gate 05, case D1). Production ALREADY HAS this migration applied
-- (version 20260510002939, name `phase18_storage_avatars_canonical_perm`). It
-- was missing from this directory; see README-MIGRATION-DRIFT.md §1. Do NOT
-- apply it to production. It exists so a rebuild from this directory reaches
-- the same state production is in.
--
-- ✅ PROVENANCE: everything below the marker is the exact text recorded in
-- `supabase_migrations.schema_migrations.statements` for this version — not a
-- reconstruction.
--
-- What it does: re-creates the four `staff-avatars` storage policies from
-- 20260509224253, changing the permission name from the Phase-8 `manage_users`
-- to the canonical `manage_staff_profiles`. The read policy is unchanged; the
-- three write policies are the point of the migration.

drop policy if exists "Active staff can read staff_avatars" on storage.objects;
drop policy if exists "Staff can insert own staff_avatar" on storage.objects;
drop policy if exists "Staff can update own staff_avatar" on storage.objects;
drop policy if exists "Staff can delete own staff_avatar" on storage.objects;

create policy "Active staff can read staff_avatars"
on storage.objects for select
to authenticated
using (
  bucket_id = 'staff-avatars'
  and app_private.current_active_staff_id() is not null
);

create policy "Staff can insert own staff_avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'staff-avatars'
  and (
    (storage.foldername(name))[1] = app_private.current_active_staff_id()::text
    or app_private.current_staff_has_permission('manage_staff_profiles')
  )
);

create policy "Staff can update own staff_avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'staff-avatars'
  and (
    (storage.foldername(name))[1] = app_private.current_active_staff_id()::text
    or app_private.current_staff_has_permission('manage_staff_profiles')
  )
)
with check (
  bucket_id = 'staff-avatars'
  and (
    (storage.foldername(name))[1] = app_private.current_active_staff_id()::text
    or app_private.current_staff_has_permission('manage_staff_profiles')
  )
);

create policy "Staff can delete own staff_avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'staff-avatars'
  and (
    (storage.foldername(name))[1] = app_private.current_active_staff_id()::text
    or app_private.current_staff_has_permission('manage_staff_profiles')
  )
);
