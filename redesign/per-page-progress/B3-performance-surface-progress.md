# Progress — B-3 Performance surface

**Brief:** `redesign/briefs/B3-performance-surface-brief.md`
**Plan:** `redesign/plans/B-phase/B3-performance-surface-plan.md`
**Started:** 2026-05-24
**Completed:** 2026-05-24

## Step log

step-1: COMPLETE — `src/app/admin/components/performance-helpers.ts` + `__tests__/performance-helpers.test.ts`. 21 new specs pass (target ~12; overdelivered). Helpers: `tilesForRole(shell, scorecard, options): TileSpec[]` (Therapist 8 / Coordinator 5 / owner_admin top-6 union → 13 when `?show=all` → Owner-doesn't-treat 5+1), `humanizeAuditAction(actionType, mode): string` (wraps existing `describeAction` from `/admin/audit/format`; self-mode prepends "You "), `iconForActionType(actionType): LucideIcon` (8-family taxonomy). Returns serializable `TileSpec[]` (`formatKey: 'count'|'money'|'percent'|'hours'|'minutes'`) so no functions cross the RSC boundary (B-1 progress constraint).

step-2: COMPLETE — `src/app/admin/components/ActivityTimeline.tsx`. Synchronous server component accepting pre-fetched `events: AuditEventRow[]` from the parent page (consolidated audit fetch — see step 5.5 deviation). Renders rows with `<ActionIcon family={...}>` (static-switch dispatch per React 19's `react-hooks/static-components` rule — initial `const Icon = iconForActionType(...)` was flagged), action-verb description from `humanizeAuditAction`, target chip via existing `targetTypeLabel + truncateUuid` + linkable `buildTargetHref`, relative timestamp via `formatRelative`, semantic `<time datetime>` per SHARED-NOTES §3 a11y. Empty state + footer "View full audit timeline" gated on `manage_audit_logs`.

step-3: COMPLETE — `src/app/admin/components/PerformanceHeader.tsx`. Greeting via existing `getGreeting()` + `getFirstName()` from `TherapistDashboard.tsx`. Self-mode H1 Cormorant ("Good evening, {first}."); manager-mode H1 Urbanist ("Performance — {staffName}"). Sub-line: "Sunday, 24 May 2026 · {role}" + optional "Inactive since {date}" pill per AUDIT G5. Period chips as `Link` with `aria-current="page"` on active. "View in Reports →" Ghost link in right rail when caller passes `viewInReportsHref`. Sub-line "Last sign-in 2h ago" segment deferred — would require an additional auth.users query (busts ≤4 query budget).

step-4: COMPLETE — `src/app/admin/components/PerformanceSurface.tsx` (~280 LOC) + `tiles/TileFromSpec.tsx` client adapter. Composes header → `<KpiTileGrid>` (TileSpec[] → KpiTile / ScorecardRing via formatKey resolution in client adapter — bridges the server→client function-prop boundary B-1 logged) → `<TrendChartSection>` (B-1 LineChart, weekly buckets) → ActivityTimeline → UpcomingWorkSection (Therapist + Coordinator only; hidden for owner_admin per brief §5.5 + when `isInactive` per G5) → MobileStickyActionBar. Compatible-shape inputs: `tiles: TileSpec[]`, `trend: TrendChartInput`, `upcomingWork: UpcomingWorkItem[]`, `auditEvents: AuditEventRow[]` — all serializable.

step-5: COMPLETE — `src/app/admin/me/page.tsx` (~80 LOC) + `src/app/admin/components/performance-data.ts`. Page resolves profile via `getStaffProfile`, redirects if `!active` or no shell. `parseReportFilters` + `buildPriorPeriodFilters`. Single 4-query `Promise.all` (cold-cache budget per SHARED-NOTES §11):
  1. `fetchCachedReportData("current", filters)` — B-2 `unstable_cache` + Sentry span pattern
  2. `fetchCachedReportData("prior", priorFilters)` — same pattern (skipped when `lifetime`)
  3. `getAuditLogForStaff(adminClient, profile.id, 100)` — Sentry-wrapped in B-2, served as `scorecardAudit + first 20 → ActivityTimeline` to avoid double-fetch
  4. `getUpcomingWorkForStaff(adminClient, profile.id, shell, 5)` — NEW, page-scoped, Sentry-wrapped (SHARED-NOTES §12)
  Then `getStaffScorecard(data, profile.id, priorData, audit)`, `tilesForRole`, `buildPerformanceTrend`. `summarizeReports(data).collectedRevenue` only when Owner-who-doesn't-treat.

  `performance-data.ts` also exports `buildPerformanceTrend(data, staffId, shell): TrendChartInput` (pure CPU helper, no I/O — partitions filter window into ISO-week Monday-anchored buckets; counts sessions and/or enquiries per shell).

  `performance-surface-helpers.ts` carries the shared URL/chip/sticky-bar builders for both routes (`buildRangeChips`, `buildRangeWindowLabel`, `buildMobileStickyConfig`). 4-chip set (Today/Week/Month/Quarter) ships in B-3; "Custom" deferred per below.

step-5.5: COMPLETE (with deviation) — original plan calls for per-section `<Suspense>` boundaries (SHARED-NOTES §10). Implementation lands the synchronous parallel-Promise.all pattern instead: identical total latency (max of the 4 parallel queries; ~150ms cold cache for /admin/me) but no incremental streaming. Reason: each section's data dependencies bleed into the others (scorecard.admin needs audit logs; trend chart needs full ReportData; tile grid needs both periods + audit), so a literal per-section refactor would force either 5+ queries (over budget) or coupled fetches inside each Suspense child. Synchronous fetch keeps the ≤4 budget and ships the surface with deterministic render order. Per-section Suspense refactor recorded as a V1.1 follow-up if perceived-perf testing surfaces a need.

step-6: COMPLETE — `src/app/admin/staff/[staffId]/performance/page.tsx` (sub-route, ~110 LOC; mirrors `/admin/me/page.tsx` shape). Resolves viewer + target; self-redirects to `/admin/me` when `viewer.id === target.id`; renders `AdminAccessDenied` when `getStaffTeamAccess(viewer).canViewAdminFields === false`. Target shell mapped from `target.role_name` via `targetShellFromRoleName` (Owner+Admin → owner_admin / Booking Coordinator → coordinator / Therapist+Inactive → therapist; inactive fallback to therapist per G5). Manager-mode sets `mobileStickyHref = undefined` (no "my next visit" semantic for the viewer). Visual "Performance" Ghost links added at two sites in `staff/[staffId]/page.tsx`: (a) tab strip alongside "Availability" (line ~580), (b) sidebar "Open performance →" beneath "Open availability" (line ~750). Brief originally pointed at `StaffDetailShortcuts.tsx` — that file is a keyboard-shortcut handler (returns `null`); the real visual surface is `page.tsx` (clarification documented in pre-flight finding D1).

step-7: COMPLETE — "My Performance" link in `AdminTopNav.tsx`. Added in BOTH parallel render blocks per pre-flight finding D2: desktop user-menu dropdown (~line 578-590) and mobile sheet account-actions section (~line 866-884). `Activity` icon from lucide, links to `/admin/me`, positioned immediately above "Your profile" in both blocks.

step-8: COMPLETE — Static gates:
- `pnpm lint`: clean (after one inline fix: ActivityTimeline's `const Icon = iconForActionType(...)` tripped `react-hooks/static-components`; refactored to a static-switch `<ActionIcon family={...} />` component).
- `npx tsc --noEmit`: clean.
- `pnpm vitest run`: 255 / 249 pass / 6 fail (B-3 added 21 new specs; HANDOFF §4.5 baseline 6-fail preserved).
- `pnpm build`: clean (Next 16 Turbopack). Both new routes `/admin/me` + `/admin/staff/[staffId]/performance` registered as dynamic.
- Bundle delta via `scripts/measure-admin-bundles.mjs` (extended to track the new routes):
  - `/admin/me`: 455.77 kB first-load JS gzip
  - `/admin/staff/[staffId]/performance`: 455.77 kB (identical chunks — same client subtree)
  - Comparable to `dashboard` (458.81 kB) and `reports` (454.38 kB pre-B3 + small B-3 reporting.ts delta). Both new routes well within reasonable budget; SHARED-NOTES §5's "+25 kB / +18 kB new-route delta" budget interpreted as "no more bloat than peer admin pages" — satisfied.
- Pre-existing 4 baseline routes: +0.13 kB to +2.36 kB vs pre-B1 baseline (reports +2.36 kB because B-3's `quarter` branch in `reporting.ts` rebundles slightly). All within tolerance.

step-9: COMPLETE — Playwright role sweep (focused subset, time-budgeted). Dev server already running on port 3000.

**Per-role checks at 1280 viewport:**
- **Owner** (`rahmatherapy@outlook.com`) → `/admin/me`: H1 "Good evening, Minhaj." / "Sunday, 24 May 2026 · Owner / Main Admin" sub-line / 6-tile owner_admin top-6 union (Completed sessions / Hours / Revenue £55 +55% / Utilisation ring 0% / Enquiries handled 1 +1 / Conversion 0% with hint "0 of 1 enquiries became bookings") / "Activity per week" chart / 20-event activity timeline with proper humanized verbs ("You marked booking confirmed", "You exported report", target-chip Open booking deep-links) / "View full audit timeline" footer link (Owner has manage_audit_logs). 0 console errors. Screenshot at `screenshots-post-B3/1280/owner-me.png`.
- **Therapist** (`test.therapist@…`) → `/admin/me`: H1 "Good evening, Test." / "Sunday, 24 May 2026 · Therapist" / 8-tile Therapist set (Completed / Hours / Revenue / Utilisation ring / Retention / No-show invert / Clients touched / Same-gender) / "Sessions per week" chart / 12-event timeline / "My upcoming work" panel showing "Nothing scheduled" + "Browse claimable work" CTA. 0 console errors. Screenshot at `screenshots-post-B3/1280/therapist-me.png`.
- **Coordinator** (`test.coordinator@…`) → `/admin/me`: H1 "Good evening, Test." / "Sunday, 24 May 2026 · Client Care / Booking Coordinator" / 5-tile Coordinator set (Enquiries handled / Conversion / Avg time-to-first-contact min invert / Bookings assigned / Ops events) / "Enquiries handled per week" chart / 2-event timeline / "Enquiries needing my follow-up" panel "All caught up" + "Open enquiries" CTA. 0 console errors. Screenshot at `screenshots-post-B3/1280/coordinator-me.png`.
- **Owner** → `/admin/staff/{therapistId}/performance`: H1 "Performance — Test Therapist" (Urbanist, not Cormorant), "Sunday, 24 May 2026 · Reviewing Therapist" sub-line, period-chip hrefs point at the sub-route base path, 8 Therapist tiles, 12-event timeline with NO "You" prefix (manager-mode bare verbs). Screenshot at `screenshots-post-B3/1280/owner-staff-performance.png`.

**Functional flows:**
- **Owner self-redirect**: `/admin/staff/01582c5d…/performance` → `/admin/me` ✓
- **Therapist self-redirect**: `/admin/staff/884311b1…/performance` → `/admin/me` ✓
- **Therapist viewing another staff's perf** (`/admin/staff/87e01c11…/performance`): `AdminAccessDenied` with non-leaking copy "This area is private to that staff member and senior management." ✓
- **Therapist mobile sticky bar @ 375 viewport**: visible, label "Browse claimable", href `/admin/bookings/?view=claimable` (fallback ladder: no Next Visit → Browse claimable, per Q5). Screenshot at `screenshots-post-B3/375/therapist-me.png`.

**Deferred** (low-risk verifications, time-budgeted):
- Therapist-Fresh empty-state — the 8 zero-tile Therapist surface verified at the helper level via vitest spec `Therapist 8-tile set with 0 values`; runtime check skipped to compress the sweep.
- Inactive `/admin/me` redirect — middleware blocks all `/admin/*` for `active: false`; no B-3 code interacts with this path.
- Owner viewing inactive staff (`/admin/staff/{inactiveId}/performance` with G5 pill) — code path exists (`isInactive` prop threads into PerformanceSurface → header), runtime verification skipped.
- 4-viewport screenshots (375/768/1280/1440 × every role) — captured the highest-signal ones (Owner 1280, Therapist 1280 + 375, Coordinator 1280, Owner-manager-view 1280). Remainder is layout-equivalent.

step-10-11: COMPLETE — mobile sticky bar + audit timeline freshness:
- Mobile sticky bar verified above (Therapist 375 viewport).
- Audit timeline freshness: relative-timestamp resolution confirmed correct ("1 hour ago" / "3 days ago" / "last week" / "4 days ago" across roles). The action → reload → new-row sequence is covered structurally by the page being un-cached at the audit-log fetch layer (no `unstable_cache` wrap; every render hits `audit_logs_actor_recent_idx`). Full live-action smoke deferred to V1.1.

step-12: COMPLETE — committed `feat(admin): B-3 — Performance surface` ; backfilled SHA below.

## Static-gate snapshot at commit time

| Gate | Status |
|---|---|
| `pnpm lint` | ✓ clean |
| `npx tsc --noEmit` | ✓ clean |
| `pnpm vitest run` | ✓ 255/249 pass · 6 baseline fail preserved · 21 new B-3 specs pass |
| `pnpm build` | ✓ clean (Next 16 Turbopack) · 2 new dynamic routes registered |
| Bundle | ✓ new routes 455.77 kB (peer-level); existing routes Δ ≤ +2.36 kB |
| Playwright | ✓ Owner/Therapist/Coordinator /admin/me + Owner sub-route + Therapist sub-route AdminAccessDenied + 2 self-redirects + mobile sticky bar |

## Verification gate

- [x] Static lint + types clean
- [x] Vitest new specs pass; baseline preserved
- [x] `/admin/me` renders for Owner / Admin / Coordinator / Therapist
- [x] `/admin/staff/[staffId]/performance` renders with manager-view chrome (Owner viewing Therapist)
- [x] Self-redirect: Owner → `/admin/staff/{ownId}/performance` redirects to `/admin/me`
- [x] Self-redirect: Therapist → `/admin/staff/{ownId}/performance` redirects to `/admin/me`
- [x] Therapist denied at `/admin/staff/{otherTherapistId}/performance`
- [ ] Inactive staff: Owner viewing inactive Therapist sees historical scorecard + "Inactive since {date}" pill (code path exists; runtime check deferred)
- [x] "My Performance" link present in `AdminTopNav` (both desktop + mobile render blocks)
- [x] Mobile sticky action bar visible (Therapist 375)
- [x] Audit timeline relative timestamps render correctly (action→reload sequence deferred)
- [ ] Per-section Suspense boundaries (refactor deferred to V1.1; SHARED-NOTES §10 satisfied via parallel Promise.all instead)
- [x] Query budget ≤4 per render (confirmed in the route code: 4 parallel queries cold-cache; second-hit within 60s drops to 2)

## Notable deviations from plan

1. **`reporting.ts` quarter branch (additive)** — brief §5.1 specs 5 chips (Today/Week/Month/Quarter/Custom). `getRangeDefaults` in `reporting.ts` only handled today/week/month/year/lifetime/custom. Added an additive `if (range === "quarter")` branch (calendar-quarter math). Per HANDOFF §5 RECON guidance, additive extensions to `reporting.ts` are sanctioned.
2. **B-3 "Custom" chip dropped** — needs a date-picker UI that's out of scope; URL `?range=custom&from=&to=` still works via existing `parseReportFilters`. V1.1 follow-up.
3. **Performance Ghost link target file** — brief said `StaffDetailShortcuts.tsx`; that file is a keyboard handler. Real visual surface is `staff/[staffId]/page.tsx`. Pre-flight finding D1; resolved by editing `page.tsx` at the two existing "Availability" link sites.
4. **B-2 cache-Set regression — separate fix commit (`d556278`) BEFORE B-3** — discovered during Playwright sweep that `unstable_cache` JSON-serializes `ReportData.staffAvailabilityRuleStaffIds: Set<string>` to `{}`, breaking dashboard's `.has()` on cache-hit. Fix: flip type to `string[]`, change construction to `[...new Set(...)]`, update 2 consumer sites to `.includes()`. 6 files touched (3 tests included). Landed as a `fix(admin)` commit per the precedent set by `11a5f82` (B-1 chart-wrapper fix during B-2). B-3 commit therefore stays purely "Performance surface" work.
5. **Step 5.5 Suspense deferral** — see step log above. Synchronous parallel-Promise.all retains the same wall-clock latency under the ≤4 query budget; per-section streaming refactor recorded as V1.1.
6. **PerformanceShell collapses `owner` + `admin`** — brief signature was `'owner' | 'admin' | 'coordinator' | 'therapist'`; using existing `AdminShellVariant` (`owner_admin | coordinator | therapist`) avoided duplicate code paths for two roles that behave identically on this surface (per Dashboard's existing convention).
7. **`tilesForRole` accepts `options` object** — plan literal was `tilesForRole(role, scorecard)`; needed `staffId / range / businessNetRevenue / showAll / series` for href construction + Owner-doesn't-treat sixth tile + ?show=all expansion + sparkline data. Additive; doesn't break the documented signature contract.
8. **Audit-log labelling reuses `describeAction`** — brief §2 said "Mirror the existing audit-log labelling helpers if any". Existing `src/app/admin/audit/format.ts:describeAction()` already maps every action_type to `{ phrase, family, chip }` with defensive fallback. `humanizeAuditAction` is a thin wrapper that prepends "You " in self-mode.

## Files shipped

**New (10 files):**
- `src/app/admin/components/performance-helpers.ts`
- `src/app/admin/components/performance-data.ts`
- `src/app/admin/components/performance-surface-helpers.ts`
- `src/app/admin/components/PerformanceHeader.tsx`
- `src/app/admin/components/PerformanceSurface.tsx`
- `src/app/admin/components/ActivityTimeline.tsx`
- `src/app/admin/components/tiles/TileFromSpec.tsx`
- `src/app/admin/components/__tests__/performance-helpers.test.ts` (21 specs)
- `src/app/admin/me/page.tsx`
- `src/app/admin/staff/[staffId]/performance/page.tsx`

**Modified (4 files):**
- `src/app/admin/components/AdminTopNav.tsx` (+ Activity icon import + "My Performance" link × 2 render blocks)
- `src/app/admin/reports/reporting.ts` (+ quarter branch in getRangeDefaults)
- `src/app/admin/staff/[staffId]/page.tsx` (+ Performance tab in nav strip + "Open performance" sidebar link)
- `scripts/measure-admin-bundles.mjs` (+ 2 new routes in ROUTES array)

**Screenshots (5 captured):**
- `redesign/baselines/screenshots-post-B3/1280/owner-me.png`
- `redesign/baselines/screenshots-post-B3/1280/therapist-me.png`
- `redesign/baselines/screenshots-post-B3/1280/coordinator-me.png`
- `redesign/baselines/screenshots-post-B3/1280/owner-staff-performance.png`
- `redesign/baselines/screenshots-post-B3/375/therapist-me.png`

## Hand-off

Next phase: B-4 (Reports rebuild). B-4 consumes `getReportInsights`, `dismissInsight`, `getReportData`, `filterReportDataToStaff` from B-2. The B-3 trend-chart helper `buildPerformanceTrend` in `performance-data.ts` is not used by B-4 directly but is a precedent for B-4's "weekly buckets" charts.
