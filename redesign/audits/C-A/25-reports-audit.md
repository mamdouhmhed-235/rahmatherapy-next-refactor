# C-A.1 #25 — `/admin/reports` audit

**Surface:** B-4 reports rebuild (Money / Bookings / Performance / Demand / Insights)
**Audit type:** C-A.1 discovery — drift check vs B-4 shipped state
**Date:** 2026-05-25 | **Pre-state:** HEAD `75a11eb`.
**Source:** subagent + Owner @ 1280.
**Screenshot:** `screenshots-25-reports/owner-1280.png`.

## Bugs
- **B-102** `reporting.ts:417` — `// TODO(post-Phase-7 policy decision): bookedRevenue currently sums…` — revenue attribution logic deferred. Single TODO; documented as post-Phase-7 work, not a bug.
- **B-103** No pagination on reports — but this is per-section aggregated data, not list rendering. **N/A for C-09.**

## Strengths
- **PE-68** B-4 shipped clean. No material drift detected since shipping at `0afc4dc`.
- **PE-69** **Zero `animate-spin` in reports** — Suspense fallback uses `AdminSkeleton` (no spinner). Cleanest motion-reduce posture of any surface.
- **PE-70** Multi-tier RBAC: `canOpenReports()` + `canViewRevenueReports()` + `hasUniversalReportScope()` gate Money section.
- **PE-71** Therapist auto-locks to personal scope; Owner/Admin/Coord toggle via `?scope=personal`.
- **PE-72** CSV export deep-links preserve staffId for server-side narrowing.
- **PE-73** No `border-l-4`, clean.

## Items for plans
| # | Finding | Item | Home |
|---|---|---|---|
| 1 | B-102 — revenue attribution TODO | Post-Phase-7 policy call | out of Band C |
| — | reports surface is the cleanest in the codebase | Use as a11y/motion reference | (lessons) |

*End of reports audit.*
