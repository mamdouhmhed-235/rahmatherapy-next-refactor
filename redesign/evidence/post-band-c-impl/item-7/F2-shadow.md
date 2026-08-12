# Family F2 — drop shadows (`oklch(23% 0.073 155 / A)`)

Read-only derivation. 7 distinct literals (one per alpha), 16 occurrences,
all sharing L=23% / C=0.073 / H=155 (a green hue — the pre-retint "clinic
green" the repo's shadow tokens moved away from). Only the alpha channel
varies: 0.04 (×2), 0.06 (×4), 0.08 (×3), 0.12 (×1), 0.18 (×4), 0.25 (×1),
0.28 (×1). Two spellings exist in source: `155_/_0.NN` (Tailwind underscore
→ space) for the 0.04/0.06/0.08/0.18 sites, and `155/0.NN` (no separator at
all in the raw literal) for the 0.12/0.25/0.28 sites. Both parse to the same
computed colour; the `find` strings below preserve each site's actual
spelling byte-for-byte.

## Why 7 tokens, not fewer

Every alpha is a genuinely different rendered colour (translucency is part
of the value), so "one distinct light value = one token" means all 7 stay
separate — collapsing any two would move light-mode rendering at whichever
sites use the discarded alpha. I looked for a role split that would let two
alphas share intent and found real but partial overlap (see "Drift" below);
none of it is clean enough to justify merging light values.

## Naming

`--admin-shadow-{subtle,card,hover,overlay}` already exist and cover the
*blue-tinted* (hue 247, the "Brand-Tinted Shadow Rule") and warm-neutral
shadow tokens. These 16 sites are the leftover green-hued (hue 155) shadow
literal that rule was supposed to replace but missed — a genuinely different
light value, so it cannot reuse those four names (colour equality would be
false, and the rule says name tokens for what they ARE). I minted a sibling
family under the same `--admin-shadow-*` root, using names disjoint from the
four existing ones:

| Token | Alpha | Dominant role across its sites |
|---|---|---|
| `--admin-shadow-dock` | 0.04 | Docked sticky bottom bar, resting (2/2 sites) |
| `--admin-shadow-dock-strong` | 0.06 | Docked bar (top or bottom), resting — one step stronger (3/4 sites); reused once for a same-weight hover-panel lift (1/4, see Drift) |
| `--admin-shadow-row-hover` | 0.08 | Hover/group-hover elevation on a list-row card (3/3 sites) |
| `--admin-shadow-sheet` | 0.12 | Bottom-sheet / modal panel shadow (1/1 site) |
| `--admin-shadow-active` | 0.18 | Shadow on a `--admin-primary`-filled active/selected element (3/4 active-tab sites + 1/4 selection-toolbar) |
| `--admin-shadow-selected` | 0.25 | Shadow on a chosen option in a picker (1/1 site) |
| `--admin-shadow-active-strong` | 0.28 | Stronger sibling of `--admin-shadow-active` — same "active primary fill" pattern, one component, higher alpha (1/1 site) |

`-strong` mirrors the repo's existing suffix convention
(`--admin-danger-bg-strong`, `--admin-warning-bg-strong`,
`--admin-success-bg-strong`) for "same role, more emphasis."

### Drift, reported not unified

- **0.06 tier**: 3 of 4 sites (`calendar/page.tsx:502`,
  `RoleMetadataForm.tsx:216`, `StaffProfileForm.tsx:388`) are literally
  `position:sticky` bars. The 4th (`privacy/page.tsx:605`) is a non-sticky
  accordion `<section>` whose shadow only appears on hover — a different
  trigger, same visual weight. This reads as the privacy author reaching for
  "the same shadow strength as the other panels" rather than a deliberate
  distinct role. I did not invent a second token for it: the alpha (and
  therefore the light-mode pixels) is identical to the other three, so it is
  the same light value and must be the same token per the "one distinct
  light value = one token" rule. Flagging here rather than silently folding
  it into "dock" is the honest move — `--admin-shadow-dock-strong` will read
  slightly loosely applied at that one call site.
- **0.18 vs 0.25 vs 0.28**: all three sit on elements that fill
  `bg-[var(--admin-primary)]` + `text-[var(--admin-on-primary)]` and are
  visually "this one is selected/active." 0.18 is used 4×, 0.25 and 0.28
  exactly once each, each on a different component (nav-tab active state,
  time-slot picker selection, dashboard filter-preset chip). This looks like
  three independent authors picking a shadow strength for "my active
  element" without a shared reference value — plausible alpha drift across
  the same conceptual role. Per instructions I kept them as 3 distinct
  tokens (3 distinct light values) rather than unifying, and named the two
  outliers as recognisable variants of `--admin-shadow-active`
  (`-strong` for 0.28, since it is structurally identical to the 0.18 sites
  down to the ternary shape) and a role-distinct name for 0.25
  (`--admin-shadow-selected`, since ManualBookingForm's time-slot grid is a
  "pick one of these options" pattern, not a "which tab am I on" pattern).

## Dark-mode inversion shape

The nearest existing sibling is the `--admin-shadow-*` family itself
(`--admin-shadow-card`, `-subtle`, `-hover`, `-overlay`). Its documented dark
rule (tokens.css:447–449): *"Shadows drop the brand-blue tint: a blue-tinted
shadow is invisible on a dark canvas, so dark mode leans on near-black at a
higher alpha instead. Geometry is unchanged from the light values."*
Concretely, every existing shadow token drops its colour tint to
`oklch(0% 0 0 / A)` (or `rgba(0,0,0,A)`) in dark mode and raises the alpha:

| token | light α | dark α |
|---|---|---|
| `--admin-shadow-subtle` | 0.04 | 0.45 |
| `--admin-shadow-overlay` (2nd layer) | 0.06 | 0.45 |
| `--admin-shadow-hover` | 0.08 | 0.50 |
| `--admin-shadow-overlay` (1st layer) | 0.12 | 0.60 |
| `--admin-shadow-card` | 0.55 | 0.85 |

I mirrored exactly this shape for all 7 new tokens — same reasoning applies
doubly here, since these literals are an even older green tint that the
Brand-Tinted Shadow Rule was written to retire, so dropping the tint in dark
mode is not a new philosophy, it is finishing the one already on record.
Dark alphas (monotonic with the light ladder, staying inside the existing
family's observed 0.45–0.85 envelope, topping out at the same 0.85 ceiling
`--admin-shadow-card` already uses for its strongest tier):

| token | light | dark |
|---|---|---|
| `--admin-shadow-dock` | `oklch(23% 0.073 155 / 0.04)` | `oklch(0% 0 0 / 0.45)` |
| `--admin-shadow-dock-strong` | `oklch(23% 0.073 155 / 0.06)` | `oklch(0% 0 0 / 0.52)` |
| `--admin-shadow-row-hover` | `oklch(23% 0.073 155 / 0.08)` | `oklch(0% 0 0 / 0.58)` |
| `--admin-shadow-sheet` | `oklch(23% 0.073 155 / 0.12)` | `oklch(0% 0 0 / 0.65)` |
| `--admin-shadow-active` | `oklch(23% 0.073 155 / 0.18)` | `oklch(0% 0 0 / 0.72)` |
| `--admin-shadow-selected` | `oklch(23% 0.073 155 / 0.25)` | `oklch(0% 0 0 / 0.80)` |
| `--admin-shadow-active-strong` | `oklch(23% 0.073 155 / 0.28)` | `oklch(0% 0 0 / 0.85)` |

Geometry (blur/spread/offset) is untouched at every call site — only the
colour argument inside `oklch(...)` is replaced with `var(--admin-shadow-*)`,
exactly as the existing family's dark rule promises ("geometry is unchanged
from the light values").

One mechanical difference from the 4 existing shadow tokens, worth stating
plainly: `--admin-shadow-card/-subtle/-hover/-overlay` each store a *whole*
`box-shadow` value (offset + blur + colour) because every consumer uses the
same geometry. These 16 F2 sites use 9 different offset/blur combinations at
the *same* colour, so a "whole value per token" design would need far more
than 7 tokens (or would force geometry to move, which is out of scope — the
census confirms none of these differ from their neighbours by colour alone).
I therefore minted each token as a bare colour, consumed as
`shadow-[<geometry>_var(--admin-shadow-x)]` — the same pattern this sweep
uses for every other family, and the one implied by the worked example in
the task brief.

## Contrast-ratio comment: intentionally omitted

Method step 4 asks for a measured ratio comment on every dark declaration,
"in the existing convention." I read that convention as scoped to
foreground/background *text or fill* pairs — the four existing
`--admin-shadow-*` tokens carry **zero** ratio comments in any of the four
blocks (verified by reading tokens.css:447–453, 574–577, 691–693), because a
translucent shadow colour is not a text-on-surface pair; WCAG contrast does
not have a meaningful target to measure it against. I confirmed this is not
just a formatting habit but load-bearing in the verifier itself
(`scripts/verify-admin-token-contrast.mjs`, read but not run to completion —
running it is permitted but the two derivation paths were read directly):

- `RATIO_COMMENT_RE` only fires on an explicit `/* N.NN:1 vs X */` comment —
  I am not adding one, so it never sees these tokens.
- `derivePairs()`'s auto-swept "foreground-ish" check
  (`fgLike = /text|body|heading|muted/i`) only matches token *names*
  containing `text`/`body`/`heading`/`muted`. None of
  `--admin-shadow-{dock,dock-strong,row-hover,sheet,active,selected,active-strong}`
  match that pattern (by design — they are not foreground tokens), so they
  are never pulled into the auto-derived AA pair-check either.

Writing a fabricated ratio here would violate rule 4's own instruction
("only write a ratio you have actually computed") for a number that has no
real pair to compute against, and would be inconsistent with the precedent
these tokens are supposed to extend. I left the CSS comments on these
declarations descriptive-only (what the tier is for), matching the register
of the existing shadow family's comments, and no `N.NN:1` figure appears
anywhere in my new declarations.

## Placement

All 7 tokens sit as a new block immediately after the existing
`--admin-shadow-overlay` declaration in each of the four blocks
(`:root` tokens.css:210, `[data-theme="dark"]` :453, `[data-theme="light"]`
:577, `@media print` :693), since they are the true sibling of that family
even though they are not part of the pre-existing "Sweep tokens" section.

## Sites (16), exact find/replace

### `--admin-shadow-dock` — light `oklch(23% 0.073 155 / 0.04)`

1. `src/app/admin/emails/templates/components/TemplateEditor.tsx:389`
   find: `shadow-[0_-1px_8px_oklch(23%_0.073_155_/_0.04)]`
   replace: `shadow-[0_-1px_8px_var(--admin-shadow-dock)]`
2. `src/app/admin/settings/SettingsForm.tsx:432`
   find: `shadow-[0_-1px_8px_oklch(23%_0.073_155_/_0.04)]`
   replace: `shadow-[0_-1px_8px_var(--admin-shadow-dock)]`

### `--admin-shadow-dock-strong` — light `oklch(23% 0.073 155 / 0.06)`

3. `src/app/admin/calendar/page.tsx:502`
   find: `shadow-[0_1px_4px_oklch(23%_0.073_155_/_0.06)]`
   replace: `shadow-[0_1px_4px_var(--admin-shadow-dock-strong)]`
4. `src/app/admin/privacy/page.tsx:605`
   find: `hover:shadow-[0_2px_8px_oklch(23%_0.073_155_/_0.06)]`
   replace: `hover:shadow-[0_2px_8px_var(--admin-shadow-dock-strong)]`
5. `src/app/admin/roles/[roleId]/RoleMetadataForm.tsx:216`
   find: `shadow-[0_-1px_8px_oklch(23%_0.073_155_/_0.06)]`
   replace: `shadow-[0_-1px_8px_var(--admin-shadow-dock-strong)]`
6. `src/app/admin/staff/[staffId]/StaffProfileForm.tsx:388`
   find: `shadow-[0_-8px_24px_oklch(23%_0.073_155_/_0.06)]`
   replace: `shadow-[0_-8px_24px_var(--admin-shadow-dock-strong)]`

### `--admin-shadow-row-hover` — light `oklch(23% 0.073 155 / 0.08)`

7. `src/app/admin/calendar/page.tsx:1545`
   find: `group-hover:shadow-[0_2px_8px_oklch(23%_0.073_155_/_0.08)]`
   replace: `group-hover:shadow-[0_2px_8px_var(--admin-shadow-row-hover)]`
8. `src/app/admin/emails/page.tsx:705`
   find: `hover:shadow-[0_1px_4px_oklch(23%_0.073_155_/_0.08)]`
   replace: `hover:shadow-[0_1px_4px_var(--admin-shadow-row-hover)]`
9. `src/app/admin/emails/page.tsx:903`
   find: `hover:shadow-[0_1px_4px_oklch(23%_0.073_155_/_0.08)]`
   replace: `hover:shadow-[0_1px_4px_var(--admin-shadow-row-hover)]`

### `--admin-shadow-sheet` — light `oklch(23% 0.073 155/0.12)`

10. `src/app/admin/bookings/new/ManualBookingForm.tsx:2395`
    find: `shadow-[0_8px_24px_oklch(23%_0.073_155/0.12)]`
    replace: `shadow-[0_8px_24px_var(--admin-shadow-sheet)]`

### `--admin-shadow-active` — light `oklch(23% 0.073 155 / 0.18)`

11. `src/app/admin/calendar/page.tsx:817`
    find: `shadow-[0_1px_2px_oklch(23%_0.073_155_/_0.18)]`
    replace: `shadow-[0_1px_2px_var(--admin-shadow-active)]`
12. `src/app/admin/emails/page.tsx:402`
    find: `hover:shadow-[0_1px_3px_oklch(23%_0.073_155_/_0.18)]`
    replace: `hover:shadow-[0_1px_3px_var(--admin-shadow-active)]`
13. `src/app/admin/enquiries/EnquiryList.tsx:561`
    find: `shadow-[0_4px_16px_oklch(23%_0.073_155_/_0.18)]`
    replace: `shadow-[0_4px_16px_var(--admin-shadow-active)]`
14. `src/app/admin/enquiries/page.tsx:339`
    find: `shadow-[0_1px_2px_oklch(23%_0.073_155_/_0.18)]`
    replace: `shadow-[0_1px_2px_var(--admin-shadow-active)]`

### `--admin-shadow-selected` — light `oklch(23% 0.073 155/0.25)`

15. `src/app/admin/bookings/new/ManualBookingForm.tsx:1894`
    find: `shadow-[0_2px_8px_oklch(23%_0.073_155/0.25)]`
    replace: `shadow-[0_2px_8px_var(--admin-shadow-selected)]`

### `--admin-shadow-active-strong` — light `oklch(23% 0.073 155/0.28)`

16. `src/app/admin/dashboard/dashboard-filters-client.tsx:355`
    find: `shadow-[0_2px_6px_oklch(23%_0.073_155/0.28),inset_0_1px_0_rgba(255,255,255,0.12)]`
    replace: `shadow-[0_2px_6px_var(--admin-shadow-active-strong),inset_0_1px_0_rgba(255,255,255,0.12)]`

## New declarations (for whoever applies this — not written by this agent)

```css
/* :root and [data-theme="light"] and @media print (light values,
   byte-identical to the literals they replace) */
--admin-shadow-dock: oklch(23% 0.073 155 / 0.04);
--admin-shadow-dock-strong: oklch(23% 0.073 155 / 0.06);
--admin-shadow-row-hover: oklch(23% 0.073 155 / 0.08);
--admin-shadow-sheet: oklch(23% 0.073 155 / 0.12);
--admin-shadow-active: oklch(23% 0.073 155 / 0.18);
--admin-shadow-selected: oklch(23% 0.073 155 / 0.25);
--admin-shadow-active-strong: oklch(23% 0.073 155 / 0.28);

/* [data-theme="dark"] — tint dropped to near-black, alpha raised, mirroring
   the existing --admin-shadow-* family's documented dark-mode rule */
--admin-shadow-dock: oklch(0% 0 0 / 0.45);
--admin-shadow-dock-strong: oklch(0% 0 0 / 0.52);
--admin-shadow-row-hover: oklch(0% 0 0 / 0.58);
--admin-shadow-sheet: oklch(0% 0 0 / 0.65);
--admin-shadow-active: oklch(0% 0 0 / 0.72);
--admin-shadow-selected: oklch(0% 0 0 / 0.80);
--admin-shadow-active-strong: oklch(0% 0 0 / 0.85);
```

No ratio comments are attached, matching the precedent of
`--admin-shadow-card/-subtle/-hover/-overlay` (see "Contrast-ratio comment"
above).
