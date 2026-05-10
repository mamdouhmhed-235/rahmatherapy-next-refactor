# Backend-parity hardening audit — May 2026

Phase 24 of the UI/UX alignment plan. Verifies the frontend's hardening
matches the backend's, and surfaces residual risks.

## Server-action permission gates

Every admin server-action file must call a permission gate before any
mutation. Audit run: every file in `src/app/admin/**/actions.ts` was
read for `requirePermission(...)` or an equivalent local helper that
wraps `hasPermission(...)`.

| File | Gate | Notes |
|------|------|-------|
| `availability/actions.ts` | `requirePermission(MANAGE_AVAILABILITY_GLOBAL)` | Direct. |
| `bookings/actions.ts` | `canManageAllBookings`, `canManageBookings`, `canAssignBookings` | Local helpers per-action. |
| `clients/actions.ts` | `requirePermission` + `canManageAllClients` | Mixed per-action. |
| `emails/actions.ts` | local `canManageEmails` + `canResendBookingEmails` | Wraps permissions. |
| `enquiries/actions.ts` | `requirePermission(MANAGE_ENQUIRIES)` | Direct. |
| `login/actions.ts` | (auth flow, no admin gate needed) | Pre-auth path. |
| `operations/actions.ts` | local `canManageOperationalEvents` + `canManageOperations` | Wraps permissions. |
| `privacy/actions.ts` | `requirePermission(MANAGE_PRIVACY_OPERATIONS)` | Direct. |
| `roles/actions.ts` | `requirePermission(MANAGE_ROLE_TEMPLATES)` | Direct, two call sites. |
| `services/actions.ts` | `requirePermission(MANAGE_SERVICES)` | Direct. |
| `settings/actions.ts` | `requirePermission(MANAGE_SETTINGS)` | Direct. |
| `staff/actions.ts` | `requirePermission` + `getStaffProfile` | Multiple gates. |

**Result:** every mutating server action has a permission gate.

## Database-level audit (Supabase MCP)

Project: `twzutkfgqclqurvkmvqz` (Rahma Therapy). Live snapshot 2026-05-10.

### Permissions table

```sql
SELECT name FROM public.permissions ORDER BY name;
```

36 canonical permission slugs present. **Zero of the 13 retired legacy
slugs** (`manage_users`, `manage_roles`, `manage_permissions`,
`manage_staff`, `manage_clients`, `claim_bookings`, `reassign_bookings`,
`view_all_bookings`, `view_own_bookings`, `manage_bookings_own`,
`view_reports`, `manage_payments`, `manage_emails`) are present.

### RLS policies

```sql
SELECT schemaname, tablename, policyname FROM pg_policies
WHERE qual ~ '\m(<retired-slugs>)\M' OR with_check ~ '\m(<retired-slugs>)\M';
```

**Result: zero rows.** No active RLS policy references a retired
permission slug. (One earlier substring-match false-positive on
`public.clients / "Client managers can read clients"` was investigated
and confirmed clean — the policy uses canonical `manage_clients_all`.)

### Function bodies

```sql
SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON ...
WHERE n.nspname IN ('public','app_private','storage')
  AND p.prokind='f'
  AND pg_get_functiondef(p.oid) ~ '''(<retired-slugs>)''';
```

**Result: zero rows.** No function body has a retired slug literal.

### Storage buckets

```sql
SELECT id, name, public FROM storage.buckets;
```

| ID | Public | Notes |
|----|--------|-------|
| `staff-avatars` | `false` | Phase 18 corrective migration applied — admin escape-hatch uses canonical `manage_staff_profiles`. |

No other buckets present. No further sweep needed.

## Supabase advisors

`mcp__supabase__get_advisors(type=security)`:

| Severity | Issue | Action |
|----------|-------|--------|
| WARN | `auth_leaked_password_protection` disabled | Project-level Supabase Auth setting. Enable from Supabase dashboard → Authentication → Password security → Enable HaveIBeenPwned check. **Not a code change.** |

No ERROR-level advisors. The single WARN is an environment toggle that
can be flipped from the Supabase console without code changes.

## What this audit did NOT cover

Out of scope for this phase, deferred to Phase 25 / future:

- Rate-limit and abuse review on public endpoints (signin, password
  request, public booking).
- CSP / security headers (`next.config.ts`, `middleware.ts`).
- Audit-log coverage matrix (which mutating actions write `audit_logs`
  rows, with diffs).
- RLS smoke test as each test role via JWT — verify rows returned match
  what the UI shows.
- Email send paths PII-leak audit on `email_events.safe_context`.

## Conclusion

Code paths are gated. Live DB schema is canonical. Frontend now matches
the backend's hardening posture. Single open item is a Supabase Auth
WARN advisory that flips from the dashboard.
