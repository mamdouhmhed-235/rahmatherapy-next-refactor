# Item 7 Phase 0 — Step 0.4 regression guard, fully derived

Scope: design (not apply) the Step 0.4 "regression guard for the alias class" — plan
`redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` lines 1914-1925, cross-checked against the
consolidated exit criteria (1945) and stop condition 6 (1966). Read in full before starting:
`scripts/verify-admin-token-contrast.mjs` (499 lines), `scripts/verify-admin-token-contrast.test.ts`
(216 lines), `src/content/site/__tests__/canonical-domain.test.ts` (56 lines),
`redesign/evidence/admin-contrast/root-cause-D1.md` (306 lines), and the relevant slice of
`redesign/evidence/plan-deepening/item-07a-phase0-theme.md`. Read-only throughout — nothing under
`src/`, `scripts/`, or `redesign/plans/` was edited. All detection logic below was independently
prototyped and run against the real, current (pre-Step-0.1) `src/styles/tokens.css` from the
session scratchpad (`…/scratchpad/proto-frozen-alias-check.mjs`, `…/scratchpad/test-synthetic.mjs`)
— outputs quoted verbatim below, not asserted from memory.

---

## 1. What the .mjs currently exports, and the test's import idiom

`scripts/verify-admin-token-contrast.mjs` exports: `ROOT`, `TOKENS_PATH`, `oklchToRgb`,
`resolveColour`, `contrastRatio`, `parseTokensCss`, `RATIO_TOLERANCE`, `verifyRatioComments`,
`derivePairs`, `checkPairs`, `run`. It does **not** export `extractBraceBlock`, `harvestDeclarations`,
`DECL_RE`, `RATIO_COMMENT_RE`, or `normalizeTokenRef` — those stay module-private.

`scripts/verify-admin-token-contrast.test.ts` imports the parser's exported functions directly
(`import { checkPairs, contrastRatio, derivePairs, oklchToRgb, parseTokensCss, resolveColour, run,
TOKENS_PATH, verifyRatioComments } from "./verify-admin-token-contrast.mjs";`) and calls them
in-process — it never shells out to the CLI, and never re-implements parsing itself. This is the
idiom Step 0.4 must match: **the detection logic belongs in the `.mjs` as a new exported function**,
and the test imports and calls it directly.

## 2. Where the new logic lives, and why NOT inside `parseTokensCss`

**Decision: a new, standalone exported function, `findFrozenRootAliases(css)`, added to the `.mjs`.
It does not modify `parseTokensCss`, `harvestDeclarations`, or `DECL_RE`.**

Two real findings forced this, both confirmed by running the existing code, not assumed:

**Finding A — `parseTokensCss`'s `tokens`/`scopes` don't distinguish "declared in this block" from
"inherited from `:root`".** `parseTokensCss` builds `tokens[name] = { light: lightDecl[name] ??
rootDecl[name], dark: darkDecl[name] ?? rootDecl[name] }` — i.e. it already resolves the fallback
before returning. Given only that output, you cannot tell whether `--admin-nav-text`'s light value
came from an actual `[data-theme="light"]` declaration or fell through from `:root`. Step 0.4 needs
exactly that distinction (that's the whole bug), so it needs the *raw per-block* declaration maps
(`rootDecl`, `darkDecl`, `lightDecl`), which `parseTokensCss` computes internally but never returns.

**Finding B — `DECL_RE` (`/(--admin-[a-z0-9-]+)\s*:\s*([^;]+);/g`) only matches `--admin-*` names.
It silently never captures any `--notif-*` declaration — confirmed empirically:**
```
node -e "... parseTokensCss(tokens.css) ..."
total: 92
notif tokens found: []
has --notif-badge-warning-bg: false
```
Three of the plan's 11 confirmed frozen aliases (`--notif-badge-critical-bg`,
`--notif-badge-warning-bg`, `--notif-badge-info-bg`) are `--notif-*`, not `--admin-*`. **This is a
real, previously-undisclosed gap in the existing tool** (not introduced by this change; `derivePairs`
and `verifyRatioComments`, which both consume `parsed.tokens`, are equally blind to `--notif-*`
tokens today — worth a note to the Owner, out of scope to fix here). Step 0.4's own spec says "any
`--admin-*` **or** `--notif-*` token", so reusing `harvestDeclarations`/`DECL_RE` as-is would build a
guard that silently misses 3 of the 11 known real instances — this is exactly the class of "detector
that looks like it works but doesn't" the assignment's trap warns about, just one level deeper than
the stated trap (missing coverage, not a vacuous zero-count).

Given both findings, extending `parseTokensCss`'s return shape (e.g. adding a `blockDeclarations`
key) was considered and rejected: it would touch a function with 4 existing passing tests
(`parseTokensCss — block extraction, structure only`) for a widening (`--notif-*` support) those
tests don't ask for, and Step 0.4 is scoped as "add a check", not "fix the parser's token-family
scope". The self-contained function below reuses the module-private `extractBraceBlock` (already
in scope, no export needed — it's called from the same file) for brace-matching, and defines its
own alias-aware harvesting regex, purpose-built for the two token families Step 0.4 names. This
keeps the diff fully additive and isolated to Step 0.4.

**Tradeoff disclosed:** this duplicates 3 calls to `extractBraceBlock` that `parseTokensCss` already
makes when both run in the same process (e.g. inside `run()`, or when a test calls both). This is
negligible (a ~30KB file, regex-based, no I/O) and was chosen over widening `parseTokensCss`'s
contract — stated so the tradeoff isn't silently made.

## 3. Exact detection logic

Insert into `scripts/verify-admin-token-contrast.mjs`, immediately after `parseTokensCss`'s closing
brace and blank line (currently ends at line 231, blank line 232), and before the existing
`// --- 1b. Verify the self-declared ratio comments ---` separator (currently line 233) — i.e. as a
new section between the parser and the 1b ratio-comment logic:

```js
// ---------------------------------------------------------------------------
// Step 0.4 — regression guard for the alias-freeze defect class (the exact
// shape that froze D1/D7/D9; see redesign/evidence/admin-contrast/root-cause-D1.md
// §3). A token declared in :root as a bare `var(--other-token)` reference is
// substituted once, against :root's own permanently-light environment (:root
// never carries data-theme — see ThemeProvider.tsx), and that already-frozen
// value is what every descendant inherits, forever, regardless of theme.
//
// Deliberately independent of parseTokensCss/harvestDeclarations/DECL_RE
// above: DECL_RE only matches "--admin-*" names, so it silently never sees
// "--notif-*" declarations (confirmed: parseTokensCss's `tokens` map contains
// zero --notif-* entries today, even though tokens.css declares six of them).
// Three of the 11 real D1/D7/D9-class aliases are --notif-badge-*-bg tokens,
// so a guard built on the existing harvester as-is would silently miss them.
// This regex is scoped to exactly the token families Step 0.4 names: "any
// --admin-* or --notif-* token".
// ---------------------------------------------------------------------------

const ALIAS_DECL_RE = /(--(?:admin|notif)-[a-z0-9-]+)\s*:\s*([^;]+);/g;

function harvestAliasDeclarations(blockBody) {
  const out = {};
  for (const m of blockBody.matchAll(ALIAS_DECL_RE)) out[m[1]] = m[2].trim();
  return out;
}

// Matches a value that is NOTHING BUT a single, fallback-free var()
// reference — e.g. "var(--admin-body)". Deliberately narrow:
//   - var() WITH a fallback ("var(--x, #fff)") does NOT match. Step 0.4's own
//     wording names "a bare var(--...) value"; independently confirmed that
//     none of the 11 real D1/D7/D9-class instances use a fallback (every one
//     is a plain "--token: var(--other);" with nothing else). The fallback
//     branch is irrelevant to the freeze mechanism anyway (the referenced
//     token is always defined in this file, so the fallback never runs), but
//     treating a fallback form as in-scope would be an unverified expansion
//     beyond the named/confirmed defect shape — left uncaught, and disclosed
//     on findFrozenRootAliases below, not silently assumed safe.
//   - a var() wrapped in another function ("calc(var(--x))", "color-mix(in
//     oklab, var(--x) 20%, transparent)") does NOT match — that is "the value
//     USES a token", a different and extremely common shape in this file
//     (--focus-ring-token, --shadow-*-token, etc.) that is not the alias-
//     freeze defect and would be enormous false-positive noise if matched.
const BARE_ALIAS_RE = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i;

/**
 * Step 0.4 regression guard. Flags every --admin-*/--notif-* token declared
 * in :root as a bare var() reference that is NOT also given its own
 * declaration (any value — literal or another var()) in BOTH the dark and
 * the light theme block. Presence of a per-block declaration is the correct
 * criterion, not "is the redeclared value a literal": a custom property's
 * var() substitution resolves against the value visible AT THE ELEMENT the
 * winning declaration applies to, so redeclaring the alias line itself inside
 * [data-theme="dark"] would force re-resolution in that theme's own scope and
 * break the freeze too — this function checks for exactly that structural
 * escape hatch, not for a specific value shape in the theme blocks.
 *
 * Scope, disclosed: this checks :root against dark AND light only, per Step
 * 0.4's own spec ("declared ONLY in the :root block ... flag those that are
 * not [also declared in dark AND light]") — it does not check @media print.
 * Step 0.1's fix scope is wider (:root, dark, light, AND print); this guard
 * is deliberately narrower, matching only what Step 0.4 names. A token fully
 * fixed in :root/dark/light but left frozen in print would NOT be caught
 * here — a real, accepted gap, not an oversight.
 *
 * Disclosed limit (source-text check): this reads tokens.css's own declared
 * text. It cannot and will not catch an alias introduced through a different
 * mechanism — e.g. a value set at runtime via element.style.setProperty(),
 * a CSS-in-JS layer, or any other non-declarative source outside this file.
 *
 * @param {string} css - the full tokens.css source (or any CSS sharing its
 *   :root / [data-theme="dark"] / [data-theme="light"] block shape).
 * @returns {Array<{token: string, target: string}>} every frozen-shaped
 *   token found, each paired with the token it aliases.
 */
export function findFrozenRootAliases(css) {
  const rootBody = extractBraceBlock(css, css.indexOf(":root {"), ":root");
  const darkBody = extractBraceBlock(css, css.indexOf('[data-theme="dark"]'), '[data-theme="dark"]');
  const lightBody = extractBraceBlock(css, css.indexOf('[data-theme="light"]'), '[data-theme="light"]');

  const rootDecl = harvestAliasDeclarations(rootBody);
  const darkDecl = harvestAliasDeclarations(darkBody);
  const lightDecl = harvestAliasDeclarations(lightBody);

  const frozen = [];
  for (const [name, value] of Object.entries(rootDecl)) {
    const m = value.match(BARE_ALIAS_RE);
    if (!m) continue; // not a bare var() alias — out of scope
    const inDark = Object.prototype.hasOwnProperty.call(darkDecl, name);
    const inLight = Object.prototype.hasOwnProperty.call(lightDecl, name);
    if (!inDark || !inLight) frozen.push({ token: name, target: m[1] });
  }
  return frozen;
}
```

### Edge cases named in the assignment, and how each is handled

- **Multi-line declarations.** `ALIAS_DECL_RE`'s value group is `[^;]+`, identical in shape to the
  existing `DECL_RE` — a character class excluding only `;` already matches embedded newlines (no
  `s`/`m` flag needed), so a value split across lines before its terminating `;` is captured whole.
  No real declaration in `tokens.css` currently spans multiple lines (confirmed by reading the file),
  so this is defensive, not exercised by the real file today.
- **Comments containing `var(`.** `ALIAS_DECL_RE` requires the literal, adjacent shape
  `--(admin|notif)-name<ws>:<ws>value;` — a comment would have to contain that exact
  colon-then-semicolon structure verbatim to false-match, which none currently do (checked: `grep
  var\( src/styles/tokens.css` — the one comment that documents the alias mechanism, currently lines
  319-325, describes the pattern in prose as `var(<target>)` with angle brackets, not a real token
  name, and has no trailing `;` in that shape, so it does not match). This is the same structural
  safety the existing `DECL_RE`/`RATIO_COMMENT_RE` already rely on — not a new risk introduced here,
  but also not literally comment-aware; if a future comment ever contained a verbatim
  `--admin-foo: var(--bar);` code example, it would false-positive. Pre-existing characteristic of
  this file's whole parsing approach, disclosed, not fixed here (out of Step 0.4's scope).
- **Tokens declared in print only.** Not reachable by this function at all — it never extracts the
  print block. A print-only `--admin-*`/`--notif-*` declaration (none exist today) would not be
  seen, which is correct: it isn't a `:root` declaration, so it isn't the D1/D7/D9 shape.
- **`var()` with a fallback.** Explicitly excluded from `BARE_ALIAS_RE` (see the code comment above)
  — decided, not implicit. Verified none of the 11 real instances use one.

## 4. Exact test code (both tests, file's existing style)

Add to `scripts/verify-admin-token-contrast.test.ts`:

**Import** — extend the existing import block (currently lines 3-13) to add the new symbol:
```ts
import {
  checkPairs,
  contrastRatio,
  derivePairs,
  findFrozenRootAliases,
  oklchToRgb,
  parseTokensCss,
  resolveColour,
  run,
  TOKENS_PATH,
  verifyRatioComments,
} from "./verify-admin-token-contrast.mjs";
```

**New `describe` block** — insert after the `derivePairs + checkPairs` block's closing `});`
(currently ends line 190) and before `describe("run() — CLI-facing entry point", ...)` (currently
line 192):

```ts
describe("findFrozenRootAliases — Step 0.4 regression guard for the alias-freeze class", () => {
  // Disclosed limit (source-text check, per C-17's precedent of flagging what a
  // guard can't see — note C-17's own guard, src/app/booking/__tests__/no-google-analytics.test.ts,
  // does not actually contain a disclosure sentence, so this one is written fresh,
  // not copied): this reads tokens.css's own declared text. It cannot catch an
  // alias introduced through a different mechanism — a value set at runtime via
  // element.style.setProperty(), a CSS-in-JS layer, or any other non-declarative
  // source outside this file. See findFrozenRootAliases's own doc comment in
  // verify-admin-token-contrast.mjs for the full scope statement (dark+light only,
  // not print; no fallback var(); no var()-wrapped-in-another-function).

  it("flags a token declared only in :root as a bare var() alias", () => {
    // Synthetic fixture — proves the detector's OWN logic works, independent of
    // tokens.css's current state. Required because a test that only asserts
    // "zero found in the real file" would pass whether or not detection works,
    // once Step 0.1 has removed all 11 real instances (plan §7.5b stop condition 6).
    const css = `
:root {
  --admin-real-fine: #ffffff;
  --admin-frozen: var(--admin-real-fine);
  --notif-badge-frozen-bg: var(--admin-real-fine);
  --admin-not-frozen: var(--admin-real-fine);
  --admin-with-fallback: var(--admin-real-fine, #000000);
  --admin-not-alias: #123456;
}
[data-theme="dark"] {
  --admin-real-fine: #111111;
  --admin-not-frozen: #222222;
}
[data-theme="light"] {
  --admin-real-fine: #ffffff;
  --admin-not-frozen: #f0f0f0;
}
`;
    const frozen = findFrozenRootAliases(css);
    const flaggedNames = frozen.map((f) => f.token).sort();

    // Caught: declared only in :root, bare var(), missing from BOTH theme blocks.
    expect(flaggedNames).toContain("--admin-frozen");
    // Caught on a --notif-* name too — proves the guard isn't scoped to
    // --admin-* only, the gap the shared DECL_RE has today (see §2 above).
    expect(flaggedNames).toContain("--notif-badge-frozen-bg");
    // NOT caught: redeclared with its own value in both dark and light.
    expect(flaggedNames).not.toContain("--admin-not-frozen");
    // NOT caught: not an alias at all (a plain literal).
    expect(flaggedNames).not.toContain("--admin-not-alias");
    // NOT caught by design: var() WITH a fallback is out of this guard's
    // declared scope — asserted explicitly so the omission reads as
    // intentional, not a missed case.
    expect(flaggedNames).not.toContain("--admin-with-fallback");

    expect(flaggedNames).toEqual(["--admin-frozen", "--notif-badge-frozen-bg"]);
  });

  it("finds zero frozen :root-only alias tokens in the real tokens.css", () => {
    // Real-file assertion — only meaningful paired with the synthetic test
    // above, and only meaningful once Step 0.1 has landed (see §6 below for
    // what this reports before Step 0.1).
    const css = readFileSync(TOKENS_PATH, "utf8");
    const frozen = findFrozenRootAliases(css);
    expect(frozen).toEqual([]);
  });
});
```

`readFileSync` and `TOKENS_PATH` are already imported/exported respectively — no new import needed
for the second test beyond the `findFrozenRootAliases` addition above.

**⚠️ Conditional on Step 0.1's actual outcome for `--admin-shell`** (flagging, not deciding — Step
0.1 is a different derivation): the plan requires `--admin-shell` be **explicitly assessed**, and
permits deferring it ("dead code, no visible defect", left as-is) rather than de-aliasing it (plan
line 1761). If Step 0.1 defers it, `--admin-shell` will still be `:root`-only and bare-`var()`-valued
after Step 0.1 lands, and `findFrozenRootAliases` will still (correctly) flag it — meaning
`expect(frozen).toEqual([])` above would **fail**, not because the guard is broken, but because a
known, deliberately-deferred token remains. In that case the assertion must become:
```ts
expect(frozen).toEqual([{ token: "--admin-shell", target: "--admin-sidebar" }]);
```
with a one-line comment noting the defer decision and pointing at Step 0.1's commit message. The
orchestrator applying Step 0.1 knows which branch actually happened; this report cannot, since
deriving Step 0.1 is out of this assignment's scope. **Pick the matching assertion when Step 0.1's
outcome is known — do not guess.**

## 5. Disclosed-limit comment — final text used

Two placements, per the file's existing convention of stating limits close to the code they apply to
(`verify-admin-token-contrast.mjs` already does this for `RATIO_TOLERANCE`, `resolveColour`, etc.):

1. On `findFrozenRootAliases` itself (§3 above, the "Disclosed limit (source-text check)" paragraph)
   — the primary, authoritative statement.
2. A shorter cross-reference at the top of the new `describe` block in the test file (§4 above) —
   for a reader of the test file who doesn't open the `.mjs`, matching how
   `canonical-domain.test.ts`'s top-of-file comment gives a reader the "why" without needing to open
   another file.

Confirmed before writing this: `src/app/booking/__tests__/no-google-analytics.test.ts` (C-17's
guard) has **no** disclosure sentence — its comment explains *why the guard exists* (historical
regression, credential-exfiltration risk) but never states what it *can't* catch. The plan's
citation of "C-17's precedent" is aspirational, not literal; the disclosure text above was written
fresh against `canonical-domain.test.ts`'s actual idiom (a block comment stating the guard's failure
modes and boundaries), not copied from anywhere.

## 6. What this test reports if run BEFORE Step 0.1 lands

**It FAILS, finding exactly 11 tokens** — empirically confirmed, not asserted. Ran the exact
detection logic (identical to §3's code, copied into a throwaway scratchpad script — never touched
any repo file) against the current, unmodified `src/styles/tokens.css`:

```
count: 11
[
  { "token": "--admin-shell", "target": "--admin-sidebar" },
  { "token": "--admin-surface", "target": "--admin-panel" },
  { "token": "--admin-surface-muted", "target": "--admin-panel-muted" },
  { "token": "--admin-text", "target": "--admin-heading" },
  { "token": "--admin-nav-text", "target": "--admin-body" },
  { "token": "--admin-nav-text-muted", "target": "--admin-text-muted" },
  { "token": "--admin-nav-active-text", "target": "--admin-primary" },
  { "token": "--admin-cormorant-color", "target": "--admin-accent" },
  { "token": "--notif-badge-critical-bg", "target": "--admin-danger" },
  { "token": "--notif-badge-warning-bg", "target": "--admin-warning" },
  { "token": "--notif-badge-info-bg", "target": "--admin-info" }
]
```

This is a **byte-for-byte match** to the plan's own 11-row table (lines 1759-1772) and to
`root-cause-D1.md §5`'s independently-derived 11-row table — same 11 names, same 11 targets, in both
sources. This is strong independent confirmation that (a) the plan's table is accurate, (b) the
detection logic above is correctly scoped (catches all 11, including the 3 `--notif-*` ones the
shared parser misses), and (c) the guard is genuinely demonstrable against the pre-fix state, as the
assignment asked to confirm — it is not merely "written after Step 0.1 in sequence" in a way that
makes it untestable before that; it can be run standalone right now and would correctly fail loud.

The synthetic-fixture test (test 1) is unaffected by Step 0.1's sequencing at all — it never touches
the real file — so it passes identically whether run before or after Step 0.1.

---

## Summary for the orchestrator (apply-ready)

1. Insert the code block in §3 into `scripts/verify-admin-token-contrast.mjs`, between the end of
   `parseTokensCss` (line 231's `}`) and the `// --- 1b. ...` separator (line 233).
2. Add `findFrozenRootAliases` to the test file's import list (§4).
3. Insert the `describe(...)` block from §4 between the `derivePairs + checkPairs` block (ends line
   190) and `describe("run() — CLI-facing entry point", ...)` (starts line 192).
4. **After Step 0.1 lands**, check whether `--admin-shell` was de-aliased or deferred, and use the
   matching form of the second test's assertion from §4's conditional note.
5. Verify: `npx vitest run scripts/verify-admin-token-contrast.test.ts` — both new tests pass; the
   synthetic one passes regardless of Step 0.1's status; the real-file one requires Step 0.1 to have
   landed (and requires knowing the `--admin-shell` outcome) to pass with `toEqual([])`.

## Anchors verified this pass (report drift: none found)

- `tokens.css` line numbers for all 11 tokens (67, 70, 71, 75, 129, 130, 132, 136, 174, 176, 178) —
  read directly, exact match to the plan's stated lines, zero drift.
- The false "Aliases ... deliberately NOT repeated" comment — confirmed still at lines 319-325,
  exact match to the plan's stated anchor.
- `.mjs` exports and `.test.ts` import idiom — read in full, confirmed as stated in §1.
- `--notif-*` invisibility to `parseTokensCss`/`DECL_RE` — newly discovered this pass, empirically
  confirmed via a live `node -e` run against the real module (not previously disclosed in
  `root-cause-D1.md` or `item-07a-phase0-theme.md`, both of which found the 11-token list by manual
  file reading, not by running this tool).
