# Scope — settings

Phase 6 implementation scope for `/admin/settings` per `redesign/briefs/settings-brief.md` + recipe `redesign/per-page-recipes/settings-recipe.md`.

## Files to edit

- `src/app/admin/settings/page.tsx` — Strip raw `manage_settings` permission identifier on `AdminAccessDenied`; restructure description copy; remove the inline H1 in favour of a brief-specified `AdminPageHeader` voice; thread current `audit_logs` last-changed lookup if reachable (non-blocking — omit silently).
- `src/app/admin/settings/SettingsForm.tsx` — Replace single `Card` + nested `SettingsGroup` H3 wrappers with four `AdminPanel`/`AdminPanelHeader` H2 panels (Customer booking intake / Clinic identity / Booking rules / Service areas); replace bare checkbox with design-system `Switch` + Confirmed/Restricted-family banner + `ConfirmActionModal` on on→off; replace textarea with chip input UI (hidden `<input name="allowed_cities">` newline-delimited); replace numeric inputs with DESIGN.md Input spec + suffix + live-bound plain-English helpers; promote form-level error to Cancelled-family banner with `x-circle`; wrap per-field errors in `role="alert" aria-live="polite" aria-atomic="true"`; add Cancelled-coloured required `*` markers with `aria-hidden="true"`; replace right-aligned Save button with sticky save bar (`surface-card` + `border-subtle` top, NO `backdrop-blur`) + Ghost "Discard changes" (dirty-only); attach `beforeunload` listener on dirty; clear `bg-white/70`, raw `text-red-600`, raw `border-red-200`/`bg-red-50`, raw `var(--rahma-*)` escapes.

## Files to NEVER touch

- `src/app/admin/settings/actions.ts` — `updateBusinessSettings` server action; full form contract preserved (RECON §5 untouchable; §6.4 preserved field names).
- `src/lib/auth/**`, `src/lib/supabase/**` — Auth + DB layer (RECON §5).
- `src/middleware.ts` — Admin route gating; unaffected.
- `supabase/migrations/**` — `business_settings.id = 1` singleton row contract preserved.
- `src/components/ui/card.tsx` — Out of scope for settings (fix lives in `00-shared-components` session; brief explicitly replaces shadcn `Card`/`CardTitle` here with `AdminPanel`/`AdminPanelHeader`).
- All build/config files: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.

## Preserved contracts

- All 9 form field `name` attributes verbatim: `company_name`, `contact_phone`, `contact_email`, `booking_window_days`, `minimum_notice_hours`, `buffer_time_mins`, `customer_cancellation_cutoff_hours`, `allowed_cities`, `booking_status_enabled`.
- `allowed_cities` serialises as newline-delimited hidden input.
- `handleSubmit` shape preserved (`event.preventDefault()` + manual `FormData` + `startTransition`).
- `business_settings.id = 1` singleton row contract + `fallbackSettings` shape.
