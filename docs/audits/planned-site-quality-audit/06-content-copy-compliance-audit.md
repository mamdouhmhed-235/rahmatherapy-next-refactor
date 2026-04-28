# Content Copy Compliance Audit

## Status

- Phase: 6
- Completion status: Complete for content/copy compliance checks
- Scope: Planned Rahma Therapy pages only
- Method: Static source scan against planned content, plan-compliance findings, banned phrase list, required disclaimer rule, and review-content integrity rule.
- Runtime remediation: None.

## Required Disclaimer

Required full disclaimer for Services, focused package pages, and FAQs/Aftercare:

> Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care. If you have a medical condition, take medication, are pregnant, or are unsure whether treatment is suitable, please speak to a healthcare professional before booking.

Approved homepage short disclaimer:

> Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care.

| Route | Source checked | Result | Issue IDs |
|---|---|---|---|
| `/home-planned` | `src/components/planned-home/HomeSafetyAftercare.tsx` | Pass by approved override: homepage uses the approved short disclaimer and must not be forced to use the full disclaimer. | None |
| `/home-planning` | Redirects to `/home-planned` | Inherits `/home-planned` approved short disclaimer. | None |
| `/services` | `src/content/pages/services.ts`, service components | No required fixed disclaimer mismatch found in this phase. Safety copy remains general and does not introduce the fixed disclaimer string in altered form. | None |
| Focused package routes | `src/content/pages/packagePages.ts`, package components | Safety/suitability copy uses cautious complementary-care framing; no altered instance of the fixed disclaimer string found in this phase. | None |
| `/about` | `src/content/pages/about.ts`, about components | No required fixed disclaimer mismatch found in this phase. | None |
| `/reviews` | `src/components/reviews/*`, `src/lib/content/reviews.ts` | Review excerpts are allowed in hero/proof areas if they are exact canonical excerpts or exact canonical `shortExcerpt` values. This requires verification before remediation, not automatic replacement with full reviews. | Review excerpt verification note |
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
| `/home-planned` | Matches Phase 2 plan matrix except FAQ booking wording issue. AVIF hero path and short disclaimer are approved overrides. | Package names/prices match the planned package data checked in Phase 2. | FAQ preview contains "Book Now page" language that conflicts with booking rules. | Home carousel uses planned home review snippets from `plannedHome.ts`; no new issue in this phase. | Placeholder labels are visible and useful but remain a production-polish issue from Phase 3. | Pass for approved short home disclaimer. | CTA-001, PLAN-HOME-003 |
| `/home-planning` | Redirect alias; inherits `/home-planned`. | Inherits `/home-planned`. | Inherits `/home-planned`. | Inherits `/home-planned`. | Inherits `/home-planned`. | Inherits `/home-planned` approved short disclaimer and FAQ wording issue. | CTA-001 |
| `/services` | Matches planned H1 and service-page content per Phase 2. | Package names/prices and service IDs match planned content. | Mini FAQ copy matches plan intent and avoids forbidden booking routes. | N/A | Placeholder labels are clear where fallbacks render. | Pass for banned phrase scan and package copy. | None |
| `/services/supreme-combo-package` | Matches planned package content per Phase 2. | `Supreme Combo Package`, `GBP 55`, booking ID `supreme-combo`. | Package FAQ copy matches planned content. | N/A | Placeholder labels are clear where fallbacks render. | Pass for banned phrase scan. | None |
| `/services/hijama-package` | Matches planned package content per Phase 2. | `Hijama Package`, `GBP 45`, booking ID `hijama-package`. | Package FAQ copy matches planned content. | N/A | Placeholder labels are clear where fallbacks render. | Pass for banned phrase scan. | None |
| `/services/fire-cupping-package` | Matches planned package content per Phase 2. | `Fire Cupping Package`, `GBP 40`, booking ID `fire-package`. | Package FAQ copy matches planned content. | N/A | Placeholder labels are clear where fallbacks render. | Pass for banned phrase scan. | None |
| `/services/massage-therapy-30-mins` | Matches planned package content per Phase 2. | `30-min Massage Therapy`, `GBP 40`, booking ID `massage-30`. | Package FAQ copy matches planned content. | N/A | Placeholder labels are clear where fallbacks render. | Pass for banned phrase scan. | None |
| `/services/massage-therapy-1-hour` | Matches planned package content per Phase 2. | `1-hour Massage Therapy`, `GBP 60`, booking ID `massage-60`. | Package FAQ copy matches planned content. | N/A | Placeholder labels are clear where fallbacks render. | Pass for banned phrase scan. | None |
| `/about` | Matches planned H1 and about-page content per Phase 2. | N/A | N/A | N/A | Placeholder labels are clear where fallbacks render. | Pass for banned phrase scan. | None |
| `/reviews` | Matches planned H1/page structure. | N/A | N/A | Hero/featured excerpts are acceptable only if they exactly match canonical excerpt or `shortExcerpt` values; future remediation must verify before changing design. | Placeholder labels are clear where fallbacks render. | Pass if excerpts are exact canonical excerpts; verification note remains. | Review excerpt verification note |
| `/faqs-aftercare` | Matches planned H1 and FAQ/aftercare structure per Phase 2. | N/A | FAQ category copy contains "Book Now page" language that conflicts with booking rules. | N/A | Placeholder labels are clear where fallbacks render. | Pass for banned phrase scan; booking copy issue remains. | CTA-001, PLAN-FAQS-003 |

## Content Findings Added This Phase

### Review Excerpt Verification Note

- Severity: Medium until verified
- Route: `/reviews`
- Source: `src/components/reviews/ReviewsHero.tsx`, `src/components/reviews/FeaturedReviewsMosaic.tsx`, `src/lib/content/reviews.ts`
- Observed: The reviews hero and featured mosaic use curated excerpts.
- Expected: Excerpts are allowed if each string is an exact canonical excerpt or exact canonical `shortExcerpt` value. Do not paraphrase, rewrite, correct, or normalize customer reviews. Do not replace the planned curated review design with full long reviews unless the design still works.
- User impact: Incorrect excerpts create content-integrity risk; exact canonical excerpts preserve the planned design while staying compliant.
- Verification method: Static comparison of hero/featured strings against canonical review text and `shortExcerpt` values.

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
