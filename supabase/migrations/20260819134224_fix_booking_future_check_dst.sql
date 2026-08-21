do $mig$
declare
  v_oid   oid;
  v_src   text;
  v_def   text;
  v_new   text;
  v_after text;
  v_hits  integer;
  c_old constant text := '  if v_requested_at < timezone(''Europe/London'', now()) then';
  c_new constant text := '  if v_requested_at < now() then';
begin
  select p.oid, p.prosrc, pg_get_functiondef(p.oid)
    into v_oid, v_src, v_def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'create_booking_request';

  if v_oid is null then
    raise exception 'create_booking_request not found - aborting';
  end if;

  -- PRE-CONDITION: exactly the body applied on 2026-08-19 by f1_f2.
  if md5(v_src) <> '8e455336428b4376fdffb7744eb8ae9c' then
    raise exception 'live body is not the expected pre-fix definition (md5 %) - aborting', md5(v_src);
  end if;

  -- The guard must appear exactly once, or a blind replace could hit another site.
  v_hits := (length(v_def) - length(replace(v_def, c_old, ''))) / length(c_old);
  if v_hits <> 1 then
    raise exception 'expected exactly 1 occurrence of the guard, found % - aborting', v_hits;
  end if;

  v_new := replace(v_def, c_old, c_new);
  if v_new = v_def then
    raise exception 'patch was a no-op - aborting';
  end if;

  execute v_new;

  -- POST-CONDITION: the rebuilt body must equal what the read-only dry run predicted.
  select p.prosrc into v_after
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'create_booking_request';

  if md5(v_after) <> '7bea3df6fdaf25bc8825c824b6b03967' then
    raise exception 'post-apply body md5 % does not match the predicted value - aborting', md5(v_after);
  end if;
end;
$mig$;