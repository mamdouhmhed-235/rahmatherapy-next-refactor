# Family F1 — modal/dialog scrim (`oklch(12% 0.01 165)` and two siblings)

Read-only derivation. 3 distinct literals, 18 occurrences, all near-black
(L 11-12%, C 0.01-0.014) dimming layers painted **behind** a modal/dialog/
command-palette/drawer panel, never a foreground.

| Literal | Occurrences | Site pattern |
|---|---|---|
| `oklch(12% 0.01 165)` | 16 | `bg-[oklch(12%_0.01_165)]/NN` (NN = 30, 35 or 40), a `<div>`/`BaseDialog.Backdrop` |
| `oklch(11% 0.014 155 / 0.45)` | 1 | `backdrop:bg-[oklch(11%_0.014_155_/_0.45)]` on a native `<dialog>`, alpha baked in |
| `oklch(12% 0.014 155)` | 1 | `bg-[oklch(12%_0.014_155)]/35`, same shape as the 16x literal |

All 16 sites for the first literal were re-read from source (not taken on
census trust alone) to confirm the exact bracket text and that none carries a
variant prefix (`hover:` etc.) — all 16 are plain `bg-`.

## One concept, three byte-distinct values

Functionally these are the same thing: an opaque near-black paint, made
translucent by whatever alpha the call site applies, sitting behind a panel
to make it recede. Hue 155 vs 165 at chroma 0.01-0.014 is not a deliberate
design choice — at that chroma the hue is nearly imperceptible (both read as
"near black with a whisper of green"); this reads as three authors typing a
"black scrim" from memory at slightly different times, one of them possibly
carrying over the old pre-rebrand green hue (155 is the hue every other
now-retired "clinic green" literal in this codebase used — see F2's
`oklch(23% 0.073 155 / A)` shadow family).

Per the fixed method, "one distinct light value = one token" bars merging
them even so: three byte-different `--admin-*` light values must become
three tokens. What differs between them is **not** three tokens' worth of
visual intent, and I've named accordingly (see below) rather than inventing
three unrelated concepts.

The alpha placement, though, is a real architectural split, not drift:
- 17 of 18 occurrences (both `bg-` literals) apply alpha **externally**, via
  Tailwind's `/NN` opacity modifier on the class, exactly like the existing
  `bg-[var(--admin-panel)]/95` in `RoleMetadataForm.tsx:216`. The modifier is
  a static string in the JSX — it does not vary by `data-theme` — so whatever
  alpha a site names today (30/35/40%) is the alpha it gets in **both**
  themes. The token itself must therefore stay fully opaque in every block.
- The `backdrop:` literal bakes its alpha into the colour itself (there is no
  `/NN` on that class). Its token can carry alpha, and that alpha genuinely
  can move independently per theme.

This split is why the three tokens do not all invert the same way (see
"Dark-mode value" below) even though their light values look nearly
identical.

## Naming

No existing "scrim" family exists (`--hero-scrim-token` and
`--image-card-scrim-token` are public-site shared tokens, out of scope for
`--admin-*` — the theme-block comment explicitly forbids shared tokens from
appearing there). Minted a new 3-member family:

| Token | Literal | Sites | Why this name |
|---|---|---|---|
| `--admin-scrim` | `oklch(12% 0.01 165)` | 16 | Canonical — the dominant, repeated value across 16 files is the "real" scrim; the name states the role with no qualifier. |
| `--admin-scrim-alt` | `oklch(12% 0.014 155)` | 1 (`attention-group-client.tsx:145`) | Same role, same site *shape* (`fixed inset-0 ... bg-[...]/35`) as `--admin-scrim`'s 16 sites — this is drift off the canonical value, not a distinct design state, so it's named as a sibling variant rather than something that claims its own purpose. |
| `--admin-scrim-dialog` | `oklch(11% 0.014 155 / 0.45)` | 1 (`ClientCreateForm.tsx:507`, `NoContactDialog`) | Names the mechanism that makes it different: it paints a native `<dialog>` element's `::backdrop` via Tailwind's `backdrop:` variant, with alpha baked into the token rather than supplied by a class modifier — architecturally distinct from the other two, not just numerically close to them. |

## Why contrast ratio is the wrong measure, with numbers

A scrim is not a foreground read against a background — it's a translucent
paint composited *in front of* whatever surface is behind it, and the panel
it's meant to set off sits **on top of it**, unaffected by it. WCAG contrast
ratio measures foreground-vs-background text legibility; there is no text
here and the "background" the scrim paints over isn't what it's being judged
against. Worse, I can show the WCAG ratio formula is actively misleading in
this specific near-black-on-near-black regime — not just conceptually wrong,
numerically uninformative.

**Method**: standard non-premultiplied "source-over" alpha compositing in
gamma-encoded sRGB channel space (`composite = alpha·overlay + (1-alpha)·base`,
per channel, 0-255) — what a browser does for a plain translucent
`background-color` paint, no blend-mode involved. I reused the *exact*
`oklchToRgb` / `relativeLuminance` / `contrastRatio` functions from
`scripts/verify-admin-token-contrast.mjs` (copied into a throwaway scratch
script, run with `node`, nothing under `src/`/`scripts/` touched) so every
number below is traceable to the shipped verifier's own colour math, not a
hand estimate.

Reference surfaces (relative luminance Y, 0=black, 1=white):

| Surface | Light Y | Dark Y |
|---|---|---|
| `--admin-canvas` | 0.9405 | 0.0048 |
| `--admin-panel` | 0.9905 | 0.0104 |

### `--admin-scrim` / `--admin-scrim-alt` (external alpha, frozen per theme)

Light (`oklch(12% 0.01 165)`, base Y=0.0018), composited over canvas Y=0.9405:

| Site alpha | Composite Y | Fraction of canvas luminance remaining |
|---|---|---|
| 30% | 0.4334 | 46.1% |
| 35% | 0.3695 | 39.3% |
| 40% | 0.3124 | 33.2% |

A dramatic, obvious dimming — canvas luminance roughly halves-to-thirds, and
the panel (Y=0.9905, essentially untouched, since it sits above the scrim)
pops forward against it.

Dark, canvas Y=0.0048 is already within 1% of the luminance floor. Two
candidates, same frozen alpha (it cannot change per theme, see above):

| Site alpha | Composite Y, literal unchanged | Composite Y, hue-neutral black `oklch(0% 0 0)` | WCAG ratio vs panel, unchanged | WCAG ratio vs panel, pure black |
|---|---|---|---|---|
| 30% | 0.0039 | 0.0034 | 1.12:1 | 1.13:1 |
| 35% | 0.0036 | 0.0030 | 1.13:1 | 1.14:1 |
| 40% | 0.0035 | 0.0028 | 1.13:1 | 1.15:1 |

**Finding**: reusing the light literal unchanged does not do the scrim's job
in dark mode — composite Y barely moves off the already-near-zero canvas
(0.0048 → 0.0036 at 35%, an 25% relative reduction vs light's 61% relative
reduction at the same alpha). Going hue-neutral improves this only
marginally (0.0036 → 0.0030) because there is essentially no headroom left
below an already-near-floor canvas: the WCAG-formula ratio moves from
1.13:1 to 1.14:1, i.e. **the ratio itself is nearly invariant to this
change and cannot discriminate a real, if small, improvement** — this is the
concrete demonstration that contrast ratio is the wrong tool here, not just
an assertion. I chose hue-neutral black anyway because (a) it is
monotonically the darker, more-correct answer, (b) it matches this file's
own established inversion shape for ambient darkening overlays
(`--admin-shadow-hover`/`-overlay` both go to literal `oklch(0% 0 0 / …)` in
dark — see next section), and (c) it removes any chance of a visible green
cast bleeding through against the warm hue-88 dark canvas/panel, at zero
cost since the light render is untouched.

The panel/backdrop separation dark mode *does* get comes from
`--admin-panel` and `--admin-canvas`'s own dark values (Y 0.0104 vs 0.0048 —
panel is already ~2.2x the canvas's luminance with **zero** scrim), not from
this token — an honest limit of what a frozen-alpha, external-modifier token
can contribute, given I can't touch the `/NN` suffixes in JSX without moving
light-mode rendering (the same class string renders in both themes).

### `--admin-scrim-dialog` (self-contained alpha — no external modifier)

Light (`oklch(11% 0.014 155 / 0.45)`, base Y=0.0013), alpha 45% baked in,
over canvas Y=0.9405: composite Y=0.2568 — 27.3% of canvas luminance
remains (72.7% reduction).

Because this token's alpha is NOT supplied by a call-site modifier, it can
move independently per theme without touching light rendering at all. I
picked the dark alpha by matching the *fraction* of ambient luminance the
scrim removes, not the absolute amount (matching absolute Y is meaningless
when one canvas is ~200x brighter than the other):

| Dark alpha (hue-neutral black base) | Composite Y | Fraction of dark-canvas Y remaining | WCAG ratio vs panel |
|---|---|---|---|
| 0.45 (unchanged) | 0.0024 | 50.0% | 1.15:1 |
| 0.60 | 0.0018 | 37.5% | 1.17:1 |
| 0.70 | 0.0015 | 31.3% | 1.17:1 |
| **0.75 (chosen)** | **0.0012** | **25.0%** | **1.18:1** |
| 0.80 | 0.0009 | 18.8% | 1.19:1 |

0.75 keeps 25% of ambient luminance, closest of the tested steps to light's
27.3% — i.e. dark mode removes *the same proportion* of the light the panel
sits against, which is the only version of "matching" that means anything
across two canvases this far apart in absolute luminance. Note again how
compressed the WCAG-ratio column is (1.15 → 1.19 across a 0.45→0.80 alpha
sweep that nearly doubles how much luminance is stripped) — the ratio
formula's `+0.05` floor, calibrated for text-legibility contrast at normal
luminance, swamps everything once both colours being compared sit this close
to zero. That compression is exactly why the fraction-of-luminance-remaining
measure is used here instead, and why no `/* N.NN:1 vs … */` comment is
written on this declaration in tokens.css — that exact-format comment is
mechanically re-verified by `scripts/verify-admin-token-contrast.mjs` as an
ordinary WCAG foreground/background claim, which is not what this token is,
and it would pass (~1.18:1 clears nothing, but nothing built to fail on it
either) while saying nothing true about whether the scrim is doing its job.

## Dark-mode value: nearest existing sibling and its shape

The nearest existing family for "translucent ambient darkening overlay,
alpha baked into the token, no text ever reads against it" is
`--admin-shadow-hover` / `--admin-shadow-overlay` (tokens.css:209-210,
452-453). Its documented dark rule: *"Shadows drop the brand-blue tint: a
blue-tinted shadow is invisible on a dark canvas, so dark mode leans on
near-black at a higher alpha instead. Geometry is unchanged from the light
values."* Concretely: `--admin-shadow-hover` light `oklch(41% 0.105 247 /
0.08)` → dark `oklch(0% 0 0 / 0.5)` (hue dropped, alpha 0.08→0.5);
`--admin-shadow-overlay`'s two layers go 0.12→0.6 and 0.06→0.45. I mirrored
this exact shape: hue-neutral `oklch(0% 0 0)` base in dark, for all three
scrim tokens, with alpha raised only where the token's own alpha is free to
move (`--admin-scrim-dialog`, 0.45→0.75); for `--admin-scrim` /
`--admin-scrim-alt` the base is the only degree of freedom available (see
above), which is a real, disclosed, architectural constraint — not a
deviation from the shadow family's shape, just a smaller lever than that
family gets to use.

I considered `--admin-shell-ambient` (also self-contained alpha, tokens.css
219/457/579/697) as an alternative sibling but rejected it: it's a
*highlighting* glow (a warm peach wash, decorative gradient stop) that
**lightens** its surroundings, and its dark inversion *reduces* both
lightness (95%→42%) and alpha (0.45→0.30) because a bright wash would read
as a pale band on a dark canvas. A scrim's direction is the opposite — it
darkens — so the shadow family (also darkening, also ambient, also
self-contained-alpha for its non-modifier-driven members) is the correct
match, not the glow family.

## Token declarations (for the orchestrator to apply — this agent wrote none)

All four blocks, placed immediately after the existing `--admin-warning-
solid-hover` declaration (the most recent prior insertion point in each
block) and before the `--admin-chart-status-*` block that currently follows
it.

`:root` and `[data-theme="light"]` and `@media print` (byte-identical light
values in all three, per the fixed method):

```css
--admin-scrim: oklch(12% 0.01 165);
--admin-scrim-alt: oklch(12% 0.014 155);
--admin-scrim-dialog: oklch(11% 0.014 155 / 0.45);
```

`[data-theme="dark"]`:

```css
--admin-scrim: oklch(0% 0 0);
--admin-scrim-alt: oklch(0% 0 0);
--admin-scrim-dialog: oklch(0% 0 0 / 0.75);
```

No `/* N.NN:1 vs … */` trailing comment on any of the three dark
declarations — see "Why contrast ratio is the wrong measure" above for why
that would be a category error the shipped verifier would silently accept
without it meaning anything. A prose comment stating the composited-Y
reasoning (numbers as above, expressed as luminance fractions, not `N:1`
ratios, so it isn't swept into the verifier's prose-ratio checker either)
should accompany the three declarations in each of the light/:root and dark
blocks, summarising the two tables above.

## Site replacements (18 total, mechanical)

All 16 `--admin-scrim` sites share the identical find/replace pair (no
variant prefix on any of them, confirmed by re-reading every line from
source, not just the census):

- find: `bg-[oklch(12%_0.01_165)]`
- replace: `bg-[var(--admin-scrim)]`
- (the `/30`, `/35` or `/40` suffix immediately after the closing bracket is
  untouched at every site — it stays outside the bracket, exactly as today)

| # | file:line | role |
|---|---|---|
| 1 | `src/app/admin/account-password-requests/ApproveModal.tsx:84` | bg |
| 2 | `src/app/admin/account-password-requests/RejectModal.tsx:82` | bg |
| 3 | `src/app/admin/availability/BlockedDatesManager.tsx:225` | bg |
| 4 | `src/app/admin/bookings/new/ManualBookingForm.tsx:2394` | bg |
| 5 | `src/app/admin/bookings/SessionNotePromptSheet.tsx:73` | bg |
| 6 | `src/app/admin/components/admin-ui-interactions.tsx:184` | bg |
| 7 | `src/app/admin/components/admin-ui-interactions.tsx:295` | bg |
| 8 | `src/app/admin/components/AdminCommandSearch.tsx:128` | bg |
| 9 | `src/app/admin/components/AdminTopNav.tsx:784` | bg |
| 10 | `src/app/admin/components/AdminTopNav.tsx:947` | bg |
| 11 | `src/app/admin/roles/[roleId]/DangerZonePanel.tsx:161` | bg |
| 12 | `src/app/admin/roles/[roleId]/PermissionRow.tsx:218` | bg |
| 13 | `src/app/admin/services/DeleteServiceButton.tsx:86` | bg |
| 14 | `src/app/admin/services/ServiceFormDialog.tsx:85` | bg |
| 15 | `src/app/admin/settings/SettingsForm.tsx:469` | bg |
| 16 | `src/app/admin/staff/[staffId]/availability/StaffBlockedDatesManager.tsx:453` | bg |

`--admin-scrim-alt` (1 site):

- file: `src/app/admin/dashboard/attention-group-client.tsx:145`
- find: `bg-[oklch(12%_0.014_155)]`
- replace: `bg-[var(--admin-scrim-alt)]`
- (`/35` suffix untouched)

`--admin-scrim-dialog` (1 site):

- file: `src/app/admin/clients/new/ClientCreateForm.tsx:507`
- find: `backdrop:bg-[oklch(11%_0.014_155_/_0.45)]`
- replace: `backdrop:bg-[var(--admin-scrim-dialog)]`
- (no external modifier to preserve — alpha now lives entirely in the token)

## Scratch verification artefact

The compositing numbers above came from
`C:\Users\mamdo\AppData\Local\Temp\claude\...\scratchpad\scrim-calc.mjs`, a
throwaway script (not part of the repo, not committed) that copies
`oklchToRgb`/`relativeLuminance`/`contrastRatio` verbatim from
`scripts/verify-admin-token-contrast.mjs` and adds one small
`compositeOver()` helper for the alpha blend. Re-run with `node
scrim-calc.mjs` if the numbers need re-checking.
