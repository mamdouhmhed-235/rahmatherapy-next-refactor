# Deferrals — dashboard-owner-admin

This file lists items that the Phase 6 build deliberately deferred. The Phase 7 `/impeccable audit admin` gauntlet should re-scan these.

## Phase 7 — code/scope-bound

### AdminErrorBoundary fallback lacks `role="alert"`

- **Source:** Step 12 audit, repeated in `/impeccable harden` re-run.
- **Verbatim:** `src/app/admin/components/admin-error-boundary.tsx` renders `<AdminEmptyState>` on caught render error without `role="alert" aria-live="polite"`. Per-tile `AdminPanel` error states DO carry the correct ARIA (`admin-ui.tsx:312-319`); the boundary fallback does not.
- **Defer to:** Phase 7 (`00-shared-components` or `admin-ui` chore).
- **Why deferred:** `admin-error-boundary.tsx` is shared infrastructure outside the dashboard recipe's 7-file scope; touching it would be a scope violation. The risk is small in practice — per-tile errors already announce correctly; only an uncaught render crash falls through to the boundary fallback.
- **Provisional Phase 6 answer:** ship; document.

### Severity tint OKLCH literals (dashboard-cards.tsx)

- **Source:** Step 11a token-drift grep.
- **Verbatim:** `border-[oklch(88%_0.045_20)] bg-[oklch(95.5%_0.028_20)]/30` (and matching warning/clear variants) at `dashboard-cards.tsx:474-477`.
- **Defer to:** Phase 7.
- **Why deferred:** existing `--admin-danger-bg/--admin-warning-bg/--admin-success-bg` tokens use lower-chroma hex values than the OKLCH literals chosen by the polish loop; swapping inline would shift visual weight. Phase 7 audit can add `--admin-{severity}-bg-strong` tokens once the system-wide severity palette is reconciled.
- **Provisional Phase 6 answer:** keep the OKLCH literals (semantic brand-band hues 20/65/155; not arbitrary colour).

### Tile-error copy verbatim per brief

- **Source:** Brief §6 / Step 9 harden review.
- **Verbatim:** brief requires `Couldn't load this section. Try refreshing.` on tile-load failures.
- **Defer to:** Phase 7.
- **Why deferred:** the error string is produced by the shared `AdminErrorBoundary` (out of scope). The new dashboard panels do all surface `role="alert"` errors via `AdminPanel`'s `error` prop, so AT users do get an announcement. Only the boundary fallback string isn't brief-verbatim.

## Shell / out-of-scope

### Mobile bottom-nav overlap with page main

- **Source:** Step 7 visual self-audit (375 viewport) + adapt pass.
- **Verbatim:** mobile fixed bottom navigation visually covers the lower portion of `<main>`. Page-level `pb-24 md:pb-8` on `AdminPageScaffold` clears the last content; landscape mode is shell-handled (`AdminTopNav.tsx:259`).
- **Defer to:** post-launch / `00-shared-components` session.
- **Why deferred:** `shell-variant.ts` and the admin shell layout are out of scope per the recipe's "Files to NEVER touch" list. The mitigation (page-level bottom padding) handles portrait mode; the proper safe-area rule belongs in the shell.

## Phase 6 brief-shape deviations (intentional, documented in brief §11)

These are NOT bugs — they're explicit design choices made during the build, recorded in `redesign/briefs/dashboard-owner-admin-brief.md` §11 "Implementation amendments". Listed here so Phase 7 doesn't try to "fix" them back to the original spec without context:

- **H1 wording**: `"Today at Rahma Therapy"` (was `"Today at Rahma"` in original brief; updated for brand specificity in final spacing-fix pass).
- **Operations Health rebuilt as severity-weighted priority list** instead of 2×2 `AdminHealthTile` grid — the original spec hit the identical-card-grid anti-pattern PRODUCT.md bans.
- **Day readiness condensed to inline status ribbon** instead of 3-tile grid (same anti-pattern).
- **Snapshot panel is range-aware** rather than today-only — the brief said "Today panel" but in practice every other panel respected the date filter except this one. Closing the cohesion gap was the biggest visual win of the build.
- **Demand-trend lost its 7/30 sub-toggle** — it competed with the global filter and forced inconsistent state.
- **Mix snapshot demoted to slim strip below Tier 2** — was a peer panel pre-rebuild but not specified in brief; demoted to footnote rather than removed.
- **List ↔ Timeline toggle persists via URL param** (`?todayView=`) instead of `localStorage` — keeps it within the 7-file scope, matches the codebase's URL-driven date-preset pattern, and survives across navigations naturally.

## I18n / future iteration

- **Pluralisation** uses English `count === 1 ? "" : "s"` patterns throughout. An `Intl.PluralRules`-aware i18n library would handle Russian/Arabic/CJK plural classes. Not in brief scope.
- **`Updated <relative-time>` staleness warning** could turn amber at >5min stale. Currently just shows the relative time without escalation; not requested.
- **Sparkline keyboard / AT data-table fallback** — currently `role="img" aria-label="7-day booking trend"` (decorative trend, no underlying data table). Acceptable for the surface but a richer surfaces could expose the daily counts.
