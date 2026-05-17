## Files to edit

- `src/app/admin/clients/page.tsx` — Replace `ClientCard` grid with `AdminEntityRow` list rows; add sort toggle ("Name A–Z" / "Last visit") to `AdminFilterBar`; add alphabetical index strip (≥1024px, 40+ records, alpha sort, no active query); wire "New booking" Ghost button per row with accessible name "New booking for {clientName}"; resolve P0 a11y: explicit visible `<label for="location">Location</label>`; mobile "Refine" AdminSheet collapse for filter bar; lifecycle status badges (Confirmed/Pending/Attention/Restricted families) with icon+text per Named Status Rule; sticky `<h2>` group headings on alpha sort; EmptyState (unfiltered + filtered + therapist-denied + error + loading states); 32px deterministic-tint avatar circles.

## Files to NEVER touch

- `src/app/admin/clients/actions.ts` — `createClient`, `updateClient`, `addClientNote`, `requestClientPrivacyAction` server actions (Feature Preservation Manifest)
- `src/app/admin/clients/access.ts` — client scope helpers (RECON §5)
- `src/app/admin/clients/format.ts` — format utilities (RECON §5)
- `src/middleware.ts` — Supabase session refresh / route protection (RECON §5)
- `src/lib/auth/**` — auth layer (RECON §5)
- `src/lib/supabase/**` — DB layer (RECON §5)
- `supabase/migrations/**` — schema migrations
- `src/components/ui/card.tsx` — out of scope (fix lives in `00-shared-components` session)
- Build/config files: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, etc.
