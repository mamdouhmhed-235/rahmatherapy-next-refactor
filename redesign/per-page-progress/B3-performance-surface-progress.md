# Progress — B-3 Performance surface

**Brief:** `redesign/briefs/B3-performance-surface-brief.md`
**Plan:** `redesign/plans/B-phase/B3-performance-surface-plan.md`
**Started:** TBD
**Completed:** TBD

## Step log

(Append `step-N: COMPLETE — <one-line evidence>` per plan step.)

## Verification gate

- [ ] Static lint + types clean
- [ ] Vitest new specs pass; baseline preserved
- [ ] `/admin/me` renders for Owner / Admin / Coordinator / Therapist
- [ ] `/admin/staff/[staffId]/performance` renders with manager-view chrome (Owner viewing Therapist)
- [ ] Self-redirect: Owner → `/admin/staff/{ownId}/performance` redirects to `/admin/me`
- [ ] Therapist denied at `/admin/staff/{otherTherapistId}/performance`
- [ ] Inactive staff: Owner viewing inactive Therapist sees historical scorecard + "Inactive since {date}" pill (AUDIT G5)
- [ ] "My Performance" link visible in `AdminTopNav` for every active role
- [ ] Mobile sticky action bar verified for Therapist + Coordinator
- [ ] Audit timeline freshness verified (new row appears post-action)
- [ ] Per-section Suspense boundaries verified (SHARED-IMPLEMENTATION-NOTES §10)
- [ ] Query budget ≤4 per render

## Hand-off

Next phase: B-4 (Reports rebuild).
