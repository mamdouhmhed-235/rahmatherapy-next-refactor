-- The original `account_password_requests_payload_consistency` CHECK was
-- designed for an alternate flow where the staff member submits their desired
-- new password at request time and the encrypted payload holds that password
-- until approval. The actual UI (live since Phase 6) and the H14 wiring
-- collect the new password AFTER the operator approves and the staff member
-- clicks a one-time link in the approval email.
--
-- Under the realised flow:
--   pending  → no token yet (encrypted_payload IS NULL)
--   approved → token hash stored (encrypted_payload IS NOT NULL)
--   used     → kept as-is so the audit trail can verify the consumed token
--   rejected → no payload
--   expired  → no payload
--
-- payload_nonce is unused under hash mode (cipher version 0) and stays NULL
-- across all states, so it drops out of the consistency check entirely.

alter table public.account_password_requests
  drop constraint if exists account_password_requests_payload_consistency;

alter table public.account_password_requests
  add constraint account_password_requests_payload_consistency check (
    (
      status in ('pending', 'rejected', 'expired')
      and encrypted_payload is null
    )
    or
    (
      status in ('approved', 'used')
      and encrypted_payload is not null
    )
  );
