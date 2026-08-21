-- F1 + F2 (2026-08-17) — booking capacity and the booking window, on WRITES.
-- Repo file: supabase/migrations/20260817120100_f1_f2_booking_capacity_and_window.sql
--
-- Patches the LIVE definition rather than re-sending 711 lines, so the base body
-- is guaranteed byte-correct rather than transcribed. Asserts the starting md5
-- before touching anything; any anchor miss aborts and nothing changes.

DO $mig$
DECLARE
  v_def  text;
  v_src  text;
  v_oid  oid;
BEGIN
  SELECT p.oid INTO v_oid
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'create_booking_request';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'create_booking_request not found';
  END IF;

  SELECT prosrc INTO v_src FROM pg_proc WHERE oid = v_oid;
  IF md5(v_src) <> '6b5fb9de14dd01ffe978e72d3e818066' THEN
    RAISE EXCEPTION 'live body is not the expected pre-F1/F2 definition (md5 %)', md5(v_src);
  END IF;

  v_def := pg_get_functiondef(v_oid);

  -- 1. DECLARE the two counters. D11: v_settings already holds the window cols.
  IF position('  v_participant_services text[];' in v_def) = 0 THEN
    RAISE EXCEPTION 'declare anchor not found';
  END IF;
  v_def := replace(v_def,
    '  v_participant_services text[];',
    '  v_participant_services text[];' || E'\n' ||
    '  -- F1 (2026-08-17): unassigned reservations, subtracted from live capacity.' || E'\n' ||
    '  v_unassigned_male integer := 0;' || E'\n' ||
    '  v_unassigned_female integer := 0;');

  -- 2. D13: advisory lock keyed on date AND time let two overlapping requests at
  --    different start times take different locks. Key on the date.
  IF position('''create_booking_request:'' || p_booking_date::text || '':'' || p_start_time::text' in v_def) = 0 THEN
    RAISE EXCEPTION 'advisory-lock anchor not found';
  END IF;
  v_def := replace(v_def,
    '''create_booking_request:'' || p_booking_date::text || '':'' || p_start_time::text',
    '''create_booking_request:'' || p_booking_date::text');

  -- 3. F2 + D4 + D6: pause and minimum notice, gated on booking_source, using
  --    v_requested_at (absolute) and v_settings (already loaded).
  IF position('  if not p_override_availability then' in v_def) = 0 THEN
    RAISE EXCEPTION 'window anchor not found';
  END IF;
  v_def := replace(v_def,
    '  if not p_override_availability then',
    '  if not p_override_availability then' || E'\n' ||
    '    -- F2 (2026-08-17): enforce the booking window on WRITES.' || E'\n' ||
    '    -- D6: gated on p_booking_source, NOT p_override_availability, which is an' || E'\n' ||
    '    -- availability-override checkbox absent by default -- gating on it would' || E'\n' ||
    '    -- block the Owner''s own same-day phone bookings while intake is paused.' || E'\n' ||
    '    -- D4: uses v_requested_at (absolute). Wall-clock arithmetic is one hour' || E'\n' ||
    '    -- wrong across every BST transition.' || E'\n' ||
    '    if p_booking_source = ''website'' then' || E'\n' ||
    '      if coalesce(v_settings.booking_status_enabled, true) = false then' || E'\n' ||
    '        raise exception ''Online booking is currently paused.'' using errcode = ''P0001'';' || E'\n' ||
    '      end if;' || E'\n' ||
    '      if coalesce(v_settings.minimum_notice_hours, 0) > 0' || E'\n' ||
    '         and v_requested_at < now() + make_interval(hours => v_settings.minimum_notice_hours) then' || E'\n' ||
    '        raise exception ''This time is inside the minimum notice window.'' using errcode = ''P0001'';' || E'\n' ||
    '      end if;' || E'\n' ||
    '    end if;');

  -- 4. D5: buffer on the existing assigned-overlap check.
  IF position('(b.start_time, b.end_time) overlaps (p_start_time, v_end_time)' in v_def) = 0 THEN
    RAISE EXCEPTION 'buffer anchor not found';
  END IF;
  v_def := replace(v_def,
    '(b.start_time, b.end_time) overlaps (p_start_time, v_end_time)',
    '(p_start_time, v_end_time) overlaps (' || E'\n' ||
    '              b.start_time - make_interval(mins => coalesce(v_settings.buffer_time_mins, 0)),' || E'\n' ||
    '              b.end_time   + make_interval(mins => coalesce(v_settings.buffer_time_mins, 0)))');

  -- 5. F1 + D5 + D12: subtract unassigned reservations, with buffer, matching the
  --    read engine's status set.
  IF position('    if v_required_male > v_available_male then' in v_def) = 0 THEN
    RAISE EXCEPTION 'capacity anchor not found';
  END IF;
  v_def := replace(v_def,
    '    if v_required_male > v_available_male then',
    '    -- F1 (2026-08-17): the loop above marks a therapist busy only when a' || E'\n' ||
    '    -- booking NAMES them. Website bookings are created unassigned, so they' || E'\n' ||
    '    -- consumed ZERO capacity. Mirrors unassignedReservationCounts() in' || E'\n' ||
    '    -- src/lib/booking/availability.ts, incl. buffer (D5) and status set (D12).' || E'\n' ||
    '    select' || E'\n' ||
    '      coalesce(count(*) filter (where ba.required_therapist_gender = ''male''), 0),' || E'\n' ||
    '      coalesce(count(*) filter (where ba.required_therapist_gender = ''female''), 0)' || E'\n' ||
    '      into v_unassigned_male, v_unassigned_female' || E'\n' ||
    '      from public.booking_assignments ba' || E'\n' ||
    '      join public.bookings b on b.id = ba.booking_id' || E'\n' ||
    '     where ba.assigned_staff_id is null' || E'\n' ||
    '       and ba.status in (''unassigned'', ''assigned'')' || E'\n' ||
    '       and b.booking_date = p_booking_date' || E'\n' ||
    '       and b.status in (''pending'', ''confirmed'')' || E'\n' ||
    '       and (p_start_time, v_end_time) overlaps (' || E'\n' ||
    '             b.start_time - make_interval(mins => coalesce(v_settings.buffer_time_mins, 0)),' || E'\n' ||
    '             b.end_time   + make_interval(mins => coalesce(v_settings.buffer_time_mins, 0)));' || E'\n' ||
    E'\n' ||
    '    v_available_male := greatest(0, v_available_male - v_unassigned_male);' || E'\n' ||
    '    v_available_female := greatest(0, v_available_female - v_unassigned_female);' || E'\n' ||
    E'\n' ||
    '    if v_required_male > v_available_male then');

  EXECUTE v_def;
END
$mig$;

-- D8 (2026-08-17): this function has held PUBLIC EXECUTE since 20260727120000
-- granted to service_role after a signature change without the paired REVOKE.
-- Confirmed live: proacl showed a bare "=X/postgres". Same defect as F10.
REVOKE ALL ON FUNCTION public.create_booking_request(
  text[], text, text, text, text, text, boolean, text, text, text, text, date,
  time without time zone, staff_gender_type[], text[], text[], text, text[],
  boolean, text, uuid, boolean, boolean
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_booking_request(
  text[], text, text, text, text, text, boolean, text, text, text, text, date,
  time without time zone, staff_gender_type[], text[], text[], text, text[],
  boolean, text, uuid, boolean, boolean
) TO service_role;