-- ⛔ BACKFILL — reconstructed from live introspection on 2026-08-19.
-- Production ALREADY HAS this migration applied (version 20260502165759,
-- name `restore_phase8_service_role_read_grants`). It was missing from this
-- directory; see README-MIGRATION-DRIFT.md §1. Do NOT apply it to production.
-- It exists so a rebuild from this directory reaches the same state
-- production is in.
--
-- What it creates: `usage` on schema `public` for `service_role`, plus
-- `select` on the Phase-8 read path — the tables the server-side (admin
-- client) render path reads. RBAC tables are NOT here; they arrive seven
-- minutes later in
-- `20260502170527_restore_phase8_service_role_permissions_read_grant.sql`,
-- whose very existence says this file missed them.
--
-- WHY THESE GRANTS ARE NEEDED AT ALL, and why the file says "restore":
-- pg_default_acl in this project (inspected live) gives tables created by
-- `postgres` in schema `public` only `Dxtm` for service_role — TRUNCATE,
-- REFERENCES, TRIGGER, MAINTAIN. No SELECT, no DML. Supabase's blanket
-- `grant all` default is NOT in force here; every privilege is granted
-- explicitly per table (the same reasoning is written out at length in
-- 20260804182200_c18_consent_events.sql:33-43). So the Phase-2 tables came
-- into being unreadable by the service role and each read path had to be
-- granted.
--
-- ⚠️ RECONSTRUCTION CONFIDENCE — the table list is INFERRED, not recovered.
-- The original SQL text is gone. The list below is the 14-table list from the
-- deleted `20260502183000_restore_api_role_grants.sql` (recovered from git:
-- `git show 7399841:supabase/migrations/20260502183000_restore_api_role_grants.sql`)
-- MINUS the three RBAC tables that file #2 covers. That deleted file was
-- retired on 2026-08-19 as a verified no-op — every one of its 14 grants
-- already existed in production as a DIRECT service_role entry in relacl, and
-- README-MIGRATION-DRIFT.md §2.1 concluded it was superseded by exactly this
-- migration and the next one. Splitting its list is therefore the best
-- available evidence for what the two "restore" migrations each contained.
--
-- Idempotent: GRANT is a no-op when the privilege is already held, so the
-- overlap with 20260503084016_phase16_service_role_grants.sql (which later
-- re-grants select on most of these, plus DML) is harmless in either order.

grant usage on schema public to service_role;

grant select
on
  public.business_settings,
  public.services,
  public.staff_profiles,
  public.availability_rules,
  public.blocked_dates,
  public.availability_overrides,
  public.staff_availability_rules,
  public.staff_blocked_dates,
  public.staff_availability_overrides,
  public.bookings,
  public.booking_assignments
to service_role;
