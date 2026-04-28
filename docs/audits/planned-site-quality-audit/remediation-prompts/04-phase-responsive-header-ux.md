# Phase 4 Prompt: Responsive Layout And Shared Header UX

You are executing Phase 4 of the Rahma Therapy planned-site remediation plan.

Use relevant skills:

- responsive frontend design
- UX review
- browser viewport testing
- release engineering

Read before editing:

- `docs/audits/planned-site-quality-audit/remediation-prompts/00-start-here.md`
- `docs/audits/planned-site-quality-audit/03-visual-ui-ux-audit.md`
- `docs/audits/planned-site-quality-audit/04-responsive-mobile-audit.md`
- `docs/audits/planned-site-quality-audit/09-master-issue-register.md`
- Phase 4 in `docs/audits/planned-site-quality-audit/10-remediation-implementation-plan.md`
- Phase 4 gate in `docs/audits/planned-site-quality-audit/11-verification-and-deployment-checklist.md`

The non-negotiable overrides in `00-start-here.md` apply to this phase.

Goal:

Resolve tablet hero height, mobile tab discoverability, package hero first-viewport hierarchy, and shared header breakpoint clarity.

Issue IDs:

- `UX-001`
- `UX-002`
- `RESP-001`
- `RESP-002`

Focus routes:

- all planned routes for shared header behavior
- `/services`
- all focused package routes
- `/faqs-aftercare`

Likely files:

- `src/components/layout/SiteHeader.tsx`
- `src/components/layout/SiteFooter.tsx`
- `src/content/site/navigation.ts`
- `src/content/site/footer.ts`
- `src/components/services/ServicesHero.tsx`
- `src/components/package-pages/PackageHero.tsx`
- `src/components/faqs-aftercare/FaqsAftercareHero.tsx`
- `src/components/faqs-aftercare/AftercareTabs.tsx`
- `src/components/faqs-aftercare/FaqCategoryAccordions.tsx`

Constraints:

- Keep planned pages within their planning-bundle design system.
- Do not redesign legacy routes in this phase; legacy route cleanup is handled in Phase 7.
- Do not remove planned navigation items in this phase unless required for the responsive header fix.
- Do not remove required CTAs or treatment suitability copy.
- Do not add forbidden booking URLs.

Implementation checklist:

1. Define a header breakpoint strategy that avoids full nav plus hamburger at the same viewport.
2. Avoid broad navigation cleanup in this phase; leave legacy retirement to Phase 7 unless a header breakpoint fix requires a small preparatory change.
3. Adjust tablet hero media sizing/min-height for services, package, and FAQs/aftercare hero components.
4. Tighten package hero mobile layout without removing required copy.
5. Add mobile tab overflow affordance or switch FAQ/aftercare tabs to a stacked/segmented mobile layout.
6. Check text wrapping and CTA wrapping at 390px, 768px, 1024px, and 1440px.

Validation:

- `pnpm lint`
- `pnpm exec tsc --noEmit --incremental false`
- `pnpm build`
- `pnpm test` if present

Local smoke checks:

- `/home-planned/`
- `/services/`
- `/services/supreme-combo-package/`
- `/services/hijama-package/`
- `/services/fire-cupping-package/`
- `/services/massage-therapy-30-mins/`
- `/services/massage-therapy-1-hour/`
- `/faqs-aftercare/`

Check at 390px, 768px, 1024px, and 1440px.

Deployment gate:

- Commit message: `improve planned responsive layout and header`
- Push to `master`.
- Wait for Vercel.
- Check `/home-planned/`, `/services/`, `/services/supreme-combo-package/`, `/faqs-aftercare/`.

Final response:

- Files changed
- Issues fixed
- Validation results
- Viewport checks
- Local route checks
- Vercel checks
- Commit hash
- Push result
- Whether Phase 5 is safe to start

Do not start Phase 5.
