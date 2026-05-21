-- The `clear_account_password_request_payload` trigger was the runtime
-- counterpart of the original `payload_consistency` CHECK constraint we
-- realigned in 20260521130000_realign_payload_consistency_check.sql.
--
-- Old semantics (now obsolete):
--   "On INSERT/UPDATE, if status != 'pending', null out encrypted_payload
--    and payload_nonce."
--
-- That was correct under the original design (encrypted new-password
-- payload held only while the request is pending, cleared on approval).
--
-- Under the realised H14 flow:
--   pending  → no token yet (payload IS NULL)
--   approved → token hash stored (payload IS NOT NULL)
--   used     → payload preserved for forensic verification
--   rejected → no payload
--   expired  → no payload
--
-- So the trigger now needs to clear the payload only on transitions into
-- the terminal "no-payload" states (rejected / expired). It must NOT touch
-- approved or used rows. The CHECK constraint enforces the rest.
--
-- Idempotent via CREATE OR REPLACE.

create or replace function public.clear_account_password_request_payload()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.status in ('rejected', 'expired') then
    new.encrypted_payload := null;
    new.payload_nonce := null;
  end if;
  return new;
end;
$function$;
