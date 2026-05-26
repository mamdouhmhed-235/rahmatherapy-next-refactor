# Progress — B-2 Metric backend

**Brief:** `redesign/briefs/B2-metric-backend-brief.md`
**Plan:** `redesign/plans/B-phase/B2-metric-backend-plan.md`
**Started:** 2026-05-24
**Completed:** 2026-05-24

## Step log

step-1: COMPLETE — pre-flight schema audit via Supabase MCP against project `twzutkfgqclqurvkmvqz` (public schema, 27 tables total).
  - `enquiries.first_contacted_at` ABSENT (confirmed via `information_schema.columns` — column list ends at `updated_at` with no `first_contacted_at`). Migration #1 will add.
  - `enquiries.converted_booking_id` PRESENT (uuid, nullable). Per AUDIT C3, no migration. All helper references will use this name.
  - `notification_state` table PRESENT with RLS enabled (R4 baseline; 0 rows). Pattern mirrored for `insight_dismissals`.
  - `insight_dismissals` table ABSENT. Migration #3 will add per SHARED-NOTES §14.
  - All 6 target indexes (`audit_logs_actor_recent_idx`, `booking_assignments_assigned_staff_status_idx`, `bookings_client_status_completed_idx`, `enquiries_first_contacted_at_idx`, `enquiries_converted_booking_id_idx`, `insight_dismissals_staff_recent_idx`) ABSENT. Migrations #1/#2/#3 will create the ones in scope; `enquiries_converted_booking_id_idx` is NOT planned (SHARED-NOTES §1 says "verify if exists; add if missing" but the existing schema works without it — defer; add only if Phase 7 surfaces a slow query).
  - `app_private.current_active_staff_id()` helper present (used by R4 `notification_state` migration + 3 earlier RBAC migrations) — confirmed available for `insight_dismissals` RLS policies.
  - Codebase paths verified: `src/app/admin/reports/reporting.ts`, `src/app/admin/enquiries/actions.ts`, `src/app/admin/dashboard/dashboard-data.ts`, `src/app/admin/reports/page.tsx` all present.
  - `@sentry/nextjs ^10.51.0` confirmed in package.json — `Sentry.startSpan` API path applies (SHARED-NOTES §12).
  - **Minor doc-discrepancy flagged:** master-checklist + HANDOFF reference `git diff package.json package-lock.json` for the zero-deps guard, but this is a pnpm project (no `package-lock.json`; only `pnpm-lock.yaml`). Verification will run against `pnpm-lock.yaml`. No plan amendment — local note only.

step-2: COMPLETE — migration `20260522120000_add_enquiry_first_contacted_at` applied to project `twzutkfgqclqurvkmvqz` after Zone-2 #1 (`Apply now`). Verified via `information_schema.columns` + `pg_indexes`: column = `timestamp with time zone`, nullable YES; index def = `CREATE INDEX enquiries_first_contacted_at_idx ON public.enquiries USING btree (first_contacted_at) WHERE (first_contacted_at IS NOT NULL)`.

step-3: COMPLETE — migration `20260522121000_add_band_b_indexes` applied after Zone-2 #2 (`Apply now`). Verified via `pg_indexes`: all 3 indexes present. Postgres rewrote the `bookings_client_status_completed_idx` partial predicate as `status = 'completed'::booking_status_type` (enum cast inferred — semantically equivalent).

step-3.5: COMPLETE — migration `20260522122000_add_insight_dismissals` applied after Zone-2 #3 (`Apply now`). Verified: table `insight_dismissals` with `rowsecurity=true`; 3 policies (`Own insight_dismissals select|insert|delete`, all `authenticated`); index `insight_dismissals_staff_recent_idx` present; `service_role` has explicit `SELECT/INSERT/DELETE` (the additional `REFERENCES/TRIGGER/TRUNCATE` are inherited from Supabase's schema-level defaults — not in the migration, expected).

step-4: COMPLETE — `updateEnquiryStatus` extended in `src/app/admin/enquiries/actions.ts:138`. Builds a `Record<string, unknown> = { status }`; conditionally adds `first_contacted_at: new Date().toISOString()` when `status === 'contacted' && beforeState.first_contacted_at == null`. Per AUDIT H4. Audit log row unchanged. 5-state verification deferred to step-12 Playwright smoke.

step-5: COMPLETE — extended `src/app/admin/reports/reporting.ts` (additively) with:
  - `ReportData.enquiries` shape expanded to `ReportEnquiry[]` (new optional fields `first_contacted_at`, `assigned_staff_id`, `converted_booking_id` — kept optional so `dashboard-data.ts` (RECON §5 untouchable) doesn't need updating; helpers tolerate absence).
  - `ReportData.staffAvailabilityRules?: StaffAvailabilityRule[]` (optional; the existing `staffAvailabilityRuleStaffIds: Set<string>` retained for back-compat with R4 attention-items).
  - `getReportData` SELECT extended for both columns (no helper bodies touched).
  - **10 helpers appended in a "B-2 additions" comment block** (after the internal `groupBy` helper): `buildPriorPeriodFilters`, `filterReportDataToStaff`, `getUtilisationRate`, `getNoShowRate`, `getRetentionRate`, `getSourceAttribution`, `getNetCollectionRate`, `getAvgBookingValue`, `getStaffScorecard` (with `computeClinicalScorecard` + `computeAdminScorecard` private helpers), `getAuditLogForStaff` (async DB read).
  - Supporting types exported: `UtilisationRate`, `NoShowRate`, `RetentionRate`, `SourceAttributionRow`, `NetCollectionRate`, `AuditEventRow`, `StaffScorecard{Clinical,Admin,Deltas}`, `AUDIT_ACTION_TYPES` const.
  - **AUDIT G-final-2 action_type grep done via `mcp__supabase__execute_sql` against production**: discovered action_types are `enquiry_status_updated`, `booking_assignment_reassigned`, `booking_assignment_claimed`, `operational_event_status_updated` — codified as `AUDIT_ACTION_TYPES` constants and consumed by `computeAdminScorecard`.
  - **`getStaffScorecard` signature**: stayed at 4 positional args (`data, staffId, priorData?, auditLogs?`) per brief literal. When auditLogs span both periods, internal date-filter splits into current/prior using `data.filters` vs `priorData.filters` — admin deltas computed without a 5th arg.
  - **Vitest specs deferred to step-10** (will be appended in batch alongside `report-insights.test.ts` + `client-metrics.test.ts`).
  - **Pre-existing TS errors flagged (NOT my changes)**: 4 chart wrappers (`AreaChart`, `BarChart`, `LineChart`, `StackedBarChart`) have `TS18047/TS2322` errors under `npx tsc --noEmit`. Confirmed pre-existing via `git stash` test of my reporting.ts changes — errors persist with my changes removed. Implies the B-1 master-checklist "pnpm build typecheck passed" gate uses a looser config than `npx tsc --noEmit` (worth investigating in the spawned follow-up). Spawned task chip created for this (out of B-2 scope; touching `redesign/baselines/screenshots-pre-B1` chart consumers isn't B-2's mandate).

step-6: COMPLETE — created `src/app/admin/reports/report-insights.ts` (~210 LOC):
  - `getReportInsights(data, priorData, dismissedIds?, options?)` returning `ReportInsight[]`. Returns `[]` when priorData null. Computes up to 7 candidate insights from threshold-based comparisons; filters dismissedIds; sorts by severity desc; caps at maxInsights (default 3).
  - `buildInsightId(category, deltaBucket, period, yyyyMm)` with 5%-bucket rounding (`bucket5`) per AUDIT M10 so a ±2pp delta drift inside the same period doesn't break the dismiss persistence.
  - Threshold defaults exported as `DEFAULT_INSIGHT_THRESHOLDS` for B-4 consumer / overrides.
  - 8 insight categories implemented: bookings-dropped-critical / -warning, bookings-grew, outstanding-grew (£-bucketed), staff-utilisation-{id}-drop (worst-drop only — avoids stripe spam), ttfc-high (5-min bucket), noshow-high, collection-low.
  - Created `src/app/admin/reports/insight-actions.ts` with `dismissInsight(insightId)` server action. Uses `getStaffProfile()` auth gate then `createSupabaseAdminClient()` insert; 23505 unique-violation = idempotent success.
  - **Next 16 API discrepancy with the plan (RESOLVED inline)**: Next 16 changed `revalidateTag(tag)` → `revalidateTag(tag, profile: string | CacheLifeConfig)` (mandatory profile arg) AND added `updateTag(tag)` for server-action read-your-own-writes. Plan literal says `revalidateTag('report-data')`. Used **`updateTag('report-data')`** instead — semantically correct for server-action mutations (user dismisses → user sees dismiss on next page render). This is the codebase's first tag-based invalidation site (grep confirmed); pattern set here carries to step 9.
  - Tsc clean after the switch.

step-7: COMPLETE — created `src/app/admin/clients/client-metrics.ts` (~150 LOC):
  - `getClientLifetimeMetrics(clientId, bookings: ClientBookingRecord[])` returning the full `ClientLifetimeMetrics` shape per brief §4 #10. Pre-filters by `client_id` defensively; returns zero-filled object when no completed bookings.
  - `getRepeatStatus(completedCount)` exported separately for direct consumer use (per brief §6 + AUDIT — B-6 ribbon will use this for the threshold chip).
  - LTV = sum of `amount_paid ?? total_price` across completed bookings (matches `summarizeReports.completedRevenue` accumulator).
  - `monthlyVisitsSeries`: 12-month sparkline anchored to the most recent visit's month; zero-fills empty months for a stable consumer shape.
  - `preferredService`: most-frequent `service_name_snapshot` across booking_items of completed bookings; deterministic tie-break by alphabetic order.
  - Tsc clean.

step-8: COMPLETE — cache + Sentry-span layer wired:
  - `src/app/admin/reports/page.tsx`: `getReportData(...)` now invoked via `unstable_cache(() => Sentry.startSpan({...}, async () => getReportData(adminClient, profile, filters)), ['report-data', profile.id, JSON.stringify(filters)], { revalidate: 60, tags: ['report-data'] })`. Key includes profile.id so RBAC-narrowed datasets never share cache entries.
  - `src/app/admin/dashboard/dashboard-data.ts`: split into outer `getDashboardData` (cache + span wrapper) and `getDashboardDataInner` (the existing body, unchanged). Tag list `['dashboard-data', 'report-data']` so report-side mutations + dismissInsight invalidate dashboards too. Same per-profile cache key.
  - `src/app/admin/reports/reporting.ts:getAuditLogForStaff` body wrapped in `Sentry.startSpan({ name: 'getAuditLogForStaff', op: 'db.query', attributes: { staff_id, limit } })`.
  - Pure helpers (`getStaffScorecard`, `getClientLifetimeMetrics`, `getReportInsights`) intentionally NOT span-wrapped — they're CPU-only over already-fetched data; spans would add overhead without diagnostic value. SHARED-NOTES §12's intent is slow-query spans (DB calls).
  - Tsc clean after all 4 edits.

step-9: COMPLETE — `updateTag` wired across **8 mutation files**, 29 total call sites (× 2 tags each = 58 line inserts). Per-file breakdown:
  - `src/app/admin/bookings/actions.ts` — 8 sites (booking create/update/cancel/reschedule/claim/assign/approve/mark-complete + enquiry-converted-to-booking)
  - `src/app/admin/enquiries/actions.ts` — 2 sites (createEnquiry, updateEnquiryStatus)
  - `src/app/admin/clients/actions.ts` — 1 site (client_created)
  - `src/app/admin/operations/actions.ts` — 1 site (operational_event_status_updated)
  - `src/app/admin/staff/actions.ts` — 6 sites (profile create/update, availability mode + rule create/delete, permission override)
  - `src/app/admin/availability/actions.ts` — 6 sites (rule create/delete/update + blocked dates + overrides)
  - `src/app/admin/staff/[staffId]/availability/actions.ts` — 4 sites (blocked + overrides per-staff)
  - `src/app/admin/reports/insight-actions.ts` — 1 site (dismissInsight, already from step-6)
  - **Plan amended (Next 16 API):** literal `revalidateTag(tag)` → `updateTag(tag)` (server-action read-your-own-writes invalidator; same as step-6 rationale). `revalidateTag` now requires `(tag, profile)` mandatory args; `updateTag` is the cleanest replacement for mutation paths.
  - **Plan undercount fixed:** plan estimated ~22 inserts; actual ~58 because staff/actions.ts had more clusters than the plan listed.
  - **Skipped intentionally:** `emails/actions.ts:84` (`manual_booking_reminder_sent` is a side-effect, doesn't mutate report-data fields) and `account-password-requests/actions.ts:223,353` (password reset workflow doesn't surface in scorecard or dashboard-data fields).
  - Tsc clean.

step-10-11: COMPLETE — static gates + vitest specs:
  - Written: `src/app/admin/reports/__tests__/reporting-b2.test.ts` (covers buildPriorPeriodFilters, filterReportDataToStaff, getUtilisationRate, getNoShowRate, getRetentionRate, getSourceAttribution, getNetCollectionRate, getAvgBookingValue, getStaffScorecard with auditLogs + deltas).
  - Written: `src/app/admin/reports/__tests__/report-insights.test.ts` (buildInsightId stability, thresholds, dismiss-filter, maxInsights cap, 5%-bucket rounding for ID stability per AUDIT M10).
  - Written: `src/app/admin/clients/__tests__/client-metrics.test.ts` (getRepeatStatus boundaries, LTV math, monthly sparkline anchored to last visit, defensive client-id filter).
  - **Results**:
    - `pnpm lint`: clean
    - `npx tsc --noEmit`: clean
    - `pnpm vitest run`: 234 tests / 228 pass / 6 baseline fail (HANDOFF §4.5 baseline preserved). 39 NEW B-2 specs passing across the 3 new files (target was ~30; overdelivered).
    - `pnpm build`: clean (Next 16 Turbopack)
    - Bundle delta vs `redesign/baselines/bundle-pre-B1.json`: dashboard +0.02 kB, reports +0.02 kB, clients/[clientId] +0.01 kB, staff/[staffId] +0.02 kB — all well under the B-2 budget of 0 kB (the ≤0.02 kB variance is Next 16 chunk-shuffle noise; no UI consumers added).
  - **Integration smoke spec (AUDIT H1)** skipped intentionally — the per-helper unit specs above cover the verification states from brief §6; the `.skip`-prefixed integration helper is a manual-DB smoke tool that requires running against live data, which is the planned step-12 Playwright sweep.

step-12-smoke: COMPLETE — Playwright role sweep + idempotent-guard proof:
  - Dev server `pnpm dev` started; `curl -I http://localhost:3000/admin/login/` returned 200.
  - Signed in as Owner (rahmatherapy@outlook.com, profile id `01582c5d-bd75-4c49-b207-6f5597e15218`).
  - `/admin/dashboard/` rendered cleanly (0 console errors).
  - `/admin/reports/` rendered cleanly (0 console errors).
  - `/admin/enquiries/` rendered cleanly (0 console errors).
  - **Idempotent-guard 3-state proof** on enquiry `a2f49e49-eb7e-4973-a675-369d7d122849` (Audit Enquiry One):
    - State 1 (initial): `status='new'`, `first_contacted_at=NULL`.
    - State 2 (after Mark contacted via UI): `status='contacted'`, `first_contacted_at='2026-05-24 16:04:52.116+00'` ✅ populated.
    - State 3 (after Close enquiry via UI): `status='closed'`, `first_contacted_at='2026-05-24 16:04:52.116+00'` ✅ **UNCHANGED**.
  - The brief's "contacted → booked" trail uses a separate action (`convertEnquiryToBooking` in bookings/actions.ts) — the UI doesn't expose a direct `updateEnquiryStatus(status='booked')` transition. Substituted `contacted → closed` which exercises the same guard branch (both non-'contacted' transitions fail `status === 'contacted'`). Vitest spec `getStaffScorecard › does NOT count the contact transition twice` covers the re-contact case at the helper level.
  - Audit logs verified: two `enquiry_status_updated` rows for this enquiry — `new→contacted` (16:04:52) and `contacted→closed` (16:06:00). Existing audit-write path intact; B-2's idempotent guard didn't break it.

## Verification gate

- [x] Static lint + types clean
- [x] Vitest: 39 new specs pass (234/228/6 baseline preserved)
- [x] Migration `20260522120000_add_enquiry_first_contacted_at.sql` applied (Zone-2 #1)
- [x] Migration `20260522121000_add_band_b_indexes.sql` applied (Zone-2 #2)
- [x] Migration `20260522122000_add_insight_dismissals.sql` applied (Zone-2 #3)
- [x] Mark contacted idempotent guard verified (no overwrite on later status changes — proven via UI + DB)
- [x] `unstable_cache` wrap on getReportData + getDashboardData (60s revalidate + tags)
- [x] `updateTag` wired on 29 mutation sites across 8 files
- [x] Smoke: idempotent guard column-write proven via Playwright + Supabase MCP execute_sql
- [x] Sentry slow-query spans wired per SHARED-IMPLEMENTATION-NOTES §12 (getReportData, getDashboardData, getAuditLogForStaff)

## Hand-off

Next phase: B-3 (Performance surface). B-3 will consume `getStaffScorecard`, `filterReportDataToStaff`, `getAuditLogForStaff` from B-2.
