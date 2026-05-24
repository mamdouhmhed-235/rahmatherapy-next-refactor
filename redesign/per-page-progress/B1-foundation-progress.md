# Progress — B-1 Foundation primitives

**Brief:** `redesign/briefs/B1-foundation-primitives-brief.md`
**Plan:** `redesign/plans/B-phase/B1-foundation-plan.md`
**Started:** TBD
**Completed:** TBD

## Step log

(Append `step-N: COMPLETE — <one-line evidence>` per plan step.)

## Verification gate

- [ ] Static lint clean (`pnpm lint`)
- [ ] Static types clean (`npx tsc --noEmit`)
- [ ] Vitest all new specs pass; baseline preserved
- [ ] Bundle delta within budget (≤ +12kB gzip on `/admin/dashboard` per B-0 baseline)
- [ ] Visual smoke screenshots at 375 / 768 / 1280
- [ ] Skeleton regression check on existing admin pages
- [ ] Sandbox cleanup (`git status` shows no `__sandbox/` files)

## Hand-off

Next phase: B-2 (metric backend).
