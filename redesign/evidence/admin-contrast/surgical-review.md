# Surgical review — POST-BAND-C-FOLLOWUP-plan.md

**Reviewer role:** analysis only, no product code touched. **Repo state at review time:** branch `master`, HEAD `4a55931`, working tree `M src/lib/maintenance.ts` only (confirmed — matches the plan's expected pre-flight state; `MAINTENANCE_MODE`: HEAD `true`, working copy `false`).

**How to read this document:** written to be pasted into the plan as new sections. Every figure below was independently re-derived from the current tree (`grep`, the two existing analyser scripts run directly, `npx tsc --noEmit`, `pnpm lint`, `npx vitest run`) — not copied from the plan. Where my number disagrees with the plan's, both are given and the delta is explained.

---

## Executive summary

- **Biggest risk found:** the plan's blast-radius claim — *"the public customer site must not be affected, and `src/app/(public)/**` measured at ZERO literals, so any bleed is a hard stop"* — is true as literally stated but **incomplete**. A live, unauthenticated, token-bearing customer route, `src/app/booking/manage/` (outside both `src/app/(public)/**` and `src/app/admin/**`), directly imports and renders all three primitives Phase B step 1 edits first: `Button` (`ManageBookingForms.tsx:5`), `Input` (`:6`, 2 call sites), and `Badge` (`page.tsx:9`, 1 call site). The plan's Phase D verification (§7.9) never visits this route. See §1 below — full detail, and why the actual risk is lower than it first looks once you trace which variants this route actually uses.
- **Order (§7.7 primitives → top-10 → long tail):** **endorsed**, with one addition — see §2. The order is well-justified on readability-win-per-risk grounds, but the plan's Phase A/B "94 distinct values" set is computed once, at `33f895f`, and the suggested global execution order runs items 1–6 *before* item 7. Item 1 explicitly instructs mirroring `ReminderResendForm.tsx`, which itself already contains a raw `oklch()` literal (`:111`). If followed literally, item 1 will add at least one new literal to the tree between the snapshot and item 7's execution — the catalogue must be re-run, not trusted from the plan text.
- **Highest-value proposed test:** a guard test scanning `src/app/booking/manage/**` (not just `(public)/**`) for `--admin-*` custom-property usage introduced via the three primitives, paired with a one-line addition to Phase D's live sweep to screenshot `/booking/manage` before/after the primitives batch. Full spec in §4.
- **Plan claims that did not hold up on verification:**
  1. **Vitest baseline is stale.** Plan §8 states `5 failed / 2214 passed (2219)`. A full run today gives **`5 failed / 2236 passed (2241)`** — 22 more passing tests than the plan's hardcoded figure (same 2 failing files: `admin-access.test.ts`, `ManualBookingForm.test.tsx`). This is exactly the scenario §1 rule 9 / plan §1.8 "baselines are BY IDENTITY, not by count" exists to protect against — confirms the rule's necessity rather than contradicting the plan, but the plan's own §8 text should not be trusted for the *count*.
  2. **"AdminTopNav.tsx... item 3/6's neighbourhood" (§7.7) does not describe a real file overlap.** I checked items 3's and 6's exact file lists (§3.2, §6.4) — neither touches `AdminTopNav.tsx`. The sentence is about a *different*, already-merged commit (`51942b0`, "C-10 Phase B — admin mobile main padding"), unrelated to this plan's items 3/6. See §2 for the real (previously unstated) file collision, which is elsewhere.
  3. **99 files / 677 literals is close but not exact** by my count: raw `grep -c "oklch("` over `src/app/admin/**` + `src/components/ui/**` (excluding `*.test.*`) gives **102 files, 717 raw `oklch(` token occurrences**, 96 distinct value strings. Directionally identical to the plan's 99/677/94, off by a few percent — plausibly explained by the AST tool's box-shadow color-stop handling or file-filter differences. Not material, but an implementer should trust the script's own re-run, not either tally, as the source of truth at execution time.
  - **Everything else checked came back accurate**, several to the decimal: the static analyser's `456 / 377 dark / 79 light / 76 explicit-pair / 380 assumed-surface / 239 unresolved` (§7.4a) reproduced exactly; the token-pair verifier's `92 tokens / 14 ratio comments / 83 unique pairs / 166 checks / 1 failure` (§7.5a) reproduced exactly, including the D8 failure at **3.4134:1** (`--admin-warning` on `--admin-warning-bg`, light); `tsc --noEmit` → 0; `pnpm lint` → 59 errors / 7 warnings in exactly the 6 named files.

---

## 1. Blast-radius analysis — the three shared primitives

### 1.1 `src/components/ui/button.tsx`

**Consumers, exact count:**

| File | In `src/app/admin/**`? | Call sites | Variant used |
|---|---|---|---|
| `src/app/admin/bookings/CopyButton.tsx:20` | yes | 1 (`<Button>`) | `outline` (public-site variant, no literal) |
| `src/app/admin/login/LoginForm.tsx:204` | yes | 1 | `admin-primary` |
| `src/app/admin/password-reset/PasswordResetSubmitButton.tsx:28` | yes | 1 | `admin-primary` |
| `src/app/admin/password-reset/states/Rejected.tsx:33` | yes | 1 | `admin-primary` |
| `src/app/admin/dashboard/dashboard-filters-client.tsx` | yes | 4 (`buttonVariants(...)`, not `<Button>`) | 3× no variant → **defaults to `primary`** (public-site, non-`admin-*`); 1× `outline` |
| `src/app/admin/calendar/PrintButton.tsx:12` | yes | 1 (`buttonVariants(...)`) | `outline` |
| `src/app/booking/manage/ManageBookingForms.tsx:176` | **no — customer-facing** | 1 (`<Button>`) | no variant → **defaults to `primary`** |

**Totals: 7 files, 10 call sites repo-wide; 6 admin files / 9 admin call sites; 1 non-admin, non-public customer file / 1 call site.**

**Variants actually used vs. merely defined:** of the 5 admin-prefixed variants (`admin-primary`, `admin-secondary`, `admin-destructive`, `admin-ghost` — all literal-bearing) and 5 public-site variants (`primary`, `secondary`, `outline`, `ghost`, `link` — literal-free, driven by Tailwind theme colours), **only `admin-primary` and `outline` are used anywhere in the current tree.** `admin-secondary`, `admin-destructive`, `admin-ghost`, `secondary`, `ghost`, `link` are defined but have **zero live call sites** (confirmed by grepping every `variant="..."` string against the codebase — nothing matches those six names). This matters directly for risk: the plan's §7.3 Class 1 example (*"Hovering an outline or ghost button in dark mode paints light text on a near-white fill"*) describes `admin-secondary`/`admin-ghost`'s hover state, which **nothing in the app currently renders**. The bug is real and worth fixing (it's latent, and D2's `admin-destructive`-adjacent finding at `admin-ui-interactions.tsx:342` is a different, live call site — see below), but Phase B's headline urgency for `button.tsx` should be pinned on **D2** (`admin-ui-interactions.tsx:342`, a destructive confirm dialog, live) rather than on the button primitive's own `admin-secondary`/`admin-ghost` variants, which nothing currently exercises.

**Outside `src/app/admin/**`:** yes — `ManageBookingForms.tsx:176`, the customer "Add a note / Cancel booking / Send request" buttons on `/booking/manage`. It uses the **default variant (`primary`)**, which is the literal-free, non-`admin-*` code path (`bg-primary text-primary-foreground shadow-soft hover:bg-primary/90`, line 12–13). **Phase B's substitution work never touches this block** (only `admin-*` variants carry literals), so this specific call site is safe by construction — but this needs to be an explicit, stated fact in the plan, not an inference the implementer has to make.

**Snapshot/DOM tests that would break:** none. No test file exists for `LoginForm.tsx`, `PasswordResetSubmitButton.tsx`, `Rejected.tsx`, `CopyButton.tsx`, `dashboard-filters-client.tsx`, `PrintButton.tsx`, or `ManageBookingForms.tsx`. Repo-wide: `grep -rl "toHaveClass" src --include="*.test.tsx"` returns **nothing** — no test anywhere asserts on a Tailwind class string. `ManualBookingForm.test.tsx` (one of the two known-baseline-failing files) also asserts nothing about className/style.

### 1.2 `src/components/ui/badge.tsx`

**This component is effectively dead in the admin tree.** `grep -rn "from .*ui/badge" src` returns exactly **one** file: `src/app/booking/manage/page.tsx:9` (customer-facing), one call site (`variant="secondary"`).

The reason: admin does not use this `Badge`. It has its own, parallel, **already-clean** status-badge component, `AdminStatusBadge` in `src/app/admin/components/admin-ui.tsx:696`, explicitly commented `// ─── AdminStatusBadge (fully self-contained) ───` — it does not import `ui/badge.tsx` at all, and its own colour lookup tables (`statusBgClasses`/`statusTextClasses`, `admin-ui.tsx:29-49`) are **100% `var(--admin-*)`-driven, zero `oklch()` literals** (confirmed: `grep -c "oklch(" admin-ui.tsx` → 0). `AdminStatusBadge` has **99 call sites across 37 admin files** — it is the real, live status-badge system.

`ui/badge.tsx`'s own doc comment already discloses this: *"The legacy 'default / secondary / outline / accent' variants are preserved for non-admin surfaces that import this component."* Its six named status variants (`confirmed`, `pending`, `cancelled`, `completed`, `attention`, `restricted`, plus their `-sm` siblings) — the ones carrying nearly all of the file's oklch literals — have **zero call sites anywhere in the repo.** `grep -rn 'variant="confirmed"\|variant="pending"\|...'` across all six status-variant names returns nothing.

**Practical consequence for Phase B step 1:** fixing `badge.tsx`'s literals is safe (nothing renders it today with those variants) but **delivers zero observable readability improvement** — it is pure dead-code hygiene, not one of the "biggest readability wins" the plan's §7.7 framing implies when it groups all three primitives together as fixing "Classes 1 and 2 everywhere at once." Recommend the plan say this explicitly, so whoever verifies the batch doesn't go looking for a visible badge.tsx-driven change and conclude the fix didn't work.

The one live consumer, `booking/manage/page.tsx:83-88`, further insulates itself: it passes `className="border-none bg-[var(--rahma-green)]/10 text-[var(--rahma-green)] capitalize"`, and since `cn()` is a `clsx` + `tailwind-merge` composition, every conflicting utility from the `secondary` variant (`border`, `bg-[var(--admin-panel-muted)]`, `text-[var(--admin-body)]`) is overridden by the page's own classes. **The customer page's rendered badge colour does not depend on `badge.tsx`'s variant styling at all**, today or after Phase B (the `secondary` variant carries no raw literal to begin with — it's already `var()`-driven).

**Snapshot/DOM tests:** none exist for `badge.tsx` or `booking/manage/page.tsx`.

### 1.3 `src/components/ui/input.tsx`

This is the one primitive with genuine, non-trivial public-route exposure, and it deserves the most care.

**Consumers:**

| File | Scope | Call sites |
|---|---|---|
| `src/app/admin/login/LoginForm.tsx` | admin | 2 |
| `src/app/admin/password-reset/states/ForgotForm.tsx` | admin | 1 |
| `src/app/admin/password-reset/states/SetNewPassword.tsx` | admin | 2 |
| `src/app/admin/staff/[staffId]/StaffProfileForm.tsx` | admin | 5 |
| `src/app/booking/manage/ManageBookingForms.tsx` (`preferred_date`, `preferred_time`) | **customer-facing** | 2 |

**Totals: 5 files, 12 call sites; 4 admin files / 10 call sites; 1 customer file / 2 call sites.** (`AdminField` in the same file, the labeled-wrapper version admin forms are told to prefer, is admin-only — no public call sites — so its own extra literals at `:116` and `:143` (D3) carry no public-route risk.)

**Unlike `Button` and `Badge`, `Input` has no variant split.** There is exactly one style path (`input.tsx:23-46`), and every one of its colour classes is `--admin-*`-token-driven with an inline literal fallback: `bg-[var(--admin-surface-input,oklch(98.5%_0.005_88))]`, `border-[var(--admin-border-form,oklch(55%_0.022_80))]`, `text-[var(--admin-body,oklch(23%_0.01_143))]`, `placeholder:text-[var(--admin-text-muted,oklch(42%_0.008_143))]`, `focus-visible:border/ring-[var(--admin-focus,oklch(47%_0.095_230))]`, and the raw (no-token) `data-[error=true]:border-[oklch(26%_0.14_25)]`. **This exact styling renders on the customer route** via the two `<Input type="date">` / `<Input type="time">` call sites in `ManageBookingForms.tsx:89,100`.

I traced why this is currently safe, and it is a fact worth stating in the plan rather than leaving implicit:

- `src/styles/tokens.css:1` opens with `:root { ... }`, and its own header comment (`tokens.css:263`) confirms: *"The `:root` block above is shared by the admin tree AND the public marketing site."* Every `--admin-*` token referenced in `input.tsx` (e.g. `--admin-surface-input`, `--admin-body`) is declared in `:root` with the **same value** as the light-theme block (verified: `--admin-surface-input` is `oklch(98.5% 0.005 88)` identically at `:root` line 190, `[data-theme="light"]` line 511, and `@media print` line 607).
- The dark/light *overrides* only apply under `[data-admin-theme-root][data-theme="dark"] ~ *` / `...="light"] ~ *` (`tokens.css:332`, `:452` — general-sibling combinators). `/booking/manage` has no `[data-admin-theme-root]` ancestor anywhere in its tree (confirmed — that wrapper only exists in `src/app/admin/components/ThemeProvider.tsx:105`, mounted from `src/app/admin/layout.tsx:67`). So on the customer route, every `--admin-*` token silently resolves to its **`:root` (= light) value**, unconditionally.
- Net effect: today, `Input`'s rendering on `/booking/manage` is stable, theme-independent, and happens to equal the admin light theme. **This is exactly why it currently "just works,"** and it is also exactly the kind of fact that a substitution done without reading it can quietly break.

**Where the real risk lives, precisely:**
1. **Class 4 cleanup** (stripping `var(--token, <literal>)` fallbacks per §7.6/§7.3) is safe *as long as* every referenced token stays declared in `:root`. All the tokens `input.tsx` currently uses already are. This is not a hypothetical worry — it's a fact to *verify per token*, not assume, if the fallback-stripping pass touches this file.
2. **D3's fix** (the raw `oklch(26%_0.14_25)` on `input.tsx:116,143` becoming `var(--admin-status-cancelled-text)` or equivalent) is also safe by the same logic — that token is declared in `:root` too (confirmed, `tokens.css:155` block, byte-identical to the literal). But per the point above, `input.tsx:116,143` is `AdminField`-only, so this specific fix has **no public-route exposure** regardless.
3. **The one real hazard:** if Phase A ever needs a *brand-new* token for something `input.tsx` uses (none currently identified — all its tokens already exist), §7.6's checklist ("add to every block — `:root`, dark, light, print") is necessary but, for this file specifically, **also implicitly required for the public route to keep rendering at all**, since `:root` is the only block a non-admin page ever sees. The plan's existing checklist item already covers `:root`, so this is not a new requirement to add — but the plan's stated *reason* for requiring `:root` coverage (§7.6: "the print block deliberately forces light values; a token missing there will print wrong") is admin-print-only framing. It should also say: *a token referenced by `input.tsx` that is missing from `:root` breaks `/booking/manage`, a live customer page, not just print.*

**Recommended addition to Phase D (§7.9), concretely:** after the `button.tsx`/`badge.tsx`/`input.tsx` batch lands, screenshot (or run the live-sweep audit function against) `http://localhost:3000/booking/manage?token=<any test token>` in addition to the admin routes, and diff foreground/background colours on the two `<Input>` fields and the status `Badge` against a pre-change capture. This is cheap (one route, no auth, no role matrix) and closes the only gap in the plan's "public site must not be affected" claim that current text doesn't actually cover.

### 1.4 Bonus check: `src/components/ui/textarea.tsx`

Not one of the plan's "3 shared primitives," but it's imported by the same customer file (`ManageBookingForms.tsx:7`) and is worth one line: it has **zero `oklch()` literals** and zero `--admin-*` token references — built entirely from generic Tailwind theme utilities (`border-input`, `bg-background`, `text-foreground`, `border-ring`). Confirmed clean, no action needed, not in scope.

### 1.5 Top-10 literal values — uniformity check

Re-counted directly against the current tree (`grep -rF` per literal, `src/app/admin/**` + `src/components/ui/**`, excluding `*.test.*`):

| Plan's count | My count | Literal | Delta |
|---|---|---|---|
| 171 | 166 | `oklch(26%_0.14_25)` | −5 |
| 74 | 74 | `oklch(95.5%_0.028_20)` | 0 |
| 58 | 58 | `oklch(26%_0.13_55)` | 0 |
| 40 | 40 | `oklch(95%_0.05_65)` | 0 |
| 33 | 32 | `oklch(22%_0.085_155)` | −1 |
| 30 | 30 | `oklch(93.5%_0.038_155)` | 0 |
| 24 | 23 | `oklch(30%_0.02_280)` | −1 |
| 21 | 19 | `oklch(94%_0.008_280)` | −2 |
| 16 | 16 | `oklch(88%_0.045_20)` | 0 |
| 16 | 16 | `oklch(28%_0.12_55)` | 0 |
| 16 | 16 | `oklch(12%_0.01_165)` | 0 |

Small deltas (≤5, mostly 0), likely line-vs-occurrence counting or my exclusion of `*.test.*` vs. the tool's own filter. **Directionally solid — not a "the 18-was-really-14" class error.**

**Uniformity of the #1 literal, `oklch(26%_0.14_25)` (166 occurrences)** — this is the one that most determines whether "mechanical substitution" is actually mechanical:

```
130  text-[oklch(26%_0.14_25)]
 21  border-[oklch(26%_0.14_25)]
  6  hover:text-[oklch(26%_0.14_25)]
  2  text-[oklch(26%_0.14_25)]/85
  2  text-[oklch(26%_0.14_25)]/45
  2  border-[oklch(26%_0.14_25)]/30
  2  focus-visible:border-[oklch(26%_0.14_25)]  /  :border-[oklch(26%_0.14_25)]
  1  text-[oklch(26%_0.14_25)]/75
  1  focus-visible:ring-[oklch(26%_0.14_25)]/30
  1  border-[oklch(26%_0.14_25)]/40
```

Not one flat usage pattern — it appears as text colour, border colour, hover-text, focus-ring, with several alpha modifiers (`/85`, `/75`, `/45`, `/40`, `/30`). A **pure text substring replace** (swap `oklch(26%_0.14_25)` → `var(--admin-status-cancelled-text)` wherever the bracket contents match, leaving the surrounding utility prefix/alpha-suffix untouched) is safe across all of these, because Tailwind's arbitrary-value syntax accepts a `var()` inside any of `text-[...]`, `border-[...]`, `hover:text-[...]`, `focus-visible:ring-[...]`, and `.../NN` alpha suffixes uniformly. That is a genuinely mechanical operation. What is **not** mechanical, and needs a human judgement call the plan doesn't currently ask for: whether reusing one token (named for *text*, per `--admin-status-cancelled-text`) as a **border** colour in 21+ places is the semantically correct token, even though it is visually byte-identical in light mode. Recommend Phase A's per-value classification note this explicitly rather than let "byte-identical ⇒ safe" quietly stand in for "semantically correct."

---

## 2. Execution order — validated, one addition

**§7.7's order (primitives → top-10 → long tail) is endorsed** on readability-win-per-risk grounds: it fixes the two true readability bugs (Classes 1/2) in the smallest, most reviewable diff, before touching 99 files' worth of long tail. §1 above supports this further — `Badge` is dead code and `Input`'s public exposure is provably safe today, so the "ship primitives first, alone" batch is lower-risk than the plan's own framing (which treats all three as equally load-bearing) suggests.

**The `AdminTopNav.tsx` "collision" as stated in §7.7 does not hold up** (see Executive Summary #2) — items 3 and 6's file lists (§3.2, §6.4) never touch `AdminTopNav.tsx`. Recommend striking that sentence or correcting its citation to the real prior commit (`51942b0`).

**A real, previously-unstated file collision exists between items 3/6 and item 7**, in the availability tree — the exact files item 3 and item 6 edit already carry literals item 7's sweep will also touch:

| File (touched by item 3 and/or item 6) | `oklch(` count |
|---|---|
| `src/app/admin/availability/page.tsx` | 7 |
| `src/app/admin/availability/AvailabilityOverridesManager.tsx` | 6 |
| `src/app/admin/staff/[staffId]/availability/lib.ts` | 9 |
| `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx` | 1 |
| `src/app/admin/staff/[staffId]/availability/page.tsx` | 0 |
| `src/app/admin/availability/availability-data.ts` | 0 |

23 literals total, spread across four of the six files items 3/6 will edit for unrelated (correctness, not colour) reasons. The plan's own "Suggested order" table already sequences 3 → 6 → ... → 7 last, which is the right call for this reason even though the plan doesn't say so explicitly: **running item 7's literal substitution on these four files before items 3/6 land would force item 3/6's implementer to re-grep every anchor a second time** (since substitution changes line numbers, and §1.6/§46 already mandate symbol-based re-location — but it's needless churn to invite). Running 7 last, as the plan already does, avoids this. Recommend the plan state this specific reason (rather than the incorrect `AdminTopNav.tsx` one) as the justification for "item 7 last."

**A second, more consequential ordering risk, not currently addressed:** item 1 (position 6, immediately before item 7) explicitly instructs (§1.6): *"Mirror the established pattern exactly"* for a new sibling of `ReminderResendForm.tsx`, next to it on `/admin/emails` (`emails/page.tsx:925`). `ReminderResendForm.tsx:111` itself already contains a raw literal: `bg-[oklch(93.5%_0.038_155)] text-[oklch(22%_0.085_155)] border border-[oklch(70%_0.10_155)]` (a success-state banner). `emails/page.tsx` itself carries 17 literals (all above line 925, i.e. above where the new form mounts — so a developer scrolling nearby for "the established pattern" will see them). SUBAGENT-RULES.md rule 8 ("match each file's existing style") reinforces exactly this instinct. If followed literally, **item 1's new form will ship with at least one new `oklch()` literal**, in a file/component that did not exist when item 7's Phase A catalogue (94 distinct values, computed at `33f895f`) was built.

This is not fatal — Phase C's guard (once live) would eventually catch it, and Phase B's substitution work, if re-run against the tree's actual state at execution time rather than the plan's cited snapshot, would sweep it up too. But as currently written, nothing in the plan tells item 7's implementer to **re-run `measure-admin-contrast.mjs` fresh, immediately before starting Phase A/B**, rather than trusting the plan's own printed 677/99/94 figures (which by then may be stale by whatever items 1–6 added). Recommend adding this as an explicit first step of §7.6.

**Items 3 and 6 are correctly declared as sequential** (§6.7) and correctly kept out of concurrent execution with each other. No issue found there beyond what's already stated.

---

## 3. Per-batch verification — concrete commands and the numbers that must (not) move

For every batch below, run in this exact order. All three verification layers are runnable today (confirmed live, not just described):

```bash
# Layer 1 — static source analyser (fast, no server, no login)
node scripts/measure-admin-contrast.mjs . --json > /tmp/layer1-after.json

# Layer 2 — token-pair proof (fast, no server, no login)
node scripts/verify-admin-token-contrast.mjs . --json > /tmp/layer2-after.json

# Gates by identity
npx tsc --noEmit
pnpm lint
npx vitest run
```

**Confirmed current baseline (re-run today, not copied from the plan):**

| Check | Value | Matches plan? |
|---|---|---|
| Layer 1 total | `456` (377 dark / 79 light), 76 explicit-pair, 380 assumed-surface, **239 unresolved**, 92 tokens, 309 files | exact match |
| Layer 2 | 92 tokens, 14 ratio comments, 0 mismatches, 83 unique pairs, 166 checks, **1 failure**: `--admin-warning` on `--admin-warning-bg` = **3.4134:1** light | exact match |
| `tsc --noEmit` | 0 errors | exact match |
| `pnpm lint` | 59 errors / 7 warnings, in exactly `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}` | exact match |
| `npx vitest run` | **5 failed / 2236 passed (2241)**, 2 failing files | **plan §8 says 2214/2219 — stale by 22 passing tests.** Trust today's re-run, not the plan text, per §1.8's own "by identity" rule. |
| Live sweep total (§7.2b) | 2,615 | not re-run (requires credentials/browser — outside this review's scope; not disputed) |

**After the primitives batch (`button.tsx` + `badge.tsx` + `input.tsx`), specifically:**
- **Layer 1 total must fall** by roughly the number of literal occurrences in these 3 files that are genuine colour pairings (not all 25 literals are "findings" — some are the same pairing counted once per theme). Sanity bound: these 3 files contribute a small fraction of the 456 total; do not expect a large single-batch drop — the bulk is the long tail (Phase B step 3).
- **Layer 2 must stay at exactly 1 failure** (`--admin-warning`) — button/badge/input do not reference `--admin-warning` or `--admin-warning-bg` at all (confirmed: `grep -n "admin-warning" src/components/ui/{button,badge,input}.tsx` → no matches). If Layer 2's failure count changes at all from this batch, something touched a token pair it shouldn't have.
- **Gates must stay at identity**: tsc 0; lint 59E/7W in the *same 6 files*; vitest 5 failed in the *same 2 files* (`admin-access.test.ts` ×2, `ManualBookingForm.test.tsx` ×3) — a new failing test anywhere, even if the total count is unchanged, is a FAIL per SUBAGENT-RULES rule 9.
- **New, not-yet-existing check this batch specifically needs (see §1.3):** render `/booking/manage` (any token — the page 404s gracefully on an invalid one per `InvalidManageLink()`, but a valid test-fixture token renders the real form) and confirm the two date/time `Input` fields and the status `Badge` are visually unchanged from a pre-batch capture. Nothing in the plan's existing Phase D covers this route.

**After the top-10 batch:** Layer 1's total should drop sharply — the plan's own estimate ("~71% of remaining occurrences") is a reasonable target; verify the *specific* ten values' occurrence counts (§1.5's table) each go to (near-)zero in a fresh `measure-admin-contrast.mjs` run, not just that the aggregate fell by roughly the right amount — an aggregate drop that isn't concentrated in the ten target values would indicate the substitution touched the wrong things.

**After each long-tail directory batch:** Layer 1's total strictly decreases; no *increase* in any theme/kind bucket (`dark`, `light`, `explicitPair`, `assumedSurface`, `unresolvedElements`) is acceptable — an increase in `unresolvedElements` specifically would mean a literal was replaced with a *computed* expression the analyser can no longer see (e.g., `` `text-[${tone === 'x' ? 'var(--a)' : 'var(--b)'}]` ``), which defeats both the analyser and the Phase C guard simultaneously — treat any such increase as a hard stop, not a warning.

**On completion (§7.12):** Layer 1 total → 0; Layer 2 → 0 failures (**this requires D8's token-value fix to also be done — it is a separate, reviewed change per §7.5a**, not a substitution, so "Layer 2 → 0" cannot be satisfied by Phase B alone); guard test (Phase C) passes at zero-tolerance, not just ratchet; live sweep (Layer 3, out of this review's scope to re-run) → 0 across all swept role/theme/route combinations.

### The regression tripwire (cheapest single check)

**Proposal: a two-line CI-cheap script that renders nothing and needs no browser** — for every file the substitution batch touches, diff the **light-theme resolved hex** of every `var(--admin-*)` reference against the byte value of the literal it replaced, for every literal classified as "byte-identical to an existing token's light value" (§7.6 class 1 — the ~71% majority per §7.2). Concretely: `verify-admin-token-contrast.mjs`'s existing `parseColour`/`resolveToken` machinery already does exactly this resolution; a 20-line wrapper that takes a `{file, line, oldLiteral, newToken}` substitution log (which the implementer should be keeping anyway, per the plan's own commit-message convention) and asserts `resolve(newToken, "light") === oldLiteral` for every entry **is the cheapest possible check that would catch an implementer who accidentally changed appearance instead of just source** — because §7.7 already establishes light mode as the control ("light-mode rendering must be unchanged... any diff = mis-map"), this converts that prose rule into a machine-checkable one that runs in milliseconds, no server, no login, no screenshots. It complements rather than replaces the two live-diff checks above (Layer 1/2 rerun, `/booking/manage` screenshot) — those catch *reach*, this one catches *correctness of the specific substitution*.

---

## 4. Tests to add, beyond the existing three layers

1. **Component-level: shared primitives render no hardcoded colour.** New file, e.g. `src/components/ui/__tests__/no-hardcoded-colour.test.ts`, modeled directly on the existing anti-drift idiom (`src/app/booking/__tests__/no-google-analytics.test.ts`, `src/content/site/__tests__/canonical-domain.test.ts` — both simple `readFileSync` + string-scan tests with a "finds files to scan" vacuous-pass guard). Assert `oklch(` does not appear in `button.tsx`, `badge.tsx`, or `input.tsx` source text. This is narrower and faster than the Phase C ratchet (below) and should land with the primitives batch itself (§7.7 step 1), not wait for Phase C.

2. **Guard/ratchet against new `oklch(` literals — Phase C, specified concretely.** New file `src/app/admin/__tests__/no-hardcoded-admin-colour.test.ts` (or extend `measure-admin-contrast.test.ts` with a CLI-gate test, since the script already supports `--max-failures` per its `run()` CLI-facing test at `scripts/measure-admin-contrast.test.ts:203`).
   - **Ratchet mechanism:** store the current literal *occurrence* count (not the WCAG-failure count — those are two different numbers; the ratchet should track raw `oklch(` occurrences under `src/app/admin/**` + `src/components/ui/**`, matching §7.2's census, not Layer 1's 456 WCAG-failure figure) in a small JSON/constant checked into the repo, e.g. `scripts/admin-oklch-ceiling.json: { "ceiling": 717 }` (using this review's freshly re-counted baseline, not the plan's possibly-stale 677 — **re-count at the moment Phase C actually starts**, since items 1–6 may have moved it, per §2 above). The test fails if the current count exceeds the ceiling, and a following commit that reduces the true count must also lower the ceiling in the same commit (matching the plan's own "flip to zero-tolerance on completion" instruction).
   - **Disclosed limit (mandatory, per the C-17 precedent's own disclosure style):** *"This is a source-text match. A computed template literal (`` `oklch(${l}% ${c} ${h})` ``), a string built via concatenation, or a value imported from a constant/JSON file will not be caught. It also cannot see `lab()`/`hsl()`/hex literals reintroducing the same problem under a different colour syntax."* State this in the test file's header comment, exactly as `no-google-analytics.test.ts` and `canonical-domain.test.ts` already do for their own limits.
   - This ratchet **also needs to include `src/app/booking/manage/`** given §1's finding — not because that route has literals today, but because it is a live consumer of the primitives, and if a new admin-only `<Button variant="admin-...">` call site were ever accidentally introduced there via copy-paste, no other guard would catch it (the analyser only walks `src/app/admin/**`).

3. **Interaction-state coverage (`hover:`/`active:`/`focus-visible:`/`disabled:`) — the live sweep structurally cannot reach these** (correctly diagnosed by the plan itself, §7.9(a0)). The static analyser (Layer 1) already extracts these prefixes (confirmed: `measure-admin-contrast.mjs`'s comment block at the top of the file explicitly lists `hover:`/`active:`/`focus-visible:`/`data-[…]:`), so the coverage gap is not in extraction — it's in the *fixture test suite* not exercising them as regression cases. Recommend adding to `scripts/measure-admin-contrast.test.ts` (which already has a `describe("AST-based pairing — true positives...")` block, `:36`) a fixture reproducing exactly the shape that already broke once: a themed foreground with a **hardcoded** hover/active/focus-visible background on the same element (the general form of D2, D4, D5, D6 in the defect register) — this is a regression guard for the *tool*, ensuring a future refactor of the analyser doesn't quietly lose interaction-state extraction, which is the one blind spot Layer 3 (live sweep) can never independently confirm.

4. **`--admin-warning` fix, when it lands, needs its own test** — not part of Phase B (§7.5a already correctly says this must be "its own reviewed change with the before/after ratio quoted, not folded into a substitution commit"). Recommend a targeted addition to `scripts/verify-admin-token-contrast.test.ts`'s existing `describe("verifyRatioComments...")` block asserting the specific pair `{fg: "--admin-warning", bg: "--admin-warning-bg", theme: "light"}` resolves to ≥4.5:1 post-fix — a regression guard so this specific, already-found AA failure cannot silently return if the token value is ever touched again.

---

## 5. Explicit non-goals and stop conditions

Things an implementer might reasonably think are in scope, but are not:

- **The active-nav-item defect (D1).** Confirmed again in this review (`AdminTopNav.tsx:295-296`: `bg-[var(--admin-nav-active-bg)] ... text-[var(--admin-nav-active-text)]` — both sides already `var()`-driven, zero literals on this element). **Substitution cannot fix a theme-resolution bug** — there is no literal to substitute. §7.4b already states this correctly and at length; restating here only to make it an explicit stop condition: **if an implementer reaches D1 during the sweep and is tempted to "fix" the nav highlight because it's the single highest-reach defect in the register, they must stop and report, not touch `AdminTopNav.tsx`'s nav-active classes.** The plan's own root-cause candidates (general-sibling combinator scoping, `:root`-only alias declarations) require browser-computed-style investigation, which is explicitly out of this review's tooling and (per the dispatch that produced this plan) belongs to whichever agent does the live/browser work — not the literal-substitution implementer.
- **`admin-secondary`, `admin-destructive` (button), and 8 of `badge.tsx`'s 11 variants** are defined but have zero live call sites (§1.1, §1.2). Fixing their literals is legitimate hygiene but delivers no visible change — an implementer should not expect (or manufacture) a before/after screenshot for these, and should not be alarmed when Phase D's live sweep shows no delta attributable to them.
- **Anything in `src/app/booking/manage/` beyond the two named `Input`/`Badge` verification checks in §1.3 and §3.** This route is customer-facing, carries a bearer token in its URL (per the existing `no-google-analytics.test.ts` comment), and is explicitly flagged elsewhere in this codebase as a route requiring extra care around anything that touches it (that prior guard was about analytics exfiltration, not colour, but the "handle this route carefully" precedent is the same). **Do not edit anything under `src/app/booking/**`** as part of item 7 — the fix belongs entirely in the three primitive files; this route only needs to be *verified*, never *changed*.
- **`tokens.css`'s 16 prose-only contrast claims (D11)**, e.g. *"fails WCAG text contrast at 1.42:1 on canvas; never use as body text"*. §7.5a already correctly scopes this as "a contained follow-up," not part of this plan. **Stop condition:** if the substitution work surfaces a prose claim that looks wrong while touching a nearby literal, log it (per SUBAGENT-RULES rule 4a — "unrelated issue... note it, do not fix") rather than editing the comment inline.
- **Any token *value* change other than `--admin-warning`/`--admin-warning-bg` (D8).** §7.10 already states this ("No token value changes unless a pair provably fails AA"); restated as a hard stop because it's the rule most likely to be violated under time pressure mid-sweep — if a substitution "looks slightly off" against its target, the correct action is to log the delta (per §7.7's own rule) and move on, never to nudge the token's dark or light value to compensate.
- **Route auto-discovery or ROUTES-list changes to `measure-admin-bundles.mjs`** (that's item 5, a disjoint item with its own file). Item 7 must not touch `scripts/measure-admin-bundles.mjs`.

---

## 6. Items 1–6 — gaps and risks the plan currently understates

*(Flagging only — not re-specifying. Full detail on the item 1/item 7 file collision is in §2.)*

- **Item 1** (§1.6): the "mirror the established pattern exactly" instruction for the new manual-send form directly conflicts, in this specific codebase, with item 7's goal — the pattern being mirrored (`ReminderResendForm.tsx`) contains a live `oklch()` literal (`:111`). The plan should either tell item 1's implementer to write the new form using tokens only (a small, explicit deviation from "mirror exactly," scoped to colour classes only), or accept that item 7 must re-scan after item 1 lands rather than trust its own pre-item-1 literal census. Currently neither is stated.
- **Item 2**: low risk, but the plan's own §2.3 fallback path (renumbering sections 7-9 if the Owner insists on deletion) depends on `id="how-long-we-keep-it"` being the *only* internal reference to the section — confirmed true by a source scan (`grep -rn "how-long-we-keep-it"` → one hit, the anchor's own declaration at `privacy/page.tsx:165`), so §2.3's claim holds. No further risk found.
- **Item 3**: correctly identifies the two descending-order queries as the easy-to-invert case (§3.3). No gap found beyond what's stated; the "0 rows today, nothing to observe live" honesty (§3.5) is appropriate and should be preserved verbatim in the final report per §9's instruction.
- **Item 4** (Zone-2, migration-file-only): the plan is explicit and careful about `CREATE INDEX` vs `CONCURRENTLY` (§4.3) and about the executing agent stopping after writing the file. One thing worth flagging: §8's baseline gate list doesn't mention re-verifying `pg_indexes` count as part of the *whole-plan* gate — only §4.3's own per-item check does. If item 4 and item 7 are executed by different agents/sessions, whoever writes the final §9 report needs both pieces of evidence in hand; make sure the migration file and its post-apply confirmation aren't lost between sessions given how far apart items 4 and 7 sit in the suggested order.
- **Item 5**: verified accurate — `ROUTES` is exactly 6 hardcoded entries (`scripts/measure-admin-bundles.mjs:31-44`, confirmed by direct read), and the "no package install needed" claim is credible (the script does its own manifest reconstruction, no analyser dependency in its `import` list). No gap found.
- **Item 6**: correctly sequenced after item 3 (§6.7, confirmed necessary — item 6's grouping logic assumes item 3's secondary sort already makes same-date rows contiguous). The one thing worth flagging: §6.4's "Duplicate, do not share" instruction for the grouping/slicing helper means **two near-identical implementations** will exist in `availability-data.ts` and `staff/[staffId]/availability/lib.ts` — both of which (per §2's table above) already carry `oklch()` literals that item 7 will later touch. An implementer doing item 6 first should be aware their new pure helper functions are unlikely to introduce colour classes (they're data-shaping, not JSX), so this is a low-risk sequencing note, not a real collision — included for completeness since the file-list overlap is real even if the risk is small.

---

## Appendix — commands used to produce this review

```bash
grep -rlE "from ['\"].*ui/(button|badge|input)['\"]" src --include="*.tsx" --include="*.ts"
grep -rn "<Button|<Badge|<Input\b|buttonVariants\(|badgeVariants" src --include="*.tsx"
node scripts/measure-admin-contrast.mjs . --json
node scripts/verify-admin-token-contrast.mjs . --json
npx tsc --noEmit
pnpm lint
npx vitest run
git status --porcelain -- src/ supabase/
git diff -- src/lib/maintenance.ts
```

No file outside this report was modified. No migration applied. No credentials read or referenced.
