# Wave reconciliation log

Cross-wave consistency notes per POST-AGENT-AUDIT-PROTOCOL §6. Updated at the close of each LAUNCH-SHEET §3 wave (or partway when the wave straddles sessions).

---

## Wave 1 — quick wins (CLOSED 2026-05-17)

**Pages:** calendar · availability · reports · settings

**Merge order:** calendar (pre-existing on `redesign/start-state` at session start) → availability (pre-existing) → settings (`9102e8e`, merged 2026-05-17) → reports (`92047e8`, rebased onto settings then merged) → **wave closed**.

**Status:** all 4 merged on `redesign/start-state`. Visual cross-page reconciliation at 1440 / 768 / 375 deferred to Phase 7 (`/impeccable audit admin`) — the dev server was not exercised post-merge during this session.

**Notable Phase-7 carry-forwards from this wave:**

- **settings**: audit + critique were main-agent self-review (subagent dispatch was deferred due to turn-budget). Phase 7 must re-audit objectively. Reference: `redesign/per-page-deferrals/settings-deferrals.md` "Subagent audit + critique not dispatched".
- **reports**: 4 P2 token-drift findings (raw oklch literals + section H2 type step + AdminStat resting shadow + section H2 vs panel H2 semantic stacking). The **AdminStat resting shadow** finding is cross-cutting and belongs to `00-shared-components` scope, not reports — every page using `AdminStat` carries it. Phase 7 fix lives in `src/app/admin/components/admin-ui.tsx:211`.
- **reports + settings**: 22 + 10 raw `oklch()` literals respectively, all matching `admin-ui.tsx` codebase convention — routed to Phase 8 extract for systemic tokenisation rather than per-page surgery.
- **reports**: agent's own corrective dispatch closed 6 of the 7 user-flagged audit items (Section C duplicates, 4×2 chip grid, section H2 1.5rem→1.778rem, mobile filter trigger range label, invisible loading state, mobile bottom-nav clearance). Fix 3 (AdminStat shadow) correctly deferred to 00-shared-components. Fix 5 (sparse bar charts) correctly skipped per user's own "out of brief scope" note.

---

## Wave 6 — FAKE admin lists (3 of 4 merged 2026-05-17, privacy pending)

**Pages merged:** enquiries (`1ebc18f`) · audit (`3c69da8`) · operations (`2a8b804`)
**Pending:** privacy

Wave 6 cannot fully close until privacy lands. Visual cross-page reconciliation deferred to that close.

### Brief-extension precedents now in `redesign/start-state`

Wave 6 establishes **9 brief-extension patterns** that future page briefs may need to align with or explicitly override. Listed here so brief authors and Phase 7 can decide on consistency-or-divergence per pattern.

#### From enquiries (6 enhancements beyond brief)

| Pattern | Where landed | Cross-page reach |
|---|---|---|
| Bulk-select checkbox column + `select-all` header + sticky `BulkActionBar` + `Promise.all` partial-failure handling | `src/app/admin/enquiries/EnquiryList.tsx` | DESIGN.md's "Bulk Actions: When introduced" stub is now realised. Staff / audit / operations briefs should align with this shape if they adopt bulk actions, or explicitly diverge with rationale. |
| `?sort=` URL param contract with 4 options (Newest / Oldest / Name A→Z / Last activity) | `EnquiryList.tsx`; round-trips through filter forms | First sort-param adopter. Other list pages adopting sort should match the param name + option order. |
| `localStorage` filter persistence + "Resume last filters" Ghost on clean visit | `src/app/admin/enquiries/EnquiryFilterPersistence.tsx`; storage key `rahma:enquiries:lastFilters` | First admin localStorage pattern. Future per-page localStorage adopters should follow the `rahma:<slug>:<key>` storage-key convention. |
| At-a-glance metrics strip above the list (Today new / This week / Conversion-rate-this-month tiles) | `enquiries/page.tsx` server-computed tiles linking to filtered views | Layout variant. Other list pages may follow but should evaluate per brief — risks the "identical-card-grid" PRODUCT.md anti-reference at scale. |
| `updated_at` added to Supabase `select(...)` query | `enquiries/page.tsx` data-fetch | Small data-shape extension scoped to enquiries; not a global migration. |
| Mobile filter → focus-trapped `AdminSheet` (brief-aligned — closed a P1 deferral) | `EnquiryList.tsx` | **Recommended pattern** for all mobile filter UIs going forward. Replaces native `<details>` provisional. |

#### From audit (3 enhancements beyond brief)

| Pattern | Where landed | Cross-page reach |
|---|---|---|
| Expand all / Collapse all controls (targets `<details data-audit-json="true">` specifically so unrelated `<details>` stay closed) | `src/app/admin/audit/AuditPageActions.tsx` | Reusable pattern for any `<details>`-heavy page. The data-attribute-scoped targeting is the part to copy if adopted elsewhere. |
| Refresh + freshness ticker ("Last refreshed N min ago" via `setInterval(30s)`, `aria-live="polite"`, `router.refresh()` button) | `AuditPageActions.tsx` | First admin "auto-refresh-aware" page. Live-data pages (operations, dashboards) could adopt. |
| Day-grouped timeline ("Today" / "Yesterday" / "Friday 15 May" via `Intl.DateTimeFormat` in Europe/London) | `audit/format.ts` `dayKey()` + `dayLabel()` helpers; `DayGroupedTimeline` server component | Reusable for any time-ordered list page. Reduces visual repetition by inserting `<h3>` day-group dividers + row-count badges. |

#### Operations: 0 brief-extensions

Strictly recipe scope. Honors the discipline the user reinforced after enquiries' merge ("we must not stray from the brief or recipe"). 3 source files touched, all declared in the scope file, all within `src/app/admin/operations/`.

### Phase-7 carry-forwards from this wave

- **enquiries (stale deferral entry)**: `redesign/per-page-deferrals/enquiries-deferrals.md` still lists `<details>` mobile filter as a Phase 7 carry-forward — but the corrective dispatch's Fix S6 already upgraded it to `AdminSheet`. Deferral entry is stale; one-line edit when convenient.
- **audit P1 — colour-only family signal**: `src/app/admin/audit/AuditEventCard.tsx:19-50, 119-126` renders an 8px coloured dot with no text/icon label for sighted users. Violates DESIGN.md §2 Named Status Rule + PRODUCT.md "Color-only status signalling" anti-reference. The brief §5 specified full `AdminStatusBadge` (bg + text + icon + visible label); the "quieter" axis traded it for the dot. Phase 7 must restore the chip per brief.
- **audit P1 — print stylesheet**: `AuditEventCard.tsx:158` uses `print:!open` Tailwind class, but `open` is an HTML attribute not a CSS property. Phase 7 adds `@media print { details > div { display: block !important } summary { display: none } }` to `src/app/globals.css`. Cross-cutting fix benefits every `<details>`-bearing admin page.
- **operations P1 — raw oklch token arbitration**: `event-row.tsx:160,172,173,174,182`, `page.tsx:368,376` use inline `oklch(...)` literals for severity tints. The legacy hex vars `--admin-danger`, `--admin-warning`, `--admin-restricted` exist in `src/styles/tokens.css:67-72`. Same conflict exists in `admin-ui.tsx` canonical pattern. Phase 7 must arbitrate which token system is canonical, then sweep across all pages.
- **operations P1 — `xl:break-all`**: `event-row.tsx:198` should be `xl:break-words` (or omit; `line-clamp-1` already truncates). One-line fix.
- **all pages — raw oklch literals**: every page in this session ends up with 7–22 inline `oklch()` literals for status families. The `admin-ui.tsx` codebase convention is to inline them; the agents consistently followed that convention. Phase 8 extract is the right venue for systemic tokenisation; per-page surgery now would create inconsistency without removing the underlying convention.

---

## Operational observations across the session (2026-05-17)

### Cumulative-leaf-damage pattern (confirmed parallel-worktree-side-effect)

Every one of 5 consecutive worktree-merge cleanups triggered the §3A `--force` heal escalation:

| Cleanup | In-flight worktrees at time of cleanup | Sampled leaves damaged |
|---|---|---|
| settings | 4 (reports, audit, enquiries, operations) | 10/10 |
| reports | 3 (audit, enquiries, operations) | 10/10 |
| enquiries | 2 (audit, operations) | 10/10 |
| audit | 1 (operations) | 10/10 |
| operations | 0 | 8/10 |

Pattern: damage correlates with number of concurrent worktrees, not with prior `Remove-Item` runs (the original protocol hypothesis). Each worktree's `node_modules` was a junction-mirror into main tree's `.pnpm/`; as worktrees come and go they leave behind pollution that the leaf-sweep catches but `--frozen-lockfile` doesn't.

**Mitigation landed 2026-05-17**: `MAIN-AGENT-CONTEXT.md §5A step 3` now runs `pnpm install --frozen-lockfile --ignore-scripts` in the worktree after robocopy, materialising the worktree's own local `.pnpm/` and breaking the junction-into-main dependence. Validate on the next batch.

### Audit-dev-server incident (resolved)

Mid-session, the audit worktree's dev server browser tab emitted `Module not found: Can't resolve 'next/dist/pages/_app'`. Root cause: audit's top-level `node_modules/next` was a junction pointing at `<main-tree>\node_modules\.pnpm\next@16.2.4_*\node_modules\next`. Cumulative `--force` heals after settings/reports/enquiries cleanups rewrote main's `.pnpm/` — invalidating the cached resolver state webpack was using. Dev-server restart cleared it; `MAIN-AGENT-CONTEXT.md §5A step 3` update prevents recurrence.

### Step 7 axes-skip pattern

Three pages this session (settings, enquiries, audit) emitted `AXES_APPLIED: none` via Step 7b iter-1-clean escape hatch — rationale being that the Ralph polish loop (Step 5) already left no visible problems for axis-targeted polish. This works correctly per recipe protocol, but it does mean per-axis screenshots (`chunk1-1440-after-<axis>.png`) are absent for those pages. Reports + audit + operations DID apply axes (reports: layout + typeset; audit: quieter + typeset; operations: distill + layout). Phase 7 can re-evaluate per page.

### Self-review-on-audit pattern

| Page | Audit/critique source | Bias risk |
|---|---|---|
| settings | Main-agent self-review (caveat explicit) | Phase 7 must re-audit |
| reports | Subagent | Low |
| enquiries | Main-agent self-review (caveat explicit) | Phase 7 should re-audit |
| audit | Subagent | Low |
| operations | Subagent | Low |

### Diverging branches → rebase pattern (well-rehearsed)

Wave 6's batch spawned at `fd6d542` and each landed on a different main-tree HEAD. Settings shipped first via ff-merge (was at HEAD). Reports/enquiries/audit/operations each required rebase + 2 conflicts (PER-PAGE-SCORES.md EOF clash + IMPLEMENTATION-PLAN.md "Currently on" line). Resolution patterns:
- **PER-PAGE-SCORES.md**: always strip the 3 conflict markers and keep both sides (every page is appending its own section).
- **IMPLEMENTATION-PLAN.md "Currently on" line**: pick whichever side points further forward to an undone row. Across this session that was always the HEAD side (since each merging page is itself the just-completed one).

---

End of log. Next update: when privacy closes Wave 6, or when a new wave starts.
