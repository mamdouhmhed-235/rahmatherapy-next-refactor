# A2 — verify-admin-token-contrast.mjs print-block parser fix

Scope: derive-only. No file under `src/`, `scripts/`, or `tokens.css` was modified.
All reproduction happened in the session scratchpad, importing the REAL
(unmodified) `scripts/verify-admin-token-contrast.mjs` module.

## 1. Bug confirmed

`parseTokensCss()` (`scripts/verify-admin-token-contrast.mjs:197`) locates the
print block with:

```js
const printBody = extractBraceBlock(css, css.indexOf("@media print"), "@media print");
```

`css.indexOf("@media print")` returns the **first** occurrence of that
substring in the whole file. That is not the real `@media print {` rule —
it is inside a prose comment (`tokens.css:317`) that appears earlier in the
file, well before the real rule (`tokens.css:543`).

Reproduced in isolation (`a2-repro.mjs`, imports the real `parseTokensCss`
against the real `tokens.css`):

```
css.indexOf('@media print')   => char 18361 -> line 317   (the prose comment)
css.indexOf('@media print {') => char 30136 -> line 543   (the real rule)
```

`extractBraceBlock` then does `css.indexOf("{", selectorIndex)` from char
18361. Between line 317 and the next `{`, the only intervening text is more
prose comment (no braces) until the comment closes at line 329 — so the
next `{` in the file is the one that opens the **`[data-theme="dark"]`**
block, at line 332. `extractBraceBlock`'s balanced-brace scan from there
returns exactly the dark block's body (lines 333–446) as `printBody`.

Actual wrong output (real module, real file):

```
parsed.scopes.print["--admin-canvas"]  = oklch(17% 0.008 88)   // == dark's value
parsed.scopes.dark["--admin-canvas"]   = oklch(17% 0.008 88)   // (for comparison)
parsed.scopes.light["--admin-canvas"]  = #fbf8f2               // real print should equal THIS (print = light palette)
```

`printBody === darkBody` byte-for-byte (confirmed: the 5 ratio comments
"attributed to print" are identical, in order and value, to the 5 attributed
to dark). This is exactly the plan's claimed defect. **CONFIRMED.**

## 2. Real line numbers (quoted verbatim, current tree)

Prose comment containing "print" (the false match), `tokens.css:317`:
```
 * these blocks MUST stay after :root, and @media print MUST stay last.
```
This line sits inside the large `/* ─── Admin theme scoping ... */` comment
that runs `tokens.css:262`–`329`.

Real `@media print` rule, `tokens.css:543`:
```
@media print {
```
It closes at `tokens.css:634` (`}` closing the `@media` block; the inner
selector block closes at `:633`).

Grep of the literal word "print" across the whole file confirms these are
the only two candidate anchors before the real one, and nothing else
contains the substring `@media print {`:
```
317: * these blocks MUST stay after :root, and @media print MUST stay last.
539: * --admin-* through the shared shadcn primitives print byte-identically to
542: * open dialog would print its dark surface. */
543:@media print {
```
Lines 539/542 contain the word "print" but not "@media print {", so they are
not additional false-match risks for the proposed fix.

## 3. Minimal fix — chosen and justified

Two options were on the table (per the plan):
- **(A) Locate `@media print` by its selector-with-brace form** — change the
  search string from `"@media print"` to `"@media print {"`.
- (B) Search forward from the end of the light block's closing brace.

**Chosen: (A).** It is a strict one-token, one-line change with no new
control flow, no dependency on `lightBody`'s extraction having already
succeeded, and it is provably unique in the file (grep above: `"@media
print {"` occurs exactly once, at line 543, in the real declaration; no
comment anywhere else in the file contains that exact substring). Option
(B) would work too but requires passing/knowing `lightBody`'s end offset
into the print lookup, a slightly larger diff for no extra safety margin
here since (A)'s uniqueness is already verified against the real file.

**Exact before/after diff** (`scripts/verify-admin-token-contrast.mjs`,
inside `parseTokensCss`, currently line 197):

```diff
-  const printBody = extractBraceBlock(css, css.indexOf("@media print"), "@media print");
+  const printBody = extractBraceBlock(css, css.indexOf("@media print {"), "@media print");
```

Only the `indexOf` argument changes (`"@media print"` → `"@media print {"`).
The third argument (the human-readable `label` passed to `extractBraceBlock`
for its error message) is left as `"@media print"` — unchanged — since it's
just an error-message label, not a search key.

No other line in the file needs to change to fix this defect. (Whether to
also *extend* `checkPairs` to a print scope is a separate question — see
§5, not required for this fix.)

## 4. Consequence on the script's current output — verified, not predicted-and-hoped

### 4a. Ground truth: real distinct inline ratio comments in the whole file

Counted directly against the raw file text with the same
`RATIO_COMMENT_RE` the script itself uses, independent of any parser logic
(so this number cannot be wrong for the same reason the bug is wrong):

```
line 112: --admin-danger-text-strong   9.21:1 vs danger-bg-strong   (root)
line 113: --admin-warning-text-strong  10.71:1 vs warning-bg-strong (root)
line 367: --admin-danger-text-strong   9.30:1 vs danger-bg-strong   (dark)
line 368: --admin-warning-text-strong  9.41:1 vs warning-bg-strong  (dark)
line 425: --admin-danger-solid         7.12:1 vs on-primary         (dark)
line 426: --admin-danger-solid-hover   10.02:1 vs on-primary        (dark)
line 437: --admin-sparkline-stroke     7.80:1 vs --admin-panel      (dark)
line 477: --admin-danger-text-strong   9.21:1 vs danger-bg-strong   (light)
line 478: --admin-warning-text-strong  10.71:1 vs warning-bg-strong (light)
line 573: --admin-danger-text-strong   9.21:1 vs danger-bg-strong   (print)
line 574: --admin-warning-text-strong  10.71:1 vs warning-bg-strong (print)
```
**Total: 11.** Per block: root=2, dark=5, light=2, print=2.

**The plan's claim of "11 real inline" is CONFIRMED exactly.**
**The plan's claim of "print block should have exactly 2, not 5" is CONFIRMED exactly** (print's real content, lines 573/574, is 2 comments).

### 4b. BEFORE (current buggy script, run against the real, unmodified `tokens.css`)

Captured by actually running the real CLI (`node
scripts/verify-admin-token-contrast.mjs --json`, read-only, exit 0):

```json
{
  "tokensParsed": 92,
  "lightResolved": 92,
  "darkResolved": 92,
  "ratioCommentsFound": 14,
  "ratioMismatches": 0,
  "ratioUnresolved": 0,
  "uniquePairs": 83,
  "pairChecksRun": 166,
  "pairFailures": 1,
  "pairUnresolved": 0,
  "totalFailures": 1
}
```
`ratioCommentsFound: 14` = root(2) + dark(5) + light(2) + **print-mislabeled-as-dark(5)**.
**The plan's claim "inflated to 14 by this bug" is CONFIRMED exactly** (14 = 11 + the 3 extra
non-text-strong comments dark has that print doesn't: `--admin-danger-solid`,
`--admin-danger-solid-hover`, `--admin-sparkline-stroke`, i.e. 11 + 3 = 14).
The single pre-existing `pairFailures: 1` is D8 (`--admin-warning` vs
`--admin-warning-bg`, light theme, 3.41:1) — present before this fix and
untouched by it (Step 0.2 fixes D8; this step is parser-only).

### 4c. AFTER (predicted, verified by simulation)

Simulated by reimplementing `parseTokensCss` verbatim from the real script
with **only** the one-line fix applied (§3), then feeding its output into
the REAL, unmodified, imported `verifyRatioComments` / `derivePairs` /
`checkPairs`, and reproducing `run()`'s summary aggregation exactly
(`a2-simulate-fix.mjs`, run against the real `tokens.css`):

```json
{
  "tokensParsed": 92,
  "lightResolved": 92,
  "darkResolved": 92,
  "ratioCommentsFound": 11,
  "ratioMismatches": 0,
  "ratioUnresolved": 0,
  "uniquePairs": 83,
  "pairChecksRun": 166,
  "pairFailures": 1,
  "pairUnresolved": 0,
  "totalFailures": 1
}
```

**The only field that changes is `ratioCommentsFound`: 14 → 11.** Per-block
breakdown post-fix: `{ root: 2, dark: 5, light: 2, print: 2 }` — matches §4a
exactly. The print block's 2 real comments both still PASS
(`--admin-danger-text-strong`: stated 9.21, actual 9.19, pass; the 0.02
delta is normal oklch↔srgb rounding noise, well inside `RATIO_TOLERANCE =
0.15` — `--admin-warning-text-strong`: stated 10.71, actual 10.71, pass).

`uniquePairs` (83) and `pairChecksRun` (166) do **not** change. This is
expected, not a coincidence to double-check away: `derivePairs()` dedupes
added pairs by the `${fg}|${bg}` key regardless of which block a ratio
comment came from (`scripts/verify-admin-token-contrast.mjs:293-300`), and
every fg/bg pair in the mislabeled "print" duplicates (`--admin-danger-text-strong`/`-bg-strong`,
etc.) was already added earlier in `derivePairs()` via the explicit naming-convention
rules (lines 306–307) before the ratio-comment loop is ever reached — so
removing the 3 duplicate/spurious "print" entries changes nothing about
which unique pairs get checked. `pairFailures` stays at exactly 1 (still
D8, unaffected — this fix touches no colour value).

**Prediction for the orchestrator to compare against:** applying only the
one-line fix in §3, `node scripts/verify-admin-token-contrast.mjs --json`
must report `ratioCommentsFound: 11` (down from 14) and every other summary
field byte-identical to the BEFORE numbers in §4b, in particular
`totalFailures: 1` unchanged (still D8, not yet fixed by this step).

## 5. Does `checkPairs()` ever evaluate a "print" scope? — CONFIRMED it does not

`checkPairs()` (`scripts/verify-admin-token-contrast.mjs:367-387`) hard-codes
exactly two scopes:
```js
for (const [theme, scope] of [
  ["dark", darkScope],
  ["light", lightScope],
]) {
```
`darkScope`/`lightScope` come from `buildThemeScope(tokens, "dark"/"light")`,
and `tokens[name]` (built in `parseTokensCss`, lines 208-214) only ever
carries a `.light` and a `.dark` value — never a `.print` value. `printDecl`
is used **only** to build `scopes.print`, which is consumed **only** by
`verifyRatioComments()` (`c.block === "print"`, line 253), and only for
whichever specific tokens happen to carry an inline `/* N:1 vs X */` comment
inside the print block.

Consequence for Step 0.2 specifically: `--admin-warning` /
`--admin-warning-bg` (the D8 pair Step 0.2 edits, print-block copy at
`tokens.css:566-567`) carries **no inline ratio comment** in the print
block (confirmed by reading those two lines — no trailing `/* ... */`).
So even **after** this parser fix, `verifyRatioComments()` still cannot see
it (no comment to parse), and `checkPairs()` structurally never evaluates
"print" at all. **Step 0.2's print-block edit remains completely invisible
to Layer 2, with or without this parser fix.** This matches the plan's own
verify note for Step 0.2 (manual diff of `tokens.css:566-567` vs `:470-471`
required) — the plan does not claim the parser fix makes Layer 2 see
Step 0.2's print-block edit, and it's correct not to.

**Is extending `checkPairs` to a print scope in-scope-small or a larger
change? Recommend: larger change, out of scope here.** Reasons:
- `tokens[name]` would need a third resolved value (`.print`), changing the
  shape `parseTokensCss` returns and consumed by both `checkPairs` and the
  existing test `expect(lightResolved).toBe(tokenCount)` /
  `expect(darkResolved).toBe(tokenCount)` assertions
  (`scripts/verify-admin-token-contrast.test.ts:119-120`) — those would need
  a parallel `printResolved` addition.
- `checkPairs` iterating a third scope triples `pairChecksRun` from
  `pairs.length * 2` to `pairs.length * 3`, and that `* 2` relationship is
  asserted directly in the existing test
  (`scripts/verify-admin-token-contrast.test.ts:179`:
  `expect(results.length).toBe(pairs.length * 2); // dark + light`) — a
  breaking change to an existing, passing regression test, not additive.
- Not every one of the 83 derived pairs is print-meaningful (e.g. hover/active
  interaction states, skeleton shimmer, chart fills — none of which render
  on paper); blindly running all 83 against print would produce a wall of
  print-irrelevant "failures" or require a new curated print-specific pair
  list, which is a design decision, not a one-line tooling fix.
- The plan itself does not ask for this — §7.5b's own Step 0.2 verify block
  prescribes a **manual diff**, not a `checkPairs` extension, as the
  authoritative check for the print copy.

Recommendation: do not extend `checkPairs` in this step. Rely on Step 0.2's
prescribed manual diff (`tokens.css:566-567` vs `:470-471`) as the plan
already specifies.

## 6. Exact test code to add

Matching the existing file's idiom (`scripts/verify-admin-token-contrast.test.ts`):
plain `vitest` `describe`/`it`, imports `parseTokensCss`/`TOKENS_PATH` from
`./verify-admin-token-contrast.mjs`, `readFileSync` from `node:fs`, no
mocking anywhere in this file (none needed here either).

Add as a new `describe` block (place it directly after the existing
`describe("parseTokensCss — block extraction, structure only", ...)` block,
i.e. after line 122 of the current test file, before
`describe("verifyRatioComments — self-consistency logic", ...)`):

```ts
describe("parseTokensCss — @media print must not be confused with an earlier prose mention", () => {
  // Mirrors the real tokens.css shape that caused the bug: a comment that
  // mentions the literal words "@media print" sits BETWEEN the :root and
  // [data-theme="dark"] blocks (tokens.css:317), well before the real
  // @media print rule (tokens.css:543). A naive `css.indexOf("@media print")`
  // matches the comment and then greedily consumes the next block's braces
  // (the dark block) as if they belonged to print.
  const SYNTHETIC_CSS_WITH_PRINT_DECOY = `
:root {
  --admin-canvas: #ffffff;
}

/* Historical note: these blocks MUST stay after :root, and @media print MUST stay last. */

[data-theme="dark"],
[data-admin-theme-root][data-theme="dark"] ~ * {
  --admin-canvas: #111111;
}

[data-theme="light"],
[data-admin-theme-root][data-theme="light"] ~ * {
  --admin-canvas: #ffffff;
}

@media print {
  :root,
  [data-theme="dark"],
  [data-theme="light"] {
    --admin-canvas: #eeeeee;
  }
}
`;

  it("parses the @media print block from its own selector, not from the word 'print' inside an earlier comment", () => {
    const parsed = parseTokensCss(SYNTHETIC_CSS_WITH_PRINT_DECOY);
    // The real print block declares --admin-canvas: #eeeeee. A parser that
    // mistakes the earlier comment for the print selector will instead
    // return the dark block's body (#111111) under the "print" label.
    expect(parsed.scopes.print["--admin-canvas"]).toBe("#eeeeee");
  });

  it("reports exactly 2 ratio comments attributed to the print block, not 5", () => {
    const css = readFileSync(TOKENS_PATH, "utf8");
    const parsed = parseTokensCss(css);
    const printRatios = parsed.ratioComments.filter((c) => c.block === "print");
    expect(printRatios.map((c) => c.token)).toEqual([
      "--admin-danger-text-strong",
      "--admin-warning-text-strong",
    ]);
    expect(printRatios.length).toBe(2);
  });
});
```

Notes for the orchestrator applying this:
- `readFileSync` and `TOKENS_PATH` are already imported at the top of the
  test file (lines 2 and 11) — no new imports needed.
- The first test is synthetic/self-contained and will FAIL on the current
  (unfixed) `parseTokensCss` and PASS once the §3 fix lands — use it to
  confirm the fix before moving on to Step 0.2.
- The second test only makes sense (and only passes) against the real,
  current `tokens.css` content — if a later step (0.1/0.2) changes what's
  declared inside the print block's `--admin-danger-text-strong` /
  `--admin-warning-text-strong` lines, this test's exact token-list
  assertion may need re-verification, but the **count** of 2 should remain
  stable through Steps 0.1/0.2 (neither step adds or removes ratio comments
  from the print block — Step 0.1 doesn't touch the print block's own
  content beyond what's already there, and Step 0.2 edits `--admin-warning`/
  `--admin-warning-bg`, which carry no inline ratio comment before or after).

## Files touched by this derivation (read-only)

- Read: `scripts/verify-admin-token-contrast.mjs` (full), `src/styles/tokens.css`
  (lines 260–636), `scripts/verify-admin-token-contrast.test.ts` (full),
  `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` (lines 1743–1982).
- Ran (read-only, whitelisted): `node scripts/verify-admin-token-contrast.mjs --json`.
- Wrote (scratchpad only, not in repo):
  `a2-repro.mjs`, `a2-simulate-fix.mjs`, `a2-before.json`.
