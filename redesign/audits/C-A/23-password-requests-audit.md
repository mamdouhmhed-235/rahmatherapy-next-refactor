# C-A.1 #23 — `/admin/account-password-requests` audit

**Surface:** password-reset request queue (pending / approved / rejected / expired / all)
**Audit type:** C-A.1 discovery
**Date:** 2026-05-25 | **Pre-state:** HEAD `75a11eb`.
**Source:** subagent + Owner @ 1280.
**Screenshot:** `screenshots-23-password-requests/owner-1280.png`.

## Bugs
- **B-97** `ApproveModal.tsx:74` + `RejectModal.tsx:72` — `data-redesign-backend="FAKE"` on note textareas. **Notes typed during approve/reject are not persisted.** Bug: data loss UX.
- **B-98** Two unguarded `animate-spin` (`ApproveModal.tsx:21`, `RejectModal.tsx:21`).
- **B-99** No pagination on the request list (all loaded). Maps to C-09 — but typical volume is low.

## Strengths
- **PE-60** RBAC tight (`MANAGE_ACCOUNT_PASSWORD_REQUESTS`).
- **PE-61** Self-approval blocked server-side.
- **PE-62** 5-tab lifecycle: pending / approved / rejected / expired / all.

## Items for plans
| # | Finding | Item | Home |
|---|---|---|---|
| 1 | B-97 — notes not persisted | Persist the textarea content | C-12+ data hygiene |
| 2 | B-98 — animate-spin × 2 | motion-safe: | C-11 |

*End of password-requests audit.*
