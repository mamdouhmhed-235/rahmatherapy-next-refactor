# Prompt 02: Top-To-Bottom Plan Compliance Audit

```txt
You are executing Phase 2 of the planned Rahma Therapy site audit.

Use relevant skills:
- plan compliance auditing
- senior frontend implementation review
- content QA
- Next.js component architecture review

Goal:
Audit every planned page from top to bottom against its respective plan file. This phase must identify section-order drift, content drift, design drift, CTA drift, interaction drift, and code/component drift.

This is documentation-only. Do not fix runtime code.

Read first:
- docs/planned-site-audit/00-master-brief.md
- docs/planned-site-audit/01-comprehensive-audit-execution-plan.md
- docs/audits/planned-site-quality-audit/00-audit-brief.md
- docs/audits/planned-site-quality-audit/01-route-and-codebase-inventory.md

Plan files:
- rahma-therapy-complete-planning-bundle/01-page-build-plans/01-home-page-codex-implementation-plan.md
- rahma-therapy-complete-planning-bundle/01-page-build-plans/02-about-page-codex-implementation-plan.md
- rahma-therapy-complete-planning-bundle/01-page-build-plans/03-main-services-page-codex-implementation-plan.md
- rahma-therapy-complete-planning-bundle/01-page-build-plans/04-focused-package-pages-codex-implementation-plan.md
- rahma-therapy-complete-planning-bundle/01-page-build-plans/05-reviews-page-codex-implementation-plan.md
- rahma-therapy-complete-planning-bundle/01-page-build-plans/06-faqs-aftercare-page-codex-implementation-plan.md
- rahma-therapy-complete-planning-bundle/01-page-build-plans/07-booking-popup-content-update-codex-implementation-plan.md

Tasks:
1. For each in-scope route, read its plan file before inspecting the implementation.
2. Extract expected section order, H1, CTAs, image paths, required interactions, disclaimers, package links, service IDs, and plan-specific constraints.
3. Compare against the implementation in page files, content files, and components.
4. Write a section-by-section matrix in 02-plan-compliance-matrix.md.
5. For every discrepancy, create a stable issue ID and add it to 09-master-issue-register.md.
6. Use issue prefixes:
   - PLAN-HOME
   - PLAN-SERVICES
   - PLAN-PACKAGE
   - PLAN-ABOUT
   - PLAN-REVIEWS
   - PLAN-FAQS
   - PLAN-BOOKING
7. Do not fix issues. Only document them.

Each matrix row must include:
- planned section
- implemented section/component
- present?
- correct order?
- content match?
- design match?
- CTA/link match?
- interaction match?
- code/component match?
- issue IDs

Gate before stopping:
- Every planned route has a completed matrix.
- Every discrepancy has an issue ID.
- Every issue ID appears in the master issue register.
- No runtime code changed.
```

