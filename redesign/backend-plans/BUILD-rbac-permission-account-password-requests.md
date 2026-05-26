# RBAC Permission: manage_account_password_requests — Backend Plan
**Action:** BUILD
**Safety label:** ADDITIVE
**Blocks redesign:** YES
**Triggered by:** account-password-requests-brief.md
**Owner:** Phase 6 implementer   **Target handled by:** Before Phase 6 session for `account-password-requests`

## What this is
A new RBAC permission entry `manage_account_password_requests` added to the permission catalogue and seeded into the Owner and Admin/Practice Manager role templates.

## Why it's needed
The `account-password-requests` page (§4, §11) gates every read and every mutation on this permission. Without it, `getAdminPageAccess("account-password-requests")` always fails, the page renders `AdminAccessDenied` for everyone including Owner, and the `approvePasswordResetRequest` / `rejectPasswordResetRequest` server actions return 403 on every call.

## What it does (user story)
"As a system, I want a discrete permission that controls who can view and act on staff password-reset requests, so that the Owner can grant or revoke this authority from any custom role without affecting other permissions."

## What information it stores or retrieves
A new row (or constant) in the permissions catalogue: `{ name: 'manage_account_password_requests', display_label: 'Review password-reset requests', category: 'account_security', risk_level: 'high', scope: 'all' }`. Grant entries in the role-permission join table for the Owner role and the Admin/Practice Manager role.

## Who can use it
Any role explicitly granted this permission. Default: Owner + Admin/Practice Manager. Coordinator and Therapist denied by default.

## What can go wrong
- **Permission seeded but not added to `getAdminPageAccess` page-key map:** the page check passes but the route is unreachable from nav. Ensure the page key `"account-password-requests"` is mapped in the access resolver.
- **Duplicate permission name:** if the seeding script runs twice, a unique-constraint violation occurs. The seed must use `ON CONFLICT DO NOTHING` or an upsert pattern.
- **Owner accidentally locked out of page during migration:** if the seed runs before the route exists, the permission is already in place when the route ships. This is safe — the reverse (route before permission) means the page 403s on first load.

## How to verify it works
1. Confirm `manage_account_password_requests` appears in the permissions list on `/admin/roles/<owner-role-id>` with the correct display label and risk level.
2. Sign in as Owner → navigate to `/admin/account-password-requests` → page renders (not `AdminAccessDenied`).
3. Sign in as Coordinator → navigate to `/admin/account-password-requests` → `AdminAccessDenied` renders with correct plain-English copy (no raw permission name).

## Safe implementation order
1. Add the permission constant to the RBAC permission enum / catalogue file (whatever pattern the existing `src/lib/auth/rbac.ts` uses). Confirm TypeScript compiles.
2. Map the permission to the `"account-password-requests"` page key in `getAdminPageAccess`. Test: `getAdminPageAccess(ownerProfile, "account-password-requests")` returns access.
3. Run the seed (or migration) that inserts the permission row and grants it to Owner and Admin/PM role templates. Verify in Supabase Studio.
4. Confirm the nav overflow menu in Brief 01 (`00-shared-components`) includes "Account password requests" for the `owner_admin` shell variant.

## How to undo it if something breaks
Remove the grant rows from the role-permission join table and the permission row from the catalogue. If done via migration, write a down-migration. If done via seed script, re-run with delete logic. No application data is touched.

## Safety confirmations
- [ ] A database backup taken in the last 24 hours has been test-restored to a throwaway dev database, the restored data is intact, and the restore time is acceptable for production rollback (record the time: ___ minutes)
- [ ] I am implementing on staging/dev, not the live site
- [ ] I am implementing one item at a time with a test after each
