# Progress — B-6 Client LTV ribbon

**Brief:** `redesign/briefs/B6-client-ltv-ribbon-brief.md`
**Plan:** `redesign/plans/B-phase/B6-client-ltv-ribbon-plan.md`
**Started:** TBD
**Completed:** TBD

## Step log

(Append `step-N: COMPLETE — <one-line evidence>` per plan step.)

## Verification gate

- [ ] Static lint + types clean
- [ ] Vitest 6 new specs pass; baseline preserved
- [ ] Owner viewing loyal client (≥10 visits): ★Loyal pill + populated sparkline
- [ ] Owner viewing new client (1 booking): `New` chip + 1-point sparkline
- [ ] Owner viewing zero-bookings client: ribbon hidden
- [ ] Therapist scope narrowing: LTV sub-line reads "Across N visits with you"
- [ ] Therapist viewing non-assigned client: ribbon hidden
- [ ] All-cancelled client: ribbon visible with `£0` / `Never` / `New` zero-state
- [ ] Repeat-status threshold mapping verified: 1 / 3 / 7 / 12 visits → New / Returning / Regular / Loyal
- [ ] Truncated Preferred service: tooltip shows full name
- [ ] Mobile 3×2 grid reflow
- [ ] Query budget: no new queries (ribbon consumes `bookingHistory`)
- [ ] Bundle delta within budget (≤ +6kB)

## Hand-off

**Programme complete.** Phase 7 audit re-entry possible after this commit.
