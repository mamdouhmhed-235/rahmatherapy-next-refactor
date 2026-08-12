# F4-restricted-280 — Adversarial Verification Verdict

**Verdict: SOUND**

Read-only review against the live repo (no files under src/, scripts/, e2e/, supabase/
were touched). All 8 checklist items were independently re-derived from the actual
files, not from the proposal's prose.

## 1. Light byte-identity — PASS

All 6 new-token `lightValue`s and both `reuse-existing-token` values are byte-identical
(underscore→space converted) to the literal they replace and/or to the existing token's
declared light value in `src/styles/tokens.css`:

| token | claimed light | literal (converted) | match |
|---|---|---|---|
| `-bg-hover` | `oklch(91% 0.012 280)` | `oklch(91%_0.012_280)` | yes |
| `-bg-hover-alt` | `oklch(90% 0.012 280)` | `oklch(90%_0.012_280)` | yes |
| `-bg-hover-strong` | `oklch(85% 0.012 280)` | `oklch(85%_0.012_280)` | yes |
| `-text-hover` | `oklch(20% 0.02 280)` | `oklch(20%_0.02_280)` | yes |
| `-icon` | `oklch(42% 0.05 280)` | `oklch(42%_0.05_280)` | yes |
| `-avatar-bg` | `oklch(91% 0.022 280)` | `oklch(91%_0.022_280)` | yes |
| reuse `-bg` | `oklch(94% 0.008 280)` | tokens.css:164/565/681 | yes |
| reuse `-text` | `oklch(30% 0.02 280)` | tokens.css:165/566/682 | yes |

## 2. Role agreement — PASS

Checked every site's Tailwind utility prefix / inline-style property against what the
token name paints. No `text-` site takes a `-bg`/background token and no `bg-`/`style.background`
site takes a foreground token:

- 7× `hover:bg-` sites → `-bg-hover` (bg role, bg token) — match
- `event-row.tsx:173` `hover:bg-` → `-bg-hover-alt` — match
- `SettingsForm.tsx:757` `hover:bg-` → `-bg-hover-strong` — match; same line's `hover:text-` → `-text-hover` — match
- `AuditEventCard.tsx:36` `text-` (sets `color`, read by the Lucide icon via `currentColor`, confirmed no explicit stroke/fill override on `<chip.Icon>`) → `-icon` — foreground role, agrees
- `AuditEventCard.tsx:62` `bg-` → `-avatar-bg` — match
- `ManualBookingForm.tsx:380` `style.background` → reused `-bg` — match
- `ManualBookingForm.tsx:381` `style.color` → reused `-text` — match

No `--admin-on-primary`-style inversion trap present in this family.

## 3. Find-string exactness — PASS, count confirmed: 14 sites / 8 distinct literals

Opened every file at the stated line and confirmed the `find` string verbatim, including
underscore formatting and absence of any trailing `/NN` opacity modifier immediately after
the closing bracket:

- `AuditFilterStrip.tsx:258`, `calendar/page.tsx:650`, `calendar/page.tsx:660`,
  `PrivacyFilterBar.tsx:363`, `reports/page.tsx:1288`, `SettingsForm.tsx:748`,
  `staff/page.tsx:537` — `hover:bg-[oklch(91%_0.012_280)]` present exactly once per line,
  each followed by a space then `focus-visible:...` (or the closing `"`), never a `/NN`.
- `operations/event-row.tsx:173` — `hover:bg-[oklch(90%_0.012_280)]` exact, once.
- `SettingsForm.tsx:757` — carries both `hover:bg-[oklch(85%_0.012_280)]` and
  `hover:text-[oklch(20%_0.02_280)]` on the same line, each occurring exactly once,
  non-overlapping substrings — not ambiguous.
- `AuditEventCard.tsx:36` — `text-[oklch(42%_0.05_280)]` exact, once.
- `AuditEventCard.tsx:62` — `bg-[oklch(91%_0.022_280)]` exact, once (the array's other 4
  tint strings use different hues, no cross-line ambiguity).
- `ManualBookingForm.tsx:380` / `:381` — `"oklch(94% 0.008 280)"` / `"oklch(30% 0.02 280)"`
  (quoted, space-separated — correct for a plain inline-style value, not a Tailwind
  arbitrary-value class) exact, once each.

Independent fresh `grep` of `src/` for `oklch(...280)` turned up exactly these 14 component
occurrences plus the 12 tokens.css declaration lines (3 tokens × 4 blocks) and 4
`--admin-chart-status-unknown` lines (a pre-existing, already-tokenized, out-of-family
declaration) — nothing else.

## 4. Line drift — PASS

Every stated line number (258, 650, 660, 363, 1288, 748, 757, 537, 173, 36, 62, 380, 381)
still holds against the current working tree, confirmed by direct `Read`.

## 5. Dark-value direction — PASS

Recomputed each dark L/C from the stated `nearestExistingFamily`'s own light+dark sum
constant and confirmed the mirror is arithmetically exact (123 for the `-bg` family: 94+29;
117 for the `-text` family: 30+87):

- Token 1: 123−91=32 ✓ · Token 2: 123−90=33 ✓ · Token 3: 123−85=38 ✓ · Token 6: 123−91=32 ✓
- Token 4 (text-hover): 117−20=97 ✓ · Token 5 (icon): 117−42=75 ✓

Direction check: every hover token that darkens in light (91/90/85 < base bg's 94) lightens
in dark (32/33/38 > base bg dark's 29). Token 4 darkens in light (20 < base text's 30) and
lightens in dark (97 > base text dark's 87). Token 5 is lighter in light than base text
(42 > 30) and is correspondingly darker in dark than base text (75 < 87) — the correct
inverse of the same rule. No token moves the wrong way.

`--admin-heading` dark is confirmed `oklch(96% 0.010 88)` (tokens.css:382) and
`--admin-on-primary` light is confirmed `oklch(99.5% 0.003 88)` (tokens.css:88) — both
cited comparison claims for token 4 check out exactly.

## 6. Ratio arithmetic — PASS, all 6 reproduce exactly

Wrote a throwaway script in the system scratch directory that imports `resolveColour`,
`contrastRatio`, `oklchToRgb`, `parseTokensCss` directly from the shipped
`scripts/verify-admin-token-contrast.mjs`, injected the 6 proposed token values into the
real dark/light scopes parsed from `src/styles/tokens.css`, and recomputed every stated
ratio (dark, the primary comment; light, the stated "sanity check" value):

```
1 bg-hover:        actual 8.56:1  (claimed 8.56) · light sanity 10.45:1 (claimed 10.45)
2 bg-hover-alt:     actual 8.19:1  (claimed 8.19) · light sanity 10.09:1 (claimed 10.09)
3 bg-hover-strong:  actual 9.13:1  (claimed 9.13) — vs token 4
4 text-hover:        actual 9.13:1  (claimed 9.13) · light sanity 11.47:1 (claimed 11.47)
5 icon:               actual 7.73:1  (claimed 7.73) · light sanity 8.50:1  (claimed 8.50)
6 avatar-bg:          actual 8.53:1  (claimed 8.53) · light sanity 10.41:1 (claimed 10.41)
```
Every delta was ≤ 0.005 (effectively exact, well inside the shipped `RATIO_TOLERANCE` of
0.15). The secondary prose sanity check for token 3 vs the base (non-hover) text
(6.71 dark / 8.62 light) also reproduced exactly. Every `ratioAgainst` name resolves: 4 are
pre-existing tokens (`--admin-status-restricted-text` ×3, `--admin-panel`), 2 are
cross-references to sibling tokens minted in the same family (`-text-hover` ↔
`-bg-hover-strong`), none dangling.

## 7. Completeness — PASS

Literals array sums to 7+1+1+1+1+1+1+1 = 14 occurrences across 8 distinct literals,
matching the family brief (`F4-restricted-280.md`: "8 distinct literals, 14 occurrences")
exactly. Independently re-grepped `src/` fresh (not just re-reading TAIL-CENSUS.md) for
every `oklch(...280)` occurrence and found precisely these 14 sites plus the pre-existing
tokens.css declarations — nothing missed, nothing extra.

## 8. The unasked question — checked, nothing breaking found

- **Public-page leakage**: traced every consumer of the 7 touched files
  (`AuditFilterStrip`, `AuditEventCard`, `PrivacyFilterBar`, `SettingsForm`,
  `ManualBookingForm`, `calendar/page`, `reports/page`, `staff/page`, `event-row` via
  `operations-board.tsx`) — all import chains terminate inside `src/app/admin/**`. None
  reach `/booking/manage` or any other public customer route.
- **Inline `style={{...}}` object validity**: confirmed `var(--admin-status-restricted-bg)`
  as a `style.background` string resolves identically to a stylesheet `var()` — standard
  browser behaviour, no canvas/SVG/pre-resolution context involved for this `<span>`.
- **Test coverage**: grepped for every literal across `*.test.ts(x)`/`*.spec.ts` and for
  `restricted`/`oklch`/`style.`/`background` inside `ManualBookingForm.test.tsx`
  specifically — zero hits. No test asserts on these literal colour values or would break
  on substitution. `e2e/admin-contrast.spec.ts` and the rest of `e2e/` do not reference
  hue 280 or "restricted" styling, and there are no `toHaveScreenshot`/`toMatchSnapshot`
  calls in scope.
- **Naming-collision check**: `tokens.css` also declares an unrelated, pre-existing
  `--admin-restricted` / `--admin-restricted-bg` pair (hue 88, a different concept
  entirely — not part of this family). The proposal never uses the bare `--admin-restricted`
  prefix; all 6 new names correctly use the full `--admin-status-restricted-` prefix, so
  there is no collision.
- **Auto-enrollment side effect** (worth recording, not a defect): `scripts/verify-admin-token-contrast.mjs`'s
  `derivePairs()` auto-adds any token whose name matches `/text|body|heading|muted/i` to a
  generic foreground-vs-4-surfaces AA check. `--admin-status-restricted-text-hover` matches
  that regex (via "text") and was not previously being checked this way. Ran the real
  `derivePairs`/`checkPairs` against a snapshot of `tokens.css` with the 6 new tokens
  injected: 4 new pairs are introduced (`-text-hover` vs each of `--admin-canvas`,
  `--admin-panel`, `--admin-panel-muted`, `--admin-nav-bg`), and all 4 pass AA comfortably
  in both themes (14.16:1–17.99:1). Confirmed via the shipped `derivePairs`/`checkPairs`
  functions directly — this does not change the gate's pass/fail count, but the proposal's
  own notes never mention that minting a `-text-hover`-suffixed token has this side effect.
  Flagging for the record; not a blocking finding since it does not fail.
- **`--admin-chart-status-unknown`** (hue 280, tokens.css:249/483/597/710) is a
  pre-existing, already-tokenized declaration, never a hardcoded literal in a component —
  correctly out of scope for this family and not mentioned as such would have been an
  omission; it was not omitted, it simply never appears as a literal anywhere in `src/`.

## Findings

None survived verification. Zero blocker/major/minor findings.

## What was verified (methods)

- Direct `Read` of every file at every claimed line (13 distinct file:line locations).
- Fresh `Grep` of `src/` for every `oklch(...280)` pattern, independent of
  `TAIL-CENSUS.md`, to confirm completeness.
- A throwaway Node script (`%TEMP%/.../scratchpad/verify-f4.mjs` and
  `verify-f4-pairs.mjs`, outside the repo) importing `resolveColour`, `contrastRatio`,
  `oklchToRgb`, `parseTokensCss`, `derivePairs`, `checkPairs` directly from the shipped
  `scripts/verify-admin-token-contrast.mjs`, run against the real `src/styles/tokens.css`
  with the 6 proposed tokens injected, to recompute all 6 measured ratios and to check for
  any newly-introduced AA failures in the generic derived-pairs sweep.
- Grep across `src/` and `e2e/` for references to the touched literals/files in test code.
- Import-chain trace confirming every touched file's consumers stay inside
  `src/app/admin/**`.
