alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.staff_permission_overrides enable row level security;
alter table public.services enable row level security;
alter table public.clients enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_participants enable row level security;
alter table public.booking_items enable row level security;
alter table public.booking_assignments enable row level security;
alter table public.availability_rules enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.availability_overrides enable row level security;
alter table public.staff_availability_rules enable row level security;
alter table public.staff_blocked_dates enable row level security;
alter table public.staff_availability_overrides enable row level security;
alter table public.business_settings enable row level security;
alter table public.audit_logs enable row level security;

create policy "Authenticated users can read roles"
on public.roles for select
to authenticated
using (true);

create policy "Authenticated users can read permissions"
on public.permissions for select
to authenticated
using (true);

create policy "Authenticated users can read role_permissions"
on public.role_permissions for select
to authenticated
using (true);

create policy "Authenticated users can read staff_profiles"
on public.staff_profiles for select
to authenticated
using (true);

create policy "Authenticated users can read staff_permission_overrides"
on public.staff_permission_overrides for select
to authenticated
using (true);

create policy "Public can read active visible services"
on public.services for select
to anon, authenticated
using (is_active = true and is_visible_on_frontend = true);

create policy "Authenticated users can read clients"
on public.clients for select
to authenticated
using (true);

create policy "Authenticated users can read bookings"
on public.bookings for select
to authenticated
using (true);

create policy "Authenticated users can read booking_participants"
on public.booking_participants for select
to authenticated
using (true);

create policy "Authenticated users can read booking_items"
on public.booking_items for select
to authenticated
using (true);

create policy "Authenticated users can read booking_assignments"
on public.booking_assignments for select
to authenticated
using (true);

create policy "Public can read availability_rules"
on public.availability_rules for select
to anon, authenticated
using (true);

create policy "Public can read blocked_dates"
on public.blocked_dates for select
to anon, authenticated
using (true);

create policy "Public can read availability_overrides"
on public.availability_overrides for select
to anon, authenticated
using (true);

create policy "Authenticated users can read staff_availability_rules"
on public.staff_availability_rules for select
to authenticated
using (true);

create policy "Authenticated users can read staff_blocked_dates"
on public.staff_blocked_dates for select
to authenticated
using (true);

create policy "Authenticated users can read staff_availability_overrides"
on public.staff_availability_overrides for select
to authenticated
using (true);

create policy "Public can read business_settings"
on public.business_settings for select
to anon, authenticated
using (true);

create policy "Authenticated users can read audit_logs"
on public.audit_logs for select
to authenticated
using (true);
