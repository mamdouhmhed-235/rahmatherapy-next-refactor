# Settings — Last-Changed-By Audit Query — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** NO
**Triggered by:** settings-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `settings`

## What this is
A targeted server-side query that fetches the most recent `business_settings_updated` row from `audit_logs` and joins it with `staff_profiles` to surface "Last changed by Fatimah on 10 May" in the intake switch panel.

## Why it's needed
The settings brief (§5, §6) specifies a "Last changed by {actor} on {date, time}" sub-line in the Customer booking intake panel. Novice operators (PRODUCT.md Fatimah) frequently open Settings to check whether they already made a change — the sub-line answers "yes, you changed it 10 minutes ago" without requiring them to cross-reference the audit log.

## What it does (user story)
"As an Owner, I want to see who last changed the intake switch and when, so I know whether to worry or trust that it's already set correctly."

## What information it stores or retrieves
Reads one row: `SELECT al.created_at, al.actor_staff_id, sp.name AS actor_name FROM audit_logs al JOIN staff_profiles sp ON sp.id = al.actor_staff_id WHERE al.action_type = 'business_settings_updated' ORDER BY al.created_at DESC LIMIT 1`. Returns `{ actorName: string, changedAt: string } | null` (null when no audit row exists — brief specifies "if no audit row, omit").

## Who can use it
Called server-side from `/admin/settings/page.tsx`. Gate is `manage_settings` (Owner only) at the page level.

## What can go wrong
- **`audit_logs` has no `business_settings_updated` row (fresh install):** return `null`; UI omits the sub-line. This is the expected state on first launch.
- **JOIN with deleted staff member:** if the actor was deleted from `staff_profiles`, the JOIN returns no row. Use a LEFT JOIN and fall back to `"a staff member"` as the display name when `actor_name` is null.
- **Query slow on large `audit_logs`:** the query uses `WHERE action_type = 'business_settings_updated' ORDER BY created_at DESC LIMIT 1`. An index on `(action_type, created_at DESC)` makes this instant. Confirm the index exists or add it.

## How to verify it works
1. Save settings as Owner → the intake panel sub-line reads "Last changed by {Owner name} on {today's date and time}."
2. Delete all `business_settings_updated` rows from `audit_logs` in dev → sub-line is absent, panel renders without it.
3. Delete the actor's `staff_profiles` row (edge case) → sub-line reads "Last changed by a staff member on {date}."

## Safe implementation order
1. Confirm or add an index on `audit_logs(action_type, created_at DESC)` in Supabase.
2. Write the query as a one-liner in `page.tsx` (or a small helper in `src/app/admin/settings/queries.ts`).
3. Pass the result as a prop to `SettingsForm` and render the sub-line conditionally beneath the intake switch.

## How to undo it if something breaks
Remove the query call from `page.tsx` and the prop from `SettingsForm`. The sub-line silently disappears. No data change.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
