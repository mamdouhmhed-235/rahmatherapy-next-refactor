# Phase 7 Legacy Cleanup and Plan Compliance Notes

## Canonical Planned Homepage

- Current canonical planned homepage route: `/home-planned`.
- `/home-planning` is retained as a redirect-only alias to `/home-planned`.
- `/` is now redirect-only and no longer renders legacy homepage content.

## Legacy Route Decisions

| Legacy route | Phase 7 behavior | Reason |
| --- | --- | --- |
| `/` | Redirects to `/home-planned` | Keeps the root URL useful while removing legacy homepage content. |
| `/hijama` | Redirects to `/services/hijama-package` | Preserves the closest planned package path without exposing legacy hijama content. |
| `/physiotherapy` | Redirects to `/services` | No planned physiotherapy page exists in the active planning bundle. |
| `/sports-massage-barnet` | Redirects to `/services` | No planned sports-massage route exists in the active planning bundle. |

## Dead Code Removed

- Removed the old `src/components/sections/*` legacy section component set.
- Removed the old legacy page content files for home, hijama, physiotherapy, and sports massage.
- Removed the old legacy service, FAQ, testimonial, route, SEO helper, and structured-data modules.
- Pruned the shared image registry to the brand assets still used by the shared logo.
- Simplified `src/types/content.ts` to the content types still used by the planned shell.

## Planned Page Compliance Findings

- Home: implementation keeps the planned 11-section order from the planning bundle: hero, trust strip, pain cards, packages, why Rahma, process, reviews, team, safety/aftercare, FAQ preview, final CTA.
- Services: implementation keeps the planned 10-section order: hero, trust strip, package cards, package finder, comparison, treatment methods, home appointment process, safety/aftercare, mini FAQ, final CTA.
- Focused package pages: dynamic package route still generates the five planned package slugs and renders the planned shared package-page sequence.
- About: implementation keeps the planned 10-section order from hero through final CTA.
- Reviews: implementation keeps the planned proof-wall sequence and still uses the exact review data source.
- FAQs/Aftercare: implementation keeps the planned 8-section order and no FAQPage schema was added.
- Booking popup: no Phase 7 changes were made to booking behavior or package IDs.

## In-Scope Fixes Applied

- Header, footer, and logo home links now point to `/home-planned`.
- Legacy routes are redirect-only and no longer expose retired page content.

## Deferred or Out of Scope

- Asset replacement remains governed by the Phase 5 asset-blocked notes.
- Large planning-bundle visual/content discrepancies not introduced by legacy cleanup were not improvised in Phase 7.

## Validation Notes

- `pnpm exec tsc --noEmit --incremental false` still hits the known Windows command-resolution issue: `'tsc' is not recognized as an internal or external command, operable program or batch file.`
- The project-approved equivalent `.\node_modules\.bin\tsc.CMD --noEmit --incremental false` passes.
