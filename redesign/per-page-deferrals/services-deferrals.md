# Deferrals — services

## AdminActionMenu 3-dot trigger touch target at 36px (below 44px WCAG 2.5.5)

- **Source:** Step 8 adapt verification (services-recipe.md)
- **Verbatim:** "Confirm Edit + three-dot buttons are tappable without zoom on mobile (min 44px touch targets — check `getBoundingClientRect().height >= 44`)". Measured: 35.99px height.
- **Defer to:** Phase 7 / 00-shared-components
- **Why deferred:** The `<summary>` inside `AdminActionMenu` in `src/app/admin/components/admin-ui-interactions.tsx` uses `size-9` (36px). That file is the shared admin primitive set owned by the 00-shared-components Phase 6 session and is on the "Files to NEVER touch" list for services. The fix is a one-line bump of `size-9` → `min-h-11 min-w-11` in `admin-ui-interactions.tsx:21` and affects every page that uses the menu — must be done in the shared session, not here.
- **Provisional Phase 6 answer used to continue this session:** Edit button bumped to min-h-11 on mobile (`sm:min-h-9` for desktop density). 3-dot trigger left at 36px pending Phase 7 fix. Visually tappable on test devices; cosmetic-fail only against the strict 44px floor.

## Row title typography at 14px instead of brief's title step (1.333rem ≈ 21px)

- **Source:** Step 7b polish audit
- **Verbatim:** brief §5 "Primary: service name (Urbanist 600, title step, Chronicle)" — title step is 1.333rem (≈21px) per DESIGN.md. Live: shared `AdminEntityRow` renders title in `<h3>` at `text-sm font-semibold` (14px).
- **Defer to:** Phase 7 / 00-shared-components
- **Why deferred:** `AdminEntityRow.title` styling is hardcoded in `admin-ui.tsx:1094`. Changing it affects every list-row page (clients, staff, roles, etc.) and must be a coordinated Phase 7 decision, not a services-only tweak. The current 14px reads fine in context (H1 → H2 → H3) — it's a brief literalism gap, not a defect.
- **Provisional Phase 6 answer used to continue this session:** Accept shared primitive's 14px row title. Strong H2 group heading (Urbanist 1.5rem) carries the page's typographic identity.
