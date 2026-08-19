-- ⛔ BACKFILL — reconstructed from live introspection on 2026-08-19.
-- Production ALREADY HAS this migration applied (version 20260502170527,
-- name `restore_phase8_service_role_permissions_read_grant`). It was missing
-- from this directory; see README-MIGRATION-DRIFT.md §1. Do NOT apply it to
-- production. It exists so a rebuild from this directory reaches the same
-- state production is in.
--
-- What it creates: `select` for `service_role` on the three RBAC tables the
-- permission resolver reads. This ran seven minutes after
-- `20260502165759_restore_phase8_service_role_read_grants.sql` and its name
-- names one thing — the permissions read — which is how we read it: the
-- first restore covered the booking/availability/settings read path and
-- missed the RBAC tables, so a second migration went out immediately behind
-- it. `public.roles` is deliberately NOT here; it is first granted later, by
-- 20260503084016_phase16_service_role_grants.sql.
--
-- ⚠️ RECONSTRUCTION CONFIDENCE — INFERRED, not recovered. The original SQL
-- text is gone. Evidence: the deleted `20260502183000_restore_api_role_grants.sql`
-- (recovered via `git show 7399841:…`) granted select on 14 tables including
-- exactly these three, and README-MIGRATION-DRIFT.md §2.1 recorded it as
-- superseded by this migration and its predecessor. The union of the two
-- backfilled files reproduces that 14-table list; the split between them is
-- the inference.
--
-- Idempotent: GRANT is a no-op when the privilege is already held.

grant select
on
  public.permissions,
  public.role_permissions,
  public.staff_permission_overrides
to service_role;
