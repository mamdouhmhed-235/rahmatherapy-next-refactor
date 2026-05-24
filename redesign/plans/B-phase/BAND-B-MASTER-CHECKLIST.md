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
| B-1 | Foundation primitives | ✅ complete | 2026-05-24 | 2026-05-24 | _pending_ | 77 new specs (charts + tiles + hook). Bundle delta < 0.05 kB / route (primitives dormant). useReducedMotion rewritten to useSyncExternalStore mid-flight after lint. Sandbox path corrected `__sandbox/` → `sandbox-b1/` (Next.js private-folder rule). |
| B-2 | Metric backend | ⏳ pending | — | — | — | — |
| B-3 | Performance surface | ⏳ pending | — | — | — | — |
| B-4 | Reports rebuild | ⏳ pending | — | — | — | — |
| B-5 | Dashboard rebuild | ⏳ pending | — | — | — | — |
| B-6 | Client LTV ribbon | ⏳ pending | — | — | — | — |

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
6. **Sign out**
   - [ ] `mcp__playwright__browser_navigate` → POST `/admin/signout` (or click sign-out menu item)
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
- [ ] B-5 complete + ✅
- [ ] `git status` clean
- [ ] Codebase audit: verify `src/app/admin/clients/[clientId]/page.tsx` exists and fetches `bookingHistory` (the data source per AUDIT H2); verify `getClientLifetimeMetrics` exported from `src/app/admin/clients/client-metrics.ts` (B-2)

#### Step 2 — Read & understand
- [ ] Read `B6-client-ltv-ribbon-brief.md` end-to-end
- [ ] Read `B6-client-ltv-ribbon-plan.md` end-to-end
- [ ] Read `AUDIT-2026-05-22.md` C2, H2 entries

#### Step 3 — Implement (per plan steps 1–8)
- [ ] Step 1 — `<ClientLtvRibbon>` component
- [ ] Step 2 — vitest spec
- [ ] Step 3 — mount in `page.tsx` immediately below client identity sub-header, above existing tabs
- [ ] Step 4 — Playwright sweep (Step 5 of this checklist)
- [ ] Step 5 — repeat-status threshold mapping verified
- [ ] Step 6 — visual smoke at 3 viewports
- [ ] Step 7 — lint + types + vitest

#### Step 4 — Static gates
- [ ] `pnpm lint` clean
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm vitest run` clean
- [ ] `pnpm build` succeeds
- [ ] Bundle delta: `/admin/clients/[clientId]` ≤ +6kB

#### Step 5 — Playwright sweep
- [ ] Dev server running
- [ ] **Owner** → navigate `/admin/clients/{loyalClientId}` → ribbon: £X / 17 visits / "★Loyal" / populated sparkline
- [ ] **Owner** → navigate `/admin/clients/{newClientId}` (1 completed booking) → ribbon: 1 visit / "New" chip / 1-point sparkline
- [ ] **Owner** → navigate `/admin/clients/{zeroBookingsClientId}` → ribbon HIDDEN; existing page renders unchanged
- [ ] **Therapist** → navigate `/admin/clients/{ownClientId}` → ribbon: scope-narrowed LTV sub-line reads "Across N visits with you"
- [ ] **Therapist** → navigate `/admin/clients/{notMyClientId}` → ribbon HIDDEN
- [ ] Screenshots at 3 viewports (375 / 768 / 1280) per client state

**Functional flows:**
- [ ] Repeat-status chip threshold: navigate to clients at 1 / 3 / 7 / 12 visits; verify mapping `New` / `Returning` / `Regular` / `Loyal`
- [ ] Hover `Preferred service` (if truncated to 20 chars) → tooltip shows full name
- [ ] `browser_console_messages` clean

#### Step 6 — Commit + handoff
- [ ] Stage: new `ClientLtvRibbon.tsx` + spec; modification to `page.tsx`
- [ ] Commit: `feat(admin): B-6 — Client LTV ribbon on /admin/clients/[clientId]`
- [ ] Status table — final entry; mark programme COMPLETE
- [ ] Log entry
- [ ] Append final HANDOFF block: "Band B programme complete. Phase 7 audit re-entry possible."

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
**Commit:** _to be filled after commit lands_ (preceded by amendment commit `0812518` for the B-0 findings)
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

---

## Programme-level final gates (after B-6 ships)

- [ ] All 7 phases ✅ in status table
- [ ] HANDOFF-2026-05-21.md §1.x lines added for each phase
- [ ] All `redesign/per-page-progress/B[0-6]-*.md` files have COMPLETE step logs
- [ ] All screenshots captured in `redesign/baselines/screenshots-post-B[N]/`
- [ ] Bundle deltas all within budget per SHARED-NOTES §5/§11
- [ ] Sentry: no new persistent error classes vs B-0 baseline
- [ ] Vitest: baseline 112 passing preserved; new specs all green
- [ ] All 4 production migrations applied + verified
- [ ] Fresh test Therapist account preserved (or documented for cleanup)
- [ ] `?todayView=` URL param preserved on Dashboard (per AUDIT G4)
- [ ] No new npm dependencies added (`git diff package.json package-lock.json` empty across the programme)
- [ ] HANDOFF §5 next-agent message updated to point at Phase 7 audit re-entry

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
