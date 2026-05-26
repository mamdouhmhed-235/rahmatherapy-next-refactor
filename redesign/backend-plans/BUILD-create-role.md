# Roles — createRole Server Action — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** NO
**Triggered by:** roles-brief.md, role-detail-brief.md (untouchable-backend list assumed it existed; Phase 6 agent for `roles` STUCK at Step 4 confirmed it does not)
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 7 follow-up for `roles`

## What this is
A new server action `createRole(prev, formData)` added to `src/app/admin/roles/actions.ts` (the existing actions file, which already hosts `updateRoleMetadata` + `toggleRolePermission`). The action inserts a new row into `roles` with the form-supplied metadata, after RBAC + uniqueness + name-format guards pass, and writes an `audit_logs` row of `action_type = 'role_created'` (already a declared action type at `src/app/admin/audit/format.ts:54`).

## Why it's needed
Both the existing `roles` page and the redesigned roles brief (§4, §7, §11) commit to a "Create role" Primary CTA opening an `AdminSheet` whose form posts to `createRole`. RECON §5/§6.1 listed `createRole` as untouchable-and-existing, but the function was never actually authored — `git log -S createRole src/` returns zero introducing commits. Without the BUILD, the redesigned button renders but no server action exists to receive the post, the form silently 404s on the next-action endpoint, and the AdminSheet stays open with no feedback. Phase 6 ships the UI behind a `data-redesign-fake="create-role"` graceful-degrade pattern (disabled button + tooltip "Create-role backend coming soon") until this BUILD lands.

## What it does (user story)
"As the Owner setting up a new staff function — say a senior therapist with elevated availability permissions — I want to create a new role with a clear display label and DB identifier so I can assign it to staff and grant it permissions on the detail page."

## What information it stores or retrieves
**Inserts** one row into `roles` with: `name` (lowercase + underscores; client + server validated against regex `^[a-z][a-z0-9_]*$`, max 60 chars), `display_label` (max 60 chars), `description` (nullable text), `sort_order` (integer 0–999; defaults to `MAX(sort_order) + 10` if not provided), `is_system = false` (server forces; never client-supplied), `active = true` (or whatever the form checkbox indicates).

**Uniqueness guard:** `name` must be unique across `roles`. Server checks before insert; returns `{ error: "A role with that DB name already exists." }` if collision.

**Writes** one row into `audit_logs` with `action_type = 'role_created'`, `target_type = 'roles'`, `target_id = <new role id>`, `before_state = null`, `after_state = { id, name, display_label, description, sort_order, is_system, active }`.

**Returns** `{ success: true, roleId: <new id> }` on success so the caller redirects to `/admin/roles/<new id>`, or `{ error: "<message>" }` on failure.

## Who can use it
Authenticated Owner only (`MANAGE_ROLE_TEMPLATES`). The action must verify this permission at entry via `requirePermission(PERMISSIONS.MANAGE_ROLE_TEMPLATES, supabase)` — same gate `updateRoleMetadata` and `toggleRolePermission` already use.

## What can go wrong
- **Client supplies `is_system = true`:** server must ignore client value and force `is_system = false`. Never trust the client. Only system-seeded roles can have `is_system = true`, and the UI provides no path to flip this.
- **Duplicate `name` race:** two operators submit different display labels with the same DB name simultaneously. The UNIQUE constraint on `roles.name` catches it; the server returns `{ error: "A role with that DB name already exists." }`. The redesigned AdminSheet keeps the form intact so the operator can edit the name and resubmit without re-entering everything.
- **Invalid `name` format (uppercase, spaces, dashes, leading digit):** server re-validates regex `^[a-z][a-z0-9_]*$`. Client validation already enforces this in the AdminSheet form per brief §10; server is the second line of defence.
- **Insert succeeds but audit-log insert fails:** the role exists in DB but is not audited. Wrap both inserts in a transaction; if the audit-log insert fails, roll back the role insert and return `{ error: "Couldn't write audit log. Try again." }`. This preserves the audit invariant from PRODUCT.md ("Auditable and reversible. Every mutation writes an audit log").
- **`sort_order` collision:** non-unique sort order is allowed (the list sorts stably by `(sort_order, name)`); not a failure mode. If unspecified, default to `MAX(sort_order) + 10` for predictable insertion at the end.

## How to verify it works
1. Sign in as Owner. Open `/admin/roles`. Click "Create role". Submit with `display_label = "Senior Therapist"`, `name = "senior_therapist"`, description blank, default sort_order, active checked → redirect to `/admin/roles/<new id>` arrives; Sonner Confirmed toast `Role "Senior Therapist" created. Add permissions next.` fires.
2. Confirm the new row in `roles` table has `is_system = false` regardless of any client manipulation; confirm the `audit_logs` row of `action_type = 'role_created'` exists with matching `target_id`.
3. Attempt to create a second role with `name = "senior_therapist"` → server returns `{ error: "A role with that DB name already exists." }`; AdminSheet stays open with form intact.
4. Attempt to create with `name = "Senior Therapist"` (uppercase + space) → client validation blocks; if bypassed, server returns `{ error: "DB role names use lowercase letters and underscores only. For example: senior_therapist." }`.
5. Attempt as Admin (non-Owner) account → `requirePermission` throws; action returns `{ error: "Insufficient permissions." }`.

## Safe implementation order
1. Add `createRole(prev, formData)` stub to `src/app/admin/roles/actions.ts` returning `{ error: "not_implemented" }`.
2. Implement permission check (`MANAGE_ROLE_TEMPLATES`) mirroring `updateRoleMetadata`'s structure.
3. Implement form-data parsing + server-side validation (regex on `name`, length caps on `display_label` + `description`, integer range on `sort_order`).
4. Implement uniqueness check on `roles.name`.
5. Implement the insert + audit-log write inside a transaction (preferred via `supabase.rpc('create_role_with_audit', ...)` OR a sequential pair with rollback on audit failure).
6. Add `revalidatePath('/admin/roles')` after success.
7. Update the redesigned `Create role` AdminSheet handler to call the new action; remove the `data-redesign-fake="create-role"` marker + re-enable the submit button.
8. Run the verification flow above (steps 1–5).

## How to undo it if something breaks
Removing the `createRole` export from `actions.ts` leaves the Create-role form unable to submit (it would call an undefined function). The AdminSheet should regress to the FAKE-degraded path (disabled submit + tooltip "Create-role backend pending"). Data in `roles` already created via the action stays intact; no destructive surface.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
