create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  day_of_week integer not null check (day_of_week >= 0 and day_of_week <= 6),
  start_time time not null,
  end_time time not null,
  is_working_day boolean not null default true,
  constraint availability_rules_time_check check (end_time > start_time)
);

create table public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  blocked_date date not null unique,
  reason text
);

create table public.availability_overrides (
  id uuid primary key default gen_random_uuid(),
  override_date date not null unique,
  start_time time not null,
  end_time time not null,
  reason text,
  constraint availability_overrides_time_check check (end_time > start_time)
);

create table public.staff_availability_rules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  day_of_week integer not null check (day_of_week >= 0 and day_of_week <= 6),
  start_time time not null,
  end_time time not null,
  is_working_day boolean not null default true,
  constraint staff_availability_rules_time_check check (end_time > start_time)
);

create table public.staff_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  blocked_date date not null,
  reason text,
  unique (staff_id, blocked_date)
);

create table public.staff_availability_overrides (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  override_date date not null,
  start_time time not null,
  end_time time not null,
  override_type text,
  reason text,
  unique (staff_id, override_date),
  constraint staff_availability_overrides_time_check check (end_time > start_time)
);
