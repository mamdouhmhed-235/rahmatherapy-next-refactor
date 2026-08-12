# CRITIQUE — LENS 3: tokens.css structural integrity

Reviewing `git diff 04e1b0c..c50cb6a` (eight commits) against `src/styles/tokens.css`
and the 47 site files it touches. Read-only review; no repo files were modified other
than this report.

## Verdict: SOUND

Every rule this lens was asked to check held up under direct, computed verification —
not just re-reading the authors' own comments. No structural defect in `tokens.css`
survived scrutiny.

## What I checked, and how

All checks below were done with throwaway scripts in the scratchpad directory that
`import()` the shipped `scripts/verify-admin-token-contrast.mjs` by file URL and reuse
its exported `parseTokensCss`, `resolveColour`, `contrastRatio`, `derivePairs` — no
colour maths reimplemented.

### 1. All 58 new tokens present in all four blocks, with the right value in the right block

Parsed `04e1b0c`'s `tokens.css` and `c50cb6a`'s `tokens.css` (via `git show`), diffed
the token-name sets, and confirmed exactly **58** new `--admin-*` custom properties
(matches the diff's own claim). For every one of the 58, I extracted the raw
declaration from each of the four brace blocks independently (`:root`,
`[data-theme="dark"]`, `[data-theme="light"]`, `@media print`) using the same
brace-matcher `parseTokensCss` uses internally, and checked:

- present in all four blocks — **58/58 present, 0 missing from any block**.
- `:root` value byte-identical to `[data-theme="light"]` value — **58/58 identical**.
- `:root` value byte-identical to `@media print` value — **58/58 identical**.
- dark value differs from the light triple (real inversion, not a copy-paste) —
  **57/58 differ**; the one exception is `--admin-email-preview-bg`
  (`oklch(99.2% 0.004 88)` in every block, including dark), which the diff's own
  comment documents as deliberate: it is the paper an outgoing email preview renders
  on, and stays white regardless of admin theme. Confirmed against its one call site
  (`src/app/admin/emails/templates/components/LivePreview.tsx:194`) — a template
  preview panel, consistent with the stated intent. Not a defect.

No token was found in three blocks. No token had a dark-shaped value leaking into a
light block, or vice versa.

### 2. No collision, displacement, duplication or reordering of existing tokens

Ran a name-collision check: all 58 new names are genuinely new — none collide with a
pre-existing `--admin-*` or `--notif-*` custom property. Diffed every pre-existing
`:root` declaration's value between `04e1b0c` and `c50cb6a`: **0 changed, 0 removed**.
Diffed the *order* of the 164 pre-existing `:root` tokens between the two commits
(filtering the new insertions back out): **order preserved for all 164**. Checked for
duplicate `--admin-*` declarations of the same name within any single block in the
final file: **0 found** in any of the four blocks.

### 3. `@media print` block placement and indentation

The print block's selector list (`:root, [data-theme="dark"], [data-theme="light"],
[data-admin-theme-root][data-theme="dark"] ~ *, [data-admin-theme-root][data-theme="light"] ~ *`)
is intact and unmodified (`tokens.css:953-957`). Every one of the 58 new tokens' print
declarations sits inside that nested block (lines 999-1119) at exactly 4-space
indentation — checked programmatically (`grep` for `--admin-` lines in the print block
range that do NOT start with exactly 4 spaces): **0 matches**, i.e. every line is
correctly indented. The `:root`/dark/light blocks' new declarations are all at the
file's outer 2-space indent: also checked programmatically, **0 mismatches**.

### 4. Ratio comments — parse correctness and numeric accuracy

Only two of the 58 new tokens carry a `/* N:1 vs X */` comment (both in the
`[data-theme="dark"]` block only): `--admin-button-primary-active` (`15.01:1 vs
on-primary`) and `--admin-danger-solid-active` (`12.37:1 vs on-primary`). Both match
`RATIO_COMMENT_RE` (`verify-admin-token-contrast.mjs:170`) cleanly. Recomputed both
independently with the shipped `resolveColour`/`contrastRatio`:
`--admin-button-primary-active` vs `--admin-on-primary` in the dark scope →
**15.01**, exact match to 2dp. `--admin-danger-solid-active` vs `--admin-on-primary`
in the dark scope → **12.37**, exact match. Running `node
scripts/verify-admin-token-contrast.mjs` end-to-end reports **`ratio-comment
mismatches: 0`** across the whole file (pre-existing comments included). Also spot-
checked the diff's own claim that none of the new *border*-family tokens
(`--admin-danger-border`, `--admin-danger-border-soft`,
`--admin-status-cancelled-border-soft/-strong`, `--admin-status-confirmed-border-strong`,
`--admin-status-pending-border-strong/-vivid`, `--admin-status-restricted-bg-hover-strong`)
carry a stray ratio comment: **none do**, in any of the four blocks — consistent with
the diff's stated reason (a 3:1 UI-boundary colour is not a text pair, and none of the
9 pre-existing border tokens carries one either).

### 5. The "inverse risk" — new tokens auto-paired against `REAL_SURFACES`

`derivePairs`'s `fgLike` filter (`/text|body|heading|muted/i`, minus
`NOT_GENERIC_SURFACE_TEXT`) catches exactly **2** of the 58 new tokens:
`--admin-status-attention-text-muted` and `--admin-status-restricted-text-hover`.
Both get auto-paired against all four `REAL_SURFACES` and tested at AA (4.5:1) in
both themes, whether or not the author intended it. Running the full derived-pairs
check: **0 AA failures among 190 theme checks** (95 unique pairs × 2 themes). Isolated
confirmation: the "foreground-ish token vs a real admin surface" pair count went from
60 (pre-diff) to 68 (post-diff) — exactly `2 new tokens × 4 surfaces = +8`, with no
unexpected dedup or double-counting. The ratio-comment-named pair count went from 5 to
7 — exactly the 2 new ratio-commented tokens. Total derived pairs: 85 → 95 (`+8 +2`),
consistent to the pair.

Both auto-paired tokens are confirmed to be genuine foreground/text tokens at their
actual call sites (`text-[var(--admin-status-attention-text-muted)]` in
`src/app/admin/calendar/page.tsx:1793/1796/1843/1846`; `hover:text-[var(--admin-status-restricted-text-hover)]`
in `src/app/admin/settings/SettingsForm.tsx:757`) — not a surface wrongly caught by
the naming heuristic.

### 6. `/muted/` name vs SURFACE category error

Only one new token matches `/muted/`: `--admin-status-attention-text-muted`. Its name
also matches `/text/`, and its only call sites are `text-[var(...)]` (see above) — it
is a genuine muted-text foreground colour (a dimmer status label), not a surface
mistakenly named "muted" the way `--admin-panel-muted`/`--admin-sidebar-muted` are
(those are explicitly excluded via `NOT_GENERIC_SURFACE_TEXT` for exactly this
reason). No `NOT_GENERIC_SURFACE_TEXT` category error introduced.

### 7. File parses; shipped scripts and test suite pass

- `node scripts/verify-admin-token-contrast.mjs` → `ratio-comment mismatches: 0`,
  `pair AA failures: 0`, `total failures: 0`.
- `node scripts/measure-admin-contrast.mjs . --json` → `tokensResolved: 152`,
  `unresolvedElements: 240`, `total: 125`, `dark: 46`, `light: 79` — matches the
  diff's own "MEASURED AFTERWARDS" claims exactly.
- `npx vitest run scripts/verify-admin-token-contrast.test.ts` → **27/27 passed**,
  including the widened token-count sanity band (70 < 152 < 200) that commit
  `c50cb6a` introduced. The band widening itself is well-justified: 94 pre-diff → 152
  post-diff tokens is exactly `94 + 58`, and the commit message's claim that the band
  is mutation-tested (dropping the `--admin-` filter harvests 222 of 290 total custom
  properties, failing the `<200` assertion) is consistent with the file's actual
  content — I did not re-run the mutation myself, but the arithmetic checks out and
  the load-bearing "resolves in both themes" assertions in the same file are
  untouched.

### 8. Byte-identical light-value audit across the full site diff (beyond the ask, but cheap and high-signal)

Rule 2 requires every new token's light value to be byte-identical to the literal it
replaced. Rather than trust this on the two files I initially spot-checked, I parsed
the entire `04e1b0c..c50cb6a` diff for every changed line touching an `oklch(...)`
literal, isolated the single-value edit region on each line with a longest-common-
prefix/suffix text diff (robust to unrelated `var(--admin-x)` references already
present elsewhere on the same line), and cross-checked every resulting
literal→token pair against `tokens.css`'s parsed light value across all 47 changed
`.tsx`/`.ts` files. Result: **every literal-to-token substitution I could isolate
matches byte-for-byte** (after normalizing whitespace only) — including the trickier
cases: two-substitution single lines (`emails/page.tsx`'s danger-border +
cancelled-bg-hover pair, `SettingsForm.tsx`'s restricted-bg-hover-strong +
restricted-text-hover pair, `button.tsx`'s subtle-hover + subtle-active pair), the
seven `--admin-shadow-ink-NN` tokens (verified separately: literal alpha suffixes
`{04,06,08,12,18,25,28}` found in the diff match the seven minted token names and
values exactly, base colour `oklch(23% 0.073 155 / ...)` held constant), and the one
non-oklch fallback-pattern replacement in `AuditEventCard.tsx` (`bg-[var(--admin-page,
oklch(97.8% 0.006 88))]` → `bg-[var(--admin-surface-subtle)]`, where
`--admin-surface-subtle`'s light value is exactly `oklch(97.8% 0.006 88)`).

### 9. Tailwind-prefix-vs-token-role agreement (rule 4), for all 58 new tokens

Grepped every call site of all 58 new tokens (108 usage lines across 30 files) and
checked the Tailwind utility prefix against the token's implied role from its name.
**0 mismatches**: every `-bg`/`-fill`/`-hover`/`-icon-bg`/`-scrim*`/`avatar-tint-*`/
`mark-bg` token is consumed at a `bg-[var(...)]` site; every `-text`/`-icon`/
`-chip-icon`/`-numeral` token at a `text-[var(...)]` or `color:` site; every
`-border*` token at a `border-[var(...)]` site; the seven `-shadow-ink-*` tokens only
ever appear inside `shadow-[...]` arbitrary values; `--admin-ring-gap` (a surface-role
token) only appears inside a `shadow-[...]` ring-gap declaration, which is its
documented role. No `-bg` token found at a `text-` site or vice versa.

## Things that are NOT defects, despite looking odd at first glance

- `--admin-email-preview-bg` not inverting between light and dark — documented and
  intentional (see §1).
- The two ratio-commented new tokens carry the comment **only** in the dark block,
  not in root/light/print — this doesn't weaken verification: `derivePairs` registers
  the pair by token name and tests it against **both** the light and dark scope
  regardless of which block the comment textually sits in (`checkPairs` iterates both
  themes for every registered pair). Confirmed 0 AA failures for both.
- The `--admin-shadow-ink-*` dark-block comment claims the dark alpha sits at "~4-11x"
  the light alpha. Computed exactly: 06→8.67x, 18→4.0x, 08→7.25x, 04→11.25x, 25→3.2x,
  12→5.42x, 28→3.04x. Two of the seven (25, 28) sit at ~3.0-3.2x, below even an
  approximate reading of "~4-11x". This is a prose-comment imprecision only — the
  actual dark values are still correctly hue-neutral black at boosted alpha, contrast
  is unaffected, and no test or user-facing rendering depends on the "4-11x" figure
  being exact. I'm not reporting it as a finding because it has no concrete,
  user-visible failure scenario, which is the bar this review was asked to hold
  findings to — but it's worth a maintainer's eye if the plan ever expects that
  comment range to be load-bearing.

## Findings

None. Every claim this lens was asked to verify — 4-block completeness, print
placement/indentation, no collision/displacement/reordering, ratio-comment accuracy,
the inverse-risk auto-pairing, the `/muted/` category-error check, and file/test
parseability — held up under direct computation, and a broader byte-identical
literal-audit across the full 47-file diff (beyond what this lens strictly asked for)
found zero mismatches as well.
