# D1 root cause — the active nav item's 1.01:1 foreground/background pair

Investigation for ITEM 7 §7.4b (`redesign/plans/POST-BAND-C-FOLLOWUP-plan.md`), analysis only,
no product code changed. Method: a temporary Playwright spec
(`e2e/tmp-root-cause-d1.spec.ts`, deleted before this report was written — confirmed via
`git status --short e2e/` returning empty), run against the Owner-run dev server at
`localhost:3000` with `channel: "chrome"`, authenticated as OWNER via `loginAs`/`getCredentials`
per `e2e/helpers.ts`. Theme was set directly on `[data-admin-theme-root]` via
`element.setAttribute("data-theme", …)`, exactly as `e2e/admin-contrast-helpers.ts`'s
`setAdminTheme` does — never through the UI, so no `theme_preference` write reached the
database. No credential value was read, echoed, or logged.

**Headline: D1 has two independent, compounding causes, not one.** Both are proven against
real computed styles on the real DOM, not inferred from source reading.

1. **Alias-freeze.** `--admin-nav-text` and `--admin-nav-active-text` are declared **only in
   `:root`**, as `var(--admin-body)` / `var(--admin-primary)`. `:root` (`<html>`) never carries
   `data-theme="dark"` — only the `[data-admin-theme-root]` wrapper below it does — so these two
   custom properties resolve exactly once, against `:root`'s own (permanently light) environment,
   and that already-substituted value is what every descendant inherits. It never re-evaluates
   per theme, anywhere in the tree.
2. **Cascade-layer priority inversion.** `src/styles/site-parity.css:39-42`'s `a { color:
   inherit; text-decoration: none; }` is imported **unlayered** (`src/app/layout.tsx:4`, a plain
   import with no `@layer` wrapper), while every Tailwind utility — including
   `.text-\[var\(--admin-nav-active-text\)\]` — lives inside `@layer utilities`
   (`src/app/globals.css:6`, `@import "tailwindcss/utilities.css" layer(utilities)`). Per CSS
   Cascade Layers, an unlayered normal-importance declaration **always** beats a layered one,
   regardless of selector specificity. So the active `<a>`'s own `text-[var(--admin-nav-active-text)]`
   utility — confirmed present in its className and confirmed to compile to a real, correctly
   generated CSS rule — **never applies**. The `<a>`'s `color` is always `inherit`, i.e. whatever
   its parent `<nav>` resolved to.

Neither bug alone reproduces the measured pixels; together they do, exactly.

## 1. Computed-style evidence (dark theme, `/admin/dashboard`, OWNER)

Captured via `getComputedStyle(el)` on the real DOM, `active <a aria-current="page">` inside
`nav[aria-label="Admin navigation"]` (the "Dashboard" link):

| Custom property | Computed value on the active `<a>` | Note |
|---|---|---|
| `--admin-body` | `lab(88.45% .112 3.83)` ≈ `oklch(90% 0.010 88)` | correctly dark (not an alias) |
| `--admin-primary` | `lab(72.16% -12.78 -31.09)` ≈ `oklch(76% 0.098 240)` | correctly dark (not an alias) |
| `--admin-nav-text` | `#313731` | **frozen light**, alias of `--admin-body` |
| `--admin-nav-active-text` | `#0f5e8e` | **frozen light**, alias of `--admin-primary` |
| `--admin-nav-active-bg` | `lab(22.19% -3.94 -15.12)` ≈ `oklch(33% 0.045 247)` | correctly dark (not an alias) |

Actual rendered values on the same `<a>`:

| Property | Computed | Matches |
|---|---|---|
| `color` | `rgb(49, 55, 49)` | `#313731` = `--admin-body` LIGHT, i.e. `--admin-nav-text`'s frozen value — **not** `--admin-nav-active-text`'s `#0f5e8e` |
| `background-color` | `lab(22.19 -3.94 -15.12)` | `--admin-nav-active-bg` DARK — correct |

This is the exact pair from `redesign/evidence/admin-contrast/OWNER-dark.md`: fg `rgb(49, 55, 49)`,
bg `rgb(34, 56, 75)` (`oklch(33% 0.045 247)` renders to that sRGB). Confirmed byte-for-byte,
independent of the pre-existing sweep.

Light theme, same element, same session (settled 600 ms after the attribute flip to rule out a
`transition-colors` mid-animation read): `color` is **still** `rgb(49, 55, 49)` —  identical to
the dark-theme reading — while `background-color` correctly flips to the light active-bg
(`lab(91.86% -4.66 -13.81)`, ≈ `oklch(93% 0.04 247)`). This is the cleanest possible proof of
freeze #1: the text colour never moves at all, in either theme; only the correctly-implemented
background does. Light mode happens to look "right" purely because the frozen (permanently
light) value coincidentally equals what light mode's real value should be — it is not a
theme-aware pass, and would fail the instant `--admin-body`'s light value stopped matching
`--admin-nav-text`'s current byte-identical accident.

## 2. Which CSS rule wins, and from which selector block

**Background (`background-color`) — correct:**
`.bg-\[var\(--admin-nav-active-bg\)\] { background-color: var(--admin-nav-active-bg); }`,
generated inside `@layer utilities`, applies uncontested (confirmed via exhaustive recursive walk
of every stylesheet, including inside `@layer`/`@media` blocks: **no unlayered rule anywhere in
the document sets `background-color` for the `a` selector**). `--admin-nav-active-bg` itself is
declared directly (not aliased) in `:root` (`tokens.css:131`), `[data-theme="dark"]`
(`tokens.css:379`) and `[data-theme="light"]` (`tokens.css:486`). The wrapper element
(`[data-admin-theme-root]`) matches the dark block's **first** compound selector,
`[data-theme="dark"]` (`tokens.css:331`) — it carries the attribute directly, so it is not going
through the sibling-combinator arm at all — meaning the wrapper has its *own* directly-declared
dark value for this property, which then inherits correctly to the `<nav>` → `<a>` → `<span>`
chain because nothing between the wrapper and the `<a>` redeclares it. This is the "control
group": a real per-theme token, declared everywhere it needs to be, behaves exactly as designed.

**Foreground (`color`) — broken:**
Recursive stylesheet walk found exactly one candidate matching the active `<a>` with `color` set:

```
a { color: inherit; text-decoration: none; }
```

— at the **top level** of the compiled stylesheet (no `@layer` in its path), sourced from
`src/styles/site-parity.css:39-42`, imported unlayered by `src/app/layout.tsx:4`
(`import "@/styles/site-parity.css";`). The Tailwind utility that *should* have won,

```
.text-\[var\(--admin-nav-active-text\)\] { color: var(--admin-nav-active-text); }
```

, does exist (confirmed present, well-formed, inside `@layer utilities`) but **cannot** win: per
CSS Cascade Layers (`@layer theme, base, components, utilities;`, `globals.css:1`), any unlayered
author declaration outranks any layered one regardless of specificity — a plain type selector
(`a`, specificity 0,0,1) beats a class selector (`.text-[...]`, specificity 0,1,0) here, which is
the opposite of normal (non-layered) CSS cascade behaviour. So the `<a>`'s `color` is `inherit`,
and it takes whatever `<nav>` resolved to.

`<nav>` itself is not an `<a>`, so it isn't caught by the same unlayered rule. Its own
`.text-\[var\(--admin-nav-text\)\] { color: var(--admin-nav-text); }` (also `@layer utilities`,
`AdminTopNav.tsx:282`) applies uncontested (confirmed: no unlayered rule anywhere targets `nav`
for `color`), and resolves via freeze #1 to `#313731`. That is the value the `<a>` inherits, and
what ultimately renders.

## 3. Q3, answered definitively against the real DOM

**Does an alias declared in `:root` resolve against the element's computed value of the
referenced token, or against `:root`'s?**

**Against `:root`'s.** A custom property with only one declaration in the whole document — here,
`:root { --admin-nav-active-text: var(--admin-primary); }` (`tokens.css:132`) — has its `var()`
substituted exactly once, using `--admin-primary`'s value *on `:root` itself* at that point
(`:root` never carries `data-theme`, so that's always the light value, `#0f5e8e`). That single
resolved value is what inherits, unchanged, to every descendant — the wrapper, `<nav>`, the
active `<a>`, its `<span>`, and even an *inactive* `<a>`/`<span>` pair, all measured and all
identically `#0f5e8e` regardless of the theme attribute. It does not re-run the substitution
against whichever element ultimately consumes it via `var(--admin-nav-active-text)` in a `color:`
declaration — confirmed because that consuming element (the active `<a>`) sits *inside* the
dark-themed wrapper, where `--admin-primary` itself genuinely differs (`oklch(76% 0.098 240)`),
yet `--admin-nav-active-text` never picked that up.

This directly **falsifies** `tokens.css:319-325`'s own design-intent comment, which claims these
aliases are "substituted with whichever value won the cascade for its target" and "track the
theme automatically." That claim is the bug's origin: the code was written on the wrong mental
model of how CSS custom-property inheritance works, and every alias built on it inherited the
same defect.

## 4. Which component renders the failing element

`redesign/evidence/admin-contrast/OWNER-dark.md`'s selector —
`div.mx-auto.flex.h-14 > nav.hidden.flex-1.items-center > a.inline-flex.h-8.items-center > span`
— matches exactly one place in the codebase: **`AdminTopNav.tsx:282-307`, the desktop primary
nav** (`nav` carries `hidden … md:flex`, i.e. it only renders at the `md:` breakpoint and above —
tablet/desktop viewports; it is not present in the mobile DOM at all, so this specific instance
of D1 cannot occur below `md:`). The active branch of the ternary at lines 294-296 **does**
assign `text-[var(--admin-nav-active-text)]` — confirmed present verbatim in the rendered
`<a>`'s className — so the component's intent is correct. It is inert only because of cascade
bug #2 above.

**The other two treatments named in the dispatch:**

- **`AdminTopNav.tsx:487-500` (`UserMenuButton` trigger).** This is a `<button>`, not an `<a>` —
  `site-parity.css`'s `a { color: inherit }` does not target it, so cascade bug #2 does not apply
  here. **Freeze bug #1 still does**: its active branch (line 498) also reads
  `text-[var(--admin-nav-active-text)]`, which is the same permanently-`#0f5e8e` alias. Unlike
  the nav link, this element's `color` genuinely *is* governed by that utility — it will render a
  constant medium blue regardless of theme, paired with the same dark-mode `--admin-nav-active-bg`
  as D1. Whether that specific pairing crosses the AA threshold was not independently measured in
  this session (not one of the sweep's top-15 "worst findings," so if it fails it is a smaller
  gap than D1's 1.01:1) — flagged as unverified, not cleared.
- **`AdminTopNav.tsx:709-716` (mobile "More" tab avatar).** A `<span>`, not an `<a>` — bug #2
  doesn't apply. More importantly, its *inactive*-state pairing (line 714,
  `bg-[var(--admin-nav-active-bg)] text-[var(--admin-primary)]`) doesn't go through either alias
  at all: `--admin-primary` is a real per-theme token (not aliased), so this specific pairing is
  **not** an instance of D1's mechanism. (The *active*-state pairing at line 713,
  `bg-[var(--admin-primary)] text-[var(--admin-on-primary)]`, is likewise alias-free.)

So: of the three treatments, one (the desktop nav) is broken by both bugs compounding; one (the
user-menu button) is broken by freeze bug #1 alone, with an unverified but plausible contrast
gap; the third (mobile "More" avatar) does not use either broken alias and is not part of this
defect.

## 5. Enumeration — every `:root`-only alias token at risk

Full read of `src/styles/tokens.css`'s `:root` block (lines 1-260) against the
`[data-theme="dark"]` (331-447) and `[data-theme="light"]` (451-533) blocks. Excluded: the
`--rahma-*`/shadcn family (`--background`, `--foreground`, `--primary`, etc.) — those are
public-site tokens with no dark/light blocks at all by design (the public site has no dark mode),
so there is no competing declaration for them to have "missed." Included: every `--admin-*` /
`--notif-badge-*` custom property whose `:root` value is a bare `var(...)` reference **and which
is not redeclared in either theme block** — i.e., structurally identical to the D1 mechanism.

| Alias (`:root`-only) | Target | Target differs by theme? | Live consumer found? | Status |
|---|---|---|---|---|
| `--admin-nav-text` (`:129`) | `--admin-body` | yes | `AdminTopNav.tsx`, `ThemeToggle.tsx` | **Confirmed — D1** |
| `--admin-nav-active-text` (`:132`) | `--admin-primary` | yes | `AdminTopNav.tsx` (2 places) | **Confirmed — D1 / masked variant** |
| `--admin-text` (`:75`) | `--admin-heading` | yes | `ClientLtvRibbon.tsx` (×4), `MetricRow.tsx`, `TrendTile.tsx`, `PersonalContributionStripe.tsx` | **Confirmed — see §6, this is D9** |
| `--admin-nav-text-muted` (`:130`) | `--admin-text-muted` | yes | `AdminTopNav.tsx` (icons, search trigger), `ThemeToggle.tsx` | Consumed, not independently measured this session |
| `--admin-surface` (`:70`) | `--admin-panel` | yes | `clients/page.tsx:644` | Consumed, not independently measured this session |
| `--admin-surface-muted` (`:71`) | `--admin-panel-muted` | yes | `dashboard/attention-group-client.tsx:249` | Consumed, not independently measured this session |
| `--admin-cormorant-color` (`:136`) | `--admin-accent` | yes | `admin-ui.tsx:241` (Cormorant numerals — decoration only per its own Exception rule) | Consumed; likely cosmetic rather than a text-contrast failure |
| `--notif-badge-warning-bg` (`:176`) | `--admin-warning` | yes | `notification-bell.tsx:67` | **Confirmed — D7, see §7** |
| `--notif-badge-critical-bg` (`:174`) | `--admin-danger` | yes | `notification-bell.tsx:65` | Frozen, but the frozen (light) value still clears ~5.6:1 on white — not currently a measured failure |
| `--notif-badge-info-bg` (`:178`) | `--admin-info` | yes | `notification-bell.tsx:69` | Frozen, but the frozen (light) value still clears ~6.97:1 on white — not currently a measured failure |
| `--admin-shell` (`:67`) | `--admin-sidebar` | yes | none found (only feeds an unused `@theme inline` Tailwind color slot) | Frozen, but appears dead code — `--admin-sidebar` itself is already flagged "vestigial" by `tokens.css:62-63` |

**11 total**, all structurally identical to D1's mechanism. `tokens.css:319-321`'s own comment
names only 8 of them (it omits all three `--notif-badge-*-bg` aliases entirely) — the design
system's self-documentation undercounts its own risk surface. Three (`--notif-badge-critical-bg`,
`-info-bg`, and `--admin-shell`) are frozen but don't currently manifest as a measured AA
failure — either because the frozen value happens to still clear the bar, or because nothing
consumes the token. The other eight are either confirmed broken or consumed-but-unverified in
this pass.

## 6. Bonus finding: D9 is the same root cause, not a hardcoded literal

The defect register classifies D9 ("Dashboard KPI figures `0`, `£0.00`, `—`, 1.05:1 dark") as
**Class 2 / Fix type: Substitution** — implying a hardcoded oklch literal. It is not. Grepping for
the exact class fragments in the failing selector
(`section…p.break-words.text-base.font-semibold`) finds a single match:
`src/app/admin/dashboard/PersonalContributionStripe.tsx:90` —

```
<p className="break-words text-base font-semibold leading-tight tabular-nums text-[var(--admin-text)] sm:text-lg">
```

— which uses the token `--admin-text`, not a literal. Measured live, dark theme, same session:
the element containing `"0"` / `"£0.00"` / `"—"` computes `color: rgb(21, 27, 24)`, and
`getComputedStyle(el).getPropertyValue("--admin-text")` on that same element returns `#151b18` —
exactly `rgb(21, 27, 24)`, exactly `--admin-heading`'s **light** value (`tokens.css:73`) — while
`--admin-heading` itself, read on the same element, correctly shows the dark value
(`lab(95.41% .11 3.82)` ≈ `oklch(96% 0.010 88)`). This is freeze bug #1, verified on a completely
different component with no `<a>`/cascade-layer involvement at all (`<p>`, not `<a>`) — clean
proof that the alias-freeze mechanism alone, independent of the layer bug, is sufficient to
produce a measured failure. **D9 needs the same fix as D1 (de-alias `--admin-text`), not a
literal substitution — substituting a literal for a token that's already there would be a no-op.**
This should be corrected in the defect register.

## 7. D7 — header notification badge, white on amber

Root cause: **the same alias-freeze mechanism**, on `--notif-badge-warning-bg: var(--admin-warning)`
(`tokens.css:176`, `:root`-only, not redeclared in either theme block; consumed at
`notification-bell.tsx:67`). Measured on the wrapper element, both themes, this session:
`--notif-badge-warning-bg` is `#b77900` in dark theme and `#b77900` in light theme — identical,
never moves. `--notif-badge-warning-fg` is a literal `#ffffff` (`tokens.css:177`) — theme-invariant
by construction, not itself a bug. Contrast of `#ffffff` on `#b77900`, computed via the WCAG 2.1
relative-luminance formula: **3.654:1** — matches the plan's measured 3.65:1 exactly, in both
themes, because both sides of the pair are constant across themes.

This is **not purely mechanical** the way D1's background is: even in a hypothetical "unfrozen"
world, dark theme's real `--admin-warning` (`oklch(84% 0.135 82)`, a *light* amber) is a **text**
tone meant to sit *on* a dark panel — using it as a **solid fill under white text** would likely
be worse (light-on-light), not better. So the register's "Fix type: Substitution or a token" is
better stated as: **de-alias `--notif-badge-warning-bg` into its own genuinely-per-theme value,
purpose-built for white-foreground contrast in both themes** (mirroring the existing
`--admin-danger-solid` / `--admin-danger-solid-hover` pattern, which already exists precisely
because `--admin-danger` alone isn't fill-safe either) — not a simple value substitution.

As a side note: §5's D8 fix below, which darkens light `--admin-warning`, would incidentally
raise the *frozen* badge ratio above 4.5:1 in both themes (since the freeze means both themes see
light's value) — but that only masks the symptom. It does nothing for the underlying freeze, and
the badge would still visibly fail to darken/lighten when the theme toggle is used, which is a
separate correctness problem from the contrast number.

## 8. D8 — `--admin-warning` on `--admin-warning-bg`, light theme

Verified the plan's stated ratio independently: light `--admin-warning` = `#b77900`, light
`--admin-warning-bg` = `#fff7df` (both `tokens.css:97-98`, genuine per-theme tokens — this pair
is *not* alias-broken; it's a real design/value problem). WCAG relative luminance:
`L(#b77900) = 0.2374`, `L(#fff7df) = 0.9312`, contrast = `(0.9312+0.05)/(0.2374+0.05) = 3.414:1` —
matches the plan's 3.41:1.

**Proposed minimal fix (not applied): darken `--admin-warning` (light block only) from `#b77900`
to `#986400`.** This preserves hue and saturation exactly (uniform RGB scale factor ×0.83 on the
R/G channels, B stays 0) and only changes lightness. New contrast against the unchanged
`--admin-warning-bg` (`#fff7df`): `L(#986400) ≈ 0.1579`, ratio =
`(0.9312+0.05)/(0.1579+0.05) = 4.72:1` — clears the 4.5:1 AA bar with a modest, deliberate margin
(consistent with the file's other tight-but-safe margins, e.g. `--rahma-charcoal-strong`'s
documented 4.966:1).

**Blast radius of changing `--admin-warning` (light):** every consumer found (`grep -rn
"var(--admin-warning)"` across `src/`) uses it either (a) as **foreground text** on
`--admin-warning-bg` or `--admin-warning-bg-strong` (`dashboard-cards.tsx` ×7,
`dashboard-filters-client.tsx`, `WorkingHoursDayEditor.tsx`, `TherapistDashboard.tsx`,
`InsightRow.tsx` indirectly via the `-strong` sibling) — darkening only *improves* these; (b) as a
**solid fill under `--admin-on-primary`** (near-white in light theme) — `dashboard-cards.tsx:1603`,
`dashboard-filters-client.tsx:417` — darkening only *improves* these too; or (c) purely
**decorative** (progress-bar fill, chart stroke, a coloured dot) —
`dashboard-cards.tsx:1441/1450`, `ReportsCharts.tsx:101`, `admin-ui.tsx:92`,
`notification-card.tsx:177`, `notification-bell.tsx:739` — no contrast implication either way.
`--notif-badge-warning-bg` (§7) also consumes it via alias and would incidentally improve, per the
caveat above. **No consumer relies on `--admin-warning` being this light; found no regression
risk from darkening it.** This is a proposal only — no token value was changed.

## What could not be determined

- **The cascade-layer bug (`site-parity.css`'s unlayered `a { color: inherit }`) is not scoped to
  the admin nav.** It applies to **every** `<a>` element anywhere in the app — admin or public —
  that has a Tailwind colour utility applied directly to the `<a>` tag itself (rather than to a
  wrapping `<span>`/`<div>`); that colour utility can never win. This is a distinct, likely
  larger-reach bug than the alias-freeze mechanism, and this session did not attempt to enumerate
  every affected `<a>` site-wide (a proper pass would need either a static grep across every
  `<Link`/`<a` JSX usage for a directly-attached `text-*` colour class, or a live sweep). Flagged
  as a significant follow-up, not sized here.
- Six of the eleven `:root`-only aliases in §5 are confirmed *consumed* but their live rendered
  contrast was not independently measured this session (`--admin-nav-text-muted`,
  `--admin-surface`, `--admin-surface-muted`, `--admin-cormorant-color`, plus the user-menu button
  variant of `--admin-nav-active-text` from §4). They are structurally guaranteed to render the
  wrong (frozen) colour in dark mode; whether that specific pairing crosses the AA threshold in
  each case was not checked pixel-by-pixel.
- D9's background colour (`rgb(32, 30, 26)` per `OWNER-dark.md`) was not independently re-traced
  to its exact ancestor element in this session — the `<p>` itself is transparent, so the sweep
  tool's ancestor-walk found it; this report relies on the pre-existing measurement for that half
  of the pair, not a fresh capture.
- Did not investigate *why* `site-parity.css` was imported unlayered in the first place (e.g.
  whether it predates the project's `@layer` adoption, or is intentional for some other reason) —
  only that it is, and what it causes.
