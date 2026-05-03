create or replace function public.current_active_staff_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select staff_profiles.id
  from public.staff_profiles
  where staff_profiles.auth_user_id = auth.uid()
    and staff_profiles.active = true
  limit 1
$$;

create or replace function public.current_staff_has_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.staff_profiles
    join public.permissions
      on permissions.name = permission_name
    left join public.staff_permission_overrides
      on staff_permission_overrides.staff_id = staff_profiles.id
     and staff_permission_overrides.permission_id = permissions.id
    where staff_profiles.auth_user_id = auth.uid()
      and staff_profiles.active = true
      and (
        staff_permission_overrides.is_granted = true
        or (
          staff_permission_overrides.staff_id is null
          and exists (
            select 1
            from public.role_permissions
            where role_permissions.role_id = staff_profiles.role_id
              and role_permissions.permission_id = permissions.id
          )
        )
      )
  )
$$;

create or replace function public.current_staff_can_claim_gender(required_gender public.staff_gender_type)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.staff_profiles
    where staff_profiles.auth_user_id = auth.uid()
      and staff_profiles.active = true
      and staff_profiles.can_take_bookings = true
      and staff_profiles.gender = required_gender
      and (
        public.current_staff_has_permission('claim_assignments')
        or public.current_staff_has_permission('claim_bookings')
      )
  )
$$;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select on public.roles to authenticated;
grant select on public.permissions to authenticated;
grant select on public.role_permissions to authenticated;
grant select on public.staff_profiles to authenticated;
grant select on public.staff_permission_overrides to authenticated;
grant select on public.services to anon, authenticated;
grant select on public.availability_rules to authenticated;
grant select on public.blocked_dates to authenticated;
grant select on public.availability_overrides to authenticated;
grant select on public.staff_availability_rules to authenticated;
grant select on public.staff_blocked_dates to authenticated;
grant select on public.staff_availability_overrides to authenticated;
grant select on public.business_settings to authenticated;
grant select on public.clients to authenticated;
grant select on public.bookings to authenticated;
grant select on public.booking_participants to authenticated;
grant select on public.booking_items to authenticated;
grant select on public.booking_assignments to authenticated;
grant select on public.audit_logs to authenticated;

drop policy if exists "Authenticated users can read roles" on public.roles;
drop policy if exists "Authenticated users can read permissions" on public.permissions;
drop policy if exists "Authenticated users can read role_permissions" on public.role_permissions;
drop policy if exists "Authenticated users can read staff_profiles" on public.staff_profiles;
drop policy if exists "Authenticated users can read staff_permission_overrides" on public.staff_permission_overrides;
drop policy if exists "Public can read active visible services" on public.services;
drop policy if exists "Authenticated users can read clients" on public.clients;
drop policy if exists "Authenticated users can read bookings" on public.bookings;
drop policy if exists "Authenticated users can read booking_participants" on public.booking_participants;
drop policy if exists "Authenticated users can read booking_items" on public.booking_items;
drop policy if exists "Authenticated users can read booking_assignments" on public.booking_assignments;
drop policy if exists "Public can read availability_rules" on public.availability_rules;
drop policy if exists "Public can read blocked_dates" on public.blocked_dates;
drop policy if exists "Public can read availability_overrides" on public.availability_overrides;
drop policy if exists "Authenticated users can read staff_availability_rules" on public.staff_availability_rules;
drop policy if exists "Authenticated users can read staff_blocked_dates" on public.staff_blocked_dates;
drop policy if exists "Authenticated users can read staff_availability_overrides" on public.staff_availability_overrides;
drop policy if exists "Public can read business_settings" on public.business_settings;
drop policy if exists "Authenticated users can read audit_logs" on public.audit_logs;

create policy "Active staff can read roles"
on public.roles for select
to authenticated
using (public.current_active_staff_id() is not null);

create policy "Active staff can read permissions"
on public.permissions for select
to authenticated
using (public.current_active_staff_id() is not null);

create policy "Active staff can read permitted role_permissions"
on public.role_permissions for select
to authenticated
using (
  public.current_staff_has_permission('manage_roles')
  or role_id = (
    select staff_profiles.role_id
    from public.staff_profiles
    where staff_profiles.id = public.current_active_staff_id()
  )
);

create policy "Active staff can read permitted staff_profiles"
on public.staff_profiles for select
to authenticated
using (
  id = public.current_active_staff_id()
  or public.current_staff_has_permission('manage_users')
  or public.current_staff_has_permission('manage_roles')
);

create policy "Active staff can read permitted staff_permission_overrides"
on public.staff_permission_overrides for select
to authenticated
using (
  staff_id = public.current_active_staff_id()
  or public.current_staff_has_permission('manage_users')
  or public.current_staff_has_permission('manage_roles')
);

create policy "Public can read active visible services"
on public.services for select
to anon, authenticated
using (is_active = true and is_visible_on_frontend = true);

create policy "Service managers can read all services"
on public.services for select
to authenticated
using (public.current_staff_has_permission('manage_services'));

create policy "Global availability managers can read availability_rules"
on public.availability_rules for select
to authenticated
using (public.current_staff_has_permission('manage_availability_global'));

create policy "Global availability managers can read blocked_dates"
on public.blocked_dates for select
to authenticated
using (public.current_staff_has_permission('manage_availability_global'));

create policy "Global availability managers can read availability_overrides"
on public.availability_overrides for select
to authenticated
using (public.current_staff_has_permission('manage_availability_global'));

create policy "Permitted staff can read staff_availability_rules"
on public.staff_availability_rules for select
to authenticated
using (
  public.current_staff_has_permission('manage_availability_global')
  or (
    staff_id = public.current_active_staff_id()
    and public.current_staff_has_permission('manage_availability_own')
  )
);

create policy "Permitted staff can read staff_blocked_dates"
on public.staff_blocked_dates for select
to authenticated
using (
  public.current_staff_has_permission('manage_availability_global')
  or (
    staff_id = public.current_active_staff_id()
    and public.current_staff_has_permission('manage_availability_own')
  )
);

create policy "Permitted staff can read staff_availability_overrides"
on public.staff_availability_overrides for select
to authenticated
using (
  public.current_staff_has_permission('manage_availability_global')
  or (
    staff_id = public.current_active_staff_id()
    and public.current_staff_has_permission('manage_availability_own')
  )
);

create policy "Settings managers can read business_settings"
on public.business_settings for select
to authenticated
using (public.current_staff_has_permission('manage_settings'));

create policy "Client managers can read clients"
on public.clients for select
to authenticated
using (public.current_staff_has_permission('manage_clients'));

create policy "Permitted staff can read bookings"
on public.bookings for select
to authenticated
using (
  public.current_staff_has_permission('manage_bookings_all')
  or public.current_staff_has_permission('view_all_bookings')
  or (
    (
      public.current_staff_has_permission('manage_bookings_own')
      or public.current_staff_has_permission('view_own_bookings')
    )
    and exists (
      select 1
      from public.booking_assignments
      where booking_assignments.booking_id = bookings.id
        and booking_assignments.assigned_staff_id = public.current_active_staff_id()
    )
  )
);

create policy "Permitted staff can read booking_participants"
on public.booking_participants for select
to authenticated
using (
  exists (
    select 1
    from public.bookings
    where bookings.id = booking_participants.booking_id
  )
);

create policy "Permitted staff can read booking_items"
on public.booking_items for select
to authenticated
using (
  exists (
    select 1
    from public.bookings
    where bookings.id = booking_items.booking_id
  )
);

create policy "Permitted staff can read booking_assignments"
on public.booking_assignments for select
to authenticated
using (
  public.current_staff_has_permission('manage_bookings_all')
  or public.current_staff_has_permission('view_all_bookings')
  or assigned_staff_id = public.current_active_staff_id()
  or (
    status = 'unassigned'
    and assigned_staff_id is null
    and public.current_staff_can_claim_gender(required_therapist_gender)
  )
);

create policy "Audit managers can read audit_logs"
on public.audit_logs for select
to authenticated
using (public.current_staff_has_permission('manage_audit_logs'));
