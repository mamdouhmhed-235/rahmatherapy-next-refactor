create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null unique,
  role_id uuid not null references public.roles(id),
  gender public.staff_gender_type not null,
  active boolean not null default true,
  can_take_bookings boolean not null default false,
  availability_mode public.availability_mode_type not null default 'use_global',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger staff_profiles_updated_at
before update on public.staff_profiles
for each row execute function public.update_updated_at_column();

create table public.staff_permission_overrides (
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  is_granted boolean not null,
  primary key (staff_id, permission_id)
);
