-- Item 8 Phase 1b — the Owner-only permission for the mileage origin
--
-- The mileage origin is Owner-editable only; every other business setting
-- stays Admin-editable. This codebase has exactly one other Owner-exclusive
-- gate (manage_role_templates) and it is permission-based, not a role-name
-- check -- so this follows that precedent rather than inventing a second
-- mechanism.
--
-- ⚠️ THIS MIGRATION ALONE CHANGES NOTHING THE APP ENFORCES. Verified: the
-- settings form is gated in one place, requireSettingsManager() with
-- PERMISSIONS.MANAGE_SETTINGS, which the live database grants to BOTH Admin
-- and Owner. Until Phase 1's application code adds the matching TS constant
-- AND a narrower check on the mileage_origin field specifically, an Admin
-- keeps the access they have today. Inserting this row without that follow-up
-- is not a restriction, it is the appearance of one.
--
-- The failure mode is safe rather than dangerous: hasPermission/
-- requirePermission take a `Permission`-typed argument built from the
-- PERMISSIONS const, so a check cannot even be written without the constant --
-- it is a compile error, not a silently-passing gate. All 26 `.permissions
-- .has(...)` call sites in src/ were checked and every one passes a typed
-- constant; there are no raw-string permission checks anywhere.
--
-- Owner-approved and applied 2026-08-11 (Zone-2, per-action approval in chat).
-- Applied version: 20260811203752.
-- Post-apply verified: permissions at 40 rows; manage_travel_origin granted to
-- exactly one role, Owner; Owner's total grants 40 of 40.
--
-- Reversible with:
--   DELETE FROM public.role_permissions
--    WHERE permission_id = (SELECT id FROM public.permissions WHERE name = 'manage_travel_origin');
--   DELETE FROM public.permissions WHERE name = 'manage_travel_origin';
-- Both are pure additions and nothing else references the new permission, so
-- the rollback is instant and loses no data.
--
-- Premise re-verified live immediately before authoring: 'manage_travel_origin'
-- does not exist; permissions has UNIQUE(name) and no CHECK constraints;
-- role_permissions is PK(role_id, permission_id) with cascading FKs to both
-- parents. The category/scope/risk_level values below are a verbatim match to
-- the live manage_settings row, not invented -- 'settings' is the only
-- settings-category permission, and 'operational'/'high' are shared by both
-- manage_settings and manage_role_templates.
--
-- Owner holds 39 of 39 active permissions today, but by explicit grant rows
-- rather than any wildcard, trigger or role-name shortcut -- all three were
-- searched for and none exists. So the second INSERT is genuinely required:
-- skip it and Owner does NOT receive this permission.

INSERT INTO public.permissions (name, description, category, scope, risk_level, is_system, active)
VALUES (
  'manage_travel_origin',
  'Edit the mileage-charge origin point on business settings.',
  'settings',
  'operational',
  'high',
  true,
  true
)
ON CONFLICT (name) DO NOTHING;

-- Owner only. Matched by name rather than by the known uuid so this reads the
-- same as every other grant in the repo and cannot bind to a stale id.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r, public.permissions p
 WHERE r.name = 'Owner'
   AND p.name = 'manage_travel_origin'
ON CONFLICT (role_id, permission_id) DO NOTHING;
