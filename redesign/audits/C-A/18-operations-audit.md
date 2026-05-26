# C-A.1 #18 — `/admin/operations` audit

**Surface:** `/admin/operations` (system events queue — severity filtering, status transitions)
**Audit type:** C-A.1 discovery
**Date:** 2026-05-25 | **Pre-state:** HEAD `27c30aa`.
**Source:** page.tsx, operations-board.tsx, event-row.tsx, actions.ts, error.tsx. Subagent + Owner @ 1280.
**Screenshots:** `screenshots-18-operations/owner-1280.png`.

---

## Bugs

### B-80 — Four `data-redesign-fake` markers + one `data-redesign-needs-photo`
**Severity:** medium (acknowledged tech debt)
**Source:** subagent `page.tsx:158, :224, :250`, `event-row.tsx:169`, `operations-board.tsx:210` (`data-redesign-needs-photo="operations-clear.svg"`). Same pattern as #08 enquiries / #10 staff list.

### B-81 — Three unguarded `animate-spin`
**Source:** subagent `event-row.tsx:312, :338`, `operations-board.tsx:355`.

### B-82 — Keyboard shortcuts (o/a/r) at `operations-board.tsx:57-61` not user-discoverable
**Severity:** low (a11y / UX — power-user feature hidden)
**Source:** subagent. Shortcut map exists but no inline hint in UI.

---

## Strengths

### PE-47 — Pagination IS implemented (50 per column + Load More)
**Source:** subagent `operations-board.tsx:18-20 initialPageSize=50`, `:387-399` Load more button per column. **First surface I've seen with proper pagination + load-more.** Reference for C-09 fix patterns.

### PE-48 — Bulk operations: `bulkResolveOpen()` resolves all open events
**Source:** subagent `operations-board.tsx:135-186`. ✅ Useful for triage.

### PE-49 — Status transitions only (open → acknowledged → resolved), not delete
**Source:** subagent. Audit-preserved, consistent with the immutable-record discipline of bookings.

### PE-50 — Mobile tab strip at lg breakpoint
**Source:** subagent `operations-board.tsx:250-290`. Adaptive UX.

---

## RBAC

`canManageOperations()` at action level + page-level `getAdminPageAccess(profile, "operations")` gate. ✅ Solid.

---

## Items for plans

| # | Finding | Item | Home |
|---|---|---|---|
| 1 | B-80 — 5 redesign markers | Mark for redesign-finish pass | C-12+ |
| 2 | B-81 — animate-spin | motion-safe: | C-11 |
| 3 | B-82 — keyboard shortcut discoverability | Add visible kbd hint | C-12+ |
| — | PE-47 pagination pattern | Use as template for C-09 across list surfaces | C-09 (lessons) |

---

*End of operations audit.*
