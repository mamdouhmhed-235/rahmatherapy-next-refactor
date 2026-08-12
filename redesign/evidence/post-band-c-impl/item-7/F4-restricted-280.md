# F4 — Restricted / Neutral-Purple, hue 280

Read-only derivation. 8 distinct literals, 14 occurrences, all hue 280. Existing
family in `src/styles/tokens.css`:

```
--admin-status-restricted-bg:     light oklch(94% 0.008 280)  dark oklch(29% 0.010 280)
--admin-status-restricted-text:   light oklch(30% 0.02  280)  dark oklch(87% 0.014 280)
--admin-status-restricted-border: light oklch(88% 0.012 280)  dark oklch(42% 0.016 280)
```

Nearest same-shape sibling in the file: `--admin-status-completed-bg` (light
`oklch(94% 0.008 270)` / dark `oklch(29% 0.010 270)`) — identical L/C to
restricted-bg, hue 270 vs 280. Confirms the family's own light→dark shape is not
an accident of restricted specifically; it's the shared `-bg` shape used across
the status families (light+dark L sums to ~122–126 across confirmed / pending /
cancelled / attention / completed / restricted).

## Site-by-site reading

Read every consuming file before deciding a role, per the method.

### 91% 0.012 280 — 7×, `hover:bg` on the filter-clear chip

`AuditFilterStrip.tsx:258`, `calendar/page.tsx:650,660`,
`PrivacyFilterBar.tsx:363`, `reports/page.tsx:1288`, `SettingsForm.tsx:748`,
`staff/page.tsx:537` — all seven are the *identical* pattern: a pill/chip whose
resting bg is `var(--admin-status-restricted-bg)` and text is
`var(--admin-status-restricted-text)`, that darkens slightly on hover before the
user clicks the embedded `X` to clear the filter. Confirmed by direct read of
every site (not just the census excerpt) — same class shape, same role, same
literal, byte-for-byte. This is plainly the hover state of the base `-bg` token.
→ **mint `--admin-status-restricted-bg-hover`**, extending the family exactly as
the task brief's own example names it.

### 90% 0.012 280 — 1×, `hover:bg` on the severity badge

`operations/event-row.tsx:173`. Same rounded-full badge idiom, same base
(`bg-[var(--admin-status-restricted-bg)] text-[var(--admin-status-restricted-text)]`),
but this one sits beside two siblings for the OTHER severity tones in the same
ternary (`hover:bg-[oklch(90%_0.05_20)]` for danger, `hover:bg-[oklch(90%_0.07_65)]`
for warning — not my hue, out of scope) — all three tones hover to 90% L in this
component, while the filter-chip family above hovers to 91% L. This reads as
accidental 1-point drift between two independently-authored "hover state of a
status chip" call sites, not a deliberate second design. Per the method I do
**not** unify it into token #1 — one distinct light value, one token — but I
also don't invent a false distinct meaning for it. → **mint
`--admin-status-restricted-bg-hover-alt`**, named to say plainly "this is the
same role as `-bg-hover`, kept separate only because the light literal differs."

### 85% 0.012 280 + 20% 0.02 280 — 1× each, same site, two different roles

`SettingsForm.tsx:757` — the small circular "remove city" button *inside* the
85%-hover chip from site #1 above (`SettingsForm.tsx:748`). This button's own
resting bg is transparent; on hover it goes to `oklch(85%_0.012_280)` (a
noticeably deeper tint than the chip's own 91% hover — this is a smaller,
higher-emphasis dismiss control, not the chip body), and **simultaneously** its
text goes from the inherited `--admin-status-restricted-text` (30%) to
`oklch(20%_0.02_280)` — same chroma as the base text token, darker L, i.e. more
emphasis on hover, exactly mirroring the chip-hover pattern one level in.
These are two distinct roles (a bg role and a text role) that happen to fire on
the same `:hover`, so they're two literals / two tokens:
→ **mint `--admin-status-restricted-bg-hover-strong`** (the "remove" button's
own hover bg — extends `-bg-hover` with `-strong` because it's the deeper-tint
sibling of it, and "-strong" already means "deeper tint variant" elsewhere in
this file: `--admin-danger-bg-strong` etc.)
→ **mint `--admin-status-restricted-text-hover`** (extends
`--admin-status-restricted-text` with the file's standard `-hover` suffix,
exactly as `--admin-primary` → `--admin-primary-hover`).

### 42% 0.05 280 — 1×, standalone icon tint

`AuditEventCard.tsx:36`, inside `chipMeta()`. A small `Eye` icon's colour for
the "restricted" audit-event kind, alongside three sibling icons at other hues
(confirmed/pending/cancelled — not mine) — none of which is `-bg` or `-text`,
this stands alone on the panel, not paired with any bg. Distinct L/C from the
existing `--admin-status-restricted-text` (42%/0.05 vs 30%/0.02 — both lighter
*and* more saturated: an icon reads fine at a lighter, punchier tone than a text
label needs). Genuinely a third role, not a hover or a drift.
→ **mint `--admin-status-restricted-icon`**, extending the family with a new
`-icon` role slot alongside the existing `-bg` / `-text` / `-border`.

### 91% 0.022 280 — 1×, avatar swatch bg

`AuditEventCard.tsx:60-64`, inside `avatarTint()`. One of five rotating
actor-avatar background tints, paired directly with
`text-[var(--admin-status-restricted-text)]`. Distinct from the base `-bg`
token: same rough L (91 vs 94) but nearly 3× the chroma (0.022 vs 0.008) — an
avatar swatch needs more presence than a quiet status-chip fill. Not a hover
state (this function has no `:hover` in its output; it's a static per-actor
tint), so it doesn't belong beside `-bg-hover`.
→ **mint `--admin-status-restricted-avatar-bg`**.

### 94% 0.008 280 and 30% 0.02 280 — inline `style={{...}}` object, `ManualBookingForm.tsx:380-381`

```tsx
style={{
  background: "oklch(94% 0.008 280)",
  color: "oklch(30% 0.02 280)",
}}
```
This is a plain React inline-style object landing on a `<span>`'s `style`
attribute — not a Tailwind arbitrary-value class, not a canvas/SVG context, not
anything that pre-resolves the string before it reaches the DOM. A CSS custom
property reference (`"var(--admin-status-restricted-bg)"`) is exactly as valid
a `style.background` value as a literal colour string; the browser resolves it
identically to a stylesheet `var()`. Both literals are already byte-identical to
existing tokens (confirmed by the census AND independently re-verified below),
so these are straight substitutions, **no new token**:
`background` → `"var(--admin-status-restricted-bg)"`,
`color` → `"var(--admin-status-restricted-text)"`.

## Minted tokens — light values (byte-identical to the literals) and derived dark values

All L/C dark derivations use the *additive-delta* method, applied consistently
across every new token in this family: take the delta the light literal has
from its nearest existing sibling's light value, and apply that same delta (L
inverted in sign per the light-darkens/dark-lightens rule; C added in the same
direction, matching how every existing status-`-bg` family's dark chroma is
equal to or higher than its light chroma) to that sibling's dark value. This
"delta-flip" is mathematically identical to mirroring L through the family's own
light+dark sum constant (verified: restricted-bg and completed-bg both sum to
123 — the same constant, hue-independent), so it isn't a new inversion
philosophy, it's the existing one, made explicit and applied to points 1–2%L off
the token that already carries it.

All OKLCH→sRGB and contrast numbers below were computed by importing
`oklchToRgb` / `contrastRatio` directly from
`scripts/verify-admin-token-contrast.mjs` (the shipped verifier) into a scratch
Node script — not hand-estimated — so the ratio comments are the verifier's own
arithmetic, not an approximation of it.

### 1. `--admin-status-restricted-bg-hover`
- light `oklch(91% 0.012 280)` (byte-identical to the literal)
- dark `oklch(32% 0.014 280)` — derived: base bg sums to 123 (94+29); 123−91=32.
  Chroma: light delta from base (+0.004) applied to dark base (0.010) → 0.014.
- **8.56:1 vs `--admin-status-restricted-text`** (dark: fg rgb(210,211,222) vs
  bg rgb(49,50,58)) — the label never changes colour through hover, so this is
  the pairing that matters. Light-side sanity check: 10.45:1 (well clear of AA).

### 2. `--admin-status-restricted-bg-hover-alt`
- light `oklch(90% 0.012 280)` (byte-identical)
- dark `oklch(33% 0.014 280)` — same method: 123−90=33; chroma delta identical
  to token 1 (light C is the same 0.012), so dark C is the same 0.014.
- **8.19:1 vs `--admin-status-restricted-text`** (dark). Light-side: 10.09:1.

### 3. `--admin-status-restricted-bg-hover-strong`
- light `oklch(85% 0.012 280)` (byte-identical)
- dark `oklch(38% 0.014 280)` — 123−85=38; same chroma delta (+0.004→0.014) as
  the other two `-bg-hover*` tokens, since light C is again 0.012.
- **9.13:1 vs `--admin-status-restricted-text-hover`** (token 4 below) — the two
  fire on the exact same `:hover`, so that's the pairing that is actually
  rendered together, tighter and more meaningful than checking against the
  never-changing base text (which is also fine: 6.71:1 dark / 8.62:1 light).

### 4. `--admin-status-restricted-text-hover`
- light `oklch(20% 0.02 280)` (byte-identical)
- dark `oklch(97% 0.014 280)` — base text sums to 117 (30+87); 117−20=97.
  Chroma: light delta from base text is 0 (0.02 in both), so dark C stays at
  base text's dark C, 0.014. Darkens in light → lightens in dark, matching the
  rule; 97% is the brightest token minted here, but not out of family: it's
  only 1pt above the existing `--admin-heading` dark value (96%) and nowhere
  near the ceiling `--admin-on-primary` light already occupies (99.5%).
- **9.13:1 vs `--admin-status-restricted-bg-hover-strong`** (token 3, same pair
  as above, contrast is symmetric). Light-side: 11.47:1.

### 5. `--admin-status-restricted-icon`
- light `oklch(42% 0.05 280)` (byte-identical)
- dark `oklch(75% 0.044 280)` — nearest same-hue foreground sibling is the base
  text token (117 sum): 117−42=75. Chroma via the same additive-delta method:
  light delta from base text (0.05−0.02=+0.03) applied to base text's dark C
  (0.014) → 0.044.
- Standalone (no fixed bg partner — it's a small icon rendered directly on the
  audit-card panel), so ratio is measured the way the file's other standalone
  tokens are (`--admin-sparkline-stroke` → "vs `--admin-panel`"):
  **7.73:1 vs `--admin-panel`** (dark). Light-side vs `--admin-panel` (light):
  8.50:1.

### 6. `--admin-status-restricted-avatar-bg`
- light `oklch(91% 0.022 280)` (byte-identical)
- dark `oklch(32% 0.024 280)` — base bg sums to 123: 123−91=32 (same L as token
  1, since the light L happens to match). Chroma: light delta from base bg
  (0.022−0.008=+0.014) applied to base bg's dark C (0.010) → 0.024.
- **8.53:1 vs `--admin-status-restricted-text`** (dark, its paired foreground in
  `avatarTint()`). Light-side: 10.41:1.

All six clear WCAG AA (4.5:1) with wide margins in both light and dark — the
tightest is 6.71:1 (token 3 vs the base, non-hover text, reported above as a
secondary sanity check, not the comment's stated pairing) and every stated
ratio comment is ≥7.7:1.

## Reused tokens — no mint

- `oklch(94% 0.008 280)` (`ManualBookingForm.tsx:380`, inline `style.background`)
  → `var(--admin-status-restricted-bg)`. Byte-identical light value, role
  matches (both paint a background), and inline `style` objects resolve
  `var()` exactly like a stylesheet, so this is a safe direct substitution.
- `oklch(30% 0.02 280)` (`ManualBookingForm.tsx:381`, inline `style.color`)
  → `var(--admin-status-restricted-text)`. Same reasoning, foreground role.

## What was NOT unified

`90%/0.012/280` and `91%/0.012/280` are one point of L apart, same chroma, same
hue, same conceptual role (chip hover) — the closest thing to "obviously the
same token" in this family. They are kept as two tokens anyway, per the method's
explicit instruction not to move light mode by a single pixel: unifying them
would silently repaint `event-row.tsx`'s severity badge one point lighter (or
every filter-chip one point darker) on hover, in light mode, which is exactly
the kind of "fixed" defect the census's byte-identity rule exists to prevent.
The drift is real and worth someone deciding later whether `event-row.tsx`
should just consume `--admin-status-restricted-bg-hover` directly and drop the
`-alt` token — that is a design call, not a token-minting call, so it's flagged
here rather than made unilaterally.
