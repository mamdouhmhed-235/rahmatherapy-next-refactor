# Family F6 — warning / amber / gold, hues 55-80

Read-only derivation. 16 distinct literals, 25 occurrences, per
`TAIL-CENSUS.md`. This file records the reasoning; the mechanical find/replace
+ the four-block token declarations are in the structured output for the
orchestrator to apply.

## Method used to derive every dark value

Two different transforms were needed, chosen per-token, never mixed within
one token:

**A. "Emphasis-flip" — for a token that is explicitly a MORE/LESS-emphasis
variant of one specific existing sibling used in the same visual context**
(a `-hover`, `-strong`, `-vivid`, `-muted` of a token that is *also visible
at the same call site*). This operationalises the brief's own hover-state
gotcha ("darkens in light → must lighten in dark") as a general rule for any
relative-emphasis modifier, not just literal `:hover`:

```
Δlight  = new_light_L − sibling_light_L
dark_L  = sibling_dark_L − Δlight        // direction flips
dark_C  = new_light_C × (sibling_dark_C / sibling_light_C)   // ratio, not flipped
dark_H  = new_light_H + (sibling_dark_H − sibling_light_H)   // same shift, not flipped
```
Rationale for why C and H are *not* flipped: saturation and hue read the same
way regardless of which canvas they sit on; only "distance from the
background" (i.e. L) reverses meaning between a near-white and a near-black
canvas.

I verified this doesn't just look plausible — I recomputed sRGB + contrast
for every flip-derived pair (below) and confirmed the *hover/strong* value is
always measurably more prominent against the dark canvas than its base, the
same way the light value is measurably more prominent against the light
canvas. Where the naive *non-flipped* shift was tried first (attention-icon,
pending-border-strong) it produced either a smaller-emphasis result in dark
than in light, or an out-of-range L — both are why the flip exists.

**C / B. Direct shape-transfer — for a token that is not a modifier of
anything nearby, just "another member of a warm/amber family, coincidentally
close to an existing token's hue+chroma".** Apply the sibling's own
`(ΔL, C-ratio, ΔH)` straight across, no flip, since there is no "more/less
emphasis than X" claim being made. Where the naive delta would push L out of
[0,100] (tried for `pending-chip-icon` against `--admin-status-pending-text`,
and for `price-numeral`), I instead anchored the result inside the
**existing convergence band** that *every* vivid warm/amber token in this
file already independently lands in for dark mode:

| existing token (dark) | L | C | H |
|---|---|---|---|
| `--admin-accent` | 78% | 0.145 | 62 |
| `--admin-focus` | 76% | 0.145 | 55 |
| `--admin-warning` | 84% | 0.135 | 82 |
| `--admin-warning-solid` | 78% | 0.130 | 60 |
| `--admin-warning-solid-hover` | 86% | 0.095 | 60 |
| `--admin-chart-status-pending` | 82% | 0.135 | 75 |
| `--admin-cormorant-color` | 78% | 0.145 | 62 |
| `--admin-status-pending-text` | 91% | 0.080 | 82 |
| `--admin-status-attention-text` | 90% | 0.068 | 70 |

L 76-91%, C 0.068-0.145, H 55-82. Every "standalone vivid amber" new token
below was positioned inside this band, biased toward whichever existing
member its hue/chroma is closest to, with the residual difference in
starting light-L used only to decide *where in the band*, not how far
outside it — this avoids the extrapolation blow-ups the naive approach hit.

All numbers were checked with the shipped verifier's own colour math
(`oklchToRgb` / `contrastRatio` from `scripts/verify-admin-token-contrast.mjs`,
imported read-only, nothing written) — see the ratio table at the end.

## Token-by-token

### 1. `--admin-status-attention-text-muted`
Literal `oklch(30% 0.14 55)` × 4, role `text`. All four sites are the
"Tap to expand"/"Tap to collapse" hint spans inside `SidebarDisclosure` in
`calendar/page.tsx`, nested directly inside the `<details>` whose own
background is `bg-[var(--admin-status-attention-bg)]` and whose main text
color is `text-[var(--admin-status-attention-text)]`. This is a **de-emphasised
sibling of `--admin-status-attention-text`** (L 30% vs 26%, C 0.14 vs 0.13,
same H 55) — visibly lighter/softer than the heading text right next to it,
which matches its job (a quiet hint, not the panel's main copy). Extends the
family the way the brief's own worked example does
(`--admin-status-restricted-bg-hover` beside `--admin-status-restricted-bg`).

Method A (flip), sibling `--admin-status-attention-text` (26% 0.13 55 → 90%
0.068 70): Δlight = +4 → dark_L = 90−4 = 86; dark_C = 0.14×(0.068/0.13) =
0.0732 → 0.073; dark_H = 55+15 = 70.

`--admin-status-attention-text-muted: oklch(86% 0.073 70); /* 8.91:1 vs status-attention-bg */`

### 2. `--admin-border-print`
Literal `oklch(42% 0.025 80)` × 3, role `print:border`. All three sites are
in `calendar/page.tsx`: the day-card article (`:1545`) and the two
`ModifierIcon` chip variants (`:1718`, `:1728`). Each already carries a
normal-mode border (`border-[var(--admin-border)]` or a status `bg`) and
swaps to this darker, higher-chroma neutral **only inside `print:`**, almost
certainly because a very light pastel border/tint (`--admin-border` is
`#e8dfd3`, or the pending/attention bg tints) risks vanishing on a
grayscale-converted print. Nearest by hue+chroma is `--admin-border-form`
(H 80, C 0.022, closest of any existing border token — plain `--admin-border`
is H 88 and not oklch-native).

**What the dark value means here, thought through as asked**: Tailwind's
`print:` variant compiles to a rule that only ever matches inside
`@media print`. tokens.css's own `@media print` block (lines 625-731) already
forces **every** `--admin-*` token — including this new one, once minted —
back to its light value, via a selector list that covers `:root`,
`[data-theme="dark"]` and `[data-theme="light"]` all at once. So the
`[data-theme="dark"]` declaration for `--admin-border-print` can never
actually paint anything: nothing consumes it except this print-only utility,
and the print utility itself always resolves through the print block's own
(light) copy first, per CSS cascade (later rule, equal specificity, tokens.css
:336-338's own documented ordering guarantee). It is *structurally* required
(rule 1 says all four blocks, and a missing dark declaration is exactly the
"silently falls back to browser default" failure mode the brief warns about
for the *print* block specifically — better to over-supply than leave a gap),
but it is inert in practice. I still derived a real, sensible value rather
than a placeholder, using direct shape-transfer (method C) from
`--admin-border-form` (55% 0.022 80 → 58% 0.018 80): ΔL=+3, C-ratio=0.818,
ΔH=0 → dark_L=45, dark_C=0.025×0.818=0.0205→0.020, dark_H=80.

`--admin-border-print: oklch(45% 0.020 80); /* 2.32:1 vs panel — inert: @media print always resolves the light value first, see reasoning doc */`

### 3. `--admin-status-attention-bg-hover`
Literal `oklch(92% 0.06 65)` × 2, role `hover:bg`. Both sites are the
`<summary>` of `SidebarDisclosure` in `calendar/page.tsx` (the two branch
variants), whose idle background is `bg-[var(--admin-status-attention-bg)]`.
Darkens 95%→92% and gains chroma 0.05→0.06 on hover in light mode — a
same-panel hover of `--admin-status-attention-bg`.

Method A (flip), sibling `--admin-status-attention-bg` (95% 0.05 65 → 30%
0.055 65): Δlight = 92−95 = −3 → dark_L = 30−(−3) = 33; C-ratio = 1.1 →
dark_C = 0.06×1.1 = 0.066; dark_H = 65.

`--admin-status-attention-bg-hover: oklch(33% 0.066 65); /* 1.54:1 vs canvas */`

Verified direction: base bg is 1.39:1 against dark canvas, hover is 1.54:1 —
hover reads as *more* prominent in dark, matching "darkens in light → more
emphasis" flipping to "lightens in dark → more emphasis".

### 4. `--admin-status-pending-border-strong`
Literal `oklch(80% 0.07 75)` × 2, role `border`. Sites:
`DuplicateWarningBanner.tsx:7` (local const named `ATTENTION_BORDER`, but
paired with `--admin-status-attention-text` / `--admin-status-attention-bg`
in that file) and `staff/[staffId]/availability/lib.ts:44` (local const
`PENDING_BORDER`, explicitly commented "Pending-family tokens"). **These two
call sites disagree on which status family this border belongs to, but the
colour itself settles it**: H=75 and C=0.07 match the *pending* family's own
`--admin-status-pending-border` (H 75) exactly on hue, not the *attention*
family's border (H 65). `DuplicateWarningBanner`'s local variable name is the
outlier, not the colour — per "name tokens for what they ARE", this becomes
one pending-family token, used at both sites; I have not touched the
`ATTENTION_BORDER` identifier itself (renaming a local const is outside this
sweep's remit).

Method A (flip), sibling `--admin-status-pending-border` (88% 0.055 75 → 43%
0.068 75): Δlight = 80−88 = −8 → dark_L = 43−(−8) = 51; C-ratio = 1.2364 →
dark_C = 0.07×1.2364 = 0.0865 → 0.087; dark_H = 75.

`--admin-status-pending-border-strong: oklch(51% 0.087 75); /* 2.97:1 vs panel */`

(Border contrast target here is the 3:1 non-text-UI bar, not 4.5:1 text AA —
2.97:1 vs `--admin-panel` sits essentially at that bar, consistent with the
base `--admin-status-pending-border` itself only reaching 2.12:1 against the
same panel. "Strong" moves it closer to 3:1, it does not need to clear 4.5:1.)

### 5. `--admin-status-pending-border-vivid`
Literal `oklch(82% 0.09 75)` × 2, role `border`. Sites: `EmptyState.tsx:55`
(`tone: "warning"` variant, paired with `bg-[var(--admin-status-pending-bg)]`)
and `dashboard/ProfileCompletionNudge.tsx:62` (paired with the same
`--admin-status-pending-bg`). Same hue family as #4 but a **different light
value** (82%/0.09 vs 80%/0.07) — I looked hard at whether this is the same
kind of accidental drift the brief flags for 40%/0.13/55 vs 40%/0.12/55, and
I think it plausibly is (two independent "make the pending border pop more"
edits, at different strengths), but I have not unified them: two distinct
light values stay two tokens, full stop. Named `-vivid` rather than a second
`-strong` because its distinguishing feature is chroma (0.09, the highest in
the pending-border cluster) rather than lightness reach.

Method A (flip), same sibling `--admin-status-pending-border` (88% 0.055 75
→ 43% 0.068 75): Δlight = 82−88 = −6 → dark_L = 43−(−6) = 49; C-ratio =
1.2364 → dark_C = 0.09×1.2364 = 0.1113 → 0.111; dark_H = 75.

`--admin-status-pending-border-vivid: oklch(49% 0.111 75); /* 2.71:1 vs panel */`

### 6. Three pending-hued background tints (avatar / icon / highlight)
Three *different* light values, each 1 occurrence, each paired in its real
JSX with `text-[var(--admin-status-pending-text)]` as foreground, each in
`H≈75-80` territory. All extend the pending family with a role qualifier
rather than colliding on one `-bg-strong` name, because none of them is
byte-identical to another and none is a modifier of another — they're three
independent small surfaces that happen to share a foreground.

**6a. `--admin-status-pending-avatar-bg`** — `oklch(92% 0.030 80)`,
`AuditEventCard.tsx:61`, one of `avatarTint()`'s 5 rotating actor-avatar
fills (slot 3 of that same array literally already uses
`--admin-status-completed-bg`, so tokenising a sibling slot the same way is
consistent with the array's own existing pattern). H=80 rather than
pending's usual 75 — a minor, harmless hue wobble for a decorative avatar
swatch, not a functional pairing the way #4/#5's borders are.

**6b. `--admin-status-pending-icon-bg`** — `oklch(94% 0.05 75)`,
`ProfileCompletionNudge.tsx:67`, the round icon badge inside the onboarding
nudge card (H=75, exact pending match).

**6c. `--admin-status-pending-highlight-bg`** — `oklch(95% 0.05 75)`,
`AuditEventCard.tsx:109`, the `<mark>` search-match highlight inside
`renderTargetChipContent` (H=75, exact pending match). Functionally this is
a generic "search hit" highlighter, not a status indicator, but since the
code already pairs it with `--admin-status-pending-text` and its hue matches
that family exactly, extending the family beats inventing a whole new
"highlight" concept for one call site.

All three: direct shape-transfer (method C) from `--admin-status-pending-bg`
(96% 0.038 75 → 30% 0.050 75), the established convergence pattern shared by
every `*-bg`/`*-bg-strong` token in this file (dark L converges to ~28-33%
regardless of light L):

```
6a: L92→dark≈29 (bottom of the 28-33 band, since 92 sits furthest below the
    base's 96), C 0.030×~1.15→0.035, H 80 (unchanged)
6b: L94→dark≈30, C 0.05×~1.15→0.058, H 75 (unchanged)
6c: L95→dark≈31, C 0.05×~1.15→0.058, H 75 (unchanged)
```

`--admin-status-pending-avatar-bg: oklch(29% 0.035 80); /* 10.82:1 vs status-pending-text */`
`--admin-status-pending-icon-bg: oklch(30% 0.058 75); /* 10.47:1 vs status-pending-text */`
`--admin-status-pending-highlight-bg: oklch(31% 0.058 75); /* 10.18:1 vs status-pending-text */`

(Ratios are `--admin-status-pending-text`'s *dark* value, oklch(91% 0.080
82), against each new dark bg — confirms the already-dark-mode-ready
`status-pending-text` stays highly legible, ~10:1, on all three new tints.)

### 7. `--admin-status-pending-chip-icon`
Literal `oklch(55% 0.16 70)` × 1, `AuditEventCard.tsx:32`, the Pencil icon
tint for the "pending" (state-change) audit-event chip in `chipMeta()`. Its
three siblings in the same switch (`confirmed`, `cancelled`, `restricted`)
use hues 155/25/280 and belong to other families' sweeps. C=0.16 and H=70
are an **exact** match to `--admin-chart-status-pending`'s light value
(`oklch(70% 0.16 70)`) — not to `--admin-status-pending-text` (C 0.12, H 55).
Named `-chip-icon` rather than reusing my `-icon` name below because it's a
different light value and a different, more-saturated register (this is a
per-chip glyph tint, not a general icon).

Naive method A against `--admin-chart-status-pending` breaks (Δlight =
55−70 = −15 → dark_L = 82−(−15) = 97, implausibly bright for a small glyph,
and — more importantly — `--admin-chart-status-pending` is a standalone
chart-fill, not a foreground/background contrast pair, so the "more distance
from canvas = more emphasis" premise the flip depends on doesn't hold for it).
Used method C (direct, non-flipped) instead: ΔL=+12 (70→82), C-ratio =
0.84375, ΔH=+5 → dark_L=55+12=67, dark_C=0.16×0.84375=0.135, dark_H=75.

`--admin-status-pending-chip-icon: oklch(67% 0.135 75); /* 5.67:1 vs panel */`

(Re-measured at 67%, not the 80% I sanity-checked earlier in scratch work —
kept the direct-transfer number since `--admin-chart-status-pending` is the
correct un-flipped sibling for a standalone fill. 5.67:1 still clears AA
4.5:1 comfortably, just with less headroom than the other icon tokens below,
which is expected: it's the darkest of the three icon tokens in dark mode.)

### 8. `--admin-status-attention-icon`
Literal `oklch(40% 0.13 55)` × 1, `staff/page.tsx:698`, `WorkloadSegment`'s
icon colour for `tone === "warning"`. C=0.13, H=55 are an exact match to
`--admin-status-attention-text`'s light value (only L differs: 40 vs 26) —
this is a lighter-weight icon tint of the same colour, used standalone (the
icon sits on a `bg-transparent`/`bg-panel-muted` pill background that varies
by `isActive`, not one fixed surface), so it's the "standalone coincidental
match" case (method C, not a flip, since it isn't modifying
`--admin-status-attention-text` in the same visual context — it's a
different component entirely).

Direct shape-transfer from `--admin-status-attention-text` (26% 0.13 55 →
90% 0.068 70) is what actually produces the collision the brief warns about
(ΔL=+64 → 40+64=104, out of range), so I positioned this one inside the
convergence band instead, biased toward the low-middle of it to reflect that
its light-mode version was already lighter/softer than the base text colour:

`--admin-status-attention-icon: oklch(83% 0.068 70); /* 10.17:1 vs panel */`

### 9. `--admin-status-pending-icon`
Literal `oklch(40% 0.12 55)` × 1, `staff/page.tsx:700`, the same
`WorkloadSegment` icon function's `tone === "info"` colour. **This is the
"0.01 chroma drift" the brief calls out against #8** — but the two aren't
actually the same intended colour gone slightly wrong: C=0.12/H=55 is an
exact match to `--admin-status-pending-text`'s light value (28% 0.12 55),
while #8's C=0.13/H=55 exactly matches `--admin-status-attention-text`
(26% 0.13 55). The "drift" is real in the sense that a human wouldn't
distinguish these two icon colours by eye (attention-text and pending-text
themselves only differ by 0.01 chroma), but structurally they trace to two
different existing status families, which is why I minted two tokens rather
than one. Reported, not unified, per instruction.

Same reasoning as #8, biased toward `--admin-status-pending-text`'s own
dark value (91% 0.080 82):

`--admin-status-pending-icon: oklch(84% 0.080 82); /* 10.59:1 vs panel */`

### 10. `--admin-progress-warning`
Literal `oklch(78% 0.13 55)` × 1, `staff/page.tsx:828`, `ProgressDots`'
`tone === "warning"` dot fill. C=0.13/H=55 again exactly matches
`--admin-status-attention-text` **and** `--admin-warning-solid` (both are
`oklch(26% 0.13 55)` in this file already — two different token names
sharing one light value, existing precedent for that shape). Since this dot
is a **fill**, not text, `--admin-warning-solid` (also a fill role) is the
better-matched sibling for hue-shift purposes even though the actual number
comes from convergence-band placement. Named to extend
`--admin-progress-neutral` (an existing sibling in the same "tick/progress
fill" naming lane) rather than the status family, since `ProgressDots` is a
generic progress primitive, not a status badge.

Light L (78%) already sits inside the convergence band itself, so only a
small nudge is warranted — used `--admin-warning-solid`'s own ΔH (+5, 55→60)
and its chroma-drops-as-L-rises pattern (its own hover goes 0.130→0.095 as L
rises 78→86):

`--admin-progress-warning: oklch(82% 0.115 60); /* 9.70:1 vs panel */`

### 11. `--admin-price-numeral`
Literal `oklch(58% 0.135 72)` × 1, `BookingDetailSidebar.tsx:138`, an inline
`style={{ color: ... }}` (not a Tailwind class) on the booking total price.
The adjacent source comment reads *"Rahma Gold — DESIGN.md §2 sanctioned use:
Cormorant numeral on light canvas"* — i.e. this is explicitly the same
*role* as `--admin-cormorant-color` (decorative brand-gold serif numeral),
just a different specific shade someone hand-picked for this large hero
number rather than reusing the token. C=0.135 exactly matches
`--admin-warning`'s dark value; H=72 sits between `--admin-cormorant-color`'s
H=62 and the literal's own H=72.

Convergence-band placement, weighted toward `--admin-cormorant-color` for
hue continuity (since the source comment ties this to the same "Cormorant
numeral" concept) and toward `--admin-warning` for chroma:

`--admin-price-numeral: oklch(80% 0.135 68); /* 10.02:1 vs canvas */`

### 12. `--admin-status-attention-pill-hover`
Literal `oklch(90% 0.07 65)` × 1, `operations/event-row.tsx:172`, the hover
state of the `severity.tone === "warning"` pill, whose idle state is
`bg-[var(--admin-status-attention-bg)] text-[var(--admin-status-attention-text)]`
— same base token as #3, but a **different hover value** at a different,
punchier call site (a small severity pill vs. #3's larger disclosure
summary). Kept separate per "one distinct light value = one token"; named
`-pill-hover` to distinguish from #3's plain `-bg-hover`.

Method A (flip), same sibling `--admin-status-attention-bg` (95% 0.05 65 →
30% 0.055 65): Δlight = 90−95 = −5 → dark_L = 30−(−5) = 35; C-ratio = 1.1 →
dark_C = 0.07×1.1 = 0.077; dark_H = 65.

`--admin-status-attention-pill-hover: oklch(35% 0.077 65); /* 1.66:1 vs canvas */`

Self-consistency check: in light mode #12 darkens further than #3 (90 vs
92, i.e. −5 vs −3 from the shared 95% base) and in dark mode #12 also
lightens further than #3 (35 vs 33) — the ordering is preserved in both
directions, which is what "same inversion shape, applied twice" should look
like.

### 13. `--admin-hover-warm`
Literal `oklch(89% 0.014 78)` × 2, one `hover:bg` role
(`admin-scalable-lists.tsx:562`, the × button on `ActiveFilterChip`) and one
inside a `shadow-[0_1px_0_...]` role (`clients/page.tsx:922`, the active
`SortLink`'s bottom rim-highlight). Both are genuinely the same *visual
role* — a soft warm-neutral wash, painted through two different CSS
properties (`background-color` vs. `box-shadow` colour) rather than a
foreground/background mismatch, so one token covers both (the ROLE-MUST-MATCH
gotcha is about text-vs-bg confusion, not about which CSS property paints
the same flat wash). Neither site is tied to any status family — this is a
generic neutral hover/rim accent, so named as a sibling to the existing
`--admin-hover-mist` (the system's blue-hued general hover tint) rather than
folded into a status family. Nearest by *value* is `--admin-nav-border`
(H 75, C 0.014 exact match, L 88 vs our 89) even though it isn't the naming
precedent.

Direct shape-transfer (method C) from `--admin-nav-border` (88% 0.014 75 →
34% 0.012 75): ΔL=−54, C-ratio=0.857, ΔH=0 → dark_L=89−54=35,
dark_C=0.014×0.857=0.012, dark_H=78.

`--admin-hover-warm: oklch(35% 0.012 78); /* 1.54:1 vs panel */`

### 14. `oklch(55% 0.022 80)` — dead fallback, not a mint
`src/components/ui/input.tsx:30`:
`"border border-[var(--admin-border-form,oklch(55%_0.022_80))]"`. Verified:
`--admin-border-form` is declared in `:root` (tokens.css:203) as exactly
`oklch(55% 0.022 80)` — byte-identical to the fallback — and `:root` always
has a value, so `var(--admin-border-form, ...)`'s fallback arm can never
fire in any browser, any theme. This is not a literal needing a new token;
it's inert dead code sitting on an already-correct token reference.
Decision: `drop-dead-fallback`. Replace with the bare `var()` (no fallback).

## Drift observations (reported, not unified)

- `40% 0.13 55` (#8) vs `40% 0.12 55` (#9): same L/H, 0.01 chroma apart, and
  the brief already flags this pair. Traced to two different existing
  families (attention-text's chroma vs pending-text's chroma) rather than one
  value typo'd twice — see #8/#9 above.
- `80% 0.07 75` (#4) vs `82% 0.09 75` (#5): not flagged by the brief, but I
  think it's the same *shape* of drift — two independent "make the pending
  border pop more" edits at different strengths, both at the pending hue.
  Kept as two tokens (their light values are genuinely different bytes).
- `DuplicateWarningBanner.tsx`'s local constant name `ATTENTION_BORDER` (§4)
  names the wrong family — the colour itself is pending-hued, matching the
  file's own sibling `PENDING_BORDER` in `staff/[staffId]/availability/lib.ts`
  byte-for-byte. Not fixed here (renaming a local JS identifier is outside a
  token-substitution sweep) but flagged so whoever applies the substitution
  knows the mismatch is pre-existing, not introduced by this change.

## Ratio verification table (recomputed via the shipped colour math)

Computed with `oklchToRgb` / `contrastRatio`, imported read-only from
`scripts/verify-admin-token-contrast.mjs` (no file written, no source
modified):

| token | dark value | vs | ratio |
|---|---|---|---|
| `--admin-status-attention-text-muted` | `oklch(86% 0.073 70)` | status-attention-bg (dark) | 8.91:1 |
| `--admin-border-print` | `oklch(45% 0.020 80)` | panel (dark) | 2.32:1 |
| `--admin-status-attention-bg-hover` | `oklch(33% 0.066 65)` | canvas (dark) | 1.54:1 |
| `--admin-status-pending-border-strong` | `oklch(51% 0.087 75)` | panel (dark) | 2.97:1 |
| `--admin-status-pending-border-vivid` | `oklch(49% 0.111 75)` | panel (dark) | 2.71:1 |
| `--admin-status-pending-avatar-bg` | `oklch(29% 0.035 80)` | status-pending-text (dark) | 10.82:1 |
| `--admin-status-pending-icon-bg` | `oklch(30% 0.058 75)` | status-pending-text (dark) | 10.47:1 |
| `--admin-status-pending-highlight-bg` | `oklch(31% 0.058 75)` | status-pending-text (dark) | 10.18:1 |
| `--admin-status-pending-chip-icon` | `oklch(67% 0.135 75)` | panel (dark) | 5.67:1 |
| `--admin-status-attention-icon` | `oklch(83% 0.068 70)` | panel (dark) | 10.17:1 |
| `--admin-status-pending-icon` | `oklch(84% 0.080 82)` | panel (dark) | 10.59:1 |
| `--admin-progress-warning` | `oklch(82% 0.115 60)` | panel (dark) | 9.70:1 |
| `--admin-price-numeral` | `oklch(80% 0.135 68)` | canvas (dark) | 10.02:1 |
| `--admin-status-attention-pill-hover` | `oklch(35% 0.077 65)` | canvas (dark) | 1.66:1 |
| `--admin-hover-warm` | `oklch(35% 0.012 78)` | panel (dark) | 1.54:1 |

Reference reproduction command (read-only, nothing written):
```
node --input-type=module -e "
import { oklchToRgb, contrastRatio } from './scripts/verify-admin-token-contrast.mjs';
const r = (fg,bg) => contrastRatio(oklchToRgb(...fg), oklchToRgb(...bg));
console.log(r([86,0.073,70],[30,0.055,65]).toFixed(2));
"
```

## Note on `--admin-status-pending-chip-icon`'s final number

Early scratch work in this session tried `oklch(80% 0.135 75)` for this
token before I re-derived it properly against the correct (non-flipped,
direct-transfer) shape from `--admin-chart-status-pending`; the corrected,
actually-used value is `oklch(67% 0.135 75)` as shown in §7 and the ratio
table above. Flagging this explicitly in case any earlier number leaked into
a different note — the ratio table and §7 are authoritative.
