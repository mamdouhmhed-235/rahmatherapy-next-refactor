# Per-page scope — roles (Phase 6, page 27 of 29)

## Files to edit

- `src/app/admin/roles/page.tsx` — full redesign per brief §5: replace card grid with single `AdminPanel` of `AdminEntityRow`-style rows; H2 role name (resolves Sam #1); active-roles-first sort + collapsed `<details>` "Inactive roles ({n})"; quick summary line; tonal-lift-compliant flat rows (retire `var(--shadow-soft-token)` at rest); retire decorative green `ShieldCheck` tile (replace with 40px letter token on Hover Moss); fix `AdminAccessDenied` copy to remove the raw `manage_role_templates` identifier; restyle to DESIGN.md tokens.
- `src/app/admin/roles/CreateRoleSheet.tsx` — net-new client component wrapping `AdminSheet` with the "Create role" form (fields `display_label`, `name`, `description`, `sort_order`, `active`); rendered with `data-redesign-fake="create-role"` on the submit button, `disabled`, with inline note "Create-role backend coming soon — `BUILD-create-role.md` pending." (Per recipe Context: any new client wrapper for the Create-role AdminSheet stays under `src/app/admin/roles/`.)

## Files to NEVER touch

- `src/app/admin/roles/actions.ts` — `updateRoleMetadata`, `toggleRolePermission` server actions are RECON §5 untouchable. Do not author `createRole` from this recipe (Phase 6 ↔ BUILD autonomy boundary; BUILD-create-role.md tracks it).
- `src/app/admin/roles/[roleId]/**` — role-detail subroute owned by a separate session.
- `src/lib/auth/rbac.ts` — `canManageRoleTemplates`, `getRoleDisplayName`, `getStaffProfile` preserved verbatim.
- `src/middleware.ts` — out of scope.
- `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layers (RECON §5).
- `src/components/ui/card.tsx` and other shared primitives — fixes live in the `00-shared-components` session.
- All build/config files: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.
- Main tree at `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` — never modify; user works there.
