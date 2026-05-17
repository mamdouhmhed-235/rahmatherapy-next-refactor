# Operations deferrals — Phase 6 → Phase 7

## Mobile filter strip uses inline `<details>` instead of `AdminSheet` from bottom
- **Source:** brief §5 Layout Strategy + audit P2 + critique consistency note
- **Verbatim:** "Filter strip collapses behind 'Filters' Ghost → `AdminSheet` from the bottom."
- **Defer to:** Phase 7
- **Why deferred:** the inline `<details>` pattern is server-renderable and accessible, but the brief specifies a slide-up bottom sheet for cross-page consistency with bookings / enquiries. Wiring an `AdminSheet` here requires extracting the filter form into a small client wrapper; the visual consistency pass across mobile filter sheets is better handled in one Phase 7 sweep.
- **Provisional Phase 6 answer used to continue this session:** inline `<details>` collapsing the entire filter region behind a "Filters (N)" summary on mobile (`page.tsx:200`).

## Severity chip on a row is a hand-built link with raw oklch literals, not AdminStatusBadge
- **Source:** critique §4 Consistency and Standards
- **Verbatim:** "severity chips on the row are bespoke pills (raw `oklch(...)` color literals in `event-row.tsx`) rather than the canonical `AdminStatusBadge` used everywhere else; result is two badge vocabularies on one surface."
- **Defer to:** Phase 7
- **Why deferred:** the severity chip must also be a clickable filter link, which `AdminStatusBadge` doesn't support out of the box. Extending the shared component is out-of-scope for this page session.
- **Provisional Phase 6 answer used to continue this session:** bespoke link styled with the same OKLCH coordinates as the shared status families.

## Column descriptions defined but unused
- **Source:** critique §10 Help and Documentation + craft note
- **Verbatim:** "`columnMeta[key].description` is defined but never rendered — dead copy in `operations-board.tsx`."
- **Defer to:** Phase 7
- **Why deferred:** the descriptions ("Needs eyes. Acknowledge to claim it, resolve when handled." etc.) belong under each column heading but adding them now eats vertical real estate on mobile. Phase 7 can decide whether to render inline, behind a tooltip, or remove the dead lines.
- **Provisional Phase 6 answer used to continue this session:** descriptions present in source as future scaffolding; not rendered.

## Mobile filter disclosure uses `›` glyph instead of Lucide chevron
- **Source:** critique smaller craft note
- **Verbatim:** "The mobile filter `<details>` toggle uses `›` as a glyph (line 202, 302) instead of a Lucide chevron — slight inconsistency with the rest of the surface."
- **Defer to:** Phase 7
- **Why deferred:** trivial visual swap, lower priority than the audit P1s. Bundled with the shared-components consistency sweep.
- **Provisional Phase 6 answer used to continue this session:** raw `›` character for both filter and "Custom date range" disclosures.

## Severity tint legibility with 60+ Open + error rows untested
- **Source:** brief §10 Open Question 1 + audit P3 + harden recs
- **Verbatim:** "Phase 6 verifies against a populated database. … revisit per §10 Q1."
- **Defer to:** Phase 7
- **Why deferred:** the test DB is empty (`operational_events` returns 0 rows in this seed). The full-row Cancelled tint on Open + error is implemented per spec; visual fatigue verification needs a populated seed.
- **Provisional Phase 6 answer used to continue this session:** tint applied per brief; legibility verified via design intent (only Open + error gets the tint, max ~5% of rows in steady state).

## Backend filter query is FAKE
- **Source:** Recipe Context Backend Status field + audit P2
- **Verbatim:** "BUILD-operations-filter-query.md is BLOCKS-REDESIGN. Until handled, filter-strip filters render and submit a URL but the server returns the unfiltered page-load result; flag FAKE in the audit."
- **Defer to:** post-launch (depends on BUILD plan landing first)
- **Why deferred:** explicitly out of Phase 6 scope per Recipe Context. Filter strip + severity chip + stat tile click + date-range presets all carry `data-redesign-fake="filter-query"`.
- **Provisional Phase 6 answer used to continue this session:** all filter surfaces render and route URLs correctly; server query passes `.limit(300)` and ignores filter params.

## Admin/PM scope filter not enforced
- **Source:** brief §11 Role variants + audit P2
- **Verbatim:** "The data layer filters out events flagged as owner-scope-only by `event_type` (a small subset of settings-system events); PM sees email-delivery, booking-engine, and integration events."
- **Defer to:** Phase 7 (depends on `BUILD-operations-filter-query.md` defining the owner-scope event_type list)
- **Why deferred:** the page intentionally passes through `getAdminPageAccess` permission check; the data-layer event_type filtering is part of the BUILD plan.
- **Provisional Phase 6 answer used to continue this session:** PM sees identical event stream to Owner until BUILD plan lands.

## P1 (tag for Phase 7 gauntlet)
- Raw `oklch()` literals in `src/app/admin/operations/event-row.tsx:160,172,173,174,182`, `src/app/admin/operations/page.tsx:368,376` — audit subagent flagged token-drift, main agent rebuttal: values mirror admin-ui.tsx canonical Phase 4 OKLCH design tokens (DESIGN.md `status-{cancelled,attention,restricted}-{bg,text}`); the legacy `--admin-danger`/`--admin-warning`/`--admin-restricted` hex vars in `src/styles/tokens.css` would be a regression. Phase 7 to arbitrate which token system is canonical.
- `xl:break-all` mangling fixed in this session (replaced with default word-breaking + `xl:line-clamp-1`).
