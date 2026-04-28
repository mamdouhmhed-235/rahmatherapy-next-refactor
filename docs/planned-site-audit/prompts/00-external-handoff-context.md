# Prompt 00: External Handoff Context

Use this prompt at the start of a new session if context has been lost.

```txt
You are auditing the planned Rahma Therapy website pages only.

Important: this is an audit-documentation task, not a remediation task. Do not fix runtime code. Do not redesign pages. Do not change copy/components/styles except for creating audit documentation files.

Core directive:
The planned Rahma Therapy pages follow their own premium wellness/recovery design system from the planning bundle. Do not judge them by the legacy website design. The old homepage and old legacy pages are out of scope.

In-scope planned routes:
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

Out-of-scope legacy routes:
- /
- /hijama
- /physiotherapy
- /sports-massage-barnet

Planning bundle:
C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahma-therapy-complete-planning-bundle

Audit planning docs:
rahmatherapy-next-refactor/docs/planned-site-audit/

You must create the actual audit output folder:
rahmatherapy-next-refactor/docs/audits/planned-site-quality-audit/

Required audit output files:
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

Critical rule:
Every page must be audited top to bottom against its own plan file. Check section order, content, design, CTAs, interactions, placeholders, code structure, accessibility, responsive behavior, and deployment behavior.

Booking rules:
- General booking: ?booking=1
- Package booking: ?booking=1&services=<service-id>
- Valid service IDs: supreme-combo, hijama-package, fire-package, massage-30, massage-60
- Forbidden: ?package=, /book-now, /services/mobile-massage-therapy

Compliance:
Do not add or normalize customer review text.
Do not add unsupported medical claims.
Required disclaimer must remain unchanged where required:
"Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care. If you have a medical condition, take medication, are pregnant, or are unsure whether treatment is suitable, please speak to a healthcare professional before booking."

Deployment:
Primary live site:
https://rahmatherapy-next-refactor.vercel.app/

Other known Vercel URLs:
https://rahmatherapy-next-ref-git-5fb7c0-mamdouh9001-gmailcoms-projects.vercel.app/
https://rahmatherapy-next-refactor-qgg5pr3n5.vercel.app/

End goal:
Create complete categorized audit findings and a separate phase-by-phase remediation implementation plan. Then commit and push the documentation only. Do not implement the remediation plan.
```
