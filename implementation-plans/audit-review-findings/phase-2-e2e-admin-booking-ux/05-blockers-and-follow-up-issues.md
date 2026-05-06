# Phase 2 Blockers, Cleanup, and Follow-Up Issues

Audit issue: https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/96

## Blockers and Limits

- Chrome DevTools MCP was initially blocked by a Chrome profile lock, then re-tested successfully in the completion pass. It is no longer a Phase 2 blocker.
- Full mutation-heavy high-volume testing remains intentionally limited on live production. A small controlled parallel booking test was completed, but broad high-volume seed/load testing still needs a non-production branch or test project.
- Existing local E2E setup/cleanup scripts were not run against production-like live data because the existing fixtures use non-`audit_phase2_` prefixes and could pollute live data.
- Direct SQL-created auth users were rejected by live Supabase Auth; unusable temporary auth records were removed and replaced through the Supabase Admin API.

## Temporary Records Created

Temporary records used `audit_phase2_` prefixes:

- Temporary auth/staff personas for admin, male therapist, female therapist, restricted staff, inactive staff, and `can_take_bookings = false` staff.
- Temporary restricted role `audit_phase2_restricted_role`.
- Temporary clients/bookings:
  - `audit_phase2 Single Customer`
  - `audit_phase2 Repeat Customer`
- Temporary booking IDs:
  - `e8941e0f-3740-4df2-87b3-cc3a36cdf98b`
  - `1c71ce80-7084-484d-8e59-8d954844f18c`
  - `dbe87449-ee7b-49c3-849c-e12a2e586a58`
  - completion-pass parallel bookings, mixed-group booking, manual client booking, and related client/staff records

Credentials, passwords, manage-link tokens, provider message IDs, and private email contents were redacted from audit deliverables.

## Follow-Up Issues Created

| Issue | Severity | Status |
|---|---|---|
| https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/97 | High | Open |
| https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/98 | Medium | Open |
| https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/99 | Medium | Open |
| https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/100 | Medium | Open |

## E2E Matrix

| Scenario | Result | Notes |
|---|---|---|
| Public route smoke | Pass | Baseline public routes loaded. |
| Admin route protection | Pass | Unauthenticated admin dashboard redirected to login. |
| Owner admin routes | Pass | Major owner routes rendered. |
| Single-person booking | Pass | Booking, participant, item, assignment, email events created. |
| Mixed-gender group booking | Pass | Two participants, two items, and two gendered assignments created. |
| Repeat customer bookings | Pass | Two bookings linked to one client with separate booking notes/address. |
| Male assignment claim | Pass | Matching male therapist claim moved booking to partially assigned. |
| Inactive staff login | Pass | Blocked with inactive-account message. |
| `can_take_bookings = false` staff | Pass | Could not access unassigned booking detail/claim path. |
| Restricted staff routes | Partial | Direct denied states worked, but dashboard exposed dead-end links. |
| Female assignment claim | Pass | Matching female therapist claimed only the female assignment in a mixed-gender booking. |
| Manual client creation | Pass | Audit client created, detail rendered, note and privacy request persisted. |
| Manual booking lifecycle/payment update | Pass | Audit booking created from client profile and confirmed/paid/card status plus notes persisted. |
| Services create/edit/delete | Pass | Audit-only service was created, price edited, then deleted. |
| Staff availability modes | Pass | Audit staff profile switched through global, custom, and global-with-overrides modes. |
| Report CSV export | Pass | Export endpoint returned HTTP 200 `text/csv` with booking-list attachment filename. |
| Command search | Pass | `Ctrl+K` opened search and returned permitted audit bookings/clients. |
| Controlled concurrent booking | Pass with remaining load-test gap | Four parallel same-slot requests produced two accepted and two stale-slot rejections. Larger high-volume testing still needs a controlled non-production environment. |

## Security/RLS Matrix

| Check | Result | Notes |
|---|---|---|
| Anon raw read: bookings | Pass | Permission denied. |
| Anon raw insert: clients | Pass | Permission denied. |
| Authenticated raw insert: clients | Pass | Permission denied. |
| Anon table grants on sensitive tables | Pass | No anon SELECT/INSERT grants found. |
| Authenticated direct grants on sensitive tables | Pass | No direct INSERT/UPDATE grants found on checked booking/client/staff tables. |
| RLS enabled on sensitive tables | Pass | Enabled on checked tables. |
| Public availability leak check | Pass with observation | No staff identities leaked; gendered capacity counts returned. |
| Browser secret scan | Pass | `pnpm test:security:secrets` passed. |
| Supabase Security Advisor | Finding | Leaked-password protection disabled. |

## Validation Command Matrix

| Check | Result | Notes |
|---|---|---|
| `pnpm lint` | Pass | ESLint completed successfully. |
| `pnpm test` | Pass | Initial sandbox run hit Windows `spawn EPERM`; approved rerun passed 9 files / 30 tests. |
| `pnpm test:security:secrets` | Pass | Browser secret scan passed. |
| `pnpm verify:london-time` | Pass | Europe/London GMT/BST checks passed. |
| `git diff --check` | Pass | No whitespace errors. |
| `pnpm test:e2e` | Still blocked for live Phase 2 | Existing setup uses `phase10_` fixtures, not the required `audit_phase2_` prefix. Running it against production-like data would violate the Phase 2 data-safety rule unless the fixtures are changed or a non-production Supabase branch/test project is used. |

## Cleanup Status

Cleanup was executed after documenting findings. Final verification confirmed zero remaining `audit_phase2_` auth users, staff profiles, restricted roles, clients, bookings, participants, booking items, booking assignments, services, client notes, privacy requests, email events, operational events, enquiries, staff availability records, and audit-log traces.

No fixes or feature work were performed.
