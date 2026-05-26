# Per-page scope — client-detail

## Files to edit

- `src/app/admin/clients/[clientId]/page.tsx` — Replace shadcn `Card`/`CardTitle` (H3) with `AdminPanel`/`AdminPanelHeader` (H2) throughout sidebar; add URL-param tabbed booking history (`?tab=upcoming|past|all`, default `upcoming`, read server-side); add "New booking" Primary CTA to page header (Owner/Admin/Coordinator; absent for Therapist); add Therapist-scoped booking history query; reorder mobile column layout (booking history above notes/health on mobile); add `EmptyState` component per tab; replace local `StatusBadge`/`Row`/`Card` helpers with shared admin primitives; drop `border-l-4` and `bg-[var(--rahma-ivory)]/70` ad-hoc surfaces; rebuild booking history list using `BookingListCard` full-border pattern with status families.
- `src/app/admin/clients/[clientId]/ClientDetailForms.tsx` — Wrap `ClientNoteForm` in expandable state (`useState isExpanded`) with Ghost "Add note" toggle button → expands textarea form on click → collapses on save/cancel; rewire textarea label/id/required-marker per DESIGN.md Input spec; replace ad-hoc red error pill with `role="alert" aria-live="polite" aria-atomic="true"` region; switch Primary submit copy to "Save note" / "Submit request" / Ghost "Cancel"; preserve all field `name` attributes (`client_id`, `note`, `request_type`, `request_note`) and server action binding (`addClientNote`, `createClientPrivacyRequest`) verbatim.

## Files to NEVER touch

- `src/app/admin/clients/actions.ts` — server actions `addClientNote` + `createClientPrivacyRequest`; do not change names, signatures, or field bindings.
- `src/app/admin/clients/access.ts`, `src/app/admin/clients/format.ts` — client access helpers / formatters; read-only references.
- `src/middleware.ts` — Supabase session refresh / route protection.
- `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layer.
- `supabase/migrations/**`.
- `src/components/ui/card.tsx` — out of scope here (the H1→H3 root fix lives in `00-shared-components`).
- Build / config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.).
