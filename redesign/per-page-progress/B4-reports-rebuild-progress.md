# Progress — B-4 Reports rebuild

**Brief:** `redesign/briefs/B4-reports-rebuild-brief.md`
**Plan:** `redesign/plans/B-phase/B4-reports-rebuild-plan.md`
**Started:** TBD
**Completed:** TBD

## Step log

(Append `step-N: COMPLETE — <one-line evidence>` per plan step.)

## Verification gate

- [ ] Static lint + types clean
- [ ] Vitest new specs pass; baseline preserved
- [ ] Owner role sweep: 6 tiles + Insights stripe + 3 sections + 8 CSV chips
- [ ] Coordinator: 4 tiles, no Money, 5 CSV chips
- [ ] Therapist: "My report" header, 4 tiles, 1 CSV chip, no Workload Staff
- [ ] Drill-into-staff: Owner → workload row click → URL `?staffId=`; page narrows; Back link works
- [ ] `[Team | Personal]` toggle: **whole-page narrowing** verified (AUDIT Q3 — tiles + charts + sections + CSV exports all scope)
- [ ] Insights stripe dismiss: row vanishes optimistically; DB row written; persists across reload (AUDIT Q6)
- [ ] Insights stripe drill-link navigates per linked surface
- [ ] Print preview at desktop 1280 / A4 portrait: layout legible; chrome hidden; section page-breaks (AUDIT Q8)
- [ ] Lifetime range: delta chips hidden across all tiles
- [ ] CSV download in each role view → CSV with correct scope
- [ ] Per-section Suspense boundaries verified (SHARED-IMPLEMENTATION-NOTES §10)
- [ ] Query budget ≤8 per render
- [ ] Bundle delta within budget

## Hand-off

Next phase: B-5 (Dashboard rebuild).
