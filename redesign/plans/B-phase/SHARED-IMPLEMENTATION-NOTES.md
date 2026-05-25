# Shared implementation notes — Band B

**What this is:** cross-cutting concerns referenced by every B-phase plan. Avoid scattering the same notes across six plan files; refresh once, applies everywhere.

**When to read:** before starting any B-phase. Each phase's "Verification gate" cross-references the relevant section here.

---

## §1 — Database indexes for new query patterns

B-2 adds several new query patterns. Performance at Rahma's scale (12 users, hundreds of bookings/month) is fine without indexes for now, but the cost of adding them is low and the future-proofing real.

### Recommended indexes

| Index | Purpose | Phase that needs it | When to add |
|---|---|---|---|
| `CREATE INDEX IF NOT EXISTS audit_logs_actor_recent_idx ON audit_logs(actor_staff_id, created_at DESC) WHERE actor_staff_id IS NOT NULL` | Performance timeline query "last 20 actions by staff X" | B-3 | At B-2 step 9 if not already present |
| `CREATE INDEX IF NOT EXISTS enquiries_first_contacted_at_idx ON enquiries(first_contacted_at) WHERE first_contacted_at IS NOT NULL` | `getStaffScorecard.avgMinutesToFirstContact` | B-2 | Same migration as `ADD COLUMN first_contacted_at` |
| `CREATE INDEX IF NOT EXISTS enquiries_converted_booking_id_idx ON enquiries(converted_booking_id) WHERE converted_booking_id IS NOT NULL` | `getStaffScorecard.enquiryConversionRate` | B-2 | Verify if exists (`mcp__supabase__list_indexes`); add as standalone migration if missing |
| `CREATE INDEX IF NOT EXISTS booking_assignments_assigned_staff_status_idx ON booking_assignments(assigned_staff_id, status)` | Per-staff filtering of assignments for `filterReportDataToStaff` + `getStaffScorecard` | B-2 | Verify if exists; add if missing |
| `CREATE INDEX IF NOT EXISTS bookings_client_status_completed_idx ON bookings(client_id, status) WHERE status = 'completed'` | `getClientLifetimeMetrics` retention math | B-2 / B-6 | Verify if exists; add if missing |

**How to apply:** all are `CREATE INDEX IF NOT EXISTS` (safe; idempotent). Apply via a single migration file in B-2:

```sql
-- supabase/migrations/20260522121000_add_band_b_indexes.sql
CREATE INDEX IF NOT EXISTS audit_logs_actor_recent_idx
  ON audit_logs(actor_staff_id, created_at DESC)
  WHERE actor_staff_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS booking_assignments_assigned_staff_status_idx
  ON booking_assignments(assigned_staff_id, status);

CREATE INDEX IF NOT EXISTS bookings_client_status_completed_idx
  ON bookings(client_id, status)
  WHERE status = 'completed';
```

(The `enquiries.first_contacted_at` index is in the same migration as the column add, per B-2 plan step 2. The `enquiries.converted_booking_id` index already exists per the original `20260503210000` migration — verify, don't re-add.)

**Zone-2 confirmation required** for the index-additions migration (per HANDOFF §4.5).

---

## §2 — Sentry instrumentation

The project uses Sentry (`@sentry/nextjs`). Existing capture pattern: server-side exceptions caught at `sentry.server.config.ts`; client-side at `sentry.client.config.ts`. Edge runtime at `sentry.edge.config.ts`.

### Per-phase Sentry expectations

| Phase | What to instrument |
|---|---|
| B-1 | New primitives — catch `<CountUp>` cancellation errors; catch `<ScorecardRing>` SVG-math edge cases. Use `Sentry.captureException` in defensive `try/catch` around `requestAnimationFrame` callback. |
| B-2 | New helpers — wrap each helper body in a guard that captures unexpected errors. Pure helpers shouldn't throw, but defensive `try { ... } catch (err) { Sentry.captureException(err); return defaultShape; }` per helper. |
| B-3 | New routes — already covered by the global Next.js error boundary + Sentry hook. Add explicit `Sentry.captureException` in `getAuditLogForStaff` if introduced. |
| B-4 | Insights stripe — `getReportInsights` failures should not crash the page; degrade silently. Capture via Sentry but render empty stripe. |
| B-5 | Pull-to-refresh handler — defensive try/catch in pointer-event listener. Mobile sticky bar action handler too. |
| B-6 | LTV ribbon — defensive zero-fallback on `getClientLifetimeMetrics` failure (hides ribbon; captures to Sentry). |

### Tag conventions

When capturing, add:
- `tags.feature = 'band-b-{phaseN}'` (e.g. `band-b-3`)
- `tags.role = profile.role` (for context)
- `tags.surface = '<route>'` (e.g. `/admin/me`)

---

## §3 — Accessibility testing checklist

Reference: `redesign/A11Y-BASELINE.md` for baseline issues. Band B should not regress and should fix where convenient.

### Per-phase a11y gates (in addition to brief-level §6 Key States `prefers-reduced-motion` rows)

| Phase | A11y checks |
|---|---|
| B-1 | All chart primitives expose `role="img" aria-label={...}` with a data-summary fallback. `<KpiTile>` href variant uses `<Link>` not div+onClick. `<CountUp>` defaults to instant when `prefers-reduced-motion`. Skeleton shimmer pauses on reduced-motion. `<DeltaChip>` includes sr-only direction word ("up", "down") for screen readers. |
| B-2 | N/A (backend). |
| B-3 | Skip-link target `id="admin-main"` preserved on `/admin/me`. Period chips use `aria-current="page"` on active. Activity timeline rows have `<time datetime>` semantics. `<ScorecardRing>` has accessible `title` AND a sr-only text alternative ("Utilisation at 73% of 80% target"). |
| B-4 | Insights stripe rows use `role="status"` (live region). Drill-in `?staffId=` updates `<h1>` so screen-reader users hear the new scope. CSV chips have explicit `aria-label="Download {label} CSV"`. |
| B-5 | Personal Stripe period picker uses `<fieldset>` with sr-only legend. Mobile sticky action bar has `role="region" aria-label="Quick actions"`. PTR has `aria-live="polite"` "Refreshing…" status announcement. Swipeable cards expose keyboard-arrow navigation (left/right) as a fallback to swipe. |
| B-6 | LTV ribbon wrapped in `<aside role="complementary" aria-label="Client lifetime overview">`. Sparkline `role="img" aria-label="12-month visit trend"`. Repeat-status chip has accessible text (no icon-only). |

### Tools

- Playwright axe-core integration (`@axe-core/playwright`) — run per phase against the primary route(s).
- Manual NVDA/VoiceOver sweep of the new surfaces.
- Lighthouse a11y score: target ≥ 95 per page (existing baseline).

### Reduced-motion testing recipe (per AUDIT G-final-7)

How to verify `prefers-reduced-motion: reduce` is honoured (every phase that adds animations):

**Method 1 — Chrome DevTools (fastest):**
1. Open DevTools → Cmd+Shift+P (Mac) / Ctrl+Shift+P (Win) → "Show Rendering"
2. Find "Emulate CSS media feature `prefers-reduced-motion`" dropdown
3. Set to `reduce`
4. Reload the page
5. Verify: shimmer becomes static; count-up renders instantly; chart entry animations disabled; PTR spinner doesn't spin; swipe-snap is still functional (it's layout, not motion)

**Method 2 — OS setting (more realistic):**
- macOS: System Settings → Accessibility → Display → Reduce motion (toggle ON)
- Windows: Settings → Ease of Access → Display → Show animations in Windows (toggle OFF)
- Reload browser; same verifications.

**Method 3 — Playwright (automated):**
```ts
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.goto('/admin/dashboard');
// assert no animation transforms applied to shimmer skeletons, etc.
```

Add to per-phase verification gate when the phase introduces animations (B-1, B-5).

---

## §4 — i18n notes

The project is English-only. Pluralisation uses `count === 1 ? "" : "s"` patterns throughout (`Phase 6` convention). New copy must match this pattern.

### Rules

- No new locale files in Band B.
- All new strings live in TSX (no separate translation table).
- Pluralisation: `${n} booking${n === 1 ? "" : "s"}` (existing convention) — do not introduce `Intl.PluralRules`.
- Currency formatting: existing `formatMoney(amount)` (uses `en-GB`, £ symbol).
- Date formatting: existing `Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London" })`.
- Relative time formatting: existing helpers OR `Intl.RelativeTimeFormat("en-GB")` if needed for the LTV ribbon's "Last seen" — verify if a project helper exists first.

### Future-proofing (deferred)

A genuine i18n pass (Welsh / Arabic for the local Luton community; RTL support) is a Phase 8+ candidate. Band B keeps strings pluck-able by an LSP / extractor but does not introduce a translation layer.

---

## §5 — Bundle budgets per phase

Recorded as cumulative deltas vs. pre-B-1 baseline. Measured on `pnpm build` first-load JS for the relevant route.

| Phase | Surface | Acceptable delta vs pre-B-1 baseline | Why |
|---|---|---|---|
| B-1 | `/admin/dashboard` (existing route, primitives imported but not consumed yet) | +12 kB gzip | Foundation imports (shadcn chart wrappers + tile primitives) |
| B-1 | `/admin/reports` | +12 kB gzip | Same primitives |
| B-2 | (no UI changes) | 0 kB | Backend only |
| B-3 | `/admin/me` | +25 kB gzip (new route) | New page; KPI tiles + activity timeline + chart |
| B-3 | `/admin/staff/[staffId]/performance` | +18 kB gzip | New sub-route; reuses `<PerformanceSurface>` |
| B-4 | `/admin/reports` | +20 kB gzip cumulative | New tiles + Insights stripe + scope pill + toggle |
| B-5 | `/admin/dashboard` | +18 kB gzip cumulative | Personal Stripe + mobile components |
| B-6 | `/admin/clients/[clientId]` | +6 kB gzip | LTV ribbon (small) |

### How to measure

```bash
pnpm build
cat .next/build-manifest.json | jq '.pages["/admin/dashboard"]' # repeat per route
```

Compare to pre-B-1 baseline captured before B-1 implementation begins.

If a phase exceeds its budget by >50%: audit imports; trim per-chart Recharts imports (`import { LineChart, Line } from 'recharts'` not `import * from 'recharts'`); rerun.

---

## §6 — Discipline checklist (carry forward)

Pre-flight before every B-phase commit:

- [ ] **No `pnpm install`, `pnpm add`, `npx`, `npm i` ran during this session.** Verified by `git diff package.json package-lock.json` → empty.
- [ ] **No mutations to `RECON.md` untouchables** (`dashboard-data.ts`, `dashboard-helpers.ts`, `reporting.ts` core exports, RBAC, middleware, build configs).
- [ ] **Server-action RLS pattern preserved** — `createSupabaseAdminClient()` after `getStaffProfile()` auth check + manual scoping.
- [ ] **No `border-l-4`** anywhere in new components.
- [ ] **`prefers-reduced-motion` honoured** in every animated component.
- [ ] **Static gates green**: `pnpm lint` + `npx tsc --noEmit` + `pnpm vitest run` (baseline 112 passing preserved).
- [ ] **Playwright role sweep passed** per phase plan's verification gate.
- [ ] **Screenshot evidence captured** at 4 viewports per role per surface.
- [ ] **Bundle delta within budget** per §5 above.
- [ ] **Sentry instrumentation in place** per §2.
- [ ] **A11y gates passed** per §3.
- [ ] **Migrations applied with Zone-2 confirmation** (B-2 only).
- [ ] **HANDOFF doc updated** with the phase's landed-work note.

---

## §7 — Cohesion across phases

The 6 phases interlock. Each phase's success depends on the others honouring shared contracts:

### Shared visual language

| Concern | Token / pattern | Owner phase | Consumers |
|---|---|---|---|
| KPI tile composition (number + delta + sparkline) | `<KpiTile>` from B-1 | B-1 | B-3, B-4, B-5 |
| Status colours (Confirmed/Pending/Cancelled/Completed/NoShow) | `statusFillForName()` from B-1 | B-1 | B-4 (status charts), B-5 (today rows) |
| Severity-strong tints | `--admin-{severity}-bg-strong` from B-1 | B-1 | B-4 (Insights), B-5 (Urgent Attention, Ops Health) |
| Skeleton shimmer | gradient sweep replacing pulse | B-1 | every page using `AdminSkeleton` |
| Period selector chips | `aria-current="page"` GET form | B-3 | B-4, B-5 |
| Drill-to-staff URL pattern | `?staffId={id}` | B-4 | B-3 manager-view link |
| Scope toggle URL pattern | `?scope=personal\|team` | B-4 | B-3 "View in Reports →" |
| Personal contribution helpers | `getStaffScorecard` | B-2 | B-3 (Performance), B-5 (Personal Stripe) |
| Insight templates | `getReportInsights` | B-2 | B-4 (Insights stripe) |
| Client LTV math | `getClientLifetimeMetrics` | B-2 | B-6 (ribbon) |
| Mobile sticky action bar | `MobileStickyActionBar` | B-5 | Pattern (potentially reused by B-3 mobile) |

### Shared data layer

- Every page uses `getReportData(adminClient, profile, filters)` OR `getDashboardData(adminClient, profile, filters)` — both B-2-wrapped in `unstable_cache` with 60s revalidate + `revalidateTag('report-data')` / `revalidateTag('dashboard-data')` invalidation hooks.
- Mutating actions (existing + B-2 extension) call `revalidateTag(...)` for cache freshness.
- Prior-period data fetched in parallel via `Promise.all([getReportData(current), getReportData(prior)])` where deltas are needed.

### Shared RBAC

- `getStaffProfile(supabase)` → `{ profile, active }` — used everywhere.
- `getAdminPageAccess(profile, pageSlug)` → `{ access, plan }` — used at page entry.
- New permission constants: **none** added in Band B. Reuses existing.

---

## §8 — Migration discipline (B-2 only)

B-2 is the only phase that touches Supabase migrations. The migration list:

| File | Purpose | Status |
|---|---|---|
| `20260522120000_add_enquiry_first_contacted_at.sql` | `ADD COLUMN first_contacted_at TIMESTAMPTZ NULL` + `CREATE INDEX enquiries_first_contacted_at_idx` | NEW |
| `20260522121000_add_band_b_indexes.sql` | Additional indexes per §1 above | NEW |
| ~~`20260522130000_add_enquiry_converted_to_booking_id.sql`~~ | **Cancelled** — column already exists as `converted_booking_id` (different name from B-2's original assumption) | DROPPED per AUDIT-2026-05-22 C3 |

Each migration:
- `mcp__supabase__list_tables` and `mcp__supabase__list_extensions` checked first.
- Zone-2 confirmation requested per file.
- Applied via `mcp__supabase__apply_migration` to project `twzutkfgqclqurvkmvqz`.
- Verified via `mcp__supabase__execute_sql` post-apply.

---

## §9 — Verification gate template (cross-cutting)

Each phase's plan has its own verification gate. Add these universal checks on top:

| Gate | Notes |
|---|---|
| Branch is on `redesign/start-state` (or a worktree off it) | Confirmed via `git branch --show-current` |
| No package changes | `git diff package.json package-lock.json` empty |
| HANDOFF section drafted | Section ready to paste into HANDOFF after commit |
| `redesign/per-page-progress/B[N]-progress.md` updated | Append step-by-step COMPLETE lines per plan |
| AUDIT-2026-05-22.md findings respected | No regression on any of the C/H/M/L items |

---

## §10 — Per-section Suspense boundaries (post-AUDIT G2)

To avoid one slow query blocking entire-page render, structure each major surface with per-section `<Suspense>` boundaries. Each section fetches independently; faster-finishing sections stream first.

### Per-page Suspense structure

| Surface | Sections to wrap | Why |
|---|---|---|
| `/admin/reports` | Insights stripe / Headline tile strip / Activity section / Workload section / Money section / Metric definitions | Reports has 6 distinct data zones with varying query speeds. Per-section Suspense lets the operator see headline tiles before charts paint. |
| `/admin/me` and `/admin/staff/[staffId]/performance` | Header (instant) / KPI tile grid / Trend chart / Activity timeline / Upcoming work | Activity timeline (`audit_logs` query) is the slowest; tile grid (scorecard math) ships first. |
| `/admin/dashboard` | Already streams per-tile via existing `AdminErrorBoundary` — no change | Phase 6 pattern preserved |
| `/admin/clients/[clientId]` | Existing bookingHistory fetch + B-6 ribbon — ribbon uses already-fetched data, no separate boundary needed | Same single fetch covers both |

### Implementation pattern

```tsx
<Suspense fallback={<KpiTileSkeleton count={6} />}>
  <HeadlineTileStrip filters={filters} profile={profile} />
</Suspense>
<Suspense fallback={<ActivitySectionSkeleton />}>
  <ActivitySection filters={filters} profile={profile} />
</Suspense>
```

Each section is a separate async server component. Skeletons use the B-1 shimmer treatment.

---

## §11 — Database query budgets per page (post-AUDIT R1)

Caps to prevent accidental N+1 patterns. Measure during implementation via Supabase MCP `get_logs` or by adding query-count assertions in dev mode.

| Surface | Query budget | Current baseline (pre-Band B) | After Band B target |
|---|---|---|---|
| `/admin/dashboard` (Business / Coordinator / Therapist) | ≤ 6 queries | ~5 queries | ≤ 6 (Personal Stripe adds 1 prior-period query) |
| `/admin/reports` (Owner full surface) | ≤ 8 queries | ~6 queries | ≤ 8 (prior-period + insights add 2) |
| `/admin/me` | ≤ 4 queries | new route | ≤ 4 |
| `/admin/staff/[staffId]/performance` | ≤ 4 queries | new route | ≤ 4 |
| `/admin/clients/[clientId]` | ≤ 2 queries (existing) + 0 (LTV ribbon uses already-fetched data) | ~2 queries | ≤ 2 (LTV ribbon adds nothing) |

**Cache amplifier:** `unstable_cache` wrap from B-2 means second-hit-within-60s costs 0 DB queries. Budgets above are for cold-cache renders.

**If a phase exceeds budget:** audit for missing `Promise.all` parallelisation; consider compositing helpers; never add a query inside a render loop.

---

## §12 — Sentry slow-query spans (post-AUDIT G7 + H8)

Opt-in instrumentation. Doesn't change existing Sentry behaviour. Adds visibility into slow data-layer calls.

### B-0 pre-flight check (per AUDIT H8)

`Sentry.startSpan` was added in `@sentry/nextjs@7.x`. Before implementing the spans in B-2:
```bash
grep '"@sentry/nextjs"' package.json
```
- If version `>= 7.0.0`: proceed with `Sentry.startSpan({...}, async () => {...})` pattern below.
- If version `< 7.0.0`: use the legacy `const transaction = Sentry.startTransaction({...}); ... transaction.finish();` pattern (functionally equivalent; older API).
- If `@sentry/nextjs` is not installed at all: skip spans entirely; Sentry exception capture (existing) still works.
Document the discovered version in B-0 progress file.

### What to wrap

```ts
// pattern — wrap every helper that does parallel DB work
return Sentry.startSpan(
  { name: 'getReportData', op: 'db.query', attributes: { profile_id: profile.id, range: filters.range } },
  async () => {
    // existing body
  }
);
```

Wrap:
- `getReportData(adminClient, profile, filters)` — B-2 cache layer
- `getDashboardData(adminClient, profile, filters)` — B-2 cache layer
- `getStaffScorecard(data, staffId, priorData?, auditLogs?)` — B-2 composed helper
- `getClientLifetimeMetrics(clientId, bookings)` — B-6 input
- `getAuditLogForStaff(adminClient, staffId, limit)` — B-3 input
- `getReportInsights(data, priorData, dismissedIds?)` — B-2 (after dismissal filter)

### Slow-query threshold

Configure via `SENTRY_SLOW_QUERY_MS` env var; default 500 ms. Spans above threshold get tagged `tags.slow = true` for filtering in the Sentry dashboard.

### Safety

- Wrapping is purely additive — if `Sentry.startSpan` fails or Sentry is down, the original helper still runs (Sentry SDK is fail-soft).
- No PII in span attributes (only IDs).
- Verified against existing `sentry.server.config.ts` baseline (no breaking changes).

---

## §13 — Dev seeding for empty-state verification (post-AUDIT G6)

To verify the B-5 Therapist fullness pass works against a truly empty state, we need a Therapist account with NO bookings, NO claimable, NO assignments.

### Existing accounts (HANDOFF §4.2)

| Account | State |
|---|---|
| `test.therapist@rahmatherapy.example.test` / `TherapistTest123!` | Has assignments + completed bookings |
| `test.inactive@rahmatherapy.example.test` / `InactiveTest123!` | Inactive (middleware blocks) |

Neither is suitable for fullness-pass verification.

### Add (B-0 plan step)

| Account | Purpose |
|---|---|
| `test.therapist.fresh@rahmatherapy.example.test` / `TherapistFresh123!` | Active Therapist with zero assignments, zero bookings, zero claimable. Brand-new state. |

### Zone-2 confirmation required

Creating an auth.user row + linked staff_profile is a write to `auth.users` — Zone-2 per HANDOFF §4.5. Plan step 5 of B-0 requests explicit user confirmation before applying.

### How to create

Via Supabase MCP `execute_sql`:
1. INSERT auth.user (encrypted_password via Supabase Auth admin API, not raw SQL — use `mcp__supabase__execute_sql` with `auth.admin_create_user(...)` OR a dedicated migration).
2. INSERT staff_profile with `active = true`, role = therapist, no assignments.
3. Do NOT seed any bookings, assignments, or enquiries.

Document in `redesign/per-page-progress/B0-progress.md`.

---

## §14 — `insight_dismissals` table (post-AUDIT Q6 resolution)

New table for persistent Insights stripe dismissal. Mirrors the `notification_state` pattern from R4.

### Migration (lives in B-2)

```sql
-- supabase/migrations/20260522122000_add_insight_dismissals.sql
CREATE TABLE IF NOT EXISTS public.insight_dismissals (
  staff_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  insight_id text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, insight_id)
);

COMMENT ON TABLE public.insight_dismissals IS
  'Per-staff dismissal tracking for the Reports Insights stripe. insight_id is a stable hash like bookings-dropped-22pct-this_week-2026-05 encoding category + delta-bucket + period.';

ALTER TABLE public.insight_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY insight_dismissals_select_own
  ON public.insight_dismissals FOR SELECT
  USING (staff_id = app_private.current_active_staff_id());

CREATE POLICY insight_dismissals_insert_own
  ON public.insight_dismissals FOR INSERT
  WITH CHECK (staff_id = app_private.current_active_staff_id());

CREATE POLICY insight_dismissals_delete_own
  ON public.insight_dismissals FOR DELETE
  USING (staff_id = app_private.current_active_staff_id());

GRANT SELECT, INSERT, DELETE ON public.insight_dismissals TO service_role;

CREATE INDEX IF NOT EXISTS insight_dismissals_staff_recent_idx
  ON public.insight_dismissals(staff_id, dismissed_at DESC);
```

### `insight_id` format

Stable hash derived from insight content. Format: `<category>-<delta-bucket>-<period>-<yyyy-mm>`. Examples:
- `bookings-dropped-22pct-this_week-2026-05`
- `outstanding-grew-£340-this_month-2026-05`
- `staff-utilisation-aisha-drop-2026-05`

Computed by `buildInsightId(insight)` in `report-insights.ts`. Stable across renders for the same data state; same insight in same period = same ID = dismissable once.

### Lifecycle / cleanup

Insight IDs are period-scoped (encoded month). Old dismissals stay in the table but never re-match new insights (different period). Cleanup is optional — at clinic scale, even 5 years of dismissals = a few thousand rows. Defer cron-cleanup to V1.1 if ever needed.

### `insight_id` bucket stability (per AUDIT M10)

Naive format `<category>-<delta>-<period>` is too sensitive to rounding: a delta at 14.99% one render → "14pct" → next render 15.01% → "15pct" → ID changes → dismissal lost. Use **5%-bucket rounding** on the delta component:
- Round delta to nearest 5%: `Math.round(deltaPct / 5) * 5`
- Format: `<category>-dropped-{bucket}pct-<period>-<yyyy-mm>` e.g. `bookings-dropped-15pct-this_week-2026-05`
- Same insight in same period = same bucket = same ID = dismissal carries even if deltas drift by ±2%.

### Cache trade-off (per AUDIT M5)

`dismissInsight` calls `revalidateTag('report-data')` which forces a full `getReportData` re-fetch (~50–150ms cold; cached after). Alternative considered: cache dismissed IDs separately and filter at render time (avoids re-fetching the heavy ReportData). At our scale (12 users; <100 dismissals/year), the full re-fetch is fine — but if dismiss UX feels sluggish in Phase 7 testing, switch to separate-cached dismissed IDs (small additional cache key + tag).

### Server action

```ts
// src/app/admin/reports/insight-actions.ts (NEW in B-2 — actually no, in B-4 since it's UI-triggered)
"use server";
export async function dismissInsight(insightId: string) {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) return { error: "Insufficient permissions." };

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from("insight_dismissals")
    .insert({ staff_id: profile.id, insight_id: insightId });

  if (error && error.code !== "23505") return { error: error.message };  // 23505 = unique violation; idempotent
  revalidatePath("/admin/reports");
  return { success: true };
}
```

### `getReportInsights` filter

```ts
export function getReportInsights(
  data: ReportData,
  priorData: ReportData,
  dismissedIds: Set<string> = new Set(),
  options?: InsightOptions
): ReportInsight[] {
  // ... compute insights as before ...
  return computed.filter(i => !dismissedIds.has(i.id));
}
```

Page-side fetch of dismissed IDs:
```ts
const dismissals = await adminClient
  .from("insight_dismissals")
  .select("insight_id")
  .eq("staff_id", profile.id);
const dismissedIds = new Set(dismissals.data?.map(d => d.insight_id) ?? []);
```

---

## §15 — `unstable_cache` JSON-serialisation hazards (post-B-2 regression, added 2026-05-24)

The B-2 cache-Set bug — `ReportData.staffAvailabilityRuleStaffIds: Set<string>` typed but the `unstable_cache` wrap JSON-serialised it to `{}` on second-render reads — surfaced one phase late (caught during B-3's Playwright sweep, fixed at commit `d556278`). The root cause is broader than one field: **any value passed through `unstable_cache` is serialised via JSON when the cache reads from disk; non-JSON-safe values silently degrade.**

### What degrades through `unstable_cache`

| Input type | Survives JSON round-trip? | Becomes on cache-hit |
|---|---|---|
| `string` / `number` / `boolean` / `null` | ✅ yes | unchanged |
| `Array<T>` (where `T` is JSON-safe) | ✅ yes | unchanged |
| `{ ... }` plain object | ✅ yes | unchanged |
| `Set<T>` | ❌ no | `{}` (empty plain object — `.has()` and `.size` throw) |
| `Map<K, V>` | ❌ no | `{}` (empty plain object — `.get()` and `.size` throw) |
| `Date` | ❌ no | string (ISO 8601 — `.getTime()` and `.getFullYear()` throw) |
| `RegExp` / `Function` / `Symbol` | ❌ no | `{}` or omitted |
| `bigint` | ❌ no | `JSON.stringify` throws synchronously |
| Class instances | ⚠️ degraded | plain object copy (methods lost) |

### Discipline

Before introducing any cached helper or extending an existing one (B-2 wrapped `getReportData` + `getDashboardData`; B-3 reuses both):

1. **Audit the return-type shape against the table above.** Specifically: search the helper's TypeScript return interface for `Set<` / `Map<` / `: Date` / class names.
2. **If any non-JSON-safe field is present:** convert to a JSON-safe representation at construction (`Set<T>` → `T[]` via `[...new Set(...)]`; `Date` → `string` via `.toISOString()`; `Map` → `Record<K,V>` via `Object.fromEntries(...)`). Update the type signature to match.
3. **Consumer sites must use the JSON-safe API** (`.includes()` not `.has()`; `new Date(iso)` not direct `.getTime()`).
4. **Verify on cache-hit, not just cold-cache.** Use the Playwright recipe's step 6 (Cache-hit verification) — every cached surface must be reloaded after the cache is populated. Cold-cache renders pass against Sets/Dates because the in-memory value still has the right shape; the bug only appears on subsequent reads after the value has round-tripped to disk and back.

### Canonical fix pattern (the one applied at `d556278`)

```ts
// BEFORE — type lies about runtime shape after cache round-trip
export interface ReportData {
  staffAvailabilityRuleStaffIds: Set<string>;  // becomes {} on cache-hit
}

// AFTER — JSON-safe shape; construction stays a unique-id list
export interface ReportData {
  staffAvailabilityRuleStaffIds: string[];
}

// Construction (helper) — preserve "unique" semantic
return {
  ...,
  staffAvailabilityRuleStaffIds: [...new Set(rows.map(r => r.staff_id))],
};

// Consumers — swap .has() for .includes()
data.staffAvailabilityRuleStaffIds.includes(member.id);
```

### Why this isn't a SHARED-NOTES §2 (Sentry) concern

Sentry won't fire on this class of bug — the error is a thrown `TypeError` from the consumer code path, which IS captured, but it happens *every time* the cache serves a stale-shape value. Sentry sees a flood of identical errors and groups them, but it doesn't prevent the user-visible broken page. Prevention is the audit above; detection is the Playwright cache-hit step.

---

## §16 — `pnpm build` vs `npx tsc --noEmit` (audit-resolved 2026-05-24)

The B-1 → B-2 → B-3 stack carried a recurring note: *"`pnpm build` typecheck is NOT identical to `npx tsc --noEmit`."* The note originated at B-2 step 5 when the B-2 agent found 4 chart-wrapper TS errors (TS18047 + TS2322) via `tsc --noEmit` that B-1's recorded "pnpm build typecheck passed" gate had missed. The HANDOFF §4.1 dev-gotcha telling future agents to "always run `npx tsc --noEmit` separately as the canonical types gate" came from that observation.

**Empirical audit (B-3 follow-up):** the divergence is not real at the config level.

### What I tested

1. Took the live `tsconfig.json` and `next.config.ts` (identical to the B-1 ship commit `84f111e`).
2. Re-introduced the exact B-1 bug: changed `if (data == null)` → `if (data === undefined)` in `AreaChart.tsx` line 40. This produces a `T[] | null` value that line 41's `data.length` access fails to narrow → TS18047.
3. Ran `npx tsc --noEmit` → caught the error (TS18047 + the downstream TS2322).
4. Ran `pnpm build` with a fresh `.next/cache/.tsbuildinfo` → also caught the same error, failed with `Failed to type check.` and exit code 1.
5. Ran `pnpm build` with a warm cache (after a clean build, then re-introducing the bug without clearing) → also caught the error.

**Both commands catch the same errors with the same tsconfig.** The "divergence" doesn't exist.

### What the B-1 false-positive actually was

Most likely an out-of-order verification. B-1's plan creates the chart primitives across steps 3-5; the agent probably ran `pnpm build` at an intermediate step (when the buggy chart wrappers hadn't been written yet) and then continued without re-running the full gate. The fix at commit `11a5f82` plus the new SHARED-NOTES §15 cache-hit discipline (recipe step 6) together make this category of process-hole significantly harder to repeat.

### Practical guidance (replaces the HANDOFF §4.1 note)

Both gates are useful, but for different reasons — not because they catch different bugs:

| Command | Why run it |
|---|---|
| `npx tsc --noEmit` | Fast (no bundling). Reports ALL errors in one pass (Next stops at first file). Good for pre-commit + iterative fixing. |
| `pnpm build` | Catches the same TS errors AND validates bundling, route registration, Sentry source-map upload, edge runtime constraints. The canonical "everything compiles for production" gate. |

**They serve different scopes.** Run both as separate Step-4 static gates — but understand that for catching TypeScript errors specifically they are equivalent. If one passes, the other will too.

### Discipline that prevents the original mistake

- **Run static gates LAST**, after all implementation steps complete — not at mid-plan checkpoints. Re-run before committing.
- **Read the build output to the end.** `Failed to type check.` + exit code 1 + ELIFECYCLE error are unmissable; if the build claimed success, it actually succeeded.
- **Don't trust prior-phase "static gate passed" claims when starting a new phase** — the canonical Step 4 of the master checklist's standard loop includes re-running them.

---

---

## §17 — Chart fills vs text tokens (post-B-4 user-found bug, added 2026-05-24)

B-1's `theme.statusFillForName(name)` returns the `--admin-status-{name}-text` token variants — these are deliberately dark (lightness ~30%, OKLCH) because they're designed for accessible text-on-light contrast (WCAG AA ≥ 4.5:1). When B-4 first wired them as chart slice fills the donut rendered four *distinct-but-all-dark* colours and the user flagged it as visually muted. The same trap waits for B-5 (Dashboard `Today rows` status pills, Personal Stripe deltas) and any future chart consumer.

### The rule

| Context | Use |
|---|---|
| Status pill / chip text + background | `--admin-status-{name}-text` (paired with `--admin-status-{name}-bg` surface) |
| Chart slice / bar / line fill on light panel | A chart-tuned bright palette (lightness 55-70%, chroma 0.16-0.22, hues spread around the wheel) |
| Tile severity background (`*-bg-strong`) | B-1 severity tokens — these already pass the WCAG audit (B-0 Option C) and read as warm muted surfaces |

### Canonical chart palette for booking status (B-4 `statusChartFillForKey`, `src/app/admin/reports/ReportsCharts.tsx`)

```ts
const STATUS_CHART_FILL: Record<string, string> = {
  Confirmed: "oklch(58% 0.18 155)", // mint-green
  Pending:   "oklch(70% 0.16 70)",  // amber
  Completed: "oklch(55% 0.15 230)", // ocean blue
  Cancelled: "oklch(55% 0.22 25)",  // coral red
  NoShow:    "oklch(50% 0.18 330)", // magenta (kept distinct from cancelled)
};
const UNKNOWN_CHART_FILL = "oklch(60% 0.05 280)"; // soft mauve-grey
```

Five hues spread around the OKLCH wheel at consistent lightness so each slice POPS but no one slice dominates. Reuse this exact palette across B-5 + future surfaces that show booking-status breakdowns — keeps the visual language uniform.

### When inventing a new chart palette (e.g. source attribution, service-mix, gender)

- Pick distinct hues spaced by ≥40° around the wheel
- Hold lightness in the 55-70% band so swatches feel "saturated" on a cream / off-white admin panel
- Use chroma 0.15-0.22 for the foreground bars; reduce to 0.08-0.10 for hover-tinted backgrounds
- Always add a contrasting "Other" / unknown fallback at low chroma so unrecognised values are visually muted, not surprising

### Discipline

Before introducing a chart consumer in B-5 or beyond:
1. Look up whether SHARED-NOTES already has a palette for this data dimension (status, severity, source, etc.).
2. If yes — reuse the exact OKLCH values. Do NOT re-derive.
3. If no — propose a 5-7 colour palette in the brief / plan; cross-check against the rule above before shipping.

---

## §18 — Filter-vs-data discipline (post-B-5 audit, added 2026-05-25)

The B-5 Personal Stripe initially shipped with a period picker that didn't
actually drive most of its tiles — and a cross-surface audit then found the
same class of bug on /admin/me, /admin/reports, and elsewhere in the
Dashboard. The pattern: surfaces with filter widgets where the data
displayed silently doesn't respect the filter, or labels claim a scope the
value doesn't match. Three distinct bug shapes; one discipline.

### The three bug shapes

**Shape A — Hardcoded period suffix in a label, picker-controlled value:**
Label says "Revenue this week" but the picker is set to "this month" — value
is correct for the picker, label lies. Caused by treating the period word as
copy text instead of a derived eyebrow.

> **Rule:** if a tile/section sits inside a period picker, its label is a
> noun ("Revenue", "Hours", "Clients") — NOT a noun phrase ("Revenue this
> week"). The eyebrow + active picker chip carry the period. Per-tile
> period suffixes always contradict the picker at some setting.

**Shape B — NOW-state metric inside a period-scoped surface:**
"Open attention" / "Unassigned today" / "Failed emails" / "Open ops events"
— these are intrinsically CURRENT-STATE (status='open', current
availability config, etc.). Period-scoping them is meaningless ("ops events
from a month ago that are still open today" = "currently open"). When such
a metric sits inside a period picker, the picker silently has no effect.

> **Rule:** either (i) move the NOW-state metric OUT of the period-scoped
> surface, or (ii) add a clear visual "Live · ignores filter" / "(Current
> state)" indicator. NEVER place a NOW-state metric inside a period picker
> without a marker — the user has no way to tell.

**Shape C — Filter widget that doesn't drive its data:**
Chip lights up via `aria-current` but the underlying query / helper doesn't
read the param. Range key recognised in chip CSS but unknown to
`parseReportFilters`, falling through to a catch-all default. Drill-links
that drop the active `scope` + `staffId`.

> **Rule:** every chip key MUST be a case in `parseReportFilters`
> (`reporting.ts:962`). Add new cases for new chip labels — don't rely on
> the catch-all. Every drill-link from a scope-narrowed surface MUST
> append the active `scope` + `staffId` so the destination preserves
> context. Filter widget that doesn't drive data is worse than no widget.

### Canonical recognised ranges (current)

`parseReportFilters` cases as of 2026-05-25:

| Key | Window | Use case |
|---|---|---|
| `today` | today only | Single-day operations view |
| `tomorrow` | tomorrow only | Worker-app forward chip (Therapist) |
| `week` | today → today+7 business days | Rolling forward-week (legacy; "Next 7 days" semantically) |
| `this_week` | calendar Mon–Sun of current week | "This week" label semantic |
| `month` | month-01 → today+30 days | Rolling forward-month (legacy) |
| `this_month` | calendar 1st → last-day of current month | "This month" label semantic |
| `quarter` | calendar Q1/Q2/Q3/Q4 of current year | B-3 chip |
| `year` | Jan 1 → Dec 31 of current year | B-3 chip |
| `lifetime` | 2000-01-01 → 2100-12-31 | Reports scope toggle |
| `custom` | from / to from URL params | Custom date range form |

Adding a new chip label? Add a new case. Don't reuse an existing key for a
different semantic — both consumers will collide.

### Drill-link scope preservation

When rendering insight / tile / row drill-links from a scope-narrowed
surface (`?scope=personal`, `?staffId=X`), enrich the drillUrl with current
scope + staffId BEFORE handing off to the consumer:

```ts
const enriched = insights.map((insight) => {
  if (!insight.drillUrl) return insight;
  const separator = insight.drillUrl.includes("?") ? "&" : "?";
  const extras: string[] = [];
  if (scopeForDrills) extras.push(`scope=${scopeForDrills}`);
  if (staffIdForDrills) extras.push(`staffId=${staffIdForDrills}`);
  return extras.length
    ? { ...insight, drillUrl: `${insight.drillUrl}${separator}${extras.join("&")}` }
    : insight;
});
```

Canonical site: `src/app/admin/reports/page.tsx:InsightsSection`.

### Zero-delta noise

`<DeltaChip>` renders for any non-null number, including 0 (shows "→ 0.0%"
with arrow + "unchanged" sr-only). Inside a stripe / tile / KPI grid, this
is visual noise that doesn't earn its space — "no change" tells the
operator nothing. Filter at the helper level so the chip naturally hides:

- `pctDelta` / `ppDelta` (reports-helpers.ts) — return `undefined` when
  `Math.abs(result) < 0.05`
- `percentPointDelta` (performance-helpers.ts) — return `null` when
  rounded value is 0
- `nzDelta(raw)` helper (performance-helpers.ts) — wrap raw count deltas
  before passing to `delta:` on a TileSpec
- For ad-hoc delta computations in dashboard helpers (B-5), filter at the
  render layer in StripeTile / equivalent: `tile.delta !== 0`.

### Audit checklist before shipping a new surface

For every new tile / section / chart that lives on a filter-equipped page:

1. **Label honesty:** does the label include any period word ("today",
   "this week", "this month", "lately", "recent")? If yes — does the value
   actually narrow to that period? If picker controls it, drop the suffix
   from the label entirely.
2. **NOW-state check:** is the underlying value a state-based metric
   (`status='open'`, `active = true`, etc.) that can't be period-scoped?
   If yes — does the surface visually signal "Live · ignores filter"?
3. **Picker → data trace:** does the surface read the period URL param,
   filter the data, AND pass it to every consumer that displays per-tile?
4. **Drill scope:** do drill-links from this surface preserve current
   `scope` + `staffId`?
5. **Zero-delta:** does the delta path filter 0 before rendering
   `<DeltaChip>`?

If any of 1–5 surface a "no" you can't justify, you have a bug. Fix it
before merging.

---

*End of shared notes. Update this file as additional cross-cutting concerns surface during implementation.*
