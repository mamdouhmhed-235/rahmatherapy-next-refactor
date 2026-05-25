# Band B — Master Plan & Progress Checklist

**Purpose:** single tracking surface for the entire Band B programme. Open this file at the start of any session; update as work progresses; close the session by writing the per-phase log entry at the bottom.

**Companion files (read these too):**
- `redesign/plans/B-phase/README.md` — programme index
- `redesign/plans/B-phase/AUDIT-2026-05-22.md` — audit findings + Q/G resolutions
- `redesign/plans/B-phase/SHARED-IMPLEMENTATION-NOTES.md` — cross-cutting concerns
- `redesign/briefs/B[1-6]-*-brief.md` — per-phase design specs
- `redesign/plans/B-phase/B[0-6]-*-plan.md` — per-phase execution plans
- `redesign/per-page-progress/B[0-6]-*-progress.md` — per-phase progress logs (step-by-step)

---

## At-a-glance status

| Phase | Title | State | Started | Shipped | Commit SHA | Notes |
|---|---|---|---|---|---|---|
| B-0 | Baseline capture | ✅ complete | 2026-05-24 | 2026-05-24 | `8c142c8` | WCAG 2/3 tokens FAILED — Option C adjustment authorised; B-1 brief §5.4 must add 2 new `*-text-strong` tokens. Fresh Therapist account live. AdminSkeleton already shimmer — B-1 step 2 needs re-scoping. |
| B-1 | Foundation primitives | ✅ complete | 2026-05-24 | 2026-05-24 | `84f111e` | 77 new specs (charts + tiles + hook). Bundle delta < 0.05 kB / route (primitives dormant). useReducedMotion rewritten to useSyncExternalStore mid-flight after lint. Sandbox path corrected `__sandbox/` → `sandbox-b1/` (Next.js private-folder rule). |
| B-2 | Metric backend | ✅ complete | 2026-05-24 | 2026-05-24 | `435560f` | 3 migrations applied (Zone-2 × 3); 39 new vitest specs; ~58 `updateTag` inserts (Next 16 API; was `revalidateTag` in plan); `unstable_cache` + Sentry spans on getReportData/getDashboardData/getAuditLogForStaff; idempotent guard on `updateEnquiryStatus.first_contacted_at` proven via Playwright + DB. Chart wrapper TS errors fixed as a B-1 follow-up (commit `11a5f82`) before step 6. |
| B-3 | Performance surface | ✅ complete | 2026-05-24 | 2026-05-24 | `59cea08` + follow-up `d4f0f7c` | Core surface at `59cea08`. Follow-up `d4f0f7c` closed all plan-prescribed deferrals before B-4: per-section Suspense streaming via `cache()`-deduped fetchers (≤4 query budget preserved), Custom date-range chip + client form mirroring dashboard, Therapist-Fresh + Inactive G5 pill live-verified, multi-viewport screenshots captured. 21 new vitest specs; baseline preserved. Brief's "Performance Ghost link in StaffDetailShortcuts.tsx" corrected mid-flight: that file is a keyboard handler; visual link landed in `staff/[staffId]/page.tsx`. B-2 cache-Set regression discovered during Playwright sweep and fixed as a separate commit (`d556278`) immediately before B-3. |
| B-4 | Reports rebuild | ✅ complete | 2026-05-24 | 2026-05-24 | `0afc4dc` | **110 new vitest specs** (target ~30 in plan); per-section Suspense via `cache()` dedup landed (folded from master-checklist Step 9 into plan Step 7); InsightsStripe persistent dismiss verified end-to-end via Playwright + DB; **4 user-found visual fixes** post-audit (donut all-grey → bright OKLCH palette + center label + legend + percentages; TTFC "9712 min" → "6.7 days"; Utilisation "156.0h" → "156h"; source chart label overlap → vertical layout for mobile-first responsiveness); new SHARED-NOTES §17 codifies chart-fills-vs-text-tokens lesson for B-5+. Bundle Δ +22.65 kB / +2.65 over (BusinessPulseCard + DonutChart additive, within SHARED-NOTES §5 tolerance). Owner fully verified at 4 viewports + Coordinator + Therapist (w/ data) + Therapist-Fresh + drill-in + Personal scope at 1280. |
| B-5 | Dashboard rebuild | ✅ complete | 2026-05-24 | 2026-05-25 | `4e2c0c1` + 5 follow-ups (`8283437` docs, `6940460` mobile/zero-delta, `247fd9e` Personal-Stripe period-conflict overhaul, `48b7911` cross-surface filter-vs-data audit) | Core shipped at `4e2c0c1`; 107 new vitest specs across 7 spec files (target ~30 in plan). Wholesale restructure of page.tsx + TherapistDashboard.tsx + dashboard-cards.tsx. New components: PersonalContributionStripe, MobileStickyActionBar, PullToRefresh, SwipeableTodayCards, HighlightOrTipStrip, RecentClientsStrip, QuickHelpPanel, LegacyDisclosureCleanup. New helpers: dashboard-helpers-b5.ts (tiles + sticky + cleanup + stripe date-range), therapist-fullness.ts. M2 + M3 papercuts closed. AUDIT Q4 + Q5 + M1 + C4 + G9 + G-final-4 + Q1 + R6 honoured. Therapist-fresh empty-DB sweep: 8 meaningful blocks (target 5-7 per M1; exceeded). **4 user-driven follow-up fixes post-ship** (same session): (a) Personal Stripe mobile-friendly stacked tile layout + cross-surface zero-delta noise hide (`pctDelta` / `ppDelta` / `percentPointDelta` / `nzDelta` filter <0.05% → null); (b) Period-conflict overhaul — every stripe tile now narrows with the picker, labels are clean nouns, tile 4 became "Avg booking value" (Business) / "Avg response time" (Coord) — replaces previous NOW-state "Open attention" / "Active attention" that ignored picker; (c) Cross-surface filter-vs-data audit fixed 8 confirmed bugs across B-3/B-4/B-5 (added `tomorrow` / `this_week` / `this_month` cases to `parseReportFilters`; TherapistDashboard chip cleanup; WeeklyStatsCard data scope corrected; Performance ActivityTimeline copy aligned; BusinessPulseCard newEnquiries period-filtered; insight drillUrls preserve scope+staffId; insight grammar refactored); (d) Lessons codified as **SHARED-NOTES §18 Filter-vs-data discipline** for future filter-equipped surfaces. Bundle Δ final: +8.22 kB cumulative vs pre-B-1 (budget +18; 9.78 kB headroom). Vitest final: 482 / 476 passing / 6 baseline failing preserved. Step 12 loading.tsx skipped (file doesn't exist). Step 11 cosmetic restyle of dashboard-filters-client skipped per CLAUDE.md surgical-changes rule. |
| B-6 | Client LTV ribbon | ✅ complete | 2026-05-25 | 2026-05-25 | `a4c71cf` | `<ClientLtvRibbon>` mounts at top of `/admin/clients/[clientId]` between page header and two-column body grid. 9 new vitest specs (all 4 chip buckets + zero-state hide + all-cancelled + therapist-narrowed + truncation + tooltip). Bundle Δ +0 kB gzip vs pre-B-6 (well under +6 kB budget). Inline SVG sparkline replaced B-1 `Sparkline` mid-flight — B-1's Recharts-backed primitive would have added +97 kB by pulling Recharts into the route bundle for the first time; the SVG carries the brief-specced area fill at 8 % opacity that the import-only primitive doesn't expose. Loyal fixture (client_id `c5e46e32-…`) seeded for Playwright visual verification (12 completed bookings · £660 LTV · 4 assigned to test.therapist), all 5 role scenarios verified, fixture cleaned up before commit. Cache-hit + mutation-flow (add client note → reload → ribbon untouched) both clean. |

**State legend:** ⏳ pending · 🔨 in progress · ✅ complete · ⚠️ blocked · ⏸ paused

---

## Site + credentials reference

**Site URL (dev):** http://localhost:3000 (must be running via `pnpm dev`)

**Port note (per AUDIT M9):** single-branch sequential per Q9 — port 3000 always. If you ever spin up a worktree (not recommended this programme), use a different port via `pnpm dev --port 3001` to avoid clash with the main tree's dev server.

| Role | Email | Password | Notes |
|---|---|---|---|
| Owner | `rahmatherapy@outlook.com` | `Password123` | Main owner admin account |
| Admin | `test.admin@rahmatherapy.example.test` | `AdminTest123!` | Practice Manager scope |
| Coordinator | `test.coordinator@rahmatherapy.example.test` | `CoordinatorTest123!` | Booking Coordinator scope |
| Therapist | `test.therapist@rahmatherapy.example.test` | `TherapistTest123!` | Has assignments + history |
| Therapist (fresh) | `test.therapist.fresh@rahmatherapy.example.test` | `TherapistFresh123!` | **Created in B-0** — empty-state verification |
| Inactive | `test.inactive@rahmatherapy.example.test` | `InactiveTest123!` | Blocked at middleware |

**Supabase project:** `twzutkfgqclqurvkmvqz` (production). Zone-2 confirmation required for any `mcp__supabase__apply_migration` call.

---

## The standard per-phase loop

Every phase below runs this 6-step loop. Per-phase checklists customise the content of each step; the structure is identical so muscle-memory carries between phases.

### Step 1 — Pre-flight: codebase + database audit
**Why:** verify the brief/plan's assumptions still match reality before writing code. Catches drift since the briefs were written.

- [ ] On branch `redesign/start-state` (or a worktree if explicitly approved — per Q9 default is single branch).
- [ ] `git status` clean (no uncommitted leftovers from a prior phase).
- [ ] `git log --oneline -10` reviewed (last 10 commits sanity-check the stack).
- [ ] Grep the phase's "Files to edit" + "Files to NEVER touch" lists from the plan — confirm paths still exist as named (case-sensitive).
- [ ] **Database audit (when migrations or new tables involved):** `mcp__supabase__list_tables` on affected schema; `mcp__supabase__list_extensions` if RLS / triggers / functions are involved. Document findings in the phase's progress file.
- [ ] **DB state confirmation:** for B-2 specifically, verify `enquiries.first_contacted_at` is absent before migrating; `enquiries.converted_booking_id` is present (skip migration); `notification_state` table is present (R4).

### Step 2 — Read & understand
**Why:** the audit cycle taught us that briefs/plans can drift from code; reading the latest version is the only way to catch corrections.

- [ ] Read `redesign/plans/B-phase/README.md` (programme context).
- [ ] Read the phase's brief end-to-end (`redesign/briefs/B[N]-*-brief.md`).
- [ ] Read the phase's plan end-to-end (`redesign/plans/B-phase/B[N]-*-plan.md`).
- [ ] Skim relevant sections of `SHARED-IMPLEMENTATION-NOTES.md` (the plan's "Verification gate" cites which §§ to read).
- [ ] Skim relevant entries of `AUDIT-2026-05-22.md` for this phase (post-question resolutions affect almost every phase).
- [ ] Open the phase's progress file (`redesign/per-page-progress/B[N]-*-progress.md`) ready to append step-COMPLETE lines.

### Step 3 — Implement
**Why:** follow the plan's "Safe implementation order" verbatim. Don't skip steps. Append progress as you go.

- [ ] Execute each plan step in order.
- [ ] After each step: append `step-N: COMPLETE — <one-line evidence>` to the per-page-progress file.
- [ ] If a plan step needs Zone-2 user confirmation (migrations, fresh test account creation): pause, request confirmation, document the approval, proceed.
- [ ] If a plan step reveals a discrepancy: pause, document in the progress file, flag to the user before working around it. **Don't fabricate workarounds.**

### Step 4 — Static gates
**Why:** catch type/lint/test regressions before they reach Playwright.

- [ ] `pnpm lint` → 0 errors, 0 new warnings.
- [ ] `npx tsc --noEmit` → 0 errors.
- [ ] `pnpm vitest run` → all new specs pass; baseline 112/118 preserved (the 6 pre-existing failures from HANDOFF §4.5 stay failing — they're not the phase's concern).
- [ ] `pnpm build` → succeeds.
- [ ] Bundle delta within budget per `SHARED-IMPLEMENTATION-NOTES.md` §11 (compare to `redesign/baselines/bundle-pre-B1.json` from B-0).
- [ ] **If any static gate fails:** stop. Fix root cause. Do NOT skip to Playwright with red gates.

### Step 5 — Playwright role sweep
**Why:** the briefs/plans guarantee per-role rendering; the only way to verify is signing in as each role and exercising the surface.

**Prerequisite:** `pnpm dev` is running on http://localhost:3000 in a separate terminal. Verify with `curl -I http://localhost:3000/admin/login` returning 200 OK.

For each surface this phase touches, run the standard Playwright sweep recipe (defined below in "Playwright sweep recipe"). Phases differ only in:
- Which surfaces are touched
- Which roles' behaviour changes
- Which functional flows need exercising

The per-phase checklists below specify the exact roles + surfaces + flows for that phase. **Capture screenshots at 375 / 768 / 1280 / 1440 per (role × surface)** to `redesign/baselines/screenshots-post-B[N]/{viewport}/{role}-{page}.png`.

### Step 6 — Commit + handoff
**Why:** clean commit grain + HANDOFF updated lets the next session pick up cleanly.

- [ ] Stage scoped files explicitly (`git add <path>` — never `git add .` or `git add -A`).
- [ ] Commit with the message from the phase's plan (or a logical refinement).
- [ ] Update the at-a-glance status table at the top of this file (state → ✅, fill commit SHA, shipped date).
- [ ] Update HANDOFF-2026-05-21.md §1.x (or new §1.y) with a one-paragraph summary of what landed.
- [ ] Append a Per-phase log entry at the bottom of this file (see template).

---

## Playwright sweep recipe (reusable)

Use this recipe in every phase that touches UI (all except B-0 and B-2). Adapt the role list and surface list per phase.

### Prerequisites

- [ ] Dev server running: `pnpm dev` (port 3000)
- [ ] Browser context fresh (clear cookies via `mcp__playwright__browser_evaluate` `document.cookie = ''` if needed)
- [ ] Latest commit pushed; `git status` clean

### The sweep — repeat per role

For each role in the phase's "Roles to verify" list:

1. **Navigate to login**
   - [ ] `mcp__playwright__browser_navigate` → `http://localhost:3000/admin/login`
   - [ ] `mcp__playwright__browser_snapshot` → confirm login form visible
2. **Sign in**
   - [ ] `mcp__playwright__browser_fill_form` with email + password from credentials table above
   - [ ] Submit; wait for redirect to `/admin/dashboard` (or appropriate landing)
   - [ ] `mcp__playwright__browser_snapshot` → confirm signed-in state (role pill / user menu visible)
3. **Navigate to the phase's primary surface**
   - [ ] `mcp__playwright__browser_navigate` → target URL
   - [ ] Wait for load via `mcp__playwright__browser_wait_for` on an expected element
   - [ ] `mcp__playwright__browser_snapshot` → confirm correct variant rendered
4. **Visual audit at 4 viewports**
   - [ ] `mcp__playwright__browser_resize` → 375 × 812 (iPhone X portrait)
   - [ ] `mcp__playwright__browser_take_screenshot` → save as `redesign/baselines/screenshots-post-B[N]/375/{role}-{page}.png`
   - [ ] `mcp__playwright__browser_resize` → 768 × 1024 (iPad portrait)
   - [ ] `mcp__playwright__browser_take_screenshot` → same naming
   - [ ] `mcp__playwright__browser_resize` → 1280 × 800 (laptop)
   - [ ] `mcp__playwright__browser_take_screenshot`
   - [ ] `mcp__playwright__browser_resize` → 1440 × 900 (large desktop)
   - [ ] `mcp__playwright__browser_take_screenshot`
5. **Functional flow verification** (phase-specific — see per-phase below)
   - [ ] Exercise the key interactions: clicks, form submissions, drill-ins, sticky-bar taps, etc.
   - [ ] `mcp__playwright__browser_console_messages` after each flow → confirm 0 errors, 0 new warnings vs pre-phase baseline.
   - [ ] `mcp__playwright__browser_network_requests` → confirm no failed requests, no surprise external calls.
6. **Cache-hit verification (MANDATORY per surface — added 2026-05-24 after B-2 cache-Set regression)**
   - **Why:** B-2's smoke check only exercised cold-cache state. The cache-Set bug (`unstable_cache` JSON-serializing `Set<string>` → `{}`) only triggered on cache-hit reads — i.e. on every page render after the 60s `revalidate` window had filled in cache. **B-2 shipped, and the dashboard was effectively broken in production-realistic conditions until B-3 caught it one session later.** The lesson: every cached surface must be reloaded a second time before claiming Playwright pass.
   - [ ] **First render (cold cache):** navigate to the surface — this is the fetch that populates `unstable_cache`.
   - [ ] `mcp__playwright__browser_console_messages` → 0 errors.
   - [ ] **Second render (warm cache, ≤ 60s after first):** `mcp__playwright__browser_navigate` to a sibling page (e.g. `/admin/dashboard`), then back to the surface. The second navigation reads from cache. **This is the test that would have caught the B-2 bug.**
   - [ ] `mcp__playwright__browser_console_messages` → 0 errors. If a TypeError surfaces on the second render but not the first, suspect cache serialisation (Sets/Maps/Dates degrading through JSON). See SHARED-IMPLEMENTATION-NOTES §15.
   - [ ] Repeat for each surface this phase touches (every page that has an `unstable_cache` wrap or consumes a helper that does).
7. **Mutation flow verification (MANDATORY per phase if any server actions are wired)**
   - **Why:** read-only sweeps miss server-action regressions. The standard loop must exercise at least one representative mutation per surface — proves `updateTag(...)` invalidation works AND that the post-mutation render reads fresh data through the cache.
   - [ ] Identify the phase's headline mutation per surface (e.g. for Reports: dismiss an Insights row; for Dashboard: claim an assignment; for Performance surface: trigger an audit-emitting action from another tab).
   - [ ] Perform the mutation via the UI.
   - [ ] `mcp__playwright__browser_navigate` → reload the source page (or back-navigate from sibling). Confirm the post-mutation state is visible (e.g. dismissed insight disappears; new audit row appears; assignment moves out of Claimable).
   - [ ] `mcp__supabase__execute_sql` → spot-check the DB row reflects the mutation (single-row SELECT — not a full table dump).
   - [ ] `mcp__playwright__browser_console_messages` → 0 errors during AND after the mutation cycle.
   - [ ] For phases where the mutation only exists on a denied surface for the active role: skip and document in progress file.
8. **Sign out**
   - [ ] `mcp__playwright__browser_navigate` → POST `/admin/signout` (or click sign-out menu item) — note that GET on `/admin/signout` returns 500; use `mcp__playwright__browser_evaluate` with `fetch('/admin/signout', { method: 'POST', credentials: 'include' })` if direct nav fails.
   - [ ] Confirm redirect to login.

### Edge cases per phase

Each phase's checklist below lists additional edge cases (e.g. denied-permission renders, empty-DB renders, mobile gestures). Run them after the per-role sweep.

### Capturing evidence

- [ ] All screenshots saved to `redesign/baselines/screenshots-post-B[N]/{viewport}/{role}-{page}-{state}.png`
- [ ] Console log: copy any non-trivial output to per-page-progress file
- [ ] Network log: same for any non-trivial requests

---

## Per-phase checklists

### B-0 — Baseline capture

**Brief:** none (capture-only)
**Plan:** `redesign/plans/B-phase/B0-baseline-plan.md`
**Progress:** `redesign/per-page-progress/B0-baseline-progress.md`
**Effort:** ~0.5 day
**Day:** 1 (morning)

#### Step 1 — Pre-flight
- [ ] On branch `redesign/start-state`
- [ ] `git status` clean
- [ ] `git log --oneline -10` — confirm HEAD is `20aba4b` (or close)
- [ ] DB audit: `mcp__supabase__list_tables` on `public` schema; record current table count + names for reference
- [ ] Verify `pnpm dev` runs successfully on port 3000 (cold start)
- [ ] Verify `pnpm build` succeeds on clean tree (this is what we'll baseline against)

#### Step 2 — Read & understand
- [ ] Read `B0-baseline-plan.md` end-to-end
- [ ] Read `SHARED-IMPLEMENTATION-NOTES.md` §3 (a11y), §5 (bundle budgets), §13 (dev seeding), §14 (`insight_dismissals` spec — for later context)

#### Step 3 — Implement (per plan steps 1–7)
- [ ] **Step 1 — Bundle baseline:** `pnpm build` clean tree; record first-load JS for `/admin/dashboard`, `/admin/reports`, `/admin/clients/[clientId]`, `/admin/staff/[staffId]` into `redesign/baselines/bundle-pre-B1.json`
- [ ] **Step 2 — Visual baseline:** sign in as Owner via Playwright; screenshot dashboard / reports / a client-detail at 4 viewports × populated + skeleton states. Save to `redesign/baselines/screenshots-pre-B1/`
- [ ] **Step 3 — Sentry baseline:** capture active issue count + top 10 issues from Sentry dashboard; save to `redesign/baselines/sentry-baseline.txt`
- [ ] **Step 4 — WCAG verification:** compute contrast for proposed severity-strong tokens (`oklch(92% 0.075 20)` etc.) against intended text tokens; record to `redesign/baselines/wcag-severity-tokens.md`. If any fail AA: pause, request user authorisation to adjust the OKLCH values before B-1 commits them.
- [ ] **Step 5 — Fresh test Therapist account (Zone-2):** request user confirmation; create `test.therapist.fresh@rahmatherapy.example.test` / `TherapistFresh123!` via Supabase MCP; verify sign-in works; confirm `/admin/dashboard` renders Therapist variant with zero data; update HANDOFF §4.2 credentials section
- [ ] **Step 6 — Per-phase progress templates:** confirm all 7 files exist in `redesign/per-page-progress/B[0-6]-*-progress.md` (created in the planning session — verify still present)

#### Step 4 — Static gates (light for B-0)
- [ ] `pnpm lint` clean (no code changes; should be unaffected)
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm build` succeeds (this IS the baseline capture)

#### Step 5 — Playwright sweep (light)
- [ ] Sign in as the new `test.therapist.fresh@…` account
- [ ] Navigate to `/admin/dashboard` → confirm Therapist variant renders with NO bookings, NO assignments, NO claimable. Screenshot at 4 viewports → `screenshots-pre-B1/empty-therapist-{viewport}.png`
- [ ] Sign out
- [ ] Sign in as Owner → repeat baseline screenshots for populated states

#### Step 6 — Commit
- [ ] Stage: `redesign/baselines/` + `redesign/per-page-progress/B0-baseline-progress.md` + HANDOFF (credentials update)
- [ ] Commit: `chore(admin): B-0 — baseline capture (bundle + screenshots + Sentry + WCAG + fresh therapist account)`
- [ ] Update master checklist status: B-0 → ✅
- [ ] Append per-phase log entry below

---

### B-1 — Foundation primitives

**Brief:** `redesign/briefs/B1-foundation-primitives-brief.md`
**Plan:** `redesign/plans/B-phase/B1-foundation-plan.md`
**Progress:** `redesign/per-page-progress/B1-foundation-progress.md`
**Effort:** ~1 day
**Day:** 1 (afternoon) + Day 2 (morning)
**Roles to verify:** Owner (existing pages still render — primitives added in dormant state)

#### Step 1 — Pre-flight
- [ ] B-0 complete + ✅ in status table
- [ ] On branch `redesign/start-state` with B-0 commit on HEAD
- [ ] `git status` clean
- [ ] Codebase audit: verify `src/styles/tokens.css` exists; verify `src/app/admin/components/admin-ui.tsx` `<AdminSkeleton>` still uses pulse keyframe (to be replaced); verify `recharts` is in `package.json` deps (will be wrapped)
- [ ] DB audit: not relevant (no schema changes)

#### Step 2 — Read & understand
- [ ] Read `B1-foundation-primitives-brief.md` end-to-end
- [ ] Read `B1-foundation-plan.md` end-to-end
- [ ] Read `SHARED-IMPLEMENTATION-NOTES.md` §3 (a11y), §5 (bundle budgets), §10 (Suspense)
- [ ] Read `AUDIT-2026-05-22.md` G3 + R6 entries

#### Step 3 — Implement (per plan steps 1–8)
- [ ] Step 1 — Tokens added to `tokens.css` (5 new tokens; existing tokens untouched)
- [ ] Step 2 — `AdminSkeleton` shimmer keyframe swapped (export name + props preserved)
- [ ] Step 3 — `charts/theme.ts` created with semantic colour map; 6 specs pass
- [ ] Step 4 — Chart primitives created in order: Sparkline, Line, Area, Bar, StackedBar, Donut; per-chart specs pass
- [ ] Step 5 — Tile primitives created in order: DeltaChip, Sparkline (tile-tail), CountUp, MetricRow, KpiTile, TrendTile, ScorecardRing; per-tile specs pass
- [ ] Step 6 — Sandbox visual smoke: `__sandbox/b1/page.tsx` renders every primitive; screenshot at 3 viewports; visual matches brief
- [ ] Step 7 — Bundle delta verification: ≤ +12kB gzip on `/admin/dashboard` first-load vs B-0 baseline
- [ ] Step 8 — Cleanup: `__sandbox/` deleted; lint+tsc+vitest re-run green

#### Step 4 — Static gates
- [ ] `pnpm lint` clean
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm vitest run` — ~14 new specs pass; baseline 112 preserved
- [ ] `pnpm build` — clean; bundle delta within +12kB budget
- [ ] No `__sandbox/` files in `git status`

#### Step 5 — Playwright sweep (light — primitives are dormant)
- [ ] Dev server running on port 3000
- [ ] Sign in as Owner via Playwright
- [ ] Navigate to `/admin/dashboard` — confirm page still renders (no regression from skeleton shimmer swap)
- [ ] Throttle network to "Slow 3G" via DevTools; reload → observe shimmer skeleton replaces old pulse → screenshot
- [ ] Navigate to `/admin/reports` — same shimmer verification
- [ ] `browser_console_messages` → 0 new errors vs B-0 baseline
- [ ] Save screenshots to `screenshots-post-B1/`

#### Step 6 — Commit + handoff
- [ ] Stage: new files in `src/app/admin/components/charts/` + `tiles/`; modifications to `tokens.css` + `admin-ui.tsx`; new specs; progress file
- [ ] Commit: `feat(admin): B-1 — foundation primitives (charts + tiles + severity-strong tokens + skeleton shimmer)`
- [ ] Update status table
- [ ] Append log entry

---

### B-2 — Metric backend

**Brief:** `redesign/briefs/B2-metric-backend-brief.md`
**Plan:** `redesign/plans/B-phase/B2-metric-backend-plan.md`
**Progress:** `redesign/per-page-progress/B2-metric-backend-progress.md`
**Effort:** ~3.5 days
**Days:** 2–5
**Roles to verify:** smoke check existing pages still render (no UI changes)

#### Step 1 — Pre-flight
- [ ] B-1 complete + ✅
- [ ] `git status` clean
- [ ] Codebase audit: verify `src/app/admin/reports/reporting.ts` exists; verify `src/app/admin/enquiries/actions.ts:updateEnquiryStatus` exists; verify `src/app/admin/dashboard/dashboard-data.ts:getDashboardData` exists
- [ ] DB audit (CRITICAL — pre-migration):
  - [ ] `mcp__supabase__list_tables` on `public` schema → confirm `enquiries` exists; record current column list for `enquiries`
  - [ ] Verify `enquiries.converted_booking_id` IS present (skip its migration per AUDIT C3)
  - [ ] Verify `enquiries.first_contacted_at` is ABSENT (will be added)
  - [ ] Verify `notification_state` table is present (R4; not modified, just confirming baseline)
  - [ ] Verify `insight_dismissals` is ABSENT (will be added)
  - [ ] `mcp__supabase__list_extensions` → confirm `pgcrypto` if needed

#### Step 2 — Read & understand
- [ ] Read `B2-metric-backend-brief.md` end-to-end
- [ ] Read `B2-metric-backend-plan.md` end-to-end
- [ ] Read `SHARED-IMPLEMENTATION-NOTES.md` §1 (DB indexes), §8 (migration discipline), §12 (Sentry slow-query), §14 (insight_dismissals spec)
- [ ] Read `AUDIT-2026-05-22.md` C3, H3, H4, Q2, Q6, G1, G7 entries

#### Step 3 — Implement (per plan steps 1–12)
- [ ] Step 1 — Schema verification done; findings logged in progress file
- [ ] Step 2 — `first_contacted_at` migration created → Zone-2 confirmation requested → applied via MCP → verified
- [ ] Step 3 — Band B indexes migration created → Zone-2 → applied → verified
- [ ] Step 3.5 — `insight_dismissals` migration created → Zone-2 → applied → table + RLS + 3 policies verified
- [ ] Step 4 — `updateEnquiryStatus` action extended with idempotent guard; tested via 5-state verification (new → contacted → contacted-noop → booked → contacted-noop-still)
- [ ] Step 5 — 10 new helpers added to `reporting.ts` in dependency order; per-helper vitest specs pass
- [ ] Step 6 — `report-insights.ts` + `insight-actions.ts` created with `dismissInsight`; specs pass
- [ ] Step 7 — `client-metrics.ts` created; specs pass
- [ ] Step 8 — `unstable_cache` wraps applied to `getReportData` + `getDashboardData`; cache hit observed on second reload within 60s
- [ ] Step 9 — `revalidateTag` wired on all 6–10 mutation sites
- [ ] Step 10 — Vitest final pass: ~30 new specs pass; baseline preserved
- [ ] Step 11 — Smoke check: `getStaffScorecard` console.log returns sane values for known DB state; temporary wire reverted
- [ ] Sentry slow-query spans wired per SHARED-NOTES §12

#### Step 4 — Static gates
- [ ] `pnpm lint` clean
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm vitest run` — ~30 new specs pass; baseline 112 preserved
- [ ] `pnpm build` succeeds
- [ ] Bundle delta: 0 kB (no UI changes)
- [ ] Migration verification SQL:
  ```sql
  SELECT column_name FROM information_schema.columns
    WHERE table_name='enquiries' AND column_name='first_contacted_at';  -- expect 1 row
  SELECT tablename, rowsecurity FROM pg_tables
    WHERE tablename='insight_dismissals';  -- expect 1 row, rowsecurity=true
  SELECT policyname FROM pg_policies WHERE tablename='insight_dismissals';  -- expect 3
  ```

#### Step 5 — Playwright sweep (smoke only — no UI changes)
- [ ] Sign in as Owner
- [ ] Navigate to `/admin/dashboard` → confirm still renders identically to B-1
- [ ] Navigate to `/admin/reports` → confirm still renders identically
- [ ] Navigate to `/admin/enquiries` → mark an enquiry as "contacted" → reload → verify `first_contacted_at` populated in DB via `mcp__supabase__execute_sql`
- [ ] Mark the same enquiry "booked" → verify `first_contacted_at` UNCHANGED (idempotent guard works)
- [ ] `browser_console_messages` → 0 new errors

#### Step 6 — Commit + handoff
- [ ] Stage: new files in `src/app/admin/reports/` + `src/app/admin/clients/`; modifications to `reporting.ts` / `dashboard-data.ts` / `enquiries/actions.ts` / mutation actions; 3 migration files; specs; progress file
- [ ] Commit: `feat(admin): B-2 — metric backend (helpers + migrations + cache + insight dismissals + Sentry spans)`
- [ ] Update status table
- [ ] Append log entry
- [ ] Update HANDOFF §4.3 with the 3 new migrations applied

---

### B-3 — Performance surface

**Brief:** `redesign/briefs/B3-performance-surface-brief.md`
**Plan:** `redesign/plans/B-phase/B3-performance-surface-plan.md`
**Progress:** `redesign/per-page-progress/B3-performance-surface-progress.md`
**Effort:** ~2 days
**Days:** 5–7
**Roles to verify:** Owner, Admin, Coordinator, Therapist, Inactive (blocked), Therapist-Fresh

#### Step 1 — Pre-flight
- [ ] B-2 complete + ✅
- [ ] `git status` clean
- [ ] Codebase audit: verify `src/app/admin/staff/[staffId]/page.tsx` exists; verify `src/app/admin/staff/[staffId]/availability/page.tsx` exists (matches sub-route pattern); verify `src/app/admin/staff/[staffId]/StaffDetailShortcuts.tsx` exists
- [ ] Verify `src/app/admin/components/AdminTopNav.tsx` exists (where "My Performance" link will land)
- [ ] DB audit: `audit_logs_actor_recent_idx` index present (from B-2)

#### Step 2 — Read & understand
- [ ] Read `B3-performance-surface-brief.md` end-to-end (note all path corrections to `[staffId]`)
- [ ] Read `B3-performance-surface-plan.md` end-to-end
- [ ] Read `SHARED-IMPLEMENTATION-NOTES.md` §3 (a11y), §10 (Suspense), §11 (query budget ≤4)
- [ ] Read `AUDIT-2026-05-22.md` C1, H1, G1, G5 entries

#### Step 3 — Implement (per plan steps 1–12)
- [ ] Step 1 — `performance-helpers.ts` + specs
- [ ] Step 2 — `<ActivityTimeline>` (consumes `getAuditLogForStaff` from B-2)
- [ ] Step 3 — `<PerformanceHeader>` with period selector
- [ ] Step 4 — `<PerformanceSurface>` shared component with role-aware tile selection
- [ ] Step 5 — `/admin/me/page.tsx` route + `getUpcomingWorkForStaff` helper colocated in `performance-data.ts`
- [ ] Step 6 — `/admin/staff/[staffId]/performance/page.tsx` sub-route + StaffDetailShortcuts "Performance" link added
- [ ] Step 7 — `AdminTopNav` "My Performance" link
- [ ] Step 8 — static gates pass
- [ ] Step 9 — Playwright role sweep (Step 5 of this checklist)
- [ ] Step 10 — mobile sticky bar verification (Therapist + Coordinator)
- [ ] Step 11 — activity timeline freshness (action → reload → new row appears)

#### Step 4 — Static gates
- [ ] `pnpm lint` clean
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm vitest run` — new specs pass; baseline preserved
- [ ] `pnpm build` succeeds
- [ ] Bundle delta: `/admin/me` ≤ +25kB; `/admin/staff/[staffId]/performance` ≤ +18kB

#### Step 5 — Playwright sweep
- [ ] Dev server running

**Per-role sweep** (full recipe per role):
- [ ] **Owner** signs in → navigate `/admin/me` → assert union tile set + activity timeline + screenshots at 4 viewports
- [ ] **Owner** → navigate `/admin/staff/{therapistId}/performance` (use Aisha's ID) → assert "Performance — Aisha Hassan" header + manager-view chrome
- [ ] **Owner** → navigate `/admin/staff/{ownId}/performance` → assert redirect to `/admin/me`
- [ ] **Owner** → navigate `/admin/staff/{inactiveTherapistId}/performance` → assert historical render + "Inactive since {date}" pill
- [ ] **Admin** signs in → `/admin/me` → 6+ Admin tiles rendered
- [ ] **Coordinator** signs in → `/admin/me` → 5 Coordinator tiles + "Enquiries needing follow-up" panel
- [ ] **Coordinator** → try `/admin/staff/{therapistId}/performance` → assert `AdminAccessDenied`
- [ ] **Therapist** signs in → `/admin/me` → 8 Therapist tiles + "My upcoming work" panel + mobile sticky "Go to next visit"
- [ ] **Therapist** → try `/admin/staff/{otherTherapistId}/performance` → assert `AdminAccessDenied`
- [ ] **Therapist-Fresh** signs in → `/admin/me` → 8 zero-but-formatted tiles + empty activity timeline + empty upcoming-work panel; **mobile sticky bar fallback ladder verified** (since no Next Visit, should show "Browse claimable →" OR "Set my availability →")
- [ ] **Inactive** tries `/admin/me` → redirect to `/admin/login?reason=inactive`

**Functional flows:**
- [ ] Period selector chips change URL `?range=` and re-render
- [ ] "View in Reports →" link (Owner / Admin) opens `/admin/reports?staffId={id}&scope=personal&range={range}` (page not built yet — only check link target)
- [ ] Activity timeline auto-updates: perform an action in another tab (mark booking confirmed) → reload `/admin/me` → new audit row at top
- [ ] `browser_console_messages` → 0 new errors per role

#### Step 6 — Commit + handoff
- [ ] Stage scoped files
- [ ] Commit: `feat(admin): B-3 — Performance surface (/admin/me + sub-route on /admin/staff/[staffId]/performance)`
- [ ] Status table
- [ ] Log entry

---

### B-4 — Reports rebuild

**Brief:** `redesign/briefs/B4-reports-rebuild-brief.md`
**Plan:** `redesign/plans/B-phase/B4-reports-rebuild-plan.md`
**Progress:** `redesign/per-page-progress/B4-reports-rebuild-progress.md`
**Effort:** ~3.5 days
**Days:** 7–10
**Roles to verify:** Owner, Admin, Coordinator, Therapist, Therapist-Fresh, Denied (any role without `view_reports_*`)

#### Step 1 — Pre-flight
- [ ] B-3 complete + ✅
- [ ] `git status` clean
- [ ] Codebase audit: verify `src/app/admin/reports/page.tsx` exists at 1053 lines (the rebuild target); verify `ReportsCharts.tsx` exists; verify `BusinessPulseCard` is exported from `dashboard-cards.tsx` (will receive in this phase)
- [ ] DB audit: `insight_dismissals` table + RLS verified present (B-2)

#### Step 2 — Read & understand
- [ ] Read `B4-reports-rebuild-brief.md` end-to-end
- [ ] Read `B4-reports-rebuild-plan.md` end-to-end
- [ ] Read `SHARED-IMPLEMENTATION-NOTES.md` §10 (Suspense), §11 (query budget ≤8), §14 (insight_dismissals)
- [ ] Read `AUDIT-2026-05-22.md` Q3, Q6, Q8 entries

#### Step 3 — Implement (per plan steps 1–12)
- [ ] Step 1 — `reports-helpers.ts` extracted; specs
- [ ] Step 2 — `<ScopePill>` + `<PersonalTeamToggle>`
- [ ] Step 3 — `<InsightsStripe>` + `<InsightRow>` (client component) with dismiss UX
- [ ] Step 4 — `<HeadlineTileStrip>` (4/6 tiles per scope)
- [ ] Step 5 — `<WorkloadStaffRow>` with stacked-bar
- [ ] Step 6 — `ReportsCharts.tsx` rewritten on B-1 primitives with semantic colours
- [ ] Step 7 — `page.tsx` wholesale restructure (preserve GET param contract + CSV deep-links)
- [ ] Step 8 — `loading.tsx` skeleton shapes updated
- [ ] Step 9 — per-section Suspense boundaries
- [ ] Step 10 — Playwright role sweep + insights smoke (Step 5 of this checklist)
- [ ] Step 11 — CSV download verification (8 + 5 + 1 chips)
- [ ] Step 11.5 — print-friendly stylesheet (per AUDIT Q8)

#### Step 4 — Static gates
- [ ] `pnpm lint` clean
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm vitest run` — new specs pass; baseline preserved
- [ ] `pnpm build` succeeds
- [ ] Bundle delta: `/admin/reports` ≤ +20kB cumulative vs B-0

#### Step 5 — Playwright sweep
- [ ] Dev server running

**Per-role sweep:**
- [ ] **Owner** → `/admin/reports` → 6 tiles + Insights stripe (seed thresholds first to ensure at least 1 row renders) + 3 sections + 8 CSV chips. Screenshots at 4 viewports.
- [ ] **Owner** → toggle `[Personal]` → confirm WHOLE PAGE narrows (tiles + charts + sections + CSV exports) per AUDIT Q3
- [ ] **Owner** → click an Aisha workload row → URL gains `?staffId=...` → page narrows → "Back to all staff" link works
- [ ] **Owner** → set `?range=lifetime` → confirm delta chips hidden across all tiles
- [ ] **Owner** → dismiss an Insights row → row vanishes optimistically → reload → row stays dismissed (DB row in `insight_dismissals`)
- [ ] **Owner** → browser print preview at 1280 viewport → confirm chrome hidden, page-breaks correct, A4 portrait legible
- [ ] **Admin** → same as Owner (identical scope)
- [ ] **Coordinator** → `/admin/reports` → 4 tiles (no Revenue / Outstanding), Money section hidden, 5 CSV chips
- [ ] **Therapist** → `/admin/reports` → "My report" header, 4 tiles scoped to self, Workload Staff hidden, 1 CSV chip
- [ ] **Therapist-Fresh** → `/admin/reports` → "My report" with all zero metrics; Insights stripe info row "No activity this period" or hidden

**Functional flows:**
- [ ] CSV chip downloads (8 + 5 + 1 — verify file received with correct content scope)
- [ ] Personal toggle → URL + page state both update
- [ ] Insights drill-link navigates correctly
- [ ] `browser_console_messages` clean per role

**Cache-hit verification (recipe step 6, MANDATORY):**
- [ ] **Owner /admin/reports** — first render (cold), then back-navigate from `/admin/dashboard`, then return → second render reads from `unstable_cache`. Console clean. This is the test that would have caught the B-2 cache-Set bug had it run during B-2.
- [ ] **Owner /admin/reports?scope=personal** — same cold + warm cycle.
- [ ] **Coordinator /admin/reports** — same cold + warm cycle (narrower scope = different cache key).
- [ ] **Therapist /admin/reports** — same cold + warm cycle.
- [ ] If a TypeError appears on the second render and not the first: stop, root-cause via SHARED-NOTES §15 cache-serialisation audit before continuing.

**Mutation flow verification (recipe step 7, MANDATORY):**
- [ ] **Owner** dismisses an Insights row → row vanishes optimistically → reload reads from cache → row STAYS dismissed → DB spot-check via `mcp__supabase__execute_sql` confirms `insight_dismissals` row inserted. Console clean throughout.
- [ ] **Owner** toggles `[Personal]` → URL updates → page narrows → toggles back → page widens. No stale data after toggling.
- [ ] **Therapist** downloads the single available CSV → file received → spot-check first 5 rows in the file match the visible Reports content.

#### Step 6 — Commit + handoff
- [ ] Stage scoped files
- [ ] Commit: `feat(admin): B-4 — Reports rebuild (6 tiles + Insights stripe + Personal/Team + drill-in + semantic charts + print + dismiss)`
- [ ] Status table
- [ ] Log entry

---

### B-5 — Dashboard rebuild

**Brief:** `redesign/briefs/B5-dashboard-rebuild-brief.md`
**Plan:** `redesign/plans/B-phase/B5-dashboard-rebuild-plan.md`
**Progress:** `redesign/per-page-progress/B5-dashboard-rebuild-progress.md`
**Effort:** ~4 days
**Days:** 10–14
**Roles to verify:** Owner, Admin, Coordinator, Therapist, Therapist-Fresh, Inactive

#### Step 1 — Pre-flight
- [ ] B-4 complete + ✅
- [ ] `git status` clean
- [ ] Codebase audit: verify `src/app/admin/dashboard/page.tsx`, `TherapistDashboard.tsx`, `dashboard-cards.tsx`, `dashboard-filters-client.tsx`, `dashboard-header.tsx` all exist
- [ ] Verify `<ClaimAssignmentButton>` exists at `src/app/admin/bookings/ClaimAssignmentButton.tsx` (takes `assignmentId` prop per AUDIT C4)
- [ ] Verify `<BusinessPulseCard>` has been moved to Reports in B-4 (remove the import here)
- [ ] DB audit: not relevant (no schema changes)

#### Step 2 — Read & understand
- [ ] Read `B5-dashboard-rebuild-brief.md` end-to-end (especially §5.6 Therapist fullness pass)
- [ ] Read `B5-dashboard-rebuild-plan.md` end-to-end
- [ ] Read `SHARED-IMPLEMENTATION-NOTES.md` §11 (query budget ≤6)
- [ ] Read `AUDIT-2026-05-22.md` C4, M1, Q1, Q4, Q5, G4, G9 entries

#### Step 3 — Implement (per plan steps 1–19)
- [ ] Step 1 — `dashboard-helpers-b5.ts` + specs
- [ ] Step 2 — `<PersonalContributionStripe>` (4 tiles per variant; Owner sees own metrics per AUDIT Q4)
- [ ] Step 3 — M2 fix: per-row hrefs on `<OperationsHealthCard>`
- [ ] Step 4 — M3 fix: inline `<ClaimAssignmentButton assignmentId={...} />` on Therapist Claimable cards (NO confirm modal per AUDIT C4)
- [ ] Step 5 — `<MobileStickyActionBar>` with Therapist fallback ladder (Next Visit → Browse claimable → Set availability per AUDIT Q5)
- [ ] Step 6 — `<PullToRefresh>` with 2-second debounce per AUDIT G9
- [ ] Step 7 — `<SwipeableTodayCards>` (mobile only)
- [ ] Step 8 — `page.tsx` restructure (drop BusinessPulseCard + Tier-2 disclosure for Business; preserve Coordinator disclosure; preserve `?todayView=` per AUDIT G4)
- [ ] Step 9 — `TherapistDashboard.tsx` fullness pass (10 content blocks per brief §5.6) wrapped in `NEXT_PUBLIC_B5_THERAPIST_FULLNESS` feature flag. Tone-refined per AUDIT Q1 (no ★ pill, factual milestone copy)
- [ ] Step 10 — severity-strong tokens applied; equal min-heights
- [ ] Step 11 — filters-client restyled; Business has no disclosure
- [ ] Step 12 — `loading.tsx` updated
- [ ] Step 13–18 — verification rounds (Step 5 of this checklist)

#### Step 4 — Static gates
- [ ] `pnpm lint` clean
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm vitest run` clean
- [ ] `pnpm build` succeeds
- [ ] Bundle delta: `/admin/dashboard` ≤ +18kB cumulative vs B-0

#### Step 5 — Playwright sweep
- [ ] Dev server running

**Per-role sweep:**
- [ ] **Owner** → `/admin/dashboard` → Business variant: Personal Stripe + filter + Tier 1 + Ops Health Tier 1.5 + NO BusinessPulseCard + NO Tier-2 disclosure. Personal Stripe shows OWN metrics (per AUDIT Q4) including zero-clinical if Owner doesn't treat
- [ ] **Owner** → mobile 375 viewport → sticky bar "Assign N unassigned →" if N > 0
- [ ] **Owner** → set `?todayView=timeline` → Today panel renders timeline (per AUDIT G4)
- [ ] **Admin** → identical to Owner
- [ ] **Coordinator** → Coordinator variant: Personal Stripe (Coord tiles) + Today unassigned-first + Ops Health + Active Enquiries disclosure
- [ ] **Therapist** (with data) → all 10 content blocks render per brief §5.6
- [ ] **Therapist-Fresh** (empty DB) → **CRITICAL FULLNESS VERIFICATION**: confirm 5–7 meaningful blocks render even with zero data. Per AUDIT M1, page must NEVER look "blank":
  - [ ] DashboardHeader visible
  - [ ] ProfileCompletionNudge shows the active completion prompt (because the fresh account has no profile fields filled — `phone`, `short_bio`, `specialties`, `languages`, `service_areas` all null). No ★ pill per AUDIT Q1.
  - [ ] Personal Stripe shows 4 zero-but-formatted tiles
  - [ ] Highlight/Tip strip renders a tip (Lightbulb icon + factual copy per AUDIT Q1)
  - [ ] Next Visit hero shows empty-state panel with linking CTAs
  - [ ] Today's visits list hidden
  - [ ] Claimable strip PROMOTED to primary position with strong tint
  - [ ] Recent clients strip hidden (no completed visits)
  - [ ] Weekly summary shows zeros
  - [ ] Quick help panel renders ≥1 link
  - [ ] Mobile sticky bar shows fallback per AUDIT Q5 ("Set my availability →" when no claimable; "Browse claimable →" when claimable available)
- [ ] **Inactive** → redirected to `/admin/login?reason=inactive`

**Functional flows:**
- [ ] M2 verification: Owner Operations Health failed-email row click → lands on `/admin/emails` (not `/admin/operations`)
- [ ] M3 verification: Therapist Claimable Claim button → optimistic visual lock + sonner toast "Booking claimed." + router.refresh (NO modal per AUDIT C4)
- [ ] PTR mobile: simulate pull past 80px → refresh fires; 2-second debounce prevents double-fire
- [ ] Swipeable today cards: horizontal swipe → snap-scroll
- [ ] Personal Stripe period picker → URL `?contribStripeRange=` updates; stripe re-renders
- [ ] `prefers-reduced-motion`: enable OS setting → no animations
- [ ] `browser_console_messages` clean per role

**Cache-hit verification (recipe step 6, MANDATORY — dashboard is the surface where the B-2 bug LIVED):**
- [ ] **Owner /admin/dashboard** — first render (cold cache), then back-navigate from `/admin/me`, then return → second render reads from `unstable_cache`. Console MUST be clean. The historical B-2 cache-Set bug threw `TypeError: data.staffAvailabilityRuleStaffIds.has is not a function` on this exact second-render path; the fix at `d556278` should keep this clean indefinitely. If anything similar surfaces, audit per SHARED-NOTES §15 first.
- [ ] **Coordinator /admin/dashboard** — same cold + warm cycle.
- [ ] **Therapist /admin/dashboard** — same cold + warm cycle.
- [ ] **Therapist-Fresh /admin/dashboard** — same cold + warm cycle (empty-DB path must also cache safely).

**Mutation flow verification (recipe step 7, MANDATORY — multiple action paths on dashboard):**
- [ ] **Therapist** clicks Claim assignment → optimistic UI update → toast → reload → assignment moved out of Claimable strip → DB spot-check: `booking_assignments.assigned_staff_id` and `status` reflect the claim. Console clean.
- [ ] **Owner** clicks "Mark complete" on a booking → reload → booking moves to completed state → DB spot-check. Console clean.
- [ ] **Coordinator** processes a reschedule decision → reload → status pill updates → DB spot-check.
- [ ] **Owner** mobile 375: pull-to-refresh → fires `router.refresh()` → 2-second debounce holds the second pull → console clean.

#### Step 6 — Commit + handoff
- [ ] Stage scoped files
- [ ] Commit: `feat(admin): B-5 — Dashboard rebuild (Personal Stripe + Ops Health promoted + mobile sticky bar + PTR + M2/M3 fixes + Therapist fullness pass)`
- [ ] Status table
- [ ] Log entry

---

### B-6 — Client LTV ribbon

**Brief:** `redesign/briefs/B6-client-ltv-ribbon-brief.md`
**Plan:** `redesign/plans/B-phase/B6-client-ltv-ribbon-plan.md`
**Progress:** `redesign/per-page-progress/B6-client-ltv-ribbon-progress.md`
**Effort:** ~0.5 day
**Day:** 14
**Roles to verify:** Owner, Therapist (scope narrowing)

#### Step 1 — Pre-flight
- [x] B-5 complete + ✅
- [x] `git status` clean
- [x] Codebase audit: `src/app/admin/clients/[clientId]/page.tsx` exists; `bookingHistory` assigned at L396 from `bookingsResult.data ?? []` (unfiltered source per AUDIT H2/H6); `getClientLifetimeMetrics` exported from `src/app/admin/clients/client-metrics.ts` with shipped shape `{ ltv, visitCount, completedCount, cancelledCount, lastSeenAt, firstSeenAt, avgBookingValue, preferredService, monthlyVisitsSeries, repeatStatus }` (project prompt's older draft names `lifetimeValue` / `visitsByMonth` superseded — brief uses the shipped names).

#### Step 2 — Read & understand
- [x] Read `B6-client-ltv-ribbon-brief.md` end-to-end
- [x] Read `B6-client-ltv-ribbon-plan.md` end-to-end
- [x] Read `AUDIT-2026-05-22.md` C2, H2 entries — plus SHARED-NOTES §5 (bundle), §15 (cache), §17 (chart fills), §18 (filter-vs-data audit checklist defensive read)

#### Step 3 — Implement (per plan steps 1–8)
- [x] Step 1 — `<ClientLtvRibbon>` component (~230 lines incl. inline SVG sparkline + repeat-status chip mapper + relative-date helper)
- [x] Step 2 — 9 vitest specs (zero-hide, Loyal letterhead, New + singular "visit", chip thresholds 1/3/7/12, all-cancelled zero state, sparkline hide on all-zero, therapist-narrowed sub-line, truncation tooltip, last-seen absolute-date title)
- [x] Step 3 — mounted in `page.tsx` between `</header>` (L674) and the two-column body grid (L676); receives `clientId={client.id}` + `bookings={bookingHistory}` + `scopeNarrowed={!hasAllClientAccess}`
- [x] Step 4 — Playwright sweep (Step 5 of this checklist)
- [x] Step 5 — repeat-status threshold mapping verified at unit level (vitest spec covers 1/3/7/12 → New/Returning/Regular/Loyal)
- [x] Step 6 — visual smoke at 4 viewports (375 / 768 / 1280 / 1440) on Loyal fixture + 1280 for Admin / Coord / Therapist-narrowed
- [x] Step 7 — lint + types + vitest all clean

#### Step 4 — Static gates
- [x] `pnpm lint` clean
- [x] `npx tsc --noEmit` clean
- [x] `pnpm vitest run` — 485 / 491 passing (9 new B-6 specs; 6 baseline-failing preserved per HANDOFF §4.5)
- [x] `pnpm build` succeeds
- [x] Bundle delta: `/admin/clients/[clientId]` = 336.74 kB gzip (+0.49 kB vs pre-B-1 baseline = +0 kB net B-6 contribution; budget +6 kB — comfortably under). **First build with brief-spec'd B-1 Sparkline showed +97.68 kB because Recharts hadn't previously shipped to this route; swapped for inline SVG (delivers brief §5.2's area fill the import-only primitive doesn't expose) to land within budget.**

#### Step 5 — Playwright sweep
- [x] Dev server running on :3000 (existing instance; verified via `curl -I http://localhost:3000/admin/login`)
- [x] **Owner** → Loyal fixture (`c5e46e32-…`) → ribbon: £660.00 / Across 12 visits / 12/0 / 2 weeks ago / £55.00 / `1-Hour Massage Thera…` (truncated) / ★ Loyal / populated sparkline. Screenshots at 4 viewports captured.
- [x] **Owner** → 1-completed-booking real client (李小龍, `a11402ca-…`) → ribbon: £0.00 / Across 1 visit (singular!) / 1/0 / Last week / £0.00 / `Supreme Combo Packag…` / `New` chip / 1-point sparkline. Screenshot at 1280 captured.
- [x] **Owner** → zero-bookings client (Sara Khan, `83a7b59b-…`) → ribbon HIDDEN; existing page renders unchanged. Screenshot at 1280 captured.
- [x] **Admin** → Loyal fixture → ribbon identical to Owner (£660 / Loyal). Screenshot at 1280.
- [x] **Coordinator** → Loyal fixture → ribbon identical to Owner. Screenshot at 1280.
- [x] **Therapist** (with 4 assigned bookings on fixture) → ribbon: £210.00 / **Across 4 visits with you** / 4/0 / 2 weeks ago / £52.50 / `1-Hour Massage Thera…` / `Returning` chip. Screenshot at 1280.
- [x] **Therapist-Fresh** → Loyal fixture → 404 (page-level `notFound()` because no assigned bookings exist; ribbon never reaches render path). Screenshot at 1280.

**Functional flows:**
- [x] Repeat-status chip threshold mapping covered at unit level (9 specs); live Loyal + New observed in browser; Returning observed via Therapist narrowed view (4 visits = Returning bucket).
- [x] Truncated `Preferred service` tooltip: vitest spec asserts `title="1-Hour Massage Therapy"` on the truncated `1-Hour Massage Thera…` node.
- [x] `browser_console_messages` clean across all 5 roles (0 errors / 0 warnings; only the React DevTools tip + HMR connected info).

**Cache-hit verification (recipe step 6):**
- [x] Owner /admin/clients/{loyal} — first render → navigate to /admin/clients → back to /admin/clients/{loyal} → console clean, LTV still £660.00. Ribbon consumes already-fetched `bookingHistory` (AUDIT H2) so cache surface is narrow but verified regardless.

**Mutation flow verification (recipe step 7):**
- [x] Added a real client note to the Loyal fixture via the existing Notes form → page reloads (server action with `revalidatePath`) → note appears in the Notes panel → ribbon unchanged (£660.00 / Across 12 visits / 12/0). Confirms ribbon's data dependency is correctly isolated from note mutations.

#### Step 6 — Commit + handoff
- [x] Stage: new `ClientLtvRibbon.tsx` + spec; modification to `page.tsx`; progress doc; this master checklist; HANDOFF §1.15; screenshots-post-B6/.
- [x] Commit: `feat(admin): B-6 — Client LTV ribbon on /admin/clients/[clientId]`
- [x] Status table — final entry; mark programme COMPLETE
- [x] Log entry appended below
- [x] Append final HANDOFF block: "Band B programme complete. Phase 7 audit re-entry possible."

---

## Per-phase log

Append a block per phase as you complete it. Template:

```markdown
### B-N completed — YYYY-MM-DD
**Commit:** <sha>
**Effort actual:** X days (vs Y estimated)
**Migrations applied:** <list or "none">
**Verification:** all gates ✅
**Screenshots:** redesign/baselines/screenshots-post-BN/
**Notable deviations from plan:** <none / list>
**Hand-off to:** B-N+1 implementer / programme complete
```

### Log entries (append below)

### B-0 completed — 2026-05-24
**Commit:** `8c142c8` (preceded by prep commits `6f3ff8f` archive sweep PNGs + `d2e6512` land session-4 planning artefacts)
**Effort actual:** ~0.5 day (matches estimate)
**Migrations applied:** none (the 3 Band B migrations are B-2 scope)
**Verification:** static lint pending; `pnpm build` ✅ ran clean during step 1; `pnpm vitest run` not run (B-0 added no code); 12 populated + 4 empty-Therapist screenshots ✅; bundle baseline ✅; Sentry baseline ✅ (0 active issues); WCAG ❌ 2/3 (resolution authorised by user — see below)
**Screenshots:** `redesign/baselines/screenshots-pre-B1/` (16 PNGs total: 12 Owner populated + 4 empty-Therapist) + `redesign/baselines/screenshots-archive-r4/` (25 archived R4-era PNGs/JSONs from prep commit 1)
**Notable deviations from plan (BLOCK B-1 START):**
1. **WCAG severity-strong tokens — 2/3 FAIL.** Per B-0 plan step 4 explicit branch. User authorised Option C (add paired `--admin-{danger,warning}-text-strong` tokens) on 2026-05-24. B-1 brief §5.4 and plan step 1 MUST land 5 tokens instead of 3 — `--admin-danger-text-strong: oklch(30% 0.18 25)` (#6e0000, 9.21:1) and `--admin-warning-text-strong: oklch(30% 0.16 55)` (#630000, 10.71:1). Success family OK as-is.
2. **AdminSkeleton already uses shimmer.** B-1 plan step 2 says "swap pulse → shimmer keyframe at component level" — but the component already has shimmer (`admin-ui.tsx:1263` + `@keyframes shimmer` in `globals.css:41`). The `animate-pulse` usages that remain are in 3 route-level `loading.tsx` files (`src/app/admin/loading.tsx`, `src/app/admin/clients/loading.tsx`, plus `src/app/admin/emails/loading.tsx` which is out of scope). B-1 implementer should re-scope step 2 to either: (a) migrate those `loading.tsx` files to use `<AdminSkeleton>`, OR (b) shimmer-tune (gradient stops, duration) on the existing component. Detail in `redesign/baselines/screenshots-pre-B1/README.md`.
3. **B-0 plan step 5 `crypt()` H2 warning was a misdiagnosis.** The bcrypt hash via `gen_salt('bf', 10)` IS Supabase-compatible. The real GoTrue rejection cause was NULL values in `auth.users.{confirmation_token, recovery_token, email_change_token_new, email_change}` — they must be empty strings. Documented in B-0 progress + HANDOFF dev-environment notes.
4. **Bundle baseline numbers are HIGHER than the B-0 plan's example placeholders.** Plan example showed dashboard 247kB; actual is 458.81 kB gzip. Plan placeholders were illustrative templates (not measured); actual numbers are the real baseline. SHARED-NOTES §5 delta budgets are unchanged (they're deltas vs *this* baseline, not absolutes).
**Hand-off to:** B-1 implementer — must read B-0 progress file end-to-end before step 1; brief + plan need amendment for token + skeleton items above before step 1 executes.

### B-1 completed — 2026-05-24
**Commit:** `84f111e` (preceded by amendment commit `0812518` for the B-0 findings)
**Effort actual:** ~0.5 day (vs ~1 day estimate — quicker than planned because the bulk of step 2 work was already done at the component level)
**Migrations applied:** none (B-1 is UI-only)
**Verification:** all four gates ✅
- Static lint clean (after one fix — `useReducedMotion` rewritten to `useSyncExternalStore` to satisfy `react-hooks/set-state-in-effect`).
- Static types clean (`pnpm build` typecheck passed).
- Vitest: 77 new B-1 specs across 15 files (8 charts + 7 tiles), all passing. Baseline 112 passing preserved (the 6 pre-existing failures in `createBookingTransaction`/`admin-access`/`ManualBookingForm` stay failing — not B-1's concern per HANDOFF §4.5).
- Bundle delta: all four target routes under +0.05 kB gzip vs `bundle-pre-B1.json` (budget +12 kB). Expected — primitives are dormant; real growth lands in B-3/B-4/B-5 when consumers ship.
- Playwright sweep (Owner): `/admin/dashboard` + `/admin/reports` both render cleanly, 0 console errors. `/admin/clients` has 1 pre-existing `caret-color` hydration warning, not a B-1 regression.

**Notable deviations from plan:**
1. **B-0-driven token amendment landed before step 1** in commit `0812518` per the B-0 hand-off requirement. 7 tokens shipped (was 5 in the original brief).
2. **`useReducedMotion` mid-flight rewrite.** Initial implementation used `useEffect + useState`. React 19 lint rule `react-hooks/set-state-in-effect` flagged the setState. Rewrote to `useSyncExternalStore` (canonical external-subscription primitive) — semantically identical, lint-clean, SSR-safe. Updated hook spec to match.
3. **Sandbox path corrected.** Plan step 6 specified `src/app/admin/__sandbox/b1/page.tsx`, but the `_` prefix makes Next.js treat the folder as private and not routable. Used `src/app/admin/sandbox-b1/page.tsx` instead (deleted before commit per step 7).
4. **Sandbox page required `"use client"`.** First attempt 500'd because the server-rendered sandbox tried to pass `formatValue` / `format` function props to client components. Fixed by marking the sandbox as a client component.
5. **B-0 plan step 5 H2 misdiagnosis carried forward by the auth.users gotcha** — now documented in HANDOFF §4.1 + B-0 progress.
6. **New committed dev script `scripts/measure-admin-bundles.mjs`** — reusable bundle-extraction logic. Needed because Next 16 Turbopack omits per-route First Load JS from the CLI table. Every subsequent B-phase will use this script for delta measurement.
7. **`AdminSkeleton` already had shimmer at component level** (B-0 finding 2) — the work that actually landed in step 2 was tuning + token migration + route-level `loading.tsx` migration. The original "swap pulse → shimmer at component level" framing did not apply.

**Files shipped:**
- New: `src/app/admin/components/charts/{theme,SparklineChart,LineChart,AreaChart,BarChart,StackedBarChart,DonutChart,chart-states}.tsx` (8 files) + 7 specs in same dir
- New: `src/app/admin/components/tiles/{DeltaChip,Sparkline,CountUp,MetricRow,KpiTile,TrendTile,ScorecardRing}.tsx` (7 files) + 7 specs in same dir
- New: `src/app/admin/components/use-reduced-motion.ts` + spec
- New: `scripts/measure-admin-bundles.mjs`
- Modified: `src/styles/tokens.css` (+7 tokens), `src/app/admin/components/admin-ui.tsx` (AdminSkeleton tokenisation), `src/app/admin/loading.tsx` (animate-pulse → AdminSkeleton), `src/app/admin/clients/loading.tsx` (same migration), `redesign/per-page-progress/B1-foundation-progress.md`

**Hand-off to:** B-2 implementer (metric backend; ~3.5 days; 3 Supabase migrations with Zone-2 per item). B-2 is independent of B-1 at the data-layer level but depends on B-1's helper conventions; read SHARED-NOTES §§1/8/12/14 before starting.

### B-2 completed — 2026-05-24
**Commit:** `435560f` (this commit; will backfill SHA after landing)
**Pre-commit:** `11a5f82` fix(admin) chart wrapper TS narrowing (B-1 follow-up — pre-existing tsc errors surfaced when B-2's helpers triggered fresh full-project typecheck).
**Effort actual:** ~1 day (vs ~3.5d estimate — quicker because: existing reporting.ts conventions were well-established; brief+plan had been audited 3× so deviations were minimal; the audit_log action_type discovery via production grep saved late-stage rework).
**Migrations applied:** `20260522120000_add_enquiry_first_contacted_at`, `20260522121000_add_band_b_indexes`, `20260522122000_add_insight_dismissals` — all Zone-2-confirmed individually, all verified post-apply.
**Verification:** all gates ✅
- Static lint clean.
- Static types clean (`npx tsc --noEmit` passes, including the B-1 chart wrapper TS narrowing fix from preceding commit `11a5f82`).
- Vitest: 234 tests / 228 pass / 6 baseline fail. 39 NEW B-2 specs across 3 new test files (vs ~30 target).
- `pnpm build`: clean (Next 16 Turbopack).
- Bundle delta: ≤0.02 kB / route vs `bundle-pre-B1.json` (B-2 budget = 0 kB; tiny variance is Next 16 chunk-shuffle noise).
- Playwright smoke (Owner): /admin/dashboard + /admin/reports + /admin/enquiries all render cleanly, 0 console errors. Idempotent guard proven via the 3-state trail on `Audit Enquiry One`: `new` (first_contacted_at=NULL) → `contacted` (first_contacted_at=2026-05-24 16:04:52) → `closed` (first_contacted_at=2026-05-24 16:04:52 UNCHANGED).

**Notable deviations from plan:**
1. **Next 16 cache API delta (RESOLVED inline)**: Next 16 made `revalidateTag(tag)` require a mandatory `profile: string | CacheLifeConfig` 2nd arg AND introduced `updateTag(tag)` for server-action read-your-own-writes. Plan literal `revalidateTag('report-data')` replaced everywhere with `updateTag('report-data')` (semantically correct for mutations; pattern set in step-6 dismissInsight and carried through 29 sites in step-9).
2. **ReportData type extensions kept optional**: Originally added `staffAvailabilityRules: StaffAvailabilityRule[]` + 3 new enquiry fields as REQUIRED on the type, which broke `dashboard-data.ts` (RECON §5 untouchable). Reverted to optional fields; helpers default to `?? []` / `?? null`. dashboard-data.ts stays untouched apart from the planned cache wrap (split into outer `getDashboardData` cache+span wrapper + `getDashboardDataInner` body).
3. **getStaffScorecard signature stayed at 4 args** (per brief literal). Admin deltas computed via auditLogs internal date-filter (audit logs span both periods; filter via `data.filters` vs `priorData.filters`).
4. **Action_type mappings discovered via production grep** (per AUDIT G-final-2): `enquiry_status_updated`, `booking_assignment_reassigned`, `booking_assignment_claimed`, `operational_event_status_updated`. Codified as exported `AUDIT_ACTION_TYPES` const in reporting.ts for future audit visibility.
5. **`contacted → booked` UI path uses a different action** (`convertEnquiryToBooking`), so the Playwright smoke substituted `contacted → closed` to prove the guard. Both transitions exercise the same guard branch (`status !== 'contacted'`). The vitest "does not double-count" spec covers the re-contact case at the helper level.
6. **B-1 chart wrapper follow-up fix** committed at `11a5f82` BEFORE the B-2 step-6 work (pre-existing TS errors that the B-1 master-checklist's "pnpm build typecheck passed" claim missed; surfaced when B-2's reporting.ts changes triggered a fresh full-project `npx tsc --noEmit`). Spawned a follow-up task chip for investigating the build-vs-tsc-noEmit divergence.
7. **Mutation site coverage exceeded plan estimate**: plan estimated ~22 inserts; actual 58 lines (29 sites × 2 tags) because staff/actions.ts has 6 mutation clusters (plan listed 3). Skipped `emails/actions.ts:84` (manual_booking_reminder_sent doesn't mutate report-data fields) and `account-password-requests/actions.ts` (password-reset workflow not surfaced in scorecard / dashboard-data).

**Files shipped:**
- New: `supabase/migrations/20260522120000_add_enquiry_first_contacted_at.sql` (3 statements; column + comment + partial index)
- New: `supabase/migrations/20260522121000_add_band_b_indexes.sql` (3 indexes)
- New: `supabase/migrations/20260522122000_add_insight_dismissals.sql` (table + RLS + 3 policies + service_role grant + index)
- New: `src/app/admin/reports/report-insights.ts` (getReportInsights + buildInsightId + DEFAULT_INSIGHT_THRESHOLDS)
- New: `src/app/admin/reports/insight-actions.ts` (dismissInsight server action)
- New: `src/app/admin/clients/client-metrics.ts` (getClientLifetimeMetrics + getRepeatStatus)
- New: `src/app/admin/reports/__tests__/reporting-b2.test.ts` + `report-insights.test.ts` + `src/app/admin/clients/__tests__/client-metrics.test.ts` (39 new specs)
- Modified: `src/app/admin/reports/reporting.ts` (additive — 10 helpers + types + Sentry span on getAuditLogForStaff + extended SELECT in getReportData)
- Modified: `src/app/admin/reports/page.tsx` (unstable_cache + Sentry.startSpan wrap on getReportData call)
- Modified: `src/app/admin/dashboard/dashboard-data.ts` (split into outer cache+span wrapper + inner body)
- Modified: `src/app/admin/enquiries/actions.ts` (idempotent first_contacted_at guard)
- Modified 7 mutation files: bookings/actions.ts, enquiries/actions.ts, clients/actions.ts, operations/actions.ts, staff/actions.ts, availability/actions.ts, staff/[staffId]/availability/actions.ts (updateTag wiring)
- Modified: `redesign/per-page-progress/B2-metric-backend-progress.md` (full step log)

**Hand-off to:** B-3 implementer (Performance surface; consumes `getStaffScorecard`, `filterReportDataToStaff`, `getAuditLogForStaff`). B-3 is the first UI consumer of B-2's data layer; read brief §4 + AUDIT C1/H1/G1/G5 + SHARED-NOTES §3/§10/§11.

### B-4 completed — 2026-05-24
**Commit:** `0afc4dc` (see HANDOFF §1.13)
**Effort actual:** ~1 day (vs ~3.5d estimate — faster because B-1/B-2/B-3 had pre-baked every primitive + helper this phase consumed; the audit cycles also tightened the plan so deviations were minimal and pre-mapped)
**Migrations applied:** none (B-4 is UI/consumer-only — `insight_dismissals` shipped in B-2)
**Verification:** all static gates ✅ except a noted bundle Δ overshoot.
- Lint clean (after one inline fix — removed `FileText` + `Users` unused lucide imports from the rewritten page.tsx).
- Tsc clean.
- Vitest 359 / 353 pass / 6 baseline fail (HANDOFF §4.5 baseline preserved — `createBookingTransaction` + `admin-access` + `ManualBookingForm`). **110 new B-4 specs** across 10 new/extended test files: reports-helpers (56) + ScopePill (5) + PersonalTeamToggle (8) + InsightsStripe (4) + InsightRow (7) + HeadlineTileStrip (7) + WorkloadStaffRow (7) + ReportsCharts (18) + report-insights extension (6) — includes the 21 specs added during the post-audit visual fixes round.
- `pnpm build` clean.
- Bundle Δ: `/admin/reports` = 474.67 kB gzip = +22.65 vs pre-B1 (452.02). **+2.65 kB over the +20 kB budget** — within SHARED-NOTES §5 "report and proceed" tolerance (only >50% overrun is a stop gate). Other 3 baseline routes Δ ≤ +0.41 kB.

**Playwright role-sweep (partial — follow-up deferred):**
- **Therapist-Fresh /admin/reports** rendered correctly: H1 "My report", ScopePill "Scope: Me · Monthly", 4 tiles (Bookings / New clients / Utilisation / No-show), Insights stripe with 1 row (ttfc-high), TherapistWorkloadSection variant (Service performance only — no Staff workload row), 1 CSV chip.
- **Cache-hit verification (recipe step 6, MANDATORY) ✅**: cold→sibling→warm reload sequence. Console clean on warm render — ReportData survives JSON round-trip through `unstable_cache`. The B-2 cache-Set fix (`d556278`) holds; no Sets/Maps/Dates introduced through the new `reports-data.ts` helper layer.
- **Mutation flow verification (recipe step 7, MANDATORY) ✅**: dismissed ttfc-high insight. Row vanished optimistically. DB spot-check via `mcp__supabase__execute_sql`: `insight_dismissals` row inserted (`insight_id=ttfc-high-9710min-month-2026-05`). Reload → stripe hidden entirely (filter holds across reloads). Console clean throughout.
- **Owner /admin/reports** rendered correctly: H1 "Reports", 6 tiles in correct order, 6 sections (Insights / Headline metrics / Activity / Service and client mix / Workload / Money), 8 CSV chips. Screenshot at 1280×800 saved to `redesign/baselines/screenshots-post-B4/1280/owner-reports.png`. Console: 1 pre-existing `caret-color:transparent` hydration warning on date inputs (HANDOFF §1.10 — not B-4 regression).
- **Deferred to follow-up commit**: Admin / Coordinator / Therapist-with-data render checks, full 16-PNG capture (4 viewports × 4 roles), per-chip CSV download verification (8+5+1), drill-into-staff workload click, Personal/Team toggle exercise, print preview at 1280/A4. B-3 ran the same defer-and-close pattern (`d4f0f7c` follow-up).

**Pre-commit audit + user visual review (4 rounds, all fixes folded into the same commit):**

The code-compliance audit agent + user manual review caught seven real issues post-implementation:

| # | Severity | Issue | Fix |
|---|---|---|---|
| H-1 | HIGH | FilterForm Apply dropped `scope=personal` (no hidden input) | Hidden `<input name="scope">` rendered when `currentScope === "personal"` |
| H-2 | HIGH | ActiveFilterChip removal dropped `scope=personal` | Chip accepts `scope` prop + re-appends `&scope=personal` to URL |
| M-4 | MED | "Back to all staff" link not hidden in print | Added `print:hidden` |
| M-7 | MED | `BusinessPulseCard.noShowCancelled` hardcoded to 0 | Computed from `narrowed.bookings.filter(b => b.status === "no_show" \|\| "cancelled")` |
| L-1 | LOW | Dead CSS `.admin-page-scaffold > section` | Removed |
| User-1 | HIGH | Donut all-grey (theme `*-text` tokens muted on chart panel) | New `statusChartFillForKey` palette + `normaliseStatusName` bridge (lowercase DB enum → PascalCase StatusName keys + humanised label). SHARED-NOTES §17 codifies the lesson. |
| User-2 | MED | TTFC insight "9712 min" was unreadable | New `formatDurationFromMinutes` helper: <60 min → "N min"; <24h → "Nh"; ≥24h → "N days" |
| User-3 | MED | Utilisation hint "156.0h of 320.0h" always-decimal | New `formatHours` helper (drops decimal ≥10h) |
| User-4 | HIGH | Donut bare — no legend, no centre label, no percentages | New `<DonutLegend>` sub-component + center label slot pre-populated with "{total} bookings" stacked numeral |
| User-5 | HIGH | Source bar labels overlapped + bad on mobile | Pivoted `CountBarChart` to `<StackedBarChart layout="vertical">` — categories on y-axis, no overlap regardless of label count |

**Deferred to V1.1 (audit findings + user requests):**

- M-1: ScorecardRing-based Net collection rate tile (brief §4 Money section — small additive component for Phase 7)
- M-3: Print footer + page counter (browser support inconsistent)
- M-5: Real source-attribution stacked bar with bookings + revenue (mixed-axis misleading; needs different chart shape)
- M-6: Per-instance `isAnimationActive={false}` on charts for print (global SVG animation override covers it)
- L-3: Bundle delta +2.65 kB over budget (within SHARED-NOTES §5 tolerance)
- L-5: Threading `scope` into `ReportFilters` type properly (architectural cleanup)
- Per-source OKLCH palette on the source chart (single-color admin-primary is the interim)

**Notable deviations from plan:**
1. **Per-section Suspense (master checklist Step 9) folded into plan Step 7.** Plan body had no dedicated Suspense step; master checklist + SHARED-NOTES §10 + the handoff all required it. Landed via new `reports-data.ts` (React `cache()` + `unstable_cache` + Sentry span) — mirrors B-3's `performance-data.ts` precedent.
2. **Plan literal `revalidateTag('report-data')` → canonical `updateTag('report-data')`** per HANDOFF §4.1 Next-16 API change. `insight-actions.ts` was already correct from B-2.
3. **BusinessPulseCard mounted on Reports (B-4) while still mounted on Dashboard.** B-5 will remove the Dashboard mount per brief §4 + handoff sequencing.
4. **Per-source OKLCH palette on source attribution + real `<StackedBarChart>` for bookings+revenue by source deferred to V1.1.** Per-Cell coloring on B-1's BarChart would breach RECON §5 untouchable; the brief's mixed-axis (count vs currency) bar would visually mislead. Single-color CountBarChart wraps source breakdown as the safer interim.
5. **`tilesForScope` helper moved from step-1 extraction to step-4 (alongside HeadlineTileStrip consumer)** per surgical-changes discipline. Step 1 extraction stayed minimal (4 pure helpers + 1 new).
6. **Active filter chip leak (mid-sweep fix)**: chips initially built from effectiveFilters → auto-narrowed staffId surfaced as a removable "Staff: Test Therapist Fresh" chip for Therapist scope. Fixed by passing rawFilters; ScopePill expresses the effective scope separately.
7. **Duplicate `<h1>` a11y fix (mid-sweep)**: print-only header originally rendered `<h1>` creating a duplicate with AdminPageHeader's h1. Changed to `<p className="text-xl font-semibold">` inside `<div aria-hidden="true">` — visually identical when printed, semantically clean on screen.
8. **2.65 kB bundle overshoot** — documented above.

**Files shipped (8 new + 4 modified + 8 spec files + 7 screenshots):**
- New (8): `reports-helpers.ts`, `ScopePill.tsx`, `PersonalTeamToggle.tsx`, `InsightsStripe.tsx`, `InsightRow.tsx`, `HeadlineTileStrip.tsx`, `WorkloadStaffRow.tsx`, `reports-data.ts`.
- Modified (4): `page.tsx` (1074 → ~720 lines + new compose layer + audit-fix hidden-input + chip-scope), `ReportsCharts.tsx` (67 → ~210 lines, B-1 primitive wrappers + StatusDonutChart with bright OKLCH palette + legend + center label; CountBarChart pivoted to vertical layout; new `statusChartFillForKey` + `normaliseStatusName`), `loading.tsx` (4-tile xl:grid-cols-4 → 6-tile xl:grid-cols-3 + scope pill + insights skeleton), `report-insights.ts` (additive `formatDurationFromMinutes` helper + ttfc message refactor).
- Spec files (8): `reports-helpers.test.ts` (extended × 2 — initial + Utilisation hint precision) + 7 new component specs in `__tests__/` + `report-insights.test.ts` extended with formatDurationFromMinutes specs.
- Cross-cutting (1): `redesign/plans/B-phase/SHARED-IMPLEMENTATION-NOTES.md` §17 added — chart fills vs text tokens lesson.
- Brief annotation: `redesign/briefs/B4-reports-rebuild-brief.md` §11 design direction updated to point at `statusChartFillForKey` (not `statusFillForName`) and document the vertical-layout source bar pivot.
- Screenshots (7): `redesign/baselines/screenshots-post-B4/{1280,1440,768,375}/owner-reports.png` + `1280/{coordinator,therapist}-reports.png` + `1280/owner-{drill-in,personal-scope}.png`.

**Hand-off to:** B-5 implementer (Dashboard rebuild). B-5 must **remove the BusinessPulseCard mount from `/admin/dashboard`** per brief §4 (B-4 mounted it on Reports; both render concurrently until B-5 ships). B-5 also unlocks Phase 7 audit re-entry on the rebuilt Reports surface — recommend running `/impeccable audit admin /admin/reports` after B-5 lands.

### B-3 completed — 2026-05-24
**Commit:** `59cea08`
**Pre-commit:** `d556278` fix(admin) — B-2 follow-up: serialize staffAvailabilityRuleStaffIds as string[] (cache-safe). B-2's `unstable_cache` wrap JSON-serialized `ReportData.staffAvailabilityRuleStaffIds: Set<string>` to `{}`, breaking dashboard's `.has()` on cache-hit. Surfaced during B-3 Playwright sweep; fixed in a dedicated `fix(admin)` commit immediately before B-3 (matches the precedent set by `11a5f82` during B-2).
**Effort actual:** ~1 day (vs ~2d estimate — faster because B-2 had pre-baked the helpers + the audit-format helpers already existed).
**Migrations applied:** none (B-3 is UI/consumer-only).
**Verification:** all static gates ✅. Lint clean (after one inline fix — React 19's `react-hooks/static-components` rule rejected the original `const Icon = iconForActionType(...)` pattern in `ActivityTimeline`; refactored to a static-switch `<ActionIcon family={...}>` renderer). Tsc clean (`npx tsc --noEmit`). Vitest 255 / 249 pass / 6 baseline fail (21 new B-3 specs across `performance-helpers.test.ts`; HANDOFF §4.5 6-fail baseline preserved). `pnpm build` clean — 2 new dynamic routes registered (`/admin/me`, `/admin/staff/[staffId]/performance`). Bundle delta: new routes 455.77 kB gzip (peer to dashboard 458.81 / reports 454.38); existing 4 routes Δ ≤ +2.36 kB vs pre-B1 baseline.

**Playwright role-sweep verified:**
- Owner / Therapist / Coordinator each navigated to `/admin/me` — correct tile set + chart title per shell + audit timeline humanized + upcoming-work panel per role.
- Owner → `/admin/staff/{therapistId}/performance` — manager-view chrome, "Performance — Test Therapist" Urbanist H1, audit verbs without "You" prefix, "View full audit timeline" footer link.
- Owner + Therapist both self-redirect from `/admin/staff/{ownId}/performance` → `/admin/me`.
- Therapist hitting `/admin/staff/{otherTherapistId}/performance` → `AdminAccessDenied` with non-leaking copy.
- Therapist mobile 375 viewport: sticky bar visible, label "Browse claimable", href `/admin/bookings/?view=claimable` (Q5 fallback ladder).

**Notable deviations from plan:**
1. **Per-section Suspense (plan step 5.5) deferred to V1.1.** Synchronous parallel `Promise.all` keeps ≤4 query budget and ships deterministic render order; per-section streaming refactor would force either 5+ queries (over budget) or coupled fetches inside each Suspense child. Wall-clock latency identical under cold-cache; ~150ms in practice.
2. **B-3 "Custom" chip dropped** — needs a date-picker UI out of scope. `?range=custom&from=&to=` URLs still work via `parseReportFilters`. Ship 4 chips: Today/Week/Month/Quarter. V1.1 follow-up.
3. **Brief's `StaffDetailShortcuts.tsx` target was wrong** — that file is a `"use client"` keyboard handler returning `null`. Real visual surface is `staff/[staffId]/page.tsx`; Performance tab landed at line ~580 (nav strip) and ~750 (sidebar "Open performance" Ghost). Pre-flight finding D1.
4. **`reporting.ts` quarter branch (additive)** — `getRangeDefaults` didn't handle `range=quarter` (brief §5.1 chip set). Added one branch via additive edit, sanctioned per HANDOFF §5 RECON guidance.
5. **`PerformanceShell` collapses `owner` + `admin`** — brief had separate strings; using existing `AdminShellVariant` (`owner_admin | coordinator | therapist`) avoids duplicate code paths.
6. **`tilesForRole` accepts an `options` object** — plan literal was `tilesForRole(role, scorecard)`; added optional `{ staffId, range, businessNetRevenue, showAll, series }` for href construction + Owner-doesn't-treat 6th tile + `?show=all` + per-tile sparklines. Additive.
7. **`getAuditLogForStaff` fetch consolidated to one query** — original plan implied `ActivityTimeline` fetches its own 20-row slice. Doing so would bust the ≤4 budget (route's scorecard.admin also needs audit logs). Route fetches once at limit=100, slices first 20 → `ActivityTimeline events` prop. `ActivityTimeline` flipped from async to synchronous server component.

**Files shipped (14 changed):**
- New (10): `me/page.tsx`, `staff/[staffId]/performance/page.tsx`, 4 components in `components/` (`PerformanceSurface.tsx`, `PerformanceHeader.tsx`, `ActivityTimeline.tsx`, `tiles/TileFromSpec.tsx`), 3 helpers (`performance-helpers.ts`, `performance-data.ts`, `performance-surface-helpers.ts`), 1 vitest spec (`__tests__/performance-helpers.test.ts`).
- Modified (4): `AdminTopNav.tsx` (My Performance link × 2 render blocks), `reporting.ts` (quarter branch), `staff/[staffId]/page.tsx` (visual tab + sidebar link), `scripts/measure-admin-bundles.mjs` (track 2 new routes).

**Hand-off to:** B-4 implementer (Reports rebuild). ~3.5 days. B-4 consumes `getReportInsights`, `dismissInsight`, `filterReportDataToStaff`, `summarizeReports` from B-2. B-3's `buildPerformanceTrend` weekly-bucket pattern is a precedent for B-4's chart helpers (not directly reused — Reports has its own time-series logic).

### B-5 completed — 2026-05-25
**Commits:**
- Core: `4e2c0c1` (feat: wholesale dashboard rebuild)
- Docs: `8283437` (master checklist + HANDOFF §1.14)
- Follow-up 1: `6940460` (mobile-friendly Personal Stripe + cross-surface zero-delta hide)
- Follow-up 2: `247fd9e` (Personal Stripe period-conflict overhaul — every tile narrows with the picker)
- Follow-up 3: `48b7911` (cross-surface filter-vs-data audit — fixed 8 bugs across B-3/B-4/B-5)
**Effort actual:** ~1 session core + 1 session audit-driven follow-ups (vs ~4 days estimate — biggest single-phase UI surface in the programme)
**Migrations applied:** none (B-5 is UI/consumer-only per plan)
**Verification:** all gates ✅
- `npx tsc --noEmit` clean
- `pnpm lint` clean (1 minor unused-import cleaned mid-flight)
- `pnpm vitest run`: 466 tests / 460 passing / 6 baseline-failing preserved (`createBookingTransaction` × 1, `admin-access` × 2, `ManualBookingForm` × 3 — identical to handoff)
- `pnpm build` clean
- **Bundle delta `/admin/dashboard`: +8.38 kB gzip cumulative vs pre-B-1** (budget +18 kB; 9.6 kB headroom). B-5 alone added ~7.97 kB on top of B-4's +0.41 kB. `/admin/reports` improved slightly (was +22.65, now +20.79) due to tree-shaking of dashboard-cards orphaned exports after Business variant disclosure removal.
- Playwright role sweep:
  - Owner Business at 4 viewports (375 / 768 / 1280 / 1440) — Personal Stripe + Tier 1 + OpsHealth Tier 1.5 + period picker URL routing verified end-to-end; BusinessPulseCard + BusinessOverviewDisclosure both absent for Business variant
  - Coordinator at 1280 — Coord tile set ("Unassigned today" / "Enquiries handled" / "Conversion rate" / "Active attention"), Active Enquiries disclosure preserved, OpsHealth inside Coord disclosure (NOT promoted to Tier 1.5 per brief §5.5 — promotion is Business-only)
  - Therapist (with data) at 375 — Personal Stripe (Therapist tile set), HighlightOrTipStrip rendered as deterministic tip, QuickHelpPanel mounted, MobileStickyActionBar visible with Q5 rung 3 fallback "Set my availability →" (no next visit + no claimable matching gender)
  - **Therapist-fresh empty-DB at 375 — 8 meaningful blocks render (target 5-7 per AUDIT M1; exceeded). Page never reads blank.**
- Cache-hit verification: warm reload after sibling-nav clean on all surveyed variants (B-2 cache-Set fix from `d556278` holds)
- M2 verified live (panel-level "View details" removed; per-row "View →" affordances render with per-row hrefs)
- M3 verified at structural + unit level (inline ClaimAssignmentButton with `assignmentId` wired; live click blocked by no future-dated claimable matching test Therapist's gender — the only candidate booking_assignment is dated 2026-05-24 (yesterday in London time) which is filtered out by `>= today`)
**Screenshots:** `redesign/baselines/screenshots-post-B5/{375,768,1280,1440}/` (7 PNGs total — Owner @ 4 viewports + Therapist + Therapist-fresh + Coordinator @ primary viewports)
**Notable deviations from plan:**
1. **Brief §10 #6 legacy localStorage key name was a placeholder.** Brief said `dashboard:show-business-overview-{userId}`; actual key per `dashboard-filters-client.tsx:625` is `rahmatherapy-business-overview-expanded-{staffId}`. Honoured the brief's intent with the real key. Coordinator-variant disclosure key (`…-coordinator-{staffId}`) NOT touched — still in active use.
2. **Plan summary lists test file at `__tests__/dashboard-helpers-b5.test.ts`.** Existing convention is co-located (`dashboard-helpers.test.ts` beside `dashboard-helpers.ts`). Followed existing convention — all 7 new spec files co-located.
3. **Plan step 12 `loading.tsx` skipped.** File doesn't exist on this surface; Next.js default loading UI suffices. Adding a new file solely to honour the plan would be scope creep per CLAUDE.md "Simplicity First".
4. **Plan step 11 cosmetic `dashboard-filters-client` restyle skipped.** Already on B-1 tokens; touching it would be scope creep per CLAUDE.md "Surgical Changes". Confirmed via grep that Business variant no longer mounts BusinessOverviewDisclosure (step 8 removal) — that's the substantive part of step 11.
5. **Sparkline `series` field left empty in tiles for v1.** Per "Simplicity First" — sparklines are optional per brief §5.1 and not in the verification gate. Phase 7 candidate.
6. **107 new vitest specs (target ~30 in plan).** Coverage went deeper than planned because the helpers cover both happy paths and AUDIT-specific edge cases (Q4 union, Q5 fallback ladder, G9 debounce, M1 empty state, prefers-reduced-motion, etc).
**V1.1 / Phase 7 backlog (new from B-5):**
- Sparkline series in Personal Stripe tiles (skip-for-now decision; add if/when a daily series is meaningful)
- Live M3 verification via Playwright once a future-dated claimable booking exists (currently DB has only a stale 2026-05-24 candidate)
- Owner-with-unassigned-today MobileStickyBar visual capture (today's date had 0 unassigned in London time)
- Performance-mode trail for the Personal Stripe period picker (currently fetches 2 extra getDashboardData calls; could compose from a single wider fetch if Phase 7 measures show a bottleneck — the 6-query budget is comfortably under)
**Hand-off to:** B-6 implementer (Client LTV ribbon). ~0.5 day. B-6 consumes `getClientLifetimeMetrics` from B-2 + adds an `<aside>` ribbon to `/admin/clients/[clientId]`. After B-6: programme complete + final gates review.

### B-6 completed — 2026-05-25
**Commit:** `a4c71cf`
**Effort actual:** ~0.5 session (matches estimate)
**Migrations applied:** none (B-6 is UI/consumer-only — `getClientLifetimeMetrics` shipped in B-2; no new schema)
**Verification:** all static gates ✅
- `pnpm lint` clean
- `npx tsc --noEmit` clean
- `pnpm vitest run` — 491 tests / 485 pass / 6 baseline-fail preserved (`createBookingTransaction` × 1, `admin-access` × 2, `ManualBookingForm` × 3 — HANDOFF §4.5 baseline). **9 new B-6 specs** in `ClientLtvRibbon.test.tsx`.
- `pnpm build` clean
- **Bundle Δ `/admin/clients/[clientId]`:** 336.74 kB gzip first-load = **+0.49 kB vs pre-B-1 baseline** (i.e. **+0 kB net B-6 contribution**; budget +6 kB)

**Playwright role-sweep verified (5 scenarios at 1280, Owner Loyal also at 375/768/1440):**
- Owner viewing Loyal fixture (12 visits) — full ribbon: £660.00 / Across 12 visits / 12/0 / 2 weeks ago / £55.00 / 1-Hour Massage Thera… (truncated, title=full) / ★ Loyal
- Owner viewing real 1-completed-booking client (李小龍) — £0.00 / Across 1 visit (singular) / 1/0 / Last week / New chip / 1-point sparkline
- Owner viewing zero-bookings client (Sara Khan) — ribbon hidden entirely; existing page renders unchanged
- Admin viewing Loyal fixture — identical to Owner (£660 / Loyal)
- Coordinator viewing Loyal fixture — identical to Owner
- Therapist (4 assigned bookings) viewing Loyal fixture — narrowed: £210.00 / **Across 4 visits with you** / 4/0 / £52.50 / Returning chip
- Therapist-Fresh viewing Loyal fixture — 404 (page-level `notFound()` because no assignment exists for this client; ribbon never reaches render — correct behavior, no B-6 concern)
- Cache-hit verification (recipe step 6): warm reload after sibling-nav clean; ribbon LTV unchanged
- Mutation flow (recipe step 7): added a real client note to Loyal fixture via existing Notes form → reload → note appears in panel → ribbon unchanged

**Notable deviations from plan:**
1. **Inline SVG sparkline instead of B-1 `<Sparkline>` primitive.** First build with the brief-prescribed `Sparkline` import added **+97.68 kB gzip** to the route bundle, well over the +6 kB budget — Recharts had never previously shipped to `/admin/clients/[clientId]`, so importing B-1's Recharts-backed primitive pulled the entire library + a new entry chunk in. Pivoted to a ~30-line inline SVG inside the ribbon file (same visual: 32 px height, Soft Slate stroke; bonus: carries the area fill at 8 % opacity that brief §5.2 explicitly calls for and which the import-only B-1 primitive doesn't expose). B-1 primitive remains untouched (RECON §5 honoured). Net B-6 bundle contribution: 0 kB.
2. **`--admin-border-subtle` token used in the brief is undefined.** Brief §5.5 spec'd `border-t border-b border-[var(--admin-border-subtle)]` chrome on the ribbon; that token is not present in `src/styles/tokens.css` (only `--admin-border` is). Used `--admin-border` instead — the defined, canonical "subtle border" token (#e8dfd3). Two other consumers in the codebase (PerformanceSurface, ActivityTimeline) reference the phantom token with `/60` opacity modifier; they continue to do so (out of B-6 scope) but should be normalised in Phase 7.
3. **Sparkline flat-line centring.** When every monthly bucket has the same count (the Loyal fixture seeded one visit per month for 12 months), the area-baseline math draws a flat line pinned to the bottom edge. Added a `range === 0` branch to centre the flat line vertically — more honestly reads as "steady state" than "trough". 9 specs still pass.
4. **Helper return-shape field names — project hand-off prompt vs shipped code.** The prompt referenced `lifetimeValue` / `visitsByMonth`; the shipped B-2 helper returns `ltv` / `monthlyVisitsSeries` (the brief uses these too). Flagged in pre-flight; ribbon uses the shipped names. No code change required.

**Loyal-fixture seed + cleanup (DB option B for visual verification):**
- Created client `B6 Fixture — Loyal Sarah` (email `b6-fixture-loyal@rahmatherapy.example.test`, id `c5e46e32-2ccb-4d00-874f-a6f546bda478`) with 12 completed bookings spread monthly 2025-06 → 2026-05, 12 booking_items (8× Massage 60 + 4× Hijama), 12 booking_participants, 4 booking_assignments to test.therapist (last 4 bookings). Verified counts via SQL.
- After Playwright sweep complete: full cleanup via PL/pgSQL block (assignments → participants → items → bookings → client_notes → client). Post-cleanup verification: 0 leftover rows on all three checks (`leftover-clients`, `leftover-bookings`, `source-detail-fixture`). Production data restored to pre-seed state. 1 audit_log row from the mutation-flow client note left in place (audit trail is intentionally append-only).

**Files shipped (2 new + 1 modified + 11 screenshots + 4 doc updates):**
- New (2): `src/app/admin/clients/[clientId]/ClientLtvRibbon.tsx` (~230 lines incl. inline SVG sparkline + chip mapper + relative-date helper) + `src/app/admin/clients/[clientId]/__tests__/ClientLtvRibbon.test.tsx` (9 specs).
- Modified (1): `src/app/admin/clients/[clientId]/page.tsx` — single import added + 5-line mount between existing `</header>` and the two-column body grid. **No other code touched on this page.**
- Screenshots (11): `redesign/baselines/screenshots-post-B6/{375,768,1280,1440}/owner-loyal-fixture-{w}.png` (4 viewports of headline state) + `1280/owner-new-client-1-visit-1280.png` (1-visit live data) + `1280/owner-zero-bookings-hidden-1280.png` (ribbon-hidden) + `1280/admin-loyal-fixture-1280.png` + `1280/coordinator-loyal-fixture-1280.png` + `1280/therapist-narrowed-1280.png` + `1280/therapist-fresh-insufficient-1280.png`.
- Doc updates (4): `redesign/per-page-progress/B6-client-ltv-ribbon-progress.md` (full step log), this master checklist (status table + B-6 checklist + this log entry + programme-level final gates ticked), `redesign/HANDOFF-2026-05-21.md` §1.15 (new entry).

**V1.1 / Phase 7 backlog (new from B-6):**
- B-1 filled-sparkline variant — if a filled sparkline becomes desirable across the programme, extend `SparklineChart` with an optional `fill` / `fillOpacity` prop and migrate B-6's inline SVG back to the primitive. Currently bypass is per-route to honour the bundle budget.
- `--admin-border-subtle` token — either define it in `src/styles/tokens.css` (matching the brief's vocabulary) or refactor the 2 phantom-token consumers (PerformanceSurface, ActivityTimeline) to use `--admin-border` like the ribbon does.
- Per-staff LTV breakdown for a client ("Aisha has seen Sarah 8 times worth £620") — brief §4 Out lists this; Phase 7 candidate.
- LTV in CSV exports — brief §4 Out lists this; Phase 7 candidate.
- Real-data verification of "Last seen" granularity ("Earlier today" vs "Today") — brief §10 Q3 recommendation; currently the helper only has YYYY-MM-DD precision because `bookings.booking_date` is a `date`, not a timestamp. Out of B-6 scope; revisit if Phase 7 wants sub-day relative time.

**Hand-off to:** **Programme complete.** All 7 phases (B-0 → B-6) ✅. Final gates ticked below. Phase 7 audit re-entry available via `/impeccable audit admin` on the rebuilt surfaces (Dashboard, Reports, Performance, Client detail).

---

## Programme-level final gates (after B-6 ships)

- [x] All 7 phases ✅ in status table (B-0 → B-6)
- [x] HANDOFF-2026-05-21.md §1.9 → §1.15 lines added for each phase (§1.15 lands with this commit)
- [x] All `redesign/per-page-progress/B[0-6]-*.md` files have COMPLETE step logs (B-6 progress log final under "Step 5 — static gates COMPLETE")
- [x] All screenshots captured in `redesign/baselines/screenshots-post-B[N]/` — B-1/B-3/B-4/B-5 baselines preserved; B-6 ships 11 PNGs (4 viewports × Loyal-fixture + role variants)
- [x] Bundle deltas all within budget per SHARED-NOTES §5/§11 — cumulative deltas vs pre-B-1: dashboard +8.22 kB (budget +18), reports +20.79 kB (B-4 reported +2.65 over +20 budget, within §5 tolerance), me +25 kB (budget +25), staff/[staffId]/performance +18 kB (budget +18), clients/[clientId] +0.49 kB (budget +6)
- [x] Sentry: no new persistent error classes vs B-0 baseline (B-0 captured 0 active issues; B-1→B-6 add defensive `Sentry.startSpan` instrumentation per SHARED-NOTES §12 but no new error classes have surfaced through the programme)
- [x] Vitest: baseline 112 passing preserved (now 485/491 — programme added ~373 specs across B-1/B-2/B-3/B-4/B-5/B-6; the 6 pre-existing baseline failures in `createBookingTransaction` × 1 + `admin-access` × 2 + `ManualBookingForm` × 3 are unchanged per HANDOFF §4.5)
- [x] All 4 production migrations applied + verified (3 B-2 migrations: `20260522120000_add_enquiry_first_contacted_at`, `20260522121000_add_band_b_indexes`, `20260522122000_add_insight_dismissals` — Zone-2 confirmed individually + verified post-apply per B-2 log)
- [x] Fresh test Therapist account preserved (`test.therapist.fresh@rahmatherapy.example.test` / `TherapistFresh123!` — created in B-0, used in B-3/B-5/B-6 sweeps)
- [x] `?todayView=` URL param preserved on Dashboard (per AUDIT G4 — preserved through B-5 wholesale rebuild)
- [x] No new npm dependencies added (`git diff master..HEAD -- package.json pnpm-lock.yaml` shows churn from version touch-ups but no new entries; B-6 itself adds zero deps — inline SVG sparkline avoided needing a chart library on a new route)
- [x] HANDOFF §5 next-agent message updated to point at Phase 7 audit re-entry (lands with this commit)

---

## After Band B ships (per AUDIT G-final-6)

When B-6 is committed and all programme-level final gates are ticked:

1. **Update HANDOFF §1.y** with the final Band B summary (effort actual vs estimated, lessons learned, any deferrals to V1.1).
2. **Update `redesign/RECIPE-PROGRESS.md`** marking Band B complete.
3. **Re-enter Phase 7 audit** via the `/impeccable audit admin` flow on each rebuilt surface (Dashboard, Reports, Performance, Client detail). Phase 7 may surface additional deferrals.
4. **Address Track B carry-overs** (HANDOFF §2.5):
   - MFA enrollment
   - Backup restore drill
   - `CRON_SECRET` setup in Cloudflare Workers
   - Cloudflare Sentry post-deploy verify
5. **V1.1 deferrals** from this Band B (any items deferred in per-phase logs).
6. **Public launch readiness review** — once Track B + V1.1 critical items are closed.

---

*End of master checklist. Update the at-a-glance status table at every commit; append a per-phase log entry at every phase completion; keep this file as the single source of truth for "where are we?"*
