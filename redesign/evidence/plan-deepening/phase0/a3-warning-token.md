# A3 — `--admin-warning` value change (Step 0.2 / D8) — independent safety proof

Scope: prove `#b77900 → #986400` on `--admin-warning` (light + print blocks only) is safe.
Read-only pass. No files under `src/`, `scripts/`, etc. were modified.

## 1. Declaration sites — located by NAME, drift check

`grep -n "--admin-warning" src/styles/tokens.css` (full results, all 4 theme blocks):

```
97:   --admin-warning: #b77900;              (:root)
98:   --admin-warning-bg: #fff7df;           (:root)
359:  --admin-warning: oklch(84% 0.135 82);  ([data-theme="dark"])
360:  --admin-warning-bg: oklch(29% 0.045 75);
470:  --admin-warning: #b77900;              ([data-theme="light"])
471:  --admin-warning-bg: #fff7df;
566:  --admin-warning: #b77900;              (@media print)
567:  --admin-warning-bg: #fff7df;
```

**No drift.** The plan's cited anchors (`:470-471` light, `:566-567` print) are exactly
right at time of writing.

Surrounding context confirms the print block is a **genuine, separately-declared copy**,
not an inheritance artifact — `@media print { :root, [data-theme="dark"], [data-theme="light"], ... { ... } }`
is its own rule body (tokens.css:543-548 opens it; the header comment at :535-542 states
"print always renders the light palette... Values are the light set exactly"). Its
`--admin-warning`/`--admin-warning-bg` pair (566-567) is **byte-identical** to the light
block's (470-471): `#b77900` / `#fff7df` in both — confirmed by direct read, not assumed.

The `--admin-warning-bg-strong` / `--admin-warning-text-strong` pair sits a few lines
below in all four blocks (110/113 root, 365/368 dark, 475/478 light, 571/574 print) and is
**not** touched by this change (see §5).

## 2. Contrast recomputation — WCAG 2.1 relative luminance, by hand

Formula: for each channel `c∈[0,1]`: linear = `c/12.92` if `c≤0.04045` else `((c+0.055)/1.055)^2.4`.
`L = 0.2126·R + 0.7152·G + 0.0722·B`. Ratio = `(L_lighter+0.05)/(L_darker+0.05)`.

**`--admin-warning-bg` = `#fff7df`** → R=1.0, G=0.968627, B=0.874510
Linear: R=1.0, G≈0.930092, B≈0.737751
`L(bg) = 0.2126(1.0) + 0.7152(0.930092) + 0.0722(0.737751) ≈ 0.931067` (rounds to 0.9311)

**Old `--admin-warning` = `#b77900`** → R=0.717647, G=0.474510, B=0
Linear: R≈0.472948, G≈0.191194, B=0
`L ≈ 0.2126(0.472948) + 0.7152(0.191194) = 0.100541 + 0.136750 = 0.237291`

Ratio(old) = `(0.931067+0.05)/(0.237291+0.05) = 0.981067/0.287291 ≈ 3.4147` → **≈3.41:1**

**New `--admin-warning` = `#986400`** → R=0.596078, G=0.392157, B=0
Linear: R≈0.313895, G≈0.127392, B=0
`L ≈ 0.2126(0.313895) + 0.7152(0.127392) = 0.066734 + 0.091121 = 0.157855`

Ratio(new) = `(0.931067+0.05)/(0.157855+0.05) = 0.981067/0.207855 ≈ 4.7202` → **≈4.72:1**

**Plan's claim (3.41:1 → 4.72:1) is CONFIRMED**, by hand.

Cross-check against the repo's own tool (`node -e` against
`scripts/verify-admin-token-contrast.mjs`'s exported `resolveColour`/`contrastRatio`,
which uses the WCAG channel cutoff 0.03928 instead of 0.04045 — irrelevant here since no
channel value falls in that narrow band):

```
old ratio 3.4134423479237994
new ratio 4.719117594334624
```

Matches to 2 decimal places (3.41 → 4.72). Also ran the live tool against the real,
**unmodified** file: `node scripts/verify-admin-token-contrast.mjs --json` currently
reports exactly one failure — `{fg: "--admin-warning", bg: "--admin-warning-bg", theme:
"light", ratio: 3.4134423479237994, pass: false}` (dark theme: `ratio: 8.5798`, `pass:
true`, untouched by this step). This is today's baseline, pre-fix.

## 3. Full consumer list — re-derived, classified, before/after computed

`grep -rn "var(--admin-warning)\|var(--admin-warning-bg)" src --include=*.tsx --include=*.ts`
(the `.ts` glob returned zero matches; all hits are `.tsx`):

| Site | Usage | Class | Before → After (light) |
|---|---|---|---|
| `WorkingHoursDayEditor.tsx:221` | `border-[var(--admin-warning)]/35` | (c) border/decoration | improves (darker vs fixed light bg) |
| `WorkingHoursDayEditor.tsx:222` | `bg-[var(--admin-warning-bg)] … text-[var(--admin-warning)]` | **(a) direct D8 pair** | **3.41 → 4.72** |
| `dashboard-filters-client.tsx:409` | bg/border `warning-bg` tints | (c) tint only, no --admin-warning fg | n/a |
| `dashboard-filters-client.tsx:417` | `bg-[var(--admin-warning)] … text-[var(--admin-on-primary)]` | **(b) solid fill under near-white text** | **≈3.65 → ≈5.05** |
| `dashboard-filters-client.tsx:565` | `bg-[var(--admin-warning-bg)]/20` | (c) decorative tint | n/a |
| `dashboard-filters-client.tsx:575` | border/bg `warning-bg` hover tints | (c) decoration | n/a |
| `dashboard-filters-client.tsx:581` | `group-hover:bg-[var(--admin-warning)] group-hover:text-[var(--admin-on-primary)]` | **(b) same fill-under-text pair** | **≈3.65 → ≈5.05** |
| `admin-ui.tsx:92` | `progressFillClasses.gold = bg-[var(--admin-warning)]` | (c) progress-bar/step fill, no text renders on it (verified: both consumers, admin-ui.tsx:527,586, are bare fill bars/dots) | n/a (non-text; darkening only increases distinction from `--admin-progress-neutral` grey track) |
| `notification-bell.tsx:739` | `bg-[var(--admin-warning)]` severity dot | (c) decorative | n/a |
| `notification-card.tsx:177` | `bg-[var(--admin-warning)]` left accent bar | (c) decorative | n/a |
| `notification-card.tsx:189` | `text-[var(--admin-warning)]` (icon fill) on card row (near-white row bg / unread wash) | (a) icon-as-text-ish, light bg | improves |
| `dashboard-cards.tsx:144` | `border-[var(--admin-warning)] bg-[var(--admin-warning-bg-strong)]/30` | (c) border/tint (bg-strong untouched) | n/a |
| `dashboard-cards.tsx:627` | `text-[var(--admin-warning)]` icon on `--admin-panel-muted`-ish fill | (a) light bg | improves |
| `dashboard-cards.tsx:720` | `bg-[var(--admin-warning-bg)] … text-[var(--admin-warning)]` | **(a) direct D8 pair** | **3.41 → 4.72** |
| `dashboard-cards.tsx:733` | `text-[var(--admin-warning)]` on ambient card bg (`--admin-panel` #fffefa) | (a), approx | **≈3.62 → ≈5.01** (computed vs `#fffefa`) |
| `dashboard-cards.tsx:892` | `bg-[var(--admin-warning-bg)] … text-[var(--admin-warning)]` | **(a) direct D8 pair** | **3.41 → 4.72** |
| `dashboard-cards.tsx:972` | border/bg `warning-bg` tints (text is `--admin-heading`, not warning) | (c) | n/a |
| `dashboard-cards.tsx:1109` | `text-[var(--admin-warning)]` on ambient `--admin-panel` card | (a), approx | **≈3.62 → ≈5.01** |
| `dashboard-cards.tsx:1441` | `bg-[var(--admin-warning)]` small dot | (c) decorative | n/a |
| `dashboard-cards.tsx:1450` | `bg-[var(--admin-warning)]` progress-fill on `--admin-progress-neutral` track | (c) non-text graphical fill | n/a (improves distinction) |
| `dashboard-cards.tsx:1457` | `text-[var(--admin-warning)]` on `bg-[var(--admin-panel)]` card (line 1436) | (a), approx | **≈3.62 → ≈5.01** |
| `dashboard-cards.tsx:1594` | border/bg `warning-bg`/40 tint (container text is `--admin-body`) | (c) | n/a |
| `dashboard-cards.tsx:1603` | `bg-[var(--admin-warning)] text-[var(--admin-on-primary)]` | **(b) same fill-under-text pair** | **≈3.65 → ≈5.05** |
| `dashboard-cards.tsx:1614` | `text-[var(--admin-warning)]` inside the `warning-bg/40`-tinted container from :1594 | (a), tint-blended, approx | improves (bg stays light either way) |
| `dashboard-cards.tsx:1634` | `border-[var(--admin-warning)] bg-[var(--admin-warning-bg-strong)]/40` (hover /60) | (c) border/tint (bg-strong untouched) | n/a |
| `dashboard-cards.tsx:1651` | `text-[var(--admin-warning)]` inside the `warning-bg-strong/40`-tinted container from :1634 | (a), tint-blended, approx | improves (`--admin-warning-bg-strong` light value `oklch(93% 0.085 70)` is itself light/near-white, comparable to `#fff7df`) |
| `TherapistDashboard.tsx:627` | `borderColor: "var(--admin-warning)"` | (c) border only | n/a |
| `ReportsCharts.tsx:101` | `stroke: "var(--admin-warning)"` (Recharts line) | (c) decorative data-series stroke | n/a |

**The critical question — any consumer where darkening reduces contrast below
threshold?** No, and this is provable structurally, not just by enumeration: Step 0.2
edits **only** the `[data-theme="light"]` and `@media print` blocks. `:root` (97-98) and
`[data-theme="dark"]` (359-360) are untouched. Every real (a)/(b) consumer above resolves
its background from one of: `--admin-warning-bg` (#fff7df, unchanged), `--admin-panel`
(#fffefa, unchanged), `--admin-warning-bg-strong` (oklch 93%, unchanged, light), or is
itself the darkening fill under a **fixed** near-white foreground
(`--admin-on-primary`/white). In every one of these shapes the *background side of the
pair is fixed and light*, and the foreground (`--admin-warning`) strictly darkens
(`L: 0.2373 → 0.1579`, confirmed §2) — for a pair `(L_bg fixed & lighter, L_fg
decreasing)`, `ratio = (L_bg+0.05)/(L_fg+0.05)` is monotonically increasing as `L_fg`
falls. No consumer pairs `--admin-warning` as a **background** with a **dark** foreground
(checked specifically: the only two `bg-[var(--admin-warning)]` + text cases are both
paired with `--admin-on-primary`/white, never `--admin-heading`/`--admin-body`; the
`admin-ui.tsx` "gold" progress-fill has no text rendered on it, confirmed by reading both
of its consumers). **No dark-background pairing exists to find, because the dark theme
block is untouched by this step.** No regression.

## 4. Knock-on: `--notif-badge-warning-bg` (D7 alias)

`--notif-badge-warning-bg: var(--admin-warning);` (tokens.css:176, `:root` only) with
`--notif-badge-warning-fg: #ffffff` (tokens.css:177), consumed by `notification-bell.tsx`.

Computed (white `#ffffff` on old/new `--admin-warning`, via both hand-calc and the repo's
own `contrastRatio`):

- Before: **3.6532:1** (≈3.65:1 — matches the plan's D7 aside "computed 3.65:1" exactly)
- After: **5.0506:1** (≈5.05:1 — matches the plan's aside "≈3.65:1 → ≈5.05:1" exactly)

**Important nuance for the orchestrator, per the plan's own sequencing note
(POST-BAND-C-FOLLOWUP-plan.md:1777, 1813):** `--notif-badge-warning-bg` is declared
**only in `:root`** (D7's frozen-alias bug, Step 0.1's job). Step 0.2 edits the
**light/print blocks**, not `:root` — so immediately after Step 0.2 alone (before Step
0.1 lands), the live badge is **still frozen at `:root`'s unedited `#b77900`** and still
renders at **3.65:1**, not 5.05:1. The 5.05:1 only becomes real once Step 0.1 de-aliases
`--notif-badge-warning-bg` into its own per-theme copy — and per the execution order
given (0.5a → 0.2 → 0.1 → 0.4 → 0.5b), Step 0.1 runs *after* 0.2, so it will correctly
pick up `#986400` as the light value to bake in, not the stale `#b77900`. Do not report
Step 0.2 alone as having fixed D7's badge — it hasn't; it only pre-stages the value.

## 5. `--admin-warning-bg-strong` / `--admin-warning-text-strong` — confirmed untouched

Read directly, all four blocks:

- `:root` (110/113): `--admin-warning-bg-strong: oklch(93% 0.085 70);` /
  `--admin-warning-text-strong: oklch(30% 0.16 55); /* 10.71:1 vs warning-bg-strong */`
- dark (365/368): `oklch(33% 0.065 70)` / `oklch(91% 0.068 75); /* 9.41:1 */`
- light (475/478): `oklch(93% 0.085 70)` / `oklch(30% 0.16 55); /* 10.71:1 */`
- print (571/574): `oklch(93% 0.085 70)` / `oklch(30% 0.16 55); /* 10.71:1 */`

Both are **independently declared OKLCH literals**, not aliased to `--admin-warning` or
`--admin-warning-bg` anywhere. Confirmed already-passing via the live tool's own
`ratioResults` (unmodified file): light `10.707094...` (pass: true, stated 10.71, delta
-0.0029), dark `9.401969...` (pass: true, stated 9.41). Step 0.2 does not touch either
token and does not need to.

## 6. Zero reach into `/booking/manage` and the public site

```
grep -rn "--admin-warning" src/components/ui        → no matches
grep -rn "--admin-warning" src/app/booking           → no matches
grep -rn "--admin-warning" "src/app/(public)"        → no matches
```
Confirmed zero reach, independently.

## 7. Deliverable — exact edits and test code

### Edit site 1 — `[data-theme="light"]` block, `tokens.css:470-471`

Before:
```css
  --admin-warning: #b77900;
  --admin-warning-bg: #fff7df;
```
After:
```css
  --admin-warning: #986400;
  --admin-warning-bg: #fff7df;
```
(2-space indent; only the `--admin-warning` line changes, `-bg` is untouched)

### Edit site 2 — `@media print` block, `tokens.css:566-567`

Before:
```css
    --admin-warning: #b77900;
    --admin-warning-bg: #fff7df;
```
After:
```css
    --admin-warning: #986400;
    --admin-warning-bg: #fff7df;
```
(4-space indent — one level deeper, nested inside `@media print { :root, [data-theme=...] { ... } }`;
only the `--admin-warning` line changes)

`:root` (97-98) and `[data-theme="dark"]` (359-360) are **not** edited by this step.

### Test code — for `scripts/verify-admin-token-contrast.test.ts`

Matches the file's existing idiom (imports already present: `parseTokensCss`,
`derivePairs`, `checkPairs`, `readFileSync`, `TOKENS_PATH`). `derivePairs` already
auto-generates the `--admin-warning`/`--admin-warning-bg` pair via its `SEVERITY_BASE_BG`
loop (threshold `AA_NORMAL = 4.5`), so no bespoke pair-construction is needed — reuse the
real machinery:

```ts
describe("--admin-warning / --admin-warning-bg — Step 0.2 regression guard (D8)", () => {
  it("fails when the light-theme --admin-warning / --admin-warning-bg pair is below 4.5:1", () => {
    // Synthetic CSS carrying the PRE-fix (D8-failing) value, proving the guard
    // actually flags a regression rather than being trivially green.
    const failingCss = `
:root {
  --admin-warning: #b77900;
  --admin-warning-bg: #fff7df;
}
[data-theme="dark"] {
  --admin-warning: #b77900;
  --admin-warning-bg: #fff7df;
}
[data-theme="light"] {
  --admin-warning: #b77900;
  --admin-warning-bg: #fff7df;
}
@media print {
  :root {
    --admin-warning: #b77900;
    --admin-warning-bg: #fff7df;
  }
}
`;
    const parsed = parseTokensCss(failingCss);
    const pairs = derivePairs(parsed.tokens, parsed.ratioComments);
    const results = checkPairs(pairs, parsed.tokens);
    const lightWarning = results.find(
      (r) => r.fg === "--admin-warning" && r.bg === "--admin-warning-bg" && r.theme === "light"
    );

    expect(lightWarning?.ratio).toBeCloseTo(3.41, 1);
    expect(lightWarning?.pass).toBe(false);
  });

  it("passes at the fixed 4.72:1 in the real, post-Step-0.2 tokens.css", () => {
    const css = readFileSync(TOKENS_PATH, "utf8");
    const parsed = parseTokensCss(css);
    const pairs = derivePairs(parsed.tokens, parsed.ratioComments);
    const results = checkPairs(pairs, parsed.tokens);
    const lightWarning = results.find(
      (r) => r.fg === "--admin-warning" && r.bg === "--admin-warning-bg" && r.theme === "light"
    );

    expect(lightWarning?.ratio).toBeCloseTo(4.72, 1);
    expect(lightWarning?.pass).toBe(true);
  });
});
```

**Caveat, disclosed per the plan's own §7.5a gap:** `checkPairs` only iterates `dark` and
`light` scopes (confirmed by reading `checkPairs` in `verify-admin-token-contrast.mjs`) —
it never checks the `print` scope, so the second test above proves the **light** block
only. The print block's copy (edit site 2) must still be confirmed by manual diff against
the light block (they are byte-identical before and must stay byte-identical after —
see §1), exactly as the plan itself says (§7.5a / Step 0.5). If run **before** Step 0.2
lands, the second test will fail (current file still has `#b77900`, ratio 3.4134,
pass:false) — that is expected; it is written to run after the edit, not before.

## Summary of confirmed/refuted claims

| Claim | Verdict |
|---|---|
| Light/print anchors at tokens.css:470-471 / :566-567 | CONFIRMED, no drift |
| Print block is its own copy, byte-identical to light pre-change | CONFIRMED |
| 3.41:1 → 4.72:1 for the direct pair | CONFIRMED (hand calc: 3.4147→4.7202; tool: 3.41344→4.71912) |
| No consumer where darkening reduces contrast | CONFIRMED (structural proof, §3) |
| `--notif-badge-warning-bg` knock-on ≈3.65→≈5.05 | CONFIRMED, but only realized live after Step 0.1 also lands (§4) |
| `-bg-strong`/`-text-strong` pair separate & unaffected | CONFIRMED |
| Zero reach into `/booking/manage` / public site | CONFIRMED |
