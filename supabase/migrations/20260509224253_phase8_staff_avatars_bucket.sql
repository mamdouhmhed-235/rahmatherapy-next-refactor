-- ⛔ BACKFILL — reconstructed from live introspection on 2026-08-19.
-- Production ALREADY HAS this migration applied (version 20260509224253,
-- name `phase8_staff_avatars_bucket`). It was missing from this directory;
-- see README-MIGRATION-DRIFT.md §1. Do NOT apply it to production. It exists
-- so a rebuild from this directory reaches the same state production is in.
--
-- What it creates: the private `staff-avatars` storage bucket and the four
-- RLS policies on `storage.objects` that govern it.
--
-- Bucket settings are EXACT — read from `storage.buckets` live:
--   public            = false
--   file_size_limit   = 5242880   (5 MiB)
--   allowed_mime_types= {image/jpeg,image/png,image/webp}
--   type              = STANDARD
-- ✅ The bucket's `created_at` is 2026-05-09 22:42:53.728537+00, which matches
-- this migration's version 20260509224253 to the second. That is hard evidence
-- this file — not some later one — is what created it.
--
-- ⚠️ THE BUCKET IS CURRENTLY AN ORPHAN. `grep -rn "storage.from(" src/`
-- returns ZERO hits: no application code reads or writes it today.
-- `staff_profiles.profile_photo_path` exists (added by
-- 20260509211843_phase6_staff_profile_fields.sql) but the admin UI still falls
-- back to an icon. It is reconstructed here for schema fidelity — a rebuild
-- must reproduce production, not production-minus-the-unused-parts — not
-- because anything depends on it.
--
-- ⚠️ RECONSTRUCTION CONFIDENCE, policies. The policy NAMES, commands, roles
-- and predicates are exact as of today, read from `pg_policies` where
-- schemaname='storage'. What is INFERRED is the permission slug in the three
-- write policies. Today they read `manage_staff_profiles`; this file writes
-- the legacy `manage_staff` instead, because
-- 20260510002939_phase18_storage_avatars_canonical_perm.sql exists precisely
-- to make them canonical, and docs/production/backend-parity-audit.md:77
-- records it as a "corrective migration — admin escape-hatch uses canonical
-- manage_staff_profiles". `manage_staff` was retired as a legacy alias by
-- 20260509143000_granular_rbac_consolidation.sql:168-169 and is NOT a row in
-- public.permissions today, so under this file alone the escape hatch is
-- inert and only the owning-staff branch works — which is exactly the defect
-- the Phase 18 file corrects. Writing the canonical slug here instead would
-- reach the same end state but would render the Phase 18 migration a
-- meaningless no-op, hiding why it was written.
--
-- ⛔ Do NOT "simplify" by folding the Phase 18 file into this one. The two
-- versions ran twenty minutes apart in production and both are recorded in
-- schema_migrations.
--
-- Idempotent: `on conflict do nothing` on the bucket, `drop policy if exists`
-- before each policy.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-avatars',
  'staff-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Read: any active staff member may read any avatar. Avatars are shown on
-- admin staff lists, so scoping reads to the owner would break those lists.
drop policy if exists "Active staff can read staff_avatars" on storage.objects;
create policy "Active staff can read staff_avatars"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'staff-avatars'
    and app_private.current_active_staff_id() is not null
  );

-- Write: the first path segment must be the caller's own staff id, so
-- `<staff_id>/<file>` is the object-key convention. The permission branch is
-- the admin escape hatch (see the confidence note above).
drop policy if exists "Staff can insert own staff_avatar" on storage.objects;
create policy "Staff can insert own staff_avatar"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'staff-avatars'
    and (
      (storage.foldername(name))[1] = (app_private.current_active_staff_id())::text
      or app_private.current_staff_has_permission('manage_staff')
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
      or app_private.current_staff_has_permission('manage_staff')
    )
  )
  with check (
    bucket_id = 'staff-avatars'
    and (
      (storage.foldername(name))[1] = (app_private.current_active_staff_id())::text
      or app_private.current_staff_has_permission('manage_staff')
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
      or app_private.current_staff_has_permission('manage_staff')
    )
  );
