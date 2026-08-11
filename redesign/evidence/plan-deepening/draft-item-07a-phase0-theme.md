## ITEM 7 — Admin theming: colour, contrast and readability, fixed at the root

*(Added 2026-08-10 at the Owner's request. **Admin backend only** — the public customer site is explicitly out of scope for Workstream 2, but Phase 0 below has one deliberate exception: D12/Step 0.3 reaches the public site by construction.)*

### 7.1 What was reported

Colours and contrast across the admin pages are poor and in places **outright unreadable** — persistently, in **both** dark and light mode, and down to button labels being unclear. The Owner wants it fixed everywhere, once, properly.

### 7.2 Root cause — measured, not guessed

**677 hardcoded `oklch(…)` colour literals across 99 files in `src/app/admin/`, plus 3 shared primitives in `src/components/ui/`. Zero in the public site** — which is exactly why the complaint is admin-only.

**Correction for the record:** the "677 across 99 files" headline is the **admin-only** subset (confirmed by `grep -oE "oklch\("` scoped to `src/app/admin` alone). The shared primitives add a further **40 occurrences across exactly 3 files** (`button.tsx`, `input.tsx`, `input.tsx`/`badge.tsx`) — **combined admin+ui total is 717 occurrences.** This doesn't change any conclusion in this document (Phase 0 fixes zero literals either way — see the table below), but state it explicitly so nobody later re-derives 717 and thinks it contradicts the 677 headline.

The admin design system is **not** the problem. `src/styles/tokens.css` defines **92 `--admin-*` tokens** across four blocks — `:root`, `[data-theme="dark"]`, `[data-theme="light"]`, and an `@media print` block — and several carry their measured contrast ratio in a comment (e.g. `--admin-danger-text-strong: … /* 9.21:1 vs danger-bg-strong */`). The system was designed correctly. **677 places bypass it.**

Theme is applied via `data-theme` on a `[data-admin-theme-root]` wrapper (`ThemeProvider.tsx:105`), so a literal simply cannot respond to it. **Dark is the effective default for staff accounts**, which is why the dark-mode failures dominate.

**The problem is far more tractable than 677 suggests:** those occurrences are only **94 distinct colour values**, and the **top ten account for ~483 of them — roughly 71% of the entire problem is ten colours.**

| Occurrences | Literal | Note |
|---|---|---|
| **171** | `oklch(26% 0.14 25)` | byte-identical to `--admin-status-cancelled-text`'s **light** value |
| 74 | `oklch(95.5% 0.028 20)` | byte-identical to `--admin-status-cancelled-bg`'s **light** value |
| 58 | `oklch(26% 0.13 55)` | |
| 40 | `oklch(95% 0.05 65)` | |
| 33 | `oklch(22% 0.085 155)` | |
| 30 | `oklch(93.5% 0.038 155)` | |
| 24 | `oklch(30% 0.02 280)` | |
| 21 | `oklch(94% 0.008 280)` | |
| 16 | `oklch(88% 0.045 20)` · `oklch(28% 0.12 55)` · `oklch(12% 0.01 165)` | |

**The critical property, verified directly:** the highest-frequency literals are **byte-identical to the light-mode value of an existing token**. `--admin-status-cancelled-text` is `oklch(26% 0.14 25)` in light (`tokens.css:155`) and `oklch(88% 0.058 25)` in dark (`:393`). So replacing the literal with `var(--admin-status-cancelled-text)` renders **pixel-identically in light mode** and **correctly in dark**. For the bulk of this work, *"no visual change in light mode"* is a provable fact, not a hope.

### 7.2a Measured live, before any code was written — `redesign/evidence/admin-contrast/baseline-owner-2026-08-10.md`

The static analysis above predicted the failures; the live DOM was then audited on the Owner's own session, both themes, and **confirmed them**. This is the baseline the fix must beat.

| Page | Nodes | **Dark** fails | **Light** fails | Worst |
|---|---|---|---|---|
| `/admin/dashboard` | 89 | **8** | **15** | **1.01:1** |
| `/admin/bookings` | 147 | **8** | **8** | 1.88:1 |
| `/admin/staff` | 177 | **41** | 1 | **1.05:1** |
| `/admin/emails` | 72 | **13** | 2 | 1.88:1 |
| `/admin/settings` | 56 | **9** | 1 | **1.15:1** |
| `/admin/bookings/new` | 28 | **7** | 1 | **1.15:1** |
| **Total** | **569** | **86** | **28** | |

**1.0:1 is identical colour.** These are not low-contrast, they are invisible.

- **`/admin/staff` fails on 23% of its text in dark mode.**
- **The dashboard's KPI figures (`0`, `£0.00`, `—`) are invisible in dark mode** at 1.05:1 — the most-read content on the most-visited page.
- **Light mode is worse than dark on the dashboard** (15 vs 8), worst 1.01:1, on a surface that is still *dark* while in light mode. Literals fail in **both** directions.
- **The failing selector names its own cause:** `1.15:1 "*" span.ml-0.5.text-[oklch(26%_0.14_25)]` — `input.tsx:116` verbatim, on every form.
- **`"New booking"` — a primary CTA — fails in both themes** (1.88:1 dark, 2.51:1 light).
- The header notification badge is 3.65:1 **on every page, in both themes.**

*Method and its one disclosed limitation (clipped `.sr-only` nodes are counted and must be excluded by the production auditor) are in the evidence file. Theme was switched via the `data-theme` attribute, so no `theme_preference` write reached the database.*

### 7.2b FULL SWEEP COMPLETE — every route, every role, both themes *(2026-08-10)*

`e2e/admin-contrast.spec.ts` ran end to end: **6 tests, 3.8 minutes, all four contrast roles plus the unauthenticated surfaces.** This supersedes §7.2a's six-page baseline.

| Role | Theme | Routes audited | Denied inline | Unreachable | **Failures** |
|---|---|---|---|---|---|
| OWNER | dark / light | 24 | 0 | 5 | **595 / 467** |
| ADMIN | dark / light | 22 | 1 | 6 | **577 / 441** |
| COORDINATOR | dark / light | 15 | 8 | 6 | **202 / 216** |
| THERAPIST_A | dark / light | 8 | 12 | 9 | **59 / 56** |
| UNAUTHENTICATED | dark / light | 2 | 0 | 0 | 2 / 0 |
| | | | | **TOTAL** | **2,615** |

**82 findings sit at exactly 1.01:1 — identical foreground and background.** Not low contrast: invisible.

**The single biggest offender is the navigation.** Ranked by frequency across every role and both themes, the most-failing text is: **"Clients" ×23, "Bookings" ×15, "Enquiries" ×7, "Dashboard" ×6, "Team" ×5, "Staff" ×3, "My bookings" ×3** — the *active* nav item, at 1.01:1, `rgb(49,55,49)` on `rgb(34,56,75)`. It is on every admin page, for every role, in both themes. Whichever section a user is currently in, its label is the one they cannot read.

**Every role is affected, proportionally.** Therapist shows 59 dark failures across only 8 reachable routes — the same density as Owner's 595 across 24. **This is not an Owner-only or a dark-mode-only problem.** Coordinator is in fact *worse in light* (216) than dark (202).

**The sweep doubles as an RBAC coverage map** — Owner reaches 24 routes, Admin 22 (1 denied inline), Coordinator 15 (8 denied), Therapist 8 (12 denied); 5–9 dynamic routes per role are unreachable for lack of data, recorded as such rather than counted as passes. That is the per-role variant coverage the Owner asked for, captured as data.

**Evidence:** `redesign/evidence/admin-contrast/<ROLE>-<theme>.md` (8 files) + `summary.md`, each with a per-route table, the worst findings with full CSS selector paths, and explicit unreachable/denied lists.

**This is the number the fix must move: 2,615 → 0.**

### 7.3 The four failure classes — this is what "unreadable" actually is

Every complaint reduces to one of four mechanical patterns. Naming them matters, because each has a different fix and only two of them are true readability failures.

**Class 1 — themed foreground + hardcoded light background → text disappears in dark mode.** The worst class, and it is in the shared button primitive, so it is on every admin page simultaneously:

```
// src/components/ui/button.tsx — outline and ghost variants
"... text-[var(--admin-body)] hover:bg-[oklch(95.5%_0.012_155)] ..."
```

`--admin-body` flips to a light colour in dark mode; the hover background stays near-white at 95.5% lightness. **Hovering an outline or ghost button in dark mode paints light text on a near-white fill.** This is precisely the reported "even buttons have unclear text in them".

**Class 2 — hardcoded dark foreground on a themed dark surface → text disappears in dark mode.**

```
// src/components/ui/input.tsx
:116  className="ml-1 text-[oklch(26%_0.14_25)]"                     // required asterisk
:143  className="... text-xs text-[oklch(26%_0.14_25)]"              // field error message
```

A 26%-lightness red on the dark admin panel. Independently rated **"functionally invisible, not merely low-contrast"** during drift checkpoint #3. This is a shared primitive: **it is every admin form's error text**. A user can be blocked by a validation error they cannot see.

**Class 3 — hardcoded light background + hardcoded dark foreground → legible, but a glaring light island in dark mode.** All 11 badge variants (`src/components/ui/badge.tsx`) pair a ~95% background with a ~26% foreground. Internally high-contrast, so not unreadable — but theme-blind, and the main source of "looks wrong / inconsistent". C-14 logged the same shape in `AvailabilityRulesManager.tsx` ("a **light** day-row background pair in a dark-default admin theme").

**Class 4 — `var(--token, <light literal>)` fallbacks.** e.g. `input.tsx:27-38`. Harmless while the token exists, but it hides the real dependency and inflates the literal count. Cleanup, not a defect.

**Classes 1 and 2 are the readability bugs. Class 3 is the ugliness. Class 4 is noise.** Fix 1 and 2 first — they are the ones that make the product unusable.

### 7.4 On roles — what the measurement shows, and what it means for the sweep

The Owner asked for every role to be signed into and checked top to bottom. Two facts change the shape of that:

**(a) The role-variant surfaces are already clean.** `BusinessDashboard.tsx`, `CoordinatorDashboard.tsx`, `TherapistDashboard.tsx`, `PractitionerTodaySection.tsx` and `dashboard-variant-shared.tsx` contain **zero** `oklch` literals between them. The whole `dashboard/` directory holds only 10, all in shared support files. The debt is concentrated in **role-independent** surfaces:

| Literals | File |
|---|---|
| 57 | `bookings/new/ManualBookingForm.tsx` |
| 22 | `settings/SettingsForm.tsx` |
| 19 | `staff/page.tsx` |
| 17 | `emails/page.tsx` |
| 15 | `clients/[clientId]/page.tsx` |
| 13 | `components/AdminTopNav.tsx` · `calendar/page.tsx` · `bookings/[bookingId]/page.tsx` |

**(b) Once the literals are gone, contrast becomes a property of the 92 token pairs, not of any page or role.** Every compliant component draws its colours from the same tokens, so proving the token pairs meet WCAG AA in both themes proves it **for every page and every role at once** — exhaustively, and without a single login.

**Therefore the role sweep is a *coverage confirmation*, not the discovery mechanism.** Its job is to catch role-exclusive UI that still holds a literal, and to sanity-check the result with human eyes. That is a far cheaper and more reliable use of it than hunting for the bug by looking.

**(c) The role sweep is automated, and no agent ever handles a password.** An agent may not type credentials — that limit does not lift on request. It does not need to: **the repo already has the mechanism**, and using it is both permitted and better than manual sweeps.

`e2e/helpers.ts` provides `getCredentials(prefix)`, which reads `E2E_<PREFIX>_EMAIL` / `E2E_<PREFIX>_PASSWORD` **from the environment**, and `loginAs(page, credentials)`, which performs a real Supabase `signInWithPassword` and injects the resulting auth cookies into the Playwright context. `e2e/admin-roles.spec.ts` already drives all of this. The **Owner** puts real values in an untracked env file; the **harness** authenticates; the agent writes only `getCredentials("THERAPIST_A")` and never sees a secret.

Prefixes already supported: **`OWNER`, `ADMIN`, `COORDINATOR`, `THERAPIST_A`, `THERAPIST_B`, `REPORTING`, `INACTIVE`, `NON_STAFF`.**

This is strictly better than a human clicking through:
- **repeatable** — re-run after the fix to prove the baseline moved from 86 failures to 0;
- **exhaustive** — every route × every role × both themes, with no attention fatigue;
- **self-documenting** — evidence files are a build artefact, not a chore;
- **permanent** — it can gate CI, so contrast cannot silently regress the way the literals did.

### 7.4a Verification tooling — BUILT, before any fix *(2026-08-10)*

All three verification layers exist and run **before** a single colour is changed, so the fix has a baseline to be measured against rather than an opinion to be judged by.

| Layer | Artefact | State |
|---|---|---|
| 1 — static source analyser | `scripts/measure-admin-contrast.mjs` + `.test.ts` (10 tests) | ✅ `d2efdfb` |
| 2 — token-pair proof | `scripts/verify-admin-token-contrast.mjs` + `.test.ts` | ✅ `b97e707` |
| 3 — live per-role sweep | `e2e/admin-contrast.spec.ts` | in progress |
| Layer 3 setup | `.env.example` documents the per-role variables | ✅ `6800fce` |

**Layer 1 current reading: 456 failures (377 dark / 79 light), 76 explicit-pair, 380 assumed-surface, and 239 `unresolvedElements`.** That last metric is the honest one — class strings it cannot resolve statically are counted and reported rather than silently skipped.

**Undisclosed tooling caveat, worth recording here because Phase 0 leans on Layer 1/2's numbers:** both `measure-admin-contrast.mjs` and `verify-admin-token-contrast.mjs` locate the `@media print` block with `css.indexOf("@media print")`, and the literal substring `"@media print"` also appears **inside a prose comment at `tokens.css:317`**, before the real rule at `:543`. In `verify-admin-token-contrast.mjs` this is load-bearing and wrong — see §7.5a and Step 0.2 below. In `measure-admin-contrast.mjs` the same mis-indexed position is *not* load-bearing today: `printStart` there only bounds the end of the light-value harvest, and because that script's `harvest()` keeps the **first** value written per token per theme, the real light block (harvested before the mis-bounded slice) is never overwritten. **456/377/79 is not affected by this bug — do not let that reassurance be assumed to extend to Layer 2, where it does not.**

AST pairing (TypeScript compiler API, no new dependency) both **removed** false positives and **found true positives line-based pairing could not reach** — notably `admin-ui-interactions.tsx:342`, a destructive confirm button at **1.47:1 / 1.91:1 dark**, missed previously only because the formatter had split the foreground and its ternary-branch background across physical lines. Ternary branches are treated as distinct rendering states and never paired with each other.

**Role coverage is complete, and this was verified against the database rather than assumed.** Only five roles exist — Owner, Admin, Booking Coordinator, Therapist, Inactive — and all five have credentials. **There is no Reporting role in this system**, so `E2E_REPORTING_*` can never resolve and the corresponding e2e test has always been skipping; that is not a coverage gap. `THERAPIST_B` serves two-therapist claim scenarios only, and `NON_STAFF`/`INACTIVE` are negative-path accounts with no admin UI to audit.

### 7.4b THE CONFIRMED DEFECT REGISTER — what the three layers actually found

Every item below is **measured, not inferred**. This is the work list; §7.6–7.8 (Workstream 2, out of this section's scope) is how the literal-substitution defects get done; §7.5b (below) is how Workstream 1's defects — D1, D7, D8, D9, D12 — get done.

| # | Defect | Worst | Reach | Class | Fix type |
|---|---|---|---|---|---|
| **D1** | **Active nav item — frozen alias token + inert colour class** | **1.01:1** | **Every admin page, every role, both themes** | Theme resolution | ✅ Root-caused — **de-alias**, not substitution |
| **D12** | **⚠️ Cascade-layer inversion: unlayered `a { color: inherit }` defeats every Tailwind text-colour utility on any `<a>`** | — | **SITE-WIDE — admin *and* public.** Reach now measured: see Step 0.3. | Architecture | Layer fix |
| **D2** | Shared `button.tsx` outline/ghost `active:` — themed fg on hardcoded light bg | 1.07:1 dark | Every admin page | 1 | Substitution (Workstream 2) |
| **D3** | Shared `input.tsx:116,143` — required asterisk + **field error text**, hardcoded dark red on dark panel | 1.15:1 dark | Every admin form | 2 | Substitution (Workstream 2) |
| **D4** | `admin-ui-interactions.tsx:342` — destructive confirm button | 1.47 / 1.91:1 dark | Destructive dialogs | 1 | Substitution (Workstream 2) |
| **D5** | `ManualBookingForm.tsx:1486` — `hover:` pairing | 1.02:1 dark | Booking form | 1 | Substitution (Workstream 2) |
| **D6** | `operations/event-row.tsx:171-173` + `calendar/page.tsx:650,660` — status tokens on hardcoded light bgs | 1.01–1.14:1 dark | Operations, calendar | 1 | Substitution (Workstream 2) |
| **D7** | Header notification badge — white on amber | 3.65:1 both themes | Every admin page | 3 | Same alias-freeze mechanism as D1 — de-alias |
| **D8** | **`--admin-warning` on `--admin-warning-bg`** | **3.41:1 light** | Wherever warnings render — **including `@media print`, see §7.5a** | **Token value** | ⚠️ Design decision |
| **D9** | Dashboard KPI figures (`0`, `£0.00`, `—`) — **`--admin-text` frozen alias**, not a literal | 1.05:1 dark | Dashboard | Theme resolution | **De-alias** |
| **D10** | `/admin/staff` onboarding badges | 1.05:1 dark | Staff list | 3 | Substitution (Workstream 2) |
| **D11** | 16 prose contrast claims in `tokens.css` unverified | — | Documentation integrity | — | Extend verifier (Step 0.5) |

#### ✅ D1 ROOT-CAUSED — and it is **two** independent bugs, neither fixable by substitution

*(Investigated live in the browser, 2026-08-10; full computed-style evidence in `redesign/evidence/admin-contrast/root-cause-D1.md`. Independently re-verified by the orchestrator, and re-verified a third time for this deepening pass by direct reads of `tokens.css`, `ThemeProvider.tsx`, `layout.tsx`, `globals.css` and `site-parity.css` — no drift found.)*

**Cause 1 — `:root`-only alias tokens are frozen in light mode, permanently.**

`--admin-nav-text: var(--admin-body)` (`tokens.css:129`) and `--admin-nav-active-text: var(--admin-primary)` (`:132`) are declared **only** in the `:root` block. But **`:root` (`<html>`) never carries `data-theme`** — `layout.tsx`'s `<html>` element carries only font-variable classes, and `data-theme` lives on a `<div data-admin-theme-root>` further down (`ThemeProvider.tsx:105`, confirmed verbatim: `<div data-admin-theme-root="" data-theme={effectiveTheme}>`).

A custom-property alias is substituted **at the element where it is declared**. So `--admin-nav-text` resolves once, on `:root`, against `:root`'s `--admin-body` — the **light** value `#313731` — and every descendant inherits that already-resolved colour. It can never track the theme. `#313731` **is** the measured `rgb(49,55,49)`.

**The design comment in `tokens.css` asserts these aliases "track the theme automatically". That claim is false**, and it is why the bug survived review.

**Cause 2 — a cascade-layer inversion makes the nav's own colour class inert, site-wide.**

`globals.css:1` declares `@layer theme, base, components, utilities;` and imports Tailwind's utilities into `layer(utilities)` (`:6`). But `src/styles/site-parity.css` is imported **unlayered** (`layout.tsx:4`), and it contains:

```css
a { color: inherit; text-decoration: none; }   /* site-parity.css:39-42, confirmed verbatim */
```

Under CSS Cascade Layers, **unlayered styles beat layered styles regardless of specificity**. So that rule defeats *every* Tailwind text-colour utility applied to an `<a>` — including the nav's own `text-[var(--admin-nav-active-text)]`, which is therefore **dead code**. The link falls back to inheriting from `<nav>`, which is itself frozen by Cause 1.

**This second bug is NOT admin-only. It affects every `<a>`/`<Link>` on the site, public pages included, and its reach is now measured — see Step 0.3.**

#### Consequences for the register — three entries were mis-classified

| Was | Now |
|---|---|
| **D9** dashboard KPI figures — "Substitution" | ❌ Wrong. Same alias-freeze bug, via `--admin-text` (`PersonalContributionStripe.tsx:90`). **Not a literal.** |
| **D7** notification badge 3.65:1 | Explained: `--notif-badge-warning-bg`, another frozen alias — white on `#b77900`, computed 3.65:1 exactly |
| **D8** `--admin-warning` 3.41:1 light | Proposed fix: `#b77900` → **`#986400`**, preserving hue/saturation, **3.41:1 → 4.72:1**. Full consumer list re-verified this pass — see §7.5a/Step 0.2 |

**There are exactly 11 `:root`-only alias tokens sharing the freeze mechanism** (declared only in `:root` as a bare `var(--other-token)` value, never redeclared in the dark, light, or print blocks) — re-derived directly from `tokens.css` for this pass and confirmed against `root-cause-D1.md`'s own independent enumeration, byte-for-byte:

`--admin-shell` (`:67`) · `--admin-surface` (`:70`) · `--admin-surface-muted` (`:71`) · `--admin-text` (`:75`) · `--admin-nav-text` (`:129`) · `--admin-nav-text-muted` (`:130`) · `--admin-nav-active-text` (`:132`) · `--admin-cormorant-color` (`:136`) · `--notif-badge-critical-bg` (`:174`) · `--notif-badge-warning-bg` (`:176`) · `--notif-badge-info-bg` (`:178`).

**Correction for the record: earlier drafts of this section listed "5 unmeasured aliases" that included a phantom 5th slot ("the user-menu-button variant of `--admin-nav-active-text`") and simultaneously dropped `--admin-shell` from the count entirely.** The user-menu-button reference (`AdminTopNav.tsx:498`) is not a distinct token — it is a **second consumption site** of the same `--admin-nav-active-text` alias, and it needs its own live-contrast check post-fix precisely because it's a separate DOM location, but it is not one of the 11 names. `--admin-shell` **is** one of the 11 names, has **zero** live consumers anywhere in `src/` (confirmed by `grep -r "var(--admin-shell)"` → only the token declaration itself matches; the similarly-named `.admin-shell` CSS class in `globals.css:23-38` is an unrelated structural class that consumes `--admin-shell-ambient`, a different token, for its `::before` gradient), and `tokens.css`'s own "8 aliases" comment (lines 319-321) **does** name it — the plan's table was the only place it went missing. See the corrected Step 0.1 table below.

#### The fix shape — de-alias, then un-invert

1. **De-alias the frozen tokens.** Give each a real per-theme value in the `:root` / `[data-theme="dark"]` / `[data-theme="light"]` blocks instead of `var(--other-token)`. This is the correct fix and it is **independent of the 677-literal substitution** — do it as its own commit, before or after, never mixed in.
2. **Correct the layer inversion** — wrap the offending rule (or the whole import) so it stops beating layered utilities. **Highest-risk change in this plan**: it re-enables utilities that have been silently inert, potentially altering links across the whole site. Requires its own before/after evidence on admin **and** public.
3. **D8's token value change**, as above — and, per §7.5a below, **in both the light block and the print block**.

**Explicitly still unknown, and must not be assumed away:** live contrast for the six aliases with a known consumer but no measured live rendering (`--admin-surface`, `--admin-surface-muted`, `--admin-nav-text-muted`, `--admin-cormorant-color`, `--notif-badge-critical-bg`, `--notif-badge-info-bg`); and whether `--admin-shell`, having zero consumers, should be de-aliased anyway for consistency or explicitly deferred as dead code (either is acceptable — silently dropping it from the table is not, see Step 0.1).

### 7.5 The solution — TWO workstreams, not one

**This section was rewritten after D1 was root-caused.** The plan originally assumed one problem — hardcoded literals — and one remedy: substitution. The measurement proved otherwise. There are **two independent defect classes**, with different causes, different fixes, and different risk profiles. **Conflating them is the main way this work goes wrong.**

| | **Workstream 1 — theme resolution** | **Workstream 2 — hardcoded literals** |
|---|---|---|
| Defects | **D1, D7, D9, D8, D12** | D2, D3, D4, D5, D6, D10 |
| Cause | `:root`-only aliases frozen in light; a cascade-layer inversion; one bad token value | 677 (admin) / 717 (admin+ui) literals bypassing the token system |
| Fix | **De-alias tokens; correct the layer; change one token value** | Mechanical substitution |
| Size | 11 tokens, 1 CSS selector, 1 value (2 locations) | 677–717 occurrences / 99–102 files |
| Risk | **Low volume, HIGH blast radius** (one is site-wide) | High volume, low blast radius per edit |
| Phase | **Phase 0 (§7.5b)** | Phases A–B (§7.6–7.7, out of this section's scope) |
| Files touched | `src/styles/tokens.css`, `src/styles/site-parity.css` and/or `src/app/layout.tsx`, optionally `scripts/verify-admin-token-contrast.mjs` (+its test) | `src/components/ui/*.tsx` + ~99 `src/app/admin/**` files |

**Substitution cannot fix Workstream 1** — those colours are already correctly-themed tokens. An implementer who treats the register as one undifferentiated list will edit literals that were never the problem and leave the highest-reach defect in place. Symmetrically: **if you find yourself editing an `oklch(` value while doing Phase 0 work, stop — that is Workstream 2's job, not this one's.** (`redesign/evidence/admin-contrast/surgical-review.md` states the mirror-image rule for Workstream 2 — "if an implementer reaches D1 during the sweep and is tempted to fix the nav highlight, they must stop and report, not touch `AdminTopNav.tsx`'s nav-active classes." Both workstreams' implementers should read both boundary statements.)

**Recommended sequence: Workstream 1 first.** It is far smaller, it clears the defect with the widest reach (D1 — every admin page, every role, both themes), and it is independent of the substitution work. Doing it first also means the Layer 3 baseline drops sharply and cleanly, making the remaining substitution progress easier to read. *(The plan does not mandate this order — but if the substitution runs first, expect 2,615 to barely move, because the nav defect alone recurs on every route.)*

**And for both workstreams: eliminate, prove, prevent.** A durable fix needs all three. Substitution alone would be undone within weeks: **11 brand-new files created during Band C carried this debt from their first commit**, each citing the match-the-surrounding-style rule. There is currently **no guard of any kind** against adding another literal, nor against reintroducing a frozen alias (that gap is Step 0.4).

#### Ordering against the rest of the plan

**Phase 0 has zero file overlap with any other item in this plan.** The collision table elsewhere in this document (SettingsForm.tsx, BookingManagementForm.tsx, bookings/[bookingId]/page.tsx, SeriesActions.tsx, ManualBookingForm.tsx — shared between items 7 and 8) is entirely **Workstream 2** territory: those files carry hardcoded literals, not frozen aliases or the layer-inversion rule. None of them is touched by any Phase 0 step. `tokens.css`, `site-parity.css`, `layout.tsx`, and `verify-admin-token-contrast.mjs` do not appear anywhere in the item-1/item-7/item-8 collision list.

**Consequence: Phase 0 can run at any point relative to item 8**, independent of the ordering defect the plan documents elsewhere (item 7's Workstream 2 must trail item 8's new UI in the four shared files). Phase 0 is not part of that constraint and does not need to wait.

**Phase 0 must, however, run before or independently of Workstream 2's own Phase A/B**, per §7.5's "Workstream 1 first" recommendation above — that is an internal item-7 sequencing choice, not a cross-item one.

### 7.5a Layer 2 built and run — one token pair genuinely fails AA, and the tool has a coverage gap of its own *(2026-08-10, `b97e707`; tool coverage gap found and confirmed this deepening pass)*

`scripts/verify-admin-token-contrast.mjs` now proves the token layer. 92 tokens resolved in both themes; **83 unique pairs × 2 themes = 166 checks**, derived by naming convention, by documented pairings, and by every foreground-ish token against the four real surfaces.

**Two results that change Phase A/Phase 0:**

1. **All self-declared ratio comments physically present in the file are accurate** (max delta ±0.03). The design system's claims about itself hold — good news, and it means those comments can be trusted as intent when choosing substitutions. **Correction for the record: this and earlier drafts stated "14 self-declared ratio comments, all match." That count is inflated by a real bug in the verifier itself (below); the true count of distinct inline ratio comments in the file is 11 (root 2 + dark 5 + light 2 + print 2). The "14, all match" claim should be read as "the 11 real ones plus 3 duplicated instances of the dark block's comments mislabelled as print's, all of which happen to still be individually accurate" — not as 14 independently-checked facts.**

2. **⚠️ One real AA failure in the tokens themselves: `--admin-warning` on `--admin-warning-bg` = 3.41:1 in the light theme** (needs 4.5:1). **This means Phase 0 is not purely mechanical.** Substitution alone would faithfully reproduce a genuinely non-compliant pair. Fixing it is a **token value change** — design work, not find-and-replace — and per §7.5b Step 0.2 it must be its own reviewed change with the before/after ratio quoted, applied in **both places the pair is declared**, not one.

#### ⚠️ Verifier bug found this pass: the `@media print` block is never actually checked

`parseTokensCss()` locates the print block with `css.indexOf("@media print")` (`verify-admin-token-contrast.mjs:197`). The literal substring `"@media print"` occurs **twice** in `tokens.css`: once inside a prose comment at **line 317** ("these blocks MUST stay after `:root`, and `@media print` MUST stay last"), and once in the real rule at **line 543**. `indexOf` returns the first match — the comment — and `extractBraceBlock` then walks forward from there to the *next* `{`, which belongs to the `[data-theme="dark"]` selector (line 331), and captures that block's body (through line 447) as if it were print's.

**Confirmed by re-implementing `extractBraceBlock` in isolation and printing what it actually returns**: the "print" scope opens with the dark block's own surfaces comment and closes with the dark block's own ratio comments — unambiguously the dark block, mislabelled. Consequence: **the script has never actually parsed or checked the real `@media print` block's token values, including its own copy of the failing `--admin-warning`/`--admin-warning-bg` pair** (`tokens.css:566-567`, byte-identical to the light block's pre-fix values by design — the print block always renders the light palette, per its own header comment at `:535-542`). `checkPairs()` (the 1c derived-pairs pass) never iterates a "print" scope at all — only `["dark", darkScope]` and `["light", lightScope]` — so this gap exists in both of the script's passes, not just the ratio-comment one.

**This is a real, previously-undocumented tooling gap, not a Phase 0 defect** — `tokens.css` itself is not wrong; the print block's design (render the light palette) is sound and its literal values already match the light block's pre-fix values exactly. The gap only becomes load-bearing at the moment Step 0.2 edits the light block and needs the print block edited identically — see Step 0.2 below for the required action.

**Fix for the tool, one line, in scope for Step 0.4/0.5's tooling-hygiene work (recommended, does not block Phase 0's own exit criteria but does undermine one of Phase 0's own verify steps if left unfixed — see the Step 0.2 STOP condition):** locate the print block by searching for the literal `@media print {` (requiring the following brace) rather than the bare substring, or search forward from where the light block's own closing brace is found. Add a regression test asserting `parseTokensCss(css).scopes.print["--admin-warning"]` resolves to the print block's own declared value (not the dark block's), and that exactly 2 ratio comments are attributed to `print`.

**Known coverage gap, separate from the bug above, logged not closed:** the verifier checks the **inline** `/* N:1 vs X */` comments. `tokens.css` contains a further **16 contrast claims written in prose** that nothing verifies — several load-bearing, e.g. *"fails WCAG text contrast at 1.42:1 on canvas; **never use as body text**"*, *"danger 5.39:1, warning 4.71:1, info 7.18:1"*, *"all six sit 5.55–9.75:1 against `--admin-panel`"*. A prose safety warning that silently stops being true is exactly the defect class this programme keeps finding. This is Step 0.5.

*(Correction for the record, carried from an earlier pass: this plan previously said "18 such comments" for the prose claims. That was a loose line-count and was wrong; the number is 16 prose claims plus the inline comments discussed above.)*

### 7.5b PHASE 0 — the theme-resolution fixes *(Workstream 1: D1, D7, D9, D8, D12)*

**Five steps, strictly in this order.** Each is independently revertable. **None of them touches a single hardcoded literal** — if you find yourself editing an `oklch(` value in Phase 0, stop: you are in the wrong workstream.

Full evidence: `redesign/evidence/admin-contrast/root-cause-D1.md`, cross-checked this pass in `redesign/evidence/plan-deepening/item-07a-phase0-theme.md`.

---

#### Step 0.1 — De-alias the frozen tokens *(fixes D1's Cause 1, D9, D7)*

**The bug:** a token declared in the `:root` block as `var(--other-token)` is substituted **at `:root`**, and `:root` (`<html>`) **never carries `data-theme`** — that attribute lives on `<div data-admin-theme-root>`, currently at `ThemeProvider.tsx:105` — **RE-LOCATE BY THE `data-admin-theme-root` ATTRIBUTE and report drift if the line number has moved.** So the alias resolves once against `:root`'s light value and every descendant inherits that frozen colour. It can never track the theme.

**The fix:** replace each alias with a **real value in each theme block** — `:root`, `[data-theme="dark"]`, `[data-theme="light"]`, and `@media print`.

**All 11 affected tokens must be assessed — this is the corrected, complete list (§7.4b above has the full derivation). `tokens.css`'s own "aliases" comment currently at lines 319-321 — RE-LOCATE BY ITS TEXT ("Aliases (--admin-shell, ...) are deliberately NOT repeated") — already names all 11 correctly; it is only this plan's own table that previously dropped one. Do not repeat that omission.**

| Token | Declared at (`:root`) — RE-LOCATE BY NAME, not line | Status |
|---|---|---|
| `--admin-shell` | currently `:67`, value `var(--admin-sidebar)` | ⚠️ **Zero live consumers** (confirmed: `grep -r "var(--admin-shell)"` matches only the declaration itself). Must be explicitly assessed: either de-alias anyway for consistency, or defer with the reason "dead code, no visible defect" recorded in the commit message. Do not silently drop it from the table the way earlier drafts did. |
| `--admin-surface` | currently `:70`, value `var(--admin-panel)` | ✅ confirmed consumed (`src/app/admin/clients/page.tsx:644`), live contrast **not yet measured** |
| `--admin-surface-muted` | currently `:71`, value `var(--admin-panel-muted)` | ✅ confirmed consumed (`attention-group-client.tsx:249`), live contrast **not yet measured** |
| `--admin-text` | currently `:75`, value `var(--admin-heading)` | ✅ confirmed broken + consumed (**D9** — `PersonalContributionStripe.tsx:90`, plus `ClientLtvRibbon.tsx`, `MetricRow.tsx`, `TrendTile.tsx`) |
| `--admin-nav-text` | currently `:129`, value `var(--admin-body)` | ✅ confirmed broken + consumed (**D1**) |
| `--admin-nav-text-muted` | currently `:130`, value `var(--admin-text-muted)` | ✅ confirmed consumed (`AdminTopNav.tsx` multiple sites, `ThemeToggle.tsx`), live contrast **not yet measured** |
| `--admin-nav-active-text` | currently `:132`, value `var(--admin-primary)` | ✅ confirmed broken + consumed (**D1**). **Two separate consumption sites** — the nav link itself and, separately, the user-menu button (`AdminTopNav.tsx`, currently ~line 498) — both must be re-checked live after the fix; they are the same token but different DOM locations. |
| `--admin-cormorant-color` | currently `:136`, value `var(--admin-accent)` | ✅ confirmed consumed (`admin-ui.tsx`, decorative Cormorant numerals only, per its own "Exception rule" comment), live contrast **not yet measured** |
| `--notif-badge-critical-bg` | currently `:174`, value `var(--admin-danger)` | ✅ confirmed consumed (`notification-bell.tsx`); currently clear AA on white (≈5.6:1 by computation) — broken by mechanism, not yet by measured contrast; de-alias anyway |
| `--notif-badge-warning-bg` | currently `:176`, value `var(--admin-warning)` | ✅ confirmed broken + consumed (**D7**, computed 3.65:1) |
| `--notif-badge-info-bg` | currently `:178`, value `var(--admin-info)` | ✅ confirmed consumed (`notification-bell.tsx`); currently clear AA (≈6.97:1) — broken by mechanism, not yet by measured contrast; de-alias anyway |

**Do not assume the unmeasured aliases are benign, and do not fix them blind.** Measure each first; a token that happens to be consumed only on a light surface may be correct today and still worth de-aliasing for consistency — but that is a judgement to record, not to skip.

**Also correct the false comment in `tokens.css`** (currently lines 319-325, opening "Aliases (--admin-shell, ...) are deliberately NOT repeated... tracks the theme automatically") — it is wrong, and it is why the bug survived review. A stale comment that misleads the next reader is a defect in its own right.

**Sequencing note, corrected this pass:** if Step 0.1 and Step 0.2 both touch `--notif-badge-warning-bg`'s effective light value, do **Step 0.2 first** (per this plan's own order) so Step 0.1's de-aliased light value for `--notif-badge-warning-bg` is written as the corrected `#986400`, not the soon-to-be-stale `#b77900`.

**Blast radius — full consumer enumeration, by token, is in §7.4b above.** No consumer of any of the 11 aliases sits in `src/components/ui/*.tsx`, `src/app/booking/**`, or `src/app/(public)/**` — checked directly by reading `input.tsx` and `badge.tsx` in full (their token references are `--admin-surface-input`, `--admin-border-form`, `--admin-body`, `--admin-text-muted`, `--admin-focus`, `--admin-heading`, `--admin-radius-control`, `--admin-panel-muted`, `--admin-border`, `--admin-primary`, `--admin-status-*` — none of the 11 aliases) and by grepping `src/app/(public)/**` and `src/app/booking/**` for every one of the 11 alias names (zero matches in either tree). **Step 0.1 has zero reach into `/booking/manage` or the public site — proven, not assumed.**

**Verify:**
```bash
node scripts/verify-admin-token-contrast.mjs
# Layer 2 must still report its single known failure (D8) and no new one.
node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts --project=chromium
# MUST move: OWNER-dark's 1.01:1 nav findings and PersonalContributionStripe's 1.05:1
# dashboard KPI findings absent from a fresh run.
# MUST NOT move: light-theme totals should not worsen (Step 0.1 only changes tokens
# that resolve identically in light before/after, by construction — every alias's
# :root value is unchanged, only the dark/light/print blocks gain their own explicit copy).
```

**Tests to add** — `scripts/verify-admin-token-contrast.test.ts`:
- `it("resolves --admin-nav-text, --admin-nav-active-text, --admin-text and all three --notif-badge-*-bg tokens to a real per-theme value, not a bare var() alias, in every theme block")`

---

#### Step 0.2 — Fix the `--admin-warning` token value *(D8)*

`--admin-warning` on `--admin-warning-bg` = **3.41:1 in light**, below AA. Proposed: `#b77900` → **`#986400`**, preserving hue and saturation, computed **3.41:1 → 4.72:1** (independently recomputed by hand this pass using the WCAG 2.1 relative-luminance formula against both the current and proposed values — confirmed).

**⚠️ Must be applied in BOTH of the following locations — this is a correction to the plan, not new scope:**
- `[data-theme="light"]` block, currently `tokens.css:470-471` (`--admin-warning: #b77900;` / `--admin-warning-bg: #fff7df;`)
- `@media print` block, currently `tokens.css:566-567` — **identical values, separately declared, not inherited.** The print block's own header comment (currently `:535-542`) states its whole design is "print always renders the light palette", so its copy of the pair must change identically or it silently remains a 3.41:1 failure that nothing currently catches (see the Layer 2 tooling gap in §7.5a — `checkPairs()` never checks a "print" scope at all).

**Full consumer list, re-derived directly against the live source this pass (supersedes any earlier partial list) — `grep -rn "var(--admin-warning)\|var(--admin-warning-bg)" src --include=*.tsx`:**

- `WorkingHoursDayEditor.tsx:221-222` — border + bg + text, the direct D8 pair itself; darkening the text only improves it.
- `dashboard-filters-client.tsx:409,565,575` — bg/border tint pairs (not paired with `--admin-warning` as text); `:417,581` — `--admin-warning` used as a **solid fill** under `--admin-on-primary` text (darkening the fill only increases contrast against that near-white text in light theme).
- `dashboard-cards.tsx:144,720,733,892,972,1109,1441,1450,1457,1594,1603,1614,1634,1651` — mix of text-on-tint pairs (improve), a solid-fill-under-`--admin-on-primary` pair at `:1603` (improve), and purely decorative dot/progress-fill/border usages with no contrast implication.
- `TherapistDashboard.tsx:627` — border colour only, not text.
- `admin-ui.tsx:92`, `notification-card.tsx:177,189`, `notification-bell.tsx:739`, `ReportsCharts.tsx:101` — decorative fill/stroke/dot, no contrast implication.
- **Alias consumer:** `--notif-badge-warning-bg` (D7) resolves through `--admin-warning` too — darkening it improves D7's frozen 3.65:1 badge incidentally (≈3.65:1 → ≈5.05:1 by the same math), though this does not fix D7's actual defect (the freeze itself, fixed by Step 0.1).

**No consumer found where darkening `--admin-warning` (light theme only) would reduce contrast.** Re-verify this yourself before applying — the list above is exhaustive as of this pass but re-run the grep, don't trust it as a permanent snapshot.

**Also confirmed, unaffected by this change:** `--admin-warning-bg-strong` / `--admin-warning-text-strong` are a **separate, already-passing pair** (10.71:1 dark, matches its own inline comment) declared independently in all four blocks, not aliased to `--admin-warning` — no shared consumer where changing `--admin-warning` alone would also silently need the `-strong` variant touched.

This is a **genuine appearance change**, the only one sanctioned anywhere in Phase 0. It must be its own commit with before/after ratios quoted for **both** the light and print copies, and it is the **one place where "light mode is unchanged" does not apply** — say so explicitly in the commit message so it is not mistaken for a mis-mapping.

**Verify:**
```bash
node scripts/verify-admin-token-contrast.mjs
# Must report 0 failures.
# ⚠️ Per §7.5a, this alone is NOT sufficient proof the print block was fixed — the
# script cannot currently see the print block's real content. Manually diff
# tokens.css:566-567 against :470-471 after editing to confirm both changed identically.
```

**Tests to add** — `scripts/verify-admin-token-contrast.test.ts`:
- `it("fails when the light-theme --admin-warning / --admin-warning-bg pair is below 4.5:1")` (regression guard pinning the fixed 4.72:1, so a future edit can't silently reintroduce 3.41:1)
- If the Step 0.5 tooling fix lands first or alongside: `it("checks the @media print block's own --admin-warning / --admin-warning-bg pair, not the dark block's")`

**Shared with public / `/booking/manage`:** zero reach. Neither `input.tsx` nor `badge.tsx` nor any `Button` variant consumed by `/booking/manage` references `--admin-warning` or `--admin-warning-bg` (confirmed by reading both files in full plus a targeted grep, no matches).

---

#### Step 0.3 — ⚠️ Correct the cascade-layer inversion *(D1's Cause 2 / D12) — HIGHEST-RISK CHANGE IN THIS PLAN*

`src/styles/site-parity.css` is imported **unlayered**, currently `layout.tsx:4` — **RE-LOCATE BY THE IMPORT STATEMENT `import "@/styles/site-parity.css";`, not the line number.** Confirmed this pass: `layout.tsx`'s import order is `react-day-picker/style.css` (line 3, also unlayered — see below), then `@/styles/site-parity.css` (line 4), then `./globals.css` (line 5). Tailwind utilities sit in `layer(utilities)` (`globals.css:1,6`). Unlayered CSS beats layered regardless of specificity, so `site-parity.css`'s `a { color: inherit; text-decoration: none; }` — confirmed verbatim at `site-parity.css:39-42` — **defeats every Tailwind text-colour utility on every `<a>` — site-wide, admin and public.**

**Undisclosed-until-this-pass fact worth stating explicitly: `tokens.css` is *also* imported unlayered** (`globals.css:4`, no `layer(...)` wrapper — confirmed by direct read), exactly like `site-parity.css`. This is **not currently a bug** (custom-property declarations don't compete the way `a { color: inherit }` does — nothing in the `theme`/`utilities` layers redeclares the same custom properties at a competing specificity), but it means the pattern is "two of the things imported into `globals.css` before the layer system finishes populating are unlayered," not "one file is the odd one out." Worth knowing when deciding how narrowly to scope the Step 0.3 fix.

**Also checked and cleared: `react-day-picker/style.css`** (`layout.tsx:3`, also unlayered) contains no bare element/colour selectors that could compete with a Tailwind utility the way `site-parity.css`'s `a` rule does — every rule in it is scoped to a `.rdp-*` class. **Not part of the D12 blast radius. No action needed there.**

**Precondition 1 — why was it imported unlayered — now investigated, not just hedged:**
```bash
git log --follow --oneline -- src/styles/site-parity.css   # oldest: 11067ed "Initial refactor website commit"
git blame -L 39,42 -- src/styles/site-parity.css            # all 4 lines: 11067ed, 2026-04-26
git blame -L 1,6 -- src/app/globals.css                     # all 6 lines, incl. @layer decl AND both imports: 11067ed
git log -1 --format=%B 11067ed                               # "Initial refactor website commit", no body
```
**The `a { color: inherit }` rule and the `@layer theme, base, components, utilities;` declaration it now conflicts with were authored in the *same commit, same day*.** No later commit, code comment, or design-handoff note discusses the interaction. `site-parity.css`'s own header comment and filename point at a Webflow-export migration purpose, and the `@layer theme/utilities` wrapper lines are exactly Tailwind v4's own standard boilerplate — not a bespoke choice. **Conclusion: no evidence this was a considered decision about layer interaction.** This reads as an artefact of the parity file never being made layer-aware when the Tailwind v4 layer scaffold was set up, not a deliberate choice to let it beat utilities. **Precondition 1 is satisfied: investigated, no evidence of deliberateness found — proceed on that basis, but the option list below still prefers the narrowest fix regardless, because "no evidence of intent" is not the same as "proven accidental."**

**Precondition 2 — measure the reach first — now measured, not hedged:**

Method: `Grep` (`multiline:true`) for `<a\s[^>]*?text-[a-zA-Z-]` and `<Link\s[^>]*?text-[a-zA-Z-]`, per directory. Known undercount (disclosed): a class string built via `cn()`/template literals with a *variable* fragment won't match; these counts are a floor, not a ceiling.

| Area | `<a>` matches | `<Link>` matches | Files |
|---|---|---|---|
| `src/app/admin/**` | 13 | 148 | 11 + 56 |
| `src/app/(public)/**` | 2 | 0 | 2 |
| `src/app/booking/**` | 0 | 1 | 1 (`booking/manage/page.tsx`) |
| `src/features/**` | 0 | 0 | 0 |
| `src/components/**` (renders into public routes) | 6 | 54 | 4 + 35 |

**Admin ≈161. Public-reaching (public app dir + booking + components) ≈63. Grand total ≈224.** This falsifies any assumption the layer bug is admin-only in occurrence, not just in definition.

**Two concrete, verified-live public/customer hits on `/booking/manage`, confirmed by direct read this pass (exact anchors — RE-LOCATE BY THE `<Link>` TAG AND `href` IF THESE DRIFT):**
```tsx
// src/app/booking/manage/page.tsx:194-197
<Link
  href="/cookies/"
  className="font-medium text-[var(--rahma-charcoal)] underline underline-offset-4"
>

// src/app/booking/manage/page.tsx:333-336
<Link
  href="/"
  className="mt-5 inline-flex rounded-lg bg-[var(--rahma-green)] px-5 py-3 text-sm font-semibold text-white"
>
```
Both are real `<a>` elements at runtime (`next/link` always renders one), both carry a Tailwind text-colour utility directly on the tag, both are structurally defeated by the unlayered `a { color: inherit }` rule **today**. These are the required before/after evidence pair for `/booking/manage`.

`src/components/layout/SiteHeader.tsx` (the public nav, present on every `(public)` route) has 3 `<Link>` matches carrying `text-` on the same line — checked: its primary nav-link colour comes from a **classed** rule (`.navbar31_desktop-link`, from `site-parity.css` itself), not a raw Tailwind utility, so it is **not** currently broken by this bug the way the admin nav is. Still include its 3 `text-` matches in the before/after diff for completeness, since they sit on other elements in the same file.

**Also worth one sentence for scoping the fix:** `site-parity.css` (2887 lines, read in full this pass) contains **exactly one** rule that sets `color` on a bare, unqualified element selector — the `a` rule. Every other colour-bearing rule in the file (~30 of them: `.navbar31_link`, `.footer_link`, `.button`, etc.) is qualified by a class selector, so they don't currently compete with a same-element Tailwind utility the way the bare `a` rule does — but they *would*, under the identical mechanism, if any future JSX paired one of those classes with a conflicting Tailwind utility on the same tag. That risk is currently dormant, not zero, and is a reason to prefer **narrowing the fix to the `a` rule specifically** rather than layering the whole file (which would also reprioritise those ~30 classed rules against utilities, an unmeasured and unrequested change).

**⛔ Both preconditions above are now satisfied — this section no longer requires a STOP-AND-ASK on those two points. The third precondition is process, not investigation, and still applies:**

3. **Capture before/after evidence on the public site**, not just admin — specifically the two `/booking/manage` links above, `SiteHeader.tsx`'s three matches, and a spot-check of the admin nav. ITEM 7 is otherwise admin-only; **this step is the single exception, and it is why it cannot ride along with anything else.**

**Options, in preference order (narrowest first, per the finding above):**
1. Scope the `a` rule itself, e.g. by moving only that one declaration into an existing layer, or narrowing its selector so it stops competing with utilities on elements that carry one.
2. Wrap just the `a { color: inherit; text-decoration: none; }` rule in `@layer base` (or a new, narrowly-scoped layer) rather than the whole file.
3. Wrap the entire `site-parity.css` import in `@layer base` — **only if 1 and 2 are shown to be insufficient**, and only with the ~30-classed-rules caveat above explicitly accepted and evidenced, since it repriorities all of them, not just the `a` rule.

**Do NOT bundle this with Step 0.1.** If 0.1 lands alone and D1's ratio improves but the nav's own colour class is still inert, that is expected — 0.1 fixes the inherited colour, 0.3 restores the element's own.

**Verify:**
```bash
node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts --project=chromium
# MUST move: the nav-active text class should now be live (not just inherited-correct via 0.1).
```
Public-site before/after has no existing automated tool in this repo (Layer 1/2/3 are admin-scoped by design). Do it as a manual computed-style check in the browser against the two named `/booking/manage` `<Link>`s and `SiteHeader.tsx`'s three matches, both before and after, and attach the evidence to the commit — same standard as `root-cause-D1.md`'s existing method.

**Tests to add:**
- `src/styles/__tests__/site-parity-anchor-scope.test.ts` (new file, following the source-text anti-drift guard idiom already used by `src/content/site/__tests__/canonical-domain.test.ts`): `it("keeps the site-parity 'a { color: inherit }' rule scoped so an unlayered import can't defeat Tailwind text-colour utilities site-wide")` — read the raw source of `site-parity.css` and assert the bare `a { color: inherit` selector is no longer present unqualified (i.e. the fix actually landed, not just that the file still parses).

**Stop condition specific to this step:** if the fix is drafted as "wrap all of `site-parity.css` in `@layer base`" without first trying options 1–2, stop and reconsider — the ~30-classed-rule caveat above means that is not the narrowest available fix.

---

#### Step 0.4 — Regression guard for the alias class

Add a check that fails if any `--admin-*` or `--notif-*` token is declared **only** in `:root` with a `var(--…)` value. This is the exact shape that froze D1/D7/D9, and nothing currently prevents a new one.

Belongs with the Layer 2 verifier (`scripts/verify-admin-token-contrast.test.ts`). **Disclose its limit**, per C-17's precedent: it is a source-level check and will not catch an alias introduced through a different mechanism.

**Test-design note, corrected this pass:** a test that only asserts "zero frozen aliases found" against the *post-Step-0.1* `tokens.css` would trivially pass whether or not the guard's own detection logic works — Step 0.1 will have removed all 11 real instances, so a broken checker and a working one produce the same "zero" result. **The guard needs its own synthetic fixture** — a small inline CSS string declaring a token only in `:root` as `var(--other)` — asserted to be caught, in addition to the real-file "zero found" assertion.

**Tests to add** — `scripts/verify-admin-token-contrast.test.ts`:
- `it("flags a token declared only in :root as a bare var() alias")` (synthetic fixture, proves the guard's detection logic actually works)
- `it("finds zero frozen :root-only alias tokens in the real tokens.css")` (real-file assertion, only meaningful once Step 0.1 has landed and paired with the synthetic test above)

---

#### Step 0.5 — Extend the Layer 2 verifier to the prose ratio claims *(D11)*, and fix the print-block mis-parse *(§7.5a)*

The verifier checks the inline `/* N:1 vs X */` comments. `tokens.css` carries **16** contrast claims written in prose that nothing verifies — several load-bearing, e.g. *"fails WCAG text contrast at 1.42:1 on canvas; **never use as body text**"*, *"danger 5.39:1, warning 4.71:1, info 7.18:1"*, *"all six sit 5.55–9.75:1 against `--admin-panel`"*.

**This belongs in Phase 0 specifically because Steps 0.1 and 0.2 change token values** — so any prose claim about those tokens is at risk of becoming false *as a result of this very work*. Extend the parser, re-verify all claims (11 real inline + 16 prose = 27; **not** "14 + 16 = 30" as an earlier draft stated, since 14 was itself the inflated figure — see §7.5a), and **correct any that Phase 0 invalidates**.

**Also fix the print-block indexOf bug found in §7.5a as part of this step's tooling hygiene** — one-line change: locate `@media print` by its selector-with-brace form, or search forward from the end of the light block, so `parseTokensCss` stops returning the dark block's body under the "print" label. Add the regression test named in §7.5a.

A prose safety warning that silently stops being true is precisely the defect class this programme keeps finding. **Where a claim cannot be machine-parsed, say so in the tool's output** rather than quietly checking only the easy ones.

**Tests to add** — `scripts/verify-admin-token-contrast.test.ts`:
- `it("parses the @media print block from its own selector, not from the word 'print' inside an earlier comment")`
- `it("reports exactly 2 ratio comments attributed to the print block, not 5")`
- `it("verifies all 16 prose contrast claims in tokens.css, flagging any it cannot machine-parse rather than skipping it silently")`

---

**Phase 0 exit criteria:** D1, D7, D9 findings absent from a Layer 3 re-run; Layer 2 at **0** failures, with the print block's own copy of the D8 pair manually confirmed changed (not just Layer 2's aggregate number, per §7.5a); all 27 ratio claims (11 real inline + 16 prose) verified or corrected; the alias guard passing with its synthetic fixture proven to catch a real regression; `--admin-shell` explicitly assessed or deferred-with-reason, not silently dropped; `/booking/manage` and the public site unchanged **except** where Step 0.3 deliberately changed them, with evidence for both named `/booking/manage` links and `SiteHeader.tsx`'s three matches; and every other alias with a known-but-unmeasured consumer (`--admin-surface`, `--admin-surface-muted`, `--admin-nav-text-muted`, `--admin-cormorant-color`, `--notif-badge-critical-bg`, `--notif-badge-info-bg`, plus the user-menu-button consumption site of `--admin-nav-active-text`) individually re-checked live post-fix, not silently assumed fine.

**Gates by identity, unrelated to this item but must not move from Phase 0's edits:**
```bash
npx tsc --noEmit      # must stay 0, silent, exit 0
pnpm lint              # must stay 59 errors / 7 warnings, exactly the same six files —
                       # Phase 0 touches none of them (tokens.css/site-parity.css/layout.tsx
                       # are not among the six, and neither script is linted for the same
                       # rules the six-file baseline tracks)
npx vitest run         # must stay 5 failed / 2236 passed, same five named tests
                       # (Phase 0 adds new passing tests; it must not change this baseline's
                       # identity — new tests are additive, not replacements)
```

### Stop conditions — Phase 0, consolidated

1. If Phase 0 touches a single `oklch(` literal, stop — that is Workstream 2's job.
2. If Step 0.1's per-token table is executed as though it has 10 rows, stop — `--admin-shell` is the 11th and must be explicitly assessed or deferred-with-reason, not silently omitted.
3. If Step 0.2 edits only `tokens.css:470-471` and treats "Layer 2 → 0" as proof of completion, stop — the print block's copy at `:566-567` must be edited too, and Layer 2 cannot currently see it (§7.5a).
4. If Step 0.3's fix is drafted as "wrap all of `site-parity.css` in `@layer base`," stop and reconsider — that repriorities ~30 other classed rules, not just the `a` reset; try the narrower options first.
5. If Step 0.3 proceeds without capturing before/after evidence on `/booking/manage`'s two named `<Link>`s and `SiteHeader.tsx`, stop — this is the one step in ITEM 7 that is not admin-only, and it is the one place the "admin-only, public site untouched" guarantee does not hold by design.
6. If Step 0.4's regression test only asserts "zero frozen aliases in the real file" without a synthetic fixture proving the detector actually works, stop — that test would pass even if the detection logic were broken.
7. If any of the six aliases with a known consumer but no measured live contrast (see exit criteria) ships without a live re-check, stop and report which ones were skipped and why, rather than letting the gap go unrecorded.

### Rollback

All Phase 0 changes are CSS-only, additive-or-value-only edits to `tokens.css`, plus a CSS-selector-scoping change to `site-parity.css` and/or `layout.tsx`, plus an optional one-line parser fix in `scripts/verify-admin-token-contrast.mjs`. Every step is its own commit and is independently revertable with `git revert` — no step depends on generated code, a migration, or a data write. **Nothing in Phase 0's scope is irreversible.** The only step with reach beyond admin (Step 0.3) is exactly as revertable as the others; its risk is in *scope of visible effect while live*, not in difficulty of rollback.
