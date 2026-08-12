# Item 7 — Family F3: Neutral warm surfaces, hue 88

Read-only derivation. This file is the only write this agent performed; no
`src/`, `scripts/`, `e2e/` or `supabase/` file was touched. All numbers below
were computed, not guessed, using the shipped `oklchToRgb`/`contrastRatio`
from `scripts/verify-admin-token-contrast.mjs` (imported read-only into a
scratchpad script) plus a hand-written forward sRGB→OKLCH conversion (needed
only to place the file's existing `#hex` tokens on the same OKLCH map — the
shipped script only ever goes the other direction).

## Method

1. Read the full `TAIL-CENSUS.md` entries for all 5 hue-88 literals and the
   complete 94-token vocabulary table.
2. Read `src/styles/tokens.css` in full — all four blocks, every hue-88
   surface token's light→dark shape.
3. Read every call site's surrounding JSX (not just the census's truncated
   context line) to learn what each literal actually paints.
4. Converted every existing hue-88 hex token (`--admin-canvas`, `--admin-panel`,
   `--admin-panel-muted`, `--admin-restricted-bg`, `--admin-progress-neutral`)
   to OKLCH so "nearest existing sibling" could be judged by real coordinates,
   not by eye.
5. For each of my 5 literals, matched it against the nearest sibling by
   **hue + chroma + lightness + role**, then copied that sibling's dark-value
   **shape** (not a formula — this system's hue-88 surfaces don't invert by a
   fixed offset; each dark value was hand-placed in its own visual-hierarchy
   band, see the "shape" table below) rather than inventing a new one.
6. Sanity-checked every new dark value against the actual foreground token(s)
   rendered on it, in dark mode. All comfortably clear AA (see the "sanity
   checks" table).

## The existing hue-88 surface family (converted to OKLCH, light→dark)

```
--admin-canvas               #fbf8f2 (97.98% 0.0086  85°) -> oklch(17% 0.008 88)
--admin-panel                #fffefa (99.67% 0.0054  95°) -> oklch(22% 0.008 88)
--admin-panel-muted          #faf6ef (97.43% 0.0102  82°) -> oklch(26% 0.008 88)
--admin-surface-input        oklch(98.5% 0.005 88)        -> oklch(25% 0.008 88)
--admin-skeleton-base        oklch(95%   0.008 88)        -> oklch(26% 0.008 88)
--admin-skeleton-highlight   oklch(98%   0.008 88)        -> oklch(32% 0.008 88)
--admin-restricted-bg        #f1eee8 (94.98% 0.0086  85°) -> oklch(27% 0.006 88)
--admin-action-outline-bg    #ffffff                      -> oklch(22% 0.008 88)
--admin-on-primary (FG, not a surface) oklch(99.5% 0.003 88) -> oklch(18% 0.012 88)
```

Every neutral hue-88 **surface** (bg-role) token in this file inverts
near-white → near-black; the exact dark L (17–32%) is chosen by how "raised"
the surface is in the stack, not by a formula on the light L (`--admin-canvas`,
the furthest-back layer, gets the darkest dark value, 17%, despite not having
the lowest light L — `--admin-panel`, the lightest at 99.7%, sits at a
comparatively brighter 22% because it's meant to read as "in front of"
canvas). `--admin-on-primary` is the one exception, and it's a **foreground**
token whose inversion serves text legibility on a lightened fill — not a
surface, and explicitly excluded as a shape to copy per the brief's gotcha.

## The 5 literals

### 1. `oklch(97.8% 0.006 88)` — 3 occurrences → **new token `--admin-page`**

- `src/app/admin/audit/AuditEventCard.tsx:231` — fallback inside
  `bg-[var(--admin-page,_oklch(97.8%_0.006_88))]`, the "before/after JSON diff"
  well nested inside a `<details>` panel.
- `src/app/admin/components/AdminTopNav.tsx:529` — desktop account-menu
  dropdown's identity header strip. **The line right above it (`:527`) is a
  code comment that names the exact intent: "Identity header — canvas tint
  (97.8%) separates this zone from the nav items (panel 99.2%) below."**
- `src/app/admin/components/AdminTopNav.tsx:804` — the mobile equivalent of
  the same header, comment at `:803`: "Identity header — canvas tint creates
  zone distinction from nav items below."

**Both authorial comments call this literal "canvas tint" outright**, and its
OKLCH coordinates (97.8% 0.006 88) are visually indistinguishable from
`--admin-canvas`'s real value (97.98% 0.0086 85° — a difference of 0.18% L,
0.003 chroma, well under one just-noticeable-difference). It is not
byte-identical to `--admin-canvas` (`#fbf8f2`), so it cannot be pointed at
that token directly without moving light-mode by a fraction of a percent —
but it is unambiguously the *same concept*, used as an inset "recessed zone"
tint inside a panel, exactly the role `--admin-canvas` plays for the whole
page.

**Confirms the ⛔ gotcha in the brief is real and already partly fixed in
source**: `AuditEventCard.tsx:195` (a different, non-literal site, NOT in my
census — not touched) already writes `bg-[var(--admin-page,_var(--admin-panel))]`,
reaching for a token named `--admin-page` that has never existed anywhere in
`tokens.css`. Verified with `Grep -r "admin-page" src/styles` → zero
declarations. Minting `--admin-page` for real fixes that phantom-token dark-mode
defect (line 195 will resolve correctly for the first time) as a side effect of
naming this token what the code already calls it, and also lets `:231`'s dead
inline fallback be dropped.

- **Nearest sibling / shape**: `--admin-canvas` (same hue/chroma/lightness,
  same "recessed neutral zone" role). Dark copies its shape exactly.
- **Light**: `oklch(97.8% 0.006 88)` (byte-identical to the literal — unchanged)
- **Dark**: `oklch(17% 0.008 88)` (= `--admin-canvas` dark, verbatim)
- **Sanity**: `--admin-heading` dark (96% 0.010 88) vs page dark (17%) →
  **17.08:1**. `--admin-text-muted` dark (74% 0.010 88) vs page dark → **8.33:1**.
  Both comfortably clear AA; both texts genuinely render on this token at the
  AdminTopNav sites (name/role, name/subtitle).

### 2. `oklch(99.2% 0.004 88)` — 2 occurrences → **new token `--admin-card-bg`**

- `src/app/admin/audit/AuditFilterStrip.tsx:382` — the 2px "gap" ring inside
  a compound `shadow-[0_0_0_2px_oklch(99.2%_0.004_88),0_0_0_3px_var(--admin-primary)]`
  on the active date-range chip. Confirmed (`Grep` on the file) the chip's
  actual parent card is `bg-[var(--admin-panel)]` (`:114`) — this is a
  background-matching spacer ring, functionally identical to the
  `focus-visible:ring-offset-[var(--admin-panel)]` pattern used at ~11 other
  sites across `src/app/admin/**` (confirmed by grep), just implemented as a
  raw box-shadow instead of Tailwind's `ring-offset` utility.
- `src/app/admin/emails/templates/components/LivePreview.tsx:194` — the
  bordered card wrapping the email-template preview iframe/skeleton.

Both sites are functioning as **"the panel surface"** — one directly as a
card fill, one as a ring spacer that has to match the surrounding panel so
the accent ring reads as "floating." `--admin-panel`'s real OKLCH is
99.67% 0.0054 95° — extremely close (0.47% L, and slightly *less* chroma, so
if anything a hair cooler/less-warm than panel) but not byte-identical, so it
cannot be reused directly. This reads as **accidental drift** from `--admin-panel`
(two people, two moments, same intended colour, marginally different
typed-in numbers) rather than a deliberately distinct tone — reported per the
brief's instruction, not silently unified (light stays exactly the literal).

- **Nearest sibling / shape**: `--admin-panel` (same hue, same "card surface"
  role, the token both call sites are visually standing in for).
- **Light**: `oklch(99.2% 0.004 88)` (byte-identical to the literal — unchanged)
- **Dark**: `oklch(22% 0.008 88)` (= `--admin-panel` dark, verbatim)
- **Sanity**: `--admin-body` dark (90% 0.010 88) vs card-bg dark (22%) →
  **12.93:1** (this token doesn't have one fixed rendered foreground at either
  site — the ring is decorative, LivePreview's content is an arbitrary
  iframe/skeleton — so `--admin-body`, the generic default text tone, is used
  as a representative check, matching how the shipped verifier already treats
  `--admin-panel` itself: a generic surface, tested against body/heading/muted
  text, not one fixed pairing).

### 3. `oklch(99.5% 0.003 88)` — 2 occurrences → **new token `--admin-badge-bg`** (⛔ role-disagreement site)

- `src/app/admin/clients/[clientId]/page.tsx:656` — an icon-well circle
  (`<CalendarCheck>`) sitting *inside* the green `bg-[var(--admin-status-confirmed-bg)]`
  "Next visit" card, paired with `text-[var(--admin-status-confirmed-text)]`.
- `src/app/admin/clients/[clientId]/page.tsx:888` — a count pill sitting on
  top of the *active* tab's `bg-[var(--admin-primary)]` fill, at 30% opacity
  (`bg-[oklch(99.5%_0.003_88)]/30`), paired with `!text-[var(--admin-on-primary)]`.

This is the literal the brief flags as byte-identical to `--admin-on-primary`
(confirmed: `oklch(99.5% 0.003 88)` is exactly `--admin-on-primary`'s light
value). **Read the brief's own two gotcha paragraphs against the actual
tokens.css text carefully — they conflict, and the second one is the one that
matches the file.** The first paragraph says reusing this as a background
"paints a near-white panel in dark mode." The very next paragraph — and the
token itself, read directly at `tokens.css:392` — says `--admin-on-primary`
**flips to near-***black*** in dark (`oklch(18% 0.012 88)`)**, not white. The
practical conclusion is the same either way (`--admin-on-primary` is a
*foreground* whose inversion is tuned for text-on-a-lightened-fill, not for
being a background fill itself, so its shape is wrong for this role
regardless of which direction it moves) — but the "near-white panel" framing
in the first paragraph does not describe what would actually render if you
made that mistake here; the near-black one does. Flagging this because the
brief says to verify claims, not repeat them.

The correct move, per every neutral hue-88 **background**-role token in this
file (with zero exceptions among backgrounds): follow the standard
near-white→near-black surface shape. The closest sibling **by role** — a
white *fill* used for a small badge/button surface, not a big page panel — is
`--admin-action-outline-bg` (`#ffffff` → `oklch(22% 0.008 88)`), which shares
the same dark target as `--admin-panel`/`--admin-surface` (all three
"white-ish surface" tokens in this file converge on `oklch(22% 0.008 88)` in
dark — a well-established convergence point, not a number invented for this
token).

- **Nearest sibling / shape**: `--admin-action-outline-bg` (white *fill* role,
  not a page panel — matches "icon well / pill fill" better than `--admin-panel`
  itself, though both share the identical dark target).
- **Light**: `oklch(99.5% 0.003 88)` (byte-identical to the literal — unchanged)
- **Dark**: `oklch(22% 0.008 88)`
- **Sanity, site 656 (opaque, directly computable)**: `--admin-status-confirmed-text`
  dark (89% 0.105 158) vs badge-bg dark (22%) → **12.97:1**.
- **Site 888 is NOT independently computable**: the pill uses `/30` alpha
  composited over whatever's behind it (the active tab's `--admin-primary`
  fill, which itself lightens to 76% L blue in dark mode), and the shipped
  verifier's `resolveColour`/`contrastRatio` don't do alpha compositing
  against a variable backdrop — so no ratio comment is claimed for this
  pairing. Worked through by hand as a sanity check only: dark-mode composite
  of a 22%-L near-black at 30% opacity over a 76%-L fill lands the pill
  substantially lighter than the fill's own near-black on-primary text-only
  contrast baseline (`tokens.css:461`'s own comment states on-primary already
  clears 8.88:1 against the *raw*, uncomposited dark primary fill) — the
  composite, being lighter than raw near-black-on-fill, can only have *more*
  headroom, not less. No AA risk identified, but not claimed as a machine-checked number.
- **No inline `/* N:1 vs X */` ratio comment recommended** for this token in
  `tokens.css` — it has two genuinely different real-world foreground
  pairings (a fully opaque one and a 30%-alpha one), so there is no single
  honest "vs" target the way `--admin-danger-solid`/`--admin-warning-solid`
  have one (`on-primary`, always at full opacity). Forcing one pairing into
  the comment would misrepresent the other call site.

### 4. `oklch(96% 0.012 88)` — 2 occurrences → **new token `--admin-avatar-bg`**

- `src/app/admin/emails/page.tsx:716` — the default/neutral delivery-event
  icon circle (used when the event is neither `failed` nor missing a
  recipient — its siblings in the same ternary use
  `--admin-status-cancelled-bg`/`--admin-status-attention-bg`), paired with
  `text-[var(--admin-primary)]`.
- `src/app/admin/emails/page.tsx:909` — a contact-initials avatar circle,
  same `text-[var(--admin-primary)]` pairing.

Both are neutral (non-status) circular icon/initials wells with **the same
fixed foreground at both sites**: `--admin-primary`. This exact pattern
already exists once, verbatim, elsewhere in the codebase using a *different*
neutral tone: `AdminTopNav.tsx:503`'s own initials circle is
`bg-[var(--admin-panel)] text-[var(--admin-primary)]`. This literal (96%
0.012 88) is warmer/deeper than plain `--admin-panel` (99.67% 0.0054) and
sits almost exactly on `--admin-panel-muted` (97.43% 0.0102 82°) — close in L,
C and H, but not byte-identical, so `--admin-panel-muted` can't be reused
directly.

- **Nearest sibling / shape**: `--admin-panel-muted` (97.4% 0.0102 82° → 26%
  0.008 88 — nearest existing token by L/C/H and by "muted neutral surface"
  role).
- **Light**: `oklch(96% 0.012 88)` (byte-identical to the literal — unchanged)
- **Dark**: `oklch(26% 0.008 88)` (= `--admin-panel-muted` dark, verbatim)
- **Single, consistent, fully-opaque foreground pairing at both sites** —
  this is the one token in the family that matches the file's real
  dark-declaration-only ratio-comment convention (as used by
  `--admin-danger-solid`/`--admin-warning-solid`/`--admin-sparkline-stroke` —
  confirmed by re-reading `tokens.css`: those three carry the comment **only**
  on the `[data-theme="dark"]` line, not on `:root`/`[data-theme="light"]`/
  `@media print`, contrary to how `--admin-danger-text-strong`/
  `--admin-warning-text-strong` carry it in all four blocks — the dark-only
  shape is the one that matches tokens minted by this same ITEM 7 effort).
  - Dark: `--admin-primary` dark (76% 0.098 240) vs avatar-bg dark (26%) →
    **7.34:1**.
  - Light (sanity only, not inlined): `--admin-primary` light (`#0f5e8e`) vs
    avatar-bg light (96%) → **6.19:1**.
- **Recommended inline comment** (dark declaration only, matching precedent):
  `--admin-avatar-bg: oklch(26% 0.008 88);   /* 7.34:1 vs primary */`

### 5. `oklch(98.5% 0.005 88)` — 1 occurrence → **dead fallback, no new token**

- `src/components/ui/input.tsx:27` — `"bg-[var(--admin-surface-input,oklch(98.5%_0.005_88))]"`.

Confirmed: `--admin-surface-input` is declared with this exact light value in
all four `tokens.css` blocks (`:204` root `oklch(98.5% 0.005 88)`, `:446` dark
`oklch(25% 0.008 88)`, `:573` light, `:689` print). Since the token always
resolves (it's declared in `:root`, which every element inherits absent a
closer override), this fallback can never fire in any theme — it is
genuinely dead, exactly as the brief states, and removing it changes nothing
in either theme. No new token minted.

- **Decision**: `drop-dead-fallback`.
- **Find**: `bg-[var(--admin-surface-input,oklch(98.5%_0.005_88))]`
- **Replace**: `bg-[var(--admin-surface-input)]`

## Ratio-comment convention — what I found by re-reading the file, not assuming

The brief's fixed method says "add a measured contrast-ratio comment on the
dark declaration in the existing convention." Re-reading `tokens.css` in
full, that convention is **not applied uniformly to every token** —
`--admin-panel`, `--admin-canvas`, `--admin-surface-input`,
`--admin-skeleton-base`/`-highlight`, `--admin-action-outline-bg` (pure
surfaces, no single fixed foreground) carry **no** ratio comment anywhere.
Only tokens with one clean, fixed, fully-opaque foreground pairing get one —
and the three most recently minted by this same ITEM 7 effort
(`--admin-danger-solid`, `--admin-warning-solid`, `--admin-sparkline-stroke`)
put it **only on the `[data-theme="dark"]` declaration**, not on
`:root`/`[data-theme="light"]`/`@media print`.

Applying that precedent honestly: only `--admin-avatar-bg` has the shape that
convention describes. `--admin-page` and `--admin-card-bg` are pure surfaces
like `--admin-panel`/`--admin-canvas` (no single fixed foreground — multiple
different text tokens render on them across their sites); `--admin-badge-bg`
has two *different*, non-interchangeable foreground pairings, one of which
isn't even fully opaque. I've computed and reported a representative ratio
for all four in the structured output (the schema requires one per token),
but I'd recommend the person applying this mechanically **only inline a
`/* N:1 vs X */` comment into `tokens.css` for `--admin-avatar-bg`** — adding
one to a pure surface token would be new, not a continuation of an existing
pattern, and risks reading as a claim about "the" foreground when none of the
three has just one.
