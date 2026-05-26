# /impeccable harden — reports page

Date: 2026-05-16
Source page: `src/app/admin/reports/page.tsx`
Brief: `redesign/briefs/reports-brief.md` (§6 Key States + §Error messages + §Empty-state text)

## State coverage matrix

Each row maps a brief-mandated state to the current implementation; "added" rows are net-new states this hardening pass introduces.

| State | Brief source | Implementation |
|---|---|---|
| Default — admin scope, current month | §6 K1 | rendered via `revenueAllowed` + `universalScope` flags; 4 stat tiles + Activity + Workload + Money |
| Default — coordinator scope | §6 K2 | `!revenueAllowed && universalScope` hides Section C + money CSV chips + Service-perf money suffix; 2 stat tiles |
| Default — therapist scope | §6 K3 | `!revenueAllowed && !universalScope` → `isTherapistScope`; title "My report", Staff filter hidden, Staff workload panel hidden, Booking-list-only CSV |
| Empty — no records in window | §6 K4 | per-panel `EntityRowList` empty title+body; per-chart `<ChartEmpty>` with "No bookings in this window." |
| Custom range with from > to | §6 K5 | server-side compare `filters.from > filters.to` → `role="alert" aria-live="polite"` Cancelled text below filter strip |
| Filter active | §6 K6 | `activeFilterChips` rendered as Restricted-family pills with X-to-clear Link; "Clear filters" Ghost alongside Apply |
| Loading | §6 K7 | (Next 15 server-rendering streams; AdminSkeleton-based suspense boundary deferred — see "Open items" below) |
| Outstanding > 0 | §6 K8 | both headline and Section-C inline tile carry `tone="warning" alert={true}` (Attention family tint) |
| CSV export click | §6 K9 | anchor `<Link>` with `download` attribute hint + `aria-label="Download <label> as CSV"` |
| CSV exports disabled on therapist scope | §6 K10 | therapist receives only `booking_list` chip in Activity; Money + Workload CSV panels hidden |

## Added during harden

1. **Custom range empty From or To** — _brief §Error messages line 2_: `Pick a start and end date for a custom range.` Added inline alongside the from-after-to validation; renders when `filters.range === "custom" && (!filters.from || !filters.to)`.
2. **Far-future date validation (>5 years)** — _brief §Error messages line 3_: `That date is outside the supported range. Reports cover the last 5 years.` Added; renders when either `filters.from` or `filters.to` is > 5 years past today.
3. **Source-channel chart empty copy refinement** — _brief §Empty-state text_: "No source data" / "New leads will show up here as bookings come in." Differentiated from generic "No bookings in this window." by routing `sourceOptions.length === 0` through a dedicated `<ChartEmpty>` variant.
4. **Page-load error boundary (`error.tsx`)** — _brief §Error messages line 4_: `Couldn't load this report.` + `Try again` Ghost. Implemented as Next.js `error.tsx` co-located with `page.tsx`.

## Reports-specific edge cases verified

- `from > to` shows Cancelled-text error inline at 375 without breaking layout (`role="alert" aria-live="polite"`).
- Outstanding stat tile paints Attention family when `summary.outstandingRevenue > 0` at both top headline and Section C inline.
- Recharts containers retain `minHeight: 288` (`ReportsCharts.tsx` lines 31 + 56) — baseline 6 warnings reduced to 0.
- Empty range copy: per-panel "No records in this range." and per-chart "No bookings in this window." both render.
- Coordinator scope: Money section + Money CSV grouping fully hidden (not just collapsed) via `revenueAllowed` gate.
- Therapist scope: page title becomes "My report"; Staff filter hidden; Staff workload panel hidden; CSV collapses to Booking list only.

## Open items (deferred)

| Item | Reason for deferral |
|---|---|
| Loading state via Suspense + `AdminSkeleton` | Next.js 16 server-streams the page; full-page skeleton would require restructuring server components into client + suspense boundaries. Defer to Phase 7 if user reports loading flash. |
| CSV download failure toast | The existing `/admin/reports/export` route handler is RECON §5 untouchable; failures surface as the route's own error JSON response, not as a client-side toast. Defer to Phase 7. |
| Chart render failure inline | Recharts handles its own render-time fallbacks; cannot wrap in a try/catch from server component. Defer to Phase 7. |

## File-level summary

- `src/app/admin/reports/page.tsx`: validation expanded (4 brief-mandated checks); source-channel empty differentiated.
- `src/app/admin/reports/error.tsx`: new error boundary file added.
