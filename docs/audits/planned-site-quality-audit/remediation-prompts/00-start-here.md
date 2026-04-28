# Start Here Prompt

You are implementing the Rahma Therapy planned-site remediation plan.

Read first:

- `docs/audits/planned-site-quality-audit/00-audit-brief.md`
- `docs/audits/planned-site-quality-audit/09-master-issue-register.md`
- `docs/audits/planned-site-quality-audit/10-remediation-implementation-plan.md`
- `docs/audits/planned-site-quality-audit/11-verification-and-deployment-checklist.md`

Use category files only as needed:

- `01-route-and-codebase-inventory.md`
- `02-plan-compliance-matrix.md`
- `03-visual-ui-ux-audit.md`
- `04-responsive-mobile-audit.md`
- `05-accessibility-audit.md`
- `06-content-copy-compliance-audit.md`
- `07-links-ctas-booking-audit.md`
- `08-performance-seo-deployment-audit.md`

Important scope:

- Work on planned pages and shared shell only where they affect planned pages.
- The previous dual-homepage comparison workflow is being retired.
- Before deleting or redirecting anything, identify the current canonical planned homepage route and which routes are confirmed legacy/dead pages.

Non-negotiable overrides:

1. Do not replace the homepage short disclaimer with the full disclaimer. The approved HomeSafetyAftercare disclaimer is: "Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care."
2. The full disclaimer must remain on Services, focused package pages, and FAQs/Aftercare.
3. Review excerpts are allowed in hero and featured sections if they are exact canonical excerpts or exact canonical `shortExcerpt` values. Do not paraphrase, rewrite, correct, or normalize customer reviews.
4. Do not force the home hero image path from `.avif` to `.webp`. Treat the current AVIF path as approved unless a matching WebP is provided.
5. Do not reduce the initial Reviews wall below 24 visible reviews unless measured performance proves it necessary. Optimize animation cost first.
6. Retire confirmed legacy/dead routes during the dedicated cleanup phase after identifying the current canonical planned homepage route.
7. Do not redesign the booking popup. Fix only behavior/accessibility if needed.
8. Do not remove planned copy, CTAs, service prices, package names, therapist-gender wording, or safety/suitability content.
9. Do not add `/book-now`, `?package=`, or `/services/mobile-massage-therapy`.
10. Do not use random images or generated imagery. Use approved assets only; otherwise keep labelled placeholders.

Execution rules:

- Follow `10-remediation-implementation-plan.md` phase by phase.
- Do not start a later phase until the current phase passes its gate in `11-verification-and-deployment-checklist.md`.
- Make surgical changes only.
- Preserve approved page-plan content.
- Commit each phase separately.
- Push each phase to `master`.
- Wait for Vercel after push when deployment verification is required.
- If a phase fails validation, fix that phase before moving forward.
- If any instruction conflicts with the non-negotiable overrides above, the overrides win.

Start with Phase 1 only when I send the Phase 1 prompt.
