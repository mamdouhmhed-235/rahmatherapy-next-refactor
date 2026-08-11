# A6 — Resolving the six unmeasured aliases (+ `--admin-shell` + the user-menu `--admin-nav-active-text` site)

Scope: Phase 0 / Step 0.1 exit-criteria item — "every other alias with a known-but-unmeasured
consumer... individually re-checked live post-fix, not silently assumed fine" (plan line 1945),
covering `--admin-surface`, `--admin-surface-muted`, `--admin-nav-text-muted`,
`--admin-cormorant-color`, `--notif-badge-critical-bg`, `--notif-badge-info-bg`, plus `--admin-shell`
and the user-menu-button consumption site of `--admin-nav-active-text`. Read-only throughout — no
file under `src/`, `scripts/`, `e2e/`, `supabase/` was modified. Repo state: `git log -1` = `0ec700c`,
branch `master`, dirty tree pre-existing and untouched.

Method: no live browser/credentials available (forbidden by this task's rules). Contrast was computed
statically — token values read directly from `src/styles/tokens.css` (current tree, full file read),
consumer JSX/CSS-in-JS read directly to establish rendering context and effective background,
contrast computed with a from-scratch OKLCH→linear-sRGB→sRGB implementation (CSS Color Module 4
matrices) and the WCAG 2.1 relative-luminance formula, run in a throwaway Node script
(`scratchpad/contrast.js`, not part of the repo). **Self-check:** the same script reproduces the
plan's and `root-cause-D1.md`'s already-published, independently-verified numbers exactly — D8
`#b77900` on `#fff7df` → 3.413:1 (plan: 3.41:1), proposed `#986400` → 4.719:1 (plan: 4.72:1), and D7's
"white on post-D8-darkened `#986400`" → 5.051:1 (root-cause-D1.md §7: "≈5.05:1") — before being
trusted for the six new pairs below.

## Headline

**Two previously undocumented, severe D1-class latent bugs were found** — `--admin-surface` (dark
contrast 1.111:1, essentially invisible) and `--admin-surface-muted` (1.247:1) — both worse in kind
than anything flagged as "probably fine" in the plan's own text. A third, `--admin-nav-text-muted`,
is a confirmed real-text AA failure at 2.646:1 (not merely an icon-tint concern — one of its consumers
renders the literal readable string "Search…"). The user-menu-button site of `--admin-nav-active-text`
is now **confirmed** broken (1.736:1), not just "plausible" as `root-cause-D1.md` §4 left it. Both
`--notif-badge-critical-bg` and `--notif-badge-info-bg` currently pass AA only because they're frozen
— **naively de-aliasing them the same way as the other tokens would make dark-mode contrast
dramatically WORSE** (5.600:1 → 2.256:1 for critical; 6.972:1 → 1.903:1 for info), for the identical
structural reason already documented for `--notif-badge-warning-bg`/D7 in `root-cause-D1.md` §7:
their real per-theme targets (`--admin-danger`, `--admin-info`) are *text* tones that lighten in dark
mode, not fill-safe-for-white-text tones. `--admin-shell` is confirmed genuinely dead (zero consumers,
by grep and by reading every candidate site) — recommend **defer**, not de-alias.

---

## Per-token findings

### 1. `--admin-surface` (`:root:70`, aliases `--admin-panel`)

**Consumer (exhaustive, `grep -rn "var(--admin-surface)" src` minus the `-muted` variant and the
`@theme inline` slot):** exactly one — `src/app/admin/clients/page.tsx:644` (no drift from the plan's
citation):
```tsx
<div className="sticky top-[var(--admin-topnav-offset,0px)] z-10 mb-2 flex items-baseline gap-3 bg-[var(--admin-surface)] pt-1 pb-1">
  <h2 id={...} className="... text-[var(--admin-heading)]">{group.letter}</h2>
  <span aria-hidden="true" className="h-px flex-1 bg-[var(--admin-border)]" />
</div>
```
This is the alphabetical section-header bar in the admin Clients list. The `<h2>` letter ("A", "B",
"C"...) is real, load-bearing text, coloured with `--admin-heading` — a genuine per-theme token, **not**
one of the 11 aliases, so it correctly resolves to its dark value on a dark-themed page.

**Rendering context:** text (`--admin-heading`) directly on background (`--admin-surface`). No
intervening element.

**Contrast (WCAG relative-luminance, computed):**

| | fg (`--admin-heading`) | bg (`--admin-surface`) | Contrast |
|---|---|---|---|
| FROZEN, dark | dark value `oklch(96% 0.010 88)` = `rgb(244,242,234)` | frozen-light `#fffefa` = `rgb(255,254,250)` | **1.111:1** |
| FROZEN, light | light `#151b18` = `rgb(21,27,24)` | frozen-light `#fffefa` | 17.314:1 (today's actual light rendering) |
| FIXED, dark | dark `rgb(244,242,234)` | real dark `--admin-panel` `oklch(22% 0.008 88)` = `rgb(28,26,22)` | **15.500:1** |
| FIXED, light | unchanged | unchanged | 17.314:1 (no change) |

**Decisive question:** de-aliasing **dramatically improves** dark-mode contrast (1.111:1 → 15.500:1)
and leaves light mode byte-identical (both are `#fffefa`/`--admin-panel`'s light value already).
1.111:1 is a genuine, previously unreported near-invisible-text defect in dark mode — the section
header letters in the admin Clients list are currently unreadable in dark theme.

**Recommendation: DE-ALIAS.** Not deferrable — this is an active defect, structurally identical to D1
but undiscovered until this pass because nothing in the existing sweep's top findings happened to
surface it.

---

### 2. `--admin-surface-muted` (`:root:71`, aliases `--admin-panel-muted`)

**Consumer (exhaustive grep):** exactly one — `src/app/admin/dashboard/attention-group-client.tsx:249`
(no drift):
```tsx
<div role="tablist" aria-label="Attention categories"
  className="flex ... rounded-[var(--admin-radius-card)] bg-[var(--admin-surface-muted)] p-1 ...">
  {categories.map((category) => (
    <button ... className={cn(
      "...",
      activeCategory === category.key
        ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)] ..."   // active: own bg layer, unaffected
        : "text-[var(--admin-body)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]"  // inactive: sits directly on the tablist bg
    )}>
```
This is the Dashboard "Attention" widget's category-tab strip. The **active** tab has its own solid
`--admin-primary` fill covering the parent background — not affected by this alias. The **inactive**
tabs (the default, non-hover state) have no background of their own, so their `--admin-body` text sits
directly on `--admin-surface-muted`.

**Contrast:**

| | fg (`--admin-body`) | bg (`--admin-surface-muted`) | Contrast |
|---|---|---|---|
| FROZEN, dark | dark `oklch(90% 0.010 88)` = `rgb(225,222,215)` | frozen-light `#faf6ef` = `rgb(250,246,239)` | **1.247:1** |
| FROZEN, light | light `#313731` = `rgb(49,55,49)` | frozen-light `#faf6ef` | 11.324:1 (today's actual) |
| FIXED, dark | dark `rgb(225,222,215)` | real dark `--admin-panel-muted` `oklch(26% 0.008 88)` = `rgb(38,36,32)` | **11.531:1** |
| FIXED, light | unchanged | unchanged | 11.324:1 (no change) |

**Decisive question:** de-aliasing improves dark-mode contrast from 1.247:1 (unreadable) to 11.531:1.
Light mode is byte-identical. Second previously undocumented near-invisible-text defect: the Dashboard
attention-category tab labels ("Overdue", "Unconfirmed", etc., whichever the category set is) are
currently unreadable in dark theme when not the active tab.

**Recommendation: DE-ALIAS.** Same as above — an active defect, not a judgement call.

---

### 3. `--admin-nav-text-muted` (`:root:130`, aliases `--admin-text-muted`)

**Consumers (exhaustive grep, 7 sites / 2 files — matches the deepening pass exactly, zero drift):**
- `AdminTopNav.tsx:232` — CSS-in-JS `.nav-rail-bell button > span { color: var(--admin-nav-text-muted) !important; background: transparent !important; border: 1px solid var(--admin-border) !important; }` — desktop bell icon glyph. `background: transparent`, so effective bg is the ancestor `<header>`'s `bg-[var(--admin-nav-bg)]` (a real per-theme token, not one of the 11).
- `AdminTopNav.tsx:250` — same pattern, `.mobile-nav-bell button svg`, mobile bell icon. Same effective bg.
- `AdminTopNav.tsx:300` — `<Icon className={cn(..., active ? "text-[var(--admin-nav-active-text)]" : "text-[var(--admin-nav-text-muted)]")} />` — inactive primary-nav item icon. Parent `<Link>` (inactive) has no bg of its own (only `hover:bg-[var(--admin-panel-muted)]`), so effective bg is the `<nav>`'s ancestor `<header>` `--admin-nav-bg`.
- `AdminTopNav.tsx:317` — `triggerClassName="... bg-transparent px-2.5 text-sm font-medium text-[var(--admin-nav-text-muted)] ..."`, passed into `AdminCommandSearch`'s `<BaseDialog.Trigger>`. **Confirmed by reading `AdminCommandSearch.tsx:111-125`: this trigger renders real visible text**, `<span>{compact ? "Search…" : "Search bookings, clients, staff…"}</span>`, directly inheriting this colour (`bg-transparent`, so effective bg is `--admin-nav-bg` again). This is normal body text (`text-sm` ≈14px), requiring the 4.5:1 threshold, not the 3:1 large-text/UI-component threshold.
- `AdminTopNav.tsx:938` — `MobileSearch` trigger button, `className="... text-[var(--admin-nav-text-muted)] ..."`, no bg of its own → effective bg `--admin-nav-bg`.
- `ThemeToggle.tsx:25,39` — the `Icon`/`ChevronDown` glyphs inside the theme `<select>` wrapper, `absolute` positioned over a `bg-transparent` `<select>` → effective bg `--admin-nav-bg`.

Every consumption site's effective background resolves to `--admin-nav-bg` (a genuine, correctly
per-theme token: `oklch(96% 0.012 75)` light / `oklch(24% 0.010 75)` dark — not aliased, not part of
the 11) — a consistent, single rendering context for this token.

**Contrast:**

| | fg (`--admin-nav-text-muted`) | bg (`--admin-nav-bg`) | Contrast |
|---|---|---|---|
| FROZEN, dark | frozen-light `#5e625e` = `rgb(94,98,94)` | real dark `oklch(24% 0.010 75)` = `rgb(34,31,26)` | **2.646:1** |
| FROZEN, light | `#5e625e` | real light `oklch(96% 0.012 75)` = `rgb(247,241,233)` | 5.529:1 (today's actual) |
| FIXED, dark | real dark `--admin-text-muted` `oklch(74% 0.010 88)` = `rgb(173,171,164)` | `rgb(34,31,26)` | **7.145:1** |
| FIXED, light | `#5e625e` (unchanged, since frozen already equals the light target) | `rgb(247,241,233)` | 5.529:1 (no change) |

**Decisive question:** de-aliasing takes dark-mode contrast from 2.646:1 (fails the 4.5:1 text
threshold **and** the 3:1 UI-component/large-text threshold) to 7.145:1. Light mode is byte-identical
by construction (frozen value = light target value). Confirmed real defect, not merely theoretical —
the `AdminCommandSearch.tsx` "Search…" label is genuinely-rendered body text.

**Recommendation: DE-ALIAS.**

---

### 4. `--admin-cormorant-color` (`:root:136`, aliases `--admin-accent`)

**Consumer (exhaustive grep):** exactly one — `admin-ui.tsx:241`, inside the `numeral`-mode branch of
what is effectively an `AdminMetric`/stat-tile component:
```tsx
<p className="mt-2 font-[var(--font-admin-serif),Georgia,serif] text-[3.157rem] font-bold leading-none tracking-[-0.02em] text-[var(--admin-cormorant-color)]"
   style={{ fontFamily: "var(--font-admin-serif), Georgia, serif" }}>
  {value}
</p>
```
Its own comment in `tokens.css:134-135` calls this "decoration only, never body text" (the "Cormorant
Exception rule"), but the rendered content (`{value}`) is the tile's actual numeric value, not
ornamentation — it happens to be styled at display size (50.5px = `3.157rem`), which crosses the WCAG
"large-scale text" threshold (≥24px normal weight, and this is bold so the bar is even lower at
≈18.7px), so the applicable AA bar is **3:1**, not 4.5:1, regardless of the "decorative" framing.
Background: the wrapping `<article>` uses `panelBgClasses[resolvedTone]` — `bg-[var(--admin-panel)]`
(default tone) or `bg-[var(--admin-status-cancelled-bg)]` (danger tone, `alert=true`) — both genuine
per-theme tokens, not aliases.

**Contrast:**

| | fg (`--admin-cormorant-color`) | bg | Contrast |
|---|---|---|---|
| FROZEN, dark, default tone | frozen-light `#f7931e` = `rgb(247,147,30)` | real dark `--admin-panel` `rgb(28,26,22)` | 7.568:1 |
| FROZEN, dark, danger tone | `rgb(247,147,30)` | real dark `--admin-status-cancelled-bg` `oklch(29% 0.055 20)` = `rgb(67,31,32)` | 6.284:1 |
| FIXED, dark, default tone | real dark `--admin-accent` `oklch(78% 0.145 62)` = `rgb(249,160,74)` | `rgb(28,26,22)` | 8.402:1 |
| FIXED, dark, danger tone | `rgb(249,160,74)` | `rgb(67,31,32)` | 6.977:1 |
| FROZEN/FIXED, light, default tone (unchanged either way) | `rgb(247,147,30)` | real light `--admin-panel` `rgb(255,254,250)` | 2.275:1 |

**Decisive question:** de-aliasing does not worsen anything — dark mode improves modestly in both
sub-contexts (7.568→8.402, 6.284→6.977); light mode is byte-identical (frozen already equals light).
**Side finding, out of Phase 0 scope:** the 2.275:1 light-mode figure is **below even the relaxed
3:1 large-text bar**, but this is pre-existing and completely unaffected by the alias mechanism (it is
identical before and after de-aliasing, since frozen == light in both cases) — it is a genuine
potential defect but belongs to a different workstream (a colour/value question, not a theme-tracking
one; touching it would mean editing an `oklch`/hex literal, which Step 0.1's own rule forbids: "if you
find yourself editing an oklch() value in Phase 0, stop"). Flag for the Owner/Workstream 2, do not fix
here.

**Recommendation: DE-ALIAS anyway**, for consistency and because no direction worsens — matches
`root-cause-D1.md`'s own framing ("likely cosmetic rather than a text-contrast failure... may be
correct today and still worth de-aliasing for consistency").

---

### 5. `--notif-badge-critical-bg` (`:root:174`, aliases `--admin-danger`) — ⚠️ tracking would WORSEN dark mode

**Consumer (exhaustive grep):** exactly one — `notification-bell.tsx:65`, inside `getBadgeClasses()`:
```tsx
case "critical":
  return "bg-[var(--notif-badge-critical-bg)] text-[var(--notif-badge-critical-fg)]";
```
Applied to the unread-count pill on the bell icon (both desktop, `:260`, and mobile, `:341`
trigger). `--notif-badge-critical-fg` is a **literal** `#ffffff` (`tokens.css:175`), theme-invariant by
construction — not itself an alias. This is a solid fill with fixed white text (real content: the
unread count number, e.g. "3" or "9+").

**Contrast:**

| | fg (`--notif-badge-critical-fg`, literal white) | bg (`--notif-badge-critical-bg`) | Contrast |
|---|---|---|---|
| FROZEN, both themes | `#ffffff` | frozen-light `--admin-danger` `#c52b28` = `rgb(197,43,40)` | **5.600:1** (matches plan's stated "≈5.6:1" exactly) |
| FIXED, dark (naive: track `--admin-danger`'s real dark value) | `#ffffff` | real dark `--admin-danger` `oklch(76% 0.130 25)` = `rgb(249,143,135)` | **2.256:1** ⚠️ |
| FIXED, light | `#ffffff` | `rgb(197,43,40)` (unchanged) | 5.600:1 |

**Decisive question — answered explicitly, this is the trap:** a naive de-alias (pointing
`--notif-badge-critical-bg` at `--admin-danger`'s own per-theme dark value, the same mechanical pattern
used for tokens #1-4 above) **would regress dark-mode contrast from a currently-passing 5.600:1 to a
failing 2.256:1.** The reason is structural, not incidental: `--admin-danger`'s dark value is
deliberately *lightened* (per `tokens.css:356` "tone lightens, its paired -bg darkens") because its
real design purpose in dark mode is **text-on-a-dark-panel**, not **a solid fill under white text**.
This is the exact mechanism `root-cause-D1.md` §7 already documented for the sibling token
`--notif-badge-warning-bg`/D7: *"even in a hypothetical 'unfrozen' world, dark theme's real
`--admin-warning`... is a text tone meant to sit on a dark panel — using it as a solid fill under white
text would likely be worse (light-on-light), not better."* The identical logic applies to `-danger` and
`-info` (below) — confirmed here with real numbers, not just by analogy.

**Recommendation: DE-ALIAS, but NOT by tracking the target.** Give it an **explicit, identical, literal
value in all four blocks** (`:root`, dark, light, print) — `#c52b28` in every block — rather than
`var(--admin-danger)`. This:
- Fixes the structural bug (Step 0.4's guard requires every `--admin-*`/`--notif-*` token to have a
  real value in each block, not a bare `var()` alias — an explicit repeated literal satisfies that).
- Does **not** change a single rendered pixel in either theme (5.600:1 in both, exactly as today).
- Does **not** invent a new colour value, so it stays inside Step 0.1's "no `oklch(` literal edits"
  boundary — the literal `#c52b28` already exists in the file today (as `--admin-danger`'s light
  value); this only stops it being *sourced through* the alias mechanism.
- Has direct precedent already in this file: `--admin-nav-surface-text`/`-link`/`-link-icon`
  (`tokens.css:438-443` comment) are held **verbatim, not inverted, across dark/light/print by
  design** — "Unlike every other token here they were never light-stuck: they paint light type onto
  chrome that is dark in BOTH themes, so the light values are already the dark-mode answer." The same
  logic applies here: a white-foreground badge fill needs to stay dark-and-saturated in both themes, so
  the light-mode value is already the correct answer for dark mode too.

A tuned, purpose-built *different* dark-mode badge colour (rather than reusing the light value) is a
legitimate design option but is **out of Phase 0's scope** (it would be inventing a new colour value,
Workstream 2's job) — record that as the reason for the "reuse, don't invent" choice in the commit
message if the Owner asks why the badge doesn't get a bespoke dark tint.

---

### 6. `--notif-badge-info-bg` (`:root:178`, aliases `--admin-info`) — same trap, same fix

**Consumer (exhaustive grep):** exactly one — `notification-bell.tsx:69`, same `getBadgeClasses()`
structure as above, `case "info"`. `--notif-badge-info-fg` is likewise a literal `#ffffff`
(`tokens.css:179`).

**Contrast:**

| | fg (literal white) | bg (`--notif-badge-info-bg`) | Contrast |
|---|---|---|---|
| FROZEN, both themes | `#ffffff` | frozen-light `--admin-info` `#0f5e8e` = `rgb(15,94,142)` | **6.972:1** (matches plan's stated "≈6.97:1" exactly) |
| FIXED, dark (naive: track `--admin-info`'s real dark value) | `#ffffff` | real dark `--admin-info` `oklch(79% 0.088 240)` = `rgb(133,195,238)` | **1.903:1** ⚠️ (even worse than the critical-badge case, because `--admin-info`'s dark lightness (79%) exceeds `--admin-danger`'s (76%)) |
| FIXED, light | `#ffffff` | `rgb(15,94,142)` (unchanged) | 6.972:1 |

**Decisive question:** identical trap, identical answer. Naive tracking would collapse contrast from
6.972:1 (passing) to 1.903:1 (badly failing).

**Recommendation: DE-ALIAS via explicit identical literal in all four blocks** — `#0f5e8e` everywhere
— same reasoning and same precedent as `--notif-badge-critical-bg` above. No rendered pixel changes in
either theme.

---

### 7. `--admin-shell` (`:root:67`, aliases `--admin-sidebar`) — dead code, recommend DEFER

**Consumer check (exhaustive):**
- `grep -rn "var(--admin-shell)" src` → **zero matches** anywhere in `src/` except the alias's own
  declaration and the `@theme inline` Tailwind colour-slot generator at `tokens.css:714`
  (`--color-admin-shell: var(--admin-shell);`).
- `grep -rn "(bg|text|border|ring|fill|stroke)-admin-shell\b" src` → **zero matches** — no JSX anywhere
  uses a `bg-admin-shell`/`text-admin-shell`/etc. Tailwind utility class that would consume the
  generated colour slot.
- The **only** string match for `admin-shell` in the entire `src/` tree that isn't the token itself is
  the unrelated **structural CSS class** `.admin-shell` (`AdminTopNav.tsx:204`,
  `className="admin-shell min-h-screen overflow-x-hidden bg-[var(--admin-canvas)]"`, styled in
  `globals.css:23-38` with `position: relative; isolation: isolate;` plus a `::before` ambient-gradient
  rule that itself consumes a **different** token, `--admin-shell-ambient` — confirmed by reading
  `globals.css:17-30` directly). This is a same-name coincidence, not a consumer of the `--admin-shell`
  custom property.
- `--admin-shell`'s own target, `--admin-sidebar`, is independently flagged **"Vestigial — no live UI
  binding"** by the file's own comment at `tokens.css:62-63`.

**Confirmed: zero live consumers.** Matches both `root-cause-D1.md` §5 and the deepening pass §1.3
exactly, zero drift.

**Recommendation: DEFER**, not de-alias, with the reason **"dead code, no visible consumer"** recorded
in the commit message. Reasoning: de-aliasing would mean inventing per-theme copies
(`oklch(94% 0.014 75)` light/print, `oklch(22% 0.010 75)` dark — `--admin-sidebar`'s own real values,
readily available if wanted) for a token that provably paints zero pixels anywhere in the product. That
is speculative maintenance work with no verifiable behavioural effect — it cannot be tested live (no
live rendering to check), and it adds three lines to a file already carrying real technical debt
comments elsewhere. This is the "Simplicity First" call, not a safety call — there is no risk either
way since nothing consumes it. If the orchestrator prefers de-aliasing anyway purely for the guard's
sake (Step 0.4's synthetic-fixture test only needs one *known* violation to prove itself; the real-file
"zero found" assertion after Step 0.1 would still need `--admin-shell` handled one way or the other to
be true), the exact 3 lines to add are supplied below as an alternative — but the recommended path is
defer.

---

### 8. `--admin-nav-active-text`, user-menu-button consumption site (`AdminTopNav.tsx:498`)

This token (`:root:132`, aliases `--admin-primary`) is **already** in the plan's Step 0.1 table — this
item is specifically about confirming the *second* consumption site the table itself calls out
(`root-cause-D1.md` §4: "Whether that specific pairing crosses the AA threshold was not independently
measured in this session... flagged as unverified, not cleared").

**Consumer, confirmed, zero drift from the plan's `~line 498` citation:**
```tsx
// AdminTopNav.tsx:495-500 (UserMenuButton trigger)
className={cn(
  "inline-flex h-8 items-center gap-2 rounded-[var(--admin-radius-control)] px-2 bg-transparent ...",
  hasActiveMenuPage || open
    ? "bg-[var(--admin-nav-active-bg)] text-[var(--admin-nav-active-text)] ring-1 ring-inset ring-[var(--admin-primary)]/20"
    : "text-[var(--admin-nav-text)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]"
)}
```
Background: `--admin-nav-active-bg` — a genuine per-theme token (not aliased): `oklch(93% 0.04 247)`
light / `oklch(33% 0.045 247)` dark.

**Contrast:**

| | fg (`--admin-nav-active-text`) | bg (`--admin-nav-active-bg`) | Contrast |
|---|---|---|---|
| FROZEN, dark | frozen-light `--admin-primary` `#0f5e8e` = `rgb(15,94,142)` | real dark `rgb(34,56,75)` | **1.736:1** |
| FROZEN, light | `rgb(15,94,142)` | real light `rgb(211,235,255)` | 5.676:1 (today's actual) |
| FIXED, dark | real dark `--admin-primary` `oklch(76% 0.098 240)` = `rgb(117,186,233)` | `rgb(34,56,75)` | **5.738:1** |
| FIXED, light | unchanged | unchanged | 5.676:1 |

**Result: CONFIRMED broken today (1.736:1, fails AA), not merely "plausible."** De-aliasing
`--admin-nav-active-text` — which Step 0.1 already plans to do, for the primary-nav-link instance of
this same token — **also fixes this second site automatically**, taking it to 5.738:1. No separate
edit is required beyond Step 0.1's existing planned fix for this token; this is purely the "individually
re-checked live" confirmation the exit criteria ask for. Unlike the primary nav `<a>` (D1), this is a
`<button>`, so Step 0.3's cascade-layer bug (which only affects bare `a { color: inherit }`) does not
apply here — the fix is self-contained to Step 0.1 for this element.

---

## Summary table

| Token | Frozen dark | Fixed dark | Frozen/Fixed light | Verdict |
|---|---|---|---|---|
| `--admin-surface` | 1.111:1 | 15.500:1 | 17.314:1 (unchanged) | **DE-ALIAS** (track target) — active, previously undocumented defect |
| `--admin-surface-muted` | 1.247:1 | 11.531:1 | 11.324:1 (unchanged) | **DE-ALIAS** (track target) — active, previously undocumented defect |
| `--admin-nav-text-muted` | 2.646:1 | 7.145:1 | 5.529:1 (unchanged) | **DE-ALIAS** (track target) — active, confirmed defect (real "Search…" text) |
| `--admin-cormorant-color` | 7.568 / 6.284:1 (already passes, frozen) | 8.402 / 6.977:1 | 2.275:1 (unchanged, pre-existing, out of scope) | **DE-ALIAS** (track target) — consistency, no downside |
| `--notif-badge-critical-bg` | 5.600:1 (passes, frozen) | **2.256:1 if naively tracked ⚠️** | 5.600:1 (unchanged) | **DE-ALIAS via explicit identical literal in all 4 blocks** — do NOT track target |
| `--notif-badge-info-bg` | 6.972:1 (passes, frozen) | **1.903:1 if naively tracked ⚠️** | 6.972:1 (unchanged) | **DE-ALIAS via explicit identical literal in all 4 blocks** — do NOT track target |
| `--admin-shell` | n/a (zero consumers) | n/a | n/a | **DEFER** — "dead code, no visible consumer" |
| `--admin-nav-active-text` (user-menu site) | 1.736:1 | 5.738:1 | 5.676:1 (unchanged) | Confirmed broken; **fixed automatically by Step 0.1's existing planned de-alias of this token** — no separate action |

---

## Deliverable — exact `tokens.css` edits

All edits are **additive or value-only**, per Phase 0's own rollback guarantee. Anchor by the existing
neighbouring declaration's **text**, not by line number (numbers below are "as read this pass, zero
drift found" but the plan's own convention is re-locate-by-name).

### `--admin-surface` — de-alias, track target (`--admin-panel`)

- `:root` (currently line 70): change `--admin-surface: var(--admin-panel);` → `--admin-surface: #fffefa;`
- `[data-theme="dark"]` block: add a new line `--admin-surface: oklch(22% 0.008 88);` — recommended
  anchor: immediately after `--admin-panel-muted: oklch(26% 0.008 88);` (currently dark block line 340).
- `[data-theme="light"]` block: add `--admin-surface: #fffefa;` — anchor: immediately after
  `--admin-panel-muted: #faf6ef;` (currently light block line 458).
- `@media print` block: add `--admin-surface: #fffefa;` — anchor: immediately after the print block's
  own `--admin-panel-muted: #faf6ef;` (currently print block line 554).

### `--admin-surface-muted` — de-alias, track target (`--admin-panel-muted`)

- `:root` (currently line 71): change `--admin-surface-muted: var(--admin-panel-muted);` →
  `--admin-surface-muted: #faf6ef;`
- `[data-theme="dark"]`: add `--admin-surface-muted: oklch(26% 0.008 88);` — same anchor point as above
  (adjacent to the new `--admin-surface` dark line).
- `[data-theme="light"]`: add `--admin-surface-muted: #faf6ef;` — same anchor point as above.
- `@media print`: add `--admin-surface-muted: #faf6ef;` — same anchor point as above.

### `--admin-nav-text-muted` — de-alias, track target (`--admin-text-muted`)

- `:root` (currently line 130): change `--admin-nav-text-muted: var(--admin-text-muted);` →
  `--admin-nav-text-muted: #5e625e;`
- `[data-theme="dark"]`: add `--admin-nav-text-muted: oklch(74% 0.010 88);` — recommended anchor:
  inside the "Admin chrome" group, immediately after `--admin-nav-bg: oklch(24% 0.010 75);` (currently
  dark block line 378), matching `:root`'s own physical grouping (nav-text-muted sits right after
  nav-bg/nav-text at `:root:128-130`).
- `[data-theme="light"]`: add `--admin-nav-text-muted: #5e625e;` — anchor: immediately after
  `--admin-nav-bg: oklch(96% 0.012 75);` (currently light block line 485).
- `@media print`: add `--admin-nav-text-muted: #5e625e;` — anchor: immediately after the print block's
  own `--admin-nav-bg: oklch(96% 0.012 75);` (currently print block line 581).

### `--admin-cormorant-color` — de-alias, track target (`--admin-accent`)

- `:root` (currently line 136): change `--admin-cormorant-color: var(--admin-accent);` →
  `--admin-cormorant-color: #f7931e;`
- `[data-theme="dark"]`: add `--admin-cormorant-color: oklch(78% 0.145 62);` — anchor: immediately
  after `--admin-accent: oklch(78% 0.145 62);` (currently dark block line 354).
- `[data-theme="light"]`: add `--admin-cormorant-color: #f7931e;` — anchor: immediately after
  `--admin-accent: #f7931e;` (currently light block line 466).
- `@media print`: add `--admin-cormorant-color: #f7931e;` — anchor: immediately after the print block's
  own `--admin-accent: #f7931e;` (currently print block line 562).

### `--notif-badge-critical-bg` — de-alias via **explicit identical literal**, do NOT track `--admin-danger`

- `:root` (currently line 174): change `--notif-badge-critical-bg: var(--admin-danger);` →
  `--notif-badge-critical-bg: #c52b28;`
- `[data-theme="dark"]`: add `--notif-badge-critical-bg: #c52b28;` (same literal, deliberately not
  inverted — mirrors the `--admin-nav-surface-*` precedent at `tokens.css:438-443`) — anchor: near the
  dark block's own "Semantic status tones" group, e.g. immediately after `--admin-danger-bg: oklch(28%
  0.060 25);` (currently dark block line 362), or grouped with the other two notif-badge additions below
  for readability.
- `[data-theme="light"]`: add `--notif-badge-critical-bg: #c52b28;` — anchor: immediately after
  `--admin-danger-bg: #fff0ee;` (currently light block line 473).
- `@media print`: add `--notif-badge-critical-bg: #c52b28;` — anchor: immediately after the print
  block's own `--admin-danger-bg: #fff0ee;` (currently print block line 569).
- **Recommend a one-line comment at each new declaration** (or once, above the group) explaining why
  this alias is deliberately NOT tracking its target, e.g.: `/* Deliberately NOT var(--admin-danger) —
  that token lightens in dark mode for text-on-panel use; this badge is a solid fill under a fixed
  white foreground and needs to stay dark/saturated in both themes. See
  redesign/evidence/plan-deepening/phase0/a6-unmeasured-aliases.md. */`

### `--notif-badge-info-bg` — de-alias via **explicit identical literal**, do NOT track `--admin-info`

- `:root` (currently line 178): change `--notif-badge-info-bg: var(--admin-info);` →
  `--notif-badge-info-bg: #0f5e8e;`
- `[data-theme="dark"]`: add `--notif-badge-info-bg: #0f5e8e;` — anchor: immediately after
  `--admin-info-bg: oklch(28% 0.045 245);` (currently dark block line 374).
- `[data-theme="light"]`: add `--notif-badge-info-bg: #0f5e8e;` — anchor: immediately after
  `--admin-info-bg: #eff8ff;` (currently light block line 482).
- `@media print`: add `--notif-badge-info-bg: #0f5e8e;` — anchor: immediately after the print block's
  own `--admin-info-bg: #eff8ff;` (currently print block line 578).
- Same "deliberately not tracking" comment recommendation as above.

### `--admin-shell` — DEFER (recommended path, no edit)

No `tokens.css` change. Record in the Step 0.1 commit message: *"`--admin-shell` (tokens.css:67)
assessed and deferred — confirmed zero live consumers (`grep -rn "var(--admin-shell)" src` and `grep
-rn "(bg|text|border)-admin-shell\b" src` both return no matches outside the token's own declaration
and the unrelated `.admin-shell` structural class in `AdminTopNav.tsx`/`globals.css`); its target
`--admin-sidebar` is independently flagged 'Vestigial — no live UI binding' by `tokens.css:62-63`.
De-aliasing dead code has no verifiable behavioural effect and is deferred as unnecessary speculative
maintenance, per redesign/evidence/plan-deepening/phase0/a6-unmeasured-aliases.md."*

**Alternative, if the orchestrator prefers de-aliasing anyway (not recommended, but zero-risk since
nothing consumes it):**
- `:root` (currently line 67): change `--admin-shell: var(--admin-sidebar);` → `--admin-shell: oklch(94% 0.014 75);`
- `[data-theme="dark"]`: add `--admin-shell: oklch(22% 0.010 75);` — anchor: immediately after
  `--admin-sidebar: oklch(22% 0.010 75);` (currently dark block line 336).
- `[data-theme="light"]`: add `--admin-shell: oklch(94% 0.014 75);` — anchor: immediately after
  `--admin-sidebar: oklch(94% 0.014 75);` (currently light block line 454).
- `@media print`: add `--admin-shell: oklch(94% 0.014 75);` — anchor: immediately after the print
  block's own `--admin-sidebar: oklch(94% 0.014 75);` (currently print block line 550).

### `--admin-nav-active-text` (user-menu-button site)

No separate edit — this is already covered by Step 0.1's existing planned de-alias of
`--admin-nav-active-text` (target `--admin-primary`), which the plan's own table already specifies.
This report only supplies the confirmation that doing so also fixes this second site (1.736:1 →
5.738:1), satisfying the exit criterion.

---

## Also correct in `tokens.css`'s alias-list comment (lines 319-321)

The existing "Aliases (...) are deliberately NOT repeated" comment already names 8 of the 11 (omitting
all three `--notif-badge-*-bg`), and the plan already flags this comment as false and slated for
correction in Step 0.1. Once these six (plus the five already in the plan's own table) are de-aliased,
this comment describes zero remaining tokens and should be removed or rewritten to explain the NEW
pattern instead — two different fixes now coexist:
1. Tokens #1-4 above (and the plan's original 5) track their real per-theme target, exactly as
   Step 0.1's general description says.
2. Tokens #5-6 above (`--notif-badge-critical-bg`, `--notif-badge-info-bg` — and, per
   `root-cause-D1.md` §7, `--notif-badge-warning-bg` too, once D8's corrected light value lands) are
   **explicit, theme-invariant literals**, declared separately in all four blocks but deliberately
   identical, because their real per-theme target is unsafe to use as a solid white-foreground fill.

The corrected comment should say this explicitly, not just "these were aliases, now they're not" —
otherwise a future reader will "simplify" the three notif-badge tokens back into aliases of
`--admin-danger`/`--admin-warning`/`--admin-info`, silently reintroducing the exact regression measured
above.

---

## What could not be determined

- No live/browser verification was possible (forbidden by this task's rules — Playwright sweep needs
  credentials). All contrast figures are computed from the literal token values in the current
  `tokens.css` plus the OKLCH→sRGB conversion; they are not a substitute for the Layer 3 live sweep the
  plan's own Step 0.1 verification section calls for, but they were independently cross-checked against
  three already-published, independently-derived numbers (D8's two ratios and D7's post-fix estimate)
  and matched exactly, which is the strongest verification available without a browser.
- The cormorant numeral's pre-existing 2.275:1 light-mode shortfall (§4 above) was not further
  investigated — it is unaffected by this alias fix either way, and pursuing it would mean editing an
  `oklch`/hex literal, out of Phase 0's scope by the plan's own rule.
- Whether `AdminCommandSearch`'s "Search…" trigger text at `--admin-nav-text-muted` is itself intended
  to meet 4.5:1 (normal text) rather than being treated as UI-chrome (3:1) was not adjudicated here —
  the recommendation (de-alias) clears both bars in dark mode (7.145:1) regardless, so the distinction
  doesn't change the outcome, only how severe the pre-fix defect is classified.
