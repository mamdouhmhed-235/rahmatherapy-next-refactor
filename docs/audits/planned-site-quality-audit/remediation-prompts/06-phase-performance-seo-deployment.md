# Phase 6 Prompt: Performance, SEO, And Deployment Hardening

You are executing Phase 6 of the Rahma Therapy planned-site remediation plan.

Use relevant skills:

- performance auditing
- frontend optimization
- SEO/schema review
- release engineering

Read before editing:

- `docs/audits/planned-site-quality-audit/remediation-prompts/00-start-here.md`
- `docs/audits/planned-site-quality-audit/08-performance-seo-deployment-audit.md`
- `docs/audits/planned-site-quality-audit/09-master-issue-register.md`
- Phase 6 in `docs/audits/planned-site-quality-audit/10-remediation-implementation-plan.md`
- Phase 6 gate in `docs/audits/planned-site-quality-audit/11-verification-and-deployment-checklist.md`

The non-negotiable overrides in `00-start-here.md` apply to this phase.

Goal:

Reduce review wall animation cost, resolve standalone TypeScript command ambiguity if still present, and confirm no SEO/deployment regressions after prior fixes.

Issue IDs:

- `PERF-001`
- `TOOLING-001`

Focus routes:

- `/reviews`
- `/home-planned`
- `/services`
- `/faqs-aftercare`
- all planned routes for metadata/schema spot checks

Likely files:

- `src/components/reviews/ReviewCard.tsx`
- `src/components/reviews/ReviewWall.tsx`
- `src/components/reviews/ReviewsExplorer.tsx`
- `package.json` only if the user approves adding an explicit `typecheck` script
- metadata files only if a regression is found during verification

Constraints:

- Preserve review wall usability, filters, search, and load-more behavior.
- Preserve reduced-motion support.
- Do not add Review or AggregateRating schema.
- Do not rewrite review text.
- Do not reduce the initial Reviews wall below 24 visible reviews unless measured performance proves it necessary.
- Optimize animation cost first.
- Do not change package scripts unless the TypeScript command still fails and the user approves a `package.json` validation-script fix.

Implementation checklist:

1. Reduce animation cost first by removing expensive per-card layout animation or limiting motion to small state changes.
2. Keep reduced-motion behavior intact.
3. Keep the initial 24-review count unless profiling proves it should be reduced.
4. Re-check search/filter/load-more behavior.
5. Re-run static schema scan for `Review` and `AggregateRating`.
6. Re-run `pnpm exec tsc --noEmit --incremental false`.
7. If it still fails with command resolution, identify and document the project-approved equivalent command. Add a `typecheck` script only if the user approves that `package.json` change.
8. Verify route metadata titles/descriptions still render.

Validation:

- `pnpm lint`
- `pnpm exec tsc --noEmit --incremental false`
- `pnpm build`
- `pnpm test` if present

Local smoke checks:

- `/reviews/`
- `/home-planned/`
- `/services/`
- `/faqs-aftercare/`

Check:

- Review filters/search/load more still work.
- Reduced motion does not animate card layout.
- No Review/AggregateRating schema added.
- `TOOLING-001` outcome is recorded: command passes, approved equivalent documented, or package script added with approval.

Deployment gate:

- Commit message: `optimize planned reviews wall performance`
- Push to `master`.
- Wait for Vercel.
- Check `/reviews/`, `/home-planned/`, `/services/`, `/faqs-aftercare/`.

Final response:

- Files changed
- Issues fixed
- Performance/animation changes
- Validation results
- Schema scan results
- Local route checks
- Vercel checks
- Commit hash
- Push result
- Whether Phase 7 is safe to start

Do not start Phase 7.
