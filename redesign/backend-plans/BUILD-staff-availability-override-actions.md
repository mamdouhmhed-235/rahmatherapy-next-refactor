# Staff Availability — Override Server Actions — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** YES
**Triggered by:** staff-availability-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `staff-availability`

## What this is
Two new server actions — `addStaffAvailabilityOverride` and `deleteStaffAvailabilityOverride` — that write to and delete from `staff_availability_overrides` for a specific staff member.

## Why it's needed
Surface (c) of the staff-availability brief (§4, §5) is the Availability overrides manager: a net-new inline add/delete editor for `staff_availability_overrides`. The table feeds the booking engine but currently has no UI. Without these actions, the "Add override" button and the `trash-2` delete button have no server-side handler.

## What it does (user story)
"As a Therapist, I want to extend my Saturday to 8pm for a busy weekend campaign without affecting my regular weekly hours, so the booking engine offers the right slots for that day only."

## What information it stores or retrieves
`addStaffAvailabilityOverride`: accepts `staff_id` (hidden), `date`, `start_time`, `end_time`, `reason` (optional). Validates: `date >= today`, `start_time < end_time`, no existing override for this `(staff_id, date)` (conflict check). Inserts row. Writes audit log row `availability_override_upserted` (reusing the existing audit action type from RECON §6.2).

`deleteStaffAvailabilityOverride`: accepts `override_id`. Verifies the row belongs to a staff_id the caller has permission to manage. Deletes the row. Writes audit log row `availability_override_deleted` (existing type from RECON §6.2).

Permission check (both actions): `manage_availability_global` OR (`isOwnProfile(caller, staff_id)` AND `manage_availability_own`). Identical pattern to the blocked-dates actions.

## Who can use it
Owner and Admin/PM for any staff member. Therapist for own profile only. Coordinator denied.

## What can go wrong
- **`start_time >= end_time`:** return `{ error: "invalid_time_range" }` so the UI shows "End time has to be after start time."
- **Conflict with existing override on same date:** return `{ error: "override_exists" }` so the UI shows "That date already has an adjustment. Delete the existing one first."
- **Override on a non-working day:** if `date` falls on a day the `staff_availability_rules` marks as closed, the booking engine would still not offer slots (the weekly rule is the floor). Surface a soft warning `{ warning: "non_working_day" }` — allow the override to be saved (operator may be changing that day's rule separately) but surface the warning in the UI.
- **`staff_id` spoofed by Therapist:** same ownership-check pattern as `addStaffBlockedDate`.
- **`deleteStaffAvailabilityOverride` called on another staff member's row:** re-read and verify ownership before deleting. Return 403 on mismatch.
- **Times outside clinic operating window:** `business_settings.minimum_notice_hours` and similar constraints don't apply here — overrides are for managing therapist hours, not customer-facing booking rules. No clinic-window validation is needed server-side for overrides.

## How to verify it works
1. Add an override for a future date with valid start/end → row in `staff_availability_overrides`; `availability_override_upserted` audit row written; override appears in the manager list.
2. Add an override for the same date a second time → returns `{ error: "override_exists" }`; UI shows the conflict error.
3. Add an override with `start_time >= end_time` → returns `{ error: "invalid_time_range" }`.
4. Therapist adds override for own staff_id → succeeds. Therapist spoofs another staff_id → 403.
5. Delete an override → row removed; `availability_override_deleted` audit row written.

## Safe implementation order
1. Add `addStaffAvailabilityOverride` and `deleteStaffAvailabilityOverride` stubs to the same file as the blocked-dates actions.
2. Implement permission check (same pattern as blocked-dates).
3. Implement `addStaffAvailabilityOverride`: time validation → conflict check → DB insert → audit write.
4. Implement `deleteStaffAvailabilityOverride`: ownership check → DB delete → audit write.
5. Wire to the `StaffAvailabilityOverridesManager` add-form and per-row delete buttons.

## How to undo it if something breaks
Same as blocked-dates actions: stub returns `{ error: "not_implemented" }`; buttons fail gracefully; inserted rows deletable via Supabase Studio; no existing data modified.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
