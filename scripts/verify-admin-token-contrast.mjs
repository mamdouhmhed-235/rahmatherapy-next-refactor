#!/usr/bin/env node
// Static proof that every --admin-* TOKEN PAIR meets WCAG AA contrast, in
// both themes, with no browser and no login.
//
// See redesign/plans/POST-BAND-C-FOLLOWUP-plan.md ITEM 7 §7.4(b) and §7.9(a):
// once hardcoded oklch(...) literals are gone from src/app/admin/** and
// src/components/ui/**, every admin colour comes from the ~92 --admin-*
// tokens in src/styles/tokens.css. Contrast then stops being a per-page
// property and becomes a property of the TOKEN PAIRS — proving the pairs
// meet AA in both themes proves it for every admin page, every role variant
// and every theme at once, exhaustively, with no login required.
//
// Two checks:
//   1b. Self-declared ratios — tokens.css carries `/* X.XX:1 vs <bg> */`
//       comments next to some declarations. Recompute each, in the exact
//       theme block the comment sits in, and compare to the stated figure.
//       A stale ratio comment is a claim the design system makes about
//       itself and is worse than no comment at all — report mismatches,
//       never silently correct them.
//   1c. Derived semantic pairs — naming-convention and documented pairs
//       (status text/bg, the "strong" severity family, on-primary vs solid
//       fills, foreground-ish tokens vs the real admin surfaces), checked
//       at AA (4.5:1 normal text) in both [data-theme="dark"] and
//       [data-theme="light"].
//
// Analysis only. This script never edits tokens.css. If a pair genuinely
// fails AA, that is a finding for ITEM 7 Phase A/B to fix, reported here,
// not corrected here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Resolved against the current working directory rather than import.meta.url:
// under vitest/vite-node's SSR transform, import.meta.url is not always a
// real file:// URL, which breaks fileURLToPath(). Matches this repo's
// existing convention (scripts/measure-admin-contrast.mjs takes ROOT as
// `process.argv[2] || "."`) — run from the repo root, as every npm script
// and vitest invocation here already does.
export const ROOT = process.cwd();
export const TOKENS_PATH = join(ROOT, "src/styles/tokens.css");

// ---------------------------------------------------------------------------
// Colour maths: oklch -> oklab -> linear sRGB -> sRGB, plus #hex / rgb() /
// named colours, and nested var(--token, fallback) resolution against a
// theme-scoped {name: rawValue} map. Then WCAG relative luminance + ratio.
// ---------------------------------------------------------------------------

/** oklch(L% C H) -> [r,g,b] each 0-255. Standard OKLab matrices. */
export function oklchToRgb(lPercent, c, hDeg) {
  const L = lPercent / 100;
  const hRad = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  const rLin = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  return [rLin, gLin, bLin].map(linearToSrgb8);
}

function linearToSrgb8(v) {
  const encoded = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(encoded * 255)));
}

const NAMED_COLOURS = {
  white: [255, 255, 255],
  black: [0, 0, 0],
};

/**
 * Resolve a CSS colour expression to [r,g,b] (0-255), following var()
 * references through `scope` (a theme-specific {customPropertyName: rawValue}
 * map). Returns null if it cannot be resolved (unknown function, unresolved
 * var with no fallback, etc.) rather than guessing.
 */
export function resolveColour(raw, scope, depth = 0) {
  if (!raw || depth > 8) return null;
  const str = raw.trim();

  const varMatch = str.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([\s\S]+))?\)$/i);
  if (varMatch) {
    const [, name, fallback] = varMatch;
    if (Object.prototype.hasOwnProperty.call(scope, name) && scope[name] !== undefined) {
      return resolveColour(scope[name], scope, depth + 1);
    }
    return fallback ? resolveColour(fallback, scope, depth + 1) : null;
  }

  const oklchMatch = str.match(/^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)/i);
  if (oklchMatch) {
    const [, l, c, h] = oklchMatch;
    return oklchToRgb(parseFloat(l), parseFloat(c), parseFloat(h));
  }

  const hexMatch = str.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  }

  const rgbMatch = str.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgbMatch) return [1, 2, 3].map((i) => parseInt(rgbMatch[i], 10));

  const named = NAMED_COLOURS[str.toLowerCase()];
  if (named) return named;

  return null;
}

function relativeLuminance([r, g, b]) {
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio, 1:1 (identical) to 21:1 (black on white). */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ---------------------------------------------------------------------------
// Parse tokens.css into its four blocks, confirmed by reading the file
// (src/styles/tokens.css:1, :331, :451, :543): `:root` (light defaults),
// `[data-theme="dark"]`, `[data-theme="light"]`, `@media print`.
// ---------------------------------------------------------------------------

/** Extract the body between the first balanced `{ ... }` found after `selectorIndex`. */
function extractBraceBlock(css, selectorIndex, label) {
  if (selectorIndex === -1) {
    throw new Error(
      `verify-admin-token-contrast: could not find the "${label}" block in tokens.css — has the file structure changed? Re-check the block boundaries before trusting this tool's output.`
    );
  }
  const braceOpen = css.indexOf("{", selectorIndex);
  if (braceOpen === -1) throw new Error(`verify-admin-token-contrast: "${label}" block has no opening brace`);
  let depth = 0;
  for (let i = braceOpen; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(braceOpen + 1, i);
    }
  }
  throw new Error(`verify-admin-token-contrast: "${label}" block braces never close`);
}

const DECL_RE = /(--admin-[a-z0-9-]+)\s*:\s*([^;]+);/g;

function harvestDeclarations(blockBody) {
  const out = {};
  for (const m of blockBody.matchAll(DECL_RE)) out[m[1]] = m[2].trim();
  return out;
}

// Matches the documented convention: `--admin-x: <value>;   /* R.RR:1 vs <bg> */`
const RATIO_COMMENT_RE = /(--admin-[a-z0-9-]+)\s*:\s*([^;]+);\s*\/\*\s*([\d.]+):1\s+vs\s+([^*]+?)\s*\*\//g;

function harvestRatioComments(blockBody, blockLabel) {
  const out = [];
  for (const m of blockBody.matchAll(RATIO_COMMENT_RE)) {
    out.push({ block: blockLabel, token: m[1], statedRatio: parseFloat(m[3]), bgRaw: m[4].trim() });
  }
  return out;
}

/** "danger-bg-strong" -> "--admin-danger-bg-strong"; "--admin-panel" -> unchanged. */
function normalizeTokenRef(raw) {
  const t = raw.trim();
  return t.startsWith("--") ? t : `--admin-${t}`;
}

/**
 * @returns {{
 *   tokens: Record<string, {light: string|undefined, dark: string|undefined}>,
 *   scopes: Record<'root'|'dark'|'light'|'print', Record<string,string>>,
 *   ratioComments: Array<{block: string, token: string, statedRatio: number, bgRaw: string}>,
 * }}
 */
export function parseTokensCss(css) {
  const rootBody = extractBraceBlock(css, css.indexOf(":root {"), ":root");
  const darkBody = extractBraceBlock(css, css.indexOf('[data-theme="dark"]'), '[data-theme="dark"]');
  const lightBody = extractBraceBlock(css, css.indexOf('[data-theme="light"]'), '[data-theme="light"]');
  // Search for the selector WITH its opening brace: the file also contains the
  // literal words "@media print" inside a prose comment (tokens.css:317) that
  // sits before the real rule, and a bare indexOf("@media print") matches the
  // comment and then consumes the next block's braces — i.e. it silently
  // returned the [data-theme="dark"] body under the "print" label.
  const printBody = extractBraceBlock(css, css.indexOf("@media print {"), "@media print");

  const rootDecl = harvestDeclarations(rootBody);
  const darkDecl = harvestDeclarations(darkBody);
  const lightDecl = harvestDeclarations(lightBody);
  const printDecl = harvestDeclarations(printBody);

  // :root declares the light defaults AND every alias (--admin-shell,
  // --admin-text, ...) that the theme blocks never redeclare. Theme blocks
  // take precedence over :root for anything they DO redeclare.
  const names = new Set([...Object.keys(rootDecl), ...Object.keys(darkDecl), ...Object.keys(lightDecl)]);
  const tokens = {};
  for (const name of names) {
    tokens[name] = {
      light: lightDecl[name] ?? rootDecl[name],
      dark: darkDecl[name] ?? rootDecl[name],
    };
  }

  const scopes = {
    root: { ...rootDecl },
    dark: { ...rootDecl, ...darkDecl },
    light: { ...rootDecl, ...lightDecl },
    print: { ...rootDecl, ...printDecl },
  };

  const ratioComments = [
    ...harvestRatioComments(rootBody, "root"),
    ...harvestRatioComments(darkBody, "dark"),
    ...harvestRatioComments(lightBody, "light"),
    ...harvestRatioComments(printBody, "print"),
  ];

  return { tokens, scopes, ratioComments };
}

// ---------------------------------------------------------------------------
// 1a-bis. Regression guard for the alias-freeze defect class — the exact shape
// that froze D1/D7/D9 (see redesign/evidence/admin-contrast/root-cause-D1.md).
// A token declared in :root as a bare `var(--other-token)` is substituted once,
// at :root, against :root's permanently-light environment — :root is <html>, and
// <html> never carries data-theme (that lives on the [data-admin-theme-root]
// wrapper, see ThemeProvider.tsx). Every descendant then inherits that
// already-frozen value, forever, in both themes.
//
// Deliberately independent of DECL_RE above: DECL_RE only matches "--admin-*",
// so it silently never sees a "--notif-*" declaration. Three of the eleven real
// instances were --notif-badge-*-bg tokens, so a guard reusing DECL_RE would
// have missed exactly the ones that caused D7.
// ---------------------------------------------------------------------------

const ALIAS_DECL_RE = /(--(?:admin|notif)-[a-z0-9-]+)\s*:\s*([^;]+);/g;

function harvestAliasDeclarations(blockBody) {
  const out = {};
  for (const m of blockBody.matchAll(ALIAS_DECL_RE)) out[m[1]] = m[2].trim();
  return out;
}

// Matches a value that is NOTHING BUT a single, fallback-free var() reference.
// Deliberately narrow:
//   - var() WITH a fallback ("var(--x, #fff)") does NOT match. None of the
//     eleven real instances used one, and treating that form as in-scope would
//     be an unverified expansion beyond the confirmed defect shape.
//   - a var() wrapped in another function ("calc(var(--x))", "color-mix(...)")
//     does NOT match — that is "the value USES a token", a different and very
//     common shape here, and matching it would be false-positive noise.
const BARE_ALIAS_RE = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i;

/**
 * Flags every --admin-* / --notif-* token declared in :root as a bare var()
 * reference that is NOT also declared in BOTH the dark and the light block.
 *
 * Presence of a per-block declaration is the right criterion, not "is the
 * redeclared value a literal": redeclaring the alias line itself inside a theme
 * block forces re-resolution in that theme's own scope, which also breaks the
 * freeze. This checks for that structural escape hatch, not for a value shape.
 *
 * Scope, disclosed: :root against dark AND light only. It does not check
 * @media print. A token fixed in :root/dark/light but left aliased in print
 * would not be caught — an accepted gap, not an oversight: print renders the
 * light palette, so a print-side alias resolves to the light value anyway.
 *
 * Disclosed limit: this is a SOURCE-TEXT check against tokens.css's own
 * declared text. It cannot catch an alias introduced by any other mechanism —
 * element.style.setProperty() at runtime, a CSS-in-JS layer, or any
 * non-declarative source outside this file. It is also not comment-aware: a
 * comment containing a verbatim `--admin-foo: var(--bar);` example would
 * false-positive, the same characteristic every regex parser in this file has.
 *
 * @param {string} css full tokens.css source (or CSS sharing its block shape)
 * @returns {Array<{token: string, target: string}>} frozen-shaped tokens found
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

// ---------------------------------------------------------------------------
// 1b. Verify the self-declared ratio comments, in the theme block each sits in.
// ---------------------------------------------------------------------------

// Rounding-artefact tolerance: source comments are hand-rounded to 2dp, and
// an independently-implemented oklch->srgb path can legitimately drift a few
// hundredths at the 8-bit encode step. 0.15 absorbs that while still catching
// real mismatches, which in practice run in whole ratio points, not hundredths.
export const RATIO_TOLERANCE = 0.15;

/**
 * @typedef {{
 *   block: string, token: string, statedRatio: number, bgRaw: string, bgName: string,
 *   actualRatio: number|null, delta: number|null, pass: boolean|null, error?: string,
 * }} RatioCommentResult
 * @param {ReturnType<typeof parseTokensCss>} parsed
 * @returns {RatioCommentResult[]}
 */
export function verifyRatioComments(parsed) {
  return parsed.ratioComments.map((c) => {
    const scope = parsed.scopes[c.block];
    const bgName = normalizeTokenRef(c.bgRaw);
    const fgRaw = scope[c.token];
    const bgRaw = scope[bgName];
    const fg = resolveColour(fgRaw, scope);
    const bg = resolveColour(bgRaw, scope);

    if (!fg || !bg) {
      const missing = !fgRaw ? c.token : !bgRaw ? bgName : !fg ? `${c.token} (value "${fgRaw}")` : `${bgName} (value "${bgRaw}")`;
      return { ...c, bgName, actualRatio: null, delta: null, pass: null, error: `could not resolve ${missing} in the "${c.block}" block` };
    }

    const actualRatio = contrastRatio(fg, bg);
    const delta = actualRatio - c.statedRatio;
    return { ...c, bgName, actualRatio, delta, pass: Math.abs(delta) <= RATIO_TOLERANCE };
  });
}

// ---------------------------------------------------------------------------
// 1c. Derive the semantic pairs the token system actually intends, and check
// each at AA in both themes. NOT a cross-product of all tokens — see the
// basis recorded on each pair, printed in the report, for what was and
// wasn't covered.
// ---------------------------------------------------------------------------

const AA_NORMAL = 4.5;

const REAL_SURFACES = ["--admin-canvas", "--admin-panel", "--admin-panel-muted", "--admin-nav-bg"];
const SOLID_FILLS = ["--admin-primary", "--admin-primary-hover", "--admin-primary-active", "--admin-danger-solid", "--admin-danger-solid-hover"];
const STATUS_FAMILIES = ["confirmed", "pending", "cancelled", "attention", "restricted", "completed"];
// Same base+tint pattern as the status family (tokens.css:143-147's
// "--admin-status-{family}-{slot}" convention), but for the plain severity
// tokens, which use the bare name as the foreground instead of a "-text"
// suffix. Not one of §1c's four named bullets verbatim — added because it is
// the same semantic shape, and omitting it would leave a real, checkable
// gap in a proof that claims to cover "the pairs the system intends".
const SEVERITY_BASE_BG = ["success", "warning", "danger", "info", "restricted"];

export function derivePairs(tokens, ratioComments) {
  const pairs = [];
  const seen = new Set();
  function add(fg, bg, basis, threshold = AA_NORMAL) {
    if (!(fg in tokens) || !(bg in tokens)) return; // token doesn't exist — skip, don't fabricate a pair
    const key = `${fg}|${bg}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ fg, bg, basis, threshold });
  }

  for (const family of STATUS_FAMILIES) {
    add(`--admin-status-${family}-text`, `--admin-status-${family}-bg`, "naming convention: --admin-status-<x>-text / -bg");
  }

  add("--admin-danger-text-strong", "--admin-danger-bg-strong", "naming convention: *-text-strong / *-bg-strong");
  add("--admin-warning-text-strong", "--admin-warning-bg-strong", "naming convention: *-text-strong / *-bg-strong");
  add(
    "--admin-success",
    "--admin-success-bg-strong",
    "documented exception, tokens.css:104-108: success has no -text-strong token, pairs with the base --admin-success instead"
  );

  for (const severity of SEVERITY_BASE_BG) {
    add(`--admin-${severity}`, `--admin-${severity}-bg`, "extended naming convention: --admin-<severity> vs its own -bg tint (same shape as the status family)");
  }

  for (const fill of SOLID_FILLS) {
    add("--admin-on-primary", fill, "documented: --admin-on-primary is the foreground for solid admin action fills");
  }
  add("--admin-action-primary-text", "--admin-primary", "documented, tokens.css:206-210: .admin-action-primary text on the --admin-primary fill");

  // Tokens that match the foreground-ish pattern syntactically but are not
  // general-purpose body/heading/label colours meant to sit on an arbitrary
  // admin surface, so checking them against the four generic surfaces is the
  // "cross-product... meaningless noise" this section is told to avoid:
  //   --admin-panel-muted / --admin-surface-muted (its alias) / --admin-sidebar-muted
  //     are themselves SURFACE tokens ("*-muted*" here means "a muted surface",
  //     not "muted text") — --admin-panel-muted is literally one of the four
  //     REAL_SURFACES above, so testing it AS a foreground is a category error.
  //   --admin-action-primary-text is documented (tokens.css:206-210) as the
  //     foreground for the --admin-primary FILL only — that pairing is already
  //     checked below via the documented rule, and it is not a body-text
  //     colour that ever appears on canvas/panel.
  //   --admin-nav-surface-text is documented (tokens.css:438-443) as designed
  //     for a hardcoded-dark chrome surface in BOTH themes, not for
  //     --admin-nav-bg (which flips light in light theme) — and its class is
  //     orphaned (tokens.css:231-237: no live .tsx uses it).
  const NOT_GENERIC_SURFACE_TEXT = new Set([
    "--admin-panel-muted",
    "--admin-surface-muted",
    "--admin-sidebar-muted",
    "--admin-action-primary-text",
    "--admin-nav-surface-text",
  ]);
  const fgLike = Object.keys(tokens).filter((name) => /text|body|heading|muted/i.test(name) && !NOT_GENERIC_SURFACE_TEXT.has(name));
  for (const fg of fgLike) {
    for (const bg of REAL_SURFACES) {
      if (fg === bg) continue;
      add(fg, bg, "naming convention: foreground-ish token (*text*/*body*/*heading*/*muted*) vs a real admin surface");
    }
  }

  for (const c of ratioComments) {
    add(c.token, normalizeTokenRef(c.bgRaw), `named by its own ratio comment in tokens.css's "${c.block}" block`);
  }

  return pairs;
}

function buildThemeScope(tokens, theme) {
  const scope = {};
  for (const [name, value] of Object.entries(tokens)) scope[name] = value[theme];
  return scope;
}

export function checkPairs(pairs, tokens) {
  const lightScope = buildThemeScope(tokens, "light");
  const darkScope = buildThemeScope(tokens, "dark");
  const results = [];
  for (const pair of pairs) {
    for (const [theme, scope] of [
      ["dark", darkScope],
      ["light", lightScope],
    ]) {
      const fgColour = resolveColour(scope[pair.fg], scope);
      const bgColour = resolveColour(scope[pair.bg], scope);
      if (!fgColour || !bgColour) {
        results.push({ ...pair, theme, ratio: null, pass: null });
        continue;
      }
      const ratio = contrastRatio(fgColour, bgColour);
      results.push({ ...pair, theme, ratio, pass: ratio >= pair.threshold });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const json = argv.includes("--json");
  const maxFailuresArg = argv.find((a) => a.startsWith("--max-failures="));
  const maxFailures = maxFailuresArg ? Number(maxFailuresArg.slice("--max-failures=".length)) : Infinity;
  if (maxFailuresArg && !Number.isFinite(maxFailures)) {
    throw new Error(`--max-failures must be a number, got "${maxFailuresArg}"`);
  }
  return { json, maxFailures };
}

export function run(css, { json = false, maxFailures = Infinity } = {}) {
  const parsed = parseTokensCss(css);

  const lightResolved = Object.values(parsed.tokens).filter((t) => t.light !== undefined).length;
  const darkResolved = Object.values(parsed.tokens).filter((t) => t.dark !== undefined).length;

  const ratioResults = verifyRatioComments(parsed);
  const ratioMismatches = ratioResults.filter((r) => r.pass === false);
  const ratioUnresolved = ratioResults.filter((r) => r.pass === null);

  const pairs = derivePairs(parsed.tokens, parsed.ratioComments);
  const pairResults = checkPairs(pairs, parsed.tokens);
  const pairFailures = pairResults.filter((r) => r.pass === false);
  const pairUnresolved = pairResults.filter((r) => r.pass === null);

  const totalFailures = ratioMismatches.length + pairFailures.length;

  const summary = {
    tokensParsed: Object.keys(parsed.tokens).length,
    lightResolved,
    darkResolved,
    ratioCommentsFound: ratioResults.length,
    ratioMismatches: ratioMismatches.length,
    ratioUnresolved: ratioUnresolved.length,
    uniquePairs: pairs.length,
    pairChecksRun: pairResults.length,
    pairFailures: pairFailures.length,
    pairUnresolved: pairUnresolved.length,
    totalFailures,
  };

  const output = json
    ? JSON.stringify({ summary, ratioResults, pairs, pairResults }, null, 2)
    : formatHumanReadable({ summary, ratioResults, ratioMismatches, ratioUnresolved, pairs, pairResults, pairFailures, pairUnresolved });

  return { summary, exitCode: totalFailures > maxFailures ? 1 : 0, output };
}

function formatHumanReadable({ summary, ratioResults, ratioMismatches, ratioUnresolved, pairs, pairResults, pairFailures, pairUnresolved }) {
  const lines = [];
  lines.push("verify-admin-token-contrast — static proof of --admin-* token-pair WCAG AA contrast\n");
  lines.push(`tokens parsed: ${summary.tokensParsed}  (light resolved: ${summary.lightResolved}, dark resolved: ${summary.darkResolved})`);

  lines.push(`\n--- 1b. self-declared ratio comments (${summary.ratioCommentsFound} found) ---`);
  for (const r of ratioResults) {
    if (r.pass === null) {
      lines.push(`  UNRESOLVED [${r.block.padEnd(5)}] ${r.token} vs ${r.bgName}: ${r.error}`);
      continue;
    }
    const mark = r.pass ? "match   " : "MISMATCH";
    lines.push(
      `  ${mark} [${r.block.padEnd(5)}] ${r.token} vs ${r.bgName}: stated ${r.statedRatio.toFixed(2)}:1, actual ${r.actualRatio.toFixed(2)}:1 (delta ${
        r.delta >= 0 ? "+" : ""
      }${r.delta.toFixed(2)})`
    );
  }
  if (ratioMismatches.length === 0 && ratioUnresolved.length === 0) {
    lines.push(`  all ${summary.ratioCommentsFound} self-declared ratios match within +/-${RATIO_TOLERANCE}:1`);
  }

  lines.push(`\n--- 1c. derived semantic pairs (${pairs.length} unique pairs x 2 themes = ${pairResults.length} checks) ---`);
  const basisCounts = new Map();
  for (const p of pairs) basisCounts.set(p.basis, (basisCounts.get(p.basis) ?? 0) + 1);
  for (const [basis, n] of basisCounts) lines.push(`  ${String(n).padStart(3)}  ${basis}`);

  if (pairFailures.length) {
    lines.push(`\n  FAILURES (${pairFailures.length} below AA threshold):`);
    for (const f of pairFailures) {
      lines.push(`    ${f.ratio.toFixed(2).padStart(5)}:1 < ${f.threshold}:1  [${f.theme.padEnd(5)}]  ${f.fg}  vs  ${f.bg}`);
    }
  } else {
    lines.push(`\n  no AA failures among the ${pairResults.length} theme checks`);
  }
  if (pairUnresolved.length) {
    lines.push(`\n  UNRESOLVED (${pairUnresolved.length} — could not compute a colour; not counted as pass or fail):`);
    for (const u of pairUnresolved) lines.push(`    [${u.theme}] ${u.fg} vs ${u.bg}`);
  }

  lines.push(`\n--- summary ---`);
  lines.push(`  ratio-comment mismatches: ${summary.ratioMismatches}`);
  lines.push(`  pair AA failures:         ${summary.pairFailures}`);
  lines.push(`  total failures:           ${summary.totalFailures}`);

  return lines.join("\n");
}

function main() {
  const { json, maxFailures } = parseArgs(process.argv.slice(2));
  const css = readFileSync(TOKENS_PATH, "utf8");
  const { exitCode, output } = run(css, { json, maxFailures });
  console.log(output);
  process.exitCode = exitCode;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
