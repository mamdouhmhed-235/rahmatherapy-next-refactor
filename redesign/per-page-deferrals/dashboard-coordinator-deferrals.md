# Deferrals — dashboard-coordinator

## Resolved in this session (reconciled)

- **V-1 / V-2 (Cormorant 0 shouts / glyph ambiguous):** RESOLVED — variant-specific marquee size + 0-state guard land at `dashboard-cards.tsx:273-279`; `[font-variant-numeric:tabular-nums_lining-nums]` applied across all marquees.
- **B-3 (Today marquee size off-spec):** RESOLVED — Coordinator marquee now respects brief §5.3 `3.157rem` cap via the same variant guard.
- **B-10 (AssignmentChip hidden at `<sm:`):** RESOLVED — `showAssignmentChip` prop drives both the wrapped-row mobile chip and the trailing desktop chip; mobile path no longer falls back to plain status badge.
- **V-7 (Nested cards anti-pattern):** RESOLVED in corrective round — both wrappers at `dashboard-cards.tsx:534` (UpcomingRangeList empty) and `:889` (TodayTimeline empty) stripped to plain `px-4 py-8` (no border, no rounded, no bg).
- **V-8 (Payments leak to Coordinator):** RESOLVED in corrective round — `showPaymentsReadiness` prop added with default `true`; Coordinator branch passes `false`; Payments ReadinessChip gated.
- **V-10 / M-6 (Convert touch target):** RESOLVED in corrective round — Convert link now `min-h-11` (44px) full-width on mobile, `sm:w-auto` on desktop. Href preserved verbatim.

## Cross-variant findings deferred to Phase 7

These were surfaced during Coordinator audits but live on chrome shared with Owner/Admin or Therapist variants. Fixing them here would alter cross-variant baseline; Phase 7 `/impeccable audit admin` resolves them globally.

- **V-3** Three numeral treatments across tiles — Today / Active Enquiries / Operations Health vary in size. **Defer to:** Phase 7. **Why:** Operations Health treatment shared with Owner/Admin.
- **V-4 / M-5** Bottom nav z-index on mobile — shared chrome from `AdminPageScaffold`. **Defer to:** Phase 7 chrome pass.
- **V-5 / M-3 / M-4** Filter chip overflow / Filters button orphan at 375 — affects all dashboard variants. **Defer to:** Phase 7.
- **V-6** "Active queues" disclosure border softened in this session, but full restyle is cross-variant. **Defer to:** Phase 7.
- **V-9** Active Enquiries header wrap at 768 — Coordinator-only tile but interacts with shared spacing tokens. **Defer to:** Phase 7 polish.
- **V-11** "1 active issue / All systems quiet" — partially mitigated by switching success-tone copy to "All systems quiet"; deeper severity-rationalisation defers. **Defer to:** Phase 7.
- **P-1** Today date appears three times — filter strip duplicate hidden when range=today; further consolidation cross-variant. **Defer to:** Phase 7.
- **P-3** "SNAPSHOT · TODAY" eyebrow vs brief H2 "Today" — Coordinator now uses H2; Owner/Admin retains eyebrow until Phase 7 cross-variant. **Defer to:** Phase 7.
- **P-4** Gold accent dash under H1 — removed in this session; full header rework cross-variant. **Defer to:** Phase 7.
- **P-6 / P-7 / P-8 / P-9** Numeral / CTA / disclosure-preview polish — cross-variant. **Defer to:** Phase 7.
- **M-1 / M-2** Role pill mobile + Active Enquiries row mobile wrap — partially fixed (variant-derived fallback); chrome rework cross-variant. **Defer to:** Phase 7.
- **B-1 / B-2** H1 "Today at Rahma" / H2 "Today" — Coordinator H2 done; H1 change would alter Owner/Admin baseline. **Defer to:** Phase 7.
- **B-4 / B-5** Avatar token / Attention family token — codebase aliases Pending → warning at runtime; token-rename is a Phase 4 design-system change. **Defer to:** Phase 4 token expansion or Phase 7.
- **B-6** Instagram lucide icon — lucide-react@1.8.0 hard limitation (no Instagram export). `AtSign` is the closest available glyph. **Defer to:** Phase 7 or lucide-react upgrade.
- **B-7** Role pill 3-part gap — variant-derived fallback applied; placement (under H1 vs header rail) cross-variant. **Defer to:** Phase 7.
- **B-8** "Quiet day" CTA — `Open enquiries` Secondary added in this session. **Resolved**, no further defer.
- **B-9** Tooltips — added on role pill, Today numeral, unassigned sub-line, Active Enquiries numeral, Convert link, lifecycle chip, source icon, chevron. Remaining (date preset chips, NotificationBell count messages) cross-variant. **Defer to:** Phase 7.

## Active P1 from audit (corrective round)

- **AdminErrorBoundary wrap missing on Coordinator-branch dashboard cards** — `src/app/admin/dashboard/page.tsx:721, 767, 805-813`. Cross-variant resilience pattern; affects all variants if standardised. **Defer to:** Phase 7.
