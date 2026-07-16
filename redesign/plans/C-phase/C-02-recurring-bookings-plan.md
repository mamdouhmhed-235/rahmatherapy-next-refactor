# C-02 — Recurring / standing bookings — **PLAN**

**Type:** Band C plan-writing output (C-B phase)
**Date written:** 2026-05-26
**Brief:** `redesign/briefs/C-02-recurring-bookings-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-02-recurring-bookings-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. **Branch + clean tree.** `git status --short` empty. HEAD on `redesign/start-state`.
2. **Dev server.** `curl -I http://localhost:3000/admin/login/` → 200.
3. **Baseline tests + static gates.** `pnpm vitest run` 485/491 (6 baseline failures preserved); `pnpm lint` + `npx tsc --noEmit` both green.
4. **DB verification:**

   ```sql
   -- (a) Confirm greenfield — recurring tables don't exist
   SELECT table_name FROM information_schema.tables
   WHERE table_schema='public' AND table_name IN ('recurring_booking_templates', 'recurring_series', 'booking_series');
   -- Expected: 0 rows

   -- (b) services schema verification + allow_recurrence absence
   SELECT column_name, data_type FROM information_schema.columns
   WHERE table_name='services' AND column_name = 'allow_recurrence';
   -- Expected: 0 rows

   -- (c) bookings.recurring_template_id absence
   SELECT column_name FROM information_schema.columns
   WHERE table_name='bookings' AND column_name='recurring_template_id';
   -- Expected: 0 rows

   -- (d) Capture services list for per-service allow_recurrence audit at impl time
   SELECT slug, name, is_active FROM services ORDER BY name;
   ```

5. **C-01 + C-08 dependencies confirmed:**
   - C-01 must be merged (provides the Cloudflare Worker cron extension pattern + scheduled() dispatch + FOUC-free cron infrastructure).
   - C-08 should be merged (provides the template-overrides + send-fn pattern for the new `recurring_series_created_client` template).
   - Pre-flight verifies via `git log --oneline | grep -E "C-01|C-08"`. If either is absent, **stop** and surface to user — C-02 can technically ship without them, but the patterns those plans introduced are the lift targets.

6. **C-06 cross-plan coordination:**
   - If C-06 is merged (clients.deleted_at + deleteClient), the recurring-template table's `ON DELETE RESTRICT` on `client_id` will block client deletion when active templates exist. C-06's `deleteClient` server action must be extended to either:
     - (a) Refuse delete with structured error if active recurring templates exist, OR
     - (b) Cancel all active templates as part of the deletion cascade.
   - **Locked: option (b)** — `deleteClient` should cancel active templates as part of its cascade. This is a C-06 plan update; plan §8 documents.

7. **Test fixture inventory:**
   - At least one test client with valid email + future-date booking slot availability.
   - At least one test booking with cancelled status to verify the no-recreate behaviour on horizon extension.
   - Test Owner/Admin/Coord accounts active.

8. **DO-NOT-TOUCH list:** Badar's `9d55ce2a`, any real customer.

9. **Capture pre-deploy metrics:**

   ```sql
   -- Booking count baseline
   SELECT COUNT(*) FROM bookings;

   -- Cron extension activity baseline (no rows yet — capture for first post-deploy delta)
   ```

If pre-flight fails (especially C-01 missing OR C-06 cross-plan not coordinated), surface to user.

---

## 1 — Safe implementation order (8 phases — large plan)

### Phase A — Migration (Zone-2)

**Step 1 — Author the migration file.**

`supabase/migrations/<YYYYMMDDHHMMSS>_c02_recurring_bookings.sql`:

```sql
-- C-02 recurring bookings — single migration.
-- New table + FK + service flag + 2 RPCs.

BEGIN;

-- 1. Per-service flag
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS allow_recurrence boolean NOT NULL DEFAULT true;

-- 2. recurring_booking_templates table
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
  -- Cross-check constraints
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

CREATE INDEX idx_recurring_templates_active ON public.recurring_booking_templates (cancelled_at) WHERE cancelled_at IS NULL;
CREATE INDEX idx_recurring_templates_horizon ON public.recurring_booking_templates (horizon_through_date) WHERE cancelled_at IS NULL;
CREATE INDEX idx_recurring_templates_client ON public.recurring_booking_templates (client_id);

-- 3. RLS — service_role only writes; authenticated reads via existing booking RBAC patterns
ALTER TABLE public.recurring_booking_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY rbt_service_role_all ON public.recurring_booking_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY rbt_authenticated_read ON public.recurring_booking_templates
  FOR SELECT TO authenticated USING (true);
-- Authenticated UPDATE/INSERT/DELETE forbidden — server actions go through service_role.

-- 4. bookings.recurring_template_id FK
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS recurring_template_id uuid NULL
    REFERENCES public.recurring_booking_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_recurring_template
  ON public.bookings (recurring_template_id) WHERE recurring_template_id IS NOT NULL;

-- 5. Helper function: compute_occurrence_dates
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

-- 6. RPC: create_recurring_booking_series
-- (Full DDL per brief §2.4 — long; lift verbatim during impl)

COMMIT;
```

**Step 2 — Apply migration via `mcp__supabase__apply_migration`.**

Zone-2 — explicit user confirmation. Show SQL first; capture `migration_name`.

**Step 3 — Regenerate types + verify.**

```bash
mcp__supabase__generate_typescript_types
npx tsc --noEmit  # green
```

Spot-check verification queries per pre-flight §4 — now all return expected results.

**Phase A verify checkpoint:** migration applied; tests pass; types regenerated.

### Phase B — RPC implementation + tests

**Step 4 — `compute_occurrence_dates` unit test (via SQL).**

Vitest doesn't directly test PL/pgSQL; use vitest-against-DB approach OR write a node-pg test. Quick scaffold: call the function via `mcp__supabase__execute_sql` from a vitest spec, assert returned array.

Cases:
- Weekly, first=2026-05-29, horizon=2026-08-29, until_cancelled → ~14 dates returned.
- Fortnightly, first=2026-05-29, end_type=after_count, end_count=6 → 6 dates returned.
- Monthly, first=2026-05-29 (day-29 — > 28!), end_type=until_date, end_date=2026-09-29 → **migration's CHECK rejects this at template-create time, not compute step**. Actually compute returns dates assuming day 29; the create RPC rejects. Verify the gating.

Better: shift the day-of-month constraint check to the RPC validation (compute helper is pure date math). Plan locks: RPC validates `anchor_day_of_month <= 28` before calling compute; compute is pure.

**Step 5 — `create_recurring_booking_series` integration test.**

Use a vitest fixture that calls the RPC via supabase client + asserts:
- Template row created with correct fields.
- 12 (or N) bookings created with `recurring_template_id` set + `booking_source='recurring'`.
- Each booking has the correct `booking_date` (per cadence) + `start_time` + `end_time` + `total_duration_mins`.
- Each booking has 1 `booking_participants` row + N `booking_items` (1 per service slug) + N `booking_assignments` (status='unassigned' OR pre-assigned to bound therapist if specified + eligible).
- Audit log row `recurring_series_created` written.

### Phase C — Server actions

**Step 6 — `createRecurringSeries` server action.**

New file `src/app/admin/bookings/recurring-actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod/v4";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canManageAllBookings, getStaffProfile } from "@/lib/auth/rbac";
import { sendRecurringSeriesCreatedEmail } from "@/lib/email/notifications";

const recurringSchema = z.object({
  client_id: z.string().uuid(),
  service_slug: z.string().trim().min(1),
  first_occurrence_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  anchor_start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  cadence: z.enum(["weekly", "fortnightly", "monthly"]),
  end_type: z.enum(["until_cancelled", "after_count", "until_date"]),
  end_count: z.coerce.number().int().min(1).max(520).optional(),  // hard cap 10 years weekly
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bound_therapist_id: z.string().uuid().optional(),
  open_to_any_therapist: z.boolean(),
  service_address_line1: z.string().trim().optional(),
  service_postcode: z.string().trim().optional(),
  service_city: z.string().trim().optional(),
  service_area: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export interface RecurringActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  templateId?: string;
  occurrenceCount?: number;
}

export async function createRecurringSeries(
  _previousState: RecurringActionState,
  formData: FormData
): Promise<RecurringActionState> {
  // RBAC
  const supabase = await createSupabaseServerClient();
  const actor = await getStaffProfile(supabase);
  if (!actor || !actor.active || !canManageAllBookings(actor)) {
    return { error: "Insufficient permissions." };
  }

  // Parse + validate
  const parsed = recurringSchema.safeParse({
    client_id: formData.get("client_id"),
    service_slug: formData.get("service_slug"),
    first_occurrence_date: formData.get("first_occurrence_date"),
    anchor_start_time: formData.get("anchor_start_time"),
    cadence: formData.get("cadence"),
    end_type: formData.get("end_type"),
    end_count: formData.get("end_count") || undefined,
    end_date: formData.get("end_date") || undefined,
    bound_therapist_id: formData.get("bound_therapist_id") || undefined,
    open_to_any_therapist: formData.get("open_to_any_therapist") === "on",
    service_address_line1: formData.get("service_address_line1") || undefined,
    service_postcode: formData.get("service_postcode") || undefined,
    service_city: formData.get("service_city") || undefined,
    service_area: formData.get("service_area") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return {
      error: "Check the recurring booking details.",
      fieldErrors: Object.fromEntries(
        Object.entries(z.flattenError(parsed.error).fieldErrors).map(
          ([key, val]) => [key, val?.[0] ?? "Invalid value."]
        )
      ),
    };
  }

  // Service-level allow_recurrence check
  const adminClient = createSupabaseAdminClient();
  const { data: service } = await adminClient
    .from("services")
    .select("id, allow_recurrence, name")
    .eq("slug", parsed.data.service_slug)
    .single();

  if (!service?.allow_recurrence) {
    return { error: `Recurring not available for ${service?.name ?? "this service"}.` };
  }

  // Monthly cadence + first-date day-of-month check
  if (parsed.data.cadence === "monthly") {
    const dayOfMonth = parseInt(parsed.data.first_occurrence_date.slice(8, 10), 10);
    if (dayOfMonth > 28) {
      return {
        error: "Monthly recurrence requires a day between 1 and 28.",
        fieldErrors: { first_occurrence_date: "Monthly recurrence requires a day between 1 and 28 to avoid month-end ambiguity." },
      };
    }
  }

  // RPC call
  const { data: rpcResult, error: rpcError } = await adminClient.rpc("create_recurring_booking_series", {
    p_client_id: parsed.data.client_id,
    p_service_slug: parsed.data.service_slug,
    p_bound_therapist_id: parsed.data.bound_therapist_id ?? null,
    p_open_to_any_therapist: parsed.data.open_to_any_therapist,
    p_first_occurrence_date: parsed.data.first_occurrence_date,
    p_anchor_start_time: parsed.data.anchor_start_time,
    p_cadence: parsed.data.cadence,
    p_end_type: parsed.data.end_type,
    p_end_count: parsed.data.end_count ?? null,
    p_end_date: parsed.data.end_date ?? null,
    p_service_address_line1: parsed.data.service_address_line1 ?? null,
    p_service_postcode: parsed.data.service_postcode ?? null,
    p_service_city: parsed.data.service_city ?? null,
    p_service_area: parsed.data.service_area ?? null,
    p_notes: parsed.data.notes ?? null,
    p_actor_staff_id: actor.id,
    p_horizon_weeks: 12,
  });

  if (rpcError) return { error: rpcError.message };

  const result = rpcResult as { templateId: string; occurrenceCount: number };

  // Email — fires once for the series
  await sendRecurringSeriesCreatedEmail(result.templateId, adminClient).catch((error) => {
    console.error("Unable to send recurring_series_created email.", error);
  });

  // Cache invalidation
  updateTag("report-data");
  updateTag("dashboard-data");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");
  revalidatePath(`/admin/clients/${parsed.data.client_id}`);

  // Redirect to series view
  redirect(`/admin/bookings/series/${result.templateId}?created=1`);
}
```

**Step 7 — `cancelRecurringSeries` server action.**

In same file:

```ts
export async function cancelRecurringSeries(
  _previousState: { ok: boolean; cancelledOccurrenceCount?: number; error?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; cancelledOccurrenceCount?: number; error?: string }> {
  // RBAC
  const supabase = await createSupabaseServerClient();
  const actor = await getStaffProfile(supabase);
  if (!actor || !canManageAllBookings(actor)) {
    return { ok: false, error: "Insufficient permissions." };
  }

  const templateId = String(formData.get("template_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!templateId) return { ok: false, error: "Template ID is required." };

  const adminClient = createSupabaseAdminClient();

  // 1. Mark template cancelled
  const { data: template, error: tmplErr } = await adminClient
    .from("recurring_booking_templates")
    .update({
      cancelled_at: new Date().toISOString(),
      cancelled_by: actor.id,
      cancelled_reason: reason || null,
    })
    .eq("id", templateId)
    .is("cancelled_at", null)
    .select("id, client_id")
    .maybeSingle();

  if (tmplErr || !template) return { ok: false, error: tmplErr?.message ?? "Template not found or already cancelled." };

  // 2. Cascade-cancel future occurrences (today onwards)
  // S7 coordination (2026-07-16, C-04a amendment): stamp cancelled_at so the
  // cascaded visits honour the 28-day restore window like any other cancellation.
  const today = getLondonTodayISO();
  const { data: cancelledRows, error: cancelErr } = await adminClient
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("recurring_template_id", templateId)
    .in("status", ["pending", "confirmed"])
    .gte("booking_date", today)
    .select("id");

  if (cancelErr) return { ok: false, error: cancelErr.message };

  // 3. Audit log
  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "recurring_series_cancelled",
    target_type: "recurring_booking_templates",
    target_id: templateId,
    after_state: {
      cancelled_at: template.id,
      reason: reason || null,
      cascaded_occurrence_count: cancelledRows?.length ?? 0,
    },
  });

  // 4. Cache
  updateTag("report-data");
  updateTag("dashboard-data");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/series/${templateId}`);
  revalidatePath("/admin/calendar");
  revalidatePath(`/admin/clients/${template.client_id}`);

  return { ok: true, cancelledOccurrenceCount: cancelledRows?.length ?? 0 };
}

function getLondonTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}
```

**Step 8 — Vitest specs for server actions.**

Tests in `src/app/admin/bookings/__tests__/createRecurringSeries.test.ts` + `cancelRecurringSeries.test.ts`:
- RBAC — Coord with manage_bookings_all succeeds; Therapist rejected.
- Validation — invalid cadence rejected.
- Monthly + day > 28 rejected.
- Service flag off rejected.
- Happy path creates template + 12 bookings + audit row + email send.
- Cancel marks template cancelled_at + cascades to future bookings + audit row.

### Phase D — Email template

**Step 9 — Render fn in `templates.ts`.**

Per C-08 pattern. Default copy:
- Subject: "Your recurring booking is set"
- Body: "Hi {clientName}, we've set up your {cadence} {serviceName} starting {firstDate} at {startTime}. The next {occurrenceCount} visits are confirmed. We'll send reminders for each one."

**Step 10 — Send fn in `notifications.ts`.**

`sendRecurringSeriesCreatedEmail(templateId, supabase)`. Fetches template + linked client + service + first occurrence date. Same `sendTrackedEmail` pattern.

**Step 11 — Registration.**

- SUBJECTS map entry. *(2026-07-16: if C-15 has shipped, SUBJECTS is retired — set `subjectDefault` in the registry instead.)*
- templates-data.ts TemplateMeta entry with audience='customer' + fields list. *(2026-07-16: C-15 ships before C-02 in the recommended order — register in the expanded registry shape: `defaultValue` per field, `subjectDefault`, `tokens`, `fixedParts`. The template then appears in the studio gallery/editor automatically.)*

**Step 12 — Vitest spec** following C-08's `sendBookingConfirmedClientEmail` test scaffold.

### Phase E — Form integration

**Step 13 — `RecurringSection.tsx` component.**

New file `src/app/admin/bookings/new/RecurringSection.tsx`:

```tsx
"use client";

interface RecurringSectionProps {
  selectedServiceSlug: string;
  allowRecurrenceMap: Record<string, boolean>;  // slug → allow_recurrence
  selectedTherapistId: string | null;
  selectedTherapistName: string | null;
  firstOccurrenceDate: string;  // YYYY-MM-DD from step 4
  startTime: string;            // HH:MM from step 4
}

export function RecurringSection(props: RecurringSectionProps) {
  // Renders the inline section per brief §4.1.
  // Hidden inputs for createRecurringSeries action when checked.
  // Conditional fields based on end_type radio choice.
  // ServiceAllowsRecurrence check inline.
}
```

**Step 14 — Wire into `ManualBookingForm.tsx`.**

Edit `src/app/admin/bookings/new/ManualBookingForm.tsx`. In step 4 (Date & time section, near the submit button), mount `<RecurringSection ... />`. When the user submits the form with `is_recurring=on`, the form action dispatches to `createRecurringSeries` instead of `createManualBooking`.

The form's action prop becomes conditional:

```tsx
const formAction = isRecurringMode ? createRecurringSeries : createManualBooking;
const [state, action, pending] = useActionState(formAction, initialState);
```

This requires React's `useActionState` to be re-bound when the toggle flips. Use a key on the form to force remount, OR conditionally render two different forms. Plan locks: **conditionally render** — simpler than key-based remount.

**Step 15 — Pre-fetch `allow_recurrence` in page.tsx.**

Edit `src/app/admin/bookings/new/page.tsx` to fetch `services.slug, name, price, duration_mins, allow_recurrence`. Pass the map to ManualBookingForm.

### Phase F — Series view route

**Step 16 — `/admin/bookings/series/[templateId]/page.tsx` server component.**

Layout per brief §4.2. Fetches:
- Template row.
- Linked client (RBAC-narrowed per `getClientDataAccess`).
- Bookings with this `recurring_template_id` — **bounded (C-16 coordination, 2026-07-16):** an `until_cancelled` series accrues ~52 visits/year (~260 after 5 years), so DO NOT fetch/render all. Fetch the next **10 upcoming** (`date >= today`, ascending, `.limit(10)`) + the last **5 past** (`date < today`, descending, `.limit(5)`) + a total count, and render a "View all {N} visits" link into `/admin/bookings` filtered by the series chip (Phase H Step 23's filter). If C-16's shared `PaginationBar` has shipped, the upcoming section may use it instead — implementer's call; the caps are the floor.
- Linked bound_therapist staff_profile (if set).

Renders the series view.

**Step 17 — `SeriesActions.tsx` client component.**

The Edit + Cancel buttons. Cancel opens `ConfirmActionModal` (lift from C-04a's Restore pattern) with the §4.3 brief copy. Reason textarea optional.

**Step 18 — Cross-link from booking detail page.**

Edit `src/app/admin/bookings/[bookingId]/page.tsx`. If booking has `recurring_template_id IS NOT NULL`, render a small "Part of recurring series: ↗ View series" link in the next-action area.

### Phase G — Cron extension

**Step 19 — Cron route handler.**

New file `src/app/api/cron/extend-recurring-horizons/route.ts`. Mirrors `booking-reminders` pattern:

```ts
export async function POST(request: Request): Promise<Response> {
  // CRON_SECRET check
  // For each active template where horizon_through_date < today + 12 weeks:
  //   compute new horizon (today + 12 weeks)
  //   call compute_occurrence_dates(current_horizon, cadence, new_horizon, end_type, end_count, end_date)
  //   For each new occurrence date:
  //     check no existing booking already at (client, date, start_time)
  //     insert booking with recurring_template_id set
  //     insert booking_participants + booking_items + booking_assignments
  //     pre-assign to bound_therapist_id if eligible
  //   UPDATE template SET horizon_through_date = new_horizon
  //   insert audit_log row 'recurring_series_extended'
  // Return summary { templatesExtended, occurrencesCreated, skipped }
}
```

Per-template advisory lock prevents concurrent extensions of the same template.

**Step 20 — `wrangler.jsonc` + `worker-entrypoint.ts` extensions.**

Add cron trigger `"0 3 * * *"` (daily 03:00 UTC). Add `fireExtendRecurringHorizons(env)` dispatch in scheduled() based on `event.cron`.

**Step 21 — Vitest spec for the cron handler.**

Mock supabase + iterate test cases:
- Active template due for extension → extends + creates bookings.
- Active template not due (horizon already 12+ weeks ahead) → skipped.
- Cancelled template → ignored.
- `end_type='after_count'` already met → no new bookings.
- `end_type='until_date'` past end_date → no new bookings.

### Phase H — Calendar + bookings list integration

**Step 22 — Calendar badge.**

Edit `src/app/admin/calendar/page.tsx`. When rendering a booking pill, if `recurring_template_id IS NOT NULL`, add the "↻" icon. Tooltip on hover shows cadence + series link.

**Step 23 — Bookings list filter.**

Edit `src/app/admin/bookings/page.tsx`. Add "Series" filter chip. Filter logic: `booking.recurring_template_id !== null`. Add row-level "↻" icon left of contact name.

**Step 24 — Service edit toggle.**

Edit the service edit form (likely `src/app/admin/services/...`). Add a checkbox "Allow recurring bookings for this service" wired to `services.allow_recurrence`. Server action update.

**Step 25 — AUDIT_PHRASING entries.**

In `clients/[clientId]/page.tsx:127-138`:

```ts
recurring_series_created: "Recurring series created",
recurring_series_cancelled: "Recurring series cancelled",
recurring_series_extended: "Recurring series schedule extended",
```

### Phase I — Verification (per §3)

Final phase. Playwright + DB verification + screenshots. Per §3.

---

## 2 — Files touched (final list)

### NEW (~13 files)
- `supabase/migrations/<ts>_c02_recurring_bookings.sql`
- `src/app/admin/bookings/recurring-actions.ts`
- `src/app/admin/bookings/series/[templateId]/page.tsx`
- `src/app/admin/bookings/series/[templateId]/SeriesActions.tsx`
- `src/app/admin/bookings/new/RecurringSection.tsx`
- `src/app/api/cron/extend-recurring-horizons/route.ts`
- `src/app/admin/bookings/__tests__/createRecurringSeries.test.ts`
- `src/app/admin/bookings/__tests__/cancelRecurringSeries.test.ts`
- `src/app/api/cron/__tests__/extend-recurring-horizons.test.ts`
- `src/lib/email/__tests__/sendRecurringSeriesCreatedEmail.test.ts`
- (and) integration test files for the RPC via SQL

### EDITED (~12 files)
| File | Change |
|---|---|
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | Mount RecurringSection; conditional action dispatch |
| `src/app/admin/bookings/new/page.tsx` | Fetch + pass `allow_recurrence` per service |
| `src/app/admin/bookings/actions.ts` | Re-export recurring actions (or co-locate) |
| `src/app/admin/bookings/page.tsx` | Series filter chip + row icon |
| `src/app/admin/calendar/page.tsx` | Recurring badge on pills |
| `src/app/admin/bookings/[bookingId]/page.tsx` | "Part of series" link |
| `src/app/admin/bookings/types.ts` | Extend with RecurringTemplateRecord type |
| `src/lib/email/templates.ts` | + render fn |
| `src/lib/email/notifications.ts` | + send fn |
| `src/app/admin/email-templates/actions.ts` | + SUBJECTS entry |
| `src/app/admin/emails/components/templates-data.ts` | + TemplateMeta entry |
| `wrangler.jsonc` | + cron trigger |
| `worker-entrypoint.ts` | + dispatch helper |
| `src/app/admin/services/...` | Service edit toggle for `allow_recurrence` |
| `src/app/admin/clients/[clientId]/page.tsx` | + AUDIT_PHRASING entries |

### UNCHANGED (do NOT touch)
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 primitives.
- `create_booking_request` RPC — unchanged (the new RPC is separate).
- C-04a/C-05/C-06/C-01/C-08/C-11/C-FIELDWORK code — orthogonal.

---

## 3 — Verification gate

### 3.1 Static gates

```bash
pnpm lint                       # 0 errors
npx tsc --noEmit                # 0 errors
pnpm vitest run                 # new specs pass; baseline preserved
pnpm build                      # clean
node scripts/measure-admin-bundles.mjs  # bundle delta within budget
```

**Bundle budget:** new RecurringSection + series view + SeriesActions = ~5 kB client. Cron handler is server-only. **Plan ceiling: +8 kB cumulative across `/admin/bookings/*` bundle. 0 net change on dashboard.**

### 3.2 Playwright role × cadence × end-condition matrix

Per role × cadence × end-condition (3 × 3 × 3 = 27 test paths, but reduce via critical-path sampling):

**Critical-path tests:**
1. Owner creates weekly until_cancelled series → 12 occurrences materialise + email sent + series view renders.
2. Admin creates fortnightly after_count=6 series → 6 occurrences + 0 future-cron-creates.
3. Coord creates monthly until_date series → N occurrences capped at end_date.
4. Therapist cannot reach the recurring form section (form path returns Access Denied or section hidden).

**Cancel paths:**
5. Owner cancels a series with 12 future occurrences → all 12 cancelled, template marked, audit row.
6. Owner cancels a single occurrence (existing cancel flow) → that one cancelled, series continues, horizon extension still creates future ones.

**Cron tests:**
7. Time-shift to simulate "tomorrow" → cron handler extends a series with horizon_through_date < today + 12 weeks → new occurrences created.
8. Cancelled template skipped by cron.
9. after_count complete → cron no-ops, template effectively quiescent.

**Edge case:**
10. Bound therapist becomes inactive → cron creates next occurrences as unassigned.
11. Monthly cadence + first-date day-29 → server-action validation rejects.

### 3.3 Pre/post DB queries

```sql
-- Pre-deploy
SELECT COUNT(*) FROM bookings WHERE recurring_template_id IS NOT NULL;
-- Expected: 0

-- Post-creation of 1 weekly series
SELECT COUNT(*) FROM bookings WHERE recurring_template_id IS NOT NULL;
-- Expected: 12

-- After cron run (next day)
SELECT COUNT(*) FROM bookings WHERE recurring_template_id IS NOT NULL;
-- Expected: ~13 (12 + new horizon week added)

-- After series cancellation
SELECT status, COUNT(*) FROM bookings
WHERE recurring_template_id = '<test-template-id>' GROUP BY status;
-- Expected: past = mixed; future ones = all 'cancelled'
```

### 3.4 Email verification

- Check `email_delivery_events` for `recurring_series_created_client` row after series creation.
- Verify Resend dashboard delivery (preview HTML rendering).
- Reminder cron should fire `booking_reminder` per occurrence (existing behaviour — not modified by C-02).

### 3.5 Screenshot evidence

- 1280 × Owner ManualBookingForm step 4 with RecurringSection expanded
- 375 × same on mobile
- 1280 × series view page with upcoming + past occurrences
- 375 × series view on mobile
- 1280 × cancel-series confirm modal
- 1280 × calendar with recurring badges
- 1280 × bookings list with Series filter active
- 1280 × `/admin/services` edit form with allow_recurrence toggle

Store in `redesign/audits/C-A/screenshots-03-bookings-new/c-02-after/`.

### 3.6 WCAG + responsive checks

- Series view at 4 viewports — usable layout
- Recurring badge contrast at light + dark themes (post-C-11 ship)
- Form section validation messages legible

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| RPC body too complex to ship in single migration | medium | medium | Split into multiple sub-migrations if it helps review. Migration template-table first, RPC second commit if needed. |
| Cron creates duplicate bookings if WHERE check fails | low | medium | Per-template advisory lock + uniqueness check (booking exists at client/date/time/service) before insert. |
| Bound therapist eligibility check at cron time inconsistent with create-time | medium | low | Pre-assign skipped if not eligible at cron time. Booking created unassigned. Acceptable degradation. |
| Series cancellation cascade misses some bookings | low | medium | Cascade query uses `recurring_template_id = $1 AND status IN ('pending','confirmed') AND booking_date >= today`. Conservative — doesn't touch past or already-cancelled. |
| Monthly cadence ambiguity (day-29/30/31 in February) | low | low | CHECK constraint `anchor_day_of_month <= 28`. Server-action validation rejects upfront. Documented in form helper. |
| `compute_occurrence_dates` infinite loop on bad input | very low | low | IMMUTABLE pure function; PG enforces termination via WHILE bound to v_effective_end. |
| Cron horizon extension floods bookings table | low | medium | 12-week ceiling per template; cron runs daily. Worst case: 1 new occurrence per active template per cron run. Acceptable. |
| Template-table RLS misconfigured | medium | medium | Plan §1 Step 1 migration includes explicit policy. Service-role-only writes; authenticated read. Verify with `mcp__supabase__get_advisors` post-deploy. |
| Edit-series UX confuses operators (limited editable fields) | low | low | Inline helper text in the form explains "Cancel + recreate to change cadence." |
| Restoring a cancelled series occurrence creates orphan | low | low | Restore (C-04a) un-cancels the booking. Template stays cancelled. Acceptable — admin can manually flip template status if they want to re-activate the series. |
| Public booking flow accidentally exposed | very low | low | New form section is gated by admin RBAC at the route level. Plus public site uses a separate form (`/booking/...`) that doesn't import RecurringSection. |
| C-06 deleteClient blocks deletion due to active template | medium | medium | **Cross-plan update to C-06's plan §1 Step 9:** before SET clients.deleted_at, query for active recurring_booking_templates where client_id=$1 AND cancelled_at IS NULL. If found, cancel them as part of the deletion cascade. C-06's plan needs to be updated post-C-02-merge. |

### 4.1 Real risk: cron-extension queue depth

If 100 active recurring templates each need extension on the same cron run, that's 100 sequential RPCs. At ~50ms per extension, that's 5 seconds. Cloudflare Worker timeout is generous; acceptable. If user scales to 1000 active templates, revisit (chunked execution or parallelisation). C-12+.

### 4.2 Real risk: cross-plan ordering with C-06

Decisions doc Q5 (C-06 scope) was written before C-02 plan-writing. C-06's `deleteClient` cascade scope doesn't mention recurring templates. **C-06's plan needs an explicit update** to include the template-cancellation step. This plan (§8 Sequencing) flags it; C-06 implementer reads the brief + plan and adds the step.

---

## 5 — Undo procedure

### 5.1 Code revert (per phase)

Each phase commits independently. Revert in reverse order.

### 5.2 Migration rollback

```sql
BEGIN;

-- 1. Drop RPCs (reverse order)
DROP FUNCTION IF EXISTS public.create_recurring_booking_series(...);
DROP FUNCTION IF EXISTS public.compute_occurrence_dates(date, text, date, text, int, date);

-- 2. Drop the FK + column on bookings
ALTER TABLE public.bookings DROP COLUMN IF EXISTS recurring_template_id;
DROP INDEX IF EXISTS idx_bookings_recurring_template;

-- 3. Drop the table
ALTER TABLE public.recurring_booking_templates DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS public.recurring_booking_templates CASCADE;

-- 4. Drop services flag (optional — could keep for future)
ALTER TABLE public.services DROP COLUMN IF EXISTS allow_recurrence;

COMMIT;
```

Cascades remove any FK references. Existing booking rows lose their `recurring_template_id` (column dropped — data gone).

### 5.3 Cron rollback

Remove the `*/15` cron from wrangler.jsonc (wait, that's C-01's — C-02 uses `0 3 * * *`). Remove `0 3 * * *` from triggers.crons. Revert worker-entrypoint.ts dispatch. Next Cloudflare deploy stops the cron firing.

---

## 6 — Test fixture guidance

**Safe for C-02 E2E:**
- Test clients with future-date addresses populated.
- Test bookings created as recurring instances — these stay in the test fixture set.
- Cancellable test series for the cancel-series flow.

**DO NOT:**
- Create recurring series for Badar's `9d55ce2a` client.
- Use real customer emails.
- Test cron extension against real-customer template (use only test templates).

**Cleanup post-test:**

```sql
-- Cancel test templates + cascade
UPDATE recurring_booking_templates SET cancelled_at = now()
WHERE created_by = '<test-actor-id>' AND cancelled_at IS NULL;

UPDATE bookings SET status = 'cancelled'
WHERE recurring_template_id IN (
  SELECT id FROM recurring_booking_templates WHERE created_by = '<test-actor-id>'
) AND status IN ('pending', 'confirmed');
```

---

## 7 — Commit cadence in C-C (recommendation)

| Commit | Phase coverage |
|---|---|
| 1 | Phase A — Migration applied + types regenerated |
| 2 | Phase B — RPC + helper function + DB integration tests |
| 3 | Phase C — createRecurringSeries + cancelRecurringSeries server actions + tests |
| 4 | Phase D — Email template + send fn + registration |
| 5 | Phase E — RecurringSection + ManualBookingForm integration |
| 6 | Phase F — Series view route + SeriesActions + booking-detail cross-link |
| 7 | Phase G — Cron handler + wrangler trigger + worker-entrypoint dispatch |
| 8 | Phase H — Calendar badge + bookings list filter + service toggle + AUDIT_PHRASING |
| 9 | Phase I — Verification (Playwright + WCAG + screenshots + progress + master plan ✅) |

`feat(redesign): C-02 {phase}` prefix during C-C.

---

## 8 — Hand-off to C-C

1. Read brief + plan end-to-end.
2. **Run §0 Pre-flight in full**, especially the C-01 + C-08 dependency check and the C-06 cross-plan coordination.
3. **Update C-06's plan** with the active-recurring-templates check in `deleteClient`. This is a parallel plan-text update before C-02 ships. See §4.2.
4. Execute Phase A → I in order.
5. Migration in Phase A is Zone-2 — show SQL to user; await approval; capture migration_name.
6. Verification gate (§3) non-negotiable.
7. Update progress file per phase.
8. Final commit updates master plan checklist C-02 row → ✅.

---

## 9 — Open questions remaining

1. **Cron timeout under high-active-template load** — §4.1. Acceptable to defer; revisit if scaling triggers it.
2. **`compute_occurrence_dates` test approach** — vitest-against-DB OR pure mock. Decide at impl time.
3. **RecurringSection conditional action dispatch** — Step 14 locks "conditional render" over "key remount". Reconsider if React behaviour surprises.
4. **Form-action submission UX** — when `createRecurringSeries` succeeds, redirect to series view. The existing "redirect to booking detail" flow doesn't apply. Helper text in the form explains.
5. **Calendar badge — icon vs colour** — locked at `↻` icon. Could also add a tinted left-border (but DESIGN.md bans `border-l-4`). Stay with the icon.
6. **Series view permissions** — same as booking detail (canViewAllBookings). Therapist sees individual assigned bookings but not the series-level view. Plan §3 confirms.
7. **Audit log for cron-extension activity** — written per template extension. May produce many rows. Acceptable.
8. **Customer manage URL — series-aware?** Locked at per-occurrence per Q9.8 in brief.
9. **Edit series UI complexity** — limited fields editable. If complexity grows, split into a dedicated edit-template route. C-12+.

---

*End of C-02 plan. Brief: `redesign/briefs/C-02-recurring-bookings-brief.md`. Progress: `redesign/per-page-progress/C-02-recurring-bookings-progress.md` (filled during C-C).*
