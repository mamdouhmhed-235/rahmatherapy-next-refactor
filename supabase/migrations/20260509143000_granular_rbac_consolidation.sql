create temporary table _rbac_permission_migration_map (
  legacy_name text not null,
  canonical_name text not null,
  primary key (legacy_name, canonical_name)
);

alter table public.roles
  add column if not exists display_label text,
  add column if not exists sort_order integer not null default 100,
  add column if not exists is_system boolean not null default false,
  add column if not exists active boolean not null default true;

alter table public.permissions
  add column if not exists category text not null default 'system',
  add column if not exists scope text not null default 'global',
  add column if not exists risk_level text not null default 'medium',
  add column if not exists is_system boolean not null default true,
  add column if not exists active boolean not null default true;

insert into public.permissions (name, description)
values
  ('view_bookings_all', 'Read all bookings.'),
  ('view_bookings_assigned', 'Read bookings assigned to the current staff member.'),
  ('manage_bookings_assigned', 'Update assigned booking workflow.'),
  ('assign_bookings', 'Assign and reassign booking assignments.'),
  ('view_reports_own', 'View own workload and assigned-session reporting.'),
  ('export_reports_own', 'Export own workload and assigned-session reporting.'),
  ('view_reports_operational', 'View non-revenue operational reporting.'),
  ('view_reports_revenue', 'View revenue reporting.'),
  ('export_reports_revenue', 'Export revenue reporting.'),
  ('view_reports_business', 'View business-wide reporting.'),
  ('view_clients_assigned', 'View clients connected to assigned bookings.'),
  ('view_clients_all', 'View all client records.'),
  ('view_client_contact_details', 'View client contact details.'),
  ('view_client_health_notes_assigned', 'View health notes for assigned client sessions.'),
  ('create_client_session_notes', 'Create client treatment or session notes.'),
  ('manage_clients_all', 'Create and update all client records.'),
  ('manage_sensitive_client_notes', 'View and manage sensitive client notes.'),
  ('view_staff', 'View staff profiles.'),
  ('manage_staff_profiles', 'Create and update staff profile details.'),
  ('assign_staff_roles', 'Assign fixed roles to staff.'),
  ('manage_permission_overrides', 'Grant or revoke individual staff permission overrides.'),
  ('manage_role_templates', 'Edit default role permission templates.'),
  ('view_email_logs', 'View email delivery status and logs.'),
  ('resend_booking_emails', 'Resend booking emails and reminders.'),
  ('manage_email_settings', 'Manage email settings and templates.'),
  ('manage_enquiries', 'Create and update enquiry workflow.')
on conflict (name) do update
set description = excluded.description;

update public.permissions
set
  category = case
    when name like '%booking%' or name = 'claim_assignments' then 'bookings'
    when name like '%report%' then 'reports'
    when name like '%client%' or name in ('manage_enquiries') then 'clients'
    when name like '%staff%' or name like '%role%' or name like '%permission%' then 'staff'
    when name like '%email%' then 'emails'
    when name like '%availability%' then 'availability'
    when name like '%audit%' then 'audit'
    when name like '%privacy%' then 'privacy'
    when name like '%service%' then 'services'
    when name like '%setting%' then 'settings'
    else 'system'
  end,
  scope = case
    when name like '%_own' or name like '%own_%' or name like '%assigned%' then 'scoped'
    when name like '%_all' or name like '%business%' or name like '%revenue%' then 'global'
    else 'operational'
  end,
  risk_level = case
    when name in ('manage_role_templates', 'manage_permission_overrides', 'manage_privacy_operations', 'manage_audit_logs', 'manage_settings') then 'high'
    when name like '%revenue%' or name like '%sensitive%' or name like '%health%' or name like '%staff%' then 'elevated'
    else 'standard'
  end,
  is_system = true,
  active = true
where name in (
  'view_dashboard',
  'view_bookings_all',
  'view_bookings_assigned',
  'manage_bookings_all',
  'manage_bookings_assigned',
  'assign_bookings',
  'claim_assignments',
  'view_reports_own',
  'export_reports_own',
  'view_reports_operational',
  'view_reports_revenue',
  'export_reports_revenue',
  'view_reports_business',
  'view_clients_assigned',
  'view_clients_all',
  'view_client_contact_details',
  'view_client_health_notes_assigned',
  'create_client_session_notes',
  'manage_clients_all',
  'manage_sensitive_client_notes',
  'view_staff',
  'manage_staff_profiles',
  'assign_staff_roles',
  'manage_permission_overrides',
  'manage_role_templates',
  'view_email_logs',
  'resend_booking_emails',
  'manage_email_settings',
  'manage_enquiries',
  'manage_services',
  'manage_settings',
  'manage_availability_global',
  'manage_availability_own',
  'manage_audit_logs',
  'manage_privacy_operations'
);

insert into public.roles (name, description)
values
  ('Booking Coordinator', 'Client care and booking coordination access.')
on conflict (name) do update
set description = excluded.description;

update public.roles
set
  display_label = case name
    when 'Owner' then 'Owner / Main Admin'
    when 'Admin' then 'Admin / Practice Manager'
    when 'Booking Coordinator' then 'Client Care / Booking Coordinator'
    when 'Therapist' then 'Therapist'
    when 'Inactive' then 'Inactive / Suspended'
    else coalesce(display_label, name)
  end,
  description = case name
    when 'Owner' then 'Full owner/main admin access.'
    when 'Admin' then 'Practice manager access for daily operations.'
    when 'Booking Coordinator' then 'Client care and booking coordination access.'
    when 'Therapist' then 'Therapist access for assigned bookings, own availability, clients, and own reports.'
    when 'Inactive' then 'Suspended staff role with no permissions.'
    else description
  end,
  sort_order = case name
    when 'Owner' then 10
    when 'Admin' then 20
    when 'Booking Coordinator' then 30
    when 'Therapist' then 40
    when 'Inactive' then 50
    else sort_order
  end,
  is_system = true,
  active = true
where name in ('Owner', 'Admin', 'Booking Coordinator', 'Therapist', 'Inactive');

insert into _rbac_permission_migration_map (legacy_name, canonical_name)
values
  ('view_reports', 'view_reports_business'),
  ('view_reports', 'view_reports_revenue'),
  ('view_reports', 'export_reports_revenue'),
  ('view_reports', 'view_reports_operational'),
  ('view_clients', 'view_clients_all'),
  ('view_clients', 'view_client_contact_details'),
  ('manage_clients', 'manage_clients_all'),
  ('manage_clients', 'view_clients_all'),
  ('manage_clients', 'view_client_contact_details'),
  ('manage_clients', 'manage_enquiries'),
  ('manage_clients', 'manage_sensitive_client_notes'),
  ('manage_users', 'view_staff'),
  ('manage_users', 'manage_staff_profiles'),
  ('manage_users', 'assign_staff_roles'),
  ('manage_staff', 'view_staff'),
  ('manage_staff', 'manage_staff_profiles'),
  ('manage_roles', 'manage_role_templates'),
  ('manage_permissions', 'manage_permission_overrides'),
  ('manage_emails', 'view_email_logs'),
  ('manage_emails', 'resend_booking_emails'),
  ('manage_emails', 'manage_email_settings'),
  ('claim_bookings', 'claim_assignments'),
  ('reassign_bookings', 'assign_bookings'),
  ('view_all_bookings', 'view_bookings_all'),
  ('view_own_bookings', 'view_bookings_assigned'),
  ('manage_bookings_own', 'manage_bookings_assigned'),
  ('manage_payments', 'view_reports_revenue'),
  ('manage_payments', 'export_reports_revenue')
on conflict do nothing;

insert into public.staff_permission_overrides (staff_id, permission_id, is_granted)
select spo.staff_id, canonical.id, spo.is_granted
from public.staff_permission_overrides spo
join public.permissions legacy on legacy.id = spo.permission_id
join _rbac_permission_migration_map map on map.legacy_name = legacy.name
join public.permissions canonical on canonical.name = map.canonical_name
on conflict (staff_id, permission_id) do update
set is_granted = excluded.is_granted;

delete from public.role_permissions rp
using public.roles r
where rp.role_id = r.id
  and r.name in ('Owner', 'Admin', 'Booking Coordinator', 'Therapist', 'Inactive');

with role_bundle(role_name, permission_name) as (
  values
    ('Owner', 'view_dashboard'),
    ('Owner', 'view_bookings_all'),
    ('Owner', 'view_bookings_assigned'),
    ('Owner', 'manage_bookings_all'),
    ('Owner', 'manage_bookings_assigned'),
    ('Owner', 'assign_bookings'),
    ('Owner', 'claim_assignments'),
    ('Owner', 'view_reports_own'),
    ('Owner', 'export_reports_own'),
    ('Owner', 'view_reports_operational'),
    ('Owner', 'view_reports_revenue'),
    ('Owner', 'export_reports_revenue'),
    ('Owner', 'view_reports_business'),
    ('Owner', 'view_clients_assigned'),
    ('Owner', 'view_clients_all'),
    ('Owner', 'view_client_contact_details'),
    ('Owner', 'view_client_health_notes_assigned'),
    ('Owner', 'create_client_session_notes'),
    ('Owner', 'manage_clients_all'),
    ('Owner', 'manage_sensitive_client_notes'),
    ('Owner', 'view_staff'),
    ('Owner', 'manage_staff_profiles'),
    ('Owner', 'assign_staff_roles'),
    ('Owner', 'manage_permission_overrides'),
    ('Owner', 'manage_role_templates'),
    ('Owner', 'view_email_logs'),
    ('Owner', 'resend_booking_emails'),
    ('Owner', 'manage_email_settings'),
    ('Owner', 'manage_enquiries'),
    ('Owner', 'manage_services'),
    ('Owner', 'manage_settings'),
    ('Owner', 'manage_availability_global'),
    ('Owner', 'manage_availability_own'),
    ('Owner', 'manage_audit_logs'),
    ('Owner', 'manage_privacy_operations'),
    ('Admin', 'view_dashboard'),
    ('Admin', 'view_bookings_all'),
    ('Admin', 'manage_bookings_all'),
    ('Admin', 'view_bookings_assigned'),
    ('Admin', 'manage_bookings_assigned'),
    ('Admin', 'assign_bookings'),
    ('Admin', 'claim_assignments'),
    ('Admin', 'view_reports_operational'),
    ('Admin', 'view_reports_business'),
    ('Admin', 'view_reports_revenue'),
    ('Admin', 'export_reports_revenue'),
    ('Admin', 'view_clients_all'),
    ('Admin', 'view_client_contact_details'),
    ('Admin', 'manage_clients_all'),
    ('Admin', 'manage_sensitive_client_notes'),
    ('Admin', 'manage_services'),
    ('Admin', 'manage_settings'),
    ('Admin', 'manage_availability_global'),
    ('Admin', 'manage_availability_own'),
    ('Admin', 'view_staff'),
    ('Admin', 'manage_staff_profiles'),
    ('Admin', 'assign_staff_roles'),
    ('Admin', 'view_email_logs'),
    ('Admin', 'resend_booking_emails'),
    ('Admin', 'manage_email_settings'),
    ('Admin', 'manage_enquiries'),
    ('Admin', 'manage_audit_logs'),
    ('Admin', 'manage_privacy_operations'),
    ('Booking Coordinator', 'view_dashboard'),
    ('Booking Coordinator', 'view_bookings_all'),
    ('Booking Coordinator', 'manage_bookings_all'),
    ('Booking Coordinator', 'assign_bookings'),
    ('Booking Coordinator', 'view_clients_all'),
    ('Booking Coordinator', 'view_client_contact_details'),
    ('Booking Coordinator', 'manage_clients_all'),
    ('Booking Coordinator', 'manage_enquiries'),
    ('Booking Coordinator', 'view_email_logs'),
    ('Booking Coordinator', 'resend_booking_emails'),
    ('Booking Coordinator', 'view_reports_operational'),
    ('Therapist', 'view_dashboard'),
    ('Therapist', 'view_bookings_assigned'),
    ('Therapist', 'manage_bookings_assigned'),
    ('Therapist', 'claim_assignments'),
    ('Therapist', 'manage_availability_own'),
    ('Therapist', 'view_clients_assigned'),
    ('Therapist', 'view_client_contact_details'),
    ('Therapist', 'view_client_health_notes_assigned'),
    ('Therapist', 'create_client_session_notes'),
    ('Therapist', 'view_reports_own'),
    ('Therapist', 'export_reports_own')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from role_bundle rb
join public.roles r on r.name = rb.role_name
join public.permissions p on p.name = rb.permission_name
on conflict do nothing;

create index if not exists booking_assignments_assigned_staff_booking_idx
  on public.booking_assignments(assigned_staff_id, booking_id);

create index if not exists booking_assignments_booking_id_idx
  on public.booking_assignments(booking_id);

create index if not exists staff_profiles_role_id_idx
  on public.staff_profiles(role_id);

create index if not exists staff_profiles_auth_user_id_idx
  on public.staff_profiles(auth_user_id);

create index if not exists role_permissions_permission_id_idx
  on public.role_permissions(permission_id);

create index if not exists staff_permission_overrides_permission_id_idx
  on public.staff_permission_overrides(permission_id);

create or replace function app_private.current_staff_can_claim_gender(required_gender public.staff_gender_type)
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
      and app_private.current_staff_has_permission('claim_assignments')
  )
$$;

drop policy if exists "Active staff can read permitted role_permissions" on public.role_permissions;
create policy "Active staff can read permitted role_permissions"
on public.role_permissions for select
to authenticated
using (
  app_private.current_staff_has_permission('manage_role_templates')
  or role_id = (
    select staff_profiles.role_id
    from public.staff_profiles
    where staff_profiles.id = app_private.current_active_staff_id()
  )
);

drop policy if exists "Active staff can read permitted staff_profiles" on public.staff_profiles;
create policy "Active staff can read permitted staff_profiles"
on public.staff_profiles for select
to authenticated
using (
  id = app_private.current_active_staff_id()
  or app_private.current_staff_has_permission('view_staff')
  or app_private.current_staff_has_permission('manage_staff_profiles')
  or app_private.current_staff_has_permission('assign_staff_roles')
  or app_private.current_staff_has_permission('manage_role_templates')
);

drop policy if exists "Active staff can read permitted staff_permission_overrides" on public.staff_permission_overrides;
create policy "Active staff can read permitted staff_permission_overrides"
on public.staff_permission_overrides for select
to authenticated
using (
  staff_id = app_private.current_active_staff_id()
  or app_private.current_staff_has_permission('manage_permission_overrides')
);

drop policy if exists "Client managers can read clients" on public.clients;
create policy "Client managers can read clients"
on public.clients for select
to authenticated
using (
  app_private.current_staff_has_permission('view_clients_all')
  or app_private.current_staff_has_permission('manage_clients_all')
  or (
    app_private.current_staff_has_permission('view_clients_assigned')
    and exists (
      select 1
      from public.bookings
      join public.booking_assignments on booking_assignments.booking_id = bookings.id
      where bookings.client_id = clients.id
        and booking_assignments.assigned_staff_id = app_private.current_active_staff_id()
    )
  )
);

drop policy if exists "Permitted staff can read bookings" on public.bookings;
create policy "Permitted staff can read bookings"
on public.bookings for select
to authenticated
using (
  app_private.current_staff_has_permission('manage_bookings_all')
  or app_private.current_staff_has_permission('view_bookings_all')
  or (
    (
      app_private.current_staff_has_permission('manage_bookings_assigned')
      or app_private.current_staff_has_permission('view_bookings_assigned')
    )
    and exists (
      select 1
      from public.booking_assignments
      where booking_assignments.booking_id = bookings.id
        and booking_assignments.assigned_staff_id = app_private.current_active_staff_id()
    )
  )
);

drop policy if exists "Permitted staff can read booking_assignments" on public.booking_assignments;
create policy "Permitted staff can read booking_assignments"
on public.booking_assignments for select
to authenticated
using (
  app_private.current_staff_has_permission('manage_bookings_all')
  or app_private.current_staff_has_permission('view_bookings_all')
  or (
    assigned_staff_id = app_private.current_active_staff_id()
    and (
      app_private.current_staff_has_permission('manage_bookings_assigned')
      or app_private.current_staff_has_permission('view_bookings_assigned')
    )
  )
  or (
    status = 'unassigned'
    and assigned_staff_id is null
    and app_private.current_staff_can_claim_gender(required_therapist_gender)
  )
);

drop policy if exists "Email managers can read email_delivery_events" on public.email_delivery_events;
create policy "Email managers can read email_delivery_events"
on public.email_delivery_events for select
to authenticated
using (
  app_private.current_staff_has_permission('view_email_logs')
  or app_private.current_staff_has_permission('resend_booking_emails')
  or app_private.current_staff_has_permission('manage_email_settings')
);

drop policy if exists "Operational managers can read operational_events" on public.operational_events;
create policy "Operational managers can read operational_events"
on public.operational_events for select
to authenticated
using (
  app_private.current_staff_has_permission('manage_settings')
  or app_private.current_staff_has_permission('manage_email_settings')
);

drop policy if exists "Operational managers can update operational_events" on public.operational_events;
create policy "Operational managers can update operational_events"
on public.operational_events for update
to authenticated
using (
  app_private.current_staff_has_permission('manage_settings')
  or app_private.current_staff_has_permission('manage_email_settings')
)
with check (
  app_private.current_staff_has_permission('manage_settings')
  or app_private.current_staff_has_permission('manage_email_settings')
);

drop policy if exists "Privacy managers can read client_notes" on public.client_notes;
create policy "Privacy managers can read client_notes"
on public.client_notes for select
to authenticated
using (
  app_private.current_staff_has_permission('manage_privacy_operations')
  or app_private.current_staff_has_permission('manage_sensitive_client_notes')
  or (
    app_private.current_staff_has_permission('view_client_health_notes_assigned')
    and exists (
      select 1
      from public.bookings
      join public.booking_assignments on booking_assignments.booking_id = bookings.id
      where bookings.client_id = client_notes.client_id
        and booking_assignments.assigned_staff_id = app_private.current_active_staff_id()
    )
  )
);

drop policy if exists "Privacy managers can read client_privacy_requests" on public.client_privacy_requests;
create policy "Privacy managers can read client_privacy_requests"
on public.client_privacy_requests for select
to authenticated
using (
  app_private.current_staff_has_permission('manage_privacy_operations')
  or app_private.current_staff_has_permission('manage_sensitive_client_notes')
);

drop policy if exists "Privacy managers can read enquiries" on public.enquiries;
create policy "Privacy managers can read enquiries"
on public.enquiries for select
to authenticated
using (
  app_private.current_staff_has_permission('manage_enquiries')
  or app_private.current_staff_has_permission('manage_privacy_operations')
);

delete from public.staff_permission_overrides
using public.permissions
where staff_permission_overrides.permission_id = permissions.id
  and permissions.name in (
    'view_reports',
    'view_clients',
    'manage_clients',
    'manage_users',
    'manage_staff',
    'manage_roles',
    'manage_permissions',
    'manage_emails',
    'claim_bookings',
    'reassign_bookings',
    'view_all_bookings',
    'view_own_bookings',
    'manage_bookings_own',
    'manage_payments'
  );

delete from public.role_permissions
using public.permissions
where role_permissions.permission_id = permissions.id
  and permissions.name in (
    'view_reports',
    'view_clients',
    'manage_clients',
    'manage_users',
    'manage_staff',
    'manage_roles',
    'manage_permissions',
    'manage_emails',
    'claim_bookings',
    'reassign_bookings',
    'view_all_bookings',
    'view_own_bookings',
    'manage_bookings_own',
    'manage_payments'
  );

delete from public.permissions
where name in (
  'view_reports',
  'view_clients',
  'manage_clients',
  'manage_users',
  'manage_staff',
  'manage_roles',
  'manage_permissions',
  'manage_emails',
  'claim_bookings',
  'reassign_bookings',
  'view_all_bookings',
  'view_own_bookings',
  'manage_bookings_own',
  'manage_payments'
);

drop table _rbac_permission_migration_map;
