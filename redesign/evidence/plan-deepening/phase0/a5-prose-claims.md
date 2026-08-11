# a5 — Prose contrast claims in `tokens.css` (Step 0.5b)

Read-only audit. No file under `src/`, `scripts/`, `e2e/`, `supabase/` was modified. Every ratio below
was independently recomputed by importing the real, unmodified `oklchToRgb` / `contrastRatio` /
`resolveColour` functions from `scripts/verify-admin-token-contrast.mjs` into a throwaway script run from
the session scratchpad (`node --json`-style verification, not hand arithmetic, except where noted as a
manual WCAG-formula cross-check). `node scripts/verify-admin-token-contrast.mjs --json` was also run
directly (read-only, permitted) to get the tool's own current baseline.

Repo state: branch `master`, tree dirty only in the pre-existing documented ways.

---

## 1. Independent count — both figures, verified from scratch

### 1a. Inline machine-readable `/* N:1 vs X */` comments

Read every line of `tokens.css` (1-730) directly (not trusting the tool, which has a proven print-block
bug — see §7.5a). Found by manual line-by-line scan, cross-checked against `grep -n "^\s*--admin-.*:1"`:

| # | Block | Line | Token | Comment |
|---|---|---|---|---|
| 1 | root | 112 | `--admin-danger-text-strong` | `/* 9.21:1 vs danger-bg-strong */` |
| 2 | root | 113 | `--admin-warning-text-strong` | `/* 10.71:1 vs warning-bg-strong */` |
| 3 | dark | 367 | `--admin-danger-text-strong` | `/* 9.30:1 vs danger-bg-strong */` |
| 4 | dark | 368 | `--admin-warning-text-strong` | `/* 9.41:1 vs warning-bg-strong */` |
| 5 | dark | 425 | `--admin-danger-solid` | `/* 7.12:1 vs on-primary */` |
| 6 | dark | 426 | `--admin-danger-solid-hover` | `/* 10.02:1 vs on-primary */` |
| 7 | dark | 437 | `--admin-sparkline-stroke` | `/* 7.80:1 vs --admin-panel */` |
| 8 | light | 477 | `--admin-danger-text-strong` | `/* 9.21:1 vs danger-bg-strong */` |
| 9 | light | 478 | `--admin-warning-text-strong` | `/* 10.71:1 vs warning-bg-strong */` |
| 10 | print | 573 | `--admin-danger-text-strong` | `/* 9.21:1 vs danger-bg-strong */` |
| 11 | print | 574 | `--admin-warning-text-strong` | `/* 10.71:1 vs warning-bg-strong */` |

**Count = 11, exactly matching the plan's corrected figure (root 2 + dark 5 + light 2 + print 2 = 11).**
Confirmed the print block genuinely has its own 2 (bypassed the tool's `indexOf("@media print")` bug by
extracting the real block with `css.indexOf("@media print {")`, requiring the literal brace — the real
print block's `--admin-danger-text-strong` / `--admin-warning-text-strong` values are byte-identical to
root/light's, so their ratios are also 9.19/10.71, both genuinely matching their stated comments). **The
tool's own `--json` output currently reports "14 found" — reproduced live this session
(`ratioCommentsFound: 14`) — confirming §7.5a's finding still holds: 3 of those 14 are the dark block's
5 comments double-counted under a false "print" label** (the tool's JSON literally repeats the dark
block's 5 `{block:"dark",...}` entries as 5 `{block:"print",...}` entries — verified in the raw JSON).

### 1b. Prose claims

Grepped the whole file for `\d+(\.\d+)?:1|WCAG|fails|AA\b|contrast|clears` and read every hit in context.
Two scope decisions had to be made explicit (the plan never states them, but they are necessary to reach
16 — reporting this as a methodology gap in the plan, not just confirming a number):

1. **Admin-only.** Three more comment blocks with numeric ratio claims exist at root lines 4-6, 9-14 and a
   qualitative one at 20-24, all attached to `--rahma-*` (public-site) tokens, not `--admin-*`. ITEM 7 /
   Phase 0 is explicitly admin-only in scope, and the existing tool's own token regex (`--admin-[a-z0-9-]+`)
   already excludes `--rahma-*` structurally. **Excluded from the 16 for that reason — not overlooked.**
   (Sanity-checked anyway, for completeness — see §6: all 5 numeric `--rahma-*` claims are accurate.)
2. **One claim = one distinct fg/bg pair or one distinct general assertion**, with one exception: the
   6-way chart-status range ("All six sit 5.55–9.75:1") is counted as **one** aggregate claim, not six,
   because it is stated as a single range over the whole family, not six individual numbers.

Under those two rules, the count is **exactly 16** — see the full table in §2. This is a genuine
confirmation, not a rubber stamp: under the *alternative* natural reading (count every individual number,
including the historical/superseded `--rahma-green` value and each of the six chart tokens separately) the
true count is **23**, and under "one comment block = one claim" it is **11**. The plan's "16" is real and
defensible under rule (1)+(2) above, but the plan never states that convention, so an implementer applying
a different (equally reasonable) counting rule would get a different number. **Recommend the corrected
plan spell out the counting convention**, not just assert "16".

---

## 2. Full inventory of the 16 prose claims, each independently verified

Verified by resolving the named tokens against the correct theme scope (root/light/dark as stated) using
the real `resolveColour`/`contrastRatio` functions imported unmodified from
`scripts/verify-admin-token-contrast.mjs`. WCAG 2.1 relative-luminance formula throughout — no other
formula used anywhere in this report.

| # | Line | Verbatim claim | fg / bg / scope | Stated | **Actual** | Verdict |
|---|---|---|---|---|---|---|
| 1 | 79 | "lifts to AAA 7.2:1 vs white for primary buttons + active states" | `--admin-primary` vs `white`, root | 7.2 (AAA) | **6.972** | **MISMATCH** (Δ −0.23; also does not actually clear the AAA 7:1 bar) |
| 2 | 89 | "fails WCAG text contrast at 1.42:1 on canvas; never use as body text" | `--admin-accent` vs `--admin-canvas`, root | 1.42 | **2.166** | **MISMATCH** (Δ +0.75; still fails AA either way, warning's *intent* still holds, the *number* doesn't) |
| 3 | 105 | "the existing --admin-success which passes AA at 4.56:1" | `--admin-success` vs `--admin-success-bg-strong`, light | 4.56 | 4.545 | match (Δ −0.015) |
| 4 | 107 | "mixing -bg-strong with the legacy text fails WCAG" | `--admin-danger`/`--admin-warning` vs their own `-bg-strong`, no theme stated | fail (no number, no theme) | light: danger 4.075 (fail ✓), warning 2.851 pre-D8 / 3.941 post-D8 (fail ✓ either way); **dark: danger 5.845 (PASS), warning 7.460 (PASS)** | **PARTIAL** — true only in light; the unconditional wording is false for dark |
| 5 | 172 | "danger 5.39:1" | `white` vs `--admin-danger`, root | 5.39 | **5.600** | **MISMATCH** (Δ +0.21) |
| 6 | 172 | "warning 4.71:1" | `white` vs `--admin-warning`, root | 4.71 | **3.653** (pre-Step-0.2) / **5.051** (post-Step-0.2, light) | **MISMATCH both before and after** — see §3, this is the one Phase 0 changes the underlying number of |
| 7 | 173 | "info 7.18:1" | `white` vs `--admin-info`, root | 7.18 | **6.972** | **MISMATCH** (Δ −0.21) |
| 8 | 347 | "it clears 4.5:1 as a link/label ON the dark panel" | `--admin-primary` vs `--admin-panel`, dark | ≥4.5 (no exact number) | 8.237 | match (comfortably clears) |
| 9 | 420 | "white-on-fill would land at ~1.5:1" | `white` vs `--admin-primary`, dark (hypothetical, not a live pairing) | ~1.5 | **2.109** | **MISMATCH** (Δ +0.6, well outside "~") |
| 10 | 420 | "8.88:1 on the dark primary fill" | `--admin-action-primary-text` vs `--admin-primary`, dark | 8.88 | 8.928 | match (Δ +0.048) |
| 11 | 428 | "All six sit 5.55–9.75:1 against --admin-panel" | 6× `--admin-chart-status-*` vs `--admin-panel`, dark | range 5.55–9.75 | **actual range 5.566–9.812** | **MISMATCH on the upper bound** (true min ≥ stated min, fine; true max 9.812 > stated max 9.75) |
| 12 | 429 | "the closest luminance pair is 1.04:1 (completed/unknown)" | derived: min over C(6,2)=15 dark pairs | 1.04, pair = completed/unknown | 1.041, pair = completed/unknown | match, identity and value both confirmed |
| 13 | 430 | "which matches the light set's own closest pair (1.05:1)" | derived: min over C(6,2)=15 light pairs (pair not named in the comment) | 1.05 | 1.0496, pair = confirmed/unknown | match |
| 14 | 443 | "white 16.5:1" | `white` vs `--admin-nav-bg`, dark | 16.5 | 16.420 | match (Δ −0.08) |
| 15 | 443 | "the .84 mint 9.74:1" | `--admin-nav-surface-link` vs `--admin-nav-bg`, dark | 9.74 | **9.512** (alpha-composited — see §4) | **MISMATCH** (Δ −0.23) |
| 16 | 443 | "the .72 mint 7.70:1" | `--admin-nav-surface-link-icon` vs `--admin-nav-bg`, dark | 7.70 | **7.310** (alpha-composited — see §4) | **MISMATCH** (Δ −0.39) |

**9 of 16 claims are measurably wrong today** (#1, 2, 5, 6, 7, 9, 11, 15, 16), one is scope-incomplete
(#4), and 6 match within the tool's own existing ±0.15 tolerance (#3, 8, 10, 12, 13, 14). This is the
headline finding: **unlike the 11 inline comments (all of which the tool already proved accurate,
§7.5a), the prose layer is substantially less reliable — exactly the risk class Step 0.5 exists to close.**
Only one of the 9 mismatches (#6) is *caused* by Phase 0's own edits; the other 8 are **pre-existing**,
found by this audit, and will make a newly-added prose checker report red on day one unless corrected in
the same commit.

---

## 3. What Phase 0 (Steps 0.1 / 0.2) specifically invalidates or newly puts at risk

**Step 0.2** changes light+print `--admin-warning` from `#b77900` → `#986400`.
- Claim #6 ("warning 4.71:1"): pre-fix actual 3.653 (and note the claim's own words — "exceed WCAG
  4.5:1" — were already false pre-fix, since 3.65 < 4.5); post-fix actual **5.051**. Neither matches the
  stated 4.71, but post-fix at least makes the pass/fail verdict ("exceeds 4.5:1") true.
- Claim #4's warning sub-case: light `--admin-warning` vs `--admin-warning-bg-strong` moves 2.851 → 3.941.
  Still fails 4.5 either way — the qualitative "fails WCAG" verdict for this specific sub-pair is
  unaffected by Step 0.2 (stays true), only the underlying number moves.

**Step 0.1** de-aliases `--notif-badge-critical-bg` / `-warning-bg` / `-info-bg` (3 of the 11 aliases) into
real per-theme values. This is the most important finding in this audit, **not previously stated this
precisely anywhere in the existing evidence chain**: `root-cause-D1.md` §7 already flagged that a *naive*
per-theme copy for `--notif-badge-warning-bg` specifically would be unsafe (dark `--admin-warning` is a
light text-tone, wrong as a solid white-text fill) — **this audit confirms the same failure mode applies to
all three, not just warning, and quantifies it:**

| Badge (white fg) | dark `--admin-{danger,warning,info}` raw value | **contrast if naively copied** |
|---|---|---|
| critical (`--admin-danger` dark) | `oklch(76% 0.130 25)` | **2.256:1** |
| warning (`--admin-warning` dark) | `oklch(84% 0.135 82)` | **1.655:1** |
| info (`--admin-info` dark) | `oklch(79% 0.088 240)` | **1.903:1** |

All three would badly fail AA in dark theme if Step 0.1 de-aliases these 3 tokens by simply copying
`--admin-danger`/`--admin-warning`/`--admin-info`'s existing dark values (which is what "replace each alias
with a real value in each theme block" reads as, taken literally). **⚠️ Recommend Step 0.1's implementer
be told explicitly, before touching these three: they need their own dedicated fill-safe per-theme values
(the existing `--admin-danger-solid` / `--admin-danger-solid-hover` pair is the precedent for "a distinct
solid-fill tone, not the text tone, for use under white text"), not a straight per-theme copy of their
alias target.** This is a genuine correctness risk for Step 0.1 as currently scoped, surfaced by trying to
verify claim #7 (info) and #6 (warning) — not something my assignment (prose claims) is authorized to
fix, but it must be flagged loudly to whoever executes Step 0.1, because doing it naively would pass Layer
2 (which never checked dark before either) while making dark-theme badges dramatically worse than today's
already-broken frozen value.

**None of the other 14 claims involve any of the 11 aliased tokens, `--admin-warning`, or
`--admin-warning-bg`/`-bg-strong`'s light value** — confirmed by cross-referencing every fg/bg in the table
against §7.5b's 11-token list and Step 0.2's two touched declarations. They are unaffected by Phase 0's
mechanism (their mismatches, where they exist, are pre-existing and unrelated).

---

## 4. A parser bug this audit found and that the extension must fix: `resolveColour` drops alpha

`resolveColour`'s `rgbMatch` branch (`verify-admin-token-contrast.mjs:111-112`) captures only the first 3
numbers of `rgba(r, g, b, a)` and silently discards `a`. This is invisible today because no *checked* pair
currently uses a translucent colour — but claims #15/#16 do: `--admin-nav-surface-link` is
`rgba(209, 234, 223, 0.84)` and `--admin-nav-surface-link-icon` is `rgba(209, 234, 223, 0.72)`
(`tokens.css:445-446`/`531-532`/`631-632`). Naively resolved (current behaviour), **both compute to the
identical opaque `rgb(209,234,223)`**, giving contrast **12.937:1 for both** — a false, and identical,
number for two claims the source explicitly states are different (9.74 vs 7.70). Once alpha-composited
against the actual background (`--admin-nav-bg` dark, `oklch(24% 0.010 75)` → `rgb(34,31,26)`) using
standard "over" compositing (`result = α·fg + (1−α)·bg` per channel), the values become **9.512** and
**7.310** — much closer to the source's own 9.74/7.70 (and confirms the original comment's author *did*
composite correctly by hand; the tool just can't reproduce that today). **The prose-claim extension must
alpha-composite before comparing, or it will report a false, and misleadingly *identical*, mismatch for
both claims.** This is scoped to the new prose-claims code only (see §7) — not a change to the shared
`resolveColour` used by the existing 1b/1c passes, since no currently-checked pair hits this path (surgical
change, per the task's own instruction not to touch anything beyond what's needed).

---

## 5. Exact before/after text for every comment that needs correcting

All four are additive/value-only text edits inside existing comments — no CSS declaration line changes,
no logic changes. Presented as literal find/replace pairs.

### 5.1 `tokens.css:79` (root, `--admin-primary`) — pre-existing, not Phase-0-caused

```diff
-   * brand #127ebe lifts to AAA 7.2:1 vs white for primary buttons + active states. */
+   * brand #127ebe lifts to 6.97:1 vs white (AA; short of the 7:1 AAA bar) for
+   * primary buttons + active states. */
```

### 5.2 `tokens.css:89` (root, `--admin-accent`) — pre-existing, not Phase-0-caused

```diff
-   * fails WCAG text contrast at 1.42:1 on canvas; never use as body text. */
+   * fails WCAG text contrast at 2.17:1 on canvas; never use as body text. */
```

### 5.3 `tokens.css:169-173` (root, the three `--notif-badge-*-bg` declarations) — **Phase-0-affected, must land after both Step 0.1 and Step 0.2**

```diff
   /* Notification-bell badge severity tints (R4 redesign 2026-05-21).
    * Separate family from AdminStatusBadge: bell badge is rendered at ~11px on a
    * saturated background, so reuses the canonical danger/warning/info hues with
-   * white foreground. All three exceed WCAG 4.5:1 contrast on white fg
-   * (danger 5.39:1, warning 4.71:1, info 7.18:1). */
+   * white foreground. All three exceed WCAG 4.5:1 contrast on white fg in LIGHT
+   * theme (danger 5.60:1, warning 5.05:1 [post-#986400 fix], info 6.97:1).
+   * ⚠️ These three are de-aliased per Step 0.1 — do NOT give them a naive
+   * per-theme copy of --admin-danger/-warning/-info's DARK values: those dark
+   * tones are light-toned TEXT for a dark panel, not solid fills for white text,
+   * and would measure only 2.26:1 / 1.66:1 / 1.90:1 on white — each a bad AA
+   * failure. They need their own dedicated fill-safe per-theme values (see the
+   * --admin-danger-solid / -hover precedent), not a straight alias-target copy. */
```

(Numbers 5.60/6.97 are pre-existing corrections unrelated to Step 0.2; 5.05 is the one number Step 0.2
actually changes. The ⚠️ paragraph documents §3's finding and is new content, not a number correction —
whoever executes Step 0.1 should replace it with the real dark-theme numbers once that token's fill-safe
design is actually chosen; until then this warns instead of asserting a false per-theme claim.)

### 5.4 `tokens.css:419-421` (dark, `--admin-action-primary-text`) — pre-existing, not Phase-0-caused

```diff
-   /* --admin-primary lightens in dark, so its foreground darkens with it;
-    * white-on-fill would land at ~1.5:1. 8.88:1 on the dark primary fill. */
+   /* --admin-primary lightens in dark, so its foreground darkens with it;
+    * white-on-fill would land at ~2.11:1. 8.88:1 on the dark primary fill. */
```

### 5.5 `tokens.css:427-430` (dark, chart-status family) — pre-existing, not Phase-0-caused

```diff
-   * tuned for on cream. All six sit 5.55–9.75:1 against --admin-panel; the
+   * tuned for on cream. All six sit 5.57–9.81:1 against --admin-panel; the
```

### 5.6 `tokens.css:438-443` (dark, `.admin-nav-surface-*`) — pre-existing, not Phase-0-caused, requires the alpha-compositing fix (§4) to even compute correctly

```diff
-   * white 16.5:1; the .84 mint 9.74:1; the .72 mint 7.70:1. */
+   * white 16.42:1; the .84 mint 9.51:1; the .72 mint 7.31:1. */
```

### 5.7 `tokens.css:104-108` (root, strong-severity mixing warning) — pre-existing, not Phase-0-caused; recommended rewording, not a strict verbatim requirement

```diff
-   * surfaces; mixing -bg-strong with the legacy text fails WCAG (verified
-   * during B-0 — see redesign/baselines/wcag-severity-tokens.md). */
+   * surfaces; mixing -bg-strong with the legacy text fails WCAG in light theme
+   * (danger 4.08:1, warning 3.94:1 — both <4.5:1); dark theme's own values
+   * happen to clear AA if mixed (danger 5.85:1, warning 7.46:1), but the
+   * pairing is still unsupported in both themes (verified during B-0 — see
+   * redesign/baselines/wcag-severity-tokens.md). */
```

**No correction needed** for claims #3, #8, #10, #12, #13, #14 — all within the tool's own existing
±0.15 tolerance.

---

## 6. Out-of-scope sanity check: the `--rahma-*` (public-site) prose claims

Not part of the 16 (see §1b) and not part of ITEM 7's admin-only remit, but checked anyway for
completeness since the task asked to be exhaustive:

| Claim (root, lines 4-14) | Stated | Actual | Verdict |
|---|---|---|---|
| `#2589c8` (old `--rahma-green`) vs white | 3.82 | 3.824 | match |
| `--rahma-green` (`#1c72ac`) vs white | 5.18 | 5.183 | match |
| `--rahma-green` vs `--rahma-ivory` | 4.69 | 4.686 | match |
| `--rahma-charcoal` vs `--rahma-gold` | 4.543 | 4.543 | match |
| `--rahma-charcoal-strong` vs `--rahma-gold` | 4.966 | 4.966 | match |

All five accurate. No action needed, and correctly out of scope for this item.

---

## 7. Classification — machine-parseable vs not (task item 4)

**None of the 16 are parseable by a *general, context-free* regex the way the 11 inline comments are.**
The inline convention is a closed grammar: `<token>: <value>;   /* N.NN:1 vs <bgSuffix> */`, always on one
line, always attached to the declaration it describes. The 16 prose claims use free-form English shorthand
("on canvas", "the .84 mint", "the dark primary fill", "(completed/unknown)") that only a reader who knows
the design system can resolve to an actual `--admin-*` custom-property name — no regex can invent that
mapping. So "MACHINE-PARSEABLE (a regex could extract token + ratio + background)" is **NO for all 16**,
full stop, if "parseable" means "from the raw text alone, generically."

The finer distinction that actually matters for the tool's design is **whether, once a human has curated
the (fg, bg, scope) triple for a given claim by reading it once, the claim reduces to the same single-pair
check the inline convention already does** — versus claims that are structurally *not* a single pair no
matter how much curation is applied:

| Claims | Shape | Verdict |
|---|---|---|
| 1, 2, 3, 5, 6, 7, 8, 9, 10, 14, 15, 16 (**12**) | Exactly one fg, one bg, one scope, one number (or one ≥-threshold) | **MACHINE-CHECKABLE once curated** — same shape as the existing inline pass, just needs a hand-built fixture instead of a regex extraction |
| 4 | No ratio at all; names two pairs; no theme stated | **NOT reducible to a single pair check** — qualitative, scope-incomplete claim |
| 11 | One bg, but fg is a *set* of 6 tokens and the claim is a *range*, not a point value | **NOT a single pair** — needs a dedicated "compute min/max over N pairs, compare to a range" checker |
| 12, 13 | fg/bg are *derived* (the argmin over all C(6,2)=15 pairwise combinations within one theme), not named directly | **NOT a simple lookup** — needs a dedicated "compute the closest pair among N tokens" checker, then compare both the *value* and the claimed *identity* of the pair |

**For claims 4, 11, 12, 13, the tool must not attempt a pair-shaped check at all — it must emit an explicit
"not verified as a simple pair; N/A — see manual note" line, per the task's own instruction not to skip
silently.** Design for that output line, verbatim per claim id:

```
NOT-A-SIMPLE-PAIR [qualitative]    strong-mix-fails-generic (tokens.css:107): "mixing -bg-strong with the
    legacy text fails WCAG" — no ratio given, two pairs named, no theme stated. Not auto-verified; see
    manual finding in redesign/evidence/plan-deepening/phase0/a5-prose-claims.md §2 row 4.
NOT-A-SIMPLE-PAIR [range/6]        chart-six-range (tokens.css:428): claims a 5.55–9.75:1 range across 6
    tokens. Not auto-verified as a single pair; computed range reported separately below.
NOT-A-SIMPLE-PAIR [closest-pair]   chart-closest-dark (tokens.css:429), chart-closest-light (tokens.css:430):
    claims the minimum pairwise ratio among 6 tokens. Not auto-verified as a single pair; computed closest
    pair reported separately below.
```

(For range/closest-pair, the extension *can* still compute an informational number via dedicated
aggregate logic — and this audit did, see §2 rows 11-13 — but that is a different code path from the
generic pair-checker, and the task's own wording only requires that the *tool say so* rather than skip; it
does not require every shape to reduce to the same checker.)

---

## 8. Parser-extension code and test (task item 5)

Matches the existing file's style (JSDoc-style comments, named exports, `RATIO_TOLERANCE` reuse, the same
`resolveColour`/`contrastRatio` primitives, the same `run()`/`formatHumanReadable()` composition pattern
read in full from `scripts/verify-admin-token-contrast.mjs` and `scripts/verify-admin-token-contrast.test.ts`
before drafting this). **Not applied to any file — this is the exact text for the orchestrator to add.**
Assumes Step 0.5a (the print-block `indexOf` fix) has already landed, since 0.5a precedes 0.5b in the
stated execution order — none of the 16 claims live inside the print block anyway (confirmed §1a/§2), so
this code does not depend on that fix's specifics, only on `parseTokensCss`'s existing `scopes.root` /
`scopes.dark` / `scopes.light` being correct, which they already are today.

### 8.1 Addition to `scripts/verify-admin-token-contrast.mjs` (new section, after the existing 1c `checkPairs`/before the CLI section)

```js
// ---------------------------------------------------------------------------
// 1d. Prose contrast claims (Step 0.5b / D11). tokens.css also documents
// contrast in free-form comments that don't follow the `/* N:1 vs X */`
// convention — no regex can generically extract a (token, ratio, background)
// triple from English shorthand like "on canvas" or "the .84 mint", so this
// is a CURATED fixture: a human resolves each claim's fg/bg/scope once, and
// this code (a) verifies the claim's exact wording is still present verbatim
// in tokens.css (so a future edit that changes the number without updating
// this fixture is caught as drift, not silently trusted) and (b) computes the
// real ratio and compares it. Claims that are not reducible to a single pair
// (a range across many tokens, or "the closest pair among N") are marked
// kind !== "pair" and are NEVER silently skipped — see verifyProseClaims's
// explicit not-a-simple-pair branch.
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   id: string, line: number, quote: string,
 *   kind: "pair" | "pair-threshold" | "qualitative" | "range" | "closest-pair",
 *   fg?: string, bg?: string, scope?: "root"|"dark"|"light",
 *   statedRatio?: number, minRatio?: number, approx?: boolean,
 *   requiresAlphaComposite?: boolean,
 *   tokens?: string[], statedMin?: number, statedMax?: number,
 * }} ProseClaim
 */
export const PROSE_CLAIMS = [
  { id: "admin-primary-aaa-white", line: 79,
    quote: "lifts to AAA 7.2:1 vs white for primary buttons + active states",
    kind: "pair", fg: "--admin-primary", bg: "white", scope: "root", statedRatio: 7.2 },
  { id: "admin-accent-fails-canvas", line: 89,
    quote: "fails WCAG text contrast at 1.42:1 on canvas",
    kind: "pair", fg: "--admin-accent", bg: "--admin-canvas", scope: "root", statedRatio: 1.42 },
  { id: "admin-success-passes-strong", line: 105,
    quote: "the existing --admin-success which passes AA at 4.56:1",
    kind: "pair", fg: "--admin-success", bg: "--admin-success-bg-strong", scope: "light", statedRatio: 4.56 },
  { id: "strong-mix-fails-generic", line: 107,
    quote: "mixing -bg-strong with the legacy text fails WCAG",
    kind: "qualitative" },
  { id: "notif-danger-white", line: 172, quote: "danger 5.39:1",
    kind: "pair", fg: "white", bg: "--admin-danger", scope: "root", statedRatio: 5.39 },
  { id: "notif-warning-white", line: 172, quote: "warning 4.71:1",
    kind: "pair", fg: "white", bg: "--admin-warning", scope: "root", statedRatio: 4.71 },
  { id: "notif-info-white", line: 173, quote: "info 7.18:1",
    kind: "pair", fg: "white", bg: "--admin-info", scope: "root", statedRatio: 7.18 },
  { id: "admin-primary-dark-clears", line: 347,
    quote: "it clears 4.5:1 as a link/label ON the dark panel",
    kind: "pair-threshold", fg: "--admin-primary", bg: "--admin-panel", scope: "dark", minRatio: 4.5 },
  { id: "white-on-fill-hypothetical", line: 420, quote: "white-on-fill would land at ~1.5:1",
    kind: "pair", fg: "white", bg: "--admin-primary", scope: "dark", statedRatio: 1.5, approx: true },
  { id: "action-primary-text-dark", line: 420, quote: "8.88:1 on the dark primary fill",
    kind: "pair", fg: "--admin-action-primary-text", bg: "--admin-primary", scope: "dark", statedRatio: 8.88 },
  { id: "chart-six-range", line: 428, quote: "All six sit 5.55",
    kind: "range", scope: "dark", bg: "--admin-panel",
    tokens: ["--admin-chart-status-confirmed","--admin-chart-status-pending","--admin-chart-status-completed",
             "--admin-chart-status-cancelled","--admin-chart-status-noshow","--admin-chart-status-unknown"],
    statedMin: 5.55, statedMax: 9.75 },
  { id: "chart-closest-dark", line: 429, quote: "the closest luminance pair is 1.04:1 (completed/unknown)",
    kind: "closest-pair", scope: "dark",
    tokens: ["--admin-chart-status-confirmed","--admin-chart-status-pending","--admin-chart-status-completed",
             "--admin-chart-status-cancelled","--admin-chart-status-noshow","--admin-chart-status-unknown"],
    statedRatio: 1.04, statedPair: ["--admin-chart-status-completed","--admin-chart-status-unknown"] },
  { id: "chart-closest-light", line: 430, quote: "the light set's own closest pair (1.05:1)",
    kind: "closest-pair", scope: "light",
    tokens: ["--admin-chart-status-confirmed","--admin-chart-status-pending","--admin-chart-status-completed",
             "--admin-chart-status-cancelled","--admin-chart-status-noshow","--admin-chart-status-unknown"],
    statedRatio: 1.05 },
  { id: "nav-surface-white", line: 443, quote: "white 16.5:1",
    kind: "pair", fg: "white", bg: "--admin-nav-bg", scope: "dark", statedRatio: 16.5 },
  { id: "nav-surface-mint-84", line: 443, quote: "the .84 mint 9.74:1",
    kind: "pair", fg: "--admin-nav-surface-link", bg: "--admin-nav-bg", scope: "dark",
    statedRatio: 9.74, requiresAlphaComposite: true },
  { id: "nav-surface-mint-72", line: 443, quote: "the .72 mint 7.70:1",
    kind: "pair", fg: "--admin-nav-surface-link-icon", bg: "--admin-nav-bg", scope: "dark",
    statedRatio: 7.70, requiresAlphaComposite: true },
];

/** rgba(r,g,b,a) with a<1, alpha-composited "over" a resolved background — the
 * shared resolveColour() drops alpha entirely (rgbMatch only reads the first 3
 * numbers), which silently mis-resolves --admin-nav-surface-link/-icon (see
 * a5-prose-claims.md §4). This wrapper is local to the prose-claims pass and
 * does not change resolveColour's existing behaviour for 1b/1c. */
function resolveOverBackground(raw, scope, bgColour) {
  const m = String(raw).trim().match(/^rgba\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)[,\s]+([\d.]+)\s*\)$/i);
  if (!m || !bgColour) return resolveColour(raw, scope);
  const [, r, g, b, a] = m;
  const alpha = parseFloat(a);
  if (alpha >= 1) return [parseInt(r, 10), parseInt(g, 10), parseInt(b, 10)];
  const fg = [parseInt(r, 10), parseInt(g, 10), parseInt(b, 10)];
  return fg.map((c, i) => Math.round(alpha * c + (1 - alpha) * bgColour[i]));
}

/** Verify every entry in PROSE_CLAIMS against the real, parsed tokens.css. */
export function verifyProseClaims(css, parsed) {
  return PROSE_CLAIMS.map((claim) => {
    const present = css.includes(claim.quote);
    if (!present) {
      return { ...claim, present, verifiable: false,
        note: `quoted text not found verbatim in tokens.css — comment was edited or moved; re-locate by id, not by the stale line number` };
    }

    const scope = parsed.scopes[claim.scope];

    if (claim.kind === "qualitative") {
      return { ...claim, present, verifiable: false,
        note: "NOT-A-SIMPLE-PAIR [qualitative] — no ratio given, no theme stated; see manual finding in a5-prose-claims.md" };
    }

    if (claim.kind === "range" || claim.kind === "closest-pair") {
      const colours = claim.tokens.map((t) => resolveColour(scope[t], scope));
      if (colours.some((c) => !c)) {
        return { ...claim, present, verifiable: false, note: "one or more chart tokens failed to resolve" };
      }
      const bg = claim.bg ? resolveColour(scope[claim.bg], scope) : null;
      if (claim.kind === "range") {
        const ratios = colours.map((c) => contrastRatio(c, bg));
        const actualMin = Math.min(...ratios), actualMax = Math.max(...ratios);
        return { ...claim, present, verifiable: false,
          note: `NOT-A-SIMPLE-PAIR [range/${claim.tokens.length}] — informational only`,
          computedMin: actualMin, computedMax: actualMax,
          rangeMismatch: actualMin < claim.statedMin - RATIO_TOLERANCE || actualMax > claim.statedMax + RATIO_TOLERANCE };
      }
      // closest-pair
      let best = null;
      for (let i = 0; i < claim.tokens.length; i++) {
        for (let j = i + 1; j < claim.tokens.length; j++) {
          const r = contrastRatio(colours[i], colours[j]);
          if (!best || r < best.ratio) best = { ratio: r, pair: [claim.tokens[i], claim.tokens[j]] };
        }
      }
      return { ...claim, present, verifiable: false,
        note: "NOT-A-SIMPLE-PAIR [closest-pair] — informational only",
        computedRatio: best.ratio, computedPair: best.pair,
        pass: Math.abs(best.ratio - claim.statedRatio) <= RATIO_TOLERANCE };
    }

    // kind === "pair" | "pair-threshold"
    const fgRaw = claim.fg.startsWith("--") ? scope[claim.fg] : claim.fg;
    const bgRaw = claim.bg.startsWith("--") ? scope[claim.bg] : claim.bg;
    const bgColour = resolveColour(bgRaw, scope);
    const fgColour = claim.requiresAlphaComposite
      ? resolveOverBackground(fgRaw, scope, bgColour)
      : resolveColour(fgRaw, scope);
    if (!fgColour || !bgColour) {
      return { ...claim, present, verifiable: false, note: `could not resolve ${!fgColour ? claim.fg : claim.bg} in "${claim.scope}"` };
    }
    const actualRatio = contrastRatio(fgColour, bgColour);

    if (claim.kind === "pair-threshold") {
      return { ...claim, present, verifiable: true, actualRatio, pass: actualRatio >= claim.minRatio };
    }
    const tolerance = claim.approx ? RATIO_TOLERANCE * 4 : RATIO_TOLERANCE; // "~1.5:1" is explicitly loose
    const delta = actualRatio - claim.statedRatio;
    return { ...claim, present, verifiable: true, actualRatio, delta, pass: Math.abs(delta) <= tolerance };
  });
}
```

### 8.2 Wiring into `run()` (extend the existing function, additive only)

```js
// inside run(css, opts), after the existing pairResults block:
const proseResults = verifyProseClaims(css, parsed);
const proseMismatches = proseResults.filter((r) => r.verifiable && r.pass === false);
const proseNotSimplePair = proseResults.filter((r) => r.verifiable === false && r.present);
const proseMissing = proseResults.filter((r) => !r.present);
// add to `summary`: proseClaims: proseResults.length, proseMismatches: proseMismatches.length,
//                    proseNotSimplePair: proseNotSimplePair.length, proseMissing: proseMissing.length
// add proseMismatches.length + proseMissing.length to totalFailures
// (proseNotSimplePair is NOT a failure by itself — it's the required "say so" line, not a fail)
```

`formatHumanReadable` gets a parallel `--- 1d. prose contrast claims (N found) ---` section, one line per
claim: `match`/`MISMATCH`/`NOT-A-SIMPLE-PAIR [...]`/`MISSING (quote not found)`, following the exact same
line-format convention already used for 1b (`formatHumanReadable`'s existing `for (const r of ratioResults)`
loop, `verify-admin-token-contrast.mjs:447-458`).

### 8.3 Test — `scripts/verify-admin-token-contrast.test.ts`

```ts
describe("verifyProseClaims — the 16 prose contrast claims (Step 0.5b / D11)", () => {
  it("verifies all 16 prose contrast claims in tokens.css, flagging any it cannot machine-parse rather than skipping it silently", () => {
    const css = readFileSync(TOKENS_PATH, "utf8");
    const parsed = parseTokensCss(css);
    const results = verifyProseClaims(css, parsed);

    expect(results.length).toBe(16);

    // Every claim's quoted text must still be present verbatim — this is the
    // anti-drift guard: if tokens.css's wording changes, this fails loudly
    // instead of silently checking a claim that no longer exists.
    const missing = results.filter((r) => !r.present);
    expect(missing.map((r) => r.id)).toEqual([]);

    // The 4 structurally-not-a-pair claims must say so explicitly, never
    // silently report a pass/fail the way a skipped claim would.
    const notSimplePair = results.filter((r) => r.verifiable === false && r.present);
    expect(notSimplePair.map((r) => r.id).sort()).toEqual(
      ["chart-closest-dark", "chart-closest-light", "chart-six-range", "strong-mix-fails-generic"].sort()
    );
    for (const r of notSimplePair) expect(r.note).toMatch(/NOT-A-SIMPLE-PAIR/);

    // The remaining 12 must all be resolvable to a real ratio.
    const pairClaims = results.filter((r) => r.kind === "pair" || r.kind === "pair-threshold");
    expect(pairClaims.length).toBe(12);
    for (const r of pairClaims) {
      expect(r.verifiable).toBe(true);
      expect(r.actualRatio).toBeGreaterThanOrEqual(1);
      expect(r.actualRatio).toBeLessThanOrEqual(21);
    }
  });

  // Regression guard, written to the CORRECTED text this report specifies (§5) —
  // this test is expected to fail against tokens.css AS IT STANDS TODAY (9 of
  // 16 claims currently mismatch — see a5-prose-claims.md §2) and to start
  // passing only once §5's before/after edits land. That is intentional: it
  // is the guard that makes a future silent drift impossible going forward.
  it("has zero prose-claim mismatches once tokens.css carries the corrected wording", () => {
    const css = readFileSync(TOKENS_PATH, "utf8");
    const parsed = parseTokensCss(css);
    const results = verifyProseClaims(css, parsed);
    const mismatches = results.filter((r) => r.verifiable && r.pass === false);
    expect(mismatches).toEqual([]);
  });
});
```

---

## Stop conditions / caveats for the orchestrator

- §5.3's text is the one correction that is **not** a pure number swap — it also asserts a design
  requirement (dedicated fill-safe tokens for the 3 notif badges) that Step 0.1's implementer has not yet
  built. Landing §5.3 before Step 0.1 actually picks those dark-theme values means the comment's own
  dark-theme numbers are still TBD; the text above only asserts the (already-true-today) light-theme
  numbers plus a warning, deliberately not inventing dark numbers I cannot verify.
- The 8.1 code sample fabricates no colour values — every `statedRatio`/`quote` in `PROSE_CLAIMS` is copied
  verbatim from the current file; every `actual`/computed number in §2 came from running the real,
  unmodified `resolveColour`/`contrastRatio` functions, never hand-guessed.
- This report does not touch `scripts/verify-admin-token-contrast.mjs`, its test file, `tokens.css`, or
  any other file under the forbidden list — §8's code is prose-for-the-orchestrator-to-apply only.
