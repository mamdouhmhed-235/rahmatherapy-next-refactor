# Phase 0 / Step 0.1 — Complete De-Alias Table

Derived fresh against `src/styles/tokens.css` as it stands in the working tree (2026-08-11). Execution
order assumed: **0.5a → 0.2 → 0.1 → 0.4 → 0.5b** (0.3 held, not derived here).

## 1. File structure — the four blocks (re-derived, exact line ranges)

| Block | Selector | Lines |
|---|---|---|
| `:root` | `:root {` | 1–260 |
| dark | `[data-theme="dark"],`<br>`[data-admin-theme-root][data-theme="dark"] ~ * {` | 331–447 |
| light | `[data-theme="light"],`<br>`[data-admin-theme-root][data-theme="light"] ~ * {` | 451–533 |
| print | `@media print { :root, [data-theme="dark"], [data-theme="light"], … {` | 543–634 (declarations 549–633, 4-space indent) |

`@theme` (636–655) and `@theme inline` (678–729) follow; not part of Step 0.1's scope.

`ThemeProvider.tsx:105` — `<div data-admin-theme-root="" data-theme={effectiveTheme}>` — confirmed verbatim, **no drift** from the plan's anchor.

## 2. Independent re-derivation of the 11-token list

Method: scanned every `:root` declaration of the form `--x: var(--y);` (bare alias, no other function
wrapping it), then confirmed each candidate is **not** redeclared anywhere in the dark/light/print blocks
(`Grep` for the exact token name across the whole file — each of the 11 appears **exactly once**, only in
`:root`).

Shared/public tokens (`--rahma-orange`, `--background`, `--foreground`, `--card`, `--popover*`, `--primary`,
`--secondary-foreground`, `--accent-foreground`, `--muted-foreground`, `--border`, `--input`, `--ring`,
`--brand-deep`, `--brand-surface`, `--brand-highlight`, `--brand-elevated-surface`, `--brand-card-border`)
are excluded: they alias `--rahma-*` tokens, which are **never** theme-scoped (by design — the file's own
262–330 comment states only `--admin-*`/`--notif-*` are touched by theme blocks), so their alias target
never varies by theme and there is no freeze bug to fix.

**Result: exactly the 11 tokens the plan names — confirmed, not 10, not 12:**

`--admin-shell` (67), `--admin-surface` (70), `--admin-surface-muted` (71), `--admin-text` (75),
`--admin-nav-text` (129), `--admin-nav-text-muted` (130), `--admin-nav-active-text` (132),
`--admin-cormorant-color` (136), `--notif-badge-critical-bg` (174), `--notif-badge-warning-bg` (176),
`--notif-badge-info-bg` (178).

(`--notif-badge-critical-fg`, `-warning-fg`, `-info-fg` are literal `#ffffff`, not `var()` aliases, and are
correctly out of scope — they don't need to vary by theme.)

## 3. Finding: the plan's claim about the existing comment is FALSE

Plan (line 1757): *"tokens.css's own 'aliases' comment currently at lines 319-321 … already names all 11
correctly; it is only this plan's own table that previously dropped one."*

**Verified false.** Quoting the comment verbatim (lines 319–325, current file):

```
 * Aliases (--admin-shell, --admin-surface, --admin-surface-muted,
 * --admin-text, --admin-nav-text, --admin-nav-text-muted,
 * --admin-nav-active-text, --admin-cormorant-color) are deliberately NOT
 * repeated: each is declared as var(<target>) on the same element, so it is
 * substituted with whichever value won the cascade for its target and tracks
 * the theme automatically. The five --admin-radius-* tokens are geometry, not
 * colour, and are genuinely theme-neutral.
```

This names **8** tokens, not 11 — it omits `--notif-badge-critical-bg`, `--notif-badge-warning-bg`,
`--notif-badge-info-bg` entirely. **This is drift the orchestrator should record**: the plan's own
justification for skipping the fix ("it is only this plan's own table that previously dropped one") is
itself wrong — the comment in the file undercounts too. Not fatal to Step 0.1 (the de-alias table above is
independently correct), but the plan's claim about the comment should not be repeated as fact.

## 4. Resolution chains and final value table

Method per cell: for each of the 11 tokens, resolve its alias target (e.g. `--admin-nav-text` → 
`--admin-body`) **inside the same block**. Since `--admin-body` (etc.) is redeclared with a literal in every
one of the four blocks (verified — none of the 11 tokens' targets are themselves aliases; all 8 distinct
targets — `--admin-sidebar`, `--admin-panel`, `--admin-panel-muted`, `--admin-heading`, `--admin-body`,
`--admin-text-muted`, `--admin-primary`, `--admin-accent`, `--admin-danger`, `--admin-warning`,
`--admin-info` — have their own literal in :root/dark/light/print, confirmed by grep with line numbers
below), no further chain/inheritance step is needed — each cell resolves in exactly one hop.

**Special case — `--notif-badge-warning-bg` → `--admin-warning`:** Step 0.2 (run *before* 0.1, per the
plan's own corrected sequencing note at line 1777) changes `--admin-warning` **only** in the light block
(`:470`) and the print block (`:566`, confirmed identical duplicate) from `#b77900` → `#986400`. It does
**not** touch `:root`'s `--admin-warning` (`:97`, stays `#b77900`) or the dark block's (`:359`, already
`oklch(84% 0.135 82)`, untouched). So the de-aliased light/print values for `--notif-badge-warning-bg` are
`#986400`; the de-aliased `:root`/dark values are `#b77900` / `oklch(84% 0.135 82)` respectively — **matching
the assignment's flagged subtlety exactly.**

### Target-token literal values, per block (grep-verified line numbers)

| Target | `:root` | dark | light | print |
|---|---|---|---|---|
| `--admin-sidebar` | `oklch(94% 0.014 75)` (64) | `oklch(22% 0.010 75)` (336) | `oklch(94% 0.014 75)` (454) | `oklch(94% 0.014 75)` (550) |
| `--admin-panel` | `#fffefa` (68) | `oklch(22% 0.008 88)` (339) | `#fffefa` (457) | `#fffefa` (553) |
| `--admin-panel-muted` | `#faf6ef` (69) | `oklch(26% 0.008 88)` (340) | `#faf6ef` (458) | `#faf6ef` (554) |
| `--admin-heading` | `#151b18` (73) | `oklch(96% 0.010 88)` (343) | `#151b18` (460) | `#151b18` (556) |
| `--admin-body` | `#313731` (74) | `oklch(90% 0.010 88)` (344) | `#313731` (461) | `#313731` (557) |
| `--admin-text-muted` | `#5e625e` (76) | `oklch(74% 0.010 88)` (345) | `#5e625e` (462) | `#5e625e` (558) |
| `--admin-primary` | `#0f5e8e` (80) | `oklch(76% 0.098 240)` (351) | `#0f5e8e` (463) | `#0f5e8e` (559) |
| `--admin-accent` | `#f7931e` (90) | `oklch(78% 0.145 62)` (354) | `#f7931e` (466) | `#f7931e` (562) |
| `--admin-danger` | `#c52b28` (99) | `oklch(76% 0.130 25)` (361) | `#c52b28` (472) | `#c52b28` (568) |
| `--admin-warning` (POST 0.2) | `#b77900` (97, unchanged) | `oklch(84% 0.135 82)` (359, unchanged) | **`#986400`** (was `#b77900` at 470) | **`#986400`** (was `#b77900` at 566) |
| `--admin-info` | `#0f5e8e` (121) | `oklch(79% 0.088 240)` (373) | `#0f5e8e` (481) | `#0f5e8e` (577) |

### Final de-alias table — the deliverable

| Alias token | Resolution chain | `:root` | dark | light | print |
|---|---|---|---|---|---|
| `--admin-shell` | → `--admin-sidebar` | `oklch(94% 0.014 75)` | `oklch(22% 0.010 75)` | `oklch(94% 0.014 75)` | `oklch(94% 0.014 75)` |
| `--admin-surface` | → `--admin-panel` | `#fffefa` | `oklch(22% 0.008 88)` | `#fffefa` | `#fffefa` |
| `--admin-surface-muted` | → `--admin-panel-muted` | `#faf6ef` | `oklch(26% 0.008 88)` | `#faf6ef` | `#faf6ef` |
| `--admin-text` | → `--admin-heading` | `#151b18` | `oklch(96% 0.010 88)` | `#151b18` | `#151b18` |
| `--admin-nav-text` | → `--admin-body` | `#313731` | `oklch(90% 0.010 88)` | `#313731` | `#313731` |
| `--admin-nav-text-muted` | → `--admin-text-muted` | `#5e625e` | `oklch(74% 0.010 88)` | `#5e625e` | `#5e625e` |
| `--admin-nav-active-text` | → `--admin-primary` | `#0f5e8e` | `oklch(76% 0.098 240)` | `#0f5e8e` | `#0f5e8e` |
| `--admin-cormorant-color` | → `--admin-accent` | `#f7931e` | `oklch(78% 0.145 62)` | `#f7931e` | `#f7931e` |
| `--notif-badge-critical-bg` | → `--admin-danger` | `#c52b28` | `oklch(76% 0.130 25)` | `#c52b28` | `#c52b28` |
| `--notif-badge-warning-bg` | → `--admin-warning` (POST 0.2) | `#b77900` | `oklch(84% 0.135 82)` | **`#986400`** | **`#986400`** |
| `--notif-badge-info-bg` | → `--admin-info` | `#0f5e8e` | `oklch(79% 0.088 240)` | `#0f5e8e` | `#0f5e8e` |

`--admin-shell` note (plan line 1761): confirmed zero live consumers —
`Grep "var(--admin-shell)"` across `src/` matches only its own declaration at `tokens.css:67`. Still
included in the table below per the plan's own instruction to assess-or-defer, not drop; recommend
de-aliasing it anyway for consistency (cheap, and closes the regression-guard gap for this one token too).

## 5. Exact CSS edits, per block

### `:root` block — in-place value replacement (no line added/removed, order unchanged)

```diff
- --admin-shell: var(--admin-sidebar);
+ --admin-shell: oklch(94% 0.014 75);
```
(line 67, 2-space indent, unchanged trailing `;`)

```diff
- --admin-surface: var(--admin-panel);
+ --admin-surface: #fffefa;
```
(line 70)

```diff
- --admin-surface-muted: var(--admin-panel-muted);
+ --admin-surface-muted: #faf6ef;
```
(line 71)

```diff
- --admin-text: var(--admin-heading);
+ --admin-text: #151b18;
```
(line 75)

```diff
- --admin-nav-text: var(--admin-body);
+ --admin-nav-text: #313731;
```
(line 129)

```diff
- --admin-nav-text-muted: var(--admin-text-muted);
+ --admin-nav-text-muted: #5e625e;
```
(line 130)

```diff
- --admin-nav-active-text: var(--admin-primary);
+ --admin-nav-active-text: #0f5e8e;
```
(line 132)

```diff
- --admin-cormorant-color: var(--admin-accent);
+ --admin-cormorant-color: #f7931e;
```
(line 136)

```diff
- --notif-badge-critical-bg: var(--admin-danger);
+ --notif-badge-critical-bg: #c52b28;
```
(line 174)

```diff
- --notif-badge-warning-bg: var(--admin-warning);
+ --notif-badge-warning-bg: #b77900;
```
(line 176 — **not** `#986400`: `:root`'s own `--admin-warning` is untouched by Step 0.2)

```diff
- --notif-badge-info-bg: var(--admin-info);
+ --notif-badge-info-bg: #0f5e8e;
```
(line 178)

All 11 `:root` edits are numerically inert — each new literal equals what the `var()` already resolved to
at `:root` today, so `:root`'s own rendering is byte-identical before/after (matches the plan's "MUST NOT
move: light-theme totals should not worsen" verify note).

### Dark block — 11 new declaration lines (2-space indent, matching the block's existing style)

Anchor each insertion against the **existing, unmoved surrounding lines** — quoted so the orchestrator can
place them without re-deriving position:

**a) After `--admin-sidebar-muted` (338), before `--admin-panel` (339):**
```
  --admin-sidebar-muted: oklch(19% 0.006 75);
  --admin-shell: oklch(22% 0.010 75);
  --admin-panel: oklch(22% 0.008 88);
```

**b) After `--admin-panel-muted` (340), before `--admin-border` (341):**
```
  --admin-panel-muted: oklch(26% 0.008 88);
  --admin-surface: oklch(22% 0.008 88);
  --admin-surface-muted: oklch(26% 0.008 88);
  --admin-border: oklch(33% 0.009 88);
```

**c) After `--admin-body` (344), before `--admin-text-muted` (345):**
```
  --admin-body: oklch(90% 0.010 88);
  --admin-text: oklch(96% 0.010 88);
  --admin-text-muted: oklch(74% 0.010 88);
```

**d) After `--admin-nav-bg` (378), before `--admin-nav-active-bg` (379):**
```
  --admin-nav-bg: oklch(24% 0.010 75);
  --admin-nav-text: oklch(90% 0.010 88);
  --admin-nav-text-muted: oklch(74% 0.010 88);
  --admin-nav-active-bg: oklch(33% 0.045 247);
```

**e) After `--admin-nav-active-bg` (379, now followed by the two lines from (d) above), before `--admin-nav-border` (380):**
```
  --admin-nav-active-bg: oklch(33% 0.045 247);
  --admin-nav-active-text: oklch(76% 0.098 240);
  --admin-nav-border: oklch(34% 0.012 75);
```
(insertions d and e are adjacent — net effect: `nav-bg`, `nav-text`, `nav-text-muted`, `nav-active-bg`,
`nav-active-text`, `nav-border`, in that order, mirroring `:root`'s own 128–133 order exactly)

**f) After `--admin-nav-border` (380), before the `/* Row fills */` comment (381):**
```
  --admin-nav-border: oklch(34% 0.012 75);
  --admin-cormorant-color: oklch(78% 0.145 62);
  /* Row fills */
```

**g) Before `--admin-client-accent` (405), i.e. right after the `/* Misc */` comment (404):**
```
  /* Misc */
  --notif-badge-critical-bg: oklch(76% 0.130 25);
  --notif-badge-warning-bg: oklch(84% 0.135 82);
  --notif-badge-info-bg: oklch(79% 0.088 240);
  --admin-client-accent: oklch(74% 0.075 275);
```

### Light block — same 11 lines, light values, same relative anchors (2-space indent)

**a)** after `--admin-sidebar-muted` (456), before `--admin-panel` (457):
```
  --admin-shell: oklch(94% 0.014 75);
```
**b)** after `--admin-panel-muted` (458), before `--admin-border` (459):
```
  --admin-surface: #fffefa;
  --admin-surface-muted: #faf6ef;
```
**c)** after `--admin-body` (461), before `--admin-text-muted` (462):
```
  --admin-text: #151b18;
```
**d/e)** after `--admin-nav-bg` (485), before `--admin-nav-border` (487), in order:
```
  --admin-nav-text: #313731;
  --admin-nav-text-muted: #5e625e;
  --admin-nav-active-bg: oklch(93% 0.04 247);
  --admin-nav-active-text: #0f5e8e;
  --admin-nav-border: oklch(88% 0.014 75);
```
**f)** after `--admin-nav-border` (487), before `--admin-hover-mist` (488):
```
  --admin-cormorant-color: #f7931e;
```
**g)** before `--admin-client-accent` (509):
```
  --notif-badge-critical-bg: #c52b28;
  --notif-badge-warning-bg: #986400;
  --notif-badge-info-bg: #0f5e8e;
```
(**note the `#986400`, not `#b77900` — POST Step 0.2**)

### Print block — same 11 lines, light-identical values except noted, 4-space indent (nested under `@media print {`)

**a)** after `--admin-sidebar-muted` (552), before `--admin-panel` (553):
```
    --admin-shell: oklch(94% 0.014 75);
```
**b)** after `--admin-panel-muted` (554), before `--admin-border` (555):
```
    --admin-surface: #fffefa;
    --admin-surface-muted: #faf6ef;
```
**c)** after `--admin-body` (557), before `--admin-text-muted` (558):
```
    --admin-text: #151b18;
```
**d/e)** after `--admin-nav-bg` (581), before `--admin-nav-border` (583), in order:
```
    --admin-nav-text: #313731;
    --admin-nav-text-muted: #5e625e;
    --admin-nav-active-bg: oklch(93% 0.04 247);
    --admin-nav-active-text: #0f5e8e;
```
**f)** after `--admin-nav-border` (583), before `--admin-hover-mist` (584):
```
    --admin-cormorant-color: #f7931e;
```
**g)** before `--admin-client-accent` (605):
```
    --notif-badge-critical-bg: #c52b28;
    --notif-badge-warning-bg: #986400;
    --notif-badge-info-bg: #0f5e8e;
```
(**`#986400` here too — the print block is Step 0.2's second, separately-edited copy**)

Placement choice, disclosed: I anchored every new declaration at the position matching its target's
position in `:root`, using existing neighbor lines as anchors. This is a stylistic judgement, not a
correctness requirement — the cascade/specificity outcome is identical regardless of declaration order
inside the same rule block. The orchestrator may place them differently if it prefers a different local
grouping; only the **values** and **which block** are load-bearing.

## 6. The false comment — quote and replacement

**Current (verbatim, lines 319–325):**
```
 * Aliases (--admin-shell, --admin-surface, --admin-surface-muted,
 * --admin-text, --admin-nav-text, --admin-nav-text-muted,
 * --admin-nav-active-text, --admin-cormorant-color) are deliberately NOT
 * repeated: each is declared as var(<target>) on the same element, so it is
 * substituted with whichever value won the cascade for its target and tracks
 * the theme automatically. The five --admin-radius-* tokens are geometry, not
 * colour, and are genuinely theme-neutral.
```

**Proposed replacement (same indentation/comment style, corrects both the mechanism claim and the
8-of-11 undercount found in §3):**
```
 * Formerly-aliased tokens (--admin-shell, --admin-surface, --admin-surface-muted,
 * --admin-text, --admin-nav-text, --admin-nav-text-muted, --admin-nav-active-text,
 * --admin-cormorant-color, --notif-badge-critical-bg, --notif-badge-warning-bg,
 * --notif-badge-info-bg) now carry a REAL value in every block below (Step 0.1,
 * 2026-08). They used to be declared once, in :root, as var(<target>) — but :root
 * (<html>) never carries data-theme (that attribute lives on
 * <div data-admin-theme-root> inside ThemeProvider), so the var() was substituted
 * once against :root's light value and every descendant inherited that frozen
 * colour forever, in every theme. A :root-only var() alias cannot track the
 * theme; only a literal declared inside each [data-theme="…"]/@media print block
 * can. The five --admin-radius-* tokens are geometry, not colour, and are
 * genuinely theme-neutral — they still need no per-block copy.
```

This replaces lines 319–325 inclusive; lines 315–318 (light-stays-default preamble) and 326–329 (contrast
methodology closing paragraph) are unaffected and untouched.

## 7. Blast-radius verification (re-derived, not trusted from the plan)

Plan claim (line 1779): *"No consumer of any of the 11 aliases sits in `src/components/ui/*.tsx`,
`src/app/booking/**`, or `src/app/(public)/**`… Step 0.1 has zero reach into `/booking/manage` or the
public site — proven, not assumed."*

Re-ran independently, grepping all 11 exact alias names against the three trees. **First pass used `\b`
word-boundary regex and produced a false positive** (3 hits in `src/components/ui/input.tsx`) — `\b`
matches between `text` and the following `-`, so `--admin-text\b` and `--admin-nav-text\b` wrongly matched
inside `--admin-text-muted`, `--admin-surface-input`, etc. Re-ran with boundary-corrected patterns
(`--admin-text([^-]|$)` etc.) and manually confirmed `input.tsx`'s three real matches are
`--admin-surface-input`, `--admin-body`, `--admin-text-muted`, `--admin-heading` — none of which are among
the 11 aliases.

**Corrected result — CONFIRMED, zero drift from the plan:**
- `src/app/(public)/**` — 0 matches, all 11 tokens
- `src/app/booking/**` — 0 matches, all 11 tokens
- `src/components/**` — 0 matches, all 11 tokens (including `input.tsx`, `badge.tsx`)

## 8. Summary for the orchestrator

- 11-token list: **confirmed exactly as the plan states** — no additions, no removals.
- Plan's claim that the file's existing comment "already names all 11 correctly" is **false** — it names
  8; §3 and §6 above give the corrected replacement text.
- Special-case value (`--notif-badge-warning-bg`, light+print = `#986400`) is captured correctly, per the
  assignment's flagged subtlety, and traced to why (Step 0.2 precedes Step 0.1, touches only light+print).
- `:root` edits are 11 in-place value substitutions, each numerically inert (no visible change at `:root`
  itself).
- Dark/light/print each need 11 new declaration lines with the values in §4/§5 above.
- Blast radius into public/booking/shared-components is genuinely zero, independently re-verified (with one
  self-caught false positive along the way, corrected before reporting).
- Not derived here (out of this assignment's scope): Step 0.4's regression-guard implementation, Step
  0.5's parser fix/prose-claim re-verification, and Step 0.2's own derivation (only its *effect* on
  `--notif-badge-warning-bg` was needed here and is captured above).
