# Staff Availability — Blocked Dates Server Actions — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** YES
**Triggered by:** staff-availability-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `staff-availability`

## What this is
Two new server actions — `addStaffBlockedDate` and `deleteStaffBlockedDate` — that write to and delete from `staff_blocked_dates` for a specific staff member, with the correct per-staff permission enforcement.

## Why it's needed
Surface (b) of the staff-availability brief (§4, §5) is the Blocked dates manager: a net-new inline add/delete editor for `staff_blocked_dates`. The table feeds the booking engine but currently has no UI. Without these actions, the "Add closure" button and the `trash-2` delete button are wired to nothing.

## What it does (user story)
"As an Owner, I want to block a specific date on a therapist's calendar so that no new bookings are accepted for that day while their existing schedule stays untouched."
"As a Therapist managing my own availability, I want to mark a personal day off without needing to call anyone."

## What information it stores or retrieves
`addStaffBlockedDate`: accepts `staff_id` (hidden field), `date`, `all_day` (boolean, default true), `reason` (optional). Validates: `date >= today` (past dates rejected); `date` not already in `staff_blocked_dates` for this `staff_id` (duplicate check). Inserts row. Writes audit log row `blocked_date_created` (uses `target_type = 'staff'`, `target_id = staff_id`).

`deleteStaffBlockedDate`: accepts `blocked_date_id`. Reads the row to verify it belongs to a `staff_id` the caller has permission to manage. Deletes the row. Writes audit log row `blocked_date_deleted`.

Permission check (both actions): `manage_availability_global` OR (`isOwnProfile(caller, staff_id)` AND `manage_availability_own`).

## Who can use it
Owner and Admin/PM (via `manage_availability_global`) for any staff member. Therapist (via `manage_availability_own`) for their own `staff_id` only. Coordinator: denied.

## What can go wrong
- **`staff_id` spoofed by a Therapist:** if a Therapist submits a `staff_id` that isn't their own, the action must reject it. The permission check must read `staff_id` from the form and compare to the caller's authenticated profile. Never trust the client's `staff_id` without verifying caller identity.
- **Duplicate blocked date:** two concurrent adds for the same `(staff_id, date)`. The DB UNIQUE constraint (if present) throws. Catch the constraint violation and return `{ error: "duplicate_date" }` so the UI shows "That date is already closed."
- **Date in the past:** return `{ error: "date_in_past" }` so the UI shows "Pick a date from today onwards."
- **`deleteStaffBlockedDate` called with an ID belonging to another staff member:** the action re-reads the row before deleting and verifies `staff_id` matches a staff member the caller has edit permission for. Return 403 on mismatch.
- **Audit log write fails after DB insert/delete:** primary operation succeeds; log the audit failure to Sentry but do not surface it to the user (do not roll back the data operation for an audit failure).

## How to verify it works
1. Add a blocked date for a therapist as Owner → row appears in `staff_blocked_dates`; `blocked_date_created` audit row written; date appears in the manager list.
2. Attempt to add the same date again → returns `{ error: "duplicate_date" }`; UI shows "That date is already closed."
3. Attempt to add a past date → returns `{ error: "date_in_past" }`; UI shows validation error.
4. Sign in as Therapist, add a blocked date for own staff_id → succeeds. Attempt to add for another staff_id by spoofing the hidden field → returns 403.
5. Delete a blocked date → row gone from DB; `blocked_date_deleted` audit row written.

## Safe implementation order
1. Create `src/app/admin/staff/[staffId]/availability/actions.ts` (or add to the existing actions file if it exists) with both stubs returning `{ error: "not_implemented" }`.
2. Implement permission check pattern (caller identity vs. staff_id vs. permission flag).
3. Implement `addStaffBlockedDate`: date validation → duplicate check → DB insert → audit write.
4. Implement `deleteStaffBlockedDate`: row ownership check → DB delete → audit write.
5. Wire both actions to the `StaffBlockedDatesManager` component add-form and per-row delete buttons.

## How to undo it if something breaks
Remove the server actions or return `{ error: "not_implemented" }`. The add and delete buttons fail gracefully (server error toast). Any rows already inserted can be deleted via Supabase Studio. No existing data is modified by these actions.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
