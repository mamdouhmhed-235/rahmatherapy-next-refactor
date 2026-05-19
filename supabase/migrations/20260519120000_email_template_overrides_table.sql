create table public.email_template_overrides (
  id uuid primary key default gen_random_uuid(),
  template_id text not null,
  field_key text not null,
  value text not null check (char_length(value) <= 500),
  updated_by uuid references public.staff_profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (template_id, field_key)
);

alter table public.email_template_overrides enable row level security;

create policy "Active staff can read email_template_overrides"
on public.email_template_overrides for select
to authenticated
using (app_private.current_active_staff_id() is not null);

create policy "Template managers can insert email_template_overrides"
on public.email_template_overrides for insert
to authenticated
with check (
  app_private.current_staff_has_permission('manage_email_templates')
  or app_private.current_staff_has_permission('manage_settings')
);

create policy "Template managers can update email_template_overrides"
on public.email_template_overrides for update
to authenticated
using (
  app_private.current_staff_has_permission('manage_email_templates')
  or app_private.current_staff_has_permission('manage_settings')
)
with check (
  app_private.current_staff_has_permission('manage_email_templates')
  or app_private.current_staff_has_permission('manage_settings')
);

create policy "Template managers can delete email_template_overrides"
on public.email_template_overrides for delete
to authenticated
using (
  app_private.current_staff_has_permission('manage_email_templates')
  or app_private.current_staff_has_permission('manage_settings')
);

grant select, insert, update, delete on public.email_template_overrides to service_role;

insert into public.permissions (name, description, category, scope, risk_level, is_system, active)
values
  ('manage_email_templates', 'Edit and manage email template content overrides.', 'emails', 'global', 'standard', true, true)
on conflict (name) do update
set description = excluded.description,
    category = excluded.category,
    scope = excluded.scope,
    risk_level = excluded.risk_level,
    is_system = excluded.is_system,
    active = excluded.active;
