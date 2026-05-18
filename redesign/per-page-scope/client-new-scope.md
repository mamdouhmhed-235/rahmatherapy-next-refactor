# Scope — client-new

Date: 2026-05-18
Brief: /redesign/briefs/client-new-brief.md
Recipe: /redesign/per-page-recipes/client-new-recipe.md

## Files to edit

- `src/app/admin/clients/new/page.tsx` — rebuild page chrome: breadcrumb "← Clients", `AdminPageHeader` with brief copy, drop raw `var(--rahma-*)` token escapes, fix `AdminAccessDenied` props so `manage_clients_all` is not leaked to the rendered surface (replace with plain-English body copy per brief §11 Denied state).
- `src/app/admin/clients/new/ClientCreateForm.tsx` — full rebuild from one mega-section + Field helper to three `AdminPanel`s ("Who they are" / "How to reach them" / "Internal notes"); DESIGN.md Input spec (Form Seam border, Input Ground bg, 6px radius, focus ring tokens); drop local `inputClass` constant; Cancelled-family form-level error banner with `x-circle`; Attention-family duplicate warning banner with `alert-circle` + visible "Possible duplicate client" label; `role="alert" aria-live="polite" aria-atomic="true"` regions for per-field errors; required `*` markers in Cancelled text colour with `aria-hidden` glyph + "* means required" legend; flat sticky save bar (`surface-card` + `border-subtle` top, NO `backdrop-blur`); 48px Primary on mobile + safe-area inset; new `city` + `area` inputs; source-conditional helpers (Referral/Other); Ghost "Cancel" as anchor link.
- `src/app/admin/clients/actions.ts` — **SANCTIONED EXCEPTION per brief §5** (authorised as a justified exception to the RECON §5 untouchable rule because migration `20260513120000_add_client_city_area.sql` adds the columns and pre-fill from `?clientId=` in booking-new depends on them). Additive city/area reads from FormData + include in insert payload; no other changes (no schema validation changes, no duplicate-detection changes, no signature change, no `confirm_duplicate` flow changes).

## Files to NEVER touch

- `src/middleware.ts` — Supabase session refresh / route protection (RECON §5)
- `src/lib/auth/**` — auth helpers (RECON §5)
- `src/lib/supabase/**` — DB layer (RECON §5)
- `supabase/migrations/**` — DB schema migrations
- `src/components/ui/card.tsx` — out of scope here (fix lives in 00-shared-components session)
- `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, all other build/config files
- Server-side duplicate detection rules in `actions.ts` (matches on lowercased email or normalised phone) — additive city/area only; duplicate logic unchanged
- The `createClient` server-action signature `(prev, FormData) => ClientActionState` — unchanged
- The seven-option client_source enum — preserved verbatim
- The `confirm_duplicate` flow + HTML-required attribute — unchanged

## Preserved contract (per RECON §6.4)

Form `name` attributes preserved verbatim: `full_name`, `client_source`, `email`, `phone`, `address`, `postcode`, `source_detail`, `notes`, `confirm_duplicate` (conditional). New optional fields `city`, `area` added post-migration.

`<form action={createClient}>` + `useActionState` wired. No fetch / XHR replacement.

`id="admin-main"` skip-link target preserved at layout level (not in this file).
