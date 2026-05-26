# Progress — B-1 Foundation primitives

**Brief:** `redesign/briefs/B1-foundation-primitives-brief.md` (amended 2026-05-24 per B-0 findings)
**Plan:** `redesign/plans/B-phase/B1-foundation-plan.md` (amended 2026-05-24 per B-0 findings)
**Started:** 2026-05-24 (session 5)
**Completed:** TBD

**Pre-flight context (from B-0):**
- B-0 finding 1 — WCAG: Option C authorised. Brief §5.4 + plan step 1 already amended (commit `0812518`) to land 5 tokens instead of 3 (3 bg-strong + 2 text-strong). Plus 2 skeleton-pair tokens. 7 total.
- B-0 finding 2 — AdminSkeleton already shimmers at `admin-ui.tsx:1263` + `globals.css:41`. Plan step 2 re-scoped to: 2a re-point component gradient at new tokens · 2b migrate route-level `loading.tsx` files from `animate-pulse` to `<AdminSkeleton>` · 2c verify `prefers-reduced-motion`.

## Step log

(Append `step-N: COMPLETE — <one-line evidence>` per plan step.)

step-1: COMPLETE — `src/styles/tokens.css` lines 86–102 added 7 new tokens (3 bg-strong + 2 text-strong [B-0 amendment] + 2 skeleton-pair). Existing severity tokens untouched. Grep-verified.

step-2a: COMPLETE — `src/app/admin/components/admin-ui.tsx:1268-1276` AdminSkeleton re-pointed at new tokens: `bg-[var(--admin-skeleton-base)]` (was `bg-[var(--admin-border)]/40`); `via-[var(--admin-skeleton-highlight)]` (was `via-[var(--admin-panel)]/80`). Added `ease-in-out` to animation timing. Export name + prop interface preserved. HMR-reloaded in dev server cleanly.

step-2b: COMPLETE — migrated 2 of 3 candidate `loading.tsx` files. Pre-check found `src/app/admin/reports/loading.tsx` already uses `<AdminSkeleton>` end-to-end (was migrated previously; brief §6 K7 comment confirms intent) — no work needed there. Migrated: `src/app/admin/loading.tsx` (6 raw `animate-pulse` divs → `<AdminSkeleton>`) and `src/app/admin/clients/loading.tsx` (6 same). All target files grep-verified to have zero remaining `animate-pulse`. Both files now `import { AdminSkeleton }`.

step-2c: COMPLETE — `motion-reduce:hidden` Tailwind class on the sweep span (preserved from existing implementation) gives reduced-motion users a static skeleton automatically. No additional `@media` query needed. Verified via grep (`motion-reduce:hidden` still present in the new component code).

step-3: COMPLETE — `src/app/admin/components/charts/theme.ts` created with `StatusName` type, `statusFillForName(name)` (5 canonical statuses + Soft Slate fallback), `severityForDelta(value, tone)` (auto/invert + nullish handling), and `defaultChartTheme` (all CSS-variable references — no raw hex/oklch). Colocated test at `theme.test.ts` (project convention — not `__tests__/` subdir; matches `dashboard-helpers.test.ts` pattern). **8/8 specs pass** in 5.01s.

step-4: COMPLETE — 6 chart primitives created in `src/app/admin/components/charts/`:
- `SparklineChart.tsx` — minimal tile-tail line; renders nothing on empty/error (per brief §8); 4 specs
- `LineChart.tsx` — multi-series line with axes/grid/tooltip; 3 specs
- `AreaChart.tsx` — area with stack support; 3 specs
- `BarChart.tsx` — vertical bars; 3 specs
- `StackedBarChart.tsx` — horizontal default + vertical workload-row variant via `hideAxes`+`layout`; 4 specs
- `DonutChart.tsx` — PieChart with innerRadius + centre-label slot; 5 specs

Plus `chart-states.tsx` — shared `<ChartEmpty>` / `<ChartError>` placeholders with copy variants per chart family (generic "No data in this window." / Donut "Nothing to break down yet." / Stacked "No activity recorded." / Error "Couldn't load this chart. Try refreshing."). Plus `src/app/admin/components/use-reduced-motion.ts` — native matchMedia hook (avoids pulling framer-motion into admin code); 3 specs.

All chart primitives: `"use client"`, import only needed Recharts components (per-chart tree-shaking discipline per plan-step-4 mitigation), apply `defaultChartTheme`, honour `prefers-reduced-motion` via `isAnimationActive={!reduce}`. Empty/error states render plain divs (no Recharts mount) so they're cleanly testable in jsdom.

**33/33 specs pass across 8 spec files** in 13.00s. Includes hook spec (matchMedia mock + change-event listener verification).

step-5: COMPLETE — 7 tile primitives created in `src/app/admin/components/tiles/`:
- `DeltaChip.tsx` — period-over-period chip; renders nothing on nullish/NaN; up/down/neutral arrows + sr-only direction word; tone=invert support; 6 specs
- `Sparkline.tsx` — tile-tail wrapper around `<SparklineChart>` accepting plain `number[]`; 3 specs
- `CountUp.tsx` — ease-out cubic rAF animation; cancels on unmount; instant under reduced-motion + duration=0; 5 specs
- `MetricRow.tsx` — compact stripe-row stat (Personal Contribution); 7 specs
- `KpiTile.tsx` — canonical Band B tile (Cormorant marquee numeral + delta chip + sparkline/hint tail); Link variant on href with hover-lift + focus ring; 10 specs
- `TrendTile.tsx` — chart-headlined tile with optional action link; 6 specs
- `ScorecardRing.tsx` — SVG progress ring; family colour rules (Confirmed/Pending/Attention per ≥target/75-99%/<75%); reduced-motion disables transition; 7 specs

**44/44 tile specs pass across 7 spec files** in 11.69s. Full suite re-run: **189/195 passing** — the 6 failures are the pre-existing baseline failures noted in HANDOFF §4.5 (createBookingTransaction × 1, admin-access × 2, ManualBookingForm × 3). **77 new B-1 specs added, all passing. Zero baseline regression.**

step-6: COMPLETE — sandbox visual smoke at `src/app/admin/sandbox-b1/page.tsx` (NOT `__sandbox/b1/` per the plan — Next.js treats `_`-prefixed folders as private/non-routable, so the plan's path 404'd; renamed to `sandbox-b1/` to make it reachable). Sandbox is a client component (had to add `"use client"` after server-component error trying to pass `format`/`formatValue` function props to client components). 3 screenshots captured at 1280 / 768 / 375 (`redesign/baselines/screenshots-pre-B1/{viewport}/sandbox-b1-primitives.png`). Visual smoke confirms all 13 primitives render with consistent visual rhythm: DeltaChip family + tones, CountUp numerals, 3 sparkline variants, 4-up KpiTile grid (4 variants: pure number, currency, invert-tone, Link with hover-lift), MetricRow stripe (4 rows), ScorecardRing at 4 target ratios (Confirmed/Pending/Attention/tiny), TrendTile with LineChart + BarChart side-by-side, AreaChart + DonutChart (with centre label) + StackedBarChart row, chart edge cases (empty / error / single-point), workload-row stacked bar vertical variant.

**Plan-bug noted:** B-1 plan step 6 specifies path `src/app/admin/__sandbox/b1/page.tsx` but the `__` prefix makes Next.js treat the folder as private (opt-out of routing). Used `src/app/admin/sandbox-b1/page.tsx` instead. Doesn't change the plan's intent (page deleted before commit per step 7); just a path correction for future implementers.

step-7 (plan numbering = delete-sandbox-before-bundle): COMPLETE — `src/app/admin/sandbox-b1/` deleted before `pnpm build` so the sandbox imports don't inflate the measurement. `git status` confirms no sandbox files remain.

step-8 (plan numbering = bundle delta verification): COMPLETE — `pnpm build` succeeded in ~25s (compile) + ~80s (typecheck). Bundle measured via committed dev script `scripts/measure-admin-bundles.mjs` (extraction logic reusable for B-2 through B-6 + Phase 7 audit). **Deltas vs `bundle-pre-B1.json`:**
- `/admin/dashboard`: 458.83 kB gzip (delta **+0.02 kB**)
- `/admin/reports`: 452.04 kB gzip (delta **+0.02 kB**)
- `/admin/clients/[clientId]`: 336.26 kB gzip (delta **+0.01 kB**)
- `/admin/staff/[staffId]`: 339.62 kB gzip (delta **+0.02 kB**)

All four routes under +0.05 kB — comfortably below the +12 kB budget (SHARED-NOTES §5). Expected: B-1 primitives are dormant in this phase (no consumers in existing pages yet). The two `loading.tsx` files were migrated to compose `<AdminSkeleton>` which was already shared infrastructure, so the bundle barely moves. Real bundle growth lands in B-3 (+25/+18 kB on /admin/me and /admin/staff/[staffId]/performance) when primitives get consumed.

step-cleanup: COMPLETE — `pnpm lint` clean (0 errors, 0 warnings after one fix). First lint pass flagged `react-hooks/set-state-in-effect` on the `useReducedMotion` hook (React 19 rule banning setState inside useEffect when an external store pattern exists). Rewrote the hook to use `useSyncExternalStore` (the canonical React subscription primitive) — semantically equivalent, lint-clean, SSR-safe by design. Updated the hook spec mock to flip the closure-captured `matches` before firing the listener (since `useSyncExternalStore` re-reads via `getSnapshot` rather than from the event arg). Hook + tiles + charts re-run: **77/77 pass** in 26.91s.

step-playwright: COMPLETE — Playwright sweep on Owner: `/admin/dashboard` renders cleanly (0 console errors); `/admin/reports` renders cleanly (0 console errors). The only meaningful B-1 touchpoint on existing pages is the `AdminSkeleton` token re-pointing + `loading.tsx` migrations — both are transparent to populated-state rendering. `/admin/clients` had been verified during step 2 (the existing `caret-color` hydration warning is pre-existing baseline, not a B-1 regression). Post-B-1 screenshot saved at `redesign/baselines/screenshots-pre-B1/1280/post-b1-owner-reports.png`. (Skeleton shimmer visual diff vs B-0 pulse is verifiable side-by-side with the `loading-clients-post-b1-shimmer.png` captured during step 2 + the documented pre-B-1 raw `animate-pulse` divs in `screenshots-pre-B1/README.md`.)

## Verification gate

- [ ] Static lint clean (`pnpm lint`)
- [ ] Static types clean (`npx tsc --noEmit`)
- [ ] Vitest all new specs pass; baseline preserved
- [ ] Bundle delta within budget (≤ +12kB gzip on `/admin/dashboard` per B-0 baseline)
- [ ] Visual smoke screenshots at 375 / 768 / 1280
- [ ] Skeleton regression check on existing admin pages
- [ ] Sandbox cleanup (`git status` shows no `__sandbox/` files)

## Hand-off

Next phase: B-2 (metric backend).
