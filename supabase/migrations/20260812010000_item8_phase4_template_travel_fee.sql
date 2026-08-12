-- Item 8 Phase 4 - the standing travel charge on a recurring series.
--
-- recurring_booking_templates had 26 columns and ZERO money columns of any
-- kind (re-confirmed live before writing this). The template stores the
-- address but nothing about price, which is why a fee set on occurrence #1 of
-- a standing out-of-area series silently vanished from every occurrence after
-- it: the horizon cron rebuilds each future occurrence from service.price
-- alone, and had nothing to carry the charge forward with.
--
-- Same precision as bookings.travel_fee, for the same reason.
--
-- Purely additive: not null default 0, no rewrite of existing rows. There are
-- currently 0 template rows, so this cannot disturb live data at all.
-- Rollback: alter table public.recurring_booking_templates drop column travel_fee;

alter table public.recurring_booking_templates
  add column travel_fee numeric(10,2) not null default 0;
