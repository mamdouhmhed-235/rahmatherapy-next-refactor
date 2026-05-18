# Scope — role-detail

## Files to edit
- `src/app/admin/roles/[roleId]/page.tsx` — Re-architect as two-column `xl:` `1fr 22rem` workstation: breadcrumb + role-letter token header + system/active chips + description; left = filter strip + permissions panel grouped by category with sticky headers + per-row scope/risk chips + restyled Switch + sticky granted-count footer; right = `RoleMetadataForm` panel + Staff sidebar with `AdminEntityRow`-style rows + new "Role lifecycle" danger-zone panel. Strip raw `var(--rahma-*)` escapes, `bg-red-100`/`text-red-700` inactive chip → Restricted/Cancelled family, `bg-white` staff row → AdminPanel surface, `ShieldCheck`-in-green tile → role-letter token, denied screen strips raw `manage_role_templates` identifier.
- `src/app/admin/roles/[roleId]/RoleMetadataForm.tsx` — Restyle to DESIGN.md tokens (Input ground / Form Seam border / required `*` markers / `role="alert" aria-live="polite"` error region / Primary button "Save role details"); preserve `role_id`, `display_label`, `description`, `sort_order`, `active` field names + hidden `active=on` shadow verbatim.
- `src/app/admin/roles/[roleId]/PermissionRow.tsx` — Rebuild row composition: permission display name + scope chip + risk chip (Restricted/Pending/Attention/Cancelled for low/medium/high/critical) + description + mono permission.name token + restyled `<Switch>` on the right; route Owner-role toggles + risk_level=critical (always) + risk_level=high (grant only) through new shared `ConfirmActionModal`; preserve `toggleRolePermission(roleId, permissionId, permissionName)` signature verbatim; failure rollback + Cancelled Sonner with Retry; granted/revoked Sonner success copy from brief §6.
- (Possible new client wrappers under `src/app/admin/roles/[roleId]/` for the danger-zone Deactivate/Reactivate/Delete flows + filter strip client wrapper if the URL-param sync needs interactivity) — kept under the same directory per recipe scope rules.

## Files to NEVER touch
- `src/app/admin/roles/actions.ts` — `updateRoleMetadata`, `toggleRolePermission` server actions (RECON §5 explicit DO-NOT-TOUCH). `deleteRole` does not yet exist; do not add it here — degrade gracefully (button disabled with inline note + `data-redesign-fake="delete-role"`).
- `src/lib/auth/rbac.ts` — `canManageRoleTemplates`, `getRoleDisplayName` helpers preserved.
- `permissions` catalogue source (categories, scope, risk_level enums) — read-only.
- `src/middleware.ts` — auth gating untouchable.
- `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layer (RECON §5).
- `src/components/ui/card.tsx` and other shared primitives — out of scope (fixes live in `00-shared-components` session).
- All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.).
- Main tree at `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor` — never touch.
