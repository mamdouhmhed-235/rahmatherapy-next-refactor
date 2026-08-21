-- ⛔ REBUILD REPAIR — restores three things that exist in PRODUCTION but were
-- never written as a migration, so a rebuild from this directory produced a
-- DIFFERENT permission system. Found 2026-08-21 by the first real rebuild test
-- (a throwaway Supabase project, all 81 files replayed from empty).
--
-- ⛔ DO NOT APPLY TO PRODUCTION. Production already holds every row below. Every
-- statement is ON CONFLICT DO NOTHING, so applying it would be a no-op, but its
-- version stamp is older than the last applied migration and `supabase db push`
-- would flag it as out of order. It exists so a REBUILD lands where production is.
--
--
-- WHAT WAS MISSING, AND HOW IT WAS PROVEN
--
-- A rebuild produced 38 permissions and 89 role_permissions where production has
-- 40 and 95. `20260820075446_rebuild_self_check.sql` caught it and aborted:
--
--     permissions expected 40 got 38; role_permissions expected 95 got 89;
--
-- ⚠️ Nothing errored before that point. The grants simply vanished: the
-- role_bundle in 20260509143000_granular_rbac_consolidation.sql joins
-- `public.permissions p on p.name = rb.permission_name`, and a name that does not
-- exist matches no row and inserts nothing. A SILENT loss.
--
-- ⛔ THE BUSINESS CONSEQUENCE. `claim_assignments` is the permission a therapist
-- needs to CLAIM A BOOKING. Owner, Admin and Therapist all lost it. A rebuilt
-- system would look completely normal and no therapist could take any work.
-- `manage_audit_logs` is what lets anyone read the audit trail; Owner and Admin
-- lost that.
--
--
-- WHY NO MIGRATION EVER CREATED THEM — measured, not assumed
--
-- public.permissions.created_at for both rows is 2026-05-02 06:08:03.636748+00.
-- The migration ledger has NOTHING between 20260502052558 (05:25:58) and
-- 20260502122835 (12:28:35). So the rows were inserted by hand — SQL editor or
-- dashboard — and never captured as a file. The same is true of the Therapist's
-- `resend_booking_emails` grant: the permission itself comes from
-- granular_rbac_consolidation, but that migration's Therapist bundle does not
-- include it, and production has it.
--
-- ⚠️ THE GENERAL LESSON, which outlives this file: the live database has been
-- edited by hand in ways the migrations do not record. That is the root cause of
-- the divergence, not any single file.
--
--
-- WHY THIS FILE IS DATED 20260820075000
--
-- It must run BEFORE 20260820075446_rebuild_self_check.sql, which counts
-- permissions and grants and aborts the rebuild if they are wrong. It must also
-- run AFTER 20260509143000_granular_rbac_consolidation.sql, whose
-- `delete from public.role_permissions ... where r.name in (...)` clears the
-- grant table for all five roles before re-seeding it from its own bundle —
-- anything inserted earlier would be wiped. This slot satisfies both.
--
-- Metadata below is copied from the live rows, so the rebuilt permissions table
-- matches production column for column, not just by name.

insert into public.permissions (name, description, category, scope, risk_level, is_system, active)
values
  ('claim_assignments', 'Claim unassigned booking assignments',
   'bookings', 'operational', 'standard', true, true),
  ('manage_audit_logs', 'View and export audit logs',
   'audit', 'operational', 'high', true, true)
on conflict (name) do nothing;

-- claim_assignments -> Owner, Admin, Therapist
-- manage_audit_logs -> Owner, Admin
-- resend_booking_emails -> Therapist  (the permission exists; only this grant was missing)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on true
where (r.name in ('Owner', 'Admin', 'Therapist') and p.name = 'claim_assignments')
   or (r.name in ('Owner', 'Admin')              and p.name = 'manage_audit_logs')
   or (r.name = 'Therapist'                      and p.name = 'resend_booking_emails')
on conflict (role_id, permission_id) do nothing;

-- ---------------------------------------------------------------------------
-- PART 2 — pin the table privileges that a PLATFORM DEFAULT used to supply.
--
-- ⚠️ NOT a fault in this repo, and not a live exposure. Supabase changed the
-- default privileges granted to new tables between 2026-05-01 (when the live
-- project was created) and 2026-08-21. On a project created today, every table
-- created after those defaults took effect is born with anon, authenticated and
-- service_role holding full DML. The live database never had that, so the
-- migrations never needed to say otherwise.
--
-- Measured on the rebuild: anon held SELECT, INSERT, UPDATE and DELETE on ten
-- tables including public.client_notes -- the health notes. ⛔ Probed directly
-- as anon on the throwaway: INSERT into client_notes was REFUSED (42501),
-- INSERT into enquiries REFUSED (42501), SELECT client_notes returned 0 rows.
-- RLS held on every path, so nothing was reachable. What was lost is the second
-- layer, not the first.
--
-- This block states the intended end state explicitly, so the rebuilt database
-- matches production regardless of what the platform grants by default. Values
-- below were read from the live database, not chosen.
-- ---------------------------------------------------------------------------

revoke all on
  public.client_notes,
  public.client_privacy_requests,
  public.consent_events,
  public.email_delivery_events,
  public.email_template_overrides,
  public.enquiries,
  public.insight_dismissals,
  public.notification_state,
  public.operational_events,
  public.recurring_booking_templates
from anon, authenticated;

-- The four SELECTs production does grant to authenticated.
grant select on public.email_delivery_events        to authenticated;
grant select on public.email_template_overrides     to authenticated;
grant select on public.operational_events           to authenticated;
grant select on public.recurring_booking_templates  to authenticated;

-- consent_events is write-only for the app by design: it records a choice and
-- never reads it back. Production holds INSERT/REFERENCES/TRIGGER/TRUNCATE only.
revoke select, update, delete on public.consent_events from service_role;

-- insight_dismissals is insert-or-delete; production grants no UPDATE.
revoke update on public.insight_dismissals from service_role;
