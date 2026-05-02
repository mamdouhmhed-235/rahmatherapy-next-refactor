create table public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text unique,
  gender_preference public.gender_preference_type not null default 'no_preference',
  address text,
  postcode text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clients_updated_at
before update on public.clients
for each row execute function public.update_updated_at_column();

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  total_duration_mins integer,
  total_price numeric,
  payment_method public.payment_method_type,
  payment_status public.payment_status_type not null default 'unpaid',
  status public.booking_status_type not null default 'pending',
  assignment_status public.booking_assignment_status_type not null default 'unassigned',
  group_booking boolean not null default false,
  manage_token_hash text,
  manage_token_expires_at timestamptz,
  customer_cancelled_at timestamptz,
  customer_manage_notes text,
  service_address_line1 text,
  service_address_line2 text,
  service_city text,
  service_postcode text,
  access_notes text,
  customer_notes text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_time_check check (end_time > start_time)
);

create trigger bookings_updated_at
before update on public.bookings
for each row execute function public.update_updated_at_column();

create table public.booking_participants (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  participant_gender public.staff_gender_type not null,
  required_therapist_gender public.staff_gender_type not null,
  is_main_contact boolean not null default false
);

create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  booking_participant_id uuid references public.booking_participants(id) on delete set null,
  service_id uuid not null references public.services(id),
  service_name_snapshot text not null,
  service_price_snapshot numeric not null,
  service_duration_snapshot integer not null check (service_duration_snapshot > 0)
);

create table public.booking_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  participant_id uuid not null references public.booking_participants(id) on delete cascade,
  assigned_staff_id uuid references public.staff_profiles(id) on delete set null,
  required_therapist_gender public.staff_gender_type not null,
  status public.assignment_status_type not null default 'unassigned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger booking_assignments_updated_at
before update on public.booking_assignments
for each row execute function public.update_updated_at_column();
