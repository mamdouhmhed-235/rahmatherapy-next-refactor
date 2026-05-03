revoke all on function public.current_active_staff_id() from public;
revoke all on function public.current_staff_has_permission(text) from public;
revoke all on function public.current_staff_can_claim_gender(public.staff_gender_type) from public;

grant execute on function public.current_active_staff_id() to authenticated;
grant execute on function public.current_staff_has_permission(text) to authenticated;
grant execute on function public.current_staff_can_claim_gender(public.staff_gender_type) to authenticated;

grant select on public.roles to service_role;
grant select on public.permissions to service_role;
grant select, insert, delete on public.role_permissions to service_role;
grant select on public.staff_permission_overrides to service_role;

grant select, insert, update on public.staff_profiles to service_role;
grant select, insert, update, delete on public.services to service_role;

grant select, insert, update, delete on public.availability_rules to service_role;
grant select, insert, delete on public.blocked_dates to service_role;
grant select, insert, update, delete on public.availability_overrides to service_role;

grant select, insert, delete on public.staff_availability_rules to service_role;
grant select, insert, delete on public.staff_blocked_dates to service_role;
grant select, insert, update, delete on public.staff_availability_overrides to service_role;

grant select, insert, update on public.business_settings to service_role;
