# C-02 — Recurring / standing bookings

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: `C-01` (`git log --oneline --grep="C-01" | grep -q "feat(redesign): C-01"`), `C-08` (`git log --oneline --grep="C-08" | grep -q "feat(redesign): C-08"`).
> Decisions: C-B-DECISIONS.md §2 Q3 + §3 C-02. Findings applied: see refinement changelog (companion plan file).

**Type:** Band C plan-writing brief (C-B phase)
**Date written:** 2026-05-26
**Predecessors:**
- `redesign/plans/C-phase/C-B-DECISIONS.md` §2 Q3 + §3 C-02 (all 7 sub-decisions locked; Hijri/Sunnah explicitly dropped)
- `redesign/audits/C-A/W07-availability-recurring-flow.md` §10 (full architecture deliverable — lift verbatim)
**Companion files:**
- Plan: `redesign/plans/C-phase/C-02-recurring-bookings-plan.md`
- Progress: `redesign/per-page-progress/C-02-recurring-bookings-progress.md` (filled during C-C)

---

## 0 — TL;DR

C-02 is **the largest C-B plan by scope alongside C-11.** Fully greenfield — zero recurrence schema, zero recurrence UI, zero recurrence code exists today (W07 confirmed via DB introspection + code grep). Every layer needs to be built.

**Single feature, four surfaces touched:**
1. **Backend** — new `recurring_booking_templates` table + new `bookings.recurring_template_id` FK column + new `create_recurring_booking_series` RPC + new Cloudflare Worker cron job `extend-recurring-series-horizons` (mirrors `booking-reminders` pattern from C-01).
2. **Frontend (`/admin/bookings/new`)** — extend `ManualBookingForm` with a "Make this recurring?" toggle + conditional sub-form for cadence + end-condition + therapist binding.
3. **Calendar + bookings list** — badge "Recurring" on instances; new filter for series.
4. **Email** — new template `renderRecurringSeriesCreatedEmail` confirms series creation to the client.

**Locked decisions (lifted from C-B-DECISIONS Q3 — all 7 sub-questions answered):**
- **Cadences:** weekly, fortnightly, monthly (same day-of-month). No custom intervals. **No Hijri/Sunnah** (decisions doc explicit drop).
- **Services:** all services on by default. Per-service opt-out flag (`services.allow_recurrence boolean default true`).
- **Roles:** Owner + Admin + Booking Coordinator can set. Therapist cannot. Public booking form: NO.
- **End-conditions:** until cancelled / after N occurrences / until specific date — all three.
- **Single-occurrence cancellation:** per-occurrence default. Explicit "Cancel series" button for ending the whole thing.
- **Reschedule cascade:** per-occurrence only. No "shift all subsequent" feature.
- **Therapist binding:** locked by default (same therapist for whole series). "Open to any therapist" toggle at series creation.

**Generation strategy:** hybrid — initial 12 occurrences materialised as `bookings` rows at series creation; nightly Cloudflare cron extends the horizon to maintain ~12-week visibility.

---

## 1 — Why this plan exists

### 1.1 Greenfield confirmation (W07)

W07 §1 verified via direct DB introspection:
- `bookings` table has zero recurrence columns (`recurrence_*`, `series_*`, `parent_booking_id`, `cycle_*` — all absent).
- `public` schema has zero recurrence tables.
- Code grep for `recur|recurring|standing|cadence|lunar|hijri` returns 0 substantive matches.
- `ManualBookingForm` has no recurrence step.

**C-02 builds the whole feature from scratch.**

### 1.2 Why hybrid generation (12 weeks ahead, cron-extended)

Three options were considered in W07 §10:
- (a) **Pure on-demand:** generate next occurrence when previous one completes. Risk: cron failure leaves clients with no future visits.
- (b) **Materialise everything up to end_date upfront:** simple but wasteful (10 years of weekly bookings = 520 rows for one client).
- (c) **Hybrid (12-week rolling window):** initial 12 rows at series creation; nightly cron extends. **Selected per decisions doc Q3 + W07 §10 recommendation.**

The cron is the same Cloudflare Worker infrastructure from C-01 — adds a third cron trigger to `wrangler.jsonc` + a new dispatch handler in `worker-entrypoint.ts`.

### 1.3 Why per-occurrence cancel (not series-default cascade)

The decisions doc Q3.5 locked per-occurrence default. A client booking 12 weeks ahead may need to skip one Friday without cancelling the entire series — that's the common case. Explicit "Cancel series" button covers the rarer "I want to stop the whole thing" case.

### 1.4 Why therapist binding default-locked (with override)

A regular weekly massage client builds rapport with one therapist. Locking the assignment to that therapist preserves the relationship. The "Open to any therapist" toggle covers the case where the client prioritises slot availability over therapist continuity. Decisions doc Q3.7.

### 1.5 Why no Hijri/Sunnah support (explicit drop)

Master plan §130 placed cupping/hijama-specific compliance OUT of Band C. Hijri dates + Sunnah days (17/19/21 of lunar month) fall in that category. **Decisions doc Q3 explicitly drops the Hijri converter, the `cadence_meta jsonb` column, and the lunar-cycle cadence option.** C-02's cadence enum is just `weekly | fortnightly | monthly`. Future enhancement if user prioritises.

---

## 2 — Scope (lifted from C-B-DECISIONS §3 C-02 + W07 §10)

### 2.1 New table `recurring_booking_templates`

```sql
CREATE TABLE public.recurring_booking_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  -- Therapist binding
  bound_therapist_id uuid NULL REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  open_to_any_therapist boolean NOT NULL DEFAULT false,
  -- Time-of-day anchor (e.g., always 14:00) + day-of-week for weekly/fortnightly
  anchor_day_of_week int2 NULL, -- 0=Sunday..6=Saturday (for weekly + fortnightly)
  anchor_day_of_month int2 NULL, -- 1..28 (for monthly — restricted to 1-28 for safety)
  anchor_start_time time NOT NULL,
  total_duration_mins int NOT NULL, -- snapshot from service.duration at template creation
  -- Cadence
  cadence text NOT NULL CHECK (cadence IN ('weekly', 'fortnightly', 'monthly')),
  -- End conditions
  end_type text NOT NULL CHECK (end_type IN ('until_cancelled', 'after_count', 'until_date')),
  end_count int NULL, -- for after_count
  end_date date NULL, -- for until_date
  -- Service address (snapshot — recurring uses client's default address but stored here so changes don't break future occurrences)
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
  -- Horizon tracking — for the cron to know how far ahead has been materialised
  horizon_through_date date NOT NULL, -- updated by cron + by create_recurring_booking_series
  -- Audit
  notes text NULL
);

CREATE INDEX idx_recurring_templates_active ON public.recurring_booking_templates (cancelled_at) WHERE cancelled_at IS NULL;
CREATE INDEX idx_recurring_templates_horizon ON public.recurring_booking_templates (horizon_through_date) WHERE cancelled_at IS NULL;
CREATE INDEX idx_recurring_templates_client ON public.recurring_booking_templates (client_id);

ALTER TABLE public.recurring_booking_templates ENABLE ROW LEVEL SECURITY;

-- RLS: service_role + staff with manage_bookings_all
CREATE POLICY rbt_service_role ON public.recurring_booking_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### 2.2 New column on `bookings`

```sql
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS recurring_template_id uuid NULL
    REFERENCES public.recurring_booking_templates(id) ON DELETE SET NULL;

CREATE INDEX idx_bookings_recurring_template ON public.bookings (recurring_template_id) WHERE recurring_template_id IS NOT NULL;
```

`ON DELETE SET NULL`: if a template is deleted (rare — usually cancelled instead), child bookings keep their data but lose the linkage.

### 2.3 New column on `services`

```sql
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS allow_recurrence boolean NOT NULL DEFAULT true;
```

Default true (per decisions doc Q3.1 — all services on by default). Per-service opt-out is a one-row UPDATE in `/admin/services`.

### 2.4 New RPC `create_recurring_booking_series`

```sql
CREATE OR REPLACE FUNCTION public.create_recurring_booking_series(
  -- Template inputs
  p_client_id uuid,
  p_service_slug text,
  p_bound_therapist_id uuid DEFAULT NULL,
  p_open_to_any_therapist boolean DEFAULT false,
  p_first_occurrence_date date,
  p_anchor_start_time time,
  p_cadence text,                   -- 'weekly' | 'fortnightly' | 'monthly'
  p_end_type text,                  -- 'until_cancelled' | 'after_count' | 'until_date'
  p_end_count int DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  -- Service address inputs (or NULL to use client's default)
  p_service_address_line1 text DEFAULT NULL,
  p_service_postcode text DEFAULT NULL,
  p_service_city text DEFAULT NULL,
  p_service_area text DEFAULT NULL,
  -- Notes
  p_notes text DEFAULT NULL,
  -- Actor
  p_actor_staff_id uuid,
  -- Initial horizon
  p_horizon_weeks int DEFAULT 12
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
DECLARE
  v_template_id uuid;
  v_horizon_through date;
  v_occurrence_dates date[];
  v_dt date;
  v_booking_id uuid;
  v_created_count int := 0;
BEGIN
  -- 1. Service-role gate (mirror create_booking_request pattern)
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'create_recurring_booking_series may only be called with the service role'
      USING errcode = '42501';
  END IF;

  -- 2. Validate inputs (service exists, recurrence allowed, client exists, etc.)
  -- ... full validation logic per W07 §10 ...

  -- 3. Generate occurrence dates within the horizon window
  v_horizon_through := p_first_occurrence_date + (p_horizon_weeks * 7);
  v_occurrence_dates := compute_occurrence_dates(
    p_first_occurrence_date,
    p_cadence,
    v_horizon_through,
    p_end_type,
    p_end_count,
    p_end_date
  );

  -- 4. Insert template row
  INSERT INTO public.recurring_booking_templates (
    client_id, service_id, bound_therapist_id, open_to_any_therapist,
    anchor_day_of_week, anchor_day_of_month, anchor_start_time, total_duration_mins,
    cadence, end_type, end_count, end_date,
    service_address_line1, service_postcode, service_city, service_area,
    created_by, horizon_through_date, notes
  )
  VALUES (
    p_client_id, (SELECT id FROM services WHERE slug = p_service_slug), p_bound_therapist_id, p_open_to_any_therapist,
    EXTRACT(DOW FROM p_first_occurrence_date)::int2,
    EXTRACT(DAY FROM p_first_occurrence_date)::int2,
    p_anchor_start_time,
    (SELECT duration_mins FROM services WHERE slug = p_service_slug),
    p_cadence, p_end_type, p_end_count, p_end_date,
    p_service_address_line1, p_service_postcode, p_service_city, p_service_area,
    p_actor_staff_id, v_horizon_through, p_notes
  )
  RETURNING id INTO v_template_id;

  -- 5. For each occurrence date, call into create_booking_request OR insert directly
  --    (decision: insert directly to keep the RPC self-contained; tag with recurring_template_id)
  FOREACH v_dt IN ARRAY v_occurrence_dates LOOP
    INSERT INTO public.bookings (
      client_id, contact_full_name, contact_email, contact_phone,
      booking_source, booking_date, start_time, end_time,
      total_duration_mins, total_price, amount_due, amount_paid,
      payment_status, status, assignment_status,
      service_address_line1, service_city, service_postcode,
      recurring_template_id
    )
    SELECT
      p_client_id, c.full_name, c.email, c.phone,
      'recurring', v_dt, p_anchor_start_time,
      p_anchor_start_time + make_interval(mins => s.duration_mins),
      s.duration_mins, s.price, s.price, 0,
      'unpaid', 'pending', 'unassigned',
      COALESCE(p_service_address_line1, c.address),
      COALESCE(p_service_city, c.city),
      COALESCE(p_service_postcode, c.postcode),
      v_template_id
    FROM public.clients c, public.services s
    WHERE c.id = p_client_id AND s.slug = p_service_slug
    RETURNING id INTO v_booking_id;

    -- Insert booking_participants + booking_items + booking_assignments
    -- (mirror create_booking_request's participant loop, simplified to 1 participant
    --  since recurring is single-client by design)
    -- ...

    v_created_count := v_created_count + 1;
  END LOOP;

  -- 6. Audit log
  INSERT INTO public.audit_logs (
    actor_staff_id, action_type, target_type, target_id, after_state
  ) VALUES (
    p_actor_staff_id, 'recurring_series_created', 'recurring_booking_templates', v_template_id,
    jsonb_build_object(
      'cadence', p_cadence,
      'end_type', p_end_type,
      'occurrence_count', v_created_count,
      'horizon_through', v_horizon_through
    )
  );

  RETURN jsonb_build_object(
    'templateId', v_template_id,
    'occurrenceCount', v_created_count,
    'horizonThrough', v_horizon_through
  );
END;
$$;
```

Helper function `compute_occurrence_dates`:

```sql
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

  -- Determine effective end date based on end_type
  v_effective_end := CASE p_end_type
    WHEN 'until_cancelled' THEN p_horizon_end
    WHEN 'until_date' THEN LEAST(p_end_date, p_horizon_end)
    WHEN 'after_count' THEN p_horizon_end -- count limit applied below
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
```

### 2.5 New Cloudflare Worker cron `extend-recurring-series-horizons`

Per the C-01 pattern. Mirrors `booking-reminders`:

- New cron trigger in `wrangler.jsonc`: `"0 3 * * *"` (daily 03:00 UTC — off-peak).
- `worker-entrypoint.ts` dispatches based on `event.cron` to `fireExtendRecurringHorizons(env)`.
- New route `src/app/api/cron/extend-recurring-horizons/route.ts`:

```ts
export async function POST(request: Request): Promise<Response> {
  // Auth gate (X-Cron-Secret)
  // For each active template (cancelled_at IS NULL) where horizon_through_date < (today + 12 weeks):
  //   Compute the next batch of occurrence dates (from current horizon to new horizon)
  //   Insert new bookings + participants + items + assignments tagged with recurring_template_id
  //   UPDATE template SET horizon_through_date = new_horizon
  //   Insert audit_logs row: 'recurring_series_extended'
  //
  // Respects per-template end_type:
  //   - until_cancelled: extend by 12 weeks
  //   - until_date: extend only up to end_date
  //   - after_count: extend only until count reached
  // Concurrent-safe via per-template advisory lock.
}
```

### 2.6 New server actions

In `src/app/admin/bookings/actions.ts` (or new colocated file `src/app/admin/bookings/recurring-actions.ts`):

```ts
// 1. Create series — wraps the RPC call
export async function createRecurringSeries(
  _previousState: ManualBookingState,
  formData: FormData
): Promise<ManualBookingState>;

// 2. Cancel single occurrence — uses existing quickUpdateBooking action=cancel
//    (no new action needed; per-occurrence cancel is just a normal cancel)

// 3. Cancel entire series — new action
export async function cancelRecurringSeries(formData: FormData): Promise<{ ok: boolean; cancelledOccurrenceCount: number; error?: string }>;
// - RBAC: canManageAllBookings
// - SET cancelled_at on template
// - Cascade: UPDATE bookings SET status='cancelled' WHERE recurring_template_id = <id> AND status IN ('pending', 'confirmed') AND booking_date >= today
// - Audit log row: 'recurring_series_cancelled'
// - Email: send 'recurring_series_cancelled_client' to client (or reuse existing cancellation template per-occurrence — TBD §9.3)
```

### 2.7 Form changes — `ManualBookingForm`

*(Refinement 2026-07-26, C02-F3: verified against current code — the form's date/time picker actually lives in step 3 (`validateStep` step===3 gate at `ManualBookingForm.tsx:212-217`, panel at `:1416-1417`); step 4 is the Review/Confirm summary screen (`:1654-1892`) where the submit button lives (`:1921-1930`). The sketch below uses the brief's original "Step 4: Date & time" framing for narrative purposes only — the companion plan's Step 14 anchors the actual mount point to the Review/Confirm block, not the date/time picker.)*

Extend `ManualBookingForm.tsx` (currently 4-step wizard: Contact / Services / Location / Date+time) with a **5th conditional step** OR an inline "Make this recurring?" section in step 4 (Date+time):

**Recommended: inline section in step 4** — keeps the form's "4-step wizard" mental model.

```
Step 4: Date & time
  Date: [date picker]
  Time: [time slot]

  ┌─ Make this recurring? ─────────────────────────────────────────┐
  │ ☐ Yes, repeat this booking                                     │
  │                                                                 │
  │ (when checked, expand sub-form:)                                │
  │                                                                 │
  │ Cadence:   [Weekly ▾]   ← Weekly / Fortnightly / Monthly       │
  │                                                                 │
  │ Ends:      ⚪ Until cancelled                                   │
  │            ⚪ After [N] occurrences                             │
  │            ⚪ On a specific date  [date picker]                │
  │                                                                 │
  │ Therapist: ☑ Lock to selected therapist (default)              │
  │            ☐ Open to any therapist                             │
  │                                                                 │
  │ ℹ️  We'll create the first 12 occurrences now. The system       │
  │    extends the schedule automatically.                         │
  └─────────────────────────────────────────────────────────────────┘
```

The sub-form is gated by `service.allow_recurrence === true`. If the selected service has it disabled, the section is replaced with: *"Recurring not available for {service_name}. Contact admin to enable."*

When the user submits with recurring enabled, the action dispatches to `createRecurringSeries` instead of `createManualBooking`. The RPC creates the template + materialises 12 occurrences. Redirect goes to the SERIES landing page (see §2.9).

### 2.8 New email template `recurring_series_created`

Per C-08 pattern:
- Renderer in `templates.ts`.
- Send fn in `notifications.ts`.
- SUBJECTS map entry.
- templates-data.ts registration.
- Event type: `recurring_series_created_client`.

Default copy:
- Subject: "Your recurring booking is set"
- Body: "Hi {clientName}, we've set up your {cadence} {serviceName} starting {firstDate} at {startTime}. The next {occurrenceCount} visits are confirmed. We'll send reminders for each one."

Fires once at series creation (NOT once per occurrence). Subsequent occurrences get the standard `booking_confirmation` email per existing send pattern.

### 2.9 Calendar + bookings list integration

**Calendar (`/admin/calendar`):** when rendering a booking with `recurring_template_id IS NOT NULL`, add a small badge "↻ Recurring" near the booking pill. Hover/tap reveals the cadence + the link to the series view.

**Bookings list (`/admin/bookings`):** new filter chip "Series" — shows only bookings with `recurring_template_id IS NOT NULL`. Plus a small "↻" icon on each row to indicate recurrence membership.

### 2.10 Series view (NEW route)

`/admin/bookings/series/[templateId]` — landing page for a recurring series. Shows:
- Template metadata (client, service, cadence, end condition, therapist binding)
- Future occurrences (list, paginated)
- Past occurrences (collapsed disclosure)
- Action buttons:
  - "Cancel entire series" (destructive, confirm modal)
  - "Edit series" (admin only — limited fields editable per §5.8)
  - "View linked client" (link to client detail)

When a user clicks an occurrence row, navigate to that booking's standard detail page. Per-occurrence cancel/reschedule happens from there using existing flows.

---

## 3 — RBAC matrix (C-02 actions × roles)

No new permissions. Existing `manage_bookings_all` covers:

| Action | Owner | Admin | Booking Coord | Therapist |
|---|---|---|---|---|
| Create recurring series via ManualBookingForm | ✅ | ✅ | ✅ | ❌ |
| Edit recurring template (limited fields per §5.8) | ✅ | ✅ | ✅ | ❌ |
| Cancel entire series | ✅ | ✅ | ✅ | ❌ |
| Cancel single occurrence (via standard cancel) | ✅ | ✅ | ✅ | ❌ (RBAC unchanged) |
| View series detail page | ✅ | ✅ | ✅ | ❌ (Therapist sees individual assigned bookings) |
| Receive `recurring_series_created_client` email | n/a — client only | — | — | — |
| Toggle `services.allow_recurrence` flag | ✅ via `manage_services` | ✅ same | ❌ | ❌ |

Public booking form (out-of-admin tree) does NOT expose recurrence creation (per decisions doc Q3.2).

---

## 4 — Layout strategy

### 4.1 ManualBookingForm step 4 — inline recurring section

*(Refinement 2026-07-26, C02-F3: "step 4" here means the wizard step this section's UX narrative is framed around — in the current codebase the mount point is the step-4 Review/Confirm block, not the date/time picker, which is step 3. See §2.7 note and companion plan Step 14.)*

Per §2.7 sketch. Key UX details:

- The "☐ Yes, repeat this booking" checkbox starts unchecked. When unchecked, no recurrence sub-fields render. When checked, the sub-form expands inline below.
- Cadence dropdown labels:
  - "Weekly (every {weekday})"
  - "Fortnightly (every other {weekday})"
  - "Monthly (every {day_of_month} of the month)" — only available if `day_of_month <= 28`. If user picked a date > 28, the option is disabled with helper: "Monthly recurrence requires a day between 1 and 28."
- End-condition radio set: 3 options as in §2.7. Inputs (N count / date picker) gated by selection.
- Therapist binding checkbox: default checked. Helper text under "Lock to selected therapist" reads: "All future visits will be assigned to {therapistName}." When the user picked "Take myself" in step 4, the checkbox label changes to "Lock to me".
- Info banner at the bottom: "We'll create the first 12 occurrences now. The system extends the schedule automatically."

**Validation:**
- Monthly cadence + first date > 28 → form-level error.
- After-count selected without a number → fieldError on N input.
- Until-date selected with a date before first occurrence → fieldError.
- Therapist binding ON without a selected therapist → fieldError.

### 4.2 Series view layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back to bookings                                                  │
│                                                                      │
│ Recurring booking · Hijama Package                                  │
│ Weekly · Locked to Sara Ahmed · Until cancelled                     │
│                                                                      │
│ ┌─ Client ──────────────────────────────────────┐                   │
│ │ Fatima Ahmed                                  │                   │
│ │ ↗ View profile                                │                   │
│ └───────────────────────────────────────────────┘                   │
│                                                                      │
│ ┌─ Upcoming visits (12) ────────────────────────────────────────┐   │
│ │ ✓ Sat 28 May · 14:00 · Confirmed · Sara Ahmed                │   │
│ │ ✓ Sat 4 Jun  · 14:00 · Pending   · Sara Ahmed                │   │
│ │ … 10 more upcoming                                           │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ ▾ Past visits (3)                                                   │
│                                                                      │
│ ┌─ Actions ──────────────────────────────────────┐                  │
│ │ [ Edit series ]  [ Cancel entire series ]      │                  │
│ └────────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

Mobile (375): vertical stack; action buttons at the bottom as sticky.

### 4.3 Cancel series confirm modal

```
"Cancel entire recurring series?

· {N} future occurrences will be cancelled.
· Past occurrences are preserved (audit + tax records).
· The client will be emailed about the series cancellation.
· You can re-create a new series anytime."

[ Cancel ] [ Cancel entire series — destructive ]
```

Below the cancel button, optional textarea: "Reason (optional, shown in audit log)".

### 4.4 Calendar badge

Each booking pill on the calendar gains a small "↻" icon when `recurring_template_id IS NOT NULL`. Hover (desktop) or tap (mobile) shows tooltip: "Weekly recurring · 12 of 24 scheduled · ↗ View series". Doesn't disrupt the existing pill layout.

### 4.5 Bookings list filter

Add filter chip "Series" alongside existing chips (today / upcoming / claimable / etc.). Filter logic: `booking.recurring_template_id IS NOT NULL`. Plus a small "↻" icon on each row's left-edge to indicate membership.

---

## 5 — States & edge cases

### 5.1 Service has `allow_recurrence=false`

The form's recurring section renders disabled with helper text "Recurring not available for {serviceName}. Contact an Owner to enable." Owner/Admin can flip the service flag via `/admin/services`.

### 5.2 First occurrence date is in the past

Form validation rejects: "First occurrence must be in the future." Match existing booking-form date validation.

### 5.3 Cron extends a series whose end_type='after_count' is already met

`compute_occurrence_dates` returns an empty array when the count is reached. Cron handler skips the template + advances `horizon_through_date` to today so the template no longer enters the active query window. Eventually the cron filter `WHERE horizon_through_date < today + 12 weeks` no longer matches; the template stays in DB but quiesces.

### 5.4 Cron extends a series whose end_type='until_date' has passed

Same as 5.3 — empty array, template quiesces.

### 5.5 Bound therapist becomes inactive

`bound_therapist_id REFERENCES staff_profiles ON DELETE SET NULL` — if the therapist row is deleted, the field becomes NULL. The template effectively becomes "open to any therapist" automatically. Future occurrences created by the cron go in as unassigned (no specific therapist preselected).

If the therapist is `active=false` (soft inactive, not deleted), the cron creates occurrences as unassigned (the existing booking-create logic excludes inactive therapists from eligibility). The series effectively pauses on therapist assignment but still creates the bookings.

**Edge case:** if a series is supposed to be locked to a now-inactive therapist, surface a "Series needs attention" banner on the series view page. Allow admin to either pick a new bound therapist OR flip to "open to any". Plan §1 Step 12 documents.

### 5.6 Bound therapist double-booked at a future occurrence

When cron creates a new occurrence, it pre-assigns to the bound therapist. If the therapist is already busy at that time, the assignment row gets `assigned_staff_id = bound_therapist_id` BUT the eligibility check would normally reject the assignment.

Two options:
- (a) Skip pre-assignment if therapist isn't eligible → occurrence created unassigned.
- (b) Force-assign anyway → admin will see a conflict on the booking detail.

**Locked decision (open Q resolved):** (a) — skip pre-assignment. The booking is created with `assigned_staff_id=null + assignment_status='unassigned'`. The admin sees an unassigned booking in the queue. Acceptable degraded behaviour.

### 5.7 Service price changes between occurrences

Each occurrence's `total_price` is computed at insertion time (cron pulls fresh from `services.price`). So if admin raises the price by £10 in week 5, occurrences 6-12 reflect the new price; occurrences 1-5 keep their original. Acceptable — matches the typical SaaS billing semantics ("price changes at next renewal").

If admin wants to retroactively adjust all future occurrences after a price change, that's a manual operation via individual booking edits. Out of scope.

### 5.8 Editing the template after creation

The series view's "Edit series" allows editing only:
- `notes` (free text)
- `service_address_line1` / `postcode` / `city` / `area` (if client moved house mid-series)
- `bound_therapist_id` / `open_to_any_therapist` toggle

The following are NOT editable post-creation (would corrupt the date generation logic):
- `service_id` (would change duration + price)
- `cadence`
- `anchor_day_of_week` / `anchor_day_of_month` / `anchor_start_time`
- `end_type` / `end_count` / `end_date` (handled by cancelling the series + creating a new one with new end conditions if needed)

Out-of-band edits would require cancelling the series + creating a new one. Documented in series-view UI: "To change the cadence or end conditions, cancel the series and create a new one."

### 5.9 Concurrency: two admins create the same recurring series at the same time

Each `createRecurringSeries` call gets its own template UUID and writes 12 separate booking rows. Race window is small. Worst case: two parallel series for the same client, same service, same time slot exist briefly. The standard double-booking check in `create_booking_request` would normally prevent this — but the recurring RPC bypasses that (writes directly to bookings).

Mitigation: the recurring RPC includes a uniqueness check `WHERE EXISTS (booking on same date/time/client)` before each insert. Skips conflicting occurrences (creates the rest). Plan §1 Step 5 documents.

### 5.10 Manual cancel of a single occurrence

Existing `quickUpdateBooking` action=`cancel` flow. The cancelled booking keeps `recurring_template_id` set; status flips to `cancelled`. Cron extending the horizon doesn't recreate cancelled occurrences (only creates new dates). Series view's "Upcoming visits" hides cancelled ones; "Past visits" shows them with cancelled badge.

### 5.11 Manual reschedule of a single occurrence

Existing reschedule flow (currently customer-side via manage URL; admin-side via Status form). The rescheduled occurrence keeps `recurring_template_id` but its `booking_date` / `start_time` may now diverge from the series cadence. Acceptable — the user's intent is "move this one visit". Series view shows the rescheduled occurrence with a "Rescheduled" badge.

### 5.12 Restored cancelled occurrence (C-04a interaction)

C-04a's Restore button applies to recurring occurrences too. Restoring a cancelled recurring occurrence resurrects it; series view's upcoming list re-includes it.

### 5.13 Client soft-deleted (C-06 interaction)

If the client linked to a recurring template is soft-deleted via C-06's `deleteClient`, the `ON DELETE RESTRICT` on `recurring_booking_templates.client_id` blocks the deletion. C-06's `deleteClient` server action must first cancel any active recurring series for the client. Plan §1 + §8 Sequencing documents this cross-plan check.

> **Refinement 2026-07-26 (D1):** C-06 Step 9 now carries this — verify via `grep -i recurring redesign/plans/C-phase/C-06-client-crud-hardening-plan.md` before C-02 executes.

---

## 6 — Migration footprint

> ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔ *(Refinement 2026-07-26, rubric §3)*
> An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
> Action: apply the C-02 migration (services.allow_recurrence + recurring_booking_templates table + bookings.recurring_template_id FK + compute_occurrence_dates + create_recurring_booking_series RPCs) via `mcp__supabase__apply_migration`.
> Exact SQL: per the migration body below, verbatim (full DDL lifted into the companion plan's Phase A Step 1).
> Post-action verification: greenfield-check queries (§0 pre-flight equivalent in the companion plan) now return the new table/columns/functions.
> Never auto-apply. Approval is per-action and does not carry forward.

**Zone-2 — explicit user confirmation required for the migration.** Single migration covers:

```sql
BEGIN;

-- 1. Per-service flag
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS allow_recurrence boolean NOT NULL DEFAULT true;

-- 2. recurring_booking_templates table (full DDL per §2.1)
CREATE TABLE public.recurring_booking_templates ( ... );

-- 3. RLS + policies
ALTER TABLE public.recurring_booking_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY ... ;

-- 4. bookings.recurring_template_id column
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS recurring_template_id uuid NULL
    REFERENCES public.recurring_booking_templates(id) ON DELETE SET NULL;
CREATE INDEX idx_bookings_recurring_template ON public.bookings (recurring_template_id) WHERE recurring_template_id IS NOT NULL;

-- 5. RPCs (full definitions per §2.4)
CREATE OR REPLACE FUNCTION public.compute_occurrence_dates(...) ...;
CREATE OR REPLACE FUNCTION public.create_recurring_booking_series(...) ...;

-- 6. (No backfill — no existing rows)

COMMIT;
```

Post-migration: `mcp__supabase__generate_typescript_types`.

**No new permissions, no audit_log enum extension** (audit `action_type` is unconstrained text per the C-06 pre-flight finding).

---

## 7 — Files touched (preview — full list in plan)

### NEW (~12 files)
- `supabase/migrations/<ts>_c02_recurring_bookings.sql`
- `src/app/admin/bookings/recurring-actions.ts` — `createRecurringSeries` + `cancelRecurringSeries`
- `src/app/admin/bookings/series/[templateId]/page.tsx` — series view server component
- `src/app/admin/bookings/series/[templateId]/SeriesActions.tsx` — Edit + Cancel buttons (client component)
- `src/app/admin/bookings/new/RecurringSection.tsx` — inline form section
- `src/app/api/cron/extend-recurring-horizons/route.ts` — cron handler
- `src/app/admin/bookings/types.ts` — extend with `RecurringTemplateRecord`
- `src/lib/email/__tests__/sendRecurringSeriesCreatedEmail.test.ts`
- `src/app/admin/bookings/__tests__/createRecurringSeries.test.ts`
- `src/app/admin/bookings/__tests__/cancelRecurringSeries.test.ts`
- `src/app/api/cron/__tests__/extend-recurring-horizons.test.ts`

### EDITED (~12 files)
| File | Change |
|---|---|
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | Mount RecurringSection in step 4; dispatch to createRecurringSeries when checked |
| `src/app/admin/bookings/new/page.tsx` | Pass `allow_recurrence` flag through to form via service data fetch |
| `src/app/admin/bookings/actions.ts` | Re-export new recurring-actions (or co-located in same file) |
| `src/app/admin/bookings/page.tsx` | New "Series" filter chip + recurring icon on rows |
| `src/app/admin/calendar/page.tsx` | Recurring badge on booking pills |
| `src/app/admin/bookings/[bookingId]/page.tsx` | Show "Part of series: ↗ View series" link when recurring_template_id is set |
| `src/lib/email/templates.ts` | + `renderRecurringSeriesCreatedEmail` + plain-text variant |
| `src/lib/email/notifications.ts` | + `sendRecurringSeriesCreatedEmail` |
| `src/app/admin/email-templates/actions.ts` | + `recurring_series_created_client` in SUBJECTS |
| `src/app/admin/emails/components/templates-data.ts` | + new TemplateMeta entry |
| `wrangler.jsonc` | + `"0 3 * * *"` cron trigger |
| `worker-entrypoint.ts` | + dispatch for the new cron event |
| `src/app/admin/services/...` | Add `allow_recurrence` toggle on service edit (or simple checkbox; minor UX touch) |
| `src/app/admin/clients/[clientId]/page.tsx` | + `recurring_series_*` entries in AUDIT_PHRASING |

### UNCHANGED (do NOT touch)
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix, middleware.
- `create_booking_request` RPC — unchanged (recurring uses its own RPC).
- C-04a / C-05 / C-06 / C-01 / C-08 / C-11 / C-FIELDWORK code — orthogonal.

---

## 8 — Sequencing and dependencies

**No hard blockers**, but cross-plan synergies:

- **C-04a's Restore button** applies to recurring occurrences too — natural cross-plan synergy, no extra work in C-02.
- **C-05's `ensureBookingActive` helper** is called by the standard claim / assignment paths — recurring occurrences go through the same paths, automatically benefit.
- **C-06's `deleteClient`** must check for active recurring templates before allowing client soft-delete. Cross-plan check documented in C-02 §5.13. **C-06's plan should be updated to check this** — see plan §8 cross-plan update. *(Refinement 2026-07-26, D1: done — C-06 Step 9 now carries this.)*
- **C-08's email patterns** — C-02's `recurring_series_created_client` template follows the same template-overrides + templates-data.ts registration pattern. C-08 doesn't need to ship it; C-02 owns the template.
- **C-01's cron infrastructure** — same Cloudflare Worker cron used. Plan §1 Step 8 documents.
- **C-11's PractitionerTodaySection** — assigned recurring occurrences appear in the practitioner's today list automatically. Bound-therapist binding pre-populates the assignment.

**Sequencing within C-02:** plan phases (Migration → RPC → Backend actions → Form integration → Series view → Cron handler → Email template → Calendar/bookings list integration → Verification). Each phase commits independently.

---

## 9 — Open questions

**Q9.1 — Should the public booking form ever expose recurrence?**

Locked: **no** (per decisions doc Q3.2). Public booking remains single-occurrence. Future expansion is C-12+ if a clinic wants to A/B test public recurrence (e.g., a 6-month massage subscription).

**Q9.2 — Cron cadence — daily 03:00 UTC OR weekly?**

Locked at **daily 03:00 UTC**. Trade-off: daily catches per-template horizon-extension needs promptly (no client sees a 13-week gap before the system catches up); weekly would batch better but introduces latency. Cloudflare cron is essentially free at daily cadence.

**Q9.3 — Single occurrence cancel: send the standard cancellation email OR a series-aware variant?**

Locked: **standard cancellation email** (existing `sendBookingCancellationEmails`). The client gets the same "your booking is cancelled" email as a one-off cancellation. The booking still has `recurring_template_id` set, so admin can see it was part of a series, but the client-facing email doesn't need to mention the series — they care about that specific visit.

**Q9.4 — Should the bound-therapist binding be re-checked at cron-extension time OR only at series creation?**

Locked: **re-checked at cron-extension time**. If the bound therapist becomes inactive between creation + extension, the new occurrences materialise as unassigned (per §5.5). Admin sees them in the unassigned queue.

**Q9.5 — Edit-series UX scope**

Locked per §5.8: only `notes`, `service_address_*`, `bound_therapist_id` / `open_to_any_therapist` toggle are editable. Cadence + end-conditions changes require cancel + recreate. Documented in UI.

**Q9.6 — What happens to bookings beyond the horizon when a series is cancelled?**

Bookings beyond `horizon_through_date` don't exist yet (cron hasn't created them). Cancelling the series sets `cancelled_at` on the template; cron's "active templates" filter excludes cancelled templates; no new occurrences created. Existing occurrences in `(today, horizon_through_date]` are cancelled by the cascade. Bookings before today (past occurrences) are preserved.

**Q9.7 — Resource cap on series**

How many active series can one client have simultaneously? Decisions doc didn't address. Locked: **no enforced cap in C-02** — admin discretion. If a client wants 3 different services on 3 different cadences, the system supports it. Documented; revisit if abuse is observed.

**Q9.8 — Public-facing implication for the customer manage page**

Existing `/booking/manage/[token]` lets the customer cancel their own booking. For a recurring occurrence, does cancel apply to the single occurrence (per Q3.5 default) or surface a series-aware option?

Locked: **per-occurrence default**. The customer manage page cancels the single visit. To cancel the whole series, the customer must contact the clinic. Acceptable — the public path stays simple; series management is admin-only.

**Q9.9 — Compute horizon at series creation time vs at-of-template lifetime**

`horizon_through_date` is per-template. Series with `end_type='after_count'` has a finite horizon. Series with `end_type='until_cancelled'` always wants ~12 weeks ahead. The cron query `WHERE cancelled_at IS NULL AND horizon_through_date < today + 12 weeks` covers both — `until_cancelled` templates always match; `after_count` templates eventually settle when count is reached.

---

## 10 — Acceptance criteria (what "done" looks like)

A C-02 implementation is complete when:

1. **Migration applied cleanly** — table + FK + RPC + helper functions + service flag all exist.
2. **Recurring form section visible** in `/admin/bookings/new` step 4 for services with `allow_recurrence=true`.
3. **Creating a weekly series** generates 12 bookings tagged with `recurring_template_id`. Template row created with cadence='weekly', end_type='until_cancelled' (default).
4. **Email fires** on series creation. Client receives `recurring_series_created` email.
5. **Series view page** at `/admin/bookings/series/[templateId]` renders upcoming + past occurrences + actions.
6. **Cancel series** marks template `cancelled_at`, cascades to all future-dated occurrences (status='cancelled'). Past + completed preserved.
7. **Cron extends horizon** daily — verified via Cloudflare dashboard log after first 24h of deployment.
8. **Calendar badge** visible on recurring occurrences.
9. **Bookings list filter** "Series" works — shows only recurring-tagged bookings.
10. **Per-occurrence cancel** (existing flow) works — the cancelled occurrence stays linked to the template; series continues.
11. **Edit series** allows the limited editable fields per §5.8 only.
12. **Service flag toggle** at `/admin/services` flips `allow_recurrence`; form section reflects.
13. **Capability-keyed gating** — Owner/Admin/Coord can create + cancel; Therapist cannot reach the series-create form or cancel button.
14. **All static gates pass** — lint, tsc, vitest, build, bundle delta within budget.
15. **Playwright role × cadence × end-condition matrix** passes:
    - 3 cadences × 3 end-conditions = 9 series-creation paths verified
    - Per-occurrence cancel, series cancel, restore, reschedule each tested
16. **Cross-plan check** — C-06's `deleteClient` rejects when client has active recurring templates (or auto-cancels them — see plan §8 cross-plan update). *(Refinement 2026-07-26, D1: C-06 Step 9 now carries the auto-cancel cascade — verify present before C-02 executes.)*
17. **Badar's `9d55ce2a`** untouched throughout E2E.

---

## 11 — References

| Source | What it gives |
|---|---|
| `C-B-DECISIONS.md` §2 Q3 + §3 C-02 | All 7 sub-question answers + scope lock |
| `W07-availability-recurring-flow.md` §10 | Complete C-02 architecture (lift verbatim) |
| `W07-availability-recurring-flow.md` §1 | Greenfield confirmation |
| `W02-new-booking-end-to-end-flow.md` §2 | Existing `create_booking_request` RPC pattern (to mirror) |
| `bookings/actions.ts:726-960` | `createManualBooking` (the closest existing analogue for `createRecurringSeries`) |
| `bookings/new/ManualBookingForm.tsx` | Form step structure (where RecurringSection mounts) |
| `src/app/api/cron/booking-reminders/route.ts` | Cron route pattern (lift for `extend-recurring-horizons`) |
| `worker-entrypoint.ts` | scheduled() dispatch (extend for the new cron) |
| `wrangler.jsonc` | Cron trigger config |
| `BAND-C-MASTER-PLAN.md` Part 0 | Operating discipline |

---

## 12 — Out of scope (explicit non-goals)

- **Hijri / Sunnah cadence** — explicit drop per decisions doc Q3 + master plan §130.
- **Custom intervals (e.g., "every 28 days")** — locked to weekly / fortnightly / monthly only.
- **Same-weekday-position monthly (e.g., "first Tuesday")** — only fixed-day-of-month supported.
- **Shift-all-subsequent reschedule** — per-occurrence only.
- **Series-wide cancellation cascade as default** — per-occurrence default; explicit "Cancel series" button covers the rest.
- **Public-facing recurring booking** — admin-only feature.
- **Therapist-side self-service availability for recurring slots** — out of scope.
- **Recurring with multiple participants (group)** — locked at single-client/single-participant recurring. Group recurring is C-12+ if requested.
- **Subscription / billing tie-in** — recurring is scheduling-only. Each occurrence is billed separately per existing flow.
- **Auto-rescheduling on therapist sick-day** — manual admin handling per occurrence.
- **Series-level reminders** — each occurrence gets the standard `booking_reminder` email per existing pattern. No series-wide "you have 12 weeks coming up" reminder.
- **Series export / iCal subscription** — out of scope.
- **Per-occurrence customisation** (e.g., "occurrence 5 uses a different service") — out of scope.
- **Resource cap per client** — Q9.7, no cap enforced.
- **`allow_recurrence` toggle on services UI redesign** — minimal additive checkbox; not a service-page rework.

---

*End of C-02 brief. Plan file follows: `redesign/plans/C-phase/C-02-recurring-bookings-plan.md`.*
