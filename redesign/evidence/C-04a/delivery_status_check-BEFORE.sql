-- Live definition of the constraint C-04a's migration drops and re-adds.
-- Captured 2026-07-28, read-only, from production project twzutkfgqclqurvkmvqz:
--
--   SELECT conname, pg_get_constraintdef(oid) AS condef, contype
--   FROM pg_constraint
--   WHERE conrelid = 'public.email_delivery_events'::regclass
--   ORDER BY conname;
--
-- Full result (4 constraints; only the CHECK is touched by C-04a):
--   email_delivery_events_pkey             p  PRIMARY KEY (id)
--   email_delivery_events_booking_id_fkey  f  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
--   email_delivery_events_staff_id_fkey    f  FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE SET NULL
--   email_delivery_events_delivery_status_check  c  <below, verbatim>
--
-- conname: email_delivery_events_delivery_status_check
-- pg_get_constraintdef output, verbatim:

CHECK ((delivery_status = ANY (ARRAY['accepted'::text, 'failed'::text, 'skipped'::text])))

-- ---------------------------------------------------------------------------
-- ROLLBACK (plan §5.2). Restores the constraint exactly as captured above.
-- Precondition: SELECT DISTINCT delivery_status FROM email_delivery_events;
-- must return only accepted / failed / skipped, or the re-ADD fails.
-- Live values at capture time: 'accepted' only (42 rows).
-- ---------------------------------------------------------------------------
-- alter table public.email_delivery_events
--   drop constraint if exists email_delivery_events_delivery_status_check;
-- alter table public.email_delivery_events
--   add constraint email_delivery_events_delivery_status_check
--   check ((delivery_status = ANY (ARRAY['accepted'::text, 'failed'::text, 'skipped'::text])));
