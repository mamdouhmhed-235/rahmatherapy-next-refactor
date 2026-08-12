# F1-scrim — adversarial verification verdict

Verified against the actual repo at HEAD `04e1b0c` (2026-08-12), not against the
proposal's own prose. Method: read every one of the 18 cited sites at its
stated line; `git grep`'d the whole tracked tree (not just `src/app/admin`)
for all three literals to check for missed/extra sites, tests, and
public-page exposure; read `src/styles/tokens.css` at every cited insertion
point and existing-token reference; read `scripts/verify-admin-token-contrast.mjs`
in full (not just skimmed); wrote an independent throwaway Node script
(`verify-f1-scrim.mjs`, scratchpad, not committed) that **imports the shipped
`oklchToRgb`/`contrastRatio`/`resolveColour`/`parseTokensCss` directly from
the real file** (no copy-paste) to recompute every `measuredRatio`; and
byte-diffed the proposing agent's own scratch script
(`scrim-calc.mjs`, found already sitting in the shared scratchpad) against the
shipped source to confirm its copied colour-math functions are unmodified.

## Verdict: PARTIALLY_DEFECTIVE

Every *mechanical* check (byte-identity, role, find-string, line numbers,
dark-direction shape, ratio arithmetic, completeness, reachability) passed.
The one confirmed defect is in the proposal's own **rationale**, not in the
tokens or the 18 substitutions — see "Confirmed defect" below for why that
still matters enough to withhold a clean SOUND.

## What checks out

- **Light byte-identity (3/3 tokens, 18/18 sites)**: every `lightValue`
  converts (`_`→` `) to a string byte-identical to the literal at its site.
  Confirmed by direct `grep`/`git grep` re-read of all 18 lines, not by
  trusting the proposal's own table:
  - `oklch(12%_0.01_165)` — all 16 `--admin-scrim` sites match exactly.
  - `oklch(12%_0.014_155)` — the 1 `--admin-scrim-alt` site
    (`attention-group-client.tsx:145`) matches exactly.
  - `oklch(11%_0.014_155_/_0.45)` — the 1 `--admin-scrim-dialog` site
    (`ClientCreateForm.tsx:507`) matches exactly.
- **Role agreement (18/18)**: every site is a plain `bg-[...]` or, for the
  one native `<dialog>` (`ClientCreateForm.tsx:507`, confirmed by reading the
  element — it really is `<dialog ref={...}>`, not a `<div>`), a
  `backdrop:bg-[...]` Tailwind class. All three token names are `--admin-scrim*`
  — no `-on-`/foreground token is doing background duty or vice versa, and
  the `text-` sighting of the *unrelated* literal `oklch(11%_0.014_155)`
  (no alpha) at `src/components/ui/input.tsx:108` is correctly out of this
  family (see "Unasked question" below — it's not a scrim site at all).
- **Find-string exactness (18/18)**: re-read every line from source. Every
  `find` string occurs exactly once on its line, with no ambiguity (none is a
  prefix of a longer bracketed expression — the `/30`, `/35`, `/40` opacity
  suffixes always sit *outside* the closing `]`, exactly as the proposal
  describes, and are correctly left untouched by every `find`/`replace`
  pair). Repo-wide `git grep` for all three literals returns **exactly** 18
  hits, all at the cited files — no 19th site, no site inside `e2e/`, no
  site inside a `*.test.*` file, no site outside `src/app/admin/**`.
- **Line drift**: none. All 18 cited line numbers match current source
  exactly (re-confirmed with fresh `grep -n`, not the census).
- **Completeness**: 16 + 1 + 1 = 18, matching the stated family total and
  `TAIL-CENSUS.md`'s own per-literal counts (`TAIL-CENSUS.md:109-132`). No
  literal in the family is missing an entry; no entry names a literal with
  zero real sites.
- **Ratio arithmetic — independently recomputed, not just re-derived from
  the proposal's own numbers**: imported `oklchToRgb`/`contrastRatio`/
  `resolveColour`/`parseTokensCss` straight from
  `scripts/verify-admin-token-contrast.mjs` and recomputed each
  `measuredRatio` from the proposal's own stated methodology
  (alpha-composite the dark candidate over dark `--admin-canvas` at the
  site's real alpha, then WCAG-ratio the composite against dark
  `--admin-panel`, both pulled live via `parseTokensCss` rather than
  hand-copied):
  | token | claimed `measuredRatio` | independently recomputed | delta |
  |---|---|---|---|
  | `--admin-scrim` (alpha 0.35) | 1.14 | 1.140 | 0.000 |
  | `--admin-scrim-alt` (alpha 0.35) | 1.14 | 1.140 | 0.000 |
  | `--admin-scrim-dialog` (alpha 0.75) | 1.18 | 1.181 | 0.001 |

  All three are exact to 3 decimals — nowhere near the 0.15 tolerance.
  `ratioAgainst: "--admin-panel"` exists in `tokens.css` in both themes
  (confirmed via `parseTokensCss` output, not assumed). The 0.35 "dominant
  site alpha" claim for `--admin-scrim` also checks out: 13 of the 16 sites
  are `/35`, 1 is `/30`, 1 is `/40` (counted directly from the 16 lines).
- **Dark-value direction**: `--admin-shadow-hover` / `--admin-shadow-overlay`
  really do go hue-247→hue-neutral, alpha 0.08→0.5 / 0.12→0.6 / 0.06→0.45 in
  dark (`tokens.css:209-210` vs `:452-453`, re-read directly) — the cited
  "nearest sibling" shape is real, not misquoted. The three new dark values
  (hue-neutral `oklch(0% 0 0)`, with alpha raised only where alpha is not
  externally frozen) move in the same direction: darker/more-opaque in dark
  mode, never a reversal. No case of a token lightening in dark when its
  sibling family darkens.
- **Mechanism precedent**: `bg-[var(--x)]/NN` (a CSS-var arbitrary value with
  an *external* Tailwind opacity modifier) is not a new pattern this proposal
  invents — it is already shipping today in the very same 16 files, e.g.
  `RoleMetadataForm.tsx:216` (`bg-[var(--admin-panel)]/95`) and
  `ApproveModal.tsx:153` (`hover:bg-[var(--admin-status-cancelled-bg)]/60`),
  both independently re-read and confirmed present. `backdrop:bg-[var(--x)]`
  with alpha baked into the var (no external modifier) is likewise a direct,
  mechanical analogue of `shadow-[var(--admin-shadow-overlay)]` already at
  `ClientCreateForm.tsx:507` on the very same element.
- **No test/print/public-page fallout ("the unasked question", mostly
  clean)**: none of the 18 sites' files (or the shared `BaseDialog` — traced
  to `@base-ui/react/dialog`'s own `Dialog` export, imported directly, not
  the unrelated `DialogBackdrop` wrapper in `src/components/ui/dialog.tsx`
  which uses `bg-foreground/25` and is a different component entirely) are
  imported anywhere outside `src/app/admin/**` — none reaches
  `/booking/manage` or any other customer page. No `*.test.*` or `e2e/**`
  file references any of the three literals or `--admin-scrim`. No
  `__snapshots__` directory exists in the repo. All three tokens are
  correctly re-declared with the same light value in `@media print`
  (confirmed the insertion targets exist in all four blocks:
  `tokens.css:239`/`471`/`591`/`704`, each still immediately followed,
  eventually, by `--admin-chart-status-confirmed`).

## Confirmed defect (in the rationale, not the substitution)

**The "authoring drift, not a deliberate design choice" framing for the
hue-155 tokens is checkably wrong**, and the proposal (JSON `rationale` for
`--admin-scrim-alt`: *"byte-different light literal only in hue (155 vs 165)
... imperceptible at this chroma, read as authoring drift rather than a
deliberate second design state"*; companion doc `F1-scrim.md:21-27` goes
further, calling 155 *"the hue every other now-retired 'clinic green' literal
in this codebase used"*) treats `oklch(12% 0.014 155)` and
`oklch(11% 0.014 155 / 0.45)` as accidental near-misses of the canonical
`oklch(12% 0.01 165)` scrim.

That is not what the rest of this repo says hue 155 at that chroma/lightness
is. `--admin-heading`'s light value is `#151b18`
(`src/styles/tokens.css:73`/`522`/`638`) — and `DESIGN.md:201` states this
exact colour *is* `oklch(11% 0.014 155)`, naming it **"Chronicle"**, the
live, currently-referenced text-primary/heading colour used across the
design system today (`DESIGN.md:12`, `DESIGN.json` `text-primary` canonical
value, and cited by name in seven different current briefs —
`B1-foundation-primitives-brief.md:275`, `clients-brief.md:212`,
`dashboard-owner-admin-brief.md:200`, `dashboard-therapist-brief.md:211`,
`login-brief.md:137`, `password-reset-brief.md:274` — none marked
deprecated). `--admin-scrim-dialog`'s light value,
`oklch(11% 0.014 155 / 0.45)`, is *literally* Chronicle at 45% alpha — not a
mistyped near-miss of `--admin-scrim`, but the brand ink colour used as a
translucent overlay, byte-for-byte. `--admin-scrim-alt`'s `oklch(12% 0.014 155)`
is one lightness-percent off the same colour. Nothing in this repo currently
calls hue 155 "retired."

**Failure scenario**: this mischaracterization doesn't move a single pixel
today — the mint still correctly keeps the byte-distinct literal as its own
token per the "one distinct light value = one token" rule, so no value in
`tokens.css` or any of the 18 sites is wrong as a *result* of this error. The
risk is downstream: a future maintainer who trusts "this is just authoring
drift, not deliberate" as the recorded design rationale (this is the
document `redesign/evidence/post-band-c-impl/item-7/F1-scrim.md` that gets
kept as the historical justification) may feel licensed to "clean up" by
merging `--admin-scrim-alt`/`--admin-scrim-dialog` into `--admin-scrim`
(normalizing hue 155→165) as a supposed typo fix — silently discarding what
the rest of the design system's own documentation says is a deliberate reuse
of the brand ink colour, and doing so with no dedicated review because the
proposal itself pre-authorized treating it as noise.

**Fix**: correct the "authoring drift" characterization in both the JSON
`rationale` fields and `F1-scrim.md` to note the hue-155 match against
`--admin-heading`/"Chronicle" — the *token-minting outcome* (three separate
tokens, since the literals are still byte-distinct) does not need to change,
only the stated reason for why a human should not casually merge them later.

## Minor observations (not scored as defects)

- **Ratio-comment-omission reasoning is not numerically self-consistent.**
  The proposal justifies skipping the inline `/* N.NN:1 vs X */` comment by
  saying the mechanical checker "would pass at ~1.14:1" if one were written.
  I recomputed what `verify-admin-token-contrast.mjs`'s own
  `resolveColour`/`contrastRatio` would actually produce for the *raw* dark
  literal against dark `--admin-panel` (that pipeline drops any `/alpha`
  suffix silently and never composites — confirmed by reading
  `resolveColour`'s regex at `verify-admin-token-contrast.mjs:99`, which
  captures only the first three `oklch()` numbers): `contrastRatio(oklch(0%
  0 0), panelDark) ≈ 1.209:1`, not ~1.14:1. The 1.14 figure is exclusively
  the proposal's own alpha-composited number; it is not what the shipped
  mechanical path would emit. This doesn't change the outcome (no comment is
  written either way, and `derivePairs()`'s `/text|body|heading|muted/i`
  sweep wouldn't auto-check `--admin-scrim` regardless — confirmed by reading
  `derivePairs`, `verify-admin-token-contrast.mjs:533-601`), but the stated
  justification for the omission cites a number the tool would not actually
  produce.
- **Insertion-point instruction is imprecise, cosmetically.** "Immediately
  after the existing `--admin-warning-solid-hover` declaration ... and
  before the `--admin-chart-status-*` block" is true in the light and print
  blocks (adjacent, `tokens.css:591`→`592`, `:704`→`705`) but in `:root` and
  `[data-theme="dark"]` there's an existing 4-line explanatory comment
  between them (`tokens.css:240-243`, documenting the chart-status block
  that follows it). Inserting literally "immediately after
  `--admin-warning-solid-hover`" lands the three new declarations ahead of
  that comment, separating it from the tokens it describes. No functional
  effect (CSS comments don't run), just a documentation-tidiness nit for
  whoever applies this mechanically.

## Scratch verification artefacts

- `verify-f1-scrim.mjs` (scratchpad, not committed) — imports the shipped
  functions directly and recomputes all three `measuredRatio` values plus a
  `resolveColour` sanity check on alpha-bearing oklch strings.
- Confirmed the proposing agent's own `scrim-calc.mjs` (already present in
  the shared scratchpad) has `oklchToRgb`/`linearToSrgb8`/
  `relativeLuminance`/`contrastRatio` byte-identical to the shipped
  `scripts/verify-admin-token-contrast.mjs` (diffed programmatically, not
  eyeballed) — its copy is faithful, so its own printed table is trustworthy
  as far as the colour math goes.
