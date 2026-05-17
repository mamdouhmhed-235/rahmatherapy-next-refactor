# Per-page scope — staff

## Files to edit
- `src/app/admin/staff/page.tsx` — replace 3-col `Card` grid with full-width `AdminPanel` of `AdminEntityRow`-style rows; add workload-at-a-glance prose strip (admin scope), filter strip (`q` / `roleId` / `gender` / `status` / `workload` / `bookable` / `onboarding`), inactive-disclosure `<details>` for admin scope, shared `EmptyState` (no `border-dashed`); member name H3→H2; remove hover-revealed "View profile" CTA; replace decorative green-tile avatar with 40px circular avatar / initialled token; remove `var(--shadow-soft-token)` resting shadow; strip raw `view_staff` from `AdminAccessDenied`; restyle status chips with named families (Active=Confirmed, Bookings off=Pending, Inactive=Restricted); workload pill ladder (0=Restricted, 1–4=Confirmed, 5–7=Pending, 8+=Attention); therapist self-row "You" chip; specialties chip-row collapses to count on `md:` and below.
- `src/app/admin/staff/NewStaffForm.tsx` — preserve `createStaffProfile` server-action call + field `name` attrs (`name` / `email` / `role_id` / `gender`) verbatim; restyle Dialog surface, inputs, and buttons to DESIGN.md tokens (Form Seam border, surface-input ground, Primary/Secondary specs); add visible required `*` markers in Cancelled text colour with `aria-hidden="true"`; wrap form-level error region in `<div role="alert" aria-live="polite" aria-atomic="true">`; replace inline validation literals with brief §10 copy verbatim; preserve `UserPlus`/`Loader2` iconography and the optimistic submit transition.

## Files to NEVER touch
- `src/lib/staff/team-access.ts` — `getStaffTeamAccess`, `getStaffTeamSelect`, `staffProfilesFrom` (RECON §5).
- `src/lib/staff/profile-access.ts` — `getStaffProfileCompletion` (RECON §5).
- `src/app/admin/staff/actions.ts` — `NewStaffForm` server-action contract (RECON §6.4).
- `src/app/admin/staff/profile-access.ts`, `src/app/admin/staff/team-access.ts` — co-located access helpers used by the page; preserved as-is per RECON §5.
- `src/app/admin/staff/[staffId]/**` — owned by Brief 28 (staff-detail), out of scope this session.
- `src/app/admin/staff/profile-access.test.ts`, `src/app/admin/staff/team-access.test.ts` — co-located tests for untouchable helpers.
- `src/lib/auth/**`, `src/lib/supabase/**` (RECON §5).
- `src/middleware.ts`.
- `supabase/migrations/**`.
- All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.).

## Backend FAKE surfaces (Phase 7 handoff markers)
- Filter strip server read path — marked `// FAKE: BUILD-staff-filter-query` and `data-redesign-backend="FAKE"` on the form. Server-side filtering degrades to a no-op until `BUILD-staff-filter-query.md` lands (BLOCKS-REDESIGN).
- Workload-at-a-glance segment counts — marked `// FAKE: BUILD-staff-workload-aggregates` and `data-redesign-backend="FAKE"` on the strip. Falls back gracefully to zeros if absent (non-blocking).
