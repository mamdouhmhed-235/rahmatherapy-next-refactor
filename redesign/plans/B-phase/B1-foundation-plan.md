# Plan: B-1 — Foundation primitives

**Brief:** `redesign/briefs/B1-foundation-primitives-brief.md`
**Effort:** ~1 day
**Prerequisites:** none (foundation phase)
**Gates:** B-3, B-4, B-5, B-6 all consume B-1 primitives
**Safety label:** ADDITIVE (token additions; new files only; one modification to `admin-ui.tsx` skeleton style block)
**Blocks redesign:** YES (every subsequent B-phase imports from `charts/` and `tiles/`)

---

## What this is

A new shared primitive layer in `src/app/admin/components/charts/` and `src/app/admin/components/tiles/`, plus three severity-strong tokens added to `tokens.css`, plus a shimmer keyframe replacing the existing pulse in `AdminSkeleton`. No user-facing page changes ship in this phase — primitives are added in dormant state, exercised in vitest specs, and consumed by B-3 → B-6.

## Why it's needed

The user's complaint about Dashboard and Reports — "card sizes don't match, spacing is off, every chart a different style, colours muted to washout" — is rooted in *primitive drift*. Phase 6 shipped per-page ad-hoc tile compositions; without a shared primitive layer, every page B-3/B-4/B-5/B-6 ships would reinvent the wheel. B-1 makes drift impossible by establishing the canonical tile + chart + token vocabulary. Zero new dependencies; copy-pasted shadcn/Tremor-Raw pattern (per session-4 chart-library decision).

## What this does (user story)

"As a Phase-7 implementer building any Band B surface, I open `src/app/admin/components/charts/<primitive>.tsx`, see its prop interface, drop it into my page, and have the visual + interactive contract just work — no per-page customisation, no token drift, no jagged grids."

## What information it stores or retrieves

None — pure UI primitives. No DB access. No server state. Composition over already-fetched data passed via props.

## Who can use it

Any admin-surface component. No RBAC at the primitive layer (primitives are role-agnostic; consumers enforce RBAC).

## What can go wrong

- **Recharts import bloat**: each chart primitive imports Recharts components; without tree-shaking discipline, the first-load JS for any Band B page balloons. Mitigation: import individual Recharts components per chart file (`import { LineChart, Line } from 'recharts'`); do not re-export the entire Recharts namespace. Verify with `pnpm build` first-load JS diff < +12kB gzip.
- **`prefers-reduced-motion` honoured inconsistently**: each primitive's animation path must check the media query. Mitigation: extract `useReducedMotion()` hook in a shared utility; every animated primitive uses it.
- **OKLCH browser support**: severity-strong tokens use OKLCH. Modern Safari/Chrome/Firefox support; legacy WebViews may not. Mitigation: the existing `tokens.css` already uses OKLCH extensively (R4 + Phase 6); B-1 inherits the same baseline.
- **Skeleton shimmer regression on existing pages**: every page using `<AdminSkeleton>` will get the new shimmer for free. Mitigation: visual smoke pass — sign in, navigate to every admin page (existing list), confirm shimmer renders sanely. If a page renders pulse-skeleton incorrectly, the issue is pre-existing baseline (logged but not fixed in B-1).
- **`<CountUp>` cancellation race**: if the component unmounts mid-animation, `requestAnimationFrame` callback could call setState on unmounted component. Mitigation: ref-track mount state; bail in the rAF callback if unmounted.
- **`<ScorecardRing>` SVG `stroke-dasharray` math precision**: rounding at low percentages (e.g. 1%) can render a 0-length arc. Mitigation: clamp the dasharray to a minimum visible value (e.g. 0.5%).

## How to verify it works

Three verification rounds:

1. **Static gate:**
   - `pnpm lint` → 0 errors, 0 new warnings
   - `npx tsc --noEmit` → 0 errors
2. **Vitest gate:**
   - All new primitive specs pass (target ≥14 specs total).
   - Existing 112 passing specs continue to pass — no regression.
3. **Visual smoke gate:**
   - Sign in as Owner. Navigate to `/admin/dashboard` and `/admin/reports` (existing pages, B-1 hasn't touched their content).
   - Confirm the shimmer skeleton replacement renders correctly during load.
   - Then create a sandbox page at `/admin/__sandbox/b1/page.tsx` (temporary, NOT committed):
     ```tsx
     // Renders every primitive with sample data; visual reference for the next phases.
     ```
   - Screenshot at 375 / 768 / 1280. Confirm visual consistency across all primitives.
   - Delete `/admin/__sandbox/b1/page.tsx` in the same commit.
4. **Bundle-size gate:**
   - `pnpm build` baseline first-load JS for `/admin/dashboard` recorded as **N kB** (pre-B-1).
   - Same after B-1: **M kB**. Confirm `M − N ≤ 12kB gzipped`.

## Safe implementation order

The order is important — primitives are interdependent (KpiTile uses Sparkline; Sparkline uses SparklineChart; DeltaChip is used by KpiTile + MetricRow; etc.).

### Step 1 — Tokens (`tokens.css`)
- Add `--admin-danger-bg-strong`, `--admin-warning-bg-strong`, `--admin-success-bg-strong`, `--admin-skeleton-base`, `--admin-skeleton-highlight` to `src/styles/tokens.css`.
- Token values per brief §5.4 + §5.5.
- **Verify:** `pnpm lint` clean; grep `tokens.css` for the new tokens.

### Step 2 — Skeleton shimmer (`admin-ui.tsx`)
- Locate the `<AdminSkeleton>` style block.
- Replace the existing pulse keyframe with the gradient-sweep shimmer per brief §5.5.
- Add the `@media (prefers-reduced-motion: reduce)` clause.
- Preserve the JSX export name and prop interface verbatim.
- **Verify:** dev server reload; navigate to any admin page; confirm shimmer renders on the existing skeleton placeholders.

### Step 3 — Theme map (`charts/theme.ts`)
- Create `src/app/admin/components/charts/theme.ts`.
- Export `statusFillForName(name)`, `severityForDelta(value, tone)`, `defaultChartTheme`.
- `statusFillForName` maps booking status names (Confirmed / Pending / Completed / Cancelled / NoShow) to OKLCH token references (no raw hex).
- **Verify:** unit test `theme.test.ts` covering all 5 status names + one unknown name (returns default Slate).

### Step 4 — Chart primitives (`charts/*.tsx`)
- Create in this order: `SparklineChart`, `LineChart`, `AreaChart`, `BarChart`, `StackedBarChart`, `DonutChart`. SparklineChart first because Sparkline (tile-tail) wraps it.
- Each chart imports only the Recharts components it needs (`import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'`).
- Each chart applies `defaultChartTheme` from `theme.ts`.
- Each chart honours `prefers-reduced-motion` by setting `isAnimationActive={false}` when matched.
- Each chart renders an empty state when `data.length === 0`.
- Each chart renders an error state when `data === undefined`.
- **Verify per chart:** unit test covering populated, empty, error, single-point, reduced-motion.

### Step 5 — Tile primitives (`tiles/*.tsx`)
- Create in this order: `DeltaChip`, `Sparkline` (thin wrapper around `<SparklineChart>`), `CountUp`, `MetricRow`, `KpiTile`, `TrendTile`, `ScorecardRing`.
- DeltaChip / Sparkline / CountUp first — KpiTile + MetricRow depend on them.
- Each tile uses tokens from `tokens.css`; no raw hex.
- KpiTile honours `href` prop with `<Link>` wrap when set.
- ScorecardRing math: `circumference = 2 * π * r`; `dashOffset = circumference * (1 - value / target)`; clamp at min 0.5%.
- **Verify per tile:** unit test covering all states in brief §6 table.

### Step 6 — Sandbox visual smoke (temporary) — per AUDIT H5 — reordered
- Create `src/app/admin/__sandbox/b1/page.tsx` rendering every primitive with sample data.
- **Use `pnpm dev` (NOT `pnpm build`)** to view the sandbox. Sign in as Owner; navigate to `/admin/__sandbox/b1`; screenshot at 375 / 768 / 1280.
- Compare visual to brief §5 spec.
- **Do NOT commit the sandbox page.** The next step deletes it.

### Step 7 — Delete sandbox (BEFORE bundle measurement)
- **Critical (per AUDIT H5):** the sandbox MUST be deleted before `pnpm build` runs in step 8, otherwise the sandbox's primitive-importing page inflates the bundle measurement.
- `rm -rf src/app/admin/__sandbox/`
- Confirm via `git status` — no `__sandbox/` files present.

### Step 8 — Bundle size verification (with sandbox confirmed deleted)
- Read pre-B-1 baseline from `redesign/baselines/bundle-pre-B1.json` (from B-0).
- Run `pnpm build`. Compare first-load JS for `/admin/dashboard` and `/admin/reports` against the baseline.
- Confirm `< +12kB gzip` delta per `SHARED-IMPLEMENTATION-NOTES.md` §5.
- If exceeded: audit imports; trim per-chart Recharts imports (`import { LineChart, Line } from 'recharts'` not `import * from 'recharts'`); rerun.

### Step 9 — Final cleanup + commit
- Run `pnpm lint` + `npx tsc --noEmit` + `pnpm vitest run`. All green.
- Stage scoped files (explicit paths; never `git add -A`).
- Commit message: `feat(admin): B-1 — foundation primitives (charts + tiles + severity-strong tokens + skeleton shimmer)`.

## How to undo it if something breaks

All changes are additive except the `AdminSkeleton` shimmer swap. Rollback:
1. Revert the commit (single commit per session-3 grain convention).
2. The new files in `charts/` and `tiles/` simply disappear — no consumers in this phase.
3. Token additions are leftover orphans (harmless — unused CSS variables are fine).
4. The `AdminSkeleton` shimmer swap reverts to pulse — visually identical animation, just slightly different style.

Zero downstream consumers in B-1 itself; nothing else breaks on revert.

## Safety confirmations

- [ ] Branch is `redesign/start-state` (or a worktree off it).
- [ ] No npm/pnpm install commands run during this phase (`pnpm exec` only for tooling).
- [ ] No `package.json` changes (zero new dependencies — copy-paste pattern).
- [ ] No DB migrations (B-1 is purely UI primitives).
- [ ] No production deploys triggered by this phase.

---

## Step-by-step verification log template

Append per step to a scratchpad (e.g. `redesign/per-page-progress/B1-foundation-progress.md`):

```
step-1: COMPLETE — tokens.css added 5 new tokens; lint clean
step-2: COMPLETE — admin-ui.tsx shimmer keyframe swapped; visual check on /admin/dashboard skeleton confirms
step-3: COMPLETE — charts/theme.ts created with statusFillForName + severityForDelta; 6 specs pass
step-4a: COMPLETE — SparklineChart created; 5 specs pass
step-4b: COMPLETE — LineChart created; 5 specs pass
step-4c: COMPLETE — AreaChart created; 5 specs pass
step-4d: COMPLETE — BarChart created; 5 specs pass
step-4e: COMPLETE — StackedBarChart created; 5 specs pass
step-4f: COMPLETE — DonutChart created; 5 specs pass
step-5a: COMPLETE — DeltaChip created; 6 specs pass
step-5b: COMPLETE — Sparkline (tile-tail) created; 3 specs pass
step-5c: COMPLETE — CountUp created; 5 specs pass (incl. unmount-during-animation)
step-5d: COMPLETE — MetricRow created; 6 specs pass
step-5e: COMPLETE — KpiTile created; 10 specs pass
step-5f: COMPLETE — TrendTile created; 6 specs pass
step-5g: COMPLETE — ScorecardRing created; 7 specs pass
step-6: COMPLETE — sandbox page screenshotted at 375/768/1280; visual matches brief
step-7: COMPLETE — bundle size: baseline 247kB, after B-1 254kB, delta +7kB ✓
step-8: COMPLETE — sandbox deleted; lint+tsc+vitest green; commit staged
```

---

## Verification gate

Before declaring B-1 done:

| Gate | Command | Pass criterion |
|---|---|---|
| Static lint | `pnpm lint` | 0 errors, 0 new warnings |
| Static types | `npx tsc --noEmit` | 0 errors |
| Vitest | `pnpm vitest run` | All new B-1 specs pass; baseline 112 specs preserved |
| Bundle | `pnpm build` then compare `.next/build-manifest.json` first-load for `/admin/dashboard` | Delta ≤ +12kB gzipped vs pre-B-1 baseline |
| Visual smoke | Sandbox page screenshots | Every primitive renders correctly at 375 / 768 / 1280 |
| Skeleton regression | Navigate to existing admin pages during load | Shimmer renders; no broken skeletons |
| Sandbox cleanup | `git status` | No `__sandbox/` files present |

---

## Files touched (summary)

**Created:**
- `src/app/admin/components/charts/theme.ts`
- `src/app/admin/components/charts/{Area,Bar,Line,Donut,Sparkline,StackedBar}Chart.tsx` (6 files)
- `src/app/admin/components/charts/__tests__/*.test.tsx` (7 files including theme)
- `src/app/admin/components/tiles/{KpiTile,TrendTile,MetricRow,ScorecardRing,CountUp,DeltaChip,Sparkline}.tsx` (7 files)
- `src/app/admin/components/tiles/__tests__/*.test.tsx` (7 files)

**Modified:**
- `src/styles/tokens.css` (5 new tokens)
- `src/app/admin/components/admin-ui.tsx` (skeleton shimmer keyframe swap; export contract preserved)

**Total: ~21 new files + 2 modified files.**

---

## Hand-off

After B-1 ships:
- B-2 implementer can start (B-2 is fully independent from B-1 — backend only).
- B-3, B-4, B-5, B-6 implementers can start consuming primitives once B-1 is merged.

Next phase: B-2 (metric backend).
