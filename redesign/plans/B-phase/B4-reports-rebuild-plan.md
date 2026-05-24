# Plan: B-4 — Reports rebuild

**Brief:** `redesign/briefs/B4-reports-rebuild-brief.md`
**Effort:** ~3.5 days (was 3; +0.5d for print stylesheet + insight dismiss UX per AUDIT-2026-05-22 Q6 + Q8)
**Prerequisites:** B-1 (primitives) + B-2 (helpers, prior-period, insights) shipped; ideally B-3 shipped for visual-language consistency
**Gates:** none downstream
**Safety label:** REPLACES — full UI rewrite of `/admin/reports`; backend (`reporting.ts`, export route, RBAC) preserved verbatim
**Blocks redesign:** NO — but is the most impactful Owner-facing surface; landing it answers the "metrics not granular" complaint

---

## What this is

Wholesale rebuild of `/admin/reports`. Replaces the existing tile-list-then-chart-grid-then-CSV-rail with a layered surface: Insights stripe (B-2), 6-tile headline strip with deltas + sparklines (B-1 KpiTiles), scope pill + `[Team | Personal]` segmented control, staff drill-in via `?staffId=`, recoloured semantic charts (B-1), stacked-bar workload rows, three CSV-export groupings. Preserves all 4 scope variants (Owner / Admin / Coordinator / Therapist) and the GET filter contract. Receives `BusinessPulseCard` from Dashboard (B-5 removes it).

## Why it's needed

The Owner's "metrics not granular enough" complaint is a *structural* one — every tile needs a delta, every chart needs comparison context, every staff needs drill-in. The current Reports page has none of these. B-4 ships them with foundation primitives from B-1 and data shape from B-2.

## What this does (user story)

"As an Owner, I open Reports on a Monday morning. The Insights stripe tells me bookings dropped 18% vs last week and surfaces Aisha's utilisation drop. I drill into Aisha (one click on the workload row), see her tile strip narrowed to her, decide what to do, and export a payment report. The whole sequence takes under 3 minutes."

"As a Therapist, I open 'My report' (same URL, auto-narrowed). I see my bookings, my activity in the period, my breakdown by status and source. Numbers are about me; CSV is my own booking list."

## What information it stores or retrieves

**Reads:** existing `getReportData(adminClient, profile, filters)` (already RBAC-narrowed). B-2's `unstable_cache` wrap means subsequent renders within 60s are cached. Two parallel calls (current + prior period via `buildPriorPeriodFilters`).

**Writes:** none (read-only).

**Migrates:** none.

## Who can use it

- Owner / Admin / PM: full surface, all sections, all 6 tiles, all 8 CSV exports.
- Coordinator: Activity + Workload, 4 tiles (no Revenue / Outstanding), 5 CSV exports.
- Therapist: auto-narrowed, "My report" title, 4 tiles scoped to self, 1 CSV export (Booking list).
- Denied: `AdminAccessDenied` per existing copy.

## What can go wrong

- **Prior-period query latency**: parallel `Promise.all` of current + prior data adds ~50–150ms per render. B-2 cache mitigates after first load.
- **Insights stripe over-fires**: B-2 caps at 3 insights; severity-sorted.
- **Drill-into-staff for staff with zero activity**: tiles show zeros; Insights stripe shows info-severity "no activity" message; charts render empty states.
- **`[Team | Personal]` toggle for Therapist**: toggle hidden (auto-Personal).
- **Lifetime range deltas**: `buildPriorPeriodFilters` returns null; `<DeltaChip>` returns nothing for undefined values; no fake "vs prior lifetime" display.
- **Active filter chips not reflecting new `scope` and `staffId` filters**: extend `buildActiveFilterChips` to include these.
- **CSV export route doesn't honour `scope=personal`**: existing route doesn't know about Personal scope. **Mitigation:** when `scope=personal` is set, the CSV download URL includes `staffId={viewer.id}` so the existing route's `staffId` handling narrows the export. No route changes needed.
- **Semantic chart colours clash with brand**: Mint / Amber / Soft Coral / Slate / soft mauve all from the existing palette; consistent with R4 (notification severity tints).
- **Donut chart with all-zero data**: B-1 chart renders "Nothing to break down yet." inline.
- **Workload stacked-bar rows with 100% completed**: bar renders 100% mint; visually clean.
- **Insights drill-link to staff perf for Coordinator (who can't view staff detail)**: gate the drill-link visibility per viewer permissions; render plain text without link when destination is RBAC-denied.

## How to verify it works

1. **Static:** lint + types clean.
2. **Vitest:** new helper specs pass; baseline preserved.
3. **Playwright role sweep**:
   - Owner: full surface; toggle Personal/Team works; drill into Aisha works; clear filters works.
   - Admin: same as Owner.
   - Coordinator: 4 tiles, no Money, Personal toggle works (limited to own scope).
   - Therapist: "My report" header, 4 tiles, no toggle, Workload Staff hidden, only Booking list CSV.
   - Denied: shows correct denied copy.
4. **Insights smoke**: seed DB to trip 2 thresholds (e.g. force utilisation drop + outstanding growth); confirm stripe shows 2 rows with correct severity + drill links.
5. **CSV download**: each chip in each role's view returns a CSV with correct scope.
6. **Visual**: screenshot per role at 375 / 768 / 1280 / 1440.
7. **Bundle**: confirm `pnpm build` delta within reasonable bound.

## Safe implementation order

### Step 1 — Pure helpers extraction (`reports-helpers.ts`)
- Create `src/app/admin/reports/reports-helpers.ts`.
- Extract from `page.tsx`: `tilesForScope(filters, profile, scorecard)`, `buildActiveFilterChips(args)`, `formatRangeLabel`, `validateFarFutureDate` (if not already extracted).
- Move logic; preserve behaviour. Add vitest specs for each pure helper.
- **Verify:** specs pass.

### Step 2 — `<ScopePill>` and `<PersonalTeamToggle>`
- Create `src/app/admin/reports/ScopePill.tsx` (~40 lines).
  - Renders "Scope: {who} · {rangeLabel}" with Filter icon prefix.
  - Click → focus the filter sheet trigger.
- Create `src/app/admin/reports/PersonalTeamToggle.tsx` (~50 lines).
  - Client component (needs to submit GET form on toggle).
  - Segmented control: `Team` / `Personal`.
  - Hidden for Therapist (server-side prop).
- Add specs.
- **Verify:** components render; toggle updates URL; sign-in as each role to confirm visibility.

### Step 3 — `<InsightsStripe>` + `<InsightRow>` with dismiss
- Create `src/app/admin/reports/InsightsStripe.tsx` (~80 lines, server component).
- Create `src/app/admin/reports/InsightRow.tsx` (~50 lines, **client component** — needs dismiss button).
- `<InsightsStripe>` accepts `insights: ReportInsight[]` from B-2 (already-filtered for dismissed); maps to `<InsightRow>`.
- `<InsightRow>` accepts `severity`, `message`, `drillHref?`, `insightId`. Renders severity-strong token + lucide icon + message + optional `View →` Ghost + **dismiss "×" button** (per AUDIT-2026-05-22 Q6).
- Dismiss button:
  - Imports `dismissInsight` from `src/app/admin/reports/insight-actions.ts` (B-2).
  - **Optimistic UI flow (per AUDIT M7):**
    1. Click → row's local state flips to `dismissed = true`; row fades + slides out (200ms).
    2. Server action runs in background; on success, `revalidateTag('report-data')` invalidates the cache.
    3. On next render (triggered by the revalidate), `getReportInsights` re-fetches dismissed IDs from `insight_dismissals` table → the dismissed insight is filtered out → row stays gone.
    4. Net effect: instant visual feedback + DB-confirmed persistence on the next render.
  - On server error: local state rolls back (`dismissed = false`); row fades back in; sonner toast "Couldn't dismiss this insight." (retain insight ID for retry).
  - Aria-label: "Dismiss insight: {message}".
  - Focus management: after successful dismiss, focus moves to next remaining row OR to the scope pill if no rows remain.
- Add specs: empty, 1 insight, 3 insights, drill-link gated, dismiss optimistic flow, dismiss server error rollback.
- **Verify:** specs pass; visual smoke; dismiss persists across reload (DB row written).

### Step 4 — `<HeadlineTileStrip>`
- Create `src/app/admin/reports/HeadlineTileStrip.tsx` (~120 lines).
- Composes `<KpiTile>` × 6 (or 4) per `tilesForScope` output.
- Each tile receives: value (from `summarizeReports` + B-2 helpers), delta (from prior-period comparison), series (12-day sparkline from `buildDailySeries`).
- For utilisation tile, optionally swap to `<ScorecardRing>` when scope is single-staff (drilled).
- Equal `min-h-[14rem]` across tiles.
- Add spec covering each scope's tile set.
- **Verify:** smoke at each role; tiles render with correct deltas.

### Step 5 — `<WorkloadStaffRow>`
- Create `src/app/admin/reports/WorkloadStaffRow.tsx` (~60 lines).
- Renders a single staff row with `<StackedBarChart>` slim variant (18px height, three segments).
- Whole row is `<Link>` to `?staffId={row.staffId}` (sets the drill).
- Hover: lift + tint highlight.
- Add spec.
- **Verify:** clicking a row navigates with `staffId` set.

### Step 6 — Rewrite `ReportsCharts.tsx`
- Replace `<CountBarChart>` with `<BarChart>` from B-1 (semantic-coloured via `statusFillForName`).
- Replace `<RevenueChart>` with `<AreaChart>` from B-1.
- Add `<DonutChart>` for the new status-breakdown chart.
- Add `<StackedBarChart>` for source attribution.
- Preserve the export names so any other consumer (if any) keeps working.
- **Verify:** Reports page renders correctly with new charts; specs pass.

### Step 7 — Wholesale restructure of `page.tsx`
- Restructure `src/app/admin/reports/page.tsx` (~1053 → ~700 lines after extraction).
- Compose: `<AdminPageHeader>` → `<ScopePill>` → `<InsightsStripe>` → filter strip (extracted) + `<PersonalTeamToggle>` + active filter chips → `<HeadlineTileStrip>` → Activity section (Donut + Source + Pulse) → Workload section (rows of `<WorkloadStaffRow>` + service rows) → Money section (gated) → Metric definitions (preserved).
- When `?staffId=` set:
  - Compute `filterReportDataToStaff(data, staffId)` (B-2).
  - Compute `priorData` similarly.
  - Update H1 to "Reports — {staffName}".
  - Render "← Back to all staff" Ghost link at top.
- When `?scope=personal` set:
  - Same as drill, but with `staffId = viewer.id`.
- Preserve every GET param + CSV export deep-link.
- Receive `BusinessPulseCard` from Dashboard (import the existing component; restyle to use B-1 chart primitives in step 6).
- **Verify:** sign in as each role; navigate; smoke each section.

### Step 8 — `loading.tsx` skeleton update
- Update `src/app/admin/reports/loading.tsx`.
- Shapes match new tile + section structure (6 KpiTile skeletons + section skeleton + chart skeletons).
- Uses B-1's shimmer (inherited via `AdminSkeleton`).
- **Verify:** dev mode reload `/admin/reports`; skeleton shape matches final layout.

### Step 9 — Playwright role sweep + visual
- Per "How to verify it works" §3 + §6.
- Capture screenshots at 4 viewports per role.

### Step 10 — Insights smoke
- Use Supabase MCP to seed a controlled state:
  - Force utilisation to drop > 10pp for a known staff member (set `staff_availability_rules` to widen, or wait for natural data shift).
  - Force outstanding revenue > £200 vs prior.
- Reload `/admin/reports` as Owner.
- Confirm Insights stripe renders 2 rows with correct severity + drill-links.
- Click drill-link; confirm navigation.

### Step 11 — CSV download verification
- For Owner: each of 8 CSV chips clicked; confirm download succeeds with correct scope.
- For Coordinator: 5 chips; same.
- For Therapist: 1 chip; same.
- Drill into a staff member; click CSV; confirm the staff narrowing applies.

### Step 11.5 — Print-friendly stylesheet (NEW per AUDIT-2026-05-22 Q8)
- Add `@media print` styles inline at the top of `page.tsx` (or extract to `print.css` if cleaner — recommend inline to keep all Reports concerns in one place).
- Per brief §4 spec:
  - Hide `.filter-strip`, `.scope-toggle`, `.csv-chip-row`, `.insight-dismiss-btn`, `.insight-drill-link`, `.drill-back-link`.
  - Force light mode tokens (`color-scheme: light` + override any dark-only tokens).
  - `.section { break-inside: avoid; }` on Activity/Workload/Money sections.
  - Add print-only header element: `<div className="print-only">Rahma Therapy — Reports — {scopeLabel} — {rangeLabel}</div>` (hidden on screen via `@media screen { .print-only { display: none } }`).
  - Add print-only footer with `@page` counter and operator name.
  - Verify charts (SVG) print correctly — Recharts does work in print but force `width:100%; height:auto`.
- **Verify:** browser print preview at 1280 viewport; A4 portrait; confirm:
  - Page 1: header + scope + 6 tiles (or 4 for Coord)
  - Page 2: Activity section
  - Page 3: Workload section
  - Page 4 (Owner only): Money section
  - Footer: "Printed on {date}" + page numbers
  - No filter chrome / no CSV chips / no Insights dismiss buttons.

### Step 12 — Commit
- Stage scoped files explicitly.
- Commit message: `feat(admin): B-4 — Reports rebuild (6 tiles + Insights stripe + Personal/Team + drill-in + semantic charts + print + dismiss)`.

## How to undo it if something breaks

The rewrite is in a single commit; revert restores the pre-B-4 page wholesale. No data changes; no schema changes.

If a partial rollback is needed (e.g. keep Insights stripe but revert headline tiles), commits should be broken up during implementation — each step's progress log can guide selective revert.

## Safety confirmations

- [ ] Branch is `redesign/start-state` (or worktree).
- [ ] B-1 + B-2 commits already on the branch.
- [ ] No `pnpm install` (zero new deps).
- [ ] No DB migrations.
- [ ] Existing CSV export route handler `/admin/reports/export/route.ts` not modified.
- [ ] Existing GET filter contract preserved verbatim (`range`, `from`, `to`, `staffId`, `source`, `paymentStatus`).
- [ ] No production deploy triggered by this phase.

---

## Step-by-step verification log template

```
step-1: COMPLETE — reports-helpers.ts extracted; 8 specs pass
step-2: COMPLETE — ScopePill + PersonalTeamToggle created; specs pass
step-3: COMPLETE — InsightsStripe created; 4 specs pass
step-4: COMPLETE — HeadlineTileStrip created; 4 specs pass (1 per scope)
step-5: COMPLETE — WorkloadStaffRow created; clicking row navigates correctly
step-6: COMPLETE — ReportsCharts.tsx rewritten on B-1 primitives; semantic colours verified
step-7: COMPLETE — page.tsx wholesale restructured; each role smoke-rendered
step-8: COMPLETE — loading.tsx updated; skeleton shape matches
step-9: COMPLETE — Playwright role sweep passed; 16 screenshots captured (4 roles × 4 viewports)
step-10: COMPLETE — Insights smoke: 2 rows render correctly; drill-links navigate
step-11: COMPLETE — CSV downloads verified for all 14 (8+5+1) per-role downloads
step-12: COMPLETE — committed feat(admin): B-4 — Reports rebuild
```

---

## Verification gate

| Gate | Command | Pass criterion |
|---|---|---|
| Static lint | `pnpm lint` | 0 errors |
| Static types | `npx tsc --noEmit` | 0 errors |
| Vitest | `pnpm vitest run` | New specs pass; baseline preserved |
| Owner role sweep | Sign in as Owner; navigate to `/admin/reports` | All 6 tiles + Insights stripe + 3 sections + 8 CSV chips render correctly |
| Coordinator role sweep | Same as Owner | 4 tiles, no Money, 5 CSV chips |
| Therapist role sweep | Same | "My report" header, 4 tiles, 1 CSV chip, no Workload Staff |
| Drill-in flow | Owner → click Aisha's workload row | URL updates with `staffId=`; page narrows; Back link works |
| Personal/Team toggle | Owner → toggle Personal | tiles narrow to own data; toggle Team → widen |
| Insights stripe | Seed thresholds | 0–3 rows render correctly; drill-links navigate |
| Lifetime range | Set `?range=lifetime` | Delta chips hidden across tiles |
| CSV download | Click each chip | Browser downloads CSV with correct scope |
| Bundle size | `pnpm build` | Within reasonable bound |
| Visual screenshots | 4 viewports × 4 roles | Layout matches brief §5 |

---

## Files touched (summary)

**Created:**
- `src/app/admin/reports/InsightsStripe.tsx`
- `src/app/admin/reports/ScopePill.tsx`
- `src/app/admin/reports/PersonalTeamToggle.tsx`
- `src/app/admin/reports/HeadlineTileStrip.tsx`
- `src/app/admin/reports/WorkloadStaffRow.tsx`
- `src/app/admin/reports/reports-helpers.ts`
- `src/app/admin/reports/__tests__/reports-helpers.test.ts`
- `src/app/admin/reports/__tests__/*.test.tsx` (per-component specs)

**Modified:**
- `src/app/admin/reports/page.tsx` (wholesale restructure)
- `src/app/admin/reports/ReportsCharts.tsx` (rewrite around B-1 primitives)
- `src/app/admin/reports/loading.tsx` (skeleton shapes update)

**Total: ~8 new files + ~3 modified files.**

---

## Hand-off

After B-4 ships:
- B-5 implementer can proceed (Dashboard rebuild). Pattern lessons from B-4 (tile strip composition, semantic chart colours, drill-in UX) feed into B-5.
- B-6 implementer can proceed (Client LTV ribbon).

Next phase: B-5 (Dashboard rebuild).
