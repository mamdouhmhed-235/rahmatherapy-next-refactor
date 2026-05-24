# Brief: B-4 — Reports rebuild (`/admin/reports`)

**Phase:** B-4 (Reports surface, the macro mirror)
**Estimated effort:** ~3 days
**Brief status:** session-4 reframe; user-confirmed; supersedes `reports-brief.md`
**Plan:** `redesign/plans/B-phase/B4-reports-rebuild-plan.md`
**Prerequisites:** B-1 (primitives) + B-2 (helpers, prior-period query, insights) shipped

---

## 1. Feature Summary

The macro mirror. A full rebuild of `/admin/reports` that turns a flat tile-list-then-chart-grid-then-CSV-rail into a layered surface with six headline tiles (number + delta + sparkline), a `[Team | Personal]` segmented control, a scope pill, a staff drill-in (`?staffId=` narrows the whole page), an Insights stripe (deterministic threshold-based observations from B-2), semantic-coloured charts, stacked-bar workload rows, and three CSV-export groupings. Preserves all four scope variants (Owner / Admin / Coordinator / Therapist) and the existing GET filter contract (`range`, `from`, `to`, `staffId`, `source`, `paymentStatus`). Resolves the user's "metrics not granular enough" complaint structurally — every number now carries direction (delta), context (sparkline), and drill-in (staff filter). Receives `BusinessPulseCard` from the Dashboard (B-5 removes it from there); its data finds its proper home in the Activity section.

## 2. Primary User Action

**Land on the page, set a scope (range + staff if drilling), see six headline numbers with their direction at a glance, scan the Insights stripe for anything auto-flagged, dive into the Activity / Workload / Money sections for the specific question, export the relevant CSV — without ever wondering "what is this number compared to" because the delta is always there.**

## 3. Design Direction

**Colour strategy:** Full palette, semantic everywhere. Mint green for Confirmed, Amber for Pending, Soft Coral for Cancelled, Slate for Completed, soft mauve for NoShow — across donut, stacked bar, and tile tints. Outstanding tile uses Attention family tint (`--admin-warning-bg-strong`) when > 0. Net collection rate tile uses Confirmed family when ≥ 95% benchmark. Insights stripe rows use severity-strong tokens. The page should feel like an operating-room dashboard — *clinical clarity*, every signal interpretable in 200ms.

**Theme scene sentence:** *"Fatimah the Owner opens Reports on her laptop at 9pm on a Sunday: she sees that bookings dropped 18% vs the prior week (flagged in red on the Insights stripe), drills into Aisha's view because Aisha had the biggest workload last week, sees Aisha's no-show rate spiked to 22%, exports a payment report, and goes to bed knowing what to ask in Monday's team meeting."* Forces drill-in, forces deltas, forces severity, forces the Insights stripe to actually surface things.

**Anchor references:**
- **Stripe Dashboard Reports** — tile + delta + sparkline rhythm; date-range / segment / filter chrome
- **Mangomint analytics** — per-staff drill, source attribution, workload stacked bars
- **Linear Insights** — calm chrome, severity-coloured but never garish
- **Jane App Insights** — scope-aware page header that always tells you what you're looking at

Anti-anchor: the current `/admin/reports` page — flat sections, muted colours, no comparisons, no Insights, no drill-in beyond setting a filter then re-reading the same surface.

## 4. Scope

**In:**

### Page chrome
- `AdminPageHeader` with scope-conditional title (existing logic: "Reports" for Owner/Admin/Coord, "My report" for Therapist)
- **Scope pill** (NEW) — small badge under the title: "Scope: All staff · This month" or "Scope: Aisha Hassan · This month" (when drilled). Tap → opens the filter sheet.
- **Insights stripe** (NEW) — 0–3 plain-English observations from `getReportInsights(data, priorData)`. Renders nothing when empty.
- Filter strip (existing, restyled): range / from / to / staff / source / payment + Apply + Clear. **`[Team | Personal]` segmented control added** (visible to Owner/Admin/Coord; Therapist auto-Personal, no control).

### Headline tile strip
**6 tiles for Owner / Admin (`revenueAllowed === true`), 4 for Coordinator (no revenue/outstanding), 4 for Therapist** (scoped to own data; same composition):

1. **Bookings** — count in window, delta vs prior, sparkline of daily bookings
2. **Revenue collected** — money in window, delta, sparkline of daily collected (gated on `revenueAllowed`)
3. **Outstanding** — money still owed, delta (Attention tint when > 0)
4. **New clients** — count in window, delta, sparkline
5. **Utilisation rate** (NEW from B-2) — `<KpiTile>` with sparkline OR `<ScorecardRing>` if scoped to one staff with target. Hint: "{bookedHours}h of {availableHours}h" Whole-team aggregate by default.
6. **No-show rate** (NEW from B-2) — percentage, `tone='invert'` delta (smaller = better), hint with absolute counts

Tile strip is the page's `40-30-20-10` "40%" — large numerals, equal grid, no jagging.

### Activity section
- H2 "Activity" + framing line.
- **Status breakdown donut** — semantic 5-colour chart (NEW colouring; was default Recharts). Booking status mix.
- **Source attribution stacked bar** (NEW) — bookings + revenue by source. Uses `getSourceAttribution(data)` from B-2.
- **`BusinessPulseCard` Service mix + Client mix** — received from Dashboard. Repositioned here as part of the Activity section. Restyled to use B-1 chart primitives.
- Activity CSV chips below: Client summary · Booking list · Source-channel (existing keys).

### Workload section
- H2 "Workload" + framing line.
- **Staff workload stacked-bar rows** (NEW) — each staff row shows `assigned (slate) | completed (mint) | cancelled (coral)` segments. Clickable → drills the entire page to that staff (`?staffId=`).
- **Service performance rows** — existing composition restyled with `AdminEntityRow` shell.
- Workload CSV chips below: Staff workload · Service performance.

### Money section (Owner/Admin only, gated on `revenueAllowed`)
- H2 "Money" + framing line.
- **Revenue trend line chart** (`<AreaChart>` from B-1) — full-width, 12-month with prior-year overlay where data exists.
- **Net collection rate tile** (NEW) — Confirmed family tint when ≥ 95%; hint: "Collected £X of £Y billed"
- **Outstanding vs collected breakdown** — small dual-tile.
- **Staff revenue attribution stacked bar** — existing data, new chart treatment.
- Money CSV chips below: Revenue summary · Payment report · Staff revenue attribution.

### Metric definitions
- H2 "How these numbers are calculated" — preserved at page bottom. Each metric definition as `<details>` collapsed by default. Restyled to use design tokens; no functional change.

### Drill-in
- `?staffId=` narrows entire page through `filterReportDataToStaff(data, staffId)` from B-2.
- Page heading becomes "Reports — Aisha Hassan" (manager view) when `staffId` set.
- Scope pill reads "Aisha Hassan · This month".
- "← Back to all staff" Ghost link at top of page when drilled.

### Personal/Team toggle
- `[ Team | Personal ]` segmented control next to Apply. Setting `?scope=personal` triggers `filterReportDataToStaff(data, viewer.id)`.
- **Per AUDIT-2026-05-22 Q3: WHOLE-PAGE narrowing.** Tiles, Activity section charts, Workload section, Money section, CSV exports — all scope through the narrowed `data`. Page H1 stays "Reports" (not "My report") when Owner toggles Personal — the scope pill makes it explicit ("Scope: Me · This month").
- Even Owner can use Personal to ask "what did *I* do as a therapist this month?"
- Therapist always sees Personal; control hidden for them (they can't toggle Team — RBAC).

### Insights stripe dismissal (NEW per AUDIT-2026-05-22 Q6)
- Each `<InsightRow>` carries a dismiss "×" button at the right edge.
- Click triggers `dismissInsight(insightId)` server action from B-2.
- Optimistic UI removal of the row; server persists to `insight_dismissals` table.
- Re-renders of `/admin/reports` filter out dismissed IDs (page-side fetch of dismissed IDs → passed to `getReportInsights`).
- Dismissed insights stay dismissed across devices (table-backed); never re-fire for the same staff in the same period.
- Same insight in a NEW period gets a new ID (period is encoded into the ID); will re-fire.

### Print-friendly stylesheet (NEW per AUDIT-2026-05-22 Q8)
- Adds `@media print` styles inline in the Reports page (or a small `print.css` if cleaner).
- Hides: filter strip, `[Team|Personal]` toggle, scope pill (replaced with print-only "Scope: {who} · {range}" header), CSV chip rows, drill-in links, dismiss "×" buttons on Insights, Insights drill arrows.
- Forces light mode (overrides any dark-mode tokens).
- Page-break-avoid on each section (`break-inside: avoid`).
- **Print-only header (per AUDIT H4 + G-final-5):** rendered server-side at the top of `page.tsx` inside `<div className="print-only">` so operator name + scope are baked in:
  ```tsx
  <div className="print-only">
    <h1>Rahma Therapy — {isTherapistScope ? "My report" : (staffId ? `Reports — ${staffName}` : "Reports")}</h1>
    <p>Scope: {scopeLabel(filters, profile)} · {rangeLabel(filters)}</p>
  </div>
  ```
  Toggled via `@media screen { .print-only { display: none; } } @media print { .print-only { display: block; } }`. **Header reflects active `[Team|Personal]` toggle state** — when Owner toggles Personal then prints, the heading reads "Reports — My slice" (or similar; matches scope pill).
- **Print-only footer:** `<div className="print-footer">Printed on {todayFormatted} by {profile.name}</div>` (server-side bake of operator name); page numbers via `@page { @bottom-right { content: counter(page) " / " counter(pages); } }`.
- **Recharts SVG print fix (per AUDIT M4):** Recharts default animations cause partial-bar print artefacts in some browsers. Add `@media print { svg { animation: none !important; } }` AND set `isAnimationActive={false}` on every chart inside the page's print-aware wrapper (the chart primitives from B-1 already honour this via `prefers-reduced-motion`; print is a different medium so the explicit override is needed).
- **Verify:** browser print preview at desktop width (1280); confirm layout legible at A4; toggle Personal → print → header reflects "Personal" scope; chart bars fully rendered (no animation artefacts).

**Out:**
- **Staff goals / targets** — out per user decision.
- **Real-time chart updates via Supabase realtime** — V1.1.
- **LTV breakdown by client on Reports** — that's the client-detail ribbon's (B-6) home, not Reports.
- **Export to PDF** — CSV only.
- **Saved-filter shortcuts** ("My presets") — Phase 7 candidate.
- **Cross-tab comparison** (e.g. "May vs April side by side") — out; Phase 7 candidate.
- **Per-source revenue trend chart** — the stacked bar covers the question; line chart per source is over-instrumented.
- **AI / LLM-generated insights** — only the deterministic threshold-based Insights stripe ships.

## 5. Layout Strategy

**Page rhythm (top → bottom, desktop ≥1280px):**

1. **Page header**
   - H1: "Reports" (or "Reports — Aisha Hassan" when drilled; "My report" when Therapist).
   - Sub-line: scope pill + range label.
   - Right rail: "Back to all staff →" Ghost link (only when `staffId` set and viewer can clear). "Export latest as PDF" link removed (CSVs only this phase).

2. **Insights stripe** (when `getReportInsights(...).length > 0`)
   - 0–3 rows, severity-coloured backgrounds (`--admin-{severity}-bg-strong`).
   - Each row: severity icon (16px) + message + optional "View →" Ghost drill-link.
   - Hides entirely when 0 insights.

3. **Filter strip**
   - Range select + From/To + Staff select + Source select + Payment select + Apply + Clear.
   - `[Team | Personal]` segmented control (after Apply, before Clear). Hidden for Therapist (auto-Personal).
   - Active filter chip row below the strip (removable per-filter; matches Dashboard).

4. **Headline tile strip** — 6-tile or 4-tile grid (per role). CSS grid `auto-fill minmax(220px, 1fr) gap-4`. Equal `min-h-[14rem]`.

5. **Activity section** (H2)
   - Two-panel grid xl: `grid-cols-[1.5fr_1fr]`, stacked below xl.
   - Left: Status breakdown donut (`<DonutChart>`).
   - Right: Source attribution stacked bar (`<StackedBarChart>` from B-1).
   - Below both panels: BusinessPulseCard (Service mix + Client mix) as a slim full-width strip — relocated from Dashboard.
   - Activity CSV chip row.

6. **Workload section** (H2, when scope ≥ coordinator)
   - Two-panel grid xl, stacked below.
   - Left: "Staff workload" panel — each row a clickable `<MetricRow>` with stacked bar segment.
   - Right: "Service performance" panel — `AdminEntityRow` list.
   - Workload CSV chip row.

7. **Money section** (H2, when `revenueAllowed`)
   - Full-width revenue trend chart (`<AreaChart>`).
   - Below: two-panel xl grid for Net collection rate tile + Outstanding vs collected breakdown.
   - Full-width: Staff revenue attribution stacked bar.
   - Money CSV chip row.

8. **Metric definitions** (H2, always)
   - `<details>` collapsed accordion. Unchanged from existing brief.

**Mobile rhythm (<768px):**
- Filter strip collapses behind "Filters" Ghost → `AdminSheet` (existing pattern).
- Insights stripe rows stack vertically; tap to expand if long.
- Tile strip: single-column.
- Activity / Workload / Money sections: each chart full-width; CSV chips wrap.

**Drill-in surface change:**
- When `?staffId=` set:
  - Page H1 changes: "Reports — Aisha Hassan".
  - Scope pill reflects drill.
  - Headline tile strip recalculates using `filterReportDataToStaff(data, staffId)`. Personal/Team toggle hides (already personal-by-drill).
  - Workload section panels narrow: "Staff workload" panel collapses to a single row (the drilled staff) plus a "View other staff" Ghost link.
  - "← Back to all staff" link at page top clears `staffId` URL param.

**Variants preserved (per scope):**

| Variant | Title | Headline tiles | Activity | Workload | Money | CSV chips |
|---|---|---|---|---|---|---|
| Owner / Admin | "Reports" | 6 (all) | Donut + Source + Pulse | Staff workload + Service perf | Full | 8 |
| Coordinator | "Reports" | 4 (no Revenue, no Outstanding) | Donut + Source + Pulse | Staff workload + Service perf | Hidden | 5 |
| Therapist | "My report" | 4 (all scoped to self; no Revenue/Outstanding) | Donut + Source narrowed | Service perf only (no Staff workload — would show only self) | Hidden | 1 (Booking list) |
| Denied | "Reports access limited" | — | — | — | — | — |

## 6. Key States

| State | What the user sees |
|---|---|
| Owner, first paint, default (`range=this_month`) | Header + scope pill "All staff · This month" + Insights stripe (whatever's tripped) + filter strip + 6 headline tiles populated + Activity (donut + source + pulse) + Workload (staff + service) + Money (revenue + collection + outstanding + attribution) + Metric defs collapsed. |
| Owner with `?staffId=...` drilled | Header "Reports — Aisha Hassan" + scope pill reflects drill + Back link + Insights stripe re-computed for Aisha + tiles narrowed to Aisha + Workload section collapses (Staff workload → single row + "View other staff" link). |
| Owner with `?scope=personal` | Tiles narrow to Owner's own data; "[ Personal | Team ]" toggle highlights Personal; scope pill: "Me · This month". |
| Coordinator default | Same as Owner minus Money section minus 2 tiles (Revenue, Outstanding). |
| Therapist default | "My report" header; 4 tiles auto-narrowed; toggle hidden; Workload Staff panel hidden (only Service); only Booking list CSV chip. |
| Denied | `AdminAccessDenied` — no scope/title leak. |
| Custom range with `from > to` | Filter strip inline error + tiles render based on parsed range (existing validation). |
| Lifetime range | Delta chips hidden across all tiles (`<DeltaChip>` returns null when value undefined — `buildPriorPeriodFilters` returns null for lifetime). |
| Insights stripe empty | Stripe hidden entirely (no empty placeholder). |
| Insights stripe with 3 critical | All three rendered, top-down by severity. |
| Mobile filter sheet open | `AdminSheet` from bottom; sticky Apply + Clear footer. |
| Loading | `AdminSkeleton` shimmer per section. |
| Error in any section | Per-section `role="alert"` inline; other sections render. |
| Drill-in to staff with zero activity | Tiles show zeros; Insights stripe shows "Aisha had no activity this period." (info severity). |
| Section H2 stacking with AdminPanel H2 | Section H2 uses `<h2>` per DESIGN.md hierarchy; panel headers use `<h3>` (semantic nesting fix carried forward). |

## 7. Interaction Model

- **Filter strip Apply** — submits the GET form. URL changes (`?range=...&staffId=...`). Page re-renders server-side.
- **Filter strip Clear** — `Link href="/admin/reports"`. Resets all params.
- **`[Team | Personal]` toggle** — segmented control. Setting Personal adds `?scope=personal&staffId={viewer.id}` (server-side `filterReportDataToStaff`). Team clears `scope`.
- **Scope pill click** — opens filter sheet (matches Dashboard behaviour).
- **Insights row "View →"** — drill-link to the specific surface that explains the insight (e.g. utilisation drop for Aisha → `/admin/staff/{aishaId}?tab=performance&range=this_month`).
- **Headline tile click** — when `href` set, drills to the relevant deeper page:
  - Bookings tile → `/admin/bookings?{filterQuery}`
  - Revenue collected → no href (already the report's primary number)
  - Outstanding → `/admin/bookings?{filterQuery}&payment_status=unpaid`
  - New clients → `/admin/clients?{filterQuery}&sort=created_desc`
  - Utilisation → no href (drill is in-page)
  - No-show rate → `/admin/bookings?{filterQuery}&status=no_show`
- **Workload staff row click** — sets `?staffId={row.staffId}` and re-renders the whole page narrowed.
- **CSV chip click** — anchor `<Link href="/admin/reports/export?report=...&{filterQuery}" download>`. Existing route handler. No client-side spinner; browser download chrome takes over.
- **Metric definitions** — native `<details>` toggle per metric. State not persisted.
- **`prefers-reduced-motion`** — shimmer becomes static; chart entry animations disabled; count-up instant.
- **Keyboard order**: H1 → scope pill → Insights rows (interactive when drill-link) → filter strip controls (left-to-right) → Apply → toggle → Clear → tile grid in document order → Activity charts → Workload rows → CSV chips → Money panels → CSV chips → Metric definitions.

## 8. Content Requirements

**Headings.**
- H1 (Owner/Admin/Coord, not drilled): "Reports"
- H1 (drilled): "Reports — {staffName}"
- H1 (Therapist): "My report"
- H1 (denied): "Reports access limited"
- Sub-line: scope pill ("Scope: {who} · {range}") — clickable.
- Section H2: "Activity" / "Workload" / "Money" / "How these numbers are calculated"
- Section framing lines (Soft Slate): "How busy the clinic was in this window and where clients came from." / "Who carried the load and which services led." / "What was collected, what's outstanding, and how it splits across staff."
- Panel H3: "Bookings by status" / "Source and channel" / "Staff workload" / "Service performance" / "Revenue by period" / "Net collection rate" / "Outstanding vs collected" / "Staff revenue attribution"

**Insights stripe message library** — inherited from B-2's `getReportInsights` library. Render via:
```jsx
<InsightsStripe insights={insights}>
  {insight => (
    <InsightRow
      severity={insight.severity}
      message={insight.message}
      drillHref={insight.drillUrl}
    />
  )}
</InsightsStripe>
```

**Empty-state copy.**

| Section / panel | Heading | Body |
|---|---|---|
| Insights stripe, empty | (hidden entirely) | — |
| Headline tile, zero value | (renders 0 with tabular-nums) | — |
| Donut "Bookings by status", all zero | "Nothing to break down yet." | (no body) |
| Source attribution, empty | "No source data in this window." | (no body) |
| Staff workload, no assignments | "No staff workload recorded in this window." | — |
| Service performance, no items | "No services delivered in this window." | — |
| Revenue trend, <2 periods of data | "Trend appears after 2 periods of bookings." | — |
| Money section, all-zero | (shows zero tiles; chart shows empty state) | — |
| Metric definitions | (each `<details>` independently expandable; no empty state) | — |

**Microcopy.**
- Scope pill: "Scope: {who} · {rangeLabel}" — e.g. "Scope: All staff · May 2026" or "Scope: Aisha Hassan · This week"
- Personal/Team toggle: `Team` / `Personal`
- Tile delta chip: "+12% vs last month" / "−4% vs last week" / "→ flat" 
- Outstanding tile sub-line: "Of which £X completed but unpaid"
- Utilisation tile sub-line: "{bookedHours}h of {availableHours}h available across {N} therapists"
- Net collection rate sub-line: "Industry benchmark: 95%+ — you're at {rate}%."
- Activity CSV row heading: "Export Activity data"
- Workload CSV row heading: "Export Workload data"
- Money CSV row heading: "Export Money data"
- Back link: "← Back to all staff"
- Denied copy: "Reports access requires reporting or own-booking permission. Ask the owner if you need broader access."

**Voice anchors hit.** Verbs over nouns (Export, Back); real numbers ("£540" not "Revenue: 540"); state-word discipline ("collected" / "outstanding" not "received" / "due"); empty states encourage ("Nothing to break down yet" not "No data").

## 9. Recommended References

- **B-1 brief** — every chart, every tile, every delta chip, every sparkline, every ring comes from B-1
- **B-2 brief** — every number, every delta, every insight from B-2
- **`reference/spatial-design.md`** — the 6-tile rhythm, equal min-heights, the 1.5fr / 1fr split for Activity / Workload sections
- **`reference/interaction-design.md`** — the GET form contract, the segmented control pattern, the drill-in via `?staffId=`
- **`reference/copywriting.md`** — scope pill phrasing, Insights stripe templates, empty-state copy pass
- **DESIGN.md §5 (AdminFilterBar, AdminPanel, AdminEntityRow)** — preserved
- **DESIGN.md §2 (No-Gold-Text exception)** — the chart accent-amber for source bars (Stripe-pattern colour)
- **`reports-brief.md`** (the Phase-5 brief) — preserved for historical context; B-4 supersedes it
- **`BAND-B-RESEARCH-2026-05-22.md` §3 + §6** — metric canon and design rules

## 10. Open Questions

1. **Insights stripe placement** — above or below the filter strip? **Recommendation:** above (insights are *about* the data, not *configuring* it; surfacing them before the filter chrome makes them the first thing the operator sees).
2. **Drill-in URL pattern** — `?staffId=` is the existing field name. Should we add `?scope=staff` to make the URL self-documenting? **Recommendation:** no — `?staffId=` is unambiguous and existing.
3. **Toggle position** — `[Team | Personal]` next to Apply, or in the page header next to the scope pill? **Recommendation:** next to Apply (matches filter-related controls; keeps the header light).
4. **Charts library colours** — semantic 5-colour status; what about source attribution? Sources vary (website, phone, whatsapp, instagram, referral, admin, manual, other). **Recommendation:** use a tonal extension of the brand (each source a distinct OKLCH hue from the same lightness band — generated deterministically per source name like the existing avatar tints). 7+ sources fit fine.
5. **"Back to all staff" link UX** — what if Coordinator (who can't view all staff) is somehow drilled? **Recommendation:** Coordinator can drill only to themselves (RBAC at the data layer); never reaches a state where "all staff" is hidden from them. If they manually craft `?staffId=otherId`, RBAC denies at data layer and the page shows zero data (no link to clear; just shows "no data scope").
6. **Money section position** — bottom or middle? **Recommendation:** bottom (matches the existing brief; matches operator's mental scan — Activity first, Workload second, Money last as the "what's it worth" close).
7. **Insights drill URL coverage** — every insight type needs a drill URL or none? **Recommendation:** opportunistic — utilisation drop → staff perf; outstanding growth → /admin/bookings?payment_status=unpaid; no-show spike → /admin/bookings?status=no_show; bookings drop has no obvious drill (it's the report itself), so no link.

---

## Recipe Context

### Files to create

| File | Purpose |
|---|---|
| `src/app/admin/reports/InsightsStripe.tsx` | Insights stripe component (~80 lines). Consumes `ReportInsight[]` from B-2; renders severity-strong rows with drill links. |
| `src/app/admin/reports/ScopePill.tsx` | Scope pill component (~40 lines). Computes "Scope: {who} · {rangeLabel}" string; clickable wrapper that triggers filter sheet. |
| `src/app/admin/reports/PersonalTeamToggle.tsx` | Segmented control client component (~50 lines). Submits a GET form on toggle. |
| `src/app/admin/reports/HeadlineTileStrip.tsx` | The 4 / 6 tile grid (~120 lines). Role-aware tile selection via `tilesForScope(filters, profile, scorecard)`. |
| `src/app/admin/reports/WorkloadStaffRow.tsx` | Clickable workload row with stacked bar segment (~60 lines). |
| `src/app/admin/reports/reports-helpers.ts` | Pure helpers: `tilesForScope`, `chipsForActiveFilters`, `formatRangeLabel` (move from page.tsx). |
| `src/app/admin/reports/__tests__/reports-helpers.test.ts` | Vitest specs. |

### Files to modify

| File | Change |
|---|---|
| `src/app/admin/reports/page.tsx` | Wholesale restructure (~1053 → ~700 lines after extraction). Preserve every GET param. Preserve the existing CSV export route deep-links. Compose the new sections (Insights, Headline, Activity, Workload, Money, Metric defs). Honour Personal/Team toggle. |
| `src/app/admin/reports/ReportsCharts.tsx` | Rewrite around B-1 primitives. `<CountBarChart>` and `<RevenueChart>` are replaced by `<BarChart>` and `<AreaChart>` from `charts/`. Semantic-coloured status fills. Preserve the export names so the data flow continues. |
| `src/app/admin/reports/loading.tsx` | Update skeleton placeholder shapes to match the new tile + section structure. |

### Files to NEVER touch

- `src/app/admin/reports/reporting.ts` — B-2 added helpers; B-4 only consumes. Don't modify any helper body.
- `src/app/admin/reports/export/route.ts` — CSV export route handler. RECON §5 untouchable. Existing 8 export keys preserved verbatim.
- `src/lib/auth/**` — RBAC unchanged
- `src/lib/supabase/**`
- `src/middleware.ts`
- `supabase/migrations/**` — no schema changes in B-4
- All build/config files
- `src/app/admin/dashboard/**` — owned by B-5
- `src/app/admin/components/notification-*.{ts,tsx}` — R4
- `src/app/admin/components/charts/**` — owned by B-1; B-4 imports, doesn't modify

### Feature Preservation Manifest

**GET filter form `name` attributes preserved verbatim:**
- `range`, `from`, `to`, `staffId`, `source`, `paymentStatus`
- NEW: `scope` (= `personal` | unset for team)

**CSV export keys preserved (RECON §5):**
- `client_summary`, `booking_list`, `source_channel_report`, `staff_workload_report`, `service_performance_report`, `revenue_summary`, `payment_report`, `staff_revenue_attribution_report`

**Permission gates preserved (RECON §2):**
- `canOpenReports(profile)` ≠ false — admits Owner/Admin/Coordinator/Therapist
- `canViewRevenueReports(profile)` — gates Money section + tiles 2/3 + Money CSV chips
- `hasUniversalReportScope(profile)` — gates the `[Team | Personal]` toggle (Therapist auto-Personal)

**JS hooks / IDs to preserve (RECON §6.4):**
- Filter form `action="/admin/reports"`
- All input `name` attributes (above)
- `id="admin-main"` skip-link target preserved at layout level

**Server actions:** none from this page (read-only).

**Audit log writes:** none from this page.

**External / deep links to preserve (RECON §6.5):**
- `/admin/reports/export?report=...&{filterQuery}` — CSV download anchor
- `/admin/reports?range=...&from=...&to=...&staffId=...&source=...&paymentStatus=...&scope=...` — deep-link to specific scope; bookmarkable
- `/admin/staff/{id}?tab=performance&range=...` — from Insights drill-link

### Information hierarchy (top to bottom)

1. Page identity + scope pill
2. Insights stripe (when populated)
3. Filter strip + active filter chips
4. Headline tile strip (6 / 4 tiles)
5. Activity section (Donut + Source + Pulse)
6. Workload section (Staff + Service)
7. Money section (Owner/Admin only)
8. Metric definitions

### Design direction — tokens and components

- **H1:** Urbanist 600 display step (not Cormorant — Reports is operational, not editorial). Chronicle.
- **Scope pill:** `inline-flex h-7 items-center rounded-full bg-[var(--admin-panel-muted)] px-3 text-xs font-medium text-[var(--admin-body)]` + leading icon (Filter 12px).
- **Insights stripe row:** `flex items-center gap-3 rounded-md border px-4 py-3` with `bg-[var(--admin-{severity}-bg-strong)] border-[var(--admin-{severity}-text)]/30`.
- **Insights icon:** `AlertTriangle` (critical) / `AlertCircle` (warning) / `Sparkles` (info) — all 16px lucide.
- **Headline tile:** `<KpiTile>` from B-1, equal `min-h-[14rem]`, Cormorant numeral.
- **Donut chart:** `<DonutChart>` from B-1, **5-colour chart palette via the new `statusChartFillForKey()`** (NOT `theme.statusFillForName` — that returns text-tuned dark tokens; see SHARED-NOTES §17). Wrapped by `StatusDonutChart` with center label ("{total} bookings", Cormorant numeral + small-caps unit) + below-donut legend (sorted descending, colour swatch + name + count + percentage; 2-col grid on sm+, single-col on phones). Per-slice tooltip on hover (Recharts default).
- **Source attribution chart:** B-1's `<StackedBarChart layout="vertical">` single-series with admin-primary fill (sorted descending, height auto-grows with category count). Categories sit on the y-axis so labels never overlap regardless of length or count — the horizontal-axis variant from the original brief crashed labels into each other and was unreadable on mobile (user-flagged during pre-commit audit). Per-source OKLCH palette + a real `bookings + revenue` stacked-bar deferred to V1.1 — mixed-axis (count vs currency) on one stack is visually misleading; deferred until the brief settles on a different chart shape.
- **Workload stacked-bar row:** custom thin `<StackedBarChart>` at 18px height, three-segment (assigned/completed/cancelled).
- **Revenue trend chart:** `<AreaChart>` from B-1, `minHeight: 320`, prior-year overlay.
- **Net collection rate tile:** `<ScorecardRing>` from B-1, target=95%.
- **CSV chip:** `<Link href download>` styled as Ghost button with `Download` 14px icon prefix.
- **Section H2:** Urbanist 600 1.5rem (existing convention; do not upsize to 1.778rem — Phase 7 deferral noted, leave for system-wide reconciliation).
- **Section framing line:** Work Sans 400 body, Soft Slate, max-w-prose.
- **Active filter chip:** existing pattern preserved.
- **Mobile filter sheet:** existing `AdminSheet` pattern.

---

## Implementation Notes

**Per-state intent** lives in §6.
**Per-viewport intent** lives in §5 (desktop 1280+ vs mobile <768).

**Verification steps:**
- `pnpm lint` + `npx tsc --noEmit` clean
- Vitest: new helper specs pass; baseline preserved
- Playwright role sweep: 4 roles + denied; landscape + portrait at 375/768/1280/1440
- Drill-in flow: Owner → click Aisha's workload row → confirm URL changes + page narrows + Back link appears + clicking Back clears `staffId`
- Personal toggle flow: Owner → toggle Personal → confirm tiles narrow to Owner's data + Team toggle → confirm tiles widen
- Lifetime range: confirm delta chips hidden across all tiles (`<DeltaChip>` returns null)
- Insights stripe: seed DB to trip 2 thresholds (e.g. force a utilisation drop); confirm stripe renders 2 rows with correct severity + drill links work
- CSV download: each chip's anchor returns a CSV with the current filter applied (route handler enforces RBAC)
- Therapist: confirm "My report" header + no toggle + Workload Staff panel hidden + only Booking list CSV chip

---

## Copy

### Form labels

| Slot | Text |
|---|---|
| Range select | `Range` |
| From / To | `From` / `To` |
| Staff select | `Staff` (hidden for Therapist) |
| Source select | `Source` |
| Payment select | `Payment` |
| Scope toggle (sr-only group label) | `Report scope` |
| Active filter remove buttons | `Remove {filterName} filter` (sr-only) |

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Apply | `Apply filters` | Secondary |
| Clear | `Clear filters` | Ghost (only when active) |
| Personal/Team toggle | `Personal` / `Team` | Segmented |
| Scope pill | `Scope: {who} · {range}` | Pill (clickable) |
| Back link | `← Back to all staff` | Ghost (only when drilled) |
| CSV chips | `Client summary` / `Booking list` / `Source-channel` / `Staff workload` / `Service performance` / `Revenue summary` / `Payment report` / `Staff revenue attribution` | Ghost (each with Download icon) |
| Insights row drill | `View →` | Ghost (per-row, only when drillUrl set) |

### Error messages

| Slot | Text |
|---|---|
| Custom range invalid | `End date must be on or after start date.` |
| Section data load failure | `Couldn't load this section. Try refreshing.` |
| Tile data load failure | `Couldn't load this section. Try refreshing.` |
| Chart data load failure | `Couldn't load this chart. Try refreshing.` |
| CSV download click without permission (defensive) | `You don't have export access.` (toast, Cancelled, persistent) |
| Denied state | `Reports access requires reporting or own-booking permission. Ask the owner if you need broader access.` |
| Insights compute failure | (no message — stripe hides silently) |

### Empty-state text

(See §8 for the full table.)

### Tooltip text

| Slot | Text |
|---|---|
| Scope pill | `Click to refine scope` |
| Headline tile delta chip | `{value}% vs the prior {period}` |
| Donut segment | `{statusName}: {count} bookings ({percentage}%)` |
| Source bar segment | `{sourceName}: {count} bookings, £{revenue}` |
| Workload row segment | `Assigned: {N} · Completed: {N} · Cancelled: {N}` |
| Revenue trend point | `{month}: £{collected} collected, £{outstanding} outstanding` |
| Net collection rate ring | `Industry benchmark: 95%+ — you're at {rate}%` |
| CSV chip | `Download {reportLabel} CSV for the current scope` |
| Metric defs `<details>` | (existing definition text from `METRIC_DEFINITIONS`) |

### Confirmation dialog text

None — Reports is read-only.

### Toasts

- Filter applied: no toast — re-render is the feedback.
- CSV download: no toast — browser download chrome is the feedback.
- Toggle Personal/Team: no toast.

---

*End of B-4 brief. Next: B-5 brief (Dashboard rebuild) — the largest UI surface, replaces the current dashboard wholesale across all three variants.*
