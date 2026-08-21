-- ============================================================================
-- 11-service-visibility.sql — regression tests for PR-011 and FIND-03-B
--
-- ⛔ READ supabase/tests/README.md FIRST. Every block below runs against
-- PRODUCTION inside a transaction that is ROLLED BACK, which is what makes it
-- safe. Do not remove a `rollback;`.
--
-- ⛔ WHAT THIS FILE IS ABOUT — money, and records of what was sold.
--
-- `public.create_booking_request` filters services TWICE, on DIFFERENT rules:
--
--     line  99  price + duration sum   ... where slug = any(...) and is_active = true
--     line 611  booking_items insert   ... and services.is_active = true
--     line 612                         ... and services.is_visible_on_frontend = true
--
-- So a service that is ACTIVE but HIDDEN contributes its price and its minutes
-- to the booking, and then produces NO LINE ITEM. The customer is charged for
-- something that leaves no record of what it was, and the appointment still
-- reserves therapist time.
--
-- MEASURED 2026-08-21 against twzutkfgqclqurvkmvqz — see BLOCK 1.
--
-- ⛔⛔ CORRECTION 2026-08-21, AFTER AN INDEPENDENT AUDIT. The paragraph that
-- stood here OVERSTATED how reachable this is, and one sentence of it was
-- simply FALSE. Both are corrected rather than quietly edited away:
--
--   FALSE was: "the public booking form … does not consult the services table
--   at all."  ⛔ `src/lib/booking/availability.ts:440-444` DOES read `services`
--   filtering on BOTH `is_active` AND `is_visible_on_frontend`, and it is a
--   PUBLIC path — `/api/availability` and `/api/availability/month`, which the
--   customer's ScheduleStep calls to draw the time slots.
--
--   OVERSTATED was: "customers can still book it." ⛔ They could not, through
--   the real UI. A hidden service makes that read return fewer rows than were
--   asked for, so availability answers "Selected service is unavailable." with
--   ZERO slots and the customer cannot reach a submit at all.
--
-- ⚠️ WHAT REMAINS TRUE, and it is why this file still matters: `POST
-- /api/bookings` does NOT re-check availability — it validates and calls
-- createBookingTransaction directly. So the defect below was reachable by a
-- hand-crafted request that skipped the booking form, and by any future caller
-- that likewise bypasses the availability step.
--
-- ⚠️ NOT REACHABLE FROM THE ADMIN BOOKING SCREEN'S QUERY: `src/app/admin/
-- bookings/new/page.tsx` filters on BOTH flags. ⛔ But the FORM ignored that
-- prop and rendered a hardcoded list until `da5f91e` — and standing/recurring
-- bookings had no visibility check at all until the same commit. See FIND-03-B.
--
-- ⚠️ Latent today: all 5 services are active AND visible, so no live booking is
-- affected. It arms the moment somebody uses "Hide from website".
-- ============================================================================


-- ============================================================================
-- BLOCK 1 — PR-011: a hidden-but-active service is CHARGED but not ITEMISED
--
-- P1 is the regression. P2 is the control that stops P1 passing against a
-- function that simply never writes line items. ⛔ P2 is not optional.
--
-- P1  'hijama-package' set is_visible_on_frontend = false, is_active untouched
--     → booking is CREATED, total_price = 45.00, 60 minutes reserved,
--       booking_items count = 0
--     MEASURED 2026-08-21: charged 45.00 · minutes 60 · line_items 0 ·
--                          itemised 0.00                                     ⛔ FAIL
--
-- P2  'massage-30' left fully visible (CONTROL)
--     → booking is CREATED, total_price = 40.00, booking_items count = 1,
--       itemised total = 40.00
--     MEASURED 2026-08-21: charged 40.00 · minutes 30 · line_items 1 ·
--                          itemised 40.00                                    ✅ PASS
--
-- ⛔ P2 green while P1 shows 0 line items is the proof that the probe CAN see a
--    line item, and that the missing one is caused by the visibility flag
--    rather than by the test being unable to observe booking_items.
-- ============================================================================

begin;
set local request.jwt.claims = '{"role":"service_role"}';

-- Exactly what an admin does with "Hide from website": hide it, leave it active.
update public.services set is_visible_on_frontend = false where slug = 'hijama-package';

-- P2 — CONTROL, a fully visible service.
select public.create_booking_request(
  array['massage-30'], 'ZZTEST-PR011-Control', 'zztest-pr011-control@probe.invalid', '07999000001',
  null, null, true, '1 ZZTEST Street', 'Luton', 'LU1 1AA', null,
  (current_date + 14), '10:00'::time, array['female']::staff_gender_type[],
  array['ZZTEST Control'], array[null]::text[], 'admin', null, true
);

-- P1 — UNDER TEST, active but hidden.
select public.create_booking_request(
  array['hijama-package'], 'ZZTEST-PR011-Hidden', 'zztest-pr011-hidden@probe.invalid', '07999000002',
  null, null, true, '2 ZZTEST Street', 'Luton', 'LU1 1AA', null,
  (current_date + 14), '14:00'::time, array['female']::staff_gender_type[],
  array['ZZTEST Hidden'], array[null]::text[], 'admin', null, true
);

-- ⛔ Expect: Control 40.00 / 1 line item · Hidden 45.00 / 0 line items.
select b.contact_full_name,
       b.total_price          as charged,
       b.total_duration_mins  as minutes_reserved,
       (select count(*) from public.booking_items bi where bi.booking_id = b.id)
         as line_items,
       (select coalesce(sum(bi.service_price_snapshot), 0)
          from public.booking_items bi where bi.booking_id = b.id)
         as itemised
from public.bookings b
where b.contact_full_name like 'ZZTEST-PR011-%'
order by b.contact_full_name;

rollback;


-- ============================================================================
-- BLOCK 2 — the same booking, with the service left VISIBLE
--
-- P3 pins the intended behaviour so that whatever fix is chosen can be checked
-- against it. The ONLY difference from P1 is the visibility flag.
--
-- P3  'hijama-package' left visible
--     → total_price 45.00 AND booking_items count = 1, itemised 45.00
--     MEASURED 2026-08-21: charged 45.00 · line_items 1 · itemised 45.00      ✅
--
-- ⛔ Read P1 and P3 together: identical inputs, identical charge, and the line
--    item present or absent purely on the visibility flag.
--    ⚠️ An earlier version of this line added "a flag the customer-facing site
--    does not even consult". ⛔ That was FALSE — see the correction at the top:
--    `src/lib/booking/availability.ts` consults it on a public path.
-- ============================================================================

begin;
set local request.jwt.claims = '{"role":"service_role"}';

select public.create_booking_request(
  array['hijama-package'], 'ZZTEST-PR011-Visible', 'zztest-pr011-visible@probe.invalid', '07999000003',
  null, null, true, '3 ZZTEST Street', 'Luton', 'LU1 1AA', null,
  (current_date + 14), '16:00'::time, array['female']::staff_gender_type[],
  array['ZZTEST Visible'], array[null]::text[], 'admin', null, true
);

select b.contact_full_name,
       b.total_price          as charged,
       b.total_duration_mins  as minutes_reserved,
       (select count(*) from public.booking_items bi where bi.booking_id = b.id)
         as line_items,
       (select coalesce(sum(bi.service_price_snapshot), 0)
          from public.booking_items bi where bi.booking_id = b.id)
         as itemised
from public.bookings b
where b.contact_full_name like 'ZZTEST-PR011-Visible';

rollback;
