-- B-2 Metric backend — per-staff persistent dismissal of Reports Insights stripe rows.
-- Composite PK (staff_id, insight_id); insight_id is a stable hash like
-- 'bookings-dropped-15pct-this_week-2026-05' encoding category + 5%-bucketed delta + period.
-- Mirrors the R4 notification_state pattern (see 20260521160000_create_notification_state.sql):
-- RLS scoped via app_private.current_active_staff_id() + explicit service_role DML grant.
-- See SHARED-IMPLEMENTATION-NOTES.md §14 (AUDIT-2026-05-22 Q6 resolution).
-- Plan: redesign/plans/B-phase/B2-metric-backend-plan.md (step 3.5).

create table if not exists public.insight_dismissals (
  staff_id      uuid        not null references public.staff_profiles(id) on delete cascade,
  insight_id    text        not null,
  dismissed_at  timestamptz not null default now(),
  primary key (staff_id, insight_id)
);

comment on table public.insight_dismissals is
  'Per-staff dismissal tracking for the Reports Insights stripe. insight_id is a stable hash like bookings-dropped-15pct-this_week-2026-05 encoding category + delta-bucket + period.';

-- Recent-first scan for the page-side fetch (select where staff_id = me, order by dismissed_at desc).
create index if not exists insight_dismissals_staff_recent_idx
  on public.insight_dismissals (staff_id, dismissed_at desc);

alter table public.insight_dismissals enable row level security;

-- Each staff member can only see and write their own dismissals. Uses the
-- existing app_private.current_active_staff_id() helper (defined in
-- 20260503095000_phase16_private_rls_helpers.sql).
create policy "Own insight_dismissals select"
on public.insight_dismissals for select
to authenticated
using (staff_id = app_private.current_active_staff_id());

create policy "Own insight_dismissals insert"
on public.insight_dismissals for insert
to authenticated
with check (staff_id = app_private.current_active_staff_id());

create policy "Own insight_dismissals delete"
on public.insight_dismissals for delete
to authenticated
using (staff_id = app_private.current_active_staff_id());

-- Service-role DML grant so the dismissInsight server action
-- (createSupabaseAdminClient) can write through. Mirrors the explicit
-- grant pattern from notification_state.
grant select, insert, delete on public.insight_dismissals to service_role;
