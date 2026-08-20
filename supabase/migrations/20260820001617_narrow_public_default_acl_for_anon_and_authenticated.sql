-- Issue 7 -- `anon` could TRUNCATE ten tables, including client_notes.
--
-- THE DEFECT
--   The `public` schema's default ACL for tables created by `postgres` was:
--     {postgres=arwdDxtm, anon=Dxtm, authenticated=Dxtm, service_role=Dxtm}
--   Dxtm = TRUNCATE, REFERENCES, TRIGGER, MAINTAIN. So every new table handed
--   anon and authenticated the destructive privileges and withheld the useful
--   ones. Ten tables had inherited it: client_notes, client_privacy_requests,
--   consent_events, email_delivery_events, email_template_overrides, enquiries,
--   insight_dismissals, notification_state, operational_events,
--   recurring_booking_templates.
--
-- ⛔ NOT AN INCIDENT -- THIS IS HARDENING. Verified independently: PostgREST has
--   no TRUNCATE verb, and `anon` can EXECUTE only three functions in public
--   (bookings_set_completed_at, clear_account_password_request_payload,
--   update_updated_at_column), all trigger functions that cannot be usefully
--   called directly. Nothing could reach it. The reason to fix it is that the
--   default RE-ARMS on every new table.
--
-- WHAT THIS DOES NOT DO, and why
--   ⛔ It does NOT grant service_role DML by default. An earlier draft did, and
--      adversarial review rejected it with evidence: this project grants
--      per-table on purpose. 20260804182200_c18_consent_events.sql:34-36 states
--      "privileges are granted EXPLICITLY PER TABLE", and :63-64 withholds
--      SELECT on consent_events deliberately ("The route writes and never
--      reads"). A blanket default would have turned those restrictive grants
--      into no-ops for every future table, with no test able to notice.
--      Measured: service_role keeps `Dxtm` on a new table here, exactly as
--      today, so consent_events-style least privilege still works.
--   ⛔ It does NOT touch the `supabase_admin` default ACL for schema public,
--      which grants anon/authenticated/service_role arwdDxtm. Attempting it
--      fails with 42501 "permission denied to change default privileges" --
--      that role is Supabase-owned. It currently governs ZERO tables (all 30
--      are owned by postgres). Recorded as residual risk, not fixed here.
--   ⛔ It does NOT use `revoke all` in the loop. Measured: that takes anon's
--      SELECT on public.services from 1 to 0 and authenticated's SELECT from 24
--      to 0 -- a full outage of the public service list and every admin read.
--      The four named privileges are exactly the Dxtm set and nothing else.
--   ⛔ It does NOT revoke TRUNCATE from service_role. Nothing in src/, scripts/,
--      e2e/ or any migration truncates a table (every grep hit was CSS
--      text-truncation), and service_role is the break-glass role.
--
-- SEQUENCES: the sibling default granted anon and authenticated `w` (UPDATE =
-- nextval/setval) on every future sequence. There are currently ZERO sequences
-- in public -- ids are gen_random_uuid() -- so there is nothing to revoke on
-- existing objects, but the default is closed here so the hole cannot open.
--
-- MEASURED IN A ROLLED-BACK TRANSACTION BEFORE APPLYING, all 30 tables:
--   anon          SELECT 1 (services, unchanged) | TRUNCATE/REFERENCES/TRIGGER/
--                 MAINTAIN/INSERT/UPDATE/DELETE all 0
--   authenticated SELECT 24 (unchanged) | INSERT 1 (unchanged) | UPDATE 1
--                 (unchanged) | TRUNCATE/REFERENCES/TRIGGER/MAINTAIN all 0
--   service_role  unchanged
--   new table     relacl {postgres=arwdDxtm, service_role=Dxtm}
--   controls held: anon SELECT services true; authenticated INSERT
--                  account_password_requests true; authenticated SELECT
--                  client_notes false; service_role INSERT consent_events true
--                  and SELECT consent_events FALSE (least privilege intact).
--
-- REBUILD NOTE: on a replay this file's DO loop covers every table that exists
-- when it runs, and the ALTER DEFAULT PRIVILEGES half covers every table created
-- after it. Together they are complete wherever this sits in the sequence.
-- public currently holds only ordinary tables -- no views, materialised views or
-- partitioned tables -- so relkind='r' is complete today. If a partitioned table
-- is ever added, widen the filter.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

do $$
declare r record;
begin
  for r in
    select c.oid::regclass as t
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('revoke truncate, references, trigger, maintain on %s from anon, authenticated', r.t);
  end loop;
end $$;
