# Brief: B-3 — Performance surface (`/admin/me` + tab on `/admin/staff/[staffId]`)

**Phase:** B-3 (first UI surface using B-1 + B-2)
**Estimated effort:** ~2 days
**Brief status:** session-4 reframe; user-confirmed
**Plan:** `redesign/plans/B-phase/B3-performance-surface-plan.md`
**Prerequisites:** B-1 (primitives) + B-2 (helpers) shipped

---

## 1. Feature Summary

The missing third leg of the industry triad (Dashboard / Reports / **Performance**). Adds a new self-view page at `/admin/me` and a new "Performance" tab on `/admin/staff/[staffId]` — both rendering the same shared component tree (`<PerformanceSurface profile={...} viewer={...} />`), differing only in chrome and access rules. The page closes the user's explicit gap: every operator (Owner / Admin / Coordinator / Therapist) sees their own granular metrics — hours worked, money brought in, clients touched, retention rate, no-show rate, conversion rate, response time — in one place, with sparklines and period-over-period deltas on every tile. A scoped audit-log activity timeline makes the page feel *living* (recent actions appear within ~60s). Adds a "My Performance" self-link to the global nav so every role can reach their own page in one click without finding themselves in the staff directory. Mobile-first; reuses every primitive from B-1.

## 2. Primary User Action

**Sign in, click "My Performance" in the nav, see at a glance: how many sessions / enquiries I handled this month vs last, how many hours I worked, how much revenue I brought in (if applicable), what my utilisation / no-show / retention numbers are, and a timeline of what I actually did today — all without scrolling past the first viewport on desktop and within two short scrolls on mobile.**

For Owner/Admin managing staff: **open a staff member's profile, click the Performance tab, see the same view scoped to them — no separate page, no separate component, same visual language.**

## 3. Design Direction

**Colour strategy:** Calm and personal. The page is *about you* — restrained palette, larger numerals, more whitespace than Reports. No marquee gold (this surface earns its own quietness; gold is reserved for the business-wide marquee on Dashboard Owner variant). Severity colour appears only on metrics that are tracked against a benchmark — utilisation (Confirmed family when ≥ target, Pending when 75–99%, Attention < 75%), retention, no-show rate (inverted: Confirmed when low, Attention when high). Personal contribution numerals stay Chronicle.

**Theme scene sentence:** *"A Therapist between visits in her car opens 'My Performance' on her phone: she sees she's done 18 sessions this month (up from 14 last), worked about 22 hours, earned £540 attributed to her, retained 4 out of her last 12 clients, and that her last action this morning was marking a booking complete at 11:14. She closes the app reassured."* Forces mobile-first, forces "her own numbers visible to her without permission anxiety," forces audit-timeline freshness.

**Anchor references:**
- **Jane App "Practitioner Dashboard"** — single self-scoped page; metrics + recent activity + upcoming work
- **Linear "My Issues"** as a personal landing concept — focused, scoped to me, never a global view
- **GitHub's personal contribution graph + activity feed** — the timeline-of-actions framing makes the page feel current
- **Stripe Dashboard's "Today" view** for the tile + delta visual language (inherited from B-1)

Anti-anchor: a giant 12-tile scorecard with every imaginable metric. The page picks 5–7 tiles tuned per role; everything else folds into the activity timeline or is reachable via a "View full Reports for me →" link to Reports `?staffId=me&scope=personal`.

## 4. Scope

**In:**

### Routes
- `GET /admin/me` — new route. Resolves the signed-in profile, renders `<PerformanceSurface profile={profile} viewer={profile} mode="self" />`. Available to every active staff member.
- `GET /admin/staff/[staffId]/performance` — new sub-route (matches existing `[staffId]/availability` pattern; updated per AUDIT-2026-05-22 H1). Renders `<PerformanceSurface profile={targetProfile} viewer={signedInProfile} mode="manager" />` when `viewer.id !== targetProfile.id` (else redirects to `/admin/me` for cleanliness). Discoverability: the existing `StaffDetailShortcuts` panel on `/admin/staff/[staffId]/page.tsx` gains a "Performance" Ghost link alongside the existing "Availability" link.

### Permission rules
- `/admin/me` — gated on `profile.active === true`. Every active role can view their own page.
- `/admin/staff/[staffId]/performance` — gated on `getAdminPageAccess(viewer, "staff").access === 'detail'` (or whatever the existing staff-detail gate is). Manager-view applies. **Therapist viewing another Therapist's tab: denied** — `AdminAccessDenied` with non-leaking copy.

### Nav addition
- "My Performance" link added to `AdminTopNav` (or wherever the primary nav lives). Routes to `/admin/me`. Available to every role. Icon: `Activity` (lucide). Position: between the existing self-related items (top-right user menu region).

### Shared component
- `<PerformanceSurface profile, viewer, mode, range>` — single component used by both routes.
- Props: `profile: StaffProfile` (the subject), `viewer: StaffProfile` (the signed-in viewer; controls chrome differences), `mode: 'self' | 'manager'`, `range: ReportFilters`.
- Role-aware tile selection via `tilesForRole(profile.role)` (see §5).
- Activity timeline component `<ActivityTimeline staffId={profile.id} limit={20} />` — reads from `audit_logs` filtered to `actor_staff_id = staffId`, ordered DESC.

### Files
- `src/app/admin/me/page.tsx` — new route (~80 lines)
- `src/app/admin/staff/[staffId]/performance/page.tsx` — new sub-route (~80 lines; mirrors `/admin/me/page.tsx` shape; renders `<PerformanceSurface mode="manager" />`)
- `src/app/admin/staff/[staffId]/page.tsx` — modified ONLY to add a "Performance" Ghost link in `StaffDetailShortcuts.tsx` (or wherever the shortcut nav lives); existing layout otherwise untouched
- `src/app/admin/staff/[staffId]/StaffDetailShortcuts.tsx` — add Performance link alongside existing Availability link
- `src/app/admin/components/performance-data.ts` — NEW per AUDIT-2026-05-22 G1; page-scoped helpers `getUpcomingWorkForStaff(adminClient, staffId, filters)` (returns next 5 upcoming `booking_assignments`) and any other small page-data helpers. NOT in B-2 — these are derived-data fetchers specific to the Performance surface.
- `src/app/admin/components/PerformanceSurface.tsx` — shared component (~350 lines)
- `src/app/admin/components/ActivityTimeline.tsx` — audit-log timeline (~100 lines)
- `src/app/admin/components/PerformanceHeader.tsx` — page header with greeting / role pill / period selector (~80 lines)

**Out (deferred or out entirely):**
- **Target rings driven by `staff_targets`** — explicit user decision; utilisation tile renders without target marker (uses default 80% as visual reference but doesn't claim it's a personal target).
- **Comparison to other staff** — Performance is about you, not vs others. No "Aisha vs the team" tile.
- **AI / LLM coaching tips** — out of scope.
- **Export-my-data CSV** — Phase 7 candidate; not blocking.
- **Public-facing version** — explicit user decision; out.
- **Editing personal goals from the page** — out (no goals at all this round).

## 5. Layout Strategy

**Page rhythm (top to bottom, mobile-first 375px, scaling to desktop):**

### 5.1 Header (always)

`<PerformanceHeader>` — single full-width block. Composition:
- **Greeting line**: Cormorant Garamond 600, title step. "Good morning, Aisha." (or afternoon/evening per `getGreeting()` from the existing therapist-dashboard helper). When `mode='manager'`, becomes "Performance — Aisha Hassan" (no greeting; this is not personal).
- **Sub-line**: Work Sans 400 body. Live date + role pill. "Tuesday 12 May 2026 · Therapist" (`mode='self'`) or "Tuesday 12 May 2026 · Reviewing Therapist · Last sign-in 2h ago" (`mode='manager'`).
- **Period selector**: pill group, mirrors Dashboard's date-range chips: `Today · This week · This month · This quarter · Custom`. Active pill: `--admin-primary` fill, Field White text. `aria-current="page"`. URL param `?range=`.
- Right rail (desktop only): "View in Reports →" Ghost link → `/admin/reports?staffId={profile.id}&scope=personal&range={range}`. Lets viewer pivot from "my performance" to "my report" (which is the same data in the macro page).

### 5.2 KPI tile grid (role-aware)

Below the header. CSS grid, auto-fill, `minmax(220px, 1fr)`, `gap-4`. Renders 5–8 `<KpiTile>` instances per role.

**Tile sets per role** (`tilesForRole(profile.role)` returns the array):

#### Therapist tiles (8)
1. **Completed sessions** — `value: scorecard.assignmentsCompleted`, `delta: scorecard.deltas?.assignmentsCompleted`, `series: monthlyCompletedSeries`
2. **Hours worked** — `value: scorecard.hoursWorked`, formatted via existing `formatHours()`, `delta`, `series`
3. **Revenue attributed** — `value: scorecard.revenueAttributed`, `formatMoney()`, `delta`, `series`. **Visible** — user explicitly confirmed therapist seeing their own revenue is in scope.
4. **Personal utilisation** — `<KpiTile>` swapped for `<ScorecardRing>` (different primitive: ring + centre value). `value: scorecard.utilisation.rate * 100`, `target: 80`, `unit: '%'`. `hint: '{bookedHours}h of {availableHours}h available'`
5. **Personal retention** — `<KpiTile>` showing `value: scorecard.retention.rate * 100`, `unit: '%'`, `hint: '{retainedClients} of {totalClients} clients returned'`, `delta`
6. **Personal no-show rate** — `<KpiTile tone='invert'>` (smaller = better), `value: scorecard.noShowRate.rate * 100`, `unit: '%'`, `hint: '{noShows + cancelled} of {total} bookings'`, `delta`
7. **Clients touched** — `value: scorecard.clientsTouched`, `delta`, `series: monthlyClientsTouchedSeries`
8. **Same-gender fulfilled** — `value: scorecard.sameGenderFulfilled`, `hint: 'requested + delivered'`. Clinically relevant for Rahma's modesty-conscious clients.

#### Coordinator tiles (5)
1. **Enquiries handled** — `value: enquiriesContactedCount`, `delta`, `series`
2. **Conversion rate** — `value: enquiryConversionRate * 100`, `unit: '%'`, `hint: '{conversions} of {handled} enquiries became bookings'`, `delta`
3. **Avg time-to-first-contact** — `value: avgMinutesToFirstContact`, `unit: 'min'`, `tone: 'invert'` (smaller = better), `hint: 'across {enquiriesCount} enquiries'`, `delta`
4. **Bookings assigned** — `value: bookingsAssignedCount`, `delta`, `series`
5. **Operational events resolved** — `value: opsEventsResolvedCount`, `delta`

#### Admin / Owner-who-treats tiles (Union: 13 — too many for one screen)
- Show all Therapist tiles + all Coordinator tiles in a single grid, but **stack into two `<details>` sections** if the union exceeds 8 visible tiles. Default visible: top 6 by relevance ("Clinical: Completed sessions, Hours, Revenue, Utilisation" + "Admin: Enquiries handled, Conversion rate"). Click "Show all my metrics" to expand the remainder. Persistent via `?show=all` URL param.

#### Owner-who-doesn't-treat tiles (5)
- Coordinator-style admin tiles only. "Enquiries handled" may be 0 if Owner doesn't directly handle enquiries; the page renders the zero rather than hiding the tile (the absence is informative).
- Plus a sixth tile: **"Business net revenue this period"** — pulled from `summarizeReports(data).collectedRevenue`. Owner's "personal contribution" is the business itself.

### 5.3 Personal trend chart (always)

Below the tile grid. `<TrendTile>` full-width on mobile, 2/3-width on desktop with the activity timeline taking the remaining 1/3.

- Therapist: line chart of **"My completed sessions" over the period** (weekly buckets).
- Coordinator: line chart of **"Enquiries handled per week"**.
- Admin / Owner: stacked area of both (Sessions completed + Enquiries handled), legend below.

Uses `<LineChart>` or `<StackedBarChart>` from B-1.

### 5.4 Activity timeline (always)

Right column on desktop (1/3 width), full-width on mobile below the trend chart.

`<ActivityTimeline staffId={profile.id} limit={20}>`. Composition:
- Header: "Recent activity" H3 Work Sans 600 + count badge.
- Rows: vertical list, 20 max. Each row:
  - Relative timestamp (Work Sans 400 0.625rem Soft Slate): "12 min ago"
  - Icon (16px from existing `icon-for-action-type` helper or one we add): semantic per action family
  - Description: humanised audit-log message: "You marked booking #1234 confirmed", "You contacted enquiry from Sarah Iqbal", "You blocked your availability for 14 May"
  - Optional deep-link: target row (booking / enquiry / staff) when the audit-log target_type points somewhere user can navigate
- Empty state: "No activity in this window yet. Recent actions will appear here." (under the period selector — if `range=today` and timeline is empty, this is normal at the start of a day).
- Footer: "View full audit timeline →" Ghost link → `/admin/audit?actor={staffId}` (only when `viewer` has `manage_audit_logs` permission; else hidden).

### 5.5 My upcoming work (Therapist + Coordinator only)

Bottom section. Single panel.
- Therapist: "My next 5 assignments" — list of upcoming `booking_assignments` where `assigned_staff_id = profile.id`, ordered by date. Each row: avatar + client name + service + date + time. Tap → booking detail.
- Coordinator: "Enquiries needing my follow-up" — list of `enquiries` where `status='contacted'` AND `last_touched_by = profile.id` (proxy: existing schema may not have last_touched_by; use `status='contacted'` filtered to recent if unavailable). Each row: name + source + age. Tap → enquiry detail.
- Admin / Owner: hidden (no obvious "my upcoming work" because they don't have personal assignments by default).

### 5.6 Mobile rhythm (<768px)

Single column throughout:
1. Header (period chips horizontal-scroll on overflow)
2. Tile grid (1 column, full-width tiles)
3. Trend chart (full-width)
4. Activity timeline (full-width below chart)
5. My upcoming work (full-width)

Sticky bottom action bar (NEW for this surface):
- For Therapist: "Go to my next visit" → links to next assignment's booking detail (when one exists; hidden when empty).
- For Coordinator: "Open enquiries" → `/admin/enquiries?tab=new`.
- For Admin / Owner: hidden (no clear single-action context).

### 5.7 Desktop rhythm (≥1280px)

```
┌────────────────────────────────────────────────┐
│ Header (greeting · period · "View in Reports") │
├────────────────────────────────────────────────┤
│ KPI tile grid (auto-fill, ~4 across)           │
├──────────────────────────┬─────────────────────┤
│ Trend chart              │ Activity timeline   │
│ (2/3 width)              │ (1/3 width)         │
├──────────────────────────┴─────────────────────┤
│ My upcoming work (full-width)                  │
└────────────────────────────────────────────────┘
```

## 6. Key States

| State | What the user sees |
|---|---|
| Therapist, signed in, mid-month populated DB | Header + 8 tiles (all populated, deltas visible) + line chart populated + activity timeline with ~10 rows + 5 upcoming assignments. Page fits in 1.5 viewports at 1440×900. |
| Therapist, brand-new (first week, sparse data) | Header + tiles showing real-zero values (no fake "—") + chart showing 1–2 points + timeline showing recent sign-in + maybe 1 upcoming assignment. Empty-state copy on the upcoming-work panel: "No assignments yet — check the claimable queue." with a `/admin/bookings?view=claimable` CTA. |
| Coordinator, first paint | Header + 5 tiles (Enquiries / Conversion / Response time / Bookings assigned / Ops resolved) + trend chart "Enquiries handled per week" + timeline + "Enquiries needing follow-up" panel. |
| Owner viewing own page (`/admin/me`) | Header + Owner-who-treats tile set OR Owner-who-doesn't-treat set depending on whether they have assignments in the period. Decision rule: if `getStaffScorecard(data, profile.id).assignmentsTotal > 0` then treat as Owner-who-treats; else as Owner-who-doesn't-treat. |
| Owner viewing a Therapist's sub-route (`/admin/staff/123/performance`) | Same component, manager-view chrome. "Performance — Aisha Hassan" heading. "Reviewing Therapist · Last sign-in 2h ago" sub-line. All tiles + timeline + upcoming visible. Manager has the "View full audit timeline →" link enabled. |
| Therapist trying to view another Therapist's tab | `AdminAccessDenied` with copy "This area is private to that staff member and senior management." No raw permission identifier leaked. |
| Inactive staff trying to reach `/admin/me` | Middleware blocks; redirected to `/admin/login?reason=inactive`. Never renders. |
| **Owner / Admin / PM viewing an inactive Therapist's `/admin/staff/[staffId]/performance`** (NEW per AUDIT-2026-05-22 G5) | Page renders the historical scorecard data. Header sub-line gains a discreet "Inactive since {date}" pill (Restricted family). Activity timeline shows historical actions. Upcoming-work panel is empty (no future assignments for inactive staff). "View full audit timeline →" still works if viewer has the permission. |
| Range = `today` and timeline empty | "No activity today yet. Recent actions will appear here." Empty-state inside the timeline panel. |
| Range = `lifetime` | Delta chips on every tile hidden (no prior-period for lifetime). `<DeltaChip>` returns null when value undefined. |
| Data fetch error in any section | Per-section `<AdminPanel error>` with `role="alert" aria-live="polite"`. Other sections render normally. |
| Tile with target ring (utilisation) at < 75% | `<ScorecardRing>` renders Attention family colour. Hint: "Below target — review your bookings". (Non-judgemental copy; no shaming.) |
| Tile with target ring at ≥ 80% | Confirmed family colour. Hint: "On target — keep going." |
| `prefers-reduced-motion: reduce` | Count-up animations instant; ring fills instant; shimmer skeleton becomes static. |
| Mobile 375 | Single column, tiles stack, sticky bottom action bar visible. |
| Slow connection / first paint | `AdminSkeleton` shimmer for tile grid (8 tile-shaped placeholders), then chart skeleton, then timeline skeleton. |

## 7. Interaction Model

- **Period chip click** — submits via GET form (`?range=`). URL changes, page re-renders. `aria-current="page"` on active chip.
- **Tile click (when href set)** — drills into the relevant deeper page. Examples:
  - "Completed sessions" → `/admin/bookings?view=completed&staffId={profile.id}&range={range}` (Therapist's own completed bookings)
  - "Hours worked" → no href (informational only — no deeper page to drill to)
  - "Revenue attributed" → `/admin/reports?scope=personal&staffId={profile.id}&range={range}` (manager view) OR own report (self view)
  - "Enquiries handled" → `/admin/enquiries?actor={profile.id}` (if such filter exists; else `/admin/enquiries` plain)
- **Trend chart hover** — Recharts tooltip showing date + value.
- **Activity timeline row click** — navigates to the row's target if linkable; else non-interactive.
- **"View in Reports" Ghost link** — `/admin/reports?staffId={profile.id}&scope=personal&range={range}` — opens the macro page narrowed to me.
- **"My Performance" nav link** — always → `/admin/me`, regardless of which route is current. Persistent in `AdminTopNav`.
- **"View full audit timeline →"** — only when `viewer.permissions.includes('manage_audit_logs')`.
- **Sticky bottom action bar (mobile, Therapist + Coordinator)** — "Go to next visit" / "Open enquiries". Active when relevant data exists; hidden otherwise.
- **Keyboard order**: header → period chips → tile grid in document order → trend chart (focusable for screen-reader announce) → activity timeline rows → upcoming work rows → sticky action button (mobile).
- **`prefers-reduced-motion`** honoured throughout: no count-ups, no ring animations, no chart entry animations.

## 8. Content Requirements

**Headings.**
- H1 (self mode): "Good morning, {firstName}." / "Good afternoon, {firstName}." / "Good evening, {firstName}."
- H1 (manager mode): "Performance — {staffName}"
- Section H2: "Recent activity", "My upcoming work" (Therapist), "Enquiries needing my follow-up" (Coordinator)
- H3 in tiles: tile labels ("Completed sessions", "Hours worked", etc.)

**Empty-state copy.**

| Section / tile | Heading | Body |
|---|---|---|
| Tile, zero value, valid metric (e.g. 0 hours worked) | (no special heading — value renders as 0 with tabular-nums) | (no body — the absence is the data) |
| Personal utilisation, no availability rules set | "Set your availability" | "Add weekly hours to see your utilisation rate." CTA: "Set availability" → `/admin/staff/{id}?tab=availability` (self) |
| Personal retention, only 1 visit per client | "Building your base" | "Retention rate shows once clients return for a second visit." |
| Activity timeline, no actions in window | "No activity in this {range}" | "Recent actions will appear here as you work." |
| My upcoming work (Therapist), nothing scheduled | "Nothing scheduled" | "Browse claimable work to fill your day." CTA: "Browse claimable work" → `/admin/bookings?view=claimable` |
| Enquiries needing follow-up (Coordinator), nothing pending | "All caught up" | "New enquiries will land in the inbox." CTA: "Open enquiries" → `/admin/enquiries` |
| Trend chart, <2 data points | "Trend appears soon" | "Once you've worked for at least 2 periods, the trend appears here." |

**Microcopy.**
- Period chip labels: `Today` · `This week` · `This month` · `This quarter` · `Custom`
- Range helper line (subtle, below chips): "This week: 11–17 May 2026"
- Tile delta chip: "+12% vs prior week" / "−4% vs prior week" / "→ same as prior" (zero state)
- Utilisation tile hint: "{bookedHours}h of {availableHours}h available"
- Retention tile hint: "{retainedClients} of {totalClients} clients returned"
- No-show tile hint: "{noShows + cancelled} of {total} bookings"
- Time-to-first-contact hint: "across {enquiriesCount} enquiries this {period}"
- "View in Reports" Ghost label: "View in Reports →"
- "My Performance" nav label: "My Performance"
- Sticky action bar labels: "Go to my next visit" (Therapist), "Open enquiries" (Coordinator)

**Voice anchors hit.** Personal pronouns ("My Performance", "Your day is clear"); verbs over nouns ("Browse claimable work"); real numbers ("18 sessions, 22 hours" not "metric_sessions: 18"); state-word discipline on no-show ("3 of 24 bookings" not "12% loss"); empty states encouraging not preaching ("Building your base" not "Insufficient data").

## 9. Recommended References

- **`reference/spatial-design.md`** — single-column mobile rhythm + the 2/3 + 1/3 desktop split for chart + timeline
- **`reference/interaction-design.md`** — period-chip GET form pattern (matches Dashboard / Reports)
- **`reference/copywriting.md`** — empty-state and microcopy pass at the end of B-3 implementation
- **DESIGN.md §5 (AdminPanel, AdminEntityRow)** — the activity timeline row composition
- **PRODUCT.md Voice Anchors** — personal pronouns, verbs over nouns
- **B-1 brief** — every tile, ring, chart, sparkline, delta chip from this surface comes from B-1
- **B-2 brief** — every number on this surface comes from a B-2 helper (`getStaffScorecard`, `getReportData`, derived counts)

## 10. Open Questions

1. **`/admin/me` redirect vs canonical?** ~~Original recommendation conflated "first paint" with server-component reality.~~ **RESOLVED per AUDIT H7:** server-side `redirect('/admin/me')` always fires in `/admin/staff/[staffId]/performance/page.tsx` when `viewer.id === target.id`, regardless of navigation source. There is no "first paint vs subsequent" distinction in server components — every render is server-side. Simpler: the self-page is canonical at `/admin/me`; the sub-route forwards.
2. **Coordinator "last_touched_by" data** — the Enquiries-needing-follow-up panel needs to know which Coordinator last touched an enquiry. Schema may not have this. **Fallback:** if absent, the panel shows generic "enquiries with status=contacted" (cross-coordinator). Phase 7 candidate to add the column.
3. **Owner with no activity** — does Owner who literally never logs in see a sad empty page, or do we hide tiles with all-zero values? **Recommendation:** show them (the zero IS the information). Don't fake activity.
4. **Tile order per role** — current ordering is brief author's intuition (most-cited first). **Recommendation:** ship as proposed; Phase 7 can A/B if needed.
5. **The "Show all my metrics" expansion for Admin/Owner-who-treats** — should it persist via `localStorage`, URL param, or both? **Recommendation:** URL param `?show=all` only (matches `?todayView=` URL-driven pattern already used on Dashboard).
6. **Tooltip definitions for ring tiles** — when does utilisation count as "on target"? Default 80% from industry benchmark, but it's worth surfacing the why. **Recommendation:** native `title` on the ring: "Industry target is 80% — sessions delivered divided by hours available."
7. **Audit timeline scoping for self-view** — should a Therapist see *all* their actions or only the ones they'd recognise as a user action (excluding system-generated rows where actor=them)? **Recommendation:** show all rows where `actor_staff_id = self`. If noise is excessive, Phase 7 can add a category filter.

---

## Recipe Context

### Files to create

| File | Purpose |
|---|---|
| `src/app/admin/me/page.tsx` | Self-view route. ~80 lines. Resolves signed-in profile, fetches scorecard + audit log + upcoming work, renders `<PerformanceSurface mode="self" />`. |
| `src/app/admin/staff/[staffId]/performance/page.tsx` | Sub-route page (~80 lines; mirrors `/admin/me/page.tsx` shape; renders `<PerformanceSurface mode="manager" />`). Per AUDIT-2026-05-22 H1, this is a sub-route NOT a query-param tab. |
| `src/app/admin/components/PerformanceSurface.tsx` | Shared component (~350 lines). Renders header + tile grid + trend chart + timeline + upcoming. Role-aware via `tilesForRole(profile.role)`. |
| `src/app/admin/components/ActivityTimeline.tsx` | Audit-log timeline (~100 lines). Server component. Reads `audit_logs` via existing repository helper. |
| `src/app/admin/components/PerformanceHeader.tsx` | Page header with greeting / role pill / period selector. ~80 lines. |
| `src/app/admin/components/performance-helpers.ts` | Pure helpers: `tilesForRole(role)`, `humanizeAuditAction(action)`, `iconForActionType(actionType)`. ~150 lines. |
| `src/app/admin/components/__tests__/performance-helpers.test.ts` | Vitest specs for pure helpers. |
| `src/app/admin/me/__tests__/page.test.tsx` | Smoke test for self-view route. |

### Files to modify

| File | Change |
|---|---|
| `src/app/admin/staff/[staffId]/StaffDetailShortcuts.tsx` | Add a "Performance" Ghost link alongside the existing "Availability" link. Routes to `/admin/staff/{staffId}/performance`. |
| `src/app/admin/components/AdminTopNav.tsx` (or wherever the primary nav lives) | Add "My Performance" link. Position: in the user-menu region near sign-out / profile. Visible to every active staff member. |
| `src/app/admin/components/admin-ui.tsx` | (Possibly) export an `AdminTabBar` if a shared tab primitive doesn't exist yet for the staff detail page's tab strip. Surgical addition only. |

### Files to NEVER touch

- `src/app/admin/reports/reporting.ts` — owned by B-2 (helpers added there in B-2; B-3 only consumes)
- `src/app/admin/dashboard/dashboard-data.ts` — RECON §5 untouchable
- `src/lib/auth/**` — RBAC matrix preserved
- `src/lib/supabase/**` — client factories
- `src/middleware.ts` — `/admin/me` is implicitly covered by existing `/admin/*` matcher
- `supabase/migrations/**` — no schema changes in B-3
- All build/config files
- `src/app/admin/components/notification-*.{ts,tsx}` — R4 surface

### Feature Preservation Manifest

**Routes added (not modified):**
- `/admin/me` is wholly new; no route conflict.
- `/admin/staff/[staffId]/performance` adds one tab; existing tabs untouched.

**Permission gates:**
- `/admin/me` requires `profile.active === true`. No new permission.
- `/admin/staff/[staffId]/performance` reuses `getAdminPageAccess(viewer, "staff")` for the manager-view gate. New constant: `MANAGER_CAN_VIEW_OWN_PERFORMANCE_OF_ROLES = ['therapist', 'coordinator', 'admin', 'owner', 'inactive']` — Owner/Admin/PM can view everyone; Coordinator can view nothing (their RBAC already excludes staff detail per existing gate); Therapist denied as documented.
- "View full audit timeline →" link gated on `manage_audit_logs` (Owner-only by existing convention).

**JS hooks / IDs to preserve:**
- `id="admin-main"` skip-link target preserved at layout level
- `id="admin-command-search"` — cmd-K target in `AdminTopNav` (unchanged)
- No new IDs needed beyond what `PerformanceSurface` introduces internally

**Server actions:** none from this page (read-only surface).

**Audit log writes:** none from this page (viewing performance is not itself an audit event).

**External / deep links to preserve:**
- "View in Reports" → `/admin/reports?staffId={id}&scope=personal&range={range}` — depends on B-4's reports brief honouring the `scope=personal` URL param
- "Go to next visit" sticky action → `/admin/bookings/{id}` (existing route)
- "Browse claimable work" empty-state CTA → `/admin/bookings?view=claimable` (existing route)
- "Set availability" empty-state CTA → `/admin/staff/{id}?tab=availability` (existing route)

### Information hierarchy (top to bottom)

1. Page identity + period
2. KPI tile grid (role-aware)
3. Trend chart
4. Activity timeline (right rail on desktop; below chart on mobile)
5. My upcoming work (when applicable)

### Design direction — tokens and components

- **Header H1 self mode:** Cormorant Garamond 600, title step, Chronicle
- **Header H1 manager mode:** Urbanist 600, title step, Chronicle (no Cormorant — this is operational, not personal)
- **Sub-line:** Work Sans 400, body step, Soft Slate
- **Role pill:** Restricted family (`oklch(...)` per DESIGN.md §5 Restricted Status family)
- **Period chips:** mirror Dashboard's date-preset chips verbatim
- **Tile grid:** CSS grid `auto-fill` `minmax(220px, 1fr)` `gap-4`. Equal `min-h-[14rem]` across tiles.
- **`<ScorecardRing>`:** 120px ring, 8px stroke, Confirmed/Pending/Attention family fill based on `value vs target`
- **Trend chart:** `<LineChart>` from B-1, `minHeight: 280px`
- **Activity timeline rows:** `border-b border-[var(--admin-border-subtle)]/40`, 12px vertical padding, last row no border
- **Timeline icons:** lucide 16px, semantic per family — `Calendar` for booking, `MessageCircle` for enquiry, `Clock` for availability, `AlertCircle` for ops event
- **Upcoming-work panel:** `AdminEntityRow` reuse (avatar + primary line + secondary line + chevron) per DESIGN.md
- **Sticky mobile action bar:** `fixed bottom-0 inset-x-0 z-40 bg-[var(--admin-panel)] border-t border-[var(--admin-border)] p-3` — full-width Primary button inside, safe-area-padding bottom

---

## Implementation Notes

**Per-state intent** lives in §6.
**Per-viewport intent** lives in §5.6 (mobile) and §5.7 (desktop).

**Verification steps** (for B-3's plan step "Verification gate"):
- `pnpm lint` clean
- `npx tsc --noEmit` clean
- Vitest: new helper specs pass; baseline preserved
- Playwright role sweep: sign in as Owner, Admin, Coordinator, Therapist (skip Inactive — page never renders); navigate to `/admin/me`; assert correct tile set rendered per role; navigate to `/admin/staff/{staffId}/performance`; assert manager-view chrome
- Screenshot at 375 / 768 / 1280 for each role: confirm layout per §5
- Edge case: sign in as Therapist, navigate to `/admin/staff/{otherTherapistId}/performance`, assert `AdminAccessDenied` (not data leak)

---

## Copy

### Form labels

| Slot | Text |
|---|---|
| Period chip group | (sr-only `Period`) |
| Period chips | `Today` / `This week` / `This month` / `This quarter` / `Custom` |
| Custom period inputs | `From` / `To` |

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Period chips | (as above) | Pill |
| "View in Reports" | `View in Reports →` | Ghost |
| Activity timeline footer | `View full audit timeline →` | Ghost (gated on `manage_audit_logs`) |
| Mobile sticky action (Therapist) | `Go to my next visit` | Primary |
| Mobile sticky action (Coordinator) | `Open enquiries` | Primary |
| Upcoming-work empty-state CTAs | `Browse claimable work` / `Open enquiries` / `Set availability` | Primary / Secondary as appropriate |

### Error messages

| Slot | Text |
|---|---|
| Tile data load failure | `Couldn't load this section. Try refreshing.` |
| Activity timeline data load failure | `Couldn't load recent activity. Try refreshing.` |
| Upcoming work data load failure | `Couldn't load upcoming work. Try refreshing.` |
| Therapist denied at `/admin/staff/[staffId]/performance` | `This area is private to that staff member and senior management.` |
| Inactive staff hit `/admin/me` | (middleware redirects; page never renders) |
| Custom date range invalid | `End date must be on or after start date.` |

### Empty-state text

| Section / tile | Heading | Body | CTA |
|---|---|---|---|
| All tiles, zero values valid | (numeral renders as 0) | (no body) | — |
| Personal utilisation, no availability rules | `Set your availability` | `Add weekly hours to see your utilisation rate.` | `Set availability` |
| Personal retention, <2 visits per client | `Building your base` | `Retention rate shows once clients return for a second visit.` | — |
| Activity timeline, empty | `No activity in this {range}` | `Recent actions will appear here as you work.` | — |
| My upcoming work (Therapist), empty | `Nothing scheduled` | `Browse claimable work to fill your day.` | `Browse claimable work` |
| Enquiries needing follow-up (Coordinator), empty | `All caught up` | `New enquiries will land in the inbox.` | `Open enquiries` |
| Trend chart, <2 data points | `Trend appears soon` | `Once you've worked for at least 2 periods, the trend appears here.` | — |

### Tooltip text

| Slot | Text |
|---|---|
| Utilisation ring `title` | `Industry target is 80% — sessions delivered divided by hours available. You're at {value}%.` |
| Retention ring `title` | `{retainedClients} of {totalClients} clients returned for a second visit.` |
| Delta chip `title` | `{value}% vs the prior {period}` |
| Activity row timestamp | absolute timestamp (e.g. `Tue 12 May 2026, 14:23`) |

### Confirmation dialog text

None — page is read-only.

---

*End of B-3 brief. Next: B-4 brief (Reports rebuild) — second UI surface, the macro mirror with drill-in.*
