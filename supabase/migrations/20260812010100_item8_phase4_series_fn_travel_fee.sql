-- Item 8 Phase 4 - create_recurring_booking_series accepts and applies a
-- standing travel charge.
--
-- ⛔ THIS CHANGES THE SIGNATURE, so CREATE OR REPLACE ALONE IS NOT ENOUGH.
-- Postgres identifies a function by (name, argument types): adding
-- p_travel_fee creates a SECOND, 21-argument function and leaves the old
-- 20-argument one live. Worse, while both exist a 20-argument call is
-- ambiguous ("function is not unique") because the new parameter has a
-- default. So the new definition is created and the old signature dropped in
-- the SAME transaction, leaving no window where either problem is observable.
-- This mirrors the repo's own precedent: c06 dropped create_booking_request's
-- old signature before recreating it.
--
-- The body is transformed from the function's own pg_get_functiondef() rather
-- than retyped, so the 10,955-character body cannot acquire a transcription
-- error. Every edit asserts its anchor is unique first.
--
-- Three edits, and nothing else:
--   1. the signature gains  p_travel_fee numeric DEFAULT 0
--   2. the template INSERT stores it, so the horizon cron can carry it forward
--   3. the first materialised batch adds it to total_price and amount_due
--
-- The fee is added AFTER the per-occurrence price, never folded into a
-- multiply: this function books one participant per occurrence, so
-- v_service.price + p_travel_fee is the whole arithmetic.
--
-- Rollback: re-apply the prior body verbatim from
-- supabase/migrations/20260802122636_c02_recurring_bookings.sql as a NEW
-- migration, then drop the 21-argument signature. Never edit an applied file.

do $do$
declare
  v_oid oid;
  v_src text;
  v_def text;
  v_new text;
begin
  select p.oid, p.prosrc into v_oid, v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_recurring_booking_series';

  if v_oid is null then
    raise exception 'create_recurring_booking_series not found';
  end if;

  if md5(v_src) <> '3f5424d657f8b00a2374c64998d86eb0' then
    raise exception 'live body is not the expected pre-Phase-4 definition (md5 %)', md5(v_src);
  end if;

  v_def := pg_get_functiondef(v_oid);

  -- 1. signature
  if (select count(*) from regexp_matches(v_def, E'\\)\\n RETURNS', 'g')) <> 1 then
    raise exception 'signature anchor is not unique';
  end if;
  v_new := replace(v_def, E')\n RETURNS', E', p_travel_fee numeric DEFAULT 0)\n RETURNS');

  -- 2. the template row stores the standing charge
  if (select count(*) from regexp_matches(v_new, 'INSERT INTO public\.recurring_booking_templates \(\n    client_id,', 'g')) <> 1 then
    raise exception 'template INSERT column anchor is not unique';
  end if;
  v_new := replace(
    v_new,
    E'INSERT INTO public.recurring_booking_templates (\n    client_id,',
    E'INSERT INTO public.recurring_booking_templates (\n    travel_fee,\n    client_id,'
  );
  if (select count(*) from regexp_matches(v_new, E'  VALUES \\(\\n    p_client_id,', 'g')) <> 1 then
    raise exception 'template INSERT value anchor is not unique';
  end if;
  v_new := replace(
    v_new,
    E'  VALUES (\n    p_client_id,',
    E'  VALUES (\n    p_travel_fee,\n    p_client_id,'
  );

  -- 3. the first materialised batch. total_price and amount_due, never amount_paid.
  if (select count(*) from regexp_matches(v_new, E'      v_service\\.price,\\n      v_service\\.price,\\n      0,', 'g')) <> 1 then
    raise exception 'occurrence price anchor is not unique';
  end if;
  v_new := replace(
    v_new,
    E'      v_service.price,\n      v_service.price,\n      0,',
    E'      v_service.price + p_travel_fee,\n      v_service.price + p_travel_fee,\n      0,'
  );

  execute v_new;
end
$do$;

-- The old 20-argument signature. Dropped in the same transaction as the
-- creation above, so a 20-argument call is never ambiguous in practice.
drop function public.create_recurring_booking_series(
  uuid, text, date, time without time zone, text, text,
  staff_gender_type, staff_gender_type, uuid, uuid, boolean, integer, date,
  text, text, text, text, text, boolean, integer
);

-- Post-conditions, enforced in the same migration.
do $verify$
declare
  v_count integer;
  v_args text;
  v_src text;
begin
  select count(*) into v_count
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_recurring_booking_series';

  if v_count <> 1 then
    raise exception 'expected exactly 1 create_recurring_booking_series, found % (an overload survived)', v_count;
  end if;

  select pg_get_function_identity_arguments(p.oid), p.prosrc into v_args, v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_recurring_booking_series';

  if v_args not like '%p_travel_fee numeric%' then
    raise exception 'p_travel_fee is missing from the surviving signature: %', v_args;
  end if;

  if (select count(*) from regexp_matches(v_src, 'v_service\.price \+ p_travel_fee', 'g')) <> 2 then
    raise exception 'expected exactly 2 fee-applied price expressions in the body';
  end if;
end
$verify$;
