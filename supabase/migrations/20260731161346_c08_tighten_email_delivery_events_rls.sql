-- C-08 security remediation — tighten RLS on email_delivery_events.
--
-- Applied to production project twzutkfgqclqurvkmvqz on 2026-07-31 under
-- explicit Owner approval in chat (protocol §1 rule 2, Zone-2 HARD-STOP).
-- Remote version: 20260731161346.
--
-- WHY
-- The prior policy admitted three permissions: view_email_logs OR
-- resend_booking_emails OR manage_email_settings. In production
-- resend_booking_emails is granted to Owner, Admin, Booking Coordinator AND
-- Therapist (the deliberate "H11 middle path" design), while view_email_logs
-- is granted to Owner, Admin and Coordinator only.
--
-- `authenticated` holds a table-level SELECT grant on this table, so the
-- policy — not the grant — was the only gate. A Therapist could therefore
-- read the whole table with their own session token via PostgREST, bypassing
-- the Next.js app. Since C-04a that table stores to_email, subject,
-- html_payload and text_payload: the full rendered body of every email,
-- including customer names, addresses and appointment details.
--
-- WHY THIS IS SAFE (audited call site by call site, not assumed)
-- All 12 code paths that read or write email_delivery_events use
-- createSupabaseAdminClient() (service role), which bypasses RLS entirely:
-- bookings/actions.ts:477 and :1017, nav-notifications.ts:156 and :346,
-- dashboard-data.ts:465, emails/page.tsx:149, reports/reporting.ts:321, the
-- three cron routes, and notifications.ts:262/:331. No authenticated-role
-- read of this table exists anywhere in the codebase.
--
-- Notably sendManualBookingReminder — the ONLY feature that uses
-- resend_booking_emails — does its own booking_assignments scoping in
-- application code and reads through the admin client. It never relied on
-- this policy, so the dropped clause was pure incidental over-grant.
--
-- /admin/emails is already gated on canViewEmailLogs(profile), so this change
-- aligns the policy with what the UI has always enforced. Owner, Admin and
-- Coordinator lose nothing.
--
-- ROLLBACK (restores the prior, broader policy):
--   drop policy if exists "Email managers can read email_delivery_events"
--     on public.email_delivery_events;
--   create policy "Email managers can read email_delivery_events"
--   on public.email_delivery_events for select to authenticated
--   using (
--     app_private.current_staff_has_permission('view_email_logs')
--     or app_private.current_staff_has_permission('resend_booking_emails')
--     or app_private.current_staff_has_permission('manage_email_settings')
--   );

drop policy if exists "Email managers can read email_delivery_events" on public.email_delivery_events;

create policy "Email managers can read email_delivery_events"
on public.email_delivery_events
for select
to authenticated
using (
  app_private.current_staff_has_permission('view_email_logs')
  or app_private.current_staff_has_permission('manage_email_settings')
);
