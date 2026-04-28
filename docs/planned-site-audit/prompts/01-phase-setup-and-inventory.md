# Prompt 01: Setup, Scope Lock, And Codebase Inventory

```txt
You are executing Phase 0 and Phase 1 of the planned Rahma Therapy site audit.

Use relevant skills:
- senior frontend engineering
- Next.js App Router codebase inspection
- TypeScript/Tailwind code review
- documentation architecture

Goal:
Create the audit output folder, lock the audit scope, and inventory the planned-site route/component/content architecture.

This is documentation-only. Do not fix runtime code.

Read first:
- docs/planned-site-audit/00-master-brief.md
- docs/planned-site-audit/01-comprehensive-audit-execution-plan.md
- docs/planned-site-audit/02-audit-file-templates.md

Planning bundle:
C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahma-therapy-complete-planning-bundle

In-scope routes:
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

Out-of-scope routes:
- /
- /hijama
- /physiotherapy
- /sports-massage-barnet

Tasks:
1. Create docs/audits/planned-site-quality-audit/.
2. Create these files if missing:
   - 00-audit-brief.md
   - 01-route-and-codebase-inventory.md
   - 02-plan-compliance-matrix.md
   - 03-visual-ui-ux-audit.md
   - 04-responsive-mobile-audit.md
   - 05-accessibility-audit.md
   - 06-content-copy-compliance-audit.md
   - 07-links-ctas-booking-audit.md
   - 08-performance-seo-deployment-audit.md
   - 09-master-issue-register.md
   - 10-remediation-implementation-plan.md
   - 11-verification-and-deployment-checklist.md
3. Write the audit scope and constraints into 00-audit-brief.md.
4. Inspect the codebase and document:
   - route file for each planned route
   - content file for each planned page
   - component folders used by each route
   - client components used by each route
   - shared components used by planned pages
   - image placeholder wrappers
   - booking popup files relevant to planned pages
   - navigation and footer files relevant to planned pages
   - any coupling with legacy pages
5. Write the inventory into 01-route-and-codebase-inventory.md.
6. Do not make findings yet unless they are structural blockers. This phase is mostly inventory.

Gate before stopping:
- All required audit files exist.
- Every in-scope route has a mapped page file, content source, component source, and plan source.
- No runtime code changed.
- Summarize exactly what was created and what remains for the next prompt.
```

