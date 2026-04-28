# Phase 5 Prompt: Asset Replacement And Visual Polish

You are executing Phase 5 of the Rahma Therapy planned-site remediation plan.

Use relevant skills:

- visual QA
- frontend asset integration
- accessibility image review
- responsive design testing

Read before editing:

- `docs/audits/planned-site-quality-audit/03-visual-ui-ux-audit.md`
- `docs/audits/planned-site-quality-audit/04-responsive-mobile-audit.md`
- `docs/audits/planned-site-quality-audit/09-master-issue-register.md`
- Phase 5 in `docs/audits/planned-site-quality-audit/10-remediation-implementation-plan.md`
- Phase 5 gate in `docs/audits/planned-site-quality-audit/11-verification-and-deployment-checklist.md`

Goal:

Replace prominent placeholders and complete planned premium proof/media treatment using approved assets only.

Issue IDs:

- `VISUAL-001`
- `VISUAL-002`

Focus routes:

- `/home-planned`
- `/services`
- all focused package routes
- `/about`
- `/reviews`
- `/faqs-aftercare`

Likely files:

- `public/images/**`
- `src/components/planned-home/*`
- `src/components/services/*`
- `src/components/package-pages/*`
- `src/components/about/*`
- `src/components/reviews/*`
- `src/components/faqs-aftercare/*`
- route-owned image wrappers

Hard stop before implementation:

- Confirm approved assets actually exist or were provided by the developer.
- If approved assets are not available, do not invent replacements and do not use random stock/generated imagery.
- If assets are unavailable, document affected sections as asset-blocked and skip replacement.

Constraints:

- Approved assets only.
- Do not use generic stock-like images that do not match the planning bundle.
- Do not rewrite customer review text while improving reviews proof.
- Preserve alt text/accessibility labels.
- If assets are unavailable, defer the affected route/section with a clear asset-blocked note.
- Keep the approved home hero `.avif` unless a matching approved WebP is supplied.

Implementation checklist:

1. Confirm developer-provided asset list and filenames against the planning bundle.
2. Place approved assets in expected `public/images/**` paths.
3. Wire route-owned image wrappers to render assets.
4. Update reviews proof visuals using approved assets and exact review data.
5. Preserve responsive image sizing and overlay readability.
6. Document unavailable assets as deferred rather than fabricating replacements.

Validation:

- `pnpm lint`
- `pnpm exec tsc --noEmit --incremental false`
- `pnpm build`
- `pnpm test` if present

Local smoke checks:

- `/home-planned/`
- `/services/`
- all focused package routes
- `/about/`
- `/reviews/`
- `/faqs-aftercare/`

Check at 390px, 768px, 1024px, and 1440px:

- Images render.
- Overlay contrast is readable.
- No new layout shift or overflow.
- Placeholder labels are absent from final visible production sections unless explicitly deferred.

Deployment gate:

- Commit message: `add planned media assets and visual proof polish`
- Push to `master`.
- Wait for Vercel.
- Check all affected planned routes.

Final response:

- Files changed
- Assets added or deferred
- Issues fixed
- Validation results
- Viewport checks
- Local route checks
- Vercel checks
- Commit hash
- Push result
- Whether Phase 6 is safe to start

Do not start Phase 6.

