alter table public.clients
  add column if not exists client_source text not null default 'website',
  add column if not exists source_detail text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_client_source_check'
      and conrelid = 'public.clients'::regclass
  ) then
    alter table public.clients
      add constraint clients_client_source_check
      check (client_source in ('website', 'phone', 'whatsapp', 'instagram', 'referral', 'manual', 'other')) not valid;
  end if;
end $$;

update public.clients
set client_source = 'website'
where client_source is null;

alter table public.clients
  validate constraint clients_client_source_check;

create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  author_staff_id uuid references public.staff_profiles(id) on delete set null,
  note text not null,
  is_sensitive boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.client_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  request_type text not null check (request_type in ('data_export', 'correction', 'deletion_review')),
  status text not null default 'open' check (status in ('open', 'reviewing', 'completed', 'declined')),
  request_note text,
  created_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  converted_booking_id uuid references public.bookings(id) on delete set null,
  assigned_staff_id uuid references public.staff_profiles(id) on delete set null,
  source text not null default 'phone' check (source in ('website', 'phone', 'whatsapp', 'instagram', 'referral', 'other')),
  status text not null default 'new' check (status in ('new', 'contacted', 'booked', 'closed')),
  full_name text not null,
  phone text,
  email text,
  service_interest text,
  notes text,
  created_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'client_privacy_requests_updated_at'
  ) then
    create trigger client_privacy_requests_updated_at
    before update on public.client_privacy_requests
    for each row execute function public.update_updated_at_column();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'enquiries_updated_at'
  ) then
    create trigger enquiries_updated_at
    before update on public.enquiries
    for each row execute function public.update_updated_at_column();
  end if;
end $$;

create index if not exists client_notes_client_created_idx
  on public.client_notes (client_id, created_at desc);

create index if not exists client_privacy_requests_client_created_idx
  on public.client_privacy_requests (client_id, created_at desc);

create index if not exists enquiries_status_created_idx
  on public.enquiries (status, created_at desc);

create index if not exists enquiries_client_id_idx
  on public.enquiries (client_id);

create index if not exists clients_client_source_idx
  on public.clients (client_source);
