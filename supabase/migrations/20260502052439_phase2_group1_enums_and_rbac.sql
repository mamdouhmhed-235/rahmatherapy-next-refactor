create extension if not exists pgcrypto;

create type public.staff_gender_type as enum ('male', 'female');
create type public.availability_mode_type as enum (
  'use_global',
  'custom',
  'global_with_overrides'
);
create type public.gender_restrictions_type as enum (
  'any',
  'male_only',
  'female_only'
);
create type public.gender_preference_type as enum (
  'male',
  'female',
  'no_preference'
);
create type public.payment_method_type as enum ('cash', 'card');
create type public.payment_status_type as enum ('paid', 'unpaid');
create type public.booking_status_type as enum (
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show'
);
create type public.booking_assignment_status_type as enum (
  'unassigned',
  'partially_assigned',
  'fully_assigned'
);
create type public.assignment_status_type as enum (
  'unassigned',
  'assigned',
  'completed',
  'cancelled',
  'no_show'
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

insert into public.roles (name, description)
values
  ('Owner', 'Full system owner access.'),
  ('Admin', 'Operational admin access.'),
  ('Therapist', 'Therapist access for own assignments and availability.'),
  ('Inactive', 'Inactive staff role with no permissions.')
on conflict (name) do nothing;

insert into public.permissions (name, description)
values
  ('manage_users', 'Manage admin users and staff accounts.'),
  ('manage_roles', 'Manage roles and role permissions.'),
  ('manage_permissions', 'Manage individual permission records.'),
  ('manage_services', 'Manage treatment and package catalog.'),
  ('manage_availability_global', 'Manage global availability settings.'),
  ('manage_availability_own', 'Manage own staff availability.'),
  ('manage_bookings_all', 'Manage all bookings.'),
  ('manage_bookings_own', 'Manage own bookings and assignments.'),
  ('claim_bookings', 'Claim eligible booking assignments.'),
  ('claim_assignments', 'Claim eligible booking assignments.'),
  ('reassign_bookings', 'Reassign booking assignments.'),
  ('manage_clients', 'Manage client records.'),
  ('manage_payments', 'Manage payment status and method.'),
  ('view_dashboard', 'View dashboard.'),
  ('manage_settings', 'Manage business settings.'),
  ('manage_staff', 'Manage staff profile records.'),
  ('view_reports', 'View reporting data.'),
  ('manage_emails', 'Manage email notification settings.'),
  ('view_all_bookings', 'View all bookings.'),
  ('view_own_bookings', 'View own bookings and assignments.'),
  ('view_clients', 'View client records.'),
  ('manage_audit_logs', 'View and manage audit logs.')
on conflict (name) do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
cross join public.permissions
where roles.name = 'Owner'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions
  on permissions.name in (
    'manage_services',
    'manage_availability_global',
    'manage_availability_own',
    'manage_bookings_all',
    'manage_bookings_own',
    'claim_bookings',
    'claim_assignments',
    'reassign_bookings',
    'manage_clients',
    'manage_payments',
    'view_dashboard',
    'manage_settings',
    'manage_staff',
    'view_reports',
    'manage_emails',
    'view_all_bookings',
    'view_own_bookings',
    'view_clients',
    'manage_audit_logs'
  )
where roles.name = 'Admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions
  on permissions.name in (
    'manage_availability_own',
    'manage_bookings_own',
    'claim_bookings',
    'claim_assignments'
  )
where roles.name = 'Therapist'
on conflict do nothing;
