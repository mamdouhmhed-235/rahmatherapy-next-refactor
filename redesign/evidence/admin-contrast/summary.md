# Admin contrast sweep — combined summary

Generated 2026-08-12T17:34:01.697Z. Mode: report-only (no failure ceiling set — always passes, findings recorded for the ratchet).

## Per role / theme totals

| Role | Theme | Audited | Redirected | Denied inline | Unreachable | Failures |
|---|---|---|---|---|---|---|
| UNAUTHENTICATED | dark | 2 | 0 | 0 | 0 | 0 |
| UNAUTHENTICATED | light | 2 | 0 | 0 | 0 | 0 |
| OWNER | dark | 24 | 0 | 0 | 5 | 3 |
| OWNER | light | 24 | 0 | 0 | 5 | 24 |
| ADMIN | dark | 22 | 0 | 1 | 6 | 3 |
| ADMIN | light | 22 | 0 | 1 | 6 | 24 |
| COORDINATOR | dark | 15 | 0 | 8 | 6 | 3 |
| COORDINATOR | light | 15 | 0 | 8 | 6 | 20 |
| THERAPIST_A | dark | 8 | 0 | 12 | 9 | 0 |
| THERAPIST_A | light | 8 | 0 | 12 | 9 | 2 |

## Roles not included in this run

All roles ran.

## INACTIVE (negative path — not contrast-audited)

Confirmed: INACTIVE credentials, when present, are redirected away from `/admin/dashboard` back to `/admin/login`.
