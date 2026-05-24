# Progress — B-2 Metric backend

**Brief:** `redesign/briefs/B2-metric-backend-brief.md`
**Plan:** `redesign/plans/B-phase/B2-metric-backend-plan.md`
**Started:** TBD
**Completed:** TBD

## Step log

(Append `step-N: COMPLETE — <one-line evidence>` per plan step.)

## Verification gate

- [ ] Static lint + types clean
- [ ] Vitest: ~30 new specs pass; baseline preserved
- [ ] Migration `20260522120000_add_enquiry_first_contacted_at.sql` applied (Zone-2)
- [ ] Migration `20260522121000_add_band_b_indexes.sql` applied (Zone-2)
- [ ] Migration `20260522122000_add_insight_dismissals.sql` applied (Zone-2)
- [ ] Mark contacted idempotent guard verified (no overwrite on later status changes)
- [ ] `unstable_cache` wrap verified (second reload within 60s is cached)
- [ ] `revalidateTag` wired on all 6–10 mutation sites
- [ ] Smoke: `getStaffScorecard` returns sane values for known DB state
- [ ] Sentry slow-query spans wired per SHARED-IMPLEMENTATION-NOTES §12

## Hand-off

Next phase: B-3 (Performance surface).
