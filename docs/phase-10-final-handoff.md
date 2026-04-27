# Phase 10 Final Handoff - 2026-04-27

## Scope

Reopened Phase 10 verified the old-route refactor after recovered Phase 6 visual parity and recovered Phase 9 cleanup passed.

Checked old-route scope:

- `/`
- `/hijama`
- `/physiotherapy`
- `/sports-massage-barnet`

Reference site: `http://localhost:3000`

Target site: `http://localhost:3001`

## Verification Summary

- `pnpm lint`: passed.
- `pnpm build`: passed.
- Build warning: Next reports `metadataBase` is not set for social image resolution and falls back to `http://localhost:3000`.
- Runtime residue search: no active Webflow mirror, Webflow runtime script, jQuery runtime, Webflow CDN image fallback, `sourceUrl`, `CDN_ROOT`, `live-pages`, `live-html`, or `suppressHydrationWarning` remains in active source.
- `dangerouslySetInnerHTML`: only approved JSON-LD usage remains in `src/lib/seo/StructuredData.tsx`.
- Target HTML route checks use local `/images/...` assets and no Webflow CDN, jQuery, or Webflow runtime scripts.
- `/about/`, `/services/`, and `/faqs-aftercare/` return 404; Rahma/new pages were not started.

## Visual Evidence

Screenshots were saved under:

```txt
rahmatherapy-next-refactor/audit-screenshots/phase10-final-2026-04-27
```

Captured old and target screenshots for all old routes at:

- `1440x900`
- `768x1024`
- `390x844`

Additional font-ready home tablet screenshots were saved in the same folder:

- `phase10-final-old-home-tablet-font-ready.png`
- `phase10-final-target-home-tablet-font-ready.png`

These were captured after `document.fonts.ready` because an initial home tablet screenshot pair showed a font-loading artifact that was not present in computed layout metrics.

## Browser Checks

Target mobile DOM checks covered all old routes and confirmed:

- page title present
- `header`, `nav`, `main`, and `footer` present
- one `h1`
- images loaded
- no mobile horizontal overflow
- zero page-level console errors

Service-page mobile metrics were recorded through Playwright for:

- `phase10-target-hijama-mobile-metrics.json`
- `phase10-target-physiotherapy-mobile-metrics.json`
- `phase10-target-sports-mobile-metrics.json`

## Booking Checks

Booking verification covered:

- visible `Schedule a visit` CTA opens the dialog
- dialog closes and returns focus to the trigger
- `/?booking=1` opens the dialog
- `/?booking=1&services=massage-30,hijama-package` opens with one massage and one cupping service selected
- `/#book-now` opens the dialog
- empty package selection shows validation
- selecting a second cupping package replaces the first
- selecting a second massage package replaces the first
- one cupping plus one massage is allowed
- selecting an already-selected massage deselects it
- details step accepts phone, email, notes, gender, postcode, address, date, and time
- review step shows the selected service and total
- acknowledgement flow reaches the prepared state
- start over resets to step one

## Intentional Differences

- Logo/favicon differences remain accepted from earlier recovery work.
- The home route uses semantic `h1` on the visible hero headline while the old reference used the eyebrow as `h1`; the visual presentation is preserved.

## Known Issues And Future Work

- Configure final `metadataBase` when the production domain is final.
- Rahma theme/content/new pages remain blocked until the user explicitly approves Phase 11/Phase 12.
- Future backend integration points remain:
  - Supabase booking/request storage
  - Resend notification email flow
  - booking request lifecycle states
  - possible admin/dashboard tooling
- Generated ignored residue from earlier phases was documented in Phase 9 and is not an active runtime/source dependency.

## Decision

Reopened Phase 10 passes. Stop for user review before Phase 11.
