# Phase 0 — Images & Asset Inventory (Admin)

The admin surface is **deliberately image-light**. A full grep across `src/app/admin/`, `src/components/layout/`, `src/components/shared/` (admin-imported only), plus checks for CSS modules, `background-image: url()`, and SVG file imports yields exactly one bitmap/raster/SVG asset.

Phase 6 will append rows to this file as new imagery is introduced (dashboard hero art, empty-state illustrations, role/avatar fallbacks, etc.).

| Path | Size (KB) | Format | Alt? | Issue | Proposed Action |
|---|---|---|---|---|---|
| `public/images/brand/rahma/logo-mark.svg` | 21.0 | SVG | `alt=""` (decorative — paired with visible "Rahma Therapy" wordmark in the same link) | none | leave-alone |
| `public/images/admin/empty-states/calendar-empty.svg` | — (TBD) | SVG | `alt="No bookings scheduled"` | net-new asset — placeholder needed for `/admin/calendar` `EmptyState` (calendar-with-check illustration, ~80–120px). Phase 6 calendar session adds `data-redesign-needs-photo` until asset lands. | add-asset |
| `public/images/admin/empty-states/enquiries-empty.svg` | — (TBD) | SVG | `alt="No enquiries yet"` | net-new asset — placeholder needed for `/admin/enquiries` `EmptyState` (speech-bubble-with-check illustration per DESIGN.md §5 EmptyState guidance, ~80–120px, single-color so it tints via `currentColor`). Reused across all 5 tab variants (All / New / Contacted / Converted / Closed) — each variant supplies its own heading + body copy from the brief's empty-state table; one shared illustration. Phase 6 enquiries session uses `data-redesign-needs-photo` until asset lands. | add-asset |

**Call site:** `src/app/admin/components/AdminTopNav.tsx:299` — `<Image>` inside `Brand()`, sized 24×24, classed `size-5 invert` (white-on-green inside a 36 px green tile). The empty `alt=""` is the **correct** WCAG pattern: the parent `<a>` already carries `aria-label="Rahma Therapy admin dashboard"` and the adjacent text node `<span>Rahma Therapy</span>` provides the link's accessible name. Decorative empty alt prevents redundant SR announcements.

---

## Summary

- **Total admin images:** 1
- **Largest:** `public/images/brand/rahma/logo-mark.svg` (21 KB)
- **Total admin image weight:** 21 KB
- **Format breakdown:** SVG ×1, PNG ×0, JPG ×0, WebP ×0, AVIF ×0
- **Alt-text coverage:** 1 / 1 (correct decorative empty alt — not a defect)

## Notes / scope verification

- The admin **login page** (`src/app/admin/login/page.tsx`) does **not** use a logo image — it renders an inline `<svg>` glyph (a circle with a plus) inside a green tile. No image asset to inventory. If we want the actual brand mark on login as part of the redesign, that's a net-new use of the same `logo-mark.svg`.
- The admin **layout** (`src/app/admin/layout.tsx`) has zero image references.
- `src/components/admin/` does not exist.
- **No admin file imports from `src/components/layout/` or `src/components/shared/`** — `SiteHeader`, `SiteFooter`, `Logo`, `BookingTrigger`, `ImagePlaceholder`, `ImageOverlayCard`, `CredentialLogos`, etc. are public-site-only.
- All `<svg>` usages in admin are inline (lucide icons, Recharts gradient defs, sparkline glyphs in `admin-ui.tsx`). Per scope rules, inline SVG and lucide icons are excluded.
- The two `url(...)` occurrences inside admin code (`demand-trend-client.tsx:117`, `admin-ui.tsx:478`) are SVG gradient `fill="url(#id)"` references — not image URLs.
- No CSS modules or stylesheets are imported by admin pages, so no `background-image: url(...)` references to scan.
- `src/features/booking/` is not rendered by any admin page (admin has its own `ManualBookingForm.tsx`).

---

## Anticipated additions during Phase 6

These are **not** existing assets — they're guesses about what the redesign will likely want, so we have a place to add rows during implementation.

| Likely path | Where it would appear | Notes |
|---|---|---|
| `public/images/admin/empty-states/*.svg` | `EmptyState` component variants per page (no bookings yet, no clients yet, etc.) | Brand-aligned line illustrations, ≤ 30 KB each, single-color so they tint via `currentColor`. |
| `public/images/admin/dashboard-hero.{webp,svg}` | Dashboard top-of-page accent (if Phase 3 calls for it) | Stay on-brand: ivory/green/gold, no SaaS gradients per AGENTS.md. |
| `public/images/admin/avatars/default.svg` | Staff avatar fallback in `/admin/staff` cards | Currently uses lucide `<User>` icon — fine if redesign keeps it. |
| `public/images/admin/login-art.{webp,svg}` | `/admin/login` background or right-rail (if Phase 3 calls for it) | One asset only; lazy-load. |

Once the redesign lands these, append rows to the table above with: path, size after build, format, alt status, issue tag (`none` / `too-large` / etc.), proposed action.
