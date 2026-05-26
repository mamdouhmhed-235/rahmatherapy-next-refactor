# C-A.1 #21 — `/admin/roles` + `/admin/roles/[roleId]` audit

**Surface:** role catalog + role-permission editor
**Audit type:** C-A.1 discovery
**Date:** 2026-05-25 | **Pre-state:** HEAD `75a11eb`.
**Source:** subagent + Owner @ 1280.
**Screenshot:** `screenshots-21-roles/owner-1280.png`.

## Bugs
- **B-95** `DangerZonePanel.tsx:115` — `data-redesign-fake="delete-role"`. Delete button + dialog exist but submission handler "rejects silently". Pre-ship scaffolding per brief.
- **B-96** `DangerZonePanel.tsx:85` — 1 unguarded `animate-spin` (deactivate/reactivate).

## Strengths
- **PE-58** Delete RBAC + cascade guard: `canManageRoleTemplates()` (owner only); deletion disabled if staff assigned; system roles can't be deleted. **Even though deletion is stubbed, the guard pattern is correct** — ready to wire up.
- **PE-59** Privileged / Operational role tier separation.

## Items for plans
| # | Finding | Item | Home |
|---|---|---|---|
| 1 | B-95 wire up delete | Plug submission to actions.ts | C-12+ |
| 2 | B-96 spinner motion-reduce | motion-safe: | C-11 |

*End of roles audit.*
