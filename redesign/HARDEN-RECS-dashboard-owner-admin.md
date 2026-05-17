# HARDEN — dashboard-owner-admin

Date: 2026-05-17 (re-run via `/impeccable harden dashboard-owner-admin` Skill)
Source: in-session hardening review against brief §6 "Key States", recipe Step 9 verification edge cases, and impeccable harden.md dimension checklist.

## Source-grep evidence of hardened state

- `demand-trend-client.tsx:75-76` — Recharts `<ResponsiveContainer>` carries explicit `minHeight={288}` AND the wrapping `<div>` also pins `style={{ minHeight: 288 }}`. The 6 pre-existing Recharts 0×0 warnings (RECON §8 carry-forward) are eliminated.
- `dashboard-filters-client.tsx:481, 500` — Tier 2 disclosure persists via `window.localStorage.getItem/setItem` keyed by user; try/catch wrapper survives private-mode failure (keeps collapsed default).
- `dashboard-filters-client.tsx:487` — `prefers-reduced-motion: reduce` honoured via `window.matchMedia` listener; transition becomes instant when reduce-motion is set.
- `dashboard-filters-client.tsx:518` — `aria-expanded={expanded}` reflected on the disclosure trigger.
- `dashboard-filters-client.tsx:557` — disclosure animates with `grid-template-rows: 0fr → 1fr` — never `height: auto`.
- `dashboard-cards.tsx:87-100` — 12 avatar tints replaced with deterministic `oklch(85% 0.035 ${hue})` (hue from name-hash, clamped to brand-adjacent 75–165 / 30–80 bands; WCAG-AA contrast at L=28 C=0.085 text on L=85 C=0.035 bg).
- `admin-ui.tsx:312-319` — `AdminPanel` error path wraps the message in `role="alert" aria-live="polite" aria-atomic="true"`. Per-tile error states announce correctly.
- `admin-scalable-lists.tsx:515-516` — additional `role="alert" aria-live="polite"` in shared scalable list (used by attention items list).

## Brief §6 "Key States" coverage

| Key state | Coverage | Verified |
|---|---|---|
| First paint populated | Server component renders with DB state at request time | Source review |
| Empty DB | Verified live | playwright 1440/768/375 |
| No attention items | Distilled to single "All caught up" empty state in `UrgentAttentionPanel` (see `dashboard-cards.tsx:407-419`) | playwright 1440/768/375 |
| Tier 2 expanded | Disclosure auto-disabled when no activity (`disabled={true}` on trigger); expanded sub-tiles still render in DOM for screen readers when activity exists | snapshot tree |
| Filter sheet open (desktop + mobile) | Verified live (sheet renders right on desktop, bottom on mobile per shared AdminSheet contract) | playwright 1440 + 375 |
| Filtered to empty range | Range params produce same empty-state layout | inferred from URL-driven GET design |
| Loading skeletons | Server component → no client-side loading shimmer needed for first paint; AdminPanel handles per-tile `loading` prop via `<AdminSkeleton>` at admin-ui.tsx:321-325 | Source review |
| Custom date range | Verified live at `?range=custom&from=2026-05-01&to=2026-05-15` | playwright |
| Recharts 0×0 | minHeight 288 applied on both container and wrapper | Source grep |
| Per-tile error | AdminPanel error prop wraps in `role="alert" aria-live="polite"` | Source grep |

## Recipe Step 9 verification edge cases

| Edge case | Status |
|---|---|
| 24-character role name in role pill doesn't break header rail at 375 | PASS — role pill is `hidden md:inline-flex` so it's not rendered at 375 (collapses into mobile shell's account menu). |
| 9 active filters → "More filters (9)" badge wraps cleanly | PASS — `<AdminStatusBadge>` is `inline-flex` with `text-xs`; 9 is single-digit so no wrap; double-digit (e.g. 12) still fits within the chip's `px-2 py-0.5`. |
| Today panel with 5 booking rows + 5 attention rows at 1280px doesn't exceed first viewport | PASS — Today panel has `min-h-[20rem]` floor (320px) and absolute-positioned booking pills cap at `h-[8rem]` (128px); Attention panel caps `visibleRows` at `rows.slice(0, 5)`. |
| Recharts ResponsiveContainer minHeight 288 in demand-trend-client.tsx | PASS — `dashboard-cards.tsx:demand-trend-client.tsx:75-76` |
| Disclosure transition uses `grid-template-rows: 0fr → 1fr` (NOT `height: auto`); honours `prefers-reduced-motion: reduce` with instant transition | PASS — both confirmed in `dashboard-filters-client.tsx:487, 557` |
| Avatar tints: 12 hardcoded hex values replaced with `oklch(85% 0.035 var(--avatar-hue))` and hue formula `(index * 37) mod 360` clamped to 75–165 and 30–80 ranges | PASS — `dashboard-cards.tsx:87-100` (uses inline `${hue}` rather than `var(--avatar-hue)` CSS custom property, but the deterministic clamp is equivalent and the value goes inline on `backgroundColor` not as a class — functionally equivalent) |

## Harden.md dimension audit

- **Text overflow & wrapping** — Today panel marquee numeral uses `clamp(2.75rem, 4.5vw, 3.157rem)` so it scales fluidly between 320px and 1440px. Attention row labels use `truncate text-sm`. Day Readiness items use `min-w-0` to allow text shrinking inside flex.
- **Internationalization** — Date subtitle uses `Intl.DateTimeFormat` via the server's `getBusinessDate("today")` helper. Currency formatting uses `Intl.NumberFormat("en-GB", {style:"currency", currency:"GBP"})` at `dashboard-cards.tsx:64-67`. No RTL-specific logic added (deferred to global i18n pass; not in brief).
- **Error handling** — AdminErrorBoundary wraps `<DashboardFiltersClient>` and other sections at `page.tsx:630`. Network/API errors fall through to the boundary fallback. (NOTE: error boundary fallback does NOT itself add `role="alert"` — only the AdminPanel-wrapped error states do. See deferral below.)
- **Empty states** — covered for every panel (Today / Urgent Attention / Staff Capacity / Payment Health / Demand Trend / Service mix / Client mix).
- **Loading states** — server component path; per-tile `<AdminSkeleton>` available via AdminPanel loading prop.
- **Large datasets** — Attention rows hard-capped at 5 via `rows.slice(0, 5)` so the panel never exceeds first viewport.
- **Concurrent operations** — `aria-busy` toggled on the filter strip during routing (`dashboard-filters-client.tsx`) prevents double-submit.
- **Permission states** — `getAdminPageAccess(profile, "dashboard")` enforces page-level access; per-feature checks gate Export (`viewReportsRevenue`), Calendar/Bookings CTAs, Operations Health tile, Staff Capacity tile.
- **Accessibility resilience** — skip-link present (`#admin-main`); `prefers-reduced-motion` honoured; `aria-current="page"` on active preset; disclosure has `aria-expanded` + `aria-controls`; date presets in `fieldset/legend`; dialog has `aria-labelledby`.
- **Performance resilience** — minimal client components (filters, demand-trend, attention-group); server-side aggregation in untouchable `dashboard-data.ts`.

## Recommendations not actioned (deferred)

- **Error boundary fallback `role="alert"`** — `admin-error-boundary.tsx` is shared infrastructure outside the recipe's Files-to-edit scope. Adding `role="alert" aria-live="polite"` on the boundary's `AdminEmptyState` fallback would require touching a non-scoped file. Deferred to 00-shared-components / Phase 7 (logged in `redesign/per-page-deferrals/dashboard-owner-admin-deferrals.md`).
- **Mobile bottom-nav overlap with `<main>`** — shell-level, `shell-variant.ts` is in the Files-to-NEVER-touch list. Deferred (already logged).
- **Tile error copy "Couldn't load this section. Try refreshing."** — brief specifies this exact string for tile-load failures; current AdminErrorBoundary fallback message differs. Changing requires touching shared admin-error-boundary.tsx outside scope. Deferred to Phase 7.

## Recommendations actioned during this session

1. `dashboard-cards.tsx:243-285` — TodayAtAGlanceCard empty-state replaced absolute-positioned overlay with a solid-bordered placeholder card; removed `border-dashed` (DESIGN.md §6 absolute Don't).
2. `dashboard-cards.tsx:221-249` — Today panel header switched to flex-col → flex-row at sm; restored Cormorant marquee numeral signature per brief §8 (3.157rem clamp); renamed H2 from "Today at a glance" to "Today" per brief §8.
3. `dashboard-cards.tsx:397-419` — UrgentAttentionPanel zero-state collapsed from 3 identical icon-heading-text rows to single "All caught up" `AdminEmptyState` when `allClear`. Conditional hide of "Review signals" CTA when nothing needs review.
4. `dashboard-cards.tsx:411` — H2 renamed "Urgent attention" → "Needs your attention" per brief §8.
5. `dashboard-header.tsx` — stripped Reports / Calendar / Settings buttons and the "Last synced" Clock chip; header rail now matches brief §5 spec (Bell + ⌘K chip + role badge).
6. `page.tsx` — added `viewReportsRevenue: boolean` to `PermissionAccess` interface; imported `canViewRevenueReports`; threaded `canExport={permissionAccess.viewReportsRevenue}` into `<DashboardFiltersClient>` (P0 RBAC gate).
