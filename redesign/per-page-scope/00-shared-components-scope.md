# Per-Page Scope: 00-shared-components

**Phase 6 Session:** 1 of 29  
**Date:** 2026-05-13  
**Brief:** `/redesign/briefs/00-shared-components-brief.md`

This file is the scope contract. Step 8 commit diffs actual changes against this list. Anything outside "Files to edit" is scope creep.

---

## Files to edit

- `src/styles/tokens.css` — add `--admin-border-form` (Form Seam, oklch 55%) and `--admin-surface-input` (Input Ground, oklch 98.5%) tokens
- `src/components/ui/button.tsx` — add admin CVA variants: `admin-primary`, `admin-secondary`, `admin-destructive`, `admin-ghost` (additive; all existing variants unchanged)
- `src/app/admin/layout.tsx` — wire `getNavNotifications`; fix skip-link text; pass `notifications` prop to `AdminTopNav`
- `src/app/admin/components/AdminTopNav.tsx` — full Clinic Green chrome restyle; three-zone desktop (brand / center nav / right rail); variant-aware nav per §11; `aria-current="page"`; mobile sheet slides from left; `NotificationBell` in right rail
- `src/app/admin/components/AdminCommandSearch.tsx` — restyle palette to DESIGN.md tokens; preserve `id="admin-command-search"`
- `src/app/admin/components/admin-ui.tsx` — restyle all primitives to token system; `AdminStatusBadge` self-contained (icon + label, no Badge import); `AdminStat` value → Cormorant Garamond; `AdminEmptyState` dashed border → solid; `AdminInput` wrapper (Form Seam border); remove raw `bg-gray-100`/`text-gray-600` escapes
- `src/app/admin/components/admin-ui-interactions.tsx` — restyle `AdminSheet`, `AdminActionMenu`, `ConfirmActionModal`; copy aligned to brief §8 library
- `src/app/admin/components/EmptyState.tsx` — Urbanist title, Soft Slate body, SVG illustration slot (Lucide icon fallback), no dashed border, max-width 360px
- `src/app/admin/components/notification-bell.tsx` — remove `border-l-4` at line 403 (absolute ban); replace with full-border status-family tint
- `src/app/admin/dashboard/dashboard-cards.tsx` — remove `border-l-4` at line 128 (absolute ban); replace with full-border status-family tint
- `src/app/admin/dashboard/attention-group-client.tsx` — replace `bg-black/35` scrim at line 144 with `oklch(12% 0.01 165 / 0.35)` green-tinted overlay
- `src/app/admin/components/admin-scalable-lists.tsx` — replace `var(--rahma-blue)` / `var(--rahma-green)` public-site token escapes with admin token system in `SavedViewTabs`

**New files:**
- `src/app/admin/components/nav-notifications.ts` — minimal server-side notification query (3-table count: unassigned bookings + failed emails + open ops events); returns `NotificationItem[]`

---

## Files to NEVER touch

- `src/middleware.ts` — auth cookie refresh + route protection
- `src/app/admin/signout/route.ts` — POST signout endpoint
- `src/app/admin/components/search-actions.ts` — `searchAdminCommand` server action
- `src/app/admin/shell-variant.ts` — variant resolver (read-only reference)
- `src/lib/auth/**` — RBAC matrix + page access resolver
- `src/lib/supabase/**` — client factories
- All `src/app/admin/*/actions.ts` — every server action file
- `src/app/admin/dashboard/dashboard-data.ts` — dashboard data fetcher
- `src/app/admin/dashboard/page.tsx` — dashboard page (handled in session 8; NotificationBell duplication is a known temporary state)
- `src/app/admin/reports/reporting.ts` and siblings — reporting engine
- `src/app/admin/bookings/access.ts`, `format.ts` — booking helpers
- `src/app/admin/clients/access.ts`, `format.ts` — client helpers
- `src/app/admin/staff/team-access.ts` — team access helper
- `supabase/migrations/**` — database migrations
- `next.config.ts`, `wrangler.jsonc`, `open-next.config.ts` — build/config files
- `src/components/ui/badge.tsx` — public site uses this; AdminStatusBadge is self-contained
- `src/components/ui/input.tsx` — public site uses this; AdminInput wrapper in admin-ui.tsx
