# Deferrals — audit (Phase 6, row 20 of 29)

Items flagged during the Phase 6 session that belong to Phase 7 (`/impeccable audit admin`) or Phase 8 (`/impeccable extract admin`) per the recipe's Deferral protocol.

## P1 — colour-only action-family signal (carry to Phase 7 gauntlet)

- **Source:** Step 12a audit subagent — `src/app/admin/audit/AuditEventCard.tsx:19-50, 119-126`
- **Verbatim:** "Action-family signal collapses to single coloured dot (no text/icon label) — violates DESIGN.md §2 Named Status Rule for sighted users though `aria-label` covers AT. Brief §5 specifies 'single Confirmed / Pending / Cancelled / Restricted family chip beneath the top row' with the AdminStatusBadge contract (background + text + icon + visible label)."
- **Defer to:** Phase 7
- **Why deferred:** P1 routing per recipe Step 12 — "P1 → tag for Phase 7 gauntlet (do not fix per-page)". The polish-pass "quieter" axis intentionally traded the full family chip for a compact dot to clear the SaaS-noise reflex, but landed on the wrong side of PRODUCT.md's colour-only anti-reference. Phase 7's `/impeccable audit admin` gauntlet should re-evaluate the trade-off (compact pill vs dot) across the whole admin.
- **Provisional Phase 6 answer used to continue this session:** Kept the 8px dot + `aria-label` + `title` for the AT path; flagged the P1 for Phase 7 routing.

## P1 — print stylesheet does not force `<details>` open

- **Source:** Step 12a audit subagent — `src/app/admin/audit/AuditEventCard.tsx:158`
- **Verbatim:** "`print:!open` Tailwind class is non-functional. `open` is an HTML attribute (a boolean DOM property), not a CSS property; Tailwind cannot toggle it from the class string and there is no `details[open]` rule in `src/app/globals.css`. When the Owner prints the page for an incident record (brief §7 `@media print` commitment), the JSON before/after well stays collapsed and evidence is lost."
- **Defer to:** Phase 7
- **Why deferred:** Fix requires editing `src/app/globals.css` (build/config-adjacent file) and the audit-specific JSX. The global CSS rule (`@media print { details > div { display: block !important } summary { display: none } }`) belongs to the admin shell and benefits every page that uses `<details>`. Phase 7 gauntlet routes this single rule across all `<details>`-bearing pages.
- **Provisional Phase 6 answer used to continue this session:** `print:hidden` on the filter strip + `print:break-inside-avoid` on each card still ship; the `<details>` open requirement is deferred.

## P2 — date-range presets use rolling windows, not calendar boundaries

- **Source:** Step 12a audit subagent — `src/app/admin/audit/page.tsx:298-316`
- **Verbatim:** "`today = now - 24h`, `this_week = now - 7d`, `this_month = now - 30d`. At 02:00 local, 'Today' shows events from yesterday 02:00 onwards."
- **Defer to:** Phase 7
- **Why deferred:** Server-side BUILD plan `BUILD-audit-filter-and-pagination.md` will own the canonical date math. Client-side calendar-boundary fix here would diverge once the server takes over.

## P2 — empty-state body copy diverges from brief

- **Source:** Step 12a audit subagent — `src/app/admin/audit/page.tsx:280`
- **Verbatim:** "Renders 'Audit rows appear here as the team works in the admin.' but brief §8 Copy block commits to 'Activity is recorded here as the team makes changes.'"
- **Defer to:** Phase 7 clarify pass
- **Why deferred:** Phase 7's `/impeccable clarify admin` pass swept across all empty-state copy.

## P2 — hidden-keys tooltip uses bare comma list

- **Source:** Step 12a audit subagent — `src/app/admin/audit/AuditEventCard.tsx:150`
- **Verbatim:** "Brief §8 commits to `Redacted fields: note, health, treatment_notes`."
- **Defer to:** Phase 7 clarify pass
- **Why deferred:** Same as above.

## P2 — inline status-family `oklch()` literals not tokenised

- **Source:** Step 12a audit subagent — 6 locations across `AuditEventCard.tsx` + `AuditFilterStrip.tsx`
- **Verbatim:** "Tokens like `--admin-restricted-bg`, `--admin-danger`, `--admin-danger-bg` exist in `src/styles/tokens.css:67-72`."
- **Defer to:** Phase 7 or Phase 8 extract pass
- **Why deferred:** Cross-page concern — the same inline-oklch pattern exists in `admin-ui.tsx` `statusBgClasses` and elsewhere. Tokenising in one page without the rest creates inconsistency; Phase 8 extract is the right venue.

## P2 — `aria-live` polite on Copy button

- **Source:** Step 12a audit subagent — `src/app/admin/audit/CopyIdButton.tsx:45`
- **Verbatim:** "Success state is announced by the Sonner toast; the button only swaps a `Copy` icon for `Check`. `aria-live` on a button announces every label/icon change."
- **Defer to:** Phase 7
- **Why deferred:** Minor a11y cleanup; routed with the broader Phase 7 a11y pass.

## P3 — mono font, undefined CSS-var fallbacks, missing skeleton, summary desktop height, end-of-log localisation

- **Source:** Step 12a audit subagent — 5 P3 findings
- **Defer to:** Phase 7 polish pass
- **Why deferred:** P3 routing per recipe ("P3 — Polish — minor, fix when time allows").

## Critique commentary points (not P-level findings)

- Shared `EmptyState` Lucide line-icon reads SaaS-default vs DESIGN.md §5 illustrated empty state — same finding as Phase 6 dashboard/staff/availability deferrals; Phase 7 should commission the illustration set.
- Per-card footer triplet (Copy event ID + Copy target ID + Open booking) reads as 300 identical Ghosts across 100 rows — Phase 7 could fold the two copy commands into a trailing `more-horizontal` menu.
- Mobile filter sheet uses live-apply rather than the specced "Apply filters" Secondary — Phase 7 should re-evaluate after operator usability testing.
- Toast variant is default Sonner white rather than Confirmed-family green — Phase 7 should sweep all toast variants.
