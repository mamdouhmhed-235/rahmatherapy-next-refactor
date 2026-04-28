# Planned Site Quality Audit Brief

## Status

- Phase: 0, scope lock and setup
- Completion status: Complete for Phase 0
- Audit type: Documentation-only audit
- Runtime remediation: Out of scope

## Audit Scope

This audit covers only the planned Rahma Therapy website pages and shared systems that affect those planned pages.

### In-Scope Routes

| Route | Scope Notes |
|---|---|
| `/home-planned` | Planned homepage implementation. |
| `/home-planning` | Alias route that redirects to `/home-planned`. |
| `/services` | Planned main services page. |
| `/services/supreme-combo-package` | Planned focused package page. |
| `/services/hijama-package` | Planned focused package page. |
| `/services/fire-cupping-package` | Planned focused package page. |
| `/services/massage-therapy-30-mins` | Planned focused package page. |
| `/services/massage-therapy-1-hour` | Planned focused package page. |
| `/about` | Planned about page. |
| `/reviews` | Planned reviews page. |
| `/faqs-aftercare` | Planned FAQs and aftercare page. |

### Out-of-Scope Routes

| Route | Scope Decision |
|---|---|
| `/` | Legacy homepage. Excluded from visual and content audit. |
| `/hijama` | Legacy route. Excluded from visual and content audit. |
| `/physiotherapy` | Legacy route. Excluded from visual and content audit. |
| `/sports-massage-barnet` | Legacy route. Excluded from visual and content audit. |

Legacy pages may only be referenced if shared layout, navigation, footer, booking, or content coupling affects planned-page behavior.

## Source of Truth

Planning bundle:

```txt
C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahma-therapy-complete-planning-bundle
```

Primary plan files:

| Planned Area | Plan Source |
|---|---|
| Planned home pages | `rahma-therapy-complete-planning-bundle/01-page-build-plans/01-home-page-codex-implementation-plan.md` |
| About page | `rahma-therapy-complete-planning-bundle/01-page-build-plans/02-about-page-codex-implementation-plan.md` |
| Main services page | `rahma-therapy-complete-planning-bundle/01-page-build-plans/03-main-services-page-codex-implementation-plan.md` |
| Focused package pages | `rahma-therapy-complete-planning-bundle/01-page-build-plans/04-focused-package-pages-codex-implementation-plan.md` |
| Reviews page | `rahma-therapy-complete-planning-bundle/01-page-build-plans/05-reviews-page-codex-implementation-plan.md` |
| FAQs and aftercare page | `rahma-therapy-complete-planning-bundle/01-page-build-plans/06-faqs-aftercare-page-codex-implementation-plan.md` |
| Booking popup content | `rahma-therapy-complete-planning-bundle/01-page-build-plans/07-booking-popup-content-update-codex-implementation-plan.md` |
| Reviews support content | `rahma-therapy-complete-planning-bundle/02-reviews-support-files/rahma-reviews-content.ts` |
| Reviews normalized support | `rahma-therapy-complete-planning-bundle/02-reviews-support-files/rahma-reviews-normalized.json` |
| Reviews category support | `rahma-therapy-complete-planning-bundle/02-reviews-support-files/rahma-reviews-category-support.md` |

## Audit Constraints

- Do not implement remediation during the audit.
- Do not change runtime source files.
- Do not redesign pages.
- Do not change copy, components, or styles except for creating audit documentation files.
- Do not judge planned pages by the legacy website design.
- Do not commit screenshots unless explicitly requested later.
- Do not add or normalize customer review text.
- Do not add unsupported medical claims.
- Required disclaimer text must remain unchanged where required.
- Important override: do not replace the homepage short disclaimer with the full disclaimer.
- Important override: review excerpts are allowed in hero and featured sections if they are exact canonical excerpts or exact canonical `shortExcerpt` values.
- Important override: `/images/home/home-hero.avif` is the approved working planned-home hero image unless a matching approved WebP is provided.
- Important override: preserve dual-homepage navigation for now: `Home` -> `/` and `Planned Home` -> `/home-planned`.
- Important override: do not reduce the initial Reviews wall below 24 visible reviews unless measured performance proves it necessary. Optimize animation cost first.
- Important override: do not redesign the booking popup; fix only behavior/accessibility if needed.

Required full disclaimer for Services, focused package pages, and FAQs/Aftercare:

```txt
Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care. If you have a medical condition, take medication, are pregnant, or are unsure whether treatment is suitable, please speak to a healthcare professional before booking.
```

Approved homepage short disclaimer:

```txt
Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care.
```

## Booking Rules To Verify In Later Phases

| Rule Type | Allowed Format |
|---|---|
| General booking | `?booking=1` |
| Package booking | `?booking=1&services=<service-id>` |

Valid service IDs:

- `supreme-combo`
- `hijama-package`
- `fire-package`
- `massage-30`
- `massage-60`

Forbidden formats and routes:

- `?package=`
- `/book-now`
- `/services/mobile-massage-therapy`

## Deployment Context

Primary live site:

```txt
https://rahmatherapy-next-refactor.vercel.app/
```

Other known Vercel URLs:

```txt
https://rahmatherapy-next-ref-git-5fb7c0-mamdouh9001-gmailcoms-projects.vercel.app/
https://rahmatherapy-next-refactor-qgg5pr3n5.vercel.app/
```

Deployment behavior will be audited in a later phase. If a live deployment is stale, the audit should record the mismatch rather than assuming local behavior is live.

## Phase 0 Gate

| Check | Status |
|---|---|
| Audit output folder exists | Complete |
| Required audit files created | Complete |
| Planned-route scope documented | Complete |
| Legacy visual/content scope excluded | Complete |
| Runtime remediation prohibited | Complete |
| Runtime files changed | No |
