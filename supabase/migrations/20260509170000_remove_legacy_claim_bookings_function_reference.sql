do $$
declare
  v_function regprocedure := 'public.create_booking_request(text[], text, text, text, text, text, boolean, text, text, text, text, date, time without time zone, public.staff_gender_type[], text[], text[], text)'::regprocedure;
  v_definition text;
begin
  select pg_get_functiondef(v_function)
  into v_definition;

  if v_definition is null then
    raise exception 'public.create_booking_request function not found';
  end if;

  v_definition := replace(
    v_definition,
    'p.name in (''claim_bookings'', ''claim_assignments'')',
    'p.name = ''claim_assignments'''
  );

  if position('''claim_bookings''' in v_definition) > 0 then
    raise exception 'Legacy claim_bookings reference still present in public.create_booking_request';
  end if;

  execute v_definition;
end $$;

revoke all on function public.create_booking_request(
  text[],
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  date,
  time,
  public.staff_gender_type[],
  text[],
  text[],
  text
) from public;

revoke all on function public.create_booking_request(
  text[],
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  date,
  time,
  public.staff_gender_type[],
  text[],
  text[],
  text
) from anon;

revoke all on function public.create_booking_request(
  text[],
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  date,
  time,
  public.staff_gender_type[],
  text[],
  text[],
  text
) from authenticated;

grant execute on function public.create_booking_request(
  text[],
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  date,
  time,
  public.staff_gender_type[],
  text[],
  text[],
  text
) to service_role;
