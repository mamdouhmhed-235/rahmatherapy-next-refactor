# Scope — dashboard-owner-admin (Phase 6 row 8 of 29)

Brief: `/redesign/briefs/dashboard-owner-admin-brief.md`
Recipe: `/redesign/per-page-recipes/dashboard-owner-admin-recipe.md`

## Files to edit

- `src/app/admin/dashboard/page.tsx` — Tier 1 (Today + Urgent Attention always visible) + Tier 2 (Business Overview disclosure, collapsed by default, localStorage-persisted per user); pass tier composition down per role.
- `src/app/admin/dashboard/dashboard-header.tsx` — Fold `NotificationBell` into the header right rail; add live date + locality subtitle ("Tuesday 12 May 2026 · Luton"); add Restricted-family role badge ("Owner" / "Admin"); add cmd-K hint chip (desktop only). H1 "Today at Rahma".
- `src/app/admin/dashboard/dashboard-filters-client.tsx` — Replace 9-field filter row with 5 date-preset pills (with `aria-current="page"`) + "More filters" Ghost trigger that opens an `AdminSheet` holding the remaining 7 filters. All 9 GET `name` attributes preserved verbatim (`range`, `from`, `to`, `city`, `service`, `staffId`, `source`, `status`, `paymentStatus`). Active-filter count badge on "More filters" pill in Pending family. Date-range "Custom" reveals `from`/`to` inputs inline (desktop) or in small AdminSheet (mobile). Export Ghost gated on `view_reports_revenue` carries current filter state to `/admin/reports/export?...`. Mobile: chip strip horizontal momentum-scroll.
- `src/app/admin/dashboard/dashboard-cards.tsx` — Remove `border-l-4` at lines 128/417; tokenise 12 hardcoded staff-avatar hexes → deterministic `oklch(85% 0.035 var(--avatar-hue))` where `--avatar-hue = (index * 37) mod 360` clamped to 75–165 and 30–80; replace raw chart hexes (`#5b8dd9`, `#a8d1bd`) with `accent-amber` + Focus Azure fallback; replace `bg-gray-100`/`text-gray-600` with tokens; rebuild `UrgentAttentionPanel` with Pending-family tint background (no left-stripe) and shift to Confirmed family tint when count = 0; restyle `TodayAtAGlanceCard` with marquee Cormorant numeral + compact BookingListCard rows + "See all N for today →" overflow.
- `src/app/admin/dashboard/attention-group-client.tsx` — Remove `bg-black` at line 144 → `oklch(12% 0.014 155)` (brand-green-tinted dark); preserve `id="attention-dialog-title"`.
- `src/app/admin/dashboard/demand-trend-client.tsx` — Recharts `ResponsiveContainer` gets explicit `minHeight: 288` (kills 6 pre-existing warnings); chart accent → `accent-amber` (`oklch(69% 0.142 72)`) with Focus Azure fallback; preserve `<linearGradient id="demandGradient">`.
- `src/app/admin/components/notification-bell.tsx` — Remove `border-l-4` at line 403; accept `variant="header-rail"` prop for compact in-header render (24px icon, 44px touch target via padding); coordinate with 00-shared-components.

## Files to NEVER touch

- `src/app/admin/dashboard/dashboard-data.ts` — server-side data aggregation (RECON §5)
- `src/app/admin/dashboard/dashboard-helpers.ts` — pure helpers (RECON §5)
- `src/app/admin/dashboard/dashboard-data.test.ts`, `dashboard-helpers.test.ts` — tests
- `src/app/admin/dashboard/TherapistDashboard.tsx` — therapist-variant component
- `src/app/admin/shell-variant.ts` — role-to-variant resolver
- `src/middleware.ts` — Supabase session refresh / route protection
- `src/lib/auth/**` — RBAC matrix, `getAdminPageAccess`, page access resolver
- `src/lib/supabase/**` — client factories
- `supabase/migrations/**`
- `src/components/ui/card.tsx` — out of scope (fixed in 00-shared-components session)
- All build/config files (`next.config.ts`, `wrangler.jsonc`, `open-next.config.ts`, `tsconfig.json`, etc.)
