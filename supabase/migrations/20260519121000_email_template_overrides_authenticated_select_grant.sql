-- Follow-up to 20260519120000_email_template_overrides_table.sql
-- Adds the missing GRANT SELECT to the `authenticated` role so that the
-- SELECT RLS policy can actually engage. The original migration enabled RLS
-- and added policies targeting `authenticated`, but the table-level grant was
-- never set — PostgreSQL rejects at the privilege check before RLS evaluates.
--
-- Codebase convention (verified 2026-05-19 against information_schema.role_table_grants):
-- every public table grants only SELECT to `authenticated`; mutations always
-- go through service_role from server actions, which preserves audit-log
-- writes. Matching that pattern here.
--
-- Caught by the Session 1 smoke test (`/redesign/backend-smoke-tests/
-- email-template-overrides-table-2026-05-19.txt`) — Therapist-impersonated
-- SELECT and INSERT both returned 42501 permission_denied because the table
-- grant was missing, not because RLS rejected. The INSERT/UPDATE/DELETE RLS
-- policies remain in place as defense-in-depth; no write grant is added.

grant select on public.email_template_overrides to authenticated;
