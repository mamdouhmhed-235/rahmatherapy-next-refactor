# Deferrals — availability

## RESOLVED in corrective dispatch (2026-05-16)

The five highest-priority audit/critique findings were closed in a follow-up corrective dispatch after the initial Phase 6 commit (3083d97). All fixes scoped to 3 source files + 2 doc files.

1. **P1 — Tabpanel `aria-labelledby` references resolve** — `src/app/admin/availability/AvailabilityManagersTabs.tsx:82-86` (each tab button now carries `id={`availability-tab-${tab.key}`}`).
2. **P1 — Tab strip arrow-key keyboard navigation** — `src/app/admin/availability/AvailabilityManagersTabs.tsx:40-62` (ArrowLeft / ArrowRight / Home / End wired on the `role="tablist"` with focus migration; `tabIndex` follows the ARIA tab pattern: `0` on active, `-1` on inactive).
3. **P2 — Cormorant Garamond removed from capacity pills** — `src/app/admin/availability/page.tsx:557-571` (DESIGN.md "Cormorant Exception" honoured; numerals revert to Work Sans 500 label step).
4. **P2 — Coordinator denied surface now carries Secondary "Back to dashboard" Link** — `src/app/admin/availability/page.tsx:639-650` (matches Therapist denied pattern at lines 622-628).
5. **P2 — Working-hours time inputs now animate via CSS-grid collapse** — `src/app/admin/availability/AvailabilityRulesManager.tsx:332-396` (`grid-template-rows: 0fr ↔ 1fr` + `opacity-0 ↔ opacity-100` + inner `min-h-0 overflow-hidden`; `hidden` token removed from the closed-day branch; `motion-reduce:transition-none` respects `prefers-reduced-motion`; brief §3 "160ms ease-gentle reveal" now actually fires).

## Outstanding for Phase 7 gauntlet

The audit subagent surfaced these in `PER-PAGE-SCORES.md` § `availability — audit`:

- ~~Tabpanel `aria-labelledby` references dangling tab-button IDs (`src/app/admin/availability/AvailabilityManagersTabs.tsx:62-85` ↔ `:41-55`).~~ **Resolved in corrective dispatch — see item 1 above.**
- ~~Tab strip missing arrow-key keyboard navigation (`role="tablist"`/`role="tab"` without `onKeyDown` handler).~~ **Resolved in corrective dispatch — see item 2 above.**

The P2/P3 findings not enumerated above (DOM `name="start_time_0"` divergence, list-row `surface-card` vs `surface-page` brief preference, `role="tabpanel"` semantics on always-visible desktop sections, single-form vs Promise.all consolidation) remain deferred to the Phase 7 `/impeccable audit admin` global pass.
