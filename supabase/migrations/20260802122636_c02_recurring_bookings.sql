BEGIN;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS allow_recurrence boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.services.allow_recurrence IS
  'When false, this service cannot start a recurring series. create_recurring_booking_series refuses; the admin form hides the section.';

CREATE TABLE IF NOT EXISTS public.recurring_booking_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  bound_therapist_id uuid NULL REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  open_to_any_therapist boolean NOT NULL DEFAULT false,
  anchor_day_of_week int2 NULL,
  anchor_day_of_month int2 NULL,
  anchor_start_time time NOT NULL,
  total_duration_mins int NOT NULL,
  participant_gender public.staff_gender_type NOT NULL,
  required_therapist_gender public.staff_gender_type NOT NULL,
  cadence text NOT NULL CHECK (cadence IN ('weekly', 'fortnightly', 'monthly')),
  end_type text NOT NULL CHECK (end_type IN ('until_cancelled', 'after_count', 'until_date')),
  end_count int NULL,
  end_date date NULL,
  service_address_line1 text NULL,
  service_postcode text NULL,
  service_city text NULL,
  service_area text NULL,
  created_by uuid NOT NULL REFERENCES public.staff_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz NULL,
  cancelled_by uuid NULL REFERENCES public.staff_profiles(id),
  cancelled_reason text NULL,
  horizon_through_date date NOT NULL,
  notes text NULL,
  CONSTRAINT rbt_end_count_when_after_count CHECK (
    (end_type = 'after_count' AND end_count IS NOT NULL AND end_count > 0)
    OR (end_type <> 'after_count' AND end_count IS NULL)
  ),
  CONSTRAINT rbt_end_date_when_until_date CHECK (
    (end_type = 'until_date' AND end_date IS NOT NULL)
    OR (end_type <> 'until_date' AND end_date IS NULL)
  ),
  CONSTRAINT rbt_anchor_day_of_month_in_range CHECK (
    anchor_day_of_month IS NULL OR (anchor_day_of_month >= 1 AND anchor_day_of_month <= 28)
  ),
  CONSTRAINT rbt_anchor_day_of_week_in_range CHECK (
    anchor_day_of_week IS NULL OR (anchor_day_of_week >= 0 AND anchor_day_of_week <= 6)
  )
);

COMMENT ON COLUMN public.recurring_booking_templates.participant_gender IS
  'Snapshot of the client participant gender. Copied onto booking_participants.participant_gender for every occurrence, including ones the horizon cron creates months from now.';
COMMENT ON COLUMN public.recurring_booking_templates.required_therapist_gender IS
  'Gender the serving therapist must have. Copied onto booking_participants.required_therapist_gender and booking_assignments.required_therapist_gender for every occurrence. Independent of open_to_any_therapist, which governs WHICH therapist, not which gender.';
COMMENT ON COLUMN public.recurring_booking_templates.horizon_through_date IS
  'Occurrences have been materialised up to and including this date. Advanced by the extend-recurring-horizons cron.';

CREATE INDEX IF NOT EXISTS idx_recurring_templates_active
  ON public.recurring_booking_templates (cancelled_at) WHERE cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_templates_horizon
  ON public.recurring_booking_templates (horizon_through_date) WHERE cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_templates_client
  ON public.recurring_booking_templates (client_id);

ALTER TABLE public.recurring_booking_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rbt_service_role_all ON public.recurring_booking_templates;
CREATE POLICY rbt_service_role_all ON public.recurring_booking_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS rbt_authenticated_read ON public.recurring_booking_templates;
CREATE POLICY rbt_authenticated_read ON public.recurring_booking_templates
  FOR SELECT TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_booking_templates TO service_role;
GRANT SELECT ON public.recurring_booking_templates TO authenticated;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS recurring_template_id uuid NULL
    REFERENCES public.recurring_booking_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_recurring_template
  ON public.bookings (recurring_template_id) WHERE recurring_template_id IS NOT NULL;

COMMENT ON COLUMN public.bookings.recurring_template_id IS
  'Set when this booking is an occurrence of a recurring series. The canonical recurring marker for the calendar badge, the bookings-list Series filter and the series view.';

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_booking_source_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_booking_source_check
  CHECK (booking_source IN (
    'website', 'phone', 'whatsapp', 'instagram',
    'referral', 'admin', 'manual', 'other', 'recurring'
  ));

CREATE OR REPLACE FUNCTION public.compute_occurrence_dates(
  p_first_date date,
  p_cadence text,
  p_horizon_end date,
  p_end_type text,
  p_end_count int,
  p_end_date date
) RETURNS date[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_dates date[] := ARRAY[]::date[];
  v_dt date := p_first_date;
  v_interval interval;
  v_count int := 0;
  v_effective_end date;
BEGIN
  v_interval := CASE p_cadence
    WHEN 'weekly' THEN INTERVAL '7 days'
    WHEN 'fortnightly' THEN INTERVAL '14 days'
    WHEN 'monthly' THEN INTERVAL '1 month'
    ELSE NULL
  END;
  IF v_interval IS NULL THEN
    RAISE EXCEPTION 'Invalid cadence: %', p_cadence;
  END IF;

  v_effective_end := CASE p_end_type
    WHEN 'until_cancelled' THEN p_horizon_end
    WHEN 'until_date' THEN LEAST(p_end_date, p_horizon_end)
    WHEN 'after_count' THEN p_horizon_end
    ELSE p_horizon_end
  END;

  WHILE v_dt <= v_effective_end LOOP
    IF p_end_type = 'after_count' AND v_count >= p_end_count THEN
      EXIT;
    END IF;
    v_dates := array_append(v_dates, v_dt);
    v_count := v_count + 1;
    v_dt := (v_dt + v_interval)::date;
  END LOOP;

  RETURN v_dates;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_recurring_booking_series(
  p_client_id uuid,
  p_service_slug text,
  p_first_occurrence_date date,
  p_anchor_start_time time,
  p_cadence text,
  p_end_type text,
  p_participant_gender public.staff_gender_type,
  p_required_therapist_gender public.staff_gender_type,
  p_actor_staff_id uuid,
  p_bound_therapist_id uuid DEFAULT NULL,
  p_open_to_any_therapist boolean DEFAULT false,
  p_end_count int DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_service_address_line1 text DEFAULT NULL,
  p_service_postcode text DEFAULT NULL,
  p_service_city text DEFAULT NULL,
  p_service_area text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_consent_acknowledged boolean DEFAULT true,
  p_horizon_weeks int DEFAULT 12
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
DECLARE
  v_today date := (timezone('Europe/London', now()))::date;
  v_client public.clients%rowtype;
  v_service public.services%rowtype;
  v_bound public.staff_profiles%rowtype;
  v_open_to_any boolean := COALESCE(p_open_to_any_therapist, false);
  v_consent boolean := COALESCE(p_consent_acknowledged, true);
  v_horizon_weeks int := COALESCE(p_horizon_weeks, 12);
  v_end_count int;
  v_end_date date;
  v_end_time time;
  v_anchor_dow int2;
  v_anchor_dom int2;
  v_horizon_through date;
  v_occurrence_dates date[];
  v_dt date;
  v_template_id uuid;
  v_booking_id uuid;
  v_participant_id uuid;
  v_created_count int := 0;
  v_skipped_count int := 0;
  v_contact_name text;
  v_contact_email text;
  v_contact_phone text;
  v_address_line1 text;
  v_postcode text;
  v_city text;
  v_area text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'create_recurring_booking_series may only be called with the service role'
      USING errcode = '42501';
  END IF;

  IF p_first_occurrence_date IS NULL THEN
    RAISE EXCEPTION 'A first occurrence date is required';
  END IF;

  IF p_anchor_start_time IS NULL THEN
    RAISE EXCEPTION 'A start time is required';
  END IF;

  IF p_participant_gender IS NULL OR p_required_therapist_gender IS NULL THEN
    RAISE EXCEPTION 'Participant gender and required therapist gender are both required';
  END IF;

  IF COALESCE(p_cadence, '') NOT IN ('weekly', 'fortnightly', 'monthly') THEN
    RAISE EXCEPTION 'Invalid cadence: %', p_cadence;
  END IF;

  IF COALESCE(p_end_type, '') NOT IN ('until_cancelled', 'after_count', 'until_date') THEN
    RAISE EXCEPTION 'Invalid end type: %', p_end_type;
  END IF;

  IF v_horizon_weeks < 1 THEN
    RAISE EXCEPTION 'The materialisation horizon must be at least one week';
  END IF;

  v_end_count := CASE WHEN p_end_type = 'after_count' THEN p_end_count ELSE NULL END;
  v_end_date  := CASE WHEN p_end_type = 'until_date'  THEN p_end_date  ELSE NULL END;

  IF p_end_type = 'after_count' AND (v_end_count IS NULL OR v_end_count < 1) THEN
    RAISE EXCEPTION 'A positive number of visits is required when the series ends after a count';
  END IF;

  IF p_end_type = 'until_date' THEN
    IF v_end_date IS NULL THEN
      RAISE EXCEPTION 'An end date is required when the series ends on a specific date';
    END IF;
    IF v_end_date < p_first_occurrence_date THEN
      RAISE EXCEPTION 'The series end date must fall on or after the first occurrence';
    END IF;
  END IF;

  IF p_first_occurrence_date < v_today THEN
    RAISE EXCEPTION 'The first occurrence must be today or later';
  END IF;

  IF p_cadence = 'monthly' THEN
    v_anchor_dom := EXTRACT(DAY FROM p_first_occurrence_date)::int2;
    v_anchor_dow := NULL;
    IF v_anchor_dom > 28 THEN
      RAISE EXCEPTION 'Monthly recurrence requires a day between 1 and 28';
    END IF;
  ELSE
    v_anchor_dow := EXTRACT(DOW FROM p_first_occurrence_date)::int2;
    v_anchor_dom := NULL;
  END IF;

  SELECT * INTO v_service
  FROM public.services
  WHERE slug = p_service_slug AND is_active = true;

  IF v_service.id IS NULL THEN
    RAISE EXCEPTION 'Service % is not available', p_service_slug
      USING errcode = 'P0002';
  END IF;

  IF NOT v_service.allow_recurrence THEN
    RAISE EXCEPTION 'Recurring bookings are not enabled for %', v_service.name;
  END IF;

  IF (v_service.gender_restrictions = 'male_only' AND p_participant_gender = 'female')
     OR (v_service.gender_restrictions = 'female_only' AND p_participant_gender = 'male') THEN
    RAISE EXCEPTION 'Selected service is not suitable for this participant';
  END IF;

  v_end_time := p_anchor_start_time + make_interval(mins => v_service.duration_mins);

  IF v_end_time <= p_anchor_start_time THEN
    RAISE EXCEPTION 'Booking must finish on the same day after it starts';
  END IF;

  SELECT * INTO v_client
  FROM public.clients
  WHERE id = p_client_id AND deleted_at IS NULL;

  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'Specified client does not exist or has been deleted'
      USING errcode = 'P0002';
  END IF;

  v_contact_name  := nullif(trim(coalesce(v_client.full_name, '')), '');
  v_contact_email := nullif(lower(trim(coalesce(v_client.email, ''))), '');
  v_contact_phone := nullif(trim(coalesce(v_client.phone, '')), '');

  IF v_contact_name IS NULL THEN
    RAISE EXCEPTION 'The client record has no name'
      USING errcode = 'P0001';
  END IF;

  IF v_contact_phone IS NULL THEN
    RAISE EXCEPTION 'The client record has no phone number, which every booking requires'
      USING errcode = 'P0001',
            hint = 'Add a phone number to the client record and create the series again.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = p_actor_staff_id) THEN
    RAISE EXCEPTION 'Acting staff profile does not exist'
      USING errcode = 'P0002';
  END IF;

  IF p_bound_therapist_id IS NOT NULL THEN
    SELECT * INTO v_bound
    FROM public.staff_profiles
    WHERE id = p_bound_therapist_id;

    IF v_bound.id IS NULL THEN
      RAISE EXCEPTION 'Selected therapist does not exist'
        USING errcode = 'P0002';
    END IF;

    IF NOT v_bound.active OR NOT v_bound.can_take_bookings THEN
      RAISE EXCEPTION 'Selected therapist is not available to take bookings';
    END IF;

    IF v_bound.gender IS DISTINCT FROM p_required_therapist_gender THEN
      RAISE EXCEPTION 'Selected therapist does not match the required therapist gender';
    END IF;
  END IF;

  v_address_line1 := coalesce(nullif(trim(coalesce(p_service_address_line1, '')), ''), v_client.address);
  v_postcode      := coalesce(nullif(trim(coalesce(p_service_postcode, '')), ''), v_client.postcode);
  v_city          := coalesce(nullif(trim(coalesce(p_service_city, '')), ''), v_client.city);
  v_area          := coalesce(nullif(trim(coalesce(p_service_area, '')), ''), v_client.area);

  v_horizon_through := p_first_occurrence_date + (v_horizon_weeks * 7) - 1;

  v_occurrence_dates := public.compute_occurrence_dates(
    p_first_occurrence_date,
    p_cadence,
    v_horizon_through,
    p_end_type,
    v_end_count,
    v_end_date
  );

  IF coalesce(array_length(v_occurrence_dates, 1), 0) = 0 THEN
    RAISE EXCEPTION 'That cadence and end condition produce no visits';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('create_recurring_booking_series:' || p_client_id::text, 0)
  );

  INSERT INTO public.recurring_booking_templates (
    client_id,
    service_id,
    bound_therapist_id,
    open_to_any_therapist,
    anchor_day_of_week,
    anchor_day_of_month,
    anchor_start_time,
    total_duration_mins,
    participant_gender,
    required_therapist_gender,
    cadence,
    end_type,
    end_count,
    end_date,
    service_address_line1,
    service_postcode,
    service_city,
    service_area,
    created_by,
    horizon_through_date,
    notes
  )
  VALUES (
    p_client_id,
    v_service.id,
    p_bound_therapist_id,
    v_open_to_any,
    v_anchor_dow,
    v_anchor_dom,
    p_anchor_start_time,
    v_service.duration_mins,
    p_participant_gender,
    p_required_therapist_gender,
    p_cadence,
    p_end_type,
    v_end_count,
    v_end_date,
    v_address_line1,
    v_postcode,
    v_city,
    v_area,
    p_actor_staff_id,
    v_horizon_through,
    nullif(trim(coalesce(p_notes, '')), '')
  )
  RETURNING id INTO v_template_id;

  FOREACH v_dt IN ARRAY v_occurrence_dates LOOP
    IF EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.client_id = p_client_id
        AND b.booking_date = v_dt
        AND b.start_time = p_anchor_start_time
        AND b.status NOT IN ('cancelled', 'no_show')
        AND b.deleted_at IS NULL
    ) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.bookings (
      client_id,
      contact_full_name,
      contact_email,
      contact_phone,
      booking_source,
      booking_date,
      start_time,
      end_time,
      total_duration_mins,
      total_price,
      amount_due,
      amount_paid,
      payment_status,
      status,
      assignment_status,
      group_booking,
      consent_acknowledged,
      service_address_line1,
      service_city,
      service_postcode,
      recurring_template_id
    )
    VALUES (
      p_client_id,
      v_contact_name,
      v_contact_email,
      v_contact_phone,
      'recurring',
      v_dt,
      p_anchor_start_time,
      v_end_time,
      v_service.duration_mins,
      v_service.price,
      v_service.price,
      0,
      'unpaid',
      'pending',
      'unassigned',
      false,
      v_consent,
      v_address_line1,
      v_city,
      v_postcode,
      v_template_id
    )
    RETURNING id INTO v_booking_id;

    INSERT INTO public.booking_participants (
      booking_id,
      participant_gender,
      required_therapist_gender,
      is_main_contact,
      display_name,
      consent_acknowledged
    )
    VALUES (
      v_booking_id,
      p_participant_gender,
      p_required_therapist_gender,
      true,
      v_contact_name,
      v_consent
    )
    RETURNING id INTO v_participant_id;

    INSERT INTO public.booking_items (
      booking_id,
      booking_participant_id,
      service_id,
      service_name_snapshot,
      service_price_snapshot,
      service_duration_snapshot
    )
    VALUES (
      v_booking_id,
      v_participant_id,
      v_service.id,
      v_service.name,
      v_service.price,
      v_service.duration_mins
    );

    INSERT INTO public.booking_assignments (
      booking_id,
      participant_id,
      assigned_staff_id,
      required_therapist_gender,
      status
    )
    VALUES (
      v_booking_id,
      v_participant_id,
      NULL,
      p_required_therapist_gender,
      'unassigned'
    );

    v_created_count := v_created_count + 1;
  END LOOP;

  INSERT INTO public.audit_logs (
    actor_staff_id, action_type, target_type, target_id, after_state
  )
  VALUES (
    p_actor_staff_id,
    'recurring_series_created',
    'recurring_booking_templates',
    v_template_id,
    jsonb_build_object(
      'client_id', p_client_id,
      'service_slug', p_service_slug,
      'cadence', p_cadence,
      'end_type', p_end_type,
      'end_count', v_end_count,
      'end_date', v_end_date,
      'first_occurrence_date', p_first_occurrence_date,
      'anchor_start_time', p_anchor_start_time,
      'occurrence_count', v_created_count,
      'skipped_count', v_skipped_count,
      'horizon_through', v_horizon_through,
      'bound_therapist_id', p_bound_therapist_id,
      'open_to_any_therapist', v_open_to_any,
      'required_therapist_gender', p_required_therapist_gender
    )
  );

  RETURN jsonb_build_object(
    'templateId', v_template_id,
    'occurrenceCount', v_created_count,
    'skippedCount', v_skipped_count,
    'horizonThrough', v_horizon_through,
    'firstOccurrenceDate', p_first_occurrence_date,
    'serviceName', v_service.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_occurrence_dates FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_occurrence_dates TO service_role;

REVOKE ALL ON FUNCTION public.create_recurring_booking_series FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_recurring_booking_series TO service_role;

COMMIT;