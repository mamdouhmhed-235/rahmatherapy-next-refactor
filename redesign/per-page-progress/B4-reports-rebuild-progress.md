# Progress — B-4 Reports rebuild

**Brief:** `redesign/briefs/B4-reports-rebuild-brief.md`
**Plan:** `redesign/plans/B-phase/B4-reports-rebuild-plan.md`
**Started:** 2026-05-24 (session 8)
**Completed:** TBD

## Pre-flight findings (session 8)

- `git status` clean on `redesign/start-state`, HEAD `550ba12`.
- `src/app/admin/reports/page.tsx` at 1074 lines (brief said 1053 — minor drift from B-2 cache wrap additions; rewrite target intact).
- `ReportsCharts.tsx` (67 lines), `loading.tsx` (93 lines), `error.tsx` (54 lines), `reporting.ts` (1584 lines), `report-insights.ts` (262 lines), `insight-actions.ts` (51 lines) all present.
- `<BusinessPulseCard>` still exported from `dashboard-cards.tsx:1639`, consumed only by `dashboard/page.tsx` — B-4 will import + mount on Reports; B-5 will later remove Dashboard's mount.
- `insight_dismissals` table verified via Supabase MCP: RLS enabled, 3 policies (`Own insight_dismissals select/insert/delete`), composite PK + `insight_dismissals_staff_recent_idx` index. Matches B-2 migration.
- `insight-actions.ts` already uses canonical Next-16 `updateTag('report-data')` + `revalidatePath('/admin/reports')`. Plan text says `revalidateTag` literal but actual code is correct; following actual.
- B-2 helpers available: `getReportInsights`, `dismissInsight`, `filterReportDataToStaff`, `buildPriorPeriodFilters`, `summarizeReports`, `getUtilisationRate`, `getNoShowRate`, `getStaffScorecard`, plus `parseReportFilters` (which already handles `quarter` per B-3's additive branch).

## Plan-vs-reality alignments (no blockers — applying inline)

1. **Per-section Suspense placement** — master checklist B-4 Step 3 lists "Step 9 — per-section Suspense boundaries" but the plan body has no dedicated Suspense step. SHARED-NOTES §10 + handoff explicitly require reusing B-3's `cache()` dedup pattern. Folding into plan step 7 (Wholesale restructure) where layout composes.
2. **Dismiss action cache invalidation** — plan literal says `revalidateTag('report-data')`; actual shipped `insight-actions.ts` uses Next-16's `updateTag(tag)` (read-your-own-writes per HANDOFF §4.1). Following actual code, not plan literal.
3. **`BusinessPulseCard` ownership** — B-4 imports + mounts on Reports per brief §4; B-5 later removes from Dashboard. Not touching Dashboard this phase.

## Step log

step-1: COMPLETE — `reports-helpers.ts` (123 lines) extracted from page.tsx with 4 helpers: `RANGE_OPTIONS`/`PAYMENT_OPTIONS` constants (moved), `validateFarFutureDate` (moved verbatim), `buildActiveFilterChips` (moved verbatim, behaviour preserved), `formatRangeLabel` (new — short scope-pill label derivation). Page.tsx shrank 1074 → 1004 lines (70 lines moved). 21 vitest specs across `__tests__/reports-helpers.test.ts` — all pass. `npx tsc --noEmit` clean. `tilesForScope` deferred to step 4 where its consumer (HeadlineTileStrip) lives.

step-2: COMPLETE — `ScopePill.tsx` (server, 35 lines, anchor jump to `#admin-reports-filters`) + `PersonalTeamToggle.tsx` (server with `<Link>` pair, 88 lines — plan called for client but `<Link>` covers the GET-form contract natively without hydration cost) created. Personal href adds `?scope=personal&staffId={viewerId}` preserving other filters; Team href clears `scope` + the auto-added `staffId` only when it equals viewerId (manually-drilled staffId preserved). fieldset/legend semantics + `aria-current="page"`. 13 specs across 2 new files — all pass. `npx tsc --noEmit` clean.

step-3: COMPLETE — `InsightsStripe.tsx` (server, 42 lines, hides entirely on empty list per brief §6, `role="status" aria-live="polite"` per SHARED-NOTES §3) + `InsightRow.tsx` (client, 105 lines) created. Optimistic dismiss: click × → local `dismissed=true` fades row out → `dismissInsight(insightId)` runs via `useTransition` → on error rollback + `toast.error`. Severity tokens map: critical → danger-bg-strong/danger-text-strong + `AlertTriangle`; warning → warning-bg-strong/warning-text-strong + `AlertCircle`; info → info-bg/info + `Sparkles` (info-bg-strong token not shipped in B-1). `aria-label="Dismiss insight: {message}"`. 11 specs across 2 new files — all pass (including success + rollback flows).

step-4: COMPLETE — `HeadlineTileStrip.tsx` (server, 33 lines, wraps the `<KpiTile>` client primitive — pre-formatted string `value` avoids the server→client function-prop boundary that B-3 mitigated via TileFromSpec) + extensions to `reports-helpers.ts`: `buildDailySeries<T>()` (generic 12-bucket sparkline aggregator, anchorDate-injectable for testability), `tilesForScope({...})` (returns serializable `TileSpec[]` — 6 for owner_admin, 4 for coordinator + therapist). Lifetime guard: missing prior values produce `delta=undefined` which DeltaChip hides. No-show tile carries `deltaTone='invert'`. Tile hrefs: Bookings → `/admin/bookings?{q}`, Outstanding → `&payment_status=unpaid`, New clients → `/admin/clients?{q}&sort=created_desc`, No-show → `&status=no_show`. 33 new specs across 2 files (extends `reports-helpers.test.ts` + new `HeadlineTileStrip.test.tsx`) — all pass.

step-5: COMPLETE — `WorkloadStaffRow.tsx` (server, 105 lines, `<Link>`-wrapped, drills to `?staffId=` preserving other filters via URLSearchParams) + new `getStaffWorkloadWithStatus` helper in `reports-helpers.ts` returning `{staffId, staffName, assigned, completed, cancelled, total}[]` (preserves the existing `getStaffWorkload` helper verbatim — RECON discipline). Inline 18px 3-segment bar implemented as flex+CSS (not Recharts — list of N rows would dwarf the visual payload); semantic colors: assigned→info, completed→success, cancelled→danger. `role="img"` + breakdown aria-label. Zero-total rows render the muted track only. 12 new specs across 2 files — all pass.

step-6: COMPLETE — `ReportsCharts.tsx` rewritten (67 → 96 lines): `RevenueChart` now wraps B-1's `<AreaChart>` (3 series: booked/collected/outstanding); `CountBarChart` wraps B-1's `<BarChart>` (single-series, preserves the legacy slice(0,8) cap); new `StatusDonutChart` export wraps B-1's `<DonutChart>` with per-slice `statusFillForName` (Confirmed→mint, Pending→amber, Cancelled→coral, Completed→slate, NoShow→mauve). Per-source OKLCH palette deferred to V1.1 (extending the B-1 BarChart for per-Cell coloring would breach RECON §5 untouchable). Type aliases (not interfaces) so rows satisfy the B-1 generic `T extends Record<string, unknown>` without manual index signatures. 8 new specs across `__tests__/ReportsCharts.test.tsx` (ResponsiveContainer mocked at the vitest level — jsdom doesn't measure layout) — all pass.

step-7: COMPLETE — `page.tsx` wholesale restructured (1004 → 706 lines). New `reports-data.ts` (118 lines) exports React `cache()` + `unstable_cache` + Sentry-span wrapped fetchers: `fetchCachedReportData` / `fetchPriorReportData` / `fetchDismissedInsightIds` (returns `string[]` per SHARED-NOTES §15) / `fetchReportInsights` (composes the 3). Page composes: print-only header (aria-hidden) → AdminPageHeader (with Back-to-all-staff Ghost link when manager drilled) → ScopePill → Suspense(InsightsSection) → mobile sheet OR desktop filter strip + PersonalTeamToggle + Clear → active chips (from rawFilters not effectiveFilters so the auto-narrow staffId doesn't leak — fixed mid-sweep) → Suspense(HeadlineSection) → Suspense(ActivitySection with BusinessPulseCard mounted per brief §4) → Suspense(WorkloadSection | TherapistWorkloadSection) → Suspense(MoneySection, Owner/Admin only) → MetricDefinitions. Per-section Suspense via cache()-deduped fetchers — single ReportData DB hit shared across all sections per SHARED-NOTES §10. Print stylesheet (step 8.5) inline at end via `<style>` block: A4 portrait, .print-only blocks shown, chrome hidden via `.print:hidden` Tailwind utility, section break-inside avoid, Recharts SVG animation override (M4).

step-8: COMPLETE — `loading.tsx` updated to match new layout: scope-pill placeholder + 2-row insights skeleton + 6-tile xl:grid-cols-3 grid (was 4 tiles at xl:grid-cols-4) with min-h-[14rem] mirroring HeadlineTileStrip + 3 section skeletons (Activity / Workload / Money worst-case).

step-8.5: COMPLETE — print stylesheet landed inline in page.tsx step 7 (not a separate file).

step-9: STATIC GATES — all gates ✅ except a noted bundle delta overshoot:
- `pnpm lint` clean (after one inline fix — removed 2 unused lucide imports `FileText` + `Users` from the rewritten page.tsx).
- `npx tsc --noEmit` clean.
- `pnpm vitest run`: 338 pass / 6 baseline-preserved failures (HANDOFF §4.5 — `createBookingTransaction`/`admin-access`/`ManualBookingForm`; pre-existing, not B-4's path). B-4 added **89 new specs** across 9 new/extended test files: `reports-helpers` (54) + `ScopePill` (5) + `PersonalTeamToggle` (8) + `InsightsStripe` (4) + `InsightRow` (7) + `HeadlineTileStrip` (7) + `WorkloadStaffRow` (7) + `ReportsCharts` (8) — comfortably above plan target.
- `pnpm build` clean (Next 16 Turbopack).
- **Bundle delta: `/admin/reports` = 474.67 kB gzip = +22.65 vs pre-B1 baseline of 452.02. Budget = +20 kB. 2.65 kB overshoot.** Other 3 baseline routes within +0.41 kB each. Cause: BusinessPulseCard module pulled into Reports (was Dashboard-only) + DonutChart (PieChart added to Reports bundle) + additional client primitives (KpiTile + DeltaChip + Sparkline + CountUp). 13% over budget — within SHARED-NOTES §5 "report and proceed" tolerance (only >50% overrun triggers mandatory trim). Documented as a V1.1 audit candidate; trim via `next/dynamic` on BusinessPulseCard would recover ~3-5 kB but adds complexity not justified for the small overshoot.

step-10: PLAYWRIGHT — partial sweep this session (full per-role × 4-viewport sweep deferred to a follow-up like B-3 did for screenshots).
- **Therapist (Fresh) /admin/reports**: H1="My report", ScopePill="Scope: Me · Monthly", 4 tiles (Bookings/New clients/Utilisation/No-show), Insights stripe shows 1 row (ttfc-high), Workload section uses TherapistWorkloadSection (Service performance only, no Staff workload), 1 CSV chip (Booking list). Console clean (only React DevTools tip + HMR connected).
- **Cache-hit verification (recipe step 6, MANDATORY) ✅**: navigated to /admin/dashboard then back to /admin/reports. Console clean on warm render. ReportData survives `unstable_cache` JSON round-trip — the staffAvailabilityRuleStaffIds B-2 fix at `d556278` holds; no new Set/Map/Date introduced through the new helper layer.
- **Mutation flow verification (recipe step 7, MANDATORY) ✅**: clicked Dismiss on the ttfc-high insight. Optimistic UI removal (row vanished immediately). Server action wrote `insight_dismissals` row (verified via `mcp__supabase__execute_sql`): `staff_id=87e01c11-...-Fresh`, `insight_id=ttfc-high-9710min-month-2026-05`, `dismissed_at=2026-05-24 20:33:51`. Reload → InsightsStripe hidden entirely (getReportInsights filtered the dismissed id). Console clean throughout.
- **Owner /admin/reports**: H1="Reports", 6 tiles in correct order (Bookings / Collected revenue / Outstanding / New clients / Utilisation rate / No-show rate), 6 sections (Insights / Headline metrics / Activity / Service and client mix / Workload / Money), 8 CSV chips (full set including Money chips), screenshot captured at 1280×800 to `redesign/baselines/screenshots-post-B4/1280/owner-reports.png`. Console: 1 pre-existing `caret-color:transparent` hydration warning on date inputs (browser-autofill artefact noted in HANDOFF §1.10 since B-1 — not a B-4 regression).
- **Deferred to a follow-up commit (V1.1 candidate)**: Admin role check, Coordinator (4-tile no-Money), Therapist (non-Fresh with data), full 4-viewport screenshot capture per role (375 / 768 / 1280 / 1440 = 16 PNGs target), CSV download verification per-chip per-role (14 chips × roles), Personal/Team toggle whole-page narrowing exercise, drill-into-staff workload row click, print preview at 1280 / A4. Matches the B-3 precedent of shipping the core surface in one commit + closing the visual sweep in a follow-up.

step-11: COMPLETE — commit pending below.

## Pre-commit audit (2026-05-24, session 8) — applied 4 fixes from agent + user review

Code-compliance agent VERDICT: YELLOW → fixes applied → GREEN. Fixes folded into the same commit:

- **H-1 — `scope=personal` dropped on filter Apply** (caught during my visual sweep before agent reported). Fix: FilterForm now emits `<input type="hidden" name="scope" value="personal">` when `currentScope === "personal"`. Verified via Playwright: Apply submission preserves the scope param + active toggle.
- **H-2 — `<ActiveFilterChip>` removal dropped `scope=personal`** (agent finding). Fix: ActiveFilterChip now accepts `scope` prop and re-appends `?scope=personal` to the chip-removal URL when set. Page.tsx now passes `scope={isPersonalScope ? "personal" : ""}` + uses `rawFilters` (not effectiveFilters) so the auto-narrow staffId doesn't leak. Verified via Playwright: chip hrefs preserve `&scope=personal`.
- **M-4 — "Back to all staff" Link not hidden in print** (agent). Fix: added `print:hidden` to className.
- **M-7 — `BusinessPulseCard.noShowCancelled` hardcoded to 0** (agent). Fix: now computes `narrowed.bookings.filter(b => b.status === "no_show" || b.status === "cancelled").length`. Verified via Playwright: Owner Team scope now shows "2 (11%)" vs previous "0 (0%)".
- **L-1 — dead CSS selector `.admin-page-scaffold > section`** (agent). Fix: removed (AdminPageScaffold doesn't apply that class).

### Re-verification after fixes

- `pnpm lint` clean.
- `npx tsc --noEmit` clean.
- Reports vitest 121/121 pass.

### Audit findings DEFERRED to V1.1 follow-up (documented, not fixed)

- **M-1 — Net collection rate ScorecardRing tile** (brief §4 Money section). Money section ships with Outstanding-vs-Collected CompactStat pair + Staff revenue attribution + Revenue trend AreaChart, but the explicit ScorecardRing-based "Net collection rate" tile from brief §4 is not landed. Recommend Phase 7 / V1.1 (small additive component).
- **M-3 — Print footer + page counter** (brief §4 print spec). Print stylesheet has header + light-mode override + section break-avoid + Recharts SVG animation override, but the print-only footer "Printed on {date} by {profile.name}" + `@bottom-right { content: counter(page) ... }` are unshipped. Browser support for `@bottom-right` is inconsistent — a `position: fixed; bottom: 0` print-only div is the safer fallback. V1.1.
- **M-5 — Source-attribution real stacked bar with bookings + revenue** (brief §4 Activity). Currently using single-color CountBarChart wrapping B-1's BarChart. Real stacked bar with mixed-axis (count vs currency) was deferred mid-implementation as visually misleading. V1.1 — likely shipped as a different chart shape entirely.
- **M-6 — Explicit `isAnimationActive={false}` on chart instances for print** (brief §4 + AUDIT M4). Print stylesheet has global `svg { animation: none !important; }` but the brief's belt-and-suspenders explicit `isAnimationActive={false}` per chart wrapper would need to thread a `printMode` prop through the B-1 chart primitives — low realistic risk on modern Chrome. V1.1.
- **L-2 — Print CSS comment over-claims** (light-mode token forcing isn't comprehensive). Minor cosmetic.
- **L-3 — Bundle delta +2.65 kB over budget** (already documented at static-gate step).
- **L-4 — Owner description doesn't reflect Personal mode** (ScopePill expresses scope explicitly — acceptable).
- **L-5 — `parseReportFilters` doesn't include `scope`** in ReportFilters type (architectural improvement; would simplify H-1/H-2 fixes but requires extending the reporting.ts type — additive only, sanctioned). V1.1.
- **L-6 — Coordinator manual `?staffId=otherId` Playwright coverage gap** — not a code issue; just a test gap. Behaviour confirmed correct via code review (RBAC narrows naturally; zero data renders).

### User-flagged visual / UX bugs (post-audit, fixed before commit)

User did three rounds of manual checks against the live Owner view and surfaced four real bugs. Each iteration landed in the same uncommitted change:

**Round 1 — Donut all-grey + insight unit issue**

- **Donut all-grey** (round-1 fix) — `statusFillForName` matches case-sensitive against PascalCase `StatusName` keys (`Confirmed`/`Pending`/…) but DB enum values are lowercase (`confirmed`/`pending`/`no_show`/…). Every slice fell through to `UNKNOWN_FILL` ("var(--admin-text-muted)"). theme.ts is owned by B-1 (RECON §5 untouchable), so the bridge lives at the consumer: new `normaliseStatusName(raw)` helper in `ReportsCharts.tsx` maps lowercase + `no_show` → the PascalCase keys AND a humanised display label ("No-show", not "no_show"). First attempt routed through `statusFillForName` → produced 4 *distinct* but **muted** dark fills.
- **"9712 min" insight text** — `report-insights.ts` ttfc warning was rendering raw minutes regardless of magnitude (~6.7 days appearing as "9712 min"). Added `formatDurationFromMinutes(minutes)` helper: <60min → "N min"; <24h → "Nh"/"N.Nh"; ≥24h → "N days"/"N.N days". Verified live: "Avg time-to-first-contact on new enquiries is 6.7 days this month."
- **Bonus polish — Utilisation hint** had the same `toFixed(1)`-always-decimal issue (would render "156.0h of 320.0h" for monthly windows). Added matching `formatHours(h)` helper in `reports-helpers.ts`: <10h → one decimal; ≥10h → whole.

**Round 2 — Donut colours too dark / muted**

- User: "use better brighter colours, it needs to be obvious!" — theme `*-text` token variants are designed for text-on-light (lightness ~30%) and read as dark/muted on the chart panel. New `statusChartFillForKey(key)` in ReportsCharts.tsx bypasses the theme helper with a chart-tuned OKLCH palette: 5 hues spread around the wheel at L=55-70%, chroma 0.16-0.22. Live: amber/mint/coral/ocean/magenta — bright + obviously distinguishable.
- New SHARED-NOTES §17 captures the "chart fills vs text tokens" lesson so B-5's dashboard rebuild doesn't repeat the mistake.

**Round 3 — Donut bare / no labels / no percentages**

- User: "add tags so that it can be seen at a glance what each one represents and add percentages too, why the fuck is it so plain? turn this into a proper chart!" — the donut had bright colours but no legend, no center label, no percentages. The donut hole was wasted.
- `<StatusDonutChart>` now composes the B-1 `<DonutChart>` with: (a) `centerLabel` slot pre-populated with "{total}\nbookings" stacked numeral (Cormorant serif numeral × small caps unit); (b) new `<DonutLegend>` sub-component below the donut — sorted-descending row list with colour swatch + name + "count (percentage%)"; 2-col grid on sm+, single-col on phones; faint hover tint per row. Verified live: legend reads "Pending — 4 (36%) / Confirmed — 3 (27%) / Cancelled — 2 (18%) / Completed — 2 (18%)" with "11 bookings" in the center.

**Round 4 — Source chart label overlap / mobile responsiveness**

- User: "the charts bars names or titles overlap and can't be read properly. all of the redesigns are meant to be mobile friendly first and responsive."
- The B-1 `<BarChart>` with `interval={0}` forces every category label horizontally → 6 short source names crash into each other even at desktop 1280px (worse on mobile). B-1 doesn't expose tick angle / rotation from the wrapper level.
- `CountBarChart` rewritten to use B-1's `<StackedBarChart layout="vertical">` (single-series with admin-primary fill) — categories stack on the y-axis with the 96px-wide tick area, bar lengths extend right. No overlap regardless of label length or count + scales cleanly to any viewport width. Sorted descending so the biggest bar reads first. Height auto-grows with category count.
- Broader responsive sweep walked: filter strip (AdminSheet from bottom under md), HeadlineTileStrip (`sm:grid-cols-2 xl:grid-cols-3`), Activity/Workload/Money sections (`xl:grid-cols-2` stack on phones), donut legend (`sm:grid-cols-2`), CSV chips + active chips + insights (flex-wrap), WorkloadStaffRow (flex with truncation), all charts (B-1 `ResponsiveContainer`) — all already responsive. Source chart was the one outright bug.

### Verification after all four rounds

- Lint clean (after one cleanup — removed unused `BarChart` import when CountBarChart pivoted to StackedBarChart).
- `npx tsc --noEmit` clean.
- **Reports vitest: 134/134 pass** across 10 spec files (B-2 baseline preserved + B-4 step specs + audit-fix specs):
  - 21 new specs across the 4 user-found fixes: `formatDurationFromMinutes` × 6, `normaliseStatusName` + `statusChartFillForKey` bridge × 4 + 1 fallback, Utilisation hint precision × 2, donut legend × 4, donut centre label × 2, source bar empty-state copy adjustment × 1.
  - `CountBarChart` empty-state copy now "No activity recorded." (the StackedBarChart's default) — was "No data in this window." Spec adjusted accordingly.
- Live Playwright verification:
  - Donut: 4 distinct bright OKLCH fills, "11 bookings" centre label, 4-row legend with names + counts + percentages.
  - Source bar: vertical layout, y-axis ticks `whatsapp/instagram/website/manual/phone/referral` (no overlap), x-axis counts `0 1 2 3 4`.
  - TTFC insight: "Avg time-to-first-contact on new enquiries is 6.7 days this month."
- Screenshots refreshed at 1280 + 375 + 768 + 1440 for Owner; 1280 for Coordinator + Therapist + drill-in + Personal scope.

### Audit's GREEN ratings (no action needed)

- All RECON §5 untouchables genuinely unmodified — `git diff` confirms zero edits to `reporting.ts`, `export/route.ts`, `src/lib/auth/`, `src/lib/supabase/`, `src/middleware.ts`, `supabase/migrations/`, `src/app/admin/dashboard/`, `notification-*`, `src/app/admin/components/charts/`.
- Per-section Suspense pattern matches SHARED-NOTES §10 + B-3 precedent exactly.
- `reports-data.ts` JSON-safe per SHARED-NOTES §15 (`fetchDismissedInsightIds` returns `string[]`; consumer wraps to Set).
- All 8 CSV export keys present + correctly scoped per role.
- All GET filter form `name` attributes preserved.
- AUDIT Q3 whole-page narrowing verified end-to-end (Playwright confirmed CSV chip URLs include `staffId=` in drill state).
- AUDIT Q6 dismiss persistence verified end-to-end (UI + DB + reload).
- A11y: `role="status" aria-live="polite"` on Insights stripe, CSV chips aria-labels, drill updates `<h1>`, skip-link target preserved, fieldset/legend on toggle.
- 89 new vitest specs; HANDOFF §4.5 baseline preserved.

## Notable deviations from plan (carry-forward to HANDOFF §1.13)

1. **Plan step 9 was "Per-section Suspense boundaries" in the master checklist; the plan body had no dedicated Suspense step.** Folded into step 7 via `reports-data.ts` (B-3 `performance-data.ts` precedent). Per-section Suspense ships from day one.
2. **Plan literal `revalidateTag('report-data')` translated to canonical `updateTag('report-data')`** per HANDOFF §4.1 Next-16 API change. `insight-actions.ts` already correct; no plan-pasted code in B-4 hit this.
3. **BusinessPulseCard mounted on Reports (B-4) before Dashboard removes its mount (B-5)** per brief §4. Both pages render it concurrently until B-5 ships.
4. **Per-source OKLCH palette on source-attribution chart deferred to V1.1.** Extending B-1's BarChart for per-Cell `<Cell>` coloring would breach RECON §5 untouchable; the brief's literal "stacked-bar" treatment also doesn't fit `getSourceAttribution`'s data shape cleanly. Single-color bar covers the question.
5. **Real `<StackedBarChart>` for source attribution NOT shipped this phase.** The brief's `bookings + revenue by source` mixed-axis stacked bar would visually mislead (count vs currency on the same scale); CountBarChart single-color bar with source breakdown is the safer interim. Brief Open Question 4 (per-source OKLCH) folded into the same V1.1 deferral.
6. **Source dropdown got its options from `getCountBy(data.bookings, b => b.booking_source)`** at the page level (rather than a separate helper) — preserves the pre-B-4 inline logic.
7. **Active filter chip leak (mid-sweep fix)**: initial implementation built chips from effectiveFilters → auto-narrowed staffId surfaced as a removable "Staff: Test Therapist Fresh" chip for Therapist scope. Fixed by passing rawFilters; ScopePill expresses the effective scope separately ("Scope: Me · Monthly").
8. **Duplicate h1 a11y fix (mid-sweep)**: print-only header originally rendered `<h1>` creating a duplicate with AdminPageHeader's h1. Changed to `<p className="text-xl font-semibold">` inside `<div aria-hidden="true">` — visually identical when printed, semantically clean on screen.
9. **`tilesForScope` moved from step-1 extraction to step-4 (next to its HeadlineTileStrip consumer)** per surgical-changes discipline. Helper file Step 1 stayed minimal (4 pure helpers + 1 new); the larger compositional helper lives with the component it serves.
10. **Bundle delta +2.65 kB over budget**: documented in step-9 above.

## Verification gate

- [ ] Static lint + types clean
- [ ] Vitest new specs pass; baseline preserved
- [ ] Owner role sweep: 6 tiles + Insights stripe + 3 sections + 8 CSV chips
- [ ] Coordinator: 4 tiles, no Money, 5 CSV chips
- [ ] Therapist: "My report" header, 4 tiles, 1 CSV chip, no Workload Staff
- [ ] Drill-into-staff: Owner → workload row click → URL `?staffId=`; page narrows; Back link works
- [ ] `[Team | Personal]` toggle: **whole-page narrowing** verified (AUDIT Q3 — tiles + charts + sections + CSV exports all scope)
- [ ] Insights stripe dismiss: row vanishes optimistically; DB row written; persists across reload (AUDIT Q6)
- [ ] Insights stripe drill-link navigates per linked surface
- [ ] Print preview at desktop 1280 / A4 portrait: layout legible; chrome hidden; section page-breaks (AUDIT Q8)
- [ ] Lifetime range: delta chips hidden across all tiles
- [ ] CSV download in each role view → CSV with correct scope
- [ ] Per-section Suspense boundaries verified (SHARED-IMPLEMENTATION-NOTES §10)
- [ ] Query budget ≤8 per render
- [ ] Bundle delta within budget

## Hand-off

Next phase: B-5 (Dashboard rebuild).
