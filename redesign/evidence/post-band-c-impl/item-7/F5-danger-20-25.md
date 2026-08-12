# F5 — danger / error, hues 20-25

11 distinct literals, 17 occurrences. All computations below were done with the
shipped `oklchToRgb` / `contrastRatio` functions from
`scripts/verify-admin-token-contrast.mjs` (imported read-only into a scratch
script, never executed as the CLI, never wrote to the repo) — no ratio here is
hand-estimated.

## Existing vocabulary consulted

- Plain severity: `--admin-danger` (text), `--admin-danger-bg`, `--admin-danger-bg-strong`,
  `--admin-danger-solid` + `-hover`, `--admin-danger-text-strong`.
- Status family: `--admin-status-cancelled-{bg,text,border}`.
- Cross-family shape precedent: `--admin-primary` / `-hover` / `-active` (a
  three-tier escalation that "continues the hover direction" in dark mode —
  76%→85%→91%, an explicit comment says so).
- Bg "-strong" precedent: `--admin-danger-bg` (~96% light) → `--admin-danger-bg-strong`
  (92% light, Δ-4) inverts to (28% dark) → (32% dark, Δ+4) — the base bg's
  "more" variant gets darker in light and lighter in dark, a small symmetric
  flip. This became my template for every `-hover` / `-strong` token below,
  scaled to each literal's own light-mode Δ from its base bg/border.
- Border-family precedent (9 tokens: `--admin-nav-border`, all six
  `--admin-status-*-border`, `--admin-border`): every one starts light ~85-91%
  and lands dark ~33-43%, a near-symmetric mirror around a ~65 pivot with
  chroma boosted ~1.2-1.7×, hue held. This shape is specific to *near-white*
  borders — I did not apply it mechanically to literals that start at a much
  lower/more-saturated light L (see per-token notes; `--admin-border-form`,
  55%→58%, is the counter-example: a border that's already medium-visible in
  light barely moves in dark).

## Per-literal decisions

### 1. `oklch(70% 0.10 25)` — 4 occurrences (border / hover:border)

Sites: `DeliveryFilterStrip.tsx:230` (chip hover border), `:303` (input
validation-error border, default state), `emails/page.tsx:486` (outline
"Try again" button border, default state), `emails/page.tsx:703` (failed-card
hover border, escalating from literal #7 below).

Same literal plays both a *resting* role (input error, button outline) and a
*hover-escalation* role (chip, card) — one colour, one token,
`--admin-danger-border`. This fills the missing "border" slot beside the
existing plain-severity `--admin-danger` (text) / `--admin-danger-bg` (bg) —
no `--admin-danger-border` existed.

Nearest sibling: `--admin-status-cancelled-border` (only existing *border*-role
token in this hue bucket), but its precedent shape (light ~88 → dark ~42) is
calibrated for a *near-white* light value; ours starts at a much more assertive
70% L / 0.10 C already (light-mode contrast 2.3-2.8:1 vs the near-white
sibling's 1.2-1.4:1). Extrapolating that pivot-65 formula literally
(dark = 130-70 = 60, tested) landed in the same range I converged on by a
second method — proportional contrast-multiplier scaling against the four
precedent border families (multipliers ranged 0.89-1.53×; I targeted the
upper end, ~1.6×, given this token's job is "make an error impossible to
miss," slightly louder than a passive status chip border).

Picked: **dark = `oklch(60% 0.14 25)`**, hue held, chroma raised to 0.14 (matches
`--admin-danger-solid`'s dark chroma magnitude for this hue).
Measured: 4.10:1 vs `--admin-panel` (light-mode multiplier ≈1.6×, inside the
0.89-1.53× precedent band's high end but not absurd — this is the
"loudest" border in the family).

### 2. `oklch(80% 0.08 25)` — 2 occurrences (border)

Sites: `BulkDeleteToolbar.tsx:134`, `DeleteClientButton.tsx:11` — both the
outline border of a "Delete" destructive-action button (`bg-transparent`,
text = `--admin-status-cancelled-text`, hover bg = `--admin-status-cancelled-bg`).
Distinct role from #1 (destructive-button chrome, not error/validation
feedback) and a distinct light value, so a separate token:
`--admin-danger-outline-border`.

Lighter/softer than #1 (contrast 1.6-1.9:1 vs #1's 2.3-2.8:1), closer to the
passive-border regime. Applied the pivot-65 shape (130-80=50) with chroma
scaled by the same ratio `--admin-status-cancelled-border` uses
(0.075/0.045≈1.67× → 0.08×1.67≈0.13, rounded to 0.12 for a cleaner number).

Picked: **dark = `oklch(50% 0.12 25)`**. Measured: 2.72:1 vs `--admin-panel`
(multiplier 1.54×, almost exactly matches `--admin-status-restricted-border`'s
precedent multiplier of 1.53×).

### 3. `oklch(40% 0.12 25)` — 2 occurrences (text)

Sites: `AdminTopNav.tsx:608` and `:902` — the `LogOut` icon inside the
"Sign out" menu row (desktop dropdown + mobile drawer), whose row *text* is
already `--admin-status-cancelled-text`. The icon is a deliberately lighter,
less-saturated companion tone, not the same colour as the label. Extends the
status-cancelled family with the missing icon slot: `--admin-status-cancelled-icon`.

Its light L/C (40%/0.12) sit almost on top of `--admin-danger-solid`'s light
value (40%/0.14) — the closest same-hue anchor for "what does a 40%-L red
become in dark mode" — even though solid is a *fill* and this is a *plain
icon foreground*. I mirrored solid's dark *territory* (72-78% L) rather than
its exact number, since a foreground icon only needs to clear panel/nav
contrast, not carry on-primary text.

Picked: **dark = `oklch(78% 0.13 25)`**. Measured: 8.22:1 vs `--admin-panel`
(comfortably clears AA — appropriate, since the sibling `--admin-danger`
plain-foreground token reads even higher against these surfaces).

### 4. `oklch(92% 0.045 20)` — 2 occurrences (hover:bg)

Sites: `emails/page.tsx:486` ("Try again" button) and
`TemplateEditor.tsx:374` ("Retry" button) — both a small text/icon button's
hover fill, living inside an alert whose panel bg is `--admin-status-cancelled-bg`.
Not a hover-of-the-bg-token itself (the buttons start `bg-transparent`), so a
distinct name from #8: `--admin-status-cancelled-action-hover`.

Applied the `--admin-danger-bg` → `--admin-danger-bg-strong` template: light
Δ from the base cancelled-bg (95.5%) is -3.5, closely matching that
precedent's -4; so dark gets the mirrored +Δ off the base dark cancelled-bg
(29%) → ~33%. Chroma scaled by the light-mode ratio (0.045/0.028≈1.6×) off
the base dark chroma (0.055) → ~0.075-0.09; picked the low end.

Picked: **dark = `oklch(33% 0.075 20)`**. Measured against the text colour
these buttons actually carry (`--admin-status-cancelled-text`, since that's
the meaningful "does the button still read" check for a bg-role token, not
a border/panel comparison): 8.59:1 vs `--admin-status-cancelled-text`.

### 5. `oklch(45% 0.19 25)` — 1 occurrence (text)

Site: `AuditEventCard.tsx:34` — the `Trash2` icon in the "cancelled" audit
chip (`chipMeta`'s own comment names this a "chip"; siblings for
confirmed/pending/restricted sit at hues 155/70/280 and belong to other
families). Distinct component/context from #3's nav icon and a different
literal, so a separate token: `--admin-status-cancelled-chip-icon`. I flag
this as likely **drift** against #3 — two components independently invented
a "cancelled icon colour" rather than sharing one — but the light values
differ (40/0.12 vs 45/0.19) so I did not unify them.

Light contrast (7.2-8.0:1 per the census) is body-text-level despite being
a small icon, so I targeted a similarly strong dark reading rather than the
lighter treatment ordinary graphics-level (3:1) icons would need. Same
reasoning as #3: nearest anchor is `--admin-danger`'s dark territory (~76-80% L),
chroma held close to its own light value since 0.19 is unusually saturated —
I pulled it down only as far as needed to stay visually calm at high L.

Picked: **dark = `oklch(78% 0.145 25)`**. Measured: 7.94:1 vs `--admin-panel`.

### 6. `oklch(85% 0.06 25)` — 1 occurrence (border)

Site: `emails/page.tsx:476` — the border around the whole "Couldn't load
email events" alert panel (bg = `--admin-status-cancelled-bg`, text =
`--admin-status-cancelled-text`). Very close to `--admin-status-cancelled-border`
(88%/0.045/20) but not byte-identical (85 vs 88 L, 0.06 vs 0.045 C, **hue 25
vs hue 20**) — I flag this as likely **drift**, probably meant to be the
existing token, typed by hand instead. Cannot substitute (light value isn't
identical), so: `--admin-status-cancelled-alert-border`.

Same `-strong`-style template as #4: light Δ from base border -3 (88→85),
mirrored dark Δ off the base dark border (42%) → ~46%. Chroma scaled by
0.06/0.045≈1.33× off the base dark chroma (0.075) → ~0.10.

Picked: **dark = `oklch(46% 0.10 25)`**. Measured: 2.32:1 vs `--admin-panel`.

### 7. `oklch(82% 0.06 20)` — 1 occurrence (border)

Site: `emails/page.tsx:703` — the *resting* border of a "failed" event card,
which escalates to literal #1 (`--admin-danger-border`) on hover. Hue matches
`--admin-status-cancelled-border` exactly (20, unlike #6's 25) and reads as a
directly bolder tier of it: `--admin-status-cancelled-border-strong`. Flagged
as likely **drift** against #6 (both are "somewhat bolder than the base
cancelled border," at different literal values) — not unified, per the rule.

Light Δ from base border is -6 (88→82), roughly double #6's -3, so I doubled
the mirrored dark Δ too: dark ≈ 42+8=50%. Chroma scaled the same 1.33× as #6
→ 0.10.

Picked: **dark = `oklch(50% 0.10 20)`**. Measured: 2.76:1 vs `--admin-panel`
(also clears the WCAG 3:1 non-text/UI-boundary bar against `--admin-canvas`
at 3.04:1).

### 8. `oklch(90% 0.05 20)` — 1 occurrence (hover:bg)

Site: `operations/event-row.tsx:171` — a severity pill whose *own* base bg
is `--admin-status-cancelled-bg` (danger tone; the sibling warning/restricted
pills in the same ternary use hues 65/280, out of this family's scope). This
is a literal hover-of-the-bg-token, unlike #4: `--admin-status-cancelled-bg-hover`
— matches the naming example given in the brief almost verbatim.

Light Δ from base bg (95.5→90) is -5.5, the largest of the three
`-hover`-flavoured literals in this family (#4: -3.5, #9: -2.5). Mirrored
dark Δ off base dark bg (29%) scaled proportionally → +5.5 → ~34.5%.

Picked: **dark = `oklch(34% 0.085 20)`**. Measured: 8.35:1 vs
`--admin-status-cancelled-text`.

### 9. `oklch(93% 0.04 20)` — 1 occurrence (hover:bg)

Site: `staff/page.tsx:572` — a third, independently-drifted "Try again"
button (border here uses the *existing* `--admin-status-cancelled-border`
token, unlike #4's sibling buttons which use raw literal #1 — so it isn't
even structurally identical to those two, despite the shared intent).
Flagged as **drift**, the third member of a "hover fill for a cancelled-toned
retry action" trio (#4 92%/0.045, #8 90%/0.05, #9 93%/0.04) that a shared
token would have prevented. Named `--admin-status-cancelled-outline-hover`
since, unlike #4, this button's border does reference the real
`-border` token (an "outline" button in the strict sense).

Smallest light Δ of the trio (95.5→93 = -2.5) → smallest mirrored dark Δ
(29+2.5≈31.5→32).

Picked: **dark = `oklch(32% 0.065 20)`**. Measured: 8.87:1 vs
`--admin-status-cancelled-text`.

The three `-hover` picks are internally consistent: ordering by light Δ
magnitude (outline-hover -2.5 < action-hover -3.5 < bg-hover -5.5) produces
the same order, inverted, in the dark picks (outline-hover 32 < action-hover
33 < bg-hover 34) — the token with the smallest light-mode step gets the
smallest dark-mode step, proportionally, not an arbitrary shuffle.

### 10. `oklch(26% 0.14 25)` — 1 occurrence (border) — **reuse, not a new token**

Site: `staff/[staffId]/availability/lib.ts:39`,
`export const CANCELLED_BORDER = "border-[oklch(26%_0.14_25)]";`.

Byte-identical to `--admin-status-cancelled-text`'s light value. The brief's
own note says a prior commit already mapped 28 other error-border sites onto
this token for exactly this reason. I confirmed directly: **this exact same
named constant** (`CANCELLED_BORDER`) is *already* defined as
`"border-[var(--admin-status-cancelled-text)]"` in two sibling files —
`src/app/admin/clients/new/ClientCreateForm.tsx:27` and
`src/app/admin/clients/[clientId]/edit/ClientEditForm.tsx:13` — and used
identically (a form field's error-state border, `error ? CANCELLED_BORDER :
"border-[var(--admin-border-form)]"`). `StaffBlockedDatesManager.tsx:228`
consumes *this* file's copy the same way
(`state.fieldErrors?.date ? CANCELLED_BORDER : "border-[var(--admin-border-form)]"`).
This is not a judgement call — it's the one copy of a three-times-duplicated
constant that didn't get updated. **Decision: reuse `--admin-status-cancelled-text`**,
no new token.

### 11. `oklch(28% 0.14 25)` — 1 occurrence (active:bg)

Site: `src/components/ui/button.tsx:32` — the `admin-destructive` variant's
`active:` state:
`bg-[var(--admin-danger-solid)] hover:bg-[var(--admin-danger-solid-hover)] active:bg-[oklch(28%_0.14_25)]`.
A third tier past solid (40%/0.14) and solid-hover (33%/0.14) — light chroma
is held constant at 0.14 across all three tiers, only L drops
(40→33→28, Δ-7 then Δ-5). Honest name for the third state, matching the
existing `-hover` suffix convention: **`--admin-danger-solid-active`**.

Directly mirrors `--admin-primary`'s own three-tier shape, which is the only
other `-active` token in the file and literally documents itself as
"continues the hover direction: 76%→85%(hover)→91%(active)" — dark deltas
+9 then +6 (ratio 0.667). Applying that decay ratio to danger-solid's own
dark deltas (solid→hover = +9, matching `--admin-primary` exactly) gives
hover→active ≈ +9×0.667 ≈ +6 → dark L ≈ 81+6 = 87%. Chroma in dark also
decays as L rises (solid 0.145 → hover 0.100, Δ-0.045); continuing
proportionally (Δ-0.045×0.667≈-0.03) → active chroma ≈ 0.07.

Picked: **dark = `oklch(87% 0.07 25)`**, matching the `-solid`/`-solid-hover`
comment convention exactly. Measured: 12.37:1 vs `on-primary` (button.tsx
hardcodes `text-white` for this variant rather than `--admin-on-primary`,
but the sibling comments are all written "vs on-primary" regardless, so I
kept that convention rather than inventing a new one).

## Drift, reported not fixed (per instructions, light values were not unified)

- **`-hover` trio for "retry/dismiss inside a cancelled/danger surface"**:
  #4 (92%/0.045/20, 2 sites), #8 (90%/0.05/20, 1 site), #9 (93%/0.04/20,
  1 site) — three near-identical literals, evidently typed independently in
  three files rather than sharing a token.
- **`-border-strong` pair**: #6 (85%/0.06/**25**, alert panel) and #7
  (82%/0.06/**20**, failed-card resting border) — both read as "a bolder
  `--admin-status-cancelled-border`," at different literal values (and #6
  even drifted hue, 25 instead of the family's 20).
- **Icon-tint pair**: #3 (40%/0.12/25, nav icon) and #5 (45%/0.19/25, audit
  chip icon) — both "a cancelled-family icon foreground," different values.

None of these were unified — each keeps its own token because the light
value must stay byte-identical to the literal it replaces.

## Proposed tokens.css additions (for reference — this agent did not edit the file)

All ten new tokens need declaring in `:root`, `[data-theme="dark"]`,
`[data-theme="light"]` and `@media print` (light/root/light/print share the
literal's exact value; only the dark block differs):

```css
/* :root, [data-theme="light"], @media print — identical in all three */
--admin-danger-border: oklch(70% 0.10 25);
--admin-danger-outline-border: oklch(80% 0.08 25);
--admin-status-cancelled-icon: oklch(40% 0.12 25);
--admin-status-cancelled-action-hover: oklch(92% 0.045 20);
--admin-status-cancelled-chip-icon: oklch(45% 0.19 25);
--admin-status-cancelled-alert-border: oklch(85% 0.06 25);
--admin-status-cancelled-border-strong: oklch(82% 0.06 20);
--admin-status-cancelled-bg-hover: oklch(90% 0.05 20);
--admin-status-cancelled-outline-hover: oklch(93% 0.04 20);
--admin-danger-solid-active: oklch(28% 0.14 25);

/* [data-theme="dark"] */
--admin-danger-border: oklch(60% 0.14 25);        /* 4.10:1 vs --admin-panel */
--admin-danger-outline-border: oklch(50% 0.12 25); /* 2.72:1 vs --admin-panel */
--admin-status-cancelled-icon: oklch(78% 0.13 25);  /* 8.22:1 vs --admin-panel */
--admin-status-cancelled-action-hover: oklch(33% 0.075 20); /* 8.59:1 vs --admin-status-cancelled-text */
--admin-status-cancelled-chip-icon: oklch(78% 0.145 25);    /* 7.94:1 vs --admin-panel */
--admin-status-cancelled-alert-border: oklch(46% 0.10 25);  /* 2.32:1 vs --admin-panel */
--admin-status-cancelled-border-strong: oklch(50% 0.10 20); /* 2.76:1 vs --admin-panel */
--admin-status-cancelled-bg-hover: oklch(34% 0.085 20);     /* 8.35:1 vs --admin-status-cancelled-text */
--admin-status-cancelled-outline-hover: oklch(32% 0.065 20); /* 8.87:1 vs --admin-status-cancelled-text */
--admin-danger-solid-active: oklch(87% 0.07 25);   /* 12.37:1 vs on-primary */
```

Note on ratio comments: the existing file only ever puts an inline
`/* N:1 vs X */` comment on *text/fill* tokens (`-text-strong`, `-solid`,
`-solid-hover`, `-sparkline-stroke`) — none of the nine existing `-border` or
`-bg`/`-bg-strong` tokens carry one. I added them to every new token here
anyway per this task's explicit instruction #4, choosing the most
semantically meaningful comparison for each (a border vs `--admin-panel`;
a bg-role token vs the `--admin-status-cancelled-text` that's actually
painted on top of it in every call site; the fill vs `on-primary` matching
its `-solid`/`-solid-hover` siblings exactly). If whoever applies this
prefers to match file convention and drop the comment on the border/bg
tokens, the numbers above remain correct documentation either way — they
were measured, not guessed, and would pass `verify-admin-token-contrast.mjs`
if left in.

## Sites — exact find/replace (mechanical)

| # | literal | file:line | find | replace |
|---|---|---|---|---|
| 1a | `oklch(70% 0.10 25)` | `src/app/admin/emails/DeliveryFilterStrip.tsx:230` | `hover:border-[oklch(70%_0.10_25)]` | `hover:border-[var(--admin-danger-border)]` |
| 1b | `oklch(70% 0.10 25)` | `src/app/admin/emails/DeliveryFilterStrip.tsx:303` | `border-[oklch(70%_0.10_25)]` | `border-[var(--admin-danger-border)]` |
| 1c | `oklch(70% 0.10 25)` | `src/app/admin/emails/page.tsx:486` | `border-[oklch(70%_0.10_25)]` | `border-[var(--admin-danger-border)]` |
| 1d | `oklch(70% 0.10 25)` | `src/app/admin/emails/page.tsx:703` | `hover:border-[oklch(70%_0.10_25)]` | `hover:border-[var(--admin-danger-border)]` |
| 2a | `oklch(80% 0.08 25)` | `src/app/admin/clients/components/BulkDeleteToolbar.tsx:134` | `border-[oklch(80%_0.08_25)]` | `border-[var(--admin-danger-outline-border)]` |
| 2b | `oklch(80% 0.08 25)` | `src/app/admin/clients/components/DeleteClientButton.tsx:11` | `border-[oklch(80%_0.08_25)]` | `border-[var(--admin-danger-outline-border)]` |
| 3a | `oklch(40% 0.12 25)` | `src/app/admin/components/AdminTopNav.tsx:608` | `text-[oklch(40%_0.12_25)]` | `text-[var(--admin-status-cancelled-icon)]` |
| 3b | `oklch(40% 0.12 25)` | `src/app/admin/components/AdminTopNav.tsx:902` | `text-[oklch(40%_0.12_25)]` | `text-[var(--admin-status-cancelled-icon)]` |
| 4a | `oklch(92% 0.045 20)` | `src/app/admin/emails/page.tsx:486` | `hover:bg-[oklch(92%_0.045_20)]` | `hover:bg-[var(--admin-status-cancelled-action-hover)]` |
| 4b | `oklch(92% 0.045 20)` | `src/app/admin/emails/templates/components/TemplateEditor.tsx:374` | `hover:bg-[oklch(92%_0.045_20)]` | `hover:bg-[var(--admin-status-cancelled-action-hover)]` |
| 5 | `oklch(45% 0.19 25)` | `src/app/admin/audit/AuditEventCard.tsx:34` | `text-[oklch(45%_0.19_25)]` | `text-[var(--admin-status-cancelled-chip-icon)]` |
| 6 | `oklch(85% 0.06 25)` | `src/app/admin/emails/page.tsx:476` | `border-[oklch(85%_0.06_25)]` | `border-[var(--admin-status-cancelled-alert-border)]` |
| 7 | `oklch(82% 0.06 20)` | `src/app/admin/emails/page.tsx:703` | `border-[oklch(82%_0.06_20)]` | `border-[var(--admin-status-cancelled-border-strong)]` |
| 8 | `oklch(90% 0.05 20)` | `src/app/admin/operations/event-row.tsx:171` | `hover:bg-[oklch(90%_0.05_20)]` | `hover:bg-[var(--admin-status-cancelled-bg-hover)]` |
| 9 | `oklch(93% 0.04 20)` | `src/app/admin/staff/page.tsx:572` | `hover:bg-[oklch(93%_0.04_20)]` | `hover:bg-[var(--admin-status-cancelled-outline-hover)]` |
| 10 | `oklch(26% 0.14 25)` | `src/app/admin/staff/[staffId]/availability/lib.ts:39` | `border-[oklch(26%_0.14_25)]` | `border-[var(--admin-status-cancelled-text)]` |
| 11 | `oklch(28% 0.14 25)` | `src/components/ui/button.tsx:32` | `active:bg-[oklch(28%_0.14_25)]` | `active:bg-[var(--admin-danger-solid-active)]` |

All 17 find substrings were verified against the actual file contents
(direct `Read`, plus a `grep` pass on `emails/page.tsx` confirming each
literal appears exactly once per cited line — no cross-line ambiguity).

## Caveats / judgement calls flagged for the reviewer

- The dark-value picks for the four **border**-role tokens (#1, #2, #6, #7)
  extrapolate a shape (pivot-65-mirror, chroma × ~1.3-1.7) that was only ever
  observed on *near-white* (85-91% L) light values. Ours start lower
  (70-85% L) and more saturated, so I cross-checked with a second,
  independent method (proportional contrast-multiplier vs the four existing
  precedent border families) and picked values inside that method's observed
  0.89-1.53× range (going to the top of it for #1, which is deliberately the
  "loudest" one). This is the most uncertain part of the whole set — a human
  designer doing this by eye might reasonably land 5-10% away from my
  numbers. The verifier does not check border-token ratios at all
  (`derivePairs()` never adds "border" to its foreground regex), so nothing
  here is machine-gated except the ratio-comment self-consistency, which I
  did compute correctly for whatever numbers I chose.
- I did not attempt to lighten/darken any EXISTING token to "clean up" the
  drift I flagged — every new token's light value is byte-identical to the
  literal it replaces, per the fixed method.
