# Route And Codebase Inventory

## Status

- Phase: 1, codebase and route inventory
- Completion status: Complete for Phase 1
- Findings mode: Structural inventory only
- Runtime remediation: Not performed

## Repository And Source Roots

| Area | Path |
|---|---|
| Next.js app root | `rahmatherapy-next-refactor/src/app` |
| Public route group | `rahmatherapy-next-refactor/src/app/(public)` |
| Planned page components | `rahmatherapy-next-refactor/src/components` |
| Planned page content | `rahmatherapy-next-refactor/src/content/pages` |
| Shared planned-page content | `rahmatherapy-next-refactor/src/content/site` |
| Booking feature | `rahmatherapy-next-refactor/src/features/booking` |
| Planning bundle | `rahma-therapy-complete-planning-bundle` |

## Route Inventory

| Route | Route File | Route Behavior | Content Source | Component Source | Plan Source |
|---|---|---|---|---|---|
| `/home-planned` | `src/app/(public)/home-planned/page.tsx` | Static App Router page with page metadata and `HealthAndBeautyBusiness` JSON-LD. | `src/content/pages/plannedHome.ts` | `src/components/planned-home/*` | `01-page-build-plans/01-home-page-codex-implementation-plan.md` |
| `/home-planning` | `src/app/(public)/home-planning/page.tsx` | Redirect alias to `/home-planned`. | Uses `/home-planned` content after redirect. | Uses `/home-planned` components after redirect. | `01-page-build-plans/01-home-page-codex-implementation-plan.md` |
| `/services` | `src/app/(public)/services/page.tsx` | Static App Router page with page metadata and `HealthAndBeautyBusiness` JSON-LD. | `src/content/pages/services.ts` | `src/components/services/*` | `01-page-build-plans/03-main-services-page-codex-implementation-plan.md` |
| `/services/supreme-combo-package` | `src/app/(public)/services/[slug]/page.tsx` | Dynamic route generated from `packagePages`; slug maps to focused package content. | `src/content/pages/packagePages.ts` entry `slug: "supreme-combo-package"` | `src/components/package-pages/*` | `01-page-build-plans/04-focused-package-pages-codex-implementation-plan.md` |
| `/services/hijama-package` | `src/app/(public)/services/[slug]/page.tsx` | Dynamic route generated from `packagePages`; slug maps to focused package content. | `src/content/pages/packagePages.ts` entry `slug: "hijama-package"` | `src/components/package-pages/*` | `01-page-build-plans/04-focused-package-pages-codex-implementation-plan.md` |
| `/services/fire-cupping-package` | `src/app/(public)/services/[slug]/page.tsx` | Dynamic route generated from `packagePages`; slug maps to focused package content. | `src/content/pages/packagePages.ts` entry `slug: "fire-cupping-package"` | `src/components/package-pages/*` | `01-page-build-plans/04-focused-package-pages-codex-implementation-plan.md` |
| `/services/massage-therapy-30-mins` | `src/app/(public)/services/[slug]/page.tsx` | Dynamic route generated from `packagePages`; slug maps to focused package content. | `src/content/pages/packagePages.ts` entry `slug: "massage-therapy-30-mins"` | `src/components/package-pages/*` | `01-page-build-plans/04-focused-package-pages-codex-implementation-plan.md` |
| `/services/massage-therapy-1-hour` | `src/app/(public)/services/[slug]/page.tsx` | Dynamic route generated from `packagePages`; slug maps to focused package content. | `src/content/pages/packagePages.ts` entry `slug: "massage-therapy-1-hour"` | `src/components/package-pages/*` | `01-page-build-plans/04-focused-package-pages-codex-implementation-plan.md` |
| `/about` | `src/app/(public)/about/page.tsx` | Static App Router page with page metadata and `HealthAndBeautyBusiness` JSON-LD. | `src/content/pages/about.ts` | `src/components/about/*` | `01-page-build-plans/02-about-page-codex-implementation-plan.md` |
| `/reviews` | `src/app/(public)/reviews/page.tsx` | Static App Router page with page metadata and breadcrumb JSON-LD. | `src/lib/content/reviews.ts`; review support source to compare against planning bundle files. | `src/components/reviews/*` | `01-page-build-plans/05-reviews-page-codex-implementation-plan.md` |
| `/faqs-aftercare` | `src/app/(public)/faqs-aftercare/page.tsx` | Static App Router page with page metadata and `HealthAndBeautyBusiness` JSON-LD. | `src/content/pages/faqsAftercare.ts` | `src/components/faqs-aftercare/*` | `01-page-build-plans/06-faqs-aftercare-page-codex-implementation-plan.md` |

## Page Section Composition

### `/home-planned`

Route file imports and renders:

1. `HomeHero`
2. `HomeTrustStrip`
3. `PainPointCards`
4. `HomePackageCards`
5. `WhyRahmaTherapy`
6. `HomeAppointmentProcess`
7. `HomeReviewCarousel`
8. `HomeTeamPreview`
9. `HomeSafetyAftercare`
10. `HomeFAQPreview`
11. `HomeFinalCTA`

Primary content source: `src/content/pages/plannedHome.ts`.

Client components in route tree:

- `src/components/planned-home/HomeReviewCarousel.tsx`
- Shared layout client component `src/components/layout/SiteHeader.tsx`
- Shared booking client feature `src/features/booking/BookingExperience.tsx`
- Shared booking child components listed in the booking inventory below
- Shared UI client component `src/components/ui/accordion.tsx` through `HomeFAQPreview`

### `/home-planning`

Route file imports `redirect` from `next/navigation` and redirects to `/home-planned`.

Primary content and component source after redirect:

- `src/content/pages/plannedHome.ts`
- `src/components/planned-home/*`

### `/services`

Route file imports and renders:

1. `ServicesHero`
2. `ServicesTrustStrip`
3. `PackageCards`
4. `PackageFinder`
5. `PackageComparison`
6. `TreatmentMethods`
7. `HomeAppointmentProcess`
8. `SafetyAftercareBand`
9. `ServicesMiniFAQ`
10. `ServicesFinalCTA`

Primary content source: `src/content/pages/services.ts`.

Client components in route tree:

- `src/components/services/PackageFinder.tsx`
- Shared layout client component `src/components/layout/SiteHeader.tsx`
- Shared booking client feature `src/features/booking/BookingExperience.tsx`
- Shared UI client component `src/components/ui/accordion.tsx` through `ServicesMiniFAQ`

### Focused Package Routes

Dynamic route file `src/app/(public)/services/[slug]/page.tsx` imports and renders:

1. `PackageHero`
2. `PackageSummaryCard`
3. `PackageWhoItsFor`
4. `PackageIncludes`
5. `TreatmentBreakdown`
6. `PackageSessionSteps`
7. `PackageBenefits`
8. `PackageSafety`
9. `PackageFAQ`
10. `RelatedPackages`
11. `PackageFinalCTA`

Primary content source: `src/content/pages/packagePages.ts`.

Generated slugs:

- `supreme-combo-package`
- `hijama-package`
- `fire-cupping-package`
- `massage-therapy-30-mins`
- `massage-therapy-1-hour`

Client components in route tree:

- Shared layout client component `src/components/layout/SiteHeader.tsx`
- Shared booking client feature `src/features/booking/BookingExperience.tsx`
- Shared UI client component `src/components/ui/accordion.tsx` through `PackageFAQ`

### `/about`

Route file imports and renders:

1. `AboutHero`
2. `AboutStatsStrip`
3. `TrustSnapshot`
4. `BrandStory`
5. `TeamProfiles`
6. `SafetyStandards`
7. `MilestoneTimeline`
8. `ComfortSection`
9. `CredentialsBand`
10. `AboutFinalCTA`

Primary content source: `src/content/pages/about.ts`.

Client components in route tree:

- `src/components/about/MilestoneTimeline.tsx`
- Shared layout client component `src/components/layout/SiteHeader.tsx`
- Shared booking client feature `src/features/booking/BookingExperience.tsx`

### `/reviews`

Route file imports and renders:

1. `ReviewsHero`
2. `ReviewsStatsStrip`
3. `FeaturedReviewsMosaic`
4. `ReviewsExplorer`
5. `ReviewThemeHighlights`
6. `LeaveReviewCTA`
7. `ReviewsFinalCTA`

Primary content source:

- `src/lib/content/reviews.ts`
- Planning bundle support files in `02-reviews-support-files/*`

Client components in route tree:

- `src/components/reviews/ReviewsExplorer.tsx`
- `src/components/reviews/ReviewFilters.tsx`
- `src/components/reviews/ReviewWall.tsx`
- `src/components/reviews/ReviewCard.tsx`
- Shared layout client component `src/components/layout/SiteHeader.tsx`
- Shared booking client feature `src/features/booking/BookingExperience.tsx`

### `/faqs-aftercare`

Route file imports and renders:

1. `FaqsAftercareHero`
2. `QuickAnswersStrip`
3. `BeforeAppointment`
4. `AftercareTabs`
5. `SafetySuitability`
6. `FaqCategoryAccordions`
7. `WhenToGetAdvice`
8. `FaqsAftercareFinalCTA`

Primary content source: `src/content/pages/faqsAftercare.ts`.

Client components in route tree:

- `src/components/faqs-aftercare/AftercareTabs.tsx`
- `src/components/faqs-aftercare/FaqCategoryAccordions.tsx`
- Shared layout client component `src/components/layout/SiteHeader.tsx`
- Shared booking client feature `src/features/booking/BookingExperience.tsx`
- Shared UI client component `src/components/ui/accordion.tsx`

## Shared Planned-Page Layout

All planned routes are inside `src/app/(public)` and inherit:

| Shared File | Responsibility |
|---|---|
| `src/app/(public)/layout.tsx` | Renders `SiteHeader`, `main#main-content`, `SiteFooter`, and `BookingExperience` around public pages. |
| `src/components/layout/SiteHeader.tsx` | Client header with desktop nav, mobile nav, active route state, social links, and booking trigger. |
| `src/components/layout/SiteFooter.tsx` | Shared footer navigation, contact links, logo, and booking trigger. |
| `src/components/layout/BookingTrigger.tsx` | Builds `?booking=1` and `?booking=1&services=<ids>` booking links. |
| `src/components/layout/Logo.tsx` | Shared logo link and brand image handling. |

Navigation and footer content:

| Content File | Notes |
|---|---|
| `src/content/site/navigation.ts` | Primary navigation includes `/`, `/home-planned`, `/services`, `/about`, `/reviews`, and `/faqs-aftercare`. |
| `src/content/site/footer.ts` | Footer explore links include `/`, `/home-planned`, `/services`, `/about`, `/reviews`, and `/faqs-aftercare`. |
| `src/content/site/contact.ts` | Defines `bookingLink` as `?booking=1`, phone, WhatsApp, and email links. |
| `src/content/site/social.ts` | Supplies shared social links used by header and footer. |
| `src/content/site/identity.ts` | Supplies shared brand identity used by logo components. |

## Shared Components Used By Planned Pages

| Shared Component | Used For |
|---|---|
| `src/components/shared/SectionContainer.tsx` | Planned-page section width and spacing wrapper. |
| `src/components/shared/SectionHeading.tsx` | Shared section eyebrow/title/description treatment. |
| `src/components/shared/ImagePlaceholder.tsx` | Accessible placeholder output for missing planned images. |
| `src/components/shared/StarsRating.tsx` | Rating display for reviews and home carousel. |
| `src/components/shared/CTAButtons.tsx` | Shared CTA rendering available to planned and legacy section components. |
| `src/components/shared/ImageOverlayCard.tsx` | Shared overlay card available to planned and legacy section components. |
| `src/components/ui/accordion.tsx` | Client accordion primitive used by FAQ sections. |
| `src/components/ui/button-link.tsx` | Client button-link primitive available in shared UI layer. |
| `src/components/ui/dialog.tsx` | Client dialog primitive available in shared UI layer. |

## Image Placeholder Wrappers

Each planned page family has a wrapper that checks whether the requested public asset exists. If the asset is missing, it renders `ImagePlaceholder`.

| Wrapper | Used By | Placeholder Behavior |
|---|---|---|
| `src/components/planned-home/PlannedHomeImage.tsx` | Planned homepage components | Uses `existsSync` against `public/`; renders absolute-fill placeholder with `PLACEHOLDER IMAGE` label. |
| `src/components/services/ServicesImage.tsx` | Main services page components | Uses `existsSync` against `public/`; renders absolute-fill placeholder with `PLACEHOLDER IMAGE` label. |
| `src/components/package-pages/PackageImage.tsx` | Focused package page components | Uses `existsSync` against `public/`; renders absolute-fill placeholder with `PLACEHOLDER IMAGE` label. |
| `src/components/about/AboutImage.tsx` | About page components | Uses `existsSync` against `public/`; renders absolute-fill placeholder with `PLACEHOLDER IMAGE` label. |
| `src/components/reviews/ReviewsImage.tsx` | Reviews page components | Uses `fs.existsSync` against `public/`; renders direct placeholder with `PLACEHOLDER IMAGE` label. |
| `src/components/faqs-aftercare/FaqsAftercareImage.tsx` | FAQs and aftercare components | Uses `existsSync` against `public/`; renders absolute-fill placeholder with `PLACEHOLDER IMAGE` label. |
| `src/components/shared/ImagePlaceholder.tsx` | Shared fallback component | Renders `role="img"` with an `aria-label` describing intended image type and file path. |

## Booking Popup Inventory

Shared booking files relevant to planned routes:

| File | Responsibility |
|---|---|
| `src/features/booking/BookingExperience.tsx` | Client booking popup controller, form steps, package selection, submission flow, inert page shell behavior, and URL-state integration. |
| `src/features/booking/hooks/useBookingUrlState.ts` | Opens booking popup from `?booking=1`, supports `services` query values, and also checks `#book-now`. |
| `src/features/booking/data/booking-packages.ts` | Defines valid booking package IDs and package metadata. |
| `src/features/booking/schemas/booking-schema.ts` | Booking form validation schemas. |
| `src/features/booking/actions/submitBookingRequest.ts` | Submission action used by the booking flow. |
| `src/features/booking/store/booking-store.ts` | Client booking draft store. |
| `src/features/booking/components/BookingDialog.tsx` | Booking dialog shell. |
| `src/features/booking/components/BookingProgress.tsx` | Step progress display and step index helpers. |
| `src/features/booking/components/PackageSelectionStep.tsx` | Package selection UI. |
| `src/features/booking/components/VisitDetailsStep.tsx` | Contact and visit details UI. |
| `src/features/booking/components/ReviewStep.tsx` | Booking request review UI. |
| `src/features/booking/components/PreparedStep.tsx` | Prepared/submitted state UI. |
| `src/features/booking/components/BookingSummary.tsx` | Selected package summary UI. |
| `src/features/booking/components/DatePickerField.tsx` | Date field UI. |
| `src/features/booking/components/TimeSlotPicker.tsx` | Time slot picker UI. |
| `src/features/booking/components/Field.tsx` | Shared booking form field wrapper. |
| `src/features/booking/components/MotionStep.tsx` | Step transition wrapper. |

Valid booking IDs in code:

- `supreme-combo`
- `hijama-package`
- `fire-package`
- `massage-30`
- `massage-60`

## Planned Content Files

| Content File | Planned Route Family |
|---|---|
| `src/content/pages/plannedHome.ts` | `/home-planned`, `/home-planning` after redirect |
| `src/content/pages/services.ts` | `/services` |
| `src/content/pages/packagePages.ts` | Focused package routes under `/services/[slug]` |
| `src/content/pages/about.ts` | `/about` |
| `src/lib/content/reviews.ts` | `/reviews` |
| `src/content/pages/faqsAftercare.ts` | `/faqs-aftercare` |

## Component Folder Map

| Folder | Planned Routes |
|---|---|
| `src/components/planned-home` | `/home-planned`, `/home-planning` after redirect |
| `src/components/services` | `/services` |
| `src/components/package-pages` | Focused package routes under `/services/[slug]` |
| `src/components/about` | `/about` |
| `src/components/reviews` | `/reviews` |
| `src/components/faqs-aftercare` | `/faqs-aftercare` |
| `src/components/layout` | All public planned routes |
| `src/components/shared` | All planned page families |
| `src/components/ui` | Accordion/dialog/form primitives used by planned pages and booking |
| `src/features/booking` | All public planned routes through shared layout |

## Legacy Coupling Inventory

This phase did not perform findings analysis, but the following shared-surface coupling was identified for later audit phases:

| Coupling Surface | Observed Source | Later Audit Relevance |
|---|---|---|
| Public layout shared by planned and legacy pages | `src/app/(public)/layout.tsx` | Header, footer, and booking popup changes affect both planned and out-of-scope legacy routes. |
| Navigation includes legacy homepage link | `src/content/site/navigation.ts` has `Home` pointing to `/` | Later CTA/navigation audit should decide whether this is acceptable for planned-page navigation. |
| Footer includes legacy homepage link | `src/content/site/footer.ts` has `Home` pointing to `/` | Later CTA/navigation audit should decide whether this is acceptable for planned-page footer navigation. |
| Legacy route files remain in same public group | `src/app/(public)/page.tsx`, `hijama/page.tsx`, `physiotherapy/page.tsx`, `sports-massage-barnet/page.tsx` | Excluded from direct audit, but shared shell behavior can affect planned pages. |
| Shared legacy section components exist | `src/components/sections/*` and legacy content files under `src/content/pages/home.ts`, `hijama.ts`, `physiotherapy.ts`, `sportsMassageBarnet.ts` | Out of direct scope unless imported by planned pages or shared layout. |
| Booking URL hook checks `#book-now` | `src/features/booking/hooks/useBookingUrlState.ts` | Later booking audit should evaluate against allowed and forbidden booking rules. |

## Phase 1 Gate

| Check | Status |
|---|---|
| All required audit files exist | Complete |
| Every in-scope route has mapped route file | Complete |
| Every in-scope route has mapped content source | Complete |
| Every in-scope route has mapped component source | Complete |
| Every in-scope route has mapped plan source | Complete |
| Shared booking files inventoried | Complete |
| Shared navigation/footer files inventoried | Complete |
| Image placeholder wrappers inventoried | Complete |
| Legacy coupling noted without remediation | Complete |
| Runtime files changed | No |

## Next Phase Inputs

Phase 2 should read the mapped plan files and perform top-to-bottom plan compliance checks for every in-scope route. Any discrepancies should be recorded in `02-plan-compliance-matrix.md` and copied into `09-master-issue-register.md`.

