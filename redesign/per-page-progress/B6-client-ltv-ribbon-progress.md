# Progress — B-6 Client LTV ribbon

**Brief:** `redesign/briefs/B6-client-ltv-ribbon-brief.md`
**Plan:** `redesign/plans/B-phase/B6-client-ltv-ribbon-plan.md`
**Branch:** `redesign/start-state`
**Start commit:** `f085fe3`
**Started:** 2026-05-25
**Completed:** TBD
**Safety label:** ADDITIVE (new component mounted at top; existing page untouched)

---

## Step log

### Step 1 — pre-flight (codebase + DB audit) — COMPLETE

**Branch + HEAD:** `redesign/start-state` at `f085fe3`. Working tree clean.

**Helper signature verified.** [client-metrics.ts](src/app/admin/clients/client-metrics.ts) exports `getClientLifetimeMetrics(clientId, bookings: ClientBookingRecord[]) => ClientLifetimeMetrics`. Canonical field shape (from B-2 — code is source of truth; project hand-off prompt's older draft names `lifetimeValue` / `visitsByMonth` superseded by shipped `ltv` / `monthlyVisitsSeries`):

```ts
{
  ltv: number;
  visitCount: number;              // === completedCount (cancelled don't count)
  completedCount: number;
  cancelledCount: number;
  lastSeenAt: string | null;
  firstSeenAt: string | null;
  avgBookingValue: number;
  preferredService: string | null;
  monthlyVisitsSeries: { month: string; count: number }[];   // 12 entries, anchored to lastSeen month
  repeatStatus: "new" | "returning" | "regular" | "loyal";
}
```

**Mount point verified.** [page.tsx:381–396](src/app/admin/clients/[clientId]/page.tsx) is the unfiltered `Promise.all` fetch alongside `clientResult`; `bookingHistory` is assigned at L396 from `bookingsResult.data ?? []`. The `bookingsForTab` derived view sits at L521 — well after the natural mount point. The ribbon will render between the existing `<header>` (ends L674) and the two-column body grid (starts L676), consuming the unfiltered `bookingHistory`. AUDIT H6 honoured.

**B-1 primitives the ribbon will compose:**
- `Sparkline` ([Sparkline.tsx](src/app/admin/components/tiles/Sparkline.tsx)) — wraps `SparklineChart`, accepts `values: number[]`, renders nothing when empty (per B-1 contract).
- `DeltaChip` — NOT used here (ribbon has no deltas; LTV is a snapshot, not a comparison).
- StripeTile-style stacked composition (label/value/sub-line) — the canonical mobile-first pattern from B-5 [PersonalContributionStripe.tsx:76–107](src/app/admin/dashboard/PersonalContributionStripe.tsx). Will replicate for the ribbon's 6 stats so the 375 px reflow is safe.

**Brief-vs-primitive reconciliation.** Brief §5.2 specs "fill: Soft Slate at 8% opacity" on the sparkline. The B-1 `SparklineChart` is deliberately fill-less (line-only — "no axes, no tooltip, no grid"). RECON §5 forbids modifying B-1 primitives. **Resolution:** ship with the B-1 line-only `Sparkline` at 32 px + Soft Slate stroke. The aspirational fill is not load-bearing; the trend shape reads cleanly without it. V1.1 backlog candidate: if a filled-sparkline variant is wanted across the programme, it's a B-1 enhancement, not a B-6 one-off.

**Helper `visitCount` semantic.** The helper sets `visitCount = completedCount` (cancelled don't count as visits). The brief's "Visits" cell shows "completed / cancelled" which maps to `${completedCount} / ${cancelledCount}`. The "Across N visits" sub-line on the LTV tile uses `N = completedCount` (matches the LTV math).

**Pre-flight DB scan (B-6 visual fixture gap).** Of all clients with bookings, only one (李小龍, 1 completed visit) sits in the `completed` bucket — none reach the multi-visit Loyal state the brief's headline letterhead screenshot calls out. **Decision (user-approved):** option A + B — full vitest fixture coverage for all four chip buckets AND a one-off DB seed of a 12-completed-booking Loyal client for visual verification, then cleaned up before commit.

**Bundle baseline (pre-B-6).** `node scripts/measure-admin-bundles.mjs`:
- `/admin/clients/[clientId]` first-load JS: **336.74 kB gzip** (delta vs pre-B-1 = **+0.49 kB**)
- §5 budget for B-6: **+6 kB** vs pre-B-1 baseline. **Headroom: ~5.5 kB** for B-6 itself. Plenty for a server component composing existing primitives.

**No dep drift.** `git diff package.json pnpm-lock.yaml` empty.

**SHARED-NOTES sections relevant to B-6:**
- **§2 (Sentry):** wrap `getClientLifetimeMetrics` call in defensive try/catch + `Sentry.captureException` so a malformed booking row degrades the ribbon, not the page. Tags `feature: 'band-b-6'`, `surface: '/admin/clients/[clientId]'`.
- **§3 (a11y):** wrap in `<aside role="complementary" aria-label="Client lifetime overview">`; sparkline `role="img" aria-label="12-month visit trend"`.
- **§5 (bundle budget):** +6 kB cap.
- **§15 (cache hazards):** ribbon consumes already-fetched in-memory `bookingHistory` (NOT a cached helper); no JSON-roundtrip risk for B-6 itself. Cache-hit verification (recipe step 6) still mandatory — the page is server-rendered fresh per request, no `unstable_cache` between fetch and ribbon.
- **§17 (chart fills):** ribbon uses a single Soft Slate sparkline, not status-coloured chart slices — no palette concern.
- **§18 (filter-vs-data):** ribbon has no period picker. Defensive 5-step audit:
  1. **Label honesty.** Stat labels are nouns: "LTV", "Visits", "Last seen", "Avg booking", "Preferred service", "Repeat status". No period suffixes. ✅
  2. **NOW-state check.** "Last seen" is intrinsically NOW-relative (relative-time string from server-render timestamp). It re-computes on each render. Not period-scoped, but the page itself has no picker, so no ambiguity. ✅
  3. **Picker → data trace.** N/A — no picker. ✅
  4. **Drill scope.** Ribbon stats are non-interactive — no drill-links. ✅
  5. **Zero-delta.** Ribbon has no delta chips. ✅

**Step-1 verdict:** clean to proceed. No amendments needed to the plan.

### Step 2 — `<ClientLtvRibbon>` component — COMPLETE

Created [src/app/admin/clients/[clientId]/ClientLtvRibbon.tsx](src/app/admin/clients/[clientId]/ClientLtvRibbon.tsx) — server component, ~230 lines (incl. inline SVG sparkline + repeat-status chip mapper + relative-date helper). Composes:

- 6 stacked `RibbonTile`s in `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` (mobile-first per B-5 lesson)
- LTV uses the canonical `admin-display` Cormorant class at `1.778rem`
- Status chip palette routed through `--admin-status-confirmed-*` (Loyal/Regular) / `--admin-status-pending-*` (New) / `--admin-panel-muted` + `--admin-body` + `--admin-border` (Returning neutral)
- Lucide `Star` (3 × 12 px) prefix on Loyal chip
- Inline SVG sparkline (32 px, Soft Slate stroke + 8 %-opacity area fill — see step-5 note)
- `aside role="complementary" aria-label="Client lifetime overview"` wrapper with `border-t border-b` chrome (brief §5.5; uses defined `--admin-border` token since `--admin-border-subtle` is not present in `src/styles/tokens.css`)
- Hide condition: `completedCount === 0 && cancelledCount === 0` — the all-cancelled case keeps the ribbon visible with the brief's zero state

### Step 3 — vitest spec — COMPLETE

Created [src/app/admin/clients/[clientId]/__tests__/ClientLtvRibbon.test.tsx](src/app/admin/clients/[clientId]/__tests__/ClientLtvRibbon.test.tsx) — 9 specs covering:

1. zero-bookings ribbon returns `null`
2. Loyal letterhead at 12 visits (LTV, sub-line, Avg booking, chip, preferred service, sparkline)
3. New chip + singular "visit" word at 1 visit
4. Repeat-status thresholds 1/3/7/12 → New/Returning/Regular/Loyal
5. All-cancelled zero state (£0/£0, Never, "—", New chip, Visits "0 / 2")
6. Sparkline hides when every monthly bucket is zero
7. Therapist-narrowed sub-line "Across N visits with you"
8. Preferred-service truncation > 20 chars + full name in `title`
9. Last seen value carries an absolute-date `title`

`pnpm vitest run …ClientLtvRibbon.test.tsx`: 9/9 pass.

### Step 4 — mount in `page.tsx` — COMPLETE

Surgical 2-line edit:
- Import added next to `ClientDetailForms`: `import { ClientLtvRibbon } from "./ClientLtvRibbon";`
- Mounted between `</header>` (line 674) and the two-column body grid (line 676):
  ```tsx
  <ClientLtvRibbon
    clientId={client.id}
    bookings={bookingHistory}
    scopeNarrowed={!hasAllClientAccess}
  />
  ```

`hasAllClientAccess` is the existing branch flag on the page that drives Owner/Admin/Coord vs Therapist-narrowed access. When `false`, `bookingHistory` is the therapist-assignment-narrowed subset and the LTV sub-line reads "Across N visits with you". AUDIT H6 honoured: the unfiltered `bookingHistory` (assigned at L396 from `bookingsResult.data ?? []`) is used; `bookingsForTab` (L521) is NOT consumed.

### Step 5 — static gates — COMPLETE

| Gate | Result |
|---|---|
| `pnpm lint` | 0 errors |
| `npx tsc --noEmit` | 0 errors |
| `pnpm vitest run` (full) | 485 / 491 passing (9 new B-6 specs ✓; 6 pre-existing baseline failures preserved per HANDOFF §4.5) |
| `pnpm build` | clean |
| `/admin/clients/[clientId]` first-load JS gzip | **336.74 kB** (delta vs pre-B-1: **+0.49 kB**, i.e. B-6 net contribution **0 kB** — well under the +6 kB SHARED-NOTES §5 budget) |

**Sparkline pivot — load it on the record.** First build after wiring up the brief-spec'd B-1 `Sparkline` ballooned the route to **+97.68 kB gzip** because Recharts had not previously shipped to `/admin/clients/[clientId]` and the import added the whole library + an extra entry chunk. Swapped the dependency: replaced B-1 `Sparkline` with a ~30-line inline SVG inside this same file. Visual is the same (32 px, Soft Slate stroke) and the inline path can carry the area fill the brief calls out — which B-1's deliberately fill-less primitive doesn't expose. The B-1 primitive remains untouched (RECON §5 honoured); we just opted into a per-route alternative that fits the budget. Other routes that already ship Recharts continue to use the B-1 primitive; this is not a programme-wide regression.

---

## Verification gate

- [ ] Static lint + types clean
- [ ] Vitest specs pass; baseline preserved
- [ ] Owner viewing loyal client (≥10 visits): ★Loyal pill + populated sparkline
- [ ] Owner viewing new client (1 booking): `New` chip + 1-point sparkline
- [ ] Owner viewing zero-bookings client: ribbon hidden
- [ ] Therapist scope narrowing: LTV sub-line reads "Across N visits with you"
- [ ] Therapist viewing non-assigned client: ribbon hidden
- [ ] All-cancelled client: ribbon visible with `£0` / `Never` / `New` zero-state
- [ ] Repeat-status threshold mapping verified at unit level: 1 / 3 / 7 / 12 visits → New / Returning / Regular / Loyal
- [ ] Truncated Preferred service: tooltip shows full name
- [ ] Mobile 3×2 grid reflow at 375 px
- [ ] Query budget: no new queries (ribbon consumes `bookingHistory`)
- [ ] Bundle delta within budget (≤ +6 kB vs pre-B-1 baseline)
- [ ] Cache-hit + mutation flow (master checklist recipe steps 6 + 7)
- [ ] Seeded fixture cleaned up

---

## Hand-off

**Programme complete after B-6.** Phase 7 audit re-entry possible after this commit.
