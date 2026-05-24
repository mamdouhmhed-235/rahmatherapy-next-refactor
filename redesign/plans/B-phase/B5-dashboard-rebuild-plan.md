# Plan: B-5 — Dashboard rebuild

**Brief:** `redesign/briefs/B5-dashboard-rebuild-brief.md`
**Effort:** ~4 days (was ~3; +1 day for Therapist fullness pass per AUDIT-2026-05-22 M1 — 5 new content blocks + helpers)
**Prerequisites:** B-1 (primitives) + B-2 (helpers) shipped. B-4 ideally shipped first for cross-page visual-language consistency. B-3 shipped: Personal Stripe shares period-picker UX with B-3's PerformanceHeader period chips.
**Gates:** none downstream
**Safety label:** REPLACES — wholesale UI rewrite of `/admin/dashboard` across all 3 variants; backend data layer (`dashboard-data.ts`, `dashboard-helpers.ts`) preserved verbatim; M2 + M3 papercuts folded in
**Blocks redesign:** NO — but is the most-visited admin surface; landing it closes the visible "horrible / dead" complaint

---

## What this is

Wholesale rebuild of `/admin/dashboard`. Strips the page back to operational-triage-only: removes the Tier-2 Business Overview disclosure (relocates Operations Health to Tier 1.5; relocates the other 3 sub-tiles' data to Reports B-4); removes `BusinessPulseCard` (relocates to B-4 Activity section); adds a role-aware `<PersonalContributionStripe>` at the very top; adds mobile sticky bottom action bar + pull-to-refresh + swipeable today cards; closes M2 (Operations Health per-row hrefs) and M3 (Therapist inline ClaimAssignmentButton). All 3 variants (business / coordinator / therapist) preserved as content variants; shell layout unified.

## Why it's needed

The user's "horrible, dead, unprofessional" complaint maps to: jagged card sizes, washed-out severity tints, dead `BusinessPulseCard` at the bottom, hollow Tier-2 collapsed state, no personal slice visible. B-5 rebuilds the page to deliver all of:
- Personal contribution visible *first* (not buried)
- Operations Health visible without disclosure-expand
- Severity tints loud enough to demand attention
- Equal min-heights everywhere
- Mobile-grade interaction patterns (sticky bar / PTR / swipeable)
- M2 + M3 papercuts closed in-flight

## What this does (user story)

"As an Owner on a Monday morning, I open the dashboard and see (in order): my own contribution this week → today's bookings with the 2 unassigned highlighted → the 3 attention items → the 1 operational event. I handle the unassigned first, the ops event second, and I'm done in 15 minutes."

"As a Therapist on the road, I open the dashboard mobile, see my Next Visit hero with Maps + Call buttons inline, tap 'Call client' from the sticky bottom bar. The whole interaction is one tap from one screen."

"As a Coordinator at 8:30am, I open the dashboard, see 3 unassigned bookings, tap the sticky bottom bar 'Assign 3 unassigned →', land on the bookings list pre-filtered."

## What information it stores or retrieves

**Reads:** existing `getDashboardData(adminClient, profile, filters)` (B-2 cache wrap applies). `getStaffScorecard(data, profile.id)` from B-2 for Personal Stripe.

**Writes:** none from the page directly (M3's inline `<ClaimAssignmentButton>` triggers existing `claim` server action; no new mutations from B-5).

**Migrates:** none.

## Who can use it

- Business variant: Owner / Admin / PM (`resolveAdminShellVariant === 'business'`).
- Coordinator variant: Coordinator.
- Therapist variant: Therapist.
- Inactive: middleware blocks at `/admin/login?reason=inactive`.

## What can go wrong

- **Personal Stripe period picker URL collision**: uses `?contribStripeRange=` not `?range=` (range is for filter strip). Distinct param avoids collision.
- **`BusinessOverviewDisclosure` removed from Business variant but still mounted for Coordinator**: Coordinator variant has its own Active Enquiries + Ops Health sub-grid inside the disclosure. Keep `BusinessOverviewDisclosure` mounted only for Coordinator.
- **`BusinessPulseCard` import removal breaks if Reports B-4 hasn't shipped yet**: B-4 should ship before B-5 to ensure the component has a new home. If B-5 ships first, BusinessPulseCard's existing implementation just stays around until B-4 lands; the dashboard removal is independent.
- **M2 fix breaks existing OperationsHealthCard consumers**: the only consumer is the dashboard. Safe.
- **M3 inline `<ClaimAssignmentButton>` confirm modal stacks awkwardly on mobile**: existing confirm modal already handles mobile.
- **Mobile sticky bar overlap with R4 notification toast**: R4 toast z-index = 50; sticky bar z-index = 40. Toast wins (correct precedence).
- **PTR pull threshold mismatched on iOS vs Android**: 80px works on both per industry pattern; verified manually.
- **Swipeable today cards on iPad in portrait**: portrait iPad has a wider viewport than 768px breakpoint; might render in desktop vertical-list mode unexpectedly. **Mitigation:** breakpoint at 768px is standard; iPad portrait (768px) sits exactly at the threshold. Acceptable.
- **Personal Stripe for Owner-who-doesn't-treat**: tile #2 "My contribution" would show 0 if Owner never has clinical assignments. Decision rule per brief §10 Q2: if `scorecard.assignmentsTotal > 0` → show clinical contribution; else show admin action count from audit log.
- **`localStorage` orphan key from old Tier-2 disclosure**: existing users have `dashboard:show-business-overview-{userId}` set. Removal leaves the key orphaned. **Mitigation:** add a one-time cleanup useEffect on first dashboard load post-B-5 to `localStorage.removeItem(...)` the orphan key. Idempotent.
- **Therapist navigating with `?contribStripeRange=today`**: applies to Therapist's stripe too; tiles narrow. Same UX as other variants.

## How to verify it works

1. **Static:** lint + types clean.
2. **Vitest:** new helper specs pass; baseline preserved.
3. **Playwright variant sweep**:
   - Business (Owner + Admin): full page renders; Personal Stripe + filter + Tier 1 + Ops Health Tier 1.5.
   - Coordinator: Personal Stripe (Coord tiles) + Tier 1 with unassigned-first sort + Ops Health + Active Enquiries (in own disclosure).
   - Therapist: Personal Stripe (Therapist tiles) + Next Visit hero + Today's visits + Claimable strip (with inline Claim buttons) + Weekly summary.
4. **Mobile sticky bar verification**: each variant on mobile; tap action; navigation correct.
5. **PTR**: simulate pull on mobile; refresh fires.
6. **Swipeable today**: simulate horizontal swipe on mobile; snap works.
7. **M2 verification**: Operations Health failed-email row click → `/admin/emails` (not `/admin/operations`).
8. **M3 verification**: Therapist Claimable card Claim button → confirm modal → confirm → assignment claimed; toast; revalidate.
9. **Visual**: screenshots at 4 viewports per variant.
10. **Empty state pass**: clear DB; reload; every section renders its empty state.
11. **`prefers-reduced-motion`**: enable; reload; confirm no count-ups, no swipes, no PTR animation.

## Safe implementation order

### Step 1 — Pure helpers (`dashboard-helpers-b5.ts`)
- Create `src/app/admin/dashboard/dashboard-helpers-b5.ts`.
- Implement:
  - `tilesForVariant(variant, scorecard, data, profile)`: returns 4-tile spec array per variant.
  - `mobileStickyActionForVariant(variant, data, nextAppointment, unassignedCount)`: returns sticky bar config (label, href, icon) or null.
  - `cleanupLegacyDisclosureKey(userId)`: one-time `localStorage.removeItem` for the orphan key.
- Add vitest specs.
- **Verify:** specs pass.

### Step 2 — `<PersonalContributionStripe>`
- Create `src/app/admin/dashboard/PersonalContributionStripe.tsx` (~120 lines).
- Server component (the data flows server-side; period picker is the only client interaction).
- Composes 4 `<MetricRow>` from B-1 per `tilesForVariant`.
- Period picker (top-right of stripe) — segmented control with `?contribStripeRange=` URL param.
- Mobile: 2×2 grid.
- Add spec.
- **Verify:** smoke for each variant.

### Step 3 — M2 fix: `<OperationsHealthCard>` per-row hrefs
- Modify `src/app/admin/dashboard/dashboard-cards.tsx`.
- For each row in the priority list, derive an `href` per row type:
  - Failed email row → `/admin/emails`
  - Ops event row → `/admin/operations/{eventId}` (or `/admin/operations` if no specific event ID available)
  - Availability gap row → `/admin/staff/{staffId}?tab=availability`
- Each row renders "View →" Ghost link with row-specific href.
- Panel default "View details" link removed (replaced by per-row).
- Update spec or add: M2 verification.
- **Verify:** click each row type; navigate to correct destination.

### Step 4 — M3 fix: inline `<ClaimAssignmentButton>` on Therapist Claimable cards
- Modify `src/app/admin/dashboard/TherapistDashboard.tsx`.
- Locate the Claimable strip card rendering.
- Import `<ClaimAssignmentButton>` from `src/app/admin/bookings/ClaimAssignmentButton.tsx` (existing component — verified path).
- **Per AUDIT-2026-05-22 C4:** the component takes `assignmentId` prop (NOT `bookingId`). Source data must include the assignment ID. Verify via the current `data.assignments` shape (it does — `id` field on each `ReportAssignment`).
- Replace the bare "View" Ghost link with: "View" Ghost (whole-card link) + `<ClaimAssignmentButton assignmentId={firstClaimableAssignment.id} />` side-by-side.
- The Claim button is a client component with its own click handler; the card-as-link `<Link>` wraps only the non-button portion. Avoid nested-anchor by structuring the card as a `<div>` containing a `<Link>` for the body and the button as a sibling.
- **Verify:** sign in as Therapist; navigate to dashboard; click Claim button.
  - Optimistic visual lock fires (button → disabled, "Claimed" label).
  - Server action `claimBookingAssignment` runs.
  - On success: sonner toast "Booking claimed."; `router.refresh()`.
  - On race (someone else claimed first): sonner error "Someone else just claimed this one. Refresh to see the latest." (existing copy).
  - **NO confirm modal** — the existing component has no modal; documented at C4.

### Step 5 — `<MobileStickyActionBar>`
- Create `src/app/admin/dashboard/MobileStickyActionBar.tsx` (~80 lines).
- Client component (needs to read variant + compute action).
- Renders sticky bottom bar per `mobileStickyActionForVariant` (updated per AUDIT-2026-05-22 Q5 — Therapist fallback ladder):
  - **Therapist:**
    1. Has Next Visit → "Open in Maps" + "Call client" (side-by-side).
    2. Else if claimable available → "Browse claimable →" (full-width Primary).
    3. Else → "Set my availability →" (full-width Secondary).
    4. Hide only when ALL three are RBAC-denied (essentially impossible for an active Therapist).
  - **Business / Coordinator:**
    1. Unassigned > 0 → "Assign N unassigned →".
    2. Else → hide.
- z-index 40; safe-area-padding-bottom.
- Hidden on desktop (≥ md).
- Add spec covering each fallback rung for Therapist.
- **Verify:** sign in mobile as Therapist with each of the three states (next visit / no next visit but claimable / nothing); confirm correct bar action.

### Step 6 — `<PullToRefresh>` wrapper
- Create `src/app/admin/dashboard/PullToRefresh.tsx` (~60 lines).
- Client component wraps the page contents.
- Pointer-events handler: track pull distance from top; on release past 80px, trigger `router.refresh()`.
- Spinner indicator during refresh.
- Honours `prefers-reduced-motion`.
- Mobile-only behaviour (no-op on desktop).
- Add spec.
- **Verify:** Chrome DevTools mobile touch simulation; pull past 80px; refresh fires.

### Step 7 — `<SwipeableTodayCards>`
- Create `src/app/admin/dashboard/SwipeableTodayCards.tsx` (~50 lines).
- Client component (CSS scroll-snap is enough; minimal JS).
- Wraps the Today panel's row list on mobile only.
- Cards ~85vw wide; trailing card prompts "View all N today →".
- Desktop: passes through (no swipe wrap).
- Add spec.
- **Verify:** mobile swipe; snap works.

### Step 8 — Wholesale restructure of `page.tsx`
- Restructure `src/app/admin/dashboard/page.tsx` (~956 → ~600 lines after extraction).
- Insert `<PersonalContributionStripe>` immediately below `<DashboardHeader>`.
- Wrap the page in `<PullToRefresh>` (mobile-only no-op on desktop).
- Wrap the Today panel's row list in `<SwipeableTodayCards>` (mobile-only no-op on desktop).
- Add `<MobileStickyActionBar>` at page bottom.
- For Business variant: remove `<BusinessOverviewDisclosure>` mount; render `<OperationsHealthCard>` as a full-width Tier 1.5 panel.
- For Coordinator variant: keep `<BusinessOverviewDisclosure>` (it houses Active Enquiries + Ops Health side-by-side as before).
- Remove `<BusinessPulseCard>` mount entirely (the import stays — used by B-4).
- Add `cleanupLegacyDisclosureKey(profile.id)` call in a one-time useEffect.
- Preserve every GET param + variant resolution + filter strip.
- **Verify:** sign in each variant; smoke each section per brief §5.

### Step 9 — `TherapistDashboard.tsx` refactor (FULLNESS PASS per AUDIT-2026-05-22 M1 + Q1 tone refinement)
- Modify `src/app/admin/dashboard/TherapistDashboard.tsx`.
- Wrap the new blocks behind a feature flag `NEXT_PUBLIC_B5_THERAPIST_FULLNESS` (default `on`; can disable per AUDIT R6).
- **The full sequence per brief §5.6:**
  1. Keep `DashboardHeader` (existing).
  2. Keep `<ProfileCompletionNudge>` with existing behaviour — hides on completion. **Per AUDIT Q1: no celebratory pill** (gamification tone mismatch).
  3. Add `<PersonalContributionStripe variant="therapist">` (from step 2 of this plan).
  4. Add `<HighlightOrTipStrip scorecard={scorecard} priorScorecard={priorScorecard} profile={profile} />` — NEW. **Per AUDIT F4 — canonical helper location:** implement `getTherapistHighlightOrTip(scorecard, priorScorecard, profile)` in `src/app/admin/dashboard/therapist-fullness.ts` (NOT `dashboard-helpers-b5.ts` — `therapist-fullness.ts` is the Therapist-only refinement file; `dashboard-helpers-b5.ts` holds cross-variant helpers). Returns `{ icon: 'TrendingUp' | 'Lightbulb', message: string }`. Library per brief §5.6 block 4 (factual, no "your best month yet" copy).
  5. Keep Next Visit hero (existing); on empty (no upcoming visit), render the smaller empty-state panel that links into Claimable strip and "Set my availability".
  6. Keep Today's visits list (existing).
  7. Add `<ClaimableStrip>` with M3 fix from step 4. When Today + Next Visit are both empty, mount this strip ABOVE the Next Visit hero (visual hierarchy adjustment) and use `--admin-warning-bg-strong` token. Otherwise mount in current position.
  8. Add `<RecentClientsStrip clientId, last30days />` — NEW. Renders strip of last 6 unique completed clients in last 30 days. Hidden when none. Implementation: `getRecentClientsForTherapist(data, last30days)` in `therapist-fullness.ts` derives from `data.bookings` filtered + dedup by `client_id`. **Per AUDIT G-final-4:** `data.bookings` in the Therapist variant is already auto-narrowed upstream via `assignedOnly: true` in `dashboard-data.ts:487` — so the helper returns "clients I've personally seen" automatically. Add a comment in the helper signature explaining this dependency on upstream narrowing (so a future Phase 7 audit doesn't accidentally widen the scope by removing `assignedOnly` and turn this strip into a clinic-wide leak).
  9. Keep Weekly summary tile (existing) — link to `/admin/me?range=this_week` (the new B-3 self-link target).
  10. Add `<QuickHelpPanel staffId={profile.id} permissions={permissionAccess} />` — NEW. Renders 3-link Ghost panel "Need help?" per brief §5.6 block 10. Filters out links the staff can't reach.
- **Verify:** Therapist sign-in with FULL data; all 10 blocks render per brief §5.
- **Verify:** Therapist sign-in with EMPTY DB (no bookings, no claimable, brand-new profile); confirm:
  - Header renders
  - Profile-readiness banner renders the active completion prompt (not the 7-day pill yet)
  - Personal Stripe renders 4 zero-but-formatted tiles
  - Milestone/Tip strip renders a tip (fallback when no milestone)
  - Next Visit hero renders the empty-state panel with linking CTAs
  - Today's visits list is hidden
  - Claimable strip is promoted to primary position with strong tint; "Nothing open right now" copy + CTA
  - Recent clients strip is hidden
  - Weekly summary renders zeros
  - Quick help panel renders ≥1 link
  - **Result:** screen has 5–7 meaningful visual blocks — never "blank."

### Step 10 — Restyle Urgent Attention + Ops Health with severity-strong tokens
- Modify `src/app/admin/dashboard/dashboard-cards.tsx`.
- Replace existing `bg-warning` (or equivalent) on Urgent Attention panel with `bg-[var(--admin-warning-bg-strong)]` (B-1 token).
- Replace existing per-row severity tints in Operations Health priority list with strong-token variants.
- Equal `min-h-[14rem]` across primary-tier panels.
- **Verify:** visual diff; severity reads stronger.

### Step 11 — `dashboard-filters-client.tsx` restyle
- Light restyle to align with B-1 tokens.
- Confirm `<BusinessOverviewDisclosure>` is only mounted for Coordinator variant.
- **Verify:** business variant has no disclosure; coordinator has Active Enquiries disclosure.

### Step 12 — `loading.tsx` update
- Update `src/app/admin/dashboard/loading.tsx` skeleton shapes to match new structure.
- **Verify:** dev mode reload; skeleton shape matches final layout.

### Step 13 — Vitest + lint + types
- All gates pass.

### Step 14 — Playwright variant sweep + screenshots
- Per "How to verify it works" §3.

### Step 15 — Mobile verification
- PTR + sticky bar + swipeable cards per "How to verify it works" §4–6.

### Step 16 — M2 + M3 verification
- Per "How to verify it works" §7–8.

### Step 17 — Empty-state pass
- Clear DB or use a known empty test account.
- Reload as each variant.
- Confirm every section renders its empty state correctly per brief §6.

### Step 18 — `prefers-reduced-motion` verification
- Enable OS-level setting.
- Reload.
- Confirm no count-ups, no swipe snap animations, no PTR spinner motion.

### Step 19 — Commit
- Stage scoped files explicitly.
- Commit message: `feat(admin): B-5 — Dashboard rebuild (Personal Stripe + Ops Health promoted + mobile sticky bar + PTR + M2/M3 fixes)`.

## How to undo it if something breaks

Single commit; revert restores pre-B-5 dashboard wholesale. No data changes; no schema changes. M2 + M3 papercuts revert with the page (acceptable — they were stable papercuts before B-5).

Selective revert is possible if commits are broken up during implementation: each step's progress log can guide.

## Safety confirmations

- [ ] Branch is `redesign/start-state` (or worktree).
- [ ] B-1 + B-2 commits already on the branch.
- [ ] B-4 ideally already shipped (so BusinessPulseCard has its new Reports home before being removed from Dashboard).
- [ ] No `pnpm install` (zero new deps).
- [ ] No DB migrations.
- [ ] No production deploy triggered by this phase.

---

## Step-by-step verification log template

```
step-1: COMPLETE — dashboard-helpers-b5.ts created; 8 specs pass
step-2: COMPLETE — PersonalContributionStripe created; smoke for each variant
step-3: COMPLETE — M2 fix: Operations Health per-row hrefs verified; failed-email row → /admin/emails
step-4: COMPLETE — M3 fix: Therapist Claimable card has inline ClaimAssignmentButton; claim flow verified
step-5: COMPLETE — MobileStickyActionBar created; variant-specific actions render
step-6: COMPLETE — PullToRefresh wrapper created; 80px threshold verified in Chrome DevTools
step-7: COMPLETE — SwipeableTodayCards created; snap-scroll works on mobile
step-8: COMPLETE — page.tsx wholesale restructured; Personal Stripe + Ops Health promoted; BusinessOverviewDisclosure removed for Business; legacy localStorage cleanup wired
step-9: COMPLETE — TherapistDashboard.tsx refactored; Personal Stripe + M3 fix + weekly summary link
step-10: COMPLETE — severity-strong tokens applied to Urgent Attention + Ops Health; equal min-heights
step-11: COMPLETE — dashboard-filters-client.tsx restyled; Business variant has no disclosure
step-12: COMPLETE — loading.tsx skeleton shapes updated
step-13: COMPLETE — lint + tsc + vitest all green
step-14: COMPLETE — Playwright sweep: 3 variants × 4 viewports captured
step-15: COMPLETE — PTR + sticky bar + swipeable cards verified on mobile
step-16: COMPLETE — M2 + M3 end-to-end verified
step-17: COMPLETE — empty-state pass: all sections render encouraging empty copy
step-18: COMPLETE — prefers-reduced-motion: no animations fire
step-19: COMPLETE — committed feat(admin): B-5 — Dashboard rebuild
```

---

## Verification gate

| Gate | Command | Pass criterion |
|---|---|---|
| Static lint | `pnpm lint` | 0 errors |
| Static types | `npx tsc --noEmit` | 0 errors |
| Vitest | `pnpm vitest run` | New specs pass; baseline preserved |
| Business variant | Sign in as Owner | Personal Stripe + filter + Tier 1 + Ops Health Tier 1.5 + no BusinessPulseCard + no Tier-2 disclosure |
| Coordinator variant | Sign in as Coordinator | Personal Stripe (Coord tiles) + Tier 1 unassigned-first + Ops Health + Active Enquiries disclosure |
| Therapist variant | Sign in as Therapist | Personal Stripe (Therapist tiles) + Next Visit hero + Today's visits + Claimable strip with inline Claim buttons + Weekly summary |
| Mobile sticky bar | Each variant on mobile | Correct action label; tap navigates |
| PTR | Mobile, pull past 80px | `router.refresh()` fires |
| Swipeable today | Mobile, swipe horizontally | Snap-scroll engages |
| M2 fix | OpsHealth failed-email row click | Lands on `/admin/emails` |
| M3 fix | Therapist Claim button | Confirm modal opens; confirm claims; toast appears |
| Severity tints | Visual check | Urgent Attention background uses strong token; reads "act on this" |
| Equal min-heights | Visual check | No jagged grids; tiles align top + bottom |
| Empty states | Empty DB account | Every section renders encouraging copy |
| reduced-motion | OS setting | No animations |
| Screenshots | 3 variants × 4 viewports | Layout matches brief §5 |

---

## Files touched (summary)

**Created:**
- `src/app/admin/dashboard/PersonalContributionStripe.tsx`
- `src/app/admin/dashboard/MobileStickyActionBar.tsx`
- `src/app/admin/dashboard/PullToRefresh.tsx`
- `src/app/admin/dashboard/SwipeableTodayCards.tsx`
- `src/app/admin/dashboard/dashboard-helpers-b5.ts`
- `src/app/admin/dashboard/__tests__/dashboard-helpers-b5.test.ts`
- **NEW per fullness pass (M1):**
  - `src/app/admin/dashboard/HighlightOrTipStrip.tsx` — Therapist milestone-or-tip row
  - `src/app/admin/dashboard/RecentClientsStrip.tsx` — Therapist last-6-clients strip
  - `src/app/admin/dashboard/QuickHelpPanel.tsx` — Therapist quick-help "Need help?" panel
  - `src/app/admin/dashboard/therapist-fullness.ts` — pure helpers (`getTherapistHighlightOrTip`, `getRecentClientsForTherapist`, `quickHelpLinksForTherapist`)
  - `src/app/admin/dashboard/__tests__/therapist-fullness.test.ts`

**Modified:**
- `src/app/admin/dashboard/page.tsx` (wholesale restructure for business + coordinator variants)
- `src/app/admin/dashboard/TherapistDashboard.tsx` (Personal Stripe + M3 inline button + weekly summary link)
- `src/app/admin/dashboard/dashboard-cards.tsx` (M2 per-row hrefs + severity-strong tokens + equal min-heights + drop BusinessPulseCard export)
- `src/app/admin/dashboard/dashboard-filters-client.tsx` (restyle + Business variant disclosure mount removed)
- `src/app/admin/dashboard/dashboard-header.tsx` (minor — right rail accommodation)
- `src/app/admin/dashboard/loading.tsx` (skeleton shapes update)

**Total: ~6 new files + ~6 modified files.**

---

## Hand-off

After B-5 ships:
- B-6 implementer can proceed (Client LTV ribbon — small adjunct).
- Programme is near complete.

Next phase: B-6 (Client LTV ribbon).
