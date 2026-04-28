# Prompt 05: Content, CTA, Performance, SEO, And Deployment Audit

```txt
You are executing Phase 6 and Phase 7 of the planned Rahma Therapy site audit.

Use relevant skills:
- content QA
- wellness copy compliance review
- SEO review
- performance review
- Vercel deployment verification
- release engineering

Goal:
Audit planned-page copy, CTA wiring, booking query behavior, links, performance, SEO metadata, validation commands, route smoke checks, and deployed-site behavior.

This is documentation-only. Do not fix runtime code.

Read first:
- docs/planned-site-audit/00-master-brief.md
- docs/audits/planned-site-quality-audit/01-route-and-codebase-inventory.md
- docs/audits/planned-site-quality-audit/02-plan-compliance-matrix.md

Content checks:
1. Visible copy matches plan files.
2. H1s match plan files.
3. Package names and prices match plan files.
4. FAQ text matches plan files.
5. Required disclaimers are present and unchanged.
6. Review text is preserved and not rewritten.
7. Review claims are not turned into business claims.
8. Placeholder labels are clear and useful.
9. Copy is concise, premium, and not overly text-heavy where the plan requires short persuasive copy.

Banned visible-copy scan:
- cures pain
- treats high blood pressure
- treats internal illness
- removes toxins
- guaranteed relief
- fixes migraines
- heals injuries
- prevents disease
- detoxifies blood
- medical treatment

CTA/link checks:
1. No ?package=.
2. No /book-now.
3. No /services/mobile-massage-therapy.
4. Booking links use ?booking=1 or ?booking=1&services=<service-id>.
5. Valid service IDs only:
   - supreme-combo
   - hijama-package
   - fire-package
   - massage-30
   - massage-60
6. Package detail links use the correct routes.
7. WhatsApp links use https://wa.me/447798897222.
8. Header/footer links relevant to planned pages work.

Performance/SEO checks:
1. Planned images use next/image or placeholder components.
2. No huge direct image imports.
3. Client components are limited to real interaction needs.
4. Reviews wall does not use heavy animation for every card at once.
5. Metadata exists where expected.
6. No self-serving Review or AggregateRating schema is added.

Validation commands:
- pnpm lint
- pnpm exec tsc --noEmit --incremental false
- pnpm build
- existing test script if package.json includes one

Route smoke checks:
- /home-planned
- /home-planning
- /services
- /services/supreme-combo-package
- /services/hijama-package
- /services/fire-cupping-package
- /services/massage-therapy-30-mins
- /services/massage-therapy-1-hour
- /about
- /reviews
- /faqs-aftercare

Live deployment checks:
- https://rahmatherapy-next-refactor.vercel.app/home-planned/
- https://rahmatherapy-next-refactor.vercel.app/services/
- https://rahmatherapy-next-refactor.vercel.app/services/supreme-combo-package/
- https://rahmatherapy-next-refactor.vercel.app/services/hijama-package/
- https://rahmatherapy-next-refactor.vercel.app/services/fire-cupping-package/
- https://rahmatherapy-next-refactor.vercel.app/services/massage-therapy-30-mins/
- https://rahmatherapy-next-refactor.vercel.app/services/massage-therapy-1-hour/
- https://rahmatherapy-next-refactor.vercel.app/about/
- https://rahmatherapy-next-refactor.vercel.app/reviews/
- https://rahmatherapy-next-refactor.vercel.app/faqs-aftercare/

If the primary deployment appears stale or unavailable, also check:
- https://rahmatherapy-next-ref-git-5fb7c0-mamdouh9001-gmailcoms-projects.vercel.app/
- https://rahmatherapy-next-refactor-qgg5pr3n5.vercel.app/

Write findings into:
- 06-content-copy-compliance-audit.md
- 07-links-ctas-booking-audit.md
- 08-performance-seo-deployment-audit.md
- 09-master-issue-register.md
- 11-verification-and-deployment-checklist.md

Use issue prefixes:
- CONTENT
- CTA
- PERF
- SEO
- DEPLOY

Gate before stopping:
- All scans are documented.
- Validation command results are documented exactly.
- Route smoke-check results are documented exactly.
- Deployment checks are documented, including stale-deploy notes if applicable.
- No runtime code changed.
```
