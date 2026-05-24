# Plan: B-2 — Metric backend

**Brief:** `redesign/briefs/B2-metric-backend-brief.md`
**Effort:** ~3.5 days (was 3; +0.5d for `insight_dismissals` table + dismiss action + `getAuditLogForStaff` + `getAvgBookingValue` per AUDIT-2026-05-22 resolutions)
**Prerequisites:** none (independent of B-1)
**Gates:** B-3, B-4, B-5, B-6 all consume B-2 helpers
**Safety label:** ADDITIVE (helpers are pure functions; one migration is additive nullable column; cache wrap is transparent to consumers)
**Blocks redesign:** YES — without `getStaffScorecard`, prior-period query, insights, and LTV helpers, B-3 / B-4 / B-6 cannot ship

---

## What this is

10 additive helpers added to `src/app/admin/reports/reporting.ts` (`getUtilisationRate`, `getNoShowRate`, `getRetentionRate`, `getSourceAttribution`, `getNetCollectionRate`, `getAvgBookingValue`, `getStaffScorecard`, `getAuditLogForStaff`, `filterReportDataToStaff`, `buildPriorPeriodFilters`); 1 new file `src/app/admin/reports/report-insights.ts` with `getReportInsights` + `buildInsightId`; 1 new file `src/app/admin/reports/insight-actions.ts` with `dismissInsight` server action; 1 new file `src/app/admin/clients/client-metrics.ts` with `getClientLifetimeMetrics`; 3 migrations (`enquiries.first_contacted_at` + Band B query indexes + `insight_dismissals` table); 1 server-action extension (Mark enquiry contacted writes the new timestamp with idempotent guard); `unstable_cache` wrap on `getReportData` + `getDashboardData` with 60s revalidate + tag-based revalidation hooks on every mutating action. **NOTE per AUDIT C3:** the column `enquiries.converted_booking_id` ALREADY EXISTS in production; no migration adds it.

## Why it's needed

The user's "metrics not granular enough" is solved structurally by adding deltas everywhere, which requires a prior-period query infrastructure. The "per-user metrics don't exist" is solved by `getStaffScorecard` + `filterReportDataToStaff`. The "simple anomaly detection if cheap" is solved by `getReportInsights`. The LTV ribbon (B-6) needs `getClientLifetimeMetrics`. All of this is data-layer work that must land before any UI consumer can ship. R3's original 2-helper sketch was too thin; B-2 ships the richer set up-front so B-3/B-4/B-5/B-6 don't negotiate on data shape.

## What this does (user story)

"As a B-3/B-4/B-5/B-6 implementer, I call `getStaffScorecard(data, staffId, priorData)` from a server component, get back a fully-typed object with every per-staff metric + period-over-period deltas, render it into the new `<KpiTile>` primitives without any data-shape transformation. Same for `getReportInsights` (deterministic anomalies), `getClientLifetimeMetrics` (LTV ribbon), and the prior-period query infrastructure."

## What information it stores or retrieves

**Reads:** existing tables — `bookings`, `booking_assignments`, `booking_items`, `clients`, `staff_profiles`, `staff_availability_rules`, `enquiries`, `email_events`, `operational_events`, `audit_logs`. All RBAC-narrowed via `getReportData(adminClient, profile, filters)` (existing). Helpers compose over `ReportData`; no helper triggers its own DB call.

**Writes:** one server-action extension (writes `enquiries.first_contacted_at` on first contact, idempotent).

**Migrates:** three migrations — (1) ALTER TABLE adding nullable `first_contacted_at TIMESTAMPTZ` to `enquiries` + the corresponding partial index. (2) Band B query indexes (`audit_logs`, `booking_assignments`, `bookings` — all `CREATE INDEX IF NOT EXISTS`). (3) NEW `insight_dismissals` table per AUDIT Q6 (RLS + 3 policies + service_role DML grant + composite PK index).

## Who can use it

Helpers themselves are RBAC-agnostic (pure math over a `ReportData` that's already RBAC-narrowed upstream). Consumers (B-3/B-4/B-5/B-6) enforce permission gates per surface.

## What can go wrong

- **Division by zero on rate helpers**: `noShowRate` with 0 bookings; `retentionRate` with 0 clients; `netCollectionRate` with 0 billed. **Mitigation:** every rate helper returns 0 (not NaN) when denominator is 0; vitest specs lock the contract.
- **Migration applied to wrong env**: `enquiries.first_contacted_at` migration runs against prod via MCP. **Mitigation:** Zone-2 confirmation required per HANDOFF §4.5 — user explicitly authorises each `mcp__supabase__apply_migration` call by file.
- ~~**`converted_to_booking_id` column already exists**~~ **RESOLVED per AUDIT C3:** the column ALREADY exists as `converted_booking_id` (different name). No migration. All helper references use `converted_booking_id`.
- **`unstable_cache` returns stale data after a mutation that didn't call `revalidateTag`**: e.g. a new booking-creation action not yet wired to invalidate. **Mitigation:** plan step 9 enumerates every mutation action by grep and wires `revalidateTag('report-data')` + `revalidateTag('dashboard-data')` per action.
- **Prior-period overlap with current period**: `buildPriorPeriodFilters` for `range=this_week` returns 7 days before today, which may overlap today's start if "this week" includes today. **Mitigation:** prior-period helper uses `(currentFrom − (currentTo − currentFrom))` formula — guarantees no overlap.
- **`getStaffScorecard` for staff with no assignments**: should return zero-filled object, not throw. **Mitigation:** vitest spec for "staffId not in data".
- **`getClientLifetimeMetrics` with cancelled-only bookings**: LTV = 0, repeatStatus = 'new'. **Mitigation:** spec covers; consumer (B-6) hides ribbon when `visitCount === 0` (different from "zero-but-has-cancelled" state).
- **`getReportInsights` over-firing**: too many thresholds trip at once → spammy stripe. **Mitigation:** max 3 insights returned, sorted by severity descending.
- **`first_contacted_at` migration breaks existing enquiries page on first deploy** (column doesn't exist briefly between migration and revalidate): nullable column + ALTER is fast; deploy ordering: migration first, then code that reads/writes the column.
- **Cache key collisions across users**: `unstable_cache` key includes `profile.id` to scope. Two Owners would still share — that's correct (same data scope).
- **`profile.id` exposed in cache key (potential PII leak in cache key store)**: Next.js stores cache keys server-side; not exposed to client. Safe.

## How to verify it works

Four verification rounds:

1. **Static + types:** `pnpm lint` + `npx tsc --noEmit` clean.
2. **Vitest:** new specs pass (~30 specs across 10 helpers); baseline 112 specs preserved.
3. **Migrations applied:** `SELECT column_name FROM information_schema.columns WHERE table_name='enquiries' AND column_name='first_contacted_at'` returns 1 row. `SELECT tablename FROM pg_tables WHERE tablename='insight_dismissals'` returns 1 row.
4. **Smoke:** temporarily wire `getStaffScorecard(reportData, profile.id)` into the existing dashboard, console.log the result for a known-good DB state, sanity-check the numbers, then revert the temporary wire (NOT committed).
5. **Cache:** dev console shows `revalidateTag` firing on a manual booking-mutation; subsequent reload returns fresh data.

## Safe implementation order

### Step 1 — Schema verification (Zone-2 confirmation required for any apply)
- Use `mcp__supabase__list_tables` to inspect `enquiries`. Confirm whether `first_contacted_at` exists.
- **Per AUDIT-2026-05-22 C3:** the column we previously called `converted_to_booking_id` already exists in production as `converted_booking_id` (verified via `20260503210000_phase7_crm_enquiries_ops.sql:49`). No verification needed; no migration.
- **Expected state:** `first_contacted_at` is absent (the only column we add); `converted_booking_id` is present and used as-is.
- Document findings in a scratchpad.
- **Wait for user authorisation before applying any migration.**

### Step 2 — Migration: `first_contacted_at` + index
- Create `supabase/migrations/20260522120000_add_enquiry_first_contacted_at.sql`:
  ```sql
  ALTER TABLE public.enquiries
    ADD COLUMN IF NOT EXISTS first_contacted_at TIMESTAMPTZ NULL;

  COMMENT ON COLUMN public.enquiries.first_contacted_at IS
    'Set to NOW() on first transition to status=contacted (idempotent guard at action layer). Powers the time-to-first-contact metric.';

  CREATE INDEX IF NOT EXISTS enquiries_first_contacted_at_idx
    ON public.enquiries(first_contacted_at)
    WHERE first_contacted_at IS NOT NULL;
  ```
- Request Zone-2 confirmation from user.
- Apply via `mcp__supabase__apply_migration` (project `twzutkfgqclqurvkmvqz`).
- Verify via `mcp__supabase__execute_sql`: `SELECT column_name FROM information_schema.columns WHERE table_name='enquiries' AND column_name='first_contacted_at'` returns 1 row.

### Step 3 — Migration: Band B query indexes
- Per `SHARED-IMPLEMENTATION-NOTES.md` §1.
- Create `supabase/migrations/20260522121000_add_band_b_indexes.sql`:
  ```sql
  CREATE INDEX IF NOT EXISTS audit_logs_actor_recent_idx
    ON audit_logs(actor_staff_id, created_at DESC)
    WHERE actor_staff_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS booking_assignments_assigned_staff_status_idx
    ON booking_assignments(assigned_staff_id, status);

  CREATE INDEX IF NOT EXISTS bookings_client_status_completed_idx
    ON bookings(client_id, status)
    WHERE status = 'completed';
  ```
- Request Zone-2 confirmation, apply, verify each `IF NOT EXISTS` (existing indexes preserved).

### Step 3.5 — Migration: insight_dismissals table (NEW per AUDIT-2026-05-22 Q6)
- Per `SHARED-IMPLEMENTATION-NOTES.md` §14.
- Create `supabase/migrations/20260522122000_add_insight_dismissals.sql`:
  - Creates `public.insight_dismissals` table with composite PK `(staff_id, insight_id)`.
  - Enables RLS with 3 policies (select / insert / delete OWN).
  - Grants SELECT, INSERT, DELETE to `service_role` (matches `notification_state` pattern from R4).
  - Adds `insight_dismissals_staff_recent_idx`.
- Request Zone-2 confirmation, apply, verify table exists + RLS enabled + policies present:
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'insight_dismissals';
  SELECT policyname FROM pg_policies WHERE tablename = 'insight_dismissals';
  ```
- Expected: 1 table with `rowsecurity=true`; 3 policies returned.

### Step 4 — Server-action extension (`updateEnquiryStatus`)
- Locate `updateEnquiryStatus` in `src/app/admin/enquiries/actions.ts` (verified — confirmed name).
- The action already reads `beforeState` via `.select("*").single()` BEFORE the update.
- Add to the UPDATE payload, with idempotent guard (per AUDIT-2026-05-22 H4):
  ```ts
  const updatePayload: Record<string, unknown> = { status };
  if (status === 'contacted' && beforeState.first_contacted_at == null) {
    updatePayload.first_contacted_at = new Date().toISOString();
  }
  // existing update call now uses updatePayload instead of bare { status }
  ```
- **Critical:** the guard prevents overwriting on later transitions (contacted→booked, booked→closed).
- Audit log row continues to be written (existing pattern preserved).
- **Verify:**
  1. New enquiry: status → 'new', `first_contacted_at` is null.
  2. Mark contacted: status → 'contacted', `first_contacted_at` is set to NOW().
  3. Mark contacted again (no-op via the form): `first_contacted_at` unchanged.
  4. Move to booked: status → 'booked', `first_contacted_at` unchanged from original (NOT reset, NOT overwritten).
  5. Move back to contacted (rare): `first_contacted_at` unchanged (guard prevents).

### Step 5 — New helpers in `reporting.ts`
- Open `src/app/admin/reports/reporting.ts`.
- Add a comment block separating "B-2 additions (2026-05-22)" from existing exports.
- Implement in this order (later helpers depend on earlier ones):
  1. `buildPriorPeriodFilters(filters)` — pure helper; needed by callers fetching priorData.
  2. `filterReportDataToStaff(data, staffId)` — pure helper; used by `getStaffScorecard` internally.
  3. `getUtilisationRate(data, scope?)` — uses `staff_availability_rules` to compute denominator.
  4. `getNoShowRate(data, scope?)` — simple math over `bookings`.
  5. `getRetentionRate(data, scope?, threshold = 3)` — groups by `client_id`, counts visits, applies threshold.
  6. `getSourceAttribution(data)` — groups by `booking_source`, sums by total + revenue.
  7. `getNetCollectionRate(data)` — `collected / billed`.
  8. `getAvgBookingValue(data)` — `completedRevenue / completedBookingCount` (completed-only per AUDIT-2026-05-22 Q2). Returns 0 when denominator is 0.
  9. `getStaffScorecard(data, staffId, priorData?, auditLogs?)` — composes helpers above + revenue attribution + same-gender count. Per AUDIT-2026-05-22 H3, returns `{ clinical, admin, deltas? }` with both Therapist + Coordinator sub-objects. 4th arg `auditLogs` (optional) enables `admin.enquiriesContactedCount` / `bookingsAssignedCount` / `opsEventsResolvedCount` derivation.
  10. `getAuditLogForStaff(adminClient, staffId, limit)` — per AUDIT-2026-05-22 G1, lives here (data-layer convention). Returns `AuditEventRow[]` ordered DESC; uses `audit_logs_actor_recent_idx` from step 3.
- **Per AUDIT G-final-2:** `getStaffScorecard.admin.opsEventsResolvedCount` derives from `audit_logs` filtered by action_type. The exact action_type for "ops event resolved" is NOT yet standardised in the docs. **Implementer must grep existing audit-log entries first** via `mcp__supabase__execute_sql`:
  ```sql
  SELECT DISTINCT action_type FROM audit_logs WHERE target_type='operational_events';
  ```
  Use whatever action_type appears (likely `operational_event_resolved` or `operational_event_acknowledged`). Document the discovered value in the progress file. Same logic for `enquiriesContactedCount` (likely `enquiry_status_updated` filtered to `after_state.status='contacted'`) and `bookingsAssignedCount` (likely `booking_assignment_added` or similar).
- Each helper has an explicit return type. No `any`. No `unknown` leaks.
- **Verify per helper:** add vitest spec in `__tests__/reporting-b2.test.ts` covering the brief's §6 test states for that helper.

### Step 6 — `report-insights.ts` + `insight-actions.ts`
- Create `src/app/admin/reports/report-insights.ts`.
- Implement `getReportInsights(data, priorData, dismissedIds?, options?)` per brief §4 (signature updated per AUDIT-2026-05-22 Q6: 3rd arg is `dismissedIds: Set<string>` to filter).
- Each insight has a stable `id` derived via `buildInsightId(category, deltaBucket, period, yyyyMm)` — same insight in same period = same ID = dismissable once.
- Filter out `dismissedIds.has(insight.id)` before returning.
- Threshold defaults: see brief §8.
- Returns at most 3 insights, sorted by severity descending.
- Each insight has optional `drillUrl` per brief §10 Q7.

- Create `src/app/admin/reports/insight-actions.ts` (NEW file per AUDIT-2026-05-22 Q6):
  ```ts
  "use server";
  import { revalidatePath } from "next/cache";
  import { createSupabaseServerClient } from "@/lib/supabase/server";
  import { createSupabaseAdminClient } from "@/lib/supabase/admin";
  import { getStaffProfile } from "@/lib/auth/rbac";

  export async function dismissInsight(insightId: string) {
    const supabase = await createSupabaseServerClient();
    const profile = await getStaffProfile(supabase);
    if (!profile || !profile.active) return { error: "Insufficient permissions." };
    if (!insightId) return { error: "Insight ID required." };

    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient
      .from("insight_dismissals")
      .insert({ staff_id: profile.id, insight_id: insightId });

    if (error && error.code !== "23505") return { error: error.message };  // 23505 = unique violation; idempotent
    revalidateTag("report-data");
    revalidatePath("/admin/reports");
    return { success: true };
  }
  ```
- **Verify:** vitest spec covering: no thresholds tripped, one tripped, all tripped (cap at 3), prior period missing, dismissed IDs filtered out.

### Step 7 — `client-metrics.ts`
- Create `src/app/admin/clients/client-metrics.ts`.
- Implement `getClientLifetimeMetrics(clientId, data)` per brief §4 #10.
- Returns zero-filled object when client not in data (B-6 ribbon hides when `visitCount === 0`).
- **Verify:** vitest spec in `__tests__/client-metrics.test.ts` covering all states from B-6 §6.

### Step 8 — Cache layer
- Wrap `getReportData` in `unstable_cache(..., ['report-data', profile.id, JSON.stringify(filters)], { revalidate: 60, tags: ['report-data'] })`.
- Wrap `getDashboardData` similarly with `tags: ['dashboard-data', 'report-data']`.
- **NB:** `unstable_cache` is a Next.js API; the wrap happens in `src/app/admin/reports/page.tsx` and `src/app/admin/dashboard/dashboard-data.ts` (or wherever the function is called from the page).
- **Verify:** dev mode reload `/admin/reports`; check Next.js logs for cache hit on second reload within 60s.

### Step 9 — Tag-revalidation wiring (per AUDIT H3 — explicit mutation site list)
- Add `revalidateTag('report-data')` and `revalidateTag('dashboard-data')` calls immediately before the existing `revalidatePath(...)` calls in each mutation action file. Grep `revalidatePath\('/admin/(dashboard|reports)` to discover any new sites added since this list.
- **Enumerated sites (verify each is hit):**
  1. `src/app/admin/bookings/actions.ts` — booking create / update / cancel / reschedule / claim / assign / approve / mark-complete actions (count ~6 internal revalidate calls)
  2. `src/app/admin/enquiries/actions.ts` — createEnquiry / updateEnquiry / updateEnquiryStatus / deleteEnquiry / convertToBooking (~5 calls)
  3. `src/app/admin/staff/[staffId]/availability/actions.ts` — availability rules + blocked dates + overrides (~4 calls)
  4. `src/app/admin/clients/actions.ts` — client create / update / merge (~3 calls)
  5. `src/app/admin/operations/actions.ts` — ops event acknowledge / resolve (~2 calls)
  6. `src/app/admin/account-requests/actions.ts` — password-reset approve / reject (~2 calls)
  7. `src/app/admin/reports/insight-actions.ts` — `dismissInsight` (new in this phase; revalidateTag is already there from step 6)
- **Expected total:** ~22 `revalidateTag` insertions across 7 files.
- **Verify:** trigger a manual booking creation; check Next.js logs for both tag invalidations; reload `/admin/dashboard` and confirm fresh booking count.

### Step 10 — Vitest final pass
- Run `pnpm vitest run`. Confirm all new specs pass; baseline 112 specs preserved.

### Step 11 — Smoke check via test fixture (per AUDIT H1 — no temporary dashboard wires)
- **Per AUDIT H1:** do NOT wire helpers into the dashboard temporarily (risks accidental commit).
- Instead, write a one-off "integration smoke" vitest spec at `src/app/admin/reports/__tests__/integration-smoke.test.ts`:
  ```ts
  // Hits the real dev DB via createSupabaseAdminClient(); not run in CI; manual smoke only.
  import { describe, it, expect } from "vitest";
  // ... use real client + Owner profile + this-month filters ...
  it.skip("manual smoke: getStaffScorecard for Owner returns sane values", async () => {
    const data = await getReportData(adminClient, ownerProfile, thisMonthFilters);
    const scorecard = getStaffScorecard(data, ownerProfile.id);
    console.log("Owner scorecard:", JSON.stringify(scorecard, null, 2));
    expect(scorecard.clinical.assignmentsTotal).toBeGreaterThanOrEqual(0);
  });
  ```
- Run via `pnpm vitest --run integration-smoke -t "manual smoke" --no-skip` (single-shot).
- Sanity-check the printed JSON against DB state via Supabase MCP.
- **Test stays `.skip`-prefixed in code** so it never runs in CI/regular vitest runs.
- Alternative: use `mcp__supabase__execute_sql` to manually verify the same SQL the helpers run (no code at all).

### Step 12 — Commit
- Stage scoped files (use explicit file paths; never `git add -A`).
- Commit message: `feat(admin): B-2 — metric backend (helpers + first_contacted_at migration + cache layer + insights + LTV)`.

## How to undo it if something breaks

Reverting B-2 has three layers:

1. **Code revert:** `git revert <commit-sha>` removes the helpers and the action extension. Safe — no consumers in B-2 itself.
2. **Migration rollback:** the additive columns are nullable; rolling back means dropping them. **Critical (per AUDIT M2):** do NOT drop `converted_booking_id` — it's a pre-existing column unrelated to B-2.
   ```sql
   ALTER TABLE public.enquiries DROP COLUMN IF EXISTS first_contacted_at;
   DROP INDEX IF EXISTS enquiries_first_contacted_at_idx;
   DROP TABLE IF EXISTS public.insight_dismissals;
   -- B-2 indexes (CREATE INDEX IF NOT EXISTS) — optional to drop; harmless if left
   DROP INDEX IF EXISTS audit_logs_actor_recent_idx;
   DROP INDEX IF EXISTS booking_assignments_assigned_staff_status_idx;
   DROP INDEX IF EXISTS bookings_client_status_completed_idx;
   ```
   But: if any production data has been written to `first_contacted_at` or `insight_dismissals` between B-2 ship and rollback, dropping loses that data. Safer: leave migrations in place; just revert the code.
3. **Cache layer revert:** removing the `unstable_cache` wrap reverts to direct DB calls per request (slower but safe). The `revalidateTag` calls become no-ops (no listeners).

**Recommended rollback if B-2 causes prod issue:** revert code only; leave migration in place. Re-apply on fix.

## Safety confirmations

- [ ] Branch is `redesign/start-state` (or worktree).
- [ ] `mcp__supabase__list_tables` confirmed `enquiries` schema before any migration applied.
- [ ] Zone-2 confirmation received from user for `first_contacted_at` migration.
- [ ] Zone-2 confirmation received from user for indexes migration.
- [ ] Zone-2 confirmation received from user for `insight_dismissals` migration.
- [ ] No `pnpm install` / `pnpm add` (zero new dependencies).
- [ ] No production deploy triggered by this phase (migration applies to dev/prod DB; code stays on branch until B-2 commit lands).

---

## Step-by-step verification log template

```
step-1: COMPLETE — list_tables: first_contacted_at ABSENT; converted_booking_id PRESENT (pre-existing per AUDIT C3); insight_dismissals ABSENT
step-2: COMPLETE — migration 20260522120000 applied (Zone-2 confirmed); column verified present
step-3: COMPLETE — migration 20260522130000 applied (Zone-2 confirmed); column verified present
step-4: COMPLETE — Mark contacted action writes first_contacted_at; idempotent verified via double-call test
step-5a: COMPLETE — buildPriorPeriodFilters added; 6 specs pass
step-5b: COMPLETE — filterReportDataToStaff added; 4 specs pass
step-5c: COMPLETE — getUtilisationRate added; 5 specs pass
step-5d: COMPLETE — getNoShowRate added; 4 specs pass
step-5e: COMPLETE — getRetentionRate added; 5 specs pass
step-5f: COMPLETE — getSourceAttribution added; 4 specs pass
step-5g: COMPLETE — getNetCollectionRate added; 3 specs pass
step-5h: COMPLETE — getStaffScorecard added (composes 5c-5g + revenue attribution); 6 specs pass
step-6: COMPLETE — report-insights.ts created; getReportInsights with 8 threshold templates; 7 specs pass
step-7: COMPLETE — client-metrics.ts created; getClientLifetimeMetrics; 5 specs pass
step-8: COMPLETE — unstable_cache wrap on getReportData + getDashboardData with 60s revalidate + tags
step-9: COMPLETE — revalidateTag wired on 8 mutation sites (booking create/update/cancel/reschedule/assign + enquiry contact/convert + staff availability)
step-10: COMPLETE — vitest run: 142 pass / 6 baseline fail (preserved)
step-11: COMPLETE — smoke: getStaffScorecard for Owner returns expected values (manual check); temporary wire reverted
step-12: COMPLETE — committed feat(admin): B-2 — metric backend ...
```

---

## Verification gate

| Gate | Command | Pass criterion |
|---|---|---|
| Static lint | `pnpm lint` | 0 errors |
| Static types | `npx tsc --noEmit` | 0 errors |
| Vitest | `pnpm vitest run` | ~30 new specs pass; baseline 112 preserved |
| Migration applied | `SELECT column_name FROM information_schema.columns WHERE table_name='enquiries' AND column_name='first_contacted_at'` | Returns 1 row |
| Insight dismissals applied | `SELECT tablename FROM pg_tables WHERE tablename='insight_dismissals'` | Returns 1 row + RLS enabled + 3 policies |
| Mark contacted idempotent | Call action twice on same enquiry | `first_contacted_at` set only on first call |
| Cache wrap | Reload `/admin/reports` twice within 60s | Second reload faster (cache hit logged) |
| Tag revalidation | Create a booking; reload `/admin/dashboard` | Fresh booking count reflects |
| Smoke | Temporary `console.log(getStaffScorecard(...))` on dashboard | Sane values match DB |
| Cleanup | `git diff` | No `console.log` left over; no sandbox code |

---

## Files touched (summary)

**Created:**
- `src/app/admin/reports/report-insights.ts`
- `src/app/admin/clients/client-metrics.ts`
- `src/app/admin/reports/__tests__/reporting-b2.test.ts`
- `src/app/admin/reports/__tests__/report-insights.test.ts`
- `src/app/admin/clients/__tests__/client-metrics.test.ts`
- `supabase/migrations/20260522120000_add_enquiry_first_contacted_at.sql`
- `supabase/migrations/20260522121000_add_band_b_indexes.sql`
- `supabase/migrations/20260522122000_add_insight_dismissals.sql`
- `src/app/admin/reports/insight-actions.ts` — `dismissInsight` server action (NEW per AUDIT Q6)

**Modified:**
- `src/app/admin/reports/reporting.ts` (8 new helpers; no existing helpers touched)
- `src/app/admin/reports/page.tsx` (cache wrap on the `getReportData` call)
- `src/app/admin/dashboard/dashboard-data.ts` (cache wrap on `getDashboardData`)
- `src/app/admin/enquiries/actions.ts` (Mark contacted writes `first_contacted_at`)
- 6–10 mutation action files (one-line `revalidateTag` addition each)

**Total: ~7 new files + ~13 modified files.**

---

## Hand-off

After B-2 ships:
- B-3 implementer can start (needs `getStaffScorecard`, `filterReportDataToStaff`).
- B-4 implementer can start (needs prior-period query, all new aggregates, insights).
- B-5 implementer can start (needs `getStaffScorecard` for Personal Stripe).
- B-6 implementer can start (needs `getClientLifetimeMetrics`).

Next phase: B-3 (Performance surface).
