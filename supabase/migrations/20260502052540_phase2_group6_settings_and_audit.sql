create table public.business_settings (
  id integer primary key check (id = 1),
  company_name text not null default 'Rahma Therapy',
  contact_email text,
  contact_phone text,
  booking_window_days integer not null default 30 check (booking_window_days > 0),
  buffer_time_mins integer not null default 30 check (buffer_time_mins >= 0),
  minimum_notice_hours integer not null default 24 check (minimum_notice_hours >= 0),
  allowed_cities jsonb not null default '[]'::jsonb,
  booking_status_enabled boolean not null default true
);

insert into public.business_settings (id)
values (1)
on conflict (id) do nothing;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_staff_id uuid references public.staff_profiles(id) on delete set null,
  action_type text not null,
  target_type text,
  target_id uuid,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);
