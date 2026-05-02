grant usage on schema public to service_role;

grant select
on
  public.business_settings,
  public.services,
  public.staff_profiles,
  public.permissions,
  public.role_permissions,
  public.staff_permission_overrides,
  public.availability_rules,
  public.blocked_dates,
  public.availability_overrides,
  public.staff_availability_rules,
  public.staff_blocked_dates,
  public.staff_availability_overrides,
  public.bookings,
  public.booking_assignments
to service_role;
