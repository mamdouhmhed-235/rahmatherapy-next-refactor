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
- alt text
- width
- height
- sizing intent
- eager/lazy loading intent
- priority intent where relevant

## Current Runtime State

The old public routes now render owned Next/React sections and use local public assets through the typed image registry. The previous mirrored HTML runtime and temporary remote asset fallback are no longer part of the active runtime.

## Covered Local Assets

The local registry now covers the typed content images needed for:

- home hero, services, about, outcomes, and CTA
- physiotherapy hero, benefits, story tabs, and CTA
- sports massage hero, benefits, story tabs, and CTA
- hijama hero, benefits, story tabs, and CTA
- shared practitioner image
- current Zam Therapy logo mark

## Temporary Keep-Remote Allowlist

No temporary remote Webflow asset allowlist remains in the active Next runtime.

`next.config.ts` allows local `/images/**` assets only.

## Deferred Runtime Dependencies

No Webflow CSS, Webflow JS, jQuery, raw mirrored HTML, or image CDN fallback remains in the active source runtime. The only approved `dangerouslySetInnerHTML` usage is controlled JSON-LD output.
