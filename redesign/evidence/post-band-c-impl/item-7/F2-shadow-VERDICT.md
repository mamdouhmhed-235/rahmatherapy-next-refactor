# F2-shadow — adversarial verification verdict

Verified against the actual repo at HEAD `04e1b0c` (2026-08-12), not against the
proposal's own prose. Method: read every one of the 16 cited sites at its
stated line, diffed the `find` string byte-for-byte with a throwaway Node
script (exact-match + occurrence counts), read `src/styles/tokens.css` blocks
at every cited line, read `scripts/verify-admin-token-contrast.mjs` in full,
cross-checked literal spellings against `TAIL-CENSUS.md`, and grepped the
whole `src/` tree (not just `src/app/admin`) for the shared literal to check
for missed sites or public-page/test exposure.

## Verdict: PARTIALLY_DEFECTIVE

## What checks out

- **Site targeting (16/16)**: every `find` string occurs, byte-for-byte
  (including underscore-vs-space and spaced-vs-unspaced-slash spelling), at
  the exact cited line, exactly once on that line — no line drift, no
  ambiguity. Confirmed mechanically, not by inspection.
- **Completeness**: grepping all of `src/` for the hue-155/C=0.073 shadow
  literal returns exactly the same 16 sites, 7 distinct alphas
  (2+4+3+1+4+1+1 = 16), matching the family's stated occurrence count. No
  eighth alpha exists anywhere in the tree, and nothing sits outside
  `src/app/admin/**` (no customer-facing page, e.g. `/booking/manage`, is
  affected).
- **Role agreement**: all 16 sites are `shadow-[...]` / `hover:shadow-[...]`
  / `group-hover:shadow-[...]` Tailwind arbitrary-value classes, all mapped
  to shadow tokens. No text/bg utility is taking a shadow token or vice
  versa.
- **Mechanism**: all 16 sites are static `className`/template-literal
  strings (Tailwind JIT arbitrary values), not inline `style` objects — the
  existing codebase already uses `shadow-[var(--admin-shadow-overlay)]`
  (`ClientCreateForm.tsx:507`), so `var()` inside `shadow-[...]` is a proven
  pattern here.
- **Dark-value direction**: confirmed the existing sibling family's
  documented dark rule at `tokens.css:447-449` (tint dropped to near-black,
  alpha raised) and its actual light→dark alpha pairs (0.04→0.45, 0.06→0.45,
  0.08→0.50, 0.12→0.60, 0.55→0.85 — read directly from `tokens.css:207-210`
  and `:447-453`, matching the proposal's citations exactly). The 7 new
  dark alphas (0.45→0.85) are monotonic with the light ladder and stay
  inside that envelope — correct shape, honestly not over-precise.
- **Ratio handling**: read `verify-admin-token-contrast.mjs` in full.
  `RATIO_COMMENT_RE` only fires on an explicit inline `/* N.NN:1 vs X */`
  comment (none proposed), and `derivePairs()`'s `fgLike` sweep is
  `/text|body|heading|muted/i` against token *names* — none of the 7
  `--admin-shadow-*` names match. The `measuredRatio: 0` placeholders are
  therefore correctly "not applicable," not a fabricated number, and no
  `ratioAgainst` names a token that doesn't exist (`--admin-shadow-subtle`,
  `-card`, `-hover`, `-overlay` all exist, confirmed at `tokens.css:207-210`).
- **No test/print/inline-style fallout**: no `e2e/**` or `*.test.*` file
  references any of the 16 literal strings; the existing shadow family is
  already redeclared with light values in the `@media print` block
  (`tokens.css:690-693`) and the `[data-theme="light"]` block
  (`tokens.css:574-577`), matching the proposal's placement plan.
- **Naming precedent**: `--admin-danger-bg-strong`, `--admin-warning-bg-strong`,
  `--admin-success-bg-strong` all exist (`tokens.css:113-115` etc.),
  supporting the `-strong` suffix claim.

## Confirmed defect

**LIGHT BYTE-IDENTITY fails for 3 of the 7 tokens** — `--admin-shadow-sheet`,
`--admin-shadow-selected`, `--admin-shadow-active-strong`.

The proposal's own notes disclose that two literal spellings exist verbatim
in source: `155_/_0.NN` (spaced, Tailwind underscore-escaped) for the
0.04/0.06/0.08/0.18 sites, and `155/0.NN` (no separator at all) for the
0.12/0.25/0.28 sites. The `find`/`replace` pairs correctly preserve each
site's actual spelling. But the **`lightValue` field** (and the matching CSS
in `F2-shadow.md`'s "New declarations" block, which is what actually gets
written into `tokens.css`) normalizes all 7 tokens to the *spaced* form,
including the three that should be unspaced:

| token | site | actual literal (source) | proposed `lightValue` | byte-identical after `_`→` `? |
|---|---|---|---|---|
| `--admin-shadow-sheet` | `ManualBookingForm.tsx:2395` | `oklch(23%_0.073_155/0.12)` | `oklch(23% 0.073 155 / 0.12)` | **no** — extra spaces around `/` |
| `--admin-shadow-selected` | `ManualBookingForm.tsx:1894` | `oklch(23%_0.073_155/0.25)` | `oklch(23% 0.073 155 / 0.25)` | **no** — extra spaces around `/` |
| `--admin-shadow-active-strong` | `dashboard-filters-client.tsx:355` | `oklch(23%_0.073_155/0.28)` | `oklch(23% 0.073 155 / 0.28)` | **no** — extra spaces around `/` |

Independently confirmed against `TAIL-CENSUS.md` (lines 522, 532, 595), which
uses the unspaced form (`oklch(23% 0.073 155/0.25)` etc.) as the canonical
literal spelling for exactly these three — the census disagrees with the
proposal's own `lightValue` field.

**Failure scenario**: the value that would actually land in `tokens.css` for
these three tokens is not byte-identical to what the underscore-conversion
rule requires. **Impact is nil in practice** — CSS's `oklch()` grammar treats
the `/` alpha separator as whitespace-insensitive on both sides (the same way
`rgb(0 0 0/50%)` and `rgb(0 0 0 / 50%)` are the same value), and the current
uncommitted-literal code already renders both spellings identically today.
So this does not "move light mode." It does, however, fail the explicit
byte-identity requirement as written, and is a genuine, mechanically
verifiable inconsistency between the proposal's declared value and the
literal it claims to replace for 3 of 7 tokens.

**Fix**: change `lightValue` (and the corresponding line in
`F2-shadow.md`'s CSS block) for these three tokens to the unspaced form:
`oklch(23% 0.073 155/0.12)`, `oklch(23% 0.073 155/0.25)`,
`oklch(23% 0.073 155/0.28)`.

## Minor observation (not a defect)

`emails/page.tsx:705` and `emails/page.tsx:903` share the byte-identical
`find` string (`hover:shadow-[0_1px_4px_oklch(23%_0.073_155_/_0.08)]`), so it
occurs twice in that one file (once per line). A naive whole-file
string-replace would touch both — which is correct here, since both sites
are mapped to the same token (`--admin-shadow-row-hover`), so the outcome is
identical either way. Not a defect, just worth an implementer's awareness
that this specific `find` string is not unique at the file level (only at
the line level, which is what was actually checked).
