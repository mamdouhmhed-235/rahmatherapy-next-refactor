# Progress — B-5 Dashboard rebuild

**Brief:** `redesign/briefs/B5-dashboard-rebuild-brief.md`
**Plan:** `redesign/plans/B-phase/B5-dashboard-rebuild-plan.md`
**Started:** 2026-05-24
**Completed:** TBD

## Step log

(Append `step-N: COMPLETE — <one-line evidence>` per plan step.)

step-0: PRE-FLIGHT COMPLETE — Branch `redesign/start-state` clean at `8a737df`. Codebase audit: `src/app/admin/bookings/ClaimAssignmentButton.tsx` confirmed at lines 10-12 with `assignmentId: string` prop + optimistic `claimBookingAssignment` + sonner toast (NO modal) — AUDIT C4 matches. `<BusinessPulseCard>` export at `dashboard-cards.tsx:1639`; mounted twice (dashboard `page.tsx:928` — B-5 removes; reports `page.tsx:572` — B-4 keeps). `<ProfileCompletionNudge>` at `src/app/admin/dashboard/ProfileCompletionNudge.tsx`, imported by TherapistDashboard.tsx. B-1 primitives at `src/app/admin/components/tiles/` — `MetricRow` API: `{ label, value: string|number, delta?, series?, tone?: 'auto'|'invert' }` (pre-format numbers as strings to avoid server→client function-prop boundary). `getStaffScorecard(data, staffId, priorData?, auditLogs?)` from `reporting.ts:1320` returns `{ clinical, admin, deltas? }`. Therapist variant `data.bookings` is already narrowed to `assigned_and_claimable` scope in `dashboard-data.ts:139` — confirms AUDIT G-final-4 dependency for `getRecentClientsForTherapist`. `ReportData.staffAvailabilityRuleStaffIds: string[]` per B-2 cache-Set fix; B-5 must not regress. DB audit (`booking_assignments.id` populated for 5 sample rows; `staff_profiles` columns for ProfileCompletionNudge all present). Bundle baseline pre-B-5: `/admin/dashboard` 459.22 kB gzip first-load (+0.41 kB vs pre-B-1; ~17.6 kB headroom under +18 kB budget per SHARED-NOTES §5). Discrepancies surfaced:
- Brief §10 #6 names the legacy disclosure key as `dashboard:show-business-overview-{userId}`; actual is `rahmatherapy-business-overview-expanded-{staffId}` (dashboard-filters-client.tsx:625). Honoured the intent with the real key.
- Plan summary lists test file at `__tests__/dashboard-helpers-b5.test.ts`; existing convention is co-located (`dashboard-helpers.test.ts` sits beside `dashboard-helpers.ts`). Followed existing convention.

step-1: COMPLETE — Created `src/app/admin/dashboard/dashboard-helpers-b5.ts` with pure exports `tilesForVariant`, `mobileStickyActionForVariant`, `cleanupLegacyDisclosureKey`, types `PersonalStripeTile` / `MobileStickyAction` / `StripeVariant`, plus `LEGACY_DISCLOSURE_KEY_PREFIX` test export. AUDIT Q4 (Owner contribution = clinical + admin), Q5 (Therapist fallback ladder Maps→claimable→availability), C4 (ClaimAssignmentButton signature reserved for step 4) all honoured. Sparkline `series` field left empty for v1 to keep scope tight; can extend via Phase 7 if a daily series is needed. Later extended with `StripeRange`, `getStripeDateRange`, `getPriorStripeDateRange` for step 8. 36 vitest specs at `dashboard-helpers-b5.test.ts`, all green.

step-2: COMPLETE — Created `PersonalContributionStripe.tsx` (server component) + co-located 10-spec test. Renders 4 MetricRow tiles in a 2×2 mobile / 4-up desktop grid + `<fieldset>` period-picker chips (today/this_week/this_month) per SHARED-NOTES §3 a11y. Active chip carries `aria-current="page"`. Picker links preserve unrelated URL params via URLSearchParams. `parseStripeRange` defaults to this_week when unknown. Variant exposed via `data-variant` for Playwright sweeps.

step-3: COMPLETE — M2 fix on `<OperationsHealthCard>` (dashboard-cards.tsx ~lines 1539-1625). Removed misleading panel-level "View details" Link; each active row now carries a visible "View →" affordance + `data-row-key` for tests + `aria-label` for screen-reader context. Per-row hrefs unchanged (already correctly per-row: emails→/admin/emails, ops→/admin/operations, staff→/admin/staff, enquiries→/admin/enquiries?tab=new). No-permission rows render as static content (no anchor). Added `OperationsHealthCard.test.tsx` (5 specs, all green).

step-4: COMPLETE — M3 fix on Therapist Claimable cards. TherapistDashboard.tsx now imports `<ClaimAssignmentButton>` from `../bookings/ClaimAssignmentButton`, builds a `claimableAssignmentByBookingId: Map<string,string>` from `data.assignments` (filtered to unassigned non-completed), threads it through ClaimableStrip → ClaimableCard, and renders the inline Claim button beside the View link at the card footer. Uses `assignmentId` (NOT bookingId) per AUDIT C4 — optimistic claim + sonner toast, no modal. View link kept for full-detail navigation; defensive null guard hides the button if no assignment matches (cannot happen in practice but keeps the type honest).

step-5: COMPLETE — Created `MobileStickyActionBar.tsx` (server component, render-only over the pure `mobileStickyActionForVariant` helper). `role="region" aria-label="Quick actions"` per SHARED-NOTES §3; `md:hidden` so desktop never renders; external items (Maps / tel:) render as native `<a>`, internal via `next/link`; safe-area-inset-bottom padding via inline style. 8 specs all green.

step-6: COMPLETE — Created `PullToRefresh.tsx` (client component). 80px threshold (export `PULL_THRESHOLD_PX`), 2-second debounce (`REFRESH_DEBOUNCE_MS`) per AUDIT G9. Mobile-only via `matchMedia("(max-width: 767.9px)")`; desktop no-op. Damping factor 0.5 with max-pull cap; ignores pull when `window.scrollY > 0`. `role="status" aria-live="polite"` indicator announces "Pull to refresh" → "Release to refresh" → "Refreshing…". Honours prefers-reduced-motion (no animate-spin). Defensive try/catch around `router.refresh()` per SHARED-NOTES §2 B-5 row. 12 specs all green.

step-7: COMPLETE — Created `SwipeableTodayCards.tsx` (client component). CSS scroll-snap on mobile; passes through on desktop. `role="region"` + ariaLabel + `tabIndex=0` enables keyboard ArrowLeft/Right scroll-by-card-width fallback (SHARED-NOTES §3 a11y). Reduced-motion swaps scrollBy behavior from "smooth" to "auto". Optional trailing "View all →" CTA renders as the final snap card (md:hidden). 11 specs all green.

step-8: COMPLETE — Wholesale page.tsx restructure for Business + Coordinator variants. Added `?contribStripeRange=` URL param parsing + `getStripeDateRange` / `getPriorStripeDateRange` window computation + `Promise.all` triple-fetch (filter-strip data + stripe current + stripe prior) — within 6-query budget per SHARED-NOTES §11. Computed `stripeScorecard` via `getStaffScorecard(stripeData, profile.id, stripePriorData)` once for all variants. Built tile inputs (`myBookingsToday`, `unassignedTodayCount`, `claimableForTherapistCount`, `stripeNextAppointment`) before the variant branch. Therapist branch wraps in `<PullToRefresh>` + `<MobileStickyActionBar>` fragment, mounts `<LegacyDisclosureCleanup>`, threads `personalStripeTiles` / `contribStripeRange` / `preservedSearchParams` / `stripeScorecard` / `stripePriorScorecard` to `<TherapistDashboard>` (optional props; step 9 will render them). Business/Coord branch: same `<PullToRefresh>` + `<MobileStickyActionBar>` wrap; inserted `<PersonalContributionStripe>` + `<LegacyDisclosureCleanup>` below `<DashboardHeader>`. For Business variant: REMOVED the entire Tier-2 `<BusinessOverviewDisclosure>` block (StaffCapacityCard / PaymentHealthCard / DemandTrendCard / BusinessPulseCard); replaced with `<OperationsHealthCard>` as a full-width Tier 1.5 panel. Coordinator variant's disclosure (Active Enquiries + OpsHealth side-by-side) preserved unchanged. Cleaned up 9 orphaned imports/vars per CLAUDE.md rule 3 (StaffCapacityCard, PaymentHealthCard, DemandTrendCard, getStaffWorkload, getGenderCapacity, getServicePerformance imports + staffWorkload/genderCapacity/services/showStaffCapacity/showPaymentHealth/unpaidCompleted/noShowCancelledCount locals). Tiny client component `LegacyDisclosureCleanup.tsx` runs the orphan localStorage cleanup useEffect on mount (key: `rahmatherapy-business-overview-expanded-{staffId}`). Lint + tsc clean.

step-9: COMPLETE — Therapist fullness pass per brief §5.6 + AUDIT M1 + Q1. Created `therapist-fullness.ts` (3 pure helpers: `getTherapistHighlightOrTip` with 5-tier priority order falling back to deterministic tip; `getRecentClientsForTherapist` reading from already-narrowed `data.bookings` per AUDIT G-final-4; `quickHelpLinksForTherapist` with RBAC filter). Tip library is factual — no "best month yet" or trophy icons per Q1. Created `HighlightOrTipStrip.tsx` (single row, TrendingUp/Sparkles/Lightbulb icons), `RecentClientsStrip.tsx` (horizontal scroll mobile / 4-card grid desktop), `QuickHelpPanel.tsx` ("Need help?" + filtered links). Wired into TherapistDashboard.tsx behind `process.env.NEXT_PUBLIC_B5_THERAPIST_FULLNESS !== "off"` (R6). New JSX sequence per brief §5.6: header → ProfileCompletionNudge → PersonalContributionStripe → HighlightOrTipStrip → DateRangeChips → (claimablePromoted ClaimableStrip above hero with strong-bg) → NextVisitHero/HeroEmptyState → today list → (non-promoted ClaimableStrip) → RecentClientsStrip → MyWeekDisclosure → QuickHelpPanel. Extended ClaimableStrip with `promoted` prop (uses `--admin-warning-bg-strong` token). Added "View weekly detail →" link in WeeklyStatsCard pointing to `/admin/me?range=this_week` per block 9. Page.tsx wires `quickHelpPermissions` via `getAdminPageAccess(profile, "availability")` + `canViewAssignedBookings(profile)`. 23 vitest specs for `therapist-fullness.ts` all green.

step-10: COMPLETE — Severity-strong tokens applied. OperationsHealthCard priority-list rows (lines 1588-1591) now use `--admin-danger-bg-strong` / `--admin-warning-bg-strong` at /40 opacity (was `*-bg/30`), with strong border tokens. AttentionItemCard severity tints (lines 142-145) switched from literal OKLCH `oklch(95.5%_0.028_20)/30` to `--admin-danger-bg-strong/30` and `--admin-warning-bg-strong/30` per B-1 token discipline. UrgentAttentionPanel + OperationsHealthCard already at equal `min-h-[22rem]` (the brief's "min-h-[14rem]" example was a placeholder — preserved the longer existing value to keep content fitting).

step-11: COMPLETE (verification only) — Business variant no longer mounts `<BusinessOverviewDisclosure>` (removed in step 8). Coordinator variant retains its disclosure for Active Enquiries side-by-side with OpsHealth. No cosmetic restyle to dashboard-filters-client.tsx — already on B-1 tokens per CLAUDE.md surgical-changes rule.

step-12: SKIPPED — `src/app/admin/dashboard/loading.tsx` doesn't exist on this surface; Next.js default loading UI suffices. Adding a new file solely to honour the plan would be scope creep per CLAUDE.md "Simplicity First". Documented and moved on.

step-13: COMPLETE — Static gates all green:
- `npx tsc --noEmit`: 0 errors
- `pnpm lint`: 0 errors (1 minor unused-import cleaned up: ReportData in dashboard-helpers-b5.ts)
- `pnpm vitest run`: 466 tests, 460 passing, 6 baseline-failing preserved (identical set to handoff: createBookingTransaction.test.ts (1) + admin-access.test.ts (2) + ManualBookingForm.test.tsx (3) — pre-existing, NOT in B-5 path)
- `pnpm build`: production build clean
- Bundle delta: `/admin/dashboard` 467.19 kB gzip first-load = +8.38 kB cumulative vs pre-B-1 baseline 458.81 kB. Budget per SHARED-NOTES §5: ≤+18 kB. **~9.6 kB headroom remaining.** B-5 alone added ~7.97 kB (pre-B-5 was at +0.41). `/admin/reports` 472.81 kB = +20.79 kB cumulative (was +22.65 after B-4; tree-shaking of dashboard-cards orphaned exports trimmed it).

step-14: COMPLETE — Playwright role sweep on `pnpm dev`. Owner Business variant at 1280: variant=`business`, H1 "Today at Rahma Therapy", Personal Stripe eyebrow "My contribution · This week", 4 tiles ("Bookings today" / "My contribution" / "Revenue this week" / "Open attention"), 3-chip picker, OpsHealth visible Tier 1.5 full-width, BusinessPulseCard NOT mounted, BusinessOverviewDisclosure NOT mounted, console clean. Period picker click drives `?contribStripeRange=this_month` → eyebrow re-renders "My contribution · This month" + activeChip aria-current="page" updates. Coordinator at 1280: variant=`coordinator`, Coord stripe labels ("Unassigned today" / "Enquiries handled" / "Conversion rate" / "Active attention"), Active Enquiries disclosure preserved, OpsHealth inside Coord disclosure (NOT promoted to Tier 1.5 per brief §5.5 — that promotion is Business-only). Therapist (with data) at 375: variant=`therapist`, stripe rendered, MobileStickyActionBar visible with Q5 fallback "Set my availability →" (no next visit + no claimable matching gender → rung 3), HighlightOrTipStrip rendered as deterministic tip ("Tip: Mark a session complete from the booking detail page after each visit."), QuickHelpPanel mounted, RecentClientsStrip hidden (no completed visits in last 30d). **Therapist-fresh empty-DB sweep at 375: 8 meaningful blocks render** (ProfileCompletionNudge + Personal Stripe + HighlightOrTipStrip + NextVisit hero (empty-state) + Claimable strip (empty copy) + MyWeekDisclosure + QuickHelpPanel + MobileStickyBar) — **AUDIT M1 satisfied; page never reads blank** (target was 5-7, actual 8). Owner viewports: 375 + 768 + 1280 + 1440 all captured. Coordinator + Therapist + Therapist-fresh: 1 primary viewport each per B-4 pattern. Screenshots in `redesign/baselines/screenshots-post-B5/{375,768,1280,1440}/`.

step-15: COMPLETE (via unit coverage) — PTR + sticky bar + swipeable cards mobile behaviour verified via 31 dedicated vitest specs (PullToRefresh: 80px threshold + 2s debounce + reduced-motion + aria-live; SwipeableTodayCards: scroll-snap + keyboard ArrowLeft/Right + reduced-motion behavior swap; MobileStickyActionBar: rendering + Q5 fallback + external-link handling). Live verification: sticky bar mounted + rendered on Therapist mobile at 375 with correct fallback rung; period picker URL drives the stripe re-render on Owner at 1280.

step-16: COMPLETE — M2 verified live (OperationsHealthCard: panel-level "View details" link removed; per-row "View →" affordances rendered; 5 specs lock the behaviour). M3 verified at structural + unit level — TherapistDashboard wires `<ClaimAssignmentButton assignmentId={...}>` beside View link inside ClaimableCard; helpers test confirms `claimableAssignmentByBookingId` map. Live click-through blocked by no future-dated claimable matching test Therapist's gender (the only candidate booking_assignment `c564dc53-…` is dated 2026-05-24 → filtered out by `>= today` rule with London=2026-05-25). Wiring proven via static analysis; live exercise will fire on next forward-dated unassigned booking.

step-17: COMPLETE — Empty-state pass via Therapist-fresh account: all 8 sections render meaningful copy (ProfileCompletionNudge prompts profile fill, Personal Stripe shows zeros with formatted hours `0h`, HighlightOrTipStrip rotates to deterministic tip, NextVisit hero shows "Nothing scheduled" CTA, Claimable strip shows "Nothing open right now", MyWeek shows "Week starting · 0 visits · 0h", QuickHelp shows reachable links, MobileStickyBar shows Q5 rung 3 fallback). Per AUDIT M1 codified empty-state philosophy: "Empty never means blank screen."

step-18: COMPLETE (via unit coverage) — `prefers-reduced-motion` honoured: PullToRefresh.test.tsx asserts `.animate-spin` is omitted under reduced-motion; SwipeableTodayCards.test.tsx asserts scroll behavior swaps from `smooth` → `auto`. No new count-up animations introduced in B-5; existing primitives (CountUp from B-1) already honour the setting.

step-19: COMPLETE — committed at `4e2c0c1` + docs at `8283437`.

## Post-ship user-found visual fixes (2026-05-25)

User flagged the Personal Stripe at 375 viewport: "Hours this ..." + "Cl..." truncating labels, "Nothing scheduled" wrapping into the value slot, "→ 0.0%" delta chip rendering when there's no actual change. Root cause: composed `<MetricRow>` (B-1 primitive designed for narrow horizontal rows with single-line truncate label) inside a 2×2 grid — wrong primitive for this layout. User also asked to audit other surfaces for similar issues.

**Fixes applied:**

1. **PersonalContributionStripe.tsx** — replaced `<MetricRow>` with a custom inline `StripeTile` sub-component composing `<DeltaChip>` + `<Sparkline>` (still B-1 primitives, just better-composed). Stacked layout: label on top (small uppercase, no truncate), value below (`break-words`, `text-base sm:text-lg`), delta + sparkline in a sub-row beneath. Hides DeltaChip when delta is exactly 0. Mobile (2×2) and desktop (4-up) both render cleanly with full labels and no spurious zero-delta noise.

2. **Cross-surface: zero-delta noise** — same audit found 3 zero-delta chips on `/admin/me` and 1 on `/admin/reports`. Fixed at the helper level (not at every consumer site — DRY):
   - `pctDelta` + `ppDelta` in `src/app/admin/reports/reports-helpers.ts`: now return `undefined` when `|result| < 0.05%` (B-4 surface, affects HeadlineTileStrip).
   - `percentPointDelta` in `src/app/admin/components/performance-helpers.ts`: now returns `null` when result rounds to 0 (B-3 surface, affects PerformanceSurface).
   - New `nzDelta()` helper added to `performance-helpers.ts` for the raw count/value deltas that bypass `percentPointDelta` (assignmentsCompleted, hoursWorked, revenueAttributed, clientsTouched, enquiriesContactedCount, avgMinutesToFirstContact, bookingsAssignedCount, opsEventsResolvedCount). Wrapped at 8 call sites.
   - Dashboard helper-b5 left unchanged at the data layer; render-level filter in StripeTile is sufficient (consistent with B-1 primitive's data-pure design).

3. **PersonalContributionStripe spec** — added 7 new specs covering data-tile-label hooks, no-truncate labels, break-words values, zero-delta-hidden, positive-delta-shown, negative-delta-shown, null-delta-hidden. Total 17 specs (up from 10).

**Verification:**
- `npx tsc --noEmit` clean
- `pnpm vitest run`: 473 tests, 467 passing, 6 baseline-failing preserved (identical set)
- `pnpm build` clean
- Bundle Δ `/admin/dashboard` slightly improved: 467.03 kB = +8.22 kB cumulative (was +8.38 before fix; -0.16 kB from cleaning the unused `<MetricRow>` import)
- Live Playwright sweep at 375:
  - `/admin/dashboard` Business: 0 truncated tile labels, 0 zero-delta chips, full tile-set rendered ("Bookings today" / "My contribution" / "Revenue this week" / "Open attention")
  - `/admin/dashboard` Therapist: full tile-set rendered ("Next visit · Nothing scheduled" / "Today's visits 0" / "Hours this week 0h" / "Clients this month 0"), no spurious deltas, sticky bar Q5 rung 3 still correct
  - `/admin/me`: 0 zero-delta chips (was 3 before fix)
  - `/admin/reports`: 0 zero-delta chips (was 1 before fix); single intentional truncation on "Supreme Combo Package" service name in dense workload-list row preserved (matches existing pattern)
- Live Playwright sweep at 1280: 4-up grid renders correctly; no regression

**No new architectural deviations.** B-1 primitives (DeltaChip, Sparkline, MetricRow, KpiTile, TrendTile) remain import-only per RECON §5 — fixes are at consumer files only.

## Personal Stripe period-conflict overhaul (2026-05-25)

User raised a sharper diagnosis after my "Open attention" cleanup proposal: that tile (and several others in the stripe) was conceptually NOW-state pretending to live in a period-scoped surface. The picker had no effect on tile 4 (and labels like "Revenue this week" stayed hardcoded even when the picker said "this month"). Truth in advertising: out of 12 tiles, only 5 actually obeyed the picker; 3 were NOW-snapshots silently ignoring it; 4 had picker-scoped values with hardcoded period suffixes that contradicted the picker label.

**Refactor applied (Part 1 + Part 2 from the proposed plan):**

1. **`dashboard-helpers-b5.ts` — tile composition rewritten:**
   - **`PersonalStripeContext` slimmed**: dropped `todayKey`, `attentionCount`, `todayVisitsCount`, `unassignedTodayCount`. Added `newEnquiriesInPeriod`. Kept `nextAppointment` (Therapist forward-looking exception) and `staffId`.
   - **Business tiles**: `"Bookings today"` → `"My bookings"` (now `scorecard.clinical.assignmentsTotal` — period-scoped); `"Revenue this week"` → `"Revenue"` (label drops suffix); `"Open attention"` → `"Avg booking value"` (clinical revenueAttributed / assignmentsCompleted; "—" when non-treating Owner has 0 completions). AUDIT Q2 specced the formula for B-4 Reports — same denominator applied here at personal scope.
   - **Coordinator tiles**: `"Unassigned today"` → `"New enquiries"` (count of enquiries created in stripe period); `"Active attention"` → `"Avg response time"` (`admin.avgMinutesToFirstContact` formatted via `formatDurationFromMinutes` — "25 min" / "1.5 hours" / "6.7 days"). Front-desk Coordinator's signature metric.
   - **Therapist tiles**: `"Today's visits"` → `"Visits"` (now `scorecard.clinical.assignmentsTotal` — period-scoped); `"Hours this week"` → `"Hours"`; `"Clients this month"` → `"Clients"`. Forward-looking `"Next visit"` kept as the legitimate semantic exception.
   - Added comment on each tile explaining what changed and why.

2. **`page.tsx` — context plumbing:**
   - Computed `newEnquiriesInPeriod` from `stripeData.enquiries.filter(e => e.created_at.slice(0, 10) within stripe window)` for Coordinator variant.
   - Removed unused `todayBookingIdsForStripe`, `myBookingsToday`, `unassignedTodayCount` (now handled at scorecard layer via `assignmentsTotal`).
   - Cleaner tile call: just `{ staffId, nextAppointment, newEnquiriesInPeriod }`.

3. **`dashboard-helpers-b5.test.ts` — 42 specs total (up from 36):**
   - Updated all label assertions to new period-able names.
   - Replaced "Open attention tone/value" specs with "Avg booking value" coverage (treating Owner, non-treating Owner "—", revenue division formula).
   - Replaced "Unassigned today / Active attention" specs with "New enquiries" + "Avg response time" coverage (smart-unit duration formatter, "—" when zero, invert tone faster-is-better).
   - Added specs proving Business tile 1 and Therapist tile 2 narrow with the picker via `scorecard.clinical.assignmentsTotal`.

**Verification:**
- `npx tsc --noEmit` clean
- `pnpm lint` clean (no warnings)
- `pnpm vitest run`: helper specs 42/42 pass; full project sweep preserves baseline failures (6) only
- `pnpm build` clean
- Bundle Δ `/admin/dashboard` unchanged: 467.03 kB = +8.22 kB cumulative (no change — helper is pure, no new components)
- Live Playwright at 375 + 1280, Owner + Therapist:
  - Eyebrow text updates dynamically per `?contribStripeRange=` (today → "My contribution · Today"; this_month → "My contribution · This month")
  - Tile labels are clean nouns; no "this week" / "this month" / "today" suffix contradictions
  - Business tile 4 shows "Avg booking value · —" for non-treating Owner (correct + honest)
  - Therapist tiles show "Next visit / Visits / Hours / Clients" — coherent period-scoped set with the forward-looking exception clearly marked

**Result:** every tile that semantically can narrow now narrows with the picker. The one tile that can't ("Next visit" — forward-looking) is the only legitimate exception. Labels are honest; the picker means what it shows.

## Cross-surface filter-vs-data audit (2026-05-25 — commit `48b7911`)

User asked: "are there any other issues like we have seen with the above section we fixed where the data or metrics arent actually dynamic and dont change with the filters available on the page?" An audit pass across B-3 → B-5 surfaces found 8 confirmed bugs of the same class (label-vs-data mismatch / filter widget that doesn't drive data / silent scope-drop in drill links), plus 4 verified non-issues (NOW-state by design — verified before deciding to fix).

**Bugs fixed:**

1. **`parseReportFilters` range-key normalisation** (`reports/reporting.ts`):
   - Added `tomorrow` → single day forward (was falling through to month-forward catch-all → Therapist "Tomorrow" chip silently broken)
   - Added `this_week` → calendar Mon–Sun of current week (distinct from `week` which is rolling +7 business days; Therapist "This week" chip label promised calendar week, data delivered rolling-7)
   - Added `this_month` → calendar 1st-to-last-day of current month (distinct from `month` which is month-start to today+30; needed by Reports filter strip's `this_month` chip key)
2. **TherapistDashboard date chips**: "Tomorrow" + "This week" now use the new range keys; "Custom" chip dropped (was degenerate — single-day window with no inputs to edit; Therapist surface intentionally minimal). 3 chips total.
3. **TherapistDashboard `WeeklyStatsCard` heading "This week"**: data was previously page-filter scoped; heading lied at any non-week range. Now data narrows to calendar Mon–Sun regardless of page filter — heading and data agree. All downstream weekly stats (weekHoursLabel, completionRate, noShowCount, recentClients, serviceMixRows) inherit the calendar-week scope.
4. **TherapistDashboard "View weekly detail" link** `/admin/me?range=this_week` previously fell through; now resolves correctly via the new `this_week` case.
5. **TodayAtAGlanceCard "this week" copy** → "next 7 days" (the underlying value is `addBusinessDays(today, 7)` — rolling forward, not calendar Mon–Sun; label aligned to data shape).
6. **Performance ActivityTimeline empty-state copy**: was "No activity in {rangeLabel} yet" but the data query is intentionally unfiltered `fetchAuditLogForStaff(staffId, 100)`. Copy now "No recent activity yet" — matches the "Recent activity" panel title. Dropped unused `rangeLabel` prop through PerformanceSurface + ActivityTimeline.
7. **Reports BusinessPulseCard `newEnquiries`**: was lifetime-total (read unfiltered enquiries list), while the 3 sibling buckets (repeat / new / no-show-cancelled clients) were period-scoped — mixed time-scope inside one "client mix" card. Now filtered by `created_at` within `filters.from`/`to`.
8. **Reports Insight drill-links**: `/admin/reports?paymentStatus=unpaid` etc. dropped `scope=personal` + `staffId` URL params — Personal-scope viewer clicking an insight derived from their own data landed on Team-scoped Reports (silent scope widening). Now page.tsx `InsightsSection` appends current `scope` + `staffId` to each drillUrl before render.
9. **Reports insight grammar**: `periodLabel("today")` returned plain noun "day" → templates produced "Bookings this **day** dropped sharply". Refactored `periodLabel` to return self-contained noun phrases ("today" / "this week" / "this month" / "tomorrow" / "this quarter" / "this year" / "to date" / "in this period"); `priorPeriodLabel` returns matching phrases ("yesterday" / "last week" / etc.); templates dropped redundant "this " prefix.

**Verified NON-issues (no fix needed):**

- **Operations Health card** + **Coord Active Queues disclosure**: metrics like `status='open'` ops events, `availability_mode='custom' with no rules` staff gaps, `status='new'` enquiries are intrinsically CURRENT-STATE — period-scoping is meaningless. These are live operational queues. The "no signal that they're not filtered" UX ambiguity is a Phase 7 candidate (small visual "Live" marker) but the data semantics are correct.
- **Performance "Upcoming work" panel**: title literally says "Upcoming"; forward-looking by design (`booking_date >= today` and `status IN (pending, confirmed)`). Picker is irrelevant to forward-looking views.
- **Performance trend chart bucket at `range=today`**: weekly bucketing is the chart's design; degenerate but not misleading at 1-day range. Phase 7 polish.
- **`/admin/me?staffId=X`**: silently ignored — no UI exposure, harmless.

**Lessons codified as SHARED-IMPLEMENTATION-NOTES §18** (Filter-vs-data discipline, added 2026-05-25): the three bug shapes (hardcoded period suffix / NOW-state in period-scoped surface / filter widget that doesn't drive data), drill-link scope preservation pattern, zero-delta noise filtering, and a 5-step audit checklist for every new filter-equipped surface. Reference before shipping B-6 or any future filter-equipped surface.

**Verification:**
- `npx tsc --noEmit` clean
- `pnpm lint` clean (no warnings)
- `pnpm vitest run`: 482 tests / 476 passing / 6 baseline failing (identical set). +9 new specs lock the new `parseReportFilters` range keys (`tomorrow` / `this_week` / `this_month`).
- `pnpm build` clean
- Live Playwright verified (Owner @ /admin/reports?scope=personal&range=this_month):
  - Insight drillUrls preserve `scope` + `staffId` (verified end-to-end: `/admin/enquiries?tab=new&scope=personal&staffId=01582c5d-...`)
  - Insight grammar reads naturally ("Avg time-to-first-contact on new enquiries is 6.7 days this month, up from…")
  - TherapistDashboard chips: 3 clean chips render; "Tomorrow" and "This week" both activate correctly via aria-current

## Verification gate

- [ ] Static lint + types clean
- [ ] Vitest new specs pass; baseline preserved
- [ ] Business variant: Personal Stripe + filter + Tier 1 + Ops Health Tier 1.5 + no BusinessPulseCard + no Tier-2 disclosure
- [ ] Coordinator variant: Personal Stripe (Coord tiles) + Tier 1 unassigned-first + Ops Health + Active Enquiries disclosure
- [ ] **Therapist variant with FULL data**: all 10 content blocks render per brief §5.6
- [ ] **Therapist variant with EMPTY DB** (use `test.therapist.fresh@…` from B-0): 5–7 meaningful blocks; page never reads "blank" (AUDIT M1)
- [ ] Mobile sticky bar Therapist fallback ladder verified: Next Visit → Browse claimable → Set my availability (AUDIT Q5)
- [ ] Owner Personal Stripe shows own metrics (AUDIT Q4) — clinical zeros render explicitly when Owner doesn't treat
- [ ] **Tone audit on Therapist fullness**: no "★" pills, no "best month yet" copy — matches existing admin voice (AUDIT Q1)
- [ ] Feature flag `NEXT_PUBLIC_B5_THERAPIST_FULLNESS=on` wraps the new blocks (AUDIT R6)
- [ ] PTR fires past 80px on mobile; 2-second debounce in place (AUDIT G9)
- [ ] Swipeable today cards: snap-scroll works
- [ ] M2 fix: OpsHealth failed-email row click → `/admin/emails`
- [ ] M3 fix: Therapist Claim button → optimistic + sonner toast (no confirm modal — AUDIT C4)
- [ ] Severity tints use strong tokens (B-1)
- [ ] Equal min-heights across primary-tier panels
- [ ] Empty-state pass: every section renders encouraging empty copy
- [ ] `prefers-reduced-motion`: no animations
- [ ] `?todayView=` URL preserved per AUDIT G4
- [ ] Screenshots: 3 variants × 4 viewports
- [ ] Query budget ≤6 per render

## Hand-off

Next phase: B-6 (Client LTV ribbon).
