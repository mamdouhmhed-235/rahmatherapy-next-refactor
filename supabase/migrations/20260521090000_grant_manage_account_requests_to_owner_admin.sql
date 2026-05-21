-- Grant the existing `manage_account_requests` system permission (already
-- seeded as a row in `public.permissions`) to the Owner and Admin/Practice
-- Manager roles.
--
-- C2 fix from the Band A cancelled-class sweep round 3: the code constant
-- PERMISSIONS.MANAGE_ACCOUNT_PASSWORD_REQUESTS was value-aligned in this
-- same change to read `"manage_account_requests"` so the constant maps to
-- the existing DB row. Without this grant, no role holds the permission
-- and the canonical page guard at `src/app/admin/account-password-requests/page.tsx`
-- would 403 every operator the moment the transitional MANAGE_AUDIT_LOGS
-- bridge is removed (planned for after H14 password-reset wiring lands).
--
-- Owner + Admin only. Booking Coordinator and Therapist are intentionally
-- excluded — approving / rejecting a staff password reset is an account-
-- management action, not a daily operations action.
--
-- Idempotent: `on conflict do nothing` covers re-application against a DB
-- where the grant already exists (Supabase Branching previews, dev resets).

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.name = 'manage_account_requests'
where r.name in ('Owner', 'Admin')
on conflict do nothing;
