# Content Copy Compliance Audit

## Status

- Phase: 6
- Completion status: Complete for content/copy compliance checks
- Scope: Planned Rahma Therapy pages only
- Method: Static source scan against planned content, plan-compliance findings, banned phrase list, required disclaimer rule, and review-content integrity rule.
- Runtime remediation: None.

## Required Disclaimer

Required fixed disclaimer:

> Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care. If you have a medical condition, take medication, are pregnant, or are unsure whether treatment is suitable, please speak to a healthcare professional before booking.

| Route | Source checked | Result | Issue IDs |
|---|---|---|---|
| `/home-planned` | `src/components/planned-home/HomeSafetyAftercare.tsx` | Fails where the disclaimer is used: rendered copy only includes the first sentence and omits the healthcare-professional suitability guidance. | PLAN-HOME-002, CONTENT-001 |
| `/home-planning` | Redirects to `/home-planned` | Inherits `/home-planned` disclaimer failure. | PLAN-HOME-002, CONTENT-001 |
| `/services` | `src/content/pages/services.ts`, service components | No required fixed disclaimer mismatch found in this phase. Safety copy remains general and does not introduce the fixed disclaimer string in altered form. | None |
| Focused package routes | `src/content/pages/packagePages.ts`, package components | Safety/suitability copy uses cautious complementary-care framing; no altered instance of the fixed disclaimer string found in this phase. | None |
| `/about` | `src/content/pages/about.ts`, about components | No required fixed disclaimer mismatch found in this phase. | None |
| `/reviews` | `src/components/reviews/*`, `src/lib/content/reviews.ts` | Reviews explorer disclaimer copy remains cautious, but review excerpts in hero/proof areas are not preserved exactly. | CONTENT-002, PLAN-REVIEWS-001 |
| `/faqs-aftercare` | `src/content/pages/faqsAftercare.ts`, FAQ components | No altered instance of the fixed disclaimer string found in this phase. | None |

## Banned Visible-Copy Scan

Command scope: `src/content`, planned route component folders, and `src/lib/content`.

Terms scanned:

- `cures pain`
- `treats high blood pressure`
- `treats internal illness`
- `removes toxins`
- `guaranteed relief`
- `fixes migraines`
- `heals injuries`
- `prevents disease`
- `detoxifies blood`
- `medical treatment`

Result: no matches in scoped planned-page source.

## Route Content Matrix

| Route | H1/content plan match | Package names/prices | FAQ text | Reviews text | Placeholder labels | Compliance status | Issue IDs |
|---|---|---|---|---|---|---|---|
| `/home-planned` | Mostly matches Phase 2 plan matrix; hero image path drift remains separate. | Package names/prices match the planned package data checked in Phase 2. | FAQ preview contains "Book Now page" language that conflicts with booking rules. | Home carousel uses planned home review snippets from `plannedHome.ts`; no new issue in this phase. | Placeholder labels are visible and useful but remain a production-polish issue from Phase 3. | Fails fixed disclaimer requirement where the safety note uses a shortened disclaimer. | CONTENT-001, CTA-001, PLAN-HOME-002, PLAN-HOME-003 |
| `/home-planning` | Redirect alias; inherits `/home-planned`. | Inherits `/home-planned`. | Inherits `/home-planned`. | Inherits `/home-planned`. | Inherits `/home-planned`. | Inherits `/home-planned` content issues. | CONTENT-001, CTA-001 |
| `/services` | Matches planned H1 and service-page content per Phase 2. | Package names/prices and service IDs match planned content. | Mini FAQ copy matches plan intent and avoids forbidden booking routes. | N/A | Placeholder labels are clear where fallbacks render. | Pass for banned phrase scan and package copy. | None |
| `/services/supreme-combo-package` | Matches planned package content per Phase 2. | `Supreme Combo Package`, `£80`, booking ID `supreme-combo`. | Package FAQ copy matches planned content. | N/A | Placeholder labels are clear where fallbacks render. | Pass for banned phrase scan. | None |
| `/services/hijama-package` | Matches planned package content per Phase 2. | `Hijama Package`, `£50`, booking ID `hijama-package`. | Package FAQ copy matches planned content. | N/A | Placeholder labels are clear where fallbacks render. | Pass for banned phrase scan. | None |
| `/services/fire-cupping-package` | Matches planned package content per Phase 2. | `Fire Cupping Package`, `£50`, booking ID `fire-package`. | Package FAQ copy matches planned content. | N/A | Placeholder labels are clear where fallbacks render. | Pass for banned phrase scan. | None |
| `/services/massage-therapy-30-mins` | Matches planned package content per Phase 2. | `30-min Massage Therapy`, `£40`, booking ID `massage-30`. | Package FAQ copy matches planned content. | N/A | Placeholder labels are clear where fallbacks render. | Pass for banned phrase scan. | None |
| `/services/massage-therapy-1-hour` | Matches planned package content per Phase 2. | `1-hour Massage Therapy`, `£60`, booking ID `massage-60`. | Package FAQ copy matches planned content. | N/A | Placeholder labels are clear where fallbacks render. | Pass for banned phrase scan. | None |
| `/about` | Matches planned H1 and about-page content per Phase 2. | N/A | N/A | N/A | Placeholder labels are clear where fallbacks render. | Pass for banned phrase scan. | None |
| `/reviews` | Matches planned H1/page structure, but trust-proof review text handling fails the no-rewrite rule. | N/A | N/A | `ReviewsHero` and `FeaturedReviewsMosaic` use hardcoded excerpts instead of exact canonical review text. | Placeholder labels are clear where fallbacks render. | Fails review text preservation rule. | CONTENT-002, PLAN-REVIEWS-001 |
| `/faqs-aftercare` | Matches planned H1 and FAQ/aftercare structure per Phase 2. | N/A | FAQ category copy contains "Book Now page" language that conflicts with booking rules. | N/A | Placeholder labels are clear where fallbacks render. | Pass for banned phrase scan; booking copy issue remains. | CTA-001, PLAN-FAQS-003 |

## Content Findings Added This Phase

### CONTENT-001

- Severity: High
- Route: `/home-planned`, inherited by `/home-planning`
- Source: `src/components/planned-home/HomeSafetyAftercare.tsx`
- Observed: The safety note contains only the first sentence of the required disclaimer.
- Expected: The exact required disclaimer must remain unchanged where required.
- User impact: Users do not receive the full suitability guidance before booking.
- Verification method: Static source inspection plus rendered safety note check.
- Related existing issue: PLAN-HOME-002

### CONTENT-002

- Severity: High
- Route: `/reviews`
- Source: `src/components/reviews/ReviewsHero.tsx`, `src/components/reviews/FeaturedReviewsMosaic.tsx`, `src/lib/content/reviews.ts`
- Observed: The reviews hero uses `heroExcerpts`, and the featured mosaic uses local `quote` strings instead of rendering exact canonical review text.
- Expected: Customer review text must not be rewritten, normalized, paraphrased, or excerpted as if it were the original review.
- User impact: Alters customer-supplied review wording and creates compliance/content-integrity risk.
- Verification method: Static comparison of hardcoded excerpt strings against `rahmaGoogleReviews`.
- Related existing issue: PLAN-REVIEWS-001

## Phase 6 Content Gate

| Check | Status |
|---|---|
| Visible copy checked against Phase 2 plan-compliance matrix | Complete |
| H1s checked through route metadata/rendered smoke outputs and Phase 2 matrix | Complete |
| Package names and prices checked | Complete |
| FAQ text checked | Complete |
| Required disclaimer checked | Complete |
| Review text preservation checked | Complete |
| Banned phrase scan documented | Complete |
| Content issues copied to master issue register | Complete |
| Runtime code changed | No |
