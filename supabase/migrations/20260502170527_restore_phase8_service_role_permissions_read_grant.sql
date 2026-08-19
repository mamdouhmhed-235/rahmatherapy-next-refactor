-- ⛔ BACKFILL — RECOVERED VERBATIM from production's migration ledger on
-- 2026-08-19 (gate 05, case D1). Production ALREADY HAS this migration applied
-- (version 20260502170527, name
-- `restore_phase8_service_role_permissions_read_grant`). It was missing from
-- this directory; see README-MIGRATION-DRIFT.md §1. Do NOT apply it to
-- production. It exists so a rebuild from this directory reaches the same
-- state production is in.
--
-- ✅ PROVENANCE: the single statement below is the exact text recorded in
-- `supabase_migrations.schema_migrations.statements` for this version — not a
-- reconstruction. The file name is literal: this migration grants the
-- *permissions* read and nothing else. An earlier backfill (commit 0c27077)
-- inferred three tables here; the recorded original has one. `role_permissions`
-- and `staff_permission_overrides` belong to 20260502165759, which is where
-- production actually granted them.

grant select on public.permissions to service_role;
