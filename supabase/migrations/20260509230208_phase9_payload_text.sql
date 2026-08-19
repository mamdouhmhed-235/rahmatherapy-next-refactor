-- ⛔ BACKFILL — RECOVERED VERBATIM from production's migration ledger on
-- 2026-08-19 (gate 05, case D1). Production ALREADY HAS this migration applied
-- (version 20260509230208, name `phase9_payload_text`). It was missing from
-- this directory; see README-MIGRATION-DRIFT.md §1. Do NOT apply it to
-- production. It exists so a rebuild from this directory reaches the same
-- state production is in.
--
-- ✅ PROVENANCE: the block below is the exact text recorded in
-- `supabase_migrations.schema_migrations.statements` for this version — not a
-- reconstruction. It is self-guarding: each `alter` runs only if the column is
-- still `bytea`, so it is idempotent on a database where it already ran.

do $$
declare
  enc_type text;
  nonce_type text;
begin
  select data_type into enc_type
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'account_password_requests'
     and column_name = 'encrypted_payload';

  select data_type into nonce_type
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'account_password_requests'
     and column_name = 'payload_nonce';

  if enc_type = 'bytea' then
    execute $sql$
      alter table public.account_password_requests
        alter column encrypted_payload type text using
          case when encrypted_payload is null then null
               else encode(encrypted_payload, 'base64') end
    $sql$;
  end if;

  if nonce_type = 'bytea' then
    execute $sql$
      alter table public.account_password_requests
        alter column payload_nonce type text using
          case when payload_nonce is null then null
               else encode(payload_nonce, 'base64') end
    $sql$;
  end if;
end $$;
