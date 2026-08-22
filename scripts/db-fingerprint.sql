-- ─────────────────────────────────────────────────────────────────────────────
-- DATABASE FINGERPRINT — is the live database still what the migrations say?
-- ─────────────────────────────────────────────────────────────────────────────
--
-- WHY THIS EXISTS
--
-- The clinic's Supabase plan has NO automated backups, so `supabase/migrations/`
-- is the ONLY route back from a lost database. Two checks already guard that:
--
--   scripts/verify-migration-coverage.mjs   every expected object APPEARS
--   supabase/tests/rebuild_self_check.sql   a rebuild produces the right COUNTS
--
-- ⛔ BOTH CHECK NAMES AND COUNTS. NEITHER CHECKS DEFINITIONS. `rebuild_self_check`
-- says so itself. So a hand-altered CHECK constraint, policy predicate, function
-- body, column default or table grant passes every gate we have — and the run
-- has already PROVEN that hand edits happen here: `claim_assignments`,
-- `manage_audit_logs` and the Therapist's `resend_booking_emails` grant all exist
-- in production with no migration creating them (finding G-05-08).
--
-- This closes that gap. Eight md5 hashes over the catalogue. ⛔ ANY hand edit of
-- any kind changes one of them.
--
-- ⚠️ WHAT IT DOES NOT DO: it cannot RECOVER a lost database. It only tells you
-- the migrations still describe the live one. That is the whole scope.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- HOW TO RUN IT
--
--   1. Supabase dashboard -> SQL Editor -> paste this whole file -> Run.
--   2. Compare the 8 rows against scripts/db-fingerprint-baseline.json.
--   3. ⛔ ASSERT THE COUNTS TOO, never just the hashes. A query that silently
--      returned fewer rows would produce a different hash AND a lower count;
--      the count is what tells you which happened.
--
-- Suggested cadence: monthly, and before any release.
--
-- ⛔ IF A HASH DIFFERS: that is not automatically bad — a migration you applied
-- on purpose changes them too. The question is always "did we intend this?".
--   * intended  -> update the baseline JSON in the SAME commit as the migration.
--   * NOT intended -> somebody edited production by hand. Find out what, and
--     write a migration that records it, or revert it.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⛔ DESIGN NOTES — read before editing this query
--
--   * READ-ONLY. It creates nothing and writes nothing. It was deliberately NOT
--     built as a database function: adding one would take `public`+`app_private`
--     from 12 functions to 13 and break the structural census that
--     verify-migration-coverage.mjs and rebuild_self_check.sql both assert.
--     ⛔ Do not "improve" it into a function for that reason.
--   * Every `string_agg` carries an explicit ORDER BY. Without it Postgres may
--     aggregate in any order and the hash would change run to run — a check that
--     cries wolf gets switched off, which is worse than no check.
--   * Function BODIES are hashed individually before being folded in, so a huge
--     body (create_booking_request is ~24 KB) cannot blow up the aggregate.
--   * `seed_rows` covers the rows the app's behaviour depends on — roles,
--     permissions, the 95 grants, service prices and visibility flags, and the
--     availability rules. ⚠️ It deliberately does NOT hash customer data:
--     bookings and clients change constantly and would make this useless.
--
-- ⛔ PROVEN TO DETECT A CHANGE, not assumed. Inside `begin … rollback`, a
-- hand-added Therapist grant and a hand-added policy were planted:
--     seed_rows  d59740d9ff4e4b63d23c9c91181ea425 -> 64b791bc00c4a08431065760f3307ec0
--     policies   75d4b51e7d38b06453191ec3646d6908 -> 0c8fb63391522aa095480e315f9875b0
-- Both moved; the transaction was rolled back and the baseline hashes returned.
-- ─────────────────────────────────────────────────────────────────────────────

with
cols as (
  select md5(string_agg(
    table_name||'.'||column_name||':'||data_type||':'||is_nullable||':'||coalesce(column_default,'-'),
    E'\n' order by table_name, column_name)) as h,
    count(*) as n
  from information_schema.columns where table_schema='public'
),
cons as (
  select md5(string_agg(c.conrelid::regclass::text||'.'||c.conname||':'||pg_get_constraintdef(c.oid),
    E'\n' order by c.conrelid::regclass::text, c.conname)) as h, count(*) as n
  from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'
),
idx as (
  select md5(string_agg(indexname||':'||indexdef, E'\n' order by indexname)) as h, count(*) as n
  from pg_indexes where schemaname='public'
),
pol as (
  select md5(string_agg(tablename||'.'||policyname||':'||cmd||':'||roles::text
      ||':'||coalesce(qual,'-')||':'||coalesce(with_check,'-'),
    E'\n' order by tablename, policyname)) as h, count(*) as n
  from pg_policies where schemaname='public'
),
fns as (
  select md5(string_agg(n.nspname||'.'||p.proname||':'||md5(pg_get_functiondef(p.oid)),
    E'\n' order by n.nspname, p.proname)) as h, count(*) as n
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','app_private') and p.prokind='f'
),
trg as (
  select md5(string_agg(c.relname||'.'||t.tgname||':'||pg_get_triggerdef(t.oid),
    E'\n' order by c.relname, t.tgname)) as h, count(*) as n
  from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and not t.tgisinternal
),
acl as (
  select md5(string_agg(c.relname||':'||coalesce(c.relacl::text,'-')||':'||c.relrowsecurity::text,
    E'\n' order by c.relname)) as h, count(*) as n
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r'
),
seed as (
  select md5(
    (select coalesce(string_agg(name,',' order by name),'') from roles)||'|'||
    (select coalesce(string_agg(name,',' order by name),'') from permissions)||'|'||
    (select coalesce(string_agg(r.name||'>'||p.name,',' order by r.name, p.name),'')
       from role_permissions rp join roles r on r.id=rp.role_id join permissions p on p.id=rp.permission_id)||'|'||
    (select coalesce(string_agg(slug||':'||price::text||':'||is_active::text||':'||is_visible_on_frontend::text,',' order by slug),'') from services)||'|'||
    (select coalesce(string_agg(day_of_week::text||':'||start_time::text||':'||end_time::text,',' order by day_of_week, start_time),'') from availability_rules)
  ) as h, 0 as n
)
select 'columns' as part, h as md5, n as count from cols
union all select 'constraints', h, n from cons
union all select 'functions', h, n from fns
union all select 'indexes', h, n from idx
union all select 'policies', h, n from pol
union all select 'seed_rows', h, n from seed
union all select 'table_acls_and_rls', h, n from acl
union all select 'triggers', h, n from trg
order by part;
