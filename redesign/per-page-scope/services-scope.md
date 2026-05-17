# Scope — services

## Files to edit
- `src/app/admin/services/page.tsx` — replace 2-col card grid with grouped `AdminEntityRow` list sectioned by `group_category` (H2 per group, sorted by lowest `display_order`); add summary prose "{N} active, {M} inactive across {X} categories"; add "Add service" Primary in header actions slot; replace `AdminEmptyState` with shared `EmptyState`; restyle to DESIGN.md token spec; surface RBAC denied screen with copy "Services access limited" / no raw permission identifier.
- `src/app/admin/services/ServiceFormDialog.tsx` — convert from centered `Dialog` to `AdminSheet` (right-side desktop, bottom mobile); group 12 fields into visual fieldsets (Basic / Details / Visibility / Copy); restyle every input to DESIGN.md Input spec (Input Ground bg, Form Seam border, Focus Azure on focus); add `role="alert" aria-live="polite" aria-atomic="true"` per-field error regions; required `*` markers in Cancelled colour; helper text on `gender_restrictions`, `display_order`, `slug`, `is_active`, `is_visible_on_frontend`; spinner + `aria-busy` on submit. Preserve all 12 `name` attrs verbatim.
- `src/app/admin/services/DeleteServiceButton.tsx` — replace two-stage inline confirm with shared `ConfirmActionModal` (Cancelled family) when `usage_count === 0`; preserve `usage_count > 0` guard (Sonner toast "This service has booking history and can't be deleted. Deactivate it instead.", no modal); button binds to `deleteService(serviceId)`.
- New client wrappers under `src/app/admin/services/` only — e.g. `ServicesCatalog.tsx`, `ServiceRowMenu.tsx`, `ServiceSheetTrigger.tsx` as needed to host AdminSheet open-state, AdminActionMenu, and ConfirmActionModal. Must remain scoped to `src/app/admin/services/`.

## Files to NEVER touch
- `src/app/admin/services/actions.ts` — `createService`, `updateService`, `deleteService` server actions; action names + signatures + field bindings frozen
- `src/middleware.ts` — auth chrome
- `src/lib/auth/**` — RBAC + session
- `src/lib/supabase/**` — DB clients
- `src/components/ui/card.tsx` and other shared primitives — fixes live in shared-components session
- Build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.)
- Anything in the main tree (`C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`)
