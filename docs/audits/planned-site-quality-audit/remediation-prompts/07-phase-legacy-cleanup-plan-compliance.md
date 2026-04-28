# Phase 7 Prompt: Legacy Cleanup And Strict Plan-Compliance Re-Audit

You are executing Phase 7 of the Rahma Therapy planned-site remediation plan.

Use relevant skills:

- codebase cleanup
- route auditing
- plan compliance auditing
- release engineering

Read before editing:

- `docs/audits/planned-site-quality-audit/remediation-prompts/00-start-here.md`
- `docs/audits/planned-site-quality-audit/01-route-and-codebase-inventory.md`
- `docs/audits/planned-site-quality-audit/02-plan-compliance-matrix.md`
- `docs/audits/planned-site-quality-audit/07-links-ctas-booking-audit.md`
- `docs/audits/planned-site-quality-audit/09-master-issue-register.md`
- Phase 7 in `docs/audits/planned-site-quality-audit/10-remediation-implementation-plan.md`
- Phase 7 gate in `docs/audits/planned-site-quality-audit/11-verification-and-deployment-checklist.md`

The non-negotiable overrides in `00-start-here.md` apply to this phase.

Also read the planning bundle files before deciding whether the planned implementation has drifted:

- `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahma-therapy-complete-planning-bundle\rahma-home-page-codex-implementation-plan.md`
- `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahma-therapy-complete-planning-bundle\rahma-about-page-codex-implementation-plan.md`
- `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahma-therapy-complete-planning-bundle\rahma-services-page-codex-implementation-plan.md`
- `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahma-therapy-complete-planning-bundle\rahma-focused-package-pages-codex-implementation-plan.md`
- `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahma-therapy-complete-planning-bundle\rahma-faqs-aftercare-page-codex-implementation-plan.md`
- `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahma-therapy-complete-planning-bundle\rahma-reviews-page-codex-implementation-plan.md`
- `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahma-therapy-complete-planning-bundle\rahma-booking-popup-content-update-codex-implementation-plan.md`

Goal:

Remove confirmed legacy homepage/dead route code and verify each remaining planned page is built from top to bottom according to its respective plan file.

Issue IDs:

- `LEGACY-001`

Hard stop before deletion:

- Inspect the current route map first.
- Identify the current canonical planned homepage route.
- Identify which routes/components/content are confirmed legacy or dead.
- Do not delete any route until you know it is not required by planned pages, redirects, booking behavior, or SEO.

Routes to inspect:

- current canonical planned homepage route
- `/home`
- `/home-planned`
- `/home-planning`
- `/services`
- all focused package routes
- `/about`
- `/reviews`
- `/faqs-aftercare`
- old routes such as `/hijama`, `/physiotherapy`, `/sports-massage-barnet`, or any other legacy route found in `src/app`

Likely files:

- `src/app/**`
- `src/content/site/navigation.ts`
- `src/content/site/footer.ts`
- old legacy page content files under `src/content/pages/**`
- old legacy component folders under `src/components/**`
- redirects or middleware only if already used by this project

Constraints:

- Remove only confirmed legacy/dead code.
- Do not remove booking popup, shared shell, planned pages, package pages, therapist-gender wording, prices, or safety/suitability content.
- Do not add `/book-now`, `?package=`, or `/services/mobile-massage-therapy`.
- Preserve useful redirects only if they prevent broken user/SEO paths and do not expose legacy page content.
- Do not invent imagery or alter approved copy while cleaning dead code.

Implementation checklist:

1. Run a route/file inventory for `src/app`, planned page components, and legacy page components/content.
2. Identify the current canonical planned homepage route.
3. Identify confirmed legacy/dead routes and owning files.
4. Decide whether each old route should be deleted or redirected. Prefer removal unless a redirect is clearly useful.
5. Update header/footer navigation so only planned production pages are shown.
6. Remove confirmed dead content/components/imports created only for legacy pages.
7. Static scan for old route names/imports, `/book-now`, `?package=`, `/services/mobile-massage-therapy`, and forbidden medical-copy phrases.
8. Re-read each planning bundle file and compare the implemented planned page top to bottom against its plan:
   - section order
   - copy
   - CTAs
   - service IDs and routes
   - image handling
   - interactions
   - design treatment
   - code ownership
9. Fix in-scope discrepancies created by legacy cleanup or clearly documented in the active audit plan. If a discrepancy is large or ambiguous, report it instead of improvising.

Validation:

- `pnpm lint`
- `pnpm exec tsc --noEmit --incremental false`
- `pnpm build`
- `pnpm test` if present

Local smoke checks:

- canonical planned homepage route
- `/services/`
- all focused package routes
- `/about/`
- `/reviews/`
- `/faqs-aftercare/`
- removed or redirected legacy routes

Deployment gate:

- Commit message: `remove legacy routes and verify planned page compliance`
- Push to `master`.
- Wait for Vercel.
- Check the canonical planned homepage route, `/services/`, `/about/`, `/reviews/`, `/faqs-aftercare/`, and removed/redirected legacy route behavior.

Final response:

- Current canonical planned homepage route
- Legacy routes removed or redirected
- Dead files removed
- Planned page compliance findings and fixes
- Validation results
- Local route checks
- Vercel checks
- Commit hash
- Push result
- Whether Phase 8 is safe to start

Do not start Phase 8.
