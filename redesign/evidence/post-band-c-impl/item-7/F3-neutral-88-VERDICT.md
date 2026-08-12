# F3-neutral-88 — Adversarial Verification Verdict

**Verdict: DEFECTIVE**

All eight checklist items were run against the real files
(`src/styles/tokens.css`, `src/app/admin/audit/AuditEventCard.tsx`,
`src/app/admin/audit/AuditFilterStrip.tsx`, `src/app/admin/components/AdminTopNav.tsx`,
`src/app/admin/emails/page.tsx`, `src/app/admin/emails/templates/components/LivePreview.tsx`,
`src/app/admin/clients/[clientId]/page.tsx`, `src/components/ui/input.tsx`,
`scripts/verify-admin-token-contrast.mjs`), not against the proposal's prose. The mechanical
substitutions themselves are clean — byte-identity, find-string exactness, line numbers, role
agreement, dark-value direction and ratio arithmetic all check out for all four tokens. The
proposal fails on two things it did not itself check: (1) minting `--admin-page` under its
existing "broken" name silently repaints a *second*, currently-correct call site the proposal's
own rationale quotes but never adds to its edit list — the exact "unasked question" class of
defect this review exists to catch (BLOCKER), and (2) none of the four tokens' schema entries
account for `tokens.css`'s own mandatory four-block placement, which is concretely reachable via
a `print:!open` panel that uses one of the four new tokens (MAJOR).

## Checklist results

1. **Light byte-identity** — PASS, all four. Confirmed byte-identical (Tailwind `_`→space)
   against the literal at every site:
   - `--admin-page` `oklch(97.8% 0.006 88)` ⇔ `AuditEventCard.tsx:231`, `AdminTopNav.tsx:529`, `:804`.
   - `--admin-card-bg` `oklch(99.2% 0.004 88)` ⇔ `AuditFilterStrip.tsx:382`, `LivePreview.tsx:194`.
   - `--admin-badge-bg` `oklch(99.5% 0.003 88)` ⇔ `clients/[clientId]/page.tsx:656`, `:888`.
   - `--admin-avatar-bg` `oklch(96% 0.012 88)` ⇔ `emails/page.tsx:716`, `:909`.
   - `--admin-surface-input` dead-fallback drop: `input.tsx:27`'s fallback literal
     `oklch(98.5%_0.005_88)` is byte-identical to the token's own value in all four `tokens.css`
     blocks (`:root`/dark/light/print all declare `oklch(98.5% 0.005 88)`), and the token is
     unconditionally declared in `:root` (inherited by every element, including `/booking/manage`
     via `<Input>`), so the fallback provably can never fire. Dropping it is a genuine no-op.

2. **Role agreement** — PASS. Every site is a `bg-` (or `shadow-[...]` ring-gap) utility taking a
   `-bg`/`-page`/`-card-bg`/`-badge-bg`/`-avatar-bg` background-role token; no `text-` site takes
   a bg token or vice versa. Independently confirmed `--admin-on-primary` is near-white in light
   (`oklch(99.5% 0.003 88)` → rgb 254,253,251) and near-**black** in dark
   (`tokens.css:392`, `oklch(18% 0.012 88)` → rgb 20,17,12) — the proposal's correction of the
   brief's "renders a near-white panel in dark mode" claim is right, the brief's claim is wrong.
   Also confirmed the concrete reason `--admin-badge-bg` must NOT alias `--admin-on-primary`:
   `clients/[clientId]/page.tsx:888`'s count-pill already sets `!text-[var(--admin-on-primary)]`
   on the same element the new bg token decorates — reusing on-primary as the fill too would make
   the pill's own text and (translucent) background the same source colour.

3. **Find-string exactness** — PASS, all 8 real sites (excludes the dead-fallback and the
   uncounted second `--admin-page` site, both handled separately below): each `find` string
   occurs exactly once on its stated line, including the `,_oklch(...)` underscore-after-comma in
   `AuditEventCard.tsx:231` (present) vs. its correct *absence* in `input.tsx:27`'s
   `--admin-surface-input,oklch(...)` (no space in source, proposal got this subtlety right), and
   the `/30` opacity suffix at `clients/[clientId]/page.tsx:888`.

4. **Line drift** — PASS. All 10 stated lines (231, 529, 804, 382, 194, 656, 888, 716, 909, 27)
   re-read and confirmed current.

5. **Dark-value direction** — PASS, all four. Each new dark value is a byte-identical copy of the
   `nearestExistingFamily`'s dark declaration (`--admin-page` ⇔ `--admin-canvas`'s
   `oklch(17% 0.008 88)`; `--admin-card-bg` ⇔ `--admin-panel`'s `oklch(22% 0.008 88)`;
   `--admin-badge-bg` ⇔ `--admin-action-outline-bg`'s `oklch(22% 0.008 88)`; `--admin-avatar-bg`
   ⇔ `--admin-panel-muted`'s `oklch(26% 0.008 88)`), all following the file's universal
   hue-88 background shape (light near-white → dark near-black). No wrong-direction defect.

6. **Ratio arithmetic** — PASS, all four, recomputed with the shipped helpers themselves
   (`resolveColour`/`contrastRatio`/`parseTokensCss` imported live from
   `scripts/verify-admin-token-contrast.mjs`, run from the system temp dir). Critically, all four
   `measuredRatio` values are computed against the **dark** theme scope (matching the file's own
   established convention that `--admin-danger-solid`/`--admin-warning-solid`/
   `--admin-sparkline-stroke` carry their ratio comment only on the dark declaration):
   - `--admin-page` vs `--admin-heading` (dark): computed **17.079:1**, claimed 17.08 — match.
   - `--admin-card-bg` vs `--admin-body` (dark): computed **12.932:1**, claimed 12.93 — match.
   - `--admin-badge-bg` vs `--admin-status-confirmed-text` (dark): computed **12.972:1**, claimed
     12.97 — match. (In light scope this pair is 16.30:1, confirming the proposal measured dark,
     not light, exactly as its own "recommend inlining only on the dark declaration" note implies.)
   - `--admin-avatar-bg` vs `--admin-primary` (dark): computed **7.345:1**, claimed 7.34 — match.
   - All four `ratioAgainst` tokens (`--admin-heading`, `--admin-body`,
     `--admin-status-confirmed-text`, `--admin-primary`) exist in `tokens.css`. No ratio off by
     more than 0.15.

7. **Completeness** — PASS. Re-grepped every literal across `src/` (not just the admin/UI dirs):
   `97.8% 0.006 88` ×3, `99.2% 0.004 88` ×2, `99.5% 0.003 88` ×2, `96% 0.012 88` ×2,
   `98.5% 0.005 88` ×1 (admin-scoped) — 10 sites total, exactly matching the proposal's
   `occurrences` fields and its own site lists, with no extra or missing sites for the literal
   strings themselves. (The one hit outside `src/` — `design_handoff_area_pages/prototype/tokens.css`
   — is an unrelated, unconsumed design-handoff mockup file, correctly out of scope.)

8. **The unasked question** — **FAIL, twice.**

   **(a) BLOCKER — `AuditEventCard.tsx:195`, a second, unaddressed `--admin-page` reference.**
   `grep -n -- "--admin-page" src/` returns exactly two hits in the whole codebase, both in the
   same file:
   - `:195` — `bg-[var(--admin-page,_var(--admin-panel))]` (the audit-log "target type" chip)
   - `:231` — `bg-[var(--admin-page,_oklch(97.8%_0.006_88))]` (the "before/after" panel — the only
     one in the proposal's `sites` array)

   The proposal's own `literals[].justification` text *names* line 195
   ("`AuditEventCard.tsx:195` already references a nonexistent `--admin-page` token by name...
   fixes the phantom-token dark-mode defect at :195 as a side effect, with zero code change
   needed there") but never adds it to `sites`, never verifies it, and never counts it. That
   characterization is backwards: nothing is broken at `:195` today. Because `--admin-page` is
   currently undefined everywhere, CSS's `var()` fallback rule means `:195` reliably falls back to
   `var(--admin-panel)` in **every** theme — i.e. it already renders correctly and consistently
   with every other `--admin-panel` surface in the file. The instant `--admin-page` is declared in
   `tokens.css` (which minting it, as instructed, requires), the fallback stops firing anywhere in
   the DOM, and `:195` silently repaints from `--admin-panel`'s colour to the new,
   visually-distinct `--admin-page` colour, in a component the proposal never edited:
   - light: rgb(255,254,250) → rgb(249,248,243)
   - dark: rgb(28,26,22) → rgb(17,15,11) (a visibly darker chip background)

   (Verified with the shipped helpers: `text-[var(--admin-body)]` on this chip still clears AA in
   both themes before and after — 12.09/11.47 light, 12.93/14.25 dark — so this is not a WCAG
   regression, but it *is* exactly the kind of untracked, uncounted substitution item 1's framing
   warns about: an 11th silently-affected site the proposal's `occurrences` totals, `sites` arrays
   and "583 substitutions" control never account for.)

   **(b) MAJOR — missing print-block placement, concretely reachable via `print:!open`.**
   `tokens.css` documents at length (its own comments, e.g. lines 336–368 and 617–624) that every
   `--admin-*` token must be explicitly declared in all **four** blocks — `:root`,
   `[data-theme="dark"]`, `[data-theme="light"]`, and `@media print` — specifically so that
   "an open dialog would [not] print its dark surface." The proposal's schema supplies only
   `lightValue`/`darkValue` per token and never mentions the print block at all. Applied literally
   (light → `:root`, dark → `[data-theme="dark"]` only), the four new tokens would be silently
   absent from the `@media print` override, meaning an admin using dark theme who prints a page
   using one of these tokens gets the live dark value instead of the file's guaranteed
   print-is-always-light behaviour. This is not hypothetical: `AuditEventCard.tsx:223`
   (`<details className="group mt-3 print:!open" ...>`) forces open the exact `<details>` whose
   child at `:231` carries the new `--admin-page` background — so printing that audit event card
   while in dark theme would print a near-black panel, wasting toner and failing the file's own
   documented print guarantee.

## Corrections to the proposal

None of the individual token math, byte-identity, or find/replace instructions needed correcting
— all ten sites' `find` strings, line numbers and light values are exactly right as written. The
defects are both omissions: a missing eleventh site (`AuditEventCard.tsx:195`) that must either
be added to `--admin-page`'s edit plan (with its own reviewed before/after) or be used as the
reason to reject the "reuse the broken name" naming rationale entirely, and a missing print-block
placement instruction for all four tokens.

## Findings

1. **[BLOCKER]** `src/app/admin/audit/AuditEventCard.tsx:195` — minting `--admin-page` (as
   `--admin-page`'s own `literals[]` entry instructs) silently repaints this untouched, unlisted
   site from `--admin-panel`'s colour to the new token's colour in both themes, because the
   `var(--admin-page, var(--admin-panel))` fallback stops firing once `--admin-page` exists
   anywhere in `tokens.css`. Failure scenario: apply the proposal exactly as written (add the
   three listed sites, mint `--admin-page` in `tokens.css`) → the audit-log "target type" chip's
   background silently shifts from `#fffefa`/`oklch(22% 0.008 88)` to
   `oklch(97.8% 0.006 88)`/`oklch(17% 0.008 88)` with zero corresponding code diff, zero entry in
   `occurrences`, and zero review — an 11th, uncounted substitution against the frozen light-mode
   control. Fix: either add `AuditEventCard.tsx:195` as a fourth `--admin-page` site (replacing
   `var(--admin-panel)` with the literal `--admin-panel` reference it currently falls back to, so
   the rename is a no-op there) or drop the "reuse the phantom name" naming rationale and mint the
   background token under a name that does not collide with this pre-existing, currently-correct
   fallback reference.

2. **[MAJOR]** `src/styles/tokens.css` (all four theme blocks) / `AuditEventCard.tsx:223` — the
   proposal's `lightValue`/`darkValue` schema for all four new tokens omits the `@media print`
   (and `[data-theme="light"]`) placement that every existing `--admin-*` token carries, per the
   file's own documented convention. Failure scenario: an admin user in dark theme prints the
   audit event card whose `<details className="...print:!open">` (`AuditEventCard.tsx:223`)
   forces open the `--admin-page`-backed panel at `:231` → without a matching entry in the
   `@media print` block, the printed page renders the dark value (`oklch(17% 0.008 88)`, a
   near-black panel) instead of the light value tokens.css's print rule exists specifically to
   guarantee. Fix: when applying this family, explicitly add all four new tokens to `:root`,
   `[data-theme="dark"]`, `[data-theme="light"]`, and `@media print` (light value in
   root/light/print, dark value only in the dark block), matching the placement of every other
   token already in the file.
