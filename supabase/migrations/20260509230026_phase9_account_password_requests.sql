-- ⛔ BACKFILL — RECOVERED VERBATIM from production's migration ledger on
-- 2026-08-19 (gate 05, case D1). Production ALREADY HAS this migration applied
-- (version 20260509230026, name `phase9_account_password_requests`). It was
-- missing from this directory; see README-MIGRATION-DRIFT.md §1. Do NOT apply
-- it to production. It exists so a rebuild from this directory reaches the
-- same state production is in.
--
-- ✅ PROVENANCE: everything below the marker is the exact text recorded in
-- `supabase_migrations.schema_migrations.statements` for this version — not a
-- reconstruction.
--
-- ⛔ THIS IS THE FILE WHOSE ABSENCE BROKE THE REBUILD. It creates
-- `public.account_password_requests` and the `public.account_request_status`
-- enum. Four later migrations alter both, so without this file a rebuild from
-- this directory aborted with 42P01 partway through and production was the
-- only authoritative copy of the schema.

-- Phase 9 — Auditable staff password change request workflow (issue #124)

insert into public.permissions (name, description)
values (
  'manage_account_requests',
  'Review and approve or reject staff account requests (e.g. password changes).'
)
on conflict (name) do update
  set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
  from public.roles
  cross join public.permissions
 where roles.name in ('Owner', 'Admin')
   and permissions.name = 'manage_account_requests'
on conflict do nothing;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_request_status') then
    create type public.account_request_status as enum (
      'pending', 'approved', 'rejected', 'expired'
    );
  end if;
end $$;

create table if not exists public.account_password_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  status public.account_request_status not null default 'pending',
  encrypted_payload bytea,
  payload_nonce bytea,
  payload_cipher_version smallint not null default 1,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.staff_profiles(id) on delete set null,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_password_requests_payload_consistency check (
    (status = 'pending'
       and encrypted_payload is not null
       and payload_nonce is not null)
    or
    (status <> 'pending'
       and encrypted_payload is null
       and payload_nonce is null)
  ),
  constraint account_password_requests_review_consistency check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or status <> 'pending'
  )
);

create index if not exists account_password_requests_staff_idx
  on public.account_password_requests (staff_id);
create index if not exists account_password_requests_status_idx
  on public.account_password_requests (status)
  where status = 'pending';

drop trigger if exists account_password_requests_updated_at on public.account_password_requests;
create trigger account_password_requests_updated_at
before update on public.account_password_requests
for each row execute function public.update_updated_at_column();

create or replace function public.clear_account_password_request_payload()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status <> 'pending' then
    new.encrypted_payload := null;
    new.payload_nonce := null;
  end if;
  return new;
end;
$$;

drop trigger if exists account_password_requests_clear_payload on public.account_password_requests;
create trigger account_password_requests_clear_payload
before insert or update on public.account_password_requests
for each row execute function public.clear_account_password_request_payload();

alter table public.account_password_requests enable row level security;

drop policy if exists "Active staff can read own account_password_requests" on public.account_password_requests;
drop policy if exists "Reviewers can read all account_password_requests" on public.account_password_requests;
drop policy if exists "Active staff can create own account_password_requests" on public.account_password_requests;
drop policy if exists "Reviewers can update account_password_requests" on public.account_password_requests;

create policy "Active staff can read own account_password_requests"
on public.account_password_requests for select
to authenticated
using (staff_id = app_private.current_active_staff_id());

create policy "Reviewers can read all account_password_requests"
on public.account_password_requests for select
to authenticated
using (app_private.current_staff_has_permission('manage_account_requests'));

create policy "Active staff can create own account_password_requests"
on public.account_password_requests for insert
to authenticated
with check (
  staff_id = app_private.current_active_staff_id()
  and status = 'pending'
);

create policy "Reviewers can update account_password_requests"
on public.account_password_requests for update
to authenticated
using (app_private.current_staff_has_permission('manage_account_requests'))
with check (app_private.current_staff_has_permission('manage_account_requests'));

revoke all on public.account_password_requests from anon, authenticated;
grant select, insert, update on public.account_password_requests to authenticated;
