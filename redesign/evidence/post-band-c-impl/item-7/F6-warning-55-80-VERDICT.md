# F6-warning-55-80 — Adversarial Verification Verdict

**Verdict: PARTIALLY_DEFECTIVE**

Read-only review against the live repo (no files under src/, scripts/, e2e/, supabase/ were
touched). All 8 checklist items were independently re-derived from the actual files, not
from the proposal's prose. 25 sites across 12 files, 16 distinct literals (15 new tokens +
1 dead fallback), all checked.

## 1. Light byte-identity — PASS

All 15 new-token `lightValue`s are byte-identical (underscore→space converted) to the
literal they replace:

| token | claimed light | literal (converted) | match |
|---|---|---|---|
| `-status-attention-text-muted` | `oklch(30% 0.14 55)` | `oklch(30%_0.14_55)` | yes |
| `-border-print` | `oklch(42% 0.025 80)` | `oklch(42%_0.025_80)` | yes |
| `-status-attention-bg-hover` | `oklch(92% 0.06 65)` | `oklch(92%_0.06_65)` | yes |
| `-status-pending-border-strong` | `oklch(80% 0.07 75)` | `oklch(80%_0.07_75)` | yes |
| `-status-pending-border-vivid` | `oklch(82% 0.09 75)` | `oklch(82%_0.09_75)` | yes |
| `-status-pending-avatar-bg` | `oklch(92% 0.030 80)` | `oklch(92%_0.030_80)` | yes |
| `-status-pending-icon-bg` | `oklch(94% 0.05 75)` | `oklch(94%_0.05_75)` | yes |
| `-status-pending-highlight-bg` | `oklch(95% 0.05 75)` | `oklch(95%_0.05_75)` | yes |
| `-status-pending-chip-icon` | `oklch(55% 0.16 70)` | `oklch(55%_0.16_70)` | yes |
| `-status-attention-icon` | `oklch(40% 0.13 55)` | `oklch(40%_0.13_55)` | yes |
| `-status-pending-icon` | `oklch(40% 0.12 55)` | `oklch(40%_0.12_55)` | yes |
| `-progress-warning` | `oklch(78% 0.13 55)` | `oklch(78%_0.13_55)` | yes |
| `-price-numeral` | `oklch(58% 0.135 72)` | `oklch(58% 0.135 72)` (inline style, already space-form) | yes |
| `-status-attention-pill-hover` | `oklch(90% 0.07 65)` | `oklch(90%_0.07_65)` | yes |
| `-hover-warm` | `oklch(89% 0.014 78)` | `oklch(89%_0.014_78)` | yes |

The 16th literal, `oklch(55% 0.022 80)` (`input.tsx:30`, inside `var(--admin-border-form,
oklch(55%_0.022_80))`), is correctly identified as dead code, not minted: `--admin-border-form`
is declared in `:root` (tokens.css:203) as exactly `oklch(55% 0.022 80)`, so the fallback
can never fire. Verified independently — this is the only one of the 16 literals that is
byte-identical to an *existing* token's light value, and it is the only one treated as a
reuse rather than a mint. Correct call.

## 2. Role agreement — PASS

Every site's Tailwind utility prefix (or inline-style property) agrees with what its token
paints. No `text-` site takes a `-bg`/border token and no `bg-`/`border-` site takes a
foreground-only token:

- 4× `text-[oklch(30%_0.14_55)]` (calendar/page.tsx:1793/1796/1843/1846) → `-text-muted`, a
  text role — match.
- 3× `print:border-[oklch(42%_0.025_80)]` → `-border-print`, a border role — match.
- 2× `hover:bg-[oklch(92%_0.06_65)]` → `-bg-hover`, a bg role — match.
- 2× `border-[oklch(80%_0.07_75)]` (`DuplicateWarningBanner.tsx:7`, `lib.ts:44`) →
  `-border-strong`, a border role — match.
- 2× `border-[oklch(82%_0.09_75)]` → `-border-vivid`, a border role — match.
- `admin-scalable-lists.tsx:562` `hover:bg-` and `clients/page.tsx:922` `shadow-[0_1px_0_...]`
  → `-hover-warm` — a background role and a shadow-rim-colour role sharing one token; both
  are genuinely paint-a-colour roles, no fg/bg inversion. Disclosed by the proposal, and
  correct.
- `AuditEventCard.tsx:32` `text-` (icon `className`, read via `currentColor` by the Lucide
  `<Pencil>` — confirmed no explicit `stroke`/`fill` override) → `-chip-icon` — match.
- `AuditEventCard.tsx:61` `bg-` → `-avatar-bg` — match.
- `AuditEventCard.tsx:109` `bg-` (on a `<mark>`) → `-highlight-bg` — match.
- `ProfileCompletionNudge.tsx:67` `bg-` → `-icon-bg` — match.
- `event-row.tsx:172` `hover:bg-` → `-pill-hover` — match.
- `staff/page.tsx:698` `text-` (Icon `className`) → `-attention-icon` — match.
- `staff/page.tsx:700` `text-` (Icon `className`) → `-pending-icon` — match.
- `staff/page.tsx:828` `bg-` (dot fill) → `-progress-warning` — match.
- `BookingDetailSidebar.tsx:138` `style.color` → `-price-numeral` — match; inline styles
  resolve `var()` normally, no canvas/SVG pre-resolution context.
- `input.tsx:30` `border-[var(--admin-border-form,...)]` → reused `-border-form`, dropping
  the dead fallback — match.

No `--admin-on-primary`-style inversion trap present in this family.

## 3. Find-string exactness — PASS, count confirmed: 25 sites / 16 distinct literals

Opened every one of the 19 file:line sites directly and confirmed the `find` string verbatim
— underscore formatting, no stray `/NN` opacity modifier after the closing bracket, no
ambiguity (never occurs twice on a line, never a prefix of a longer bracket expression):

- `calendar/page.tsx:1545/1718/1728` — `print:border-[oklch(42%_0.025_80)]`, once each,
  immediately followed by `print:shadow-none` / `print:bg-transparent`.
- `calendar/page.tsx:1785/1835` — `hover:bg-[oklch(92%_0.06_65)]`, once each.
- `calendar/page.tsx:1793/1796/1843/1846` — `text-[oklch(30%_0.14_55)]`, once each (not a
  substring collision with the adjacent `text-[0.6875rem]` size class — different bracket).
- `DuplicateWarningBanner.tsx:7`, `lib.ts:44` — `border-[oklch(80%_0.07_75)]`, once each,
  each the entire RHS of a `const X = "...";` string.
- `EmptyState.tsx:55`, `ProfileCompletionNudge.tsx:62` — `border-[oklch(82%_0.09_75)]`, once
  each.
- `admin-scalable-lists.tsx:562` — `hover:bg-[oklch(89%_0.014_78)]`, once.
- `clients/page.tsx:922` — `shadow-[0_1px_0_oklch(89%_0.014_78)]`, once.
- `AuditEventCard.tsx:32/61/109` — `text-[oklch(55%_0.16_70)]`, `bg-[oklch(92%_0.030_80)]`,
  `bg-[oklch(95%_0.05_75)]`, once each.
- `ProfileCompletionNudge.tsx:67` — `bg-[oklch(94%_0.05_75)]`, once.
- `event-row.tsx:172` — `hover:bg-[oklch(90%_0.07_65)]`, once (line 171's danger hover and
  line 173's restricted hover are different literals, no collision).
- `staff/page.tsx:698/700/828` — `text-[oklch(40%_0.13_55)]`, `text-[oklch(40%_0.12_55)]`,
  `bg-[oklch(78%_0.13_55)]`, once each.
- `BookingDetailSidebar.tsx:138` — `oklch(58% 0.135 72)` (bare, inline-style form), once.
- `input.tsx:30` — `border-[var(--admin-border-form,oklch(55%_0.022_80))]`, once, parens
  balanced exactly as in source (no space after the comma).

Independent fresh `Grep` of `src/` for each of the 16 literal patterns turned up exactly the
claimed occurrence count for every one — no missed site, no extra site, no phantom match.

## 4. Line drift — PASS

Every one of the 19 stated file:line locations still holds against the current working tree,
confirmed by direct `Read`/`Grep`. No drift.

## 5. Dark-value direction — PASS

Spot-verified direction against each token's `nearestExistingFamily`:

- `-text-muted`: light 30 (vs base attention-text's 26 — lighter, i.e. closer to the L95
  bg, correctly *less* prominent) → dark 86 (vs base's 90 — darker, closer to the L30 dark
  bg, correctly *less* prominent in dark too). Direction consistent both ways.
- `-bg-hover`: light 92 (darkens vs base bg's 95, hover-darkens-in-light) → dark 33
  (lightens vs base bg's 30, hover-lightens-in-dark). Confirmed by ratio: dark base-bg vs
  dark canvas = **1.39:1** (recomputed), dark hover vs dark canvas = **1.54:1** (recomputed)
  — hover is measurably *more* prominent in dark, correct direction.
- `-pill-hover`: light 90 (Δ−5, darker than `-bg-hover`'s Δ−3) → dark 35 (Δ+5, lighter than
  `-bg-hover`'s Δ+3) — ordering preserved in both directions as claimed ("punchier").
- `-border-strong` / `-border-vivid`: both invert light-near-white → dark-mid-gray in the
  same shape as the real `--admin-status-pending-border` (light 88 → dark 43), and both
  read as *more* UI-contrast than the base border in both themes (recomputed base border
  dark ratio vs dark panel = **2.12:1** exactly matching the proposal's own cited figure;
  `-strong` dark = 2.97:1, `-vivid` dark = 2.71:1 — both above the base, correct).
- `-avatar-bg` / `-icon-bg` / `-highlight-bg`: all light ~92–95 → dark ~29–31, matching the
  bg-tint convergence shape of the real status-\*-bg tokens (light ~94–96 → dark ~28–30).
- `-chip-icon`: light 55 → dark 67. Recomputed the claimed direct shape-transfer from
  `--admin-chart-status-pending` (light 70→dark 82, ΔL=+12, C-ratio=0.84375, ΔH=+5) applied
  to light 55/0.16/70: gives dark L=67, C=0.135, H=75 — **exact arithmetic match** to the
  proposed dark value.
- `-attention-icon` / `-pending-icon` / `-progress-warning` / `-price-numeral`: all lighten
  from light theme to dark theme, correct direction for a standalone fill/icon that must
  stay visible as the panel goes from near-white to near-black.
- `-border-print`: light 42 → dark 45 — a small increase, correct on its own terms (a
  darkish gray needs to sit *below* a near-white light panel and *above* a near-black dark
  panel; 45% clears the dark panel's 22% adequately). See Finding 1 below for why this
  token's direction is almost beside the point.

No token moves the wrong way.

## 6. Ratio arithmetic — PASS, all 15 reproduce exactly (once resolved to the correct scope)

Wrote a throwaway script (`%TEMP%/.../scratchpad/verify-f6.mjs`, outside the repo) that
imports `resolveColour`, `contrastRatio`, `parseTokensCss` directly from the shipped
`scripts/verify-admin-token-contrast.mjs`, injects the 15 proposed token values into the
real dark/light scopes parsed from `src/styles/tokens.css`, and recomputes every stated
ratio.

Every ratio comment in tokens.css's existing convention is attached to the **dark**
declaration and measured in the **dark** scope (confirmed against 7 existing examples,
e.g. `--admin-danger-solid: ... /* 7.12:1 vs on-primary */` sits in the `[data-theme="dark"]`
block, not `:root`). Computed against the *light* scope first by mistake and got large,
alarming mismatches (deltas of +3 to −7.65); recomputed against the **dark** scope per that
same convention and every one of the 15 ratios reproduced to within ±0.00–0.01:

```
-text-muted     vs -attention-bg   [dark] stated 8.91   actual 8.91   OK
-border-print   vs -panel          [dark] stated 2.32   actual 2.32   OK
-bg-hover       vs -canvas         [dark] stated 1.54   actual 1.54   OK
-border-strong  vs -panel          [dark] stated 2.97   actual 2.97   OK
-border-vivid   vs -panel          [dark] stated 2.71   actual 2.71   OK
-avatar-bg      vs -pending-text   [dark] stated 10.82  actual 10.82  OK
-icon-bg        vs -pending-text   [dark] stated 10.47  actual 10.47  OK
-highlight-bg   vs -pending-text   [dark] stated 10.18  actual 10.18  OK
-chip-icon      vs -panel          [dark] stated 5.67   actual 5.67   OK
-attention-icon vs -panel          [dark] stated 10.17  actual 10.17  OK
-pending-icon   vs -panel          [dark] stated 10.59  actual 10.59  OK
-progress-warning vs -panel        [dark] stated 9.70   actual 9.70   OK
-price-numeral  vs -canvas         [dark] stated 10.02  actual 10.02  OK
-pill-hover     vs -canvas         [dark] stated 1.66   actual 1.66   OK
-hover-warm     vs -panel          [dark] stated 1.54   actual 1.54   OK
```

Every `ratioAgainst` name resolves to a real, existing token (`--admin-status-attention-bg`,
`--admin-panel`, `--admin-canvas`, `--admin-status-pending-text`) — none dangling.

## 7. Completeness — PASS

Independently fresh-`Grep`'d all of `src/` for `oklch(...)` with hue in the 55–82 range and
got exactly the 16 literals in the proposal, with exactly the claimed occurrence counts
(4+3+2+2+2+2+1×10 = 25), cross-checked a second time against `TAIL-CENSUS.md`'s
independently-generated per-literal counts (lines 177, 228, 252, 275, 286, 332, 422, 462,
492, 605, 656, 711, 721, 741, 542, 803) — identical on every count. Nothing missing, nothing
extra, no literal wrongly assigned to this family (`TAIL-CENSUS.md` has zero other hue
55–82 entries).

## 8. The unasked question — 1 finding, otherwise clean

- **Public-page leakage**: all 12 touched files live under `src/app/admin/**` or
  `src/components/ui/input.tsx` (shared, but its touched line only drops a dead fallback —
  no behaviour change on the public `/booking/manage` consumer of `<Input>`). No touched
  literal reaches a public route.
- **Inline-style validity**: `BookingDetailSidebar.tsx:138`'s `style={{ color: "oklch(...)" }}`
  **can** take a `var()` — confirmed this is a plain DOM `<p>` inline style, not a
  canvas/SVG-attribute context that would need a pre-resolved value. The proposed
  `replace: "var(--admin-price-numeral)"` is valid.
- **Test coverage**: grepped the whole repo (not just `src/`) for all 16 literal patterns —
  zero hits in any `*.test.*`/`*.spec.*` file or `e2e/**`. Only source files and the
  redesign evidence/plan docs reference them. No test would break.
- **`derivePairs()` auto-enrollment side effect**: `--admin-status-attention-text-muted` is
  the only one of the 15 new tokens whose name matches `scripts/verify-admin-token-contrast.mjs`'s
  `/text|body|heading|muted/i` auto-sweep (it matches on *both* "text" and "muted"), so once
  minted it will be automatically checked against all 4 `REAL_SURFACES` in both themes by
  the CI gate. Ran that exact check with the shipped `resolveColour`/`contrastRatio`: all 8
  checks (4 surfaces × 2 themes) pass at 9.99:1–14.03:1, comfortably above AA. Not a
  regression, but the proposal's own notes never mention this side effect — flagging for
  the record, matching the same class of thing the F4 verdict flagged.
- **Finding 1 (major) — `--admin-border-print`'s "inert" claim is not supported by
  anything in the deliverable.** See below.

## Findings

### Finding 1 (major) — `--admin-border-print`: the dark value's claimed unreachability
depends on a print-block edit that appears nowhere in this deliverable

**Where**: `src/styles/tokens.css` — the `@media print { :root, [data-theme="dark"],
[data-theme="light"], ... }` block, `tokens.css:625-731`. Consumed at
`src/app/admin/calendar/page.tsx:1545,1718,1728` via `print:border-[var(--admin-border-print)]`.

**What**: The proposal's `ratioComment` for this token reads *"inert: @media print always
resolves the light value first"*, and its rationale states as present-tense fact that
*"tokens.css's own @media print block forces every --admin-\* token (including this one)
back to its light value across :root/dark/light selectors simultaneously."* I read the
actual `@media print` block start to finish (tokens.css:625-731): it is not a wildcard reset
— it explicitly re-declares roughly 90 named custom properties one by one, and
`--admin-border-print` is not among them, because it does not exist in `tokens.css` yet. The
proposal's `tokens` JSON schema supplies only `lightValue`/`darkValue` (no `printValue`
field, for this or any of the other 14 tokens), and none of the 19 `sites` edits touch the
`@media print` block. So nothing in this deliverable actually instructs anyone to add
`--admin-border-print: oklch(42% 0.025 80);` inside that block. The claim describes an
outcome, not an instruction — and today, before that instruction is carried out, the claim
is false of the file as it stands.

**Failure scenario**: An admin currently viewing the calendar in `data-theme="dark"` prints
(Ctrl+P / the browser's print dialog) without switching to light mode first. If whoever
applies this proposal reads only the `sites` find/replace list and the `tokens` light/dark
values — the literal shape of this deliverable — and does not separately know (from reading
the surrounding 90 tokens) that every `--admin-*` token also needs a mirrored entry inside
`@media print`, the three `print:border-[var(--admin-border-print)]` sites resolve the
custom property from whichever theme block is actually in effect (`[data-theme="dark"]`,
since `@media print` only restricts the properties it explicitly lists, not the ones it
doesn't). The printed calendar card / status-pill border would render `oklch(45% 0.020 80)`
(the dark value) instead of `oklch(42% 0.025 80)` (light) — a small but real violation of
the file's own documented invariant, stated a few lines above the print block itself:
"Print always renders the light palette... which makes the :root arm a deliberate no-op."
The proposal's own 2.32:1 ratio comment is also scope-dependent on this: it is the *dark*
value's contrast vs the *dark* panel (confirmed exactly by recomputation), not a light-mode
print measurement, despite being introduced as evidence for "inert" print behaviour.

**Mitigating context, disclosed for balance**: every one of the ~90 *existing* `--admin-*`
tokens in `tokens.css` does carry an identical `@media print` entry mirroring its light
value (verified by reading the full print block), so an implementer following that
established, 100%-consistent precedent — rather than only the literal contents of this JSON
— would very likely add it correctly. This is why the verdict is PARTIALLY_DEFECTIVE and not
DEFECTIVE: the gap is narrow (1 of 16 literals), the visual delta if it did leak is small
(L42 vs L45, both muted greys), and the fix is mechanical. But the proposal asserts a fact
about the current file that is not true, and supplies no explicit instruction to make it
true — which is exactly the kind of gap this checklist's item 8 exists to catch.

**Fix**: Add `--admin-border-print: oklch(42% 0.025 80);` (no ratio comment, matching the
established convention that only the dark declaration carries one) to the `@media print`
block in `tokens.css`, alongside the other ~90 entries, before or as part of applying this
family's `:root`/`[data-theme="dark"]`/`[data-theme="light"]` edits.

## What was verified (methods)

- Direct `Read` of every file at every claimed line (19 distinct file:line locations).
- Fresh `Grep` of `src/` for all 16 literal patterns and for the broader hue-55–82 `oklch()`
  range, independent of `TAIL-CENSUS.md`, to confirm completeness both ways.
- Read `src/styles/tokens.css` in full (all four blocks, 827 lines) to confirm the four-block
  convention, the print-block's exhaustive (non-wildcard) shape, and every existing token
  value used as a comparison basis.
- A throwaway Node script (`%TEMP%/.../scratchpad/verify-f6.mjs` and `verify-f6-pairs.mjs`,
  outside the repo) importing `resolveColour`, `contrastRatio`, `parseTokensCss` directly
  from the shipped `scripts/verify-admin-token-contrast.mjs`, run against the real
  `src/styles/tokens.css` with the 15 proposed tokens injected into both scopes, to recompute
  all 15 measured ratios (first against the wrong — light — scope, which mismatched badly,
  then against the dark scope per the file's own established comment convention, which
  matched exactly) and to check the one auto-enrolled token against all 4 real surfaces in
  both themes.
- Grep across the whole repo (not just `src/`) for every literal, to find non-`src/`
  references (only redesign evidence/plan docs) and confirm zero test-file hits.
- Cross-checked occurrence counts against the independently-generated `TAIL-CENSUS.md`.
