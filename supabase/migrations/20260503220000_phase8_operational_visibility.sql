alter table public.email_delivery_events
  add column if not exists staff_id uuid references public.staff_profiles(id) on delete set null;

create index if not exists email_delivery_events_staff_id_idx
  on public.email_delivery_events(staff_id);

create index if not exists email_delivery_events_delivery_status_created_at_idx
  on public.email_delivery_events(delivery_status, created_at desc);

create table if not exists public.operational_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  severity text not null default 'warning'
    check (severity in ('info', 'warning', 'error')),
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved')),
  summary text not null,
  safe_context jsonb not null default '{}'::jsonb,
  booking_id uuid references public.bookings(id) on delete set null,
  staff_id uuid references public.staff_profiles(id) on delete set null,
  acknowledged_at timestamptz,
  acknowledged_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  resolved_at timestamptz,
  resolved_by_staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operational_events_status_created_at_idx
  on public.operational_events(status, created_at desc);

create index if not exists operational_events_booking_id_idx
  on public.operational_events(booking_id);

create index if not exists operational_events_staff_id_idx
  on public.operational_events(staff_id);

drop trigger if exists set_operational_events_updated_at on public.operational_events;
create trigger set_operational_events_updated_at
before update on public.operational_events
for each row execute function public.update_updated_at_column();

alter table public.operational_events enable row level security;

drop policy if exists "Operational managers can read operational_events" on public.operational_events;
create policy "Operational managers can read operational_events"
on public.operational_events for select
to authenticated
using (
  app_private.current_staff_has_permission('manage_settings')
  or app_private.current_staff_has_permission('manage_emails')
  or app_private.current_staff_has_permission('manage_bookings_all')
);

drop policy if exists "Operational managers can update operational_events" on public.operational_events;
create policy "Operational managers can update operational_events"
on public.operational_events for update
to authenticated
using (
  app_private.current_staff_has_permission('manage_settings')
  or app_private.current_staff_has_permission('manage_emails')
  or app_private.current_staff_has_permission('manage_bookings_all')
)
with check (
  app_private.current_staff_has_permission('manage_settings')
  or app_private.current_staff_has_permission('manage_emails')
  or app_private.current_staff_has_permission('manage_bookings_all')
);

grant select, insert, update
on public.operational_events
to service_role;

grant select, update
on public.operational_events
to authenticated;

grant select
on public.audit_logs
to service_role;
