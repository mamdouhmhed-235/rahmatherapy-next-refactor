# Prompt 07: Remediation Implementation Plan Authoring

```txt
You are executing Phase 9 of the planned Rahma Therapy site audit.

Use relevant skills:
- implementation planning
- senior frontend engineering
- accessibility remediation planning
- release engineering
- risk management

Goal:
Write a comprehensive phase-by-phase remediation implementation plan based on the completed master issue register. This plan is for future implementation only. Do not fix issues now.

This is documentation-only. Do not change runtime code.

Read first:
- docs/planned-site-audit/03-remediation-plan-requirements.md
- docs/audits/planned-site-quality-audit/09-master-issue-register.md
- all category-specific audit files

Write:
- docs/audits/planned-site-quality-audit/10-remediation-implementation-plan.md
- docs/audits/planned-site-quality-audit/11-verification-and-deployment-checklist.md

The remediation plan must include:
1. Executive summary.
2. Scope and non-goals.
3. Prioritization model.
4. Phase ordering rationale.
5. Phase-by-phase implementation plan.
6. Verification gates after each phase.
7. Deployment gates after each phase.
8. Rollback notes.
9. Final acceptance checklist.

Recommended phase order:
1. Blocking route/build/CTA issues.
2. Plan-compliance and content restoration.
3. Accessibility and interaction fixes.
4. Responsive/mobile layout fixes.
5. Visual polish and design consistency.
6. Performance/SEO/deployment fixes.
7. Final cross-page verification.

Each phase must include:
- Goal
- Issue IDs addressed
- Routes affected
- Files/components likely touched
- Constraints
- Expected outcome
- Implementation steps
- Validation commands
- Local route checks
- Live Vercel checks
- Commit message
- Rollback note
- Gate before the next phase

Important:
If an issue requires developer-provided assets, do not invent assets. Put it in an asset replacement phase or mark it as blocked by assets.

Validation commands to include:
- pnpm lint
- pnpm exec tsc --noEmit --incremental false
- pnpm build
- existing test script if present

Deployment checks to include:
- Commit phase changes
- Push to default branch
- Wait for Vercel deployment
- Check affected live route(s)
- Record result before proceeding

Gate before stopping:
- Every issue in the master register is assigned to a remediation phase or explicitly deferred with rationale.
- The plan is detailed enough for a future model to implement without chat context.
- No runtime code changed.
```
