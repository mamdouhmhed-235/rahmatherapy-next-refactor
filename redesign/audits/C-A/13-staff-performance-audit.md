# C-A.1 #13 — `/admin/staff/[staffId]/performance` audit

**Surface:** `/admin/staff/[staffId]/performance` (B-3 surface — manager-view of a staff member's performance)
**Audit type:** C-A.1 discovery (no fixes)
**Date:** 2026-05-25
**Pre-state:** branch `redesign/start-state` HEAD `4d87d43`.
**Source:** `page.tsx` (145 LOC, me — full read). The heavy lifting is in shared `<PerformanceSurface>` consumed by `/admin/me` too — that's audit #14.
**Roles swept:** Owner @ 1280 on `Test Therapist`. Self-redirect logic verified at code (viewer.id === staffId → /admin/me).
**Screenshots:** 1 PNG.

---

## 1 — Bugs found

### B-63 — No `inactive_since` column on `staff_profiles` — inactive pill ships date-less
**Severity:** very low (documented limitation)
**Source:** verified at `page.tsx:114-117` inline comment + line 117 `inactiveSinceLabel = isInactive ? "Inactive" : undefined`. Code comment says "A future migration could thread the deactivation date through and append 'since {date}'".
**Decision:** flag for C-12+ migration when deactivation history becomes relevant. Not blocking.

### B-64 — `targetShellFromRoleName` falls back to "therapist" for unknown / inactive roles
**Severity:** very low (documented design choice)
**Source:** `page.tsx:40-52` switch + comment "Inactive targets fall back to therapist tile set per brief §6 + AUDIT G5 (most deactivations are deactivated therapists)".
**Status:** intentional fallback. Accept.

---

## 2 — Visual issues

### V-37 — Range chips differ from dashboard: Today / This week / This month / Custom (no "Last 30 days")
**Source:** verified live DOM. Dashboard offers 5 chips (#01 audit), performance offers 4. Consistent with the B-3 + B-4 specs but worth surfacing for C-07 (routing / consistency) — users may expect parity.

### V-38 — H1: "Performance — Test Therapist" (entity-as-suffix)
**Source:** verified live. ✅ Clean.

---

## 3 — Empty / edge states

### E-29 — Sections render: Sessions per week / Recent activity / My upcoming work
**Source:** verified live. Same shell as `/admin/me` per B-3 plan.

---

## 4 — Cross-role inconsistencies

### CR-24 — Self-redirect to /admin/me when viewer.id === staffId
**Source:** verified `page.tsx:66`. Canonical URL for self is /admin/me; manager URL for others is here. ✅ Clean single-source-of-truth.

### CR-25 — `getStaffTeamAccess(viewer).canViewAdminFields` gates the route
**Source:** verified `page.tsx:68-76`. Non-admin viewers get AdminAccessDenied.

---

## 5 — Cross-viewport issues

### CV-28 — Visual layout inherited from `<PerformanceSurface>` shared with /admin/me
**Decision:** all viewport audit lands on #14 /admin/me.

---

## 6 — Console / network issues

### CN-26 — 0 errors / 0 warnings.

---

## 7 — Pre-existing items the audit accepts

### PE-39 — Thin StaffProfile constructed (`page.tsx:96-109`) — target is read-only here
**Source:** verified. Avoids fan-out role_permissions + overrides fetch per render (4 queries saved). Per inline comment. ✅ Smart.

### PE-40 — RBAC narrowing: viewer's permissions drive data fetch; target.id scopes audit log + scorecard
**Source:** verified `page.tsx:1-5` doc-comment. ✅ Accept.

---

## 8 — Items for plans

| # | Finding | Item | Home |
|---|---|---|---|
| 1 | B-63 — no inactive_since column | Migration if deactivation history becomes load-bearing | C-12+ |
| 2 | V-37 — range chip parity dashboard vs performance | Decide consistent range-chip set | C-07 |

---

## 9 — Hand-off

**State:** 1 screenshot. 0 code changes. Thin wrapper; most findings will land on #14 /admin/me audit (which exercises the shared `<PerformanceSurface>`).
**Next surface:** #14 `/admin/me` — HIGH priority, C-09 known hazard (Recent Activity grows unboundedly per master plan).

*End of staff-performance audit.*
