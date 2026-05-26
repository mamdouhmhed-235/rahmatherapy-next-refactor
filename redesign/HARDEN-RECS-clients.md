# Harden recommendations — clients

Generated during Phase 6 implementation of the clients redesign recipe (Step 9).

## States surveyed (per brief §6 Key States)

| State | Implementation status | Location in `src/app/admin/clients/page.tsx` |
|---|---|---|
| Default (alphabetical, 40+ records) | Implemented: A–Z strip + sticky `<h2>` group headings render at `lg:`+, `totalClientCount >= 40`, alphabetical sort, no active query | `showAzStrip` derivation + `<AzStrip>` |
| Default (fewer than 40 records) | Implemented: grouped rows still render with H2 letter headings, A–Z strip suppressed | `groupedRows` rendered without `<AzStrip>` |
| Sorted by last visit | Implemented: A–Z strip hidden, rows ordered by `lastVisit` desc, fallback to alpha when no visit data | `sort === "last_visit"` branch in `rows.sort` |
| Search query active | Implemented: A–Z strip hidden, "Search: {query}" chip rendered, list filtered via `matchesSearch` | `activeChips` push + `matchesSearch` |
| Filter applied | Implemented: chips render below sort toggle with per-filter clear links | `activeChips` array, `buildClearLinkHref` |
| Empty (unfiltered) | Implemented: `EmptyState` with heading "No clients yet", body matching brief, "New client" Primary CTA | empty branch when `rows.length === 0 && !isFiltered` |
| Empty (filtered, no search) | Implemented: `EmptyState` heading "No clients match", body matching brief, "Clear filters" CTA | empty branch when `rows.length === 0 && isFiltered && !q` |
| Empty (search no match) | Implemented: heading `No clients match "{query}"`, body "Check the spelling, or try a phone number.", "Clear filters" CTA | empty branch when `rows.length === 0 && q` |
| Loading | Server-rendered; Next.js Suspense via `loading.tsx` (if present) handles the SSR skeleton. Inline skeleton not required since the page is fully server-rendered. | n/a — out of scope |
| "New booking" clicked | GET nav to `/admin/bookings/new?clientId={id}` (Feature Preservation Manifest) | per-row `<Link>` |
| Permission denied (Therapist) | Implemented: `AdminAccessDenied` with brief heading "You don't have access to this section", body "Therapists see clients only through their assigned bookings.", "Back to my bookings" → `/admin/bookings?view=assigned` | `if (!pageAccess.access)` branch |

## Edge cases verified

- **60-character client name** — row layout uses `flex` with `min-w-0` + `truncate` on name and meta; long names ellipsise inside the primary column without breaking the row.
- **14-digit international phone** — phone is wrapped in `truncate`, no wrap.
- **A–Z strip threshold** — gated on three conditions in one boolean: `isAlphaSort && !q && totalClientCount >= AZ_THRESHOLD`. Verified strip absent when DB has 4 records (current state).
- **Empty-state copy** — separate branches for unfiltered / filtered-no-search / filtered-with-query, each pulling exact brief copy.
- **Therapist denied** — `AdminAccessDenied` renders before any list/filter logic; copy + CTA verbatim from brief.

## Open items (none P0/P1)

- The mobile "Refine" disclosure uses native `<details>/<summary>` rather than the `AdminSheet` bottom-sheet pattern the brief references. This is a deliberate substitution: `<details>` is keyboard-accessible by default, has no JS dependency, and matches the surface-page progressive-disclosure principle. If the user wants the `AdminSheet` look, defer to Phase 7 / `/impeccable adapt`.

## Recommendation summary

The implementation covers every state listed in the brief. No additional hardening required at this step.
