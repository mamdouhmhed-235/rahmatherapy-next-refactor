# Phase 3 Prompt: Accessibility And Interaction Fixes

You are executing Phase 3 of the Rahma Therapy planned-site remediation plan.

Use relevant skills:

- accessibility auditing
- keyboard interaction design
- React component implementation
- browser testing

Read before editing:

- `docs/audits/planned-site-quality-audit/05-accessibility-audit.md`
- `docs/audits/planned-site-quality-audit/09-master-issue-register.md`
- Phase 3 in `docs/audits/planned-site-quality-audit/10-remediation-implementation-plan.md`
- Phase 3 gate in `docs/audits/planned-site-quality-audit/11-verification-and-deployment-checklist.md`

Goal:

Improve semantic structure, keyboard access, tab behavior, package finder announcements, and review card disclosure semantics.

Issue IDs:

- `A11Y-001`
- `A11Y-002`
- `A11Y-003`
- `A11Y-004`
- `A11Y-005`

Focus routes:

- all planned routes for skip link
- `/home-planned`
- `/home-planning`
- `/services`
- `/reviews`
- `/faqs-aftercare`

Likely files:

- `src/app/(public)/layout.tsx`
- `src/components/layout/SiteHeader.tsx`
- `src/components/planned-home/HomeTrustStrip.tsx`
- `src/components/services/ServicesTrustStrip.tsx`
- `src/components/faqs-aftercare/QuickAnswersStrip.tsx`
- `src/components/faqs-aftercare/AftercareTabs.tsx`
- `src/components/faqs-aftercare/FaqCategoryAccordions.tsx`
- `src/components/services/PackageFinder.tsx`
- `src/components/reviews/ReviewCard.tsx`
- existing UI tabs primitive if available

Constraints:

- Keep visible content and planned section order unchanged.
- Prefer existing UI primitives and local patterns.
- Do not degrade reduced-motion support.
- Preserve review text exactly.
- Do not redesign the page visuals beyond what accessibility requires.

Implementation checklist:

1. Add a skip link before the repeated header in the public layout.
2. Adjust card heading levels in affected trust/quick-answer sections.
3. Rebuild aftercare and FAQ category tablists with the planned tabs primitive, or implement roving tabindex and Arrow/Home/End handling.
4. Add a polite live region or status announcement for PackageFinder recommendation changes.
5. Remove `tabIndex={0}` from review articles or convert them into a fully accessible disclosure pattern.
6. Re-run keyboard navigation checks across representative pages.

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

- First Tab focuses skip link.
- Heading outline is logical.
- Arrow keys operate aftercare and FAQ category tabs, or an accessible tabs primitive handles them.
- Package finder result updates are announced.
- Review card focus stops have clear role/name/state.

Deployment gate:

- Commit message: `fix planned page accessibility interactions`
- Push to `master`.
- Wait for Vercel.
- Check `/home-planned/`, `/services/`, `/reviews/`, `/faqs-aftercare/`.

Final response:

- Files changed
- Issues fixed
- Validation results
- Keyboard checks
- Local route checks
- Vercel checks
- Commit hash
- Push result
- Whether Phase 4 is safe to start

Do not start Phase 4.

