# F7 — brand green + neutral greens (hues 120–165)

14 distinct literals, 17 occurrences. All read from
`redesign/evidence/post-band-c-impl/item-7/TAIL-CENSUS.md` and re-verified against source.
Colour maths (oklch→rgb, contrast) copied verbatim from
`scripts/verify-admin-token-contrast.mjs` into a scratch script
(`f7-compute.mjs` / `colour.mjs`, not committed) so every number below matches
what the shipped verifier will independently recompute. Cross-checked: my
script reproduces tokens.css's own `--admin-primary` vs on-primary comment
(2.11:1 / 8.88:1, tokens.css:459-461) to the stated precision, which is the
basis for trusting the rest of these numbers.

## Decisions at a glance

| literal | occ | decision | token |
|---|---|---|---|
| `oklch(88% 0.055 155)` | 2 | new-token-pair | `--admin-status-confirmed-bg-hover` |
| `oklch(91.5% 0.045 155)` | 1 | new-token-pair | `--admin-status-confirmed-card-hover` |
| `oklch(95.5% 0.012 155)` | 2 | new-token-pair | `--admin-hover-moss` |
| `oklch(92% 0.022 155)` | 2 | new-token-pair | `--admin-active-moss` |
| `oklch(15% 0.065 155)` | 1 | new-token-pair | `--admin-button-primary-active` |
| `oklch(91% 0.025 155)` | 1 | new-token-pair | `--admin-status-confirmed-avatar-bg` |
| `oklch(92% 0.025 120)` | 1 | new-token-pair | `--admin-status-confirmed-avatar-bg-alt` |
| `oklch(70% 0.10 155)` | 1 | new-token-pair | `--admin-status-confirmed-border-strong` |
| `oklch(38% 0.10 155)` | 1 | new-token-pair | `--admin-status-confirmed-icon` |
| `oklch(35% 0.085 155)` | 1 | new-token-pair | `--admin-workload-success-icon` |
| `oklch(50% 0.085 155)` | 1 | new-token-pair | `--admin-workload-success-dot` |
| `oklch(23% 0.01 143)` | 1 | drop-dead-fallback | (none — fallback removed) |
| `oklch(42% 0.008 143)` | 1 | drop-dead-fallback | (none — fallback removed) |
| `oklch(11% 0.014 155)` | 1 | drop-dead-fallback | (none — fallback removed) |

11 new tokens minted, 3 literals resolved by deleting a dead fallback instead
of minting anything (see "The three input.tsx fallbacks" below).

---

## The three `input.tsx` fallbacks — proven dead, not tokenised

`src/components/ui/input.tsx:32,34,108` write `var(--admin-body,
oklch(23%_0.01_143))`, `var(--admin-text-muted, oklch(42%_0.008_143))` and
`var(--admin-heading, oklch(11%_0.014_155))`. A CSS `var()` fallback fires
only when the referenced custom property is **completely undeclared** in the
cascade reaching that element — not "declared but wrong theme block."

Traced the chain:
- `src/styles/tokens.css:73-76` declares `--admin-heading`, `--admin-body`,
  `--admin-text-muted` unconditionally inside the bare `:root {}` block —
  no `[data-theme]` or `[data-admin-theme-root]` gate on that declaration.
- `src/app/globals.css:4` — `@import "../styles/tokens.css";`, itself with
  no conditional wrapper.
- `src/app/layout.tsx:5` — `import "./globals.css";`. This is the single
  true root layout (only layout.tsx at `src/app` top level that renders
  `<html>`; `src/app/(public)/layout.tsx` and `src/app/admin/layout.tsx` are
  both nested layouts that render *inside* it, per Next.js App Router
  semantics — confirmed via `find` at `src/app` depth 2, only one file at
  the root).

So `:root`'s declaration of these three tokens reaches every element on
every route, admin or public, with or without the `[data-admin-theme-root]`
wrapper, before any component-level CSS is even considered. The fallback
literal can never activate — not on `/booking/manage`, not anywhere. This is
provable, not assumed: I read all three files in the chain rather than
inferring it.

Because the fallback is inert, deleting it is a strict no-op on rendered
output in both themes (light *and* dark — the primary token already resolves
correctly in both; dropping the fallback doesn't touch that). It is **not**
"mint a token whose light value is the fallback" — that would be wrong,
since the fallback literals are rough hand-eyeballed approximations of the
real hex tokens (confirmed: `hexToOklch("#5e625e")` ≈ `oklch(49.1% 0.008
145.5)` vs. the fallback's `oklch(42% 0.008 143)` — close but not equal,
consistent with "someone approximated this by eye and never re-checked it"),
and minting them would just add three more colours nobody can ever reach.

Decision for all three: **drop-dead-fallback**. Replace
`var(--admin-body,oklch(23%_0.01_143))` → `var(--admin-body)`, etc.

---

## A verifier interaction that changed two of the eleven mints

`scripts/verify-admin-token-contrast.mjs`'s `derivePairs()` does more than
check the ratio number I write is *accurate* — for **every** token that
carries the strict trailing form `--admin-x: value;   /* N:1 vs Y */`, it
adds the pair `(--admin-x, --admin-Y)` to a list that `checkPairs()` then
tests at **AA 4.5:1 in both light and dark**, regardless of the token's
role. That's correct for text/fill pairs, but a *border* role was never
meant to hit 4.5:1 against its own fill (WCAG 1.4.11 only asks 3:1, and
that's against whatever's *adjacent*, not necessarily the fill it outlines).

I computed the light-mode ratio for every pair I planned to cite before
writing any comment (not just the dark one the instructions asked for a
ratio on), because `checkPairs` checks both themes unconditionally. Two of
my eleven candidates would have introduced a genuine `pairFailure`:

- `--admin-status-confirmed-border-strong` (70% 0.10 155) vs. its own base
  family's bg: only **2.15:1 in light**, **1.70:1 in dark** — nowhere near
  4.5. I checked whether this is unusual for the family first: the
  *existing* `--admin-status-confirmed-border` (88% 0.055 155 → 42% 0.070
  158) has **no inline ratio comment at all** in the shipped file, and
  independently measures only **1.18:1 (light) / 1.70:1 (dark)** against
  `--admin-status-confirmed-bg` — i.e. borders in this family are not, and
  were never, tuned to text-level contrast against their own fill. My
  token's dark value (1.70:1) lands on exactly the same number as its
  sibling. This is expected, not a defect, and the fix is to match the
  file's own convention: no trailing `/* N:1 vs X */` line for this token.
  I still recorded the honest numbers, as prose above the declaration.

- `--admin-button-primary-active` — the only text that ever sits on this
  fill is a hardcoded `text-white` (Tailwind's static utility, not
  `var(--admin-on-primary)`), so there is no *token* to cite as "vs". Using
  the strict format with a literal colour name doesn't resolve to any
  `--admin-*` token, so `derivePairs()`'s own `add()` guard
  (`if (!(fg in tokens) || !(bg in tokens)) return`) silently drops it —
  harmless, but it would also show as a spurious `UNRESOLVED` line in
  `verifyRatioComments`'s report for no benefit. Wrote this one as prose
  too, with the literal `1.25:1 vs white` value stated in words.

Every other candidate (9 of 11) passes AA 4.5:1 in **both** themes and uses
the normal trailing-comment convention. All nine were checked in both themes
before I finalised them, not only in dark:

| token | light ratio | dark ratio | vs |
|---|---|---|---|
| `--admin-status-confirmed-bg-hover` | 11.80:1 | 7.22:1 | status-confirmed-text |
| `--admin-status-confirmed-card-hover` | 13.76:1 | 10.57:1 | heading |
| `--admin-hover-moss` | 10.77:1 | 11.16:1 | body |
| `--admin-active-moss` | 9.70:1 | 8.98:1 | body |
| `--admin-status-confirmed-icon` | 9.42:1 | 7.65:1 | panel |
| `--admin-status-confirmed-avatar-bg` | 12.84:1 | 10.76:1 | status-confirmed-text |
| `--admin-status-confirmed-avatar-bg-alt` | 13.12:1 | 10.45:1 | status-confirmed-text |
| `--admin-workload-success-icon` | 10.25:1 | 9.37:1 | canvas |
| `--admin-workload-success-dot` | 5.46:1 (from TAIL-CENSUS) | 6.35:1 | canvas |

---

## Per-token reasoning

### `--admin-status-confirmed-bg-hover` — `oklch(88% 0.055 155)`, 2 sites

Sites: `src/app/admin/clients/[clientId]/page.tsx:978` (WhatsApp icon button)
and `:1553` (clear-service-filter chip). Both are `hover:bg` on an element
whose resting fill is `var(--admin-status-confirmed-bg)` and whose text stays
`var(--admin-status-confirmed-text)` through the hover. TAIL-CENSUS already
flags that this literal is byte-identical to `--admin-status-confirmed-border`
— but the role at both sites is a **fill**, not a **border**; reusing the
border token would carry the border family's *own* dark-mode shape (which,
as shown above, only reaches 1.70:1 against the bg it sits on — the wrong
shape for a fill that needs to stay legible under text). Minted fresh instead.

Shape: nearest sibling by hue+role is `--admin-status-confirmed-bg` itself
(93.5% 0.038 155 → 29% 0.052 158). Hover must be a *deeper* fill in light
(88% < 93.5%, confirmed) and, per the "more emphasis = more luminance on a
dark panel" rule, must **lighten** past the base's dark value (29%) rather
than darken further. Used the established solid-fill hover magnitude
(`--admin-danger-solid`→`-hover`, `--admin-primary`→`-hover`: roughly +8-9pp
in dark for a hover state) → dark L = 38%. Chroma scaled by the same
light-chroma ratio our literal has over the base (0.055/0.038 = 1.447×)
applied to the base's dark chroma: 0.052×1.447 ≈ 0.075. Hue follows the
confirmed family's own 155→158 dark shift (this token IS the confirmed
family, unlike the button-hover tokens below). In gamut (verified).

### `--admin-status-confirmed-card-hover` — `oklch(91.5% 0.045 155)`, 1 site

Site: `clients/[clientId]/page.tsx:651`, the "next visit" card link — same
base (`--admin-status-confirmed-bg`) as the token above, but a visibly
*subtler* hover (-2pp light vs. the chip hover's -5.5pp) used on a much
larger surface (a whole card, `rounded-[var(--admin-radius-card)]`). Genuinely
a second, weaker state on the same base, not "drift" toward the same
target — the two literals differ by 3.5 percentage points of lightness and
0.01 of chroma, applied to two structurally different UI elements (icon
chip vs. full card), so I kept them as two tokens rather than forcing one.
Named to avoid colliding with the chip's `-bg-hover` name; "`-card-hover`"
matches this file's existing "card" vocabulary (`--admin-radius-card`,
`--admin-shadow-card`).

Shape: same method as above, scaled to the smaller light-mode shift: dark L
= 29% + 4pp = 33% (a proportionally smaller lightening than the -bg-hover
token's +9pp, matching its proportionally smaller light-mode darkening).
Chroma ratio 0.045/0.038 = 1.184× applied to base dark chroma → 0.062. Hue
158 (confirmed family). In gamut.

### `--admin-hover-moss` — `oklch(95.5% 0.012 155)`, 2 sites

Sites: `src/components/ui/button.tsx:29` (`admin-secondary`) and `:35`
(`admin-ghost`) — both `hover:bg`, both on top of `text-[var(--admin-body)]`.
The line-29 comment literally names this colour "Hover Moss", which is also
the closest naming match to the existing `--admin-hover-mist` token (mist =
the blue-hue, hue-247 equivalent used for row/menu hover elsewhere) — same
role (a neutral row/button hover fill), same light lightness (95.5% exactly
matches mist's own 95.5%), different hue. Not the confirmed-status family:
this is a generic interaction fill shared by two button variants, unrelated
to any specific status semantics, so it does not take the confirmed
family's hue-shift.

Shape: mirrored `--admin-hover-mist` (95.5% 0.022 247 → 27% 0.018 247)
directly, since the light L values are identical. Chroma ratio (our
0.012 / mist's 0.022 = 0.545×) applied to mist's dark chroma (0.018 × 0.545
≈ 0.010). Hue held at 155 (mist itself doesn't shift hue 247→247 dark, so
neither does this). In gamut.

### `--admin-active-moss` — `oklch(92% 0.022 155)`, 2 sites

Sites: same two lines as `--admin-hover-moss`, `active:bg` instead of
`hover:bg` — the deeper, pressed-state fill for the same two button
variants. Template: `--admin-selected-sky` (92% 0.05 247 → 33% 0.048 247),
the existing "stronger than hover" companion to `--admin-hover-mist` (same
hover/selected pairing shape used for row highlighting elsewhere in this
codebase — selected-sky's dark L is *higher* than hover-mist's, matching
"more emphasis = more luminance"). Light L again matches exactly (92%).

Shape: chroma ratio 0.022/0.05 = 0.44× applied to sky's dark chroma
(0.048 × 0.44 ≈ 0.021). L held at 33% (sky's own dark L, since light L
matches). Hue held at 155 (sky doesn't shift). In gamut.

### `--admin-button-primary-active` — `oklch(15% 0.065 155)`, 1 site

Site: `button.tsx:26`, the `admin-primary` variant's `active:bg` — "the
live default," i.e. every primary admin button's pressed state, everywhere,
including `/booking/manage`. This is the one I spent the most time on.

It cannot reuse `--admin-primary-active` (already exists: `oklch(28% 0.085
247)` light / `oklch(91% 0.040 240)` dark) even though the *comment already
on that token* ("AdminButton variant='primary' :active — one step past
--admin-primary-hover") describes this literal's role exactly — because the
light values aren't byte-identical (247 hue / 28% vs. our 155 hue / 15%).
Grepped every call site of `--admin-primary-active`: it's consumed by
`admin-ui.tsx:1345`'s *separate* AdminButton implementation, which pairs it
with `var(--admin-on-primary)` (theme-aware). `button.tsx`'s own
`admin-primary` variant, by contrast, hardcodes `text-white` for all three
states (line 26: `text-white` sits before `hover:` and `active:`, and never
changes) — so this literal is a **leftover pre-rebrand green** that never
got migrated to blue alongside its own rest (`--admin-primary`) and hover
(`--admin-primary-hover`) siblings in the very same class string. That's a
real, live inconsistency (green :active on an otherwise-blue button), but
fixing *that* is out of scope for a token-mint — my job is to give the
literal a name and an honest dark value, not repaint it.

Shape: the nearest same-file, same-structure sibling is
`--admin-primary`/`--admin-primary-hover` themselves (rest 76% dark, hover
85% dark — both *lighten* in dark mode despite pairing with the same
hardcoded `text-white`). I mirrored that shape rather than danger-solid's
(also considered — `button.tsx:32`'s still-unmigrated destructive
`active:bg-[oklch(28%_0.14_25)]` literal follows the identical structural
pattern one variant down, solid + hardcoded white + un-minted active — but
that literal is hue 25, out of my family, for another agent). Continued the
primary family's own dark-mode lightening one step further: hover's 85% →
active ≈ 92%. Chroma pulled down as L approaches white, matching how every
near-white token in this file drops chroma (0.065 in light → 0.032 in dark).
Hue held at 155 (no established shift precedent for an orphaned literal;
simplicity).

**Flag, not a fix**: I independently verified the existing, *already
shipped* `--admin-primary`/`--admin-primary-hover` pairing against the
hardcoded white text they already sit under in `button.tsx`, using my
colour script: `--admin-primary` dark vs. white = **2.11:1**,
`--admin-primary-hover` dark vs. white = **1.57:1**. Both already fail AA.
My new `--admin-button-primary-active` dark vs. white = **1.25:1**,
continuing the same failing trend one step further. This is not a defect I
introduced — it inherits, exactly as instructed, the shape of its nearest
existing sibling, which already has this problem. I'm naming it here so it
doesn't get rediscovered as a surprise later.

### `--admin-status-confirmed-icon` — `oklch(38% 0.10 155)`, 1 site

Site: `AuditEventCard.tsx:30`, the small Lucide icon beside a "confirmed"
audit chip's verb (`chipMeta()`'s `"confirmed"` case). Three sibling
literals in the same function (`pending` hue 70, `cancelled` hue 25,
`restricted` hue 280) belong to other family agents — this is the only
hue-155 one, and it's a **distinct role** from `--admin-status-confirmed-text`
(badge text): same hue, chroma close (0.10 vs. 0.085) but different L (38%
vs. 22%), and used specifically as an icon `currentColor`, not badge text.
Extended the family with a new `-icon` slot alongside the existing
`-bg`/`-text`/`-border` roles.

Shape: template `--admin-status-confirmed-text` (22% 0.085 155 → 89% 0.105
158) — a text/foreground role, so it *lightens* in dark like its sibling.
The confirmed-text family's light+dark values sum to ≈111 across every
member I checked (22+89), which held up as a more robust extrapolation
than a multiplicative ratio for a literal whose light L (38%) is well above
the anchor's (22%) — a ratio-based scale would have overshot 100%. Applied:
dark L = 111 − 38 = 73%. Chroma ratio (0.10/0.085 = 1.176×) applied to the
anchor's dark chroma (0.105 × 1.176 ≈ 0.124). Hue 158 (confirmed shift). In
gamut.

### `--admin-status-confirmed-avatar-bg` / `-alt` — `oklch(91% 0.025 155)` and `oklch(92% 0.025 120)`, 1 site each

Both from `AuditEventCard.tsx`'s `avatarTint()` — a 5-entry deterministic
palette for actor-initial avatars, hashed per actor id. Two of the five
entries pair with `text-[var(--admin-status-confirmed-text)]`: index 0 (hue
155, the canonical confirmed hue) and index 4 (hue 120, a distinct
lime-green chosen purely so five hashed avatars don't collide visually —
the other three entries are hue 80/280/existing-token, out of this family).
Kept as **two** tokens, not one: their light values differ (91% vs. 92%
L, and hue 155 vs. 120), so unifying them would move one of the two away
from its own light rendering, which rule #2 forbids. `-alt` suffix marks
the deliberate second variant rather than implying it's a mistake.

Shape: both use `--admin-status-confirmed-bg` (93.5% 0.038 155 → 29% 0.052
158) as the "static tinted panel" template — this is not an interactive
hover/active state, so I used the base family's own light→dark *ratio*
(29/93.5 ≈ 0.310) rather than the hover-lightening logic used above. For
`-avatar-bg` (91% 0.025 155): dark L = 91×0.310 ≈ 28%, chroma ratio
0.025/0.038 = 0.658× → dark chroma 0.052×0.658 ≈ 0.034, hue 158 (matches
its own light hue exactly — same family shift applies). For `-avatar-bg-alt`
(92% 0.025 120): dark L = 92×0.310 ≈ 29% (same ratio, near-identical light
L), same chroma math (0.034, light chroma is byte-identical to the other
entry), **hue held at 120 unchanged** — the confirmed family's 155→158 shift
is specific to hue 155 and I have no evidence it generalises to hue 120, so
I did not invent a shift for it. Both in gamut.

### `--admin-status-confirmed-border-strong` — `oklch(70% 0.10 155)`, 1 site

Site: `src/app/admin/emails/ReminderResendForm.tsx:111` — the "reminder
sent" success state: `bg-[var(--admin-status-confirmed-bg)]
text-[var(--admin-status-confirmed-text)] border
border-[oklch(70%_0.10_155)]`. Extends `--admin-status-confirmed-border`
(88% 0.055 155 → 42% 0.070 158) with a visibly stronger, more saturated
ring — "-strong" mirrors this file's own `-bg-strong`/`-text-strong` suffix
convention, applied here to a new role.

Shape: ratio-scaled from the base border (dark/light ratio 42/88 ≈ 0.477):
dark L = 70×0.477 ≈ 33%. Chroma ratio-target (0.070/0.055 × our light
chroma 0.10 ≈ 0.127) clips out of sRGB gamut at L33/H158 — verified the
in-gamut ceiling there is ≈0.079. Rather than force the ratio-exact chroma
through a hue/L compromise, I raised L to 42% (matching the *base border's
own* dark L exactly, rather than my computed 33%) where the gamut ceiling
is ≈0.098 — comfortably fits the target chroma at 0.090. At L42/C0.090/H158
the ratios against `--admin-status-confirmed-bg` land at 1.70:1 (dark),
matching the base border's own 1.70:1 almost exactly — a "-strong" border
that is at least as visible as its base sibling, not less, which is the
right outcome for a token whose name says "strong." See the verifier
section above for why this token gets no trailing ratio comment.

### `--admin-workload-success-icon` — `oklch(35% 0.085 155)`, 1 site

Site: `staff/page.tsx:702`, `WorkloadSegment`'s icon colour for
`tone === "success"`. Chroma (0.085) is byte-identical to
`--admin-status-confirmed-text`'s own light chroma — the closest possible
match short of being the same token — but it isn't the same token: this is
a workload-strip-scoped decoration, not a status badge, and reusing the
badge name for an unrelated component would misdescribe what it's for.
Named for its actual concept (`workload`, `success`, `icon`) rather than
forced into the status family.

Shape: same "sum ≈ 111" extrapolation used for `-confirmed-icon` above
(this literal's C/H are an exact copy of confirmed-text's, so I trust the
same additive relationship): dark L = 111 − 35 = 76%. Since chroma is
already identical to the anchor's light chroma, reused confirmed-text's own
dark chroma directly (0.105) rather than re-deriving a ratio of 1.0× (same
result, simpler to state). Hue 158 (confirmed shift — same justification:
this literal's C/H exactly match the family it's shifting from). In gamut.

### `--admin-workload-success-dot` — `oklch(50% 0.085 155)`, 1 site

Site: `staff/page.tsx:830`, `ProgressDots`'s filled-dot colour for
`tone === "success"` — a small solid circular swatch with **no text on
top**, unlike every `-bg` token above. That changes which existing sibling
is the right template: a token meant to hold foreground text (`-bg` family)
needs to go dark in dark mode; a token that's just a small saturated shape
sitting on the canvas (like a chart slice) needs to *stay vivid*, i.e.
lighten. The role match here is `--admin-chart-status-confirmed` (58% 0.18
155 → 76% 0.160 155) — a solid swatch, no hue shift (unlike the badge
family), which is exactly this dot's situation.

Shape: chart family's own light→dark ratio (76/58 ≈ 1.310×) applied: dark L
= 50×1.310 ≈ 66%. Chroma ratio (0.160/0.18 ≈ 0.889×) applied to our light
chroma (0.085×0.889 ≈ 0.076). Hue held at 155 (matches chart family, no
shift). In gamut.

---

## Notes / things I was not fully confident about

- **`--admin-button-primary-active`'s dark value is a judgement call, not a
  derivation.** There is no hue-155 sibling of `--admin-primary-hover` to
  measure an exact light-mode delta against (the only real hue-155 data
  point is the 15% literal itself, in isolation). I chose 92% by continuing
  the *established* +9pp-ish hover-to-next-step lightening pattern one more
  time, but a different, equally defensible reading of "mirror the
  inversion shape" could argue for a smaller step. What I'm confident about
  is the *direction* (must lighten, not darken, per the explicit rule) and
  the *pre-existing white-text contrast problem*, which I verified
  independently rather than assumed.
- **The hue-120 avatar-bg-alt not taking the confirmed family's 155→158
  shift** is a judgement call in the same vein — I have no data point for
  how (or whether) that shift should generalise off-155, so I chose not to
  invent one, but a reasonable alternative philosophy might argue for
  shifting it proportionally (e.g. +2 instead of +3).
- **TAIL-CENSUS's own light-mode-contrast table** only reports each
  literal's contrast against the five *surfaces* (canvas/panel/etc.), not
  against the actual paired foreground/background token at each site. I
  recomputed every pairing I actually needed (the token vs. its real
  sibling, e.g. confirmed-text) myself rather than reusing the census
  numbers, except where the census's own surface-only number happened to be
  exactly the pairing I needed (`--admin-workload-success-dot` vs. canvas,
  and the original literal's own surface numbers used only for scale-sanity
  elsewhere).
- I did not find anything in TAIL-CENSUS that was factually wrong for this
  family — the occurrence counts, roles and "no exact match" / exact-match
  flags all checked out against source.
