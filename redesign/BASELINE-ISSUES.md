# Phase 2 — Baseline Runtime Issues

Sweep date: 2026-05-10  
Method: Playwright browser (Chromium) logged in as Owner (all 24 admin pages visited).  
Server: http://localhost:3000 (Next.js dev, Turbopack).  
DB state: seeded (`phase10_e2e` marker active).

**Phase 6 contract:** Phase 6 must produce zero NEW errors or warnings compared to this list. Pre-existing items below are not our responsibility; new items introduced by the redesign are.

---

## Console Errors

**Count: 0**

No application-level console errors on any of the 24 admin pages.

---

## Console Warnings

**Count: 6 — all on `/admin/reports` only**

| # | Page | Message | Count | Source |
|---|---|---|---|---|
| W-1 | `/admin/reports` | `The width(-1) and height(-1) of chart should be greater than 0, please check the style of container, or the props width(100%) and height(100%), or add a minWidth(0) or minHeight(288) or use aspect(undefined) to control the height and width.` | 6× | Recharts `ResponsiveContainer` — `RevenueChart` / `CountBarChart` measuring −1×−1 before paint in empty-data state |

**Root cause:** `ResponsiveContainer` instances in `RevenueChart` and `CountBarChart` (and the demand-trend mini-chart in `dashboard/dashboard-cards.tsx`) measure −1×−1 before the component tree paints when there is no data. The dashboard demand-trend chart did not trigger this warning during this sweep (possibly renders with a non-zero initial size or has a guard).

**Pre-existing:** Yes — confirmed in Phase 0 recon (§8). **In scope for Phase 6 fix** (user confirmed: add explicit `minHeight: 288` to `ResponsiveContainer`s).

---

## Failed Network Requests

**Count: 0**

No failed requests on any page. Full non-static request log from the sweep:

| # | Method | URL | Status | Purpose |
|---|---|---|---|---|
| 1 | POST | `/monitoring` → `/monitoring/` | 308 → 200 | Sentry error-monitoring tunnel (trailing-slash redirect, then OK) |
| 2 | POST | `/monitoring` → `/monitoring/` | 308 → 200 | Sentry (repeat) |

The 308 redirect on `/monitoring` → `/monitoring/` is expected behaviour from `trailingSlash: true` in `next.config.ts`. Sentry receives the POST fine (200 OK after redirect). Not an issue.

---

## Dev-Only Noise (not issues)

The following appeared in earlier Playwright sessions but are **not application issues**:

- `WebSocket connection to 'ws://localhost:3000/_next/webpack-hmr?id=...' failed: net::ERR_CONNECTION_REFUSED` — Next.js Turbopack HMR socket from isolated Playwright browser context. Never reaches production builds. Pre-existing, confirmed in Phase 0 §8.

---

## Page-by-Page Summary

| Page | Errors | Warnings | Failed requests |
|---|---|---|---|
| `/admin/login` | 0 | 0 | 0 |
| `/admin/dashboard` | 0 | 0 | 0 |
| `/admin/bookings` | 0 | 0 | 0 |
| `/admin/bookings/<id>` | 0 | 0 | 0 |
| `/admin/bookings/new` | 0 | 0 | 0 |
| `/admin/calendar` | 0 | 0 | 0 |
| `/admin/clients` | 0 | 0 | 0 |
| `/admin/clients/<id>` | 0 | 0 | 0 |
| `/admin/clients/new` | 0 | 0 | 0 |
| `/admin/emails` | 0 | 0 | 0 |
| `/admin/enquiries` | 0 | 0 | 0 |
| `/admin/operations` | 0 | 0 | 0 |
| `/admin/privacy` | 0 | 0 | 0 |
| `/admin/reports` | 0 | **6** (W-1) | 0 |
| `/admin/roles` | 0 | 0 | 0 |
| `/admin/roles/<id>` | 0 | 0 | 0 |
| `/admin/services` | 0 | 0 | 0 |
| `/admin/settings` | 0 | 0 | 0 |
| `/admin/availability` | 0 | 0 | 0 |
| `/admin/staff` | 0 | 0 | 0 |
| `/admin/staff/<id>` | 0 | 0 | 0 |
| `/admin/staff/<id>/availability` | 0 | 0 | 0 |
| `/admin/audit` | 0 | 0 | 0 |

**Total: 0 errors · 6 warnings (one page) · 0 failed requests**
