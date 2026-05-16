# Deferrals — availability

(no deferrals — Phase 6 closed cleanly for availability)

The audit subagent surfaced 2 P1 findings that should be tracked for Phase 7 gauntlet:

- Tabpanel `aria-labelledby` references dangling tab-button IDs (`src/app/admin/availability/AvailabilityManagersTabs.tsx:62-85` ↔ `:41-55`).
- Tab strip missing arrow-key keyboard navigation (`role="tablist"`/`role="tab"` without `onKeyDown` handler).

These are tagged in the **P1 (tag for Phase 7 gauntlet)** subsection of `PER-PAGE-SCORES.md` § `availability — audit` and are intended for the Phase 7 `/impeccable audit admin` global pass rather than a Phase 6 re-loop.
