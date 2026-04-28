# Remediation Implementation Plan Requirements

The audit must end by creating a remediation implementation plan. That plan is a future-work document only. The model executing the audit must not implement the remediation plan.

## Remediation Plan Purpose

The remediation plan should turn audit findings into a safe, phase-by-phase implementation path. Each phase must be small enough to verify, commit, push, and check on Vercel before the next phase begins.

## Required Remediation Plan Structure

The plan must include:

1. Executive summary
2. Scope and non-goals
3. Issue prioritization model
4. Phase ordering rationale
5. Phase-by-phase implementation instructions
6. Verification gates after each phase
7. Deployment gates after each phase
8. Rollback strategy
9. Final acceptance checklist

## Recommended Phase Order

Use the actual audit findings to adjust the order, but start from this default:

1. Blocking route/build/CTA issues
2. Plan-compliance and content restoration issues
3. Accessibility and interaction issues
4. Responsive/mobile layout issues
5. Visual polish and design consistency issues
6. Performance/SEO/deployment issues
7. Final cross-page verification

## Phase Requirements

Every remediation phase must specify:

- Issue IDs addressed
- Routes affected
- Components/files likely touched
- Constraints
- Expected outcome
- Exact implementation steps
- Validation commands
- Manual route checks
- Local smoke checks
- Vercel deployment checks
- Commit message
- Rollback note
- Gate for proceeding

## Verification Requirements

Each phase must run the smallest useful verification plus the required project checks:

```txt
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm build
```

If a test script exists, run it and record the result.

If a phase affects a route, smoke check that route locally.

If a phase is pushed, wait for the Vercel deployment and check the affected live route.

## Deployment Requirements

Each remediation phase should be committed separately. The commit should contain only the changes for that phase.

Default branch push is acceptable per user preference, but each phase must be verified before pushing.

After pushing:

1. Wait for Vercel deployment to update.
2. Check affected live routes on the primary Vercel deployment.
3. If the primary deployment is stale or unavailable, check the alternate Vercel URLs and document the result.
4. Record deployment result.
5. Proceed only if the gate passes.

## Rollback Requirements

Each phase must include a rollback note. The rollback should identify:

- Commit hash once known
- Files changed
- Safe revert command or manual rollback path
- Risks of reverting after later phases

Use git carefully. Do not run destructive commands unless explicitly asked.

## What The Remediation Plan Must Not Do

- Do not rewrite plan files.
- Do not recommend broad redesigns when targeted fixes solve the issue.
- Do not merge unrelated issue categories into one large phase.
- Do not include screenshots as required artifacts.
- Do not rely on memory from chat context.
- Do not assume old legacy pages are part of the planned-page design audit.
