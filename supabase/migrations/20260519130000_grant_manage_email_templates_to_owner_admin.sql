-- Grant the new `manage_email_templates` permission (added by migration
-- 20260519120000) to the Owner and Admin/Practice Manager roles.
--
-- Session 2 of the engineering pause. User decision (2026-05-19): Owner +
-- Admin. Booking Coordinator deliberately excluded — they have email-send
-- access via resend_booking_emails but template copy editing stays with the
-- two top operational roles.
--
-- Idempotent: `on conflict do nothing` covers re-application against a DB
-- where the grant already exists (Supabase Branching previews, dev resets).

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.name = 'manage_email_templates'
where r.name in ('Owner', 'Admin')
on conflict do nothing;
