# C-A.1 #14 — `/admin/me` audit

**Surface:** `/admin/me` (self-view — shared `<PerformanceSurface>` with `/admin/staff/[staffId]/performance`)
**Audit type:** C-A.1 discovery (no fixes)
**Date:** 2026-05-25
**Pre-state:** branch `redesign/start-state` HEAD `0691570`.
**Source:** `me/page.tsx` (64 LOC), `PerformanceSurface.tsx` (sampled around the activity timeline), `reporting.ts:1549-1574` `getAuditLogForStaff`. Owner @ 1280 + 375.
**Screenshots:** 2 PNGs.

---

## 1 — Bugs found

### B-65 — **MASTER-PLAN C-09 CLAIM FOR /admin/me IS STALE**
**Severity:** revision (not a bug; corrects the master plan's framing)
**Source — spot-verified at file:line:**
- `getAuditLogForStaff` (`reporting.ts:1549-1574`) has `limit = 20` default and explicit `.limit(limit)` at :1568.
- `PerformanceSurface.tsx:319` calls `fetchAuditLogForStaff(staffId, 100)` — fetches 100 rows.
- `PerformanceSurface.tsx:325` displays `events.slice(0, 20)`.
- Inline comment `:314-318`: "intentionally NOT date-filtered — the 'Recent activity' panel shows the most recent 20 actions taken by this staffer regardless of the page period filter".

**Conclusion:** the recent activity panel on /admin/me is **bounded at 20 displayed (100 fetched)**. Master plan Part 2 C-09 calls out "the Recent Activity panel on `/admin/me` for the Owner role — currently a long list that extends down the page indefinitely". **That description doesn't match the shipped state.**
**Possible reasons:**
- Master-plan finding refers to a pre-B-3 state.
- Or there's a different "Recent activity" surface elsewhere (e.g., dashboard) that has the unbounded version.

**C-B planning note for C-09:** the headline example needs a new surface. Real unbounded-list targets:
- `/admin/bookings` (list) — confirmed unbounded (#02 V-05)
- `/admin/clients` (list) — cosmetic pagination only (#05 B-23)
- `/admin/enquiries` — FAKE filter-query comments (#08 B-37)
- `/admin/staff` (list) — no pagination (#10 B-49)
- `/admin/calendar` — soft-capped at 31 days but reporting.ts query unbounded (#09 B-43)
- `/admin/bookings/[id]` audit log — top-20 cap with no pagination (#04 V-12)
- `/admin/clients/[id]` booking history — unbounded (#07 B-32)

### B-66 — Limit-100-fetch + slice-20-display is wasteful
**Severity:** very low (perf micro-issue)
**Source:** verified `PerformanceSurface.tsx:319-325`. Fetches 100, displays 20. 80 rows are wasted DB I/O per render. Probably justified by `cache()` dedup with another consumer (`KpiTileGridSection.scorecard.admin` per inline comment) — so the 100 IS shared. ✅ Accept the trade-off but flag for revisit if perf budget tightens.

---

## 2 — Visual issues

### V-39 — Page renders 2 main sections: "Activity per week" + "Recent activity"
**Source:** verified live. Plus the Personal Stripe tiles + KPI tile grid above. Consistent with B-3 spec.

### V-40 — H1: "Good evening, Minhaj."
**Source:** verified live. Time-of-day greeting + name. ✅ Warm UX.

---

## 3 — Empty / edge states

### E-30 — Activity timeline empty state (current Owner has 0 activity rows displayed)
**Source:** verified — `recentCount: 0` from DOM eval. (Owner audit log for the current period is empty.) Empty-state copy is "intentionally NOT date-filtered" per the inline comment, so this implies the Owner has zero audit events for all-time — unlikely. Worth verifying via DB.

---

## 4 — Cross-role inconsistencies

### CR-26 — Mode: "self" passed to PerformanceSurface (vs "manager" for #13)
**Source:** verified `page.tsx:53`. Same surface; different mode affects which RBAC predicates the surface uses. ✅ Clean.

---

## 5 — Cross-viewport issues

### CV-29 — Inherits responsive layout from `<PerformanceSurface>` shared component
**Status:** acceptable. Mobile renders cleanly (verified live at 375).

---

## 6 — Console / network issues

### CN-27 — 0 errors / 0 warnings.

---

## 7 — Pre-existing items the audit accepts

### PE-41 — Per-section Suspense streaming via `cache()`-deduped fetchers (4 logical fetches → 4 actual DB queries)
**Source:** verified at `me/page.tsx:1-11` doc-comment. ✅ Accept — sophisticated perf pattern.

### PE-42 — Time-of-day greeting "Good evening, {name}."
**Source:** verified live. ✅ Accept.

---

## 8 — Items for plans

| # | Finding | Item | Home |
|---|---|---|---|
| 1 | B-65 — master-plan C-09 example is stale | Update C-09 brief; choose a real unbounded surface | C-B planning |
| 2 | B-66 — fetch-100-slice-20 if cache dedup is not actually engaging | Verify dedup; downsize | C-12+ perf |
| 3 | E-30 — Owner has 0 displayed activity events | DB spot-check whether Owner truly has no audit log rows | C-B verification |

---

## 9 — Hand-off

**State:** 2 screenshots. 0 code changes. **Material correction to master plan: C-09 hazard for /admin/me does NOT match the shipped state (B-3 capped it at 20).**
**Next surface:** #15 `/admin/availability` (global, 635 LOC).

*End of admin-me audit.*
