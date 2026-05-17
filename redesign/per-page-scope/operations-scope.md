# Per-page scope — operations

## Files to edit
- `src/app/admin/operations/page.tsx` — full redesign per brief. Server component shell: gate check (Owner / Admin-PM via `manage_settings` OR `manage_email_settings`), fetch operational_events for all three statuses (Open / Acknowledged / Resolved), partition into column data, render `AdminPageHeader`, severity summary stat strip (three `AdminStat` tiles), filter strip (GET form, `data-redesign-fake="filter-query"`), and pass column data + flags into the client board component. `AdminAccessDenied` denied state rewritten to strip raw `manage_settings or view_email_logs` permission identifier.
- `src/app/admin/operations/operations-board.tsx` (NEW client component) — three-column grid on `xl:`, mobile `TabPills` strip (Open / Acknowledged / Resolved) on `lg:` and below, default tab Open. Holds optimistic-state map, handles single Ack/Resolve column migration via server action, bulk "Resolve all" with `ConfirmActionModal` (Cancelled family), mobile "Filters" Ghost → `AdminSheet`, `o`/`a`/`r` keyboard focus jumps, copy-on-click safe-context JSON, Sonner toasts (`Acknowledged.`, `Resolved.`, `{N} events resolved.`, `Couldn't resolve {N} of {total}. Try again.`, `Copied safe context.`).
- `src/app/admin/operations/event-row.tsx` (NEW client component) — single event row composition: severity chip (the lone tinted element; error=Cancelled, warning=Attention, info=Restricted) + event-type chip (Restricted, decorative) + relative time (Soft Slate); summary line (Work Sans 500 body); sub-line `Booking #...` / `Staff: ...` deep-links; safe-context chip row (≤4 chips inline + `+N more` Ghost); native `<details>` mono key/value with copy-on-click JSON; per-row Ack/Resolve forms posting to `updateOperationalEventStatus` with `name="event_id"` + `name="status"` hidden inputs preserved verbatim. Open + error rows get full Cancelled-family row tint.

## Files to NEVER touch
- `src/app/admin/operations/actions.ts` — `updateOperationalEventStatus` server action; RECON §5 explicit DO-NOT-TOUCH.
- `operational_events` insert/redaction code paths — RECON §6.2 family untouchable.
- `src/middleware.ts` — auth chain.
- `src/lib/auth/**` — RBAC / `getStaffProfile` / `getAdminPageAccess`.
- `src/lib/supabase/**` — admin/server clients.
- `src/components/ui/card.tsx` and any shared primitive (Card, Badge, Button, Dialog, Sheet, etc.) — fixes live in `00-shared-components` session.
- `src/app/admin/components/admin-ui.tsx` — shared admin primitives; consume don't modify.
- All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.).
- Anything in the main tree (`C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`).
