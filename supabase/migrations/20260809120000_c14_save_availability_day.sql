-- C-14 Phase A Step 9 (+ Phase B Step 10) — the atomic segments save.
--
-- Plan:  redesign/plans/C-phase/C-14-granular-working-hours-breaks-plan.md  Step 9 / Step 10
-- Brief: redesign/briefs/C-14-granular-working-hours-breaks-brief.md        §2.1, §9.1
-- Date:  2026-08-09
--
-- ⛔ ZONE-2. WRITTEN, NOT APPLIED. Owner approval is per-action; this file is
-- staged with its calling code so the SQL can be read before it is run.
--
-- Statements:
--   1  assert_availability_day_segments()   shared input validation
--   2  save_availability_day()              global recurring rules (Phase A)
--   3  save_staff_availability_day()        per-staff recurring rules (Phase B)
--   4  function EXECUTE grants              (see "GRANT TRAP" below)
--
--
-- WHY A FUNCTION AT ALL — the failure this exists to prevent
--
-- Under the segments model a day's hours are N rows, so every save REPLACES the
-- day: delete the day's rows, insert the new ones. Done from the server action
-- as two PostgREST calls that is not one transaction, and the half-failed case
-- is the worst possible one: the DELETE succeeds, the INSERT fails, and the day
-- is left with ZERO rows. `getRuleWindowsForDay` (src/lib/booking/availability.ts)
-- filters a day's rows and returns the windows it finds — no rows means no
-- windows, which the slot engine reads as CLOSED. The clinic would silently stop
-- offering that weekday to customers, the admin page would render the day as
-- closed (so the screen agrees with the database and nothing looks wrong), and
-- nobody would learn about it except through missing bookings.
--
-- A function body is a single transaction, so the delete and the insert commit
-- together or not at all. Owner decision 2026-08-09: Option A, the RPC.
--
--
-- WHY SECURITY INVOKER, NOT SECURITY DEFINER
--
-- These functions need NO privilege their caller does not already hold, so they
-- ask for none. Both callers use createSupabaseAdminClient() — the service role
-- — and its privileges were verified live against this project on 2026-08-09:
--
--   availability_rules        service_role  SELECT ✓ INSERT ✓ UPDATE ✓ DELETE ✓
--   staff_availability_rules  service_role  SELECT ✓ INSERT ✓ UPDATE ✗ DELETE ✓
--   staff_profiles            service_role  SELECT ✓
--   service_role rolbypassrls = true (so RLS, enabled on both tables, is moot)
--
-- The missing UPDATE on staff_availability_rules is not a gap: delete + insert
-- never updates. Nothing here needs DEFINER.
--
-- That matters because SECURITY DEFINER is a privilege-escalation surface — the
-- body runs as the owner (`postgres`), so anyone who can EXECUTE it acts with
-- the owner's rights, and an unpinned search_path lets a caller who can create
-- objects in an earlier schema hijack an unqualified reference. Under INVOKER
-- the table privileges ARE the gate: if EXECUTE were ever granted to `anon` or
-- `authenticated` by mistake, the body would still fail 42501, because neither
-- role holds INSERT or DELETE on either table (verified live: all false).
--
-- search_path is nonetheless pinned to 'public' on all three functions, and
-- every object reference is schema-qualified regardless. Pinning is not doing
-- security work here — it prevents the `function_search_path_mutable` advisor
-- finding and matches the existing project idiom (compute_occurrence_dates,
-- update_updated_at_column, clear_account_password_request_payload).
--
--
-- ⚠️ GRANT TRAP — protocol §3b, and the reason statement 4 is not optional.
--
-- pg_default_acl for FUNCTIONS in schema public owned by `postgres` (the role
-- mcp__supabase__apply_migration creates as) is, verified live 2026-08-09:
--     {postgres=X/postgres}
-- Owner only. A newly created function grants EXECUTE to NOBODY else, so every
-- adminClient.rpc(...) call would return 42501 and the "Save hours" button would
-- fail on its first use. C-02 hit exactly this and documented it; the resulting
-- ACL on its functions is the shape statement 4 reproduces here:
--     create_recurring_booking_series  {postgres=X/postgres,service_role=X/postgres}
--
-- The REVOKEs are no-ops against this default ACL (PUBLIC/anon/authenticated
-- hold nothing to revoke). They are kept because they are what makes the intent
-- explicit and survive a future default-ACL change.
--
--
-- IDEMPOTENCY: CREATE OR REPLACE on all three functions; GRANT/REVOKE are
-- naturally repeatable. The file is a single transaction, so a failure at any
-- point leaves nothing half-applied. Re-appliable as written.
--
--
-- LIVE STATE, captured read-only 2026-08-09 immediately before authoring:
--   availability_rules                 7 rows, exactly one per day_of_week
--                                      (Sunday is_working_day = false; the other
--                                      six 08:00–20:00). Every day is already a
--                                      valid single-segment day — no data
--                                      migration, brief §5.1.
--   staff_availability_rules           0 rows
--   save_availability_day / save_staff_availability_day /
--     assert_availability_day_segments 0 (none exist — greenfield)
--   availability_rules PK              id only, NO unique on day_of_week
--   staff_availability_rules PK        id only, NO unique on (staff_id, day_of_week)
-- The absent day-uniqueness is what lets a day hold multiple segment rows at
-- all; it was re-confirmed rather than taken from the plan text.
--
--
-- CONCURRENCY — why the advisory lock is here.
--
-- Two admins saving the same day at the same time is rare but not impossible,
-- and READ COMMITTED does not make delete-then-insert safe on its own: B's
-- DELETE re-checks the rows it had already found and skips the ones A just
-- removed, but it never re-scans for the rows A INSERTED, so B would insert its
-- segments alongside A's and leave the day holding both schedules. The
-- transaction-scoped advisory lock (create_recurring_booking_series' idiom)
-- serialises savers of the SAME day and makes it plain last-writer-wins. It is
-- keyed per day (per staff+day for the staff variant), so saving all seven
-- weekdays in parallel — which the editor does — never contends.
--
--
-- WHAT IS DELIBERATELY *NOT* VALIDATED:
--   * Overlapping segments. `normalizeWindows` maps each row to a window and
--     `containsWindow` uses .some(), so overlap cannot mis-offer a slot, and
--     `rowsToSchedule` merges overlapping spans on read — so the next save
--     writes them back merged. Self-correcting; a hard error would only add a
--     way for a legitimate save to fail.
--   * Segment count, or a minimum bookable length. The 30-minute floor is a
--     WARNING in the editor (brief §4.2), never a block, and the database must
--     not be stricter than the product rule.
--   * Whether existing bookings fall inside a new break. Breaks are
--     forward-looking; brief §5.3 is explicit that existing bookings stay put.
--
--
-- POST-APPLY VERIFICATION (run these; §3b makes the privilege check mandatory
-- before the first call of a kind):
--   select proname, prosecdef, proconfig from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and proname like '%availability_day%';
--   -- 3 rows; prosecdef false on all three; proconfig {search_path=public}
--
--   select has_function_privilege('service_role','public.save_availability_day(int, jsonb)','EXECUTE') as g,
--          has_function_privilege('service_role','public.save_staff_availability_day(uuid, int, jsonb)','EXECUTE') as s,
--          has_function_privilege('service_role','public.assert_availability_day_segments(int, jsonb)','EXECUTE') as a,
--          has_function_privilege('authenticated','public.save_availability_day(int, jsonb)','EXECUTE') as auth_g;
--   -- g/s/a true, auth_g false
--
--   select day_of_week, count(*) from public.availability_rules group by 1 order by 1;
--   -- unchanged: 7 days x 1 row, until the first save through the editor
--
-- Then a round-trip through the UI: set Monday opens 08:00 / break 12:30–15:00 /
-- closes 20:00, save, reload — the break comes back, and Monday holds exactly
-- two is_working_day = true rows (08:00–12:30, 15:00–20:00).
--
--
-- ROLLBACK (drops nothing but the functions; no data is touched):
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.save_staff_availability_day(uuid, int, jsonb);
--   DROP FUNCTION IF EXISTS public.save_availability_day(int, jsonb);
--   DROP FUNCTION IF EXISTS public.assert_availability_day_segments(int, jsonb);
--   COMMIT;
-- Note the ordering constraint that outlives a rollback: the calling code must
-- be reverted WITH the functions, and any day already saved with breaks keeps
-- its extra rows. The pre-C-14 reader takes the FIRST row per day, so collapse
-- multi-segment days to one row (earliest open, latest close) before reverting
-- — plan §6.1.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Shared input validation.
--
--    Split out so the global and per-staff savers cannot drift: a rule enforced
--    for the clinic but not for a therapist is exactly the kind of asymmetry
--    that survives review and shows up as a broken rota.
--
--    Every check below maps to a concrete way a malformed call could write junk
--    that reads back as something plausible:
--      * out-of-range day     -> rows nothing ever reads, invisible forever
--      * empty array          -> the zero-row CLOSED failure described above
--      * bad time string      -> `normalizeWindows` silently drops the row, so a
--                                day quietly loses a segment
--      * end <= start         -> same: dropped on read, no error anywhere
--      * closed row mixed in  -> `rowsToSchedule` prefers the working rows and
--                                ignores the closed one, which then persists as
--                                junk through every later save
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_availability_day_segments(
  p_day_of_week int,
  p_segments jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_segment jsonb;
  v_total int;
  v_closed int := 0;
BEGIN
  IF p_day_of_week IS NULL OR p_day_of_week < 0 OR p_day_of_week > 6 THEN
    RAISE EXCEPTION 'day_of_week must be 0..6 (0 = Sunday), got %', p_day_of_week
      USING errcode = '22023';
  END IF;

  IF p_segments IS NULL OR jsonb_typeof(p_segments) <> 'array' THEN
    RAISE EXCEPTION 'segments must be a JSON array, got %', coalesce(jsonb_typeof(p_segments), 'null')
      USING errcode = '22023';
  END IF;

  v_total := jsonb_array_length(p_segments);

  -- The single most important check in this file. See the header.
  IF v_total = 0 THEN
    RAISE EXCEPTION 'segments must hold at least one row; a closed day is one row with is_working_day = false'
      USING errcode = '22023';
  END IF;

  FOR v_segment IN SELECT value FROM jsonb_array_elements(p_segments) AS elem(value) LOOP
    IF jsonb_typeof(v_segment) <> 'object' THEN
      RAISE EXCEPTION 'each segment must be a JSON object, got %', jsonb_typeof(v_segment)
        USING errcode = '22023';
    END IF;

    IF jsonb_typeof(v_segment -> 'start_time') <> 'string'
       OR jsonb_typeof(v_segment -> 'end_time') <> 'string' THEN
      RAISE EXCEPTION 'each segment needs string start_time and end_time'
        USING errcode = '22023';
    END IF;

    -- Mirrors TIME_PATTERN in src/lib/booking/working-hours-segments.ts and in
    -- availability.ts, so the database accepts exactly what the engine parses.
    IF (v_segment ->> 'start_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
       OR (v_segment ->> 'end_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN
      RAISE EXCEPTION 'segment times must be HH:MM or HH:MM:SS, got % to %',
        v_segment ->> 'start_time', v_segment ->> 'end_time'
        USING errcode = '22023';
    END IF;

    IF (v_segment ->> 'end_time')::time <= (v_segment ->> 'start_time')::time THEN
      RAISE EXCEPTION 'segment end_time must be after start_time, got % to %',
        v_segment ->> 'start_time', v_segment ->> 'end_time'
        USING errcode = '22023';
    END IF;

    IF jsonb_typeof(v_segment -> 'is_working_day') <> 'boolean' THEN
      RAISE EXCEPTION 'each segment needs a boolean is_working_day'
        USING errcode = '22023';
    END IF;

    IF NOT (v_segment ->> 'is_working_day')::boolean THEN
      v_closed := v_closed + 1;
    END IF;
  END LOOP;

  IF v_closed > 0 AND v_total > 1 THEN
    RAISE EXCEPTION 'a closed day is exactly one row with is_working_day = false; got % rows, % of them closed',
      v_total, v_closed
      USING errcode = '22023';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assert_availability_day_segments(int, jsonb) IS
  'C-14: validates the segments payload shared by save_availability_day and save_staff_availability_day. Raises 22023 on anything that would write rows the slot engine silently ignores.';

-- ---------------------------------------------------------------------------
-- 2. Global recurring hours (Phase A) — public.availability_rules.
--
--    Contract: replaces EVERY row for p_day_of_week with p_segments, atomically.
--    Returns { "before": [...], "after": [...] } so the caller can audit-log
--    both halves from ONE consistent snapshot — reading `before` separately from
--    the server action would race the delete it is meant to describe.
--    Both arrays are ordered by start_time; `before` is [] on a day that had no
--    rows yet.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_availability_day(
  p_day_of_week int,
  p_segments jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
BEGIN
  PERFORM public.assert_availability_day_segments(p_day_of_week, p_segments);

  -- Serialise concurrent savers of this same day. See CONCURRENCY in the header.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('save_availability_day:' || p_day_of_week::text, 0)
  );

  SELECT coalesce(
           jsonb_agg(to_jsonb(rule) ORDER BY rule.start_time, rule.end_time),
           '[]'::jsonb
         )
    INTO v_before
    FROM public.availability_rules AS rule
   WHERE rule.day_of_week = p_day_of_week;

  DELETE FROM public.availability_rules
   WHERE day_of_week = p_day_of_week;

  WITH inserted AS (
    INSERT INTO public.availability_rules (
      day_of_week, start_time, end_time, is_working_day
    )
    SELECT p_day_of_week,
           (segment.value ->> 'start_time')::time,
           (segment.value ->> 'end_time')::time,
           (segment.value ->> 'is_working_day')::boolean
      FROM jsonb_array_elements(p_segments) AS segment(value)
    RETURNING *
  )
  SELECT coalesce(
           jsonb_agg(to_jsonb(inserted) ORDER BY inserted.start_time, inserted.end_time),
           '[]'::jsonb
         )
    INTO v_after
    FROM inserted;

  RETURN jsonb_build_object('before', v_before, 'after', v_after);
END;
$$;

COMMENT ON FUNCTION public.save_availability_day(int, jsonb) IS
  'C-14: atomically replaces one weekday''s availability_rules rows with the given segments (a break is the gap between two rows). Returns {before, after}.';

-- ---------------------------------------------------------------------------
-- 3. Per-staff recurring hours (Phase B) — public.staff_availability_rules.
--
--    Deliberately a SEPARATE function rather than one with a nullable
--    p_staff_id meaning "global". A NULL-means-everyone overload turns a single
--    forgotten argument into an unnoticed rewrite of the CLINIC-WIDE schedule —
--    the same silent, self-concealing class of failure the whole RPC exists to
--    remove. Two names cost twenty lines and cannot be confused.
--
--    Written now, with Phase A, so Phase B needs no second Zone-2 approval.
--    Nothing calls it until Step 10; creating it changes no behaviour.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_staff_availability_day(
  p_staff_id uuid,
  p_day_of_week int,
  p_segments jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF p_staff_id IS NULL THEN
    RAISE EXCEPTION 'staff_id is required' USING errcode = '22023';
  END IF;

  -- The FK would raise 23503 anyway; this makes a stale staff id read as a
  -- sentence rather than a constraint name (create_recurring_booking_series
  -- idiom).
  IF NOT EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = p_staff_id) THEN
    RAISE EXCEPTION 'Staff profile % does not exist', p_staff_id
      USING errcode = 'P0002';
  END IF;

  PERFORM public.assert_availability_day_segments(p_day_of_week, p_segments);

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'save_staff_availability_day:' || p_staff_id::text || ':' || p_day_of_week::text,
      0
    )
  );

  SELECT coalesce(
           jsonb_agg(to_jsonb(rule) ORDER BY rule.start_time, rule.end_time),
           '[]'::jsonb
         )
    INTO v_before
    FROM public.staff_availability_rules AS rule
   WHERE rule.staff_id = p_staff_id
     AND rule.day_of_week = p_day_of_week;

  DELETE FROM public.staff_availability_rules
   WHERE staff_id = p_staff_id
     AND day_of_week = p_day_of_week;

  WITH inserted AS (
    INSERT INTO public.staff_availability_rules (
      staff_id, day_of_week, start_time, end_time, is_working_day
    )
    SELECT p_staff_id,
           p_day_of_week,
           (segment.value ->> 'start_time')::time,
           (segment.value ->> 'end_time')::time,
           (segment.value ->> 'is_working_day')::boolean
      FROM jsonb_array_elements(p_segments) AS segment(value)
    RETURNING *
  )
  SELECT coalesce(
           jsonb_agg(to_jsonb(inserted) ORDER BY inserted.start_time, inserted.end_time),
           '[]'::jsonb
         )
    INTO v_after
    FROM inserted;

  RETURN jsonb_build_object('before', v_before, 'after', v_after);
END;
$$;

COMMENT ON FUNCTION public.save_staff_availability_day(uuid, int, jsonb) IS
  'C-14: atomically replaces one staff member''s rows for one weekday in staff_availability_rules. Returns {before, after}. Never touches the global schedule.';

-- ---------------------------------------------------------------------------
-- 4. EXECUTE grants. Without these every adminClient.rpc(...) call returns
--    42501 — see the GRANT TRAP in the header. service_role only: nothing else
--    has a legitimate caller, and under SECURITY INVOKER a wider grant would
--    still fail on the table privileges.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.assert_availability_day_segments(int, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_availability_day_segments(int, jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION public.save_availability_day(int, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_availability_day(int, jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION public.save_staff_availability_day(uuid, int, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_staff_availability_day(uuid, int, jsonb)
  TO service_role;

COMMIT;
