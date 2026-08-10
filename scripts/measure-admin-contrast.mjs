#!/usr/bin/env node
// Static admin contrast analyser — no browser, no login.
// Resolves --admin-* tokens per theme from tokens.css, walks each .tsx/.ts
// file's AST (TypeScript compiler API) to find every JSX className unit and
// every cva-style variant-map colour value, extracts Tailwind arbitrary
// colour utilities (incl. hover:/active:/focus-visible:/data-[…]: prefixes
// and /NN alpha modifiers), resolves each to sRGB, composites alpha, and
// computes the WCAG ratio per theme.
//
// Pairing is AST-based, not line-based: colours are grouped per JSX element
// and per conditional-rendering branch (ternary branches are never merged
// with each other; each `cond && "…"` argument in a cn()/clsx() call forms
// its own branch, merged only with the call's unconditional classes).
//
// Known, disclosed limits (do not silently "fix" by guessing):
//   - A class string that cannot be resolved statically (a computed
//     expression, an imported constant, a call other than cn/clsx/cx/
//     classNames) is counted as `unresolved` and skipped, never guessed.
//   - Independent conditional arguments within the same cn()/clsx() call are
//     evaluated as separate branches, not cross-multiplied with each other —
//     a pairing that only exists when two independent conditions are BOTH
//     true will not be found. This trades recall for the same reason line-
//     based pairing was replaced: inventing pairings that cannot be proven
//     is worse than a documented gap.
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

// ---------- CLI args ----------
const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith("--"));
const ROOT = positional[0] || ".";
const JSON_OUT = argv.includes("--json");
const THEME_FILTER = argv.find((a) => a.startsWith("--theme="))?.split("=")[1] || null;
const MAX_FAILURES_ARG = argv.find((a) => a.startsWith("--max-failures="));
const MAX_FAILURES = MAX_FAILURES_ARG ? parseInt(MAX_FAILURES_ARG.split("=")[1], 10) : null;

// ---------- colour maths ----------
export function oklchToRgb(L, C, H) {
  const l = L, a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L3 = l_ ** 3, M3 = m_ ** 3, S3 = s_ ** 3;
  let r = 4.0767416621 * L3 - 3.3077115913 * M3 + 0.2309699292 * S3;
  let g = -1.2684380046 * L3 + 2.6097574011 * M3 - 0.3413193965 * S3;
  let bb = -0.0041960863 * L3 - 0.7034186147 * M3 + 1.707614701 * S3;
  const enc = (v) => {
    v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(v * 255)));
  };
  return [enc(r), enc(g), enc(bb)];
}
export function parseColour(str, tokens, theme, depth = 0) {
  if (!str || depth > 4) return null;
  str = str.trim();
  let m = str.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*(.+))?\)$/i);
  if (m) {
    const val = tokens[m[1]]?.[theme];
    if (val) return parseColour(val, tokens, theme, depth + 1);
    return m[2] ? parseColour(m[2], tokens, theme, depth + 1) : null;
  }
  m = str.match(/^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)/i);
  if (m) return oklchToRgb(parseFloat(m[1]) / 100, parseFloat(m[2]), parseFloat(m[3]));
  m = str.match(/^#([0-9a-f]{6})$/i);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  m = str.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (m) return [+m[1], +m[2], +m[3]];
  if (/^white$/i.test(str)) return [255, 255, 255];
  if (/^black$/i.test(str)) return [0, 0, 0];
  return null;
}
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
export const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export const composite = (c, alpha, under) =>
  alpha >= 1 ? c : [0, 1, 2].map((i) => Math.round(c[i] * alpha + under[i] * (1 - alpha)));

// ---------- tokens ----------
/**
 * Pure CSS-text -> {token: {light, dark}} parser. No file I/O — testable directly.
 * @returns {Record<string, {light?: string, dark?: string}>}
 */
export function parseTokensCss(css) {
  const tokens = {};
  function harvest(block, theme) {
    for (const m of block.matchAll(/(--admin-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      tokens[m[1]] ??= {};
      if (!(theme in tokens[m[1]])) tokens[m[1]][theme] = m[2].trim();
    }
  }
  const darkStart = css.indexOf('[data-theme="dark"]');
  const lightStart = css.indexOf('[data-theme="light"]');
  const printStart = css.indexOf("@media print");
  harvest(css.slice(darkStart, lightStart), "dark");
  harvest(css.slice(lightStart, printStart > 0 ? printStart : css.length), "light");
  harvest(css.slice(0, darkStart), "light");   // :root defaults = light
  harvest(css.slice(0, darkStart), "dark");    // fallback only if dark lacks it
  return tokens;
}
function loadTokens(root) {
  return parseTokensCss(readFileSync(join(root, "src/styles/tokens.css"), "utf8"));
}

// ---------- file walk ----------
function walk(d, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules|__tests__/.test(e.name)) walk(p, out); }
    else if (/\.(tsx|ts)$/.test(p) && !/\.test\./.test(p)) out.push(p);
  }
  return out;
}

// ---------- Tailwind colour-utility extraction ----------
// Capture the state-prefix run immediately before text-[…]/bg-[…] — any
// non-whitespace, non-quote text ending in ':' (hover:, disabled:, sm:,
// data-[state=x]:, stacked sm:hover:, …). Generic on purpose: an earlier
// version of this tool only recognised a fixed enum of prefixes, so an
// unlisted one (e.g. disabled:) fell through as "no prefix" and collided
// with the real base state in the dedup step below. Capture an optional
// alpha modifier: bg-[...]/12
const FG = /(?:^|[\s"'`])([^\s"'`]*:)?text-\[([^\]]+)\](?:\/(\d{1,3}))?/g;
const BG = /(?:^|[\s"'`])([^\s"'`]*:)?bg-\[([^\]]+)\](?:\/(\d{1,3}))?/g;
// A property/attribute value is worth treating as a colour-bearing unit only
// if it actually contains one of these arbitrary-value utilities.
const LOOKS_COLOURED = /\b(?:text|bg)-\[/;

/**
 * tailwind-merge (used inside this codebase's `cn()`) drops an earlier
 * utility when a LATER one in the merged string shares the same state
 * prefix and utility root (e.g. two `hover:bg-[...]` in one class list —
 * only the last renders). Concatenating a cn() call's unconditional
 * classes with one conditional branch (see resolveClassExpr) can bring two
 * same-prefix utilities into one unit that were never on the same source
 * line before; without this step that reads as a colour pairing that can
 * never actually render. Keep only the last match per prefix group, in the
 * unit text's own order — the same rule tailwind-merge applies.
 */
export function dedupeByPrefixLastWins(matches) {
  const byPrefix = new Map();
  for (const m of matches) byPrefix.set(m.prefix, m); // later matches overwrite earlier ones
  return [...byPrefix.values()];
}

// ---------- AST class-string resolution ----------
const CN_CALLEES = new Set(["cn", "clsx", "classNames", "classnames", "cx"]);
const CONDITIONAL_BINARY_OPS = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

/**
 * Resolve an expression that (statically) contributes to a `className`
 * value into a set of mutually-exclusive rendering "branches" — each a
 * complete, concatenated class-string for one possible render, tagged with
 * the source line its most specific contributing fragment came from (so a
 * multi-line cn() call still reports each conditional branch at its own
 * line, not the line the attribute opens on).
 *
 * Ternary branches, and each independent `cond && "…"` argument inside a
 * cn()/clsx() call, become SEPARATE branches — never merged with each
 * other, which is exactly the false-positive class this rewrite removes.
 *
 * Returns { branches: {text,line}[], unresolved: boolean }. `unresolved` is
 * true if any part of the expression could not be resolved statically (a
 * variable, an imported constant, a non-cn call, …) — such parts contribute
 * nothing to `branches` rather than being guessed.
 */
export function resolveClassExpr(node, sourceFile) {
  const lineOf = (n) => sourceFile.getLineAndCharacterOfPosition(n.getStart(sourceFile)).line + 1;
  if (!node) return { branches: [{ text: "", line: undefined }], unresolved: false };

  if (ts.isParenthesizedExpression(node)) return resolveClassExpr(node.expression, sourceFile);
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return resolveClassExpr(node.expression, sourceFile);

  // Literal "nothing" — resolved, contributes no text, not unresolved.
  if (node.kind === ts.SyntaxKind.TrueKeyword ||
      node.kind === ts.SyntaxKind.FalseKeyword ||
      node.kind === ts.SyntaxKind.NullKeyword ||
      (ts.isIdentifier(node) && node.text === "undefined")) {
    return { branches: [{ text: "", line: lineOf(node) }], unresolved: false };
  }

  if (ts.isStringLiteralLike(node)) return { branches: [{ text: node.text, line: lineOf(node) }], unresolved: false };

  if (ts.isTemplateExpression(node)) {
    let parts = [{ text: node.head.text, line: lineOf(node) }];
    let unresolved = false;
    for (const span of node.templateSpans) {
      const sub = resolveClassExpr(span.expression, sourceFile);
      unresolved = unresolved || sub.unresolved;
      const next = [];
      for (const p of parts) for (const b of sub.branches) {
        next.push({ text: p.text + b.text + span.literal.text, line: b.line ?? p.line });
      }
      parts = next;
    }
    return { branches: parts, unresolved };
  }

  if (ts.isConditionalExpression(node)) {
    const a = resolveClassExpr(node.whenTrue, sourceFile);
    const b = resolveClassExpr(node.whenFalse, sourceFile);
    return { branches: [...a.branches, ...b.branches], unresolved: a.unresolved || b.unresolved };
  }

  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
      // `cond && "…"` — only the right side ever contributes text; the
      // "false" state contributes nothing and needs no branch of its own.
      return resolveClassExpr(node.right, sourceFile);
    }
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      const a = resolveClassExpr(node.left, sourceFile);
      const b = resolveClassExpr(node.right, sourceFile);
      return { branches: [...a.branches, ...b.branches], unresolved: a.unresolved || b.unresolved };
    }
    return { branches: [{ text: "", line: lineOf(node) }], unresolved: true };
  }

  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && CN_CALLEES.has(node.expression.text)) {
    let base = "";
    let baseLine = lineOf(node);
    let unresolved = false;
    const forkGroups = [];
    for (const arg of node.arguments) {
      if (ts.isSpreadElement(arg)) { unresolved = true; continue; }
      const isConditionalShape =
        ts.isConditionalExpression(arg) ||
        (ts.isBinaryExpression(arg) && CONDITIONAL_BINARY_OPS.has(arg.operatorToken.kind));
      const res = resolveClassExpr(arg, sourceFile);
      unresolved = unresolved || res.unresolved;
      if (isConditionalShape || res.branches.length > 1) {
        forkGroups.push(res.branches);
      } else {
        // Only move the reported anchor line to this arg if it actually
        // contributed text — an unresolvable passthrough prop (e.g. the
        // trailing `className` in `cn("…colours…", className)`) resolves
        // to an empty branch and must not steal the line away from the
        // arg that actually held the colour utilities.
        if (res.branches[0].text.trim()) {
          base += " " + res.branches[0].text;
          if (res.branches[0].line !== undefined) baseLine = res.branches[0].line;
        }
      }
    }
    const branches = [{ text: base, line: baseLine }];
    for (const group of forkGroups) for (const b of group) {
      branches.push({ text: base + " " + b.text, line: b.line ?? baseLine });
    }
    return { branches, unresolved };
  }

  // Unresolvable: identifiers (props, imported constants), member/element
  // access, calls other than cn/clsx, etc. Do not guess.
  return { branches: [{ text: "", line: lineOf(node) }], unresolved: true };
}

/**
 * Walk one source file's AST and collect colour-bearing "units": one per
 * JSX className branch, and one per cva-style variant-map string value.
 * Returns { units, unresolvedElements }.
 */
export function collectUnits(filePath, text) {
  const isTsx = /\.tsx$/.test(filePath);
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const units = [];
  let unresolvedElements = 0;

  const lineOf = (node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

  function visitJsx(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(sourceFile) === "className" && node.initializer) {
      const init = node.initializer;
      const expr = ts.isStringLiteral(init) ? init : ts.isJsxExpression(init) ? init.expression : null;
      if (expr) {
        const { branches, unresolved } = resolveClassExpr(expr, sourceFile);
        const attrLine = lineOf(node);
        for (const branch of branches) {
          if (branch.text.trim()) units.push({ text: branch.text, line: branch.line ?? attrLine, source: "jsx" });
        }
        if (unresolved) unresolvedElements++;
      }
    }
    ts.forEachChild(node, visitJsx);
  }

  function visitVariantMaps(node) {
    if (ts.isPropertyAssignment(node) && ts.isStringLiteralLike(node.initializer) && LOOKS_COLOURED.test(node.initializer.text)) {
      units.push({ text: node.initializer.text, line: lineOf(node.initializer), source: "variant-map" });
    }
    ts.forEachChild(node, visitVariantMaps);
  }

  visitJsx(sourceFile);
  visitVariantMaps(sourceFile);

  return { units, unresolvedElements };
}

// ---------- pairing + ratio ----------
export function analyzeUnit(unit, file, tokens) {
  const out = [];
  const fgAll = [...unit.text.matchAll(FG)].map((m) => ({ prefix: m[1] || "", colour: m[2].replace(/_/g, " "), alpha: m[3] ? +m[3] / 100 : 1 }));
  const bgAll = [...unit.text.matchAll(BG)].map((m) => ({ prefix: m[1] || "", colour: m[2].replace(/_/g, " "), alpha: m[3] ? +m[3] / 100 : 1 }));
  const fgs = dedupeByPrefixLastWins(fgAll).map((m) => [m.colour, m.alpha]);
  const bgs = dedupeByPrefixLastWins(bgAll).map((m) => [m.colour, m.alpha]);
  if (!fgs.length) return out;
  for (const theme of ["dark", "light"]) {
    const panel = parseColour("var(--admin-panel)", tokens, theme) || [0, 0, 0];
    for (const [fgRaw, fgA] of fgs) {
      const fg = parseColour(fgRaw, tokens, theme);
      if (!fg) continue;
      const cands = bgs.length
        ? bgs.map(([b, a]) => {
            const c = parseColour(b, tokens, theme);
            return [a < 1 ? `${b}/${Math.round(a * 100)}` : b, c ? composite(c, a, panel) : null];
          })
        : [["--admin-panel", panel],
           ["--admin-canvas", parseColour("var(--admin-canvas)", tokens, theme)]];
      for (const [bgRaw, bg] of cands) {
        if (!bg) continue;
        const fgC = composite(fg, fgA, bg);
        const cr = ratio(fgC, bg);
        if (cr < 4.5) {
          out.push({
            file, line: unit.line, theme, cr: +cr.toFixed(2),
            fg: fgA < 1 ? `${fgRaw}/${Math.round(fgA * 100)}` : fgRaw,
            bg: bgRaw,
            assumed: !bgs.length,
            kind: bgs.length ? "explicit-pair" : "assumed-surface",
            source: unit.source,
          });
        }
      }
    }
  }
  return out;
}

// ---------- run ----------
export function run(root) {
  const tokens = loadTokens(root);
  const files = [...walk(join(root, "src/app/admin")), ...walk(join(root, "src/components/ui"))];

  const found = new Map(); // dedupe key -> finding (branches can rediscover the same base pairing)
  let unresolvedElements = 0;

  for (const f of files) {
    const text = readFileSync(f, "utf8");
    const rel = f.replace(/\\/g, "/").replace(root.replace(/\\/g, "/") + "/", "");
    const { units, unresolvedElements: fileUnresolved } = collectUnits(f, text);
    unresolvedElements += fileUnresolved;
    for (const unit of units) {
      for (const finding of analyzeUnit(unit, rel, tokens)) {
        const key = `${finding.file}:${finding.line}:${finding.theme}:${finding.fg}:${finding.bg}:${finding.kind}`;
        if (!found.has(key)) found.set(key, finding);
      }
    }
  }

  let results = [...found.values()];
  if (THEME_FILTER) results = results.filter((r) => r.theme === THEME_FILTER);
  results.sort((a, b) => a.cr - b.cr);

  return { files, tokens, results, unresolvedElements };
}

// ---------- CLI entry point ----------
// Guarded so `import`ing this module (the self-test) never triggers a full
// repo scan, console output, or an exit-code side effect — only running it
// directly (`node scripts/measure-admin-contrast.mjs`) does.
const isMain = (() => {
  try {
    return process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  const { files, tokens, results, unresolvedElements } = run(ROOT);
  const paired = results.filter((r) => r.kind === "explicit-pair");
  const summary = {
    filesScanned: files.length,
    tokensResolved: Object.keys(tokens).length,
    unresolvedElements,
    total: results.length,
    explicitPair: paired.length,
    assumedSurface: results.length - paired.length,
    dark: results.filter((r) => r.theme === "dark").length,
    light: results.filter((r) => r.theme === "light").length,
    theme: THEME_FILTER || "both",
  };

  if (JSON_OUT) {
    console.log(JSON.stringify({ summary, findings: results }, null, 2));
  } else {
    console.log(`files scanned: ${summary.filesScanned}`);
    console.log(`tokens resolved: ${summary.tokensResolved}`);
    console.log(`unresolved elements (class string could not be resolved statically): ${summary.unresolvedElements}`);
    console.log(`FAILURES (<4.5:1)  total ${summary.total}   explicit-pair ${summary.explicitPair}   assumed-surface ${summary.assumedSurface}`);
    console.log(`  dark ${summary.dark} / light ${summary.light}`);
    console.log(`\n--- worst 20 EXPLICIT pairs (both colours on the same element+state) ---`);
    for (const r of paired.slice(0, 20)) console.log(`  ${String(r.cr).padStart(5)}:1 ${r.theme.padEnd(5)} ${r.file}:${r.line}\n           fg=${r.fg}  bg=${r.bg}`);
    const byFile = {};
    for (const r of results) byFile[r.file] = (byFile[r.file] || 0) + 1;
    console.log(`\n--- worst 12 files by failure count ---`);
    Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([f, n]) => console.log(`  ${String(n).padStart(4)}  ${f}`));
  }

  if (MAX_FAILURES !== null && results.length > MAX_FAILURES) {
    process.exitCode = 1;
  }
}
