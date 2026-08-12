# F8-info-230-247 — Adversarial Verification Verdict

**Verdict: PARTIALLY_DEFECTIVE**

All eight checklist items were run against the real files (`src/styles/tokens.css`,
`src/components/ui/input.tsx`, `src/app/admin/clients/page.tsx`,
`scripts/verify-admin-token-contrast.mjs`, `redesign/evidence/post-band-c-impl/item-7/TAIL-CENSUS.md`),
not against the proposal's prose. The mechanical substitutions (find-strings, line numbers,
byte-identity, ratio arithmetic, role agreement, completeness) all check out correctly. Two
issues survive verification: one MAJOR (an undisclosed-as-a-decision visual activation bundled
inside what is presented as a pixel-neutral substitution) and one MINOR (a false "closest in
the whole table" superlative in the rationale).

## Checklist results

1. **Light byte-identity** — PASS. `lightValue: "oklch(60% 0.08 247)"` is byte-identical to the
   literal at `clients/page.tsx:1121`. Confirmed no existing token in `tokens.css` is
   byte-identical to either `oklch(60% 0.08 247)` or `oklch(47% 0.095 230)`
   (`grep -n "60% 0.08 247\|47% 0.095 230" src/styles/tokens.css` → no matches).

2. **Role agreement** — PASS. `--admin-hover-mist-border` (a `-border` suffixed name) is applied
   at a `hover:border-b-[...]` site. Name and role agree.

3. **Find-string exactness** — PASS, all three sites, confirmed unique per line:
   - `input.tsx:36` — `focus-visible:border-[var(--admin-focus,oklch(47%_0.095_230))]` — exact,
     single occurrence in the file.
   - `input.tsx:38` — `focus-visible:ring-[var(--admin-focus,oklch(47%_0.095_230))]/30` — exact
     substring of the real line (`"focus-visible:ring-2 focus-visible:ring-[...]/30"`), single
     occurrence, not confused with the separate `ring-2` token on the same line.
   - `clients/page.tsx:1121` — `hover:border-b-[oklch(60% 0.08 247)]` — exact, single
     occurrence on the line (not confused with the earlier `border-b border-b-transparent`).

4. **Line drift** — PASS. Re-grepped: `input.tsx:36`, `input.tsx:38`,
   `clients/page.tsx:1121` all confirmed current.

5. **Dark-value direction** — PASS. `--admin-border-form` inverts light 55%→dark 58% (a small
   lighten, not a flip). The candidate `60%→63%` follows the identical shape (small lighten).
   Recomputed independently: since the *background* it decorates (`--admin-hover-mist`) itself
   flips hard (95.5%→27%), a border held near mid-tone stays legible against both extremes —
   verified light-literal-vs-light-panel = 3.87:1, dark-candidate-vs-dark-panel = 4.99:1,
   dark-candidate-vs-dark-canvas = 5.50:1, all comfortably >3:1. No wrong-direction defect.

6. **Ratio arithmetic** — PASS, recomputed with the shipped helpers themselves
   (`resolveColour`/`contrastRatio`/`parseTokensCss` imported live from
   `scripts/verify-admin-token-contrast.mjs`, script run from the system temp dir, not
   reimplemented):
   - `oklch(60% 0.08 247)` → `#5885ae`; `oklch(63% 0.065 247)` → `#698daf`.
   - light literal vs light `--admin-hover-mist` (`#e5f2ff`) = **3.4336:1** — matches claim.
   - dark candidate vs dark `--admin-hover-mist` (`#1f272f`) = **4.3394:1** → rounds to
     **4.34:1** — matches claim and the `measuredRatio: 4.34` field exactly.
   - Delta-L (58/55 = 1.0545×) and delta-C (0.018/0.022 = 0.818×) from `--admin-border-form`,
     applied to the literal (60×1.0545=63.27→63; 0.08×0.818=0.0655→0.065), reproduce the
     claimed dark value exactly.
   - The `--admin-primary`/40%-over-`--admin-hover-mist` alpha-composite claim (`#8fb7d2`) was
     independently hand-verified: 0.4×(15,94,142) + 0.6×(229,242,255) = (143.4, 182.8, 209.8) →
     `#8fb7d2`. Matches.
   - `ratioAgainst: "--admin-hover-mist"` exists in `tokens.css`. No off-by-more-than-0.15 ratios found.

7. **Completeness** — PASS. Family occurrences: 2 (literal 1) + 1 (literal 2) = 3, matching the
   family header ("2 distinct literals, 3 occurrences") and `TAIL-CENSUS.md`'s independent
   per-literal counts (`oklch(47% 0.095 230)` — 2, `oklch(60% 0.08 247)` — 1). A broad
   codebase-wide regex sweep for any other hue-230/247 literal
   (`grep -rnoE '\-\[oklch\([0-9.]+% [0-9.]+ [0-9.]+[^]]*\]' src`, plus a plain-text sweep for
   `230)`/`247)` outside `tokens.css`'s own token declarations) turned up nothing beyond the
   three sites already covered. No missing literal.

8. **The unasked question — two findings survive:**

   **MAJOR — the "new-token-pair" substitution silently activates a previously dead visual
   effect, contradicting the family's own no-pixel-movement rule.**
   `src/app/admin/clients/page.tsx:1121` writes `hover:border-b-[oklch(60% 0.08 247)]` with a
   **literal space**, not Tailwind's required underscore escaping. Verified independently (not
   just trusting the proposal's own note):
   - `grep -rnoE '\-\[oklch\([0-9.]+% [0-9.]+ [0-9.]+[^]]*\]' src --include=*.tsx --include=*.ts`
     returns **exactly one hit in the entire src tree** — this site. Every other oklch literal
     inside a Tailwind bracket utility in the codebase correctly uses underscores.
   - The existing (stale but present) dev build chunk
     (`.next/dev/static/chunks/src_app_globals_css_*.css`) contains **zero** occurrences of a
     compiled rule for this value, consistent with Tailwind's scanner never having produced a
     matching utility for it.
   Consequence: today, hovering a client-list row shows **no** bottom-border color change (the
   resting `border-b-transparent` never gets overridden). After the prescribed substitution —
   `hover:border-b-[var(--admin-hover-mist-border)]` — the `var()` reference contains no
   whitespace, so it **will** compile, and hovering a row will show a visible blue-grey bottom
   border for the first time in production. The literal's *byte value* is preserved (satisfying
   check #1), but the *rendered pixels* are not: a previously invisible hover accent becomes
   visible. This is the exact class of change the proposal's own notes rule out elsewhere —
   its rationale for rejecting `--admin-primary`/40 reuse is explicitly "would move light-mode
   pixels (forbidden by rule 2)" — yet the chosen path here also moves light-mode pixels (from
   "no visible hover border" to "visible hover border"), just via a different mechanism
   (fixing dead CSS as a side effect of tokenizing it, rather than via a different colour). The
   proposal's own note 1 does disclose this as a "known, deliberate consequence," but disclosure
   in prose is not the same as it being a safe, in-scope mechanical substitution: this decision
   introduces a new, never-shipped, never-visually-reviewed hover affordance on a production
   admin list page, and does so as a side effect of a token-hygiene pass rather than as its own
   reviewed change. No test in `e2e/` (checked `e2e/admin-contrast.spec.ts` — no `clients`,
   `hover-mist`, or `border-b` references) and no visual-regression baseline in this repo
   (searched for `*.snap` / `*-snapshots` — none exist) would catch this, so it would ship
   unverified. Recommend splitting this into two explicit, separately-approved changes: (a) the
   token mint/substitution, and (b) an explicit "this also fixes dead CSS and makes a new hover
   border visible for the first time" sign-off — not one bundled diff.

   **MINOR — "the closest match in the whole table" is false as stated.**
   The rationale claims `--admin-border-form`'s starting lightness (55%) is "the closest match
   in the whole table" to the literal's 60%. Recomputed by extracting every token's light-mode
   `oklch(L% ...)` value from `TAIL-CENSUS.md`'s 94-token table and ranking by `|L−60|`:
   `--admin-chart-status-unknown` has light value `oklch(60% 0.05 280)` — L=60% **exactly**,
   diff=0 — strictly closer than `--admin-border-form`'s diff=5. The claim only holds if
   silently restricted to border-role tokens (which the role-matching half of the sentence does
   argue for); as a literal "closest in the whole table" statement it is checkable and wrong.
   This does not change the final derivation (role-matching is a defensible tie-breaker, and
   `--admin-chart-status-unknown` is a semantic chart-legend colour, not a plausible border
   model), but it is an unverified superlative that should not have been asserted as fact.

## Other checks performed, no defect found

- Confirmed `--admin-focus` is declared at bare `:root` (tokens.css:98) with no gating selector,
  redeclared with equal specificity in `[data-theme="dark"]` (:394), `[data-theme="light"]`
  (:529), `@media print` (:645); confirmed zero `@property` registrations anywhere in `src/`
  (`grep -rn "@property" src` → no matches), so the `var(..., fallback)` on `input.tsx:36/38`
  provably never fires in any theme, on any route.
- Confirmed the chain `globals.css:4` (`@import "../styles/tokens.css"`, unconditional) →
  `layout.tsx:5` (`import "./globals.css"`, root layout, unconditional) holds as claimed.
- Confirmed `/booking/manage` (`src/app/booking/manage/ManageBookingForms.tsx:6`) does import
  and render `Input` from `@/components/ui/input` — the proposal's claim that this public route
  is in scope for the fallback-dead-code argument is correct, not hypothetical.
- Confirmed the `[data-theme]` scoping selector lives on an admin wrapper
  (`src/app/admin/components/ThemeProvider.tsx`), not `<html>`, matching tokens.css's own
  comment (lines 304–309) cited verbatim by the proposal — text matches byte-for-byte on
  spot-check.
- Confirmed `scripts/verify-admin-token-contrast.mjs` exports `resolveColour`, `contrastRatio`,
  `oklchToRgb`, `parseTokensCss` exactly as claimed, and that `parsed.scopes.{light,dark}` /
  `parsed.tokens[name].{light,dark}` is the correct shape to drive them (the proposal's own
  claimed reuse is reproducible without modification).
- Confirmed the `/* 4.34:1 vs hover-mist */` comment format matches the existing convention in
  `tokens.css` (`grep -n ":1 vs " src/styles/tokens.css`), including the short-form (no
  `--admin-` prefix) token reference, which `normalizeTokenRef` in the shipped script correctly
  expands.
- No test (`vitest`/`playwright`) references either literal or the new token name; no
  visual-snapshot infrastructure exists in this repo to catch the hover-activation change noted
  above.
