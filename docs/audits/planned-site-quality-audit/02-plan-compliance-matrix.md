# Plan Compliance Matrix

## Status

- Phase: 2
- Completion status: Complete
- Scope: Planned Rahma Therapy pages only.
- Method: Static plan-to-implementation comparison of route files, content files, and route-owned components.
- Runtime remediation: None.

## Plan Sources

| Page family | Plan source |
|---|---|
| Home | `rahma-therapy-complete-planning-bundle/01-page-build-plans/01-home-page-codex-implementation-plan.md` |
| About | `rahma-therapy-complete-planning-bundle/01-page-build-plans/02-about-page-codex-implementation-plan.md` |
| Main services | `rahma-therapy-complete-planning-bundle/01-page-build-plans/03-main-services-page-codex-implementation-plan.md` |
| Focused package pages | `rahma-therapy-complete-planning-bundle/01-page-build-plans/04-focused-package-pages-codex-implementation-plan.md` |
| Reviews | `rahma-therapy-complete-planning-bundle/01-page-build-plans/05-reviews-page-codex-implementation-plan.md` |
| FAQs and aftercare | `rahma-therapy-complete-planning-bundle/01-page-build-plans/06-faqs-aftercare-page-codex-implementation-plan.md` |
| Booking popup | `rahma-therapy-complete-planning-bundle/01-page-build-plans/07-booking-popup-content-update-codex-implementation-plan.md` |

## Audit Notes

- Booking URL rules from the audit brief and booking popup plan supersede older page-plan examples that reference `/book-now` or `?package=`.
- `?booking=1` and `?booking=1&services=<service-id>` are treated as the expected booking CTA targets for planned pages.
- Service IDs checked: `supreme-combo`, `hijama-package`, `fire-package`, `massage-30`, `massage-60`.
- Out-of-scope legacy routes were not audited except where shared code affects planned pages.

## `/home-planned`

| Planned section | Implemented section/component | Present? | Correct order? | Content match? | Design match? | CTA/link match? | Interaction match? | Code/component match? | Issue IDs |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| HomeHero | `src/components/planned-home/HomeHero.tsx` | Yes | Yes | Partial | Partial | Yes | N/A | Partial | PLAN-HOME-001 |
| HomeTrustStrip | `src/components/planned-home/HomeTrustStrip.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| HomePainPoints | `src/components/planned-home/PainPointCards.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| HomePackageCards | `src/components/planned-home/HomePackageCards.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| HomeWhyRahma | `src/components/planned-home/WhyRahmaTherapy.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| HomeProcess | `src/components/planned-home/HomeAppointmentProcess.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| HomeReviewCarousel | `src/components/planned-home/HomeReviewCarousel.tsx` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | None |
| HomeTeamPreview | `src/components/planned-home/HomeTeamPreview.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| HomeSafetyAftercare | `src/components/planned-home/HomeSafetyAftercare.tsx` | Yes | Yes | Partial | Yes | Yes | N/A | Partial | PLAN-HOME-002 |
| HomeFAQPreview | `src/components/planned-home/HomeFAQPreview.tsx` | Yes | Yes | Partial | Yes | Partial | Yes | Yes | PLAN-HOME-003 |
| HomeFinalCTA | `src/components/planned-home/HomeFinalCTA.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |

## `/home-planning`

| Planned section | Implemented section/component | Present? | Correct order? | Content match? | Design match? | CTA/link match? | Interaction match? | Code/component match? | Issue IDs |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Planned home alias | `src/app/(public)/home-planning/page.tsx` redirects to `/home-planned` | Yes | N/A | Yes | N/A | Yes | Yes | Yes | Inherits PLAN-HOME-001, PLAN-HOME-002, PLAN-HOME-003 |

## `/services`

| Planned section | Implemented section/component | Present? | Correct order? | Content match? | Design match? | CTA/link match? | Interaction match? | Code/component match? | Issue IDs |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| ServicesHero | `src/components/services/ServicesHero.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| ServicesTrustStrip | `src/components/services/ServicesTrustStrip.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| PackageCards | `src/components/services/PackageCards.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageFinder | `src/components/services/PackageFinder.tsx` | Yes | Yes | Yes | Partial | N/A | Yes | Partial | PLAN-SERVICES-001 |
| PackageComparison | `src/components/services/PackageComparison.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| TreatmentMethods | `src/components/services/TreatmentMethods.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| HomeAppointmentProcess | `src/components/services/HomeAppointmentProcess.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| SafetyAftercareBand | `src/components/services/SafetyAftercareBand.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| ServicesMiniFAQ | `src/components/services/ServicesMiniFAQ.tsx` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | None |
| ServicesFinalCTA | `src/components/services/ServicesFinalCTA.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |

## `/services/supreme-combo-package`

| Planned section | Implemented section/component | Present? | Correct order? | Content match? | Design match? | CTA/link match? | Interaction match? | Code/component match? | Issue IDs |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| PackageHero | `src/components/package-pages/PackageHero.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageSummary | `src/components/package-pages/PackageSummaryCard.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageFitSection | `src/components/package-pages/PackageWhoItsFor.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| PackageIncludes | `src/components/package-pages/PackageIncludes.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| TreatmentBreakdown | `src/components/package-pages/TreatmentBreakdown.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| SessionFlow | `src/components/package-pages/PackageSessionSteps.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageBenefits | `src/components/package-pages/PackageBenefits.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| SafetySuitability | `src/components/package-pages/PackageSafety.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageFAQs | `src/components/package-pages/PackageFAQ.tsx` | Yes | Yes | Yes | Yes | N/A | Yes | Yes | None |
| RelatedPackages | `src/components/package-pages/RelatedPackages.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageFinalCTA | `src/components/package-pages/PackageFinalCTA.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |

## `/services/hijama-package`

| Planned section | Implemented section/component | Present? | Correct order? | Content match? | Design match? | CTA/link match? | Interaction match? | Code/component match? | Issue IDs |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| PackageHero | `src/components/package-pages/PackageHero.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageSummary | `src/components/package-pages/PackageSummaryCard.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageFitSection | `src/components/package-pages/PackageWhoItsFor.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| PackageIncludes | `src/components/package-pages/PackageIncludes.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| TreatmentBreakdown | `src/components/package-pages/TreatmentBreakdown.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| SessionFlow | `src/components/package-pages/PackageSessionSteps.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageBenefits | `src/components/package-pages/PackageBenefits.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| SafetySuitability | `src/components/package-pages/PackageSafety.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageFAQs | `src/components/package-pages/PackageFAQ.tsx` | Yes | Yes | Yes | Yes | N/A | Yes | Yes | None |
| RelatedPackages | `src/components/package-pages/RelatedPackages.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageFinalCTA | `src/components/package-pages/PackageFinalCTA.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |

## `/services/fire-cupping-package`

| Planned section | Implemented section/component | Present? | Correct order? | Content match? | Design match? | CTA/link match? | Interaction match? | Code/component match? | Issue IDs |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| PackageHero | `src/components/package-pages/PackageHero.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageSummary | `src/components/package-pages/PackageSummaryCard.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageFitSection | `src/components/package-pages/PackageWhoItsFor.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| PackageIncludes | `src/components/package-pages/PackageIncludes.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| TreatmentBreakdown | `src/components/package-pages/TreatmentBreakdown.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| SessionFlow | `src/components/package-pages/PackageSessionSteps.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageBenefits | `src/components/package-pages/PackageBenefits.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| SafetySuitability | `src/components/package-pages/PackageSafety.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageFAQs | `src/components/package-pages/PackageFAQ.tsx` | Yes | Yes | Yes | Yes | N/A | Yes | Yes | None |
| RelatedPackages | `src/components/package-pages/RelatedPackages.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageFinalCTA | `src/components/package-pages/PackageFinalCTA.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |

## `/services/massage-therapy-30-mins`

| Planned section | Implemented section/component | Present? | Correct order? | Content match? | Design match? | CTA/link match? | Interaction match? | Code/component match? | Issue IDs |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| PackageHero | `src/components/package-pages/PackageHero.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageSummary | `src/components/package-pages/PackageSummaryCard.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageFitSection | `src/components/package-pages/PackageWhoItsFor.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| PackageIncludes | `src/components/package-pages/PackageIncludes.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| TreatmentBreakdown | `src/components/package-pages/TreatmentBreakdown.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| SessionFlow | `src/components/package-pages/PackageSessionSteps.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageBenefits | `src/components/package-pages/PackageBenefits.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| SafetySuitability | `src/components/package-pages/PackageSafety.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageFAQs | `src/components/package-pages/PackageFAQ.tsx` | Yes | Yes | Yes | Yes | N/A | Yes | Yes | None |
| RelatedPackages | `src/components/package-pages/RelatedPackages.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageFinalCTA | `src/components/package-pages/PackageFinalCTA.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |

## `/services/massage-therapy-1-hour`

| Planned section | Implemented section/component | Present? | Correct order? | Content match? | Design match? | CTA/link match? | Interaction match? | Code/component match? | Issue IDs |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| PackageHero | `src/components/package-pages/PackageHero.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageSummary | `src/components/package-pages/PackageSummaryCard.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageFitSection | `src/components/package-pages/PackageWhoItsFor.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| PackageIncludes | `src/components/package-pages/PackageIncludes.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| TreatmentBreakdown | `src/components/package-pages/TreatmentBreakdown.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| SessionFlow | `src/components/package-pages/PackageSessionSteps.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageBenefits | `src/components/package-pages/PackageBenefits.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| SafetySuitability | `src/components/package-pages/PackageSafety.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageFAQs | `src/components/package-pages/PackageFAQ.tsx` | Yes | Yes | Yes | Yes | N/A | Yes | Yes | None |
| RelatedPackages | `src/components/package-pages/RelatedPackages.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| PackageFinalCTA | `src/components/package-pages/PackageFinalCTA.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| 30 mins vs 1 hour comparison | `PackageBenefits` comparison data | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |

## Focused Package Detail Checks

The component-level matrix above confirms that each focused package route uses the required page sections in the correct order. This detail check records the package-specific facts that must also match the focused package plan from top to bottom.

| Route | H1 | Price | Includes / offer checked | Booking href | Required related packages | Image paths checked | Disclaimer | Result |
|---|---|---:|---|---|---|---|---|---|
| `/services/supreme-combo-package` | `Supreme Combo Package in Luton` | GBP 55 | Pre-cupping massage; IASTM / Graston-style therapy; dry cupping; fire cupping; wet cupping / hijama | `?booking=1&services=supreme-combo` | Hijama, Fire, 1-hour Massage | `/images/packages/supreme-combo-hero.webp`; `/images/packages/supreme-combo-breakdown.webp` | Present through `PackageSafety` | Pass |
| `/services/hijama-package` | `Private Hijama Package in Luton` | GBP 45 | Pre-cupping massage; dry cupping; wet cupping / hijama | `?booking=1&services=hijama-package` | Supreme, Fire, 1-hour Massage | `/images/packages/hijama-hero.webp`; `/images/packages/hijama-breakdown.webp` | Present through `PackageSafety` | Pass |
| `/services/fire-cupping-package` | `Fire Cupping Package in Luton` | GBP 40 | Pre-cupping massage with essential oils; dry / fire cupping | `?booking=1&services=fire-package` | Supreme, Hijama, 30-min Massage | `/images/packages/fire-cupping-hero.webp`; `/images/packages/fire-cupping-breakdown.webp` | Present through `PackageSafety` | Pass |
| `/services/massage-therapy-30-mins` | `30-Min Mobile Massage Therapy in Luton` | GBP 40 | Focused 30-minute massage option for one agreed area | `?booking=1&services=massage-30` | 1-hour Massage, Fire, Supreme | `/images/packages/massage-30-hero.webp`; `/images/packages/massage-30-breakdown.webp` | Present through `PackageSafety` | Pass |
| `/services/massage-therapy-1-hour` | `1-Hour Mobile Massage Therapy in Luton` | GBP 60 | Longer massage option for more time, more areas, and calmer full-body session | `?booking=1&services=massage-60` | 30-min Massage, Supreme, Fire | `/images/packages/massage-60-hero.webp`; `/images/packages/massage-60-breakdown.webp` | Present through `PackageSafety` | Pass |

Focused package content cross-check status:

- H1s match the focused package plan.
- Prices match the focused package plan and implemented package content.
- Booking hrefs use only valid `?booking=1&services=<service-id>` values.
- Massage routes use `/services/massage-therapy-30-mins` and `/services/massage-therapy-1-hour`.
- No focused package route points to `/services/mobile-massage-therapy`.
- Related package logic matches the user-approved focused package plan.
- Remaining package-page issues are visual/responsive/accessibility issues tracked outside this plan-compliance table, not package fact mismatches.

## `/about`

| Planned section | Implemented section/component | Present? | Correct order? | Content match? | Design match? | CTA/link match? | Interaction match? | Code/component match? | Issue IDs |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| AboutHero | `src/components/about/AboutHero.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| AboutStatsStrip | `src/components/about/AboutStatsStrip.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| TrustSnapshot | `src/components/about/TrustSnapshot.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| BrandStory | `src/components/about/BrandStory.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| TeamProfiles | `src/components/about/TeamProfiles.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| SafetyStandards | `src/components/about/SafetyStandards.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| MilestoneTimeline | `src/components/about/MilestoneTimeline.tsx` | Yes | Yes | Yes | Yes | N/A | Yes | Yes | None |
| ComfortSection | `src/components/about/ComfortSection.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| CredentialsBand | `src/components/about/CredentialsBand.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| AboutFinalCTA | `src/components/about/AboutFinalCTA.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |

## `/reviews`

| Planned section | Implemented section/component | Present? | Correct order? | Content match? | Design match? | CTA/link match? | Interaction match? | Code/component match? | Issue IDs |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| ReviewsHero | `src/components/reviews/ReviewsHero.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| ReviewsStatsStrip | `src/components/reviews/ReviewsStatsStrip.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| FeaturedReviewsMosaic | `src/components/reviews/FeaturedReviewsMosaic.tsx` | Yes | Yes | Partial | Partial | N/A | Partial | Partial | PLAN-REVIEWS-001, PLAN-REVIEWS-002 |
| ReviewFilters and ReviewWall | `src/components/reviews/ReviewsExplorer.tsx` | Yes | Yes | Yes | Yes | N/A | Yes | Yes | None |
| ReviewThemeHighlights | `src/components/reviews/ReviewThemeHighlights.tsx` | Yes | Yes | Yes | Yes | N/A | N/A | Yes | None |
| LeaveReviewCTA | `src/components/reviews/LeaveReviewCTA.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| ReviewsFinalCTA | `src/components/reviews/ReviewsFinalCTA.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| Review schema guard | `src/app/(public)/reviews/page.tsx` | Yes | N/A | Yes | N/A | N/A | N/A | Yes | None |

## `/faqs-aftercare`

| Planned section | Implemented section/component | Present? | Correct order? | Content match? | Design match? | CTA/link match? | Interaction match? | Code/component match? | Issue IDs |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| FaqsAftercareHero | `src/components/faqs-aftercare/FaqsAftercareHero.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| QuickAnswersStrip | `src/components/faqs-aftercare/QuickAnswersStrip.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| BeforeAppointment | `src/components/faqs-aftercare/BeforeAppointment.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| AftercareTabs | `src/components/faqs-aftercare/AftercareTabs.tsx` | Yes | Yes | Yes | Partial | N/A | Partial | Partial | PLAN-FAQS-001, PLAN-FAQS-002 |
| SafetySuitability | `src/components/faqs-aftercare/SafetySuitability.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| FaqCategoryAccordions | `src/components/faqs-aftercare/FaqCategoryAccordions.tsx` | Yes | Yes | Partial | Yes | Partial | Yes | Yes | PLAN-FAQS-003 |
| WhenToGetAdvice | `src/components/faqs-aftercare/WhenToGetAdvice.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |
| FaqsAftercareFinalCTA | `src/components/faqs-aftercare/FaqsAftercareFinalCTA.tsx` | Yes | Yes | Yes | Yes | Yes | N/A | Yes | None |

## Booking Popup Shared Flow

| Planned section | Implemented section/component | Present? | Correct order? | Content match? | Design match? | CTA/link match? | Interaction match? | Code/component match? | Issue IDs |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| URL open and package preselection | `src/features/booking/hooks/useBookingUrlState.ts`, `src/components/shared/CTAButtons.tsx` | Yes | N/A | Yes | N/A | Yes | Yes | Yes | None |
| Dialog shell | `src/features/booking/BookingDialog.tsx` | Yes | Yes | Yes | Yes | N/A | Yes | Yes | None |
| Step labels and state model | `src/features/booking/types.ts`, `src/features/booking/BookingProgress.tsx` | Yes | Yes | Yes | Yes | N/A | Yes | Yes | None |
| Package selection | `src/features/booking/steps/PackageSelectionStep.tsx`, `src/content/booking-packages.ts` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | None |
| Visit details | `src/features/booking/steps/VisitDetailsStep.tsx`, `src/features/booking/bookingSchema.ts` | Yes | Yes | Yes | Yes | N/A | Yes | Yes | None |
| Review and acknowledgement | `src/features/booking/steps/ReviewStep.tsx`, `src/features/booking/bookingSchema.ts` | Yes | Yes | Yes | Yes | N/A | Yes | Yes | None |
| Prepared state and submission copy | `src/features/booking/steps/PreparedStep.tsx`, `src/features/booking/submitBookingRequest.ts` | Yes | Yes | Yes | Yes | N/A | Yes | Yes | None |
| Booking summary | `src/features/booking/BookingSummary.tsx` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | None |

## Phase 2 Gate

- Every planned route has a completed matrix: Yes.
- Every discrepancy has a stable issue ID: Yes.
- Every issue ID appears in `09-master-issue-register.md`: Yes.
- Runtime code changed: No.
