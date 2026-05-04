alter table public.client_notes enable row level security;
alter table public.client_privacy_requests enable row level security;
alter table public.enquiries enable row level security;

grant select, insert, update, delete on public.client_notes to service_role;
grant select, insert, update, delete on public.client_privacy_requests to service_role;
grant select, insert, update, delete on public.enquiries to service_role;
