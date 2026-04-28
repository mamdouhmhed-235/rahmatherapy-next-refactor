# Phase 2 Prompt: Content And Plan-Compliance Restoration

You are executing Phase 2 of the Rahma Therapy planned-site remediation plan.

Use relevant skills:

- content QA
- plan compliance auditing
- frontend implementation
- accessibility-aware image handling

Read before editing:

- `docs/audits/planned-site-quality-audit/02-plan-compliance-matrix.md`
- `docs/audits/planned-site-quality-audit/06-content-copy-compliance-audit.md`
- `docs/audits/planned-site-quality-audit/07-links-ctas-booking-audit.md`
- `docs/audits/planned-site-quality-audit/09-master-issue-register.md`
- Phase 2 in `docs/audits/planned-site-quality-audit/10-remediation-implementation-plan.md`
- Phase 2 gate in `docs/audits/planned-site-quality-audit/11-verification-and-deployment-checklist.md`

Goal:

Restore compliance-sensitive copy, review text integrity, booking copy, and planned image-wrapper behavior before broader accessibility/design work.

Issue IDs:

- `CTA-001`
- `REVIEW-EXCERPT-VERIFY`
- `PLAN-SERVICES-001`
- `PLAN-FAQS-002`

Focus routes:

- `/home-planned`
- `/home-planning`
- `/services`
- `/reviews`
- `/faqs-aftercare`

Likely files:

- `src/content/pages/plannedHome.ts`
- `src/content/pages/faqsAftercare.ts`
- `src/components/reviews/ReviewsHero.tsx`
- `src/components/reviews/FeaturedReviewsMosaic.tsx`
- `src/lib/content/reviews.ts`
- `src/components/services/PackageFinder.tsx`
- `src/components/services/ServicesImage.tsx`
- `src/components/faqs-aftercare/AftercareTabs.tsx`
- `src/components/faqs-aftercare/FaqsAftercareImage.tsx`

Non-negotiable constraints:

- Do not replace the homepage short disclaimer with the full disclaimer.
- Keep the full disclaimer on Services, focused package pages, and FAQs/Aftercare where required.
- Do not add, paraphrase, rewrite, correct, or normalize customer review text.
- Review excerpts are allowed if they exactly match canonical review text or exact canonical `shortExcerpt` values.
- Do not add unsupported medical claims.
- Do not force `HomeHero` from `.avif` to `.webp`; the current AVIF path is approved unless a matching approved WebP is provided.
- Do not invent assets. If aftercare assets are unavailable, keep labelled placeholders and mark asset replacement for Phase 5.
- Do not introduce forbidden booking URLs.

Implementation checklist:

1. Verify the home safety note remains the approved short disclaimer and do not change it.
2. Update planned home and FAQs/aftercare FAQ answers to refer to the booking request flow or WhatsApp without mentioning a Book Now page.
3. Compare reviews hero and featured mosaic excerpts against canonical review text and `shortExcerpt` values.
4. Change only non-canonical/paraphrased review excerpts. Do not replace the curated design with full long reviews unless the design still works.
5. Verify `HomeHero` keeps the approved `.avif` path unless an approved WebP is supplied.
6. Change `PackageFinder` to render media through `ServicesImage`.
7. Change `AftercareTabs` to render active tab imagery through `FaqsAftercareImage`.
8. Run static scans for `Book Now page`, `/book-now`, `?package=`, and non-canonical review excerpt strings.

Validation:

- `pnpm lint`
- `pnpm exec tsc --noEmit --incremental false`
- `pnpm build`
- `pnpm test` if present

Local smoke checks:

- `/home-planned/`
- `/services/`
- `/reviews/`
- `/faqs-aftercare/`

Check:

- Approved short disclaimer remains on home.
- Full disclaimer remains where required.
- No visible "Book Now page" copy.
- Reviews proof excerpts match canonical review text or exact canonical `shortExcerpt` values.
- `PackageFinder` and aftercare tab media render through route-owned wrappers.
- Home hero keeps the approved `.avif` path.

Deployment gate:

- Commit message: `fix planned content compliance and image wrappers`
- Push to `master`.
- Wait for Vercel.
- Check `/home-planned/`, `/services/`, `/reviews/`, `/faqs-aftercare/`.

Final response:

- Files changed
- Issues fixed
- Validation results
- Static scan results
- Local route checks
- Vercel checks
- Commit hash
- Push result
- Whether Phase 3 is safe to start

Do not start Phase 3.

