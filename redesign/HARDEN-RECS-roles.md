# Harden recommendations — roles (Phase 6, page 27 of 29)

Generated 2026-05-17 by the roles redesign session. The page covers brief §6 Key States and the verification edge cases listed in the recipe.

## State coverage matrix

| State (brief §6)                              | Source surface                                                                 | Verified |
|---|---|---|
| Default; populated (5 active seeded roles)    | `RoleListRow` map in active list                                               | ✓ |
| Empty (render-safe; impossible with seed)     | `EmptyState` inside the panel; `<div data-redesign-needs-photo="roles-empty.svg">` marker for IMAGES-NEEDED carry-forward | ✓ |
| Loading                                       | Next.js streaming SSR — `AdminPanel` re-renders once Supabase returns; could be elevated to a `loading.tsx` skeleton in Phase 7 if perceived latency emerges | partial (defer to Phase 7 if needed) |
| Create-role sheet open                        | `AdminSheet` from `admin-ui-interactions.tsx` (BaseDialog focus trap, scrim, ESC-to-close inherited from primitive) | ✓ |
| Create-role validation error                  | Sheet stays open; `role="alert" aria-live="polite"` region present in DOM (currently `sr-only`-positioned until BUILD-create-role.md wires real validation) | ✓ (skeleton ready) |
| Create-role failure (server)                  | Will surface as Sonner toast (Cancelled family, no auto-dismiss) — wired by BUILD; UI degrade marker `data-redesign-fake="create-role"` blocks submit so this state cannot fire today | ✓ (FAKE-degraded) |
| Inactive disclosure expanded                  | Native `<details>` element; rotates chevron 90° via `group-open:rotate-90`; honors `prefers-reduced-motion` (motion-reduce:transition-none); active rows do not reflow when expanded (they live in a separate `<ul>`) | ✓ |
| Single-role-with-0-staff                      | Plain text "0 staff" (no link, no `<a>`); icon kept for visual consistency; `title="No staff on this role yet"` | ✓ |
| System role                                   | Restricted-family "System" chip rendered alongside Active/Inactive chip                                                       | ✓ |

## Verification edge cases (from recipe)

- **60-char `display_label` doesn't break row layout on mobile** — H2 uses `min-w-0 break-words`; the flex parent wraps. Sub-pixel verified in mobile screenshot.
- **`<details>` expansion doesn't reflow active rows** — active rows live in a separate `<ul>` sibling; the `<details>` element only contains inactive `<li>` children. Geometric isolation confirmed.
- **Create-role `AdminSheet` validation error preserves form data** — fields are uncontrolled HTML inputs; native browser preserves values across re-render. Validation contract will land with BUILD-create-role.md (currently submit is disabled, so the path is unreachable until then).
- **Render-safe EmptyState** — fires only when the `roles` table returns zero rows (a defensive condition; 5 seeded roles cannot be deleted from this surface).
- **Nested staff-count link** — sits at `z-2`; the outer row link is at `z-0` and absolutely-positioned. Click on staff-count routes to `/admin/staff?roleId=<id>` and does NOT trigger the row's `/admin/roles/<id>` navigation. Verified by stacking-context rather than `event.stopPropagation()` (which would require a client component).
- **Tonal Lift Rule** — `border border-transparent` at rest; `hover:border-[var(--admin-primary)]/25 hover:shadow-[var(--admin-shadow-hover)]` applies the `card-hover` shadow only on hover. Rows are flat at rest.

## Outstanding (deferred to Phase 7 / Phase 8)

- Suspense-driven `loading.tsx` for the `/admin/roles` route — only worth adding if data fetch perceptibly delays render.
- Real `createRole` server action wiring — tracked in `redesign/backend-plans/BUILD-create-role.md`. Once that lands, remove the `data-redesign-fake="create-role"` marker, re-enable the submit, wire Sonner toast + redirect.
- `roles-empty.svg` (shield-and-people, 80–120px) — listed in IMAGES-NEEDED; the slot is marked with `data-redesign-needs-photo` and degrades to the EmptyState's icon fallback today.
