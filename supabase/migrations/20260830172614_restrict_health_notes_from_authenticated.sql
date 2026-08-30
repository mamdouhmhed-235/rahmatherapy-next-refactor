-- F-21-01 / F-21-08 — health notes were readable at the DATABASE level by any
-- signed-in staff member whose role can read bookings, even though every screen
-- correctly hides them.
--
-- Row-level security is ROW-level, not COLUMN-level: the "Permitted staff can
-- read bookings" policy admits anyone holding view_bookings_all or
-- manage_bookings_all, and once a row is admitted EVERY column comes with it.
-- Booking Coordinator holds view_bookings_all and there are 2 active ones, so a
-- coordinator using their own session token could read health notes straight
-- from PostgREST, bypassing the UI that hides them.
--
-- ⛔ WHY COLUMN GRANTS AND NOT A BLANKET REVOKE. Revoking SELECT on `bookings`
-- outright would also break the `booking_participants` policy, whose USING
-- clause runs `SELECT 1 FROM bookings ...` as the querying user. Column-level
-- grants keep that lookup working (it only needs `id`) while removing exactly
-- the two sensitive columns.
--
-- ⛔ WHY THIS BREAKS NOTHING. Verified before applying: every admin read of
-- bookings goes through the service-role client (116 files), not the signed-in
-- user's. The only file reading health_notes with just the server client is
-- admin/clients/[clientId]/page.tsx, which uses it solely for the sign-in check
-- and renders notes fetched elsewhere by the service role. The only realtime
-- subscription in the app is on notification_state, not bookings.
--
-- ⚠️ A column added to these tables later will NOT be granted to `authenticated`
-- until this list is updated. That fails SAFE — no access rather than accidental
-- access — but it will look like a missing column to anyone querying as a
-- signed-in user. service_role is unaffected and keeps full access.
--
-- Verified after applying, with has_column_privilege():
--   bookings.health_notes             authenticated=false  service_role=true
--   bookings.treatment_notes          authenticated=false  service_role=true
--   booking_participants.health_notes authenticated=false  service_role=true
--   booking_participants.participant_notes authenticated=false service_role=true
--   bookings.id / contact_full_name / booking_date        authenticated=true
--   booking_participants.id / display_name                authenticated=true

revoke select on public.bookings from authenticated;

grant select (
  id, client_id, booking_date, start_time, end_time, total_duration_mins,
  total_price, payment_method, payment_status, status, assignment_status,
  group_booking, manage_token_hash, manage_token_expires_at,
  customer_cancelled_at, customer_manage_notes, service_address_line1,
  service_address_line2, service_city, service_postcode, access_notes,
  customer_notes, admin_notes, created_at, updated_at, consent_acknowledged,
  contact_full_name, contact_email, contact_phone, booking_source, amount_due,
  amount_paid, paid_at, payment_note, customer_cancellation_note,
  last_customer_manage_action_at, reschedule_requested_at,
  reschedule_preferred_date, reschedule_preferred_time, reschedule_note,
  reschedule_status, deleted_at, cancelled_at, completed_at,
  review_email_sent_at, recurring_template_id, travel_fee,
  recurring_occurrence_date
) on public.bookings to authenticated;

revoke select on public.booking_participants from authenticated;

grant select (
  id, booking_id, participant_gender, required_therapist_gender,
  is_main_contact, display_name, consent_acknowledged
) on public.booking_participants to authenticated;
