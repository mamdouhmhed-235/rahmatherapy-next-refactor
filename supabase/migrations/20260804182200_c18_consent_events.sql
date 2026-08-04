-- C-18 Phase E Step 9 — public.consent_events, the consent-proof log.
--
-- Owner-approved and applied 2026-08-04 (Zone-2, per-action approval in chat).
-- Applied version: 20260804182200. Additive: nothing dropped, nothing altered,
-- no existing table touched, no data modified.
--
-- WHAT IT IS FOR
-- PECR/UK GDPR consent must be demonstrable, not merely collected. The ICO
-- standard is who (a pseudonymous identifier suffices) / when / what was shown
-- (versioned) / what was chosen, retained while the consent is relied upon —
-- see redesign/briefs/C-18-cookie-consent-brief.md §1 and §2.4. Every banner
-- interaction writes one row: 'granted' | 'rejected' on a first choice,
-- 'updated' on a panel save, 'withdrawn' when a purpose is switched back off.
--
-- DATA MINIMISATION IS PART OF THE DESIGN
-- No IP address, no user agent, no name, no email, no booking reference. The
-- only identifier is consent_id, a random uuid minted by writeConsent() and
-- stored in the visitor's own `rahma_consent` cookie
-- (src/lib/consent/consent-state.ts). It is preserved across later choices so
-- a withdrawal joins to the grant it revokes; it links to nothing else.
--
-- WHY RLS IS ENABLED WITH ZERO POLICIES
-- RLS on + no policies = deny-all for `anon` and `authenticated`, which is
-- exactly the intent: there is no client read path and no client write path.
-- The API route (src/app/api/consent-events/route.ts) authenticates as
-- `service_role` via createSupabaseAdminClient, and `service_role` is
-- rolbypassrls = true (verified live), so RLS is not what gates the route —
-- the GRANT below is.
--
-- WHY THE GRANT IS HERE, AND WHY IT IS NOT IN THE BRIEF
-- The brief's §2.4 SQL block specifies only the table and the RLS enable. That
-- would have shipped this feature silently broken. This project does not rely
-- on Supabase's blanket `grant all` default — privileges are granted EXPLICITLY
-- PER TABLE (see 20260503084016_phase16_service_role_grants.sql), and
-- pg_default_acl was inspected live before writing this file:
--
--   tables created by `postgres` (the role migrations run as)
--     → service_role receives Dxtm  = TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
--       i.e. NO INSERT, NO SELECT, NO UPDATE, NO DELETE
--   tables created by `supabase_admin`
--     → service_role receives arwdDxtm (full DML)
--
-- So without the grant below, every consent write would fail 42501. Step 10
-- specifies the route ALWAYS returns 204 (fire-and-forget; consent UX must
-- never block on logging), so the failure would be completely invisible: the
-- banner would work, the visitor would be told their choice was recorded, and
-- the proof log — the entire legal point of this table — would stay empty.
--
-- This is C-04a's failure mode exactly, and it is why that plan lost a full
-- verification cycle (see redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md §3b
-- and 20260728132043_c04a_grant_update_email_delivery_events.sql).
--
-- INSERT ONLY, DELIBERATELY
-- The route writes and never reads, so SELECT is withheld under least
-- privilege. Consequence for the implementer: the insert must NOT chain
-- .select() — supabase-js would then request a representation and need SELECT.
-- A future admin viewer for this log (C-12+, out of scope here) would need its
-- own explicit grant, added deliberately rather than inherited.
--
-- POST-APPLY VERIFICATION (run 2026-08-04, all as expected)
--   to_regclass('public.consent_events')                              → consent_events
--   relrowsecurity                                                    → true
--   count(*) from pg_policies for this table                          → 0
--   has_table_privilege('service_role', ..., 'INSERT')                → true
--   has_table_privilege('service_role', ..., 'SELECT')                → false
--   has_table_privilege('anon', ..., 'SELECT' / 'INSERT')             → false / false
--   has_table_privilege('authenticated', ..., 'INSERT')               → false
--
-- ROLLBACK
--   DROP TABLE IF EXISTS public.consent_events;
-- Loses the consent history. Per the plan's §5: if C-18 is live, do NOT drop —
-- the proof obligation stands for as long as the consent is being relied upon.

CREATE TABLE public.consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  consent_id uuid NOT NULL,
  banner_version text NOT NULL,
  purposes_offered jsonb NOT NULL,
  choices jsonb NOT NULL,
  action text NOT NULL CHECK (action IN ('granted','rejected','updated','withdrawn'))
);

ALTER TABLE public.consent_events ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.consent_events TO service_role;
