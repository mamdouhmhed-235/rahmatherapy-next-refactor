# Item 7 Workstream 1 (Phase 0 / theme resolution) — deepening audit

Scope: plan lines 440-786 (§7.1–§7.5b) only. Substitution work (Workstream 2 / Phases A-B) explicitly
excluded per assignment — another agent has it. Read-only throughout; no files under `src/`, `scripts/`,
`e2e/`, `supabase/` were modified. Both verification scripts were read in full before running (neither
calls `writeFileSync`/`fs.write*` — confirmed by reading every line of both files) and both print to
stdout only.

Repo state at review time: `git log -1` = `0ec700c`, branch `master`. `git status` shows only the
pre-existing, documented dirty state (`.playwright-mcp/*` deletions, `src/lib/maintenance.ts` working-copy
diff) — untouched by this review.

---

## Headline

1. **The 677/99-files headline is exactly right** (confirmed with real `grep -o`, not the plan's own
   author's tooling) — but it is silently an **admin-only** figure; the true combined admin+ui occurrence
   count is **717**, matching `surgical-review.md`'s own independent re-count almost to the digit. Not a
   defect, just worth stating explicitly in the deepened plan so nobody double-subtracts.
2. **A real, previously undiscovered bug in Layer 2's own tooling** (`scripts/verify-admin-token-contrast.mjs`):
   the literal substring `"@media print"` appears **twice** in `tokens.css` — once in a prose comment at
   line 317, once in the real rule at line 543 — and the script's `css.indexOf("@media print")` finds the
   *comment*, not the rule. `extractBraceBlock` then walks forward from that wrong position and captures
   the **`[data-theme="dark"]` block's body**, mislabelled as "print". This inflates the reported
   "14 self-declared ratio comments, all match" to a number that is real-but-wrong (true count is **11**,
   not 14 — see §3) and, more importantly, means **the print block's own token values have never actually
   been checked by Layer 2, ever** — including its verbatim copy of the failing `--admin-warning` /
   `--admin-warning-bg` pair. This is a genuine gap in a tool the handoff says not to rebuild; it needs a
   one-line fix (search from the end, or require a following `{`) and Phase 0 must not rely on "Layer 2 → 0
   failures" as proof the print block was fixed.
3. **`--admin-shell` is the 11th `:root`-only alias and it is absent from the plan's own Step 0.1 table.**
   The plan's table (lines 722-729) enumerates 10 distinct property names (counting the "user-menu variant"
   annotation as a restatement, not a 11th name) and never mentions `--admin-shell`. It is real (declared
   only in `:root`, never redeclared in either theme block), it is named in `tokens.css`'s own "8" comment,
   and — per `root-cause-D1.md`'s independent enumeration, which I reproduced — it has **zero live
   consumers** (only coincidentally shares a name with the unrelated `.admin-shell` structural CSS class).
   Low severity (nothing renders wrong), but "must be assessed" in the plan's own words, and its table
   currently makes that impossible to do mechanically.
4. **The layer-inversion's public-site reach is not zero.** I measured it (the plan flags this as
   "unmeasured" and it still was, until now): **≈224 raw `<a>`/`<Link>` + Tailwind-text-utility matches**
   across the codebase, with admin (161) dominating but the public site, booking, and shared components
   contributing a non-trivial **63** (2 in `(public)/`, 1 in `booking/**` — both on `/booking/manage`,
   confirmed live — and 60 in `src/components/**`, which is what actually renders on public routes).
   `/booking/manage` itself has two live `<Link>` elements carrying `text-[var(--rahma-charcoal)]` and
   `text-white` respectively (`src/app/booking/manage/page.tsx:196,335`) — both structurally defeated by
   the same bug today, both directly in scope for Step 0.3's before/after evidence.
5. **Git history answers "why was it imported unlayered" more precisely than the plan's hedge allows.**
   Both the `a { color: inherit }` rule (`site-parity.css:39-42`) **and** the `@layer theme, base,
   components, utilities;` declaration itself (`globals.css:1`) date to the *same* first commit
   (`11067ed`, "Initial refactor website commit"). There is no commit message, code comment, or later
   change that discusses the interaction between the two. This reads as an artefact of how the Webflow
   parity CSS was wired up at the very start of the Next.js port (Cascade Layers were already
   Tailwind v4's own boilerplate; `site-parity.css` was just never made layer-aware) — not a considered,
   documented decision to make it beat Tailwind utilities. That is weaker evidence than "proven
   accidental" (git history cannot prove absence of intent), but it materially changes precondition 1 from
   "investigate" to "investigated, found no evidence of deliberateness."

---

## 1. `src/styles/tokens.css` — token census, alias enumeration, consumers

### 1.1 Token count and blocks

```
grep -oE '^\s*--admin-[a-z0-9-]+:' src/styles/tokens.css | sort -u | wc -l   → not run this exact form;
```
Verified instead via the Layer 2 script's own parse (`tokens parsed: 92`) and by direct reading of the
four blocks:

| Block | Lines | Confirmed |
|---|---|---|
| `:root` | 1-260 | opens file, closes before dark block |
| `[data-theme="dark"], [data-admin-theme-root][data-theme="dark"] ~ *` | 331-447 | |
| `[data-theme="light"], [data-admin-theme-root][data-theme="light"] ~ *` | 451-533 | |
| `@media print { :root, [data-theme="dark"], [data-theme="light"], … }` | 543-634 | |

**92 tokens** confirmed (Layer 2's own `tokensParsed: 92`, `lightResolved: 92`, `darkResolved: 92` — exact
match to the plan's "92 `--admin-*` tokens").

### 1.2 The complete list of `:root`-only, `var(--…)`-valued alias tokens

Read every declaration in the `:root` block (1-260) whose *value* is a bare `var(--other-token)`
reference (no arithmetic, no fallback needed to make it an alias), then confirmed each name does **not**
reappear in the dark (331-447), light (451-533), or print (543-634) blocks — i.e. structurally identical
to the D1 mechanism (an alias substituted once, at `:root`, before `data-theme` exists anywhere in the
document, per `ThemeProvider.tsx:105`).

| # | Token | `:root` line | Value | Redeclared in dark/light/print? |
|---|---|---|---|---|
| 1 | `--admin-shell` | 67 | `var(--admin-sidebar)` | No |
| 2 | `--admin-surface` | 70 | `var(--admin-panel)` | No |
| 3 | `--admin-surface-muted` | 71 | `var(--admin-panel-muted)` | No |
| 4 | `--admin-text` | 75 | `var(--admin-heading)` | No |
| 5 | `--admin-nav-text` | 129 | `var(--admin-body)` | No |
| 6 | `--admin-nav-text-muted` | 130 | `var(--admin-text-muted)` | No |
| 7 | `--admin-nav-active-text` | 132 | `var(--admin-primary)` | No |
| 8 | `--admin-cormorant-color` | 136 | `var(--admin-accent)` | No |
| 9 | `--notif-badge-critical-bg` | 174 | `var(--admin-danger)` | No |
| 10 | `--notif-badge-warning-bg` | 176 | `var(--admin-warning)` | No |
| 11 | `--notif-badge-info-bg` | 178 | `var(--admin-info)` | No |

**Exactly 11 — the plan's headline number is confirmed.** `tokens.css`'s own comment (lines 319-321)
names only 8 of these (all but the three `--notif-badge-*-bg`), which the plan also states correctly.

This list is byte-for-byte identical to `redesign/evidence/admin-contrast/root-cause-D1.md`'s own §5
enumeration (already in the repo) — I re-derived it independently from the source file and it matches
their independently-derived table exactly. That file also already discloses **`--admin-shell` is dead
code** (its only apparent consumer is a same-named-but-unrelated CSS class), which the plan's Step 0.1
table (lines 722-729) somehow drops entirely — see §5 below.

### 1.3 Every consumer, per token (`grep -rn "var(--TOKEN)"`, plus a check for the Tailwind
`@theme inline` utility-class path for the four tokens that also get a `--color-admin-*` alias)

| Token | Consumers (file:line) | Live? |
|---|---|---|
| `--admin-shell` | **none** found via `var(--admin-shell)`. The `@theme inline` block (tokens.css:714) does generate a `--color-admin-shell` Tailwind colour slot, but no `bg-admin-shell`/`text-admin-shell`/etc. class appears anywhere in `src/` (only the *unrelated* structural class `.admin-shell` on `AdminTopNav.tsx:204`, which is CSS defined in `globals.css:23-38` and uses `--admin-shell-ambient`, a different token, for its `::before` gradient). | **Dead.** |
| `--admin-surface` | `src/app/admin/clients/page.tsx:644` (`bg-[var(--admin-surface)]`) | 1 site |
| `--admin-surface-muted` | `src/app/admin/dashboard/attention-group-client.tsx:249` (`bg-[var(--admin-surface-muted)]`) | 1 site |
| `--admin-text` | `ClientLtvRibbon.tsx:112,121,127,134`, `components/tiles/MetricRow.tsx:34`, `components/tiles/TrendTile.tsx:42`, `dashboard/PersonalContributionStripe.tsx:90` (**this is D9**) | 7 sites, 4 files |
| `--admin-nav-text` | `AdminTopNav.tsx:282,296,317,499,938`, `ThemeToggle.tsx:32` | 6 sites, 2 files |
| `--admin-nav-text-muted` | `AdminTopNav.tsx:232 (CSS-in-JS !important),250,300,317,938`, `ThemeToggle.tsx:25,39` | 7 sites, 2 files |
| `--admin-nav-active-text` | `AdminTopNav.tsx:295,300,498` (line 498 = the user-menu-button variant `root-cause-D1.md` §4 flags as "consumed, unverified") | 3 sites, 1 file |
| `--admin-cormorant-color` | `admin-ui.tsx:241` | 1 site (decorative Cormorant numerals only, per its own "Exception rule" comment) |
| `--notif-badge-critical-bg` | `notification-bell.tsx:65` | 1 site |
| `--notif-badge-warning-bg` | `notification-bell.tsx:67` (**this is D7**) | 1 site |
| `--notif-badge-info-bg` | `notification-bell.tsx:69` | 1 site |

`--admin-shell` is the **only one of the 11 with zero consumption** — everything else is genuinely live.
This matches `root-cause-D1.md`'s own finding precisely, which additionally records that
`--notif-badge-critical-bg`/`-info-bg` are frozen but currently still clear AA on white (danger ≈5.6:1,
info ≈6.97:1 by their computation) — i.e. **broken by mechanism, not (yet) by measured contrast** — so
Phase 0's "must be assessed" instruction is correct to require they be de-aliased anyway (for correctness,
not to fix a currently-visible failure), and the plan's own text already says this ("a token that happens
to be consumed only on a light surface may be correct today and still worth de-aliasing for consistency").

---

## 2. `ThemeProvider.tsx`, `layout.tsx` — where `data-theme` actually lives

- **`src/app/admin/components/ThemeProvider.tsx:105`**: `<div data-admin-theme-root="" data-theme={effectiveTheme}>` —
  confirmed verbatim, matches the plan's `ThemeProvider.tsx:105` citation exactly (no drift).
- **`src/app/layout.tsx`** (root layout, applies to *every* route including admin): `<html lang="en"
  className={...font vars...}>` — **no `data-theme` attribute anywhere on `<html>` or `<body>`.** Confirmed
  by reading the full file (74 lines) — `<html>` carries only font-variable classes, `<body>` carries only
  `<SentryProvider />` + `{children}`. `:root` (which resolves to `<html>`) therefore **never** carries
  `data-theme`, exactly as the plan states.
- **Other layouts checked for a second `data-theme` writer** (the task explicitly asks this): searched all
  of `src/app/**/layout.tsx` for `data-theme`. Only `ThemeProvider.tsx` (rendered from
  `src/app/admin/layout.tsx`) sets it — confirmed no `data-theme` attribute is set by the public
  `(public)/layout.tsx`, `booking/layout.tsx` (if any), or anywhere else. `/booking/manage` therefore has
  **no `[data-admin-theme-root]` ancestor at all** in its tree — `--admin-*` tokens resolve there purely
  off `:root`'s light values, unconditionally (already independently confirmed by `surgical-review.md`
  §1.3, and re-confirmed here by the same grep).

---

## 3. The cascade-layer inversion — full read of the pieces the plan names, plus what it doesn't

### 3.1 `globals.css` layer setup (`src/app/globals.css:1-8`)

```
@layer theme, base, components, utilities;

@import "tailwindcss/theme.css" layer(theme);
@import "../styles/tokens.css";
@import "tw-animate-css";
@import "tailwindcss/utilities.css" layer(utilities) source(none);
```

**Undisclosed-by-the-plan fact worth stating explicitly: `tokens.css` itself is *also* imported
unlayered** (line 4, no `layer(...)` wrapper), exactly like `site-parity.css`. This is *not* currently a
bug (custom-property declarations don't have the "loses to a layered rule" problem the way `a { color:
inherit }` does — nothing in `theme`/`utilities` redeclares the same custom properties at the same
specificity in a way that would invert), but it does mean the plan's framing ("only `site-parity.css` is
the odd one out") slightly understates the pattern: **two of the four things imported into `globals.css`
before the layer system is populated are unlayered**, and that is consistent with my git-history finding
in §4 below — this looks like "nobody made the parity/tokens files layer-aware when Tailwind v4's layer
boilerplate was adopted," not an isolated one-off choice about `site-parity.css` specifically.

### 3.2 `site-parity.css` — read in full (2887 lines), every rule enumerated for `a`

The task asks for every rule in the file, not just the `a` block, because an unlayered stylesheet beats
*every* layered rule for *everything it declares*, not only the one flagged line. I read the file in full
(two passes, offset 0 and offset 2192). Result: **the file contains exactly one rule that sets `color` on
a bare element selector with no class/attribute qualifier: the `a { color: inherit; text-decoration: none;
}` at lines 39-42.** No other rule in the file targets `a`, `button`, or any bare type selector for colour.

Every other colour-bearing rule in the file is qualified by a **class selector** (specificity 0-1-0 or
higher — `.navbar31_link`, `.footer_link`, `.button`, `.result_tab-link`, `.service_card_action`, etc.,
~30 classes total that set `color` somewhere in the file). Class selectors are **not** affected by the
layer-vs-layer inversion in the same catastrophic way: they still lose to a layered utility only if that
utility ALSO reaches specificity ≥ class (never — Tailwind utilities are single-class, 0-1-0, and CSS
Cascade Layers only override specificity *across* layers, not within the unlayered stratum) — but more to
the point, **none of these classed rules currently compete with a Tailwind `text-*` utility on the same
element** in the code I found (no JSX applies both `.navbar31_link` and a `text-[...]` utility to the same
tag). So the practical, currently-manifesting blast radius really is narrow: **the bare `a { color:
inherit }` reset is the only rule in the file that silently defeats an *unrelated future* utility class
applied directly to an `<a>`/`<Link>`** — but the file's structure means the risk is not zero for the other
~30 classed rules either, only currently dormant (any future JSX that pairs one of those classes with a
conflicting Tailwind utility on the same tag would have the classed rule win unconditionally, same
mechanism, just currently nobody has tried it). Worth one sentence in the deepened plan so Step 0.3 isn't
scoped as "just the one line" when picking an option.

Full list of every class in the file that sets `color` (for completeness, since the task asked for
completeness, not just the `a` rule): `.button.is-alternate`, `.button.is-secondary`, `.button.is-
secondary.is-alternate`, `.text-color-white`, `.text-color-accent`, `.navbar31_desktop-link` (+`:hover`/`.is-
active`), `.navbar31_component[data-transparent] .navbar31_desktop-link`, `.menu-icon4_line-*`
(background-color, not color), `.navbar31_link` (+`:hover`/`.w--current`), `.navbar31_menu-bottom`,
`.navbar31_menu-bottom a` (+`:hover`), `.navbar31_social-link:hover`, `.faq_question`, `._2col_testimonial_rating-
wrapper`, `.testimonial5_rating-wrapper`, `.testimonial6_rating-wrapper`, `.result_tab-link.w--current`,
`.large_testimonial_rating-icon`, `.footer_heading`, `.footer_logo-link`, `.footer_link` (+`:hover`),
`.footer_legal-link` (+`:hover`), `.footer_credit-text`, `.outcome_item-icon-wrapper`,
`.section_visit-expectations`, `.service-card-price`, `.pricing18_icon-wrapper`, `.pricing18_plan`,
`.pricing_plan_card`-family via `color-mix`, `.journey_item-number-wrapper`.

### 3.3 Reach measurement — every `<a>`/`<Link>` carrying a Tailwind text-colour utility

Method (disclosed): `Grep` with `multiline:true`, pattern `<a\s[^>]*?text-[a-zA-Z-]` and
`<Link\s[^>]*?text-[a-zA-Z-]`, per directory. `[^>]*` already spans newlines for a negated character
class regardless of the multiline flag, so multi-line JSX tags (className on its own line) are captured.
**Known undercounts** (disclosed per the task's own instruction to name limitations): a class string built
via `cn()`/template literals with a *variable* fragment won't match (only literal `text-` substrings do);
non-greedy stops at the first `>` inside the tag can truncate early if the tag contains a nested arrow
function or TS generic before its own close. These make the counts a **floor**, not a ceiling.

| Area | `<a>` matches | `<Link>` matches | Files |
|---|---|---|---|
| `src/app/admin/**` | 13 | 148 | 11 + 56 |
| `src/app/(public)/**` | 2 | 0 | 2 |
| `src/app/booking/**` | 0 | 1 | 1 (`booking/manage/page.tsx`) |
| `src/features/**` | 0 | 0 | 0 |
| `src/components/**` (renders into `(public)/**` routes) | 6 | 54 | 4 + 35 |

**Admin total ≈ 161. Public-reaching total (public app dir + booking + components) ≈ 63. Grand total ≈
224.** This directly falsifies any assumption that the layer bug is "admin-only in practice" — it is not
admin-only in *definition* (the plan already says this) and it is demonstrably not admin-only in
*occurrence count* either: 63 non-admin matches is not a rounding error.

**Two concrete, verified-live public/customer hits, both on `/booking/manage`** (the task's named "known
trap" route):
```
src/app/booking/manage/page.tsx:194-197   <Link href="/cookies/" className="... text-[var(--rahma-charcoal)] ...">
src/app/booking/manage/page.tsx:333-336   <Link href="/" className="... bg-[var(--rahma-green)] ... text-white">
```
Both are real `<a>` elements at runtime (`next/link` always renders `<a>`), both carry a Tailwind
text-colour utility directly on the tag, both are structurally defeated by the unlayered `a { color:
inherit }` rule **today**. These are exact, named, high-confidence examples for Step 0.3's required
before/after evidence — not a hypothetical.

`src/components/layout/SiteHeader.tsx` (the public nav, present on every `(public)` page) has 3 `<Link>`
matches with `text-` on the same line — worth a specific look before/after, as the highest-traffic public
analogue to the admin nav bug (checked; `SiteHeader.tsx`'s nav links use `.navbar31_desktop-link` (a
classed rule from site-parity.css itself, not a raw Tailwind utility) for their primary colour, so they
are not currently broken by this bug the way the admin nav is — but the 3 `text-` matches are on other
elements in the same file and should be part of the before/after diff regardless).

### 3.4 Why was `site-parity.css` imported unlayered — git evidence

```
git log --follow --oneline -- src/styles/site-parity.css   → oldest commit: 11067ed "Initial refactor website commit"
git blame -L 39,42 -- src/styles/site-parity.css            → all 4 lines: 11067ed, 2026-04-26
git blame -L 1,6 -- src/app/globals.css                     → all 6 lines (incl. the @layer decl AND the
                                                                 tokens.css/site-parity.css import lines): 11067ed
git log -1 --format=%B 11067ed                               → "Initial refactor website commit" (no body)
```

**The `a { color: inherit }` rule and the `@layer theme, base, components, utilities;` declaration that it
now conflicts with were both authored in the same commit, on the same day.** There is no later commit, no
code comment, and no design-handoff note anywhere in the repo that discusses the interaction between
Cascade Layers and `site-parity.css`'s import. `site-parity.css`'s own header comment ("Legacy Webflow
parity layer. Keep existing visual contracts here...") and its filename both point at a Webflow-export
migration purpose, and the `@layer theme/utilities` wrapper lines are exactly Tailwind v4's own standard
boilerplate (`@import "tailwindcss/theme.css" layer(theme);` / `layer(utilities) source(none)` is the
documented Tailwind v4 setup, not a bespoke choice). **Conclusion for the deepened plan: there is no
evidence this was a considered decision about layer interaction — it reads as an artefact of the parity
file never being made layer-aware when the Tailwind v4 layer scaffold was set up, in the very first
commit.** This is not proof of "accidental" (git history cannot prove absence of intent), but it
substantially weakens the "it may have been deliberate" hedge in plan line 755 — precondition 1 can be
marked **investigated, no evidence of deliberateness found**, not left as an open question.

---

## 4. `--admin-warning` / `--admin-warning-bg` (D8) — ratio math, full consumer list, print-block gap

### 4.1 Ratio verification (independent hand computation, WCAG 2.1 relative-luminance formula)

- `#b77900` on `#fff7df` (current, light): **3.414:1** — matches plan's stated 3.41:1.
- `#986400` on `#fff7df` (proposed): **4.714:1** — matches plan's stated 4.72:1.

Both independently recomputed by hand (not just re-running the script) and cross-checked against the
script's own output (`3.4134:1` per `surgical-review.md`, reproduced live in this session as `3.41:1`
via `verify-admin-token-contrast.mjs`). **CONFIRMED.**

### 4.2 Every consumer of `--admin-warning` and `--admin-warning-bg`

`grep -rn "var(--admin-warning)"` / `"var(--admin-warning-bg)"` across `src/`, excluding `tokens.css`
itself:

- **Text-on-tint pairs** (darkening only improves): `dashboard-cards.tsx:720,892,1109,1614,1651`,
  `dashboard-filters-client.tsx:575`, `WorkingHoursDayEditor.tsx:221-222`.
- **Solid-fill-under-`--admin-on-primary`** (darkening only improves, since on-primary in light theme is
  near-white): `dashboard-cards.tsx:1603`, `dashboard-filters-client.tsx:417,581`.
- **Purely decorative** (progress fill, chart stroke, coloured dot — no contrast implication):
  `dashboard-cards.tsx:1441,1450`, `ReportsCharts.tsx:101`, `admin-ui.tsx:92`, `notification-card.tsx:177,189`,
  `notification-bell.tsx:739`, `TherapistDashboard.tsx:627` (border colour, not text).
- **Alias consumer**: `--notif-badge-warning-bg` (D7) resolves through `--admin-warning` too — darkening it
  improves D7's frozen 3.65:1 badge incidentally (from ≈3.65:1 to ≈5.05:1 by the same math), though this
  does not fix D7's actual defect (the freeze itself — see `root-cause-D1.md` §7, already correctly
  flagged there as "masks the symptom, doesn't fix the freeze").

**No consumer found where darkening `--admin-warning` (light only) would reduce contrast.** This matches
the plan's and `root-cause-D1.md`'s own conclusion. Independently confirmed here, not just re-cited.

### 4.3 ⚠️ Gap the plan does not mention: the `@media print` block carries its own verbatim copy of the
failing pair, and Step 0.2 as written does not update it

```
tokens.css:566   --admin-warning: #b77900;
tokens.css:567   --admin-warning-bg: #fff7df;
```
Byte-identical to the light block's values (as intended — the print block's whole design, per its own
comment at line 535, is "print always renders the light palette"). **These will still measure 3.41:1
after Step 0.2 if only the `[data-theme="light"]` block is edited**, because they are separately-declared
literals in a separately-matched selector list, not inherited from the light block. **The plan's Step 0.2
must explicitly say: update both the `[data-theme="light"]` block (lines 470-471) AND the `@media print`
block (lines 566-567).** This is not caught by Layer 2 today — see §5.

---

## 5. ⚠️ Layer 2 tooling bug — the "14 ratio comments, all match" figure is not reliable for the print block

### 5.1 The bug, proven

```
grep -n "@media print" src/styles/tokens.css
  317: * these blocks MUST stay after :root, and @media print MUST stay last.
  543: @media print {
```

`scripts/verify-admin-token-contrast.mjs`'s `parseTokensCss()` locates the print block via
`css.indexOf("@media print")` (line 197: `extractBraceBlock(css, css.indexOf("@media print"), "@media print")`).
Because the literal substring `"@media print"` appears **inside a prose comment at line 317**, before the
real rule at line 543, `indexOf` returns the comment's position. `extractBraceBlock` then finds the
**next** `{` after that position — which is the `[data-theme="dark"]` selector's opening brace (line 332)
— and returns everything up to its matching `}` (line 447). **The script's "print body" is actually the
dark block's body, mislabelled.**

Verified directly by re-implementing `extractBraceBlock` in an isolated Node script and printing the
returned text: it opens with `/* Surfaces — warm near-black, hue held at :root's 88/75 ... */
--admin-canvas: oklch(17% 0.008 88); ...` (the dark block's actual first declarations) and closes with the
dark block's `.84 mint`/`.72 mint` comment about `--admin-nav-surface-link` — unambiguously the dark
block's content, not print's.

### 5.2 Consequences

- **`ratioComments` for "print" are actually the dark block's 5 ratio comments, relabelled.** True count
  of *distinct* ratio comments physically present in the file is **11** (root 2 + dark 5 + light 2 + print
  2 — I independently re-verified the print block genuinely has exactly 2, at lines 573-574, via `sed` +
  `grep`), not 14. The script reports "14 found, all match" because it double-counts the dark block's 5
  comments under a second, false "print" label (11 − 2 [print's real 2, never reached] + 5 [dark's,
  mislabelled] = 14).
- **The print block's real declarations (including its copy of `--admin-warning`/`-bg`) have never been
  checked by Layer 2's ratio-comment pass, and are not checked by its 1c derived-pairs pass either**
  (`checkPairs` only iterates `["dark", darkScope]` and `["light", lightScope]` — "print" is never one of
  the two themes checked there). **Layer 2 cannot currently prove anything about the print block at all.**
- Practical effect on Phase 0: "Layer 2 must still report its single known failure (D8) and no new one"
  (plan line 735) is a necessary but **not sufficient** check for D8's fix — Layer 2 will report the
  correct pass/fail for `[data-theme="light"]` but will silently say nothing about whether `@media print`'s
  copy (§4.3) was also fixed. An implementer relying on "Layer 2 → 0" as proof of completion will ship an
  incomplete D8 fix without any tool catching it.

### 5.3 Recommended fix for the plan to specify (do not implement — this is a Phase 0 planning note, and
the task rules forbid editing `scripts/`)

One-line fix in `verify-admin-token-contrast.mjs`: search for the print block from a position *after* the
`:root`/dark/light blocks close (e.g. `css.indexOf("@media print {")` — requiring the literal `{` closes
the false match at line 317, since that comment has no following `{` on the same substring), or simply
search from `lightStart` forward the same way `measure-admin-contrast.mjs`'s own `parseTokensCss` already
does correctly (that script's `printStart = css.indexOf("@media print")` has the *same* latent bug, but it
is never actually used to bound anything load-bearing there — `measure-admin-contrast.mjs` only uses
`printStart` to bound the light-harvest's *end*, and since `printStart` in that script would also
incorrectly resolve to line 317, its light-harvest silently absorbs a fair amount of dark-block text too;
worth flagging to whoever owns Layer 1, but it does not change Layer 1's already-verified 456-failure
figure since dark values simply get "assumed-light" treatment when parsed as extra `light` entries in a
dict that only keeps the *first* value per key per theme — Layer 1's `parseTokensCss` `harvest()` uses
`if (!(theme in tokens[m[1]])) tokens[m[1]][theme] = ...`, i.e. first-write-wins, and the real light block
is harvested *before* the mis-bounded "light continues into dark" slice, so it is not overwritten. Not a
live bug in Layer 1's output — only in Layer 2's, where the ordering of operations differs).

Recommend adding a regression test asserting `parseTokensCss(css).scopes.print["--admin-warning"]` differs
appropriately, or at minimum asserting `ratioComments.filter(r => r.block === "print").length === 2`
against the real file, so a future edit doesn't reintroduce this silently.

---

## 6. `--admin-shell` gap in the plan's Step 0.1 table

Already covered in §1.2-1.3: `--admin-shell` is one of the true 11 aliases, is named in `tokens.css`'s own
"8" comment, and root-cause-D1.md already documents it as dead code. The plan's Step 0.1 table (lines
722-729) lists 10 named slots and omits it entirely — not even as a "known dead, skip" row. Recommend
adding it explicitly: **`--admin-shell` — ✅ assessed, zero consumers found, de-alias anyway for
consistency with the "eliminate, prove, prevent" principle, or explicitly defer with the stated reason
("dead code, no visible defect") — either is acceptable, but the table must not silently drop one of the
11 it claims to enumerate.**

---

## 7. `--admin-warning-bg-strong` / the strong-severity family — not part of D8, confirmed clean

Spot-checked (not exhaustively, out of Phase 0's named scope but worth one line): `--admin-warning-bg-
strong` and `--admin-warning-text-strong` are a **separate, already-passing pair** (10.71:1 dark, matching
their own inline comment, verified by Layer 2's "match" line for both). D8's fix does not touch these —
confirmed no shared consumer where changing `--admin-warning` alone would also silently need
`-bg-strong`/`-text-strong` touched (they are declared independently in all four blocks, not aliased to
`--admin-warning`).

---

## 8. Live verification-script readings (recorded, this session)

Both scripts confirmed read-only before running (full read of both files; neither imports `fs.writeFile*`
or similar; both explicitly state "Analysis only" / "never edits tokens.css" in their own header
comments).

```
$ node scripts/measure-admin-contrast.mjs .
files scanned: 309
tokens resolved: 92
unresolved elements (class string could not be resolved statically): 239
FAILURES (<4.5:1)  total 456   explicit-pair 76   assumed-surface 380
  dark 377 / light 79
```
**Exact match to the plan's baseline** (456 / 377 dark / 79 light / 76 explicit-pair / 380 assumed-surface
/ 239 unresolved). No drift since the plan was written.

```
$ node scripts/verify-admin-token-contrast.mjs
tokens parsed: 92  (light resolved: 92, dark resolved: 92)
--- 1b. self-declared ratio comments (14 found) ---
  ... all 14 "match" ...
--- 1c. derived semantic pairs (83 unique pairs x 2 themes = 166 checks) ---
  FAILURES (1 below AA threshold):
     3.41:1 < 4.5:1  [light]  --admin-warning  vs  --admin-warning-bg
```
**Matches the plan's stated reading exactly on its face** (92 tokens, 14 ratio comments reported, 83
pairs, 166 checks, 1 failure) — but per §5 above, the "14" and "all match" figures are inflated/unreliable
for the reason proven there. The single reported failure (D8) is correctly identified and its ratio is
correct; that part of the tool's output is trustworthy.

---

## 9. `redesign/evidence/admin-contrast/root-cause-D1.md` and `summary.md` — cross-checked against the plan

- `root-cause-D1.md`'s two-cause analysis (alias-freeze + layer-inversion) matches the plan's §7.4b/§7.5b
  narrative exactly, including exact quotes of `ThemeProvider.tsx:105`, `tokens.css:129/132`,
  `globals.css:1/6`, `site-parity.css:39-42`, `layout.tsx:4`. No drift found between this evidence file and
  the plan text that cites it.
- Its own "What could not be determined" section already flags, in its own words: (a) the layer bug's
  full site-wide reach was not enumerated ("this session did not attempt to enumerate every affected
  `<a>` site-wide") — **this review now supplies that measurement, §3.3 above**; (b) it did not investigate
  why `site-parity.css` was unlayered — **this review now supplies that, §3.4 above**; (c) six of the
  eleven aliases were "consumed but not independently measured" — this review's §1.3 supplies the
  consumer list but, consistent with the evidence file's own honesty, does **not** claim to have measured
  live rendered contrast for those six (that requires the browser/role sweep, out of this static review's
  reach, same limitation the evidence file already discloses).
- `summary.md` is the Layer 3 per-role/theme table (2,615 total across all roles/themes) — cross-checked
  against the plan's §7.2b table, matches exactly (OWNER 595/467, ADMIN 577/441, COORDINATOR 202/216,
  THERAPIST_A 59/56, UNAUTHENTICATED 2/0). Not re-run this session (requires the Playwright/credentials
  harness, out of a static-analysis review's scope, consistent with `surgical-review.md`'s own decision not
  to re-run it).

---

## 10. `redesign/evidence/admin-contrast/surgical-review.md` — relevant overlap with Phase 0

That review is mostly Workstream 2 (substitution) territory, out of this assignment's scope, but three of
its findings bear directly on Phase 0 and are worth carrying forward:

- Its §Executive-summary point 3 (99 files / 677 vs 717) is the same discrepancy this review resolved
  precisely in §0/headline above — that review used `grep -c` (line count) and got 717 for admin+ui
  combined; this review used `grep -o` (occurrence count) and got the same 717 for admin+ui combined, and
  isolated that the plan's headline "677" is the admin-only subset, exactly. Both reviews independently
  landed on 717 as the combined total — strong corroboration.
- Its §5 "Explicit non-goals and stop conditions" already states, correctly and in almost the same words
  this review would use: **"if an implementer reaches D1 during the sweep and is tempted to fix the nav
  highlight... they must stop and report, not touch `AdminTopNav.tsx`'s nav-active classes"** — Phase 0's
  own text (line 708: "if you find yourself editing an `oklch(` value in Phase 0, stop") is the mirror
  image of this rule and the two should be cross-referenced in the deepened plan so an implementer reading
  either workstream's section sees the boundary stated from both sides.
- It confirms (its own §3, re-run independently) the exact same Layer 1/Layer 2 baselines this review
  reproduced — three independent re-runs (surgical-review.md's, this review's) now agree byte-for-byte on
  Layer 1; Layer 2's headline numbers also agree, but per §5 above, agreement on a wrong number is not the
  same as the number being right — nobody who re-ran the script noticed the print-block bug because the
  script's own summary output never surfaces per-block detail loudly enough to catch it without manually
  inspecting `ratioResults` (which this review did, and the prior one did not).

---

## 11. Per-token de-alias table (deliverable requested by the task)

Sourced from the real, currently-declared theme-block values of the tokens each alias points at (i.e.
"what value would this alias resolve to today, in each theme, if it behaved correctly" — this is the
starting point for Step 0.1's de-alias work, not a prescription that these exact values are the *final*
correct design; that judgement belongs to whoever executes Step 0.1, per the plan's own "measure each
first" instruction for the 5 unmeasured ones).

| Token | Target (today) | `:root` / light value | `[data-theme="dark"]` value | `[data-theme="light"]` value | `@media print` value |
|---|---|---|---|---|---|
| `--admin-shell` | `--admin-sidebar` | `oklch(94% 0.014 75)` | `oklch(22% 0.010 75)` | `oklch(94% 0.014 75)` | `oklch(94% 0.014 75)` |
| `--admin-surface` | `--admin-panel` | `#fffefa` | `oklch(22% 0.008 88)` | `#fffefa` | `#fffefa` |
| `--admin-surface-muted` | `--admin-panel-muted` | `#faf6ef` | `oklch(26% 0.008 88)` | `#faf6ef` | `#faf6ef` |
| `--admin-text` | `--admin-heading` | `#151b18` | `oklch(96% 0.010 88)` | `#151b18` | `#151b18` |
| `--admin-nav-text` | `--admin-body` | `#313731` | `oklch(90% 0.010 88)` | `#313731` | `#313731` |
| `--admin-nav-text-muted` | `--admin-text-muted` | `#5e625e` | `oklch(74% 0.010 88)` | `#5e625e` | `#5e625e` |
| `--admin-nav-active-text` | `--admin-primary` | `#0f5e8e` | `oklch(76% 0.098 240)` | `#0f5e8e` | `#0f5e8e` |
| `--admin-cormorant-color` | `--admin-accent` | `#f7931e` | `oklch(78% 0.145 62)` | `#f7931e` | `#f7931e` |
| `--notif-badge-critical-bg` | `--admin-danger` | `#c52b28` | `oklch(76% 0.130 25)` | `#c52b28` | `#c52b28` |
| `--notif-badge-warning-bg` | `--admin-warning` (⚠️ pending D8) | `#b77900` → **`#986400`** if D8 lands first | `oklch(84% 0.135 82)` | same as `:root` col | same as `:root` col |
| `--notif-badge-info-bg` | `--admin-info` | `#0f5e8e` | `oklch(79% 0.088 240)` | `#0f5e8e` | `#0f5e8e` |

**Sequencing note for the implementer:** if Step 0.1 (de-alias) and Step 0.2 (D8 value change) both touch
`--notif-badge-warning-bg`'s effective light value, do Step 0.2 first (per the plan's own stated order) so
Step 0.1's de-aliased light value for `--notif-badge-warning-bg` is written as the corrected `#986400`,
not the soon-to-be-stale `#b77900` — otherwise Step 0.1's commit bakes in a value Step 0.2 immediately
invalidates, creating unnecessary re-review.

---

## 12. Blast radius summary

**Files to edit (Phase 0 only):**
- `src/styles/tokens.css` — Step 0.1 (11 aliases → real per-theme values, in `:root`/dark/light/print as
  applicable per §11), Step 0.2 (`--admin-warning` in **both** `[data-theme="light"]` lines 470-471 **and**
  `@media print` lines 566-567 — §4.3), and the false "track the theme automatically" comment (lines
  319-325).
- `src/styles/site-parity.css` and/or `src/app/layout.tsx` — Step 0.3 (narrow the `a` rule or move it to a
  layer; do not layer the whole 2887-line file if avoidable, per §3.2's finding that ~30 other classed
  rules would also shift cascade priority).
- `scripts/verify-admin-token-contrast.mjs` and/or its test file — Step 0.4/0.5 region, if the plan wants
  the print-block bug (§5) fixed as part of Phase 0's own tooling hygiene (recommended, not mandatory to
  Phase 0's exit criteria as currently scoped, but directly undermines one of Phase 0's own verify steps
  if left unfixed).

**Callers/consumers of every changed symbol:** enumerated exhaustively in §1.3 (11 aliases) and §4.2
(`--admin-warning`/`-bg`).

**Tests affected:** `scripts/measure-admin-contrast.test.ts` and `scripts/verify-admin-token-contrast.test.ts`
both exist today (per the handoff) and were not modified by this review. Neither currently has a
regression test for the alias-freeze shape (Step 0.4 is exactly this gap) or for the print-block
mis-parsing (§5.3's recommendation). No existing vitest file asserts on `tokens.css`'s literal content
(`grep -rl "tokens.css" src/**/*.test.*` → none found in the admin/`scripts` test trees besides the two
named scripts' own tests).

**Shared with public / `/booking/manage` — the named trap, checked explicitly:**
- Phase 0's **de-alias work (Step 0.1) has zero reach into `/booking/manage`.** None of the 11 alias
  tokens are referenced by `input.tsx`, `badge.tsx`, or `AdminField` (checked by reading both files in
  full — `input.tsx` uses `--admin-surface-input`, `--admin-border-form`, `--admin-body`, `--admin-text-
  muted`, `--admin-focus`, `--admin-heading`, `--admin-radius-control`, none aliases; `badge.tsx`'s live
  `secondary`/`outline` variants use `--admin-panel-muted`, `--admin-body`, `--admin-border`, `--admin-
  primary`, none aliases). This is a genuine, checked "proven not affected," not an assumption.
- Step 0.2 (`--admin-warning` value change) also has **zero reach into `/booking/manage`** — neither
  `input.tsx` nor `badge.tsx` nor `Button`'s consumed variants reference `--admin-warning` (confirmed via
  the same file reads plus a targeted grep, none found).
- Step 0.3 (layer fix) **does reach `/booking/manage`** — two live `<Link>`s there carry Tailwind
  text-colour utilities directly (§3.3) and are structurally defeated by the current bug; they must be
  part of the before/after evidence set, exactly as plan line 757 already requires ("capture before/after
  evidence on the public site... this step is the single exception").

**Proven not affected (with the command used):**
- `src/app/(public)/**` and `src/features/**` carry **zero** `oklch(` literals (`grep -ro "oklch\("
  src/app/\(public\) src/features --include=*.tsx --include=*.ts` → 0 matches, both directories) — Phase 0
  makes no literal changes anyway, but this confirms no accidental overlap exists for the public/features
  trees at the token level either.
- The `--admin-warning-bg-strong`/`--admin-warning-text-strong` pair is unaffected by Step 0.2 (§7).
- `src/app/admin/me` (the "broken page, fix before build" item from the Owner-decisions list) was checked
  for any dependency on the 11 alias tokens or `--admin-warning`/`-bg` — none of its consumers appear in
  §1.3 or §4.2's lists, so Phase 0 has no interaction with that separate, already-flagged defect.

---

## Verification commands (exact, for the deepened plan's per-batch section)

```bash
# Layer 1 — must stay at 456/377/79/76/380/239 until Phase 0 lands, then D1/D9's specific
# findings should be gone from a live sweep (Layer 1 does not find D1/D9 at all today — it
# reports ZERO nav-active findings, per the plan's own §7.4b — so Layer 1 cannot be used to
# prove Phase 0 worked; only Layer 3 (live sweep) or a manual computed-style check can).
node scripts/measure-admin-contrast.mjs .

# Layer 2 — must go from 1 failure to 0 AFTER Step 0.2 lands (both light AND print copies fixed
# per §4.3). Do NOT trust "14 ratio comments, all match" as proof anything about the print block
# was checked — per §5, it wasn't. Manually confirm tokens.css:566-567 were edited.
node scripts/verify-admin-token-contrast.mjs

# Layer 3 — the only layer that actually proves D1/D9/D7 are fixed. Requires credentials via
# env, never typed by an agent:
node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts --project=chromium
# MUST move: OWNER-dark's 1.01:1 nav findings and PersonalContributionStripe's 1.05:1 dashboard
# KPI findings absent from a fresh run. MUST NOT move: light-theme totals should not worsen
# (Step 0.1 only changes tokens that resolve identically in light before/after, by construction).

# Gates by identity (unrelated to this item but must not move from Phase 0's edits):
npx tsc --noEmit
pnpm lint
npx vitest run
```

## Stop conditions specific to Phase 0

1. If Phase 0 touches a single `oklch(` literal, stop — that is Workstream 2's job (plan's own rule,
   restated here as load-bearing).
2. If Step 0.3's fix is drafted as "wrap all of `site-parity.css` in `@layer base`," stop and reconsider —
   §3.2 shows this repriorities ~30 other classed rules, not just the one `a` reset; the narrower options
   (scope the selector, or move only that one rule to a layer) match the plan's own stated preference
   ("narrowest change that fixes the nav without repainting the public site") and this review's blast-
   radius measurement supports narrowing, not file-wide layering.
3. If "Layer 2 → 0 failures" is used as the sole proof that D8 is complete, stop — per §5, Layer 2 cannot
   see the print block; manually diff `tokens.css:566-567` against `:470-471`.
4. If the Step 0.1 per-token table is executed as literally written (10 named rows), stop — `--admin-shell`
   is missing and must be explicitly assessed or deferred-with-reason, not silently skipped by omission.

## Rollback

All Phase 0 changes are CSS-only, additive-or-value-only edits to a single file (`tokens.css`) plus a
CSS-selector-scoping change to a second file (`site-parity.css`/`layout.tsx`). Every step is independently
revertable by `git revert` of its own commit (the plan already mandates one commit per step, "each
independently revertable" — confirmed structurally sound: no step depends on generated code, migrations,
or data). No irreversible action exists anywhere in Phase 0's scope.
