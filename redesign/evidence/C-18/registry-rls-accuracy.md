# C-18 — Gate items 9 (RLS) & 10 (registry accuracy) — independent read-only verification

**Verifier:** read-only subagent, no prior involvement in C-18.
**Repo state verified against:** working tree at HEAD `26a7d3f` (confirmed via `git rev-parse HEAD`). No files were modified to produce this evidence; this file is the one permitted write.
**Scope:** plan `redesign/plans/C-phase/C-18-cookie-consent-plan.md` §3, gate items 9 and 10 only. No browser work, no build, no writes/mutations of any kind against Supabase.

---

## Gate item 9 — RLS on `consent_events`

All checks below are my own SELECT-only SQL, run against Supabase project `twzutkfgqclqurvkmvqz` via `mcp__supabase__execute_sql`. No INSERT/UPDATE/DELETE/DDL was issued at any point, including not "to prove denial."

| Check | Result observed |
|---|---|
| `SELECT to_regclass('public.consent_events')` | `consent_events` — table exists |
| `relrowsecurity` (pg_class) | `true` |
| `relforcerowsecurity` | `false` (irrelevant here — no owner/superuser bypass path is exercised by app roles) |
| `count(*)` from `pg_policies` for this table | `0` — zero policies |
| `has_table_privilege('service_role', ..., 'INSERT')` | `true` |
| `has_table_privilege('service_role', ..., 'SELECT')` | `false` |
| `has_table_privilege('service_role', ..., 'UPDATE')` | `false` |
| `has_table_privilege('service_role', ..., 'DELETE')` | `false` |
| `has_table_privilege('anon', ..., 'SELECT')` | `false` |
| `has_table_privilege('anon', ..., 'INSERT')` | `false` |
| `has_table_privilege('authenticated', ..., 'SELECT')` | `false` |
| `has_table_privilege('authenticated', ..., 'INSERT')` | `false` |
| Row count (`SELECT count(*) FROM public.consent_events`) | `0` |

Full `information_schema.role_table_grants` dump for this table (all grantees, all privileges) confirms the privilege picture is exactly the "postgres-created table" default-ACL pattern the migration's own comment predicts: `anon` and `authenticated` hold only `REFERENCES`/`TRIGGER`/`TRUNCATE` (never SELECT/INSERT/UPDATE/DELETE); `service_role` holds `INSERT` plus the same three, and nothing else; `postgres` (table owner) holds full DML. `service_role.rolbypassrls = true`, `postgres.rolbypassrls = true`, `anon.rolbypassrls = false`, `authenticated.rolbypassrls = false` (checked directly against `pg_roles`).

Table shape (`information_schema.columns`) matches the migration file exactly: `id uuid` (default `gen_random_uuid()`), `created_at timestamptz` (default `now()`), `consent_id uuid`, `banner_version text`, `purposes_offered jsonb`, `choices jsonb`, `action text` — all `NOT NULL`, no extra/missing columns.

**Verdict: the applied database state matches `supabase/migrations/20260804182200_c18_consent_events.sql` exactly**, including the file's own "POST-APPLY VERIFICATION" block (lines 60–67), which I independently reproduced rather than restated — every line of that block matches what I observed myself.

### What this posture means in practice

- **Who can read this table:** no application-facing credential can. `anon` (the public browser key) cannot SELECT. `authenticated` (a logged-in Supabase user — which, per `src/middleware.ts`'s matcher `["/admin/:path*"]`, only ever exists for staff on `/admin` routes, and even they use `service_role` there via `createSupabaseAdminClient()`, not their own `authenticated` session, for data access — see `src/lib/supabase/admin.ts` usage below) cannot SELECT. `service_role` — the key the app's own API route uses — cannot SELECT either; it was granted INSERT only, deliberately (least privilege, since the route only writes). The only role that can currently SELECT is `postgres` (the table owner / migration role), which is reachable only through direct database access — the Supabase SQL editor/dashboard or an MCP tool exactly like the one I used here — never through any client-facing key or route in this codebase. So in practice: **nobody using the app reaches a read path to this table; only privileged direct DB access (e.g. this verification session, or the Owner via the Supabase dashboard) can read it.**
- **Who can write to it:** only `service_role`, and only via INSERT. `anon` and `authenticated` cannot INSERT. The only code path in the repo that authenticates as `service_role` against this table is `src/app/api/consent-events/route.ts` (via `createSupabaseAdminClient()` from `src/lib/supabase/admin.ts`), and I read that route directly: it never chains `.select()` on the insert (confirmed at the source — the insert is `supabase.from("consent_events").insert({...})` with no `.select()` call), which is exactly what the migration's INSERT-only grant requires — chaining `.select()` would ask supabase-js for a returned representation, which needs SELECT and would fail 42501. The route always answers `204` regardless of outcome, logging failures server-side via `console.error` rather than surfacing them to the caller.
- **RLS-with-zero-policies is correct here, not an oversight:** with zero policies, RLS itself denies every row to `anon`/`authenticated` regardless of any future policy gap, and `service_role`'s `rolbypassrls = true` means RLS was never what gated the route in the first place — the GRANT is what gates it, and the GRANT is INSERT-only. Both mechanisms point the same way (deny-read, write-only-via-service_role), so there is no daylight between "what RLS says" and "what the grants say."
- **Row count is 0.** Consistent with the plan's own test-fixture guidance (§6: verification is self-generated in-browser, and no browser-based verification pass has been run in this session) and with the C-18 progress log, which records no browser-confirmed grant/withdrawal pass yet producing a logged row.

No write of any kind — not even a rollback-wrapped one — was attempted against `consent_events` to reach any of the above; every negative ("anon cannot SELECT", "authenticated cannot INSERT") was established via `has_table_privilege()`, a read-only introspection function.

---

## Gate item 10 — registry accuracy across all surfaces

### 10a — One registry, three surfaces, no hand-maintained copies

Read `src/lib/consent/cookie-registry.ts` (the source — `COOKIE_REGISTRY`, `groupRegistryByPurpose()`), `src/app/(public)/cookies/CookieRegistryGroups.tsx` and `page.tsx` (the `/cookies` notice page), and `src/components/consent/ConsentPreferencesPanel.tsx` (the preferences panel).

- `/cookies` page: `CookieRegistryGroups()` calls `groupRegistryByPurpose()` with no arguments (defaults to `COOKIE_REGISTRY`) and renders `group.label`, `group.description`, and per-entry `entry.name`, `entry.type`, `entry.description`, `entry.provider`, `entry.duration` directly from the returned objects. No separate array, object, or string literal duplicates any entry's name/provider/duration/description anywhere in `CookieRegistryGroups.tsx` or `page.tsx`.
- Preferences panel: `PanelBody()` in `ConsentPreferencesPanel.tsx` also calls `groupRegistryByPurpose()` directly and renders each group's `PurposeSection`, which in turn renders each `entry` via `EntryDetail` — again `entry.name`, `entry.description`, `entry.provider`, `entry.duration`, read straight from the same `CookieRegistryEntry` objects. `GATED_PURPOSES` (the panel's toggle list) is likewise derived from `groupRegistryByPurpose()`, not hand-listed.
- Both components' own doc comments state this design intent ("this is the ONLY place... no separate hand-maintained list", `CookieRegistryGroups.tsx:54-60`), and the code matches the comment — I did not take the comment's word for it, I traced the actual render calls.

**Confirmed: there is exactly one registry array (`COOKIE_REGISTRY`) and both consumer surfaces render from the same `groupRegistryByPurpose()` function over it. No surface holds its own copy of any entry's name, provider, duration, description, or purpose.** By construction, the two surfaces cannot disagree with each other or with the source — they are the same data rendered twice.

### 10b — Each of the six entries verified against the code that actually writes it

| Registry entry | Where it's actually written | Verified true |
|---|---|---|
| `rahma_consent` | `src/lib/consent/consent-state.ts` — `CONSENT_COOKIE = "rahma_consent"`; `writeConsent()` sets `document.cookie` with `Path=/; Max-Age=${CONSENT_MAX_AGE_S}; SameSite=Lax; Secure`, `CONSENT_MAX_AGE_S = 60*60*24*182` = 182 days | Name, type (`cookie`), duration ("6 months (182 days)") all match exactly. Description claims it's written "the moment you answer the cookie banner or save your settings, and not before" — `writeConsent()`'s only callers are inside `src/components/consent/consent-store.ts`'s `recordConsentChoices()`, itself only called from `ConsentActionButton` clicks in `CookieBanner.tsx` / `ConsentPreferencesPanel.tsx` (banner Accept-all/Reject-all, panel Save/Accept-all/Reject-all) — confirmed no other caller exists. |
| `zam-therapy-booking-draft-v3` | `src/features/booking/store/booking-store.ts:75-79` (re-exported by the barrel `src/features/booking/booking-store.ts`) — zustand `persist`, `name: "zam-therapy-booking-draft-v3"`, `storage: localStorage`, `partialize: (state) => ({ selectedPackageIds: state.selectedPackageIds })` | Name, type (`localStorage`) match. Description's claim "stores only the package selection itself" is literally what `partialize` limits the persisted object to — confirmed by reading the `partialize` function, not inferred. Duration claim ("cleared only on 'Start a new request', or clearing site data") — `resetDraft()` (the only reset action) has exactly one caller, `BookingExperience.tsx:549`, which I confirmed via grep across `src/`. |
| `rahma-booking-contact-v1` | `src/features/booking/utils/returning-customer.ts` — `STORAGE_KEY = "rahma-booking-contact-v1"`, `MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000` | Name, type (`localStorage`), duration (180 days) match. Field list in `storedContactSchema`: `savedAt, fullName, phone, email, clientGender, city, area, postcode, address, accessNotes, parkingNotes` — 10 fields excluding the internal `savedAt` timestamp — matches the description's "name, phone number, email address, gender, home address (house/street, town, area and postcode), and any access or parking notes" exactly, field for field. **The functional gate is real, not decorative**: `BookingExperience.tsx:64-71` defines `saveReturningCustomerIfConsented`/`loadReturningCustomerIfConsented`, each starting with `if (!hasConsentFor("functional")) return` before calling the underlying save/load — and these gated wrappers, not the raw functions, are what's actually called at the write site (`:520`, inside `handleConfirmSubmit`) and the read site (`:309`, the pre-fill effect). The description's "switch it off and anything already stored is deleted" claim is also true in code: `consent-store.ts`'s `applyChoiceTransition()` runs `if (previous.functional && !next.functional) { const { clearReturningCustomer } = await import(...); clearReturningCustomer(); }` on exactly a functional-consent withdrawal. |
| `_ga / _ga_*` | `src/components/GoogleAnalytics.tsx` | Type (`cookie`), provider (Google) match; the cookies themselves are Google's own (not repo-set), consistent with the registry's own disclaimer that the 13-month duration is Google's documented default, "not independently verified in production." Gate verified real: `if (!GA_ID \|\| process.env.NODE_ENV !== "production") return null; if (consent?.choices.analytics !== true) return null;` — both C-17's original env/production check and the Phase D analytics-consent check, both required, before any `<Script>` referencing `googletagmanager.com` renders. `useConsent()` reads through the same consent store as the panel, and the server snapshot is hard-coded `undefined` (`getServerConsentSnapshot()`), so no prerendered HTML can ever contain the script tag for any visitor. |
| `maintenance-modal-seen` | `src/components/shared/MaintenanceModal.tsx` — `SESSION_KEY = "maintenance-modal-seen"`, written via `sessionStorage.setItem(SESSION_KEY, "1")` on mount, once per session | Name, type (`sessionStorage`) match. **Deployable-state check, done correctly**: `git show HEAD:src/lib/maintenance.ts` → `MAINTENANCE_MODE = true` — confirmed by reading the committed blob directly, never the working copy (`src/lib/maintenance.ts` on disk currently reads `false`, the Owner's standing uncommitted change, which I did not open for editing and did not treat as ground truth). `src/app/(public)/layout.tsx:35` — `{MAINTENANCE_MODE && <MaintenanceModal />}` — so at HEAD's committed value the modal **does** mount for every public visitor and the key **is** written on every session. The registry entry carries no `dormant` flag (the interface no longer even has that field — confirmed by reading the full `CookieRegistryEntry` type, which lists only `name/provider/type/purpose/duration/description`), and its description ("While planned maintenance is in progress...") makes no claim that maintenance is currently off. This is consistent with the deployable state, not the Owner's local dev state. |
| `sentryReplaySession` | `@sentry-internal/replay` package (external, not in `src/`), started via `Sentry.addIntegration(Sentry.replayIntegration(...))` in `sentry.client.config.ts`'s `syncSessionReplay()`, invoked by `SentryProvider.tsx` on mount and every route change | Type (`sessionStorage`), provider (Sentry) match. Gate verified real: `syncSessionReplay()` returns early (calling `replay?.stop()`) on `/booking/manage` (`isReplayBlockedPath`) and on `/admin` (`isAdminPath` — Owner decision 9, off outright, not consent-gated) before it ever reaches the analytics-consent check; the consent check itself is `replayRequiresConsent(pathname) && !hasAnalyticsConsent()` → `stop()`/never-start. `hasAnalyticsConsent()` reads through the same `readConsent()` the banner/panel/GA loader use. Description's "never runs at all on our staff-only admin area, whatever anyone's choice" and "Sentry's separate error-reporting tool... keeps working everywhere, admin included" are both borne out by `Sentry.init({..., integrations: []})` running unconditionally at module load (error capture, independent of Replay) while Replay is added only later, conditionally, per route. |

**No discrepancy found in any of the six entries.** Every name, type, provider, duration, and description claim I checked against the actual writing code held.

### 10c — Sweep for unregistered cookies/storage reaching a public/booking visitor

Grepped all of `src/` for `localStorage.setItem`, `sessionStorage.setItem`, `document.cookie =`, `.cookies.set(`, and cookie-setting middleware. 23 non-test-adjacent hits total (plus their own test files). Every hit outside the six registered mechanisms resolves to a file under `src/app/admin/**` (`BookingsChrome.tsx`, `dashboard-filters-client.tsx`, `ManualBookingForm.tsx`, `ThemeProvider.tsx`, `EnquiryFilterPersistence.tsx`, `notification-bell.tsx` and their tests) — staff-only surfaces behind the authenticated admin area, out of this registry's stated scope (the registry itself documents this split: 5 anonymous-visitor mechanisms + `rahma_consent` = 6, vs. 7 staff-only ones).

I verified the admin/public boundary myself rather than taking the progress doc's word for it: `src/middleware.ts`'s `export const config = { matcher: ["/admin/:path*"] }` is the only cookie-writing Supabase auth path in the repo (`createServerClient` + `request.cookies.set`/`supabaseResponse.cookies.set`), and it never runs outside `/admin`. A further grep for every call site importing `src/lib/supabase/server.ts` or `src/lib/supabase/client.ts` (the other cookie-capable Supabase client factories) returned 97 files, all under `src/app/admin/**`. A separate grep for cookie/storage writes inside `src/app/api/**` (the public-reachable API surface: `availability`, `bookings`, `consent-events`, `cron/**`) returned zero matches. `design_handoff_area_pages/` (the untracked prototype directory that accounts for most of the standing eslint baseline) contains no storage writes at all.

**No unregistered cookie or storage key reaching a public/booking visitor was found.** The registry's six entries are the complete set.

---

## Summary

| Gate item | Verdict |
|---|---|
| 9 — RLS on `consent_events` | **PASS.** Table exists, RLS on with zero policies, `service_role` INSERT-only (no SELECT/UPDATE/DELETE), `anon`/`authenticated` have neither SELECT nor INSERT, row count 0, applied state matches the migration file's own documented verification exactly. In practice: no application-facing client can read this table; only `service_role` (via the API route only, INSERT-only, no `.select()` chained) can write to it; direct privileged DB access (table owner / dashboard) is the only read path, and it is not exposed through any client key or route in this codebase. |
| 10 — Registry accuracy across all surfaces | **PASS.** `/cookies` and the preferences panel both render from the same `groupRegistryByPurpose(COOKIE_REGISTRY)` call — no hand-maintained duplicate list on either surface. All six entries' name/type/provider/duration/description checked against the actual writing code and found true, including `maintenance-modal-seen` against the committed (`git show HEAD`) value of `MAINTENANCE_MODE`, not the Owner's uncommitted working copy. A `src/`-wide sweep for cookie/storage writes found no mechanism reaching a public/booking visitor outside the six registered entries. |

## Checks not run / out of scope for this task

- No browser session was opened; nothing here required one (both gate items are source + SQL reasoning per the dispatch). The plan's own gate items 2–8 (regulator test, grant/withdrawal browser flows, DevTools cookie inspection, a11y, parity screenshots) are separate gate items not assigned to this task and remain unverified by me.
- `pnpm build` / `next build` was not run (prohibited by dispatch).
- No admin-side login was attempted (prohibited; not needed for this task — the admin/public boundary was established via source reading of `middleware.ts`'s matcher and import-site grepping, not by logging in).
- `KNOWN_BANNER_VERSIONS`/`CONSENT_BANNER_VERSION` bump-and-reprompt behaviour (gate item 6) was not exercised — out of scope for gate items 9/10.
