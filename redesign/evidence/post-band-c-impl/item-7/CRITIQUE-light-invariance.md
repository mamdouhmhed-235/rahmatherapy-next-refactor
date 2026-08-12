# Critique — Lens: light-invariance

Diff under review: `04e1b0c..c50cb6a` (8 commits, `git log --oneline 04e1b0c..c50cb6a`).
Claim under test: light mode did not move by a single pixel anywhere in this diff.

Verdict: **SOUND**. No light-mode value change was found anywhere in the diff — in
`src/styles/tokens.css` or at any of the ~119 call sites. Every check below was computed,
not eyeballed, by importing `parseTokensCss`/`resolveColour` from
`scripts/verify-admin-token-contrast.mjs` and running `scripts/measure-admin-contrast.mjs`
read-only, plus two throwaway cross-check scripts written to the system temp scratchpad
(not the repo) that parse `git diff 04e1b0c..c50cb6a` directly.

## 1. `tokens.css` is a pure addition

```
$ grep -c "^-" tokens.diff   →  1   (only the `--- a/src/styles/tokens.css` file header)
```

Every one of the 436 inserted lines in `src/styles/tokens.css` is a `+` line; the diff
removes or modifies **zero** existing declarations. This means no pre-existing (non-ITEM-7)
token's light, dark, or print value could have moved — the only way light mode could have
moved is through the 58 new declarations themselves, or through the ~119 call-site edits.
Both are checked below.

## 2. All 58 new tokens: four blocks, byte-identical light/root/print, alpha included

Enumerated the 58 new token names from the `tokens.css` diff (8 confirmed-family + 9
danger-family + 16 warning-family + 6 restricted-family + 5 warm-neutral-surface + 7
shadow-ink + 3 scrim + 4 button-primitive = 58, matching the claim exactly) and parsed the
current file with `parseTokensCss`. For every token, resolved `scopes.root`,
`scopes.light`, `scopes.print`, `scopes.dark` and compared the **raw declared text**
(comment-stripped, whitespace-normalized) — not `resolveColour`, since that function drops
the alpha channel from `oklch(... / A)` and would call two different-opacity colours equal.

Result: **0 of 58 tokens** have any of {missing from a block, root≠light, root≠print,
light≠print, alpha differs between root/light/print}. Full table cross-checked by hand
against the diff includes the 10 alpha-bearing tokens (`--admin-shadow-ink-{04,06,08,12,18,25,28}`,
`--admin-scrim`, `--admin-scrim-backdrop`, `--admin-scrim-overlay`) — all carry their
alpha suffix identically in root/light/print; only `dark` legitimately changes both colour
and alpha (by design — hue-neutral black at higher alpha, documented in the token block's
own comment).

## 3. Every call-site substitution: literal → token, value-checked against the diff itself

Wrote a script that walks `git diff 04e1b0c..c50cb6a` for every file except `tokens.css`
and the two test/config files, pairs each contiguous `-`/`+` block positionally (git's
default block-diff shape — verified 0 "unbalanced block" cases, i.e. every hunk in this
diff removes exactly as many lines as it adds), extracts every Tailwind arbitrary-value
bracket `[oklch(...)]` or `[var(--admin-x)]` together with any **outside-the-bracket**
`/NN` opacity modifier (the real Tailwind opacity-modifier syntax, e.g. `bg-[...]/35`),
and for every `oklch(...)` → `var(--admin-x)` swap compares:

- the decoded literal (Tailwind `_`→space) against the token's resolved **light** value
  from `tokens.css`, and
- whether the `/NN` opacity modifier (if any) is identical in both old and new.

First pass (naive, comparing raw `oklch(...)` text anywhere on the line, not just inside
brackets) flagged 8 items; every one turned out to be a false positive from one of two
causes, confirmed by hand:

- **3 shadow-ink sites** (`ManualBookingForm.tsx` ×2, `dashboard-filters-client.tsx` ×1)
  where the only difference was whitespace around the `/` alpha separator inside `oklch()`
  itself (`155/0.25` vs `155 / 0.25`) — CSS treats this whitespace as insignificant, per
  the task's own explicit exclusion. Not a defect.
- **5 sites in `src/components/ui/input.tsx`** where the "literal" was actually a
  **fallback** inside `var(--admin-x, oklch(...))`, and the diff's only change was
  dropping the fallback (`var(--admin-body, oklch(23%_0.01_143))` → `var(--admin-body)`,
  and similarly for `--admin-text-muted`, `--admin-focus` ×2, `--admin-heading`). Confirmed
  each of those 5 tokens (`--admin-body`, `--admin-text-muted`, `--admin-focus`,
  `--admin-heading`) IS declared in `:root`, so the custom property is never actually
  unset at the point of use and the fallback was dead code (matches the commit's own
  message: "drop seven dead fallbacks"). Removing a fallback that never activates cannot
  change any rendered pixel. Not a defect.

Re-ran the check restricted to bracket-exact content (the real Tailwind unit boundary):
**0 flagged issues** other than the same 8 fallback/whitespace cases above, now correctly
reported as "bracket count mismatch" (old bracket had a comma+fallback, so it isn't a
single literal/var token) rather than a false value mismatch. No `/NN` opacity modifier
was ever added, dropped, or changed in value across any of the ~119 sites.

One more fallback of the same dead shape but with a **live** consequence, found and
verified separately: `AuditEventCard.tsx` had `bg-[var(--admin-page,_oklch(97.8%_0.006_88))]`.
`--admin-page` is **not** declared anywhere in `tokens.css` (`grep -n "admin-page:"` →
no match), so unlike the five `input.tsx` cases this fallback was **always live** — the
site was permanently frozen at `oklch(97.8% 0.006 88)` in every theme, i.e. it was one of
the very literal-freeze bugs ITEM 7 exists to fix, just expressed as an unresolvable alias
instead of a bare literal. The diff points it at the new `--admin-surface-subtle` token,
whose light value is `oklch(97.8% 0.006 88)` — byte-identical to the old fallback. Light
mode renders the same pixel; dark mode now actually inverts (a bug fix, not scoped to this
lens, but confirmed not to move light mode).

## 4. Census / Layer 1 counts, reproduced independently

```
$ node scripts/measure-admin-contrast.mjs . --json
  unresolvedElements: 240, total: 125, dark: 46, light: 79
```

Matches the claimed post-diff numbers exactly (170→125 total, 91→46 dark, light unchanged
at 79, unresolvedElements unchanged at 240).

## 5. The harder question: is the SET of 79 light failures unchanged, not just the count?

Cross-referenced the 79 light-mode findings against the 45 files this diff touches: 37
findings share a file with the diff. Of those 37, only **two** sit at a location the diff
actually edited (the rest are unrelated JSX elements elsewhere in the same file, e.g.
`--admin-on-primary` vs `--admin-panel` icon contrast that this diff never touches):

- `src/app/admin/components/admin-scalable-lists.tsx:562` — `fg=var(--admin-restricted)`,
  `bg` was `oklch(89%_0.014_78)` (hover), now `var(--admin-hover-warm)`. Both
  `measure-admin-contrast.mjs`'s own `parseColour` and this diff's token declare the exact
  same colour (`oklch(89% 0.014 78)`), so `cr=4.46` is unchanged before and after — this
  pairing already failed AA before the diff (the tool's `oklch(...)` branch resolves raw
  literals natively; tokenizing it didn't newly "reveal" a hidden failure, it relabelled
  an existing one).
- `src/app/admin/clients/new/ClientCreateForm.tsx:507` — `fg=var(--admin-body)`,
  `bg` was `oklch(11%_0.014_155_/_0.45)` (dialog `::backdrop`), now
  `var(--admin-scrim-backdrop)`, whose light value is byte-identical including alpha
  (`oklch(11% 0.014 155 / 0.45)`). Same reasoning: `cr=1.68` both before and after.

None of the other 35 same-file findings sit on a line or utility this diff edited (most are
`text-[...]` elements with no `bg-[...]` on the same JSX unit at all — "assumed-surface"
findings against `--admin-panel`/`--admin-canvas`, driven by tokens this diff never
touches; a few are `shadow-[...]` box-shadow values, which `measure-admin-contrast.mjs`'s
`FG`/`BG` regex never scans in the first place since it only matches `text-[` and `bg-[`
utilities — none of the shadow-ink or scrim substitutions can ever appear in this census).

Because every `oklch(...)` → `var(--admin-x)` swap in the diff resolves to the identical
sRGB (and, where present, identical alpha) as the literal it replaced, and because
`measure-admin-contrast.mjs`'s findings are a pure function of {resolved fg colour,
resolved bg colour, theme} per JSX unit with the utility prefixes/structure otherwise
untouched, the set of light-mode failures is provably identical before and after this
diff — not merely equal in count.

## 6. Cross-check: Layer 2 (token-pair contrast) also 0 failures

`node scripts/verify-admin-token-contrast.mjs` → `ratio-comment mismatches: 0`,
`pair AA failures: 0`, matching the claimed measurement. (Out of scope for light-invariance
specifically, run only as a sanity cross-check since it also reads `tokens.css`.)

## What I checked

- Parsed `tokens.css` and confirmed the diff against it is purely additive (no `-` lines
  besides the file header).
- Programmatically enumerated all 58 new tokens and verified all four blocks are present,
  and that root/light/print are byte-identical (including alpha) for every one, using a
  throwaway script importing `parseTokensCss` from `scripts/verify-admin-token-contrast.mjs`
  (not `resolveColour`, which discards alpha).
- Programmatically walked the entire non-`tokens.css` diff, paired every `-`/`+` block,
  and compared every `oklch(...)` literal replaced by a `var(--admin-x)` reference against
  that token's resolved light value, and every Tailwind `/NN` opacity modifier for survival
  in position and value. Investigated all 8 items the naive pass flagged; all resolved to
  non-issues (CSS-insignificant whitespace, or dead/always-fallback removal) on inspection
  of the actual token declarations.
- Ran `scripts/measure-admin-contrast.mjs . --json` and reproduced the claimed
  `light: 79, dark: 46, total: 125, unresolvedElements: 240`.
- Cross-referenced all 79 light-mode findings against the 45 diff-touched files, isolated
  the 2 that sit on a line the diff actually edited, and confirmed both resolve to
  byte-identical colours (hence identical ratios) before and after.
- Ran `scripts/verify-admin-token-contrast.mjs` and reproduced `0 ratio mismatches, 0 pair
  failures` as a secondary cross-check.

No findings to report for this lens.
