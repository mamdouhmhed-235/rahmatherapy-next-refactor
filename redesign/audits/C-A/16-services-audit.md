# C-A.1 #16 — `/admin/services` audit

**Surface:** `/admin/services` (service catalog — packages + add-ons; gender restrictions)
**Audit type:** C-A.1 discovery
**Date:** 2026-05-25 | **Pre-state:** HEAD `27c30aa`.
**Source:** `page.tsx` (286), DeleteServiceButton.tsx, ServiceFormDialog.tsx, ServiceRowActions.tsx, actions.ts, error.tsx. Subagent + Owner @ 1280.
**Screenshots:** `screenshots-16-services/owner-1280.png`.

---

## Bugs

### B-74 — Two unguarded `animate-spin`
**Source:** subagent `DeleteServiceButton.tsx:130`, `ServiceRowActions.tsx:67`. Same pattern.

### B-75 — No pagination
**Severity:** very low (services scale tiny — typically 5-20). Accept.

### B-76 — No bulk delete
**Severity:** low. Per-row delete only. Acceptable for low-row-count.

---

## Visual

### V-43 — In-use guard works (subagent verified)
**Source:** `DeleteServiceButton.tsx:50-68` (`hasHistoricalBookings`) + server-side `actions.ts:195-206` validates `booking_items` count. ✅ Solid.

---

## RBAC + delete (C-06 relevance)

### CR-28 — Delete IS present here (only surface so far with row-delete) — `PERMISSIONS.MANAGE_SERVICES` gates it
**Source:** subagent `page.tsx:103, actions.ts:97-100`. **The services surface is the existing pattern for "delete with in-use guard" that C-06 should adopt for clients/bookings (if user wants hard delete).** Lift the `hasHistoricalBookings` predicate as a template.

---

## Hardcoded

### B-77 — `GENDER_LABEL` / `GENDER_TOOLTIP` maps + "Uncategorised" hardcoded
**Source:** subagent `page.tsx:27-37, :53`. Standard. Accept.

---

## Items for plans

| # | Finding | Item | Home |
|---|---|---|---|
| 1 | CR-28 pattern lift | Use as template for C-06 delete | C-06 |
| 2 | B-74 animate-spin | motion-safe: | C-11 |

---

*End of services audit.*
