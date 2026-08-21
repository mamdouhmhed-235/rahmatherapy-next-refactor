do $mig$
declare
  v_oid   oid;
  v_src   text;
  v_def   text;
  v_new   text;
  v_after text;
  v_hits  integer;

  -- The two padded-overlap predicates, verbatim from the live body.
  c_old1 constant text := $a$            (p_start_time, v_end_time) overlaps (
              b.start_time - make_interval(mins => coalesce(v_settings.buffer_time_mins, 0)),
              b.end_time   + make_interval(mins => coalesce(v_settings.buffer_time_mins, 0)))$a$;
  c_new1 constant text := $b$            extract(epoch from p_start_time) / 60
              < extract(epoch from b.end_time) / 60 + coalesce(v_settings.buffer_time_mins, 0)
            and extract(epoch from v_end_time) / 60
              > extract(epoch from b.start_time) / 60 - coalesce(v_settings.buffer_time_mins, 0)$b$;
  c_old2 constant text := $c$       and (p_start_time, v_end_time) overlaps (
             b.start_time - make_interval(mins => coalesce(v_settings.buffer_time_mins, 0)),
             b.end_time   + make_interval(mins => coalesce(v_settings.buffer_time_mins, 0)));$c$;
  c_new2 constant text := $d$       and extract(epoch from p_start_time) / 60
             < extract(epoch from b.end_time) / 60 + coalesce(v_settings.buffer_time_mins, 0)
       and extract(epoch from v_end_time) / 60
             > extract(epoch from b.start_time) / 60 - coalesce(v_settings.buffer_time_mins, 0);$d$;
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

  -- PRE-CONDITION: the body left by 20260819134224_fix_booking_future_check_dst.
  if md5(v_src) <> '7bea3df6fdaf25bc8825c824b6b03967' then
    raise exception 'live body is not the expected pre-fix definition (md5 %) - aborting', md5(v_src);
  end if;

  v_hits := (length(v_def) - length(replace(v_def, c_old1, ''))) / length(c_old1);
  if v_hits <> 1 then
    raise exception 'expected exactly 1 named-assignment predicate, found % - aborting', v_hits;
  end if;

  v_hits := (length(v_def) - length(replace(v_def, c_old2, ''))) / length(c_old2);
  if v_hits <> 1 then
    raise exception 'expected exactly 1 unassigned-reservation predicate, found % - aborting', v_hits;
  end if;

  v_new := replace(replace(v_def, c_old1, c_new1), c_old2, c_new2);
  if v_new = v_def then
    raise exception 'patch was a no-op - aborting';
  end if;

  execute v_new;

  -- POST-CONDITION: exactly what the read-only dry run predicted.
  select p.prosrc into v_after
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'create_booking_request';

  if md5(v_after) <> 'c0d74f2454bff1778e692e54a1817e80' then
    raise exception 'post-apply body md5 % does not match the predicted value - aborting', md5(v_after);
  end if;

  -- No time-arithmetic overlap predicate may survive.
  if position('overlaps' in v_after) <> 0 then
    raise exception 'an overlaps predicate survived the patch - aborting';
  end if;
end;
$mig$;