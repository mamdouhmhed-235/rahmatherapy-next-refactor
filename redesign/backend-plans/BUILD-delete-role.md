# Role-Detail — deleteRole Server Action — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** NO
**Triggered by:** role-detail-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `role-detail`

## What this is
A new server action `deleteRole(roleId)` added to `src/app/admin/roles/actions.ts` (the existing actions file, which is NOT in RECON §5's untouchable list for this specific action). The action permanently deletes a role that is not a system role and has zero staff assigned.

## Why it's needed
The role-detail brief (§5, §6) includes a "Delete role" Destructive button in the danger-zone panel. This button is only visible when `!is_system && staff_count === 0` but the action it fires doesn't exist. Without it the button renders dead.

## What it does (user story)
"As an Owner who created a test role during setup, I want to delete it cleanly once I've confirmed it has no staff assigned, so the roles list stays tidy."

## What information it stores or retrieves
Reads `roles` by `roleId` to verify `is_system = false` and `staff_count = 0` (via a COUNT of `staff_profiles` with this `role_id`). If both guards pass: deletes the role-permission grant rows for this role, then deletes the role row itself. Writes an `audit_logs` row with `action_type = 'role_deleted'`, `target_type = 'role'`, `target_id = roleId`, `before_state = { display_label, name, is_system, staff_count }`.

## Who can use it
Authenticated Owner only (`manage_role_templates`). The action must verify this permission at entry.

## What can go wrong
- **Staff assigned between UI check and server execution:** the UI only shows the Delete button when `staff_count = 0`, but a staff member could be assigned in a concurrent session between the UI render and the confirm. The server action must re-check `staff_count = 0` inside the action and return `{ error: "has_staff" }` if it's > 0.
- **System role deletion bypass:** the `is_system` check must run server-side regardless of what the client sends. Never trust the client's `is_system` value.
- **Orphaned permission-grant rows:** the role-permission join table rows for this role must be deleted before the role row to avoid FK constraint violations. Delete grants first, role second, in a transaction.
- **Audit row for a deleted role:** the `target_id` in `audit_logs` will point to a now-deleted role. This is expected and documented in Brief 11 (audit) — deleted targets show "Target row no longer exists."

## How to verify it works
1. Create a test role with zero staff. Call `deleteRole` → role absent from `/admin/roles`; `role_deleted` audit row exists.
2. Attempt to call `deleteRole` on a system role (e.g. Owner role) → returns `{ error: "is_system" }`; role unchanged in DB.
3. Assign a staff member to the test role; attempt `deleteRole` → returns `{ error: "has_staff" }`; role unchanged.

## Safe implementation order
1. Add `deleteRole(roleId)` stub to `src/app/admin/roles/actions.ts` returning `{ error: "not_implemented" }`.
2. Implement permission check (`manage_role_templates`).
3. Implement `is_system` guard (re-read from DB, do not trust params).
4. Implement `staff_count` guard (COUNT from `staff_profiles`).
5. Implement the deletion transaction (grants first, then role row).
6. Add audit log write.
7. Wire to the "Delete role" button in the danger-zone panel via `ConfirmActionModal`.

## How to undo it if something breaks
Removing the `deleteRole` function from `actions.ts` leaves the Delete button non-functional (no server action fires). The role data itself can only be restored from a DB backup if accidentally deleted. This is why the `is_system` and `staff_count` guards are the first thing implemented and tested.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
