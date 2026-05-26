-- Canonical RBAC post-migration verification.
-- Run through Supabase MCP execute_sql or the Supabase SQL editor after applying
-- 20260509143000_granular_rbac_consolidation.sql.

with deprecated_permissions(name) as (
  values
    ('view_reports'),
    ('view_clients'),
    ('manage_clients'),
    ('manage_users'),
    ('manage_staff'),
    ('manage_roles'),
    ('manage_permissions'),
    ('manage_emails'),
    ('claim_bookings'),
    ('reassign_bookings'),
    ('view_all_bookings'),
    ('view_own_bookings'),
    ('manage_bookings_own'),
    ('manage_payments')
),
canonical_roles(name) as (
  values
    ('Owner'),
    ('Admin'),
    ('Booking Coordinator'),
    ('Therapist'),
    ('Inactive')
),
canonical_permissions(name) as (
  values
    ('view_dashboard'),
    ('view_bookings_all'),
    ('view_bookings_assigned'),
    ('manage_bookings_all'),
    ('manage_bookings_assigned'),
    ('assign_bookings'),
    ('claim_assignments'),
    ('view_reports_own'),
    ('export_reports_own'),
    ('view_reports_operational'),
    ('view_reports_revenue'),
    ('export_reports_revenue'),
    ('view_reports_business'),
    ('view_clients_assigned'),
    ('view_clients_all'),
    ('view_client_contact_details'),
    ('view_client_health_notes_assigned'),
    ('create_client_session_notes'),
    ('manage_clients_all'),
    ('manage_sensitive_client_notes'),
    ('view_staff'),
    ('manage_staff_profiles'),
    ('assign_staff_roles'),
    ('manage_permission_overrides'),
    ('manage_role_templates'),
    ('view_email_logs'),
    ('resend_booking_emails'),
    ('manage_email_settings'),
    ('manage_enquiries'),
    ('manage_services'),
    ('manage_settings'),
    ('manage_availability_global'),
    ('manage_availability_own'),
    ('manage_audit_logs'),
    ('manage_privacy_operations')
),
checks as (
  select
    'exactly_five_roles' as check_name,
    (
      select count(*) = 5
      from public.roles
      where name in (select name from canonical_roles)
    ) as passed,
    (
      select count(*)::text
      from public.roles
      where name in (select name from canonical_roles)
    ) as detail
  union all
  select
    'no_unexpected_roles',
    not exists (
      select 1
      from public.roles
      where name not in (select name from canonical_roles)
    ),
    coalesce((
      select string_agg(name, ', ' order by name)
      from public.roles
      where name not in (select name from canonical_roles)
    ), 'none')
  union all
  select
    'no_deprecated_permission_rows',
    not exists (
      select 1
      from public.permissions
      where name in (select name from deprecated_permissions)
    ),
    coalesce((
      select string_agg(name, ', ' order by name)
      from public.permissions
      where name in (select name from deprecated_permissions)
    ), 'none')
  union all
  select
    'no_deprecated_role_grants',
    not exists (
      select 1
      from public.role_permissions rp
      join public.permissions p on p.id = rp.permission_id
      where p.name in (select name from deprecated_permissions)
    ),
    (
      select count(*)::text
      from public.role_permissions rp
      join public.permissions p on p.id = rp.permission_id
      where p.name in (select name from deprecated_permissions)
    )
  union all
  select
    'no_deprecated_staff_overrides',
    not exists (
      select 1
      from public.staff_permission_overrides spo
      join public.permissions p on p.id = spo.permission_id
      where p.name in (select name from deprecated_permissions)
    ),
    (
      select count(*)::text
      from public.staff_permission_overrides spo
      join public.permissions p on p.id = spo.permission_id
      where p.name in (select name from deprecated_permissions)
    )
  union all
  select
    'owner_has_all_canonical_permissions',
    not exists (
      select 1
      from canonical_permissions cp
      where not exists (
        select 1
        from public.roles r
        join public.role_permissions rp on rp.role_id = r.id
        join public.permissions p on p.id = rp.permission_id
        where r.name = 'Owner'
          and p.name = cp.name
      )
    ),
    coalesce((
      select string_agg(cp.name, ', ' order by cp.name)
      from canonical_permissions cp
      where not exists (
        select 1
        from public.roles r
        join public.role_permissions rp on rp.role_id = r.id
        join public.permissions p on p.id = rp.permission_id
        where r.name = 'Owner'
          and p.name = cp.name
      )
    ), 'none')
  union all
  select
    'inactive_has_no_permissions',
    not exists (
      select 1
      from public.roles r
      join public.role_permissions rp on rp.role_id = r.id
      where r.name = 'Inactive'
    ),
    (
      select count(*)::text
      from public.roles r
      join public.role_permissions rp on rp.role_id = r.id
      where r.name = 'Inactive'
    )
  union all
  select
    'no_dangling_staff_overrides',
    not exists (
      select 1
      from public.staff_permission_overrides spo
      left join public.permissions p on p.id = spo.permission_id
      where p.id is null
    ),
    (
      select count(*)::text
      from public.staff_permission_overrides spo
      left join public.permissions p on p.id = spo.permission_id
      where p.id is null
    )
  union all
  select
    'no_legacy_policy_references',
    not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and exists (
          select 1
          from deprecated_permissions
          where position(quote_literal(deprecated_permissions.name) in (coalesce(qual, '') || ' ' || coalesce(with_check, ''))) > 0
        )
    ),
    coalesce((
      select string_agg(tablename || ':' || policyname, ', ' order by tablename, policyname)
      from pg_policies
      where schemaname = 'public'
        and exists (
          select 1
          from deprecated_permissions
          where position(quote_literal(deprecated_permissions.name) in (coalesce(qual, '') || ' ' || coalesce(with_check, ''))) > 0
        )
    ), 'none')
  union all
  select
    'no_legacy_function_references',
    not exists (
      select 1
      from pg_proc proc
      join pg_namespace ns on ns.oid = proc.pronamespace
      where ns.nspname in ('public', 'app_private')
        and exists (
          select 1
          from deprecated_permissions
          where position(quote_literal(deprecated_permissions.name) in pg_get_functiondef(proc.oid)) > 0
        )
    ),
    coalesce((
      select string_agg(ns.nspname || '.' || proc.proname, ', ' order by ns.nspname, proc.proname)
      from pg_proc proc
      join pg_namespace ns on ns.oid = proc.pronamespace
      where ns.nspname in ('public', 'app_private')
        and exists (
          select 1
          from deprecated_permissions
          where position(quote_literal(deprecated_permissions.name) in pg_get_functiondef(proc.oid)) > 0
        )
    ), 'none')
  union all
  select
    'no_legacy_view_references',
    not exists (
      select 1
      from pg_views
      where schemaname in ('public', 'app_private')
        and exists (
          select 1
          from deprecated_permissions
          where position(quote_literal(deprecated_permissions.name) in definition) > 0
        )
    ),
    coalesce((
      select string_agg(schemaname || '.' || viewname, ', ' order by schemaname, viewname)
      from pg_views
      where schemaname in ('public', 'app_private')
        and exists (
          select 1
          from deprecated_permissions
          where position(quote_literal(deprecated_permissions.name) in definition) > 0
        )
    ), 'none')
)
select *
from checks
order by check_name;
