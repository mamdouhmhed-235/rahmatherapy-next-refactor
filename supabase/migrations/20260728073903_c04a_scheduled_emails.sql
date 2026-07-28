-- C-04a - delayed-email infrastructure + unified cancellation timestamp
--
-- Plan:  redesign/plans/C-phase/C-04a-cancellation-restore-plan.md  §1 Phase F Step 10
-- Brief: redesign/briefs/C-04a-cancellation-restore-brief.md        §2.8, §6
-- Date:  2026-07-28
--
-- Statements:
--   1  email_delivery_events - five nullable columns for the queued-send payload
--   2  partial index over the cron's exact candidate predicate
--   3  email_delivery_events.delivery_status CHECK - extended with the four new
--      lifecycle values (drop + re-add; the live definition is captured verbatim
--      at redesign/evidence/C-04a/delivery_status_check-BEFORE.sql, which is the
--      rollback source)
--   4  bookings.cancelled_at - the S7 28-day restore-window key
--   5  backfill 1 - customer-cancelled rows, from customer_cancelled_at
--   6  backfill 2 - admin/customer-cancelled rows, from the latest cancel audit row
--
-- NEITHER backfill writes to booking 9d55ce2a-7a76-42ed-9166-a33fa66ee7fe: it is
-- on the DO-NOT-TOUCH list in redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md
-- §1.7. Both statements carry an explicit exclusion - statement 6 holds the
-- row-specific rationale.
--
-- EVERY statement is idempotent: re-applying this file is a no-op. Guarded with
-- `if not exists` / `drop constraint if exists` before the re-add, and both
-- backfills only ever write where cancelled_at is still NULL, so a re-apply can
-- never clobber a timestamp written after the first apply.
--
-- Nothing here writes a delivery_status value, so statement order between 1-3 is
-- free; 4 must precede 5-6, and 1 must precede 2.

begin;

-- ---------------------------------------------------------------------------
-- 1. Queued-send payload columns (Change 13a).
--    scheduled_for NULL = immediate send, which is every one of the 42 existing
--    rows - legacy semantics are preserved untouched. Only rows written by
--    sendTrackedEmail's delaySeconds branch populate the other four.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 2. Partial index matching the cron's candidate query exactly
--    (delivery_status = 'queued' AND scheduled_for <= now(), ordered by
--    scheduled_for). The partial predicate keeps it to queued rows only, so it
--    stays a handful of entries however large the table grows.
-- ---------------------------------------------------------------------------
create index if not exists idx_email_delivery_events_scheduled_pending
  on public.email_delivery_events (scheduled_for)
  where scheduled_for is not null and delivery_status = 'queued';

-- ---------------------------------------------------------------------------
-- 3. delivery_status CHECK extension.
--
--    Live definition, captured read-only 2026-07-28 (evidence file above):
--      CHECK ((delivery_status = ANY (ARRAY['accepted'::text, 'failed'::text, 'skipped'::text])))
--
--    Without this every queue insert fails at runtime. The four added values:
--      queued               sendTrackedEmail's delaySeconds branch (Step 11)
--      sent                 the scheduled-emails cron on a successful dispatch (Step 12)
--      cancelled_by_restore restoreBooking killing a queued cancellation email (Step 1)
--      cancelled_manual     the rollback drain in plan §5.2
--
--    Live data is 'accepted' only (42 rows), so the re-add validates instantly
--    and the widened set cannot reject an existing row.
-- ---------------------------------------------------------------------------
alter table public.email_delivery_events
  drop constraint if exists email_delivery_events_delivery_status_check;

alter table public.email_delivery_events
  add constraint email_delivery_events_delivery_status_check
  check (delivery_status in (
    'accepted', 'failed', 'skipped',
    'queued', 'sent', 'cancelled_by_restore', 'cancelled_manual'
  ));

-- ---------------------------------------------------------------------------
-- 4. bookings.cancelled_at (S7 amendment 2026-07-16).
--    Admin cancels stamp nothing on the booking row today - customer_cancelled_at
--    is written only by the customer-facing /booking/manage path - so the 28-day
--    restore window needs a unified column.
--
--    NOTE: C-06's deleteClient cascade (clients/actions.ts:599-609) ALREADY
--    writes cancelled_at, behind a missing-column fallback. The moment this
--    statement lands, that fallback stops firing and the cascade starts stamping
--    for real. No code change needed there.
-- ---------------------------------------------------------------------------
alter table public.bookings add column if not exists cancelled_at timestamptz;

comment on column public.bookings.cancelled_at is
  'When the booking was last cancelled (any path). Cleared on restore. S7 restore-window key; customer_cancelled_at remains the customer-flow-specific record.';

-- ---------------------------------------------------------------------------
-- 5. Backfill 1 - customer-cancelled rows already carry their own timestamp.
--    `cancelled_at is null` is not in the plan's text; it is added so a re-apply
--    cannot overwrite a fresher cancelled_at with a stale customer_cancelled_at.
--    Stamps 0 rows today (no live cancelled booking has customer_cancelled_at).
--
--    The `id <> '9d55ce2a...'` exclusion below is the same DO-NOT-TOUCH
--    exclusion as statement 6 (full rationale there). It matches nothing today -
--    that booking has no customer_cancelled_at - but this statement's predicate
--    is state-dependent and this file is idempotent by design, i.e. built to be
--    safely re-applied later. Any future write of customer_cancelled_at on the
--    protected row would pull it into scope on the next apply. Carrying the
--    exclusion in both backfills makes "this migration never writes to booking
--    9d55ce2a" a property of the file itself rather than of a row count that
--    happened to be zero on 2026-07-28.
-- ---------------------------------------------------------------------------
update public.bookings
set cancelled_at = customer_cancelled_at
where status = 'cancelled'
  and customer_cancelled_at is not null
  and cancelled_at is null
  -- Protocol §1.7 DO-NOT-TOUCH (see statement 6).
  and id <> '9d55ce2a-7a76-42ed-9166-a33fa66ee7fe';

-- ---------------------------------------------------------------------------
-- 6. Backfill 2 (best-effort) - the latest cancel audit row.
--
--    ACTION-TYPE AUDIT (Owner decision 2, 2026-07-27; counts verified read-only
--    against production 2026-07-28). The plan's original single filter
--    `action_type = 'booking_management_updated'` stamps ZERO of the two live
--    cancelled bookings: both were cancelled through the quick action, which
--    writes `booking_quick_cancel` (actions.ts:689). Every action_type in the
--    codebase that can record a booking landing in `cancelled`:
--
--      booking_management_updated   Status form           -> 0 rows stamped
--                                   (its 2 matching audit rows point at bookings
--                                    that are no longer cancelled)
--      booking_quick_cancel         cancel quick action   -> 2 candidate rows,
--                                   1 stamped (the other is the DO-NOT-TOUCH
--                                   row excluded below)
--      customer_booking_cancelled   /booking/manage       -> 0 rows (none exist yet);
--                                   that population is backfill 1's anyway, this is
--                                   belt-and-braces for a cleared customer_cancelled_at
--      client_deleted               C-06 delete cascade   -> UNREACHABLE by design:
--                                   target_id is the CLIENT id, and the booking ids
--                                   live in after_state.cascaded_booking_ids. Zero such
--                                   rows exist, and statement 4's note explains why no
--                                   backfill is needed for it.
--
--    Combined coverage after this statement: 1 of the 2 live cancelled bookings
--    (0 from backfill 1, 1 here). The second is deliberately left unstamped -
--    see the exclusion below. Rows neither backfill reaches stay NULL -> the S7
--    guard treats them as window-expired (fail-closed, brief §5.12).
--
--    DO-NOT-TOUCH EXCLUSION - Owner decision taken 2026-07-28.
--    Why one booking id is hardcoded in a migration: 9d55ce2a-7a76-42ed-9166-
--    a33fa66ee7fe is Badar's booking, a REAL customer, and it is named on the
--    DO-NOT-TOUCH list in redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md §1.7
--    - nothing in this programme (migration, script, test or admin action) may
--    write to that row. Unexcluded, this statement would have written
--        cancelled_at := 2026-05-19 17:16:59.155691+00
--    to it, so the exclusion sits on the WHERE clause below.
--
--    Nothing is lost by excluding it. The appointment is dated 2026-05-20, so
--    the S6 past-appointment guard refuses restore regardless of this column;
--    and the cancellation is ~70 days old, so the S7 28-day window guard is
--    expired whether cancelled_at holds that timestamp or stays NULL (NULL
--    fail-closes to the same refusal, brief §5.12). The outcome is identical
--    either way, so the tie is broken in favour of keeping §1.7 absolute rather
--    than letting it become a per-row judgement call.
--
--    The row that IS stamped is eaafbb1a (audit.client.5...@example.test) - a
--    *.example.test fixture, which §1.7 explicitly permits.
--
--    JSON path verified at pre-flight: after_state is the full booking row, so
--    after_state->>'status' is the post-write status. audit_logs.target_id is a
--    uuid column already; the ::uuid cast is a no-op kept for parity with the plan.
-- ---------------------------------------------------------------------------
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
  -- Protocol §1.7 DO-NOT-TOUCH - Badar's real booking; rationale in the block above.
  and b.id <> '9d55ce2a-7a76-42ed-9166-a33fa66ee7fe';

commit;
