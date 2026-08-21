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