-- ⛔ THE REBUILD PROVES ITSELF. Read this before changing any number below.
--
-- WHY THIS FILE EXISTS
--   There are no Supabase backups on the free tier and no second database, so
--   these migration files ARE the backup. Nobody has ever executed a rebuild --
--   applying all of them to an empty database has never been done. Rather than
--   rehearse it on a database that does not exist, this file makes the rebuild
--   check ITSELF, at the moment it actually runs, which is the only moment that
--   matters.
--
--   If replaying the migrations does not reproduce the system, this raises and
--   the rebuild STOPS -- loudly, and at the point of failure -- instead of
--   leaving a half-right database that looks fine.
--
-- ⛔ THIS IS A POINT-IN-TIME ASSERTION, NOT A RUNNING TOTAL.
--   It asserts the state as of ITS OWN POSITION in the sequence: the 79
--   migrations up to and including this one. A migration added AFTER this file
--   runs later and legitimately changes these numbers -- that does NOT make this
--   file wrong, and it must NOT be edited to chase them. Editing an applied
--   migration is forbidden here anyway. If you want the same guarantee at a
--   later point, add a NEW assertion migration at that point.
--
--   Corollary: on a rebuild these counts are checked when exactly the first 79
--   files have run, so they are stable forever.
--
-- Measured against production 2026-08-20, immediately before applying.
-- Every number below was read from the live catalogue, not assumed.
--
-- ⚠️ WHAT IT DOES NOT COVER: column types, policy predicates, function bodies,
--   constraint definitions and index definitions are NOT compared here -- only
--   presence and counts. `00-control/db-baseline/` holds the full definitions,
--   and `scripts/verify-migration-coverage.mjs` checks name-level coverage
--   against the live catalogue. This file is the cheap, always-on tripwire.

do $rebuild_check$
declare
  v_fail text := '';
  v_n bigint;

  procedure_note constant text := 'rebuild self-check, migration 20260820_rebuild_self_check';

  -- helper: append a failure line
  function_placeholder boolean;
begin
  -- ---------- structure ----------
  select count(*) into v_n from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r';
  if v_n <> 30 then v_fail := v_fail || format('tables expected 30 got %s; ', v_n); end if;

  select count(*) into v_n from pg_policies where schemaname = 'public';
  if v_n <> 44 then v_fail := v_fail || format('policies expected 44 got %s; ', v_n); end if;

  select count(*) into v_n from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'app_private');
  if v_n <> 12 then v_fail := v_fail || format('functions expected 12 got %s; ', v_n); end if;

  select count(*) into v_n from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not t.tgisinternal;
  if v_n <> 11 then v_fail := v_fail || format('triggers expected 11 got %s; ', v_n); end if;

  select count(*) into v_n from pg_indexes where schemaname = 'public';
  if v_n <> 73 then v_fail := v_fail || format('indexes expected 73 got %s; ', v_n); end if;

  select count(*) into v_n from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public' and t.typtype = 'e';
  if v_n <> 10 then v_fail := v_fail || format('enum types expected 10 got %s; ', v_n); end if;

  -- ---------- the rules seed: the thing the Owner most needs to survive ----------
  select count(*) into v_n from public.roles;
  if v_n <> 5 then v_fail := v_fail || format('roles expected 5 got %s; ', v_n); end if;

  select count(*) into v_n from public.permissions;
  if v_n <> 40 then v_fail := v_fail || format('permissions expected 40 got %s; ', v_n); end if;

  select count(*) into v_n from public.role_permissions;
  if v_n <> 95 then v_fail := v_fail || format('role_permissions expected 95 got %s; ', v_n); end if;

  select count(*) into v_n from public.services;
  if v_n <> 5 then v_fail := v_fail || format('services expected 5 got %s; ', v_n); end if;

  select count(*) into v_n from public.business_settings;
  if v_n <> 1 then v_fail := v_fail || format('business_settings expected 1 got %s; ', v_n); end if;

  select count(*) into v_n from public.availability_rules;
  if v_n <> 7 then v_fail := v_fail || format('availability_rules expected 7 got %s; ', v_n); end if;

  -- ---------- the GRANT layer ----------
  -- ⛔ This is the layer a rebuild is least likely to reproduce: PR-006 proved a
  -- migration can silently drop a REVOKE, because pg_get_functiondef emits no
  -- ACL. Four probes, chosen so each fails for a different reason.
  if not has_table_privilege('service_role', 'public.bookings', 'INSERT') then
    v_fail := v_fail || 'service_role cannot INSERT bookings; ';
  end if;

  if has_table_privilege('anon', 'public.client_notes', 'TRUNCATE') then
    v_fail := v_fail || 'anon can TRUNCATE client_notes; ';
  end if;

  -- least privilege must SURVIVE a rebuild: consent_events is INSERT-only on
  -- purpose (20260804182200_c18_consent_events.sql:63-64). If a rebuild grants
  -- service_role SELECT here, a blanket default has crept back in.
  if has_table_privilege('service_role', 'public.consent_events', 'SELECT') then
    v_fail := v_fail || 'service_role can SELECT consent_events -- least privilege lost; ';
  end if;

  -- the public website reads this as anon; losing it takes the site down
  if not has_table_privilege('anon', 'public.services', 'SELECT') then
    v_fail := v_fail || 'anon cannot SELECT services -- public site would break; ';
  end if;

  -- the booking RPC must exist, be SECURITY DEFINER, and not be callable by anon
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'create_booking_request' and p.prosecdef
  ) then
    v_fail := v_fail || 'create_booking_request missing or not SECURITY DEFINER; ';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'create_booking_request'
       and has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    v_fail := v_fail || 'anon can EXECUTE create_booking_request; ';
  end if;

  if v_fail <> '' then
    raise exception E'⛔ REBUILD SELF-CHECK FAILED\n%\nfailures: %',
      procedure_note, v_fail
      using errcode = 'P0001',
            hint = 'Applying the migrations did not reproduce the expected system. '
                || 'Do NOT ignore this. Compare against 00-control/db-baseline/ and '
                || 'find which migration did not do what it claims.';
  end if;

  raise notice '✅ rebuild self-check passed: 30 tables, 44 policies, 12 functions, 11 triggers, 73 indexes, 10 enums, seed 5/40/95/5/1/7, 6 grant probes';
end
$rebuild_check$;
