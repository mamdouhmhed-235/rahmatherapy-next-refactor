-- Item 8 Phase 2 - remove the service-area gate from create_booking_request.
--
-- Applied as a guarded server-side transform of the function's own definition
-- rather than a retyped 18KB body: pg_get_functiondef() reproduces the exact
-- signature, defaults, volatility, SECURITY DEFINER and search_path, so this
-- cannot mistype a parameter list and accidentally create an OVERLOAD instead
-- of replacing the function. The canonical full-body form of the result is
-- committed at
--   supabase/migrations/20260811210000_item8_phase2_remove_service_area_gate.sql
-- and the md5 assertions below pin this transform to exactly that file.
--
-- Before: prosrc length 18038, md5 723789e4d27db734e6550830e967231c
-- After:  prosrc length 17715, md5 6b5fb9de14dd01ffe978e72d3e818066
-- Delta:  323 characters, one `raise exception` (19 -> 18), and the LAST
--         database reference to business_settings.allowed_cities.
--
-- KEPT deliberately: the `if v_clean_city = '' then raise exception 'City is
-- required'` check immediately above the removed block. A city is still
-- mandatory; it just no longer has to be one of ours.

do $do$
declare
  v_oid oid;
  v_src text;
  v_def text;
  v_new text;
  v_gate constant text := $gate$
  if not exists (
    select 1
    from jsonb_array_elements_text(v_settings.allowed_cities) as allowed(city)
    where lower(v_clean_city) = lower(trim(allowed.city))
       or lower(v_clean_city) like '%' || lower(trim(allowed.city)) || '%'
  ) then
    raise exception 'Location is outside the service area';
  end if;
$gate$;
begin
  select p.oid, p.prosrc into v_oid, v_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_booking_request';

  if v_oid is null then
    raise exception 'create_booking_request not found';
  end if;

  if md5(v_src) <> '723789e4d27db734e6550830e967231c' then
    raise exception 'live body is not the expected pre-Phase-2 definition (md5 %)', md5(v_src);
  end if;

  v_def := pg_get_functiondef(v_oid);

  if position(v_gate in v_def) = 0 then
    raise exception 'service-area gate block not found in the live definition';
  end if;

  v_new := replace(v_def, v_gate, '');

  execute v_new;
end
$do$;

-- Post-condition, enforced in the same migration: exactly one function of this
-- name, its body byte-identical to the committed file, and zero remaining
-- references to allowed_cities anywhere in the database.
do $verify$
declare
  v_count integer;
  v_src text;
begin
  select count(*) into v_count
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_booking_request';

  if v_count <> 1 then
    raise exception 'expected exactly 1 create_booking_request, found % (an overload was created)', v_count;
  end if;

  select p.prosrc into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_booking_request';

  if md5(v_src) <> '6b5fb9de14dd01ffe978e72d3e818066' then
    raise exception 'post-apply body does not match the committed migration file (md5 %)', md5(v_src);
  end if;

  if exists (select 1 from pg_proc where prosrc ilike '%allowed_cities%') then
    raise exception 'a database object still references allowed_cities';
  end if;
end
$verify$;