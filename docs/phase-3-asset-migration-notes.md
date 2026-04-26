# Phase 3 Asset Migration Notes

## Owned Asset Strategy

The current visual content image layer has been copied into local project ownership under:

- `public/images/brand`
- `public/images/home`
- `public/images/physiotherapy`
- `public/images/sports-massage`
- `public/images/hijama`
- `public/images/shared`

Typed references now live in:

- `src/content/images.ts`

Each typed image record includes:

- local owned source
- local public path
- original CDN source URL
- alt text
- width
- height
- sizing intent
- eager/lazy loading intent
- priority intent where relevant

## Why This Phase Does Not Change Visible Pages Yet

The current public routes still render mirrored Webflow HTML through:

- `src/components/webflow/WebflowMirrorPage.tsx`
- `src/lib/live-pages.ts`

Those mirrored HTML pages still reference the Webflow CDN at runtime for now. That is expected in Phase 3 because the pages themselves are not rebuilt yet.

The owned image layer created in this phase is for:

- future `next/image` usage in rebuilt sections
- explicit source traceability
- controlled migration away from remote content images

## Covered Local Assets

The local registry now covers the typed content images needed for:

- home hero, services, about, outcomes, and CTA
- physiotherapy hero, benefits, story tabs, and CTA
- sports massage hero, benefits, story tabs, and CTA
- hijama hero, benefits, story tabs, and CTA
- shared practitioner image
- current Zam Therapy logo mark

## Temporary Keep-Remote Allowlist

These remote assets are still intentionally allowed during the temporary mirror runtime:

- `https://cdn.prod.website-files.com/68c53ddd23c15ad134bd30b3/css/zam-therapy.webflow.shared.9d63881ef.min.css`
- `https://d3e54v103j8qbb.cloudfront.net/js/jquery-3.5.1.min.dc5e7f18c8.js?site=68c53ddd23c15ad134bd30b3`
- `https://cdn.prod.website-files.com/68c53ddd23c15ad134bd30b3/js/webflow.d3496025.0aff0456631b934b.js`
- `https://cdn.prod.website-files.com/68c53ddd23c15ad134bd30b3/**`

The final CDN wildcard above is temporary and only covers image and `srcset` references that still live inside:

- `src/content/live-html/home.html`
- `src/content/live-html/physiotherapy.html`
- `src/content/live-html/sports-massage-barnet.html`
- `src/content/live-html/hijama.html`

The typed content and media layer no longer depends on those remote image URLs.

## Deferred Runtime Dependencies

These remote dependencies are intentionally deferred to later phases, especially:

- page rebuild phases for replacing mirrored markup
- Phase 9 for removing the Webflow mirror runtime entirely

Notes:

- the Next.js app favicon is already local via `src/app/favicon.ico`
- the remaining remote favicon references exist only in the exported Webflow source, not in the owned Next runtime
