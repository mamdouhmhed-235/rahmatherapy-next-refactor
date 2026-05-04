alter table public.bookings
  add column if not exists contact_full_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists booking_source text not null default 'website',
  add column if not exists amount_due numeric,
  add column if not exists amount_paid numeric not null default 0,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_note text;

update public.bookings
set
  contact_full_name = coalesce(bookings.contact_full_name, clients.full_name),
  contact_email = coalesce(bookings.contact_email, clients.email, ''),
  contact_phone = coalesce(bookings.contact_phone, clients.phone, ''),
  amount_due = coalesce(bookings.amount_due, bookings.total_price),
  amount_paid = coalesce(bookings.amount_paid, 0),
  paid_at = case
    when bookings.payment_status = 'paid' and bookings.paid_at is null then bookings.updated_at
    else bookings.paid_at
  end
from public.clients
where bookings.client_id = clients.id;

alter table public.bookings
  alter column contact_full_name set not null,
  alter column contact_email set not null,
  alter column contact_phone set not null;

alter table public.booking_participants
  add column if not exists display_name text,
  add column if not exists participant_notes text,
  add column if not exists health_notes text,
  add column if not exists consent_acknowledged boolean not null default false;

update public.booking_participants
set
  display_name = coalesce(
    booking_participants.display_name,
    case
      when booking_participants.is_main_contact then bookings.contact_full_name
      else 'Participant'
    end
  ),
  consent_acknowledged = coalesce(
    booking_participants.consent_acknowledged,
    bookings.consent_acknowledged
  )
from public.bookings
where booking_participants.booking_id = bookings.id;

alter table public.bookings
  add constraint bookings_booking_source_check
  check (booking_source in ('website', 'phone', 'whatsapp', 'instagram', 'referral', 'admin', 'manual', 'other')) not valid;

alter table public.bookings
  add constraint bookings_amount_paid_non_negative_check
  check (amount_paid >= 0) not valid;

alter table public.bookings
  add constraint bookings_amount_due_non_negative_check
  check (amount_due is null or amount_due >= 0) not valid;

create or replace function public.create_booking_request(
  p_service_slugs text[],
  p_contact_full_name text,
  p_contact_email text,
  p_contact_phone text,
  p_customer_notes text,
  p_health_notes text,
  p_consent_acknowledged boolean,
  p_service_address_line1 text,
  p_service_city text,
  p_service_postcode text,
  p_access_notes text,
  p_booking_date date,
  p_start_time time,
  p_participant_genders public.staff_gender_type[],
  p_participant_display_names text[] default array[]::text[],
  p_participant_notes text[] default array[]::text[],
  p_booking_source text default 'website'
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor_role text := auth.role();
  v_normalized_email text := lower(trim(p_contact_email));
  v_clean_name text := trim(p_contact_full_name);
  v_clean_phone text := trim(p_contact_phone);
  v_clean_city text := trim(p_service_city);
  v_settings public.business_settings%rowtype;
  v_today date := (timezone('Europe/London', now()))::date;
  v_requested_at timestamptz;
  v_service_count integer;
  v_service_price numeric;
  v_total_duration_mins integer;
  v_total_price numeric;
  v_end_time time;
  v_participant_count integer := coalesce(array_length(p_participant_genders, 1), 0);
  v_required_male integer := 0;
  v_required_female integer := 0;
  v_available_male integer := 0;
  v_available_female integer := 0;
  v_reserved_male integer := 0;
  v_reserved_female integer := 0;
  v_start_minutes integer;
  v_end_minutes integer;
  v_day_of_week integer;
  v_client_id uuid;
  v_booking_id uuid;
  v_participant_id uuid;
  v_participant_index integer := 0;
  v_gender public.staff_gender_type;
  v_staff record;
  v_window record;
  v_has_window boolean;
  v_has_busy_overlap boolean;
  v_global_blocked boolean;
  v_global_override_start time;
  v_global_override_end time;
  v_staff_override_start time;
  v_staff_override_end time;
  v_staff_override_type text;
  v_staff_blocked boolean;
begin
  if v_actor_role is distinct from 'service_role' then
    raise exception 'create_booking_request may only be called with the service role'
      using errcode = '42501';
  end if;

  if v_clean_name = '' then
    raise exception 'Contact full name is required';
  end if;

  if v_normalized_email = '' or v_normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'A valid contact email is required';
  end if;

  if v_clean_phone = '' then
    raise exception 'Contact phone is required';
  end if;

  if v_participant_count < 1 or v_participant_count > 10 then
    raise exception 'Choose between 1 and 10 participants';
  end if;

  if p_booking_source not in ('website', 'phone', 'whatsapp', 'instagram', 'referral', 'admin', 'manual', 'other') then
    raise exception 'Unsupported booking source';
  end if;

  select *
  into v_settings
  from public.business_settings
  where id = 1;

  if not found or not v_settings.booking_status_enabled then
    raise exception 'Online booking is currently paused';
  end if;

  if p_booking_date < v_today
    or p_booking_date > (v_today + v_settings.booking_window_days)
  then
    raise exception 'Date is outside the booking window';
  end if;

  v_requested_at :=
    ((p_booking_date::text || ' ' || p_start_time::text)::timestamp at time zone 'Europe/London');

  if v_requested_at < now() + make_interval(hours => v_settings.minimum_notice_hours) then
    raise exception 'Selected time is inside the minimum notice period';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements_text(v_settings.allowed_cities) as allowed(city)
    where lower(v_clean_city) = lower(trim(allowed.city))
       or lower(v_clean_city) like '%' || lower(trim(allowed.city)) || '%'
  ) then
    raise exception 'Location is outside the service area';
  end if;

  select count(*), coalesce(sum(duration_mins), 0), coalesce(sum(price), 0)
  into v_service_count, v_total_duration_mins, v_service_price
  from public.services
  where slug = any(p_service_slugs)
    and is_active = true
    and is_visible_on_frontend = true;

  if v_service_count <> coalesce(array_length(p_service_slugs, 1), 0) then
    raise exception 'Selected service is unavailable';
  end if;

  if exists (
    select 1
    from public.services
    where slug = any(p_service_slugs)
      and gender_restrictions = 'male_only'
      and 'female'::public.staff_gender_type = any(p_participant_genders)
  ) or exists (
    select 1
    from public.services
    where slug = any(p_service_slugs)
      and gender_restrictions = 'female_only'
      and 'male'::public.staff_gender_type = any(p_participant_genders)
  ) then
    raise exception 'Selected service is not suitable for every participant';
  end if;

  select
    count(*) filter (where gender = 'male'),
    count(*) filter (where gender = 'female')
  into v_required_male, v_required_female
  from unnest(p_participant_genders) as gender;

  v_total_price := v_service_price * v_participant_count;
  v_end_time := p_start_time + make_interval(mins => v_total_duration_mins);

  if v_end_time <= p_start_time then
    raise exception 'Booking must finish on the same day after it starts';
  end if;

  v_start_minutes := extract(hour from p_start_time)::integer * 60
    + extract(minute from p_start_time)::integer;
  v_end_minutes := extract(hour from v_end_time)::integer * 60
    + extract(minute from v_end_time)::integer;
  v_day_of_week := extract(dow from p_booking_date)::integer;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'create_booking_request:' || p_booking_date::text || ':' || p_start_time::text,
      0
    )
  );

  select exists (
    select 1 from public.blocked_dates where blocked_date = p_booking_date
  )
  into v_global_blocked;

  select start_time, end_time
  into v_global_override_start, v_global_override_end
  from public.availability_overrides
  where override_date = p_booking_date;

  for v_staff in
    select sp.id, sp.gender, sp.availability_mode
    from public.staff_profiles sp
    where sp.active = true
      and sp.can_take_bookings = true
      and sp.gender = any(p_participant_genders)
      and (
        exists (
          select 1
          from public.staff_permission_overrides spo
          join public.permissions p on p.id = spo.permission_id
          where spo.staff_id = sp.id
            and spo.is_granted = true
            and p.name in ('claim_bookings', 'claim_assignments')
        )
        or exists (
          select 1
          from public.role_permissions rp
          join public.permissions p on p.id = rp.permission_id
          where rp.role_id = sp.role_id
            and p.name in ('claim_bookings', 'claim_assignments')
            and not exists (
              select 1
              from public.staff_permission_overrides spo
              where spo.staff_id = sp.id
                and spo.permission_id = rp.permission_id
                and spo.is_granted = false
            )
        )
      )
  loop
    if v_global_blocked then
      continue;
    end if;

    select exists (
      select 1
      from public.staff_blocked_dates
      where staff_id = v_staff.id
        and blocked_date = p_booking_date
    )
    into v_staff_blocked;

    if v_staff_blocked then
      continue;
    end if;

    v_staff_override_start := null;
    v_staff_override_end := null;
    v_staff_override_type := null;

    select start_time, end_time, override_type
    into v_staff_override_start, v_staff_override_end, v_staff_override_type
    from public.staff_availability_overrides
    where staff_id = v_staff.id
      and override_date = p_booking_date;

    if v_staff_override_type is not null
      and lower(v_staff_override_type) in ('blocked', 'closed', 'off', 'unavailable')
    then
      continue;
    end if;

    v_has_window := false;

    if v_staff_override_start is not null then
      v_has_window :=
        p_start_time >= v_staff_override_start
        and v_end_time <= v_staff_override_end;
    elsif v_staff.availability_mode = 'custom' then
      for v_window in
        select start_time, end_time
        from public.staff_availability_rules
        where staff_id = v_staff.id
          and day_of_week = v_day_of_week
          and is_working_day = true
      loop
        if p_start_time >= v_window.start_time and v_end_time <= v_window.end_time then
          v_has_window := true;
          exit;
        end if;
      end loop;
    elsif v_global_override_start is not null then
      v_has_window :=
        p_start_time >= v_global_override_start
        and v_end_time <= v_global_override_end;
    else
      for v_window in
        select start_time, end_time
        from public.availability_rules
        where day_of_week = v_day_of_week
          and is_working_day = true
      loop
        if p_start_time >= v_window.start_time and v_end_time <= v_window.end_time then
          v_has_window := true;
          exit;
        end if;
      end loop;
    end if;

    if not v_has_window then
      continue;
    end if;

    select exists (
      select 1
      from public.booking_assignments ba
      join public.bookings b on b.id = ba.booking_id
      where ba.assigned_staff_id = v_staff.id
        and ba.status in ('unassigned', 'assigned')
        and b.status in ('pending', 'confirmed')
        and b.booking_date = p_booking_date
        and v_start_minutes < (
          extract(hour from b.end_time)::integer * 60
          + extract(minute from b.end_time)::integer
          + v_settings.buffer_time_mins
        )
        and v_end_minutes > (
          extract(hour from b.start_time)::integer * 60
          + extract(minute from b.start_time)::integer
          - v_settings.buffer_time_mins
        )
    )
    into v_has_busy_overlap;

    if v_has_busy_overlap then
      continue;
    end if;

    if v_staff.gender = 'male' then
      v_available_male := v_available_male + 1;
    else
      v_available_female := v_available_female + 1;
    end if;
  end loop;

  select
    count(*) filter (where ba.required_therapist_gender = 'male'),
    count(*) filter (where ba.required_therapist_gender = 'female')
  into v_reserved_male, v_reserved_female
  from public.booking_assignments ba
  join public.bookings b on b.id = ba.booking_id
  where ba.assigned_staff_id is null
    and ba.status in ('unassigned', 'assigned')
    and b.status in ('pending', 'confirmed')
    and b.booking_date = p_booking_date
    and v_start_minutes < (
      extract(hour from b.end_time)::integer * 60
      + extract(minute from b.end_time)::integer
      + v_settings.buffer_time_mins
    )
    and v_end_minutes > (
      extract(hour from b.start_time)::integer * 60
      + extract(minute from b.start_time)::integer
      - v_settings.buffer_time_mins
    );

  if greatest(0, v_available_male - coalesce(v_reserved_male, 0)) < v_required_male
    or greatest(0, v_available_female - coalesce(v_reserved_female, 0)) < v_required_female
  then
    raise exception 'Selected appointment time is no longer available';
  end if;

  insert into public.clients (
    full_name,
    phone,
    email,
    address,
    postcode,
    notes
  )
  values (
    v_clean_name,
    v_clean_phone,
    v_normalized_email,
    trim(p_service_address_line1),
    trim(p_service_postcode),
    nullif(trim(coalesce(p_customer_notes, '')), '')
  )
  on conflict (email) do update
  set
    full_name = excluded.full_name,
    phone = excluded.phone,
    address = excluded.address,
    postcode = excluded.postcode,
    notes = coalesce(excluded.notes, clients.notes),
    updated_at = now()
  returning id into v_client_id;

  insert into public.bookings (
    client_id,
    contact_full_name,
    contact_email,
    contact_phone,
    booking_source,
    booking_date,
    start_time,
    end_time,
    total_duration_mins,
    total_price,
    amount_due,
    amount_paid,
    payment_status,
    status,
    assignment_status,
    group_booking,
    service_address_line1,
    service_city,
    service_postcode,
    access_notes,
    customer_notes,
    health_notes,
    consent_acknowledged
  )
  values (
    v_client_id,
    v_clean_name,
    v_normalized_email,
    v_clean_phone,
    p_booking_source,
    p_booking_date,
    p_start_time,
    v_end_time,
    v_total_duration_mins,
    v_total_price,
    v_total_price,
    0,
    'unpaid',
    'pending',
    'unassigned',
    v_participant_count > 1,
    trim(p_service_address_line1),
    v_clean_city,
    trim(p_service_postcode),
    nullif(trim(coalesce(p_access_notes, '')), ''),
    nullif(trim(coalesce(p_customer_notes, '')), ''),
    nullif(trim(coalesce(p_health_notes, '')), ''),
    p_consent_acknowledged
  )
  returning id into v_booking_id;

  foreach v_gender in array p_participant_genders loop
    v_participant_index := v_participant_index + 1;

    insert into public.booking_participants (
      booking_id,
      participant_gender,
      required_therapist_gender,
      is_main_contact,
      display_name,
      participant_notes,
      health_notes,
      consent_acknowledged
    )
    values (
      v_booking_id,
      v_gender,
      v_gender,
      v_participant_index = 1,
      case
        when nullif(trim(coalesce(p_participant_display_names[v_participant_index], '')), '') is not null
          then trim(p_participant_display_names[v_participant_index])
        when v_participant_count = 1 or v_participant_index = 1 then v_clean_name
        else 'Participant ' || v_participant_index
      end,
      nullif(trim(coalesce(p_participant_notes[v_participant_index], '')), ''),
      case
        when v_participant_index = 1 then nullif(trim(coalesce(p_health_notes, '')), '')
        else null
      end,
      p_consent_acknowledged
    )
    returning id into v_participant_id;

    insert into public.booking_items (
      booking_id,
      booking_participant_id,
      service_id,
      service_name_snapshot,
      service_price_snapshot,
      service_duration_snapshot
    )
    select
      v_booking_id,
      v_participant_id,
      services.id,
      services.name,
      services.price,
      services.duration_mins
    from public.services
    where services.slug = any(p_service_slugs)
      and services.is_active = true
      and services.is_visible_on_frontend = true
    order by array_position(p_service_slugs, services.slug);

    insert into public.booking_assignments (
      booking_id,
      participant_id,
      assigned_staff_id,
      required_therapist_gender,
      status
    )
    values (
      v_booking_id,
      v_participant_id,
      null,
      v_gender,
      'unassigned'
    );
  end loop;

  return jsonb_build_object(
    'bookingId', v_booking_id,
    'participantCount', v_participant_count,
    'itemCount', v_participant_count * v_service_count,
    'assignmentCount', v_participant_count,
    'amountDue', v_total_price,
    'bookingSource', p_booking_source
  );
end;
$$;

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

grant select, insert, update
on
  public.clients,
  public.bookings,
  public.booking_participants,
  public.booking_items,
  public.booking_assignments
to service_role;
