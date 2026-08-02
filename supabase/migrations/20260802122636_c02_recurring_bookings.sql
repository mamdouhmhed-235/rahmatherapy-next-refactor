-- C-02 — recurring / standing bookings (single migration).
--
-- Plan:  redesign/plans/C-phase/C-02-recurring-bookings-plan.md  §1 Phase A Step 1
-- Brief: redesign/briefs/C-02-recurring-bookings-brief.md        §2.1–§2.4
-- Date:  2026-08-02
--
-- Statements:
--    1  services.allow_recurrence                    per-service opt-out, on by default
--    2  recurring_booking_templates                  the series definition + 4 CHECKs
--    3  three indexes on the new table
--    4  RLS enable + the two policies
--    5  table GRANTs                                 (see "GRANT TRAP" below)
--    6  bookings.recurring_template_id + partial index
--    7  bookings_booking_source_check widened        (see "booking_source TRAP" below)
--    8  compute_occurrence_dates()                   pure date math, no table access
--    9  create_recurring_booking_series()            the series-creation RPC
--   10  function EXECUTE grants                      (see "GRANT TRAP" below)
--
-- Greenfield: nothing this file creates exists yet. Re-verified read-only against
-- production twzutkfgqclqurvkmvqz on 2026-08-02, immediately before authoring:
--   recurring_booking_templates / recurring_series / booking_series  0
--   services.allow_recurrence                                        0
--   bookings.recurring_template_id                                   0
--   compute_occurrence_dates / create_recurring_booking_series       0
--   idx_recurring_templates_{active,horizon,client} + idx_bookings_recurring_template  0
--   bookings                                                        15 rows
--
--
-- IDEMPOTENCY: every statement is re-appliable. IF NOT EXISTS on the column and
-- index adds and the table create; DROP-then-CREATE on the two policies (CREATE
-- POLICY has no IF NOT EXISTS form) and on the booking_source constraint;
-- CREATE OR REPLACE on both functions; GRANT/REVOKE are naturally repeatable.
-- The file is a single transaction, so a failure at any point leaves nothing
-- half-applied.
--
--
-- ⚠️ GRANT TRAP — protocol §3b. THREE grant groups, none optional.
--
-- pg_default_acl for schema public, tables created by role `postgres`, is
--     {postgres=arwdDxtm/postgres, anon=Dxtm/postgres,
--      authenticated=Dxtm/postgres, service_role=Dxtm/postgres}
-- i.e. a new table gives service_role Delete/Truncate/References/Trigger and NO
-- SELECT, INSERT or UPDATE. mcp__supabase__apply_migration creates as `postgres`,
-- so statement 2's table lands in exactly that bucket. email_delivery_events is
-- the live proof: C-04a shipped without a grant, every write returned 42501, and
-- the cron reported success while no customer email was ever sent.
--
-- The same pg_default_acl carries an entry for FUNCTIONS owned by `postgres` in
-- public: {postgres=X/postgres} — owner only. A newly created function therefore
-- does NOT grant EXECUTE to service_role, and every `adminClient.rpc(...)` call
-- from Phase C onward would 42501. Statement 10 grants it explicitly. It also
-- REVOKEs from PUBLIC/anon/authenticated first, which is what keeps this
-- migration from adding two new `*_security_definer_function_executable`
-- findings to `mcp__supabase__get_advisors` (create_booking_request already
-- carries both because PUBLIC holds EXECUTE on it).
--
-- Note what the GRANTs are and are not for. create_recurring_booking_series is
-- SECURITY DEFINER owned by `postgres`, so its own INSERTs run as the table
-- owner and need no grant and bypass RLS. The table grants exist for the DIRECT
-- PostgREST access in later phases — cancelRecurringSeries' UPDATE, the series
-- view's SELECT, C-06's deleteClient cascade. Do not delete them as redundant.
--
-- service_role also has rolbypassrls = true, so policy rbt_service_role_all is
-- decorative for it. It is kept because it documents intent and is correct if
-- that role attribute ever changes; the GRANT is what actually matters.
--
--
-- ⚠️ booking_source TRAP — statement 7, and the one line here most worth a
-- second look before approval.
--
-- The plan (§1 Step 5) and brief (§2.4) both write recurring occurrences with
-- booking_source = 'recurring'. The live constraint does not allow that value:
--   CHECK (booking_source = ANY (ARRAY['website','phone','whatsapp','instagram',
--          'referral','admin','manual','other'])) NOT VALID
-- NOT VALID exempts only pre-existing rows; INSERTs are still checked, so every
-- occurrence would fail 23514 and the whole RPC would abort. Statement 7 widens
-- the list by exactly one value. Live data is clean (website 4, whatsapp 5,
-- instagram 2, phone 2, manual 1, referral 1 = 15 rows, every value already in
-- the list), so the re-add validates instantly and NOT VALID is dropped.
--
-- If the Owner would rather not add a ninth source value, the alternative is to
-- delete statement 7 and change the single literal 'recurring' in statement 9's
-- bookings INSERT to 'manual'. Nothing else in this file depends on it —
-- recurring_template_id IS NOT NULL is the canonical marker every C-02 surface
-- (badge, filter, series view) actually keys off.
--
-- Logged, NOT fixed (protocol §1 rule 6a): ManualBookingForm's SOURCE_OPTIONS
-- offers "Facebook" -> value 'facebook', which is absent from the old list and
-- from the new one. Picking it in the admin form 23514s today. Pre-existing,
-- unrelated to C-02, deliberately left alone.
--
--
-- ⚠️ GENDER — why statement 2 carries two columns the plan's draft does not.
--
-- booking_participants.participant_gender, booking_participants.
-- required_therapist_gender and booking_assignments.required_therapist_gender
-- are all NOT NULL with no default, on enum staff_gender_type whose only members
-- are 'male' and 'female' — there is no "any"/"unspecified" value. A creation-
-- time RPC parameter alone cannot satisfy them, because the horizon cron
-- materialises occurrences months later and would have nothing to build from.
-- So the pair is persisted on the template, exactly as service_address_line1 /
-- postcode / city / area already are, and for exactly the same reason.
--
-- open_to_any_therapist is ORTHOGONAL and stays orthogonal: it governs WHICH
-- therapist may take the visits; required_therapist_gender governs WHAT GENDER
-- that therapist must be. The RPC writes the gender onto every participant and
-- every assignment row of every occurrence regardless of the toggle, and the
-- only place the two meet is the bound-therapist validation, which refuses a
-- bound therapist whose own gender contradicts the required gender.
--
--
-- OTHER CORRECTIONS TO THE DRAFTS, all made deliberately:
--   * brief §2.4's parameter list is not compilable — it places DEFAULTed
--     parameters before non-defaulted ones. Statement 9 orders all required
--     parameters first.
--   * the draft sets BOTH anchor_day_of_week and anchor_day_of_month from the
--     first date. With a first date after the 28th that trips
--     rbt_anchor_day_of_month_in_range and rejects a perfectly valid WEEKLY
--     series. Statement 9 sets day_of_week for weekly/fortnightly and
--     day_of_month for monthly, never both.
--   * the draft's client lookup has no `deleted_at IS NULL` guard. Added, to
--     match create_booking_request post-C-06.
--   * the draft's bookings INSERT omits consent_acknowledged and group_booking.
--     Both are set explicitly (a staff member creating a series has taken
--     consent; a recurring series is single-participant by design).
--   * the template snapshots the RESOLVED address (parameter, else the client's
--     stored address), not the raw parameter. A NULL snapshot would force the
--     cron to re-derive, which is the very thing the snapshot columns exist to
--     prevent.
--   * bookings.contact_phone is NOT NULL but clients.phone is nullable, so the
--     RPC raises a readable error rather than letting a 23502 escape.
--   * compute_occurrence_dates is the plan's body with one addition:
--     SET search_path TO 'public'. It touches no schema objects, so this is
--     behaviour-neutral; without it the function adds a new
--     function_search_path_mutable advisor finding.
--
--
-- ⚠️ THE FIRST BATCH — the occurrence counts, stated here rather than left to be
-- discovered, because Phase B's tests and the form copy both depend on them.
--
-- The initial horizon window is EXACTLY p_horizon_weeks weeks long. Statement 9
-- step 10 computes p_first_occurrence_date + (p_horizon_weeks * 7) - 1, i.e.
-- days 0..83 for the default 12 weeks, and statement 8's loop is inclusive of
-- that bound. Over that window, from ANY first date:
--     weekly        12   days 0, 7, ... 77
--     fortnightly    6   days 0, 14, ... 70
--     monthly        3   months 0, 1, 2 — a three-month span is never shorter
--                        than 89 days, so it cannot fit an 84-day window
--
-- Verified read-only 2026-08-02 by replaying the loop as a recursive CTE over
-- 365 consecutive first dates x 3 cadences: 12 / 6 / 3 for every one of them,
-- so the counts do not depend on the anchor date.
--
-- Without the `- 1` the window is 85 days, the loop also picks up day 84, and
-- the same replay gives 13 / 7 / 3. The 13 is what the plan's own formula
-- produced, and it contradicts plan §3.3 ("Expected: 12"), acceptance criterion
-- 3, and brief §2.7's "We'll create the first 12 occurrences now". Owner ruling
-- 2026-08-02: the code matches the plan and the customer-facing copy, so the
-- formula carries the `- 1`.
--
-- The count is still NOT a flat 12 across cadences — only weekly is 12. The
-- horizon is the real contract, not the count, which is why the RPC returns
-- occurrenceCount; later phases should render that value rather than a
-- hardcoded 12.
--
-- horizon_through_date stores this SAME window bound — step 10 feeds one
-- variable to both compute_occurrence_dates and the template INSERT — which is
-- what keeps the column comment true: every on-cadence date <= it has been
-- created, and none after it have. Note for Phase G: it is a WINDOW BOUND, not
-- an occurrence date (day 83 is not on any cadence), so the cron must resume
-- from the series anchor or the last materialised occurrence and must never
-- treat horizon_through_date itself as the previous occurrence.
--
--
-- DELIBERATE NON-BEHAVIOURS (so a reader does not read them as omissions):
--   * No availability / capacity check. create_booking_request's therapist-
--     availability sweep answers "can somebody serve this ONE slot today"; a
--     series spans 12 weeks of rotas that do not exist yet. Occurrences are
--     created unassigned and enter the normal claim/assign queue.
--   * No pre-assignment to bound_therapist_id. create_booking_request never
--     pre-assigns either, and brief §5.6 locks option (a) — skip pre-assignment
--     when eligibility is not established, create the occurrence unassigned.
--     bound_therapist_id is persisted so a later phase can assign through the
--     existing path, against the live engine rather than a copy of it.
--   * No business_settings.booking_window_days check (30 days). A 12-week
--     horizon deliberately exceeds the public booking window.
--   * No allowed_cities check. The address is a snapshot of an existing client
--     record, which passed that check when it was created.
--
--
-- POST-APPLY VERIFICATION (run before any Phase B work; §3b makes the privilege
-- check mandatory before the first write of a kind):
--   select has_table_privilege('service_role','public.recurring_booking_templates','INSERT') as ins,
--          has_table_privilege('service_role','public.recurring_booking_templates','SELECT') as sel,
--          has_table_privilege('service_role','public.recurring_booking_templates','UPDATE') as upd,
--          has_table_privilege('authenticated','public.recurring_booking_templates','SELECT') as auth_sel,
--          has_function_privilege('service_role','public.create_recurring_booking_series','EXECUTE') as rpc_exec,
--          has_function_privilege('service_role','public.compute_occurrence_dates','EXECUTE') as helper_exec;
--   -- all six true
--   select count(*) from information_schema.columns
--    where table_schema='public' and table_name='services' and column_name='allow_recurrence';        -- 1
--   select count(*) from information_schema.columns
--    where table_schema='public' and table_name='bookings' and column_name='recurring_template_id';   -- 1
--   select count(*) from public.recurring_booking_templates;                                          -- 0
--   select count(*) from public.bookings where recurring_template_id is not null;                     -- 0
--   select count(*) from public.services where allow_recurrence = true;                               -- 5
--
--
-- ROLLBACK (reverse order; drops the column and therefore its data):
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.create_recurring_booking_series(
--     uuid, text, date, time, text, text, public.staff_gender_type,
--     public.staff_gender_type, uuid, uuid, boolean, int, date, text, text,
--     text, text, text, boolean, int);
--   DROP FUNCTION IF EXISTS public.compute_occurrence_dates(date, text, date, text, int, date);
--   -- restore the constraint exactly as it was found (NOT VALID included):
--   ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_booking_source_check;
--   ALTER TABLE public.bookings ADD CONSTRAINT bookings_booking_source_check
--     CHECK (booking_source = ANY (ARRAY['website'::text,'phone'::text,'whatsapp'::text,
--            'instagram'::text,'referral'::text,'admin'::text,'manual'::text,'other'::text]))
--     NOT VALID;  -- NOT VALID also spares any row already written as 'recurring'
--   DROP INDEX IF EXISTS public.idx_bookings_recurring_template;
--   ALTER TABLE public.bookings DROP COLUMN IF EXISTS recurring_template_id;
--   DROP TABLE IF EXISTS public.recurring_booking_templates CASCADE;
--   ALTER TABLE public.services DROP COLUMN IF EXISTS allow_recurrence;
--   COMMIT;

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Per-service opt-out flag (brief §2.3).
--    Default true — decisions doc Q3.1 puts every service on from day one; the
--    5 live services all become recurrable, and /admin/services flips
--    individual rows later (plan Phase H Step 24).
-- ---------------------------------------------------------------------------
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS allow_recurrence boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.services.allow_recurrence IS
  'When false, this service cannot start a recurring series. create_recurring_booking_series refuses; the admin form hides the section.';

-- ---------------------------------------------------------------------------
-- 2. recurring_booking_templates (brief §2.1, plus participant_gender and
--    required_therapist_gender — see the GENDER block in the header).
--
--    ON DELETE RESTRICT on client_id is intentional and already coordinated:
--    C-06's deleteClient cancels active templates BEFORE soft-deleting the
--    client (clients/actions.ts:554-575, ahead of the delete at :639-645), so
--    the restriction can never fire in the normal path.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_booking_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  -- Therapist binding
  bound_therapist_id uuid NULL REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  open_to_any_therapist boolean NOT NULL DEFAULT false,
  -- Time-of-day anchor + the day anchor for the cadence in use
  anchor_day_of_week int2 NULL,   -- 0=Sunday..6=Saturday; weekly + fortnightly only
  anchor_day_of_month int2 NULL,  -- 1..28; monthly only
  anchor_start_time time NOT NULL,
  total_duration_mins int NOT NULL,
  -- Gender snapshot — the cron cannot re-derive these, and all three target
  -- columns downstream are NOT NULL on a two-member enum. See header.
  participant_gender public.staff_gender_type NOT NULL,
  required_therapist_gender public.staff_gender_type NOT NULL,
  -- Cadence
  cadence text NOT NULL CHECK (cadence IN ('weekly', 'fortnightly', 'monthly')),
  -- End conditions
  end_type text NOT NULL CHECK (end_type IN ('until_cancelled', 'after_count', 'until_date')),
  end_count int NULL,
  end_date date NULL,
  -- Service address snapshot, so a later change to the client record cannot
  -- silently move every future occurrence
  service_address_line1 text NULL,
  service_postcode text NULL,
  service_city text NULL,
  service_area text NULL,
  -- Lifecycle
  created_by uuid NOT NULL REFERENCES public.staff_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz NULL,
  cancelled_by uuid NULL REFERENCES public.staff_profiles(id),
  cancelled_reason text NULL,
  -- How far ahead occurrences have been materialised
  horizon_through_date date NOT NULL,
  notes text NULL,
  -- Cross-field constraints
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

-- ---------------------------------------------------------------------------
-- 3. Indexes (brief §2.1 verbatim).
--    _horizon is the one the cron's candidate query uses. _client serves C-06's
--    deleteClient cascade and the client detail page. _active is a partial index
--    on a column that is NULL across the whole indexed subset — near-useless as
--    a lookup structure, kept because it is the plan's text and it costs
--    essentially nothing on a table of this size.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_recurring_templates_active
  ON public.recurring_booking_templates (cancelled_at) WHERE cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_templates_horizon
  ON public.recurring_booking_templates (horizon_through_date) WHERE cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_templates_client
  ON public.recurring_booking_templates (client_id);

-- ---------------------------------------------------------------------------
-- 4. RLS. Writes go through service_role only; signed-in staff may read.
--    Both policies are documentation-grade only — see the GRANT TRAP header.
-- ---------------------------------------------------------------------------
ALTER TABLE public.recurring_booking_templates ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY has no IF NOT EXISTS form, so drop first — that is what keeps
-- this file re-appliable (see the IDEMPOTENCY note in the header).
DROP POLICY IF EXISTS rbt_service_role_all ON public.recurring_booking_templates;
CREATE POLICY rbt_service_role_all ON public.recurring_booking_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS rbt_authenticated_read ON public.recurring_booking_templates;
CREATE POLICY rbt_authenticated_read ON public.recurring_booking_templates
  FOR SELECT TO authenticated USING (true);
-- Authenticated INSERT/UPDATE/DELETE deliberately absent — server actions go
-- through service_role.

-- ---------------------------------------------------------------------------
-- 5. Table GRANTs. Without these the table is unreadable and unwritable by the
--    application no matter what the policies above say. See the GRANT TRAP.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_booking_templates TO service_role;
GRANT SELECT ON public.recurring_booking_templates TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. The link from an occurrence back to its series (brief §2.2).
--    ON DELETE SET NULL: deleting a template (rare — cancellation is the normal
--    path) leaves the bookings intact but unlinked.
--    bookings already grants authenticated SELECT at table level, so the new
--    column inherits it; no extra grant needed.
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS recurring_template_id uuid NULL
    REFERENCES public.recurring_booking_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_recurring_template
  ON public.bookings (recurring_template_id) WHERE recurring_template_id IS NOT NULL;

COMMENT ON COLUMN public.bookings.recurring_template_id IS
  'Set when this booking is an occurrence of a recurring series. The canonical recurring marker for the calendar badge, the bookings-list Series filter and the series view.';

-- ---------------------------------------------------------------------------
-- 7. booking_source CHECK — widened by exactly one value. See the
--    booking_source TRAP in the header for why this is not optional and for the
--    one-line alternative if the Owner prefers not to add the value.
--
--    Live definition, captured read-only 2026-08-02:
--      CHECK ((booking_source = ANY (ARRAY['website'::text, 'phone'::text,
--        'whatsapp'::text, 'instagram'::text, 'referral'::text, 'admin'::text,
--        'manual'::text, 'other'::text]))) NOT VALID
--
--    Re-added WITHOUT NOT VALID: all 15 live rows already satisfy the widened
--    list, so the validating re-add succeeds instantly and leaves the table in a
--    strictly better state than it was found in.
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_booking_source_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_booking_source_check
  CHECK (booking_source IN (
    'website', 'phone', 'whatsapp', 'instagram',
    'referral', 'admin', 'manual', 'other', 'recurring'
  ));

-- ---------------------------------------------------------------------------
-- 8. compute_occurrence_dates — pure date math (plan §1 Step 1 statement 5).
--
--    Contract: returns every occurrence date from p_first_date up to the
--    effective end, inclusive. NEVER returns NULL — v_dates starts as an empty
--    array — so FOREACH over the result is always safe.
--
--    Deliberately dumb about the day-of-month problem: the caller gates
--    monthly cadence to days 1-28 (plan §1 Step 4 locks "compute is pure"), so
--    `+ INTERVAL '1 month'` is exact and never clamps.
-- ---------------------------------------------------------------------------
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

  -- LEAST ignores NULLs, so a NULL p_end_date degrades to the horizon.
  v_effective_end := CASE p_end_type
    WHEN 'until_cancelled' THEN p_horizon_end
    WHEN 'until_date' THEN LEAST(p_end_date, p_horizon_end)
    WHEN 'after_count' THEN p_horizon_end  -- count limit applied in the loop
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

-- ---------------------------------------------------------------------------
-- 9. create_recurring_booking_series.
--
--    Mirrors public.create_booking_request: same service_role gate and errcode,
--    same London-today derivation, same nullif(trim(coalesce(...))) cleaning,
--    same client resolution guard and P0002, same advisory-lock idiom, same
--    participant -> items -> assignments write order, same jsonb return shape.
--
--    Differs where a series differs from a single booking — every difference is
--    listed in the header's DELIBERATE NON-BEHAVIOURS and OTHER CORRECTIONS
--    blocks rather than repeated here.
--
--    Concurrency: a per-client transaction-scoped advisory lock serialises two
--    admins creating series for the same client, which is what makes the
--    per-occurrence duplicate check below race-free (brief §5.9).
-- ---------------------------------------------------------------------------
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
  -- 1. Service-role gate (create_booking_request idiom, same errcode).
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'create_recurring_booking_series may only be called with the service role'
      USING errcode = '42501';
  END IF;

  -- 2. Required scalars. Checked before anything is compared, so a NULL can
  --    never fall through a three-valued comparison into a later raw error.
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

  -- 3. End condition. Normalised to exactly what the table's two cross-field
  --    CHECKs expect, so a stale value left on the form can never turn into a
  --    23514 the operator cannot read.
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

  -- 4. Day anchors. Exactly one is set — see OTHER CORRECTIONS in the header.
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

  -- 5. Service.
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

  -- Gender restriction on the service (create_booking_request's check, reduced
  -- to the single participant a recurring series has by design).
  IF (v_service.gender_restrictions = 'male_only' AND p_participant_gender = 'female')
     OR (v_service.gender_restrictions = 'female_only' AND p_participant_gender = 'male') THEN
    RAISE EXCEPTION 'Selected service is not suitable for this participant';
  END IF;

  v_end_time := p_anchor_start_time + make_interval(mins => v_service.duration_mins);

  IF v_end_time <= p_anchor_start_time THEN
    RAISE EXCEPTION 'Booking must finish on the same day after it starts';
  END IF;

  -- 6. Client. deleted_at guard mirrors create_booking_request branch 1.
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

  -- bookings.contact_phone is NOT NULL; clients.phone is not. Raise something
  -- readable rather than let a 23502 reach the operator.
  IF v_contact_phone IS NULL THEN
    RAISE EXCEPTION 'The client record has no phone number, which every booking requires'
      USING errcode = 'P0001',
            hint = 'Add a phone number to the client record and create the series again.';
  END IF;

  -- 7. Actor. created_by is NOT NULL with an FK; check it here so a stale staff
  --    id surfaces as a sentence rather than a 23503.
  IF NOT EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = p_actor_staff_id) THEN
    RAISE EXCEPTION 'Acting staff profile does not exist'
      USING errcode = 'P0002';
  END IF;

  -- 8. Bound therapist. This is the ONLY place open_to_any_therapist and
  --    required_therapist_gender interact: a named therapist whose own gender
  --    contradicts the required gender makes the series unservable, so refuse it
  --    now rather than materialise 12 visits nobody may take.
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

  -- 9. Address snapshot: the supplied override, else the client's stored
  --    address. Resolved HERE so the template holds real values and the horizon
  --    cron never has to re-derive them.
  v_address_line1 := coalesce(nullif(trim(coalesce(p_service_address_line1, '')), ''), v_client.address);
  v_postcode      := coalesce(nullif(trim(coalesce(p_service_postcode, '')), ''), v_client.postcode);
  v_city          := coalesce(nullif(trim(coalesce(p_service_city, '')), ''), v_client.city);
  v_area          := coalesce(nullif(trim(coalesce(p_service_area, '')), ''), v_client.area);

  -- 10. Occurrence dates within the initial horizon.
  --     The window is exactly v_horizon_weeks weeks long: days 0..(weeks*7 - 1).
  --     The `- 1` is load-bearing — without it the window is 85 days for the
  --     default 12 and the inclusive loop yields 13 weekly visits instead of the
  --     12 the plan and the form copy promise. See THE FIRST BATCH in the header.
  --
  --     ONE variable feeds both the compute bound and the template's
  --     horizon_through_date, deliberately: the stored date must describe the
  --     window this batch actually filled. Bounding the loop tighter than the
  --     stored date would make the template claim coverage of dates that were
  --     never created, and the horizon cron — which resumes beyond
  --     horizon_through_date — would silently skip them forever.
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

  -- 11. Serialise concurrent series creation for the same client, so the
  --     per-occurrence duplicate check below cannot be raced (brief §5.9).
  PERFORM pg_advisory_xact_lock(
    hashtextextended('create_recurring_booking_series:' || p_client_id::text, 0)
  );

  -- 12. Template row.
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

  -- 13. Materialise the occurrences.
  FOREACH v_dt IN ARRAY v_occurrence_dates LOOP
    -- Skip a date the client is already booked on at this time. Conservative:
    -- cancelled and no-show rows do not block, so a series can be recreated
    -- over a cancelled one (brief §5.9).
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
      false,           -- single participant by design (brief §12)
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

    -- Written from the service row already validated above rather than
    -- re-selected. create_booking_request re-selects with an
    -- `is_visible_on_frontend = true` filter, which for a single named slug
    -- could silently insert ZERO line items and leave a priced booking with no
    -- services on it.
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

    -- Unassigned, exactly like create_booking_request. The gender requirement
    -- rides on the row regardless of open_to_any_therapist.
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

  -- 14. Audit.
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

-- ---------------------------------------------------------------------------
-- 10. Function EXECUTE grants. Without the GRANT the Phase C server action's
--     adminClient.rpc(...) returns 42501; without the REVOKE this migration
--     adds two new advisor findings. See the GRANT TRAP in the header.
--     REVOKE from a role holding nothing is a no-op, so this is safe as written.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.compute_occurrence_dates FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_occurrence_dates TO service_role;

REVOKE ALL ON FUNCTION public.create_recurring_booking_series FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_recurring_booking_series TO service_role;

COMMIT;
