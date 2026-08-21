alter table public.email_delivery_events add column if not exists scheduled_for timestamptz;
alter table public.email_delivery_events add column if not exists html_payload text;
alter table public.email_delivery_events add column if not exists text_payload text;
alter table public.email_delivery_events add column if not exists to_email text;
alter table public.email_delivery_events add column if not exists subject text;

comment on column public.email_delivery_events.scheduled_for is
  'When set, this row is queued for a scheduled-emails cron tick. NULL = immediate send (legacy semantics).';
comment on column public.email_delivery_events.html_payload is
  'Rendered HTML body stored alongside scheduled_for so the cron can dispatch without re-rendering.';
comment on column public.email_delivery_events.text_payload is
  'Rendered plain-text body, stored alongside html_payload for the same reason.';
comment on column public.email_delivery_events.to_email is
  'Recipient address captured at queue time. Mirrors recipient_email; the cron reads this one.';
comment on column public.email_delivery_events.subject is
  'Rendered subject line stored at queue time so the cron can dispatch without re-rendering.';

create index if not exists idx_email_delivery_events_scheduled_pending
  on public.email_delivery_events (scheduled_for)
  where scheduled_for is not null and delivery_status = 'queued';

alter table public.email_delivery_events
  drop constraint if exists email_delivery_events_delivery_status_check;
alter table public.email_delivery_events
  add constraint email_delivery_events_delivery_status_check
  check (delivery_status in (
    'accepted', 'failed', 'skipped',
    'queued', 'sent', 'cancelled_by_restore', 'cancelled_manual'
  ));

alter table public.bookings add column if not exists cancelled_at timestamptz;
comment on column public.bookings.cancelled_at is
  'When the booking was last cancelled (any path). Cleared on restore. S7 restore-window key; customer_cancelled_at remains the customer-flow-specific record.';

update public.bookings
set cancelled_at = customer_cancelled_at
where status = 'cancelled'
  and customer_cancelled_at is not null
  and cancelled_at is null
  and id <> '9d55ce2a-7a76-42ed-9166-a33fa66ee7fe';

update public.bookings b
set cancelled_at = a.latest
from (
  select target_id::uuid as booking_id, max(created_at) as latest
  from public.audit_logs
  where action_type in (
      'booking_management_updated',
      'booking_quick_cancel',
      'customer_booking_cancelled'
    )
    and after_state->>'status' = 'cancelled'
  group by target_id
) a
where b.id = a.booking_id
  and b.status = 'cancelled'
  and b.cancelled_at is null
  and b.id <> '9d55ce2a-7a76-42ed-9166-a33fa66ee7fe';