-- D-052 — give every visit in a repeat booking a STABLE slot identity, so one
-- visit can be moved without the nightly job re-creating it.
--
-- ── ⛔ THE PROBLEM THIS FIXES ────────────────────────────────────────────
--
-- A repeat booking has no list of its occurrences. "Does a visit exist for this
-- slot?" is answered ENTIRELY from `bookings.booking_date`:
--
--     extend-recurring-horizons:
--       anchorDate    = rows[0].booking_date          -- the earliest visit
--       existingDates = set(rows.map(booking_date))
--       candidates    = cadenceWalk(anchorDate).filter(d => !existingDates.has(d))
--
-- ⛔ So the moment a visit's date changes, the job believes that slot is empty
-- and materialises a BRAND NEW visit on the old date. The client ends up with
-- the appointment they asked to move off, plus the one it was moved to.
--
-- ⛔ Worse: the ANCHOR is the earliest visit's date. Move the first occurrence
-- of a Friday series to a Wednesday and the entire cadence is recomputed on
-- Wednesdays — none of which match any existing visit — so the job materialises
-- a whole PARALLEL series alongside the live one. Silently: the dates genuinely
-- differ, so the job's own duplicate guard cannot see it.
--
-- ⚠️ That is why D-051 shipped with repeat bookings REFUSED by the move panel.
-- Owner ruling 2026-08-23, on being shown the limitation: **"Fix it properly
-- too."** This is that fix.
--
-- ── ⛔ WHY A COLUMN, AND WHY IT IS THE SMALL OPTION ──────────────────────
--
-- The slot a visit belongs to and the date it happens on are two different
-- facts that the schema currently conflates. Nothing else in the row can stand
-- in for the slot: `recurring_template_id` says WHICH series, never WHICH
-- occurrence, and it is the only recurrence column on `bookings`.
--
-- ⛔ A TRIGGER, NOT A REWRITE OF `create_recurring_booking_series`. That
-- function is ~23 kB of SECURITY DEFINER pl/pgsql; replacing it wholesale to
-- add one column to one INSERT would be a far larger change with far more to go
-- wrong, and the run's own notes warn against transcribing SQL back out of the
-- MCP (it double-escapes backslashes). A BEFORE INSERT trigger stamps the slot
-- for EVERY writer — the create RPC, the nightly job, and anything added later
-- — without any of them knowing about it.
--
-- ⛔ IT IS DELIBERATELY INSERT-ONLY. Moving a visit is an UPDATE, so the slot
-- it was created for survives the move. That is the entire point.

-- ── 1. The column ───────────────────────────────────────────────────────
--
-- NULLable on purpose: every non-recurring booking leaves it empty, and a NULL
-- here means "not part of a repeat booking", not "unknown".
alter table public.bookings
  add column if not exists recurring_occurrence_date date;

comment on column public.bookings.recurring_occurrence_date is
  'D-052. For a visit in a repeat booking: the cadence slot it was created for. '
  'Set once on INSERT and never changed, so moving the visit (which changes '
  'booking_date) does not make the nightly horizon job think the slot is empty '
  'and re-create it. NULL for every one-off booking.';

-- ── 2. Backfill what already exists ─────────────────────────────────────
--
-- ⛔ Every existing series visit was created ON its cadence date — nothing could
-- move one until D-051 — so booking_date IS the slot for every historical row.
-- ⚠️ Measured before writing this: production holds ZERO recurring bookings, so
-- this statement is expected to touch 0 rows. It is written anyway, because the
-- rebuild proof (D-036) replays these migrations against a database that may
-- hold data, and a backfill that only works on an empty table is not a backfill.
update public.bookings
   set recurring_occurrence_date = booking_date
 where recurring_template_id is not null
   and recurring_occurrence_date is null;

-- ── 3. The trigger that keeps it true ───────────────────────────────────
create or replace function public.stamp_recurring_occurrence_date()
returns trigger
language plpgsql
as $$
begin
  -- Only visits that belong to a repeat booking carry a slot.
  if new.recurring_template_id is null then
    return new;
  end if;

  -- ⛔ COALESCE, not an unconditional assignment: a caller that already knows
  -- the slot (a future backfill, a repair job, a test fixture reproducing a
  -- moved visit) must be able to say so, and must not have it overwritten by
  -- the date the visit happens to sit on.
  new.recurring_occurrence_date :=
    coalesce(new.recurring_occurrence_date, new.booking_date);

  return new;
end;
$$;

comment on function public.stamp_recurring_occurrence_date() is
  'D-052. Stamps bookings.recurring_occurrence_date on INSERT for visits in a '
  'repeat booking. BEFORE INSERT only — an UPDATE (i.e. moving the visit) must '
  'never change the slot it was created for.';

drop trigger if exists bookings_stamp_recurring_occurrence on public.bookings;

create trigger bookings_stamp_recurring_occurrence
  before insert on public.bookings
  for each row
  execute function public.stamp_recurring_occurrence_date();

-- ── 4. The index the nightly job reads through ──────────────────────────
--
-- The job loads one series' occurrences and asks which slots are filled.
-- Partial, because the overwhelming majority of bookings are one-offs and have
-- nothing to say here.
create index if not exists bookings_recurring_occurrence_idx
  on public.bookings (recurring_template_id, recurring_occurrence_date)
  where recurring_template_id is not null;
