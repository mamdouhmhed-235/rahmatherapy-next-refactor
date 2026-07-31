-- C-08 — business-notification preferences + resend-linkage storage.
--
-- Plan:  redesign/plans/C-phase/C-08-email-automation-expansion-plan.md  §1 Phase D Step 13
-- Brief: redesign/briefs/C-08-email-automation-expansion-brief.md        §2.7–§2.9
-- Date:  2026-07-31
--
-- Applied to production project twzutkfgqclqurvkmvqz under explicit Owner
-- approval in chat (protocol §1 rule 2, Zone-2 HARD-STOP). SQL applied verbatim
-- as presented for approval. Remote version: 20260731192911.
--
-- Statements:
--   1  staff_profiles.notification_email          - optional alternate address for business alerts
--   2  staff_profiles.business_notification_prefs - per-actor opt-in + per-type toggles
--   3  seed - active Owner rows opted in from day one
--   4  email_delivery_events.metadata             - absorbs the old Phase C Step 7
--                                                   conditional migration (one migration, not two)
--
-- PRE-FLIGHT VERIFIED BEFORE APPLYING (SELECT-only, protocol §3b):
--   * all three columns absent (0 rows from information_schema.columns)
--   * has_table_privilege('service_role', 'staff_profiles', 'UPDATE')        -> true
--   * has_table_privilege('service_role', 'email_delivery_events', 'UPDATE') -> true
--     (the C-04a silent-42501 trap does NOT apply here; that check is mandatory
--      before the first write of a kind because this project grants per table)
--   * exactly 2 active Owner rows of 12 staff rows
--
-- THE SEED TOUCHES REAL PRODUCTION DATA. It sets business_notification_prefs on
-- the two active Owner rows and nothing else:
--   b0f79294-74c0-40e6-8e5f-ade81c1d4d87  phase10.owner@example.test  (fixture)
--   01582c5d-bd75-4c49-b207-6f5597e15218  rahmatherapy@outlook.com    (the real Owner)
-- The `AND sp.business_notification_prefs IS NULL` clause makes it idempotent —
-- a re-run will not clobber a preference the Owner has since changed in the UI.
-- No email is sent by this migration; alerts only begin once Steps 14–16 route
-- the internal sends through resolveBusinessNotificationRecipients.
--
-- POST-APPLY VERIFICATION (run, output posted in chat):
--   3 columns present with expected types/defaults
--   seeded row count = 2 = active Owner count; both rows are the two ids above
--   notification_email NULL on all 12 rows; zero email_delivery_events rows
--   with non-default metadata
--
-- ⚠️ CONSUMER TRAP for Step 14 (pre-empted here so it is not discovered live):
-- the seed writes {"enabled": true} with NO `types` key. A resolver testing
-- `prefs.types[type] === false` must therefore treat a missing `types` as
-- "all types on". Getting that inverted silently disables every alert for the
-- only opted-in user — a failure that is invisible in tests and in the UI.
--
-- ROLLBACK:
--   alter table public.staff_profiles drop column if exists notification_email;
--   alter table public.staff_profiles drop column if exists business_notification_prefs;
--   alter table public.email_delivery_events drop column if exists metadata;
--   -- Dropping the columns discards the seed with them. To undo ONLY the seed:
--   --   update public.staff_profiles set business_notification_prefs = null
--   --   where business_notification_prefs = '{"enabled": true}'::jsonb;

BEGIN;

ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS notification_email text,
  ADD COLUMN IF NOT EXISTS business_notification_prefs jsonb;

-- Seed: Owner opted in from day one (all alert types default on).
UPDATE public.staff_profiles sp
SET business_notification_prefs = '{"enabled": true}'::jsonb
FROM public.roles r
WHERE sp.role_id = r.id AND r.name = 'Owner' AND sp.active = true
  AND sp.business_notification_prefs IS NULL;

-- Conditional (pre-flight #5b): resend linkage storage.
ALTER TABLE public.email_delivery_events
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

COMMIT;
