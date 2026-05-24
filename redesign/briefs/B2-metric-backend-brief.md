# Brief: B-2 — Metric backend

**Phase:** B-2 (data layer; gates B-3, B-4, B-5, B-6)
**Estimated effort:** ~3 days (2d core + 0.5d LTV helper + 0.5d insights helper)
**Brief status:** session-4 reframe; user-confirmed
**Plan:** `redesign/plans/B-phase/B2-metric-backend-plan.md`

---

## 1. Feature Summary

The data layer underneath the entire Band B redesign. Adds 10 additive helpers to `src/app/admin/reports/reporting.ts`, two new files (`client-metrics.ts` for LTV math; `report-insights.ts` for the simple anomaly-detection stripe), three migrations (`enquiries.first_contacted_at` + Band B indexes + `insight_dismissals` table), and one server-action extension (the existing enquiry "mark contacted" action writes the new timestamp with an idempotent guard). Plus a new server action `dismissInsight` per AUDIT Q6. No UI changes in this phase — purely backend. Every helper is pure-function over already-fetched data where possible; the prior-period query infrastructure adds one parallel `getReportData(priorFilters)` call to enable deltas across every tile in B-3/B-4. Cacheable per (filters, profile.id) via Next.js `unstable_cache`. The phase exists because R3's two-helper sketch was too thin for what B-3/B-4 actually need; ship the richer set up-front so the UI phases have nothing to negotiate about. **NOTE per AUDIT C3:** the column `enquiries.converted_booking_id` ALREADY EXISTS in production (verified via `20260503210000_phase7_crm_enquiries_ops.sql:49`); no migration adds it.

## 2. Primary Engineer/Designer Action

**Open `reporting.ts`, see the new helpers exported alongside the existing `summarizeReports` / `getStaffWorkload` family, call them from a B-3/B-4/B-5/B-6 surface component, and have them return correctly typed, RBAC-safe, well-tested numbers.**

## 3. Design Direction

**Anchor references:**
- **Stripe's `balance_transactions` endpoint** — the "give me numbers, scoped, for a window, with a prior-period baseline" interaction shape
- **PostHog `query` API** — single endpoint, multiple metric shapes, parameter-driven scope
- **The existing `reporting.ts` shape** — additive, pure functions, accepting a `ReportData` and returning a typed value. The new helpers follow this convention verbatim.

Anti-anchor: a "metrics service" with a runtime, a cache layer, and a separate worker. We don't need that scale — 12 users, ~hundreds of bookings/month. Pure functions over a pre-fetched `ReportData` is the right rig.

**Theme scene sentence:** *"A Phase-7 implementer reads a B-2 helper signature, calls it from a server component, and the data flow is so obviously correct that no integration tests are required to gain confidence."* Forces type-safety, pure-function discipline, no hidden state.

## 4. Scope

**In:**

### New helpers in `reporting.ts` (8)

1. **`getUtilisationRate(data, scope?: { staffId?: string })`** — returns `{ rate: number (0–1), bookedHours: number, availableHours: number }`. Computes sessions delivered (assignment count where status='completed' or 'confirmed') against weekly available hours derived from `staff_availability_rules`. Scoped per-staff when `staffId` supplied.

2. **`getNoShowRate(data, scope?: { staffId?: string })`** — returns `{ rate, total, noShows, cancelled, lostRevenue }`. `rate = (noShows + cancelled) / total`. `lostRevenue` is the sum of `total_price` across no-show + cancelled bookings (the recoverable revenue if every no-show had completed).

3. **`getRetentionRate(data, scope?: { staffId?: string }, threshold = 3)`** — returns `{ rate, retainedClients, totalClients }`. `rate = retainedClients / totalClients` where `retainedClients` is the count of clients with `completed booking count >= threshold`. Mental-health benchmark is 8; physical-therapy benchmark is 3. Default 3 for Rahma (massage / home-visit therapy). Override via prop.

4. **`getSourceAttribution(data)`** — returns `Array<{ source: string, bookings: number, revenue: number, percentageOfRevenue: number }>`. Sorts by revenue descending. Used by the Reports Activity section's source attribution stacked-bar.

5. **`getNetCollectionRate(data)`** — returns `{ rate, collected, billed }`. `rate = collected / billed`. The standard healthcare-clinic collection KPI; industry benchmark > 95%.

6. **`getStaffScorecard(data, staffId, priorData?)`** — the centrepiece helper. Returns a single object with BOTH clinical (Therapist-relevant) AND admin (Coordinator-relevant) metrics; consumer picks which sub-object to render. Updated per AUDIT-2026-05-22 H3 — original spec was Therapist-only; widened to cover all roles:
    ```ts
    {
      // Clinical (Therapist-relevant; zero for Coordinator-who-doesn't-treat):
      clinical: {
        assignmentsTotal: number,
        assignmentsCompleted: number,
        hoursWorked: number,
        clientsTouched: number,            // unique client_id count
        revenueAttributed: number,
        utilisation: { rate, bookedHours, availableHours },
        retention: { rate, retainedClients, totalClients },
        noShowRate: { rate, total, noShows, cancelled, lostRevenue },
        sameGenderFulfilled: number,
      },
      // Admin (Coordinator-relevant; zero for Therapist):
      admin: {
        enquiriesContactedCount: number,           // count where this staff transitioned status→'contacted' (from audit_logs)
        enquiryConversionRate: number,             // converted (status='booked' AND converted_booking_id NOT NULL) / contacted
        avgMinutesToFirstContact: number,          // mean (first_contacted_at - created_at) across enquiries this staff first-contacted
        bookingsAssignedCount: number,             // count of booking_assignments where this staff was the assignment actor (from audit_logs action_type='booking_assignment_added')
        opsEventsResolvedCount: number,            // count of operational_events status='resolved' transitions by this staff
      },
      // Optional — only when priorData supplied:
      deltas?: {
        clinical: {
          assignmentsCompleted: number,    // current − prior
          hoursWorked: number,
          clientsTouched: number,
          revenueAttributed: number,
          utilisationRate: number,
          retentionRate: number,
          noShowRate: number,              // remember: tone='invert' (smaller = better)
        },
        admin: {
          enquiriesContactedCount: number,
          enquiryConversionRate: number,
          avgMinutesToFirstContact: number,    // tone='invert'
          bookingsAssignedCount: number,
          opsEventsResolvedCount: number,
        }
      }
    }
    ```
    
    **Implementation note:** `admin.enquiriesContactedCount` + `admin.bookingsAssignedCount` + `admin.opsEventsResolvedCount` derive from `audit_logs` (action_type filter + actor_staff_id). Pass `data.auditLogs` if available, OR accept it as a 4th argument (`getStaffScorecard(data, staffId, priorData?, auditLogs?)`) — recommend 4th arg to keep `ReportData` shape stable. `admin.avgMinutesToFirstContact` derives from `data.enquiries` rows where the staff matches via audit-log "first transition to contacted" lookup.

7. **`filterReportDataToStaff(data, staffId)`** — returns a new `ReportData` clone where `assignments`, `bookings`, `bookingItems`, `clients` are narrowed to rows that involve `staffId`. Used by Reports `?staffId=` drill-in and by the Performance surface. Preserves the original `ReportData` (immutable).

8. **`buildPriorPeriodFilters(filters)`** — returns a `ReportFilters` shifted to the immediately-prior equivalent window (e.g. `range=this_month` → prior month; `range=last_30` → 31–60 days ago; `custom from A to B` → window `(A − (B − A)) to A`). Used by Reports to fetch the comparison baseline.

### New file `src/app/admin/reports/report-insights.ts`

9. **`getReportInsights(data, priorData, options?: { thresholds })`** — pure function returning `Array<{ id, severity: 'critical' | 'warning' | 'info', message: string, drillUrl?: string }>`. Computes 0–3 plain-English observations from threshold-based comparisons of current vs prior period. Examples:
    - "Bookings this week are **22% lower** than the prior 4-week average." (warning if drop > 15%; critical if drop > 30%)
    - "Outstanding revenue grew **£340 vs last month** — 3 unpaid bookings from {staffName} are the largest contributors."
    - "Aisha's utilisation dropped from **78%** to **61%** this month."
    - "Avg time-to-first-contact on enquiries is **47 minutes** this week, up from 18 min."

   Returns at most 3 insights (top severity wins; never spammy). Empty array when no thresholds tripped. Thresholds default to sensible values; overridable per consumer.

### New file `src/app/admin/clients/client-metrics.ts`

10. **`getClientLifetimeMetrics(clientId, bookings)`** — returns `{ ltv, visitCount, completedCount, cancelledCount, lastSeenAt, firstSeenAt, avgBookingValue, preferredService, monthlyVisitsSeries, repeatStatus }`. `repeatStatus ∈ 'new' | 'returning' | 'regular' | 'loyal'` mapped from completed-count buckets (`< 2` / `2–4` / `5–9` / `≥ 10`). `monthlyVisitsSeries` is a 12-month array for the sparkline. Used by B-6 LTV ribbon on the client detail page. **Per AUDIT-2026-05-22 H2:** signature accepts `bookings: ClientBookingRecord[]` (the shape `/admin/clients/[clientId]/page.tsx` already fetches as `bookingHistory`), NOT `ReportData`. This avoids a second DB query.

### Server-action change

11. Extend the existing **`updateEnquiryStatus`** action in `src/app/admin/enquiries/actions.ts` to write `first_contacted_at = now()` ONLY when status transitions TO `'contacted'` AND `beforeState.first_contacted_at === null`. Idempotent guard prevents overwriting on later status changes (contacted→booked→closed). Audit-logged via existing pattern. Updated per AUDIT-2026-05-22 H4:
    ```ts
    const updatePayload: Record<string, unknown> = { status };
    if (status === 'contacted' && beforeState.first_contacted_at == null) {
      updatePayload.first_contacted_at = new Date().toISOString();
    }
    ```

### Migration

12. **`supabase/migrations/20260522120000_add_enquiry_first_contacted_at.sql`** — adds `first_contacted_at TIMESTAMPTZ NULL` to `enquiries` + `enquiries_first_contacted_at_idx` index. Nullable so existing rows survive. No RLS change (existing policies cover all columns).

### Indexes migration

13. **`supabase/migrations/20260522121000_add_band_b_indexes.sql`** — three `CREATE INDEX IF NOT EXISTS` statements per `SHARED-IMPLEMENTATION-NOTES.md` §1 (audit_logs actor+recent, booking_assignments staff+status, bookings client+status-completed). All idempotent. Safe to apply.

### Insight dismissals migration (NEW per AUDIT-2026-05-22 Q6 resolution)

14. **`supabase/migrations/20260522122000_add_insight_dismissals.sql`** — creates `public.insight_dismissals` table for persistent Insights stripe dismissal. Per-staff per-insight-id, with RLS via `app_private.current_active_staff_id()` (same helper R4 uses) + service_role DML grant. Full SQL in `SHARED-IMPLEMENTATION-NOTES.md` §14.

### Additional helpers (NEW per AUDIT-2026-05-22 G1 + Q6)

15. **`getAuditLogForStaff(adminClient, staffId, limit)`** — fetches the most recent N audit_log rows where `actor_staff_id = staffId`, ordered DESC. Returns the same `AuditEventRow[]` shape as the existing `/admin/audit` queries (consume `audit_logs_actor_recent_idx` from the indexes migration). Used by B-3 Performance surface activity timeline.

16. **`dismissInsight(insightId)` server action** — lives in `src/app/admin/reports/insight-actions.ts` (NEW file). Authenticates via `getStaffProfile`; inserts into `insight_dismissals` with idempotent upsert (PRIMARY KEY collision → no-op). Revalidates `/admin/reports`. Used by B-4 Insights stripe dismiss "×" button.

17. **`getReportInsights(data, priorData, dismissedIds?, options?)` — updated signature** — adds optional `dismissedIds: Set<string>` filter parameter. Filters out insights whose `id` matches any dismissed ID before returning. ID format: `<category>-<delta-bucket>-<period>-<yyyy-mm>` (stable hash; same insight in same period = same ID).

### Avg Booking Value definition (NEW per AUDIT-2026-05-22 Q2 lock)

18. **`getAvgBookingValue(data)` helper** — added explicitly to lock the denominator interpretation. Formula: `completedRevenue / completedBookingCount` (completed bookings only — industry standard "revenue per visit"; matches existing `completedRevenue` accumulator in `summarizeReports`). Returns 0 when `completedBookingCount === 0` (NaN guard).

### What we are NOT migrating (per AUDIT-2026-05-22 C3)

- ~~`enquiries.converted_to_booking_id`~~ — the column **already exists** in production as `enquiries.converted_booking_id` (different name from the original assumption; verified via `20260503210000_phase7_crm_enquiries_ops.sql:49`). All helper references use `converted_booking_id`. No migration needed.

### Cache layer

14. Wrap `getReportData(adminClient, profile, filters)` in `unstable_cache(..., ['report-data', profile.id, JSON.stringify(filters)], { revalidate: 60, tags: ['report-data'] })`. Add a `revalidateTag('report-data')` call to every booking / enquiry mutation server-action that already calls `revalidatePath('/admin/...')`. Low risk because tag-based revalidation is purely additive to existing path-based revalidation.

### Vitest specs

15. One vitest spec per new helper in `src/app/admin/reports/__tests__/reporting-b2.test.ts` (and `client-metrics.test.ts`, `report-insights.test.ts`). Cover: happy path, empty data, single-row data, scope='staffId-with-no-bookings', edge cases (division by zero on rates → returns 0, not NaN).

**Out (deferred or out entirely):**

- **Staff weekly-capacity column or materialised view** — per session-4 decision, utilisation derives from `staff_availability_rules` on the fly. Skipping the column avoids a join + a maintenance burden.
- **Staff targets table (`staff_targets`)** — explicit user decision: out of scope this round.
- **LLM-based insights** — only the deterministic threshold-based `getReportInsights` ships.
- **Real-time invalidation via Supabase realtime** on bookings/enquiries — the 60s `unstable_cache` revalidate + path-revalidate-on-mutation is enough for this scale. Realtime channel addition can land in V1.1 if needed.
- **Public-facing therapist metrics** — explicit user decision.
- **Materialised views** — none needed at this scale. Pure-function helpers over fetched data.

## 5. Layout Strategy

N/A — no UI in this phase. The "layout" is the function signature shape:

```ts
// Reports/staff scoped helpers (existing convention; new helpers follow):
export function getXyz(data: ReportData, scope?: { staffId?: string }): SomeShape

// Cross-cutting helper:
export function buildPriorPeriodFilters(filters: ReportFilters): ReportFilters
export function filterReportDataToStaff(data: ReportData, staffId: string): ReportData

// Per-resource:
export function getClientLifetimeMetrics(clientId: string, data: ReportData): ClientLTV

// Cross-cutting computed-over-comparison:
export function getReportInsights(
  data: ReportData,
  priorData: ReportData,
  options?: InsightOptions
): ReportInsight[]
```

All helpers are exported alongside the existing `getStaffWorkload`, `getServicePerformance`, `summarizeReports` family. Naming convention matches existing (`getX`, `summarizeY`).

## 6. Key States (per helper)

| Helper | States to cover in tests |
|---|---|
| `getUtilisationRate` | populated · zero-bookings · zero-available-hours (returns 0, never NaN) · scope to staff with no bookings · scope to staff with no availability rules |
| `getNoShowRate` | populated · zero-bookings (returns 0) · 100% no-show · scope to staff |
| `getRetentionRate` | populated · single-visit clients only (returns 0) · all clients ≥ threshold (returns 1) · threshold override (e.g. 8) · scope to staff |
| `getSourceAttribution` | populated · single source · empty bookings (returns []) · source = null on some bookings (groups under "Not set") · zero revenue (percentageOfRevenue defaults to 0) |
| `getNetCollectionRate` | populated · zero-billed (returns 0) · over-collected (rate > 1 — possible from over-payments; returns the true ratio) |
| `getStaffScorecard` | populated · no prior data (deltas undefined) · prior data supplied (deltas computed) · staffId not in data (returns zero scorecard, not error) · all metrics zero |
| `filterReportDataToStaff` | populated · staffId touches no assignments (returns empty clone) · staffId is a participant (filters bookings via assignment join) · preserves immutability of input |
| `buildPriorPeriodFilters` | range=this_week · range=this_month · range=last_30 · range=custom · range=lifetime (returns null or current-window-clamped — flag for review) · `from > to` edge case |
| `getReportInsights` | no thresholds tripped (returns []) · one tripped · all three tripped (top severity wins) · prior period missing (returns []) · scope to staff (per-staff insights mode) |
| `getClientLifetimeMetrics` | populated · client with 1 visit (repeatStatus='new') · client with 10 visits (repeatStatus='loyal') · client with no completed bookings (zero LTV) · client_id not in data (returns null) |

## 7. Interaction Model

N/A — pure functions; no runtime interaction with users. **Internal interaction model:**

- Helpers receive a `ReportData` (or `ReportData + ReportData prior`) and return a plain object.
- No DB access from helpers (single source of DB access is `getReportData` itself).
- No side effects (no audit logs, no mutations, no fetch).
- Helpers compose: e.g. `getStaffScorecard` calls `getUtilisationRate`, `getNoShowRate`, `getRetentionRate` internally.
- Helpers honour the `cancelled` / `no_show` exclusion contract that the existing `summarizeReports` enforces — booking counts exclude cancelled/no-show unless the helper's contract explicitly includes them (e.g. `getNoShowRate` must include them).

## 8. Content Requirements

The only user-facing content this phase introduces is the **Insights stripe messages** from `getReportInsights`. Library:

| Trigger | Severity | Message template |
|---|---|---|
| Bookings dropped >15% vs prior period | warning | `Bookings this {period} are {pct}% lower than the prior {priorLabel}.` |
| Bookings dropped >30% vs prior period | critical | `Bookings this {period} dropped sharply — {pct}% lower than the prior {priorLabel}.` |
| Bookings grew >25% vs prior period | info | `Bookings up {pct}% on the prior {priorLabel} — nice.` |
| Outstanding revenue grew >£200 vs prior | warning | `Outstanding revenue grew £{delta} vs last {priorLabel} — {topContributorCount} unpaid bookings from {topStaffName} are the largest contributors.` |
| Utilisation dropped >10pp for any staff | warning | `{staffName}'s utilisation dropped from {prior}% to {current}% this {period}.` |
| Time-to-first-contact exceeded 60 min avg | warning | `Avg time-to-first-contact on new enquiries is {currentMin} min this {period}, up from {priorMin} min.` |
| No-show rate exceeded 15% | warning | `No-show rate is {pct}% this {period} — {lostRevenue} potential revenue lost.` |
| Net collection rate dropped below 90% | critical | `Net collection rate fell to {pct}% — below the 95% benchmark.` |

Each insight optionally carries a `drillUrl` — e.g. the staff-utilisation insight links to `/admin/staff/<id>?tab=performance&range=this_month`.

**Voice anchors hit:** verbs over nouns ("Bookings dropped" not "Booking decrease"); real numbers and real names ("Aisha's utilisation" not "Therapist X utilisation"); state-word discipline ("up from 18 min" not "previously was 18 min").

## 9. Recommended References

- **`reference/spatial-design.md`** — N/A (no UI), but the Insights stripe layout (consumed in B-4) will reference this.
- **`reference/api-patterns.md`** (if it exists, or DESIGN.md §Server) — for the pure-function helper convention; matches existing `reporting.ts`.
- **Industry KPI sources** — utilisation 70–85% benchmark (Spry, OmniMD); net collection rate 95% benchmark (Financial Models Lab); retention threshold (LeadSquared mental-health KPIs uses 8; we use 3 for massage). Sources captured in `BAND-B-RESEARCH-2026-05-22.md`.

## 10. Open Questions

1. **`buildPriorPeriodFilters` for `range=lifetime`** — there is no "prior lifetime." Options: (a) return null / undefined, consumer skips delta rendering for lifetime range; (b) return the same lifetime range (delta = 0 always); (c) clamp to "prior calendar year." Recommendation: (a) — consumer-side guard. Cleaner than fake deltas.
2. **Should `getStaffScorecard` compute deltas inline, or expose a separate `getStaffScorecardDeltas`?** Recommendation: inline — one helper, optional `priorData` param. Avoids the consumer having to call two helpers and reconcile shapes.
3. **`getReportInsights` cap — fixed at 3 or configurable?** Recommendation: configurable via `options.maxInsights`, defaults to 3. Prevents an unhinged ten-insight stripe.
4. **`first_contacted_at` migration timing** — applied to production via `mcp__supabase__apply_migration`. Zone-2 confirmation required (per HANDOFF §4.5). Plan step requires explicit user OK.
5. ~~**`converted_to_booking_id` — verify-first or just-add?**~~ **RESOLVED per AUDIT-2026-05-22 C3.** The column exists in production as `converted_booking_id` (different name); no migration. All helper references use `converted_booking_id`.
6. **Currency precision in delta computations** — round to whole pence (current convention) or round to nearest pound for display? Recommendation: store as pence in math, format to pound for display in B-4 consumer (existing `formatMoney` helper handles this).
7. **`unstable_cache` `revalidate: 60` value** — too aggressive (re-runs query every minute even without mutation), too lenient? Recommendation: 60s as the minimum; rely on `revalidateTag('report-data')` on mutations to invalidate sooner. Phase 7 can tune.

---

## Recipe Context

### Files to create

| File | Purpose |
|---|---|
| `src/app/admin/reports/report-insights.ts` | `getReportInsights` helper + threshold defaults + message templates + `buildInsightId` helper |
| `src/app/admin/reports/insight-actions.ts` | `dismissInsight` server action (per AUDIT Q6) |
| `src/app/admin/clients/client-metrics.ts` | `getClientLifetimeMetrics` helper |
| `src/app/admin/reports/__tests__/reporting-b2.test.ts` | Vitest specs for the 10 new `reporting.ts` helpers |
| `src/app/admin/reports/__tests__/report-insights.test.ts` | Vitest specs for `getReportInsights` (incl. dismissed-IDs filtering) |
| `src/app/admin/clients/__tests__/client-metrics.test.ts` | Vitest specs for `getClientLifetimeMetrics` |
| `supabase/migrations/20260522120000_add_enquiry_first_contacted_at.sql` | `ALTER TABLE enquiries ADD COLUMN first_contacted_at TIMESTAMPTZ NULL` + index |
| `supabase/migrations/20260522121000_add_band_b_indexes.sql` | Band B query indexes per SHARED-NOTES §1 |
| `supabase/migrations/20260522122000_add_insight_dismissals.sql` | `insight_dismissals` table per SHARED-NOTES §14 (AUDIT Q6) |

### Files to modify

| File | Change |
|---|---|
| `src/app/admin/reports/reporting.ts` | Add 8 new exported helpers. Do NOT modify any existing function bodies, signatures, or exports. Add a small comment block at top of file separating "B-2 additions" from existing helpers for code-archaeology clarity. |
| `src/app/admin/dashboard/dashboard-data.ts` | Wrap `getDashboardData` in `unstable_cache` with `['dashboard-data', profile.id, JSON.stringify(filters)]` key, `revalidate: 60`, `tags: ['dashboard-data', 'report-data']`. ONLY this change — no aggregation logic touched. |
| `src/app/admin/reports/page.tsx` | Same `unstable_cache` wrap on the `getReportData` call. ONLY this change. |
| `src/app/admin/enquiries/actions.ts` (or whatever file holds the "Mark contacted" action) | Add `first_contacted_at: row.first_contacted_at ?? new Date().toISOString()` to the UPDATE payload. Idempotent. Audit-log row preserved. |
| Every server action that mutates bookings/enquiries (existing list — DO NOT add new mutations, just add one line to each) | Add `revalidateTag('report-data')` and `revalidateTag('dashboard-data')` calls immediately before the existing `revalidatePath(...)` lines. ~6–10 call sites; surgical one-liner each. |

### Files to NEVER touch

- `src/app/admin/reports/page.tsx` — DO modify only the `unstable_cache` wrap; do not touch any UI markup or query logic.
- `src/app/admin/reports/ReportsCharts.tsx` — owned by B-4
- `src/app/admin/dashboard/page.tsx` — UI markup owned by B-5
- `src/app/admin/dashboard/dashboard-cards.tsx` — owned by B-5
- `src/lib/auth/**` — RBAC matrix; not touched
- `src/lib/supabase/**` — client factories
- `src/middleware.ts`
- `supabase/migrations/2026052[0-1]*` — existing R4 migrations
- All build/config files

### Feature Preservation Manifest

**Existing exports preserved verbatim:**
- All current `reporting.ts` exports: `summarizeReports`, `getStaffWorkload`, `getStaffRevenueAttribution`, `getServicePerformance`, `getRevenueSeries`, `getCountBy`, `getAttentionItems`, `getGenderCapacity`, `findNextAppointment`, `parseReportFilters`, `canViewRevenueReports`, `hasUniversalReportScope`, `METRIC_DEFINITIONS`, `formatMoney`, `formatNumber`, `humanizeEventType`. Zero changes to these signatures.
- All current `dashboard-data.ts` exports: `getDashboardData`, type `DashboardVariant`. Cache wrap is opaque to consumers.
- All current `client-detail` page data flow: untouched (B-6 will add the LTV ribbon consumer; this phase only adds the helper that B-6 will call).

**Schema additions (RECON §5 — historically marked untouchable for redesigns; migrations are explicit exception per HANDOFF discipline rules):**
- `enquiries.first_contacted_at` — additive, nullable, no RLS change.
- `insight_dismissals` — new table with RLS via `app_private.current_active_staff_id()` (mirrors R4 `notification_state` pattern); service_role DML grant.
- Band B query indexes — `audit_logs_actor_recent_idx`, `booking_assignments_assigned_staff_status_idx`, `bookings_client_status_completed_idx` + `enquiries_first_contacted_at_idx`. All `IF NOT EXISTS`.
- **`enquiries.converted_booking_id` — NOT added** (already exists per AUDIT C3; used as-is).

**Permission gates preserved:**
- All helpers respect the `data: ReportData` contract — `ReportData` is already RBAC-narrowed at `getReportData` upstream, so helpers inherit scoping for free.
- `getStaffScorecard(data, staffId, priorData)` does NOT check whether the caller is allowed to see `staffId`'s data — that check lives in the consumer (B-3 Performance surface). Helpers are pure math.

**Server actions:** one extension (Mark enquiry contacted). No new actions.

**Audit log writes:** existing "Mark contacted" audit row continues to be written; `first_contacted_at` is metadata, not a new audit family.

**External / deep links to preserve:** N/A — backend phase.

### Information hierarchy (helper composition rules)

1. **Single DB read per request.** Helpers compose over the same `ReportData`; no helper triggers its own DB call.
2. **Pure functions.** Same input → same output. No `Date.now()` inside helpers (pass `today` explicitly when needed).
3. **Immutability.** `filterReportDataToStaff` returns a new object; never mutates the input.
4. **NaN avoidance.** Every rate helper guards division-by-zero → returns 0.
5. **Type safety.** Every helper has an explicit return type. No `any`. No `unknown` leaks.

### Design direction — tokens and components

N/A — backend phase. The Insights stripe message styling is owned by B-4 (Reports) consumer.

---

## Implementation Notes

**Per-state intent** lives in §6 (helper-by-helper test states).

**Verification steps** (for B-2's plan step "Verification gate"):
- `pnpm lint` clean
- `npx tsc --noEmit` clean
- Vitest specs: all new specs pass (target ~30 specs across the 10 helpers); existing 112 passing specs continue to pass (no regression)
- Manual DB query check: after migration applies, `SELECT column_name FROM information_schema.columns WHERE table_name='enquiries' AND column_name='first_contacted_at'` returns one row
- Smoke: temporarily wire `getStaffScorecard(reportData, profile.id)` into the existing dashboard, console.log the result for a known-good DB state, sanity-check the numbers — then revert the temporary wire (NOT committed)
- Cache verification: dev console shows `revalidateTag` firing on a manual booking-mutation; subsequent reload returns fresh data

---

## Copy

Backend phase — minimal user-facing copy.

### Form labels / button text

None (no UI).

### Error messages

| Surface | Text | When |
|---|---|---|
| Migration error | (logged to Supabase MCP output; no user-facing copy) | Migration apply failure during Zone-2 confirmation |
| Stale-cache hint | (none — cache failures degrade silently to fresh fetch; no user message) | `revalidateTag` no-op |
| Type mismatch on helper input | TypeScript compile-time error; no runtime user copy | Development only |

### Empty-state text

| Helper | Empty case | Returned shape |
|---|---|---|
| `getReportInsights` | No thresholds tripped | Empty array `[]` (consumer hides stripe) |
| `getStaffScorecard` | Staff has no activity | All metric numbers = 0, `sameGenderFulfilled = 0` (consumer renders empty-state copy via tile primitives) |
| `getClientLifetimeMetrics` | Client has no bookings | `null` (consumer hides ribbon) OR `{ ltv: 0, visitCount: 0, repeatStatus: 'new', monthlyVisitsSeries: [], ... }` (consumer renders "new client" state) — **decide in plan implementation step**; recommendation: return zero-filled object so B-6 has consistent shape |
| `getNoShowRate` with zero bookings | rate=0, total=0, noShows=0, cancelled=0, lostRevenue=0 | Consumer hides delta chip when total=0 |
| `getRetentionRate` with single-visit clients only | rate=0, retainedClients=0, totalClients=N | Consumer renders "All clients are new — retention measurement needs a prior visit" hint |

### Tooltip text

N/A.

### Confirmation dialog text

N/A.

---

*End of B-2 brief. Next: B-3 brief (performance surface) — first UI consumer of the foundation + backend.*
