# Plan: B-3 — Performance surface

**Brief:** `redesign/briefs/B3-performance-surface-brief.md`
**Effort:** ~2 days
**Prerequisites:** B-1 (primitives) + B-2 (helpers, `getStaffScorecard`, `filterReportDataToStaff`) shipped
**Gates:** none downstream (B-3 is a leaf surface)
**Safety label:** ADDITIVE (new route + new tab + new component; existing routes/components untouched)
**Blocks redesign:** NO — but is the lowest-risk first UI surface to validate the foundation

---

## What this is

The new third leg of the industry triad: a Performance surface. Adds:
- New route: `/admin/me` (self-view for every active staff member)
- New tab on existing `/admin/staff/[staffId]` page: `?tab=performance` (manager-view + self-deep-link target)
- Shared component `<PerformanceSurface>` rendering same content under both entry points
- Role-aware KPI tile sets (Therapist / Coordinator / Admin / Owner) consuming `getStaffScorecard` from B-2
- Activity timeline scoped to `audit_logs.actor_staff_id = staffId`
- "My upcoming work" panel (Therapist + Coordinator only)
- "My Performance" self-link in `AdminTopNav` (visible to every active role)
- Mobile sticky bottom action bar (Therapist + Coordinator only)

## Why it's needed

Without B-3, R3's per-user metric helpers ship without a UI home — the user's "each user should see their own granular numbers" gap stays open. B-3 is the smallest UI surface in Band B, so it's the cheapest place to validate that B-1 primitives + B-2 helpers compose correctly. Shipping it first de-risks B-4 and B-5.

## What this does (user story)

"As any signed-in staff member, I click 'My Performance' in the nav and land on my own scorecard — completed sessions, hours worked, revenue (if applicable), retention, no-show rate, recent activity timeline — without having to find myself in the staff directory."

"As an Owner / Admin / PM, I open a staff member's profile, click the Performance tab, see the same scorecard scoped to them, decide whether to coach or congratulate."

## What information it stores or retrieves

**Reads:**
- `ReportData` via `getReportData(adminClient, profile, filters)` (existing; B-2 cache wrap applies)
- `getStaffScorecard(data, profile.id, priorData)` (B-2)
- `audit_logs` filtered to `actor_staff_id = profile.id` ORDER BY `created_at DESC` LIMIT 20 — via existing audit-log repository helper

**Writes:** none (read-only surface).

**Migrates:** none.

## Who can use it

- `/admin/me` — every active staff member (`profile.active === true`).
- `/admin/staff/[staffId]/performance` — viewers per existing staff-detail RBAC: Owner / Admin / PM can view any; Coordinator cannot view staff detail at all (existing gate); Therapist viewing another Therapist's tab denied with `AdminAccessDenied`.

## What can go wrong

- **`/admin/me` for users with no `staff_profiles.id`**: shouldn't happen (middleware enforces `getStaffProfile()`), but if `profile === null`, redirect to `/admin/login`. Defensive.
- **Audit timeline returns nothing for a brand-new staff member**: empty state per brief §8.
- **`getStaffScorecard` for an Owner who doesn't treat**: returns all zeros for clinical tiles. UI doesn't crash; tiles render `0` (the absence is data).
- **Role-aware tile selection mis-categorises an Owner-who-treats vs Owner-who-doesn't-treat**: decision rule is `scorecard.assignmentsTotal > 0`. Edge case: Owner with 1 historical assignment but now never treats. **Mitigation:** check assignments within the selected period, not lifetime.
- **`/admin/staff/[staffId]/performance` viewer.id === profile.id**: redirect to `/admin/me` for canonical URL.
- **Therapist navigating to another Therapist's tab via URL manipulation**: existing staff-detail RBAC denies; ensure the brief's denied copy doesn't leak permission identifier.
- **Activity timeline performance**: limit 20 + index on `audit_logs(actor_staff_id, created_at DESC)` — verify the index exists (likely does; audit table is queried this way already).
- **Period selector URL param collision with existing filters**: use `?range=` (matches Dashboard / Reports convention).
- **Mobile sticky action bar overlay with notifications**: R4's toast z-index = 50; sticky bar z-index = 40. Toast wins.
- **`/admin/me` not in middleware matcher**: confirm `src/middleware.ts` matcher covers `/admin/*`.

## How to verify it works

1. **Static:** `pnpm lint` + `npx tsc --noEmit` clean.
2. **Vitest:** new helper specs pass (`tilesForRole`, `humanizeAuditAction`, `iconForActionType`); baseline preserved.
3. **Playwright role sweep**:
   - Sign in as Owner; navigate to `/admin/me`; assert: header reads "Good morning, {firstName}." or appropriate greeting; tile grid shows union (Therapist + Coordinator tiles) or Owner-who-doesn't-treat set; activity timeline populated.
   - Sign in as Admin; same sequence.
   - Sign in as Coordinator; navigate to `/admin/me`; assert 5 Coordinator tiles; timeline populated.
   - Sign in as Therapist; navigate to `/admin/me`; assert 8 Therapist tiles; timeline populated; "My upcoming work" panel populated; mobile sticky bar shows "Go to my next visit".
   - Sign in as Inactive; navigate to `/admin/me`; assert redirect to `/admin/login?reason=inactive`.
4. **Manager-view sweep**:
   - Owner navigates to `/admin/staff/{therapistId}?tab=performance`; assert "Performance — {staffName}" header + manager-view chrome + same tile content as Therapist self-view.
   - Owner navigates to `/admin/staff/{ownId}?tab=performance`; assert redirect to `/admin/me`.
   - Therapist navigates to `/admin/staff/{otherTherapistId}?tab=performance`; assert `AdminAccessDenied`.
5. **Visual smoke**: screenshot at 375 / 768 / 1280 for each role and entry point.
6. **Activity timeline freshness**: trigger an action (e.g. mark a booking confirmed); reload `/admin/me`; confirm the new audit row appears within the limit.

## Safe implementation order

### Step 1 — Pure helpers (`performance-helpers.ts`)
- Create `src/app/admin/components/performance-helpers.ts`.
- Implement:
  - `tilesForRole(role: 'owner' | 'admin' | 'coordinator' | 'therapist', scorecard: StaffScorecard): TileSpec[]` — returns array of tile specs to render.
  - `humanizeAuditAction(actionType: string, targetType: string, targetId: string): string` — turns `booking.status_change` into "You marked booking #1234 confirmed". Mirror the existing audit-log labelling helpers if any.
  - `iconForActionType(actionType: string): LucideIcon` — maps action types to icons (Calendar / MessageCircle / Clock / AlertCircle / Settings).
- Add vitest specs in `__tests__/performance-helpers.test.ts`.
- **Verify:** specs pass.

### Step 2 — `<ActivityTimeline>` (`ActivityTimeline.tsx`)
- Create `src/app/admin/components/ActivityTimeline.tsx`.
- Server component: accepts `staffId` + `limit` props.
- Reads from `audit_logs` via existing repository helper (or new `getAuditLogForStaff(adminClient, staffId, limit)` if not present).
- Renders rows per brief §5.4. Empty state per brief §8.
- Footer "View full audit timeline →" link gated on `manage_audit_logs` (Owner-only).
- **Verify:** smoke-render with a known staff member's audit log.

### Step 3 — `<PerformanceHeader>` (`PerformanceHeader.tsx`)
- Create `src/app/admin/components/PerformanceHeader.tsx`.
- Composes greeting / role pill / period selector / "View in Reports" Ghost link per brief §5.1.
- Period selector mirrors Dashboard's chip pattern; GET form submits `?range=`.
- **Verify:** smoke-render at all viewport sizes.

### Step 4 — `<PerformanceSurface>` (`PerformanceSurface.tsx`)
- Create `src/app/admin/components/PerformanceSurface.tsx`.
- Props: `profile`, `viewer`, `mode`, `range`, `data`, `priorData`, `scorecard`, `auditLog`, `upcomingWork`.
- Compose: `<PerformanceHeader>` → tile grid via `tilesForRole(profile.role, scorecard)` rendering `<KpiTile>` / `<ScorecardRing>` from B-1 → trend chart (`<LineChart>` from B-1) → activity timeline → upcoming work panel (Therapist + Coordinator only).
- Uses `<KpiTile href={...}>` per tile-spec href config from `tilesForRole`.
- **Verify:** spec covering role-aware rendering.

### Step 5 — `/admin/me` route (`me/page.tsx`)
- Create `src/app/admin/me/page.tsx`.
- Server component:
  ```ts
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect('/admin/login');
  const filters = parseReportFilters({ range: params.range ?? 'this_week', ... });
  const priorFilters = buildPriorPeriodFilters(filters);
  const adminClient = createSupabaseAdminClient();
  const [data, priorData] = await Promise.all([
    getReportData(adminClient, profile, filters),
    priorFilters ? getReportData(adminClient, profile, priorFilters) : Promise.resolve(undefined),
  ]);
  const scorecard = getStaffScorecard(data, profile.id, priorData);
  const auditLog = await getAuditLogForStaff(adminClient, profile.id, 20);
  const upcomingWork = await getUpcomingWorkForStaff(adminClient, profile.id, filters);
  return (
    <PerformanceSurface
      profile={profile}
      viewer={profile}
      mode="self"
      range={filters}
      data={data}
      priorData={priorData}
      scorecard={scorecard}
      auditLog={auditLog}
      upcomingWork={upcomingWork}
    />
  );
  ```
- **Verify:** sign in, navigate to `/admin/me`, page renders.

### Step 5.5 — Per-section Suspense boundaries (NEW per AUDIT G-final-3 + SHARED-NOTES §10)
- Wrap each major section in `/admin/me/page.tsx` and the sub-route page in `<Suspense>` boundaries so slower sections (e.g. audit timeline) don't block the tile grid from streaming first:
  ```tsx
  <PerformanceHeader profile={profile} viewer={viewer} mode={mode} range={range} />
  <Suspense fallback={<KpiTileSkeleton count={tilesForRole(profile.role).length} />}>
    <KpiTileGrid profile={profile} scorecard={scorecard} priorScorecard={priorScorecard} />
  </Suspense>
  <Suspense fallback={<TrendChartSkeleton />}>
    <TrendChart profile={profile} data={data} />
  </Suspense>
  <Suspense fallback={<ActivityTimelineSkeleton />}>
    <ActivityTimeline staffId={profile.id} limit={20} />
  </Suspense>
  <Suspense fallback={<UpcomingWorkSkeleton />}>
    <UpcomingWork profile={profile} filters={range} />
  </Suspense>
  ```
- Each `<Suspense>` child becomes its own async server component.
- Skeletons use B-1 shimmer.
- **Verify:** Slow 3G in DevTools; reload `/admin/me`; observe sections paint as their data arrives (tile grid first, timeline last).

### Step 6 — Sub-route `/admin/staff/[staffId]/performance/page.tsx`
- **Per AUDIT-2026-05-22 H1:** sub-route, not query-param tab. Matches existing `/admin/staff/[staffId]/availability/page.tsx` pattern.
- Create `src/app/admin/staff/[staffId]/performance/page.tsx` (~80 lines; mirrors `/admin/me/page.tsx` shape).
- Resolves `params.staffId`; fetches target profile; checks RBAC:
  - When `viewer.id === target.id`, server-side `redirect('/admin/me')`.
  - When viewer cannot view staff detail (Coordinator / Therapist viewing another therapist): `<AdminAccessDenied>` with non-leaking copy.
  - Else render `<PerformanceSurface mode="manager" profile={target} viewer={viewer} />`.
- Modify `src/app/admin/staff/[staffId]/StaffDetailShortcuts.tsx`: add "Performance" Ghost link (lucide `Activity` icon) alongside the existing "Availability" link. Routes to `/admin/staff/{staffId}/performance`.
- **Verify:** navigate to `/admin/staff/{therapistId}/performance` as Owner; assert page renders with manager-view chrome.

### Step 7 — "My Performance" nav link in `AdminTopNav`
- Modify `src/app/admin/components/AdminTopNav.tsx` (or wherever primary nav lives).
- Add a "My Performance" link with `Activity` lucide icon.
- Position: in the user-menu region near sign-out / profile.
- Visible to every active staff member.
- Link → `/admin/me`.
- **Verify:** sign in as each role; confirm link present in nav.

### Step 8 — Vitest + lint + types pass
- Run `pnpm lint`, `npx tsc --noEmit`, `pnpm vitest run`.

### Step 9 — Playwright role sweep
- Per "How to verify it works" §3.
- Capture screenshots.

### Step 10 — Mobile sticky action bar verification
- Sign in as Therapist on mobile (Chrome DevTools 375 viewport).
- Navigate to `/admin/me` with at least one upcoming assignment.
- Assert "Go to my next visit" sticky bar visible.
- Tap; navigate to booking detail.
- Sign in as Coordinator; assert "Open enquiries" sticky bar visible.

### Step 11 — Activity timeline freshness verification
- Sign in as Owner; navigate to `/admin/me`.
- Note the most recent audit row in the timeline.
- In a separate tab, perform an action (e.g. mark a booking confirmed).
- Reload `/admin/me`.
- Confirm the new audit row appears at the top of the timeline.

### Step 12 — Commit
- Stage scoped files explicitly.
- Commit message: `feat(admin): B-3 — Performance surface (/admin/me + tab on /admin/staff/[staffId])`.

## How to undo it if something breaks

All changes are additive:
1. Revert the commit. New route `/admin/me` disappears.
2. The "?tab=performance" handling on `/admin/staff/[staffId]` reverts to existing tab logic.
3. "My Performance" nav link disappears.

No data lost; no consumer of `<PerformanceSurface>` outside B-3.

## Safety confirmations

- [ ] Branch is `redesign/start-state` (or worktree).
- [ ] B-1 + B-2 commits already on the branch.
- [ ] No `pnpm install` (zero new deps).
- [ ] No DB migrations in B-3.
- [ ] No production deploy by this phase.

---

## Step-by-step verification log template

```
step-1: COMPLETE — performance-helpers.ts created; 12 specs pass
step-2: COMPLETE — ActivityTimeline.tsx renders 20 rows for known staff; empty-state copy verified
step-3: COMPLETE — PerformanceHeader.tsx renders greeting + chips + Ghost link
step-4: COMPLETE — PerformanceSurface.tsx composes; role-aware tile grid verified for each role
step-5: COMPLETE — /admin/me route renders for Owner / Admin / Coord / Therapist
step-6: COMPLETE — /admin/staff/[staffId]/performance sub-route renders manager-view chrome
step-7: COMPLETE — "My Performance" link visible in AdminTopNav for every role
step-8: COMPLETE — lint + tsc + vitest all green
step-9: COMPLETE — Playwright role sweep passed; screenshots at 3 viewports per role captured
step-10: COMPLETE — mobile sticky bar verified for Therapist + Coordinator
step-11: COMPLETE — audit timeline freshness verified (new row appears post-action)
step-12: COMPLETE — committed feat(admin): B-3 — Performance surface
```

---

## Verification gate

| Gate | Command | Pass criterion |
|---|---|---|
| Static lint | `pnpm lint` | 0 errors |
| Static types | `npx tsc --noEmit` | 0 errors |
| Vitest | `pnpm vitest run` | All new specs pass; baseline preserved |
| Route reachable | Sign in, navigate to `/admin/me` | Page renders for each role |
| Manager-view | Owner → `/admin/staff/{id}?tab=performance` | Renders with manager chrome |
| Self-redirect | Owner → `/admin/staff/{ownId}?tab=performance` | Redirects to `/admin/me` |
| Therapist denied | Therapist → `/admin/staff/{otherTherapistId}?tab=performance` | `AdminAccessDenied`, no permission leak |
| Inactive blocked | Inactive → `/admin/me` | Redirected to `/admin/login?reason=inactive` |
| Nav link visible | Sign in as each role | "My Performance" link in nav |
| Mobile sticky bar | Therapist on `/admin/me` with upcoming visit | "Go to my next visit" visible |
| Audit freshness | Action triggered → reload `/admin/me` | New audit row appears |
| Screenshots | 375 / 768 / 1280 per role | Layout matches brief §5 |

---

## Files touched (summary)

**Created:**
- `src/app/admin/me/page.tsx`
- `src/app/admin/staff/[staffId]/performance/page.tsx`
- `src/app/admin/components/PerformanceSurface.tsx`
- `src/app/admin/components/PerformanceHeader.tsx`
- `src/app/admin/components/ActivityTimeline.tsx`
- `src/app/admin/components/performance-helpers.ts`
- `src/app/admin/components/__tests__/performance-helpers.test.ts`
- `src/app/admin/me/__tests__/page.test.tsx`

**Modified:**
- `src/app/admin/staff/[staffId]/StaffDetailShortcuts.tsx` (add Performance Ghost link; minimal edit)
- `src/app/admin/components/AdminTopNav.tsx` (add "My Performance" link)

**Total: ~8 new files + ~2 modified files.**

---

## Hand-off

After B-3 ships:
- B-4 implementer can proceed (Reports rebuild). Visual-language consistency lessons from B-3 (tile sizing, chart spacing, mobile reflow) feed into B-4.
- B-5 implementer can proceed (Dashboard rebuild). Mobile sticky action bar pattern from B-3 reused.
- B-6 implementer can proceed (Client LTV ribbon — also low-risk).

Next phase: B-4 (Reports rebuild).
