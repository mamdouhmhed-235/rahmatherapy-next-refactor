insert into public.permissions (name, description)
values (
  'manage_privacy_operations',
  'Manage customer data export, correction, deletion/anonymization review, and sensitive-note review workflows.'
)
on conflict (name) do update
set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions
  on permissions.name = 'manage_privacy_operations'
where roles.name in ('Owner', 'Admin/Manager')
on conflict do nothing;

alter table public.client_privacy_requests
  drop constraint if exists client_privacy_requests_request_type_check;

alter table public.client_privacy_requests
  add constraint client_privacy_requests_request_type_check
  check (request_type in (
    'data_export',
    'correction',
    'deletion_review',
    'sensitive_note_review'
  ));

create index if not exists client_privacy_requests_status_created_idx
  on public.client_privacy_requests (status, created_at desc);

create policy "Privacy managers can read client_notes"
on public.client_notes for select
to authenticated
using (
  app_private.current_staff_has_permission('manage_privacy_operations')
  or app_private.current_staff_has_permission('manage_clients')
);

create policy "Privacy managers can read client_privacy_requests"
on public.client_privacy_requests for select
to authenticated
using (
  app_private.current_staff_has_permission('manage_privacy_operations')
  or app_private.current_staff_has_permission('manage_clients')
);

create policy "Privacy managers can read enquiries"
on public.enquiries for select
to authenticated
using (
  app_private.current_staff_has_permission('manage_privacy_operations')
  or app_private.current_staff_has_permission('manage_clients')
);
