-- R4 Notification Centre redesign — server-persisted per-staff state for
-- read / snoozed / archived flags on derived notifications. The notifications
-- themselves remain derived from source tables (bookings, enquiries,
-- email_delivery_events, operational_events) via nav-notifications.ts; this
-- table stores only per-(staff, notification_id) flags. notification_id is a
-- stable derived hash like 'booking:<uuid>:unassigned' or 'enquiry:<uuid>:new'.
-- See plan: C:\Users\mamdo\.claude\plans\lets-start-with-r4-lazy-stroustrup.md.

create table public.notification_state (
  staff_id        uuid not null references public.staff_profiles(id) on delete cascade,
  notification_id text not null,
  read_at         timestamptz,
  snoozed_until   timestamptz,
  archived_at     timestamptz,
  updated_at      timestamptz not null default now(),
  primary key (staff_id, notification_id)
);

-- Supports the active-tab query path: per-staff scan filtered by snooze /
-- archive state. The PK (staff_id, notification_id) already covers point
-- lookups by ID; this index covers list-scan-with-state-filter.
create index notification_state_active_idx
  on public.notification_state (staff_id, snoozed_until, archived_at);

alter table public.notification_state enable row level security;

-- Each staff member can only see and modify their own rows. Uses the
-- existing app_private.current_active_staff_id() helper (defined in
-- 20260503095000_phase16_private_rls_helpers.sql), which resolves the
-- current authenticated user's active staff_profiles.id.
create policy "Own notification_state select"
on public.notification_state for select
to authenticated
using (staff_id = app_private.current_active_staff_id());

create policy "Own notification_state insert"
on public.notification_state for insert
to authenticated
with check (staff_id = app_private.current_active_staff_id());

create policy "Own notification_state update"
on public.notification_state for update
to authenticated
using (staff_id = app_private.current_active_staff_id())
with check (staff_id = app_private.current_active_staff_id());

create policy "Own notification_state delete"
on public.notification_state for delete
to authenticated
using (staff_id = app_private.current_active_staff_id());

-- Service-role DML grant so admin-client server actions (createSupabaseAdminClient)
-- can write through during state merges. Mirrors the explicit grant pattern
-- established in 20260521140000_grant_service_role_dml_on_account_password_requests.sql.
grant select, insert, update, delete on public.notification_state to service_role;

-- Enable Supabase Realtime so clients can subscribe to per-staff state changes
-- for cross-device sync. RLS scopes the broadcast payloads to own rows.
alter publication supabase_realtime add table public.notification_state;
