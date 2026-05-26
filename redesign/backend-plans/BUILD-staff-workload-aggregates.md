# Staff Directory — Workload-at-a-Glance Aggregate Counts — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** NO
**Triggered by:** staff-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `staff`

## What this is
A server-side aggregate query that computes four counts for the "Workload at a glance" prose strip on the admin-scoped `/admin/staff` page: active staff count, bookable staff count, staff with zero upcoming assignments this week, and staff with incomplete onboarding.

## Why it's needed
The staff brief (§5, §7) adds a mini-strip "Active: 6 · Bookable: 5 · No assignments this week: 2 · Onboarding incomplete: 1." with each segment as a filter Ghost link. Without the aggregate query, the strip can't render accurate counts and all four cross-links are non-functional.

## What it does (user story)
"As an Owner, I want to glance at the staff directory header and immediately know how many people are bookable and who hasn't finished onboarding, so I can triage staffing gaps before checking each profile."

## What information it stores or retrieves
Four aggregate queries (can be run in parallel with `Promise.all`):
1. `activeCount` — `COUNT(*) FROM staff_profiles WHERE active = true`
2. `bookableCount` — `COUNT(*) FROM staff_profiles WHERE active = true AND can_take_bookings = true`
3. `zeroAssignmentsThisWeekCount` — `COUNT(*) FROM staff_profiles sp WHERE active = true AND NOT EXISTS (SELECT 1 FROM booking_assignments ba WHERE ba.staff_id = sp.id AND ba.booking_date >= week_start AND ba.booking_date <= week_end)`
4. `onboardingIncompleteCount` — computed from the completion data already fetched for the staff list (see BUILD-staff-filter-query.md); no separate query needed if the staff list already returns per-staff completion data.

All four scoped to admin-only (the strip only renders for admin scope per the brief §11).

## Who can use it
Admin scope only (`manage_staff_profiles` or equivalent admin-scope `getStaffTeamAccess`). Strip is hidden for Coordinator and Therapist.

## What can go wrong
- **Week boundaries use UTC instead of Europe/London:** the "this week" range for `zeroAssignmentsThisWeekCount` must match the Europe/London week (Monday–Sunday). Use the same timezone utilities as the availability page.
- **`onboardingIncompleteCount` requires per-staff completion data:** if the completion check is complex TypeScript logic (via `getStaffProfileCompletion` which is untouchable), it cannot be replicated as SQL. Compute this count client-side from the filtered staff list after it's fetched.
- **Four parallel queries vs. one query per page load:** these aggregate queries are cheap (staff team is ≤ 20 people). Run with `Promise.all`; total latency should be under 100ms.

## How to verify it works
1. Active count on the strip matches the count of active staff in Supabase Studio.
2. Deactivate a staff member → "Active:" count decrements immediately after page reload.
3. Remove all upcoming assignments from a staff member → "No assignments this week:" count increments.

## Safe implementation order
1. Implement `activeCount` and `bookableCount` as simple COUNT queries (fast, no join).
2. Implement `zeroAssignmentsThisWeekCount` with the NOT EXISTS subquery; verify timezone handling.
3. Compute `onboardingIncompleteCount` client-side from already-fetched staff completion data.
4. Render the prose strip with the four counts as Ghost filter links.

## How to undo it if something breaks
Remove the aggregate queries from `page.tsx` and hide the strip. No data change.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
