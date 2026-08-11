# Admin contrast sweep — combined summary

Generated 2026-08-11T15:20:40.175Z. Mode: report-only (no failure ceiling set — always passes, findings recorded for the ratchet).

## Per role / theme totals

| Role | Theme | Audited | Redirected | Denied inline | Unreachable | Failures |
|---|---|---|---|---|---|---|
| UNAUTHENTICATED | dark | 2 | 0 | 0 | 0 | 2 |
| UNAUTHENTICATED | light | 2 | 0 | 0 | 0 | 0 |
| OWNER | dark | 24 | 0 | 0 | 5 | 383 |
| OWNER | light | 24 | 0 | 0 | 5 | 572 |
| ADMIN | dark | 22 | 0 | 1 | 6 | 381 |
| ADMIN | light | 22 | 0 | 1 | 6 | 594 |
| COORDINATOR | dark | 15 | 0 | 8 | 6 | 63 |
| COORDINATOR | light | 15 | 0 | 8 | 6 | 299 |
| THERAPIST_A | dark | 8 | 0 | 12 | 9 | 15 |
| THERAPIST_A | light | 8 | 0 | 12 | 9 | 82 |

## Roles not included in this run

All roles ran.

## INACTIVE (negative path — not contrast-audited)

Confirmed: INACTIVE credentials, when present, are redirected away from `/admin/dashboard` back to `/admin/login`.
