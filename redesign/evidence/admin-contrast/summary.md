# Admin contrast sweep — combined summary

Generated 2026-08-12T12:55:22.777Z. Mode: report-only (no failure ceiling set — always passes, findings recorded for the ratchet).

## Per role / theme totals

| Role | Theme | Audited | Redirected | Denied inline | Unreachable | Failures |
|---|---|---|---|---|---|---|
| UNAUTHENTICATED | dark | 2 | 0 | 0 | 0 | 1 |
| UNAUTHENTICATED | light | 2 | 0 | 0 | 0 | 0 |
| OWNER | dark | 24 | 0 | 0 | 5 | 113 |
| OWNER | light | 24 | 0 | 0 | 5 | 544 |
| ADMIN | dark | 22 | 0 | 1 | 6 | 113 |
| ADMIN | light | 22 | 0 | 1 | 6 | 612 |
| COORDINATOR | dark | 15 | 0 | 8 | 6 | 31 |
| COORDINATOR | light | 15 | 0 | 8 | 6 | 250 |
| THERAPIST_A | dark | 8 | 0 | 12 | 9 | 1 |
| THERAPIST_A | light | 8 | 0 | 12 | 9 | 80 |

## Roles not included in this run

All roles ran.

## INACTIVE (negative path — not contrast-audited)

Confirmed: INACTIVE credentials, when present, are redirected away from `/admin/dashboard` back to `/admin/login`.
