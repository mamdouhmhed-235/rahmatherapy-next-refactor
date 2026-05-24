# Progress — B-5 Dashboard rebuild

**Brief:** `redesign/briefs/B5-dashboard-rebuild-brief.md`
**Plan:** `redesign/plans/B-phase/B5-dashboard-rebuild-plan.md`
**Started:** TBD
**Completed:** TBD

## Step log

(Append `step-N: COMPLETE — <one-line evidence>` per plan step.)

## Verification gate

- [ ] Static lint + types clean
- [ ] Vitest new specs pass; baseline preserved
- [ ] Business variant: Personal Stripe + filter + Tier 1 + Ops Health Tier 1.5 + no BusinessPulseCard + no Tier-2 disclosure
- [ ] Coordinator variant: Personal Stripe (Coord tiles) + Tier 1 unassigned-first + Ops Health + Active Enquiries disclosure
- [ ] **Therapist variant with FULL data**: all 10 content blocks render per brief §5.6
- [ ] **Therapist variant with EMPTY DB** (use `test.therapist.fresh@…` from B-0): 5–7 meaningful blocks; page never reads "blank" (AUDIT M1)
- [ ] Mobile sticky bar Therapist fallback ladder verified: Next Visit → Browse claimable → Set my availability (AUDIT Q5)
- [ ] Owner Personal Stripe shows own metrics (AUDIT Q4) — clinical zeros render explicitly when Owner doesn't treat
- [ ] **Tone audit on Therapist fullness**: no "★" pills, no "best month yet" copy — matches existing admin voice (AUDIT Q1)
- [ ] Feature flag `NEXT_PUBLIC_B5_THERAPIST_FULLNESS=on` wraps the new blocks (AUDIT R6)
- [ ] PTR fires past 80px on mobile; 2-second debounce in place (AUDIT G9)
- [ ] Swipeable today cards: snap-scroll works
- [ ] M2 fix: OpsHealth failed-email row click → `/admin/emails`
- [ ] M3 fix: Therapist Claim button → optimistic + sonner toast (no confirm modal — AUDIT C4)
- [ ] Severity tints use strong tokens (B-1)
- [ ] Equal min-heights across primary-tier panels
- [ ] Empty-state pass: every section renders encouraging empty copy
- [ ] `prefers-reduced-motion`: no animations
- [ ] `?todayView=` URL preserved per AUDIT G4
- [ ] Screenshots: 3 variants × 4 viewports
- [ ] Query budget ≤6 per render

## Hand-off

Next phase: B-6 (Client LTV ribbon).
