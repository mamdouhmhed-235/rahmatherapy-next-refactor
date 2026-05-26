# Scope — dashboard-therapist

## Files to edit

- `src/app/admin/dashboard/TherapistDashboard.tsx` — full visual rework: greeting H1, date-range chip strip (≥768px), Next Visit hero panel, Today's visits list, Claimable horizontal-scroll strip, Quiet Weekly summary tile, Casey #4 fix CTA. Preserve `TherapistDashboardProps` shape, `getGreeting`/`getFirstName`/`formatHours`/`FORMATTERS` verbatim.
- `src/app/admin/dashboard/page.tsx` — therapist branch routing only; no prop additions unless confirmed with data-layer owner.
- `src/app/admin/components/EmptyState.tsx` — only if calendar illustration variant is missing; confirm first.

## Files to NEVER touch

- `src/app/admin/dashboard/dashboard-data.ts` — server-side aggregation including `assignedOnly` filter at line 487. Any new prop is an Open Question, not a silent add.
- `src/app/admin/dashboard/dashboard-helpers.ts`
- `src/app/admin/dashboard/dashboard-data.test.ts`, `dashboard-helpers.test.ts`
- `src/app/admin/dashboard/dashboard-cards.tsx` — Owner/Admin + Coordinator only; Therapist does not render it.
- `src/app/admin/dashboard/dashboard-header.tsx`, `dashboard-filters-client.tsx` — Owner/Admin + Coordinator only.
- `src/app/admin/dashboard/attention-group-client.tsx`, `demand-trend-client.tsx`, `notification-bell.tsx` — not rendered for Therapist.
- `src/app/admin/bookings/actions.ts` — claim and update-own-assignment-status mutations; Therapist dashboard only deep-links.
- `src/app/admin/shell-variant.ts`, `src/app/admin/access.ts`
- `src/middleware.ts`
- `src/lib/auth/**`, `src/lib/supabase/**` — auth + DB layer.
- `supabase/migrations/**`
- `src/components/ui/card.tsx` — out of scope; owned by `00-shared-components`.
- All build/config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`).
