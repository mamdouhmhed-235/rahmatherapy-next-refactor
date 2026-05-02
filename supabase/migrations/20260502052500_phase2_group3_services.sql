create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  group_category text,
  short_description text,
  full_description text,
  suitable_for_notes text,
  gender_restrictions public.gender_restrictions_type not null default 'any',
  price numeric not null,
  duration_mins integer not null check (duration_mins > 0),
  is_active boolean not null default true,
  is_visible_on_frontend boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger services_updated_at
before update on public.services
for each row execute function public.update_updated_at_column();
