# Scope — availability (Phase 6, row 13 of 29)

## Files to edit

- `src/app/admin/availability/page.tsx` — Restructure capacity preview: replace inline card grid with `AdminPanel` + 7-day strip + `AdminEntityRow` staff list + this-week chips; add responsive tab/stack client wrapper around the three managers; fix heading hierarchy (H1 Availability → H2 per panel).
- `src/app/admin/availability/AvailabilityRulesManager.tsx` — Restyle to DESIGN.md tokens: 7-row day grid, shadcn `Switch` per row (accessible name `{Day}, open`), time inputs with 160ms ease-gentle reveal, "Save hours" Primary button at bottom; `role="alert" aria-live="polite" aria-atomic="true"` on error region; required `*` markers.
- `src/app/admin/availability/BlockedDatesManager.tsx` — Restyle: inline add-form above list (date + reason), `AdminEntityRow` rows, trailing Ghost `trash-2` + `ConfirmActionModal` ("Remove this closed date?"), `EmptyState` for empty list; error region uses `role="alert" aria-live="polite" aria-atomic="true"`; required `*` markers.
- `src/app/admin/availability/AvailabilityOverridesManager.tsx` — Same pattern as `BlockedDatesManager` plus `start_time` / `end_time` fields in the add-form and `ConfirmActionModal` copy ("Remove this hour adjustment?"); error region + required markers as above.
- `src/app/admin/availability/AvailabilityManagersTabs.tsx` — **NEW client component** (brief §5 Layout Strategy: "One client component wraps the strip and the three manager containers; `activeTab` state controls visibility"). Renders mobile-only pill tab strip + tabpanels that hide/show on `<768px` and stack at `≥768px`. The brief lists the wrapper under `page.tsx`'s edit row; a separate file is required because Server Components cannot hold `useState`.

## Files to NEVER touch

- `src/app/admin/availability/actions.ts` — Server-action contract (RECON §5 untouchable). Hosts `saveAvailabilityRule`, `deleteAvailabilityRule`, `createBlockedDate`, `deleteBlockedDate`, `createAvailabilityOverride`, `deleteAvailabilityOverride`. All six are referenced from the redesigned managers via `<form action={…}>` only.
- `src/lib/auth/**` — Auth layer (RECON §5).
- `src/lib/supabase/**` — DB layer (RECON §5).
- `src/middleware.ts` — Admin route gating (RECON §5).
- `supabase/migrations/**` — `availability_rules`, `blocked_dates`, `availability_overrides` schema preserved.
- `src/components/ui/card.tsx` — Out of scope; the H3-default fix lives in `00-shared-components`.
- All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.).

## Feature Preservation Manifest

- **Form field `name` attributes:** Rules — `rule_id`, `day_of_week`, `start_time`, `end_time`, `is_working_day`. Blocked dates — `blocked_date`, `reason`. Overrides — `override_date`, `start_time`, `end_time`, `reason`.
- **Server actions wired identically:** `saveAvailabilityRule` → "Save hours"; `createBlockedDate` / `deleteBlockedDate` → closed-dates manager; `createAvailabilityOverride` / `deleteAvailabilityOverride` → overrides manager; `deleteAvailabilityRule` if surfaced.
- **Audit-log writes:** `availability_rule_created`, `availability_rule_updated`, `availability_rule_deleted`, `blocked_date_created`, `blocked_date_deleted`, `availability_override_upserted`, `availability_override_deleted`.
- **`revalidatePath('/admin/availability')`** continues to fire from every action so the Server Component capacity preview reflects changes without manual reload.
- **No `fetch` / `XHR`** — every mutation is a Server Action via `<form action={…}>`.
