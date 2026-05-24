-- B-2 Metric backend — query-pattern indexes for the new Band B helpers.
--   audit_logs_actor_recent_idx                 → getAuditLogForStaff (B-3 Performance timeline; B-2 helper)
--   booking_assignments_assigned_staff_status_idx → filterReportDataToStaff + getStaffScorecard per-staff scans
--   bookings_client_status_completed_idx        → getClientLifetimeMetrics retention math (B-6 LTV ribbon)
-- All idempotent (`create index if not exists`); safe to re-apply.
-- See SHARED-IMPLEMENTATION-NOTES.md §1.
-- Plan: redesign/plans/B-phase/B2-metric-backend-plan.md (step 3).

create index if not exists audit_logs_actor_recent_idx
  on public.audit_logs (actor_staff_id, created_at desc)
  where actor_staff_id is not null;

create index if not exists booking_assignments_assigned_staff_status_idx
  on public.booking_assignments (assigned_staff_id, status);

create index if not exists bookings_client_status_completed_idx
  on public.bookings (client_id, status)
  where status = 'completed';
