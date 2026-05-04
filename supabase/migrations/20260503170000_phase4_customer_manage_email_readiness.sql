alter table public.business_settings
  add column if not exists customer_cancellation_cutoff_hours integer not null default 24
    check (customer_cancellation_cutoff_hours >= 0);

alter table public.bookings
  add column if not exists customer_cancellation_note text,
  add column if not exists last_customer_manage_action_at timestamptz,
  add column if not exists reschedule_requested_at timestamptz,
  add column if not exists reschedule_preferred_date date,
  add column if not exists reschedule_preferred_time time,
  add column if not exists reschedule_note text,
  add column if not exists reschedule_status text not null default 'none';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_reschedule_status_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_reschedule_status_check
      check (reschedule_status in ('none', 'requested', 'reviewed', 'declined', 'completed')) not valid;
  end if;
end $$;

create table if not exists public.email_delivery_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  event_type text not null,
  recipient_email text,
  recipient_role text,
  delivery_status text not null check (delivery_status in ('accepted', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.email_delivery_events enable row level security;

drop policy if exists "Email managers can read email_delivery_events" on public.email_delivery_events;
create policy "Email managers can read email_delivery_events"
on public.email_delivery_events for select
to authenticated
using (
  app_private.current_staff_has_permission('manage_emails')
  or app_private.current_staff_has_permission('manage_bookings_all')
  or app_private.current_staff_has_permission('view_all_bookings')
);

grant select, insert
on public.email_delivery_events
to service_role;

grant select
on public.email_delivery_events
to authenticated;
