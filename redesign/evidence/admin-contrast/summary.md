# Admin contrast sweep — combined summary

Generated 2026-08-10T22:13:18.166Z. Mode: report-only (no failure ceiling set — always passes, findings recorded for the ratchet).

## Per role / theme totals

| Role | Theme | Audited | Redirected | Denied inline | Unreachable | Failures |
|---|---|---|---|---|---|---|
| UNAUTHENTICATED | dark | 2 | 0 | 0 | 0 | 2 |
| UNAUTHENTICATED | light | 2 | 0 | 0 | 0 | 0 |
| OWNER | dark | 24 | 0 | 0 | 5 | 595 |
| OWNER | light | 24 | 0 | 0 | 5 | 467 |
| ADMIN | dark | 22 | 0 | 1 | 6 | 577 |
| ADMIN | light | 22 | 0 | 1 | 6 | 441 |
| COORDINATOR | dark | 15 | 0 | 8 | 6 | 202 |
| COORDINATOR | light | 15 | 0 | 8 | 6 | 216 |
| THERAPIST_A | dark | 8 | 0 | 12 | 9 | 59 |
| THERAPIST_A | light | 8 | 0 | 12 | 9 | 56 |

## Roles not included in this run

All roles ran.

## INACTIVE (negative path — not contrast-audited)

Confirmed: INACTIVE credentials, when present, are redirected away from `/admin/dashboard` back to `/admin/login`.
