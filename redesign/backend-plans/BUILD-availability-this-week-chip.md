# Availability — This-Week Closure/Override Chip Query — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** NO
**Triggered by:** availability-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `availability`

## What this is
A server-side query that checks whether any `blocked_dates` or `availability_overrides` rows fall within the current calendar week (Monday–Sunday, Europe/London), returning a count and the affected dates so the capacity preview panel can render an informational Pending-family chip.

## Why it's needed
The capacity preview (§5) shows a chip "1 closure this week" / "N adjustments this week" in the panel header when any clinic-wide blocked date or override is active in the current week. Without this query the chip never renders and operators lose the at-a-glance signal that the week has unusual scheduling.

## What it does (user story)
"As an Owner reviewing this week's capacity, I want to see at a glance whether any clinic-wide closures or hour adjustments apply this week, so I can confirm the booking engine is reflecting the right hours before the week starts."

## What information it stores or retrieves
Reads from `blocked_dates` and `availability_overrides` where `blocked_date` / `override_date` falls between the Monday and Sunday of the current Europe/London week. Returns `{ closureCount: number, overrideCount: number, closureDates: string[], overrideDates: string[] }`.

## Who can use it
Called server-side from `/admin/availability/page.tsx` during the initial page render. Access is gated on `manage_availability_global` at the page level.

## What can go wrong
- **Timezone boundary mismatch:** the week boundary must be computed in Europe/London time, not UTC. A closure on Sunday evening UTC may fall in the following week in London time. Use the existing `lib/time/london` helpers (untouchable) or compute the Monday/Sunday boundaries server-side using the established timezone utilities.
- **Empty tables:** if `blocked_dates` and `availability_overrides` are both empty, returns `{ closureCount: 0, overrideCount: 0, ... }` — chip should not render, not crash.
- **DST edge:** the last Sunday of October and the last Sunday of March can produce unexpected week boundaries. Use a well-tested date library (e.g. `date-fns-tz`) rather than raw UTC arithmetic.

## How to verify it works
1. Insert a `blocked_date` for today → capacity preview shows "1 closure this week" chip.
2. Insert a `blocked_date` for last Monday → chip does not render (past week).
3. Insert an `availability_override` for next Sunday (same calendar week) → chip shows "1 adjustment this week".

## Safe implementation order
1. Write the query function in `src/app/admin/availability/queries.ts` that computes current week Monday/Sunday in Europe/London and runs the two SELECT COUNT queries.
2. Wire the return value into `page.tsx` and pass it as a prop to the capacity-preview component.
3. Implement the chip render in the component (Pending family, `calendar` Lucide icon, count-aware copy).

## How to undo it if something breaks
Additive function + prop. To undo: remove the query call from `page.tsx` and remove the chip render from the component. No data change.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
