# Per-Page Scope: 00-shared-components

**Phase 6 Session:** 1 of 29  
**Date:** 2026-05-13 (updated this session with nav redesign + RBAC fixes)  
**Brief:** `/redesign/briefs/00-shared-components-brief.md`

This file is the scope contract. Step 8 commit diffs actual changes against this list. Anything outside "Files to edit" is scope creep.

---

## Files to edit

### Already completed this session

- `src/app/admin/layout.tsx` — §12.3 null-variant redirect (no longer falls back to owner_admin); static `redirect` import added
- `src/app/admin/components/AdminTopNav.tsx` — full rewrite: desktop primary strip (daily items only, no More▾ trigger), `UserMenuButton` (named trigger ≥1024px, grouped nav sections, identity header, account actions), `AdminBottomTabBar` (mobile, fixed bottom, safe-area aware), `UserMenuSheet` (slides up from bottom); §12.1 THERAPIST_NAV_KEYS now includes "staff"; §12.2 accountRequests pageKey corrected from kebab to camelCase
- `src/components/ui/badge.tsx` — restyled to six DESIGN.md status families (confirmed/pending/cancelled/completed/attention/restricted) plus compact -sm variants
- `src/lib/auth/rbac.ts` — §12.4 MANAGE_ACCOUNT_PASSWORD_REQUESTS permission added (intentional exception to lib/auth never-touch rule — deliberate §12 fix)
- `src/lib/auth/admin-access.ts` — §12.4 accountRequests gate re-pointed to correct permission (intentional exception — deliberate §12 fix)
- `src/app/admin/components/admin-ui.tsx` — §12.5 AdminAccessDenied message prop sanitisation (strips raw permission strings); §12.8 variant-aware CTA ("Back to My day" for therapist)

### Remaining this session

- `src/components/ui/button.tsx` — restyle to DESIGN.md §5 Primary/Secondary/Destructive/Ghost variants; §12.6 icon-slot loading fix (spinner replaces leading icon, not appends)
- `src/components/ui/input.tsx` — restyle to DESIGN.md §5 Input spec: surface-input ground, Form Seam border (oklch 55%), required `*` marker in Cancelled colour, `role="alert"` error region
- `src/app/admin/components/admin-ui.tsx` — full primitive restyle pass: AdminPanel, AdminPageHeader, AdminFilterBar, AdminStat, AdminStatusBadge, AdminSkeleton, AdminMobileActionBar, AdminEntityRow, AdminActionGroup; remove any surviving raw `bg-gray-*`/`text-gray-*` token escapes; eyebrow text `uppercase` → sentence-case
- `src/app/admin/components/admin-ui-interactions.tsx` — verify/restyle AdminSheet, AdminActionMenu, AdminMenuItem, AdminFilterSheet, ConfirmActionModal against design token system
- `src/app/admin/components/AdminCommandSearch.tsx` — restyle palette to DESIGN.md tokens; preserve `id="admin-command-search"` and `searchAdminCommand` wire-up
- `src/app/admin/components/EmptyState.tsx` — verify spec compliance: Urbanist heading, Soft Slate body, SVG slot, no dashed borders, max-width 360px
- `src/app/admin/components/admin-scalable-lists.tsx` — restyle SavedViewTabs + AdminListSurface to token system

### No change needed (already clean)

- `src/app/admin/components/notification-bell.tsx` — border-l-4 confirmed absent
- `src/app/admin/dashboard/dashboard-cards.tsx` — border-l-4 and bg-black confirmed absent

---

## Files to NEVER touch

- `src/middleware.ts` — auth cookie refresh + route protection
- `src/app/admin/signout/route.ts` — POST signout endpoint
- `src/app/admin/components/search-actions.ts` — searchAdminCommand server action
- `src/app/admin/shell-variant.ts` — variant resolver (read-only reference)
- `src/lib/supabase/**` — client factories
- All `src/app/admin/*/actions.ts` — every server action file
- `src/app/admin/dashboard/dashboard-data.ts` — dashboard data fetcher
- `src/app/admin/reports/reporting.ts` and siblings — reporting engine
- `src/app/admin/bookings/access.ts`, `format.ts` — booking helpers
- `src/app/admin/clients/access.ts`, `format.ts` — client helpers
- `src/app/admin/staff/team-access.ts` — team access helper
- `supabase/migrations/**` — database migrations
- `next.config.ts`, `wrangler.jsonc`, `open-next.config.ts` — build/config files

### §12.7 intentionally left as-is

`src/lib/auth/admin-access.ts` lines 267/274 — `assign` flag on staff/staffDetail page access uses `ASSIGN_STAFF_ROLES`. This is role-template assignment (correct for the staff management page context). The booking-assignment `assign` flag at line 224 already uses `canAssignBookings`. Two distinct concepts, both correct.
