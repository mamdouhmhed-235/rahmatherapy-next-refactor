# Phase 3 Backend, Data, Security, And Privacy Findings

## Verdict

Backend/security readiness is **not ready**. RLS posture is materially improved and Supabase security advisor reported no current lints, but booking creation still has a confirmed data-integrity risk, local migration filenames diverge from live migration history, and Sentry privacy defaults are unsafe for a health-adjacent CRM.

## Evidence Collected

- Supabase security advisor on `2026-05-03`: no security lints returned.
- RLS is enabled on all inspected public tables: bookings, clients, booking participants/items/assignments, staff profiles, roles, settings, availability, services, and audit logs.
- Policy summary exposes public read only for active visible `services`; sensitive tables are authenticated policy-gated.
- Grants summary shows `anon` has `SELECT` only on `services`; sensitive write grants are reserved to `service_role`.
- Phase 2 runtime checks: anon raw reads/inserts into sensitive tables failed; authenticated raw write failed; no service-role, Resend, or Sentry auth token names were found in browser bundle/network checks.
- Supabase count: zero `audit_phase` clients, bookings, and auth users remain.

## Confirmed Findings

| Severity | Finding | Evidence | Issue |
| --- | --- | --- | --- |
| P0 | Booking creation lacks database transaction/capacity locking | Phase 1 code review found booking creation performs availability check and then separate inserts for client, booking, participants, items, and assignments. Phase 3 review confirmed sequential inserts in `createBookingTransaction.ts` with no database transaction wrapper or slot capacity lock. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/52 |
| P1 | Sentry may capture avoidable PII and local variables | Phase 3 found `sendDefaultPii: true` in client/server/edge Sentry configs and `includeLocalVariables: true` in server config. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/65 |
| P2 | Local migration filenames diverge from live migration history | Phase 3 compared local migration filenames against Supabase migration history. Later local timestamps differ from applied live timestamps, reducing reproducibility confidence. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/55 |
| P2 | UK/London date and minimum-notice behavior needs explicit hardening | Prior evidence found timezone-sensitive booking window/minimum notice paths should be made explicitly Europe/London aware. | https://github.com/mamdouhmhed-235/rahmatherapy-next-refactor/issues/54 |

## Security Readiness Assessment

RLS and grants are no longer the main blocker. Public raw access appears blocked for sensitive tables, and advisor output is clean. The remaining launch blockers are data integrity and privacy:

- Booking creation must be atomic enough to prevent partial records and overbooking under concurrent submissions.
- Sentry must be configured to avoid sending health notes, addresses, customer contact details, consent context, admin notes, or server locals unless explicitly scrubbed.
- Migration history must be reproducible before production deployment and rollback planning.

## Validation Results

| Check | Result |
| --- | --- |
| `pnpm lint` | Passed |
| `pnpm build` | Passed |
| `git diff --check` | Passed |
| Supabase security advisor | Passed, no security lints |
| RLS summary | RLS enabled on inspected public tables |
| Test data cleanup | Confirmed zero `audit_phase` auth users, clients, and bookings |

## Recommended Order

1. Move booking creation into a transactional server-side database function or equivalent locking path.
2. Review and harden Sentry privacy defaults before public launch.
3. Normalize migration history or document the exact production migration source of truth.
4. Re-test concurrent booking, partial failure rollback, and RLS runtime checks.
