-- ⛔ BACKFILL — RECOVERED VERBATIM from production's migration ledger on
-- 2026-08-19 (gate 05, case D1). Production ALREADY HAS this migration applied
-- (version 20260509224253, name `phase8_staff_avatars_bucket`). It was missing
-- from this directory; see README-MIGRATION-DRIFT.md §1. Do NOT apply it to
-- production. It exists so a rebuild from this directory reaches the same
-- state production is in.
--
-- ✅ PROVENANCE: everything below the marker is the exact text recorded in
-- `supabase_migrations.schema_migrations.statements` for this version — not a
-- reconstruction.
--
-- ⚠️ Note for anyone auditing dead code: the `staff-avatars` bucket is
-- currently an orphan — `grep "storage.from(" src/` returns zero hits. Its
-- absence from the repo was still a rebuild defect, which is why it is here.

-- Phase 8 — Staff profile pictures (issue #123)

alter table public.staff_profiles
  add column if not exists profile_photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-avatars',
  'staff-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

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
    or app_private.current_staff_has_permission('manage_users')
  )
);

create policy "Staff can update own staff_avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'staff-avatars'
  and (
    (storage.foldername(name))[1] = app_private.current_active_staff_id()::text
    or app_private.current_staff_has_permission('manage_users')
  )
)
with check (
  bucket_id = 'staff-avatars'
  and (
    (storage.foldername(name))[1] = app_private.current_active_staff_id()::text
    or app_private.current_staff_has_permission('manage_users')
  )
);

create policy "Staff can delete own staff_avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'staff-avatars'
  and (
    (storage.foldername(name))[1] = app_private.current_active_staff_id()::text
    or app_private.current_staff_has_permission('manage_users')
  )
);
