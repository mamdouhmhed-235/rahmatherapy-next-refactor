-- account_password_requests was created without the standard service_role
-- DML grants — only REFERENCES, TRIGGER, TRUNCATE were authorised on the
-- service role. The original design routed all access through the
-- `authenticated` role + RLS so the data path was deliberately tight.
--
-- H14 wires the server actions through the Supabase admin client which uses
-- the service_role key. Without these grants the admin client gets
-- `permission denied for table account_password_requests` and silent insert
-- failures swallow the cookie-set + redirect path.
--
-- This grant authorises the same DML set service_role holds on every other
-- public table managed by server actions (audit_logs, staff_blocked_dates,
-- staff_availability_overrides, client_notes, etc.). Idempotent — repeating
-- the GRANT is a no-op.

grant select, insert, update, delete
  on table public.account_password_requests
  to service_role;
