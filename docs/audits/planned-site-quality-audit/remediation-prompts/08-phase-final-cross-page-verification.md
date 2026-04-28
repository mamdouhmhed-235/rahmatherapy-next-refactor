# Phase 8 Prompt: Final Cross-Page Verification

You are executing Phase 8 of the Rahma Therapy planned-site remediation plan.

Use relevant skills:

- QA verification
- accessibility smoke testing
- responsive frontend review
- release engineering

Read before starting:

- `docs/audits/planned-site-quality-audit/remediation-prompts/00-start-here.md`
- `docs/audits/planned-site-quality-audit/00-audit-brief.md`
- `docs/audits/planned-site-quality-audit/09-master-issue-register.md`
- Phase 8 in `docs/audits/planned-site-quality-audit/10-remediation-implementation-plan.md`
- Phase 8 gate and final acceptance checklist in `docs/audits/planned-site-quality-audit/11-verification-and-deployment-checklist.md`

The non-negotiable overrides in `00-start-here.md` apply to this phase.

Goal:

Confirm every planned route passes the audit acceptance gates after all remediation phases and after legacy cleanup.

Issue IDs:

- No new issue IDs. Verify all remediated issues.

Routes:

- canonical planned homepage route
- `/services`
- `/services/supreme-combo-package`
- `/services/hijama-package`
- `/services/fire-cupping-package`
- `/services/massage-therapy-30-mins`
- `/services/massage-therapy-1-hour`
- `/about`
- `/reviews`
- `/faqs-aftercare`

Also verify removed/redirected legacy routes do not render old page content.

Constraints:

- Do not introduce runtime changes during final verification unless a failed gate requires a new targeted remediation phase.
- Record exact command and route results.
- Keep homepage short disclaimer and full disclaimers in their approved locations.
- Do not bring back legacy pages or dual-home comparison navigation.

Verification checklist:

1. Re-run full validation commands.
2. Smoke-check every planned route locally with trailing slash.
3. Check booking popup on representative general and package query URLs.
4. Check keyboard flows: skip link, tabs, package finder, review cards, booking modal.
5. Check responsive behavior at 390px, 768px, 1024px, and 1440px.
6. Check removed/redirected legacy route behavior.
7. Check live Vercel routes after final push.
8. Confirm no unresolved non-deferred canonical issue remains.

Validation:

- `pnpm lint`
- `pnpm exec tsc --noEmit --incremental false`
- `pnpm build`
- `pnpm test` if present

Final acceptance checks:

- Booking popup opens from `?booking=1`, `?booking=1&services=<valid-id>`, and visible booking triggers.
- No `?package=`, `/book-now`, or `/services/mobile-massage-therapy` in scoped planned source.
- Only valid service IDs are used for booking preselection.
- Full disclaimer appears on Services, focused package pages, and FAQs/Aftercare.
- Homepage keeps approved short disclaimer.
- Review text is exact where presented as review quotation.
- Accessibility basics pass.
- Responsive checks pass.
- Approved planned assets render or asset-blocked items are explicitly deferred.
- Review wall avoids unnecessary high-card-count animation and respects reduced motion.
- No self-serving Review/AggregateRating schema is added.
- Confirmed legacy pages do not render old page content.

Commit/deployment:

- If this phase is verification-only and no files change, do not create an empty commit.
- If documentation must be updated with final results, commit with: `verify planned site remediation`
- Push to `master` only if a commit is created.

Final response:

- Validation command results
- Local route smoke results
- Live Vercel route results
- Accessibility/keyboard results
- Responsive viewport results
- Legacy route cleanup confirmation
- Remaining deferred items, if any
- Commit hash if a commit was created
- Push result if applicable
- Clear statement whether planned-site remediation is complete
