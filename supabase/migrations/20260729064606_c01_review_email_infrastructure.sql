-- C-01 - review request email infrastructure (single migration)
--
-- Plan:  redesign/plans/C-phase/C-01-review-request-email-plan.md  §1 Phase A Step 1
-- Brief: redesign/briefs/C-01-review-request-email-brief.md        §2.1, §6
-- Date:  2026-07-29
--
-- Statements (numbered per the plan's own Step 1 SQL):
--   1  bookings.completed_at + bookings.review_email_sent_at - new nullable columns
--   2  bookings_set_completed_at() trigger function + bookings_completed_at_trigger
--   3  email_delivery_events.event_type CHECK - evaluated, NOT needed (see note below)
--   4  backfill - completed_at = updated_at, then review_email_sent_at = completed_at,
--      for the existing completed bookings (marks them "already handled")
--   5  defensive suppression - Owner test account rahmatherapy@outlook.com
--
-- Statement 3 (the conditional CHECK update the plan's Step 1 sketches) is a
-- NO-OP here: pre-flight confirmed no CHECK constraint exists on
-- email_delivery_events.event_type today (the only CHECK on that table is on
-- delivery_status, added by C-04a), so 'review_request_client' is already a
-- valid value with no constraint change needed. Same resolution as C-04a's own
-- equivalent conditional. Left as a comment below rather than omitted, so the
-- file documents that this was evaluated, not skipped by oversight.
--
-- EVERY statement is idempotent: re-applying this file is a no-op. Columns use
-- `ADD COLUMN IF NOT EXISTS`; the trigger uses `CREATE OR REPLACE FUNCTION` +
-- `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`; both backfill UPDATEs only
-- write where the target column is still NULL; the suppression UPDATE uses
-- COALESCE(review_email_sent_at, now()) so a second apply cannot overwrite an
-- already-set sentinel.
--
-- Production state at write time (verified read-only 2026-07-29, orchestrator
-- pre-flight): only 2 completed bookings exist, both *.example.test fixtures
-- (77f90d24..., ae9bb5bd...) - statement 4's target set. 0 bookings currently
-- have contact_email = 'rahmatherapy@outlook.com', so statement 5 matches 0
-- rows today - kept as a no-op-today safety net for future Owner test bookings
-- per brief §6 / plan §9.6.

BEGIN;

-- 1. New columns on bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS review_email_sent_at timestamptz;

-- 2. Trigger to set completed_at on transition INTO 'completed' status.
--    On reopen (completed → other), preserve historical completed_at so
--    audit forensics + sentinel stay consistent.
CREATE OR REPLACE FUNCTION public.bookings_set_completed_at() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.completed_at = now();
  ELSIF NEW.status <> 'completed' AND OLD.completed_at IS NOT NULL THEN
    NEW.completed_at = OLD.completed_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bookings_completed_at_trigger ON public.bookings;
CREATE TRIGGER bookings_completed_at_trigger
  BEFORE UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_set_completed_at();

-- 3. email_event_type CHECK - evaluated at pre-flight (2026-07-29) and NOT
--    needed: no CHECK constraint exists on email_delivery_events.event_type
--    today (the only CHECK on that table is on delivery_status, added by
--    C-04a), so 'review_request_client' is already a valid value. Skipped.

-- 4. Backfill - 2 existing completed bookings get completed_at = updated_at
--    and review_email_sent_at = completed_at (marks them as "already handled")
UPDATE public.bookings
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;

UPDATE public.bookings
SET review_email_sent_at = completed_at
WHERE status = 'completed' AND review_email_sent_at IS NULL;

-- 5. Defensive: suppress review email for the Owner test account
UPDATE public.bookings
SET review_email_sent_at = COALESCE(review_email_sent_at, now())
WHERE contact_email = 'rahmatherapy@outlook.com';

COMMIT;
