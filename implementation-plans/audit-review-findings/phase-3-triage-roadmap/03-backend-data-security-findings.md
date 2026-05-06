# Phase 3 Backend, Data, Security, Privacy, And Deployment Findings

Tracking issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/101

## Security/Privacy Readiness Verdict

Security/privacy readiness verdict: **Not ready until high/medium hardening items are explicitly remediated or accepted**.

The strongest evidence is positive: RLS is enabled on sensitive tables, Phase 2 anon/auth direct raw reads/inserts were blocked, browser secret scanning passes, service-role flows worked through server paths, and admin route protection/RBAC worked in runtime tests. Remaining risks are hardening and least-privilege issues rather than proven public data exfiltration.

## Current Supabase State

| Check | Result |
| --- | --- |
| Migration status | Applied through `20260504052757 phase10_inactive_staff_self_profile_rls`. |
| Security advisor | Warns: `auth_leaked_password_protection` disabled. |
| Performance advisor | Reports unindexed foreign keys, staff profile RLS initplan warning, multiple permissive policies, and unused indexes. |
| RLS enabled | Enabled on reviewed sensitive tables: bookings, clients, participants, items, assignments, staff profiles, notes, audit, privacy, email, and operational events. |
| Direct anon/auth DML | Phase 2 confirmed anon read/insert and authenticated raw insert attempts were blocked for checked sensitive tables. |
| Grants review | Phase 3 found unnecessary-looking `TRUNCATE`, `TRIGGER`, and `REFERENCES` grants to public roles on sensitive operational/privacy tables. |

## Validation Results

| Check | Phase 3 result | Notes |
| --- | --- | --- |
| `pnpm lint` | Pass | ESLint completed successfully. |
| `pnpm build` | Pass | Next.js build passed; middleware-to-proxy deprecation warning remains. |
| `pnpm test` | Pass after sandbox workaround | Initial sandbox run hit Windows `spawn EPERM`; approved rerun passed 9 files / 30 tests. |
| `pnpm test:e2e` | Blocked for live Phase 3 | Existing fixture path uses `phase10_` records and is not safe for live audit constraints. |
| `pnpm test:security:secrets` | Pass | Browser secret scan checked sensitive env keys across build/static outputs. |
| `pnpm verify:london-time` | Pass | Europe/London GMT/BST checks passed. |
| `pnpm cf:build` | Pass after sandbox workaround | OpenNext build completed; Windows/OpenNext compatibility and middleware deprecation warnings remain. |
| `git diff --check` | Pass | No whitespace errors. |
| Browser smoke | Pass with findings | Public home, booking modal, admin login, unauth admin redirect, and invalid manage link loaded; CSP report-only warnings appeared on admin login. |

## Confirmed Security, Privacy, And Backend Findings

| Priority | Type | Title | Evidence | Issue |
| --- | --- | --- | --- | --- |
| P1 | Security/privacy risk | Revoke unnecessary anon/authenticated `TRUNCATE`, `TRIGGER`, and `REFERENCES` grants | Phase 3 grants query found these privileges on `client_notes`, `client_privacy_requests`, `email_delivery_events`, `enquiries`, and `operational_events`. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/102 |
| P1 | Security/privacy risk | Enable Supabase leaked password protection or document accepted residual risk | Supabase Security Advisor still reports `auth_leaked_password_protection`. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/88 |
| P2 | Backend performance hardening | Add missing indexes for advisor-reported foreign keys | Supabase performance advisor reports unindexed FKs across booking, assignment, staff, email, enquiry, privacy, audit, and operations tables. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/89 |
| P2 | Security/observability hardening | Align CSP report-only policy before enforcement | Chrome DevTools on `/admin/login/` logged report-only CSP violations for Next.js scripts, Sentry monitoring connect requests, and blob worker creation. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/103 |
| P3 | Deployment maintenance | Replace deprecated Next.js middleware convention with proxy | `pnpm build` and `pnpm cf:build` still warn that `middleware` is deprecated in favor of `proxy`. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/86 |

## Backend Correctness And Hardening Readiness

| Area | Assessment |
| --- | --- |
| Booking transaction | Strong. Public and manual booking flows created normalized records and stale-slot conflicts were rejected in a small concurrent test. |
| Email coupling | Strong. Email events are recorded and email side effects did not roll back booking creation in Phase 2. |
| RLS and service-role boundaries | Strong core, needs grant cleanup. RLS and route guards work; public-role non-DML grants should be reduced. |
| Concurrency | Partial. Small same-slot parallel test passed; broader load and claim-race testing needs non-production fixtures. |
| Reporting correctness | Partial. CSV export works and metric docs exist; larger datasets and role-scoped metric drift need more non-production coverage. |
| Audit/privacy operations | Partial to strong. Admin surfaces and audit/privacy records exist; grant hygiene and role-scoped sensitive data review remain important. |

## Email, Sentry, And Cloudflare Readiness

| Area | Assessment |
| --- | --- |
| Resend/email | Partial. Event logging is present and tested; production sender/domain readiness must be verified operationally before launch. |
| Sentry/observability | Partial. Sentry is configured with privacy defaults and scrubber docs; CSP report-only policy currently logs monitoring connect violations. |
| Cloudflare/OpenNext | Partial. `pnpm cf:build` passes after sandbox workaround, but OpenNext warns Windows is not ideal and Next.js warns about middleware deprecation. |
| Environment expectations | Partial. `.env.example` documents Supabase, Resend, Sentry, site URL, and Cloudflare variables; README has stale `SENTRY_DSN` naming versus current `NEXT_PUBLIC_SENTRY_DSN`. |

## No-Fix Confirmation

No backend logic, SQL, RLS, grants, migrations, configuration, deployment, or Supabase data changes were made in Phase 3.
