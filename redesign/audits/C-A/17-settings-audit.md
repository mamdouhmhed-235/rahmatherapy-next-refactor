# C-A.1 #17 — `/admin/settings` audit

**Surface:** `/admin/settings` (clinic-wide settings — upsert-only single record)
**Audit type:** C-A.1 discovery
**Date:** 2026-05-25 | **Pre-state:** HEAD `27c30aa`.
**Source:** page.tsx, SettingsForm.tsx, actions.ts, error.tsx. Subagent + Owner @ 1280.
**Screenshots:** `screenshots-17-settings/owner-1280.png`.

---

## Bugs

### B-78 — `SettingsForm.tsx:427` unguarded `animate-spin`
**Severity:** low. INCONSISTENT — same file has `motion-safe:[animation:rahma-fade-up_200ms_ease-out]` at :218-221 + animate gates at :489, :505 done correctly. Spinner is the one omission.

### B-79 — No "concurrent edit" or version-check guard
**Severity:** medium (data hygiene — two admins could overwrite each other's saves)
**Source:** subagent — settings is upsert-only with no `updated_at` optimistic-lock check.
**Decision:** flag for C-12+ ops resilience.

---

## Strengths

### PE-45 — Mobile sticky save bar repositions at md breakpoint
**Source:** subagent `SettingsForm.tsx:403`. Best save-bar pattern observed.

### PE-46 — aria-busy / aria-invalid / aria-describedby / aria-live all present
**Source:** subagent `SettingsForm.tsx:422, 565, 564, 195-196`. ✅ Strong a11y.

---

## RBAC

`PERMISSIONS.MANAGE_SETTINGS` at `page.tsx:76` + `requireSettingsManager()` per action. ✅ Solid.

---

## Items for plans

| # | Finding | Item | Home |
|---|---|---|---|
| 1 | B-78 unguarded spinner | motion-safe: | C-11 |
| 2 | B-79 concurrent edit risk | Optimistic-lock via updated_at | C-12+ |

---

*End of settings audit.*
