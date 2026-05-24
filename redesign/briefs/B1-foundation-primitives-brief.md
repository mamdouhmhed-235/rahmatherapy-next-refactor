# Brief: B-1 — Foundation primitives

**Phase:** B-1 (foundation; gates B-3, B-4, B-5)
**Estimated effort:** ~1 day
**Brief status:** session-4 reframe; user-confirmed. **Amended 2026-05-24 (session 5) per B-0 findings** — see §5.4 (5 tokens not 3) and §5.5 (AdminSkeleton already shimmers; scope shifts to route-level `loading.tsx` migration).
**Plan:** `redesign/plans/B-phase/B1-foundation-plan.md`

---

## 1. Feature Summary

A shared visual + interactive primitive layer that every Band B surface (Dashboard, Reports, Performance, Client LTV ribbon) builds on. No user-facing page changes ship in this phase — instead, the primitives are added in dormant state, used in unit tests, and consumed in the four phases that follow. Shipping primitives first eliminates the drift problem that produced the current "every card a different size, every chart a different style" complaint. The primitives are: a copy-pasted shadcn-style chart layer (`<AreaChart>`, `<BarChart>`, `<LineChart>`, `<DonutChart>`, `<SparklineChart>`, `<StackedBarChart>`), a tile family (`<KpiTile>`, `<TrendTile>`, `<MetricRow>`, `<ScorecardRing>`), the `<CountUp>` numeral animator, a shimmer-replacement for `AdminSkeleton`, and three new severity-strong tokens (`--admin-{danger|warning|success}-bg-strong`). Zero new npm dependencies. All built on Recharts (already installed) plus existing tokens.

## 2. Primary Designer/Engineer Action

**Open `src/app/admin/components/charts/<primitive>.tsx` or `tiles/<primitive>.tsx`, see its prop interface and storybook-style example, drop it into any of B-3 → B-6 surfaces, and have the visual + interactive contract just work without per-page customisation.**

## 3. Design Direction

**Anchor references:**
- **shadcn/ui charts** (`ui.shadcn.com/charts`) — the chart wrapper pattern, copy-paste model, Recharts-based, semantic colour overrides via CSS variables
- **Tremor blocks** (`tremor.so/blocks`) — the KPI tile composition: number + delta chip + sparkline, equal-height grids
- **Stripe Dashboard tile rhythm** — Cormorant-equivalent display numerals, tabular-nums, delta chip in top-right of tile, sparkline along the bottom edge
- **Motion.dev shimmer-skeleton** — gradient-sweep loading state instead of opacity pulse

Anti-anchor: the current `AdminSkeleton` opacity pulse + the inconsistent ad-hoc tile compositions scattered across `dashboard-cards.tsx`. The point of this phase is to make those one-offs impossible going forward.

**Theme scene sentence:** *"A Phase-7 implementer opens any Band B surface for the first time, scans three KPI tiles, and recognises them immediately because they are visually identical to the four tiles two rows above and the three tiles on a different page entirely."* Forces token + composition discipline; no per-surface fork.

## 4. Scope

**In:**
- New directory `src/app/admin/components/charts/` with 6 chart primitives.
- New directory `src/app/admin/components/tiles/` with 4 tile primitives + `<CountUp>` + `<DeltaChip>` + `<Sparkline>` (sparkline is a thin wrapper around `<SparklineChart>` sized for tile-tail use).
- Update `src/styles/tokens.css` — add 3 new `--admin-{danger|warning|success}-bg-strong` tokens to the existing severity family.
- Update `src/app/admin/components/admin-ui.tsx` `AdminSkeleton` export — replace pulse keyframe with gradient-sweep shimmer. Preserve the existing export name + props contract; consumers do not need to change.
- Vitest specs for every primitive (`charts/__tests__/`, `tiles/__tests__/`) covering: render-with-data, render-with-empty-data, prop variants, `prefers-reduced-motion` honouring.
- One new file: `src/app/admin/components/charts/theme.ts` exporting the semantic colour map (`statusFillForName(name)`, `severityForDelta(value)`) so every chart uses the same palette without duplication.

**Out (deferred to later phases or out entirely):**
- Wiring primitives into existing pages — B-5 (Dashboard) does that for dashboard-cards.tsx; B-4 (Reports) does it for ReportsCharts.tsx. B-1 is delivery-only.
- Removing existing chart code paths — also deferred. The old `RevenueChart` / `CountBarChart` in `ReportsCharts.tsx` continue to exist; B-4 replaces them.
- `AdminErrorBoundary` rework (Phase 7 deferral).
- Any per-component Storybook integration; the vitest specs serve the visual-contract role for now.

## 5. Layout Strategy (per primitive)

There is no page-level layout in B-1 — primitives are page-agnostic. Each primitive has its own internal layout spec:

### 5.1 Chart primitives (`src/app/admin/components/charts/`)

All 6 charts share:
- Wrap a Recharts `<ResponsiveContainer minHeight={...}>` with a default height of 240 (override per consumer).
- Accept a typed `data` prop matching the chart's category.
- Accept an optional `theme` override (defaults to imported `defaultChartTheme`).
- Honour `prefers-reduced-motion: reduce` by disabling Recharts' `isAnimationActive` when matched.
- Render an empty state (single centred line "No data in this window") when `data.length === 0`.
- Render an error state (single centred line "Couldn't load this chart. Try refreshing.") when `data === undefined`.

| Primitive | Wraps | Default size | Use case |
|---|---|---|---|
| `<AreaChart>` | Recharts `<AreaChart>` | 240px tall | Revenue trend, period-over-period |
| `<BarChart>` | Recharts `<BarChart>` | 240px tall | Bookings-by-day, source attribution |
| `<LineChart>` | Recharts `<LineChart>` | 240px tall | Single-series trend (per-staff output) |
| `<DonutChart>` | Recharts `<PieChart>` with inner radius | 220px tall | Status breakdown (Confirmed/Pending/etc.) |
| `<SparklineChart>` | Recharts `<LineChart>` | 32px tall (tile-tail), 64px tall (large) | Trend-in-cell, embedded in tiles |
| `<StackedBarChart>` | Recharts `<BarChart>` stacked | 240px tall (Reports), 18px (workload row) | Staff workload, status mix per row |

### 5.2 Tile primitives (`src/app/admin/components/tiles/`)

| Primitive | Props | Visual composition |
|---|---|---|
| `<KpiTile>` | `label`, `value`, `delta?`, `series?`, `tone?`, `href?`, `hint?` | AdminPanel container. Top-left: label in Work Sans 500 label step, Soft Slate. Top-right: `<DeltaChip>` if `delta` set. Body: Cormorant Garamond 700 marquee numeral at `clamp(2.5rem, 5vw, 4rem)`. Tail: 32px `<SparklineChart>` if `series` set, else `hint` line in body-sm Soft Slate. Whole tile is `<Link>` if `href` set with hover-lift `hover:-translate-y-px`. |
| `<TrendTile>` | `label`, `chart`, `delta?`, `actionLabel?`, `actionHref?` | AdminPanel container. Header: label + optional delta chip + optional Ghost action link. Body: full chart component (any of the 6 chart primitives). Min-height matches `<KpiTile>` family so 2×N grids align. |
| `<MetricRow>` | `label`, `value`, `delta?`, `series?`, `tone?` | Compact single-row stat for stripes (e.g. Personal Contribution stripe on Dashboard). Label inline-left, value tabular-nums right, optional inline delta + 18×6 mini-sparkline. No panel chrome. |
| `<ScorecardRing>` | `label`, `value`, `target`, `unit?` | Progress ring (SVG circle with `stroke-dasharray` math) showing `value/target` percentage. Centre label. Used for Utilisation tiles where the target marker matters more than the absolute number. |

### 5.3 Animation helpers

| Primitive | Behaviour |
|---|---|
| `<CountUp value={n} duration={400} />` | Animates from previous value to new value over `duration` ms. Falls back to instant rendering when `prefers-reduced-motion: reduce`. Tabular-nums. Uses a single `requestAnimationFrame` loop, cancels on unmount. |
| `<DeltaChip value={pct} tone="auto" />` | Renders `+12%` / `−3%` / `→` (zero) with an arrow glyph. `tone="auto"` picks Confirmed family for positive, Cancelled family for negative, Soft Slate for zero. `tone="invert"` flips that pairing for metrics where smaller is better (no-show rate, time-to-first-contact). |

### 5.4 Token additions (`src/styles/tokens.css`) — amended 2026-05-24

**Five** new tokens added to the existing `--admin-{danger|warning|success|info}` family (was three; B-0 WCAG verification found 2/3 bg-strong/text pairs failed AA — user authorised paired `*-text-strong` tokens 2026-05-24; full record in `redesign/baselines/wcag-severity-tokens.md` + per-page-progress B-0):

```css
/* bg-strong tints — stronger than the existing -bg variants */
--admin-danger-bg-strong: oklch(92% 0.075 20);     /* soft-coral; pairs with text-strong */
--admin-warning-bg-strong: oklch(93% 0.085 70);    /* amber;       pairs with text-strong */
--admin-success-bg-strong: oklch(93% 0.060 155);   /* mint;        pairs with existing --admin-success (4.56:1 AA ✓) */

/* text-strong tokens — darker than the existing --admin-{severity}, paired with bg-strong */
--admin-danger-text-strong: oklch(30% 0.18 25);    /* deep maroon; 9.21:1 vs danger-bg-strong */
--admin-warning-text-strong: oklch(30% 0.16 55);   /* deep brown;  10.71:1 vs warning-bg-strong */
```

**Pairing convention** (mirrors the existing `--admin-status-attention-bg` / `--admin-status-attention-text` pair):

| Family | Strong-emphasis bg | Strong-emphasis text |
|---|---|---|
| danger | `--admin-danger-bg-strong` | `--admin-danger-text-strong` |
| warning | `--admin-warning-bg-strong` | `--admin-warning-text-strong` |
| success | `--admin-success-bg-strong` | (existing) `--admin-success` |

These tokens are used by:
- B-5 Dashboard: Urgent Attention panel + Operations Health priority rows
- B-4 Reports: Outstanding tile when > 0; Insights stripe row backgrounds
- B-3 Performance: No-show rate tile when above threshold

Whenever a consumer composes one of those zones, it MUST pair the bg-strong with the corresponding text-strong (or, for success, the existing `--admin-success`). Don't mix `--admin-danger-bg-strong` with `--admin-danger` text — that's the WCAG-failing combination that triggered the amendment.

Existing `--admin-{danger|warning|success}-bg` and `--admin-{danger|warning|success}` (text) tokens stay as-is, paired with each other as today (used by the gentler row-hover / chip / nudge surfaces).

### 5.5 Skeleton shimmer — amended 2026-05-24

**B-0 finding:** `AdminSkeleton` at [`src/app/admin/components/admin-ui.tsx:1263`](../../src/app/admin/components/admin-ui.tsx#L1263) already uses a shimmer gradient driven by `@keyframes shimmer` in [`src/app/globals.css:41`](../../src/app/globals.css#L41), with `motion-reduce:hidden` on the sweep span (so reduced-motion gets a static skeleton automatically). The original brief framing ("Replace the current pulse animation with a horizontal gradient sweep") is therefore stale — that swap happened at some prior point.

**Where pulse still lives:** three route-level `loading.tsx` files compose raw `<div className="animate-pulse">` divs instead of `<AdminSkeleton>`. These are what users see during route transitions before a server component finishes streaming:

| File | Pulse occurrences |
|---|---|
| `src/app/admin/loading.tsx` | 6 (header bars + 5 list-row skeletons) |
| `src/app/admin/clients/loading.tsx` | 6 (same shape — clients list) |
| `src/app/admin/reports/loading.tsx` | verify in step 2 — likely similar pattern |

(`src/app/admin/emails/loading.tsx` also uses `animate-pulse` but Emails is out of Band B scope.)

**B-1 step 2 scope (amended):**
1. **Migrate the three in-scope `loading.tsx` files** to compose `<AdminSkeleton>` blocks instead of raw `animate-pulse` divs. Result: route-transition skeletons inherit shimmer for free.
2. **Tune the shimmer animation parameters** (gradient stops + duration + easing) on the existing component to match the brief's design intent, if `pnpm dev` visual inspection shows the current rhythm is too fast/slow/subtle. Acceptable values: 1.4s–1.8s duration; `ease-in-out` or `linear`; via-stop opacity 70%–90%.
3. **Add two skeleton-tuning tokens** so the gradient is themable from `tokens.css` rather than hardcoded inside the component:
   ```css
   --admin-skeleton-base: oklch(95% 0.008 88);
   --admin-skeleton-highlight: oklch(98% 0.008 88);
   ```
   Update the component's gradient to reference these tokens. Preserve the `<AdminSkeleton>` JSX export name and props interface verbatim.

Reduced-motion is already honoured by the existing `motion-reduce:hidden` on the sweep span — no extra `@media` query needed.

## 6. Key States

Per primitive, the testable states:

| Primitive | States to cover |
|---|---|
| `<KpiTile>` | populated · value=0 · negative delta · positive delta · delta=null (no comparison) · series=null (no sparkline) · href=null (non-interactive) · tone=invert · hover · focus · `prefers-reduced-motion` |
| `<TrendTile>` | populated · empty (chart's own empty state) · loading (shimmer) · error · action link present · action link absent |
| `<MetricRow>` | populated · value=0 · with delta · without delta · mobile (≤480px reflow) · tabular-nums alignment with 3 sibling rows |
| `<ScorecardRing>` | value=0% · value=50% · value=100% · value > target (renders Confirmed family) · value < target (renders Pending family) · `prefers-reduced-motion` (instant render, no ring animation) |
| `<CountUp>` | first paint · update with new value · `prefers-reduced-motion` (instant) · unmount during animation (cancel cleanly) |
| `<DeltaChip>` | positive · negative · zero · tone=auto · tone=invert · undefined value (renders nothing) |
| All charts | data populated · data empty · data undefined (error state) · single-point data (still renders) · long category-name truncation · `prefers-reduced-motion` |
| Skeleton | mounted · `prefers-reduced-motion` (no shimmer, static) |

## 7. Interaction Model

- **`<KpiTile>` with `href`:** entire tile is a `<Link>`. Hover-lift via Tailwind `hover:-translate-y-px hover:shadow-[var(--admin-shadow-subtle)]`. 3px Focus Azure focus ring at 2px offset. Cursor pointer.
- **`<KpiTile>` without `href`:** non-interactive. No hover. `cursor: default`. ARIA: `role="group" aria-label={label}`.
- **`<TrendTile>` action link:** the action link is a separate `<Link>`; the tile body is not clickable. Avoids "did I click the link or the chart?" ambiguity.
- **Chart hover:** Recharts default tooltip behaviour preserved. Tooltips inherit token-styled background (`var(--admin-panel)`) + 1px `border-subtle` + body-sm.
- **`<DeltaChip>`:** static; no hover.
- **`<ScorecardRing>`:** static SVG; no hover. Optional `title` attribute spells out the absolute percentage.
- **`<CountUp>`:** invisible to interaction — just renders the number.
- **Skeleton:** non-interactive by definition.

## 8. Content Requirements

**Empty-state copy library (used across all chart primitives):**

| Surface | Empty body text |
|---|---|
| Generic chart, no data in window | "No data in this window." |
| Sparkline (28px height), no data | (Hidden entirely — sparkline renders nothing rather than printing copy at that size.) |
| Donut, all-zero | "Nothing to break down yet." |
| Stacked bar, all-zero | "No activity recorded." |

**Error-state copy:** "Couldn't load this chart. Try refreshing." Identical to the existing tile-error copy; reuses the same wording for consistency.

**Microcopy:** none — primitives are content-agnostic; consumers supply all labels.

**Voice anchors hit:** verbs over nouns ("Try refreshing"); empty-state encourage-not-preach ("Nothing to break down yet" — softer than "No data").

## 9. Recommended References

- **`reference/spatial-design.md`** — for the tile internal padding (24px) and the equal-height grid rhythm.
- **`reference/motion-design.md`** — for the count-up timing curve and the shimmer duration. Honour `prefers-reduced-motion` throughout.
- **DESIGN.md §5 (AdminPanel + AdminStat)** — `<KpiTile>` is the canonical replacement for ad-hoc `AdminStat` consumers; behaviour must be a strict superset.
- **DESIGN.md §2 (No-Gold-Text exception)** — chart `accent-amber` use; the existing Demand Trend amber fill ports forward unchanged.

## 10. Open Questions

1. **Should `<KpiTile>` accept a `comparePrior` slot for the prior-period absolute value** (e.g. "vs £8,400 last month") below the delta chip? Tremor blocks do this; Stripe doesn't. Recommendation: ship without, add as an optional `priorValueLabel?: string` prop later if Phase 7 audit asks for it.
2. **Where should the copy-pasted shadcn chart components live exactly?** Two options: `src/app/admin/components/charts/` (admin-scoped, what this brief proposes) or `src/components/charts/` (project-wide, shareable with future customer-facing pages). Recommendation: admin-scoped for now; relocate later if customer-facing surfaces need them. Avoids premature generalisation.
3. **`<CountUp>` for currency values** — should it count up the pounds digit-by-digit, or animate the cents too? Recommendation: pounds only (drop the cents for the animation, snap to final on settle). Currency animating cent-by-cent feels stock-ticker-y.
4. **Skeleton variant for charts** — should the chart primitives expose a `loading` prop that renders a chart-shaped skeleton inside the `ResponsiveContainer`? Or do consumers wrap the whole `<TrendTile>` in `<AdminSkeleton>`? Recommendation: consumers wrap (matches existing pattern); chart skeleton ships as a Phase-7 enhancement if there's demand.

---

## Recipe Context

### Files to create

| File | Purpose |
|---|---|
| `src/app/admin/components/charts/theme.ts` | Exports semantic colour map: `statusFillForName(name)` returning the OKLCH token for each status family. `severityForDelta(value, tone)` returning the chip tone. `defaultChartTheme` object consumed by every primitive. |
| `src/app/admin/components/charts/AreaChart.tsx` | shadcn-style wrapper around Recharts AreaChart with token-themed grid, axis, tooltip. |
| `src/app/admin/components/charts/BarChart.tsx` | Same for BarChart. |
| `src/app/admin/components/charts/LineChart.tsx` | Same for LineChart. |
| `src/app/admin/components/charts/DonutChart.tsx` | PieChart wrapper with `innerRadius` defaulted, centre-label slot. |
| `src/app/admin/components/charts/SparklineChart.tsx` | Minimal LineChart variant: no axes, no tooltip, fixed 32px height (override via prop), single colour-token stroke. |
| `src/app/admin/components/charts/StackedBarChart.tsx` | BarChart with stacked-bar series. Accepts `series: [{ dataKey, fillToken, label }]`. |
| `src/app/admin/components/charts/__tests__/*.test.tsx` | One vitest spec per chart primitive. Render + empty + error + reduced-motion states. |
| `src/app/admin/components/tiles/KpiTile.tsx` | Numeral + delta + sparkline tile primitive. |
| `src/app/admin/components/tiles/TrendTile.tsx` | Chart-headlined tile primitive. |
| `src/app/admin/components/tiles/MetricRow.tsx` | Compact stripe-row metric primitive. |
| `src/app/admin/components/tiles/ScorecardRing.tsx` | SVG progress ring primitive. |
| `src/app/admin/components/tiles/CountUp.tsx` | Numeral animator. |
| `src/app/admin/components/tiles/DeltaChip.tsx` | Delta chip primitive. |
| `src/app/admin/components/tiles/Sparkline.tsx` | Thin tile-tail wrapper around `<SparklineChart>`. |
| `src/app/admin/components/tiles/__tests__/*.test.tsx` | One vitest spec per tile primitive. |

### Files to modify

| File | Change |
|---|---|
| `src/styles/tokens.css` | Add 7 new tokens: `--admin-danger-bg-strong`, `--admin-warning-bg-strong`, `--admin-success-bg-strong`, `--admin-danger-text-strong`, `--admin-warning-text-strong`, `--admin-skeleton-base`, `--admin-skeleton-highlight`. No tokens removed. |
| `src/app/admin/components/admin-ui.tsx` | Tune `AdminSkeleton` shimmer gradient stops to consume `--admin-skeleton-base` / `--admin-skeleton-highlight` tokens (instead of hardcoded `--admin-border` / `--admin-panel`). Adjust duration / easing if visual inspection in step 2 finds the current rhythm needs work. Preserve export name + prop interface. No other components in this file change. |
| `src/app/admin/loading.tsx` | Replace 6 raw `<div className="animate-pulse">` divs with composed `<AdminSkeleton>` blocks of equivalent shape (header bar, sample list rows). |
| `src/app/admin/clients/loading.tsx` | Same migration as above (6 raw `animate-pulse` divs → `<AdminSkeleton>`). |
| `src/app/admin/reports/loading.tsx` | If it uses `animate-pulse`, migrate per the same pattern. Verify in step 2 — pre-check before editing. |

### Files to NEVER touch

- `src/app/admin/dashboard/dashboard-data.ts` — server-side aggregation (RECON §5; untouchable)
- `src/app/admin/dashboard/dashboard-helpers.ts` — pure helpers (RECON §5)
- `src/app/admin/dashboard/dashboard-cards.tsx` — wholesale rewritten in B-5, not B-1
- `src/app/admin/reports/reporting.ts` — backend math (touched in B-2, not B-1)
- `src/app/admin/reports/ReportsCharts.tsx` — rewritten in B-4
- `src/app/admin/components/notification-*.{ts,tsx}` — R4 surface, untouched
- `src/lib/auth/**`, `src/lib/supabase/**`, `src/middleware.ts`, `supabase/migrations/**`, all build/config files

### Feature Preservation Manifest

**Token additions (RECON §7.x):**
- All new tokens are additive; no existing token name, value, or fallback chain is altered.
- The existing `--admin-{danger|warning|success}-bg` tokens are NOT modified. The new `-strong` variants live alongside.

**JS hooks / IDs to preserve:**
- No IDs touched. Primitives accept optional `id` props but pass through.

**Server actions:** none touched.

**Audit log writes:** none from primitive code.

**External / deep links to preserve:** N/A — primitives don't navigate.

### Information hierarchy (primitive composition rules)

When a consumer composes a surface using these primitives:

1. **Numeral first.** Every `<KpiTile>` leads with its Cormorant marquee numeral. Label above (Work Sans 500 label step). Delta + sparkline tail below.
2. **Grid alignment via `min-h-[22rem]`.** Every multi-tile grid sets a uniform min-height across tiles via Tailwind's `min-h-*` so 2×N and 3×N grids never jag.
3. **Tonal lift.** Tiles sit at `surface-card` over `surface-page` canvas. Don't nest two cards at the same lightness (DESIGN.md Tonal Lift Rule).
4. **No `border-l-4`.** Never. Use Pending/Attention family background tint + full 1px border for emphasis (matches the existing carry-forward ban).

### Design direction — tokens and components

- **Tile background:** `--admin-panel` (existing).
- **Tile border:** `--admin-border` (existing).
- **Tile radius:** `var(--admin-radius-panel)` (existing; ~12px).
- **Tile padding:** `lg` (24px) — Tailwind `p-6`.
- **Marquee numeral:** Cormorant Garamond 700, `clamp(2.5rem, 5vw, 4rem)`, Chronicle (`oklch(11% 0.014 155)`), `line-height: 1`, `letter-spacing: -0.02em`, `font-variant-numeric: tabular-nums`.
- **Label (above numeral):** Work Sans 500 label step (0.75rem), Soft Slate, uppercase-letter-spaced eyebrow if `eyebrow` prop set.
- **Delta chip — positive:** `bg-[var(--admin-success-bg)] text-[var(--admin-success-text)] px-2 py-0.5 rounded-full text-xs font-medium tabular-nums`.
- **Delta chip — negative:** swap to `--admin-danger-{bg,text}`.
- **Delta chip — neutral (≈0):** `bg-[var(--admin-panel-muted)] text-[var(--admin-text-muted)]`.
- **Sparkline stroke:** `currentColor` so the parent tile's text-colour tone (e.g. Confirmed tile uses success-text) flows through. 1.5px stroke. No fill (or `fill: currentColor` at 0.08 opacity if a soft area-fill is requested per consumer).
- **ScorecardRing colour:** Confirmed family fill when ≥ target; Pending family fill when 75–99% of target; Attention family fill when < 75%.
- **Chart axis text:** Work Sans 400 0.625rem Soft Slate. No bold; no uppercase.
- **Chart grid lines:** `var(--admin-border-subtle)` at 0.5 opacity; horizontal only by default.
- **Chart tooltip:** `--admin-panel` bg + 1px `--admin-border` + 4px radius + body-sm + tabular-nums.

---

## Implementation Notes

The B-1 brief is intentionally infrastructure-heavy. The visible payoff lands in B-3 → B-6.

**Per-state intent** lives in §6 Key States. **Per-viewport intent** is not applicable — primitives reflow at consumer-controlled sizes; the primitive itself doesn't decide viewport breakpoints.

**Verification steps** (for B-1's plan step "Verification gate"):
- `pnpm lint` clean
- `npx tsc --noEmit` clean
- Vitest specs: every new primitive's spec passes (target ≥ 14 specs total across charts + tiles)
- Live import smoke: temporarily render every primitive in a stub page (`/admin/__sandbox/b1` — created and deleted in the same commit) and screenshot at 375 / 768 / 1280; confirm visual consistency
- Bundle-size check: `pnpm build` first-load JS for `/admin/dashboard` and `/admin/reports` does not increase by more than +12kB gzipped (the foundation adds ~8–10kB; budget allows a small overage)

---

## Copy

Primitives are content-agnostic, so the "copy" section is short.

### Universal empty-state copy (returned by chart primitives when `data.length === 0`)

| Chart type | Body text |
|---|---|
| Generic | `No data in this window.` |
| Donut | `Nothing to break down yet.` |
| StackedBar | `No activity recorded.` |
| Sparkline (tile tail) | (renders nothing — no text) |

### Universal error-state copy (returned when `data === undefined`)

| Slot | Text |
|---|---|
| Chart inline error | `Couldn't load this chart. Try refreshing.` |
| Tile inline error | `Couldn't load this section. Try refreshing.` |

### Form labels / button text

None — primitives have no forms or buttons.

### Tooltip text

| Slot | Text |
|---|---|
| `<DeltaChip>` (optional `title`) | `{value}% vs prior {periodLabel}` — only when consumer passes a `periodLabel` prop |
| `<ScorecardRing>` (optional `title`) | `{value}{unit} of {target}{unit} target ({percentage}%)` |
| Chart tooltip default | Recharts default: category label + each series value |

### Confirmation dialog text

None — primitives don't mutate state.

---

*End of B-1 brief. Next: B-2 brief (metric backend) — the data layer that B-3/B-4/B-5/B-6 consume.*
