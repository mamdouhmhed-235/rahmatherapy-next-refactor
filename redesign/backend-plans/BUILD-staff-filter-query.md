# Staff Directory — Filterable Query — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** YES
**Triggered by:** staff-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `staff`

## What this is
A new server-side query for `/admin/staff` that accepts `q`, `roleId`, `gender`, `status`, `workload`, `bookable`, and `onboarding` GET filter params, producing a filtered, scope-aware staff list.

## Why it's needed
The staff brief (§5, §7) adds a filter strip and workload-strip cross-links (`?workload=zero`, `?onboarding=incomplete`, `?roleId=<id>`) that also serve as the cross-link target from the roles list (Brief 20). The current `/admin/staff` page has no GET params. Without filterable queries, the strip cross-links do nothing and the filter strip is non-functional.

## What it does (user story)
"As an Owner, I want to click 'Onboarding incomplete: 2' on the staff directory and immediately see only the two staff members who haven't finished setup, so I can reach out to them without manually scanning the full list."

## What information it stores or retrieves
Reads from `staff_profiles` joined with `roles` (for `roleId` filter and role display) and `booking_assignments` (for workload counts: upcoming bookings in the next 7 days). Scope filtering via the existing `getStaffTeamAccess` helper (admin / assignment / same_gender_team) is applied first.

Filter params:
- `q` — ILIKE on `staff_profiles.name` and `auth.users.email`
- `roleId` — exact match on `staff_profiles.role_id`
- `gender` — exact match on `staff_profiles.gender` (admin scope only)
- `status` — `active=true/false` (admin scope only)
- `workload` — `zero` maps to `upcoming_count = 0` (requires booking_assignments join)
- `bookable` — `true` maps to `can_take_bookings = true AND active = true`
- `onboarding` — `incomplete` maps to `getStaffProfileCompletion(staff) < 6` (computed client-side from the already-fetched completion data, or a server-side join if the completion logic is simple enough)

## Who can use it
Scope-aware — respects `getStaffTeamAccess` for the calling profile. Admin sees all params; Coordinator sees `q` and `roleId` only; Therapist sees `q` only.

## What can go wrong
- **`workload` filter requires a booking_assignments join:** this adds a LEFT JOIN with a subquery (`SELECT staff_id, COUNT(*) WHERE booking_date >= today`). On a large DB this can be slow. Use a materialized view or limit the join to active staff only.
- **`onboarding=incomplete` filter is complex:** `getStaffProfileCompletion` is in `src/app/admin/staff/profile-access.ts` which is untouchable. The server query can't call a TypeScript function. Replicate the completion logic as a SQL expression or apply the filter client-side after fetching all staff (acceptable for small team sizes ≤ 20).
- **`roleId` cross-link from Brief 20 passes an invalid UUID:** validate UUID format before passing to WHERE clause.
- **Gender and status filters used by Coordinator:** the query must silently ignore `gender` and `status` params for Coordinator scope — never return results outside the scope.

## How to verify it works
1. Apply `?roleId=<coordinator-role-id>` → only staff with the Coordinator role appear.
2. Apply `?workload=zero` → only staff with zero upcoming bookings appear.
3. Apply `?q=aisha` → staff members with "aisha" in their name or email appear.
4. Sign in as Therapist, apply `?gender=male` → `gender` filter ignored; only same-gender team rows return.

## Safe implementation order
1. Write `src/app/admin/staff/queries.ts` with `getFilteredStaff(filters, teamAccess)`. Start with `q` and `roleId` filters.
2. Add `gender` and `status` filters (admin scope only).
3. Add `bookable` filter.
4. Add `workload=zero` filter via booking_assignments subquery.
5. Add `onboarding=incomplete` — evaluate whether to do server-side SQL or client-side post-filter. Start client-side.
6. Wire into `page.tsx` to replace the current unfiltered staff list query.

## How to undo it if something breaks
Additive query function. Reverting `page.tsx` to the previous unfiltered staff list query restores old behaviour. No schema changes.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
