alter table public.bookings
add column if not exists consent_acknowledged boolean not null default false,
add column if not exists health_notes text,
add column if not exists treatment_notes text;
