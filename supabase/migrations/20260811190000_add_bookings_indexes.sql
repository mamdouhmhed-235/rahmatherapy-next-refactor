-- Item 4 — bookings indexes for the projected query shapes
--
-- The clinic-wide bookings list fans out 11 `count: "exact", head: true`
-- queries per render (one per visible view) and orders by
-- booking_date DESC, start_time DESC, id DESC with .range() pagination.
-- Before this migration `bookings` carried nothing on booking_date,
-- start_time, unqualified status, assignment_status or client_id.
--
-- These exist for volume, not for today: the table holds 15 rows, so every
-- plan is a sequential scan and the planner will ignore all four. That is
-- precisely why adding them now is free, and why measuring them now is
-- meaningless. The claim this migration supports is "the indexes the
-- projected query shapes will need are in place before the data arrives" —
-- nothing more.
--
-- No CONCURRENTLY: it cannot run inside a transaction block, and at 15 rows
-- a plain build is instantaneous. Non-concurrent CREATE INDEX takes a SHARE
-- lock, which blocks writes but not reads — immaterial at this size.
--
-- Owner-approved and applied 2026-08-11 (Zone-2, per-action approval in chat).
-- Applied version: 20260811190535. Additive, idempotent, no data modified.
-- Post-apply verified: pg_indexes for public.bookings returned 7 rows (the 3
-- pre-existing plus these 4), every indexdef matching the approved text, and
-- SELECT count(*) FROM public.bookings still 15.
--
-- Reversible with:
--   DROP INDEX IF EXISTS public.bookings_date_time_id_idx;
--   DROP INDEX IF EXISTS public.bookings_status_date_idx;
--   DROP INDEX IF EXISTS public.bookings_assignment_status_date_idx;
--   DROP INDEX IF EXISTS public.bookings_client_id_date_idx;
-- None of the four backs a constraint, so none is undroppable.
--
-- Premise re-verified live immediately before authoring: `bookings` carried
-- exactly three indexes (bookings_pkey, bookings_client_status_completed_idx,
-- idx_bookings_recurring_template) and 15 rows; every column named below
-- exists and is NOT NULL; none of the four names already exists, so
-- IF NOT EXISTS cannot silently no-op against a different definition.
--
-- Two claims in the plan were corrected while verifying this migration:
--   * bookings.status is emitted at SEVEN predicate sites, not six — the
--     notInert() helper has two independent call sites that both fire for
--     the claimable view, and the plan's own counting method counts call
--     sites, not helper definitions, for every other column.
--   * /booking/manage is NOT filtered by primary key alone:
--     requestCustomerCancellation adds .in("status", …). It is still served
--     by bookings_pkey, so the "unaffected" conclusion holds — the stated
--     reason for it did not.

-- Serves the list's ORDER BY booking_date DESC, start_time DESC, id DESC plus
-- .range() pagination. All three columns are NOT NULL, so nulls-ordering is
-- moot, and a btree scanned backwards serves the descending order from an
-- ascending definition ("Index Scan Backward").
CREATE INDEX IF NOT EXISTS bookings_date_time_id_idx
  ON public.bookings (booking_date, start_time, id);

-- status is emitted at 7 predicate sites. Leading with status rather than
-- booking_date is deliberate and complementary: the three true equality/IN
-- uses (the completed view, the cancelled view, and the operator's status
-- dropdown) are the shape only a status-leading composite can seek on, while
-- the three negations (notInert's NOT IN, twice, and upcoming's
-- neq completed) cannot seek on a leading status column under either
-- ordering and are already served by entering on booking_date via
-- bookings_date_time_id_idx above. Flipping this to (booking_date, status)
-- would largely duplicate that index instead of complementing it.
-- An eighth status occurrence, in the claimable view, filters
-- booking_assignments.status through a PostgREST embed — a different table,
-- which this index cannot and should not serve.
CREATE INDEX IF NOT EXISTS bookings_status_date_idx
  ON public.bookings (status, booking_date);

-- assignment_status drives the claimable/assigned chips: attention's
-- neq.fully_assigned, unassigned's eq, partially_assigned's eq, and the
-- post-view filter's eq — all four are equality/inequality on the leading
-- column. No existing index touches this column.
CREATE INDEX IF NOT EXISTS bookings_assignment_status_date_idx
  ON public.bookings (assignment_status, booking_date);

-- The client detail page lists a client's whole booking history. The existing
-- bookings_client_status_completed_idx is partial on status = 'completed',
-- and Postgres can only use a partial index where the query provably implies
-- its predicate — none of the client-scoped reads filter on status, so it
-- cannot serve them. Of the seven client_id-scoped bookings queries in
-- client-detail-data.ts, four return rows and every one of those four sorts
-- by booking_date DESC then start_time DESC immediately after filtering, so
-- this is widened past a bare (client_id) to serve the sort as well; the
-- three count-only queries are served just as well either way.
CREATE INDEX IF NOT EXISTS bookings_client_id_date_idx
  ON public.bookings (client_id, booking_date, start_time);
