# Comprehensive Planned-Site Audit Execution Plan

## Operating Mode

This plan is for a future model to execute a full audit and write audit documentation. The model must not fix runtime issues during this task. It should produce documentation that gives a later implementation model everything needed to fix issues safely.

Use a phased approach. Each phase builds on the previous one and has a gate. Do not start the next phase until the gate is complete.

## Recommended Skills And Tooling

Use only the skills/tools relevant to the current phase.

Suggested skill categories:

- Codebase audit: senior frontend engineering, code review, Next.js App Router, TypeScript, Tailwind CSS
- Visual audit: frontend design, UX design, responsive design, brand systems
- Accessibility audit: WCAG 2.1 AA, semantic HTML, keyboard navigation, ARIA
- Content audit: content QA, compliance-sensitive wellness copy, review preservation
- Release audit: build validation, Vercel deployment checks, smoke testing

Suggested tools:

- `rg` and `rg --files` for repo scans
- `pnpm lint`
- `pnpm exec tsc --noEmit --incremental false`
- `pnpm build`
- Local dev server for browser inspection
- Browser tooling for route checks and interaction checks where available
- Shell HTTP checks where browser tooling is unavailable

## Phase 0: Scope Lock And Setup

### Goal

Confirm the audit scope, create the audit output folder, and document the non-remediation constraint.

### Steps

1. Read `docs/planned-site-audit/00-master-brief.md`.
2. Confirm the repo root and planning bundle path.
3. Create `docs/audits/planned-site-quality-audit/`.
4. Create the required audit files listed in the master brief.
5. Write the audit scope into `00-audit-brief.md`.
6. Explicitly state that legacy routes are out of visual/content scope.
7. Explicitly state that this task must not implement fixes.

### Gate

Proceed only when:

- Output folder exists.
- Required audit files exist.
- Scope is documented.
- No runtime files have been changed.

## Phase 1: Codebase And Route Inventory

### Goal

Map the planned-site implementation and identify the exact files/components/content sources involved.

### Steps

1. Inspect route files under `src/app/(public)`.
2. Identify all in-scope page files.
3. Identify dynamic route behavior for package pages.
4. Identify shared layout files used by planned pages.
5. Identify planned-page content files.
6. Identify planned-page component folders.
7. Identify shared UI primitives and image placeholder wrappers.
8. Identify booking popup files relevant to planned-page CTAs.
9. Identify nav/footer content files.
10. Write findings into `01-route-and-codebase-inventory.md`.

### Must Capture

- Route path
- Page file
- Content file
- Component folder
- Client components
- Shared components
- Relevant plan file
- Known dependencies
- Image wrapper behavior
- Any unexpected coupling with legacy pages

### Gate

Proceed only when every in-scope route has a mapped page file, content source, component source, and plan source.

## Phase 2: Top-To-Bottom Plan Compliance Audit

### Goal

Check every planned page against its plan file from top to bottom.

### Steps

1. Read each plan file fully before auditing its page.
2. Extract expected section order.
3. Extract required H1, section headings, CTA labels, CTA URLs, image paths, interactions, disclaimers, and special behavior.
4. Compare implemented route/page/component/content files to the plan.
5. Inspect the rendered page where useful.
6. Record each section in `02-plan-compliance-matrix.md`.
7. Copy every discrepancy into `09-master-issue-register.md`.

### Page Matrices Required

- `/home-planned`
- `/home-planning`
- `/services`
- all five focused package routes
- `/about`
- `/reviews`
- `/faqs-aftercare`
- booking popup content/wiring as used by planned pages

### Gate

Proceed only when every planned page has:

- Expected section order listed
- Actual section order checked
- Content match status
- Design match status
- CTA/link match status
- Interaction match status
- Code/component match status
- Issues copied into the master register

## Phase 3: Visual UI And UX Audit

### Goal

Identify anything that makes the planned pages look less professional, less premium, less trustworthy, visually inconsistent, cluttered, generic, or hard to use.

### Steps

1. Inspect each planned page at desktop and mobile widths.
2. Check visual hierarchy, section rhythm, spacing, card treatment, typography, contrast, imagery, CTA visibility, and final CTA strength.
3. Check whether planned pages share the intended premium wellness/recovery design system.
4. Compare services package cards against planned homepage package cards.
5. Check whether focused package pages feel like sales pages rather than generic templates.
6. Check whether review wall abundance is controlled rather than chaotic.
7. Check whether FAQs/aftercare tabs are obvious and easy to use.
8. Check whether the About timeline feels interactive and usable.
9. Create a design consistency matrix comparing hero treatment, card radius, spacing rhythm, typography scale, image overlay contrast, CTA styling, dark green sections, final CTA treatment, and placeholder quality across all planned pages.
10. Record visual/UX findings in `03-visual-ui-ux-audit.md`.
11. Copy every issue into the master issue register.

### Gate

Proceed only when each page has a visual and UX assessment with clear issue IDs and severity ratings.

## Phase 4: Responsive And Mobile Audit

### Goal

Verify that planned pages work cleanly on mobile, tablet, and desktop without horizontal overflow, broken text, cramped CTAs, or awkward stacking.

### Viewports

Minimum:

- 390px mobile
- 768px tablet
- 1024px small desktop
- 1440px desktop

### Steps

1. Check each page at each viewport.
2. Check header/nav behavior.
3. Check section spacing and stacking.
4. Check long headings and CTAs.
5. Check image overlays and placeholder dimensions.
6. Check carousels, tabs, filters, comparison tables, review cards, and package cards.
7. Check for horizontal overflow.
8. Record findings in `04-responsive-mobile-audit.md`.
9. Copy every issue into the master issue register.

### Gate

Proceed only when each in-scope route has been checked at the required viewport set or a documented fallback explains why a viewport could not be checked.

## Phase 5: Accessibility And Interaction Audit

### Goal

Check semantic structure, keyboard access, focus states, reduced motion, accessible names, and interaction behavior.

### Steps

1. Verify one H1 per page.
2. Verify semantic landmarks and section heading hierarchy.
3. Test keyboard access for:
   - header and mobile nav
   - booking popup
   - accordions
   - aftercare tabs
   - FAQ category filters
   - package finder
   - review filters/search/load more/cards
   - About timeline
   - CTAs and related package links
4. Check visible focus states.
5. Check no important content is hover-only.
6. Check reduced-motion behavior for carousel/timeline/Motion components.
7. Check placeholder accessible names.
8. Check overlay contrast.
9. Record findings in `05-accessibility-audit.md`.
10. Copy every issue into the master issue register.

### Gate

Proceed only when every interactive planned-page component has been checked for keyboard access and visible state behavior.

## Phase 6: Content, Copy, CTA, And Compliance Audit

### Goal

Confirm planned-page copy matches plan files, CTAs are correct, reviews are preserved, and safety language remains compliant.

### Steps

1. Compare visible page copy against each plan file.
2. Check H1s, subtitles, cards, FAQ text, CTA labels, disclaimers, package names, package prices, and service IDs.
3. Check review text against supplied support files and confirm it has not been rewritten.
4. Scan for banned phrases.
5. Scan for old booking links and old massage routes.
6. Check that booking CTAs use only valid query formats.
7. Check that WhatsApp links use the approved URL.
8. Check that "booking request" language is used where relevant.
9. Record findings in:
   - `06-content-copy-compliance-audit.md`
   - `07-links-ctas-booking-audit.md`
10. Copy every issue into the master issue register.

### Gate

Proceed only when all in-scope routes and shared planned-page CTA sources have been scanned and documented.

## Phase 7: Performance, SEO, And Deployment Audit

### Goal

Check that planned pages are production-ready without excessive client code, broken metadata, broken image handling, or live deployment mismatch.

### Steps

1. Inspect metadata for planned pages.
2. Confirm no self-serving Review/AggregateRating schema was added for reviews.
3. Confirm images use `next/image` or placeholder components.
4. Check for large direct image imports.
5. Check client components are limited to real interactivity.
6. Run validation commands:
   - `pnpm lint`
   - `pnpm exec tsc --noEmit --incremental false`
   - `pnpm build`
   - existing test script if present
7. Start a local server if needed.
8. Smoke check every in-scope route locally.
9. Check every in-scope route on the primary live Vercel deployment where feasible.
10. Check alternate Vercel URLs if the primary deployment appears stale or unavailable.
11. Record findings in `08-performance-seo-deployment-audit.md`.

### Gate

Proceed only when validation command results and route smoke-check results are documented exactly.

## Phase 8: Master Issue Register Consolidation

### Goal

Produce a single complete issue register that can drive future remediation.

### Steps

1. De-duplicate issues found across audit files.
2. Assign stable issue IDs.
3. Categorize each issue.
4. Assign severity.
5. Record route, viewport, file/component, plan source, expected result, recommended fix, and verification method.
6. Mark whether the issue is a blocker before remediation starts.
7. Write the final register in `09-master-issue-register.md`.

### Gate

Proceed only when every issue referenced in category-specific files appears in the master issue register.

## Phase 9: Remediation Implementation Plan Authoring

### Goal

Write a separate implementation plan that fixes all issues later, phase by phase, without performing fixes now.

### Steps

1. Group issues by safest implementation order.
2. Define each remediation phase with:
   - goal
   - issue IDs addressed
   - files/components likely touched
   - exact constraints
   - implementation steps
   - verification commands
   - route checks
   - deployment check
   - commit message
   - rollback note
3. Ensure each phase builds on the previous phase.
4. Ensure each phase has a gate before proceeding.
5. Write the plan in `10-remediation-implementation-plan.md`.
6. Write final checks in `11-verification-and-deployment-checklist.md`.

### Gate

Proceed only when every issue in the master register is either assigned to a remediation phase or explicitly marked as deferred with rationale.

## Phase 10: Documentation Review, Commit, And Push

### Goal

Validate that the audit docs are complete, then commit and push them.

### Steps

1. Review all audit files for missing sections.
2. Confirm no runtime files were changed.
3. Confirm no screenshots were added.
4. Run a lightweight documentation sanity check:
   - file list
   - git diff
   - markdown readability
5. Commit docs only.
6. Push to the default branch.

### Gate

Task is complete only when audit docs and remediation plan are committed and pushed.
