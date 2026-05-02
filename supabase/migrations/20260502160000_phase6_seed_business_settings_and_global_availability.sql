insert into public.business_settings (
  id,
  company_name,
  contact_email,
  contact_phone,
  booking_window_days,
  buffer_time_mins,
  minimum_notice_hours,
  allowed_cities,
  booking_status_enabled
)
values (
  1,
  'Rahma Therapy',
  null,
  null,
  30,
  30,
  24,
  '["Luton", "Dunstable", "Houghton Regis"]'::jsonb,
  true
)
on conflict (id) do update
set
  company_name = excluded.company_name,
  booking_window_days = excluded.booking_window_days,
  buffer_time_mins = excluded.buffer_time_mins,
  minimum_notice_hours = excluded.minimum_notice_hours,
  allowed_cities = case
    when public.business_settings.allowed_cities = '[]'::jsonb
      then excluded.allowed_cities
    else public.business_settings.allowed_cities
  end,
  booking_status_enabled = excluded.booking_status_enabled;

insert into public.availability_rules (
  day_of_week,
  start_time,
  end_time,
  is_working_day
)
select *
from (
  values
    (0, '08:00'::time, '20:00'::time, false),
    (1, '08:00'::time, '20:00'::time, true),
    (2, '08:00'::time, '20:00'::time, true),
    (3, '08:00'::time, '20:00'::time, true),
    (4, '08:00'::time, '20:00'::time, true),
    (5, '08:00'::time, '20:00'::time, true),
    (6, '08:00'::time, '20:00'::time, true)
) as defaults(day_of_week, start_time, end_time, is_working_day)
where not exists (
  select 1
  from public.availability_rules existing
  where existing.day_of_week = defaults.day_of_week
);
