# Per-page scope — reports

Generated: 2026-05-16 (Step 3 of /redesign/per-page-recipes/reports-recipe.md)

## Files to edit

- `src/app/admin/reports/page.tsx` — Full presentational rewrite per brief: three-section vertical structure (Activity / Workload / Money); rebuild `<form action="/admin/reports">` filter strip onto `AdminFilterBar` with `surface-input` + `border-default` tokens (no raw `bg-white`/`border-[var(--rahma-border)]`); add live-bound range helper line; promote 4-tile stat strip with Cormorant numerals (2 tiles when `revenueAllowed === false`); restyle row containers (lines 203 + 234) from `bg-[var(--rahma-ivory)]/70` to `AdminEntityRow`-style rows on `surface-page` with proper borders; replace hard `slice(0, 8)` with `<details>` "Show all →"; split single CSV rail into three per-section grouped panels with Ghost Download chips; add `minHeight: 288` to every Recharts container (BASELINE-CRITIQUE P1 carry-forward — 6 warnings → 0); restyle metric definitions into per-metric `<details>` inside an `AdminPanel` titled "How these numbers are calculated"; retire `uppercase tracking-wide` field labels (line 219); strip raw permission identifier from `AdminAccessDenied` (line 248) replacing with brief copy "Reports access requires reporting or own-booking permission. Ask the owner if you need broader access."; preserve all 6 GET param names + 8 export keys verbatim.

## Files to NEVER touch

- `src/app/admin/reports/reporting.ts` — RECON §5 untouchable backend helpers: `getReportData`, `getRevenueSeries`, `getServicePerformance`, `getStaffWorkload`, `getStaffRevenueAttribution`, `summarizeReports`, `parseReportFilters`, `canOpenReports`, `canViewRevenueReports`, `METRIC_DEFINITIONS`.
- `src/app/admin/reports/export/route.ts` — RECON §5 untouchable CSV export route handler + the 8 export keys.
- `src/lib/auth/**` — RECON §5 auth layer.
- `src/lib/supabase/**` — RECON §5 DB layer.
- `src/middleware.ts` — admin route gating; unaffected.
- `src/components/ui/card.tsx` — out of scope for reports (00-shared-components session owns).
- Build/config files: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, `tailwind.config.*`, `postcss.config.*`.
- Main tree at `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` — user's primary workspace.

## Features preserved (Feature Preservation Manifest)

- `<form action="/admin/reports" method="GET">` contract: deep-link survives reload.
- Filter field `name` attributes verbatim: `range`, `from`, `to`, `staffId`, `source`, `paymentStatus`.
- CSV export route contract verbatim: `/admin/reports/export?report=<key>&<query>` with the 8 existing keys: `revenue_summary`, `client_summary`, `booking_list`, `payment_report`, `staff_workload_report`, `staff_revenue_attribution_report`, `service_performance_report`, `source_channel_report`.
- Role-scoped data shape: Owner / Admin see all; Coordinator's revenue rows hidden at the data layer via `canViewRevenueReports(profile)` gating; Therapist sees only own assigned bookings.
- Therapist-scope copy: page title "My report" + description "Your workload, completed sessions, and own bookings in the selected range." preserved verbatim.
- The five existing range presets (`lifetime` / `year` / `month` / `week` / `custom`) — no additions.
- Recharts library — no swap.
- `id="admin-main"` skip-link target at layout level (untouched here).

## Conflict between brief and codebase

None. Brief aligns with current codebase contract — only presentational rewrite required.
