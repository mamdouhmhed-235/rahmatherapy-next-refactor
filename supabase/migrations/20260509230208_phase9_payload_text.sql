-- ⛔ BACKFILL — reconstructed from live introspection on 2026-08-19.
-- Production ALREADY HAS this migration applied (version 20260509230208,
-- name `phase9_payload_text`). It was missing from this directory; see
-- README-MIGRATION-DRIFT.md §1. Do NOT apply it to production. It exists so a
-- rebuild from this directory reaches the same state production is in.
--
-- What it creates: nothing new. It converts the two payload columns on
-- `public.account_password_requests` from binary to `text` — which is what
-- the migration's name says and all it says.
--
-- ORDERING. This ran 1 minute 42 seconds after
-- 20260509230026_phase9_account_password_requests.sql created the table. No
-- other migration ran in between, and no migration between here and today
-- touches these two columns' types, so this file is the only thing standing
-- between the created table and the live one.
--
-- WHY text AND NOT bytea. The shipped scheme (src/lib/auth/password-reset-token.ts)
-- stores a SHA-256 hex digest under `payload_cipher_version = 0` and compares
-- it with equality — `.eq("encrypted_payload", hash)` in
-- src/app/admin/password-reset/actions.ts:189 and
-- src/app/admin/password-reset/[token]/page.tsx:52. A hex string through
-- PostgREST is a text comparison; bytea would have forced hex-literal
-- round-tripping on every lookup. Live, both columns are `text` — verified in
-- pg_attribute on 2026-08-19.
--
-- ⚠️ RECONSTRUCTION CONFIDENCE — the PRE-state is inferred. Postgres keeps no
-- history of a column's former type, so "these columns used to be bytea"
-- cannot be proven from the catalog. It is read from this migration's name
-- (`payload_text`) plus the original encrypt-with-a-nonce design that
-- `payload_cipher_version smallint default 1` and the `payload_nonce` column
-- record. What IS proven: both columns were present in the CREATE TABLE, not
-- added here — live attnum is 4 (`encrypted_payload`) and 5 (`payload_nonce`),
-- ahead of `payload_cipher_version` at 6, and Postgres appends added columns
-- at the end. So this migration changed them; it did not introduce them.
--
-- The pair is self-consistent: 20260509230026 creates them as bytea, this
-- file converts them to text, and a rebuild lands on text either way. If the
-- true original type was something else, the intermediate state differs from
-- history but the end state — the only thing anything downstream observes —
-- does not.
--
-- Idempotent: guarded on the current type, so re-running against a database
-- where the conversion already happened is a no-op rather than an error.

do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.account_password_requests'::regclass
      and attname = 'encrypted_payload'
      and atttypid = 'bytea'::regtype
  ) then
    alter table public.account_password_requests
      alter column encrypted_payload type text using encode(encrypted_payload, 'hex');
  end if;

  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.account_password_requests'::regclass
      and attname = 'payload_nonce'
      and atttypid = 'bytea'::regtype
  ) then
    alter table public.account_password_requests
      alter column payload_nonce type text using encode(payload_nonce, 'hex');
  end if;
end
$$;
