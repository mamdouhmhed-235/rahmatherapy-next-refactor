-- B-2 Metric backend — add nullable first_contacted_at to enquiries to power
-- the time-to-first-contact metric (getStaffScorecard.admin.avgMinutesToFirstContact).
-- Idempotent guard lives at the server-action layer (updateEnquiryStatus only writes
-- the timestamp on the first transition to status='contacted'). Partial index covers
-- the metric query path (rows with the timestamp set).
-- Plan: redesign/plans/B-phase/B2-metric-backend-plan.md (step 2).

alter table public.enquiries
  add column if not exists first_contacted_at timestamptz null;

comment on column public.enquiries.first_contacted_at is
  'Set to now() on first transition to status=contacted (idempotent guard at action layer). Powers the time-to-first-contact metric.';

create index if not exists enquiries_first_contacted_at_idx
  on public.enquiries (first_contacted_at)
  where first_contacted_at is not null;
