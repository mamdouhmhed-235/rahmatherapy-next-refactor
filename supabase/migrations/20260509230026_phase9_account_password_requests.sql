-- ⛔ BACKFILL — reconstructed from live introspection on 2026-08-19.
-- Production ALREADY HAS this migration applied (version 20260509230026,
-- name `phase9_account_password_requests`). It was missing from this
-- directory; see README-MIGRATION-DRIFT.md §1. Do NOT apply it to production.
-- It exists so a rebuild from this directory reaches the same state
-- production is in.
--
-- ⛔ THIS IS THE FILE WHOSE ABSENCE BROKE THE REBUILD. Without it,
-- `20260521130000_realign_payload_consistency_check.sql:18` aborts with
-- 42P01 "relation public.account_password_requests does not exist", and
-- every migration after it never runs.
--
-- What it creates:
--   * enum   public.account_request_status
--   * table  public.account_password_requests (+ 2 CHECKs, 2 FKs, 2 indexes)
--   * RLS    enabled, 4 policies
--   * fn     public.clear_account_password_request_payload()
--   * 2 triggers on the table
--   * grant  select/insert/update to `authenticated`
--   * seed   the `manage_account_requests` row in public.permissions
--
-- ---------------------------------------------------------------------------
-- ⛔ ORDERING — this file must produce the state LATER migrations transform.
-- It deliberately does NOT match today's live schema. Four divergences, each
-- closed by a later file that is already in this directory:
--
--   1. THE ENUM HAS FOUR LABELS, not five. `used` is added by
--      20260521120000_add_used_to_account_request_status.sql. Copying the
--      live five-label enum here would make that migration a no-op and erase
--      the reason it exists.
--   2. THE payload_consistency CHECK IS THE ORIGINAL FORM, not the live one.
--      20260521130000_realign_payload_consistency_check.sql drops it by name
--      (`drop constraint if exists`) and re-adds the realigned version, so
--      whatever this file creates is discarded there. See the note on that
--      constraint below.
--   3. THE clear_payload TRIGGER FUNCTION HAS THE OLD SEMANTICS.
--      20260521150000_realign_clear_payload_trigger.sql replaces it via
--      CREATE OR REPLACE. Its own header states the old semantics verbatim:
--      "On INSERT/UPDATE, if status != 'pending', null out encrypted_payload
--      and payload_nonce." That sentence is the source for the body below.
--   4. service_role GETS NO DML HERE.
--      20260521140000_grant_service_role_dml_on_account_password_requests.sql
--      grants it later, and its header records the pre-state exactly: "only
--      REFERENCES, TRIGGER, TRUNCATE were authorised on the service role".
--      Those three (plus MAINTAIN) arrive automatically from pg_default_acl —
--      verified live: postgres/public/tables grants service_role `Dxtm` — so
--      no explicit service_role statement belongs in this file at all.
--
-- Also NOT here, correctly: the Owner/Admin role grant for the permission
-- seeded below. That is 20260521090000_grant_manage_account_requests_to_owner_admin.sql,
-- whose header says the permission is "already seeded as a row in
-- public.permissions" — this file is where it is seeded, and without it that
-- migration's `insert … select … join public.permissions p on p.name = …`
-- matches zero rows and silently grants nothing.
-- ---------------------------------------------------------------------------
--
-- FIDELITY. Column names, order, types, nullability and defaults; both CHECK
-- names; both FK targets and delete actions; both index definitions; all four
-- policy names, commands, roles and predicates; both trigger names and timing
-- — all read from live catalogs (pg_attribute, pg_constraint, pg_indexes,
-- pg_policies, pg_trigger) on 2026-08-19 and transcribed exactly.
-- ✅ The seeded permission row's created_at is 2026-05-09 23:00:26.839516+00,
-- matching this migration's version 20260509230026 to the second — hard
-- evidence the seed belongs in THIS file.
-- ⚠️ `encrypted_payload` and `payload_nonce` are created as `bytea` here and
-- converted to `text` by the very next migration,
-- 20260509230208_phase9_payload_text.sql (two minutes later — that is what
-- "payload_text" names). Live they are `text`. The original pre-conversion
-- type is NOT recoverable from any catalog; `bytea` is the reading the
-- migration's name and the cipher-version design point to. Nothing runs
-- between the two files, so the intermediate type is unobservable and the end
-- state is correct either way.

-- ---------------------------------------------------------------------------
-- Permission. `category` is left to its default 'system' (set by
-- 20260509143000_granular_rbac_consolidation.sql:14), which is what the live
-- row carries, along with scope 'global', risk_level 'medium', is_system true.
-- ---------------------------------------------------------------------------
insert into public.permissions (name, description)
values (
  'manage_account_requests',
  'Review and approve or reject staff account requests (e.g. password changes).'
)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Enum — FOUR labels. 'used' is added later; see ordering note 1 above.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'account_request_status'
  ) then
    create type public.account_request_status as enum (
      'pending',
      'approved',
      'rejected',
      'expired'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Table.
--
-- payload_cipher_version defaults to 1 — the original design assumed
-- authenticated encryption with a nonce. The shipped scheme is version 0
-- (SHA-256 hash, no nonce); see src/lib/auth/password-reset-token.ts. The
-- default was never changed, so it stays 1 here and live.
--
-- ⚠️ The payload_consistency CHECK below is the ORIGINAL form and is NOT what
-- runs today. Reconstructed from the intent recorded in
-- 20260521130000_realign_payload_consistency_check.sql's header — "the staff
-- member submits their desired new password at request time and the encrypted
-- payload holds that password until approval" — and from the old trigger
-- semantics quoted in 20260521150000's header. Two rules follow: payload and
-- nonce travel together (cipher version 1 needs both), and only a pending row
-- may hold a payload. The exact original SQL text is unrecoverable; because
-- 20260521130000 drops the constraint BY NAME with `if exists` before
-- re-adding, any reasonable original form is safe for the rebuild.
-- ---------------------------------------------------------------------------
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
  constraint account_password_requests_review_consistency check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or status <> 'pending'
  ),
  constraint account_password_requests_payload_consistency check (
    (encrypted_payload is null) = (payload_nonce is null)
    and (status = 'pending' or encrypted_payload is null)
  )
);

create index if not exists account_password_requests_staff_idx
  on public.account_password_requests using btree (staff_id);

-- Partial index: the review queue only ever lists pending rows.
create index if not exists account_password_requests_status_idx
  on public.account_password_requests using btree (status)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Trigger function — OLD semantics; replaced by 20260521150000. See ordering
-- note 3 above.
-- ---------------------------------------------------------------------------
create or replace function public.clear_account_password_request_payload()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.status <> 'pending' then
    new.encrypted_payload := null;
    new.payload_nonce := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists account_password_requests_clear_payload
  on public.account_password_requests;
create trigger account_password_requests_clear_payload
  before insert or update on public.account_password_requests
  for each row execute function public.clear_account_password_request_payload();

drop trigger if exists account_password_requests_updated_at
  on public.account_password_requests;
create trigger account_password_requests_updated_at
  before update on public.account_password_requests
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS. Staff may raise and read their own request; holders of
-- `manage_account_requests` may read all and review them. Nobody may DELETE —
-- there is no delete policy, deliberately: the row is the audit trail.
-- ---------------------------------------------------------------------------
alter table public.account_password_requests enable row level security;

drop policy if exists "Active staff can create own account_password_requests"
  on public.account_password_requests;
create policy "Active staff can create own account_password_requests"
  on public.account_password_requests
  for insert
  to authenticated
  with check (
    staff_id = app_private.current_active_staff_id()
    and status = 'pending'
  );

drop policy if exists "Active staff can read own account_password_requests"
  on public.account_password_requests;
create policy "Active staff can read own account_password_requests"
  on public.account_password_requests
  for select
  to authenticated
  using (staff_id = app_private.current_active_staff_id());

drop policy if exists "Reviewers can read all account_password_requests"
  on public.account_password_requests;
create policy "Reviewers can read all account_password_requests"
  on public.account_password_requests
  for select
  to authenticated
  using (app_private.current_staff_has_permission('manage_account_requests'));

drop policy if exists "Reviewers can update account_password_requests"
  on public.account_password_requests;
create policy "Reviewers can update account_password_requests"
  on public.account_password_requests
  for update
  to authenticated
  using (app_private.current_staff_has_permission('manage_account_requests'))
  with check (app_private.current_staff_has_permission('manage_account_requests'));

-- ---------------------------------------------------------------------------
-- Grants. `authenticated` + RLS is the whole data path at this point; the
-- service role is deliberately excluded. See ordering note 4 above.
-- ---------------------------------------------------------------------------
grant select, insert, update on public.account_password_requests to authenticated;
