-- ⛔ BACKFILL — RECOVERED VERBATIM from production's migration ledger on
-- 2026-08-19 (gate 05, case D1). Production ALREADY HAS this migration applied
-- (version 20260502165759, name `restore_phase8_service_role_read_grants`).
-- It was missing from this directory; see README-MIGRATION-DRIFT.md §1.
-- Do NOT apply it to production. It exists so a rebuild from this directory
-- reaches the same state production is in.
--
-- ✅ PROVENANCE: the SQL below is the exact text recorded in
-- `supabase_migrations.schema_migrations.statements` for this version — not a
-- reconstruction. Read read-only via `execute_sql`. An earlier backfill
-- (commit 0c27077) inferred the table list from a deleted sibling migration
-- and split it wrongly: it omitted `role_permissions` and
-- `staff_permission_overrides` from this file and put them in
-- 20260502170527 instead. The union of the two files was right, so the end
-- state was right, but neither file was. This is the recorded original.

grant usage on schema public to service_role;

grant select
on
  public.business_settings,
  public.services,
  public.staff_profiles,
  public.role_permissions,
  public.staff_permission_overrides,
  public.availability_rules,
  public.blocked_dates,
  public.availability_overrides,
  public.staff_availability_rules,
  public.staff_blocked_dates,
  public.staff_availability_overrides,
  public.bookings,
  public.booking_assignments
to service_role;
