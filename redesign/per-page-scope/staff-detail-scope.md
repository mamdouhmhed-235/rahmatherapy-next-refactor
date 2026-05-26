# Per-page scope — staff-detail

Worktree: `agent/staff-detail-redesign` off `redesign/start-state`.
Recipe: `/redesign/per-page-recipes/staff-detail-recipe.md`
Brief: `/redesign/briefs/staff-detail-brief.md`

## Files to edit

- `src/app/admin/staff/[staffId]/page.tsx` — Retire decorative banner-avatar header (lines 232–258) for the flat header pattern; introduce `TabPills` with `aria-current="page"`; rebuild as two-column workstation grid (`xl:` `1fr 22rem`); fixed panel order L1 (profile) / L2 (assignments) / L3 (audit) and R1 (status & identity) / R2 (profile completion) / R3 (onboarding) / R4 (role + permissions) / R5 (permission overrides); strip raw `view_staff` permission identifier on denied surfaces (lines 91 + 121); split denied into out-of-team vs out-of-scope variants; checklist icons → Confirmed/Cancelled status families; cross-link Ghosts ("Show all assignments →" / "Open audit trail →" / "Open availability →").
- `src/app/admin/staff/[staffId]/StaffProfileForm.tsx` — Restyle to DESIGN.md Input spec; required `*` markers; per-field `role="alert" aria-live="polite"` wrappers; preserve every field `name` attribute and the server-action contract verbatim.
- `src/app/admin/staff/[staffId]/StaffPermissionOverridesForm.tsx` — Restyle row composition (scope chip + risk chip + permission display + mono identifier + Switch); route critical/high-risk toggles through shared `ConfirmActionModal` (Brief 22 risk-tier matrix); preserve per-row switch contract + self-lockout protection verbatim.

## Files to NEVER touch

- `src/lib/staff/team-access.ts` — RECON §5 untouchable (`getStaffTeamAccess`, `staffProfilesFrom`, `getStaffTeamSelect`, `canEditSafeStaffProfile`).
- `src/app/admin/staff/[staffId]/actions.ts` — `StaffProfileForm` + `StaffPermissionOverridesForm` server-action contracts (RECON §6.4).
- `src/lib/auth/**`, `src/lib/supabase/**` — Auth + DB layer (RECON §5).
- `src/middleware.ts` — Inactive-staff sign-in block lives here.
- `supabase/migrations/**` — DB schema.
- All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.).
- Main tree at `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` — worktree only.
