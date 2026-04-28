# Planned Rahma Therapy Site Audit Brief

## Purpose

Create a comprehensive audit system for the planned Rahma Therapy website pages only. The audit must find, list, categorize, and prioritize every discrepancy between the implemented planned pages and their approved plan files. It must also produce a separate remediation implementation plan, but it must not implement fixes.

This is a documentation and analysis workflow. The expected end state is a complete audit pack and a complete phase-by-phase remediation plan that a later implementation model can follow.

## Non-Negotiable Scope

### In Scope

- `/home-planned`
- `/home-planning`
- `/services`
- `/services/supreme-combo-package`
- `/services/hijama-package`
- `/services/fire-cupping-package`
- `/services/massage-therapy-30-mins`
- `/services/massage-therapy-1-hour`
- `/about`
- `/reviews`
- `/faqs-aftercare`
- Booking popup behavior when opened from planned pages through `?booking=1`
- Shared header and footer only where they affect planned-page navigation and booking access
- Shared design utilities only where they affect planned pages

### Out of Scope

- `/`
- `/hijama`
- `/physiotherapy`
- `/sports-massage-barnet`
- Legacy homepage visual quality
- Legacy page copy, layout, and section structure
- Any remediation implementation
- Any screenshots committed to the repository

The old homepage and old pages must be ignored for this audit unless shared code changes or shared navigation create a risk for the planned pages.

## Source of Truth

Use the planning bundle at:

```txt
C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahma-therapy-complete-planning-bundle
```

Primary plan files:

- `01-page-build-plans/01-home-page-codex-implementation-plan.md`
- `01-page-build-plans/02-about-page-codex-implementation-plan.md`
- `01-page-build-plans/03-main-services-page-codex-implementation-plan.md`
- `01-page-build-plans/04-focused-package-pages-codex-implementation-plan.md`
- `01-page-build-plans/05-reviews-page-codex-implementation-plan.md`
- `01-page-build-plans/06-faqs-aftercare-page-codex-implementation-plan.md`
- `01-page-build-plans/07-booking-popup-content-update-codex-implementation-plan.md`

Support files:

- `02-reviews-support-files/rahma-reviews-content.ts`
- `02-reviews-support-files/rahma-reviews-normalized.json`
- `02-reviews-support-files/rahma-reviews-category-support.md`

Archive/original files may be used only to resolve ambiguity.

## Audit Outputs To Create

The audit execution model should create this folder:

```txt
docs/audits/planned-site-quality-audit/
```

Required files:

```txt
00-audit-brief.md
01-route-and-codebase-inventory.md
02-plan-compliance-matrix.md
03-visual-ui-ux-audit.md
04-responsive-mobile-audit.md
05-accessibility-audit.md
06-content-copy-compliance-audit.md
07-links-ctas-booking-audit.md
08-performance-seo-deployment-audit.md
09-master-issue-register.md
10-remediation-implementation-plan.md
11-verification-and-deployment-checklist.md
```

Do not commit screenshots unless the user later asks for them. If visual evidence is needed, describe it with route, viewport, component, observed issue, and expected result.

Each audit file should include a short checklist, expected outcome, and clear completion status. If no issue is found in a category, write a clear "no issues found" note instead of leaving the section blank.

## Audit Standard

Each planned page must be checked top to bottom against its own plan file. This means section order, design direction, content, copy, CTAs, images/placeholders, interactions, component boundaries, code structure, responsiveness, and accessibility must all be checked.

The audit should answer:

- Is every planned section present?
- Is every section in the correct order?
- Does every section match the plan content?
- Does every section match the plan design intent?
- Are all CTAs and internal links correct?
- Are all interactions implemented and keyboard accessible?
- Are all placeholders clear and accessible?
- Are there design, content, UX, accessibility, code, or deployment drifts?
- Does the page feel professional, premium, trustworthy, and visually consistent with the planned design system?

The visual audit should also include a design consistency matrix comparing hero treatment, card radius, spacing rhythm, typography scale, image overlay contrast, CTA styling, dark green sections, final CTA treatment, and placeholder quality across the planned pages.

## Hard Constraints

- Do not implement fixes during the audit.
- Do not rewrite page plans.
- Do not change site code except audit documentation files.
- Do not change booking popup design.
- Do not audit legacy pages except for shared-shell risk.
- Do not use old booking links.
- Do not add or normalize customer review text.
- Do not add unsupported medical claims.
- Do not commit screenshots.
- Commit and push the audit documentation only after the audit pack and remediation plan are complete.

## Booking Rules To Verify

General booking:

```txt
?booking=1
```

Package-specific booking:

```txt
?booking=1&services=<service-id>
```

Valid service IDs:

- `supreme-combo`
- `hijama-package`
- `fire-package`
- `massage-30`
- `massage-60`

Forbidden links:

- `?package=`
- `/book-now`
- `/services/mobile-massage-therapy`

## Safety And Compliance Rules

The required safety disclaimer must remain unchanged where required:

> Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care. If you have a medical condition, take medication, are pregnant, or are unsure whether treatment is suitable, please speak to a healthcare professional before booking.

Visible planned-page copy must not contain unsupported business claims such as:

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

Customer reviews must not be rewritten. If a customer review contains risky wording, record it carefully as review text and do not convert it into business copy, headings, summaries, or claims.

## Deployment Context

Primary live deployment:

```txt
https://rahmatherapy-next-refactor.vercel.app/
```

Planned homepage:

```txt
https://rahmatherapy-next-refactor.vercel.app/home-planned/
```

Other known Vercel URLs:

```txt
https://rahmatherapy-next-ref-git-5fb7c0-mamdouh9001-gmailcoms-projects.vercel.app/
https://rahmatherapy-next-refactor-qgg5pr3n5.vercel.app/
```

The audit should check local build behavior and deployed behavior. If a live deployment is stale, note it rather than assuming local results are live.

## Success Criteria

The audit task is complete only when:

- All in-scope planned routes have been inventoried.
- All relevant plan files have been reviewed.
- Each page has a top-to-bottom plan compliance matrix.
- Visual, responsive, accessibility, content, CTA, performance, SEO, and deployment checks are documented.
- Every finding is categorized in the master issue register.
- A separate phase-by-phase remediation implementation plan exists.
- The remediation plan includes verification gates and deployment checks.
- No runtime code fixes have been made.
- Audit documentation has been committed and pushed to `main` or the current default branch.
