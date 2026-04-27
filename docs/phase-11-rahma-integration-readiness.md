# Phase 11 Rahma Integration Readiness - 2026-04-27

## Scope

Phase 11 is a readiness audit only. No Rahma theme, new page, route, navigation, footer, booking, SEO, or content change was applied to the active `master` working tree.

Current verified old-route baseline:

- `/`
- `/hijama`
- `/physiotherapy`
- `/sports-massage-barnet`

WIP source reviewed:

- local branch `rahma-theme-pages-wip`

Read-only Git inspection confirmed `rahma-theme-pages-wip` exists. No branch switch, merge, reset, revert, commit, or push was performed.

## WIP Branch Summary

The WIP branch preserves Rahma/new-page work for later integration. It adds:

- Rahma brand assets under `public/images/brand/rahma/`
- `/about` page implementation
- `/services` page implementation
- Rahma content files for `about`, `services`, and `faqsAftercare`
- new section components for Rahma pages
- Rahma site identity, contact, footer, social, SEO, and route definitions
- Rahma booking dialog copy and Luton service wording

## Shared-File Conflict Surface

The WIP branch touches shared files that are high risk for old-route drift:

- `src/styles/tokens.css`
- `src/styles/site-parity.css`
- `src/components/layout/Logo.tsx`
- `src/content/images.ts`
- `src/content/site/contact.ts`
- `src/content/site/footer.ts`
- `src/content/site/identity.ts`
- `src/content/site/routes.ts`
- `src/content/site/seo.ts`
- `src/content/site/social.ts`
- `src/features/booking/components/BookingDialog.tsx`
- `src/features/booking/components/PreparedStep.tsx`
- `src/features/booking/hooks/useBookingUrlState.ts`
- `src/lib/seo/metadata.ts`
- `src/types/content.ts`

These files must be merged deliberately in Phase 12. They must not be copied over wholesale.

## Phase 11 Readiness Closure

The three Phase 11 readiness blockers were handled without starting Phase 12:

- A separate worktree was created at `rahmatherapy-next-refactor-rahma-wip` for the existing `rahma-theme-pages-wip` branch. This avoided switching or merging the active verified `master` worktree.
- The WIP image registry now follows the recovered Phase 9 local-image standard. `src/content/images.ts` no longer defines `CDN_ROOT`, no longer stores `sourceUrl`, and no longer contains `kind: "remote"` image entries. The two formerly remote assets now use `/images/home/large-testimonial.jpg` and `/images/physiotherapy/outcomes.avif`, with those owned files copied into the WIP worktree.
- `next.config.ts` in the WIP worktree no longer allows `cdn.prod.website-files.com` as a remote image source.
- `src/types/content.ts`, `src/lib/seo/metadata.ts`, and `src/lib/seo/jsonLd.ts` in the WIP worktree no longer rely on `sourceUrl`.
- `/faqs-aftercare` was not added in Phase 11. The plan and architecture map place live new-page implementation in Phase 12, so Phase 11 records it as a mandatory Phase 12 route gate instead of starting the page now.
- Rahma nav/footer/CTA links were audited below and classified as safe, missing, or requiring Phase 12 implementation.

Readiness residue search run in the WIP worktree found no matches for:

```txt
CDN_ROOT
sourceUrl
kind: "remote"
cdn.prod.website-files.com
uploads-ssl.webflow.com
assets-global.website-files.com
d3e54v103j8qbb
```

## Link Readiness Audit

| Link surface | Target | Status | Phase 12 requirement |
| --- | --- | --- | --- |
| Header nav: Home | `/` | Safe | Existing route. |
| Header nav: Physiotherapy | `/physiotherapy` | Safe | Existing route. |
| Header nav: Sports Massage | `/sports-massage-barnet` | Safe | Existing route. |
| Header nav: Hijama | `/hijama` | Safe | Existing route. |
| Header CTA / booking links | `#book-now` | Safe | Existing booking anchor behavior must be rechecked after Rahma merge. |
| Services page package CTAs | `/?booking=1&services=...#book-now` | Safe | Package IDs must still map to booking packages after Phase 12 booking copy/package updates. |
| About CTAs | `/services`, `#book-now`, WhatsApp | Safe with Phase 12 routes | `/services` exists on WIP; WhatsApp is external; booking anchor exists. |
| Services treatment links | `/hijama`, `/sports-massage-barnet` | Safe | Existing routes. |
| FAQ/aftercare content CTAs | `/services`, `/about`, `#book-now` | Requires Phase 12 implementation | Safe only after `/faqs-aftercare` page is added or the content remains unlinked. |
| Route registry | `/faqs-aftercare` | Missing page | Add `src/app/(public)/faqs-aftercare/page.tsx` in Phase 12 before exposing this route. |
| Footer service links | `/physiotherapy`, `/sports-massage-barnet`, `/hijama` | Safe | Existing routes. |
| Footer legal links | `#` placeholders | Requires Phase 12 implementation/removal | Replace with real legal routes/URLs, remove links, or render as non-links before final ship. |
| Contact links | `tel:`, `mailto:` | Safe | Verify final phone/email text during Phase 12 identity pass. |

## Phase 12 Mandatory Gates Before Final Ship

1. Preserve the recovered Phase 9 image standard: local public image paths only unless the user explicitly approves a remote dependency.
2. Add `src/app/(public)/faqs-aftercare/page.tsx` or remove all `/faqs-aftercare` route/link/content exposure before shipping.
3. Replace or remove footer legal `#` placeholders before final ship.
4. Intentionally apply the final unified Rahma standard across old and new routes.
5. Define the final navigation model after `/about`, `/services`, and `/faqs-aftercare` are live.
6. Update booking package labels, dialog copy, URL preselection behavior, summary text, and confirmation language consistently.
7. Recheck header/footer/logo after Rahma brand asset changes at `1440x900`, `768x1024`, and `390x844`.

## Intended Rahma Brand Standard For Phase 12

Phase 12 should use one cohesive Rahma identity across the entire site:

- brand: Rahma Therapy
- location/service area: Luton and surrounding areas
- visual identity: Rahma logo, Rahma favicon, Rahma social preview, and Rahma color tokens
- routes: old service routes retained unless the user approves URL changes
- new pages: `/about`, `/services`, and `/faqs-aftercare`
- navigation/footer: one unified route model, no broken links
- booking: one Rahma/Luton booking language system across old and new routes
- SEO/contact/social: one Rahma identity source

## Old Webflow Traits To Preserve As Layout DNA

The final Rahma site should keep the verified refactor's layout quality:

- generous section rhythm
- strong treatment imagery
- clear service-card hierarchy
- simple header and mobile nav behavior
- full-page CTA rhythm
- booking CTA prominence
- mobile service-page image composition discipline
- footer spacing discipline

## Old Webflow Traits Intentionally Replaceable In Phase 12

Only Phase 12 may intentionally replace:

- Zam Therapy identity
- Barnet contact/service-area wording
- old logo/favicon/social image
- old booking location copy
- old CTA colors if replaced by the final Rahma token system
- old footer/contact/social identity
- old metadata defaults

## Verification

Pre-merge screenshots of the active target were captured for:

- `/`
- `/hijama`
- `/physiotherapy`
- `/sports-massage-barnet`

Viewports:

- `1440x900`
- `768x1024`
- `390x844`

Evidence folder:

```txt
rahmatherapy-next-refactor/audit-screenshots/phase11-premerge-2026-04-27
```

Additional command and load checks after readiness closure:

- `pnpm lint` passed in `rahmatherapy-next-refactor`.
- `pnpm build` passed in `rahmatherapy-next-refactor` with the known non-fatal `metadataBase` warning.
- `pnpm install --offline` completed in `rahmatherapy-next-refactor-rahma-wip` so the isolated WIP worktree could be verified.
- `pnpm lint` passed in `rahmatherapy-next-refactor-rahma-wip`.
- `pnpm build` passed in `rahmatherapy-next-refactor-rahma-wip` with the known non-fatal `metadataBase` warning.
- Active target old routes returned 200 from `http://localhost:3001`: `/`, `/hijama/`, `/physiotherapy/`, `/sports-massage-barnet/`.
- No old-route visual parity source file in the active `master` worktree was changed during the readiness closure.

## Decision

Phase 11 readiness passes.

The preserved WIP branch is available, the high-risk merge surface is documented, the WIP image registry no longer reintroduces Webflow CDN/source metadata, and the Rahma nav/footer/CTA link surface has been audited. `/faqs-aftercare` live route implementation and footer legal placeholder cleanup remain mandatory Phase 12 work, not Phase 11 work. Do not start Phase 12 until the user explicitly approves the Rahma merge.
